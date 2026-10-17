-- DOS-M1-014: synthetic administrative appointment lifecycle and scoped queue.
alter table public.appointments add column checked_in_at timestamptz,
  add column started_at timestamptz, add column completed_at timestamptz;
alter table public.appointments add constraint appointment_lifecycle_clocks check(
  (state not in ('checked_in','in_progress','completed') or checked_in_at is not null)
  and (state not in ('in_progress','completed') or started_at is not null)
  and (state<>'completed' or completed_at is not null));
create unique index appointments_one_in_progress_per_doctor on public.appointments(doctor_user_id) where state='in_progress';
create index appointments_active_queue on public.appointments(practice_id,location_id,checked_in_at,id) where state in ('checked_in','in_progress');

-- Changes carry only an invalidation counter. Never publish patient records,
-- appointment rows, clinical payloads or command/audit bodies.
create table public.appointment_queue_revisions (
  practice_id uuid not null,
  location_id uuid primary key,
  revision bigint not null default 1 check(revision>0),
  foreign key(practice_id,location_id) references public.locations(practice_id,id)
);
create index appointment_queue_revisions_practice on public.appointment_queue_revisions(practice_id,location_id);
alter table public.appointment_queue_revisions enable row level security;
revoke all on public.appointment_queue_revisions from public,anon,authenticated;
grant select on public.appointment_queue_revisions to authenticated;
create function doctor_private.can_read_appointment_queue(p_practice uuid,p_location uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
  return doctor_private.has_access(p_practice,'appointments.read',p_location)
    and exists(select 1 from public.locations where id=p_location and practice_id=p_practice and archived_at is null);
exception when insufficient_privilege then
  -- A revoked subscriber matches no rows. Keep the row predicate boolean;
  -- authoritative appointment RPCs still reject an invalid session explicitly.
  return false;
end
$$;
revoke all on function doctor_private.can_read_appointment_queue(uuid,uuid) from public,anon,authenticated;
grant execute on function doctor_private.can_read_appointment_queue(uuid,uuid) to authenticated;
create policy appointment_queue_read on public.appointment_queue_revisions for select to authenticated using(
  doctor_private.can_read_appointment_queue(practice_id,location_id)
);
-- Restrictive guard also protects against a future permissive SELECT policy.
create policy appointment_queue_scope_guard on public.appointment_queue_revisions as restrictive for select to authenticated using(
  doctor_private.can_read_appointment_queue(practice_id,location_id)
);
create function doctor_private.bump_appointment_queue() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.appointment_queue_revisions(practice_id,location_id) values(new.practice_id,new.location_id)
    on conflict(location_id) do update set revision=appointment_queue_revisions.revision+1;
  if tg_op='UPDATE' and old.location_id<>new.location_id then
    insert into public.appointment_queue_revisions(practice_id,location_id) values(old.practice_id,old.location_id)
      on conflict(location_id) do update set revision=appointment_queue_revisions.revision+1;
  end if;
  return new;
end $$;
revoke all on function doctor_private.bump_appointment_queue() from public,anon,authenticated;
create trigger appointments_invalidate_queue after insert or update on public.appointments for each row execute function doctor_private.bump_appointment_queue();
insert into public.appointment_queue_revisions(practice_id,location_id) select distinct practice_id,location_id from public.appointments;
-- Supported documented Realtime integration. The owned SQL-only runner creates
-- the empty publication interface; actual events are verified by the cloud job.
alter publication supabase_realtime add table public.appointment_queue_revisions;

create function doctor_private.appointment_scope(p_practice uuid,p_location uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  perform doctor_private.current_actor();
  perform doctor_private.require_access(p_practice,'appointments.read',p_location);
  if not exists(select 1 from public.locations where practice_id=p_practice and id=p_location and archived_at is null) then
    raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';
  end if;
end $$;
create function doctor_private.appointment_projection(p_item public.appointments) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',p_item.id,'practice_id',p_item.practice_id,'location_id',p_item.location_id,
    'patient_id',p_item.patient_id,'patient_name',case when doctor_private.has_access(p_item.practice_id,'patients.read',p_item.location_id)
      then(select display_name from public.practice_patients where practice_id=p_item.practice_id and id=p_item.patient_id) else null end,
    'starts_at',p_item.starts_at,'ends_at',p_item.ends_at,'timezone',p_item.timezone,'location_name',p_item.location_name,
    'state',p_item.state,'version',p_item.version,'checked_in_at',p_item.checked_in_at,'started_at',p_item.started_at,'completed_at',p_item.completed_at)
$$;
create function doctor_private.read_appointment_board(p_practice uuid,p_location uuid,p_day date,p_page integer,p_queue_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare place public.locations; items jsonb; queue_rows jsonb; total bigint; queue_total bigint;
begin
  perform doctor_private.appointment_scope(p_practice,p_location);
  select * into place from public.locations where id=p_location and practice_id=p_practice;
  if p_day is null or p_day<(clock_timestamp() at time zone place.timezone)::date-365 or p_day>(clock_timestamp() at time zone place.timezone)::date+365
    or p_page is null or p_queue_page is null or p_page not between 0 and 100000 or p_queue_page not between 0 and 100000 then
    raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_INVALID';
  end if;
  select count(*) into total from public.appointments where practice_id=p_practice and location_id=p_location and (starts_at at time zone place.timezone)::date=p_day;
  select coalesce(jsonb_agg(doctor_private.appointment_projection(a) order by a.starts_at,a.id),'[]') into items
    from(select * from public.appointments where practice_id=p_practice and location_id=p_location and (starts_at at time zone place.timezone)::date=p_day order by starts_at,id limit 20 offset p_page*20)a;
  select count(*) into queue_total from public.appointments where practice_id=p_practice and location_id=p_location and state in ('checked_in','in_progress');
  select coalesce(jsonb_agg(doctor_private.appointment_projection(a) order by a.checked_in_at,a.id),'[]') into queue_rows
    from(select * from public.appointments where practice_id=p_practice and location_id=p_location and state in ('checked_in','in_progress') order by checked_in_at,id limit 20 offset p_queue_page*20)a;
  return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'date',p_day,'timezone',place.timezone,'location_version',place.version,
    'items',items,'page',p_page,'total',total,'queue',queue_rows,'queue_page',p_queue_page,'queue_total',queue_total,
    'revision',coalesce((select revision from public.appointment_queue_revisions where location_id=p_location),0),
    'can_write',doctor_private.has_access(p_practice,'appointments.write',p_location),
    'can_queue',doctor_private.has_access(p_practice,'queue.manage',p_location),
    'can_read_patients',doctor_private.has_access(p_practice,'patients.read',p_location),'external_notifications','disabled');
end $$;
create function doctor_private.read_appointment_history(p_practice uuid,p_location uuid,p_appointment uuid,p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item public.appointments; events jsonb; total bigint;
begin
  perform doctor_private.appointment_scope(p_practice,p_location);
  select * into item from public.appointments where practice_id=p_practice and location_id=p_location and id=p_appointment;
  if item.id is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  if p_page is null or p_page not between 0 and 100000 then raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_INVALID'; end if;
  -- A reschedule can reference another clinic. History is withheld unless the
  -- current actor retains read scope for every clinic represented in it.
  if exists(select 1 from public.appointment_events where practice_id=p_practice and appointment_id=p_appointment and not doctor_private.has_access(p_practice,'appointments.read',location_id)) then
    raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  select count(*) into total from public.appointment_events where practice_id=p_practice and appointment_id=p_appointment;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id::text,'type',e.event_type,'version',e.record_version,'at',e.happened_at,
    'actor_user_id',e.actor_user_id,'location_id',e.location_id,'details',e.details) order by e.id desc),'[]') into events
    from(select * from public.appointment_events where practice_id=p_practice and appointment_id=p_appointment order by id desc limit 20 offset p_page*20)e;
  return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'appointment_id',p_appointment,'version',item.version,'page',p_page,'total',total,'events',events);
