-- V2-IMP-010: bank import, exact matching, adjustments, equation, and history.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create temp table bank_ids(key text primary key,value uuid not null);
create temp table bank_values(key text primary key,value text not null);
grant all on bank_ids,bank_values to authenticated;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('42000000-0000-4000-8000-000000000001','bank-owner@test.local','{}','{}'),
 ('42000000-0000-4000-8000-000000000002','bank-viewer@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"42000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into bank_ids values('org',public.create_organization('Bank fixture','EGP'));
insert into bank_ids values
 ('bank',public.create_account((select value from bank_ids where key='org'),'Fixture Bank','asset','bank',p_code=>'B100')),
 ('bank2',public.create_account((select value from bank_ids where key='org'),'Fixture Bank 2','asset','bank',p_code=>'B101')),
 ('revenue',public.create_account((select value from bank_ids where key='org'),'Fixture Revenue','revenue','service_revenue',p_code=>'B400')),
 ('expense',public.create_account((select value from bank_ids where key='org'),'Fixture Expense','expense','bank_fees',p_code=>'B500'));
reset role;
insert into public.organization_members(organization_id,user_id,role,status) values
 ((select value from bank_ids where key='org'),'42000000-0000-4000-8000-000000000002','viewer','active');
set local role authenticated;

insert into bank_ids values('t60',public.create_adjustment((select value from bank_ids where key='org'),'2031-01-05',jsonb_build_array(
 jsonb_build_object('account_id',(select value from bank_ids where key='bank'),'side','debit','amount_minor',6000),jsonb_build_object('account_id',(select value from bank_ids where key='revenue'),'side','credit','amount_minor',6000)),'Receipt 60','fixture',p_idempotency_key=>'bank-t60'));
insert into bank_ids values('t40',public.create_adjustment((select value from bank_ids where key='org'),'2031-01-06',jsonb_build_array(
 jsonb_build_object('account_id',(select value from bank_ids where key='bank'),'side','debit','amount_minor',4000),jsonb_build_object('account_id',(select value from bank_ids where key='revenue'),'side','credit','amount_minor',4000)),'Receipt 40','fixture',p_idempotency_key=>'bank-t40'));
insert into bank_ids values('t30',public.create_adjustment((select value from bank_ids where key='org'),'2031-01-07',jsonb_build_array(
 jsonb_build_object('account_id',(select value from bank_ids where key='expense'),'side','debit','amount_minor',3000),jsonb_build_object('account_id',(select value from bank_ids where key='bank'),'side','credit','amount_minor',3000)),'Payment 30','fixture',p_idempotency_key=>'bank-t30'));
insert into bank_ids values('tout',public.create_adjustment((select value from bank_ids where key='org'),'2031-01-08',jsonb_build_array(
 jsonb_build_object('account_id',(select value from bank_ids where key='bank'),'side','debit','amount_minor',2000),jsonb_build_object('account_id',(select value from bank_ids where key='revenue'),'side','credit','amount_minor',2000)),'Deposit in transit','fixture',p_idempotency_key=>'bank-outstanding'));
insert into bank_values select 'journal_before',count(*)::text||':'||coalesce(sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end),0)::text
 from public.transactions t join public.transaction_entries e on e.transaction_id=t.id where t.organization_id=(select value from bank_ids where key='org');

insert into bank_ids values('rec',public.import_bank_statement((select value from bank_ids where key='org'),(select value from bank_ids where key='bank'),
 'january.csv',repeat('a',64),'2031-01-01','2031-01-31',0,7000,'EGP',jsonb_build_array(
 jsonb_build_object('date','2031-01-05','amount_minor','10000','description','Combined receipts','external_reference','DEP-100'),
 jsonb_build_object('date','2031-01-07','amount_minor','-3000','description','Supplier payment','external_reference','PAY-30'))));
select is((select count(*) from public.transactions t where t.organization_id=(select value from bank_ids where key='org')),4::bigint,'statement import creates no journal');
select is((select count(*) from public.bank_statement_lines where reconciliation_id=(select value from bank_ids where key='rec')),2::bigint,'valid import creates reviewable lines');
select throws_ok(format($q$select public.import_bank_statement(%L,%L,'again.csv',repeat('a',64),'2031-01-01','2031-01-31',0,7000,'EGP','[]'::jsonb)$q$,
 (select value from bank_ids where key='org'),(select value from bank_ids where key='bank')),'22023','BANK_INVALID_IMPORT','empty import is rejected before duplicate lookup');
