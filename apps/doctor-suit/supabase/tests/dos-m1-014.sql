begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.id(prefix text,n integer)returns uuid language sql immutable as $$select(prefix||'000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$$;
insert into auth.users(id,email,email_confirmed_at,is_anonymous)select pg_temp.id('a1',n),'synthetic-queue-'||n||'@example.test',now(),false from generate_series(1,5)n;
insert into auth.sessions(id,user_id,not_after)select pg_temp.id('a2',n),pg_temp.id('a1',n),now()+interval '1 hour' from generate_series(1,5)n;
insert into public.doctor_profiles(user_id,display_name)values(pg_temp.id('a1',1),'Synthetic queue A'),(pg_temp.id('a1',2),'Synthetic queue B');
insert into public.practices(id,owner_user_id,name)values(pg_temp.id('a3',1),pg_temp.id('a1',1),'Synthetic queue A'),(pg_temp.id('a3',2),pg_temp.id('a1',2),'Synthetic queue B');
insert into public.locations(id,practice_id,name,timezone)values(pg_temp.id('a4',1),pg_temp.id('a3',1),'Queue A1','Etc/UTC'),(pg_temp.id('a4',2),pg_temp.id('a3',1),'Queue A2','Etc/UTC'),(pg_temp.id('a4',3),pg_temp.id('a3',2),'Queue B1','Etc/UTC');
insert into public.patient_identities(id)values(pg_temp.id('a7',1)),(pg_temp.id('a7',2));
insert into public.practice_patients(id,practice_id,patient_identity_id,display_name,created_location_id,created_by)values(pg_temp.id('a8',1),pg_temp.id('a3',1),pg_temp.id('a7',1),'Synthetic queue patient A',pg_temp.id('a4',1),pg_temp.id('a1',1)),(pg_temp.id('a8',2),pg_temp.id('a3',2),pg_temp.id('a7',2),'Synthetic queue patient B',pg_temp.id('a4',3),pg_temp.id('a1',2));
insert into public.memberships(id,practice_id,user_id,capabilities)values
 (pg_temp.id('a5',1),pg_temp.id('a3',1),pg_temp.id('a1',3),array['appointments.read','appointments.write','queue.manage','patients.read']),
 (pg_temp.id('a5',2),pg_temp.id('a3',2),pg_temp.id('a1',3),array['appointments.read']),
 (pg_temp.id('a5',3),pg_temp.id('a3',1),pg_temp.id('a1',4),array['appointments.read']),
 (pg_temp.id('a5',4),pg_temp.id('a3',1),pg_temp.id('a1',5),array['appointments.read','appointments.write']);
insert into public.membership_locations(practice_id,membership_id,location_id,capabilities)select practice_id,id,case when practice_id=pg_temp.id('a3',2)then pg_temp.id('a4',3)else pg_temp.id('a4',1)end,capabilities from public.memberships where id::text like 'a5000000-%';
create function pg_temp.claim(n integer)returns text language sql as $$select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id('a1',n),'session_id',pg_temp.id('a2',n),'role','authenticated')::text,true)$$;
create function pg_temp.board(location integer default 1,page integer default 0,queue_page integer default 0)returns jsonb language sql as $$select public.doctor_appointment_board(pg_temp.id('a3',case when location=3 then 2 else 1 end),pg_temp.id('a4',location),current_date,page,queue_page)$$;
-- Fixture creation is owner-only, separate from the tested authenticated APIs.
create function pg_temp.seed(n integer,location integer default 1,state text default 'booked')returns uuid language plpgsql security definer as $$
declare item uuid:=pg_temp.id('a9',n); practice integer:=case when location=3 then 2 else 1 end; stamp timestamptz:=date_trunc('day',now())+(n%24)*interval '1 hour';
begin
 insert into public.appointments(id,practice_id,doctor_user_id,location_id,patient_id,starts_at,ends_at,timezone,location_name,state,created_by,checked_in_at,started_at,completed_at)values(item,pg_temp.id('a3',practice),pg_temp.id('a1',practice),pg_temp.id('a4',location),pg_temp.id('a8',practice),stamp,stamp+interval '20 minutes','Etc/UTC','Queue '||location,state,pg_temp.id('a1',practice),case when state in('checked_in','in_progress','completed')then now()end,case when state in('in_progress','completed')then now()end,case when state='completed'then now()end);
 insert into public.appointment_events(practice_id,appointment_id,actor_user_id,location_id,event_type,record_version,details)values(pg_temp.id('a3',practice),item,pg_temp.id('a1',practice),pg_temp.id('a4',location),'appointment.booked',1,jsonb_build_object('timezone','Etc/UTC','location_name','Queue '||location));return item;
