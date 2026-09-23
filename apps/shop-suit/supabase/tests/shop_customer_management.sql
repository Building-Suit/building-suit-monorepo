-- Focused SS-CUST-001 regression suite. The caller wraps this file in a
-- transaction and rolls back all synthetic fixtures.
create temporary table shop_customer_fixture as
select gen_random_uuid() as owner_a_id,
  gen_random_uuid() as owner_b_id,
  gen_random_uuid() as employee_id,
  gen_random_uuid() as outsider_id;

insert into auth.users (
  id, email, encrypted_password, aud, role,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@ss-cust-001.invalid', 'x', 'authenticated',
  'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_a_id as id from shop_customer_fixture
  union all select owner_b_id from shop_customer_fixture
  union all select employee_id from shop_customer_fixture
  union all select outsider_id from shop_customer_fixture
) users;

do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid, p.proname, p.prosecdef, p.proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'customer_access', 'list_customers', 'get_customer',
        'save_customer', 'archive_customer'
      ])
  loop
    if not v_function.prosecdef
      or v_function.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', v_function.oid, 'execute')
      or has_function_privilege('anon', v_function.oid, 'execute') then
      raise exception 'unsafe customer wrapper: %', v_function.proname;
    end if;
  end loop;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'shop_private'
      and p.proname = any(array[
        'customer_access', 'assert_customer_read_access', 'list_customers',
        'get_customer', 'save_customer', 'archive_customer'
      ])
      and (has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('anon', p.oid, 'execute'))
  ) then
    raise exception 'private customer implementation is browser-callable';
  end if;

  if has_table_privilege('authenticated', 'public.clients', 'insert')
    or has_table_privilege('authenticated', 'public.clients', 'update')
    or has_table_privilege('authenticated', 'public.clients', 'delete') then
    raise exception 'authenticated direct customer write remains';
  end if;

  if exists (
    select 1 from pg_constraint
    where conname in ('invoices_client_shop_fk', 'payments_client_shop_fk')
      and not convalidated
  ) or (
    select count(*) from pg_constraint
    where conname in ('invoices_client_shop_fk', 'payments_client_shop_fk')
  ) <> 2 then
    raise exception 'customer same-shop constraints are missing or unvalidated';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_a_id::text, true)
from shop_customer_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid;
  v_customer_a uuid;
  v_customer_b uuid;
  v_customer_c uuid;
  v_page jsonb;
begin
  v_shop := public.create_owner_shop(
    'Customer fixture A', 'pro', 'mixed'::public.business_mode
  );
  v_customer_a := public.save_customer(
    v_shop, null, 'Alpha Customer', '+20 100 000 0001',
    'alpha@example.invalid', 'Cairo', 'Priority contact'
  );
  v_customer_b := public.save_customer(
    v_shop, null, 'Beta Customer', '+20 100 000 0002',
    'beta@example.invalid', null, null
  );
  v_customer_c := public.save_customer(
    v_shop, null, 'Gamma Customer', null, null, null, null
  );
  perform public.save_customer(
    v_shop, v_customer_a, 'Alpha Customer Updated', '+20 100 000 0099',
    'alpha.updated@example.invalid', 'Giza', 'Edited contact'
  );

  v_page := public.list_customers(v_shop, null, true, 1, 2);
  if (v_page ->> 'total')::integer <> 3
    or jsonb_array_length(v_page -> 'items') <> 2
    or not (v_page ->> 'canManage')::boolean then
    raise exception 'customer first page is incorrect: %', v_page;
  end if;
  v_page := public.list_customers(v_shop, '0002', true, 1, 20);
  if (v_page ->> 'total')::integer <> 1
    or v_page #>> '{items,0,name}' <> 'Beta Customer' then
    raise exception 'customer server search is incorrect: %', v_page;
  end if;

  perform set_config('ss_cust.shop_a', v_shop::text, true);
  perform set_config('ss_cust.customer_a', v_customer_a::text, true);
  perform set_config('ss_cust.customer_b', v_customer_b::text, true);
  perform set_config('ss_cust.customer_c', v_customer_c::text, true);
