-- SS-ADMIN-001: independent platform-operator authority, bounded cross-tenant
-- support controls, immutable audit evidence, and read-only operational audit.

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete restrict,
  role text not null check (role in ('observer', 'operator')),
  display_name text,
  enabled boolean not null default true,
  provisioned_at timestamptz not null default clock_timestamp(),
  check (display_name is null or length(btrim(display_name)) between 1 and 160)
);

create table public.platform_admin_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  actor_role text not null check (actor_role in ('operator')),
  shop_id uuid not null references public.shops (id) on delete restrict,
  action text not null check (action in (
    'suspend_shop', 'reactivate_shop', 'extend_trial', 'end_trial',
    'activate_subscription', 'extend_subscription', 'suspend_subscription',
    'correct_billing_metadata', 'add_support_note'
  )),
  target_type text not null check (target_type in ('shop', 'subscription', 'support_note')),
  target_id uuid,
  reason text not null check (length(btrim(reason)) between 2 and 1000),
  parameters jsonb not null default '{}'::jsonb,
  before_state jsonb,
  after_state jsonb not null,
  occurred_at timestamptz not null default clock_timestamp(),
  check (jsonb_typeof(parameters) = 'object')
);

create index platform_admin_events_shop_time_idx
  on public.platform_admin_events (shop_id, occurred_at desc, id desc);
create index platform_admin_events_actor_time_idx
  on public.platform_admin_events (actor_user_id, occurred_at desc, id desc);

create table public.shop_membership_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  membership_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_user_id uuid references auth.users (id) on delete restrict,
  before_state jsonb,
  after_state jsonb,
  occurred_at timestamptz not null default clock_timestamp(),
  check (before_state is not null or after_state is not null)
);

create index shop_membership_events_shop_time_idx
  on public.shop_membership_events (shop_id, occurred_at desc, id desc);

create table public.shop_billing_submissions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  submitted_by_profile_id uuid references public.profiles (id) on delete restrict,
  kind text not null check (kind in ('activation', 'renewal', 'correction')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  amount numeric(12, 2) check (amount is null or amount >= 0),
  currency text not null default 'EGP' check (length(currency) between 3 and 8),
  reference text,
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default clock_timestamp(),
  reviewed_at timestamptz,
  check (reference is null or length(reference) <= 200),
  check (jsonb_typeof(metadata) = 'object')
);

create index shop_billing_submissions_shop_time_idx
  on public.shop_billing_submissions (shop_id, submitted_at desc, id desc);
create index shop_billing_submissions_pending_idx
  on public.shop_billing_submissions (submitted_at, id) where status = 'pending';

alter table public.subscriptions
  add column billing_metadata jsonb not null default '{}'::jsonb,
  add constraint subscriptions_billing_metadata_object
    check (jsonb_typeof(billing_metadata) = 'object');

alter table public.platform_admins enable row level security;
alter table public.platform_admin_events enable row level security;
alter table public.shop_membership_events enable row level security;
alter table public.shop_billing_submissions enable row level security;

revoke all on table public.platform_admins, public.platform_admin_events,
  public.shop_membership_events, public.shop_billing_submissions
from public, anon, authenticated;
grant all on table public.platform_admins, public.platform_admin_events,
  public.shop_membership_events, public.shop_billing_submissions to service_role;

-- A suspended shop must be denied by the same helpers used by RLS and all
-- supported command surfaces. Subscription expiry intentionally remains a
-- write restriction rather than a history-read restriction.
create or replace function shop_private.is_member(p_shop_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.shop_memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    join public.shops shop on shop.id = membership.shop_id
      and shop.portal_id = profile.portal_id
    where membership.shop_id = p_shop_id
      and profile.user_id = (select auth.uid())
      and profile.status = 'active'::public.profile_status
      and membership.status = 'active'::public.shop_membership_status
      and shop.status = 'active'::public.shop_status
  );
$$;

create or replace function shop_private.is_owner(p_shop_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.shop_memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    join public.shops shop on shop.id = membership.shop_id
      and shop.portal_id = profile.portal_id
    where membership.shop_id = p_shop_id
      and membership.role = 'owner'
      and profile.user_id = (select auth.uid())
      and profile.status = 'active'::public.profile_status
      and membership.status = 'active'::public.shop_membership_status
      and shop.status = 'active'::public.shop_status
  );
$$;

