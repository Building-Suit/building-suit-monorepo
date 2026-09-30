-- SS-APPT-001: staff-managed appointments, calendar, availability and walk-in queue.
-- All supported writes go through tenant-authorized commands. Appointment overlap
-- checks are serialized per staff member and repeated in a trigger so privileged
-- integrations cannot bypass the invariant accidentally.

alter type public.appointment_status rename to appointment_status_legacy;
create type public.appointment_status as enum (
  'booked', 'arrived', 'waiting', 'in_service', 'completed', 'cancelled', 'no_show'
);
alter table public.appointments alter column status drop default;
alter table public.appointments alter column status type public.appointment_status
using (case status::text
  when 'completed' then 'completed'
  when 'cancelled' then 'cancelled'
  when 'no_show' then 'no_show'
  else 'booked'
end)::public.appointment_status;
alter table public.appointments alter column status set default 'booked';
drop type public.appointment_status_legacy;

create type public.appointment_identity_kind as enum ('customer', 'walk_in');
create type public.appointment_block_kind as enum ('break', 'time_off');

alter table public.appointments
  add column identity_kind public.appointment_identity_kind,
  add column walk_in_name text,
  add column walk_in_phone text,
  add column customer_name_snapshot text,
  add column customer_phone_snapshot text,
  add column sale_id uuid,
  add column completed_at timestamptz,
  add column cancelled_at timestamptz,
  add column no_show_at timestamptz,
  add column cancellation_reason text;

update public.appointments appointment
set identity_kind = (case when appointment.client_id is null then 'walk_in' else 'customer' end)::public.appointment_identity_kind,
    walk_in_name = case when appointment.client_id is null then 'Walk-in' end,
    customer_name_snapshot = customer.name,
    customer_phone_snapshot = customer.phone
from public.clients customer
where customer.id = appointment.client_id and customer.shop_id = appointment.shop_id;
update public.appointments
set identity_kind = 'walk_in', walk_in_name = coalesce(walk_in_name, 'Walk-in')
where identity_kind is null;

alter table public.appointments
  alter column identity_kind set not null,
  alter column identity_kind set default 'walk_in',
  alter column walk_in_name set default 'Walk-in',
  add constraint appointments_id_shop_unique unique (id, shop_id),
  add constraint appointments_identity_check check (
    (identity_kind = 'customer' and client_id is not null
      and customer_name_snapshot is not null and walk_in_name is null)
    or (identity_kind = 'walk_in' and client_id is null
      and walk_in_name is not null
      and length(btrim(walk_in_name)) between 2 and 160)
  ),
  add constraint appointments_walk_in_phone_check check (
    walk_in_phone is null or length(btrim(walk_in_phone)) between 3 and 40
  ),
  add constraint appointments_cancellation_reason_check check (
    cancellation_reason is null or length(btrim(cancellation_reason)) between 2 and 1000
  ),
  add constraint appointments_sale_location_fk foreign key (sale_id, shop_id, location_id)
    references public.invoices (id, shop_id, location_id) on delete restrict;

create index appointments_staff_time_idx
  on public.appointments (assigned_membership_id, starts_at, ends_at)
  where status in ('booked', 'arrived', 'waiting', 'in_service');
create index appointments_queue_idx
  on public.appointments (shop_id, location_id, status, starts_at, id)
  where status in ('arrived', 'waiting', 'in_service');

create table public.appointment_working_hours (
  shop_id uuid not null,
  location_id uuid not null,
  membership_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  starts_local time not null,
  ends_local time not null,
  timezone text not null default 'Africa/Cairo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (location_id, membership_id, weekday),
  foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete cascade,
  foreign key (membership_id, shop_id)
    references public.shop_memberships (id, shop_id) on delete cascade,
  check (ends_local > starts_local)
);

create table public.appointment_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  location_id uuid not null,
  membership_id uuid not null,
  kind public.appointment_block_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text check (note is null or length(btrim(note)) between 2 and 500),
  created_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete cascade,
  foreign key (membership_id, shop_id)
    references public.shop_memberships (id, shop_id) on delete cascade,
  check (ends_at > starts_at)
);
create index appointment_schedule_blocks_staff_time_idx
  on public.appointment_schedule_blocks (membership_id, starts_at, ends_at);

create table public.appointment_commands (
  request_id uuid primary key,
  shop_id uuid not null references public.shops (id) on delete restrict,
  operation text not null check (operation in ('save', 'transition', 'link_sale')),
  payload_hash text not null,
  appointment_id uuid,
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (appointment_id, shop_id)
    references public.appointments (id, shop_id) on delete restrict
);

