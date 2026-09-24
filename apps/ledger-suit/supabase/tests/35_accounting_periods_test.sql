-- V2-IMP-004: periods, shared enforcement, reopening, and year-end close.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

create temp table period_ids (key text primary key, value uuid not null);
grant all on period_ids to authenticated;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
('35000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','period-owner@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('35000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','period-viewer@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('35000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','legacy-lock-viewer@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into period_ids values ('org_a', public.create_organization(
  p_name => 'Period Alpha', p_base_currency => 'EGP', p_fiscal_year_start_month => 4::smallint));
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into period_ids values ('org_b', public.create_organization('Period Beta', 'EGP'));
reset role;
select app.seed_chart_of_accounts((select value from period_ids where key='org_a'));
select app.seed_categories((select value from period_ids where key='org_a'));
select app.seed_chart_of_accounts((select value from period_ids where key='org_b'));
insert into public.organization_members(organization_id,user_id,role,status)
values ((select value from period_ids where key='org_a'),'35000000-0000-4000-8000-000000000002','viewer','active');
set local app.bypass_authz=on;
insert into public.organization_members(organization_id,user_id,role,status)
values ((select value from period_ids where key='org_b'),'35000000-0000-4000-8000-000000000003','viewer','active');
set local app.bypass_authz=off;

insert into period_ids select 'cash',id from public.accounts where organization_id=(select value from period_ids where key='org_a') and system_key='cash';
insert into period_ids select 'revenue',id from public.accounts where organization_id=(select value from period_ids where key='org_a') and type='revenue' order by code limit 1;
insert into period_ids select 'expense',id from public.accounts where organization_id=(select value from period_ids where key='org_a') and type='expense' order by code limit 1;
insert into period_ids select 'retained',id from public.accounts where organization_id=(select value from period_ids where key='org_a') and system_key='retained_earnings';

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((select fiscal_year_start from app.fiscal_year_bounds((select value from period_ids where key='org_a'),'2026-02-10')),
  date '2025-04-01','non-calendar date resolves to configured fiscal-year start');
select is((select fiscal_year_end from app.fiscal_year_bounds((select value from period_ids where key='org_a'),'2026-02-10')),
  date '2026-03-31','non-calendar date resolves to configured fiscal-year end');

insert into period_ids values ('period', public.create_accounting_period(
  (select value from period_ids where key='org_a'),'2025-04-01','2026-03-31'));
select is((select status from public.accounting_periods where id=(select value from period_ids where key='period')),
  'open'::public.accounting_period_status,'new period is Open');
select throws_ok(format('select public.create_accounting_period(%L,%L,%L)',
  (select value from period_ids where key='org_a'),'2026-01-01','2026-04-30'),
  '22023','PERIOD_CROSSES_FISCAL_YEAR','period cannot cross fiscal-year boundary');
select throws_ok(format('select public.create_accounting_period(%L,%L,%L)',
  (select value from period_ids where key='org_a'),'2026-01-01','2026-02-01'),
  '23P01',null,'overlapping periods are rejected by the database');

insert into period_ids values ('open_post', public.create_adjustment(
  (select value from period_ids where key='org_a'),'2025-05-01',jsonb_build_array(
    jsonb_build_object('account_id',(select value from period_ids where key='cash'),'side','debit','amount_minor',1000000),
    jsonb_build_object('account_id',(select value from period_ids where key='revenue'),'side','credit','amount_minor',1000000)),
  'Operating revenue','Open-period fixture',p_idempotency_key=>'period-open-revenue'));
select is((select status from public.transactions where id=(select value from period_ids where key='open_post')),
  'posted'::public.transaction_status,'normal Open-period posting succeeds');
select public.create_adjustment((select value from period_ids where key='org_a'),'2025-06-01',jsonb_build_array(
    jsonb_build_object('account_id',(select value from period_ids where key='expense'),'side','debit','amount_minor',700000),
    jsonb_build_object('account_id',(select value from period_ids where key='cash'),'side','credit','amount_minor',700000)),
  'Operating expense','Open-period fixture',p_idempotency_key=>'period-open-expense');

select public.transition_accounting_period((select value from period_ids where key='period'),'soft_closed');
select is((select status from public.accounting_periods where id=(select value from period_ids where key='period')),
  'soft_closed'::public.accounting_period_status,'Open transitions to Soft Closed');
insert into period_ids values ('soft_opening_batch',public.create_opening_balance_batch(
  (select value from period_ids where key='org_a'),'midyear','2025-07-01','soft-closed-opening.csv',jsonb_build_array(
    jsonb_build_object('source_row',1,'debit','1.00','credit','','account_id',(select value from period_ids where key='cash')),
    jsonb_build_object('source_row',2,'debit','','credit','1.00','account_id',(select value from period_ids where key='retained')))));
