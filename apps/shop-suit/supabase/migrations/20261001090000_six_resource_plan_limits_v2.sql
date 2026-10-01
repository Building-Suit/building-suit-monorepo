-- SS-HOT-PLAN-LIMITS-V2-001 / HOT-12: extend the authoritative Shop quota
-- engine to active customers and suppliers, and publish the approved realistic
-- six-resource limits without rewriting immutable historical catalog terms.

create or replace function shop_private.valid_resource_limits(p_limits jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_limits) = 'object'
    and p_limits ?& array[
      'active_locations', 'active_members', 'active_products', 'active_services'
    ]
    and (
      p_limits ?& array['active_customers', 'active_suppliers']
      or not (p_limits ?| array['active_customers', 'active_suppliers'])
    )
    and p_limits - array[
      'active_locations', 'active_members', 'active_products', 'active_services',
      'active_customers', 'active_suppliers'
    ] = '{}'::jsonb
    and not exists (
      select 1 from jsonb_each(p_limits) limit_entry
      where jsonb_typeof(limit_entry.value) not in ('number', 'null')
        or (jsonb_typeof(limit_entry.value) = 'number'
          and (limit_entry.value::text !~ '^[0-9]+$'
            or (limit_entry.value::text)::numeric < 1))
    );
$$;

create function shop_private.require_purchasable_six_resource_limits()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_purchasable and not (
    new.resource_limits ?& array[
      'active_locations', 'active_members', 'active_products', 'active_services',
      'active_customers', 'active_suppliers'
    ]
  ) then
    raise exception 'PLAN_RESOURCE_LIMITS_INCOMPLETE' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger plan_catalog_terms_01_six_resource_limits
before insert on public.plan_catalog_terms
for each row execute function shop_private.require_purchasable_six_resource_limits();

update public.plans plan set
  resource_limits = case plan.slug
    when 'solo' then '{"active_locations":1,"active_members":2,"active_products":250,"active_services":50,"active_customers":500,"active_suppliers":50}'::jsonb
    when 'team' then '{"active_locations":1,"active_members":8,"active_products":500,"active_services":100,"active_customers":2000,"active_suppliers":150}'::jsonb
    when 'multi' then '{"active_locations":2,"active_members":16,"active_products":1000,"active_services":200,"active_customers":5000,"active_suppliers":300}'::jsonb
  end,
  features = case plan.slug
    when 'solo' then '{"inventory":true,"max_locations":1,"max_members":2,"max_products":250,"max_services":50,"max_customers":500,"max_suppliers":50}'::jsonb
    when 'team' then '{"inventory":true,"max_locations":1,"max_members":8,"max_products":500,"max_services":100,"max_customers":2000,"max_suppliers":150}'::jsonb
    when 'multi' then '{"inventory":true,"max_locations":2,"max_members":16,"max_products":1000,"max_services":200,"max_customers":5000,"max_suppliers":300}'::jsonb
  end,
  updated_at = now()
from public.portals portal
where portal.id = plan.portal_id and portal.key = 'shop-crm'
  and plan.slug in ('solo', 'team', 'multi');

-- Append corrected V2 offers. Subscriptions and billing snapshots keep their
-- exact historical term IDs; new selections resolve these latest offers.
with offers(slug, ordinal, plan_variant, variant_name, billing_interval,
    price_amount, resource_limits) as (values
  ('solo', 1, 'standard', 'Solo', 'monthly', 349.00::numeric,
    '{"active_locations":1,"active_members":2,"active_products":250,"active_services":50,"active_customers":500,"active_suppliers":50}'::jsonb),
  ('solo', 2, 'standard', 'Solo', 'annual', 2847.84::numeric,
    '{"active_locations":1,"active_members":2,"active_products":250,"active_services":50,"active_customers":500,"active_suppliers":50}'::jsonb),
  ('team', 1, 'standard', 'Team', 'monthly', 699.00::numeric,
    '{"active_locations":1,"active_members":8,"active_products":500,"active_services":100,"active_customers":2000,"active_suppliers":150}'::jsonb),
  ('team', 2, 'standard', 'Team', 'annual', 5703.84::numeric,
    '{"active_locations":1,"active_members":8,"active_products":500,"active_services":100,"active_customers":2000,"active_suppliers":150}'::jsonb),
  ('multi', 1, 'multi_2', 'Multi · 2 branches', 'monthly', 999.00::numeric,
    '{"active_locations":2,"active_members":16,"active_products":1000,"active_services":200,"active_customers":5000,"active_suppliers":300}'::jsonb),
  ('multi', 2, 'multi_2', 'Multi · 2 branches', 'annual', 8151.84::numeric,
    '{"active_locations":2,"active_members":16,"active_products":1000,"active_services":200,"active_customers":5000,"active_suppliers":300}'::jsonb),
  ('multi', 3, 'multi_3', 'Multi · 3 branches', 'monthly', 1199.00::numeric,
    '{"active_locations":3,"active_members":25,"active_products":2000,"active_services":300,"active_customers":10000,"active_suppliers":500}'::jsonb),
  ('multi', 4, 'multi_3', 'Multi · 3 branches', 'annual', 9783.84::numeric,
    '{"active_locations":3,"active_members":25,"active_products":2000,"active_services":300,"active_customers":10000,"active_suppliers":500}'::jsonb)
), selected as (
  select plan.id plan_id, plan.is_public, plan.is_purchasable, offer.*,
    coalesce((select max(existing.version) from public.plan_catalog_terms existing
      where existing.plan_id = plan.id), 0) base_version
  from offers offer
  join public.portals portal on portal.key = 'shop-crm'
  join public.plans plan on plan.portal_id = portal.id and plan.slug = offer.slug
)
insert into public.plan_catalog_terms (
  plan_id, version, display_name, billing_interval, currency, price_amount,
  trial_days, resource_limits, is_public, is_purchasable, effective_from,
  catalog_generation, plan_variant, variant_name
)
select selected.plan_id,
  selected.base_version + row_number() over (
    partition by selected.plan_id order by selected.ordinal
  ),
  selected.variant_name, selected.billing_interval, 'EGP', selected.price_amount,
  7, selected.resource_limits, selected.is_public, selected.is_purchasable,
  clock_timestamp(), 2, selected.plan_variant, selected.variant_name
