-- LS-MIG-002 / MIG-02, MIG-04..06, MIG-08..09.
--
-- Open-item acceptance is deliberately subledger-only. The linked, approved
-- Opening Trial Balance remains the single GL effect. Accepted AR/AP documents
-- point at that transaction as cutover provenance and never post another one.

create type public.migration_open_item_type as enum (
  'customer_invoice', 'customer_credit', 'supplier_bill', 'supplier_credit'
);
create type public.migration_open_item_batch_status as enum (
  'staged', 'invalid', 'validated', 'accepted'
);
create type public.migration_open_allocation_type as enum (
  'receipt', 'payment', 'credit'
);

create table public.migration_open_item_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  staging_batch_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  revision integer not null check (revision > 0),
  status public.migration_open_item_batch_status not null default 'staged',
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 1 and 160),
  validation_result jsonb,
  validated_by uuid references public.profiles(id) on delete restrict,
  validated_at timestamptz,
  acceptance_idempotency_key text,
  accepted_by uuid references public.profiles(id) on delete restrict,
  accepted_at timestamptz,
  staged_by uuid not null references public.profiles(id) on delete restrict,
  staged_at timestamptz not null default now(),
  constraint migration_open_batch_project_scope
    foreign key (project_id, organization_id)
    references public.migration_projects(id, organization_id) on delete restrict,
  constraint migration_open_batch_staging_scope
    foreign key (staging_batch_id)
    references public.migration_staging_batches(id) on delete restrict,
  constraint migration_open_batch_state check (
    (status in ('validated','accepted') and validation_result is not null
      and validated_by is not null and validated_at is not null)
    or (status in ('staged','invalid') and accepted_by is null and accepted_at is null)
  ),
  constraint migration_open_batch_acceptance check (
    (status = 'accepted' and nullif(btrim(acceptance_idempotency_key),'') is not null
      and accepted_by is not null and accepted_at is not null)
    or (status <> 'accepted' and acceptance_idempotency_key is null
      and accepted_by is null and accepted_at is null)
  ),
  unique(project_id, revision),
  unique(project_id, idempotency_key),
  unique(id, organization_id)
);

create table public.migration_open_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  original_row_id uuid not null,
  mapping_entry_id uuid not null,
  item_type public.migration_open_item_type not null,
  source_counterparty_key text not null check (char_length(btrim(source_counterparty_key)) between 1 and 255),
  source_document_key text not null check (char_length(btrim(source_document_key)) between 1 and 255),
  source_reference text not null check (char_length(btrim(source_reference)) between 1 and 255),
  document_date date not null check (isfinite(document_date)),
  due_date date not null check (isfinite(due_date) and due_date >= document_date),
  original_minor bigint not null check (original_minor > 0),
  open_minor bigint not null check (open_minor between 0 and original_minor),
  currency_code char(3) not null references public.currencies(code),
  currency_evidence jsonb not null check (jsonb_typeof(currency_evidence) = 'object'),
  control_account_id uuid not null,
  correction_account_id uuid not null,
  source_identity jsonb not null check (jsonb_typeof(source_identity) = 'object'),
  constraint migration_open_item_batch_scope
    foreign key (batch_id, organization_id)
    references public.migration_open_item_batches(id, organization_id) on delete restrict,
  constraint migration_open_item_original_scope
    foreign key (original_row_id)
    references public.migration_original_rows(id) on delete restrict,
  constraint migration_open_item_mapping_fk
    foreign key (mapping_entry_id) references public.migration_mapping_entries(id) on delete restrict,
  constraint migration_open_item_control_scope
    foreign key (control_account_id, organization_id)
    references public.control_account_bindings(account_id, organization_id) on delete restrict,
  constraint migration_open_item_correction_account_scope
    foreign key (correction_account_id, organization_id)
    references public.accounts(id, organization_id) on delete restrict,
  unique(batch_id, source_document_key),
  unique(batch_id, original_row_id),
  unique(id, organization_id)
);

create table public.migration_open_item_allocations (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  target_item_id uuid not null,
  source_type public.migration_open_allocation_type not null,
  source_document_key text not null check (char_length(btrim(source_document_key)) between 1 and 255),
  source_reference text not null check (char_length(btrim(source_reference)) between 1 and 255),
  allocation_date date not null check (isfinite(allocation_date)),
  amount_minor bigint not null check (amount_minor > 0),
  source_identity jsonb not null check (jsonb_typeof(source_identity) = 'object'),
  constraint migration_open_allocation_batch_scope
    foreign key (batch_id, organization_id)
    references public.migration_open_item_batches(id, organization_id) on delete restrict,
  constraint migration_open_allocation_target_scope
    foreign key (target_item_id, organization_id)
    references public.migration_open_items(id, organization_id) on delete restrict,
  unique(batch_id, source_type, source_document_key, target_item_id)
);

create table public.migration_open_item_validation_runs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  validated_by uuid not null references public.profiles(id) on delete restrict,
  validated_at timestamptz not null default now(),
  constraint migration_open_validation_batch_scope
    foreign key (batch_id, organization_id)
    references public.migration_open_item_batches(id, organization_id) on delete restrict
);

