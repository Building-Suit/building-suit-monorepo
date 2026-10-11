-- SS-SA-BRIDGE-001: target-owned, environment-bound Super Admin bridge.
-- HMAC key bytes stay in the Edge Function secret boundary. This migration
-- stores only non-secret principal metadata, nonce receipts and target audit.

create table public.shop_super_admin_integrations (
  id uuid primary key default gen_random_uuid(),
  source_binding_id uuid not null,
  target_binding_id uuid not null,
  target_environment_id uuid not null,
  audience text not null check (length(btrim(audience)) between 1 and 240),
  key_id text not null check (length(btrim(key_id)) between 1 and 120),
  protocol_version text not null default '1.0' check (protocol_version = '1.0'),
  allowed_operations text[] not null,
  max_clock_skew_seconds integer not null check (max_clock_skew_seconds between 1 and 900),
  nonce_retention_seconds integer not null check (nonce_retention_seconds between 60 and 604800),
  valid_from timestamptz not null,
  valid_until timestamptz,
  enabled boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  retired_at timestamptz,
  unique (key_id),
  unique (source_binding_id, target_binding_id, target_environment_id, audience, key_id),
  check (valid_until is null or valid_until > valid_from),
  check (retired_at is null or not enabled),
  check (cardinality(allowed_operations) > 0),
  check (allowed_operations <@ array[
    'adapter.capabilities.read',
    'shop.platform.query', 'shop.platform.command',
    'shop.billing.query', 'shop.billing.command',
    'shop.plan.query', 'shop.plan.command'
  ]::text[])
);

create table public.shop_super_admin_nonce_receipts (
  id uuid primary key default gen_random_uuid(),
  integration_principal_id uuid not null
    references public.shop_super_admin_integrations (id) on delete restrict,
  key_id text not null,
  nonce uuid not null,
  request_id uuid not null,
  request_timestamp bigint not null,
  body_digest text not null check (body_digest ~ '^[0-9a-f]{64}$'),
  received_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  unique (integration_principal_id, key_id, nonce)
);

create table public.shop_super_admin_requests (
  id uuid primary key default gen_random_uuid(),
  integration_principal_id uuid not null
    references public.shop_super_admin_integrations (id) on delete restrict,
  request_id uuid not null,
  correlation_id uuid not null,
  operation text not null,
  operation_version text not null check (operation_version = '1.0'),
  is_command boolean not null,
  target_resource_id uuid,
  body_digest text not null check (body_digest ~ '^[0-9a-f]{64}$'),
  reason text,
  external_authority_binding_id uuid not null,
  external_subject_id uuid not null,
  external_role_snapshot text not null check (length(external_role_snapshot) between 1 and 160),
  external_session_id text check (external_session_id is null or length(external_session_id) <= 200),
  underlying_audit_id uuid,
  result jsonb,
  result_digest text not null check (result_digest ~ '^[0-9a-f]{32}$'),
  result_version integer not null default 1 check (result_version = 1),
  occurred_at timestamptz not null default clock_timestamp(),
  check ((is_command and reason is not null and result is not null)
    or (not is_command and reason is null and result is null))
);

create unique index shop_super_admin_command_request_once
  on public.shop_super_admin_requests (integration_principal_id, request_id)
  where is_command;
create index shop_super_admin_requests_correlation
  on public.shop_super_admin_requests (correlation_id, occurred_at desc);
create index shop_super_admin_nonce_expiry
  on public.shop_super_admin_nonce_receipts (expires_at);

alter table public.shop_super_admin_integrations enable row level security;
alter table public.shop_super_admin_nonce_receipts enable row level security;
alter table public.shop_super_admin_requests enable row level security;
revoke all on public.shop_super_admin_integrations,
  public.shop_super_admin_nonce_receipts, public.shop_super_admin_requests
from public, anon, authenticated;
grant all on public.shop_super_admin_integrations,
  public.shop_super_admin_nonce_receipts, public.shop_super_admin_requests