create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  shop_id uuid not null references public.shops (id) on delete restrict,
  appointment_id uuid not null,
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (action in ('created', 'rescheduled', 'updated', 'status_changed', 'sale_linked')),
  before_state jsonb,
  after_state jsonb not null,
  occurred_at timestamptz not null default clock_timestamp(),
  foreign key (appointment_id, shop_id)
    references public.appointments (id, shop_id) on delete restrict
);
create index appointment_events_history_idx
  on public.appointment_events (appointment_id, occurred_at, id);

create table public.appointment_schedule_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  location_id uuid not null,
  membership_id uuid not null,
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  before_state jsonb not null,
  after_state jsonb not null,
  occurred_at timestamptz not null default clock_timestamp(),
  foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict,
  foreign key (membership_id, shop_id)
    references public.shop_memberships (id, shop_id) on delete restrict
);

alter table public.appointment_working_hours enable row level security;
alter table public.appointment_schedule_blocks enable row level security;
alter table public.appointment_commands enable row level security;
alter table public.appointment_events enable row level security;
alter table public.appointment_schedule_events enable row level security;
revoke all on public.appointment_working_hours, public.appointment_schedule_blocks,
  public.appointment_commands, public.appointment_events,
  public.appointment_schedule_events from public, anon, authenticated;
grant all on public.appointment_working_hours, public.appointment_schedule_blocks,
  public.appointment_commands, public.appointment_events,
  public.appointment_schedule_events to service_role;

