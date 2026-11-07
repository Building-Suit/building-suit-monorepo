create table measurement_test.reel_race(owner_id uuid,shop_id uuid,product_id uuid,location_id uuid,staff_id uuid,customer_id uuid,invoice_a uuid,invoice_b uuid);
insert into measurement_test.reel_race(owner_id) values(gen_random_uuid());
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id,owner_id::text||'@reel-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from measurement_test.reel_race;
select set_config('request.jwt.claim.sub',owner_id::text,false),set_config('request.jwt.claim.role','authenticated',false) from measurement_test.reel_race;
do $$declare actor uuid;shop uuid;product uuid;location uuid;staff uuid;customer uuid;vendor uuid;a uuid;b uuid;begin
 set local role authenticated;
 shop:=public.create_owner_shop('Physical reel race','mixed'::public.business_mode);
 select id into location from public.shop_locations where shop_id=shop and is_default;
 select id into staff from public.shop_memberships where shop_id=shop and role='owner';
 customer:=public.save_customer(shop,null,'Race customer',null,null,null,null);
 vendor:=public.save_vendor(shop,null,'Race supplier',null,null,null,null,null,null);
 product:=public.save_product(shop,null,'Race cable','REEL-RACE',null,35);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m"]','Race measured setup');
 perform public.save_product_technical_details(shop,product,0,null,'{}',true,'Race physical tracking');
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'RACE15',current_date,null,jsonb_build_array(jsonb_build_object('product_id',product,'quantity','15','unit_cost',25,'unit_code','m','measurement_revision',1)));
 a:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity','10','unit_code','m','measurement_revision',1)));
 b:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity','10','unit_code','m','measurement_revision',1)));
 reset role;
 update measurement_test.reel_race set shop_id=shop,product_id=product,location_id=location,staff_id=staff,customer_id=customer,invoice_a=a,invoice_b=b;
end;$$;
