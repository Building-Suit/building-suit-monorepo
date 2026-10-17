begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,is_anonymous)select ('81000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'synthetic-schedule-'||n||'@example.test',now(),false from generate_series(1,6)n;
insert into auth.sessions(id,user_id,not_after)select ('82000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('81000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour' from generate_series(1,6)n;
insert into public.doctor_profiles(user_id,display_name)values('81000000-0000-0000-0000-000000000001','Synthetic schedule doctor A'),('81000000-0000-0000-0000-000000000003','Synthetic schedule doctor B');
insert into public.practices(id,owner_user_id,name)values('83000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','Synthetic schedule A'),('83000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000003','Synthetic schedule B');
insert into public.locations(id,practice_id,name,timezone)values
 ('84000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001','Schedule A1','Africa/Cairo'),
 ('84000000-0000-0000-0000-000000000002','83000000-0000-0000-0000-000000000001','Schedule A2','Europe/London'),
 ('84000000-0000-0000-0000-000000000003','83000000-0000-0000-0000-000000000002','Schedule B1','Africa/Cairo'),
 ('84000000-0000-0000-0000-000000000004','83000000-0000-0000-0000-000000000001','Schedule A3','Etc/UTC');
insert into public.memberships(id,practice_id,user_id,capabilities)values
 ('85000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000002',array['availability.manage','appointments.read','appointments.write','patients.read']),
 ('85000000-0000-0000-0000-000000000002','83000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000002',array['appointments.read','patients.read']),
 ('85000000-0000-0000-0000-000000000003','83000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000004',array['appointments.read','patients.read']),
 ('85000000-0000-0000-0000-000000000004','83000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000005',array['appointments.write','patients.read']),
 ('85000000-0000-0000-0000-000000000005','83000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000006',array['availability.manage']);
insert into public.membership_locations(practice_id,membership_id,location_id,capabilities)select practice_id,id,case when practice_id='83000000-0000-0000-0000-000000000002'::uuid then '84000000-0000-0000-0000-000000000003'::uuid else '84000000-0000-0000-0000-000000000001'::uuid end,capabilities from public.memberships where id::text like '85000000-%';
insert into public.patient_identities(id)values('87000000-0000-0000-0000-000000000001'),('87000000-0000-0000-0000-000000000002');
insert into public.practice_patients(id,practice_id,patient_identity_id,display_name,created_location_id,created_by)values
 ('88000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001','87000000-0000-0000-0000-000000000001','Synthetic schedule patient A','84000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001'),
 ('88000000-0000-0000-0000-000000000002','83000000-0000-0000-0000-000000000002','87000000-0000-0000-0000-000000000002','Synthetic schedule patient B','84000000-0000-0000-0000-000000000003','81000000-0000-0000-0000-000000000003');
create function pg_temp.id(prefix text,n integer)returns uuid language sql immutable as $$select(prefix||'000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.claim(n integer)returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id('81',n),'session_id',pg_temp.id('82',n),'role','authenticated','user_metadata',jsonb_build_object('role','owner','override',true))::text,true)$$;
create function pg_temp.day()returns date language sql as $$select(clock_timestamp() at time zone 'Africa/Cairo')::date+7$$;
create function pg_temp.hours(minutes integer default 20)returns jsonb language sql immutable as $$select jsonb_build_object('slot_minutes',minutes,'weekly',(select jsonb_agg(jsonb_build_object('weekday',day,'start',540,'end',1020))from generate_series(0,6)day),'exceptions','[]'::jsonb)$$;
create function pg_temp.save(n integer,version integer default 0,config jsonb default null)returns jsonb language sql as $$select public.doctor_write_schedule(pg_temp.id('83',case when n=3 then 2 else 1 end),pg_temp.id('84',n),version,coalesce(config,pg_temp.hours()),pg_temp.id('86',100+n+version*10))$$;
create function pg_temp.book(n integer,location integer default 1,minute integer default 780,version integer default 1,patient integer default 1)returns jsonb language sql as $$select public.doctor_book_appointment(pg_temp.id('83',case when location=3 then 2 else 1 end),pg_temp.id('84',location),pg_temp.id('88',patient),pg_temp.day(),minute,version,1,pg_temp.id('86',n))$$;
create function pg_temp.appointment()returns uuid language sql as $$select(current_setting('test.schedule.booked')::jsonb->>'appointment_id')::uuid$$;

select ok(doctor_private.schedule_instant('2025-03-30',90,'Europe/London') is null,'DOS-M1-013-C02: nonexistent spring-forward clock is rejected');
select ok(doctor_private.schedule_instant('2025-10-26',90,'Europe/London') is null,'DOS-M1-013-C02: ambiguous fall-back clock is rejected');
select is(doctor_private.schedule_instant('2025-03-30',120,'Europe/London'),'2025-03-30 01:00:00+00'::timestamptz,'unambiguous daylight instant uses the actual IANA timezone');
select ok(doctor_private.schedule_instant('2025-04-06',105,'Australia/Lord_Howe') is null,'half-hour fold is rejected without assuming a one-hour transition');
select ok(doctor_private.schedule_instant('2025-10-05',135,'Australia/Lord_Howe') is null,'half-hour gap is rejected');
select ok(doctor_private.schedule_instant('2020-03-08',90,'Antarctica/Casey') is null,'three-hour fold is rejected');
select ok(doctor_private.schedule_instant('2011-12-30',720,'Pacific/Apia') is null,'a skipped local calendar day is rejected');
select ok(doctor_private.schedule_instant('2025-01-01',1441,'Etc/UTC') is null,'out-of-day minute is rejected');
select throws_ok($$select doctor_private.schedule_input(pg_temp.hours()||'{"override":true}')$$,'22023','DOCTOR_AVAILABILITY_INVALID','DOS-M1-013-C04: an injected override field is forbidden');
select throws_ok($$select doctor_private.schedule_input(pg_temp.hours(4))$$,'22023','DOCTOR_AVAILABILITY_INVALID','slot durations below the supported bound are rejected');
select throws_ok($$select doctor_private.schedule_input(pg_temp.hours(121))$$,'22023','DOCTOR_AVAILABILITY_INVALID','slot durations above the supported bound are rejected');
select throws_ok($$select doctor_private.schedule_windows_input('[{"weekday":1,"start":540,"end":600},{"weekday":1,"start":580,"end":620}]',true)$$,'22023','DOCTOR_AVAILABILITY_OVERLAP','overlapping working-hour windows are rejected');
select lives_ok($$select doctor_private.schedule_windows_input('[{"weekday":1,"start":540,"end":600},{"weekday":1,"start":600,"end":620}]',true)$$,'adjacent windows use half-open bounds');
select throws_ok($$select doctor_private.schedule_input(pg_temp.hours()||jsonb_build_object('exceptions',jsonb_build_array(jsonb_build_object('date','2025-02-30','closed',true,'windows','[]'::jsonb,'reason','Synthetic closure'))))$$,'22023','DOCTOR_AVAILABILITY_INVALID','impossible exception date is rejected');
select throws_ok($$select doctor_private.schedule_input(pg_temp.hours()||jsonb_build_object('exceptions',jsonb_build_array(jsonb_build_object('date',pg_temp.day(),'closed',true,'windows','[{"start":600,"end":620}]'::jsonb,'reason','Synthetic closure'))))$$,'22023','DOCTOR_AVAILABILITY_INVALID','closed-day exception cannot also contain open windows');

set local role authenticated;
select pg_temp.claim(1);
select is(public.doctor_schedule(pg_temp.id('83',1),pg_temp.id('84',1))->>'version','0','unconfigured schedule has explicit version zero');
select is(jsonb_array_length(public.doctor_availability(pg_temp.id('83',1),pg_temp.id('84',1),pg_temp.day())->'slots'),0,'unconfigured hours never offer a hidden all-day schedule');
select is(public.doctor_schedule(pg_temp.id('83',1),pg_temp.id('84',1))->>'override_policy','deny','DOS-M1-013-C04: owner override policy is explicitly deny');
select is(pg_temp.save(1)->>'version','1','owner configures first clinic');
select is(pg_temp.save(2)->>'timezone','Europe/London','second clinic retains an explicit independent timezone');
select is(pg_temp.save(1)->>'version','1','exact uncertain configuration retry returns the same version');
select throws_ok($$select public.doctor_write_schedule(pg_temp.id('83',1),pg_temp.id('84',1),0,pg_temp.hours(30),pg_temp.id('86',101))$$,'22023','DOCTOR_IDEMPOTENCY_CONFLICT','configuration retry key cannot name changed material');
select throws_ok($$select public.doctor_write_schedule(pg_temp.id('83',1),pg_temp.id('84',1),0,pg_temp.hours(30),pg_temp.id('86',199))$$,'40001','DOCTOR_AVAILABILITY_CONFLICT','stale hours editor is rejected');
select is(jsonb_array_length(public.doctor_availability(pg_temp.id('83',1),pg_temp.id('84',1),pg_temp.day())->'slots'),24,'bounded regular hours offer exactly the configured slots');
select throws_ok($$select public.doctor_availability(pg_temp.id('83',1),pg_temp.id('84',1),pg_temp.day()-8)$$,'22023','DOCTOR_AVAILABILITY_DATE_INVALID','past local-day availability is rejected');
select throws_ok($$select public.doctor_availability(pg_temp.id('83',1),pg_temp.id('84',1),pg_temp.day()+366)$$,'22023','DOCTOR_AVAILABILITY_DATE_INVALID','availability horizon is bounded');
select set_config('test.schedule.booked',pg_temp.book(1)::text,true);
select is(pg_temp.book(1),current_setting('test.schedule.booked')::jsonb,'exact uncertain booking retry preserves appointment identity');
select throws_ok($$select pg_temp.book(1,1,800)$$,'22023','DOCTOR_IDEMPOTENCY_CONFLICT','booking key is bound to exact slot material');
select throws_ok($$select pg_temp.book(2)$$,'40001','DOCTOR_APPOINTMENT_CONFLICT','DOS-M1-013-C03: an offered slot becomes unavailable after another booking');
select is((select value->>'available' from jsonb_array_elements(public.doctor_availability(pg_temp.id('83',1),pg_temp.id('84',1),pg_temp.day())->'slots') where(value->>'minute')::integer=780),'false','availability uses the same authoritative busy rule as booking');
reset role;
select set_config('test.schedule.other_minute',extract(epoch from(doctor_private.schedule_instant(pg_temp.day(),780,'Africa/Cairo')at time zone'Europe/London')::time)::integer::text,true);
-- Convert seconds since local midnight to the other clinic's minutes.
select set_config('test.schedule.other_minute',(current_setting('test.schedule.other_minute')::integer/60)::text,true);
set local role authenticated;
select pg_temp.claim(1);
select throws_ok($$select pg_temp.book(3,2,current_setting('test.schedule.other_minute')::integer)$$,'40001','DOCTOR_APPOINTMENT_CONFLICT','DOS-M1-013-C01: same doctor cannot overlap at another clinic/timezone');
select lives_ok($$select pg_temp.book(4,1,800)$$,'adjacent appointment is allowed without overlap');
select throws_ok($$select pg_temp.book(5,1,781)$$,'40001','DOCTOR_APPOINTMENT_CONFLICT','a client cannot choose an unoffered minute');
select throws_ok($$select pg_temp.book(6,1,500)$$,'40001','DOCTOR_APPOINTMENT_CONFLICT','metadata override cannot bypass closed hours');
select throws_ok($$select pg_temp.book(7,1,820,1,2)$$,'42501','DOCTOR_ACCESS_DENIED','foreign-practice patient cannot be booked');
select is((public.doctor_location_archive_status(pg_temp.id('83',1),pg_temp.id('84',1))->>'can_archive')::boolean,false,'upcoming actual appointments block clinic archive');
select throws_ok($$select public.doctor_archive_location(pg_temp.id('83',1),pg_temp.id('84',1),1,pg_temp.id('86',201))$$,'23503','DOCTOR_LOCATION_HAS_DEPENDENCIES','actual booking references cannot be silently orphaned by clinic archive');
select throws_ok($$select count(*) from public.appointments$$,'42501',null,'client cannot bypass scope through direct appointment SELECT');
select throws_ok($$update public.appointments set state='cancelled'$$,'42501',null,'client cannot bypass server transition commands');
select pg_temp.claim(3);
select lives_ok($$select pg_temp.save(3)$$,'independent doctor B configures their own hours');
select lives_ok($$select pg_temp.book(8,3,780,1,2)$$,'independent doctor B can work at the same UTC instant');
select throws_ok($$select public.doctor_schedule(pg_temp.id('83',1),pg_temp.id('84',1))$$,'42501','DOCTOR_ACCESS_DENIED','another doctor cannot discover private clinic schedule');
select pg_temp.claim(2);
select lives_ok($$select public.doctor_schedule(pg_temp.id('83',1),pg_temp.id('84',1))$$,'secretary can manage the explicitly granted clinic');
select throws_ok($$select public.doctor_schedule(pg_temp.id('83',1),pg_temp.id('84',2))$$,'42501','DOCTOR_ACCESS_DENIED','DOS-M1-013-C02: ungranted clinic remains inaccessible');
select lives_ok($$select public.doctor_availability(pg_temp.id('83',2),pg_temp.id('84',3),pg_temp.day())$$,'independent read grant for B remains usable');
select throws_ok($$select public.doctor_write_schedule(pg_temp.id('83',2),pg_temp.id('84',3),1,pg_temp.hours(),pg_temp.id('86',202))$$,'42501','DOCTOR_ACCESS_DENIED','read grant for B never becomes a manage grant');
select lives_ok($$select pg_temp.book(9,1,820)$$,'secretary can book only with all explicit read/write prerequisites');
select pg_temp.claim(4);
select throws_ok($$select pg_temp.book(10,1,840)$$,'42501','DOCTOR_ACCESS_DENIED','read-only appointment grant cannot book');
select throws_ok($$select public.doctor_write_schedule(pg_temp.id('83',1),pg_temp.id('84',1),1,pg_temp.hours(),pg_temp.id('86',203))$$,'42501','DOCTOR_ACCESS_DENIED','read-only schedule cannot edit hours');
select pg_temp.claim(5);
select throws_ok($$select public.doctor_availability(pg_temp.id('83',1),pg_temp.id('84',1),pg_temp.day())$$,'42501','DOCTOR_ACCESS_DENIED','write capability does not implicitly grant read');
select pg_temp.claim(6);
select lives_ok($$select public.doctor_schedule(pg_temp.id('83',1),pg_temp.id('84',1))$$,'availability manager can read rules without appointment patient access');
select throws_ok($$select pg_temp.book(11,1,840)$$,'42501','DOCTOR_ACCESS_DENIED','availability manager cannot book without appointment grants');
reset role;
select is((select count(*) from public.appointments where practice_id=pg_temp.id('83',1)),3::bigint,'only authorized successful bookings exist');
select is((select count(*) from public.appointment_events where practice_id=pg_temp.id('83',1)),3::bigint,'one attributed event per successful booking');
select is((select doctor_user_id from public.appointments where id=pg_temp.appointment()),pg_temp.id('81',1),'owning doctor comes from stored practice ownership');
select set_config('test.schedule.before_hours',(select jsonb_agg(to_jsonb(a) order by id)::text from public.appointments a where practice_id=pg_temp.id('83',1)),true);
select throws_ok($$insert into public.appointments(practice_id,doctor_user_id,location_id,patient_id,starts_at,ends_at,timezone,location_name,created_by)values(pg_temp.id('83',1),pg_temp.id('81',1),pg_temp.id('84',2),pg_temp.id('88',1),doctor_private.schedule_instant(pg_temp.day(),780,'Africa/Cairo'),doctor_private.schedule_instant(pg_temp.day(),800,'Africa/Cairo'),'Europe/London','Synthetic unsafe write',pg_temp.id('81',1))$$,'23P01',null,'actual database exclusion protects against a privileged accidental overlap');
set local role authenticated;
select pg_temp.claim(1);
select lives_ok($$select public.doctor_write_schedule(pg_temp.id('83',1),pg_temp.id('84',1),1,pg_temp.hours()||jsonb_build_object('exceptions',jsonb_build_array(jsonb_build_object('date',pg_temp.day(),'closed',true,'windows','[]'::jsonb,'reason','Synthetic closed day'))),pg_temp.id('86',204))$$,'owner can record an explicit closure while preserving existing commitments');
select is(jsonb_array_length(public.doctor_availability(pg_temp.id('83',1),pg_temp.id('84',1),pg_temp.day())->'slots'),0,'DOS-M1-013-C02: closed-day exception overrides normal hours');
select throws_ok($$select pg_temp.book(12,1,860,1)$$,'40001','DOCTOR_AVAILABILITY_CONFLICT','changed rule version invalidates an earlier offer');
select throws_ok($$select pg_temp.book(13,1,860,2)$$,'40001','DOCTOR_APPOINTMENT_CONFLICT','owner cannot override explicit closure through booking');
select is(pg_temp.book(1),current_setting('test.schedule.booked')::jsonb,'committed retry does not create a new appointment after hours change');
select lives_ok($$select pg_temp.save(4,0,jsonb_build_object('slot_minutes',20,'weekly','[]'::jsonb,'exceptions',jsonb_build_array(jsonb_build_object('date',pg_temp.day(),'closed',false,'windows','[{"start":540,"end":600}]'::jsonb,'reason','Synthetic special hours'))))$$,'explicit special opening can replace a normally closed day');
select is(jsonb_array_length(public.doctor_availability(pg_temp.id('83',1),pg_temp.id('84',4),pg_temp.day())->'slots'),3,'special opening offers only its stated windows');
select is((select details->'after'->>'override_policy' from public.audit_events where practice_id=pg_temp.id('83',1) and event_type='availability.updated' and entity_id=pg_temp.id('84',1) order by id desc limit 1),'deny','audit preserves explicit override policy and actual actor attribution');
reset role;
select is((select jsonb_agg(to_jsonb(a) order by id) from public.appointments a where practice_id=pg_temp.id('83',1)),current_setting('test.schedule.before_hours')::jsonb,'DOS-M1-013-C03: editing hours makes no hidden appointment changes');
select is((select count(*) from public.appointment_events where practice_id=pg_temp.id('83',1)),3::bigint,'editing hours adds no appointment transitions');
select ok(exists(select 1 from public.audit_events where practice_id=pg_temp.id('83',1) and event_type='availability.updated' and details->>'appointments_changed'='false'),'hours changes explicitly audit preservation');
set local role anon;
select throws_ok($$select public.doctor_schedule(pg_temp.id('83',1),pg_temp.id('84',1))$$,'42501',null,'anonymous schedule access is denied');
select * from finish();
rollback;
