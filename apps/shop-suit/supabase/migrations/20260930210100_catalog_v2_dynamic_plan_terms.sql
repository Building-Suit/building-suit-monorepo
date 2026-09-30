-- SS-HOT-PLAN-CATALOG-V2-001 repair: the V2 migration was already recorded in
-- the local verifier database before its generic reconciliation path was
-- restored. Reapply that function through forward history so newly added plans
-- receive their first immutable term before the built-in V2 offers reconcile.

create or replace function shop_private.reconcile_plan_catalog()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_portal_id uuid;
begin
  select portal.id into v_portal_id
  from public.portals portal where portal.key = 'shop-crm';
  if v_portal_id is null then return; end if;

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

  perform shop_private.reconcile_plan_catalog_v2();
end;
$$;
