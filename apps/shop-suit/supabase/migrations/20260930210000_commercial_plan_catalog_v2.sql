-- SS-HOT-PLAN-CATALOG-V2-001 / HOT-11: three plan families, exact monthly
-- and yearly offers, and two server-authoritative Multi variants. Existing
-- catalog terms and every snapshot that references them remain immutable.

drop function public.shop_public_plan_catalog();

alter table public.plan_catalog_terms
  alter column price_amount type numeric(12, 2) using price_amount::numeric(12, 2),
  add column catalog_generation integer not null default 1,
  add column plan_variant text,
  add column variant_name text,
  add constraint plan_catalog_terms_generation_positive check (catalog_generation > 0),
  add constraint plan_catalog_terms_variant_key check (plan_variant ~ '^[a-z][a-z0-9_]{0,39}$'),
  add constraint plan_catalog_terms_variant_name check (length(btrim(variant_name)) between 1 and 80),
  add constraint plan_catalog_terms_v2_identity check (
    catalog_generation < 2 or (plan_variant is not null and variant_name is not null)
  );

alter table public.shop_billing_submissions
  add column plan_variant_snapshot text;

alter table public.subscription_commercial_periods
  add column plan_variant text;

-- Historical generation-one terms, notices, and paid periods deliberately keep
-- these additive identity fields null. No previously frozen row is updated.

grant select (
  id, plan_id, version, display_name, billing_interval, currency,
  price_amount, trial_days, resource_limits, is_public, is_purchasable,
  effective_from, catalog_generation, plan_variant, variant_name
) on public.plan_catalog_terms to anon, authenticated;

