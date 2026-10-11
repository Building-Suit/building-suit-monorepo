-- Source-only SAS dependency: use the existing bridge and redemption authority.
-- Legacy UUID offers remain compatible; newly secured offers require a token.
create table public.shop_private_offer_security (
 offer_id uuid primary key references public.shop_private_offers(id) on delete restrict,
 token_digest text not null unique check (token_digest ~ '^[0-9a-f]{64}$'),
 entitlements jsonb not null check (jsonb_typeof(entitlements)='object' and octet_length(entitlements::text)<=4096),
 created_at timestamptz not null default clock_timestamp()
);
create table public.shop_private_offer_revocations (
 offer_id uuid primary key references public.shop_private_offer_security(offer_id) on delete restrict,
 integration_principal_id uuid not null references public.shop_super_admin_integrations(id),
 request_id uuid not null, reason text not null check(length(btrim(reason)) between 2 and 1000),
 created_at timestamptz not null default clock_timestamp(),
 unique(integration_principal_id,request_id)
);
alter table public.shop_private_offer_security enable row level security;
alter table public.shop_private_offer_revocations enable row level security;
revoke all on public.shop_private_offer_security,public.shop_private_offer_revocations from public,anon,authenticated,service_role;
create trigger shop_private_offer_security_immutable before update or delete or truncate on public.shop_private_offer_security
 for each statement execute function shop_private.reject_commercial_snapshot_mutation();
create trigger shop_private_offer_revocations_immutable before update or delete or truncate on public.shop_private_offer_revocations
 for each statement execute function shop_private.reject_commercial_snapshot_mutation();

create function shop_private.secure_offer_command(p_request uuid,p_action text,p_reason text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare offer public.shop_private_offers; principal public.shop_super_admin_integrations;
 token text; result jsonb;
begin
 if auth.role() is distinct from 'service_role' or nullif(current_setting('shop.super_admin_bridge_principal_id',true),'') is null then
  raise exception 'SHOP_SUPER_ADMIN_BRIDGE_REQUIRED' using errcode='42501'; end if;
 select * into principal from public.shop_super_admin_integrations
 where id=current_setting('shop.super_admin_bridge_principal_id',true)::uuid and enabled and retired_at is null
 and valid_from<=clock_timestamp() and (valid_until is null or valid_until>clock_timestamp());
 if principal.id is null then raise exception 'SHOP_SUPER_ADMIN_AUTHENTICATION_REQUIRED' using errcode='42501'; end if;
 if p_request is null or p_reason is null or length(btrim(p_reason)) not between 2 and 1000
 or jsonb_typeof(p_payload) is distinct from 'object' then
  raise exception 'SHOP_PRIVATE_OFFER_INVALID' using errcode='22023'; end if;
 if p_action='register_secure_private_offer' then
  if jsonb_typeof(p_payload->'entitlements') is distinct from 'object' or octet_length((p_payload->'entitlements')::text)>4096 then
   raise exception 'SHOP_PRIVATE_OFFER_INVALID' using errcode='22023'; end if;
  result:=shop_private.register_private_offer(p_request,p_reason,p_payload-'entitlements');
  token:=rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'=');
  insert into public.shop_private_offer_security(offer_id,token_digest,entitlements)
  values((p_payload->>'offerId')::uuid,encode(extensions.digest(token,'sha256'),'hex'),p_payload->'entitlements');
  -- Token exists only in protected adapter receipts and the authorized issuance response.
  return jsonb_build_object('data',(result->'data')||jsonb_build_object('redemptionToken',token,
   'targetBindingId',principal.target_binding_id,'targetEnvironmentId',principal.target_environment_id,
   'entitlements',p_payload->'entitlements','state','issued'));
 elsif p_action='revoke_secure_private_offer' then
  if not(p_payload ?& array['offerId','offerVersion','targetBindingId','targetEnvironmentId'])
  or (p_payload-array['offerId','offerVersion','targetBindingId','targetEnvironmentId'])<>'{}'::jsonb then
   raise exception 'SHOP_PRIVATE_OFFER_INVALID' using errcode='22023'; end if;
  select * into offer from public.shop_private_offers where id=(p_payload->>'offerId')::uuid for update;
  if offer.id is null or offer.integration_principal_id<>principal.id
  or offer.target_binding_id is distinct from (p_payload->>'targetBindingId')::uuid
  or offer.target_environment_id is distinct from (p_payload->>'targetEnvironmentId')::uuid
  or offer.offer_version is distinct from (p_payload->>'offerVersion')::integer
  or not exists(select 1 from public.shop_private_offer_security where offer_id=offer.id) then
   raise exception 'SHOP_PRIVATE_OFFER_BINDING_MISMATCH' using errcode='42501'; end if;
  if exists(select 1 from public.shop_private_offer_redemptions where offer_id=offer.id) then
   raise exception 'SHOP_PRIVATE_OFFER_ALREADY_REDEEMED' using errcode='23505'; end if;
  insert into public.shop_private_offer_revocations(offer_id,integration_principal_id,request_id,reason)
  values(offer.id,principal.id,p_request,btrim(p_reason));
  return jsonb_build_object('data',jsonb_build_object('offerId',offer.id,'offerVersion',offer.offer_version,
   'targetBindingId',offer.target_binding_id,'targetEnvironmentId',offer.target_environment_id,'state','revoked'));
 end if;
 raise exception 'SHOP_PRIVATE_OFFER_INVALID' using errcode='22023';