to service_role;

create function shop_private.preserve_super_admin_bridge_evidence()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'SHOP_SUPER_ADMIN_EVIDENCE_IMMUTABLE' using errcode = '55000';
end;
$$;

create trigger shop_super_admin_integrations_no_delete
before delete or truncate on public.shop_super_admin_integrations
for each statement execute function shop_private.preserve_super_admin_bridge_evidence();
create trigger shop_super_admin_nonce_receipts_immutable
before update or delete or truncate on public.shop_super_admin_nonce_receipts
for each statement execute function shop_private.preserve_super_admin_bridge_evidence();
create trigger shop_super_admin_requests_immutable
before update or delete or truncate on public.shop_super_admin_requests
for each statement execute function shop_private.preserve_super_admin_bridge_evidence();

-- Existing commands remain the domain authority. Their Shop-operator actor
-- columns are nullable only for a bridge invocation; the protected bridge
-- audit above carries the signed external actor and integration principal.
alter table public.platform_admin_events alter column actor_user_id drop not null;
alter table public.platform_billing_events alter column actor_user_id drop not null;
alter table public.platform_plan_events alter column actor_user_id drop not null;
alter table public.subscription_price_overrides alter column created_by_user_id drop not null;
alter table public.subscription_price_override_revocations alter column created_by_user_id drop not null;
alter table public.subscription_plan_change_requests alter column created_by_user_id drop not null;

create or replace function shop_private.platform_admin_role()
returns text language sql stable security definer set search_path = '' as $$
  select case
    when auth.role() = 'service_role'
      and nullif(current_setting('shop.super_admin_bridge_principal_id', true), '') is not null
      then 'operator'::text
    else (
      select admin.role from public.platform_admins admin
      where admin.user_id = auth.uid() and admin.enabled
        and auth.role() = 'authenticated'
    )
  end;
$$;

-- Preserve the latest six-resource plan trigger and admit the same trusted
-- bridge context used by the existing plan/billing commands.
create or replace function shop_private.subscription_catalog_terms()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_shop_id uuid; v_limits jsonb; v_limit integer; v_usage bigint; v_resource text;
  v_operator_approval boolean := false;
begin
  if tg_op = 'INSERT' and auth.uid() is not null and not exists (
    select 1 from public.plans plan
    where plan.id = new.plan_id and plan.is_active and not plan.is_coming_soon
      and ((plan.is_public and plan.is_purchasable)
        or (plan.slug = 'full-product-trial' and new.status = 'trialing'))
  ) then raise exception 'PLAN_UNAVAILABLE' using errcode = '22023'; end if;
  if tg_op = 'UPDATE' then
    v_operator_approval := current_setting('shop.billing_approval', true) = 'approved'
      and (
        exists (select 1 from public.platform_admins administrator
          where administrator.user_id = auth.uid() and administrator.enabled
            and administrator.role = 'operator')
        or (auth.role() = 'service_role'
          and nullif(current_setting('shop.super_admin_bridge_principal_id', true), '') is not null)
      );
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
    select terms.resource_limits into v_limits from public.plan_catalog_terms terms
    where terms.id = new.catalog_terms_id and terms.plan_id = new.plan_id;
  end if;
  if tg_op = 'UPDATE' and old.catalog_terms_id is not null
    and new.catalog_terms_id is distinct from old.catalog_terms_id
    and new.plan_id = old.plan_id and not v_operator_approval then
    raise exception 'SUBSCRIPTION_TERMS_CHANGE_REQUIRES_PLAN_CHANGE' using errcode = '23514';
  end if;
  select membership.shop_id into v_shop_id from public.shop_memberships membership
  where membership.profile_id = new.profile_id and membership.role = 'owner'
  order by (membership.status = 'active') desc, membership.created_at, membership.id limit 1;
  if v_shop_id is not null and (tg_op = 'INSERT'
    or new.plan_id is distinct from old.plan_id
    or new.catalog_terms_id is distinct from old.catalog_terms_id) then
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

