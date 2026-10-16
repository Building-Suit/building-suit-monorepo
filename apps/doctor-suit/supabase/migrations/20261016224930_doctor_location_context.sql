-- DOS-M1-008. Locations are working contexts; practice ownership remains unchanged.
alter table public.locations add column contact_phone text not null default '' check(length(contact_phone)<=60);
alter table public.locations add column contact_address text not null default '' check(length(contact_address)<=500);

create function doctor_private.administrative_capabilities() returns text[]
language sql immutable security invoker set search_path='' as $$ select array[
  'dashboard.read','locations.read','locations.manage','patients.read','patients.write','documents.read','documents.write',
  'availability.manage','appointments.read','appointments.write','queue.manage'
]::text[] $$;

create function doctor_private.contexts() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'practice_id',p.id,'practice_name',p.name,'doctor_name',d.display_name,'location_id',l.id,'location_name',l.name,'timezone',l.timezone,
    'portal',case when p.owner_user_id=actor then 'doctor' else 'secretary' end,
    'grants_version',case when p.owner_user_id=actor then p.version else m.version end,'location_version',l.version,
    'capabilities',case when p.owner_user_id=actor then doctor_private.administrative_capabilities() else m.capabilities end
  ) order by p.name,p.id,l.name,l.id),'[]'::jsonb) into result
  from public.practices p join public.doctor_profiles d on d.user_id=p.owner_user_id join public.locations l on l.practice_id=p.id and l.archived_at is null
  left join public.memberships m on m.practice_id=p.id and m.user_id=actor and m.status='active'
  where p.owner_user_id=actor or (cardinality(m.capabilities)>0 and exists(
    select 1 from public.membership_locations ml where ml.practice_id=p.id and ml.membership_id=m.id and ml.location_id=l.id
  ));
  return result;
