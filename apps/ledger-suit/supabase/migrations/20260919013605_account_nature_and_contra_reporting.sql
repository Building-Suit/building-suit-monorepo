-- Account nature is independent of statement signs and actual debit/credit.
-- DROP EXPRESSION retains every stored value; no account or journal is backfilled.
alter table public.accounts alter column normal_balance drop expression;
alter table public.accounts add column contra_account_id uuid;
alter table public.accounts add constraint accounts_contra_same_org
  foreign key (contra_account_id, organization_id)
  references public.accounts (id, organization_id) on delete restrict;
alter table public.accounts add constraint accounts_contra_not_self
  check (contra_account_id is distinct from id);
create index accounts_contra_idx on public.accounts (contra_account_id)
  where contra_account_id is not null;

comment on column public.accounts.normal_balance is
  'Expected balance side, independent of actual balance and statement presentation. Existing values are preserved.';
comment on column public.accounts.contra_account_id is
  'Optional account reduced by this contra account; same tenant, type and currency, opposite nature. Not a journal counterparty.';

create or replace function app.guard_account_nature()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.accounts%rowtype;
begin
  if tg_op = 'INSERT' then
    new.normal_balance := coalesce(new.normal_balance,
      case when new.subtype = 'owner_drawings' then 'debit'::public.normal_balance
           else app.normal_balance_for(new.type) end);
  elsif row(new.normal_balance, new.contra_account_id, new.type, new.subtype, new.currency)
      is distinct from row(old.normal_balance, old.contra_account_id, old.type, old.subtype, old.currency) then
    if old.is_system then
      raise exception 'SYSTEM_ACCOUNT_PROTECTED: accounting classification is fixed'
        using errcode = '42501';
    end if;
    -- Includes drafts and reversed entries, even if the editor cannot read them.
    if exists (select 1 from public.transaction_entries e where e.account_id = old.id) then
      raise exception 'ACCOUNT_HAS_LEDGER_HISTORY: classification requires a reviewed migration'
        using errcode = '23514';
    end if;
    if exists (select 1 from public.accounts a where a.contra_account_id = old.id) then
      raise exception 'ACCOUNT_CONTRA_REFERENCED: classification is used by a contra account'
        using errcode = '23514';
    end if;
  else
    return new;
  end if;

  if new.contra_account_id is not null then
    -- SHARE serializes link creation against target classification edits.
    select * into v_target from public.accounts a
    where a.id = new.contra_account_id and a.organization_id = new.organization_id
    for share;
    if not found then
      raise exception 'INVALID_CONTRA_ACCOUNT: select an account in this organization'
        using errcode = '23514';
    end if;
    if v_target.id = new.id or v_target.contra_account_id is not null
       or v_target.type <> new.type or v_target.currency <> new.currency
       or v_target.normal_balance = new.normal_balance or v_target.is_archived then
      raise exception 'INVALID_CONTRA_ACCOUNT: incompatible target or contra chain'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger accounts_guard_nature
  before insert or update on public.accounts
  for each row execute function app.guard_account_nature();
revoke all on function app.guard_account_nature() from public, anon, authenticated;

-- The row lock must also be taken by direct entry writes, not only posting RPCs.
-- A concurrent first entry and classification edit therefore have a serial order.
create or replace function app.lock_entry_account_nature()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.accounts a
  where a.id = new.account_id and a.organization_id = new.organization_id
  for share;
  return new;
end;
$$;
create trigger transaction_entries_lock_account_nature
  before insert or update of account_id on public.transaction_entries
  for each row execute function app.lock_entry_account_nature();
revoke all on function app.lock_entry_account_nature() from public, anon, authenticated;


