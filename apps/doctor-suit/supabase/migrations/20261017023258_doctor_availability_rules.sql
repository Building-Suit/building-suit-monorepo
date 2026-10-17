-- DOS-M1-013. Synthetic administrative scheduling only; no clinical authority.
create extension if not exists btree_gist with schema extensions;
alter table public.practices add constraint practices_id_owner_unique unique(id,owner_user_id);
create table public.location_schedules (
  practice_id uuid not null,
  location_id uuid primary key,
  slot_minutes integer not null check(slot_minutes between 5 and 120),
  weekly jsonb not null check(jsonb_typeof(weekly)='array' and jsonb_array_length(weekly)<=28),
  exceptions jsonb not null check(jsonb_typeof(exceptions)='array' and jsonb_array_length(exceptions)<=50),
  version integer not null default 1 check(version>0),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  foreign key(practice_id,location_id) references public.locations(practice_id,id)
);
create index location_schedules_practice on public.location_schedules(practice_id,location_id);
create index location_schedules_actor on public.location_schedules(updated_by);
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null,
  doctor_user_id uuid not null,
  location_id uuid not null,
  patient_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  location_name text not null,
  state text not null default 'booked' check(state in ('booked','checked_in','in_progress','completed','cancelled','no_show')),
  version integer not null default 1 check(version>0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at>starts_at and ends_at<=starts_at+interval '2 hours'),
  unique(practice_id,id),
  foreign key(practice_id,doctor_user_id) references public.practices(id,owner_user_id),
  foreign key(practice_id,location_id) references public.locations(practice_id,id),
  foreign key(practice_id,patient_id) references public.practice_patients(practice_id,id),
  constraint doctor_commitment_no_overlap exclude using gist
    (doctor_user_id extensions.gist_uuid_ops with =,tstzrange(starts_at,ends_at,'[)') with &&)
    where(state not in ('cancelled','no_show'))
);
create index appointments_owner on public.appointments(practice_id,doctor_user_id);
create index appointments_location_time on public.appointments(practice_id,location_id,starts_at,id);
create index appointments_patient on public.appointments(practice_id,patient_id);
create index appointments_creator on public.appointments(created_by);
create table public.appointment_events (
  id bigint generated always as identity primary key,
  practice_id uuid not null,
  appointment_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  location_id uuid not null,
  event_type text not null,
  record_version integer not null check(record_version>0),
  happened_at timestamptz not null default now(),
  details jsonb not null default '{}',
  foreign key(practice_id,appointment_id) references public.appointments(practice_id,id),
  foreign key(practice_id,location_id) references public.locations(practice_id,id)
);
create index appointment_events_record on public.appointment_events(practice_id,appointment_id,id desc);
create index appointment_events_actor on public.appointment_events(actor_user_id);
create index appointment_events_location on public.appointment_events(practice_id,location_id);
alter table public.location_schedules enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_events enable row level security;
revoke all on public.location_schedules,public.appointments,public.appointment_events from public,anon,authenticated;
revoke all on sequence public.appointment_events_id_seq from public,anon,authenticated;

create function doctor_private.schedule_scope(p_practice uuid,p_location uuid,p_manage boolean default false) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  perform doctor_private.current_actor();
  if not exists(select 1 from public.locations where practice_id=p_practice and id=p_location and archived_at is null)
    or (p_manage and not doctor_private.has_access(p_practice,'availability.manage',p_location))
    or (not p_manage and not doctor_private.has_access(p_practice,'availability.manage',p_location) and not doctor_private.has_access(p_practice,'appointments.read',p_location)) then
    raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';
  end if;
