-- V2-IMP-006: controlled opening Trial Balance migration.
-- Source rows remain independent audit evidence. Only an approved, exactly
-- balanced batch reaches the shared ledger; no balancing plug is generated.

create type public.opening_migration_mode as enum ('year_start', 'midyear');
create type public.opening_batch_status as enum (
  'draft', 'invalid', 'validated', 'posted', 'reversed'
);

create table public.opening_balance_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  migration_mode public.opening_migration_mode not null,
  cutoff_date date not null,
  status public.opening_batch_status not null default 'draft',
  revision integer not null default 1 check (revision > 0),
  source_filename text not null check (char_length(btrim(source_filename)) between 1 and 255),
  validation_result jsonb,
  validated_at timestamptz,
  posted_transaction_id uuid,
  reversal_transaction_id uuid,
  correction_reason text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  corrected_by uuid references public.profiles(id) on delete restrict,
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opening_batch_id_org_unique unique(id, organization_id),
  constraint opening_batch_posted_transaction_org
    foreign key (posted_transaction_id, organization_id)
    references public.transactions(id, organization_id) on delete restrict,
  constraint opening_batch_reversal_transaction_org
    foreign key (reversal_transaction_id, organization_id)
    references public.transactions(id, organization_id) on delete restrict,
  constraint opening_batch_posted_state check (
    (status in ('posted', 'reversed') and posted_transaction_id is not null
      and approved_by is not null and approved_at is not null)
    or (status not in ('posted', 'reversed') and posted_transaction_id is null
      and approved_by is null and approved_at is null)
  ),
  constraint opening_batch_reversal_state check (
    (status = 'reversed' and reversal_transaction_id is not null
      and corrected_by is not null and corrected_at is not null
      and nullif(btrim(correction_reason), '') is not null)
    or (status <> 'reversed' and reversal_transaction_id is null
      and corrected_by is null and corrected_at is null and correction_reason is null)
  )
);

create unique index opening_balance_accepted_boundary_idx
  on public.opening_balance_batches (organization_id, migration_mode, cutoff_date)
  where posted_transaction_id is not null;
create index opening_balance_batches_history_idx
  on public.opening_balance_batches (organization_id, created_at desc);

create table public.opening_balance_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.opening_balance_batches(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  source_row integer not null check (source_row > 0),
  source_code text,
  source_name text,
  original_debit text not null default '',
  original_credit text not null default '',
  debit_minor bigint,
  credit_minor bigint,
  mapped_account_id uuid,
  validation_errors jsonb not null default '[]'::jsonb,
  constraint opening_row_batch_same_org
    foreign key (batch_id, organization_id)
    references public.opening_balance_batches(id, organization_id) on delete cascade,
  unique (batch_id, source_row)
);
create index opening_balance_rows_batch_idx on public.opening_balance_rows(batch_id, source_row);

comment on table public.opening_balance_batches is
  'Controlled opening Trial Balance batches. Posted evidence is immutable; correction is a linked reversal.';
comment on table public.opening_balance_rows is
  'Original imported source identity and Debit/Credit text plus explicit reviewed Ledger mapping.';

insert into public.capabilities(key, domain, description) values
  ('opening_balances.read', 'opening_balances', 'Review opening-balance migration batches'),
  ('opening_balances.manage', 'opening_balances', 'Create, import, map, and validate draft opening batches'),
  ('opening_balances.approve', 'opening_balances', 'Explicitly approve and post a valid opening batch'),
  ('opening_balances.correct', 'opening_balances', 'Reverse a posted opening batch with a reason')
on conflict (key) do nothing;

insert into public.role_capabilities(role, capability_key)
select role, capability from (values
  ('owner'::public.organization_role, 'opening_balances.read'),
  ('owner'::public.organization_role, 'opening_balances.manage'),
  ('owner'::public.organization_role, 'opening_balances.approve'),
  ('owner'::public.organization_role, 'opening_balances.correct'),
  ('admin'::public.organization_role, 'opening_balances.read'),
  ('admin'::public.organization_role, 'opening_balances.manage'),
  ('admin'::public.organization_role, 'opening_balances.approve'),
  ('admin'::public.organization_role, 'opening_balances.correct'),
  ('accountant'::public.organization_role, 'opening_balances.read'),
  ('accountant'::public.organization_role, 'opening_balances.manage'),
  ('accountant'::public.organization_role, 'opening_balances.approve'),
  ('accountant'::public.organization_role, 'opening_balances.correct')
) defaults(role, capability) on conflict do nothing;

