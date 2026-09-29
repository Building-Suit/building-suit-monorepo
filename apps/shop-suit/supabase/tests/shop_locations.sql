-- SS-LOC-001: default-location compatibility, same-shop/location integrity,
-- owner/staff access, archival history, and location/all-location reporting.
create temporary table shop_location_fixture as
select gen_random_uuid() as owner_a_id, gen_random_uuid() as owner_b_id,
  gen_random_uuid() as staff_id, gen_random_uuid() as suspended_id,
  gen_random_uuid() as outsider_id;

insert into auth.users (
  id, email, encrypted_password, aud, role,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@ss-loc-001.invalid', 'x', 'authenticated',
  'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_a_id as id from shop_location_fixture
  union all select owner_b_id from shop_location_fixture
  union all select staff_id from shop_location_fixture
  union all select suspended_id from shop_location_fixture
  union all select outsider_id from shop_location_fixture
) users;

do $$
declare v_function record;
begin
  for v_function in
    select procedure.oid, procedure.proname, procedure.prosecdef, procedure.proconfig
    from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public' and procedure.proname = any(array[
      'list_shop_locations', 'save_shop_location', 'archive_shop_location',
      'assign_membership_locations', 'location_operational_report',
      'save_location_sale_draft', 'list_location_sales', 'get_location_sale',
      'issue_location_sale', 'checkout_location_sale',
      'record_location_customer_receipt'
    ])
  loop
    if not v_function.prosecdef
      or v_function.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', v_function.oid, 'execute')
      or has_function_privilege('anon', v_function.oid, 'execute') then
      raise exception 'unsafe location wrapper: %', v_function.proname;
    end if;
  end loop;
  if exists (
    select 1 from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'shop_private'
      and procedure.proname like '%location%'
      and procedure.proname <> 'user_can_access_location'
      and has_function_privilege('authenticated', procedure.oid, 'execute')
  ) then raise exception 'private location helper is browser-callable'; end if;
  if has_table_privilege('anon', 'public.shop_locations', 'select')
    or has_table_privilege('authenticated', 'public.shop_locations', 'update')
    or has_table_privilege('authenticated', 'public.membership_location_assignments', 'insert') then
    raise exception 'location administration has excessive table privileges';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_a_id::text, true)
from shop_location_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid; v_default uuid; v_branch uuid; v_customer uuid; v_service uuid;
  v_default_sale uuid; v_branch_sale uuid; v_owner_profile uuid;
  v_owner_membership uuid;
begin
  v_shop := public.create_owner_shop('Location fixture A', 'multi', 'service');

  select location.id into v_default
  from public.shop_locations location
  where location.shop_id = v_shop
    and location.is_default
    and location.status = 'active';

  if v_default is null
    or (select count(*) from public.shop_locations where shop_id = v_shop) <> 1 then
    raise exception 'new shop did not receive exactly one default location';
  end if;

  v_branch := public.save_shop_location(
    v_shop, null, 'Second branch', 'BR-2', 'Alexandria', '+20002'
  );

  if (select count(*) from public.list_shop_locations(v_shop)) <> 2 then
    raise exception 'owner cannot view both locations';
  end if;

  select membership.profile_id, membership.id
  into v_owner_profile, v_owner_membership
  from public.shop_memberships membership
  where membership.shop_id = v_shop
    and membership.role = 'owner';

  v_customer := public.save_customer(
    v_shop, null, 'Location customer', null, null, null, null
  );

  v_service := public.save_service(
    v_shop, null, 'Location service', null, 100, 'amount', 0
  );

  v_default_sale := public.save_location_sale_draft(
    gen_random_uuid(), v_shop, v_default, null, v_customer, null, null,
    jsonb_build_array(jsonb_build_object(
      'item_type', 'service',
      'source_id', v_service,
      'quantity', 1
    ))
  );

  perform public.issue_location_sale(
    gen_random_uuid(), v_shop, v_default, v_default_sale
  );

  v_branch_sale := public.save_location_sale_draft(
    gen_random_uuid(), v_shop, v_branch, null, v_customer, null, null,
    jsonb_build_array(jsonb_build_object(
      'item_type', 'service',
      'source_id', v_service,
      'quantity', 2
    ))
  );

  perform public.issue_location_sale(
    gen_random_uuid(), v_shop, v_branch, v_branch_sale
  );

  perform public.record_location_customer_receipt(
    gen_random_uuid(),
    v_shop,
    v_branch,
    v_customer,
    50,
    now(),
    'cash',
    null,
    null,
    jsonb_build_array(jsonb_build_object(
      'invoice_id', v_branch_sale,
      'amount', 50
    ))
  );

  if (select location_id from public.invoices where id = v_default_sale) <> v_default
    or (select location_id from public.invoices where id = v_branch_sale) <> v_branch
    or (public.location_operational_report(v_shop, v_branch) ->> 'sales')::numeric <> 200
    or (public.location_operational_report(v_shop, v_branch) ->> 'paymentsIn')::numeric <> 50
    or (public.location_operational_report(v_shop, null) ->> 'sales')::numeric <> 300 then
    raise exception 'location sale/report aggregation failed';
  end if;

  perform set_config('ss_loc.shop', v_shop::text, true);
  perform set_config('ss_loc.default', v_default::text, true);
  perform set_config('ss_loc.branch', v_branch::text, true);
  perform set_config('ss_loc.branch_sale', v_branch_sale::text, true);
  perform set_config('ss_loc.default_sale', v_default_sale::text, true);
  perform set_config('ss_loc.owner_profile', v_owner_profile::text, true);
  perform set_config('ss_loc.owner_membership', v_owner_membership::text, true);
  perform set_config('ss_loc.customer', v_customer::text, true);
  perform set_config('ss_loc.service', v_service::text, true);
