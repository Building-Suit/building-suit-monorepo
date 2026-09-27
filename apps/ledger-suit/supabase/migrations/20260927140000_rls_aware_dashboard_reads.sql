-- LS-PERF-001: authorize the narrow read once; retain table/view RLS for all
-- direct reads and for page enrichment. No ledger writes or balance cache.
-- app is not a PostgREST-exposed schema. Direct calls still authorize the caller.
create function app.search_transaction_page(
  p_organization_id uuid,
  p_search text default null,
  p_from_date date default null,
  p_to_date date default null,
  p_types public.transaction_type[] default null,
  p_statuses public.transaction_status[] default null,
  p_category_ids uuid[] default null,
  p_account_ids uuid[] default null,
  p_counterparty_ids uuid[] default null,
  p_created_by_ids uuid[] default null,
  p_tag_ids uuid[] default null,
  p_min_amount_minor bigint default null,
  p_max_amount_minor bigint default null,
  p_sort text default 'transaction_date',
  p_direction text default 'desc',
  p_limit int default 50,
  p_offset int default 0,
  p_sources public.transaction_source[] default null
)
returns table (id uuid, total_count bigint, ordinal bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_sort text := lower(coalesce(p_sort, 'transaction_date'));
  v_desc boolean := lower(coalesce(p_direction, 'desc')) <> 'asc';
  v_search boolean := p_search is not null and trim(p_search) <> '';
  v_accounts boolean;
  v_categories boolean;
  v_counterparties boolean;
  v_tags boolean;
begin
  perform app.require_capability(p_organization_id, 'transactions.read');
  -- Preserve the name/tag visibility of the security-invoker summary, including
  -- custom roles and per-member revocations. Evaluate only when filtering needs it.
  if v_search then
    v_accounts := app.has_capability(p_organization_id, 'accounts.read');
    v_categories := app.has_capability(p_organization_id, 'categories.read');
    v_counterparties := app.has_capability(p_organization_id, 'counterparties.read');
  end if;
  if p_tag_ids is not null then
    v_tags := app.has_capability(p_organization_id, 'tags.read');
  end if;
  if v_sort not in ('transaction_date', 'journal_reference', 'type', 'source',
                   'status', 'debit', 'credit', 'created_at') then
    v_sort := 'transaction_date';
  end if;

  return query
  with candidates as (
    select t.id, t.created_at,
      case v_sort
        when 'transaction_date' then to_char(t.transaction_date, 'YYYYMMDD')
        when 'journal_reference' then t.journal_reference
        when 'debit' then lpad(amounts.debit::text, 20, '0')
        when 'credit' then lpad(amounts.credit::text, 20, '0')
        when 'created_at' then to_char(t.created_at, 'YYYYMMDDHH24MISSUS')
        when 'status' then t.status::text
        when 'source' then t.source::text
        else t.type::text
      end as sort_key
    from public.transactions t
    left join lateral (
      select
        coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)::bigint as debit,
        coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)::bigint as credit
      from public.transaction_entries e
      where e.organization_id = p_organization_id and e.transaction_id = t.id
        and (p_min_amount_minor is not null or p_max_amount_minor is not null
             or v_sort in ('debit', 'credit'))
      having p_min_amount_minor is not null or p_max_amount_minor is not null
             or v_sort in ('debit', 'credit')
    ) amounts on true
    where t.organization_id = p_organization_id and t.deleted_at is null
      and (p_from_date is null or t.transaction_date >= p_from_date)
      and (p_to_date is null or t.transaction_date <= p_to_date)
      and (p_types is null or t.type = any(p_types))
      and (p_sources is null or t.source = any(p_sources))
      and (p_statuses is null or t.status = any(p_statuses))
      and (p_category_ids is null or t.category_id = any(p_category_ids))
      and (p_counterparty_ids is null or t.counterparty_id = any(p_counterparty_ids))
      and (p_created_by_ids is null or t.created_by = any(p_created_by_ids))
      and (p_min_amount_minor is null or amounts.debit >= p_min_amount_minor)
      and (p_max_amount_minor is null or amounts.debit <= p_max_amount_minor)
      and (p_account_ids is null or exists (
        select 1 from public.transaction_entries e
        where e.organization_id = p_organization_id and e.transaction_id = t.id
          and e.account_id = any(p_account_ids)
      ))
      and (p_tag_ids is null or (v_tags and exists (
        select 1 from public.transaction_tags tt
        join public.tags tag on tag.id = tt.tag_id and tag.organization_id = p_organization_id
        where tt.organization_id = p_organization_id and tt.transaction_id = t.id
          and tag.id = any(p_tag_ids)
      )))
      and (not v_search
        or t.journal_reference ilike '%' || p_search || '%'
        or t.description ilike '%' || p_search || '%'
        or t.reference ilike '%' || p_search || '%'
        or (v_categories and exists (
          select 1 from public.categories cat
          where cat.organization_id = p_organization_id and cat.id = t.category_id
            and cat.name ilike '%' || p_search || '%'
        ))
        or (v_counterparties and exists (
          select 1 from public.counterparties cp
          where cp.organization_id = p_organization_id and cp.id = t.counterparty_id
            and cp.name ilike '%' || p_search || '%'
        ))
        or (v_accounts and exists (
          -- Match only the largest line on each side, exactly like the summary.
          select 1 from (values ('debit'::public.entry_side), ('credit'::public.entry_side)) sides(side)
          cross join lateral (
            select a.name from public.transaction_entries e
            join public.accounts a on a.id = e.account_id and a.organization_id = p_organization_id
            where e.organization_id = p_organization_id and e.transaction_id = t.id and e.side = sides.side
            order by e.base_amount_minor desc, e.entry_index limit 1
          ) leading_account
          where leading_account.name ilike '%' || p_search || '%'
        ))
      )
  ), page as materialized (
    -- Window/count/sort hold only UUID, timestamp and sort key, never enriched rows.
    select c.id, count(*) over () as total_count,
      row_number() over (order by
        case when v_desc then c.sort_key end desc nulls last,
        case when not v_desc then c.sort_key end asc nulls last,
        c.created_at desc, c.id desc) as ordinal
    from candidates c
    order by
      case when v_desc then c.sort_key end desc nulls last,
      case when not v_desc then c.sort_key end asc nulls last,
      c.created_at desc, c.id desc
    limit v_limit offset v_offset
  )
  select page.id, page.total_count, page.ordinal from page order by page.ordinal;
