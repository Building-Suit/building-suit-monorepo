-- LS-PERF-002: keep exact ledger reads bounded on large organizations.
-- This migration changes only read plans and read-only functions. It does not
-- alter statement_timeout, financial history, write APIs, or table RLS.

create index if not exists transactions_org_recent_live_idx
  on public.transactions (organization_id, transaction_date desc, created_at desc, id desc)
  where deleted_at is null;

create index if not exists transaction_entries_org_date_account_cover_idx
  on public.transaction_entries (organization_id, entry_date, account_id)
  include (side, base_amount_minor)
  where posted_at is not null;

create index if not exists transaction_entries_org_account_date_cover_idx
  on public.transaction_entries (organization_id, account_id, entry_date)
  include (side, base_amount_minor)
  where posted_at is not null;

create function app.search_recent_transaction_page(
  p_organization_id uuid,
  p_limit int default 50,
  p_offset int default 0
)
returns table (id uuid, total_count bigint, ordinal bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_total bigint;
begin
  perform app.require_capability(p_organization_id, 'transactions.read');

  select count(*) into v_total
  from public.transactions t
  where t.organization_id = p_organization_id and t.deleted_at is null;

  return query
  with recent as materialized (
    select t.id, t.transaction_date, t.created_at
    from public.transactions t
    where t.organization_id = p_organization_id and t.deleted_at is null
    order by t.transaction_date desc, t.created_at desc, t.id desc
    limit v_limit offset v_offset
  )
  select recent.id, v_total,
    (v_offset + row_number() over (
      order by recent.transaction_date desc, recent.created_at desc, recent.id desc
    ))::bigint
  from recent
  order by recent.transaction_date desc, recent.created_at desc, recent.id desc;
end;
$$;

create function app.search_transaction_page_bounded(
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
language plpgsql stable set search_path = '' as $$
begin
  if p_search is null and p_from_date is null and p_to_date is null
     and p_types is null and p_statuses is null and p_category_ids is null
     and p_account_ids is null and p_counterparty_ids is null
     and p_created_by_ids is null and p_tag_ids is null
     and p_min_amount_minor is null and p_max_amount_minor is null
     and p_sources is null
     and lower(coalesce(p_sort, 'transaction_date')) = 'transaction_date'
     and lower(coalesce(p_direction, 'desc')) <> 'asc' then
    return query
    select * from app.search_recent_transaction_page(
      p_organization_id, p_limit, p_offset);
    return;
  end if;

  return query
  select * from app.search_transaction_page(
    p_organization_id, p_search, p_from_date, p_to_date, p_types, p_statuses,
    p_category_ids, p_account_ids, p_counterparty_ids, p_created_by_ids,
    p_tag_ids, p_min_amount_minor, p_max_amount_minor, p_sort, p_direction,
    p_limit, p_offset, p_sources);
end;
$$;

-- Enrich only the already-selected page. The helper authorizes the tenant once
-- and applies the same capability masks as transaction_summaries without
-- invoking capability-bearing RLS policies for every lateral lookup.
create function app.search_transaction_details(
  p_organization_id uuid,
  p_ids uuid[]
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
  source_record_parent_id uuid
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_accounts boolean;
  v_categories boolean;
  v_counterparties boolean;
  v_tags boolean;
  v_attachments boolean;
  v_commitments boolean;
  v_inventory boolean;
  v_recurring boolean;
  v_imports boolean;
begin
  perform app.require_capability(p_organization_id, 'transactions.read');
  v_accounts := app.has_capability(p_organization_id, 'accounts.read');
  v_categories := app.has_capability(p_organization_id, 'categories.read');
  v_counterparties := app.has_capability(p_organization_id, 'counterparties.read');
  v_tags := app.has_capability(p_organization_id, 'tags.read');
  v_attachments := app.has_capability(p_organization_id, 'attachments.read');
  v_commitments := app.has_capability(p_organization_id, 'commitments.read');
  v_inventory := app.has_capability(p_organization_id, 'inventory.read');
  v_recurring := app.has_capability(p_organization_id, 'recurring.read');
  v_imports := app.has_capability(p_organization_id, 'imports.create');

  return query
  select
    t.id, t.journal_reference, t.transaction_date, t.type, t.source, t.status,
    t.description, t.reference, t.currency_code,
    coalesce(totals.debit_minor, 0), coalesce(totals.credit_minor, 0),
    coalesce(totals.base_debit_minor, 0), coalesce(totals.base_credit_minor, 0),
    cat.name, cp.name, credit_side.account_name, debit_side.account_name,
    case when author.id = auth.uid() or exists (
      select 1
      from public.organization_members mine
      join public.organization_members theirs on theirs.organization_id = mine.organization_id
      where mine.user_id = auth.uid() and mine.status = 'active'
        and theirs.user_id = author.id and theirs.status = 'active'
    ) then author.full_name end,
    coalesce(tag_list.tags, array[]::text[]),
    coalesce(files.attachment_count, 0),
    t.possible_duplicate, t.reverses_transaction_id,
    t.reversed_by_transaction_id, t.correction_of_transaction_id,
    source_record.kind, source_record.record_id, source_record.parent_id
  from public.transactions t
  left join lateral (
    select
      coalesce(sum(e.amount_minor) filter (where e.side = 'debit'), 0)::bigint as debit_minor,
      coalesce(sum(e.amount_minor) filter (where e.side = 'credit'), 0)::bigint as credit_minor,
      coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)::bigint as base_debit_minor,
      coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)::bigint as base_credit_minor
    from public.transaction_entries e
    where e.organization_id = p_organization_id and e.transaction_id = t.id
  ) totals on true
  left join lateral (
    select a.name as account_name
    from public.transaction_entries e
    join public.accounts a on a.id = e.account_id and a.organization_id = p_organization_id
    where v_accounts and e.organization_id = p_organization_id
      and e.transaction_id = t.id and e.side = 'credit'
    order by e.base_amount_minor desc, e.entry_index
    limit 1
  ) credit_side on true
  left join lateral (
    select a.name as account_name
    from public.transaction_entries e
    join public.accounts a on a.id = e.account_id and a.organization_id = p_organization_id
    where v_accounts and e.organization_id = p_organization_id
      and e.transaction_id = t.id and e.side = 'debit'
    order by e.base_amount_minor desc, e.entry_index
    limit 1
  ) debit_side on true
  left join public.categories cat
    on v_categories and cat.organization_id = p_organization_id and cat.id = t.category_id
  left join public.counterparties cp
    on v_counterparties and cp.organization_id = p_organization_id and cp.id = t.counterparty_id
  left join public.profiles author on author.id = t.created_by
  left join lateral (
    select array_agg(tag.name order by tag.name) as tags
    from public.transaction_tags tt
    join public.tags tag on tag.id = tt.tag_id and tag.organization_id = p_organization_id
    where v_tags and tt.organization_id = p_organization_id and tt.transaction_id = t.id
  ) tag_list on true
  left join lateral (
    select count(*)::int as attachment_count
    from public.attachments attachment
    where v_attachments and attachment.organization_id = p_organization_id
      and attachment.entity_type = 'transaction' and attachment.entity_id = t.id
  ) files on true
  left join lateral (
    select candidate.kind, candidate.record_id, candidate.parent_id
    from (
      select 'commitment'::text as kind, settlement.id as record_id,
             settlement.commitment_id as parent_id, 1 as precedence
      from public.commitment_settlements settlement
      where v_commitments and settlement.organization_id = p_organization_id
        and settlement.transaction_id = t.id
      union all
      select 'inventory'::text, fact.id, fact.source_id, 0
      from public.inventory_accounting_facts fact
      where v_inventory and fact.organization_id = p_organization_id and fact.transaction_id = t.id
      union all
      select 'recurring'::text, occurrence.id, occurrence.rule_id, 2
      from public.recurring_occurrences occurrence
      where v_recurring and occurrence.organization_id = p_organization_id
        and occurrence.transaction_id = t.id
      union all
      select 'import'::text, import_row.id, import_row.batch_id, 3
      from public.import_rows import_row
      where v_imports and import_row.organization_id = p_organization_id
        and import_row.transaction_id = t.id
    ) candidate
    order by candidate.precedence
    limit 1
  ) source_record on true
  where t.organization_id = p_organization_id and t.deleted_at is null
    and t.id = any(coalesce(p_ids, array[]::uuid[]));
end;
$$;

-- Preserve the public signature and result shape. The page helper remains the
-- sole owner of filter/count/sort semantics; enrichment cannot run before LIMIT.
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
  id uuid, journal_reference text, transaction_date date,
  type public.transaction_type, source public.transaction_source,
  status public.transaction_status, description text, reference text,
  currency_code char(3), debit_minor bigint, credit_minor bigint,
  base_debit_minor bigint, base_credit_minor bigint,
  category_name text, counterparty_name text, from_account_name text,
  to_account_name text, created_by_name text, tags text[],
  attachment_count int, possible_duplicate boolean,
  reverses_transaction_id uuid, reversed_by_transaction_id uuid,
  correction_of_transaction_id uuid, source_record_kind text,
  source_record_id uuid, source_record_parent_id uuid, total_count bigint
)
language plpgsql stable set search_path = '' as $$
begin
  return query
  with page as materialized (
    select * from app.search_transaction_page_bounded(
      p_organization_id, p_search, p_from_date, p_to_date, p_types, p_statuses,
      p_category_ids, p_account_ids, p_counterparty_ids, p_created_by_ids,
      p_tag_ids, p_min_amount_minor, p_max_amount_minor, p_sort, p_direction,
      p_limit, p_offset, p_sources)
  ), details as materialized (
    select detail.*
    from app.search_transaction_details(
      p_organization_id,
      (select coalesce(array_agg(page.id order by page.ordinal), array[]::uuid[]) from page)
    ) detail
  )
  select details.*, page.total_count
  from page
  join details on details.id = page.id
  order by page.ordinal;
