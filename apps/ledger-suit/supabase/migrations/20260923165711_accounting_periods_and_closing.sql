-- V2-IMP-004 — first-class accounting periods and fiscal-year closing.
create extension if not exists btree_gist with schema extensions;

create type public.accounting_period_status as enum ('open', 'soft_closed', 'hard_closed');

create table public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_year_start date not null,
  fiscal_year_end date not null,
  start_date date not null,
  end_date date not null,
  status public.accounting_period_status not null default 'open',
  status_changed_at timestamptz not null default now(),
  status_changed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  constraint accounting_period_dates_valid check (start_date <= end_date),
  constraint accounting_period_fiscal_year_valid check (
    fiscal_year_start <= start_date and end_date <= fiscal_year_end
    and fiscal_year_start <= fiscal_year_end
  ),
  unique (organization_id, id),
  exclude using gist (
    organization_id with =,
    daterange(start_date, end_date, '[]') with &&
  )
);

create index accounting_periods_org_dates
  on public.accounting_periods (organization_id, start_date, end_date);

create table public.accounting_period_transitions (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null,
  previous_status public.accounting_period_status not null,
  new_status public.accounting_period_status not null,
  reason text,
  actor_id uuid references auth.users(id),
  transitioned_at timestamptz not null default now(),
  year_end_close_id uuid,
  constraint accounting_period_transition_period_fk
    foreign key (organization_id, period_id)
    references public.accounting_periods (organization_id, id) on delete restrict,
  constraint accounting_period_transition_changed check (previous_status <> new_status),
  constraint accounting_period_reopen_reason check (
    new_status not in ('open', 'soft_closed')
    or previous_status = 'open'
    or nullif(btrim(reason), '') is not null
  )
);

create table public.fiscal_year_closes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_year_start date not null,
  fiscal_year_end date not null,
  closing_transaction_id uuid unique references public.transactions(id) on delete restrict,
  retained_earnings_account_id uuid not null references public.accounts(id) on delete restrict,
  net_income_minor bigint not null,
  reason text not null check (nullif(btrim(reason), '') is not null),
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users(id),
  unique (organization_id, fiscal_year_start),
  check (fiscal_year_start <= fiscal_year_end)
);

alter table public.accounting_period_transitions
  add constraint accounting_period_transition_year_end_fk
  foreign key (year_end_close_id) references public.fiscal_year_closes(id) on delete restrict;

alter table public.accounting_periods enable row level security;
alter table public.accounting_period_transitions enable row level security;
alter table public.fiscal_year_closes enable row level security;

insert into public.capabilities (key, domain, description) values
  ('periods.read', 'books', 'View accounting periods and transition history'),
  ('periods.manage', 'books', 'Create, close, and reopen accounting periods'),
  ('periods.adjust_soft_closed', 'books', 'Post reasoned adjustments in Soft Closed periods'),
  ('periods.year_end_close', 'books', 'Create a fiscal year-end closing journal')
on conflict (key) do update set domain = excluded.domain, description = excluded.description;

insert into public.role_capabilities (role, capability_key)
select role, capability
from (values
  ('owner'::public.organization_role, 'periods.read'),
  ('owner'::public.organization_role, 'periods.manage'),
  ('owner'::public.organization_role, 'periods.adjust_soft_closed'),
  ('owner'::public.organization_role, 'periods.year_end_close'),
  ('admin'::public.organization_role, 'periods.read'),
  ('admin'::public.organization_role, 'periods.manage'),
  ('admin'::public.organization_role, 'periods.adjust_soft_closed'),
  ('admin'::public.organization_role, 'periods.year_end_close'),
  ('accountant'::public.organization_role, 'periods.read'),
  ('accountant'::public.organization_role, 'periods.adjust_soft_closed')
) defaults(role, capability)
on conflict do nothing;

create policy accounting_periods_select on public.accounting_periods
for select to authenticated using (
  app.has_capability(organization_id, 'periods.read')
);
create policy accounting_period_transitions_select on public.accounting_period_transitions
for select to authenticated using (
  app.has_capability(organization_id, 'periods.read')
);
create policy fiscal_year_closes_select on public.fiscal_year_closes
for select to authenticated using (
  app.has_capability(organization_id, 'periods.read')
);

