-- Existing SAS owner and signed adapter authority; no target database access.
create table public.custom_offer_dispatches(
 dispatch_id uuid primary key references public.adapter_dispatches(id),
 offer_version_id uuid not null references public.custom_offer_versions(id),
 action text not null check(action in ('issue','revoke')),
 request_id uuid not null unique,created_at timestamptz not null default clock_timestamp()
);
create table public.custom_offer_target_receipts(
 dispatch_id uuid primary key references public.custom_offer_dispatches(dispatch_id),
 state text not null check(state in ('issued','revoked')),
 redemption_token text check(redemption_token ~ '^[A-Za-z0-9_-]{43}$'),
 target_audit_id text not null,created_at timestamptz not null default clock_timestamp()
);
do $$ declare t text;begin
 foreach t in array array['custom_offer_dispatches','custom_offer_target_receipts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger %I before update or delete or truncate on public.%I for each statement execute function super_admin_private.reject_mutation()',t||'_immutable',t);
 end loop;
end $$;
alter function super_admin_private.offer_snapshot(public.custom_offer_versions) rename to offer_snapshot_before_dispatch;
create function super_admin_private.offer_snapshot(o public.custom_offer_versions)
returns jsonb language sql stable security definer set search_path='' as $$
 select super_admin_private.offer_snapshot_before_dispatch(o)||jsonb_build_object('state',case
 when super_admin_private.offer_snapshot_before_dispatch(o)->>'state'='revoked' or exists(select 1 from public.custom_offer_target_receipts r join public.custom_offer_dispatches d using(dispatch_id) where d.offer_version_id=o.id and r.state='revoked') then 'revoked'
 when o.expires_at<=statement_timestamp() then 'expired'
 when exists(select 1 from public.custom_offer_target_receipts r join public.custom_offer_dispatches d using(dispatch_id) where d.offer_version_id=o.id and r.state='issued') then 'issued'
 else super_admin_private.offer_snapshot_before_dispatch(o)->>'state' end)