create or replace function shop_private.has_permission(
  p_shop_id uuid, p_permission_key text
) returns boolean language sql stable security definer set search_path = '' as $$
  select shop_private.is_owner(p_shop_id) or exists (
    select 1
    from public.shop_memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    join public.shops shop on shop.id = membership.shop_id
      and shop.portal_id = profile.portal_id
    join public.membership_roles membership_role
      on membership_role.membership_id = membership.id
    join public.roles role on role.id = membership_role.role_id
      and role.shop_id = membership.shop_id
    join public.role_permissions role_permission on role_permission.role_id = role.id
    join public.permissions permission on permission.id = role_permission.permission_id
      and permission.portal_id = shop.portal_id
    where membership.shop_id = p_shop_id
      and profile.user_id = (select auth.uid())
      and profile.status = 'active'::public.profile_status
      and membership.status = 'active'::public.shop_membership_status
      and shop.status = 'active'::public.shop_status
      and permission.key = p_permission_key
  );
$$;

create function shop_private.platform_admin_role()
returns text language sql stable security definer set search_path = '' as $$
  select admin.role
  from public.platform_admins admin
  where admin.user_id = auth.uid()
    and admin.enabled
    and auth.role() = 'authenticated';
$$;

create function shop_private.assert_platform_admin(p_write boolean default false)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_role text := shop_private.platform_admin_role();
begin
  if v_role is null then
    raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_write and v_role <> 'operator' then
    raise exception 'PLATFORM_OPERATOR_REQUIRED' using errcode = '42501';
  end if;
  return v_role;
end;
$$;

create function shop_private.preserve_platform_admin_event()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'PLATFORM_ADMIN_EVENT_IMMUTABLE' using errcode = '55000';
end;
$$;

create trigger platform_admin_events_immutable
before update or delete or truncate on public.platform_admin_events
for each statement execute function shop_private.preserve_platform_admin_event();

create trigger shop_membership_events_immutable
before update or delete or truncate on public.shop_membership_events
for each statement execute function shop_private.preserve_platform_admin_event();

