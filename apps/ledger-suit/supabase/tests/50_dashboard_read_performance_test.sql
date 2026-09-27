-- LS-PERF-001/002: native pgTAP coverage for bounded, authorize-once reads.
-- All fixtures are private to this transaction; never reseed the demo history.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table perf_test_ids(key text primary key, id uuid not null);
grant select on perf_test_ids to authenticated, anon;
insert into auth.users(id, email, raw_app_meta_data, raw_user_meta_data)
select ('50000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  'dashboard-pgtap-' || i || '@test.local', '{}', '{}'
from generate_series(1, 4) i;

select set_config('request.jwt.claims',
  '{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare
  org uuid; cash uuid; revenue uuid; expense uuid;
begin
  org := public.create_organization('LS-PERF-001 pgTAP', 'EGP');
  cash := public.create_account(org, 'Performance cash', 'asset', 'cash');
  revenue := public.create_account(org, 'Performance revenue', 'revenue', 'service_revenue');
  expense := public.create_account(org, 'Performance expense', 'expense', 'rent');
  insert into perf_test_ids values ('org', org), ('cash', cash);
  insert into public.organization_members(organization_id, user_id, role) values
    (org, '50000000-0000-4000-8000-000000000002', 'accountant'),
    (org, '50000000-0000-4000-8000-000000000003', 'viewer');
  for i in 1..10 loop
    perform public.record_income(org, 100, cash, p_revenue_account_id => revenue,
      p_transaction_date => date '2036-09-01' + i,
      p_description => 'Performance receipt ' || i);
  end loop;
  perform public.record_income(org, 700, cash, p_revenue_account_id => revenue,
    p_transaction_date => '2036-08-08', p_description => 'Previous month');
  perform public.record_expense(org, 200, cash, p_expense_account_id => expense,
    p_transaction_date => '2036-09-12', p_description => 'Performance expense');
  perform public.create_draft_transaction(org, 'income', '2036-09-15', jsonb_build_array(
    jsonb_build_object('account_id', cash, 'side', 'debit', 'amount_minor', 9999),
    jsonb_build_object('account_id', revenue, 'side', 'credit', 'amount_minor', 9999)
  ), p_description => 'Unposted performance draft');
end $$;

select set_config('request.jwt.claims',
  '{"sub":"50000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
declare org uuid; cash uuid; revenue uuid;
begin
  org := public.create_organization('LS-PERF-001 foreign tenant', 'EGP');
  insert into perf_test_ids values ('foreign_org', org);
  cash := public.create_account(org, 'Foreign cash', 'asset', 'cash');
  revenue := public.create_account(org, 'Foreign revenue', 'revenue', 'service_revenue');
  perform public.record_income(org, 999999, cash, p_revenue_account_id => revenue,
    p_transaction_date => '2036-09-05', p_description => 'Foreign secret');
end $$;
set constraints all immediate;

-- These helpers remain SECURITY INVOKER: each assertion executes with the
-- authenticated/anonymous role and actor claims, not the fixture creator.
create function pg_temp.perf_member_checks(actor uuid)
returns setof text language plpgsql as $checks$
declare org uuid; cash uuid; summary jsonb;
begin
  select id into org from perf_test_ids where key = 'org';
  select id into cash from perf_test_ids where key = 'cash';
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  summary := public.dashboard_summary(org, '2036-09-20');
  return next is(summary ->> 'cash_and_bank_minor', '1500', actor || ': posted cash excludes draft and foreign entries');
  return next is(summary ->> 'revenue_this_month_minor', '1000', actor || ': current revenue');
  return next is(summary ->> 'expenses_this_month_minor', '200', actor || ': current expenses');
  return next is(summary ->> 'net_profit_this_month_minor', '800', actor || ': current net profit');
  return next is(summary ->> 'revenue_previous_month_minor', '700', actor || ': previous revenue');
  return next results_eq(
    format('select month, revenue_minor, expense_minor, net_minor from public.report_monthly_series(%L, 2, %L)', org, '2036-09-20'),
    $$values (date '2036-08-01', 700::bigint, 0::bigint, 700::bigint),
             (date '2036-09-01', 1000::bigint, 200::bigint, 800::bigint)$$,
    actor || ': monthly values exclude draft and foreign entries');
  return next is((select net_debit_minor from public.dashboard_liquid_accounts(org) where account_id = cash),
    '1500', actor || ': targeted liquid balance');
  return next results_eq(
    format('select * from public.dashboard_liquid_accounts(%L)', org),
    format('select account_id, name, currency, net_debit_minor, subtype from public.account_balances
            where organization_id = %L and is_liquid and not is_archived order by account_id', org),
    actor || ': liquid RPC preserves the RLS-visible balance contract');
  return next is((select count(*) from public.search_transactions(org, p_limit => 8)),
    8::bigint, actor || ': recent page returns eight rows');
  return next ok((select bool_and(total_count = 13) from public.search_transactions(org, p_limit => 8)),
    actor || ': total_count is measured before LIMIT');
  return next results_eq(
    format('select id from public.search_transactions(%L, p_limit => 3, p_offset => 3)', org),
    format('select id from public.transaction_summaries where organization_id = %L
            order by transaction_date desc, created_at desc, id desc limit 3 offset 3', org),
    actor || ': default ordering and pagination match the visible journals');
  return next results_eq(
    format('select id from public.search_transactions(%L, p_sort => %L, p_direction => %L, p_limit => 3)', org, 'debit', 'asc'),
    format('select id from public.transaction_summaries where organization_id = %L
            order by base_debit_minor asc, created_at desc, id desc limit 3', org),
    actor || ': amount sorting retains the stable tiebreakers');
  return next is((select count(*) from public.search_transactions(org,
    p_search => 'Performance receipt', p_from_date => '2036-09-05', p_to_date => '2036-09-08',
    p_statuses => array['posted']::public.transaction_status[],
    p_account_ids => array[cash], p_min_amount_minor => 100, p_max_amount_minor => 100)),
    4::bigint, actor || ': combined text/date/status/account/amount filters');
  return next is((select count(*) from public.search_transactions(org, p_offset => 999)),
    0::bigint, actor || ': out-of-range page is empty');
  return next is((select count(*) from app.search_transaction_page(org, p_limit => 8)),
    8::bigint, actor || ': trusted candidate boundary is accessible to members');
  return next results_eq(
    format('select id, total_count from app.search_recent_transaction_page(%L, 8, 0)', org),
    format('select id, total_count from public.search_transactions(%L, p_limit => 8)', org),
    actor || ': index-backed recent page preserves ids and exact count');
  return next is((select array_agg(ordinal order by ordinal) from app.search_recent_transaction_page(org, 8, 0)),
    array[1,2,3,4,5,6,7,8]::bigint[], actor || ': recent-page ordinals remain stable');
  return next results_eq(
    format('select id from app.search_transaction_details(%L, array(select id from app.search_recent_transaction_page(%L, 8, 0))) order by id', org, org),
    format('select id from public.search_transactions(%L, p_limit => 8) order by id', org),
    actor || ': trusted enrichment is bounded to the selected page');
end;
$checks$;

create function pg_temp.perf_denial_checks(actor uuid, target_org uuid, anonymous boolean default false)
returns setof text language plpgsql as $$
declare boundary text;
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', actor, 'role', case when anonymous then 'anon' else 'authenticated' end)::text, true);
  foreach boundary in array array[
    'public.dashboard_summary', 'public.report_monthly_series',
    'public.dashboard_liquid_accounts', 'public.search_transactions', 'app.search_transaction_page',
    'app.search_recent_transaction_page', 'app.search_transaction_page_bounded'
  ] loop
    return next throws_ok(format('select * from %s(%L)', boundary, target_org),
      '42501', null, coalesce(actor::text, 'anonymous') || ': denied at ' || boundary);
  end loop;
  return next throws_ok(
    format('select * from app.search_transaction_details(%L, array[]::uuid[])', target_org),
    '42501', null, coalesce(actor::text, 'anonymous') || ': denied at app.search_transaction_details');
  if not anonymous then
    return next is((select count(*) from public.transactions where organization_id = target_org),
      0::bigint, actor || ': direct journal RLS still hides the foreign tenant');
  end if;
end;
$$;

set local role authenticated;
select * from pg_temp.perf_member_checks('50000000-0000-4000-8000-000000000001');
select * from pg_temp.perf_member_checks('50000000-0000-4000-8000-000000000002');
select * from pg_temp.perf_member_checks('50000000-0000-4000-8000-000000000003');
select * from pg_temp.perf_denial_checks('50000000-0000-4000-8000-000000000001',
  (select id from perf_test_ids where key = 'foreign_org'));
select * from pg_temp.perf_denial_checks('50000000-0000-4000-8000-000000000002',
  (select id from perf_test_ids where key = 'foreign_org'));
select * from pg_temp.perf_denial_checks('50000000-0000-4000-8000-000000000003',
  (select id from perf_test_ids where key = 'foreign_org'));
select * from pg_temp.perf_denial_checks('50000000-0000-4000-8000-000000000004',
  (select id from perf_test_ids where key = 'org'));

-- A trusted read must continue to honor per-member capability revocations.
reset role;
update public.organization_members set revoked_capabilities = array['transactions.read']
where organization_id = (select id from perf_test_ids where key = 'org')
  and user_id = '50000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims',
  '{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(public.dashboard_summary((select id from perf_test_ids where key = 'org'), '2036-09-20')
  ->> 'cash_and_bank_minor', '0', 'revoked entry access masks summary balances');
select ok((select bool_and(revenue_minor = 0 and expense_minor = 0 and net_minor = 0)
  from public.report_monthly_series((select id from perf_test_ids where key = 'org'), 2, '2036-09-20')),
  'revoked entry access masks monthly movements');
select ok((select bool_and(net_debit_minor = '0') from public.dashboard_liquid_accounts(
  (select id from perf_test_ids where key = 'org'))), 'revoked entry access masks liquid balances');
select throws_ok(format('select * from public.search_transactions(%L)',
  (select id from perf_test_ids where key = 'org')), '42501', null, 'revoked entry access denies public search');
select throws_ok(format('select * from app.search_transaction_page(%L)',
  (select id from perf_test_ids where key = 'org')), '42501', null, 'revoked entry access denies trusted search');
select throws_ok(format('select * from app.search_recent_transaction_page(%L)',
  (select id from perf_test_ids where key = 'org')), '42501', null, 'revoked entry access denies recent-page helper');
select throws_ok(format('select * from app.search_transaction_page_bounded(%L)',
  (select id from perf_test_ids where key = 'org')), '42501', null, 'revoked entry access denies page dispatcher');
select throws_ok(format('select * from app.search_transaction_details(%L, array[]::uuid[])',
  (select id from perf_test_ids where key = 'org')), '42501', null, 'revoked entry access denies page enrichment');

reset role;
update public.organization_members set revoked_capabilities = array['reports.read', 'accounts.read']
where organization_id = (select id from perf_test_ids where key = 'org')
  and user_id = '50000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok(format('select public.dashboard_summary(%L)',
  (select id from perf_test_ids where key = 'org')), '42501', null, 'revoked reports capability denies summary');
select throws_ok(format('select * from public.report_monthly_series(%L)',
  (select id from perf_test_ids where key = 'org')), '42501', null, 'revoked reports capability denies monthly series');
select throws_ok(format('select * from public.dashboard_liquid_accounts(%L)',
  (select id from perf_test_ids where key = 'org')), '42501', null, 'revoked accounts capability denies liquid RPC');

reset role;
set local role anon;
-- Check execute privileges through actual calls, without relying on catalog ACLs.
select * from pg_temp.perf_denial_checks(null, (select id from perf_test_ids where key = 'org'), true);
reset role;
select ok((select bool_and(relrowsecurity) from pg_class
  where oid in ('public.transactions'::regclass, 'public.transaction_entries'::regclass, 'public.accounts'::regclass)),
  'global RLS remains enabled on journals, entries and accounts');
select * from finish();
rollback;
