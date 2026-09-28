-- LS-MIG-003 / MIG-02, MIG-04, MIG-07..09.
--
-- Operational opening detail explains balances already posted by the Opening
-- Trial Balance.  Staging, validation, and acceptance deliberately have no
-- transaction-posting path.  Historical acquisition, depreciation, bank,
-- inventory, and tax activity is never reconstructed here.

create type public.migration_operational_status as enum ('staged','validated','invalid','accepted');
create type public.migration_bank_outstanding_kind as enum ('deposit','payment');
create type public.migration_tax_direction as enum ('output','input');

create table public.migration_operational_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  staging_batch_id uuid not null references public.migration_staging_batches(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  revision integer not null check (revision > 0),
  open_items_applicable boolean not null,
  assets_applicable boolean not null,
  bank_applicable boolean not null,
  inventory_applicable boolean not null,
  tax_applicable boolean not null,
  status public.migration_operational_status not null default 'staged',
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 1 and 160),
  validation_result jsonb,
  validated_by uuid references public.profiles(id) on delete restrict,
  validated_at timestamptz,
  acceptance_idempotency_key text,
  accepted_by uuid references public.profiles(id) on delete restrict,
  accepted_at timestamptz,
  staged_by uuid not null references public.profiles(id) on delete restrict,
  staged_at timestamptz not null default now(),
  constraint migration_operational_project_scope foreign key (project_id,organization_id)
    references public.migration_projects(id,organization_id) on delete restrict,
  unique(id,organization_id), unique(project_id,revision), unique(project_id,idempotency_key),
  check (open_items_applicable or assets_applicable or bank_applicable or inventory_applicable or tax_applicable),
  check ((status='accepted')=(accepted_by is not null and accepted_at is not null and acceptance_idempotency_key is not null)),
  check ((status in ('validated','invalid','accepted'))=(validation_result is not null and validated_by is not null and validated_at is not null))
);
create unique index migration_operational_one_accepted on public.migration_operational_batches(project_id) where status='accepted';

