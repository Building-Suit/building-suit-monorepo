-- Stored grants remain role authority. Current owner-bound entitlement controls
-- business write offers; history and security-reduction permissions are retained.

create or replace function doctor_private.patient_directory(p_practice uuid,p_location uuid,p_page integer,p_size integer,p_search text,p_status text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; total bigint; digits text;
begin
  perform doctor_private.patient_scope(p_practice,p_location);
  if p_page is null or p_page not between 0 and 100000 or p_size is null or p_size not between 1 and 100 or p_search is null or length(p_search)>160
    or p_status is null or p_status not in ('active','archived','all') then raise exception using errcode='22023',message='DOCTOR_PATIENT_QUERY_INVALID'; end if;
  digits:=doctor_private.patient_phone_key(p_search);
  select count(*) into total from public.practice_patients p where p.practice_id=p_practice
    and (p_status='all' or (p_status='active' and p.archived_at is null) or (p_status='archived' and p.archived_at is not null))
    and (position(lower(p_search) in lower(p.display_name))>0 or position(lower(p_search) in lower(p.recorded_email))>0 or (digits<>'' and position(digits in doctor_private.patient_phone_key(p.recorded_phone))>0));
  select coalesce(jsonb_agg(doctor_private.patient_projection(row) order by row.display_name,row.id),'[]') into rows from (
    select * from public.practice_patients p where p.practice_id=p_practice
      and (p_status='all' or (p_status='active' and p.archived_at is null) or (p_status='archived' and p.archived_at is not null))
      and (position(lower(p_search) in lower(p.display_name))>0 or position(lower(p_search) in lower(p.recorded_email))>0 or (digits<>'' and position(digits in doctor_private.patient_phone_key(p.recorded_phone))>0))
    order by display_name,id limit p_size offset(p_page::bigint*p_size)
  ) row;
  return jsonb_build_object('rows',rows,'total',total,'can_write',doctor_private.has_access(p_practice,'patients.write',p_location) and(doctor_private.saas_entitlement_context(p_practice)->>'writes_allowed')::boolean);
end $$;

create or replace function doctor_private.patient_record(p_practice uuid,p_location uuid,p_patient uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item public.practice_patients; activity jsonb; total bigint;
begin
  perform doctor_private.patient_scope(p_practice,p_location);
  select * into item from public.practice_patients where practice_id=p_practice and id=p_patient;
  if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'event_type',a.event_type,'record_version',a.record_version,'actor_user_id',a.actor_user_id,
    'location_id',a.location_id,'location_name',l.name,'happened_at',a.happened_at,'provenance','entered_unverified') order by a.id desc),'[]') into activity
    from (select * from public.patient_administrative_activity where practice_id=p_practice and patient_id=p_patient order by id desc limit 100) a
    join public.locations l on l.id=a.location_id and l.practice_id=a.practice_id;
  select count(*) into total from public.patient_administrative_activity where practice_id=p_practice and patient_id=p_patient;
  return jsonb_build_object('patient',doctor_private.patient_projection(item),'activity',activity,'activity_total',total,'can_write',doctor_private.has_access(p_practice,'patients.write',p_location) and(doctor_private.saas_entitlement_context(p_practice)->>'writes_allowed')::boolean);
end $$;

create or replace function doctor_private.read_schedule(p_practice uuid,p_location uuid) returns jsonb
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
    'can_manage',doctor_private.has_access(p_practice,'availability.manage',p_location) and(doctor_private.saas_entitlement_context(p_practice)->>'writes_allowed')::boolean,'override_policy','deny','existing_commitments',outside_count);
end $$;

create or replace function doctor_private.read_appointment_board(p_practice uuid,p_location uuid,p_day date,p_page integer,p_queue_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare place public.locations; items jsonb; queue_rows jsonb; total bigint; queue_total bigint; writable boolean;
begin
  perform doctor_private.appointment_scope(p_practice,p_location);
  writable:=(doctor_private.saas_entitlement_context(p_practice)->>'writes_allowed')::boolean;
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
    'can_write',doctor_private.has_access(p_practice,'appointments.write',p_location) and writable,
    'can_queue',doctor_private.has_access(p_practice,'queue.manage',p_location) and writable,
    'can_read_patients',doctor_private.has_access(p_practice,'patients.read',p_location),'external_notifications','disabled');
end $$;

