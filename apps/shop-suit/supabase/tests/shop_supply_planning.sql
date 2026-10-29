-- Run business-date assertions in the same Cairo timezone as report windows.
set local timezone='Africa/Cairo';
create temporary table planning_actors as select gen_random_uuid() owner,gen_random_uuid() outsider,gen_random_uuid() reader;
grant select on planning_actors to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@planning.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from(select owner id from planning_actors union all select outsider from planning_actors union all select reader from planning_actors)i;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from planning_actors;
set local role authenticated;
do $$declare shop uuid;location uuid;other_location uuid;vendor uuid;vendor_two uuid;product uuid;pack uuid;bin uuid;pos uuid;ref uuid;staff uuid;customer uuid;invoice uuid;line uuid;order_id uuid;order_line uuid;
 r jsonb;again jsonb;context jsonb;values jsonb;q jsonb;plan jsonb;args jsonb;request uuid:=gen_random_uuid();before_qty numeric;before_value numeric;begin
 shop:=public.create_owner_shop('Supply planning merchant','multi','mixed');
 select id into location from public.shop_locations where shop_id=shop and is_default;
 select id into staff from public.shop_memberships where shop_id=shop and role='owner';
 other_location:=public.save_shop_location(shop,null,'Other storage warehouse','OTHER');
 vendor:=public.save_vendor(shop,null,'Original cable supplier',null,null,null,null,null,null);
 vendor_two:=public.save_vendor(shop,null,'Second cable supplier',null,null,null,null,null,null);
 product:=public.save_product(shop,null,'Planning measured cable','PLAN-CABLE',null,2);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m","cm"]','Planning stock unit');
 pack:=public.save_product_packaging(gen_random_uuid(),shop,product,null,'{"code":"PLAN10","name":"Ten meter supplier box","unitCode":"box","containedQuantity":"10","containedUnitCode":"m","canPurchase":true,"canSell":true}');
 values:='{"code":"A-01","name":"Cable shelf","aisle":"A","shelf":"01","active":true}';
 r:=public.inventory_planning_command(request,shop,location,'bin',null,0,values,'Label first cable shelf');bin:=(r->>'id')::uuid;
 again:=public.inventory_planning_command(request,shop,location,'bin',null,0,values,'Label first cable shelf');if again<>r then raise exception 'Bin retry created another location';end if;
 begin perform public.inventory_planning_command(request,shop,location,'bin',null,0,values,'Reuse request for another reason');raise exception 'Planning identity was reusable';exception when unique_violation then if sqlerrm<>'PLANNING_REQUEST_CONFLICT' then raise;end if;end;
 begin perform public.inventory_planning_command(gen_random_uuid(),shop,location,'bin',null,0,values,'Duplicate bin code');raise exception 'Duplicate bin code accepted';exception when unique_violation then null;end;
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'PLAN-FIRST',current_date,'First original box cost',jsonb_build_array(jsonb_build_object('product_id',product,'quantity','1','unit_cost','20.123456','package_id',pack,'package_version',1,'measurement_revision',1)));
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'PLAN-SECOND',current_date,'Second original box cost',jsonb_build_array(jsonb_build_object('product_id',product,'quantity','2','unit_cost','30.234567','package_id',pack,'package_version',1,'measurement_revision',1)));
 perform public.adjust_stock(gen_random_uuid(),shop,product,70,1,'Opening balance to one hundred meters');
 select quantity_on_hand,inventory_value into before_qty,before_value from public.product_stock where product_id=product;
 r:=public.inventory_planning_command(gen_random_uuid(),shop,location,'position',null,0,jsonb_build_object('productId',product,'binId',bin,'notes','Cable trays share this shelf','active',true),'Locate existing pooled stock');pos:=(r->>'id')::uuid;
 if (select quantity_on_hand from public.product_stock where product_id=product)<>before_qty or (select inventory_value from public.product_stock where product_id=product)<>before_value then raise exception 'Position metadata changed quantity or value';end if;
 begin perform public.inventory_planning_command(gen_random_uuid(),shop,location,'bin',bin,1,values||'{"active":false}','Archive occupied bin');raise exception 'Occupied storage bin archived';exception when sqlstate '55000' then if sqlerrm<>'STORAGE_BIN_IN_USE' then raise;end if;end;
 begin perform public.inventory_planning_command(gen_random_uuid(),shop,other_location,'position',null,0,jsonb_build_object('productId',product,'binId',bin,'active',true),'Use another location bin');raise exception 'Bin crossed physical location';exception when sqlstate '55000' then if sqlerrm<>'STORAGE_BIN_UNAVAILABLE' then raise;end if;end;
 values:=jsonb_build_object('productId',product,'vendorId',vendor,'itemCode','SUP-CABLE-10M','packageId',pack,'packageVersion',1,'leadDays','2','reviewDays','8','preferred',true,'active',true);
 r:=public.inventory_planning_command(gen_random_uuid(),shop,location,'supplier',null,0,values,'Approve ten meter supplier package');ref:=(r->>'id')::uuid;
 begin perform public.inventory_planning_command(gen_random_uuid(),shop,location,'supplier',null,0,values||jsonb_build_object('vendorId',vendor_two),'Competing preferred supplier');raise exception 'Two preferred suppliers accepted';exception when unique_violation then null;end;
 context:=public.supplier_price_history(shop,location,product,vendor);
 if (context->>'total')::integer<>2 or not exists(select 1 from jsonb_array_elements(context->'items') i where i->>'entered_unit_cost'='20.123456' and i->>'base_unit_cost'='2.0123456' and i->>'purchase_unit'='Ten meter supplier box' and i->>'currency'='EGP') then raise exception 'Original supplier unit/price history lost: %',context;end if;
 customer:=public.save_customer(shop,null,'Planning contractor',null,null,null,null);
 invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity','60','unit_code','m','measurement_revision',1)));
 perform public.issue_location_sale(gen_random_uuid(),shop,location,invoice);
 select id into line from public.invoice_items where invoice_id=invoice;
 args:=jsonb_build_array(jsonb_build_object('lineId',line,'quantity',10,'disposition','resellable'));plan:=public.preview_sale_return(shop,location,invoice,args);
 perform public.create_sale_return(gen_random_uuid(),shop,location,invoice,args,'Return ten meters from original sale',plan);
 q:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,jsonb_build_object('customerId',customer,'validUntil',clock_timestamp()+interval '7 days','orderDiscount','0','lines',jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity','20','unit_code','m','measurement_revision',1))),'Prepare twenty meter reservation');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',(q->>'id')::uuid,1,'{}','Issue shelf collection offer');perform public.trade_quotation_command(gen_random_uuid(),shop,location,'accept',(q->>'id')::uuid,2,'{}','Accept shelf collection offer');
 r:=public.create_trade_order(gen_random_uuid(),shop,location,(q->>'id')::uuid,3,'Create held material order');order_id:=(r->>'id')::uuid;
 order_line:=(public.trade_order_context(shop,location,order_id)#>>'{detail,lines,0,id}')::uuid;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,1,'reserve',jsonb_build_array(jsonb_build_object('lineId',order_line,'quantity','20')),clock_timestamp()+interval '1 day','Hold twenty meters on shelf');
 r:=public.supplier_order_command(gen_random_uuid(),shop,location,'save',null,0,jsonb_build_object('vendorId',vendor,'lines',jsonb_build_array(jsonb_build_object('product_id',product,'quantity','1','unit_cost','30','package_id',pack,'package_version',1,'measurement_revision',1))),'Plan one incoming ten meter box');
 perform public.supplier_order_command(gen_random_uuid(),shop,location,'issue',(r->>'id')::uuid,1,'{}','Issue ten meter replenishment');
 context:=public.shop_operational_report(shop,'reorder',location,current_date-9,current_date,1,20);
 if context#>>'{items,0,demand_quantity}'<>'50' or context#>>'{items,0,on_hand}'<>'50' or context#>>'{items,0,reserved}'<>'20' or context#>>'{items,0,available}'<>'30' or context#>>'{items,0,incoming}'<>'10' or context#>>'{items,0,suggested_quantity}'<>'10' or context#>>'{items,0,base_unit_code}'<>'m' then raise exception 'Demand/free/incoming/package reconciliation failed: %',context;end if;
 if public.shop_operational_report(shop,'inventory',location,null,null,1,20)->>'report'<>'inventory' then raise exception 'Existing operational report dispatch changed';end if;
 context:=public.shop_operational_report(shop,'reorder',other_location,current_date-9,current_date,1,20);
 if context#>>'{items,0,basis}'<>'no_preferred_supplier' or context#>'{items,0,suggested_quantity}'<>'null'::jsonb then raise exception 'Invented supplier demand/configuration for another location';end if;
 begin perform public.shop_operational_report(shop,'reorder',location,current_date-366,current_date,1,20);raise exception 'Unbounded demand window accepted';exception when invalid_parameter_value then null;end;
 begin perform public.inventory_planning_context(shop,location,'supplier',null,0);raise exception 'Unbounded planning page accepted';exception when invalid_parameter_value then null;end;
 -- Archived package references remain readable and can be explicitly disabled.
 perform public.save_product_packaging(gen_random_uuid(),shop,product,pack,'{"archive":true}');
 context:=public.shop_operational_report(shop,'reorder',location,current_date-9,current_date,1,20);
 if context#>>'{items,0,basis}'<>'stale_supplier_reference' or context#>'{items,0,suggested_quantity}'<>'null'::jsonb then raise exception 'Archived supplier package still drove replenishment';end if;
 perform public.inventory_planning_command(gen_random_uuid(),shop,location,'supplier',ref,1,values||'{"active":false}','Disable archived supplier package mapping');
 perform public.inventory_planning_command(gen_random_uuid(),shop,location,'position',pos,1,jsonb_build_object('productId',product,'binId',bin,'active',false),'Clear pooled storage placement');
 perform public.inventory_planning_command(gen_random_uuid(),shop,location,'bin',bin,1,'{"code":"A-01","name":"Cable shelf","active":false}','Archive cleared storage bin');
 context:=public.inventory_planning_context(shop,location,'bin',null,1,bin);
 if (context->>'historyTotal')::integer<>2 or context#>>'{record,active}'<>'false' then raise exception 'Bin archival lost immutable history';end if;
 perform set_config('planning_test.shop',shop::text,true);perform set_config('planning_test.location',location::text,true);perform set_config('planning_test.bin',bin::text,true);perform set_config('planning_test.product',product::text,true);perform set_config('planning_test.other_location',other_location::text,true);
 perform set_config('request.jwt.claim.sub',(select outsider::text from planning_actors),true);
 begin perform public.inventory_planning_context(shop,location,'bin');raise exception 'Outsider read storage';exception when insufficient_privilege then null;end;
 begin perform public.supplier_price_history(shop,location);raise exception 'Outsider read supplier cost';exception when insufficient_privilege then null;end;
 begin perform public.shop_operational_report(shop,'reorder',location);raise exception 'Outsider read demand';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',(select owner::text from planning_actors),true);
end;$$;
reset role;
do $$declare t text;begin
 foreach t in array array['storage_bins','inventory_positions','supplier_product_references','inventory_planning_events'] loop
  if has_table_privilege('authenticated','public.'||t,'select,insert,update,delete') or has_table_privilege('anon','public.'||t,'select,insert,update,delete') then raise exception 'Planning raw table exposed: %',t;end if;
 end loop;
 if has_table_privilege('authenticated','shop_private.inventory_planning_requests','select,insert,update,delete') or has_function_privilege('authenticated','shop_private.reorder_suggestions(uuid,uuid,date,date,integer,integer)','execute') then raise exception 'Private planning helper exposed';end if;
 begin update public.inventory_planning_events set reason='Forged placement history';raise exception 'Placement history rewritten';exception when sqlstate '55000' then null;end;
end;$$;
-- A physical placement goes through the existing immutable reel movement API.
set local role authenticated;
do $$declare shop uuid:=current_setting('planning_test.shop')::uuid;location uuid:=current_setting('planning_test.location')::uuid;vendor uuid;product uuid;pack uuid;bin uuid;second_bin uuid;reel uuid;position uuid;r jsonb;context jsonb;args jsonb;request uuid:=gen_random_uuid();rev integer;begin
 vendor:=public.save_vendor(shop,null,'Physical shelf supplier',null,null,null,null,null,null);
 product:=public.save_product(shop,null,'Z physical source cable','PLAN-PHYSICAL',null,4);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m"]','Physical bin quantity unit');
 perform public.save_product_technical_details(shop,product,0,null,'{}',true,'Track positioned physical reels');
 pack:=public.save_product_packaging(gen_random_uuid(),shop,product,null,'{"code":"PLAN20","name":"Twenty meter reel","unitCode":"reel","containedQuantity":"20","containedUnitCode":"m","canPurchase":true,"canSell":true}');
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'PLAN-PHYSICAL',current_date,null,jsonb_build_array(jsonb_build_object('product_id',product,'quantity','1','unit_cost','40','package_id',pack,'package_version',1,'measurement_revision',1)));
 context:=public.inventory_reel_context(shop,location,product);reel:=(context#>>'{items,0,id}')::uuid;rev:=(context#>>'{items,0,revision}')::integer;
 r:=public.inventory_planning_command(gen_random_uuid(),shop,location,'bin',null,0,'{"code":"R-01","name":"Physical reel rack","active":true}','Name original physical rack');bin:=(r->>'id')::uuid;
 r:=public.inventory_planning_command(gen_random_uuid(),shop,location,'bin',null,0,'{"code":"R-02","name":"Second physical rack","active":true}','Name second physical rack');second_bin:=(r->>'id')::uuid;
 args:=jsonb_build_object('productId',product,'binId',bin,'reelId',reel,'reelRevision',rev,'active',true);
 r:=public.inventory_planning_command(request,shop,location,'position',null,0,args,'Place physical source on rack');position:=(r->>'id')::uuid;
 if public.inventory_planning_command(request,shop,location,'position',null,0,args,'Place physical source on rack')<>r then raise exception 'Placement retry changed identity';end if;
 context:=public.inventory_reel_context(shop,location,product);
 if context#>>'{items,0,storagePosition}'<>'R-01 · Physical reel rack' or context#>>'{items,0,remainingLength}'<>'20'
 or (select inventory_value from public.product_stock where product_id=product)<>40 then raise exception 'Physical placement changed length/cost or lost POS position: %',context;end if;
 rev:=(context#>>'{items,0,revision}')::integer;
 begin perform public.update_inventory_reel(gen_random_uuid(),shop,location,reel,rev,'classify',jsonb_build_object('classification','sellable','price',null,'storagePosition','Untracked conflicting shelf'),'Attempt conflicting free-text placement');raise exception 'Structured bin position diverged from physical reel';exception when sqlstate '55000' then if sqlerrm<>'REEL_POSITION_REQUIRES_BIN_COMMAND' then raise;end if;end;
 begin perform public.inventory_planning_command(gen_random_uuid(),shop,location,'bin',bin,1,'{"code":"R-01","name":"Renamed occupied rack","active":true}','Rename occupied physical rack');raise exception 'Physical bin label diverged from reel';exception when sqlstate '55000' then if sqlerrm<>'STORAGE_BIN_IN_USE' then raise;end if;end;
 perform public.inventory_planning_command(gen_random_uuid(),shop,location,'position',position,1,args||jsonb_build_object('binId',second_bin,'reelRevision',rev),'Move source to second rack');
 context:=public.inventory_reel_context(shop,location,product);
 if context#>>'{items,0,storagePosition}'<>'R-02 · Second physical rack' then raise exception 'Physical position did not move through reel authority';end if;
 begin perform public.inventory_planning_command(gen_random_uuid(),shop,location,'position',position,2,args||jsonb_build_object('reelRevision',rev),'Stale reel placement editor');raise exception 'Stale physical placement accepted';exception when sqlstate '55000' then if sqlerrm<>'REEL_CONTEXT_CHANGED' then raise;end if;end;
 context:=public.inventory_planning_context(shop,location,'position',null,1,position);
 if context#>>'{record,bin_id}'<>second_bin::text or context#>>'{record,revision}'<>'2' or context#>>'{history,0,snapshot,current,product_name}'<>'Z physical source cable' then raise exception 'Failed placement left partial metadata or lost retained audit names';end if;
 context:=public.inventory_reel_context(p_shop_id=>shop,p_location_id=>location,p_product_id=>product,p_reel_id=>reel);
 if (select count(*) from jsonb_array_elements(context->'history') event where event->>'kind'='classification')<>2 then raise exception 'Physical placement retry duplicated movement history';end if;
 if exists(select 1 from jsonb_array_elements(context->'history') event where event->>'kind'='classification' and ((event->>'quantityChange')::numeric<>0 or (event->>'valueChange')::numeric<>0)) then raise exception 'Placement invented a physical balance';end if;
end;$$;
reset role;
-- Preserve an older ordinary source whose supplier link was never populated.
set local role authenticated;
select set_config('planning_test.legacy_product',public.save_product(current_setting('planning_test.shop')::uuid,null,'Legacy ordinary source','PLAN-OLD',null,3)::text,true);
reset role;
insert into public.vendor_invoices(shop_id,location_id,vendor_id,vendor_name_snapshot,invoice_number,status,issued_at,total_amount,created_by_profile_id,currency)
select current_setting('planning_test.shop')::uuid,current_setting('planning_test.location')::uuid,null,'Legacy unlinked supplier','PLAN-LEGACY-HISTORY','draft',null,7.50,profile_id,'EGP' from public.shop_memberships where shop_id=current_setting('planning_test.shop')::uuid and role='owner';
insert into public.vendor_invoice_items(vendor_invoice_id,product_id,quantity,unit_cost,total_cost)
select id,current_setting('planning_test.legacy_product')::uuid,3,2.5,7.50 from public.vendor_invoices where shop_id=current_setting('planning_test.shop')::uuid and invoice_number='PLAN-LEGACY-HISTORY';
update public.vendor_invoices set status='posted',issued_at=now() where shop_id=current_setting('planning_test.shop')::uuid and invoice_number='PLAN-LEGACY-HISTORY';
set local role authenticated;
do $$declare context jsonb;begin
 context:=public.supplier_price_history(current_setting('planning_test.shop')::uuid,current_setting('planning_test.location')::uuid,current_setting('planning_test.legacy_product')::uuid);
 if not exists(select 1 from jsonb_array_elements(context->'items') row where row->>'invoice_number'='PLAN-LEGACY-HISTORY' and row->>'vendor_id' is null and row->>'vendor_name'='Legacy unlinked supplier' and row->>'entered_unit_cost'='2.5' and row->>'base_unit_code'='legacy') then raise exception 'Unlinked legacy supplier price history disappeared: %',context;end if;
end;$$;
reset role;
insert into public.profiles(user_id,portal_id,display_name,email_snapshot)
select a.reader,s.portal_id,'Inventory planning reader',a.reader::text||'@planning.invalid' from planning_actors a join public.shops s on s.id=current_setting('planning_test.shop')::uuid;
set local role authenticated;
do $$declare shop uuid:=current_setting('planning_test.shop')::uuid;location uuid:=current_setting('planning_test.location')::uuid;role text;invitation jsonb;context jsonb;begin
 role:=public.save_shop_team_role(gen_random_uuid(),shop,null,'Inventory planning read','قراءة تخطيط المخزون',array['inventory.view','reports.view']);
 invitation:=public.invite_shop_member(gen_random_uuid(),shop,(select reader::text||'@planning.invalid' from planning_actors),'Inventory planning reader',role,array[location]);
 perform set_config('request.jwt.claim.sub',(select reader::text from planning_actors),true);perform public.accept_shop_invitation(gen_random_uuid(),(invitation->>'invitationCode')::uuid);
 context:=public.inventory_planning_context(shop,location,'bin');if context->>'canManage'<>'false' then raise exception 'Storage reader offered writes';end if;
 context:=public.shop_operational_report(shop,'reorder',location,current_date-9,current_date);
 if exists(select 1 from jsonb_array_elements(context->'items') row where row->>'vendor_id' is not null or row->>'vendor_name'<>'' or row->>'item_code' is not null or row->>'lead_days' is not null or row->>'suggested_quantity' is not null or row->>'basis'<>'supplier_access_required') then raise exception 'Reorder leaked private supplier configuration to inventory reader: %',context;end if;
 begin perform public.inventory_planning_command(gen_random_uuid(),shop,location,'bin',null,0,'{"code":"DENIED","name":"Denied bin","active":true}','Reader attempts metadata write');raise exception 'Read-only role changed storage';exception when insufficient_privilege then null;end;
 begin perform public.inventory_planning_context(shop,current_setting('planning_test.other_location')::uuid,'bin');raise exception 'Reader crossed storage location';exception when insufficient_privilege then null;end;
 begin perform public.supplier_price_history(shop,location);raise exception 'Inventory reader saw private purchase prices';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',(select owner::text from planning_actors),true);
end;$$;
reset role;
update public.subscriptions set trial_end_at=now()-interval '1 second' where profile_id in(select profile_id from public.shop_memberships where shop_id=current_setting('planning_test.shop')::uuid and role='owner');
set local role authenticated;
do $$declare shop uuid:=current_setting('planning_test.shop')::uuid;location uuid:=current_setting('planning_test.location')::uuid;begin
 perform public.inventory_planning_context(shop,location,'bin');perform public.supplier_price_history(shop,location);
 begin perform public.inventory_planning_command(gen_random_uuid(),shop,location,'bin',null,0,'{"code":"EXPIRED","name":"Expired plan write","active":true}','Expired subscription attempt');raise exception 'Expired plan changed storage';exception when insufficient_privilege then if sqlerrm<>'SHOP_SUBSCRIPTION_INACTIVE' then raise;end if;end;
end;$$;
set constraints all immediate;
reset role;