alter table public.opening_balance_batches enable row level security;
alter table public.opening_balance_rows enable row level security;
create policy "opening batches visible to authorized members"
  on public.opening_balance_batches for select to authenticated
  using (app.has_capability(organization_id, 'opening_balances.read'));
create policy "opening rows visible to authorized members"
  on public.opening_balance_rows for select to authenticated
  using (app.has_capability(organization_id, 'opening_balances.read'));
grant select on public.opening_balance_batches, public.opening_balance_rows to authenticated;

create or replace function app.parse_opening_amount(p_value text, p_currency char(3))
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare v_value text := btrim(coalesce(p_value, '')); v_unit smallint; v_scaled numeric;
begin
  if v_value = '' then return 0; end if;
  if v_value !~ '^[0-9]+([.][0-9]+)?$' then return null; end if;
  v_unit := app.currency_minor_unit(p_currency);
  if split_part(v_value, '.', 2) <> '' and char_length(split_part(v_value, '.', 2)) > v_unit then return null; end if;
  v_scaled := v_value::numeric * power(10::numeric, v_unit);
  if v_scaled <> trunc(v_scaled) or v_scaled > 9223372036854775807 then return null; end if;
  return v_scaled::bigint;
exception when others then return null;
end;
$$;

create or replace function app.reject_posted_opening_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status public.opening_batch_status;
begin
  if coalesce(current_setting('app.opening_correction_authorized', true), '') = 'on' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_table_name = 'opening_balance_batches' then v_status := old.status;
  else select status into v_status from public.opening_balance_batches where id = old.batch_id; end if;
  if v_status in ('posted', 'reversed') then
    raise exception 'OPENING_BATCH_LOCKED: posted opening evidence is immutable' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
create trigger opening_batches_immutable after update or delete on public.opening_balance_batches
  for each row execute function app.reject_posted_opening_change();
create trigger opening_rows_immutable before update or delete on public.opening_balance_rows
  for each row execute function app.reject_posted_opening_change();

create or replace function app.replace_opening_rows(
  p_batch public.opening_balance_batches, p_rows jsonb
) returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_row jsonb; v_currency char(3); v_number integer; v_debit text; v_credit text; v_account uuid;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'OPENING_ROWS_REQUIRED' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 10000 then raise exception 'OPENING_ROW_LIMIT_EXCEEDED' using errcode = '22023'; end if;
  v_currency := app.org_base_currency(p_batch.organization_id);
  delete from public.opening_balance_rows where batch_id = p_batch.id;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_number := coalesce((v_row->>'source_row')::integer,
      (select coalesce(max(source_row),0)+1 from public.opening_balance_rows where batch_id=p_batch.id));
    v_debit := coalesce(v_row->>'debit', ''); v_credit := coalesce(v_row->>'credit', '');
    begin v_account := nullif(v_row->>'account_id','')::uuid; exception when others then v_account := null; end;
    insert into public.opening_balance_rows(
      batch_id, organization_id, source_row, source_code, source_name,
      original_debit, original_credit, debit_minor, credit_minor, mapped_account_id
    ) values (
      p_batch.id, p_batch.organization_id, v_number,
      nullif(btrim(v_row->>'source_code'),''), nullif(btrim(v_row->>'source_name'),''),
      v_debit, v_credit, app.parse_opening_amount(v_debit, v_currency),
      app.parse_opening_amount(v_credit, v_currency), v_account
    );
  end loop;
end;
$$;

