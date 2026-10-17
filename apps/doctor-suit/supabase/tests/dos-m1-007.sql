begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values
('71000000-0000-0000-0000-000000000001','setup-owner@example.test',now(),false,'{"professional_verification":"verified"}'),
('71000000-0000-0000-0000-000000000002','other-owner@example.test',now(),false,'{}'),
('71000000-0000-0000-0000-000000000003','setup-secretary@example.test',now(),false,'{"role":"doctor","owner":true}');
insert into auth.sessions(id,user_id,not_after) values
('72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001',now()+interval '1 hour'),
('72000000-0000-0000-0000-000000000004','71000000-0000-0000-0000-000000000001',now()+interval '1 hour'),
('72000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002',now()+interval '1 hour'),
('72000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000003',now()+interval '1 hour');
insert into public.doctor_profiles(user_id,display_name) values('71000000-0000-0000-0000-000000000002','Other synthetic owner');
insert into public.practices(id,owner_user_id,name) values('73000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002','Other synthetic practice');
insert into public.memberships(practice_id,user_id,capabilities) values('73000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000003',array['locations.manage']);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000001","session_id":"72000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is(public.doctor_practice_setup()->>'enrollment','owner','new confirmed identity may begin owner setup');
select is(public.doctor_practice_setup()->'practice','null'::jsonb,'no practice is fabricated before onboarding');
select lives_ok($$select public.doctor_save_onboarding_draft('74000000-0000-0000-0000-000000000001',0,'Synthetic owner','','','')$$,'incomplete draft is saved without creating a practice');
select is((select count(*) from public.practices),0::bigint,'saving a draft creates no practice');
select lives_ok($$select public.doctor_save_onboarding_draft('74000000-0000-0000-0000-000000000001',0,'Synthetic owner','','','')$$,'uncertain exact save retry is idempotent');
select is((public.doctor_practice_setup()->'draft'->>'version')::integer,1,'exact retry does not consume another revision');
select throws_ok($$select public.doctor_complete_onboarding('74000000-0000-0000-0000-000000000001',1)$$,'22023','DOCTOR_ONBOARDING_INCOMPLETE','incomplete fields cannot create a practice');
select throws_ok($$select public.doctor_save_onboarding_draft('74000000-0000-0000-0000-000000000001',1,'Synthetic owner','Synthetic practice','Main','UTC+fake')$$,'22023','DOCTOR_TIMEZONE_INVALID','timezone uses server IANA catalogue');
select lives_ok($$select public.doctor_save_onboarding_draft('74000000-0000-0000-0000-000000000001',1,'Synthetic owner','Synthetic practice','Main','Africa/Cairo')$$,'complete approved profile draft saves');
select throws_ok($$select public.doctor_save_onboarding_draft('74000000-0000-0000-0000-000000000001',1,'Stale name','Synthetic practice','Main','Africa/Cairo')$$,'40001','DOCTOR_DRAFT_CONFLICT','another tab cannot silently overwrite a newer draft');
select throws_ok($$select public.doctor_complete_onboarding('74000000-0000-0000-0000-000000000001',1)$$,'40001','DOCTOR_DRAFT_CONFLICT','stale completion cannot consume newer draft');

select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000001","session_id":"72000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is(public.doctor_practice_setup()->'draft'->>'practice_name','Synthetic practice','draft resumes in another verified session');
select is((public.doctor_practice_setup()->'draft'->>'version')::integer,2,'resumed draft retains its revision');
select throws_ok($$insert into public.onboarding_drafts(user_id,command_key) values('71000000-0000-0000-0000-000000000003','74000000-0000-0000-0000-000000000099')$$,'42501',null,'client cannot assign drafts to another identity');
select lives_ok($$select public.doctor_complete_onboarding('74000000-0000-0000-0000-000000000001',2)$$,'doctor completes onboarding with no secretary');
select lives_ok($$select public.doctor_complete_onboarding('74000000-0000-0000-0000-000000000001',2)$$,'same-key double-submit returns original result');
select is((select count(*) from public.practices),1::bigint,'double-submit creates exactly one owned practice');
select is((select count(*) from public.locations),1::bigint,'double-submit creates exactly one initial location');
select is((select count(*) from public.memberships),0::bigint,'doctor-alone setup needs no secretary membership');
select is((select count(*) from public.practices where owner_user_id=auth.uid()),1::bigint,'exactly one stored owner association is created');
select is((select count(*) from public.doctor_profiles),1::bigint,'double-submit creates one owner profile');
select is((select count(*) from public.audit_events),1::bigint,'idempotent retry creates one attributed audit event');
select is((select actor_user_id::text from public.audit_events),'71000000-0000-0000-0000-000000000001','audit actor is verified user, not editable metadata');
select is((select count(*) from public.onboarding_drafts),0::bigint,'completed draft is removed atomically');
select is((select display_name from public.doctor_profiles),'Synthetic owner','display name is separate from practice name');
select is((select name from public.practices),'Synthetic practice','practice keeps its own approved name');
select is((select professional_verification from public.doctor_profiles),'unverified','forged professional metadata never establishes verification');
select is((select timezone from public.locations),'Africa/Cairo','initial location retains explicit IANA timezone');
select throws_ok($$select public.doctor_complete_onboarding('74000000-0000-0000-0000-000000000001',3)$$,'22023','DOCTOR_IDEMPOTENCY_CONFLICT','changed replay is not silently accepted');