end $$;
create function pg_temp.command(n integer,state text,version integer default 1,key integer default 100,reason text default '')returns jsonb language sql as $$select public.doctor_transition_appointment(pg_temp.id('a3',1),pg_temp.id('a4',1),pg_temp.id('a9',n),version,state,reason,pg_temp.id('aa',key))$$;
create function pg_temp.transition_case(previous text,target text)returns text language plpgsql security definer as $$
declare case_id uuid:=gen_random_uuid(); stamp timestamptz:=case when target='checked_in' then date_trunc('day',clock_timestamp())+interval '12 hours' else clock_timestamp()-interval '10 minutes' end; result text;
begin
 insert into public.appointments(id,practice_id,doctor_user_id,location_id,patient_id,starts_at,ends_at,timezone,location_name,state,created_by,checked_in_at,started_at,completed_at)values(case_id,pg_temp.id('a3',1),pg_temp.id('a1',1),pg_temp.id('a4',1),pg_temp.id('a8',1),stamp,stamp+interval '5 minutes','Etc/UTC','Queue A1',previous,pg_temp.id('a1',1),case when previous in('checked_in','in_progress','completed')then now()end,case when previous in('in_progress','completed')then now()end,case when previous='completed'then now()end);
 begin perform public.doctor_transition_appointment(pg_temp.id('a3',1),pg_temp.id('a4',1),case_id,1,target,case when target in('cancelled','no_show')then 'Synthetic resolution'else ''end,gen_random_uuid()); result:='ok';
 exception when others then result:=sqlstate; end;
 delete from public.appointment_events where appointment_id=case_id;delete from public.appointments where appointments.id=case_id;return result;
end $$;
select pg_temp.claim(1);
-- DOS-M1-014-C01: every source/target pair, including all terminal-state exits.
select is(pg_temp.transition_case(previous,target),case
 when(previous='booked'and target in('checked_in','cancelled','no_show'))or(previous='checked_in'and target in('in_progress','cancelled'))or(previous='in_progress'and target='completed')then 'ok'else '22023'end,
 'DOS-M1-014-C01: transition '||previous||' to '||target)
 from unnest(array['booked','checked_in','in_progress','completed','cancelled','no_show'])previous cross join unnest(array['booked','checked_in','in_progress','completed','cancelled','no_show'])target;
