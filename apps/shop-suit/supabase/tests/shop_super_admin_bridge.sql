-- SS-SA-BRIDGE-001 target conformance: environment/scope binding, nonce replay,
-- exact command replay and signed external actor evidence.

create temporary table shop_super_admin_bridge_fixture as
select
  gen_random_uuid() owner_id,
  gen_random_uuid() principal_id,
  gen_random_uuid() source_binding_id,
  gen_random_uuid() target_binding_id,
  gen_random_uuid() target_environment_id,
  gen_random_uuid() request_id,
  gen_random_uuid() correlation_id,
  gen_random_uuid() actor_id;

insert into auth.users (id, email, encrypted_password, aud, role,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select owner_id, owner_id || '@shop-super-admin-bridge.invalid', 'x',
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from shop_super_admin_bridge_fixture;

select set_config('request.jwt.claim.sub', owner_id::text, false),
  set_config('request.jwt.claim.role', 'authenticated', false)
from shop_super_admin_bridge_fixture;
set local role authenticated;
select set_config('ss_sa_bridge.shop_id', public.create_owner_shop(
  'Super Admin bridge fixture', 'team', 'mixed'::public.business_mode)::text, false);
reset role;

insert into public.shop_super_admin_integrations (
  id, source_binding_id, target_binding_id, target_environment_id, audience,
  key_id, allowed_operations, max_clock_skew_seconds, nonce_retention_seconds,
  valid_from, enabled
)
select principal_id, source_binding_id, target_binding_id, target_environment_id,
  'shop-suit:test', 'shop-test-v1',
  array['adapter.capabilities.read','shop.platform.command'], 300, 3600,
  clock_timestamp() - interval '1 minute', true
from shop_super_admin_bridge_fixture;

select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', 'service_role', false);
set local role service_role;

do $$
declare f shop_super_admin_bridge_fixture; v_wrong uuid := gen_random_uuid();
begin
  select * into f from shop_super_admin_bridge_fixture;
  begin
    perform public.shop_super_admin_bridge_principal(
      'shop-test-v1', f.source_binding_id, f.target_binding_id, v_wrong, 'shop-suit:test');
    raise exception 'wrong environment accepted';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
declare
  f shop_super_admin_bridge_fixture; v_nonce uuid := gen_random_uuid();
  v_digest text := repeat('a', 64); v_result jsonb; v_envelope jsonb;
begin
  select * into f from shop_super_admin_bridge_fixture;
  perform public.shop_super_admin_bridge_accept_nonce(
    f.principal_id, 'shop-test-v1', v_nonce, f.request_id,
    extract(epoch from clock_timestamp())::bigint, v_digest);
  begin
    perform public.shop_super_admin_bridge_accept_nonce(
      f.principal_id, 'shop-test-v1', v_nonce, f.request_id,
      extract(epoch from clock_timestamp())::bigint, v_digest);
    raise exception 'captured nonce replay accepted';
  exception when unique_violation then null;
  end;

  v_envelope := jsonb_build_object(
    'protocolVersion','1.0','operation','shop.platform.command','operationVersion','1.0',
    'requestId',f.request_id,'correlationId',f.correlation_id,
    'sourceBindingId',f.source_binding_id,'targetBindingId',f.target_binding_id,
    'targetEnvironmentId',f.target_environment_id,
    'actor',jsonb_build_object('authorityBindingId',f.source_binding_id,
      'subjectId',f.actor_id,'roleSnapshot','super-admin-operator','sessionId','safe-session'),
    'reason','Verified external support review',
    'payload',jsonb_build_object('shopId',current_setting('ss_sa_bridge.shop_id')::uuid,
      'action','add_support_note','payload',jsonb_build_object('note','Bridge verification note'))
  );
  v_result := public.shop_super_admin_bridge_invoke(f.principal_id, v_nonce, v_digest, v_envelope);
  if (v_result ->> 'replayed')::boolean
    or v_result #>> '{data,supportNote}' <> 'Bridge verification note' then
    raise exception 'valid bridge command failed';
  end if;

  v_nonce := gen_random_uuid();
  perform public.shop_super_admin_bridge_accept_nonce(
    f.principal_id, 'shop-test-v1', v_nonce, f.request_id,
    extract(epoch from clock_timestamp())::bigint, v_digest);
  v_result := public.shop_super_admin_bridge_invoke(f.principal_id, v_nonce, v_digest, v_envelope);
  if not (v_result ->> 'replayed')::boolean then raise exception 'exact command replay mutated'; end if;

  if (select count(*) from public.shop_super_admin_requests request
      where request.request_id = f.request_id) <> 1
    or (select count(*) from public.platform_admin_events event
      join public.shop_super_admin_requests request on request.underlying_audit_id = event.id
      where request.request_id = f.request_id and event.actor_user_id is null) <> 1
    or not exists (select 1 from public.shop_super_admin_requests request
      where request.request_id = f.request_id and request.correlation_id = f.correlation_id
        and request.external_subject_id = f.actor_id
        and request.reason = 'Verified external support review') then
    raise exception 'bridge audit/idempotency evidence incomplete';
  end if;
end $$;

do $$
declare
  f shop_super_admin_bridge_fixture; v_nonce uuid := gen_random_uuid();
  v_request uuid := gen_random_uuid(); v_digest text := repeat('b', 64);
begin
  select * into f from shop_super_admin_bridge_fixture;
  perform public.shop_super_admin_bridge_accept_nonce(
    f.principal_id, 'shop-test-v1', v_nonce, v_request,
    extract(epoch from clock_timestamp())::bigint, v_digest);
  begin
    perform public.shop_super_admin_bridge_invoke(f.principal_id, v_nonce, v_digest,
      jsonb_build_object(
        'protocolVersion','1.0','operation','shop.plan.query','operationVersion','1.0',
        'requestId',v_request,'correlationId',gen_random_uuid(),
        'sourceBindingId',f.source_binding_id,'targetBindingId',f.target_binding_id,
        'targetEnvironmentId',f.target_environment_id,
        'actor',jsonb_build_object('authorityBindingId',f.source_binding_id,
          'subjectId',f.actor_id,'roleSnapshot','operator','sessionId',null),
        'reason',null,'payload',jsonb_build_object('resource','catalog')));
    raise exception 'unauthorized capability accepted';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

do $$
begin
  if has_table_privilege('anon', 'public.shop_super_admin_integrations', 'select')
    or has_table_privilege('authenticated', 'public.shop_super_admin_requests', 'select')
    or has_function_privilege('anon',
      'public.shop_super_admin_bridge_invoke(uuid,uuid,text,jsonb)', 'execute')
    or has_function_privilege('authenticated',
      'public.shop_super_admin_bridge_invoke(uuid,uuid,text,jsonb)', 'execute') then
    raise exception 'bridge authority exposed to browser roles';
  end if;
end $$;

select 'shop_super_admin_bridge: passed' as result;
