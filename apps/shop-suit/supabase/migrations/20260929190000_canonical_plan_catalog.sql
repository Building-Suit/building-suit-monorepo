-- SS-PLAN-CATALOG-001: approved post-pilot catalog, grandfathered legacy
-- subscriptions, explicit resource limits, and immutable commercial snapshots.

alter table public.plans
  add column resource_limits jsonb not null default jsonb_build_object(
    'active_locations', null,
    'active_members', null,
    'active_products', null,
    'active_services', null
  ),
  add column is_purchasable boolean not null default false,
  add column catalog_version integer not null default 1;

create function shop_private.valid_resource_limits(p_limits jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_limits) = 'object'
    and p_limits ?& array[
      'active_locations', 'active_members', 'active_products', 'active_services'
    ]
    and p_limits - array[
      'active_locations', 'active_members', 'active_products', 'active_services'
    ] = '{}'::jsonb
    and not exists (
      select 1
      from jsonb_each(p_limits) limit_entry
      where jsonb_typeof(limit_entry.value) not in ('number', 'null')
        or (jsonb_typeof(limit_entry.value) = 'number'
          and (limit_entry.value::text !~ '^[0-9]+$'
            or (limit_entry.value::text)::numeric < 1))
    );
$$;

alter table public.plans
  add constraint plans_catalog_version_positive check (catalog_version > 0),
  add constraint plans_resource_limits_shape
    check (shop_private.valid_resource_limits(resource_limits));

