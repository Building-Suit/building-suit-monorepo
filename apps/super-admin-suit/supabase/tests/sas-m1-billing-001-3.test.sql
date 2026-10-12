-- Only Admin-side no-side-effect checks. This database cannot prove preservation of Shop business rows.
begin;
select plan(4);
create temporary table adapter_fixture as select gen_random_uuid() owner_id, gen_random_uuid() outsider_id,
 gen_random_uuid() environment_id, gen_random_uuid() target_id, gen_random_uuid() suit_id,
 gen_random_uuid() binding_id, gen_random_uuid() registration_id, gen_random_uuid() provider_id,
 gen_random_uuid() secret_id, gen_random_uuid() request_id, gen_random_uuid() correlation_id;
grant select on adapter_fixture to authenticated, service_role;
insert into auth.users(id,email,encrypted_password,aud,role,created_at,updated_at)
 select id,id::text||'@adapter.invalid','x','authenticated','authenticated',now(),now()
 from (select owner_id id from adapter_fixture union all select outsider_id from adapter_fixture) u;
insert into public.admin_environments(id,stable_key,environment_kind,display_name,status)
 select environment_id,'adapter-source','staging','{"en":"Source"}'::jsonb,'active' from adapter_fixture
 union all select target_id,'adapter-target','staging','{"en":"Target"}'::jsonb,'active' from adapter_fixture;
insert into public.platform_admins(user_id,authority_environment_id,provisioned_by)
 select owner_id,environment_id,owner_id from adapter_fixture;
insert into public.suit_registry(id,stable_key,display_name,asset_reference,adapter_contract_version,status)
 select suit_id,'adapter-fixture','{"en":"Fixture"}','/brand/fixture.svg','1.0','active' from adapter_fixture;
insert into public.suit_environment_bindings(id,suit_id,admin_environment_id,target_environment_id,adapter_base_url,audience,target_identity_fingerprint,egress_policy,status)
 select binding_id,suit_id,environment_id,target_id,'https://bridge.example.invalid','fixture-audience','fixture-identity-fingerprint','{"allowedHosts":["bridge.example.invalid"]}','active' from adapter_fixture;
insert into public.adapter_registrations(id,binding_id,adapter_key,protocol_min_version,protocol_max_version,manifest_schema_version,manifest_max_age_seconds,status)
 select registration_id,binding_id,'fixture-bridge','1.0','1.0','1.0',3600,'active' from adapter_fixture;
insert into public.adapter_capability_policy(adapter_registration_id,capability_key,min_version,max_version,command_scopes,enabled)
 select registration_id,'shop.billing.command','1.0','1.0',array['shop.billing.command'],true from adapter_fixture;
insert into public.adapter_manifest_observations(binding_id,manifest_revision,manifest_digest,protocol_versions,verified_capabilities,verification_outcome,expires_at)
 select binding_id,'fixture-v1',repeat('a',64),array['1.0'],'[{"operation":"shop.billing.command","version":"1.0"}]','verified',now()+interval '1 hour' from adapter_fixture;
insert into public.integration_providers(id,stable_key,display_name,provider_kind,configuration_schema_version,status)
 select provider_id,'adapter-fixture','{"en":"Fixture"}','adapter','1.0','active' from adapter_fixture;
insert into public.integration_settings(provider_id,binding_id,setting_key,value_type,non_secret_value,schema_version,effective_from,status)
 select provider_id,binding_id,'adapter-dispatch-policy','object',jsonb_build_object('targetBindingId',binding_id,'timeoutMs',1000,'maxResponseBytes',4096),'1.0',now()-interval '1 minute','active' from adapter_fixture;