create function shop_private.reconcile_plan_catalog_v2()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_portal_id uuid;
begin
  select portal.id into v_portal_id
  from public.portals portal where portal.key = 'shop-crm';
  if v_portal_id is null then return; end if;

  -- These mutable columns are compatibility/headline fields only. Commercial
  -- quotes and entitlements always resolve the immutable term selected below.
  update public.plans plan set
    price_amount = case plan.slug
      when 'solo' then 349 when 'team' then 699 when 'multi' then 999 end,
    billing_interval = 'monthly',
    trial_days = 7,
    resource_limits = case plan.slug
      when 'solo' then '{"active_locations":1,"active_members":2,"active_products":250,"active_services":50}'::jsonb
      when 'team' then '{"active_locations":1,"active_members":8,"active_products":1000,"active_services":250}'::jsonb
      when 'multi' then '{"active_locations":2,"active_members":25,"active_products":5000,"active_services":1000}'::jsonb
    end,
    features = case plan.slug
      when 'solo' then '{"inventory":true,"max_locations":1,"max_members":2,"max_products":250,"max_services":50}'::jsonb
      when 'team' then '{"inventory":true,"max_locations":1,"max_members":8,"max_products":1000,"max_services":250}'::jsonb
      when 'multi' then '{"inventory":true,"max_locations":2,"max_members":25,"max_products":5000,"max_services":1000}'::jsonb
    end,
    is_active = true, is_public = true, is_purchasable = true,
    is_coming_soon = false, updated_at = now()
  where plan.portal_id = v_portal_id and plan.slug in ('solo', 'team', 'multi');

  with offers(slug, ordinal, plan_variant, variant_name, billing_interval,
      price_amount, resource_limits) as (values
    ('solo', 1, 'standard', 'Solo', 'monthly', 349.00::numeric,
      '{"active_locations":1,"active_members":2,"active_products":250,"active_services":50}'::jsonb),
    ('solo', 2, 'standard', 'Solo', 'annual', 2847.84::numeric,
      '{"active_locations":1,"active_members":2,"active_products":250,"active_services":50}'::jsonb),
    ('team', 1, 'standard', 'Team', 'monthly', 699.00::numeric,
      '{"active_locations":1,"active_members":8,"active_products":1000,"active_services":250}'::jsonb),
    ('team', 2, 'standard', 'Team', 'annual', 5703.84::numeric,
      '{"active_locations":1,"active_members":8,"active_products":1000,"active_services":250}'::jsonb),
    ('multi', 1, 'multi_2', 'Multi · 2 branches', 'monthly', 999.00::numeric,
      '{"active_locations":2,"active_members":25,"active_products":5000,"active_services":1000}'::jsonb),
    ('multi', 2, 'multi_2', 'Multi · 2 branches', 'annual', 8151.84::numeric,
      '{"active_locations":2,"active_members":25,"active_products":5000,"active_services":1000}'::jsonb),
    ('multi', 3, 'multi_3', 'Multi · 3 branches', 'monthly', 1199.00::numeric,
      '{"active_locations":3,"active_members":25,"active_products":5000,"active_services":1000}'::jsonb),
    ('multi', 4, 'multi_3', 'Multi · 3 branches', 'annual', 9783.84::numeric,
      '{"active_locations":3,"active_members":25,"active_products":5000,"active_services":1000}'::jsonb)
  ), missing as (
    select plan.id plan_id, plan.is_public, plan.is_purchasable,
      offer.*, coalesce((select max(existing.version)
        from public.plan_catalog_terms existing where existing.plan_id = plan.id), 0) base_version
    from offers offer
    join public.plans plan on plan.portal_id = v_portal_id and plan.slug = offer.slug
    where not exists (
      select 1 from public.plan_catalog_terms existing
      where existing.plan_id = plan.id and existing.catalog_generation = 2
        and existing.plan_variant = offer.plan_variant
        and existing.billing_interval = offer.billing_interval
    )
  )
  insert into public.plan_catalog_terms (
    plan_id, version, display_name, billing_interval, currency, price_amount,
    trial_days, resource_limits, is_public, is_purchasable, effective_from,
    catalog_generation, plan_variant, variant_name
  )
  select missing.plan_id,
    missing.base_version + row_number() over (partition by missing.plan_id order by missing.ordinal),
    missing.variant_name,
    missing.billing_interval, 'EGP', missing.price_amount, 7,
    missing.resource_limits, missing.is_public, missing.is_purchasable,
    clock_timestamp(), 2, missing.plan_variant, missing.variant_name
  from missing;

  update public.plans plan set catalog_version = latest.version
  from (
    select terms.plan_id, max(terms.version) version
    from public.plan_catalog_terms terms where terms.catalog_generation = 2
    group by terms.plan_id
  ) latest
  where plan.id = latest.plan_id and plan.catalog_version is distinct from latest.version;
end;
$$;

select shop_private.reconcile_plan_catalog_v2();

alter table public.plan_catalog_terms
  alter column catalog_generation set default 2;

-- Keep later operator-published terms in V2 even though the pre-V2 command
-- does not yet send the additive identity columns. Multi is inferred only from
-- its server-validated branch entitlement; any other branch count fails closed.
create function shop_private.apply_plan_catalog_v2_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_slug text;
begin
  select plan.slug into v_slug from public.plans plan where plan.id = new.plan_id;
  new.catalog_generation := 2;
  if v_slug = 'multi' then
    new.plan_variant := case (new.resource_limits ->> 'active_locations')::integer
      when 2 then 'multi_2' when 3 then 'multi_3' else null end;
    if new.plan_variant is null then
      raise exception 'MULTI_VARIANT_BRANCH_LIMIT_INVALID' using errcode = '23514';
    end if;
    new.variant_name := case new.plan_variant
      when 'multi_2' then 'Multi · 2 branches' else 'Multi · 3 branches' end;
  else
    new.plan_variant := 'standard';
    new.variant_name := initcap(replace(v_slug, '-', ' '));
  end if;
  return new;
end;
$$;

