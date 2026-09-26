-- V2-IMP-012 / approved V2-D10: controlled financial dimensions and allocations.
-- Existing transaction_entries.dimensions JSON is preserved as legacy evidence, but
-- is never interpreted as a controlled assignment.

create type public.accounting_dimension_kind as enum ('cost_center','project');
create type public.dimension_value_status as enum ('active','inactive');
create type public.dimension_requirement as enum ('optional','required');

create table public.accounting_dimension_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  kind public.accounting_dimension_kind not null,
  code text not null check(char_length(btrim(code)) between 1 and 50),
  name text not null check(char_length(btrim(name)) between 1 and 160),
  description text check(description is null or char_length(description)<=500),
  status public.dimension_value_status not null default 'active',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default clock_timestamp(),
  archived_by uuid references public.profiles(id) on delete restrict,
  archived_at timestamptz,
  unique(id,organization_id),
  check((status='inactive')=(archived_at is not null and archived_by is not null))
);
create unique index accounting_dimension_values_code
  on public.accounting_dimension_values(organization_id,kind,lower(code));

create table public.account_dimension_policies (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  account_id uuid not null,
  kind public.accounting_dimension_kind not null,
  requirement public.dimension_requirement not null default 'optional',
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(account_id,kind),
  foreign key(account_id,organization_id) references public.accounts(id,organization_id) on delete restrict
);

create table public.transaction_entry_dimension_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  entry_id uuid not null,
  dimension_value_id uuid not null,
  kind public.accounting_dimension_kind not null,
  amount_minor bigint not null check(amount_minor>0),
  base_amount_minor bigint not null check(base_amount_minor>0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  unique(id,organization_id),
  unique(entry_id,dimension_value_id),
  foreign key(entry_id,organization_id) references public.transaction_entries(id,organization_id) on delete cascade,
  foreign key(dimension_value_id,organization_id) references public.accounting_dimension_values(id,organization_id) on delete restrict
);
create index transaction_entry_dimension_allocations_report
  on public.transaction_entry_dimension_allocations(organization_id,kind,dimension_value_id,entry_id);

create table public.dimension_value_requests (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  request_id uuid not null,
  operation text not null check(operation in ('create','update','archive')),
  dimension_value_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(organization_id,request_id),
  foreign key(dimension_value_id,organization_id) references public.accounting_dimension_values(id,organization_id) on delete restrict
);

insert into public.capabilities(key,domain,description,description_ar) values
 ('dimensions.read','dimensions','Read accounting dimensions, policies, allocations, and reports','عرض الأبعاد المحاسبية وسياساتها وتوزيعاتها وتقاريرها'),
 ('dimensions.manage','dimensions','Create, edit, and archive controlled accounting dimension values','إنشاء قيم الأبعاد المحاسبية وتعديلها وأرشفتها'),
 ('dimensions.configure','dimensions','Configure optional or required dimensions by posting account','ضبط الأبعاد الاختيارية أو المطلوبة حسب حساب الترحيل'),
 ('dimensions.allocate','dimensions','Allocate draft journal lines to controlled accounting dimensions','توزيع بنود القيود المسودة على أبعاد محاسبية مضبوطة')
on conflict(key) do update set description=excluded.description,description_ar=excluded.description_ar;
insert into public.role_capabilities(role,capability_key)
select r.role::public.organization_role,c.key from (values('owner'),('admin'),('accountant')) r(role)
cross join public.capabilities c where c.domain='dimensions' on conflict do nothing;
insert into public.role_capabilities(role,capability_key)
values('viewer','dimensions.read') on conflict do nothing;

alter table public.accounting_dimension_values enable row level security;
alter table public.account_dimension_policies enable row level security;
alter table public.transaction_entry_dimension_allocations enable row level security;
alter table public.dimension_value_requests enable row level security;
create policy dimension_values_read on public.accounting_dimension_values for select to authenticated
  using(app.has_capability(organization_id,'dimensions.read'));
create policy dimension_policies_read on public.account_dimension_policies for select to authenticated
  using(app.has_capability(organization_id,'dimensions.read'));
create policy dimension_allocations_read on public.transaction_entry_dimension_allocations for select to authenticated
  using(app.has_capability(organization_id,'dimensions.read'));
