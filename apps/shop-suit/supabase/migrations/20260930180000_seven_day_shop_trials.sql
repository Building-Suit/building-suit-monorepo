-- SS-HOT-TRIAL-7D-001 / HOT-09: new Shop subscriptions receive one
-- plan-neutral, full-product seven-day trial. Existing subscription deadlines
-- and immutable commercial snapshots remain untouched.

alter table public.plans alter column trial_days set default 7;

alter table public.plan_catalog_terms
  drop constraint plan_catalog_terms_trial_days_check,
  add constraint plan_catalog_terms_trial_days_check
    check (trial_days in (7, 14));

alter table public.plans drop constraint plans_full_product_trial_internal;

create or replace function shop_private.enforce_shop_trial_policy()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.portals portal
    where portal.id = new.portal_id and portal.key = 'shop-crm'
  ) and new.trial_days <> 7 then
    raise exception 'SHOP_TRIAL_DAYS_MUST_BE_7' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Existing catalog rows are immutable. New terms inherit the current Shop
-- policy even through the older operator command, whose public payload never
-- accepted a trial-duration field.
create function shop_private.apply_shop_trial_to_catalog_terms()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_trial_days integer;
begin
  select plan.trial_days into v_trial_days
  from public.plans plan
  join public.portals portal on portal.id = plan.portal_id
  where plan.id = new.plan_id and portal.key = 'shop-crm';
  if found then new.trial_days := v_trial_days; end if;
  return new;
end;
$$;

create trigger plan_catalog_terms_shop_trial_policy
before insert on public.plan_catalog_terms
for each row execute function shop_private.apply_shop_trial_to_catalog_terms();

do $$
declare
  v_effective_at timestamptz := clock_timestamp();
  v_plan public.plans;
  v_version integer;
begin
  for v_plan in
    select plan.* from public.plans plan
    join public.portals portal on portal.id = plan.portal_id
    where portal.key = 'shop-crm'
    order by plan.id
    for update of plan
  loop
    select coalesce(max(terms.version), 0) + 1 into v_version
    from public.plan_catalog_terms terms where terms.plan_id = v_plan.id;

    update public.plans plan set
      trial_days = 7,
      catalog_version = v_version,
      updated_at = now()
    where plan.id = v_plan.id
    returning * into v_plan;

    insert into public.plan_catalog_terms (
      plan_id, version, display_name, billing_interval, currency, price_amount,
      trial_days, resource_limits, is_public, is_purchasable, effective_from
    ) values (
      v_plan.id, v_version, v_plan.name, v_plan.billing_interval,
      v_plan.currency, v_plan.price_amount, 7, v_plan.resource_limits,
      v_plan.is_public, v_plan.is_purchasable, v_effective_at
    );
  end loop;
end;
$$;

alter table public.plans add constraint plans_full_product_trial_internal
  check (slug <> 'full-product-trial' or (
    trial_days = 7 and price_amount = 0 and is_active
    and not is_public and not is_purchasable and not is_coming_soon
  ));

