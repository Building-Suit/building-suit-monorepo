-- V2-IMP-007: presentation history is append-only; posted financial entries are untouched.
-- Existing balance-sheet decisions stay in account_statement_classifications.
create table public.account_financial_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  account_id uuid not null,
  dimension text not null check (dimension in ('profit_loss','cash_flow')),
  statement_line text not null check (statement_line in (
    'operating_revenue','cost_of_sales','operating_expenses','other_income','other_expenses',
    'operating','investing','financing','operating_noncash','operating_working_capital')),
  effective_from date not null check (isfinite(effective_from)),
  revision bigint generated always as identity unique,
  request_id uuid not null,
  predecessor_id uuid,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  unique (organization_id,request_id)
);
create index account_financial_mappings_lookup on public.account_financial_mappings
  (organization_id,account_id,dimension,effective_from desc,revision desc);
alter table public.account_financial_mappings enable row level security;
create policy "financial mapping history readable" on public.account_financial_mappings for select to authenticated
  using (app.has_capability(organization_id,'accounts.read') or app.has_capability(organization_id,'reports.read'));
revoke all on public.account_financial_mappings from public,anon,authenticated;
grant select on public.account_financial_mappings to authenticated;
create trigger account_financial_mappings_immutable before update or delete on public.account_financial_mappings
  for each row execute function app.reject_mutation();

create or replace function public.schedule_account_financial_mapping(
  p_organization_id uuid,p_account_id uuid,p_dimension text,p_statement_line text,
  p_effective_from date,p_reason text,p_request_id uuid,p_expected_revision_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_account public.accounts%rowtype; v_head public.account_financial_mappings%rowtype;
  v_existing public.account_financial_mappings%rowtype; v_id uuid; v_lock date;
begin
  perform app.require_capability(p_organization_id,'accounts.update');
  if auth.uid() is null or p_request_id is null then raise exception 'INVALID_MAPPING_REQUEST' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('financial-mapping:'||p_organization_id::text||':'||p_request_id::text,0));
  select * into v_account from public.accounts where id=p_account_id and organization_id=p_organization_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED' using errcode='42501'; end if;
  select * into v_existing from public.account_financial_mappings
    where organization_id=p_organization_id and request_id=p_request_id;
  if found then
    if v_existing.account_id=p_account_id and v_existing.dimension=p_dimension
      and v_existing.statement_line=p_statement_line and v_existing.effective_from=p_effective_from
      and v_existing.reason=btrim(p_reason) and v_existing.predecessor_id is not distinct from p_expected_revision_id
    then return v_existing.id; end if;
    raise exception 'MAPPING_REQUEST_CONFLICT' using errcode='22023';
  end if;
  if v_account.is_archived or v_account.account_role='group' then raise exception 'MAPPING_ACCOUNT_INELIGIBLE' using errcode='23514'; end if;
  if not ((p_dimension='profit_loss' and
      ((v_account.type='revenue' and p_statement_line in ('operating_revenue','other_income')) or
       (v_account.type='expense' and p_statement_line in ('cost_of_sales','operating_expenses','other_expenses'))))
    or (p_dimension='cash_flow' and (p_statement_line in ('operating','investing','financing')
      or (p_statement_line='operating_noncash' and v_account.type in ('revenue','expense'))
      or (p_statement_line='operating_working_capital' and v_account.type in ('asset','liability')))))
  then raise exception 'MAPPING_LINE_INCOMPATIBLE' using errcode='22023'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000
    or p_effective_from is null or not isfinite(p_effective_from)
  then raise exception 'MAPPING_DATE_OR_REASON_INVALID' using errcode='22023'; end if;
  if p_effective_from<=app.org_today(p_organization_id) then
    perform app.require_capability(p_organization_id,'financial_mappings.backdate');
  end if;
  select books_locked_until into v_lock from public.organization_settings
    where organization_id=p_organization_id for share;
  if v_lock is not null and p_effective_from<=v_lock then raise exception 'BOOKS_LOCKED' using errcode='42501'; end if;
  select * into v_head from public.account_financial_mappings
    where organization_id=p_organization_id and account_id=p_account_id and dimension=p_dimension
    order by revision desc limit 1;
  if v_head.id is distinct from p_expected_revision_id then raise exception 'MAPPING_STALE' using errcode='40001'; end if;
  if v_head.effective_from>p_effective_from then raise exception 'MAPPING_DATE_ORDER' using errcode='22023'; end if;
  insert into public.account_financial_mappings
    (organization_id,account_id,dimension,statement_line,effective_from,request_id,predecessor_id,reason,created_by)
  values (p_organization_id,p_account_id,p_dimension,p_statement_line,p_effective_from,p_request_id,
    p_expected_revision_id,btrim(p_reason),auth.uid()) returning id into v_id;
  perform app.write_audit(p_organization_id,'account.financial_mapping_scheduled','account',p_account_id,
    case when v_head.id is null then null else to_jsonb(v_head) end,
    jsonb_build_object('mapping_id',v_id,'dimension',p_dimension,'line',p_statement_line,
      'effective_from',p_effective_from,'reason',btrim(p_reason)));
  return v_id;
end;
$$;
revoke all on function public.schedule_account_financial_mapping(uuid,uuid,text,text,date,text,uuid,uuid) from public,anon;
grant execute on function public.schedule_account_financial_mapping(uuid,uuid,text,text,date,text,uuid,uuid) to authenticated;

