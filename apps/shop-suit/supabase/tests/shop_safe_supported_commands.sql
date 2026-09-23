-- Focused SS-SAFE-001 regression suite. The runner wraps this file in a
-- transaction and rolls back all synthetic fixtures.
create temporary table shop_safe_fixture as
select gen_random_uuid() as owner_a_id,
  gen_random_uuid() as owner_b_id,
  gen_random_uuid() as employee_id,
  gen_random_uuid() as outsider_id;

insert into auth.users (
  id, email, encrypted_password, aud, role,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@ss-safe-001.invalid', 'x', 'authenticated',
  'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_a_id as id from shop_safe_fixture
  union all select owner_b_id from shop_safe_fixture
  union all select employee_id from shop_safe_fixture
  union all select outsider_id from shop_safe_fixture
) users;

do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid, n.nspname, p.proname, p.prosecdef, p.proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'create_owner_shop', 'set_shop_business_mode', 'save_product',
        'archive_product', 'save_service', 'archive_service', 'adjust_stock',
        'save_expense', 'void_expense', 'create_vendor',
        'create_supplier_purchase', 'void_supplier_purchase'
      ])
  loop
    if not v_function.prosecdef
      or v_function.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', v_function.oid, 'execute')
      or has_function_privilege('anon', v_function.oid, 'execute') then
      raise exception 'unsafe public command wrapper: %.%',
        v_function.nspname, v_function.proname;
    end if;
  end loop;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'shop_private'
      and p.proname = any(array[
        'create_owner_shop', 'set_shop_business_mode', 'save_product',
        'archive_product', 'save_service', 'archive_service', 'adjust_stock',
        'save_expense', 'void_expense', 'assert_purchase_entitlement',
        'create_vendor', 'create_supplier_purchase', 'void_supplier_purchase'
      ])
      and (
        has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('anon', p.oid, 'execute')
      )
  ) then
    raise exception 'a private write implementation remains browser-callable';
  end if;

  if has_function_privilege(
      'authenticated',
      'public.issue_invoice_and_deduct_inventory(uuid,uuid)', 'execute'
    ) or has_function_privilege(
      'anon', 'public.issue_invoice_and_deduct_inventory(uuid,uuid)', 'execute'
    ) then
    raise exception 'legacy sale finalizer is browser-callable';
  end if;

  if exists (
    select 1
    from pg_constraint c
    where c.conname = any(array[
      'stock_adjustment_requests_product_shop_fk',
      'inventory_batches_product_shop_fk',
      'inventory_movements_product_shop_fk',
      'inventory_movements_batch_shop_product_fk',
      'expenses_category_shop_fk',
      'vendor_invoices_vendor_shop_fk'
    ]) and not c.convalidated
  ) or (
    select count(*)
    from pg_constraint c
    where c.conname = any(array[
      'stock_adjustment_requests_product_shop_fk',
      'inventory_batches_product_shop_fk',
      'inventory_movements_product_shop_fk',
      'inventory_movements_batch_shop_product_fk',
      'expenses_category_shop_fk',
      'vendor_invoices_vendor_shop_fk'
    ])
  ) <> 6 then
    raise exception 'same-shop structural constraints are missing or unvalidated';
  end if;

  if has_table_privilege('authenticated', 'public.products', 'insert')
    or has_table_privilege('authenticated', 'public.expenses', 'update')
    or has_table_privilege('authenticated', 'public.inventory_movements', 'insert')
    or has_table_privilege('authenticated', 'public.vendor_invoices', 'delete')
    or has_table_privilege('authenticated', 'public.shop_business_mode_changes', 'insert') then
    raise exception 'authenticated direct-write bypass remains';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_a_id::text, true)
from shop_safe_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid;
  v_product uuid;
  v_service uuid;
  v_vendor uuid;
  v_expense uuid;
  v_purchase uuid;
  v_stock_request uuid := gen_random_uuid();
  v_expense_request uuid := gen_random_uuid();
  v_purchase_request uuid := gen_random_uuid();
  v_items jsonb;
