-- SS-BARBER-CORE-001: opt-in scheduling, tenant/location/staff boundaries,
-- historical sale snapshots, and legacy unscheduled-service compatibility.
create temporary table shop_barber_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() staff_id,
  gen_random_uuid() outsider_id;
grant select on shop_barber_fixture to authenticated;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, email, 'x', 'authenticated', 'authenticated', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id id, 'owner@ss-barber.invalid' email from shop_barber_fixture
  union all select staff_id, 'staff@ss-barber.invalid' from shop_barber_fixture
  union all select outsider_id, 'outsider@ss-barber.invalid' from shop_barber_fixture
) users;

do $$
declare function_row record;
begin
  for function_row in
    select procedure.oid, procedure.proname, procedure.prosecdef, procedure.proconfig
    from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public' and procedure.proname = any(array[
      'list_services', 'service_scheduling_options'
    ])
  loop
    if not function_row.prosecdef
      or function_row.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', function_row.oid, 'execute')
      or has_function_privilege('anon', function_row.oid, 'execute') then
      raise exception 'unsafe service scheduling wrapper: %', function_row.proname;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.service_location_availability', 'select')
    or has_table_privilege('authenticated', 'public.service_staff_eligibility', 'select') then
    raise exception 'service scheduling internals are browser-readable';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_barber_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_default uuid; v_branch uuid; v_owner_membership uuid;
begin
  v_shop := public.create_owner_shop('Barber fixture', 'multi', 'service');
  select id into v_default from public.shop_locations
    where shop_id = v_shop and is_default;
  v_branch := public.save_shop_location(v_shop, null, 'Barber branch', 'BARBER', null, null);
  select id into v_owner_membership from public.shop_memberships
    where shop_id = v_shop and role = 'owner';
  perform set_config('ss_barber.shop', v_shop::text, true);
  perform set_config('ss_barber.default', v_default::text, true);
  perform set_config('ss_barber.branch', v_branch::text, true);
  perform set_config('ss_barber.owner_membership', v_owner_membership::text, true);
end;
$$;
reset role;

do $$
declare v_shop uuid := current_setting('ss_barber.shop')::uuid;
  v_branch uuid := current_setting('ss_barber.branch')::uuid;
  v_staff_profile uuid; v_staff_membership uuid; v_barber_role uuid;
begin
  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select fixture.staff_id, shop.portal_id, 'Scheduled barber', 'staff@ss-barber.invalid'
  from shop_barber_fixture fixture join public.shops shop on shop.id = v_shop
  returning id into v_staff_profile;
  insert into public.shop_memberships (shop_id, profile_id, role)
    values (v_shop, v_staff_profile, 'employee') returning id into v_staff_membership;
  select id into v_barber_role from public.roles where shop_id = v_shop and key = 'barber';
  insert into public.membership_roles (membership_id, role_id) values (v_staff_membership, v_barber_role);
  delete from public.membership_location_assignments where membership_id = v_staff_membership;
  insert into public.membership_location_assignments (shop_id, membership_id, location_id)
    values (v_shop, v_staff_membership, v_branch);
  perform set_config('ss_barber.staff_membership', v_staff_membership::text, true);
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_barber_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_barber.shop')::uuid;
  v_branch uuid := current_setting('ss_barber.branch')::uuid;
  v_staff uuid := current_setting('ss_barber.staff_membership')::uuid;
  v_owner uuid := current_setting('ss_barber.owner_membership')::uuid;
  v_service uuid; v_legacy uuid; v_customer uuid; v_sale uuid; v_result jsonb;