create table public.plan_catalog_terms (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete restrict,
  version integer not null check (version > 0),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  billing_interval text not null check (billing_interval in ('monthly', 'quarterly', 'annual')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  price_amount integer not null check (price_amount >= 0),
  trial_days integer not null check (trial_days = 14),
  resource_limits jsonb not null,
  is_public boolean not null,
  is_purchasable boolean not null,
  effective_from timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  unique (plan_id, version),
  check (not is_purchasable or is_public),
  check (shop_private.valid_resource_limits(resource_limits))
);

create table public.plan_catalog_legacy_mappings (
  legacy_plan_id uuid primary key references public.plans (id) on delete restrict,
  successor_plan_id uuid not null references public.plans (id) on delete restrict,
  strategy text not null check (strategy = 'grandfather'),
  subscriptions_at_migration integer not null check (subscriptions_at_migration >= 0),
  before_snapshot jsonb not null check (jsonb_typeof(before_snapshot) = 'object'),
  after_snapshot jsonb not null check (jsonb_typeof(after_snapshot) = 'object'),
  migrated_at timestamptz not null default clock_timestamp()
);

create function shop_private.reject_commercial_snapshot_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'COMMERCIAL_SNAPSHOT_IMMUTABLE' using errcode = '55000';
end;
$$;

create trigger plan_catalog_terms_immutable
before update or delete or truncate on public.plan_catalog_terms
for each statement execute function shop_private.reject_commercial_snapshot_mutation();
create trigger plan_catalog_legacy_mappings_immutable
before update or delete or truncate on public.plan_catalog_legacy_mappings
for each statement execute function shop_private.reject_commercial_snapshot_mutation();

alter table public.plan_catalog_terms enable row level security;
alter table public.plan_catalog_legacy_mappings enable row level security;
create policy plan_catalog_terms_public_read on public.plan_catalog_terms
  for select to anon, authenticated using (
    is_public and exists (
      select 1 from public.plans plan
      join public.portals portal on portal.id = plan.portal_id
      where plan.id = plan_id and plan.is_active and plan.is_public
        and portal.key = 'shop-crm' and portal.is_active
    )
  );
revoke all on public.plan_catalog_terms, public.plan_catalog_legacy_mappings
  from public, anon, authenticated;
grant select (
  id, plan_id, version, display_name, billing_interval, currency,
  price_amount, trial_days, resource_limits, is_public, is_purchasable,
  effective_from
) on public.plan_catalog_terms to anon, authenticated;
grant all on public.plan_catalog_terms, public.plan_catalog_legacy_mappings to service_role;
grant select (resource_limits, is_purchasable, catalog_version)
  on public.plans to anon, authenticated;

create function shop_private.reconcile_plan_catalog()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_portal_id uuid;
begin
  select portal.id into v_portal_id
  from public.portals portal where portal.key = 'shop-crm';
  if v_portal_id is null then return; end if;

  -- Snapshot every pre-existing commercial row before changing visibility.
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
    (v_portal_id, 'Solo', 'solo', 349, 'EGP', 'monthly', 14,
      '{"inventory":true,"max_locations":1,"max_members":2,"max_products":250,"max_services":50}'::jsonb,
      '{"active_locations":1,"active_members":2,"active_products":250,"active_services":50}'::jsonb,
      10, true, true, true, false, 1),
    (v_portal_id, 'Team', 'team', 699, 'EGP', 'monthly', 14,
      '{"inventory":true,"max_locations":1,"max_members":8,"max_products":1000,"max_services":250}'::jsonb,
      '{"active_locations":1,"active_members":8,"active_products":1000,"active_services":250}'::jsonb,
      20, true, true, true, false, 1),
    (v_portal_id, 'Multi', 'multi', 1099, 'EGP', 'monthly', 14,
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
    catalog_version = excluded.catalog_version,
    updated_at = now();

  insert into public.plan_catalog_terms (
    plan_id, version, display_name, billing_interval, currency, price_amount,
    trial_days, resource_limits, is_public, is_purchasable
  )
  select plan.id, 1, plan.name, plan.billing_interval, plan.currency,
    plan.price_amount, plan.trial_days, plan.resource_limits, true, true
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

select shop_private.reconcile_plan_catalog();

alter table public.subscriptions add column catalog_terms_id uuid
  references public.plan_catalog_terms (id) on delete restrict;

create function shop_private.subscription_catalog_terms()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_shop_id uuid;
  v_limits jsonb;
  v_limit integer;
  v_usage integer;
  v_resource text;
begin
  if tg_op = 'INSERT' and auth.uid() is not null and not exists (
    select 1 from public.plans plan
    where plan.id = new.plan_id and plan.is_active and plan.is_public
      and plan.is_purchasable and not plan.is_coming_soon
  ) then
    raise exception 'PLAN_UNAVAILABLE' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' or new.plan_id is distinct from old.plan_id
    or new.catalog_terms_id is null then
    select terms.id, terms.resource_limits into new.catalog_terms_id, v_limits
    from public.plan_catalog_terms terms
    where terms.plan_id = new.plan_id
    order by terms.version desc limit 1;
    if new.catalog_terms_id is null then
      raise exception 'PLAN_COMMERCIAL_TERMS_NOT_FOUND' using errcode = '23503';
    end if;
  else
    select terms.resource_limits into v_limits
    from public.plan_catalog_terms terms where terms.id = new.catalog_terms_id;
  end if;

  if tg_op = 'UPDATE' and old.catalog_terms_id is not null
    and new.catalog_terms_id is distinct from old.catalog_terms_id
    and new.plan_id = old.plan_id then
    raise exception 'SUBSCRIPTION_TERMS_CHANGE_REQUIRES_PLAN_CHANGE' using errcode = '23514';
  end if;

  select membership.shop_id into v_shop_id
  from public.shop_memberships membership
  where membership.profile_id = new.profile_id and membership.role = 'owner'
  order by (membership.status = 'active') desc, membership.created_at, membership.id
  limit 1;

  if v_shop_id is not null and (tg_op = 'INSERT' or new.plan_id is distinct from old.plan_id) then
    foreach v_resource in array array[
      'active_locations', 'active_members', 'active_products', 'active_services'
    ] loop
      v_limit := (v_limits ->> v_resource)::integer;
      if v_limit is not null then
        execute case v_resource
          when 'active_locations' then
            'select count(*)::integer from public.shop_locations where shop_id = $1 and status = ''active'''
          when 'active_members' then
            'select count(*)::integer from public.shop_memberships where shop_id = $1 and status = ''active'' and removed_at is null'
          when 'active_products' then
            'select count(*)::integer from public.products where shop_id = $1 and is_active'
          else
            'select count(*)::integer from public.services where shop_id = $1 and is_active'
        end into v_usage using v_shop_id;
        if v_usage > v_limit then
          raise exception 'PLAN_RESOURCE_LIMIT_EXCEEDED:%:%:%', v_resource, v_usage, v_limit
            using errcode = '23514';
        end if;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create trigger subscriptions_catalog_terms
before insert or update of plan_id, catalog_terms_id on public.subscriptions
for each row execute function shop_private.subscription_catalog_terms();

update public.subscriptions subscription set catalog_terms_id = (
  select terms.id from public.plan_catalog_terms terms
  where terms.plan_id = subscription.plan_id
  order by terms.version desc limit 1
);
alter table public.subscriptions alter column catalog_terms_id set not null;
grant select (catalog_terms_id) on public.subscriptions to authenticated;

create function shop_private.subscription_resource_limit(
  p_shop_id uuid,
  p_resource text
) returns integer language plpgsql stable security definer set search_path = '' as $$
declare v_limit integer;
begin
  if p_resource not in (
    'active_locations', 'active_members', 'active_products', 'active_services'
  ) then raise exception 'UNKNOWN_PLAN_RESOURCE' using errcode = '22023'; end if;
  select (terms.resource_limits ->> p_resource)::integer into v_limit
  from public.shop_memberships membership
  join public.subscriptions subscription on subscription.profile_id = membership.profile_id
  join public.plan_catalog_terms terms on terms.id = subscription.catalog_terms_id
  where membership.shop_id = p_shop_id and membership.role = 'owner'
  order by (membership.status = 'active') desc, membership.created_at, membership.id
  limit 1;
  return v_limit;
end;
$$;

create function shop_private.enforce_active_resource_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_shop_id uuid;
  v_resource text;
  v_limit integer;
  v_usage integer;
  v_increases boolean;
begin
  v_shop_id := new.shop_id;
  if tg_table_name = 'shop_locations' then
    v_resource := 'active_locations';
    v_increases := new.status = 'active'
      and (tg_op = 'INSERT' or old.status <> 'active');
  elsif tg_table_name = 'shop_memberships' then
    v_resource := 'active_members';
    v_increases := new.status = 'active' and new.removed_at is null
      and (tg_op = 'INSERT' or old.status <> 'active' or old.removed_at is not null);
  elsif tg_table_name = 'products' then
    v_resource := 'active_products';
    v_increases := new.is_active
      and (tg_op = 'INSERT' or not old.is_active);
  else
    v_resource := 'active_services';
    v_increases := new.is_active
      and (tg_op = 'INSERT' or not old.is_active);
  end if;
  if not v_increases then return new; end if;

  perform 1 from public.shops shop where shop.id = v_shop_id for update;
  v_limit := shop_private.subscription_resource_limit(v_shop_id, v_resource);
  if v_limit is null then return new; end if;
  execute format(
    'select count(*)::integer from public.%I where shop_id = $1 and %s',
    tg_table_name,
    case tg_table_name
      when 'shop_locations' then 'status = ''active'''
      when 'shop_memberships' then 'status = ''active'' and removed_at is null'
      else 'is_active' end
  ) into v_usage using v_shop_id;
  if v_usage >= v_limit then
    raise exception 'PLAN_RESOURCE_LIMIT_REACHED:%:%', v_resource, v_limit
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger shop_locations_plan_limit before insert or update of status
  on public.shop_locations for each row execute function shop_private.enforce_active_resource_limit();
create trigger shop_memberships_plan_limit before insert or update of status, removed_at
  on public.shop_memberships for each row execute function shop_private.enforce_active_resource_limit();
create trigger products_plan_limit before insert or update of is_active
  on public.products for each row execute function shop_private.enforce_active_resource_limit();
create trigger services_plan_limit before insert or update of is_active
  on public.services for each row execute function shop_private.enforce_active_resource_limit();

alter table public.shop_billing_submissions
  add column catalog_terms_id uuid references public.plan_catalog_terms (id) on delete restrict,
  add column plan_slug_snapshot text,
  add column plan_name_snapshot text,
  add column billing_interval_snapshot text,
  add column resource_limits_snapshot jsonb;

update public.shop_billing_submissions submission set
  catalog_terms_id = terms.id,
  plan_slug_snapshot = plan.slug,
  plan_name_snapshot = terms.display_name,
  billing_interval_snapshot = terms.billing_interval,
  resource_limits_snapshot = terms.resource_limits
from public.plans plan
join public.plan_catalog_terms terms on terms.plan_id = plan.id
where submission.plan_id = plan.id
  and terms.version = (select max(latest.version) from public.plan_catalog_terms latest
    where latest.plan_id = plan.id);

alter table public.shop_billing_submissions
  add constraint shop_billing_commercial_snapshot_complete check (
    (catalog_terms_id is null and plan_slug_snapshot is null
      and plan_name_snapshot is null and billing_interval_snapshot is null
      and resource_limits_snapshot is null)
    or
    (catalog_terms_id is not null and plan_slug_snapshot is not null
      and plan_name_snapshot is not null and billing_interval_snapshot is not null
      and resource_limits_snapshot is not null)
  );

create function shop_private.billing_notice_commercial_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (
    new.catalog_terms_id is distinct from old.catalog_terms_id
    or new.plan_slug_snapshot is distinct from old.plan_slug_snapshot
    or new.plan_name_snapshot is distinct from old.plan_name_snapshot
    or new.billing_interval_snapshot is distinct from old.billing_interval_snapshot
    or new.resource_limits_snapshot is distinct from old.resource_limits_snapshot
    or new.expected_amount is distinct from old.expected_amount
    or new.currency is distinct from old.currency
  ) then raise exception 'BILLING_NOTICE_COMMERCIAL_TERMS_IMMUTABLE' using errcode = '55000'; end if;

  if tg_op = 'INSERT' then
    if new.plan_id is null then
      select subscription.plan_id into new.plan_id
      from public.shop_memberships membership
      join public.subscriptions subscription
        on subscription.profile_id = membership.profile_id
      where membership.shop_id = new.shop_id and membership.role = 'owner'
      order by (membership.status = 'active') desc,
        membership.created_at, membership.id
      limit 1;
    end if;
    select terms.id, plan.slug, terms.display_name, terms.billing_interval,
      terms.resource_limits, coalesce(new.expected_amount, terms.price_amount),
      coalesce(new.currency, terms.currency)
    into new.catalog_terms_id, new.plan_slug_snapshot, new.plan_name_snapshot,
      new.billing_interval_snapshot, new.resource_limits_snapshot,
      new.expected_amount, new.currency
    from public.plans plan
    join public.plan_catalog_terms terms on terms.plan_id = plan.id
    where plan.id = new.plan_id order by terms.version desc limit 1;
    if new.catalog_terms_id is null then
      raise exception 'PLAN_COMMERCIAL_TERMS_NOT_FOUND' using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

create trigger shop_billing_notice_commercial_snapshot
before insert or update on public.shop_billing_submissions
for each row execute function shop_private.billing_notice_commercial_snapshot();

create or replace function shop_private.billing_subscription_snapshot(p_shop_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', subscription.id,
    'status', subscription.status,
    'planId', plan.id,
    'planSlug', plan.slug,
    'planName', terms.display_name,
    'priceAmount', terms.price_amount,
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
  where shop.id = p_shop_id
  order by (membership.status = 'active') desc, membership.created_at, membership.id
  limit 1;
$$;

create or replace function public.shop_billing_read(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_subscription jsonb;
  v_result jsonb;
begin
  if p_shop_id is null or not shop_private.is_owner(p_shop_id) then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  v_subscription := shop_private.billing_subscription_snapshot(p_shop_id);
  if v_subscription is null then
    raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'subscription', v_subscription,
    'instructions', jsonb_build_object(
      'recipientAlias', configuration.recipient_alias,
      'paymentLink', configuration.payment_link,
      'qrImageUrl', configuration.qr_image_url,
      'instructionsEn', configuration.instructions_en,
      'instructionsAr', configuration.instructions_ar,
      'updatedAt', configuration.updated_at,
      'manualVerification', true
    ),
    'usage', jsonb_build_object(
      'locations', (select count(*)::integer from public.shop_locations location
        where location.shop_id = p_shop_id and location.status = 'active'),
      'products', (select count(*)::integer from public.products product
        where product.shop_id = p_shop_id and product.is_active),
      'services', (select count(*)::integer from public.services service
        where service.shop_id = p_shop_id and service.is_active),
      'members', (select count(*)::integer from public.shop_memberships membership
        where membership.shop_id = p_shop_id and membership.status = 'active'
          and membership.removed_at is null),
      'limits', v_subscription -> 'resourceLimits'
    ),
    'submissions', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', submission.id,
      'kind', submission.kind,
      'status', submission.status,
      'expectedAmount', submission.expected_amount,
      'paidAmount', submission.paid_amount,
      'currency', submission.currency,
      'transferDate', submission.transfer_date,
      'transferReference', submission.transfer_reference,
      'reviewReason', submission.review_reason,
      'receivedAmount', submission.received_amount,
      'receivedReference', submission.received_reference,
      'receivedDate', submission.received_date,
      'activationDays', submission.activation_days,
      'approvedSubscriptionEnd', submission.approved_subscription_end,
      'submittedAt', submission.submitted_at,
      'reviewedAt', submission.reviewed_at
    ) order by submission.submitted_at desc, submission.id desc), '[]'::jsonb)
    from public.shop_billing_submissions submission where submission.shop_id = p_shop_id)
  ) into v_result
  from public.shop_billing_configuration configuration where configuration.singleton;

  return v_result;
