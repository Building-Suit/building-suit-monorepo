-- Disposable local fixtures only. All mutations roll back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Adapt the former row-returning contract to the audited envelope while retaining
-- the original billing semantic assertions. Only test code rethrows rejections.
create function pg_temp.review_manual_payment(r uuid,e uuid,a text,reason text)
returns public.manual_payment_requests language plpgsql as $$
declare result jsonb;
begin
  result:=public.platform_admin_review_payment(gen_random_uuid(),r,e,a,reason,'LS-BILL-002 regression');
  if not (result->>'ok')::boolean then
    raise exception '%',result->>'error' using errcode=case when result->>'error'='OPERATOR_REQUIRED' then '42501' else '22023' end;
  end if;
  return jsonb_populate_record(null::public.manual_payment_requests,result#>'{data,payment}');
end;$$;
insert into auth.users(id,email,raw_user_meta_data) values
('c0000000-0000-4000-8000-000000000001','manual-owner@example.test','{"full_name":"Manual Owner"}'),
('c0000000-0000-4000-8000-000000000002','manual-other@example.test','{"full_name":"Manual Other"}'),
('c0000000-0000-4000-8000-000000000003','manual-operator@example.test','{"full_name":"Manual Operator"}');
create temp table manual_ids(key text primary key,id uuid);
grant all on manual_ids to authenticated,service_role;
insert into app.manual_payment_configuration(instructions) values('Test recipient only: test@instapay') on conflict(singleton) do update set instructions=excluded.instructions;
insert into app.platform_operators(user_id,role) values('c0000000-0000-4000-8000-000000000003','billing_operator');
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into manual_ids values('org',public.create_organization('Manual billing test','EGP')),('request',gen_random_uuid()),('evidence',gen_random_uuid()),('replacement',gen_random_uuid());
select throws_ok(format('select public.prepare_manual_payment(%L,%L,%L,%L)',gen_random_uuid(),(select id from manual_ids where key='org'),'scale','monthly'),'22023','PLAN_NOT_AVAILABLE','unapproved plan denied');
select is((public.prepare_manual_payment((select id from manual_ids where key='request'),(select id from manual_ids where key='org'),'starter','yearly')).amount_minor,488784::bigint,'server resolves exact catalog amount');
select is((public.prepare_manual_payment((select id from manual_ids where key='request'),(select id from manual_ids where key='org'),'starter','yearly')).status,'draft','quote retry idempotent');
select throws_ok(format('select public.prepare_manual_payment(%L,%L,%L,%L)',(select id from manual_ids where key='request'),(select id from manual_ids where key='org'),'business','yearly'),'22023','MANUAL_PAYMENT_KEY_REUSED','cannot change quoted plan');
select ok(not has_table_privilege('authenticated','public.manual_payment_requests','UPDATE'),'browser cannot tamper with amount or status');
select ok(not has_function_privilege('authenticated','public.submit_manual_payment(uuid,uuid,uuid,text,text,text)','EXECUTE'),'browser cannot forge upload metadata');
select throws_ok(format('select pg_temp.review_manual_payment(%L,%L,%L,%L)',(select id from manual_ids where key='request'),(select id from manual_ids where key='evidence'),'approved','self approval'),'42501','OPERATOR_REQUIRED','tenant cannot approve');
select throws_ok($$insert into storage.objects(bucket_id,name) values('manual-payment-receipts','forged')$$,'42501',null,'browser cannot bypass file validation');
reset role;
-- Mimic the validated Storage API upload; no real object bytes are needed in SQL.
insert into storage.objects(bucket_id,name,metadata)
select 'manual-payment-receipts',o.id::text||'/'||r.id::text||'/'||e.id::text,'{"size":100,"mimetype":"image/png"}'::jsonb
from manual_ids o,manual_ids r,manual_ids e where o.key='org' and r.key='request' and e.key='evidence';
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is((public.submit_manual_payment((select id from manual_ids where key='request'),(select id from manual_ids where key='evidence'),'c0000000-0000-4000-8000-000000000001','receipt.png',repeat('a',64),'Initial transfer')).status,'submitted','receipt submitted');
select is((public.submit_manual_payment((select id from manual_ids where key='request'),(select id from manual_ids where key='evidence'),'c0000000-0000-4000-8000-000000000001','receipt.png',repeat('a',64),'Retry')).status,'submitted','submission retry idempotent');
reset role;
select throws_ok($$update public.manual_payment_evidence set filename='changed'$$,'42501','MANUAL_PAYMENT_HISTORY_IMMUTABLE','evidence immutable');
select throws_ok($$delete from public.manual_payment_history$$,'42501','MANUAL_PAYMENT_HISTORY_IMMUTABLE','history immutable');
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from public.manual_payment_requests where id=(select id from manual_ids where key='request')),0::bigint,'other tenant cannot read request');
select is((select count(*) from storage.objects where bucket_id='manual-payment-receipts'),0::bigint,'other tenant cannot read private receipt');
reset role;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id='manual-payment-receipts'),0::bigint,'operator receipt reads require audited endpoint');
select is((pg_temp.review_manual_payment((select id from manual_ids where key='request'),(select id from manual_ids where key='evidence'),'under_review','Checking transfer')).status,'under_review','review recorded');
select throws_ok(format('select pg_temp.review_manual_payment(%L,%L,%L,%L)',(select id from manual_ids where key='request'),(select id from manual_ids where key='evidence'),'rejected',''),'22023','ADMIN_COMMAND_INVALID','review needs reason');
select is((pg_temp.review_manual_payment((select id from manual_ids where key='request'),(select id from manual_ids where key='evidence'),'rejected','Unreadable receipt')).status,'rejected','rejected with reason');
reset role;
insert into storage.objects(bucket_id,name,metadata)
select 'manual-payment-receipts',o.id::text||'/'||r.id::text||'/'||e.id::text,'{"size":101,"mimetype":"application/pdf"}'::jsonb
from manual_ids o,manual_ids r,manual_ids e where o.key='org' and r.key='request' and e.key='replacement';
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is((public.submit_manual_payment((select id from manual_ids where key='request'),(select id from manual_ids where key='replacement'),'c0000000-0000-4000-8000-000000000001','replacement.pdf',repeat('b',64),'Clearer receipt')).status,'submitted','replacement submitted');
select is((select count(*) from public.manual_payment_evidence where request_id=(select id from manual_ids where key='request')),2::bigint,'old evidence preserved');
reset role;
-- Even an allowlisted operator cannot review their own organization.
insert into app.platform_operators(user_id,role) values('c0000000-0000-4000-8000-000000000001','billing_operator');
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok(format('select pg_temp.review_manual_payment(%L,%L,%L,%L)',(select id from manual_ids where key='request'),(select id from manual_ids where key='replacement'),'approved','Self review'),'42501','OPERATOR_REQUIRED','operator membership prevents self approval');
reset role;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok(format('select pg_temp.review_manual_payment(%L,%L,%L,%L)',(select id from manual_ids where key='request'),(select id from manual_ids where key='evidence'),'approved','Stale browser'),'22023','MANUAL_PAYMENT_STALE_EVIDENCE','cannot approve old evidence');
select is((pg_temp.review_manual_payment((select id from manual_ids where key='request'),(select id from manual_ids where key='replacement'),'approved','Transfer verified')).status,'approved','operator activates plan');
select is((pg_temp.review_manual_payment((select id from manual_ids where key='request'),(select id from manual_ids where key='replacement'),'approved','Replay')).period_end,now()+interval '1 year','replay cannot extend purchased year');
select is((select count(*) from public.manual_payment_history where request_id=(select id from manual_ids where key='request') and after_state='approved'),0::bigint,'operator history reads require audited endpoint');
reset role;
select is((select count(*) from public.manual_payment_history where request_id=(select id from manual_ids where key='request') and after_state='approved'),1::bigint,'one approval audit');
select is((select provider from public.subscriptions where organization_id=(select id from manual_ids where key='org')),'manual','manual provider distinct from Paymob');
select is((select current_period_end-current_period_start from public.subscriptions where organization_id=(select id from manual_ids where key='org')),(now()+interval '1 year')-now(),'exact purchased period');
select is((select p.key from public.subscription_plans p join public.subscriptions s on s.plan_id=p.id where s.organization_id=(select id from manual_ids where key='org')),'starter','correct entitlement plan');
select is(app.subscription_access_state((select id from manual_ids where key='org')),'active','approved subscription grants active access');
select throws_ok(format('update public.subscriptions set provider=%L where organization_id=%L','paymob',(select id from manual_ids where key='org')),'22023','MANUAL_PAYMENT_SUBSCRIPTION_CONFLICT','in-flight card payment cannot replace approved manual period');

