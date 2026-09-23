begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table tb_ids(key text primary key, id uuid);
grant all on tb_ids to authenticated;
insert into tb_ids select 'org', id from public.organizations where name = 'Alpha Trading';
insert into tb_ids select 'other', id from public.organizations where name = 'Beta Supplies';

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

insert into tb_ids values
  ('group', public.create_account((select id from tb_ids where key='org'), 'TB Cash Group', 'asset', 'cash', p_code=>'TB100', p_account_role=>'group'));
insert into tb_ids values
  ('cash', public.create_account((select id from tb_ids where key='org'), 'TB Cash', 'asset', 'cash', p_code=>'TB110', p_parent_account_id=>(select id from tb_ids where key='group'))),
  ('equity', public.create_account((select id from tb_ids where key='org'), 'TB Equity', 'equity', 'other_equity', p_code=>'TB300')),
  ('expense', public.create_account((select id from tb_ids where key='org'), 'TB Expense', 'expense', 'other_expense', p_code=>'TB500')),
  ('revenue', public.create_account((select id from tb_ids where key='org'), 'TB Revenue', 'revenue', 'other_income', p_code=>'TB400'));

do $$
declare
  org uuid := (select id from tb_ids where key='org');
  cash uuid := (select id from tb_ids where key='cash');
  equity uuid := (select id from tb_ids where key='equity');
  expense uuid := (select id from tb_ids where key='expense');
  revenue uuid := (select id from tb_ids where key='revenue');
begin
  perform public.create_adjustment(org, '2026-04-30', jsonb_build_array(
    jsonb_build_object('account_id',cash,'side','debit','amount_minor',100000),
    jsonb_build_object('account_id',equity,'side','credit','amount_minor',100000)
  ), 'TB opening', 'V2-IMP-002');
  perform public.create_adjustment(org, '2026-05-01', jsonb_build_array(
    jsonb_build_object('account_id',expense,'side','debit','amount_minor',20000),
    jsonb_build_object('account_id',cash,'side','credit','amount_minor',20000)
  ), 'TB start boundary', 'V2-IMP-002');
  perform public.create_adjustment(org, '2026-05-31', jsonb_build_array(
    jsonb_build_object('account_id',cash,'side','debit','amount_minor',50000),
    jsonb_build_object('account_id',revenue,'side','credit','amount_minor',50000)
  ), 'TB end boundary', 'V2-IMP-002');
  perform public.create_adjustment(org, '2026-06-01', jsonb_build_array(
    jsonb_build_object('account_id',cash,'side','debit','amount_minor',700),
    jsonb_build_object('account_id',revenue,'side','credit','amount_minor',700)
  ), 'TB after period', 'V2-IMP-002');
  perform public.create_draft_transaction(org, 'adjustment', '2026-05-15', jsonb_build_array(
    jsonb_build_object('account_id',cash,'side','debit','amount_minor',999999),
    jsonb_build_object('account_id',equity,'side','credit','amount_minor',999999)
  ), p_description=>'TB ignored draft');
end $$;

create temp table tb_report as
select * from public.report_trial_balance(
  (select id from tb_ids where key='org'), '2026-05-01', '2026-05-31'
) where code like 'TB%';

select is((select opening_debit_minor from tb_report where code='TB110'), '100000', 'Cash opening debit includes only the day before start');
select is((select opening_credit_minor from tb_report where code='TB110'), '0', 'Cash opening opposite side is zero');
select is((select period_debit_minor from tb_report where code='TB110'), '50000', 'Cash period debit includes the end boundary');
select is((select period_credit_minor from tb_report where code='TB110'), '20000', 'Cash period credit includes the start boundary');
select is((select closing_debit_minor from tb_report where code='TB110'), '130000', 'Cash closing reconciles and excludes the day after end and draft');
select is((select closing_credit_minor from tb_report where code='TB110'), '0', 'Cash closing has only one populated side');
select is((select opening_credit_minor from tb_report where code='TB300'), '100000', 'Equity opening is presented on credit side');
select is((select period_debit_minor from tb_report where code='TB500'), '20000', 'Expense gross movement is debit');
select is((select period_credit_minor from tb_report where code='TB400'), '50000', 'Revenue gross movement is credit');
select is((select count(*) from tb_report where code='TB100'), 0::bigint, 'Group parent is not a total row that can be double-counted');
select is((select parent_account_id from tb_report where code='TB110'), (select id from tb_ids where key='group'), 'Posting row retains hierarchy metadata');
select is((select sum(opening_debit_minor::bigint) from tb_report), 100000::numeric, 'Opening debit total');
select is((select sum(opening_credit_minor::bigint) from tb_report), 100000::numeric, 'Opening credit total reconciles');
select is((select sum(period_debit_minor::bigint) from tb_report), 70000::numeric, 'Period debit total');
select is((select sum(period_credit_minor::bigint) from tb_report), 70000::numeric, 'Period credit total reconciles');
select is((select sum(closing_debit_minor::bigint) from tb_report), 150000::numeric, 'Closing debit total');
select is((select sum(closing_credit_minor::bigint) from tb_report), 150000::numeric, 'Closing credit total reconciles');
select ok(not exists (
  select 1 from tb_report
  where closing_debit_minor::bigint < 0 or closing_credit_minor::bigint < 0
     or (closing_debit_minor::bigint > 0 and closing_credit_minor::bigint > 0)
), 'Closing presentation never uses negatives or both sides');
select is(
  (select closing_debit_minor::bigint-closing_credit_minor::bigint from tb_report where code='TB110'),
  (select opening_debit_minor::bigint-opening_credit_minor::bigint+period_debit_minor::bigint-period_credit_minor::bigint from tb_report where code='TB110'),
  'Account closing net equals opening plus period movement'
);