create or replace function public.create_opening_balance_batch(
  p_organization_id uuid, p_migration_mode public.opening_migration_mode,
  p_cutoff_date date, p_source_filename text, p_rows jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_batch public.opening_balance_batches%rowtype;
begin
  perform app.require_capability(p_organization_id, 'opening_balances.manage');
  if p_cutoff_date is null or not isfinite(p_cutoff_date) then raise exception 'OPENING_CUTOFF_INVALID' using errcode='22023'; end if;
  if nullif(btrim(p_source_filename),'') is null or lower(p_source_filename) not like '%.csv' then
    raise exception 'OPENING_FILE_INVALID' using errcode='22023';
  end if;
  insert into public.opening_balance_batches(
    organization_id,migration_mode,cutoff_date,source_filename,created_by
  ) values (p_organization_id,p_migration_mode,p_cutoff_date,btrim(p_source_filename),auth.uid())
  returning * into v_batch;
  perform app.replace_opening_rows(v_batch,p_rows);
  perform app.write_audit(p_organization_id,'opening_batch.created','opening_balance_batch',v_batch.id,
    null,jsonb_build_object('mode',p_migration_mode,'cutoff_date',p_cutoff_date,'rows',jsonb_array_length(p_rows)));
  return v_batch.id;
end;
$$;

create or replace function public.update_opening_balance_batch(
  p_batch_id uuid, p_migration_mode public.opening_migration_mode,
  p_cutoff_date date, p_source_filename text, p_rows jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_batch public.opening_balance_batches%rowtype;
begin
  select * into v_batch from public.opening_balance_batches where id=p_batch_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: opening batch not found' using errcode='42501'; end if;
  perform app.require_capability(v_batch.organization_id,'opening_balances.manage');
  if v_batch.status in ('posted','reversed') then raise exception 'OPENING_BATCH_LOCKED: posted opening evidence is immutable' using errcode='55000'; end if;
  if p_cutoff_date is null or not isfinite(p_cutoff_date) then raise exception 'OPENING_CUTOFF_INVALID' using errcode='22023'; end if;
  if nullif(btrim(p_source_filename),'') is null or lower(p_source_filename) not like '%.csv' then
    raise exception 'OPENING_FILE_INVALID' using errcode='22023';
  end if;
  update public.opening_balance_batches set migration_mode=p_migration_mode,cutoff_date=p_cutoff_date,
    source_filename=btrim(p_source_filename),status='draft',revision=revision+1,
    validation_result=null,validated_at=null,updated_at=now() where id=p_batch_id returning * into v_batch;
  perform app.replace_opening_rows(v_batch,p_rows);
  return p_batch_id;
end;
$$;

create or replace function app.compute_opening_validation(p_batch_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_batch public.opening_balance_batches%rowtype; v_row public.opening_balance_rows%rowtype;
  v_account public.accounts%rowtype; v_base char(3); v_errors jsonb := '[]'; v_row_errors jsonb;
  v_rows jsonb := '[]'; v_preview jsonb := '[]'; v_debit bigint := 0; v_credit bigint := 0;
  v_valid_count integer := 0; v_zero_count integer := 0; v_fy_start date; v_fy_end date;
begin
  select * into v_batch from public.opening_balance_batches where id=p_batch_id;
  if not found then raise exception 'TENANT_ACCESS_DENIED: opening batch not found' using errcode='42501'; end if;
  v_base := app.org_base_currency(v_batch.organization_id);
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
    v_row_errors := '[]'; v_account := null;
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
        if v_account.account_role='control' then v_row_errors:=v_row_errors||jsonb_build_array('ACCOUNT_CONTROL_NOT_DIRECTLY_POSTABLE'); end if;
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
  return jsonb_build_object(
    'valid',jsonb_array_length(v_errors)=0,'mode',v_batch.migration_mode,'cutoff_date',v_batch.cutoff_date,
    'currency',v_base,'debit_total_minor',v_debit,'credit_total_minor',v_credit,
    'difference_minor',v_debit-v_credit,'valid_row_count',v_valid_count,'zero_row_count',v_zero_count,
    'errors',v_errors,'rows',v_rows,'preview',v_preview);
end;
$$;

create or replace function public.validate_opening_balance_batch(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch public.opening_balance_batches%rowtype; v_result jsonb;
begin
  select * into v_batch from public.opening_balance_batches where id=p_batch_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: opening batch not found' using errcode='42501'; end if;
  perform app.require_capability(v_batch.organization_id,'opening_balances.manage');
  if v_batch.status in ('posted','reversed') then return v_batch.validation_result; end if;
  v_result:=app.compute_opening_validation(p_batch_id);
  update public.opening_balance_batches set status=(case when (v_result->>'valid')::boolean then 'validated' else 'invalid' end)::public.opening_batch_status,
    validation_result=v_result,validated_at=now(),updated_at=now() where id=p_batch_id;
  return v_result;
end;
$$;

create or replace function public.approve_opening_balance_batch(p_batch_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_batch public.opening_balance_batches%rowtype; v_result jsonb; v_lines jsonb; v_transaction uuid; v_existing uuid;
begin
  select * into v_batch from public.opening_balance_batches where id=p_batch_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: opening batch not found' using errcode='42501'; end if;
  perform app.require_capability(v_batch.organization_id,'opening_balances.approve');
  if v_batch.posted_transaction_id is not null then return v_batch.posted_transaction_id; end if;
  -- compute_opening_validation acquires the same organization-settings lock as period close/post.
  v_result:=app.compute_opening_validation(p_batch_id);
  if not (v_result->>'valid')::boolean then raise exception 'OPENING_VALIDATION_FAILED: %',v_result using errcode='23514'; end if;
  select posted_transaction_id into v_existing from public.opening_balance_batches
    where organization_id=v_batch.organization_id and migration_mode=v_batch.migration_mode
      and cutoff_date=v_batch.cutoff_date and posted_transaction_id is not null for update;
  if found then raise exception 'OPENING_BOUNDARY_ALREADY_POSTED' using errcode='23505'; end if;
  select jsonb_agg(jsonb_build_object('account_id',item->>'account_id','side',
      case when (item->>'debit_minor')::bigint>0 then 'debit' else 'credit' end,
      'amount_minor',greatest((item->>'debit_minor')::bigint,(item->>'credit_minor')::bigint),
      'memo','Opening Trial Balance row')) into v_lines
  from jsonb_array_elements(v_result->'preview') item;
  v_transaction:=app.create_and_post(
    p_organization_id=>v_batch.organization_id,p_type=>'opening_balance',p_transaction_date=>v_batch.cutoff_date,
    p_lines=>v_lines,p_currency_code=>app.org_base_currency(v_batch.organization_id),
    p_description=>'Opening Trial Balance as of '||v_batch.cutoff_date::text,
    p_reference=>'OPENING-'||v_batch.id::text,p_source=>'opening_balance',
    p_idempotency_key=>'opening-batch:'||v_batch.id::text,
    p_metadata=>jsonb_build_object('opening_batch_id',v_batch.id,'migration_mode',v_batch.migration_mode,'revision',v_batch.revision));
  update public.opening_balance_batches set status='posted',validation_result=v_result,validated_at=now(),
    posted_transaction_id=v_transaction,approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=p_batch_id;
  perform app.write_audit(v_batch.organization_id,'opening_batch.posted','opening_balance_batch',v_batch.id,
    null,jsonb_build_object('transaction_id',v_transaction,'mode',v_batch.migration_mode,'cutoff_date',v_batch.cutoff_date));
  return v_transaction;
end;
$$;

create or replace function public.reverse_opening_balance_batch(
  p_batch_id uuid, p_reason text, p_reversal_date date default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_batch public.opening_balance_batches%rowtype; v_reversal uuid;
begin
  select * into v_batch from public.opening_balance_batches where id=p_batch_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: opening batch not found' using errcode='42501'; end if;
  perform app.require_capability(v_batch.organization_id,'opening_balances.correct');
  if nullif(btrim(p_reason),'') is null then raise exception 'OPENING_CORRECTION_REASON_REQUIRED' using errcode='22023'; end if;
  if v_batch.status='reversed' then return v_batch.reversal_transaction_id; end if;
  if v_batch.status<>'posted' then raise exception 'OPENING_BATCH_NOT_POSTED' using errcode='23514'; end if;
  v_reversal:=public.reverse_transaction(v_batch.posted_transaction_id,btrim(p_reason),p_reversal_date);
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

-- The legacy single-balance pathway is deliberately retained as a rejecting
-- compatibility signature so old clients receive an explicit upgrade error.
create or replace function public.post_opening_balance(
  p_organization_id uuid, p_as_of_date date, p_balances jsonb,
  p_notes text default null, p_idempotency_key text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_capability(p_organization_id,'transactions.adjust');
  raise exception 'OPENING_BATCH_REQUIRED: use the controlled Opening Trial Balance workflow' using errcode='0A000';
end;
$$;
comment on function public.post_opening_balance(uuid,date,jsonb,text,text) is
  'Deprecated compatibility signature. Authenticated use is rejected; opening balances require a validated approved batch.';

revoke all on function public.create_opening_balance_batch(uuid,public.opening_migration_mode,date,text,jsonb),
  public.update_opening_balance_batch(uuid,public.opening_migration_mode,date,text,jsonb),
  public.validate_opening_balance_batch(uuid), public.approve_opening_balance_batch(uuid),
  public.reverse_opening_balance_batch(uuid,text,date) from public, anon;
grant execute on function public.create_opening_balance_batch(uuid,public.opening_migration_mode,date,text,jsonb),
  public.update_opening_balance_batch(uuid,public.opening_migration_mode,date,text,jsonb),
  public.validate_opening_balance_batch(uuid), public.approve_opening_balance_batch(uuid),
  public.reverse_opening_balance_batch(uuid,text,date) to authenticated, service_role;
revoke all on function app.parse_opening_amount(text,char),
  app.replace_opening_rows(public.opening_balance_batches,jsonb), app.compute_opening_validation(uuid) from public,anon,authenticated;
