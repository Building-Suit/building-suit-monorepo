-- LS-FIX-002 / FS-08: preserve prospective account-label history without
-- rewriting posted journals or changing any report arithmetic.

create table public.account_label_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null,
  name text not null check (char_length(name) between 1 and 160),
  revision bigint generated always as identity unique,
  recorded_at timestamptz not null default clock_timestamp(),
  recorded_by uuid references public.profiles(id) on delete set null,
  foreign key (account_id, organization_id)
    references public.accounts(id, organization_id) on delete cascade
);

create index account_label_versions_lookup_idx
  on public.account_label_versions(account_id, recorded_at desc, revision desc);

comment on table public.account_label_versions is
  'Append-only prospective account-name history. The migration baseline is the earliest provable label; names used before this migration cannot be reconstructed.';

alter table public.account_label_versions enable row level security;
revoke all on public.account_label_versions from public, anon, authenticated, service_role;
grant select on public.account_label_versions to authenticated, service_role;
create policy "account label history follows account or report access"
  on public.account_label_versions for select to authenticated
  using (
    app.has_capability(organization_id, 'accounts.read')
    or app.has_capability(organization_id, 'reports.read')
  );
create trigger account_label_versions_immutable
  before update on public.account_label_versions
  for each row execute function app.reject_mutation();

-- Establish only the label that is provable at migration time. This does not
-- pretend that earlier account names were versioned.
insert into public.account_label_versions(
  organization_id, account_id, name, recorded_at, recorded_by
)
select a.organization_id, a.id, a.name, clock_timestamp(), a.created_by
from public.accounts a;

create function app.capture_account_label_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    insert into public.account_label_versions(
      organization_id, account_id, name, recorded_at, recorded_by
    ) values (
      new.organization_id,
      new.id,
      new.name,
      case when tg_op = 'INSERT' then new.created_at else clock_timestamp() end,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

revoke all on function app.capture_account_label_version()
  from public, anon, authenticated;

create trigger accounts_capture_label_version
  after insert or update of name on public.accounts
  for each row execute function app.capture_account_label_version();

create function app.account_label_at_entry(
  p_account_id uuid,
  p_entry_created_at timestamptz
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select h.name
      from public.account_label_versions h
      where h.account_id = p_account_id
        and h.recorded_at <= p_entry_created_at
      order by h.recorded_at desc, h.revision desc
      limit 1
    ),
    (
      select h.name
      from public.account_label_versions h
      where h.account_id = p_account_id
      order by h.recorded_at, h.revision
      limit 1
    ),
    (select a.name from public.accounts a where a.id = p_account_id)
  );
$$;

revoke all on function app.account_label_at_entry(uuid, timestamptz)
  from public, anon;
grant execute on function app.account_label_at_entry(uuid, timestamptz)
  to authenticated, service_role;

-- The P&L keeps the existing mapping, sign and amount rules. Only its label is
-- selected from the version that existed for the latest included entry in the
-- same account/mapping group.
create or replace function public.report_profit_and_loss(
  p_organization_id uuid,
  p_from_date date,
  p_to_date date
)
returns table(section text, account_id uuid, code text, name text, amount_minor bigint)
language plpgsql
stable
set search_path = ''
as $$
begin
  perform app.require_capability(p_organization_id, 'reports.read');
  if p_from_date is null or p_to_date is null or not isfinite(p_from_date)
    or not isfinite(p_to_date) or p_from_date > p_to_date
  then
    raise exception 'INVALID_DATE_RANGE' using errcode = '22023';
  end if;

  return query
  select
    coalesce(m.statement_line, 'unclassified_' || a.type::text),
    a.id,
    a.code,
    app.account_label_at_entry(a.id, max(e.created_at)),
    sum(
      case when a.type = 'revenue' then
        case when e.side = 'credit' then e.base_amount_minor else -e.base_amount_minor end
      else
        case when e.side = 'debit' then e.base_amount_minor else -e.base_amount_minor end
      end
    )::bigint
  from public.transaction_entries e
  join public.transactions t on t.id = e.transaction_id and t.source <> 'year_end_close'
  join public.accounts a on a.id = e.account_id and a.organization_id = p_organization_id
  left join lateral (
    select h.statement_line
    from public.account_financial_mappings h
    where h.organization_id = p_organization_id
      and h.account_id = a.id
      and h.dimension = 'profit_loss'
      and h.effective_from <= e.entry_date
    order by h.effective_from desc, h.revision desc
    limit 1
  ) m on true
  where e.organization_id = p_organization_id
    and e.posted_at is not null
    and e.entry_date between p_from_date and p_to_date
    and a.type in ('revenue', 'expense')
    and a.account_role in ('posting', 'control')
  group by a.id, a.code, a.type, m.statement_line
  having sum(case when e.side = 'debit' then e.base_amount_minor else -e.base_amount_minor end) <> 0
  order by 1, 3 nulls last, 4;
end;
$$;