create table public.migration_asset_openings (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null, organization_id uuid not null,
  original_row_id uuid not null references public.migration_original_rows(id) on delete restrict,
  source_asset_key text not null check(nullif(btrim(source_asset_key),'') is not null),
  source_identity jsonb not null check(jsonb_typeof(source_identity)='object' and source_identity<>'{}'),
  asset_code text not null check(nullif(btrim(asset_code),'') is not null),
  asset_name text not null check(nullif(btrim(asset_name),'') is not null),
  acquisition_date date not null check(isfinite(acquisition_date)),
  in_service_date date not null check(isfinite(in_service_date) and in_service_date>=acquisition_date),
  cost_minor bigint not null check(cost_minor>0),
  accumulated_depreciation_minor bigint not null check(accumulated_depreciation_minor>=0 and accumulated_depreciation_minor<=cost_minor),
  net_book_value_minor bigint not null check(net_book_value_minor>=0),
  residual_value_minor bigint not null check(residual_value_minor>=0),
  useful_life_months integer not null check(useful_life_months between 1 and 1200),
  depreciation_method public.asset_depreciation_method not null,
  declining_rate_basis_points integer,
  cost_account_id uuid not null, accumulated_depreciation_account_id uuid not null,
  approval_evidence jsonb not null check(jsonb_typeof(approval_evidence)='object' and approval_evidence<>'{}'),
  unique(id,organization_id), unique(batch_id,source_asset_key), unique(batch_id,original_row_id),
  foreign key(batch_id,organization_id) references public.migration_operational_batches(id,organization_id) on delete restrict,
  foreign key(cost_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  foreign key(accumulated_depreciation_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  check(net_book_value_minor=cost_minor-accumulated_depreciation_minor),
  check(residual_value_minor<=net_book_value_minor),
  check((depreciation_method='straight_line' and declining_rate_basis_points is null)
    or (depreciation_method='declining_balance' and declining_rate_basis_points between 1 and 10000)),
  check(cost_account_id<>accumulated_depreciation_account_id)
);

create table public.migration_bank_positions (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null, organization_id uuid not null,
  original_row_id uuid not null references public.migration_original_rows(id) on delete restrict,
  bank_account_id uuid not null, currency_code char(3) not null references public.currencies(code),
  statement_date date not null check(isfinite(statement_date)), statement_balance_minor bigint not null,
  statement_reference text not null check(nullif(btrim(statement_reference),'') is not null),
  source_identity jsonb not null check(jsonb_typeof(source_identity)='object' and source_identity<>'{}'),
  approval_evidence jsonb not null check(jsonb_typeof(approval_evidence)='object' and approval_evidence<>'{}'),
  unique(id,organization_id), unique(batch_id,bank_account_id), unique(batch_id,original_row_id),
  foreign key(batch_id,organization_id) references public.migration_operational_batches(id,organization_id) on delete restrict,
  foreign key(bank_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict
);
create table public.migration_bank_outstanding_items (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null, bank_position_id uuid not null,
  organization_id uuid not null, original_row_id uuid not null references public.migration_original_rows(id) on delete restrict,
  source_item_key text not null check(nullif(btrim(source_item_key),'') is not null),
  kind public.migration_bank_outstanding_kind not null, transaction_date date not null check(isfinite(transaction_date)),
  signed_bank_effect_minor bigint not null check(signed_bank_effect_minor<>0),
  reference text, source_identity jsonb not null check(jsonb_typeof(source_identity)='object' and source_identity<>'{}'),
  unique(id,organization_id), unique(batch_id,source_item_key), unique(batch_id,original_row_id),
  foreign key(batch_id,organization_id) references public.migration_operational_batches(id,organization_id) on delete restrict,
  foreign key(bank_position_id,organization_id) references public.migration_bank_positions(id,organization_id) on delete restrict,
  check((kind='deposit' and signed_bank_effect_minor>0) or (kind='payment' and signed_bank_effect_minor<0))
);

create table public.migration_inventory_openings (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null, organization_id uuid not null,
  original_row_id uuid not null references public.migration_original_rows(id) on delete restrict,
  source_key text not null check(nullif(btrim(source_key),'') is not null),
  source_system text not null check(source_system='inventory-suit'), schema_version integer not null check(schema_version=1),
  snapshot_date date not null check(isfinite(snapshot_date)), currency_code char(3) not null references public.currencies(code),
  control_account_id uuid not null, stock_quantity numeric not null check(stock_quantity>=0 and stock_quantity<'Infinity'::numeric),
  valuation_minor bigint not null check(valuation_minor>=0),
  costing_method text not null check(nullif(btrim(costing_method),'') is not null),
  policy_version text not null check(nullif(btrim(policy_version),'') is not null),
  valuation_sha256 text not null check(valuation_sha256~'^[0-9a-f]{64}$'),
  source_identity jsonb not null check(jsonb_typeof(source_identity)='object' and source_identity<>'{}'),
  approval_evidence jsonb not null check(jsonb_typeof(approval_evidence)='object' and approval_evidence<>'{}'),
  unique(id,organization_id), unique(batch_id,source_key), unique(batch_id,original_row_id),
  foreign key(batch_id,organization_id) references public.migration_operational_batches(id,organization_id) on delete restrict,
  foreign key(control_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict
);

create table public.migration_tax_openings (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null, organization_id uuid not null,
  original_row_id uuid not null references public.migration_original_rows(id) on delete restrict,
  vat_profile_id uuid not null, direction public.migration_tax_direction not null,
  designated_account_id uuid not null, period_end date not null check(isfinite(period_end)), balance_minor bigint not null check(balance_minor>=0),
  evidence_scope text not null check(evidence_scope='approved_egypt_vat'),
  evidence_type text not null check(evidence_type in ('return_summary','ledger_opening_schedule')),
  source_identity jsonb not null check(jsonb_typeof(source_identity)='object' and source_identity<>'{}'),
  approval_evidence jsonb not null check(jsonb_typeof(approval_evidence)='object' and approval_evidence<>'{}'),
  unique(id,organization_id), unique(batch_id,vat_profile_id,direction), unique(batch_id,original_row_id),
  foreign key(batch_id,organization_id) references public.migration_operational_batches(id,organization_id) on delete restrict,
  foreign key(vat_profile_id,organization_id) references public.organization_vat_profiles(id,organization_id) on delete restrict,
  foreign key(designated_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict
);

create table public.migration_operational_validation_runs (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null, organization_id uuid not null,
  result jsonb not null check(jsonb_typeof(result)='object'), validated_by uuid not null references public.profiles(id) on delete restrict,
  validated_at timestamptz not null default now(),
  foreign key(batch_id,organization_id) references public.migration_operational_batches(id,organization_id) on delete restrict
);

comment on table public.migration_operational_batches is 'Operational cutover evidence only; the linked Opening Trial Balance is the single GL effect.';
comment on table public.migration_inventory_openings is 'Approved Inventory Suit valuation snapshots; Ledger never infers historical costing.';
comment on table public.migration_tax_openings is 'Approved Egypt VAT opening summaries, never fabricated historical compliance documents.';

create index migration_asset_openings_batch on public.migration_asset_openings(batch_id);
create index migration_bank_positions_batch on public.migration_bank_positions(batch_id);
create index migration_bank_items_position on public.migration_bank_outstanding_items(bank_position_id);
create index migration_inventory_openings_batch on public.migration_inventory_openings(batch_id);
create index migration_tax_openings_batch on public.migration_tax_openings(batch_id);

alter table public.migration_operational_batches enable row level security;
alter table public.migration_asset_openings enable row level security;
alter table public.migration_bank_positions enable row level security;
alter table public.migration_bank_outstanding_items enable row level security;
alter table public.migration_inventory_openings enable row level security;
alter table public.migration_tax_openings enable row level security;
alter table public.migration_operational_validation_runs enable row level security;
create policy migration_operational_batches_read on public.migration_operational_batches for select to authenticated using(app.has_capability(organization_id,'migrations.read'));
create policy migration_asset_openings_read on public.migration_asset_openings for select to authenticated using(app.has_capability(organization_id,'migrations.read'));
create policy migration_bank_positions_read on public.migration_bank_positions for select to authenticated using(app.has_capability(organization_id,'migrations.read'));
create policy migration_bank_items_read on public.migration_bank_outstanding_items for select to authenticated using(app.has_capability(organization_id,'migrations.read'));
create policy migration_inventory_openings_read on public.migration_inventory_openings for select to authenticated using(app.has_capability(organization_id,'migrations.read'));
create policy migration_tax_openings_read on public.migration_tax_openings for select to authenticated using(app.has_capability(organization_id,'migrations.read'));
create policy migration_operational_runs_read on public.migration_operational_validation_runs for select to authenticated using(app.has_capability(organization_id,'migrations.read'));
grant select on public.migration_operational_batches,public.migration_asset_openings,public.migration_bank_positions,
  public.migration_bank_outstanding_items,public.migration_inventory_openings,public.migration_tax_openings,
  public.migration_operational_validation_runs to authenticated;

create trigger migration_asset_openings_immutable before update or delete on public.migration_asset_openings for each row execute function app.reject_migration_evidence_change();
create trigger migration_bank_positions_immutable before update or delete on public.migration_bank_positions for each row execute function app.reject_migration_evidence_change();
create trigger migration_bank_outstanding_items_immutable before update or delete on public.migration_bank_outstanding_items for each row execute function app.reject_migration_evidence_change();
create trigger migration_inventory_openings_immutable before update or delete on public.migration_inventory_openings for each row execute function app.reject_migration_evidence_change();
create trigger migration_tax_openings_immutable before update or delete on public.migration_tax_openings for each row execute function app.reject_migration_evidence_change();
create trigger migration_operational_validation_runs_immutable before update or delete on public.migration_operational_validation_runs for each row execute function app.reject_migration_evidence_change();

create function app.guard_migration_operational_batch_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' or old.status='accepted' then raise exception 'MIGRATION_CUTOVER_LOCKED: accepted operational evidence is immutable' using errcode='55000'; end if;
  if coalesce(current_setting('app.migration_operational_authorized',true),'')<>'on' then
    raise exception 'MIGRATION_EVIDENCE_IMMUTABLE: use the operational cutover commands' using errcode='55000';
  end if;
  return new;
end; $$;
create trigger migration_operational_batches_guard before update or delete on public.migration_operational_batches for each row execute function app.guard_migration_operational_batch_change();

create function app.migration_gl_balance(p_organization_id uuid,p_account_id uuid,p_cutover_date date)
returns bigint language sql stable security definer set search_path='' as $$
  select case when a.normal_balance='debit'
    then coalesce(sum(e.base_amount_minor) filter(where e.side='debit'),0)-coalesce(sum(e.base_amount_minor) filter(where e.side='credit'),0)
    else coalesce(sum(e.base_amount_minor) filter(where e.side='credit'),0)-coalesce(sum(e.base_amount_minor) filter(where e.side='debit'),0) end::bigint
  from public.accounts a left join public.transaction_entries e on e.account_id=a.id and e.organization_id=a.organization_id
    and e.posted_at is not null and e.entry_date<=p_cutover_date
  where a.id=p_account_id and a.organization_id=p_organization_id group by a.normal_balance;
$$;

create function app.migration_ledger_digest(p_organization_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select encode(extensions.digest(
    coalesce((select string_agg(to_jsonb(t)::text,'|' order by t.id) from public.transactions t where t.organization_id=p_organization_id),'')||'#'||
    coalesce((select string_agg(to_jsonb(e)::text,'|' order by e.transaction_id,e.entry_index) from public.transaction_entries e where e.organization_id=p_organization_id),''),
    'sha256'),'hex');
$$;

-- The Opening Trial Balance command already establishes a private, validated
-- opening-control context for AR/AP.  Extend the same boundary to the approved
-- inventory and VAT control accounts: ordinary journals remain blocked, while
-- the one opening journal may establish their cutover balances.
create or replace function app.guard_inventory_control_entry() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.control_account_bindings b where b.account_id=new.account_id and b.subledger_type='inventory') then return new; end if;
  if current_setting('app.opening_control_authorized',true)='on'
    and current_setting('app.opening_control_organization',true)=new.organization_id::text
    and exists(select 1 from public.opening_balance_batches b where b.id::text=current_setting('app.opening_control_batch',true)
      and b.organization_id=new.organization_id and b.status='validated') then return new; end if;
  if coalesce(current_setting('app.inventory_source',true),'') <> coalesce((select s.id::text
    from public.inventory_accounting_sources s where s.control_account_id=new.account_id),'unconfigured') then
    raise exception 'INVENTORY_SOURCE_REQUIRED' using errcode='42501'; end if;
  return new;
end; $$;

create or replace function app.guard_vat_control_entry() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.organization_vat_profiles p where p.organization_id=new.organization_id
    and new.account_id in(p.output_vat_account_id,p.input_vat_account_id)) then return new; end if;
  if current_setting('app.opening_control_authorized',true)='on'
    and current_setting('app.opening_control_organization',true)=new.organization_id::text
    and exists(select 1 from public.opening_balance_batches b where b.id::text=current_setting('app.opening_control_batch',true)
      and b.organization_id=new.organization_id and b.status='validated') then return new; end if;
  if current_setting('app.vat_post_context',true) is distinct from new.organization_id::text then
    raise exception 'VAT_CONTROL_ACCOUNT_RESTRICTED: use the VAT document command' using errcode='42501'; end if;
  return new;
end; $$;

create or replace function app.control_posting_context_matches(p_organization_id uuid,p_account_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select (
    coalesce(current_setting('app.control_posting_authorized',true),'')='on'
    and nullif(current_setting('app.control_posting_organization',true),'')::uuid=p_organization_id
    and nullif(current_setting('app.control_posting_account',true),'')::uuid=p_account_id
    and nullif(current_setting('app.control_posting_reference',true),'') is not null
    and exists(select 1 from public.control_account_bindings binding where binding.organization_id=p_organization_id
      and binding.account_id=p_account_id and binding.subledger_type::text=current_setting('app.control_posting_subledger',true))
  ) or (
    coalesce(current_setting('app.opening_control_authorized',true),'')='on'
    and nullif(current_setting('app.opening_control_organization',true),'')::uuid=p_organization_id
    and exists(select 1 from public.opening_balance_batches batch
      join public.opening_balance_rows row on row.batch_id=batch.id
      join public.control_account_bindings binding on binding.account_id=row.mapped_account_id and binding.organization_id=row.organization_id
      where batch.id=nullif(current_setting('app.opening_control_batch',true),'')::uuid
        and batch.organization_id=p_organization_id and batch.status in ('validated','posted') and row.mapped_account_id=p_account_id
        and binding.subledger_type in ('customer','supplier','inventory'))
  );
$$;

create or replace function app.compute_opening_validation(p_batch_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  v_batch public.opening_balance_batches%rowtype; v_row public.opening_balance_rows%rowtype; v_account public.accounts%rowtype;
  v_base char(3); v_errors jsonb:='[]'; v_row_errors jsonb; v_rows jsonb:='[]'; v_preview jsonb:='[]';
  v_debit bigint:=0; v_credit bigint:=0; v_valid_count integer:=0; v_zero_count integer:=0; v_fy_start date; v_fy_end date;
begin
  select * into v_batch from public.opening_balance_batches where id=p_batch_id;
  if not found then raise exception 'TENANT_ACCESS_DENIED: opening batch not found' using errcode='42501'; end if;
  v_base:=app.org_base_currency(v_batch.organization_id);
  select fiscal_year_start,fiscal_year_end into v_fy_start,v_fy_end from app.fiscal_year_bounds(v_batch.organization_id,v_batch.cutoff_date+1);
  if v_batch.migration_mode='year_start' and v_batch.cutoff_date+1<>v_fy_start then v_errors:=v_errors||jsonb_build_array('OPENING_YEAR_START_CUTOFF');
  elsif v_batch.migration_mode='midyear' and not(v_batch.cutoff_date+1>v_fy_start and v_batch.cutoff_date+1<=v_fy_end) then v_errors:=v_errors||jsonb_build_array('OPENING_MIDYEAR_CUTOFF'); end if;
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
        if v_account.account_role='control' and not exists(select 1 from public.control_account_bindings binding
          where binding.account_id=v_account.id and binding.organization_id=v_batch.organization_id
            and binding.subledger_type in ('customer','supplier','inventory')) then v_row_errors:=v_row_errors||jsonb_build_array('OPENING_CONTROL_BINDING_INVALID'); end if;
        if v_account.currency<>v_base then v_row_errors:=v_row_errors||jsonb_build_array('OPENING_BASE_CURRENCY_ONLY'); end if;
        if v_batch.migration_mode='year_start' and v_account.type in ('revenue','expense')
          and (coalesce(v_row.debit_minor,0)<>0 or coalesce(v_row.credit_minor,0)<>0) then v_row_errors:=v_row_errors||jsonb_build_array('OPENING_YEAR_START_PL_FORBIDDEN'); end if;
      end if;
    end if;
    update public.opening_balance_rows set validation_errors=v_row_errors where id=v_row.id;
    if jsonb_array_length(v_row_errors)=0 and (coalesce(v_row.debit_minor,0)>0 or coalesce(v_row.credit_minor,0)>0) then
      v_valid_count:=v_valid_count+1; v_debit:=v_debit+v_row.debit_minor; v_credit:=v_credit+v_row.credit_minor;
      v_preview:=v_preview||jsonb_build_array(jsonb_build_object('row_id',v_row.id,'account_id',v_account.id,'account_code',v_account.code,
        'account_name',v_account.name,'debit_minor',v_row.debit_minor,'credit_minor',v_row.credit_minor));
    end if;
    v_rows:=v_rows||jsonb_build_array(jsonb_build_object('row_id',v_row.id,'source_row',v_row.source_row,'errors',v_row_errors));
  end loop;
  if v_valid_count=0 then v_errors:=v_errors||jsonb_build_array('OPENING_NO_EFFECTIVE_ROWS'); end if;
  if v_debit<>v_credit then v_errors:=v_errors||jsonb_build_array('OPENING_BATCH_UNBALANCED'); end if;
  if exists(select 1 from jsonb_array_elements(v_rows) item where jsonb_array_length(item->'errors')>0) then v_errors:=v_errors||jsonb_build_array('OPENING_ROW_ERRORS'); end if;
  return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'mode',v_batch.migration_mode,'cutoff_date',v_batch.cutoff_date,'currency',v_base,
    'debit_total_minor',v_debit,'credit_total_minor',v_credit,'difference_minor',v_debit-v_credit,'valid_row_count',v_valid_count,
    'zero_row_count',v_zero_count,'errors',v_errors,'rows',v_rows,'preview',v_preview);
end; $$;

create function public.stage_migration_operational_cutover(
  p_project_id uuid,p_staging_batch_id uuid,p_applicability jsonb,p_assets jsonb,p_bank_positions jsonb,
  p_bank_items jsonb,p_inventory jsonb,p_tax jsonb,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_project public.migration_projects%rowtype; v_existing public.migration_operational_batches%rowtype;
  v_id uuid:=gen_random_uuid(); v_revision integer; v_hash text; x jsonb; v_original uuid; v_position uuid;
begin
  select * into v_project from public.migration_projects where id=p_project_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: migration project not found' using errcode='42501'; end if;
  perform app.require_capability(v_project.organization_id,'migrations.manage');
  if v_project.status<>'validated' or v_project.current_staging_batch_id<>p_staging_batch_id then raise exception 'MIGRATION_PROJECT_NOT_VALIDATED' using errcode='23514'; end if;
  if jsonb_typeof(p_applicability)<>'object' or exists(select 1 from jsonb_object_keys(p_applicability) k where k<>all(array['open_items','assets','bank','inventory','tax']))
    or exists(select 1 from unnest(array['open_items','assets','bank','inventory','tax']) k where jsonb_typeof(p_applicability->k)<>'boolean') then
    raise exception 'MIGRATION_APPLICABILITY_INVALID' using errcode='22023'; end if;
  if exists(select 1 from unnest(array[p_assets,p_bank_positions,p_bank_items,p_inventory,p_tax]) value where jsonb_typeof(value)<>'array')
    or nullif(btrim(p_idempotency_key),'') is null then raise exception 'MIGRATION_OPERATIONAL_INPUT_INVALID' using errcode='22023'; end if;
  if exists(select 1 from public.migration_operational_batches where project_id=p_project_id and status='accepted') then
    raise exception 'MIGRATION_PROJECT_LOCKED: accepted cutover evidence is immutable' using errcode='55000'; end if;
  v_hash:=encode(extensions.digest(convert_to(concat_ws('|',p_applicability::text,p_assets::text,p_bank_positions::text,p_bank_items::text,p_inventory::text,p_tax::text),'UTF8'),'sha256'),'hex');
  select * into v_existing from public.migration_operational_batches where project_id=p_project_id and idempotency_key=btrim(p_idempotency_key);
  if found then if v_existing.evidence_sha256<>v_hash then raise exception 'MIGRATION_IDEMPOTENCY_CONFLICT' using errcode='23505'; end if; return v_existing.id; end if;
  select coalesce(max(revision),0)+1 into v_revision from public.migration_operational_batches where project_id=p_project_id;
  insert into public.migration_operational_batches(id,project_id,staging_batch_id,organization_id,revision,
    open_items_applicable,assets_applicable,bank_applicable,inventory_applicable,tax_applicable,evidence_sha256,idempotency_key,staged_by)
  values(v_id,p_project_id,p_staging_batch_id,v_project.organization_id,v_revision,
    (p_applicability->>'open_items')::boolean,(p_applicability->>'assets')::boolean,(p_applicability->>'bank')::boolean,
    (p_applicability->>'inventory')::boolean,(p_applicability->>'tax')::boolean,v_hash,btrim(p_idempotency_key),auth.uid());
  for x in select value from jsonb_array_elements(p_assets) loop
    select r.id into v_original from public.migration_original_rows r where r.project_id=p_project_id and r.source_revision_id=v_project.current_source_revision_id and r.source_row=(x->>'source_row')::integer;
    if v_original is null then raise exception 'MIGRATION_SOURCE_ROW_NOT_FOUND' using errcode='23503'; end if;
    insert into public.migration_asset_openings(batch_id,organization_id,original_row_id,source_asset_key,source_identity,asset_code,asset_name,
      acquisition_date,in_service_date,cost_minor,accumulated_depreciation_minor,net_book_value_minor,residual_value_minor,useful_life_months,
      depreciation_method,declining_rate_basis_points,cost_account_id,accumulated_depreciation_account_id,approval_evidence)
    values(v_id,v_project.organization_id,v_original,x->>'source_asset_key',x->'source_identity',x->>'asset_code',x->>'asset_name',
      (x->>'acquisition_date')::date,(x->>'in_service_date')::date,(x->>'cost_minor')::bigint,(x->>'accumulated_depreciation_minor')::bigint,
      (x->>'net_book_value_minor')::bigint,(x->>'residual_value_minor')::bigint,(x->>'useful_life_months')::integer,
      (x->>'depreciation_method')::public.asset_depreciation_method,nullif(x->>'declining_rate_basis_points','')::integer,
      (x->>'cost_account_id')::uuid,(x->>'accumulated_depreciation_account_id')::uuid,x->'approval_evidence');
  end loop;
  for x in select value from jsonb_array_elements(p_bank_positions) loop
    select r.id into v_original from public.migration_original_rows r where r.project_id=p_project_id and r.source_revision_id=v_project.current_source_revision_id and r.source_row=(x->>'source_row')::integer;
    insert into public.migration_bank_positions(batch_id,organization_id,original_row_id,bank_account_id,currency_code,statement_date,statement_balance_minor,statement_reference,source_identity,approval_evidence)
    values(v_id,v_project.organization_id,v_original,(x->>'bank_account_id')::uuid,upper(x->>'currency_code'),(x->>'statement_date')::date,
      (x->>'statement_balance_minor')::bigint,x->>'statement_reference',x->'source_identity',x->'approval_evidence');
  end loop;
  for x in select value from jsonb_array_elements(p_bank_items) loop
    select r.id into v_original from public.migration_original_rows r where r.project_id=p_project_id and r.source_revision_id=v_project.current_source_revision_id and r.source_row=(x->>'source_row')::integer;
    select id into v_position from public.migration_bank_positions where batch_id=v_id and bank_account_id=(x->>'bank_account_id')::uuid;
    if v_original is null or v_position is null then raise exception 'MIGRATION_BANK_POSITION_NOT_FOUND' using errcode='23503'; end if;
    insert into public.migration_bank_outstanding_items(batch_id,bank_position_id,organization_id,original_row_id,source_item_key,kind,transaction_date,signed_bank_effect_minor,reference,source_identity)
    values(v_id,v_position,v_project.organization_id,v_original,x->>'source_item_key',(x->>'kind')::public.migration_bank_outstanding_kind,
      (x->>'transaction_date')::date,(x->>'signed_bank_effect_minor')::bigint,x->>'reference',x->'source_identity');
  end loop;
  for x in select value from jsonb_array_elements(p_inventory) loop
    select r.id into v_original from public.migration_original_rows r where r.project_id=p_project_id and r.source_revision_id=v_project.current_source_revision_id and r.source_row=(x->>'source_row')::integer;
    insert into public.migration_inventory_openings(batch_id,organization_id,original_row_id,source_key,source_system,schema_version,snapshot_date,currency_code,
      control_account_id,stock_quantity,valuation_minor,costing_method,policy_version,valuation_sha256,source_identity,approval_evidence)
    values(v_id,v_project.organization_id,v_original,x->>'source_key',x->>'source_system',(x->>'schema_version')::integer,(x->>'snapshot_date')::date,
      upper(x->>'currency_code'),(x->>'control_account_id')::uuid,(x->>'stock_quantity')::numeric,(x->>'valuation_minor')::bigint,
      x->>'costing_method',x->>'policy_version',lower(x->>'valuation_sha256'),x->'source_identity',x->'approval_evidence');
  end loop;
  for x in select value from jsonb_array_elements(p_tax) loop
    select r.id into v_original from public.migration_original_rows r where r.project_id=p_project_id and r.source_revision_id=v_project.current_source_revision_id and r.source_row=(x->>'source_row')::integer;
    insert into public.migration_tax_openings(batch_id,organization_id,original_row_id,vat_profile_id,direction,designated_account_id,period_end,balance_minor,
      evidence_scope,evidence_type,source_identity,approval_evidence)
    values(v_id,v_project.organization_id,v_original,(x->>'vat_profile_id')::uuid,(x->>'direction')::public.migration_tax_direction,
      (x->>'designated_account_id')::uuid,(x->>'period_end')::date,(x->>'balance_minor')::bigint,x->>'evidence_scope',x->>'evidence_type',x->'source_identity',x->'approval_evidence');
  end loop;
  perform app.write_audit(v_project.organization_id,'migration_operational.staged','migration_operational_batch',v_id,null,
    jsonb_build_object('project_id',p_project_id,'revision',v_revision,'evidence_sha256',v_hash));
  return v_id;
end; $$;

create function app.compute_migration_operational_validation(p_batch_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  b public.migration_operational_batches%rowtype; p public.migration_projects%rowtype; o public.opening_balance_batches%rowtype;
  errors jsonb:='[]'; variances jsonb:='[]'; invalid_count bigint; expected bigint; actual bigint; r record;
begin
  select * into b from public.migration_operational_batches where id=p_batch_id;
  if not found then raise exception 'MIGRATION_OPERATIONAL_BATCH_NOT_FOUND' using errcode='42501'; end if;
  select * into p from public.migration_projects where id=b.project_id;
  select * into o from public.opening_balance_batches where id=p.opening_balance_batch_id;
  if p.status<>'validated' or p.current_staging_batch_id<>b.staging_batch_id then errors:=errors||jsonb_build_array('MIGRATION_PROJECT_NOT_VALIDATED'); end if;
  if o.id is null or o.organization_id<>b.organization_id or o.cutoff_date<>p.cutover_date or o.status<>'posted' or o.posted_transaction_id is null then
    errors:=errors||jsonb_build_array('MIGRATION_OPENING_BATCH_NOT_POSTED'); end if;
  if b.open_items_applicable<>(exists(select 1 from public.migration_open_item_batches x where x.project_id=b.project_id and x.status='accepted')) then
    errors:=errors||jsonb_build_array('MIGRATION_OPEN_ITEMS_NOT_ACCEPTED'); end if;
  if b.assets_applicable<>(exists(select 1 from public.migration_asset_openings x where x.batch_id=b.id)) then errors:=errors||jsonb_build_array('MIGRATION_ASSET_APPLICABILITY_MISMATCH'); end if;
  if b.bank_applicable<>(exists(select 1 from public.migration_bank_positions x where x.batch_id=b.id)) then errors:=errors||jsonb_build_array('MIGRATION_BANK_APPLICABILITY_MISMATCH'); end if;
  if b.inventory_applicable<>(exists(select 1 from public.migration_inventory_openings x where x.batch_id=b.id)) then errors:=errors||jsonb_build_array('MIGRATION_INVENTORY_APPLICABILITY_MISMATCH'); end if;
  if b.tax_applicable<>(exists(select 1 from public.migration_tax_openings x where x.batch_id=b.id)) then errors:=errors||jsonb_build_array('MIGRATION_TAX_APPLICABILITY_MISMATCH'); end if;

  select count(*) into invalid_count from public.migration_asset_openings x
    join public.accounts cost on cost.id=x.cost_account_id join public.accounts accum on accum.id=x.accumulated_depreciation_account_id
    where x.batch_id=b.id and (x.acquisition_date>p.cutover_date or x.in_service_date>p.cutover_date or cost.organization_id<>b.organization_id
      or accum.organization_id<>b.organization_id or cost.type<>'asset' or accum.type<>'asset' or cost.normal_balance<>'debit'
      or accum.normal_balance<>'credit' or cost.is_archived or accum.is_archived or cost.currency<>app.org_base_currency(b.organization_id)
      or accum.currency<>app.org_base_currency(b.organization_id));
  if invalid_count>0 then errors:=errors||jsonb_build_array('MIGRATION_ASSET_POLICY_VIOLATION'); end if;
  for r in select cost_account_id account_id,sum(cost_minor)::bigint amount,'asset_cost' module from public.migration_asset_openings where batch_id=b.id group by cost_account_id
    union all select accumulated_depreciation_account_id,sum(accumulated_depreciation_minor)::bigint,'asset_accumulated_depreciation' from public.migration_asset_openings where batch_id=b.id group by accumulated_depreciation_account_id
  loop actual:=app.migration_gl_balance(b.organization_id,r.account_id,p.cutover_date); variances:=variances||jsonb_build_array(jsonb_build_object('module',r.module,'account_id',r.account_id,'detail_minor',r.amount::text,'gl_minor',actual::text,'variance_minor',(actual-r.amount)::text));
    if actual is distinct from r.amount then errors:=errors||jsonb_build_array('MIGRATION_ASSET_GL_VARIANCE'); end if; end loop;

  select count(*) into invalid_count from public.migration_bank_positions x join public.accounts a on a.id=x.bank_account_id
    where x.batch_id=b.id and (x.statement_date<>p.cutover_date or a.organization_id<>b.organization_id or a.type<>'asset' or a.subtype<>'bank'
      or a.account_role<>'posting' or a.normal_balance<>'debit' or a.is_archived or a.currency<>x.currency_code or x.currency_code<>app.org_base_currency(b.organization_id));
  if invalid_count>0 or exists(select 1 from public.migration_bank_outstanding_items x join public.migration_bank_positions pos on pos.id=x.bank_position_id
    where x.batch_id=b.id and x.transaction_date>p.cutover_date) then errors:=errors||jsonb_build_array('MIGRATION_BANK_POLICY_VIOLATION'); end if;
  for r in select pos.bank_account_id account_id,pos.statement_balance_minor+coalesce(sum(item.signed_bank_effect_minor),0)::bigint amount
    from public.migration_bank_positions pos left join public.migration_bank_outstanding_items item on item.bank_position_id=pos.id where pos.batch_id=b.id group by pos.id
  loop actual:=app.migration_gl_balance(b.organization_id,r.account_id,p.cutover_date); variances:=variances||jsonb_build_array(jsonb_build_object('module','bank_first_reconciliation','account_id',r.account_id,'detail_minor',r.amount::text,'gl_minor',actual::text,'variance_minor',(actual-r.amount)::text));
    if actual is distinct from r.amount then errors:=errors||jsonb_build_array('MIGRATION_BANK_GL_VARIANCE'); end if; end loop;

  select count(*) into invalid_count from public.migration_inventory_openings x join public.accounts a on a.id=x.control_account_id
    left join public.control_account_bindings binding on binding.account_id=a.id
    where x.batch_id=b.id and (x.snapshot_date<>p.cutover_date or x.currency_code<>app.org_base_currency(b.organization_id)
      or a.organization_id<>b.organization_id or a.type<>'asset' or a.subtype<>'inventory' or a.normal_balance<>'debit' or a.account_role<>'control'
      or a.is_archived or binding.subledger_type is distinct from 'inventory'::public.control_subledger_type
      or x.approval_evidence->>'approved' is distinct from 'true');
  if invalid_count>0 then errors:=errors||jsonb_build_array('MIGRATION_INVENTORY_POLICY_VIOLATION'); end if;
  for r in select control_account_id account_id,sum(valuation_minor)::bigint amount from public.migration_inventory_openings where batch_id=b.id group by control_account_id
  loop actual:=app.migration_gl_balance(b.organization_id,r.account_id,p.cutover_date); variances:=variances||jsonb_build_array(jsonb_build_object('module','inventory_approved_valuation','account_id',r.account_id,'detail_minor',r.amount::text,'gl_minor',actual::text,'variance_minor',(actual-r.amount)::text));
    if actual is distinct from r.amount then errors:=errors||jsonb_build_array('MIGRATION_INVENTORY_GL_VARIANCE'); end if; end loop;

  select count(*) into invalid_count from public.migration_tax_openings x join public.organization_vat_profiles profile on profile.id=x.vat_profile_id
    join public.accounts a on a.id=x.designated_account_id where x.batch_id=b.id and (x.period_end<>p.cutover_date or profile.organization_id<>b.organization_id
      or profile.jurisdiction_code<>'EG' or profile.effective_from>p.cutover_date or a.organization_id<>b.organization_id or a.is_archived
      or x.designated_account_id<>case when x.direction='output' then profile.output_vat_account_id else profile.input_vat_account_id end
      or (x.direction='output' and (a.type<>'liability' or a.normal_balance<>'credit'))
      or (x.direction='input' and (a.type<>'asset' or a.normal_balance<>'debit')));
  if invalid_count>0 then errors:=errors||jsonb_build_array('MIGRATION_TAX_SCOPE_VIOLATION'); end if;
  for r in select designated_account_id account_id,sum(balance_minor)::bigint amount,direction from public.migration_tax_openings where batch_id=b.id group by designated_account_id,direction
  loop actual:=app.migration_gl_balance(b.organization_id,r.account_id,p.cutover_date); variances:=variances||jsonb_build_array(jsonb_build_object('module','approved_egypt_vat_'||r.direction::text,'account_id',r.account_id,'detail_minor',r.amount::text,'gl_minor',actual::text,'variance_minor',(actual-r.amount)::text));
    if actual is distinct from r.amount then errors:=errors||jsonb_build_array('MIGRATION_TAX_GL_VARIANCE'); end if; end loop;
  return jsonb_build_object('valid',jsonb_array_length(errors)=0,'batch_id',b.id,'project_id',b.project_id,'cutover_date',p.cutover_date,
    'opening_balance_batch_id',p.opening_balance_batch_id,'opening_transaction_id',o.posted_transaction_id,'applicability',jsonb_build_object(
      'open_items',b.open_items_applicable,'assets',b.assets_applicable,'bank',b.bank_applicable,'inventory',b.inventory_applicable,'tax',b.tax_applicable),
    'variances',variances,'errors',errors,'ledger_digest',app.migration_ledger_digest(b.organization_id),'gl_effect','none','control_boundary','opening_trial_balance');
end; $$;

create function public.validate_migration_operational_cutover(p_batch_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.migration_operational_batches%rowtype; result jsonb;
begin
  select * into b from public.migration_operational_batches where id=p_batch_id for update;
  if not found then raise exception 'MIGRATION_OPERATIONAL_BATCH_NOT_FOUND' using errcode='42501'; end if;
  perform app.require_capability(b.organization_id,'migrations.review');
  if b.status='accepted' then return b.validation_result; end if;
  result:=app.compute_migration_operational_validation(p_batch_id);
  perform set_config('app.migration_operational_authorized','on',true);
  update public.migration_operational_batches set status=case when (result->>'valid')::boolean
      then 'validated'::public.migration_operational_status
      else 'invalid'::public.migration_operational_status end,
    validation_result=result,validated_by=auth.uid(),validated_at=now() where id=p_batch_id;
  perform set_config('app.migration_operational_authorized','',true);
  insert into public.migration_operational_validation_runs(batch_id,organization_id,result,validated_by) values(p_batch_id,b.organization_id,result,auth.uid());
  perform app.write_audit(b.organization_id,'migration_operational.validated','migration_operational_batch',p_batch_id,null,result);
  return result;
end; $$;

create function public.accept_migration_operational_cutover(p_batch_id uuid,p_idempotency_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare b public.migration_operational_batches%rowtype; result jsonb; digest_before text; digest_after text;
begin
  select * into b from public.migration_operational_batches where id=p_batch_id for update;
  if not found then raise exception 'MIGRATION_OPERATIONAL_BATCH_NOT_FOUND' using errcode='42501'; end if;
  perform app.require_capability(b.organization_id,'migrations.review');
  if nullif(btrim(p_idempotency_key),'') is null then raise exception 'MIGRATION_ACCEPTANCE_KEY_REQUIRED' using errcode='22023'; end if;
  if b.status='accepted' then if b.acceptance_idempotency_key=btrim(p_idempotency_key) then return b.id; end if; raise exception 'MIGRATION_IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
  if exists(select 1 from public.migration_operational_batches x where x.project_id=b.project_id and x.status='accepted') then raise exception 'MIGRATION_PROJECT_LOCKED: accepted cutover evidence is immutable' using errcode='55000'; end if;
  result:=app.compute_migration_operational_validation(p_batch_id);
  if not (result->>'valid')::boolean then raise exception 'MIGRATION_OPERATIONAL_VALIDATION_FAILED: %',result using errcode='23514'; end if;
  digest_before:=app.migration_ledger_digest(b.organization_id);
  perform set_config('app.migration_operational_authorized','on',true);
  update public.migration_operational_batches set status='accepted',validation_result=result,validated_by=auth.uid(),validated_at=now(),
    acceptance_idempotency_key=btrim(p_idempotency_key),accepted_by=auth.uid(),accepted_at=now() where id=b.id;
  perform set_config('app.migration_operational_authorized','',true);
  digest_after:=app.migration_ledger_digest(b.organization_id);
  if digest_after<>digest_before then raise exception 'MIGRATION_DUPLICATE_GL_EFFECT' using errcode='23514'; end if;
  perform app.write_audit(b.organization_id,'migration_operational.accepted','migration_operational_batch',b.id,null,
    result||jsonb_build_object('ledger_digest_before',digest_before,'ledger_digest_after',digest_after));
  return b.id;
end; $$;

create function public.read_migration_operational_cutover(p_batch_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare b public.migration_operational_batches%rowtype;
begin
  select * into b from public.migration_operational_batches where id=p_batch_id;
  if not found then raise exception 'MIGRATION_OPERATIONAL_BATCH_NOT_FOUND' using errcode='42501'; end if;
  perform app.require_capability(b.organization_id,'migrations.read');
  return jsonb_build_object('batch',to_jsonb(b),
    'assets',coalesce((select jsonb_agg(to_jsonb(x) order by x.asset_code) from public.migration_asset_openings x where x.batch_id=b.id),'[]'),
    'bank_positions',coalesce((select jsonb_agg(to_jsonb(x) order by x.bank_account_id) from public.migration_bank_positions x where x.batch_id=b.id),'[]'),
    'bank_outstanding_items',coalesce((select jsonb_agg(to_jsonb(x) order by x.transaction_date,x.id) from public.migration_bank_outstanding_items x where x.batch_id=b.id),'[]'),
    'inventory',coalesce((select jsonb_agg(to_jsonb(x) order by x.source_key) from public.migration_inventory_openings x where x.batch_id=b.id),'[]'),
    'tax',coalesce((select jsonb_agg(to_jsonb(x) order by x.direction) from public.migration_tax_openings x where x.batch_id=b.id),'[]'),
    'validation_runs',coalesce((select jsonb_agg(to_jsonb(x) order by x.validated_at,x.id) from public.migration_operational_validation_runs x where x.batch_id=b.id),'[]'));
end; $$;

-- Accepted operational detail and its single opening journal form one immutable
-- cutover.  Later changes use the asset, bank, inventory, and VAT contracts.
create function app.guard_accepted_operational_project() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.migration_operational_batches b where b.project_id=old.id and b.status='accepted') then
    raise exception 'MIGRATION_CUTOVER_LOCKED: accepted operational evidence is immutable' using errcode='55000'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;
create trigger migration_projects_operational_guard before update or delete on public.migration_projects for each row execute function app.guard_accepted_operational_project();
create function app.guard_open_items_after_operational_acceptance() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.migration_operational_batches b where b.project_id=new.project_id and b.status='accepted') then
    raise exception 'MIGRATION_CUTOVER_LOCKED: accepted operational applicability is immutable' using errcode='55000'; end if;
  return new;
end; $$;
create trigger migration_open_batches_operational_guard before insert on public.migration_open_item_batches for each row execute function app.guard_open_items_after_operational_acceptance();
create function app.guard_operational_opening_reversal() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status='posted' and new.status='reversed' and exists(select 1 from public.migration_projects p join public.migration_operational_batches b on b.project_id=p.id where p.opening_balance_batch_id=old.id and b.status='accepted') then
    raise exception 'MIGRATION_CUTOVER_LOCKED: accepted operational evidence requires a reviewed replacement cutover' using errcode='55000'; end if;
  return new;
end; $$;
create trigger opening_batches_operational_guard before update on public.opening_balance_batches for each row execute function app.guard_operational_opening_reversal();

revoke all on function public.stage_migration_operational_cutover(uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,text),
  public.validate_migration_operational_cutover(uuid),public.accept_migration_operational_cutover(uuid,text),
  public.read_migration_operational_cutover(uuid) from public,anon;
grant execute on function public.stage_migration_operational_cutover(uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,text),
  public.validate_migration_operational_cutover(uuid),public.accept_migration_operational_cutover(uuid,text),
  public.read_migration_operational_cutover(uuid) to authenticated,service_role;
revoke all on function app.guard_migration_operational_batch_change(),app.migration_gl_balance(uuid,uuid,date),
  app.migration_ledger_digest(uuid),app.compute_migration_operational_validation(uuid),app.guard_accepted_operational_project(),
  app.guard_open_items_after_operational_acceptance(),app.guard_operational_opening_reversal() from public,anon,authenticated;
