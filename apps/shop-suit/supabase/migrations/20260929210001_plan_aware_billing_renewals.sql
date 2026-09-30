-- SS-PLAN-BILLING-001: plan-bound manual-transfer quotes, interval renewals,
-- explicit amount-mismatch evidence, and append-only negotiated pricing.

create table public.subscription_price_overrides (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reason text not null check (length(btrim(reason)) between 2 and 1000),
  effective_from timestamptz not null,
  expires_at timestamptz,
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  check (expires_at is null or expires_at > effective_from)
);

create index subscription_price_overrides_effective_idx
  on public.subscription_price_overrides
  (subscription_id, currency, effective_from desc, created_at desc);

alter table public.subscription_price_overrides enable row level security;
revoke all on public.subscription_price_overrides from public, anon, authenticated;
grant all on public.subscription_price_overrides to service_role;
create trigger subscription_price_overrides_immutable
before update or delete or truncate on public.subscription_price_overrides
for each statement execute function shop_private.reject_commercial_snapshot_mutation();

alter table public.shop_billing_submissions
  add column list_price_amount numeric(12, 2),
  add column effective_price_amount numeric(12, 2),
  add column price_override_id uuid references public.subscription_price_overrides (id) on delete restrict,
  add column price_source text,
  add column quoted_at timestamptz;

update public.shop_billing_submissions set
  list_price_amount = expected_amount,
  effective_price_amount = expected_amount,
  price_source = 'catalog',
  quoted_at = submitted_at
where catalog_terms_id is not null;

alter table public.shop_billing_submissions
  add constraint shop_billing_price_snapshot_complete check (
    (catalog_terms_id is null and list_price_amount is null
      and effective_price_amount is null and price_source is null and quoted_at is null)
    or
    (catalog_terms_id is not null and list_price_amount is not null
      and effective_price_amount is not null and price_source in ('catalog', 'override')
      and quoted_at is not null
      and ((price_source = 'catalog' and price_override_id is null)
        or (price_source = 'override' and price_override_id is not null)))
  ),
  add constraint shop_billing_list_price_nonnegative check (list_price_amount is null or list_price_amount >= 0),
  add constraint shop_billing_effective_price_nonnegative check (effective_price_amount is null or effective_price_amount >= 0);

alter table public.subscription_commercial_periods
  alter column price_amount type numeric(12, 2) using price_amount::numeric(12, 2),
  add column list_price_amount numeric(12, 2),
  add column price_override_id uuid references public.subscription_price_overrides (id) on delete restrict;
-- Suspend only the historical mutation guard for this additive snapshot backfill.
alter table public.subscription_commercial_periods
  disable trigger subscription_commercial_periods_immutable;
update public.subscription_commercial_periods
set list_price_amount = price_amount where list_price_amount is null;
alter table public.subscription_commercial_periods
  enable trigger subscription_commercial_periods_immutable;
alter table public.subscription_commercial_periods
  alter column list_price_amount set not null;

alter table public.platform_billing_events drop constraint platform_billing_events_action_check;
alter table public.platform_billing_events add constraint platform_billing_events_action_check
  check (action in (
    'configure_instructions', 'mark_under_review', 'approve', 'reject',
    'set_price_override'
  ));

create function shop_private.subscription_effective_price(
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
    order by price.effective_from desc, price.created_at desc, price.id desc
    limit 1
  ) price_override on true
  where terms.id = p_catalog_terms_id;
$$;

create function shop_private.plan_change_blockers(
  p_shop_id uuid,
  p_resource_limits jsonb
) returns jsonb language sql stable security definer set search_path = '' as $$
  with resources(resource, ordinal) as (values
    ('active_locations'::text, 1), ('active_members', 2),
    ('active_products', 3), ('active_services', 4)
  ), impacts as (
    select resource, ordinal,
      shop_private.plan_resource_usage(p_shop_id, resource) used_value,
      (p_resource_limits ->> resource)::integer limit_value
    from resources
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'resource', resource, 'used', used_value, 'limit', limit_value,
    'excess', used_value - limit_value
  ) order by ordinal) filter (
    where limit_value is not null and used_value > limit_value
  ), '[]'::jsonb)
  from impacts;
