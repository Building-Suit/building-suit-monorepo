-- V2-IMP-006: batch validation, posting, reporting, locking, and correction.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table opening_ids(key text primary key, value uuid not null);
grant all on opening_ids to authenticated;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('39000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','opening-owner@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('39000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','opening-midyear@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());
select set_config('request.jwt.claims','{"sub":"39000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into opening_ids values ('org_year',public.create_organization('Opening Year Start','EGP'));
select set_config('request.jwt.claims','{"sub":"39000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into opening_ids values ('org_mid',public.create_organization('Opening Midyear','EGP'));
select set_config('request.jwt.claims','{"sub":"39000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

insert into opening_ids values
('cash',public.create_account((select value from opening_ids where key='org_year'),'Opening Cash','asset','cash',p_code=>'OB100')),
('equipment',public.create_account((select value from opening_ids where key='org_year'),'Opening Equipment','asset','equipment',p_code=>'OB120')),
('liability',public.create_account((select value from opening_ids where key='org_year'),'Opening Liability','liability','other_liability',p_code=>'OB200')),
('equity',public.create_account((select value from opening_ids where key='org_year'),'Opening Capital','equity','retained_earnings',p_code=>'OB300')),
('revenue',public.create_account((select value from opening_ids where key='org_year'),'Opening Revenue','revenue','service_revenue',p_code=>'OB400')),
('expense',public.create_account((select value from opening_ids where key='org_year'),'Opening Expense','expense','rent',p_code=>'OB500')),
('group',public.create_account((select value from opening_ids where key='org_year'),'Opening Group','asset','other_asset',p_code=>'OB000',p_account_role=>'group')),
('control',public.create_account((select value from opening_ids where key='org_year'),'Opening AR Control','asset','accounts_receivable',p_code=>'OB110',p_account_role=>'control',p_control_subledger_type=>'customer'));

insert into opening_ids values ('year_batch',public.create_opening_balance_batch(
  (select value from opening_ids where key='org_year'),'year_start','2025-12-31','year-start.csv',jsonb_build_array(
    jsonb_build_object('source_row',1,'source_code','CASH','source_name','Source cash','debit','10000.00','credit','','account_id',(select value from opening_ids where key='cash')),
    jsonb_build_object('source_row',2,'source_code','EQUIP','source_name','Source equipment','debit','5000.00','credit','','account_id',(select value from opening_ids where key='equipment')),
    jsonb_build_object('source_row',3,'source_code','LIAB','source_name','Source liability','debit','','credit','4000.00','account_id',(select value from opening_ids where key='liability')),
    jsonb_build_object('source_row',4,'source_code','CAP','source_name','Source capital','debit','','credit','11000.00','account_id',(select value from opening_ids where key='equity')))));

select is((public.validate_opening_balance_batch((select value from opening_ids where key='year_batch'))->>'valid')::boolean,true,'balanced Year Start batch validates');
select is((select (validation_result->>'debit_total_minor')::bigint from public.opening_balance_batches where id=(select value from opening_ids where key='year_batch')),1500000::bigint,'Year Start debit total is 15,000.00');
select is((select (validation_result->>'credit_total_minor')::bigint from public.opening_balance_batches where id=(select value from opening_ids where key='year_batch')),1500000::bigint,'Year Start credit total is 15,000.00');
insert into opening_ids values ('year_journal',public.approve_opening_balance_batch((select value from opening_ids where key='year_batch')));
select is(public.approve_opening_balance_batch((select value from opening_ids where key='year_batch')),(select value from opening_ids where key='year_journal'),'approval retry returns one journal');
select is((select count(*) from public.transactions where metadata->>'opening_batch_id'=(select value::text from opening_ids where key='year_batch')),1::bigint,'one accepted batch creates one journal');
select is((select sum(case when side='debit' then base_amount_minor else -base_amount_minor end) from public.transaction_entries where transaction_id=(select value from opening_ids where key='year_journal')),0::numeric,'opening journal balances exactly');
select is((select sum(opening_debit_minor::bigint) from public.report_trial_balance((select value from opening_ids where key='org_year'),'2026-01-01','2026-01-31')),1500000::numeric,'day-after-cutoff report places debits in Opening');
select is((select sum(opening_credit_minor::bigint) from public.report_trial_balance((select value from opening_ids where key='org_year'),'2026-01-01','2026-01-31')),1500000::numeric,'day-after-cutoff report places credits in Opening');
select is((select sum(period_debit_minor::bigint+period_credit_minor::bigint) from public.report_trial_balance((select value from opening_ids where key='org_year'),'2026-01-01','2026-01-31')),0::numeric,'opening journal is not period movement after cutoff');
reset role;
select throws_ok(format('update public.opening_balance_rows set original_debit=%L where batch_id=%L','1.00',(select value from opening_ids where key='year_batch')),'55000','OPENING_BATCH_LOCKED: posted opening evidence is immutable','posted rows are immutable');
set local role authenticated;

insert into opening_ids values ('bad_balance',public.create_opening_balance_batch(
  (select value from opening_ids where key='org_year'),'midyear','2026-06-30','unbalanced.csv',jsonb_build_array(
    jsonb_build_object('source_row',1,'debit','10000.00','credit','','account_id',(select value from opening_ids where key='cash')),
    jsonb_build_object('source_row',2,'debit','','credit','9999.00','account_id',(select value from opening_ids where key='equity')))));
select is((public.validate_opening_balance_batch((select value from opening_ids where key='bad_balance'))->>'valid')::boolean,false,'unbalanced source is blocked');
select is((select (validation_result->>'difference_minor')::bigint from public.opening_balance_batches where id=(select value from opening_ids where key='bad_balance')),100::bigint,'imbalance reports exact variance');
select throws_ok(format('select public.approve_opening_balance_batch(%L)',(select value from opening_ids where key='bad_balance')),'23514',null,'unbalanced batch cannot post and receives no plug');

insert into opening_ids values ('year_pl',public.create_opening_balance_batch(
  (select value from opening_ids where key='org_year'),'year_start','2026-12-31','year-pl.csv',jsonb_build_array(
    jsonb_build_object('source_row',1,'debit','10.00','credit','','account_id',(select value from opening_ids where key='cash')),
    jsonb_build_object('source_row',2,'debit','','credit','10.00','account_id',(select value from opening_ids where key='revenue')))));
select ok((public.validate_opening_balance_batch((select value from opening_ids where key='year_pl'))->'errors') ? 'OPENING_ROW_ERRORS','Year Start rejects non-zero P&L');

insert into opening_ids values ('bad_roles',public.create_opening_balance_batch(
  (select value from opening_ids where key='org_year'),'midyear','2027-06-30','roles.csv',jsonb_build_array(
    jsonb_build_object('source_row',1,'debit','10.00','credit','','account_id',(select value from opening_ids where key='group')),
    jsonb_build_object('source_row',2,'debit','','credit','10.00','account_id',(select value from opening_ids where key='control')))));
select public.validate_opening_balance_batch((select value from opening_ids where key='bad_roles'));
select ok((select validation_errors ? 'ACCOUNT_GROUP_NOT_POSTABLE' from public.opening_balance_rows where batch_id=(select value from opening_ids where key='bad_roles') and source_row=1),'Group mapping is rejected');
select ok((select validation_errors ? 'ACCOUNT_CONTROL_NOT_DIRECTLY_POSTABLE' from public.opening_balance_rows where batch_id=(select value from opening_ids where key='bad_roles') and source_row=2),'Control mapping is rejected without a provider');

insert into opening_ids values ('period_2028',public.create_accounting_period(
  (select value from opening_ids where key='org_year'),'2028-01-01','2028-12-31'));
insert into opening_ids values ('period_batch',public.create_opening_balance_batch(
  (select value from opening_ids where key='org_year'),'midyear','2028-06-30','period-opening.csv',jsonb_build_array(
    jsonb_build_object('source_row',1,'debit','1.00','credit','','account_id',(select value from opening_ids where key='cash')),
    jsonb_build_object('source_row',2,'debit','','credit','1.00','account_id',(select value from opening_ids where key='equity')))));
select is((public.validate_opening_balance_batch((select value from opening_ids where key='period_batch'))->>'valid')::boolean,true,'Open period permits opening validation');
select public.transition_accounting_period((select value from opening_ids where key='period_2028'),'soft_closed');
select ok((public.validate_opening_balance_batch((select value from opening_ids where key='period_batch'))->'errors') ? 'ACCOUNTING_PERIOD_SOFT_CLOSED','Soft Closed blocks opening posting');
select public.transition_accounting_period((select value from opening_ids where key='period_2028'),'hard_closed');
select ok((public.validate_opening_balance_batch((select value from opening_ids where key='period_batch'))->'errors') ? 'ACCOUNTING_PERIOD_HARD_CLOSED','Hard Closed blocks opening posting');

-- A second tenant proves Midyear YTD P&L remains on the actual accounts.
select set_config('request.jwt.claims','{"sub":"39000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into opening_ids values
('mid_cash',public.create_account((select value from opening_ids where key='org_mid'),'Midyear Cash','asset','cash',p_code=>'MY100')),
('mid_equity',public.create_account((select value from opening_ids where key='org_mid'),'Midyear Equity','equity','retained_earnings',p_code=>'MY300')),
('mid_revenue',public.create_account((select value from opening_ids where key='org_mid'),'Midyear Revenue','revenue','service_revenue',p_code=>'MY400')),
('mid_expense',public.create_account((select value from opening_ids where key='org_mid'),'Midyear Expense','expense','rent',p_code=>'MY500'));
insert into opening_ids values ('mid_batch',public.create_opening_balance_batch(
  (select value from opening_ids where key='org_mid'),'midyear','2026-06-30','midyear.csv',jsonb_build_array(
    jsonb_build_object('source_row',1,'source_code','CASH','debit','6000.00','credit','','account_id',(select value from opening_ids where key='mid_cash')),
    jsonb_build_object('source_row',2,'source_code','EXP','debit','6000.00','credit','','account_id',(select value from opening_ids where key='mid_expense')),
    jsonb_build_object('source_row',3,'source_code','REV','debit','','credit','10000.00','account_id',(select value from opening_ids where key='mid_revenue')),
    jsonb_build_object('source_row',4,'source_code','EQ','debit','','credit','2000.00','account_id',(select value from opening_ids where key='mid_equity')))));
select is((public.validate_opening_balance_batch((select value from opening_ids where key='mid_batch'))->>'valid')::boolean,true,'Midyear permits mapped Revenue and Expense');
insert into opening_ids values ('mid_journal',public.approve_opening_balance_batch((select value from opening_ids where key='mid_batch')));
select is((select sum(case when section='revenue' then amount_minor else -amount_minor end) from public.report_profit_and_loss((select value from opening_ids where key='org_mid'),'2026-01-01','2026-12-31')),400000::numeric,'Midyear imported YTD P&L remains 4,000.00');

-- Creation is allowed for pre-post review; accepting that independent boundary is not.
insert into opening_ids values ('duplicate',public.create_opening_balance_batch(
  (select value from opening_ids where key='org_mid'),'midyear','2026-06-30','duplicate.csv',jsonb_build_array(
    jsonb_build_object('source_row',1,'debit','1.00','credit','','account_id',(select value from opening_ids where key='mid_cash')),
    jsonb_build_object('source_row',2,'debit','','credit','1.00','account_id',(select value from opening_ids where key='mid_equity')))));
select throws_ok(format('select public.approve_opening_balance_batch(%L)',(select value from opening_ids where key='duplicate')),'23505','OPENING_BOUNDARY_ALREADY_POSTED','accepted migration boundary cannot be duplicated');

select throws_ok(format('select public.post_opening_balance(%L,%L,%L::jsonb)',(select value from opening_ids where key='org_mid'),'2026-07-01','[]'),'0A000','OPENING_BATCH_REQUIRED: use the controlled Opening Trial Balance workflow','legacy silent-plug RPC is rejected');
insert into opening_ids values ('reversal',public.reverse_opening_balance_batch((select value from opening_ids where key='mid_batch'),'Imported source corrected','2026-07-01'));
select is((select status from public.opening_balance_batches where id=(select value from opening_ids where key='mid_batch')),'reversed'::public.opening_batch_status,'correction locks batch as reversed');
select is((select reverses_transaction_id from public.transactions where id=(select value from opening_ids where key='reversal')),(select value from opening_ids where key='mid_journal'),'correction journal reverses the original');
select is((select correction_reason from public.opening_balance_batches where id=(select value from opening_ids where key='mid_batch')),'Imported source corrected','mandatory correction reason is preserved');
select is((select count(*) from public.transactions where id in ((select value from opening_ids where key='mid_journal'),(select value from opening_ids where key='reversal'))),2::bigint,'original and reversal both remain traceable');

reset role;
select * from finish();
rollback;
