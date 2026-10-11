-- SS-LAUNCH-SOLO-VARIANTS-001 / SS-LAUNCH-D05. Append Solo terms only.
-- No subscription, billing notice, or historical catalog snapshot is rewritten.

create or replace function shop_private.apply_plan_catalog_v2_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_slug text;
begin
  if new.private_offer_id is not null then
    if not exists (select 1 from public.shop_private_offers offer
      where offer.id = new.private_offer_id and offer.plan_id = new.plan_id
        and offer.display_name = new.display_name and offer.billing_interval = new.billing_interval
        and offer.currency = new.currency and offer.price_amount = new.price_amount
        and offer.resource_limits = new.resource_limits
        and not new.is_public and not new.is_purchasable) then
      raise exception 'SHOP_PRIVATE_OFFER_TERMS_MISMATCH' using errcode = '23514';
    end if;
    new.catalog_generation := 2;
    new.plan_variant := 'private_offer';
    new.variant_name := new.display_name;
    return new;
  end if;
  select plan.slug into v_slug from public.plans plan where plan.id = new.plan_id;
  new.catalog_generation := 2;
  if v_slug = 'solo' then
    new.catalog_generation := 3;
    new.plan_variant := case (new.resource_limits ->> 'active_members')::integer
      when 1 then 'solo_1' when 2 then 'solo_2' else null end;
    if new.plan_variant is null then
      raise exception 'SOLO_VARIANT_MEMBER_LIMIT_INVALID' using errcode = '23514';
    end if;
    new.variant_name := case new.plan_variant
      when 'solo_1' then 'Solo · 1 member' else 'Solo · 2 members' end;
  elsif v_slug = 'multi' then
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

create or replace function shop_private.current_plan_terms(
  p_plan_id uuid, p_at timestamptz default clock_timestamp()
) returns public.plan_catalog_terms
language sql stable security definer set search_path = '' as $$
  select terms.* from shop_private.current_plan_offers(p_plan_id, p_at) terms
  order by case terms.plan_variant
      when 'solo_1' then 1 when 'solo_2' then 2 when 'standard' then 1 when 'multi_2' then 2 when 'multi_3' then 3 else 9 end,
    case terms.billing_interval when 'monthly' then 1 when 'annual' then 2 else 9 end
  limit 1;
$$;

create or replace function public.submit_shop_billing_notice(
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
      case terms.plan_variant when 'solo_1' then 1 when 'solo_2' then 2 when 'standard' then 1 when 'multi_2' then 2 when 'multi_3' then 3 else 9 end,
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

with offers(ordinal, members, billing_interval, price_amount) as (values
  (1, 1, 'monthly', 349.00::numeric),
  (2, 1, 'annual', 2847.84::numeric),
  (3, 2, 'monthly', 499.00::numeric),
  (4, 2, 'annual', 4071.84::numeric)
), selected as (
  select plan.id plan_id, plan.is_public, plan.is_purchasable, offer.*,
    (select max(terms.version) from public.plan_catalog_terms terms
      where terms.plan_id = plan.id) base_version
  from offers offer
  join public.portals portal on portal.key = 'shop-crm'
  join public.plans plan on plan.portal_id = portal.id and plan.slug = 'solo'
)
insert into public.plan_catalog_terms (
  plan_id, version, display_name, billing_interval, currency, price_amount,
  trial_days, resource_limits, is_public, is_purchasable, effective_from,
  catalog_generation, plan_variant, variant_name
)
select plan_id, base_version + ordinal, 'Solo', billing_interval, 'EGP', price_amount,
  7, jsonb_build_object('active_locations', 1, 'active_members', members,
    'active_products', 250, 'active_services', 50,
    'active_customers', 500, 'active_suppliers', 50),
  is_public, is_purchasable, clock_timestamp(), 3, 'solo_' || members,
  case members when 1 then 'Solo · 1 member' else 'Solo · 2 members' end
from selected;

-- Family headline metadata follows Solo 1; reconciliation never reverts it.
create or replace function shop_private.reconcile_plan_catalog_v2()
returns void language plpgsql security definer set search_path = '' as $$
declare v_portal_id uuid;
begin
  select portal.id into v_portal_id
  from public.portals portal where portal.key = 'shop-crm';
  if v_portal_id is null then return; end if;

  update public.plans plan set
    price_amount = case plan.slug
      when 'solo' then 349 when 'team' then 699 when 'multi' then 999 end,
    billing_interval = 'monthly', trial_days = 7,
    resource_limits = case plan.slug
      when 'solo' then '{"active_locations":1,"active_members":1,"active_products":250,"active_services":50,"active_customers":500,"active_suppliers":50}'::jsonb
      when 'team' then '{"active_locations":1,"active_members":8,"active_products":500,"active_services":100,"active_customers":2000,"active_suppliers":150}'::jsonb
      when 'multi' then '{"active_locations":2,"active_members":16,"active_products":1000,"active_services":200,"active_customers":5000,"active_suppliers":300}'::jsonb
    end,
    features = case plan.slug
      when 'solo' then '{"inventory":true,"max_locations":1,"max_members":1,"max_products":250,"max_services":50,"max_customers":500,"max_suppliers":50}'::jsonb
      when 'team' then '{"inventory":true,"max_locations":1,"max_members":8,"max_products":500,"max_services":100,"max_customers":2000,"max_suppliers":150}'::jsonb
      when 'multi' then '{"inventory":true,"max_locations":2,"max_members":16,"max_products":1000,"max_services":200,"max_customers":5000,"max_suppliers":300}'::jsonb
    end,
    is_active = true, is_public = true, is_purchasable = true,
    is_coming_soon = false,
    catalog_version = (select max(terms.version)
      from public.plan_catalog_terms terms where terms.plan_id = plan.id),
    updated_at = now()
  where plan.portal_id = v_portal_id and plan.slug in ('solo', 'team', 'multi');
end;
$$;

-- Exact-term offers remain authoritative for historical and current subscriptions.
update public.plans plan set
  resource_limits = jsonb_set(plan.resource_limits, '{active_members}', '1'::jsonb),
  features = jsonb_set(plan.features, '{max_members}', '1'::jsonb),
  catalog_version = (
  select max(terms.version) from public.plan_catalog_terms terms where terms.plan_id = plan.id
)
from public.portals portal
where portal.id = plan.portal_id and portal.key = 'shop-crm' and plan.slug = 'solo';
