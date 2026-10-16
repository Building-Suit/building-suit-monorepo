begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000001','doctor-a@example.test',now(),false,'{}'),
('00000000-0000-0000-0000-000000000002','doctor-b@example.test',now(),false,'{}'),
('00000000-0000-0000-0000-000000000003','secretary@example.test',now(),false,'{"role":"owner","practice_id":"10000000-0000-0000-0000-000000000001"}'),
('00000000-0000-0000-0000-000000000004','outsider@example.test',now(),false,'{}'),
('00000000-0000-0000-0000-000000000005','unverified@example.test',null,false,'{}');
insert into public.doctor_profiles(user_id,display_name) values
('00000000-0000-0000-0000-000000000001','Synthetic doctor A'),('00000000-0000-0000-0000-000000000002','Synthetic doctor B');
insert into public.practices(id,owner_user_id,name) values
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Synthetic A'),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Synthetic B');
insert into public.locations(id,practice_id,name,timezone) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','A location 1','Africa/Cairo'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','A location 2','Europe/London'),
('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','B location 1','Etc/UTC');
insert into public.memberships(id,practice_id,user_id,capabilities) values
('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',array['locations.read','patients.read','appointments.read']),
('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',array['locations.read','appointments.read','appointments.write']);
insert into public.membership_locations values
('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003');
select throws_ok($$insert into public.membership_locations values('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003')$$,'23503',null,'cross-practice membership/location reference denied');
select throws_ok($$insert into public.locations(practice_id,name,timezone) values('10000000-0000-0000-0000-000000000001','Bad timezone','UTC+fake')$$,'22023','DOCTOR_TIMEZONE_INVALID','IANA timezone is validated');
select throws_ok($$update public.memberships set capabilities=array['clinical.sign']$$,'23514',null,'staff cannot receive clinical signing authority');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.practices),1::bigint,'doctor sees own practice');
select is((select count(*) from public.locations),2::bigint,'doctor owns both locations');
select ok(not doctor_private.has_access('10000000-0000-0000-0000-000000000002','patients.read'),'doctor cannot read another practice');
select ok(not doctor_private.has_access('10000000-0000-0000-0000-000000000001','clinical.sign'),'M1 does not grant clinical authority even to owner');
select ok(not has_table_privilege('authenticated','public.practices','UPDATE'),'direct ownership mutation denied');
select throws_ok($$update public.practices set owner_user_id='00000000-0000-0000-0000-000000000003'$$,'42501',null,'ownership cannot be reassigned by direct client DML');
select ok(not has_table_privilege('authenticated','public.audit_events','UPDATE'),'audit events cannot be edited');
select ok(not has_table_privilege('authenticated','public.audit_events','DELETE'),'audit events cannot be deleted');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","user_metadata":{"role":"owner"}}',true);
select is((select count(*) from public.practices),2::bigint,'shared secretary has two independent practice contexts');
select is((select count(*) from public.locations),2::bigint,'secretary sees exactly two granted locations');
select ok(doctor_private.has_access('10000000-0000-0000-0000-000000000001','patients.read','20000000-0000-0000-0000-000000000001'),'explicit granted read allowed');
select ok(not doctor_private.has_access('10000000-0000-0000-0000-000000000001','patients.read','20000000-0000-0000-0000-000000000002'),'same-practice ungranted location denied');
select ok(not doctor_private.has_access('10000000-0000-0000-0000-000000000001','appointments.write','20000000-0000-0000-0000-000000000001'),'grant in practice B does not spill into A');
select ok(doctor_private.has_access('10000000-0000-0000-0000-000000000002','appointments.write','20000000-0000-0000-0000-000000000003'),'separate practice B grant allowed');
select ok(not doctor_private.is_owner('10000000-0000-0000-0000-000000000001'),'editable metadata never grants ownership');
select is((select count(*) from public.audit_events),0::bigint,'secretary cannot read owner audit');
reset role;
update public.memberships set status='revoked' where id='30000000-0000-0000-0000-000000000001';
set local role authenticated;
select ok(not doctor_private.has_access('10000000-0000-0000-0000-000000000001','patients.read','20000000-0000-0000-0000-000000000001'),'revocation takes effect on next request without JWT refresh');
select is((select count(*) from public.practices),1::bigint,'revocation hides only its own practice context');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is((select count(*) from public.practices),0::bigint,'outsider cannot discover practices');
select is((select count(*) from public.locations),0::bigint,'outsider cannot discover locations');
select throws_ok($$select doctor_private.require_access('10000000-0000-0000-0000-000000000001','patients.read')$$,'42501','DOCTOR_ACCESS_DENIED','unauthorized command fails explicitly');
select lives_ok($$select public.doctor_onboard('Synthetic outsider practice','Location','Etc/UTC','40000000-0000-0000-0000-000000000001')$$,'confirmed identity can onboard alone');
select lives_ok($$select public.doctor_onboard('Synthetic outsider practice','Location','Etc/UTC','40000000-0000-0000-0000-000000000001')$$,'identical retry is idempotent');
select is((select count(*) from public.practices),1::bigint,'repeated command created one practice');
select is((select count(*) from public.audit_events),1::bigint,'retry did not duplicate audit');
select throws_ok($$select public.doctor_onboard('Changed payload','Location','Etc/UTC','40000000-0000-0000-0000-000000000001')$$,'22023','DOCTOR_IDEMPOTENCY_CONFLICT','changed retry rejected');
select throws_ok($$select public.doctor_onboard('Duplicate practice','Location','Etc/UTC','40000000-0000-0000-0000-000000000002')$$,'23505','DOCTOR_PRACTICE_EXISTS','different-key duplicate onboarding denied');
select is((select professional_verification from public.doctor_profiles),'unverified','onboarding never claims professional verification');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
select throws_ok($$select public.doctor_onboard('Unverified','Location','Etc/UTC','40000000-0000-0000-0000-000000000003')$$,'42501','DOCTOR_AUTH_REQUIRED','unconfirmed identity cannot onboard');
reset role;
set local role anon;
select throws_ok($$select * from public.practices$$,'42501',null,'anonymous table access denied');
select throws_ok($$select public.doctor_onboard('Anon','Location','Etc/UTC','40000000-0000-0000-0000-000000000004')$$,'42501',null,'anonymous command execution denied');
reset role;
select * from finish();
rollback;
