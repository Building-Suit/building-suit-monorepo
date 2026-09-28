-- LS-MIG-003: operational opening detail reconciles to the one Opening Trial
-- Balance without replaying historical accounting.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table operational_ids(key text primary key,value uuid not null);
create temp table operational_values(key text primary key,value text not null);
grant all on operational_ids,operational_values to authenticated;

insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('56000000-0000-4000-8000-000000000001','operational-owner@test.local','{}','{}'),
 ('56000000-0000-4000-8000-000000000002','operational-outsider@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"56000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;

insert into operational_ids values('org',public.create_organization('Operational migration fixture','EGP'));
insert into operational_ids values
 ('asset_cost',public.create_account((select value from operational_ids where key='org'),'Migrated equipment cost','asset','equipment',p_code=>'OM100')),
 ('bank',public.create_account((select value from operational_ids where key='org'),'Migrated bank','asset','bank',p_code=>'OM110')),
 ('inventory',public.create_account((select value from operational_ids where key='org'),'Migrated inventory Control','asset','inventory',p_code=>'OM120',p_account_role=>'control',p_control_subledger_type=>'inventory')),
 ('vat_input',public.create_account((select value from operational_ids where key='org'),'VAT input','asset','other_asset',p_code=>'OM130')),
 ('vat_output',public.create_account((select value from operational_ids where key='org'),'VAT output','liability','taxes_payable',p_code=>'OM210')),
 ('equity',public.create_account((select value from operational_ids where key='org'),'Opening equity','equity','retained_earnings',p_code=>'OM300'));
insert into operational_ids values('asset_accum',public.create_account(
 (select value from operational_ids where key='org'),'Migrated accumulated depreciation','asset','equipment',p_code=>'OM101',
 p_normal_balance=>'credit',p_contra_account_id=>(select value from operational_ids where key='asset_cost')));
insert into operational_ids values('vat_profile',public.configure_egypt_vat(
 (select value from operational_ids where key='org'),'EG-OPERATIONAL-TEST','2030-01-01',
 (select value from operational_ids where key='vat_output'),(select value from operational_ids where key='vat_input')));

insert into operational_ids values('project',public.create_migration_project(
 (select value from operational_ids where key='org'),'Operational Fast Cutover','other_system_export','2034-12-31','operational-project:v1'));
insert into operational_ids values('source',public.upload_migration_source(
 (select value from operational_ids where key='project'),'operational-registers.csv','text/csv',convert_to('operational-register-fixture','UTF8'),
 encode(extensions.digest(convert_to('operational-register-fixture','UTF8'),'sha256'),'hex'),
 jsonb_build_object('system','legacy-erp','company','fixture'),
 (select jsonb_agg(jsonb_build_object('source_row',n,'source_key','OPENING') order by n) from generate_series(1,7)n),
 'operational-source:v1'));
insert into operational_ids values('mapping',public.create_migration_mapping_revision(
 (select value from operational_ids where key='project'),(select value from operational_ids where key='source'),
 jsonb_build_array(jsonb_build_object('source_kind','account','source_key','OPENING','source_identity',jsonb_build_object('code','OPENING'),
   'resolution','existing_record','target_account_id',(select value from operational_ids where key='equity'),
   'approval_evidence',jsonb_build_object('review','operational rows traced to signed source schedules'))),
 'Operational source identity reviewed against approved schedules','operational-mapping:v1'));
insert into operational_ids values('stage',public.stage_migration_rows(
 (select value from operational_ids where key='project'),(select value from operational_ids where key='source'),
 (select value from operational_ids where key='mapping'),
 (select jsonb_agg(jsonb_build_object('source_row',n,'source_kind','account','source_key','OPENING','normalized_payload',jsonb_build_object('row',n)) order by n) from generate_series(1,7)n),
 'operational-stage:v1'));
select is((public.validate_migration_project((select value from operational_ids where key='project'),
 (select value from operational_ids where key='stage'))->>'valid')::boolean,true,'operational source reaches validated staging');

insert into operational_ids values('opening',public.create_opening_balance_batch(
 (select value from operational_ids where key='org'),'year_start','2034-12-31','operational-opening.csv',jsonb_build_array(
  jsonb_build_object('source_row',1,'source_code','OM100','debit','100.00','credit','','account_id',(select value from operational_ids where key='asset_cost')),
  jsonb_build_object('source_row',2,'source_code','OM101','debit','','credit','20.00','account_id',(select value from operational_ids where key='asset_accum')),
  jsonb_build_object('source_row',3,'source_code','OM110','debit','55.00','credit','','account_id',(select value from operational_ids where key='bank')),
  jsonb_build_object('source_row',4,'source_code','OM120','debit','30.00','credit','','account_id',(select value from operational_ids where key='inventory')),
  jsonb_build_object('source_row',5,'source_code','OM130','debit','4.00','credit','','account_id',(select value from operational_ids where key='vat_input')),
  jsonb_build_object('source_row',6,'source_code','OM210','debit','','credit','9.00','account_id',(select value from operational_ids where key='vat_output')),
  jsonb_build_object('source_row',7,'source_code','OM300','debit','','credit','160.00','account_id',(select value from operational_ids where key='equity')))));
select is((public.validate_opening_balance_batch((select value from operational_ids where key='opening'))->>'valid')::boolean,true,
 'the single Opening Trial Balance is balanced');
select public.approve_opening_balance_batch((select value from operational_ids where key='opening'));
select public.link_migration_opening_balance_batch((select value from operational_ids where key='project'),(select value from operational_ids where key='opening'));

-- A wrong first-reconciliation statement is retained as evidence but fails
-- closed with an explicit bank-to-GL variance.
insert into operational_ids values('invalid_batch',public.stage_migration_operational_cutover(
 (select value from operational_ids where key='project'),(select value from operational_ids where key='stage'),
 '{"open_items":false,"assets":false,"bank":true,"inventory":false,"tax":false}',
 '[]',jsonb_build_array(jsonb_build_object('source_row',2,'bank_account_id',(select value from operational_ids where key='bank'),
  'currency_code','EGP','statement_date','2034-12-31','statement_balance_minor','4900','statement_reference','BANK-CUTOVER-BAD',
  'source_identity',jsonb_build_object('statement','bad'),'approval_evidence',jsonb_build_object('approved_by','reviewer'))),
 jsonb_build_array(
  jsonb_build_object('source_row',3,'bank_account_id',(select value from operational_ids where key='bank'),'source_item_key','DEP-1','kind','deposit','transaction_date','2034-12-30','signed_bank_effect_minor','1000','reference','Deposit in transit','source_identity',jsonb_build_object('register_row',1)),
  jsonb_build_object('source_row',4,'bank_account_id',(select value from operational_ids where key='bank'),'source_item_key','PAY-1','kind','payment','transaction_date','2034-12-30','signed_bank_effect_minor','-500','reference','Outstanding payment','source_identity',jsonb_build_object('register_row',2))),
 '[]','[]','operational-invalid:v1'));
select ok((public.validate_migration_operational_cutover((select value from operational_ids where key='invalid_batch'))->'errors') ? 'MIGRATION_BANK_GL_VARIANCE',
 'unexplained blocking bank variance prevents final cutover');

insert into operational_values
select 'ledger_before',encode(extensions.digest(
 coalesce((select string_agg(to_jsonb(t)::text,'|' order by t.id) from public.transactions t where t.organization_id=(select value from operational_ids where key='org')),'')||'#'||
 coalesce((select string_agg(to_jsonb(e)::text,'|' order by e.transaction_id,e.entry_index) from public.transaction_entries e where e.organization_id=(select value from operational_ids where key='org')),''),
 'sha256'),'hex');
insert into operational_ids values('batch',public.stage_migration_operational_cutover(
 (select value from operational_ids where key='project'),(select value from operational_ids where key='stage'),
 '{"open_items":false,"assets":true,"bank":true,"inventory":true,"tax":true}',
 jsonb_build_array(jsonb_build_object('source_row',1,'source_asset_key','LEGACY-ASSET-1','source_identity',jsonb_build_object('register','FA','row',1),
  'asset_code','M-001','asset_name','Machine','acquisition_date','2030-01-01','in_service_date','2030-01-15','cost_minor','10000',
  'accumulated_depreciation_minor','2000','net_book_value_minor','8000','residual_value_minor','1000','useful_life_months',120,
  'depreciation_method','straight_line','cost_account_id',(select value from operational_ids where key='asset_cost'),
  'accumulated_depreciation_account_id',(select value from operational_ids where key='asset_accum'),
  'approval_evidence',jsonb_build_object('approved_by','asset-reviewer','schedule','signed'))),
 jsonb_build_array(jsonb_build_object('source_row',2,'bank_account_id',(select value from operational_ids where key='bank'),
  'currency_code','EGP','statement_date','2034-12-31','statement_balance_minor','5000','statement_reference','BANK-CUTOVER-1',
  'source_identity',jsonb_build_object('statement','closing'),'approval_evidence',jsonb_build_object('approved_by','bank-reviewer'))),
 jsonb_build_array(
  jsonb_build_object('source_row',3,'bank_account_id',(select value from operational_ids where key='bank'),'source_item_key','DEP-1','kind','deposit','transaction_date','2034-12-30','signed_bank_effect_minor','1000','reference','Deposit in transit','source_identity',jsonb_build_object('register_row',1)),
  jsonb_build_object('source_row',4,'bank_account_id',(select value from operational_ids where key='bank'),'source_item_key','PAY-1','kind','payment','transaction_date','2034-12-30','signed_bank_effect_minor','-500','reference','Outstanding payment','source_identity',jsonb_build_object('register_row',2))),
 jsonb_build_array(jsonb_build_object('source_row',5,'source_key','inventory-suit-opening','source_system','inventory-suit','schema_version',1,
  'snapshot_date','2034-12-31','currency_code','EGP','control_account_id',(select value from operational_ids where key='inventory'),
  'stock_quantity','25','valuation_minor','3000','costing_method','weighted_average','policy_version','approved-v7','valuation_sha256',repeat('a',64),
  'source_identity',jsonb_build_object('snapshot','INV-2034'),'approval_evidence',jsonb_build_object('approved',true,'reviewer','inventory-controller'))),
 jsonb_build_array(
  jsonb_build_object('source_row',6,'vat_profile_id',(select value from operational_ids where key='vat_profile'),'direction','input',
   'designated_account_id',(select value from operational_ids where key='vat_input'),'period_end','2034-12-31','balance_minor','400',
   'evidence_scope','approved_egypt_vat','evidence_type','return_summary','source_identity',jsonb_build_object('return','INPUT-OPEN'),
   'approval_evidence',jsonb_build_object('approved_by','tax-reviewer')),
  jsonb_build_object('source_row',7,'vat_profile_id',(select value from operational_ids where key='vat_profile'),'direction','output',
   'designated_account_id',(select value from operational_ids where key='vat_output'),'period_end','2034-12-31','balance_minor','900',
   'evidence_scope','approved_egypt_vat','evidence_type','ledger_opening_schedule','source_identity',jsonb_build_object('schedule','OUTPUT-OPEN'),
   'approval_evidence',jsonb_build_object('approved_by','tax-reviewer'))),
 'operational-valid:v1'));

select is((public.validate_migration_operational_cutover((select value from operational_ids where key='batch'))->>'valid')::boolean,true,
 'every applicable operational register reconciles to its designated GL balance');
select ok((select bool_and((variance->>'variance_minor')='0') from jsonb_array_elements(
 (public.read_migration_operational_cutover((select value from operational_ids where key='batch'))->'batch'->'validation_result'->'variances')) variance),
 'asset cost/accumulated depreciation, bank position, inventory valuation, and VAT balances expose zero variance');
select is(public.accept_migration_operational_cutover((select value from operational_ids where key='batch'),'accept-operational:v1'),
 (select value from operational_ids where key='batch'),'validated operational cutover is accepted');
select is(public.accept_migration_operational_cutover((select value from operational_ids where key='batch'),'accept-operational:v1'),
 (select value from operational_ids where key='batch'),'acceptance retry is idempotent');
select is((select encode(extensions.digest(
 coalesce((select string_agg(to_jsonb(t)::text,'|' order by t.id) from public.transactions t where t.organization_id=(select value from operational_ids where key='org')),'')||'#'||
 coalesce((select string_agg(to_jsonb(e)::text,'|' order by e.transaction_id,e.entry_index) from public.transaction_entries e where e.organization_id=(select value from operational_ids where key='org')),''),
 'sha256'),'hex')),(select value from operational_values where key='ledger_before'),'acceptance preserves the cross-module GL digest');
select is((select count(*) from public.transactions where organization_id=(select value from operational_ids where key='org')),1::bigint,
 'no migration detail path posts duplicate historical GL effects');
select is((select count(*) from public.vat_documents where organization_id=(select value from operational_ids where key='org')),0::bigint,
 'VAT opening evidence does not fabricate historical compliance documents');

reset role;
select throws_ok(format('update public.migration_asset_openings set asset_name=%L where batch_id=%L','rewritten',(select value from operational_ids where key='batch')),
 '55000','MIGRATION_EVIDENCE_IMMUTABLE: append a new revision','accepted source evidence cannot be edited');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"56000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.migration_operational_batches),0::bigint,'RLS hides another tenant operational cutover');
select throws_ok(format('select public.read_migration_operational_cutover(%L)',(select value from operational_ids where key='batch')),
 '42501','TENANT_ACCESS_DENIED: not a member of this organization','cross-tenant operational reader is denied');

select * from finish();
rollback;