create table public.migration_counterparty_acceptances (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  mapping_entry_id uuid not null references public.migration_mapping_entries(id) on delete restrict,
  counterparty_id uuid not null,
  resolution public.migration_mapping_resolution not null,
  accepted_by uuid not null references public.profiles(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  constraint migration_counterparty_acceptance_batch_scope
    foreign key (batch_id, organization_id)
    references public.migration_open_item_batches(id, organization_id) on delete restrict,
  constraint migration_counterparty_acceptance_target_scope
    foreign key (counterparty_id, organization_id)
    references public.counterparties(id, organization_id) on delete restrict,
  unique(batch_id, mapping_entry_id),
  unique(id, organization_id)
);

comment on table public.migration_open_items is
  'Immutable source opening detail. original_minor and open_minor preserve historical allocations without replaying historical accounting.';
comment on table public.migration_open_item_allocations is
  'Immutable source allocation evidence explaining original-to-open movement before cutover.';

create index migration_open_batches_project_idx on public.migration_open_item_batches(project_id, revision desc);
create index migration_open_items_control_idx on public.migration_open_items(batch_id, control_account_id, item_type);
create index migration_open_allocations_target_idx on public.migration_open_item_allocations(target_item_id);

alter table public.migration_open_item_batches enable row level security;
alter table public.migration_open_items enable row level security;
alter table public.migration_open_item_allocations enable row level security;
alter table public.migration_open_item_validation_runs enable row level security;
alter table public.migration_counterparty_acceptances enable row level security;

create policy migration_open_batches_read on public.migration_open_item_batches
  for select to authenticated using (app.has_capability(organization_id,'migrations.read'));
create policy migration_open_items_read on public.migration_open_items
  for select to authenticated using (app.has_capability(organization_id,'migrations.read'));
create policy migration_open_allocations_read on public.migration_open_item_allocations
  for select to authenticated using (app.has_capability(organization_id,'migrations.read'));
create policy migration_open_validation_read on public.migration_open_item_validation_runs
  for select to authenticated using (app.has_capability(organization_id,'migrations.read'));
create policy migration_counterparty_acceptances_read on public.migration_counterparty_acceptances
  for select to authenticated using (app.has_capability(organization_id,'migrations.read'));

grant select on public.migration_open_item_batches, public.migration_open_items,
  public.migration_open_item_allocations, public.migration_open_item_validation_runs,
  public.migration_counterparty_acceptances to authenticated;

create trigger migration_open_items_immutable before update or delete on public.migration_open_items
  for each row execute function app.reject_migration_evidence_change();
create trigger migration_open_allocations_immutable before update or delete on public.migration_open_item_allocations
  for each row execute function app.reject_migration_evidence_change();
create trigger migration_open_validation_runs_immutable before update or delete on public.migration_open_item_validation_runs
  for each row execute function app.reject_migration_evidence_change();
create trigger migration_counterparty_acceptances_immutable before update or delete on public.migration_counterparty_acceptances
  for each row execute function app.reject_migration_evidence_change();

create or replace function app.guard_migration_open_batch_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op = 'DELETE' or old.status = 'accepted' then
    raise exception 'MIGRATION_OPEN_ITEMS_LOCKED: accepted evidence is immutable' using errcode='55000';
  end if;
  return new;
end;
$$;
create trigger migration_open_batches_guard before update or delete on public.migration_open_item_batches
  for each row execute function app.guard_migration_open_batch_change();

create or replace function app.guard_accepted_migration_project()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists (
    select 1 from public.migration_open_item_batches batch
    where batch.project_id=old.id and batch.status='accepted'
  ) then
    raise exception 'MIGRATION_PROJECT_LOCKED: accepted cutover evidence is immutable' using errcode='55000';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger migration_projects_accepted_guard before update or delete on public.migration_projects
  for each row execute function app.guard_accepted_migration_project();

-- A posted Opening Trial Balance may contain correctly bound AR/AP Control
-- rows. This remains private to the one opening transaction; normal direct
-- Control posting stays forbidden.
create or replace function app.control_posting_context_matches(
  p_organization_id uuid, p_account_id uuid
)
returns boolean language sql stable security definer set search_path='' as $$
  select (
    coalesce(current_setting('app.control_posting_authorized',true),'')='on'
    and nullif(current_setting('app.control_posting_organization',true),'')::uuid=p_organization_id
    and nullif(current_setting('app.control_posting_account',true),'')::uuid=p_account_id
    and nullif(current_setting('app.control_posting_reference',true),'') is not null
    and exists (
      select 1 from public.control_account_bindings binding
      where binding.organization_id=p_organization_id and binding.account_id=p_account_id
        and binding.subledger_type::text=current_setting('app.control_posting_subledger',true)
    )
  ) or (
    coalesce(current_setting('app.opening_control_authorized',true),'')='on'
    and nullif(current_setting('app.opening_control_organization',true),'')::uuid=p_organization_id
    and exists (
      select 1 from public.opening_balance_batches batch
      join public.opening_balance_rows row on row.batch_id=batch.id
      join public.control_account_bindings binding
        on binding.account_id=row.mapped_account_id and binding.organization_id=row.organization_id
      where batch.id=nullif(current_setting('app.opening_control_batch',true),'')::uuid
        and batch.organization_id=p_organization_id and batch.status in ('validated','posted')
        and row.mapped_account_id=p_account_id
        and binding.subledger_type in ('customer','supplier')
    )
  );
$$;

create or replace function app.compute_opening_validation(p_batch_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  v_batch public.opening_balance_batches%rowtype; v_row public.opening_balance_rows%rowtype;
  v_account public.accounts%rowtype; v_base char(3); v_errors jsonb:='[]'; v_row_errors jsonb;
  v_rows jsonb:='[]'; v_preview jsonb:='[]'; v_debit bigint:=0; v_credit bigint:=0;
  v_valid_count integer:=0; v_zero_count integer:=0; v_fy_start date; v_fy_end date;
begin
  select * into v_batch from public.opening_balance_batches where id=p_batch_id;
  if not found then raise exception 'TENANT_ACCESS_DENIED: opening batch not found' using errcode='42501'; end if;
  v_base:=app.org_base_currency(v_batch.organization_id);
  select fiscal_year_start,fiscal_year_end into v_fy_start,v_fy_end
    from app.fiscal_year_bounds(v_batch.organization_id,v_batch.cutoff_date+1);
  if v_batch.migration_mode='year_start' and v_batch.cutoff_date+1<>v_fy_start then
    v_errors:=v_errors||jsonb_build_array('OPENING_YEAR_START_CUTOFF');
  elsif v_batch.migration_mode='midyear' and not (v_batch.cutoff_date+1>v_fy_start and v_batch.cutoff_date+1<=v_fy_end) then
    v_errors:=v_errors||jsonb_build_array('OPENING_MIDYEAR_CUTOFF');
  end if;
  begin perform app.assert_accounting_period_allows(v_batch.organization_id,v_batch.cutoff_date,'opening_balance','opening_balance',null);
  exception when others then v_errors:=v_errors||jsonb_build_array(split_part(sqlerrm,':',1)); end;
  for v_row in select * from public.opening_balance_rows where batch_id=p_batch_id order by source_row loop
    v_row_errors:='[]'; v_account:=null;
    if v_row.debit_minor is null or v_row.credit_minor is null then v_row_errors:=v_row_errors||jsonb_build_array('OPENING_AMOUNT_INVALID'); end if;
    if coalesce(v_row.debit_minor,0)<0 or coalesce(v_row.credit_minor,0)<0 then v_row_errors:=v_row_errors||jsonb_build_array('OPENING_AMOUNT_NEGATIVE'); end if;
    if coalesce(v_row.debit_minor,0)>0 and coalesce(v_row.credit_minor,0)>0 then v_row_errors:=v_row_errors||jsonb_build_array('OPENING_BOTH_SIDES'); end if;
    if coalesce(v_row.debit_minor,0)=0 and coalesce(v_row.credit_minor,0)=0 then v_zero_count:=v_zero_count+1; end if;
    if v_row.mapped_account_id is null then v_row_errors:=v_row_errors||jsonb_build_array('OPENING_ACCOUNT_UNMAPPED');
    else
      select * into v_account from public.accounts where id=v_row.mapped_account_id and organization_id=v_batch.organization_id;
      if not found then v_row_errors:=v_row_errors||jsonb_build_array('OPENING_ACCOUNT_INVALID');
      else
        if v_account.is_archived then v_row_errors:=v_row_errors||jsonb_build_array('ACCOUNT_ARCHIVED'); end if;
        if v_account.account_role='group' then v_row_errors:=v_row_errors||jsonb_build_array('ACCOUNT_GROUP_NOT_POSTABLE'); end if;
        if v_account.account_role='control' and not exists (
          select 1 from public.control_account_bindings binding
          where binding.account_id=v_account.id and binding.organization_id=v_batch.organization_id
            and binding.subledger_type in ('customer','supplier')
        ) then v_row_errors:=v_row_errors||jsonb_build_array('OPENING_CONTROL_BINDING_INVALID'); end if;
        if v_account.currency<>v_base then v_row_errors:=v_row_errors||jsonb_build_array('OPENING_BASE_CURRENCY_ONLY'); end if;
        if v_batch.migration_mode='year_start' and v_account.type in ('revenue','expense')
          and (coalesce(v_row.debit_minor,0)<>0 or coalesce(v_row.credit_minor,0)<>0) then
          v_row_errors:=v_row_errors||jsonb_build_array('OPENING_YEAR_START_PL_FORBIDDEN');
        end if;
      end if;
    end if;
    update public.opening_balance_rows set validation_errors=v_row_errors where id=v_row.id;
    if jsonb_array_length(v_row_errors)=0 and (coalesce(v_row.debit_minor,0)>0 or coalesce(v_row.credit_minor,0)>0) then
      v_valid_count:=v_valid_count+1; v_debit:=v_debit+v_row.debit_minor; v_credit:=v_credit+v_row.credit_minor;
      v_preview:=v_preview||jsonb_build_array(jsonb_build_object(
        'row_id',v_row.id,'account_id',v_account.id,'account_code',v_account.code,'account_name',v_account.name,
        'debit_minor',v_row.debit_minor,'credit_minor',v_row.credit_minor));
    end if;
    v_rows:=v_rows||jsonb_build_array(jsonb_build_object('row_id',v_row.id,'source_row',v_row.source_row,'errors',v_row_errors));
  end loop;
  if v_valid_count=0 then v_errors:=v_errors||jsonb_build_array('OPENING_NO_EFFECTIVE_ROWS'); end if;
  if v_debit<>v_credit then v_errors:=v_errors||jsonb_build_array('OPENING_BATCH_UNBALANCED'); end if;
  if exists(select 1 from jsonb_array_elements(v_rows) item where jsonb_array_length(item->'errors')>0) then
    v_errors:=v_errors||jsonb_build_array('OPENING_ROW_ERRORS');
  end if;
  return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'mode',v_batch.migration_mode,
    'cutoff_date',v_batch.cutoff_date,'currency',v_base,'debit_total_minor',v_debit,'credit_total_minor',v_credit,
    'difference_minor',v_debit-v_credit,'valid_row_count',v_valid_count,'zero_row_count',v_zero_count,
    'errors',v_errors,'rows',v_rows,'preview',v_preview);
end;
$$;

create or replace function public.approve_opening_balance_batch(p_batch_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_batch public.opening_balance_batches%rowtype; v_result jsonb; v_lines jsonb; v_transaction uuid; v_existing uuid;
begin
  select * into v_batch from public.opening_balance_batches where id=p_batch_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: opening batch not found' using errcode='42501'; end if;
  perform app.require_capability(v_batch.organization_id,'opening_balances.approve');
  if v_batch.posted_transaction_id is not null then return v_batch.posted_transaction_id; end if;
  v_result:=app.compute_opening_validation(p_batch_id);
  if not (v_result->>'valid')::boolean then raise exception 'OPENING_VALIDATION_FAILED: %',v_result using errcode='23514'; end if;
  select posted_transaction_id into v_existing from public.opening_balance_batches
    where organization_id=v_batch.organization_id and migration_mode=v_batch.migration_mode
      and cutoff_date=v_batch.cutoff_date and posted_transaction_id is not null for update;
  if found then raise exception 'OPENING_BOUNDARY_ALREADY_POSTED' using errcode='23505'; end if;
  select jsonb_agg(jsonb_build_object('account_id',item->>'account_id','side',
    case when (item->>'debit_minor')::bigint>0 then 'debit' else 'credit' end,
    'amount_minor',greatest((item->>'debit_minor')::bigint,(item->>'credit_minor')::bigint),
    'memo','Opening Trial Balance row')) into v_lines from jsonb_array_elements(v_result->'preview') item;
  -- The batch must be visibly validated before the private guard can authorize its Control rows.
  update public.opening_balance_batches set status='validated',validation_result=v_result,validated_at=now(),updated_at=now()
    where id=p_batch_id;
  perform set_config('app.opening_control_authorized','on',true);
  perform set_config('app.opening_control_organization',v_batch.organization_id::text,true);
  perform set_config('app.opening_control_batch',v_batch.id::text,true);
  v_transaction:=app.create_and_post(
    p_organization_id=>v_batch.organization_id,p_type=>'opening_balance',p_transaction_date=>v_batch.cutoff_date,
    p_lines=>v_lines,p_currency_code=>app.org_base_currency(v_batch.organization_id),
    p_description=>'Opening Trial Balance as of '||v_batch.cutoff_date::text,
    p_reference=>'OPENING-'||v_batch.id::text,p_source=>'opening_balance',
    p_idempotency_key=>'opening-batch:'||v_batch.id::text,
    p_metadata=>jsonb_build_object('opening_batch_id',v_batch.id,'migration_mode',v_batch.migration_mode,'revision',v_batch.revision));
  perform set_config('app.opening_control_authorized','',true);
  perform set_config('app.opening_control_organization','',true);
  perform set_config('app.opening_control_batch','',true);
  update public.opening_balance_batches set status='posted',validation_result=v_result,validated_at=now(),
    posted_transaction_id=v_transaction,approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=p_batch_id;
  perform app.write_audit(v_batch.organization_id,'opening_batch.posted','opening_balance_batch',v_batch.id,
    null,jsonb_build_object('transaction_id',v_transaction,'mode',v_batch.migration_mode,'cutoff_date',v_batch.cutoff_date));
  return v_transaction;
end;
$$;

create or replace function public.reverse_opening_balance_batch(
  p_batch_id uuid, p_reason text, p_reversal_date date default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_batch public.opening_balance_batches%rowtype; v_reversal uuid;
begin
  select * into v_batch from public.opening_balance_batches where id=p_batch_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: opening batch not found' using errcode='42501'; end if;
  perform app.require_capability(v_batch.organization_id,'opening_balances.correct');
  if nullif(btrim(p_reason),'') is null then raise exception 'OPENING_CORRECTION_REASON_REQUIRED' using errcode='22023'; end if;
  if v_batch.status='reversed' then return v_batch.reversal_transaction_id; end if;
  if v_batch.status<>'posted' then raise exception 'OPENING_BATCH_NOT_POSTED' using errcode='23514'; end if;
  if exists (
    select 1 from public.migration_projects project
    join public.migration_open_item_batches open_batch on open_batch.project_id=project.id
    where project.opening_balance_batch_id=p_batch_id and open_batch.status='accepted'
  ) then
    raise exception 'MIGRATION_CUTOVER_LOCKED: accepted open items require a reviewed replacement cutover' using errcode='55000';
  end if;
  perform set_config('app.opening_control_authorized','on',true);
  perform set_config('app.opening_control_organization',v_batch.organization_id::text,true);
  perform set_config('app.opening_control_batch',v_batch.id::text,true);
  v_reversal:=public.reverse_transaction(v_batch.posted_transaction_id,btrim(p_reason),p_reversal_date);
  perform set_config('app.opening_control_authorized','',true);
  perform set_config('app.opening_control_organization','',true);
  perform set_config('app.opening_control_batch','',true);
  perform set_config('app.opening_correction_authorized','on',true);
  update public.opening_balance_batches set status='reversed',reversal_transaction_id=v_reversal,
    correction_reason=btrim(p_reason),corrected_by=auth.uid(),corrected_at=now(),updated_at=now() where id=p_batch_id;
  perform set_config('app.opening_correction_authorized','',true);
  perform app.write_audit(v_batch.organization_id,'opening_batch.reversed','opening_balance_batch',v_batch.id,
    jsonb_build_object('transaction_id',v_batch.posted_transaction_id),
    jsonb_build_object('reversal_transaction_id',v_reversal,'reason',btrim(p_reason)));
  return v_reversal;
end;
$$;

-- Existing operational documents keep a one-to-one transaction. Migration
-- items share the one Opening Trial Balance transaction and are distinguished
-- by their immutable migration evidence id.
alter table public.ar_documents add column migration_open_item_id uuid unique
  references public.migration_open_items(id) on delete restrict;
alter table public.ap_documents add column migration_open_item_id uuid unique
  references public.migration_open_items(id) on delete restrict;
alter table public.ar_documents drop constraint ar_documents_transaction_id_key;
alter table public.ap_documents drop constraint ap_documents_transaction_id_key;
create unique index ar_documents_operational_transaction_unique on public.ar_documents(transaction_id)
  where migration_open_item_id is null;
create unique index ap_documents_operational_transaction_unique on public.ap_documents(transaction_id)
  where migration_open_item_id is null;

create or replace function public.read_ar_open_items(p_organization_id uuid,p_as_of_date date,p_customer_id uuid default null)
returns table(invoice_id uuid,customer_id uuid,customer_name text,control_account_id uuid,reference text,
  issue_date date,due_date date,original_minor text,outstanding_minor text,aging_bucket text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform app.require_capability(p_organization_id,'ar.read');
  if p_as_of_date is null or not isfinite(p_as_of_date) then raise exception 'AR_INVALID_DATE' using errcode='22023'; end if;
  return query select d.id,d.customer_id,c.name,d.control_account_id,d.reference,d.document_date,d.due_date,
    coalesce(m.original_minor,d.amount_minor)::text,sum(e.effect_minor)::text,
    case when p_as_of_date<=d.due_date then 'current' when p_as_of_date-d.due_date<=30 then '1_30'
      when p_as_of_date-d.due_date<=60 then '31_60' when p_as_of_date-d.due_date<=90 then '61_90' else '91_plus' end
    from public.ar_documents d join public.counterparties c on c.id=d.customer_id
    left join public.migration_open_items m on m.id=d.migration_open_item_id
    join app.ar_item_events(p_organization_id) e on e.invoice_id=d.id and e.effective_date<=p_as_of_date
    where d.organization_id=p_organization_id and d.kind='invoice' and (p_customer_id is null or d.customer_id=p_customer_id)
    group by d.id,c.name,m.original_minor having sum(e.effect_minor)<>0 order by d.due_date,d.reference,d.id;
end;
$$;

create or replace function public.read_ap_open_items(p_organization_id uuid,p_as_of_date date,p_supplier_id uuid default null)
returns table(bill_id uuid,supplier_id uuid,supplier_name text,control_account_id uuid,reference text,
  issue_date date,due_date date,original_minor text,outstanding_minor text,aging_bucket text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform app.require_capability(p_organization_id,'ap.read');
  if p_as_of_date is null or not isfinite(p_as_of_date) then raise exception 'AP_INVALID_DATE' using errcode='22023'; end if;
  return query select d.id,d.supplier_id,c.name,d.control_account_id,d.reference,d.document_date,d.due_date,
    coalesce(m.original_minor,d.amount_minor)::text,sum(e.effect_minor)::text,
    case when p_as_of_date<=d.due_date then 'current' when p_as_of_date-d.due_date<=30 then '1_30'
      when p_as_of_date-d.due_date<=60 then '31_60' when p_as_of_date-d.due_date<=90 then '61_90' else '91_plus' end
    from public.ap_documents d join public.counterparties c on c.id=d.supplier_id
    left join public.migration_open_items m on m.id=d.migration_open_item_id
    join app.ap_item_events(p_organization_id) e on e.bill_id=d.id and e.effective_date<=p_as_of_date
    where d.organization_id=p_organization_id and d.kind='bill' and (p_supplier_id is null or d.supplier_id=p_supplier_id)
    group by d.id,c.name,m.original_minor having sum(e.effect_minor)<>0 order by d.due_date,d.reference,d.id;
end;
$$;

create table public.migration_open_item_acceptances (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  item_id uuid not null,
  ar_document_id uuid,
  ap_document_id uuid,
  accepted_by uuid not null references public.profiles(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  constraint migration_open_acceptance_batch_scope foreign key (batch_id,organization_id)
    references public.migration_open_item_batches(id,organization_id) on delete restrict,
  constraint migration_open_acceptance_item_scope foreign key (item_id,organization_id)
    references public.migration_open_items(id,organization_id) on delete restrict,
  constraint migration_open_acceptance_ar_scope foreign key (ar_document_id,organization_id)
    references public.ar_documents(id,organization_id) on delete restrict,
  constraint migration_open_acceptance_ap_scope foreign key (ap_document_id,organization_id)
    references public.ap_documents(id,organization_id) on delete restrict,
  check ((ar_document_id is not null)::integer+(ap_document_id is not null)::integer=1),
  unique(item_id), unique(ar_document_id), unique(ap_document_id)
);
alter table public.migration_open_item_acceptances enable row level security;
create policy migration_open_acceptances_read on public.migration_open_item_acceptances
  for select to authenticated using (app.has_capability(organization_id,'migrations.read'));
grant select on public.migration_open_item_acceptances to authenticated;
create trigger migration_open_acceptances_immutable before update or delete on public.migration_open_item_acceptances
  for each row execute function app.reject_migration_evidence_change();

create or replace function public.stage_migration_open_items(
  p_project_id uuid, p_staging_batch_id uuid, p_items jsonb, p_allocations jsonb, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_project public.migration_projects%rowtype; v_existing public.migration_open_item_batches%rowtype;
  v_id uuid; v_revision integer; v_hash text; v_item jsonb; v_allocation jsonb;
  v_original uuid; v_mapping uuid; v_target uuid; v_type public.migration_open_item_type;
  v_row integer; v_original_minor bigint; v_open_minor bigint; v_control uuid; v_correction uuid; v_currency char(3);
begin
  select * into v_project from public.migration_projects where id=p_project_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration project not found' using errcode='42501'; end if;
  perform app.require_capability(v_project.organization_id,'migrations.manage');
  perform pg_advisory_xact_lock(hashtextextended('migration-open:'||p_project_id::text,0));
  if v_project.status<>'validated' or p_staging_batch_id is distinct from v_project.current_staging_batch_id
    or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50000
    or p_allocations is null or jsonb_typeof(p_allocations)<>'array'
    or nullif(btrim(p_idempotency_key),'') is null then
    raise exception 'MIGRATION_OPEN_ITEMS_INVALID' using errcode='22023';
  end if;
  if exists(select 1 from public.migration_open_item_batches where project_id=p_project_id and status='accepted') then
    raise exception 'MIGRATION_PROJECT_LOCKED: accepted cutover evidence is immutable' using errcode='55000';
  end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('items',p_items,'allocations',p_allocations)::text,'UTF8'),'sha256'),'hex');
  select * into v_existing from public.migration_open_item_batches
    where project_id=p_project_id and idempotency_key=btrim(p_idempotency_key);
  if found then
    if v_existing.staging_batch_id<>p_staging_batch_id or v_existing.evidence_sha256<>v_hash then
      raise exception 'MIGRATION_IDEMPOTENCY_CONFLICT' using errcode='23505';
    end if;
    return v_existing.id;
  end if;
  select coalesce(max(revision),0)+1 into v_revision from public.migration_open_item_batches where project_id=p_project_id;
  insert into public.migration_open_item_batches(project_id,staging_batch_id,organization_id,revision,evidence_sha256,idempotency_key,staged_by)
    values(p_project_id,p_staging_batch_id,v_project.organization_id,v_revision,v_hash,btrim(p_idempotency_key),auth.uid()) returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_row:=(v_item->>'source_row')::integer; v_type:=(v_item->>'item_type')::public.migration_open_item_type;
      v_original_minor:=(v_item->>'original_minor')::bigint; v_open_minor:=(v_item->>'open_minor')::bigint;
      v_control:=(v_item->>'control_account_id')::uuid; v_correction:=(v_item->>'correction_account_id')::uuid;
      v_currency=(v_item->>'currency_code')::char(3);
    exception when others then raise exception 'MIGRATION_OPEN_ITEM_INVALID' using errcode='22023'; end;
    select id into v_original from public.migration_original_rows
      where source_revision_id=v_project.current_source_revision_id and source_row=v_row and organization_id=v_project.organization_id;
    if not found then raise exception 'MIGRATION_ORIGINAL_ROW_NOT_FOUND' using errcode='23514'; end if;
    select id into v_mapping from public.migration_mapping_entries
      where mapping_revision_id=v_project.current_mapping_revision_id
        and source_kind=case when v_type in ('customer_invoice','customer_credit') then 'customer'::public.migration_mapping_source_kind else 'supplier'::public.migration_mapping_source_kind end
        and source_key=btrim(v_item->>'source_counterparty_key');
    if not found then raise exception 'MIGRATION_MAPPING_REQUIRED' using errcode='23514'; end if;
    perform 1 from public.migration_normalized_rows normalized
      where normalized.staging_batch_id=p_staging_batch_id and normalized.original_row_id=v_original
        and normalized.mapping_entry_id=v_mapping;
    if not found then raise exception 'MIGRATION_OPEN_ITEM_SOURCE_MISMATCH' using errcode='23514'; end if;
    insert into public.migration_open_items(batch_id,organization_id,original_row_id,mapping_entry_id,item_type,
      source_counterparty_key,source_document_key,source_reference,document_date,due_date,original_minor,open_minor,
      currency_code,currency_evidence,control_account_id,correction_account_id,source_identity)
    values(v_id,v_project.organization_id,v_original,v_mapping,v_type,btrim(v_item->>'source_counterparty_key'),
      btrim(v_item->>'source_document_key'),btrim(v_item->>'source_reference'),(v_item->>'document_date')::date,
      (v_item->>'due_date')::date,v_original_minor,v_open_minor,v_currency,
      coalesce(v_item->'currency_evidence','{}'::jsonb),v_control,v_correction,coalesce(v_item->'source_identity','{}'::jsonb));
  end loop;
  for v_allocation in select value from jsonb_array_elements(p_allocations) loop
    select id into v_target from public.migration_open_items
      where batch_id=v_id and item_type=(v_allocation->>'target_item_type')::public.migration_open_item_type
        and source_document_key=btrim(v_allocation->>'target_document_key');
    if not found then raise exception 'MIGRATION_ALLOCATION_TARGET_INVALID' using errcode='23514'; end if;
    insert into public.migration_open_item_allocations(batch_id,organization_id,target_item_id,source_type,
      source_document_key,source_reference,allocation_date,amount_minor,source_identity)
    values(v_id,v_project.organization_id,v_target,(v_allocation->>'source_type')::public.migration_open_allocation_type,
      btrim(v_allocation->>'source_document_key'),btrim(v_allocation->>'source_reference'),
      (v_allocation->>'allocation_date')::date,(v_allocation->>'amount_minor')::bigint,
      coalesce(v_allocation->'source_identity','{}'::jsonb));
  end loop;
  perform app.write_audit(v_project.organization_id,'migration_open_items.staged','migration_open_item_batch',v_id,null,
    jsonb_build_object('project_id',p_project_id,'revision',v_revision,'item_count',jsonb_array_length(p_items),
      'allocation_count',jsonb_array_length(p_allocations),'evidence_sha256',v_hash));
  return v_id;
exception when unique_violation then
  raise exception 'MIGRATION_OPEN_ITEM_SOURCE_DUPLICATE' using errcode='23505';
end;
$$;

create or replace function app.compute_migration_open_item_validation(p_batch_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_batch public.migration_open_item_batches%rowtype; v_project public.migration_projects%rowtype;
  v_opening public.opening_balance_batches%rowtype; v_errors jsonb:='[]'; v_control record;
  v_invalid bigint; v_ar bigint; v_ap bigint; v_gl bigint; v_result jsonb;
begin
  select * into v_batch from public.migration_open_item_batches where id=p_batch_id;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration open-item batch not found' using errcode='42501'; end if;
  select * into v_project from public.migration_projects where id=v_batch.project_id;
  if v_project.current_staging_batch_id<>v_batch.staging_batch_id or v_project.status<>'validated' then
    v_errors:=v_errors||jsonb_build_array('MIGRATION_PROJECT_NOT_VALIDATED');
  end if;
  select * into v_opening from public.opening_balance_batches where id=v_project.opening_balance_batch_id;
  if not found or v_opening.organization_id<>v_batch.organization_id or v_opening.cutoff_date<>v_project.cutover_date
    or v_opening.status<>'posted' or v_opening.posted_transaction_id is null then
    v_errors:=v_errors||jsonb_build_array('MIGRATION_OPENING_BATCH_NOT_POSTED');
  end if;
  select count(*) into v_invalid from public.migration_open_items item
  join public.migration_mapping_entries mapping on mapping.id=item.mapping_entry_id
  left join public.counterparties counterparty on counterparty.id=mapping.target_counterparty_id
  left join public.accounts control on control.id=item.control_account_id
  left join public.accounts correction on correction.id=item.correction_account_id
  left join public.control_account_bindings binding on binding.account_id=control.id
  where item.batch_id=p_batch_id and (
    item.document_date>v_project.cutover_date
    or item.source_identity='{}'::jsonb
    or item.currency_code<>app.org_base_currency(v_batch.organization_id)
    or item.currency_evidence->>'source_currency' is distinct from item.currency_code::text
    or item.currency_evidence->>'policy' is distinct from 'base_currency_open_item'
    or control.organization_id<>v_batch.organization_id or control.is_archived or control.account_role<>'control'
    or control.currency<>app.org_base_currency(v_batch.organization_id)
    or binding.organization_id<>v_batch.organization_id
    or binding.subledger_type<>case when item.item_type in ('customer_invoice','customer_credit') then 'customer'::public.control_subledger_type else 'supplier'::public.control_subledger_type end
    or correction.organization_id<>v_batch.organization_id or correction.is_archived or correction.account_role<>'posting'
    or correction.currency<>app.org_base_currency(v_batch.organization_id) or correction.contra_account_id is not null
    or (item.item_type in ('customer_invoice','customer_credit') and correction.type<>'revenue')
    or (item.item_type in ('supplier_bill','supplier_credit') and correction.type not in ('expense','asset'))
    or (mapping.resolution='existing_record' and (counterparty.id is null
      or counterparty.organization_id<>v_batch.organization_id or counterparty.is_archived
      or counterparty.type<>case when item.item_type in ('customer_invoice','customer_credit') then 'customer'::public.counterparty_type else 'vendor'::public.counterparty_type end))
    or (mapping.resolution='reviewed_creation' and (
      nullif(btrim(mapping.proposed_record->>'name'),'') is null
      or mapping.proposed_record->>'type' is distinct from case when item.item_type in ('customer_invoice','customer_credit') then 'customer' else 'vendor' end))
  );
  if v_invalid>0 then v_errors:=v_errors||jsonb_build_array('MIGRATION_OPEN_ITEM_POLICY_VIOLATION'); end if;
  select count(*) into v_invalid from public.migration_open_items item where item.batch_id=p_batch_id
    and item.item_type in ('customer_invoice','supplier_bill') and (
    coalesce((select sum(a.amount_minor) from public.migration_open_item_allocations a where a.target_item_id=item.id),0)
      <> item.original_minor-item.open_minor
  );
  if v_invalid>0 then v_errors:=v_errors||jsonb_build_array('MIGRATION_ALLOCATION_RECONCILIATION_FAILED'); end if;
  select count(*) into v_invalid from public.migration_open_item_allocations allocation
  join public.migration_open_items target on target.id=allocation.target_item_id
  where allocation.batch_id=p_batch_id and (
    target.item_type not in ('customer_invoice','supplier_bill')
    or allocation.allocation_date<target.document_date or allocation.allocation_date>v_project.cutover_date
    or (target.item_type='customer_invoice' and allocation.source_type='payment')
    or (target.item_type='supplier_bill' and allocation.source_type='receipt')
  );
  if v_invalid>0 then v_errors:=v_errors||jsonb_build_array('MIGRATION_ALLOCATION_POLICY_VIOLATION'); end if;
  -- A still-open credit is preserved as a negative subledger item. Applied
  -- historical credits are allocation evidence against their target item.
  select count(*) into v_invalid from public.migration_open_item_allocations allocation
  join public.migration_open_items target on target.id=allocation.target_item_id
  left join public.migration_open_items credit on credit.batch_id=allocation.batch_id
    and credit.source_document_key=allocation.source_document_key
    and credit.item_type=case when target.item_type='customer_invoice' then 'customer_credit'::public.migration_open_item_type else 'supplier_credit'::public.migration_open_item_type end
  where allocation.batch_id=p_batch_id and allocation.source_type='credit'
    and (credit.id is null or credit.mapping_entry_id<>target.mapping_entry_id
      or credit.document_date>allocation.allocation_date);
  if v_invalid>0 then v_errors:=v_errors||jsonb_build_array('MIGRATION_CREDIT_ALLOCATION_INVALID'); end if;
  select count(*) into v_invalid from public.migration_open_items credit where credit.batch_id=p_batch_id
    and credit.item_type in ('customer_credit','supplier_credit') and
    coalesce((select sum(a.amount_minor) from public.migration_open_item_allocations a
      where a.batch_id=p_batch_id and a.source_type='credit' and a.source_document_key=credit.source_document_key),0)
      <> credit.original_minor-credit.open_minor;
  if v_invalid>0 then v_errors:=v_errors||jsonb_build_array('MIGRATION_CREDIT_RECONCILIATION_FAILED'); end if;
  if v_opening.posted_transaction_id is not null then
    for v_control in
      select item.control_account_id,
        case when item.item_type in ('customer_invoice','customer_credit') then 'customer' else 'supplier' end subledger,
        sum(case when item.item_type in ('customer_invoice','supplier_bill') then item.open_minor else -item.open_minor end)::bigint expected
      from public.migration_open_items item where item.batch_id=p_batch_id group by item.control_account_id,subledger
    loop
      select case when account.normal_balance='debit'
        then coalesce(sum(entry.base_amount_minor) filter(where entry.side='debit'),0)-coalesce(sum(entry.base_amount_minor) filter(where entry.side='credit'),0)
        else coalesce(sum(entry.base_amount_minor) filter(where entry.side='credit'),0)-coalesce(sum(entry.base_amount_minor) filter(where entry.side='debit'),0) end
      into v_gl from public.accounts account left join public.transaction_entries entry
        on entry.account_id=account.id and entry.posted_at is not null and entry.entry_date<=v_project.cutover_date
      where account.id=v_control.control_account_id group by account.normal_balance;
      if v_gl is distinct from v_control.expected then
        v_errors:=v_errors||jsonb_build_array(case when v_control.subledger='customer' then 'MIGRATION_AR_CONTROL_VARIANCE' else 'MIGRATION_AP_CONTROL_VARIANCE' end);
      end if;
    end loop;
  end if;
  select coalesce(sum(case when item.item_type='customer_invoice' then open_minor when item.item_type='customer_credit' then -open_minor else 0 end),0),
    coalesce(sum(case when item.item_type='supplier_bill' then open_minor when item.item_type='supplier_credit' then -open_minor else 0 end),0)
    into v_ar,v_ap from public.migration_open_items item where batch_id=p_batch_id;
  return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'batch_id',p_batch_id,'project_id',v_batch.project_id,
    'cutover_date',v_project.cutover_date,'opening_balance_batch_id',v_project.opening_balance_batch_id,
    'ar_open_minor',v_ar::text,'ap_open_minor',v_ap::text,'errors',v_errors,'gl_effect','none',
    'control_boundary','opening_trial_balance');
end;
$$;

create or replace function public.validate_migration_open_items(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_batch public.migration_open_item_batches%rowtype; v_result jsonb;
begin
  select * into v_batch from public.migration_open_item_batches where id=p_batch_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration open-item batch not found' using errcode='42501'; end if;
  perform app.require_capability(v_batch.organization_id,'migrations.review');
  if v_batch.status='accepted' then return v_batch.validation_result; end if;
  v_result:=app.compute_migration_open_item_validation(p_batch_id);
  update public.migration_open_item_batches set status=case when (v_result->>'valid')::boolean
      then 'validated'::public.migration_open_item_batch_status
      else 'invalid'::public.migration_open_item_batch_status end,
    validation_result=v_result,validated_by=auth.uid(),validated_at=now() where id=p_batch_id;
  insert into public.migration_open_item_validation_runs(batch_id,organization_id,result,validated_by)
    values(p_batch_id,v_batch.organization_id,v_result,auth.uid());
  perform app.write_audit(v_batch.organization_id,'migration_open_items.validated','migration_open_item_batch',p_batch_id,null,v_result);
  return v_result;
end;
$$;

create or replace function public.accept_migration_open_items(p_batch_id uuid,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_batch public.migration_open_item_batches%rowtype; v_project public.migration_projects%rowtype;
  v_opening public.opening_balance_batches%rowtype; v_result jsonb; v_mapping record; v_item record;
  v_counterparty uuid; v_document uuid;
begin
  select * into v_batch from public.migration_open_item_batches where id=p_batch_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration open-item batch not found' using errcode='42501'; end if;
  perform app.require_capability(v_batch.organization_id,'migrations.review');
  perform app.require_capability(v_batch.organization_id,'counterparties.manage');
  if nullif(btrim(p_idempotency_key),'') is null then raise exception 'MIGRATION_ACCEPTANCE_KEY_REQUIRED' using errcode='22023'; end if;
  if v_batch.status='accepted' then
    if v_batch.acceptance_idempotency_key=btrim(p_idempotency_key) then return p_batch_id; end if;
    raise exception 'MIGRATION_IDEMPOTENCY_CONFLICT' using errcode='23505';
  end if;
  select * into v_project from public.migration_projects where id=v_batch.project_id for update;
  select * into v_opening from public.opening_balance_batches where id=v_project.opening_balance_batch_id;
  v_result:=app.compute_migration_open_item_validation(p_batch_id);
  if not (v_result->>'valid')::boolean then raise exception 'MIGRATION_OPEN_ITEM_VALIDATION_FAILED: %',v_result using errcode='23514'; end if;
  if exists(select 1 from public.migration_open_item_batches where project_id=v_batch.project_id and status='accepted') then
    raise exception 'MIGRATION_PROJECT_LOCKED: accepted cutover evidence is immutable' using errcode='55000';
  end if;
  for v_mapping in
    select distinct mapping.* from public.migration_open_items item
    join public.migration_mapping_entries mapping on mapping.id=item.mapping_entry_id where item.batch_id=p_batch_id
  loop
    if v_mapping.resolution='existing_record' then v_counterparty:=v_mapping.target_counterparty_id;
    else
      v_counterparty:=public.create_counterparty(v_batch.organization_id,v_mapping.proposed_record->>'name',
        (v_mapping.proposed_record->>'type')::public.counterparty_type,v_mapping.proposed_record->>'phone',
        v_mapping.proposed_record->>'email',v_mapping.proposed_record->>'tax_identifier',
        concat('Created from migration mapping ',v_mapping.id::text));
    end if;
    insert into public.migration_counterparty_acceptances(batch_id,organization_id,mapping_entry_id,counterparty_id,resolution,accepted_by)
      values(p_batch_id,v_batch.organization_id,v_mapping.id,v_counterparty,v_mapping.resolution,auth.uid());
  end loop;
  for v_item in
    select item.*,accepted.counterparty_id from public.migration_open_items item
    join public.migration_counterparty_acceptances accepted
      on accepted.batch_id=item.batch_id and accepted.mapping_entry_id=item.mapping_entry_id
    where item.batch_id=p_batch_id and item.open_minor>0 order by item.id
  loop
    v_document:=gen_random_uuid();
    if v_item.item_type in ('customer_invoice','customer_credit') then
      insert into public.ar_documents(id,organization_id,customer_id,control_account_id,offset_account_id,kind,
        document_date,due_date,reference,amount_minor,ar_effect_minor,currency_code,reason,transaction_id,
        idempotency_key,request_payload,created_by,migration_open_item_id)
      values(v_document,v_batch.organization_id,v_item.counterparty_id,v_item.control_account_id,v_item.correction_account_id,
        case when v_item.item_type='customer_invoice' then 'invoice' else 'credit' end,v_item.document_date,
        case when v_item.item_type='customer_invoice' then v_item.due_date else null end,v_item.source_reference,
        v_item.open_minor,case when v_item.item_type='customer_invoice' then v_item.open_minor else -v_item.open_minor end,
        v_item.currency_code,case when v_item.item_type='customer_credit' then 'Migrated open credit' else null end,
        v_opening.posted_transaction_id,'migration:'||p_batch_id::text||':'||v_item.id::text,
        jsonb_build_object('migration_batch_id',p_batch_id,'migration_open_item_id',v_item.id,'source_reference',v_item.source_reference),
        auth.uid(),v_item.id);
      insert into public.migration_open_item_acceptances(batch_id,organization_id,item_id,ar_document_id,accepted_by)
        values(p_batch_id,v_batch.organization_id,v_item.id,v_document,auth.uid());
    else
      insert into public.ap_documents(id,organization_id,supplier_id,control_account_id,offset_account_id,kind,
        document_date,due_date,reference,amount_minor,ap_effect_minor,currency_code,reason,transaction_id,
        idempotency_key,request_payload,created_by,migration_open_item_id)
      values(v_document,v_batch.organization_id,v_item.counterparty_id,v_item.control_account_id,v_item.correction_account_id,
        case when v_item.item_type='supplier_bill' then 'bill' else 'credit' end,v_item.document_date,
        case when v_item.item_type='supplier_bill' then v_item.due_date else null end,v_item.source_reference,
        v_item.open_minor,case when v_item.item_type='supplier_bill' then v_item.open_minor else -v_item.open_minor end,
        v_item.currency_code,case when v_item.item_type='supplier_credit' then 'Migrated open credit' else null end,
        v_opening.posted_transaction_id,'migration:'||p_batch_id::text||':'||v_item.id::text,
        jsonb_build_object('migration_batch_id',p_batch_id,'migration_open_item_id',v_item.id,'source_reference',v_item.source_reference),
        auth.uid(),v_item.id);
      insert into public.migration_open_item_acceptances(batch_id,organization_id,item_id,ap_document_id,accepted_by)
        values(p_batch_id,v_batch.organization_id,v_item.id,v_document,auth.uid());
    end if;
  end loop;
  update public.migration_open_item_batches set status='accepted',validation_result=v_result,
    validated_by=coalesce(validated_by,auth.uid()),validated_at=coalesce(validated_at,now()),
    acceptance_idempotency_key=btrim(p_idempotency_key),accepted_by=auth.uid(),accepted_at=now() where id=p_batch_id;
  perform app.write_audit(v_batch.organization_id,'migration_open_items.accepted','migration_open_item_batch',p_batch_id,null,
    v_result||jsonb_build_object('opening_transaction_id',v_opening.posted_transaction_id));
  return p_batch_id;
end;
$$;

create or replace function public.reverse_ar_document(p_organization_id uuid,p_document_id uuid,p_date date,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare d public.ar_documents%rowtype;
begin
  perform app.require_capability(p_organization_id,'ar.reverse');
  select * into d from public.ar_documents where id=p_document_id and organization_id=p_organization_id;
  if not found then raise exception 'AR_DOCUMENT_NOT_FOUND' using errcode='42501'; end if;
  if d.migration_open_item_id is not null then
    raise exception 'MIGRATION_OPEN_ITEM_IMMUTABLE: use a traceable AR adjustment or migration replacement workflow' using errcode='55000';
  end if;
  return public.post_ar_document(p_organization_id,'reversal',d.customer_id,d.control_account_id,p_date,
    d.amount_minor,d.offset_account_id,d.reference,p_idempotency_key,p_reason=>p_reason,p_reverses_document_id=>d.id);
end;
$$;

create or replace function public.reverse_ap_document(p_organization_id uuid,p_document_id uuid,p_date date,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare d public.ap_documents%rowtype;
begin
  perform app.require_capability(p_organization_id,'ap.reverse');
  select * into d from public.ap_documents where id=p_document_id and organization_id=p_organization_id;
  if not found then raise exception 'AP_DOCUMENT_NOT_FOUND' using errcode='42501'; end if;
  if d.migration_open_item_id is not null then
    raise exception 'MIGRATION_OPEN_ITEM_IMMUTABLE: use a traceable AP adjustment or migration replacement workflow' using errcode='55000';
  end if;
  return public.post_ap_document(p_organization_id,'reversal',d.supplier_id,d.control_account_id,p_date,
    d.amount_minor,d.offset_account_id,d.reference,p_idempotency_key,p_reason=>p_reason,p_reverses_document_id=>d.id);
end;
$$;

create or replace function public.read_migration_open_item_batch(p_batch_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_batch public.migration_open_item_batches%rowtype;
begin
  select * into v_batch from public.migration_open_item_batches where id=p_batch_id;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration open-item batch not found' using errcode='42501'; end if;
  perform app.require_capability(v_batch.organization_id,'migrations.read');
  return jsonb_build_object('batch',to_jsonb(v_batch),
    'items',coalesce((select jsonb_agg(to_jsonb(item) order by item.item_type,item.source_document_key)
      from public.migration_open_items item where item.batch_id=p_batch_id),'[]'::jsonb),
    'allocations',coalesce((select jsonb_agg(to_jsonb(allocation) order by allocation.allocation_date,allocation.id)
      from public.migration_open_item_allocations allocation where allocation.batch_id=p_batch_id),'[]'::jsonb),
    'counterparties',coalesce((select jsonb_agg(to_jsonb(accepted) order by accepted.accepted_at,accepted.id)
      from public.migration_counterparty_acceptances accepted where accepted.batch_id=p_batch_id),'[]'::jsonb),
    'acceptances',coalesce((select jsonb_agg(to_jsonb(accepted) order by accepted.accepted_at,accepted.id)
      from public.migration_open_item_acceptances accepted where accepted.batch_id=p_batch_id),'[]'::jsonb),
    'validation_runs',coalesce((select jsonb_agg(to_jsonb(run) order by run.validated_at,run.id)
      from public.migration_open_item_validation_runs run where run.batch_id=p_batch_id),'[]'::jsonb));
end;
$$;

revoke all on function public.stage_migration_open_items(uuid,uuid,jsonb,jsonb,text),
  public.validate_migration_open_items(uuid),public.accept_migration_open_items(uuid,text),
  public.read_migration_open_item_batch(uuid) from public,anon;
grant execute on function public.stage_migration_open_items(uuid,uuid,jsonb,jsonb,text),
  public.validate_migration_open_items(uuid),public.accept_migration_open_items(uuid,text),
  public.read_migration_open_item_batch(uuid) to authenticated,service_role;
revoke all on function app.guard_migration_open_batch_change(),app.guard_accepted_migration_project(),
  app.compute_migration_open_item_validation(uuid) from public,anon,authenticated;
