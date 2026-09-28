-- Disposable local fixtures only; no hosted database execution.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,email,raw_user_meta_data) values
('e0000000-0000-4000-8000-000000000001','alpha-owner@example.test','{"full_name":"Alpha Owner"}'),
('e0000000-0000-4000-8000-000000000002','beta-owner@example.test','{"full_name":"Beta Owner"}'),
('e0000000-0000-4000-8000-000000000003','admin@example.test','{"full_name":"Dedicated Admin","platform_role":"forged"}'),
('e0000000-0000-4000-8000-000000000004','billing@example.test','{"full_name":"Billing Only"}');
insert into app.platform_operators(user_id,role) values
('e0000000-0000-4000-8000-000000000003','platform_admin'),
('e0000000-0000-4000-8000-000000000004','billing_operator');
create temp table operation_ids(key text primary key,id uuid);
grant all on operation_ids to authenticated,service_role;

select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into operation_ids values('org1',public.create_organization('Operational Alpha','EGP'));
reset role;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
insert into operation_ids values('org2',public.create_organization('Operational Beta','EGP'));
reset role;

update public.subscriptions s set plan_id=p.id,price_id=price.id,status='active',provider='manual',provider_subscription_id='manual-fixture',
  provider_status='active',billing_interval='monthly',current_period_start=now(),current_period_end=now()+interval '1 month',checkout_completed_at=now()
from public.subscription_plans p join public.subscription_plan_prices price on price.plan_id=p.id and price.interval='monthly' and price.currency_code='EGP' and price.is_active
where s.organization_id=(select id from operation_ids where key='org1') and p.key='solo';
update public.subscriptions set status='active',provider='paymob',provider_subscription_id='provider-fixture',provider_status='active',
  billing_interval='monthly',current_period_start=now(),current_period_end=now()+interval '1 month',checkout_completed_at=now()
where organization_id=(select id from operation_ids where key='org2');
with request as (
  insert into public.support_requests(organization_id,requester_id,requester_email,subject,customer_message,priority)
  select (select id from operation_ids where key='org1'),'e0000000-0000-4000-8000-000000000001','alpha-owner@example.test','Cannot post','Original customer message','high'
  returning id
) insert into operation_ids select 'support',id from request;
insert into operation_ids values
('access_suspend',gen_random_uuid()),('access_reactivate',gen_random_uuid()),('subscription',gen_random_uuid()),
('unsafe_subscription',gen_random_uuid()),('support_start',gen_random_uuid()),('support_wait',gen_random_uuid()),
('support_remind',gen_random_uuid()),('support_close',gen_random_uuid());

select ok(not has_function_privilege('anon','public.platform_admin_set_access(uuid,uuid,text,text,text)','EXECUTE'),'anonymous cannot change access');
select ok(not has_function_privilege('service_role','public.platform_admin_correct_subscription(uuid,uuid,text,text,text)','EXECUTE'),'service key cannot correct subscriptions');
select ok(not has_function_privilege('service_role','public.platform_admin_update_support(uuid,uuid,text,text,text)','EXECUTE'),'service key cannot manage support');
select ok(not has_table_privilege('authenticated','public.support_requests','SELECT'),'support messages are not directly readable');
select ok(not has_table_privilege('service_role','app.platform_access_overrides','UPDATE'),'service key cannot rewrite access overrides');

-- Tenant authority and forged metadata never become platform authority.
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"platform_role":"platform_admin"}}',true);
set local role authenticated;
select is(public.platform_admin_set_access(gen_random_uuid(),(select id from operation_ids where key='org1'),'suspend','Tenant attempt','Case')->>'error','OPERATOR_REQUIRED','tenant owner cannot suspend access');
select is(public.platform_admin_correct_subscription(gen_random_uuid(),(select id from operation_ids where key='org1'),'business','Tenant attempt','Case')->>'error','OPERATOR_REQUIRED','tenant owner cannot correct subscription');
select is(public.platform_admin_update_support(gen_random_uuid(),(select id from operation_ids where key='support'),'close','Tenant attempt','Case')->>'error','OPERATOR_REQUIRED','tenant owner cannot manage support');
reset role;

-- A payment-only operator cannot use the broader administration commands.
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is(public.platform_admin_set_access(gen_random_uuid(),(select id from operation_ids where key='org1'),'suspend','Billing attempt','Case')->>'error','OPERATOR_REQUIRED','billing operator cannot suspend access');
select is(public.platform_admin_update_support(gen_random_uuid(),(select id from operation_ids where key='support'),'close','Billing attempt','Case')->>'error','OPERATOR_REQUIRED','billing operator cannot manage support');
reset role;

