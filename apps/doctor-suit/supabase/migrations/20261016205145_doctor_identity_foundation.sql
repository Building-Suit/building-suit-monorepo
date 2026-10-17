-- DOS-M1-003. Independent Doctor identity/practice/location/membership foundation.
create schema doctor_private;
revoke all on schema doctor_private from public, anon;
grant usage on schema doctor_private to authenticated;

create table public.doctor_profiles (
  user_id uuid primary key references auth.users(id),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  professional_verification text not null default 'unverified' check (professional_verification = 'unverified'),
  created_at timestamptz not null default now()
);
create table public.practices (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.doctor_profiles(user_id),
  name text not null check (length(btrim(name)) between 1 and 160),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now()
);
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id),
  name text not null check (length(btrim(name)) between 1 and 160),
  timezone text not null,
  archived_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (practice_id, id)
);
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id),
  user_id uuid not null references auth.users(id),
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  capabilities text[] not null default '{}' check (capabilities <@ array[
    'dashboard.read','locations.read','locations.manage','patients.read','patients.write',
    'documents.read','documents.write','availability.manage','appointments.read','appointments.write','queue.manage'
  ]::text[]),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique(practice_id,user_id), unique(practice_id,id)
);
create table public.membership_locations (
  practice_id uuid not null,
  membership_id uuid not null,
  location_id uuid not null,
  primary key(membership_id, location_id),
  foreign key(practice_id,membership_id) references public.memberships(practice_id,id),
  foreign key(practice_id,location_id) references public.locations(practice_id,id)
);
create index memberships_user_active on public.memberships(user_id, practice_id) where status = 'active';
create index membership_locations_practice on public.membership_locations(practice_id, location_id);
create index locations_practice on public.locations(practice_id);
create table public.audit_events (
  id bigint generated always as identity primary key,
  practice_id uuid not null references public.practices(id),
  actor_user_id uuid not null references auth.users(id),
  event_type text not null,
  entity_id uuid not null,
  happened_at timestamptz not null default now()
);
create index audit_events_practice_time on public.audit_events(practice_id,happened_at desc,id desc);
create table doctor_private.command_receipts (
  actor_user_id uuid not null references auth.users(id),
  command_key uuid not null,
  request jsonb not null,
  result jsonb not null,
  primary key(actor_user_id,command_key)
);

create function doctor_private.current_actor() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until <= now())
  ) then raise exception using errcode='42501',message='DOCTOR_AUTH_REQUIRED'; end if;
  return actor;
end $$;
create function doctor_private.has_access(p_practice uuid, p_capability text, p_location uuid default null) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := doctor_private.current_actor();
begin
  if p_practice is null or p_capability is null or not p_capability=any(array[
    'dashboard.read','locations.read','locations.manage','patients.read','patients.write',
    'documents.read','documents.write','availability.manage','appointments.read','appointments.write','queue.manage'
  ]::text[]) then return false; end if;
  -- Owner authority comes only from stored practice ownership, never metadata or staff grants.
  if exists(select 1 from public.practices p where p.id=p_practice and p.owner_user_id=actor) then
    return p_location is null or exists(select 1 from public.locations l where l.id=p_location and l.practice_id=p_practice);
  end if;
  return exists (
    select 1 from public.memberships m where m.practice_id=p_practice and m.user_id=actor and m.status='active'
      and p_capability=any(m.capabilities)
      and (p_location is null or exists (
        select 1 from public.membership_locations ml where ml.membership_id=m.id and ml.practice_id=p_practice and ml.location_id=p_location
      ))
  );
end $$;
create function doctor_private.is_owner(p_practice uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.practices p where p.id=p_practice and p.owner_user_id=doctor_private.current_actor())
$$;
create function doctor_private.require_access(p_practice uuid, p_capability text, p_location uuid default null) returns void
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not doctor_private.has_access(p_practice,p_capability,p_location) then
    raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';
  end if;
end $$;
create function doctor_private.validate_location_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=new.timezone) then
    raise exception using errcode='22023',message='DOCTOR_TIMEZONE_INVALID';
  end if;
  return new;
end $$;
create trigger locations_timezone before insert or update of timezone on public.locations
for each row execute function doctor_private.validate_location_timezone();

-- Only a confirmed, non-anonymous identity may create its own practice. This is not professional verification.
create function doctor_private.onboard(p_name text,p_location_name text,p_timezone text,p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=doctor_private.current_actor(); prior doctor_private.command_receipts;
  request jsonb:=jsonb_build_object('command','onboard','name',p_name,'location',p_location_name,'timezone',p_timezone);
  practice uuid; location uuid; result jsonb;
begin
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
create function public.doctor_onboard(p_name text,p_location_name text,p_timezone text,p_key uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select doctor_private.onboard(p_name,p_location_name,p_timezone,p_key) $$;

alter table public.doctor_profiles enable row level security;
alter table public.practices enable row level security;
alter table public.locations enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_locations enable row level security;
alter table public.audit_events enable row level security;
alter table doctor_private.command_receipts enable row level security;
revoke all on public.doctor_profiles,public.practices,public.locations,public.memberships,public.membership_locations,public.audit_events from public,anon,authenticated;
grant select on public.doctor_profiles,public.practices,public.locations,public.memberships,public.membership_locations,public.audit_events to authenticated;
create policy profiles_self on public.doctor_profiles for select to authenticated using (user_id=(select doctor_private.current_actor()));
create policy practice_context on public.practices for select to authenticated using (
  owner_user_id=(select doctor_private.current_actor()) or exists (
    select 1 from public.memberships m where m.practice_id=practices.id and m.user_id=(select doctor_private.current_actor()) and m.status='active'
  )
);
create policy location_scope on public.locations for select to authenticated using (doctor_private.has_access(practice_id,'locations.read',id) or doctor_private.has_access(practice_id,'locations.manage',id));
create policy membership_self_or_owner on public.memberships for select to authenticated using (user_id=(select doctor_private.current_actor()) or doctor_private.is_owner(practice_id));
create policy grants_self_or_owner on public.membership_locations for select to authenticated using (
  doctor_private.is_owner(practice_id) or exists(select 1 from public.memberships m where m.id=membership_id and m.user_id=(select doctor_private.current_actor()) and m.status='active')
);
create policy audit_owner on public.audit_events for select to authenticated using (doctor_private.is_owner(practice_id));
-- No client table write, audit update/delete, anonymous read or direct receipt access.
revoke all on all functions in schema doctor_private from public,anon,authenticated;
grant execute on function doctor_private.current_actor(), doctor_private.has_access(uuid,text,uuid), doctor_private.is_owner(uuid), doctor_private.require_access(uuid,text,uuid), doctor_private.onboard(text,text,text,uuid) to authenticated;
revoke all on function public.doctor_onboard(text,text,text,uuid) from public,anon;
grant execute on function public.doctor_onboard(text,text,text,uuid) to authenticated;
