-- SS-LAUNCH-TEAM-001. Forward-only tenant access management.
alter table public.roles add column name_ar text,
  add column archived_at timestamptz;
update public.roles set key = 'custom-' || id::text where key is null;
alter table public.shop_memberships add column team_full_name text,
  add column job_title text check (job_title is null or length(job_title) <= 160);
alter table public.shop_team_invitations add column job_title text
  check (job_title is null or length(job_title) <= 160);
alter table public.shop_team_events drop constraint shop_team_events_action_check;
alter table public.shop_team_events add constraint shop_team_events_action_check
  check (action in ('invite','add','accept','revoke_invitation','suspend','reactivate',
    'remove','change_role','assign_locations','transfer_ownership','save_role','archive_role','edit_details'));

-- Assignment never grants capabilities the actor does not already possess.
create function shop_private.assert_assignable_team_role(p_shop_id uuid, p_role_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.roles where id = p_role_id and shop_id = p_shop_id
      and archived_at is null and key <> 'owner') then
    raise exception 'INVALID_TEAM_ROLE' using errcode = '22023';
  end if;
  if exists (select 1 from public.role_permissions rp join public.permissions p on p.id = rp.permission_id
    where rp.role_id = p_role_id and not shop_private.has_permission(p_shop_id, p.key)) then
    raise exception 'PERMISSION_ESCALATION_DENIED' using errcode = '42501';
  end if;
end;
$$;
revoke all on function shop_private.assert_assignable_team_role(uuid,uuid) from public,anon,authenticated;