create policy dimension_requests_read on public.dimension_value_requests for select to authenticated
  using(app.has_capability(organization_id,'dimensions.read'));
revoke all on public.accounting_dimension_values,public.account_dimension_policies,
  public.transaction_entry_dimension_allocations,public.dimension_value_requests from public,anon,authenticated;
grant select on public.accounting_dimension_values,public.account_dimension_policies,
  public.transaction_entry_dimension_allocations to authenticated;

create function app.guard_dimension_allocation()
returns trigger language plpgsql set search_path='' as $$
declare v_entry_id uuid:=case when tg_op='DELETE' then old.entry_id else new.entry_id end;
begin
  if exists(select 1 from public.transaction_entries e where e.id=v_entry_id and e.posted_at is not null) then
    raise exception 'POSTED_DIMENSIONS_IMMUTABLE' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
create trigger guard_dimension_allocation before update or delete on public.transaction_entry_dimension_allocations
for each row execute function app.guard_dimension_allocation();

create function app.assert_entry_dimensions(p_entry_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare e public.transaction_entries%rowtype; k public.accounting_dimension_kind; total_amount bigint;
  total_base bigint; required public.dimension_requirement; v_source public.transaction_source;
begin
  select * into e from public.transaction_entries where id=p_entry_id;
  if not found then raise exception 'DIMENSION_ENTRY_NOT_FOUND' using errcode='23503'; end if;
  select t.source into v_source from public.transactions t where t.id=e.transaction_id;
  foreach k in array array['cost_center','project']::public.accounting_dimension_kind[] loop
    select coalesce(sum(a.amount_minor),0),coalesce(sum(a.base_amount_minor),0)
      into total_amount,total_base
    from public.transaction_entry_dimension_allocations a where a.entry_id=e.id and a.kind=k;
    select coalesce(p.requirement,'optional') into required
    from (select 1) seed left join public.account_dimension_policies p
      on p.account_id=e.account_id and p.organization_id=e.organization_id and p.kind=k;
    if required='required' and total_amount=0 and v_source<>'reversal' then
      raise exception 'DIMENSION_REQUIRED: % is required for account %',k,e.account_id using errcode='23514';
    end if;
    if total_amount<>0 and (total_amount<>e.amount_minor or total_base<>e.base_amount_minor) then
      raise exception 'DIMENSION_ALLOCATION_MISMATCH: % allocation must equal journal line',k using errcode='23514';
    end if;
    if v_source<>'reversal' and exists(select 1 from public.transaction_entry_dimension_allocations a
      join public.accounting_dimension_values v on v.id=a.dimension_value_id
      where a.entry_id=e.id and a.kind=k and (v.status<>'active' or v.kind<>a.kind)) then
      raise exception 'DIMENSION_VALUE_INACTIVE_OR_INVALID: %',k using errcode='23514';
    end if;
  end loop;
end; $$;

create function app.copy_reversal_dimensions()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_original uuid;
begin
  select t.reverses_transaction_id into v_original from public.transactions t
  where t.id=new.transaction_id and t.source='reversal';
  if v_original is null then return new; end if;
  insert into public.transaction_entry_dimension_allocations
    (organization_id,entry_id,dimension_value_id,kind,amount_minor,base_amount_minor,created_by)
  select new.organization_id,new.id,a.dimension_value_id,a.kind,a.amount_minor,a.base_amount_minor,auth.uid()
  from public.transaction_entries original
  join public.transaction_entry_dimension_allocations a on a.entry_id=original.id
  where original.transaction_id=v_original and original.entry_index=new.entry_index;
  return new;
end; $$;
create trigger copy_reversal_dimensions after insert on public.transaction_entries
for each row execute function app.copy_reversal_dimensions();

create function app.attach_dimension_allocations(p_entry_id uuid,p_allocations jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare e public.transaction_entries%rowtype; item jsonb; value public.accounting_dimension_values%rowtype;
  amount bigint; base_amount bigint;
begin
  if p_allocations is null or p_allocations='null'::jsonb or p_allocations='[]'::jsonb then return; end if;
  if jsonb_typeof(p_allocations)<>'array' then raise exception 'DIMENSION_ALLOCATIONS_INVALID' using errcode='22023'; end if;
  select * into e from public.transaction_entries where id=p_entry_id and posted_at is null for update;
  if not found then raise exception 'DIMENSION_DRAFT_ENTRY_REQUIRED' using errcode='23514'; end if;
  for item in select * from jsonb_array_elements(p_allocations) loop
    if item->>'dimension_value_id' is null or (item->>'amount_minor')!~'^[1-9][0-9]*$'
      or (item->>'base_amount_minor')!~'^[1-9][0-9]*$' then
      raise exception 'DIMENSION_ALLOCATIONS_INVALID' using errcode='22023';
    end if;
    select * into value from public.accounting_dimension_values
      where id=(item->>'dimension_value_id')::uuid and organization_id=e.organization_id and status='active';
    if not found then raise exception 'DIMENSION_VALUE_INACTIVE_OR_INVALID' using errcode='23514'; end if;
    amount:=(item->>'amount_minor')::bigint; base_amount:=(item->>'base_amount_minor')::bigint;
    insert into public.transaction_entry_dimension_allocations
      (organization_id,entry_id,dimension_value_id,kind,amount_minor,base_amount_minor,created_by)
    values(e.organization_id,e.id,value.id,value.kind,amount,base_amount,auth.uid());
  end loop;
  perform app.assert_entry_dimensions(e.id);
end; $$;

create function app.validate_dimensions_before_post()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.posted_at is null and new.posted_at is not null then perform app.assert_entry_dimensions(new.id); end if;
  return new;
end; $$;
create trigger validate_dimensions_before_post before update of posted_at on public.transaction_entries
for each row execute function app.validate_dimensions_before_post();
revoke all on function app.guard_dimension_allocation(),app.assert_entry_dimensions(uuid),
  app.attach_dimension_allocations(uuid,jsonb),app.validate_dimensions_before_post(),
  app.copy_reversal_dimensions() from public,anon,authenticated;

-- Preserve the latest idempotency implementation and add controlled allocations
-- from each input line. The raw legacy dimensions object is retained verbatim.
create or replace function public.create_draft_transaction(
  p_organization_id uuid,p_type public.transaction_type,p_transaction_date date,p_lines jsonb,
  p_currency_code char(3) default null,p_exchange_rate numeric default null,p_description text default null,
  p_reference text default null,p_counterparty_id uuid default null,p_category_id uuid default null,
  p_memo text default null,p_adjustment_reason text default null,p_source public.transaction_source default 'manual',
  p_idempotency_key text default null,p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_base_currency char(3);v_currency char(3);v_rate numeric;v_lines jsonb;v_txn_id uuid;
  v_line jsonb;v_raw jsonb;v_entry_id uuid;v_existing uuid;v_request_fingerprint text;
begin
  perform app.require_capability(p_organization_id,'transactions.create');
  v_base_currency:=app.org_base_currency(p_organization_id);v_currency:=coalesce(p_currency_code,v_base_currency);
  v_rate:=case when v_currency=v_base_currency then 1 else p_exchange_rate end;
  if p_idempotency_key is not null then
    v_request_fingerprint:=app.posting_request_fingerprint('draft',p_organization_id,p_type,p_transaction_date,p_lines,
      v_currency,v_rate,v_base_currency,p_description,p_reference,p_counterparty_id,p_category_id,p_memo,
      p_adjustment_reason,p_source,p_metadata);
    v_existing:=app.claim_posting_idempotency(p_organization_id,p_idempotency_key,'draft',v_request_fingerprint);
    if v_existing is not null then return v_existing; end if;
  end if;
  v_lines:=app.normalize_journal_lines(p_organization_id,p_lines,v_currency,v_rate);
  insert into public.transactions(organization_id,type,status,source,transaction_date,currency_code,exchange_rate,
    description,reference,memo,adjustment_reason,counterparty_id,category_id,idempotency_key,metadata,created_by)
  values(p_organization_id,p_type,'draft',p_source,p_transaction_date,v_currency,coalesce(v_rate,1),p_description,
    p_reference,p_memo,p_adjustment_reason,p_counterparty_id,p_category_id,p_idempotency_key,
    coalesce(p_metadata,'{}'::jsonb),auth.uid()) returning id into v_txn_id;
  for v_line in select * from jsonb_array_elements(v_lines) loop
    v_raw:=p_lines->((v_line->>'entry_index')::int);
    insert into public.transaction_entries(organization_id,transaction_id,account_id,entry_index,side,amount_minor,
      currency_code,base_amount_minor,exchange_rate,memo,dimensions)
    values(p_organization_id,v_txn_id,(v_line->>'account_id')::uuid,(v_line->>'entry_index')::smallint,
      (v_line->>'side')::public.entry_side,(v_line->>'amount_minor')::bigint,(v_line->>'currency_code')::char(3),
      (v_line->>'base_amount_minor')::bigint,(v_line->>'exchange_rate')::numeric,v_line->>'memo',
      case when jsonb_typeof(v_raw->'dimensions')='object' then v_raw->'dimensions' else '{}'::jsonb end)
    returning id into v_entry_id;
    perform app.attach_dimension_allocations(v_entry_id,v_raw->'allocations');
  end loop;
  perform app.write_audit(p_organization_id,'transaction.created','transaction',v_txn_id,null,
    jsonb_build_object('type',p_type,'status','draft'));
  if p_idempotency_key is not null then perform app.complete_posting_idempotency(p_organization_id,p_idempotency_key,
    'draft',v_request_fingerprint,v_txn_id); end if;
  return v_txn_id;
end; $$;

create function public.save_dimension_value(
  p_organization_id uuid,p_kind public.accounting_dimension_kind,p_code text,p_name text,
  p_description text,p_request_id uuid,p_dimension_value_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.accounting_dimension_values%rowtype;r public.dimension_value_requests%rowtype;
  payload jsonb;operation text:=case when p_dimension_value_id is null then 'create' else 'update' end;
begin
  perform app.require_capability(p_organization_id,'dimensions.manage');
  if auth.uid() is null or p_request_id is null or nullif(btrim(p_code),'') is null
    or nullif(btrim(p_name),'') is null or char_length(btrim(p_code))>50 or char_length(btrim(p_name))>160
    or (p_description is not null and char_length(p_description)>500) then
    raise exception 'DIMENSION_VALUE_INVALID' using errcode='22023'; end if;
  payload:=jsonb_build_object('kind',p_kind,'code',btrim(p_code),'name',btrim(p_name),'description',nullif(btrim(p_description),''),'value_id',p_dimension_value_id);
  perform pg_advisory_xact_lock(hashtextextended('dimension-value:'||p_organization_id::text||':'||p_request_id::text,0));
  select * into r from public.dimension_value_requests where organization_id=p_organization_id and request_id=p_request_id;
  if found then
    if r.operation=operation and r.payload=payload then return r.dimension_value_id; end if;
    raise exception 'DIMENSION_REQUEST_CONFLICT' using errcode='23505';
  end if;
  if p_dimension_value_id is null then
    insert into public.accounting_dimension_values(organization_id,kind,code,name,description,created_by,updated_by)
    values(p_organization_id,p_kind,btrim(p_code),btrim(p_name),nullif(btrim(p_description),''),auth.uid(),auth.uid()) returning * into v;
  else
    select * into v from public.accounting_dimension_values where id=p_dimension_value_id and organization_id=p_organization_id for update;
    if not found then raise exception 'TENANT_ACCESS_DENIED' using errcode='42501'; end if;
    if v.status<>'active' or v.kind<>p_kind then raise exception 'DIMENSION_VALUE_IMMUTABLE_KIND_OR_INACTIVE' using errcode='23514'; end if;
    update public.accounting_dimension_values set code=btrim(p_code),name=btrim(p_name),description=nullif(btrim(p_description),''),
      updated_by=auth.uid(),updated_at=clock_timestamp() where id=v.id returning * into v;
  end if;
  insert into public.dimension_value_requests values(p_organization_id,p_request_id,operation,v.id,payload,clock_timestamp());
  perform app.write_audit(p_organization_id,'dimension.value_'||operation,'accounting_dimension_value',v.id,null,payload);
  return v.id;
end; $$;

create function public.archive_dimension_value(p_organization_id uuid,p_dimension_value_id uuid,p_request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.accounting_dimension_values%rowtype;r public.dimension_value_requests%rowtype;
  payload jsonb:=jsonb_build_object('value_id',p_dimension_value_id);
begin
  perform app.require_capability(p_organization_id,'dimensions.manage');
  if auth.uid() is null or p_request_id is null then raise exception 'DIMENSION_VALUE_INVALID' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dimension-value:'||p_organization_id::text||':'||p_request_id::text,0));
  select * into r from public.dimension_value_requests where organization_id=p_organization_id and request_id=p_request_id;
  if found then
    if r.operation='archive' and r.payload=payload then return r.dimension_value_id; end if;
    raise exception 'DIMENSION_REQUEST_CONFLICT' using errcode='23505'; end if;
  select * into v from public.accounting_dimension_values where id=p_dimension_value_id and organization_id=p_organization_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED' using errcode='42501'; end if;
  if v.status='active' then update public.accounting_dimension_values set status='inactive',archived_by=auth.uid(),archived_at=clock_timestamp(),
    updated_by=auth.uid(),updated_at=clock_timestamp() where id=v.id; end if;
  insert into public.dimension_value_requests values(p_organization_id,p_request_id,'archive',v.id,payload,clock_timestamp());
  perform app.write_audit(p_organization_id,'dimension.value_archived','accounting_dimension_value',v.id,null,payload);
  return v.id;
end; $$;

create function public.set_account_dimension_policy(p_organization_id uuid,p_account_id uuid,
  p_kind public.accounting_dimension_kind,p_requirement public.dimension_requirement)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.accounts%rowtype;
begin
  perform app.require_capability(p_organization_id,'dimensions.configure');
  select * into a from public.accounts where id=p_account_id and organization_id=p_organization_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED' using errcode='42501'; end if;
  if a.is_archived or a.account_role='group' then raise exception 'DIMENSION_POLICY_ACCOUNT_INELIGIBLE' using errcode='23514'; end if;
  insert into public.account_dimension_policies(organization_id,account_id,kind,requirement,updated_by)
  values(p_organization_id,p_account_id,p_kind,p_requirement,auth.uid())
  on conflict(account_id,kind) do update set requirement=excluded.requirement,updated_by=auth.uid(),updated_at=clock_timestamp();
  perform app.write_audit(p_organization_id,'dimension.policy_changed','account',p_account_id,null,
    jsonb_build_object('kind',p_kind,'requirement',p_requirement));
  return p_account_id;
end; $$;

create function public.set_draft_entry_dimension_allocations(p_organization_id uuid,p_entry_id uuid,p_allocations jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.transaction_entries%rowtype;
begin
  perform app.require_capability(p_organization_id,'dimensions.allocate');
  select * into e from public.transaction_entries where id=p_entry_id and organization_id=p_organization_id and posted_at is null for update;
  if not found then raise exception 'DIMENSION_DRAFT_ENTRY_REQUIRED' using errcode='23514'; end if;
  delete from public.transaction_entry_dimension_allocations where entry_id=e.id;
  perform app.attach_dimension_allocations(e.id,p_allocations);
  perform app.write_audit(p_organization_id,'dimension.allocations_changed','transaction_entry',e.id,null,
    jsonb_build_object('allocations',coalesce(p_allocations,'[]'::jsonb)));
  return e.id;
end; $$;

create function public.read_dimension_workspace(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform app.require_capability(p_organization_id,'dimensions.read');
  select jsonb_build_object(
    'values',coalesce((select jsonb_agg(to_jsonb(v) order by v.kind,v.status,v.code) from public.accounting_dimension_values v where v.organization_id=p_organization_id),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'code',a.code,'name',a.name,'role',a.account_role,'archived',a.is_archived) order by a.code nulls last,a.name)
      from public.accounts a where a.organization_id=p_organization_id and a.account_role in ('posting','control')),'[]'::jsonb),
    'policies',coalesce((select jsonb_agg(to_jsonb(p) order by p.account_id,p.kind) from public.account_dimension_policies p where p.organization_id=p_organization_id),'[]'::jsonb),
    'legacy_uncontrolled_count',(select count(*) from public.transaction_entries e where e.organization_id=p_organization_id and e.dimensions<>'{}'::jsonb),
    'allocation_count',(select count(*) from public.transaction_entry_dimension_allocations a where a.organization_id=p_organization_id)
  ) into result;
  return result;
end; $$;

create function public.report_by_accounting_dimension(
  p_organization_id uuid,p_report_kind text,p_dimension_kind public.accounting_dimension_kind,
  p_from_date date,p_to_date date,p_dimension_value_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; invalid_value boolean;
begin
  perform app.require_capability(p_organization_id,'dimensions.read');
  perform app.require_capability(p_organization_id,'reports.read');
  if p_report_kind not in ('general_ledger','trial_balance','profit_loss','balance_sheet','cash_flow')
    or p_from_date is null or p_to_date is null or p_from_date>p_to_date then
    raise exception 'DIMENSION_REPORT_INVALID' using errcode='22023'; end if;
  if p_dimension_value_id is not null then
    select not exists(select 1 from public.accounting_dimension_values v where v.id=p_dimension_value_id
      and v.organization_id=p_organization_id and v.kind=p_dimension_kind) into invalid_value;
    if invalid_value then raise exception 'TENANT_ACCESS_DENIED' using errcode='42501'; end if;
  end if;
  with eligible as (
    select e.*,a.code account_code,a.name account_name,a.type account_type,t.description,t.reference,t.source
    from public.transaction_entries e join public.accounts a on a.id=e.account_id
    join public.transactions t on t.id=e.transaction_id
    where e.organization_id=p_organization_id and e.posted_at is not null and e.entry_date<=p_to_date
      and (p_report_kind in ('general_ledger','trial_balance')
        or (p_report_kind='profit_loss' and a.type in ('revenue','expense') and t.source<>'year_end_close')
        or (p_report_kind='balance_sheet' and a.type in ('asset','liability','equity'))
        or (p_report_kind='cash_flow' and e.id in (select d.entry_id from public.report_cash_flow_detail(p_organization_id,p_from_date,p_to_date) d)))
      and (p_report_kind in ('trial_balance','balance_sheet') or e.entry_date>=p_from_date)
  ), portions as (
    select e.*,x.dimension_value_id,x.amount_minor portion_amount,x.base_amount_minor portion_base
    from eligible e cross join lateral (
      select d.dimension_value_id,d.amount_minor,d.base_amount_minor
      from public.transaction_entry_dimension_allocations d where d.entry_id=e.id and d.kind=p_dimension_kind
      union all select null::uuid,e.amount_minor,e.base_amount_minor
      where not exists(select 1 from public.transaction_entry_dimension_allocations d where d.entry_id=e.id and d.kind=p_dimension_kind)
    ) x where p_dimension_value_id is null or x.dimension_value_id=p_dimension_value_id
  ), grouped_raw as (
    select p.dimension_value_id,coalesce(v.code,'UNASSIGNED') code,coalesce(v.name,'Unassigned') name,
      coalesce(sum(p.portion_base) filter(where p.entry_date<p_from_date and p.side='debit'),0)::bigint opening_debit,
      coalesce(sum(p.portion_base) filter(where p.entry_date<p_from_date and p.side='credit'),0)::bigint opening_credit,
      coalesce(sum(p.portion_base) filter(where p.entry_date>=p_from_date and p.side='debit'),0)::bigint period_debit,
      coalesce(sum(p.portion_base) filter(where p.entry_date>=p_from_date and p.side='credit'),0)::bigint period_credit,
      count(*) entry_count
    from portions p left join public.accounting_dimension_values v on v.id=p.dimension_value_id
    group by p.dimension_value_id,v.code,v.name
  ), grouped as (
    select * from grouped_raw
    union all
    select null::uuid,'UNASSIGNED','Unassigned',0::bigint,0::bigint,0::bigint,0::bigint,0::bigint
    where not exists(select 1 from grouped_raw where dimension_value_id is null)
  ), unfiltered as (
    select coalesce(sum(p.portion_base) filter(where p.entry_date<p_from_date and p.side='debit'),0)::bigint opening_debit,
      coalesce(sum(p.portion_base) filter(where p.entry_date<p_from_date and p.side='credit'),0)::bigint opening_credit,
      coalesce(sum(p.portion_base) filter(where p.entry_date>=p_from_date and p.side='debit'),0)::bigint period_debit,
      coalesce(sum(p.portion_base) filter(where p.entry_date>=p_from_date and p.side='credit'),0)::bigint period_credit
    from portions p
  ), totals as (
    select coalesce(sum(opening_debit),0)::bigint opening_debit,coalesce(sum(opening_credit),0)::bigint opening_credit,
      coalesce(sum(period_debit),0)::bigint period_debit,coalesce(sum(period_credit),0)::bigint period_credit from grouped
  )
  select jsonb_build_object('report_kind',p_report_kind,'dimension_kind',p_dimension_kind,'from_date',p_from_date,'to_date',p_to_date,
    'groups',coalesce((select jsonb_agg(jsonb_build_object('dimension_value_id',g.dimension_value_id,'code',g.code,'name',g.name,
      'opening_debit_minor',g.opening_debit::text,'opening_credit_minor',g.opening_credit::text,
      'period_debit_minor',g.period_debit::text,'period_credit_minor',g.period_credit::text,
      'closing_debit_minor',greatest(g.opening_debit-g.opening_credit+g.period_debit-g.period_credit,0)::text,
      'closing_credit_minor',greatest(-(g.opening_debit-g.opening_credit+g.period_debit-g.period_credit),0)::text,
      'entry_count',g.entry_count) order by g.dimension_value_id nulls first) from grouped g),'[]'::jsonb),
    'details',coalesce((select jsonb_agg(jsonb_build_object('entry_id',p.id,'transaction_id',p.transaction_id,'date',p.entry_date,
      'account_code',p.account_code,'account_name',p.account_name,'side',p.side,'amount_minor',p.portion_amount::text,
      'base_amount_minor',p.portion_base::text,'dimension_value_id',p.dimension_value_id,'description',p.description,'reference',p.reference)
      order by p.entry_date,p.transaction_id,p.entry_index) from portions p),'[]'::jsonb),
    'unfiltered',(select to_jsonb(u) from unfiltered u),
    'reconciliation_difference',jsonb_build_object(
      'opening_debit_minor',(select (t.opening_debit-u.opening_debit)::text from totals t cross join unfiltered u),
      'opening_credit_minor',(select (t.opening_credit-u.opening_credit)::text from totals t cross join unfiltered u),
      'period_debit_minor',(select (t.period_debit-u.period_debit)::text from totals t cross join unfiltered u),
      'period_credit_minor',(select (t.period_credit-u.period_credit)::text from totals t cross join unfiltered u))) into result;
  return result;
end; $$;

revoke all on function public.save_dimension_value(uuid,public.accounting_dimension_kind,text,text,text,uuid,uuid),
 public.archive_dimension_value(uuid,uuid,uuid),
 public.set_account_dimension_policy(uuid,uuid,public.accounting_dimension_kind,public.dimension_requirement),
 public.set_draft_entry_dimension_allocations(uuid,uuid,jsonb),public.read_dimension_workspace(uuid),
 public.report_by_accounting_dimension(uuid,text,public.accounting_dimension_kind,date,date,uuid) from public,anon;
grant execute on function public.save_dimension_value(uuid,public.accounting_dimension_kind,text,text,text,uuid,uuid),
 public.archive_dimension_value(uuid,uuid,uuid),
 public.set_account_dimension_policy(uuid,uuid,public.accounting_dimension_kind,public.dimension_requirement),
 public.set_draft_entry_dimension_allocations(uuid,uuid,jsonb),public.read_dimension_workspace(uuid),
 public.report_by_accounting_dimension(uuid,text,public.accounting_dimension_kind,date,date,uuid) to authenticated;

comment on table public.transaction_entry_dimension_allocations is
  'Immutable after posting. Each dimension kind used on a line independently reconciles exactly to that line.';
comment on function public.report_by_accounting_dimension(uuid,text,public.accounting_dimension_kind,date,date,uuid) is
  'Groups controlled allocations and an explicit Unassigned bucket. Legacy generic dimensions JSON is intentionally Unassigned.';
