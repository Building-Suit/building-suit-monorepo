-- LS-MIG-004: two final-approval sessions accept one immutable cutover and
-- create exactly one Opening Trial Balance effect.
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(7);

select extensions.dblink_connect('migration_final_setup',format('host=%s port=%s dbname=postgres user=postgres password=postgres',inet_server_addr(),inet_server_port()));
create temp table migration_final_fixture as select gen_random_uuid() user_id,
  'Final Cutover Race ' || gen_random_uuid()::text organization_name,
  'final-' || gen_random_uuid()::text || '.csv' source_filename;
select extensions.dblink_exec('migration_final_setup',format($setup$
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (%L,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   %L,extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());
  set request.jwt.claims=%L; set role authenticated;
  do $body$ declare v_org uuid; v_cash uuid; v_equity uuid; v_project uuid; v_source uuid;
    v_mapping uuid; v_stage uuid; v_opening uuid; v_operational uuid; begin
    v_org:=public.create_organization(%L,'EGP');
    v_cash:=public.create_account(v_org,'Cutover Cash','asset','cash',p_code=>'CUT100');
    v_equity:=public.create_account(v_org,'Cutover Equity','equity','other_equity',p_code=>'CUT300');
    v_project:=public.create_migration_project(v_org,'Fast Cutover','accountant_paper_workbook','2099-12-31','final-project:v1');
    v_source:=public.upload_migration_source(v_project,%L,'text/csv',convert_to('paper-workbook-fixture','UTF8'),
      encode(extensions.digest(convert_to('paper-workbook-fixture','UTF8'),'sha256'),'hex'),
      jsonb_build_object('workbook','accountant-prepared'),
      jsonb_build_array(jsonb_build_object('source_row',1,'source_kind','account','source_key','EQUITY','source_name','Opening equity')),
      'final-source:v1');
    v_mapping:=public.create_migration_mapping_revision(v_project,v_source,
      jsonb_build_array(jsonb_build_object('source_kind','account','source_key','EQUITY','source_identity',jsonb_build_object('code','EQUITY'),
        'resolution','existing_record','target_account_id',v_equity,'approval_evidence',jsonb_build_object('reviewed',true))),
      'Accountant reviewed the paper workbook mapping','final-mapping:v1');
    v_stage:=public.stage_migration_rows(v_project,v_source,v_mapping,
      jsonb_build_array(jsonb_build_object('source_row',1,'source_kind','account','source_key','EQUITY','normalized_payload',jsonb_build_object('name','Opening equity'))),
      'final-stage:v1');
    perform public.validate_migration_project(v_project,v_stage);
    v_opening:=public.create_opening_balance_batch(v_org,'year_start','2099-12-31','final-opening.csv',jsonb_build_array(
      jsonb_build_object('source_row',1,'debit','10.00','credit','','account_id',v_cash),
      jsonb_build_object('source_row',2,'debit','','credit','10.00','account_id',v_equity)));
    perform public.link_migration_opening_balance_batch(v_project,v_opening);
    v_operational:=public.stage_migration_operational_cutover(v_project,v_stage,
      '{"open_items":false,"assets":false,"bank":false,"inventory":false,"tax":false}',
      '[]','[]','[]','[]','[]','final-operational:v1');
  end $body$;
  reset role;
  create or replace function public.test_migration_final_approve(p_project uuid,p_operational uuid,p_key text) returns jsonb
  language plpgsql security definer set search_path='' as $body$
  begin perform set_config('request.jwt.claims',%L,true);
    return public.approve_migration_cutover(p_project,p_operational,p_key); end $body$;
  create or replace function public.test_migration_final_review(p_project uuid,p_operational uuid) returns jsonb
  language plpgsql security definer set search_path='' as $body$
  begin perform set_config('request.jwt.claims',%L,true);
    return public.review_migration_cutover(p_project,p_operational); end $body$;
$setup$, user_id, 'migration-final-' || user_id::text || '@test.local',
  jsonb_build_object('sub',user_id,'role','authenticated')::text,
  organization_name, source_filename,
  jsonb_build_object('sub',user_id,'role','authenticated')::text,
  jsonb_build_object('sub',user_id,'role','authenticated')::text)) from migration_final_fixture;
select extensions.dblink_disconnect('migration_final_setup');

create temp table migration_final_race as
select project.id project_id,project.organization_id,project.current_source_revision_id source_revision_id,
  operational.id operational_id
from public.migration_projects project join public.migration_operational_batches operational on operational.project_id=project.id
where project.name='Fast Cutover' and project.organization_id=(select id from public.organizations where name=(select organization_name from migration_final_fixture));

select extensions.dblink_connect('migration_final_review',format('host=%s port=%s dbname=postgres user=postgres password=postgres',inet_server_addr(),inet_server_port()));
create temp table migration_final_review_result as select result from extensions.dblink('migration_final_review',format(
  'select public.test_migration_final_review(%L,%L)',(select project_id from migration_final_race),(select operational_id from migration_final_race))) as reviewed(result jsonb);
select extensions.dblink_disconnect('migration_final_review');
select is(((select result from migration_final_review_result)->>'valid')::boolean,
  true,'final review reconciles the exact projected Opening Trial Balance before posting');
select is((select result from migration_final_review_result)->>'history_policy',
  'source_archive_unless_separately_migrated','final review states the approved Fast Cutover history boundary');

select extensions.dblink_connect('migration_final_race_1',format('host=%s port=%s dbname=postgres user=postgres password=postgres',inet_server_addr(),inet_server_port()));
select extensions.dblink_connect('migration_final_race_2',format('host=%s port=%s dbname=postgres user=postgres password=postgres',inet_server_addr(),inet_server_port()));
select extensions.dblink_exec('migration_final_race_1','begin');
select extensions.dblink_exec('migration_final_race_1',format(
  'do $lock$ begin perform pg_advisory_xact_lock(hashtextextended(%L,0)); end $lock$','migration-final:'||(select project_id from migration_final_race)::text));
select extensions.dblink_send_query('migration_final_race_2',format('select public.test_migration_final_approve(%L,%L,%L)',
  (select project_id from migration_final_race),(select operational_id from migration_final_race),'final-race:v1'));
select pg_sleep(0.15);
select is(extensions.dblink_is_busy('migration_final_race_2'),1,'the second final approval waits on the project advisory lock');
create temp table migration_first_result as select result from extensions.dblink('migration_final_race_1',format(
  'select public.test_migration_final_approve(%L,%L,%L)',(select project_id from migration_final_race),(select operational_id from migration_final_race),'final-race:v1')) as accepted(result jsonb);
select extensions.dblink_exec('migration_final_race_1','commit');
create temp table migration_second_result as select result from extensions.dblink_get_result('migration_final_race_2') as accepted(result jsonb);
select extensions.dblink_get_result('migration_final_race_2');

select is((select result->>'approval_id' from migration_second_result),(select result->>'approval_id' from migration_first_result),
  'the concurrent retry returns the same immutable approval');
select is((select count(*) from public.migration_cutover_approvals where project_id=(select project_id from migration_final_race)),1::bigint,
  'one final cutover approval is recorded');
select is((select count(*) from public.transactions where organization_id=(select organization_id from migration_final_race) and source='opening_balance'),1::bigint,
  'final approval creates exactly one opening GL effect');
select is((select source_revision_id from public.migration_cutover_approvals where project_id=(select project_id from migration_final_race)),
  (select source_revision_id from migration_final_race),'approval records the exact immutable source revision');

select extensions.dblink_disconnect('migration_final_race_1');
select extensions.dblink_disconnect('migration_final_race_2');
select * from finish();
rollback;