select throws_ok(format($q$select public.import_bank_statement(%L,%L,'again.csv',repeat('a',64),'2031-01-01','2031-01-31',0,7000,'EGP',%L::jsonb)$q$,
 (select value from bank_ids where key='org'),(select value from bank_ids where key='bank'),jsonb_build_array(jsonb_build_object('date','2031-01-09','amount_minor','1','description','x'))),
 '23505','BANK_DUPLICATE_FILE','duplicate file fingerprint is rejected');
insert into bank_ids values('dup',public.import_bank_statement((select value from bank_ids where key='org'),(select value from bank_ids where key='bank'),
 'duplicate-line.csv',repeat('b',64),'2031-01-01','2031-01-31',0,10000,'EGP',jsonb_build_array(
 jsonb_build_object('date','2031-01-05','amount_minor','10000','description','Combined receipts','external_reference','DEP-100'))));
select is((select status from public.bank_statement_lines where reconciliation_id=(select value from bank_ids where key='dup')),'unresolved'::public.bank_statement_line_status,'cross-file duplicate line is detected');
select public.correct_bank_statement_line((select value from bank_ids where key='org'),
 (select id from public.bank_statement_lines where reconciliation_id=(select value from bank_ids where key='dup')),
 '2031-01-09',10000,'Corrected independent deposit','DEP-CORRECTED','Bank supplied corrected reference');
select is((select status from public.bank_statement_lines where reconciliation_id=(select value from bank_ids where key='dup')),'unmatched'::public.bank_statement_line_status,'reasoned correction resolves the line back to unmatched review');
select is((select import_errors from public.bank_reconciliations where id=(select value from bank_ids where key='dup')),'[]'::jsonb,'correction recalculates statement validation totals');
select is((select count(*) from public.bank_reconciliation_events where reconciliation_id=(select value from bank_ids where key='dup') and event_type='line.corrected'),1::bigint,'correction retains append-only before/after history');

insert into bank_ids select 'line100',id from public.bank_statement_lines where reconciliation_id=(select value from bank_ids where key='rec') and amount_minor=10000;
insert into bank_ids select 'line30',id from public.bank_statement_lines where reconciliation_id=(select value from bank_ids where key='rec') and amount_minor=-3000;
insert into bank_ids values('m_many',public.match_bank_items((select value from bank_ids where key='org'),(select value from bank_ids where key='rec'),
 array[(select value from bank_ids where key='line100')],array[(select value from bank_ids where key='t60'),(select value from bank_ids where key='t40')],'match-one-many'));
insert into bank_ids values('m_one',public.match_bank_items((select value from bank_ids where key='org'),(select value from bank_ids where key='rec'),
 array[(select value from bank_ids where key='line30')],array[(select value from bank_ids where key='t30')],'match-one-one'));
select is(public.match_bank_items((select value from bank_ids where key='org'),(select value from bank_ids where key='rec'),
 array[(select value from bank_ids where key='line100')],array[(select value from bank_ids where key='t60'),(select value from bank_ids where key='t40')],'match-one-many'),
 (select value from bank_ids where key='m_many'),'exact match retry is idempotent even after lines become matched');
select is((select count(*)::text||':'||coalesce(sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end),0)::text
 from public.transactions t join public.transaction_entries e on e.transaction_id=t.id where t.organization_id=(select value from bank_ids where key='org')),
 (select value from bank_values where key='journal_before'),'matching leaves journal count and balanced ledger fingerprint unchanged');
select public.unmatch_bank_items((select value from bank_ids where key='org'),(select value from bank_ids where key='m_one'),'Recheck evidence');
select is((select status from public.bank_statement_lines where id=(select value from bank_ids where key='line30')),'unmatched'::public.bank_statement_line_status,'unmatch restores visible unmatched state');
select public.match_bank_items((select value from bank_ids where key='org'),(select value from bank_ids where key='rec'),array[(select value from bank_ids where key='line30')],array[(select value from bank_ids where key='t30')],'match-one-one-corrected');
insert into bank_ids values('out',public.add_bank_outstanding_item((select value from bank_ids where key='org'),(select value from bank_ids where key='rec'),(select value from bank_ids where key='tout'),'Deposit in transit'));
select is((public.read_bank_reconciliation_workspace((select value from bank_ids where key='org'),(select value from bank_ids where key='rec'))->'equation'->>'difference_minor')::bigint,0::bigint,'statement plus explicit outstanding item equals ledger');
select public.complete_bank_reconciliation((select value from bank_ids where key='org'),(select value from bank_ids where key='rec'));
select is((select status from public.bank_reconciliations where id=(select value from bank_ids where key='rec')),'completed'::public.bank_reconciliation_status,'balanced reviewed reconciliation completes');
select throws_ok(format('select public.unmatch_bank_items(%L,%L,%L)',(select value from bank_ids where key='org'),(select value from bank_ids where key='m_many'),'too late'),
 '55000','BANK_RECONCILIATION_COMPLETED','completed reconciliation is immutable');