create function public.save_shop_team_role(p_request_id uuid, p_shop_id uuid, p_role_key text,
  p_name text, p_name_ar text, p_permission_keys text[], p_archive boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare v_role public.roles%rowtype; v_key text; v_before jsonb;
begin
  perform shop_private.assert_team_permission(p_shop_id, 'team.permissions.manage');
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode = '22023'; end if;
  perform shop_private.lock_plan_resource(p_shop_id, 'active_members');
  perform shop_private.assert_team_permission(p_shop_id, 'team.permissions.manage');
  if exists (select 1 from public.shop_team_events where request_id = p_request_id
    and shop_id = p_shop_id and actor_user_id = auth.uid() and action in ('save_role','archive_role')) then
    return (select after_state ->> 'key' from public.shop_team_events where request_id = p_request_id);
  end if;
  if p_role_key = 'owner' then raise exception 'OWNER_TRANSFER_REQUIRED' using errcode = '23514'; end if;
  if p_role_key is not null then
    select * into v_role from public.roles where shop_id = p_shop_id and key = p_role_key
      and archived_at is null for update;
    if not found then raise exception 'INVALID_TEAM_ROLE' using errcode = '22023'; end if;
  end if;
  v_before := to_jsonb(v_role) || jsonb_build_object('permissionKeys',(select coalesce(jsonb_agg(p.key),'[]'::jsonb) from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=v_role.id));
  if v_role.id is not null then perform shop_private.assert_assignable_team_role(p_shop_id,v_role.id); end if;
  if p_archive then
    if v_role.id is null or v_role.is_system then raise exception 'SYSTEM_ROLE_REQUIRED' using errcode = '23514'; end if;
    if exists (select 1 from public.membership_roles where role_id = v_role.id)
      or exists (select 1 from public.shop_team_invitations where role_id = v_role.id
        and status = 'pending' and expires_at > now()) then
      raise exception 'ROLE_IN_USE' using errcode = '23514';
    end if;
    update public.roles set archived_at = clock_timestamp() where id = v_role.id;
  else
    if coalesce(length(btrim(p_name)),0) not between 2 and 160
      or coalesce(length(btrim(p_name_ar)),0) not between 2 and 160
      or p_permission_keys is null then raise exception 'INVALID_TEAM_ROLE' using errcode = '22023'; end if;
    if exists (select 1 from unnest(p_permission_keys) requested(key)
      where not exists (select 1 from public.permissions p join public.shops s on s.portal_id = p.portal_id
        where s.id = p_shop_id and p.key = requested.key)
        or not shop_private.has_permission(p_shop_id, requested.key)) then
      raise exception 'PERMISSION_ESCALATION_DENIED' using errcode = '42501';
    end if;
    -- Delegates cannot alter roles with greater privileges, including by stripping them.
    if v_role.id is not null then perform shop_private.assert_assignable_team_role(p_shop_id,v_role.id); end if;
    if v_role.id is null then
      insert into public.roles(shop_id,key,name,name_ar,is_system)
      values(p_shop_id,'custom-' || gen_random_uuid()::text,btrim(p_name),btrim(p_name_ar),false)
      returning * into v_role;
    else
      update public.roles set name = case when is_system then name else btrim(p_name) end,
        name_ar = btrim(p_name_ar) where id = v_role.id;
    end if;
    delete from public.role_permissions where role_id = v_role.id;
    insert into public.role_permissions(role_id,permission_id)
    select v_role.id,p.id from public.permissions p join public.shops s on s.portal_id = p.portal_id
      where s.id = p_shop_id and p.key = any(p_permission_keys);
  end if;
  v_key := v_role.key;
  insert into public.shop_team_events(request_id,shop_id,actor_user_id,action,before_state,after_state)
  values(p_request_id,p_shop_id,auth.uid(),case when p_archive then 'archive_role' else 'save_role' end,
    v_before,jsonb_build_object('key',v_key,'name',p_name,'nameAr',p_name_ar,'permissionKeys',p_permission_keys,'archived',p_archive));
  return v_key;
end;
$$;
revoke all on function public.save_shop_team_role(uuid,uuid,text,text,text,text[],boolean) from public,anon;
grant execute on function public.save_shop_team_role(uuid,uuid,text,text,text,text[],boolean) to authenticated,service_role;

create or replace function shop_private.shop_team_read(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_can_manage boolean; v_can_permissions boolean; v_can_audit boolean;
begin
  perform shop_private.assert_team_permission(p_shop_id, 'team.view');
  v_can_manage := shop_private.has_permission(p_shop_id, 'team.manage');
  v_can_permissions := shop_private.has_permission(p_shop_id, 'team.permissions.manage');
  v_can_audit := shop_private.has_permission(p_shop_id, 'team.audit.view');
  return jsonb_build_object(
    'permissionKeys', (select coalesce(jsonb_agg(p.key order by p.key),'[]'::jsonb)
      from public.permissions p join public.shops s on s.portal_id = p.portal_id where s.id = p_shop_id),
    'grantablePermissionKeys', (select coalesce(jsonb_agg(p.key order by p.key),'[]'::jsonb)
      from public.permissions p join public.shops s on s.portal_id = p.portal_id
      where s.id = p_shop_id and shop_private.has_permission(p_shop_id,p.key)),
    'canManage', v_can_manage,
    'canManagePermissions', v_can_permissions,
    'canViewAudit', v_can_audit,
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', membership.id, 'name', coalesce(membership.team_full_name, profile.display_name), 'jobTitle', membership.job_title, 'email', profile.email_snapshot,
      'roleKey', coalesce(role.key, membership.role),
      'status', case when membership.removed_at is not null then 'removed' else membership.status::text end,
      'locationIds', coalesce(locations.value, '[]'::jsonb), 'createdAt', membership.created_at
    ) order by (membership.role = 'owner') desc, membership.created_at, membership.id), '[]'::jsonb)
      from public.shop_memberships membership
      join public.profiles profile on profile.id = membership.profile_id
      left join lateral (
        select assigned_role.key from public.membership_roles membership_role
        join public.roles assigned_role on assigned_role.id = membership_role.role_id
        where membership_role.membership_id = membership.id
        order by assigned_role.is_system desc, assigned_role.created_at, assigned_role.id limit 1
      ) role on true
      left join lateral (select jsonb_agg(assignment.location_id order by assignment.location_id) value
        from public.membership_location_assignments assignment where assignment.membership_id = membership.id) locations on true
      where membership.shop_id = p_shop_id),
    'roles', (select coalesce(jsonb_agg(jsonb_build_object(
      'key', role.key, 'name', role.name, 'nameAr', role.name_ar, 'isSystem', role.is_system,
      'permissionKeys', coalesce(permission_keys.value, '[]'::jsonb)
    ) order by role.name), '[]'::jsonb)
      from public.roles role
      left join lateral (select jsonb_agg(permission.key order by permission.key) value
        from public.role_permissions role_permission join public.permissions permission on permission.id = role_permission.permission_id
        where role_permission.role_id = role.id) permission_keys on true
      where role.shop_id = p_shop_id and role.key is not null and role.archived_at is null),
    'locations', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', location.id, 'name', location.name, 'status', location.status
    ) order by location.is_default desc, location.created_at), '[]'::jsonb)
      from public.shop_locations location where location.shop_id = p_shop_id),
    'invitations', case when v_can_manage then (select coalesce(jsonb_agg(jsonb_build_object(
      'id', invitation.id, 'email', invitation.email, 'name', invitation.display_name, 'jobTitle', invitation.job_title,
      'roleKey', role.key, 'status', case when invitation.status = 'pending' and invitation.expires_at <= now() then 'expired' else invitation.status end,
      'expiresAt', invitation.expires_at, 'createdAt', invitation.created_at
    ) order by invitation.created_at desc), '[]'::jsonb)
      from public.shop_team_invitations invitation join public.roles role on role.id = invitation.role_id
      where invitation.shop_id = p_shop_id) else '[]'::jsonb end,
    'events', case when v_can_audit then (select coalesce(jsonb_agg(event.row order by event.occurred_at desc), '[]'::jsonb)
      from (select jsonb_build_object('id', team_event.id, 'action', team_event.action,
        'actorEmail', (select auth_user.email from auth.users auth_user where auth_user.id = team_event.actor_user_id),
        'targetMembershipId', team_event.target_membership_id, 'reason', team_event.reason,
        'occurredAt', team_event.occurred_at) row, team_event.occurred_at
        from public.shop_team_events team_event where team_event.shop_id = p_shop_id
        order by team_event.occurred_at desc limit 50) event) else '[]'::jsonb end
  );
