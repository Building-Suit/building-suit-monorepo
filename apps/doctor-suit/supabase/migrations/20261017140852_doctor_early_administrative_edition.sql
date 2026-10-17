-- DOS-AE-002. Synthetic administrative candidate only. No live activation path.
create table public.doctor_edition_policy(
 singleton boolean primary key default true check(singleton),
 mode text not null check(mode in('synthetic_preview','administrative_candidate')),
 revision integer not null check(revision>0),
 change_reason text not null check(length(btrim(change_reason)) between 1 and 200),
 changed_at timestamptz not null default now()
);
insert into public.doctor_edition_policy(singleton,mode,revision,change_reason)
 values(true,'synthetic_preview',1,'Existing synthetic preview; live activation unavailable');
create table public.doctor_edition_policy_events(
 revision integer primary key, previous_mode text, next_mode text not null,
 change_reason text not null, database_actor text not null, happened_at timestamptz not null default now()
);
insert into public.doctor_edition_policy_events(revision,next_mode,change_reason,database_actor)
 select revision,mode,change_reason,session_user from public.doctor_edition_policy;
alter table public.doctor_edition_policy enable row level security;
alter table public.doctor_edition_policy force row level security;
alter table public.doctor_edition_policy_events enable row level security;
alter table public.doctor_edition_policy_events force row level security;
-- Definer-owned reads/writes must also work when the managed postgres owner is
-- not a superuser/BYPASSRLS role. No API/client role inherits this policy.
create policy doctor_edition_policy_owner on public.doctor_edition_policy for all to postgres using(true)with check(true);
create policy doctor_edition_events_owner on public.doctor_edition_policy_events for all to postgres using(true)with check(true);
revoke all on public.doctor_edition_policy,public.doctor_edition_policy_events from public,anon,authenticated,service_role;

create function doctor_private.edition_policy_change()returns trigger
language plpgsql security definer set search_path=''as $$
begin
 if tg_op='DELETE'then raise exception using errcode='42501',message='DOCTOR_EDITION_POLICY_REQUIRED';end if;
 if new.singleton is distinct from old.singleton or new.revision<>old.revision+1 then
  raise exception using errcode='40001',message='DOCTOR_EDITION_POLICY_CONFLICT';end if;
 new.changed_at:=clock_timestamp();
 insert into public.doctor_edition_policy_events(revision,previous_mode,next_mode,change_reason,database_actor)
 values(new.revision,old.mode,new.mode,new.change_reason,session_user);
 return new;
end $$;
create trigger doctor_edition_policy_change before update or delete on public.doctor_edition_policy
 for each row execute function doctor_private.edition_policy_change();
create function doctor_private.edition_event_immutable()returns trigger
language plpgsql security invoker set search_path=''as $$
begin raise exception using errcode='42501',message='DOCTOR_EDITION_HISTORY_IMMUTABLE';end $$;
create trigger doctor_edition_event_immutable before update or delete or truncate on public.doctor_edition_policy_events
 for each statement execute function doctor_private.edition_event_immutable();

create function doctor_private.edition_mode()returns text
language plpgsql stable security definer set search_path=''as $$
declare selected text;
begin
 select mode into selected from public.doctor_edition_policy where singleton;
 if selected is null then raise exception using errcode='42501',message='DOCTOR_EDITION_UNAVAILABLE';end if;
 return selected;
end $$;
-- The static storage capability domain remains unchanged. Existing grants and
-- their CHECK constraints must not be rewritten by an edition change.
create function doctor_private.edition_capabilities()returns text[]
language plpgsql stable security definer set search_path=''as $$
declare selected text:=doctor_private.edition_mode(); result text[];
begin
 select coalesce(array_agg(cap order by ordinal),'{}'::text[])into result
 from unnest(doctor_private.administrative_capabilities())with ordinality as item(cap,ordinal)
 where selected='synthetic_preview'or cap not in('documents.read','documents.write');
 return result;
