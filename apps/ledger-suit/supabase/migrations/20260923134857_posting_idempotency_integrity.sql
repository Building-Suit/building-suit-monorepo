-- Bind every posting idempotency key to one canonical logical request and
-- claim it transactionally before any journal, audit, or quota side effect.

create table app.posting_idempotency (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  idempotency_key text not null,
  operation text not null check (operation in ('draft', 'post', 'legacy')),
  request_fingerprint text,
  transaction_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (organization_id, idempotency_key),
  constraint posting_idempotency_fingerprint_shape check (
    (operation = 'legacy' and request_fingerprint is null)
    or (operation <> 'legacy' and request_fingerprint ~ '^[0-9a-f]{64}$')
  ),
  constraint posting_idempotency_completion_shape check (
    (transaction_id is null and completed_at is null)
    or (transaction_id is not null and completed_at is not null)
  ),
  constraint posting_idempotency_transaction_same_org
    foreign key (transaction_id, organization_id)
    references public.transactions (id, organization_id) on delete restrict
);

comment on table app.posting_idempotency is
  'Private atomic posting claims. A tenant-scoped key is permanently bound to '
  'one canonical request fingerprint and, after success, one transaction.';
comment on column app.posting_idempotency.request_fingerprint is
  'SHA-256 of deterministic posting inputs. NULL is reserved for historical '
  'keys created before payload binding and is never backfilled speculatively.';

-- Existing transactions retain their keys and results, but their original
-- request payload cannot be reconstructed safely. Reuse therefore conflicts
-- explicitly instead of silently accepting a potentially different request.
insert into app.posting_idempotency (
  organization_id, idempotency_key, operation, request_fingerprint,
  transaction_id, created_at, completed_at
)
select
  transaction.organization_id,
  transaction.idempotency_key,
  'legacy',
  null,
  transaction.id,
  transaction.created_at,
  coalesce(transaction.posted_at, transaction.created_at)
from public.transactions transaction
where transaction.idempotency_key is not null;

-- Canonicalize the logical journal as a multiset: JSON object key order and
-- line order do not affect the hash, while duplicate lines remain significant.
create or replace function app.posting_request_fingerprint(
  p_operation text,
  p_organization_id uuid,
  p_type public.transaction_type,
  p_transaction_date date,
  p_lines jsonb,
  p_currency_code char(3),
  p_exchange_rate numeric,
  p_base_currency char(3),
  p_description text,
  p_reference text,
  p_counterparty_id uuid,
  p_category_id uuid,
  p_memo text,
  p_adjustment_reason text,
  p_source public.transaction_source,
  p_metadata jsonb,
  p_business_fingerprint text default null
)
returns text
language sql
immutable
set search_path = ''
as $$
  with canonical_lines as (
    select coalesce(
      jsonb_agg(canonical.line order by canonical.line::text),
      '[]'::jsonb
    ) as value
    from (
      select jsonb_strip_nulls(jsonb_build_object(
        'account_id', ((line.value ->> 'account_id')::uuid)::text,
        'side', lower(line.value ->> 'side'),
        'amount_minor', (line.value ->> 'amount_minor')::bigint,
        'currency_code', btrim(coalesce(
          nullif(line.value ->> 'currency_code', ''), p_currency_code::text
        )),
        'exchange_rate', trim_scale(case
          when btrim(coalesce(nullif(line.value ->> 'currency_code', ''), p_currency_code::text))
               = btrim(p_base_currency::text)
            then 1::numeric
          else coalesce((line.value ->> 'exchange_rate')::numeric, p_exchange_rate)
        end),
        'memo', line.value ->> 'memo'
      )) as line
      from jsonb_array_elements(p_lines) line(value)
    ) canonical
  )
  select encode(extensions.digest(
    jsonb_strip_nulls(jsonb_build_object(
      'version', 1,
      'operation', p_operation,
      'organization_id', p_organization_id,
      'type', p_type,
      'transaction_date', p_transaction_date,
      'lines', canonical_lines.value,
      'currency_code', btrim(p_currency_code::text),
      'exchange_rate', trim_scale(p_exchange_rate),
      'description', p_description,
      'reference', p_reference,
      'counterparty_id', p_counterparty_id,
      'category_id', p_category_id,
      'memo', p_memo,
      'adjustment_reason', p_adjustment_reason,
      'source', p_source,
      'metadata', coalesce(p_metadata, '{}'::jsonb),
      'business_fingerprint', p_business_fingerprint
    ))::text,
    'sha256'
  ), 'hex')
  from canonical_lines;