-- Keep the catalog reconciler safe and idempotent after the policy transition.
-- Version-one 14-day terms remain immutable; current version-two terms stay
-- selected and missing plans are initialized directly on the seven-day policy.
create or replace function shop_private.reconcile_plan_catalog()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_portal_id uuid;
begin
  select portal.id into v_portal_id
  from public.portals portal where portal.key = 'shop-crm';
  if v_portal_id is null then return; end if;

  update public.plans plan set resource_limits = jsonb_build_object(
    'active_locations', null,
    'active_members', null,
    'active_products', case when plan.features ? 'max_products'
      then to_jsonb((plan.features ->> 'max_products')::integer) else 'null'::jsonb end,
    'active_services', case when plan.features ? 'max_services'
      then to_jsonb((plan.features ->> 'max_services')::integer) else 'null'::jsonb end
  ) where plan.portal_id = v_portal_id
    and plan.resource_limits = jsonb_build_object(
      'active_locations', null, 'active_members', null,
      'active_products', null, 'active_services', null
    );

  insert into public.plan_catalog_terms (
    plan_id, version, display_name, billing_interval, currency, price_amount,
    trial_days, resource_limits, is_public, is_purchasable
  )
  select plan.id, plan.catalog_version, plan.name, plan.billing_interval,
    plan.currency, plan.price_amount, plan.trial_days, plan.resource_limits,
    plan.is_public, plan.is_purchasable
  from public.plans plan where plan.portal_id = v_portal_id
  on conflict (plan_id, version) do nothing;

  update public.plans plan set
    is_active = false, is_public = false, is_purchasable = false,
    is_coming_soon = false,
    updated_at = now()
  where plan.portal_id = v_portal_id and plan.slug in ('basic', 'pro')
    and (plan.is_active or plan.is_public or plan.is_purchasable or plan.is_coming_soon);

  insert into public.plans (
    portal_id, name, slug, price_amount, currency, billing_interval,
    trial_days, features, resource_limits, sort_order, is_active, is_public,
    is_purchasable, is_coming_soon, catalog_version
  ) values
    (v_portal_id, 'Solo', 'solo', 349, 'EGP', 'monthly', 7,
      '{"inventory":true,"max_locations":1,"max_members":2,"max_products":250,"max_services":50}'::jsonb,
      '{"active_locations":1,"active_members":2,"active_products":250,"active_services":50}'::jsonb,
      10, true, true, true, false, 1),
    (v_portal_id, 'Team', 'team', 699, 'EGP', 'monthly', 7,
      '{"inventory":true,"max_locations":1,"max_members":8,"max_products":1000,"max_services":250}'::jsonb,
      '{"active_locations":1,"active_members":8,"active_products":1000,"active_services":250}'::jsonb,
      20, true, true, true, false, 1),
    (v_portal_id, 'Multi', 'multi', 1099, 'EGP', 'monthly', 7,
      '{"inventory":true,"max_locations":3,"max_members":25,"max_products":5000,"max_services":1000}'::jsonb,
      '{"active_locations":3,"active_members":25,"active_products":5000,"active_services":1000}'::jsonb,
      30, true, true, true, false, 1)
  on conflict (portal_id, slug) do update set
    name = excluded.name,
    price_amount = excluded.price_amount,
    currency = excluded.currency,
    billing_interval = excluded.billing_interval,
    trial_days = excluded.trial_days,
    features = excluded.features,
    resource_limits = excluded.resource_limits,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    is_public = excluded.is_public,
    is_purchasable = excluded.is_purchasable,
    is_coming_soon = excluded.is_coming_soon,
    updated_at = now();

  insert into public.plan_catalog_terms (
    plan_id, version, display_name, billing_interval, currency, price_amount,
    trial_days, resource_limits, is_public, is_purchasable
  )
  select plan.id, plan.catalog_version, plan.name, plan.billing_interval,
    plan.currency, plan.price_amount, plan.trial_days, plan.resource_limits,
    true, true
  from public.plans plan
  where plan.portal_id = v_portal_id and plan.slug in ('solo', 'team', 'multi')
  on conflict (plan_id, version) do nothing;

  insert into public.plan_catalog_legacy_mappings (
    legacy_plan_id, successor_plan_id, strategy, subscriptions_at_migration,
    before_snapshot, after_snapshot
  )
  select legacy.id, successor.id, 'grandfather',
    (select count(*)::integer from public.subscriptions subscription
      where subscription.plan_id = legacy.id),
    jsonb_build_object(
      'planId', legacy.id, 'slug', legacy.slug, 'name', legacy.name,
      'priceAmount', legacy.price_amount, 'currency', legacy.currency,
      'billingInterval', legacy.billing_interval,
      'resourceLimits', legacy.resource_limits
    ),
    jsonb_build_object(
      'strategy', 'grandfather', 'subscriptionPlanIdsChanged', false,
      'legacyActive', false, 'legacyVisible', false, 'legacyPurchasable', false,
      'successorPlanId', successor.id, 'successorSlug', successor.slug
    )
  from public.plans legacy
  join public.plans successor on successor.portal_id = legacy.portal_id
    and successor.slug = case legacy.slug when 'basic' then 'solo' else 'team' end
  where legacy.portal_id = v_portal_id and legacy.slug in ('basic', 'pro')
  on conflict (legacy_plan_id) do nothing;
end;
$$;

create or replace function shop_private.create_owner_shop(
  p_shop_name text,
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
  v_trial_plan_id uuid;
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

  select auth_user.email,
    nullif(btrim(auth_user.raw_user_meta_data ->> 'display_name'), '')
    into v_email, v_display_name
  from auth.users auth_user
  where auth_user.id = v_user_id
  for update;
  if not found then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select portal.id into v_portal_id
  from public.portals portal
  where portal.key = 'shop-crm' and portal.is_active;
  if v_portal_id is null then raise exception 'PORTAL_UNAVAILABLE'; end if;

  select profile.id, profile.status::text into v_profile_id, v_profile_status
  from public.profiles profile
  where profile.user_id = v_user_id and profile.portal_id = v_portal_id;
  if v_profile_id is null then
    insert into public.profiles (
      user_id, portal_id, display_name, email_snapshot
    ) values (
      v_user_id, v_portal_id, v_display_name, v_email
    ) returning id into v_profile_id;
  elsif v_profile_status <> 'active' then
    raise exception 'PROFILE_INACTIVE';
  end if;

  select membership.shop_id into v_existing_shop_id
  from public.shop_memberships membership
  where membership.profile_id = v_profile_id and membership.role = 'owner'
  order by membership.created_at, membership.id
  limit 1;
  if v_existing_shop_id is not null then return v_existing_shop_id; end if;
  if exists (select 1 from public.subscriptions subscription
      where subscription.profile_id = v_profile_id) then
    raise exception 'SUBSCRIPTION_REQUIRES_REVIEW';
  end if;

  select plan.id, plan.trial_days into v_trial_plan_id, v_trial_days
  from public.plans plan
  where plan.portal_id = v_portal_id
    and plan.slug = 'full-product-trial'
    and plan.is_active and not plan.is_public and not plan.is_purchasable
    and not plan.is_coming_soon and plan.trial_days = 7;
  if v_trial_plan_id is null then raise exception 'TRIAL_UNAVAILABLE'; end if;

  insert into public.shops (portal_id, name, business_mode)
  values (v_portal_id, btrim(p_shop_name), p_business_mode)
  returning id into v_shop_id;

  insert into public.shop_memberships (shop_id, profile_id, role)
  values (v_shop_id, v_profile_id, 'owner');

  insert into public.subscriptions (
    profile_id, plan_id, status, trial_start_at, trial_end_at,
    current_period_start, current_period_end, trial_consumed
  ) values (
    v_profile_id, v_trial_plan_id, 'trialing', v_started_at,
    v_started_at + v_trial_days * interval '1 day', v_started_at,
    v_started_at + v_trial_days * interval '1 day', true
  );

  return v_shop_id;
end;
$$;

notify pgrst, 'reload schema';