select pg_temp.seed(12);select pg_temp.seed(13);select pg_temp.seed(14,2);select pg_temp.seed(15,3);select pg_temp.seed(16);
set local role authenticated;
select pg_temp.claim(1);
select is(pg_temp.board()->>'external_notifications','disabled','DOS-M1-014-C04: external dispatch stays disabled');
select is(pg_temp.board()->>'total','3','day list includes only current clinic');
select is((pg_temp.board()->'items'->0)->>'patient_name','Synthetic queue patient A','owner has current patient read authority');
select throws_ok($$select public.doctor_appointment_board(pg_temp.id('a3',2),pg_temp.id('a4',3),current_date)$$,'42501','DOCTOR_ACCESS_DENIED','Doctor A cannot read Doctor B');
select throws_ok($$select pg_temp.board(1,-1)$$,'22023','DOCTOR_APPOINTMENT_INVALID','page bounds are validated');
select throws_ok($$select pg_temp.board(1,0,-1)$$,'22023','DOCTOR_APPOINTMENT_INVALID','queue page bounds are validated');
select throws_ok($$select * from public.appointments$$,'42501',null,'direct appointment reads are denied');
select throws_ok($$update public.appointments set state='completed'$$,'42501',null,'direct lifecycle writes are denied');
select throws_ok($$update public.appointment_queue_revisions set revision=999$$,'42501',null,'clients cannot fabricate revision events');
select is((select count(*)from public.appointment_queue_revisions),2::bigint,'Realtime RLS hides Doctor B counters');
reset role;
create policy fixture_future_queue_read on public.appointment_queue_revisions for select to authenticated using(true);
set local role authenticated;
select is((select count(*)from public.appointment_queue_revisions),2::bigint,'restrictive queue guard still hides Doctor B under a future permissive policy');
reset role;drop policy fixture_future_queue_read on public.appointment_queue_revisions;set local role authenticated;
select is(pg_temp.command(12,'checked_in')->>'state','checked_in','check-in succeeds once');
select is(pg_temp.command(12,'checked_in')->>'version','2','uncertain check-in retry returns the original receipt');
select is(pg_temp.board()->>'queue_total','1','duplicate check-in retains one queue identity');
select throws_ok($$select pg_temp.command(12,'checked_in',1,101)$$,'40001','DOCTOR_APPOINTMENT_CONFLICT','a second reception session with stale CAS cannot check in twice');
select throws_ok($$select pg_temp.command(12,'checked_in',2,101)$$,'22023','DOCTOR_APPOINTMENT_TRANSITION_DENIED','current-version duplicate transition is illegal');
select is(pg_temp.command(13,'checked_in',1,102)->>'version','2','second appointment checks in');
select is(pg_temp.command(12,'in_progress',2,103)->>'state','in_progress','one appointment starts');
select throws_ok($$select pg_temp.command(13,'in_progress',2,104)$$,'40001','DOCTOR_QUEUE_ALREADY_IN_PROGRESS','one doctor cannot serve two queue entries');
select throws_ok($$select pg_temp.command(12,'cancelled',3,105,'Synthetic stop')$$,'22023','DOCTOR_APPOINTMENT_TRANSITION_DENIED','in-progress cancellation requires completion rather than hidden removal');
select is(pg_temp.command(12,'completed',3,106)->>'state','completed','administrative completion removes the active entry');
select is(pg_temp.board()->>'queue_total','1','completion preserves remaining queue entry only');
select is(pg_temp.command(13,'cancelled',2,107,'Synthetic patient cancelled')->>'state','cancelled','DOS-M1-014-C02: checked-in cancellation is explicit');
select is(pg_temp.command(13,'cancelled',2,107,'Synthetic patient cancelled')->>'version','3','cancel replay preserves a single effective transition');
select is(pg_temp.board()->>'queue_total','0','cancelled checked-in entry is no longer active');
select is(public.doctor_appointment_history(pg_temp.id('a3',1),pg_temp.id('a4',1),pg_temp.id('a9',13))->>'total','3','book/check-in/cancel history is retained');
select is((public.doctor_appointment_history(pg_temp.id('a3',1),pg_temp.id('a4',1),pg_temp.id('a9',13))->'events'->0->'details')->>'reason','Synthetic patient cancelled','cancellation is attributed with administrative reason');
select throws_ok($$select pg_temp.command(16,'cancelled',1,108,'')$$,'22023','DOCTOR_APPOINTMENT_REASON_REQUIRED','cancellation cannot omit its reason');
select throws_ok($$select pg_temp.command(16,'cancelled',1,108,E'unsafe\nreason')$$,'22023','DOCTOR_APPOINTMENT_REASON_REQUIRED','reason rejects controls');
select pg_temp.claim(4);
select is((pg_temp.board()->'items'->0)->>'patient_name',null,'appointment-only read does not implicitly grant patient details');
select throws_ok($$select pg_temp.command(16,'checked_in',1,109)$$,'42501','DOCTOR_ACCESS_DENIED','readonly appointment grant cannot manage queue');
select throws_ok($$select pg_temp.command(16,'cancelled',1,109,'Synthetic cancellation')$$,'42501','DOCTOR_ACCESS_DENIED','readonly appointment grant cannot cancel');
select pg_temp.claim(5);
select throws_ok($$select pg_temp.command(16,'checked_in',1,110)$$,'42501','DOCTOR_ACCESS_DENIED','appointment write does not implicitly grant queue manage');
select pg_temp.claim(3);
select lives_ok($$select pg_temp.board(3)$$,'same secretary keeps independent Doctor B read');
select throws_ok($$select pg_temp.board(2)$$,'42501','DOCTOR_ACCESS_DENIED','secretary cannot read ungranted A2');
select is((select count(*)from public.appointment_queue_revisions),2::bigint,'secretary Realtime counters include only A1 and B1');
reset role;
-- Rule-driven rescheduling uses actual future slots and captures clinic snapshots.
select pg_temp.claim(1);
select public.doctor_write_schedule(pg_temp.id('a3',1),pg_temp.id('a4',1),0,jsonb_build_object('slot_minutes',20,'weekly',(select jsonb_agg(jsonb_build_object('weekday',day,'start',540,'end',1020))from generate_series(0,6)day),'exceptions','[]'::jsonb),pg_temp.id('aa',200),1);
select public.doctor_write_schedule(pg_temp.id('a3',1),pg_temp.id('a4',2),0,jsonb_build_object('slot_minutes',20,'weekly',(select jsonb_agg(jsonb_build_object('weekday',day,'start',540,'end',1020))from generate_series(0,6)day),'exceptions','[]'::jsonb),pg_temp.id('aa',201),1);
create function pg_temp.move(key integer default 210,minute integer default 600)returns jsonb language sql as $$select public.doctor_reschedule_appointment(pg_temp.id('a3',1),pg_temp.id('a4',1),pg_temp.id('a9',16),1,pg_temp.id('a4',2),current_date+7,minute,1,1,'Synthetic requested clinic change',pg_temp.id('aa',key))$$;
set local role authenticated;
select pg_temp.claim(3);
select throws_ok($$select pg_temp.move()$$,'42501','DOCTOR_ACCESS_DENIED','cross-clinic reschedule requires fresh destination authority');
select pg_temp.claim(1);
select is(pg_temp.move()->>'version','2','DOS-M1-014-C02: cross-clinic reschedule succeeds');
select is(pg_temp.move()->>'version','2','source-to-destination exact retry returns one receipt');
select throws_ok($$select pg_temp.move(210,620)$$,'22023','DOCTOR_IDEMPOTENCY_CONFLICT','same move key cannot name different material');
select is(public.doctor_appointment_history(pg_temp.id('a3',1),pg_temp.id('a4',2),pg_temp.id('a9',16))->>'total','2','rescheduling preserves original booking event');
select is((public.doctor_appointment_history(pg_temp.id('a3',1),pg_temp.id('a4',2),pg_temp.id('a9',16))->'events'->0->'details'->'from')->>'location_id',pg_temp.id('a4',1)::text,'reschedule history records original clinic');
select is((public.doctor_appointment_history(pg_temp.id('a3',1),pg_temp.id('a4',2),pg_temp.id('a9',16))->'events'->0->'details'->'to')->>'timezone','Etc/UTC','reschedule retains actual destination timezone');
select throws_ok($$select public.doctor_transition_appointment(pg_temp.id('a3',1),pg_temp.id('a4',2),pg_temp.id('a9',16),2,'checked_in','',pg_temp.id('aa',211))$$,'22023','DOCTOR_APPOINTMENT_CHECKIN_DAY','future appointment cannot silently enter today queue');
select pg_temp.claim(3);
select lives_ok($$select pg_temp.board(3)$$,'independent Doctor B remains readable after A changes');
reset role;
select is((select count(*)from public.appointment_events where appointment_id=pg_temp.id('a9',13)and event_type='appointment.cancelled'),1::bigint,'retry appends one cancellation event');
select ok((select checked_in_at is not null from public.appointments where id=pg_temp.id('a9',13)),'cancel preserves check-in attribution');
select ok((select checked_in_at is not null and started_at is not null and completed_at is not null from public.appointments where id=pg_temp.id('a9',12)),'completion retains all lifecycle clocks');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime'and schemaname='public'and tablename='appointment_queue_revisions'),'only minimal revision interface is explicitly published');
select is((select count(*)from pg_publication_tables where pubname='supabase_realtime'and schemaname='public'),1::bigint,'patient and appointment tables are absent from Realtime publication');
select is((select count(*)from information_schema.columns where table_schema='public'and table_name='appointment_queue_revisions'),3::bigint,'revision payload contains only practice, clinic and counter');
select pg_temp.claim(3);
update public.memberships set status='revoked' where id=pg_temp.id('a5',1);
set local role authenticated;
select throws_ok($$select pg_temp.board()$$,'42501','DOCTOR_ACCESS_DENIED','current membership revocation denies authoritative refresh');
select is((select count(*)from public.appointment_queue_revisions),1::bigint,'Realtime RLS removes revoked practice while retaining independent B');
select lives_ok($$select pg_temp.board(3)$$,'revocation in A does not clear B authority');
reset role;
delete from auth.sessions where id=pg_temp.id('a2',3);
set local role authenticated;
select throws_ok($$select pg_temp.board(3)$$,'42501',null,'revoked Auth SID cannot restore independent data');
select is((select count(*)from public.appointment_queue_revisions),0::bigint,'revoked Auth SID matches no revision payloads');
reset role;
-- DOS-M1-008-C01/C02: actual appointment references, retained snapshots and
-- a past active queue dependency now have concrete lifecycle acceptance.
select pg_temp.claim(1);
select pg_temp.seed(17,1,'checked_in');
update public.appointments set starts_at=now()-interval '2 days',ends_at=now()-interval '2 days'+interval '20 minutes' where id=pg_temp.id('a9',17);
select set_config('test.queue.original_clocks',(select jsonb_agg(jsonb_build_object('id',id,'starts_at',starts_at,'ends_at',ends_at,'timezone',timezone,'location_name',location_name)order by id)from public.appointments where practice_id=pg_temp.id('a3',1))::text,true);
set local role authenticated;
select lives_ok($$select public.doctor_write_location(pg_temp.id('a3',1),'Renamed synthetic clinic','Europe/London','','',pg_temp.id('aa',259),pg_temp.id('a4',1),1)$$,'DOS-M1-008-C02: clinic correction preserves appointment snapshots');
select throws_ok($$select public.doctor_archive_location(pg_temp.id('a3',1),pg_temp.id('a4',1),2,pg_temp.id('aa',261))$$,'23503','DOCTOR_LOCATION_HAS_DEPENDENCIES','DOS-M1-008-C01: a past active queue entry blocks clinic archive');
reset role;
select is((select jsonb_agg(jsonb_build_object('id',id,'starts_at',starts_at,'ends_at',ends_at,'timezone',timezone,'location_name',location_name)order by id)from public.appointments where practice_id=pg_temp.id('a3',1)),current_setting('test.queue.original_clocks')::jsonb,'changing clinic timezone/name makes no hidden appointment changes');
set local role authenticated;
select is(pg_temp.command(17,'cancelled',1,260,'Synthetic past-queue resolution')->>'state','cancelled','past queue entry requires explicit attributed resolution');
select lives_ok($$select public.doctor_archive_location(pg_temp.id('a3',1),pg_temp.id('a4',1),2,pg_temp.id('aa',261))$$,'resolved clinic archives without deleting historical appointments');
reset role;
select is((select count(*)from public.appointments where practice_id=pg_temp.id('a3',1)and location_id=pg_temp.id('a4',1)),3::bigint,'archived clinic retains all actual appointment references');
select is((select timezone from public.appointments where id=pg_temp.id('a9',12)),'Etc/UTC','historical appointment retains original timezone after clinic correction/archive');
select is((select location_name from public.appointments where id=pg_temp.id('a9',12)),'Queue 1','historical appointment retains original clinic name');
select is((select details->'from'->>'location_id'from public.appointment_events where appointment_id=pg_temp.id('a9',16)and event_type='appointment.rescheduled'),pg_temp.id('a4',1)::text,'moved appointment history still identifies archived origin clinic');
select *from finish();
rollback;
