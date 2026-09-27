begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create temp table fs_ids(key text primary key,id uuid);
grant all on fs_ids to authenticated;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values('41000000-0000-4000-8000-000000000099','statement-fixture@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
set local role authenticated;
insert into fs_ids values ('org',public.create_organization('Isolated financial statement fixture','EGP'));
insert into fs_ids values
('cash',public.create_account((select id from fs_ids where key='org'),'FS Cash','asset','bank',p_code=>'FS100')),
('cash2',public.create_account((select id from fs_ids where key='org'),'FS Cash 2','asset','cash',p_code=>'FS101')),
('equip',public.create_account((select id from fs_ids where key='org'),'FS Equipment','asset','equipment',p_code=>'FS120')),
('capital',public.create_account((select id from fs_ids where key='org'),'FS Capital','equity','owner_capital',p_code=>'FS300')),
('revenue',public.create_account((select id from fs_ids where key='org'),'FS Revenue','revenue','service_revenue',p_code=>'FS400')),
('depex',public.create_account((select id from fs_ids where key='org'),'FS Depreciation','expense','other_expense',p_code=>'FS500')),
('opex',public.create_account((select id from fs_ids where key='org'),'FS Operating Expense','expense','rent',p_code=>'FS501')),
('liability',public.create_account((select id from fs_ids where key='org'),'FS Liability','liability','other_liability',p_code=>'FS200'));
insert into fs_ids values ('accum',public.create_account((select id from fs_ids where key='org'),'FS Accumulated Depreciation','asset','other_asset',p_code=>'FS121',p_normal_balance=>'credit',p_contra_account_id=>(select id from fs_ids where key='equip')));

select is(public.schedule_account_financial_mapping((select id from fs_ids where key='org'),(select id from fs_ids where key='revenue'),'profit_loss','operating_revenue','2026-06-01','Historical setup',gen_random_uuid()) is not null,true,'Owner can explicitly backdate P&L mapping');
select public.schedule_account_financial_mapping((select id from fs_ids where key='org'),(select id from fs_ids where key='depex'),'profit_loss','operating_expenses','2026-06-01','Historical setup',gen_random_uuid());
select public.schedule_account_financial_mapping((select id from fs_ids where key='org'),(select id from fs_ids where key='opex'),'profit_loss','operating_expenses','2026-06-01','Historical setup',gen_random_uuid());
select public.schedule_account_financial_mapping((select id from fs_ids where key='org'),(select id from fs_ids where key='revenue'),'cash_flow','operating','2026-06-01','Cash revenue',gen_random_uuid());
select public.schedule_account_financial_mapping((select id from fs_ids where key='org'),(select id from fs_ids where key='depex'),'cash_flow','operating_noncash','2026-06-01','Depreciation addback',gen_random_uuid());
select public.schedule_account_financial_mapping((select id from fs_ids where key='org'),(select id from fs_ids where key='opex'),'cash_flow','operating','2026-06-01','Cash expense',gen_random_uuid());
select public.schedule_account_financial_mapping((select id from fs_ids where key='org'),(select id from fs_ids where key='equip'),'cash_flow','investing','2026-06-01','Equipment cash use',gen_random_uuid());
select public.schedule_account_financial_mapping((select id from fs_ids where key='org'),(select id from fs_ids where key='capital'),'cash_flow','financing','2026-06-01','Owner financing',gen_random_uuid());
select public.schedule_account_statement_classification((select id from fs_ids where key='org'),(select id from fs_ids where key='cash'),'current_assets','2026-06-01','Historical setup',gen_random_uuid());
select public.schedule_account_statement_classification((select id from fs_ids where key='org'),(select id from fs_ids where key='equip'),'property_equipment','2026-06-01','Historical setup',gen_random_uuid());
select public.schedule_account_statement_classification((select id from fs_ids where key='org'),(select id from fs_ids where key='accum'),'property_equipment','2026-06-01','Historical setup',gen_random_uuid());
select public.schedule_account_statement_classification((select id from fs_ids where key='org'),(select id from fs_ids where key='capital'),'equity','2026-06-01','Historical setup',gen_random_uuid());

insert into fs_ids values ('cash_revenue',public.create_adjustment((select id from fs_ids where key='org'),'2026-06-10',jsonb_build_array(
  jsonb_build_object('account_id',(select id from fs_ids where key='cash'),'side','debit','amount_minor',50000),
  jsonb_build_object('account_id',(select id from fs_ids where key='revenue'),'side','credit','amount_minor',50000)),
  'Cash revenue','FS-REV'));
select public.create_adjustment((select id from fs_ids where key='org'),'2026-06-11',jsonb_build_array(
  jsonb_build_object('account_id',(select id from fs_ids where key='depex'),'side','debit','amount_minor',5000),
  jsonb_build_object('account_id',(select id from fs_ids where key='accum'),'side','credit','amount_minor',5000)),
  'Depreciation','FS-DEP');
select public.create_adjustment((select id from fs_ids where key='org'),'2026-06-12',jsonb_build_array(
  jsonb_build_object('account_id',(select id from fs_ids where key='equip'),'side','debit','amount_minor',30000),
  jsonb_build_object('account_id',(select id from fs_ids where key='cash'),'side','credit','amount_minor',30000)),
  'Equipment purchase','FS-EQUIP');
select public.create_adjustment((select id from fs_ids where key='org'),'2026-06-13',jsonb_build_array(
  jsonb_build_object('account_id',(select id from fs_ids where key='cash'),'side','debit','amount_minor',20000),
  jsonb_build_object('account_id',(select id from fs_ids where key='capital'),'side','credit','amount_minor',20000)),
  'Owner finance','FS-CAP');
select is((public.report_indirect_cash_flow((select id from fs_ids where key='org'),'2026-06-01','2026-06-13')->>'net_profit_minor')::bigint,45000::bigint,'Indirect report begins at net profit 450');
select is((public.report_indirect_cash_flow((select id from fs_ids where key='org'),'2026-06-01','2026-06-13')->>'operating_adjustments_minor')::bigint,5000::bigint,'Depreciation adds back 50');
select is((public.report_indirect_cash_flow((select id from fs_ids where key='org'),'2026-06-01','2026-06-13')->>'operating_cash_minor')::bigint,50000::bigint,'Operating cash 500');
select is((public.report_indirect_cash_flow((select id from fs_ids where key='org'),'2026-06-01','2026-06-13')->>'investing_cash_minor')::bigint,-30000::bigint,'Investing cash -300');
select is((public.report_indirect_cash_flow((select id from fs_ids where key='org'),'2026-06-01','2026-06-13')->>'financing_cash_minor')::bigint,20000::bigint,'Financing cash +200');
select is((public.report_indirect_cash_flow((select id from fs_ids where key='org'),'2026-06-01','2026-06-13')->>'net_cash_change_minor')::bigint,40000::bigint,'Actual and reported cash movement +400');
select is((public.report_indirect_cash_flow((select id from fs_ids where key='org'),'2026-06-01','2026-06-13')->>'classification_complete')::boolean,true,'Deterministic indirect fixture reconciles completely');
select is((select sum(amount_minor::bigint) from public.report_classified_balance_sheet((select id from fs_ids where key='org'),'2026-06-13') where statement_line='property_equipment'),25000::numeric,'Accumulated depreciation reduces mapped PPE');
select is((public.report_statement_reconciliation((select id from fs_ids where key='org'),'2026-06-01','2026-06-13')->>'profit_loss_difference_minor')::bigint,0::bigint,'Mapped P&L ties to posted GL');
select is((public.report_statement_reconciliation((select id from fs_ids where key='org'),'2026-06-01','2026-06-13')->>'balance_sheet_difference_minor')::bigint,0::bigint,'Mapped Balance Sheet ties to six-column TB');

insert into fs_ids values ('split',public.create_adjustment((select id from fs_ids where key='org'),'2026-06-20',jsonb_build_array(
  jsonb_build_object('account_id',(select id from fs_ids where key='cash'),'side','credit','amount_minor',15000),
  jsonb_build_object('account_id',(select id from fs_ids where key='equip'),'side','debit','amount_minor',10000),
  jsonb_build_object('account_id',(select id from fs_ids where key='opex'),'side','debit','amount_minor',5000)),
  'Split cash journal','FS-SPLIT'));
select is((select amount_minor from public.report_cash_flow_detail((select id from fs_ids where key='org'),'2026-06-20','2026-06-20') where section='investing'),-10000::bigint,'Split journal Investing -100');
select is((select amount_minor from public.report_cash_flow_detail((select id from fs_ids where key='org'),'2026-06-20','2026-06-20') where section='operating'),-5000::bigint,'Split journal Operating -50');
select public.create_adjustment((select id from fs_ids where key='org'),'2026-06-21',jsonb_build_array(
  jsonb_build_object('account_id',(select id from fs_ids where key='cash2'),'side','debit','amount_minor',100000),
  jsonb_build_object('account_id',(select id from fs_ids where key='cash'),'side','credit','amount_minor',100000)),
  'Internal cash transfer','FS-TRANSFER');
select is((select count(*) from public.report_cash_flow_detail((select id from fs_ids where key='org'),'2026-06-21','2026-06-21')),0::bigint,'Internal cash transfer has no consolidated cash-flow line');
select public.create_adjustment((select id from fs_ids where key='org'),'2026-06-22',jsonb_build_array(
  jsonb_build_object('account_id',(select id from fs_ids where key='cash'),'side','debit','amount_minor',7000),
  jsonb_build_object('account_id',(select id from fs_ids where key='liability'),'side','credit','amount_minor',7000)),
  'Unclassified cash source','FS-UNCLASS');
select is((public.report_indirect_cash_flow((select id from fs_ids where key='org'),'2026-06-22','2026-06-22')->>'unclassified_cash_minor')::bigint,7000::bigint,'Unmapped cash remains Unclassified');
select is((public.report_indirect_cash_flow((select id from fs_ids where key='org'),'2026-06-22','2026-06-22')->>'classification_complete')::boolean,false,'Unclassified movement fails completeness');
insert into fs_ids values ('liability_entry',(select e.id from public.transaction_entries e
  where e.entry_date='2026-06-22' and e.account_id=(select id from fs_ids where key='liability')));
insert into fs_ids values ('allocation_request',gen_random_uuid());
insert into fs_ids values ('allocation',public.classify_cash_flow_entry(
  (select id from fs_ids where key='org'),(select id from fs_ids where key='liability_entry'),
  '{"operating":3000,"financing":4000}'::jsonb,'Reviewed split cash receipt',
  (select id from fs_ids where key='allocation_request')));
select is(public.classify_cash_flow_entry(
  (select id from fs_ids where key='org'),(select id from fs_ids where key='liability_entry'),
  '{"operating":3000,"financing":4000}'::jsonb,'Reviewed split cash receipt',
  (select id from fs_ids where key='allocation_request')),
  (select id from fs_ids where key='allocation'),'Identical allocation retry reuses its decision');
select is((select sum(amount_minor) from public.report_cash_flow_detail((select id from fs_ids where key='org'),'2026-06-22','2026-06-22') where section='operating'),3000::numeric,'Explicit split allocation assigns Operating 30');
select is((select sum(amount_minor) from public.report_cash_flow_detail((select id from fs_ids where key='org'),'2026-06-22','2026-06-22') where section='financing'),4000::numeric,'Explicit split allocation assigns Financing 40');
select is((public.report_indirect_cash_flow((select id from fs_ids where key='org'),'2026-06-22','2026-06-22')->>'unclassified_entry_count')::bigint,0::bigint,'Explicit allocation resolves unclassified cash');
select throws_ok(format('select public.classify_cash_flow_entry(%L,%L,%L::jsonb,%L,%L)',
  (select id from fs_ids where key='org'),(select id from fs_ids where key='liability_entry'),
  '{"operating":1000}', 'Incomplete split',gen_random_uuid()),'23514',null,'Partial allocation cannot hide cash');

insert into fs_ids values ('mapping2',public.schedule_account_statement_classification((select id from fs_ids where key='org'),(select id from fs_ids where key='equip'),'other_non_current_assets','2026-07-01','Later presentation',gen_random_uuid(),(select id from public.account_statement_classifications where account_id=(select id from fs_ids where key='equip') order by revision desc limit 1)));
select is((select statement_line from public.report_classified_balance_sheet((select id from fs_ids where key='org'),'2026-06-30') where account_id=(select id from fs_ids where key='equip')),'property_equipment','Earlier report retains earlier mapping');
select is((select statement_line from public.report_classified_balance_sheet((select id from fs_ids where key='org'),'2026-07-01') where account_id=(select id from fs_ids where key='equip')),'other_non_current_assets','Later report takes new mapping');
select is((select count(*) from public.account_statement_classifications where account_id=(select id from fs_ids where key='equip')),2::bigint,'Mapping history append-only');
select public.archive_account((select id from fs_ids where key='revenue'));
select is((select amount_minor from public.report_profit_and_loss((select id from fs_ids where key='org'),'2026-06-01','2026-06-30') where account_id=(select id from fs_ids where key='revenue')),50000::bigint,'Archived revenue remains in historical P&L');
select ok(position('net_profit' in public.export_financial_report_csv((select id from fs_ids where key='org'),'cash_flow','2026-06-01','2026-06-13'))>0,'Cash-flow CSV uses indirect report structure');
select * from finish();
rollback;
