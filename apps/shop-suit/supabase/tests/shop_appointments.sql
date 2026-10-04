-- SS-APPT-001: tenant authorization, working time, overlap prevention,
-- idempotency, state history, walk-ins and sale linkage.
create temporary table shop_appointment_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() staff_id,
  gen_random_uuid() outsider_id;
grant select on shop_appointment_fixture to authenticated;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, email, 'x', 'authenticated', 'authenticated', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id id, 'owner@ss-appointments.invalid' email from shop_appointment_fixture
  union all select staff_id, 'staff@ss-appointments.invalid' from shop_appointment_fixture
  union all select outsider_id, 'outsider@ss-appointments.invalid' from shop_appointment_fixture
) users;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_appointment_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_location uuid; v_owner_membership uuid;
  v_service uuid; v_customer uuid;
begin
  v_shop := public.create_owner_shop('Appointment fixture', 'team', 'service');
  select id into v_location from public.shop_locations where shop_id = v_shop and is_default;
  select id into v_owner_membership from public.shop_memberships where shop_id = v_shop and role = 'owner';
  v_service := public.save_service(v_shop, null, 'Appointment haircut', null, 100,
    'amount', 0, true, 30, 5, array[v_location], array[v_owner_membership]);
  v_customer := public.save_customer(v_shop, null, 'Appointment customer',
    '01000000000', 'appointment@example.invalid', null, null);
  perform public.save_staff_schedule(v_shop, v_location, v_owner_membership,
    'Africa/Cairo',
    (select jsonb_agg(jsonb_build_object('weekday', day,
      'startsLocal', '08:00', 'endsLocal', '20:00')) from generate_series(0, 6) day),
    '[]'::jsonb);
  perform set_config('ss_appt.shop', v_shop::text, true);
  perform set_config('ss_appt.location', v_location::text, true);
  perform set_config('ss_appt.owner_membership', v_owner_membership::text, true);
  perform set_config('ss_appt.service', v_service::text, true);
  perform set_config('ss_appt.customer', v_customer::text, true);
end;
$$;
reset role;

-- Privileged fixture setup stays outside the authenticated command checks.
do $$
declare v_shop uuid := current_setting('ss_appt.shop')::uuid;
  v_staff_profile uuid; v_staff_membership uuid; v_role uuid;
begin
  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select fixture.staff_id, shop.portal_id, 'Fixture barber', 'staff@ss-appointments.invalid'
  from shop_appointment_fixture fixture join public.shops shop on shop.id = v_shop
  returning id into v_staff_profile;
  insert into public.shop_memberships (shop_id, profile_id, role)
    values (v_shop, v_staff_profile, 'employee') returning id into v_staff_membership;
  select id into v_role from public.roles where shop_id = v_shop and key = 'barber';
  insert into public.membership_roles (membership_id, role_id) values (v_staff_membership, v_role);
  perform set_config('ss_appt.staff_membership', v_staff_membership::text, true);
end;
$$;

set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_appt.shop')::uuid;
  v_location uuid := current_setting('ss_appt.location')::uuid;
  v_member uuid := current_setting('ss_appt.owner_membership')::uuid;
  v_service uuid := current_setting('ss_appt.service')::uuid;
  v_customer uuid := current_setting('ss_appt.customer')::uuid;
  v_start timestamptz := date_trunc('day', now()) + interval '1 day 10 hours';
  v_request uuid := gen_random_uuid(); v_appointment uuid; v_retry uuid; v_walk_in uuid;
  v_sale uuid; v_history jsonb;