$$;

-- Preserve the exact catalog version frozen by an approved notice. Ordinary
-- callers still cannot swap terms for the same plan, and all plan changes keep
-- the concurrency-safe quota validation introduced by SS-PLAN-LIMITS-001.
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
      where terms.id = new.catalog_terms_id and terms.plan_id = new.plan_id;
    end if;
    if v_limits is null then
      select terms.id, terms.resource_limits into new.catalog_terms_id, v_limits
      from public.plan_catalog_terms terms where terms.plan_id = new.plan_id
      order by terms.version desc limit 1;
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
  order by (membership.status = 'active') desc, membership.created_at, membership.id
  limit 1;
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

create or replace function shop_private.billing_notice_commercial_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (
    new.catalog_terms_id is distinct from old.catalog_terms_id
    or new.plan_id is distinct from old.plan_id
    or new.plan_slug_snapshot is distinct from old.plan_slug_snapshot
    or new.plan_name_snapshot is distinct from old.plan_name_snapshot
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
      order by (membership.status = 'active') desc, membership.created_at, membership.id
      limit 1;
    end if;
    select terms.id, plan.slug, terms.display_name, terms.billing_interval,
      terms.resource_limits, coalesce(new.list_price_amount, terms.price_amount),
      coalesce(new.effective_price_amount, new.expected_amount, terms.price_amount),
      coalesce(new.expected_amount, new.effective_price_amount, terms.price_amount),
      coalesce(new.currency, terms.currency), coalesce(new.price_source, 'catalog'),
      coalesce(new.quoted_at, clock_timestamp())
    into new.catalog_terms_id, new.plan_slug_snapshot, new.plan_name_snapshot,
      new.billing_interval_snapshot, new.resource_limits_snapshot,
      new.list_price_amount, new.effective_price_amount, new.expected_amount,
      new.currency, new.price_source, new.quoted_at
    from public.plans plan
    join public.plan_catalog_terms terms on terms.plan_id = plan.id
    where plan.id = new.plan_id
      and terms.id = coalesce(new.catalog_terms_id, terms.id)
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
    'id', subscription.id,
    'status', subscription.status,
    'planId', plan.id,
    'planSlug', plan.slug,
    'planName', terms.display_name,
    'priceAmount', (price.quote ->> 'effectivePriceAmount')::numeric,
    'listPriceAmount', (price.quote ->> 'listPriceAmount')::numeric,
    'effectivePriceAmount', (price.quote ->> 'effectivePriceAmount')::numeric,
    'priceSource', price.quote ->> 'priceSource',
    'priceOverrideId', price.quote ->> 'priceOverrideId',
    'priceOverrideReason', price.quote ->> 'priceOverrideReason',
    'priceOverrideEffectiveFrom', price.quote ->> 'priceOverrideEffectiveFrom',
    'priceOverrideExpiresAt', price.quote ->> 'priceOverrideExpiresAt',
    'currency', terms.currency,
    'billingInterval', terms.billing_interval,
    'resourceLimits', terms.resource_limits,
    'trialStartAt', subscription.trial_start_at,
    'trialEndAt', subscription.trial_end_at,
    'periodStart', subscription.current_period_start,
    'periodEnd', subscription.current_period_end,
    'accessState', case
      when shop.status = 'suspended' then 'suspended'
      when subscription.status = 'trialing' and subscription.trial_end_at > now() then 'trialing'
      when subscription.status = 'active' and subscription.current_period_end > now() then 'active'
      else 'read_only'
    end,
    'trialDaysRemaining', case
      when subscription.status = 'trialing' and subscription.trial_end_at > now()
      then ceil(extract(epoch from subscription.trial_end_at - now()) / 86400.0)::integer
      else 0
    end
  )
  from public.shops shop
  join public.shop_memberships membership
    on membership.shop_id = shop.id and membership.role = 'owner'
  join public.subscriptions subscription on subscription.profile_id = membership.profile_id
  join public.plans plan on plan.id = subscription.plan_id
  join public.plan_catalog_terms terms on terms.id = subscription.catalog_terms_id
  cross join lateral (
    select shop_private.subscription_effective_price(
      subscription.id, subscription.catalog_terms_id, clock_timestamp()
    ) quote
  ) price
  where shop.id = p_shop_id
  order by (membership.status = 'active') desc, membership.created_at, membership.id
  limit 1;
