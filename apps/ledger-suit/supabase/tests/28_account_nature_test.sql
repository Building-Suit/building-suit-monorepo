-- A bounded phase-2 contract: nature, contra links and correct statement signs.
-- Synthetic fixtures and every mutation roll back; never run against hosted data.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create temp table nature_ids (key text primary key, id uuid);
grant all on nature_ids to authenticated;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
 email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('12800000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
 'authenticated', 'authenticated', 'nature-owner@ledger.test',
 extensions.crypt('password', extensions.gen_salt('bf')), now(),
 '{"provider":"email"}', '{"full_name":"Nature Owner"}', now(), now());
select set_config('request.jwt.claims', '{"sub":"12800000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into nature_ids values ('org', public.create_organization('Nature test', 'EGP'));
reset role;
update public.subscriptions set status = 'active', provider = 'paymob',
 provider_subscription_id = 'sub_nature_test', provider_status = 'active',
 billing_interval = 'monthly', checkout_completed_at = now(),
 current_period_start = now(), current_period_end = now() + interval '30 days'
where organization_id = (select id from nature_ids where key = 'org');
set local role authenticated;
insert into nature_ids values
 ('equipment', public.create_account((select id from nature_ids where key='org'), 'Equipment', 'asset', 'equipment')),
 ('bank', public.create_account((select id from nature_ids where key='org'), 'Bank', 'asset', 'bank')),
 ('capital', public.create_account((select id from nature_ids where key='org'), 'Capital', 'equity', 'owner_capital')),
 ('drawings', public.create_account((select id from nature_ids where key='org'), 'Drawings', 'equity', 'owner_drawings')),
 ('revenue', public.create_account((select id from nature_ids where key='org'), 'Services', 'revenue', 'service_revenue')),
 ('expense', public.create_account((select id from nature_ids where key='org'), 'Depreciation expense', 'expense', 'depreciation'));
insert into nature_ids values
 ('accumulated', public.create_account((select id from nature_ids where key='org'), 'Accumulated depreciation', 'asset', 'equipment',
  p_normal_balance=>'credit', p_contra_account_id=>(select id from nature_ids where key='equipment'))),
 ('returns', public.create_account((select id from nature_ids where key='org'), 'Service refunds', 'revenue', 'service_revenue',
  p_normal_balance=>'debit', p_contra_account_id=>(select id from nature_ids where key='revenue'))),
 ('recovery', public.create_account((select id from nature_ids where key='org'), 'Depreciation correction', 'expense', 'depreciation',
  p_normal_balance=>'credit', p_contra_account_id=>(select id from nature_ids where key='expense'))),
 ('child', public.create_account((select id from nature_ids where key='org'), 'Equipment detail', 'asset', 'equipment',
  p_parent_account_id=>(select id from nature_ids where key='equipment')));
select is((select normal_balance::text from public.accounts where id=(select id from nature_ids where key='drawings')), 'debit', 'new drawings use debit nature while remaining equity');
select is((select type::text from public.accounts where id=(select id from nature_ids where key='accumulated')), 'asset', 'credit nature does not turn accumulated depreciation into a liability');
select throws_ok(format('select public.create_account(%L, %L, %L, %L, p_contra_account_id=>%L)',
 (select id from nature_ids where key='org'), 'Invalid same side', 'asset', 'equipment', (select id from nature_ids where key='equipment')),
 '23514', null, 'contra target must have opposite nature');
select throws_ok(format('select public.create_account(%L, %L, %L, %L, p_normal_balance=>%L, p_contra_account_id=>%L)',
 (select id from nature_ids where key='org'), 'Invalid chain', 'asset', 'equipment', 'debit', (select id from nature_ids where key='accumulated')),
 '23514', null, 'contra chains are rejected');
select throws_ok(format('update public.accounts set normal_balance=%L where id=%L', 'credit', (select id from nature_ids where key='equipment')),
 '23514', null, 'a target cannot invalidate an existing contra link');
select throws_ok(format('update public.accounts set contra_account_id=id where id=%L', (select id from nature_ids where key='child')),
 '23514', null, 'self links are rejected at the table boundary');
select throws_ok(format('select public.create_account(%L, %L, %L, %L, p_normal_balance=>%L, p_contra_account_id=>%L)',
 (select id from nature_ids where key='org'), 'Wrong type', 'equity', 'other_equity', 'credit', (select id from nature_ids where key='equipment')),
 '23514', null, 'contra target must have the same account type');
select lives_ok(format('select public.update_account(%L, %L, p_normal_balance=>%L)',
 (select id from nature_ids where key='child'), 'Equipment detail', 'credit'), 'an unused account can change nature');
select lives_ok(format('select public.update_account(%L, %L, p_contra_account_id=>%L)',
 (select id from nature_ids where key='child'), 'Equipment detail', (select id from nature_ids where key='equipment')), 'an unused account can set its contra link');
select lives_ok(format('select public.update_account(%L, %L, p_clear_contra=>true)',
 (select id from nature_ids where key='child'), 'Equipment detail'), 'an unused account can remove its contra link explicitly');
select is((select contra_account_id from public.accounts where id=(select id from nature_ids where key='child')), null::uuid, 'clear preserves the API distinction between omitted and removed link');

-- Independent expected amounts: assets 4,150,000; equity 3,900,000; profit 250,000.
-- All values below are integer minor units, with no tax or costing policy implied.
insert into nature_ids values ('opening', public.create_adjustment(
 (select id from nature_ids where key='org'), '2026-01-01',
 jsonb_build_array(
 jsonb_build_object('account_id',(select id from nature_ids where key='equipment'),'side','debit','amount_minor',3000000),
 jsonb_build_object('account_id',(select id from nature_ids where key='bank'),'side','debit','amount_minor',1000000),
 jsonb_build_object('account_id',(select id from nature_ids where key='capital'),'side','credit','amount_minor',4000000)),
 'Capital contribution', 'Synthetic acceptance fixture'));
insert into nature_ids values ('depreciation', public.create_adjustment(
 (select id from nature_ids where key='org'), '2026-01-02', jsonb_build_array(
 jsonb_build_object('account_id',(select id from nature_ids where key='expense'),'side','debit','amount_minor',600000),
 jsonb_build_object('account_id',(select id from nature_ids where key='accumulated'),'side','credit','amount_minor',600000)),
 'Depreciation', 'Synthetic acceptance fixture'));
select public.create_adjustment((select id from nature_ids where key='org'), '2026-01-03', jsonb_build_array(
 jsonb_build_object('account_id',(select id from nature_ids where key='bank'),'side','debit','amount_minor',1000000),
 jsonb_build_object('account_id',(select id from nature_ids where key='revenue'),'side','credit','amount_minor',1000000)),
 'Services delivered', 'Synthetic acceptance fixture');
select public.create_adjustment((select id from nature_ids where key='org'), '2026-01-04', jsonb_build_array(
 jsonb_build_object('account_id',(select id from nature_ids where key='returns'),'side','debit','amount_minor',200000),
 jsonb_build_object('account_id',(select id from nature_ids where key='bank'),'side','credit','amount_minor',200000)),
 'Service refund', 'Synthetic acceptance fixture');
select public.create_adjustment((select id from nature_ids where key='org'), '2026-01-05', jsonb_build_array(
 jsonb_build_object('account_id',(select id from nature_ids where key='drawings'),'side','debit','amount_minor',100000),
 jsonb_build_object('account_id',(select id from nature_ids where key='bank'),'side','credit','amount_minor',100000)),
 'Owner drawings', 'Synthetic acceptance fixture');
select public.create_adjustment((select id from nature_ids where key='org'), '2026-01-06', jsonb_build_array(
 jsonb_build_object('account_id',(select id from nature_ids where key='accumulated'),'side','debit','amount_minor',50000),
 jsonb_build_object('account_id',(select id from nature_ids where key='recovery'),'side','credit','amount_minor',50000)),
 'Depreciation correction', 'Synthetic acceptance fixture');
select is((select net_debit_minor from public.account_balances where account_id=(select id from nature_ids where key='accumulated')), '-550000', 'actual credit balance is independent of natural sign');
select is((select balance_minor from public.account_balances where account_id=(select id from nature_ids where key='accumulated')), 550000::bigint, 'legacy normal-side balance contract remains positive');
select is((select sum(statement_balance_minor::bigint)::bigint from public.account_balances where organization_id=(select id from nature_ids where key='org') and type='asset'), 4150000::bigint, 'account totals subtract contra amounts and retain direct parent postings');
select is((select sum(amount_minor)::bigint from public.report_balance_sheet((select id from nature_ids where key='org'), '2026-01-31') where section='asset'), 4150000::bigint, 'balance sheet reports net assets');
select is((select amount_minor from public.report_balance_sheet((select id from nature_ids where key='org'), '2026-01-31') where account_id=(select id from nature_ids where key='drawings')), -100000::bigint, 'drawings reduce equity');
select is((select amount_minor from public.report_profit_and_loss((select id from nature_ids where key='org'), '2026-01-01','2026-01-31') where account_id=(select id from nature_ids where key='returns')), -200000::bigint, 'debit-nature revenue reduces revenue');
select is((select amount_minor from public.report_profit_and_loss((select id from nature_ids where key='org'), '2026-01-01','2026-01-31') where account_id=(select id from nature_ids where key='recovery')), -50000::bigint, 'credit-nature expense reduces expense');
select is((public.check_balance_sheet_integrity((select id from nature_ids where key='org'),'2026-01-31')->>'difference_minor')::bigint, 0::bigint, 'the independent balance sheet equation reconciles');
select is((public.dashboard_summary((select id from nature_ids where key='org'),'2026-01-31')->>'total_assets_minor')::bigint, 4150000::bigint, 'dashboard and statement agree on assets');
select is((public.dashboard_summary((select id from nature_ids where key='org'),'2026-01-31')->>'net_profit_this_month_minor')::bigint, 250000::bigint, 'dashboard and statement agree on net profit');
select is((select sum(debit_minor)::bigint from public.report_trial_balance((select id from nature_ids where key='org'),'2026-01-31')), 5950000::bigint, 'trial debit movement is unchanged');
select is((select sum(credit_minor)::bigint from public.report_trial_balance((select id from nature_ids where key='org'),'2026-01-31')), 5950000::bigint, 'trial credit movement is unchanged');
select is((select running_balance_minor from public.report_general_ledger((select id from nature_ids where key='org'),(select id from nature_ids where key='accumulated'),'2026-01-03','2026-01-31') limit 1), 550000::bigint, 'normal-side ledger combines prior opening and opposite-side movement');
select throws_ok(format('select public.update_account(%L, %L, p_normal_balance=>%L)',
 (select id from nature_ids where key='accumulated'), 'Accumulated depreciation', 'debit'), '23514', null, 'posted nature cannot silently restate history');
select throws_ok(format('select public.update_account(%L, %L, p_clear_contra=>true)',
 (select id from nature_ids where key='accumulated'), 'Accumulated depreciation'), '23514', null, 'posted contra classification is protected');
select lives_ok(format('select public.update_account(%L, %L)', (select id from nature_ids where key='accumulated'), 'Reviewed depreciation'), 'old update RPC calls still rename accounts with history');
select lives_ok(format('select public.archive_account(%L)',(select id from nature_ids where key='accumulated')), 'contra accounts can be archived without losing history');
select is((select count(*) from public.report_general_ledger((select id from nature_ids where key='org'),(select id from nature_ids where key='accumulated'),'2026-01-01','2026-01-31')), 2::bigint, 'archived account ledger remains readable');
select is((select sum(amount_minor)::bigint from public.report_balance_sheet((select id from nature_ids where key='org'),'2026-01-31') where section='asset'), 4150000::bigint, 'archiving preserves reported net assets');
select throws_ok(format('select public.create_adjustment(%L, %L, %L::jsonb, %L, %L)',
 (select id from nature_ids where key='org'),'2026-01-07',jsonb_build_array(
 jsonb_build_object('account_id',(select id from nature_ids where key='accumulated'),'side','debit','amount_minor',1),
 jsonb_build_object('account_id',(select id from nature_ids where key='bank'),'side','credit','amount_minor',1)), 'Blocked', 'Archived'),
 '23514', null, 'archived accounts still reject new postings');

-- Direct privileged updates cannot bypass history protection either.
reset role;
select throws_ok(format('update public.accounts set currency=%L where id=%L','USD',(select id from nature_ids where key='bank')), '23514', null, 'even privileged writes cannot reclassify used currency');
select throws_ok(format('update public.accounts set normal_balance=%L where id=%L','credit',(select id from nature_ids where key='drawings')), '23514', null, 'even privileged writes cannot reclassify used nature');
select is(has_function_privilege('anon','public.create_account(uuid,text,public.account_type,public.account_subtype,character,text,uuid,public.normal_balance,uuid,text)','execute'), false, 'anonymous callers cannot create classified accounts');
select is(has_function_privilege('authenticated','app.guard_account_nature()','execute'), false, 'classification helper is not a public API');
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
-- Use a privileged synthetic insert, not a capability bypass in the product path.
insert into public.accounts (organization_id,name,type,subtype,currency)
select id,'Foreign asset','asset','equipment','EGP' from public.organizations where name='Beta Supplies';
insert into nature_ids select 'foreign',id from public.accounts where name='Foreign asset';
select set_config('request.jwt.claims', '{"sub":"12800000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format('select public.create_account(%L, %L, %L, %L, p_normal_balance=>%L, p_contra_account_id=>%L)',
 (select id from nature_ids where key='org'), 'Foreign link', 'asset', 'equipment','credit',(select id from nature_ids where key='foreign')),
 '23514', null, 'foreign-tenant contra links are rejected without exposing the target');
select is((select count(*) from public.account_balances where account_id=(select id from nature_ids where key='foreign')),0::bigint,'view does not expose foreign balances');
select throws_ok(format('select * from public.report_general_ledger(%L,%L,%L,%L)',
 (select id from nature_ids where key='org'),(select id from nature_ids where key='foreign'),'2026-01-01','2026-01-31'),
 '42501', null, 'archived-ledger read path does not weaken tenant checks');
-- The existing alpha viewer has no access to the newly created organization.
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok(format('select public.update_account(%L,%L,p_normal_balance=>%L)',
 (select id from nature_ids where key='child'),'Intruder','debit'),'42501',null,'unauthorized callers cannot edit nature');
select throws_ok(format('select public.create_account(%L,%L,%L,%L,p_normal_balance=>%L)',
 (select id from nature_ids where key='org'),'Intruder','asset','equipment','credit'),'42501',null,'unauthorized callers cannot create accounts');
reset role;
select * from finish();
rollback;