from selected;

update public.plans plan set catalog_version = latest.version
from (
  select terms.plan_id, max(terms.version) version
  from public.plan_catalog_terms terms group by terms.plan_id
) latest
where plan.id = latest.plan_id and plan.catalog_version is distinct from latest.version;

-- Keep the maintained reconciliation entry point from restoring the
-- superseded four-resource headline values. Immutable offers are created by
-- versioned migrations; reconciliation only refreshes mutable family fields.
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
      when 'solo' then '{"active_locations":1,"active_members":2,"active_products":250,"active_services":50,"active_customers":500,"active_suppliers":50}'::jsonb
      when 'team' then '{"active_locations":1,"active_members":8,"active_products":500,"active_services":100,"active_customers":2000,"active_suppliers":150}'::jsonb
      when 'multi' then '{"active_locations":2,"active_members":16,"active_products":1000,"active_services":200,"active_customers":5000,"active_suppliers":300}'::jsonb
    end,
    features = case plan.slug
      when 'solo' then '{"inventory":true,"max_locations":1,"max_members":2,"max_products":250,"max_services":50,"max_customers":500,"max_suppliers":50}'::jsonb
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

create or replace function shop_private.plan_resource_lock_key(
  p_shop_id uuid, p_resource text
) returns bigint language plpgsql immutable strict set search_path = '' as $$
begin
  if p_resource not in (
    'active_locations', 'active_members', 'active_products', 'active_services',
    'active_customers', 'active_suppliers'
  ) then
    raise exception 'UNKNOWN_PLAN_RESOURCE' using errcode = '22023';
  end if;
  return pg_catalog.hashtextextended(
    p_shop_id::text || ':plan-resource:' || p_resource, 91827364
  );
end;
$$;

create or replace function shop_private.lock_all_plan_resources(p_shop_id uuid)
returns void language plpgsql volatile set search_path = '' as $$
declare v_resource text;
begin
  if p_shop_id is null then
    raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023';
  end if;
  foreach v_resource in array array[
    'active_locations', 'active_members', 'active_products', 'active_services',
    'active_customers', 'active_suppliers'
  ] loop
    perform shop_private.lock_plan_resource(p_shop_id, v_resource);
  end loop;
end;
$$;

create or replace function shop_private.plan_resource_usage(
  p_shop_id uuid, p_resource text
) returns bigint language plpgsql stable security definer set search_path = '' as $$
declare v_usage bigint;
begin
  case p_resource
    when 'active_locations' then
      select count(*) into v_usage from public.shop_locations location
      where location.shop_id = p_shop_id and location.status = 'active';
    when 'active_members' then
      select
        (select count(*) from public.shop_memberships membership
          where membership.shop_id = p_shop_id and membership.status = 'active'
            and membership.removed_at is null)
        +
        (select count(*) from public.shop_team_invitations invitation
          where invitation.shop_id = p_shop_id and invitation.status = 'pending'
            and invitation.expires_at > now())
      into v_usage;
    when 'active_products' then
      select count(*) into v_usage from public.products product
      where product.shop_id = p_shop_id and product.is_active;
    when 'active_services' then
      select count(*) into v_usage from public.services service
      where service.shop_id = p_shop_id and service.is_active;
    when 'active_customers' then
      select count(*) into v_usage from public.clients customer
      where customer.shop_id = p_shop_id and customer.is_active;
    when 'active_suppliers' then
      select count(*) into v_usage from public.vendors supplier
      where supplier.shop_id = p_shop_id and supplier.is_active;
    else
      raise exception 'UNKNOWN_PLAN_RESOURCE' using errcode = '22023';
  end case;
  return coalesce(v_usage, 0);
end;
$$;

