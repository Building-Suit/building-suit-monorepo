-- DOS-M1-007. Synthetic owner setup; no professional verification or paid entitlement.
create table public.onboarding_drafts (
  user_id uuid primary key references auth.users(id),
  command_key uuid not null,
  display_name text not null default '' check(length(display_name)<=120),
  practice_name text not null default '' check(length(practice_name)<=160),
  location_name text not null default '' check(length(location_name)<=160),
  timezone text not null default '' check(length(timezone)<=100),
  version integer not null default 1 check(version>0),
  updated_at timestamptz not null default now()
);
alter table public.onboarding_drafts enable row level security;
revoke all on public.onboarding_drafts from public,anon,authenticated;
grant select on public.onboarding_drafts to authenticated;
create policy draft_self on public.onboarding_drafts for select to authenticated
using(user_id=(select doctor_private.current_actor()));

-- A delegated-only identity cannot turn staff membership into ownership via setup.
-- Existing owners retain their own practice even when delegated elsewhere.
create function doctor_private.require_owner_enrollment() returns void
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor();
begin
  if not exists(select 1 from public.practices where owner_user_id=actor)
    and exists(select 1 from public.memberships where user_id=actor) then
    raise exception using errcode='42501',message='DOCTOR_OWNER_ENROLLMENT_REQUIRED';
  end if;
end $$;

create function doctor_private.practice_setup() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); practice public.practices; location public.locations;
  profile public.doctor_profiles; draft public.onboarding_drafts;
begin
  select * into practice from public.practices where owner_user_id=actor;
  select * into profile from public.doctor_profiles where user_id=actor;
  select * into location from public.locations where practice_id=practice.id and archived_at is null order by created_at,id limit 1;
  select * into draft from public.onboarding_drafts where user_id=actor;
  return jsonb_build_object(
    'enrollment',case when practice.id is not null or not exists(select 1 from public.memberships where user_id=actor) then 'owner' else 'delegated-only' end,
    'profile',case when profile.user_id is null then null else jsonb_build_object('display_name',profile.display_name,'professional_verification',profile.professional_verification) end,
    'practice',case when practice.id is null then null else jsonb_build_object('id',practice.id,'name',practice.name,'version',practice.version) end,
    'location',case when location.id is null then null else jsonb_build_object('id',location.id,'name',location.name,'timezone',location.timezone,'version',location.version) end,
    'draft',case when draft.user_id is null then null else jsonb_build_object('command_key',draft.command_key,'display_name',draft.display_name,'practice_name',draft.practice_name,'location_name',draft.location_name,'timezone',draft.timezone,'version',draft.version) end
  );
end $$;

create function doctor_private.save_onboarding_draft(p_key uuid,p_expected_version integer,p_display_name text,p_practice_name text,p_location_name text,p_timezone text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); draft public.onboarding_drafts;
begin
  perform doctor_private.require_owner_enrollment();
  if p_key is null or p_display_name is null or p_practice_name is null or p_location_name is null or p_timezone is null
    or length(p_display_name)>120 or length(p_practice_name)>160 or length(p_location_name)>160 or length(p_timezone)>100 then
    raise exception using errcode='22023',message='DOCTOR_PROFILE_INVALID';
  end if;
  if p_timezone<>'' and not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
    raise exception using errcode='22023',message='DOCTOR_TIMEZONE_INVALID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  if exists(select 1 from public.practices where owner_user_id=actor) then raise exception using errcode='23505',message='DOCTOR_PRACTICE_EXISTS'; end if;
  select * into draft from public.onboarding_drafts where user_id=actor for update;
  if found then
    if draft.command_key<>p_key then raise exception using errcode='40001',message='DOCTOR_DRAFT_CONFLICT'; end if;
    -- Exact retries return the existing version, including an uncertain previous response.
    if (draft.display_name,draft.practice_name,draft.location_name,draft.timezone)=(p_display_name,p_practice_name,p_location_name,p_timezone) then
      return doctor_private.practice_setup()->'draft';
    end if;
    if p_expected_version is distinct from draft.version then raise exception using errcode='40001',message='DOCTOR_DRAFT_CONFLICT'; end if;
    update public.onboarding_drafts set display_name=p_display_name,practice_name=p_practice_name,location_name=p_location_name,timezone=p_timezone,version=version+1,updated_at=now() where user_id=actor;
  else
    if coalesce(p_expected_version,0)<>0 then raise exception using errcode='40001',message='DOCTOR_DRAFT_CONFLICT'; end if;
    insert into public.onboarding_drafts(user_id,command_key,display_name,practice_name,location_name,timezone) values(actor,p_key,p_display_name,p_practice_name,p_location_name,p_timezone);
  end if;
  return doctor_private.practice_setup()->'draft';