insert into public.integration_secret_references(id,provider_id,binding_id,purpose,key_id,key_version,vault_secret_id,valid_from,status)
 select secret_id,provider_id,binding_id,'adapter-signing','fixture-key',1,
 vault.create_secret('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),now()-interval '1 minute','active' from adapter_fixture;
insert into public.adapter_capability_policy(adapter_registration_id,capability_key,min_version,max_version,query_scopes,enabled)
 select registration_id,'shop.billing.query','1.0','1.0',array['shop.billing.query'],true from adapter_fixture;
insert into public.adapter_manifest_observations(binding_id,manifest_revision,manifest_digest,protocol_versions,verified_capabilities,verification_outcome,expires_at)
 select binding_id,'billing-fixture',repeat('b',64),array['1.0'],'[{"operation":"shop.billing.command","version":"1.0"},{"operation":"shop.billing.query","version":"1.0"}]','verified',now()+interval '1 hour' from adapter_fixture;
create temporary table adapter_input as select jsonb_build_object('bindingId',binding_id,'operation','shop.billing.command',
 'requestId',request_id,'correlationId',correlation_id,'reason','Synthetic verified transfer','payload',jsonb_build_object('action','approve','submissionId',target_id,
 'payload',jsonb_build_object('receivedAmount',120,'receivedReference','Synthetic reference','receivedDate',current_date))) value from adapter_fixture;
grant select on adapter_input to authenticated;
create function pg_temp.wire(p_attempt jsonb,p_data jsonb,p_error text default null,p_replayed boolean default false)
returns jsonb language plpgsql as $$
declare a public.adapter_attempts; d public.adapter_dispatches; body text; digest_value text; status_value text;
begin
 select * into a from public.adapter_attempts where id=(p_attempt->>'attemptId')::uuid;
 select * into d from public.adapter_dispatches where id=a.dispatch_id;
 status_value:=case when p_error is null then '200' else '409' end;
 body:=(jsonb_build_object('protocolVersion','1.0','requestId',d.request_id,'correlationId',d.correlation_id,
 'targetBindingId',d.envelope->'targetBindingId','operation',d.envelope->'operation','operationVersion','1.0',
 'requestDigest',d.body_digest) || case when p_error is null then jsonb_build_object('data',p_data,'targetAuditId',(select suit_id from adapter_fixture),'targetResultVersion',1,'replayed',p_replayed)
 else jsonb_build_object('error',jsonb_build_object('code',p_error)) end)::text;
 digest_value:=encode(extensions.digest(convert_to(body,'UTF8'),'sha256'),'hex');
 return jsonb_build_object('status',status_value::integer,'body',body,'algorithm','BS-S2S-RESPONSE-HMAC-SHA256','protocolVersion','1.0','keyId',a.key_id,'digest',digest_value,
 'signature',super_admin_private.adapter_mac(array_to_string(array['BS-S2S-RESPONSE-HMAC-SHA256','1.0',a.key_id,d.request_id::text,d.correlation_id::text,
 d.envelope->>'sourceBindingId',d.envelope->>'targetBindingId',d.envelope->>'targetEnvironmentId',d.audience,status_value,d.body_digest,digest_value],E'\n'),super_admin_private.adapter_key(a.secret_reference_id)));
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true) from adapter_fixture;
select public.super_admin_adapter_enqueue(value) from adapter_input;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
create temporary table attempt as select public.super_admin_adapter_claim(id) value from public.adapter_dispatches where request_id=(select request_id from adapter_fixture);
create temporary table before_state as select to_jsonb(b) value from public.suit_environment_bindings b;
select is((select public.super_admin_adapter_complete((value->>'attemptId')::uuid,pg_temp.wire(value,null,'plan_change_blocked'))->>'code' from attempt),'target_rejected','signed quota blocker never confirms activation');
select is((select count(*)::integer from public.control_plane_events where request_id=(select request_id from adapter_fixture)),0,'no activation audit');
select results_eq('select to_jsonb(b) from public.suit_environment_bindings b','select value from before_state','binding configuration preserved');
select is((select count(*)::integer from public.adapter_attempt_results where outcome='target_rejected' and attempt_id=(select (value->>'attemptId')::uuid from attempt)),1,'denial receipt retained');
select * from finish(); rollback;
