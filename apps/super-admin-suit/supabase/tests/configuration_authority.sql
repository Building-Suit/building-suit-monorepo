-- SAS-M1-CONFIG-001: authorization, versioning, audit immutability, and secret isolation.
begin;

select plan(6);

create temporary table sas_config_fixture as
select
  gen_random_uuid() as owner_id,
  gen_random_uuid() as outsider_id,
  gen_random_uuid() as disabled_id,
  gen_random_uuid() as environment_id,
  gen_random_uuid() as suit_id,
  gen_random_uuid() as binding_id,
  gen_random_uuid() as adapter_id,
  gen_random_uuid() as capability_id,
  gen_random_uuid() as navigation_id,
  gen_random_uuid() as provider_id,
  gen_random_uuid() as setting_id,
  gen_random_uuid() as secret_reference_id,
  gen_random_uuid() as vault_secret_id,
  gen_random_uuid() as create_suit_request_id,
  gen_random_uuid() as create_suit_correlation_id;
grant select on sas_config_fixture to authenticated;

insert into auth.users (
  id, email, encrypted_password, aud, role, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select id, id::text || '@sas-config.invalid', 'x', 'authenticated', 'authenticated',
  '{"role":"owner","platform_admin":true}'::jsonb,
  '{"role":"owner","platform_admin":true}'::jsonb, now(), now()
from (
  select owner_id as id from sas_config_fixture
  union all select outsider_id from sas_config_fixture
  union all select disabled_id from sas_config_fixture
) users;

insert into public.admin_environments (
  id, stable_key, environment_kind, display_name, status, binding_fingerprint
)
select environment_id, 'fixture-staging', 'staging', '{"en":"Fixture staging"}', 'active',
  'sha256:fixture-admin-environment'
from sas_config_fixture;

insert into public.platform_admins (
  user_id, authority_environment_id, role, enabled, provisioned_by, disabled_at
)
select owner_id, environment_id, 'owner', true, owner_id, null from sas_config_fixture
union all
select disabled_id, environment_id, 'owner', false, owner_id, now() from sas_config_fixture;

-- Every public business table is RLS protected, has an explicit service policy,
-- and has no browser table privileges. Public RPC wrappers use safe definers.
do $$
declare
  relation_name text;
  function_row record;
begin
  foreach relation_name in array array[
    'admin_environments', 'platform_admins', 'suit_registry', 'suit_environment_bindings',
    'adapter_registrations', 'adapter_capability_policy', 'navigation_items',
    'integration_providers', 'integration_settings', 'integration_secret_references',
    'adapter_manifest_observations', 'configuration_revisions', 'control_plane_events'
  ] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || relation_name)::regclass) then
      raise exception 'RLS disabled for %', relation_name;
    end if;
    if not exists (
      select 1 from pg_policies policy
      where policy.schemaname = 'public' and policy.tablename = relation_name
        and policy.roles = array['service_role']::name[]
    ) then
      raise exception 'service policy missing for %', relation_name;
    end if;
    if has_table_privilege('anon', 'public.' || relation_name, 'select')
      or has_table_privilege('authenticated', 'public.' || relation_name, 'select')
      or has_table_privilege('authenticated', 'public.' || relation_name, 'insert')
      or has_table_privilege('authenticated', 'public.' || relation_name, 'update')
      or has_table_privilege('authenticated', 'public.' || relation_name, 'delete') then
      raise exception 'browser table privilege leaked for %', relation_name;
    end if;
  end loop;

  for function_row in
    select procedure.oid, procedure.proname, procedure.prosecdef, procedure.proconfig
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        'super_admin_session', 'super_admin_configuration_read',
        'super_admin_configuration_command'
      ])
  loop
    if not function_row.prosecdef
      or function_row.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', function_row.oid, 'execute')
      or has_function_privilege('anon', function_row.oid, 'execute') then
      raise exception 'unsafe public wrapper: %', function_row.proname;
    end if;
  end loop;

  if exists (
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'super_admin_private'
      and has_function_privilege('authenticated', procedure.oid, 'execute')
  ) then
    raise exception 'private helper executable by browser role';
  end if;
  if has_table_privilege('service_role', 'public.suit_registry', 'insert')
    or has_table_privilege('service_role', 'public.suit_environment_bindings', 'update')
    or has_table_privilege('service_role', 'public.control_plane_events', 'delete')
    or not has_table_privilege('service_role', 'public.integration_secret_references', 'select')
    or not has_table_privilege('service_role', 'public.adapter_manifest_observations', 'insert') then
    raise exception 'service role configuration privileges exceed the bounded server contract';
  end if;
end;
$$;
select pass('public configuration schema is deny-by-default and uses bounded privileged wrappers');