-- Replace the signature instead of leaving ambiguous PostgREST overloads.
-- Old positional/named calls still work through the trailing defaults.
drop function public.create_account(uuid, text, public.account_type, public.account_subtype, char, text, uuid);
create or replace function public.create_account(
  p_organization_id uuid,
  p_name text,
  p_type public.account_type,
  p_subtype public.account_subtype,
  p_currency char(3) default null,
  p_code text default null,
  p_parent_account_id uuid default null,
  p_normal_balance public.normal_balance default null,
  p_contra_account_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_system_key text;
begin
  perform app.require_capability(p_organization_id, 'accounts.create');
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'INVALID_INPUT: account name is required' using errcode = '22023';
  end if;
  if p_parent_account_id is not null then
    perform app.require_account(p_organization_id, p_parent_account_id,
      array[p_type]::public.account_type[], 'parent account');
  end if;

  if p_subtype::text in (
    'bank_fees', 'interest_expense', 'owner_capital', 'owner_drawings',
    'opening_balance_equity'
  ) and not exists (
    select 1 from public.accounts a
    where a.organization_id = p_organization_id
      and a.system_key = p_subtype::text
  ) then
    v_system_key := p_subtype::text;
  end if;

  insert into public.accounts (
    organization_id, code, name, type, subtype, currency,
    parent_account_id, system_key, created_by, normal_balance, contra_account_id
  ) values (
    p_organization_id, nullif(trim(p_code), ''), trim(p_name), p_type,
    p_subtype, coalesce(p_currency, app.org_base_currency(p_organization_id)),
    p_parent_account_id, v_system_key, auth.uid(), p_normal_balance, p_contra_account_id
  ) returning id into v_id;

  if p_type in ('revenue', 'expense') then
    insert into public.categories (
      organization_id, name, kind, default_account_id, created_by
    ) values (
      p_organization_id,
      trim(p_name),
      case when p_type = 'revenue'
        then 'income'::public.category_kind
        else 'expense'::public.category_kind
      end,
      v_id,
      auth.uid()
    )
    on conflict (organization_id, lower(name)) do update
      set default_account_id = excluded.default_account_id,
          kind = excluded.kind,
          is_active = true;
  end if;

  perform app.write_audit(p_organization_id, 'account.created', 'account', v_id,
    null, jsonb_build_object('name', trim(p_name), 'type', p_type, 'subtype', p_subtype,
      'normal_balance', (select a.normal_balance from public.accounts a where a.id = v_id),
      'contra_account_id', p_contra_account_id));
  return v_id;
end;
$$;


drop function public.update_account(uuid, text, text);
create or replace function public.update_account(
  p_account_id uuid,
  p_name text,
  p_code text default null,
  p_normal_balance public.normal_balance default null,
  p_contra_account_id uuid default null,
  p_clear_contra boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.accounts%rowtype;
begin
  select * into v_row from public.accounts a where a.id = p_account_id for update;
  if not found then
    raise exception 'TENANT_ACCESS_DENIED: account not found' using errcode = '42501';
  end if;
  perform app.require_capability(v_row.organization_id, 'accounts.update');
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'INVALID_INPUT: account name is required' using errcode = '22023';
  end if;
  update public.accounts a
  set name = trim(p_name), code = nullif(trim(p_code), ''),
      normal_balance = coalesce(p_normal_balance, a.normal_balance),
      contra_account_id = case when p_clear_contra then null
        else coalesce(p_contra_account_id, a.contra_account_id) end
  where a.id = p_account_id;
  perform app.write_audit(v_row.organization_id, 'account.updated', 'account', p_account_id,
    jsonb_build_object('name', v_row.name, 'code', v_row.code,
      'normal_balance', v_row.normal_balance, 'contra_account_id', v_row.contra_account_id),
    (select jsonb_build_object('name', a.name, 'code', a.code,
      'normal_balance', a.normal_balance, 'contra_account_id', a.contra_account_id)
     from public.accounts a where a.id = p_account_id));
  return p_account_id;
end;
$$;



revoke all on function public.create_account(uuid, text, public.account_type, public.account_subtype, char, text, uuid, public.normal_balance, uuid),
  public.update_account(uuid, text, text, public.normal_balance, uuid, boolean) from public, anon;
grant execute on function public.create_account(uuid, text, public.account_type, public.account_subtype, char, text, uuid, public.normal_balance, uuid),
  public.update_account(uuid, text, text, public.normal_balance, uuid, boolean) to authenticated, service_role;


create or replace function app.enforce_row_write_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_old_row jsonb;
  v_currency text := v_row ->> tg_argv[0];
  v_account_currency char(3);
begin
  if tg_op = 'UPDATE' then
    v_old_row := to_jsonb(old);

    -- Downgrades freeze new FX activity, but must not trap customers in live
    -- resources. Permit only tightly-scoped closing transitions.
    if tg_table_name = 'accounts'
       and v_old_row ->> 'currency' = v_row ->> 'currency'
       and not (v_old_row ->> 'is_archived')::boolean
       and (v_row ->> 'is_archived')::boolean
       and (v_row - array['is_archived', 'archived_at', 'updated_at',
                          'is_liquid'])
           = (v_old_row - array['is_archived', 'archived_at', 'updated_at',
                                'is_liquid']) then
      return new;
    elsif tg_table_name = 'transactions'
       and v_old_row ->> 'currency_code' = v_row ->> 'currency_code'
       and v_old_row ->> 'status' not in ('voided', 'reversed')
       and v_row ->> 'status' = 'voided'
       and (v_row - array['status', 'voided_at', 'voided_by', 'metadata', 'updated_at'])
           = (v_old_row - array['status', 'voided_at', 'voided_by', 'metadata', 'updated_at']) then
      return new;
    elsif tg_table_name = 'commitments'
       and v_old_row ->> 'currency_code' = v_row ->> 'currency_code'
       and v_old_row ->> 'status' <> 'cancelled'
       and v_row ->> 'status' = 'cancelled'
       and (v_row - array['status', 'cancelled_at', 'cancelled_reason', 'updated_at'])
           = (v_old_row - array['status', 'cancelled_at', 'cancelled_reason', 'updated_at']) then
      return new;
    end if;
  end if;

  perform app.assert_write_currency((v_row ->> 'organization_id')::uuid, v_currency);

  if tg_table_name = 'transaction_entries' then
    select a.currency into v_account_currency
    from public.accounts a
    where a.id = (v_row ->> 'account_id')::uuid
      and a.organization_id = (v_row ->> 'organization_id')::uuid;
    if found then
      perform app.assert_write_currency(
        (v_row ->> 'organization_id')::uuid,
        v_account_currency
      );
    end if;
  elsif tg_table_name = 'commitments' then
    foreach v_currency in array array[
      v_row ->> 'linked_account_id', v_row ->> 'auto_payment_account_id'
    ] loop
      if nullif(v_currency, '') is not null then
        select a.currency into v_account_currency
        from public.accounts a
        where a.id = v_currency::uuid
          and a.organization_id = (v_row ->> 'organization_id')::uuid;
        if found then
          perform app.assert_write_currency(
            (v_row ->> 'organization_id')::uuid,
            v_account_currency
          );
        end if;
      end if;
    end loop;
  end if;

  return new;
end;
$$;



-- Add exact text amounts without changing existing view column contracts.
create or replace view public.account_balances
with (security_invoker = true) as
select
  a.organization_id,
  a.id                as account_id,
  a.code,
  a.name,
  a.type,
  a.subtype,
  a.normal_balance,
  a.currency,
  a.is_liquid,
  a.is_archived,
  a.parent_account_id,
  coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)::bigint  as debit_minor,
  coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)::bigint as credit_minor,
  -- Signed so that a positive number always means "more of what this account
  -- normally holds", which is what a non-accountant expects to see.
  (case when a.normal_balance = 'debit'
        then coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
           - coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
        else coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
           - coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
   end)::bigint as balance_minor,
  count(e.id) as entry_count,
  a.contra_account_id,
  a.is_system,
  (coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
    - coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0))::text as net_debit_minor,
  ((case when a.type in ('asset', 'expense') then 1 else -1 end)
    * (coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
       - coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)))::text as statement_balance_minor,
  exists (select 1 from public.transaction_entries history where history.account_id = a.id) as classification_locked
