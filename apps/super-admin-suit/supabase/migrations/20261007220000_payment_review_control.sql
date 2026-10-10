-- SAS-M1-BILLING-001: presentation routing and immutable observed Shop review audit.
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
          'description', item.description, 'module', item.module_kind, 'bindingId', case when item.module_kind in ('manual-transfer','payment-review') then super_admin_private.transfer_binding(suit.id) else null end
        ) order by item.sort_order, item.stable_key)
        from public.navigation_items item
        where item.suit_id = suit.id and item.enabled
          and item.route_descriptor = '{}'::jsonb
          and item.visibility_policy in ('{}'::jsonb, '{"role":"owner"}'::jsonb)
          and (
            (item.module_kind in ('manual-transfer','payment-review') and item.required_capability_key='shop.billing.query' and item.required_capability_version='1.0' and super_admin_private.transfer_binding(suit.id) is not null) or (item.module_kind = 'overview' and item.required_capability_key is null)
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
-- Reuse signature verification/attempt receipts. No target tables or billing mutations here.
alter function public.super_admin_adapter_complete(uuid,jsonb) rename to adapter_complete_verified;
alter function public.adapter_complete_verified(uuid,jsonb) set schema super_admin_private;
revoke all on function super_admin_private.adapter_complete_verified(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.super_admin_adapter_complete(p_attempt_id uuid,p_response jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result_value jsonb; d public.adapter_dispatches; b public.suit_environment_bindings; action_value text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVER_REQUIRED' using errcode='42501'; end if;
  select dispatch.* into d from public.adapter_dispatches dispatch
    join public.adapter_attempts attempt on attempt.dispatch_id=dispatch.id where attempt.id=p_attempt_id;
  action_value:=d.envelope#>>'{payload,action}';
  result_value:=super_admin_private.adapter_complete_verified(p_attempt_id,p_response);
  if result_value ? 'code' or d.envelope->>'operation' <> 'shop.billing.command'
    or action_value not in ('mark_under_review','reject','approve') then return result_value; end if;
  if nullif(result_value->>'targetAuditId','') is null
    or result_value->'targetResultVersion' is distinct from '1'::jsonb
    or jsonb_typeof(result_value->'replayed') is distinct from 'boolean'
    or result_value#>>'{data,id}' is distinct from d.envelope#>>'{payload,submissionId}'
    or result_value#>>'{data,status}' is distinct from (case action_value when 'approve' then 'approved' when 'reject' then 'rejected' else 'under_review' end)
    or (action_value='approve' and (
      result_value#>>'{data,subscription,status}' is distinct from 'active'
      or nullif(result_value#>>'{data,subscription,id}','') is null
      or nullif(result_value#>>'{data,approved_subscription_end}','') is null
      or result_value#>>'{data,subscription,periodEnd}' is distinct from result_value#>>'{data,approved_subscription_end}')) then
    -- Target may have committed. Never turn an incomplete receipt into a new command.
    return '{"code":"outcome_unknown"}'::jsonb;
  end if;
  perform 1 from public.adapter_dispatches where id=d.id for update;
  select * into b from public.suit_environment_bindings where id=d.binding_id;
  insert into public.control_plane_events(request_id,correlation_id,actor_user_id,actor_role,authority_environment_id,suit_id,target_environment_id,
    action,target_type,target_id,reason,safe_parameters,before_state,after_state,result,request_fingerprint)
  values(d.request_id,d.correlation_id,d.actor_user_id,d.envelope#>>'{actor,roleSnapshot}',(d.envelope#>>'{actor,authorityBindingId}')::uuid,
    b.suit_id,b.target_environment_id,action_value,'payment-submission',(d.envelope#>>'{payload,submissionId}')::uuid,d.envelope->>'reason',
    jsonb_build_object('operation',d.envelope->>'operation','payloadDigest',d.body_digest),
    null,jsonb_build_object('status',result_value#>>'{data,status}'),
    jsonb_strip_nulls(jsonb_build_object('targetAuditId',result_value->>'targetAuditId','targetResultVersion',result_value->'targetResultVersion',
      'subscriptionId',result_value#>>'{data,subscription,id}','periodEnd',result_value#>>'{data,subscription,periodEnd}',
      'commercialPeriodId',result_value#>>'{data,commercialPeriodId}')),d.body_digest)
  on conflict(request_id) do nothing;
  return result_value;
end $$;
revoke all on function public.super_admin_adapter_complete(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.super_admin_adapter_complete(uuid,jsonb) to service_role;