create or replace function public.account_financial_mapping_context(p_organization_id uuid,p_account_id uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare v_today date; v_lock date; v_history jsonb;
begin
  perform app.require_capability(p_organization_id,'accounts.read');
  if not exists(select 1 from public.accounts where id=p_account_id and organization_id=p_organization_id)
  then raise exception 'TENANT_ACCESS_DENIED' using errcode='42501'; end if;
  v_today:=app.org_today(p_organization_id);
  select books_locked_until into v_lock from public.organization_settings where organization_id=p_organization_id;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.revision desc),'[]'::jsonb) into v_history
  from public.account_financial_mappings m where m.organization_id=p_organization_id and m.account_id=p_account_id;
  return jsonb_build_object('today',v_today,'min_effective_date',greatest(v_today+1,coalesce(v_lock+1,v_today+1)),
    'history',v_history);
end;
$$;
revoke all on function public.account_financial_mapping_context(uuid,uuid) from public,anon;
grant execute on function public.account_financial_mapping_context(uuid,uuid) to authenticated;

-- One explicit decision can allocate one source entry among multiple cash-flow classes.
-- A later decision supersedes the whole allocation set without mutating prior evidence.
create table public.cash_flow_allocation_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  entry_id uuid not null references public.transaction_entries(id) on delete restrict,
  request_id uuid not null,
  predecessor_id uuid references public.cash_flow_allocation_decisions(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  unique(organization_id,request_id)
);
create table public.cash_flow_allocations (
  decision_id uuid not null references public.cash_flow_allocation_decisions(id) on delete restrict,
  section text not null check(section in ('operating','investing','financing')),
  amount_minor bigint not null check(amount_minor>0),
  primary key(decision_id,section)
);
create index cash_flow_decisions_entry on public.cash_flow_allocation_decisions(organization_id,entry_id,created_at desc);
alter table public.cash_flow_allocation_decisions enable row level security;
alter table public.cash_flow_allocations enable row level security;
create policy "cash allocation decisions readable" on public.cash_flow_allocation_decisions for select to authenticated
  using(app.has_capability(organization_id,'reports.read'));
create policy "cash allocations readable" on public.cash_flow_allocations for select to authenticated
  using(exists(select 1 from public.cash_flow_allocation_decisions d where d.id=decision_id
    and app.has_capability(d.organization_id,'reports.read')));
revoke all on public.cash_flow_allocation_decisions,public.cash_flow_allocations from public,anon,authenticated;
grant select on public.cash_flow_allocation_decisions,public.cash_flow_allocations to authenticated;
create trigger cash_flow_decisions_immutable before update or delete on public.cash_flow_allocation_decisions
  for each row execute function app.reject_mutation();
create trigger cash_flow_allocations_immutable before update or delete on public.cash_flow_allocations
  for each row execute function app.reject_mutation();