create function public.shop_super_admin_bridge_principal(
  p_key_id text, p_source_binding_id uuid, p_target_binding_id uuid,
  p_target_environment_id uuid, p_audience text
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_principal public.shop_super_admin_integrations;
begin
  if auth.role() <> 'service_role' then
    raise exception 'SHOP_SUPER_ADMIN_BRIDGE_REQUIRED' using errcode = '42501';
  end if;
  select * into v_principal from public.shop_super_admin_integrations principal
  where principal.key_id = p_key_id
    and principal.source_binding_id = p_source_binding_id
    and principal.target_binding_id = p_target_binding_id
    and principal.target_environment_id = p_target_environment_id
    and principal.audience = p_audience and principal.enabled
    and principal.retired_at is null and principal.valid_from <= clock_timestamp()
    and (principal.valid_until is null or principal.valid_until > clock_timestamp());
  if not found then raise exception 'SHOP_SUPER_ADMIN_AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  return jsonb_build_object(
    'principalId', v_principal.id,
    'protocolVersion', v_principal.protocol_version,
    'maxClockSkewSeconds', v_principal.max_clock_skew_seconds,
    'nonceRetentionSeconds', v_principal.nonce_retention_seconds
  );
end;
$$;

create function public.shop_super_admin_bridge_accept_nonce(
  p_principal_id uuid, p_key_id text, p_nonce uuid, p_request_id uuid,
  p_request_timestamp bigint, p_body_digest text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_principal public.shop_super_admin_integrations; v_receipt_id uuid;
begin
  if auth.role() <> 'service_role' or p_body_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'SHOP_SUPER_ADMIN_BRIDGE_REQUIRED' using errcode = '42501';
  end if;
  select * into v_principal from public.shop_super_admin_integrations principal
  where principal.id = p_principal_id and principal.key_id = p_key_id
    and principal.enabled and principal.retired_at is null
    and principal.valid_from <= to_timestamp(p_request_timestamp)
    and (principal.valid_until is null or principal.valid_until > to_timestamp(p_request_timestamp))
  for update;
  if not found or abs(extract(epoch from clock_timestamp())::bigint - p_request_timestamp)
      > v_principal.max_clock_skew_seconds then
    raise exception 'SHOP_SUPER_ADMIN_TIMESTAMP_INVALID' using errcode = '42501';
  end if;
  begin
    insert into public.shop_super_admin_nonce_receipts (
      integration_principal_id, key_id, nonce, request_id, request_timestamp,
      body_digest, expires_at
    ) values (
      v_principal.id, p_key_id, p_nonce, p_request_id, p_request_timestamp,
      p_body_digest, clock_timestamp() + make_interval(secs => v_principal.nonce_retention_seconds)
    ) returning id into v_receipt_id;
  exception when unique_violation then
    raise exception 'SHOP_SUPER_ADMIN_REPLAY_DENIED' using errcode = '23505';
  end;
  return jsonb_build_object('receiptId', v_receipt_id);
end;
$$;

create function shop_private.bridge_internal_request_id(
  p_principal_id uuid, p_request_id uuid, p_operation text
) returns uuid language sql immutable set search_path = '' as $$
  select (substring(value, 1, 8) || '-' || substring(value, 9, 4) || '-4' ||
    substring(value, 14, 3) || '-a' || substring(value, 18, 3) || '-' ||
    substring(value, 21, 12))::uuid
  from (select md5(p_principal_id::text || ':' || p_request_id::text || ':' || p_operation) value) digest;
$$;

create function shop_private.bridge_manifest(p_principal_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with manifest as (
    select jsonb_build_object(
      'adapterId', 'shop-suit-super-admin-bridge', 'suit', 'shop-suit',
      'targetBindingId', principal.target_binding_id,
      'targetEnvironmentId', principal.target_environment_id,
      'audience', principal.audience, 'health', 'ready',
      'manifestSchemaVersion', '1.0', 'protocolVersions', jsonb_build_array('1.0'),
      'manifestRevision', 'ss-sa-bridge-001-v1', 'issuedAt', clock_timestamp(),
      'capabilities', coalesce(jsonb_agg(jsonb_build_object(
        'operation', operation, 'version', '1.0',
        'kind', case when operation like '%.command' then 'command' else 'query' end,
        'idempotency', case when operation like '%.command' then 'exact-request-id' else 'nonce-only' end,
        'members', case operation
          when 'adapter.capabilities.read' then jsonb_build_array('manifest')
          when 'shop.platform.query' then to_jsonb(array['dashboard','shops','shop','audit'])
          when 'shop.platform.command' then to_jsonb(array['suspend_shop','reactivate_shop','add_support_note'])
          when 'shop.billing.query' then to_jsonb(array['queue','configuration','summary','audit'])
          when 'shop.billing.command' then to_jsonb(array['configure_instructions','mark_under_review','approve','reject','set_price_override'])
          when 'shop.plan.query' then to_jsonb(array['catalog','shop','audit'])
          when 'shop.plan.command' then to_jsonb(array['publish_terms','set_availability','change_subscription',
            'renew_subscription','suspend_subscription','set_price_override','remove_price_override'])
        end
      ) order by operation), '[]'::jsonb)
    ) value
    from public.shop_super_admin_integrations principal,
      unnest(principal.allowed_operations) operation
    where principal.id = p_principal_id
    group by principal.id
  )
  select value || jsonb_build_object('manifestDigest',
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(value::text, 'UTF8'), 'sha256'), 'hex'))
  from manifest;