end $$;
revoke all on function shop_private.secure_offer_command(uuid,text,text,jsonb) from public,anon,authenticated,service_role;

alter function public.platform_admin_billing_command(uuid,text,uuid,text,jsonb) rename to billing_command_before_secure_offers;
alter function public.billing_command_before_secure_offers(uuid,text,uuid,text,jsonb) set schema shop_private;
revoke all on function shop_private.billing_command_before_secure_offers(uuid,text,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.platform_admin_billing_command(p_request_id uuid,p_action text,p_submission_id uuid,p_reason text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_action in ('register_secure_private_offer','revoke_secure_private_offer') then
  if p_submission_id is not null then raise exception 'SHOP_PRIVATE_OFFER_INVALID' using errcode='22023'; end if;
  return shop_private.secure_offer_command(p_request_id,p_action,p_reason,p_payload);
 end if;
 return shop_private.billing_command_before_secure_offers(p_request_id,p_action,p_submission_id,p_reason,p_payload);
end $$;
revoke all on function public.platform_admin_billing_command(uuid,text,uuid,text,jsonb) from public,anon;
grant execute on function public.platform_admin_billing_command(uuid,text,uuid,text,jsonb) to authenticated,service_role;

alter function public.redeem_shop_private_offer(uuid,uuid,integer,uuid,uuid,uuid,numeric,date,text) rename to redeem_private_offer_before_security;
alter function public.redeem_private_offer_before_security(uuid,uuid,integer,uuid,uuid,uuid,numeric,date,text) set schema shop_private;
revoke all on function shop_private.redeem_private_offer_before_security(uuid,uuid,integer,uuid,uuid,uuid,numeric,date,text) from public,anon,authenticated,service_role;
create function public.redeem_shop_private_offer(p_request_id uuid,p_offer_id uuid,p_offer_version integer,p_shop_id uuid,
 p_target_binding_id uuid,p_target_environment_id uuid,p_paid_amount numeric,p_transfer_date date,p_transfer_reference text)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null or not shop_private.is_owner(p_shop_id) then
  raise exception 'SHOP_OWNER_REQUIRED' using errcode='42501'; end if;
 if exists(select 1 from public.shop_private_offer_security where offer_id=p_offer_id) then
  raise exception 'SHOP_PRIVATE_OFFER_TOKEN_REQUIRED' using errcode='42501'; end if;
 return shop_private.redeem_private_offer_before_security(p_request_id,p_offer_id,p_offer_version,p_shop_id,
  p_target_binding_id,p_target_environment_id,p_paid_amount,p_transfer_date,p_transfer_reference);
end $$;
create function public.redeem_shop_private_offer(p_request_id uuid,p_offer_id uuid,p_offer_version integer,p_shop_id uuid,
 p_target_binding_id uuid,p_target_environment_id uuid,p_paid_amount numeric,p_transfer_date date,p_transfer_reference text,p_redemption_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare offer public.shop_private_offers; security public.shop_private_offer_security;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null or not shop_private.is_owner(p_shop_id) then
  raise exception 'SHOP_OWNER_REQUIRED' using errcode='42501'; end if;
 select * into offer from public.shop_private_offers where id=p_offer_id for update;
 if offer.id is null or offer.recipient_user_id<>auth.uid() or offer.shop_id<>p_shop_id
 or offer.target_binding_id is distinct from p_target_binding_id or offer.target_environment_id is distinct from p_target_environment_id
 or offer.offer_version is distinct from p_offer_version then
  raise exception 'SHOP_PRIVATE_OFFER_RECIPIENT_MISMATCH' using errcode='42501'; end if;
 select * into security from public.shop_private_offer_security where offer_id=p_offer_id;
 if security.offer_id is null or p_redemption_token is null or p_redemption_token !~ '^[A-Za-z0-9_-]{43}$'
 or encode(extensions.digest(p_redemption_token,'sha256'),'hex') is distinct from security.token_digest then
  raise exception 'SHOP_PRIVATE_OFFER_TOKEN_INVALID' using errcode='42501'; end if;
 if exists(select 1 from public.shop_private_offer_revocations where offer_id=p_offer_id) then
  raise exception 'SHOP_PRIVATE_OFFER_REVOKED' using errcode='42501'; end if;
 return shop_private.redeem_private_offer_before_security(p_request_id,p_offer_id,p_offer_version,p_shop_id,
  p_target_binding_id,p_target_environment_id,p_paid_amount,p_transfer_date,p_transfer_reference);
end $$;
revoke all on function public.redeem_shop_private_offer(uuid,uuid,integer,uuid,uuid,uuid,numeric,date,text),
 public.redeem_shop_private_offer(uuid,uuid,integer,uuid,uuid,uuid,numeric,date,text,text) from public,anon,service_role;
grant execute on function public.redeem_shop_private_offer(uuid,uuid,integer,uuid,uuid,uuid,numeric,date,text),
 public.redeem_shop_private_offer(uuid,uuid,integer,uuid,uuid,uuid,numeric,date,text,text) to authenticated;

alter table public.plan_catalog_terms add column offer_entitlements jsonb not null default '{}'::jsonb check(jsonb_typeof(offer_entitlements)='object');
alter table public.shop_billing_submissions add column offer_entitlements jsonb not null default '{}'::jsonb check(jsonb_typeof(offer_entitlements)='object');
alter table public.subscription_commercial_periods add column offer_entitlements jsonb not null default '{}'::jsonb check(jsonb_typeof(offer_entitlements)='object');
create function shop_private.freeze_offer_entitlements()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.offer_entitlements is distinct from old.offer_entitlements then raise exception 'SHOP_OFFER_ENTITLEMENTS_IMMUTABLE' using errcode='55000'; end if;
  return new;
 end if;
 if tg_table_name='plan_catalog_terms' then
  new.offer_entitlements:=coalesce((select entitlements from public.shop_private_offer_security where offer_id=new.private_offer_id),'{}'::jsonb);
 elsif tg_table_name='shop_billing_submissions' then
  new.offer_entitlements:=coalesce((select offer_entitlements from public.plan_catalog_terms where id=new.catalog_terms_id),'{}'::jsonb);
 else
  new.offer_entitlements:=coalesce((select offer_entitlements from public.shop_billing_submissions where id=new.billing_submission_id),'{}'::jsonb);
 end if;
 return new;
end $$;
revoke all on function shop_private.freeze_offer_entitlements() from public,anon,authenticated,service_role;
create trigger terms_secure_offer_entitlements before insert on public.plan_catalog_terms for each row execute function shop_private.freeze_offer_entitlements();
create trigger submissions_secure_offer_entitlements before insert or update on public.shop_billing_submissions for each row execute function shop_private.freeze_offer_entitlements();
create trigger periods_secure_offer_entitlements before insert on public.subscription_commercial_periods for each row execute function shop_private.freeze_offer_entitlements();

create or replace function shop_private.bridge_manifest(p_principal_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with manifest as (
    select jsonb_build_object(
      'adapterId', 'shop-suit-super-admin-bridge', 'suit', 'shop-suit',
      'targetBindingId', principal.target_binding_id,
      'targetEnvironmentId', principal.target_environment_id,
      'audience', principal.audience, 'health', 'ready',
      'manifestSchemaVersion', '1.0', 'protocolVersions', jsonb_build_array('1.0'),
      'manifestRevision', 'sas-secure-private-offer-v2', 'issuedAt', clock_timestamp(),
      'capabilities', coalesce(jsonb_agg(jsonb_build_object(
        'operation', operation, 'version', '1.0',
        'kind', case when operation like '%.command' then 'command' else 'query' end,
        'idempotency', case when operation like '%.command' then 'exact-request-id' else 'nonce-only' end,
        'members', case operation
          when 'adapter.capabilities.read' then jsonb_build_array('manifest')
          when 'shop.platform.query' then to_jsonb(array['dashboard','shops','shop','audit'])
          when 'shop.platform.command' then to_jsonb(array['suspend_shop','reactivate_shop','add_support_note'])
          when 'shop.billing.query' then to_jsonb(array['queue','configuration','summary','audit'])
          when 'shop.billing.command' then to_jsonb(array['configure_instructions','mark_under_review','approve','reject','set_price_override','register_private_offer','register_secure_private_offer','revoke_secure_private_offer'])
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


create or replace function public.shop_super_admin_bridge_invoke(
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
      'approve','reject','set_price_override','register_private_offer','register_secure_private_offer','revoke_secure_private_offer') then
      raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023'; end if;
    v_target_id := nullif(v_payload ->> 'submissionId', '')::uuid;
    if v_payload ->> 'action' in ('register_private_offer','register_secure_private_offer') then
      v_target_id := (v_payload #>> '{payload,shopId}')::uuid;
    elsif v_payload ->> 'action' = 'revoke_secure_private_offer' then
      v_target_id := (v_payload #>> '{payload,offerId}')::uuid;
    end if;
    v_result := public.platform_admin_billing_command(v_internal_request_id,
      v_payload ->> 'action', nullif(v_payload ->> 'submissionId', '')::uuid, v_reason,
      coalesce(v_payload -> 'payload', '{}'::jsonb));
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
notify pgrst, 'reload schema';

-- Composite row projection follows the additive immutable snapshot column.
create or replace function shop_private.current_plan_offers(
  p_plan_id uuid, p_at timestamptz default clock_timestamp()
) returns setof public.plan_catalog_terms
language sql stable security definer set search_path = '' as $$
  with effective as (
    select terms.*,
      max(terms.catalog_generation) over (partition by terms.plan_id) current_generation,
      row_number() over (
        partition by terms.plan_id, terms.catalog_generation,
          terms.plan_variant, terms.billing_interval
        order by terms.effective_from desc, terms.version desc, terms.id desc
      ) offer_rank
    from public.plan_catalog_terms terms
    where terms.plan_id = p_plan_id and terms.effective_from <= p_at
      and terms.private_offer_id is null
  )
  select effective.id, effective.plan_id, effective.version,
    effective.display_name, effective.billing_interval, effective.currency,
    effective.price_amount, effective.trial_days, effective.resource_limits,
    effective.is_public, effective.is_purchasable, effective.effective_from,
    effective.created_at, effective.catalog_generation,
    effective.plan_variant, effective.variant_name, effective.private_offer_id, effective.offer_entitlements
  from effective
  where effective.catalog_generation = effective.current_generation
    and effective.offer_rank = 1
  order by case effective.plan_variant
      when 'standard' then 1 when 'multi_2' then 2 when 'multi_3' then 3 else 9 end,
    case effective.billing_interval when 'monthly' then 1 when 'annual' then 2 else 9 end;
$$;
