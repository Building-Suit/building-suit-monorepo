-- New bounded account capability; no bindings, keys, navigation or runtime values are seeded.
create or replace function super_admin_private.adapter_configuration(p_binding uuid, p_operation text, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b public.suit_environment_bindings; a public.adapter_registrations;
  c public.adapter_capability_policy; m public.adapter_manifest_observations;
  s public.integration_secret_references; settings jsonb; authority uuid;
  source_kind text; target_kind text;
begin
  if p_operation !~ '^(adapter\.capabilities\.read|shop\.(platform|billing|plan|account)\.(query|command))$' then
    raise exception 'CAPABILITY_UNAVAILABLE' using errcode='22023';
  end if;
  select authority_environment_id into authority from public.platform_admins
    where user_id=p_actor and enabled and role='owner';
  select * into b from public.suit_environment_bindings where id=p_binding and status='active';
  if authority is null or b.id is null or b.admin_environment_id<>authority then
    raise exception 'ENVIRONMENT_MISMATCH' using errcode='42501';
  end if;
  select environment_kind into source_kind from public.admin_environments where id=authority and status='active';
  select environment_kind into target_kind from public.admin_environments where id=b.target_environment_id and status='active';
  if source_kind is null or target_kind is distinct from source_kind then
    raise exception 'ENVIRONMENT_MISMATCH' using errcode='42501';
  end if;
  if not exists(select 1 from public.suit_registry where id=b.suit_id and status='active' and adapter_contract_version='1.0') then
    raise exception 'CONFIGURATION_UNAVAILABLE';
  end if;
  select * into a from public.adapter_registrations where binding_id=b.id and status='active'
    and protocol_min_version='1.0' and protocol_max_version='1.0' and manifest_schema_version='1.0';
  select * into c from public.adapter_capability_policy where adapter_registration_id=a.id
    and capability_key=p_operation and enabled and min_version='1.0' and max_version='1.0'
    and case when p_operation like '%.command' then p_operation=any(command_scopes) else p_operation=any(query_scopes) end;
  select * into m from public.adapter_manifest_observations where binding_id=b.id order by observed_at desc,id desc limit 1;
  if a.id is null or c.id is null or m.id is null or m.verification_outcome<>'verified'
    or m.expires_at<=clock_timestamp() or m.observed_at<clock_timestamp()-make_interval(secs=>a.manifest_max_age_seconds)
    or not ('1.0'=any(m.protocol_versions))
    or not exists(select 1 from jsonb_array_elements(m.verified_capabilities) item
      where item->>'operation'=p_operation and item->>'version'='1.0') then
    raise exception 'CAPABILITY_UNAVAILABLE';
  end if;
  select r.* into s from public.integration_secret_references r
    join public.integration_providers provider on provider.id=r.provider_id and provider.status='active' and provider.configuration_schema_version='1.0'
    where r.binding_id=b.id and r.purpose='adapter-signing' and r.status='active'
      and r.valid_from<=clock_timestamp() and (r.valid_until is null or r.valid_until>clock_timestamp())
    order by r.key_version desc,r.id limit 1;
  select non_secret_value into settings from public.integration_settings
    where binding_id=b.id and provider_id=s.provider_id and setting_key='adapter-dispatch-policy'
      and status='active' and schema_version='1.0' and value_type='object'
      and effective_from<=clock_timestamp() and (effective_until is null or effective_until>clock_timestamp());
  if s.id is null or settings is null or jsonb_typeof(b.egress_policy->'allowedHosts') is distinct from 'array'
    or not coalesce((settings->>'timeoutMs')::integer between 1 and 120000,false)
    or not coalesce((settings->>'maxResponseBytes')::integer between 1 and 1048576,false)
    or settings->>'targetBindingId' is null then raise exception 'CONFIGURATION_UNAVAILABLE'; end if;
  return jsonb_build_object('binding',to_jsonb(b),'adapter',to_jsonb(a),'capability',to_jsonb(c),
    'manifest',to_jsonb(m),'secretReference',to_jsonb(s),'settings',settings);
end $$;

create function super_admin_private.account_provisioning_available(p_binding uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor public.platform_admins; cfg jsonb;
begin
 actor:=super_admin_private.assert_platform_owner();
 perform super_admin_private.adapter_configuration(p_binding,'shop.account.query',actor.user_id);
 cfg:=super_admin_private.adapter_configuration(p_binding,'shop.account.command',actor.user_id);
 return exists(select 1 from jsonb_array_elements(cfg#>'{manifest,verified_capabilities}') c
  where c->>'operation'='shop.account.command' and c->>'version'='1.0'
   and c->'members' ?& array['create_and_activate','resend_invitation']);
exception when others then return false;
end $$;
revoke all on function super_admin_private.account_provisioning_available(uuid) from public,anon,authenticated,service_role;

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
          'description', item.description, 'module', item.module_kind, 'provisioningAvailable', case when item.module_kind='accounts' then super_admin_private.account_provisioning_available(super_admin_private.account_binding(suit.id)) else false end, 'bindingId', case when item.module_kind='accounts' then super_admin_private.account_binding(suit.id) when item.module_kind in ('manual-transfer','payment-review','custom-offers') then super_admin_private.transfer_binding(suit.id) else null end
        ) order by item.sort_order, item.stable_key)
        from public.navigation_items item
        where item.suit_id = suit.id and item.enabled
          and item.route_descriptor = '{}'::jsonb
          and item.visibility_policy in ('{}'::jsonb, '{"role":"owner"}'::jsonb)
          and (
            (item.module_kind='accounts' and item.required_capability_key='shop.plan.command' and item.required_capability_version='1.0' and super_admin_private.account_binding(suit.id) is not null) or (item.module_kind='activity' and item.required_capability_key is null) or (item.module_kind in ('manual-transfer','payment-review','custom-offers') and item.required_capability_key='shop.billing.query' and item.required_capability_version='1.0' and super_admin_private.transfer_binding(suit.id) is not null) or (item.module_kind = 'overview' and item.required_capability_key is null)
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

notify pgrst,'reload schema';