end $$;
create function doctor_private.edition_filter_capabilities(p_caps text[])returns text[]
language sql stable security definer set search_path=''as $$
 select coalesce(array_agg(cap order by ordinal),'{}'::text[])
 from unnest(p_caps)with ordinality as item(cap,ordinal)
 where cap=any(doctor_private.edition_capabilities())
$$;
create function doctor_private.edition_context()returns jsonb
language plpgsql stable security definer set search_path=''as $$
begin
 perform doctor_private.current_actor();
 return jsonb_build_object('edition',doctor_private.edition_mode(),'revision',(select revision from public.doctor_edition_policy where singleton),
  'data_mode','synthetic','live_activation',false,'capabilities',doctor_private.edition_capabilities(),
  'clinical_records',false,'prescribing',false,'free_text_notes',false,'imports',false,'outbound_messages',false,'patient_collection',false);
end $$;
create function public.doctor_administrative_edition()returns jsonb
language sql stable security invoker set search_path=''as $$select doctor_private.edition_context()$$;

create or replace function doctor_private.has_access(p_practice uuid,p_capability text,p_location uuid default null) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor();
begin
 if p_practice is null or p_capability is null or not p_capability=any(doctor_private.edition_capabilities()) then return false; end if;
 if exists(select 1 from public.practices where id=p_practice and owner_user_id=actor) then
  return p_location is null or exists(select 1 from public.locations where id=p_location and practice_id=p_practice);
 end if;
 return exists(select 1 from public.memberships m join public.membership_locations ml on ml.membership_id=m.id and ml.practice_id=m.practice_id
  where m.practice_id=p_practice and m.user_id=actor and m.status='active'
   and p_capability=any(coalesce(ml.capabilities,m.capabilities)) and (p_location is null or ml.location_id=p_location));
end $$;
create or replace function doctor_private.contexts() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object(
  'practice_id',p.id,'practice_name',p.name,'doctor_name',d.display_name,'location_id',l.id,'location_name',l.name,'timezone',l.timezone,
  'portal',case when p.owner_user_id=actor then 'doctor' else 'secretary' end,
  'grants_version',case when p.owner_user_id=actor then p.version else m.version end,'location_version',l.version,
  'edition',doctor_private.edition_mode(),'edition_revision',(select revision from public.doctor_edition_policy where singleton),
  'capabilities',doctor_private.edition_filter_capabilities(case when p.owner_user_id=actor then doctor_private.administrative_capabilities() else coalesce(ml.capabilities,m.capabilities) end)
 ) order by p.name,p.id,l.name,l.id),'[]'::jsonb) into result
 from public.practices p join public.doctor_profiles d on d.user_id=p.owner_user_id join public.locations l on l.practice_id=p.id and l.archived_at is null
 left join public.memberships m on m.practice_id=p.id and m.user_id=actor and m.status='active'
 left join public.membership_locations ml on ml.practice_id=p.id and ml.membership_id=m.id and ml.location_id=l.id
 where p.owner_user_id=actor or (ml.membership_id is not null and cardinality(doctor_private.edition_filter_capabilities(coalesce(ml.capabilities,m.capabilities)))>0);
 return result;
