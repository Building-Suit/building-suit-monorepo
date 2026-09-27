-- Operational workflow configuration is deliberately independent from plans,
-- quotas and feature entitlements. Existing shops retain their current visible
-- capabilities through the compatibility default of mixed.
create type public.business_mode as enum ('product', 'service', 'mixed');

alter table public.shops
  add column business_mode public.business_mode not null default 'mixed';

create table public.shop_business_mode_changes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  previous_mode public.business_mode not null,
  new_mode public.business_mode not null,
  changed_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  changed_at timestamptz not null default now(),
  constraint shop_business_mode_changes_actual_change
    check (previous_mode <> new_mode)
);

create index shop_business_mode_changes_shop_changed_at_idx
  on public.shop_business_mode_changes (shop_id, changed_at desc);

alter table public.shop_business_mode_changes enable row level security;

create policy shop_business_mode_change_owner_read
  on public.shop_business_mode_changes
  for select to authenticated
  using (shop_private.is_owner(shop_id));

revoke all on public.shop_business_mode_changes
  from public, anon, authenticated, service_role;
grant select on public.shop_business_mode_changes to authenticated;
grant select on public.shop_business_mode_changes to service_role;

-- The three-argument function is the single bootstrap implementation. The
-- existing two-argument signature remains only as a compatibility adapter and
-- delegates to this body with mixed; current clients pass an explicit mode.
create function shop_private.create_owner_shop(
  p_shop_name text,
  p_plan_slug text,
  p_business_mode public.business_mode
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_display_name text;
  v_portal_id uuid;
  v_profile_id uuid;
  v_profile_status text;
  v_existing_shop_id uuid;
  v_shop_id uuid;
  v_plan_id uuid;
  v_trial_days integer;
  v_started_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_business_mode is null then
    raise exception 'INVALID_BUSINESS_MODE' using errcode = '22023';
  end if;
  if p_shop_name is null or length(btrim(p_shop_name)) < 2
     or length(btrim(p_shop_name)) > 120 then
    raise exception 'INVALID_SHOP_NAME' using errcode = '22023';
  end if;

  select u.email, nullif(btrim(u.raw_user_meta_data ->> 'display_name'), '')
    into v_email, v_display_name
  from auth.users u
  where u.id = v_user_id
  for update;
  if not found then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select p.id into v_portal_id
  from public.portals p
  where p.key = 'shop-crm' and p.is_active;
  if v_portal_id is null then
    raise exception 'PORTAL_UNAVAILABLE';
  end if;

  select p.id, p.status::text into v_profile_id, v_profile_status
  from public.profiles p
  where p.user_id = v_user_id and p.portal_id = v_portal_id;
  if v_profile_id is null then
    insert into public.profiles (
      user_id, portal_id, display_name, email_snapshot
    ) values (
      v_user_id, v_portal_id, v_display_name, v_email
    ) returning id into v_profile_id;
  elsif v_profile_status <> 'active' then
    raise exception 'PROFILE_INACTIVE';
  end if;

  -- Retries return the original shop without changing mode, plan or trial.
  select m.shop_id into v_existing_shop_id
  from public.shop_memberships m
  where m.profile_id = v_profile_id and m.role = 'owner'
  order by m.created_at, m.id
  limit 1;
  if v_existing_shop_id is not null then
    return v_existing_shop_id;
  end if;
  if exists (
    select 1 from public.subscriptions s where s.profile_id = v_profile_id
  ) then
    raise exception 'SUBSCRIPTION_REQUIRES_REVIEW';
  end if;

  select p.id, p.trial_days into v_plan_id, v_trial_days
  from public.plans p
  where p.portal_id = v_portal_id
    and p.slug = p_plan_slug
    and p.is_active and p.is_public and not p.is_coming_soon
    and p.trial_days > 0;
  if v_plan_id is null then
    raise exception 'PLAN_UNAVAILABLE' using errcode = '22023';
  end if;

  insert into public.shops (portal_id, name, business_mode)
  values (v_portal_id, btrim(p_shop_name), p_business_mode)
  returning id into v_shop_id;

  insert into public.shop_memberships (shop_id, profile_id, role)
  values (v_shop_id, v_profile_id, 'owner');

  insert into public.subscriptions (
    profile_id, plan_id, status, trial_start_at, trial_end_at,
    current_period_start, current_period_end, trial_consumed
  ) values (
    v_profile_id, v_plan_id, 'trialing', v_started_at,
    v_started_at + v_trial_days * interval '1 day',
    v_started_at, v_started_at + v_trial_days * interval '1 day', true
  );

  return v_shop_id;
end;
$$;

revoke all on function shop_private.create_owner_shop(
  text, text, public.business_mode
) from public, anon, authenticated;
grant execute on function shop_private.create_owner_shop(
  text, text, public.business_mode
) to authenticated, service_role;

create or replace function shop_private.create_owner_shop(
  p_shop_name text,
  p_plan_slug text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select shop_private.create_owner_shop(
    p_shop_name, p_plan_slug, 'mixed'::public.business_mode
  );
$$;

revoke all on function shop_private.create_owner_shop(text, text)
  from public, anon, authenticated;
grant execute on function shop_private.create_owner_shop(text, text)
  to authenticated, service_role;

create function public.create_owner_shop(
  p_shop_name text,
  p_plan_slug text,
  p_business_mode public.business_mode
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select shop_private.create_owner_shop(
    p_shop_name, p_plan_slug, p_business_mode
  );
$$;

revoke all on function public.create_owner_shop(
  text, text, public.business_mode
) from public, anon, authenticated;
grant execute on function public.create_owner_shop(
  text, text, public.business_mode
) to authenticated, service_role;

create function shop_private.set_shop_business_mode(
  p_shop_id uuid,
  p_business_mode public.business_mode
)
returns public.business_mode
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_actor_profile_id uuid;
  v_previous_mode public.business_mode;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_shop_id is null or p_business_mode is null then
    raise exception 'INVALID_BUSINESS_MODE' using errcode = '22023';
  end if;

  select s.business_mode, m.profile_id
    into v_previous_mode, v_actor_profile_id
  from public.shops s
  join public.shop_memberships m
    on m.shop_id = s.id
   and m.role = 'owner'
   and m.status = 'active'::public.shop_membership_status
  join public.profiles p
    on p.id = m.profile_id
   and p.portal_id = s.portal_id
   and p.status = 'active'::public.profile_status
  where s.id = p_shop_id
    and s.status = 'active'::public.shop_status
    and p.user_id = v_user_id
  for update of s;

  if not found then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if v_previous_mode = p_business_mode then
    return v_previous_mode;
  end if;

  update public.shops
  set business_mode = p_business_mode,
      updated_at = now()
  where id = p_shop_id;

  insert into public.shop_business_mode_changes (
    shop_id, previous_mode, new_mode, changed_by_profile_id
  ) values (
    p_shop_id, v_previous_mode, p_business_mode, v_actor_profile_id
  );

  return p_business_mode;
end;
$$;

revoke all on function shop_private.set_shop_business_mode(
  uuid, public.business_mode
) from public, anon, authenticated;
grant execute on function shop_private.set_shop_business_mode(
  uuid, public.business_mode
) to authenticated, service_role;

create function public.set_shop_business_mode(
  p_shop_id uuid,
  p_business_mode public.business_mode
)
returns public.business_mode
language sql
security invoker
set search_path = ''
as $$
  select shop_private.set_shop_business_mode(p_shop_id, p_business_mode);
$$;

revoke all on function public.set_shop_business_mode(
  uuid, public.business_mode
) from public, anon, authenticated;
grant execute on function public.set_shop_business_mode(
  uuid, public.business_mode
) to authenticated, service_role;

notify pgrst, 'reload schema';
