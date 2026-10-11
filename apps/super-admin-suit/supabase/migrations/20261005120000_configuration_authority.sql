-- SAS-M1-CONFIG-001: database-owned Super Admin configuration authority.
-- This migration intentionally contains no environment binding, project ref,
-- endpoint, owner identity, credential, provider, price, quota, or navigation data.

create schema super_admin_private;
revoke all on schema super_admin_private from public, anon, authenticated;
grant usage on schema super_admin_private to service_role;

create table public.admin_environments (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique check (stable_key ~ '^[a-z][a-z0-9-]{1,62}$'),
  environment_kind text not null check (environment_kind in ('local', 'staging', 'production')),
  display_name jsonb not null check (jsonb_typeof(display_name) = 'object'),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'retired')),
  binding_fingerprint text,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (binding_fingerprint is null or length(binding_fingerprint) between 16 and 512)
);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete restrict,
  authority_environment_id uuid not null references public.admin_environments (id) on delete restrict,
  role text not null default 'owner' check (role = 'owner'),
  enabled boolean not null default true,
  provisioned_by uuid not null references auth.users (id) on delete restrict,
  provisioned_at timestamptz not null default clock_timestamp(),
  disabled_at timestamptz,
  check ((enabled and disabled_at is null) or (not enabled and disabled_at is not null))
);

create table public.suit_registry (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique check (stable_key ~ '^[a-z][a-z0-9-]{1,62}$'),
  display_name jsonb not null check (jsonb_typeof(display_name) = 'object'),
  description jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  asset_reference text not null check (length(btrim(asset_reference)) between 1 and 512),
  adapter_contract_version text not null check (adapter_contract_version ~ '^[0-9]+\.[0-9]+$'),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.suit_environment_bindings (
  id uuid primary key default gen_random_uuid(),
  suit_id uuid not null references public.suit_registry (id) on delete restrict,
  admin_environment_id uuid not null references public.admin_environments (id) on delete restrict,
  target_environment_id uuid not null references public.admin_environments (id) on delete restrict,
  adapter_base_url text not null check (
    adapter_base_url ~ '^https://[^/?#]+(?:/[^?#]*)?$' and adapter_base_url !~ '@'
  ),
  audience text not null check (length(btrim(audience)) between 1 and 512),
  target_identity_fingerprint text not null check (length(btrim(target_identity_fingerprint)) between 16 and 512),
  egress_policy jsonb not null check (jsonb_typeof(egress_policy) = 'object'),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'disabled', 'retired')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (suit_id, admin_environment_id, target_environment_id)
);

create table public.adapter_registrations (
  id uuid primary key default gen_random_uuid(),
  binding_id uuid not null unique references public.suit_environment_bindings (id) on delete restrict,
  adapter_key text not null check (adapter_key ~ '^[a-z][a-z0-9.-]{1,127}$'),
  protocol_min_version text not null check (protocol_min_version ~ '^[0-9]+\.[0-9]+$'),
  protocol_max_version text not null check (protocol_max_version ~ '^[0-9]+\.[0-9]+$'),
  manifest_schema_version text not null check (manifest_schema_version ~ '^[0-9]+\.[0-9]+$'),
  manifest_max_age_seconds integer not null check (manifest_max_age_seconds between 30 and 86400),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'disabled', 'retired')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.adapter_capability_policy (
  id uuid primary key default gen_random_uuid(),
  adapter_registration_id uuid not null references public.adapter_registrations (id) on delete restrict,
  capability_key text not null check (capability_key ~ '^[a-z][a-z0-9.-]{1,127}$'),
  min_version text not null check (min_version ~ '^[0-9]+\.[0-9]+$'),
  max_version text not null check (max_version ~ '^[0-9]+\.[0-9]+$'),
  query_scopes text[] not null default '{}'::text[],
  command_scopes text[] not null default '{}'::text[],
  enabled boolean not null default false,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (adapter_registration_id, capability_key),
  check (not ('*' = any(query_scopes)) and not ('*' = any(command_scopes))),
  check (array_position(query_scopes, '') is null and array_position(command_scopes, '') is null)
);

