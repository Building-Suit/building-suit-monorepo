-- SS-TEAM-001: invitation/addition, roles, branch assignment, immediate
-- suspension, outsider/cross-shop denial, owner continuity, and audit.
create temporary table shop_team_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() staff_id,
  gen_random_uuid() outsider_id, gen_random_uuid() invited_id;
grant select on shop_team_fixture to authenticated;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, email, 'x', 'authenticated', 'authenticated', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id id, 'owner@ss-team-001.invalid' email from shop_team_fixture
  union all select staff_id, 'staff@ss-team-001.invalid' from shop_team_fixture
  union all select outsider_id, 'outsider@ss-team-001.invalid' from shop_team_fixture
) users;

do $$
declare function_row record;
begin
  for function_row in
    select procedure.oid, procedure.proname, procedure.prosecdef, procedure.proconfig
    from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public' and procedure.proname = any(array[
      'shop_team_read', 'invite_shop_member', 'accept_shop_invitation',
      'revoke_shop_invitation', 'manage_shop_member', 'transfer_shop_ownership'
    ])
  loop
    if not function_row.prosecdef
      or function_row.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', function_row.oid, 'execute')
      or has_function_privilege('anon', function_row.oid, 'execute') then
      raise exception 'unsafe team wrapper: %', function_row.proname;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.shop_team_invitations', 'select')
    or has_table_privilege('authenticated', 'public.shop_team_events', 'select') then
    raise exception 'team internals are browser-readable';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_team_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid; v_branch uuid;
begin
  v_shop := public.create_owner_shop('Team fixture', 'multi', 'mixed');
  v_branch := public.save_shop_location(v_shop, null, 'Branch two', 'BR2', null, null);
  perform set_config('ss_team.shop', v_shop::text, true);
  perform set_config('ss_team.branch', v_branch::text, true);
end;
$$;
reset role;

insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
select fixture.staff_id, shop.portal_id, 'Staff member', 'staff@ss-team-001.invalid'
from shop_team_fixture fixture
join public.shops shop on shop.id = current_setting('ss_team.shop')::uuid;

select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_team_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_team.shop')::uuid;
  v_branch uuid := current_setting('ss_team.branch')::uuid;
  v_staff_membership uuid; v_add jsonb; v_invite jsonb;
begin
  v_add := public.invite_shop_member(gen_random_uuid(), v_shop,
    'staff@ss-team-001.invalid', 'Staff member', 'cashier', array[v_branch]);
  if v_add ->> 'kind' <> 'invited' then raise exception 'existing identity must consent'; end if;
  perform set_config('request.jwt.claim.sub', (select staff_id::text from shop_team_fixture), true);
  perform public.accept_shop_invitation(gen_random_uuid(), (v_add ->> 'invitationCode')::uuid);
  perform set_config('request.jwt.claim.sub', (select owner_id::text from shop_team_fixture), true);
  -- The owner reads other members through the authorized team projection;
  -- profile_self_read correctly prevents a direct join to their profiles.
  select (member ->> 'id')::uuid into v_staff_membership
    from jsonb_array_elements(public.shop_team_read(v_shop) -> 'members') member
    where member ->> 'email' = 'staff@ss-team-001.invalid';
  if v_staff_membership is null
    or (select count(*) from public.membership_location_assignments
      where membership_id = v_staff_membership and location_id = v_branch) <> 1
    or not exists (select 1 from public.membership_roles membership_role
      join public.roles role on role.id = membership_role.role_id
      where membership_role.membership_id = v_staff_membership and role.key = 'cashier') then
    raise exception 'existing staff addition, role, or branch assignment failed';
  end if;

  v_invite := public.invite_shop_member(gen_random_uuid(), v_shop,
    'invited@ss-team-001.invalid', 'Invited member', 'barber', array[v_branch]);
  if v_invite ->> 'kind' <> 'invited' or v_invite ->> 'invitationCode' is null then
    raise exception 'controlled invitation was not issued';
  end if;
  perform set_config('ss_team.staff_membership', v_staff_membership::text, true);
  perform set_config('ss_team.invitation_code', v_invite ->> 'invitationCode', true);
