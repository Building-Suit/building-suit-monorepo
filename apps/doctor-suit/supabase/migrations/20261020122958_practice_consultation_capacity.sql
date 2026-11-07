-- Locations already enforce IANA names through locations_timezone. Keep one
-- clock algorithm, while avoiding a scan of every IANA zone for each offered minute.
-- The checked entry point retains its original semantics for other internal callers.
create function doctor_private.schedule_clock(p_day date,p_minute integer,p_zone text) returns timestamptz
language plpgsql stable security invoker set search_path='' as $$
declare local_clock timestamp; nominal timestamptz; candidates timestamptz[];
begin
  if p_day is null or p_minute is null or p_minute not between 0 and 1440 or p_zone is null then return null; end if;
  local_clock:=p_day::timestamp+make_interval(mins=>p_minute); nominal:=local_clock at time zone p_zone;
  select array_agg(distinct candidate) into candidates from (
    select (local_clock at time zone 'UTC')-((probe at time zone p_zone)-(probe at time zone 'UTC')) candidate
      from generate_series(nominal-interval '2 days',nominal+interval '2 days',interval '6 hours')probe
  )times where candidate at time zone p_zone=local_clock;
  if cardinality(candidates)=1 then return candidates[1]; end if;
  return null;
end $$;
create or replace function doctor_private.schedule_instant(p_day date,p_minute integer,p_zone text)returns timestamptz
language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_zone)then return null;end if;
 return doctor_private.schedule_clock(p_day,p_minute,p_zone);
end $$;
revoke all on function doctor_private.schedule_clock(date,integer,text)from public,anon,authenticated,service_role;
-- DOS-M3-001. Synthetic operations; single-doctor capacity remains one.
-- No clinical approval or capacity override is granted by this migration.
create table public.consultation_types (
 practice_id uuid not null references public.practices(id), id uuid not null default gen_random_uuid(),
 version integer not null check(version>0), name text not null check(length(name) between 1 and 100),
 duration_minutes integer not null check(duration_minutes between 5 and 120),
 buffer_before integer not null check(buffer_before between 0 and 120),
 buffer_after integer not null check(buffer_after between 0 and 120),
 capacity integer not null default 1 check(capacity=1),
 location_ids uuid[] not null check(cardinality(location_ids) between 1 and 100),
 active boolean not null, actor_user_id uuid not null references auth.users(id),
 happened_at timestamptz not null default clock_timestamp(), primary key(practice_id,id,version)
);
alter table public.consultation_types enable row level security;
revoke all on public.consultation_types from public,anon,authenticated,service_role;
create index consultation_types_actor on public.consultation_types(actor_user_id);
alter table public.appointments add column consultation_snapshot jsonb,
 add column commitment_start timestamptz, add column commitment_end timestamptz;
update public.appointments set commitment_start=starts_at,commitment_end=ends_at;
alter table public.appointments alter column commitment_start set not null,alter column commitment_end set not null;
create function doctor_private.appointment_commitment()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.consultation_snapshot is distinct from old.consultation_snapshot then
  raise exception using errcode='22023',message='DOCTOR_CONSULTATION_SNAPSHOT_IMMUTABLE';end if;
 if new.consultation_snapshot is not null then
  if not exists(select 1 from public.consultation_types t where t.practice_id=new.practice_id
    and t.id=(new.consultation_snapshot->>'id')::uuid and t.version=(new.consultation_snapshot->>'version')::integer
    and new.consultation_snapshot=to_jsonb(t)-array['actor_user_id','happened_at'])
    or new.ends_at-new.starts_at<>make_interval(mins=>(new.consultation_snapshot->>'duration_minutes')::integer)
    or not new.location_id=any(array(select jsonb_array_elements_text(new.consultation_snapshot->'location_ids')::uuid)) then
   raise exception using errcode='22023',message='DOCTOR_CONSULTATION_INVALID';end if;
 end if;
 new.commitment_start:=new.starts_at-make_interval(mins=>coalesce((new.consultation_snapshot->>'buffer_before')::integer,0));
 new.commitment_end:=new.ends_at+make_interval(mins=>coalesce((new.consultation_snapshot->>'buffer_after')::integer,0));
 return new;
