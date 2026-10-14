-- Optional catalog images: created with the official Shop migration CLI.
-- No hosted application is authorized. Existing functions/signatures/RLS remain unchanged.
alter table public.products add column image_url text;
alter table public.services add column image_url text;
alter table public.products add constraint products_image_url_https check (image_url is null or (length(image_url) <= 2000 and image_url ~ '^https://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$'));
alter table public.services add constraint services_image_url_https check (image_url is null or (length(image_url) <= 2000 and image_url ~ '^https://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$'));

create function shop_private.catalog_media(p_shop_id uuid, p_action text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_items jsonb; v_id uuid; v_image text;
begin
  if auth.uid() is null then raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'INVALID_CATALOG_MEDIA' using errcode = '22023'; end if;
  if p_action in ('save_product', 'save_service') then
    if not (p_payload ? 'imageUrl') or (p_payload->'imageUrl' <> 'null'::jsonb and jsonb_typeof(p_payload->'imageUrl') <> 'string') then
      raise exception 'INVALID_CATALOG_IMAGE' using errcode = '22023'; end if;
    v_image := nullif(btrim(p_payload->>'imageUrl'), '');
    if v_image is not null and (length(v_image) > 2000 or v_image !~ '^https://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$') then
      raise exception 'INVALID_CATALOG_IMAGE' using errcode = '22023'; end if;
    -- Delegate ALL existing permissions, quotas, subscription/closed-period and validation rules.
    -- Metadata update is in the same transaction as the existing authorized save.
    if p_action = 'save_product' then
      v_id := shop_private.save_product_with_category(p_shop_id, (p_payload->>'p_product_id')::uuid,
        p_payload->>'p_name', p_payload->>'p_sku', p_payload->>'p_barcode',
        (p_payload->>'p_sale_price')::numeric, (p_payload->>'p_category_id')::uuid);
      update public.products set image_url = v_image where id = v_id and shop_id = p_shop_id;
    else
      v_id := shop_private.save_service_with_category(p_shop_id, (p_payload->>'p_service_id')::uuid,
        p_payload->>'p_name', p_payload->>'p_description', (p_payload->>'p_base_sale_price')::numeric,
        p_payload->>'p_discount_type', (p_payload->>'p_discount_value')::numeric,
        (p_payload->>'p_scheduling_enabled')::boolean, (p_payload->>'p_duration_minutes')::integer,
        (p_payload->>'p_cleanup_minutes')::integer,
        array(select jsonb_array_elements_text(p_payload->'p_location_ids')::uuid),
        array(select jsonb_array_elements_text(p_payload->'p_staff_membership_ids')::uuid),
        (p_payload->>'p_category_id')::uuid);
      update public.services set image_url = v_image where id = v_id and shop_id = p_shop_id;
    end if;
    return to_jsonb(v_id);
  elsif p_action = 'products' then
    v_result := shop_private.list_products(p_shop_id, p_payload->>'p_search', (p_payload->>'p_category_id')::uuid,
      coalesce((p_payload->>'p_page')::integer, 1), coalesce((p_payload->>'p_page_size')::integer, 20));
  elsif p_action = 'services' then
    v_result := shop_private.list_services(p_shop_id, p_payload->>'p_search', (p_payload->>'p_category_id')::uuid,
      coalesce((p_payload->>'p_page')::integer, 1), coalesce((p_payload->>'p_page_size')::integer, 20));
  elsif p_action = 'pos' then
    v_result := shop_private.pos_catalog_search(p_shop_id, (p_payload->>'p_location_id')::uuid,
      p_payload->>'p_search', p_payload->>'p_item_type', p_payload->>'p_barcode',
      (p_payload->>'p_category_id')::uuid, coalesce((p_payload->>'p_page')::integer, 1), coalesce((p_payload->>'p_page_size')::integer, 30));
  else raise exception 'INVALID_CATALOG_MEDIA_ACTION' using errcode = '22023';
  end if;
  -- Enrich only the rows already returned by authorized, paginated source queries.
  select coalesce(jsonb_agg(item.value || jsonb_build_object('imageUrl',
    case when p_action = 'products' or (p_action = 'pos' and item.value->>'itemType' = 'product') then
      (select image_url from public.products where id = (item.value->>'id')::uuid and shop_id = p_shop_id)
    else (select image_url from public.services where id = (item.value->>'id')::uuid and shop_id = p_shop_id) end)
    order by item.position), '[]'::jsonb) into v_items
  from jsonb_array_elements(v_result->'items') with ordinality item(value, position);
  return jsonb_set(v_result, '{items}', v_items) || jsonb_build_object('supportsMedia', true);
end;
$$;
create function public.shop_catalog_media(p_shop_id uuid, p_action text, p_payload jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select shop_private.catalog_media(p_shop_id, p_action, p_payload);
$$;
revoke all on function shop_private.catalog_media(uuid,text,jsonb), public.shop_catalog_media(uuid,text,jsonb) from public, anon;
grant execute on function shop_private.catalog_media(uuid,text,jsonb), public.shop_catalog_media(uuid,text,jsonb) to authenticated;
