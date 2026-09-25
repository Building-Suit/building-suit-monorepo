-- V2-IMP-001: payload-bound, atomic posting idempotency.
begin;

create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(37);

create temp table idempotency_ids (key text primary key, value uuid not null);
grant all on idempotency_ids to authenticated;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '32000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'idempotency-owner@ledgersuit.test',
  extensions.crypt('password', extensions.gen_salt('bf')), now(),
  '{"provider":"email"}'::jsonb, '{"full_name":"Idempotency Owner"}'::jsonb,
  now(), now()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"32000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

insert into idempotency_ids (key, value)
values ('org_a', public.create_organization('Idempotency Alpha', 'EGP'));

reset role;
select app.seed_chart_of_accounts((select value from idempotency_ids where key = 'org_a'));
select app.seed_categories((select value from idempotency_ids where key = 'org_a'));

insert into idempotency_ids (key, value)
select 'bank_a', account.id from public.accounts account
where account.organization_id = (select value from idempotency_ids where key = 'org_a')
  and account.system_key = 'bank';
insert into idempotency_ids (key, value)
select 'cash_a', account.id from public.accounts account
where account.organization_id = (select value from idempotency_ids where key = 'org_a')
  and account.system_key = 'cash';
insert into idempotency_ids (key, value)
select 'capital_a', account.id from public.accounts account
where account.organization_id = (select value from idempotency_ids where key = 'org_a')
  and account.system_key = 'owner_capital';
insert into idempotency_ids (key, value)
select 'sales_a', category.id from public.categories category
where category.organization_id = (select value from idempotency_ids where key = 'org_a')
  and category.name = 'Sales';

set local role authenticated;

-- AC-1: an exact sequential retry returns the original result and produces no
-- second journal, line set, audit event, or quota consumption.
insert into idempotency_ids (key, value)
values ('sequential_first', public.record_income(
  p_organization_id => (select value from idempotency_ids where key = 'org_a'),
  p_amount_minor => 12500,
  p_destination_account_id => (select value from idempotency_ids where key = 'bank_a'),
  p_category_id => (select value from idempotency_ids where key = 'sales_a'),
  p_transaction_date => date '2026-09-23',
  p_description => 'Payload-bound retry',
  p_reference => 'IDEMP-001',
  p_idempotency_key => 'v2-sequential'
));
insert into idempotency_ids (key, value)
values ('sequential_retry', public.record_income(
  p_organization_id => (select value from idempotency_ids where key = 'org_a'),
  p_amount_minor => 12500,
  p_destination_account_id => (select value from idempotency_ids where key = 'bank_a'),
  p_category_id => (select value from idempotency_ids where key = 'sales_a'),
  p_transaction_date => date '2026-09-23',
  p_description => 'Payload-bound retry',
  p_reference => 'IDEMP-001',
  p_idempotency_key => 'v2-sequential'
));

select is(
  (select value from idempotency_ids where key = 'sequential_retry'),
  (select value from idempotency_ids where key = 'sequential_first'),
  'same tenant, key, and payload return the original transaction id'
);
select is((select count(*) from public.transactions transaction
  where transaction.organization_id = (select value from idempotency_ids where key = 'org_a')
    and transaction.idempotency_key = 'v2-sequential'), 1::bigint,
  'a sequential retry creates exactly one transaction');
select is((select count(*) from public.transaction_entries entry
  where entry.transaction_id = (select value from idempotency_ids where key = 'sequential_first')),
  2::bigint, 'a sequential retry creates exactly one balanced line set');
reset role;
select is((select count(*) from public.audit_logs audit
  where audit.entity_id = (select value from idempotency_ids where key = 'sequential_first')
    and audit.action = 'transaction.created'), 1::bigint,
  'a sequential retry creates one transaction-created audit event');
select is((select count(*) from public.audit_logs audit
  where audit.entity_id = (select value from idempotency_ids where key = 'sequential_first')
    and audit.action = 'transaction.posted'), 1::bigint,
  'a sequential retry creates one transaction-posted audit event');