end;
$$;
reset role;

-- The invited identity accepts only its own email-bound code.
insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select invited_id, 'invited@ss-team-001.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from shop_team_fixture;
select set_config('request.jwt.claim.sub', invited_id::text, true) from shop_team_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_team.shop')::uuid; v_joined uuid;
begin
  v_joined := public.accept_shop_invitation(gen_random_uuid(),
    current_setting('ss_team.invitation_code')::uuid);
  if v_joined <> v_shop or not exists (
    select 1 from public.shop_memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    where membership.shop_id = v_shop and profile.user_id = auth.uid()
      and membership.status = 'active' and membership.removed_at is null
  ) then raise exception 'invitation acceptance failed'; end if;
end;
$$;
reset role;

-- A cashier can read the team but cannot administer it or another tenant.
select set_config('request.jwt.claim.sub', staff_id::text, true) from shop_team_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_team.shop')::uuid;
begin
  if jsonb_array_length(public.shop_team_read(v_shop) -> 'members') < 3 then
    raise exception 'delegated team read failed';
  end if;
  begin
    perform public.manage_shop_member(gen_random_uuid(), v_shop,
      current_setting('ss_team.staff_membership')::uuid, 'suspend', null, null, null);
    raise exception 'cashier administered team';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- Owner suspension takes effect for an already-issued authenticated context.
select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_team_fixture;
set local role authenticated;
select public.manage_shop_member(gen_random_uuid(), current_setting('ss_team.shop')::uuid,
  current_setting('ss_team.staff_membership')::uuid, 'suspend', null, null, 'Access review');
reset role;
select set_config('request.jwt.claim.sub', staff_id::text, true) from shop_team_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.shop_team_read(current_setting('ss_team.shop')::uuid);
    raise exception 'open-session suspension retained protected access';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.list_shop_locations(current_setting('ss_team.shop')::uuid)) then
    raise exception 'suspended membership retained location access';
  end if;
end;
$$;
reset role;

-- Launch parity: explicit Shop capabilities, bilingual custom roles and escalation denial.
select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_team_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_team.shop')::uuid;
  v_key text; v_request uuid := gen_random_uuid(); v_first jsonb; v_retry jsonb;
  v_permissions text[];