grant select on public.accounting_periods, public.accounting_period_transitions,
  public.fiscal_year_closes to authenticated;
revoke insert, update, delete, truncate on public.accounting_periods,
  public.accounting_period_transitions, public.fiscal_year_closes from public, anon, authenticated;

create or replace function app.reject_immutable_period_history_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'IMMUTABLE_PERIOD_HISTORY: transition and close history cannot be changed'
    using errcode = '55000';
end;
$$;

create trigger accounting_period_transitions_immutable
before update or delete on public.accounting_period_transitions
for each row execute function app.reject_immutable_period_history_change();
create trigger fiscal_year_closes_immutable
before update or delete on public.fiscal_year_closes
for each row execute function app.reject_immutable_period_history_change();

create or replace function app.fiscal_year_bounds(p_organization_id uuid, p_date date)
returns table (fiscal_year_start date, fiscal_year_end date)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_month integer;
  v_year integer;
begin
  if p_date is null or not isfinite(p_date) then
    raise exception 'INVALID_ACCOUNTING_DATE' using errcode = '22023';
  end if;
  select o.fiscal_year_start_month into v_month
  from public.organizations o where o.id = p_organization_id;
  if not found then
    raise exception 'TENANT_ACCESS_DENIED: organization not found' using errcode = '42501';
  end if;
  v_year := extract(year from p_date)::integer
    - case when extract(month from p_date)::integer < v_month then 1 else 0 end;
  fiscal_year_start := make_date(v_year, v_month, 1);
  fiscal_year_end := (fiscal_year_start + interval '1 year - 1 day')::date;
  return next;
end;
$$;

create or replace function public.accounting_period_context(
  p_organization_id uuid, p_date date default null
)
returns table (
  fiscal_year_start date, fiscal_year_end date, period_id uuid,
  period_start date, period_end date, period_status public.accounting_period_status,
  legacy_locked_until date
)
language plpgsql stable security definer set search_path = '' as $$
declare v_date date := coalesce(p_date, app.org_today(p_organization_id));
begin
  perform app.require_capability(p_organization_id, 'periods.read');
  return query
  select fy.fiscal_year_start, fy.fiscal_year_end, period.id,
    period.start_date, period.end_date, period.status, settings.books_locked_until
  from app.fiscal_year_bounds(p_organization_id, v_date) fy
  left join public.accounting_periods period
    on period.organization_id = p_organization_id
   and v_date between period.start_date and period.end_date
  left join public.organization_settings settings
    on settings.organization_id = p_organization_id;
end;
$$;

create or replace function app.assert_accounting_period_allows(
  p_organization_id uuid,
  p_date date,
  p_type public.transaction_type default null,
  p_source public.transaction_source default 'manual',
  p_reason text default null
)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_legacy_lock date;
  v_status public.accounting_period_status;
begin
  if p_date is null or not isfinite(p_date) then
    raise exception 'INVALID_ACCOUNTING_DATE' using errcode = '22023';
  end if;

  -- This row lock is the organization-scoped close/post serialization point.
  select settings.books_locked_until into v_legacy_lock
  from public.organization_settings settings
  where settings.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'TENANT_ACCESS_DENIED: organization settings not found' using errcode = '42501';
  end if;

  -- Preserve the exact old inclusive boundary and its existing explicit override.
  if v_legacy_lock is not null and p_date <= v_legacy_lock
     and not app.has_capability(p_organization_id, 'books.override_lock') then
    raise exception 'BOOKS_LOCKED: books are locked through %', v_legacy_lock
      using errcode = '42501';
  end if;

  select period.status into v_status
  from public.accounting_periods period
  where period.organization_id = p_organization_id
    and p_date between period.start_date and period.end_date;

  if v_status is null or v_status = 'open' then return; end if;
  if v_status = 'hard_closed' then
    raise exception 'ACCOUNTING_PERIOD_HARD_CLOSED' using errcode = '42501';
  end if;

  if p_source = 'year_end_close'
     and p_type = 'adjustment'
     and app.has_capability(p_organization_id, 'periods.year_end_close')
     and nullif(btrim(p_reason), '') is not null then
    return;
  end if;

  if p_type = 'adjustment'
     and p_source = 'manual'
     and app.has_capability(p_organization_id, 'transactions.adjust')
     and app.has_capability(p_organization_id, 'periods.adjust_soft_closed')
     and nullif(btrim(p_reason), '') is not null then
    return;
  end if;

  raise exception 'ACCOUNTING_PERIOD_SOFT_CLOSED: only authorized reasoned adjustments are allowed'
    using errcode = '42501';