create table public.navigation_items (
  id uuid primary key default gen_random_uuid(),
  suit_id uuid not null references public.suit_registry (id) on delete restrict,
  stable_key text not null check (stable_key ~ '^[a-z][a-z0-9-]{1,62}$'),
  label jsonb not null check (jsonb_typeof(label) = 'object'),
  description jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  module_kind text not null check (module_kind ~ '^[a-z][a-z0-9.-]{1,127}$'),
  route_descriptor jsonb not null check (jsonb_typeof(route_descriptor) = 'object'),
  required_capability_key text check (required_capability_key is null or required_capability_key ~ '^[a-z][a-z0-9.-]{1,127}$'),
  required_capability_version text check (required_capability_version is null or required_capability_version ~ '^[0-9]+\.[0-9]+$'),
  visibility_policy jsonb not null default '{}'::jsonb check (jsonb_typeof(visibility_policy) = 'object'),
  sort_order integer not null default 0,
  enabled boolean not null default false,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (suit_id, stable_key),
  check ((required_capability_key is null) = (required_capability_version is null)),
  check (not (route_descriptor ?| array['component', 'module', 'javascript', 'expression']))
);

create table public.integration_providers (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique check (stable_key ~ '^[a-z][a-z0-9-]{1,62}$'),
  display_name jsonb not null check (jsonb_typeof(display_name) = 'object'),
  provider_kind text not null check (provider_kind ~ '^[a-z][a-z0-9.-]{1,127}$'),
  configuration_schema_version text not null check (configuration_schema_version ~ '^[0-9]+\.[0-9]+$'),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'retired')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.integration_providers (id) on delete restrict,
  binding_id uuid references public.suit_environment_bindings (id) on delete restrict,
  setting_key text not null check (setting_key ~ '^[a-z][a-z0-9.-]{1,127}$'),
  value_type text not null check (value_type in ('string', 'number', 'boolean', 'object', 'array', 'instruction', 'commercial')),
  non_secret_value jsonb not null,
  schema_version text not null check (schema_version ~ '^[0-9]+\.[0-9]+$'),
  effective_from timestamptz not null,
  effective_until timestamptz,
  status text not null default 'inactive' check (status in ('inactive', 'active', 'retired')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique nulls not distinct (provider_id, binding_id, setting_key),
  check (effective_until is null or effective_until > effective_from),
  check (setting_key !~* '(secret|password|token|private[-_.]?key|service[-_.]?role|credential|api[-_.]?key)'),
  check (non_secret_value::text !~* '(sb_secret_|service[_-]?role)')
);

create table public.integration_secret_references (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.integration_providers (id) on delete restrict,
  binding_id uuid not null references public.suit_environment_bindings (id) on delete restrict,
  purpose text not null check (purpose ~ '^[a-z][a-z0-9.-]{1,127}$'),
  key_id text not null check (length(btrim(key_id)) between 1 and 160),
  key_version integer not null check (key_version > 0),
  vault_secret_id uuid not null,
  valid_from timestamptz not null,
  valid_until timestamptz,
  status text not null default 'inactive' check (status in ('inactive', 'active', 'revoked')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (binding_id, purpose, key_id, key_version),
  check (valid_until is null or valid_until > valid_from),
  check (status <> 'revoked' or valid_until is not null)
);

create table public.adapter_manifest_observations (
  id uuid primary key default gen_random_uuid(),
  binding_id uuid not null references public.suit_environment_bindings (id) on delete restrict,
  manifest_revision text not null,
  manifest_digest text not null check (manifest_digest ~ '^[0-9a-f]{64}$'),
  protocol_versions text[] not null,
  verified_capabilities jsonb not null check (jsonb_typeof(verified_capabilities) = 'array'),
  verification_outcome text not null check (verification_outcome in ('verified', 'rejected')),
  observed_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  check (expires_at > observed_at),
  unique (binding_id, manifest_revision, manifest_digest)
);

create table public.configuration_revisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  correlation_id uuid not null,
  resource_type text not null,
  resource_id uuid not null,
  resource_version bigint not null check (resource_version > 0),
  action text not null check (action in ('create', 'update', 'retire', 'revoke')),
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  actor_role text not null check (actor_role = 'owner'),
  authority_environment_id uuid not null references public.admin_environments (id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 8 and 1000),
  before_state jsonb,
  after_state jsonb,
  occurred_at timestamptz not null default clock_timestamp(),
  unique (resource_type, resource_id, resource_version),
  check (before_state is not null or after_state is not null)
);

create table public.control_plane_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  correlation_id uuid not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  actor_role text not null check (actor_role = 'owner'),
  authority_environment_id uuid not null references public.admin_environments (id) on delete restrict,
  suit_id uuid references public.suit_registry (id) on delete restrict,
  target_environment_id uuid references public.admin_environments (id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  reason text not null check (length(btrim(reason)) between 8 and 1000),
  safe_parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_parameters) = 'object'),
  before_state jsonb,
  after_state jsonb,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  request_fingerprint text not null,
  occurred_at timestamptz not null default clock_timestamp()
);