select is(app.plan_quota_usage(
  (select value from idempotency_ids where key = 'org_a'),
  'max_monthly_transactions'), 1::bigint,
  'a sequential retry consumes monthly quota once');

select is((select count(*) from app.posting_idempotency claim
  where claim.organization_id = (select value from idempotency_ids where key = 'org_a')
    and claim.idempotency_key = 'v2-sequential'
    and claim.operation = 'post'
    and claim.request_fingerprint ~ '^[0-9a-f]{64}$'
    and claim.transaction_id = (select value from idempotency_ids where key = 'sequential_first')
    and claim.completed_at is not null), 1::bigint,
  'the key is bound to one canonical fingerprint and completed result');

-- AC-2: a materially different request cannot reuse the completed key.
set local role authenticated;
select throws_ok(format($sql$
  select public.record_income(
    p_organization_id => %L,
    p_amount_minor => 13000,
    p_destination_account_id => %L,
    p_category_id => %L,
    p_transaction_date => date '2026-09-23',
    p_description => 'Payload-bound retry',
    p_reference => 'IDEMP-001',
    p_idempotency_key => 'v2-sequential'
  )
$sql$,
  (select value from idempotency_ids where key = 'org_a'),
  (select value from idempotency_ids where key = 'bank_a'),
  (select value from idempotency_ids where key = 'sales_a')),
  '23505',
  'IDEMPOTENCY_CONFLICT: key was already used for a different request',
  'same key with a different payload returns the stable conflict');
select is((select count(*) from public.transactions transaction
  where transaction.organization_id = (select value from idempotency_ids where key = 'org_a')
    and transaction.idempotency_key = 'v2-sequential'), 1::bigint,
  'the conflicting payload creates no transaction');
reset role;
select is((select count(*) from public.audit_logs audit
  where audit.entity_id = (select value from idempotency_ids where key = 'sequential_first')),
  2::bigint, 'the conflicting payload creates no audit event');
select is(app.plan_quota_usage(
  (select value from idempotency_ids where key = 'org_a'),
  'max_monthly_transactions'), 1::bigint,
  'the conflicting payload consumes no quota');

-- AC-5: a failed owner transaction rolls its claim back, allowing a corrected
-- request to use the same key safely.
set local role authenticated;
select throws_ok(format($sql$
  select public.create_draft_transaction(
    %L, 'adjustment', date '2026-09-23',
    jsonb_build_array(
      jsonb_build_object('account_id', %L, 'side', 'debit', 'amount_minor', 500),
      jsonb_build_object('account_id', %L, 'side', 'credit', 'amount_minor', 400)
    ), p_idempotency_key => 'v2-failed-claim'
  )
$sql$,
  (select value from idempotency_ids where key = 'org_a'),
  (select value from idempotency_ids where key = 'cash_a'),
  (select value from idempotency_ids where key = 'capital_a')),
  '23514', 'UNBALANCED_JOURNAL: debits (500) <> credits (400)',
  'a failed posting aborts after claiming the key');
reset role;
select is((select count(*) from app.posting_idempotency claim
  where claim.organization_id = (select value from idempotency_ids where key = 'org_a')
    and claim.idempotency_key = 'v2-failed-claim'), 0::bigint,
  'a failed posting leaves no false completed claim');
select is((select count(*) from public.transactions transaction
  where transaction.organization_id = (select value from idempotency_ids where key = 'org_a')
    and transaction.idempotency_key = 'v2-failed-claim'), 0::bigint,
  'a failed posting leaves no transaction');
select is(app.plan_quota_usage(
  (select value from idempotency_ids where key = 'org_a'),
  'max_monthly_transactions'), 1::bigint,
  'a failed posting leaves quota unchanged');
set local role authenticated;
select lives_ok(format($sql$
  select public.record_owner_contribution(
    p_organization_id => %L,
    p_amount_minor => 500,
    p_destination_account_id => %L,
    p_equity_account_id => %L,
    p_transaction_date => date '2026-09-23',
    p_idempotency_key => 'v2-failed-claim'
  )
$sql$,
  (select value from idempotency_ids where key = 'org_a'),
  (select value from idempotency_ids where key = 'cash_a'),
  (select value from idempotency_ids where key = 'capital_a')),
  'a corrected request can claim a key after the failed transaction rolled back');
