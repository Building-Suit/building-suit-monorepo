create table measurement_test.order_race(owner_id uuid,shop_id uuid,product_id uuid,location_id uuid,invoice_id uuid,order_a uuid,line_a uuid,order_b uuid,line_b uuid);
insert into measurement_test.order_race(owner_id) values(gen_random_uuid());
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id,owner_id::text||'@order-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from measurement_test.order_race;
select set_config('request.jwt.claim.sub',owner_id::text,false),set_config('request.jwt.claim.role','authenticated',false) from measurement_test.order_race;
do $$declare shop uuid;product uuid;location uuid;staff uuid;customer uuid;invoice uuid;q jsonb;o jsonb;orders uuid[]:='{}';lines uuid[]:='{}';i integer;begin
 set local role authenticated;
 shop:=public.create_owner_shop('Order reservation race','multi','mixed');
 select id into location from public.shop_locations where shop_id=shop and is_default;
 select id into staff from public.shop_memberships where shop_id=shop and role='owner';
 customer:=public.save_customer(shop,null,'Race contractor',null,null,null,null);
 product:=public.save_product(shop,null,'Race measured cable','ORDER-RACE',null,35);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m"]','Race measured stock');
 perform public.adjust_stock(gen_random_uuid(),shop,product,100,20,'Reservation race opening stock');
 invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity','30','unit_code','m','measurement_revision',1)));
 for i in 1..2 loop
 q:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,jsonb_build_object('customerId',customer,'validUntil',clock_timestamp()+interval '7 days','orderDiscount','0','lines',jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity','80','unit_code','m','measurement_revision',1))),'Reservation race offer');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',(q->>'id')::uuid,1,'{}','Issue race offer');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'accept',(q->>'id')::uuid,2,'{}','Accept race offer');
 o:=public.create_trade_order(gen_random_uuid(),shop,location,(q->>'id')::uuid,3,'Create competing material order');
 orders:=array_append(orders,(o->>'id')::uuid);
 lines:=array_append(lines,(public.trade_order_context(shop,location,(o->>'id')::uuid)#>>'{detail,lines,0,id}')::uuid);
 end loop;
 reset role;
 update measurement_test.order_race set shop_id=shop,product_id=product,location_id=location,invoice_id=invoice,order_a=orders[1],line_a=lines[1],order_b=orders[2],line_b=lines[2];
end;$$;
