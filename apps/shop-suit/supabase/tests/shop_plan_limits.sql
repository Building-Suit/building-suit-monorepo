-- SS-PLAN-LIMITS-001: authoritative usage, reservations, archive/reactivation,
-- downgrade safety, tenant isolation, expiry, and stable resource locks.

create temporary table shop_plan_limits_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() invited_id,
  gen_random_uuid() outsider_id, gen_random_uuid() tight_plan_id,
  gen_random_uuid() downgrade_plan_id;
grant select on shop_plan_limits_fixture to authenticated;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, email, 'x', 'authenticated', 'authenticated', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id id, 'owner@ss-plan-limits.invalid' email from shop_plan_limits_fixture
  union all select invited_id, 'invited@ss-plan-limits.invalid' from shop_plan_limits_fixture
  union all select outsider_id, 'outsider@ss-plan-limits.invalid' from shop_plan_limits_fixture
) users;

do $$
declare v_portal uuid := (select id from public.portals where key = 'shop-crm');
  v_plan uuid := (select tight_plan_id from shop_plan_limits_fixture);
  v_downgrade uuid := (select downgrade_plan_id from shop_plan_limits_fixture);
begin
  insert into public.plans (
    id, portal_id, name, slug, price_amount, currency, billing_interval,
    trial_days, features, resource_limits, sort_order, is_active, is_public,
    is_purchasable, is_coming_soon, catalog_version
  ) values (
    v_plan, v_portal, 'Limit test', 'ss-plan-limits-test', 0, 'EGP', 'monthly',
    7, '{"inventory":true,"max_locations":2,"max_members":2,"max_products":1,"max_services":1,"max_customers":1,"max_suppliers":1}'::jsonb,
    '{"active_locations":2,"active_members":2,"active_products":1,"active_services":1,"active_customers":1,"active_suppliers":1}'::jsonb,
    999, true, true, true, false, 1
  );
  insert into public.plan_catalog_terms (
    plan_id, version, display_name, billing_interval, currency, price_amount,
    trial_days, resource_limits, is_public, is_purchasable
  ) select id, 1, name, billing_interval, currency, price_amount, trial_days,
    resource_limits, true, true from public.plans where id = v_plan;

  insert into public.plans (
    id, portal_id, name, slug, price_amount, currency, billing_interval,
    trial_days, features, resource_limits, sort_order, is_active, is_public,
    is_purchasable, is_coming_soon, catalog_version
  ) values (
    v_downgrade, v_portal, 'Multi-blocker target', 'ss-plan-limits-downgrade',
    0, 'EGP', 'monthly', 7, '{"inventory":true}'::jsonb,
    '{"active_locations":1,"active_members":1,"active_products":1,"active_services":1,"active_customers":1,"active_suppliers":1}'::jsonb,
    1000, true, true, true, false, 1
  );
  insert into public.plan_catalog_terms (
    plan_id, version, display_name, billing_interval, currency, price_amount,
    trial_days, resource_limits, is_public, is_purchasable
  ) select id, 1, name, billing_interval, currency, price_amount, trial_days,
    resource_limits, true, true from public.plans where id = v_downgrade;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_limits_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_location uuid; v_request uuid := gen_random_uuid(); v_invitation jsonb;