begin
  v_appointment := public.save_appointment(v_request, v_shop, null, v_location,
    v_member, v_service, v_start, 'customer', v_customer, null, null, 'First visit');
  v_retry := public.save_appointment(v_request, v_shop, null, v_location,
    v_member, v_service, v_start, 'customer', v_customer, null, null, 'First visit');
  if v_retry <> v_appointment or (select count(*) from public.appointments where id = v_appointment) <> 1 then
    raise exception 'idempotent retry created another appointment';
  end if;
  begin
    perform public.save_appointment(gen_random_uuid(), v_shop, null, v_location,
      v_member, v_service, v_start + interval '10 minutes', 'walk_in', null,
      'Overlapping walk-in', null, null);
    raise exception 'overlapping appointment was accepted';
  exception when exclusion_violation then
    if sqlerrm <> 'APPOINTMENT_STAFF_CONFLICT' then raise; end if;
  end;
  begin
    perform public.save_appointment(gen_random_uuid(), v_shop, null, v_location,
      v_member, v_service, date_trunc('day', now()) + interval '2 days',
      'walk_in', null, 'Early walk-in', null, null);
    raise exception 'appointment outside working hours was accepted';
  exception when check_violation then
    if sqlerrm <> 'APPOINTMENT_OUTSIDE_WORKING_HOURS' then raise; end if;
  end;
  perform public.save_staff_schedule(v_shop, v_location, v_member, 'Africa/Cairo',
    (select jsonb_agg(jsonb_build_object('weekday', day,
      'startsLocal', '08:00', 'endsLocal', '20:00')) from generate_series(0, 6) day),
    jsonb_build_array(jsonb_build_object('kind', 'time_off',
      'startsAt', date_trunc('day', now()) + interval '3 days 9 hours',
      'endsAt', date_trunc('day', now()) + interval '3 days 12 hours',
      'note', 'Training')));
  begin
    perform public.save_appointment(gen_random_uuid(), v_shop, null, v_location,
      v_member, v_service, date_trunc('day', now()) + interval '3 days 10 hours',
      'walk_in', null, 'Blocked walk-in', null, null);
    raise exception 'appointment during time off was accepted';
  exception when check_violation then
    if sqlerrm <> 'APPOINTMENT_STAFF_UNAVAILABLE' then raise; end if;
  end;
  perform public.transition_appointment(gen_random_uuid(), v_shop, v_appointment, 'arrived');
  perform public.transition_appointment(gen_random_uuid(), v_shop, v_appointment, 'waiting');
  perform public.transition_appointment(gen_random_uuid(), v_shop, v_appointment, 'in_service');
  perform public.transition_appointment(gen_random_uuid(), v_shop, v_appointment, 'completed');
  begin
    perform public.transition_appointment(gen_random_uuid(), v_shop, v_appointment, 'cancelled', 'Too late');
    raise exception 'invalid status transition was accepted';
  exception when check_violation then
    if sqlerrm <> 'INVALID_APPOINTMENT_TRANSITION' then raise; end if;
  end;
  -- Audit tables are private; verify history through the same authorized RPC as the UI.
  select appointment -> 'history' into v_history
  from jsonb_array_elements(public.appointment_calendar(v_shop, v_location,
    v_start, v_start + interval '1 day', v_member) -> 'appointments') appointment
  where appointment ->> 'id' = v_appointment::text;
  if coalesce(jsonb_array_length(v_history), 0) < 5 then
    raise exception 'appointment audit history is incomplete';
  end if;
  v_walk_in := public.save_appointment(gen_random_uuid(), v_shop, null, v_location,
    v_member, v_service, date_trunc('day', now()) + interval '4 days 10 hours',
    'walk_in', null, 'Walk-in customer', '01000000001', 'Queue entry');
  if not exists (select 1 from public.appointments where id = v_walk_in
      and identity_kind = 'walk_in' and client_id is null and walk_in_name = 'Walk-in customer') then
    raise exception 'explicit walk-in identity was not stored';
  end if;
  v_sale := public.save_location_sale_draft(gen_random_uuid(), v_shop, v_location,
    null, v_customer, null, 'Appointment checkout', jsonb_build_array(
      jsonb_build_object('item_type', 'service', 'source_id', v_service, 'quantity', 1)));
  perform public.link_appointment_sale(gen_random_uuid(), v_shop, v_appointment, v_sale);
  select appointment -> 'history' into v_history
  from jsonb_array_elements(public.appointment_calendar(v_shop, v_location,
    v_start, v_start + interval '1 day', v_member) -> 'appointments') appointment
  where appointment ->> 'id' = v_appointment::text;
  if (select sale_id from public.appointments where id = v_appointment) is distinct from v_sale
    or not exists (select 1 from jsonb_array_elements(v_history) event where event ->> 'action' = 'sale_linked') then
    raise exception 'linked sale was not preserved';
  end if;
  perform set_config('ss_appt.appointment', v_appointment::text, true);
end;
$$;
reset role;

-- Cross-shop references are rejected by the command before any appointment is written.
select set_config('request.jwt.claim.sub', outsider_id::text, true) from shop_appointment_fixture;
set local role authenticated;
do $$
declare v_other_shop uuid; v_other_customer uuid;
begin
  v_other_shop := public.create_owner_shop('Appointment outsider', 'team', 'service');
  v_other_customer := public.save_customer(v_other_shop, null, 'Other customer', null, null, null, null);
  perform set_config('ss_appt.other_customer', v_other_customer::text, true);
  begin
    perform public.appointment_calendar(current_setting('ss_appt.shop')::uuid,
      current_setting('ss_appt.location')::uuid, now(), now() + interval '1 day', null);
    raise exception 'outsider accessed another shop calendar';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_appointment_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.save_appointment(gen_random_uuid(), current_setting('ss_appt.shop')::uuid,
      null, current_setting('ss_appt.location')::uuid,
      current_setting('ss_appt.owner_membership')::uuid,
      current_setting('ss_appt.service')::uuid,
      date_trunc('day', now()) + interval '5 days 10 hours', 'customer',
      current_setting('ss_appt.other_customer')::uuid, null, null, null);
    raise exception 'cross-shop customer was accepted';
  exception when foreign_key_violation then
    if sqlerrm <> 'INVALID_APPOINTMENT_CUSTOMER' then raise; end if;
  end;
  if has_table_privilege('authenticated', 'public.appointments', 'insert')
    or has_table_privilege('authenticated', 'public.appointments', 'update') then
    raise exception 'authenticated direct appointment writes remain available';
  end if;
end;
$$;
reset role;

-- A delegated barber can read/manage appointments at an assigned location.
select set_config('request.jwt.claim.sub', staff_id::text, true) from shop_appointment_fixture;
set local role authenticated;
do $$
declare v_result jsonb;
begin
  v_result := public.appointment_calendar(current_setting('ss_appt.shop')::uuid,
    current_setting('ss_appt.location')::uuid,
    date_trunc('day', now()), date_trunc('day', now()) + interval '7 days', null);
  if jsonb_array_length(v_result -> 'appointments') < 2 then
    raise exception 'delegated staff could not read appointments';
  end if;
end;
$$;
reset role;

update public.shop_memberships set status = 'suspended'
where id = current_setting('ss_appt.staff_membership')::uuid;
select set_config('request.jwt.claim.sub', staff_id::text, true) from shop_appointment_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.appointment_options(current_setting('ss_appt.shop')::uuid);
    raise exception 'suspended staff retained appointment access';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end;
$$;
reset role;

rollback;
