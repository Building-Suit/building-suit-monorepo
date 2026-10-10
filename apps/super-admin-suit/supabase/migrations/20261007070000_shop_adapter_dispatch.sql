-- SAS-M1-SHOP-ADAPTER-001. Protocol constants only; all bindings/policy/secrets are provisioned data.
create table public.adapter_dispatches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  correlation_id uuid not null,
  binding_id uuid not null references public.suit_environment_bindings(id),
  actor_user_id uuid not null references auth.users(id),
  envelope jsonb not null,
  body text not null,
  body_digest text not null,
  config_versions jsonb not null,
  audience text not null,
  created_at timestamptz not null default clock_timestamp()
);
create table public.adapter_attempts (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.adapter_dispatches(id),
  secret_reference_id uuid not null references public.integration_secret_references(id),
  key_id text not null,
  configuration_versions jsonb not null,
  nonce uuid not null unique default gen_random_uuid(),
  request_timestamp bigint not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);
create table public.adapter_attempt_results (
  attempt_id uuid primary key references public.adapter_attempts(id),
  response_digest text,
  outcome text not null check(outcome in ('success','target_rejected','outcome_unknown')),
  target_audit_id text,
  created_at timestamptz not null default clock_timestamp()
);
do $$ declare t text; begin
  foreach t in array array['adapter_dispatches','adapter_attempts','adapter_attempt_results'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role',t);
    execute format('create trigger %I before update or delete or truncate on public.%I for each statement execute function super_admin_private.reject_mutation()',t||'_immutable',t);
  end loop;
end $$;

-- Resolve the effective intersection for both enqueue and claim (revocation is rechecked).
create function super_admin_private.adapter_configuration(p_binding uuid, p_operation text, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b public.suit_environment_bindings; a public.adapter_registrations;
  c public.adapter_capability_policy; m public.adapter_manifest_observations;
  s public.integration_secret_references; settings jsonb; authority uuid;
  source_kind text; target_kind text;
begin
  if p_operation !~ '^(adapter\.capabilities\.read|shop\.(platform|billing|plan)\.(query|command))$' then
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

create function public.super_admin_adapter_enqueue(p_input jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor public.platform_admins; cfg jsonb; env jsonb; body_value text; prior public.adapter_dispatches; dispatch_id uuid;
begin
  actor:=super_admin_private.assert_platform_owner();
  perform super_admin_private.assert_payload_keys(p_input,array['bindingId','operation','requestId','correlationId','reason','payload']);
  if jsonb_typeof(p_input->'payload') is distinct from 'object' or p_input->>'requestId' is null or p_input->>'correlationId' is null then raise exception 'INVALID_REQUEST'; end if;
  if p_input->>'operation' like '%.command' then
    if length(btrim(p_input->>'reason')) not between 8 and 1000 or p_input->>'reason' is null then raise exception 'REASON_REQUIRED'; end if;
  elsif p_input->'reason' is distinct from 'null'::jsonb then raise exception 'INVALID_REQUEST'; end if;
  cfg:=super_admin_private.adapter_configuration((p_input->>'bindingId')::uuid,p_input->>'operation',actor.user_id);
  env:=jsonb_build_object('protocolVersion','1.0','operation',p_input->>'operation','operationVersion','1.0',
    'requestId',(p_input->>'requestId')::uuid,'correlationId',(p_input->>'correlationId')::uuid,
    'sourceBindingId',actor.authority_environment_id,'targetBindingId',(cfg#>>'{settings,targetBindingId}')::uuid,
    'targetEnvironmentId',(cfg#>>'{binding,target_environment_id}')::uuid,
    'actor',jsonb_build_object('authorityBindingId',actor.authority_environment_id,'subjectId',actor.user_id,'roleSnapshot',actor.role,'sessionId',null),
    'reason',p_input->'reason','payload',p_input->'payload');
  body_value:=env::text;
  if octet_length(body_value)>65536 then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_input->>'requestId',0));
  select * into prior from public.adapter_dispatches where request_id=(p_input->>'requestId')::uuid;
  if prior.id is not null then
    if prior.body<>body_value or prior.binding_id<>(p_input->>'bindingId')::uuid or prior.actor_user_id<>actor.user_id then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return prior.id;
  end if;
  insert into public.adapter_dispatches(request_id,correlation_id,binding_id,actor_user_id,envelope,body,body_digest,config_versions,audience)
    values((p_input->>'requestId')::uuid,(p_input->>'correlationId')::uuid,(p_input->>'bindingId')::uuid,actor.user_id,env,body_value,
      encode(extensions.digest(convert_to(body_value,'UTF8'),'sha256'),'hex'),
      jsonb_build_object('binding',cfg#>'{binding,version}','adapter',cfg#>'{adapter,version}','capability',cfg#>'{capability,version}','manifest',cfg#>'{manifest,id}'),cfg#>>'{binding,audience}') returning id into dispatch_id;
  return dispatch_id;
end $$;

-- Keys are base64url HMAC material, never returned by these functions.
create function super_admin_private.adapter_key(p_reference uuid)
returns bytea language plpgsql security definer set search_path = '' as $$
declare encoded text; key_value bytea;
begin
  select v.decrypted_secret into encoded from public.integration_secret_references r
    join vault.decrypted_secrets v on v.id=r.vault_secret_id where r.id=p_reference
      and r.status='active' and r.valid_from<=clock_timestamp() and (r.valid_until is null or r.valid_until>clock_timestamp());
  if encoded is null or encoded !~ '^[A-Za-z0-9_-]+$' then raise exception 'SIGNER_UNAVAILABLE'; end if;
  key_value:=decode(translate(encoded,'-_','+/')||repeat('=',(4-length(encoded)%4)%4),'base64');
  if octet_length(key_value)<32 then raise exception 'SIGNER_UNAVAILABLE'; end if;
  return key_value;
end $$;
create function super_admin_private.adapter_mac(p_input text,p_key bytea)
returns text language sql immutable set search_path = '' as $$
  select rtrim(translate(encode(extensions.hmac(convert_to(p_input,'UTF8'),p_key,'sha256'),'base64'),'+/','-_'),'=');
$$;
create function public.super_admin_adapter_claim(p_dispatch_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.adapter_dispatches; cfg jsonb; att public.adapter_attempts; e jsonb; key_id text; sig text; ts bigint; target_url text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVER_REQUIRED' using errcode='42501'; end if;
  select * into d from public.adapter_dispatches where id=p_dispatch_id for update;
  if d.id is null then raise exception 'DISPATCH_UNAVAILABLE'; end if;
  -- Expired claims leave an immutable ambiguous result; a retry keeps exact logical bytes.
  insert into public.adapter_attempt_results(attempt_id,outcome)
    select a.id,'outcome_unknown' from public.adapter_attempts a where a.dispatch_id=d.id and a.expires_at<=clock_timestamp()
      and not exists(select 1 from public.adapter_attempt_results r where r.attempt_id=a.id) on conflict do nothing;
  if exists(select 1 from public.adapter_attempts a where a.dispatch_id=d.id and not exists(select 1 from public.adapter_attempt_results r where r.attempt_id=a.id)) then raise exception 'ATTEMPT_IN_PROGRESS'; end if;
  cfg:=super_admin_private.adapter_configuration(d.binding_id,d.envelope->>'operation',d.actor_user_id);
  if d.config_versions->'binding' is distinct from cfg#>'{binding,version}' then raise exception 'CONFIGURATION_CHANGED'; end if;
  if (cfg#>>'{settings,targetBindingId}') is distinct from d.envelope->>'targetBindingId'
    or (cfg#>>'{binding,target_environment_id}') is distinct from d.envelope->>'targetEnvironmentId' then raise exception 'ENVIRONMENT_MISMATCH'; end if;
  e:=d.envelope; key_id:=cfg#>>'{secretReference,key_id}'; ts:=floor(extract(epoch from clock_timestamp()));
  target_url:=cfg#>>'{binding,adapter_base_url}';
  if target_url !~ '^https://[A-Za-z0-9.-]+/?$' or not (cfg#>'{binding,egress_policy,allowedHosts}' ? split_part(split_part(target_url,'//',2),'/',1)) then raise exception 'EGRESS_DENIED'; end if;
  insert into public.adapter_attempts(dispatch_id,secret_reference_id,key_id,configuration_versions,request_timestamp,expires_at)
    values(d.id,(cfg#>>'{secretReference,id}')::uuid,key_id,jsonb_build_object('binding',cfg#>'{binding,version}','adapter',cfg#>'{adapter,version}','capability',cfg#>'{capability,version}','manifest',cfg#>'{manifest,id}','secretReference',cfg#>'{secretReference,version}'),ts,clock_timestamp()+make_interval(secs=>(cfg#>>'{settings,timeoutMs}')::integer/1000.0)) returning * into att;
  sig:=super_admin_private.adapter_mac(array_to_string(array['BS-S2S-HMAC-SHA256','1.0',key_id,ts::text,att.nonce::text,
    e->>'requestId',e->>'correlationId',e->>'sourceBindingId',e->>'targetBindingId',e->>'targetEnvironmentId',cfg#>>'{binding,audience}',
    'POST','/functions/v1/shop-super-admin-bridge/v1/invoke',d.body_digest],E'\n'),super_admin_private.adapter_key(att.secret_reference_id));
  return jsonb_build_object('attemptId',att.id,'url',rtrim(target_url,'/')||'/functions/v1/shop-super-admin-bridge/v1/invoke',
    'allowedHosts',cfg#>'{binding,egress_policy,allowedHosts}','timeoutMs',cfg#>'{settings,timeoutMs}','maxResponseBytes',cfg#>'{settings,maxResponseBytes}',
    'configuration',jsonb_build_object('bindingId',d.binding_id,'authorityEnvironmentId',e->>'sourceBindingId','targetEnvironmentId',e->>'targetEnvironmentId','operation',e->>'operation','version','1.0','enabled',true,'manifestExpiresAt',cfg#>>'{manifest,expires_at}','secretReferenceId',att.secret_reference_id),
    'body',d.body,'headers',jsonb_build_object('content-type','application/json','x-bs-algorithm','BS-S2S-HMAC-SHA256','x-bs-protocol-version','1.0',
    'x-bs-key-id',key_id,'x-bs-timestamp',ts::text,'x-bs-nonce',att.nonce,'x-bs-request-id',e->>'requestId',
    'x-bs-correlation-id',e->>'correlationId','x-bs-source-binding-id',e->>'sourceBindingId','x-bs-target-binding-id',e->>'targetBindingId',
    'x-bs-target-environment-id',e->>'targetEnvironmentId','x-bs-audience',cfg#>>'{binding,audience}','x-bs-body-sha256',d.body_digest,'x-bs-signature',sig));
end $$;

create function public.super_admin_adapter_complete(p_attempt_id uuid,p_response jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare att public.adapter_attempts; d public.adapter_dispatches; b public.suit_environment_bindings; s public.integration_secret_references;
  expected text; digest_value text; response_value jsonb; outcome_value text:='outcome_unknown'; result_value jsonb:='{"code":"outcome_unknown"}'; key_value bytea; difference integer:=0; i integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVER_REQUIRED' using errcode='42501'; end if;
  select * into att from public.adapter_attempts where id=p_attempt_id for update;
  if att.id is null or exists(select 1 from public.adapter_attempt_results where attempt_id=att.id) then raise exception 'ATTEMPT_UNAVAILABLE'; end if;
  select * into d from public.adapter_dispatches where id=att.dispatch_id;
  select * into b from public.suit_environment_bindings where id=d.binding_id;
  select * into s from public.integration_secret_references where id=att.secret_reference_id;
  begin
    if p_response is null or b.status<>'active' or p_response->>'algorithm' is distinct from 'BS-S2S-RESPONSE-HMAC-SHA256'
      or p_response->>'protocolVersion' is distinct from '1.0' or p_response->>'keyId' is distinct from att.key_id
      or att.configuration_versions->'secretReference' is distinct from to_jsonb(s.version)
      or not coalesce(p_response->>'signature' ~ '^[A-Za-z0-9_-]{43}$',false) then raise exception 'UNTRUSTED_RESPONSE'; end if;
    digest_value:=encode(extensions.digest(convert_to(p_response->>'body','UTF8'),'sha256'),'hex');
    if digest_value is distinct from p_response->>'digest' then raise exception 'UNTRUSTED_RESPONSE'; end if;
    key_value:=super_admin_private.adapter_key(s.id);
    expected:=super_admin_private.adapter_mac(array_to_string(array['BS-S2S-RESPONSE-HMAC-SHA256','1.0',att.key_id,
      d.envelope->>'requestId',d.envelope->>'correlationId',d.envelope->>'sourceBindingId',d.envelope->>'targetBindingId',d.envelope->>'targetEnvironmentId',
      d.audience,p_response->>'status',d.body_digest,digest_value],E'\n'),key_value);
    -- Fixed-length comparison; no early return on a differing byte.
    for i in 1..43 loop difference:=difference | (ascii(substr(expected,i,1)) # ascii(substr(p_response->>'signature',i,1))); end loop;
    if difference<>0 then raise exception 'UNTRUSTED_RESPONSE'; end if;
    response_value:=(p_response->>'body')::jsonb;
    if response_value->>'requestDigest' is distinct from d.body_digest
      or exists(select 1 from unnest(array['protocolVersion','requestId','correlationId','targetBindingId','operation','operationVersion']) k where response_value->>k is distinct from d.envelope->>k)
      or (response_value ? 'data')=(response_value ? 'error')
      or (response_value - array['protocolVersion','requestId','correlationId','targetBindingId','operation','operationVersion','requestDigest','data','error','replayed','targetAuditId','targetResultVersion'])<>'{}'::jsonb then raise exception 'UNTRUSTED_RESPONSE'; end if;
    if response_value ? 'error' then
      outcome_value:='target_rejected'; result_value:='{"code":"target_rejected"}';
    elsif p_response->>'status'='200' then
      outcome_value:='success'; result_value:=jsonb_build_object('data',response_value->'data','targetAuditId',response_value->'targetAuditId',
        'targetResultVersion',response_value->'targetResultVersion','replayed',response_value->'replayed');
    end if;
  exception when others then outcome_value:='outcome_unknown'; result_value:='{"code":"outcome_unknown"}'; end;
  insert into public.adapter_attempt_results(attempt_id,response_digest,outcome,target_audit_id)
    values(att.id,digest_value,outcome_value,case when outcome_value='success' then response_value->>'targetAuditId' end);
  return result_value;
end $$;
revoke all on function super_admin_private.adapter_configuration(uuid,text,uuid), super_admin_private.adapter_key(uuid), super_admin_private.adapter_mac(text,bytea) from public,anon,authenticated,service_role;
revoke all on function public.super_admin_adapter_enqueue(jsonb), public.super_admin_adapter_claim(uuid), public.super_admin_adapter_complete(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.super_admin_adapter_enqueue(jsonb) to authenticated;
grant execute on function public.super_admin_adapter_claim(uuid), public.super_admin_adapter_complete(uuid,jsonb) to service_role;