end;
$$;

create or replace function public.search_transactions(
  p_organization_id uuid,
  p_search text default null,
  p_from_date date default null,
  p_to_date date default null,
  p_types public.transaction_type[] default null,
  p_statuses public.transaction_status[] default null,
  p_category_ids uuid[] default null,
  p_account_ids uuid[] default null,
  p_counterparty_ids uuid[] default null,
  p_created_by_ids uuid[] default null,
  p_tag_ids uuid[] default null,
  p_min_amount_minor bigint default null,
  p_max_amount_minor bigint default null,
  p_sort text default 'transaction_date',
  p_direction text default 'desc',
  p_limit int default 50,
  p_offset int default 0,
  p_sources public.transaction_source[] default null
)
returns table (
  id uuid,
  journal_reference text,
  transaction_date date,
  type public.transaction_type,
  source public.transaction_source,
  status public.transaction_status,
  description text,
  reference text,
  currency_code char(3),
  debit_minor bigint,
  credit_minor bigint,
  base_debit_minor bigint,
  base_credit_minor bigint,
  category_name text,
  counterparty_name text,
  from_account_name text,
  to_account_name text,
  created_by_name text,
  tags text[],
  attachment_count int,
  possible_duplicate boolean,
  reverses_transaction_id uuid,
  reversed_by_transaction_id uuid,
  correction_of_transaction_id uuid,
  source_record_kind text,
  source_record_id uuid,
  source_record_parent_id uuid,
  total_count bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  return query
  with page as materialized (
    select * from app.search_transaction_page(p_organization_id, p_search, p_from_date, p_to_date, p_types, p_statuses,
      p_category_ids, p_account_ids, p_counterparty_ids, p_created_by_ids,
      p_tag_ids, p_min_amount_minor, p_max_amount_minor, p_sort, p_direction,
      p_limit, p_offset, p_sources)
  )
  select
    filtered.id, filtered.journal_reference, filtered.transaction_date,
    filtered.type, filtered.source, filtered.status, filtered.description,
    filtered.reference, filtered.currency_code, filtered.debit_minor,
    filtered.credit_minor, filtered.base_debit_minor, filtered.base_credit_minor,
    filtered.category_name, filtered.counterparty_name,
    filtered.from_account_name, filtered.to_account_name,
    filtered.created_by_name, filtered.tags, filtered.attachment_count,
    filtered.possible_duplicate, filtered.reverses_transaction_id,
    filtered.reversed_by_transaction_id, filtered.correction_of_transaction_id,
    filtered.source_record_kind, filtered.source_record_id,
    filtered.source_record_parent_id, page.total_count
  from page
  cross join lateral (
    select summary.* from public.transaction_summaries summary
    where summary.organization_id = p_organization_id and summary.id = page.id
    offset 0 -- Keep the parameterized enrichment behind the page boundary.
  ) filtered
  order by page.ordinal;
end;
$$;

create or replace function public.dashboard_summary(
  p_organization_id uuid,
  p_as_of_date      date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_accounts boolean;
  v_entries boolean;
  v_as_of        date;
  v_month_start  date;
  v_prev_start   date;
  v_prev_end     date;
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
  v_accounts := app.has_capability(p_organization_id, 'accounts.read');
  v_entries := app.has_capability(p_organization_id, 'transactions.read');
  v_as_of := coalesce(p_as_of_date, app.org_today(p_organization_id));
  v_month_start := date_trunc('month', v_as_of)::date;
  v_prev_start := (date_trunc('month', v_as_of) - interval '1 month')::date;
  v_prev_end := (date_trunc('month', v_as_of) - interval '1 day')::date;

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
     and e.organization_id = p_organization_id and v_entries
     and e.posted_at is not null
     and e.entry_date <= v_as_of
    where a.organization_id = p_organization_id and v_accounts
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
  join public.accounts a on a.id = e.account_id and a.organization_id = p_organization_id
  where e.organization_id = p_organization_id and v_accounts and v_entries
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
  join public.accounts a on a.id = e.account_id and a.organization_id = p_organization_id
  where e.organization_id = p_organization_id and v_accounts and v_entries
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

create or replace function public.report_monthly_series(
  p_organization_id uuid,
  p_months          int default 6,
  p_as_of_date      date default null
)
returns table (
  month         date,
  revenue_minor bigint,
  expense_minor bigint,
  net_minor     bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_accounts boolean;
  v_entries boolean;
  v_as_of  date;
  v_months int  := least(greatest(coalesce(p_months, 6), 1), 60);
  v_start  date;
begin
  perform app.require_capability(p_organization_id, 'reports.read');
  v_accounts := app.has_capability(p_organization_id, 'accounts.read');
  v_entries := app.has_capability(p_organization_id, 'transactions.read');
  v_as_of := coalesce(p_as_of_date, app.org_today(p_organization_id));

  v_start := (date_trunc('month', v_as_of) - make_interval(months => v_months - 1))::date;

  return query
  with months as (
    select generate_series(v_start, date_trunc('month', v_as_of)::date, interval '1 month')::date as m
  ),
  movements as (
    select
      date_trunc('month', e.entry_date)::date as m,
      coalesce(sum(case when a.type = 'revenue'
                        then case when e.side = 'credit' then e.base_amount_minor
                                  else -e.base_amount_minor end
                   end), 0)::bigint as revenue,
      coalesce(sum(case when a.type = 'expense'
                        then case when e.side = 'debit' then e.base_amount_minor
                                  else -e.base_amount_minor end
                   end), 0)::bigint as expense
    from public.transaction_entries e
    join public.accounts a on a.id = e.account_id and a.organization_id = p_organization_id
    where e.organization_id = p_organization_id and v_accounts and v_entries
      and e.posted_at is not null
      and e.entry_date >= v_start
      and e.entry_date <= v_as_of
      and a.type in ('revenue', 'expense')
    group by 1
  )
  select
    months.m,
    coalesce(movements.revenue, 0)::bigint,
    coalesce(movements.expense, 0)::bigint,
    (coalesce(movements.revenue, 0) - coalesce(movements.expense, 0))::bigint
  from months
  left join movements on movements.m = months.m
  order by months.m;
end;
$$;

-- Narrow Dashboard projection: no classification/control/history enrichment,
-- and only live liquid accounts participate in the posted-entry aggregation.
create function public.dashboard_liquid_accounts(p_organization_id uuid)
returns table (account_id uuid, name text, currency character(3), net_debit_minor text, subtype public.account_subtype)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_entries boolean;
begin
  perform app.require_capability(p_organization_id, 'accounts.read');
  v_entries := app.has_capability(p_organization_id, 'transactions.read');
  return query
  select a.id, a.name, a.currency,
    (coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)
      - coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0))::text,
    a.subtype
  from public.accounts a
  left join public.transaction_entries e
    on e.organization_id = p_organization_id and e.account_id = a.id
   and e.posted_at is not null and v_entries
  where a.organization_id = p_organization_id and a.is_liquid and not a.is_archived
  group by a.id
  order by a.id;
end;
$$;

-- Explicit ownership makes the trusted boundaries independent of migration role.
alter function app.search_transaction_page(uuid, text, date, date, public.transaction_type[], public.transaction_status[], uuid[], uuid[], uuid[], uuid[], uuid[], bigint, bigint, text, text, int, int, public.transaction_source[]) owner to postgres;
revoke all on function app.search_transaction_page(uuid, text, date, date, public.transaction_type[], public.transaction_status[], uuid[], uuid[], uuid[], uuid[], uuid[], bigint, bigint, text, text, int, int, public.transaction_source[]) from public, anon;
grant execute on function app.search_transaction_page(uuid, text, date, date, public.transaction_type[], public.transaction_status[], uuid[], uuid[], uuid[], uuid[], uuid[], bigint, bigint, text, text, int, int, public.transaction_source[]) to authenticated;
alter function public.dashboard_summary(uuid, date) owner to postgres;
revoke all on function public.dashboard_summary(uuid, date) from public, anon;
grant execute on function public.dashboard_summary(uuid, date) to authenticated;
alter function public.report_monthly_series(uuid, int, date) owner to postgres;
revoke all on function public.report_monthly_series(uuid, int, date) from public, anon;
grant execute on function public.report_monthly_series(uuid, int, date) to authenticated;
alter function public.dashboard_liquid_accounts(uuid) owner to postgres;
revoke all on function public.dashboard_liquid_accounts(uuid) from public, anon;
grant execute on function public.dashboard_liquid_accounts(uuid) to authenticated;
revoke all on function public.search_transactions(uuid, text, date, date, public.transaction_type[], public.transaction_status[], uuid[], uuid[], uuid[], uuid[], uuid[], bigint, bigint, text, text, int, int, public.transaction_source[]) from public, anon;