end;
$$;

create or replace function app.assert_books_open(p_organization_id uuid, p_date date)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform app.assert_accounting_period_allows(p_organization_id, p_date, null, 'manual', null);
end;
$$;

create or replace function public.create_accounting_period(
  p_organization_id uuid, p_start_date date, p_end_date date
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_start date; v_end date; v_id uuid;
begin
  perform app.require_capability(p_organization_id, 'periods.manage');
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'INVALID_PERIOD_DATES' using errcode = '22023';
  end if;
  perform 1 from public.organization_settings s
    where s.organization_id = p_organization_id for update;
  select fiscal_year_start, fiscal_year_end into v_start, v_end
    from app.fiscal_year_bounds(p_organization_id, p_start_date);
  if p_end_date > v_end then
    raise exception 'PERIOD_CROSSES_FISCAL_YEAR' using errcode = '22023';
  end if;
  insert into public.accounting_periods (
    organization_id, fiscal_year_start, fiscal_year_end, start_date, end_date,
    created_by, status_changed_by
  ) values (p_organization_id, v_start, v_end, p_start_date, p_end_date, auth.uid(), auth.uid())
  returning id into v_id;
  perform app.write_audit(p_organization_id, 'accounting_period.created', 'accounting_period', v_id,
    null, jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date, 'status', 'open'));
  return v_id;
end;
$$;

