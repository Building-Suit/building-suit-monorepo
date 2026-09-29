-- SS-CATALOG-IMPORT-001: tenant categories, bounded atomic onboarding imports,
-- and paginated barcode-label data. Imports never write stock directly: every
-- opening balance is posted through the existing idempotent FIFO command.

create table public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 80),
  is_active boolean not null default true,
  created_by_profile_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, shop_id)
);
create unique index catalog_categories_shop_name_active_idx
  on public.catalog_categories (shop_id, lower(name)) where is_active;
create index catalog_categories_shop_active_idx
  on public.catalog_categories (shop_id, is_active, lower(name), id);

alter table public.products add column category_id uuid;
alter table public.products add constraint products_category_shop_fk
  foreign key (category_id, shop_id)
  references public.catalog_categories (id, shop_id) on delete restrict;
alter table public.services add column category_id uuid;
alter table public.services add constraint services_category_shop_fk
  foreign key (category_id, shop_id)
  references public.catalog_categories (id, shop_id) on delete restrict;
create index products_shop_category_idx on public.products (shop_id, category_id, is_active);
create index services_shop_category_idx on public.services (shop_id, category_id, is_active);

-- Barcode lookup is exact in the POS, so active identifiers must be
-- unambiguous within a shop. Existing conflicting data deliberately blocks the
-- migration instead of being rewritten or archived silently.
create unique index products_shop_active_barcode_unique
  on public.products (shop_id, lower(barcode))
  where is_active and barcode is not null;

create table public.product_suppliers (
  shop_id uuid not null,
  product_id uuid not null,
  vendor_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (product_id, vendor_id),
  foreign key (product_id, shop_id)
    references public.products (id, shop_id) on delete cascade,
  foreign key (vendor_id, shop_id)
    references public.vendors (id, shop_id) on delete restrict
);

