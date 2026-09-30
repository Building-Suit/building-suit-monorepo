-- SS-PLAN-ADMIN-001: bounded plan-catalog and customer-subscription controls.
-- Catalog versions, price changes, and removals are append-only so an already
-- approved commercial period can never be silently rewritten.

create table public.platform_plan_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  actor_role text not null check (actor_role = 'operator'),
  action text not null check (action in (
    'publish_terms', 'set_availability', 'change_subscription',
    'renew_subscription', 'suspend_subscription',
    'set_price_override', 'remove_price_override'
  )),
  plan_id uuid references public.plans (id) on delete restrict,
  shop_id uuid references public.shops (id) on delete restrict,
  subscription_id uuid references public.subscriptions (id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 2 and 1000),
  parameters jsonb not null check (jsonb_typeof(parameters) = 'object'),
  before_state jsonb,
  after_state jsonb not null,
  occurred_at timestamptz not null default clock_timestamp()
);

create index platform_plan_events_time_idx
  on public.platform_plan_events (occurred_at desc, id desc);
create index platform_plan_events_shop_time_idx
  on public.platform_plan_events (shop_id, occurred_at desc, id desc)
  where shop_id is not null;

create table public.subscription_price_override_revocations (
  id uuid primary key default gen_random_uuid(),
  price_override_id uuid not null unique
    references public.subscription_price_overrides (id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 2 and 1000),
  effective_at timestamptz not null default clock_timestamp(),
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default clock_timestamp()
);

create table public.subscription_plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete restrict,
  from_plan_id uuid not null references public.plans (id) on delete restrict,
  from_catalog_terms_id uuid not null references public.plan_catalog_terms (id) on delete restrict,
  to_plan_id uuid not null references public.plans (id) on delete restrict,
  to_catalog_terms_id uuid not null references public.plan_catalog_terms (id) on delete restrict,
  effective_at timestamptz not null,
  reason text not null check (length(btrim(reason)) between 2 and 1000),
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  check (to_plan_id <> from_plan_id or to_catalog_terms_id <> from_catalog_terms_id)
);

create index subscription_plan_change_requests_pending_idx
  on public.subscription_plan_change_requests
  (subscription_id, effective_at desc, created_at desc);

alter table public.platform_plan_events enable row level security;
alter table public.subscription_price_override_revocations enable row level security;
alter table public.subscription_plan_change_requests enable row level security;
revoke all on public.platform_plan_events,
  public.subscription_price_override_revocations,
  public.subscription_plan_change_requests from public, anon, authenticated;
grant all on public.platform_plan_events,
  public.subscription_price_override_revocations,
  public.subscription_plan_change_requests to service_role;

create trigger platform_plan_events_immutable
before update or delete or truncate on public.platform_plan_events
for each statement execute function shop_private.preserve_platform_admin_event();
create trigger subscription_price_override_revocations_immutable
before update or delete or truncate on public.subscription_price_override_revocations
for each statement execute function shop_private.reject_commercial_snapshot_mutation();
create trigger subscription_plan_change_requests_immutable
before update or delete or truncate on public.subscription_plan_change_requests
for each statement execute function shop_private.reject_commercial_snapshot_mutation();

-- A referenced catalog plan can be retired but never deleted.
create function shop_private.prevent_referenced_plan_deletion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.subscriptions subscription where subscription.plan_id = old.id)
    or exists (select 1 from public.plan_catalog_terms terms where terms.plan_id = old.id)
    or exists (select 1 from public.shop_billing_submissions submission where submission.plan_id = old.id) then
    raise exception 'HISTORICAL_PLAN_DELETE_FORBIDDEN' using errcode = '55000';
  end if;
  return old;
end;
$$;

create trigger plans_preserve_history
before delete on public.plans for each row
execute function shop_private.prevent_referenced_plan_deletion();

create function shop_private.current_plan_terms(
  p_plan_id uuid, p_at timestamptz default clock_timestamp()
) returns public.plan_catalog_terms
language sql stable security definer set search_path = '' as $$
  select terms.* from public.plan_catalog_terms terms
  where terms.plan_id = p_plan_id and terms.effective_from <= p_at
  order by terms.effective_from desc, terms.version desc, terms.id desc limit 1;
$$;

