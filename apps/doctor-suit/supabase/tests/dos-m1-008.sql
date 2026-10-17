begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,is_anonymous) select ('91000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'synthetic-location-'||n||'@example.test',now(),false from generate_series(1,4)n;
insert into auth.sessions(id,user_id,not_after) select ('92000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('91000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour' from generate_series(1,4)n;
insert into public.doctor_profiles(user_id,display_name)values('91000000-0000-0000-0000-000000000001','Synthetic doctor A'),('91000000-0000-0000-0000-000000000002','Synthetic doctor B');
insert into public.practices(id,owner_user_id,name)values('93000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','Synthetic practice A'),('93000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000002','Synthetic practice B');
insert into public.locations(id,practice_id,name,timezone,contact_phone)values
('94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','A first','Africa/Cairo','synthetic-shared-contact'),
('94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000001','A second','Europe/London','synthetic-shared-contact'),
('94000000-0000-0000-0000-000000000003','93000000-0000-0000-0000-000000000002','B first','Etc/UTC','synthetic-shared-contact');
insert into public.memberships(id,practice_id,user_id,capabilities)values
('95000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000003',array['locations.read','locations.manage','patients.read']),
('95000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000003',array['appointments.read']);
insert into public.membership_locations values
('93000000-0000-0000-0000-000000000001','95000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001'),
('93000000-0000-0000-0000-000000000002','95000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000003');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","session_id":"92000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is(jsonb_array_length(public.doctor_contexts()),2,'owner has two independent location contexts');
select is(public.doctor_resolve_context('93000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001',1)->>'portal','doctor','owner portal comes from stored ownership');
select is(public.doctor_resolve_context('93000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001',1)->>'doctor_name','Synthetic doctor A','context identifies the owning doctor account');
select ok(not (public.doctor_contexts()->0->'capabilities' ? 'clinical.sign'),'M1 owner context grants no clinical signing');
select throws_ok($$select public.doctor_resolve_context('93000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000003')$$,'42501','DOCTOR_CONTEXT_DENIED','forged context cannot select another doctor');
select is(jsonb_array_length(public.doctor_locations('93000000-0000-0000-0000-000000000001',0,1)->'rows'),1,'directory is bounded and paginated');
select is((public.doctor_locations('93000000-0000-0000-0000-000000000001',0,1)->>'total')::integer,2,'directory count honors practice scope');
select throws_ok($$select public.doctor_locations('93000000-0000-0000-0000-000000000001',0,101)$$,'22023','DOCTOR_QUERY_INVALID','unbounded query size is rejected');
select throws_ok($$select public.doctor_locations('93000000-0000-0000-0000-000000000002')$$,'42501','DOCTOR_ACCESS_DENIED','owner cannot query another practice directory');
select lives_ok($$select public.doctor_write_location('93000000-0000-0000-0000-000000000001','A % clinic','America/New_York','synthetic-shared-contact','Synthetic address','96000000-0000-0000-0000-000000000001')$$,'owner creates another working location');
select lives_ok($$select public.doctor_write_location('93000000-0000-0000-0000-000000000001','A % clinic','America/New_York','synthetic-shared-contact','Synthetic address','96000000-0000-0000-0000-000000000001')$$,'create retry is idempotent');
select is((select count(*)from public.locations),3::bigint,'create retry retains exactly three own locations');
select is((public.doctor_locations('93000000-0000-0000-0000-000000000001',0,25,'%')->>'total')::integer,1,'search treats wildcard characters literally');
select is((select count(*)from public.practices),1::bigint,'working locations do not create new practice owners');
select is((select owner_user_id::text from public.practices),'91000000-0000-0000-0000-000000000001','doctor ownership persists across locations');
select throws_ok($$select public.doctor_write_location('93000000-0000-0000-0000-000000000001','Bad zone','UTC+fake','','','96000000-0000-0000-0000-000000000002')$$,'22023','DOCTOR_TIMEZONE_INVALID','new location requires a valid configurable timezone');
select lives_ok($$select public.doctor_write_location('93000000-0000-0000-0000-000000000001','A first updated','Europe/London','Synthetic phone','Synthetic address','96000000-0000-0000-0000-000000000003','94000000-0000-0000-0000-000000000001',1)$$,'owner updates approved location fields');
select throws_ok($$select public.doctor_write_location('93000000-0000-0000-0000-000000000001','Stale name','Europe/London','','','96000000-0000-0000-0000-000000000004','94000000-0000-0000-0000-000000000001',1)$$,'40001','DOCTOR_LOCATION_CONFLICT','stale location update cannot overwrite a newer version');
select lives_ok($$select public.doctor_archive_location('93000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000002',1,'96000000-0000-0000-0000-000000000005')$$,'owner archives a location without deleting history');
select lives_ok($$select public.doctor_archive_location('93000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000002',1,'96000000-0000-0000-0000-000000000005')$$,'archive retry is idempotent');
select is((select count(*)from public.locations),3::bigint,'archived location row is retained');
select is((select count(*)from public.audit_events where entity_id='94000000-0000-0000-0000-000000000002' and event_type='location.archived'),1::bigint,'archive has one attributed audit event');
select is(jsonb_array_length(public.doctor_contexts()),2,'archived location leaves active contexts');
select throws_ok($$select public.doctor_resolve_context('93000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000002')$$,'42501','DOCTOR_CONTEXT_DENIED','archived context cannot be activated');
select throws_ok($$delete from public.locations where id='94000000-0000-0000-0000-000000000002'$$,'42501',null,'clients cannot delete archived history');

select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000003","session_id":"92000000-0000-0000-0000-000000000003","role":"authenticated","user_metadata":{"role":"owner"}}',true);
select is(jsonb_array_length(public.doctor_contexts()),2,'one secretary has two independently granted doctor contexts');
select is(public.doctor_resolve_context('93000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000003')->>'portal','secretary','metadata does not change the server-resolved portal');
select ok(not(public.doctor_contexts()->0 ? 'contact_phone'),'operational context projection does not expose settings contact fields');
select throws_ok($$select public.doctor_locations('93000000-0000-0000-0000-000000000002')$$,'42501','DOCTOR_ACCESS_DENIED','appointment-only grant does not grant location settings access');
select is((public.doctor_locations('93000000-0000-0000-0000-000000000001')->>'total')::integer,1,'secretary directory includes only its granted location');
select throws_ok($$select public.doctor_write_location('93000000-0000-0000-0000-000000000001','Unauthorized new clinic','Etc/UTC','','','96000000-0000-0000-0000-000000000006')$$,'42501','DOCTOR_ACCESS_DENIED','a location-scoped management grant does not create owner authority');
select throws_ok($$select public.doctor_write_location('93000000-0000-0000-0000-000000000001','Cross-location edit','Etc/UTC','','','96000000-0000-0000-0000-000000000007','94000000-0000-0000-0000-000000000002',2)$$,'42501','DOCTOR_ACCESS_DENIED','forged ungranted location ID cannot authorize an update');
select throws_ok($$select public.doctor_archive_location('93000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000003',1,'96000000-0000-0000-0000-000000000008')$$,'42501','DOCTOR_ACCESS_DENIED','grant in practice A does not authorize archive in practice B');
select lives_ok($$select public.doctor_write_location('93000000-0000-0000-0000-000000000001','Secretary-authorized edit','Europe/London','','','96000000-0000-0000-0000-000000000009','94000000-0000-0000-0000-000000000001',2)$$,'explicit selected-location management is enforced positively');
select is((select actor_user_id::text from public.audit_events where entity_id='94000000-0000-0000-0000-000000000001' and event_type='location.updated' order by id desc limit 1),null::text,'secretary does not gain owner audit visibility');
reset role;
update public.memberships set version=2 where id='95000000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select public.doctor_resolve_context('93000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001',1)$$,'40001','DOCTOR_CONTEXT_CHANGED','stale grant version forces context revalidation');
reset role;
update public.memberships set status='revoked',version=3 where id='95000000-0000-0000-0000-000000000001';
set local role authenticated;
select is(jsonb_array_length(public.doctor_contexts()),1,'revocation removes only its own practice context without JWT refresh');
select throws_ok($$select public.doctor_resolve_context('93000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001')$$,'42501','DOCTOR_CONTEXT_DENIED','revoked context is denied server-side');
select throws_ok($$select public.doctor_write_location('93000000-0000-0000-0000-000000000001','Revoked update','Europe/London','','','96000000-0000-0000-0000-000000000010','94000000-0000-0000-0000-000000000001',3)$$,'42501','DOCTOR_ACCESS_DENIED','revoked membership cannot reuse an open-tab command');
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","session_id":"92000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.doctor_archive_location('93000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000003',1,'96000000-0000-0000-0000-000000000011')$$,'owner can archive its last location without deleting the practice');
select is(jsonb_array_length(public.doctor_contexts()),0,'all archived locations provide no operational context');
select is((public.doctor_locations('93000000-0000-0000-0000-000000000002')->>'total')::integer,1,'owner can still read retained archived history without an active location');
select lives_ok($$select public.doctor_write_location('93000000-0000-0000-0000-000000000002','B new clinic','Europe/London','','','96000000-0000-0000-0000-000000000012')$$,'owner can establish a new location when all previous locations are archived');
select is(jsonb_array_length(public.doctor_contexts()),1,'new location restores one authorized operational context');
select throws_ok($$select public.doctor_write_location('93000000-0000-0000-0000-000000000002','Offset rejected','+02:00','','','96000000-0000-0000-0000-000000000013')$$,'22023','DOCTOR_TIMEZONE_INVALID','fixed-offset strings cannot replace named timezone rules');
reset role;
set local role anon;
select throws_ok($$select public.doctor_contexts()$$,'42501',null,'anonymous context discovery is denied');
select throws_ok($$select public.doctor_locations('93000000-0000-0000-0000-000000000001')$$,'42501',null,'anonymous directory read is denied');
reset role;
select * from finish();
rollback;
