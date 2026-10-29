-- LS-REL-CYCLE-001: real AR/AP + fixed assets + bank + indirect cash flow.
-- Owned disposable native database only; every synthetic change rolls back.
-- This complements the retained manual 2,000-unit adjustment worksheet.
-- Daily proration: 24,000 * 25 / 366 = 1,639 minor units, half away from zero.
\set ON_ERROR_STOP on
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create temp table acceptance_ids(key text primary key, id uuid not null);
grant all on acceptance_ids to authenticated;
create function pg_temp.id(text) returns uuid language sql as $$
  select id from acceptance_ids where key=$1;
$$;
create function pg_temp.check_result(ok boolean, label text) returns text language sql as $$
  select extensions.ok(ok, label);
$$;
-- Role-switched temporary helpers need explicit execution under secure defaults.
grant execute on function pg_temp.id(text), pg_temp.check_result(boolean,text) to authenticated;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
values ('54000000-0000-4000-8000-000000000001','integrated-cycle@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"54000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into acceptance_ids values ('org',public.create_organization('Integrated native cycle synthetic','EGP'));
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
 ('impairment',public.create_account(pg_temp.id('org'),'Acceptance impairment','expense','other_expense')),
 ('gainloss',public.create_account(pg_temp.id('org'),'Acceptance gain loss','expense','other_expense')),
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
-- Explicit effective mappings; no inference from account names or dominant lines.
select public.schedule_account_financial_mapping(pg_temp.id('org'),pg_temp.id('revenue'),'profit_loss','operating_revenue','2035-12-01','Explicit cycle mapping',gen_random_uuid());
select public.schedule_account_financial_mapping(pg_temp.id('org'),pg_temp.id(key),'profit_loss','operating_expenses','2035-12-01','Explicit cycle mapping',gen_random_uuid())
 from unnest(array['expense','depreciation','fee','impairment','gainloss']) key;
select public.schedule_account_financial_mapping(pg_temp.id('org'),pg_temp.id(key),'cash_flow','operating_working_capital','2035-12-01','Explicit cycle mapping',gen_random_uuid())
 from unnest(array['ar','ap']) key;
select public.schedule_account_financial_mapping(pg_temp.id('org'),pg_temp.id('depreciation'),'cash_flow','operating_noncash','2035-12-01','Depreciation addback',gen_random_uuid());
select public.schedule_account_financial_mapping(pg_temp.id('org'),pg_temp.id('fee'),'cash_flow','operating','2035-12-01','Cash bank fee',gen_random_uuid());
select public.schedule_account_financial_mapping(pg_temp.id('org'),pg_temp.id('equipment'),'cash_flow','investing','2035-12-01','Equipment investment',gen_random_uuid());
select public.schedule_account_statement_classification(pg_temp.id('org'),pg_temp.id(key),line,'2035-12-01','Explicit cycle classification',gen_random_uuid())
 from (values ('bank','current_assets'),('ar','current_assets'),('equipment','property_equipment'),('accumulated','property_equipment'),('ap','current_liabilities'),('capital','equity')) v(key,line);
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
insert into acceptance_ids values ('acquisition',public.record_asset_purchase(pg_temp.id('org'),24000,
 pg_temp.id('equipment'),pg_temp.id('bank'),p_transaction_date=>'2036-01-07',p_description=>'Reviewed equipment purchase',p_idempotency_key=>'cycle-acquisition'));
insert into acceptance_ids values ('asset',public.register_fixed_asset(pg_temp.id('org'),'CYCLE-001','Cycle equipment',
 pg_temp.id('acquisition'),pg_temp.id('equipment'),pg_temp.id('accumulated'),pg_temp.id('depreciation'),pg_temp.id('impairment'),pg_temp.id('gainloss'),
 24000,'2036-01-07','2036-01-07',12,p_idempotency_key=>'cycle-registration'));
insert into acceptance_ids select 'schedule',id from public.asset_depreciation_schedule
 where asset_id=pg_temp.id('asset') and period_end='2036-01-31';
select pg_temp.check_result((select depreciation_minor=1639 and closing_book_value_minor=22361
 from public.asset_depreciation_schedule where id=pg_temp.id('schedule')),'approved daily schedule = 1639; asset NBV = 22361');
insert into acceptance_ids values ('depreciation_tx',public.post_asset_depreciation(pg_temp.id('org'),pg_temp.id('schedule'),'cycle-depreciation'));
insert into acceptance_ids values ('receipt_tx',(select transaction_id from public.ar_documents where id=pg_temp.id('receipt'))),
 ('payment_tx',(select transaction_id from public.ap_documents where id=pg_temp.id('payment')));
select public.classify_cash_flow_entry_exact(pg_temp.id('org'),e.id,jsonb_build_object('operating',e.base_amount_minor::text),
 'Explicit settlement operating allocation',gen_random_uuid()) from public.transaction_entries e
 where e.organization_id=pg_temp.id('org') and ((e.transaction_id=pg_temp.id('receipt_tx') and e.account_id=pg_temp.id('ar'))
 or (e.transaction_id=pg_temp.id('payment_tx') and e.account_id=pg_temp.id('ap')));
insert into acceptance_ids values ('reconciliation',public.import_bank_statement(pg_temp.id('org'),pg_temp.id('bank'),
 'integrated-january.csv',repeat('5',64),'2036-01-01','2036-01-31',100000,80700,'EGP',jsonb_build_array(
 jsonb_build_object('date','2036-01-05','amount_minor','12000','description','Customer receipt','external_reference','CYCLE-RCPT'),
 jsonb_build_object('date','2036-01-06','amount_minor','-7000','description','Supplier payment','external_reference','CYCLE-PAY'),
 jsonb_build_object('date','2036-01-07','amount_minor','-24000','description','Equipment purchase','external_reference','CYCLE-ASSET'),
 jsonb_build_object('date','2036-01-31','amount_minor','-300','description','Bank fee','external_reference','CYCLE-FEE'))));
select public.match_bank_items(pg_temp.id('org'),pg_temp.id('reconciliation'),array[l.id],array[pg_temp.id(v.tx_key)],'cycle-match-'||v.tx_key)
 from (values (12000,'receipt_tx'),(-7000,'payment_tx'),(-24000,'acquisition')) v(amount,tx_key)
 join public.bank_statement_lines l on l.reconciliation_id=pg_temp.id('reconciliation') and l.amount_minor=v.amount;
insert into acceptance_ids select 'fee_line',id from public.bank_statement_lines
 where reconciliation_id=pg_temp.id('reconciliation') and amount_minor=-300;
insert into acceptance_ids values ('fee_tx',public.create_bank_adjustment(pg_temp.id('org'),pg_temp.id('reconciliation'),pg_temp.id('fee_line'),pg_temp.id('fee'),
 'Reviewed statement fee','cycle-fee'));
select pg_temp.check_result(public.create_bank_adjustment(pg_temp.id('org'),pg_temp.id('reconciliation'),pg_temp.id('fee_line'),pg_temp.id('fee'),
 'Reviewed statement fee','cycle-fee')=pg_temp.id('fee_tx'),'bank fee retry reuses its one posted adjustment');
select pg_temp.check_result(public.post_asset_depreciation(pg_temp.id('org'),pg_temp.id('schedule'),'cycle-depreciation')=pg_temp.id('depreciation_tx'),
 'depreciation retry reuses its one journal');
select public.complete_bank_reconciliation(pg_temp.id('org'),pg_temp.id('reconciliation'));
set constraints all immediate;
-- Replay both module documents in the SAME organization and period.
select pg_temp.check_result(public.post_ar_document(pg_temp.id('org'),'invoice',pg_temp.id('customer'),pg_temp.id('ar'),
 '2036-01-02',30000,pg_temp.id('revenue'),'ACC-INV','Acceptance invoice','2036-01-10')=pg_temp.id('invoice'),'AR retry reuses original');
select pg_temp.check_result(public.post_ap_document(pg_temp.id('org'),'bill',pg_temp.id('supplier'),pg_temp.id('ap'),
 '2036-01-03',18000,pg_temp.id('expense'),'ACC-BILL','Acceptance bill','2036-01-10')=pg_temp.id('bill'),'AP retry reuses original');
select pg_temp.check_result((select count(*)=8 from public.transactions where organization_id=pg_temp.id('org') and posted_at is not null),'8 posted journals after retries');
select pg_temp.check_result((select count(*)=16 and sum(base_amount_minor) filter(where side='debit')=192939
 and sum(base_amount_minor) filter(where side='credit')=192939 from public.transaction_entries
 where organization_id=pg_temp.id('org') and posted_at is not null),'16 entries; debits = credits = 192939');
select pg_temp.check_result(not exists(select transaction_id from public.transaction_entries where organization_id=pg_temp.id('org') and posted_at is not null
 group by transaction_id having sum(case when side='debit' then base_amount_minor else -base_amount_minor end)<>0),'every individual journal balances');
create temp table acceptance_tb as select * from public.report_trial_balance(pg_temp.id('org'),'2036-01-01','2036-01-31');
create temp table acceptance_expected(account_key text, net_minor bigint);
insert into acceptance_expected values ('bank',80700),('capital',-100000),('ar',18000),('ap',-11000),('revenue',-30000),
 ('expense',18000),('equipment',24000),('depreciation',1639),('accumulated',-1639),('fee',300);
select pg_temp.check_result((select count(*)=10 and bool_and(t.closing_debit_minor::bigint-t.closing_credit_minor::bigint=e.net_minor)
 from acceptance_expected e join acceptance_tb t on t.account_id=pg_temp.id(e.account_key)),'each account matches independent expected closing balance');
select pg_temp.check_result((select sum(opening_debit_minor::bigint)=100000 and sum(opening_credit_minor::bigint)=100000
 and sum(period_debit_minor::bigint)=92939 and sum(period_credit_minor::bigint)=92939
 and sum(closing_debit_minor::bigint)=142639 and sum(closing_credit_minor::bigint)=142639 from acceptance_tb),'all six TB columns reconcile');
select pg_temp.check_result((select bool_and(closing_debit_minor::bigint-closing_credit_minor::bigint=
 opening_debit_minor::bigint-opening_credit_minor::bigint+period_debit_minor::bigint-period_credit_minor::bigint) from acceptance_tb),'every TB roll-forward reconciles');
select pg_temp.check_result((select bool_and(t.period_debit_minor::bigint=g.debits and t.period_credit_minor::bigint=g.credits)
 from acceptance_tb t cross join lateral (select coalesce(sum(debit_minor),0) debits,coalesce(sum(credit_minor),0) credits
 from public.report_general_ledger(pg_temp.id('org'),t.account_id,'2036-01-01','2036-01-31')) g),'GL movements equal TB for identical dates/context');
select pg_temp.check_result((select sum(outstanding_minor::bigint)=18000 from public.read_ar_open_items(pg_temp.id('org'),'2036-01-31')),'real customer open items = 18000');
select pg_temp.check_result((select sum(outstanding_minor::bigint)=11000 from public.read_ap_open_items(pg_temp.id('org'),'2036-01-31')),'real supplier open items = 11000');
select pg_temp.check_result((select count(*)=2 and bool_and(status='reconciled' and variance_minor=0)
 from public.reconcile_control_accounts(pg_temp.id('org'),'2036-01-31')),'both real Control providers reconcile to GL');
select pg_temp.check_result((select sum(case when section like '%revenue%' then amount_minor else -amount_minor end)=10061
 from public.report_profit_and_loss(pg_temp.id('org'),'2036-01-01','2036-01-31')),'profit = 10061; settlement does not repeat revenue/expense');
select pg_temp.check_result((select sum(amount_minor) filter(where section='asset')=121061
 and sum(amount_minor) filter(where section in ('liability','equity'))=121061
 from public.report_balance_sheet(pg_temp.id('org'),'2036-01-31')),'assets = liabilities + equity = 121061 including Contra');
-- Read all integrated providers in the same tenant and accounting period.
select pg_temp.check_result((select count(*)=2 and bool_and(variance_minor=0)
 from public.reconcile_fixed_assets(pg_temp.id('org'),'2036-01-31')),'both asset register balances reconcile to GL');
select pg_temp.check_result((public.read_fixed_asset_workspace(pg_temp.id('org'),'2036-01-31')#>>'{assets,0,nbv_minor}')='22361',
 'asset workspace retains exact NBV 22361');
select pg_temp.check_result((select count(*)=1 from public.asset_events where asset_id=pg_temp.id('asset') and kind='depreciation'),
 'exactly one posted depreciation event after retry');
select pg_temp.check_result((select count(*)=4 and bool_and(status='matched') from public.bank_statement_lines
 where reconciliation_id=pg_temp.id('reconciliation')),'all four bank lines matched to real source journals');
select pg_temp.check_result((select status='completed' from public.bank_reconciliations where id=pg_temp.id('reconciliation')),
 'bank reconciliation is completed');
select pg_temp.check_result((public.read_bank_reconciliation_workspace(pg_temp.id('org'),pg_temp.id('reconciliation'))#>>'{equation,difference_minor}')::bigint=0,
 'completed bank equation has zero variance');
create temp table cycle_cash as select public.read_exact_financial_report('cash_flow',pg_temp.id('org'),'2036-01-01','2036-01-31') value;
select pg_temp.check_result((select value->>'net_profit_minor'='10061' and value->>'operating_adjustments_minor'='-5361'
 and value->>'operating_cash_minor'='4700' from cycle_cash),'profit plus depreciation and net working capital = operating cash 4700');
select pg_temp.check_result((select value->>'opening_cash_minor'='100000' and value->>'closing_cash_minor'='80700'
 and value->>'investing_cash_minor'='-24000' and value->>'financing_cash_minor'='0'
 and value->>'net_cash_change_minor'='-19300' from cycle_cash),'opening + operating - equipment = exact closing bank 80700');
select pg_temp.check_result((select (value->>'classification_complete')::boolean and (value->>'reconciled')::boolean
 and value->>'unclassified_cash_minor'='0' and value->>'unclassified_entry_count'='0'
 and value->>'operating_adjustment_difference_minor'='0' from cycle_cash),'indirect cash flow is complete and reconciled');
select pg_temp.check_result(not exists(select 1 from public.transactions where organization_id=pg_temp.id('org')
 and journal_reference !~ '^JRN-[0-9]{4}-[0-9]{6}$'),'all integrated source journals receive professional sequence identities');
select pg_temp.check_result((select count(*)=8 from public.transactions where organization_id=pg_temp.id('org') and posted_at is not null),
 'bank matching, registration, classification and all retries add no duplicate journals');
create temp table cycle_before_close as select
 public.read_exact_financial_report('overview',pg_temp.id('org'),'2036-01-01','2036-01-31','2036-01-31') overview,
 (select md5(string_agg(to_jsonb(t)::text,'' order by t.id)) from public.transactions t where t.organization_id=pg_temp.id('org')) journals,
 (select md5(string_agg(to_jsonb(e)::text,'' order by e.id)) from public.transaction_entries e where e.organization_id=pg_temp.id('org')) entries;
insert into acceptance_ids values ('period',public.create_accounting_period(pg_temp.id('org'),'2036-01-01','2036-01-31'));
select public.transition_accounting_period(pg_temp.id('period'),'soft_closed');
select public.transition_accounting_period(pg_temp.id('period'),'hard_closed');
select pg_temp.check_result((select status='hard_closed' from public.accounting_periods where id=pg_temp.id('period')),
 'reconciled working period can be hard closed');
select throws_ok($q$select public.post_ar_document(pg_temp.id('org'),'invoice',pg_temp.id('customer'),pg_temp.id('ar'),
 '2036-01-20',100,pg_temp.id('revenue'),'CLOSED-INV','cycle-closed-invoice','2036-01-31')$q$,
 '42501','ACCOUNTING_PERIOD_HARD_CLOSED','closed integrated period rejects new customer invoice');
select throws_ok($q$select public.post_ap_document(pg_temp.id('org'),'bill',pg_temp.id('supplier'),pg_temp.id('ap'),
 '2036-01-20',100,pg_temp.id('expense'),'CLOSED-BILL','cycle-closed-bill','2036-01-31')$q$,
 '42501','ACCOUNTING_PERIOD_HARD_CLOSED','closed integrated period rejects new supplier bill');
select throws_ok($q$select public.record_asset_purchase(pg_temp.id('org'),100,pg_temp.id('equipment'),pg_temp.id('bank'),
 p_transaction_date=>'2036-01-20',p_idempotency_key=>'cycle-closed-asset')$q$,
 '42501','ACCOUNTING_PERIOD_HARD_CLOSED','closed integrated period rejects new equipment purchase');
select throws_ok($q$select public.reverse_ar_document(pg_temp.id('org'),pg_temp.id('receipt'),'2036-01-20','Reviewed correction','cycle-closed-reversal')$q$,
 '42501','ACCOUNTING_PERIOD_HARD_CLOSED','closed integrated period rejects a settlement reversal');
select pg_temp.check_result((select overview=public.read_exact_financial_report('overview',pg_temp.id('org'),'2036-01-01','2036-01-31','2036-01-31')
 from cycle_before_close),'reports remain identical after close and rejected postings');
select throws_ok($q$select public.transition_accounting_period(pg_temp.id('period'),'soft_closed')$q$,
 '22023','REOPEN_REASON_REQUIRED','reopening a closed working period requires a reason');
select public.transition_accounting_period(pg_temp.id('period'),'soft_closed','Review supporting evidence');
select public.transition_accounting_period(pg_temp.id('period'),'open','Approved correction window');
select pg_temp.check_result((select status='open' from public.accounting_periods where id=pg_temp.id('period')),
 'reasoned period reopening succeeds');
select pg_temp.check_result((select count(*)=4 and bool_and(actor_id='54000000-0000-4000-8000-000000000001'::uuid)
 from public.accounting_period_transitions where period_id=pg_temp.id('period')),
 'all four period transitions preserve actor evidence');
select pg_temp.check_result((select journals=(select md5(string_agg(to_jsonb(t)::text,'' order by t.id))
 from public.transactions t where t.organization_id=pg_temp.id('org')) and entries=(select md5(string_agg(to_jsonb(e)::text,'' order by e.id))
 from public.transaction_entries e where e.organization_id=pg_temp.id('org')) from cycle_before_close),
 'close/reopen and denied commands preserve every posted journal and entry byte');
select * from finish();
rollback;