select is((select count(*) from public.transactions transaction
  where transaction.organization_id = (select value from idempotency_ids where key = 'org_a')
    and transaction.idempotency_key = 'v2-failed-claim'), 1::bigint,
  'the corrected retry completes exactly one transaction and claim');

-- AC-6: a normal unique posting remains posted and balanced.
insert into idempotency_ids (key, value)
values ('normal_post', public.record_income(
  p_organization_id => (select value from idempotency_ids where key = 'org_a'),
  p_amount_minor => 700,
  p_destination_account_id => (select value from idempotency_ids where key = 'bank_a'),
  p_category_id => (select value from idempotency_ids where key = 'sales_a'),
  p_transaction_date => date '2026-09-24',
  p_description => 'Normal posting regression',
  p_idempotency_key => 'v2-normal'
));
select is((select sum(case entry.side when 'debit' then entry.base_amount_minor
    else -entry.base_amount_minor end)
  from public.transaction_entries entry
  where entry.transaction_id = (select value from idempotency_ids where key = 'normal_post')),
  0::numeric, 'a normal unique posting remains balanced');
select is((select status from public.transactions transaction
  where transaction.id = (select value from idempotency_ids where key = 'normal_post')),
  'posted'::public.transaction_status, 'a normal unique posting remains posted');
select is((select count(*) from public.transaction_entries entry
  where entry.transaction_id = (select value from idempotency_ids where key = 'normal_post')),
  2::bigint, 'a normal unique posting retains its expected line count');

-- Canonical line ordering makes logically identical manual journals reuse the
-- same result even when clients serialize their line arrays differently.
insert into idempotency_ids (key, value)
values ('canonical_first', public.create_adjustment(
  (select value from idempotency_ids where key = 'org_a'),
  date '2026-09-24',
  jsonb_build_array(
    jsonb_build_object('account_id', (select value from idempotency_ids where key = 'cash_a'),
      'side', 'debit', 'amount_minor', 900),
    jsonb_build_object('account_id', (select value from idempotency_ids where key = 'capital_a'),
      'side', 'credit', 'amount_minor', 900)
  ), 'Canonical journal', 'V2 idempotency test',
  p_idempotency_key => 'v2-canonical-lines'
));
insert into idempotency_ids (key, value)
values ('canonical_retry', public.create_adjustment(
  (select value from idempotency_ids where key = 'org_a'),
  date '2026-09-24',
  jsonb_build_array(
    jsonb_build_object('amount_minor', 900, 'side', 'credit',
      'account_id', (select value from idempotency_ids where key = 'capital_a')),
    jsonb_build_object('amount_minor', 900, 'side', 'debit',
      'account_id', (select value from idempotency_ids where key = 'cash_a'))
  ), 'Canonical journal', 'V2 idempotency test',
  p_idempotency_key => 'v2-canonical-lines'
));
select is(
  (select value from idempotency_ids where key = 'canonical_retry'),
  (select value from idempotency_ids where key = 'canonical_first'),
  'canonical JSON key and journal-line order return the original result');
select is((select count(*) from public.transactions transaction
  where transaction.organization_id = (select value from idempotency_ids where key = 'org_a')
    and transaction.idempotency_key = 'v2-canonical-lines'), 1::bigint,
  'canonical retry creates one journal');

