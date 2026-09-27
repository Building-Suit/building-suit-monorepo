-- V2-IMP-003: enrich the existing authoritative transaction stream for the
-- Journal Center. The opaque journal reference is deliberately not the final
-- sequential journal number: V2-D03 still owns fiscal-year scope, format,
-- assignment moment and gap policy. It is an immutable, deterministic bridge
-- that gives every existing and future row a safe accountant-facing identity.

alter table public.transactions
  add column journal_reference text generated always as (
    'JRN-' || upper(replace(id::text, '-', ''))
  ) stored;

create unique index transactions_journal_reference_key
  on public.transactions (journal_reference);

comment on column public.transactions.journal_reference is
  'Immutable UUID-derived journal reference. This preserves a stable identity '
  'while V2-D03 remains the authority for the eventual sequential numbering policy.';

-- Commitment settlement already has an authoritative source relationship, but
-- the original settlement function left the journal labelled manual. Derive
-- the presentation metadata from that relationship without changing amounts.
create function app.mark_commitment_journal_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.transactions transaction
  set source = 'commitment'
  where transaction.id = new.transaction_id
    and transaction.organization_id = new.organization_id;
  return new;
end;
$$;

create trigger commitment_settlements_mark_journal_source
  after insert on public.commitment_settlements
  for each row execute function app.mark_commitment_journal_source();

update public.transactions transaction
set source = 'commitment'
where exists (
  select 1 from public.commitment_settlements settlement
  where settlement.transaction_id = transaction.id
    and settlement.organization_id = transaction.organization_id
);

revoke all on function app.mark_commitment_journal_source()
  from public, anon, authenticated;

-- Keep saved Journal Center views as a small validated query-state contract.
-- Existing resources are unaffected by this constraint.
create function app.is_valid_journal_view(p_filters jsonb, p_sort jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    jsonb_typeof(p_filters) = 'object'
    and not exists (
      select 1
      from jsonb_object_keys(p_filters) key
      where key not in (
        'search', 'from', 'to', 'status', 'type', 'source', 'categoryId',
        'tagId', 'accountId', 'minAmount', 'maxAmount'
      )
    )
    and not exists (
      select 1
      from jsonb_each(p_filters) item
      where jsonb_typeof(item.value) <> 'string'
    )
    and jsonb_typeof(p_sort) = 'object'
    and (p_sort->>'column') in (
      'transaction_date', 'journal_reference', 'type', 'source', 'status',
      'debit', 'credit', 'created_at'
    )
    and (p_sort->>'direction') in ('asc', 'desc')
    and not exists (
      select 1 from jsonb_object_keys(p_sort) key
      where key not in ('column', 'direction')
    );
$$;

alter table public.saved_views
  add constraint saved_views_journal_contract check (
    resource <> 'journal_center' or app.is_valid_journal_view(filters, sort)
  );

revoke all on function app.is_valid_journal_view(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function app.is_valid_journal_view(jsonb, jsonb)
  to authenticated, service_role;

-- Append journal-specific columns to the existing security-invoker summary.
create or replace view public.transaction_summaries
with (security_invoker = true) as
select
  t.id,
  t.organization_id,
  t.type,
  t.status,
  t.source,
  t.transaction_date,
  t.posting_date,
  t.currency_code,
  t.exchange_rate,
  t.description,
  t.reference,
  t.memo,
  t.adjustment_reason,
  t.counterparty_id,
  t.category_id,
  t.possible_duplicate,
  t.reverses_transaction_id,
  t.reversed_by_transaction_id,
  t.created_by,
  t.posted_by,
  t.posted_at,
  t.created_at,
  t.updated_at,
  coalesce(totals.debit_minor, 0) as amount_minor,
  coalesce(totals.base_debit_minor, 0) as base_amount_minor,
  coalesce(totals.line_count, 0) as line_count,
  credit_side.account_id as from_account_id,
  credit_side.account_name as from_account_name,
  debit_side.account_id as to_account_id,
  debit_side.account_name as to_account_name,
  cat.name as category_name,
  cp.name as counterparty_name,
  author.full_name as created_by_name,
  author.email as created_by_email,
  coalesce(tag_list.tags, array[]::text[]) as tags,
  coalesce(tag_list.tag_ids, array[]::uuid[]) as tag_ids,
  coalesce(files.attachment_count, 0) as attachment_count,
  t.journal_reference,
  coalesce(totals.debit_minor, 0) as debit_minor,
  coalesce(totals.credit_minor, 0) as credit_minor,
  coalesce(totals.base_debit_minor, 0) as base_debit_minor,
  coalesce(totals.base_credit_minor, 0) as base_credit_minor,
  t.correction_of_transaction_id,
  source_record.kind as source_record_kind,
  source_record.record_id as source_record_id,
  source_record.parent_id as source_record_parent_id
from public.transactions t
left join lateral (
  select
    coalesce(sum(e.amount_minor) filter (where e.side = 'debit'), 0)::bigint as debit_minor,
    coalesce(sum(e.amount_minor) filter (where e.side = 'credit'), 0)::bigint as credit_minor,
    coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)::bigint as base_debit_minor,
    coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)::bigint as base_credit_minor,
    count(*)::int as line_count
  from public.transaction_entries e
  where e.transaction_id = t.id
) totals on true
left join lateral (
  select a.id as account_id, a.name as account_name
  from public.transaction_entries e
  join public.accounts a on a.id = e.account_id
  where e.transaction_id = t.id and e.side = 'credit'
  order by e.base_amount_minor desc, e.entry_index
  limit 1
) credit_side on true
left join lateral (
  select a.id as account_id, a.name as account_name
  from public.transaction_entries e
  join public.accounts a on a.id = e.account_id
  where e.transaction_id = t.id and e.side = 'debit'
  order by e.base_amount_minor desc, e.entry_index
  limit 1
) debit_side on true
left join lateral (
  select array_agg(tg.name order by tg.name) as tags,
         array_agg(tg.id order by tg.name) as tag_ids
  from public.transaction_tags tt
  join public.tags tg on tg.id = tt.tag_id
  where tt.transaction_id = t.id
) tag_list on true
left join lateral (
  select count(*)::int as attachment_count
  from public.attachments attachment
  where attachment.entity_type = 'transaction' and attachment.entity_id = t.id
) files on true
left join lateral (
  select candidate.kind, candidate.record_id, candidate.parent_id
  from (
    select 'commitment'::text as kind, settlement.id as record_id,
           settlement.commitment_id as parent_id, 1 as precedence
    from public.commitment_settlements settlement
    where settlement.transaction_id = t.id
    union all
    select 'recurring'::text, occurrence.id, occurrence.rule_id, 2
    from public.recurring_occurrences occurrence
    where occurrence.transaction_id = t.id
    union all
    select 'import'::text, import_row.id, import_row.batch_id, 3
    from public.import_rows import_row
    where import_row.transaction_id = t.id
  ) candidate
  order by candidate.precedence
  limit 1
) source_record on true
left join public.categories cat on cat.id = t.category_id
left join public.counterparties cp on cp.id = t.counterparty_id
left join public.profiles author on author.id = t.created_by
where t.deleted_at is null;