create trigger plan_catalog_terms_00_v2_identity
before insert on public.plan_catalog_terms
for each row execute function shop_private.apply_plan_catalog_v2_identity();

-- The maintained reconciliation entry point still initializes terms for plans
-- added after the migration, then reapplies V2. Historical Basic/Pro mappings
-- and generation-one terms already exist and remain immutable; rerunning the
-- older hard-coded catalog would otherwise restore Multi 1099.
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

  perform shop_private.reconcile_plan_catalog_v2();
end;
$$;

-- All currently sold offers in the newest effective catalog generation. The
-- plan row remains the family identity; variant and interval belong to terms.
create function shop_private.current_plan_offers(
  p_plan_id uuid, p_at timestamptz default clock_timestamp()
) returns setof public.plan_catalog_terms
language sql stable security definer set search_path = '' as $$
  with effective as (
    select terms.*,
      max(terms.catalog_generation) over (partition by terms.plan_id) current_generation,
      row_number() over (
        partition by terms.plan_id, terms.catalog_generation,
          terms.plan_variant, terms.billing_interval
        order by terms.effective_from desc, terms.version desc, terms.id desc
      ) offer_rank
    from public.plan_catalog_terms terms
    where terms.plan_id = p_plan_id and terms.effective_from <= p_at
  )
  select effective.id, effective.plan_id, effective.version,
    effective.display_name, effective.billing_interval, effective.currency,
    effective.price_amount, effective.trial_days, effective.resource_limits,
    effective.is_public, effective.is_purchasable, effective.effective_from,
    effective.created_at, effective.catalog_generation,
    effective.plan_variant, effective.variant_name
  from effective
  where effective.catalog_generation = effective.current_generation
    and effective.offer_rank = 1
  order by case effective.plan_variant
      when 'standard' then 1 when 'multi_2' then 2 when 'multi_3' then 3 else 9 end,
    case effective.billing_interval when 'monthly' then 1 when 'annual' then 2 else 9 end;
$$;

-- Keep the legacy single-term resolver deterministic for onboarding and older
-- operator commands. It selects the lowest current monthly offer, never a
-- yearly term merely because it has the greatest version number.
create or replace function shop_private.current_plan_terms(
  p_plan_id uuid, p_at timestamptz default clock_timestamp()
) returns public.plan_catalog_terms
language sql stable security definer set search_path = '' as $$
  select terms.* from shop_private.current_plan_offers(p_plan_id, p_at) terms
  order by case terms.plan_variant
      when 'standard' then 1 when 'multi_2' then 2 when 'multi_3' then 3 else 9 end,
    case terms.billing_interval when 'monthly' then 1 when 'annual' then 2 else 9 end
  limit 1;
$$;

-- The pre-V2 operator renewal command resolves one family default. Preserve
-- the subscription's exact variant/interval unless a non-terminal billing
-- notice proves that the customer explicitly selected another offer.
create function shop_private.preserve_implicit_renewal_terms()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_shop_id uuid;
  v_interval text;
begin
  if new.plan_id = old.plan_id
    and new.catalog_terms_id is distinct from old.catalog_terms_id
    and current_setting('shop.billing_approval', true) = 'approved' then
    select membership.shop_id into v_shop_id
    from public.shop_memberships membership
    where membership.profile_id = old.profile_id and membership.role = 'owner'
    order by (membership.status = 'active') desc, membership.created_at, membership.id
    limit 1;

    if not exists (
      select 1 from public.shop_billing_submissions notice
      where notice.shop_id = v_shop_id and notice.catalog_terms_id = new.catalog_terms_id
        and notice.status in ('submitted', 'under_review')
    ) then
      select terms.billing_interval into v_interval
      from public.plan_catalog_terms terms where terms.id = old.catalog_terms_id;
      new.catalog_terms_id := old.catalog_terms_id;
      if new.current_period_end is distinct from old.current_period_end then
        new.current_period_end := greatest(
          coalesce(old.current_period_end, clock_timestamp()), clock_timestamp()
        ) + case v_interval
          when 'monthly' then interval '1 month'
          when 'quarterly' then interval '3 months'
          when 'annual' then interval '1 year'
        end;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger subscriptions_00_preserve_implicit_renewal_terms
