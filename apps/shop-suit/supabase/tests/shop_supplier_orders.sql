-- Synthetic fixtures are enclosed in the owned runner's transaction/rollback.
create temporary table supplier_order_actors as select gen_random_uuid() owner,gen_random_uuid() outsider,gen_random_uuid() reader;
grant select on supplier_order_actors to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@supplier-orders.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from(select owner id from supplier_order_actors union all select outsider from supplier_order_actors union all select reader from supplier_order_actors)a;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from supplier_order_actors;
set local role authenticated;
do $$declare shop uuid;location uuid;vendor uuid;product uuid;pack uuid;order_id uuid;line_id uuid;invoice uuid;second_invoice uuid;invoice_line uuid;reel uuid;
 r jsonb;again jsonb;context jsonb;values jsonb;items jsonb;request_id uuid:=gen_random_uuid();receipt_request uuid:=gen_random_uuid();begin
 shop:=public.create_owner_shop('Supplier ordering merchant','multi','mixed');
 select id into location from public.shop_locations where shop_id=shop and is_default;
 vendor:=public.save_vendor(shop,null,'Agreed reel supplier',null,null,null,null,null,null);
 product:=public.save_product(shop,null,'Ordered blue cable','PO-BLUE',null,35);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m"]','Supplier order stock unit');
 perform public.save_product_technical_details(shop,product,0,null,'{}',true,'Track each delivered source reel');
 pack:=public.save_product_packaging(gen_random_uuid(),shop,product,null,'{"code":"PO100","name":"Original 100m reel","unitCode":"reel","containedQuantity":"100","containedUnitCode":"m","canPurchase":true,"canSell":true}');
 values:=jsonb_build_object('vendorId',vendor,'expectedOn',current_date+7,'notes','Deliver ten source reels in two visits','lines',jsonb_build_array(jsonb_build_object('product_id',product,'quantity','10','unit_cost','2500','package_id',pack,'package_version',1,'measurement_revision',1)));
 r:=public.supplier_order_command(request_id,shop,location,'save',null,0,values,'Plan ten source reels');order_id:=(r->>'id')::uuid;
 again:=public.supplier_order_command(request_id,shop,location,'save',null,0,values,'Plan ten source reels');
 if again<>r then raise exception 'Supplier order save retry duplicated agreement';end if;
 context:=public.supplier_order_context(shop,location,order_id);line_id:=(context#>>'{detail,lines,0,id}')::uuid;
 if context#>>'{detail,record,estimated_total}'<>'25000' or context#>>'{detail,lines,0,quantity}'<>'1000'
 or context#>>'{detail,lines,0,remaining_entered_quantity}'<>'10' or jsonb_typeof(context#>'{detail,lines,0,unit_cost}')<>'string' then raise exception 'Supplier planning projection lost exact units/cost: %',context;end if;
 begin perform public.supplier_order_command(request_id,shop,location,'save',null,0,values,'Changed retry reason');raise exception 'Supplier request identity reused';exception when unique_violation then if sqlerrm<>'SUPPLIER_ORDER_REQUEST_CONFLICT' then raise;end if;end;
 perform public.supplier_order_command(gen_random_uuid(),shop,location,'issue',order_id,1,'{}','Issue measured supplier order');
 if exists(select 1 from public.vendor_invoices where shop_id=shop) or exists(select 1 from public.inventory_batches where shop_id=shop) or exists(select 1 from public.payments where shop_id=shop) then raise exception 'Ordering created stock, supplier debt or payment';end if;
 begin perform public.supplier_order_command(gen_random_uuid(),shop,location,'save',order_id,2,values,'Attempt changing issued order');raise exception 'Issued supplier agreement was editable';exception when sqlstate '55000' then if sqlerrm<>'SUPPLIER_ORDER_STATE_DENIED' then raise;end if;end;
 -- Receiving the original issued package remains possible after archival; an
 -- ordinary new purchase cannot use this private historical resolution.
 perform public.save_product_packaging(gen_random_uuid(),shop,product,pack,'{"archive":true}');
 perform public.save_product(shop,product,'Current catalogue cable name','PO-BLUE',null,99);
 begin perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'FORGED-OLD-PACK',current_date,null,values->'lines');raise exception 'Ordinary purchase bypassed archived package';exception when sqlstate '55000' then if sqlerrm<>'PACKAGE_CONTEXT_CHANGED' then raise;end if;end;
 items:=jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','6','unit_cost','1','resolved','{"baseQuantity":"1000000"}'::jsonb));
 r:=public.receive_supplier_order(receipt_request,shop,location,order_id,2,current_date,'PO-FIRST-6',items,'Accept first six original reels');invoice:=(r->>'invoiceId')::uuid;
 again:=public.receive_supplier_order(receipt_request,shop,location,order_id,2,current_date,'PO-FIRST-6',items,'Accept first six original reels');
 if again<>r or r->>'status'<>'partially_received' then raise exception 'First supplier receipt retry/state wrong';end if;
 context:=public.supplier_order_context(shop,location,order_id);
 if context#>>'{detail,lines,0,received_entered_quantity}'<>'6' or context#>>'{detail,lines,0,remaining_entered_quantity}'<>'4'
 or context#>>'{detail,lines,0,product_name}'<>'Ordered blue cable' or (context#>>'{detail,receiptTotal}')::integer<>1 then raise exception 'Partial receiving lost promised remainder or original name: %',context;end if;
 if (select count(*) from public.vendor_invoices where shop_id=shop)<>1 or (select total_amount from public.vendor_invoices where id=invoice)<>15000
 or (select sum(remaining_quantity) from public.inventory_batches where product_id=product)<>600
 or (select count(*) from public.inventory_reels where product_id=product and original_length=100 and remaining_length=100)<>6
 or (select measurement_snapshot->>'packageVersion' from public.vendor_invoice_items where vendor_invoice_id=invoice)<>'1' then raise exception 'Six reels became ten, repriced or lost historical package';end if;
 begin perform public.receive_supplier_order(gen_random_uuid(),shop,location,order_id,3,current_date,'PO-EXCESS',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','5')),'Attempt receiving five when four remain');raise exception 'Supplier over-received';exception when check_violation then if sqlerrm<>'SUPPLIER_RECEIPT_EXCEEDS_ORDER' then raise;end if;end;
 begin perform public.receive_supplier_order(gen_random_uuid(),shop,location,order_id,3,current_date,'PO-HALF',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','0.5')),'Attempt half of agreed reel package');raise exception 'Half-package receiving accepted';exception when invalid_parameter_value then if sqlerrm<>'WHOLE_PACKAGE_QUANTITY_REQUIRED' then raise;end if;end;
 begin perform public.receive_supplier_order(gen_random_uuid(),shop,location,order_id,2,current_date,'PO-STALE',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','4')),'Stale receiving editor');raise exception 'Stale receiving accepted';exception when sqlstate '55000' then if sqlerrm<>'SUPPLIER_ORDER_CONTEXT_CHANGED' then raise;end if;end;
 -- Existing purchase returns remove the original physical source/cost. They do
 -- not pretend that fewer reels originally arrived against this purchase order.
 select id into invoice_line from public.vendor_invoice_items where vendor_invoice_id=invoice;
 select physical.id into reel from public.inventory_reels physical join public.inventory_batches b on b.id=physical.batch_id where b.source_id=invoice limit 1;
 perform public.record_purchase_return(gen_random_uuid(),shop,invoice,clock_timestamp(),'Return one damaged delivered source',null,jsonb_build_array(jsonb_build_object('vendor_invoice_item_id',invoice_line,'quantity','100','reel_id',reel)));
 if (public.get_purchase(shop,invoice)->>'payable')::numeric<>12500 or public.supplier_order_context(shop,location,order_id)#>>'{detail,lines,0,remaining_entered_quantity}'<>'4' then raise exception 'Supplier return changed historical receiving or lost original credit';end if;
 r:=public.receive_supplier_order(gen_random_uuid(),shop,location,order_id,3,current_date,'PO-FINAL-4',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','4')),'Accept final four source reels');second_invoice:=(r->>'invoiceId')::uuid;
 if r->>'status'<>'received' or (select count(*) from public.vendor_invoices where shop_id=shop)<>2
 or (select sum(remaining_quantity) from public.inventory_batches where product_id=product)<>900
 or (select sum(remaining_quantity*unit_cost) from public.inventory_batches where product_id=product)<>22500 then raise exception 'Supplier final stock/debt/cost not reconciled';end if;
 context:=public.supplier_order_context(shop,location,order_id);
 if context#>>'{detail,lines,0,received_entered_quantity}'<>'10' or context#>>'{detail,lines,0,remaining_entered_quantity}'<>'0' or context#>>'{detail,canReceive}'<>'false' then raise exception 'Completed supplier promise remained receivable';end if;
 begin perform public.receive_supplier_order(gen_random_uuid(),shop,location,order_id,4,current_date,'PO-DUPLICATE',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','1')),'Attempt extra received reel');raise exception 'Completed supplier order received again';exception when sqlstate '55000' then if sqlerrm<>'SUPPLIER_ORDER_STATE_DENIED' then raise;end if;end;
 perform set_config('supplier_order_test.vendor',vendor::text,true);perform set_config('supplier_order_test.shop',shop::text,true);perform set_config('supplier_order_test.location',location::text,true);perform set_config('supplier_order_test.order',order_id::text,true);
 perform set_config('request.jwt.claim.sub',(select outsider::text from supplier_order_actors),true);
 begin perform public.supplier_order_context(shop,location,order_id);raise exception 'Outsider read supplier agreements';exception when insufficient_privilege then null;end;
 begin perform public.receive_supplier_order(gen_random_uuid(),shop,location,order_id,4,current_date,null,'[]','Outsider supplier receipt');raise exception 'Outsider received goods';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',(select owner::text from supplier_order_actors),true);
end;$$;

-- Fractional mass receipts and cancelling the pending balance preserve actual
-- purchase debt and never invent stock for the undelivered planning quantity.
do $$declare shop uuid:=current_setting('supplier_order_test.shop')::uuid;location uuid:=current_setting('supplier_order_test.location')::uuid;vendor uuid:=current_setting('supplier_order_test.vendor')::uuid;
 product uuid;order_id uuid;line_id uuid;r jsonb;values jsonb;context jsonb;begin
 product:=public.save_product(shop,null,'Ordered copper mass','PO-COPPER',null,150);
 perform public.configure_product_measurement(shop,product,'kg','0.001','["kg","g"]','Supplier copper purchase unit');
 values:=jsonb_build_object('vendorId',vendor,'lines',jsonb_build_array(jsonb_build_object('product_id',product,'quantity',0.75,'unit_code','kg','unit_cost',120.123456,'measurement_revision',1)));
 r:=public.supplier_order_command(gen_random_uuid(),shop,location,'save',null,0,values,'Plan copper mass delivery');order_id:=(r->>'id')::uuid;
 r:=public.supplier_order_command(gen_random_uuid(),shop,location,'save',order_id,1,values||jsonb_build_object('notes','Corrected delivery note'),'Review draft delivery note');
 perform public.supplier_order_command(gen_random_uuid(),shop,location,'issue',order_id,2,'{}','Issue exact copper mass order');
 line_id:=(public.supplier_order_context(shop,location,order_id)#>>'{detail,lines,0,id}')::uuid;
 r:=public.receive_supplier_order(gen_random_uuid(),shop,location,order_id,3,current_date,'PO-COPPER-PART',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','0.275')),'Accept exact copper mass');
 context:=public.supplier_order_context(shop,location,order_id);
 if context#>>'{detail,lines,0,received_entered_quantity}'<>'0.275' or context#>>'{detail,lines,0,remaining_entered_quantity}'<>'0.475'
 or context#>>'{detail,lines,0,unit_cost}'<>'120.123456' or jsonb_typeof(context#>'{detail,lines,0,original_input,unit_cost}')<>'string' or (select total_amount from public.vendor_invoices where id=(r->>'invoiceId')::uuid)<>33.03 then raise exception 'Fractional supplier receipt rounded quantity/cost or lost debt: %',context;end if;
 perform public.supplier_order_command(gen_random_uuid(),shop,location,'cancel',order_id,4,'{}','Stop undelivered copper remainder');
 begin perform public.receive_supplier_order(gen_random_uuid(),shop,location,order_id,5,current_date,'PO-CANCELLED',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','0.475')),'Attempt cancelled balance delivery');raise exception 'Cancelled supplier order received stock';exception when sqlstate '55000' then if sqlerrm<>'SUPPLIER_ORDER_STATE_DENIED' then raise;end if;end;
 if (select sum(remaining_quantity) from public.inventory_batches where product_id=product)<>0.275 then raise exception 'Cancellation changed physically received mass';end if;
end;$$;
reset role;
insert into public.profiles(user_id,portal_id,display_name,email_snapshot)
select a.reader,s.portal_id,'Supplier invoice reader',a.reader::text||'@supplier-orders.invalid' from supplier_order_actors a join public.shops s on s.id=current_setting('supplier_order_test.shop')::uuid;
set local role authenticated;
do $$declare shop uuid:=current_setting('supplier_order_test.shop')::uuid;location uuid:=current_setting('supplier_order_test.location')::uuid;order_id uuid:=current_setting('supplier_order_test.order')::uuid;
 reader_role text;invitation jsonb;other_location uuid;context jsonb;begin
 other_location:=public.save_shop_location(shop,null,'Separate receiving warehouse','OTHER');
 reader_role:=public.save_shop_team_role(gen_random_uuid(),shop,null,'Supplier invoices read','قراءة فواتير الموردين',array['vendor_invoices.view']);
 invitation:=public.invite_shop_member(gen_random_uuid(),shop,(select reader::text||'@supplier-orders.invalid' from supplier_order_actors),'Supplier invoice reader',reader_role,array[location]);
 perform set_config('request.jwt.claim.sub',(select reader::text from supplier_order_actors),true);
 perform public.accept_shop_invitation(gen_random_uuid(),(invitation->>'invitationCode')::uuid);
 context:=public.supplier_order_context(shop,location,order_id);
 if context->>'canManage'<>'false' or context#>>'{detail,canEdit}'<>'false' or context#>>'{detail,canReceive}'<>'false' or context#>>'{detail,canCancel}'<>'false' then raise exception 'Read-only supplier role offered writes';end if;
 begin perform public.supplier_order_context(shop,other_location,order_id);raise exception 'Invoice reader crossed location boundary';exception when insufficient_privilege then null;end;
 begin perform public.supplier_order_command(gen_random_uuid(),shop,location,'cancel',order_id,4,'{}','Reader attempts cancellation');raise exception 'Reader cancelled supplier order';exception when insufficient_privilege then null;end;
 begin perform public.receive_supplier_order(gen_random_uuid(),shop,location,order_id,4,current_date,null,'[]','Reader attempts receiving');raise exception 'Reader posted purchase';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',(select owner::text from supplier_order_actors),true);
end;$$;
set constraints supplier_received_capacity immediate;
reset role;
do $$declare item text;begin
 foreach item in array array['supplier_orders','supplier_order_lines','supplier_order_receipts','supplier_order_receipt_items','supplier_order_events'] loop
  if has_table_privilege('authenticated','public.'||item,'select,insert,update,delete') or has_table_privilege('anon','public.'||item,'select,insert,update,delete') then raise exception 'Supplier order raw history exposed: %',item;end if;
 end loop;
 if has_table_privilege('authenticated','shop_private.supplier_receipt_plans','select,insert,update,delete') then raise exception 'Historical receipt resolution exposed';end if;
 begin update public.supplier_order_lines set unit_cost=1 where order_id=current_setting('supplier_order_test.order')::uuid;raise exception 'Issued supplier cost mutable';exception when sqlstate '55000' then if sqlerrm<>'ISSUED_SUPPLIER_ORDER_IMMUTABLE' then raise;end if;end;
 begin update public.supplier_order_receipts set reason='Altered delivery evidence' where order_id=current_setting('supplier_order_test.order')::uuid;raise exception 'Supplier receipt history mutable';exception when sqlstate '55000' then null;end;
end;$$;

-- Closed receipt dates roll back the entire receipt and its private plan.
set local role authenticated;
do $$declare shop uuid:=current_setting('supplier_order_test.shop')::uuid;location uuid:=current_setting('supplier_order_test.location')::uuid;vendor uuid:=current_setting('supplier_order_test.vendor')::uuid;
 product uuid;r jsonb;begin
 product:=public.save_product(shop,null,'Period-controlled piece','PO-PERIOD',null,10);
 r:=public.supplier_order_command(gen_random_uuid(),shop,location,'save',null,0,jsonb_build_object('vendorId',vendor,'lines',jsonb_build_array(jsonb_build_object('product_id',product,'quantity','3','unit_cost','2'))),'Plan dated receipt');
 perform public.supplier_order_command(gen_random_uuid(),shop,location,'issue',(r->>'id')::uuid,1,'{}','Issue dated receipt order');
 perform set_config('supplier_order_test.period_order',r->>'id',true);
 perform set_config('supplier_order_test.period_product',product::text,true);
 perform set_config('supplier_order_test.period_line',public.supplier_order_context(shop,location,(r->>'id')::uuid)#>>'{detail,lines,0,id}',true);
end;$$;
reset role;
insert into public.accounting_periods(shop_id,period_start,period_end,is_closed) values(current_setting('supplier_order_test.shop')::uuid,current_date-30,current_date-20,true);
set local role authenticated;
do $$declare shop uuid:=current_setting('supplier_order_test.shop')::uuid;location uuid:=current_setting('supplier_order_test.location')::uuid;order_id uuid:=current_setting('supplier_order_test.period_order')::uuid;context jsonb;begin
 begin perform public.receive_supplier_order(gen_random_uuid(),shop,location,order_id,2,current_date-25,'PO-CLOSED',jsonb_build_array(jsonb_build_object('lineId',current_setting('supplier_order_test.period_line'),'quantity','3')),'Reject closed-period stock receipt');raise exception 'Closed-period supplier receipt accepted';exception when others then if sqlerrm<>'ACCOUNTING_PERIOD_CLOSED' then raise;end if;end;
 context:=public.supplier_order_context(shop,location,order_id);
 if context#>>'{detail,record,revision}'<>'2' or context#>>'{detail,receiptTotal}'<>'0' or exists(select 1 from public.inventory_batches where product_id=current_setting('supplier_order_test.period_product')::uuid) then raise exception 'Closed date left partial stock or receipt history';end if;
end;$$;
-- Current Solo retail retains its ordinary piece/cost and supplier debt path.
do $$declare shop uuid;location uuid;vendor uuid;product uuid;order_id uuid;line_id uuid;r jsonb;begin
 perform set_config('request.jwt.claim.sub',(select outsider::text from supplier_order_actors),true);
 shop:=public.create_owner_shop('Solo ordinary retail purchasing','solo','product');
 select id into location from public.shop_locations where shop_id=shop and is_default;
 vendor:=public.save_vendor(shop,null,'Solo piece supplier',null,null,null,null,null,null);
 product:=public.save_product(shop,null,'Ordinary legacy piece','PO-SOLO-PIECE',null,10);
 r:=public.supplier_order_command(gen_random_uuid(),shop,location,'save',null,0,jsonb_build_object('vendorId',vendor,'lines',jsonb_build_array(jsonb_build_object('product_id',product,'quantity','2','unit_cost','3.25'))),'Plan ordinary pieces');order_id:=(r->>'id')::uuid;
 perform public.supplier_order_command(gen_random_uuid(),shop,location,'issue',order_id,1,'{}','Issue ordinary pieces order');
 line_id:=(public.supplier_order_context(shop,location,order_id)#>>'{detail,lines,0,id}')::uuid;
 r:=public.receive_supplier_order(gen_random_uuid(),shop,location,order_id,2,current_date,'PO-SOLO-RECEIPT',jsonb_build_array(jsonb_build_object('lineId',line_id,'quantity','2')),'Accept two ordinary pieces');
 if (select total_amount from public.vendor_invoices where id=(r->>'invoiceId')::uuid)<>6.50
 or (select sum(remaining_quantity) from public.inventory_batches where product_id=product)<>2
 or exists(select 1 from public.vendor_invoice_items where vendor_invoice_id=(r->>'invoiceId')::uuid and measurement_snapshot is not null) then raise exception 'Solo legacy piece purchasing changed its cost/measurement contract';end if;
 perform set_config('request.jwt.claim.sub',(select owner::text from supplier_order_actors),true);
end;$$;
reset role;
update public.subscriptions set trial_end_at=now()-interval '1 second' where profile_id in(select profile_id from public.shop_memberships where shop_id=current_setting('supplier_order_test.shop')::uuid and role='owner');
set local role authenticated;
do $$declare shop uuid:=current_setting('supplier_order_test.shop')::uuid;location uuid:=current_setting('supplier_order_test.location')::uuid;begin
 perform public.supplier_order_context(shop,location,current_setting('supplier_order_test.order')::uuid);
 begin perform public.supplier_order_command(gen_random_uuid(),shop,location,'save',null,0,'{}','Expired subscription attempt');raise exception 'Inactive subscription ordered stock';exception when insufficient_privilege then if sqlerrm<>'SHOP_SUBSCRIPTION_INACTIVE' then raise;end if;end;
 begin perform public.receive_supplier_order(gen_random_uuid(),shop,location,current_setting('supplier_order_test.period_order')::uuid,2,current_date,null,'[]','Expired subscription receiving');raise exception 'Inactive subscription received stock';exception when insufficient_privilege then if sqlerrm<>'SHOP_SUBSCRIPTION_INACTIVE' then raise;end if;end;
end;$$;
set constraints supplier_received_capacity immediate;
reset role;
