-- SS-SUB-001: integrated commercial lifecycle acceptance. The database runner
-- wraps this suite in a transaction and rolls every synthetic customer back.

create temporary table shop_subscription_lifecycle_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() employee_id,
  gen_random_uuid() observer_id, gen_random_uuid() operator_id,
  gen_random_uuid() barber_owner_id, gen_random_uuid() barber_staff_id,
  gen_random_uuid() signup_request_id, gen_random_uuid() approval_request_id;
grant select on shop_subscription_lifecycle_fixture to authenticated;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@ss-sub-001.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id id from shop_subscription_lifecycle_fixture
  union all select employee_id from shop_subscription_lifecycle_fixture
  union all select observer_id from shop_subscription_lifecycle_fixture
  union all select operator_id from shop_subscription_lifecycle_fixture
  union all select barber_owner_id from shop_subscription_lifecycle_fixture
  union all select barber_staff_id from shop_subscription_lifecycle_fixture
) users;

insert into public.platform_admins (user_id, role, display_name)
select observer_id, 'observer', 'Lifecycle observer'
from shop_subscription_lifecycle_fixture
union all
select operator_id, 'operator', 'Lifecycle operator'
from shop_subscription_lifecycle_fixture;

-- Representative first-barber reimport: a grandfathered Pro subscription,
-- two locations, ordinary staff, and a normal service survive repeated catalog
-- reconciliation without being moved to a new plan or losing operational data.
do $$
declare
  v_portal uuid := (select id from public.portals where key = 'shop-crm');
  v_pro uuid := (select id from public.plans where portal_id = v_portal and slug = 'pro');
  v_owner_profile uuid;
  v_staff_profile uuid;
  v_staff_membership uuid;
  v_barber_role uuid;
  v_shop uuid;
  v_service uuid;
  v_before jsonb;
  v_after jsonb;
begin
  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select barber_owner_id, v_portal, 'First barber owner',
    barber_owner_id::text || '@ss-sub-001.invalid'
  from shop_subscription_lifecycle_fixture
  returning id into v_owner_profile;
  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select barber_staff_id, v_portal, 'First barber staff',
    barber_staff_id::text || '@ss-sub-001.invalid'
  from shop_subscription_lifecycle_fixture
  returning id into v_staff_profile;
  insert into public.shops (portal_id, name, business_mode)
  values (v_portal, 'First barber legacy fixture', 'service') returning id into v_shop;
  insert into public.shop_memberships (shop_id, profile_id, role, status)
  values (v_shop, v_owner_profile, 'owner', 'active');
  insert into public.shop_memberships (shop_id, profile_id, role, status)
  values (v_shop, v_staff_profile, 'employee', 'active')
  returning id into v_staff_membership;
  select id into v_barber_role from public.roles
  where shop_id = v_shop and key = 'barber';
  insert into public.membership_roles (membership_id, role_id)
  values (v_staff_membership, v_barber_role);
  insert into public.subscriptions (
    profile_id, plan_id, status, trial_start_at, trial_end_at,
    current_period_start, current_period_end, trial_consumed
  ) values (
    v_owner_profile, v_pro, 'active', now() - interval '60 days',
    now() - interval '46 days', now() - interval '5 days',
    now() + interval '25 days', true
  );
  insert into public.shop_locations (shop_id, name, code)
  values (v_shop, 'First barber second branch', 'B2');
  insert into public.services (
    shop_id, name, base_sale_price, default_discount_type,
    default_discount_value, created_by_profile_id
  ) values (v_shop, 'First barber haircut', 100, 'amount', 0, v_owner_profile)
  returning id into v_service;
  insert into public.service_location_availability (shop_id, service_id, location_id)
  select v_shop, v_service, location.id from public.shop_locations location
  where location.shop_id = v_shop;
  insert into public.service_staff_eligibility (shop_id, service_id, membership_id)
  values (v_shop, v_service, v_staff_membership);

  select jsonb_build_object(
    'planId', subscription.plan_id,
    'status', subscription.status,
    'periodEnd', subscription.current_period_end,
    'locations', (select count(*) from public.shop_locations where shop_id = v_shop),
    'members', (select count(*) from public.shop_memberships where shop_id = v_shop),
    'services', (select count(*) from public.services where shop_id = v_shop),
    'serviceLocations', (select count(*) from public.service_location_availability where shop_id = v_shop),
    'serviceStaff', (select count(*) from public.service_staff_eligibility where shop_id = v_shop)
  ) into v_before
  from public.subscriptions subscription where subscription.profile_id = v_owner_profile;

  perform shop_private.reconcile_plan_catalog();
  perform shop_private.reconcile_plan_catalog();

  select jsonb_build_object(
    'planId', subscription.plan_id,
    'status', subscription.status,
    'periodEnd', subscription.current_period_end,
    'locations', (select count(*) from public.shop_locations where shop_id = v_shop),
    'members', (select count(*) from public.shop_memberships where shop_id = v_shop),
    'services', (select count(*) from public.services where shop_id = v_shop),
    'serviceLocations', (select count(*) from public.service_location_availability where shop_id = v_shop),
    'serviceStaff', (select count(*) from public.service_staff_eligibility where shop_id = v_shop)
  ) into v_after
  from public.subscriptions subscription where subscription.profile_id = v_owner_profile;

  if v_before is distinct from v_after
    or v_after #>> '{locations}' <> '2'
    or v_after #>> '{members}' <> '2'
    or v_after #>> '{services}' <> '1'
    or v_after #>> '{serviceLocations}' <> '2'
    or v_after #>> '{serviceStaff}' <> '1'
    or exists (select 1 from public.plans where id = v_pro
      and (is_active or is_public or is_purchasable)) then
    raise exception 'first-barber legacy plan reimport changed customer state';
  end if;
