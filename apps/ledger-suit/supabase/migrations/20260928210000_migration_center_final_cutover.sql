-- LS-MIG-004 / MIG-01..10: Migration Center final review and cutover.
--
-- This command is the only orchestration boundary for final cutover. It locks
-- one project, revalidates the exact source/mapping/staging revisions, invokes
-- the existing Opening Trial Balance and module acceptance commands, and
-- records immutable approval evidence. The Opening Trial Balance remains the
-- single GL effect; module acceptance only creates operational/subledger state.

create table public.migration_cutover_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  project_revision integer not null check (project_revision > 0),
  source_revision_id uuid not null,
  mapping_revision_id uuid not null,
  staging_batch_id uuid not null,
  opening_balance_batch_id uuid not null,
  opening_transaction_id uuid not null,
  open_item_batch_id uuid,
  operational_batch_id uuid not null,
  idempotency_key text not null check (length(btrim(idempotency_key)) between 1 and 160),
  review_result jsonb not null check (jsonb_typeof(review_result) = 'object'),
  ledger_digest_before text not null check (ledger_digest_before ~ '^[0-9a-f]{64}$'),
  ledger_digest_after text not null check (ledger_digest_after ~ '^[0-9a-f]{64}$'),
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default now(),
  constraint migration_cutover_approval_project_scope
    foreign key (project_id, organization_id)
    references public.migration_projects(id, organization_id) on delete restrict,
  constraint migration_cutover_approval_source_scope
    foreign key (source_revision_id, project_id, organization_id)
    references public.migration_source_revisions(id, project_id, organization_id) on delete restrict,
  constraint migration_cutover_approval_opening_scope
    foreign key (opening_balance_batch_id, organization_id)
    references public.opening_balance_batches(id, organization_id) on delete restrict,
  constraint migration_cutover_approval_transaction_scope
    foreign key (opening_transaction_id, organization_id)
    references public.transactions(id, organization_id) on delete restrict,
  constraint migration_cutover_approval_operational_scope
    foreign key (operational_batch_id, organization_id)
    references public.migration_operational_batches(id, organization_id) on delete restrict,
  constraint migration_cutover_approval_open_items_scope
    foreign key (open_item_batch_id, organization_id)
    references public.migration_open_item_batches(id, organization_id) on delete restrict,
  unique (project_id),
  unique (organization_id, idempotency_key)
);

comment on table public.migration_cutover_approvals is
  'Immutable final cutover approval for an exact source revision. Corrections use reviewed replacement/reversal contracts; this evidence is never edited.';

alter table public.migration_cutover_approvals enable row level security;
create policy migration_cutover_approvals_read on public.migration_cutover_approvals
  for select to authenticated using (app.has_capability(organization_id, 'migrations.read'));
grant select on public.migration_cutover_approvals to authenticated;
create trigger migration_cutover_approvals_immutable before update or delete on public.migration_cutover_approvals
  for each row execute function app.reject_migration_evidence_change();

-- A Trial-Balance-only cutover is valid. All operational sections can be
-- explicitly not applicable; their state is still recorded and reviewed.
do $$
declare v_constraint text;
begin
  select c.conname into v_constraint
  from pg_constraint c
  where c.conrelid = 'public.migration_operational_batches'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%open_items_applicable%assets_applicable%bank_applicable%inventory_applicable%tax_applicable%';
  if v_constraint is not null then
    execute format('alter table public.migration_operational_batches drop constraint %I', v_constraint);
  end if;
end $$;

