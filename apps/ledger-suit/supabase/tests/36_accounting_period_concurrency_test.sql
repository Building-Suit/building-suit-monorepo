-- V2-IMP-004: deterministic close/post serialization in independent sessions.
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(8);

create temp table period_fixture as
select gen_random_uuid() user_id, 'Period Race Fixture ' || gen_random_uuid()::text organization_name;
select extensions.dblink_connect('period_setup', format(
  'host=%s port=%s dbname=postgres user=postgres password=postgres', inet_server_addr(), inet_server_port()));
select extensions.dblink_exec('period_setup', format($setup$
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    %L,'00000000-0000-0000-0000-000000000000',
    'authenticated','authenticated',%L,extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()
  );
  set request.jwt.claims = %L;
  set role authenticated;
  do $body$ begin perform public.create_organization(%L,'EGP'); end $body$;
  reset role;
  select app.seed_chart_of_accounts((select id from public.organizations where name=%L));
  insert into public.accounting_periods (
    organization_id,fiscal_year_start,fiscal_year_end,start_date,end_date,created_by,status_changed_by
  ) select id,'2026-01-01','2026-12-31','2026-01-01','2026-12-31',
      %L,%L from public.organizations where name=%L;
  create or replace function public.test_period_race_post(p_org uuid,p_debit uuid,p_credit uuid,p_key text)
  returns text language plpgsql security definer set search_path='' as $body$
  declare v_id uuid;
  begin
    v_id := app.create_and_post(p_organization_id=>p_org,p_type=>'expense',p_transaction_date=>'2026-06-30',
      p_lines=>jsonb_build_array(
        jsonb_build_object('account_id',p_debit,'side','debit','amount_minor',100),
        jsonb_build_object('account_id',p_credit,'side','credit','amount_minor',100)),
      p_description=>'Period race',p_idempotency_key=>p_key);
    return 'posted:'||v_id::text;
  exception when others then return sqlstate||':'||sqlerrm; end $body$;
$setup$, user_id, 'period-race-' || user_id::text || '@test.local',
  jsonb_build_object('sub',user_id,'role','authenticated')::text,
  organization_name, organization_name, user_id, user_id, organization_name))
from period_fixture;
select extensions.dblink_disconnect('period_setup');

create temp table race_ids as
select o.id org,
  (select id from public.accounting_periods where organization_id=o.id) period,
  (select id from public.accounts where organization_id=o.id and type='expense' and account_role='posting' order by code limit 1) debit,
  (select id from public.accounts where organization_id=o.id and system_key='cash') credit
from public.organizations o cross join period_fixture f where o.name=f.organization_name;

select extensions.dblink_connect('period_race_1', format('host=%s port=%s dbname=postgres user=postgres password=postgres',inet_server_addr(),inet_server_port()));
select extensions.dblink_connect('period_race_2', format('host=%s port=%s dbname=postgres user=postgres password=postgres',inet_server_addr(),inet_server_port()));
select extensions.dblink_exec('period_race_1','set app.bypass_authz=on; begin');
select extensions.dblink_exec('period_race_2','set app.bypass_authz=on');

-- Post wins: it owns the organization settings lock, so close waits.
select extensions.dblink_exec('period_race_1',format(
  $q$do $body$ begin perform app.assert_accounting_period_allows(%L,'2026-06-30','expense','manual',null); end $body$$q$,
  (select org from race_ids)));
select extensions.dblink_send_query('period_race_2',format(
  'select public.transition_accounting_period(%L,%L)',(select period from race_ids),'soft_closed'));
select pg_sleep(0.15);
select is(extensions.dblink_is_busy('period_race_2'),1,'close waits while a posting holds the organization period lock');
select outcome from extensions.dblink('period_race_1',format(
  'select public.test_period_race_post(%L,%L,%L,%L)',(select org from race_ids),(select debit from race_ids),(select credit from race_ids),'race-post-first'))
  as result(outcome text);
select extensions.dblink_exec('period_race_1','commit');
select period_id from extensions.dblink_get_result('period_race_2') as result(period_id uuid);
select extensions.dblink_get_result('period_race_2');
select is((select count(*) from public.transactions where organization_id=(select org from race_ids) and idempotency_key='race-post-first'),1::bigint,
  'posting commits once before the waiting close');
select is((select status from public.accounting_periods where id=(select period from race_ids)),'soft_closed'::public.accounting_period_status,
  'waiting close succeeds after the first posting commits');

-- Close wins: the queued post rechecks after the lock and is rejected.
select outcome from extensions.dblink('period_race_1',format(
  'select public.transition_accounting_period(%L,%L,%L)',(select period from race_ids),'open','prepare inverse race'))
  as result(outcome uuid);
select extensions.dblink_exec('period_race_1','begin');
select outcome from extensions.dblink('period_race_1',format(
  'select public.transition_accounting_period(%L,%L)',(select period from race_ids),'soft_closed'))
  as result(outcome uuid);
select extensions.dblink_send_query('period_race_2',format(
  'select public.test_period_race_post(%L,%L,%L,%L)',(select org from race_ids),(select debit from race_ids),(select credit from race_ids),'race-close-first'));
select pg_sleep(0.15);
select is(extensions.dblink_is_busy('period_race_2'),1,'posting waits while close holds the organization period lock');
select extensions.dblink_exec('period_race_1','commit');
create temp table rejected_outcome as
select outcome from extensions.dblink_get_result('period_race_2') as result(outcome text);
select extensions.dblink_get_result('period_race_2');
select ok((select outcome from rejected_outcome) like '42501:ACCOUNTING_PERIOD_SOFT_CLOSED:%','queued normal posting rechecks and is rejected after close');
select is((select count(*) from public.transactions where organization_id=(select org from race_ids) and idempotency_key='race-close-first'),0::bigint,
  'close-first race leaves no transaction');
select is((select count(*) from public.transaction_entries e join public.transactions t on t.id=e.transaction_id
  where t.organization_id=(select org from race_ids) and t.idempotency_key='race-close-first'),0::bigint,
  'close-first race leaves no entries');
select is((select status from public.accounting_periods where id=(select period from race_ids)),'soft_closed'::public.accounting_period_status,
  'close-first race leaves the period closed');

select extensions.dblink_disconnect('period_race_1');
select extensions.dblink_disconnect('period_race_2');
select * from finish();
rollback;
