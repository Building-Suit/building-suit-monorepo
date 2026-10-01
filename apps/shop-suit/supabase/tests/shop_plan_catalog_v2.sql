-- HOT-11: exact V2 offers, immutable historical terms, explicit variant/term
-- changes, exact renewal, and manual approval snapshots.

do $$
declare
  v_catalog jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'family', plan.slug, 'variant', terms.plan_variant,
    'interval', terms.billing_interval, 'price', terms.price_amount,
    'trialDays', terms.trial_days,
    'locations', terms.resource_limits -> 'active_locations'
  ) order by plan.sort_order, terms.plan_variant, terms.billing_interval)
  into v_catalog
  from public.plans plan
  join public.portals portal on portal.id = plan.portal_id
  cross join lateral shop_private.current_plan_offers(plan.id) terms
  where portal.key = 'shop-crm' and plan.slug in ('solo', 'team', 'multi');

  if v_catalog is distinct from '[
    {"family":"solo","variant":"standard","interval":"annual","price":2847.84,"trialDays":7,"locations":1},
    {"family":"solo","variant":"standard","interval":"monthly","price":349.00,"trialDays":7,"locations":1},
    {"family":"team","variant":"standard","interval":"annual","price":5703.84,"trialDays":7,"locations":1},
    {"family":"team","variant":"standard","interval":"monthly","price":699.00,"trialDays":7,"locations":1},
    {"family":"multi","variant":"multi_2","interval":"annual","price":8151.84,"trialDays":7,"locations":2},
    {"family":"multi","variant":"multi_2","interval":"monthly","price":999.00,"trialDays":7,"locations":2},
    {"family":"multi","variant":"multi_3","interval":"annual","price":9783.84,"trialDays":7,"locations":3},
    {"family":"multi","variant":"multi_3","interval":"monthly","price":1199.00,"trialDays":7,"locations":3}
  ]'::jsonb then
    raise exception 'HOT-11 exact catalog mismatch: %', v_catalog;
  end if;

  if (select count(distinct id) from public.shop_public_plan_catalog()) <> 3
    or (select count(*) from public.shop_public_plan_catalog()) <> 8
    or not exists (select 1 from public.plan_catalog_terms where trial_days = 14)
    or exists (select 1 from public.plan_catalog_terms
      where catalog_generation = 1 and trial_days = 14 and created_at > now()) then
    raise exception 'family count, public offers, or historical 14-day terms regressed';
  end if;

  if exists (
    with expected(slug, variant, limits) as (values
      ('solo', 'standard', '{"active_locations":1,"active_members":2,"active_products":250,"active_services":50,"active_customers":500,"active_suppliers":50}'::jsonb),
      ('team', 'standard', '{"active_locations":1,"active_members":8,"active_products":500,"active_services":100,"active_customers":2000,"active_suppliers":150}'::jsonb),
      ('multi', 'multi_2', '{"active_locations":2,"active_members":16,"active_products":1000,"active_services":200,"active_customers":5000,"active_suppliers":300}'::jsonb),
      ('multi', 'multi_3', '{"active_locations":3,"active_members":25,"active_products":2000,"active_services":300,"active_customers":10000,"active_suppliers":500}'::jsonb)
    )
    select 1 from expected
    where exists (
      select 1 from public.shop_public_plan_catalog() catalog
      where catalog.slug = expected.slug and catalog.plan_variant = expected.variant
        and catalog.resource_limits is distinct from expected.limits
    ) or (select count(*) from public.shop_public_plan_catalog() catalog
      where catalog.slug = expected.slug and catalog.plan_variant = expected.variant) <> 2
  ) then
    raise exception 'HOT-12 exact six-resource catalog mismatch';
  end if;
end;
$$;

create temporary table shop_plan_catalog_v2_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() operator_id,
  gen_random_uuid() existing_solo_id, gen_random_uuid() existing_team_id,
  gen_random_uuid() existing_multi_id,
  gen_random_uuid() multi2_request, gen_random_uuid() multi2_approval,
  gen_random_uuid() renewal_request, gen_random_uuid() renewal_approval,
  gen_random_uuid() multi3_request, gen_random_uuid() multi3_approval,
  gen_random_uuid() downgrade_request, gen_random_uuid() override_request;
grant select on shop_plan_catalog_v2_fixture to authenticated;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@hot-11.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id id from shop_plan_catalog_v2_fixture
  union all select operator_id from shop_plan_catalog_v2_fixture
  union all select existing_solo_id from shop_plan_catalog_v2_fixture
  union all select existing_team_id from shop_plan_catalog_v2_fixture
  union all select existing_multi_id from shop_plan_catalog_v2_fixture
) users;

insert into public.platform_admins (user_id, role, display_name)
select operator_id, 'operator', 'HOT-11 operator' from shop_plan_catalog_v2_fixture;