end $$;
create or replace function doctor_private.validate_grants(p_practice uuid,p_grants jsonb,p_archived boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item jsonb; location uuid; capabilities text[]; result jsonb:='[]'; seen uuid[]:='{}';
begin
 if p_grants is null or jsonb_typeof(p_grants)<>'array' then raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
 if jsonb_array_length(p_grants) not between 1 and 100 then raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
 for item in select value from jsonb_array_elements(p_grants) loop
  if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>2
   or not(item ? 'location_id' and item ? 'capabilities') or coalesce(item->>'location_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or jsonb_typeof(item->'capabilities') is distinct from 'array' then raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
  location:=(item->>'location_id')::uuid;
  if location=any(seen) or not exists(select 1 from public.locations where id=location and practice_id=p_practice and (p_archived or archived_at is null)) then
   raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
  if jsonb_array_length(item->'capabilities') not between 1 and cardinality(doctor_private.administrative_capabilities()) or exists(select 1 from jsonb_array_elements(item->'capabilities') where jsonb_typeof(value)<>'string') then
   raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
  select array_agg(distinct value order by value) into capabilities from jsonb_array_elements_text(item->'capabilities');
  if not capabilities <@ doctor_private.administrative_capabilities() or (not p_archived and not capabilities <@ doctor_private.edition_capabilities()) then raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
  seen:=array_append(seen,location); result:=result||jsonb_build_array(jsonb_build_object('location_id',location,'capabilities',capabilities));
 end loop;
 return (select jsonb_agg(value order by value->>'location_id') from jsonb_array_elements(result));
end $$;
create function doctor_private.edition_reason_codes()returns text[]
language sql immutable security invoker set search_path=''as $$select array['admin.patient_request','admin.schedule_change','admin.booking_correction','admin.cancellation']::text[]$$;
create function doctor_private.edition_history_details(p_details jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare result jsonb; side text; snapshot jsonb;
begin
 if doctor_private.edition_mode()='synthetic_preview'then return p_details;end if;
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb)into result from jsonb_each(p_details)
 where key=any(array['reason','from','to'])or(key=any(array['location_id','location_name','timezone','starts_at','ends_at'])and jsonb_typeof(value)='string'and length(value#>>'{}')<=200);
 if result?'reason'and not coalesce(result->>'reason'=any(doctor_private.edition_reason_codes()),false)then
  result:=jsonb_set(result,'{reason}','null'::jsonb);end if;
 foreach side in array array['from','to']loop
  if jsonb_typeof(result->side)='object'then
   select coalesce(jsonb_object_agg(key,value),'{}'::jsonb)into snapshot from jsonb_each(result->side)
   where key=any(array['location_id','location_name','timezone','starts_at','ends_at'])and jsonb_typeof(value)='string'and length(value#>>'{}')<=200;
   result:=jsonb_set(result,array[side],snapshot);
  elsif jsonb_typeof(result->side)='string'and not(result->>side)=any(array['booked','checked_in','in_progress','completed','cancelled','no_show'])then
   result:=jsonb_set(result,array[side],'null'::jsonb);
  elsif result?side and jsonb_typeof(result->side)not in('object','string','null')then
   result:=jsonb_set(result,array[side],'null'::jsonb);
  end if;
 end loop;
 return result;
end $$;
create or replace function doctor_private.appointment_reason(p_reason text) returns text
language plpgsql stable security definer set search_path='' as $$
begin
  if p_reason is null or length(btrim(p_reason)) not between 1 and 200 or p_reason~'[[:cntrl:]]' then raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_REASON_REQUIRED'; end if;
  if doctor_private.edition_mode()='administrative_candidate'and not btrim(p_reason)=any(doctor_private.edition_reason_codes()) then
   raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_REASON_REQUIRED';end if;
  return btrim(p_reason);
end $$;
create or replace function doctor_private.read_appointment_history(p_practice uuid,p_location uuid,p_appointment uuid,p_page integer) returns jsonb
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
    'actor_user_id',e.actor_user_id,'location_id',e.location_id,'details',doctor_private.edition_history_details(e.details)) order by e.id desc),'[]') into events
    from(select * from public.appointment_events where practice_id=p_practice and appointment_id=p_appointment order by id desc limit 20 offset p_page*20)e;
  return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'appointment_id',p_appointment,'version',item.version,'page',p_page,'total',total,'events',events);
end $$;
revoke all on function doctor_private.edition_policy_change(),doctor_private.edition_event_immutable(),doctor_private.edition_mode(),doctor_private.edition_capabilities(),doctor_private.edition_filter_capabilities(text[]),doctor_private.edition_context(),doctor_private.edition_reason_codes(),doctor_private.edition_history_details(jsonb) from public,anon,authenticated,service_role;
grant execute on function doctor_private.edition_context()to authenticated;
revoke all on function public.doctor_administrative_edition()from public,anon,authenticated,service_role;
grant execute on function public.doctor_administrative_edition()to authenticated;
