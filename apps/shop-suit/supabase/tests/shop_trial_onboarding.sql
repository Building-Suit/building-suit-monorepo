-- HOT-09: plan-neutral seven-day signup, preserved live deadlines, and
-- operation-mode defaults.
-- The database runner wraps every synthetic owner and shop in a rollback.

create temporary table shop_trial_onboarding_fixture as
select gen_random_uuid() legacy_owner_id,
  gen_random_uuid() product_owner_id,
  gen_random_uuid() service_owner_id,
  gen_random_uuid() mixed_owner_id;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@ss-hot-onboard.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{"display_name":"Trial owner"}'::jsonb,
  now(), now()
from (
  select legacy_owner_id id from shop_trial_onboarding_fixture
  union all select product_owner_id from shop_trial_onboarding_fixture
  union all select service_owner_id from shop_trial_onboarding_fixture
  union all select mixed_owner_id from shop_trial_onboarding_fixture
) fixture;

do $$
declare v_trial public.plans;
begin
  select plan.* into v_trial from public.plans plan
  join public.portals portal on portal.id = plan.portal_id
  where portal.key = 'shop-crm' and plan.slug = 'full-product-trial';
  if v_trial.id is null or v_trial.trial_days <> 7 or v_trial.price_amount <> 0
    or not v_trial.is_active or v_trial.is_public or v_trial.is_purchasable
    or v_trial.is_coming_soon or v_trial.features <> '{"inventory":true}'::jsonb
    or v_trial.resource_limits <> '{
      "active_locations":null,"active_members":null,
      "active_products":null,"active_services":null
    }'::jsonb then
    raise exception 'internal full-product trial contract is invalid';
  end if;
  if not exists (
      select 1 from public.plan_catalog_terms terms
      where terms.plan_id = v_trial.id and terms.version = 1
        and terms.trial_days = 14
    ) or not exists (
      select 1 from public.plan_catalog_terms terms
      where terms.plan_id = v_trial.id and terms.version = v_trial.catalog_version
        and terms.trial_days = 7
    ) then
    raise exception 'historical and current trial terms were not both preserved';
  end if;
  if has_function_privilege('anon',
      'public.create_owner_shop(text,public.business_mode)', 'EXECUTE')
    or not has_function_privilege('authenticated',
      'public.create_owner_shop(text,public.business_mode)', 'EXECUTE')
    or not has_function_privilege('authenticated',
      'public.create_owner_shop(text,public.business_mode,text,text,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'shop_private.create_owner_shop(text,public.business_mode)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'shop_private.create_owner_shop(text,public.business_mode,text,text,text,text)', 'EXECUTE') then
    raise exception 'plan-neutral onboarding grant boundary is invalid';
  end if;
end;
$$;

-- Preserve a representative existing plan-specific trial exactly. The legacy
-- overload remains available to old clients while current onboarding uses the
-- plan-neutral overload.
select set_config('request.jwt.claim.sub', legacy_owner_id::text, true)
from shop_trial_onboarding_fixture;
set local role authenticated;
select public.create_owner_shop(
  'Existing paid-plan trial', 'team', 'mixed'::public.business_mode
);
reset role;

-- Model a live deadline granted under the previous policy. Applying and using
-- the new policy must never rewrite this customer-specific date.
update public.subscriptions subscription
set trial_end_at = subscription.trial_start_at + interval '14 days',
  current_period_end = subscription.trial_start_at + interval '14 days'
from public.profiles profile
join shop_trial_onboarding_fixture fixture
  on fixture.legacy_owner_id = profile.user_id
where subscription.profile_id = profile.id;

create temporary table existing_subscription_snapshot as
select subscription.id, to_jsonb(subscription) snapshot
from public.subscriptions subscription
join public.profiles profile on profile.id = subscription.profile_id
join shop_trial_onboarding_fixture fixture
  on fixture.legacy_owner_id = profile.user_id;

select set_config('request.jwt.claim.sub', product_owner_id::text, true)
from shop_trial_onboarding_fixture;
set local role authenticated;
select public.create_owner_shop(
  'Product operation trial', 'product'::public.business_mode,
  'Product main', 'PROD', 'Cairo', '+20101'
);
reset role;

select set_config('request.jwt.claim.sub', service_owner_id::text, true)
from shop_trial_onboarding_fixture;
set local role authenticated;
select public.create_owner_shop(
  'Service operation trial', 'service'::public.business_mode,
  'Service main', null, null, null
);
reset role;

select set_config('request.jwt.claim.sub', mixed_owner_id::text, true)
from shop_trial_onboarding_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid;
  v_retry uuid;
  v_product uuid;
begin
  v_shop := public.create_owner_shop(
    'Mixed operation trial', 'mixed'::public.business_mode,
    'Mixed main', 'MIX', 'Giza', '+20102'
  );
  v_retry := public.create_owner_shop(
    'Retry must not rewrite mode', 'service'::public.business_mode,
    'Retry must not rewrite location', 'RETRY', null, null
  );
  if v_retry <> v_shop then raise exception 'trial retry created a second shop'; end if;

  -- Four locations exceed the largest paid plan's current limit of three.
  -- Product, inventory, and service commands prove both workflow families are
  -- available during the plan-neutral trial.
  perform public.save_shop_location(v_shop, null, 'Branch two', null, null, null);
  perform public.save_shop_location(v_shop, null, 'Branch three', null, null, null);
  perform public.save_shop_location(v_shop, null, 'Branch four', null, null, null);
  v_product := public.save_product(v_shop, null, 'Trial product', 'TRIAL-1', null, 10);
  perform public.adjust_stock(
    gen_random_uuid(), v_shop, v_product, 2, 5, 'Trial inventory'
  );
  perform public.save_service(
    v_shop, null, 'Trial service', null, 20, 'amount', 0
  );
  perform set_config('ss_hot_onboard.mixed_shop', v_shop::text, true);
