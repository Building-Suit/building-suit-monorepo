-- V2-IMP-015 acceptance probe. ONLY on an owned disposable local database.
-- psql -X -v ON_ERROR_STOP=1 -f <this file>; all synthetic writes roll back.
-- This covers shared-ledger + real AR/AP + reports, not bank/asset module UAT.
\set ON_ERROR_STOP on
begin;
create temp table acceptance_ids(key text primary key, id uuid not null);
grant all on acceptance_ids to authenticated;
create function pg_temp.id(text) returns uuid language sql as $$
  select id from acceptance_ids where key=$1;
$$;
create function pg_temp.check_result(ok boolean, label text) returns text language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
  return 'PASS: '||label;
end;
$$;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
values ('49000000-0000-4000-8000-000000000001','v2-acceptance@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"49000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into acceptance_ids values ('org',public.create_organization('V2 acceptance synthetic','EGP'));
insert into acceptance_ids values
 ('bank',public.create_account(pg_temp.id('org'),'Acceptance bank','asset','bank')),
 ('capital',public.create_account(pg_temp.id('org'),'Acceptance capital','equity','owner_capital')),
 ('ar',public.create_account(pg_temp.id('org'),'Acceptance AR','asset','accounts_receivable',p_account_role=>'control',p_control_subledger_type=>'customer')),
 ('ap',public.create_account(pg_temp.id('org'),'Acceptance AP','liability','accounts_payable',p_account_role=>'control',p_control_subledger_type=>'supplier')),
 ('revenue',public.create_account(pg_temp.id('org'),'Acceptance revenue','revenue','service_revenue')),
 ('expense',public.create_account(pg_temp.id('org'),'Acceptance services','expense','other_expense')),
 ('equipment',public.create_account(pg_temp.id('org'),'Acceptance equipment','asset','equipment')),
 ('depreciation',public.create_account(pg_temp.id('org'),'Acceptance depreciation','expense','other_expense')),
 ('fee',public.create_account(pg_temp.id('org'),'Acceptance bank fee','expense','other_expense')),
 ('customer',public.create_counterparty(pg_temp.id('org'),'Acceptance customer','customer')),
 ('supplier',public.create_counterparty(pg_temp.id('org'),'Acceptance supplier','vendor'));
insert into acceptance_ids values ('accumulated',public.create_account(pg_temp.id('org'),'Acceptance accumulated depreciation','asset','other_asset',
 p_normal_balance=>'credit',p_contra_account_id=>pg_temp.id('equipment')));
create function pg_temp.post_pair(dt date, debit text, credit text, amount bigint, description text)
returns uuid language sql as $$
 select public.create_adjustment(pg_temp.id('org'),dt,jsonb_build_array(
 jsonb_build_object('account_id',pg_temp.id(debit),'side','debit','amount_minor',amount),
 jsonb_build_object('account_id',pg_temp.id(credit),'side','credit','amount_minor',amount)),description,'V2-IMP-015 synthetic acceptance');
$$;
select pg_temp.post_pair('2035-12-31','bank','capital',100000,'Prior-period capital');
insert into acceptance_ids values ('invoice',public.post_ar_document(pg_temp.id('org'),'invoice',pg_temp.id('customer'),pg_temp.id('ar'),
 '2036-01-02',30000,pg_temp.id('revenue'),'ACC-INV','Acceptance invoice','2036-01-10'));
insert into acceptance_ids values ('receipt',public.post_ar_document(pg_temp.id('org'),'receipt',pg_temp.id('customer'),pg_temp.id('ar'),
 '2036-01-05',12000,pg_temp.id('bank'),'ACC-RCPT','Acceptance receipt',null,
 jsonb_build_array(jsonb_build_object('invoice_id',pg_temp.id('invoice'),'amount_minor','12000'))));
insert into acceptance_ids values ('bill',public.post_ap_document(pg_temp.id('org'),'bill',pg_temp.id('supplier'),pg_temp.id('ap'),
 '2036-01-03',18000,pg_temp.id('expense'),'ACC-BILL','Acceptance bill','2036-01-10'));
insert into acceptance_ids values ('payment',public.post_ap_document(pg_temp.id('org'),'payment',pg_temp.id('supplier'),pg_temp.id('ap'),
 '2036-01-06',7000,pg_temp.id('bank'),'ACC-PAY','Acceptance payment',null,
 jsonb_build_array(jsonb_build_object('bill_id',pg_temp.id('bill'),'amount_minor','7000'))));
select pg_temp.post_pair('2036-01-07','equipment','bank',24000,'Equipment accounting entry');
select pg_temp.post_pair('2036-01-31','depreciation','accumulated',2000,'Depreciation accounting entry');
select pg_temp.post_pair('2036-01-31','fee','bank',300,'Bank fee accounting entry');
set constraints all immediate;
-- Replay both module documents in the SAME organization and period.
select pg_temp.check_result(public.post_ar_document(pg_temp.id('org'),'invoice',pg_temp.id('customer'),pg_temp.id('ar'),
 '2036-01-02',30000,pg_temp.id('revenue'),'ACC-INV','Acceptance invoice','2036-01-10')=pg_temp.id('invoice'),'AR retry reuses original');
select pg_temp.check_result(public.post_ap_document(pg_temp.id('org'),'bill',pg_temp.id('supplier'),pg_temp.id('ap'),
 '2036-01-03',18000,pg_temp.id('expense'),'ACC-BILL','Acceptance bill','2036-01-10')=pg_temp.id('bill'),'AP retry reuses original');
select pg_temp.check_result((select count(*)=8 from public.transactions where organization_id=pg_temp.id('org') and posted_at is not null),'8 posted journals after retries');
select pg_temp.check_result((select count(*)=16 and sum(base_amount_minor) filter(where side='debit')=193300
 and sum(base_amount_minor) filter(where side='credit')=193300 from public.transaction_entries
 where organization_id=pg_temp.id('org') and posted_at is not null),'16 entries; debits = credits = 193300');
select pg_temp.check_result(not exists(select transaction_id from public.transaction_entries where organization_id=pg_temp.id('org') and posted_at is not null
 group by transaction_id having sum(case when side='debit' then base_amount_minor else -base_amount_minor end)<>0),'every individual journal balances');
create temp table acceptance_tb as select * from public.report_trial_balance(pg_temp.id('org'),'2036-01-01','2036-01-31');
create temp table acceptance_expected(account_key text, net_minor bigint);
insert into acceptance_expected values ('bank',80700),('capital',-100000),('ar',18000),('ap',-11000),('revenue',-30000),
 ('expense',18000),('equipment',24000),('depreciation',2000),('accumulated',-2000),('fee',300);
select pg_temp.check_result((select count(*)=10 and bool_and(t.closing_debit_minor::bigint-t.closing_credit_minor::bigint=e.net_minor)
 from acceptance_expected e join acceptance_tb t on t.account_id=pg_temp.id(e.account_key)),'each account matches independent expected closing balance');
select pg_temp.check_result((select sum(opening_debit_minor::bigint)=100000 and sum(opening_credit_minor::bigint)=100000
 and sum(period_debit_minor::bigint)=93300 and sum(period_credit_minor::bigint)=93300
 and sum(closing_debit_minor::bigint)=143000 and sum(closing_credit_minor::bigint)=143000 from acceptance_tb),'all six TB columns reconcile');
select pg_temp.check_result((select bool_and(closing_debit_minor::bigint-closing_credit_minor::bigint=
 opening_debit_minor::bigint-opening_credit_minor::bigint+period_debit_minor::bigint-period_credit_minor::bigint) from acceptance_tb),'every TB roll-forward reconciles');
select pg_temp.check_result((select bool_and(t.period_debit_minor::bigint=g.debits and t.period_credit_minor::bigint=g.credits)
 from acceptance_tb t cross join lateral (select coalesce(sum(debit_minor),0) debits,coalesce(sum(credit_minor),0) credits
 from public.report_general_ledger(pg_temp.id('org'),t.account_id,'2036-01-01','2036-01-31')) g),'GL movements equal TB for identical dates/context');
select pg_temp.check_result((select sum(outstanding_minor::bigint)=18000 from public.read_ar_open_items(pg_temp.id('org'),'2036-01-31')),'real customer open items = 18000');
select pg_temp.check_result((select sum(outstanding_minor::bigint)=11000 from public.read_ap_open_items(pg_temp.id('org'),'2036-01-31')),'real supplier open items = 11000');
select pg_temp.check_result((select count(*)=2 and bool_and(status='reconciled' and variance_minor=0)
 from public.reconcile_control_accounts(pg_temp.id('org'),'2036-01-31')),'both real Control providers reconcile to GL');
select pg_temp.check_result((select sum(case when section like '%revenue%' then amount_minor else -amount_minor end)=9700
 from public.report_profit_and_loss(pg_temp.id('org'),'2036-01-01','2036-01-31')),'profit = 9700; settlement does not repeat revenue/expense');
select pg_temp.check_result((select sum(amount_minor) filter(where section='asset')=120700
 and sum(amount_minor) filter(where section in ('liability','equity'))=120700
 from public.report_balance_sheet(pg_temp.id('org'),'2036-01-31')),'assets = liabilities + equity = 120700 including Contra');
-- FS-08: preserve access/amounts and OBSERVE the descriptive-label policy.
select public.update_account(pg_temp.id('revenue'),'Acceptance revenue renamed');
select public.archive_account(pg_temp.id('revenue'));
select pg_temp.check_result((select amount_minor=30000 from public.report_profit_and_loss(pg_temp.id('org'),'2036-01-01','2036-01-31')
 where account_id=pg_temp.id('revenue')),'rename/archive preserves historical amount and account identity');
select 'FS-08 observed historical label (requires explicit accountant review): '||name
 from public.report_profit_and_loss(pg_temp.id('org'),'2036-01-01','2036-01-31') where account_id=pg_temp.id('revenue');
-- Known acceptance failure at the reviewed checkpoint. Do not weaken this
-- assertion to accommodate UUID references. Scope/year/race/legacy semantics
-- additionally require the controlled numbering repair's native test suite.
select 'V2-D03 number-policy mismatches: '||count(*) from public.transactions
 where organization_id=pg_temp.id('org') and journal_reference !~ '^JRN-[0-9]{4}-[0-9]{6}$';
select pg_temp.check_result(not exists(select 1 from public.transactions
 where organization_id=pg_temp.id('org') and journal_reference !~ '^JRN-[0-9]{4}-[0-9]{6}$'),
 'V2-D03: newly posted journals use the approved professional number format');
rollback;
