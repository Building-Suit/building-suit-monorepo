-- A single, authenticated first-shop transaction. The privileged body stays
-- outside exposed schemas; the Data API sees only an invoker wrapper.
create function shop_private.create_owner_shop(
  p_shop_name text,
  p_plan_slug text
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
  if p_shop_name is null or length(btrim(p_shop_name)) < 2
     or length(btrim(p_shop_name)) > 120 then
    raise exception 'INVALID_SHOP_NAME' using errcode = '22023';
  end if;

  -- Serialize retries from this identity, including concurrent browser tabs.
  select u.email, nullif(btrim(u.raw_user_meta_data ->> 'display_name'), '')
    into v_email, v_display_name
  from auth.users u
  where u.id = v_user_id
  for update;
  if not found then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select p.id into v_portal_id
  from shop_crm.portals p
  where p.key = 'shop-crm' and p.is_active;
  if v_portal_id is null then
    raise exception 'PORTAL_UNAVAILABLE';
  end if;

  select p.id, p.status::text into v_profile_id, v_profile_status
  from shop_crm.profiles p
  where p.user_id = v_user_id and p.portal_id = v_portal_id;
  if v_profile_id is null then
    insert into shop_crm.profiles (
      user_id, portal_id, display_name, email_snapshot
    ) values (
      v_user_id, v_portal_id, v_display_name, v_email
    ) returning id into v_profile_id;
  elsif v_profile_status <> 'active' then
    raise exception 'PROFILE_INACTIVE';
  end if;

  -- A repeated submit returns the first shop without extending its trial or
  -- changing its plan. This also prevents a second self-service shop for now.
  select m.shop_id into v_existing_shop_id
  from shop_crm.shop_memberships m
  where m.profile_id = v_profile_id and m.role = 'owner'
  order by m.created_at, m.id
  limit 1;
  if v_existing_shop_id is not null then
    return v_existing_shop_id;
  end if;
  if exists (
    select 1 from shop_crm.subscriptions s where s.profile_id = v_profile_id
  ) then
    raise exception 'SUBSCRIPTION_REQUIRES_REVIEW';
  end if;

  select p.id, p.trial_days into v_plan_id, v_trial_days
  from shop_crm.plans p
  where p.portal_id = v_portal_id
    and p.slug = p_plan_slug
    and p.is_active and p.is_public and not p.is_coming_soon
    and p.trial_days > 0;
  if v_plan_id is null then
    raise exception 'PLAN_UNAVAILABLE' using errcode = '22023';
  end if;

  insert into shop_crm.shops (portal_id, name)
  values (v_portal_id, btrim(p_shop_name))
  returning id into v_shop_id;

  insert into shop_crm.shop_memberships (shop_id, profile_id, role)
  values (v_shop_id, v_profile_id, 'owner');

  insert into shop_crm.subscriptions (
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

revoke all on function shop_private.create_owner_shop(text, text)
  from public, anon, authenticated;
grant usage on schema shop_private to authenticated;
grant execute on function shop_private.create_owner_shop(text, text)
  to authenticated;

create function shop_crm.create_owner_shop(
  p_shop_name text,
  p_plan_slug text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select shop_private.create_owner_shop(p_shop_name, p_plan_slug);
$$;

revoke all on function shop_crm.create_owner_shop(text, text)
  from public, anon, authenticated;
grant execute on function shop_crm.create_owner_shop(text, text)
  to authenticated;

notify pgrst, 'reload schema';
