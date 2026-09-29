-- SS-PLAN-CATALOG-001: canonical catalog, legacy grandfathering, resource
-- quotas, downgrade safety, and immutable billing commercial terms.

do $$
declare
  v_catalog jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'slug', plan.slug,
    'name', plan.name,
    'price', plan.price_amount,
    'currency', plan.currency,
    'interval', plan.billing_interval,
    'trialDays', plan.trial_days,
    'limits', plan.resource_limits,
    'active', plan.is_active,
    'public', plan.is_public,
    'purchasable', plan.is_purchasable,
    'inventory', plan.features -> 'inventory'
  ) order by plan.sort_order) into v_catalog
  from public.plans plan
  join public.portals portal on portal.id = plan.portal_id
  where portal.key = 'shop-crm' and plan.slug in ('solo', 'team', 'multi');

  if v_catalog is distinct from '[
    {"slug":"solo","name":"Solo","price":349,"currency":"EGP","interval":"monthly","trialDays":14,"limits":{"active_locations":1,"active_members":2,"active_products":250,"active_services":50},"active":true,"public":true,"purchasable":true,"inventory":true},
    {"slug":"team","name":"Team","price":699,"currency":"EGP","interval":"monthly","trialDays":14,"limits":{"active_locations":1,"active_members":8,"active_products":1000,"active_services":250},"active":true,"public":true,"purchasable":true,"inventory":true},
    {"slug":"multi","name":"Multi","price":1099,"currency":"EGP","interval":"monthly","trialDays":14,"limits":{"active_locations":3,"active_members":25,"active_products":5000,"active_services":1000},"active":true,"public":true,"purchasable":true,"inventory":true}
  ]'::jsonb then
    raise exception 'canonical plan catalog differs from SUB-D08: %', v_catalog;
  end if;

  if exists (
    select 1 from public.plans plan join public.portals portal on portal.id = plan.portal_id
    where portal.key = 'shop-crm' and plan.slug in ('basic', 'pro')
      and (plan.is_active or plan.is_public or plan.is_purchasable)
  ) or (select count(*) from public.plan_catalog_legacy_mappings) <> 2 then
    raise exception 'legacy Basic/Pro rows were not grandfathered deterministically';
  end if;
  if exists (
    select 1 from public.plans plan
    where plan.slug in ('solo', 'team', 'multi')
      and plan.resource_limits ?| array['customers', 'sales', 'appointments']
  ) then raise exception 'an uncapped resource was added to the initial catalog'; end if;
end;
$$;

set local role anon;
do $$
begin
  if (select count(*) from public.plans) <> 3
    or exists (select 1 from public.plans where not is_purchasable)
    or (select count(*) from public.plan_catalog_terms where is_purchasable) <> 3 then
    raise exception 'anonymous catalog exposed a legacy or non-purchasable plan';
  end if;
end;
$$;
reset role;

create temporary table shop_plan_catalog_fixture as
select gen_random_uuid() legacy_active_user,
  gen_random_uuid() legacy_trial_user,
  gen_random_uuid() solo_user,
  gen_random_uuid() multi_user,
  gen_random_uuid() extra_user_a,
  gen_random_uuid() extra_user_b;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@ss-plan-catalog.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select legacy_active_user id from shop_plan_catalog_fixture
  union all select legacy_trial_user from shop_plan_catalog_fixture
  union all select solo_user from shop_plan_catalog_fixture
  union all select multi_user from shop_plan_catalog_fixture
  union all select extra_user_a from shop_plan_catalog_fixture
  union all select extra_user_b from shop_plan_catalog_fixture
) fixture_users;

-- Construct representative pre-migration Basic/Pro subscriptions. They stay
-- on their original plan IDs and retain dates/status when reconciliation reruns.
do $$
declare
  v_portal uuid := (select id from public.portals where key = 'shop-crm');
  v_basic uuid := (select id from public.plans where slug = 'basic' and portal_id = v_portal);
  v_pro uuid := (select id from public.plans where slug = 'pro' and portal_id = v_portal);
  v_user uuid;
  v_profile uuid;
  v_shop uuid;
  v_before jsonb;
  v_after jsonb;
  v_counts bigint[];