before update of plan_id, catalog_terms_id, current_period_end on public.subscriptions
for each row execute function shop_private.preserve_implicit_renewal_terms();

create function public.shop_public_plan_catalog()
returns table (
  id uuid, name text, slug text, catalog_terms_id uuid,
  plan_variant text, variant_name text, price_amount numeric,
  currency text, billing_interval text, trial_days integer, features jsonb,
  resource_limits jsonb, is_purchasable boolean, is_coming_soon boolean
) language sql stable security definer set search_path = '' as $$
  select plan.id, plan.name, plan.slug, terms.id,
    terms.plan_variant, terms.variant_name, terms.price_amount,
    terms.currency, terms.billing_interval, terms.trial_days, plan.features,
    terms.resource_limits, terms.is_purchasable, plan.is_coming_soon
  from public.plans plan
  join public.portals portal on portal.id = plan.portal_id
  cross join lateral shop_private.current_plan_offers(plan.id) terms
  where portal.key = 'shop-crm' and portal.is_active
    and plan.is_active and plan.is_public and plan.is_purchasable
    and terms.is_public and terms.is_purchasable and not plan.is_coming_soon
  order by plan.sort_order,
    case terms.plan_variant when 'standard' then 1 when 'multi_2' then 2 when 'multi_3' then 3 else 9 end,
    case terms.billing_interval when 'monthly' then 1 when 'annual' then 2 else 9 end;
$$;

create or replace function shop_private.billing_notice_commercial_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (
    new.catalog_terms_id is distinct from old.catalog_terms_id
    or new.plan_id is distinct from old.plan_id
    or new.plan_slug_snapshot is distinct from old.plan_slug_snapshot
    or new.plan_name_snapshot is distinct from old.plan_name_snapshot
    or new.plan_variant_snapshot is distinct from old.plan_variant_snapshot
    or new.billing_interval_snapshot is distinct from old.billing_interval_snapshot
    or new.resource_limits_snapshot is distinct from old.resource_limits_snapshot
    or new.expected_amount is distinct from old.expected_amount
    or new.list_price_amount is distinct from old.list_price_amount
    or new.effective_price_amount is distinct from old.effective_price_amount
    or new.price_override_id is distinct from old.price_override_id
    or new.price_source is distinct from old.price_source
    or new.quoted_at is distinct from old.quoted_at
    or new.currency is distinct from old.currency
  ) then
    raise exception 'BILLING_NOTICE_COMMERCIAL_TERMS_IMMUTABLE' using errcode = '55000';
  end if;

  if tg_op = 'INSERT' then
    if new.plan_id is null then
      select subscription.plan_id into new.plan_id
      from public.shop_memberships membership
      join public.subscriptions subscription on subscription.profile_id = membership.profile_id
      where membership.shop_id = new.shop_id and membership.role = 'owner'
      order by (membership.status = 'active') desc, membership.created_at, membership.id limit 1;
    end if;
    select terms.id, plan.slug, terms.display_name,
      coalesce(terms.plan_variant, 'legacy'),
      terms.billing_interval, terms.resource_limits,
      coalesce(new.list_price_amount, terms.price_amount),
      coalesce(new.effective_price_amount, new.expected_amount, terms.price_amount),
      coalesce(new.expected_amount, new.effective_price_amount, terms.price_amount),
      coalesce(new.currency, terms.currency), coalesce(new.price_source, 'catalog'),
      coalesce(new.quoted_at, clock_timestamp())
    into new.catalog_terms_id, new.plan_slug_snapshot, new.plan_name_snapshot,
      new.plan_variant_snapshot, new.billing_interval_snapshot,
      new.resource_limits_snapshot, new.list_price_amount,
      new.effective_price_amount, new.expected_amount, new.currency,
      new.price_source, new.quoted_at
    from public.plans plan
    join public.plan_catalog_terms terms on terms.plan_id = plan.id
    where plan.id = new.plan_id and terms.id = coalesce(new.catalog_terms_id, terms.id)
    order by terms.version desc limit 1;
    if new.catalog_terms_id is null then
      raise exception 'PLAN_COMMERCIAL_TERMS_NOT_FOUND' using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