end;
$$;

-- One exact pass over posted entries supplies balance-sheet, cash/control and
-- current/previous-month KPIs. Capability checks are still explicit and occur
-- before any organization data is read.
create or replace function public.dashboard_summary(
  p_organization_id uuid,
  p_as_of_date date default null
)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_accounts boolean;
  v_entries boolean;
  v_as_of date;
  v_month_start date;
  v_prev_start date;
  v_assets bigint;
  v_liabilities bigint;
  v_cash bigint;
  v_receivable bigint;
  v_payable bigint;
  v_revenue bigint;
  v_expenses bigint;
  v_prev_revenue bigint;
  v_prev_expenses bigint;
begin
  perform app.require_capability(p_organization_id, 'reports.read');
  v_accounts := app.has_capability(p_organization_id, 'accounts.read');
  v_entries := app.has_capability(p_organization_id, 'transactions.read');
  v_as_of := coalesce(p_as_of_date, app.org_today(p_organization_id));
  v_month_start := date_trunc('month', v_as_of)::date;
  v_prev_start := (date_trunc('month', v_as_of) - interval '1 month')::date;

  select
    coalesce(sum(case when a.type = 'asset' then
      case when e.side = 'debit' then e.base_amount_minor else -e.base_amount_minor end end), 0),
    coalesce(sum(case when a.type = 'liability' then
      case when e.side = 'credit' then e.base_amount_minor else -e.base_amount_minor end end), 0),
    coalesce(sum(case when a.is_liquid then
      case when a.type in ('asset', 'expense')
        then case when e.side = 'debit' then e.base_amount_minor else -e.base_amount_minor end
        else case when e.side = 'credit' then e.base_amount_minor else -e.base_amount_minor end
      end end), 0),
    coalesce(sum(case when a.subtype = 'accounts_receivable' then
      case when a.type in ('asset', 'expense')
        then case when e.side = 'debit' then e.base_amount_minor else -e.base_amount_minor end
        else case when e.side = 'credit' then e.base_amount_minor else -e.base_amount_minor end
      end end), 0),
    coalesce(sum(case when a.subtype = 'accounts_payable' then
      case when a.type in ('asset', 'expense')
        then case when e.side = 'debit' then e.base_amount_minor else -e.base_amount_minor end
        else case when e.side = 'credit' then e.base_amount_minor else -e.base_amount_minor end
      end end), 0),
    coalesce(sum(case when e.entry_date >= v_month_start and a.type = 'revenue'
      then case when e.side = 'credit' then e.base_amount_minor else -e.base_amount_minor end end), 0),
    coalesce(sum(case when e.entry_date >= v_month_start and a.type = 'expense'
      then case when e.side = 'debit' then e.base_amount_minor else -e.base_amount_minor end end), 0),
    coalesce(sum(case when e.entry_date >= v_prev_start and e.entry_date < v_month_start and a.type = 'revenue'
      then case when e.side = 'credit' then e.base_amount_minor else -e.base_amount_minor end end), 0),
    coalesce(sum(case when e.entry_date >= v_prev_start and e.entry_date < v_month_start and a.type = 'expense'
      then case when e.side = 'debit' then e.base_amount_minor else -e.base_amount_minor end end), 0)
  into v_assets, v_liabilities, v_cash, v_receivable, v_payable,
       v_revenue, v_expenses, v_prev_revenue, v_prev_expenses
  from public.accounts a
  left join public.transaction_entries e
    on e.organization_id = p_organization_id and e.account_id = a.id
   and e.posted_at is not null and e.entry_date <= v_as_of and v_entries
  where a.organization_id = p_organization_id and v_accounts;

  return jsonb_build_object(
    'as_of', v_as_of,
    'base_currency', app.org_base_currency(p_organization_id),
    'total_assets_minor', v_assets,
    'total_liabilities_minor', v_liabilities,
    'net_worth_minor', v_assets - v_liabilities,
    'cash_and_bank_minor', v_cash,
    'accounts_receivable_minor', v_receivable,
    'accounts_payable_minor', v_payable,
    'revenue_this_month_minor', v_revenue,
    'expenses_this_month_minor', v_expenses,
    'net_profit_this_month_minor', v_revenue - v_expenses,
    'revenue_previous_month_minor', v_prev_revenue,
    'expenses_previous_month_minor', v_prev_expenses,
    'net_profit_previous_month_minor', v_prev_revenue - v_prev_expenses
  );