$$;

create function public.shop_super_admin_bridge_invoke(
  p_principal_id uuid, p_nonce uuid, p_body_digest text, p_envelope jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_principal public.shop_super_admin_integrations; v_receipt public.shop_super_admin_nonce_receipts;
  v_prior public.shop_super_admin_requests; v_payload jsonb; v_actor jsonb;
  v_operation text; v_request_id uuid; v_correlation_id uuid; v_reason text;
  v_internal_request_id uuid; v_result jsonb; v_audit_id uuid; v_target_id uuid;
  v_is_command boolean; v_request_audit_id uuid;
begin
  if auth.role() <> 'service_role' or jsonb_typeof(p_envelope) <> 'object'
    or p_body_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'SHOP_SUPER_ADMIN_BRIDGE_REQUIRED' using errcode = '42501';
  end if;
  select * into v_principal from public.shop_super_admin_integrations principal
  where principal.id = p_principal_id and principal.enabled
    and principal.retired_at is null and principal.valid_from <= clock_timestamp()
    and (principal.valid_until is null or principal.valid_until > clock_timestamp())
  for update;
  if not found then raise exception 'SHOP_SUPER_ADMIN_AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select * into v_receipt from public.shop_super_admin_nonce_receipts receipt
  where receipt.integration_principal_id = p_principal_id and receipt.nonce = p_nonce
    and receipt.body_digest = p_body_digest and receipt.expires_at > clock_timestamp();
  if not found then raise exception 'SHOP_SUPER_ADMIN_NONCE_REQUIRED' using errcode = '42501'; end if;

  if (p_envelope - array['protocolVersion','operation','operationVersion','requestId',
      'correlationId','sourceBindingId','targetBindingId','targetEnvironmentId',
      'actor','reason','payload']) <> '{}'::jsonb
    or p_envelope ->> 'protocolVersion' <> v_principal.protocol_version
    or p_envelope ->> 'operationVersion' <> '1.0'
    or (p_envelope ->> 'sourceBindingId')::uuid <> v_principal.source_binding_id
    or (p_envelope ->> 'targetBindingId')::uuid <> v_principal.target_binding_id
    or (p_envelope ->> 'targetEnvironmentId')::uuid <> v_principal.target_environment_id then
    raise exception 'SHOP_SUPER_ADMIN_BINDING_MISMATCH' using errcode = '42501';
  end if;
  v_operation := p_envelope ->> 'operation';
  if not (v_operation = any(v_principal.allowed_operations)) then
    raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_DENIED' using errcode = '42501';
  end if;
  v_request_id := (p_envelope ->> 'requestId')::uuid;
  v_correlation_id := (p_envelope ->> 'correlationId')::uuid;
  if v_receipt.request_id <> v_request_id then
    raise exception 'SHOP_SUPER_ADMIN_BINDING_MISMATCH' using errcode = '42501';
  end if;
  v_payload := p_envelope -> 'payload'; v_actor := p_envelope -> 'actor';
  v_reason := nullif(btrim(p_envelope ->> 'reason'), '');
  v_is_command := v_operation like '%.command';
  if jsonb_typeof(v_payload) <> 'object'
    or jsonb_typeof(v_actor) <> 'object'
    or (v_actor - array['authorityBindingId','subjectId','roleSnapshot','sessionId']) <> '{}'::jsonb
    or (v_is_command and (v_reason is null or length(v_reason) not between 2 and 1000))
    or (not v_is_command and v_reason is not null) then
    raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023';
  end if;

  if v_is_command then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_principal_id::text || ':' || v_request_id::text, 0));
    select * into v_prior from public.shop_super_admin_requests request
    where request.integration_principal_id = p_principal_id
      and request.request_id = v_request_id and request.is_command;
    if found then
      if v_prior.operation <> v_operation or v_prior.operation_version <> p_envelope ->> 'operationVersion'
        or v_prior.body_digest <> p_body_digest or v_prior.reason <> v_reason then
        raise exception 'SHOP_SUPER_ADMIN_IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
      end if;
      return jsonb_build_object('data', v_prior.result, 'replayed', true,
        'targetAuditId', v_prior.id, 'targetResultVersion', v_prior.result_version);
    end if;
  end if;

  perform set_config('shop.super_admin_bridge_principal_id', p_principal_id::text, true);
  v_internal_request_id := shop_private.bridge_internal_request_id(p_principal_id, v_request_id, v_operation);

  if v_operation = 'adapter.capabilities.read' then
    if v_payload <> '{}'::jsonb then raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023'; end if;
    v_result := shop_private.bridge_manifest(p_principal_id);
  elsif v_operation = 'shop.platform.query' then
    if (v_payload - array['resource','shopId','search','status','page','pageSize']) <> '{}'::jsonb then
      raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023'; end if;
    if v_payload ->> 'resource' not in ('dashboard','shops','shop','audit') then
      raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023'; end if;
    v_target_id := nullif(v_payload ->> 'shopId', '')::uuid;
    v_result := public.platform_admin_read(v_payload ->> 'resource', v_target_id,
      v_payload ->> 'search', v_payload ->> 'status',
      coalesce((v_payload ->> 'page')::integer, 1), coalesce((v_payload ->> 'pageSize')::integer, 25));
  elsif v_operation = 'shop.platform.command' then
    if (v_payload - array['shopId','action','payload']) <> '{}'::jsonb then
      raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023'; end if;
    if v_payload ->> 'action' not in ('suspend_shop','reactivate_shop','add_support_note') then
      raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023'; end if;
    v_target_id := (v_payload ->> 'shopId')::uuid;
    v_result := public.platform_admin_command(v_internal_request_id, v_target_id,
      v_payload ->> 'action', v_reason, coalesce(v_payload -> 'payload', '{}'::jsonb));
  elsif v_operation = 'shop.billing.query' then
    if (v_payload - array['resource','status','page','pageSize']) <> '{}'::jsonb then
      raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023'; end if;
    if v_payload ->> 'resource' not in ('queue','configuration','summary','audit') then
      raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023'; end if;
    v_result := public.platform_admin_billing_read(v_payload ->> 'resource',
      v_payload ->> 'status', coalesce((v_payload ->> 'page')::integer, 1),
      coalesce((v_payload ->> 'pageSize')::integer, 25));
  elsif v_operation = 'shop.billing.command' then
    if (v_payload - array['action','submissionId','payload']) <> '{}'::jsonb then
      raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023'; end if;
    if v_payload ->> 'action' not in ('configure_instructions','mark_under_review',
      'approve','reject','set_price_override') then
      raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023'; end if;
    v_target_id := nullif(v_payload ->> 'submissionId', '')::uuid;
    v_result := public.platform_admin_billing_command(v_internal_request_id,
      v_payload ->> 'action', v_target_id, v_reason, coalesce(v_payload -> 'payload', '{}'::jsonb));
  elsif v_operation = 'shop.plan.query' then
    if (v_payload - array['resource','shopId','page','pageSize']) <> '{}'::jsonb then
      raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023'; end if;
    if v_payload ->> 'resource' not in ('catalog','shop','audit') then
      raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023'; end if;
    v_target_id := nullif(v_payload ->> 'shopId', '')::uuid;
    v_result := public.platform_plan_read(v_payload ->> 'resource', v_target_id,
      coalesce((v_payload ->> 'page')::integer, 1), coalesce((v_payload ->> 'pageSize')::integer, 50));
  elsif v_operation = 'shop.plan.command' then
    if (v_payload - array['action','planId','shopId','payload']) <> '{}'::jsonb then
      raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023'; end if;
    if v_payload ->> 'action' not in ('publish_terms','set_availability','change_subscription',
      'renew_subscription','suspend_subscription','set_price_override','remove_price_override') then
      raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023'; end if;
    v_target_id := coalesce(nullif(v_payload ->> 'shopId', '')::uuid,
      nullif(v_payload ->> 'planId', '')::uuid);
    v_result := public.platform_plan_command(v_internal_request_id, v_payload ->> 'action',
      v_reason, nullif(v_payload ->> 'planId', '')::uuid, v_target_id,
      coalesce(v_payload -> 'payload', '{}'::jsonb));
  else
    raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023';
  end if;

  v_audit_id := nullif(v_result ->> 'auditId', '')::uuid;
  insert into public.shop_super_admin_requests (
    integration_principal_id, request_id, correlation_id, operation,
    operation_version, is_command, target_resource_id, body_digest, reason,
    external_authority_binding_id, external_subject_id, external_role_snapshot,
    external_session_id, underlying_audit_id, result, result_digest
  ) values (
    p_principal_id, v_request_id, v_correlation_id, v_operation,
    p_envelope ->> 'operationVersion', v_is_command, v_target_id, p_body_digest, v_reason,
    (v_actor ->> 'authorityBindingId')::uuid, (v_actor ->> 'subjectId')::uuid,
    v_actor ->> 'roleSnapshot', nullif(v_actor ->> 'sessionId', ''), v_audit_id,
    case when v_is_command then v_result -> 'data' else null end,
    md5(coalesce(v_result::text, 'null'))
  ) returning id into v_request_audit_id;
  return jsonb_build_object('data', case when v_is_command then v_result -> 'data' else v_result end,
    'replayed', false, 'targetAuditId', v_request_audit_id, 'targetResultVersion', 1);
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023';
end;
$$;

revoke all on function shop_private.preserve_super_admin_bridge_evidence(),
  shop_private.bridge_internal_request_id(uuid, uuid, text),
  shop_private.bridge_manifest(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.shop_super_admin_bridge_principal(text, uuid, uuid, uuid, text),
  public.shop_super_admin_bridge_accept_nonce(uuid, text, uuid, uuid, bigint, text),
  public.shop_super_admin_bridge_invoke(uuid, uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.shop_super_admin_bridge_principal(text, uuid, uuid, uuid, text),
  public.shop_super_admin_bridge_accept_nonce(uuid, text, uuid, uuid, bigint, text),
  public.shop_super_admin_bridge_invoke(uuid, uuid, text, jsonb)
to service_role;

notify pgrst, 'reload schema';