create table public.catalog_import_requests (
  request_id uuid primary key,
  shop_id uuid not null references public.shops (id) on delete restrict,
  import_kind text not null check (import_kind in ('products', 'customers', 'suppliers')),
  payload_hash text not null,
  result jsonb not null,
  created_by_profile_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.catalog_categories enable row level security;
alter table public.product_suppliers enable row level security;
alter table public.catalog_import_requests enable row level security;
create policy catalog_categories_read on public.catalog_categories for select
  to authenticated using (
    shop_private.has_permission(shop_id, 'products.view')
    or shop_private.has_permission(shop_id, 'services.view')
  );
revoke all on public.catalog_categories, public.product_suppliers,
  public.catalog_import_requests from public, anon, authenticated;
grant select on public.catalog_categories to authenticated;
grant all on public.catalog_categories, public.product_suppliers,
  public.catalog_import_requests to service_role;

create function shop_private.resolve_catalog_category(
  p_shop_id uuid, p_name text, p_profile_id uuid, p_create boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_name text := nullif(btrim(p_name), ''); v_id uuid;
begin
  if v_name is null then return null; end if;
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'INVALID_CATEGORY' using errcode = '22023';
  end if;
  select category.id into v_id from public.catalog_categories category
  where category.shop_id = p_shop_id and category.is_active
    and lower(category.name) = lower(v_name);
  if v_id is null and p_create then
    insert into public.catalog_categories (shop_id, name, created_by_profile_id)
    values (p_shop_id, v_name, p_profile_id)
    on conflict (shop_id, lower(name)) where is_active do update
      set updated_at = public.catalog_categories.updated_at
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create function shop_private.list_catalog_categories(p_shop_id uuid)
returns table (id uuid, name text) language plpgsql stable security definer set search_path = '' as $$
begin
  if not (shop_private.has_permission(p_shop_id, 'products.view')
    or shop_private.has_permission(p_shop_id, 'services.view')) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  return query select category.id, category.name
    from public.catalog_categories category
    where category.shop_id = p_shop_id and category.is_active
    order by lower(category.name), category.id;
end;
$$;

create function public.list_catalog_categories(p_shop_id uuid)
returns table (id uuid, name text) language sql stable security definer set search_path = '' as $$
  select * from shop_private.list_catalog_categories(p_shop_id);
$$;

create function shop_private.save_catalog_category(
  p_shop_id uuid, p_category_id uuid, p_name text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile uuid; v_id uuid; v_name text := btrim(p_name);
begin
  if shop_private.has_permission(p_shop_id, 'products.manage') then
    v_profile := shop_private.assert_shop_write_access(p_shop_id, 'products.manage');
  else
    v_profile := shop_private.assert_shop_write_access(p_shop_id, 'services.manage');
  end if;
  if v_name is null or length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'INVALID_CATEGORY' using errcode = '22023';
  end if;
  if p_category_id is null then
    v_id := shop_private.resolve_catalog_category(p_shop_id, v_name, v_profile, true);
  else
    update public.catalog_categories set name = v_name, updated_at = now()
    where id = p_category_id and shop_id = p_shop_id and is_active returning id into v_id;
    if v_id is null then raise exception 'CATEGORY_NOT_FOUND'; end if;
  end if;
  return v_id;
end;
$$;

create function public.save_catalog_category(p_shop_id uuid, p_category_id uuid, p_name text)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.save_catalog_category(p_shop_id, p_category_id, p_name);
$$;

create function shop_private.set_catalog_item_category(
  p_shop_id uuid, p_item_type text, p_item_id uuid, p_category_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_item_type = 'product' then
    perform shop_private.assert_shop_write_access(p_shop_id, 'products.manage');
  elsif p_item_type = 'service' then
    perform shop_private.assert_shop_write_access(p_shop_id, 'services.manage');
  else raise exception 'INVALID_CATALOG_ITEM' using errcode = '22023'; end if;
  if p_category_id is not null and not exists (select 1 from public.catalog_categories
    where id = p_category_id and shop_id = p_shop_id and is_active) then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;
  if p_item_type = 'product' then
    update public.products set category_id = p_category_id, updated_at = now()
      where id = p_item_id and shop_id = p_shop_id and is_active;
  else
    update public.services set category_id = p_category_id, updated_at = now()
      where id = p_item_id and shop_id = p_shop_id and is_active;
  end if;
  if not found then raise exception 'CATALOG_ITEM_NOT_FOUND'; end if;
end;
$$;

create function public.set_catalog_item_category(
  p_shop_id uuid, p_item_type text, p_item_id uuid, p_category_id uuid
) returns void language sql security definer set search_path = '' as $$
  select shop_private.set_catalog_item_category(p_shop_id, p_item_type, p_item_id, p_category_id);
$$;

create function shop_private.save_product_with_category(
  p_shop_id uuid, p_product_id uuid, p_name text, p_sku text, p_barcode text,
  p_sale_price numeric, p_category_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_category_id is not null and not exists (select 1 from public.catalog_categories
    where id = p_category_id and shop_id = p_shop_id and is_active) then raise exception 'CATEGORY_NOT_FOUND'; end if;
  v_id := shop_private.save_product(p_shop_id, p_product_id, p_name, p_sku, p_barcode, p_sale_price);
  update public.products set category_id = p_category_id where id = v_id and shop_id = p_shop_id;
  return v_id;
end;
$$;
create function public.save_product_with_category(
  p_shop_id uuid, p_product_id uuid, p_name text, p_sku text, p_barcode text,
  p_sale_price numeric, p_category_id uuid
) returns uuid language sql security definer set search_path = '' as $$
  select shop_private.save_product_with_category(p_shop_id, p_product_id, p_name,
    p_sku, p_barcode, p_sale_price, p_category_id);
$$;

create function shop_private.save_service_with_category(
  p_shop_id uuid, p_service_id uuid, p_name text, p_description text,
  p_base_sale_price numeric, p_discount_type text, p_discount_value numeric,
  p_scheduling_enabled boolean, p_duration_minutes integer, p_cleanup_minutes integer,
  p_location_ids uuid[], p_staff_membership_ids uuid[], p_category_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_category_id is not null and not exists (select 1 from public.catalog_categories
    where id = p_category_id and shop_id = p_shop_id and is_active) then raise exception 'CATEGORY_NOT_FOUND'; end if;
  v_id := shop_private.save_scheduled_service(p_shop_id, p_service_id, p_name,
    p_description, p_base_sale_price, p_discount_type, p_discount_value,
    p_scheduling_enabled, p_duration_minutes, p_cleanup_minutes, p_location_ids, p_staff_membership_ids);
  update public.services set category_id = p_category_id where id = v_id and shop_id = p_shop_id;
  return v_id;
end;
$$;
create function public.save_service_with_category(
  p_shop_id uuid, p_service_id uuid, p_name text, p_description text,
  p_base_sale_price numeric, p_discount_type text, p_discount_value numeric,
  p_scheduling_enabled boolean, p_duration_minutes integer, p_cleanup_minutes integer,
  p_location_ids uuid[], p_staff_membership_ids uuid[], p_category_id uuid
) returns uuid language sql security definer set search_path = '' as $$
  select shop_private.save_service_with_category(p_shop_id, p_service_id, p_name,
    p_description, p_base_sale_price, p_discount_type, p_discount_value,
    p_scheduling_enabled, p_duration_minutes, p_cleanup_minutes,
    p_location_ids, p_staff_membership_ids, p_category_id);
$$;

create function shop_private.list_products(
  p_shop_id uuid, p_search text default null, p_category_id uuid default null,
  p_page integer default 1, p_page_size integer default 20
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_search text := nullif(btrim(p_search), ''); v_items jsonb; v_total bigint;
begin
  if not shop_private.has_permission(p_shop_id, 'products.view') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501'; end if;
  if p_page < 1 or p_page_size < 1 or p_page_size > 100
    or length(coalesce(v_search, '')) > 160 then
    raise exception 'INVALID_PRODUCT_QUERY' using errcode = '22023'; end if;
  if p_category_id is not null and not exists (select 1 from public.catalog_categories
    where id = p_category_id and shop_id = p_shop_id and is_active) then
    raise exception 'CATEGORY_NOT_FOUND'; end if;
  select count(*) into v_total from public.products product
  left join public.catalog_categories category on category.id = product.category_id
  where product.shop_id = p_shop_id and product.is_active
    and (p_category_id is null or product.category_id = p_category_id)
    and (v_search is null or product.name ilike '%' || v_search || '%'
      or coalesce(product.sku, '') ilike '%' || v_search || '%'
      or coalesce(product.barcode, '') ilike '%' || v_search || '%'
      or coalesce(category.name, '') ilike '%' || v_search || '%');
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.name, rows.id), '[]'::jsonb)
  into v_items from (select product.id, product.name, product.sku, product.barcode,
      product.sale_price, product.category_id, category.name category_name, product.created_at
    from public.products product left join public.catalog_categories category on category.id = product.category_id
    where product.shop_id = p_shop_id and product.is_active
      and (p_category_id is null or product.category_id = p_category_id)
      and (v_search is null or product.name ilike '%' || v_search || '%'
        or coalesce(product.sku, '') ilike '%' || v_search || '%'
        or coalesce(product.barcode, '') ilike '%' || v_search || '%'
        or coalesce(category.name, '') ilike '%' || v_search || '%')
    order by lower(product.name), product.id offset (p_page - 1) * p_page_size limit p_page_size) rows;
  return jsonb_build_object('items', v_items, 'total', v_total, 'page', p_page, 'pageSize', p_page_size);
end;
$$;

create function public.list_products(p_shop_id uuid, p_search text default null,
  p_category_id uuid default null, p_page integer default 1, p_page_size integer default 20)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.list_products(p_shop_id, p_search, p_category_id, p_page, p_page_size);
$$;

create function shop_private.barcode_label_data(
  p_shop_id uuid, p_search text default null, p_category_id uuid default null,
  p_page integer default 1, p_page_size integer default 200
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_page jsonb;
begin
  if p_page_size > 500 then raise exception 'INVALID_PAGINATION' using errcode = '22023'; end if;
  v_page := shop_private.list_products(p_shop_id, p_search, p_category_id, p_page, p_page_size);
  return jsonb_set(v_page, '{items}', coalesce((select jsonb_agg(jsonb_build_object(
    'productId', item->>'id', 'name', item->>'name', 'sku', item->>'sku',
    'barcode', item->>'barcode', 'salePrice', (item->>'sale_price')::numeric,
    'category', item->>'category_name') order by item->>'name', item->>'id')
    from jsonb_array_elements(v_page->'items') item where nullif(item->>'barcode', '') is not null), '[]'::jsonb));
end;
$$;

create function public.barcode_label_data(p_shop_id uuid, p_search text default null,
  p_category_id uuid default null, p_page integer default 1, p_page_size integer default 200)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.barcode_label_data(p_shop_id, p_search, p_category_id, p_page, p_page_size);
$$;

create function shop_private.catalog_import(
  p_request_id uuid, p_shop_id uuid, p_kind text, p_rows jsonb, p_dry_run boolean default true
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_profile uuid; v_row jsonb; v_ordinal bigint; v_errors jsonb := '[]'::jsonb;
  v_result jsonb; v_hash text; v_existing public.catalog_import_requests%rowtype;
  v_name text; v_email text; v_phone text; v_sku text; v_barcode text;
  v_category text; v_supplier text; v_price numeric; v_stock numeric; v_cost numeric;
  v_product_id uuid; v_category_id uuid; v_vendor_id uuid; v_match_a uuid; v_match_b uuid;
  v_count_a integer; v_count_b integer;
  v_created integer := 0; v_updated integer := 0; v_stocked integer := 0; v_limit integer;
begin
  if p_request_id is null or p_kind not in ('products', 'customers', 'suppliers')
    or p_rows is null or jsonb_typeof(p_rows) <> 'array'
    or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 1000 then
    raise exception 'INVALID_IMPORT' using errcode = '22023';
  end if;
  if p_kind = 'products' then
    v_profile := shop_private.assert_shop_write_access(p_shop_id, 'products.manage');
  elsif p_kind = 'customers' then
    v_profile := shop_private.assert_shop_write_access(p_shop_id, 'clients.manage');
  else
    v_profile := shop_private.assert_shop_write_access(p_shop_id, 'vendors.manage');
    perform shop_private.assert_purchase_entitlement(p_shop_id);
  end if;
  v_hash := md5(p_kind || ':' || p_rows::text);
  if not p_dry_run then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
    select * into v_existing from public.catalog_import_requests where request_id = p_request_id;
    if found then
      if v_existing.shop_id = p_shop_id and v_existing.import_kind = p_kind
        and v_existing.payload_hash = v_hash then return v_existing.result; end if;
      raise exception 'IMPORT_REQUEST_CONFLICT' using errcode = '23505';
    end if;
  end if;

  for v_row, v_ordinal in select value, ordinality from jsonb_array_elements(p_rows) with ordinality loop
    v_name := nullif(btrim(v_row->>'name'), '');
    v_email := nullif(lower(btrim(v_row->>'email')), '');
    v_phone := nullif(btrim(v_row->>'phone'), '');
    if v_name is null or length(v_name) < 2 or length(v_name) > 160 then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'name', 'code', 'INVALID_NAME'));
    end if;
    if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+$') then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'email', 'code', 'INVALID_EMAIL'));
    end if;
    if p_kind = 'products' then
      v_sku := nullif(btrim(v_row->>'sku'), ''); v_barcode := nullif(btrim(v_row->>'barcode'), '');
      v_category := nullif(btrim(v_row->>'category'), ''); v_supplier := nullif(btrim(v_row->>'supplier'), '');
      if length(coalesce(v_sku, '')) > 80 or length(coalesce(v_barcode, '')) > 80 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'sku/barcode', 'code', 'IDENTIFIER_TOO_LONG'));
      end if;
      begin v_price := (v_row->>'sale_price')::numeric; exception when others then v_price := null; end;
      begin v_stock := coalesce(nullif(v_row->>'opening_stock', '')::numeric, 0); exception when others then v_stock := null; end;
      begin v_cost := coalesce(nullif(v_row->>'opening_cost', '')::numeric, 0); exception when others then v_cost := null; end;
      if v_price is null or v_price < 0 or v_price > 999999999.99 or round(v_price, 2) <> v_price then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'sale_price', 'code', 'INVALID_PRICE'));
      end if;
      if v_stock is null or v_stock < 0 or v_stock > 1000000 or round(v_stock, 3) <> v_stock
        or v_cost is null or v_cost < 0 or v_cost > 999999999.99 or round(v_cost, 2) <> v_cost then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'opening_stock', 'code', 'INVALID_OPENING_STOCK'));
      end if;
      select product.id into v_match_a from public.products product where product.shop_id = p_shop_id
        and product.is_active and v_sku is not null and lower(product.sku) = lower(v_sku);
      select product.id into v_match_b from public.products product where product.shop_id = p_shop_id
        and product.is_active and v_barcode is not null and lower(product.barcode) = lower(v_barcode);
      if v_match_a is not null and v_match_b is not null and v_match_a <> v_match_b then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'sku/barcode', 'code', 'IDENTIFIER_CONFLICT'));
      end if;
      if v_category is not null and (length(v_category) < 2 or length(v_category) > 80) then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'category', 'code', 'INVALID_CATEGORY'));
      end if;
      if v_supplier is not null then
        select count(*) into v_count_a from public.vendors vendor where vendor.shop_id = p_shop_id
          and vendor.is_active and lower(vendor.name) = lower(v_supplier);
        if v_count_a = 0 then v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'supplier', 'code', 'SUPPLIER_NOT_FOUND'));
        elsif v_count_a > 1 then v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'supplier', 'code', 'SUPPLIER_AMBIGUOUS')); end if;
      end if;
      if v_stock > 0 and not exists (select 1 from shop_private.inventory_access(p_shop_id) access where access.can_manage and access.inventory_enabled) then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'opening_stock', 'code', 'INVENTORY_NOT_AVAILABLE'));
      end if;
    elsif p_kind = 'customers' then
      if length(coalesce(v_phone, '')) > 50 or length(coalesce(btrim(v_row->>'address'), '')) > 500
        or length(coalesce(btrim(v_row->>'notes'), '')) > 2000 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'contact', 'code', 'INVALID_CUSTOMER'));
      end if;
      select client.id into v_match_a from public.clients client where client.shop_id = p_shop_id and client.is_active
        and v_email is not null and lower(client.email) = v_email order by client.id limit 1;
      select client.id into v_match_b from public.clients client where client.shop_id = p_shop_id and client.is_active
        and v_phone is not null and client.phone = v_phone order by client.id limit 1;
      select count(*) into v_count_a from public.clients client where client.shop_id = p_shop_id and client.is_active and v_email is not null and lower(client.email) = v_email;
      select count(*) into v_count_b from public.clients client where client.shop_id = p_shop_id and client.is_active and v_phone is not null and client.phone = v_phone;
      if v_count_a > 1 or v_count_b > 1 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'email/phone', 'code', 'DEDUPLICATION_AMBIGUOUS'));
      elsif v_match_a is not null and v_match_b is not null and v_match_a <> v_match_b then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'email/phone', 'code', 'DEDUPLICATION_CONFLICT'));
      end if;
    else
      if length(coalesce(v_phone, '')) > 40 or length(coalesce(btrim(v_row->>'contact_name'), '')) > 160
        or length(coalesce(btrim(v_row->>'address'), '')) > 500 or length(coalesce(btrim(v_row->>'tax_number'), '')) > 80
        or length(coalesce(btrim(v_row->>'notes'), '')) > 1000 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'contact', 'code', 'INVALID_SUPPLIER'));
      end if;
      select vendor.id into v_match_a from public.vendors vendor where vendor.shop_id = p_shop_id and vendor.is_active
        and v_email is not null and lower(vendor.email) = v_email order by vendor.id limit 1;
      select vendor.id into v_match_b from public.vendors vendor where vendor.shop_id = p_shop_id and vendor.is_active
        and v_phone is not null and vendor.phone = v_phone order by vendor.id limit 1;
      select count(*) into v_count_a from public.vendors vendor where vendor.shop_id = p_shop_id and vendor.is_active and v_email is not null and lower(vendor.email) = v_email;
      select count(*) into v_count_b from public.vendors vendor where vendor.shop_id = p_shop_id and vendor.is_active and v_phone is not null and vendor.phone = v_phone;
      if v_count_a > 1 or v_count_b > 1 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'email/phone', 'code', 'DEDUPLICATION_AMBIGUOUS'));
      elsif v_match_a is not null and v_match_b is not null and v_match_a <> v_match_b then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'email/phone', 'code', 'DEDUPLICATION_CONFLICT'));
      end if;
    end if;
  end loop;

  if p_kind = 'products' then
    if exists (select 1
      from jsonb_array_elements(p_rows) with ordinality a(value, ordinal)
      join jsonb_array_elements(p_rows) with ordinality b(value, ordinal)
        on a.ordinal < b.ordinal
      where nullif(lower(btrim(a.value->>'sku')), '') is not null
        and lower(btrim(a.value->>'sku')) = lower(btrim(b.value->>'sku'))) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', null, 'field', 'sku', 'code', 'DUPLICATE_BATCH_IDENTIFIER'));
    end if;
    if exists (select 1
      from jsonb_array_elements(p_rows) with ordinality a(value, ordinal)
      join jsonb_array_elements(p_rows) with ordinality b(value, ordinal)
        on a.ordinal < b.ordinal
      where nullif(lower(btrim(a.value->>'barcode')), '') is not null
        and lower(btrim(a.value->>'barcode')) = lower(btrim(b.value->>'barcode'))) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', null, 'field', 'barcode', 'code', 'DUPLICATE_BATCH_IDENTIFIER'));
    end if;
    select (plan.features->>'max_products')::integer into v_limit from public.shop_memberships membership
      join public.subscriptions subscription on subscription.profile_id = membership.profile_id
      join public.plans plan on plan.id = subscription.plan_id
      where membership.shop_id = p_shop_id and membership.role = 'owner' and membership.status = 'active';
    if v_limit is null or (select count(*) from public.products where shop_id = p_shop_id and is_active)
      + (select count(*) from jsonb_array_elements(p_rows) row
        where not exists (select 1 from public.products product
          where product.shop_id = p_shop_id and product.is_active
            and ((nullif(btrim(row->>'sku'), '') is not null and lower(product.sku) = lower(btrim(row->>'sku')))
              or (nullif(btrim(row->>'barcode'), '') is not null and lower(product.barcode) = lower(btrim(row->>'barcode')))))) > v_limit then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', null, 'field', 'file', 'code', 'PRODUCT_LIMIT_REACHED'));
    end if;
  end if;

  if jsonb_array_length(v_errors) > 0 or p_dry_run then
    return jsonb_build_object('valid', jsonb_array_length(v_errors) = 0, 'dryRun', true,
      'kind', p_kind, 'rowCount', jsonb_array_length(p_rows), 'errors', v_errors);
  end if;

  for v_row, v_ordinal in select value, ordinality from jsonb_array_elements(p_rows) with ordinality loop
    v_name := btrim(v_row->>'name'); v_email := nullif(lower(btrim(v_row->>'email')), ''); v_phone := nullif(btrim(v_row->>'phone'), '');
    if p_kind = 'products' then
      v_sku := nullif(btrim(v_row->>'sku'), ''); v_barcode := nullif(btrim(v_row->>'barcode'), '');
      select product.id into v_product_id from public.products product where product.shop_id = p_shop_id and product.is_active
        and ((v_sku is not null and lower(product.sku) = lower(v_sku)) or (v_barcode is not null and lower(product.barcode) = lower(v_barcode)))
        order by case when v_sku is not null and lower(product.sku) = lower(v_sku) then 0 else 1 end limit 1;
      if v_product_id is null then v_created := v_created + 1; else v_updated := v_updated + 1; end if;
      v_product_id := shop_private.save_product(p_shop_id, v_product_id, v_name, v_sku, v_barcode, (v_row->>'sale_price')::numeric);
      v_category_id := shop_private.resolve_catalog_category(p_shop_id, v_row->>'category', v_profile, true);
      update public.products set category_id = v_category_id where id = v_product_id and shop_id = p_shop_id;
      if nullif(btrim(v_row->>'supplier'), '') is not null then
        select vendor.id into v_vendor_id from public.vendors vendor where vendor.shop_id = p_shop_id and vendor.is_active
          and lower(vendor.name) = lower(btrim(v_row->>'supplier')) order by vendor.id limit 1;
        insert into public.product_suppliers (shop_id, product_id, vendor_id) values (p_shop_id, v_product_id, v_vendor_id) on conflict do nothing;
      end if;
      v_stock := coalesce(nullif(v_row->>'opening_stock', '')::numeric, 0);
      if v_stock > 0 then
        perform shop_private.adjust_stock(md5(p_request_id::text || ':stock:' || v_ordinal::text)::uuid,
          p_shop_id, v_product_id, v_stock, coalesce(nullif(v_row->>'opening_cost', '')::numeric, 0), 'Opening stock import');
        v_stocked := v_stocked + 1;
      end if;
    elsif p_kind = 'customers' then
      select client.id into v_match_a from public.clients client where client.shop_id = p_shop_id and client.is_active
        and ((v_email is not null and lower(client.email) = v_email) or (v_phone is not null and client.phone = v_phone))
        order by case when v_email is not null and lower(client.email) = v_email then 0 else 1 end, client.id limit 1;
      if v_match_a is null then v_created := v_created + 1; else v_updated := v_updated + 1; end if;
      perform shop_private.save_customer(p_shop_id, v_match_a, v_name, v_phone, v_email,
        nullif(btrim(v_row->>'address'), ''), nullif(btrim(v_row->>'notes'), ''));
    else
      select vendor.id into v_match_a from public.vendors vendor where vendor.shop_id = p_shop_id and vendor.is_active
        and ((v_email is not null and lower(vendor.email) = v_email) or (v_phone is not null and vendor.phone = v_phone))
        order by case when v_email is not null and lower(vendor.email) = v_email then 0 else 1 end, vendor.id limit 1;
      if v_match_a is null then v_created := v_created + 1; else v_updated := v_updated + 1; end if;
      perform shop_private.save_vendor(p_shop_id, v_match_a, v_name, nullif(btrim(v_row->>'contact_name'), ''),
        v_phone, v_email, nullif(btrim(v_row->>'address'), ''), nullif(btrim(v_row->>'tax_number'), ''), nullif(btrim(v_row->>'notes'), ''));
    end if;
  end loop;
  v_result := jsonb_build_object('valid', true, 'dryRun', false, 'kind', p_kind,
    'rowCount', jsonb_array_length(p_rows), 'created', v_created, 'updated', v_updated,
    'openingStockPosted', v_stocked, 'errors', '[]'::jsonb);
  insert into public.catalog_import_requests (request_id, shop_id, import_kind, payload_hash, result, created_by_profile_id)
    values (p_request_id, p_shop_id, p_kind, v_hash, v_result, v_profile);
  return v_result;
