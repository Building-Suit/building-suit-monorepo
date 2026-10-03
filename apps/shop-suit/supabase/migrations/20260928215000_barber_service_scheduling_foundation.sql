-- SS-BARBER-CORE-001: scheduling remains an opt-in service capability. Shops
-- that only sell products or unscheduled services retain their existing shape.

alter table public.services
  add column scheduling_enabled boolean not null default false,
  add column duration_minutes integer,
  add column cleanup_minutes integer not null default 0,
  add constraint services_scheduling_values_check check (
    (duration_minutes is null or duration_minutes between 5 and 1440)
    and cleanup_minutes between 0 and 240
    and (not scheduling_enabled or duration_minutes is not null)
  );

create table public.service_location_availability (
  shop_id uuid not null,
  service_id uuid not null,
  location_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (service_id, location_id),
  foreign key (service_id, shop_id)
    references public.services (id, shop_id) on delete cascade,
  foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict
);
create index service_location_availability_location_idx
  on public.service_location_availability (shop_id, location_id, service_id);

create table public.service_staff_eligibility (
  shop_id uuid not null,
  service_id uuid not null,
  membership_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (service_id, membership_id),
  foreign key (service_id, shop_id)
    references public.services (id, shop_id) on delete cascade,
  foreign key (membership_id, shop_id)
    references public.shop_memberships (id, shop_id) on delete restrict
);
create index service_staff_eligibility_membership_idx
  on public.service_staff_eligibility (shop_id, membership_id, service_id);

alter table public.invoice_items
  add column service_duration_minutes_snapshot integer,
  add column service_cleanup_minutes_snapshot integer,
  add column service_location_ids_snapshot uuid[],
  add column service_staff_membership_ids_snapshot uuid[];

alter table public.service_location_availability enable row level security;
alter table public.service_staff_eligibility enable row level security;
revoke all on public.service_location_availability, public.service_staff_eligibility
  from public, anon, authenticated;
grant all on public.service_location_availability, public.service_staff_eligibility
  to service_role;

create function shop_private.list_services(
  p_shop_id uuid, p_search text default null,
  p_page integer default 1, p_page_size integer default 20
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_search text := nullif(btrim(p_search), ''); v_result jsonb;
begin
  if not shop_private.has_permission(p_shop_id, 'services.view') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then
    raise exception 'INVALID_PAGINATION' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(service_row.value order by service_row.name, service_row.id), '[]'::jsonb),
    'total', (select count(*) from public.services service
      where service.shop_id = p_shop_id and service.is_active
        and (v_search is null or service.name ilike '%' || v_search || '%'
          or coalesce(service.description, '') ilike '%' || v_search || '%')),
    'page', p_page, 'pageSize', p_page_size
  ) into v_result
  from (
    select service.id, service.name, jsonb_build_object(
      'id', service.id, 'name', service.name, 'description', service.description,
      'baseSalePrice', service.base_sale_price,
      'defaultDiscountType', service.default_discount_type,
      'defaultDiscountValue', service.default_discount_value,
      'isActive', service.is_active,
      'schedulingEnabled', service.scheduling_enabled,
      'durationMinutes', service.duration_minutes,
      'cleanupMinutes', service.cleanup_minutes,
      'locationIds', coalesce((select jsonb_agg(availability.location_id order by availability.location_id)
        from public.service_location_availability availability
        where availability.service_id = service.id), '[]'::jsonb),
      'staffMembershipIds', coalesce((select jsonb_agg(eligibility.membership_id order by eligibility.membership_id)
        from public.service_staff_eligibility eligibility
        where eligibility.service_id = service.id), '[]'::jsonb)
    ) value
    from public.services service
    where service.shop_id = p_shop_id and service.is_active
      and (v_search is null or service.name ilike '%' || v_search || '%'
        or coalesce(service.description, '') ilike '%' || v_search || '%')
    order by service.name, service.id
    limit p_page_size offset (p_page - 1) * p_page_size
  ) service_row;
  return v_result;
end;
$$;

create function public.list_services(
  p_shop_id uuid, p_search text default null,
  p_page integer default 1, p_page_size integer default 20
) returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.list_services(p_shop_id, p_search, p_page, p_page_size);
$$;

create function shop_private.service_scheduling_options(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not shop_private.has_permission(p_shop_id, 'services.manage') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'locations', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', location.id, 'name', location.name
    ) order by location.is_default desc, location.name), '[]'::jsonb)
      from public.shop_locations location
      where location.shop_id = p_shop_id and location.status = 'active'),
    'staff', (select coalesce(jsonb_agg(jsonb_build_object(
      'membershipId', membership.id,
      'name', coalesce(profile.display_name, profile.email_snapshot),
      'locationIds', coalesce(locations.value, '[]'::jsonb)
    ) order by coalesce(profile.display_name, profile.email_snapshot), membership.id), '[]'::jsonb)
      from public.shop_memberships membership
      join public.profiles profile on profile.id = membership.profile_id
      left join lateral (select jsonb_agg(assignment.location_id order by assignment.location_id) value
        from public.membership_location_assignments assignment
        where assignment.membership_id = membership.id) locations on true
      where membership.shop_id = p_shop_id
        and membership.status = 'active' and membership.removed_at is null
        and profile.status = 'active')
  );