end;
$$;
create function shop_private.invite_shop_staff(
  p_request_id uuid, p_shop_id uuid, p_email text, p_display_name text,
  p_role_key text, p_location_ids uuid[], p_job_title text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email)); v_role_id uuid; v_profile_id uuid;
  v_membership_id uuid; v_invitation_id uuid; v_code uuid; v_result jsonb;
begin
  perform shop_private.assert_team_permission(p_shop_id, 'team.manage');
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode = '22023'; end if;
  select event.after_state || case when event.action = 'invite' then
      jsonb_build_object('invitationCode', invitation.invitation_code) else '{}'::jsonb end
    into v_result
  from public.shop_team_events event
  left join public.shop_team_invitations invitation on invitation.id = event.target_invitation_id
  where event.request_id = p_request_id and event.shop_id = p_shop_id
    and event.actor_user_id = auth.uid() and event.action in ('invite', 'add');
  if v_result is not null then return v_result; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'INVALID_EMAIL' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_location_ids), 0) < 1 or exists (
    select 1 from unnest(p_location_ids) requested(id) where not exists (
      select 1 from public.shop_locations location where location.id = requested.id
        and location.shop_id = p_shop_id and location.status = 'active')) then
    raise exception 'INVALID_LOCATION_ASSIGNMENT' using errcode = '23514';
  end if;
  select role.id into v_role_id from public.roles role
  where role.shop_id = p_shop_id and role.key = p_role_key and role.archived_at is null;
  if v_role_id is null then raise exception 'INVALID_TEAM_ROLE' using errcode = '22023'; end if;
  if p_role_key = 'manager' then
    perform shop_private.assert_team_permission(p_shop_id, 'team.permissions.manage');
  end if;
  perform shop_private.lock_plan_resource(p_shop_id, 'active_members');
  perform shop_private.assert_team_permission(p_shop_id, 'team.manage');
  -- Recheck retries after acquiring the same seat lock used by acceptance.
  select event.after_state || jsonb_build_object('invitationCode', invitation.invitation_code) into v_result
    from public.shop_team_events event join public.shop_team_invitations invitation on invitation.id=event.target_invitation_id
    where event.request_id=p_request_id and event.shop_id=p_shop_id and event.actor_user_id=auth.uid() and event.action='invite';
  if v_result is not null then return v_result; end if;
  update public.shop_team_invitations set status = 'expired'
  where shop_id = p_shop_id and email = v_email and status = 'pending'
    and expires_at <= clock_timestamp();

  perform shop_private.lock_plan_resource(p_shop_id, 'active_members');
  perform shop_private.assert_assignable_team_role(p_shop_id, v_role_id);
  if exists (select 1 from public.shop_memberships m join public.profiles p on p.id=m.profile_id
    join auth.users u on u.id=p.user_id where m.shop_id=p_shop_id and lower(u.email)=v_email) then
    raise exception 'MEMBER_ALREADY_EXISTS' using errcode = '23505';
  end if;
  if exists (select 1 from public.shop_team_invitations where shop_id=p_shop_id and email=v_email
      and status='pending' and expires_at > now()) then
    raise exception 'INVITATION_ALREADY_EXISTS' using errcode = '23505';
  end if;
    insert into public.shop_team_invitations (request_id, shop_id, email, display_name,
      role_id, invited_by_user_id, job_title)
    values (p_request_id, p_shop_id, v_email, nullif(btrim(p_display_name), ''),
      v_role_id, auth.uid(), nullif(btrim(p_job_title),''))
    returning id, invitation_code into v_invitation_id, v_code;
    insert into public.shop_team_invitation_locations (shop_id, invitation_id, location_id)
      select p_shop_id, v_invitation_id, requested.id from unnest(p_location_ids) requested(id);
    v_result := jsonb_build_object('kind', 'invited', 'invitationId', v_invitation_id,
      'invitationCode', v_code, 'expiresAt', clock_timestamp() + interval '7 days');
    insert into public.shop_team_events (request_id, shop_id, actor_user_id, action,
      target_invitation_id, after_state)
    values (p_request_id, p_shop_id, auth.uid(), 'invite', v_invitation_id,
      (v_result - 'invitationCode') || jsonb_build_object('fullName',p_display_name,'jobTitle',p_job_title,'roleKey',p_role_key,'locationIds',p_location_ids));
  return v_result;