create or replace function public.transition_accounting_period(
  p_period_id uuid, p_new_status public.accounting_period_status, p_reason text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_period public.accounting_periods%rowtype;
  v_close uuid;
begin
  select * into v_period from public.accounting_periods where id = p_period_id;
  if not found then raise exception 'TENANT_ACCESS_DENIED: period not found' using errcode = '42501'; end if;
  perform app.require_capability(v_period.organization_id, 'periods.manage');
  perform 1 from public.organization_settings s
    where s.organization_id = v_period.organization_id for update;
  select * into v_period from public.accounting_periods where id = p_period_id for update;

  if not ((v_period.status = 'open' and p_new_status = 'soft_closed')
       or (v_period.status = 'soft_closed' and p_new_status in ('open', 'hard_closed'))
       or (v_period.status = 'hard_closed' and p_new_status = 'soft_closed')) then
    raise exception 'INVALID_PERIOD_TRANSITION: % to %', v_period.status, p_new_status
      using errcode = '23514';
  end if;
  if p_new_status in ('open', 'soft_closed') and v_period.status <> 'open'
     and nullif(btrim(p_reason), '') is null then
    raise exception 'REOPEN_REASON_REQUIRED' using errcode = '22023';
  end if;

  select close.id into v_close from public.fiscal_year_closes close
  where close.organization_id = v_period.organization_id
    and close.fiscal_year_start = v_period.fiscal_year_start;

  update public.accounting_periods set status = p_new_status,
    status_changed_at = now(), status_changed_by = auth.uid()
  where id = p_period_id;
  insert into public.accounting_period_transitions (
    organization_id, period_id, previous_status, new_status, reason, actor_id, year_end_close_id
  ) values (
    v_period.organization_id, p_period_id, v_period.status, p_new_status,
    nullif(btrim(p_reason), ''), auth.uid(), v_close
  );
  perform app.write_audit(v_period.organization_id, 'accounting_period.transitioned', 'accounting_period', p_period_id,
    jsonb_build_object('status', v_period.status),
    jsonb_build_object('status', p_new_status, 'reason', nullif(btrim(p_reason), '')));
  return p_period_id;
end;
$$;

-- The transition identity is bigint; expose the period id as the stable RPC result.
create or replace function app.period_transition_guard_note() returns text
language sql immutable set search_path = '' as $$ select 'transitions are append-only'::text $$;

-- Reinstall the common posting boundary with source-aware period enforcement.
create or replace function app.create_and_post(
  p_organization_id uuid, p_type public.transaction_type, p_transaction_date date,
  p_lines jsonb, p_currency_code char(3) default null, p_exchange_rate numeric default null,
  p_description text default null, p_reference text default null,
  p_counterparty_id uuid default null, p_category_id uuid default null,
  p_memo text default null, p_adjustment_reason text default null,
  p_source public.transaction_source default 'manual', p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb, p_fingerprint text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_base_currency char(3); v_currency char(3); v_rate numeric; v_txn_id uuid;
  v_existing uuid; v_request_fingerprint text;
begin
  perform app.require_capability(p_organization_id, 'transactions.post');
  v_base_currency := app.org_base_currency(p_organization_id);
  v_currency := coalesce(p_currency_code, v_base_currency);
  v_rate := case when v_currency = v_base_currency then 1 else p_exchange_rate end;
  if p_idempotency_key is not null then
    v_request_fingerprint := app.posting_request_fingerprint(
      'post', p_organization_id, p_type, p_transaction_date, p_lines,
      v_currency, v_rate, v_base_currency, p_description, p_reference,
      p_counterparty_id, p_category_id, p_memo, p_adjustment_reason,
      p_source, p_metadata, p_fingerprint);
    v_existing := app.claim_posting_idempotency(p_organization_id, p_idempotency_key, 'post', v_request_fingerprint);
    if v_existing is not null then return v_existing; end if;
  end if;
  perform app.assert_accounting_period_allows(
    p_organization_id, p_transaction_date, p_type, p_source, p_adjustment_reason);
  v_txn_id := public.create_draft_transaction(
    p_organization_id => p_organization_id, p_type => p_type,
    p_transaction_date => p_transaction_date, p_lines => p_lines,
    p_currency_code => v_currency, p_exchange_rate => v_rate,
    p_description => p_description, p_reference => p_reference,
    p_counterparty_id => p_counterparty_id, p_category_id => p_category_id,
    p_memo => p_memo, p_adjustment_reason => p_adjustment_reason,
    p_source => p_source, p_idempotency_key => null, p_metadata => p_metadata);
  if p_idempotency_key is not null then
    update public.transactions set idempotency_key = p_idempotency_key where id = v_txn_id;
  end if;
  if p_fingerprint is not null then
    update public.transactions transaction set fingerprint = p_fingerprint,
      possible_duplicate = exists (select 1 from public.transactions duplicate
        where duplicate.organization_id = p_organization_id and duplicate.fingerprint = p_fingerprint
          and duplicate.id <> transaction.id and duplicate.status = 'posted'),
      duplicate_of_transaction_id = (select duplicate.id from public.transactions duplicate
        where duplicate.organization_id = p_organization_id and duplicate.fingerprint = p_fingerprint
          and duplicate.id <> transaction.id and duplicate.status = 'posted'
        order by duplicate.created_at limit 1)
    where transaction.id = v_txn_id;
  end if;
  perform public.post_transaction(v_txn_id);
  if p_idempotency_key is not null then
    perform app.complete_posting_idempotency(p_organization_id, p_idempotency_key, 'post', v_request_fingerprint, v_txn_id);
  end if;
  return v_txn_id;
end;
$$;

create or replace function public.post_transaction(p_transaction_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_txn public.transactions%rowtype; v_now timestamptz := now();
begin
  select * into v_txn from public.transactions t where t.id = p_transaction_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED: transaction not found' using errcode = '42501'; end if;
  perform app.require_capability(v_txn.organization_id, 'transactions.post');
  if v_txn.type = 'adjustment' then perform app.require_capability(v_txn.organization_id, 'transactions.adjust'); end if;
  perform app.assert_accounting_period_allows(v_txn.organization_id, v_txn.transaction_date,
    v_txn.type, v_txn.source, v_txn.adjustment_reason);
  if v_txn.status not in ('draft', 'scheduled', 'pending', 'pending_approval') or v_txn.deleted_at is not null then
    raise exception 'INVALID_TRANSACTION_STATE: cannot post this transaction' using errcode = '23514';
  end if;
  update public.transaction_entries set posted_at = v_now where transaction_id = p_transaction_id;
  update public.transactions set status = 'posted', posted_at = v_now, posted_by = auth.uid(),
    posting_date = coalesce(posting_date, app.org_today(organization_id)) where id = p_transaction_id;
  perform app.write_audit(v_txn.organization_id, 'transaction.posted', 'transaction', p_transaction_id,
    jsonb_build_object('status', v_txn.status), jsonb_build_object('status', 'posted'));
  return p_transaction_id;
end;
$$;

create or replace function public.close_fiscal_year(
  p_organization_id uuid, p_fiscal_year_start date, p_reason text,
  p_idempotency_key text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_start date; v_end date; v_retained uuid; v_lines jsonb; v_net bigint;
  v_close_id uuid; v_transaction_id uuid; v_existing uuid;
begin
  perform app.require_capability(p_organization_id, 'periods.year_end_close');
  if nullif(btrim(p_reason), '') is null then
    raise exception 'YEAR_END_REASON_REQUIRED' using errcode = '22023';
  end if;
  select fiscal_year_start, fiscal_year_end into v_start, v_end
    from app.fiscal_year_bounds(p_organization_id, p_fiscal_year_start);
  if v_start <> p_fiscal_year_start then
    raise exception 'INVALID_FISCAL_YEAR_START' using errcode = '22023';
  end if;
  perform 1 from public.organization_settings s where s.organization_id = p_organization_id for update;
  select closing_transaction_id into v_existing from public.fiscal_year_closes
    where organization_id = p_organization_id and fiscal_year_start = v_start;
  if found then return v_existing; end if;
  if not exists (select 1 from public.accounting_periods p
      where p.organization_id = p_organization_id and p.fiscal_year_start = v_start) then
    raise exception 'FISCAL_YEAR_PERIODS_REQUIRED' using errcode = '23514';
  end if;
  if exists (select 1 from public.accounting_periods p
      where p.organization_id = p_organization_id and p.fiscal_year_start = v_start and p.status = 'open') then
    raise exception 'FISCAL_YEAR_HAS_OPEN_PERIODS' using errcode = '23514';
  end if;
  if exists (select 1 from public.accounting_periods p
      where p.organization_id = p_organization_id and p.fiscal_year_start = v_start and p.status = 'hard_closed') then
    raise exception 'FISCAL_YEAR_HARD_CLOSED' using errcode = '23514';
  end if;
  select a.id into v_retained from public.accounts a
    where a.organization_id = p_organization_id and a.system_key = 'retained_earnings'
      and a.type = 'equity' and a.account_role = 'posting' and not a.is_archived;
  if v_retained is null then raise exception 'INVALID_RETAINED_EARNINGS_ACCOUNT' using errcode = '23514'; end if;

  with balances as (
    select a.id, coalesce(sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end),0)::bigint net_debit
    from public.accounts a join public.transaction_entries e on e.account_id=a.id and e.organization_id=a.organization_id
    join public.transactions t on t.id=e.transaction_id
    where a.organization_id=p_organization_id and a.type in ('revenue','expense')
      and e.posted_at is not null and e.entry_date between v_start and v_end
      and t.source <> 'year_end_close'
    group by a.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'account_id', id,
      'side', case when net_debit > 0 then 'credit' else 'debit' end,
      'amount_minor', abs(net_debit)
    )) filter (where net_debit <> 0), '[]'::jsonb),
    -coalesce(sum(net_debit), 0)::bigint
  into v_lines, v_net from balances;
  if v_net <> 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_id', v_retained,
      'side', case when v_net > 0 then 'credit' else 'debit' end, 'amount_minor', abs(v_net)));
  end if;
  if jsonb_array_length(v_lines) < 2 then raise exception 'YEAR_END_HAS_NO_RESULT' using errcode = '23514'; end if;

  v_close_id := gen_random_uuid();
  v_transaction_id := app.create_and_post(
    p_organization_id => p_organization_id, p_type => 'adjustment', p_transaction_date => v_end,
    p_lines => v_lines, p_description => 'Fiscal year-end close',
    p_adjustment_reason => btrim(p_reason), p_source => 'year_end_close',
    p_idempotency_key => coalesce(p_idempotency_key, 'year-end:' || v_start::text),
    p_metadata => jsonb_build_object('fiscal_year_start', v_start, 'fiscal_year_end', v_end, 'fiscal_year_close_id', v_close_id));
  insert into public.fiscal_year_closes (id, organization_id, fiscal_year_start, fiscal_year_end,
    closing_transaction_id, retained_earnings_account_id, net_income_minor, reason, closed_by)
  values (v_close_id, p_organization_id, v_start, v_end, v_transaction_id,
    v_retained, v_net, btrim(p_reason), auth.uid());
  perform app.write_audit(p_organization_id, 'fiscal_year.closed', 'fiscal_year_close', v_close_id,
    null, jsonb_build_object('transaction_id', v_transaction_id, 'net_income_minor', v_net, 'reason', btrim(p_reason)));
  return v_transaction_id;
