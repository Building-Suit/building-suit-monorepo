-- SS-HOT-LOC-001: complete location onboarding, editing, archival, and restore.

alter table public.shop_locations
  add constraint shop_locations_default_must_be_active
  check (not is_default or status = 'active');

create function shop_private.create_owner_shop(
  p_shop_name text,
  p_business_mode public.business_mode,
  p_main_location_name text,
  p_main_location_code text,
  p_main_location_address text,
  p_main_location_phone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_portal_id uuid;
  v_existing_shop_id uuid;
  v_shop_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_main_location_name is null
    or length(btrim(p_main_location_name)) not between 2 and 120
    or (nullif(btrim(p_main_location_code), '') is not null
      and length(btrim(p_main_location_code)) > 32) then
    raise exception 'INVALID_MAIN_LOCATION' using errcode = '22023';
  end if;

  -- Serialize retries for one Auth identity before checking whether the
  -- plan-neutral onboarding command already committed.
  perform 1 from auth.users auth_user where auth_user.id = v_user_id for update;
  if not found then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;

  select portal.id into v_portal_id
  from public.portals portal
  where portal.key = 'shop-crm' and portal.is_active;
  select membership.shop_id into v_existing_shop_id
  from public.profiles profile
  join public.shop_memberships membership on membership.profile_id = profile.id
  where profile.user_id = v_user_id and profile.portal_id = v_portal_id
    and membership.role = 'owner'
  order by membership.created_at, membership.id
  limit 1;
  if v_existing_shop_id is not null then return v_existing_shop_id; end if;

  v_shop_id := shop_private.create_owner_shop(p_shop_name, p_business_mode);
  update public.shop_locations location
  set name = btrim(p_main_location_name),
    code = nullif(btrim(p_main_location_code), ''),
    address = nullif(btrim(p_main_location_address), ''),
    phone = nullif(btrim(p_main_location_phone), ''),
    updated_at = now()
  where location.shop_id = v_shop_id and location.is_default;
  if not found then
    raise exception 'SHOP_DEFAULT_LOCATION_MISSING' using errcode = '23514';
  end if;
  return v_shop_id;
end;
$$;

revoke all on function shop_private.create_owner_shop(
  text, public.business_mode, text, text, text, text
) from public, anon, authenticated, service_role;

create function public.create_owner_shop(
  p_shop_name text,
  p_business_mode public.business_mode,
  p_main_location_name text,
  p_main_location_code text,
  p_main_location_address text,
  p_main_location_phone text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select shop_private.create_owner_shop(
    p_shop_name, p_business_mode, p_main_location_name,
    p_main_location_code, p_main_location_address, p_main_location_phone
  );
$$;

revoke all on function public.create_owner_shop(
  text, public.business_mode, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_owner_shop(
  text, public.business_mode, text, text, text, text
) to authenticated;

create function shop_private.restore_shop_location(
  p_shop_id uuid,
  p_location_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not shop_private.has_permission(p_shop_id, 'settings.manage') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  -- The active-resource trigger takes this same transaction lock before
  -- checking capacity. Taking it here also bounds the target-state check.
  perform shop_private.lock_plan_resource(p_shop_id, 'active_locations');
  update public.shop_locations location
  set status = 'active', archived_at = null, updated_at = now()
  where location.id = p_location_id and location.shop_id = p_shop_id
    and location.status = 'archived' and not location.is_default;
  if not found then
    raise exception 'LOCATION_NOT_RESTORABLE' using errcode = '55000';
  end if;
end;
$$;

revoke all on function shop_private.restore_shop_location(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function shop_private.restore_shop_location(uuid, uuid)
  to service_role;

create function public.restore_shop_location(
  p_shop_id uuid,
  p_location_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  select shop_private.restore_shop_location(p_shop_id, p_location_id);
$$;

revoke all on function public.restore_shop_location(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.restore_shop_location(uuid, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
