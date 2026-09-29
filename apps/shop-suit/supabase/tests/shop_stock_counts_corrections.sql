-- Focused SS-STOCK-002 rollback fixture. The runner supplies BEGIN/ROLLBACK.
create temporary table shop_stock_lifecycle_fixture as
select gen_random_uuid() as owner_id, gen_random_uuid() as staff_id,
  gen_random_uuid() as outsider_id, gen_random_uuid() as other_owner_id;

insert into auth.users (
  id, email, encrypted_password, aud, role, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@ss-stock-002.invalid', 'x', 'authenticated',
  'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id as id from shop_stock_lifecycle_fixture
  union all select staff_id from shop_stock_lifecycle_fixture
  union all select outsider_id from shop_stock_lifecycle_fixture
  union all select other_owner_id from shop_stock_lifecycle_fixture
) users;

do $$
declare v_function record;
begin
  for v_function in
    select function_row.oid, function_row.proname, function_row.prosecdef,
      function_row.proconfig
    from pg_proc function_row
    join pg_namespace namespace on namespace.oid = function_row.pronamespace
    where namespace.nspname = 'public' and function_row.proname = any(array[
      'inventory_access', 'set_reorder_threshold', 'record_stock_count',
      'list_inventory', 'list_inventory_history', 'list_stock_counts'
    ])
  loop
    if not v_function.prosecdef
      or v_function.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', v_function.oid, 'execute')
      or has_function_privilege('anon', v_function.oid, 'execute') then
      raise exception 'unsafe stock lifecycle wrapper: %', v_function.proname;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.stock_counts', 'select')
    or has_table_privilege('authenticated', 'public.stock_counts', 'insert')
    or has_table_privilege('authenticated',
      'public.inventory_threshold_changes', 'select')
    or has_table_privilege('authenticated', 'public.inventory_batches', 'update')
    or has_table_privilege('authenticated', 'public.inventory_movements', 'insert')
    or has_table_privilege('anon', 'public.low_stock_products', 'select')
    or not has_table_privilege('authenticated',
      'public.low_stock_products', 'select') then
    raise exception 'stock lifecycle grants are unsafe';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_stock_lifecycle_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid; v_product uuid; v_first_count uuid := gen_random_uuid();
  v_positive_count uuid := gen_random_uuid(); v_zero_count uuid := gen_random_uuid();
  v_counted_at timestamptz := clock_timestamp();
begin
  v_shop := public.create_owner_shop(
    'Stock lifecycle owner', 'team', 'product'::public.business_mode
  );
  v_product := public.save_product(
    v_shop, null, 'Counted product', 'COUNT-001', null, 25
  );
  perform public.adjust_stock(
    gen_random_uuid(), v_shop, v_product, 5, 10, 'Opening FIFO layer one'
  );
  perform public.adjust_stock(
    gen_random_uuid(), v_shop, v_product, 4, 12, 'Opening FIFO layer two'
  );
  perform public.set_reorder_threshold(v_shop, v_product, 8);

  if public.record_stock_count(
      v_first_count, v_shop, v_product, 6, v_counted_at,
      'Shelf count shortage', 'COUNT-SHORT-001', null
    ) <> v_first_count
    or public.record_stock_count(
      v_first_count, v_shop, v_product, 6, v_counted_at,
      'Shelf count shortage', 'COUNT-SHORT-001', null
    ) <> v_first_count then
    raise exception 'identical count retry changed request identity';
  end if;
  begin
    perform public.record_stock_count(
      v_first_count, v_shop, v_product, 5, v_counted_at,
      'Conflicting count payload', 'COUNT-CONFLICT', null
    );
    raise exception 'conflicting count request accepted';
  exception when unique_violation then
    if sqlerrm <> 'STOCK_COUNT_REQUEST_CONFLICT' then raise; end if;
  end;
  perform set_config('ss_stock.shop', v_shop::text, true);
  perform set_config('ss_stock.product', v_product::text, true);
  perform set_config('ss_stock.first_count', v_first_count::text, true);
  perform set_config('ss_stock.counted_at', v_counted_at::text, true);
  perform set_config('ss_stock.positive_count', v_positive_count::text, true);
  perform set_config('ss_stock.zero_count', v_zero_count::text, true);
end;
$$;
reset role;

-- Continue the lifecycle in a separate caller phase.
select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_stock_lifecycle_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('ss_stock.shop')::uuid;
  v_product uuid := current_setting('ss_stock.product')::uuid;
  v_first_count uuid := current_setting('ss_stock.first_count')::uuid;
  v_positive_count uuid := current_setting('ss_stock.positive_count')::uuid;
  v_zero_count uuid := current_setting('ss_stock.zero_count')::uuid;
  v_counted_at timestamptz := current_setting('ss_stock.counted_at')::timestamptz;
  v_inventory jsonb; v_history jsonb; v_counts jsonb;