select ok((public.validate_opening_balance_batch((select value from period_ids where key='soft_opening_batch'))->'errors') ? 'ACCOUNTING_PERIOD_SOFT_CLOSED',
  'normal opening posting is blocked in Soft Closed');
select throws_ok(format($q$select public.create_adjustment(%L,'2025-07-01',%L::jsonb,'Missing reason','')$q$,
  (select value from period_ids where key='org_a'),jsonb_build_array(
    jsonb_build_object('account_id',(select value from period_ids where key='expense'),'side','debit','amount_minor',100),
    jsonb_build_object('account_id',(select value from period_ids where key='cash'),'side','credit','amount_minor',100))),
  '22023','INVALID_ADJUSTMENT: an adjustment reason is required','Soft-Closed adjustment needs a reason');
insert into period_ids values ('soft_adjustment', public.create_adjustment(
  (select value from period_ids where key='org_a'),'2025-07-01',jsonb_build_array(
    jsonb_build_object('account_id',(select value from period_ids where key='cash'),'side','debit','amount_minor',100),
    jsonb_build_object('account_id',(select value from period_ids where key='retained'),'side','credit','amount_minor',100)),
  'Soft close correction','Evidence reviewed',p_idempotency_key=>'soft-adjustment'));
select is(public.create_adjustment((select value from period_ids where key='org_a'),'2025-07-01',jsonb_build_array(
    jsonb_build_object('account_id',(select value from period_ids where key='cash'),'side','debit','amount_minor',100),
    jsonb_build_object('account_id',(select value from period_ids where key='retained'),'side','credit','amount_minor',100)),
  'Soft close correction','Evidence reviewed',p_idempotency_key=>'soft-adjustment'),
  (select value from period_ids where key='soft_adjustment'),'Soft-Closed adjustment retry is idempotent');
select is((select count(*) from public.transactions where idempotency_key='soft-adjustment'),1::bigint,'retry creates one adjustment');
select throws_ok(format('select public.reverse_transaction(%L,%L,%L)',
  (select value from period_ids where key='open_post'),'soft-close reversal','2025-08-01'),
  '42501','ACCOUNTING_PERIOD_SOFT_CLOSED: only authorized reasoned adjustments are allowed',
  'reversal is safely blocked in Soft Closed instead of receiving a broad exemption');

insert into period_ids values ('year_close', public.close_fiscal_year(
  (select value from period_ids where key='org_a'),'2025-04-01','Annual review complete','year-close-2025'));
select is((select net_income_minor from public.fiscal_year_closes where organization_id=(select value from period_ids where key='org_a')),
  300000::bigint,'year-end derives net income from posted activity');
select is((select source from public.transactions where id=(select value from period_ids where key='year_close')),
  'year_end_close'::public.transaction_source,'closing journal has an explicit source');
select is((select sum(case when side='debit' then base_amount_minor else -base_amount_minor end) from public.transaction_entries where transaction_id=(select value from period_ids where key='year_close')),
  0::numeric,'closing journal balances');
select is((select sum(case when side='credit' then base_amount_minor else -base_amount_minor end) from public.transaction_entries where transaction_id=(select value from period_ids where key='year_close') and account_id=(select value from period_ids where key='retained')),
  300000::numeric,'profit increases Retained Earnings');
select is((select sum(case when section in ('operating_revenue','other_income','unclassified_revenue') then amount_minor else -amount_minor end) from public.report_profit_and_loss((select value from period_ids where key='org_a'),'2025-04-01','2026-03-31')),
  300000::numeric,'historical P&L preserves operating result after close');
select is(public.close_fiscal_year((select value from period_ids where key='org_a'),'2025-04-01','Annual review complete','year-close-2025'),
  (select value from period_ids where key='year_close'),'repeated year close returns the existing journal');
select is((select count(*) from public.fiscal_year_closes where organization_id=(select value from period_ids where key='org_a')),1::bigint,'one year-end close exists');

select public.transition_accounting_period((select value from period_ids where key='period'),'hard_closed','Year-end journal reviewed');
select throws_ok(format($q$select public.create_adjustment(%L,'2025-08-01',%L::jsonb,'Hard close attempt','No bypass')$q$,
  (select value from period_ids where key='org_a'),jsonb_build_array(
    jsonb_build_object('account_id',(select value from period_ids where key='expense'),'side','debit','amount_minor',100),
    jsonb_build_object('account_id',(select value from period_ids where key='cash'),'side','credit','amount_minor',100))),
  '42501','ACCOUNTING_PERIOD_HARD_CLOSED','Hard Closed blocks adjustments even for owner');