end;
$$;
reset role;

-- Protected fixture rows are created by the database owner. Browser users
-- deliberately have no direct write permission to these tables.
do $$
declare
  v_shop uuid := current_setting('ss_loc.shop')::uuid;
  v_staff_profile uuid;
  v_staff_membership uuid;
  v_suspended_profile uuid;
  v_suspended_membership uuid;
  v_role uuid;
begin
  insert into public.profiles (
    user_id,
    portal_id,
    display_name,
    email_snapshot
  )
  select
    fixture.staff_id,
    shop.portal_id,
    'Location staff',
    'staff@ss-loc.invalid'
  from shop_location_fixture fixture
  cross join public.shops shop
  where shop.id = v_shop
  returning id into v_staff_profile;

  insert into public.shop_memberships (
    shop_id,
    profile_id,
    role
  )
  values (
    v_shop,
    v_staff_profile,
    'employee'
  )
  returning id into v_staff_membership;

  insert into public.profiles (
    user_id,
    portal_id,
    display_name,
    email_snapshot
  )
  select
    fixture.suspended_id,
    shop.portal_id,
    'Suspended staff',
    'suspended@ss-loc.invalid'
  from shop_location_fixture fixture
  cross join public.shops shop
  where shop.id = v_shop
  returning id into v_suspended_profile;

  -- Start active, assign the branch through the supported API, then suspend.
  insert into public.shop_memberships (
    shop_id,
    profile_id,
    role
  )
  values (
    v_shop,
    v_suspended_profile,
    'employee'
  )
  returning id into v_suspended_membership;

  insert into public.roles (
    shop_id,
    name
  )
  values (
    v_shop,
    'Location sales'
  )
  returning id into v_role;

  insert into public.role_permissions (
    role_id,
    permission_id
  )
  select
    v_role,
    permission.id
  from public.permissions permission
  join public.portals portal
    on portal.id = permission.portal_id
  where portal.key = 'shop-crm'
    and permission.key in (
      'sales.view',
      'sales.manage',
      'sales.issue'
    );

  insert into public.membership_roles (
    membership_id,
    role_id
  )
  values
    (v_staff_membership, v_role),
    (v_suspended_membership, v_role);

  perform set_config(
    'ss_loc.staff_membership',
    v_staff_membership::text,
    true
  );

  perform set_config(
    'ss_loc.suspended_membership',
    v_suspended_membership::text,
    true
  );
end;
$$;

-- Exercise location assignment through the real authenticated owner command.
select set_config('request.jwt.claim.sub', owner_a_id::text, true)
from shop_location_fixture;

set local role authenticated;

do $$
declare
  v_shop uuid := current_setting('ss_loc.shop')::uuid;
  v_branch uuid := current_setting('ss_loc.branch')::uuid;
begin
  perform public.assign_membership_locations(
    v_shop,
    current_setting('ss_loc.staff_membership')::uuid,
    array[v_branch]
  );

  perform public.assign_membership_locations(
    v_shop,
    current_setting('ss_loc.suspended_membership')::uuid,
    array[v_branch]
  );
end;
$$;

reset role;

-- Privileged fixture setup for historical appointment/cash records. This does
-- not grant browser table writes; it only prepares rows for access/history tests.
do $$
declare
  v_shop uuid := current_setting('ss_loc.shop')::uuid;
  v_branch uuid := current_setting('ss_loc.branch')::uuid;
  v_customer uuid := current_setting('ss_loc.customer')::uuid;
  v_service uuid := current_setting('ss_loc.service')::uuid;
  v_owner_profile uuid := current_setting('ss_loc.owner_profile')::uuid;
  v_owner_membership uuid := current_setting('ss_loc.owner_membership')::uuid;
  v_staff_membership uuid := current_setting('ss_loc.staff_membership')::uuid;
  v_suspended_membership uuid :=
    current_setting('ss_loc.suspended_membership')::uuid;
  v_default_sale uuid := current_setting('ss_loc.default_sale')::uuid;
