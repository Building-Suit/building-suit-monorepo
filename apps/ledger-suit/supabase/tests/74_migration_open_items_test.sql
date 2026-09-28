-- LS-MIG-002: deterministic AR/AP opening detail, exact Control
-- reconciliation, ordinary settlement after cutover, and immutable evidence.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table open_migration_ids(key text primary key,value uuid not null);
create temp table open_migration_values(key text primary key,value text not null);
grant all on open_migration_ids,open_migration_values to authenticated;

insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('55000000-0000-4000-8000-000000000001','open-migration-owner@test.local','{}','{}'),
 ('55000000-0000-4000-8000-000000000002','open-migration-outsider@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"55000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;

insert into open_migration_ids values ('org',public.create_organization('Open-item migration fixture','EGP'));
insert into open_migration_ids values
 ('ar_control',public.create_account((select value from open_migration_ids where key='org'),'Migration AR Control','asset','accounts_receivable',p_code=>'MAR',p_account_role=>'control',p_control_subledger_type=>'customer')),
 ('ap_control',public.create_account((select value from open_migration_ids where key='org'),'Migration AP Control','liability','accounts_payable',p_code=>'MAP',p_account_role=>'control',p_control_subledger_type=>'supplier')),
 ('cash',public.create_account((select value from open_migration_ids where key='org'),'Migration bank','asset','bank',p_code=>'MCASH')),
 ('equity',public.create_account((select value from open_migration_ids where key='org'),'Migration equity','equity','retained_earnings',p_code=>'MEQ')),
 ('revenue',public.create_account((select value from open_migration_ids where key='org'),'Post-cutover revenue','revenue','product_sales',p_code=>'MREV')),
 ('expense',public.create_account((select value from open_migration_ids where key='org'),'Post-cutover expense','expense','other_expense',p_code=>'MEXP')),
 ('customer_one',public.create_counterparty((select value from open_migration_ids where key='org'),'Migrated customer one','customer')),
 ('customer_two',public.create_counterparty((select value from open_migration_ids where key='org'),'Migrated customer two','customer')),
 ('supplier_one',public.create_counterparty((select value from open_migration_ids where key='org'),'Migrated supplier one','vendor'));

insert into open_migration_ids values ('project',public.create_migration_project(
 (select value from open_migration_ids where key='org'),'AR AP Fast Cutover','other_system_export','2034-12-31','open-project:v1'));
insert into open_migration_ids values ('source',public.upload_migration_source(
 (select value from open_migration_ids where key='project'),'open-items.csv','text/csv',convert_to('deterministic-open-items','UTF8'),
 encode(extensions.digest(convert_to('deterministic-open-items','UTF8'),'sha256'),'hex'),
 jsonb_build_object('system','legacy-ledger','company','fixture'),
 jsonb_build_array(
  jsonb_build_object('source_row',1,'kind','customer_invoice','customer','C1','document','AR-1'),
  jsonb_build_object('source_row',2,'kind','customer_invoice','customer','C1','document','AR-2'),
  jsonb_build_object('source_row',3,'kind','customer_credit','customer','C2','document','AR-C1'),
  jsonb_build_object('source_row',4,'kind','supplier_bill','supplier','S1','document','AP-1'),
  jsonb_build_object('source_row',5,'kind','supplier_bill','supplier','S2','document','AP-2'),
  jsonb_build_object('source_row',6,'kind','supplier_credit','supplier','S2','document','AP-C1')),
 'open-source:v1'));
insert into open_migration_ids values ('mapping',public.create_migration_mapping_revision(
 (select value from open_migration_ids where key='project'),(select value from open_migration_ids where key='source'),
 jsonb_build_array(
  jsonb_build_object('source_kind','customer','source_key','C1','source_identity',jsonb_build_object('code','C1'),'resolution','existing_record','target_counterparty_id',(select value from open_migration_ids where key='customer_one'),'approval_evidence',jsonb_build_object('review','matched signed statement')),
  jsonb_build_object('source_kind','customer','source_key','C2','source_identity',jsonb_build_object('code','C2'),'resolution','existing_record','target_counterparty_id',(select value from open_migration_ids where key='customer_two'),'approval_evidence',jsonb_build_object('review','matched signed statement')),
  jsonb_build_object('source_kind','supplier','source_key','S1','source_identity',jsonb_build_object('code','S1'),'resolution','existing_record','target_counterparty_id',(select value from open_migration_ids where key='supplier_one'),'approval_evidence',jsonb_build_object('review','matched signed statement')),
  jsonb_build_object('source_kind','supplier','source_key','S2','source_identity',jsonb_build_object('code','S2'),'resolution','reviewed_creation','proposed_record',jsonb_build_object('name','Migrated supplier two','type','vendor'),'approval_evidence',jsonb_build_object('review','approved supplier creation'))),
 'Counterparty identities reviewed against signed AR and AP registers','open-mapping:v1'));
insert into open_migration_ids values ('stage',public.stage_migration_rows(
 (select value from open_migration_ids where key='project'),(select value from open_migration_ids where key='source'),
 (select value from open_migration_ids where key='mapping'),
 (select jsonb_agg(jsonb_build_object('source_row',row_number,'source_kind',kind,'source_key',source_key,
   'normalized_payload',jsonb_build_object('document',document)) order by row_number)
  from (values (1,'customer','C1','AR-1'),(2,'customer','C1','AR-2'),(3,'customer','C2','AR-C1'),
    (4,'supplier','S1','AP-1'),(5,'supplier','S2','AP-2'),(6,'supplier','S2','AP-C1')) x(row_number,kind,source_key,document)),
 'open-stage:v1'));
select is((public.validate_migration_project((select value from open_migration_ids where key='project'),
 (select value from open_migration_ids where key='stage'))->>'valid')::boolean,true,'foundation source, rows, and mappings validate');

-- The single Opening Trial Balance carries both Control balances.
insert into open_migration_ids values ('opening',public.create_opening_balance_batch(
 (select value from open_migration_ids where key='org'),'year_start','2034-12-31','open-control.csv',jsonb_build_array(
  jsonb_build_object('source_row',1,'source_code','MAR','debit','115.00','credit','','account_id',(select value from open_migration_ids where key='ar_control')),
  jsonb_build_object('source_row',2,'source_code','MAP','debit','','credit','95.00','account_id',(select value from open_migration_ids where key='ap_control')),
  jsonb_build_object('source_row',3,'source_code','MEQ','debit','','credit','20.00','account_id',(select value from open_migration_ids where key='equity')))));
select is((public.validate_opening_balance_batch((select value from open_migration_ids where key='opening'))->>'valid')::boolean,
 true,'Opening Trial Balance accepts correctly bound AR and AP Control rows');
select public.approve_opening_balance_batch((select value from open_migration_ids where key='opening'));
select public.link_migration_opening_balance_batch((select value from open_migration_ids where key='project'),
 (select value from open_migration_ids where key='opening'));
insert into open_migration_values select 'ledger_after_opening',
 encode(extensions.digest(coalesce((select string_agg(to_jsonb(t)::text,'|' order by t.id)
   from public.transactions t where t.organization_id=(select value from open_migration_ids where key='org')),'')||'#'||
   coalesce((select string_agg(to_jsonb(e)::text,'|' order by e.transaction_id,e.entry_index)
   from public.transaction_entries e where e.organization_id=(select value from open_migration_ids where key='org')),''),'sha256'),'hex');

-- Invalid amounts and duplicate source identity fail during staging.
select throws_ok(format($q$select public.stage_migration_open_items(%L,%L,%L::jsonb,'[]'::jsonb,'negative-open')$q$,
 (select value from open_migration_ids where key='project'),(select value from open_migration_ids where key='stage'),
 jsonb_build_array(jsonb_build_object('source_row',1,'item_type','customer_invoice','source_counterparty_key','C1','source_document_key','NEG','source_reference','NEG','document_date','2034-12-01','due_date','2034-12-15','original_minor','100','open_minor','-1','currency_code','EGP','currency_evidence',jsonb_build_object('source_currency','EGP','policy','base_currency_open_item'),'control_account_id',(select value from open_migration_ids where key='ar_control'),'correction_account_id',(select value from open_migration_ids where key='revenue'),'source_identity',jsonb_build_object('row',1)))),
 '23514',null,'negative open amount fails closed');
select throws_ok(format($q$select public.stage_migration_open_items(%L,%L,%L::jsonb,'[]'::jsonb,'duplicate-source')$q$,
 (select value from open_migration_ids where key='project'),(select value from open_migration_ids where key='stage'),
 jsonb_build_array(
  jsonb_build_object('source_row',1,'item_type','customer_invoice','source_counterparty_key','C1','source_document_key','DUP','source_reference','DUP-1','document_date','2034-12-01','due_date','2034-12-15','original_minor','100','open_minor','100','currency_code','EGP','currency_evidence',jsonb_build_object('source_currency','EGP','policy','base_currency_open_item'),'control_account_id',(select value from open_migration_ids where key='ar_control'),'correction_account_id',(select value from open_migration_ids where key='revenue'),'source_identity',jsonb_build_object('row',1)),
  jsonb_build_object('source_row',2,'item_type','customer_invoice','source_counterparty_key','C1','source_document_key','DUP','source_reference','DUP-2','document_date','2034-12-01','due_date','2034-12-15','original_minor','100','open_minor','100','currency_code','EGP','currency_evidence',jsonb_build_object('source_currency','EGP','policy','base_currency_open_item'),'control_account_id',(select value from open_migration_ids where key='ar_control'),'correction_account_id',(select value from open_migration_ids where key='revenue'),'source_identity',jsonb_build_object('row',2)))),
 '23505','MIGRATION_OPEN_ITEM_SOURCE_DUPLICATE','duplicate source document identity fails closed');

-- Over-allocation, wrong Control binding, and currency-policy violations are
-- staged as immutable evidence but cannot validate or be accepted.
insert into open_migration_ids values ('overallocated',public.stage_migration_open_items(
 (select value from open_migration_ids where key='project'),(select value from open_migration_ids where key='stage'),
 jsonb_build_array(jsonb_build_object('source_row',1,'item_type','customer_invoice','source_counterparty_key','C1','source_document_key','OVER','source_reference','OVER','document_date','2034-12-01','due_date','2034-12-15','original_minor','100','open_minor','50','currency_code','EGP','currency_evidence',jsonb_build_object('source_currency','EGP','policy','base_currency_open_item'),'control_account_id',(select value from open_migration_ids where key='ar_control'),'correction_account_id',(select value from open_migration_ids where key='revenue'),'source_identity',jsonb_build_object('row',1))),
 jsonb_build_array(jsonb_build_object('target_item_type','customer_invoice','target_document_key','OVER','source_type','receipt','source_document_key','OVER-R','source_reference','Over allocation','allocation_date','2034-12-20','amount_minor','60','source_identity',jsonb_build_object('row',2))),'overallocated:v1'));
select ok((public.validate_migration_open_items((select value from open_migration_ids where key='overallocated'))->'errors') ? 'MIGRATION_ALLOCATION_RECONCILIATION_FAILED','over-allocation cannot validate');
insert into open_migration_ids values ('wrong_control',public.stage_migration_open_items(
 (select value from open_migration_ids where key='project'),(select value from open_migration_ids where key='stage'),
 jsonb_build_array(jsonb_build_object('source_row',1,'item_type','customer_invoice','source_counterparty_key','C1','source_document_key','WRONG-CONTROL','source_reference','WRONG-CONTROL','document_date','2034-12-01','due_date','2034-12-15','original_minor','100','open_minor','100','currency_code','EGP','currency_evidence',jsonb_build_object('source_currency','EGP','policy','base_currency_open_item'),'control_account_id',(select value from open_migration_ids where key='ap_control'),'correction_account_id',(select value from open_migration_ids where key='revenue'),'source_identity',jsonb_build_object('row',1))),
 '[]'::jsonb,'wrong-control:v1'));
select ok((public.validate_migration_open_items((select value from open_migration_ids where key='wrong_control'))->'errors') ? 'MIGRATION_OPEN_ITEM_POLICY_VIOLATION','wrong subledger Control cannot validate');
insert into open_migration_ids values ('wrong_currency',public.stage_migration_open_items(
 (select value from open_migration_ids where key='project'),(select value from open_migration_ids where key='stage'),
 jsonb_build_array(jsonb_build_object('source_row',1,'item_type','customer_invoice','source_counterparty_key','C1','source_document_key','USD','source_reference','USD','document_date','2034-12-01','due_date','2034-12-15','original_minor','100','open_minor','100','currency_code','USD','currency_evidence',jsonb_build_object('source_currency','USD','policy','foreign_currency_open_item'),'control_account_id',(select value from open_migration_ids where key='ar_control'),'correction_account_id',(select value from open_migration_ids where key='revenue'),'source_identity',jsonb_build_object('row',1))),
 '[]'::jsonb,'wrong-currency:v1'));
select ok((public.validate_migration_open_items((select value from open_migration_ids where key='wrong_currency'))->'errors') ? 'MIGRATION_OPEN_ITEM_POLICY_VIOLATION','foreign currency cannot enter the base-currency AR/AP migration path');

insert into open_migration_ids values ('open_batch',public.stage_migration_open_items(
 (select value from open_migration_ids where key='project'),(select value from open_migration_ids where key='stage'),
 jsonb_build_array(
  jsonb_build_object('source_row',1,'item_type','customer_invoice','source_counterparty_key','C1','source_document_key','AR-1','source_reference','INV-001','document_date','2034-10-01','due_date','2034-10-31','original_minor','10000','open_minor','7000','currency_code','EGP','currency_evidence',jsonb_build_object('source_currency','EGP','policy','base_currency_open_item'),'control_account_id',(select value from open_migration_ids where key='ar_control'),'correction_account_id',(select value from open_migration_ids where key='revenue'),'source_identity',jsonb_build_object('ledger','AR','row',1)),
  jsonb_build_object('source_row',2,'item_type','customer_invoice','source_counterparty_key','C1','source_document_key','AR-2','source_reference','INV-002','document_date','2034-12-01','due_date','2035-01-15','original_minor','5000','open_minor','5000','currency_code','EGP','currency_evidence',jsonb_build_object('source_currency','EGP','policy','base_currency_open_item'),'control_account_id',(select value from open_migration_ids where key='ar_control'),'correction_account_id',(select value from open_migration_ids where key='revenue'),'source_identity',jsonb_build_object('ledger','AR','row',2)),
  jsonb_build_object('source_row',3,'item_type','customer_credit','source_counterparty_key','C2','source_document_key','AR-C1','source_reference','CR-001','document_date','2034-12-20','due_date','2034-12-20','original_minor','500','open_minor','500','currency_code','EGP','currency_evidence',jsonb_build_object('source_currency','EGP','policy','base_currency_open_item'),'control_account_id',(select value from open_migration_ids where key='ar_control'),'correction_account_id',(select value from open_migration_ids where key='revenue'),'source_identity',jsonb_build_object('ledger','AR','row',3)),
  jsonb_build_object('source_row',4,'item_type','supplier_bill','source_counterparty_key','S1','source_document_key','AP-1','source_reference','BILL-001','document_date','2034-09-01','due_date','2034-10-01','original_minor','8000','open_minor','6000','currency_code','EGP','currency_evidence',jsonb_build_object('source_currency','EGP','policy','base_currency_open_item'),'control_account_id',(select value from open_migration_ids where key='ap_control'),'correction_account_id',(select value from open_migration_ids where key='expense'),'source_identity',jsonb_build_object('ledger','AP','row',4)),
  jsonb_build_object('source_row',5,'item_type','supplier_bill','source_counterparty_key','S2','source_document_key','AP-2','source_reference','BILL-002','document_date','2034-11-15','due_date','2035-01-15','original_minor','4000','open_minor','4000','currency_code','EGP','currency_evidence',jsonb_build_object('source_currency','EGP','policy','base_currency_open_item'),'control_account_id',(select value from open_migration_ids where key='ap_control'),'correction_account_id',(select value from open_migration_ids where key='expense'),'source_identity',jsonb_build_object('ledger','AP','row',5)),
  jsonb_build_object('source_row',6,'item_type','supplier_credit','source_counterparty_key','S2','source_document_key','AP-C1','source_reference','SC-001','document_date','2034-12-20','due_date','2034-12-20','original_minor','500','open_minor','500','currency_code','EGP','currency_evidence',jsonb_build_object('source_currency','EGP','policy','base_currency_open_item'),'control_account_id',(select value from open_migration_ids where key='ap_control'),'correction_account_id',(select value from open_migration_ids where key='expense'),'source_identity',jsonb_build_object('ledger','AP','row',6))),
 jsonb_build_array(
  jsonb_build_object('target_item_type','customer_invoice','target_document_key','AR-1','source_type','receipt','source_document_key','RCPT-HIST-1','source_reference','Historical receipt 1','allocation_date','2034-11-01','amount_minor','3000','source_identity',jsonb_build_object('batch','legacy-ar')),
  jsonb_build_object('target_item_type','supplier_bill','target_document_key','AP-1','source_type','payment','source_document_key','PAY-HIST-1','source_reference','Historical payment 1','allocation_date','2034-11-01','amount_minor','2000','source_identity',jsonb_build_object('batch','legacy-ap'))),
 'open-items:v1'));
-- Validation proves exact AR/AP Control totals before acceptance.
select is((public.validate_migration_open_items((select value from open_migration_ids where key='open_batch'))->>'valid')::boolean,
 true,'deterministic AR and AP open-item registers reconcile to posted Control balances');
select is(public.accept_migration_open_items((select value from open_migration_ids where key='open_batch'),'accept:v1'),
 (select value from open_migration_ids where key='open_batch'),'validated opening evidence is accepted');
select is(public.accept_migration_open_items((select value from open_migration_ids where key='open_batch'),'accept:v1'),
 (select value from open_migration_ids where key='open_batch'),'acceptance retry is idempotent');
select is((select encode(extensions.digest(coalesce((select string_agg(to_jsonb(t)::text,'|' order by t.id)
   from public.transactions t where t.organization_id=(select value from open_migration_ids where key='org')),'')||'#'||
   coalesce((select string_agg(to_jsonb(e)::text,'|' order by e.transaction_id,e.entry_index)
   from public.transaction_entries e where e.organization_id=(select value from open_migration_ids where key='org')),''),'sha256'),'hex')),
 (select value from open_migration_values where key='ledger_after_opening'),'acceptance creates no duplicate GL transaction or entry');
select is((select sum(outstanding_minor::bigint) from public.read_ar_open_items((select value from open_migration_ids where key='org'),'2034-12-31')),
 12000::numeric,'customer invoices appear in existing AR aging at exact open amounts');
select is((select sum(outstanding_minor::bigint) from public.read_ap_open_items((select value from open_migration_ids where key='org'),'2034-12-31')),
 10000::numeric,'supplier bills appear in existing AP aging at exact open amounts');
select is((select original_minor||':'||outstanding_minor from public.read_ar_open_items((select value from open_migration_ids where key='org'),'2034-12-31') where reference='INV-001'),
 '10000:7000','existing AR aging preserves source original and open amounts');
select is((select original_minor||':'||outstanding_minor from public.read_ap_open_items((select value from open_migration_ids where key='org'),'2034-12-31') where reference='BILL-001'),
 '8000:6000','existing AP aging preserves source original and open amounts');
select is((select subledger_balance_minor from public.reconcile_control_accounts((select value from open_migration_ids where key='org'),'2034-12-31') where control_account_id=(select value from open_migration_ids where key='ar_control')),
 11500::bigint,'AR invoices and open credit net exactly to AR Control');
select is((select subledger_balance_minor from public.reconcile_control_accounts((select value from open_migration_ids where key='org'),'2034-12-31') where control_account_id=(select value from open_migration_ids where key='ap_control')),
 9500::bigint,'AP bills and open credit net exactly to AP Control');
select is((select count(*) from public.counterparties where organization_id=(select value from open_migration_ids where key='org') and name='Migrated supplier two'),
 1::bigint,'reviewed supplier master creation occurs exactly at acceptance');

-- Existing operational settlement paths allocate against migrated items.
insert into open_migration_ids
select 'ar_invoice',ar_document_id from public.migration_open_item_acceptances accepted
join public.migration_open_items item on item.id=accepted.item_id where item.source_document_key='AR-1';
insert into open_migration_ids
select 'ap_bill',ap_document_id from public.migration_open_item_acceptances accepted
join public.migration_open_items item on item.id=accepted.item_id where item.source_document_key='AP-1';
select public.post_ar_document((select value from open_migration_ids where key='org'),'receipt',(select value from open_migration_ids where key='customer_one'),
 (select value from open_migration_ids where key='ar_control'),'2035-01-10',2000,(select value from open_migration_ids where key='cash'),'POST-RCPT','post-rcpt',
 p_allocations=>jsonb_build_array(jsonb_build_object('invoice_id',(select value from open_migration_ids where key='ar_invoice'),'amount_minor','2000')));
select public.post_ap_document((select value from open_migration_ids where key='org'),'payment',(select value from open_migration_ids where key='supplier_one'),
 (select value from open_migration_ids where key='ap_control'),'2035-01-10',1000,(select value from open_migration_ids where key='cash'),'POST-PAY','post-pay',
 p_allocations=>jsonb_build_array(jsonb_build_object('bill_id',(select value from open_migration_ids where key='ap_bill'),'amount_minor','1000')));
select is((select outstanding_minor from public.read_ar_open_items((select value from open_migration_ids where key='org'),'2035-01-10') where invoice_id=(select value from open_migration_ids where key='ar_invoice')),
 '5000','ordinary receipt reduces a migrated invoice without historical revenue');
select is((select outstanding_minor from public.read_ap_open_items((select value from open_migration_ids where key='org'),'2035-01-10') where bill_id=(select value from open_migration_ids where key='ap_bill')),
 '5000','ordinary payment reduces a migrated bill without historical expense or asset cost');
select is((select count(*) from public.transaction_entries where organization_id=(select value from open_migration_ids where key='org')
 and account_id in ((select value from open_migration_ids where key='revenue'),(select value from open_migration_ids where key='expense'))),
 0::bigint,'acceptance and settlement never recognize historical P&L');
select public.post_ar_document((select value from open_migration_ids where key='org'),'credit',(select value from open_migration_ids where key='customer_one'),
 (select value from open_migration_ids where key='ar_control'),'2035-01-11',500,(select value from open_migration_ids where key='revenue'),'POST-AR-CORRECTION','post-ar-correction',
 p_allocations=>jsonb_build_array(jsonb_build_object('invoice_id',(select value from open_migration_ids where key='ar_invoice'),'amount_minor','500')),p_reason=>'Reviewed post-cutover migration correction');
select public.post_ap_document((select value from open_migration_ids where key='org'),'credit',(select value from open_migration_ids where key='supplier_one'),
 (select value from open_migration_ids where key='ap_control'),'2035-01-11',500,(select value from open_migration_ids where key='expense'),'POST-AP-CORRECTION','post-ap-correction',
 p_allocations=>jsonb_build_array(jsonb_build_object('bill_id',(select value from open_migration_ids where key='ap_bill'),'amount_minor','500')),p_reason=>'Reviewed post-cutover migration correction');
select is((select count(*) from public.ar_documents where organization_id=(select value from open_migration_ids where key='org') and idempotency_key='post-ar-correction' and reason='Reviewed post-cutover migration correction'),
 1::bigint,'existing AR correction flow remains traceable for a migrated invoice');
select is((select count(*) from public.ap_documents where organization_id=(select value from open_migration_ids where key='org') and idempotency_key='post-ap-correction' and reason='Reviewed post-cutover migration correction'),
 1::bigint,'existing AP correction flow remains traceable for a migrated bill');

-- Approved evidence and imported module documents cannot be silently rewritten.
reset role;
select throws_ok(format('update public.migration_open_items set open_minor=1 where batch_id=%L',(select value from open_migration_ids where key='open_batch')),
 '55000','MIGRATION_EVIDENCE_IMMUTABLE: append a new revision','staged open-item evidence is immutable');
set local role authenticated;
select throws_ok(format($q$select public.reverse_ar_document(%L,%L,'2035-01-11','rewrite','bad-reversal')$q$,
 (select value from open_migration_ids where key='org'),(select value from open_migration_ids where key='ar_invoice')),
 '55000','MIGRATION_OPEN_ITEM_IMMUTABLE: use a traceable AR adjustment or migration replacement workflow','accepted AR source evidence cannot be reversed as an ordinary invoice');
select throws_ok(format($q$select public.accept_migration_open_items(%L,'changed-key')$q$,(select value from open_migration_ids where key='open_batch')),
 '23505','MIGRATION_IDEMPOTENCY_CONFLICT','changed acceptance retry fails closed');
select throws_ok(format($q$select public.reverse_opening_balance_batch(%L,'rewrite accepted cutover','2035-01-11')$q$,
 (select value from open_migration_ids where key='opening')),
 '55000','MIGRATION_CUTOVER_LOCKED: accepted open items require a reviewed replacement cutover','accepted opening journal cannot be reversed away from immutable subledger evidence');

-- Cross-tenant reads and commands remain denied.
select set_config('request.jwt.claims','{"sub":"55000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into open_migration_ids values ('other_org',public.create_organization('Open-item outsider','EGP'));
select is((select count(*) from public.migration_open_items where batch_id=(select value from open_migration_ids where key='open_batch')),
 0::bigint,'RLS hides accepted open-item evidence from another tenant');
select throws_ok(format('select public.read_migration_open_item_batch(%L)',(select value from open_migration_ids where key='open_batch')),
 '42501','TENANT_ACCESS_DENIED: not a member of this organization','cross-tenant open-item reader is denied');

select * from finish();
rollback;