begin
  v_shop := public.create_owner_shop('Atomic limits fixture', 'ss-plan-limits-test', 'mixed');
  v_location := (select id from public.shop_locations where shop_id = v_shop and is_default);
  if (public.shop_billing_read(v_shop) #>> '{subscription,planSlug}')
      <> 'ss-plan-limits-test'
    or (public.shop_plan_usage(v_shop) #>> '{resources,0,used}')::integer <> 1 then
    raise exception 'authoritative entitlement or usage resolver failed';
  end if;

  v_invitation := public.invite_shop_member(v_request, v_shop,
    'invited@ss-plan-limits.invalid', 'Invited', 'staff', array[v_location]);
  if (public.shop_plan_usage(v_shop) ->> 'members')::integer <> 2 then
    raise exception 'live invitation did not reserve member capacity';
  end if;
  if public.invite_shop_member(v_request, v_shop,
      'invited@ss-plan-limits.invalid', 'Invited', 'staff', array[v_location])
      ->> 'invitationId' <> v_invitation ->> 'invitationId'
    or jsonb_array_length(
      public.shop_team_read(v_shop) -> 'invitations'
    ) <> 1 then
    raise exception 'idempotent invitation retry consumed capacity twice';
  end if;
  begin
    perform public.invite_shop_member(gen_random_uuid(), v_shop,
      'another@ss-plan-limits.invalid', 'Another', 'staff', array[v_location]);
    raise exception 'member reservation exceeded the configured limit';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_members:%' then raise; end if;
  end;
  perform set_config('ss_plan_limits.shop', v_shop::text, true);
  perform set_config('ss_plan_limits.invitation', v_invitation ->> 'invitationCode', true);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', invited_id::text, true)
from shop_plan_limits_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_plan_limits.shop')::uuid;
  v_request uuid := gen_random_uuid();
  v_joined uuid;
begin
  v_joined := public.accept_shop_invitation(
    v_request,
    current_setting('ss_plan_limits.invitation')::uuid
  );
  if v_joined <> v_shop then
    raise exception 'invitation acceptance returned the wrong shop';
  end if;
  if (public.shop_plan_usage(v_shop) ->> 'members')::integer <> 2 then
    raise exception 'invitation reservation was not exchanged for one member seat';
  end if;

  v_joined := public.accept_shop_invitation(
    v_request,
    current_setting('ss_plan_limits.invitation')::uuid
  );
  if v_joined <> v_shop then
    raise exception 'idempotent invitation acceptance returned the wrong shop';
  end if;
  if (public.shop_plan_usage(v_shop) ->> 'members')::integer <> 2 then
    raise exception 'idempotent acceptance retry consumed capacity twice';
  end if;
end;
$$;
reset role;

-- Direct privileged writes use the same trigger boundary as supported RPCs.
do $$
declare v_shop uuid := current_setting('ss_plan_limits.shop')::uuid;
  v_profile uuid; v_product uuid; v_service uuid; v_customer uuid; v_supplier uuid;
  v_archived_location uuid; v_usage jsonb;
begin
  select membership.profile_id into v_profile from public.shop_memberships membership
  where membership.shop_id = v_shop and membership.role = 'owner';

  insert into public.products (shop_id, name, sale_price, created_by_profile_id)
  values (v_shop, 'First product', 10, v_profile) returning id into v_product;
  begin
    insert into public.products (shop_id, name, sale_price, created_by_profile_id)
    values (v_shop, 'Over product', 10, v_profile);
    raise exception 'product limit was exceeded';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_products:%' then raise; end if;
  end;
  update public.products set is_active = false where id = v_product;
  insert into public.products (shop_id, name, sale_price, created_by_profile_id)
  values (v_shop, 'Replacement product', 10, v_profile);
  begin
    update public.products set is_active = true where id = v_product;
    raise exception 'archived product reactivated over limit';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_products:%' then raise; end if;
  end;

  insert into public.services (shop_id, name, base_sale_price,
    default_discount_type, default_discount_value, created_by_profile_id)
  values (v_shop, 'First service', 10, 'amount', 0, v_profile)
  returning id into v_service;
  update public.services set is_active = false where id = v_service;
  insert into public.services (shop_id, name, base_sale_price,
    default_discount_type, default_discount_value, created_by_profile_id)
  values (v_shop, 'Replacement service', 10, 'amount', 0, v_profile);
  begin
    update public.services set is_active = true where id = v_service;
    raise exception 'archived service reactivated over limit';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_services:%' then raise; end if;
  end;

  insert into public.clients (shop_id, name, created_by_profile_id)
  values (v_shop, 'First customer', v_profile) returning id into v_customer;
  begin
    insert into public.clients (shop_id, name, created_by_profile_id)
    values (v_shop, 'Over customer', v_profile);
    raise exception 'customer limit was exceeded';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_customers:%' then raise; end if;
  end;
  update public.clients set is_active = false, archived_at = now() where id = v_customer;
  insert into public.clients (shop_id, name, created_by_profile_id)
  values (v_shop, 'Replacement customer', v_profile);
  begin
    update public.clients set is_active = true, archived_at = null where id = v_customer;
    raise exception 'archived customer reactivated over limit';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_customers:%' then raise; end if;
  end;

  insert into public.vendors (shop_id, name, created_by_profile_id)
  values (v_shop, 'First supplier', v_profile) returning id into v_supplier;
  begin
    insert into public.vendors (shop_id, name, created_by_profile_id)
    values (v_shop, 'Over supplier', v_profile);
    raise exception 'supplier limit was exceeded';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_suppliers:%' then raise; end if;
  end;
  update public.vendors set is_active = false, archived_at = now() where id = v_supplier;
  insert into public.vendors (shop_id, name, created_by_profile_id)
  values (v_shop, 'Replacement supplier', v_profile);
  begin
    update public.vendors set is_active = true, archived_at = null where id = v_supplier;
    raise exception 'archived supplier reactivated over limit';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_suppliers:%' then raise; end if;
  end;

  insert into public.shop_locations (shop_id, name)
  values (v_shop, 'Second branch');
  insert into public.shop_locations (shop_id, name, status, archived_at)
  values (v_shop, 'Archived branch', 'archived', now()) returning id into v_archived_location;
  begin
    update public.shop_locations set status = 'active', archived_at = null
    where id = v_archived_location;
    raise exception 'archived location reactivated over limit';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_locations:%' then raise; end if;
  end;

  v_usage := shop_private.plan_usage_snapshot(v_shop);
  if jsonb_array_length(v_usage -> 'resources') <> 6
    or (v_usage ->> 'customers')::integer <> 1
    or (v_usage ->> 'suppliers')::integer <> 1
    or (select count(*) from public.clients where shop_id = v_shop) <> 2
    or (select count(*) from public.vendors where shop_id = v_shop) <> 2 then
    raise exception 'six-resource usage or archived-record preservation failed';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_plan_limits_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_plan_limits.shop')::uuid;
  v_before jsonb; v_validation jsonb; v_multi_validation jsonb; v_invitation jsonb;
  v_invited_membership uuid; v_location uuid;
begin
  select (member ->> 'id')::uuid into v_invited_membership
  from jsonb_array_elements(
    public.shop_team_read(v_shop) -> 'members'
  ) member
  where lower(member ->> 'email') = 'invited@ss-plan-limits.invalid'
  limit 1;

  if v_invited_membership is null then
    raise exception 'accepted invited member was not visible through shop_team_read';
  end if;

  select id into v_location from public.shop_locations
  where shop_id = v_shop and is_default;
  perform public.manage_shop_member(gen_random_uuid(), v_shop,
    v_invited_membership, 'suspend', null, null, 'Seat reactivation test');
  v_invitation := public.invite_shop_member(gen_random_uuid(), v_shop,
    'reserved@ss-plan-limits.invalid', 'Reserved', 'staff', array[v_location]);
  begin
    perform public.manage_shop_member(gen_random_uuid(), v_shop,
      v_invited_membership, 'reactivate', null, null, 'Seat reactivation test');
    raise exception 'member reactivated over reserved seat limit';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_members:%' then raise; end if;
  end;
  perform public.revoke_shop_invitation(gen_random_uuid(), v_shop,
    (v_invitation ->> 'invitationId')::uuid, 'Seat reactivation test');
  perform public.manage_shop_member(gen_random_uuid(), v_shop,
    v_invited_membership, 'reactivate', null, null, 'Seat reactivation test');

  v_before := jsonb_build_object(
    'products', (select count(*) from public.products where shop_id = v_shop),
    'services', (select count(*) from public.services where shop_id = v_shop),
    'locations', (select count(*) from public.shop_locations where shop_id = v_shop),
    'customers', (select count(*) from public.clients where shop_id = v_shop),
    'suppliers', (select count(*) from public.vendors where shop_id = v_shop)
  );
  v_validation := public.shop_plan_change_validation(v_shop, 'solo');
  v_multi_validation := public.shop_plan_change_validation(v_shop, 'ss-plan-limits-downgrade');
  if (v_validation ->> 'mutated')::boolean
    or jsonb_array_length(v_validation -> 'blockers') <> 2
    or v_validation #>> '{blockers,0,resource}' <> 'active_locations'
    or v_validation #>> '{blockers,1,resource}' <> 'active_members'
    or jsonb_array_length(v_multi_validation -> 'blockers') <> 2
    or v_multi_validation #>> '{blockers,0,resource}' <> 'active_locations'
    or v_multi_validation #>> '{blockers,1,resource}' <> 'active_members'
    or v_before is distinct from jsonb_build_object(
      'products', (select count(*) from public.products where shop_id = v_shop),
      'services', (select count(*) from public.services where shop_id = v_shop),
      'locations', (select count(*) from public.shop_locations where shop_id = v_shop),
      'customers', (select count(*) from public.clients where shop_id = v_shop),
      'suppliers', (select count(*) from public.vendors where shop_id = v_shop)
    ) then raise exception 'downgrade validation lacked blockers or mutated customer data'; end if;
end;
$$;
reset role;

do $$
declare v_shop uuid := current_setting('ss_plan_limits.shop')::uuid;
  v_subscription uuid; v_solo uuid := (select id from public.plans where slug = 'solo');
begin
  select subscription.id into v_subscription from public.subscriptions subscription
  join public.shop_memberships membership on membership.profile_id = subscription.profile_id
  where membership.shop_id = v_shop and membership.role = 'owner';
  begin
    update public.subscriptions set plan_id = v_solo where id = v_subscription;
    raise exception 'over-limit downgrade became effective';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_EXCEEDED:active_locations:%' then raise; end if;
  end;
  if (select plan.slug from public.subscriptions subscription
      join public.plans plan on plan.id = subscription.plan_id
      where subscription.id = v_subscription) <> 'ss-plan-limits-test'
    or (select count(*) from public.shop_locations
      where shop_id = v_shop and status = 'active') <> 2 then
    raise exception 'blocked downgrade changed plan or customer data';
  end if;
  update public.shop_locations set status = 'archived', archived_at = now()
  where shop_id = v_shop and status = 'active' and not is_default;
  -- Solo 1 now requires reducing both location and member usage.
  update public.shop_memberships set status = 'suspended'
  where shop_id = v_shop and role <> 'owner' and status = 'active';
  update public.subscriptions set plan_id = v_solo where id = v_subscription;
  if (select plan.slug from public.subscriptions subscription
      join public.plans plan on plan.id = subscription.plan_id
      where subscription.id = v_subscription) <> 'solo' then
    raise exception 'in-limit approved downgrade did not become effective';
  end if;
end;
$$;

-- Expiry preserves authorized reads while the existing write-access policy
-- rejects new product mutations.
update public.subscriptions subscription set status = 'expired', trial_end_at = now() - interval '1 second',
  current_period_end = now() - interval '1 second', locked_at = now()
from public.shop_memberships membership
where membership.shop_id = current_setting('ss_plan_limits.shop')::uuid
  and membership.role = 'owner' and subscription.profile_id = membership.profile_id;

select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_plan_limits_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_plan_limits.shop')::uuid;
begin
  if (public.shop_plan_usage(v_shop) ->> 'products')::integer <> 1
    or (public.shop_billing_read(v_shop) #>> '{subscription,accessState}') <> 'read_only' then
    raise exception 'expired subscription did not preserve authorized history reads';
  end if;
  begin
    perform public.save_product(v_shop, null, 'Expired write', null, null, 10);
    raise exception 'expired subscription accepted a product mutation';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_SUBSCRIPTION_INACTIVE' then raise; end if;
  end;
  begin
    perform public.save_shop_location(v_shop, null, 'Expired branch', null, null, null);
    raise exception 'expired subscription accepted a quota-increasing location mutation';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_SUBSCRIPTION_INACTIVE' then raise; end if;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', outsider_id::text, true)
from shop_plan_limits_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.shop_plan_usage(current_setting('ss_plan_limits.shop')::uuid);
    raise exception 'cross-shop usage was disclosed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_customer(current_setting('ss_plan_limits.shop')::uuid,
      null, 'Cross-shop customer', null, null, null, null);
    raise exception 'outsider created a cross-shop customer';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_vendor(current_setting('ss_plan_limits.shop')::uuid,
      null, 'Cross-shop supplier', null, null, null, null, null, null);
    raise exception 'outsider created a cross-shop supplier';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

do $$
declare function_row record;
begin
  for function_row in select procedure.oid, procedure.proname, procedure.prosecdef,
      procedure.proconfig from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in ('shop_plan_usage', 'shop_plan_change_validation')
  loop
    if not function_row.prosecdef
      or function_row.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', function_row.oid, 'execute')
      or has_function_privilege('anon', function_row.oid, 'execute') then
      raise exception 'unsafe public plan-limit contract: %', function_row.proname;
    end if;
  end loop;
  if exists (select 1 from public.plans plan where plan.slug in ('solo','team','multi')
    and not plan.resource_limits ?& array['active_customers','active_suppliers']) then
    raise exception 'a current plan lacks customer or supplier capacity';
  end if;
end;
$$;