end;
$$;

create or replace function public.platform_admin_billing_read(
  p_resource text default 'queue',
  p_status text default null,
  p_page integer default 1,
  p_page_size integer default 25
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
    ) into v_result
    from public.shop_billing_configuration configuration where configuration.singleton;
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
        event.actor_user_id as "actorUserId", event.before_state as "beforeState",
        event.after_state as "afterState", event.occurred_at as "occurredAt"
      from public.platform_billing_events event
      left join public.shops shop on shop.id = event.shop_id
    ), page_rows as (
      select * from event_rows order by "occurredAt" desc, id
      limit p_page_size offset (p_page - 1) * p_page_size
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page_row)) from page_rows page_row), '[]'::jsonb),
      'total', (select count(*)::integer from event_rows),
      'page', p_page, 'pageSize', p_page_size
    ) into v_result;
  else
    with queue_rows as (
      select submission.id, submission.shop_id as "shopId", shop.name as "shopName",
        submission.kind, submission.status,
        submission.plan_slug_snapshot as "planSlug",
        submission.plan_name_snapshot as "planName",
        submission.expected_amount as "expectedAmount",
        submission.paid_amount as "paidAmount", submission.currency,
        submission.transfer_date as "transferDate",
        submission.transfer_reference as "transferReference",
        submission.review_reason as "reviewReason",
        submission.received_amount as "receivedAmount",
        submission.received_reference as "receivedReference",
        submission.received_date as "receivedDate",
        submission.activation_days as "activationDays",
        submission.approved_subscription_end as "approvedSubscriptionEnd",
        submission.submitted_at as "submittedAt", submission.reviewed_at as "reviewedAt"
      from public.shop_billing_submissions submission
      join public.shops shop on shop.id = submission.shop_id
      where nullif(btrim(p_status), '') is null or submission.status = btrim(p_status)
    ), page_rows as (
      select * from queue_rows order by "submittedAt" desc, id
      limit p_page_size offset (p_page - 1) * p_page_size
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page_row)) from page_rows page_row), '[]'::jsonb),
      'total', (select count(*)::integer from queue_rows),
      'page', p_page, 'pageSize', p_page_size
    ) into v_result;
  end if;
  return v_result;
