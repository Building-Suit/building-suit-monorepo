-- Disposable synthetic fixtures only. Never execute against a hosted business database.
begin;
select plan(15);
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
insert into public.adapter_capability_policy(adapter_registration_id,capability_key,min_version,max_version,query_scopes,enabled)
 select registration_id,'shop.platform.query','1.0','1.0',array['shop.platform.query'],true from adapter_fixture;
insert into public.adapter_manifest_observations(binding_id,manifest_revision,manifest_digest,protocol_versions,verified_capabilities,verification_outcome,expires_at)
 select binding_id,'fixture-v1',repeat('a',64),array['1.0'],'[{"operation":"shop.platform.query","version":"1.0"}]','verified',now()+interval '1 hour' from adapter_fixture;
insert into public.integration_providers(id,stable_key,display_name,provider_kind,configuration_schema_version,status)
 select provider_id,'adapter-fixture','{"en":"Fixture"}','adapter','1.0','active' from adapter_fixture;
insert into public.integration_settings(provider_id,binding_id,setting_key,value_type,non_secret_value,schema_version,effective_from,status)
 select provider_id,binding_id,'adapter-dispatch-policy','object',jsonb_build_object('targetBindingId',binding_id,'timeoutMs',1000,'maxResponseBytes',4096),'1.0',now()-interval '1 minute','active' from adapter_fixture;
insert into public.integration_secret_references(id,provider_id,binding_id,purpose,key_id,key_version,vault_secret_id,valid_from,status)
 select secret_id,provider_id,binding_id,'adapter-signing','fixture-key',1,
 vault.create_secret('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),now()-interval '1 minute','active' from adapter_fixture;
create temporary table adapter_input as select jsonb_build_object('bindingId',binding_id,'operation','shop.platform.query',
 'requestId',request_id,'correlationId',correlation_id,'reason',null,'payload',jsonb_build_object('resource','dashboard')) value from adapter_fixture;
grant select on adapter_input to authenticated;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',outsider_id,'role','authenticated')::text,true) from adapter_fixture;
select throws_ok('select public.super_admin_adapter_enqueue(value) from adapter_input','42501','PLATFORM_OWNER_REQUIRED','outsider denied');
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true) from adapter_fixture;
select lives_ok('select public.super_admin_adapter_enqueue(value) from adapter_input','configured owner enqueues');
select throws_ok('select public.super_admin_adapter_claim(gen_random_uuid())','42501',null,'browser cannot use signer');
select throws_ok('select * from public.adapter_dispatches','42501',null,'browser cannot read protected dispatch');
reset role;
select is((select envelope#>>'{actor,subjectId}' from public.adapter_dispatches where request_id=(select request_id from adapter_fixture)),(select owner_id::text from adapter_fixture),'actor frozen from database');
update public.adapter_capability_policy set enabled=false where adapter_registration_id=(select registration_id from adapter_fixture);
select throws_ok(format('select super_admin_private.adapter_configuration(%L,%L,%L)',binding_id,'shop.platform.query',owner_id),'P0001','CAPABILITY_UNAVAILABLE','disabled policy refused') from adapter_fixture;
update public.adapter_capability_policy set enabled=true,max_version='2.0' where adapter_registration_id=(select registration_id from adapter_fixture);
select throws_ok(format('select super_admin_private.adapter_configuration(%L,%L,%L)',binding_id,'shop.platform.query',owner_id),'P0001','CAPABILITY_UNAVAILABLE','wrong version refused') from adapter_fixture;
update public.adapter_capability_policy set max_version='1.0' where adapter_registration_id=(select registration_id from adapter_fixture);
update public.admin_environments set environment_kind='production' where id=(select target_id from adapter_fixture);
select throws_ok(format('select super_admin_private.adapter_configuration(%L,%L,%L)',binding_id,'shop.platform.query',owner_id),'42501','ENVIRONMENT_MISMATCH','wrong environment refused') from adapter_fixture;
update public.admin_environments set environment_kind='staging' where id=(select target_id from adapter_fixture);
select throws_ok(format('select super_admin_private.adapter_configuration(%L,%L,%L)',binding_id,'shop.plan.command',owner_id),'P0001','CAPABILITY_UNAVAILABLE','missing capability refused') from adapter_fixture;
set local role authenticated;
select is((select public.super_admin_adapter_enqueue(value)::text from adapter_input),(select public.super_admin_adapter_enqueue(value)::text from adapter_input),'exact retry keeps dispatch');
select throws_ok('select public.super_admin_adapter_enqueue(value||''{"payload":{"resource":"shops"}}'') from adapter_input','P0001','IDEMPOTENCY_KEY_REUSED','changed payload refuses request reuse');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
create temporary table signed_attempt as select public.super_admin_adapter_claim(id) value from public.adapter_dispatches where request_id=(select request_id from adapter_fixture);
select ok((select value#>>'{headers,x-bs-signature}' ~ '^[A-Za-z0-9_-]{43}$' from signed_attempt),'restricted signer supplies protocol HMAC');
select ok((select not (value::text like '%AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA%') from signed_attempt),'signer never returns plaintext key');
select is((select public.super_admin_adapter_complete((value->>'attemptId')::uuid,'{"status":200,"body":"private SQL","signature":"tampered"}') ->> 'code' from signed_attempt),'outcome_unknown','tampered response remains ambiguous');
select is((select outcome from public.adapter_attempt_results where attempt_id=(select (value->>'attemptId')::uuid from signed_attempt)),'outcome_unknown','safe immutable attempt result recorded');
select * from finish();
rollback;