end;
$$;
reset role;

do $$
declare
  v_profile uuid;
begin
  select created_by_profile_id into v_profile
  from public.clients
  where id = current_setting('ss_cust.customer_a')::uuid;
  insert into public.invoices (
    shop_id, created_by_profile_id, invoice_number, status,
    total_amount, client_id, client_name_snapshot
  ) values (
    current_setting('ss_cust.shop_a')::uuid, v_profile,
    'SS-CUST-HISTORY-1', 'draft', 0,
    current_setting('ss_cust.customer_a')::uuid, 'Alpha Customer Updated'
  );
end;
$$;

select set_config('request.jwt.claim.sub', owner_b_id::text, true)
from shop_customer_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid;
  v_customer uuid;
begin
  v_shop := public.create_owner_shop(
    'Customer fixture B', 'pro', 'mixed'::public.business_mode
  );
  v_customer := public.save_customer(
    v_shop, null, 'Other Shop Customer', null, null, null, null
  );
  perform set_config('ss_cust.shop_b', v_shop::text, true);
  perform set_config('ss_cust.customer_shop_b', v_customer::text, true);
end;
$$;
reset role;

-- Cross-shop customer IDs cannot be edited, archived, or attached to documents.
select set_config('request.jwt.claim.sub', owner_a_id::text, true)
from shop_customer_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.save_customer(
      current_setting('ss_cust.shop_a')::uuid,
      current_setting('ss_cust.customer_shop_b')::uuid,
      'Injected Customer', null, null, null, null
    );
    raise exception 'cross-shop customer update accepted';
  exception when others then
    if sqlerrm <> 'CUSTOMER_NOT_FOUND' then raise; end if;
  end;
  begin
    perform public.archive_customer(
      current_setting('ss_cust.shop_a')::uuid,
      current_setting('ss_cust.customer_shop_b')::uuid
    );
    raise exception 'cross-shop customer archive accepted';
  exception when others then
    if sqlerrm <> 'CUSTOMER_NOT_FOUND' then raise; end if;
  end;
end;
$$;
reset role;

do $$
declare
  v_profile uuid;
begin
  select created_by_profile_id into v_profile
  from public.clients
  where id = current_setting('ss_cust.customer_a')::uuid;
  begin
    insert into public.invoices (
      shop_id, created_by_profile_id, invoice_number, status,
      total_amount, client_id, client_name_snapshot
    ) values (
      current_setting('ss_cust.shop_a')::uuid, v_profile,
      'SS-CUST-CROSS-1', 'draft', 0,
      current_setting('ss_cust.customer_shop_b')::uuid, 'Injected Customer'
    );
    raise exception 'cross-shop invoice customer accepted';
  exception when foreign_key_violation then null;
  end;
end;
$$;

-- Outsiders cannot read or mutate customer records.
select set_config('request.jwt.claim.sub', outsider_id::text, true)
from shop_customer_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.list_customers(
      current_setting('ss_cust.shop_a')::uuid, null, true, 1, 20
    );
    raise exception 'outsider customer read accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
  begin
    perform public.save_customer(
      current_setting('ss_cust.shop_a')::uuid, null,
      'Outsider Customer', null, null, null, null
    );
    raise exception 'outsider customer create accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end;
$$;
reset role;

-- A delegated member needs both read and manage permissions. Suspension takes
-- effect immediately for the same JWT.
do $$
declare
  v_profile uuid;
  v_view_permission uuid;
  v_manage_permission uuid;
  v_role uuid;
  v_membership uuid;