begin
  v_shop := public.create_owner_shop(
    'Safe fixture A', 'pro', 'mixed'::public.business_mode
  );
  v_product := public.save_product(
    v_shop, null, 'Safe product A', 'SAFE-A', null, 10
  );
  v_service := public.save_service(
    v_shop, null, 'Safe service A', null, 20, 'amount', 0
  );
  v_vendor := public.create_vendor(
    v_shop, 'Safe vendor A', null, null, null, null, null, null
  );
  perform public.adjust_stock(
    v_stock_request, v_shop, v_product, 2, 3, 'Opening stock'
  );
  perform public.adjust_stock(
    v_stock_request, v_shop, v_product, 2, 3, 'Opening stock'
  );
  v_expense := public.save_expense(
    v_shop, null, v_expense_request, 'Safe expense', 5, 'Operations',
    current_date, null
  );
  if public.save_expense(
      v_shop, null, v_expense_request, 'Safe expense', 5, 'Operations',
      current_date, null
    ) <> v_expense then
    raise exception 'expense retry returned a different record';
  end if;
  v_items := jsonb_build_array(jsonb_build_object(
    'product_id', v_product, 'quantity', 2, 'unit_cost', 4
  ));
  v_purchase := public.create_supplier_purchase(
    v_purchase_request, v_shop, v_vendor, 'SAFE-A-1', current_date,
    null, v_items
  );
  if public.create_supplier_purchase(
      v_purchase_request, v_shop, v_vendor, 'SAFE-A-1', current_date,
      null, v_items
    ) <> v_purchase then
    raise exception 'purchase retry returned a different document';
  end if;
  perform set_config('ss_safe.shop_a', v_shop::text, true);
  perform set_config('ss_safe.product_a', v_product::text, true);
  perform set_config('ss_safe.service_a', v_service::text, true);
  perform set_config('ss_safe.vendor_a', v_vendor::text, true);
  perform set_config('ss_safe.expense_a', v_expense::text, true);
  perform set_config('ss_safe.purchase_a', v_purchase::text, true);
  perform set_config('ss_safe.stock_request_a', v_stock_request::text, true);
  perform set_config('ss_safe.expense_request_a', v_expense_request::text, true);
  perform set_config('ss_safe.purchase_request_a', v_purchase_request::text, true);
end;
$$;
reset role;

do $$ begin
  if (select count(*) from public.stock_adjustment_requests
      where id = current_setting('ss_safe.stock_request_a')::uuid) <> 1
    or (select count(*) from public.expenses
        where shop_id = current_setting('ss_safe.shop_a')::uuid
          and request_id = current_setting('ss_safe.expense_request_a')::uuid) <> 1
    or (select count(*) from public.vendor_invoices
        where shop_id = current_setting('ss_safe.shop_a')::uuid
          and request_id = current_setting('ss_safe.purchase_request_a')::uuid) <> 1 then
    raise exception 'same-shop retry duplicated a business effect';
  end if;
end $$;

select set_config('request.jwt.claim.sub', owner_b_id::text, true)
from shop_safe_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid;
  v_product uuid;
  v_service uuid;
  v_vendor uuid;
  v_expense uuid;
  v_purchase uuid;
