-- Disposable local fixtures only; no hosted database execution.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data)
select ('d0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'admin-test-'||n||'@example.test',
  '{"full_name":"Operator boundary fixture","platform_role":"billing_operator","role":"admin"}'::jsonb from generate_series(1,7) n;
insert into app.platform_operators(user_id,role,enabled) values
('d0000000-0000-4000-8000-000000000003','observer',true),
('d0000000-0000-4000-8000-000000000004','billing_operator',true),
('d0000000-0000-4000-8000-000000000005','billing_operator',false);
insert into app.manual_payment_configuration(instructions) values('Synthetic recipient') on conflict(singleton) do nothing;
create temp table admin_ids(key text primary key,id uuid);
grant all on admin_ids to authenticated,service_role;
select set_config('request.jwt.claims','{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into admin_ids values('org1',public.create_organization('Operator tenant one','EGP')),('payment',gen_random_uuid()),('evidence',gen_random_uuid()),('command',gen_random_uuid());
select public.prepare_manual_payment((select id from admin_ids where key='payment'),(select id from admin_ids where key='org1'),'solo','monthly');
reset role;
select set_config('request.jwt.claims','{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
insert into admin_ids values('org2',public.create_organization('Operator tenant two','EGP')),('payment2',gen_random_uuid());
select public.prepare_manual_payment((select id from admin_ids where key='payment2'),(select id from admin_ids where key='org2'),'solo','monthly');
reset role;
insert into public.organization_members(organization_id,user_id,role)
select id,'d0000000-0000-4000-8000-000000000006','admin' from admin_ids where key='org1';
insert into public.organization_members(organization_id,user_id,role)
select id,'d0000000-0000-4000-8000-000000000007','accountant' from admin_ids where key='org2';
insert into storage.objects(bucket_id,name,metadata)
select 'manual-payment-receipts',o.id::text||'/'||p.id::text||'/'||e.id::text,'{"size":100,"mimetype":"image/png"}'::jsonb
from admin_ids o,admin_ids p,admin_ids e where o.key='org1' and p.key='payment' and e.key='evidence';
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select public.submit_manual_payment((select id from admin_ids where key='payment'),(select id from admin_ids where key='evidence'),
'd0000000-0000-4000-8000-000000000001','receipt.png',repeat('a',64),'Synthetic receipt');
reset role;

select ok(to_regprocedure('public.review_manual_payment(uuid,uuid,text,text)') is null,'legacy unaudited review API retired');
select ok(not has_function_privilege('authenticated','app.review_manual_payment(uuid,uuid,text,text)','EXECUTE'),'private billing implementation cannot be invoked directly');
select ok(not has_function_privilege('service_role','public.platform_admin_review_payment(uuid,uuid,uuid,text,text,text)','EXECUTE'),'service key is not operator authority');
select ok(not has_function_privilege('anon','public.platform_admin_read(text,integer,integer,uuid)','EXECUTE'),'anonymous cannot call global read');
select ok(not has_function_privilege('anon','public.platform_admin_review_payment(uuid,uuid,uuid,text,text,text)','EXECUTE'),'anonymous cannot call commands');
select ok(not has_table_privilege('authenticated','app.platform_operators','INSERT'),'tenant cannot provision operator');
select ok(not has_table_privilege('authenticated','app.platform_operator_audit','SELECT'),'audit table inaccessible directly');
select ok(not has_table_privilege('service_role','app.platform_operator_audit','UPDATE'),'service cannot rewrite audit');

-- Every global endpoint/resource, with both existing cross-tenant and unknown targets,
-- denies owners/admins/accountants/disabled operators despite forged user metadata.
create function pg_temp.denial_matrix() returns boolean language plpgsql as $$
declare n integer; resource text; target uuid; result jsonb;
begin
  foreach n in array array[1,2,5,6,7] loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub','d0000000-0000-4000-8000-'||lpad(n::text,12,'0'),
      'role','authenticated','user_metadata',jsonb_build_object('platform_role','billing_operator'))::text,true);
    foreach resource in array array['identity','users','organizations','subscriptions','payments','payment_evidence','audit','status','support'] loop
      for target in select id from admin_ids where key in ('org1','org2','payment','payment2') union all select gen_random_uuid() loop
        result:=public.platform_admin_read(resource,0,50,target);
        if result->>'error' is distinct from 'OPERATOR_REQUIRED' or result ? 'data' then return false; end if;
      end loop;
    end loop;
    for target in select id from admin_ids where key in ('payment','payment2') union all select gen_random_uuid() loop
      result:=public.platform_admin_review_payment(gen_random_uuid(),target,(select id from admin_ids where key='evidence'),'approved','Unauthorized','Cross-tenant attempt');
      if result->>'error' is distinct from 'OPERATOR_REQUIRED' or result ? 'data' then return false; end if;
    end loop;
  end loop;
  return true;
end;$$;
set local role authenticated;
select ok(pg_temp.denial_matrix(),'all global reads/commands deny all tenant roles, disabled operators and forged metadata across tenants');
reset role;
select is((select count(*) from app.platform_operator_audit where outcome='rejected'),240::bigint,'all 240 matrix denials persist in audit');
select ok(not exists(select 1 from app.platform_operator_audit where outcome='rejected' and (before_state is not null or after_state is not null)),'authorization denial does not load target state');

select set_config('request.jwt.claims','{"sub":"d0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is(public.platform_admin_read('identity')#>>'{data,0,role}','observer','explicit observer role');
select is((select count(*) from jsonb_array_elements(public.platform_admin_read('organizations')->'data') r where (r->>'id')::uuid in (select id from admin_ids where key in ('org1','org2'))),2::bigint,'observer sees both organization summaries');
select is(jsonb_array_length(public.platform_admin_read('payments')->'data'),2,'observer sees both payment summaries');
select ok(not ((public.platform_admin_read('organizations')#>'{data,0}') ?| array['tax_identifier','legal_name']),'organization projection omits tax and unrelated details');
select ok(not ((public.platform_admin_read('users')#>'{data,0}') ?| array['encrypted_password','raw_user_meta_data','default_organization_id']),'user projection contains no auth secrets or tenant preferences');
select is(public.platform_admin_read('status')#>>'{data,0,support_available}','false','missing support subsystem explicit');
select is(public.platform_admin_read('status')#>>'{data,0,pending_payments}','1','operational pending count');
select is(jsonb_array_length(public.platform_admin_read('support')->'data'),0,'no fabricated support data');
select is(public.platform_admin_read('transactions')->>'error','ADMIN_READ_INVALID','no raw table editor/read selector');
select is(public.platform_admin_read('users',-1)->>'error','ADMIN_READ_INVALID','negative offset denied');
select is(public.platform_admin_read('users',0,101)->>'error','ADMIN_READ_INVALID','oversized page denied');
select is(public.platform_admin_read('payment_evidence')->>'error','ADMIN_READ_INVALID','receipt read needs exact target');
select is(jsonb_array_length(public.platform_admin_read('users',0,2)->'data'),2,'page size bounded');
select ok(public.platform_admin_read('users',0,2)#>>'{data,0,id}' <> public.platform_admin_read('users',2,2)#>>'{data,0,id}','pagination advances');
select is(public.platform_admin_read('payment_evidence',0,50,(select id from admin_ids where key='payment'))#>>'{data,0,id}',(select id::text from admin_ids where key='evidence'),'audited evidence read resolves only current receipt');
select is((select count(*) from public.manual_payment_evidence),0::bigint,'operator cannot bypass audited evidence read');
select is((select count(*) from storage.objects where bucket_id='manual-payment-receipts'),0::bigint,'operator cannot bypass audited receipt endpoint');
select is((select count(*) from public.transactions),0::bigint,'operator identity gains no financial table authority');
select is(public.platform_admin_review_payment(gen_random_uuid(),(select id from admin_ids where key='payment'),(select id from admin_ids where key='evidence'),'approved','Observer approval','Case') ->>'error','OPERATOR_REQUIRED','observer cannot mutate');
reset role;

select set_config('request.jwt.claims','{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is(public.platform_admin_review_payment(gen_random_uuid(),(select id from admin_ids where key='payment'),(select id from admin_ids where key='evidence'),'approved',' ','Case')->>'error','ADMIN_COMMAND_INVALID','reason mandatory');
select is(public.platform_admin_review_payment(gen_random_uuid(),(select id from admin_ids where key='payment'),(select id from admin_ids where key='evidence'),'approved','Verified',' ')->>'error','ADMIN_COMMAND_INVALID','context mandatory');
select is(public.platform_admin_review_payment(gen_random_uuid(),(select id from admin_ids where key='payment'),(select id from admin_ids where key='evidence'),'approved',E'\t\n','Case')->>'error','ADMIN_COMMAND_INVALID','whitespace-only reason denied');
select is(public.platform_admin_review_payment(gen_random_uuid(),(select id from admin_ids where key='payment'),(select id from admin_ids where key='evidence'),'approved','Verified',repeat('x',1001))->>'error','ADMIN_COMMAND_INVALID','oversized context denied');
select is(public.platform_admin_review_payment(gen_random_uuid(),(select id from admin_ids where key='payment'),gen_random_uuid(),'approved','Verified','Case')->>'error','MANUAL_PAYMENT_STALE_EVIDENCE','stale evidence denied');
select is(public.platform_admin_review_payment(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'approved','Verified','Case')->>'error','ADMIN_TARGET_NOT_FOUND','unknown target bounded failure');
select is(public.platform_admin_review_payment(gen_random_uuid(),(select id from admin_ids where key='payment'),(select id from admin_ids where key='evidence'),'impersonate','Verified','Case')->>'error','ADMIN_COMMAND_INVALID','no impersonation/arbitrary command');
select is(public.platform_admin_review_payment((select id from admin_ids where key='command'),(select id from admin_ids where key='payment'),(select id from admin_ids where key='evidence'),'approved','Bank verified','Case 42')#>>'{data,payment,status}','approved','billing operator approves through bounded command');
select is(public.platform_admin_review_payment((select id from admin_ids where key='command'),(select id from admin_ids where key='payment'),(select id from admin_ids where key='evidence'),'approved','Bank verified','Case 42')->>'replayed','true','exact retry replayed');
select is(public.platform_admin_review_payment((select id from admin_ids where key='command'),(select id from admin_ids where key='payment2'),(select id from admin_ids where key='evidence'),'approved','Bank verified','Case 42')->>'error','ADMIN_COMMAND_KEY_REUSED','key cannot retarget tenant');
select is(public.platform_admin_review_payment(gen_random_uuid(),(select id from admin_ids where key='payment'),(select id from admin_ids where key='evidence'),'rejected','Change approved','Case 43')->>'error','MANUAL_PAYMENT_INVALID_STATE','approved request cannot be reversed via review');
reset role;
select is((select count(*) from public.manual_payment_history where request_id=(select id from admin_ids where key='payment') and after_state='approved'),1::bigint,'one billing approval event');
select is((select period_end from public.manual_payment_requests where id=(select id from admin_ids where key='payment')),now()+interval '1 month','same purchased month after retries');
select is((select before_state#>>'{payment,status}' from app.platform_operator_audit where command_id=(select id from admin_ids where key='command') and outcome='succeeded'),'submitted','audit before state');
select is((select after_state#>>'{subscription,provider}' from app.platform_operator_audit where command_id=(select id from admin_ids where key='command') and outcome='succeeded'),'manual','audit after subscription state');
select is((select context from app.platform_operator_audit where command_id=(select id from admin_ids where key='command') and outcome='succeeded'),'Case 42','operator context retained');
select is((select actor_id::text from app.platform_operator_audit where command_id=(select id from admin_ids where key='command') and outcome='succeeded'),'d0000000-0000-4000-8000-000000000004','audit actor is authenticated caller');
select ok(exists(select 1 from app.platform_operator_audit where error_code='MANUAL_PAYMENT_STALE_EVIDENCE' and before_state=after_state),'rejected domain command records unchanged state');
select throws_ok($$update app.platform_operator_audit set reason='tampered'$$,'42501','OPERATOR_AUDIT_IMMUTABLE','audit cannot be updated');
select throws_ok($$delete from app.platform_operator_audit$$,'42501','OPERATOR_AUDIT_IMMUTABLE','audit cannot be deleted');
select throws_ok($$truncate app.platform_operator_audit$$,'42501','OPERATOR_AUDIT_IMMUTABLE','audit cannot be truncated');
update app.platform_operators set enabled=false where user_id='d0000000-0000-4000-8000-000000000004';
set local role authenticated;
select is(public.platform_admin_review_payment((select id from admin_ids where key='command'),(select id from admin_ids where key='payment'),(select id from admin_ids where key='evidence'),'approved','Bank verified','Case 42')->>'error','OPERATOR_REQUIRED','revocation also blocks successful replay');
reset role;
update app.platform_operators set enabled=true where user_id='d0000000-0000-4000-8000-000000000004';
insert into public.organization_members(organization_id,user_id,role) select id,'d0000000-0000-4000-8000-000000000004','viewer' from admin_ids where key='org2';
set local role authenticated;
select is(public.platform_admin_read('users')->>'error','OPERATOR_REQUIRED','mixed tenant/operator identity denied globally');
select is(public.platform_admin_review_payment(gen_random_uuid(),(select id from admin_ids where key='payment'),(select id from admin_ids where key='evidence'),'approved','Mixed identity','Case')->>'error','OPERATOR_REQUIRED','membership in another tenant also blocks commands');
reset role;
select set_config('request.jwt.claims','{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from public.manual_payment_requests),1::bigint,'tenant billing read preserved and other tenant hidden');
select is((select count(*) from storage.objects where bucket_id='manual-payment-receipts'),1::bigint,'tenant receipt access preserved');
select * from finish();
rollback;