create or replace function shop_private.billing_subscription_snapshot(p_shop_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', subscription.id, 'status', subscription.status,
    'planId', plan.id, 'planSlug', plan.slug, 'planName', terms.display_name,
    'planVariant', terms.plan_variant, 'variantName', terms.variant_name,
    'priceAmount', (price.quote ->> 'effectivePriceAmount')::numeric,
    'listPriceAmount', (price.quote ->> 'listPriceAmount')::numeric,
    'effectivePriceAmount', (price.quote ->> 'effectivePriceAmount')::numeric,
    'priceSource', price.quote ->> 'priceSource',
    'priceOverrideId', price.quote ->> 'priceOverrideId',
    'priceOverrideReason', price.quote ->> 'priceOverrideReason',
    'priceOverrideEffectiveFrom', price.quote ->> 'priceOverrideEffectiveFrom',
    'priceOverrideExpiresAt', price.quote ->> 'priceOverrideExpiresAt',
    'currency', terms.currency, 'billingInterval', terms.billing_interval,
    'resourceLimits', terms.resource_limits,
    'trialStartAt', subscription.trial_start_at, 'trialEndAt', subscription.trial_end_at,
    'periodStart', subscription.current_period_start, 'periodEnd', subscription.current_period_end,
    'accessState', case
      when shop.status = 'suspended' then 'suspended'
      when subscription.status = 'trialing' and subscription.trial_end_at > now() then 'trialing'
      when subscription.status = 'active' and subscription.current_period_end > now() then 'active'
      else 'read_only' end,
    'trialDaysRemaining', case
      when subscription.status = 'trialing' and subscription.trial_end_at > now()
      then ceil(extract(epoch from subscription.trial_end_at - now()) / 86400.0)::integer else 0 end
  )
  from public.shops shop
  join public.shop_memberships membership on membership.shop_id = shop.id and membership.role = 'owner'
  join public.subscriptions subscription on subscription.profile_id = membership.profile_id
  join public.plans plan on plan.id = subscription.plan_id
  join public.plan_catalog_terms terms on terms.id = subscription.catalog_terms_id
  cross join lateral (select shop_private.subscription_effective_price(
    subscription.id, subscription.catalog_terms_id, clock_timestamp()) quote) price
  where shop.id = p_shop_id
  order by (membership.status = 'active') desc, membership.created_at, membership.id limit 1;
$$;