end $$;
create function doctor_private.schedule_windows_input(p_windows jsonb,p_weekly boolean) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb; result jsonb;
begin
  if p_windows is null or jsonb_typeof(p_windows)<>'array' or jsonb_array_length(p_windows)>(case when p_weekly then 28 else 4 end) then
    raise exception using errcode='22023',message='DOCTOR_AVAILABILITY_INVALID'; end if;
  for item in select value from jsonb_array_elements(p_windows) loop
    if jsonb_typeof(item)<>'object' or not item ?& array['start','end'] or item-(case when p_weekly then array['weekday','start','end'] else array['start','end'] end)<>'{}'::jsonb
      or jsonb_typeof(item->'start') is distinct from 'number' or jsonb_typeof(item->'end') is distinct from 'number'
      or (item->>'start') !~ '^[0-9]{1,4}$' or (item->>'end') !~ '^[0-9]{1,4}$'
      or (item->>'start')::integer not between 0 and 1439 or (item->>'end')::integer not between 1 and 1440 or (item->>'start')::integer>=(item->>'end')::integer
      or (p_weekly and (jsonb_typeof(item->'weekday') is distinct from 'number' or (item->>'weekday') !~ '^[0-6]$')) then
      raise exception using errcode='22023',message='DOCTOR_AVAILABILITY_INVALID'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_windows) with ordinality a(value,n),jsonb_array_elements(p_windows) with ordinality b(value,n)
    where a.n<b.n and (not p_weekly or a.value->>'weekday'=b.value->>'weekday')
      and int4range((a.value->>'start')::integer,(a.value->>'end')::integer,'[)') && int4range((b.value->>'start')::integer,(b.value->>'end')::integer,'[)')) then
    raise exception using errcode='22023',message='DOCTOR_AVAILABILITY_OVERLAP'; end if;
  select coalesce(jsonb_agg(value order by coalesce((value->>'weekday')::integer,0),(value->>'start')::integer),'[]') into result from jsonb_array_elements(p_windows);
  return result;