-- AC-4: tenant scope is part of the key identity.
reset role;
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '32000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'idempotency-beta-owner@ledgersuit.test',
  extensions.crypt('password', extensions.gen_salt('bf')), now(),
  '{"provider":"email"}'::jsonb, '{"full_name":"Beta Owner"}'::jsonb,
  now(), now()
);
select set_config(
  'request.jwt.claims',
  '{"sub":"32000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
insert into idempotency_ids (key, value)
values ('org_b', public.create_organization('Idempotency Beta', 'EGP'));
reset role;
select app.seed_chart_of_accounts((select value from idempotency_ids where key = 'org_b'));
select app.seed_categories((select value from idempotency_ids where key = 'org_b'));
insert into public.organization_members (organization_id, user_id, role, status)
values (
  (select value from idempotency_ids where key = 'org_b'),
  '32000000-0000-4000-8000-000000000001', 'accountant', 'active'
);
insert into idempotency_ids (key, value)
select 'bank_b', account.id from public.accounts account
where account.organization_id = (select value from idempotency_ids where key = 'org_b')
  and account.system_key = 'bank';
insert into idempotency_ids (key, value)
select 'sales_b', category.id from public.categories category
where category.organization_id = (select value from idempotency_ids where key = 'org_b')
  and category.name = 'Sales';
select set_config(
  'request.jwt.claims',
  '{"sub":"32000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
insert into idempotency_ids (key, value)
values ('tenant_a_txn', public.record_income(
  (select value from idempotency_ids where key = 'org_a'), 100,
  (select value from idempotency_ids where key = 'bank_a'),
  (select value from idempotency_ids where key = 'sales_a'),
  p_transaction_date => date '2026-09-25', p_idempotency_key => 'tenant-shared-key'
));
insert into idempotency_ids (key, value)
values ('tenant_b_txn', public.record_income(
  (select value from idempotency_ids where key = 'org_b'), 100,
  (select value from idempotency_ids where key = 'bank_b'),
  (select value from idempotency_ids where key = 'sales_b'),
  p_transaction_date => date '2026-09-25', p_idempotency_key => 'tenant-shared-key'
));
select isnt(
  (select value from idempotency_ids where key = 'tenant_a_txn'),
  (select value from idempotency_ids where key = 'tenant_b_txn'),
  'the same textual key produces independent results in different tenants');
select is((select count(*) from public.transactions transaction
  where transaction.idempotency_key = 'tenant-shared-key'), 2::bigint,
  'the tenant-scoped key exists once in each organization');
select is((select count(*) from public.transactions transaction
  where transaction.organization_id = (select value from idempotency_ids where key = 'org_a')
    and transaction.idempotency_key = 'tenant-shared-key'), 1::bigint,
  'tenant A has exactly one result for the shared key');
select is((select count(*) from public.transactions transaction
  where transaction.organization_id = (select value from idempotency_ids where key = 'org_b')
    and transaction.idempotency_key = 'tenant-shared-key'), 1::bigint,
  'tenant B has exactly one result for the shared key');

-- No-key calls preserve the existing non-idempotent behavior.
insert into idempotency_ids (key, value)
values ('no_key_one', public.record_income(
  (select value from idempotency_ids where key = 'org_a'), 101,
  (select value from idempotency_ids where key = 'bank_a'),
  (select value from idempotency_ids where key = 'sales_a'),
  p_transaction_date => date '2026-09-25', p_description => 'No key one'
));
insert into idempotency_ids (key, value)
values ('no_key_two', public.record_income(
  (select value from idempotency_ids where key = 'org_a'), 101,
  (select value from idempotency_ids where key = 'bank_a'),
  (select value from idempotency_ids where key = 'sales_a'),
  p_transaction_date => date '2026-09-25', p_description => 'No key two'
));
select isnt(
  (select value from idempotency_ids where key = 'no_key_one'),
  (select value from idempotency_ids where key = 'no_key_two'),
  'requests without an idempotency key remain independent postings');

reset role;
select is(has_table_privilege('authenticated', 'app.posting_idempotency', 'select'), false,
  'request fingerprints are not exposed to the authenticated role');

-- Historical keys are preserved without inventing a payload identity.
create temp table legacy_id as
with inserted as (
  insert into public.transactions (
    organization_id, type, status, source, transaction_date, currency_code,
    exchange_rate, description, idempotency_key
  ) values (
    (select value from idempotency_ids where key = 'org_a'), 'income', 'draft',
    'manual', date '2026-09-20', 'EGP', 1, 'Legacy keyed draft', 'v2-legacy-key'
  )
  returning id
)
select id from inserted;
insert into app.posting_idempotency (
  organization_id, idempotency_key, operation, transaction_id, completed_at
) select (select value from idempotency_ids where key = 'org_a'),
  'v2-legacy-key', 'legacy', id, now() from legacy_id;
set local role authenticated;
select throws_ok(format($sql$
  select public.record_income(%L, 300, %L, %L,
    p_transaction_date => date '2026-09-20',
    p_idempotency_key => 'v2-legacy-key')
$sql$,
  (select value from idempotency_ids where key = 'org_a'),
  (select value from idempotency_ids where key = 'bank_a'),
  (select value from idempotency_ids where key = 'sales_a')),
  '23505',
  'IDEMPOTENCY_CONFLICT: key predates payload binding and cannot be safely replayed',
  'a historical key returns an explicit conflict instead of a fabricated match');
select is((select count(*) from public.transactions transaction
  where transaction.organization_id = (select value from idempotency_ids where key = 'org_a')
    and transaction.idempotency_key = 'v2-legacy-key'), 1::bigint,
  'historical keyed rows remain unchanged after a rejected replay');

-- AC-3: independent sessions pause at the same test barrier, then hit the same
-- unique claim concurrently.
reset role;
select extensions.dblink_connect('v2_idempotency_setup',
  format('host=%s port=%s dbname=postgres user=postgres password=postgres',
    inet_server_addr(), inet_server_port()));
select extensions.dblink_exec('v2_idempotency_setup', $setup$
  drop function if exists public.test_v2_idempotency_race();
  set session_replication_role = replica;
  delete from app.posting_idempotency
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.transaction_entries
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.transactions
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.audit_logs
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.categories
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.accounts
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from app.transaction_usage_buckets
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.organization_members
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.organization_settings
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.subscriptions
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.organizations
    where id = '32000000-0000-4000-8000-000000000101';
  delete from auth.users where id = '32000000-0000-4000-8000-000000000100';
  set session_replication_role = origin;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '32000000-0000-4000-8000-000000000100',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'idempotency-race@ledgersuit.test',
    extensions.crypt('password', extensions.gen_salt('bf')), now(),
    '{"provider":"email"}'::jsonb, '{"full_name":"Race Owner"}'::jsonb,
    now(), now()
  );
  insert into public.organizations (
    id, name, slug, country_code, timezone, base_currency, created_by
  ) values (
    '32000000-0000-4000-8000-000000000101', 'Idempotency Race',
    'idempotency-race', 'EG', 'Africa/Cairo', 'EGP',
    '32000000-0000-4000-8000-000000000100'
  );
  insert into public.organization_settings (organization_id, default_transaction_currency)
  values ('32000000-0000-4000-8000-000000000101', 'EGP');
  insert into public.organization_members (organization_id, user_id, role, status)
  values ('32000000-0000-4000-8000-000000000101',
    '32000000-0000-4000-8000-000000000100', 'owner', 'active');
  do $block$
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"32000000-0000-4000-8000-000000000100","role":"authenticated"}', false);
    perform app.seed_chart_of_accounts('32000000-0000-4000-8000-000000000101');
    perform app.seed_categories('32000000-0000-4000-8000-000000000101');
  end;
  $block$;

  create or replace function public.test_v2_idempotency_race()
  returns uuid language plpgsql security definer set search_path = '' as $function$
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"32000000-0000-4000-8000-000000000100","role":"authenticated"}', true);
    perform pg_sleep(0.25);
    return public.record_income(
      p_organization_id => '32000000-0000-4000-8000-000000000101',
      p_amount_minor => 4200,
      p_destination_account_id => (
        select account.id from public.accounts account
        where account.organization_id = '32000000-0000-4000-8000-000000000101'
          and account.system_key = 'bank'
      ),
      p_category_id => (
        select category.id from public.categories category
        where category.organization_id = '32000000-0000-4000-8000-000000000101'
          and category.name = 'Sales'
      ),
      p_transaction_date => date '2026-09-23',
      p_description => 'Concurrent idempotency race',
      p_reference => 'RACE-001',
      p_idempotency_key => 'v2-concurrent'
    );
  end;
  $function$;
