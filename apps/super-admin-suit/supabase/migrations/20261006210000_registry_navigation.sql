-- Registry ordering stays versioned and audited through the existing command.
alter table public.suit_registry add column sort_order integer not null default 0;

create or replace function public.super_admin_configuration_command(
  p_request_id uuid,
  p_correlation_id uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_expected_version bigint,
  p_reason text,
  p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  administrator public.platform_admins;
  existing_event public.control_plane_events;
  before_row jsonb;
  after_row jsonb;
  answer jsonb;
  action_name text;
  new_version bigint;
  fingerprint text;
  suit_id_value uuid;
  target_environment_id_value uuid;
  safe_parameters jsonb;
begin
  administrator := super_admin_private.assert_platform_owner();
  if p_request_id is null or p_correlation_id is null or p_resource_id is null then
    raise exception 'CONFIG_IDENTIFIERS_REQUIRED' using errcode = '22023';
  end if;
  if p_expected_version is null or p_expected_version < 0 then raise exception 'CONFIG_VERSION_INVALID' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception 'CONFIG_REASON_INVALID' using errcode = '22023';
  end if;
  fingerprint := md5(concat_ws('|', p_correlation_id::text, p_resource_type, p_resource_id::text,
    p_expected_version::text, btrim(p_reason), p_payload::text));
  select * into existing_event from public.control_plane_events where request_id = p_request_id;
  if existing_event.id is not null then
    if existing_event.request_fingerprint <> fingerprint then
      raise exception 'CONFIG_REQUEST_ID_REUSED' using errcode = '23505';
    end if;
    return existing_event.result || jsonb_build_object('replayed', true);
  end if;

  case p_resource_type
    when 'environment' then
      perform super_admin_private.assert_payload_keys(p_payload, array['stableKey','kind','displayName','status','bindingFingerprint']);
      select to_jsonb(row) into before_row from public.admin_environments row where row.id = p_resource_id for update;
      if p_expected_version = 0 then
        if before_row is not null then raise exception 'CONFIG_VERSION_CONFLICT' using errcode = '40001'; end if;
        insert into public.admin_environments (id, stable_key, environment_kind, display_name, status, binding_fingerprint)
        values (p_resource_id, p_payload->>'stableKey', p_payload->>'kind', p_payload->'displayName',
          coalesce(p_payload->>'status', 'inactive'), p_payload->>'bindingFingerprint') returning to_jsonb(admin_environments.*) into after_row;
        action_name := 'create';
      else
        if before_row is null or (before_row->>'version')::bigint <> p_expected_version then raise exception 'CONFIG_VERSION_CONFLICT' using errcode = '40001'; end if;
        update public.admin_environments set stable_key = coalesce(p_payload->>'stableKey', stable_key),
          environment_kind = coalesce(p_payload->>'kind', environment_kind), display_name = coalesce(p_payload->'displayName', display_name),
          status = coalesce(p_payload->>'status', status), binding_fingerprint = coalesce(p_payload->>'bindingFingerprint', binding_fingerprint),
          version = version + 1, updated_at = clock_timestamp() where id = p_resource_id returning to_jsonb(admin_environments.*) into after_row;
        action_name := case when after_row->>'status' = 'retired' then 'retire' else 'update' end;
      end if;
      target_environment_id_value := p_resource_id;
    when 'suit' then
      perform super_admin_private.assert_payload_keys(p_payload, array['stableKey','displayName','description','assetReference','adapterContractVersion','status','sortOrder']);
      select to_jsonb(row) into before_row from public.suit_registry row where row.id = p_resource_id for update;
      if p_expected_version = 0 then
        insert into public.suit_registry (id, stable_key, display_name, description, asset_reference, adapter_contract_version, status, sort_order)
        values (p_resource_id, p_payload->>'stableKey', p_payload->'displayName', coalesce(p_payload->'description','{}'::jsonb),
          p_payload->>'assetReference', p_payload->>'adapterContractVersion', coalesce(p_payload->>'status','draft'), coalesce((p_payload->>'sortOrder')::integer,0))
        returning to_jsonb(suit_registry.*) into after_row; action_name := 'create';
      else
        if before_row is null or (before_row->>'version')::bigint <> p_expected_version then raise exception 'CONFIG_VERSION_CONFLICT' using errcode = '40001'; end if;
        update public.suit_registry set display_name = coalesce(p_payload->'displayName', display_name),
          description = coalesce(p_payload->'description', description), asset_reference = coalesce(p_payload->>'assetReference', asset_reference),
          adapter_contract_version = coalesce(p_payload->>'adapterContractVersion', adapter_contract_version),
          sort_order = coalesce((p_payload->>'sortOrder')::integer, sort_order),
          status = coalesce(p_payload->>'status', status), version = version + 1, updated_at = clock_timestamp()
        where id = p_resource_id returning to_jsonb(suit_registry.*) into after_row;
        action_name := case when after_row->>'status' = 'retired' then 'retire' else 'update' end;
      end if;
      suit_id_value := p_resource_id;
    when 'binding' then
      perform super_admin_private.assert_payload_keys(p_payload, array['suitId','adminEnvironmentId','targetEnvironmentId','adapterBaseUrl','audience','targetIdentityFingerprint','egressPolicy','status']);
      select to_jsonb(row) into before_row from public.suit_environment_bindings row where row.id = p_resource_id for update;
      if p_expected_version = 0 then
        insert into public.suit_environment_bindings (id,suit_id,admin_environment_id,target_environment_id,adapter_base_url,audience,target_identity_fingerprint,egress_policy,status)
        values (p_resource_id,(p_payload->>'suitId')::uuid,(p_payload->>'adminEnvironmentId')::uuid,(p_payload->>'targetEnvironmentId')::uuid,p_payload->>'adapterBaseUrl',p_payload->>'audience',p_payload->>'targetIdentityFingerprint',p_payload->'egressPolicy',coalesce(p_payload->>'status','inactive'))
        returning to_jsonb(suit_environment_bindings.*) into after_row; action_name := 'create';
      else
        if before_row is null or (before_row->>'version')::bigint <> p_expected_version then raise exception 'CONFIG_VERSION_CONFLICT' using errcode = '40001'; end if;
        update public.suit_environment_bindings set adapter_base_url=coalesce(p_payload->>'adapterBaseUrl',adapter_base_url), audience=coalesce(p_payload->>'audience',audience),
          target_identity_fingerprint=coalesce(p_payload->>'targetIdentityFingerprint',target_identity_fingerprint), egress_policy=coalesce(p_payload->'egressPolicy',egress_policy),
          status=coalesce(p_payload->>'status',status), version=version+1, updated_at=clock_timestamp() where id=p_resource_id returning to_jsonb(suit_environment_bindings.*) into after_row;
        action_name := case when after_row->>'status' = 'retired' then 'retire' else 'update' end;
      end if;
      if after_row->>'status' = 'active' then
        perform super_admin_private.assert_binding_activation(p_resource_id);
      end if;
      suit_id_value := (after_row->>'suit_id')::uuid; target_environment_id_value := (after_row->>'target_environment_id')::uuid;
    when 'adapter' then
      perform super_admin_private.assert_payload_keys(p_payload, array['bindingId','adapterKey','protocolMinVersion','protocolMaxVersion','manifestSchemaVersion','manifestMaxAgeSeconds','status']);
      select to_jsonb(row) into before_row from public.adapter_registrations row where row.id=p_resource_id for update;
      if p_expected_version=0 then
        insert into public.adapter_registrations (id,binding_id,adapter_key,protocol_min_version,protocol_max_version,manifest_schema_version,manifest_max_age_seconds,status)
        values(p_resource_id,(p_payload->>'bindingId')::uuid,p_payload->>'adapterKey',p_payload->>'protocolMinVersion',p_payload->>'protocolMaxVersion',p_payload->>'manifestSchemaVersion',(p_payload->>'manifestMaxAgeSeconds')::integer,coalesce(p_payload->>'status','inactive'))
        returning to_jsonb(adapter_registrations.*) into after_row; action_name:='create';
      else
        if before_row is null or (before_row->>'version')::bigint<>p_expected_version then raise exception 'CONFIG_VERSION_CONFLICT' using errcode='40001'; end if;
        update public.adapter_registrations set protocol_min_version=coalesce(p_payload->>'protocolMinVersion',protocol_min_version), protocol_max_version=coalesce(p_payload->>'protocolMaxVersion',protocol_max_version),
          manifest_schema_version=coalesce(p_payload->>'manifestSchemaVersion',manifest_schema_version), manifest_max_age_seconds=coalesce((p_payload->>'manifestMaxAgeSeconds')::integer,manifest_max_age_seconds),
          status=coalesce(p_payload->>'status',status),version=version+1,updated_at=clock_timestamp() where id=p_resource_id returning to_jsonb(adapter_registrations.*) into after_row;
        action_name:=case when after_row->>'status'='retired' then 'retire' else 'update' end;
      end if;
      if after_row->>'status' = 'active' then
        perform super_admin_private.assert_binding_activation((after_row->>'binding_id')::uuid);
      end if;
      select binding.suit_id, binding.target_environment_id
      into suit_id_value, target_environment_id_value
      from public.suit_environment_bindings binding
      where binding.id = (after_row->>'binding_id')::uuid;
    when 'capability' then
      perform super_admin_private.assert_payload_keys(p_payload, array['adapterRegistrationId','capabilityKey','minVersion','maxVersion','queryScopes','commandScopes','enabled']);
      select to_jsonb(row) into before_row from public.adapter_capability_policy row where row.id=p_resource_id for update;
      if p_expected_version=0 then
        insert into public.adapter_capability_policy (id,adapter_registration_id,capability_key,min_version,max_version,query_scopes,command_scopes,enabled)
        values(p_resource_id,(p_payload->>'adapterRegistrationId')::uuid,p_payload->>'capabilityKey',p_payload->>'minVersion',p_payload->>'maxVersion',
          array(select jsonb_array_elements_text(coalesce(p_payload->'queryScopes','[]'::jsonb))),array(select jsonb_array_elements_text(coalesce(p_payload->'commandScopes','[]'::jsonb))),coalesce((p_payload->>'enabled')::boolean,false))
        returning to_jsonb(adapter_capability_policy.*) into after_row; action_name:='create';
      else
        if before_row is null or (before_row->>'version')::bigint<>p_expected_version then raise exception 'CONFIG_VERSION_CONFLICT' using errcode='40001'; end if;
        update public.adapter_capability_policy set min_version=coalesce(p_payload->>'minVersion',min_version),max_version=coalesce(p_payload->>'maxVersion',max_version),
          query_scopes=case when p_payload?'queryScopes' then array(select jsonb_array_elements_text(p_payload->'queryScopes')) else query_scopes end,
          command_scopes=case when p_payload?'commandScopes' then array(select jsonb_array_elements_text(p_payload->'commandScopes')) else command_scopes end,
          enabled=coalesce((p_payload->>'enabled')::boolean,enabled),version=version+1,updated_at=clock_timestamp() where id=p_resource_id returning to_jsonb(adapter_capability_policy.*) into after_row;
        action_name:='update';
      end if;
      select binding.suit_id, binding.target_environment_id
      into suit_id_value, target_environment_id_value
      from public.adapter_registrations adapter
      join public.suit_environment_bindings binding on binding.id = adapter.binding_id
      where adapter.id = (after_row->>'adapter_registration_id')::uuid;
    when 'navigation' then
      perform super_admin_private.assert_payload_keys(p_payload, array['suitId','stableKey','label','description','moduleKind','routeDescriptor','requiredCapabilityKey','requiredCapabilityVersion','visibilityPolicy','sortOrder','enabled']);
      select to_jsonb(row) into before_row from public.navigation_items row where row.id=p_resource_id for update;
      if p_expected_version=0 then
        insert into public.navigation_items (id,suit_id,stable_key,label,description,module_kind,route_descriptor,required_capability_key,required_capability_version,visibility_policy,sort_order,enabled)
        values(p_resource_id,(p_payload->>'suitId')::uuid,p_payload->>'stableKey',p_payload->'label',coalesce(p_payload->'description','{}'::jsonb),p_payload->>'moduleKind',p_payload->'routeDescriptor',p_payload->>'requiredCapabilityKey',p_payload->>'requiredCapabilityVersion',coalesce(p_payload->'visibilityPolicy','{}'::jsonb),coalesce((p_payload->>'sortOrder')::integer,0),coalesce((p_payload->>'enabled')::boolean,false))
        returning to_jsonb(navigation_items.*) into after_row; action_name:='create';
      else
        if before_row is null or (before_row->>'version')::bigint<>p_expected_version then raise exception 'CONFIG_VERSION_CONFLICT' using errcode='40001'; end if;
        update public.navigation_items set label=coalesce(p_payload->'label',label),description=coalesce(p_payload->'description',description),module_kind=coalesce(p_payload->>'moduleKind',module_kind),
          route_descriptor=coalesce(p_payload->'routeDescriptor',route_descriptor),required_capability_key=coalesce(p_payload->>'requiredCapabilityKey',required_capability_key),required_capability_version=coalesce(p_payload->>'requiredCapabilityVersion',required_capability_version),
          visibility_policy=coalesce(p_payload->'visibilityPolicy',visibility_policy),sort_order=coalesce((p_payload->>'sortOrder')::integer,sort_order),enabled=coalesce((p_payload->>'enabled')::boolean,enabled),version=version+1,updated_at=clock_timestamp()
        where id=p_resource_id returning to_jsonb(navigation_items.*) into after_row; action_name:='update';
      end if;
      suit_id_value := (after_row->>'suit_id')::uuid;
    when 'provider' then
      perform super_admin_private.assert_payload_keys(p_payload, array['stableKey','displayName','providerKind','configurationSchemaVersion','status']);
      select to_jsonb(row) into before_row from public.integration_providers row where row.id=p_resource_id for update;
      if p_expected_version=0 then
        insert into public.integration_providers(id,stable_key,display_name,provider_kind,configuration_schema_version,status)
        values(p_resource_id,p_payload->>'stableKey',p_payload->'displayName',p_payload->>'providerKind',p_payload->>'configurationSchemaVersion',coalesce(p_payload->>'status','inactive'))
        returning to_jsonb(integration_providers.*) into after_row; action_name:='create';
      else
        if before_row is null or (before_row->>'version')::bigint<>p_expected_version then raise exception 'CONFIG_VERSION_CONFLICT' using errcode='40001'; end if;
        update public.integration_providers set display_name=coalesce(p_payload->'displayName',display_name),provider_kind=coalesce(p_payload->>'providerKind',provider_kind),
          configuration_schema_version=coalesce(p_payload->>'configurationSchemaVersion',configuration_schema_version),status=coalesce(p_payload->>'status',status),version=version+1,updated_at=clock_timestamp()
        where id=p_resource_id returning to_jsonb(integration_providers.*) into after_row; action_name:=case when after_row->>'status'='retired' then 'retire' else 'update' end;
      end if;
    when 'setting' then
      perform super_admin_private.assert_payload_keys(p_payload, array['providerId','bindingId','settingKey','valueType','value','schemaVersion','effectiveFrom','effectiveUntil','status']);
      select to_jsonb(row) into before_row from public.integration_settings row where row.id=p_resource_id for update;
      if p_expected_version=0 then
        insert into public.integration_settings(id,provider_id,binding_id,setting_key,value_type,non_secret_value,schema_version,effective_from,effective_until,status)
        values(p_resource_id,(p_payload->>'providerId')::uuid,(p_payload->>'bindingId')::uuid,p_payload->>'settingKey',p_payload->>'valueType',p_payload->'value',p_payload->>'schemaVersion',(p_payload->>'effectiveFrom')::timestamptz,(p_payload->>'effectiveUntil')::timestamptz,coalesce(p_payload->>'status','inactive'))
        returning to_jsonb(integration_settings.*) into after_row; action_name:='create';
      else
        if before_row is null or (before_row->>'version')::bigint<>p_expected_version then raise exception 'CONFIG_VERSION_CONFLICT' using errcode='40001'; end if;
        update public.integration_settings set non_secret_value=coalesce(p_payload->'value',non_secret_value),schema_version=coalesce(p_payload->>'schemaVersion',schema_version),
          effective_from=coalesce((p_payload->>'effectiveFrom')::timestamptz,effective_from),effective_until=case when p_payload?'effectiveUntil' then (p_payload->>'effectiveUntil')::timestamptz else effective_until end,
          status=coalesce(p_payload->>'status',status),version=version+1,updated_at=clock_timestamp() where id=p_resource_id returning to_jsonb(integration_settings.*) into after_row;
        action_name:=case when after_row->>'status'='retired' then 'retire' else 'update' end;
      end if;
      if after_row->>'binding_id' is not null then
        select binding.suit_id, binding.target_environment_id
        into suit_id_value, target_environment_id_value
        from public.suit_environment_bindings binding
        where binding.id = (after_row->>'binding_id')::uuid;
      end if;
    when 'secret_reference' then
      perform super_admin_private.assert_payload_keys(p_payload, array['providerId','bindingId','purpose','keyId','keyVersion','vaultSecretId','validFrom','validUntil','status']);
      select to_jsonb(row) into before_row from public.integration_secret_references row where row.id=p_resource_id for update;
      if p_expected_version=0 then
        insert into public.integration_secret_references(id,provider_id,binding_id,purpose,key_id,key_version,vault_secret_id,valid_from,valid_until,status)
        values(p_resource_id,(p_payload->>'providerId')::uuid,(p_payload->>'bindingId')::uuid,p_payload->>'purpose',p_payload->>'keyId',(p_payload->>'keyVersion')::integer,(p_payload->>'vaultSecretId')::uuid,(p_payload->>'validFrom')::timestamptz,(p_payload->>'validUntil')::timestamptz,coalesce(p_payload->>'status','inactive'))
        returning to_jsonb(integration_secret_references.*) into after_row; action_name:='create';
      else
        if before_row is null or (before_row->>'version')::bigint<>p_expected_version then raise exception 'CONFIG_VERSION_CONFLICT' using errcode='40001'; end if;
        update public.integration_secret_references set valid_until=case when p_payload?'validUntil' then (p_payload->>'validUntil')::timestamptz else valid_until end,
          status=coalesce(p_payload->>'status',status),version=version+1,updated_at=clock_timestamp() where id=p_resource_id returning to_jsonb(integration_secret_references.*) into after_row;
        action_name:=case when after_row->>'status'='revoked' then 'revoke' else 'update' end;
      end if;
      select binding.suit_id, binding.target_environment_id
      into suit_id_value, target_environment_id_value
      from public.suit_environment_bindings binding
      where binding.id = (after_row->>'binding_id')::uuid;
    else raise exception 'CONFIG_RESOURCE_NOT_WRITABLE' using errcode='22023';
  end case;

  new_version := (after_row->>'version')::bigint;
  answer := jsonb_build_object('id',p_resource_id,'resourceType',p_resource_type,'version',new_version,'action',action_name,'replayed',false);
  safe_parameters := case when p_resource_type='secret_reference' then p_payload-'vaultSecretId'
    when p_resource_type='binding' then p_payload-'adapterBaseUrl'-'audience'-'targetIdentityFingerprint'-'egressPolicy'
    else p_payload end;
  perform super_admin_private.record_configuration_change(p_request_id,p_correlation_id,administrator,p_resource_type,p_resource_id,new_version,action_name,p_reason,safe_parameters,before_row,after_row,suit_id_value,target_environment_id_value,fingerprint,answer);
  return answer;
end;
$$;


-- Browser projection is one authorized database snapshot. No connection/secret fields.
create function super_admin_private.registry_projection()
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
          'description', item.description, 'module', item.module_kind
        ) order by item.sort_order, item.stable_key)
        from public.navigation_items item
        where item.suit_id = suit.id and item.enabled
          and item.route_descriptor = '{}'::jsonb
          and item.visibility_policy in ('{}'::jsonb, '{"role":"owner"}'::jsonb)
          and (
            (item.module_kind = 'overview' and item.required_capability_key is null)
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
revoke all on function super_admin_private.registry_projection() from public, anon, authenticated, service_role;

create or replace function public.super_admin_configuration_read(p_resource text, p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare answer jsonb;
begin
  perform super_admin_private.assert_platform_owner();
  case p_resource
    when 'registry' then
      if p_id is not null then raise exception 'REGISTRY_ID_NOT_SUPPORTED' using errcode = '22023'; end if;
      answer := super_admin_private.registry_projection();
    when 'environments' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', environment.id, 'stableKey', environment.stable_key,
        'kind', environment.environment_kind, 'displayName', environment.display_name,
        'status', environment.status, 'version', environment.version
      ) order by environment.stable_key), '[]'::jsonb) into answer
      from public.admin_environments environment where p_id is null or environment.id = p_id;
    when 'suits' then
      select coalesce(jsonb_agg(to_jsonb(suit) - 'created_at' - 'updated_at' order by suit.stable_key), '[]'::jsonb)
      into answer from public.suit_registry suit where p_id is null or suit.id = p_id;
    when 'adapters' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', adapter.id, 'bindingId', adapter.binding_id, 'adapterKey', adapter.adapter_key,
        'protocolMinVersion', adapter.protocol_min_version, 'protocolMaxVersion', adapter.protocol_max_version,
        'manifestSchemaVersion', adapter.manifest_schema_version,
        'manifestMaxAgeSeconds', adapter.manifest_max_age_seconds,
        'status', adapter.status, 'version', adapter.version
      ) order by adapter.adapter_key), '[]'::jsonb) into answer
      from public.adapter_registrations adapter where p_id is null or adapter.id = p_id;
    when 'capabilities' then
      select coalesce(jsonb_agg(to_jsonb(capability) - 'created_at' - 'updated_at' order by capability.capability_key), '[]'::jsonb)
      into answer from public.adapter_capability_policy capability where p_id is null or capability.id = p_id;
    when 'navigation' then
      select coalesce(jsonb_agg(to_jsonb(item) - 'created_at' - 'updated_at' order by item.sort_order, item.id), '[]'::jsonb)
      into answer from public.navigation_items item where p_id is null or item.id = p_id;
    when 'providers' then
      select coalesce(jsonb_agg(to_jsonb(provider) - 'created_at' - 'updated_at' order by provider.stable_key), '[]'::jsonb)
      into answer from public.integration_providers provider where p_id is null or provider.id = p_id;
    when 'settings' then
      select coalesce(jsonb_agg(to_jsonb(setting) - 'created_at' - 'updated_at' order by setting.setting_key), '[]'::jsonb)
      into answer from public.integration_settings setting where p_id is null or setting.id = p_id;
    when 'audit' then
      select coalesce(jsonb_agg(to_jsonb(event) - 'request_fingerprint' order by event.occurred_at desc, event.id desc), '[]'::jsonb)
      into answer from (
        select * from public.control_plane_events event
        where p_id is null or event.target_id = p_id
        order by event.occurred_at desc, event.id desc limit 200
      ) event;
    else raise exception 'CONFIG_RESOURCE_NOT_READABLE' using errcode = '22023';
  end case;
  return answer;
end;
$$;