end $$;
create trigger appointment_commitment before insert or update on public.appointments for each row execute function doctor_private.appointment_commitment();
alter table public.appointments add constraint doctor_buffered_commitment_no_overlap exclude using gist
 (doctor_user_id extensions.gist_uuid_ops with =,tstzrange(commitment_start,commitment_end,'[)') with &&)
 where(state not in('cancelled','no_show'));
create function doctor_private.operations_scope(p_practice uuid,p_location uuid,p_capability text)returns void
language plpgsql security definer set search_path='' as $$
begin
 perform doctor_private.current_actor();
 if (select mode from public.doctor_edition_policy where singleton) is distinct from 'synthetic_preview' then
  raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 perform doctor_private.schedule_scope(p_practice,p_location);
 perform doctor_private.require_access(p_practice,p_capability,p_location);
end $$;
create function doctor_private.consultation_snapshot(p_practice uuid,p_location uuid,p_type uuid,p_version integer default null)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare t public.consultation_types;
begin
 select * into t from public.consultation_types where practice_id=p_practice and id=p_type
  and(p_version is null or version=p_version)order by version desc limit 1;
 if t.id is null or not t.active or not p_location=any(t.location_ids) then
  raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 return to_jsonb(t)-array['actor_user_id','happened_at'];
end $$;
create function doctor_private.read_consultation_types(p_practice uuid,p_location uuid)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;
begin
 perform doctor_private.operations_scope(p_practice,p_location,'appointments.read');
 select coalesce(jsonb_agg(to_jsonb(t)-array['actor_user_id','happened_at'] order by t.name,t.id),'[]')into rows
 from(select distinct on(id)* from public.consultation_types where practice_id=p_practice order by id,version desc)t
 where p_location=any(t.location_ids);
 return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'types',rows,'capacity',1,'override_policy','deny',
 'can_manage',doctor_private.has_access(p_practice,'availability.manage',p_location),'data_mode','synthetic');