create function shop_private.record_shop_membership_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.shop_membership_events (
    shop_id, membership_id, action, actor_user_id, before_state, after_state
  ) values (
    coalesce(new.shop_id, old.shop_id), coalesce(new.id, old.id), lower(tg_op),
    auth.uid(), case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger shop_memberships_audit
after insert or update or delete on public.shop_memberships
for each row execute function shop_private.record_shop_membership_event();

create function shop_private.platform_admin_shop_snapshot(p_shop_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'shop', jsonb_build_object(
      'id', shop.id, 'name', shop.name, 'status', shop.status,
      'businessMode', shop.business_mode, 'createdAt', shop.created_at
    ),
    'owner', case when owner.profile_id is null then null else jsonb_build_object(
      'profileId', owner.profile_id, 'name', owner.display_name,
      'email', owner.email_snapshot, 'membershipStatus', owner.membership_status
    ) end,
    'subscription', case when subscription.id is null then null else jsonb_build_object(
      'id', subscription.id, 'status', subscription.status,
      'planId', subscription.plan_id, 'planSlug', plan.slug, 'planName', plan.name,
      'trialStartAt', subscription.trial_start_at,
      'trialEndAt', subscription.trial_end_at,
      'periodStart', subscription.current_period_start,
      'periodEnd', subscription.current_period_end,
      'lockedAt', subscription.locked_at,
      'billingMetadata', subscription.billing_metadata
    ) end
  )
  from public.shops shop
  left join lateral (
    select membership.profile_id, membership.status as membership_status,
      profile.display_name, profile.email_snapshot
    from public.shop_memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    where membership.shop_id = shop.id and membership.role = 'owner'
    order by (membership.status = 'active') desc, membership.created_at, membership.id
    limit 1
  ) owner on true
  left join public.subscriptions subscription on subscription.profile_id = owner.profile_id
  left join public.plans plan on plan.id = subscription.plan_id
  where shop.id = p_shop_id;
$$;

revoke all on function shop_private.platform_admin_role(),
  shop_private.assert_platform_admin(boolean),
  shop_private.preserve_platform_admin_event(),
  shop_private.record_shop_membership_event(),
  shop_private.platform_admin_shop_snapshot(uuid)
from public, anon, authenticated, service_role;

create function public.platform_admin_session()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_role text;
begin
  v_role := shop_private.assert_platform_admin(false);
  return jsonb_build_object(
    'userId', auth.uid(),
    'role', v_role,
    'canMutate', v_role = 'operator',
    'displayName', (
      select admin.display_name from public.platform_admins admin
      where admin.user_id = auth.uid()
    )
  );
end;
$$;

create function public.platform_admin_read(
  p_resource text,
  p_shop_id uuid default null,
  p_search text default null,
  p_status text default null,
  p_page integer default 1,
  p_page_size integer default 25
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_data jsonb;
  v_search text := nullif(btrim(p_search), '');
  v_status text := nullif(btrim(p_status), '');
begin
  perform shop_private.assert_platform_admin(false);
  if p_resource not in ('dashboard', 'shops', 'shop', 'audit')
    or p_page is null or p_page < 1 or p_page > 100000
    or p_page_size is null or p_page_size < 1 or p_page_size > 100
    or length(coalesce(v_search, '')) > 100
    or length(coalesce(v_status, '')) > 64
    or (p_resource = 'shop' and p_shop_id is null) then
    raise exception 'PLATFORM_ADMIN_READ_INVALID' using errcode = '22023';
  end if;

  if p_resource = 'dashboard' then
    select jsonb_build_object(
      'shops', count(*)::integer,
      'activeShops', count(*) filter (where shop.status = 'active')::integer,
      'suspendedShops', count(*) filter (where shop.status = 'suspended')::integer,
      'locations', (select count(*)::integer from public.shop_locations location where location.status = 'active'),
      'members', (select count(*)::integer from public.shop_memberships membership where membership.status = 'active'),
      'activeTrials', (select count(distinct membership.shop_id)::integer
        from public.shop_memberships membership
        join public.subscriptions subscription on subscription.profile_id = membership.profile_id
        where membership.role = 'owner' and subscription.status = 'trialing'
          and subscription.trial_end_at > now()),
      'trialsExpiringSoon', (select count(distinct membership.shop_id)::integer
        from public.shop_memberships membership
        join public.subscriptions subscription on subscription.profile_id = membership.profile_id
        where membership.role = 'owner' and subscription.status = 'trialing'
          and subscription.trial_end_at > now()
          and subscription.trial_end_at <= now() + interval '7 days'),
      'activeSubscriptions', (select count(distinct membership.shop_id)::integer
        from public.shop_memberships membership
        join public.subscriptions subscription on subscription.profile_id = membership.profile_id
        where membership.role = 'owner' and subscription.status = 'active'
          and subscription.current_period_end > now()),
      'readOnlySubscriptions', (select count(distinct membership.shop_id)::integer
        from public.shop_memberships membership
        join public.subscriptions subscription on subscription.profile_id = membership.profile_id
        where membership.role = 'owner' and not (
          (subscription.status = 'trialing' and subscription.trial_end_at > now())
          or (subscription.status = 'active' and subscription.current_period_end > now())
        )),
      'pendingBillingSubmissions', (select count(*)::integer
        from public.shop_billing_submissions submission where submission.status = 'pending'),
      'recentEvents', (select coalesce(jsonb_agg(to_jsonb(event_row)), '[]'::jsonb)
        from (
          select event.id, event.shop_id as "shopId", shop_event.name as "shopName",
            event.action, event.actor_user_id as "actorUserId", event.actor_role as "actorRole",
            event.reason, event.before_state as "beforeState",
            event.after_state as "afterState", event.occurred_at as "occurredAt"
          from public.platform_admin_events event
          join public.shops shop_event on shop_event.id = event.shop_id
          order by event.occurred_at desc, event.id desc limit 10
        ) event_row)
    ) into v_data
    from public.shops shop;

  elsif p_resource = 'shops' then
    with shop_rows as (
      select shop.id, shop.name, shop.status::text as status,
        shop.business_mode::text as "businessMode", shop.created_at as "createdAt",
        owner.display_name as "ownerName", owner.email_snapshot as "ownerEmail",
        coalesce(location_count.value, 0)::integer as "locationCount",
        coalesce(member_count.value, 0)::integer as "memberCount",
        subscription.status as "subscriptionStatus", plan.slug as "planSlug",
        case
          when shop.status = 'suspended' then 'suspended'
          when subscription.status = 'trialing' and subscription.trial_end_at > now() then 'trial'
          when subscription.status = 'active' and subscription.current_period_end > now() then 'active'
          else 'read_only'
        end as "accessState"
      from public.shops shop
      left join lateral (
        select membership.profile_id, profile.display_name, profile.email_snapshot
        from public.shop_memberships membership
        join public.profiles profile on profile.id = membership.profile_id
        where membership.shop_id = shop.id and membership.role = 'owner'
        order by (membership.status = 'active') desc, membership.created_at, membership.id limit 1
      ) owner on true
      left join public.subscriptions subscription on subscription.profile_id = owner.profile_id
      left join public.plans plan on plan.id = subscription.plan_id
      left join lateral (select count(*) as value from public.shop_locations location where location.shop_id = shop.id and location.status = 'active') location_count on true
      left join lateral (select count(*) as value from public.shop_memberships membership where membership.shop_id = shop.id and membership.status = 'active') member_count on true
      where (v_search is null or shop.name ilike '%' || v_search || '%'
        or shop.id::text ilike '%' || v_search || '%'
        or coalesce(owner.email_snapshot, '') ilike '%' || v_search || '%')
        and (v_status is null or shop.status::text = v_status
          or (v_status = 'read_only' and not (
            (subscription.status = 'trialing' and subscription.trial_end_at > now())
            or (subscription.status = 'active' and subscription.current_period_end > now())
          )))
    ), page_rows as (
      select * from shop_rows order by "createdAt" desc, id
      limit p_page_size offset (p_page - 1) * p_page_size
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page_row)) from page_rows page_row), '[]'::jsonb),
      'total', (select count(*)::integer from shop_rows),
      'page', p_page,
      'pageSize', p_page_size
    ) into v_data;

  elsif p_resource = 'audit' then
    with audit_rows as (
      select event.id, event.shop_id as "shopId", shop.name as "shopName",
        event.actor_user_id as "actorUserId", event.actor_role as "actorRole",
        event.action, event.target_type as "targetType", event.target_id as "targetId",
        event.reason, event.parameters, event.before_state as "beforeState",
        event.after_state as "afterState", event.occurred_at as "occurredAt"
      from public.platform_admin_events event
      join public.shops shop on shop.id = event.shop_id
      where (p_shop_id is null or event.shop_id = p_shop_id)
        and (v_search is null or shop.name ilike '%' || v_search || '%'
          or event.action ilike '%' || v_search || '%'
          or event.reason ilike '%' || v_search || '%')
        and (v_status is null or event.action = v_status)
    ), page_rows as (
      select * from audit_rows order by "occurredAt" desc, id
      limit p_page_size offset (p_page - 1) * p_page_size
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page_row)) from page_rows page_row), '[]'::jsonb),
      'total', (select count(*)::integer from audit_rows),
      'page', p_page,
      'pageSize', p_page_size
    ) into v_data;

  else
    if not exists (select 1 from public.shops shop where shop.id = p_shop_id) then
      raise exception 'PLATFORM_ADMIN_TARGET_NOT_FOUND' using errcode = '22023';
    end if;
    select shop_private.platform_admin_shop_snapshot(p_shop_id) || jsonb_build_object(
      'locations', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', location.id, 'name', location.name, 'code', location.code,
          'status', location.status, 'isDefault', location.is_default
        ) order by location.is_default desc, location.created_at, location.id), '[]'::jsonb)
        from public.shop_locations location where location.shop_id = p_shop_id),
      'members', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', membership.id, 'role', membership.role, 'status', membership.status,
          'name', profile.display_name, 'email', profile.email_snapshot,
          'createdAt', membership.created_at
        ) order by (membership.role = 'owner') desc, membership.created_at, membership.id), '[]'::jsonb)
        from public.shop_memberships membership
        join public.profiles profile on profile.id = membership.profile_id
        where membership.shop_id = p_shop_id),
      'usage', jsonb_build_object(
        'members', (select count(*)::integer from public.shop_memberships membership where membership.shop_id = p_shop_id and membership.status = 'active'),
        'locations', (select count(*)::integer from public.shop_locations location where location.shop_id = p_shop_id and location.status = 'active'),
        'products', (select count(*)::integer from public.products product where product.shop_id = p_shop_id and product.is_active),
        'services', (select count(*)::integer from public.services service where service.shop_id = p_shop_id and service.is_active),
        'limits', (select coalesce(plan.features, '{}'::jsonb)
          from public.shop_memberships owner_membership
          join public.subscriptions subscription on subscription.profile_id = owner_membership.profile_id
          join public.plans plan on plan.id = subscription.plan_id
          where owner_membership.shop_id = p_shop_id and owner_membership.role = 'owner'
          order by (owner_membership.status = 'active') desc, owner_membership.created_at limit 1)
      ),
      'billingHistory', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', submission.id, 'kind', submission.kind, 'status', submission.status,
          'amount', submission.amount, 'currency', submission.currency,
          'reference', submission.reference, 'metadata', submission.metadata,
          'submittedAt', submission.submitted_at, 'reviewedAt', submission.reviewed_at
        ) order by submission.submitted_at desc, submission.id desc), '[]'::jsonb)
        from public.shop_billing_submissions submission where submission.shop_id = p_shop_id),
      'sensitiveEvents', (select coalesce(jsonb_agg(to_jsonb(sensitive_event)
          order by sensitive_event."occurredAt" desc, sensitive_event.id desc), '[]'::jsonb)
        from (
          select event.id, 'platform_admin'::text as type, event.action as action,
            event.reason, event.actor_user_id as "actorId", event.occurred_at as "occurredAt",
            event.after_state as details
          from public.platform_admin_events event where event.shop_id = p_shop_id
          union all
          select adjustment.id, 'customer_payment'::text, adjustment.kind::text,
            adjustment.reason, adjustment.created_by_profile_id, adjustment.created_at,
            jsonb_build_object('amount', adjustment.amount, 'effectiveAt', adjustment.effective_at)
          from public.customer_payment_adjustments adjustment where adjustment.shop_id = p_shop_id
          union all
          select reversal.id, 'supplier_payment'::text, 'reversal'::text,
            reversal.reason, reversal.created_by_profile_id, reversal.created_at,
            jsonb_build_object('amount', reversal.amount, 'effectiveAt', reversal.effective_at)
          from public.supplier_payment_reversals reversal where reversal.shop_id = p_shop_id
          union all
          select stock_count.id, 'stock'::text, 'count'::text,
            stock_count.reason, stock_count.created_by_profile_id, stock_count.created_at,
            jsonb_build_object('productId', stock_count.product_id,
              'expected', stock_count.expected_quantity, 'counted', stock_count.counted_quantity,
              'variance', stock_count.variance_quantity, 'reference', stock_count.external_reference)
          from public.stock_counts stock_count where stock_count.shop_id = p_shop_id
          union all
          select mode_change.id, 'business_mode'::text, 'changed'::text,
            null::text, mode_change.changed_by_profile_id, mode_change.changed_at,
            jsonb_build_object('before', mode_change.previous_mode, 'after', mode_change.new_mode)
          from public.shop_business_mode_changes mode_change where mode_change.shop_id = p_shop_id
          union all
          select membership_event.id, 'team'::text, membership_event.action,
            null::text, membership_event.actor_user_id, membership_event.occurred_at,
            jsonb_build_object('membershipId', membership_event.membership_id,
              'before', membership_event.before_state, 'after', membership_event.after_state)
          from public.shop_membership_events membership_event where membership_event.shop_id = p_shop_id
        ) sensitive_event),
      'supportNotes', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', event.id, 'note', event.parameters #>> '{payload,note}', 'reason', event.reason,
          'actorUserId', event.actor_user_id, 'createdAt', event.occurred_at
        ) order by event.occurred_at desc, event.id desc), '[]'::jsonb)
        from public.platform_admin_events event
        where event.shop_id = p_shop_id and event.action = 'add_support_note')
    ) into v_data;
  end if;

  return v_data;