end $$;

create function doctor_private.complete_onboarding(p_key uuid,p_draft_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); draft public.onboarding_drafts; prior doctor_private.command_receipts;
  request jsonb; result jsonb; practice uuid; location uuid;
begin
  perform doctor_private.require_owner_enrollment();
  if p_key is null or p_draft_version is null or p_draft_version<1 then raise exception using errcode='22023',message='DOCTOR_COMMAND_KEY_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
  if found then
    if prior.request->>'command'<>'onboard-v2' or (prior.request->>'draft_version')::integer is distinct from p_draft_version then
      raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';
    end if;
    return prior.result;
  end if;
  select * into draft from public.onboarding_drafts where user_id=actor for update;
  if not found then raise exception using errcode='P0002',message='DOCTOR_DRAFT_REQUIRED'; end if;
  if draft.command_key<>p_key or draft.version<>p_draft_version then raise exception using errcode='40001',message='DOCTOR_DRAFT_CONFLICT'; end if;
  if length(btrim(draft.display_name))<1 or length(btrim(draft.practice_name))<1 or length(btrim(draft.location_name))<1 or draft.timezone='' then
    raise exception using errcode='22023',message='DOCTOR_ONBOARDING_INCOMPLETE';
  end if;
  if exists(select 1 from public.practices where owner_user_id=actor) then raise exception using errcode='23505',message='DOCTOR_PRACTICE_EXISTS'; end if;
  insert into public.doctor_profiles(user_id,display_name) values(actor,btrim(draft.display_name));
  insert into public.practices(owner_user_id,name) values(actor,btrim(draft.practice_name)) returning id into practice;
  insert into public.locations(practice_id,name,timezone) values(practice,btrim(draft.location_name),draft.timezone) returning id into location;
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id) values(practice,actor,'practice.created',practice);
  request:=jsonb_build_object('command','onboard-v2','draft_version',p_draft_version,'display_name',draft.display_name,'practice_name',draft.practice_name,'location_name',draft.location_name,'timezone',draft.timezone);
  result:=jsonb_build_object('practice_id',practice,'location_id',location,'version',1);
  insert into doctor_private.command_receipts values(actor,p_key,request,result);
  delete from public.onboarding_drafts where user_id=actor;
  return result;
end $$;

create function doctor_private.update_practice_profile(p_practice uuid,p_expected_version integer,p_display_name text,p_practice_name text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); practice public.practices; prior doctor_private.command_receipts;
  request jsonb:=jsonb_build_object('command','profile.update','practice',p_practice,'version',p_expected_version,'display_name',p_display_name,'practice_name',p_practice_name); result jsonb;
begin
  if p_key is null or p_display_name is null or p_practice_name is null or length(btrim(p_display_name)) not between 1 and 120 or length(btrim(p_practice_name)) not between 1 and 160 then
    raise exception using errcode='22023',message='DOCTOR_PROFILE_INVALID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  select * into practice from public.practices where id=p_practice and owner_user_id=actor for update;
  if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
  select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
  if found then
    if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
    return prior.result;
  end if;
  if practice.version is distinct from p_expected_version then raise exception using errcode='40001',message='DOCTOR_PROFILE_CONFLICT'; end if;
  update public.doctor_profiles set display_name=btrim(p_display_name) where user_id=actor;
  update public.practices set name=btrim(p_practice_name),version=version+1 where id=practice.id returning version into practice.version;
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id) values(practice.id,actor,'practice.profile_updated',practice.id);
  result:=jsonb_build_object('practice_id',practice.id,'version',practice.version);
  insert into doctor_private.command_receipts values(actor,p_key,request,result);
  return result;