end $$;
create function doctor_private.write_consultation_type(p_practice uuid,p_location uuid,p_type uuid,p_expected_version integer,p_input jsonb,p_key uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; prior doctor_private.command_receipts; request jsonb; current_version integer; item public.consultation_types; loc uuid; locations uuid[]; result jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='25000',message='DOCTOR_READ_COMMITTED_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
 perform doctor_private.operations_scope(p_practice,p_location,'availability.manage');actor:=doctor_private.current_actor();
 if p_type is null or p_key is null or p_expected_version is null or p_expected_version<0
 or jsonb_typeof(p_input) is distinct from 'object' or not p_input?&array['name','duration_minutes','buffer_before','buffer_after','capacity','location_ids','active']
 or p_input-array['name','duration_minutes','buffer_before','buffer_after','capacity','location_ids','active']<>'{}'
 or jsonb_typeof(p_input->'name') is distinct from 'string' or length(btrim(p_input->>'name'))not between 1 and 100
 or p_input->>'name' ~ '[[:cntrl:]]' or jsonb_typeof(p_input->'active') is distinct from 'boolean'
 or jsonb_typeof(p_input->'location_ids') is distinct from 'array' or jsonb_array_length(p_input->'location_ids')not between 1 and 100
 then raise exception using errcode='22023',message='DOCTOR_CONSULTATION_INVALID';end if;
 foreach loc in array array(select jsonb_array_elements_text(p_input->'location_ids')::uuid)loop
  perform doctor_private.operations_scope(p_practice,loc,'availability.manage');end loop;
 select array_agg(distinct value::uuid order by value::uuid)into locations from jsonb_array_elements_text(p_input->'location_ids');
 if not p_location=any(locations) or cardinality(locations)<>jsonb_array_length(p_input->'location_ids')
 or exists(select 1 from unnest(array['duration_minutes','buffer_before','buffer_after','capacity'])k
  where jsonb_typeof(p_input->k) is distinct from 'number' or (p_input->>k)!~'^[0-9]{1,3}$')
 or (p_input->>'duration_minutes')::integer not between 5 and 120 or(p_input->>'buffer_before')::integer not between 0 and 120
 or(p_input->>'buffer_after')::integer not between 0 and 120 or(p_input->>'capacity')::integer<>1
 then raise exception using errcode='22023',message='DOCTOR_CONSULTATION_INVALID';end if;
 -- Revoked access to any previously assigned location also blocks a global revision.
 for loc in select l.id from(select location_ids from public.consultation_types where practice_id=p_practice and id=p_type order by version desc limit 1)t cross join unnest(t.location_ids)x join public.locations l on l.id=x and l.practice_id=p_practice where l.archived_at is null loop
  perform doctor_private.operations_scope(p_practice,loc,'availability.manage');end loop;
 request:=jsonb_build_object('command','consultation.write','session',auth.jwt()->>'session_id','practice',p_practice,'location',p_location,'id',p_type,'version',p_expected_version,'input',p_input);
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select coalesce(max(version),0)into current_version from public.consultation_types where practice_id=p_practice and id=p_type;
 if current_version<>p_expected_version then raise exception using errcode='40001',message='DOCTOR_AVAILABILITY_CONFLICT';end if;
 insert into public.consultation_types(practice_id,id,version,name,duration_minutes,buffer_before,buffer_after,capacity,location_ids,active,actor_user_id)
 values(p_practice,p_type,current_version+1,btrim(p_input->>'name'),(p_input->>'duration_minutes')::integer,(p_input->>'buffer_before')::integer,(p_input->>'buffer_after')::integer,1,locations,(p_input->>'active')::boolean,actor)returning * into item;
 result:=to_jsonb(item)-array['actor_user_id','happened_at'];
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(p_practice,actor,'consultation.configured',p_type,jsonb_build_object('location_id',p_location,'version',item.version,'capacity',1));
 insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
end $$;
-- The same interval rule is used by all legacy and typed availability/booking.
create function doctor_private.consultation_slot(p_practice uuid,p_location uuid,p_day date,p_minute integer,p_snapshot jsonb,p_ignore uuid default null)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare config public.location_schedules; place public.locations; doctor uuid; windows jsonb; begins timestamptz; ends timestamptz; buffered_start timestamptz; buffered_end timestamptz; reason text; duration integer; before_minutes integer; after_minutes integer;
begin
 select * into config from public.location_schedules where practice_id=p_practice and location_id=p_location;
 select * into place from public.locations where id=p_location and practice_id=p_practice and archived_at is null;
 if config.location_id is null or place.id is null or p_day is null or p_minute is null then return jsonb_build_object('minute',p_minute,'starts_at',null,'ends_at',null,'available',false,'reason','unconfigured');end if;
 duration:=coalesce((p_snapshot->>'duration_minutes')::integer,config.slot_minutes);before_minutes:=coalesce((p_snapshot->>'buffer_before')::integer,0);after_minutes:=coalesce((p_snapshot->>'buffer_after')::integer,0);
 windows:=doctor_private.schedule_day_windows(config,p_day);
 if not exists(select 1 from jsonb_array_elements(windows)w where p_minute-before_minutes>=(w->>'start')::integer and p_minute+duration+after_minutes<=(w->>'end')::integer
  and(p_minute-(w->>'start')::integer)%config.slot_minutes=0)then return jsonb_build_object('minute',p_minute,'starts_at',null,'ends_at',null,'available',false,'reason','outside_hours');end if;
 begins:=doctor_private.schedule_clock(p_day,p_minute,place.timezone);ends:=doctor_private.schedule_clock(p_day,p_minute+duration,place.timezone);
 buffered_start:=case when before_minutes=0 then begins else doctor_private.schedule_clock(p_day,p_minute-before_minutes,place.timezone)end;buffered_end:=case when after_minutes=0 then ends else doctor_private.schedule_clock(p_day,p_minute+duration+after_minutes,place.timezone)end;
 if begins is null or ends is null or buffered_start is null or buffered_end is null or ends-begins<>make_interval(mins=>duration)
 or begins-buffered_start<>make_interval(mins=>before_minutes)or buffered_end-ends<>make_interval(mins=>after_minutes)then reason:='ambiguous_or_missing_clock';
 elsif buffered_start<=clock_timestamp()then reason:='past';
 else
  select owner_user_id into doctor from public.practices where id=p_practice;
  if exists(select 1 from public.appointments where doctor_user_id=doctor and state not in('cancelled','no_show')and id is distinct from p_ignore
    and tstzrange(commitment_start,commitment_end,'[)')&&tstzrange(buffered_start,buffered_end,'[)'))then reason:='busy';end if;
 end if;
 return jsonb_build_object('minute',p_minute,'starts_at',begins,'ends_at',ends,'available',reason is null,'reason',reason);
end $$;
create or replace function doctor_private.schedule_slot(p_practice uuid,p_location uuid,p_day date,p_minute integer,p_ignore uuid default null)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare snapshot jsonb;
begin
 if p_ignore is not null then select consultation_snapshot into snapshot from public.appointments where practice_id=p_practice and id=p_ignore;
  if snapshot is not null and not p_location=any(array(select jsonb_array_elements_text(snapshot->'location_ids')::uuid))then
   return jsonb_build_object('minute',p_minute,'starts_at',null,'ends_at',null,'available',false,'reason','outside_hours');end if;
 end if;
 return doctor_private.consultation_slot(p_practice,p_location,p_day,p_minute,snapshot,p_ignore);
end $$;
create function doctor_private.consultation_availability(p_practice uuid,p_location uuid,p_day date,p_type uuid,p_version integer,p_appointment uuid default null)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare snapshot jsonb; config public.location_schedules; place public.locations; rows jsonb:='[]'; segment jsonb; minute integer;
begin
 perform doctor_private.operations_scope(p_practice,p_location,'appointments.read');
 if p_appointment is null then snapshot:=doctor_private.consultation_snapshot(p_practice,p_location,p_type);
  if(snapshot->>'version')::integer is distinct from p_version then raise exception using errcode='40001',message='DOCTOR_AVAILABILITY_CONFLICT';end if;
 else
  select consultation_snapshot into snapshot from public.appointments where practice_id=p_practice and id=p_appointment
   and doctor_private.has_access(p_practice,'appointments.read',location_id);
  if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
  if snapshot is not null and not p_location=any(array(select jsonb_array_elements_text(snapshot->'location_ids')::uuid))then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 end if;
 select * into config from public.location_schedules where practice_id=p_practice and location_id=p_location;
 select * into place from public.locations where practice_id=p_practice and id=p_location;
 if p_day is null or p_day<(clock_timestamp()at time zone place.timezone)::date or p_day>(clock_timestamp()at time zone place.timezone)::date+365 then raise exception using errcode='22023',message='DOCTOR_AVAILABILITY_DATE_INVALID';end if;
 for segment in select value from jsonb_array_elements(doctor_private.schedule_day_windows(config,p_day))loop
  for minute in select generate_series((segment->>'start')::integer,(segment->>'end')::integer-config.slot_minutes,config.slot_minutes)loop
   rows:=rows||jsonb_build_array(doctor_private.consultation_slot(p_practice,p_location,p_day,minute,snapshot,p_appointment));end loop;
 end loop;
 return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'date',p_day,'timezone',place.timezone,'location_version',place.version,'schedule_version',coalesce(config.version,0),'slot_minutes',coalesce((snapshot->>'duration_minutes')::integer,config.slot_minutes,20),'slots',rows,'override_policy','deny','consultation',snapshot);