select throws_ok(format('select public.transition_accounting_period(%L,%L)',(select value from period_ids where key='period'),'open'),
  '23514',null,'Hard Closed cannot reopen directly to Open');
select throws_ok(format('select public.transition_accounting_period(%L,%L)',(select value from period_ids where key='period'),'soft_closed'),
  '22023','REOPEN_REASON_REQUIRED','reopening requires a reason');

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok(format('select public.transition_accounting_period(%L,%L,%L)',(select value from period_ids where key='period'),'soft_closed','viewer attempt'),
  '42501','INSUFFICIENT_PERMISSION: periods.manage is required','unauthorized user cannot reopen');
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.transition_accounting_period((select value from period_ids where key='period'),'soft_closed','Approved correction window');
select public.transition_accounting_period((select value from period_ids where key='period'),'open','Correction window opened');
select is((select count(*) from public.accounting_period_transitions where period_id=(select value from period_ids where key='period') and actor_id='35000000-0000-4000-8000-000000000001'),4::bigint,'transition history records every actor transition');
select ok((select bool_and(reason is not null) from public.accounting_period_transitions where period_id=(select value from period_ids where key='period') and previous_status<>'open'),'every reopening transition stores a reason');

-- Loss fiscal year: revenue 5,000; expense 7,000; Retained Earnings decreases 2,000.
insert into period_ids values ('loss_period',public.create_accounting_period(
  (select value from period_ids where key='org_a'),'2026-04-01','2027-03-31'));
select public.create_adjustment((select value from period_ids where key='org_a'),'2026-05-01',jsonb_build_array(
  jsonb_build_object('account_id',(select value from period_ids where key='cash'),'side','debit','amount_minor',500000),
  jsonb_build_object('account_id',(select value from period_ids where key='revenue'),'side','credit','amount_minor',500000)),
  'Loss-year revenue','Loss fixture',p_idempotency_key=>'loss-revenue');
select public.create_adjustment((select value from period_ids where key='org_a'),'2026-06-01',jsonb_build_array(
  jsonb_build_object('account_id',(select value from period_ids where key='expense'),'side','debit','amount_minor',700000),
  jsonb_build_object('account_id',(select value from period_ids where key='cash'),'side','credit','amount_minor',700000)),
  'Loss-year expense','Loss fixture',p_idempotency_key=>'loss-expense');
select public.transition_accounting_period((select value from period_ids where key='loss_period'),'soft_closed');
insert into period_ids values ('loss_close',public.close_fiscal_year(
  (select value from period_ids where key='org_a'),'2026-04-01','Loss year reviewed','year-close-2026'));
select is((select net_income_minor from public.fiscal_year_closes where organization_id=(select value from period_ids where key='org_a') and fiscal_year_start='2026-04-01'),
  (-200000)::bigint,'loss year derives the expected net loss');
select is((select sum(case when side='debit' then base_amount_minor else -base_amount_minor end) from public.transaction_entries where transaction_id=(select value from period_ids where key='loss_close') and account_id=(select value from period_ids where key='retained')),
  200000::numeric,'loss decreases Retained Earnings with a debit');
select is((select sum(case when section in ('operating_revenue','other_income','unclassified_revenue') then amount_minor else -amount_minor end) from public.report_profit_and_loss((select value from period_ids where key='org_a'),'2026-04-01','2027-03-31')),
  (-200000)::numeric,'historical P&L preserves the net loss after close');
select is((select sum(case when side='debit' then base_amount_minor else -base_amount_minor end) from public.transaction_entries where transaction_id=(select value from period_ids where key='loss_close')),
  0::numeric,'loss closing journal balances');
reset role;
select throws_ok(format('update public.accounting_period_transitions set reason=%L where period_id=%L','tamper',(select value from period_ids where key='period')),
  '55000','IMMUTABLE_PERIOD_HISTORY: transition and close history cannot be changed','transition history is immutable');

update public.organization_settings set books_locked_until='2026-09-30' where organization_id=(select value from period_ids where key='org_b');
select is((select books_locked_until from public.organization_settings where organization_id=(select value from period_ids where key='org_b')),
  date '2026-09-30','legacy inclusive lock value remains unchanged');
select is((select count(*) from public.accounting_periods where organization_id=(select value from period_ids where key='org_b')),0::bigint,'migration does not fabricate historical periods');
select is((select count(*) from public.accounting_periods where organization_id=(select value from period_ids where key='org_a')),2::bigint,'tenant B changes do not alter tenant A periods');

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok(format('select app.assert_books_open(%L,%L)',(select value from period_ids where key='org_b'),'2026-09-30'),
  '42501','BOOKS_LOCKED: books are locked through 2026-09-30','legacy lock still blocks the same inclusive date for a non-overriding user');
reset role;

select * from finish();
rollback;