create or replace function doctor_private.location_directory(p_practice uuid,p_page integer,p_size integer,p_search text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); rows jsonb; total bigint; entitlement jsonb;
begin
  if p_page is null or p_page<0 or p_size is null or p_size not between 1 and 100 or p_search is null or length(p_search)>160 then
    raise exception using errcode='22023',message='DOCTOR_QUERY_INVALID';
  end if;
  if not doctor_private.has_access(p_practice,'locations.read') and not doctor_private.has_access(p_practice,'locations.manage') then
    raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';
  end if;
  entitlement:=doctor_private.saas_entitlement_context(p_practice);
  select count(*) into total from public.locations l where l.practice_id=p_practice
    and (doctor_private.has_access(l.practice_id,'locations.read',l.id) or doctor_private.has_access(l.practice_id,'locations.manage',l.id))
    and position(lower(p_search) in lower(l.name))>0;
  select coalesce(jsonb_agg(to_jsonb(row) order by row.archived_at nulls first,row.name,row.id),'[]'::jsonb) into rows from (
    select l.id,l.practice_id,l.name,l.timezone,l.contact_phone,l.contact_address,l.archived_at,l.version,
      doctor_private.has_access(l.practice_id,'locations.manage',l.id) as can_manage,
      doctor_private.has_access(l.practice_id,'locations.manage',l.id) and l.archived_at is null and(entitlement->>'writes_allowed')::boolean as can_edit
    from public.locations l where l.practice_id=p_practice
      and (doctor_private.has_access(l.practice_id,'locations.read',l.id) or doctor_private.has_access(l.practice_id,'locations.manage',l.id))
      and position(lower(p_search) in lower(l.name))>0
    order by l.archived_at nulls first,l.name,l.id limit p_size offset (p_page::bigint*p_size)
  ) row;
  return jsonb_build_object('edition',doctor_private.edition_mode(),'entitlement',entitlement,'practice_name',(select name from public.practices where id=p_practice),'rows',rows,'total',total,'can_create',exists(select 1 from public.practices where id=p_practice and owner_user_id=actor) and(entitlement->>'can_add_clinic')::boolean);
end $$;

create or replace function doctor_private.team(p_practice uuid,p_page integer,p_size integer,p_search text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare members jsonb; invitations jsonb; locations jsonb; total bigint; invitation_total bigint;
begin
 if not doctor_private.is_owner(p_practice) then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
 if p_page is null or p_page<0 or p_size is null or p_size not between 1 and 100 or p_search is null or length(p_search)>160 then
  raise exception using errcode='22023',message='DOCTOR_QUERY_INVALID'; end if;
 select count(*) into total from public.memberships m join auth.users u on u.id=m.user_id where m.practice_id=p_practice and position(lower(p_search) in lower(u.email))>0;
 select coalesce(jsonb_agg(to_jsonb(row) order by row.email,row.id),'[]') into members from(
  select m.id,u.email,m.status,m.version,m.created_at,(select coalesce(jsonb_agg(jsonb_build_object('location_id',l.id,'location_name',l.name,'archived',l.archived_at is not null,'capabilities',coalesce(ml.capabilities,m.capabilities)) order by l.name,l.id),'[]')
   from public.membership_locations ml join public.locations l on l.practice_id=ml.practice_id and l.id=ml.location_id where ml.membership_id=m.id and ml.practice_id=p_practice) as grants
  from public.memberships m join auth.users u on u.id=m.user_id where m.practice_id=p_practice and position(lower(p_search) in lower(u.email))>0
  order by u.email,m.id limit p_size offset p_page::bigint*p_size
 )row;
 select count(*) into invitation_total from public.secretary_invitations where practice_id=p_practice and position(lower(p_search) in recipient_email)>0;
 select coalesce(jsonb_agg(to_jsonb(row) order by row.created_at desc,row.id),'[]') into invitations from(
  select id,recipient_email,case when status='pending' and expires_at<=clock_timestamp() then 'expired' else status end as status,version,expires_at,created_at,grants
  from public.secretary_invitations where practice_id=p_practice and position(lower(p_search) in recipient_email)>0
  order by created_at desc,id limit p_size offset p_page::bigint*p_size
 )row;
 select coalesce(jsonb_agg(to_jsonb(row) order by row.name,row.id),'[]') into locations from(
  select id,name,timezone,archived_at is not null as archived from public.locations where practice_id=p_practice order by name,id limit 100
 )row;
 return jsonb_build_object('edition',doctor_private.edition_mode(),'edition_revision',(select revision from public.doctor_edition_policy where singleton),'available_capabilities',doctor_private.edition_capabilities(),'entitlement',doctor_private.saas_entitlement_context(p_practice),'practice_id',p_practice,'practice_name',(select name from public.practices where id=p_practice),'members',members,'invitations',invitations,'locations',locations,'member_total',total,'invitation_total',invitation_total,
  'location_total',(select count(*) from public.locations where practice_id=p_practice));
end $$;