end $$;
create function doctor_private.book_consultation(p_practice uuid,p_location uuid,p_patient uuid,p_day date,p_minute integer,p_schedule_version integer,p_location_version integer,p_key uuid,p_type uuid,p_type_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; config public.location_schedules; place public.locations; doctor uuid; slot jsonb; request jsonb; prior doctor_private.command_receipts; item public.appointments; result jsonb; snapshot jsonb;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='25000',message='DOCTOR_READ_COMMITTED_REQUIRED';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1)); perform doctor_private.schedule_scope(p_practice,p_location);
  perform doctor_private.require_access(p_practice,'appointments.read',p_location); perform doctor_private.require_access(p_practice,'appointments.write',p_location); perform doctor_private.require_access(p_practice,'patients.read',p_location);
  perform doctor_private.operations_scope(p_practice,p_location,'appointments.write');
  actor:=doctor_private.current_actor(); select * into place from public.locations where id=p_location and practice_id=p_practice;
  if not exists(select 1 from public.practice_patients where id=p_patient and practice_id=p_practice and archived_at is null) then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  if p_key is null or p_day is null or p_minute is null or p_minute not between 0 and 1439 or p_day<(clock_timestamp() at time zone place.timezone)::date or p_day>(clock_timestamp() at time zone place.timezone)::date+365 then raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_INVALID'; end if;
  request:=jsonb_build_object('command','consultation.book','session',auth.jwt()->>'session_id','type',p_type,'type_version',p_type_version,'practice',p_practice,'location',p_location,'patient',p_patient,'date',p_day,'minute',p_minute,'schedule_version',p_schedule_version,'location_version',p_location_version);
  select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
  if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if; return prior.result; end if;
  select * into config from public.location_schedules where practice_id=p_practice and location_id=p_location;
  if config.location_id is null or config.version is distinct from p_schedule_version or place.version is distinct from p_location_version then raise exception using errcode='40001',message='DOCTOR_AVAILABILITY_CONFLICT'; end if;
  snapshot:=doctor_private.consultation_snapshot(p_practice,p_location,p_type);
  if (snapshot->>'version')::integer is distinct from p_type_version then raise exception using errcode='40001',message='DOCTOR_AVAILABILITY_CONFLICT';end if;
  slot:=doctor_private.consultation_slot(p_practice,p_location,p_day,p_minute,snapshot);
  if not coalesce((slot->>'available')::boolean,false) then raise exception using errcode='40001',message='DOCTOR_APPOINTMENT_CONFLICT'; end if;
  select owner_user_id into doctor from public.practices where id=p_practice;
  insert into public.appointments(practice_id,doctor_user_id,location_id,patient_id,starts_at,ends_at,timezone,location_name,created_by,consultation_snapshot)
    values(p_practice,doctor,p_location,p_patient,(slot->>'starts_at')::timestamptz,(slot->>'ends_at')::timestamptz,place.timezone,place.name,actor,snapshot) returning * into item;
  insert into public.appointment_events(practice_id,appointment_id,actor_user_id,location_id,event_type,record_version,details)values(p_practice,item.id,actor,p_location,'appointment.booked',1,jsonb_build_object('starts_at',item.starts_at,'ends_at',item.ends_at,'timezone',item.timezone,'location_name',item.location_name,'consultation',snapshot));
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(p_practice,actor,'appointment.booked',item.id,jsonb_build_object('location_id',p_location,'patient_id',p_patient,'starts_at',item.starts_at,'ends_at',item.ends_at));
  result:=jsonb_build_object('appointment_id',item.id,'version',item.version); insert into doctor_private.command_receipts values(actor,p_key,request,result); return result;