$$;

create or replace function public.shop_billing_read(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_subscription jsonb; v_subscription_id uuid; v_result jsonb;
begin
  if p_shop_id is null or not shop_private.is_owner(p_shop_id) then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  v_subscription := shop_private.billing_subscription_snapshot(p_shop_id);
  if v_subscription is null then
    raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023';
  end if;
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
    join lateral (select catalog.* from public.plan_catalog_terms catalog
      where catalog.plan_id = plan.id
        and (plan.id <> (v_subscription ->> 'planId')::uuid
          or catalog.id = (select subscription.catalog_terms_id
            from public.subscriptions subscription where subscription.id = v_subscription_id))
      order by catalog.version desc limit 1) terms on true
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
      'updatedAt', configuration.updated_at,
      'manualVerification', true
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

create function public.submit_shop_billing_notice(
  p_request_id uuid,
  p_shop_id uuid,
  p_requested_plan_slug text,
  p_paid_amount numeric,
  p_transfer_date date,
  p_transfer_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_profile_id uuid; v_subscription_id uuid; v_current_plan_id uuid; v_current_terms_id uuid;
  v_plan_id uuid; v_terms_id uuid; v_plan_slug text; v_plan_name text;
  v_interval text; v_currency text; v_limits jsonb; v_quote jsonb;
  v_existing public.shop_billing_submissions; v_submission_id uuid;
begin
  if p_request_id is null or p_shop_id is null
    or p_paid_amount is null or p_paid_amount <= 0 or p_paid_amount > 9999999999.99
    or p_paid_amount <> round(p_paid_amount, 2)
    or p_transfer_date is null or p_transfer_date > current_date
    or p_transfer_date < current_date - 365
    or p_transfer_reference is null
    or length(btrim(p_transfer_reference)) not between 2 and 200
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
  order by (membership.status = 'active') desc, membership.created_at, membership.id
  limit 1;
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
        and v_existing.plan_slug_snapshot <> btrim(p_requested_plan_slug)) then
      raise exception 'BILLING_NOTICE_KEY_REUSED' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  select plan.id, terms.id, plan.slug, terms.display_name,
    terms.billing_interval, terms.currency, terms.resource_limits
  into v_plan_id, v_terms_id, v_plan_slug, v_plan_name,
    v_interval, v_currency, v_limits
  from public.plans plan
  join public.portals portal on portal.id = plan.portal_id
  join lateral (select catalog.* from public.plan_catalog_terms catalog
    where catalog.plan_id = plan.id
      and (plan.id <> v_current_plan_id or catalog.id = v_current_terms_id)
    order by catalog.version desc limit 1) terms on true
  where portal.key = 'shop-crm'
    and plan.slug = coalesce(nullif(btrim(p_requested_plan_slug), ''),
      (select current_plan.slug from public.plans current_plan where current_plan.id = v_current_plan_id))
    and (plan.id = v_current_plan_id or (
      plan.is_active and plan.is_public and plan.is_purchasable and not plan.is_coming_soon
    ));
  if v_plan_id is null then
    raise exception 'PLAN_UNAVAILABLE' using errcode = '22023';
  end if;
  v_quote := shop_private.subscription_effective_price(
    v_subscription_id, v_terms_id, clock_timestamp()
  );

  insert into public.shop_billing_submissions (
    request_id, shop_id, submitted_by_profile_id, plan_id, catalog_terms_id,
    plan_slug_snapshot, plan_name_snapshot, billing_interval_snapshot,
    resource_limits_snapshot, list_price_amount, effective_price_amount,
    expected_amount, price_override_id, price_source, quoted_at,
    kind, status, amount, paid_amount, currency, reference,
    transfer_date, transfer_reference, metadata
  ) values (
    p_request_id, p_shop_id, v_profile_id, v_plan_id, v_terms_id,
    v_plan_slug, v_plan_name, v_interval, v_limits,
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
  p_request_id uuid,
  p_shop_id uuid,
  p_paid_amount numeric,
  p_transfer_date date,
  p_transfer_reference text
) returns uuid language sql security definer set search_path = '' as $$
  select public.submit_shop_billing_notice(
    p_request_id, p_shop_id, null, p_paid_amount, p_transfer_date, p_transfer_reference
  );
$$;

create or replace function public.platform_admin_billing_read(
  p_resource text default 'queue', p_status text default null,
  p_page integer default 1, p_page_size integer default 25
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform shop_private.assert_platform_admin(false);
  if p_resource not in ('queue', 'configuration', 'summary', 'audit')
    or p_page is null or p_page < 1 or p_page > 100000
    or p_page_size is null or p_page_size < 1 or p_page_size > 100
    or nullif(btrim(p_status), '') not in ('submitted', 'under_review', 'approved', 'rejected') then
    raise exception 'PLATFORM_BILLING_READ_INVALID' using errcode = '22023';
  end if;
  if p_resource = 'configuration' then
    select jsonb_build_object(
      'recipientAlias', configuration.recipient_alias,
      'paymentLink', configuration.payment_link,
      'qrImageUrl', configuration.qr_image_url,
      'instructionsEn', configuration.instructions_en,
      'instructionsAr', configuration.instructions_ar,
      'updatedAt', configuration.updated_at
    ) into v_result from public.shop_billing_configuration configuration where configuration.singleton;
  elsif p_resource = 'summary' then
    select jsonb_build_object(
      'open', count(*) filter (where submission.status in ('submitted', 'under_review'))::integer,
      'submitted', count(*) filter (where submission.status = 'submitted')::integer,
      'underReview', count(*) filter (where submission.status = 'under_review')::integer,
      'approved', count(*) filter (where submission.status = 'approved')::integer,
      'rejected', count(*) filter (where submission.status = 'rejected')::integer
    ) into v_result from public.shop_billing_submissions submission;
  elsif p_resource = 'audit' then
    with event_rows as (
      select event.id, event.shop_id as "shopId", shop.name as "shopName",
        event.submission_id as "submissionId", event.action, event.reason,
        event.actor_user_id as "actorUserId", event.parameters,
        event.before_state as "beforeState", event.after_state as "afterState",
        event.occurred_at as "occurredAt"
      from public.platform_billing_events event left join public.shops shop on shop.id = event.shop_id
    ), page_rows as (
      select * from event_rows order by "occurredAt" desc, id
      limit p_page_size offset (p_page - 1) * p_page_size
    ) select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page_row)) from page_rows page_row), '[]'::jsonb),
      'total', (select count(*)::integer from event_rows), 'page', p_page, 'pageSize', p_page_size
    ) into v_result;
  else
    with queue_rows as (
      select submission.id, submission.shop_id as "shopId", shop.name as "shopName",
        submission.kind, submission.status,
        current_plan.slug as "currentPlanSlug", current_terms.display_name as "currentPlanName",
        submission.plan_slug_snapshot as "requestedPlanSlug",
        submission.plan_name_snapshot as "requestedPlanName",
        submission.billing_interval_snapshot as "billingInterval",
        submission.list_price_amount as "listPriceAmount",
        submission.effective_price_amount as "effectivePriceAmount",
        submission.price_source as "priceSource",
        shop_private.plan_change_blockers(submission.shop_id, submission.resource_limits_snapshot) as "usageBlockers",
        submission.expected_amount as "expectedAmount", submission.paid_amount as "paidAmount",
        submission.currency, submission.transfer_date as "transferDate",
        submission.transfer_reference as "transferReference",
        submission.review_reason as "reviewReason", submission.received_amount as "receivedAmount",
        submission.received_reference as "receivedReference", submission.received_date as "receivedDate",
        submission.activation_days as "activationDays",
        submission.approved_subscription_end as "approvedSubscriptionEnd",
        submission.submitted_at as "submittedAt", submission.reviewed_at as "reviewedAt"
      from public.shop_billing_submissions submission
      join public.shops shop on shop.id = submission.shop_id
      join public.shop_memberships membership on membership.shop_id = submission.shop_id and membership.role = 'owner'
      join public.subscriptions subscription on subscription.profile_id = membership.profile_id
      join public.plans current_plan on current_plan.id = subscription.plan_id
      join public.plan_catalog_terms current_terms on current_terms.id = subscription.catalog_terms_id
      where (nullif(btrim(p_status), '') is null or submission.status = btrim(p_status))
        and membership.id = (select selected.id from public.shop_memberships selected
          where selected.shop_id = submission.shop_id and selected.role = 'owner'
          order by (selected.status = 'active') desc, selected.created_at, selected.id limit 1)
    ), page_rows as (
      select * from queue_rows order by "submittedAt" desc, id
      limit p_page_size offset (p_page - 1) * p_page_size
    ) select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page_row)) from page_rows page_row), '[]'::jsonb),
      'total', (select count(*)::integer from queue_rows), 'page', p_page, 'pageSize', p_page_size
    ) into v_result;
  end if;
  return v_result;