create function shop_private.plan_is_downgrade(p_current jsonb, p_target jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select exists (
    select 1 from unnest(array[
      'active_locations', 'active_members', 'active_products', 'active_services'
    ]) resource
    where (p_target ->> resource)::integer is not null
      and ((p_current ->> resource)::integer is null
        or (p_target ->> resource)::integer < (p_current ->> resource)::integer)
  );
$$;

-- Revocation is an append-only event. Previous override rows remain intact.
create or replace function shop_private.subscription_effective_price(
  p_subscription_id uuid,
  p_catalog_terms_id uuid,
  p_at timestamptz default clock_timestamp()
) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'listPriceAmount', terms.price_amount,
    'effectivePriceAmount', coalesce(price_override.amount, terms.price_amount),
    'currency', terms.currency,
    'priceSource', case when price_override.id is null then 'catalog' else 'override' end,
    'priceOverrideId', price_override.id,
    'priceOverrideReason', price_override.reason,
    'priceOverrideEffectiveFrom', price_override.effective_from,
    'priceOverrideExpiresAt', price_override.expires_at
  )
  from public.plan_catalog_terms terms
  left join lateral (
    select price.id, price.amount, price.reason, price.effective_from, price.expires_at
    from public.subscription_price_overrides price
    where price.subscription_id = p_subscription_id
      and price.currency = terms.currency
      and price.effective_from <= p_at
      and (price.expires_at is null or price.expires_at > p_at)
      and not exists (
        select 1 from public.subscription_price_override_revocations revocation
        where revocation.price_override_id = price.id
          and revocation.effective_at <= p_at
      )
    order by price.effective_from desc, price.created_at desc, price.id desc
    limit 1
  ) price_override on true
  where terms.id = p_catalog_terms_id;
$$;

create function shop_private.billing_notice_effective_terms()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_terms public.plan_catalog_terms; v_subscription_id uuid; v_quote jsonb;
begin
  if new.plan_id is null then
    select subscription.plan_id, subscription.id into new.plan_id, v_subscription_id
    from public.shop_memberships membership
    join public.subscriptions subscription on subscription.profile_id = membership.profile_id
    where membership.shop_id = new.shop_id and membership.role = 'owner'
    order by (membership.status = 'active') desc, membership.created_at, membership.id limit 1;
  else
    select subscription.id into v_subscription_id
    from public.shop_memberships membership
    join public.subscriptions subscription on subscription.profile_id = membership.profile_id
    where membership.shop_id = new.shop_id and membership.role = 'owner'
    order by (membership.status = 'active') desc, membership.created_at, membership.id limit 1;
  end if;
  if new.catalog_terms_id is null or exists (
    select 1 from public.plan_catalog_terms future
    where future.id = new.catalog_terms_id and future.effective_from > clock_timestamp()
  ) then
    select * into v_terms from shop_private.current_plan_terms(new.plan_id);
    if v_terms.id is null then
      raise exception 'PLAN_COMMERCIAL_TERMS_NOT_FOUND' using errcode = '23503';
    end if;
    v_quote := shop_private.subscription_effective_price(
      v_subscription_id, v_terms.id, clock_timestamp()
    );
    new.catalog_terms_id := v_terms.id;
    new.plan_slug_snapshot := (select plan.slug from public.plans plan where plan.id = new.plan_id);
    new.plan_name_snapshot := v_terms.display_name;
    new.billing_interval_snapshot := v_terms.billing_interval;
    new.resource_limits_snapshot := v_terms.resource_limits;
    new.list_price_amount := (v_quote ->> 'listPriceAmount')::numeric;
    new.effective_price_amount := (v_quote ->> 'effectivePriceAmount')::numeric;
    new.expected_amount := (v_quote ->> 'effectivePriceAmount')::numeric;
    new.currency := v_terms.currency;
    new.price_override_id := nullif(v_quote ->> 'priceOverrideId', '')::uuid;
    new.price_source := v_quote ->> 'priceSource';
    new.quoted_at := clock_timestamp();
  end if;
  return new;
end;
$$;

create trigger shop_billing_00_effective_terms
before insert on public.shop_billing_submissions
for each row execute function shop_private.billing_notice_effective_terms();

-- The public catalog resolves the commercial version at read time. Future
-- versions therefore do not leak early and need no destructive in-place edit.
create function public.shop_public_plan_catalog()
returns table (
  id uuid, name text, slug text, price_amount integer, currency text,
  billing_interval text, trial_days integer, features jsonb,
  resource_limits jsonb, is_purchasable boolean, is_coming_soon boolean
) language sql stable security definer set search_path = '' as $$
  select plan.id, terms.display_name, plan.slug, terms.price_amount,
    terms.currency, terms.billing_interval, terms.trial_days, plan.features,
    terms.resource_limits, plan.is_purchasable, plan.is_coming_soon
  from public.plans plan
  join public.portals portal on portal.id = plan.portal_id
  cross join lateral shop_private.current_plan_terms(plan.id) terms
  where portal.key = 'shop-crm' and portal.is_active
    and plan.is_active and plan.is_public and plan.is_purchasable
    and not plan.is_coming_soon
  order by plan.sort_order, plan.slug;
$$;

