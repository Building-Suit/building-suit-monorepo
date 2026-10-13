-- Private immutable catalog uploads. Apply separately through the Shop deployment gate.
alter table public.products add column image_object_name text;
alter table public.services add column image_object_name text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-catalog-images', 'shop-catalog-images', false, 5242880, array['image/jpeg','image/png','image/webp']);

create function shop_private.catalog_image_access(p_name text, p_write boolean, p_metadata jsonb default null)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_shop uuid; v_kind text;
begin
  if auth.uid() is null or p_name !~ '^[0-9a-f-]{36}/(products|services)/[0-9a-f-]{36}\.(jpg|png|webp)$' then return false; end if;
  v_shop := split_part(p_name, '/', 1)::uuid;
  v_kind := split_part(p_name, '/', 2);
  if p_write then
    perform shop_private.assert_shop_write_access(v_shop, v_kind || '.manage');
    return (p_metadata->>'size')::bigint between 1 and 5242880
      and p_metadata->>'mimetype' = case split_part(p_name, '.', 2)
        when 'jpg' then 'image/jpeg' when 'png' then 'image/png' when 'webp' then 'image/webp' end;
  end if;
  return shop_private.has_permission(v_shop, v_kind || '.view')
    or shop_private.has_permission(v_shop, v_kind || '.manage')
    or shop_private.has_permission(v_shop, 'sales.view');
exception when invalid_text_representation or insufficient_privilege then return false;
end;
$$;
revoke all on function shop_private.catalog_image_access(text,boolean,jsonb) from public, anon;
grant execute on function shop_private.catalog_image_access(text,boolean,jsonb) to authenticated;
create policy shop_catalog_image_insert on storage.objects for insert to authenticated
with check (bucket_id = 'shop-catalog-images' and shop_private.catalog_image_access(name, true, metadata));
create policy shop_catalog_image_read on storage.objects for select to authenticated
using (bucket_id = 'shop-catalog-images' and shop_private.catalog_image_access(name, false));
-- No UPDATE, DELETE or anonymous policies; replacement writes a new immutable key.

alter function shop_private.catalog_media(uuid,text,jsonb) rename to catalog_media_urls;
create function shop_private.catalog_media(p_shop_id uuid, p_action text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_name text; v_id uuid; v_kind text; v_items jsonb;
begin
  if p_action in ('save_product','save_service') and p_payload ? 'imageObjectName' then
    if p_payload->'imageObjectName' <> 'null'::jsonb and jsonb_typeof(p_payload->'imageObjectName') <> 'string' then
      raise exception 'INVALID_CATALOG_IMAGE' using errcode = '22023'; end if;
    v_name := nullif(p_payload->>'imageObjectName', '');
    v_kind := case p_action when 'save_product' then 'products' else 'services' end;
    if v_name is not null and (split_part(v_name,'/',1) <> p_shop_id::text or split_part(v_name,'/',2) <> v_kind
      or not exists (select 1 from storage.objects o where o.bucket_id = 'shop-catalog-images' and o.name = v_name
        and shop_private.catalog_image_access(o.name, true, o.metadata))) then
      raise exception 'INVALID_CATALOG_IMAGE' using errcode = '22023'; end if;
    -- Existing save owns permissions, subscription, validation, quota and atomic metadata writes.
    v_result := shop_private.catalog_media_urls(p_shop_id, p_action, p_payload);
    v_id := (v_result #>> '{}')::uuid;
    if p_action = 'save_product' then
      update public.products set image_object_name = v_name where id = v_id and shop_id = p_shop_id;
    else
      update public.services set image_object_name = v_name where id = v_id and shop_id = p_shop_id;
    end if;
    return v_result;
  end if;
  v_result := shop_private.catalog_media_urls(p_shop_id, p_action, p_payload);
  if p_action in ('products','services','pos') then
    select coalesce(jsonb_agg(item.value || jsonb_build_object('imageObjectName',
      case when p_action = 'products' or (p_action = 'pos' and item.value->>'itemType' = 'product') then
        (select image_object_name from public.products where id = (item.value->>'id')::uuid and shop_id = p_shop_id)
      else (select image_object_name from public.services where id = (item.value->>'id')::uuid and shop_id = p_shop_id) end)
      order by item.position), '[]'::jsonb) into v_items
    from jsonb_array_elements(v_result->'items') with ordinality item(value,position);
    return jsonb_set(v_result, '{items}', v_items) || jsonb_build_object('supportsUploads', true);
  end if;
  return v_result;
end;
$$;
revoke all on function shop_private.catalog_media(uuid,text,jsonb) from public, anon;
grant execute on function shop_private.catalog_media(uuid,text,jsonb) to authenticated;
create or replace function public.shop_catalog_media(p_shop_id uuid, p_action text, p_payload jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select shop_private.catalog_media(p_shop_id, p_action, p_payload);
$$;
