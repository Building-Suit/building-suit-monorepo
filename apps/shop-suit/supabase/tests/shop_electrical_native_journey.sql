-- Companion contract proof for electrical-native.spec.ts. The owned schema
-- harness provides BEGIN/ROLLBACK and explicit provider stand-ins; this is NOT
-- native Auth/browser acceptance. Business writes use authenticated public RPCs.
create temporary table native_electrical_actor as select gen_random_uuid() owner_id,gen_random_uuid() outsider_id;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select actor.id,actor.id::text||'@native-electrical.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from (select owner_id id from native_electrical_actor union all select outsider_id from native_electrical_actor) actor;
select set_config('request.jwt.claim.sub',owner_id::text,true),set_config('request.jwt.claim.role','authenticated',true) from native_electrical_actor;
set local role authenticated;
do $$
declare
 shop uuid; loc uuid; other_loc uuid; staff uuid; vendor uuid; cable uuid; copper uuid; breaker uuid;
 purchase_id uuid; purchase_request uuid; purchase_lines jsonb; first_sale uuid; second_sale uuid;
 checkout_request uuid:=gen_random_uuid(); issue_request uuid:=gen_random_uuid(); payment_request uuid:=gen_random_uuid(); appointment_request uuid:=gen_random_uuid();
 paid_at timestamptz:=now(); first_receipt jsonb; second_receipt jsonb; input record;