end;
$$;

-- Closing journals remain in the GL and Trial Balance, but never zero the
-- historical operating P&L for the fiscal year they close.
create or replace function public.report_profit_and_loss(
  p_organization_id uuid, p_from_date date, p_to_date date
)
returns table (section text, account_id uuid, code text, name text, amount_minor bigint)
language plpgsql stable set search_path = '' as $$
begin
  perform app.require_capability(p_organization_id, 'reports.read');
  if p_from_date > p_to_date then raise exception 'INVALID_DATE_RANGE: from date is after to date' using errcode='22023'; end if;
  return query
  with movements as (
    select a.id,a.code,a.name,a.type,a.subtype,
      coalesce(sum(e.base_amount_minor) filter(where e.side='debit'),0) dr,
      coalesce(sum(e.base_amount_minor) filter(where e.side='credit'),0) cr
    from public.accounts a join public.transaction_entries e on e.account_id=a.id and e.posted_at is not null
    join public.transactions t on t.id=e.transaction_id and t.source <> 'year_end_close'
    where a.organization_id=p_organization_id and a.type in ('revenue','expense')
      and e.entry_date between p_from_date and p_to_date
    group by a.id,a.code,a.name,a.type,a.subtype
  )
  select case when m.type='revenue' then 'revenue' when m.subtype='cost_of_sales' then 'cost_of_sales' else 'operating_expenses' end,
    m.id,m.code,m.name,(case when m.type='revenue' then m.cr-m.dr else m.dr-m.cr end)::bigint
  from movements m order by 1,m.code nulls last,m.name;