from public.accounts a
left join public.transaction_entries e
  on e.account_id = a.id
 and e.posted_at is not null
group by a.organization_id, a.id;



-- Statement signs follow the account type, never its chosen natural side.
create or replace function public.report_profit_and_loss(
  p_organization_id uuid,
  p_from_date       date,
  p_to_date         date
)
returns table (
  section        text,
  account_id     uuid,
  code           text,
  name           text,
  amount_minor   bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  perform app.require_capability(p_organization_id, 'reports.read');

  if p_from_date > p_to_date then
    raise exception 'INVALID_DATE_RANGE: from date is after to date'
      using errcode = '22023';
  end if;

  return query
  with movements as (
    select
      a.id, a.code, a.name, a.type, a.subtype, a.normal_balance,
      coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)  as dr,
      coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0) as cr
    from public.accounts a
    join public.transaction_entries e
      on e.account_id = a.id
     and e.posted_at is not null
     and e.entry_date between p_from_date and p_to_date
    where a.organization_id = p_organization_id
      and a.type in ('revenue', 'expense')
    group by a.id, a.code, a.name, a.type, a.subtype, a.normal_balance
  )
  select
    case
      when m.type = 'revenue' then 'revenue'
      when m.subtype = 'cost_of_sales' then 'cost_of_sales'
      else 'operating_expenses'
    end,
    m.id, m.code, m.name,
    (case when m.type = 'revenue' then m.cr - m.dr else m.dr - m.cr end)::bigint
  from movements m
  order by 1, m.code nulls last, m.name;