create or replace function public.classify_cash_flow_entry(
  p_organization_id uuid,p_entry_id uuid,p_allocations jsonb,p_reason text,p_request_id uuid,
  p_expected_decision_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_entry public.transaction_entries%rowtype; v_head public.cash_flow_allocation_decisions%rowtype;
  v_existing public.cash_flow_allocation_decisions%rowtype; v_id uuid; v_total bigint;
begin
  perform app.require_capability(p_organization_id,'accounts.update');
  if auth.uid() is null or p_request_id is null then raise exception 'INVALID_ALLOCATION_REQUEST' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cash-allocation:'||p_organization_id::text||':'||p_request_id::text,0));
  select * into v_entry from public.transaction_entries where id=p_entry_id and organization_id=p_organization_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED' using errcode='42501'; end if;
  select * into v_existing from public.cash_flow_allocation_decisions
    where organization_id=p_organization_id and request_id=p_request_id;
  if found then
    if v_existing.entry_id=p_entry_id and v_existing.predecessor_id is not distinct from p_expected_decision_id
      and v_existing.reason=btrim(p_reason) and
      (select coalesce(jsonb_object_agg(a.section,a.amount_minor),'{}'::jsonb) from public.cash_flow_allocations a where a.decision_id=v_existing.id)
       = p_allocations
    then return v_existing.id; end if;
    raise exception 'ALLOCATION_REQUEST_CONFLICT' using errcode='22023';
  end if;
  if v_entry.posted_at is null or (select a.is_liquid from public.accounts a where a.id=v_entry.account_id)
    or not exists(select 1 from public.transaction_entries ce join public.accounts ca on ca.id=ce.account_id
      where ce.transaction_id=v_entry.transaction_id and ce.organization_id=p_organization_id
        and ca.is_liquid and ce.posted_at is not null
      group by ce.transaction_id having sum(case when ce.side='debit' then ce.base_amount_minor else -ce.base_amount_minor end)<>0)
    or p_allocations is null or jsonb_typeof(p_allocations)<>'object'
    or p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000
  then raise exception 'INVALID_CASH_ALLOCATION' using errcode='22023'; end if;
  if exists(select 1 from jsonb_each_text(p_allocations) p where p.key not in ('operating','investing','financing')
    or p.value !~ '^[1-9][0-9]*$') then raise exception 'INVALID_CASH_ALLOCATION' using errcode='22023'; end if;
  select coalesce(sum(value::bigint),0) into v_total from jsonb_each_text(p_allocations);
  if v_total<>v_entry.base_amount_minor then raise exception 'ALLOCATION_TOTAL_MISMATCH' using errcode='23514'; end if;
  -- Entry row lock serializes competing allocation decisions.
  select * into v_head from public.cash_flow_allocation_decisions where entry_id=p_entry_id
    order by created_at desc,id desc limit 1;
  if v_head.id is distinct from p_expected_decision_id then raise exception 'ALLOCATION_STALE' using errcode='40001'; end if;
  insert into public.cash_flow_allocation_decisions(organization_id,entry_id,request_id,predecessor_id,reason,created_by)
    values(p_organization_id,p_entry_id,p_request_id,p_expected_decision_id,btrim(p_reason),auth.uid()) returning id into v_id;
  insert into public.cash_flow_allocations(decision_id,section,amount_minor)
    select v_id,key,value::bigint from jsonb_each_text(p_allocations);
  perform app.write_audit(p_organization_id,'cash_flow.entry_classified','transaction_entry',p_entry_id,
    case when v_head.id is null then null else to_jsonb(v_head) end,
    jsonb_build_object('decision_id',v_id,'allocations',p_allocations,'reason',btrim(p_reason)));
  return v_id;
end;
$$;
revoke all on function public.classify_cash_flow_entry(uuid,uuid,jsonb,text,uuid,uuid) from public,anon;
grant execute on function public.classify_cash_flow_entry(uuid,uuid,jsonb,text,uuid,uuid) to authenticated;

-- Extend the existing Balance Sheet classifier to real Control accounts without
-- replacing any historical classification row or changing its report contract.
create or replace function app.schedule_account_statement_classification(
  p_organization_id uuid, p_account_id uuid, p_statement_line text,
  p_effective_from date, p_reason text, p_request_id uuid, p_expected_revision_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_account public.accounts%rowtype;
  v_existing public.account_statement_classifications%rowtype;
  v_head public.account_statement_classifications%rowtype;
  v_lock date;
  v_id uuid;
begin
  perform app.require_capability(p_organization_id, 'accounts.update');
  if auth.uid() is null then raise exception 'TENANT_ACCESS_DENIED' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'INVALID_CLASSIFICATION: request id is required' using errcode = '22023'; end if;
  -- Serialize retries across accounts, then competing revisions of one account.
  perform pg_advisory_xact_lock(hashtextextended('statement-classification:' || p_organization_id::text || ':' || p_request_id::text, 0));
  select * into v_account from public.accounts
    where id = p_account_id and organization_id = p_organization_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED' using errcode = '42501'; end if;
  select * into v_existing from public.account_statement_classifications
    where organization_id = p_organization_id and request_id = p_request_id;
  if found then
    if v_existing.account_id = p_account_id and v_existing.statement_line = p_statement_line
      and v_existing.effective_from = p_effective_from and v_existing.reason = btrim(p_reason)
      and v_existing.predecessor_id is not distinct from p_expected_revision_id then
      return v_existing.id;
    end if;
    raise exception 'CLASSIFICATION_REQUEST_CONFLICT: request payload changed' using errcode = '22023';
  end if;
  if v_account.is_archived then raise exception 'ACCOUNT_ARCHIVED' using errcode = '23514'; end if;
  if v_account.account_role not in ('posting','control') or not (
    (v_account.type = 'asset' and p_statement_line in ('current_assets','property_equipment','other_non_current_assets')) or
    (v_account.type = 'liability' and p_statement_line in ('current_liabilities','non_current_liabilities')) or
    (v_account.type = 'equity' and p_statement_line = 'equity')
  ) or p_statement_line is null then
    raise exception 'INVALID_CLASSIFICATION: incompatible account or statement line' using errcode = '22023';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'INVALID_CLASSIFICATION: a reason of 1 to 1000 characters is required' using errcode = '22023';
  end if;
  -- A past/today statement must never change silently. Use the organization's day.
  if p_effective_from is null or not isfinite(p_effective_from) then
    raise exception 'INVALID_CLASSIFICATION_DATE' using errcode = '22023';
  end if;
  if p_effective_from <= app.org_today(p_organization_id) then
    perform app.require_capability(p_organization_id,'financial_mappings.backdate');
  end if;
  -- Coordinate with settings updates. This API deliberately has no lock override.
  select books_locked_until into v_lock from public.organization_settings
    where organization_id = p_organization_id for share;
  if v_lock is not null and p_effective_from <= v_lock then
    raise exception 'BOOKS_LOCKED: classification date falls in locked books' using errcode = '42501';
  end if;
  select * into v_head from public.account_statement_classifications
    where account_id = p_account_id order by revision desc limit 1;
  if v_head.id is distinct from p_expected_revision_id then
    raise exception 'CLASSIFICATION_STALE: reload the history before saving' using errcode = '40001';
  end if;
  if v_head.effective_from > p_effective_from then
    raise exception 'CLASSIFICATION_DATE_ORDER: cannot insert before the latest scheduled date' using errcode = '22023';
  end if;
  insert into public.account_statement_classifications (
    organization_id, account_id, request_id, predecessor_id, effective_from, statement_line, reason, created_by
  ) values (p_organization_id, p_account_id, p_request_id, p_expected_revision_id,
    p_effective_from, p_statement_line, btrim(p_reason), auth.uid()) returning id into v_id;
  perform app.write_audit(p_organization_id, 'account.classification_scheduled', 'account', p_account_id,
    case when v_head.id is null then null else to_jsonb(v_head) end,
    jsonb_build_object('classification_id', v_id, 'effective_from', p_effective_from,
      'statement_line', p_statement_line, 'reason', btrim(p_reason)));
  return v_id;
end;
$$;


-- Map each posted P&L movement on its accounting date. Year-end close remains
-- in the GL/TB but is excluded from historical operating P&L, as before.
create or replace function public.report_profit_and_loss(
  p_organization_id uuid,p_from_date date,p_to_date date
) returns table(section text,account_id uuid,code text,name text,amount_minor bigint)
language plpgsql stable set search_path='' as $$
begin
  perform app.require_capability(p_organization_id,'reports.read');
  if p_from_date is null or p_to_date is null or not isfinite(p_from_date)
    or not isfinite(p_to_date) or p_from_date>p_to_date
  then raise exception 'INVALID_DATE_RANGE' using errcode='22023'; end if;
  return query
  select coalesce(m.statement_line,'unclassified_'||a.type::text),a.id,a.code,a.name,
    sum(case when a.type='revenue' then
      case when e.side='credit' then e.base_amount_minor else -e.base_amount_minor end
      else case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end end)::bigint
  from public.transaction_entries e
  join public.transactions t on t.id=e.transaction_id and t.source<>'year_end_close'
  join public.accounts a on a.id=e.account_id and a.organization_id=p_organization_id
  left join lateral (
    select h.statement_line from public.account_financial_mappings h
    where h.organization_id=p_organization_id and h.account_id=a.id
      and h.dimension='profit_loss' and h.effective_from<=e.entry_date
    order by h.effective_from desc,h.revision desc limit 1
  ) m on true
  where e.organization_id=p_organization_id and e.posted_at is not null
    and e.entry_date between p_from_date and p_to_date
    and a.type in ('revenue','expense') and a.account_role in ('posting','control')
  group by a.id,a.code,a.name,a.type,m.statement_line
  having sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end)<>0
  order by 1,3 nulls last,4;
end;
$$;

-- Every source entry is either explicitly allocated or uses an effective-dated
-- account default. There is deliberately no dominant-counterpart or Operating fallback.
create or replace function public.report_cash_flow_detail(
  p_organization_id uuid,p_from_date date,p_to_date date
) returns table(transaction_id uuid,entry_id uuid,account_id uuid,section text,amount_minor bigint,classification_source text)
language plpgsql stable set search_path='' as $$
begin
  perform app.require_capability(p_organization_id,'reports.read');
  if p_from_date is null or p_to_date is null or not isfinite(p_from_date)
    or not isfinite(p_to_date) or p_from_date>p_to_date
  then raise exception 'INVALID_DATE_RANGE' using errcode='22023'; end if;
  return query
  with cash_journals as (
    select e.transaction_id,
      sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end)::bigint cash_delta
    from public.transaction_entries e join public.accounts a on a.id=e.account_id
    where e.organization_id=p_organization_id and e.posted_at is not null
      and e.entry_date between p_from_date and p_to_date and a.is_liquid
    group by e.transaction_id
    having sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end)<>0
  ), source_entries as (
    select e.*,t.source,a.is_liquid from public.transaction_entries e
    join cash_journals c on c.transaction_id=e.transaction_id
    join public.transactions t on t.id=e.transaction_id
    join public.accounts a on a.id=e.account_id
    where e.organization_id=p_organization_id and e.posted_at is not null and not a.is_liquid
  )
  select e.transaction_id,e.id,e.account_id,
    case when t.source='opening_balance' then 'unclassified'
      else coalesce(alloc.section,case when m.statement_line in ('operating','investing','financing') then m.statement_line end,'unclassified') end,
    (case when e.side='credit' then 1 else -1 end)*coalesce(alloc.amount_minor,e.base_amount_minor),
    case when t.source='opening_balance' then 'opening_unclassified'
      when alloc.section is not null then 'entry_allocation'
      when m.statement_line in ('operating','investing','financing') then 'effective_account_mapping'
      else 'unclassified' end
  from source_entries e
  join public.transactions t on t.id=e.transaction_id
  left join lateral (
    select d.id from public.cash_flow_allocation_decisions d
    where d.organization_id=p_organization_id and d.entry_id=e.id
    order by d.created_at desc,d.id desc limit 1
  ) latest on true
  left join public.cash_flow_allocations alloc on alloc.decision_id=latest.id
  left join lateral (
    select h.statement_line from public.account_financial_mappings h
    where h.organization_id=p_organization_id and h.account_id=e.account_id
      and h.dimension='cash_flow' and h.effective_from<=e.entry_date
    order by h.effective_from desc,h.revision desc limit 1
  ) m on latest.id is null;