insert into public.permissions (portal_id, key, description)
select portal.id, permission.key, permission.description
from public.portals portal
cross join (values
  ('appointments.view', 'View staff calendars and appointment history'),
  ('appointments.manage', 'Create, reschedule and update appointments'),
  ('appointments.schedule.manage', 'Manage staff working hours, breaks and time off')
) permission(key, description)
where portal.key = 'shop-crm'
on conflict (portal_id, key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
join public.permissions permission on permission.portal_id = (
  select shop.portal_id from public.shops shop where shop.id = role.shop_id
)
where (role.key = 'manager' and permission.key in (
    'appointments.view', 'appointments.manage', 'appointments.schedule.manage'
  )) or (role.key in ('barber', 'cashier') and permission.key in (
    'appointments.view', 'appointments.manage'
  )) or (role.key = 'staff' and permission.key = 'appointments.view')
on conflict do nothing;

create function shop_private.grant_appointment_role_permissions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.role_permissions (role_id, permission_id)
  select new.id, permission.id from public.permissions permission
  where permission.portal_id = (select shop.portal_id from public.shops shop where shop.id = new.shop_id)
    and ((new.key = 'manager' and permission.key in (
      'appointments.view', 'appointments.manage', 'appointments.schedule.manage'
    )) or (new.key in ('barber', 'cashier') and permission.key in (
      'appointments.view', 'appointments.manage'
    )) or (new.key = 'staff' and permission.key = 'appointments.view'))
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function shop_private.grant_appointment_role_permissions()
  from public, anon, authenticated, service_role;
create trigger trg_roles_grant_appointment_permissions
after insert or update of key on public.roles for each row
execute function shop_private.grant_appointment_role_permissions();

create function shop_private.appointment_actor_profile(p_shop_id uuid, p_permission text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_profile_id uuid;
begin
  if not shop_private.has_permission(p_shop_id, p_permission) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  select membership.profile_id into v_profile_id
  from public.shop_memberships membership
  join public.profiles profile on profile.id = membership.profile_id
  where membership.shop_id = p_shop_id and profile.user_id = auth.uid()
    and membership.status = 'active' and membership.removed_at is null
    and profile.status = 'active';
  if v_profile_id is null then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  return v_profile_id;
end;
$$;

create function shop_private.validate_appointment_availability()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_weekday smallint; v_local_start time; v_local_end time;
begin
  if new.assigned_membership_id is null
    or new.status not in ('booked', 'arrived', 'waiting', 'in_service') then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and new.assigned_membership_id is not distinct from old.assigned_membership_id
    and new.location_id is not distinct from old.location_id
    and new.service_id is not distinct from old.service_id
    and new.starts_at is not distinct from old.starts_at
    and new.ends_at is not distinct from old.ends_at then
    return new;
  end if;
  if not exists (select 1 from public.services service
    where service.id = new.service_id and service.shop_id = new.shop_id
      and service.scheduling_enabled) then
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.assigned_membership_id::text, 0)
  );
  if exists (
    select 1 from public.appointments appointment
    where appointment.assigned_membership_id = new.assigned_membership_id
      and appointment.id <> new.id
      and appointment.status in ('booked', 'arrived', 'waiting', 'in_service')
      and tstzrange(appointment.starts_at, appointment.ends_at, '[)')
        && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'APPOINTMENT_STAFF_CONFLICT' using errcode = '23P01';
  end if;
  select extract(dow from new.starts_at at time zone hours.timezone)::smallint,
    (new.starts_at at time zone hours.timezone)::time,
    (new.ends_at at time zone hours.timezone)::time
  into v_weekday, v_local_start, v_local_end
  from public.appointment_working_hours hours
  where hours.shop_id = new.shop_id and hours.location_id = new.location_id
    and hours.membership_id = new.assigned_membership_id
    and hours.weekday = extract(dow from new.starts_at at time zone hours.timezone)::smallint
    and (new.starts_at at time zone hours.timezone)::date
      = (new.ends_at at time zone hours.timezone)::date
    and (new.starts_at at time zone hours.timezone)::time >= hours.starts_local
    and (new.ends_at at time zone hours.timezone)::time <= hours.ends_local;
  if not found then
    raise exception 'APPOINTMENT_OUTSIDE_WORKING_HOURS' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.appointment_schedule_blocks block
    where block.shop_id = new.shop_id and block.location_id = new.location_id
      and block.membership_id = new.assigned_membership_id
      and tstzrange(block.starts_at, block.ends_at, '[)')
        && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'APPOINTMENT_STAFF_UNAVAILABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function shop_private.validate_appointment_availability()
  from public, anon, authenticated, service_role;
create trigger trg_appointments_validate_availability
before insert or update of assigned_membership_id, location_id, starts_at, ends_at, status
on public.appointments for each row execute function shop_private.validate_appointment_availability();

create function shop_private.normalize_appointment_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.client_id is not null and (new.identity_kind is null or new.identity_kind = 'walk_in') then
    select 'customer'::public.appointment_identity_kind, customer.name, customer.phone
      into new.identity_kind, new.customer_name_snapshot, new.customer_phone_snapshot
    from public.clients customer
    where customer.id = new.client_id and customer.shop_id = new.shop_id;
    new.walk_in_name := null;
    new.walk_in_phone := null;
  elsif new.client_id is null and new.identity_kind is null then
    new.identity_kind := 'walk_in';
    new.walk_in_name := coalesce(nullif(btrim(new.walk_in_name), ''), 'Walk-in');
  end if;
  return new;
end;
$$;
revoke all on function shop_private.normalize_appointment_identity()
  from public, anon, authenticated, service_role;
create trigger trg_appointments_normalize_identity
before insert or update of client_id, identity_kind on public.appointments
for each row execute function shop_private.normalize_appointment_identity();

create function shop_private.audit_appointment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_action text; v_actor uuid;
begin
  select membership.profile_id into v_actor
  from public.shop_memberships membership
  join public.profiles profile on profile.id = membership.profile_id
  where membership.shop_id = new.shop_id and profile.user_id = auth.uid()
    and membership.status = 'active' and profile.status = 'active';
  v_actor := coalesce(v_actor, new.created_by_profile_id);
  v_action := case
    when tg_op = 'INSERT' then 'created'
    when new.sale_id is distinct from old.sale_id then 'sale_linked'
    when new.status is distinct from old.status then 'status_changed'
    when new.starts_at is distinct from old.starts_at
      or new.ends_at is distinct from old.ends_at
      or new.assigned_membership_id is distinct from old.assigned_membership_id then 'rescheduled'
    else 'updated' end;
  insert into public.appointment_events (
    request_id, shop_id, appointment_id, actor_profile_id, action, before_state, after_state
  ) values (
    nullif(current_setting('shop.appointment_request_id', true), '')::uuid,
    new.shop_id, new.id, v_actor, v_action,
    case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new)
  );
  return new;
end;
$$;
revoke all on function shop_private.audit_appointment()
  from public, anon, authenticated, service_role;
create trigger trg_appointments_audit
after insert or update on public.appointments for each row
execute function shop_private.audit_appointment();