end;
$$;

-- Statement signs follow the account type, never its chosen natural side.
create or replace function public.report_balance_sheet(
  p_organization_id uuid,
  p_as_of_date      date default null
)
returns table (
  section      text,
  account_id   uuid,
  code         text,
  name         text,
  amount_minor bigint
)
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
      a.id, a.code, a.name, a.type, a.normal_balance,
      (case when a.type in ('asset', 'expense')
            then coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
               - coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
            else coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
               - coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
       end)::bigint as balance
    from public.accounts a
    join public.transaction_entries e
      on e.account_id = a.id
     and e.posted_at is not null
     and e.entry_date <= v_as_of
    where a.organization_id = p_organization_id
    group by a.id, a.code, a.name, a.type, a.normal_balance
  )
  select b.type::text, b.id, b.code, b.name, b.balance
  from balances b
  where b.type in ('asset', 'liability', 'equity')
    and b.balance <> 0

  union all

  -- Revenue less expenses for every period up to the reporting date. Without
  -- this line the statement cannot balance, because profit has not been closed
  -- into retained earnings yet.
  select
    'equity', null::uuid, null::text, 'Net profit for the period',
    coalesce(sum(case when b.type = 'revenue' then b.balance else -b.balance end), 0)::bigint
  from balances b
  where b.type in ('revenue', 'expense')
  having coalesce(sum(case when b.type = 'revenue' then b.balance else -b.balance end), 0) <> 0

  order by 1, 3 nulls last, 4;
end;
$$;

