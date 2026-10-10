-- Same authenticated JWT remains in use while the provisioned record changes.
begin;
select plan(7);
create temporary table identity_fixture as select gen_random_uuid() user_id, gen_random_uuid() environment_id;
grant select on identity_fixture to authenticated;
insert into auth.users(id, aud, role, raw_user_meta_data)
select user_id, 'authenticated', 'authenticated', '{"role":"owner","platform_admin":true,"suit":"super-admin-suit"}' from identity_fixture;
insert into public.admin_environments(id, stable_key, environment_kind, display_name, status)
select environment_id, 'identity-fixture', 'local', '{"en":"Identity fixture"}', 'active' from identity_fixture;
select set_config('request.jwt.claim.sub', user_id::text, true), set_config('request.jwt.claim.role', 'authenticated', true) from identity_fixture;
set local role authenticated;
select throws_ok('select public.super_admin_session()', '42501', 'PLATFORM_OWNER_REQUIRED', 'metadata does not provision authority');
select throws_ok($$select public.super_admin_configuration_read('suits')$$, '42501', 'PLATFORM_OWNER_REQUIRED', 'outsider privileged reads denied');
select throws_ok($$select public.super_admin_configuration_command(gen_random_uuid(),gen_random_uuid(),'suit',gen_random_uuid(),0,'Unauthorized command','{}')$$, '42501', 'PLATFORM_OWNER_REQUIRED', 'outsider privileged writes denied');
reset role;
insert into public.platform_admins(user_id, authority_environment_id, provisioned_by)
select user_id, environment_id, user_id from identity_fixture;
set local role authenticated;
select is(public.super_admin_session()->>'userId', (select user_id::text from identity_fixture), 'provisioning grants database identity');
reset role;
update public.platform_admins set enabled = false, disabled_at = now() where user_id = (select user_id from identity_fixture);
set local role authenticated;
select throws_ok('select public.super_admin_session()', '42501', 'PLATFORM_OWNER_REQUIRED', 'same JWT loses session authority immediately after disable');
select throws_ok($$select public.super_admin_configuration_read('suits')$$, '42501', 'PLATFORM_OWNER_REQUIRED', 'disabled owner privileged reads denied');
select throws_ok($$select public.super_admin_configuration_command(gen_random_uuid(),gen_random_uuid(),'suit',gen_random_uuid(),0,'Disabled command','{}')$$, '42501', 'PLATFORM_OWNER_REQUIRED', 'disabled owner privileged writes denied');
reset role;
select * from finish();
rollback;