end $$;
create function doctor_private.appointment_reason(p_reason text) returns text
language plpgsql immutable security invoker set search_path='' as $$
begin
  if p_reason is null or length(btrim(p_reason)) not between 1 and 200 or p_reason~'[[:cntrl:]]' then raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_REASON_REQUIRED'; end if;
  return btrim(p_reason);
end $$;
create function doctor_private.transition_appointment(p_practice uuid,p_location uuid,p_appointment uuid,p_expected_version integer,p_state text,p_reason text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; item public.appointments; previous public.appointments; request jsonb; prior doctor_private.command_receipts; result jsonb; reason text; conflict_constraint text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
  perform doctor_private.appointment_scope(p_practice,p_location); actor:=doctor_private.current_actor();
  select * into item from public.appointments where id=p_appointment and practice_id=p_practice and location_id=p_location for update;
  if item.id is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  if p_key is null or p_expected_version is null or p_expected_version<1 or p_state is null or p_state not in ('checked_in','in_progress','completed','cancelled','no_show') then
    raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_INVALID'; end if;
  if p_state in ('checked_in','in_progress','completed') then perform doctor_private.require_access(p_practice,'queue.manage',p_location);
  else perform doctor_private.require_access(p_practice,'appointments.write',p_location); end if;
  reason:=case when p_state in ('cancelled','no_show') then doctor_private.appointment_reason(p_reason) else null end;
  if p_state not in ('cancelled','no_show') and coalesce(p_reason,'')<>'' then raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_INVALID'; end if;
  request:=jsonb_build_object('command','appointment.transition','session',auth.jwt()->>'session_id','practice',p_practice,'location',p_location,'appointment',p_appointment,'version',p_expected_version,'state',p_state,'reason',reason);
  select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
  if found then
    if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
    -- A checked-in cancellation retry still requires its original queue grant.
    if coalesce((prior.result->>'queue_authority')::boolean,false) then perform doctor_private.require_access(p_practice,'queue.manage',p_location); end if;
    return prior.result;
  end if;
  if item.version<>p_expected_version then raise exception using errcode='40001',message='DOCTOR_APPOINTMENT_CONFLICT'; end if;
  if not ((item.state='booked' and p_state in ('checked_in','cancelled','no_show')) or (item.state='checked_in' and p_state in ('in_progress','cancelled')) or (item.state='in_progress' and p_state='completed')) then
    raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_TRANSITION_DENIED'; end if;
  if item.state='checked_in' and p_state='cancelled' then perform doctor_private.require_access(p_practice,'queue.manage',p_location); end if;
  if p_state='checked_in' and (item.starts_at at time zone item.timezone)::date<>(clock_timestamp() at time zone item.timezone)::date then
    raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_CHECKIN_DAY'; end if;
  if p_state='no_show' and item.starts_at>clock_timestamp() then raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_NOT_DUE'; end if;
  previous:=item;
  update public.appointments set state=p_state,version=version+1,updated_at=clock_timestamp(),
    checked_in_at=case when p_state='checked_in' then clock_timestamp() else checked_in_at end,
    started_at=case when p_state='in_progress' then clock_timestamp() else started_at end,
    completed_at=case when p_state='completed' then clock_timestamp() else completed_at end where id=item.id returning * into item;
  insert into public.appointment_events(practice_id,appointment_id,actor_user_id,location_id,event_type,record_version,details)
    values(p_practice,item.id,actor,p_location,'appointment.'||p_state,item.version,jsonb_build_object('from',previous.state,'to',p_state,'reason',reason,'timezone',item.timezone,'location_name',item.location_name));
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)
    values(p_practice,actor,'appointment.'||p_state,item.id,jsonb_build_object('location_id',p_location,'from',previous.state,'to',p_state,'reason',reason,'version',item.version));
  result:=jsonb_build_object('appointment_id',item.id,'version',item.version,'state',item.state,'queue_authority',previous.state='checked_in' and p_state='cancelled');
  insert into doctor_private.command_receipts values(actor,p_key,request,result); return result;
