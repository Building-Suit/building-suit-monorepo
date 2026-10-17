begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.id(prefix text,n integer)returns uuid language sql immutable as $$select(prefix||'000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$$;
insert into auth.users(id,email,email_confirmed_at,is_anonymous)select pg_temp.id('a1',n),'synthetic-queue-'||n||'@example.test',now(),false from generate_series(1,5)n;
insert into auth.sessions(id,user_id,not_after)select pg_temp.id('a2',n),pg_temp.id('a1',n),now()+interval '1 hour' from generate_series(1,5)n;
insert into public.doctor_profiles(user_id,display_name)values(pg_temp.id('a1',1),'Synthetic queue A'),(pg_temp.id('a1',2),'Synthetic queue B');
insert into public.practices(id,owner_user_id,name)values(pg_temp.id('a3',1),pg_temp.id('a1',1),'Synthetic queue A'),(pg_temp.id('a3',2),pg_temp.id('a1',2),'Synthetic queue B');
insert into public.locations(id,practice_id,name,timezone)values(pg_temp.id('a4',1),pg_temp.id('a3',1),'Queue A1','Pacific/Kiritimati'),(pg_temp.id('a4',2),pg_temp.id('a3',1),'Queue A2','Etc/GMT+12'),(pg_temp.id('a4',3),pg_temp.id('a3',2),'Queue B1','Etc/UTC');
insert into public.patient_identities(id)values(pg_temp.id('a7',1)),(pg_temp.id('a7',2));
insert into public.practice_patients(id,practice_id,patient_identity_id,display_name,created_location_id,created_by)values(pg_temp.id('a8',1),pg_temp.id('a3',1),pg_temp.id('a7',1),'Synthetic queue patient A',pg_temp.id('a4',1),pg_temp.id('a1',1)),(pg_temp.id('a8',2),pg_temp.id('a3',2),pg_temp.id('a7',2),'Synthetic queue patient B',pg_temp.id('a4',3),pg_temp.id('a1',2));
insert into public.memberships(id,practice_id,user_id,capabilities)values(pg_temp.id('a5',1),pg_temp.id('a3',1),pg_temp.id('a1',3),array['dashboard.read']), (pg_temp.id('a5',2),pg_temp.id('a3',2),pg_temp.id('a1',3),array['dashboard.read','appointments.read']);
insert into public.membership_locations(practice_id,membership_id,location_id,capabilities)values
(pg_temp.id('a3',1),pg_temp.id('a5',1),pg_temp.id('a4',1),array['dashboard.read','appointments.read']),
(pg_temp.id('a3',1),pg_temp.id('a5',1),pg_temp.id('a4',2),array['dashboard.read']),
(pg_temp.id('a3',2),pg_temp.id('a5',2),pg_temp.id('a4',3),array['dashboard.read','appointments.read']);
create function pg_temp.claim(n integer)returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id('a1',n),'session_id',pg_temp.id('a2',n),'role','authenticated')::text,true)$$;
create function pg_temp.day(location integer)returns date language sql stable security definer as $$select(clock_timestamp()at time zone timezone)::date from public.locations where id=pg_temp.id('a4',location)$$;
create function pg_temp.board(location integer default 1,page integer default 0,queue_page integer default 0)returns jsonb language sql as $$select public.doctor_appointment_board(pg_temp.id('a3',case when location=3 then 2 else 1 end),pg_temp.id('a4',location),pg_temp.day(location),page,queue_page)$$;
insert into public.appointments(id,practice_id,doctor_user_id,location_id,patient_id,starts_at,ends_at,timezone,location_name,state,created_by,checked_in_at)
select pg_temp.id('a9',n),pg_temp.id('a3',1),pg_temp.id('a1',1),pg_temp.id('a4',1),pg_temp.id('a8',1),stamp,stamp+interval '20 minutes','Pacific/Kiritimati','Queue A1',case when n<=22 then 'checked_in'else 'booked'end,pg_temp.id('a1',1),case when n<=22 then clock_timestamp()+n*interval '1 second'end
from generate_series(1,45)n cross join lateral(select(pg_temp.day(1)::timestamp at time zone 'Pacific/Kiritimati')+(n-1)*interval '20 minutes' stamp)s;
insert into public.appointments(id,practice_id,doctor_user_id,location_id,patient_id,starts_at,ends_at,timezone,location_name,state,created_by,checked_in_at)
select pg_temp.id('a9',100+n),pg_temp.id('a3',1),pg_temp.id('a1',1),pg_temp.id('a4',2),pg_temp.id('a8',1),stamp,stamp+interval '20 minutes','Etc/GMT+12','Queue A2',case when n=1 then 'booked'else 'checked_in'end,pg_temp.id('a1',1),case when n=2 then clock_timestamp()end
from generate_series(1,2)n cross join lateral(select((pg_temp.day(2)-case when n=2 then 7 else 0 end)+time '23:00')at time zone 'Etc/GMT+12' stamp)s;
insert into public.appointment_events(practice_id,appointment_id,actor_user_id,location_id,event_type,record_version,details)
select practice_id,id,created_by,location_id,'appointment.booked',1,'{}'::jsonb from public.appointments where id::text like 'a9000000-%';
-- Minimal historical clinic-reference fixture; lifecycle creation is verified in DOS-M1-014.
update public.appointment_events set location_id=pg_temp.id('a4',2)where appointment_id=pg_temp.id('a9',23);
set local role authenticated;select pg_temp.claim(1);
select is(jsonb_array_length(public.doctor_contexts()),2,'DOS-M1-015-C02: doctor has both own clinics');
select is(pg_temp.board()->>'total','45','DOS-M1-015-C01: full population exceeds one page');
select is(jsonb_array_length(pg_temp.board()->'items'),20,'day list is bounded independently of total');
select is(pg_temp.board(1,2)->>'total','45','later page retains authoritative full total');
select is(jsonb_array_length(pg_temp.board(1,2)->'items'),5,'final day page has five source rows');
select is(pg_temp.board()->>'queue_total','22','full active queue count exceeds one page');
select is(jsonb_array_length(pg_temp.board(1,0,1)->'queue'),2,'queue pagination is independent');
select is(pg_temp.board(2)->>'total','1','clinic local day excludes its overdue active queue row');
select is(pg_temp.board(2)->>'queue_total','1','active queue includes all dates with explicit separate metric');
select is(pg_temp.board(1)->>'date',pg_temp.day(1)::text,'Pacific local day window is preserved');
select is(pg_temp.board(2)->>'date',pg_temp.day(2)::text,'opposite clinic local day window is preserved');
select is((public.doctor_appointment_history(pg_temp.id('a3',1),pg_temp.id('a4',1),pg_temp.id('a9',45))->>'total'),'1','DOS-M1-015-C03: off-first-page source record has authorized history');
select throws_ok($$select pg_temp.board(3)$$,'42501','DOCTOR_ACCESS_DENIED','owner cannot use overview source in another practice');
select pg_temp.claim(3);
select is(jsonb_array_length(public.doctor_contexts()),3,'shared secretary contexts retain three independently granted clinics');
select is(pg_temp.board()->>'total','45','granted secretary sees authoritative clinic count');
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.board()->'items')item where item->>'patient_name'is not null),'appointment grant alone cannot reveal patient names');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.board(1,1)->'items')item where item->>'id'=pg_temp.id('a9',23)::text),'DOS-M1-015-C03: current source remains permitted with restricted historical clinic');
select throws_ok($$select public.doctor_appointment_history(pg_temp.id('a3',1),pg_temp.id('a4',1),pg_temp.id('a9',23))$$,'42501','DOCTOR_ACCESS_DENIED','full history still requires every represented clinic grant');
select throws_ok($$select pg_temp.board(2)$$,'42501','DOCTOR_ACCESS_DENIED','dashboard-only clinic grant cannot read appointment source');
select throws_ok($$select public.doctor_transition_appointment(pg_temp.id('a3',1),pg_temp.id('a4',1),pg_temp.id('a9',23),1,'checked_in','',gen_random_uuid())$$,'42501','DOCTOR_ACCESS_DENIED','readonly overview cannot directly perform queue actions');
select pg_temp.claim(4);
select is(jsonb_array_length(public.doctor_contexts()),0,'uninvited actor has no overview scopes');
select throws_ok($$select pg_temp.board(1)$$,'42501','DOCTOR_ACCESS_DENIED','uninvited direct source read is denied');
select * from finish();rollback;