select public.reopen_bank_reconciliation((select value from bank_ids where key='org'),(select value from bank_ids where key='rec'),'Bank supplied corrected evidence');
select is((select status from public.bank_reconciliations where id=(select value from bank_ids where key='rec')),'reopened'::public.bank_reconciliation_status,'privileged reasoned reopening restores editability');
select ok((select count(*) from public.bank_reconciliation_events where reconciliation_id=(select value from bank_ids where key='rec') and event_type in ('statement.imported','match.created','match.removed','outstanding.added','reconciliation.completed','reconciliation.reopened'))>=7,'session, match, outstanding, completion and reopening history remains traceable');

-- Many statement lines to one posted transaction.
insert into bank_ids values('t100b',public.create_adjustment((select value from bank_ids where key='org'),'2031-02-05',jsonb_build_array(
 jsonb_build_object('account_id',(select value from bank_ids where key='bank2'),'side','debit','amount_minor',10000),jsonb_build_object('account_id',(select value from bank_ids where key='revenue'),'side','credit','amount_minor',10000)),'Combined deposit','fixture',p_idempotency_key=>'bank-t100b'));
insert into bank_ids values('rec2',public.import_bank_statement((select value from bank_ids where key='org'),(select value from bank_ids where key='bank2'),
 'february.csv',repeat('c',64),'2031-02-01','2031-02-28',0,10000,'EGP',jsonb_build_array(
 jsonb_build_object('date','2031-02-05','amount_minor','6000','description','Receipt A'),jsonb_build_object('date','2031-02-05','amount_minor','4000','description','Receipt B'))));
select lives_ok(format($q$select public.match_bank_items(%L,%L,array[%L,%L]::uuid[],array[%L]::uuid[],'match-many-one')$q$,
 (select value from bank_ids where key='org'),(select value from bank_ids where key='rec2'),
 (select id from public.bank_statement_lines where reconciliation_id=(select value from bank_ids where key='rec2') and amount_minor=6000),
 (select id from public.bank_statement_lines where reconciliation_id=(select value from bank_ids where key='rec2') and amount_minor=4000),(select value from bank_ids where key='t100b')),'many statement lines can match one exact ledger transaction');

insert into bank_ids values('transfer',public.record_transfer((select value from bank_ids where key='org'),500,
 (select value from bank_ids where key='bank2'),(select value from bank_ids where key='bank'),p_transaction_date=>'2033-01-10',p_description=>'Bank transfer',p_idempotency_key=>'bank-transfer'));
insert into bank_ids values('transfer_in',public.import_bank_statement((select value from bank_ids where key='org'),(select value from bank_ids where key='bank'),
 'transfer-in.csv',repeat('f',64),'2033-01-01','2033-01-31',0,500,'EGP',jsonb_build_array(jsonb_build_object('date','2033-01-10','amount_minor','500','description','Transfer in'))));
insert into bank_ids values('transfer_out',public.import_bank_statement((select value from bank_ids where key='org'),(select value from bank_ids where key='bank2'),
 'transfer-out.csv',repeat('1',64),'2033-01-01','2033-01-31',0,-500,'EGP',jsonb_build_array(jsonb_build_object('date','2033-01-10','amount_minor','-500','description','Transfer out'))));
select lives_ok(format($q$select public.match_bank_items(%L,%L,array[%L]::uuid[],array[%L]::uuid[],'transfer-in-match')$q$,
 (select value from bank_ids where key='org'),(select value from bank_ids where key='transfer_in'),
 (select id from public.bank_statement_lines where reconciliation_id=(select value from bank_ids where key='transfer_in')),(select value from bank_ids where key='transfer')),
 'one transfer journal can match its destination bank statement');