-- Disposable pre-V2 customer fixture: existing Solo/Team/Multi subscriptions
-- are snapshotted before reconciliation and must never be silently repriced.
do $$
declare
  v_portal uuid := (select id from public.portals where key = 'shop-crm');
  v_row record;
  v_profile uuid;
  v_shop uuid;
  v_plan uuid;
  v_terms uuid;
begin
  for v_row in
    select existing_solo_id user_id, 'solo' slug from shop_plan_catalog_v2_fixture
    union all select existing_team_id, 'team' from shop_plan_catalog_v2_fixture
    union all select existing_multi_id, 'multi' from shop_plan_catalog_v2_fixture
  loop
    select plan.id into v_plan from public.plans plan
    where plan.portal_id = v_portal and plan.slug = v_row.slug;
    select terms.id into v_terms from shop_private.current_plan_terms(v_plan) terms;
    insert into public.profiles (user_id, portal_id, display_name)
    values (v_row.user_id, v_portal, 'Existing ' || v_row.slug) returning id into v_profile;
    insert into public.shops (portal_id, name, business_mode)
    values (v_portal, 'Existing ' || v_row.slug, 'mixed') returning id into v_shop;
    insert into public.shop_memberships (shop_id, profile_id, role)
    values (v_shop, v_profile, 'owner');
    insert into public.subscriptions (
      profile_id, plan_id, catalog_terms_id, status, trial_start_at,
      trial_end_at, current_period_start, current_period_end, trial_consumed
    ) values (
      v_profile, v_plan, v_terms, 'active', now() - interval '60 days',
      now() - interval '53 days', now() - interval '5 days',
      now() + interval '25 days', true
    );
  end loop;
end;
$$;

create temporary table shop_plan_catalog_v2_subscription_snapshot as
select subscription.id, to_jsonb(subscription) snapshot
from public.subscriptions subscription
join public.profiles profile on profile.id = subscription.profile_id
join shop_plan_catalog_v2_fixture fixture on profile.user_id in (
  fixture.existing_solo_id, fixture.existing_team_id, fixture.existing_multi_id
);

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_catalog_v2_fixture;
set local role authenticated;
do $$
declare v_shop uuid;
begin
  v_shop := public.create_owner_shop('HOT-11 catalog fixture', 'mixed'::public.business_mode);
  perform set_config('hot11.shop', v_shop::text, true);
end;
$$;
reset role;

-- Explicitly choose Multi-2 yearly. The exact catalog-term ID, not a client
-- price or inferred slug, determines the frozen quote and entitlement.
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_catalog_v2_fixture;
set local role authenticated;
do $$
declare
  v_terms uuid := (select catalog.catalog_terms_id
    from public.shop_public_plan_catalog() catalog
    where catalog.slug = 'multi' and catalog.plan_variant = 'multi_2'
      and catalog.billing_interval = 'annual');
  v_notice uuid;
begin
  v_notice := public.submit_shop_billing_notice(
    (select multi2_request from shop_plan_catalog_v2_fixture),
    current_setting('hot11.shop')::uuid, 'multi', v_terms,
    8151.84, current_date, 'HOT11-MULTI2-YEARLY'
  );
  perform set_config('hot11.notice', v_notice::text, true);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_catalog_v2_fixture;
set local role authenticated;
do $$
declare v_result jsonb;
begin
  perform public.platform_admin_billing_command(
    (select multi2_approval from shop_plan_catalog_v2_fixture), 'approve',
    current_setting('hot11.notice')::uuid, 'Matched Multi-2 yearly transfer',
    jsonb_build_object('receivedAmount', 8151.84,
      'receivedReference', 'BANK-HOT11-MULTI2', 'receivedDate', current_date::text)
  );
  v_result := public.platform_admin_billing_command(
    (select multi2_approval from shop_plan_catalog_v2_fixture), 'approve',
    current_setting('hot11.notice')::uuid, 'Matched Multi-2 yearly transfer',
    jsonb_build_object('receivedAmount', 8151.84,
      'receivedReference', 'BANK-HOT11-MULTI2', 'receivedDate', current_date::text)
  );
  if not (v_result ->> 'replayed')::boolean then
    raise exception 'manual approval was not idempotent';
  end if;
end;
$$;
reset role;

do $$
declare v_shop uuid := current_setting('hot11.shop')::uuid;
begin
  if not exists (
    select 1 from public.subscriptions subscription
    join public.shop_memberships membership on membership.profile_id = subscription.profile_id
    join public.plans plan on plan.id = subscription.plan_id
    join public.plan_catalog_terms terms on terms.id = subscription.catalog_terms_id
    where membership.shop_id = v_shop and plan.slug = 'multi'
      and terms.plan_variant = 'multi_2' and terms.billing_interval = 'annual'
  ) or not exists (
    select 1 from public.subscription_commercial_periods period
    where period.billing_submission_id = current_setting('hot11.notice')::uuid
      and period.plan_variant = 'multi_2' and period.billing_interval = 'annual'
      and period.list_price_amount = 8151.84 and period.price_amount = 8151.84
  ) then raise exception 'Multi-2 yearly approval lost its frozen terms'; end if;
