-- LS-FIX-001: two independent sessions serialize one fiscal-year sequence.
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(8);

create temp table sequence_race_fixture as
select gen_random_uuid() user_id,
  'Journal Sequence Race ' || gen_random_uuid()::text organization_name;

select extensions.dblink_connect('sequence_setup', format(
  'host=%s port=%s dbname=postgres user=postgres password=postgres',
  inet_server_addr(), inet_server_port()
));
select extensions.dblink_exec('sequence_setup', format($setup$
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    %L, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', %L,
    extensions.crypt('password', extensions.gen_salt('bf')), now(), '{}', '{}', now(), now()
  );
  set request.jwt.claims = %L;
  set role authenticated;
  do $body$ begin
    perform public.create_organization(
      %L, 'EGP', 'EG', 'Africa/Cairo', p_fiscal_year_start_month => 4::smallint
    );
  end $body$;
  reset role;
  update public.subscriptions
  set status = 'active', provider = 'paymob',
      provider_subscription_id = 'journal_sequence_race',
      provider_status = 'active', billing_interval = 'monthly',
      checkout_completed_at = now(), current_period_start = now(),
      current_period_end = now() + interval '30 days'
  where organization_id = (select id from public.organizations where name = %L);
  select app.seed_chart_of_accounts(
    (select id from public.organizations where name = %L)
  );
  create or replace function public.test_sequence_race_post(
    p_org uuid, p_debit uuid, p_credit uuid, p_key text
  ) returns text
  language plpgsql security definer set search_path = '' as $body$
  declare v_id uuid; v_reference text;
  begin
    v_id := app.create_and_post(
      p_organization_id => p_org,
      p_type => 'adjustment',
      p_transaction_date => date '2025-06-30',
      p_lines => jsonb_build_array(
        jsonb_build_object('account_id', p_debit, 'side', 'debit', 'amount_minor', 100),
        jsonb_build_object('account_id', p_credit, 'side', 'credit', 'amount_minor', 100)
      ),
      p_description => 'Concurrent sequence fixture',
      p_adjustment_reason => 'LS-FIX-001',
      p_idempotency_key => p_key
    );
    select journal_reference into v_reference
    from public.transactions where id = v_id;
    return v_id::text || '|' || v_reference;
  end;
  $body$;
$setup$,
  user_id,
  'journal-sequence-race-' || user_id::text || '@test.local',
  jsonb_build_object('sub', user_id, 'role', 'authenticated')::text,
  organization_name, organization_name, organization_name
)) from sequence_race_fixture;
select extensions.dblink_disconnect('sequence_setup');

create temp table sequence_race_ids as
select organization.id organization_id,
  (select id from public.accounts
   where organization_id = organization.id and system_key = 'bank') debit_account_id,
  (select id from public.accounts
   where organization_id = organization.id and system_key = 'owner_capital') credit_account_id
from public.organizations organization
cross join sequence_race_fixture fixture
where organization.name = fixture.organization_name;

select extensions.dblink_connect('sequence_race_1', format(
  'host=%s port=%s dbname=postgres user=postgres password=postgres',
  inet_server_addr(), inet_server_port()
));
select extensions.dblink_connect('sequence_race_2', format(
  'host=%s port=%s dbname=postgres user=postgres password=postgres',
  inet_server_addr(), inet_server_port()
));
select extensions.dblink_exec('sequence_race_1', 'set app.bypass_authz=on; begin');
select extensions.dblink_exec('sequence_race_2', 'set app.bypass_authz=on');

create temp table first_sequence_outcome as
select outcome
from extensions.dblink('sequence_race_1', format(
  'select public.test_sequence_race_post(%L,%L,%L,%L)',
  (select organization_id from sequence_race_ids),
  (select debit_account_id from sequence_race_ids),
  (select credit_account_id from sequence_race_ids),
  'sequence-race-first'
)) as result(outcome text);

select extensions.dblink_send_query('sequence_race_2', format(
  'select public.test_sequence_race_post(%L,%L,%L,%L)',
  (select organization_id from sequence_race_ids),
  (select debit_account_id from sequence_race_ids),
  (select credit_account_id from sequence_race_ids),
  'sequence-race-second'
));
select pg_sleep(0.15);
select is(
  extensions.dblink_is_busy('sequence_race_2'), 1,
  'an independent post waits on the same organization/fiscal-year counter'
);

select extensions.dblink_exec('sequence_race_1', 'commit');
create temp table second_sequence_outcome as
select outcome
from extensions.dblink_get_result('sequence_race_2') as result(outcome text);
select extensions.dblink_get_result('sequence_race_2');

select is(
  split_part((select outcome from first_sequence_outcome), '|', 2),
  'JRN-2026-000001',
  'the first committed session receives the first number'
);
select is(
  split_part((select outcome from second_sequence_outcome), '|', 2),
  'JRN-2026-000002',
  'the waiting independent session receives the next number'
);
select isnt(
  split_part((select outcome from first_sequence_outcome), '|', 1),
  split_part((select outcome from second_sequence_outcome), '|', 1),
  'independent concurrent posts create distinct journals'
);
select isnt(
  split_part((select outcome from first_sequence_outcome), '|', 2),
  split_part((select outcome from second_sequence_outcome), '|', 2),
  'independent concurrent posts cannot share a journal number'
);

create temp table retry_sequence_outcome as
select outcome
from extensions.dblink('sequence_race_2', format(
  'select public.test_sequence_race_post(%L,%L,%L,%L)',
  (select organization_id from sequence_race_ids),
  (select debit_account_id from sequence_race_ids),
  (select credit_account_id from sequence_race_ids),
  'sequence-race-first'
)) as result(outcome text);
select is(
  (select outcome from retry_sequence_outcome),
  (select outcome from first_sequence_outcome),
  'an equal retry returns the same journal and reference'
);
select is(
  (select count(*) from public.transactions
   where organization_id = (select organization_id from sequence_race_ids)
     and status = 'posted'),
  2::bigint,
  'the two posts plus retry leave exactly two posted journals'
);
select is(
  (select last_number from app.journal_number_sequences
   where organization_id = (select organization_id from sequence_race_ids)
     and fiscal_year_start = date '2025-04-01'),
  2,
  'the equal retry does not consume another sequence number'
);

select extensions.dblink_disconnect('sequence_race_1');
select extensions.dblink_disconnect('sequence_race_2');
select * from finish();
rollback;
