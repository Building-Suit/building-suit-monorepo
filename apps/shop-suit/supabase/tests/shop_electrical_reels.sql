-- Public entry owns execution; API callers retain no private adapter grant.
do $$begin
 if not (select prosecdef from pg_catalog.pg_proc where oid='public.shop_catalog_media(uuid,text,jsonb)'::regprocedure)
 or has_function_privilege('anon','public.shop_catalog_media(uuid,text,jsonb)','execute')
 or has_function_privilege('authenticated','shop_private.catalog_media(uuid,text,jsonb)','execute') then
  raise exception 'Catalog RPC authority boundary changed';
 end if;
end;$$;
-- Synthetic physical reel journey. Runner supplies BEGIN/ROLLBACK.
create temporary table electrical_reel_fixture as select gen_random_uuid() actor;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select actor,actor::text||'@electrical-reel.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from electrical_reel_fixture;
select set_config('request.jwt.claim.sub',actor::text,true),set_config('request.jwt.claim.role','authenticated',true) from electrical_reel_fixture;
set local role authenticated;
do $$declare shop uuid;location uuid;staff uuid;customer uuid;vendor uuid;cable uuid;red uuid;split_cable uuid;reel uuid;pack uuid;split_pack uuid;purchase uuid;sale uuid;cut_sale uuid;line uuid;returned uuid;returned_reel uuid;sealed_sale uuid;op uuid;op_result uuid;revision integer;plan jsonb;return_lines jsonb;
 request uuid:=gen_random_uuid();result jsonb;before_qty numeric;begin
 shop:=public.create_owner_shop('Physical electrical merchant','mixed'::public.business_mode);
 select id into location from public.shop_locations where shop_id=shop and is_default;
 select id into staff from public.shop_memberships where shop_id=shop and role='owner';
 customer:=public.save_customer(shop,null,'Cable customer',null,null,null,null);
 vendor:=public.save_vendor(shop,null,'Reel supplier',null,null,null,null,null,null);
 cable:=public.save_product(shop,null,'Cable Blue','ELEC-BLUE',null,35);
 red:=public.save_product(shop,null,'Cable Red','ELEC-RED',null,36);
 split_cable:=public.save_product(shop,null,'Continuous cable','ELEC-SPLIT',null,10);
 perform public.configure_product_measurement(shop,cable,'m','0.001','["m","cm"]','Physical cable setup');
 perform public.configure_product_measurement(shop,red,'m','0.001','["m"]','Red variant setup');
 perform public.configure_product_measurement(shop,split_cable,'m','0.001','["m"]','Continuous cable setup');
 result:=public.save_product_technical_details(shop,cable,0,'Cable 2.5','{"brand":"Schneider","cross_section_mm2":"2.5","color":"Blue","core_count":"3"}',true,'Physical blue cable configuration');
 perform public.save_product_technical_details(shop,red,0,'Cable 2.5','{"brand":"Schneider","cross_section_mm2":"2.5","color":"Red","core_count":"3"}',false,'Independent red cable variant');
 perform public.save_product_technical_details(shop,split_cable,0,null,'{}',true,'Track continuous cable reels');
 if result->>'revision'<>'1' or result#>>'{attributes,cross_section_mm2}'<>'2.5' then raise exception 'Typed cross-section snapshot lost';end if;
 -- Repeating a technical save is idempotent; variants keep distinct stock IDs.
 if public.save_product_technical_details(shop,cable,0,'Cable 2.5','{"brand":"Schneider","cross_section_mm2":"2.5","color":"Blue","core_count":"3"}',true,'Physical blue cable configuration')->>'revision'<>'1' then raise exception 'Technical replay created revision';end if;
 if (public.product_technical_options(shop,cable)->>'familyId') is distinct from (public.product_technical_options(shop,red)->>'familyId') then raise exception 'Variants did not share only their family';end if;
 begin perform public.save_product_technical_details(shop,red,1,'Cable 2.5','{"core_count":"1.5"}',false,'Invalid fractional cores');raise exception 'Fractional core count accepted';exception when invalid_parameter_value then if sqlerrm<>'PRODUCT_ATTRIBUTE_RANGE' then raise;end if;end;
 begin perform public.save_product(shop,red,'Cable Red',null,null,36);raise exception 'Family lost independent SKU';exception when check_violation then if sqlerrm<>'VARIANT_FAMILY_REQUIRES_SKU' then raise;end if;end;
 result:=public.list_products(shop,'Schneider 2.5 Blue',null,1,20);
 if (result->>'total')::integer<>1 or result#>>'{items,0,id}'<>cable::text then raise exception 'Technical multi-term search failed: %',result;end if;
 pack:=public.save_product_packaging(gen_random_uuid(),shop,cable,null,'{"code":"R100","name":"100 meter reel","unitCode":"reel","containedQuantity":"100","containedUnitCode":"m","salePrice":3200,"canPurchase":true,"canSell":true}');
 purchase:=public.create_supplier_purchase(request,shop,vendor,'REEL100',current_date,null,jsonb_build_array(jsonb_build_object('product_id',cable,'quantity','1','unit_cost',2500,'package_id',pack,'package_version',1,'measurement_revision',1,'reel_barcodes',jsonb_build_array('PHYSICAL-100'))));
 select id into reel from public.inventory_reels where shop_id=shop and product_id=cable;
 if reel is null or (select remaining_length from public.inventory_reels where id=reel)<>100 then raise exception 'Purchase did not create one100m physical reel';end if;
 set constraints all immediate;set constraints all deferred;
 if public.create_supplier_purchase(request,shop,vendor,'REEL100',current_date,null,jsonb_build_array(jsonb_build_object('product_id',cable,'quantity','1','unit_cost',2500,'package_id',pack,'package_version',1,'measurement_revision',1,'reel_barcodes',jsonb_build_array('PHYSICAL-100'))))<>purchase
 or (select count(*) from public.inventory_reels where product_id=cable)<>1 then raise exception 'Purchase retry duplicated a physical reel';end if;
 sale:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','12.5','unit_code','m','measurement_revision',1,'reel_id',reel,'cutting_loss','0.02')));
 perform public.issue_location_sale(gen_random_uuid(),shop,location,sale);
 cut_sale:=sale;
 select id into line from public.invoice_items where invoice_id=sale;
 if (select quantity_on_hand from public.product_stock where product_id=cable)<>87.48 or (select remaining_length from public.inventory_reels where id=reel)<>87.48 then raise exception 'Cut/waste did not reconcile to87.48m';end if;
 if (select total_amount from public.invoices where id=sale)<>437.5 then raise exception 'Customer charged for cutting loss';end if;
 if (select sum(-quantity_change*unit_cost_snapshot) from public.inventory_movements where reference_id=sale and invoice_item_id=line)<>312.5 then raise exception 'Physical reel sale lost original FIFO cost';end if;
 if not exists(select 1 from public.inventory_reel_cuts where reel_id=reel and invoice_item_id=line and requested_length=12.5 and actual_cut_length=12.52 and cutting_loss=0.02 and resulting_remaining_length=87.48) then raise exception 'Requested/actual/loss audit missing';end if;
 result:=public.get_location_sale_receipt(shop,location,sale);
 if result#>>'{lines,0,measurement,reelAllocations,0,barcode}'<>'PHYSICAL-100' or result#>>'{lines,0,measurement,physicalConsumedQuantity}'<>'12.52' then raise exception 'Receipt did not freeze physical allocation';end if;
 if coalesce((select quantity_on_hand from public.product_stock where product_id=red),0)<>0 then raise exception 'Variant stock leaked';end if;
 set constraints all immediate;set constraints all deferred;
 -- Two50m reels cannot fulfill80m continuously; explicit split permits50+30.
 split_pack:=public.save_product_packaging(gen_random_uuid(),shop,split_cable,null,'{"code":"R50","name":"50 meter reel","unitCode":"reel","containedQuantity":"50","containedUnitCode":"m","canPurchase":true,"canSell":true}');
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'TWO-50',current_date,null,jsonb_build_array(jsonb_build_object('product_id',split_cable,'quantity','2','unit_cost',250,'package_id',split_pack,'package_version',1,'measurement_revision',1)));
 begin perform public.quote_pos_sale(shop,location,jsonb_build_array(jsonb_build_object('item_type','product','source_id',split_cable,'quantity','80','unit_code','m','measurement_revision',1)));raise exception 'Two50m reels fulfilled80m continuously';exception when check_violation then if sqlerrm<>'CONTINUOUS_LENGTH_UNAVAILABLE' then raise;end if;end;
 sale:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',split_cable,'quantity','80','unit_code','m','measurement_revision',1)));
 begin perform public.issue_location_sale(gen_random_uuid(),shop,location,sale);raise exception 'Continuous issuance accepted split stock';exception when check_violation then if sqlerrm<>'CONTINUOUS_LENGTH_UNAVAILABLE' then raise;end if;end;
 if (select status from public.invoices where id=sale)<>'draft' or (select quantity_on_hand from public.product_stock where product_id=split_cable)<>100 then raise exception 'Failed continuous sale partially committed';end if;
 sale:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',split_cable,'quantity','80','unit_code','m','measurement_revision',1,'allow_split',true)));
 perform public.issue_location_sale(gen_random_uuid(),shop,location,sale);
 if (select quantity_on_hand from public.product_stock where product_id=split_cable)<>20 or (select count(*) from public.inventory_reel_cuts where invoice_item_id in(select id from public.invoice_items where invoice_id=sale))<>2 then raise exception 'Explicit split did not allocate two physical pieces';end if;
 set constraints all immediate;set constraints all deferred;
 result:=public.inventory_reel_context(shop,location,cable,null,1,20,reel,1);
 if result#>>'{summary,largestContinuous}'<>'87.48' or jsonb_array_length(result->'history')<2 then raise exception 'Physical reel context/history lost';end if;
 select r.revision into revision from public.inventory_reels r where r.id=reel;
 op:=gen_random_uuid();
 op_result:=public.update_inventory_reel(op,shop,location,reel,revision,'classify','{"classification":"discounted","price":"30","storagePosition":"A2"}','Discounted blue cable remnant');
 result:=public.pos_catalog_search(p_shop_id=>shop,p_location_id=>location,p_barcode=>'PHYSICAL-100');
 if result#>>'{items,0,reelId}'<>reel::text or (result#>>'{items,0,reelPrice}')::numeric<>30 or result#>>'{items,0,measurement,reelTracking}'<>'true' then raise exception 'Physical barcode lost source or remnant price: %',result;end if;
 result:=public.quote_pos_sale(shop,location,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','1','unit_code','m','measurement_revision',1,'reel_id',reel)));
 if (result->>'total')::numeric<>30 then raise exception 'Explicit remnant source lost authoritative price';end if;
 begin perform public.correct_location_sale(gen_random_uuid(),shop,location,cut_sale,clock_timestamp(),'Legacy full return attempt');raise exception 'Legacy correction bypassed cable return review';exception when check_violation then if sqlerrm<>'REEL_RETURN_REQUIRES_LINE_WORKFLOW' then raise;end if;end;

 if public.update_inventory_reel(op,shop,location,reel,revision,'classify','{"classification":"discounted","price":"30","storagePosition":"A2"}','Discounted blue cable remnant')<>op_result then raise exception 'Reel operation replay changed identity';end if;
 begin perform public.update_inventory_reel(gen_random_uuid(),shop,location,reel,revision,'classify','{"classification":"damaged"}','Stale reel edit');raise exception 'Stale reel edit accepted';exception when sqlstate '55000' then if sqlerrm<>'REEL_CONTEXT_CHANGED' then raise;end if;end;
 result:=public.quote_pos_sale(shop,location,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','1','unit_code','m','measurement_revision',1,'reel_id',reel)));
 if(result->>'total')::numeric<>30 then raise exception 'Authorized remnant price ignored';end if;
 -- Policy changes affect future sales, while this original cut still requires approval.
 perform public.save_product_technical_details(shop,cable,1,'Cable 2.5','{"brand":"Schneider","cross_section_mm2":"2.5","color":"Blue","core_count":"3"}',true,'Future cut return policy','{"unopenedResellable":true,"cutRequiresManagerApproval":false}');
 return_lines:=jsonb_build_array(jsonb_build_object('lineId',line,'quantity',1.25,'disposition','resellable'));
 begin perform public.preview_sale_return(shop,location,cut_sale,return_lines);raise exception 'Unapproved historical cut return accepted';exception when insufficient_privilege then if sqlerrm<>'REEL_CUT_RETURN_APPROVAL_REQUIRED' then raise;end if;end;
 return_lines:=jsonb_build_array(jsonb_build_object('lineId',line,'quantity',1.25,'disposition','resellable','approveCut',true));
 plan:=public.preview_sale_return(shop,location,cut_sale,return_lines);
 returned:=public.create_sale_return(gen_random_uuid(),shop,location,cut_sale,return_lines,'Manager approves original cut return',plan);
 select id into returned_reel from public.inventory_reels where source_return_id=returned;
 if returned_reel is null or(select remaining_length from public.inventory_reels where id=reel)<>87.48 or(select remaining_length from public.inventory_reels where id=returned_reel)<>1.25
 or(select quantity_on_hand from public.product_stock where product_id=cable)<>88.73 then raise exception 'Returned piece was incorrectly spliced into original reel';end if;
 if not exists(select 1 from public.inventory_reel_return_approvals where return_id=returned and line_id=line and quantity=1.25) then raise exception 'Manager approval audit missing';end if;
 set constraints all immediate;set constraints all deferred;
 select r.revision into revision from public.inventory_reels r where r.id=returned_reel;
 op:=gen_random_uuid();
 perform public.update_inventory_reel(op,shop,location,returned_reel,revision,'count',jsonb_build_object('quantity','1.2','countedAt',clock_timestamp(),'reference','REEL-COUNT-1'),'Physical returned-piece count');
 if(select quantity_on_hand from public.product_stock where product_id=cable)<>88.68 or not exists(select 1 from jsonb_array_elements(public.list_stock_counts(shop,cable,1,20)->'items') c where c->>'id'=op::text and(c->>'variance_quantity')::numeric=-0.05) then raise exception 'Reel count did not reconcile/audit';end if;
 select r.revision into revision from public.inventory_reels r where r.id=returned_reel;
 perform public.update_inventory_reel(gen_random_uuid(),shop,location,returned_reel,revision,'classify','{"classification":"scrap"}','Damaged returned remnant scrap');
 if(select quantity_on_hand from public.product_stock where product_id=cable)<>87.48 or(select remaining_length from public.inventory_reels where id=returned_reel)<>0 then raise exception 'Scrap did not reduce physical and valued stock';end if;
 select r.revision into revision from public.inventory_reels r where r.id=returned_reel;
 perform public.update_inventory_reel(gen_random_uuid(),shop,location,returned_reel,revision,'archive','{}','Archive empty returned remnant');
 return_lines:=jsonb_build_array(jsonb_build_object('lineId',line,'quantity',0.5,'disposition','damaged','approveCut',true));
 plan:=public.preview_sale_return(shop,location,cut_sale,return_lines);
 perform public.create_sale_return(gen_random_uuid(),shop,location,cut_sale,return_lines,'Damaged cut returned without restock',plan);
 if(select quantity_on_hand from public.product_stock where product_id=cable)<>87.48 then raise exception 'Damaged cable return restored stock';end if;
 set constraints all immediate;set constraints all deferred;
 -- Customerless cash checkout uses the same physical plan and fixed package price.
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'SEALED-CASH',current_date,null,jsonb_build_array(jsonb_build_object('product_id',cable,'quantity','1','unit_cost',2500,'package_id',pack,'package_version',1,'measurement_revision',1)));
 perform public.open_cash_shift(gen_random_uuid(),shop,location,'main',0,'Physical reel counter shift');
 sealed_sale:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,null,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','1','package_id',pack,'package_version',1,'measurement_revision',1)));
 perform public.checkout_pos_sale(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),null,shop,location,sealed_sale,3200,clock_timestamp(),'cash','REEL-CASH');
 result:=public.get_location_sale_receipt(shop,location,sealed_sale);
 if(result->>'total')::numeric<>3200 or result#>>'{lines,0,measurement,reelAllocations,0,kind}'<>'sealed_sale' or(select quantity_on_hand from public.product_stock where product_id=cable)<>87.48 then raise exception 'Customerless full-reel checkout lost price/stock/receipt';end if;
 set constraints all immediate;set constraints all deferred;
 begin perform public.adjust_stock(gen_random_uuid(),shop,cable,1,25,'Invalid aggregate-only receipt');set constraints all immediate;raise exception 'Tracked stock drift accepted';exception when check_violation then if sqlerrm<>'REEL_STOCK_RECONCILIATION_REQUIRED' then raise;end if;end;
 set constraints all deferred;
 if (select quantity_on_hand from public.product_stock where product_id=cable)<>87.48 then raise exception 'Rejected aggregate write changed stock';end if;
 begin perform public.save_product(shop,null,'Reel barcode collision',null,'PHYSICAL-100',1);raise exception 'Physical reel/product barcode collision accepted';exception when unique_violation then if sqlerrm<>'BARCODE_IDENTITY_CONFLICT' then raise;end if;end;
 -- Supplier withdrawals specify a physical source and keep retry/audit/batch balance exact.
 declare supplier_purchase uuid;supplier_line uuid;supplier_reel uuid;return_request uuid:=gen_random_uuid();returned_at timestamptz:=clock_timestamp();begin
  supplier_purchase:=public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'SUPPLIER-REEL',current_date,null,jsonb_build_array(jsonb_build_object('product_id',split_cable,'quantity','1','unit_cost',250,'package_id',split_pack,'package_version',1,'measurement_revision',1)));
  select id into supplier_line from public.vendor_invoice_items where vendor_invoice_id=supplier_purchase;
  select r.id into supplier_reel from public.inventory_reels r join public.inventory_batches b on b.id=r.batch_id where b.source_id=supplier_purchase;
  result:=public.purchase_reel_options(shop,supplier_purchase,supplier_line);
  if result#>>'{items,0,id}'<>supplier_reel::text or public.get_purchase(shop,supplier_purchase)#>>'{items,0,reelTracking}'<>'true' then raise exception 'Purchase source choices missing or out of scope';end if;
  result:=jsonb_build_array(jsonb_build_object('vendor_invoice_item_id',supplier_line,'quantity','2.5','reel_id',supplier_reel));
  returned:=public.record_purchase_return(return_request,shop,supplier_purchase,returned_at,'Supplier cable return',null,result);
  if public.record_purchase_return(return_request,shop,supplier_purchase,returned_at,'Supplier cable return',null,result)<>returned then raise exception 'Supplier reel retry duplicated withdrawal';end if;
  if(select remaining_length from public.inventory_reels where id=supplier_reel)<>47.5 then raise exception 'Supplier return did not withdraw selected source';end if;
  set constraints all immediate;set constraints all deferred;
  supplier_purchase:=public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'VOID-REEL',current_date,null,jsonb_build_array(jsonb_build_object('product_id',split_cable,'quantity','1','unit_cost',250,'package_id',split_pack,'package_version',1,'measurement_revision',1)));
  perform public.void_supplier_purchase(shop,supplier_purchase);
  if exists(select 1 from public.inventory_reels r join public.inventory_batches b on b.id=r.batch_id where b.source_id=supplier_purchase and r.remaining_length<>0) then raise exception 'Purchase void left physical stock';end if;
  set constraints all immediate;set constraints all deferred;
 end;
 declare original_actor uuid:=auth.uid();begin
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  if exists(select 1 from public.inventory_reels where shop_id=shop) or exists(select 1 from public.product_attribute_values where shop_id=shop) then raise exception 'Physical/technical RLS leaked cross-tenant data';end if;
  begin perform public.pos_reel_options(shop,location,cable);raise exception 'Cross-tenant cashier reel lookup accepted';exception when insufficient_privilege then null;end;
  begin perform public.inventory_reel_context(shop,location,cable);raise exception 'Cross-tenant reel history accepted';exception when insufficient_privilege then null;end;
  begin perform public.save_product_technical_details(shop,cable,2,null,'{}',true,'Cross tenant attempt');raise exception 'Cross-tenant technical edit accepted';exception when insufficient_privilege then null;end;
  perform set_config('request.jwt.claim.sub',original_actor::text,true);
 end;
end;$$;
set constraints all immediate;
reset role;