begin
  v_shop := public.create_owner_shop(
    'Safe fixture B', 'pro', 'mixed'::public.business_mode
  );
  v_product := public.save_product(
    v_shop, null, 'Safe product B', 'SAFE-B', null, 11
  );
  v_service := public.save_service(
    v_shop, null, 'Safe service B', null, 21, 'amount', 0
  );
  v_vendor := public.create_vendor(
    v_shop, 'Safe vendor B', null, null, null, null, null, null
  );
  v_expense := public.save_expense(
    v_shop, null, gen_random_uuid(), 'Safe expense B', 6, 'Operations',
    current_date, null
  );
  v_purchase := public.create_supplier_purchase(
    gen_random_uuid(), v_shop, v_vendor, 'SAFE-B-1', current_date, null,
    jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'quantity', 1, 'unit_cost', 2
    ))
  );
  perform set_config('ss_safe.shop_b', v_shop::text, true);
  perform set_config('ss_safe.product_b', v_product::text, true);
  perform set_config('ss_safe.service_b', v_service::text, true);
  perform set_config('ss_safe.vendor_b', v_vendor::text, true);
  perform set_config('ss_safe.expense_b', v_expense::text, true);
  perform set_config('ss_safe.purchase_b', v_purchase::text, true);
end;
$$;
reset role;

-- Every materially distinct tenant-owned reference fails before a side effect.
select set_config(
  'ss_safe.movement_count_before',
  (select count(*)::text from public.inventory_movements), true
);
select set_config('request.jwt.claim.sub', owner_a_id::text, true)
from shop_safe_fixture;
set local role authenticated;
do $$
declare
  v_request uuid;
  v_before integer;
begin
  begin
    perform public.save_product(
      current_setting('ss_safe.shop_a')::uuid,
      current_setting('ss_safe.product_b')::uuid,
      'Injected product', null, null, 1
    );
    raise exception 'cross-shop product update accepted';
  exception when others then
    if sqlerrm <> 'PRODUCT_NOT_FOUND' then raise; end if;
  end;
  begin
    perform public.archive_service(
      current_setting('ss_safe.shop_a')::uuid,
      current_setting('ss_safe.service_b')::uuid
    );
    raise exception 'cross-shop service archive accepted';
  exception when others then
    if sqlerrm <> 'SERVICE_NOT_FOUND' then raise; end if;
  end;

  v_request := gen_random_uuid();
  begin
    perform public.adjust_stock(
      v_request, current_setting('ss_safe.shop_a')::uuid,
      current_setting('ss_safe.product_b')::uuid, 1, 1, null
    );
    raise exception 'cross-shop stock product accepted';
  exception when others then
    if sqlerrm <> 'PRODUCT_NOT_FOUND' then raise; end if;
  end;
  perform set_config('ss_safe.failed_stock_request', v_request::text, true);

  select count(*) into v_before from public.vendor_invoices;
  begin
    perform public.create_supplier_purchase(
      gen_random_uuid(), current_setting('ss_safe.shop_a')::uuid,
      current_setting('ss_safe.vendor_b')::uuid, 'CROSS-VENDOR', current_date,
      null, jsonb_build_array(jsonb_build_object(
        'product_id', current_setting('ss_safe.product_a')::uuid,
        'quantity', 1, 'unit_cost', 1
      ))
    );
    raise exception 'cross-shop vendor accepted';
  exception when others then
    if sqlerrm <> 'VENDOR_NOT_FOUND' then raise; end if;
  end;
  begin
    perform public.create_supplier_purchase(
      gen_random_uuid(), current_setting('ss_safe.shop_a')::uuid,
      current_setting('ss_safe.vendor_a')::uuid, 'CROSS-PRODUCT', current_date,
      null, jsonb_build_array(jsonb_build_object(
        'product_id', current_setting('ss_safe.product_b')::uuid,
        'quantity', 1, 'unit_cost', 1
      ))
    );
    raise exception 'cross-shop purchase product accepted';
  exception when others then
    if sqlerrm <> 'PRODUCT_NOT_FOUND' then raise; end if;
  end;
  if (select count(*) from public.vendor_invoices) <> v_before then
    raise exception 'failed purchase injection left a partial document';
  end if;

  begin
    perform public.void_expense(
      current_setting('ss_safe.shop_a')::uuid,
      current_setting('ss_safe.expense_b')::uuid
    );
    raise exception 'cross-shop expense void accepted';
  exception when others then
    if sqlerrm <> 'EXPENSE_NOT_FOUND' then raise; end if;
  end;
  begin
    perform public.void_supplier_purchase(
      current_setting('ss_safe.shop_a')::uuid,
      current_setting('ss_safe.purchase_b')::uuid
    );
    raise exception 'cross-shop purchase void accepted';
  exception when others then
    if sqlerrm <> 'PURCHASE_NOT_FOUND' then raise; end if;
  end;
  begin
    perform public.set_shop_business_mode(
      current_setting('ss_safe.shop_b')::uuid, 'product'
    );
    raise exception 'cross-shop business mode change accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_OWNER_REQUIRED' then raise; end if;
  end;
