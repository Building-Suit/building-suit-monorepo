-- DOS-M1-016. Personal product account data is neither professional identity nor authority.
create table public.account_profiles (
  user_id uuid primary key references auth.users(id),
  personal_name text not null default '' check (length(personal_name)<=120 and personal_name !~ '[[:cntrl:]]'),
  contact_phone text not null default '' check (contact_phone='' or contact_phone ~ '^\+[1-9][0-9]{6,14}$'),
  in_app_confirmations boolean not null default false,
  version integer not null default 1 check(version>0)
);
create table doctor_private.account_security_policy (
  singleton boolean primary key default true check(singleton),
  contact_reauthentication_seconds integer not null check(contact_reauthentication_seconds between 1 and 3600)
);
insert into doctor_private.account_security_policy values(true,900);
create table doctor_private.account_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id),
  actor_session_id uuid not null,
  account_version integer not null,
  contact_changed boolean not null,
  happened_at timestamptz not null default clock_timestamp(),
  unique(actor_user_id,account_version)
);
alter table public.account_profiles enable row level security;
alter table doctor_private.account_security_policy enable row level security;
alter table doctor_private.account_events enable row level security;
revoke all on public.account_profiles from public,anon,authenticated,service_role;
revoke all on doctor_private.account_security_policy,doctor_private.account_events from public,anon,authenticated,service_role;
grant select on public.account_profiles to authenticated;
create policy account_self on public.account_profiles for select to authenticated using(user_id=(select doctor_private.current_actor()));
create policy account_self_guard on public.account_profiles as restrictive for select to authenticated using(user_id=(select doctor_private.current_actor()));

create function doctor_private.account_recent_sign_in() returns boolean
language sql volatile security definer set search_path='' as $$
  select coalesce((select s.created_at is not null and s.created_at<=clock_timestamp()
    and s.created_at+make_interval(secs=>p.contact_reauthentication_seconds)>clock_timestamp()
    from auth.sessions s cross join doctor_private.account_security_policy p
    where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=doctor_private.current_actor()
      and (s.not_after is null or s.not_after>clock_timestamp()) and p.singleton),false)
$$;
create function doctor_private.account_settings() returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); item public.account_profiles;
begin
  select * into item from public.account_profiles where user_id=actor;
  return jsonb_build_object('personal_name',coalesce(item.personal_name,''),'contact_phone',coalesce(item.contact_phone,''),
    'in_app_confirmations',coalesce(item.in_app_confirmations,false),'version',coalesce(item.version,0),
    'can_change_contact',doctor_private.account_recent_sign_in());
end $$;
create function doctor_private.update_account_settings(p_personal_name text,p_contact_phone text,p_in_app_confirmations boolean,p_expected_version integer,p_key uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); item public.account_profiles; prior doctor_private.command_receipts; request jsonb; result jsonb; sensitive boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('doctor-account:'||actor::text,1));
  -- Recheck provider session after waiting; no practice-wide or cross-user lock.
  actor:=doctor_private.current_actor();
  if p_key is null or p_expected_version is null or p_expected_version<0 or p_personal_name is null or length(p_personal_name)>120
    or p_personal_name<>btrim(p_personal_name) or p_personal_name ~ '[[:cntrl:]]' or p_contact_phone is null
    or (p_contact_phone<>'' and p_contact_phone !~ '^\+[1-9][0-9]{6,14}$') or p_in_app_confirmations is null then
    raise exception using errcode='22023',message='DOCTOR_INVALID_ACCOUNT_SETTINGS';
  end if;
  request:=jsonb_build_object('operation','account.settings','session',auth.jwt()->>'session_id','name',p_personal_name,'phone',p_contact_phone,'confirmations',p_in_app_confirmations,'version',p_expected_version);
  select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
  if found and prior.request<>request then raise exception using errcode='40001',message='DOCTOR_COMMAND_CONFLICT'; end if;
  select * into item from public.account_profiles where user_id=actor;
  sensitive:=coalesce(prior.result->>'_contact_changed','false')::boolean or p_contact_phone<>coalesce(item.contact_phone,'');
  if sensitive and not doctor_private.account_recent_sign_in() then raise exception using errcode='28000',message='DOCTOR_REAUTHENTICATION_REQUIRED'; end if;
  if prior.command_key is not null then return prior.result-'_contact_changed'; end if;
  if coalesce(item.version,0)<>p_expected_version then raise exception using errcode='40001',message='DOCTOR_ACCOUNT_CONFLICT'; end if;
  insert into public.account_profiles(user_id,personal_name,contact_phone,in_app_confirmations,version)
    values(actor,p_personal_name,p_contact_phone,p_in_app_confirmations,p_expected_version+1)
    on conflict(user_id) do update set personal_name=excluded.personal_name,contact_phone=excluded.contact_phone,in_app_confirmations=excluded.in_app_confirmations,version=excluded.version;
  insert into doctor_private.account_events(actor_user_id,actor_session_id,account_version,contact_changed) values(actor,(auth.jwt()->>'session_id')::uuid,p_expected_version+1,sensitive);
  result:=doctor_private.account_settings();
  insert into doctor_private.command_receipts values(actor,p_key,request,result||jsonb_build_object('_contact_changed',sensitive));
  return result;
end $$;
revoke all on function doctor_private.account_recent_sign_in(),doctor_private.account_settings(),doctor_private.update_account_settings(text,text,boolean,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function doctor_private.account_settings(),doctor_private.update_account_settings(text,text,boolean,integer,uuid) to authenticated;
create function public.doctor_account_settings() returns jsonb language sql volatile security invoker set search_path='' as $$select doctor_private.account_settings()$$;
create function public.doctor_update_account_settings(p_personal_name text,p_contact_phone text,p_in_app_confirmations boolean,p_expected_version integer,p_key uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$select doctor_private.update_account_settings(p_personal_name,p_contact_phone,p_in_app_confirmations,p_expected_version,p_key)$$;
revoke all on function public.doctor_account_settings(),public.doctor_update_account_settings(text,text,boolean,integer,uuid) from public,anon,service_role;
grant execute on function public.doctor_account_settings(),public.doctor_update_account_settings(text,text,boolean,integer,uuid) to authenticated;