$setup$);
select extensions.dblink_disconnect('v2_idempotency_setup');

select extensions.dblink_connect('v2_idempotency_1',
  format('host=%s port=%s dbname=postgres user=postgres password=postgres',
    inet_server_addr(), inet_server_port()));
select extensions.dblink_connect('v2_idempotency_2',
  format('host=%s port=%s dbname=postgres user=postgres password=postgres',
    inet_server_addr(), inet_server_port()));
select extensions.dblink_send_query('v2_idempotency_1',
  'select public.test_v2_idempotency_race()');
select extensions.dblink_send_query('v2_idempotency_2',
  'select public.test_v2_idempotency_race()');
create temp table idempotency_race_results (transaction_id uuid not null);
insert into idempotency_race_results
select transaction_id from extensions.dblink_get_result('v2_idempotency_1')
  as result(transaction_id uuid);
insert into idempotency_race_results
select transaction_id from extensions.dblink_get_result('v2_idempotency_2')
  as result(transaction_id uuid);
select extensions.dblink_get_result('v2_idempotency_1');
select extensions.dblink_get_result('v2_idempotency_2');

select is((select count(*) from idempotency_race_results), 2::bigint,
  'both concurrent same-payload requests resolve successfully');
select is((select count(distinct transaction_id) from idempotency_race_results), 1::bigint,
  'both concurrent requests resolve to one logical transaction');