end;
$$;
revoke all on function public.report_cash_flow_detail(uuid,date,date) from public,anon;
grant execute on function public.report_cash_flow_detail(uuid,date,date) to authenticated;

-- Drop the old enum-shaped contract so Unclassified can be represented.
drop function public.report_cash_flow(uuid,date,date);
create function public.report_cash_flow(
  p_organization_id uuid,p_from_date date,p_to_date date
) returns table(section text,amount_minor bigint)
language sql stable set search_path='' as $$
  select section,sum(amount_minor)::bigint from public.report_cash_flow_detail(p_organization_id,p_from_date,p_to_date)
  group by section order by section;
$$;
revoke all on function public.report_cash_flow(uuid,date,date) from public,anon;
grant execute on function public.report_cash_flow(uuid,date,date) to authenticated;

-- This result starts with P&L. Operating adjustments come only from explicit
-- noncash/working-capital account mappings. Any unexplained difference remains
-- visible and prevents a complete indirect reconciliation claim.
create function public.report_indirect_cash_flow(
  p_organization_id uuid,p_from_date date,p_to_date date
) returns jsonb language plpgsql stable set search_path='' as $$
declare v_profit bigint:=0; v_adjustment bigint:=0; v_cfo bigint:=0; v_cfi bigint:=0;
  v_cff bigint:=0; v_unclassified bigint:=0; v_unclassified_count bigint:=0;
  v_opening bigint:=0; v_closing bigint:=0; v_cash_delta bigint:=0; v_adjustments jsonb:='[]'::jsonb;