end;
$$;

create function public.service_scheduling_options(p_shop_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.service_scheduling_options(p_shop_id);
$$;

create function shop_private.save_scheduled_service(
  p_shop_id uuid, p_service_id uuid, p_name text, p_description text,
  p_base_sale_price numeric, p_discount_type text, p_discount_value numeric,
  p_scheduling_enabled boolean, p_duration_minutes integer,
  p_cleanup_minutes integer, p_location_ids uuid[], p_staff_membership_ids uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_service_id uuid; v_location_ids uuid[] := coalesce(p_location_ids, '{}'::uuid[]);
  v_staff_ids uuid[] := coalesce(p_staff_membership_ids, '{}'::uuid[]);
begin
  perform shop_private.assert_shop_write_access(p_shop_id, 'services.manage');
  if p_scheduling_enabled is null
    or (p_duration_minutes is not null and p_duration_minutes not between 5 and 1440)
    or p_cleanup_minutes is null or p_cleanup_minutes not between 0 and 240
    or (p_scheduling_enabled and (p_duration_minutes is null
      or cardinality(v_location_ids) < 1 or cardinality(v_staff_ids) < 1))
    or cardinality(v_location_ids) <> (select count(distinct id) from unnest(v_location_ids) requested(id))
    or cardinality(v_staff_ids) <> (select count(distinct id) from unnest(v_staff_ids) requested(id)) then
    raise exception 'INVALID_SERVICE_SCHEDULE' using errcode = '22023';
  end if;
  if p_scheduling_enabled and exists (
    select 1 from unnest(v_location_ids) requested(id) where not exists (
      select 1 from public.shop_locations location
      where location.id = requested.id and location.shop_id = p_shop_id
        and location.status = 'active'
    )
  ) then raise exception 'INVALID_SERVICE_LOCATION' using errcode = '23503'; end if;
  if p_scheduling_enabled and exists (
    select 1 from unnest(v_staff_ids) requested(id) where not exists (
      select 1 from public.shop_memberships membership
      join public.profiles profile on profile.id = membership.profile_id
      where membership.id = requested.id and membership.shop_id = p_shop_id
        and membership.status = 'active' and membership.removed_at is null
        and profile.status = 'active'
    )
  ) then raise exception 'INVALID_SERVICE_STAFF' using errcode = '23503'; end if;
  if p_scheduling_enabled and exists (
    select 1 from unnest(v_staff_ids) requested(id) where not exists (
      select 1 from public.membership_location_assignments assignment
      where assignment.membership_id = requested.id and assignment.shop_id = p_shop_id
        and assignment.location_id = any(v_location_ids)
    )
  ) then raise exception 'SERVICE_STAFF_LOCATION_MISMATCH' using errcode = '23514'; end if;

  v_service_id := shop_private.save_service(p_shop_id, p_service_id, p_name,
    p_description, p_base_sale_price, p_discount_type, p_discount_value);
  update public.services set scheduling_enabled = p_scheduling_enabled,
    duration_minutes = p_duration_minutes, cleanup_minutes = p_cleanup_minutes,
    updated_at = now()
  where id = v_service_id and shop_id = p_shop_id;
  delete from public.service_location_availability where service_id = v_service_id;
  delete from public.service_staff_eligibility where service_id = v_service_id;
  if p_scheduling_enabled then
    insert into public.service_location_availability (shop_id, service_id, location_id)
      select p_shop_id, v_service_id, requested.id from unnest(v_location_ids) requested(id);
    insert into public.service_staff_eligibility (shop_id, service_id, membership_id)
      select p_shop_id, v_service_id, requested.id from unnest(v_staff_ids) requested(id);
  end if;
  return v_service_id;
end;
$$;

create function public.save_service(
  p_shop_id uuid, p_service_id uuid, p_name text, p_description text,
  p_base_sale_price numeric, p_discount_type text, p_discount_value numeric,
  p_scheduling_enabled boolean, p_duration_minutes integer,
  p_cleanup_minutes integer, p_location_ids uuid[], p_staff_membership_ids uuid[]
) returns uuid language sql security definer set search_path = '' as $$
  select shop_private.save_scheduled_service(p_shop_id, p_service_id, p_name,
    p_description, p_base_sale_price, p_discount_type, p_discount_value,
    p_scheduling_enabled, p_duration_minutes, p_cleanup_minutes,
    p_location_ids, p_staff_membership_ids);
$$;

create function shop_private.validate_appointment_service_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_enabled boolean; v_duration integer; v_cleanup integer;
begin
  if new.service_id is null then return new; end if;
  select service.scheduling_enabled into v_enabled from public.services service
  where service.id = new.service_id and service.shop_id = new.shop_id;
  if not found then
    raise exception 'APPOINTMENT_SERVICE_LOCATION_STAFF_MISMATCH' using errcode = '23514';
  end if;
  if not v_enabled then return new; end if;
  if new.assigned_membership_id is null then
    raise exception 'APPOINTMENT_SCHEDULING_DETAILS_REQUIRED' using errcode = '23514';
  end if;
  select service.duration_minutes, service.cleanup_minutes
    into v_duration, v_cleanup
  from public.services service
  join public.service_location_availability availability
    on availability.service_id = service.id and availability.shop_id = service.shop_id
      and availability.location_id = new.location_id
  join public.service_staff_eligibility eligibility
    on eligibility.service_id = service.id and eligibility.shop_id = service.shop_id
      and eligibility.membership_id = new.assigned_membership_id
  join public.shop_memberships membership
    on membership.id = eligibility.membership_id and membership.shop_id = service.shop_id
  join public.profiles profile on profile.id = membership.profile_id
  join public.shop_locations location
    on location.id = availability.location_id and location.shop_id = service.shop_id
  join public.membership_location_assignments assignment
    on assignment.membership_id = membership.id and assignment.shop_id = service.shop_id
      and assignment.location_id = new.location_id
  where service.id = new.service_id and service.shop_id = new.shop_id
    and service.is_active and service.scheduling_enabled
    and membership.status = 'active' and membership.removed_at is null
    and profile.status = 'active' and location.status = 'active';
  if not found then
    raise exception 'APPOINTMENT_SERVICE_LOCATION_STAFF_MISMATCH' using errcode = '23514';
  end if;
  if new.ends_at <> new.starts_at + make_interval(mins => v_duration + v_cleanup) then
    raise exception 'APPOINTMENT_DURATION_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function shop_private.validate_appointment_service_schedule()
  from public, anon, authenticated, service_role;
create trigger trg_appointments_validate_service_schedule
before insert or update of shop_id, location_id, service_id,
  assigned_membership_id, starts_at, ends_at on public.appointments
for each row execute function shop_private.validate_appointment_service_schedule();

create function shop_private.snapshot_invoice_service_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.item_type = 'service'::public.invoice_item_type and new.service_id is not null then
    select service.duration_minutes, service.cleanup_minutes,
      array(select availability.location_id
        from public.service_location_availability availability
        where availability.service_id = service.id order by availability.location_id),
      array(select eligibility.membership_id
        from public.service_staff_eligibility eligibility
        where eligibility.service_id = service.id order by eligibility.membership_id)
      into new.service_duration_minutes_snapshot, new.service_cleanup_minutes_snapshot,
        new.service_location_ids_snapshot, new.service_staff_membership_ids_snapshot
    from public.services service
    where service.id = new.service_id and service.shop_id = new.shop_id;
  else
    new.service_duration_minutes_snapshot := null;
    new.service_cleanup_minutes_snapshot := null;
    new.service_location_ids_snapshot := null;
    new.service_staff_membership_ids_snapshot := null;
  end if;
  return new;
end;
$$;
revoke all on function shop_private.snapshot_invoice_service_schedule()
  from public, anon, authenticated, service_role;
create trigger trg_invoice_items_snapshot_service_schedule
before insert or update of service_id, item_name, unit_price,
  discount_amount, total_amount on public.invoice_items
for each row execute function shop_private.snapshot_invoice_service_schedule();

revoke all on function
  shop_private.list_services(uuid, text, integer, integer),
  shop_private.service_scheduling_options(uuid),
  shop_private.save_scheduled_service(uuid, uuid, text, text, numeric, text, numeric,
    boolean, integer, integer, uuid[], uuid[])
from public, anon, authenticated;
grant execute on function
  shop_private.list_services(uuid, text, integer, integer),
  shop_private.service_scheduling_options(uuid),
  shop_private.save_scheduled_service(uuid, uuid, text, text, numeric, text, numeric,
    boolean, integer, integer, uuid[], uuid[])
to service_role;

revoke all on function
  public.list_services(uuid, text, integer, integer),
  public.service_scheduling_options(uuid),
  public.save_service(uuid, uuid, text, text, numeric, text, numeric,
    boolean, integer, integer, uuid[], uuid[])
from public, anon, authenticated;
grant execute on function
  public.list_services(uuid, text, integer, integer),
  public.service_scheduling_options(uuid),
  public.save_service(uuid, uuid, text, text, numeric, text, numeric,
    boolean, integer, integer, uuid[], uuid[])
to authenticated, service_role;

notify pgrst, 'reload schema';