end;
$$;

create function public.catalog_import(p_request_id uuid, p_shop_id uuid, p_kind text,
  p_rows jsonb, p_dry_run boolean default true)
returns jsonb language sql security definer set search_path = '' as $$
  select shop_private.catalog_import(p_request_id, p_shop_id, p_kind, p_rows, p_dry_run);
$$;

drop function public.list_services(uuid,text,integer,integer);
alter function shop_private.list_services(uuid,text,integer,integer)
  rename to list_services_pre_categories;
create function shop_private.list_services(
  p_shop_id uuid, p_search text default null, p_category_id uuid default null,
  p_page integer default 1, p_page_size integer default 20
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_search text := nullif(btrim(p_search), ''); v_result jsonb;
begin
  if not shop_private.has_permission(p_shop_id, 'services.view') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501'; end if;
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then
    raise exception 'INVALID_PAGINATION' using errcode = '22023'; end if;
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(service_row.value order by service_row.name, service_row.id), '[]'::jsonb),
    'total', (select count(*) from public.services service left join public.catalog_categories category on category.id = service.category_id
      where service.shop_id = p_shop_id and service.is_active
        and (p_category_id is null or service.category_id = p_category_id)
        and (v_search is null or service.name ilike '%' || v_search || '%'
          or coalesce(service.description, '') ilike '%' || v_search || '%'
          or coalesce(category.name, '') ilike '%' || v_search || '%')),
    'page', p_page, 'pageSize', p_page_size) into v_result
  from (select service.id, service.name, jsonb_build_object(
      'id', service.id, 'name', service.name, 'description', service.description,
      'baseSalePrice', service.base_sale_price, 'defaultDiscountType', service.default_discount_type,
      'defaultDiscountValue', service.default_discount_value, 'isActive', service.is_active,
      'categoryId', service.category_id, 'categoryName', category.name,
      'schedulingEnabled', service.scheduling_enabled, 'durationMinutes', service.duration_minutes,
      'cleanupMinutes', service.cleanup_minutes,
      'locationIds', coalesce((select jsonb_agg(availability.location_id order by availability.location_id)
        from public.service_location_availability availability where availability.service_id = service.id), '[]'::jsonb),
      'staffMembershipIds', coalesce((select jsonb_agg(eligibility.membership_id order by eligibility.membership_id)
        from public.service_staff_eligibility eligibility where eligibility.service_id = service.id), '[]'::jsonb)) value
    from public.services service left join public.catalog_categories category on category.id = service.category_id
    where service.shop_id = p_shop_id and service.is_active
      and (p_category_id is null or service.category_id = p_category_id)
      and (v_search is null or service.name ilike '%' || v_search || '%'
        or coalesce(service.description, '') ilike '%' || v_search || '%'
        or coalesce(category.name, '') ilike '%' || v_search || '%')
    order by service.name, service.id limit p_page_size offset (p_page - 1) * p_page_size) service_row;
  return v_result;
