-- SS-HOT-SHOP-SET-001: editable Shop identity after onboarding. Location
-- contact data remains owned by shop_locations, and historical documents keep
-- their existing snapshots.

create table public.shop_profile_changes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  previous_name text not null,
  new_name text not null,
  changed_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  changed_at timestamptz not null default clock_timestamp(),
  constraint shop_profile_changes_actual_change check (previous_name <> new_name)
);

create index shop_profile_changes_shop_time_idx
  on public.shop_profile_changes (shop_id, changed_at desc, id desc);

alter table public.shop_profile_changes enable row level security;
revoke all on table public.shop_profile_changes from public, anon, authenticated;
grant select on table public.shop_profile_changes to authenticated;
grant all on table public.shop_profile_changes to service_role;

create policy shop_profile_changes_settings_read
  on public.shop_profile_changes for select to authenticated
  using (shop_private.has_permission(shop_id, 'settings.manage'));

create function shop_private.prevent_shop_profile_change_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'SHOP_PROFILE_CHANGE_IMMUTABLE' using errcode = '55000';
end;
$$;
revoke all on function shop_private.prevent_shop_profile_change_mutation()
  from public, anon, authenticated, service_role;
create trigger trg_shop_profile_changes_immutable
before update or delete on public.shop_profile_changes
for each row execute function shop_private.prevent_shop_profile_change_mutation();

create function shop_private.save_shop_profile(p_shop_id uuid, p_display_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_actor_profile_id uuid;
  v_previous_name text;
  v_new_name text := btrim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_shop_id is null or length(v_new_name) not between 2 and 120 then
    raise exception 'INVALID_SHOP_NAME' using errcode = '22023';
  end if;
  if not shop_private.has_permission(p_shop_id, 'settings.manage') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;

  select shop.name, membership.profile_id
    into v_previous_name, v_actor_profile_id
  from public.shops shop
  join public.shop_memberships membership
    on membership.shop_id = shop.id
   and membership.status = 'active'::public.shop_membership_status
   and membership.removed_at is null
  join public.profiles profile
    on profile.id = membership.profile_id
   and profile.portal_id = shop.portal_id
   and profile.status = 'active'::public.profile_status
   and profile.user_id = auth.uid()
  where shop.id = p_shop_id
    and shop.status = 'active'::public.shop_status
  for update of shop;

  if not found then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if v_previous_name = v_new_name then return v_previous_name; end if;

  update public.shops
  set name = v_new_name, updated_at = clock_timestamp()
  where id = p_shop_id;

  insert into public.shop_profile_changes (
    shop_id, previous_name, new_name, changed_by_profile_id
  ) values (
    p_shop_id, v_previous_name, v_new_name, v_actor_profile_id
  );

  return v_new_name;
end;
$$;

create function public.save_shop_profile(p_shop_id uuid, p_display_name text)
returns text language sql security definer set search_path = '' as $$
  select shop_private.save_shop_profile(p_shop_id, p_display_name);
$$;

revoke all on function shop_private.save_shop_profile(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function shop_private.save_shop_profile(uuid, text) to service_role;
revoke all on function public.save_shop_profile(uuid, text)
  from public, anon, authenticated;
grant execute on function public.save_shop_profile(uuid, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
