-- Transactional security/behavior fixture for the separately migrated disposable Shop DB.
create temporary table upload_fixture as select gen_random_uuid() owner_id, gen_random_uuid() outsider_id;
grant select on upload_fixture to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@upload.test','x','authenticated','authenticated','{}','{}',now(),now()
from (select owner_id id from upload_fixture union all select outsider_id from upload_fixture) u;
select set_config('request.jwt.claim.sub',owner_id::text,true) from upload_fixture;
set local role authenticated;
do $$
declare s uuid; n text; r jsonb; p uuid; kind text;
begin
 s:=public.create_owner_shop('Synthetic upload test','mixed'::public.business_mode,'Main','MAIN',null,null);
 perform set_config('upload.shop',s::text,true);
 foreach kind in array array['products','services'] loop
   n:=s::text||'/'||kind||'/'||gen_random_uuid()::text||'.png';
   if not shop_private.catalog_image_access(n,true,'{"size":12,"mimetype":"image/png"}') then raise exception 'Owner upload denied'; end if;
   if shop_private.catalog_image_access(n,true,'{"size":5242881,"mimetype":"image/png"}') then raise exception 'Oversize accepted'; end if;
   if shop_private.catalog_image_access(n,true,'{"size":12,"mimetype":"image/svg+xml"}') then raise exception 'Wrong MIME accepted'; end if;
   begin
     perform public.shop_catalog_media(s,'save_product',jsonb_build_object('p_name','Missing image','p_sale_price',12,'imageUrl',null,'imageObjectName',n));
     raise exception 'Missing or wrong-kind object accepted';
   exception when sqlstate '22023' then null; end;
   insert into storage.objects(bucket_id,name,metadata) values ('shop-catalog-images',n,'{"size":12,"mimetype":"image/png"}');
   if kind = 'products' then
     p:=(public.shop_catalog_media(s,'save_product',jsonb_build_object('p_name','Uploaded product','p_sale_price',12,'imageUrl',null,'imageObjectName',n))#>>'{}')::uuid;
     r:=public.shop_catalog_media(s,'products','{}');
     if r->'items'->0->>'imageObjectName'<>n then raise exception 'Uploaded image missing'; end if;
     perform public.shop_catalog_media(s,'save_product',jsonb_build_object('p_product_id',p,'p_name','Uploaded product','p_sale_price',12,'imageUrl',null,'imageObjectName',null));
     r:=public.shop_catalog_media(s,'products','{}');
     if r->'items'->0->>'imageObjectName' is not null then raise exception 'Remove failed'; end if;
   else
     perform public.shop_catalog_media(s,'save_service',jsonb_build_object('p_name','Uploaded service','p_base_sale_price',20,'p_discount_type','amount','p_discount_value',0,'p_scheduling_enabled',false,'p_duration_minutes',30,'p_cleanup_minutes',0,'p_location_ids','[]'::jsonb,'p_staff_membership_ids','[]'::jsonb,'imageUrl',null,'imageObjectName',n));
     r:=public.shop_catalog_media(s,'services','{}');
     if r->'items'->0->>'imageObjectName'<>n then raise exception 'Service image missing'; end if;
   end if;
 end loop;
 if r->>'supportsUploads'<>'true' then raise exception 'Upload capability missing'; end if;
 if has_function_privilege('anon','shop_private.catalog_image_access(text,boolean,jsonb)','execute') then raise exception 'Anonymous helper access'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',outsider_id::text,true) from upload_fixture;
set local role authenticated;
do $$
declare n text:=current_setting('upload.shop')||'/products/'||gen_random_uuid()::text||'.png';
begin
 if shop_private.catalog_image_access(n,false) or shop_private.catalog_image_access(n,true,'{"size":12,"mimetype":"image/png"}') then raise exception 'Cross-tenant access'; end if;
 if exists(select 1 from storage.objects where bucket_id='shop-catalog-images') then raise exception 'Outsider can read images'; end if;
 begin
   insert into storage.objects(bucket_id,name,metadata) values ('shop-catalog-images',n,'{"size":12,"mimetype":"image/png"}');
   raise exception 'Outsider can insert';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from storage.buckets where id='shop-catalog-images' and public) then raise exception 'Public catalog bucket'; end if;
end $$;
