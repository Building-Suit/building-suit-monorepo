-- SS-CATALOG-IMPORT-001 rollback fixture. The runner supplies BEGIN/ROLLBACK.
create temporary table shop_catalog_import_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() other_owner_id;

insert into auth.users (id, email, encrypted_password, aud, role, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at)
select id, id::text || '@ss-catalog-import.invalid', 'x', 'authenticated',
  'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from (select owner_id id from shop_catalog_import_fixture
  union all select other_owner_id from shop_catalog_import_fixture) users;

do $$
declare v_function record;
begin
  for v_function in select function_row.oid, function_row.proname,
      function_row.prosecdef, function_row.proconfig
    from pg_proc function_row join pg_namespace namespace on namespace.oid = function_row.pronamespace
    where namespace.nspname = 'public' and function_row.proname = any(array[
      'catalog_import', 'list_catalog_categories', 'save_catalog_category',
      'list_products', 'barcode_label_data', 'catalog_sales_report'])
  loop
    if not v_function.prosecdef
      or v_function.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', v_function.oid, 'execute')
      or has_function_privilege('anon', v_function.oid, 'execute') then
      raise exception 'unsafe catalog import wrapper: %', v_function.proname;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.catalog_import_requests', 'select')
    or has_table_privilege('authenticated', 'public.product_suppliers', 'select')
    or has_table_privilege('authenticated', 'public.catalog_categories', 'insert') then
    raise exception 'catalog import tables expose unsafe grants';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_catalog_import_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid; v_request uuid := gen_random_uuid(); v_invalid uuid := gen_random_uuid();
  v_result jsonb; v_product uuid; v_category uuid; v_vendor uuid;
begin
  v_shop := public.create_owner_shop('Catalog import owner', 'team', 'mixed'::public.business_mode);
  v_vendor := public.save_vendor(v_shop, null, 'Local Supplier', null, '0100', 's@example.invalid', null, null, null);

  v_result := public.catalog_import(v_invalid, v_shop, 'products', jsonb_build_array(
    jsonb_build_object('name', 'Bad row', 'sale_price', '-1', 'opening_stock', '3', 'opening_cost', 'x')
  ), true);
  if (v_result->>'valid')::boolean or jsonb_array_length(v_result->'errors') < 2 then
    raise exception 'dry-run did not report row-level validation errors: %', v_result; end if;
  if exists (select 1 from public.products where shop_id = v_shop and name = 'Bad row') then
    raise exception 'dry-run mutated products'; end if;

  v_result := public.catalog_import(v_request, v_shop, 'products', jsonb_build_array(
    jsonb_build_object('name', 'Arabic coffee', 'sku', 'COF-1', 'barcode', '622100000001',
      'sale_price', '25.50', 'opening_stock', '7.000', 'opening_cost', '11.25',
      'category', 'Coffee', 'supplier', 'Local Supplier'),
    jsonb_build_object('name', 'Hair gel', 'sku', 'GEL-1', 'sale_price', '40',
      'opening_stock', '0', 'opening_cost', '0', 'category', 'Care')
  ), true);
  if not (v_result->>'valid')::boolean or not (v_result->>'dryRun')::boolean then
    raise exception 'valid product dry-run failed: %', v_result; end if;
  v_result := public.catalog_import(v_request, v_shop, 'products', jsonb_build_array(
    jsonb_build_object('name', 'Arabic coffee', 'sku', 'COF-1', 'barcode', '622100000001',
      'sale_price', '25.50', 'opening_stock', '7.000', 'opening_cost', '11.25',
      'category', 'Coffee', 'supplier', 'Local Supplier'),
    jsonb_build_object('name', 'Hair gel', 'sku', 'GEL-1', 'sale_price', '40',
      'opening_stock', '0', 'opening_cost', '0', 'category', 'Care')
  ), false);
  if (v_result->>'created')::integer <> 2 or (v_result->>'openingStockPosted')::integer <> 1 then
    raise exception 'product apply summary wrong: %', v_result; end if;
  select id, category_id into v_product, v_category from public.products where shop_id = v_shop and sku = 'COF-1';
  if (select quantity_on_hand from public.product_stock where product_id = v_product) <> 7
    or (select count(*) from public.inventory_movements where product_id = v_product) <> 1
    or not exists (select 1 from public.catalog_categories where id = v_category and shop_id = v_shop and name = 'Coffee') then
    raise exception 'opening stock/category did not reconcile'; end if;

  -- An identical replay returns the stored result and cannot add a second FIFO layer.
  perform public.catalog_import(v_request, v_shop, 'products', jsonb_build_array(
    jsonb_build_object('name', 'Arabic coffee', 'sku', 'COF-1', 'barcode', '622100000001',
      'sale_price', '25.50', 'opening_stock', '7.000', 'opening_cost', '11.25',
      'category', 'Coffee', 'supplier', 'Local Supplier'),
    jsonb_build_object('name', 'Hair gel', 'sku', 'GEL-1', 'sale_price', '40',
      'opening_stock', '0', 'opening_cost', '0', 'category', 'Care')
  ), false);
  if (select count(*) from public.inventory_movements where product_id = v_product) <> 1 then
    raise exception 'import replay duplicated stock'; end if;
  begin
    perform public.catalog_import(v_request, v_shop, 'products',
      jsonb_build_array(jsonb_build_object('name', 'Changed', 'sale_price', '1')), false);
    raise exception 'conflicting request accepted';
  exception when unique_violation then
    if sqlerrm <> 'IMPORT_REQUEST_CONFLICT' then raise; end if;
  end;

  perform public.catalog_import(gen_random_uuid(), v_shop, 'customers', jsonb_build_array(
    jsonb_build_object('name', 'First customer name', 'phone', '0111', 'email', 'Customer@Example.invalid')
  ), false);
  perform public.catalog_import(gen_random_uuid(), v_shop, 'customers', jsonb_build_array(
    jsonb_build_object('name', 'Updated customer name', 'phone', '0111', 'email', 'customer@example.invalid')
  ), false);
  if (select count(*) from public.clients where shop_id = v_shop and lower(email) = 'customer@example.invalid') <> 1
    or not exists (select 1 from public.clients where shop_id = v_shop and name = 'Updated customer name') then
    raise exception 'customer shop-scoped deduplication failed'; end if;
  perform public.catalog_import(gen_random_uuid(), v_shop, 'suppliers', jsonb_build_array(
    jsonb_build_object('name', 'Supplier renamed', 'phone', '0100', 'email', 's@example.invalid')
  ), false);
  if (select count(*) from public.vendors where shop_id = v_shop and email = 's@example.invalid') <> 1
    or not exists (select 1 from public.vendors where id = v_vendor and name = 'Supplier renamed') then
    raise exception 'supplier shop-scoped deduplication failed'; end if;

  begin
    perform public.catalog_import(gen_random_uuid(), v_shop, 'customers',
      (select jsonb_agg(jsonb_build_object('name', 'Customer ' || number)) from generate_series(1, 1001) number), true);
    raise exception 'oversized import accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'INVALID_IMPORT' then raise; end if;
  end;
  perform set_config('ss_catalog.shop', v_shop::text, true);
  perform set_config('ss_catalog.product', v_product::text, true);
  perform set_config('ss_catalog.category', v_category::text, true);
  perform set_config('ss_catalog.vendor', v_vendor::text, true);