end $$;
create function doctor_private.schedule_input(p_input jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare weekly jsonb; exceptions jsonb:='[]'; item jsonb; day date; windows jsonb;
begin
  if p_input is null or jsonb_typeof(p_input)<>'object' or not p_input ?& array['slot_minutes','weekly','exceptions'] or p_input-array['slot_minutes','weekly','exceptions']<>'{}'::jsonb
    or jsonb_typeof(p_input->'slot_minutes') is distinct from 'number' or (p_input->>'slot_minutes') !~ '^[0-9]{1,3}$'
    or (p_input->>'slot_minutes')::integer not between 5 and 120 or jsonb_typeof(p_input->'exceptions') is distinct from 'array' or jsonb_array_length(p_input->'exceptions')>50 then
    raise exception using errcode='22023',message='DOCTOR_AVAILABILITY_INVALID'; end if;
  weekly:=doctor_private.schedule_windows_input(p_input->'weekly',true);
  for item in select value from jsonb_array_elements(p_input->'exceptions') loop
    if jsonb_typeof(item)<>'object' or not item ?& array['date','closed','windows','reason'] or item-array['date','closed','windows','reason']<>'{}'::jsonb
      or jsonb_typeof(item->'date') is distinct from 'string' or (item->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or jsonb_typeof(item->'closed') is distinct from 'boolean' or jsonb_typeof(item->'reason') is distinct from 'string'
      or length(btrim(item->>'reason')) not between 1 and 200 or (item->>'reason') ~ '[[:cntrl:]]' then raise exception using errcode='22023',message='DOCTOR_AVAILABILITY_INVALID'; end if;
    begin day:=(item->>'date')::date; exception when datetime_field_overflow or invalid_datetime_format then raise exception using errcode='22023',message='DOCTOR_AVAILABILITY_INVALID'; end;
    if day<date '1900-01-01' or day>date '2200-12-31' or exists(select 1 from jsonb_array_elements(exceptions)e where e->>'date'=day::text) then raise exception using errcode='22023',message='DOCTOR_AVAILABILITY_INVALID'; end if;
    windows:=doctor_private.schedule_windows_input(item->'windows',false);
    if ((item->>'closed')::boolean and jsonb_array_length(windows)<>0) or (not(item->>'closed')::boolean and jsonb_array_length(windows)=0) then raise exception using errcode='22023',message='DOCTOR_AVAILABILITY_INVALID'; end if;
    exceptions:=exceptions||jsonb_build_array(jsonb_build_object('date',day,'closed',(item->>'closed')::boolean,'windows',windows,'reason',btrim(item->>'reason')));
  end loop;
  select coalesce(jsonb_agg(value order by value->>'date'),'[]') into exceptions from jsonb_array_elements(exceptions);
  return jsonb_build_object('slot_minutes',(p_input->>'slot_minutes')::integer,'weekly',weekly,'exceptions',exceptions);
end $$;
-- PostgreSQL normally chooses one side of a timezone fold. Scheduling requires
-- exactly one valid instant, so test all offsets observed around that local day.
-- Reject both missing and ambiguous clocks instead of silently choosing a side.
create function doctor_private.schedule_instant(p_day date,p_minute integer,p_zone text) returns timestamptz
language plpgsql stable security invoker set search_path='' as $$
declare local_clock timestamp; nominal timestamptz; candidates timestamptz[];
begin
  if p_day is null or p_minute is null or p_minute not between 0 and 1440 or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_zone) then return null; end if;
  local_clock:=p_day::timestamp+make_interval(mins=>p_minute); nominal:=local_clock at time zone p_zone;
  select array_agg(distinct candidate) into candidates from (
    select (local_clock at time zone 'UTC')-((probe at time zone p_zone)-(probe at time zone 'UTC')) candidate
      from generate_series(nominal-interval '2 days',nominal+interval '2 days',interval '6 hours')probe
  )times where candidate at time zone p_zone=local_clock;
  if cardinality(candidates)=1 then return candidates[1]; end if;
  return null;
end $$;
create function doctor_private.schedule_day_windows(p_config public.location_schedules,p_day date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare special jsonb; result jsonb;
begin
  if p_config.location_id is null then return '[]'; end if;
  select value into special from jsonb_array_elements(p_config.exceptions) where value->>'date'=p_day::text;
  if found then return case when (special->>'closed')::boolean then '[]'::jsonb else special->'windows' end; end if;
  select coalesce(jsonb_agg(value-'weekday' order by (value->>'start')::integer),'[]') into result from jsonb_array_elements(p_config.weekly) where (value->>'weekday')::integer=extract(dow from p_day)::integer;
  return result;
end $$;
create function doctor_private.schedule_slot(p_practice uuid,p_location uuid,p_day date,p_minute integer,p_ignore uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare config public.location_schedules; place public.locations; doctor uuid; windows jsonb; begins timestamptz; ends timestamptz; reason text;
begin
  select * into config from public.location_schedules where practice_id=p_practice and location_id=p_location;
  select * into place from public.locations where id=p_location and practice_id=p_practice and archived_at is null;
  if config.location_id is null or place.id is null or p_day is null or p_minute is null then return jsonb_build_object('available',false,'reason','unconfigured'); end if;
  windows:=doctor_private.schedule_day_windows(config,p_day);
  if not exists(select 1 from jsonb_array_elements(windows)w where p_minute>=(w->>'start')::integer and p_minute+config.slot_minutes<=(w->>'end')::integer and (p_minute-(w->>'start')::integer)%config.slot_minutes=0) then return jsonb_build_object('available',false,'reason','outside_hours'); end if;
  begins:=doctor_private.schedule_instant(p_day,p_minute,place.timezone); ends:=doctor_private.schedule_instant(p_day,p_minute+config.slot_minutes,place.timezone);
  if begins is null or ends is null or ends-begins<>make_interval(mins=>config.slot_minutes) then reason:='ambiguous_or_missing_clock';
  elsif begins<=clock_timestamp() then reason:='past';
  else
    select owner_user_id into doctor from public.practices where id=p_practice;
    if exists(select 1 from public.appointments where doctor_user_id=doctor and state not in ('cancelled','no_show') and id is distinct from p_ignore and tstzrange(starts_at,ends_at,'[)') && tstzrange(begins,ends,'[)')) then reason:='busy'; end if;
  end if;
  return jsonb_build_object('minute',p_minute,'starts_at',begins,'ends_at',ends,'available',reason is null,'reason',reason);
end $$;
create function doctor_private.read_schedule(p_practice uuid,p_location uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare config public.location_schedules; place public.locations; outside_count bigint;
begin
  perform doctor_private.schedule_scope(p_practice,p_location);
  select * into place from public.locations where id=p_location and practice_id=p_practice;
  select * into config from public.location_schedules where practice_id=p_practice and location_id=p_location;
  -- Informational count only. Saving hours never updates these appointments.
  select count(*) into outside_count from public.appointments where practice_id=p_practice and location_id=p_location and starts_at>now() and state not in ('cancelled','no_show');
  return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'timezone',place.timezone,'location_version',place.version,'version',coalesce(config.version,0),
    'slot_minutes',coalesce(config.slot_minutes,20),'weekly',coalesce(config.weekly,'[]'),'exceptions',coalesce(config.exceptions,'[]'),
    'can_manage',doctor_private.has_access(p_practice,'availability.manage',p_location),'override_policy','deny','existing_commitments',outside_count);
end $$;
create function doctor_private.write_schedule(p_practice uuid,p_location uuid,p_expected_version integer,p_input jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; config public.location_schedules; data jsonb; request jsonb; prior doctor_private.command_receipts; before_data jsonb; result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1)); perform doctor_private.schedule_scope(p_practice,p_location,true); actor:=doctor_private.current_actor();
  if p_key is null or p_expected_version is null or p_expected_version<0 then raise exception using errcode='22023',message='DOCTOR_AVAILABILITY_INVALID'; end if;
  data:=doctor_private.schedule_input(p_input); request:=jsonb_build_object('command','schedule.write','practice',p_practice,'location',p_location,'version',p_expected_version,'input',data);
  select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
  if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if; return prior.result; end if;
  select * into config from public.location_schedules where practice_id=p_practice and location_id=p_location for update;
  if coalesce(config.version,0)<>p_expected_version then raise exception using errcode='40001',message='DOCTOR_AVAILABILITY_CONFLICT'; end if;
  before_data:=doctor_private.read_schedule(p_practice,p_location);
  if config.location_id is null then insert into public.location_schedules(practice_id,location_id,slot_minutes,weekly,exceptions,updated_by) values(p_practice,p_location,(data->>'slot_minutes')::integer,data->'weekly',data->'exceptions',actor);
  else update public.location_schedules set slot_minutes=(data->>'slot_minutes')::integer,weekly=data->'weekly',exceptions=data->'exceptions',version=version+1,updated_by=actor,updated_at=now() where location_id=p_location; end if;
  result:=doctor_private.read_schedule(p_practice,p_location);
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(p_practice,actor,'availability.updated',p_location,jsonb_build_object('before',before_data,'after',result,'appointments_changed',false));
  insert into doctor_private.command_receipts values(actor,p_key,request,result); return result;
end $$;
create function doctor_private.read_availability(p_practice uuid,p_location uuid,p_day date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare config public.location_schedules; place public.locations; windows jsonb; segment jsonb; minute integer; rows jsonb:='[]';
begin
  perform doctor_private.schedule_scope(p_practice,p_location);
  select * into place from public.locations where id=p_location and practice_id=p_practice;
  if p_day is null or p_day<(clock_timestamp() at time zone place.timezone)::date or p_day>(clock_timestamp() at time zone place.timezone)::date+365 then raise exception using errcode='22023',message='DOCTOR_AVAILABILITY_DATE_INVALID'; end if;
  select * into config from public.location_schedules where practice_id=p_practice and location_id=p_location;
  windows:=doctor_private.schedule_day_windows(config,p_day);
  for segment in select value from jsonb_array_elements(windows) loop
    for minute in select generate_series((segment->>'start')::integer,(segment->>'end')::integer-config.slot_minutes,config.slot_minutes) loop
      rows:=rows||jsonb_build_array(doctor_private.schedule_slot(p_practice,p_location,p_day,minute));
    end loop;
  end loop;
  return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'date',p_day,'timezone',place.timezone,'location_version',place.version,'schedule_version',coalesce(config.version,0),'slot_minutes',coalesce(config.slot_minutes,20),'slots',rows,'override_policy','deny');
end $$;
create function doctor_private.book_appointment(p_practice uuid,p_location uuid,p_patient uuid,p_day date,p_minute integer,p_schedule_version integer,p_location_version integer,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; config public.location_schedules; place public.locations; doctor uuid; slot jsonb; request jsonb; prior doctor_private.command_receipts; item public.appointments; result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1)); perform doctor_private.schedule_scope(p_practice,p_location);
  perform doctor_private.require_access(p_practice,'appointments.read',p_location); perform doctor_private.require_access(p_practice,'appointments.write',p_location); perform doctor_private.require_access(p_practice,'patients.read',p_location);
  actor:=doctor_private.current_actor(); select * into place from public.locations where id=p_location and practice_id=p_practice;
  if not exists(select 1 from public.practice_patients where id=p_patient and practice_id=p_practice and archived_at is null) then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  if p_key is null or p_day is null or p_minute is null or p_minute not between 0 and 1439 or p_day<(clock_timestamp() at time zone place.timezone)::date or p_day>(clock_timestamp() at time zone place.timezone)::date+365 then raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_INVALID'; end if;
  request:=jsonb_build_object('command','appointment.book','practice',p_practice,'location',p_location,'patient',p_patient,'date',p_day,'minute',p_minute,'schedule_version',p_schedule_version,'location_version',p_location_version);
  select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
  if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if; return prior.result; end if;
  select * into config from public.location_schedules where practice_id=p_practice and location_id=p_location;
  if config.location_id is null or config.version is distinct from p_schedule_version or place.version is distinct from p_location_version then raise exception using errcode='40001',message='DOCTOR_AVAILABILITY_CONFLICT'; end if;
  slot:=doctor_private.schedule_slot(p_practice,p_location,p_day,p_minute);
  if not coalesce((slot->>'available')::boolean,false) then raise exception using errcode='40001',message='DOCTOR_APPOINTMENT_CONFLICT'; end if;
  select owner_user_id into doctor from public.practices where id=p_practice;
  insert into public.appointments(practice_id,doctor_user_id,location_id,patient_id,starts_at,ends_at,timezone,location_name,created_by)
    values(p_practice,doctor,p_location,p_patient,(slot->>'starts_at')::timestamptz,(slot->>'ends_at')::timestamptz,place.timezone,place.name,actor) returning * into item;
  insert into public.appointment_events(practice_id,appointment_id,actor_user_id,location_id,event_type,record_version,details)values(p_practice,item.id,actor,p_location,'appointment.booked',1,jsonb_build_object('starts_at',item.starts_at,'ends_at',item.ends_at,'timezone',item.timezone,'location_name',item.location_name));
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(p_practice,actor,'appointment.booked',item.id,jsonb_build_object('location_id',p_location,'patient_id',p_patient,'starts_at',item.starts_at,'ends_at',item.ends_at));
  result:=jsonb_build_object('appointment_id',item.id,'version',item.version); insert into doctor_private.command_receipts values(actor,p_key,request,result); return result;
exception when exclusion_violation then raise exception using errcode='40001',message='DOCTOR_APPOINTMENT_CONFLICT';
end $$;
-- Appointment commitments now exist. Preserve upcoming references on archive;
-- completed/historical rows retain foreign keys without pinning a clinic open.
create or replace function doctor_private.location_archive_blockers(p_practice uuid,p_location uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when exists(select 1 from public.appointments where practice_id=p_practice and location_id=p_location and state in ('booked','checked_in','in_progress') and ends_at>now()) then jsonb_build_array(jsonb_build_object('kind','upcoming_appointments','count',(select count(*) from public.appointments where practice_id=p_practice and location_id=p_location and state in ('booked','checked_in','in_progress') and ends_at>now()))) else '[]'::jsonb end
$$;
create function public.doctor_schedule(p_practice uuid,p_location uuid) returns jsonb language sql stable security invoker set search_path='' as $$select doctor_private.read_schedule(p_practice,p_location)$$;
create function public.doctor_write_schedule(p_practice uuid,p_location uuid,p_expected_version integer,p_input jsonb,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select doctor_private.write_schedule(p_practice,p_location,p_expected_version,p_input,p_key)$$;
create function public.doctor_availability(p_practice uuid,p_location uuid,p_day date) returns jsonb language sql stable security invoker set search_path='' as $$select doctor_private.read_availability(p_practice,p_location,p_day)$$;
create function public.doctor_book_appointment(p_practice uuid,p_location uuid,p_patient uuid,p_day date,p_minute integer,p_schedule_version integer,p_location_version integer,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select doctor_private.book_appointment(p_practice,p_location,p_patient,p_day,p_minute,p_schedule_version,p_location_version,p_key)$$;
revoke all on function doctor_private.schedule_scope(uuid,uuid,boolean),doctor_private.schedule_windows_input(jsonb,boolean),doctor_private.schedule_input(jsonb),doctor_private.schedule_instant(date,integer,text),doctor_private.schedule_day_windows(public.location_schedules,date),doctor_private.schedule_slot(uuid,uuid,date,integer,uuid),doctor_private.read_schedule(uuid,uuid),doctor_private.write_schedule(uuid,uuid,integer,jsonb,uuid),doctor_private.read_availability(uuid,uuid,date),doctor_private.book_appointment(uuid,uuid,uuid,date,integer,integer,integer,uuid) from public,anon,authenticated;
grant execute on function doctor_private.read_schedule(uuid,uuid),doctor_private.write_schedule(uuid,uuid,integer,jsonb,uuid),doctor_private.read_availability(uuid,uuid,date),doctor_private.book_appointment(uuid,uuid,uuid,date,integer,integer,integer,uuid) to authenticated;
revoke all on function public.doctor_schedule(uuid,uuid),public.doctor_write_schedule(uuid,uuid,integer,jsonb,uuid),public.doctor_availability(uuid,uuid,date),public.doctor_book_appointment(uuid,uuid,uuid,date,integer,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.doctor_schedule(uuid,uuid),public.doctor_write_schedule(uuid,uuid,integer,jsonb,uuid),public.doctor_availability(uuid,uuid,date),public.doctor_book_appointment(uuid,uuid,uuid,date,integer,integer,integer,uuid) to authenticated;