create or replace function public.shop_billing_read(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_subscription jsonb; v_subscription_id uuid; v_result jsonb;
begin
  if p_shop_id is null or not shop_private.is_owner(p_shop_id) then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  v_subscription := shop_private.billing_subscription_snapshot(p_shop_id);
  if v_subscription is null then raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023'; end if;
  v_subscription_id := (v_subscription ->> 'id')::uuid;
  select jsonb_build_object(
    'subscription', v_subscription,
    'availablePlans', (select coalesce(jsonb_agg(jsonb_build_object(
      'planId', plan.id, 'planSlug', plan.slug, 'planName', terms.display_name,
      'catalogTermsId', terms.id, 'planVariant', terms.plan_variant,
      'variantName', terms.variant_name, 'billingInterval', terms.billing_interval,
      'currency', terms.currency,
      'listPriceAmount', (price.quote ->> 'listPriceAmount')::numeric,
      'effectivePriceAmount', (price.quote ->> 'effectivePriceAmount')::numeric,
      'priceSource', price.quote ->> 'priceSource',
      'resourceLimits', terms.resource_limits,
      'blockers', shop_private.plan_change_blockers(p_shop_id, terms.resource_limits)
    ) order by plan.sort_order, terms.plan_variant, terms.billing_interval), '[]'::jsonb)
    from public.plans plan
    join public.portals portal on portal.id = plan.portal_id
    cross join lateral shop_private.current_plan_offers(plan.id) terms
    cross join lateral (select shop_private.subscription_effective_price(
      v_subscription_id, terms.id, clock_timestamp()) quote) price
    where portal.key = 'shop-crm' and plan.is_active and plan.is_public
      and plan.is_purchasable and not plan.is_coming_soon
      and terms.is_public and terms.is_purchasable),
    'instructions', jsonb_build_object(
      'recipientAlias', configuration.recipient_alias,
      'paymentLink', configuration.payment_link, 'qrImageUrl', configuration.qr_image_url,
      'instructionsEn', configuration.instructions_en,
      'instructionsAr', configuration.instructions_ar,
      'updatedAt', configuration.updated_at, 'manualVerification', true
    ),
    'usage', shop_private.plan_usage_snapshot(p_shop_id),
    'submissions', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', submission.id, 'kind', submission.kind, 'status', submission.status,
      'requestedPlanId', submission.plan_id,
      'requestedPlanSlug', submission.plan_slug_snapshot,
      'requestedPlanName', submission.plan_name_snapshot,
      'planVariant', submission.plan_variant_snapshot,
      'billingInterval', submission.billing_interval_snapshot,
      'listPriceAmount', submission.list_price_amount,
      'effectivePriceAmount', submission.effective_price_amount,
      'priceSource', submission.price_source, 'expectedAmount', submission.expected_amount,
      'paidAmount', submission.paid_amount, 'currency', submission.currency,
      'transferDate', submission.transfer_date, 'transferReference', submission.transfer_reference,
      'reviewReason', submission.review_reason, 'receivedAmount', submission.received_amount,
      'receivedReference', submission.received_reference, 'receivedDate', submission.received_date,
      'activationDays', submission.activation_days,
      'approvedSubscriptionEnd', submission.approved_subscription_end,
      'submittedAt', submission.submitted_at, 'reviewedAt', submission.reviewed_at
    ) order by submission.submitted_at desc, submission.id desc), '[]'::jsonb)
    from public.shop_billing_submissions submission where submission.shop_id = p_shop_id)
  ) into v_result
  from public.shop_billing_configuration configuration where configuration.singleton;
  return v_result;
end;
$$;