end;
$$;
create function public.list_services(p_shop_id uuid, p_search text default null,
  p_page integer default 1, p_page_size integer default 20)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.list_services(p_shop_id, p_search, null, p_page, p_page_size);
$$;
create function public.list_services_by_category(p_shop_id uuid, p_search text default null,
  p_category_id uuid default null, p_page integer default 1, p_page_size integer default 20)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.list_services(p_shop_id, p_search, p_category_id, p_page, p_page_size);
$$;

-- Replace the POS catalog query with a category-aware signature. Barcode scans
-- intentionally ignore the selected category in the client, so a known code
-- can always resolve to its one shop-scoped product.
alter function shop_private.pos_catalog_search(uuid,uuid,text,text,text,integer,integer)
  rename to pos_catalog_search_pre_categories;
drop function public.pos_catalog_search(uuid,uuid,text,text,text,integer,integer);
create function shop_private.pos_catalog_search(
  p_shop_id uuid, p_location_id uuid, p_search text default null,
  p_item_type text default null, p_barcode text default null,
  p_category_id uuid default null, p_page integer default 1, p_page_size integer default 30
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_search text := nullif(btrim(p_search), ''); v_barcode text := nullif(btrim(p_barcode), '');
  v_mode public.business_mode; v_items jsonb; v_total bigint;
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  if not coalesce((select can_manage from shop_private.sale_access(p_shop_id)), false) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501'; end if;
  if p_item_type is not null and p_item_type not in ('product', 'service')
    or p_page is null or p_page < 1 or p_page_size is null or p_page_size < 1 or p_page_size > 50
    or length(coalesce(v_search, '')) > 160 or length(coalesce(v_barcode, '')) > 80 then
    raise exception 'INVALID_POS_CATALOG_QUERY' using errcode = '22023'; end if;
  if p_category_id is not null and not exists (select 1 from public.catalog_categories
    where id = p_category_id and shop_id = p_shop_id and is_active) then
    raise exception 'CATEGORY_NOT_FOUND'; end if;
  select business_mode into v_mode from public.shops where id = p_shop_id;
  with catalog as (
    select product.id, 'product'::text item_type, product.name, product.sku,
      product.barcode, product.sale_price unit_price, 0::numeric discount,
      coalesce((select sum(batch.remaining_quantity) from public.inventory_batches batch
        where batch.shop_id = p_shop_id and batch.location_id = p_location_id
          and batch.product_id = product.id), 0) stock,
      product.category_id, category.name category_name
    from public.products product left join public.catalog_categories category on category.id = product.category_id
    where product.shop_id = p_shop_id and product.is_active and v_mode in ('product', 'mixed')
      and (p_item_type is null or p_item_type = 'product')
      and (p_category_id is null or product.category_id = p_category_id)
      and (v_barcode is null or product.barcode = v_barcode)
      and (v_search is null or product.name ilike '%' || v_search || '%'
        or coalesce(product.sku, '') ilike '%' || v_search || '%'
        or coalesce(product.barcode, '') ilike '%' || v_search || '%'
        or coalesce(category.name, '') ilike '%' || v_search || '%')
    union all
    select service.id, 'service', service.name, null, null, service.base_sale_price,
      case service.default_discount_type when 'percent'
        then round(service.base_sale_price * service.default_discount_value / 100, 2)
        else service.default_discount_value end, null::numeric,
      service.category_id, category.name
    from public.services service left join public.catalog_categories category on category.id = service.category_id
    where service.shop_id = p_shop_id and service.is_active and v_mode in ('service', 'mixed')
      and v_barcode is null and (p_item_type is null or p_item_type = 'service')
      and (p_category_id is null or service.category_id = p_category_id)
      and (v_search is null or service.name ilike '%' || v_search || '%'
        or coalesce(category.name, '') ilike '%' || v_search || '%')
  ), counted as (select *, count(*) over () total_count from catalog), paged as (
    select * from counted order by lower(name), id offset (p_page - 1) * p_page_size limit p_page_size
  ) select coalesce(max(total_count), 0), coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'itemType', item_type, 'name', name, 'sku', sku, 'barcode', barcode,
    'unitPrice', unit_price, 'discount', discount, 'stock', stock,
    'categoryId', category_id, 'categoryName', category_name
  ) order by lower(name), id), '[]'::jsonb) into v_total, v_items from paged;
  return jsonb_build_object('items', v_items, 'total', v_total, 'page', p_page,
    'pageSize', p_page_size, 'businessMode', v_mode,
    'ambiguousBarcode', v_barcode is not null and v_total > 1);