-- User/app metadata, URL state, and ordinary authentication never grant authority.
select set_config('request.jwt.claim.sub', outsider_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from sas_config_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.super_admin_session();
    raise exception 'metadata-bearing outsider entered Super Admin';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.suit_registry;
    raise exception 'outsider read configuration table';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select pass('metadata-bearing outsider is denied Super Admin authority and table access');

select set_config('request.jwt.claim.sub', disabled_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from sas_config_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.super_admin_configuration_read('suits');
    raise exception 'disabled platform owner retained authority';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select pass('disabled platform owner is denied configuration access');

-- An enabled, explicitly provisioned owner can create versioned configuration.
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from sas_config_fixture;
set local role authenticated;
do $$
declare
  fixture sas_config_fixture%rowtype;
  result jsonb;
begin
  select * into fixture from sas_config_fixture;
  if public.super_admin_session() ->> 'role' <> 'owner' then
    raise exception 'provisioned owner session missing';
  end if;

  result := public.super_admin_configuration_command(
    fixture.create_suit_request_id, fixture.create_suit_correlation_id,
    'suit', fixture.suit_id, 0, 'Register fixture Suit for security verification',
    jsonb_build_object(
      'stableKey', 'fixture-suit', 'displayName', '{"en":"Fixture Suit","ar":"بدلة اختبار"}'::jsonb,
      'description', '{"en":"Fixture"}'::jsonb, 'assetReference', 'brand://fixture-suit',
      'adapterContractVersion', '1.0', 'status', 'active'
    )
  );
  if (result->>'version')::bigint <> 1 or (result->>'replayed')::boolean then
    raise exception 'Suit create did not return version one';
  end if;
  result := public.super_admin_configuration_command(
    fixture.create_suit_request_id, fixture.create_suit_correlation_id,
    'suit', fixture.suit_id, 0, 'Register fixture Suit for security verification',
    jsonb_build_object(
      'stableKey', 'fixture-suit', 'displayName', '{"en":"Fixture Suit","ar":"بدلة اختبار"}'::jsonb,
      'description', '{"en":"Fixture"}'::jsonb, 'assetReference', 'brand://fixture-suit',
      'adapterContractVersion', '1.0', 'status', 'active'
    )
  );
  if not (result->>'replayed')::boolean then raise exception 'exact request was not replayed'; end if;

  begin
    perform public.super_admin_configuration_command(
      fixture.create_suit_request_id, fixture.create_suit_correlation_id,
      'suit', fixture.suit_id, 1, 'Attempt altered request identifier reuse',
      '{"displayName":{"en":"Altered"}}'::jsonb
    );
    raise exception 'altered request ID reuse was accepted';
  exception when unique_violation then null;
  end;

  result := public.super_admin_configuration_command(
    gen_random_uuid(), gen_random_uuid(), 'suit', fixture.suit_id, 1,
    'Update fixture Suit through optimistic version control',
    '{"displayName":{"en":"Fixture Suit v2","ar":"بدلة اختبار"}}'::jsonb
  );
  if (result->>'version')::bigint <> 2 then raise exception 'Suit version did not advance'; end if;
  begin
    perform public.super_admin_configuration_command(
      gen_random_uuid(), gen_random_uuid(), 'suit', fixture.suit_id, 1,
      'Reject stale optimistic configuration version',
      '{"displayName":{"en":"Stale"}}'::jsonb
    );
    raise exception 'stale configuration version accepted';
  exception when serialization_failure then null;
  end;

  perform public.super_admin_configuration_command(
    gen_random_uuid(), gen_random_uuid(), 'binding', fixture.binding_id, 0,
    'Bind fixture Suit to isolated staging adapter',
    jsonb_build_object(
      'suitId', fixture.suit_id, 'adminEnvironmentId', fixture.environment_id,
      'targetEnvironmentId', fixture.environment_id,
      'adapterBaseUrl', 'https://adapter.invalid/v1', 'audience', 'fixture-audience',
      'targetIdentityFingerprint', 'sha256:fixture-target-identity',
      'egressPolicy', '{"allowedHosts":["adapter.invalid"]}'::jsonb, 'status', 'inactive'
    )
  );
  begin
    perform public.super_admin_configuration_command(
      gen_random_uuid(), gen_random_uuid(), 'binding', fixture.binding_id, 1,
      'Reject activation before manifest and key verification', '{"status":"active"}'::jsonb
    );
    raise exception 'binding activated without verified manifest and key';
  exception when object_not_in_prerequisite_state then null;
  end;
  perform public.super_admin_configuration_command(
    gen_random_uuid(), gen_random_uuid(), 'adapter', fixture.adapter_id, 0,
    'Register versioned fixture adapter descriptor',
    jsonb_build_object(
      'bindingId', fixture.binding_id, 'adapterKey', 'fixture.adapter',
      'protocolMinVersion', '1.0', 'protocolMaxVersion', '1.1',
      'manifestSchemaVersion', '1.0', 'manifestMaxAgeSeconds', 300, 'status', 'inactive'
    )
  );
  perform public.super_admin_configuration_command(
    gen_random_uuid(), gen_random_uuid(), 'capability', fixture.capability_id, 0,
    'Allow exact fixture adapter capability scopes',
    jsonb_build_object(
      'adapterRegistrationId', fixture.adapter_id, 'capabilityKey', 'fixture.records',
      'minVersion', '1.0', 'maxVersion', '1.2', 'queryScopes', jsonb_build_array('records.read'),
      'commandScopes', jsonb_build_array('records.update'), 'enabled', true
    )
  );
  perform public.super_admin_configuration_command(
    gen_random_uuid(), gen_random_uuid(), 'navigation', fixture.navigation_id, 0,
    'Register capability-filtered fixture navigation',
    jsonb_build_object(
      'suitId', fixture.suit_id, 'stableKey', 'fixture-records',
      'label', '{"en":"Records","ar":"السجلات"}'::jsonb, 'moduleKind', 'records.list',
      'routeDescriptor', '{"route":"/records"}'::jsonb,
      'requiredCapabilityKey', 'fixture.records', 'requiredCapabilityVersion', '1.0',
      'sortOrder', 10, 'enabled', true
    )
  );
  perform public.super_admin_configuration_command(
    gen_random_uuid(), gen_random_uuid(), 'provider', fixture.provider_id, 0,
    'Register fixture provider descriptor without values',
    jsonb_build_object(
      'stableKey', 'fixture-provider', 'displayName', '{"en":"Fixture Provider"}'::jsonb,
      'providerKind', 'payment.manual', 'configurationSchemaVersion', '1.0', 'status', 'active'
    )
  );
  begin
    perform public.super_admin_configuration_command(
      gen_random_uuid(), gen_random_uuid(), 'setting', gen_random_uuid(), 0,
      'Reject a secret-classified value from public settings',
      jsonb_build_object(
        'providerId', fixture.provider_id, 'bindingId', fixture.binding_id,
        'settingKey', 'provider.api-key', 'valueType', 'string', 'value', '"not-a-real-secret"'::jsonb,
        'schemaVersion', '1.0', 'effectiveFrom', now(), 'status', 'inactive'
      )
    );
    raise exception 'secret-classified public setting was accepted';
  exception when check_violation then null;
  end;
  perform public.super_admin_configuration_command(
    gen_random_uuid(), gen_random_uuid(), 'setting', fixture.setting_id, 0,
    'Store non-secret provider instructions as versioned data',
    jsonb_build_object(
      'providerId', fixture.provider_id, 'bindingId', fixture.binding_id,
      'settingKey', 'payment.instructions', 'valueType', 'instruction',
      'value', '{"en":"Fixture instructions"}'::jsonb, 'schemaVersion', '1.0',
      'effectiveFrom', now(), 'status', 'active'
    )
  );
  perform public.super_admin_configuration_command(
    gen_random_uuid(), gen_random_uuid(), 'secret_reference', fixture.secret_reference_id, 0,
    'Register Vault reference without exposing secret material',
    jsonb_build_object(
      'providerId', fixture.provider_id, 'bindingId', fixture.binding_id,
      'purpose', 'adapter.hmac', 'keyId', 'fixture-key', 'keyVersion', 1,
      'vaultSecretId', fixture.vault_secret_id, 'validFrom', now(), 'status', 'inactive'
    )
  );

  if jsonb_array_length(public.super_admin_configuration_read('suits')) <> 1
    or jsonb_array_length(public.super_admin_configuration_read('navigation')) <> 1
    or jsonb_array_length(public.super_admin_configuration_read('capabilities')) <> 1 then
    raise exception 'data-driven Suit/capability/navigation projection incomplete';
  end if;
  if public.super_admin_configuration_read('audit')::text like '%' || fixture.vault_secret_id::text || '%'
    or public.super_admin_configuration_read('audit')::text ilike '%vault_secret_id%' then
    raise exception 'Vault reference leaked through public audit projection';
  end if;
  begin
    perform public.super_admin_configuration_read('secret_references');
    raise exception 'secret reference public projection exists';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
reset role;
select pass('enabled platform owner receives versioned, audited configuration commands without secret exposure');

-- Owner browser role still cannot select the reference or mutate history directly.
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from sas_config_fixture;
set local role authenticated;
do $$
begin
  begin
    perform * from public.integration_secret_references;
    raise exception 'owner browser selected Vault references';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.control_plane_events set reason = 'tampered';
    raise exception 'owner browser edited audit';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select pass('owner browser cannot read Vault references or mutate audit history');

-- Even database-internal callers cannot rewrite or remove immutable evidence.
do $$
begin
  begin
    update public.control_plane_events set reason = reason;
    raise exception 'audit update succeeded';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    delete from public.configuration_revisions;
    raise exception 'configuration history delete succeeded';
  exception when object_not_in_prerequisite_state then null;
  end;
  if exists (
    select 1 from public.configuration_revisions revision
    join sas_config_fixture fixture on revision.resource_id = fixture.secret_reference_id
    where revision.before_state::text ilike '%vault_secret_id%'
      or revision.after_state::text ilike '%vault_secret_id%'
      or revision.before_state::text like '%' || fixture.vault_secret_id::text || '%'
      or revision.after_state::text like '%' || fixture.vault_secret_id::text || '%'
  ) then
    raise exception 'Vault reference leaked into revision evidence';
  end if;
end;
$$;

select pass('configuration revisions and control-plane audit remain immutable and secret-safe');
select * from finish();

rollback;