create function shop_private.appointment_options(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_can_manage boolean; v_can_schedule boolean;
begin
  if not shop_private.has_permission(p_shop_id, 'appointments.view') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  v_can_manage := shop_private.has_permission(p_shop_id, 'appointments.manage');
  v_can_schedule := shop_private.has_permission(p_shop_id, 'appointments.schedule.manage');
  return jsonb_build_object(
    'canManage', v_can_manage, 'canManageSchedule', v_can_schedule,
    'locations', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', location.id, 'name', location.name
    ) order by location.is_default desc, location.name), '[]'::jsonb)
      from public.shop_locations location where location.shop_id = p_shop_id
        and location.status = 'active'
        and shop_private.user_can_access_location(p_shop_id, location.id)),
    'staff', (select coalesce(jsonb_agg(jsonb_build_object(
      'membershipId', membership.id,
      'name', coalesce(profile.display_name, profile.email_snapshot),
      'locationIds', coalesce(assignments.value, '[]'::jsonb)
    ) order by coalesce(profile.display_name, profile.email_snapshot)), '[]'::jsonb)
      from public.shop_memberships membership
      join public.profiles profile on profile.id = membership.profile_id
      left join lateral (select jsonb_agg(assignment.location_id order by assignment.location_id) value
        from public.membership_location_assignments assignment
        where assignment.membership_id = membership.id) assignments on true
      where membership.shop_id = p_shop_id and membership.status = 'active'
        and membership.removed_at is null and profile.status = 'active'),
    'services', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', service.id, 'name', service.name,
      'durationMinutes', service.duration_minutes,
      'cleanupMinutes', service.cleanup_minutes,
      'locationIds', (select coalesce(jsonb_agg(item.location_id), '[]'::jsonb)
        from public.service_location_availability item where item.service_id = service.id),
      'staffMembershipIds', (select coalesce(jsonb_agg(item.membership_id), '[]'::jsonb)
        from public.service_staff_eligibility item where item.service_id = service.id)
    ) order by service.name), '[]'::jsonb)
      from public.services service where service.shop_id = p_shop_id
        and service.is_active and service.scheduling_enabled),
    'customers', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', customer.id, 'name', customer.name, 'phone', customer.phone
    ) order by customer.name, customer.id), '[]'::jsonb)
      from public.clients customer where customer.shop_id = p_shop_id and customer.is_active
        and shop_private.has_permission(p_shop_id, 'clients.view'))
  );
end;
$$;

create function shop_private.appointment_calendar(
  p_shop_id uuid, p_location_id uuid, p_from timestamptz, p_to timestamptz,
  p_membership_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not shop_private.has_permission(p_shop_id, 'appointments.view')
    or not shop_private.user_can_access_location(p_shop_id, p_location_id) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to > p_from + interval '8 days' then
    raise exception 'INVALID_CALENDAR_RANGE' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'appointments', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', appointment.id, 'locationId', appointment.location_id,
      'staffMembershipId', appointment.assigned_membership_id,
      'serviceId', appointment.service_id, 'customerId', appointment.client_id,
      'identityKind', appointment.identity_kind,
      'customerName', coalesce(appointment.customer_name_snapshot, appointment.walk_in_name),
      'customerPhone', coalesce(appointment.customer_phone_snapshot, appointment.walk_in_phone),
      'status', appointment.status, 'startsAt', appointment.starts_at,
      'endsAt', appointment.ends_at, 'notes', appointment.notes,
      'saleId', appointment.sale_id,
      'serviceName', service.name,
      'staffName', coalesce(profile.display_name, profile.email_snapshot),
      'history', (select coalesce(jsonb_agg(jsonb_build_object(
        'action', event.action, 'status', event.after_state ->> 'status',
        'occurredAt', event.occurred_at
      ) order by event.occurred_at, event.id), '[]'::jsonb)
        from public.appointment_events event where event.appointment_id = appointment.id)
    ) order by appointment.starts_at, appointment.id), '[]'::jsonb)
      from public.appointments appointment
      left join public.services service on service.id = appointment.service_id
      left join public.shop_memberships membership on membership.id = appointment.assigned_membership_id
      left join public.profiles profile on profile.id = membership.profile_id
      where appointment.shop_id = p_shop_id and appointment.location_id = p_location_id
        and appointment.starts_at < p_to and appointment.ends_at > p_from
        and (p_membership_id is null or appointment.assigned_membership_id = p_membership_id)),
    'workingHours', (select coalesce(jsonb_agg(jsonb_build_object(
      'membershipId', hours.membership_id, 'weekday', hours.weekday,
      'startsLocal', hours.starts_local, 'endsLocal', hours.ends_local,
      'timezone', hours.timezone
    ) order by hours.membership_id, hours.weekday), '[]'::jsonb)
      from public.appointment_working_hours hours
      where hours.shop_id = p_shop_id and hours.location_id = p_location_id),
    'blocks', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', block.id, 'membershipId', block.membership_id, 'kind', block.kind,
      'startsAt', block.starts_at, 'endsAt', block.ends_at, 'note', block.note
    ) order by block.starts_at, block.id), '[]'::jsonb)
      from public.appointment_schedule_blocks block
      where block.shop_id = p_shop_id and block.location_id = p_location_id
        and block.ends_at >= now() - interval '1 day')
  );
