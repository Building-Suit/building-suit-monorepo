begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000001','auth-a@example.test',now(),false,'{"role":"owner","practice_id":"10000000-0000-0000-0000-000000000002"}'),
('00000000-0000-0000-0000-000000000002','auth-b@example.test',now(),false,'{}');
insert into auth.sessions(id,user_id,not_after) values
('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',now()+interval '1 hour'),
('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',null);
insert into public.doctor_profiles(user_id,display_name) values('00000000-0000-0000-0000-000000000002','Synthetic B');
insert into public.practices(id,owner_user_id,name) values('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Synthetic B');
set local role anon;
select is(public.doctor_runtime_contract()->>'product','doctor-suit','anonymous readiness marker identifies the product');
select is(public.doctor_runtime_contract()->>'data_mode','synthetic','marker does not enable real clinical care');
select throws_ok($$select public.doctor_session_context()$$,'42501',null,'marker does not confer authenticated access');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","session_id":"50000000-0000-0000-0000-000000000001"}',true);
select is(public.doctor_session_context()->>'user_id','00000000-0000-0000-0000-000000000001','context uses the verified actor');
select is(public.doctor_session_context()->>'session_id','50000000-0000-0000-0000-000000000001','context binds current provider session');
select ok(public.doctor_session_context()->>'practice_id' is null,'editable role/practice metadata never assigns ownership');
select ok(not public.doctor_session_context() ?| array['access_token','refresh_token','email','user_metadata'],'context excludes credentials and unnecessary identity payload');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","session_id":"50000000-0000-0000-0000-000000000002"}',true);
select throws_ok($$select public.doctor_session_context()$$,'42501','DOCTOR_AUTH_REQUIRED','another user session cannot authenticate actor');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001"}',true);
select throws_ok($$select public.doctor_session_context()$$,'42501','DOCTOR_AUTH_REQUIRED','missing session is rejected');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","session_id":"malformed"}',true);
select throws_ok($$select public.doctor_session_context()$$,'42501','DOCTOR_AUTH_REQUIRED','malformed session fails with a safe authorization error');
reset role;
update auth.sessions set not_after=now()-interval '1 second' where id='50000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","session_id":"50000000-0000-0000-0000-000000000001"}',true);
select throws_ok($$select public.doctor_session_context()$$,'42501','DOCTOR_AUTH_REQUIRED','expired provider session denied');
reset role;
update auth.sessions set not_after=null where id='50000000-0000-0000-0000-000000000001';
update auth.users set banned_until=now()+interval '1 day' where id='00000000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select public.doctor_session_context()$$,'42501','DOCTOR_AUTH_REQUIRED','suspended account cannot restore an authenticated view');
reset role;
update auth.users set banned_until=null where id='00000000-0000-0000-0000-000000000001';
delete from auth.sessions where id='50000000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select public.doctor_session_context()$$,'42501','DOCTOR_AUTH_REQUIRED','revoked session denied even while the old JWT claims remain');
select throws_ok($$select * from public.practices$$,'42501','DOCTOR_AUTH_REQUIRED','protected table policies also reject the revoked session');
reset role;
select * from finish();
rollback;
