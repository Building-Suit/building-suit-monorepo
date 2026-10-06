-- SAS-M1-REGISTRY-001: disposable synthetic data, no target-Suit access.
begin;
select plan(9);
create temporary table registry_fixture as select gen_random_uuid() owner_id, gen_random_uuid() outsider_id, gen_random_uuid() environment_id, gen_random_uuid() first_id, gen_random_uuid() second_id, gen_random_uuid() binding_id, gen_random_uuid() adapter_id;
grant select on registry_fixture to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,created_at,updated_at)
select id,id::text||'@registry.invalid','x','authenticated','authenticated',now(),now()
from (select owner_id id from registry_fixture union all select outsider_id from registry_fixture) users;
insert into public.admin_environments(id,stable_key,environment_kind,display_name,status,binding_fingerprint)
select environment_id,'registry-test','staging','{"en":"Fixture"}'::jsonb,'active','registry-fixture-fingerprint' from registry_fixture;
insert into public.platform_admins(user_id,authority_environment_id,provisioned_by)
select owner_id,environment_id,owner_id from registry_fixture;
insert into public.suit_registry(id,stable_key,display_name,asset_reference,adapter_contract_version,status,sort_order)
select first_id,'first-suit','{"en":"First","ar":"الأولى"}'::jsonb,'/brand/fixture.svg','1.0','active',10 from registry_fixture
union all select second_id,'future-suit','{"en":"Future"}'::jsonb,'/brand/fixture.svg','1.0','active',20 from registry_fixture;
insert into public.suit_environment_bindings(id,suit_id,admin_environment_id,target_environment_id,adapter_base_url,audience,target_identity_fingerprint,egress_policy,status)
select binding_id,first_id,environment_id,environment_id,'https://fixture.invalid/adapter','fixture-audience','registry-fixture-fingerprint','{}'::jsonb,'active' from registry_fixture
union all select gen_random_uuid(),second_id,environment_id,environment_id,'https://fixture.invalid/adapter','fixture-audience','registry-fixture-fingerprint','{}'::jsonb,'active' from registry_fixture;
insert into public.adapter_registrations(id,binding_id,adapter_key,protocol_min_version,protocol_max_version,manifest_schema_version,manifest_max_age_seconds,status)
select adapter_id,binding_id,'fixture-adapter','1.0','1.0','1.0',3600,'active' from registry_fixture;
insert into public.adapter_capability_policy(adapter_registration_id,capability_key,min_version,max_version,query_scopes,enabled)
select adapter_id,'adapter.capabilities.read','1.0','1.0',array['adapter.capabilities.read'],true from registry_fixture;
insert into public.adapter_manifest_observations(binding_id,manifest_revision,manifest_digest,protocol_versions,verified_capabilities,verification_outcome,expires_at)
select binding_id,'fixture-v1',repeat('a',64),array['1.0'],'[{"key":"adapter.capabilities.read","version":"1.0","queryScopes":["adapter.capabilities.read"]}]','verified',now()+interval '1 hour' from registry_fixture;
insert into public.navigation_items(suit_id,stable_key,label,module_kind,route_descriptor,required_capability_key,required_capability_version,sort_order,enabled)
select first_id,'overview','{"en":"Overview"}'::jsonb,'overview','{}'::jsonb,null,null,0,true from registry_fixture
union all select first_id,'discovery','{"en":"Discovery"}'::jsonb,'capabilities','{}'::jsonb,'adapter.capabilities.read','1.0',1,true from registry_fixture
union all select first_id,'unknown','{"en":"Unknown"}'::jsonb,'capabilities','{}'::jsonb,'unknown.read','1.0',2,true from registry_fixture
union all select first_id,'disabled','{"en":"Disabled"}'::jsonb,'overview','{}'::jsonb,null,null,3,false from registry_fixture
union all select second_id,'future-overview','{"en":"Future overview"}'::jsonb,'overview','{}'::jsonb,null,null,0,true from registry_fixture;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',(select outsider_id::text from registry_fixture),true);
select throws_ok($$select public.super_admin_configuration_read('registry')$$,'42501','PLATFORM_OWNER_REQUIRED','outsider cannot read registry');
select set_config('request.jwt.claim.sub',(select owner_id::text from registry_fixture),true);
select is(public.super_admin_configuration_read('registry')->'suits'->0->>'key','first-suit','database rail order');
select is(jsonb_array_length(public.super_admin_configuration_read('registry')->'suits'->0->'items'),2,'enabled known capabilities only');
select ok(public.super_admin_configuration_read('registry')::text not like '%fixture.invalid%' and public.super_admin_configuration_read('registry')::text not like '%binding_id%','safe projection omits topology');
select public.super_admin_configuration_command(gen_random_uuid(),gen_random_uuid(),'suit',(select second_id from registry_fixture),1,'Reorder synthetic rail','{"sortOrder":0,"displayName":{"en":"Renamed"}}');
select is(public.super_admin_configuration_read('registry')->'suits'->0->'label'->>'en','Renamed','audited order and metadata update without rebuild');
reset role;
update public.adapter_capability_policy set enabled=false where adapter_registration_id=(select adapter_id from registry_fixture);
set local role authenticated;
select is(jsonb_array_length(public.super_admin_configuration_read('registry')->'suits'->1->'items'),1,'disabled capability removed on next read');
reset role;
update public.adapter_capability_policy set enabled=true where adapter_registration_id=(select adapter_id from registry_fixture);
insert into public.adapter_manifest_observations(binding_id,manifest_revision,manifest_digest,protocol_versions,verified_capabilities,verification_outcome,expires_at)
select binding_id,'fixture-rejected',repeat('b',64),array['1.0'],'[]','rejected',clock_timestamp()+interval '1 hour' from registry_fixture;
set local role authenticated;
select is(jsonb_array_length(public.super_admin_configuration_read('registry')->'suits'->1->'items'),1,'latest rejected manifest cannot fall back to older verified observation');
reset role;
update public.suit_registry set status='retired' where id=(select second_id from registry_fixture);
set local role authenticated;
select is(jsonb_array_length(public.super_admin_configuration_read('registry')->'suits'),1,'retired Suit disappears');
reset role;
update public.platform_admins set enabled=false,disabled_at=clock_timestamp() where user_id=(select owner_id from registry_fixture);
set local role authenticated;
select throws_ok($$select public.super_admin_configuration_read('registry')$$,'42501','PLATFORM_OWNER_REQUIRED','disabled owner cannot read with unchanged identity');
select * from finish();
rollback;