$$;
revoke all on function super_admin_private.offer_snapshot(public.custom_offer_versions),super_admin_private.offer_snapshot_before_dispatch(public.custom_offer_versions) from public,anon,authenticated,service_role;
create function super_admin_private.secure_offer_available(cfg jsonb)
returns boolean language sql immutable set search_path='' as $$
 select exists(select 1 from jsonb_array_elements(cfg#>'{manifest,verified_capabilities}') c
 where c->>'operation'='shop.billing.command' and c->>'version'='1.0'
 and c->'members' @> '["register_secure_private_offer","revoke_secure_private_offer"]'::jsonb)
$$;
revoke all on function super_admin_private.secure_offer_available(jsonb) from public,anon,authenticated,service_role;
-- Customer origin is non-secret, binding-owned configuration, never a source default.
create function super_admin_private.custom_offer_origin(p_binding uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare origin text;settings integer;
begin
 select count(*),min(non_secret_value#>>'{}') into settings,origin from public.integration_settings
 where binding_id=p_binding and setting_key='customer-offer-origin' and value_type='string'
 and status='active' and effective_from<=statement_timestamp()
 and (effective_until is null or effective_until>statement_timestamp());
 if settings<>1 or origin !~ '^https://[a-z0-9]+([-.][a-z0-9]+)*(:443)?$' then return null;end if;
 return origin;
end $$;
revoke all on function super_admin_private.custom_offer_origin(uuid) from public,anon,authenticated,service_role;
create function super_admin_private.custom_offer_link(o public.custom_offer_versions)
returns text language plpgsql stable security definer set search_path='' as $$
declare origin text;token text;
begin
 if super_admin_private.offer_snapshot(o)->>'state'<>'issued' then return null;end if;
 origin:=super_admin_private.custom_offer_origin(o.binding_id);
 if origin is null then return null;end if;
 select r.redemption_token into token from public.custom_offer_target_receipts r
 join public.custom_offer_dispatches d using(dispatch_id)
 where d.offer_version_id=o.id and d.action='issue' and r.state='issued';
 if token is null then return null;end if;
 return origin||'/billing#offer='||o.id::text||'&version='||o.version::text
 ||'&binding='||o.target_binding_id::text||'&environment='||o.target_environment_id::text||'&token='||token;
end $$;
revoke all on function super_admin_private.custom_offer_link(public.custom_offer_versions) from public,anon,authenticated,service_role;
create or replace function public.super_admin_custom_offers_read(p_binding_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor public.platform_admins;cfg jsonb;
begin
 actor:=super_admin_private.assert_platform_owner();
 cfg:=super_admin_private.adapter_configuration(p_binding_id,'shop.billing.command',actor.user_id);
 return jsonb_build_object('versions',coalesce((select jsonb_agg(super_admin_private.offer_snapshot(o)||jsonb_build_object('customerLink',super_admin_private.custom_offer_link(o)) order by o.created_at desc,o.id)
 from public.custom_offer_versions o where o.binding_id=p_binding_id and o.authority_environment_id=actor.authority_environment_id),'[]'::jsonb),
 'issuanceAvailable',super_admin_private.secure_offer_available(cfg) and super_admin_private.custom_offer_origin(p_binding_id) is not null,
 'issuanceBlocker',case when not super_admin_private.secure_offer_available(cfg) then 'SHOP_SECURE_REDEMPTION_CONTRACT_REQUIRED' when super_admin_private.custom_offer_origin(p_binding_id) is null then 'CUSTOMER_ORIGIN_REQUIRED' else null end);
end $$;
alter function public.super_admin_custom_offer_command(jsonb) rename to custom_offer_command_before_dispatch;
alter function public.custom_offer_command_before_dispatch(jsonb) set schema super_admin_private;
revoke all on function super_admin_private.custom_offer_command_before_dispatch(jsonb) from public,anon,authenticated,service_role;
create function public.super_admin_custom_offer_command(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.platform_admins;cfg jsonb;o public.custom_offer_versions;domain jsonb;input jsonb;
 dispatch uuid; prior public.custom_offer_dispatches; receipt public.custom_offer_target_receipts;
begin
 if p_input->>'action' not in ('issue','revoke') then return super_admin_private.custom_offer_command_before_dispatch(p_input);end if;
 actor:=super_admin_private.assert_platform_owner();
 perform super_admin_private.assert_payload_keys(p_input,array['action','bindingId','requestId','correlationId','reason','payload']);
 perform super_admin_private.assert_payload_keys(p_input->'payload',array['offerVersionId']);
 select * into o from public.custom_offer_versions where id=(p_input#>>'{payload,offerVersionId}')::uuid for update;
 if o.id is null or o.binding_id is distinct from (p_input->>'bindingId')::uuid or o.authority_environment_id<>actor.authority_environment_id then
 raise exception 'OFFER_BINDING_MISMATCH' using errcode='42501';end if;
 if p_input->>'action'='revoke' and not exists(select 1 from public.custom_offer_dispatches where offer_version_id=o.id and action='issue') then
 return super_admin_private.custom_offer_command_before_dispatch(p_input);end if;
 cfg:=super_admin_private.adapter_configuration(o.binding_id,'shop.billing.command',actor.user_id);
 if not coalesce(super_admin_private.secure_offer_available(cfg),false) then raise exception 'SHOP_SECURE_REDEMPTION_CONTRACT_REQUIRED' using errcode='22023';end if;
 if p_input->>'action'='issue' and super_admin_private.custom_offer_origin(o.binding_id) is null then raise exception 'CUSTOMER_ORIGIN_REQUIRED' using errcode='22023';end if;
 select * into prior from public.custom_offer_dispatches where request_id=(p_input->>'requestId')::uuid;
 if prior.dispatch_id is null and (o.expires_at<=clock_timestamp() or super_admin_private.offer_snapshot(o)->>'state'='revoked') then
 raise exception 'OFFER_UNAVAILABLE' using errcode='22023';end if;
 if prior.dispatch_id is null and p_input->>'action'='issue' and exists(select 1 from public.custom_offer_dispatches where offer_version_id=o.id and action='issue') then
 raise exception 'OFFER_ISSUANCE_ALREADY_REQUESTED' using errcode='22023';end if;
 if prior.dispatch_id is null and p_input->>'action'='revoke' and not exists(select 1 from public.custom_offer_target_receipts r join public.custom_offer_dispatches d using(dispatch_id) where d.offer_version_id=o.id and r.state='issued') then
 raise exception 'OFFER_ISSUANCE_UNCONFIRMED' using errcode='22023';end if;
 if p_input->>'action'='issue' then
 domain:=jsonb_build_object('offerId',o.id,'offerVersion',o.version,'shopId',o.company_id,'recipientUserId',o.recipient_user_id,
 'targetBindingId',o.target_binding_id,'targetEnvironmentId',o.target_environment_id,'suit','shop-suit',
 'expiresAt',o.expires_at,'planId',o.base_plan_id,'displayName',o.display_name,'billingInterval',o.billing_interval,
 'currency',o.currency,'priceAmount',o.price_amount,'resourceLimits',o.resource_limits,'entitlements',o.entitlements);
 else domain:=jsonb_build_object('offerId',o.id,'offerVersion',o.version,'targetBindingId',o.target_binding_id,'targetEnvironmentId',o.target_environment_id);end if;
 input:=jsonb_build_object('bindingId',o.binding_id,'operation','shop.billing.command','requestId',p_input->'requestId',
 'correlationId',p_input->'correlationId','reason',p_input->'reason','payload',jsonb_build_object('action',case p_input->>'action' when 'issue' then 'register_secure_private_offer' else 'revoke_secure_private_offer' end,'payload',domain));
 dispatch:=public.super_admin_adapter_enqueue(input);
 insert into public.custom_offer_dispatches(dispatch_id,offer_version_id,action,request_id) values(dispatch,o.id,p_input->>'action',(p_input->>'requestId')::uuid) on conflict(dispatch_id) do nothing;
 select * into receipt from public.custom_offer_target_receipts where dispatch_id=dispatch;
 return jsonb_build_object('offer',super_admin_private.offer_snapshot(o),'dispatchId',dispatch,'dispatchInput',input,
 'redemptionToken',receipt.redemption_token,'targetState',receipt.state,'customerLink',super_admin_private.custom_offer_link(o));
end $$;
revoke all on function public.super_admin_custom_offer_command(jsonb) from public,anon,service_role;
grant execute on function public.super_admin_custom_offer_command(jsonb) to authenticated;
alter function public.super_admin_adapter_complete(uuid,jsonb) rename to adapter_complete_before_secure_offers;
alter function public.adapter_complete_before_secure_offers(uuid,jsonb) set schema super_admin_private;
revoke all on function super_admin_private.adapter_complete_before_secure_offers(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.super_admin_adapter_complete(p_attempt_id uuid,p_response jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;d public.custom_offer_dispatches;o public.custom_offer_versions;payload jsonb; prior public.custom_offer_target_receipts;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVER_REQUIRED' using errcode='42501';end if;
 result:=super_admin_private.adapter_complete_before_secure_offers(p_attempt_id,p_response);
 if result ? 'code' then return result;end if;
 select c.* into d from public.custom_offer_dispatches c join public.adapter_attempts a on a.dispatch_id=c.dispatch_id where a.id=p_attempt_id;
 if d.dispatch_id is null then return result;end if;
 select * into o from public.custom_offer_versions where id=d.offer_version_id;
 payload:=result->'data';
 if payload->>'offerId' is distinct from o.id::text or (payload->>'offerVersion')::integer is distinct from o.version
 or payload->>'targetBindingId' is distinct from o.target_binding_id::text or payload->>'targetEnvironmentId' is distinct from o.target_environment_id::text
 or nullif(result->>'targetAuditId','') is null or result->'targetResultVersion' is distinct from '1'::jsonb
 or payload->>'state' is distinct from (case d.action when 'issue' then 'issued' else 'revoked' end)
 or (d.action='issue' and (payload->>'redemptionToken' is null or payload->>'redemptionToken' !~ '^[A-Za-z0-9_-]{43}$'
 or payload->'entitlements' is distinct from o.entitlements or payload->>'shopId' is distinct from o.company_id::text
 or (payload->>'expiresAt')::timestamptz is distinct from o.expires_at)) then
 raise exception 'CUSTOM_OFFER_TARGET_RESULT_MISMATCH' using errcode='23514';end if;
 select * into prior from public.custom_offer_target_receipts where dispatch_id=d.dispatch_id;
 if prior.dispatch_id is not null and (prior.state is distinct from payload->>'state'
 or prior.redemption_token is distinct from (case when d.action='issue' then payload->>'redemptionToken' else null end)
 or prior.target_audit_id is distinct from result->>'targetAuditId') then
 raise exception 'CUSTOM_OFFER_TARGET_RECEIPT_CHANGED' using errcode='23514';end if;
 insert into public.custom_offer_target_receipts(dispatch_id,state,redemption_token,target_audit_id)
 values(d.dispatch_id,payload->>'state',case when d.action='issue' then payload->>'redemptionToken' else null end,result->>'targetAuditId') on conflict(dispatch_id) do nothing;
 return result;
end $$;
revoke all on function public.super_admin_adapter_complete(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.super_admin_adapter_complete(uuid,jsonb) to service_role;
notify pgrst,'reload schema';