end;
$$;
reset role;

do $$
declare
  v_mode record;
  v_subscription record;
  v_entitlement record;
  v_mixed_shop uuid := current_setting('ss_hot_onboard.mixed_shop')::uuid;
begin
  for v_mode in
    select fixture_user.user_id, fixture_user.expected_mode, fixture_user.expected_location
    from (values
      ((select product_owner_id from shop_trial_onboarding_fixture), 'product'::public.business_mode, 'Product main'::text),
      ((select service_owner_id from shop_trial_onboarding_fixture), 'service'::public.business_mode, 'Service main'::text),
      ((select mixed_owner_id from shop_trial_onboarding_fixture), 'mixed'::public.business_mode, 'Mixed main'::text)
    ) fixture_user(user_id, expected_mode, expected_location)
  loop
    select shop.business_mode, subscription.*, plan.slug
      into v_subscription
    from public.profiles profile
    join public.shop_memberships membership
      on membership.profile_id = profile.id and membership.role = 'owner'
    join public.shops shop on shop.id = membership.shop_id
    join public.subscriptions subscription on subscription.profile_id = profile.id
    join public.plans plan on plan.id = subscription.plan_id
    where profile.user_id = v_mode.user_id;
    if v_subscription.business_mode <> v_mode.expected_mode
      or v_subscription.slug <> 'full-product-trial'
      or v_subscription.status <> 'trialing'
      or v_subscription.trial_end_at
        <> v_subscription.trial_start_at + interval '7 days'
      or v_subscription.current_period_end <> v_subscription.trial_end_at
      or not v_subscription.trial_consumed
      or not exists (
        select 1 from public.profiles profile
        join public.shop_memberships membership on membership.profile_id = profile.id
        join public.shop_locations location on location.shop_id = membership.shop_id
          and location.is_default and location.status = 'active'
        where profile.user_id = v_mode.user_id
          and location.name = v_mode.expected_location
      ) then
      raise exception 'onboarding did not atomically persist mode and exact trial: %',
        v_mode.expected_mode;
    end if;
  end loop;

  select * into v_entitlement
  from shop_private.resolve_plan_entitlement(v_mixed_shop);
  if not v_entitlement.writes_allowed or v_entitlement.access_state <> 'trialing'
    or v_entitlement.resource_limits <> '{
      "active_locations":null,"active_members":null,
      "active_products":null,"active_services":null
    }'::jsonb
    or (select count(*) from public.shop_locations
      where shop_id = v_mixed_shop and status = 'active') <> 4 then
    raise exception 'trial is restricted by a paid-plan gate';
  end if;

  if exists (
    select 1 from existing_subscription_snapshot before
    join public.subscriptions current_subscription
      on current_subscription.id = before.id
    where to_jsonb(current_subscription) is distinct from before.snapshot
  ) then raise exception 'existing subscription was rewritten'; end if;
  if not exists (
    select 1 from existing_subscription_snapshot before
    where (before.snapshot ->> 'trial_end_at')::timestamptz
      = (before.snapshot ->> 'trial_start_at')::timestamptz + interval '14 days'
  ) then raise exception 'pre-existing 14-day deadline fixture was not preserved'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', mixed_owner_id::text, true)
from shop_trial_onboarding_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('ss_hot_onboard.mixed_shop')::uuid;
  v_billing jsonb := public.shop_billing_read(v_shop);
begin
  if v_billing #>> '{subscription,planSlug}' <> 'full-product-trial'
    or jsonb_array_length(v_billing -> 'availablePlans') <> 4
    or not (v_billing -> 'availablePlans' @> '[
      {"planSlug":"solo"},{"planSlug":"team"},{"planSlug":"multi"}
    ]'::jsonb)
    or exists (
      select 1 from jsonb_array_elements(v_billing -> 'availablePlans') plan
      where plan ->> 'planSlug' = 'full-product-trial'
        and (plan ->> 'effectivePriceAmount')::numeric <> 0
    ) then
    raise exception 'trial-to-paid billing lifecycle is unavailable';
  end if;
end;
$$;
reset role;

-- Expiry keeps the established read-only lifecycle and blocks later writes.
update public.subscriptions subscription
set status = 'expired', trial_end_at = now() - interval '1 second',
  current_period_end = now() - interval '1 second', locked_at = now()
from public.shop_memberships membership
where membership.shop_id = current_setting('ss_hot_onboard.mixed_shop')::uuid
  and membership.role = 'owner'
  and subscription.profile_id = membership.profile_id;

select set_config('request.jwt.claim.sub', mixed_owner_id::text, true)
from shop_trial_onboarding_fixture;
set local role authenticated;
do $$
begin
  if public.shop_billing_read(current_setting('ss_hot_onboard.mixed_shop')::uuid)
      #>> '{subscription,accessState}' <> 'read_only' then
    raise exception 'expired plan-neutral trial did not become read-only';
  end if;
  begin
    perform public.save_product(
      current_setting('ss_hot_onboard.mixed_shop')::uuid,
      null, 'Expired write', null, null, 10
    );
    raise exception 'expired plan-neutral trial accepted a write';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_SUBSCRIPTION_INACTIVE' then raise; end if;
  end;
end;
$$;
reset role;

rollback;