create index suit_bindings_environment_idx on public.suit_environment_bindings (admin_environment_id, status);
create index capability_policy_adapter_idx on public.adapter_capability_policy (adapter_registration_id, enabled);
create index navigation_suit_order_idx on public.navigation_items (suit_id, enabled, sort_order, id);
create index settings_binding_key_idx on public.integration_settings (binding_id, setting_key, status);
create index revisions_resource_idx on public.configuration_revisions (resource_type, resource_id, resource_version desc);
create index events_time_idx on public.control_plane_events (occurred_at desc, id desc);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'admin_environments', 'platform_admins', 'suit_registry', 'suit_environment_bindings',
    'adapter_registrations', 'adapter_capability_policy', 'navigation_items',
    'integration_providers', 'integration_settings', 'integration_secret_references',
    'adapter_manifest_observations', 'configuration_revisions', 'control_plane_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      table_name || '_service_role', table_name
    );
  end loop;
end;
$$;

revoke all on table public.admin_environments, public.platform_admins, public.suit_registry,
  public.suit_environment_bindings, public.adapter_registrations,
  public.adapter_capability_policy, public.navigation_items, public.integration_providers,
  public.integration_settings, public.integration_secret_references,
  public.adapter_manifest_observations, public.configuration_revisions,
  public.control_plane_events from public, anon, authenticated, service_role;
grant select on table public.admin_environments, public.platform_admins, public.suit_registry,
  public.suit_environment_bindings, public.adapter_registrations,
  public.adapter_capability_policy, public.navigation_items, public.integration_providers,
  public.integration_settings, public.integration_secret_references,
  public.adapter_manifest_observations, public.configuration_revisions,
  public.control_plane_events to service_role;
grant insert on table public.admin_environments to service_role;
grant insert, update on table public.platform_admins to service_role;
grant insert on table public.adapter_manifest_observations to service_role;

create function super_admin_private.current_platform_admin()
returns public.platform_admins
language sql stable security definer set search_path = '' as $$
  select administrator
  from public.platform_admins administrator
  where administrator.user_id = auth.uid()
    and administrator.enabled
    and auth.role() = 'authenticated';
$$;

create function super_admin_private.assert_platform_owner()
returns public.platform_admins
language plpgsql stable security definer set search_path = '' as $$
declare administrator public.platform_admins;
begin
  administrator := super_admin_private.current_platform_admin();
  if administrator.user_id is null or administrator.role <> 'owner' then
    raise exception 'PLATFORM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  return administrator;
end;
$$;

create function super_admin_private.reject_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '%_IMMUTABLE', upper(tg_table_name) using errcode = '55000';
end;
$$;

create trigger configuration_revisions_immutable
before update or delete or truncate on public.configuration_revisions
for each statement execute function super_admin_private.reject_mutation();
create trigger control_plane_events_immutable
before update or delete or truncate on public.control_plane_events
for each statement execute function super_admin_private.reject_mutation();
create trigger adapter_manifest_observations_immutable
before update or delete or truncate on public.adapter_manifest_observations
for each statement execute function super_admin_private.reject_mutation();

create function super_admin_private.assert_payload_keys(p_payload jsonb, p_allowed text[])
returns void language plpgsql immutable set search_path = '' as $$
declare unexpected text;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'CONFIG_PAYLOAD_OBJECT_REQUIRED' using errcode = '22023';
  end if;
  select key into unexpected from jsonb_object_keys(p_payload) key where not (key = any(p_allowed)) limit 1;
  if unexpected is not null then
    raise exception 'CONFIG_PAYLOAD_KEY_NOT_ALLOWED: %', unexpected using errcode = '22023';
  end if;
end;
$$;