begin
  v_key := public.save_shop_team_role(gen_random_uuid(),v_shop,null,'Reception','الاستقبال',array['team.view','products.view']);
  perform public.save_shop_team_role(gen_random_uuid(),v_shop,v_key,'Reception updated','الاستقبال الجديد',array['team.view']);
  if not exists(select 1 from jsonb_array_elements(public.shop_team_read(v_shop)->'roles') role
    where role->>'key'=v_key and role->>'nameAr'='الاستقبال الجديد' and role->'permissionKeys'='["team.view"]'::jsonb) then
    raise exception 'custom role bilingual CRUD failed'; end if;
  perform public.manage_shop_member(gen_random_uuid(),v_shop,current_setting('ss_team.staff_membership')::uuid,'reactivate',null,null,null);
  perform public.save_shop_team_member(gen_random_uuid(),v_shop,current_setting('ss_team.staff_membership')::uuid,
    'Reception member','Receptionist',v_key,array[current_setting('ss_team.branch')::uuid]);
  if not exists(select 1 from jsonb_array_elements(public.shop_team_read(v_shop)->'members') member
    where member->>'id'=current_setting('ss_team.staff_membership') and member->>'roleKey'=v_key
      and member->>'jobTitle'='Receptionist') then raise exception 'custom role and member details not assigned'; end if;
  begin
    perform public.save_shop_team_role(gen_random_uuid(),v_shop,v_key,'Reception updated','الاستقبال الجديد',array['team.view'],true);
    raise exception 'assigned custom role was archived';
  exception when check_violation then null; end;
  perform public.manage_shop_member(gen_random_uuid(),v_shop,current_setting('ss_team.staff_membership')::uuid,'change_role','cashier',null,null);
  begin
    perform public.save_shop_team_member(gen_random_uuid(),v_shop,current_setting('ss_team.staff_membership')::uuid,
      'Invalid edit','Changed title','staff',array[gen_random_uuid()]);
    raise exception 'invalid location edit succeeded';
  exception when check_violation then null; end;
  if not exists(select 1 from jsonb_array_elements(public.shop_team_read(v_shop)->'members') member
    where member->>'id'=current_setting('ss_team.staff_membership') and member->>'roleKey'='cashier'
      and member->>'jobTitle'='Receptionist') then raise exception 'member edit was not atomic'; end if;
  perform public.save_shop_team_role(gen_random_uuid(),v_shop,v_key,'Reception updated','الاستقبال الجديد',array['team.view'],true);
  if exists(select 1 from jsonb_array_elements(public.shop_team_read(v_shop)->'roles') role where role->>'key'=v_key) then
    raise exception 'archived role remains assignable'; end if;
  begin
    perform public.save_shop_team_role(gen_random_uuid(),v_shop,'owner','Owner','المالك',array[]::text[]);
    raise exception 'owner invariant changed';
  exception when check_violation then null; end;
  begin
    perform public.save_shop_team_role(gen_random_uuid(),v_shop,null,'Foreign','خارجي',array['ledger.accounts.manage']);
    raise exception 'foreign capability accepted';
  exception when insufficient_privilege then null; end;
  v_first := public.invite_shop_staff(v_request,v_shop,'retry@ss-team-001.invalid','Retry member','Receptionist','staff',array[current_setting('ss_team.branch')::uuid]);
  v_retry := public.invite_shop_staff(v_request,v_shop,'retry@ss-team-001.invalid','Retry member','Receptionist','staff',array[current_setting('ss_team.branch')::uuid]);
  if v_first->>'invitationCode' <> v_retry->>'invitationCode' then raise exception 'invitation retry created duplicate'; end if;
  begin
    perform public.invite_shop_staff(gen_random_uuid(),v_shop,'retry@ss-team-001.invalid','Retry member','Receptionist','staff',array[current_setting('ss_team.branch')::uuid]);
    raise exception 'duplicate invitation admitted';
  exception when unique_violation then null; end;
  perform public.revoke_shop_invitation(gen_random_uuid(),v_shop,(v_first->>'invitationId')::uuid,null);
  begin
    perform public.accept_shop_invitation(gen_random_uuid(),(v_first->>'invitationCode')::uuid);
    raise exception 'revoked invitation accepted';
  exception when sqlstate '55000' then null; end;
  v_key := public.save_shop_team_role(gen_random_uuid(),v_shop,null,'Access delegate','مفوض الوصول',array['team.view','team.manage','team.permissions.manage']);
  perform public.manage_shop_member(gen_random_uuid(),v_shop,current_setting('ss_team.staff_membership')::uuid,'change_role',v_key,null,null);
  perform set_config('request.jwt.claim.sub',(select staff_id::text from shop_team_fixture),true);
  begin
    perform public.save_shop_team_role(gen_random_uuid(),v_shop,null,'Escalated','تصعيد',array['products.manage']);
    raise exception 'delegate granted a capability they lack';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',(select owner_id::text from shop_team_fixture),true);
  perform public.manage_shop_member(gen_random_uuid(),v_shop,current_setting('ss_team.staff_membership')::uuid,'change_role','cashier',null,null);
  -- Keep the original manager preset after proving that system sets are editable.
  select array_agg(value) into v_permissions from jsonb_array_elements_text(
    (select role->'permissionKeys' from jsonb_array_elements(public.shop_team_read(v_shop)->'roles') role where role->>'key'='manager')) value;
  perform public.save_shop_team_role(gen_random_uuid(),v_shop,'manager','Manager','مدير',array['team.view']);
  perform public.save_shop_team_role(gen_random_uuid(),v_shop,'manager','Manager','مدير',v_permissions);
end;
$$;
reset role;
select set_config('request.jwt.claim.sub', staff_id::text, true) from shop_team_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.save_shop_team_role(gen_random_uuid(),current_setting('ss_team.shop')::uuid,null,'Escalation','تصعيد',array['team.permissions.manage']);
    raise exception 'permission escalation accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