begin
 shop:=public.create_owner_shop('Native electrical contract proof','mixed'::public.business_mode);
 if public.shop_cash_policy(shop) then raise exception 'Fresh fixture unexpectedly requires a shift; do not override policy';end if;
 select id into strict loc from public.shop_locations where shop_id=shop and is_default;
 select id into strict staff from public.shop_memberships where shop_id=shop and role='owner';
 other_loc:=public.save_shop_location(shop,null,'Other native fixture branch','N2',null,null);
 vendor:=public.save_vendor(shop,null,'Native electrical supplier',null,null,null,null,null,null);
 cable:=public.save_product(shop,null,'Native cable','NATIVE-cable',null,35);
 copper:=public.save_product(shop,null,'Native copper','NATIVE-copper',null,200);
 breaker:=public.save_product(shop,null,'Native breaker','NATIVE-breaker',null,150);
 perform public.configure_product_measurement(shop,cable,'m','0.001','["m","cm"]','New native fixture cable');
 perform public.configure_product_measurement(shop,copper,'kg','0.001','["kg","g"]','New native fixture copper');
 perform public.configure_product_measurement(shop,breaker,'ea','1','["ea"]','New native fixture breaker');
 for input in select * from (values(cable,'100',25,'m',1),(cable,'100',30,'m',0),(copper,'5',100,'kg',0),(breaker,'10',100,'ea',0)) as items(product,quantity,cost,unit,days_ago) loop
  purchase_request:=gen_random_uuid();
  purchase_lines:=jsonb_build_array(jsonb_build_object('product_id',input.product,'quantity',input.quantity,'unit_cost',input.cost,'unit_code',input.unit,'measurement_revision',1));
  purchase_id:=public.create_supplier_purchase(purchase_request,shop,vendor,purchase_request::text,current_date-input.days_ago,null,purchase_lines);
  if public.create_supplier_purchase(purchase_request,shop,vendor,purchase_request::text,current_date-input.days_ago,null,purchase_lines)<>purchase_id then raise exception 'Native fixture purchase replay mismatch';end if;
 end loop;
 if (select quantity_on_hand from public.product_stock where product_id=cable)<>200 or (select inventory_value from public.product_stock where product_id=cable)<>5500 then raise exception 'Native two-batch opening stock differs';end if;
 first_sale:=public.save_pos_sale_draft(gen_random_uuid(),shop,loc,null,staff,null,null,null,jsonb_build_array(
  jsonb_build_object('item_type','product','source_id',cable,'quantity','12.5','unit_code','m','measurement_revision',1),
  jsonb_build_object('item_type','product','source_id',copper,'quantity','250','unit_code','g','measurement_revision',1),
  jsonb_build_object('item_type','product','source_id',breaker,'quantity','2','unit_code','ea','measurement_revision',1)));
 perform public.checkout_pos_sale(checkout_request,issue_request,payment_request,appointment_request,shop,loc,first_sale,787.5,paid_at,'cash',null);
 if public.checkout_pos_sale(checkout_request,issue_request,payment_request,appointment_request,shop,loc,first_sale,787.5,paid_at,'cash',null)<>first_sale then raise exception 'Native checkout replay mismatch';end if;
 first_receipt:=public.get_location_sale_receipt(shop,loc,first_sale);
 if (first_receipt->>'total')::numeric<>787.5 or jsonb_array_length(first_receipt->'payments')<>1 or (first_receipt#>>'{payments,0,amount}')::numeric<>787.5 then raise exception 'Native checkout receipt/payment differs';end if;
 if not exists(select 1 from jsonb_array_elements(first_receipt->'lines') item where item#>>'{measurement,enteredUnitCode}'='g' and item#>>'{measurement,enteredQuantity}'='250' and item#>>'{measurement,baseQuantity}'='0.25') then raise exception 'Native gram conversion snapshot differs';end if;
 if (select quantity_on_hand from public.product_stock where product_id=cable)<>187.5 or (select inventory_value from public.product_stock where product_id=cable)<>5187.5
 or (select quantity_on_hand from public.product_stock where product_id=copper)<>4.75 or (select inventory_value from public.product_stock where product_id=copper)<>475
 or (select quantity_on_hand from public.product_stock where product_id=breaker)<>8 or (select inventory_value from public.product_stock where product_id=breaker)<>800 then raise exception 'Native mixed sale stock/value differs';end if;
 second_sale:=public.save_pos_sale_draft(gen_random_uuid(),shop,loc,null,staff,null,null,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','100','unit_code','m','measurement_revision',1)));
 perform public.checkout_pos_sale(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),shop,loc,second_sale,3500,paid_at,'cash',null);
 if (select count(distinct batch_id) from public.inventory_movements where reference_id=second_sale and product_id=cable and movement_type='out')<>2
 or (select sum(-quantity_change*unit_cost_snapshot) from public.inventory_movements where reference_id=second_sale and product_id=cable and movement_type='out')<>2562.5
 or not exists(select 1 from public.inventory_movements where reference_id=second_sale and product_id=cable and quantity_change=-87.5 and unit_cost_snapshot=25)
 or not exists(select 1 from public.inventory_movements where reference_id=second_sale and product_id=cable and quantity_change=-12.5 and unit_cost_snapshot=30) then raise exception 'Native crossing FIFO lineage differs';end if;
 if (select quantity_on_hand from public.product_stock where product_id=cable)<>87.5 or (select inventory_value from public.product_stock where product_id=cable)<>2625 then raise exception 'Native final cable stock/value differs';end if;
 second_receipt:=public.get_location_sale_receipt(shop,loc,second_sale);
 perform public.save_product(shop,cable,'Native cable','NATIVE-cable',null,99);
 if public.get_location_sale_receipt(shop,loc,first_sale) is distinct from first_receipt or public.get_location_sale_receipt(shop,loc,second_sale) is distinct from second_receipt then raise exception 'Native historical receipt changed after catalog edit';end if;
 if public.get_location_sale_receipt(shop,other_loc,first_sale) is not null then raise exception 'Native receipt crossed location';end if;
 perform set_config('native_electrical.shop',shop::text,true);
 perform set_config('native_electrical.sale',first_sale::text,true);
 perform set_config('native_electrical.location',loc::text,true);
 perform set_config('native_electrical.cable',cable::text,true);
end;
$$;
reset role;
select set_config('request.jwt.claim.sub',outsider_id::text,true) from native_electrical_actor;
set local role authenticated;
do $$begin
 perform public.create_owner_shop('Separate native fixture tenant','product'::public.business_mode);
 begin
  perform public.get_location_sale_receipt(current_setting('native_electrical.shop')::uuid,current_setting('native_electrical.location')::uuid,current_setting('native_electrical.sale')::uuid);
  raise exception 'Native cross-tenant receipt read accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.configure_product_measurement(current_setting('native_electrical.shop')::uuid,current_setting('native_electrical.cable')::uuid,'m','0.001','["m","cm"]','Forbidden cross-tenant write');
  raise exception 'Native cross-tenant measurement write accepted';
 exception when insufficient_privilege then null;end;
 if exists(select 1 from public.product_stock where shop_id=current_setting('native_electrical.shop')::uuid) then raise exception 'Native stock view crossed tenant';end if;
end;$$;
reset role;
set constraints all immediate;