end;
$$;

create function public.pos_catalog_search(p_shop_id uuid, p_location_id uuid,
  p_search text default null, p_item_type text default null, p_barcode text default null,
  p_page integer default 1, p_page_size integer default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.pos_catalog_search(p_shop_id, p_location_id, p_search,
    p_item_type, p_barcode, null, p_page, p_page_size);
$$;
create function public.pos_catalog_search_by_category(p_shop_id uuid, p_location_id uuid,
  p_search text default null, p_item_type text default null, p_barcode text default null,
  p_category_id uuid default null, p_page integer default 1, p_page_size integer default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.pos_catalog_search(p_shop_id, p_location_id, p_search,
    p_item_type, p_barcode, p_category_id, p_page, p_page_size);
$$;

create function shop_private.catalog_sales_report(
  p_shop_id uuid, p_category_id uuid default null,
  p_from date default (now() at time zone 'Africa/Cairo')::date - 30,
  p_to date default (now() at time zone 'Africa/Cairo')::date
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform shop_private.assert_team_permission(p_shop_id, 'reports.view');
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366 then
    raise exception 'INVALID_REPORT_PERIOD' using errcode = '22023'; end if;
  if p_category_id is not null and not exists (select 1 from public.catalog_categories
    where id = p_category_id and shop_id = p_shop_id and is_active) then
    raise exception 'CATEGORY_NOT_FOUND'; end if;
  return jsonb_build_object('categoryId', p_category_id, 'from', p_from, 'to', p_to,
    'items', (select coalesce(jsonb_agg(to_jsonb(rows) order by rows.amount desc, rows.name), '[]'::jsonb)
      from (select item.item_type::text type, item.item_name name,
          coalesce(category.name, 'Uncategorized') category,
          sum(item.quantity) quantity, sum(item.total_amount) amount
        from public.invoice_items item
        join public.invoices invoice on invoice.id = item.invoice_id and invoice.shop_id = item.shop_id
        left join public.products product on item.item_type = 'product' and product.id = item.product_id and product.shop_id = item.shop_id
        left join public.services service on item.item_type = 'service' and service.id = item.service_id and service.shop_id = item.shop_id
        left join public.catalog_categories category on category.id = coalesce(product.category_id, service.category_id)
        where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
          and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
          and coalesce(invoice.issued_at, invoice.created_at)::date between p_from and p_to
          and (p_category_id is null or coalesce(product.category_id, service.category_id) = p_category_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        group by item.item_type, item.item_name, category.name) rows));
end;
$$;

create function public.catalog_sales_report(p_shop_id uuid, p_category_id uuid default null,
  p_from date default (now() at time zone 'Africa/Cairo')::date - 30,
  p_to date default (now() at time zone 'Africa/Cairo')::date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.catalog_sales_report(p_shop_id, p_category_id, p_from, p_to);
$$;

revoke all on function shop_private.resolve_catalog_category(uuid,text,uuid,boolean),
  shop_private.list_catalog_categories(uuid), shop_private.save_catalog_category(uuid,uuid,text),
  shop_private.set_catalog_item_category(uuid,text,uuid,uuid),
  shop_private.save_product_with_category(uuid,uuid,text,text,text,numeric,uuid),
  shop_private.save_service_with_category(uuid,uuid,text,text,numeric,text,numeric,boolean,integer,integer,uuid[],uuid[],uuid),
  shop_private.list_products(uuid,text,uuid,integer,integer),
  shop_private.barcode_label_data(uuid,text,uuid,integer,integer),
  shop_private.catalog_import(uuid,uuid,text,jsonb,boolean),
  shop_private.list_services_pre_categories(uuid,text,integer,integer),
  shop_private.list_services(uuid,text,uuid,integer,integer),
  shop_private.pos_catalog_search_pre_categories(uuid,uuid,text,text,text,integer,integer),
  shop_private.pos_catalog_search(uuid,uuid,text,text,text,uuid,integer,integer),
  shop_private.catalog_sales_report(uuid,uuid,date,date)
from public, anon, authenticated, service_role;
revoke all on function public.list_catalog_categories(uuid),
  public.save_catalog_category(uuid,uuid,text), public.set_catalog_item_category(uuid,text,uuid,uuid),
  public.save_product_with_category(uuid,uuid,text,text,text,numeric,uuid),
  public.save_service_with_category(uuid,uuid,text,text,numeric,text,numeric,boolean,integer,integer,uuid[],uuid[],uuid),
  public.list_products(uuid,text,uuid,integer,integer),
  public.barcode_label_data(uuid,text,uuid,integer,integer),
  public.catalog_import(uuid,uuid,text,jsonb,boolean),
  public.list_services(uuid,text,integer,integer),
  public.list_services_by_category(uuid,text,uuid,integer,integer),
  public.pos_catalog_search(uuid,uuid,text,text,text,integer,integer),
  public.pos_catalog_search_by_category(uuid,uuid,text,text,text,uuid,integer,integer),
  public.catalog_sales_report(uuid,uuid,date,date)
from public, anon, authenticated;
grant execute on function public.list_catalog_categories(uuid),
  public.save_catalog_category(uuid,uuid,text), public.set_catalog_item_category(uuid,text,uuid,uuid),
  public.save_product_with_category(uuid,uuid,text,text,text,numeric,uuid),
  public.save_service_with_category(uuid,uuid,text,text,numeric,text,numeric,boolean,integer,integer,uuid[],uuid[],uuid),
  public.list_products(uuid,text,uuid,integer,integer),
  public.barcode_label_data(uuid,text,uuid,integer,integer),
  public.catalog_import(uuid,uuid,text,jsonb,boolean),
  public.list_services(uuid,text,integer,integer),
  public.list_services_by_category(uuid,text,uuid,integer,integer),
  public.pos_catalog_search(uuid,uuid,text,text,text,integer,integer),
  public.pos_catalog_search_by_category(uuid,uuid,text,text,text,uuid,integer,integer),
  public.catalog_sales_report(uuid,uuid,date,date)
to authenticated;

notify pgrst, 'reload schema';