begin
  for v_user in
    select legacy_active_user from shop_plan_catalog_fixture
    union all select legacy_trial_user from shop_plan_catalog_fixture
  loop
    insert into public.profiles (user_id, portal_id, display_name)
    values (v_user, v_portal, 'Legacy fixture') returning id into v_profile;
    insert into public.shops (portal_id, name, business_mode)
    values (v_portal, 'Legacy ' || v_user::text, 'mixed') returning id into v_shop;
    insert into public.shop_memberships (shop_id, profile_id, role)
    values (v_shop, v_profile, 'owner');
    insert into public.subscriptions (
      profile_id, plan_id, status, trial_start_at, trial_end_at,
      current_period_start, current_period_end, trial_consumed
    ) values (
      v_profile,
      case when v_user = (select legacy_active_user from shop_plan_catalog_fixture)
        then v_basic else v_pro end,
      case when v_user = (select legacy_active_user from shop_plan_catalog_fixture)
        then 'active' else 'trialing' end,
      now() - interval '2 days', now() + interval '12 days',
      now() - interval '2 days', now() + interval '12 days', true
    );
  end loop;

  select jsonb_agg(to_jsonb(subscription) order by subscription.profile_id)
  into v_before from public.subscriptions subscription
  where subscription.profile_id in (
    select profile.id from public.profiles profile
    join shop_plan_catalog_fixture fixture
      on profile.user_id in (fixture.legacy_active_user, fixture.legacy_trial_user)
  );
  select array[(select count(*) from public.plans),
    (select count(*) from public.plan_catalog_terms),
    (select count(*) from public.plan_catalog_legacy_mappings)] into v_counts;

  perform shop_private.reconcile_plan_catalog();
  perform shop_private.reconcile_plan_catalog();

  select jsonb_agg(to_jsonb(subscription) order by subscription.profile_id)
  into v_after from public.subscriptions subscription
  where subscription.profile_id in (
    select profile.id from public.profiles profile
    join shop_plan_catalog_fixture fixture
      on profile.user_id in (fixture.legacy_active_user, fixture.legacy_trial_user)
  );
  if v_after is distinct from v_before then
    raise exception 'legacy active/trial subscriptions were rewritten';
  end if;
  if v_counts is distinct from array[(select count(*) from public.plans),
      (select count(*) from public.plan_catalog_terms),
      (select count(*) from public.plan_catalog_legacy_mappings)] then
    raise exception 'catalog reconciliation was not idempotent';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', solo_user::text, true)
from shop_plan_catalog_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_subscription jsonb;
begin
  v_shop := public.create_owner_shop('Solo fixture', 'solo', 'mixed');

  -- Authenticated callers must inspect subscription state through the
  -- supported security-definer billing read contract, not by reading the
  -- subscriptions table directly.
  v_subscription := public.shop_billing_read(v_shop) -> 'subscription';

  if (v_subscription ->> 'trialEndAt')::timestamptz
       <> (v_subscription ->> 'trialStartAt')::timestamptz + interval '14 days'
    or (select business_mode from public.shops where id = v_shop) <> 'mixed' then
    raise exception 'canonical trial or business-mode independence regressed';
  end if;
  begin
    perform public.save_shop_location(v_shop, null, 'Over limit', null, null, null);
    raise exception 'Solo accepted a second active location';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_locations:%' then raise; end if;
  end;
  perform set_config('ss_plan.solo_shop', v_shop::text, true);
end;
$$;
reset role;

-- Member limits include the owner. The second active member fits Solo; the
-- third is rejected atomically without archiving either existing member.
do $$
declare
  v_shop uuid := current_setting('ss_plan.solo_shop')::uuid;
  v_portal uuid := (select portal_id from public.shops where id = v_shop);
  v_profile uuid;
begin
  insert into public.profiles (user_id, portal_id, display_name)
  select extra_user_a, v_portal, 'Second member' from shop_plan_catalog_fixture
  returning id into v_profile;
  insert into public.shop_memberships (shop_id, profile_id, role)
  values (v_shop, v_profile, 'employee');

  insert into public.profiles (user_id, portal_id, display_name)
  select extra_user_b, v_portal, 'Third member' from shop_plan_catalog_fixture
  returning id into v_profile;
  begin
    insert into public.shop_memberships (shop_id, profile_id, role)
    values (v_shop, v_profile, 'employee');
    raise exception 'Solo accepted a third active member';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_members:%' then raise; end if;
  end;
  if (select count(*) from public.shop_memberships
      where shop_id = v_shop and status = 'active') <> 2 then
    raise exception 'member quota failure changed existing membership data';
  end if;