begin
  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select employee_id, s.portal_id, 'Customer employee', 'employee@ss-cust.invalid'
  from shop_customer_fixture f
  join public.shops s on s.id = current_setting('ss_cust.shop_a')::uuid
  returning id into v_profile;
  insert into public.shop_memberships (shop_id, profile_id, role)
  values (current_setting('ss_cust.shop_a')::uuid, v_profile, 'employee')
  returning id into v_membership;
  select p.id into v_view_permission from public.permissions p
  join public.shops s on s.portal_id = p.portal_id
  where s.id = current_setting('ss_cust.shop_a')::uuid
    and p.key = 'clients.view';
  select p.id into v_manage_permission from public.permissions p
  join public.shops s on s.portal_id = p.portal_id
  where s.id = current_setting('ss_cust.shop_a')::uuid
    and p.key = 'clients.manage';
  insert into public.roles (shop_id, name)
  values (current_setting('ss_cust.shop_a')::uuid, 'Customer manager')
  returning id into v_role;
  insert into public.role_permissions (role_id, permission_id)
  values (v_role, v_view_permission), (v_role, v_manage_permission);
  perform set_config('ss_cust.employee_membership', v_membership::text, true);
  perform set_config('ss_cust.employee_role', v_role::text, true);
end;
$$;

select set_config('request.jwt.claim.sub', employee_id::text, true)
from shop_customer_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.save_customer(
      current_setting('ss_cust.shop_a')::uuid, null,
      'Unprivileged Customer', null, null, null, null
    );
    raise exception 'unprivileged employee customer write accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end;
$$;
reset role;

insert into public.membership_roles (membership_id, role_id)
values (
  current_setting('ss_cust.employee_membership')::uuid,
  current_setting('ss_cust.employee_role')::uuid
);
select set_config('request.jwt.claim.sub', employee_id::text, true)
from shop_customer_fixture;
set local role authenticated;
do $$
declare
  v_customer uuid;
begin
  v_customer := public.save_customer(
    current_setting('ss_cust.shop_a')::uuid, null,
    'Delegated Customer', null, null, null, null
  );
  if (public.list_customers(
      current_setting('ss_cust.shop_a')::uuid, 'Delegated', true, 1, 20
    ) ->> 'total')::integer <> 1 then
    raise exception 'authorized employee customer access failed';
  end if;
  perform public.archive_customer(current_setting('ss_cust.shop_a')::uuid, v_customer);
end;
$$;
reset role;

update public.shop_memberships set status = 'suspended'
where id = current_setting('ss_cust.employee_membership')::uuid;
select set_config('request.jwt.claim.sub', employee_id::text, true)
from shop_customer_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.save_customer(
      current_setting('ss_cust.shop_a')::uuid, null,
      'Suspended Customer', null, null, null, null
    );
    raise exception 'suspended employee customer write accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end;
$$;
reset role;

-- Archive preserves the customer and linked invoice snapshot while active and
-- archived server filters remain distinct.
select set_config('request.jwt.claim.sub', owner_a_id::text, true)
from shop_customer_fixture;
set local role authenticated;
do $$
declare
  v_archived jsonb;
begin
  perform public.archive_customer(
    current_setting('ss_cust.shop_a')::uuid,
    current_setting('ss_cust.customer_a')::uuid
  );
  v_archived := public.list_customers(
    current_setting('ss_cust.shop_a')::uuid, 'Alpha', false, 1, 20
  );
  if (v_archived ->> 'total')::integer <> 1
    or (v_archived #>> '{items,0,is_active}')::boolean then
    raise exception 'archived customer filter failed: %', v_archived;
  end if;
  if not exists (
    select 1 from public.get_customer(
      current_setting('ss_cust.shop_a')::uuid,
      current_setting('ss_cust.customer_a')::uuid
    ) customer where not customer.is_active
  ) then
    raise exception 'archived customer detail is not queryable';
  end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1 from public.invoices
    where shop_id = current_setting('ss_cust.shop_a')::uuid
      and client_id = current_setting('ss_cust.customer_a')::uuid
      and client_name_snapshot = 'Alpha Customer Updated'
  ) then
    raise exception 'customer archive destroyed linked document history';
  end if;
end;
$$;
