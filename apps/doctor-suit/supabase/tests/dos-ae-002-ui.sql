begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.id(n integer)returns uuid language sql immutable as $$select('ae020000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$$;
insert into auth.users(id,email,email_confirmed_at)select pg_temp.id(n),'synthetic-edition-'||n||'@example.test',now()from generate_series(1,5)n;
insert into auth.sessions(id,user_id)select pg_temp.id(n+10),pg_temp.id(n)from generate_series(1,5)n;
insert into public.doctor_profiles(user_id,display_name)values(pg_temp.id(1),'Synthetic edition doctor A'),(pg_temp.id(2),'Synthetic edition doctor B');
insert into public.practices(id,owner_user_id,name)values(pg_temp.id(21),pg_temp.id(1),'Synthetic edition A'),(pg_temp.id(22),pg_temp.id(2),'Synthetic edition B');
insert into public.locations(id,practice_id,name,timezone)values(pg_temp.id(31),pg_temp.id(21),'Synthetic A1','Etc/UTC'),(pg_temp.id(32),pg_temp.id(22),'Synthetic B1','Etc/UTC');
insert into public.memberships(id,practice_id,user_id,capabilities)values
 (pg_temp.id(41),pg_temp.id(21),pg_temp.id(3),array['patients.read','documents.read','documents.write']),
 (pg_temp.id(42),pg_temp.id(21),pg_temp.id(4),array['documents.read']);
insert into public.membership_locations(practice_id,membership_id,location_id)values(pg_temp.id(21),pg_temp.id(41),pg_temp.id(31)),(pg_temp.id(21),pg_temp.id(42),pg_temp.id(31));
insert into public.patient_identities(id)values(pg_temp.id(51));
insert into public.practice_patients(id,practice_id,patient_identity_id,display_name,created_location_id,created_by)
 values(pg_temp.id(61),pg_temp.id(21),pg_temp.id(51),'Synthetic administrative patient',pg_temp.id(31),pg_temp.id(1));
insert into public.appointments(id,practice_id,doctor_user_id,location_id,patient_id,starts_at,ends_at,timezone,location_name,state,created_by,version)
 values(pg_temp.id(71),pg_temp.id(21),pg_temp.id(1),pg_temp.id(31),pg_temp.id(61),now()+interval'7 days',now()+interval'7 days 20 minutes','Etc/UTC','Synthetic A1','cancelled',pg_temp.id(1),2);
insert into public.appointment_events(practice_id,appointment_id,actor_user_id,location_id,event_type,record_version,details)
 values(pg_temp.id(21),pg_temp.id(71),pg_temp.id(1),pg_temp.id(31),'appointment.cancelled',2,'{"from":"booked","to":"cancelled","reason":"SYNTHETIC_HISTORICAL_FREE_TEXT","unknown_note":"SYNTHETIC_UNKNOWN_NOTE"}');
create function pg_temp.claim(n integer)returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id(n),'session_id',pg_temp.id(n+10),'role','authenticated','user_metadata',jsonb_build_object('edition','synthetic_preview','role','owner'))::text,true)$$;

update public.doctor_edition_policy set mode='administrative_candidate',revision=2,change_reason='Synthetic administrative presentation acceptance';
set local role authenticated; select pg_temp.claim(1);
select is(public.doctor_team(pg_temp.id(21))->>'edition','administrative_candidate','team projection explicitly selects the administrative edition');
select is(public.doctor_team(pg_temp.id(21))->>'edition_revision','2','team projection includes authoritative policy revision');
select is(jsonb_array_length(public.doctor_team(pg_temp.id(21))->'available_capabilities'),10,'editor receives ten effective permissions');
select ok(not(public.doctor_team(pg_temp.id(21))->'available_capabilities'?'documents.read'),'static document read is never offered');
select ok(not(public.doctor_team(pg_temp.id(21))->'available_capabilities'?'documents.write'),'static document write is never offered');
select ok(public.doctor_team(pg_temp.id(21))->'members' @> jsonb_build_array(jsonb_build_object('id',pg_temp.id(41),'grants',jsonb_build_array(jsonb_build_object('capabilities',jsonb_build_array('documents.read'))))),'historical document grants remain stored metadata, distinct from effective offers');
select pg_temp.claim(3);
select throws_ok($$select public.doctor_team(pg_temp.id(21))$$,'42501','DOCTOR_ACCESS_DENIED','staff cannot forge owner directory authority');
select pg_temp.claim(1);
select throws_ok($$select public.doctor_team(pg_temp.id(22))$$,'42501','DOCTOR_ACCESS_DENIED','team edition metadata does not bypass tenant isolation');
reset role;
update public.locations set archived_at=now() where id=pg_temp.id(31);
set local role authenticated; select pg_temp.claim(1);
select is(jsonb_array_length(public.doctor_contexts()),0,'owner can have no active location context');
select is(public.doctor_team(pg_temp.id(21))->>'edition','administrative_candidate','owner directory remains edition-scoped without any active clinic');
select is(jsonb_array_length(public.doctor_team(pg_temp.id(21))->'available_capabilities'),10,'zero-clinic editor never falls back to static permissions');
reset role;
select is((select capabilities from public.memberships where id=pg_temp.id(41)),array['patients.read','documents.read','documents.write'],'opening the editor never rewrites historical grants');
select * from finish(); rollback;
