begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,is_anonymous)select ('61000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'synthetic-permission-'||n||'@example.test',now(),false from generate_series(1,4)n;
insert into auth.sessions(id,user_id,not_after)select ('62000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('61000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour' from generate_series(1,4)n;
insert into public.doctor_profiles(user_id,display_name)values('61000000-0000-0000-0000-000000000001','Synthetic permission doctor A'),('61000000-0000-0000-0000-000000000003','Synthetic permission doctor B');
insert into public.practices(id,owner_user_id,name)values('63000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','Synthetic A'),('63000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000003','Synthetic B');
insert into public.locations(id,practice_id,name,timezone)values
 ('64000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','A first','Africa/Cairo'),
 ('64000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000001','A second','Europe/London'),
 ('64000000-0000-0000-0000-000000000003','63000000-0000-0000-0000-000000000002','B first','Etc/UTC');
insert into public.memberships(id,practice_id,user_id,capabilities)values
 ('65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000002',array['patients.read','locations.read']),
 ('65000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000002',array['locations.manage']);
insert into public.membership_locations(practice_id,membership_id,location_id,capabilities)values
 ('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',array['patients.read']),
 ('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000002',array['locations.read']),
 ('63000000-0000-0000-0000-000000000002','65000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000003',array['locations.manage']);
create function pg_temp.claim(n integer)returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub','61000000-0000-0000-0000-'||lpad(n::text,12,'0'),'session_id','62000000-0000-0000-0000-'||lpad(n::text,12,'0'),'role','authenticated','user_metadata',jsonb_build_object('role','owner'))::text,true)$$;
set local role authenticated;
select pg_temp.claim(2);
select is(public.doctor_resolve_context('63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001')->'capabilities','["patients.read"]'::jsonb,'per-location projection does not inherit the aggregate membership union');
select ok(not doctor_private.has_access('63000000-0000-0000-0000-000000000001','locations.read','64000000-0000-0000-0000-000000000001'),'location A1 cannot borrow A2 location-settings read');
select throws_ok($$select public.doctor_write_location('63000000-0000-0000-0000-000000000001','Denied','Etc/UTC','','','66000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000002',1)$$,'42501','DOCTOR_ACCESS_DENIED','DOS-M1-010-C02: direct settings command without management permission is denied');
select is((public.doctor_locations('63000000-0000-0000-0000-000000000001')->>'total')::integer,1,'DOS-M1-010-C02: actual settings query filters missing per-location permission');
select throws_ok($$select public.doctor_set_membership_grants('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',1,'[]','66000000-0000-0000-0000-000000000002')$$,'42501','DOCTOR_ACCESS_DENIED','secretary cannot change its own authority');
select ok(not doctor_private.has_access('63000000-0000-0000-0000-000000000001','clinical.sign','64000000-0000-0000-0000-000000000001'),'clinical signing is not an administrative permission');
select pg_temp.claim(1);
select is(public.doctor_administrative_capabilities(),array['dashboard.read','locations.read','locations.manage','patients.read','patients.write','documents.read','documents.write','availability.manage','appointments.read','appointments.write','queue.manage'],'DOS-M1-010-C04: catalogue contains exactly the approved eleven administrative capabilities');
select ok(not exists(select 1 from unnest(public.doctor_administrative_capabilities())c where c ~ 'clinical|prescri|sign|owner|members'),'no catalogue shortcut delegates clinical or ownership authority');
select lives_ok($$select public.doctor_set_membership_grants('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',1,'[{"location_id":"64000000-0000-0000-0000-000000000001","capabilities":["appointments.read","locations.read","locations.manage"]},{"location_id":"64000000-0000-0000-0000-000000000002","capabilities":["patients.read"]}]','66000000-0000-0000-0000-000000000003')$$,'DOS-M1-010-C01: owner saves exact selected capabilities independently per location');
select lives_ok($$select public.doctor_set_membership_grants('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',1,'[{"location_id":"64000000-0000-0000-0000-000000000001","capabilities":["appointments.read","locations.read","locations.manage"]},{"location_id":"64000000-0000-0000-0000-000000000002","capabilities":["patients.read"]}]','66000000-0000-0000-0000-000000000003')$$,'exact grant command retry is idempotent');
select is((select version from public.memberships where id='65000000-0000-0000-0000-000000000001'),2,'grant retry increments the membership once');
select is((public.doctor_team('63000000-0000-0000-0000-000000000001')->'members'->0->'grants'->0->'capabilities'),'["appointments.read","locations.manage","locations.read"]'::jsonb,'owner reload sees the exact canonical per-location set');
select throws_ok($$select public.doctor_set_membership_grants('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',1,'[]','66000000-0000-0000-0000-000000000004')$$,'40001','DOCTOR_MEMBERSHIP_CONFLICT','conflicting editor cannot overwrite a newer grant set');
select throws_ok($$select public.doctor_set_membership_grants('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000002',1,'[]','66000000-0000-0000-0000-000000000005')$$,'42501','DOCTOR_ACCESS_DENIED','DOS-M1-010-C03: forged membership from another doctor is denied');
select throws_ok($$select public.doctor_set_membership_grants('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',2,'[{"location_id":"64000000-0000-0000-0000-000000000003","capabilities":["patients.read"]}]','66000000-0000-0000-0000-000000000006')$$,'22023','DOCTOR_GRANTS_INVALID','grant cannot contain a foreign doctor location');
select throws_ok($$select public.doctor_set_membership_grants('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',2,'[{"location_id":"64000000-0000-0000-0000-000000000001","capabilities":["clinical.sign"]}]','66000000-0000-0000-0000-000000000007')$$,'22023','DOCTOR_GRANTS_INVALID','even the doctor cannot delegate unimplemented clinical signing');
select throws_ok($$select public.doctor_set_membership_grants('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',2,'[{"location_id":"64000000-0000-0000-0000-000000000001","capabilities":["prescriptions.sign"]}]','66000000-0000-0000-0000-000000000008')$$,'22023','DOCTOR_GRANTS_INVALID','prescribing is not an administrative grant');
select throws_ok($$select public.doctor_set_membership_grants('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',2,'[{"location_id":"64000000-0000-0000-0000-000000000001","capabilities":["patients.read"],"role":"owner"}]','66000000-0000-0000-0000-000000000009')$$,'22023','DOCTOR_GRANTS_INVALID','overposted owner field cannot change authority');
select throws_ok($$select public.doctor_set_membership_grants('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',2,'[{"location_id":"64000000-0000-0000-0000-000000000001","capabilities":["patients.read"]},{"location_id":"64000000-0000-0000-0000-000000000001","capabilities":["locations.manage"]}]','66000000-0000-0000-0000-000000000010')$$,'22023','DOCTOR_GRANTS_INVALID','conflicting duplicate location sets are rejected');
select pg_temp.claim(2);
select is(public.doctor_resolve_context('63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001')->'capabilities','["appointments.read","locations.manage","locations.read"]'::jsonb,'selected grant is enforced after reload using the same session');
select is((public.doctor_resolve_context('63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001')->>'grants_version')::integer,2,'permission revision participates in trusted context');
select throws_ok($$select public.doctor_resolve_context('63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',1)$$,'40001','DOCTOR_CONTEXT_CHANGED','old context revision is rejected');
select lives_ok($$select public.doctor_write_location('63000000-0000-0000-0000-000000000001','Authorized scoped edit','Africa/Cairo','','','66000000-0000-0000-0000-000000000011','64000000-0000-0000-0000-000000000001',1)$$,'new explicit management grant authorizes the actual location command');
select throws_ok($$select public.doctor_write_location('63000000-0000-0000-0000-000000000001','Still denied','Etc/UTC','','','66000000-0000-0000-0000-000000000012','64000000-0000-0000-0000-000000000002',1)$$,'42501','DOCTOR_ACCESS_DENIED','A1 management grant does not leak into A2');
select throws_ok($$update public.membership_locations set capabilities=array['locations.manage']$$,'42501',null,'client cannot bypass the grant command with direct DML');
select pg_temp.claim(1);
select lives_ok($$select public.doctor_set_membership_grants('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',2,jsonb_build_array(jsonb_build_object('location_id','64000000-0000-0000-0000-000000000001','capabilities',public.doctor_administrative_capabilities())),'66000000-0000-0000-0000-000000000013')$$,'doctor can grant all and only approved administrative capabilities');
select lives_ok($$select public.doctor_set_membership_grants('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',3,'[]','66000000-0000-0000-0000-000000000014')$$,'explicit empty grant set removes all practice location access');
select is((select status from public.memberships where id='65000000-0000-0000-0000-000000000001'),'active','grant removal does not silently change the membership lifecycle');
select pg_temp.claim(2);
select is(jsonb_array_length(public.doctor_contexts()),1,'cleared A grants retain only independently granted B');
select throws_ok($$select public.doctor_locations('63000000-0000-0000-0000-000000000001')$$,'42501','DOCTOR_ACCESS_DENIED','next actual query observes empty grants immediately');
select is((select version from public.memberships where id='65000000-0000-0000-0000-000000000002'),1,'changing A grants leaves B version and authority untouched');
reset role;
update public.memberships set status='suspended' where id='65000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.claim(1);
select lives_ok($$select public.doctor_set_membership_grants('63000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',4,'[{"location_id":"64000000-0000-0000-0000-000000000001","capabilities":["locations.read"]}]','66000000-0000-0000-0000-000000000015')$$,'owner can edit the stored grants of a suspended membership');
select is((select status from public.memberships where id='65000000-0000-0000-0000-000000000001'),'suspended','editing grants never reactivates a suspended membership');
select pg_temp.claim(2);
select throws_ok($$select public.doctor_locations('63000000-0000-0000-0000-000000000001')$$,'42501','DOCTOR_ACCESS_DENIED','suspended status takes precedence over newly saved grants');
reset role;
select is((select count(*) from public.audit_events where event_type='secretary.grants_changed'),4::bigint,'grant writes have one audit event per accepted intent, excluding retries');
select is((select actor_user_id::text from public.audit_events where event_type='secretary.grants_changed' order by id desc limit 1),'61000000-0000-0000-0000-000000000001','audit attributes grant changes to the verified owning doctor');
select is((select practice_id::text from public.audit_events where event_type='secretary.grants_changed' order by id desc limit 1),'63000000-0000-0000-0000-000000000001','audit retains the exact practice scope');
select is((select details->'after' from public.audit_events where event_type='secretary.grants_changed' order by id desc limit 1),'[{"location_id":"64000000-0000-0000-0000-000000000001","capabilities":["locations.read"]}]'::jsonb,'immutable audit retains the exact approved location/capability change');
set local role anon;
select throws_ok($$select public.doctor_administrative_capabilities()$$,'42501',null,'anonymous administrative catalogue access is denied');
reset role;
select * from finish();
rollback;