end $$;

create function public.doctor_practice_setup() returns jsonb language sql stable security invoker set search_path='' as $$ select doctor_private.practice_setup() $$;
create function public.doctor_save_onboarding_draft(p_key uuid,p_expected_version integer,p_display_name text,p_practice_name text,p_location_name text,p_timezone text) returns jsonb
language sql security invoker set search_path='' as $$ select doctor_private.save_onboarding_draft(p_key,p_expected_version,p_display_name,p_practice_name,p_location_name,p_timezone) $$;
create function public.doctor_complete_onboarding(p_key uuid,p_draft_version integer) returns jsonb
language sql security invoker set search_path='' as $$ select doctor_private.complete_onboarding(p_key,p_draft_version) $$;
create function public.doctor_update_practice_profile(p_practice uuid,p_expected_version integer,p_display_name text,p_practice_name text,p_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select doctor_private.update_practice_profile(p_practice,p_expected_version,p_display_name,p_practice_name,p_key) $$;

revoke all on function doctor_private.require_owner_enrollment(),doctor_private.practice_setup(),doctor_private.save_onboarding_draft(uuid,integer,text,text,text,text),doctor_private.complete_onboarding(uuid,integer),doctor_private.update_practice_profile(uuid,integer,text,text,uuid) from public,anon,authenticated;
grant execute on function doctor_private.require_owner_enrollment(),doctor_private.practice_setup(),doctor_private.save_onboarding_draft(uuid,integer,text,text,text,text),doctor_private.complete_onboarding(uuid,integer),doctor_private.update_practice_profile(uuid,integer,text,text,uuid) to authenticated;
revoke all on function public.doctor_practice_setup(),public.doctor_save_onboarding_draft(uuid,integer,text,text,text,text),public.doctor_complete_onboarding(uuid,integer),public.doctor_update_practice_profile(uuid,integer,text,text,uuid) from public,anon,authenticated;
grant execute on function public.doctor_practice_setup(),public.doctor_save_onboarding_draft(uuid,integer,text,text,text,text),public.doctor_complete_onboarding(uuid,integer),public.doctor_update_practice_profile(uuid,integer,text,text,uuid) to authenticated;

-- Keep the existing onboarding entry point compatible while closing delegated self-promotion.
create or replace function doctor_private.onboard(p_name text,p_location_name text,p_timezone text,p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=doctor_private.current_actor(); prior doctor_private.command_receipts;
  request jsonb:=jsonb_build_object('command','onboard','name',p_name,'location',p_location_name,'timezone',p_timezone);
  practice uuid; location uuid; result jsonb;
begin
  perform doctor_private.require_owner_enrollment();
  if p_key is null then raise exception using errcode='22023',message='DOCTOR_COMMAND_KEY_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
  if found then
    if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT'; end if;
    return prior.result;
  end if;
  if exists(select 1 from public.practices where owner_user_id=actor) then
    raise exception using errcode='23505',message='DOCTOR_PRACTICE_EXISTS';
  end if;
  insert into public.doctor_profiles(user_id,display_name) values(actor,p_name);
  insert into public.practices(owner_user_id,name) values(actor,p_name) returning id into practice;
  insert into public.locations(practice_id,name,timezone) values(practice,p_location_name,p_timezone) returning id into location;
  insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id) values(practice,actor,'practice.created',practice);
  result:=jsonb_build_object('practice_id',practice,'location_id',location,'version',1);
  insert into doctor_private.command_receipts values(actor,p_key,request,result);
  return result;
end $$;