-- Balance-sheet arithmetic is unchanged. The displayed label is the version
-- attached to the latest entry included by the as-of date.
create or replace function public.report_balance_sheet(
  p_organization_id uuid,
  p_as_of_date date default null
)
returns table(section text, account_id uuid, code text, name text, amount_minor bigint)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_as_of date := coalesce(p_as_of_date, app.org_today(p_organization_id));
begin
  perform app.require_capability(p_organization_id, 'reports.read');

  return query
  with balances as (
    select
      a.id,
      a.code,
      app.account_label_at_entry(a.id, max(e.created_at)) as name,
      a.type,
      (
        case when a.type in ('asset', 'expense') then
          coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
          - coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
        else
          coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
          - coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
        end
      )::bigint as balance
    from public.accounts a
    join public.transaction_entries e
      on e.account_id = a.id
      and e.posted_at is not null
      and e.entry_date <= v_as_of
    where a.organization_id = p_organization_id
    group by a.id, a.code, a.type
  )
  select b.type::text, b.id, b.code, b.name, b.balance
  from balances b
  where b.type in ('asset', 'liability', 'equity') and b.balance <> 0

  union all

  select
    'equity',
    null::uuid,
    null::text,
    'Net profit for the period',
    coalesce(sum(case when b.type = 'revenue' then b.balance else -b.balance end), 0)::bigint
  from balances b
  where b.type in ('revenue', 'expense')
  having coalesce(sum(case when b.type = 'revenue' then b.balance else -b.balance end), 0) <> 0

  order by 1, 3 nulls last, 4;
end;
$$;

-- Preserve the six-column Trial Balance contract and calculations; choose the
-- label from the latest journal line included by the requested cut-off.
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
      app.account_label_at_entry(a.id, max(e.created_at)) as name,
      a.type,
      a.parent_account_id,
      a.account_role,
      a.normal_balance,
      a.contra_account_id,
      coalesce(sum(
        case when e.entry_date < p_from_date then
          case when e.side = 'debit' then e.base_amount_minor else -e.base_amount_minor end
        else 0 end
      ), 0)::bigint as opening_net,
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
      and a.account_role in ('posting', 'control')
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

-- Posted-line screens resolve the same historical label. Account IDs, codes,
-- journal links and all monetary columns retain their existing sources.
create or replace view public.ledger_entries
with (security_invoker = true) as
select
  e.id as entry_id,
  e.organization_id,
  e.transaction_id,
  e.account_id,
  a.code as account_code,
  app.account_label_at_entry(a.id, e.created_at) as account_name,
  a.type as account_type,
  e.side,
  e.amount_minor,
  e.currency_code,
  e.base_amount_minor,
  e.base_currency_code,
  e.exchange_rate,
  e.entry_date,
  e.posted_at,
  e.memo,
  t.type as transaction_type,
  t.status as transaction_status,
  t.reference,
  t.description,
  t.counterparty_id,
  t.category_id,
  t.created_by
from public.transaction_entries e
join public.transactions t on t.id = e.transaction_id
join public.accounts a on a.id = e.account_id
where e.posted_at is not null;

grant select on public.ledger_entries to authenticated;

create or replace function public.read_activity_journal(
  p_organization_id uuid,
  p_transaction_id uuid
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_transaction public.transactions%rowtype;
  v_rows jsonb;
  v_debits numeric;
  v_credits numeric;
begin
  perform app.require_capability(p_organization_id, 'accounts.read');
  perform app.require_capability(p_organization_id, 'reports.read');
  perform app.require_capability(p_organization_id, 'transactions.read');
  select * into v_transaction
  from public.transactions
  where id = p_transaction_id
    and organization_id = p_organization_id
    and posted_at is not null
    and deleted_at is null;
  if not found then
    raise exception 'TENANT_ACCESS_DENIED' using errcode = '42501';
  end if;

  select
    jsonb_agg(jsonb_build_object(
      'entry_id', e.id,
      'account_id', a.id,
      'account_name', app.account_label_at_entry(a.id, e.created_at),
      'account_code', a.code,
      'memo', e.memo,
      'debit_minor', (case when e.side = 'debit' then e.base_amount_minor else 0 end)::text,
      'credit_minor', (case when e.side = 'credit' then e.base_amount_minor else 0 end)::text,
      'original_amount_minor', e.amount_minor::text,
      'original_currency', e.currency_code
    ) order by e.entry_index),
    coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0),
    coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
  into v_rows, v_debits, v_credits
  from public.transaction_entries e
  join public.accounts a on a.id = e.account_id and a.organization_id = e.organization_id
  where e.organization_id = p_organization_id
    and e.transaction_id = p_transaction_id
    and e.posted_at is not null;

  return jsonb_build_object(
    'id', v_transaction.id,
    'description', v_transaction.description,
    'reference', v_transaction.reference,
    'date', v_transaction.transaction_date,
    'type', v_transaction.type,
    'status', v_transaction.status,
    'reverses_transaction_id', v_transaction.reverses_transaction_id,
    'reversed_by_transaction_id', v_transaction.reversed_by_transaction_id,
    'currency', app.org_base_currency(p_organization_id),
    'debit_minor', v_debits::text,
    'credit_minor', v_credits::text,
    'rows', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.read_activity_journal(uuid, uuid) from public, anon;
grant execute on function public.read_activity_journal(uuid, uuid) to authenticated;
