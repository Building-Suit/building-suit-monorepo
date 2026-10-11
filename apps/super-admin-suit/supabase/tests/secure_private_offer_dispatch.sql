-- Disposable local protocol regression; never staging acceptance.
begin;
select plan(21);
\ir fixtures/custom-offer.inc
select lives_ok('select public.super_admin_custom_offer_command(value) from offer_input','owner stores frozen version');
reset role;
create temporary table issue_input as select jsonb_build_object('action','issue','bindingId',binding_id,'requestId',gen_random_uuid(),'correlationId',gen_random_uuid(),'reason','Synthetic secure issuance','payload',jsonb_build_object('offerVersionId',(select id from public.custom_offer_versions))) value from adapter_fixture;
-- The browser cannot read protected rows; fixture identities are created by the test owner.
reset role;
grant select,update on issue_input to authenticated;
set local role authenticated;
select throws_ok('select public.super_admin_custom_offer_command(value) from issue_input','22023','SHOP_SECURE_REDEMPTION_CONTRACT_REQUIRED','missing signed capability stays gated');
reset role;
insert into public.adapter_manifest_observations(binding_id,manifest_revision,manifest_digest,protocol_versions,verified_capabilities,verification_outcome,expires_at)
 select binding_id,'fixture-secure-v2',repeat('b',64),array['1.0'],'[{"operation":"shop.billing.command","version":"1.0","members":["register_secure_private_offer","revoke_secure_private_offer"]}]','verified',now()+interval '1 hour' from adapter_fixture;
set local role authenticated;
select throws_ok('select public.super_admin_custom_offer_command(value) from issue_input','22023','CUSTOMER_ORIGIN_REQUIRED','missing delivery origin stays gated');
reset role;
insert into public.integration_settings(provider_id,binding_id,setting_key,value_type,non_secret_value,schema_version,effective_from,status)
select provider_id,binding_id,'customer-offer-origin','string','"https://shop.example.invalid"'::jsonb,'1.0',now()-interval '1 minute','active' from adapter_fixture;
set local role authenticated;
select lives_ok('select public.super_admin_custom_offer_command(value) from issue_input','verified capability permits owner dispatch');
select is((select public.super_admin_custom_offer_command(value)->>'dispatchId' from issue_input),(select public.super_admin_custom_offer_command(value)->>'dispatchId' from issue_input),'exact retry preserves dispatch');
select ok((select public.super_admin_custom_offer_command(value)->>'redemptionToken' is null from issue_input),'unconfirmed token never fabricated');
select throws_ok('select * from public.custom_offer_target_receipts','42501',null,'browser cannot read token store');
reset role;
select is((select count(*)::integer from public.custom_offer_dispatches),1,'one immutable dispatch');
select is((select envelope#>'{payload,payload,entitlements}' from public.adapter_dispatches),(select entitlements from public.custom_offer_versions),'entitlements signed from immutable version');
select is((select envelope#>>'{payload,payload,recipientUserId}' from public.adapter_dispatches),(select recipient_user_id::text from public.custom_offer_versions),'recipient signed from version');
select throws_ok('update public.custom_offer_dispatches set action=''revoke''','55000',null,'dispatch mapping immutable');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
create temporary table signed_attempt as select public.super_admin_adapter_claim(dispatch_id) value from public.custom_offer_dispatches;
select ok((select value#>>'{headers,x-bs-signature}' ~ '^[A-Za-z0-9_-]{43}$' from signed_attempt),'server signs existing protocol');
select is((select public.super_admin_adapter_complete((value->>'attemptId')::uuid,'{"status":200,"body":"untrusted","signature":"tampered"}')->>'code' from signed_attempt),'outcome_unknown','tampered completion never issues token');
-- Cryptographic completion unit fixture; target lifecycle is separately tested in Shop.
create temporary table positive_attempt as select public.super_admin_adapter_claim(dispatch_id) value from public.custom_offer_dispatches;
create temporary table response_fixture as
 select a.id attempt_id,d.id dispatch_id,
 jsonb_build_object('protocolVersion','1.0','requestId',d.envelope->'requestId','correlationId',d.envelope->'correlationId',
 'targetBindingId',d.envelope->'targetBindingId','operation',d.envelope->'operation','operationVersion','1.0',
 'requestDigest',d.body_digest,'data',jsonb_build_object('offerId',o.id,'offerVersion',o.version,
 'targetBindingId',o.target_binding_id,'targetEnvironmentId',o.target_environment_id,'state','issued',
 'redemptionToken',repeat('T',43),'entitlements',o.entitlements,'shopId',o.company_id,'expiresAt',o.expires_at),
 'targetAuditId',gen_random_uuid(),'targetResultVersion',1,'replayed',false)::text body
 from public.adapter_attempts a join public.adapter_dispatches d on d.id=a.dispatch_id
 join public.custom_offer_dispatches c on c.dispatch_id=d.id join public.custom_offer_versions o on o.id=c.offer_version_id
 where a.id=(select (value->>'attemptId')::uuid from positive_attempt);
create temporary table wire_response as
 select f.attempt_id,jsonb_build_object('status',200,'body',f.body,'algorithm','BS-S2S-RESPONSE-HMAC-SHA256',
 'protocolVersion','1.0','keyId',a.key_id,'digest',encode(extensions.digest(convert_to(f.body,'UTF8'),'sha256'),'hex'),
 'signature',super_admin_private.adapter_mac(array_to_string(array['BS-S2S-RESPONSE-HMAC-SHA256','1.0',a.key_id,
 d.envelope->>'requestId',d.envelope->>'correlationId',d.envelope->>'sourceBindingId',d.envelope->>'targetBindingId',
 d.envelope->>'targetEnvironmentId',d.audience,'200',d.body_digest,encode(extensions.digest(convert_to(f.body,'UTF8'),'sha256'),'hex')],E'\n'),
 super_admin_private.adapter_key(a.secret_reference_id))) value
 from response_fixture f join public.adapter_attempts a on a.id=f.attempt_id join public.adapter_dispatches d on d.id=f.dispatch_id;
select lives_ok('select public.super_admin_adapter_complete(attempt_id,value) from wire_response','valid signed completion reconciles');
select is((select count(*)::integer from public.custom_offer_target_receipts),1,'one durable verified receipt');
select is((select redemption_token from public.custom_offer_target_receipts),repeat('T',43),'verified token preserved');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true) from adapter_fixture;
select is((select public.super_admin_custom_offer_command(value)->>'targetState' from issue_input),'issued','owner exact retry observes verified state');
select ok((select public.super_admin_custom_offer_command(value)->>'customerLink' like 'https://shop.example.invalid/billing#offer=%&token='||repeat('T',43) from issue_input),'authenticated issuer receives fragment-only customer link');
select ok((select public.super_admin_custom_offers_read(binding_id)#>>'{versions,0,customerLink}' is not null from adapter_fixture),'authorized reload retrieves durable issued link');
reset role;
select ok(not has_function_privilege('authenticated','super_admin_private.custom_offer_link(public.custom_offer_versions)','execute'),'browser cannot call private link helper');
select throws_ok('update public.custom_offer_target_receipts set redemption_token=repeat(''U'',43)','55000',null,'receipt cannot be replaced');
select * from finish();
rollback;