end;
$$;

create or replace function public.platform_admin_billing_command(
  p_request_id uuid, p_action text, p_submission_id uuid, p_reason text,
  p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text; v_prior public.platform_billing_events;
  v_submission public.shop_billing_submissions; v_before jsonb; v_after jsonb;
  v_shop_id uuid; v_subscription public.subscriptions; v_amount numeric(12, 2);
  v_reference text; v_received_date date; v_parameters jsonb;
  v_config public.shop_billing_configuration; v_event_id uuid; v_end timestamptz;
  v_start timestamptz; v_days integer; v_blockers jsonb; v_mismatch_reason text;
  v_override_id uuid; v_currency text; v_effective_from timestamptz; v_expires_at timestamptz;
begin
  v_role := shop_private.assert_platform_admin(true);
  p_payload := coalesce(p_payload, '{}'::jsonb);
  if p_request_id is null
    or p_action not in ('configure_instructions', 'mark_under_review', 'approve', 'reject', 'set_price_override')
    or p_reason is null or length(btrim(p_reason)) not between 2 and 1000
    or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 8192
    or (p_action in ('configure_instructions', 'set_price_override') and p_submission_id is not null)
    or (p_action not in ('configure_instructions', 'set_price_override') and p_submission_id is null) then
    raise exception 'PLATFORM_BILLING_COMMAND_INVALID' using errcode = '22023';
  end if;
  v_parameters := jsonb_build_object('action', p_action, 'submissionId', p_submission_id, 'payload', p_payload);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_prior from public.platform_billing_events event where event.request_id = p_request_id;
  if found then
    if v_prior.actor_user_id <> auth.uid() or v_prior.action <> p_action
      or v_prior.submission_id is distinct from p_submission_id
      or v_prior.reason <> btrim(p_reason) or v_prior.parameters is distinct from v_parameters then
      raise exception 'PLATFORM_BILLING_COMMAND_KEY_REUSED' using errcode = '22023';
    end if;
    return jsonb_build_object('data', v_prior.after_state, 'replayed', true, 'auditId', v_prior.id);
  end if;

  if p_action = 'configure_instructions' then
    if (p_payload - array['recipientAlias', 'paymentLink', 'qrImageUrl', 'instructionsEn', 'instructionsAr']) <> '{}'::jsonb
      or (p_payload ? 'recipientAlias' and jsonb_typeof(p_payload -> 'recipientAlias') <> 'string')
      or (p_payload ? 'paymentLink' and jsonb_typeof(p_payload -> 'paymentLink') <> 'string')
      or (p_payload ? 'qrImageUrl' and jsonb_typeof(p_payload -> 'qrImageUrl') <> 'string')
      or (p_payload ? 'instructionsEn' and jsonb_typeof(p_payload -> 'instructionsEn') <> 'string')
      or (p_payload ? 'instructionsAr' and jsonb_typeof(p_payload -> 'instructionsAr') <> 'string')
      or length(coalesce(p_payload ->> 'recipientAlias', '')) > 200
      or length(coalesce(p_payload ->> 'paymentLink', '')) > 1000
      or length(coalesce(p_payload ->> 'qrImageUrl', '')) > 1000
      or length(coalesce(p_payload ->> 'instructionsEn', '')) > 2000
      or length(coalesce(p_payload ->> 'instructionsAr', '')) > 2000
      or (nullif(btrim(p_payload ->> 'paymentLink'), '') is not null and btrim(p_payload ->> 'paymentLink') !~ '^https://')
      or (nullif(btrim(p_payload ->> 'qrImageUrl'), '') is not null and btrim(p_payload ->> 'qrImageUrl') !~ '^https://') then
      raise exception 'PLATFORM_BILLING_COMMAND_INVALID' using errcode = '22023';
    end if;
    select * into v_config from public.shop_billing_configuration where singleton for update;
    v_before := to_jsonb(v_config);
    update public.shop_billing_configuration set
      recipient_alias = nullif(btrim(p_payload ->> 'recipientAlias'), ''),
      payment_link = nullif(btrim(p_payload ->> 'paymentLink'), ''),
      qr_image_url = nullif(btrim(p_payload ->> 'qrImageUrl'), ''),
      instructions_en = coalesce(btrim(p_payload ->> 'instructionsEn'), ''),
      instructions_ar = coalesce(btrim(p_payload ->> 'instructionsAr'), ''),
      updated_by_user_id = auth.uid(), updated_at = clock_timestamp()
    where singleton returning * into v_config;
    v_after := to_jsonb(v_config);
  elsif p_action = 'set_price_override' then
    if (p_payload - array['shopId', 'amount', 'currency', 'effectiveFrom', 'expiresAt']) <> '{}'::jsonb
      or jsonb_typeof(p_payload -> 'shopId') <> 'string'
      or jsonb_typeof(p_payload -> 'amount') <> 'number'
      or jsonb_typeof(p_payload -> 'currency') <> 'string'
      or jsonb_typeof(p_payload -> 'effectiveFrom') <> 'string'
      or (p_payload ? 'expiresAt' and p_payload -> 'expiresAt' <> 'null'::jsonb
        and jsonb_typeof(p_payload -> 'expiresAt') <> 'string') then
      raise exception 'PLATFORM_BILLING_COMMAND_INVALID' using errcode = '22023';
    end if;
    begin
      v_shop_id := (p_payload ->> 'shopId')::uuid;
      v_amount := (p_payload ->> 'amount')::numeric;
      v_currency := upper(btrim(p_payload ->> 'currency'));
      v_effective_from := (p_payload ->> 'effectiveFrom')::timestamptz;
      v_expires_at := nullif(p_payload ->> 'expiresAt', '')::timestamptz;
    exception when others then
      raise exception 'PLATFORM_BILLING_COMMAND_INVALID' using errcode = '22023';
    end;
    if v_amount <= 0 or v_amount > 9999999999.99 or v_amount <> round(v_amount, 2)
      or v_currency !~ '^[A-Z]{3}$'
      or v_effective_from < clock_timestamp() - interval '10 years'
      or (v_expires_at is not null and v_expires_at <= v_effective_from) then
      raise exception 'PLATFORM_BILLING_COMMAND_INVALID' using errcode = '22023';
    end if;
    perform 1 from public.shops shop where shop.id = v_shop_id for update;
    if not found then raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023'; end if;
    select subscription.* into v_subscription
    from public.shop_memberships membership
    join public.subscriptions subscription on subscription.profile_id = membership.profile_id
    where membership.shop_id = v_shop_id and membership.role = 'owner'
    order by (membership.status = 'active') desc, membership.created_at, membership.id
    limit 1 for update of subscription;
    if v_subscription.id is null then raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023'; end if;
    v_before := shop_private.billing_subscription_snapshot(v_shop_id);
    insert into public.subscription_price_overrides (
      subscription_id, amount, currency, reason, effective_from, expires_at, created_by_user_id
    ) values (
      v_subscription.id, v_amount, v_currency, btrim(p_reason),
      v_effective_from, v_expires_at, auth.uid()
    ) returning id into v_override_id;
    v_after := jsonb_build_object(
      'priceOverrideId', v_override_id, 'shopId', v_shop_id,
      'subscriptionId', v_subscription.id, 'amount', v_amount,
      'currency', v_currency, 'reason', btrim(p_reason),
      'effectiveFrom', v_effective_from, 'expiresAt', v_expires_at,
      'subscription', shop_private.billing_subscription_snapshot(v_shop_id)
    );
  else
    select * into v_submission from public.shop_billing_submissions submission
    where submission.id = p_submission_id for update;
    if not found then raise exception 'BILLING_NOTICE_NOT_FOUND' using errcode = '22023'; end if;
    v_shop_id := v_submission.shop_id;
    v_before := to_jsonb(v_submission) || jsonb_build_object(
      'subscription', shop_private.billing_subscription_snapshot(v_submission.shop_id)
    );
    if p_action = 'mark_under_review' then
      if p_payload <> '{}'::jsonb or v_submission.status <> 'submitted' then
        raise exception 'BILLING_NOTICE_STATE_INVALID' using errcode = '22023';
      end if;
      update public.shop_billing_submissions set status = 'under_review'
      where id = p_submission_id returning * into v_submission;
    elsif p_action = 'reject' then
      if p_payload <> '{}'::jsonb or v_submission.status not in ('submitted', 'under_review') then
        raise exception 'BILLING_NOTICE_STATE_INVALID' using errcode = '22023';
      end if;
      update public.shop_billing_submissions set status = 'rejected',
        review_reason = btrim(p_reason), reviewed_by_user_id = auth.uid(), reviewed_at = clock_timestamp()
      where id = p_submission_id returning * into v_submission;
    else
      if v_submission.status not in ('submitted', 'under_review')
        or (p_payload - array['receivedAmount', 'receivedReference', 'receivedDate', 'amountOverrideReason']) <> '{}'::jsonb
        or jsonb_typeof(p_payload -> 'receivedAmount') <> 'number'
        or jsonb_typeof(p_payload -> 'receivedReference') <> 'string'
        or jsonb_typeof(p_payload -> 'receivedDate') <> 'string'
        or (p_payload ? 'amountOverrideReason' and jsonb_typeof(p_payload -> 'amountOverrideReason') <> 'string') then
        raise exception 'BILLING_NOTICE_STATE_INVALID' using errcode = '22023';
      end if;
      v_amount := (p_payload ->> 'receivedAmount')::numeric;
      v_reference := btrim(p_payload ->> 'receivedReference');
      v_received_date := (p_payload ->> 'receivedDate')::date;
      v_mismatch_reason := nullif(btrim(p_payload ->> 'amountOverrideReason'), '');
      if v_amount <= 0 or v_amount > 9999999999.99 or v_amount <> round(v_amount, 2)
        or length(v_reference) not between 2 and 200
        or v_received_date > current_date or v_received_date < current_date - 365
        or ((v_amount is distinct from v_submission.effective_price_amount
            or v_submission.paid_amount is distinct from v_submission.effective_price_amount)
          and (v_mismatch_reason is null or length(v_mismatch_reason) not between 2 and 1000))
        or (v_mismatch_reason is not null and length(v_mismatch_reason) > 1000) then
        raise exception 'BILLING_AMOUNT_MISMATCH_OVERRIDE_REQUIRED' using errcode = '22023';
      end if;

      perform shop_private.lock_all_plan_resources(v_submission.shop_id);
      select subscription.* into v_subscription
      from public.shop_memberships membership
      join public.subscriptions subscription on subscription.profile_id = membership.profile_id
      where membership.shop_id = v_submission.shop_id and membership.role = 'owner'
      order by (membership.status = 'active') desc, membership.created_at, membership.id
      limit 1 for update of subscription;
      if v_subscription.id is null or v_submission.plan_id is null or v_submission.catalog_terms_id is null then
        raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023';
      end if;
      v_blockers := shop_private.plan_change_blockers(v_submission.shop_id, v_submission.resource_limits_snapshot);
      if jsonb_array_length(v_blockers) > 0 then
        raise exception 'PLAN_CHANGE_BLOCKED' using errcode = '23514', detail = v_blockers::text;
      end if;

      v_start := greatest(coalesce(v_subscription.current_period_end, clock_timestamp()), clock_timestamp());
      v_end := v_start + case v_submission.billing_interval_snapshot
        when 'monthly' then interval '1 month'
        when 'quarterly' then interval '3 months'
        when 'annual' then interval '1 year'
        else null end;
      if v_end is null then raise exception 'BILLING_INTERVAL_INVALID' using errcode = '22023'; end if;
      v_days := greatest(1, ceil(extract(epoch from v_end - v_start) / 86400.0)::integer);
      perform set_config('shop.billing_approval', 'approved', true);
      update public.subscriptions set
        plan_id = v_submission.plan_id, catalog_terms_id = v_submission.catalog_terms_id,
        status = 'active',
        current_period_start = case when current_period_end is null or current_period_end <= now()
          then now() else coalesce(current_period_start, now()) end,
        current_period_end = v_end, locked_at = null, updated_at = now()
      where id = v_subscription.id;
      update public.shop_billing_submissions set status = 'approved',
        review_reason = btrim(p_reason), reviewed_by_user_id = auth.uid(),
        received_amount = v_amount, received_reference = v_reference,
        received_date = v_received_date, activation_days = v_days,
        approved_subscription_end = v_end, reviewed_at = clock_timestamp(),
        metadata = metadata || jsonb_strip_nulls(jsonb_build_object(
          'amountMismatchOverrideReason', v_mismatch_reason,
          'amountMismatch', v_mismatch_reason is not null
        ))
      where id = p_submission_id returning * into v_submission;
    end if;
    v_after := to_jsonb(v_submission) || jsonb_build_object(
      'subscription', shop_private.billing_subscription_snapshot(v_submission.shop_id)
    );
  end if;

  insert into public.platform_billing_events (
    request_id, actor_user_id, actor_role, shop_id, submission_id,
    action, reason, parameters, before_state, after_state
  ) values (
    p_request_id, auth.uid(), v_role, v_shop_id, p_submission_id,
    p_action, btrim(p_reason), v_parameters, v_before, v_after
  ) returning id into v_event_id;
  return jsonb_build_object('data', v_after, 'replayed', false, 'auditId', v_event_id);
end;
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
      plan_name, billing_interval, currency, price_amount, list_price_amount,
      price_override_id, resource_limits, period_start, period_end, approved_at
    ) values (
      v_subscription.id, new.id, new.catalog_terms_id, new.plan_slug_snapshot,
      new.plan_name_snapshot, new.billing_interval_snapshot, new.currency,
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

revoke all on function shop_private.subscription_effective_price(uuid, uuid, timestamptz),
  shop_private.plan_change_blockers(uuid, jsonb)
from public, anon, authenticated, service_role;
revoke all on function public.submit_shop_billing_notice(uuid, uuid, text, numeric, date, text)
from public, anon, service_role;
grant execute on function public.submit_shop_billing_notice(uuid, uuid, text, numeric, date, text)
to authenticated;

notify pgrst, 'reload schema';
