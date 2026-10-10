-- No configuration/navigation/payment values are seeded.
create function super_admin_private.transfer_binding(p_suit uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor public.platform_admins; candidate uuid; answer uuid; count_value integer:=0;
begin
  actor:=super_admin_private.assert_platform_owner();
  for candidate in select id from public.suit_environment_bindings where suit_id=p_suit and admin_environment_id=actor.authority_environment_id and status='active' loop
    begin
      perform super_admin_private.adapter_configuration(candidate,'shop.billing.query',actor.user_id);
      perform super_admin_private.adapter_configuration(candidate,'shop.billing.command',actor.user_id);
      answer:=candidate; count_value:=count_value+1;
    exception when others then continue;
    end;
  end loop;
  if count_value=1 then return answer; end if;
  return null;
end $$;
revoke all on function super_admin_private.transfer_binding(uuid) from public,anon,authenticated,service_role;

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
          'description', item.description, 'module', item.module_kind, 'bindingId', case when item.module_kind='manual-transfer' then super_admin_private.transfer_binding(suit.id) else null end
        ) order by item.sort_order, item.stable_key)
        from public.navigation_items item
        where item.suit_id = suit.id and item.enabled
          and item.route_descriptor = '{}'::jsonb
          and item.visibility_policy in ('{}'::jsonb, '{"role":"owner"}'::jsonb)
          and (
            (item.module_kind='manual-transfer' and item.required_capability_key='shop.billing.query' and item.required_capability_version='1.0' and super_admin_private.transfer_binding(suit.id) is not null) or (item.module_kind = 'overview' and item.required_capability_key is null)
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
-- Payment evidence is closed, non-secret presentation data only.
create function super_admin_private.assert_transfer_evidence(c jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare field text; v jsonb;
begin
  if c is null or c='null'::jsonb then return; end if;
  if jsonb_typeof(c) is distinct from 'object'
    or (c-array['version','enabled','recipientAlias','recipientDetails','instructions','paymentLink','qr'])<>'{}'::jsonb
    or jsonb_typeof(c->'enabled') is distinct from 'boolean'
    or jsonb_typeof(c->'version') is distinct from 'number' or (c->>'version')::bigint<1
    or jsonb_typeof(c->'instructions') is distinct from 'object' or ((c->'instructions')-array['en','ar'])<>'{}'::jsonb
    or jsonb_typeof(c->'qr') is distinct from 'object' or ((c->'qr')-array['assetUrl','alt'])<>'{}'::jsonb
    or jsonb_typeof(c#>'{qr,alt}') is distinct from 'object' or ((c#>'{qr,alt}')-array['en','ar'])<>'{}'::jsonb then
    raise exception 'UNTRUSTED_RESPONSE';
  end if;
  foreach field in array array['recipientAlias','recipientDetails','paymentLink'] loop
    if jsonb_typeof(c->field) is distinct from 'string' or length(c->>field)>4000 then raise exception 'UNTRUSTED_RESPONSE'; end if;
  end loop;
  foreach v in array array[c#>'{instructions,en}',c#>'{instructions,ar}',c#>'{qr,assetUrl}',c#>'{qr,alt,en}',c#>'{qr,alt,ar}'] loop
    if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>4000 then raise exception 'UNTRUSTED_RESPONSE'; end if;
  end loop;
end $$;
revoke all on function super_admin_private.assert_transfer_evidence(jsonb) from public,anon,authenticated,service_role;

create or replace function public.super_admin_adapter_complete(p_attempt_id uuid,p_response jsonb)
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
      if d.envelope->>'operation'='shop.billing.command' and d.envelope#>>'{payload,action}'='configure-manual-transfer' then
        perform super_admin_private.assert_transfer_evidence(response_value#>'{data,before}');
        perform super_admin_private.assert_transfer_evidence(response_value#>'{data,after}');
        if nullif(response_value->>'targetAuditId','') is null
          or jsonb_typeof(response_value#>'{data,after}') is distinct from 'object'
          or not (response_value->'data' ? 'before')
          or response_value#>'{data,configuration}' is distinct from response_value#>'{data,after}'
          or not coalesce((response_value#>>'{data,after,version}')::bigint = (d.envelope#>>'{payload,expectedVersion}')::bigint+1,false)
          or response_value#>'{data,after,version}' is distinct from response_value->'targetResultVersion'
          or ((response_value#>'{data,after}')-'version') is distinct from ((d.envelope#>'{payload,configuration}')-'version')
          or coalesce((response_value#>>'{data,before,version}')::bigint,0) <> (d.envelope#>>'{payload,expectedVersion}')::bigint then
          raise exception 'UNTRUSTED_RESPONSE';
        end if;
      end if;
      outcome_value:='success'; result_value:=jsonb_build_object('data',response_value->'data','targetAuditId',response_value->'targetAuditId',
        'targetResultVersion',response_value->'targetResultVersion','replayed',response_value->'replayed');
    end if;
  exception when others then outcome_value:='outcome_unknown'; result_value:='{"code":"outcome_unknown"}'; end;
  if outcome_value='success' and d.envelope->>'operation'='shop.billing.command' and d.envelope#>>'{payload,action}'='configure-manual-transfer' then
    perform 1 from public.adapter_dispatches where id=d.id for update;
    insert into public.control_plane_events(request_id,correlation_id,actor_user_id,actor_role,authority_environment_id,suit_id,target_environment_id,
      action,target_type,target_id,reason,safe_parameters,before_state,after_state,result,request_fingerprint)
    values(d.request_id,d.correlation_id,d.actor_user_id,d.envelope#>>'{actor,roleSnapshot}',(d.envelope#>>'{actor,authorityBindingId}')::uuid,
      b.suit_id,b.target_environment_id,'configure-manual-transfer','adapter-binding',b.id,d.envelope->>'reason',
      jsonb_build_object('operation',d.envelope->>'operation','targetAuditId',response_value->>'targetAuditId'),
      response_value#>'{data,before}',response_value#>'{data,after}',
      jsonb_build_object('targetAuditId',response_value->>'targetAuditId','targetResultVersion',response_value->'targetResultVersion'),d.body_digest)
    on conflict (request_id) do nothing;
  end if;
  insert into public.adapter_attempt_results(attempt_id,response_digest,outcome,target_audit_id)
    values(att.id,digest_value,outcome_value,case when outcome_value='success' then response_value->>'targetAuditId' end);
  return result_value;
end $$;