end;
$$;
reset role;

do $$
begin
  if not exists (select 1 from public.product_suppliers
    where shop_id = current_setting('ss_catalog.shop')::uuid
      and product_id = current_setting('ss_catalog.product')::uuid
      and vendor_id = current_setting('ss_catalog.vendor')::uuid) then
    raise exception 'supplier mapping did not reconcile';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', other_owner_id::text, true) from shop_catalog_import_fixture;
set local role authenticated;
do $$
declare v_other uuid; v_result jsonb;
begin
  v_other := public.create_owner_shop('Other catalog owner', 'team', 'product'::public.business_mode);
  perform public.catalog_import(gen_random_uuid(), v_other, 'customers', jsonb_build_array(
    jsonb_build_object('name', 'Other tenant customer', 'phone', '0111', 'email', 'customer@example.invalid')
  ), false);
  if not exists (select 1 from public.clients where shop_id = v_other
    and email = 'customer@example.invalid' and name = 'Other tenant customer') then
    raise exception 'other tenant contact was not created'; end if;
  perform set_config('ss_catalog.other_shop', v_other::text, true);
  begin
    perform public.save_product_with_category(v_other, null, 'Cross category', 'OTHER-1', null, 1,
      current_setting('ss_catalog.category')::uuid);
    raise exception 'cross-shop category accepted';
  exception when others then
    if sqlerrm <> 'CATEGORY_NOT_FOUND' then raise; end if;
  end;
end;
$$;
reset role;

do $$
begin
  if (select count(*) from public.clients
      where email = 'customer@example.invalid'
        and shop_id in (current_setting('ss_catalog.shop')::uuid,
          current_setting('ss_catalog.other_shop')::uuid)) <> 2 then
    raise exception 'contact identity was treated as globally unique'; end if;
end;
$$;
