-- SAS-M1-CUSTOM-OFFER-001: Admin-owned immutable commercial versions.
-- No runtime/business configuration and no target-Suit identities are seeded.
create table public.custom_offer_versions (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null,
  version integer not null check (version > 0),
  binding_id uuid not null references public.suit_environment_bindings(id),
  suit_id uuid not null references public.suit_registry(id),
  authority_environment_id uuid not null references public.admin_environments(id),
  target_environment_id uuid not null references public.admin_environments(id),
  target_binding_id uuid not null,
  recipient_user_id uuid not null,
  company_id uuid not null,
  base_plan_id uuid not null,
  template_reference text,
  display_name text not null check(length(btrim(display_name)) between 1 and 80),
  price_amount numeric(12,2) not null check(price_amount > 0),
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  billing_interval text not null check(billing_interval in ('monthly','annual')),
  resource_limits jsonb not null check(jsonb_typeof(resource_limits)='object'),
  entitlements jsonb not null check(jsonb_typeof(entitlements)='object'),
  expires_at timestamptz not null check(isfinite(expires_at)),
  creator_user_id uuid not null references auth.users(id),
  reason text not null check(length(btrim(reason)) between 8 and 1000),
  request_id uuid not null unique,
  correlation_id uuid not null,
  request_fingerprint text not null,
  created_at timestamptz not null default clock_timestamp(),
  unique(definition_id,version)
);
create table public.custom_offer_revocations (
  offer_version_id uuid primary key references public.custom_offer_versions(id),
  creator_user_id uuid not null references auth.users(id),
  reason text not null check(length(btrim(reason)) between 8 and 1000),
  request_id uuid not null unique,
  correlation_id uuid not null,
  request_fingerprint text not null,
  created_at timestamptz not null default clock_timestamp()
);
do $$ declare t text; begin
  foreach t in array array['custom_offer_versions','custom_offer_revocations'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('create trigger %I before update or delete or truncate on public.%I for each statement execute function super_admin_private.reject_mutation()',t||'_immutable',t);
  end loop;
end $$;

create function super_admin_private.offer_snapshot(o public.custom_offer_versions)
returns jsonb language sql volatile set search_path='' as $$
  select jsonb_build_object('id',o.id,'definitionId',o.definition_id,'version',o.version,
    'bindingId',o.binding_id,'suitId',o.suit_id,'targetBindingId',o.target_binding_id,
    'targetEnvironmentId',o.target_environment_id,'recipientUserId',o.recipient_user_id,
    'companyId',o.company_id,'basePlanId',o.base_plan_id,'templateReference',o.template_reference,
    'displayName',o.display_name,'priceAmount',o.price_amount::text,'currency',o.currency,
    'billingInterval',o.billing_interval,'resourceLimits',o.resource_limits,'entitlements',o.entitlements,
    'expiresAt',o.expires_at,'creatorUserId',o.creator_user_id,'reason',o.reason,
    'requestId',o.request_id,'correlationId',o.correlation_id,'createdAt',o.created_at,
    'state',case when exists(select 1 from public.custom_offer_revocations r where r.offer_version_id=o.id)
      then 'revoked' when o.expires_at<=clock_timestamp() then 'expired' else 'saved' end);
$$;
revoke all on function super_admin_private.offer_snapshot(public.custom_offer_versions) from public,anon,authenticated,service_role;

create function public.super_admin_custom_offers_read(p_binding_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.platform_admins; cfg jsonb;
begin
  actor:=super_admin_private.assert_platform_owner();
  cfg:=super_admin_private.adapter_configuration(p_binding_id,'shop.billing.command',actor.user_id);
  return jsonb_build_object('versions',coalesce((select jsonb_agg(super_admin_private.offer_snapshot(o) order by o.created_at desc,o.id)
    from public.custom_offer_versions o where o.binding_id=p_binding_id and o.authority_environment_id=actor.authority_environment_id),'[]'::jsonb),
    'issuanceAvailable',false,'issuanceBlocker','SHOP_SECURE_REDEMPTION_CONTRACT_REQUIRED');
end $$;

create function public.super_admin_custom_offer_command(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.platform_admins; cfg jsonb; o public.custom_offer_versions; prior public.control_plane_events;
  payload jsonb; fingerprint text; before_value jsonb; after_value jsonb; definition uuid; last_version integer;
  request uuid; correlation uuid; binding uuid; expires timestamptz; amount numeric; entry record;
begin
  actor:=super_admin_private.assert_platform_owner();
  if p_input is null or jsonb_typeof(p_input) is distinct from 'object' or
    not (p_input ?& array['action','bindingId','requestId','correlationId','reason','payload']) then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
  perform super_admin_private.assert_payload_keys(p_input,array['action','bindingId','requestId','correlationId','reason','payload']);
  request:=(p_input->>'requestId')::uuid; correlation:=(p_input->>'correlationId')::uuid; binding:=(p_input->>'bindingId')::uuid;
  if request is null or correlation is null or binding is null or length(btrim(p_input->>'reason')) not between 8 and 1000 or p_input->>'reason' is null then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
  cfg:=super_admin_private.adapter_configuration(binding,'shop.billing.command',actor.user_id);
  fingerprint:=encode(extensions.digest(convert_to(p_input::text,'UTF8'),'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(request::text,0));
  select * into prior from public.control_plane_events where request_id=request;
  if prior.id is not null then
    if prior.request_fingerprint<>fingerprint or prior.actor_user_id<>actor.user_id then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
    return prior.result;
  end if;
  payload:=p_input->'payload';
  if payload is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
  if p_input->>'action'='save' then
    perform super_admin_private.assert_payload_keys(payload,array['definitionId','expectedVersion','recipientUserId','companyId','basePlanId','templateReference','displayName','priceAmount','currency','billingInterval','resourceLimits','entitlements','expiresAt']);
    if not (payload ?& array['definitionId','expectedVersion','recipientUserId','companyId','basePlanId','displayName','priceAmount','currency','billingInterval','resourceLimits','entitlements','expiresAt'])
      or exists(select 1 from jsonb_each(payload) e where e.key<>'templateReference' and e.value='null'::jsonb)
      or octet_length(payload::text)>8192
      or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or (payload->>'expectedVersion') !~ '^[0-9]+$'
      or jsonb_typeof(payload->'priceAmount') is distinct from 'string' or (payload->>'priceAmount') !~ '^[0-9]{1,10}(\.[0-9]{1,2})?$'
      or jsonb_typeof(payload->'resourceLimits') is distinct from 'object' or jsonb_typeof(payload->'entitlements') is distinct from 'object'
      or not ((payload->'resourceLimits') ?& array['active_locations','active_members','active_products','active_services','active_customers','active_suppliers'])
      or ((payload->'resourceLimits')-array['active_locations','active_members','active_products','active_services','active_customers','active_suppliers'])<>'{}'::jsonb
      or jsonb_typeof(payload->'displayName') is distinct from 'string'
      or jsonb_typeof(payload->'currency') is distinct from 'string' or (payload->>'currency') !~ '^[A-Z]{3}$'
      or jsonb_typeof(payload->'billingInterval') is distinct from 'string' or (payload->>'billingInterval') not in ('monthly','annual')
      or length(btrim(payload->>'displayName')) not between 1 and 80
      or (payload ? 'templateReference' and payload->'templateReference'<>'null'::jsonb and (jsonb_typeof(payload->'templateReference') is distinct from 'string' or length(payload->>'templateReference')>500)) then
      raise exception 'INVALID_REQUEST' using errcode='22023';
    end if;
    for entry in select * from jsonb_each(payload->'resourceLimits') loop
      if entry.value<>'null'::jsonb and (jsonb_typeof(entry.value) is distinct from 'number' or entry.value::text !~ '^[0-9]+$' or entry.value::text::numeric>2147483647) then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
    end loop;
    amount:=(payload->>'priceAmount')::numeric; expires:=(payload->>'expiresAt')::timestamptz;
    if amount<=0 or amount>9999999999.99 or not isfinite(expires) or expires<=clock_timestamp() then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
    definition:=(payload->>'definitionId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended(definition::text,1));
    select * into o from public.custom_offer_versions where definition_id=definition order by version desc limit 1;
    last_version:=coalesce(o.version,0);
    if last_version<>(payload->>'expectedVersion')::integer then raise exception 'VERSION_CONFLICT' using errcode='22023'; end if;
    if o.id is not null and (o.binding_id<>binding or o.recipient_user_id<>(payload->>'recipientUserId')::uuid or o.company_id<>(payload->>'companyId')::uuid) then raise exception 'OFFER_BINDING_MISMATCH' using errcode='42501'; end if;
    before_value:=case when o.id is not null then super_admin_private.offer_snapshot(o) end;
    insert into public.custom_offer_versions(definition_id,version,binding_id,suit_id,authority_environment_id,target_environment_id,target_binding_id,
      recipient_user_id,company_id,base_plan_id,template_reference,display_name,price_amount,currency,billing_interval,resource_limits,entitlements,expires_at,
      creator_user_id,reason,request_id,correlation_id,request_fingerprint)
    values(definition,last_version+1,binding,(cfg#>>'{binding,suit_id}')::uuid,actor.authority_environment_id,(cfg#>>'{binding,target_environment_id}')::uuid,
      (cfg#>>'{settings,targetBindingId}')::uuid,(payload->>'recipientUserId')::uuid,(payload->>'companyId')::uuid,(payload->>'basePlanId')::uuid,
      payload->>'templateReference',btrim(payload->>'displayName'),amount,payload->>'currency',payload->>'billingInterval',payload->'resourceLimits',payload->'entitlements',expires,
      actor.user_id,btrim(p_input->>'reason'),request,correlation,fingerprint) returning * into o;
  elsif p_input->>'action' in ('revoke','issue') then
    perform super_admin_private.assert_payload_keys(payload,array['offerVersionId']);
    select * into o from public.custom_offer_versions where id=(payload->>'offerVersionId')::uuid for update;
    if o.id is null or o.binding_id<>binding or o.authority_environment_id<>actor.authority_environment_id then raise exception 'OFFER_BINDING_MISMATCH' using errcode='42501'; end if;
    before_value:=super_admin_private.offer_snapshot(o);
    if p_input->>'action'='issue' then
      if before_value->>'state'<>'saved' then raise exception 'OFFER_UNAVAILABLE' using errcode='22023'; end if;
      -- The target currently has no opaque-link exchange or revocation command.
      -- Never register an irrevocable offer or emit a UUID-based customer link.
      raise exception 'SHOP_SECURE_REDEMPTION_CONTRACT_REQUIRED' using errcode='22023';
    end if;
    if exists(select 1 from public.custom_offer_revocations where offer_version_id=o.id) then raise exception 'OFFER_UNAVAILABLE' using errcode='22023'; end if;
    insert into public.custom_offer_revocations(offer_version_id,creator_user_id,reason,request_id,correlation_id,request_fingerprint)
      values(o.id,actor.user_id,btrim(p_input->>'reason'),request,correlation,fingerprint);
  else raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
  after_value:=super_admin_private.offer_snapshot(o);
  insert into public.control_plane_events(request_id,correlation_id,actor_user_id,actor_role,authority_environment_id,suit_id,target_environment_id,
    action,target_type,target_id,reason,before_state,after_state,result,request_fingerprint)
  values(request,correlation,actor.user_id,actor.role,actor.authority_environment_id,o.suit_id,o.target_environment_id,
    'custom-offer-'||(p_input->>'action'),'custom-offer-version',o.id,btrim(p_input->>'reason'),before_value,after_value,jsonb_build_object('offer',after_value),fingerprint);
  return jsonb_build_object('offer',after_value);
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
  raise exception 'INVALID_REQUEST' using errcode='22023';
end $$;
revoke all on function public.super_admin_custom_offers_read(uuid),public.super_admin_custom_offer_command(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.super_admin_custom_offers_read(uuid),public.super_admin_custom_offer_command(jsonb) to authenticated;

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
          'description', item.description, 'module', item.module_kind, 'bindingId', case when item.module_kind in ('manual-transfer','custom-offers') then super_admin_private.transfer_binding(suit.id) else null end
        ) order by item.sort_order, item.stable_key)
        from public.navigation_items item
        where item.suit_id = suit.id and item.enabled
          and item.route_descriptor = '{}'::jsonb
          and item.visibility_policy in ('{}'::jsonb, '{"role":"owner"}'::jsonb)
          and (
            (item.module_kind in ('manual-transfer','custom-offers') and item.required_capability_key='shop.billing.query' and item.required_capability_version='1.0' and super_admin_private.transfer_binding(suit.id) is not null) or (item.module_kind = 'overview' and item.required_capability_key is null)
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

notify pgrst, 'reload schema';