create function shop_private.platform_plan_subscription_snapshot(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_snapshot jsonb := shop_private.billing_subscription_snapshot(p_shop_id);
  v_subscription_id uuid; v_due record; v_quote jsonb;
begin
  if v_snapshot is null then return null; end if;
  v_subscription_id := (v_snapshot ->> 'id')::uuid;
  select request.id, request.to_plan_id, request.to_catalog_terms_id,
    request.effective_at, plan.slug, terms.display_name,
    terms.billing_interval, terms.currency, terms.resource_limits
  into v_due
  from public.subscription_plan_change_requests request
  join public.plans plan on plan.id = request.to_plan_id
  join public.plan_catalog_terms terms on terms.id = request.to_catalog_terms_id
  where request.subscription_id = v_subscription_id
    and request.effective_at <= clock_timestamp()
    and exists (select 1 from public.subscriptions current_subscription
      where current_subscription.id = v_subscription_id
        and current_subscription.plan_id = request.from_plan_id
        and current_subscription.catalog_terms_id = request.from_catalog_terms_id)
  order by request.created_at desc, request.id desc limit 1;
  if found then
    v_quote := shop_private.subscription_effective_price(
      v_subscription_id, v_due.to_catalog_terms_id, clock_timestamp()
    );
    v_snapshot := v_snapshot || jsonb_build_object(
      'planId', v_due.to_plan_id, 'planSlug', v_due.slug,
      'planName', v_due.display_name, 'billingInterval', v_due.billing_interval,
      'currency', v_due.currency, 'resourceLimits', v_due.resource_limits,
      'listPriceAmount', (v_quote ->> 'listPriceAmount')::numeric,
      'effectivePriceAmount', (v_quote ->> 'effectivePriceAmount')::numeric,
      'priceSource', v_quote ->> 'priceSource',
      'priceOverrideId', v_quote ->> 'priceOverrideId'
    );
  end if;
  return v_snapshot || jsonb_build_object(
    'usage', shop_private.plan_usage_snapshot(p_shop_id),
    'pendingBillingRequests', (
      select count(*)::integer from public.shop_billing_submissions request
      where request.shop_id = p_shop_id and request.status in ('submitted', 'under_review')
    ),
    'pendingPlanChange', (
      select jsonb_build_object(
        'id', request.id, 'targetPlanId', request.to_plan_id,
        'targetPlanSlug', plan.slug, 'targetPlanName', terms.display_name,
        'effectiveAt', request.effective_at, 'reason', request.reason,
        'createdAt', request.created_at
      )
      from public.subscription_plan_change_requests request
      join public.plans plan on plan.id = request.to_plan_id
      join public.plan_catalog_terms terms on terms.id = request.to_catalog_terms_id
      where request.subscription_id = v_subscription_id
        and request.effective_at > clock_timestamp()
        and exists (select 1 from public.subscriptions current_subscription
          where current_subscription.id = v_subscription_id
            and current_subscription.plan_id = request.from_plan_id
            and current_subscription.catalog_terms_id = request.from_catalog_terms_id)
      order by request.created_at desc, request.id desc limit 1
    )
  );
end;
$$;

-- A scheduled downgrade becomes the effective entitlement at its boundary
-- without rewriting the original subscription or deleting over-limit data.
create or replace function shop_private.resolve_plan_entitlement(p_shop_id uuid)
returns table (
  subscription_id uuid, plan_id uuid, plan_slug text, catalog_terms_id uuid,
  subscription_status text, access_state text, writes_allowed boolean,
  resource_limits jsonb
) language plpgsql stable security definer set search_path = '' as $$
begin
  if p_shop_id is null then raise exception 'SHOP_ID_REQUIRED' using errcode = '22023'; end if;
  return query
  select subscription.id, coalesce(change.to_plan_id, plan.id),
    coalesce(target_plan.slug, plan.slug),
    coalesce(change.to_catalog_terms_id, terms.id), subscription.status,
    case when shop.status = 'suspended' then 'suspended'
      when subscription.status = 'trialing' and subscription.trial_end_at > now() then 'trialing'
      when subscription.status = 'active' and subscription.current_period_end > now() then 'active'
      else 'read_only' end,
    shop.status = 'active' and (
      (subscription.status = 'trialing' and subscription.trial_end_at > now())
      or (subscription.status = 'active' and subscription.current_period_end > now())
    ), coalesce(target_terms.resource_limits, terms.resource_limits)
  from public.shops shop
  join public.shop_memberships membership on membership.shop_id = shop.id and membership.role = 'owner'
  join public.subscriptions subscription on subscription.profile_id = membership.profile_id
  join public.plans plan on plan.id = subscription.plan_id
  join public.plan_catalog_terms terms on terms.id = subscription.catalog_terms_id
  left join lateral (
    select request.* from public.subscription_plan_change_requests request
    where request.subscription_id = subscription.id and request.effective_at <= clock_timestamp()
      and request.from_plan_id = subscription.plan_id
      and request.from_catalog_terms_id = subscription.catalog_terms_id
    order by request.created_at desc, request.id desc limit 1
  ) change on true
  left join public.plans target_plan on target_plan.id = change.to_plan_id
  left join public.plan_catalog_terms target_terms on target_terms.id = change.to_catalog_terms_id
  where shop.id = p_shop_id
  order by (membership.status = 'active') desc, membership.created_at, membership.id limit 1;
end;
$$;

-- All entitlement assignment resolves the version that is effective now,
-- never merely the greatest scheduled version number.
create or replace function shop_private.subscription_catalog_terms()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_shop_id uuid; v_limits jsonb; v_limit integer; v_usage bigint; v_resource text;
  v_operator_approval boolean := false;
begin
  if tg_op = 'INSERT' and auth.uid() is not null and not exists (
    select 1 from public.plans plan
    where plan.id = new.plan_id and plan.is_active and plan.is_public
      and plan.is_purchasable and not plan.is_coming_soon
  ) then
    raise exception 'PLAN_UNAVAILABLE' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    v_operator_approval := current_setting('shop.billing_approval', true) = 'approved'
      and exists (select 1 from public.platform_admins administrator
        where administrator.user_id = auth.uid() and administrator.enabled
          and administrator.role = 'operator');
  end if;
  if tg_op = 'INSERT' or new.plan_id is distinct from old.plan_id
    or new.catalog_terms_id is null then
    if new.catalog_terms_id is not null then
      select terms.resource_limits into v_limits
      from public.plan_catalog_terms terms
      where terms.id = new.catalog_terms_id and terms.plan_id = new.plan_id
        and terms.effective_from <= clock_timestamp();
    end if;
    if v_limits is null then
      select terms.id, terms.resource_limits into new.catalog_terms_id, v_limits
      from shop_private.current_plan_terms(new.plan_id) terms;
    end if;
    if new.catalog_terms_id is null or v_limits is null then
      raise exception 'PLAN_COMMERCIAL_TERMS_NOT_FOUND' using errcode = '23503';
    end if;
  else
    select terms.resource_limits into v_limits
    from public.plan_catalog_terms terms
    where terms.id = new.catalog_terms_id and terms.plan_id = new.plan_id;
  end if;
  if tg_op = 'UPDATE' and old.catalog_terms_id is not null
    and new.catalog_terms_id is distinct from old.catalog_terms_id
    and new.plan_id = old.plan_id and not v_operator_approval then
    raise exception 'SUBSCRIPTION_TERMS_CHANGE_REQUIRES_PLAN_CHANGE' using errcode = '23514';
  end if;
  select membership.shop_id into v_shop_id
  from public.shop_memberships membership
  where membership.profile_id = new.profile_id and membership.role = 'owner'
  order by (membership.status = 'active') desc, membership.created_at, membership.id limit 1;
  if v_shop_id is not null and (
    tg_op = 'INSERT' or new.plan_id is distinct from old.plan_id
      or new.catalog_terms_id is distinct from old.catalog_terms_id
  ) then
    perform shop_private.lock_all_plan_resources(v_shop_id);
    foreach v_resource in array array[
      'active_locations', 'active_members', 'active_products', 'active_services'
    ] loop
      v_limit := (v_limits ->> v_resource)::integer;
      if v_limit is not null then
        v_usage := shop_private.plan_resource_usage(v_shop_id, v_resource);
        if v_usage > v_limit then
          raise exception 'PLAN_RESOURCE_LIMIT_EXCEEDED:%:%:%',
            v_resource, v_usage, v_limit using errcode = '23514';
        end if;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create or replace function public.shop_plan_change_validation(
  p_shop_id uuid, p_target_plan_slug text
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_target_limits jsonb; v_target_plan_id uuid; v_blockers jsonb;
begin
  if not shop_private.is_owner(p_shop_id) then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  select plan.id, terms.resource_limits into v_target_plan_id, v_target_limits
  from public.plans plan
  join public.portals portal on portal.id = plan.portal_id
  cross join lateral shop_private.current_plan_terms(plan.id) terms
  where portal.key = 'shop-crm' and plan.slug = p_target_plan_slug
    and plan.is_active and not plan.is_coming_soon;
  if v_target_plan_id is null then raise exception 'PLAN_UNAVAILABLE' using errcode = '22023'; end if;
  v_blockers := shop_private.plan_change_blockers(p_shop_id, v_target_limits);
  return jsonb_build_object(
    'shopId', p_shop_id, 'targetPlanId', v_target_plan_id,
    'targetPlanSlug', p_target_plan_slug,
    'canApply', jsonb_array_length(v_blockers) = 0,
    'blockers', v_blockers, 'mutated', false
  );
end;
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
      'catalogTermsId', terms.id, 'billingInterval', terms.billing_interval,
      'currency', terms.currency,
      'listPriceAmount', (price.quote ->> 'listPriceAmount')::numeric,
      'effectivePriceAmount', (price.quote ->> 'effectivePriceAmount')::numeric,
      'priceSource', price.quote ->> 'priceSource',
      'resourceLimits', terms.resource_limits,
      'blockers', shop_private.plan_change_blockers(p_shop_id, terms.resource_limits)
    ) order by plan.sort_order, plan.slug), '[]'::jsonb)
    from public.plans plan
    join public.portals portal on portal.id = plan.portal_id
    join lateral (
      select catalog.* from public.plan_catalog_terms catalog
      where catalog.id = case when plan.id = (v_subscription ->> 'planId')::uuid
        then (select subscription.catalog_terms_id from public.subscriptions subscription
          where subscription.id = v_subscription_id)
        else (select current_terms.id from shop_private.current_plan_terms(plan.id) current_terms)
      end
    ) terms on true
    cross join lateral (select shop_private.subscription_effective_price(
      v_subscription_id, terms.id, clock_timestamp()) quote) price
    where portal.key = 'shop-crm' and (
      plan.id = (v_subscription ->> 'planId')::uuid
      or (plan.is_active and plan.is_public and plan.is_purchasable and not plan.is_coming_soon)
    )),
    'instructions', jsonb_build_object(
      'recipientAlias', configuration.recipient_alias,
      'paymentLink', configuration.payment_link,
      'qrImageUrl', configuration.qr_image_url,
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
      'billingInterval', submission.billing_interval_snapshot,
      'listPriceAmount', submission.list_price_amount,
      'effectivePriceAmount', submission.effective_price_amount,
      'priceSource', submission.price_source,
      'expectedAmount', submission.expected_amount,
      'paidAmount', submission.paid_amount, 'currency', submission.currency,
      'transferDate', submission.transfer_date,
      'transferReference', submission.transfer_reference,
      'reviewReason', submission.review_reason,
      'receivedAmount', submission.received_amount,
      'receivedReference', submission.received_reference,
      'receivedDate', submission.received_date,
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

create function public.platform_plan_read(
  p_resource text default 'catalog', p_shop_id uuid default null,
  p_page integer default 1, p_page_size integer default 50
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform shop_private.assert_platform_admin(false);
  if p_resource not in ('catalog', 'shop', 'audit')
    or (p_resource = 'shop' and p_shop_id is null)
    or p_page is null or p_page < 1 or p_page > 100000
    or p_page_size is null or p_page_size < 1 or p_page_size > 100 then
    raise exception 'PLATFORM_PLAN_READ_INVALID' using errcode = '22023';
  end if;

  if p_resource = 'catalog' then
    select jsonb_build_object('items', coalesce(jsonb_agg(jsonb_build_object(
      'id', plan.id, 'slug', plan.slug, 'name', current_terms.display_name,
      'isActive', plan.is_active, 'isPublic', plan.is_public,
      'isPurchasable', plan.is_purchasable, 'isComingSoon', plan.is_coming_soon,
      'catalogVersion', current_terms.version,
      'priceAmount', current_terms.price_amount, 'currency', current_terms.currency,
      'billingInterval', current_terms.billing_interval,
      'resourceLimits', current_terms.resource_limits,
      'effectiveFrom', current_terms.effective_from,
      'nextTerms', case when next_terms.id is null then null else jsonb_build_object(
        'version', next_terms.version, 'priceAmount', next_terms.price_amount,
        'currency', next_terms.currency, 'billingInterval', next_terms.billing_interval,
        'resourceLimits', next_terms.resource_limits,
        'effectiveFrom', next_terms.effective_from
      ) end,
      'subscriptionCount', (select count(*)::integer from public.subscriptions s where s.plan_id = plan.id),
      'canDelete', false
    ) order by plan.sort_order, plan.slug), '[]'::jsonb)) into v_result
    from public.plans plan
    join public.portals portal on portal.id = plan.portal_id and portal.key = 'shop-crm'
    cross join lateral shop_private.current_plan_terms(plan.id) current_terms
    left join lateral (
      select future.* from public.plan_catalog_terms future
      where future.plan_id = plan.id and future.effective_from > clock_timestamp()
      order by future.effective_from, future.version limit 1
    ) next_terms on true;
  elsif p_resource = 'shop' then
    if not exists (select 1 from public.shops shop where shop.id = p_shop_id) then
      raise exception 'PLATFORM_ADMIN_TARGET_NOT_FOUND' using errcode = '22023';
    end if;
    select jsonb_build_object(
      'subscription', shop_private.platform_plan_subscription_snapshot(p_shop_id),
      'availablePlans', coalesce(jsonb_agg(jsonb_build_object(
        'planId', plan.id, 'planSlug', plan.slug, 'planName', terms.display_name,
        'catalogTermsId', terms.id, 'billingInterval', terms.billing_interval,
        'currency', terms.currency, 'listPriceAmount', terms.price_amount,
        'resourceLimits', terms.resource_limits,
        'blockers', shop_private.plan_change_blockers(p_shop_id, terms.resource_limits)
      ) order by plan.sort_order, plan.slug), '[]'::jsonb)
    ) into v_result
    from public.plans plan
    join public.portals portal on portal.id = plan.portal_id and portal.key = 'shop-crm'
    cross join lateral shop_private.current_plan_terms(plan.id) terms
    where plan.is_active and not plan.is_coming_soon;
  else
    with rows as (
      select event.id, event.action, event.plan_id as "planId",
        event.shop_id as "shopId", shop.name as "shopName",
        event.actor_user_id as "actorUserId", event.reason,
        event.before_state as "beforeState", event.after_state as "afterState",
        event.occurred_at as "occurredAt"
      from public.platform_plan_events event
      left join public.shops shop on shop.id = event.shop_id
    ), page_rows as (
      select * from rows order by "occurredAt" desc, id
      limit p_page_size offset (p_page - 1) * p_page_size
    ) select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(row)) from page_rows row), '[]'::jsonb),
      'total', (select count(*)::integer from rows),
      'page', p_page, 'pageSize', p_page_size
    ) into v_result;
  end if;
  return v_result;