create function public.submit_shop_billing_notice(
  p_request_id uuid, p_shop_id uuid, p_requested_plan_slug text,
  p_requested_catalog_terms_id uuid, p_paid_amount numeric,
  p_transfer_date date, p_transfer_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_profile_id uuid; v_subscription_id uuid; v_current_plan_id uuid; v_current_terms_id uuid;
  v_plan_id uuid; v_terms_id uuid; v_plan_slug text; v_plan_name text;
  v_variant text; v_interval text; v_currency text; v_limits jsonb; v_quote jsonb;
  v_existing public.shop_billing_submissions; v_submission_id uuid;
begin
  if p_request_id is null or p_shop_id is null
    or p_paid_amount is null or p_paid_amount <= 0 or p_paid_amount > 9999999999.99
    or p_paid_amount <> round(p_paid_amount, 2)
    or p_transfer_date is null or p_transfer_date > current_date
    or p_transfer_date < current_date - 365
    or p_transfer_reference is null or length(btrim(p_transfer_reference)) not between 2 and 200
    or (p_requested_plan_slug is not null
      and length(btrim(p_requested_plan_slug)) not between 1 and 100) then
    raise exception 'BILLING_NOTICE_INVALID' using errcode = '22023';
  end if;
  if not shop_private.is_owner(p_shop_id) then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;

  select membership.profile_id, subscription.id, subscription.plan_id, subscription.catalog_terms_id
  into v_profile_id, v_subscription_id, v_current_plan_id, v_current_terms_id
  from public.shop_memberships membership
  join public.subscriptions subscription on subscription.profile_id = membership.profile_id
  where membership.shop_id = p_shop_id and membership.role = 'owner'
  order by (membership.status = 'active') desc, membership.created_at, membership.id limit 1;
  if v_profile_id is null then
    raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_existing from public.shop_billing_submissions submission
  where submission.request_id = p_request_id;
  if found then
    if v_existing.shop_id <> p_shop_id
      or v_existing.submitted_by_profile_id <> v_profile_id
      or v_existing.paid_amount is distinct from p_paid_amount
      or v_existing.transfer_date is distinct from p_transfer_date
      or v_existing.transfer_reference is distinct from btrim(p_transfer_reference)
      or (p_requested_plan_slug is not null
        and v_existing.plan_slug_snapshot <> btrim(p_requested_plan_slug))
      or (p_requested_catalog_terms_id is not null
        and v_existing.catalog_terms_id <> p_requested_catalog_terms_id) then
      raise exception 'BILLING_NOTICE_KEY_REUSED' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  if p_requested_catalog_terms_id is null and nullif(btrim(p_requested_plan_slug), '') is null then
    select plan.id, terms.id, plan.slug, terms.display_name, terms.plan_variant,
      terms.billing_interval, terms.currency, terms.resource_limits
    into v_plan_id, v_terms_id, v_plan_slug, v_plan_name, v_variant,
      v_interval, v_currency, v_limits
    from public.plans plan
    join public.plan_catalog_terms terms on terms.id = v_current_terms_id
    where plan.id = v_current_plan_id;
  else
    select plan.id, terms.id, plan.slug, terms.display_name, terms.plan_variant,
      terms.billing_interval, terms.currency, terms.resource_limits
    into v_plan_id, v_terms_id, v_plan_slug, v_plan_name, v_variant,
      v_interval, v_currency, v_limits
    from public.plans plan
    join public.portals portal on portal.id = plan.portal_id
    cross join lateral shop_private.current_plan_offers(plan.id) terms
    where portal.key = 'shop-crm'
      and (p_requested_catalog_terms_id is null or terms.id = p_requested_catalog_terms_id)
      and (nullif(btrim(p_requested_plan_slug), '') is null
        or plan.slug = btrim(p_requested_plan_slug))
      and plan.is_active and plan.is_public and plan.is_purchasable
      and not plan.is_coming_soon and terms.is_public and terms.is_purchasable
    order by plan.sort_order,
      case terms.plan_variant when 'standard' then 1 when 'multi_2' then 2 when 'multi_3' then 3 else 9 end,
      case terms.billing_interval when 'monthly' then 1 when 'annual' then 2 else 9 end
    limit 1;
  end if;
  if v_plan_id is null then raise exception 'PLAN_UNAVAILABLE' using errcode = '22023'; end if;
  v_quote := shop_private.subscription_effective_price(
    v_subscription_id, v_terms_id, clock_timestamp()
  );

  insert into public.shop_billing_submissions (
    request_id, shop_id, submitted_by_profile_id, plan_id, catalog_terms_id,
    plan_slug_snapshot, plan_name_snapshot, plan_variant_snapshot,
    billing_interval_snapshot, resource_limits_snapshot,
    list_price_amount, effective_price_amount, expected_amount,
    price_override_id, price_source, quoted_at,
    kind, status, amount, paid_amount, currency, reference,
    transfer_date, transfer_reference, metadata
  ) values (
    p_request_id, p_shop_id, v_profile_id, v_plan_id, v_terms_id,
    v_plan_slug, v_plan_name, v_variant, v_interval, v_limits,
    (v_quote ->> 'listPriceAmount')::numeric,
    (v_quote ->> 'effectivePriceAmount')::numeric,
    (v_quote ->> 'effectivePriceAmount')::numeric,
    nullif(v_quote ->> 'priceOverrideId', '')::uuid,
    v_quote ->> 'priceSource', clock_timestamp(),
    case when v_plan_id = v_current_plan_id then 'renewal' else 'activation' end,
    'submitted', p_paid_amount, p_paid_amount, v_currency,
    btrim(p_transfer_reference), p_transfer_date, btrim(p_transfer_reference),
    jsonb_build_object('channel', 'instapay_manual', 'automaticVerification', false)
  ) returning id into v_submission_id;
  return v_submission_id;
end;
$$;

create or replace function public.submit_shop_billing_notice(
  p_request_id uuid, p_shop_id uuid, p_requested_plan_slug text,
  p_paid_amount numeric, p_transfer_date date, p_transfer_reference text
) returns uuid language sql security definer set search_path = '' as $$
  select public.submit_shop_billing_notice(
    p_request_id, p_shop_id, p_requested_plan_slug, null,
    p_paid_amount, p_transfer_date, p_transfer_reference
  );
$$;

create or replace function public.submit_shop_billing_notice(
  p_request_id uuid, p_shop_id uuid, p_paid_amount numeric,
  p_transfer_date date, p_transfer_reference text
) returns uuid language sql security definer set search_path = '' as $$
  select public.submit_shop_billing_notice(
    p_request_id, p_shop_id, null, null,
    p_paid_amount, p_transfer_date, p_transfer_reference
  );
$$;

create or replace function shop_private.capture_approved_commercial_period()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_subscription public.subscriptions;
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    select subscription.* into v_subscription
    from public.shop_memberships membership
    join public.subscriptions subscription on subscription.profile_id = membership.profile_id
    where membership.shop_id = new.shop_id and membership.role = 'owner'
    order by (membership.status = 'active') desc, membership.created_at, membership.id limit 1;
    insert into public.subscription_commercial_periods (
      subscription_id, billing_submission_id, catalog_terms_id, plan_slug,
      plan_name, plan_variant, billing_interval, currency, price_amount,
      list_price_amount, price_override_id, resource_limits,
      period_start, period_end, approved_at
    ) values (
      v_subscription.id, new.id, new.catalog_terms_id, new.plan_slug_snapshot,
      new.plan_name_snapshot, new.plan_variant_snapshot,
      new.billing_interval_snapshot, new.currency,
      new.effective_price_amount, new.list_price_amount, new.price_override_id,
      new.resource_limits_snapshot,
      greatest(coalesce(v_subscription.current_period_end, new.submitted_at), new.submitted_at)
        - case new.billing_interval_snapshot when 'monthly' then interval '1 month'
          when 'quarterly' then interval '3 months' when 'annual' then interval '1 year' end,
      coalesce(new.approved_subscription_end, v_subscription.current_period_end),
      coalesce(new.reviewed_at, clock_timestamp())
    ) on conflict (billing_submission_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function shop_private.reconcile_plan_catalog_v2(),
  shop_private.current_plan_offers(uuid, timestamptz),
  shop_private.preserve_implicit_renewal_terms(),
  shop_private.apply_plan_catalog_v2_identity()
from public, anon, authenticated, service_role;
revoke all on function public.shop_public_plan_catalog() from public, service_role;
grant execute on function public.shop_public_plan_catalog() to anon, authenticated;
revoke all on function public.submit_shop_billing_notice(
  uuid, uuid, text, uuid, numeric, date, text
) from public, anon, service_role;
grant execute on function public.submit_shop_billing_notice(
  uuid, uuid, text, uuid, numeric, date, text
) to authenticated;

notify pgrst, 'reload schema';