end;
$$;

revoke all on function public.accounting_period_context(uuid,date),
  public.create_accounting_period(uuid,date,date),
  public.transition_accounting_period(uuid,public.accounting_period_status,text),
  public.close_fiscal_year(uuid,date,text,text) from public, anon;
grant execute on function public.accounting_period_context(uuid,date),
  public.create_accounting_period(uuid,date,date),
  public.transition_accounting_period(uuid,public.accounting_period_status,text),
  public.close_fiscal_year(uuid,date,text,text) to authenticated;
grant execute on function app.fiscal_year_bounds(uuid,date),
  app.assert_accounting_period_allows(uuid,date,public.transaction_type,public.transaction_source,text)
  to authenticated, service_role;

comment on table public.accounting_periods is
  'Organization-scoped non-overlapping periods. Status changes only through transition_accounting_period.';
comment on table public.accounting_period_transitions is
  'Append-only actor/time/reason history for every accounting-period transition.';
comment on table public.fiscal_year_closes is
  'One immutable relationship between a fiscal year, its calculated result, retained earnings, and its closing journal.';
comment on function app.assert_accounting_period_allows(uuid,date,public.transaction_type,public.transaction_source,text) is
  'Shared posting guard and organization-scoped close/post serialization point. Legacy books_locked_until remains inclusive with its former override semantics.';