select is((select limit_value from app.resolve_plan_entitlement((select id from manual_ids where key='org'),'max_members')),3::bigint,'starter quota applied');
select is((select is_enabled from app.resolve_plan_entitlement((select id from manual_ids where key='org'),'imports')),true,'starter imports enabled');
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok(format('select public.cancel_manual_payment(%L,%L)',(select id from manual_ids where key='request'),'Changed mind'),'22023','MANUAL_PAYMENT_INVALID_STATE','approved payment cannot be cancelled');
reset role;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
insert into manual_ids values('monthly_org',public.create_organization('Manual monthly billing test','EGP')),('cancelled',gen_random_uuid()),('monthly_request',gen_random_uuid()),('monthly_evidence',gen_random_uuid());
select is((public.prepare_manual_payment((select id from manual_ids where key='cancelled'),(select id from manual_ids where key='monthly_org'),'solo','monthly')).amount_minor,39900::bigint,'monthly catalog quote');
select is((public.cancel_manual_payment((select id from manual_ids where key='cancelled'),'Wrong plan')).status,'cancelled','customer cancellation audited');
select is((public.prepare_manual_payment((select id from manual_ids where key='monthly_request'),(select id from manual_ids where key='monthly_org'),'solo','monthly')).status,'draft','cancelled request does not block new quote');
reset role;
insert into storage.objects(bucket_id,name,metadata)
select 'manual-payment-receipts',o.id::text||'/'||r.id::text||'/'||e.id::text,'{"size":5242881,"mimetype":"image/png"}'::jsonb
from manual_ids o,manual_ids r,manual_ids e where o.key='monthly_org' and r.key='monthly_request' and e.key='monthly_evidence';
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select throws_ok(format('select public.submit_manual_payment(%L,%L,%L,%L,%L,%L)',(select id from manual_ids where key='monthly_request'),(select id from manual_ids where key='monthly_evidence'),'c0000000-0000-4000-8000-000000000002','big.png',repeat('c',64),'Too large'),'23514',null,'database independently rejects oversized evidence');
reset role;
update storage.objects set metadata='{"size":100,"mimetype":"image/svg+xml"}' where name like '%'||(select id::text from manual_ids where key='monthly_evidence');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select throws_ok(format('select public.submit_manual_payment(%L,%L,%L,%L,%L,%L)',(select id from manual_ids where key='monthly_request'),(select id from manual_ids where key='monthly_evidence'),'c0000000-0000-4000-8000-000000000002','bad.svg',repeat('c',64),'Wrong type'),'23514',null,'database independently rejects disallowed MIME');
reset role;
update storage.objects set metadata='{"size":100,"mimetype":"image/png"}' where name like '%'||(select id::text from manual_ids where key='monthly_evidence');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is((public.submit_manual_payment((select id from manual_ids where key='monthly_request'),(select id from manual_ids where key='monthly_evidence'),'c0000000-0000-4000-8000-000000000002','monthly.png',repeat('c',64),'Monthly transfer')).status,'submitted','monthly receipt submitted');
reset role;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((pg_temp.review_manual_payment((select id from manual_ids where key='monthly_request'),(select id from manual_ids where key='monthly_evidence'),'approved','Monthly transfer verified')).period_end,now()+interval '1 month','exact purchased calendar month');

select * from finish();
rollback;