select is((select count(*) from public.transactions transaction
  where transaction.organization_id = '32000000-0000-4000-8000-000000000101'
    and transaction.idempotency_key = 'v2-concurrent'), 1::bigint,
  'the concurrent race creates one transaction');
select is((select count(*) from public.transaction_entries entry
  where entry.transaction_id = (select transaction_id from idempotency_race_results limit 1)),
  2::bigint, 'the concurrent race creates one balanced line set');
select is((select jsonb_build_object(
    'created', count(*) filter (where audit.action = 'transaction.created'),
    'posted', count(*) filter (where audit.action = 'transaction.posted'))
  from public.audit_logs audit
  where audit.entity_id = (select transaction_id from idempotency_race_results limit 1)),
  '{"created": 1, "posted": 1}'::jsonb,
  'the concurrent race creates one audit effect per posting phase');
select is(app.plan_quota_usage(
  '32000000-0000-4000-8000-000000000101', 'max_monthly_transactions'),
  1::bigint, 'the concurrent race consumes quota once');
select is((select count(*) from app.posting_idempotency claim
  where claim.organization_id = '32000000-0000-4000-8000-000000000101'
    and claim.idempotency_key = 'v2-concurrent'
    and claim.transaction_id = (select transaction_id from idempotency_race_results limit 1)
    and claim.completed_at is not null), 1::bigint,
  'the concurrent winner leaves one completed claim linked to the result');

select extensions.dblink_connect('v2_idempotency_cleanup',
  format('host=%s port=%s dbname=postgres user=postgres password=postgres',
    inet_server_addr(), inet_server_port()));
select extensions.dblink_exec('v2_idempotency_cleanup', $cleanup$
  drop function public.test_v2_idempotency_race();
  set session_replication_role = replica;
  delete from app.posting_idempotency
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.transaction_entries
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.transactions
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.audit_logs
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.categories
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.accounts
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from app.transaction_usage_buckets
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.organization_members
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.organization_settings
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.subscriptions
    where organization_id = '32000000-0000-4000-8000-000000000101';
  delete from public.organizations
    where id = '32000000-0000-4000-8000-000000000101';
  delete from auth.users where id = '32000000-0000-4000-8000-000000000100';
  set session_replication_role = origin;
$cleanup$);
select extensions.dblink_disconnect('v2_idempotency_cleanup');
select extensions.dblink_disconnect('v2_idempotency_1');
select extensions.dblink_disconnect('v2_idempotency_2');

select * from finish();
rollback;