begin
  if public.record_stock_count(
      v_first_count, v_shop, v_product, 6, v_counted_at,
      'Shelf count shortage', 'COUNT-SHORT-001', null
    ) <> v_first_count then
    raise exception 'identical stock count retry failed';
  end if;
  v_counts := public.list_stock_counts(v_shop, v_product, 1, 100);
  if (v_counts ->> 'total')::integer <> 1
    or (v_counts -> 'items' -> 0 ->> 'expected_quantity')::numeric <> 9
    or (v_counts -> 'items' -> 0 ->> 'variance_quantity')::numeric <> -3
    or (select quantity_on_hand from public.product_stock
      where product_id = v_product) <> 6
    or (select inventory_value from public.product_stock
      where product_id = v_product) <> 68 then
    raise exception 'short count did not reconcile FIFO layers exactly';
  end if;

  perform public.record_stock_count(
    v_positive_count, v_shop, v_product, 8, clock_timestamp(),
    'Found sealed units', 'COUNT-OVER-001', 11
  );
  perform public.record_stock_count(
    v_zero_count, v_shop, v_product, 8, now(),
    'Routine verification', 'COUNT-ZERO-001', null
  );
  if (select quantity_on_hand from public.product_stock
      where product_id = v_product) <> 8
    or (select inventory_value from public.product_stock
      where product_id = v_product) <> 90
    or (select count(*) from public.inventory_movements
      where reference_id = v_zero_count) <> 0 then
    raise exception 'positive/zero count lifecycle is inconsistent';
  end if;
  if (select inventory_value from public.product_stock where product_id = v_product)
    <> (select sum(remaining_quantity * unit_cost)
      from public.inventory_batches where product_id = v_product) then
    raise exception 'inventory valuation does not equal remaining FIFO layers';
  end if;
  if not exists (select 1 from public.low_stock_products
      where product_id = v_product and quantity_on_hand = reorder_threshold) then
    raise exception 'actionable low-stock view is wrong';
  end if;

  v_inventory := public.list_inventory(v_shop, true);
  v_history := public.list_inventory_history(v_shop, v_product, 1, 100);
  v_counts := public.list_stock_counts(v_shop, v_product, 1, 100);
  if (v_inventory ->> 'low_stock_count')::integer <> 1
    or jsonb_array_length(v_inventory -> 'items') <> 1
    or (v_inventory ->> 'total_valuation')::numeric <> 90
    or (v_history ->> 'total')::integer <> 4
    or not exists (
      select 1 from jsonb_array_elements(v_history -> 'items') event
      where event ->> 'source_type' = 'physical_count'
        and event ->> 'reference' = 'COUNT-SHORT-001'
        and event ->> 'reason' = 'Shelf count shortage'
        and event ->> 'actor_profile_id' is not null
    )
    or (v_counts ->> 'total')::integer <> 3
    or not exists (
      select 1 from jsonb_array_elements(v_counts -> 'items') event
      where event ->> 'reference' = 'COUNT-ZERO-001'
        and (event ->> 'variance_quantity')::numeric = 0
    ) then
    raise exception 'inventory/count history read contract is incomplete: %, %, %',
      v_inventory, v_history, v_counts;
  end if;

  begin
    perform public.record_stock_count(
      gen_random_uuid(), v_shop, v_product, -1, now(),
      'Invalid negative count', 'COUNT-NEGATIVE', null
    );
    raise exception 'negative physical count accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'INVALID_STOCK_COUNT' then raise; end if;
  end;
  begin
    perform public.record_stock_count(
      gen_random_uuid(), v_shop, v_product, 9, now(),
      'Missing variance cost', 'COUNT-NO-COST', null
    );
    raise exception 'positive variance without cost accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'POSITIVE_VARIANCE_COST_REQUIRED' then raise; end if;
  end;

  perform public.archive_product(v_shop, v_product);
  v_inventory := public.list_inventory(v_shop, false);
  if not exists (
    select 1 from jsonb_array_elements(v_inventory -> 'items') item
    where item ->> 'product_id' = v_product::text
      and not (item ->> 'is_active')::boolean
      and (item ->> 'quantity_on_hand')::numeric = 8
      and (item ->> 'inventory_value')::numeric = 90
  ) or exists (select 1 from public.low_stock_products where product_id = v_product) then
    raise exception 'archived stock visibility/actionability is wrong: %', v_inventory;
  end if;
end;
$$;
reset role;

do $$
begin
  if (select count(*) from public.inventory_threshold_changes
      where product_id = current_setting('ss_stock.product')::uuid
        and previous_threshold = 0 and new_threshold = 8) <> 1 then
    raise exception 'threshold audit history is missing';
  end if;
  begin
    update public.stock_counts set reason = 'Rewritten count'
    where id = current_setting('ss_stock.first_count')::uuid;
    raise exception 'stock count audit history was mutable';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'STOCK_AUDIT_HISTORY_IMMUTABLE' then raise; end if;
  end;
  begin
    delete from public.inventory_threshold_changes
    where product_id = current_setting('ss_stock.product')::uuid;
    raise exception 'threshold audit history was mutable';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'STOCK_AUDIT_HISTORY_IMMUTABLE' then raise; end if;
  end;