comment on view public.transaction_summaries is
  'Authoritative journal summaries with actual line totals, immutable references, '
  'correction links and tenant-protected source-record relationships.';

grant select on public.transaction_summaries to authenticated;

-- The return contract changes, so replace the prior overload explicitly.
drop function public.search_transactions(
  uuid, text, date, date, public.transaction_type[], public.transaction_status[],
  uuid[], uuid[], uuid[], uuid[], uuid[], bigint, bigint, text, text, int, int
);

create function public.search_transactions(
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
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_sort text := lower(coalesce(p_sort, 'transaction_date'));
  v_desc boolean := lower(coalesce(p_direction, 'desc')) <> 'asc';
begin
  perform app.require_capability(p_organization_id, 'transactions.read');
  if v_sort not in (
    'transaction_date', 'journal_reference', 'type', 'source', 'status',
    'debit', 'credit', 'created_at'
  ) then
    v_sort := 'transaction_date';
  end if;

  return query
  with filtered as (
    select summary.*
    from public.transaction_summaries summary
    where summary.organization_id = p_organization_id
      and (p_from_date is null or summary.transaction_date >= p_from_date)
      and (p_to_date is null or summary.transaction_date <= p_to_date)
      and (p_types is null or summary.type = any (p_types))
      and (p_sources is null or summary.source = any (p_sources))
      and (p_statuses is null or summary.status = any (p_statuses))
      and (p_category_ids is null or summary.category_id = any (p_category_ids))
      and (p_counterparty_ids is null or summary.counterparty_id = any (p_counterparty_ids))
      and (p_created_by_ids is null or summary.created_by = any (p_created_by_ids))
      and (p_min_amount_minor is null or summary.base_debit_minor >= p_min_amount_minor)
      and (p_max_amount_minor is null or summary.base_debit_minor <= p_max_amount_minor)
      and (p_tag_ids is null or summary.tag_ids && p_tag_ids)
      and (
        p_account_ids is null or exists (
          select 1 from public.transaction_entries entry
          where entry.transaction_id = summary.id and entry.account_id = any (p_account_ids)
        )
      )
      and (
        p_search is null or trim(p_search) = ''
        or summary.journal_reference ilike '%' || p_search || '%'
        or summary.description ilike '%' || p_search || '%'
        or summary.reference ilike '%' || p_search || '%'
        or summary.counterparty_name ilike '%' || p_search || '%'
        or summary.category_name ilike '%' || p_search || '%'
        or summary.from_account_name ilike '%' || p_search || '%'
        or summary.to_account_name ilike '%' || p_search || '%'
      )
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
    filtered.source_record_parent_id, count(*) over ()::bigint
  from filtered
  order by
    case when v_desc then
      case v_sort
        when 'transaction_date' then to_char(filtered.transaction_date, 'YYYYMMDD')
        when 'journal_reference' then filtered.journal_reference
        when 'debit' then lpad(filtered.base_debit_minor::text, 20, '0')
        when 'credit' then lpad(filtered.base_credit_minor::text, 20, '0')
        when 'created_at' then to_char(filtered.created_at, 'YYYYMMDDHH24MISSUS')
        when 'status' then filtered.status::text
        when 'source' then filtered.source::text
        else filtered.type::text
      end
    end desc nulls last,
    case when not v_desc then
      case v_sort
        when 'transaction_date' then to_char(filtered.transaction_date, 'YYYYMMDD')
        when 'journal_reference' then filtered.journal_reference
        when 'debit' then lpad(filtered.base_debit_minor::text, 20, '0')
        when 'credit' then lpad(filtered.base_credit_minor::text, 20, '0')
        when 'created_at' then to_char(filtered.created_at, 'YYYYMMDDHH24MISSUS')
        when 'status' then filtered.status::text
        when 'source' then filtered.source::text
        else filtered.type::text
      end
    end asc nulls last,
    filtered.created_at desc, filtered.id desc
  limit v_limit offset v_offset;
end;
$$;

comment on function public.search_transactions is
  'Authorized Journal Center search over actual journal headers and ledger totals.';

grant execute on function public.search_transactions(
  uuid, text, date, date, public.transaction_type[], public.transaction_status[],
  uuid[], uuid[], uuid[], uuid[], uuid[], bigint, bigint, text, text, int, int,
  public.transaction_source[]
) to authenticated;