select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select ok(app.is_manual_payment_operator((select id from operation_ids where key='org1')),'platform admin inherits audited manual-payment authority');
set local role authenticated;
select is(public.platform_admin_read('identity')#>>'{data,0,role}','platform_admin','explicit platform admin role');
select is(jsonb_array_length(public.platform_admin_read('organizations',0,50,null,'Operational Alpha',null)->'data'),1,'organization search is applied server-side');
select is(public.platform_admin_read('organizations',0,50,null,'Operational Alpha',null)#>>'{data,0,member_count}','1','organization summary includes membership state');
select is(jsonb_array_length(public.platform_admin_read('users',0,1)->'data'),1,'user pagination is bounded');
select ok(public.platform_admin_read('users',0,1)#>>'{data,0,id}'<>public.platform_admin_read('users',1,1)#>>'{data,0,id}','user pagination advances');
select is(jsonb_array_length(public.platform_admin_read('memberships',0,50,(select id from operation_ids where key='org1'))->'data'),1,'organization membership inspection is scoped');
select is(public.platform_admin_read('subscriptions',0,50,(select id from operation_ids where key='org1'))#>>'{data,0,access_state}','active','subscription projection includes effective access');
select is(public.platform_admin_read('support',0,50,null,null,'high')#>>'{data,0,customer_message}','Original customer message','support queue preserves and exposes customer message');
select is(public.platform_admin_read('status')#>>'{data,0,support_reminder_delivery}','not_configured','queue represents missing reminder delivery');

select is(public.platform_admin_set_access((select id from operation_ids where key='access_suspend'),(select id from operation_ids where key='org1'),'suspend','Security hold','Case ACCESS-1')#>>'{data,access,state}','read_only','suspension changes effective access only');
select is(public.platform_admin_read('subscriptions',0,50,(select id from operation_ids where key='org1'))#>>'{data,0,status}','active','suspension does not rewrite subscription status');
select is(public.platform_admin_set_access((select id from operation_ids where key='access_suspend'),(select id from operation_ids where key='org1'),'suspend','Security hold','Case ACCESS-1')->>'replayed','true','access command retry is idempotent');
select is(public.platform_admin_set_access((select id from operation_ids where key='access_reactivate'),(select id from operation_ids where key='org1'),'reactivate','Hold cleared','Case ACCESS-2')#>>'{data,access,state}','active','reactivation restores provider-derived access');

select is(public.platform_admin_correct_subscription((select id from operation_ids where key='subscription'),(select id from operation_ids where key='org1'),'starter','Corrected quoted plan','Case SUB-1')#>>'{data,subscription,plan_key}','starter','manual subscription plan correction succeeds');
select is(public.platform_admin_read('subscriptions',0,50,(select id from operation_ids where key='org1'))#>>'{data,0,provider}','manual','correction preserves provider');
select is(public.platform_admin_correct_subscription((select id from operation_ids where key='unsafe_subscription'),(select id from operation_ids where key='org2'),'business','Provider correction','Case SUB-2')->>'error','ADMIN_PROVIDER_CHANGE_UNSAFE','provider-managed change remains blocked');

select is(public.platform_admin_update_support((select id from operation_ids where key='support_start'),(select id from operation_ids where key='support'),'start','Investigating','Case SUP-1')#>>'{data,status}','in_progress','support work can start');
select is(public.platform_admin_update_support((select id from operation_ids where key='support_wait'),(select id from operation_ids where key='support'),'wait_customer','Need details','Case SUP-1')#>>'{data,status}','waiting_customer','support can wait for customer');
select is(public.platform_admin_update_support((select id from operation_ids where key='support_remind'),(select id from operation_ids where key='support'),'remind','Reminder requested','Case SUP-1')#>>'{data,reminder_delivery_status}','not_configured','reminder request records unavailable delivery');
select is(public.platform_admin_update_support((select id from operation_ids where key='support_close'),(select id from operation_ids where key='support'),'close','Handled offline','Case SUP-1')#>>'{data,status}','closed','support request can close');
reset role;

select is((select customer_message from public.support_requests where id=(select id from operation_ids where key='support')),'Original customer message','operator actions never rewrite customer message');
select throws_ok($$update public.support_requests set customer_message='tampered' where id=(select id from operation_ids where key='support')$$,'42501','SUPPORT_REQUEST_CONTENT_IMMUTABLE','customer support message is immutable');
select is((select count(*) from app.platform_operator_audit where command_id in (select id from operation_ids where key in ('access_suspend','access_reactivate','subscription','support_start','support_wait','support_remind','support_close')) and outcome='succeeded'),7::bigint,'every successful mutation has one command audit');
select ok(not exists(select 1 from app.platform_operator_audit where command_id in (select id from operation_ids) and outcome='succeeded' and (actor_id is null or reason is null or context is null or before_state is null or after_state is null or target_id is null)),'mutation audit records actor, reason, before, after and linked target');
select is((select count(*) from public.transactions),0::bigint,'bounded admin operations do not create or mutate posted financial history');
select ok(exists(select 1 from app.platform_operator_audit where command_id=(select id from operation_ids where key='unsafe_subscription') and error_code='ADMIN_PROVIDER_CHANGE_UNSAFE' and before_state=after_state),'blocked provider correction is audited with unchanged state');

select * from finish();
rollback;