begin
  perform app.require_capability(p_organization_id,'reports.read');
  if p_from_date is null or p_to_date is null or not isfinite(p_from_date)
    or not isfinite(p_to_date) or p_from_date>p_to_date
  then raise exception 'INVALID_DATE_RANGE' using errcode='22023'; end if;
  select coalesce(sum(case when section in ('operating_revenue','other_income','unclassified_revenue')
    then amount_minor else -amount_minor end),0) into v_profit
  from public.report_profit_and_loss(p_organization_id,p_from_date,p_to_date);
  select coalesce(sum(amount_minor) filter(where section='operating'),0),
    coalesce(sum(amount_minor) filter(where section='investing'),0),
    coalesce(sum(amount_minor) filter(where section='financing'),0),
    coalesce(sum(amount_minor) filter(where section='unclassified'),0),
    count(*) filter(where section='unclassified')
  into v_cfo,v_cfi,v_cff,v_unclassified,v_unclassified_count
  from public.report_cash_flow_detail(p_organization_id,p_from_date,p_to_date);
  select coalesce(sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end)
    filter(where e.entry_date<p_from_date),0),
    coalesce(sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end)
    filter(where e.entry_date<=p_to_date),0)
  into v_opening,v_closing
  from public.transaction_entries e join public.accounts a on a.id=e.account_id
  where e.organization_id=p_organization_id and e.posted_at is not null and a.is_liquid;
  v_cash_delta:=v_closing-v_opening;
  select coalesce(sum(x.amount_minor),0),coalesce(jsonb_agg(jsonb_build_object(
    'account_id',x.account_id,'code',x.code,'name',x.name,'line',x.statement_line,
    'amount_minor',x.amount_minor) order by x.code,x.account_id),'[]'::jsonb)
  into v_adjustment,v_adjustments from (
    select a.id account_id,a.code,a.name,m.statement_line,
      sum(case when m.statement_line='operating_noncash' then
        case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end
        else case when e.side='credit' then e.base_amount_minor else -e.base_amount_minor end end)::bigint amount_minor
    from public.transaction_entries e join public.accounts a on a.id=e.account_id
    join public.transactions t on t.id=e.transaction_id and t.source<>'year_end_close'
    join lateral (select h.statement_line from public.account_financial_mappings h
      where h.organization_id=p_organization_id and h.account_id=a.id and h.dimension='cash_flow'
        and h.effective_from<=e.entry_date
      order by h.effective_from desc,h.revision desc limit 1) m
      on m.statement_line in ('operating_noncash','operating_working_capital')
    where e.organization_id=p_organization_id and e.posted_at is not null
      and e.entry_date between p_from_date and p_to_date and not a.is_liquid
    group by a.id,a.code,a.name,m.statement_line
    having sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end)<>0
  ) x;
  return jsonb_build_object(
    'method','indirect','net_profit_minor',v_profit,'operating_adjustments',v_adjustments,
    'operating_adjustments_minor',v_adjustment,'operating_cash_minor',v_cfo,
    'investing_cash_minor',v_cfi,'financing_cash_minor',v_cff,
    'unclassified_cash_minor',v_unclassified,'unclassified_entry_count',v_unclassified_count,
    'classified_cash_minor',v_cfo+v_cfi+v_cff,'net_cash_change_minor',v_cash_delta,
    'actual_cash_change_minor',v_cash_delta,'opening_cash_minor',v_opening,'closing_cash_minor',v_closing,
    'operating_adjustment_difference_minor',v_cfo-v_profit-v_adjustment,
    'classification_difference_minor',v_cash_delta-v_cfo-v_cfi-v_cff-v_unclassified,
    'reconciled',v_cash_delta=v_cfo+v_cfi+v_cff+v_unclassified,
    'classification_complete',v_unclassified_count=0 and v_cfo=v_profit+v_adjustment);
end;
$$;
revoke all on function public.report_indirect_cash_flow(uuid,date,date) from public,anon;
grant execute on function public.report_indirect_cash_flow(uuid,date,date) to authenticated;