end;
$$;

-- A downgrade is blocked while usage exceeds the target, with no data loss.
select set_config('request.jwt.claim.sub', multi_user::text, true)
from shop_plan_catalog_fixture;
set local role authenticated;
do $$
declare v_shop uuid;
begin
  v_shop := public.create_owner_shop('Multi fixture', 'multi', 'service');
  perform public.save_shop_location(v_shop, null, 'Branch two', null, null, null);
  perform set_config('ss_plan.multi_shop', v_shop::text, true);
end;
$$;
reset role;
do $$
declare
  v_shop uuid := current_setting('ss_plan.multi_shop')::uuid;
  v_subscription uuid;
  v_solo uuid := (select id from public.plans where slug = 'solo');
begin
  select subscription.id into v_subscription
  from public.subscriptions subscription
  join public.shop_memberships membership on membership.profile_id = subscription.profile_id
  where membership.shop_id = v_shop and membership.role = 'owner';
  begin
    update public.subscriptions set plan_id = v_solo where id = v_subscription;
    raise exception 'over-limit downgrade succeeded';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_EXCEEDED:active_locations:%' then raise; end if;
  end;
  if (select count(*) from public.shop_locations
      where shop_id = v_shop and status = 'active') <> 2
    or (select plan.slug from public.subscriptions subscription
      join public.plans plan on plan.id = subscription.plan_id
      where subscription.id = v_subscription) <> 'multi' then
    raise exception 'blocked downgrade changed plan or location data';
  end if;
end;
$$;

-- Billing notices and approved periods retain their submitted commercial
-- terms even if the mutable display row changes later.
do $$
declare
  v_shop uuid := current_setting('ss_plan.solo_shop')::uuid;
  v_profile uuid;
  v_plan uuid;
  v_submission uuid;
  v_snapshot jsonb;
begin
  select membership.profile_id, subscription.plan_id into v_profile, v_plan
  from public.shop_memberships membership
  join public.subscriptions subscription on subscription.profile_id = membership.profile_id
  where membership.shop_id = v_shop and membership.role = 'owner';
  insert into public.shop_billing_submissions (
    request_id, shop_id, submitted_by_profile_id, plan_id, kind, status,
    amount, expected_amount, paid_amount, currency, reference,
    transfer_date, transfer_reference
  ) values (
    gen_random_uuid(), v_shop, v_profile, v_plan, 'activation', 'submitted',
    349, 349, 349, 'EGP', 'snapshot-ref', current_date, 'snapshot-ref'
  ) returning id into v_submission;
  select jsonb_build_object('slug', plan_slug_snapshot, 'name', plan_name_snapshot,
    'amount', expected_amount, 'limits', resource_limits_snapshot)
  into v_snapshot from public.shop_billing_submissions where id = v_submission;

  update public.subscriptions set status = 'active', current_period_start = now(),
    current_period_end = now() + interval '30 days' where profile_id = v_profile;
  update public.shop_billing_submissions set status = 'approved',
    received_amount = 349, received_reference = 'received-ref',
    received_date = current_date, activation_days = 30,
    approved_subscription_end = now() + interval '30 days', reviewed_at = now()
  where id = v_submission;
  update public.plans set name = 'Changed display', price_amount = 999
  where id = v_plan;

  if (select jsonb_build_object('slug', plan_slug_snapshot, 'name', plan_name_snapshot,
      'amount', expected_amount, 'limits', resource_limits_snapshot)
      from public.shop_billing_submissions where id = v_submission) is distinct from v_snapshot
    or not exists (select 1 from public.subscription_commercial_periods period
      where period.billing_submission_id = v_submission and period.plan_name = 'Solo'
        and period.price_amount = 349) then
    raise exception 'submitted notice or approved paid period was rewritten';
  end if;
end;
$$;
