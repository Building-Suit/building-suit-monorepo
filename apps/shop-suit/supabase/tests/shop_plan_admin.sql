-- SS-PLAN-ADMIN-001: platform-only catalog/subscription controls, immutable
-- version history, exact downgrade blockers, and negotiated-price revocation.

create temporary table shop_plan_admin_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() observer_id,
  gen_random_uuid() operator_id, gen_random_uuid() outsider_id;
grant select on shop_plan_admin_fixture to authenticated;

insert into auth.users (
  id, email, encrypted_password, aud, role,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@ss-plan-admin.invalid', 'x', 'authenticated',
  'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id id from shop_plan_admin_fixture
  union all select observer_id from shop_plan_admin_fixture
  union all select operator_id from shop_plan_admin_fixture
  union all select outsider_id from shop_plan_admin_fixture
) users;

insert into public.platform_admins (user_id, role, display_name)
select observer_id, 'observer', 'Plan observer' from shop_plan_admin_fixture
union all select operator_id, 'operator', 'Plan operator' from shop_plan_admin_fixture;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_admin_fixture;
set local role authenticated;
do $$
declare v_shop uuid;
begin
  v_shop := public.create_owner_shop('Plan admin fixture', 'team', 'mixed');
  perform set_config('ss_plan_admin.shop', v_shop::text, true);
end;
$$;
reset role;

do $$
declare v_shop uuid := current_setting('ss_plan_admin.shop')::uuid;
  v_portal uuid; v_profile uuid; v_user uuid; v_index integer;
begin
  select portal_id into v_portal from public.shops where id = v_shop;
  -- Owner plus two staff exceeds Solo's two-member limit.
  for v_index in 1..2 loop
    v_user := gen_random_uuid();
    insert into auth.users (
      id, email, encrypted_password, aud, role,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      v_user, v_user::text || '@ss-plan-limit.invalid', 'x', 'authenticated',
      'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
    );
    insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
    values (v_user, v_portal, 'Limit member ' || v_index, 'limit-' || v_index || '@invalid.test')
    returning id into v_profile;
    insert into public.shop_memberships (shop_id, profile_id, role, status)
    values (v_shop, v_profile, 'staff', 'active');
  end loop;
end;
$$;

-- Tenant authority never grants cross-tenant platform controls.
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_admin_fixture;
set local role authenticated;
do $$ begin
  perform public.platform_plan_read('catalog');
  raise exception 'tenant owner read platform plan controls';
exception when insufficient_privilege then null; end $$;
reset role;

