-- SS-TEAM-001: tenant-controlled team invitations, practical role presets,
-- location assignment, owner continuity, and immutable team audit evidence.

alter table public.shop_memberships
  add column removed_at timestamptz,
  add constraint shop_memberships_removed_state_check
    check (removed_at is null or status = 'suspended'::public.shop_membership_status);

alter table public.roles add column key text;
create unique index roles_shop_key_unique
  on public.roles (shop_id, key) where key is not null;

create table public.shop_team_invitations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  invitation_code uuid not null unique default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  email text not null check (length(email) between 3 and 254 and email = lower(btrim(email))),
  display_name text check (display_name is null or length(btrim(display_name)) between 1 and 160),
  role_id uuid not null references public.roles (id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_user_id uuid not null references auth.users (id) on delete restrict,
  accepted_membership_id uuid references public.shop_memberships (id) on delete restrict,
  expires_at timestamptz not null default (clock_timestamp() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique (id, shop_id),
  check ((status = 'accepted') = (accepted_at is not null)),
  check ((status = 'revoked') = (revoked_at is not null))
);
create unique index shop_team_invitations_pending_email_idx
  on public.shop_team_invitations (shop_id, email) where status = 'pending';

create table public.shop_team_invitation_locations (
  shop_id uuid not null,
  invitation_id uuid not null,
  location_id uuid not null,
  primary key (invitation_id, location_id),
  foreign key (invitation_id, shop_id)
    references public.shop_team_invitations (id, shop_id) on delete cascade,
  foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict
);

create table public.shop_team_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  shop_id uuid not null references public.shops (id) on delete restrict,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  action text not null check (action in (
    'invite', 'add', 'accept', 'revoke_invitation', 'suspend', 'reactivate',
    'remove', 'change_role', 'assign_locations', 'transfer_ownership'
  )),
  target_membership_id uuid references public.shop_memberships (id) on delete restrict,
  target_invitation_id uuid references public.shop_team_invitations (id) on delete restrict,
  reason text check (reason is null or length(btrim(reason)) between 2 and 1000),
  before_state jsonb,
  after_state jsonb not null,
  occurred_at timestamptz not null default clock_timestamp()
);
create index shop_team_events_shop_time_idx
  on public.shop_team_events (shop_id, occurred_at desc, id desc);

alter table public.shop_team_invitations enable row level security;
alter table public.shop_team_invitation_locations enable row level security;
alter table public.shop_team_events enable row level security;
revoke all on public.shop_team_invitations, public.shop_team_invitation_locations,
  public.shop_team_events from public, anon, authenticated;
grant all on public.shop_team_invitations, public.shop_team_invitation_locations,
  public.shop_team_events to service_role;

insert into public.permissions (portal_id, key, description)
select portal.id, permission.key, permission.description
from public.portals portal
cross join (values
  ('products.view', 'View the product catalog'),
  ('products.manage', 'Manage the product catalog'),
  ('services.view', 'View the service catalog'),
  ('services.manage', 'Manage the service catalog'),
  ('inventory.view', 'View inventory and stock history'),
  ('inventory.manage', 'Manage stock receipts and thresholds'),
  ('inventory.adjust', 'Record stock counts and manual stock adjustments'),
  ('sales.view', 'View sales'),
  ('sales.manage', 'Create and edit sale drafts'),
  ('sales.issue', 'Issue sales and deduct product inventory'),
  ('payments.view', 'View customer payments and receivables'),
  ('payments.receive', 'Record and allocate customer receipts'),
  ('payments.reverse', 'Reverse mistaken customer receipts'),
  ('payments.refund', 'Record outbound customer refunds'),
  ('vendors.view', 'View suppliers'),
  ('vendors.manage', 'Manage suppliers'),
  ('vendor_invoices.view', 'View supplier purchases'),
  ('vendor_invoices.manage', 'Create and post supplier purchases'),
  ('supplier_payments.record', 'Record supplier payments'),
  ('supplier_payments.reverse', 'Reverse supplier payments'),
  ('supplier_credits.manage', 'Record supplier credits'),
  ('purchase_returns.manage', 'Return purchased stock'),
  ('clients.view', 'View customers'),
  ('clients.manage', 'Manage customers'),
  ('expenses.view', 'View expenses'),
  ('expenses.manage', 'Manage expenses'),
  ('reports.view', 'View operational reports'),
  ('reports.cost_profit.view', 'View cost and profit figures'),
  ('settings.manage', 'Manage business settings'),
  ('discounts.manage', 'Apply discretionary discounts'),
  ('team.view', 'View the team and assignments'),
  ('team.manage', 'Invite, suspend, remove, and assign staff'),
  ('team.permissions.manage', 'Change staff roles and permissions'),
  ('team.audit.view', 'View sensitive team audit history')
) as permission(key, description)
where portal.key = 'shop-crm'
on conflict (portal_id, key) do update set description = excluded.description;

