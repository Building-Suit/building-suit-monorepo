-- V2-IMP-014: disposable fixture only. No external provider is contacted.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create temp table inv_ids(key text primary key,id uuid not null);
grant all on inv_ids to authenticated;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('48000000-0000-4000-8000-000000000001','inventory-source@test.local','{}','{}'),
 ('48000000-0000-4000-8000-000000000002','inventory-viewer@test.local','{}','{}'),
 ('48000000-0000-4000-8000-000000000003','inventory-outsider@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"48000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into inv_ids values('org',public.create_organization('Inventory fixture','EGP'));
insert into inv_ids values
 ('control',public.create_inventory_control_account((select id from inv_ids where key='org'),'Inventory control')),
 ('cogs',public.create_account((select id from inv_ids where key='org'),'Inventory COGS','expense','cost_of_sales')),
 ('offset',public.create_account((select id from inv_ids where key='org'),'Inventory clearing','liability','other_liability'));
insert into inv_ids values('source',public.configure_inventory_source((select id from inv_ids where key='org'),'approved-fixture-book',
 '48000000-0000-4000-8000-000000000001','2034-01-01',(select id from inv_ids where key='control'),
 (select id from inv_ids where key='cogs'),(select id from inv_ids where key='offset')));
select is(public.read_inventory_workspace((select id from inv_ids where key='org'),'2034-12-31')->'sources'->0->>'status',
 'awaiting_source','empty integration never claims successful reconciliation');

-- Synthetic facts represent valuations already computed by Inventory Suit. The
-- method label is provenance, not a request for Ledger to calculate FIFO/WAC.
create function pg_temp.fact(n bigint,kind text,inventory bigint,cogs bigint,balance bigint,cogs_balance bigint,related uuid default null)
returns jsonb language sql as $$
 select jsonb_build_object('schema_version',1,'currency','EGP','negative_stock',false,'sequence',n::text,
 'movement_id','MOVE-'||n,'movement_version',1,'valuation_id','VALUE-'||n,'valuation_version',1,
 'costing_method','source-approved-method','policy_version','source-policy-1','kind',kind,
 'effective_date','2034-02-02','accounting_date','2034-02-02','stock_quantity_after','10.000',
 'inventory_delta_minor',inventory::text,'cogs_delta_minor',cogs::text,'inventory_balance_after_minor',balance::text,
 'cogs_balance_after_minor',cogs_balance::text,'related_fact_id',related,'reason','Explicit source fact');
$$;
insert into inv_ids values('purchase',public.ingest_inventory_fact((select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(1,'purchase',10000,0,10000,0)));
select is(public.ingest_inventory_fact((select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(1,'purchase',10000,0,10000,0)),
 (select id from inv_ids where key='purchase'),'identical source retry returns exactly one fact');
select throws_ok(format('select public.ingest_inventory_fact(%L,%L,%L)',(select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(1,'purchase',10001,0,10001,0)),
 '23505','INVENTORY_IDEMPOTENCY_CONFLICT','changed retry cannot rewrite an accepted valuation');
select throws_ok(format('select public.ingest_inventory_fact(%L,%L,%L)',(select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(3,'purchase',1000,0,11000,0)),
 '23514','INVENTORY_SEQUENCE_GAP','out-of-order delivery cannot hide missing movements');
select throws_ok(format('select public.ingest_inventory_fact(%L,%L,%L)',(select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(2,'decrease',-4000,4000,6001,4000)),
 '23514','INVENTORY_SNAPSHOT_VARIANCE','source snapshot must agree with accepted incremental values');
select throws_ok(format('select public.ingest_inventory_fact(%L,%L,%L)',(select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(2,'decrease',-4000,4000,6000,4000)||'{"negative_stock":true}'),
 '22023','INVENTORY_FACT_INVALID','source with negative stock is rejected');
select throws_ok(format('select public.ingest_inventory_fact(%L,%L,%L)',(select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(2,'decrease',-4000,4000,6000,4000)||'{"stock_quantity_after":"-1"}'),
 '22023','INVENTORY_FACT_INVALID','negative remaining quantity is rejected even with a false flag');
select throws_ok(format('select public.ingest_inventory_fact(%L,%L,%L)',(select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(2,'decrease',-4000,4000,6000,4000)||'{"inventory_delta_minor":-4000}'),
 '22023','INVENTORY_EXACT_INTEGER_REQUIRED','minor units use decimal strings at the JSON boundary');
insert into inv_ids values('sale',public.ingest_inventory_fact((select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(2,'decrease',-4000,4000,6000,4000)));
insert into inv_ids values('customer-return',public.ingest_inventory_fact((select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(3,'customer_return',1000,-1000,7000,3000,(select id from inv_ids where key='sale'))));
insert into inv_ids values('supplier-return',public.ingest_inventory_fact((select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(4,'supplier_return',-2000,0,5000,3000,(select id from inv_ids where key='purchase'))));
insert into inv_ids values('revalue',public.ingest_inventory_fact((select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(5,'revaluation',500,0,5500,3000)));
insert into inv_ids values('correction',public.ingest_inventory_fact((select id from inv_ids where key='org'),(select id from inv_ids where key='source'),
 pg_temp.fact(6,'correction',-200,0,5300,3000,(select id from inv_ids where key='purchase'))||'{"movement_id":"MOVE-1","movement_version":2,"effective_date":"2034-01-15","accounting_date":"2034-01-15"}'));
select is(public.read_inventory_workspace((select id from inv_ids where key='org'),'2034-12-31')->'sources'->0->>'inventory_minor','5300','source valuation is exact after returns/revaluation/backdated correction');
select is(public.read_inventory_workspace((select id from inv_ids where key='org'),'2034-12-31')->'sources'->0->>'cogs_minor','3000','COGS equals supplied issue value less returned cost');
select is(public.read_inventory_workspace((select id from inv_ids where key='org'),'2034-12-31')->'sources'->0->>'status','reconciled','valuation and COGS match the GL and latest source snapshot');
select is((select count(*) from public.inventory_accounting_facts),6::bigint,'retries never create extra accounting effects');
select is((select count(distinct transaction_id) from public.inventory_accounting_facts),6::bigint,'each source fact has exactly one distinct journal');
select is((select count(*) from public.transaction_summaries where source_record_kind='inventory'),6::bigint,'journal center provides reverse navigation to source evidence');
select is((select count(*) from public.reconcile_control_accounts((select id from inv_ids where key='org'),'2034-12-31') where status='reconciled'),1::bigint,'shared control reconciliation uses the inventory provider');
select is((select inventory_delta_minor from public.inventory_accounting_facts where id=(select id from inv_ids where key='purchase')),10000::bigint,'correction never mutates the original valuation');
select is(public.read_inventory_workspace((select id from inv_ids where key='org'),'2034-12-31',0,25,(select id from inv_ids where key='purchase'))->>'total','1','source deep link returns the precise tenant-scoped fact');
select throws_ok(format('select public.reverse_transaction(%L,%L,%L)',(select transaction_id from public.inventory_accounting_facts where id=(select id from inv_ids where key='purchase')),'Bypass source','2034-03-01'),
 '42501','INVENTORY_SOURCE_REQUIRED','generic reversal cannot bypass the inventory control boundary');
-- Remaining movement kinds are also supplied deltas, never computed costs.
insert into inv_ids values('increase',public.ingest_inventory_fact((select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(7,'increase',1000,0,6300,3000)));
insert into inv_ids values('adjustment',public.ingest_inventory_fact((select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(8,'adjustment',-300,0,6000,3000)));
select is(public.read_inventory_workspace((select id from inv_ids where key='org'),'2034-12-31')->'sources'->0->>'inventory_gl_minor','6000','all eight movement kinds reconcile without operational costing');
select throws_ok(format('select public.ingest_inventory_fact(%L,%L,%L)',(select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(9,'customer_return',100,-100,6100,2900)),
 '23514','INVENTORY_RELATED_FACT_REQUIRED','returns require an explicit source relationship');
reset role;
insert into public.accounting_periods(organization_id,fiscal_year_start,fiscal_year_end,start_date,end_date,status,created_by)
 values((select id from inv_ids where key='org'),'2034-01-01','2034-12-31','2034-03-01','2034-03-31','hard_closed','48000000-0000-4000-8000-000000000001'),
 ((select id from inv_ids where key='org'),'2034-01-01','2034-12-31','2034-05-01','2034-05-31','soft_closed','48000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(format('select public.ingest_inventory_fact(%L,%L,%L)',(select id from inv_ids where key='org'),(select id from inv_ids where key='source'),
 pg_temp.fact(9,'increase',100,0,6100,3000)||'{"effective_date":"2034-03-01","accounting_date":"2034-03-01"}'),
 '42501','ACCOUNTING_PERIOD_HARD_CLOSED','source cannot bypass a hard-closed period');
select throws_ok(format('select public.ingest_inventory_fact(%L,%L,%L)',(select id from inv_ids where key='org'),(select id from inv_ids where key='source'),
 pg_temp.fact(9,'increase',100,0,6100,3000)||'{"effective_date":"2034-05-01","accounting_date":"2034-05-01"}'),
 '42501','ACCOUNTING_PERIOD_SOFT_CLOSED: only authorized reasoned adjustments are allowed','ordinary source ingestion cannot override soft close');
select is((select count(*) from public.inventory_accounting_facts),8::bigint,'failed posting leaves no source fact or sequence reservation');
select public.ingest_inventory_fact((select id from inv_ids where key='org'),(select id from inv_ids where key='source'),
 pg_temp.fact(9,'increase',9007199254740993,0,9007199254746993,3000));
select is(public.read_inventory_workspace((select id from inv_ids where key='org'),'2034-12-31')->'sources'->0->>'inventory_gl_minor',
 '9007199254746993','amounts beyond JavaScript safe integers retain exact SQL and JSON string values');
-- Differences in designated COGS remain visible; ordinary GL entries are not
-- silently reclassified as Inventory Suit source facts.
select public.create_adjustment((select id from inv_ids where key='org'),'2034-04-01',jsonb_build_array(
 jsonb_build_object('account_id',(select id from inv_ids where key='cogs'),'side','debit','amount_minor',1),
 jsonb_build_object('account_id',(select id from inv_ids where key='offset'),'side','credit','amount_minor',1)),
 'Explicit GL variance fixture','Review required');
select is(public.read_inventory_workspace((select id from inv_ids where key='org'),'2034-12-31')->'sources'->0->>'cogs_variance_minor','1','independent GL variance is reported, never hidden');
select is(public.read_inventory_workspace((select id from inv_ids where key='org'),'2034-12-31')->'sources'->0->>'status','unreconciled','nonzero COGS variance cannot pass reconciliation');
reset role;
select throws_ok(format('update public.inventory_accounting_facts set reason=%L where id=%L','rewrite',(select id from inv_ids where key='purchase')),
 '55000','IMMUTABLE_INVENTORY_EVIDENCE','source evidence remains append-only');
insert into public.organization_members(organization_id,user_id,role,status) values
 ((select id from inv_ids where key='org'),'48000000-0000-4000-8000-000000000002','viewer','active');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"48000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok(format('select public.read_inventory_workspace(%L,%L)',(select id from inv_ids where key='org'),'2034-12-31'),'viewer can inspect inventory reports');
select throws_ok(format('select public.ingest_inventory_fact(%L,%L,%L)',(select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(7,'increase',100,0,5400,3000)),
 '42501','INSUFFICIENT_PERMISSION: inventory.ingest is required','reader cannot manufacture source facts');
select set_config('request.jwt.claims','{"sub":"48000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.inventory_accounting_facts),0::bigint,'RLS hides another tenant source facts');
select throws_ok(format('select public.read_inventory_workspace(%L,%L)',(select id from inv_ids where key='org'),'2034-12-31'),
 '42501','TENANT_ACCESS_DENIED: not a member of this organization','report cannot cross the tenant boundary');
reset role;
update public.organization_members set role='accountant' where user_id='48000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"48000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok(format('select public.ingest_inventory_fact(%L,%L,%L)',(select id from inv_ids where key='org'),(select id from inv_ids where key='source'),pg_temp.fact(9,'increase',100,0,6100,3000)),
 '42501','INVENTORY_SOURCE_ACTOR_REQUIRED','even an accountant cannot impersonate the bound source actor');
select * from finish();
rollback;