begin
  -- Suspension occurs after the assignment exists so the test proves that an
  -- assigned member immediately loses branch access when suspended.
  update public.shop_memberships
  set status = 'suspended'
  where id = v_suspended_membership;

  insert into public.appointments (
    shop_id,
    location_id,
    client_id,
    service_id,
    assigned_membership_id,
    starts_at,
    ends_at,
    created_by_profile_id
  )
  values (
    v_shop,
    v_branch,
    v_customer,
    v_service,
    v_staff_membership,
    now() + interval '1 day',
    now() + interval '2 days',
    v_owner_profile
  );

  insert into public.cash_sessions (
    shop_id,
    location_id,
    opened_by_membership_id,
    opening_amount
  )
  values (
    v_shop,
    v_branch,
    v_owner_membership,
    100
  );

  -- This is a database invariant test, not a browser write. Run it as the DB
  -- owner so the immutability trigger is what rejects the mutation.
  begin
    update public.invoices
    set location_id = v_branch
    where id = v_default_sale;

    raise exception 'historical sale location changed';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'OPERATIONAL_LOCATION_IMMUTABLE' then
      raise;
    end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', staff_id::text, true)
from shop_location_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_loc.shop')::uuid;
  v_default uuid := current_setting('ss_loc.default')::uuid;
  v_branch uuid := current_setting('ss_loc.branch')::uuid;
begin
  if (select count(*) from public.list_shop_locations(v_shop)) <> 1
    or not exists (select 1 from public.list_shop_locations(v_shop) where id = v_branch)
    or exists (select 1 from public.invoices where shop_id = v_shop and location_id = v_default)
    or (select count(*) from public.invoices where shop_id = v_shop) <> 1
    or (public.list_location_sales(v_shop, v_branch) ->> 'total')::integer <> 1 then
    raise exception 'staff location restriction failed';
  end if;
  begin
    perform public.list_location_sales(v_shop, v_default);
    raise exception 'staff accessed an unassigned location';
  exception when insufficient_privilege then
    if sqlerrm <> 'LOCATION_ACCESS_DENIED' then raise; end if;
  end;
  begin
    perform public.list_sales(v_shop, null, null, null, null, 1, 20);
    raise exception 'location-less sale API leaked a multi-location shop';
  exception when insufficient_privilege then
    if sqlerrm <> 'LOCATION_CONTEXT_REQUIRED' then raise; end if;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', suspended_id::text, true)
from shop_location_fixture;
set local role authenticated;
do $$
begin
  if exists (select 1 from public.list_shop_locations(current_setting('ss_loc.shop')::uuid))
    or exists (select 1 from public.invoices
      where shop_id = current_setting('ss_loc.shop')::uuid) then
    raise exception 'suspended membership retained location access';
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', owner_b_id::text, true)
from shop_location_fixture;
set local role authenticated;
do $$
declare v_other_shop uuid;
begin
  v_other_shop := public.create_owner_shop('Location fixture B', 'multi', 'mixed');
  if exists (select 1 from public.shop_locations
      where shop_id = current_setting('ss_loc.shop')::uuid)
    or exists (select 1 from public.invoices
      where shop_id = current_setting('ss_loc.shop')::uuid) then
    raise exception 'cross-shop location isolation failed';
  end if;
  begin
    perform public.list_shop_locations(current_setting('ss_loc.shop')::uuid);
    if found then raise exception 'outsider listed another shop locations'; end if;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', owner_a_id::text, true)
from shop_location_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_loc.shop')::uuid;
  v_branch uuid := current_setting('ss_loc.branch')::uuid;
begin
  perform public.archive_shop_location(v_shop, v_branch);
  if (select status from public.shop_locations where id = v_branch) <> 'archived'
    or not exists (select 1 from public.invoices where location_id = v_branch)
    or not exists (select 1 from public.appointments where location_id = v_branch)
    or (public.location_operational_report(v_shop, v_branch) ->> 'sales')::numeric <> 200 then
    raise exception 'location archival hid or changed historical operations';
  end if;
  begin
    perform public.archive_shop_location(v_shop, current_setting('ss_loc.default')::uuid);
    raise exception 'default location archived';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'LOCATION_NOT_ARCHIVABLE' then raise; end if;
  end;
end;
$$;
reset role;

do $$
begin
  if exists (
    select 1 from (values
      ('invoices', 'trg_prevent_invoice_edit'),
      ('vendor_invoices', 'trg_prevent_vendor_invoice_edit'),
      ('inventory_movements', 'trg_prevent_inventory_movement_update'),
      ('stock_counts', 'trg_stock_counts_immutable'),
      ('payments', 'trg_prevent_payment_update'),
      ('customer_payment_allocations', 'trg_customer_payment_allocation_immutable'),
      ('supplier_payment_allocations', 'trg_supplier_payment_allocation_immutable'),
      ('customer_payment_adjustments', 'trg_customer_payment_adjustment_immutable')
    ) guard(table_name, trigger_name)
    where not exists (
      select 1 from pg_catalog.pg_trigger trigger
      where trigger.tgrelid = ('public.' || guard.table_name)::regclass
        and trigger.tgname = guard.trigger_name and trigger.tgenabled = 'O'
    )
  ) then raise exception 'location backfill left history mutation guards disabled'; end if;
  if exists (select 1 from public.shops shop where not exists (
      select 1 from public.shop_locations location
      where location.shop_id = shop.id and location.is_default
    ))
    or exists (select 1 from public.invoices where location_id is null)
    or exists (select 1 from public.payments where location_id is null) then
    raise exception 'existing shop/operation compatibility backfill incomplete';
  end if;
end;
$$;
