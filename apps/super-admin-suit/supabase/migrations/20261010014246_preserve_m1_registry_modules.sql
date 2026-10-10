-- Preserve Billing/Custom navigation when composing the completed Audit migration.
-- Retain exact owner, capability, binding, expiry and visibility checks.
create or replace function super_admin_private.registry_projection()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare administrator public.platform_admins;
begin
  administrator := super_admin_private.assert_platform_owner();
  return jsonb_build_object('suits', coalesce((
    select jsonb_agg(jsonb_build_object(
      'key', suit.stable_key, 'label', suit.display_name,
      'description', suit.description, 'asset', suit.asset_reference,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'key', item.stable_key, 'label', item.label,
          'description', item.description, 'module', item.module_kind, 'bindingId', case when item.module_kind in ('manual-transfer','payment-review','custom-offers') then super_admin_private.transfer_binding(suit.id) else null end
        ) order by item.sort_order, item.stable_key)
        from public.navigation_items item
        where item.suit_id = suit.id and item.enabled
          and item.route_descriptor = '{}'::jsonb
          and item.visibility_policy in ('{}'::jsonb, '{"role":"owner"}'::jsonb)
          and (
            (item.module_kind='activity' and item.required_capability_key is null) or (item.module_kind in ('manual-transfer','payment-review','custom-offers') and item.required_capability_key='shop.billing.query' and item.required_capability_version='1.0' and super_admin_private.transfer_binding(suit.id) is not null) or (item.module_kind = 'overview' and item.required_capability_key is null)
            or (
              item.module_kind = 'capabilities'
              and item.required_capability_key = 'adapter.capabilities.read'
              and item.required_capability_version = '1.0'
              and exists (
                select 1 from public.suit_environment_bindings binding
                join public.admin_environments target_environment on target_environment.id = binding.target_environment_id
                join public.adapter_registrations adapter on adapter.binding_id = binding.id
                join public.adapter_capability_policy policy on policy.adapter_registration_id = adapter.id
                join lateral (
                  select observation.* from public.adapter_manifest_observations observation
                  where observation.binding_id = binding.id
                  order by observation.observed_at desc, observation.id desc limit 1
                ) manifest on true
                where binding.suit_id = suit.id
                  and binding.admin_environment_id = administrator.authority_environment_id
                  and binding.status = 'active' and adapter.status = 'active'
                  and target_environment.status = 'active'
                  and adapter.protocol_min_version = '1.0' and adapter.protocol_max_version = '1.0'
                  and adapter.manifest_schema_version = '1.0'
                  and policy.enabled and policy.capability_key = item.required_capability_key
                  and policy.min_version = '1.0' and policy.max_version = '1.0'
                  and 'adapter.capabilities.read' = any(policy.query_scopes)
                  and manifest.verification_outcome = 'verified'
                  and manifest.expires_at > statement_timestamp()
                  and manifest.observed_at <= statement_timestamp()
                  and manifest.observed_at > statement_timestamp() - make_interval(secs => adapter.manifest_max_age_seconds)
                  and '1.0' = any(manifest.protocol_versions)
                  and manifest.verified_capabilities @> '[{"key":"adapter.capabilities.read","version":"1.0","queryScopes":["adapter.capabilities.read"]}]'::jsonb
              )
            )
          )
      ), '[]'::jsonb)
    ) order by suit.sort_order, suit.stable_key)
    from public.suit_registry suit
    where suit.status = 'active' and suit.adapter_contract_version = '1.0'
      and exists (
        select 1 from public.suit_environment_bindings binding
        join public.admin_environments environment on environment.id = binding.target_environment_id
        where binding.suit_id = suit.id
          and binding.admin_environment_id = administrator.authority_environment_id
          and binding.status = 'active' and environment.status = 'active'
      )
  ), '[]'::jsonb));
end;
$$;
