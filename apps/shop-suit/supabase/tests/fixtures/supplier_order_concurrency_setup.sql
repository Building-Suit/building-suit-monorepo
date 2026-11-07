create table supplier_order_test.race(owner_id uuid,shop_id uuid,location_id uuid,product_id uuid,order_id uuid,line_id uuid);
do $$declare actor uuid:=gen_random_uuid();shop uuid;location uuid;vendor uuid;product uuid;pack uuid;r jsonb;order_id uuid;begin
 insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(actor,actor::text||'@supplier-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now());
 perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('request.jwt.claim.role','authenticated',true);
 shop:=public.create_owner_shop('Supplier order concurrent receiving','multi','mixed');
 select id into location from public.shop_locations where shop_id=shop and is_default;
 vendor:=public.save_vendor(shop,null,'Concurrent source supplier',null,null,null,null,null,null);
 product:=public.save_product(shop,null,'Concurrent ordered cable','PO-RACE',null,35);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m"]','Receiving race stock unit');
 perform public.save_product_technical_details(shop,product,0,null,'{}',true,'Track concurrent source receipts');
 pack:=public.save_product_packaging(gen_random_uuid(),shop,product,null,'{"code":"PORACE100","name":"100m ordered source","unitCode":"reel","containedQuantity":"100","containedUnitCode":"m","canPurchase":true,"canSell":true}');
 r:=public.supplier_order_command(gen_random_uuid(),shop,location,'save',null,0,jsonb_build_object('vendorId',vendor,'lines',jsonb_build_array(jsonb_build_object('product_id',product,'quantity','10','unit_cost','2500','package_id',pack,'package_version',1,'measurement_revision',1))),'Plan ten concurrently received reels');order_id:=(r->>'id')::uuid;
 perform public.supplier_order_command(gen_random_uuid(),shop,location,'issue',order_id,1,'{}','Issue concurrent source promise');
 insert into supplier_order_test.race values(actor,shop,location,product,order_id,(public.supplier_order_context(shop,location,order_id)#>>'{detail,lines,0,id}')::uuid);
end;$$;