$$;

create or replace function app.claim_posting_idempotency(
  p_organization_id uuid,
  p_idempotency_key text,
  p_operation text,
  p_request_fingerprint text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_claim app.posting_idempotency%rowtype;
begin
  if p_idempotency_key is null
     or p_operation not in ('draft', 'post')
     or p_request_fingerprint is null
     or p_request_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'IDEMPOTENCY_ARGUMENT_INVALID:' using errcode = '22023';
  end if;

  insert into app.posting_idempotency (
    organization_id, idempotency_key, operation, request_fingerprint
  ) values (
    p_organization_id, p_idempotency_key, p_operation, p_request_fingerprint
  )
  on conflict (organization_id, idempotency_key) do nothing;

  if found then
    return null;
  end if;

  -- A conflicting insert waits on the unique key. Once the winner commits,
  -- this row lock observes its completed transaction; if it rolls back, the
  -- INSERT above succeeds instead and this caller becomes the owner.
  select * into strict v_claim
  from app.posting_idempotency claim
  where claim.organization_id = p_organization_id
    and claim.idempotency_key = p_idempotency_key
  for update;

  if v_claim.request_fingerprint is null then
    raise exception
      'IDEMPOTENCY_CONFLICT: key predates payload binding and cannot be safely replayed'
      using errcode = '23505';
  end if;

  if v_claim.operation <> p_operation
     or v_claim.request_fingerprint <> p_request_fingerprint then
    raise exception
      'IDEMPOTENCY_CONFLICT: key was already used for a different request'
      using errcode = '23505';
  end if;

  if v_claim.transaction_id is null then
    raise exception 'IDEMPOTENCY_STATE_INVALID: completed claim has no transaction'
      using errcode = '55000';
  end if;

  return v_claim.transaction_id;
end;
$$;

create or replace function app.complete_posting_idempotency(
  p_organization_id uuid,
  p_idempotency_key text,
  p_operation text,
  p_request_fingerprint text,
  p_transaction_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update app.posting_idempotency claim
  set transaction_id = p_transaction_id,
      completed_at = now()
  where claim.organization_id = p_organization_id
    and claim.idempotency_key = p_idempotency_key
    and claim.operation = p_operation
    and claim.request_fingerprint = p_request_fingerprint
    and claim.transaction_id is null;

  if not found then
    raise exception 'IDEMPOTENCY_STATE_INVALID: claim could not be completed'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function public.create_draft_transaction(
  p_organization_id   uuid,
  p_type              public.transaction_type,
  p_transaction_date  date,
  p_lines             jsonb,
  p_currency_code     char(3) default null,
  p_exchange_rate     numeric default null,
  p_description       text    default null,
  p_reference         text    default null,
  p_counterparty_id   uuid    default null,
  p_category_id       uuid    default null,
  p_memo              text    default null,
  p_adjustment_reason text    default null,
  p_source            public.transaction_source default 'manual',
  p_idempotency_key   text    default null,
  p_metadata          jsonb   default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base_currency char(3);
  v_currency char(3);
  v_rate numeric;
  v_lines jsonb;
  v_txn_id uuid;
  v_line jsonb;
  v_existing uuid;
  v_request_fingerprint text;
begin
  perform app.require_capability(p_organization_id, 'transactions.create');

  v_base_currency := app.org_base_currency(p_organization_id);
  v_currency := coalesce(p_currency_code, v_base_currency);
  v_rate := case when v_currency = v_base_currency then 1 else p_exchange_rate end;

  if p_idempotency_key is not null then
    v_request_fingerprint := app.posting_request_fingerprint(
      'draft', p_organization_id, p_type, p_transaction_date, p_lines,
      v_currency, v_rate, v_base_currency, p_description, p_reference,
      p_counterparty_id, p_category_id, p_memo, p_adjustment_reason,
      p_source, p_metadata
    );
    v_existing := app.claim_posting_idempotency(
      p_organization_id, p_idempotency_key, 'draft', v_request_fingerprint
    );
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  v_lines := app.normalize_journal_lines(
    p_organization_id, p_lines, v_currency, v_rate
  );

  insert into public.transactions (
    organization_id, type, status, source, transaction_date, currency_code,
    exchange_rate, description, reference, memo, adjustment_reason,
    counterparty_id, category_id, idempotency_key, metadata, created_by
  )
  values (
    p_organization_id, p_type, 'draft', p_source, p_transaction_date, v_currency,
    coalesce(v_rate, 1), p_description, p_reference, p_memo, p_adjustment_reason,
    p_counterparty_id, p_category_id, p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb), auth.uid()
  )
  returning id into v_txn_id;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    insert into public.transaction_entries (
      organization_id, transaction_id, account_id, entry_index, side,
      amount_minor, currency_code, base_amount_minor, exchange_rate, memo
    )
    values (
      p_organization_id,
      v_txn_id,
      (v_line ->> 'account_id')::uuid,
      (v_line ->> 'entry_index')::smallint,
      (v_line ->> 'side')::public.entry_side,
      (v_line ->> 'amount_minor')::bigint,
      (v_line ->> 'currency_code')::char(3),
      (v_line ->> 'base_amount_minor')::bigint,
      (v_line ->> 'exchange_rate')::numeric,
      v_line ->> 'memo'
    );
  end loop;

  perform app.write_audit(
    p_organization_id, 'transaction.created', 'transaction', v_txn_id,
    null, jsonb_build_object('type', p_type, 'status', 'draft')
  );

  if p_idempotency_key is not null then
    perform app.complete_posting_idempotency(
      p_organization_id, p_idempotency_key, 'draft',
      v_request_fingerprint, v_txn_id
    );
  end if;

  return v_txn_id;
end;
$$;

create or replace function app.create_and_post(
  p_organization_id   uuid,
  p_type              public.transaction_type,
  p_transaction_date  date,
  p_lines             jsonb,
  p_currency_code     char(3) default null,
  p_exchange_rate     numeric default null,
  p_description       text    default null,
  p_reference         text    default null,
  p_counterparty_id   uuid    default null,
  p_category_id       uuid    default null,
  p_memo              text    default null,
  p_adjustment_reason text    default null,
  p_source            public.transaction_source default 'manual',
  p_idempotency_key   text    default null,
  p_metadata          jsonb   default '{}'::jsonb,
  p_fingerprint       text    default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base_currency char(3);
  v_currency char(3);
  v_rate numeric;
  v_txn_id uuid;
  v_existing uuid;
  v_request_fingerprint text;
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
      p_source, p_metadata, p_fingerprint
    );
    v_existing := app.claim_posting_idempotency(
      p_organization_id, p_idempotency_key, 'post', v_request_fingerprint
    );
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  perform app.assert_books_open(p_organization_id, p_transaction_date);

  -- Draft construction remains the single journal writer. The outer claim owns
  -- the key, so the nested draft intentionally has no independent claim.
  v_txn_id := public.create_draft_transaction(
    p_organization_id   => p_organization_id,
    p_type              => p_type,
    p_transaction_date  => p_transaction_date,
    p_lines             => p_lines,
    p_currency_code     => v_currency,
    p_exchange_rate     => v_rate,
    p_description       => p_description,
    p_reference         => p_reference,
    p_counterparty_id   => p_counterparty_id,
    p_category_id       => p_category_id,
    p_memo              => p_memo,
    p_adjustment_reason => p_adjustment_reason,
    p_source            => p_source,
    p_idempotency_key   => null,
    p_metadata          => p_metadata
  );

  if p_idempotency_key is not null then
    update public.transactions transaction
    set idempotency_key = p_idempotency_key
    where transaction.id = v_txn_id;
  end if;

  if p_fingerprint is not null then
    update public.transactions transaction
    set fingerprint = p_fingerprint,
        possible_duplicate = exists (
          select 1 from public.transactions duplicate
          where duplicate.organization_id = p_organization_id
            and duplicate.fingerprint = p_fingerprint
            and duplicate.id <> transaction.id
            and duplicate.status = 'posted'
        ),
        duplicate_of_transaction_id = (
          select duplicate.id from public.transactions duplicate
          where duplicate.organization_id = p_organization_id
            and duplicate.fingerprint = p_fingerprint
            and duplicate.id <> transaction.id
            and duplicate.status = 'posted'
          order by duplicate.created_at
          limit 1
        )
    where transaction.id = v_txn_id;
  end if;

  perform public.post_transaction(v_txn_id);

  if p_idempotency_key is not null then
    perform app.complete_posting_idempotency(
      p_organization_id, p_idempotency_key, 'post',
      v_request_fingerprint, v_txn_id
    );
  end if;

  return v_txn_id;
end;
$$;

-- Approval-required adjustments reuse the draft result without writing a
-- second status audit when the request is replayed.
create or replace function public.create_adjustment(
  p_organization_id  uuid,
  p_transaction_date date,
  p_lines            jsonb,
  p_description      text,
  p_reason           text,
  p_currency_code    char(3) default null,
  p_exchange_rate    numeric default null,
  p_idempotency_key  text    default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requires_approval boolean;
  v_txn_id uuid;
  v_promoted boolean := false;
begin
  perform app.require_capability(p_organization_id, 'transactions.adjust');

  if p_description is null or char_length(trim(p_description)) = 0 then
    raise exception 'INVALID_ADJUSTMENT: a description is required'
      using errcode = '22023';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'INVALID_ADJUSTMENT: an adjustment reason is required'
      using errcode = '22023';
  end if;

  select setting.require_adjustment_approval into v_requires_approval
  from public.organization_settings setting
  where setting.organization_id = p_organization_id;

  if coalesce(v_requires_approval, false) then
    v_txn_id := public.create_draft_transaction(
      p_organization_id   => p_organization_id,
      p_type              => 'adjustment',
      p_transaction_date  => p_transaction_date,
      p_lines             => p_lines,
      p_currency_code     => p_currency_code,
      p_exchange_rate     => p_exchange_rate,
      p_description       => p_description,
      p_adjustment_reason => p_reason,
      p_idempotency_key   => p_idempotency_key
    );

    update public.transactions transaction
    set status = 'pending_approval'
    where transaction.id = v_txn_id
      and transaction.status = 'draft'
    returning true into v_promoted;

    if coalesce(v_promoted, false) then
      perform app.write_audit(
        p_organization_id, 'transaction.created', 'transaction', v_txn_id,
        null, jsonb_build_object('type', 'adjustment', 'status', 'pending_approval')
      );
    end if;

    return v_txn_id;
  end if;

  return app.create_and_post(
    p_organization_id   => p_organization_id,
    p_type              => 'adjustment',
    p_transaction_date  => p_transaction_date,
    p_lines             => p_lines,
    p_currency_code     => p_currency_code,
    p_exchange_rate     => p_exchange_rate,
    p_description       => p_description,
    p_adjustment_reason => p_reason,
    p_idempotency_key   => p_idempotency_key
  );
end;
$$;

revoke all on table app.posting_idempotency from public, anon, authenticated;
revoke all on function
  app.posting_request_fingerprint(
    text, uuid, public.transaction_type, date, jsonb, char, numeric, char,
    text, text, uuid, uuid, text, text, public.transaction_source, jsonb, text
  ),
  app.claim_posting_idempotency(uuid, text, text, text),
  app.complete_posting_idempotency(uuid, text, text, text, uuid)
from public, anon, authenticated;