create or replace function public.export_financial_report_csv(
  p_organization_id uuid,
  p_report text,
  p_from_date date default null,
  p_to_date date default null,
  p_as_of_date date default null,
  p_account_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_header text;
  v_body text;
  v_currency text := app.org_base_currency(p_organization_id)::text;
  v_cf jsonb;
begin
  perform app.require_capability(p_organization_id, 'reports.export');
  perform app.assert_plan_feature(p_organization_id, 'exports');

  case p_report
    when 'profit_loss' then
      if p_from_date is null or p_to_date is null then
        raise exception 'INVALID_EXPORT_ARGUMENT: profit_loss requires from and to dates'
          using errcode = '22023';
      end if;
      v_header := app.csv_line('section', 'code', 'account', 'amount', 'currency');
      select string_agg(app.csv_line(
        report.section, app.csv_untrusted_text(report.code),
        app.csv_untrusted_text(report.name),
        app.csv_amount(p_organization_id, report.amount_minor), v_currency
      ), E'\n' order by report.section, report.code nulls last, report.name)
      into v_body
      from public.report_profit_and_loss(p_organization_id, p_from_date, p_to_date) report;

    when 'balance_sheet' then
      v_header := app.csv_line('section', 'code', 'account', 'amount', 'currency');
      select string_agg(app.csv_line(
        report.section, app.csv_untrusted_text(report.code),
        app.csv_untrusted_text(report.name),
        app.csv_amount(p_organization_id, report.amount_minor), v_currency
      ), E'\n' order by report.section, report.code nulls last, report.name)
      into v_body
      from public.report_balance_sheet(p_organization_id, p_as_of_date) report;

    when 'trial_balance' then
      if p_from_date is null or p_to_date is null then
        raise exception 'INVALID_EXPORT_ARGUMENT: trial_balance requires from and to dates'
          using errcode = '22023';
      end if;
      v_header := app.csv_line(
        'code', 'account', 'type', 'opening_debit', 'opening_credit',
        'period_debit', 'period_credit', 'closing_debit', 'closing_credit', 'currency'
      );
      with report as materialized (
        select * from public.report_trial_balance(p_organization_id, p_from_date, p_to_date)
      ), lines as (
        select 0 as position, report.code as sort_code, report.name as sort_name,
          app.csv_line(
            app.csv_untrusted_text(report.code), app.csv_untrusted_text(report.name), report.type::text,
            app.csv_amount(p_organization_id, report.opening_debit_minor::bigint),
            app.csv_amount(p_organization_id, report.opening_credit_minor::bigint),
            app.csv_amount(p_organization_id, report.period_debit_minor::bigint),
            app.csv_amount(p_organization_id, report.period_credit_minor::bigint),
            app.csv_amount(p_organization_id, report.closing_debit_minor::bigint),
            app.csv_amount(p_organization_id, report.closing_credit_minor::bigint), v_currency
          ) as line
        from report
        union all
        select 1, null, null, app.csv_line(
          '', 'Total', '',
          app.csv_amount(p_organization_id, coalesce(sum(opening_debit_minor::bigint), 0)::bigint),
          app.csv_amount(p_organization_id, coalesce(sum(opening_credit_minor::bigint), 0)::bigint),
          app.csv_amount(p_organization_id, coalesce(sum(period_debit_minor::bigint), 0)::bigint),
          app.csv_amount(p_organization_id, coalesce(sum(period_credit_minor::bigint), 0)::bigint),
          app.csv_amount(p_organization_id, coalesce(sum(closing_debit_minor::bigint), 0)::bigint),
          app.csv_amount(p_organization_id, coalesce(sum(closing_credit_minor::bigint), 0)::bigint), v_currency
        )
        from report
      )
      select string_agg(line, E'\n' order by position, sort_code nulls last, sort_name)
      into v_body from lines;

    when 'cash_flow' then
      if p_from_date is null or p_to_date is null then
        raise exception 'INVALID_EXPORT_ARGUMENT: cash_flow requires from and to dates'
          using errcode = '22023';
      end if;
      v_cf := public.report_indirect_cash_flow(p_organization_id,p_from_date,p_to_date);
      v_header := app.csv_line('line','account_id','account','amount','currency');
      select string_agg(line,E'\n' order by ordinal) into v_body from (
        select 1 ordinal,app.csv_line('net_profit','','',app.csv_amount(p_organization_id,(v_cf->>'net_profit_minor')::bigint),v_currency) line
        union all
        select 2+row_number() over(order by item->>'code',item->>'account_id'),
          app.csv_line('operating_adjustment',item->>'account_id',app.csv_untrusted_text(item->>'name'),
            app.csv_amount(p_organization_id,(item->>'amount_minor')::bigint),v_currency)
        from jsonb_array_elements(v_cf->'operating_adjustments') item
        union all select 10001,app.csv_line('operating_cash','','',app.csv_amount(p_organization_id,(v_cf->>'operating_cash_minor')::bigint),v_currency)
        union all select 10002,app.csv_line('investing_cash','','',app.csv_amount(p_organization_id,(v_cf->>'investing_cash_minor')::bigint),v_currency)
        union all select 10003,app.csv_line('financing_cash','','',app.csv_amount(p_organization_id,(v_cf->>'financing_cash_minor')::bigint),v_currency)
        union all select 10004,app.csv_line('unclassified_cash','','',app.csv_amount(p_organization_id,(v_cf->>'unclassified_cash_minor')::bigint),v_currency)
        union all select 10005,app.csv_line('net_cash_change','','',app.csv_amount(p_organization_id,(v_cf->>'net_cash_change_minor')::bigint),v_currency)
        union all select 10006,app.csv_line('opening_cash','','',app.csv_amount(p_organization_id,(v_cf->>'opening_cash_minor')::bigint),v_currency)
        union all select 10007,app.csv_line('closing_cash','','',app.csv_amount(p_organization_id,(v_cf->>'closing_cash_minor')::bigint),v_currency)
        union all select 10008,app.csv_line('operating_adjustment_difference','','',app.csv_amount(p_organization_id,(v_cf->>'operating_adjustment_difference_minor')::bigint),v_currency)
        union all select 10009,app.csv_line('classification_difference','','',app.csv_amount(p_organization_id,(v_cf->>'classification_difference_minor')::bigint),v_currency)
      ) lines;

    when 'general_ledger' then
      if p_account_id is null or p_from_date is null or p_to_date is null then
        raise exception 'INVALID_EXPORT_ARGUMENT: general_ledger requires an account and date range'
          using errcode = '22023';
      end if;
      v_header := app.csv_line(
        'date', 'reference', 'description', 'memo', 'debit', 'credit',
        'running_balance', 'currency'
      );
      select string_agg(app.csv_line(
        report.entry_date::text,
        app.csv_untrusted_text(report.reference),
        app.csv_untrusted_text(report.description),
        app.csv_untrusted_text(report.memo),
        app.csv_amount(p_organization_id, report.debit_minor),
        app.csv_amount(p_organization_id, report.credit_minor),
        app.csv_amount(p_organization_id, report.running_balance_minor), v_currency
      ), E'\n' order by report.entry_date, report.entry_id)
      into v_body
      from public.report_general_ledger(
        p_organization_id, p_account_id, p_from_date, p_to_date
      ) report;

    else
      raise exception 'INVALID_EXPORT_ARGUMENT: unsupported financial report'
        using errcode = '22023';
  end case;

  return v_header || case when v_body is null then '' else E'\n' || v_body end;
end;
$$;


-- Preserve the six-column contract while including Control leaves in the same
-- source population as the statements. Group parents remain excluded.
create or replace function public.report_trial_balance(
  p_organization_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (
  account_id uuid,
  code text,
  name text,
  type public.account_type,
  parent_account_id uuid,
  account_role text,
  normal_balance public.normal_balance,
  contra_account_id uuid,
  opening_debit_minor text,
  opening_credit_minor text,
  period_debit_minor text,
  period_credit_minor text,
  closing_debit_minor text,
  closing_credit_minor text
)
language plpgsql
stable
set search_path = ''
as $$
begin
  perform app.require_capability(p_organization_id, 'reports.read');

  if p_from_date is null or p_to_date is null
     or not isfinite(p_from_date) or not isfinite(p_to_date)
     or p_from_date > p_to_date then
    raise exception 'INVALID_DATE_RANGE' using errcode = '22023';
  end if;

  return query
  with movements as (
    select
      a.id,
      a.code,
      a.name,
      a.type,
      a.parent_account_id,
      a.account_role,
      a.normal_balance,
      a.contra_account_id,
      coalesce(sum(case when e.entry_date < p_from_date
                         then case when e.side = 'debit' then e.base_amount_minor else -e.base_amount_minor end
                         else 0 end), 0)::bigint as opening_net,
      coalesce(sum(e.base_amount_minor) filter (
        where e.entry_date between p_from_date and p_to_date and e.side = 'debit'
      ), 0)::bigint as period_debit,
      coalesce(sum(e.base_amount_minor) filter (
        where e.entry_date between p_from_date and p_to_date and e.side = 'credit'
      ), 0)::bigint as period_credit,
      count(e.id) as entry_count
    from public.accounts a
    left join public.transaction_entries e
      on e.organization_id = a.organization_id
     and e.account_id = a.id
     and e.posted_at is not null
     and e.entry_date <= p_to_date
    where a.organization_id = p_organization_id
      and a.account_role in ('posting','control')
    group by a.id
  ), balances as (
    select m.*, (m.opening_net + m.period_debit - m.period_credit)::bigint as closing_net
    from movements m
    where m.entry_count > 0
  )
  select
    b.id,
    b.code,
    b.name,
    b.type,
    b.parent_account_id,
    b.account_role,
    b.normal_balance,
    b.contra_account_id,
    greatest(b.opening_net, 0)::text,
    greatest(-b.opening_net, 0)::text,
    b.period_debit::text,
    b.period_credit::text,
    greatest(b.closing_net, 0)::text,
    greatest(-b.closing_net, 0)::text
  from balances b
  order by b.code nulls last, b.name, b.id;
end;
$$;


insert into public.capabilities(key,domain,description)
values('financial_mappings.backdate','accounts','Schedule an explicit historical financial-statement mapping with a reason')
on conflict(key) do nothing;
insert into public.role_capabilities(role,capability_key) values
  ('owner'::public.organization_role,'financial_mappings.backdate'),
  ('admin'::public.organization_role,'financial_mappings.backdate')
on conflict do nothing;

create function public.cash_flow_allocation_context(p_organization_id uuid,p_entry_id uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare v_entry public.transaction_entries%rowtype; v_decision public.cash_flow_allocation_decisions%rowtype; v_lines jsonb;
begin
  perform app.require_capability(p_organization_id,'reports.read');
  select * into v_entry from public.transaction_entries where id=p_entry_id and organization_id=p_organization_id;
  if not found then raise exception 'TENANT_ACCESS_DENIED' using errcode='42501'; end if;
  select * into v_decision from public.cash_flow_allocation_decisions
    where organization_id=p_organization_id and entry_id=p_entry_id order by created_at desc,id desc limit 1;
  select coalesce(jsonb_object_agg(a.section,a.amount_minor),'{}'::jsonb) into v_lines
    from public.cash_flow_allocations a where a.decision_id=v_decision.id;
  return jsonb_build_object('entry_id',p_entry_id,'amount_minor',v_entry.base_amount_minor,
    'decision_id',v_decision.id,'allocations',v_lines);
end;
$$;
revoke all on function public.cash_flow_allocation_context(uuid,uuid) from public,anon;
grant execute on function public.cash_flow_allocation_context(uuid,uuid) to authenticated;

create function public.report_statement_reconciliation(
  p_organization_id uuid,p_from_date date,p_to_date date,p_as_of_date date default null
) returns jsonb language plpgsql stable set search_path='' as $$
declare v_pl bigint:=0; v_pl_gl bigint:=0; v_bs bigint:=0; v_bs_tb bigint:=0;
  v_unclassified_pl bigint:=0; v_unclassified_bs bigint:=0; v_accounts jsonb:='[]'::jsonb;
  v_as_of date:=coalesce(p_as_of_date,p_to_date);
begin
  perform app.require_capability(p_organization_id,'reports.read');
  if p_from_date is null or p_to_date is null or not isfinite(p_from_date)
    or not isfinite(p_to_date) or p_from_date>p_to_date or not isfinite(v_as_of)
  then raise exception 'INVALID_DATE_RANGE' using errcode='22023'; end if;
  select coalesce(sum(case when section in ('operating_revenue','other_income','unclassified_revenue')
      then amount_minor else -amount_minor end),0),
    count(*) filter(where section like 'unclassified_%')
  into v_pl,v_unclassified_pl
  from public.report_profit_and_loss(p_organization_id,p_from_date,p_to_date);
  select coalesce(sum(case when a.type='revenue' then
      case when e.side='credit' then e.base_amount_minor else -e.base_amount_minor end
      else case when e.side='debit' then -e.base_amount_minor else e.base_amount_minor end end),0)
    into v_pl_gl
  from public.transaction_entries e join public.accounts a on a.id=e.account_id
  join public.transactions t on t.id=e.transaction_id and t.source<>'year_end_close'
  where e.organization_id=p_organization_id and e.posted_at is not null
    and e.entry_date between p_from_date and p_to_date and a.type in ('revenue','expense');
  select coalesce(sum(case when section='asset' then amount_minor::bigint else -amount_minor::bigint end),0),
    count(*) filter(where statement_line like 'unclassified_%')
  into v_bs,v_unclassified_bs
  from public.report_classified_balance_sheet(p_organization_id,v_as_of);
  select coalesce(sum(closing_debit_minor::bigint-closing_credit_minor::bigint),0)
  into v_bs_tb from public.report_trial_balance(p_organization_id,least(p_from_date,v_as_of),v_as_of);
  with pl_statement as (
    select account_id,sum(case when section in ('operating_revenue','other_income','unclassified_revenue')
      then amount_minor else -amount_minor end)::bigint amount
    from public.report_profit_and_loss(p_organization_id,p_from_date,p_to_date)
    group by account_id
  ), pl_ledger as (
    select e.account_id,sum(case when a.type='revenue' then
      case when e.side='credit' then e.base_amount_minor else -e.base_amount_minor end
      else case when e.side='debit' then -e.base_amount_minor else e.base_amount_minor end end)::bigint amount
    from public.transaction_entries e join public.accounts a on a.id=e.account_id
    join public.transactions t on t.id=e.transaction_id and t.source<>'year_end_close'
    where e.organization_id=p_organization_id and e.posted_at is not null
      and e.entry_date between p_from_date and p_to_date and a.type in ('revenue','expense')
    group by e.account_id
  ), bs_statement as (
    select account_id,sum(case when section='asset' then amount_minor::bigint else -amount_minor::bigint end)::bigint amount
    from public.report_classified_balance_sheet(p_organization_id,v_as_of)
    where account_id is not null group by account_id
  ), bs_ledger as (
    select account_id,sum(closing_debit_minor::bigint-closing_credit_minor::bigint)::bigint amount
    from public.report_trial_balance(p_organization_id,least(p_from_date,v_as_of),v_as_of)
    where type in ('asset','liability','equity') group by account_id
  ), rows as (
    select 'profit_loss' statement,coalesce(s.account_id,l.account_id) account_id,
      coalesce(s.amount,0) statement_minor,coalesce(l.amount,0) ledger_minor
    from pl_statement s full join pl_ledger l on l.account_id=s.account_id
    union all
    select 'balance_sheet',coalesce(s.account_id,l.account_id),coalesce(s.amount,0),coalesce(l.amount,0)
    from bs_statement s full join bs_ledger l on l.account_id=s.account_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('statement',r.statement,'account_id',r.account_id,
    'statement_minor',r.statement_minor,'ledger_minor',r.ledger_minor,
    'difference_minor',r.statement_minor-r.ledger_minor) order by r.statement,r.account_id),'[]'::jsonb)
  into v_accounts from rows r;
  -- For Balance Sheet, the mapped display equation is A-L-E including unclosed
  -- result; the corresponding TB raw equation also includes temporary accounts.
  return jsonb_build_object('profit_loss_minor',v_pl,'profit_loss_gl_minor',v_pl_gl,
    'profit_loss_difference_minor',v_pl-v_pl_gl,
    'balance_sheet_equation_minor',v_bs,'trial_balance_equation_minor',v_bs_tb,
    'balance_sheet_difference_minor',v_bs-v_bs_tb,
    'unclassified_profit_loss_rows',v_unclassified_pl,'unclassified_balance_sheet_rows',v_unclassified_bs,
    'mapping_complete',v_unclassified_pl=0 and v_unclassified_bs=0,
    'accounts',v_accounts);
end;
$$;
revoke all on function public.report_statement_reconciliation(uuid,date,date,date) from public,anon;
grant execute on function public.report_statement_reconciliation(uuid,date,date,date) to authenticated;
comment on function public.report_trial_balance(uuid,date,date) is
  'Six-column Trial Balance for Posting and Control account leaves, excluding Group parents.';