end;
$$;

-- Attach an explicitly authorized staff membership to the same shop.
do $$
declare
  v_shop uuid := current_setting('ss_stock.shop')::uuid;
  v_staff uuid := (select staff_id from shop_stock_lifecycle_fixture);
  v_profile uuid := gen_random_uuid(); v_membership uuid := gen_random_uuid();
  v_role uuid := gen_random_uuid(); v_portal uuid;
begin
  select portal_id into v_portal from public.shops where id = v_shop;
  insert into public.permissions (portal_id, key, description)
  select v_portal, permission.key, permission.description
  from (values
    ('inventory.view', 'View inventory'),
    ('inventory.manage', 'Manage inventory'),
    ('inventory.adjust', 'Record stock corrections')
  ) as permission(key, description)
  on conflict (portal_id, key) do nothing;
  insert into public.profiles (id, user_id, portal_id, display_name, email_snapshot)
  values (v_profile, v_staff, v_portal, 'Stock counter', 'staff@ss-stock.invalid');
  insert into public.shop_memberships (id, shop_id, profile_id, role)
  values (v_membership, v_shop, v_profile, 'employee');
  insert into public.roles (id, shop_id, name) values (v_role, v_shop, 'Stock counter');
  insert into public.membership_roles (membership_id, role_id)
  values (v_membership, v_role);
  insert into public.role_permissions (role_id, permission_id)
  select v_role, permission.id from public.permissions permission
  where permission.portal_id = v_portal
    and permission.key in ('inventory.view', 'inventory.manage', 'inventory.adjust');
  perform set_config('ss_stock.staff_membership', v_membership::text, true);
end;
$$;

select set_config('request.jwt.claim.sub', staff_id::text, true)
from shop_stock_lifecycle_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('ss_stock.shop')::uuid;
  v_product uuid := current_setting('ss_stock.product')::uuid;
  v_inventory jsonb;
begin
  if not (select can_view and can_manage and inventory_enabled
    from public.inventory_access(v_shop)) then
    raise exception 'authorized stock staff access is incomplete';
  end if;
  perform public.record_stock_count(
    gen_random_uuid(), v_shop, v_product, 7, now(),
    'Archived item recount', 'COUNT-ARCHIVED-001', null
  );
  v_inventory := public.list_inventory(v_shop, false);
  if not exists (
    select 1 from jsonb_array_elements(v_inventory -> 'items') item
    where item ->> 'product_id' = v_product::text
      and (item ->> 'quantity_on_hand')::numeric = 7
      and (item ->> 'inventory_value')::numeric = 80
  ) then raise exception 'staff count or archived valuation failed: %', v_inventory; end if;
end;
$$;
reset role;

update public.shop_memberships set status = 'suspended'
where id = current_setting('ss_stock.staff_membership')::uuid;
select set_config('request.jwt.claim.sub', staff_id::text, true)
from shop_stock_lifecycle_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.record_stock_count(
      gen_random_uuid(), current_setting('ss_stock.shop')::uuid,
      current_setting('ss_stock.product')::uuid, 7, now(),
      'Suspended attempt', 'COUNT-SUSPENDED', null
    );
    raise exception 'suspended member counted stock';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', other_owner_id::text, true)
from shop_stock_lifecycle_fixture;
set local role authenticated;
do $$
declare v_other_shop uuid; v_other_product uuid;
begin
  v_other_shop := public.create_owner_shop(
    'Other stock tenant', 'team', 'product'::public.business_mode
  );
  v_other_product := public.save_product(
    v_other_shop, null, 'Other product', null, null, 1
  );
  begin
    perform public.record_stock_count(
      gen_random_uuid(), v_other_shop,
      current_setting('ss_stock.product')::uuid, 0, now(),
      'Cross shop attempt', 'COUNT-CROSS-SHOP', null
    );
    raise exception 'cross-shop product count accepted';
  exception when raise_exception then
    if sqlerrm <> 'PRODUCT_NOT_FOUND' then raise; end if;
  end;
  perform set_config('ss_stock.other_shop', v_other_shop::text, true);
  perform set_config('ss_stock.other_product', v_other_product::text, true);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', outsider_id::text, true)
from shop_stock_lifecycle_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.list_inventory(current_setting('ss_stock.shop')::uuid, false);
    raise exception 'outsider read inventory';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
  begin
    perform public.record_stock_count(
      gen_random_uuid(), current_setting('ss_stock.shop')::uuid,
      current_setting('ss_stock.product')::uuid, 7, now(),
      'Outsider attempt', 'COUNT-OUTSIDER', null
    );
    raise exception 'outsider counted inventory';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end $$;
reset role;
