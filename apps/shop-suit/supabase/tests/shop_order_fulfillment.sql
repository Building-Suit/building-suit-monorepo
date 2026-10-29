create temporary table collection_actors as select gen_random_uuid() owner,gen_random_uuid() outsider,gen_random_uuid() cashier;
grant select on collection_actors to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@order-collection.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from(select owner id from collection_actors union all select outsider from collection_actors union all select cashier from collection_actors)a;
create function pg_temp.collection_order(shop uuid,location uuid,customer uuid,product uuid,quantity text,split boolean default false,discount text default '0',pack uuid default null) returns jsonb
language plpgsql set search_path='' as $$declare q jsonb;o jsonb;begin
 q:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,jsonb_build_object('customerId',customer,'validUntil',clock_timestamp()+interval '7 days','orderDiscount',discount,
 'lines',jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',quantity,'unit_code','m','measurement_revision',1,'allow_split',split)||case when pack is null then '{}'::jsonb else jsonb_build_object('package_id',pack,'package_version',1) end)),'Collection agreement fixture');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',(q->>'id')::uuid,1,'{}','Issue collection offer');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'accept',(q->>'id')::uuid,2,'{}','Accept collection offer');
 o:=public.create_trade_order(gen_random_uuid(),shop,location,(q->>'id')::uuid,3,'Create material collection order');
 return o||jsonb_build_object('lineId',public.trade_order_context(shop,location,(o->>'id')::uuid)#>>'{detail,lines,0,id}');
end;$$;
grant execute on function pg_temp.collection_order(uuid,uuid,uuid,uuid,text,boolean,text,uuid) to authenticated;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from collection_actors;
set local role authenticated;
do $$declare shop uuid;location uuid;customer uuid;product uuid;order_id uuid;line_id uuid;invoice uuid;second_invoice uuid;allocation uuid;payment uuid;child uuid;op uuid:=gen_random_uuid();
 args jsonb;r jsonb;again jsonb;context jsonb;snapshot jsonb;expiry timestamptz:=clock_timestamp()+interval '1 day';begin
 shop:=public.create_owner_shop('Partial collection merchant','multi','mixed');
 select id into location from public.shop_locations where shop_id=shop and is_default;
 customer:=public.save_customer(shop,null,'Collection contractor',null,null,null,null);
 product:=public.save_product(shop,null,'Agreed collection cable','COLLECT-500',null,35);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m"]','Collection stock unit');
 perform public.adjust_stock(gen_random_uuid(),shop,product,600,20,'Collection opening stock');
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp(),'{"enabled":true,"default":{"treatment":"vat","rate":14,"priceMode":"exclusive","subtype":"V009"},"items":[]}','Agreed collection VAT');
 r:=pg_temp.collection_order(shop,location,customer,product,'500');order_id:=(r->>'id')::uuid;line_id:=(r->>'lineId')::uuid;
 r:=public.trade_order_deposit(gen_random_uuid(),shop,location,order_id,1,'receive','5000',clock_timestamp(),'bank_transfer',null,null,'DEP-500','Contractor collection advance');allocation:=(r->>'resultId')::uuid;payment:=(r->>'paymentId')::uuid;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,2,'reserve',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','500')),expiry,'Hold all agreed collection stock');
 perform public.save_product(shop,product,'Current catalog rename','COLLECT-500',null,99);
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp(),'{"enabled":true,"default":{"treatment":"vat","rate":20,"priceMode":"exclusive","subtype":"V009"},"items":[]}','Later catalog VAT');
 args:=jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','200'));
 r:=public.fulfill_trade_order(op,shop,location,order_id,3,args,true,'First contractor collection');invoice:=(r->>'invoiceId')::uuid;
 again:=public.fulfill_trade_order(op,shop,location,order_id,3,args,true,'First contractor collection');
 if again is distinct from r or r->>'status' is distinct from 'partially_fulfilled' or r->>'appliedDeposit' is distinct from '5000' then raise exception 'Partial collection retry/status mismatch: %',r;end if;
 if (select sum(remaining_quantity) from public.inventory_batches where product_id=product) is distinct from 400::numeric then raise exception 'First collection deducted stock twice';end if;
 context:=public.trade_order_reservation_context(shop,location,order_id);
 if context#>>'{stock,0,fulfilledQuantity}' is distinct from '200' or context#>>'{stock,0,remainingQuantity}' is distinct from '300' or context#>>'{stock,0,orderReserved}' is distinct from '300' or context#>>'{stock,0,available}' is distinct from '100' then raise exception 'Pending collection holds not preserved: %',context;end if;
 snapshot:=public.get_sale_tax_snapshot(shop,invoice);
 if (snapshot->>'total')::numeric is distinct from 7980::numeric or (snapshot->>'tax')::numeric is distinct from 980::numeric or snapshot->>'source' is distinct from 'accepted-order-delivery'
 or (select unit_price from public.invoice_items where invoice_id=invoice) is distinct from 35::numeric or (select item_name from public.invoice_items where invoice_id=invoice) is distinct from 'Agreed collection cable'
 then raise exception 'Collection repriced accepted price/name/tax: %',snapshot;end if;
 if public.get_location_sale(shop,location,invoice)->>'status' is distinct from 'issued' then raise exception 'Collection invoice not issued';end if;
 context:=public.trade_order_funding_context(shop,location,order_id);
 if context->>'unapplied' is distinct from '0' or context#>>'{invoices,0,outstanding}' is distinct from '2980' then raise exception 'Deposit not applied to ordinary invoice debt: %',context;end if;
 begin perform public.trade_order_deposit(gen_random_uuid(),shop,location,order_id,4,'refund','100',clock_timestamp(),'bank_transfer',allocation,null,null,'Attempt refund already applied advance');raise exception 'Applied deposit reused as unapplied cash';exception when check_violation then if sqlerrm<>'ADVANCE_AMOUNT_UNAVAILABLE' then raise;end if;end;
 -- Existing invoice refund commands remain authoritative after application.
 select id into child from public.customer_payment_allocations where source_allocation_id=allocation;
 perform public.refund_customer_receipt(gen_random_uuid(),shop,payment,clock_timestamp(),'bank_transfer',null,'Refund allocated collection amount',jsonb_build_array(jsonb_build_object('allocation_id',child,'amount',100)));
 context:=public.trade_order_funding_context(shop,location,order_id);
 if context->>'unapplied' is distinct from '0' or context->>'depositsNet' is distinct from '4900' or context#>>'{invoices,0,outstanding}' is distinct from '3080' then raise exception 'Allocated refund replenished spent advance or lost invoice debt: %',context;end if;
 perform public.trade_order_deposit(gen_random_uuid(),shop,location,order_id,4,'receive','1000',clock_timestamp(),'bank_transfer',null,null,'DEP-REMAINDER','Advance toward remaining collection');
 r:=public.fulfill_trade_order(gen_random_uuid(),shop,location,order_id,5,jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','300')),true,'Final contractor collection');second_invoice:=(r->>'invoiceId')::uuid;
 if r->>'status' is distinct from 'fulfilled' or r->>'appliedDeposit' is distinct from '1000' then raise exception 'Final collection state wrong: %',r;end if;
 if (select count(*) from public.invoices where shop_id=shop)<>2 or (select sum(total_amount) from public.invoices where shop_id=shop) is distinct from 19950::numeric
 or (select sum(remaining_quantity) from public.inventory_batches where product_id=product) is distinct from 100::numeric then raise exception 'Final invoices or stock do not reconcile';end if;
 if (select sum(-quantity_change*unit_cost_snapshot) from public.inventory_movements where invoice_item_id in(select id from public.invoice_items where invoice_id in(invoice,second_invoice))) is distinct from 10000::numeric then raise exception 'Order collection lost original FIFO cost';end if;
 context:=public.trade_order_reservation_context(shop,location,order_id);
 if context#>>'{stock,0,remainingQuantity}' is distinct from '0' or context#>>'{stock,0,reserved}' is distinct from '0' then raise exception 'Completed collection retained stock hold';end if;
 begin perform public.fulfill_trade_order(gen_random_uuid(),shop,location,order_id,6,jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','1')),false,'Attempt duplicate completed collection');raise exception 'Completed collection issued again';exception when sqlstate '55000' then if sqlerrm<>'ORDER_DELIVERY_STATE_DENIED' then raise;end if;end;
 perform set_config('collection_test.shop',shop::text,true);perform set_config('collection_test.location',location::text,true);perform set_config('collection_test.customer',customer::text,true);
 perform set_config('request.jwt.claim.sub',(select outsider::text from collection_actors),true);
 begin perform public.fulfill_trade_order(gen_random_uuid(),shop,location,order_id,6,'[]',false,'Outsider collection');raise exception 'Outsider issued collection';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',(select owner::text from collection_actors),true);
end;$$;
-- Two partial visits with cutting loss must preserve the pending promise on
-- the original physical sources while reallocating the remaining split pieces.
do $$declare shop uuid:=current_setting('collection_test.shop')::uuid;location uuid:=current_setting('collection_test.location')::uuid;customer uuid:=current_setting('collection_test.customer')::uuid;
 product uuid;vendor uuid;pack uuid;order_id uuid;line_id uuid;invoice uuid;invoice_line uuid;returned uuid;original_reel uuid;return_lines jsonb;plan jsonb;r jsonb;context jsonb;begin
 product:=public.save_product(shop,null,'Partial split cable','COLLECT-SPLIT',null,35);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m"]','Split collection stock unit');
 perform public.save_product_technical_details(shop,product,0,null,'{}',true,'Track split collection source');
 vendor:=public.save_vendor(shop,null,'Split source supplier',null,null,null,null,null,null);
 pack:=public.save_product_packaging(gen_random_uuid(),shop,product,null,'{"code":"COLLECT50","name":"50m source","unitCode":"reel","containedQuantity":"50","containedUnitCode":"m","canPurchase":true,"canSell":true}');
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'COLLECT-SOURCES',current_date,null,jsonb_build_array(jsonb_build_object('product_id',product,'quantity','2','unit_cost',1000,'package_id',pack,'package_version',1,'measurement_revision',1)));
 r:=pg_temp.collection_order(shop,location,customer,product,'80',true);order_id:=(r->>'id')::uuid;line_id:=(r->>'lineId')::uuid;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,1,'reserve',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','80','cuttingLoss','2')),clock_timestamp()+interval '1 day','Hold split sources and cutting allowance');
 perform public.fulfill_trade_order(gen_random_uuid(),shop,location,order_id,2,jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','40','cuttingLoss','1')),false,'First split collection and cut');
 context:=public.trade_order_reservation_context(shop,location,order_id);
 if context#>>'{stock,0,onHand}' is distinct from '59' or context#>>'{stock,0,reserved}' is distinct from '41' or context#>>'{stock,0,orderReserved}' is distinct from '40' or context#>>'{stock,0,available}' is distinct from '18' then raise exception 'Partial cut lost or overbooked pending sources: %',context;end if;
 r:=public.fulfill_trade_order(gen_random_uuid(),shop,location,order_id,3,jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','40','cuttingLoss','1')),false,'Final split collection and cut');invoice:=(r->>'invoiceId')::uuid;
 context:=public.trade_order_reservation_context(shop,location,order_id);
 if context#>>'{stock,0,onHand}' is distinct from '18' or context#>>'{stock,0,reserved}' is distinct from '0' or context->>'status' is distinct from 'fulfilled' then raise exception 'Split collection stock did not reconcile: %',context;end if;
 if (select sum(cutting_loss) from public.inventory_reel_cuts c join public.inventory_reels reel on reel.id=c.reel_id where reel.product_id=product) is distinct from 2::numeric then raise exception 'Physical cutting loss deducted twice or omitted';end if;
 select id into invoice_line from public.invoice_items where invoice_id=invoice;
 if (select measurement_snapshot->>'physicalConsumedQuantity' from public.invoice_items where id=invoice_line) is distinct from '41' then raise exception 'Collection receipt lost physical consumption';end if;
 -- A later catalogue policy never removes the approval frozen by this cut.
 perform public.save_product_technical_details(shop,product,1,null,'{}',true,'Future permissive return policy','{"unopenedResellable":true,"cutRequiresManagerApproval":false}');
 return_lines:=jsonb_build_array(jsonb_build_object('lineId',invoice_line,'quantity',1,'disposition','resellable'));
 begin perform public.preview_sale_return(shop,location,invoice,return_lines);raise exception 'Collection cut returned without frozen approval';exception when insufficient_privilege then if sqlerrm<>'REEL_CUT_RETURN_APPROVAL_REQUIRED' then raise;end if;end;
 return_lines:=jsonb_build_array(jsonb_build_object('lineId',invoice_line,'quantity',1,'disposition','resellable','approveCut',true));
 plan:=public.preview_sale_return(shop,location,invoice,return_lines);
 if (plan->>'total')::numeric<>42 or (plan->>'tax')::numeric<>7 then raise exception 'Delivery return lost frozen twenty-percent tax: %',plan;end if;
 returned:=public.create_sale_return(gen_random_uuid(),shop,location,invoice,return_lines,'Approved collection cut return',plan);
 if not exists(select 1 from public.inventory_reels where source_return_id=returned and remaining_length=1)
 or (select sum(remaining_length) from public.inventory_reels where product_id=product and source_return_id is null)<>18
 or (select b.unit_cost from public.inventory_batches b join public.inventory_reels reel on reel.batch_id=b.id where reel.source_return_id=returned)<>20 then raise exception 'Collection return spliced original sources or lost original FIFO cost';end if;
 context:=public.trade_order_delivery_context(shop,location,order_id);
 if context->>'status'<>'fulfilled' or context#>>'{lines,0,deliveredQuantity}'<>'80' then raise exception 'Return silently reopened the fulfilled agreement';end if;

end;$$;
-- Per-visit rounding must reconcile to the accepted document, rather than
-- independently repricing each one-meter collection at the current tax policy.
do $$declare shop uuid:=current_setting('collection_test.shop')::uuid;location uuid:=current_setting('collection_test.location')::uuid;customer uuid:=current_setting('collection_test.customer')::uuid;
 product uuid;order_id uuid;line_id uuid;r jsonb;invoice uuid;sum_total numeric:=0;sum_tax numeric:=0;sum_discount numeric:=0;snap jsonb;i integer;begin
 product:=public.save_product(shop,null,'Rounding cable','COLLECT-ROUND',null,0.10);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m"]','Rounding collection stock unit');
 perform public.adjust_stock(gen_random_uuid(),shop,product,3,0.02,'Rounding collection opening');
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp(),'{"enabled":true,"default":{"treatment":"vat","rate":14,"priceMode":"exclusive","subtype":"V009"},"items":[]}','Agreed rounding VAT');
 r:=pg_temp.collection_order(shop,location,customer,product,'3',false,'0.01');order_id:=(r->>'id')::uuid;line_id:=(r->>'lineId')::uuid;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,1,'reserve',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','3')),clock_timestamp()+interval '1 day','Reserve rounding collections');
 for i in 1..3 loop
  r:=public.fulfill_trade_order(gen_random_uuid(),shop,location,order_id,i+1,jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','1')),false,'Rounding collection visit');invoice:=(r->>'invoiceId')::uuid;
  snap:=public.get_sale_tax_snapshot(shop,invoice);sum_total:=sum_total+(snap->>'total')::numeric;sum_tax:=sum_tax+(snap->>'tax')::numeric;sum_discount:=sum_discount+(snap->>'orderDiscount')::numeric;
  if (snap#>>'{lines,0,net5}')::numeric+(snap#>>'{lines,0,tax5}')::numeric is distinct from (snap#>>'{lines,0,total5}')::numeric then raise exception 'Partial five-decimal tax components do not reconcile';end if;
 end loop;
 if sum_total<>0.33 or sum_tax<>0.04 or sum_discount<>0.01 then raise exception 'Visit rounding lost agreed cents: total%,tax%,discount%',sum_total,sum_tax,sum_discount;end if;
end;$$;

-- Ordinary invoice settlements and returns reduce the capacity for new advances.
do $$declare shop uuid:=current_setting('collection_test.shop')::uuid;location uuid:=current_setting('collection_test.location')::uuid;customer uuid:=current_setting('collection_test.customer')::uuid;
 product uuid;order_id uuid;line_id uuid;invoice uuid;invoice_line uuid;r jsonb;context jsonb;return_lines jsonb;plan jsonb;begin
 product:=public.save_product(shop,null,'Collection balance cable','COLLECT-BALANCE',null,35);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m"]','Balance collection stock unit');
 perform public.adjust_stock(gen_random_uuid(),shop,product,10,20,'Balance collection opening');
 r:=pg_temp.collection_order(shop,location,customer,product,'10');order_id:=(r->>'id')::uuid;line_id:=(r->>'lineId')::uuid;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,1,'reserve',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','10')),clock_timestamp()+interval '1 day','Hold balance collections');
 r:=public.fulfill_trade_order(gen_random_uuid(),shop,location,order_id,2,jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','5')),false,'First balance collection');invoice:=(r->>'invoiceId')::uuid;
 perform public.record_customer_receipt(gen_random_uuid(),shop,customer,70,clock_timestamp(),'bank_transfer','ORDINARY-COLLECTION-70',null,jsonb_build_array(jsonb_build_object('invoice_id',invoice,'amount',70)));
 context:=public.trade_order_funding_context(shop,location,order_id);
 if context->>'depositCapacity'<>'329' then raise exception 'Ordinary invoice payment did not reduce advance capacity: %',context;end if;
 select id into invoice_line from public.invoice_items where invoice_id=invoice;
 return_lines:=jsonb_build_array(jsonb_build_object('lineId',invoice_line,'quantity',2,'disposition','resellable'));
 plan:=public.preview_sale_return(shop,location,invoice,return_lines);
 perform public.create_sale_return(gen_random_uuid(),shop,location,invoice,return_lines,'Return two collected meters',plan);
 context:=public.trade_order_funding_context(shop,location,order_id);
 if context->>'depositCapacity'<>'249.2' or context#>>'{invoices,0,outstanding}'<>'49.7' then raise exception 'Delivery return did not reduce advance capacity: %',context;end if;
 begin perform public.trade_order_deposit(gen_random_uuid(),shop,location,order_id,3,'receive','250',clock_timestamp(),'bank_transfer',null,null,null,'Excess after ordinary settlement and return');raise exception 'Advance ignored existing invoice payments and returns';exception when check_violation then if sqlerrm<>'ORDER_DEPOSIT_EXCEEDS_AGREEMENT' then raise;end if;end;
 perform public.trade_order_deposit(gen_random_uuid(),shop,location,order_id,3,'receive','249.20',clock_timestamp(),'bank_transfer',null,null,null,'Exact remaining agreed funding');
 if public.trade_order_funding_context(shop,location,order_id)->>'depositCapacity'<>'0' then raise exception 'Exact advance capacity did not reconcile';end if;
end;$$;
-- Whole-package collection promises cannot be split by the invoice command.
do $$declare shop uuid:=current_setting('collection_test.shop')::uuid;location uuid:=current_setting('collection_test.location')::uuid;customer uuid:=current_setting('collection_test.customer')::uuid;
 product uuid;pack uuid;order_id uuid;line_id uuid;r jsonb;context jsonb;begin
 product:=public.save_product(shop,null,'Packaged collection cable','COLLECT-PACK',null,35);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m"]','Package collection stock unit');
 pack:=public.save_product_packaging(gen_random_uuid(),shop,product,null,'{"code":"COLLECT10","name":"10m box","unitCode":"box","containedQuantity":"10","containedUnitCode":"m","canPurchase":true,"canSell":true}');
 perform public.adjust_stock(gen_random_uuid(),shop,product,30,20,'Package collection opening stock');
 r:=pg_temp.collection_order(shop,location,customer,product,'3',false,'0',pack);order_id:=(r->>'id')::uuid;line_id:=(r->>'lineId')::uuid;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,1,'reserve',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','30')),clock_timestamp()+interval '1 day','Hold three complete boxes');
 begin perform public.fulfill_trade_order(gen_random_uuid(),shop,location,order_id,2,jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','5')),false,'Attempt half-box collection');raise exception 'Partial package collection allowed';exception when invalid_parameter_value then if sqlerrm<>'WHOLE_PACKAGE_QUANTITY_REQUIRED' then raise;end if;end;
 context:=public.trade_order_reservation_context(shop,location,order_id);
 if context#>>'{stock,0,orderReserved}'<>'30' or context->>'revision'<>'2' then raise exception 'Failed package collection changed holds';end if;
 r:=public.fulfill_trade_order(gen_random_uuid(),shop,location,order_id,2,jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','10')),false,'One whole box collection');
 if (select measurement_snapshot->>'enteredQuantity' from public.invoice_items where invoice_id=(r->>'invoiceId')::uuid) is distinct from '1'
 or (select measurement_snapshot->>'baseQuantity' from public.invoice_items where invoice_id=(r->>'invoiceId')::uuid) is distinct from '10' then raise exception 'Whole-box invoice measurement changed';end if;
end;$$;
reset role;
insert into public.profiles(user_id,portal_id,display_name,email_snapshot)
select a.cashier,s.portal_id,'Collection cashier',a.cashier::text||'@order-collection.invalid' from collection_actors a join public.shops s on s.id=current_setting('collection_test.shop')::uuid;
set local role authenticated;
do $$declare shop uuid:=current_setting('collection_test.shop')::uuid;location uuid:=current_setting('collection_test.location')::uuid;customer uuid:=current_setting('collection_test.customer')::uuid;
 product uuid;order_id uuid;line_id uuid;other_location uuid;counter_role text;invitation jsonb;r jsonb;context jsonb;begin
 other_location:=public.save_shop_location(shop,null,'Separate warehouse','OTHER');
 counter_role:=public.save_shop_team_role(gen_random_uuid(),shop,null,'Collection counter','منضدة التسليم',array['sales.view','sales.issue','products.view']);
 invitation:=public.invite_shop_member(gen_random_uuid(),shop,(select cashier::text||'@order-collection.invalid' from collection_actors),'Collection cashier',counter_role,array[location]);
 product:=public.save_product(shop,null,'Authorized collection cable','COLLECT-AUTH',null,35);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m"]','Authorized collection stock unit');
 perform public.adjust_stock(gen_random_uuid(),shop,product,20,20,'Authorized collection opening');
 r:=pg_temp.collection_order(shop,location,customer,product,'20');order_id:=(r->>'id')::uuid;line_id:=(r->>'lineId')::uuid;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,1,'reserve',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','20')),clock_timestamp()+interval '1 day','Manager holds collection stock');
 perform set_config('request.jwt.claim.sub',(select cashier::text from collection_actors),true);
 perform public.accept_shop_invitation(gen_random_uuid(),(invitation->>'invitationCode')::uuid);
 context:=public.trade_order_delivery_context(shop,location,order_id);
 if context->>'canFulfill'<>'true' or context->>'canApplyDeposits'<>'false' then raise exception 'Collection cashier authority projection wrong';end if;
 begin perform public.trade_order_funding_context(shop,location,order_id);raise exception 'Cashier read private funding';exception when insufficient_privilege then null;end;
 begin perform public.trade_order_deposit(gen_random_uuid(),shop,location,order_id,2,'receive','10',clock_timestamp(),'cash',null,null,null,'Cashier forged deposit');raise exception 'Cashier gained receipt authority';exception when insufficient_privilege then null;end;
 begin perform public.fulfill_trade_order(gen_random_uuid(),shop,location,order_id,2,jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','10')),true,'Cashier forged deposit application');raise exception 'Cashier allocated receipts';exception when insufficient_privilege then null;end;
 begin perform public.trade_order_delivery_context(shop,other_location,order_id);raise exception 'Cashier crossed warehouse scope';exception when insufficient_privilege then null;end;
 r:=public.fulfill_trade_order(gen_random_uuid(),shop,location,order_id,2,jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','10')),false,'Authorized held-goods collection');
 if r->>'revision'<>'3' or r->>'appliedDeposit'<>'0' or (select sum(remaining_quantity) from public.inventory_batches where product_id=product)<>10 then raise exception 'Cashier fulfillment required manager/payment authority or unauthorized command wrote stock';end if;
 perform set_config('request.jwt.claim.sub',(select owner::text from collection_actors),true);
end;$$;
reset role;
do $$declare item text;routine regprocedure;begin
 foreach item in array array['trade_order_deliveries','trade_order_delivery_items','trade_order_delivery_allocations'] loop
  if has_table_privilege('authenticated','public.'||item,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon','public.'||item,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Delivery history exposed outside bounded authority: %',item;end if;
 end loop;
 for routine in select p.oid::regprocedure from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where n.nspname='shop_private' and (p.proname like '%order_delivery%' or p.proname like 'plan_order_%' or p.proname in('delivered_order_quantity','order_deposit_capacity','order_funded_amount','guard_customer_advance_allocation')) loop
  if has_function_privilege('authenticated',routine,'execute') or has_function_privilege('anon',routine,'execute') then raise exception 'Private collection authority exposed: %',routine;end if;
 end loop;
end;$$;
set constraints order_reservation_capacity,order_reservation_batch_capacity,order_reservation_reel_capacity immediate;
