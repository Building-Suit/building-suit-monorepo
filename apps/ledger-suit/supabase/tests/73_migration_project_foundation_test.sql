-- LS-MIG-001: resumable cutover projects, immutable evidence, explicit mapping,
-- tenant isolation, and proof that staging has no ledger side effects.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table migration_ids(key text primary key, value uuid not null);
create temp table migration_values(key text primary key, value text not null);
grant all on migration_ids, migration_values to authenticated;

insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
  ('54000000-0000-4000-8000-000000000001','migration-owner@test.local','{}','{}'),
  ('54000000-0000-4000-8000-000000000002','migration-other@test.local','{}','{}'),
  ('54000000-0000-4000-8000-000000000003','migration-viewer@test.local','{}','{}');

select set_config('request.jwt.claims','{"sub":"54000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into migration_ids values ('org', public.create_organization('Migration Fixture','EGP'));
insert into migration_ids values
  ('cash', public.create_account((select value from migration_ids where key='org'),'Migration Cash','asset','cash',p_code=>'M100')),
  ('equity', public.create_account((select value from migration_ids where key='org'),'Migration Equity','equity','retained_earnings',p_code=>'M300')),
  ('group_account', public.create_account((select value from migration_ids where key='org'),'Migration Group','asset','other_asset',p_code=>'M000',p_account_role=>'group')),
  ('customer', public.create_counterparty((select value from migration_ids where key='org'),'Migration Customer','customer'));
reset role;
insert into public.organization_members(organization_id,user_id,role,status) values
  ((select value from migration_ids where key='org'),'54000000-0000-4000-8000-000000000003','viewer','active');

select set_config('request.jwt.claims','{"sub":"54000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
insert into migration_ids values ('other_org', public.create_organization('Other Migration Tenant','EGP'));
insert into migration_ids values
  ('other_account', public.create_account((select value from migration_ids where key='other_org'),'Other Cash','asset','cash',p_code=>'O100'));

select set_config('request.jwt.claims','{"sub":"54000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into migration_values
select 'ledger_before', count(*)::text || ':' ||
  (select count(*)::text from public.transaction_entries where organization_id=(select value from migration_ids where key='org'))
from public.transactions where organization_id=(select value from migration_ids where key='org');

-- Another-system CSV fixture reaches validated staging with an explicit account target.
insert into migration_ids values ('csv_project', public.create_migration_project(
  (select value from migration_ids where key='org'), 'Legacy export cutover',
  'other_system_export', '2034-12-31', 'project:legacy'));
select is(public.create_migration_project(
  (select value from migration_ids where key='org'), 'Legacy export cutover',
  'other_system_export', '2034-12-31', 'project:legacy'),
  (select value from migration_ids where key='csv_project'), 'project creation retry is idempotent');
select is((select migration_depth from public.migration_projects where id=(select value from migration_ids where key='csv_project')),
  'fast_cutover'::public.migration_depth, 'Fast Cutover is the default migration depth');

insert into migration_ids values ('csv_source', public.upload_migration_source(
  (select value from migration_ids where key='csv_project'), 'legacy-trial-balance.csv', 'text/csv',
  convert_to('account_code,account_name,debit,credit\n100,Cash,100.00,\n300,Equity,,100.00','UTF8'),
  encode(extensions.digest(convert_to('account_code,account_name,debit,credit\n100,Cash,100.00,\n300,Equity,,100.00','UTF8'),'sha256'),'hex'),
  jsonb_build_object('system','generic-ledger','exported_at','2034-12-31T20:00:00Z'),
  jsonb_build_array(
    jsonb_build_object('source_row',2,'source_sheet','Trial Balance','account_code','100','account_name','Cash','debit','100.00','credit',''),
    jsonb_build_object('source_row',3,'source_sheet','Trial Balance','account_code','300','account_name','Equity','debit','','credit','100.00')),
  'source:legacy:v1'));
select is(public.upload_migration_source(
  (select value from migration_ids where key='csv_project'), 'legacy-trial-balance.csv', 'text/csv',
  convert_to('account_code,account_name,debit,credit\n100,Cash,100.00,\n300,Equity,,100.00','UTF8'),
  encode(extensions.digest(convert_to('account_code,account_name,debit,credit\n100,Cash,100.00,\n300,Equity,,100.00','UTF8'),'sha256'),'hex'),
  jsonb_build_object('system','generic-ledger','exported_at','2034-12-31T20:00:00Z'),
  jsonb_build_array(
    jsonb_build_object('source_row',2,'source_sheet','Trial Balance','account_code','100','account_name','Cash','debit','100.00','credit',''),
    jsonb_build_object('source_row',3,'source_sheet','Trial Balance','account_code','300','account_name','Equity','debit','','credit','100.00')),
  'source:duplicate-hash'),
  (select value from migration_ids where key='csv_source'), 'duplicate source hash returns the immutable existing revision');
select is((select count(*) from public.migration_source_revisions where project_id=(select value from migration_ids where key='csv_project')),
  1::bigint, 'duplicate upload does not create a second source revision');
select is((select count(*) from public.migration_original_rows where source_revision_id=(select value from migration_ids where key='csv_source')),
  2::bigint, 'original source rows are preserved separately');
select is(public.download_migration_source((select value from migration_ids where key='csv_source')),
  convert_to('account_code,account_name,debit,credit\n100,Cash,100.00,\n300,Equity,,100.00','UTF8'),
  'authorized download returns the original evidence bytes');

insert into migration_ids values ('csv_mapping', public.create_migration_mapping_revision(
  (select value from migration_ids where key='csv_project'), (select value from migration_ids where key='csv_source'),
  jsonb_build_array(
    jsonb_build_object('source_kind','account','source_key','100','source_identity',jsonb_build_object('code','100','name','Cash'),
      'resolution','existing_record','target_account_id',(select value from migration_ids where key='cash'),
      'approval_evidence',jsonb_build_object('decision','reviewed','basis','code and statement identity')),
    jsonb_build_object('source_kind','account','source_key','300','source_identity',jsonb_build_object('code','300','name','Equity'),
      'resolution','existing_record','target_account_id',(select value from migration_ids where key='equity'),
      'approval_evidence',jsonb_build_object('decision','reviewed','basis','code and statement identity'))),
  'Account mappings reviewed against the active chart', 'mapping:legacy:v1'));

insert into migration_ids values ('csv_stage', public.stage_migration_rows(
  (select value from migration_ids where key='csv_project'), (select value from migration_ids where key='csv_source'),
  (select value from migration_ids where key='csv_mapping'),
  jsonb_build_array(
    jsonb_build_object('source_row',2,'source_kind','account','source_key','100',
      'normalized_payload',jsonb_build_object('debit_minor',10000,'credit_minor',0)),
    jsonb_build_object('source_row',3,'source_kind','account','source_key','300',
      'normalized_payload',jsonb_build_object('debit_minor',0,'credit_minor',10000))),
  'stage:legacy:v1'));
select is((public.validate_migration_project(
  (select value from migration_ids where key='csv_project'), (select value from migration_ids where key='csv_stage'))->>'valid')::boolean,
  true, 'another-system CSV reaches validated staging');
select is((select status from public.migration_projects where id=(select value from migration_ids where key='csv_project')),
  'validated'::public.migration_project_status, 'validated project remains resumable with status and revision metadata');
select is((select count(*) from public.migration_normalized_rows where staging_batch_id=(select value from migration_ids where key='csv_stage')),
  2::bigint, 'normalized rows are staged separately from original evidence');
select is((public.read_migration_project((select value from migration_ids where key='csv_project'))->'sources'->0 ? 'content_bytes'),
  false, 'workspace metadata never embeds private source bytes');

-- Accountant-prepared workbook fixture uses an explicitly reviewed creation path.
insert into migration_ids values ('workbook_project', public.create_migration_project(
  (select value from migration_ids where key='org'), 'Accountant workbook cutover',
  'accountant_paper_workbook', '2035-06-30', 'project:workbook'));
insert into migration_ids values ('workbook_source', public.upload_migration_source(
  (select value from migration_ids where key='workbook_project'), 'accountant-opening-register.xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', decode('504b0304','hex'),
  encode(extensions.digest(decode('504b0304','hex'),'sha256'),'hex'),
  jsonb_build_object('prepared_by','External accountant','paper_archive_reference','BOX-2035-04'),
  jsonb_build_array(jsonb_build_object('source_row',7,'source_sheet','Customers','customer_code','C-77','name','Paper Customer')),
  'source:workbook:v1'));
insert into migration_ids values ('workbook_mapping', public.create_migration_mapping_revision(
  (select value from migration_ids where key='workbook_project'), (select value from migration_ids where key='workbook_source'),
  jsonb_build_array(jsonb_build_object('source_kind','customer','source_key','C-77',
    'source_identity',jsonb_build_object('code','C-77','name','Paper Customer'),
    'resolution','reviewed_creation','proposed_record',jsonb_build_object('name','Paper Customer','type','customer'),
    'approval_evidence',jsonb_build_object('reviewer_note','Identity checked against signed paper register'))),
  'New customer reviewed from signed accountant register', 'mapping:workbook:v1'));
insert into migration_ids values ('workbook_stage', public.stage_migration_rows(
  (select value from migration_ids where key='workbook_project'), (select value from migration_ids where key='workbook_source'),
  (select value from migration_ids where key='workbook_mapping'),
  jsonb_build_array(jsonb_build_object('source_row',7,'source_kind','customer','source_key','C-77',
    'normalized_payload',jsonb_build_object('name','Paper Customer','type','customer'))), 'stage:workbook:v1'));
select is((public.validate_migration_project(
  (select value from migration_ids where key='workbook_project'), (select value from migration_ids where key='workbook_stage'))->>'valid')::boolean,
  true, 'accountant-prepared workbook reaches validated staging through reviewed creation');
select is((select count(*) from public.counterparties where organization_id=(select value from migration_ids where key='org') and name='Paper Customer'),
  0::bigint, 'reviewed creation path records approval but does not silently create master data');

-- The third approved generic source type is available without a connector.
insert into migration_ids values ('excel_project', public.create_migration_project(
  (select value from migration_ids where key='org'), 'Plain spreadsheet cutover',
  'excel_csv', '2035-12-31', 'project:excel'));
select is((select source_type from public.migration_projects where id=(select value from migration_ids where key='excel_project')),
  'excel_csv'::public.migration_source_type, 'plain Excel/CSV is supported without a competitor-specific connector');

-- Missing, ambiguous, foreign-tenant, and unsafe targets are rejected server-side.
select throws_ok(format($q$select public.create_migration_mapping_revision(%L,%L,%L::jsonb,%L,%L)$q$,
  (select value from migration_ids where key='csv_project'), (select value from migration_ids where key='csv_source'),
  jsonb_build_array(
    jsonb_build_object('source_kind','account','source_key','DUP','resolution','existing_record','target_account_id',(select value from migration_ids where key='cash')),
    jsonb_build_object('source_kind','account','source_key','DUP','resolution','existing_record','target_account_id',(select value from migration_ids where key='equity'))),
  'Duplicate source identity must never be inferred', 'mapping:ambiguous'),
  '23505','MIGRATION_MAPPING_AMBIGUOUS: each source identity requires one explicit reviewed mapping',
  'ambiguous duplicate source mappings are rejected');
select throws_ok(format($q$select public.create_migration_mapping_revision(%L,%L,%L::jsonb,%L,%L)$q$,
  (select value from migration_ids where key='csv_project'), (select value from migration_ids where key='csv_source'),
  jsonb_build_array(jsonb_build_object('source_kind','account','source_key','FOREIGN','resolution','existing_record',
    'target_account_id',(select value from migration_ids where key='other_account'))),
  'Foreign account must be rejected during review', 'mapping:foreign'),
  '23514','MIGRATION_ACCOUNT_TARGET_INELIGIBLE','cross-tenant account target is rejected');
select throws_ok(format($q$select public.create_migration_mapping_revision(%L,%L,%L::jsonb,%L,%L)$q$,
  (select value from migration_ids where key='csv_project'), (select value from migration_ids where key='csv_source'),
  jsonb_build_array(jsonb_build_object('source_kind','account','source_key','GROUP','resolution','existing_record',
    'target_account_id',(select value from migration_ids where key='group_account'))),
  'Group account must be rejected during review', 'mapping:group'),
  '23514','MIGRATION_ACCOUNT_TARGET_INELIGIBLE','non-postable group account target is rejected');

-- Linking the existing Opening Balance workflow is metadata-only.
insert into migration_ids values ('opening_batch', public.create_opening_balance_batch(
  (select value from migration_ids where key='org'), 'year_start', '2034-12-31', 'migration-opening.csv',
  jsonb_build_array(
    jsonb_build_object('source_row',1,'source_code','100','debit','100.00','credit','',
      'account_id',(select value from migration_ids where key='cash')),
    jsonb_build_object('source_row',2,'source_code','300','debit','','credit','100.00',
      'account_id',(select value from migration_ids where key='equity')))));
select is(public.link_migration_opening_balance_batch(
  (select value from migration_ids where key='csv_project'), (select value from migration_ids where key='opening_batch')),
  (select value from migration_ids where key='opening_batch'), 'validated project links the existing Opening Balance batch');
select is((select count(*)::text || ':' ||
  (select count(*)::text from public.transaction_entries where organization_id=(select value from migration_ids where key='org'))
  from public.transactions where organization_id=(select value from migration_ids where key='org')),
  (select value from migration_values where key='ledger_before'),
  'project, upload, mapping, validation, and Opening Balance linkage create no transactions or entries');

-- Immutable source and revision evidence cannot be rewritten even by table owners.
reset role;
select throws_ok(format('update public.migration_source_revisions set filename=%L where id=%L',
  'rewritten.csv',(select value from migration_ids where key='csv_source')),
  '55000','MIGRATION_EVIDENCE_IMMUTABLE: append a new revision','source file metadata is immutable');
select throws_ok(format('delete from public.migration_original_rows where source_revision_id=%L',
  (select value from migration_ids where key='csv_source')),
  '55000','MIGRATION_EVIDENCE_IMMUTABLE: append a new revision','original rows are immutable');

-- Read/write authorization and tenant isolation are enforced by RPCs and RLS.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"54000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.migration_projects),0::bigint,'viewer without migration capability cannot read project evidence');
select throws_ok(format($q$select public.create_migration_project(%L,'Viewer attempt','excel_csv','2036-01-01','viewer-attempt')$q$,
  (select value from migration_ids where key='org')),
  '42501','INSUFFICIENT_PERMISSION: migrations.manage is required','viewer cannot create a migration project');
select set_config('request.jwt.claims','{"sub":"54000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.migration_projects where organization_id=(select value from migration_ids where key='org')),
  0::bigint,'another tenant cannot read migration projects');
select throws_ok(format('select public.read_migration_project(%L)',(select value from migration_ids where key='csv_project')),
  '42501','TENANT_ACCESS_DENIED: not a member of this organization','another tenant cannot use the project reader');

select * from finish();
rollback;
