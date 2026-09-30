-- SS-HOT-ONBOARD-001: signup starts one plan-neutral, full-product 14-day
-- trial. Paid Solo/Team/Multi selection remains in the billing lifecycle.

insert into public.plans (
  portal_id, name, slug, price_amount, currency, billing_interval,
  trial_days, features, resource_limits, sort_order, is_active, is_public,
  is_purchasable, is_coming_soon, catalog_version
)
select portal.id, 'Full-product trial', 'full-product-trial', 0, 'EGP',
  'monthly', 14, '{"inventory":true}'::jsonb,
  '{"active_locations":null,"active_members":null,"active_products":null,"active_services":null}'::jsonb,
  0, true, false, false, false, 1
from public.portals portal
where portal.key = 'shop-crm'
on conflict (portal_id, slug) do nothing;

insert into public.plan_catalog_terms (
  plan_id, version, display_name, billing_interval, currency, price_amount,
  trial_days, resource_limits, is_public, is_purchasable
)
select plan.id, 1, plan.name, plan.billing_interval, plan.currency,
  plan.price_amount, 14, plan.resource_limits, false, false
from public.plans plan
join public.portals portal on portal.id = plan.portal_id
where portal.key = 'shop-crm' and plan.slug = 'full-product-trial'
on conflict (plan_id, version) do nothing;

alter table public.plans add constraint plans_full_product_trial_internal
  check (slug <> 'full-product-trial' or (
    trial_days = 14 and price_amount = 0 and is_active
    and not is_public and not is_purchasable and not is_coming_soon
  ));

-- The subscription trigger normally accepts only purchasable plans from a
-- browser-authenticated transaction. The internal trial is the one exception;
-- direct subscription writes remain revoked from authenticated callers.
create or replace function shop_private.subscription_catalog_terms()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_shop_id uuid; v_limits jsonb; v_limit integer; v_usage bigint; v_resource text;
  v_operator_approval boolean := false;
begin
  if tg_op = 'INSERT' and auth.uid() is not null and not exists (
    select 1 from public.plans plan
    where plan.id = new.plan_id and plan.is_active and not plan.is_coming_soon
      and (
        (plan.is_public and plan.is_purchasable)
        or (plan.slug = 'full-product-trial' and new.status = 'trialing')
      )
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

-- This overload is the only current onboarding entry point. The older
-- plan-slug overloads remain compatible for existing clients and fixtures.
create function shop_private.create_owner_shop(
  p_shop_name text,
  p_business_mode public.business_mode
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_display_name text;
  v_portal_id uuid;
  v_profile_id uuid;
  v_profile_status text;
  v_existing_shop_id uuid;
  v_shop_id uuid;
  v_trial_plan_id uuid;
  v_started_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_business_mode is null then
    raise exception 'INVALID_BUSINESS_MODE' using errcode = '22023';
  end if;
  if p_shop_name is null or length(btrim(p_shop_name)) < 2
     or length(btrim(p_shop_name)) > 120 then
    raise exception 'INVALID_SHOP_NAME' using errcode = '22023';
  end if;

  select auth_user.email,
    nullif(btrim(auth_user.raw_user_meta_data ->> 'display_name'), '')
    into v_email, v_display_name
  from auth.users auth_user
  where auth_user.id = v_user_id
  for update;
  if not found then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select portal.id into v_portal_id
  from public.portals portal
  where portal.key = 'shop-crm' and portal.is_active;
  if v_portal_id is null then raise exception 'PORTAL_UNAVAILABLE'; end if;

  select profile.id, profile.status::text into v_profile_id, v_profile_status
  from public.profiles profile
  where profile.user_id = v_user_id and profile.portal_id = v_portal_id;
  if v_profile_id is null then
    insert into public.profiles (
      user_id, portal_id, display_name, email_snapshot
    ) values (
      v_user_id, v_portal_id, v_display_name, v_email
    ) returning id into v_profile_id;
  elsif v_profile_status <> 'active' then
    raise exception 'PROFILE_INACTIVE';
  end if;

  -- A response-loss retry returns the original shop without extending the
  -- trial or changing the selected operating mode.
  select membership.shop_id into v_existing_shop_id
  from public.shop_memberships membership
  where membership.profile_id = v_profile_id and membership.role = 'owner'
  order by membership.created_at, membership.id
  limit 1;
  if v_existing_shop_id is not null then return v_existing_shop_id; end if;
  if exists (select 1 from public.subscriptions subscription
      where subscription.profile_id = v_profile_id) then
    raise exception 'SUBSCRIPTION_REQUIRES_REVIEW';
  end if;

  select plan.id into v_trial_plan_id
  from public.plans plan
  where plan.portal_id = v_portal_id
    and plan.slug = 'full-product-trial'
    and plan.is_active and not plan.is_public and not plan.is_purchasable
    and not plan.is_coming_soon and plan.trial_days = 14;
  if v_trial_plan_id is null then raise exception 'TRIAL_UNAVAILABLE'; end if;

  insert into public.shops (portal_id, name, business_mode)
  values (v_portal_id, btrim(p_shop_name), p_business_mode)
  returning id into v_shop_id;

  insert into public.shop_memberships (shop_id, profile_id, role)
  values (v_shop_id, v_profile_id, 'owner');

  insert into public.subscriptions (
    profile_id, plan_id, status, trial_start_at, trial_end_at,
    current_period_start, current_period_end, trial_consumed
  ) values (
    v_profile_id, v_trial_plan_id, 'trialing', v_started_at,
    v_started_at + interval '14 days', v_started_at,
    v_started_at + interval '14 days', true
  );

  return v_shop_id;
end;
$$;

revoke all on function shop_private.create_owner_shop(
  text, public.business_mode
) from public, anon, authenticated, service_role;

create function public.create_owner_shop(
  p_shop_name text,
  p_business_mode public.business_mode
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select shop_private.create_owner_shop(p_shop_name, p_business_mode);
$$;

revoke all on function public.create_owner_shop(
  text, public.business_mode
) from public, anon, authenticated, service_role;
grant execute on function public.create_owner_shop(
  text, public.business_mode
) to authenticated;

notify pgrst, 'reload schema';
