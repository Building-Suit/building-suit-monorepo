-- Reapply catalog RPC error compatibility for databases that already recorded
-- 20260929200000 before its compatibility handlers were added. Migration up
-- skips recorded versions, so this repair must have its own forward version.
-- Keep capacity enforcement in the resource triggers and preserve the existing
-- PRODUCT_LIMIT_REACHED / SERVICE_LIMIT_REACHED RPC error contracts.
-- CREATE OR REPLACE retains each function's existing owner and grants.

create or replace function shop_private.save_product(
  p_shop_id uuid, p_product_id uuid, p_name text, p_sku text,
  p_barcode text, p_sale_price numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile_id uuid; v_product_id uuid;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'products.manage');
  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 160
    or p_sale_price is null or p_sale_price < 0 or p_sale_price > 999999999.99
    or (p_sku is not null and length(btrim(p_sku)) > 80)
    or (p_barcode is not null and length(btrim(p_barcode)) > 80) then
    raise exception 'INVALID_PRODUCT' using errcode = '22023';
  end if;
  if p_product_id is null then
    begin
      insert into public.products (
        shop_id, name, sku, barcode, sale_price, created_by_profile_id
      ) values (
        p_shop_id, btrim(p_name), nullif(btrim(p_sku), ''),
        nullif(btrim(p_barcode), ''), p_sale_price, v_profile_id
      ) returning id into v_product_id;
    exception when check_violation then
      if sqlerrm like 'PLAN_RESOURCE_LIMIT_REACHED:active_products:%' then
        raise exception 'PRODUCT_LIMIT_REACHED' using errcode = '23514';
      end if;
      raise;
    end;
  else
    update public.products set name = btrim(p_name),
      sku = nullif(btrim(p_sku), ''), barcode = nullif(btrim(p_barcode), ''),
      sale_price = p_sale_price, updated_at = now()
    where id = p_product_id and shop_id = p_shop_id and is_active
    returning id into v_product_id;
    if v_product_id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  end if;
  return v_product_id;
end;
$$;

create or replace function shop_private.save_service(
  p_shop_id uuid, p_service_id uuid, p_name text, p_description text,
  p_base_sale_price numeric, p_discount_type text, p_discount_value numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile_id uuid; v_service_id uuid;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'services.manage');
  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 160
    or (p_description is not null and length(btrim(p_description)) > 1000)
    or p_base_sale_price is null or p_base_sale_price < 0
    or p_base_sale_price > 999999999.99
    or p_discount_type not in ('amount', 'percent') or p_discount_type is null
    or p_discount_value is null or p_discount_value < 0
    or (p_discount_type = 'percent' and p_discount_value > 100)
    or (p_discount_type = 'amount' and p_discount_value > p_base_sale_price) then
    raise exception 'INVALID_SERVICE' using errcode = '22023';
  end if;
  if p_service_id is null then
    begin
      insert into public.services (
        shop_id, name, description, base_sale_price,
        default_discount_type, default_discount_value, created_by_profile_id
      ) values (
        p_shop_id, btrim(p_name), nullif(btrim(p_description), ''), p_base_sale_price,
        p_discount_type, p_discount_value, v_profile_id
      ) returning id into v_service_id;
    exception when check_violation then
      if sqlerrm like 'PLAN_RESOURCE_LIMIT_REACHED:active_services:%' then
        raise exception 'SERVICE_LIMIT_REACHED' using errcode = '23514';
      end if;
      raise;
    end;
  else
    update public.services set name = btrim(p_name),
      description = nullif(btrim(p_description), ''),
      base_sale_price = p_base_sale_price,
      default_discount_type = p_discount_type,
      default_discount_value = p_discount_value, updated_at = now()
    where id = p_service_id and shop_id = p_shop_id and is_active
    returning id into v_service_id;
    if v_service_id is null then raise exception 'SERVICE_NOT_FOUND'; end if;
  end if;
  return v_service_id;
end;
$$;
