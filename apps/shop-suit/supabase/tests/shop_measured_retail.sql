-- Full synthetic electrical merchant journey through the existing Shop RPCs.
-- Runner supplies BEGIN/ROLLBACK; all business writes use authenticated role.
create temporary table measured_merchant as select gen_random_uuid() owner_id;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id,owner_id::text||'@measured-merchant.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from measured_merchant;
select set_config('request.jwt.claim.sub',owner_id::text,true),set_config('request.jwt.claim.role','authenticated',true) from measured_merchant;
set local role authenticated;
do $$declare shop uuid;location uuid;staff uuid;customer uuid;vendor uuid;cable uuid;copper uuid;breaker uuid;socket uuid;conduit uuid;reel uuid;purchase uuid;request uuid:=gen_random_uuid();sale uuid;weighted uuid;counted uuid;line uuid;r jsonb;ctx jsonb;returned uuid;revision integer:=1;begin
 shop:=public.create_owner_shop('Electrical supply merchant','mixed'::public.business_mode);
 select id into location from public.shop_locations where shop_id=shop and is_default;
 select id into staff from public.shop_memberships where shop_id=shop and role='owner';
 customer:=public.save_customer(shop,null,'Electrical contractor',null,null,null,null);
 vendor:=public.save_vendor(shop,null,'Cable supplier',null,null,null,null,null,null);
 cable:=public.save_product(shop,null,'Cable 2.5 mm² Blue','CABLE-2.5-BLU',null,35);
 copper:=public.save_product(shop,null,'Copper Material','COPPER',null,200);
 breaker:=public.save_product(shop,null,'Circuit Breaker 20A','CB-20A','CB-20A-BAR',150);
 socket:=public.save_product(shop,null,'Electrical Socket','SOCKET',null,50);
 conduit:=public.save_product(shop,null,'PVC Conduit','CONDUIT',null,20);
 perform public.configure_product_measurement(shop,cable,'m','0.001','["m","cm","mm"]','Set new cable measurement');
 perform public.configure_product_measurement(shop,copper,'kg','0.001','["kg","g"]','Set new copper measurement');
 perform public.configure_product_measurement(shop,breaker,'ea','1','["ea"]','Set new breaker measurement');
 perform public.configure_product_measurement(shop,socket,'ea','1','["ea"]','Set new socket measurement');
 perform public.configure_product_measurement(shop,conduit,'m','0.01','["m","cm"]','Set new conduit measurement');
 reel:=public.save_product_packaging(gen_random_uuid(),shop,cable,null,'{"code":"REEL100","name":"100 meter reel","unitCode":"reel","containedQuantity":"100","containedUnitCode":"m","salePrice":3200,"barcode":"CABLE-REEL100","canPurchase":true,"canSell":true,"defaultPurchase":true}');
 purchase:=public.create_supplier_purchase(request,shop,vendor,'CABLE-001',current_date,null,jsonb_build_array(jsonb_build_object('product_id',cable,'quantity','1','unit_cost',2500,'package_id',reel,'package_version',1,'measurement_revision',1)));
 if public.create_supplier_purchase(request,shop,vendor,'CABLE-001',current_date,null,jsonb_build_array(jsonb_build_object('product_id',cable,'quantity','1','unit_cost',2500,'package_id',reel,'package_version',1,'measurement_revision',1)))<>purchase then raise exception 'Measured purchase replay mismatch';end if;
 if (select quantity_on_hand from public.product_stock where product_id=cable)<>100 or (select inventory_value from public.product_stock where product_id=cable)<>2500 then raise exception 'Reel receiving quantity or FIFO cost incorrect';end if;
 sale:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','12.5','unit_code','m','measurement_revision',1)));
 perform public.issue_location_sale(gen_random_uuid(),shop,location,sale);
 if (select quantity_on_hand from public.product_stock where product_id=cable)<>87.5 then raise exception 'Central cable journey did not leave exactly87.5m';end if;
 if (select total_amount from public.invoices where id=sale)<>437.50 then raise exception 'Cable price not35/m';end if;
 if (select sum(-quantity_change*unit_cost_snapshot) from public.inventory_movements where reference_id=sale and movement_type='out')<>312.5 then raise exception 'Cable FIFO COGS not312.5';end if;
 r:=public.get_location_sale_receipt(shop,location,sale);
 if r#>>'{lines,0,measurement,baseUnitCode}'<>'m' or r#>>'{lines,0,measurement,enteredQuantity}'<>'12.5' then raise exception 'Receipt lost frozen measured quantity: %',r;end if;
 -- A centimeter sale resolves to canonical meters, without separate stock.
 r:=public.quote_pos_sale(shop,location,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','250','unit_code','cm','measurement_revision',1)));
 if (r->>'total')::numeric<>87.5 then raise exception '250cm quote not2.5m at35/m';end if;
 weighted:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','250','unit_code','cm','measurement_revision',1)));
 perform public.issue_location_sale(gen_random_uuid(),shop,location,weighted);
 if (select quantity_on_hand from public.product_stock where product_id=cable)<>85 then raise exception 'Centimeter sale deducted incorrect stock';end if;
 -- Weighted stock uses the same purchase, quote and issuance authorities.
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'COPPER-001',current_date,null,jsonb_build_array(jsonb_build_object('product_id',copper,'quantity','5','unit_cost',100,'unit_code','kg','measurement_revision',1)));
 weighted:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',copper,'quantity','250','unit_code','g','measurement_revision',1)));
 perform public.issue_location_sale(gen_random_uuid(),shop,location,weighted);
 if (select quantity_on_hand from public.product_stock where product_id=copper)<>4.75 or (select total_amount from public.invoices where id=weighted)<>50 then raise exception 'Weighted250g journey incorrect';end if;
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'BREAKERS-001',current_date,null,jsonb_build_array(jsonb_build_object('product_id',breaker,'quantity','10','unit_cost',100,'unit_code','ea','measurement_revision',1)));
 weighted:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',breaker,'quantity','2','unit_code','ea','measurement_revision',1)));
 perform public.issue_location_sale(gen_random_uuid(),shop,location,weighted);
 if (select quantity_on_hand from public.product_stock where product_id=breaker)<>8 then raise exception 'Piece product journey incorrect';end if;
 begin perform public.quote_pos_sale(shop,location,jsonb_build_array(jsonb_build_object('item_type','product','source_id',breaker,'quantity','0.3','unit_code','ea','measurement_revision',1)));raise exception 'Fractional breaker accepted';exception when sqlstate '22023' then if sqlerrm<>'INVALID_MEASUREMENT_PRECISION' then raise;end if;end;
 -- Product settings cannot relabel historical balances, including zero balances.
 begin perform public.configure_product_measurement(shop,copper,'g','1','["g"]','Unsafe historical change');raise exception 'Used measurement relabel accepted';exception when sqlstate '55000' then if sqlerrm<>'MEASUREMENT_REQUIRES_UNUSED_PRODUCT' then raise;end if;end;
 -- Measured count preserves canonical increments, then partial return restores
 -- original FIFO lineage and reduces the original receivable.
 counted:=public.record_stock_count(gen_random_uuid(),shop,cable,84.875,now(),'Measured shelf count','ELEC-COUNT-1',null);
 if (select quantity_on_hand from public.product_stock where product_id=cable)<>84.875 then raise exception 'Measured count rounded';end if;
 select id into line from public.invoice_items where invoice_id=sale;
 ctx:=public.preview_sale_return(shop,location,sale,jsonb_build_array(jsonb_build_object('lineId',line,'quantity',1.25,'disposition','resellable')));
 returned:=public.create_sale_return(gen_random_uuid(),shop,location,sale,jsonb_build_array(jsonb_build_object('lineId',line,'quantity',1.25,'disposition','resellable')),'Eligible measured return',ctx);
 if (select quantity_on_hand from public.product_stock where product_id=cable)<>86.125 then raise exception 'Measured return rounded or restocked incorrectly';end if;
 -- Packaging stays distinct from mixed-product bundles and uses its fixed price.
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'CABLE-002',current_date,null,jsonb_build_array(jsonb_build_object('product_id',cable,'quantity','2','unit_cost',2500,'package_id',reel,'package_version',1,'measurement_revision',1)));
 if (select quantity_on_hand from public.product_stock where product_id=cable)<>286.125 then raise exception 'Two100m reels did not add200m';end if;
 r:=public.quote_pos_sale(shop,location,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','1','package_id',reel,'package_version',1,'measurement_revision',1)));
 if (r->>'total')::numeric<>3200 then raise exception 'Package-specific reel price ignored';end if;
 weighted:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','1','package_id',reel,'package_version',1,'measurement_revision',1)));
 perform public.issue_location_sale(gen_random_uuid(),shop,location,weighted);
 if (select total_amount from public.invoices where id=weighted)<>3200 or (select quantity_on_hand from public.product_stock where product_id=cable)<>186.125 then raise exception 'Reel sale price/stock mismatch';end if;
 begin perform public.save_product(shop,null,'Barcode collision',null,'CABLE-REEL100',1);raise exception 'Ambiguous package barcode accepted';exception when unique_violation then if sqlerrm<>'BARCODE_IDENTITY_CONFLICT' then raise;end if;end;
 -- Client factors and canonical quantities cannot change the server result.
 r:=public.quote_pos_sale(shop,location,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','250','unit_code','cm','measurement_revision',1,'base_quantity',999999,'conversion_factor',999999,'unit_price',0)));
 if (r->>'total')::numeric<>87.5 then raise exception 'Client conversion or price override trusted';end if;
 -- Bounded catalog projection resolves package identity and contains no costs.
 r:=public.pos_catalog_search(shop,location,null,null,'CABLE-REEL100',1,30);
 if jsonb_array_length(r->'items')<>1 or r#>>'{items,0,unitSelection}'<>'package:'||reel::text
   or (r#>>'{items,0,unitPrice}')::numeric<>3200 or r#>>'{items,0,measurement,baseUnitCode}'<>'m' then raise exception 'Package barcode projection lost identity/price: %',r;end if;
 r:=public.get_purchase(shop,purchase);
 if r#>>'{items,0,measurement,enteredUnitCode}'<>'reel' or r#>>'{items,0,measurement,baseQuantity}'<>'100' then raise exception 'Supplier document lost measurement snapshot';end if;
 begin perform public.create_supplier_purchase(request,shop,vendor,'CHANGED',current_date,null,jsonb_build_array(jsonb_build_object('product_id',cable,'quantity','1','unit_cost',2500,'package_id',reel,'package_version',1,'measurement_revision',1)));raise exception 'Changed purchase replay accepted';exception when unique_violation then if sqlerrm<>'PURCHASE_REQUEST_CONFLICT' then raise;end if;end;
 begin perform public.quote_pos_sale(shop,location,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','1','unit_code','m','measurement_revision',0)));raise exception 'Stale unit revision accepted';exception when sqlstate '55000' then if sqlerrm<>'MEASUREMENT_CONTEXT_CHANGED' then raise;end if;end;
 -- Dry runs perform validation only; measured opening stock is canonical and exact.
 r:=public.catalog_import(gen_random_uuid(),shop,'products','[{"name":"Imported measured wire","sku":"CSV-WIRE","sale_price":"10.123456","opening_stock":"2.125","opening_cost":"4.123456","base_unit_code":"m","quantity_increment":"0.001"}]',true);
 if not(r->>'valid')::boolean or exists(select 1 from public.products where shop_id=shop and sku='CSV-WIRE') then raise exception 'Measured CSV dry run mutated or rejected: %',r;end if;
 r:=public.catalog_import(gen_random_uuid(),shop,'products','[{"name":"Imported measured wire","sku":"CSV-WIRE","sale_price":"10.123456","opening_stock":"2.125","opening_cost":"4.123456","base_unit_code":"m","quantity_increment":"0.001"}]',false);
 if not(r->>'valid')::boolean or not exists(select 1 from public.products p join public.product_stock st on st.product_id=p.id where p.shop_id=shop and p.sku='CSV-WIRE' and p.measurement_status='active' and st.quantity_on_hand=2.125) then raise exception 'Measured CSV import failed: %',r;end if;
 r:=public.catalog_import(gen_random_uuid(),shop,'products','[{"name":"Imported fractional breaker","sku":"CSV-BAD","sale_price":"10","opening_stock":"0.3","base_unit_code":"ea","quantity_increment":"1"}]',true);
 if (r->>'valid')::boolean then raise exception 'CSV accepted fractional pieces';end if;
 -- Historic invoices/receipts do not change when a packaging version is archived.
 perform public.save_product_packaging(gen_random_uuid(),shop,cable,reel,'{"archive":true}');
 if public.create_supplier_purchase(request,shop,vendor,'CABLE-001',current_date,null,jsonb_build_array(jsonb_build_object('product_id',cable,'quantity','1','unit_cost',2500,'package_id',reel,'package_version',1,'measurement_revision',1)))<>purchase then raise exception 'Archived packaging broke committed purchase replay';end if;
 r:=public.get_location_sale_receipt(shop,location,weighted);
 if r#>>'{lines,0,measurement,packageName}'<>'100 meter reel' then raise exception 'Archived package rewrote receipt';end if;
 begin perform public.quote_pos_sale(shop,location,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','1','package_id',reel,'package_version',1,'measurement_revision',1)));raise exception 'Archived package accepted for new sale';exception when sqlstate '55000' then if sqlerrm<>'PACKAGE_CONTEXT_CHANGED' then raise;end if;end;
 r:=public.shop_operational_report(shop,'inventory',location,null,null,1,20);
 if r#>>'{summary,quantityOnHand}' is not null or position(' m' in r#>>'{summary,quantityByUnit}')=0 or position(' kg' in r#>>'{summary,quantityByUnit}')=0 then raise exception 'Report added incompatible stock units: %',r->'summary';end if;
 -- A forged actor cannot read configuration, configure products or save packaging.
 declare original_actor uuid:=auth.uid();begin
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  begin perform public.product_measurement_options(shop,cable);raise exception 'Cross-tenant measurement read accepted';exception when insufficient_privilege then null;end;
  begin perform public.configure_product_measurement(shop,cable,'m','0.001','["m"]','Cross tenant attempt');raise exception 'Cross-tenant configuration accepted';exception when insufficient_privilege then null;end;
  begin perform public.save_product_packaging(gen_random_uuid(),shop,cable,null,'{}');raise exception 'Cross-tenant packaging accepted';exception when insufficient_privilege then null;end;
  if exists(select 1 from public.product_packagings where shop_id=shop) then raise exception 'Packaging RLS leaked cross-tenant rows';end if;
  perform set_config('request.jwt.claim.sub',original_actor::text,true);
 end;
end;$$;
reset role;