create or replace function shop_private.subscription_resource_limit(
  p_shop_id uuid, p_resource text
) returns integer language plpgsql stable security definer set search_path = '' as $$
declare v_entitlement record;
begin
  if p_resource not in (
    'active_locations', 'active_members', 'active_products', 'active_services',
    'active_customers', 'active_suppliers'
  ) then
    raise exception 'UNKNOWN_PLAN_RESOURCE' using errcode = '22023';
  end if;
  select * into v_entitlement
  from shop_private.resolve_plan_entitlement(p_shop_id);
  if not found then return null; end if;
  return (v_entitlement.resource_limits ->> p_resource)::integer;
end;
$$;

create or replace function shop_private.enforce_active_resource_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_resource text; v_increases boolean;
begin
  case tg_table_name
    when 'shop_locations' then
      v_resource := 'active_locations';
      v_increases := new.status = 'active'
        and (tg_op = 'INSERT' or old.status <> 'active');
    when 'shop_memberships' then
      v_resource := 'active_members';
      v_increases := new.status = 'active' and new.removed_at is null
        and (tg_op = 'INSERT' or old.status <> 'active' or old.removed_at is not null);
    when 'products' then
      v_resource := 'active_products';
      v_increases := new.is_active and (tg_op = 'INSERT' or not old.is_active);
    when 'services' then
      v_resource := 'active_services';
      v_increases := new.is_active and (tg_op = 'INSERT' or not old.is_active);
    when 'clients' then
      v_resource := 'active_customers';
      v_increases := new.is_active and (tg_op = 'INSERT' or not old.is_active
        or old.shop_id is distinct from new.shop_id);
    when 'vendors' then
      v_resource := 'active_suppliers';
      v_increases := new.is_active and (tg_op = 'INSERT' or not old.is_active
        or old.shop_id is distinct from new.shop_id);
    else
      raise exception 'UNKNOWN_PLAN_RESOURCE_TABLE' using errcode = '22023';
  end case;
  if v_increases then
    perform shop_private.assert_plan_resource_capacity(new.shop_id, v_resource);
  end if;
  return new;
end;
$$;

create trigger clients_plan_limit
before insert or update of shop_id, is_active on public.clients
for each row execute function shop_private.enforce_active_resource_limit();
create trigger vendors_plan_limit
before insert or update of shop_id, is_active on public.vendors
for each row execute function shop_private.enforce_active_resource_limit();

create or replace function shop_private.plan_usage_snapshot(p_shop_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with entitlement as (
    select * from shop_private.resolve_plan_entitlement(p_shop_id)
  ), resources(resource, label, ordinal) as (values
    ('active_locations'::text, 'locations'::text, 1),
    ('active_members', 'members', 2),
    ('active_products', 'products', 3),
    ('active_services', 'services', 4),
    ('active_customers', 'customers', 5),
    ('active_suppliers', 'suppliers', 6)
  ), usage as (
    select resource, label, ordinal,
      shop_private.plan_resource_usage(p_shop_id, resource) used_value,
      (entitlement.resource_limits ->> resource)::integer limit_value
    from resources cross join entitlement
  )
  select jsonb_build_object(
    'locations', max(used_value) filter (where label = 'locations'),
    'members', max(used_value) filter (where label = 'members'),
    'products', max(used_value) filter (where label = 'products'),
    'services', max(used_value) filter (where label = 'services'),
    'customers', max(used_value) filter (where label = 'customers'),
    'suppliers', max(used_value) filter (where label = 'suppliers'),
    'limits', (select resource_limits from entitlement),
    'resources', jsonb_agg(jsonb_build_object(
      'resource', resource, 'used', used_value, 'limit', limit_value,
      'remaining', case when limit_value is null then null
        else greatest(limit_value - used_value, 0) end,
      'unlimited', limit_value is null,
      'atLimit', limit_value is not null and used_value >= limit_value,
      'overLimit', limit_value is not null and used_value > limit_value
    ) order by ordinal)
  ) from usage;
$$;

create or replace function shop_private.plan_change_blockers(
  p_shop_id uuid, p_resource_limits jsonb
) returns jsonb language sql stable security definer set search_path = '' as $$
  with resources(resource, ordinal) as (values
    ('active_locations'::text, 1), ('active_members', 2),
    ('active_products', 3), ('active_services', 4),
    ('active_customers', 5), ('active_suppliers', 6)
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

create or replace function shop_private.plan_is_downgrade(
  p_current jsonb, p_target jsonb
) returns boolean language sql immutable set search_path = '' as $$
  select exists (
    select 1 from unnest(array[
      'active_locations', 'active_members', 'active_products', 'active_services',
      'active_customers', 'active_suppliers'
    ]) resource
    where (p_target ->> resource)::integer is not null
      and ((p_current ->> resource)::integer is null
        or (p_target ->> resource)::integer < (p_current ->> resource)::integer)
  );
$$;

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
      'active_locations', 'active_members', 'active_products', 'active_services',
      'active_customers', 'active_suppliers'
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

revoke all on function shop_private.require_purchasable_six_resource_limits()
from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