end;
$$;

-- A renewal with no requested change keeps the exact current variant and
-- interval. It does not resolve the family's default monthly offer.
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_catalog_v2_fixture;
set local role authenticated;
do $$
declare v_notice uuid;
begin
  v_notice := public.submit_shop_billing_notice(
    (select renewal_request from shop_plan_catalog_v2_fixture),
    current_setting('hot11.shop')::uuid, 8151.84, current_date, 'HOT11-RENEW-SAME'
  );
  perform set_config('hot11.renewal_notice', v_notice::text, true);
end;
$$;
reset role;

do $$
declare v_notice uuid := current_setting('hot11.renewal_notice')::uuid;
begin
  if (select plan_variant_snapshot from public.shop_billing_submissions where id = v_notice) <> 'multi_2'
    or (select billing_interval_snapshot from public.shop_billing_submissions where id = v_notice) <> 'annual'
    or (select list_price_amount from public.shop_billing_submissions where id = v_notice) <> 8151.84 then
    raise exception 'renewal silently changed the current variant or interval';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_catalog_v2_fixture;
set local role authenticated;
select public.platform_admin_billing_command(
  (select renewal_approval from shop_plan_catalog_v2_fixture), 'approve',
  current_setting('hot11.renewal_notice')::uuid, 'Matched exact-term renewal',
  jsonb_build_object('receivedAmount', 8151.84,
    'receivedReference', 'BANK-HOT11-RENEW', 'receivedDate', current_date::text)
);
reset role;

-- An explicit term ID can change Multi-2/yearly to Multi-3/monthly while the
-- family plan ID remains Multi.
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_catalog_v2_fixture;
set local role authenticated;
do $$
declare
  v_terms uuid := (select catalog.catalog_terms_id
    from public.shop_public_plan_catalog() catalog
    where catalog.slug = 'multi' and catalog.plan_variant = 'multi_3'
      and catalog.billing_interval = 'monthly');
  v_notice uuid;
begin
  v_notice := public.submit_shop_billing_notice(
    (select multi3_request from shop_plan_catalog_v2_fixture),
    current_setting('hot11.shop')::uuid, 'multi', v_terms,
    1199, current_date, 'HOT11-MULTI3-MONTHLY'
  );
  perform set_config('hot11.multi3_notice', v_notice::text, true);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_catalog_v2_fixture;
set local role authenticated;
select public.platform_admin_billing_command(
  (select multi3_approval from shop_plan_catalog_v2_fixture), 'approve',
  current_setting('hot11.multi3_notice')::uuid, 'Matched explicit Multi-3 change',
  jsonb_build_object('receivedAmount', 1199,
    'receivedReference', 'BANK-HOT11-MULTI3', 'receivedDate', current_date::text)
);
reset role;

-- A same-family Multi-3 -> Multi-2 variant downgrade is blocked atomically
-- when the third active location does not fit. Neither the exact subscribed
-- term nor any business record is changed by the failed attempt.
do $$
declare v_shop uuid := current_setting('hot11.shop')::uuid;
begin
  insert into public.shop_locations (shop_id, name) values
    (v_shop, 'Second branch'), (v_shop, 'Third branch');
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_catalog_v2_fixture;
set local role authenticated;
select public.submit_shop_billing_notice(
  (select downgrade_request from shop_plan_catalog_v2_fixture),
  current_setting('hot11.shop')::uuid, 'multi',
  (select catalog.catalog_terms_id
    from public.shop_public_plan_catalog() catalog
    where catalog.slug = 'multi' and catalog.plan_variant = 'multi_2'
      and catalog.billing_interval = 'monthly'),
  999, current_date, 'HOT11-MULTI2-DOWNGRADE'
);
reset role;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true),
  set_config('shop.billing_approval', 'approved', true)
from shop_plan_catalog_v2_fixture;
do $$
declare
  v_shop uuid := current_setting('hot11.shop')::uuid;
  v_subscription uuid;
  v_before_terms uuid;
  v_multi2_terms uuid := (select catalog.catalog_terms_id
    from public.shop_public_plan_catalog() catalog
    where catalog.slug = 'multi' and catalog.plan_variant = 'multi_2'
      and catalog.billing_interval = 'monthly');
