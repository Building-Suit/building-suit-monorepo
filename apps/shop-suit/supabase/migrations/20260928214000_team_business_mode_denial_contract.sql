-- SS-TEAM-001: install the denial-contract correction on databases that already
-- applied the team migration. Editing that migration cannot update its function
-- on those databases because migration up only executes new versions.
create or replace function shop_private.set_shop_business_mode(
  p_shop_id uuid, p_business_mode public.business_mode
) returns public.business_mode language plpgsql security definer set search_path = '' as $$
declare v_actor_profile_id uuid; v_previous_mode public.business_mode;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_shop_id is null or p_business_mode is null then
    raise exception 'INVALID_BUSINESS_MODE' using errcode = '22023';
  end if;
  -- Preserve the established public denial contract while allowing a
  -- delegated role with settings.manage to pass this guard.
  if not shop_private.has_permission(p_shop_id, 'settings.manage') then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  select shop.business_mode, membership.profile_id into v_previous_mode, v_actor_profile_id
  from public.shops shop
  join public.shop_memberships membership on membership.shop_id = shop.id
  join public.profiles profile on profile.id = membership.profile_id
  where shop.id = p_shop_id and shop.status = 'active'
    and membership.status = 'active' and membership.removed_at is null
    and profile.status = 'active' and profile.user_id = auth.uid()
  for update of shop;
  if not found then raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501'; end if;
  if v_previous_mode = p_business_mode then return v_previous_mode; end if;
  update public.shops set business_mode = p_business_mode, updated_at = now() where id = p_shop_id;
  insert into public.shop_business_mode_changes
    (shop_id, previous_mode, new_mode, changed_by_profile_id)
  values (p_shop_id, v_previous_mode, p_business_mode, v_actor_profile_id);
  return p_business_mode;
end;
$$;