create function app.migration_projected_opening_balance(
  p_organization_id uuid,
  p_account_id uuid,
  p_cutover_date date,
  p_opening_batch_id uuid
) returns bigint language sql stable security definer set search_path = '' as $$
  select app.migration_gl_balance(p_organization_id, p_account_id, p_cutover_date)
    + case when batch.posted_transaction_id is not null then 0 else coalesce((
        select sum(case when account.normal_balance = 'debit'
          then coalesce(row.debit_minor, 0) - coalesce(row.credit_minor, 0)
          else coalesce(row.credit_minor, 0) - coalesce(row.debit_minor, 0) end)
        from public.opening_balance_rows row
        join public.accounts account on account.id = row.mapped_account_id
          and account.organization_id = row.organization_id
        where row.batch_id = batch.id and row.mapped_account_id = p_account_id
      ), 0) end
  from public.opening_balance_batches batch
  where batch.id = p_opening_batch_id and batch.organization_id = p_organization_id;
$$;

create function app.compute_migration_cutover_review(
  p_project_id uuid,
  p_operational_batch_id uuid
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_project public.migration_projects%rowtype;
  v_operational public.migration_operational_batches%rowtype;
  v_opening public.opening_balance_batches%rowtype;
  v_open_items public.migration_open_item_batches%rowtype;
  v_approval public.migration_cutover_approvals%rowtype;
  v_opening_result jsonb := '{}'::jsonb;
  v_open_result jsonb := '{}'::jsonb;
  v_operational_result jsonb := '{}'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_warnings jsonb := jsonb_build_array('MIGRATION_HISTORY_REMAINS_IN_SOURCE');
  v_variances jsonb := '[]'::jsonb;
  v_modules jsonb := '{}'::jsonb;
  v_actual bigint;
  v_expected bigint;
  v_ar bigint := 0;
  v_ap bigint := 0;
  v_error text;
  v_record record;
begin
  select * into v_project from public.migration_projects where id = p_project_id;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration project not found' using errcode = '42501'; end if;
  select * into v_operational from public.migration_operational_batches
    where id = p_operational_batch_id and project_id = p_project_id and organization_id = v_project.organization_id;
  select * into v_approval from public.migration_cutover_approvals where project_id = p_project_id;

  if v_project.status <> 'validated' then v_errors := v_errors || jsonb_build_array('MIGRATION_PROJECT_NOT_VALIDATED'); end if;
  if v_project.current_source_revision_id is null or v_project.current_mapping_revision_id is null
     or v_project.current_staging_batch_id is null then
    v_errors := v_errors || jsonb_build_array('MIGRATION_CURRENT_REVISION_INCOMPLETE');
  end if;
  if v_operational.id is null or v_operational.staging_batch_id is distinct from v_project.current_staging_batch_id then
    v_errors := v_errors || jsonb_build_array('MIGRATION_OPERATIONAL_BATCH_REQUIRED');
  end if;
  select * into v_opening from public.opening_balance_batches
    where id = v_project.opening_balance_batch_id and organization_id = v_project.organization_id;
  if not found or v_opening.cutoff_date is distinct from v_project.cutover_date or v_opening.status = 'reversed' then
    v_errors := v_errors || jsonb_build_array('MIGRATION_OPENING_BATCH_INVALID');
  else
    v_opening_result := case when v_opening.posted_transaction_id is not null
      then v_opening.validation_result else app.compute_opening_validation(v_opening.id) end;
    if not coalesce((v_opening_result->>'valid')::boolean, false) then
      v_errors := v_errors || coalesce(v_opening_result->'errors', '[]'::jsonb);
    end if;
  end if;

  if v_operational.id is not null then
    if v_operational.open_items_applicable then
      select * into v_open_items from public.migration_open_item_batches
        where project_id = p_project_id order by revision desc limit 1;
      if not found or v_open_items.staging_batch_id is distinct from v_project.current_staging_batch_id then
        v_errors := v_errors || jsonb_build_array('MIGRATION_OPEN_ITEMS_REQUIRED');
      else
        v_open_result := app.compute_migration_open_item_validation(v_open_items.id);
        for v_error in select value from jsonb_array_elements_text(coalesce(v_open_result->'errors', '[]'::jsonb)) loop
          if v_error not in ('MIGRATION_OPENING_BATCH_NOT_POSTED','MIGRATION_AR_CONTROL_VARIANCE','MIGRATION_AP_CONTROL_VARIANCE') then
            v_errors := v_errors || jsonb_build_array(v_error);
          end if;
        end loop;
        select coalesce(sum(case when item_type='customer_invoice' then open_minor when item_type='customer_credit' then -open_minor else 0 end),0),
          coalesce(sum(case when item_type='supplier_bill' then open_minor when item_type='supplier_credit' then -open_minor else 0 end),0)
          into v_ar, v_ap from public.migration_open_items where batch_id = v_open_items.id;
        for v_record in
          select item.control_account_id,
            case when item.item_type in ('customer_invoice','customer_credit') then 'ar' else 'ap' end module,
            sum(case when item.item_type in ('customer_invoice','supplier_bill') then item.open_minor else -item.open_minor end)::bigint expected
          from public.migration_open_items item where item.batch_id = v_open_items.id
          group by item.control_account_id, module
        loop
          v_actual := app.migration_projected_opening_balance(v_project.organization_id, v_record.control_account_id,
            v_project.cutover_date, v_opening.id);
          v_variances := v_variances || jsonb_build_array(jsonb_build_object('module',v_record.module,'account_id',v_record.control_account_id,
            'detail_minor',v_record.expected::text,'gl_minor',v_actual::text,'variance_minor',(v_actual-v_record.expected)::text));
          if v_actual is distinct from v_record.expected then
            v_errors := v_errors || jsonb_build_array(case when v_record.module='ar' then 'MIGRATION_AR_CONTROL_VARIANCE' else 'MIGRATION_AP_CONTROL_VARIANCE' end);
          end if;
        end loop;
      end if;
    end if;

    v_operational_result := app.compute_migration_operational_validation(v_operational.id);
    for v_error in select value from jsonb_array_elements_text(coalesce(v_operational_result->'errors', '[]'::jsonb)) loop
      if v_error not in ('MIGRATION_OPENING_BATCH_NOT_POSTED','MIGRATION_OPEN_ITEMS_NOT_ACCEPTED',
        'MIGRATION_ASSET_GL_VARIANCE','MIGRATION_BANK_GL_VARIANCE','MIGRATION_INVENTORY_GL_VARIANCE','MIGRATION_TAX_GL_VARIANCE') then
        v_errors := v_errors || jsonb_build_array(v_error);
      end if;
    end loop;

    for v_record in
      select cost_account_id account_id, sum(cost_minor)::bigint expected, 'assets_cost' module
        from public.migration_asset_openings where batch_id=v_operational.id group by cost_account_id
      union all
      select accumulated_depreciation_account_id, sum(accumulated_depreciation_minor)::bigint, 'assets_accumulated_depreciation'
        from public.migration_asset_openings where batch_id=v_operational.id group by accumulated_depreciation_account_id
      union all
      select pos.bank_account_id, (pos.statement_balance_minor+coalesce(sum(item.signed_bank_effect_minor),0))::bigint, 'bank'
        from public.migration_bank_positions pos left join public.migration_bank_outstanding_items item on item.bank_position_id=pos.id
        where pos.batch_id=v_operational.id group by pos.id
      union all
      select control_account_id, sum(valuation_minor)::bigint, 'inventory'
        from public.migration_inventory_openings where batch_id=v_operational.id group by control_account_id
      union all
      select designated_account_id, sum(balance_minor)::bigint, 'tax'
        from public.migration_tax_openings where batch_id=v_operational.id group by designated_account_id
    loop
      v_actual := app.migration_projected_opening_balance(v_project.organization_id, v_record.account_id,
        v_project.cutover_date, v_opening.id);
      v_variances := v_variances || jsonb_build_array(jsonb_build_object('module',v_record.module,'account_id',v_record.account_id,
        'detail_minor',v_record.expected::text,'gl_minor',v_actual::text,'variance_minor',(v_actual-v_record.expected)::text));
      if v_actual is distinct from v_record.expected then
        v_errors := v_errors || jsonb_build_array(case
          when v_record.module like 'assets%' then 'MIGRATION_ASSET_GL_VARIANCE'
          when v_record.module='bank' then 'MIGRATION_BANK_GL_VARIANCE'
          when v_record.module='inventory' then 'MIGRATION_INVENTORY_GL_VARIANCE'
          else 'MIGRATION_TAX_GL_VARIANCE' end);
      end if;
    end loop;

    v_modules := jsonb_build_object(
      'accounts', jsonb_build_object('state',case when v_project.current_mapping_revision_id is null then 'blocked' else 'complete' end),
      'opening_trial_balance', jsonb_build_object('state',case when coalesce((v_opening_result->>'valid')::boolean,false) then 'complete' else 'blocked' end,
        'debit_total_minor',v_opening_result->>'debit_total_minor','credit_total_minor',v_opening_result->>'credit_total_minor',
        'difference_minor',v_opening_result->>'difference_minor','currency',v_opening_result->>'currency'),
      'ar', jsonb_build_object('state',case when not v_operational.open_items_applicable then 'not_applicable'
        when v_open_items.id is null or v_errors ? 'MIGRATION_AR_CONTROL_VARIANCE' then 'blocked' else 'complete' end,'total_minor',v_ar::text),
      'ap', jsonb_build_object('state',case when not v_operational.open_items_applicable then 'not_applicable'
        when v_open_items.id is null or v_errors ? 'MIGRATION_AP_CONTROL_VARIANCE' then 'blocked' else 'complete' end,'total_minor',v_ap::text),
      'assets', jsonb_build_object('state',case when not v_operational.assets_applicable then 'not_applicable'
        when (v_errors ? 'MIGRATION_ASSET_GL_VARIANCE') or (v_errors ? 'MIGRATION_ASSET_POLICY_VIOLATION') then 'blocked' else 'complete' end),
      'bank', jsonb_build_object('state',case when not v_operational.bank_applicable then 'not_applicable'
        when (v_errors ? 'MIGRATION_BANK_GL_VARIANCE') or (v_errors ? 'MIGRATION_BANK_POLICY_VIOLATION') then 'blocked' else 'complete' end),
      'inventory', jsonb_build_object('state',case when not v_operational.inventory_applicable then 'not_applicable'
        when (v_errors ? 'MIGRATION_INVENTORY_GL_VARIANCE') or (v_errors ? 'MIGRATION_INVENTORY_POLICY_VIOLATION') then 'blocked' else 'complete' end),
      'tax', jsonb_build_object('state',case when not v_operational.tax_applicable then 'not_applicable'
        when (v_errors ? 'MIGRATION_TAX_GL_VARIANCE') or (v_errors ? 'MIGRATION_TAX_SCOPE_VIOLATION') then 'blocked' else 'complete' end)
    );
  end if;

  return jsonb_build_object(
    'valid', jsonb_array_length(v_errors)=0,
    'approved', v_approval.id is not null,
    'approval_id', v_approval.id,
    'approved_by', v_approval.approved_by,
    'approved_at', v_approval.approved_at,
    'project_id', v_project.id,
    'project_revision', v_project.revision,
    'source_revision_id', v_project.current_source_revision_id,
    'source_revision', (select revision from public.migration_source_revisions where id=v_project.current_source_revision_id),
    'mapping_revision_id', v_project.current_mapping_revision_id,
    'staging_batch_id', v_project.current_staging_batch_id,
    'opening_balance_batch_id', v_project.opening_balance_batch_id,
    'opening_transaction_id', v_opening.posted_transaction_id,
    'open_item_batch_id', v_open_items.id,
    'operational_batch_id', v_operational.id,
    'cutover_date', v_project.cutover_date,
    'migration_depth', v_project.migration_depth,
    'modules', v_modules,
    'variances', v_variances,
    'errors', v_errors,
    'warnings', v_warnings,
    'history_policy', 'source_archive_unless_separately_migrated',
    'correction_policy', 'reviewed_reversal_or_replacement_only',
    'gl_effect', 'opening_trial_balance_only'
  );
end;
$$;

create function public.review_migration_cutover(p_project_id uuid, p_operational_batch_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_project public.migration_projects%rowtype;
begin
  select * into v_project from public.migration_projects where id=p_project_id;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration project not found' using errcode='42501'; end if;
  perform app.require_capability(v_project.organization_id,'migrations.review');
  return app.compute_migration_cutover_review(p_project_id,p_operational_batch_id);
end;
$$;

create function public.approve_migration_cutover(
  p_project_id uuid,
  p_operational_batch_id uuid,
  p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_project public.migration_projects%rowtype;
  v_operational public.migration_operational_batches%rowtype;
  v_existing public.migration_cutover_approvals%rowtype;
  v_review jsonb;
  v_transaction uuid;
  v_open_item_batch uuid;
  v_approval uuid;
  v_digest_before text;
  v_digest_after text;
begin
  if nullif(btrim(p_idempotency_key),'') is null then
    raise exception 'MIGRATION_ACCEPTANCE_KEY_REQUIRED' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('migration-final:'||p_project_id::text,0));
  select * into v_project from public.migration_projects where id=p_project_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration project not found' using errcode='42501'; end if;
  perform app.require_capability(v_project.organization_id,'migrations.review');
  perform app.require_capability(v_project.organization_id,'opening_balances.approve');
  select * into v_existing from public.migration_cutover_approvals where project_id=p_project_id;
  if found then
    if v_existing.idempotency_key<>btrim(p_idempotency_key) or v_existing.operational_batch_id<>p_operational_batch_id then
      raise exception 'MIGRATION_IDEMPOTENCY_CONFLICT' using errcode='23505';
    end if;
    return v_existing.review_result || jsonb_build_object('approved',true,'approval_id',v_existing.id,
      'approved_by',v_existing.approved_by,'approved_at',v_existing.approved_at,'opening_transaction_id',v_existing.opening_transaction_id);
  end if;
  select * into v_operational from public.migration_operational_batches
    where id=p_operational_batch_id and project_id=p_project_id and organization_id=v_project.organization_id for update;
  v_review:=app.compute_migration_cutover_review(p_project_id,p_operational_batch_id);
  if not coalesce((v_review->>'valid')::boolean,false) then
    raise exception 'MIGRATION_CUTOVER_BLOCKED: %',v_review using errcode='23514';
  end if;
  v_digest_before:=app.migration_ledger_digest(v_project.organization_id);
  v_transaction:=public.approve_opening_balance_batch(v_project.opening_balance_batch_id);
  if v_operational.open_items_applicable then
    v_open_item_batch:=(v_review->>'open_item_batch_id')::uuid;
    perform public.accept_migration_open_items(v_open_item_batch,'final:'||btrim(p_idempotency_key)||':open-items');
  end if;
  perform public.accept_migration_operational_cutover(p_operational_batch_id,'final:'||btrim(p_idempotency_key)||':operational');
  v_digest_after:=app.migration_ledger_digest(v_project.organization_id);
  v_review:=app.compute_migration_cutover_review(p_project_id,p_operational_batch_id)
    || jsonb_build_object('approved',true,'opening_transaction_id',v_transaction);
  insert into public.migration_cutover_approvals(project_id,organization_id,project_revision,source_revision_id,
    mapping_revision_id,staging_batch_id,opening_balance_batch_id,opening_transaction_id,open_item_batch_id,
    operational_batch_id,idempotency_key,review_result,ledger_digest_before,ledger_digest_after,approved_by)
  values(v_project.id,v_project.organization_id,v_project.revision,v_project.current_source_revision_id,
    v_project.current_mapping_revision_id,v_project.current_staging_batch_id,v_project.opening_balance_batch_id,
    v_transaction,v_open_item_batch,p_operational_batch_id,btrim(p_idempotency_key),v_review,v_digest_before,v_digest_after,auth.uid())
  returning id into v_approval;
  perform app.write_audit(v_project.organization_id,'migration_cutover.approved','migration_cutover_approval',v_approval,null,
    jsonb_build_object('project_id',v_project.id,'project_revision',v_project.revision,'source_revision_id',v_project.current_source_revision_id,
      'opening_transaction_id',v_transaction,'operational_batch_id',p_operational_batch_id,'ledger_digest_before',v_digest_before,
      'ledger_digest_after',v_digest_after));
  return v_review || jsonb_build_object('approval_id',v_approval,'approved_by',auth.uid(),'approved_at',now());
end;
$$;

create function public.read_migration_center(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_project public.migration_projects%rowtype;
begin
  select * into v_project from public.migration_projects where id=p_project_id;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration project not found' using errcode='42501'; end if;
  perform app.require_capability(v_project.organization_id,'migrations.read');
  return jsonb_build_object(
    'project',to_jsonb(v_project),
    'sources',coalesce((select jsonb_agg(to_jsonb(x)-'content_bytes' order by x.revision desc) from public.migration_source_revisions x where x.project_id=p_project_id),'[]'),
    'original_rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.source_row) from public.migration_original_rows x where x.source_revision_id=v_project.current_source_revision_id),'[]'),
    'mapping_revisions',coalesce((select jsonb_agg(to_jsonb(x) order by x.revision desc) from public.migration_mapping_revisions x where x.project_id=p_project_id),'[]'),
    'mapping_entries',coalesce((select jsonb_agg(to_jsonb(x) order by x.source_kind,x.source_key) from public.migration_mapping_entries x where x.mapping_revision_id=v_project.current_mapping_revision_id),'[]'),
    'normalized_rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.source_row) from public.migration_normalized_rows x where x.staging_batch_id=v_project.current_staging_batch_id),'[]'),
    'opening_batch',(select to_jsonb(x) from public.opening_balance_batches x where x.id=v_project.opening_balance_batch_id),
    'opening_candidates',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.opening_balance_batches x
      where x.organization_id=v_project.organization_id and x.cutoff_date=v_project.cutover_date and x.status<>'reversed'),'[]'),
    'open_item_batches',coalesce((select jsonb_agg(to_jsonb(x) order by x.revision desc) from public.migration_open_item_batches x where x.project_id=p_project_id),'[]'),
    'operational_batches',coalesce((select jsonb_agg(to_jsonb(x) order by x.revision desc) from public.migration_operational_batches x where x.project_id=p_project_id),'[]'),
    'approval',(select to_jsonb(x) from public.migration_cutover_approvals x where x.project_id=p_project_id)
  );
end;
$$;

create function public.list_migration_projects(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_capability(p_organization_id,'migrations.read');
  return coalesce((select jsonb_agg(to_jsonb(project) order by project.updated_at desc)
    from public.migration_projects project where project.organization_id=p_organization_id),'[]'::jsonb);
end;
$$;

revoke all on function public.review_migration_cutover(uuid,uuid),public.approve_migration_cutover(uuid,uuid,text),
  public.read_migration_center(uuid),public.list_migration_projects(uuid) from public,anon;
grant execute on function public.review_migration_cutover(uuid,uuid),public.approve_migration_cutover(uuid,uuid,text),
  public.read_migration_center(uuid),public.list_migration_projects(uuid) to authenticated,service_role;
revoke all on function app.migration_projected_opening_balance(uuid,uuid,date,uuid),
  app.compute_migration_cutover_review(uuid,uuid) from public,anon,authenticated;