create function shop_private.ensure_shop_team_roles(p_shop_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_portal_id uuid;
begin
  select shop.portal_id into v_portal_id from public.shops shop where shop.id = p_shop_id;
  if v_portal_id is null then raise exception 'SHOP_NOT_FOUND' using errcode = 'P0002'; end if;

  insert into public.roles (shop_id, name, key, is_system) values
    (p_shop_id, 'Manager', 'manager', true),
    (p_shop_id, 'Cashier', 'cashier', true),
    (p_shop_id, 'Barber', 'barber', true),
    (p_shop_id, 'Staff', 'staff', true)
  on conflict (shop_id, key) where key is not null do update
    set name = excluded.name, is_system = true;

  insert into public.role_permissions (role_id, permission_id)
  select role.id, permission.id
  from public.roles role
  join public.permissions permission on permission.portal_id = v_portal_id
  where role.shop_id = p_shop_id and role.key is not null and (
    (role.key = 'manager' and permission.key in (
      'products.view','products.manage','services.view','services.manage',
      'inventory.view','inventory.manage','inventory.adjust',
      'sales.view','sales.manage','sales.issue','discounts.manage',
      'payments.view','payments.receive','payments.reverse','payments.refund',
      'vendors.view','vendors.manage','vendor_invoices.view','vendor_invoices.manage',
      'supplier_payments.record','supplier_payments.reverse','supplier_credits.manage','purchase_returns.manage',
      'clients.view','clients.manage','expenses.view','expenses.manage',
      'reports.view','reports.cost_profit.view','settings.manage','team.view','team.manage','team.audit.view'
    )) or
    (role.key = 'cashier' and permission.key in (
      'products.view','services.view','inventory.view','sales.view','sales.manage','sales.issue',
      'payments.view','payments.receive','clients.view','clients.manage','expenses.view','team.view'
    )) or
    (role.key = 'barber' and permission.key in (
      'products.view','services.view','sales.view','sales.manage','clients.view','clients.manage',
      'payments.receive','team.view'
    )) or
    (role.key = 'staff' and permission.key in (
      'products.view','services.view','inventory.view','sales.view','clients.view','expenses.view','team.view'
    ))
  ) on conflict do nothing;
end;
$$;
revoke all on function shop_private.ensure_shop_team_roles(uuid) from public, anon, authenticated;
grant execute on function shop_private.ensure_shop_team_roles(uuid) to service_role;

select shop_private.ensure_shop_team_roles(shop.id) from public.shops shop;

-- Preserve existing custom catalog access while separating product and stock
-- permissions for all future role changes.
insert into public.role_permissions (role_id, permission_id)
select existing.role_id, replacement.id
from public.role_permissions existing
join public.permissions source on source.id = existing.permission_id
join public.permissions replacement on replacement.portal_id = source.portal_id
  and replacement.key = case source.key
    when 'inventory.view' then 'products.view'
    when 'inventory.manage' then 'products.manage' end
where source.key in ('inventory.view', 'inventory.manage')
on conflict do nothing;

create function shop_private.create_shop_team_roles()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform shop_private.ensure_shop_team_roles(new.id); return new; end;
$$;
revoke all on function shop_private.create_shop_team_roles() from public, anon, authenticated, service_role;
create trigger trg_shops_create_team_roles after insert on public.shops
for each row execute function shop_private.create_shop_team_roles();

create function shop_private.prevent_last_active_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and old.status = 'active'::public.shop_membership_status
    and (tg_op = 'DELETE' or new.role <> 'owner'
      or new.status <> 'active'::public.shop_membership_status
      or new.removed_at is not null)
    and not exists (
      select 1 from public.shop_memberships membership
      where membership.shop_id = old.shop_id and membership.id <> old.id
        and membership.role = 'owner'
        and membership.status = 'active'::public.shop_membership_status
        and membership.removed_at is null
    ) then
    raise exception 'LAST_OWNER_REQUIRED' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function shop_private.prevent_last_active_owner() from public, anon, authenticated, service_role;
create trigger trg_shop_memberships_owner_continuity
before update or delete on public.shop_memberships for each row
execute function shop_private.prevent_last_active_owner();

create function shop_private.prevent_team_event_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'SHOP_TEAM_EVENT_IMMUTABLE' using errcode = '55000'; end;
$$;
revoke all on function shop_private.prevent_team_event_mutation() from public, anon, authenticated, service_role;
create trigger trg_shop_team_events_immutable before update or delete or truncate
on public.shop_team_events for each statement execute function shop_private.prevent_team_event_mutation();

create function shop_private.team_member_snapshot(p_membership_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'membershipId', membership.id, 'shopId', membership.shop_id,
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
revoke all on function shop_private.team_member_snapshot(uuid) from public, anon, authenticated;
grant execute on function shop_private.team_member_snapshot(uuid) to service_role;

create function shop_private.assert_team_permission(p_shop_id uuid, p_permission text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if not shop_private.is_member(p_shop_id)
    or not shop_private.has_permission(p_shop_id, p_permission) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
end;
$$;
revoke all on function shop_private.assert_team_permission(uuid, text) from public, anon, authenticated;
grant execute on function shop_private.assert_team_permission(uuid, text) to service_role;

create function shop_private.shop_team_read(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_can_manage boolean; v_can_permissions boolean; v_can_audit boolean;
begin
  perform shop_private.assert_team_permission(p_shop_id, 'team.view');
  v_can_manage := shop_private.has_permission(p_shop_id, 'team.manage');
  v_can_permissions := shop_private.has_permission(p_shop_id, 'team.permissions.manage');
  v_can_audit := shop_private.has_permission(p_shop_id, 'team.audit.view');
  return jsonb_build_object(
    'canManage', v_can_manage,
    'canManagePermissions', v_can_permissions,
    'canViewAudit', v_can_audit,
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', membership.id, 'name', profile.display_name, 'email', profile.email_snapshot,
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
      'key', role.key, 'name', role.name,
      'permissionKeys', coalesce(permission_keys.value, '[]'::jsonb)
    ) order by role.name), '[]'::jsonb)
      from public.roles role
      left join lateral (select jsonb_agg(permission.key order by permission.key) value
        from public.role_permissions role_permission join public.permissions permission on permission.id = role_permission.permission_id
        where role_permission.role_id = role.id) permission_keys on true
      where role.shop_id = p_shop_id and role.key is not null),
    'locations', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', location.id, 'name', location.name, 'status', location.status
    ) order by location.is_default desc, location.created_at), '[]'::jsonb)
      from public.shop_locations location where location.shop_id = p_shop_id),
    'invitations', case when v_can_manage then (select coalesce(jsonb_agg(jsonb_build_object(
      'id', invitation.id, 'email', invitation.email, 'name', invitation.display_name,
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

create function public.shop_team_read(p_shop_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.shop_team_read(p_shop_id);
$$;

create function shop_private.invite_shop_member(
  p_request_id uuid, p_shop_id uuid, p_email text, p_display_name text,
  p_role_key text, p_location_ids uuid[]
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
  where role.shop_id = p_shop_id and role.key = p_role_key and role.is_system;
  if v_role_id is null then raise exception 'INVALID_TEAM_ROLE' using errcode = '22023'; end if;
  if p_role_key = 'manager' then
    perform shop_private.assert_team_permission(p_shop_id, 'team.permissions.manage');
  end if;
  update public.shop_team_invitations set status = 'expired'
  where shop_id = p_shop_id and email = v_email and status = 'pending'
    and expires_at <= clock_timestamp();

  select profile.id into v_profile_id
  from auth.users auth_user
  join public.profiles profile on profile.user_id = auth_user.id
  join public.shops shop on shop.id = p_shop_id and shop.portal_id = profile.portal_id
  where lower(auth_user.email) = v_email and auth_user.email_confirmed_at is not null
    and profile.status = 'active'::public.profile_status;

  if v_profile_id is not null then
    if exists (select 1 from public.shop_memberships membership
      where membership.shop_id = p_shop_id and membership.profile_id = v_profile_id) then
      if exists (select 1 from public.shop_memberships membership
        where membership.shop_id = p_shop_id and membership.profile_id = v_profile_id
          and membership.removed_at is not null) then
        raise exception 'MEMBER_REMOVED' using errcode = '55000';
      end if;
      raise exception 'MEMBER_ALREADY_EXISTS' using errcode = '23505';
    end if;
    insert into public.shop_memberships (shop_id, profile_id, role, status)
    values (p_shop_id, v_profile_id, 'employee', 'active')
    returning id into v_membership_id;
    delete from public.membership_roles where membership_id = v_membership_id;
    insert into public.membership_roles (membership_id, role_id) values (v_membership_id, v_role_id);
    delete from public.membership_location_assignments where membership_id = v_membership_id;
    insert into public.membership_location_assignments (shop_id, membership_id, location_id)
      select p_shop_id, v_membership_id, requested.id from unnest(p_location_ids) requested(id);
    v_result := jsonb_build_object('kind', 'added', 'membershipId', v_membership_id);
    insert into public.shop_team_events (request_id, shop_id, actor_user_id, action,
      target_membership_id, after_state)
    values (p_request_id, p_shop_id, auth.uid(), 'add', v_membership_id,
      shop_private.team_member_snapshot(v_membership_id));
  else
    insert into public.shop_team_invitations (request_id, shop_id, email, display_name,
      role_id, invited_by_user_id)
    values (p_request_id, p_shop_id, v_email, nullif(btrim(p_display_name), ''),
      v_role_id, auth.uid())
    returning id, invitation_code into v_invitation_id, v_code;
    insert into public.shop_team_invitation_locations (shop_id, invitation_id, location_id)
      select p_shop_id, v_invitation_id, requested.id from unnest(p_location_ids) requested(id);
    v_result := jsonb_build_object('kind', 'invited', 'invitationId', v_invitation_id,
      'invitationCode', v_code, 'expiresAt', clock_timestamp() + interval '7 days');
    insert into public.shop_team_events (request_id, shop_id, actor_user_id, action,
      target_invitation_id, after_state)
    values (p_request_id, p_shop_id, auth.uid(), 'invite', v_invitation_id,
      v_result - 'invitationCode');
  end if;
  return v_result;
end;
$$;

create function shop_private.revoke_shop_invitation(
  p_request_id uuid, p_shop_id uuid, p_invitation_id uuid, p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_after jsonb;
begin
  perform shop_private.assert_team_permission(p_shop_id, 'team.manage');
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode = '22023'; end if;
  if exists (select 1 from public.shop_team_events event where event.request_id = p_request_id) then return; end if;
  select to_jsonb(invitation) - 'invitation_code' into v_before
  from public.shop_team_invitations invitation
  where invitation.id = p_invitation_id and invitation.shop_id = p_shop_id
    and invitation.status = 'pending' for update;
  if v_before is null then raise exception 'INVITATION_UNAVAILABLE' using errcode = '55000'; end if;
  update public.shop_team_invitations set status = 'revoked', revoked_at = clock_timestamp()
  where id = p_invitation_id returning to_jsonb(shop_team_invitations) - 'invitation_code' into v_after;
  insert into public.shop_team_events (request_id, shop_id, actor_user_id, action,
    target_invitation_id, reason, before_state, after_state)
  values (p_request_id, p_shop_id, auth.uid(), 'revoke_invitation', p_invitation_id,
    nullif(btrim(p_reason), ''), v_before, v_after);
end;
$$;

create function public.revoke_shop_invitation(
  p_request_id uuid, p_shop_id uuid, p_invitation_id uuid, p_reason text default null
) returns void language sql security definer set search_path = '' as $$
  select shop_private.revoke_shop_invitation(p_request_id, p_shop_id, p_invitation_id, p_reason);
$$;

create function public.invite_shop_member(
  p_request_id uuid, p_shop_id uuid, p_email text, p_display_name text,
  p_role_key text, p_location_ids uuid[]
) returns jsonb language sql security definer set search_path = '' as $$
  select shop_private.invite_shop_member(p_request_id, p_shop_id, p_email,
    p_display_name, p_role_key, p_location_ids);
$$;

create function shop_private.accept_shop_invitation(p_request_id uuid, p_invitation_code uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_invitation public.shop_team_invitations%rowtype; v_user_id uuid := auth.uid();
  v_email text; v_portal_id uuid; v_profile_id uuid; v_membership_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode = '22023'; end if;
  select event.shop_id into v_portal_id from public.shop_team_events event
    where event.request_id = p_request_id and event.action = 'accept'
      and event.actor_user_id = v_user_id;
  if found then return v_portal_id; end if;
  select * into v_invitation from public.shop_team_invitations invitation
    where invitation.invitation_code = p_invitation_code for update;
  if not found or v_invitation.status <> 'pending' or v_invitation.expires_at <= clock_timestamp() then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = '55000';
  end if;
  select lower(auth_user.email) into v_email from auth.users auth_user
    where auth_user.id = v_user_id and auth_user.email_confirmed_at is not null;
  if v_email is null or v_email <> v_invitation.email then
    raise exception 'INVITATION_EMAIL_MISMATCH' using errcode = '42501';
  end if;
  select shop.portal_id into v_portal_id from public.shops shop where shop.id = v_invitation.shop_id;
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
  insert into public.shop_memberships (shop_id, profile_id, role, status)
  values (v_invitation.shop_id, v_profile_id, 'employee', 'active')
  returning id into v_membership_id;
  delete from public.membership_roles where membership_id = v_membership_id;
  insert into public.membership_roles (membership_id, role_id) values (v_membership_id, v_invitation.role_id);
  delete from public.membership_location_assignments where membership_id = v_membership_id;
  insert into public.membership_location_assignments (shop_id, membership_id, location_id)
    select v_invitation.shop_id, v_membership_id, link.location_id
    from public.shop_team_invitation_locations link where link.invitation_id = v_invitation.id;
  update public.shop_team_invitations set status = 'accepted', accepted_at = clock_timestamp(),
    accepted_membership_id = v_membership_id where id = v_invitation.id;
  insert into public.shop_team_events (request_id, shop_id, actor_user_id, action,
    target_membership_id, target_invitation_id, after_state)
  values (p_request_id, v_invitation.shop_id, v_user_id, 'accept', v_membership_id,
    v_invitation.id, shop_private.team_member_snapshot(v_membership_id));
  return v_invitation.shop_id;
end;
$$;

create function public.accept_shop_invitation(p_request_id uuid, p_invitation_code uuid)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.accept_shop_invitation(p_request_id, p_invitation_code);
$$;

create function shop_private.manage_shop_member(
  p_request_id uuid, p_shop_id uuid, p_membership_id uuid, p_action text,
  p_role_key text default null, p_location_ids uuid[] default null, p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_target public.shop_memberships%rowtype; v_role_id uuid; v_before jsonb;
begin
  perform shop_private.assert_team_permission(p_shop_id,
    case when p_action = 'change_role' then 'team.permissions.manage' else 'team.manage' end);
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode = '22023'; end if;
  if exists (select 1 from public.shop_team_events event where event.request_id = p_request_id) then return; end if;
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
      and role.key = p_role_key and role.is_system;
    if v_role_id is null then raise exception 'INVALID_TEAM_ROLE' using errcode = '22023'; end if;
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

create function public.manage_shop_member(
  p_request_id uuid, p_shop_id uuid, p_membership_id uuid, p_action text,
  p_role_key text default null, p_location_ids uuid[] default null, p_reason text default null
) returns void language sql security definer set search_path = '' as $$
  select shop_private.manage_shop_member(p_request_id, p_shop_id, p_membership_id,
    p_action, p_role_key, p_location_ids, p_reason);
$$;

create function shop_private.transfer_shop_ownership(
  p_request_id uuid, p_shop_id uuid, p_target_membership_id uuid, p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_owner_id uuid; v_owner_profile uuid; v_target_profile uuid; v_manager_role uuid; v_before jsonb;
begin
  if not shop_private.is_owner(p_shop_id) then raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501'; end if;
  if p_reason is null or length(btrim(p_reason)) < 2 then raise exception 'REASON_REQUIRED' using errcode = '22023'; end if;
  if exists (select 1 from public.shop_team_events event where event.request_id = p_request_id) then return; end if;
  select membership.id, membership.profile_id into v_owner_id, v_owner_profile
  from public.shop_memberships membership join public.profiles profile on profile.id = membership.profile_id
  where membership.shop_id = p_shop_id and membership.role = 'owner'
    and membership.status = 'active' and membership.removed_at is null and profile.user_id = auth.uid()
  for update of membership;
  select membership.profile_id into v_target_profile from public.shop_memberships membership
  where membership.id = p_target_membership_id and membership.shop_id = p_shop_id
    and membership.role <> 'owner' and membership.status = 'active' and membership.removed_at is null
  for update;
  if v_target_profile is null then raise exception 'INVALID_OWNERSHIP_TARGET' using errcode = '23514'; end if;
  if exists (select 1 from public.subscriptions subscription where subscription.profile_id = v_target_profile) then
    raise exception 'TARGET_HAS_SUBSCRIPTION' using errcode = '23514';
  end if;
  select role.id into v_manager_role from public.roles role where role.shop_id = p_shop_id and role.key = 'manager';
  v_before := jsonb_build_object('owner', shop_private.team_member_snapshot(v_owner_id),
    'target', shop_private.team_member_snapshot(p_target_membership_id));
  update public.shop_memberships set role = 'owner', updated_at = now() where id = p_target_membership_id;
  delete from public.membership_roles where membership_id = p_target_membership_id;
  update public.subscriptions set profile_id = v_target_profile where profile_id = v_owner_profile;
  update public.shop_memberships set role = 'employee', updated_at = now() where id = v_owner_id;
  delete from public.membership_roles where membership_id = v_owner_id;
  insert into public.membership_roles (membership_id, role_id) values (v_owner_id, v_manager_role);
  insert into public.membership_location_assignments (shop_id, membership_id, location_id)
    select p_shop_id, p_target_membership_id, location.id from public.shop_locations location
    where location.shop_id = p_shop_id and location.status = 'active' on conflict do nothing;
  insert into public.shop_team_events (request_id, shop_id, actor_user_id, action,
    target_membership_id, reason, before_state, after_state)
  values (p_request_id, p_shop_id, auth.uid(), 'transfer_ownership', p_target_membership_id,
    btrim(p_reason), v_before, jsonb_build_object('owner', shop_private.team_member_snapshot(p_target_membership_id),
      'formerOwner', shop_private.team_member_snapshot(v_owner_id)));
end;
$$;

create function public.transfer_shop_ownership(
  p_request_id uuid, p_shop_id uuid, p_target_membership_id uuid, p_reason text
) returns void language sql security definer set search_path = '' as $$
  select shop_private.transfer_shop_ownership(p_request_id, p_shop_id,
    p_target_membership_id, p_reason);
$$;

-- Manual stock corrections are sensitive independently of general inventory
-- management. Owners retain the existing permission shortcut.
insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id from public.roles role
join public.shops shop on shop.id = role.shop_id
join public.permissions permission on permission.portal_id = shop.portal_id and permission.key = 'inventory.adjust'
where role.key = 'manager' on conflict do nothing;

create function shop_private.require_inventory_adjust_permission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() = 'authenticated'
    and not shop_private.has_permission(new.shop_id, 'inventory.adjust') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function shop_private.require_inventory_adjust_permission()
from public, anon, authenticated, service_role;
create trigger trg_stock_adjustment_permission
before insert on public.stock_adjustment_requests for each row
execute function shop_private.require_inventory_adjust_permission();
create trigger trg_stock_count_adjustment_permission
before insert on public.stock_counts for each row
execute function shop_private.require_inventory_adjust_permission();

create or replace function shop_private.inventory_access(p_shop_id uuid)
returns table (can_view boolean, can_manage boolean, inventory_enabled boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform shop_private.assert_inventory_read_access(p_shop_id);
  return query select true,
    shop_private.has_permission(p_shop_id, 'inventory.manage')
      and shop_private.has_permission(p_shop_id, 'inventory.adjust'),
    exists (
      select 1 from public.shop_memberships owner_member
      join public.subscriptions subscription on subscription.profile_id = owner_member.profile_id
      join public.plans plan on plan.id = subscription.plan_id
      where owner_member.shop_id = p_shop_id and owner_member.role = 'owner'
        and owner_member.status = 'active'
        and coalesce((plan.features ->> 'inventory')::boolean, false)
        and ((subscription.status = 'trialing' and subscription.trial_end_at > now())
          or (subscription.status = 'active' and subscription.current_period_end > now()))
    );
end;
$$;

alter policy products_permission_read on public.products
  using (shop_private.has_permission(shop_id, 'products.view'));

create or replace function shop_private.save_product(
  p_shop_id uuid, p_product_id uuid, p_name text, p_sku text,
  p_barcode text, p_sale_price numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile_id uuid; v_product_id uuid; v_limit integer;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'products.manage');
  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 160
    or p_sale_price is null or p_sale_price < 0 or p_sale_price > 999999999.99
    or (p_sku is not null and length(btrim(p_sku)) > 80)
    or (p_barcode is not null and length(btrim(p_barcode)) > 80) then
    raise exception 'INVALID_PRODUCT' using errcode = '22023';
  end if;
  perform 1 from public.shops shop where shop.id = p_shop_id for update;
  if not found then raise exception 'SHOP_NOT_FOUND'; end if;
  perform shop_private.assert_shop_write_access(p_shop_id, 'products.manage');
  if p_product_id is null then
    select (plan.features ->> 'max_products')::integer into v_limit
    from public.shop_memberships membership
    join public.subscriptions subscription on subscription.profile_id = membership.profile_id
    join public.plans plan on plan.id = subscription.plan_id
    where membership.shop_id = p_shop_id and membership.role = 'owner'
      and membership.status = 'active';
    if v_limit is null or v_limit < 1 then raise exception 'PRODUCT_LIMIT_UNCONFIGURED'; end if;
    if (select count(*) from public.products product
        where product.shop_id = p_shop_id and product.is_active) >= v_limit then
      raise exception 'PRODUCT_LIMIT_REACHED' using errcode = '23514';
    end if;
    insert into public.products (shop_id, name, sku, barcode, sale_price, created_by_profile_id)
    values (p_shop_id, btrim(p_name), nullif(btrim(p_sku), ''),
      nullif(btrim(p_barcode), ''), p_sale_price, v_profile_id)
    returning id into v_product_id;
  else
    update public.products set name = btrim(p_name), sku = nullif(btrim(p_sku), ''),
      barcode = nullif(btrim(p_barcode), ''), sale_price = p_sale_price, updated_at = now()
    where id = p_product_id and shop_id = p_shop_id and is_active
    returning id into v_product_id;
    if v_product_id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  end if;
  return v_product_id;
end;
$$;

create or replace function shop_private.archive_product(p_shop_id uuid, p_product_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform shop_private.assert_shop_write_access(p_shop_id, 'products.manage');
  update public.products set is_active = false, updated_at = now()
  where id = p_product_id and shop_id = p_shop_id and is_active;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
end;
$$;

create function shop_private.require_service_discount_permission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() = 'authenticated'
    and coalesce(new.default_discount_value, 0) > 0
    and (tg_op = 'INSERT' or new.default_discount_type is distinct from old.default_discount_type
      or new.default_discount_value is distinct from old.default_discount_value)
    and not shop_private.has_permission(new.shop_id, 'discounts.manage') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function shop_private.require_service_discount_permission()
from public, anon, authenticated, service_role;
create trigger trg_services_discount_permission before insert or update on public.services
for each row execute function shop_private.require_service_discount_permission();

create or replace function shop_private.set_shop_business_mode(
  p_shop_id uuid, p_business_mode public.business_mode
) returns public.business_mode language plpgsql security definer set search_path = '' as $$
declare v_actor_profile_id uuid; v_previous_mode public.business_mode;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_shop_id is null or p_business_mode is null then
    raise exception 'INVALID_BUSINESS_MODE' using errcode = '22023';
  end if;
  -- Preserve the established public denial contract while allowing a
  -- delegated role with settings.manage to pass this guard.
  if not shop_private.has_permission(p_shop_id, 'settings.manage') then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  select shop.business_mode, membership.profile_id into v_previous_mode, v_actor_profile_id
  from public.shops shop
  join public.shop_memberships membership on membership.shop_id = shop.id
  join public.profiles profile on profile.id = membership.profile_id
  where shop.id = p_shop_id and shop.status = 'active'
    and membership.status = 'active' and membership.removed_at is null
    and profile.status = 'active' and profile.user_id = auth.uid()
  for update of shop;
  if not found then raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501'; end if;
  if v_previous_mode = p_business_mode then return v_previous_mode; end if;
  update public.shops set business_mode = p_business_mode, updated_at = now() where id = p_shop_id;
  insert into public.shop_business_mode_changes
    (shop_id, previous_mode, new_mode, changed_by_profile_id)
  values (p_shop_id, v_previous_mode, p_business_mode, v_actor_profile_id);
  return p_business_mode;
end;
$$;

create or replace function shop_private.save_shop_location(
  p_shop_id uuid, p_location_id uuid, p_name text, p_code text,
  p_address text, p_phone text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_location_id uuid;
begin
  if not shop_private.has_permission(p_shop_id, 'settings.manage') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_name is null or length(btrim(p_name)) not between 2 and 120 then
    raise exception 'INVALID_LOCATION_NAME' using errcode = '22023';
  end if;
  if p_location_id is null then
    insert into public.shop_locations (shop_id, name, code, address, phone)
    values (p_shop_id, btrim(p_name), nullif(btrim(p_code), ''),
      nullif(btrim(p_address), ''), nullif(btrim(p_phone), ''))
    returning id into v_location_id;
  else
    update public.shop_locations location set name = btrim(p_name),
      code = nullif(btrim(p_code), ''), address = nullif(btrim(p_address), ''),
      phone = nullif(btrim(p_phone), ''), updated_at = now()
    where location.id = p_location_id and location.shop_id = p_shop_id
    returning location.id into v_location_id;
    if v_location_id is null then raise exception 'LOCATION_NOT_FOUND' using errcode = 'P0002'; end if;
  end if;
  return v_location_id;
end;
$$;

create or replace function shop_private.archive_shop_location(p_shop_id uuid, p_location_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not shop_private.has_permission(p_shop_id, 'settings.manage') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  update public.shop_locations location set status = 'archived', archived_at = now(), updated_at = now()
  where location.id = p_location_id and location.shop_id = p_shop_id
    and not location.is_default and location.status = 'active';
  if not found then raise exception 'LOCATION_NOT_ARCHIVABLE' using errcode = '55000'; end if;
end;
$$;

create or replace function shop_private.list_shop_locations(p_shop_id uuid)
returns table (
  id uuid, shop_id uuid, name text, code text, address text, phone text,
  status public.shop_location_status, is_default boolean, archived_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select location.id, location.shop_id, location.name, location.code,
    location.address, location.phone, location.status, location.is_default,
    location.archived_at
  from public.shop_locations location
  where location.shop_id = p_shop_id and (
    shop_private.has_permission(p_shop_id, 'settings.manage')
    or shop_private.user_can_access_location(p_shop_id, location.id)
  )
  order by location.is_default desc, location.created_at, location.id;
$$;

create function shop_private.shop_permission_access(p_shop_id uuid, p_permission_keys text[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not shop_private.is_member(p_shop_id) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_permission_keys), 0) < 1
    or cardinality(p_permission_keys) > 50 then
    raise exception 'INVALID_PERMISSION_QUERY' using errcode = '22023';
  end if;
  select jsonb_object_agg(requested.key, shop_private.has_permission(p_shop_id, requested.key))
    into v_result from (select distinct unnest(p_permission_keys) key) requested;
  return coalesce(v_result, '{}'::jsonb);
end;
$$;
create function public.shop_permission_access(p_shop_id uuid, p_permission_keys text[])
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.shop_permission_access(p_shop_id, p_permission_keys);
$$;

create or replace function public.location_operational_report(
  p_shop_id uuid, p_location_id uuid default null,
  p_from timestamptz default null, p_to timestamptz default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform shop_private.assert_team_permission(p_shop_id, 'reports.view');
  return shop_private.location_operational_report(p_shop_id, p_location_id, p_from, p_to);
end;
$$;

revoke all on function shop_private.shop_team_read(uuid),
  shop_private.invite_shop_member(uuid, uuid, text, text, text, uuid[]),
  shop_private.accept_shop_invitation(uuid, uuid),
  shop_private.revoke_shop_invitation(uuid, uuid, uuid, text),
  shop_private.manage_shop_member(uuid, uuid, uuid, text, text, uuid[], text),
  shop_private.transfer_shop_ownership(uuid, uuid, uuid, text)
from public, anon, authenticated;
revoke all on function shop_private.shop_permission_access(uuid, text[])
from public, anon, authenticated;
grant execute on function shop_private.shop_team_read(uuid),
  shop_private.invite_shop_member(uuid, uuid, text, text, text, uuid[]),
  shop_private.accept_shop_invitation(uuid, uuid),
  shop_private.revoke_shop_invitation(uuid, uuid, uuid, text),
  shop_private.manage_shop_member(uuid, uuid, uuid, text, text, uuid[], text),
  shop_private.transfer_shop_ownership(uuid, uuid, uuid, text)
to service_role;
grant execute on function shop_private.shop_permission_access(uuid, text[]) to service_role;

revoke all on function public.shop_team_read(uuid),
  public.invite_shop_member(uuid, uuid, text, text, text, uuid[]),
  public.accept_shop_invitation(uuid, uuid),
  public.revoke_shop_invitation(uuid, uuid, uuid, text),
  public.manage_shop_member(uuid, uuid, uuid, text, text, uuid[], text),
  public.transfer_shop_ownership(uuid, uuid, uuid, text)
from public, anon;
revoke all on function public.shop_permission_access(uuid, text[]) from public, anon;
grant execute on function public.shop_team_read(uuid),
  public.invite_shop_member(uuid, uuid, text, text, text, uuid[]),
  public.accept_shop_invitation(uuid, uuid),
  public.revoke_shop_invitation(uuid, uuid, uuid, text),
  public.manage_shop_member(uuid, uuid, uuid, text, text, uuid[], text),
  public.transfer_shop_ownership(uuid, uuid, uuid, text)
to authenticated, service_role;
grant execute on function public.shop_permission_access(uuid, text[]) to authenticated, service_role;
