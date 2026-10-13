-- Run transactionally against the migrated, disposable local Shop database.
create temporary table media_fixture as select gen_random_uuid() owner_id, gen_random_uuid() outsider_id;
grant select on media_fixture to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@media.test','x','authenticated','authenticated','{}','{}',now(),now()
from (select owner_id id from media_fixture union all select outsider_id from media_fixture) u;
select set_config('request.jwt.claim.sub',owner_id::text,true) from media_fixture;
set local role authenticated;
do $$
declare s uuid; p uuid; v uuid; r jsonb;
begin
 s:=public.create_owner_shop('Synthetic media test','mixed'::public.business_mode,'Main','MAIN',null,null);
 perform set_config('media.shop',s::text,true);
 p:=(public.shop_catalog_media(s,'save_product','{"p_name":"Product","p_sale_price":12,"imageUrl":"https://media.example.test/product.png"}')#>>'{}')::uuid;
 r:=public.shop_catalog_media(s,'products','{}');
 if r->'items'->0->>'imageUrl'<>'https://media.example.test/product.png' or r->>'supportsMedia'<>'true' then raise exception 'Product image round trip failed';end if;
 v:=(public.shop_catalog_media(s,'save_service','{"p_name":"Service","p_base_sale_price":20,"p_discount_type":"amount","p_discount_value":0,"p_scheduling_enabled":false,"p_duration_minutes":30,"p_cleanup_minutes":0,"p_location_ids":[],"p_staff_membership_ids":[],"imageUrl":"https://media.example.test/service.png"}')#>>'{}')::uuid;
 r:=public.shop_catalog_media(s,'services','{}');
 if r->'items'->0->>'imageUrl'<>'https://media.example.test/service.png' then raise exception 'Service image round trip failed';end if;
 perform public.shop_catalog_media(s,'save_product',jsonb_build_object('p_product_id',p,'p_name','Product','p_sale_price',12,'imageUrl',null));
 r:=public.shop_catalog_media(s,'products','{}');
 if r->'items'->0->>'imageUrl' is not null then raise exception 'Image removal failed';end if;
 begin
  perform public.shop_catalog_media(s,'save_product','{"p_name":"Invalid","p_sale_price":12,"imageUrl":"javascript:alert(1)"}');
  raise exception 'Unsafe image was accepted';
 exception when sqlstate '22023' then null;end;
 if has_function_privilege('anon','public.shop_catalog_media(uuid,text,jsonb)','execute') then raise exception 'Anonymous media access';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',outsider_id::text,true) from media_fixture;
set local role authenticated;
do $$ begin
 begin
  perform public.shop_catalog_media(current_setting('media.shop')::uuid,'products','{}');
  raise exception 'Outsider read tenant catalog';
 exception when insufficient_privilege then null;end;
 begin
  perform public.shop_catalog_media(current_setting('media.shop')::uuid,'save_product','{"p_name":"Intruder","p_sale_price":1,"imageUrl":null}');
  raise exception 'Outsider wrote tenant catalog';
 exception when insufficient_privilege then null;end;
end $$;