end;
$$;

-- Signup is idempotent: a retry cannot create another shop, subscription, or
-- trial, and cannot replace the original selected plan or business mode.
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid;
  v_retry uuid;
  v_profile uuid;
begin
  v_shop := public.create_owner_shop(
    'SS-SUB lifecycle shop', 'team', 'service'::public.business_mode
  );
  v_retry := public.create_owner_shop(
    'A retry must not rename the shop', 'multi', 'mixed'::public.business_mode
  );
  select membership.profile_id into v_profile
  from public.shop_memberships membership
  where membership.shop_id = v_shop and membership.role = 'owner';

  if v_retry <> v_shop then raise exception 'signup retry created another shop'; end if;
  perform set_config('ss_sub.shop', v_shop::text, true);
  perform set_config('ss_sub.owner_profile', v_profile::text, true);
end;
$$;
reset role;

do $$
declare
  v_shop uuid := current_setting('ss_sub.shop')::uuid;
  v_profile uuid := current_setting('ss_sub.owner_profile')::uuid;
  v_subscription public.subscriptions;
begin
  select * into v_subscription from public.subscriptions
  where profile_id = v_profile;
  if (select count(*) from public.shop_memberships membership
      join public.subscriptions subscription
        on subscription.profile_id = membership.profile_id
      where membership.shop_id = v_shop and membership.role = 'owner') <> 1
    or v_subscription.trial_end_at <> v_subscription.trial_start_at + interval '7 days'
    or (select plan.slug from public.plans plan where plan.id = v_subscription.plan_id) <> 'team'
    or (select shop.business_mode from public.shops shop where shop.id = v_shop) <> 'service' then
    raise exception 'signup did not preserve exactly one selected 7-day trial';
  end if;
end;
$$;

-- A normal employee remains a tenant user, never a billing owner or platform
-- administrator. The Team fixture allows this ordinary employee alongside the owner.
do $$
declare
  v_shop uuid := current_setting('ss_sub.shop')::uuid;
  v_portal uuid := (select portal_id from public.shops where id = v_shop);
  v_profile uuid;
begin
  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select employee_id, v_portal, 'Lifecycle employee',
    employee_id::text || '@ss-sub-001.invalid'
  from shop_subscription_lifecycle_fixture
  returning id into v_profile;
  insert into public.shop_memberships (shop_id, profile_id, role, status)
  values (v_shop, v_profile, 'employee', 'active');
end;
$$;