exception when unique_violation then
  get stacked diagnostics conflict_constraint=constraint_name;
  if conflict_constraint='appointments_one_in_progress_per_doctor' then raise exception using errcode='40001',message='DOCTOR_QUEUE_ALREADY_IN_PROGRESS'; end if;
  raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';
end $$;
create function doctor_private.reschedule_appointment(p_practice uuid,p_location uuid,p_appointment uuid,p_expected_version integer,p_destination uuid,p_day date,p_minute integer,p_schedule_version integer,p_location_version integer,p_reason text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; item public.appointments; previous public.appointments; place public.locations; config public.location_schedules; request jsonb; prior doctor_private.command_receipts; result jsonb; slot jsonb; reason text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
  perform doctor_private.appointment_scope(p_practice,p_location); perform doctor_private.appointment_scope(p_practice,p_destination);
  perform doctor_private.require_access(p_practice,'appointments.write',p_location); perform doctor_private.require_access(p_practice,'appointments.write',p_destination);
  perform doctor_private.require_access(p_practice,'patients.read',p_location); perform doctor_private.require_access(p_practice,'patients.read',p_destination);
  actor:=doctor_private.current_actor(); reason:=doctor_private.appointment_reason(p_reason);
  if p_key is null or p_expected_version is null or p_expected_version<1 then raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_INVALID'; end if;
  request:=jsonb_build_object('command','appointment.reschedule','session',auth.jwt()->>'session_id','practice',p_practice,'location',p_location,'appointment',p_appointment,'version',p_expected_version,'destination',p_destination,'date',p_day,'minute',p_minute,'schedule_version',p_schedule_version,'location_version',p_location_version,'reason',reason);
  -- After a successful cross-clinic move the source lookup no longer matches.
  -- Check its receipt only after fresh authority for both original scopes.
  select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
  if found then
    if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
    if not exists(select 1 from public.appointments where id=p_appointment and practice_id=p_practice and location_id=p_destination) then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
    return prior.result;
  end if;
  select * into item from public.appointments where id=p_appointment and practice_id=p_practice and location_id=p_location for update;
  if item.id is null or not exists(select 1 from public.practice_patients where practice_id=p_practice and id=item.patient_id and archived_at is null) then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  if item.version<>p_expected_version then raise exception using errcode='40001',message='DOCTOR_APPOINTMENT_CONFLICT'; end if;
  if item.state<>'booked' then raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_TRANSITION_DENIED'; end if;
  select * into place from public.locations where practice_id=p_practice and id=p_destination;
  select * into config from public.location_schedules where practice_id=p_practice and location_id=p_destination;
  if p_day is null or p_minute is null or p_minute not between 0 and 1439 or p_day<(clock_timestamp() at time zone place.timezone)::date or p_day>(clock_timestamp() at time zone place.timezone)::date+365 then raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_INVALID'; end if;
  if config.location_id is null or config.version is distinct from p_schedule_version or place.version is distinct from p_location_version then raise exception using errcode='40001',message='DOCTOR_AVAILABILITY_CONFLICT'; end if;
  slot:=doctor_private.schedule_slot(p_practice,p_destination,p_day,p_minute,item.id);
  if not coalesce((slot->>'available')::boolean,false) then raise exception using errcode='40001',message='DOCTOR_APPOINTMENT_CONFLICT'; end if;
  previous:=item;
  update public.appointments set location_id=p_destination,location_name=place.name,timezone=place.timezone,
    starts_at=(slot->>'starts_at')::timestamptz,ends_at=(slot->>'ends_at')::timestamptz,version=version+1,updated_at=clock_timestamp() where id=item.id returning * into item;
  insert into public.appointment_events(practice_id,appointment_id,actor_user_id,location_id,event_type,record_version,details)values(p_practice,item.id,actor,p_destination,'appointment.rescheduled',item.version,
    jsonb_build_object('reason',reason,'from',jsonb_build_object('location_id',previous.location_id,'location_name',previous.location_name,'timezone',previous.timezone,'starts_at',previous.starts_at,'ends_at',previous.ends_at),
      'to',jsonb_build_object('location_id',item.location_id,'location_name',item.location_name,'timezone',item.timezone,'starts_at',item.starts_at,'ends_at',item.ends_at)));
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(p_practice,actor,'appointment.rescheduled',item.id,jsonb_build_object('from_location_id',previous.location_id,'to_location_id',item.location_id,'reason',reason,'version',item.version));
  result:=jsonb_build_object('appointment_id',item.id,'version',item.version,'state',item.state); insert into doctor_private.command_receipts values(actor,p_key,request,result); return result;
exception when exclusion_violation then raise exception using errcode='40001',message='DOCTOR_APPOINTMENT_CONFLICT';
end $$;
-- Active queue references block archive even if their scheduled end is past.
create or replace function doctor_private.location_archive_blockers(p_practice uuid,p_location uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select case when count(*)>0 then jsonb_build_array(jsonb_build_object('kind','upcoming_appointments','count',count(*))) else '[]'::jsonb end
    from public.appointments where practice_id=p_practice and location_id=p_location and (state in ('checked_in','in_progress') or(state='booked' and ends_at>now()))
$$;
create function public.doctor_appointment_board(p_practice uuid,p_location uuid,p_day date,p_page integer default 0,p_queue_page integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$select doctor_private.read_appointment_board(p_practice,p_location,p_day,p_page,p_queue_page)$$;
create function public.doctor_appointment_history(p_practice uuid,p_location uuid,p_appointment uuid,p_page integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$select doctor_private.read_appointment_history(p_practice,p_location,p_appointment,p_page)$$;
create function public.doctor_transition_appointment(p_practice uuid,p_location uuid,p_appointment uuid,p_expected_version integer,p_state text,p_reason text,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select doctor_private.transition_appointment(p_practice,p_location,p_appointment,p_expected_version,p_state,p_reason,p_key)$$;
create function public.doctor_reschedule_appointment(p_practice uuid,p_location uuid,p_appointment uuid,p_expected_version integer,p_destination uuid,p_day date,p_minute integer,p_schedule_version integer,p_location_version integer,p_reason text,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select doctor_private.reschedule_appointment(p_practice,p_location,p_appointment,p_expected_version,p_destination,p_day,p_minute,p_schedule_version,p_location_version,p_reason,p_key)$$;
revoke all on function doctor_private.appointment_scope(uuid,uuid),doctor_private.appointment_projection(public.appointments),doctor_private.appointment_reason(text),doctor_private.read_appointment_board(uuid,uuid,date,integer,integer),doctor_private.read_appointment_history(uuid,uuid,uuid,integer),doctor_private.transition_appointment(uuid,uuid,uuid,integer,text,text,uuid),doctor_private.reschedule_appointment(uuid,uuid,uuid,integer,uuid,date,integer,integer,integer,text,uuid) from public,anon,authenticated;
grant execute on function doctor_private.read_appointment_board(uuid,uuid,date,integer,integer),doctor_private.read_appointment_history(uuid,uuid,uuid,integer),doctor_private.transition_appointment(uuid,uuid,uuid,integer,text,text,uuid),doctor_private.reschedule_appointment(uuid,uuid,uuid,integer,uuid,date,integer,integer,integer,text,uuid) to authenticated;
revoke all on function public.doctor_appointment_board(uuid,uuid,date,integer,integer),public.doctor_appointment_history(uuid,uuid,uuid,integer),public.doctor_transition_appointment(uuid,uuid,uuid,integer,text,text,uuid),public.doctor_reschedule_appointment(uuid,uuid,uuid,integer,uuid,date,integer,integer,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.doctor_appointment_board(uuid,uuid,date,integer,integer),public.doctor_appointment_history(uuid,uuid,uuid,integer),public.doctor_transition_appointment(uuid,uuid,uuid,integer,text,text,uuid),public.doctor_reschedule_appointment(uuid,uuid,uuid,integer,uuid,date,integer,integer,integer,text,uuid) to authenticated;