end;
$$;

alter function app.search_transaction_details(uuid, uuid[]) owner to postgres;
revoke all on function app.search_transaction_details(uuid, uuid[]) from public, anon;
grant execute on function app.search_transaction_details(uuid, uuid[]) to authenticated;
alter function app.search_recent_transaction_page(uuid, int, int) owner to postgres;
revoke all on function app.search_recent_transaction_page(uuid, int, int) from public, anon;
grant execute on function app.search_recent_transaction_page(uuid, int, int) to authenticated;
alter function app.search_transaction_page_bounded(uuid, text, date, date, public.transaction_type[], public.transaction_status[], uuid[], uuid[], uuid[], uuid[], uuid[], bigint, bigint, text, text, int, int, public.transaction_source[]) owner to postgres;
revoke all on function app.search_transaction_page_bounded(uuid, text, date, date, public.transaction_type[], public.transaction_status[], uuid[], uuid[], uuid[], uuid[], uuid[], bigint, bigint, text, text, int, int, public.transaction_source[]) from public, anon;
grant execute on function app.search_transaction_page_bounded(uuid, text, date, date, public.transaction_type[], public.transaction_status[], uuid[], uuid[], uuid[], uuid[], uuid[], bigint, bigint, text, text, int, int, public.transaction_source[]) to authenticated;
revoke all on function public.search_transactions(uuid, text, date, date, public.transaction_type[], public.transaction_status[], uuid[], uuid[], uuid[], uuid[], uuid[], bigint, bigint, text, text, int, int, public.transaction_source[]) from public, anon;
grant execute on function public.search_transactions(uuid, text, date, date, public.transaction_type[], public.transaction_status[], uuid[], uuid[], uuid[], uuid[], uuid[], bigint, bigint, text, text, int, int, public.transaction_source[]) to authenticated;
alter function public.dashboard_summary(uuid, date) owner to postgres;
revoke all on function public.dashboard_summary(uuid, date) from public, anon;
grant execute on function public.dashboard_summary(uuid, date) to authenticated;
