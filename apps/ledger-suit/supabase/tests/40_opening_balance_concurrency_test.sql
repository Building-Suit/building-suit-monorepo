-- V2-IMP-006: two approval sessions create one economic opening result.
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(5);

select extensions.dblink_connect('opening_setup',format('host=%s port=%s dbname=postgres user=postgres password=postgres',inet_server_addr(),inet_server_port()));
create temp table opening_fixture as select gen_random_uuid() user_id,
  'Opening Approval Race ' || gen_random_uuid()::text organization_name,
  'race-' || gen_random_uuid()::text || '.csv' source_filename;
select extensions.dblink_exec('opening_setup',format($setup$
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (%L,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   %L,extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());
  set request.jwt.claims=%L; set role authenticated;
  do $body$ declare v_org uuid; v_debit uuid; v_credit uuid; begin
    v_org:=public.create_organization(%L,'EGP');
    v_debit:=public.create_account(v_org,'Race Cash','asset','cash',p_code=>'RACE100');
    v_credit:=public.create_account(v_org,'Race Equity','equity','other_equity',p_code=>'RACE300');
    perform public.create_opening_balance_batch(v_org,'year_start','2099-12-31',%L,jsonb_build_array(
      jsonb_build_object('source_row',1,'debit','10.00','credit','','account_id',v_debit),
      jsonb_build_object('source_row',2,'debit','','credit','10.00','account_id',v_credit)));
  end $body$;
  reset role;
  create or replace function public.test_opening_approve(p_batch uuid) returns uuid
  language plpgsql security definer set search_path='' as $body$
  begin perform set_config('request.jwt.claims',%L,true);
    return public.approve_opening_balance_batch(p_batch); end $body$;
$setup$, user_id, 'opening-race-' || user_id::text || '@test.local',
  jsonb_build_object('sub',user_id,'role','authenticated')::text,
  organization_name, source_filename,
  jsonb_build_object('sub',user_id,'role','authenticated')::text)) from opening_fixture;
select extensions.dblink_disconnect('opening_setup');

create temp table opening_race as select id batch_id,organization_id from public.opening_balance_batches
  where source_filename=(select source_filename from opening_fixture);
select extensions.dblink_connect('opening_race_1',format('host=%s port=%s dbname=postgres user=postgres password=postgres',inet_server_addr(),inet_server_port()));
select extensions.dblink_connect('opening_race_2',format('host=%s port=%s dbname=postgres user=postgres password=postgres',inet_server_addr(),inet_server_port()));
select extensions.dblink_exec('opening_race_1','begin');
select locked from extensions.dblink('opening_race_1',format('select id::text from public.opening_balance_batches where id=%L for update',(select batch_id from opening_race))) as result(locked text);
select extensions.dblink_send_query('opening_race_2',format('select public.test_opening_approve(%L)',(select batch_id from opening_race)));
select pg_sleep(0.15);
select is(extensions.dblink_is_busy('opening_race_2'),1,'second approval waits on the authoritative batch lock');
create temp table first_result as select transaction_id from extensions.dblink('opening_race_1',format('select public.test_opening_approve(%L)',(select batch_id from opening_race))) as result(transaction_id uuid);
select extensions.dblink_exec('opening_race_1','commit');
create temp table second_result as select transaction_id from extensions.dblink_get_result('opening_race_2') as result(transaction_id uuid);
select extensions.dblink_get_result('opening_race_2');
select is((select transaction_id from second_result),(select transaction_id from first_result),'concurrent retry returns the accepted journal');
select is((select count(*) from public.opening_balance_batches where id=(select batch_id from opening_race) and status='posted'),1::bigint,'one batch is accepted');
select is((select count(*) from public.transactions where organization_id=(select organization_id from opening_race) and source='opening_balance'),1::bigint,'one opening journal exists');
select is((select count(*) from public.transaction_entries e join public.transactions t on t.id=e.transaction_id where t.organization_id=(select organization_id from opening_race) and t.source='opening_balance'),2::bigint,'one set of opening lines exists');
select extensions.dblink_disconnect('opening_race_1');
select extensions.dblink_disconnect('opening_race_2');
select * from finish();
rollback;
