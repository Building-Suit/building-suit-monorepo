create temporary table reservation_actors as select gen_random_uuid() owner,gen_random_uuid() outsider;
grant select on reservation_actors to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@reservation.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from(select owner id from reservation_actors union all select outsider from reservation_actors)i;
create function pg_temp.reservation_order(shop uuid,location uuid,customer uuid,product uuid,quantity text,split boolean default false) returns jsonb
language plpgsql set search_path='' as $$declare q jsonb;o jsonb;begin
 q:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,jsonb_build_object('customerId',customer,'validUntil',clock_timestamp()+interval '7 days','orderDiscount','0',
 'lines',jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',quantity,'unit_code','m','measurement_revision',1,'allow_split',split))),'Reservation offer fixture');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',(q->>'id')::uuid,1,'{}','Issue reservation offer');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'accept',(q->>'id')::uuid,2,'{}','Accept reservation offer');
 o:=public.create_trade_order(gen_random_uuid(),shop,location,(q->>'id')::uuid,3,'Create order to reserve material');
 return o||jsonb_build_object('lineId',public.trade_order_context(shop,location,(o->>'id')::uuid)#>>'{detail,lines,0,id}');
end;$$;
grant execute on function pg_temp.reservation_order(uuid,uuid,uuid,uuid,text,boolean) to authenticated;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from reservation_actors;
set local role authenticated;
do $$declare shop uuid;location uuid;staff uuid;customer uuid;vendor uuid;bulk uuid;cable uuid;pack uuid;invoice uuid;order_id uuid;line_id uuid;order_two uuid;line_two uuid;
 multi_product uuid;multi_order uuid;multi_lines jsonb;quote jsonb;r jsonb;again jsonb;context jsonb;args jsonb;expiry timestamptz:=clock_timestamp()+interval '1 day';op uuid:=gen_random_uuid();reel uuid;revision integer;begin
 shop:=public.create_owner_shop('Reservation merchant','multi','mixed');
 select id into location from public.shop_locations where shop_id=shop and is_default;
 select id into staff from public.shop_memberships where shop_id=shop and role='owner';
 customer:=public.save_customer(shop,null,'Reserved material contractor',null,null,null,null);
 vendor:=public.save_vendor(shop,null,'Reservation supplier',null,null,null,null,null,null);
 bulk:=public.save_product(shop,null,'Pooled measured cable','RES-BULK',null,35);
 perform public.configure_product_measurement(shop,bulk,'m','0.001','["m","cm"]','Bulk reservation stock unit');
 perform public.adjust_stock(gen_random_uuid(),shop,bulk,200,20,'Reservation opening stock');
 r:=pg_temp.reservation_order(shop,location,customer,bulk,'80');order_id:=(r->>'id')::uuid;line_id:=(r->>'lineId')::uuid;
 args:=jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','80'));
 r:=public.reserve_trade_order(op,shop,location,order_id,1,'reserve',args,expiry,'Hold contractor collection material');
 again:=public.reserve_trade_order(op,shop,location,order_id,1,'reserve',args,expiry,'Hold contractor collection material');
 if again<>r then raise exception 'Reservation retry changed result';end if;
 context:=public.trade_order_reservation_context(shop,location,order_id);
 if context#>>'{stock,0,onHand}' is distinct from '200' or context#>>'{stock,0,reserved}' is distinct from '80' or context#>>'{stock,0,available}' is distinct from '120'
 or (context->>'total')::integer<>1 then raise exception '200 on hand /80 reserved /120 available failed: %',context;end if;
 r:=public.pos_catalog_search(p_shop_id=>shop,p_location_id=>location,p_search=>'RES-BULK');
 if r#>>'{items,0,stockOnHand}'<>'200' or r#>>'{items,0,stockReserved}'<>'80' or (r#>>'{items,0,stock}')::numeric<>120 then raise exception 'Cashier pooled availability omitted held stock: %',r;end if;
 if exists(select 1 from public.invoices where shop_id=shop) or exists(select 1 from public.payments where shop_id=shop) then raise exception 'Reservation created financial entries';end if;
 begin perform public.reserve_trade_order(op,shop,location,order_id,1,'reserve',args,expiry,'Conflicting retry reason');raise exception 'Conflicting reserve request accepted';exception when unique_violation then if sqlerrm<>'ORDER_REQUEST_CONFLICT' then raise;end if;end;
 begin perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,2,'reserve',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','81')),expiry,'Attempt excess line quantity');raise exception 'Over-order reservation accepted';exception when invalid_parameter_value then if sqlerrm<>'ORDER_RESERVATION_EXCEEDS_QUANTITY' then raise;end if;end;
 if public.trade_order_reservation_context(shop,location,order_id)#>>'{stock,0,reserved}'<>'80' then raise exception 'Failed replacement lost existing hold';end if;
 -- Ordinary sales use available FIFO stock; they cannot consume a held batch.
 invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',bulk,'quantity','121','unit_code','m','measurement_revision',1)));
 begin perform public.issue_location_sale(gen_random_uuid(),shop,location,invoice);raise exception 'Cashier consumed held material';exception when check_violation then if sqlerrm<>'INSUFFICIENT_STOCK' then raise;end if;end;
 if public.trade_order_reservation_context(shop,location,order_id)#>>'{stock,0,onHand}'<>'200' or (select status::text from public.invoices where id=invoice)<>'draft' then raise exception 'Failed held-stock sale partly committed';end if;
 invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',bulk,'quantity','120','unit_code','m','measurement_revision',1)));
 perform public.issue_location_sale(gen_random_uuid(),shop,location,invoice);
 context:=public.trade_order_reservation_context(shop,location,order_id);
 if context#>>'{stock,0,onHand}'<>'80' or context#>>'{stock,0,reserved}'<>'80' or context#>>'{stock,0,available}'<>'0' then raise exception 'FIFO did not preserve reserved remainder';end if;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,2,'release','[]',null,'Customer postpones collection');
 if public.trade_order_reservation_context(shop,location,order_id)#>>'{stock,0,available}'<>'80' then raise exception 'Release did not restore capacity';end if;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,3,'cancel','[]',null,'Customer cancels unfulfilled order');
 if public.trade_order_context(shop,location,order_id)#>>'{detail,record,status}'<>'cancelled' then raise exception 'Order cancellation not recorded';end if;
 -- Repeated SKU lines share capacity inside the same atomic replacement.
 multi_product:=public.save_product(shop,null,'Shared multiline stock','RES-MULTI',null,35);
 perform public.configure_product_measurement(shop,multi_product,'m','0.001','["m"]','Multiline measured setup');
 perform public.adjust_stock(gen_random_uuid(),shop,multi_product,100,20,'Multiline opening stock');
 quote:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,jsonb_build_object('customerId',customer,'validUntil',clock_timestamp()+interval '7 days','orderDiscount','0','lines',jsonb_build_array(
 jsonb_build_object('item_type','product','source_id',multi_product,'quantity','80','unit_code','m','measurement_revision',1),
 jsonb_build_object('item_type','product','source_id',multi_product,'quantity','80','unit_code','m','measurement_revision',1))),'Repeated SKU quotation fixture');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',(quote->>'id')::uuid,1,'{}','Issue multiline offer');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'accept',(quote->>'id')::uuid,2,'{}','Accept multiline offer');
 r:=public.create_trade_order(gen_random_uuid(),shop,location,(quote->>'id')::uuid,3,'Create multiline reservation order');multi_order:=(r->>'id')::uuid;
 select jsonb_agg(jsonb_build_object('lineId',value->>'id','quantity','80')) into multi_lines from jsonb_array_elements(public.trade_order_context(shop,location,multi_order)#>'{detail,lines}');
 begin
  perform public.reserve_trade_order(gen_random_uuid(),shop,location,multi_order,1,'reserve',multi_lines,expiry,'Attempt duplicated SKU overallocation');
  raise exception 'Repeated SKU lines over-reserved the same capacity';
 exception when check_violation then if sqlerrm<>'INSUFFICIENT_AVAILABLE_STOCK' then raise;end if;end;
 if (public.trade_order_reservation_context(shop,location,multi_order)->>'total')::integer<>0 then raise exception 'Failed multiline reserve retained partial holds';end if;
 select jsonb_agg(value||jsonb_build_object('quantity','40')) into multi_lines from jsonb_array_elements(multi_lines);
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,multi_order,1,'reserve',multi_lines,expiry,'Reserve feasible repeated SKU quantities');
 if public.trade_order_reservation_context(shop,location,multi_order)#>>'{stock,0,reserved}'<>'80' then raise exception 'Multiline capacity was not shared';end if;
 select jsonb_agg(value||jsonb_build_object('quantity','30')) into multi_lines from jsonb_array_elements(multi_lines);
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,multi_order,2,'reserve',multi_lines,expiry,'Replace every repeated SKU hold together');
 if public.trade_order_reservation_context(shop,location,multi_order)#>>'{stock,0,reserved}'<>'60' then raise exception 'Replacement counted released holds';end if;
 -- A fresh short reservation expires by real time; a later statement checks
 -- availability without requiring any scheduled database write.
 r:=pg_temp.reservation_order(shop,location,customer,bulk,'80');order_two:=(r->>'id')::uuid;line_two:=(r->>'lineId')::uuid;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_two,1,'reserve',jsonb_build_array(jsonb_build_object('lineId',line_two,'quantity','80')),clock_timestamp()+interval '2 seconds','Short reservation expiry fixture');
 perform set_config('reservation_test.shop',shop::text,true);perform set_config('reservation_test.location',location::text,true);perform set_config('reservation_test.order',order_two::text,true);
 -- Two physical50m reels cannot promise one continuous80m source.
 cable:=public.save_product(shop,null,'Reserved physical cable','RES-REEL',null,35);
 perform public.configure_product_measurement(shop,cable,'m','0.001','["m"]','Physical reservation stock unit');
 perform public.save_product_technical_details(shop,cable,0,null,'{}',true,'Track reserved source reels');
 pack:=public.save_product_packaging(gen_random_uuid(),shop,cable,null,'{"code":"RES50","name":"50m reel","unitCode":"reel","containedQuantity":"50","containedUnitCode":"m","canPurchase":true,"canSell":true}');
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'RES-RECEIPT',current_date,null,jsonb_build_array(jsonb_build_object('product_id',cable,'quantity','2','unit_cost',1000,'package_id',pack,'package_version',1,'measurement_revision',1)));
 r:=pg_temp.reservation_order(shop,location,customer,cable,'80');order_id:=(r->>'id')::uuid;line_id:=(r->>'lineId')::uuid;
 begin perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,1,'reserve',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','80')),expiry,'Attempt impossible continuous promise');raise exception 'Two50m reels reserved as continuous80m';exception when check_violation then if sqlerrm<>'CONTINUOUS_LENGTH_UNAVAILABLE' then raise;end if;end;
 if (public.trade_order_reservation_context(shop,location,order_id)->>'total')::integer<>0 then raise exception 'Failed continuous reservation left a partial hold';end if;
 r:=pg_temp.reservation_order(shop,location,customer,cable,'80',true);order_id:=(r->>'id')::uuid;line_id:=(r->>'lineId')::uuid;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,1,'reserve',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','80')),expiry,'Hold separately accepted cable pieces');
 context:=public.trade_order_reservation_context(shop,location,order_id);
 if (context->>'total')::integer<>2 or context#>>'{stock,0,reserved}'<>'80' or context#>>'{stock,0,available}'<>'20' then raise exception 'Split source reservation did not reconcile';end if;
 r:=public.pos_reel_options(shop,location,cable);
 if r#>>'{summary,reserved}'<>'80' or r#>>'{summary,available}'<>'20' or (r->>'total')::integer<>1 or r#>>'{items,0,remainingLength}'<>'20' or r#>>'{items,0,onHandLength}'<>'50' or r#>>'{items,0,reservedLength}'<>'30' then raise exception 'Cashier reel availability omitted holds: %',r;end if;
 r:=public.pos_catalog_search(p_shop_id=>shop,p_location_id=>location,p_search=>'RES-REEL');
 if (r#>>'{items,0,stock}')::numeric<>20 or r#>>'{items,0,reelSummary,largestContinuous}'<>'20' then raise exception 'Physical cashier catalog promised held stock: %',r;end if;
 invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','20','unit_code','m','measurement_revision',1)));
 perform public.issue_location_sale(gen_random_uuid(),shop,location,invoice);
 context:=public.trade_order_reservation_context(shop,location,order_id);
 if context#>>'{stock,0,onHand}'<>'80' or context#>>'{stock,0,reserved}'<>'80' then raise exception 'Physical cashier used held source length';end if;
 select (value->>'reel_id')::uuid into reel from jsonb_array_elements(context->'items') where (value->>'remaining_sale_quantity')::numeric=30;
 select r.revision into revision from public.inventory_reels r where r.id=reel;
 begin
  perform public.update_inventory_reel(gen_random_uuid(),shop,location,reel,revision,'count',jsonb_build_object('quantity','25','countedAt',clock_timestamp(),'reference','RES-COUNT'),'Count would remove reserved length');
  set constraints order_reservation_capacity,order_reservation_batch_capacity,order_reservation_reel_capacity immediate;
  raise exception 'Count removed promised physical stock';
 exception when check_violation then if sqlerrm not in('STOCK_RESERVED_FOR_ORDER','REEL_RESERVED_FOR_ORDER') then raise;end if;end;
 set constraints order_reservation_capacity,order_reservation_batch_capacity,order_reservation_reel_capacity deferred;
 if public.trade_order_reservation_context(shop,location,order_id)#>>'{stock,0,onHand}'<>'80' then raise exception 'Blocked count did not roll back';end if;
 begin
  perform public.update_inventory_reel(gen_random_uuid(),shop,location,reel,revision,'classify','{"classification":"scrap"}','Attempt scrapping held source');
  set constraints order_reservation_capacity,order_reservation_batch_capacity,order_reservation_reel_capacity immediate;
  raise exception 'Scrap removed promised physical stock';
 exception when check_violation then if sqlerrm not in('STOCK_RESERVED_FOR_ORDER','REEL_RESERVED_FOR_ORDER') then raise;end if;end;
 set constraints order_reservation_capacity,order_reservation_batch_capacity,order_reservation_reel_capacity deferred;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,2,'cancel','[]',null,'Cancel split material collection');
 if public.trade_order_reservation_context(shop,location,order_id)#>>'{stock,0,available}'<>'80' then raise exception 'Cancellation retained physical holds';end if;
 if has_function_privilege('authenticated','shop_private.reserved_batch_quantity(uuid)','execute') or has_table_privilege('authenticated','public.trade_order_reservations','insert') then raise exception 'Private reservation capacity exposed';end if;
 perform set_config('request.jwt.claim.sub',(select outsider::text from reservation_actors),true);
 begin perform public.trade_order_reservation_context(shop,location,order_id);raise exception 'Outsider reservation read';exception when insufficient_privilege then null;end;
 begin perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,3,'release','[]',null,'Outsider release');raise exception 'Outsider released stock';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',(select owner::text from reservation_actors),true);
end;$$;
select pg_sleep(2.1);
do $$declare shop uuid:=current_setting('reservation_test.shop')::uuid;location uuid:=current_setting('reservation_test.location')::uuid;order_id uuid:=current_setting('reservation_test.order')::uuid;r jsonb;begin
 r:=public.trade_order_reservation_context(shop,location,order_id);
 if r#>>'{stock,0,reserved}'<>'0' or r#>>'{stock,0,available}'<>'80' or r#>>'{items,0,status}'<>'expired' then raise exception 'Expiry did not release available capacity';end if;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,2,'expire','[]',null,'Record elapsed reservation deadline');
 if public.trade_order_reservation_context(shop,location,order_id)#>>'{history,0,action}'<>'expire' then raise exception 'Expiry release audit missing';end if;
end;$$;
reset role;
-- Exercise every deferred capacity check before the fixture rollback.
set constraints order_reservation_capacity,order_reservation_batch_capacity,order_reservation_reel_capacity immediate;