begin
  -- The old signature remains valid and creates an ordinary service with no
  -- scheduling or inventory dependency.
  v_legacy := public.save_service(v_shop, null, 'Walk-in item', null, 25, 'amount', 0);
  if (select scheduling_enabled from public.services where id = v_legacy) then
    raise exception 'legacy service was forced into scheduling';
  end if;

  v_service := public.save_service(v_shop, null, 'Haircut', 'Scheduled cut', 100,
    'percent', 10, true, 30, 5, array[v_branch], array[v_staff]);
  perform set_config('ss_barber.service', v_service::text, true);

  v_result := public.list_services(v_shop, 'hair', 1, 20);
  if (v_result ->> 'total')::integer <> 1
    or v_result #>> '{items,0,durationMinutes}' <> '30'
    or jsonb_array_length(v_result #> '{items,0,locationIds}') <> 1
    or jsonb_array_length(v_result #> '{items,0,staffMembershipIds}') <> 1 then
    raise exception 'server-filtered scheduling catalog read failed';
  end if;
  if jsonb_array_length(public.service_scheduling_options(v_shop) -> 'locations') <> 2
    or jsonb_array_length(public.service_scheduling_options(v_shop) -> 'staff') <> 2 then
    raise exception 'service scheduling options omitted shop members or locations';
  end if;

  begin
    perform public.save_service(v_shop, v_service, 'Haircut', null, 100, 'amount', 0,
      true, 30, 5, array[current_setting('ss_barber.default')::uuid], array[v_staff]);
    raise exception 'incompatible staff/location assignment accepted';
  exception when check_violation then
    if sqlerrm <> 'SERVICE_STAFF_LOCATION_MISMATCH' then raise; end if;
  end;

  v_customer := public.save_customer(v_shop, null, 'Barber customer', null, null, null, null);
  v_sale := public.save_location_sale_draft(gen_random_uuid(), v_shop, v_branch,
    null, v_customer, null, null, jsonb_build_array(jsonb_build_object(
      'item_type', 'service', 'source_id', v_service, 'quantity', 1)));
  perform public.issue_location_sale(gen_random_uuid(), v_shop, v_branch, v_sale);
  perform set_config('ss_barber.sale', v_sale::text, true);

  -- Editing scheduling later cannot rewrite the issued sale snapshot.
  perform public.save_service(v_shop, v_service, 'Haircut updated', null, 120, 'amount', 0,
    true, 45, 10, array[v_branch], array[v_staff, v_owner]);
  if not exists (select 1 from public.invoice_items item where item.invoice_id = v_sale
      and item.item_name = 'Haircut'
      and item.service_duration_minutes_snapshot = 30
      and item.service_cleanup_minutes_snapshot = 5
      and item.service_location_ids_snapshot = array[v_branch]
      and item.service_staff_membership_ids_snapshot = array[v_staff]) then
    raise exception 'issued service scheduling snapshot changed with catalog edit';
  end if;
end;
$$;
reset role;

-- The appointment invariant validates the complete shop/location/staff tuple.
select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_barber_fixture;
set local role authenticated;
select public.save_staff_schedule(
  current_setting('ss_barber.shop')::uuid,
  current_setting('ss_barber.branch')::uuid,
  current_setting('ss_barber.staff_membership')::uuid,
  'Africa/Cairo',
  (select jsonb_agg(jsonb_build_object('weekday', day,
    'startsLocal', '08:00', 'endsLocal', '20:00')) from generate_series(0, 6) day),
  '[]'::jsonb
);
reset role;
do $$
declare v_shop uuid := current_setting('ss_barber.shop')::uuid;
  v_branch uuid := current_setting('ss_barber.branch')::uuid;
  v_service uuid := current_setting('ss_barber.service')::uuid;
  v_staff uuid := current_setting('ss_barber.staff_membership')::uuid;
  v_owner_profile uuid;
begin
  select profile_id into v_owner_profile from public.shop_memberships
    where id = current_setting('ss_barber.owner_membership')::uuid;
  insert into public.appointments (shop_id, location_id, service_id,
    assigned_membership_id, starts_at, ends_at, created_by_profile_id)
  values (v_shop, v_branch, v_service, v_staff,
    date_trunc('day', now()) + interval '1 day 10 hours',
    date_trunc('day', now()) + interval '1 day 10 hours 55 minutes', v_owner_profile);
  -- Keep the staff/location tuple valid so this case isolates the service's
  -- location availability instead of the pre-existing staff assignment guard.
  insert into public.membership_location_assignments (shop_id, membership_id, location_id)
    values (v_shop, v_staff, current_setting('ss_barber.default')::uuid);
  -- Satisfy availability at this location so the service eligibility guard is
  -- the only invalid prerequisite for the appointment below.
  perform public.save_staff_schedule(
    v_shop, current_setting('ss_barber.default')::uuid, v_staff, 'Africa/Cairo',
    (select jsonb_agg(jsonb_build_object('weekday', day,
      'startsLocal', '08:00', 'endsLocal', '20:00')) from generate_series(0, 6) day),
    '[]'::jsonb
  );
  begin
    insert into public.appointments (shop_id, location_id, service_id,
      assigned_membership_id, starts_at, ends_at, created_by_profile_id)
    values (v_shop, current_setting('ss_barber.default')::uuid, v_service, v_staff,
      date_trunc('day', now()) + interval '2 days 10 hours',
      date_trunc('day', now()) + interval '2 days 10 hours 55 minutes', v_owner_profile);
    raise exception 'appointment accepted incompatible service location and staff';
  exception when check_violation then
    if sqlerrm <> 'APPOINTMENT_SERVICE_LOCATION_STAFF_MISMATCH' then raise; end if;
  end;
  begin
    insert into public.appointments (shop_id, location_id, service_id,
      assigned_membership_id, starts_at, ends_at, created_by_profile_id)
    values (v_shop, v_branch, v_service, v_staff,
      date_trunc('day', now()) + interval '3 days 10 hours',
      date_trunc('day', now()) + interval '3 days 10 hours 45 minutes', v_owner_profile);
    raise exception 'appointment accepted incompatible duration';
  exception when check_violation then
    if sqlerrm <> 'APPOINTMENT_DURATION_MISMATCH' then raise; end if;
  end;
end;
$$;

-- Delegated staff can read but cannot mutate the service catalog.
select set_config('request.jwt.claim.sub', staff_id::text, true) from shop_barber_fixture;
set local role authenticated;
do $$ begin
  if (public.list_services(current_setting('ss_barber.shop')::uuid, null, 1, 20) ->> 'total')::integer < 2 then
    raise exception 'eligible staff could not read service catalog';
  end if;
  begin
    perform public.save_service(current_setting('ss_barber.shop')::uuid, null,
      'Unauthorized service', null, 1, 'amount', 0, false, null, 0, '{}'::uuid[], '{}'::uuid[]);
    raise exception 'staff without manage permission changed service scheduling';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end;
$$;
reset role;

update public.shop_memberships set status = 'suspended'
where id = current_setting('ss_barber.staff_membership')::uuid;
select set_config('request.jwt.claim.sub', staff_id::text, true) from shop_barber_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.list_services(current_setting('ss_barber.shop')::uuid, null, 1, 20);
    raise exception 'suspended staff retained service access';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end;
$$;
reset role;
select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_barber_fixture;
do $$
declare v_owner_profile uuid;
begin
  select profile_id into v_owner_profile from public.shop_memberships
    where id = current_setting('ss_barber.owner_membership')::uuid;
  begin
    insert into public.appointments (shop_id, location_id, service_id,
      assigned_membership_id, starts_at, ends_at, created_by_profile_id)
    values (current_setting('ss_barber.shop')::uuid,
      current_setting('ss_barber.branch')::uuid,
      current_setting('ss_barber.service')::uuid,
      current_setting('ss_barber.staff_membership')::uuid,
      date_trunc('day', now()) + interval '4 days 10 hours',
      date_trunc('day', now()) + interval '4 days 10 hours 55 minutes', v_owner_profile);
    raise exception 'suspended staff remained appointment eligible';
  exception when check_violation then
    if sqlerrm <> 'STAFF_LOCATION_ASSIGNMENT_REQUIRED' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', outsider_id::text, true) from shop_barber_fixture;
set local role authenticated;
do $$ begin
  perform public.create_owner_shop('Barber outsider', 'team', 'mixed');
  begin
    perform public.list_services(current_setting('ss_barber.shop')::uuid, null, 1, 20);
    raise exception 'outsider accessed scheduled service catalog';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end;
$$;
reset role;

rollback;
