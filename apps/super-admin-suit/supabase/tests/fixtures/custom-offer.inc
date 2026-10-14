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
create temporary table offer_input as select jsonb_build_object(
 'action','save','bindingId',binding_id,'requestId',request_id,'correlationId',correlation_id,
 'reason','Synthetic negotiated offer','payload',jsonb_build_object(
 'definitionId',gen_random_uuid(),'expectedVersion',0,'recipientUserId',gen_random_uuid(),
 'companyId',gen_random_uuid(),'basePlanId',gen_random_uuid(),'templateReference','Synthetic template',
 'displayName','Synthetic offer','priceAmount','123.45','currency','EGP','billingInterval','monthly',
 'resourceLimits','{"active_locations":1,"active_members":2,"active_products":null,"active_services":3,"active_customers":4,"active_suppliers":5}'::jsonb,
 'entitlements','{"synthetic_feature":true}'::jsonb,'expiresAt',now()+interval '1 hour')) value from adapter_fixture;
grant select, update on offer_input to authenticated;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true) from adapter_fixture;