end $$;
create function doctor_private.resolve_context(p_practice uuid,p_location uuid,p_expected_version integer default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  select value into result from jsonb_array_elements(doctor_private.contexts())
    where value->>'practice_id'=p_practice::text and value->>'location_id'=p_location::text;
  if result is null then raise exception using errcode='42501',message='DOCTOR_CONTEXT_DENIED'; end if;
  if p_expected_version is not null and (result->>'grants_version')::integer<>p_expected_version then
    raise exception using errcode='40001',message='DOCTOR_CONTEXT_CHANGED';
  end if;
  return result;
end $$;

create function doctor_private.location_directory(p_practice uuid,p_page integer,p_size integer,p_search text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); rows jsonb; total bigint;
begin
  if p_page is null or p_page<0 or p_size is null or p_size not between 1 and 100 or p_search is null or length(p_search)>160 then
    raise exception using errcode='22023',message='DOCTOR_QUERY_INVALID';
  end if;
  if not doctor_private.has_access(p_practice,'locations.read') and not doctor_private.has_access(p_practice,'locations.manage') then
    raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';
  end if;
  select count(*) into total from public.locations l where l.practice_id=p_practice
    and (doctor_private.has_access(l.practice_id,'locations.read',l.id) or doctor_private.has_access(l.practice_id,'locations.manage',l.id))
    and position(lower(p_search) in lower(l.name))>0;
  select coalesce(jsonb_agg(to_jsonb(row) order by row.archived_at nulls first,row.name,row.id),'[]'::jsonb) into rows from (
    select l.id,l.practice_id,l.name,l.timezone,l.contact_phone,l.contact_address,l.archived_at,l.version,
      doctor_private.has_access(l.practice_id,'locations.manage',l.id) as can_manage
    from public.locations l where l.practice_id=p_practice
      and (doctor_private.has_access(l.practice_id,'locations.read',l.id) or doctor_private.has_access(l.practice_id,'locations.manage',l.id))
      and position(lower(p_search) in lower(l.name))>0
    order by l.archived_at nulls first,l.name,l.id limit p_size offset (p_page::bigint*p_size)
  ) row;
  return jsonb_build_object('practice_name',(select name from public.practices where id=p_practice),'rows',rows,'total',total,'can_create',exists(select 1 from public.practices where id=p_practice and owner_user_id=actor));
end $$;

-- Appointments add concrete blockers in DOS-M1-014. Until then no appointment write exists.
-- Keeping the guard in the command prevents a later feature from bypassing archive policy.
create function doctor_private.location_archive_blockers(p_practice uuid,p_location uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select '[]'::jsonb $$;
create function doctor_private.location_archive_status(p_practice uuid,p_location uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare blockers jsonb;
begin
  perform doctor_private.require_access(p_practice,'locations.manage',p_location);
  if not exists(select 1 from public.locations where id=p_location and practice_id=p_practice) then
    raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';
  end if;
  blockers:=doctor_private.location_archive_blockers(p_practice,p_location);
  return jsonb_build_object('can_archive',jsonb_array_length(blockers)=0,'blockers',blockers);
end $$;

create function doctor_private.write_location(p_practice uuid,p_location uuid,p_expected_version integer,p_name text,p_timezone text,p_phone text,p_address text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); item public.locations; prior doctor_private.command_receipts;
  request jsonb:=jsonb_build_object('command','location.write','practice',p_practice,'location',p_location,'version',p_expected_version,'name',p_name,'timezone',p_timezone,'phone',p_phone,'address',p_address); result jsonb;
begin
  if p_key is null or p_practice is null or p_name is null or length(btrim(p_name)) not between 1 and 160 or p_timezone is null
    or p_phone is null or length(p_phone)>60 or p_address is null or length(p_address)>500 then
    raise exception using errcode='22023',message='DOCTOR_LOCATION_INVALID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
  if p_location is null then
    if not doctor_private.is_owner(p_practice) then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  else
    perform doctor_private.require_access(p_practice,'locations.manage',p_location);
  end if;
  select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
  if found then
    if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
    return prior.result;
  end if;
  if p_location is null then
    if p_expected_version is not null then raise exception using errcode='22023',message='DOCTOR_LOCATION_INVALID'; end if;
    insert into public.locations(practice_id,name,timezone,contact_phone,contact_address)
      values(p_practice,btrim(p_name),p_timezone,p_phone,p_address) returning * into item;
  else
    select * into item from public.locations where id=p_location and practice_id=p_practice for update;
    if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
    if item.archived_at is not null then raise exception using errcode='22023',message='DOCTOR_LOCATION_ARCHIVED'; end if;
    if item.version is distinct from p_expected_version then raise exception using errcode='40001',message='DOCTOR_LOCATION_CONFLICT'; end if;
    update public.locations set name=btrim(p_name),timezone=p_timezone,contact_phone=p_phone,contact_address=p_address,version=version+1 where id=item.id returning * into item;
  end if;
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id)
    values(p_practice,actor,case when p_location is null then 'location.created' else 'location.updated' end,item.id);
  result:=jsonb_build_object('location_id',item.id,'version',item.version);
  insert into doctor_private.command_receipts values(actor,p_key,request,result);
  return result;
end $$;

create function doctor_private.archive_location(p_practice uuid,p_location uuid,p_expected_version integer,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); item public.locations; prior doctor_private.command_receipts;
  request jsonb:=jsonb_build_object('command','location.archive','practice',p_practice,'location',p_location,'version',p_expected_version); result jsonb;
begin
  if p_key is null or p_practice is null or p_location is null then raise exception using errcode='22023',message='DOCTOR_COMMAND_KEY_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
  perform doctor_private.require_access(p_practice,'locations.manage',p_location);
  select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
  if found then
    if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
    return prior.result;
  end if;
  select * into item from public.locations where practice_id=p_practice and id=p_location for update;
  if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  if item.version is distinct from p_expected_version then raise exception using errcode='40001',message='DOCTOR_LOCATION_CONFLICT'; end if;
  if item.archived_at is not null then raise exception using errcode='22023',message='DOCTOR_LOCATION_ARCHIVED'; end if;
  if jsonb_array_length(doctor_private.location_archive_blockers(p_practice,p_location))>0 then
    raise exception using errcode='23503',message='DOCTOR_LOCATION_HAS_DEPENDENCIES';
  end if;
  update public.locations set archived_at=now(),version=version+1 where id=item.id returning * into item;
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id) values(p_practice,actor,'location.archived',item.id);
  result:=jsonb_build_object('location_id',item.id,'version',item.version);
  insert into doctor_private.command_receipts values(actor,p_key,request,result);
  return result;
end $$;

create function public.doctor_contexts() returns jsonb language sql stable security invoker set search_path='' as $$ select doctor_private.contexts() $$;
create function public.doctor_resolve_context(p_practice uuid,p_location uuid,p_expected_version integer default null) returns jsonb
language sql stable security invoker set search_path='' as $$ select doctor_private.resolve_context(p_practice,p_location,p_expected_version) $$;
create function public.doctor_locations(p_practice uuid,p_page integer default 0,p_size integer default 25,p_search text default '') returns jsonb
language sql stable security invoker set search_path='' as $$ select doctor_private.location_directory(p_practice,p_page,p_size,p_search) $$;
create function public.doctor_write_location(p_practice uuid,p_name text,p_timezone text,p_phone text,p_address text,p_key uuid,p_location uuid default null,p_expected_version integer default null) returns jsonb
language sql security invoker set search_path='' as $$ select doctor_private.write_location(p_practice,p_location,p_expected_version,p_name,p_timezone,p_phone,p_address,p_key) $$;
create function public.doctor_archive_location(p_practice uuid,p_location uuid,p_expected_version integer,p_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select doctor_private.archive_location(p_practice,p_location,p_expected_version,p_key) $$;
create function public.doctor_location_archive_status(p_practice uuid,p_location uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select doctor_private.location_archive_status(p_practice,p_location) $$;

revoke all on function doctor_private.administrative_capabilities(),doctor_private.contexts(),doctor_private.resolve_context(uuid,uuid,integer),doctor_private.location_directory(uuid,integer,integer,text),doctor_private.location_archive_blockers(uuid,uuid),doctor_private.location_archive_status(uuid,uuid),doctor_private.write_location(uuid,uuid,integer,text,text,text,text,uuid),doctor_private.archive_location(uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function doctor_private.contexts(),doctor_private.resolve_context(uuid,uuid,integer),doctor_private.location_directory(uuid,integer,integer,text),doctor_private.location_archive_status(uuid,uuid),doctor_private.write_location(uuid,uuid,integer,text,text,text,text,uuid),doctor_private.archive_location(uuid,uuid,integer,uuid) to authenticated;
revoke all on function public.doctor_contexts(),public.doctor_resolve_context(uuid,uuid,integer),public.doctor_locations(uuid,integer,integer,text),public.doctor_write_location(uuid,text,text,text,text,uuid,uuid,integer),public.doctor_archive_location(uuid,uuid,integer,uuid),public.doctor_location_archive_status(uuid,uuid) from public,anon,authenticated;
grant execute on function public.doctor_contexts(),public.doctor_resolve_context(uuid,uuid,integer),public.doctor_locations(uuid,integer,integer,text),public.doctor_write_location(uuid,text,text,text,text,uuid,uuid,integer),public.doctor_archive_location(uuid,uuid,integer,uuid),public.doctor_location_archive_status(uuid,uuid) to authenticated;