end;
$$;

create function shop_private.save_appointment(
  p_request_id uuid, p_shop_id uuid, p_appointment_id uuid,
  p_location_id uuid, p_membership_id uuid, p_service_id uuid,
  p_starts_at timestamptz, p_identity_kind text, p_customer_id uuid,
  p_walk_in_name text, p_walk_in_phone text, p_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid; v_ends_at timestamptz;
  v_customer_name text; v_customer_phone text;
  v_hash text; v_existing public.appointment_commands%rowtype;
begin
  v_actor := shop_private.appointment_actor_profile(p_shop_id, 'appointments.manage');
  if p_request_id is null or p_location_id is null or p_membership_id is null
    or p_service_id is null or p_starts_at is null
    or p_identity_kind is null or p_identity_kind not in ('customer', 'walk_in') then
    raise exception 'INVALID_APPOINTMENT' using errcode = '22023';
  end if;
  if not shop_private.user_can_access_location(p_shop_id, p_location_id) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  select p_starts_at + make_interval(mins => service.duration_minutes + service.cleanup_minutes)
    into v_ends_at from public.services service
  where service.id = p_service_id and service.shop_id = p_shop_id
    and service.is_active and service.scheduling_enabled;
  if v_ends_at is null then raise exception 'INVALID_APPOINTMENT_SERVICE' using errcode = '23503'; end if;
  if p_identity_kind = 'customer' then
    select customer.name, customer.phone into v_customer_name, v_customer_phone
    from public.clients customer where customer.id = p_customer_id
      and customer.shop_id = p_shop_id and customer.is_active;
    if not found then raise exception 'INVALID_APPOINTMENT_CUSTOMER' using errcode = '23503'; end if;
  elsif p_customer_id is not null or length(btrim(coalesce(p_walk_in_name, ''))) not between 2 and 160 then
    raise exception 'INVALID_WALK_IN_IDENTITY' using errcode = '22023';
  end if;
  v_hash := md5(jsonb_build_array(p_shop_id, p_appointment_id, p_location_id,
    p_membership_id, p_service_id, p_starts_at, p_identity_kind, p_customer_id,
    nullif(btrim(p_walk_in_name), ''), nullif(btrim(p_walk_in_phone), ''),
    nullif(btrim(p_notes), ''))::text);
  insert into public.appointment_commands (
    request_id, shop_id, operation, payload_hash, actor_profile_id
  ) values (p_request_id, p_shop_id, 'save', v_hash, v_actor)
  on conflict (request_id) do nothing;
  select * into v_existing from public.appointment_commands command
  where command.request_id = p_request_id for update;
  if v_existing.shop_id <> p_shop_id or v_existing.operation <> 'save'
    or v_existing.payload_hash <> v_hash then
    raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '23505';
  end if;
  if v_existing.appointment_id is not null then return v_existing.appointment_id; end if;
  perform set_config('shop.appointment_request_id', p_request_id::text, true);
  if p_appointment_id is null then
    insert into public.appointments (shop_id, location_id, client_id, service_id,
      assigned_membership_id, starts_at, ends_at, notes, created_by_profile_id,
      identity_kind, walk_in_name, walk_in_phone,
      customer_name_snapshot, customer_phone_snapshot)
    values (p_shop_id, p_location_id,
      case when p_identity_kind = 'customer' then p_customer_id end,
      p_service_id, p_membership_id, p_starts_at, v_ends_at,
      nullif(btrim(p_notes), ''), v_actor, p_identity_kind::public.appointment_identity_kind,
      case when p_identity_kind = 'walk_in' then btrim(p_walk_in_name) end,
      case when p_identity_kind = 'walk_in' then nullif(btrim(p_walk_in_phone), '') end,
      case when p_identity_kind = 'customer' then v_customer_name end,
      case when p_identity_kind = 'customer' then v_customer_phone end)
    returning id into v_id;
  else
    update public.appointments appointment set
      service_id = p_service_id, assigned_membership_id = p_membership_id,
      starts_at = p_starts_at, ends_at = v_ends_at,
      notes = nullif(btrim(p_notes), ''),
      client_id = case when p_identity_kind = 'customer' then p_customer_id end,
      identity_kind = p_identity_kind::public.appointment_identity_kind,
      walk_in_name = case when p_identity_kind = 'walk_in' then btrim(p_walk_in_name) end,
      walk_in_phone = case when p_identity_kind = 'walk_in' then nullif(btrim(p_walk_in_phone), '') end,
      customer_name_snapshot = case when p_identity_kind = 'customer' then v_customer_name end,
      customer_phone_snapshot = case when p_identity_kind = 'customer' then v_customer_phone end,
      updated_at = now()
    where appointment.id = p_appointment_id and appointment.shop_id = p_shop_id
      and appointment.location_id = p_location_id
      and appointment.status in ('booked', 'arrived', 'waiting')
    returning appointment.id into v_id;
    if v_id is null then raise exception 'APPOINTMENT_NOT_EDITABLE' using errcode = '55000'; end if;
  end if;
  update public.appointment_commands set appointment_id = v_id where request_id = p_request_id;
  return v_id;
end;
$$;

create function shop_private.link_appointment_sale(
  p_request_id uuid, p_shop_id uuid, p_appointment_id uuid, p_sale_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_existing public.appointment_commands%rowtype;
  v_location_id uuid; v_current_sale_id uuid;
begin
  v_actor := shop_private.appointment_actor_profile(p_shop_id, 'appointments.manage');
  if p_request_id is null or p_appointment_id is null or p_sale_id is null then
    raise exception 'INVALID_APPOINTMENT_SALE' using errcode = '22023';
  end if;
  v_hash := md5(jsonb_build_array(p_shop_id, p_appointment_id, p_sale_id)::text);
  insert into public.appointment_commands (request_id, shop_id, operation,
    payload_hash, appointment_id, actor_profile_id)
  values (p_request_id, p_shop_id, 'link_sale', v_hash, p_appointment_id, v_actor)
  on conflict (request_id) do nothing;
  select * into v_existing from public.appointment_commands command
    where command.request_id = p_request_id for update;
  if v_existing.shop_id <> p_shop_id or v_existing.operation <> 'link_sale'
    or v_existing.payload_hash <> v_hash then
    raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '23505';
  end if;
  select appointment.location_id, appointment.sale_id
    into v_location_id, v_current_sale_id
  from public.appointments appointment
  where appointment.id = p_appointment_id and appointment.shop_id = p_shop_id for update;
  if not found or not exists (select 1 from public.invoices invoice
    where invoice.id = p_sale_id and invoice.shop_id = p_shop_id
      and invoice.location_id = v_location_id) then
    raise exception 'INVALID_APPOINTMENT_SALE' using errcode = '23503';
  end if;
  if v_current_sale_id is not null and v_current_sale_id <> p_sale_id then
    raise exception 'APPOINTMENT_SALE_IMMUTABLE' using errcode = '55000';
  end if;
  if v_current_sale_id is null then
    perform set_config('shop.appointment_request_id', p_request_id::text, true);
    update public.appointments set sale_id = p_sale_id, updated_at = now()
      where id = p_appointment_id and shop_id = p_shop_id;
  end if;
  return p_appointment_id;
end;
$$;

create function shop_private.transition_appointment(
  p_request_id uuid, p_shop_id uuid, p_appointment_id uuid,
  p_status text, p_reason text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_current public.appointment_status; v_hash text;
  v_existing public.appointment_commands%rowtype;
begin
  v_actor := shop_private.appointment_actor_profile(p_shop_id, 'appointments.manage');
  if p_request_id is null or p_appointment_id is null or p_status is null or p_status not in (
    'arrived', 'waiting', 'in_service', 'completed', 'cancelled', 'no_show'
  ) then raise exception 'INVALID_APPOINTMENT_STATUS' using errcode = '22023'; end if;
  v_hash := md5(jsonb_build_array(p_shop_id, p_appointment_id, p_status,
    nullif(btrim(p_reason), ''))::text);
  insert into public.appointment_commands (request_id, shop_id, operation,
    payload_hash, appointment_id, actor_profile_id)
  values (p_request_id, p_shop_id, 'transition', v_hash, p_appointment_id, v_actor)
  on conflict (request_id) do nothing;
  select * into v_existing from public.appointment_commands command
    where command.request_id = p_request_id for update;
  if v_existing.shop_id <> p_shop_id or v_existing.operation <> 'transition'
    or v_existing.payload_hash <> v_hash then
    raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '23505';
  end if;
  select appointment.status into v_current from public.appointments appointment
  where appointment.id = p_appointment_id and appointment.shop_id = p_shop_id for update;
  if not found then raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_current::text = p_status then return p_appointment_id; end if;
  if not ((v_current = 'booked' and p_status in ('arrived','waiting','cancelled','no_show'))
    or (v_current = 'arrived' and p_status in ('waiting','in_service','cancelled','no_show'))
    or (v_current = 'waiting' and p_status in ('in_service','cancelled','no_show'))
    or (v_current = 'in_service' and p_status in ('completed','cancelled'))) then
    raise exception 'INVALID_APPOINTMENT_TRANSITION' using errcode = '23514';
  end if;
  if p_status = 'cancelled' and length(btrim(coalesce(p_reason, ''))) < 2 then
    raise exception 'APPOINTMENT_REASON_REQUIRED' using errcode = '22023';
  end if;
  perform set_config('shop.appointment_request_id', p_request_id::text, true);
  update public.appointments set status = p_status::public.appointment_status,
    completed_at = case when p_status = 'completed' then clock_timestamp() end,
    cancelled_at = case when p_status = 'cancelled' then clock_timestamp() end,
    no_show_at = case when p_status = 'no_show' then clock_timestamp() end,
    cancellation_reason = case when p_status = 'cancelled' then btrim(p_reason) end,
    updated_at = now()
  where id = p_appointment_id and shop_id = p_shop_id;
  return p_appointment_id;
end;
$$;

create function shop_private.save_staff_schedule(
  p_shop_id uuid, p_location_id uuid, p_membership_id uuid,
  p_timezone text, p_working_hours jsonb, p_blocks jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_before jsonb; v_after jsonb;
begin
  v_actor := shop_private.appointment_actor_profile(p_shop_id, 'appointments.schedule.manage');
  if not shop_private.user_can_access_location(p_shop_id, p_location_id)
    or not exists (select 1 from public.membership_location_assignments assignment
      where assignment.shop_id = p_shop_id and assignment.location_id = p_location_id
        and assignment.membership_id = p_membership_id)
    or not exists (select 1 from pg_catalog.pg_timezone_names zone where zone.name = p_timezone)
    or jsonb_typeof(p_working_hours) <> 'array' or jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'INVALID_STAFF_SCHEDULE' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'workingHours', coalesce((select jsonb_agg(to_jsonb(hours) order by hours.weekday)
      from public.appointment_working_hours hours where hours.location_id = p_location_id
        and hours.membership_id = p_membership_id), '[]'::jsonb),
    'blocks', coalesce((select jsonb_agg(to_jsonb(block) order by block.starts_at)
      from public.appointment_schedule_blocks block where block.location_id = p_location_id
        and block.membership_id = p_membership_id), '[]'::jsonb)
  ) into v_before;
  if exists (select 1 from jsonb_to_recordset(p_working_hours) item(
      weekday integer, "startsLocal" time, "endsLocal" time
    ) where item.weekday not between 0 and 6 or item."startsLocal" >= item."endsLocal")
    or (select count(*) from jsonb_to_recordset(p_working_hours) item(
      weekday integer, "startsLocal" time, "endsLocal" time))
      <> (select count(distinct item.weekday) from jsonb_to_recordset(p_working_hours) item(
        weekday integer, "startsLocal" time, "endsLocal" time))
    or exists (select 1 from jsonb_to_recordset(p_blocks) item(
      kind text, "startsAt" timestamptz, "endsAt" timestamptz, note text
    ) where item.kind not in ('break','time_off') or item."startsAt" >= item."endsAt") then
    raise exception 'INVALID_STAFF_SCHEDULE' using errcode = '22023';
  end if;
  delete from public.appointment_working_hours
    where location_id = p_location_id and membership_id = p_membership_id;
  insert into public.appointment_working_hours (
    shop_id, location_id, membership_id, weekday, starts_local, ends_local, timezone
  ) select p_shop_id, p_location_id, p_membership_id, item.weekday,
    item."startsLocal", item."endsLocal", p_timezone
  from jsonb_to_recordset(p_working_hours) item(
    weekday integer, "startsLocal" time, "endsLocal" time
  );
  delete from public.appointment_schedule_blocks
    where location_id = p_location_id and membership_id = p_membership_id
      and ends_at >= now() - interval '1 day';
  insert into public.appointment_schedule_blocks (
    shop_id, location_id, membership_id, kind, starts_at, ends_at,
    note, created_by_profile_id
  ) select p_shop_id, p_location_id, p_membership_id,
    item.kind::public.appointment_block_kind, item."startsAt", item."endsAt",
    nullif(btrim(item.note), ''), v_actor
  from jsonb_to_recordset(p_blocks) item(
    kind text, "startsAt" timestamptz, "endsAt" timestamptz, note text
  );
  select jsonb_build_object(
    'workingHours', coalesce((select jsonb_agg(to_jsonb(hours) order by hours.weekday)
      from public.appointment_working_hours hours where hours.location_id = p_location_id
        and hours.membership_id = p_membership_id), '[]'::jsonb),
    'blocks', coalesce((select jsonb_agg(to_jsonb(block) order by block.starts_at)
      from public.appointment_schedule_blocks block where block.location_id = p_location_id
        and block.membership_id = p_membership_id), '[]'::jsonb)
  ) into v_after;
  insert into public.appointment_schedule_events (shop_id, location_id,
    membership_id, actor_profile_id, before_state, after_state)
  values (p_shop_id, p_location_id, p_membership_id, v_actor, v_before, v_after);
end;
$$;

create function public.appointment_options(p_shop_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.appointment_options(p_shop_id);
$$;
create function public.appointment_calendar(p_shop_id uuid, p_location_id uuid,
  p_from timestamptz, p_to timestamptz, p_membership_id uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.appointment_calendar(p_shop_id, p_location_id, p_from, p_to, p_membership_id);
$$;
create function public.save_appointment(p_request_id uuid, p_shop_id uuid,
  p_appointment_id uuid, p_location_id uuid, p_membership_id uuid,
  p_service_id uuid, p_starts_at timestamptz, p_identity_kind text,
  p_customer_id uuid, p_walk_in_name text, p_walk_in_phone text, p_notes text)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.save_appointment(p_request_id, p_shop_id, p_appointment_id,
    p_location_id, p_membership_id, p_service_id, p_starts_at,
    p_identity_kind, p_customer_id, p_walk_in_name, p_walk_in_phone, p_notes);
$$;
create function public.transition_appointment(p_request_id uuid, p_shop_id uuid,
  p_appointment_id uuid, p_status text, p_reason text default null)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.transition_appointment(p_request_id, p_shop_id,
    p_appointment_id, p_status, p_reason);
$$;
create function public.link_appointment_sale(p_request_id uuid, p_shop_id uuid,
  p_appointment_id uuid, p_sale_id uuid)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.link_appointment_sale(p_request_id, p_shop_id,
    p_appointment_id, p_sale_id);
$$;
create function public.save_staff_schedule(p_shop_id uuid, p_location_id uuid,
  p_membership_id uuid, p_timezone text, p_working_hours jsonb, p_blocks jsonb)
returns void language sql security definer set search_path = '' as $$
  select shop_private.save_staff_schedule(p_shop_id, p_location_id,
    p_membership_id, p_timezone, p_working_hours, p_blocks);
$$;

revoke insert, update, delete on public.appointments from authenticated;
revoke all on function
  shop_private.appointment_actor_profile(uuid, text),
  shop_private.appointment_options(uuid),
  shop_private.appointment_calendar(uuid, uuid, timestamptz, timestamptz, uuid),
  shop_private.save_appointment(uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, text, uuid, text, text, text),
  shop_private.transition_appointment(uuid, uuid, uuid, text, text),
  shop_private.link_appointment_sale(uuid, uuid, uuid, uuid),
  shop_private.save_staff_schedule(uuid, uuid, uuid, text, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function
  shop_private.appointment_actor_profile(uuid, text),
  shop_private.appointment_options(uuid),
  shop_private.appointment_calendar(uuid, uuid, timestamptz, timestamptz, uuid),
  shop_private.save_appointment(uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, text, uuid, text, text, text),
  shop_private.transition_appointment(uuid, uuid, uuid, text, text),
  shop_private.link_appointment_sale(uuid, uuid, uuid, uuid),
  shop_private.save_staff_schedule(uuid, uuid, uuid, text, jsonb, jsonb)
to service_role;
revoke all on function
  public.appointment_options(uuid),
  public.appointment_calendar(uuid, uuid, timestamptz, timestamptz, uuid),
  public.save_appointment(uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, text, uuid, text, text, text),
  public.transition_appointment(uuid, uuid, uuid, text, text),
  public.link_appointment_sale(uuid, uuid, uuid, uuid),
  public.save_staff_schedule(uuid, uuid, uuid, text, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function
  public.appointment_options(uuid),
  public.appointment_calendar(uuid, uuid, timestamptz, timestamptz, uuid),
  public.save_appointment(uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, text, uuid, text, text, text),
  public.transition_appointment(uuid, uuid, uuid, text, text),
  public.link_appointment_sale(uuid, uuid, uuid, uuid),
  public.save_staff_schedule(uuid, uuid, uuid, text, jsonb, jsonb)
to authenticated, service_role;

notify pgrst, 'reload schema';