-- Ownership transfer is atomic: subscription authority follows the new owner,
-- while the former owner remains an active manager and history is retained.
select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_team_fixture;
set local role authenticated;
select public.manage_shop_member(gen_random_uuid(), current_setting('ss_team.shop')::uuid,
  current_setting('ss_team.staff_membership')::uuid, 'reactivate', null, null, 'Ownership transfer');
select public.transfer_shop_ownership(gen_random_uuid(), current_setting('ss_team.shop')::uuid,
  current_setting('ss_team.staff_membership')::uuid, 'Owner succession');
reset role;
do $$
declare v_shop uuid := current_setting('ss_team.shop')::uuid;
begin
  if not exists (select 1 from public.shop_memberships membership
      join public.profiles profile on profile.id = membership.profile_id
      where membership.id = current_setting('ss_team.staff_membership')::uuid
        and membership.role = 'owner' and membership.status = 'active')
    or not exists (select 1 from public.shop_memberships membership
      join public.profiles profile on profile.id = membership.profile_id
      join shop_team_fixture fixture on fixture.owner_id = profile.user_id
      join public.membership_roles membership_role on membership_role.membership_id = membership.id
      join public.roles role on role.id = membership_role.role_id and role.key = 'manager'
      where membership.shop_id = v_shop and membership.role = 'employee')
    or not exists (select 1 from public.subscriptions subscription
      join public.shop_memberships membership on membership.profile_id = subscription.profile_id
      where membership.id = current_setting('ss_team.staff_membership')::uuid) then
    raise exception 'atomic ownership transfer failed';
  end if;
end;
$$;

-- The former owner is now the delegated manager role. settings.manage grants
-- the same location lifecycle without restoring ownership authority.
select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_team_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_team.shop')::uuid;
  v_branch uuid := current_setting('ss_team.branch')::uuid;
  v_default uuid;
begin
  select id into v_default from public.shop_locations
  where shop_id = v_shop and is_default;
  perform public.save_shop_location(
    v_shop, v_default, 'Manager-edited main', 'HQ', null, null
  );
  perform public.archive_shop_location(v_shop, v_branch);
  perform public.restore_shop_location(v_shop, v_branch);
  if (select name from public.shop_locations where id = v_default)
      <> 'Manager-edited main'
    or (select status from public.shop_locations where id = v_branch) <> 'active' then
    raise exception 'settings manager location lifecycle failed';
  end if;
end;
$$;
reset role;

-- Direct mutation cannot orphan the shop, even outside the public command API.
do $$
begin
  begin
    update public.shop_memberships set status = 'suspended'
    where shop_id = current_setting('ss_team.shop')::uuid and role = 'owner';
    raise exception 'last-owner continuity guard failed';
  exception when check_violation then null;
  end;
end;
$$;

-- An unrelated shop owner cannot read the tenant. Keep this subscription on
-- the outsider identity so the staff member remains eligible for transfer.
select set_config('request.jwt.claim.sub', outsider_id::text, true) from shop_team_fixture;
set local role authenticated;
do $$
begin
  perform public.create_owner_shop('Outsider shop', 'team', 'mixed');
  begin
    perform public.shop_team_read(current_setting('ss_team.shop')::uuid);
    raise exception 'outsider or cross-shop team isolation failed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

do $$
declare v_shop uuid := current_setting('ss_team.shop')::uuid;
begin
  if (select count(*) from public.shop_team_events where shop_id = v_shop) < 4
    or exists (select 1 from public.shop_team_events where shop_id = v_shop
      and actor_user_id is null) then
    raise exception 'sensitive team audit evidence is incomplete';
  end if;
  begin
    update public.shop_team_events set reason = 'tampered' where shop_id = v_shop;
    raise exception 'team audit was mutable';
  exception when object_not_in_prerequisite_state then null;
  end;
  if not exists (select 1 from public.shop_memberships
      where shop_id = v_shop and role = 'owner' and status = 'active' and removed_at is null) then
    raise exception 'shop has no explicit active owner';
  end if;
end;
$$;