end;
$$;

create function public.platform_admin_command(
  p_request_id uuid,
  p_shop_id uuid,
  p_action text,
  p_reason text,
  p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_before jsonb;
  v_after jsonb;
  v_parameters jsonb;
  v_prior public.platform_admin_events;
  v_owner_profile_id uuid;
  v_subscription_id uuid;
  v_plan_id uuid;
  v_days integer;
  v_target_type text;
  v_target_id uuid;
  v_note text;
  v_metadata jsonb;
begin
  v_role := shop_private.assert_platform_admin(true);
  p_payload := coalesce(p_payload, '{}'::jsonb);
  if p_request_id is null or p_shop_id is null
    or p_action not in (
      'suspend_shop', 'reactivate_shop', 'extend_trial', 'end_trial',
      'activate_subscription', 'extend_subscription', 'suspend_subscription',
      'correct_billing_metadata', 'add_support_note'
    )
    or p_reason is null or length(btrim(p_reason)) not between 2 and 1000
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 4096 then
    raise exception 'PLATFORM_ADMIN_COMMAND_INVALID' using errcode = '22023';
  end if;

  v_parameters := jsonb_build_object(
    'shopId', p_shop_id, 'action', p_action, 'payload', p_payload
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_request_id::text, 0)
  );
  select * into v_prior from public.platform_admin_events event
  where event.request_id = p_request_id;
  if found then
    if v_prior.actor_user_id <> auth.uid() or v_prior.shop_id <> p_shop_id
      or v_prior.action <> p_action or v_prior.reason <> btrim(p_reason)
      or v_prior.parameters is distinct from v_parameters then
      raise exception 'PLATFORM_ADMIN_COMMAND_KEY_REUSED' using errcode = '22023';
    end if;
    return jsonb_build_object('data', v_prior.after_state, 'replayed', true,
      'auditId', v_prior.id);
  end if;

  perform 1 from public.shops shop where shop.id = p_shop_id for update;
  if not found then
    raise exception 'PLATFORM_ADMIN_TARGET_NOT_FOUND' using errcode = '22023';
  end if;
  select membership.profile_id into v_owner_profile_id
  from public.shop_memberships membership
  where membership.shop_id = p_shop_id and membership.role = 'owner'
  order by (membership.status = 'active') desc, membership.created_at, membership.id
  limit 1;
  select subscription.id into v_subscription_id
  from public.subscriptions subscription
  where subscription.profile_id = v_owner_profile_id for update;

  v_before := shop_private.platform_admin_shop_snapshot(p_shop_id);
  v_target_type := case when p_action in ('suspend_shop', 'reactivate_shop') then 'shop'
    when p_action = 'add_support_note' then 'support_note' else 'subscription' end;
  v_target_id := case when v_target_type = 'shop' then p_shop_id
    when v_target_type = 'subscription' then v_subscription_id else null end;

  if p_action = 'suspend_shop' then
    if p_payload <> '{}'::jsonb then raise exception 'PLATFORM_ADMIN_COMMAND_INVALID' using errcode = '22023'; end if;
    update public.shops set status = 'suspended' where id = p_shop_id;
  elsif p_action = 'reactivate_shop' then
    if p_payload <> '{}'::jsonb then raise exception 'PLATFORM_ADMIN_COMMAND_INVALID' using errcode = '22023'; end if;
    update public.shops set status = 'active' where id = p_shop_id;
  elsif p_action in ('extend_trial', 'end_trial', 'activate_subscription',
      'extend_subscription', 'suspend_subscription', 'correct_billing_metadata')
      and v_subscription_id is null then
    raise exception 'PLATFORM_ADMIN_SUBSCRIPTION_NOT_FOUND' using errcode = '22023';
  elsif p_action = 'extend_trial' then
    if (p_payload - 'days') <> '{}'::jsonb
      or jsonb_typeof(p_payload -> 'days') <> 'number' then
      raise exception 'PLATFORM_ADMIN_COMMAND_INVALID' using errcode = '22023';
    end if;
    v_days := (p_payload ->> 'days')::integer;
    if v_days not between 1 and 365 then raise exception 'PLATFORM_ADMIN_COMMAND_INVALID' using errcode = '22023'; end if;
    update public.subscriptions set status = 'trialing',
      trial_end_at = greatest(coalesce(trial_end_at, now()), now()) + make_interval(days => v_days),
      current_period_end = greatest(coalesce(current_period_end, now()), now()) + make_interval(days => v_days),
      locked_at = null, updated_at = now()
    where id = v_subscription_id;
  elsif p_action = 'end_trial' then
    if p_payload <> '{}'::jsonb then raise exception 'PLATFORM_ADMIN_COMMAND_INVALID' using errcode = '22023'; end if;
    update public.subscriptions set status = 'expired', trial_end_at = now(),
      current_period_end = now(), locked_at = now(), updated_at = now()
    where id = v_subscription_id;
  elsif p_action = 'activate_subscription' then
    if (p_payload - array['days', 'planSlug']) <> '{}'::jsonb
      or jsonb_typeof(p_payload -> 'days') <> 'number'
      or jsonb_typeof(p_payload -> 'planSlug') <> 'string' then
      raise exception 'PLATFORM_ADMIN_COMMAND_INVALID' using errcode = '22023';
    end if;
    v_days := (p_payload ->> 'days')::integer;
    if v_days not between 1 and 3660 then raise exception 'PLATFORM_ADMIN_COMMAND_INVALID' using errcode = '22023'; end if;
    select plan.id into v_plan_id from public.plans plan
    join public.portals portal on portal.id = plan.portal_id
    where portal.key = 'shop-crm' and plan.slug = p_payload ->> 'planSlug'
      and plan.is_active and not plan.is_coming_soon;
    if v_plan_id is null then raise exception 'PLATFORM_ADMIN_PLAN_NOT_FOUND' using errcode = '22023'; end if;
    update public.subscriptions set plan_id = v_plan_id, status = 'active',
      current_period_start = now(), current_period_end = now() + make_interval(days => v_days),
      locked_at = null, updated_at = now()
    where id = v_subscription_id;
  elsif p_action = 'extend_subscription' then
    if (p_payload - 'days') <> '{}'::jsonb
      or jsonb_typeof(p_payload -> 'days') <> 'number' then
      raise exception 'PLATFORM_ADMIN_COMMAND_INVALID' using errcode = '22023';
    end if;
    v_days := (p_payload ->> 'days')::integer;
    if v_days not between 1 and 3660 then raise exception 'PLATFORM_ADMIN_COMMAND_INVALID' using errcode = '22023'; end if;
    update public.subscriptions set status = 'active',
      current_period_start = coalesce(current_period_start, now()),
      current_period_end = greatest(coalesce(current_period_end, now()), now()) + make_interval(days => v_days),
      locked_at = null, updated_at = now()
    where id = v_subscription_id;
  elsif p_action = 'suspend_subscription' then
    if p_payload <> '{}'::jsonb then raise exception 'PLATFORM_ADMIN_COMMAND_INVALID' using errcode = '22023'; end if;
    update public.subscriptions set status = 'suspended', locked_at = now(), updated_at = now()
    where id = v_subscription_id;
  elsif p_action = 'correct_billing_metadata' then
    if (p_payload - array['billingReference', 'billingNote']) <> '{}'::jsonb
      or (p_payload ? 'billingReference' and jsonb_typeof(p_payload -> 'billingReference') <> 'string')
      or (p_payload ? 'billingNote' and jsonb_typeof(p_payload -> 'billingNote') <> 'string')
      or length(coalesce(p_payload ->> 'billingReference', '')) > 200
      or length(coalesce(p_payload ->> 'billingNote', '')) > 1000 then
      raise exception 'PLATFORM_ADMIN_COMMAND_INVALID' using errcode = '22023';
    end if;
    v_metadata := jsonb_strip_nulls(jsonb_build_object(
      'billingReference', nullif(btrim(p_payload ->> 'billingReference'), ''),
      'billingNote', nullif(btrim(p_payload ->> 'billingNote'), '')
    ));
    update public.subscriptions set billing_metadata = v_metadata, updated_at = now()
    where id = v_subscription_id;
  else
    if (p_payload - 'note') <> '{}'::jsonb
      or jsonb_typeof(p_payload -> 'note') <> 'string' then
      raise exception 'PLATFORM_ADMIN_COMMAND_INVALID' using errcode = '22023';
    end if;
    v_note := btrim(p_payload ->> 'note');
    if length(v_note) not between 2 and 2000 then
      raise exception 'PLATFORM_ADMIN_COMMAND_INVALID' using errcode = '22023';
    end if;
  end if;

  v_after := case when p_action = 'add_support_note'
    then v_before || jsonb_build_object('supportNote', v_note)
    else shop_private.platform_admin_shop_snapshot(p_shop_id) end;

  insert into public.platform_admin_events (
    request_id, actor_user_id, actor_role, shop_id, action, target_type,
    target_id, reason, parameters, before_state, after_state
  ) values (
    p_request_id, auth.uid(), v_role, p_shop_id, p_action, v_target_type,
    v_target_id, btrim(p_reason), v_parameters, v_before, v_after
  ) returning id into v_target_id;

  return jsonb_build_object('data', v_after, 'replayed', false, 'auditId', v_target_id);
end;
$$;

revoke all on function public.platform_admin_session(),
  public.platform_admin_read(text, uuid, text, text, integer, integer),
  public.platform_admin_command(uuid, uuid, text, text, jsonb)
from public, anon, service_role;
grant execute on function public.platform_admin_session(),
  public.platform_admin_read(text, uuid, text, text, integer, integer),
  public.platform_admin_command(uuid, uuid, text, text, jsonb)
to authenticated;

notify pgrst, 'reload schema';