-- Statement signs follow the account type, never its chosen natural side.
create or replace function public.check_balance_sheet_integrity(
  p_organization_id uuid,
  p_as_of_date      date default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_as_of date := coalesce(p_as_of_date, app.org_today(p_organization_id));
  v_assets bigint := 0;
  v_liabilities bigint := 0;
  v_equity bigint := 0;
  v_net_income bigint := 0;
  v_difference bigint;
begin
  perform app.require_capability(p_organization_id, 'reports.read');

  select
    coalesce(sum(case when b.type = 'asset'     then b.amount else 0 end), 0),
    coalesce(sum(case when b.type = 'liability' then b.amount else 0 end), 0),
    coalesce(sum(case when b.type = 'equity'    then b.amount else 0 end), 0),
    coalesce(sum(case when b.type = 'revenue'   then b.amount
                      when b.type = 'expense'   then -b.amount
                      else 0 end), 0)
  into v_assets, v_liabilities, v_equity, v_net_income
  from (
    select
      a.type,
      case when a.type in ('asset', 'expense')
           then coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
              - coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
           else coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
              - coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
      end as amount
    from public.accounts a
    join public.transaction_entries e
      on e.account_id = a.id
     and e.posted_at is not null
     and e.entry_date <= v_as_of
    where a.organization_id = p_organization_id
    group by a.id, a.type, a.normal_balance
  ) b;

  v_difference := v_assets - (v_liabilities + v_equity + v_net_income);

  return jsonb_build_object(
    'as_of',            v_as_of,
    'assets_minor',     v_assets,
    'liabilities_minor', v_liabilities,
    'equity_minor',     v_equity,
    'net_income_minor', v_net_income,
    'difference_minor', v_difference,
    'balanced',         v_difference = 0
  );
end;
$$;

-- Statement signs follow the account type, never its chosen natural side.
create or replace function public.dashboard_summary(
  p_organization_id uuid,
  p_as_of_date      date default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_as_of        date := coalesce(p_as_of_date, app.org_today(p_organization_id));
  v_month_start  date := date_trunc('month', v_as_of)::date;
  v_prev_start   date := (date_trunc('month', v_as_of) - interval '1 month')::date;
  v_prev_end     date := (date_trunc('month', v_as_of) - interval '1 day')::date;
  v_assets       bigint;
  v_liabilities  bigint;
  v_cash         bigint;
  v_receivable   bigint;
  v_payable      bigint;
  v_revenue      bigint;
  v_expenses     bigint;
  v_prev_revenue bigint;
  v_prev_expenses bigint;
begin
  perform app.require_capability(p_organization_id, 'reports.read');

  with balances as (
    select
      a.type, a.subtype, a.is_liquid,
      case when a.type in ('asset', 'expense')
           then coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
              - coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
           else coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)
              - coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
      end as amount
    from public.accounts a
    left join public.transaction_entries e
      on e.account_id = a.id
     and e.posted_at is not null
     and e.entry_date <= v_as_of
    where a.organization_id = p_organization_id
    group by a.id, a.type, a.subtype, a.is_liquid
  )
  select
    coalesce(sum(amount) filter (where type = 'asset'), 0),
    coalesce(sum(amount) filter (where type = 'liability'), 0),
    coalesce(sum(amount) filter (where is_liquid), 0),
    coalesce(sum(amount) filter (where subtype = 'accounts_receivable'), 0),
    coalesce(sum(amount) filter (where subtype = 'accounts_payable'), 0)
  into v_assets, v_liabilities, v_cash, v_receivable, v_payable
  from balances;

  select
    coalesce(sum(case when a.type = 'revenue'
                      then case when e.side = 'credit' then e.base_amount_minor
                                else -e.base_amount_minor end end), 0),
    coalesce(sum(case when a.type = 'expense'
                      then case when e.side = 'debit' then e.base_amount_minor
                                else -e.base_amount_minor end end), 0)
  into v_revenue, v_expenses
  from public.transaction_entries e
  join public.accounts a on a.id = e.account_id
  where e.organization_id = p_organization_id
    and e.posted_at is not null
    and e.entry_date between v_month_start and v_as_of;

  select
    coalesce(sum(case when a.type = 'revenue'
                      then case when e.side = 'credit' then e.base_amount_minor
                                else -e.base_amount_minor end end), 0),
    coalesce(sum(case when a.type = 'expense'
                      then case when e.side = 'debit' then e.base_amount_minor
                                else -e.base_amount_minor end end), 0)
  into v_prev_revenue, v_prev_expenses
  from public.transaction_entries e
  join public.accounts a on a.id = e.account_id
  where e.organization_id = p_organization_id
    and e.posted_at is not null
    and e.entry_date between v_prev_start and v_prev_end;

  return jsonb_build_object(
    'as_of',                v_as_of,
    'base_currency',        app.org_base_currency(p_organization_id),
    'total_assets_minor',   v_assets,
    'total_liabilities_minor', v_liabilities,
    'net_worth_minor',      v_assets - v_liabilities,
    'cash_and_bank_minor',  v_cash,
    'accounts_receivable_minor', v_receivable,
    'accounts_payable_minor',    v_payable,
    'revenue_this_month_minor',  v_revenue,
    'expenses_this_month_minor', v_expenses,
    'net_profit_this_month_minor', v_revenue - v_expenses,
    'revenue_previous_month_minor',  v_prev_revenue,
    'expenses_previous_month_minor', v_prev_expenses,
    'net_profit_previous_month_minor', v_prev_revenue - v_prev_expenses
  );
end;
$$;

-- Archiving prevents new use but must retain the account ledger for review.
create or replace function public.report_general_ledger(
  p_organization_id uuid,
  p_account_id      uuid,
  p_from_date       date,
  p_to_date         date
)
returns table (
  entry_id        uuid,
  transaction_id  uuid,
  entry_date      date,
  reference       text,
  description     text,
  memo            text,
  debit_minor     bigint,
  credit_minor    bigint,
  running_balance_minor bigint
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_opening bigint;
  v_sign    int;
begin
  perform app.require_capability(p_organization_id, 'reports.read');

  select case when a.normal_balance = 'debit' then 1 else -1 end
  into v_sign
  from public.accounts a
  where a.id = p_account_id and a.organization_id = p_organization_id;
  if not found then
    raise exception 'TENANT_ACCESS_DENIED: account not found' using errcode = '42501';
  end if;

  select coalesce(sum(
           case when e.side = 'debit' then e.base_amount_minor
                else -e.base_amount_minor end), 0) * v_sign
  into v_opening
  from public.transaction_entries e
  where e.account_id = p_account_id
    and e.posted_at is not null
    and e.entry_date < p_from_date;

  return query
  select
    e.id, e.transaction_id, e.entry_date, t.reference, t.description, e.memo,
    case when e.side = 'debit'  then e.base_amount_minor else 0 end,
    case when e.side = 'credit' then e.base_amount_minor else 0 end,
    (v_opening + sum(
      case when e.side = 'debit' then e.base_amount_minor
           else -e.base_amount_minor end * v_sign
    ) over (order by e.entry_date, e.created_at, e.id
            rows between unbounded preceding and current row))::bigint
  from public.transaction_entries e
  join public.transactions t on t.id = e.transaction_id
  where e.account_id = p_account_id
    and e.posted_at is not null
    and e.entry_date between p_from_date and p_to_date
  order by e.entry_date, e.created_at, e.id;
end;
$$;
