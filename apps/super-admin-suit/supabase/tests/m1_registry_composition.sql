-- SAS-M1-REGISTRY-001: disposable synthetic data, no target-Suit access.
begin;
select plan(1);

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


insert into public.integration_providers(id,stable_key,display_name,provider_kind,configuration_schema_version,status)
select gen_random_uuid(),'m1-projection-test','{"en":"Fixture"}','hmac-adapter','1.0','active';
insert into public.integration_secret_references(provider_id,binding_id,purpose,key_id,key_version,vault_secret_id,valid_from,status)
select p.id,f.binding_id,'adapter-signing','fixture-m1-key',1,gen_random_uuid(),now()-interval '1 minute','active' from public.integration_providers p,registry_fixture f where p.stable_key='m1-projection-test';
insert into public.integration_settings(provider_id,binding_id,setting_key,value_type,non_secret_value,schema_version,effective_from,status)
select p.id,f.binding_id,'adapter-dispatch-policy','object',jsonb_build_object('targetBindingId',f.binding_id,'timeoutMs',30000,'maxResponseBytes',1048576),'1.0',now()-interval '1 minute','active' from public.integration_providers p,registry_fixture f where p.stable_key='m1-projection-test';
update public.suit_environment_bindings set adapter_base_url='https://fixture.invalid',egress_policy='{"allowedHosts":["fixture.invalid"]}' where id=(select binding_id from registry_fixture);
insert into public.adapter_capability_policy(adapter_registration_id,capability_key,min_version,max_version,query_scopes,command_scopes,enabled)
select f.adapter_id,op,'1.0','1.0',case when op='shop.billing.query' then array[op] else '{}' end,case when op='shop.billing.command' then array[op] else '{}' end,true from registry_fixture f cross join lateral unnest(array['shop.billing.query','shop.billing.command']) op;

insert into public.adapter_manifest_observations(binding_id,manifest_revision,manifest_digest,protocol_versions,verified_capabilities,verification_outcome,expires_at)
select binding_id,'m1-current',repeat('c',64),array['1.0'],'[{"operation":"shop.billing.query","version":"1.0"},{"operation":"shop.billing.command","version":"1.0"}]','verified',clock_timestamp()+interval '1 hour' from registry_fixture;
insert into public.navigation_items(suit_id,stable_key,label,module_kind,route_descriptor,required_capability_key,required_capability_version,enabled)
select f.first_id,op,jsonb_build_object('en',op),op,'{}',case when op='activity' then null else 'shop.billing.query' end,case when op='activity' then null else '1.0' end,true from registry_fixture f cross join lateral unnest(array['manual-transfer','payment-review','custom-offers','activity']) op;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',(select owner_id::text from registry_fixture),true);
do $$ declare r jsonb; m text; begin
 r:=public.super_admin_configuration_read('registry');
 foreach m in array array['manual-transfer','payment-review','custom-offers','activity'] loop
 if not exists(select 1 from jsonb_array_elements(r->'suits'->0->'items') i where i->>'module'=m) then raise exception 'M1_MODULE_MISSING:%',m;end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(r->'suits'->0->'items') i where i->>'module' in ('manual-transfer','payment-review','custom-offers') and i->>'bindingId' is distinct from (select binding_id::text from registry_fixture)) then raise exception 'BINDING_MISMATCH';end if;
 if r::text like '%fixture.invalid%' then raise exception 'TOPOLOGY_EXPOSED';end if;
end $$;
reset role;
update public.adapter_capability_policy set enabled=false where capability_key='shop.billing.command' and adapter_registration_id=(select adapter_id from registry_fixture);
set local role authenticated;
do $$ declare r jsonb;begin r:=public.super_admin_configuration_read('registry');if exists(select 1 from jsonb_array_elements(r->'suits'->0->'items') i where i->>'module' in ('manual-transfer','payment-review','custom-offers')) then raise exception 'DISABLED_CAPABILITY_EXPOSED';end if;if not exists(select 1 from jsonb_array_elements(r->'suits'->0->'items') i where i->>'module'='activity') then raise exception 'AUDIT_LOST';end if;end $$;
reset role;
update public.platform_admins set enabled=false,disabled_at=clock_timestamp() where user_id=(select owner_id from registry_fixture);
set local role authenticated;
do $$ begin begin perform public.super_admin_configuration_read('registry');raise exception 'DISABLED_OWNER_ACCEPTED';exception when insufficient_privilege then null;end;end $$;
reset role;
select pass('All M1 module, binding, topology, capability and disabled-owner assertions executed');
select * from finish();
rollback;
