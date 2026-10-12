-- Disposable synthetic fixtures only. Never execute against a hosted business database.
begin;
select plan(12);
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
create temporary table adapter_input as select jsonb_build_object('bindingId',binding_id,'operation','shop.billing.command',
 'requestId',request_id,'correlationId',correlation_id,'reason','Synthetic configuration change','payload',jsonb_build_object('action','configure-manual-transfer','expectedVersion',1,'configuration','{"version":1,"enabled":true,"recipientAlias":"Synthetic new recipient","recipientDetails":"Synthetic new details","instructions":{"en":"New instructions","ar":"تعليمات جديدة"},"paymentLink":"https://example.invalid/share","qr":{"assetUrl":"https://example.invalid/qr.png","alt":{"en":"Synthetic QR","ar":"رمز اختبار"}}}'::jsonb)) value from adapter_fixture;
grant select on adapter_input to authenticated;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',outsider_id,'role','authenticated')::text,true) from adapter_fixture;
select throws_ok('select public.super_admin_adapter_enqueue(value) from adapter_input','42501','PLATFORM_OWNER_REQUIRED','outsider denied');
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true) from adapter_fixture;
select lives_ok('select public.super_admin_adapter_enqueue(value) from adapter_input','owner enqueues');
select is((select public.super_admin_adapter_enqueue(value)::text from adapter_input),(select public.super_admin_adapter_enqueue(value)::text from adapter_input),'retry preserves dispatch');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
create temporary table signed_attempt as select public.super_admin_adapter_claim(id) value from public.adapter_dispatches where request_id=(select request_id from adapter_fixture);
select is((select public.super_admin_adapter_complete((value->>'attemptId')::uuid,null)->>'code' from signed_attempt),'outcome_unknown','lost response never confirms save');
select is((select count(*)::integer from public.control_plane_events where request_id=(select request_id from adapter_fixture)),0,'no success audit on lost response');
truncate table signed_attempt;
insert into signed_attempt select public.super_admin_adapter_claim(id) from public.adapter_dispatches where request_id=(select request_id from adapter_fixture);
create temporary table evidence as select
 '{"version":1,"enabled":false,"recipientAlias":"Synthetic old recipient","recipientDetails":"Synthetic old details","instructions":{"en":"Old instructions","ar":"تعليمات قديمة"},"paymentLink":"","qr":{"assetUrl":"","alt":{"en":"","ar":""}}}'::jsonb before_value,
 '{"version":2,"enabled":true,"recipientAlias":"Synthetic new recipient","recipientDetails":"Synthetic new details","instructions":{"en":"New instructions","ar":"تعليمات جديدة"},"paymentLink":"https://example.invalid/share","qr":{"assetUrl":"https://example.invalid/qr.png","alt":{"en":"Synthetic QR","ar":"رمز اختبار"}}}'::jsonb after_value;
create temporary table wire_body as select jsonb_build_object(
 'protocolVersion','1.0','requestId',d.envelope->'requestId','correlationId',d.envelope->'correlationId',
 'targetBindingId',d.envelope->'targetBindingId','operation',d.envelope->'operation','operationVersion','1.0',
 'requestDigest',d.body_digest,'targetAuditId','synthetic-shop-audit','targetResultVersion',2,'replayed',false,
 'data',jsonb_build_object('configuration',e.after_value,'before',e.before_value,'after',e.after_value))::text body
 from public.adapter_dispatches d cross join evidence e where d.request_id=(select request_id from adapter_fixture);
create temporary table wire as select jsonb_build_object('status',200,'body',w.body,'algorithm','BS-S2S-RESPONSE-HMAC-SHA256',
 'protocolVersion','1.0','keyId',a.key_id,'digest',encode(extensions.digest(convert_to(w.body,'UTF8'),'sha256'),'hex'),
 'signature',super_admin_private.adapter_mac(array_to_string(array['BS-S2S-RESPONSE-HMAC-SHA256','1.0',a.key_id,
 d.envelope->>'requestId',d.envelope->>'correlationId',d.envelope->>'sourceBindingId',d.envelope->>'targetBindingId',d.envelope->>'targetEnvironmentId',
 d.audience,'200',d.body_digest,encode(extensions.digest(convert_to(w.body,'UTF8'),'sha256'),'hex')],E'\n'),super_admin_private.adapter_key(a.secret_reference_id))) value
 from wire_body w cross join public.adapter_attempts a join public.adapter_dispatches d on d.id=a.dispatch_id
 where a.id=(select (value->>'attemptId')::uuid from signed_attempt);
select is(public.super_admin_adapter_complete((a.value->>'attemptId')::uuid,w.value)->>'targetAuditId','synthetic-shop-audit','verified target audit') from signed_attempt a cross join wire w;
select is((select before_state from public.control_plane_events where request_id=(select request_id from adapter_fixture)),(select before_value from evidence),'before retained');
select is((select after_state from public.control_plane_events where request_id=(select request_id from adapter_fixture)),(select after_value from evidence),'after retained');
select is((select actor_user_id from public.control_plane_events where request_id=(select request_id from adapter_fixture)),(select owner_id from adapter_fixture),'actor from provisioned identity');
select is((select reason from public.control_plane_events where request_id=(select request_id from adapter_fixture)),'Synthetic configuration change','reason retained');
select throws_ok('update public.control_plane_events set reason=''Changed reason''','55000','CONTROL_PLANE_EVENTS_IMMUTABLE','update refused');
select throws_ok('delete from public.control_plane_events','55000','CONTROL_PLANE_EVENTS_IMMUTABLE','delete refused');
select * from finish();
rollback;