-- Observers can inspect but cannot mutate.
select set_config('request.jwt.claim.sub', observer_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_admin_fixture;
set local role authenticated;
do $$
declare v_plan uuid;
begin
  if jsonb_array_length(public.platform_plan_read('catalog') -> 'items') < 3 then
    raise exception 'observer could not read plan catalog';
  end if;
  select id into v_plan from public.plans where slug = 'team';
  begin
    perform public.platform_plan_command(gen_random_uuid(), 'set_availability',
      'Observer must be denied', v_plan, null,
      '{"isActive":true,"isPublic":true,"isPurchasable":true,"isComingSoon":false}'::jsonb);
    raise exception 'observer mutated plan catalog';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_plan_admin_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('ss_plan_admin.shop')::uuid;
  v_team uuid; v_solo uuid; v_subscription uuid; v_original_terms uuid;
  v_future uuid; v_request uuid := gen_random_uuid(); v_before_events integer;
  v_quote jsonb; v_detail jsonb;
  v_effective_from text := (clock_timestamp() + interval '7 days')::text;
begin
  select id into v_team from public.plans where slug = 'team';
  select id into v_solo from public.plans where slug = 'solo';
  select subscription.id, subscription.catalog_terms_id
    into v_subscription, v_original_terms
  from public.shop_memberships membership
  join public.subscriptions subscription on subscription.profile_id = membership.profile_id
  where membership.shop_id = v_shop and membership.role = 'owner';

  v_before_events := (public.platform_plan_read('audit') ->> 'total')::integer;
  perform public.platform_plan_command(v_request, 'publish_terms',
    'Schedule next Team commercial version', v_team, null,
    jsonb_build_object(
      'displayName', 'Team', 'billingInterval', 'monthly', 'currency', 'EGP',
      'priceAmount', 749,
      'resourceLimits', '{"active_locations":1,"active_members":8,"active_products":500,"active_services":100,"active_customers":2000,"active_suppliers":150}'::jsonb,
      'effectiveFrom', v_effective_from
    ));
  perform public.platform_plan_command(v_request, 'publish_terms',
    'Schedule next Team commercial version', v_team, null,
    jsonb_build_object(
      'displayName', 'Team', 'billingInterval', 'monthly', 'currency', 'EGP',
      'priceAmount', 749,
      'resourceLimits', '{"active_locations":1,"active_members":8,"active_products":500,"active_services":100,"active_customers":2000,"active_suppliers":150}'::jsonb,
      'effectiveFrom', v_effective_from
    ));
  if (public.platform_plan_read('audit') ->> 'total')::integer <> v_before_events + 1 then
    raise exception 'catalog command idempotency failed';
  end if;
  select id into v_future from public.plan_catalog_terms
  where plan_id = v_team and effective_from > clock_timestamp()
  order by version desc limit 1;
  if (select (item ->> 'catalogVersion')::integer
      from jsonb_array_elements(public.platform_plan_read('catalog') -> 'items') item
      where item ->> 'slug' = 'team') = (select version from public.plan_catalog_terms where id = v_future)
    or (select catalog_terms_id from public.subscriptions where id = v_subscription) <> v_original_terms then
    raise exception 'future catalog version became current early';
  end if;

  v_detail := public.platform_plan_read('shop', v_shop);
  if jsonb_array_length((select option -> 'blockers' from jsonb_array_elements(v_detail -> 'availablePlans') option where option ->> 'planSlug' = 'solo')) = 0 then
    raise exception 'downgrade blockers were not disclosed';
  end if;
  begin
    perform public.platform_plan_command(gen_random_uuid(), 'change_subscription',
      'Attempt blocked Solo downgrade', v_solo, v_shop, '{"timing":"immediate"}'::jsonb);
    raise exception 'over-limit downgrade was forced';
  exception when check_violation then null; end;

  perform public.platform_plan_command(gen_random_uuid(), 'set_price_override',
    'Founder commercial agreement', null, v_shop,
    jsonb_build_object('amount', 499, 'currency', 'EGP',
      'effectiveFrom', clock_timestamp()::text, 'expiresAt', null));
  v_quote := public.platform_plan_read('shop', v_shop) -> 'subscription';
  if v_quote ->> 'priceSource' <> 'override' then raise exception 'negotiated price was not effective'; end if;
  perform public.platform_plan_command(gen_random_uuid(), 'remove_price_override',
    'Founder agreement ended', null, v_shop, '{}'::jsonb);
  v_quote := public.platform_plan_read('shop', v_shop) -> 'subscription';
  if v_quote ->> 'priceSource' <> 'catalog' then raise exception 'removed negotiated price remained effective'; end if;

end;
$$;
reset role;

-- Browser/platform-admin sessions must not receive raw DELETE privileges on
-- the plan catalog. Test the database-level history-preservation trigger as
-- the postgres test harness instead.
do $$
declare v_team uuid;
begin
  if has_table_privilege('authenticated', 'public.plans', 'DELETE') then
    raise exception 'authenticated role can delete plans directly';
  end if;

  select id into v_team
  from public.plans
  where slug = 'team';

  begin
    delete from public.plans where id = v_team;
    raise exception 'referenced historical plan was deleted';
  exception when sqlstate '55000' then
    if sqlerrm <> 'HISTORICAL_PLAN_DELETE_FORBIDDEN' then
      raise;
    end if;
  end;
end;
$$;

do $$ begin
  update public.platform_plan_events set reason = 'tampered';
  raise exception 'platform plan audit was mutable';
exception when sqlstate '55000' then null; end $$;