select set_config('request.jwt.claim.sub', employee_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.shop_billing_read(current_setting('ss_sub.shop')::uuid);
    raise exception 'employee read owner commercial controls';
  exception when insufficient_privilege then null; end;
  begin
    perform public.platform_plan_read('catalog');
    raise exception 'employee read platform plan controls';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Observers can inspect the commercial system but cannot approve or alter it.
select set_config('request.jwt.claim.sub', observer_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
do $$ begin
  if not (public.platform_plan_read('catalog') -> 'items' @> '[
      {"slug":"solo"}, {"slug":"team"}, {"slug":"multi"}
    ]'::jsonb)
    or public.platform_admin_session() ->> 'role' <> 'observer' then
    raise exception 'platform observer commercial projection is incomplete';
  end if;
  begin
    perform public.platform_plan_command(
      gen_random_uuid(), 'renew_subscription', 'Observer denial', null,
      current_setting('ss_sub.shop')::uuid, '{}'::jsonb
    );
    raise exception 'platform observer changed a subscription';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- A negotiated/founder amount is subscription-specific and append-only. It
-- changes the customer quote without changing the global Multi list price.
select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
select public.platform_plan_command(
  gen_random_uuid(), 'set_price_override', 'Founder pilot agreement', null,
  current_setting('ss_sub.shop')::uuid,
  jsonb_build_object(
    'amount', 599, 'currency', 'EGP',
    'effectiveFrom', clock_timestamp()::text, 'expiresAt', null
  )
);
reset role;

-- Owner requests Multi using the manual InstaPay channel. Submission and retry
-- freeze the exact quote but do not grant the requested entitlements.
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('ss_sub.shop')::uuid;
  v_request uuid := (select signup_request_id from shop_subscription_lifecycle_fixture);
  v_notice uuid;
  v_replay uuid;
  v_item jsonb;
begin
  v_notice := public.submit_shop_billing_notice(
    v_request, v_shop, 'multi', 599, current_date, 'INSTAPAY-SS-SUB-UPGRADE'
  );
  v_replay := public.submit_shop_billing_notice(
    v_request, v_shop, 'multi', 599, current_date, 'INSTAPAY-SS-SUB-UPGRADE'
  );
  select item into v_item
  from jsonb_array_elements(public.shop_billing_read(v_shop) -> 'submissions') item
  where (item ->> 'id')::uuid = v_notice;
  if v_notice <> v_replay
    or public.shop_billing_read(v_shop) #>> '{subscription,planSlug}' <> 'team'
    or v_item ->> 'requestedPlanSlug' <> 'multi'
    or (v_item ->> 'listPriceAmount')::numeric <> 999
    or (v_item ->> 'effectivePriceAmount')::numeric <> 599
    or v_item ->> 'priceSource' <> 'override'
    or (select price_amount from public.plans where slug = 'multi') <> 999
    or public.shop_billing_read(v_shop) #>> '{instructions,manualVerification}' <> 'true' then
    raise exception 'manual upgrade quote, retry, or negotiated pricing regressed';
  end if;
  perform set_config('ss_sub.upgrade_notice', v_notice::text, true);
end;
$$;
reset role;

do $$
declare v_notice uuid := current_setting('ss_sub.upgrade_notice')::uuid;
begin
  if (select metadata ->> 'channel'
      from public.shop_billing_submissions where id = v_notice) is distinct from 'instapay_manual'
    or (select (metadata ->> 'automaticVerification')::boolean
      from public.shop_billing_submissions where id = v_notice) is distinct from false then
    raise exception 'manual upgrade persistence metadata regressed';
  end if;
end;
$$;

-- The operator verifies the transfer. Concurrent retry behavior has its own
-- process-level race test; this suite asserts the resulting exact-once state.
select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
do $$
declare
  v_request uuid := (select approval_request_id from shop_subscription_lifecycle_fixture);
  v_result jsonb;
  v_shop uuid := current_setting('ss_sub.shop')::uuid;
begin
  perform public.platform_admin_billing_command(
    gen_random_uuid(), 'mark_under_review',
    current_setting('ss_sub.upgrade_notice')::uuid,
    'External statement review started', '{}'::jsonb
  );
  perform public.platform_admin_billing_command(
    v_request, 'approve', current_setting('ss_sub.upgrade_notice')::uuid,
    'External InstaPay statement matched',
    jsonb_build_object('receivedAmount', 599,
      'receivedReference', 'BANK-SS-SUB-UPGRADE',
      'receivedDate', current_date::text)
  );
  v_result := public.platform_admin_billing_command(
    v_request, 'approve', current_setting('ss_sub.upgrade_notice')::uuid,
    'External InstaPay statement matched',
    jsonb_build_object('receivedAmount', 599,
      'receivedReference', 'BANK-SS-SUB-UPGRADE',
      'receivedDate', current_date::text)
  );
  if not (v_result ->> 'replayed')::boolean
    or public.platform_plan_read('shop', v_shop) #>> '{subscription,planSlug}' <> 'multi' then
    raise exception 'upgrade approval was not an exact-plan, exact-once activation';
  end if;
end;
$$;
reset role;

do $$
declare v_request uuid := (select approval_request_id from shop_subscription_lifecycle_fixture);
begin
  if (select count(*) from public.subscription_commercial_periods
      where billing_submission_id = current_setting('ss_sub.upgrade_notice')::uuid) <> 1
    or (select count(*) from public.platform_billing_events
      where request_id = v_request) <> 1 then
    raise exception 'upgrade approval persistence was not exact-once';
  end if;
end;
$$;

-- Renewal extends exactly one catalog term and records a second immutable
-- commercial period without rewriting the first.
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
do $$
declare v_notice uuid; v_shop uuid := current_setting('ss_sub.shop')::uuid;
begin
  v_notice := public.submit_shop_billing_notice(
    gen_random_uuid(), v_shop, 'multi', 599, current_date,
    'INSTAPAY-SS-SUB-RENEWAL'
  );
  perform set_config('ss_sub.renewal_notice', v_notice::text, true);
  perform set_config('ss_sub.period_before_renewal', (
    select subscription.current_period_end::text
    from public.subscriptions subscription
    join public.shop_memberships membership
      on membership.profile_id = subscription.profile_id
    where membership.shop_id = v_shop and membership.role = 'owner'
  ), true);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
select public.platform_admin_billing_command(
  gen_random_uuid(), 'approve', current_setting('ss_sub.renewal_notice')::uuid,
  'External renewal transfer matched',
  jsonb_build_object('receivedAmount', 599,
    'receivedReference', 'BANK-SS-SUB-RENEWAL',
    'receivedDate', current_date::text)
);
reset role;

do $$
declare v_shop uuid := current_setting('ss_sub.shop')::uuid;
begin
  if (select subscription.current_period_end
      from public.subscriptions subscription
      join public.shop_memberships membership
        on membership.profile_id = subscription.profile_id
      where membership.shop_id = v_shop and membership.role = 'owner')
      <> current_setting('ss_sub.period_before_renewal')::timestamptz + interval '1 month'
    or (select count(*) from public.subscription_commercial_periods period
      join public.subscriptions subscription on subscription.id = period.subscription_id
      join public.shop_memberships membership on membership.profile_id = subscription.profile_id
      where membership.shop_id = v_shop) <> 2 then
    raise exception 'renewal did not extend one term with immutable evidence';
  end if;
end;
$$;

-- A downgrade exposes exact blockers, fails without deleting anything, and
-- succeeds after usage falls under the target limit. The archived branch is
-- retained as history.
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_sub.shop')::uuid; v_notice uuid;
begin
  perform public.save_shop_location(v_shop, null, 'Second pilot branch', 'P2', null, null);
  v_notice := public.submit_shop_billing_notice(
    gen_random_uuid(), v_shop, 'solo',
    (select catalog_terms_id from public.shop_public_plan_catalog()
      where slug='solo' and plan_variant='solo_2' and billing_interval='monthly'),
    599, current_date,
    'INSTAPAY-SS-SUB-DOWNGRADE'
  );
  perform set_config('ss_sub.downgrade_notice', v_notice::text, true);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
do $$
declare v_notice uuid := current_setting('ss_sub.downgrade_notice')::uuid;
begin
  if not exists (
    select 1 from jsonb_array_elements(
      (select item -> 'usageBlockers'
       from jsonb_array_elements(public.platform_admin_billing_read('queue') -> 'items') item
       where (item ->> 'id')::uuid = v_notice)
    ) blocker where blocker ->> 'resource' = 'active_locations'
      and (blocker ->> 'used')::integer = 2 and (blocker ->> 'limit')::integer = 1
  ) then raise exception 'downgrade did not expose the location blocker'; end if;
  begin
    perform public.platform_admin_billing_command(
      gen_random_uuid(), 'approve', v_notice, 'Blocked downgrade attempt',
      jsonb_build_object('receivedAmount', 599,
        'receivedReference', 'BANK-SS-SUB-DOWNGRADE',
        'receivedDate', current_date::text)
    );
    raise exception 'over-limit downgrade was approved';
  exception when check_violation then
    if sqlerrm <> 'PLAN_CHANGE_BLOCKED' then raise; end if;
  end;
end;
$$;
reset role;

do $$ begin
  if (select count(*) from public.shop_locations
      where shop_id = current_setting('ss_sub.shop')::uuid) <> 2 then
    raise exception 'blocked downgrade deleted location history';
  end if;
end $$;

do $$
declare v_shop uuid := current_setting('ss_sub.shop')::uuid;
begin
  update public.shop_locations set status = 'archived', archived_at = now()
  where shop_id = v_shop and not is_default;
end;
$$;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_sub.shop')::uuid;
begin
  perform public.platform_admin_billing_command(
    gen_random_uuid(), 'approve', current_setting('ss_sub.downgrade_notice')::uuid,
    'Usage reduced and transfer verified',
    jsonb_build_object('receivedAmount', 599,
      'receivedReference', 'BANK-SS-SUB-DOWNGRADE',
      'receivedDate', current_date::text)
  );
  if public.platform_plan_read('shop', v_shop) #>> '{subscription,planSlug}' <> 'solo' then
    raise exception 'in-limit downgrade changed or deleted customer data';
  end if;
end;
$$;
reset role;

do $$
declare v_shop uuid := current_setting('ss_sub.shop')::uuid;
begin
  if (select count(*) from public.shop_locations where shop_id = v_shop) <> 2
    or (select count(*) from public.shop_locations
      where shop_id = v_shop and status = 'active') <> 1 then
    raise exception 'in-limit downgrade changed or deleted customer data';
  end if;
end;
$$;

-- Suspension/expiry leaves history readable and writes blocked. An audited
-- renewal restores writes without rewriting the retained resources.
do $$
declare
  v_subscription public.subscriptions;
  v_terms public.plan_catalog_terms;
begin
  select * into v_subscription from public.subscriptions
  where profile_id = current_setting('ss_sub.owner_profile')::uuid;
  select * into v_terms from public.plan_catalog_terms
  where id = v_subscription.catalog_terms_id;
  if v_terms.plan_variant <> 'solo_2' or v_terms.billing_interval <> 'monthly'
    or shop_private.plan_resource_usage(current_setting('ss_sub.shop')::uuid, 'active_members') <> 2 then
    raise exception 'reactivation fixture must retain two members on Solo 2';
  end if;
  perform set_config('ss_sub.before_reactivation', to_jsonb(v_subscription)::text, true);
end;
$$;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
select public.platform_plan_command(
  gen_random_uuid(), 'suspend_subscription', 'Lifecycle expiry simulation', null,
  current_setting('ss_sub.shop')::uuid, '{}'::jsonb
);
reset role;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_sub.shop')::uuid;
begin
  if public.shop_billing_read(v_shop) #>> '{subscription,accessState}' <> 'read_only'
    or (public.shop_plan_usage(v_shop) ->> 'locations')::integer <> 1 then
    raise exception 'suspension hid authorized commercial/resource history';
  end if;
  begin
    perform public.save_product(v_shop, null, 'Blocked while expired', null, null, 10);
    raise exception 'suspended subscription allowed a business write';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_SUBSCRIPTION_INACTIVE' then raise; end if;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
select public.platform_plan_command(
  gen_random_uuid(), 'renew_subscription', 'Verified reactivation payment', null,
  current_setting('ss_sub.shop')::uuid, '{}'::jsonb
);
reset role;

do $$
declare
  v_before jsonb := current_setting('ss_sub.before_reactivation')::jsonb;
  v_subscription public.subscriptions;
  v_mutable_fields text[] := array['status', 'locked_at', 'updated_at',
    'current_period_start', 'current_period_end'];
begin
  select * into v_subscription from public.subscriptions
  where profile_id = current_setting('ss_sub.owner_profile')::uuid;
  if (to_jsonb(v_subscription) - v_mutable_fields) is distinct from (v_before - v_mutable_fields)
    or v_subscription.current_period_end is distinct from
      (v_before ->> 'current_period_end')::timestamptz + interval '1 month' then
    raise exception 'operator reactivation changed pinned terms, snapshots or renewal interval';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_subscription_lifecycle_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_sub.shop')::uuid;
begin
  perform public.save_product(v_shop, null, 'Allowed after reactivation', null, null, 10);
  if public.shop_billing_read(v_shop) #>> '{subscription,accessState}' <> 'active'
    or (select count(*) from public.shop_locations where shop_id = v_shop) <> 2
    or (select count(*) from public.products where shop_id = v_shop and is_active) <> 1 then
    raise exception 'reactivation failed or rewrote retained resources';
  end if;
  begin
    perform public.platform_plan_read('catalog');
    raise exception 'tenant owner acquired platform authority';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

-- Provider boundary: this release exposes manual transfer reconciliation only.
do $$ begin
  if exists (
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname ~* '(paymob|webhook|automatic.*(bank|instapay)|instapay.*automatic)'
  ) then raise exception 'automatic payment-provider endpoint is reachable'; end if;
end $$;