select lives_ok($$select public.doctor_update_practice_profile((public.doctor_practice_setup()->'practice'->>'id')::uuid,1,'Updated synthetic owner','Updated synthetic practice','74000000-0000-0000-0000-000000000002')$$,'owner may maintain approved profile fields');
select lives_ok($$select public.doctor_update_practice_profile((public.doctor_practice_setup()->'practice'->>'id')::uuid,1,'Updated synthetic owner','Updated synthetic practice','74000000-0000-0000-0000-000000000002')$$,'profile update retry remains idempotent after version changes');
select is((public.doctor_practice_setup()->'practice'->>'version')::integer,2,'profile update consumes one revision');
select is((select count(*) from public.audit_events where event_type='practice.profile_updated'),1::bigint,'profile retry creates one audit event');
select throws_ok($$select public.doctor_update_practice_profile((public.doctor_practice_setup()->'practice'->>'id')::uuid,1,'Stale owner','Stale practice','74000000-0000-0000-0000-000000000003')$$,'40001','DOCTOR_PROFILE_CONFLICT','stale update cannot overwrite new profile');
select throws_ok($$select public.doctor_update_practice_profile('73000000-0000-0000-0000-000000000002',1,'Attacker','Other practice','74000000-0000-0000-0000-000000000004')$$,'42501','DOCTOR_ACCESS_DENIED','owner cannot edit another owner profile');

select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000003","session_id":"72000000-0000-0000-0000-000000000003","role":"authenticated","user_metadata":{"role":"doctor","owner":true}}',true);
select is(public.doctor_practice_setup()->>'enrollment','delegated-only','server membership determines delegated-only enrollment');
select is(public.doctor_practice_setup()->'profile','null'::jsonb,'secretary cannot read another doctor profile');
select throws_ok($$select public.doctor_save_onboarding_draft('74000000-0000-0000-0000-000000000005',0,'Attacker','Unauthorized practice','Main','Etc/UTC')$$,'42501','DOCTOR_OWNER_ENROLLMENT_REQUIRED','secretary cannot start owner setup through metadata');
select throws_ok($$select public.doctor_complete_onboarding('74000000-0000-0000-0000-000000000005',1)$$,'42501','DOCTOR_OWNER_ENROLLMENT_REQUIRED','secretary cannot finish owner setup');
select throws_ok($$select public.doctor_onboard('Attacker','Main','Etc/UTC','74000000-0000-0000-0000-000000000005')$$,'42501','DOCTOR_OWNER_ENROLLMENT_REQUIRED','legacy onboarding entry point cannot bypass delegated restriction');
select throws_ok($$select doctor_private.onboard('Attacker','Main','Etc/UTC','74000000-0000-0000-0000-000000000005')$$,'42501','DOCTOR_OWNER_ENROLLMENT_REQUIRED','private compatibility helper cannot bypass delegated restriction');
select throws_ok($$select public.doctor_update_practice_profile('73000000-0000-0000-0000-000000000002',1,'Attacker','Changed','74000000-0000-0000-0000-000000000006')$$,'42501','DOCTOR_ACCESS_DENIED','administrative location grant does not grant profile ownership');
reset role;
set local role anon;
select throws_ok($$select public.doctor_practice_setup()$$,'42501',null,'anonymous setup read denied');
select throws_ok($$select * from public.onboarding_drafts$$,'42501',null,'anonymous draft access denied');
reset role;
select * from finish();
rollback;