exception when exclusion_violation then raise exception using errcode='40001',message='DOCTOR_APPOINTMENT_CONFLICT';
end $$;
create function public.doctor_consultation_types(p_practice uuid,p_location uuid)returns jsonb language sql stable security invoker set search_path='' as $$select doctor_private.read_consultation_types(p_practice,p_location)$$;
revoke all on function public.doctor_consultation_types(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.doctor_consultation_types(uuid,uuid)to authenticated;
revoke all on function doctor_private.read_consultation_types(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.read_consultation_types(uuid,uuid)to authenticated;
create function public.doctor_write_consultation_type(p_practice uuid,p_location uuid,p_type uuid,p_expected_version integer,p_input jsonb,p_key uuid)returns jsonb language sql security invoker set search_path='' as $$select doctor_private.write_consultation_type(p_practice,p_location,p_type,p_expected_version,p_input,p_key)$$;
revoke all on function public.doctor_write_consultation_type(uuid,uuid,uuid,integer,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.doctor_write_consultation_type(uuid,uuid,uuid,integer,jsonb,uuid)to authenticated;
revoke all on function doctor_private.write_consultation_type(uuid,uuid,uuid,integer,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.write_consultation_type(uuid,uuid,uuid,integer,jsonb,uuid)to authenticated;
create function public.doctor_consultation_availability(p_practice uuid,p_location uuid,p_day date,p_type uuid,p_version integer,p_appointment uuid default null)returns jsonb language sql stable security invoker set search_path='' as $$select doctor_private.consultation_availability(p_practice,p_location,p_day,p_type,p_version,p_appointment)$$;
revoke all on function public.doctor_consultation_availability(uuid,uuid,date,uuid,integer,uuid)from public,anon,authenticated,service_role;
grant execute on function public.doctor_consultation_availability(uuid,uuid,date,uuid,integer,uuid)to authenticated;
revoke all on function doctor_private.consultation_availability(uuid,uuid,date,uuid,integer,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.consultation_availability(uuid,uuid,date,uuid,integer,uuid)to authenticated;
create function public.doctor_book_consultation(p_practice uuid,p_location uuid,p_patient uuid,p_day date,p_minute integer,p_schedule_version integer,p_location_version integer,p_key uuid,p_type uuid,p_type_version integer)returns jsonb language sql security invoker set search_path='' as $$select doctor_private.book_consultation(p_practice,p_location,p_patient,p_day,p_minute,p_schedule_version,p_location_version,p_key,p_type,p_type_version)$$;
revoke all on function public.doctor_book_consultation(uuid,uuid,uuid,date,integer,integer,integer,uuid,uuid,integer)from public,anon,authenticated,service_role;
grant execute on function public.doctor_book_consultation(uuid,uuid,uuid,date,integer,integer,integer,uuid,uuid,integer)to authenticated;
revoke all on function doctor_private.book_consultation(uuid,uuid,uuid,date,integer,integer,integer,uuid,uuid,integer)from public,anon,authenticated,service_role;
grant execute on function doctor_private.book_consultation(uuid,uuid,uuid,date,integer,integer,integer,uuid,uuid,integer)to authenticated;
revoke all on function doctor_private.appointment_commitment(),doctor_private.operations_scope(uuid,uuid,text),doctor_private.consultation_snapshot(uuid,uuid,uuid,integer),doctor_private.consultation_slot(uuid,uuid,date,integer,jsonb,uuid)from public,anon,authenticated,service_role;

create or replace function doctor_private.appointment_projection(p_item public.appointments) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',p_item.id,'practice_id',p_item.practice_id,'location_id',p_item.location_id,
    'patient_id',p_item.patient_id,'patient_name',case when doctor_private.has_access(p_item.practice_id,'patients.read',p_item.location_id)
      then(select display_name from public.practice_patients where practice_id=p_item.practice_id and id=p_item.patient_id) else null end,
    'starts_at',p_item.starts_at,'ends_at',p_item.ends_at,'timezone',p_item.timezone,'location_name',p_item.location_name,
    'consultation_snapshot',p_item.consultation_snapshot,'state',p_item.state,'version',p_item.version,'checked_in_at',p_item.checked_in_at,'started_at',p_item.started_at,'completed_at',p_item.completed_at)
$$;