end;
$$;
revoke all on function shop_private.invite_shop_staff(uuid,uuid,text,text,text,uuid[],text) from public,anon,authenticated;
grant execute on function shop_private.invite_shop_staff(uuid,uuid,text,text,text,uuid[],text) to service_role;
create or replace function shop_private.invite_shop_member(p_request_id uuid,p_shop_id uuid,p_email text,
  p_display_name text,p_role_key text,p_location_ids uuid[])
returns jsonb language sql security definer set search_path = '' as $$
  select shop_private.invite_shop_staff(p_request_id,p_shop_id,p_email,p_display_name,p_role_key,p_location_ids,null);
$$;
create function public.invite_shop_staff(p_request_id uuid,p_shop_id uuid,p_email text,
  p_display_name text,p_job_title text,p_role_key text,p_location_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if coalesce(length(btrim(p_display_name)),0) not between 2 and 160
    or length(btrim(p_job_title)) > 160 then raise exception 'INVALID_MEMBER_DETAILS' using errcode='22023'; end if;
  v_result := shop_private.invite_shop_staff(p_request_id,p_shop_id,p_email,p_display_name,p_role_key,p_location_ids,p_job_title);
  return v_result;
end;
$$;
revoke all on function public.invite_shop_staff(uuid,uuid,text,text,text,text,uuid[]) from public,anon;
grant execute on function public.invite_shop_staff(uuid,uuid,text,text,text,text,uuid[]) to authenticated,service_role;
create or replace function shop_private.accept_shop_invitation(
  p_request_id uuid,
  p_invitation_code uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_invitation public.shop_team_invitations%rowtype; v_user_id uuid := auth.uid();
  v_email text; v_shop_id uuid; v_portal_id uuid; v_profile_id uuid; v_membership_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode = '22023'; end if;
  select event.shop_id into v_shop_id from public.shop_team_events event
    join public.shop_team_invitations invitation on invitation.id=event.target_invitation_id
    where event.request_id = p_request_id and event.action = 'accept'
      and event.actor_user_id = v_user_id and invitation.invitation_code=p_invitation_code;
  if found then return v_shop_id; end if;

  select invitation.shop_id into v_shop_id
  from public.shop_team_invitations invitation
  where invitation.invitation_code = p_invitation_code;
  if not found then raise exception 'INVITATION_UNAVAILABLE' using errcode = '55000'; end if;
  perform shop_private.lock_plan_resource(v_shop_id, 'active_members');
  if exists(select 1 from public.shop_team_events event join public.shop_team_invitations i on i.id=event.target_invitation_id
    where event.request_id=p_request_id and event.actor_user_id=v_user_id and event.action='accept' and i.invitation_code=p_invitation_code) then return v_shop_id; end if;
  select * into v_invitation from public.shop_team_invitations invitation
    where invitation.invitation_code = p_invitation_code for update;
  if not found or v_invitation.status <> 'pending'
    or v_invitation.expires_at <= clock_timestamp() then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = '55000';
  end if;
  select lower(auth_user.email) into v_email from auth.users auth_user
    where auth_user.id = v_user_id and auth_user.email_confirmed_at is not null;
  if v_email is null or v_email <> v_invitation.email then
    raise exception 'INVITATION_EMAIL_MISMATCH' using errcode = '42501';
  end if;
  if not exists (select 1 from public.roles where id=v_invitation.role_id and archived_at is null)
    or exists (select 1 from public.shop_team_invitation_locations link join public.shop_locations l on l.id=link.location_id
      where link.invitation_id=v_invitation.id and l.status <> 'active') then
    raise exception 'INVITATION_UNAVAILABLE' using errcode='55000'; end if;
  select shop.portal_id into v_portal_id from public.shops shop
    where shop.id = v_invitation.shop_id;
  select profile.id into v_profile_id from public.profiles profile
    where profile.user_id = v_user_id and profile.portal_id = v_portal_id;
  if v_profile_id is null then
    insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
    values (v_user_id, v_portal_id, v_invitation.display_name, v_email)
    returning id into v_profile_id;
  elsif not exists (select 1 from public.profiles profile where profile.id = v_profile_id
      and profile.status = 'active'::public.profile_status) then
    raise exception 'PROFILE_INACTIVE' using errcode = '42501';
  end if;
  if exists (select 1 from public.shop_memberships membership
    where membership.shop_id = v_invitation.shop_id and membership.profile_id = v_profile_id) then
    if exists (select 1 from public.shop_memberships membership
      where membership.shop_id = v_invitation.shop_id and membership.profile_id = v_profile_id
        and membership.removed_at is not null) then
      raise exception 'MEMBER_REMOVED' using errcode = '55000';
    end if;
    raise exception 'MEMBER_ALREADY_EXISTS' using errcode = '23505';
  end if;

  update public.shop_team_invitations set status = 'accepted',
    accepted_at = clock_timestamp() where id = v_invitation.id;
  insert into public.shop_memberships (shop_id, profile_id, role, status, team_full_name, job_title)
  values (v_invitation.shop_id, v_profile_id, 'employee', 'active', v_invitation.display_name, v_invitation.job_title)
  returning id into v_membership_id;
  delete from public.membership_roles where membership_id = v_membership_id;
  insert into public.membership_roles (membership_id, role_id)
  values (v_membership_id, v_invitation.role_id);
  delete from public.membership_location_assignments where membership_id = v_membership_id;
  insert into public.membership_location_assignments (shop_id, membership_id, location_id)
    select v_invitation.shop_id, v_membership_id, link.location_id
    from public.shop_team_invitation_locations link where link.invitation_id = v_invitation.id;
  update public.shop_team_invitations set accepted_membership_id = v_membership_id
    where id = v_invitation.id;
  insert into public.shop_team_events (request_id, shop_id, actor_user_id, action,
    target_membership_id, target_invitation_id, after_state)
  values (p_request_id, v_invitation.shop_id, v_user_id, 'accept', v_membership_id,
    v_invitation.id, shop_private.team_member_snapshot(v_membership_id));
  return v_invitation.shop_id;
end;
$$;
create or replace function shop_private.manage_shop_member(
  p_request_id uuid, p_shop_id uuid, p_membership_id uuid, p_action text,
  p_role_key text default null, p_location_ids uuid[] default null, p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_target public.shop_memberships%rowtype; v_role_id uuid; v_before jsonb;
begin
  perform shop_private.assert_team_permission(p_shop_id,
    case when p_action = 'change_role' then 'team.permissions.manage' else 'team.manage' end);
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode = '22023'; end if;
  if exists (select 1 from public.shop_team_events event where event.request_id = p_request_id) then return; end if;
  perform shop_private.lock_plan_resource(p_shop_id, 'active_members');
  perform shop_private.assert_team_permission(p_shop_id, case when p_action = 'change_role' then 'team.permissions.manage' else 'team.manage' end);
  select * into v_target from public.shop_memberships membership
    where membership.id = p_membership_id and membership.shop_id = p_shop_id for update;
  if not found then raise exception 'TEAM_MEMBER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_target.role = 'owner' then raise exception 'OWNER_TRANSFER_REQUIRED' using errcode = '23514'; end if;
  v_before := shop_private.team_member_snapshot(p_membership_id);

  if p_action = 'suspend' then
    if v_target.removed_at is not null then raise exception 'MEMBER_REMOVED' using errcode = '55000'; end if;
    update public.shop_memberships set status = 'suspended', updated_at = now() where id = p_membership_id;
  elsif p_action = 'reactivate' then
    if v_target.removed_at is not null then raise exception 'MEMBER_REMOVED' using errcode = '55000'; end if;
    update public.shop_memberships set status = 'active', updated_at = now() where id = p_membership_id;
  elsif p_action = 'remove' then
    update public.shop_memberships set status = 'suspended', removed_at = clock_timestamp(),
      updated_at = now() where id = p_membership_id;
  elsif p_action = 'change_role' then
    select role.id into v_role_id from public.roles role where role.shop_id = p_shop_id
      and role.key = p_role_key and role.archived_at is null;
    if v_role_id is null then raise exception 'INVALID_TEAM_ROLE' using errcode = '22023'; end if;
    perform shop_private.assert_assignable_team_role(p_shop_id, v_role_id);
    delete from public.membership_roles where membership_id = p_membership_id;
    insert into public.membership_roles (membership_id, role_id) values (p_membership_id, v_role_id);
  elsif p_action = 'assign_locations' then
    if coalesce(cardinality(p_location_ids), 0) < 1 or exists (
      select 1 from unnest(p_location_ids) requested(id) where not exists (
        select 1 from public.shop_locations location where location.id = requested.id
          and location.shop_id = p_shop_id and location.status = 'active')) then
      raise exception 'INVALID_LOCATION_ASSIGNMENT' using errcode = '23514';
    end if;
    delete from public.membership_location_assignments where membership_id = p_membership_id;
    insert into public.membership_location_assignments (shop_id, membership_id, location_id)
      select p_shop_id, p_membership_id, requested.id from unnest(p_location_ids) requested(id);
  else raise exception 'INVALID_TEAM_ACTION' using errcode = '22023';
  end if;
  insert into public.shop_team_events (request_id, shop_id, actor_user_id, action,
    target_membership_id, reason, before_state, after_state)
  values (p_request_id, p_shop_id, auth.uid(), p_action, p_membership_id,
    nullif(btrim(p_reason), ''), v_before, shop_private.team_member_snapshot(p_membership_id));
end;
$$;
create function public.save_shop_member_details(p_request_id uuid,p_shop_id uuid,p_membership_id uuid,
  p_full_name text,p_job_title text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_before jsonb;
begin
  perform shop_private.assert_team_permission(p_shop_id,'team.manage');
  if p_request_id is null or coalesce(length(btrim(p_full_name)),0) not between 2 and 160
    or length(btrim(p_job_title)) > 160 then raise exception 'INVALID_MEMBER_DETAILS' using errcode='22023'; end if;
  perform shop_private.lock_plan_resource(p_shop_id,'active_members');
  perform shop_private.assert_team_permission(p_shop_id,'team.manage');
  if exists (select 1 from public.shop_team_events where request_id=p_request_id and shop_id=p_shop_id
    and actor_user_id=auth.uid() and action='edit_details') then return; end if;
  select shop_private.team_member_snapshot(id) into v_before from public.shop_memberships
    where id=p_membership_id and shop_id=p_shop_id and role <> 'owner' and removed_at is null for update;
  if v_before is null then raise exception 'TEAM_MEMBER_NOT_FOUND' using errcode='P0002'; end if;
  update public.shop_memberships set team_full_name=btrim(p_full_name),job_title=nullif(btrim(p_job_title),'')
    where id=p_membership_id;
  insert into public.shop_team_events(request_id,shop_id,actor_user_id,action,target_membership_id,before_state,after_state)
    values(p_request_id,p_shop_id,auth.uid(),'edit_details',p_membership_id,v_before,
      jsonb_build_object('fullName',btrim(p_full_name),'jobTitle',nullif(btrim(p_job_title),'')));
end;
$$;
revoke all on function public.save_shop_member_details(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.save_shop_member_details(uuid,uuid,uuid,text,text) to authenticated,service_role;

create or replace function shop_private.team_member_snapshot(p_membership_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'fullName', membership.team_full_name, 'jobTitle', membership.job_title, 'membershipId', membership.id, 'shopId', membership.shop_id,
    'role', membership.role, 'roleKey', coalesce(role.key, membership.role),
    'status', case when membership.removed_at is not null then 'removed' else membership.status::text end,
    'locations', coalesce((select jsonb_agg(assignment.location_id order by assignment.location_id)
      from public.membership_location_assignments assignment
      where assignment.membership_id = membership.id), '[]'::jsonb)
  )
  from public.shop_memberships membership
  left join lateral (
    select assigned_role.key from public.membership_roles membership_role
    join public.roles assigned_role on assigned_role.id = membership_role.role_id
    where membership_role.membership_id = membership.id
    order by assigned_role.is_system desc, assigned_role.created_at, assigned_role.id limit 1
  ) role on true
  where membership.id = p_membership_id;
$$;
-- One member edit transaction: a failed role/location/detail guard rolls everything back.
create function public.save_shop_team_member(p_request_id uuid,p_shop_id uuid,p_membership_id uuid,
  p_full_name text,p_job_title text,p_role_key text,p_location_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_before jsonb;
begin
  perform shop_private.assert_team_permission(p_shop_id,'team.manage');
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode='22023'; end if;
  perform shop_private.lock_plan_resource(p_shop_id,'active_members');
  perform shop_private.assert_team_permission(p_shop_id,'team.manage');
  if exists(select 1 from public.shop_team_events where request_id=p_request_id and shop_id=p_shop_id
    and actor_user_id=auth.uid() and action='edit_details' and target_membership_id=p_membership_id) then return; end if;
  v_before := shop_private.team_member_snapshot(p_membership_id);
  if v_before->>'shopId' is distinct from p_shop_id::text then raise exception 'TEAM_MEMBER_NOT_FOUND' using errcode='P0002'; end if;
  if v_before->>'roleKey' is distinct from p_role_key then
    perform shop_private.manage_shop_member(gen_random_uuid(),p_shop_id,p_membership_id,'change_role',p_role_key,null,null);
  end if;
  perform shop_private.manage_shop_member(gen_random_uuid(),p_shop_id,p_membership_id,'assign_locations',null,p_location_ids,null);
  perform public.save_shop_member_details(p_request_id,p_shop_id,p_membership_id,p_full_name,p_job_title);
end;
$$;
revoke all on function public.save_shop_team_member(uuid,uuid,uuid,text,text,text,uuid[]) from public,anon;
grant execute on function public.save_shop_team_member(uuid,uuid,uuid,text,text,text,uuid[]) to authenticated,service_role;
notify pgrst, 'reload schema';
