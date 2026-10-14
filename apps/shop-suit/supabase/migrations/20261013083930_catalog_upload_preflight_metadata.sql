-- Storage v1.70.3 checks INSERT permission before streaming the object. Its
-- preflight has mimetype/contentLength, not the completed object's size.
-- Bucket MIME/5 MiB limits enforce streamed content; catalog saves continue to
-- validate completed object metadata with catalog_image_access unchanged.
create function shop_private.catalog_image_upload_access(p_name text, p_metadata jsonb)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_shop uuid; v_kind text;
begin
  if auth.uid() is null or p_name !~ '^[0-9a-f-]{36}/(products|services)/[0-9a-f-]{36}\.(jpg|png|webp)$'
    or jsonb_typeof(p_metadata) is distinct from 'object' then return false; end if;
  v_shop := split_part(p_name, '/', 1)::uuid;
  v_kind := split_part(p_name, '/', 2);
  perform shop_private.assert_shop_write_access(v_shop, v_kind || '.manage');
  if p_metadata ? 'size' then
    return shop_private.catalog_image_access(p_name, true, p_metadata);
  end if;
  -- Multipart Content-Length includes boundaries, so it is not a file size.
  -- Reject empty/invalid known lengths; Storage enforces actual streamed size.
  return (not (p_metadata ? 'contentLength') or (p_metadata->>'contentLength')::bigint > 0)
    and p_metadata->>'mimetype' = case split_part(p_name, '.', 2)
      when 'jpg' then 'image/jpeg' when 'png' then 'image/png' when 'webp' then 'image/webp' end;
exception when invalid_text_representation or numeric_value_out_of_range or insufficient_privilege then return false;
end;
$$;
revoke all on function shop_private.catalog_image_upload_access(text,jsonb) from public, anon;
grant execute on function shop_private.catalog_image_upload_access(text,jsonb) to authenticated;
alter policy shop_catalog_image_insert on storage.objects
with check (bucket_id = 'shop-catalog-images' and shop_private.catalog_image_upload_access(name, metadata));
-- Private read policy and absence of UPDATE/DELETE/anonymous policies retained.