select lives_ok(format($q$select public.match_bank_items(%L,%L,array[%L]::uuid[],array[%L]::uuid[],'transfer-out-match')$q$,
 (select value from bank_ids where key='org'),(select value from bank_ids where key='transfer_out'),
 (select id from public.bank_statement_lines where reconciliation_id=(select value from bank_ids where key='transfer_out')),(select value from bank_ids where key='transfer')),
 'the same transfer journal can match its source bank statement independently');
select is((select type from public.transactions where id=(select value from bank_ids where key='transfer')),'transfer'::public.transaction_type,'bank matching preserves internal transfer accounting identity');

-- Explicit adjustment posts once, balances, links, and reuses the request key.
insert into bank_ids values('rec3',public.import_bank_statement((select value from bank_ids where key='org'),(select value from bank_ids where key='bank2'),
 'fees.csv',repeat('d',64),'2031-03-01','2031-03-31',10000,7500,'EGP',jsonb_build_array(jsonb_build_object('date','2031-03-10','amount_minor','-2500','description','Bank fee'))));
insert into bank_ids select 'fee_line',id from public.bank_statement_lines where reconciliation_id=(select value from bank_ids where key='rec3');
insert into bank_ids values('fee_tx',public.create_bank_adjustment((select value from bank_ids where key='org'),(select value from bank_ids where key='rec3'),
 (select value from bank_ids where key='fee_line'),(select value from bank_ids where key='expense'),'Monthly bank fee','fee-adjustment'));
select is(public.create_bank_adjustment((select value from bank_ids where key='org'),(select value from bank_ids where key='rec3'),
 (select value from bank_ids where key='fee_line'),(select value from bank_ids where key='expense'),'Monthly bank fee','fee-adjustment'),
 (select value from bank_ids where key='fee_tx'),'adjustment retry returns exactly one linked journal');
select is((select count(*) from public.bank_adjustments where reconciliation_id=(select value from bank_ids where key='rec3')),1::bigint,'one immutable adjustment link exists');
select is((select sum(case when side='debit' then base_amount_minor else -base_amount_minor end) from public.transaction_entries where transaction_id=(select value from bank_ids where key='fee_tx')),0::numeric,'bank adjustment uses the balanced shared posting engine');

insert into bank_ids values('closed_period',public.create_accounting_period((select value from bank_ids where key='org'),'2032-01-01','2032-12-31'));
select public.transition_accounting_period((select value from bank_ids where key='closed_period'),'soft_closed');
select public.transition_accounting_period((select value from bank_ids where key='closed_period'),'hard_closed','Year reviewed');
insert into bank_ids values('rec4',public.import_bank_statement((select value from bank_ids where key='org'),(select value from bank_ids where key='bank2'),
 'closed-period-fee.csv',repeat('e',64),'2032-04-01','2032-04-30',7500,7400,'EGP',jsonb_build_array(jsonb_build_object('date','2032-04-10','amount_minor','-100','description','Closed period fee'))));
insert into bank_ids select 'closed_line',id from public.bank_statement_lines where reconciliation_id=(select value from bank_ids where key='rec4');
select throws_ok(format('select public.create_bank_adjustment(%L,%L,%L,%L,%L,%L)',
 (select value from bank_ids where key='org'),(select value from bank_ids where key='rec4'),(select value from bank_ids where key='closed_line'),
 (select value from bank_ids where key='expense'),'Closed period fee','closed-fee'),
 '42501','ACCOUNTING_PERIOD_HARD_CLOSED','bank adjustment cannot bypass a Hard Closed accounting period');

select set_config('request.jwt.claims','{"sub":"42000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok(format($q$select public.match_bank_items(%L,%L,array[%L]::uuid[],array[%L]::uuid[],'viewer-match')$q$,
 (select value from bank_ids where key='org'),(select value from bank_ids where key='rec3'),(select value from bank_ids where key='fee_line'),(select value from bank_ids where key='fee_tx')),
 '42501','INSUFFICIENT_PERMISSION: bank.match is required','viewer cannot mutate reconciliation evidence');
select lives_ok(format('select public.read_bank_reconciliation_workspace(%L,%L)',(select value from bank_ids where key='org'),(select value from bank_ids where key='rec')),'viewer can read reconciliation history');
select * from finish();
rollback;