begin
  select subscription.id, subscription.catalog_terms_id
    into v_subscription, v_before_terms
  from public.shop_memberships membership
  join public.subscriptions subscription on subscription.profile_id = membership.profile_id
  where membership.shop_id = v_shop and membership.role = 'owner';
  begin
    update public.subscriptions set catalog_terms_id = v_multi2_terms
    where id = v_subscription;
    raise exception 'over-limit Multi-2 variant downgrade became effective';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_EXCEEDED:active_locations:%' then raise; end if;
  end;
  if (select catalog_terms_id from public.subscriptions where id = v_subscription)
      is distinct from v_before_terms
    or (select count(*) from public.shop_locations
      where shop_id = v_shop and status = 'active') <> 3 then
    raise exception 'blocked variant downgrade changed terms or business records';
  end if;
end;
$$;

do $$
declare
  v_before_terms jsonb;
  v_after_terms jsonb;
  v_before_snapshots jsonb;
  v_after_snapshots jsonb;
begin
  select jsonb_agg(to_jsonb(terms) order by terms.id) into v_before_terms
  from public.plan_catalog_terms terms where terms.catalog_generation = 1;
  select jsonb_build_object(
    'notices', (select jsonb_agg(to_jsonb(notice) order by notice.id)
      from public.shop_billing_submissions notice
      where notice.shop_id = current_setting('hot11.shop')::uuid),
    'periods', (select jsonb_agg(to_jsonb(period) order by period.id)
      from public.subscription_commercial_periods period
      join public.shop_billing_submissions notice on notice.id = period.billing_submission_id
      where notice.shop_id = current_setting('hot11.shop')::uuid)
  ) into v_before_snapshots;

  perform shop_private.reconcile_plan_catalog_v2();
  perform shop_private.reconcile_plan_catalog_v2();

  select jsonb_agg(to_jsonb(terms) order by terms.id) into v_after_terms
  from public.plan_catalog_terms terms where terms.catalog_generation = 1;
  select jsonb_build_object(
    'notices', (select jsonb_agg(to_jsonb(notice) order by notice.id)
      from public.shop_billing_submissions notice
      where notice.shop_id = current_setting('hot11.shop')::uuid),
    'periods', (select jsonb_agg(to_jsonb(period) order by period.id)
      from public.subscription_commercial_periods period
      join public.shop_billing_submissions notice on notice.id = period.billing_submission_id
      where notice.shop_id = current_setting('hot11.shop')::uuid)
  ) into v_after_snapshots;

  if v_before_terms is distinct from v_after_terms
    or v_before_snapshots is distinct from v_after_snapshots
    or exists (
      select 1 from shop_plan_catalog_v2_subscription_snapshot snapshot
      join public.subscriptions subscription on subscription.id = snapshot.id
      where to_jsonb(subscription) is distinct from snapshot.snapshot
    )
    or (select count(*) from shop_plan_catalog_v2_subscription_snapshot) <> 3
    or (select count(*) from public.plan_catalog_terms where catalog_generation = 2) <> 16 then
    raise exception 'catalog reapplication rewrote history or duplicated V2 offers';
  end if;
end;
$$;

-- A negotiated amount changes only the effective quote. The exact Multi-3
-- yearly list price and entitlement snapshot stay frozen in the notice.
select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_catalog_v2_fixture;
set local role authenticated;
select public.platform_plan_command(
  (select override_request from shop_plan_catalog_v2_fixture),
  'set_price_override', 'HOT-11 negotiated yearly amount', null,
  current_setting('hot11.shop')::uuid,
  jsonb_build_object('amount', 9000, 'currency', 'EGP',
    'effectiveFrom', clock_timestamp()::text, 'expiresAt', null)
);
reset role;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_catalog_v2_fixture;
set local role authenticated;
do $$
declare
  v_terms uuid := (select catalog.catalog_terms_id
    from public.shop_public_plan_catalog() catalog
    where catalog.slug = 'multi' and catalog.plan_variant = 'multi_3'
      and catalog.billing_interval = 'annual');
  v_notice uuid;
begin
  v_notice := public.submit_shop_billing_notice(
    gen_random_uuid(), current_setting('hot11.shop')::uuid, 'multi', v_terms,
    9000, current_date, 'HOT11-NEGOTIATED-YEARLY'
  );
  perform set_config('hot11.negotiated_notice', v_notice::text, true);
end;
$$;
reset role;

do $$
declare v_notice uuid := current_setting('hot11.negotiated_notice')::uuid;
begin
  if not exists (
    select 1 from public.shop_billing_submissions notice
    where notice.id = v_notice and notice.plan_slug_snapshot = 'multi'
      and notice.plan_variant_snapshot = 'multi_3'
      and notice.billing_interval_snapshot = 'annual'
      and notice.list_price_amount = 9783.84
      and notice.effective_price_amount = 9000
      and notice.currency = 'EGP' and notice.price_source = 'override'
      and notice.resource_limits_snapshot ->> 'active_locations' = '3'
  ) then raise exception 'negotiated notice did not freeze the exact V2 quote'; end if;
end;
$$;