-- Crossing sides: opening Dr 100, period Cr 150, closing Cr 50.
insert into tb_ids values
  ('crossing', public.create_account((select id from tb_ids where key='org'), 'TB Crossing', 'asset', 'other_asset', p_code=>'TB120')),
  ('crossing_other', public.create_account((select id from tb_ids where key='org'), 'TB Crossing Equity', 'equity', 'other_equity', p_code=>'TB320'));
do $$ declare org uuid := (select id from tb_ids where key='org'); crossing uuid := (select id from tb_ids where key='crossing'); other_account uuid := (select id from tb_ids where key='crossing_other');
begin
  perform public.create_adjustment(org, '2026-06-30', jsonb_build_array(jsonb_build_object('account_id',crossing,'side','debit','amount_minor',10000),jsonb_build_object('account_id',other_account,'side','credit','amount_minor',10000)), 'Cross opening', 'V2-IMP-002');
  perform public.create_adjustment(org, '2026-07-01', jsonb_build_array(jsonb_build_object('account_id',other_account,'side','debit','amount_minor',15000),jsonb_build_object('account_id',crossing,'side','credit','amount_minor',15000)), 'Cross side', 'V2-IMP-002');
end $$;
select is((select closing_debit_minor from public.report_trial_balance((select id from tb_ids where key='org'),'2026-07-01','2026-07-31') where account_id=(select id from tb_ids where key='crossing')), '0', 'Side crossing clears closing debit');
select is((select closing_credit_minor from public.report_trial_balance((select id from tb_ids where key='org'),'2026-07-01','2026-07-31') where account_id=(select id from tb_ids where key='crossing')), '5000', 'Side crossing presents positive closing credit');

-- Contra metadata is descriptive: actual postings decide the Trial Balance side.
insert into tb_ids values
  ('asset', public.create_account((select id from tb_ids where key='org'), 'TB Equipment', 'asset', 'equipment', p_code=>'TB130'));
insert into tb_ids values
  ('contra', public.create_account((select id from tb_ids where key='org'), 'TB Accumulated depreciation', 'asset', 'other_asset', p_code=>'TB131', p_normal_balance=>'credit', p_contra_account_id=>(select id from tb_ids where key='asset')));
do $$ declare org uuid := (select id from tb_ids where key='org'); expense uuid := (select id from tb_ids where key='expense'); contra uuid := (select id from tb_ids where key='contra');
begin
  perform public.create_adjustment(org, '2026-08-01', jsonb_build_array(jsonb_build_object('account_id',expense,'side','debit','amount_minor',4000),jsonb_build_object('account_id',contra,'side','credit','amount_minor',4000)), 'Contra position', 'V2-IMP-002');
end $$;
select is((select closing_credit_minor from public.report_trial_balance((select id from tb_ids where key='org'),'2026-08-01','2026-08-31') where account_id=(select id from tb_ids where key='contra')), '4000', 'Contra account follows actual credit position without inversion');
select is((select contra_account_id from public.report_trial_balance((select id from tb_ids where key='org'),'2026-08-01','2026-08-31') where account_id=(select id from tb_ids where key='contra')), (select id from tb_ids where key='asset'), 'Contra relationship remains available as metadata');

-- The existing activity/journal reader uses the same account and inclusive period context.
select is(public.read_account_activity((select id from tb_ids where key='org'),(select id from tb_ids where key='cash'),'2026-05-01','2026-05-31')->>'opening_minor', '100000', 'Drill-down opening matches Trial Balance');
select is(public.read_account_activity((select id from tb_ids where key='org'),(select id from tb_ids where key='cash'),'2026-05-01','2026-05-31')->>'debit_minor', '50000', 'Drill-down debit movement matches Trial Balance');
select is(public.read_account_activity((select id from tb_ids where key='org'),(select id from tb_ids where key='cash'),'2026-05-01','2026-05-31')->>'credit_minor', '20000', 'Drill-down credit movement matches Trial Balance');
select is(public.read_account_activity((select id from tb_ids where key='org'),(select id from tb_ids where key='cash'),'2026-05-01','2026-05-31')->>'closing_minor', '130000', 'Drill-down closing matches Trial Balance');

select ok(public.export_financial_report_csv((select id from tb_ids where key='org'),'trial_balance','2026-05-01','2026-05-31') like 'code,account,type,opening_debit,opening_credit,period_debit,period_credit,closing_debit,closing_credit,currency%', 'Export exposes the six-column contract');
select ok(public.export_financial_report_csv((select id from tb_ids where key='org'),'trial_balance','2026-05-01','2026-05-31') like '%TB110,TB Cash,asset,1000.00,0.00,500.00,200.00,1300.00,0.00,%', 'Export row equals the displayed RPC dataset');
select ok(public.export_financial_report_csv((select id from tb_ids where key='org'),'trial_balance','2026-05-01','2026-05-31') like E'%\n,Total,,1000.00,1000.00,700.00,700.00,1500.00,1500.00,%', 'Export totals equal displayed totals');

select throws_ok(format('select * from public.report_trial_balance(%L,%L,%L)',(select id from tb_ids where key='org'),'2026-06-01','2026-05-01'),'22023',null,'Invalid period is rejected');
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(format('select * from public.report_trial_balance(%L,%L,%L)',(select id from tb_ids where key='org'),'2026-05-01','2026-05-31'),'42501',null,'Another organization cannot read this Trial Balance');

select ok(not has_function_privilege('anon','public.report_trial_balance(uuid,date,date)','EXECUTE'),'Anon cannot execute Trial Balance');
select * from finish();
rollback;