end;
$$;
reset role;

do $$ begin
  if exists (
      select 1 from public.stock_adjustment_requests
      where id = current_setting('ss_safe.failed_stock_request')::uuid
    ) or (select count(*) from public.inventory_movements)
      <> current_setting('ss_safe.movement_count_before')::integer then
    raise exception 'failed stock injection left a partial effect';
  end if;
end $$;

-- An outsider and an unprivileged employee cannot mutate Shop A. Granting the
-- existing inventory.manage permission permits the employee, and suspension
-- takes effect immediately without issuing a new JWT.
select set_config('request.jwt.claim.sub', outsider_id::text, true)
from shop_safe_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.save_product(
      current_setting('ss_safe.shop_a')::uuid, null,
      'Outsider product', null, null, 1
    );
    raise exception 'outsider write accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end $$;
reset role;

do $$
declare
  v_profile uuid;
  v_permission uuid;
  v_role uuid;
  v_membership uuid;
begin
  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select employee_id, s.portal_id, 'Safe employee', 'employee@ss-safe.invalid'
  from shop_safe_fixture f
  join public.shops s on s.id = current_setting('ss_safe.shop_a')::uuid
  returning id into v_profile;
  insert into public.shop_memberships (shop_id, profile_id, role)
  values (current_setting('ss_safe.shop_a')::uuid, v_profile, 'employee')
  returning id into v_membership;
  insert into public.permissions (portal_id, key, description)
  select s.portal_id, 'inventory.manage', 'SS-SAFE-001 fixture'
  from public.shops s where s.id = current_setting('ss_safe.shop_a')::uuid
  on conflict (portal_id, key) do update set description = excluded.description
  returning id into v_permission;
  insert into public.roles (shop_id, name)
  values (current_setting('ss_safe.shop_a')::uuid, 'Safe inventory manager')
  returning id into v_role;
  insert into public.role_permissions (role_id, permission_id)
  values (v_role, v_permission);
  perform set_config('ss_safe.employee_membership', v_membership::text, true);
  perform set_config('ss_safe.employee_role', v_role::text, true);
end;
$$;

select set_config('request.jwt.claim.sub', employee_id::text, true)
from shop_safe_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.save_product(
      current_setting('ss_safe.shop_a')::uuid, null,
      'Unprivileged employee product', null, null, 1
    );
    raise exception 'unprivileged employee write accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end $$;
reset role;

insert into public.membership_roles (membership_id, role_id)
values (
  current_setting('ss_safe.employee_membership')::uuid,
  current_setting('ss_safe.employee_role')::uuid
);
select set_config('request.jwt.claim.sub', employee_id::text, true)
from shop_safe_fixture;
set local role authenticated;
do $$ begin
  perform public.save_product(
    current_setting('ss_safe.shop_a')::uuid, null,
    'Authorized employee product', 'SAFE-EMP', null, 1
  );
end $$;
reset role;

update public.shop_memberships set status = 'suspended'
where id = current_setting('ss_safe.employee_membership')::uuid;
select set_config('request.jwt.claim.sub', employee_id::text, true)
from shop_safe_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.save_product(
      current_setting('ss_safe.shop_a')::uuid, null,
      'Suspended employee product', null, null, 1
    );
    raise exception 'suspended employee write accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end $$;
reset role;