end;
$$;

create function public.platform_plan_command(
  p_request_id uuid, p_action text, p_reason text,
  p_plan_id uuid default null, p_shop_id uuid default null,
  p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text; v_prior public.platform_plan_events; v_parameters jsonb;
  v_before jsonb; v_after jsonb; v_event_id uuid;
  v_plan public.plans; v_terms public.plan_catalog_terms; v_new_terms public.plan_catalog_terms;
  v_subscription public.subscriptions; v_current_terms public.plan_catalog_terms;
  v_subscription_id uuid; v_version integer; v_effective_at timestamptz;
  v_limits jsonb; v_blockers jsonb; v_timing text; v_downgrade boolean;
  v_end timestamptz; v_override_id uuid; v_amount numeric(12,2); v_currency text;
begin
  v_role := shop_private.assert_platform_admin(true);
  p_payload := coalesce(p_payload, '{}'::jsonb);
  if p_request_id is null
    or p_action not in ('publish_terms', 'set_availability', 'change_subscription',
      'renew_subscription', 'suspend_subscription', 'set_price_override', 'remove_price_override')
    or p_reason is null or length(btrim(p_reason)) not between 2 and 1000
    or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 8192
    or (p_action in ('publish_terms', 'set_availability') and (p_plan_id is null or p_shop_id is not null))
    or (p_action not in ('publish_terms', 'set_availability') and p_shop_id is null) then
    raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
  end if;
  v_parameters := jsonb_build_object(
    'action', p_action, 'planId', p_plan_id, 'shopId', p_shop_id, 'payload', p_payload
  );
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_prior from public.platform_plan_events event where event.request_id = p_request_id;
  if found then
    if v_prior.actor_user_id <> auth.uid() or v_prior.action <> p_action
      or v_prior.reason <> btrim(p_reason) or v_prior.parameters is distinct from v_parameters then
      raise exception 'PLATFORM_PLAN_COMMAND_KEY_REUSED' using errcode = '22023';
    end if;
    return jsonb_build_object('data', v_prior.after_state, 'replayed', true, 'auditId', v_prior.id);
  end if;

  if p_action in ('publish_terms', 'set_availability') then
    select * into v_plan from public.plans plan where plan.id = p_plan_id for update;
    if not found then raise exception 'PLATFORM_ADMIN_PLAN_NOT_FOUND' using errcode = '22023'; end if;
    select * into v_terms from shop_private.current_plan_terms(p_plan_id);
    v_before := jsonb_build_object('plan', to_jsonb(v_plan), 'terms', to_jsonb(v_terms));
    if p_action = 'set_availability' then
      if (p_payload - array['isActive','isPublic','isPurchasable','isComingSoon']) <> '{}'::jsonb
        or jsonb_typeof(p_payload -> 'isActive') <> 'boolean'
        or jsonb_typeof(p_payload -> 'isPublic') <> 'boolean'
        or jsonb_typeof(p_payload -> 'isPurchasable') <> 'boolean'
        or jsonb_typeof(p_payload -> 'isComingSoon') <> 'boolean'
        or ((p_payload ->> 'isPurchasable')::boolean and not (p_payload ->> 'isPublic')::boolean) then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      update public.plans set
        is_active = (p_payload ->> 'isActive')::boolean,
        is_public = (p_payload ->> 'isPublic')::boolean,
        is_purchasable = (p_payload ->> 'isPurchasable')::boolean,
        is_coming_soon = (p_payload ->> 'isComingSoon')::boolean,
        updated_at = now() where id = p_plan_id returning * into v_plan;
      v_after := jsonb_build_object('plan', to_jsonb(v_plan), 'terms', to_jsonb(v_terms));
    else
      if (p_payload - array['displayName','billingInterval','currency','priceAmount','resourceLimits','effectiveFrom']) <> '{}'::jsonb
        or jsonb_typeof(p_payload -> 'displayName') <> 'string'
        or jsonb_typeof(p_payload -> 'billingInterval') <> 'string'
        or jsonb_typeof(p_payload -> 'currency') <> 'string'
        or jsonb_typeof(p_payload -> 'priceAmount') <> 'number'
        or jsonb_typeof(p_payload -> 'resourceLimits') <> 'object'
        or jsonb_typeof(p_payload -> 'effectiveFrom') <> 'string' then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      begin
        v_effective_at := (p_payload ->> 'effectiveFrom')::timestamptz;
      exception when others then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end;
      v_limits := p_payload -> 'resourceLimits';
      if length(btrim(p_payload ->> 'displayName')) not between 1 and 120
        or p_payload ->> 'billingInterval' not in ('monthly','quarterly','annual')
        or upper(btrim(p_payload ->> 'currency')) !~ '^[A-Z]{3}$'
        or (p_payload ->> 'priceAmount')::numeric < 0
        or (p_payload ->> 'priceAmount')::numeric <> trunc((p_payload ->> 'priceAmount')::numeric)
        or not shop_private.valid_resource_limits(v_limits)
        or v_effective_at < clock_timestamp() - interval '5 minutes' then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      select coalesce(max(terms.version), 0) + 1 into v_version
      from public.plan_catalog_terms terms where terms.plan_id = p_plan_id;
      insert into public.plan_catalog_terms (
        plan_id, version, display_name, billing_interval, currency, price_amount,
        trial_days, resource_limits, is_public, is_purchasable, effective_from
      ) values (
        p_plan_id, v_version, btrim(p_payload ->> 'displayName'),
        p_payload ->> 'billingInterval', upper(btrim(p_payload ->> 'currency')),
        (p_payload ->> 'priceAmount')::integer, 14, v_limits,
        v_plan.is_public, v_plan.is_purchasable, v_effective_at
      ) returning * into v_new_terms;
      if v_effective_at <= clock_timestamp() then
        update public.plans set name = v_new_terms.display_name,
          price_amount = v_new_terms.price_amount, currency = v_new_terms.currency,
          billing_interval = v_new_terms.billing_interval,
          resource_limits = v_new_terms.resource_limits,
          catalog_version = v_new_terms.version, updated_at = now()
        where id = p_plan_id returning * into v_plan;
      end if;
      v_after := jsonb_build_object('plan', to_jsonb(v_plan), 'terms', to_jsonb(v_new_terms));
    end if;
  else
    perform 1 from public.shops shop where shop.id = p_shop_id for update;
    if not found then raise exception 'PLATFORM_ADMIN_TARGET_NOT_FOUND' using errcode = '22023'; end if;
    select subscription.* into v_subscription
    from public.shop_memberships membership
    join public.subscriptions subscription on subscription.profile_id = membership.profile_id
    where membership.shop_id = p_shop_id and membership.role = 'owner'
    order by (membership.status = 'active') desc, membership.created_at, membership.id
    limit 1 for update of subscription;
    if v_subscription.id is null then raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023'; end if;
    v_subscription_id := v_subscription.id;
    select * into v_current_terms from public.plan_catalog_terms terms
    where terms.id = v_subscription.catalog_terms_id;
    v_before := shop_private.platform_plan_subscription_snapshot(p_shop_id);

    if p_action = 'set_price_override' then
      if p_plan_id is not null
        or (p_payload - array['amount','currency','effectiveFrom','expiresAt']) <> '{}'::jsonb
        or jsonb_typeof(p_payload -> 'amount') <> 'number'
        or jsonb_typeof(p_payload -> 'currency') <> 'string'
        or jsonb_typeof(p_payload -> 'effectiveFrom') <> 'string'
        or (p_payload ? 'expiresAt' and p_payload -> 'expiresAt' <> 'null'::jsonb
          and jsonb_typeof(p_payload -> 'expiresAt') <> 'string') then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      begin
        v_amount := (p_payload ->> 'amount')::numeric;
        v_currency := upper(btrim(p_payload ->> 'currency'));
        v_effective_at := (p_payload ->> 'effectiveFrom')::timestamptz;
        v_end := nullif(p_payload ->> 'expiresAt', '')::timestamptz;
      exception when others then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end;
      if v_amount <= 0 or v_amount > 9999999999.99 or v_amount <> round(v_amount, 2)
        or v_currency !~ '^[A-Z]{3}$' or (v_end is not null and v_end <= v_effective_at) then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      insert into public.subscription_price_overrides (
        subscription_id, amount, currency, reason, effective_from, expires_at, created_by_user_id
      ) values (v_subscription.id, v_amount, v_currency, btrim(p_reason), v_effective_at, v_end, auth.uid())
      returning id into v_override_id;
    elsif p_action = 'remove_price_override' then
      if p_plan_id is not null or p_payload <> '{}'::jsonb then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      select nullif(quote ->> 'priceOverrideId', '')::uuid into v_override_id
      from (select shop_private.subscription_effective_price(
        v_subscription.id, v_subscription.catalog_terms_id, clock_timestamp()) quote) current_price;
      if v_override_id is null then raise exception 'PRICE_OVERRIDE_NOT_ACTIVE' using errcode = '22023'; end if;
      insert into public.subscription_price_override_revocations (
        price_override_id, reason, created_by_user_id
      ) values (v_override_id, btrim(p_reason), auth.uid());
    elsif p_action = 'suspend_subscription' then
      if p_plan_id is not null or p_payload <> '{}'::jsonb then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      update public.subscriptions set status = 'suspended', locked_at = clock_timestamp(), updated_at = now()
      where id = v_subscription.id;
    elsif p_action = 'renew_subscription' then
      if p_plan_id is not null or p_payload <> '{}'::jsonb then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      select * into v_terms from shop_private.current_plan_terms(v_subscription.plan_id);
      v_blockers := shop_private.plan_change_blockers(p_shop_id, v_terms.resource_limits);
      if jsonb_array_length(v_blockers) > 0 then
        raise exception 'PLAN_CHANGE_BLOCKED' using errcode = '23514', detail = v_blockers::text;
      end if;
      v_effective_at := greatest(coalesce(v_subscription.current_period_end, clock_timestamp()), clock_timestamp());
      v_end := v_effective_at + case v_terms.billing_interval
        when 'monthly' then interval '1 month' when 'quarterly' then interval '3 months'
        when 'annual' then interval '1 year' end;
      perform set_config('shop.billing_approval', 'approved', true);
      update public.subscriptions set catalog_terms_id = v_terms.id, status = 'active',
        current_period_start = case when current_period_end is null or current_period_end <= now()
          then now() else coalesce(current_period_start, now()) end,
        current_period_end = v_end, locked_at = null, updated_at = now()
      where id = v_subscription.id;
      p_plan_id := v_subscription.plan_id;
    else
      if p_plan_id is null
        or (p_payload - 'timing') <> '{}'::jsonb
        or jsonb_typeof(p_payload -> 'timing') <> 'string' then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      v_timing := p_payload ->> 'timing';
      if v_timing not in ('automatic','immediate','period_end') then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      select * into v_terms from shop_private.current_plan_terms(p_plan_id);
      select * into v_plan from public.plans plan where plan.id = p_plan_id
        and plan.is_active and not plan.is_coming_soon;
      if v_terms.id is null or v_plan.id is null then
        raise exception 'PLATFORM_ADMIN_PLAN_NOT_FOUND' using errcode = '22023';
      end if;
      v_blockers := shop_private.plan_change_blockers(p_shop_id, v_terms.resource_limits);
      if jsonb_array_length(v_blockers) > 0 then
        raise exception 'PLAN_CHANGE_BLOCKED' using errcode = '23514', detail = v_blockers::text;
      end if;
      v_downgrade := shop_private.plan_is_downgrade(v_current_terms.resource_limits, v_terms.resource_limits);
      if v_timing = 'period_end' or (v_timing = 'automatic' and v_downgrade
        and v_subscription.status = 'active' and v_subscription.current_period_end > now()) then
        v_effective_at := greatest(v_subscription.current_period_end, clock_timestamp());
        insert into public.subscription_plan_change_requests (
          subscription_id, from_plan_id, from_catalog_terms_id,
          to_plan_id, to_catalog_terms_id, effective_at, reason, created_by_user_id
        ) values (
          v_subscription.id, v_subscription.plan_id, v_subscription.catalog_terms_id,
          p_plan_id, v_terms.id, v_effective_at, btrim(p_reason), auth.uid()
        );
      else
        perform shop_private.lock_all_plan_resources(p_shop_id);
        perform set_config('shop.billing_approval', 'approved', true);
        v_effective_at := clock_timestamp();
        v_end := case when v_subscription.status = 'active' and v_subscription.current_period_end > now()
          then v_subscription.current_period_end
          else clock_timestamp() + case v_terms.billing_interval
            when 'monthly' then interval '1 month' when 'quarterly' then interval '3 months'
            when 'annual' then interval '1 year' end end;
        update public.subscriptions set plan_id = p_plan_id, catalog_terms_id = v_terms.id,
          status = 'active', current_period_start = case
            when status = 'active' and current_period_end > now() then current_period_start else now() end,
          current_period_end = v_end, locked_at = null, updated_at = now()
        where id = v_subscription.id;
      end if;
    end if;
    v_after := shop_private.platform_plan_subscription_snapshot(p_shop_id);
  end if;

  insert into public.platform_plan_events (
    request_id, actor_user_id, actor_role, action, plan_id, shop_id,
    subscription_id, reason, parameters, before_state, after_state
  ) values (
    p_request_id, auth.uid(), v_role, p_action, p_plan_id, p_shop_id,
    v_subscription_id, btrim(p_reason), v_parameters, v_before, v_after
  ) returning id into v_event_id;
  return jsonb_build_object('data', v_after, 'replayed', false, 'auditId', v_event_id);
end;
$$;

revoke all on function shop_private.prevent_referenced_plan_deletion(),
  shop_private.current_plan_terms(uuid, timestamptz),
  shop_private.plan_is_downgrade(jsonb, jsonb),
  shop_private.billing_notice_effective_terms(),
  shop_private.platform_plan_subscription_snapshot(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.shop_public_plan_catalog() from public, service_role;
grant execute on function public.shop_public_plan_catalog() to anon, authenticated;
revoke all on function public.platform_plan_read(text, uuid, integer, integer),
  public.platform_plan_command(uuid, text, text, uuid, uuid, jsonb)
from public, anon, service_role;
grant execute on function public.platform_plan_read(text, uuid, integer, integer),
  public.platform_plan_command(uuid, text, text, uuid, uuid, jsonb)
to authenticated;

notify pgrst, 'reload schema';