create function super_admin_private.safe_snapshot(p_resource_type text, p_snapshot jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select case p_resource_type
    when 'secret_reference' then p_snapshot - 'vault_secret_id'
    when 'binding' then p_snapshot - 'adapter_base_url' - 'audience' - 'target_identity_fingerprint' - 'egress_policy'
    else p_snapshot
  end;
$$;

create function super_admin_private.assert_binding_activation(p_binding_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.adapter_registrations adapter
    join public.adapter_manifest_observations observation on observation.binding_id = adapter.binding_id
    where adapter.binding_id = p_binding_id
      and adapter.status = 'active'
      and observation.verification_outcome = 'verified'
      and observation.expires_at > clock_timestamp()
  ) or not exists (
    select 1 from public.integration_secret_references secret_reference
    where secret_reference.binding_id = p_binding_id
      and secret_reference.status = 'active'
      and secret_reference.valid_from <= clock_timestamp()
      and (secret_reference.valid_until is null or secret_reference.valid_until > clock_timestamp())
  ) then
    raise exception 'BINDING_ACTIVATION_PREREQUISITES_MISSING' using errcode = '55000';
  end if;
end;
$$;

create function super_admin_private.record_configuration_change(
  p_request_id uuid, p_correlation_id uuid, p_actor public.platform_admins,
  p_resource_type text, p_resource_id uuid, p_resource_version bigint, p_action text,
  p_reason text, p_safe_parameters jsonb, p_before jsonb, p_after jsonb,
  p_suit_id uuid, p_target_environment_id uuid, p_request_fingerprint text, p_result jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.configuration_revisions (
    request_id, correlation_id, resource_type, resource_id, resource_version, action,
    actor_user_id, actor_role, authority_environment_id, reason, before_state, after_state
  ) values (
    p_request_id, p_correlation_id, p_resource_type, p_resource_id, p_resource_version, p_action,
    p_actor.user_id, p_actor.role, p_actor.authority_environment_id, btrim(p_reason),
    super_admin_private.safe_snapshot(p_resource_type, p_before),
    super_admin_private.safe_snapshot(p_resource_type, p_after)
  );

  insert into public.control_plane_events (
    request_id, correlation_id, actor_user_id, actor_role, authority_environment_id,
    suit_id, target_environment_id, action, target_type, target_id, reason,
    safe_parameters, before_state, after_state, result, request_fingerprint
  ) values (
    p_request_id, p_correlation_id, p_actor.user_id, p_actor.role, p_actor.authority_environment_id,
    p_suit_id, p_target_environment_id, p_action, p_resource_type, p_resource_id, btrim(p_reason),
    p_safe_parameters, super_admin_private.safe_snapshot(p_resource_type, p_before),
    super_admin_private.safe_snapshot(p_resource_type, p_after), p_result, p_request_fingerprint
  );
end;
$$;

revoke all on all functions in schema super_admin_private from public, anon, authenticated, service_role;

create function public.super_admin_session()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare administrator public.platform_admins;
begin
  administrator := super_admin_private.assert_platform_owner();
  return jsonb_build_object(
    'userId', administrator.user_id,
    'role', administrator.role,
    'authorityEnvironmentId', administrator.authority_environment_id
  );
end;
$$;

create function public.super_admin_configuration_read(p_resource text, p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare answer jsonb;
begin
  perform super_admin_private.assert_platform_owner();
  case p_resource
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

create function public.super_admin_configuration_command(
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
      perform super_admin_private.assert_payload_keys(p_payload, array['stableKey','displayName','description','assetReference','adapterContractVersion','status']);
      select to_jsonb(row) into before_row from public.suit_registry row where row.id = p_resource_id for update;
      if p_expected_version = 0 then
        insert into public.suit_registry (id, stable_key, display_name, description, asset_reference, adapter_contract_version, status)
        values (p_resource_id, p_payload->>'stableKey', p_payload->'displayName', coalesce(p_payload->'description','{}'::jsonb),
          p_payload->>'assetReference', p_payload->>'adapterContractVersion', coalesce(p_payload->>'status','draft'))
        returning to_jsonb(suit_registry.*) into after_row; action_name := 'create';
      else
        if before_row is null or (before_row->>'version')::bigint <> p_expected_version then raise exception 'CONFIG_VERSION_CONFLICT' using errcode = '40001'; end if;
        update public.suit_registry set display_name = coalesce(p_payload->'displayName', display_name),
          description = coalesce(p_payload->'description', description), asset_reference = coalesce(p_payload->>'assetReference', asset_reference),
          adapter_contract_version = coalesce(p_payload->>'adapterContractVersion', adapter_contract_version),
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

revoke all on function public.super_admin_session(),
  public.super_admin_configuration_read(text, uuid),
  public.super_admin_configuration_command(uuid, uuid, text, uuid, bigint, text, jsonb)
from public, anon;
grant execute on function public.super_admin_session(),
  public.super_admin_configuration_read(text, uuid),
  public.super_admin_configuration_command(uuid, uuid, text, uuid, bigint, text, jsonb)
to authenticated;