end;
$$;

create table public.subscription_commercial_periods (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete restrict,
  billing_submission_id uuid unique references public.shop_billing_submissions (id) on delete restrict,
  catalog_terms_id uuid not null references public.plan_catalog_terms (id) on delete restrict,
  plan_slug text not null,
  plan_name text not null,
  billing_interval text not null,
  currency text not null,
  price_amount integer not null check (price_amount >= 0),
  resource_limits jsonb not null,
  period_start timestamptz not null,
  period_end timestamptz not null check (period_end > period_start),
  approved_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.subscription_commercial_periods enable row level security;
revoke all on public.subscription_commercial_periods from public, anon, authenticated;
grant all on public.subscription_commercial_periods to service_role;
create trigger subscription_commercial_periods_immutable
before update or delete or truncate on public.subscription_commercial_periods
for each statement execute function shop_private.reject_commercial_snapshot_mutation();

create function shop_private.capture_approved_commercial_period()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_subscription public.subscriptions;
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    select subscription.* into v_subscription
    from public.shop_memberships membership
    join public.subscriptions subscription on subscription.profile_id = membership.profile_id
    where membership.shop_id = new.shop_id and membership.role = 'owner'
    order by (membership.status = 'active') desc, membership.created_at, membership.id
    limit 1;
    insert into public.subscription_commercial_periods (
      subscription_id, billing_submission_id, catalog_terms_id, plan_slug,
      plan_name, billing_interval, currency, price_amount, resource_limits,
      period_start, period_end, approved_at
    ) values (
      v_subscription.id, new.id, new.catalog_terms_id, new.plan_slug_snapshot,
      new.plan_name_snapshot, new.billing_interval_snapshot, new.currency,
      new.expected_amount::integer, new.resource_limits_snapshot,
      coalesce(v_subscription.current_period_start, new.submitted_at),
      coalesce(new.approved_subscription_end, v_subscription.current_period_end),
      coalesce(new.reviewed_at, clock_timestamp())
    ) on conflict (billing_submission_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger shop_billing_capture_approved_period
after insert or update of status on public.shop_billing_submissions
for each row execute function shop_private.capture_approved_commercial_period();

insert into public.subscription_commercial_periods (
  subscription_id, billing_submission_id, catalog_terms_id, plan_slug,
  plan_name, billing_interval, currency, price_amount, resource_limits,
  period_start, period_end, approved_at
)
select subscription.id, submission.id, submission.catalog_terms_id,
  submission.plan_slug_snapshot, submission.plan_name_snapshot,
  submission.billing_interval_snapshot, submission.currency,
  submission.expected_amount::integer, submission.resource_limits_snapshot,
  coalesce(subscription.current_period_start, submission.submitted_at),
  coalesce(submission.approved_subscription_end, subscription.current_period_end),
  coalesce(submission.reviewed_at, submission.submitted_at)
from public.shop_billing_submissions submission
join public.shop_memberships membership on membership.shop_id = submission.shop_id
  and membership.role = 'owner'
join public.subscriptions subscription on subscription.profile_id = membership.profile_id
where submission.status = 'approved'
  and coalesce(submission.approved_subscription_end, subscription.current_period_end)
    > coalesce(subscription.current_period_start, submission.submitted_at)
on conflict (billing_submission_id) do nothing;

revoke all on function
  shop_private.valid_resource_limits(jsonb),
  shop_private.reject_commercial_snapshot_mutation(),
  shop_private.reconcile_plan_catalog(),
  shop_private.subscription_catalog_terms(),
  shop_private.subscription_resource_limit(uuid, text),
  shop_private.enforce_active_resource_limit(),
  shop_private.billing_notice_commercial_snapshot(),
  shop_private.capture_approved_commercial_period()
from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
