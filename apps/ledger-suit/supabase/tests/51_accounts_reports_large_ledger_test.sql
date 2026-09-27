-- LS-PERF-003: exact Accounts/Overview contracts and trusted report boundaries.
-- Small deterministic regression fixture; large-ledger timings live in the
-- performance harness. Everything here is rolled back, including Auth users.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table accounts_reports_ids(key text primary key, id uuid not null);
grant select on accounts_reports_ids to authenticated, anon;
insert into auth.users(id, email, raw_app_meta_data, raw_user_meta_data)
select ('53000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  'accounts-reports-pgtap-' || i || '@test.local', '{}', '{}'
from generate_series(1, 4) i;

select set_config('request.jwt.claims',
  '{"sub":"53000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare org uuid; cash uuid; revenue uuid; expense uuid; unused uuid; draft_only uuid;
begin
  org := public.create_organization('LS-PERF-003 pgTAP', 'EGP');
  cash := public.create_account(org, 'Report cash', 'asset', 'cash');
  revenue := public.create_account(org, 'Report revenue', 'revenue', 'service_revenue');
  expense := public.create_account(org, 'Report expense', 'expense', 'rent');
  unused := public.create_account(org, 'Unused cash', 'asset', 'cash');
  draft_only := public.create_account(org, 'Draft-only cash', 'asset', 'cash');
  insert into accounts_reports_ids values ('org', org), ('cash', cash),
    ('revenue', revenue), ('unused', unused), ('draft_only', draft_only);
  insert into public.organization_members(organization_id, user_id, role) values
    (org, '53000000-0000-4000-8000-000000000002', 'accountant'),
    (org, '53000000-0000-4000-8000-000000000003', 'viewer');
  perform public.record_income(org, 700, cash, p_revenue_account_id => revenue,
    p_transaction_date => '2036-08-08', p_description => 'Opening receipt');
  perform public.record_income(org, 1000, cash, p_revenue_account_id => revenue,
    p_transaction_date => '2036-09-05', p_description => 'Period receipt');
  perform public.record_expense(org, 200, cash, p_expense_account_id => expense,
    p_transaction_date => '2036-09-12', p_description => 'Period expense');
  perform public.record_income(org, 300, cash, p_revenue_account_id => revenue,
    p_transaction_date => '2036-10-05', p_description => 'Future receipt');
  perform public.create_draft_transaction(org, 'income', '2036-09-15', jsonb_build_array(
    jsonb_build_object('account_id', draft_only, 'side', 'debit', 'amount_minor', 9999),
    jsonb_build_object('account_id', revenue, 'side', 'credit', 'amount_minor', 9999)
  ), p_description => 'Excluded unposted draft');
  set constraints all immediate;
  perform public.archive_account(cash);
end $$;

select set_config('request.jwt.claims',
  '{"sub":"53000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
declare org uuid; cash uuid; revenue uuid;
begin
  org := public.create_organization('LS-PERF-003 foreign tenant', 'EGP');
  cash := public.create_account(org, 'Foreign cash', 'asset', 'cash');
  revenue := public.create_account(org, 'Foreign revenue', 'revenue', 'service_revenue');
  insert into accounts_reports_ids values ('foreign_org', org), ('foreign_cash', cash);
  perform public.record_income(org, 999999, cash, p_revenue_account_id => revenue,
    p_transaction_date => '2036-09-05', p_description => 'Foreign secret');
end $$;
set constraints all immediate;

-- SECURITY INVOKER helpers run as the actual caller, never as the fixture owner.
create function pg_temp.accounts_reports_member_checks(actor uuid)
returns setof text language plpgsql as $checks$
declare org uuid; cash uuid; overview jsonb; as_of date;
begin
  select id into org from accounts_reports_ids where key = 'org';
  select id into cash from accounts_reports_ids where key = 'cash';
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  return next results_eq(
    format('select * from public.read_account_balances(%L) order by account_id', org),
    format('select organization_id, account_id, code, name, type, subtype, currency, account_role,
      control_subledger_type, control_binding_locked, normal_balance, contra_account_id, is_system,
      classification_locked, net_debit_minor, statement_balance_minor, entry_count,
      is_archived, is_liquid, parent_account_id
      from public.account_balances where organization_id = %L order by account_id', org),
    actor || ': exact Accounts UI projection matches the authorized view');
  return next results_eq(
    format('select net_debit_minor, statement_balance_minor, entry_count, is_archived,
      classification_locked from public.read_account_balances(%L) where account_id = %L', org, cash),
    $$values ('1800'::text, '1800'::text, 4::bigint, true, true)$$,
    actor || ': archived posted balance includes all dates but no foreign or draft amounts');
  return next results_eq(
    format('select net_debit_minor, entry_count, classification_locked
      from public.read_account_balances(%L) where account_id = %L', org,
      (select id from accounts_reports_ids where key = 'unused')),
    $$values ('0'::text, 0::bigint, false)$$,
    actor || ': unused accounts retain zero balances and unlocked metadata');
  return next results_eq(
    format('select net_debit_minor, entry_count, classification_locked
      from public.read_account_balances(%L) where account_id = %L', org,
      (select id from accounts_reports_ids where key = 'draft_only')),
    $$values ('0'::text, 0::bigint, true)$$,
    actor || ': draft history locks classification without contributing posted balances');

  -- Independently pin amounts so parity cannot pass merely because both paths
  -- share the same mistake. Opening, period, future and draft populations differ.
  return next results_eq(
    format('select opening_debit_minor, opening_credit_minor, period_debit_minor,
      period_credit_minor, closing_debit_minor, closing_credit_minor
      from public.report_trial_balance(%L, %L, %L) where account_id = %L',
      org, '2036-09-01', '2036-09-30', cash),
    $$values ('700'::text, '0'::text, '1000'::text, '200'::text, '1500'::text, '0'::text)$$,
    actor || ': six-column Trial Balance preserves exact opening and period movements');
  return next results_eq(
    format('select debit_minor, credit_minor, running_balance_minor
      from public.report_general_ledger(%L, %L, %L, %L) order by entry_date',
      org, cash, '2036-09-01', '2036-09-30'),
    $$values (1000::bigint, 0::bigint, 1700::bigint), (0::bigint, 200::bigint, 1500::bigint)$$,
    actor || ': General Ledger preserves exact opening and running balances');

  foreach as_of in array array[null::date, date '2036-08-31', date '2036-10-31'] loop
    overview := public.report_financial_overview(org, '2036-09-01', '2036-09-30', as_of);
    return next is(overview -> 'profit_loss',
      (select coalesce(jsonb_agg(to_jsonb(r) order by r.section, r.code nulls last, r.name), '[]'::jsonb)
       from public.report_profit_and_loss(org, '2036-09-01', '2036-09-30') r),
      actor || ': Overview P&L matches detail with as-of ' || coalesce(as_of::text, 'default'));
    return next is(overview -> 'balance_sheet',
      (select coalesce(jsonb_agg(to_jsonb(r) order by r.section, r.statement_line, r.code nulls last, r.account_id), '[]'::jsonb)
       from public.report_classified_balance_sheet(org, coalesce(as_of, '2036-09-30')) r),
      actor || ': Overview Balance Sheet matches detail with independent as-of');
    return next is(overview -> 'trial_balance',
      (select coalesce(jsonb_agg(to_jsonb(r) order by r.code nulls last, r.name, r.account_id), '[]'::jsonb)
       from public.report_trial_balance(org, '2036-09-01', '2036-09-30') r),
      actor || ': Overview Trial Balance matches all detailed columns');
    return next is(overview -> 'integrity',
      public.check_balance_sheet_integrity(org, coalesce(as_of, '2036-09-30')),
      actor || ': Overview integrity matches the existing report');
    return next is(overview #>> '{reconciliation,profit_loss_minor}', '800',
      actor || ': reconciliation retains exact period profit');
    return next is(overview #>> '{reconciliation,profit_loss_gl_minor}', '800',
      actor || ': reconciliation ledger profit excludes opening, future and draft entries');
    return next is(overview #>> '{reconciliation,balance_sheet_difference_minor}', '0',
      actor || ': Balance Sheet reconciles with the ledger');
    return next is(overview -> 'reconciliation',
      public.report_statement_reconciliation(org, '2036-09-01', '2036-09-30', as_of),
      actor || ': established reconciliation RPC delegates the complete payload');
  end loop;
  return next is(public.report_indirect_cash_flow(org, '2036-09-01', '2036-09-30')
    ->> 'net_cash_change_minor', '800', actor || ': Cash Flow retains exact period cash movement');
  return next throws_ok(format('select * from public.report_general_ledger(%L, %L, %L, %L)',
    org, (select id from accounts_reports_ids where key = 'foreign_cash'), '2036-09-01', '2036-09-30'),
    '42501', null, actor || ': member cannot substitute a foreign account');
  return next throws_ok(format('select public.report_financial_overview(%L, %L, %L)',
    org, '2036-09-30', '2036-09-01'), '22023', null,
    actor || ': invalid Overview range raises an error instead of empty financial data');
end;
$checks$;

create function pg_temp.accounts_reports_denial_checks(actor uuid, target_org uuid, anonymous boolean default false)
returns setof text language plpgsql as $$
declare boundary text; cash uuid;
begin
  select id into cash from accounts_reports_ids
    where key = case when target_org = (select id from accounts_reports_ids where key = 'org')
      then 'cash' else 'foreign_cash' end;
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', actor, 'role', case when anonymous then 'anon' else 'authenticated' end)::text, true);
  foreach boundary in array array[
    format('public.read_account_balances(%L)', target_org),
    format('public.report_financial_overview(%L, %L, %L)', target_org, '2036-09-01', '2036-09-30'),
    format('public.report_statement_reconciliation(%L, %L, %L)', target_org, '2036-09-01', '2036-09-30'),
    format('public.report_profit_and_loss(%L, %L, %L)', target_org, '2036-09-01', '2036-09-30'),
    format('public.report_balance_sheet(%L, %L)', target_org, '2036-09-30'),
    format('public.report_trial_balance(%L, %L, %L)', target_org, '2036-09-01', '2036-09-30'),
    format('public.report_classified_balance_sheet(%L, %L)', target_org, '2036-09-30'),
    format('public.check_balance_sheet_integrity(%L, %L)', target_org, '2036-09-30'),
    format('public.report_cash_flow_detail(%L, %L, %L)', target_org, '2036-09-01', '2036-09-30'),
    format('public.report_cash_flow(%L, %L, %L)', target_org, '2036-09-01', '2036-09-30'),
    format('public.report_indirect_cash_flow(%L, %L, %L)', target_org, '2036-09-01', '2036-09-30'),
    format('public.report_general_ledger(%L, %L, %L, %L)', target_org, cash, '2036-09-01', '2036-09-30')
  ] loop
    return next throws_ok('select * from ' || boundary, '42501', null,
      coalesce(actor::text, 'anonymous') || ': denied at ' || boundary);
  end loop;
end;
$$;

set local role authenticated;
select * from pg_temp.accounts_reports_member_checks('53000000-0000-4000-8000-000000000001');
select * from pg_temp.accounts_reports_member_checks('53000000-0000-4000-8000-000000000002');
select * from pg_temp.accounts_reports_member_checks('53000000-0000-4000-8000-000000000003');
select * from pg_temp.accounts_reports_denial_checks('53000000-0000-4000-8000-000000000001',
  (select id from accounts_reports_ids where key = 'foreign_org'));
select * from pg_temp.accounts_reports_denial_checks('53000000-0000-4000-8000-000000000002',
  (select id from accounts_reports_ids where key = 'foreign_org'));
select * from pg_temp.accounts_reports_denial_checks('53000000-0000-4000-8000-000000000003',
  (select id from accounts_reports_ids where key = 'foreign_org'));
select * from pg_temp.accounts_reports_denial_checks('53000000-0000-4000-8000-000000000004',
  (select id from accounts_reports_ids where key = 'org'));
select is((select count(*) from public.transaction_entries
  where organization_id = (select id from accounts_reports_ids where key = 'org')),
  0::bigint, 'outsider direct entry reads still obey RLS');

reset role;
update public.organization_members set revoked_capabilities = array['reports.read', 'accounts.read']
where organization_id = (select id from accounts_reports_ids where key = 'org')
  and user_id = '53000000-0000-4000-8000-000000000002';
set local role authenticated;
select * from pg_temp.accounts_reports_denial_checks('53000000-0000-4000-8000-000000000002',
  (select id from accounts_reports_ids where key = 'org'));
reset role;
set local role anon;
select * from pg_temp.accounts_reports_denial_checks(null,
  (select id from accounts_reports_ids where key = 'org'), true);
reset role;
select ok((select bool_and(relrowsecurity) from pg_class
  where oid in ('public.transactions'::regclass, 'public.transaction_entries'::regclass, 'public.accounts'::regclass)),
  'global RLS remains enabled on all ledger tables used by trusted reads');
select * from finish();
rollback;
