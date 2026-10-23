-- Public merchant commands only; outer runner owns the transaction.
create temporary table trade_pricing_actor as select gen_random_uuid() actor,gen_random_uuid() cashier,gen_random_uuid() foreign_owner;
grant select on trade_pricing_actor to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select actor,actor::text||'@trade-pricing.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from (select actor from trade_pricing_actor union all select cashier from trade_pricing_actor union all select foreign_owner from trade_pricing_actor) identities;
select set_config('request.jwt.claim.sub',actor::text,true),set_config('request.jwt.claim.role','authenticated',true) from trade_pricing_actor;
set local role authenticated;
do $$declare shop uuid;location uuid;staff uuid;customer uuid;other_customer uuid;vendor uuid;cable uuid;piece uuid;pack uuid;g uuid;rule uuid;contract uuid;invoice uuid;override_invoice uuid;
 unit_product uuid;unit_rule uuid;foreign_shop uuid;foreign_product uuid;foreign_rule uuid;op uuid:=gen_random_uuid();args jsonb;r jsonb;again jsonb;lines jsonb;quote jsonb;before_snapshot jsonb;actor uuid:=auth.uid();begin
 shop:=public.create_owner_shop('Trade pricing merchant','multi','mixed');
 select id into location from public.shop_locations where shop_id=shop and is_default;
 select id into staff from public.shop_memberships where shop_id=shop and role='owner';
 customer:=public.save_customer(shop,null,'Electrical contractor',null,null,null,null);
 other_customer:=public.save_customer(shop,null,'Retail customer',null,null,null,null);
 vendor:=public.save_vendor(shop,null,'Trade supplier',null,null,null,null,null,null);
 cable:=public.save_product(shop,null,'Trade cable','TRADE-CABLE',null,35);
 piece:=public.save_product(shop,null,'Legacy piece','TRADE-PIECE',null,50);
 perform public.configure_product_measurement(shop,cable,'m','0.001','["m","cm"]','Trade cable stock configuration');
 pack:=public.save_product_packaging(gen_random_uuid(),shop,cable,null,'{"code":"TRADE-R100","name":"100m reel","unitCode":"reel","containedQuantity":"100","containedUnitCode":"m","salePrice":3200,"canPurchase":true,"canSell":true}');
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'TRADE-STOCK',current_date,null,jsonb_build_array(jsonb_build_object('product_id',cable,'quantity','10','unit_cost',2500,'package_id',pack,'package_version',1,'measurement_revision',1)));
 args:='{"revision":0,"name":"Contractors","active":true}';
 r:=public.save_trade_configuration(op,shop,'group',args,'Create contractor group');g:=(r->>'id')::uuid;
 if public.save_trade_configuration(op,shop,'group',args,'Create contractor group')<>r then raise exception 'Group replay changed identity';end if;
 if exists(select 1 from public.invoices where shop_id=shop) then raise exception 'Group configuration created a financial document';end if;
 begin perform public.save_trade_configuration(op,shop,'group',args,'Changed replay reason');raise exception 'Conflicting request accepted';exception when unique_violation then if sqlerrm<>'TRADE_REQUEST_CONFLICT' then raise;end if;end;
 perform public.save_trade_configuration(gen_random_uuid(),shop,'assignment',jsonb_build_object('revision',0,'customerId',customer,'groupId',g),'Assign contractor group');
 begin perform public.save_trade_configuration(gen_random_uuid(),shop,'assignment',jsonb_build_object('revision',0,'customerId',customer,'groupId',g),'Stale assignment');raise exception 'Stale assignment accepted';exception when sqlstate '55000' then if sqlerrm<>'TRADE_CONTEXT_CHANGED' then raise;end if;end;
 args:=jsonb_build_object('revision',0,'productId',cable,'unitCode','m','minimumQuantity','100','price','33','startsAt',clock_timestamp()-interval '1 day','priority',0,'active',true);
 r:=public.save_trade_configuration(gen_random_uuid(),shop,'price',args,'100m quantity break');rule:=(r->>'id')::uuid;
 lines:=jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','100','unit_code','m','measurement_revision',1));
 quote:=public.quote_customer_sale(shop,location,null,lines,true);
 if (quote->>'total')::numeric<>3300 or quote->>'tradePricingApplied'<>'true' or quote#>>'{lines,0,measurement,tradePricing,source}'<>'quantity_break' then raise exception 'Canonical quantity break incorrect: %',quote;end if;
 -- Splitting the same SKU into50m and5000cm still reaches the canonical100m break.
 lines:=jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','50','unit_code','m','measurement_revision',1),jsonb_build_object('item_type','product','source_id',cable,'quantity','5000','unit_code','cm','measurement_revision',1));
 quote:=public.quote_customer_sale(shop,location,null,lines,true);
 if (quote->>'total')::numeric<>3300 then raise exception 'Split cart lost aggregate quantity break';end if;
 lines:=jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','100','unit_code','m','measurement_revision',1));
 perform public.save_trade_configuration(gen_random_uuid(),shop,'price',args||jsonb_build_object('groupId',g,'price','32'),'Contractor group price');
 perform public.save_trade_configuration(gen_random_uuid(),shop,'price',args||jsonb_build_object('price','1','priority',1000,'endsAt',clock_timestamp()-interval '1 minute'),'Expired price must be ignored');
 quote:=public.quote_customer_sale(shop,location,customer,lines,true);
 if (quote->>'total')::numeric<>3200 or quote#>>'{lines,0,measurement,tradePricing,source}'<>'customer_group' then raise exception 'Group precedence or expiry incorrect: %',quote;end if;
 if (public.quote_customer_sale(shop,location,other_customer,lines,true)->>'total')::numeric<>3300 then raise exception 'Group price leaked to another customer';end if;
 r:=public.save_trade_configuration(gen_random_uuid(),shop,'price',args||jsonb_build_object('customerId',customer,'price','31'),'Negotiated customer contract');contract:=(r->>'id')::uuid;
 quote:=public.quote_customer_sale(shop,location,customer,lines,true);
 if (quote->>'total')::numeric<>3100 or quote#>>'{lines,0,measurement,tradePricing,ruleId}'<>contract::text then raise exception 'Customer contract precedence incorrect';end if;
 invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,lines);
 if (select total_amount from public.invoices where id=invoice)<>3100 or (select trade_pricing_snapshot->>'ruleId' from public.invoice_items where invoice_id=invoice)<>contract::text then raise exception 'Draft ignored authoritative contract';end if;
 -- Drafts reprice before issuance; issued documents freeze that exact revision.
 perform public.save_trade_configuration(gen_random_uuid(),shop,'price',args||jsonb_build_object('id',contract,'revision',1,'customerId',customer,'price','30'),'Revise future negotiated price');
 perform public.issue_location_sale(gen_random_uuid(),shop,location,invoice);
 if (select total_amount from public.invoices where id=invoice)<>3000 or (select quantity_on_hand from public.product_stock where product_id=cable)<>900 then raise exception 'Issued contract price or one stock deduction incorrect';end if;
 select trade_pricing_snapshot into before_snapshot from public.invoice_items where invoice_id=invoice;
 if public.get_location_sale_receipt(shop,location,invoice)#>>'{lines,0,pricing,revision}'<>'2' then raise exception 'Frozen receipt lost pricing provenance';end if;
 if before_snapshot->>'revision'<>'2' then raise exception 'Issued contract revision missing';end if;
 perform public.save_trade_configuration(gen_random_uuid(),shop,'price',args||jsonb_build_object('id',contract,'revision',2,'customerId',customer,'price','29'),'Next future contract price');
 if (select trade_pricing_snapshot from public.invoice_items where invoice_id=invoice)<>before_snapshot or (select total_amount from public.invoices where id=invoice)<>3000 then raise exception 'Historical issued price changed';end if;
 -- Contract price overrides a package catalog price and retains the entered unit.
 lines:=jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','1','package_id',pack,'package_version',1,'measurement_revision',1));
 if (public.quote_customer_sale(shop,location,customer,lines,true)->>'total')::numeric<>2900 then raise exception 'Contract/package precedence incorrect';end if;
 -- Authorized overrides preserve the original contract price, reason and actor.
 lines:=jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','1','package_id',pack,'package_version',1,'measurement_revision',1,'override_price','2800','override_reason','Approved contractor adjustment'));
 override_invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,lines);
 perform public.issue_location_sale(gen_random_uuid(),shop,location,override_invoice);
 if (select total_amount from public.invoices where id=override_invoice)<>2800 or (select trade_pricing_snapshot->>'source' from public.invoice_items where invoice_id=override_invoice)<>'staff_override'
 or (select trade_pricing_snapshot->>'originalBaseUnitPrice' from public.invoice_items where invoice_id=override_invoice)<>'29' or (select trade_pricing_snapshot->>'actorProfileId' from public.invoice_items where invoice_id=override_invoice) is null then raise exception 'Override approval audit lost';end if;
 begin perform public.quote_customer_sale(shop,location,customer,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','1','unit_code','m','measurement_revision',1,'override_price','1')),true);raise exception 'Unreasoned override accepted';exception when invalid_parameter_value then if sqlerrm<>'INVALID_PRICE_OVERRIDE' then raise;end if;end;
 -- Negotiated prices remain the base for enabled tax calculation.
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp()-interval '1 minute','{"enabled":true,"default":{"treatment":"vat","rate":14,"priceMode":"exclusive","subtype":"V009"},"items":[]}','Tax on negotiated prices');
 lines:=jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','100','unit_code','m','measurement_revision',1));
 quote:=public.quote_customer_sale(shop,location,customer,lines,true);
 if (quote->>'total')::numeric<>3306 or (quote->>'tax')::numeric<>406 then raise exception 'Tax did not use negotiated base price';end if;
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp()-interval '30 seconds','{"enabled":false,"default":{"treatment":"vat","rate":14,"priceMode":"exclusive","subtype":"V009"},"items":[]}','Return to disabled calculation');
 -- Legacy ordinary products can use trade rules without acquiring measurement status.
 perform public.save_trade_configuration(gen_random_uuid(),shop,'price',jsonb_build_object('revision',0,'productId',piece,'unitCode','ea','minimumQuantity','1','price','45','startsAt',clock_timestamp()-interval '1 day','active',true),'Legacy piece quantity price');
 if (public.quote_pos_sale(shop,location,jsonb_build_array(jsonb_build_object('item_type','product','source_id',piece,'quantity',2)))->>'total')::numeric<>90 then raise exception 'Legacy quantity rule ignored';end if;
 perform public.adjust_stock(gen_random_uuid(),shop,piece,5,10,'Legacy trade stock');
 invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',piece,'quantity',2)));
 perform public.issue_location_sale(gen_random_uuid(),shop,location,invoice);
 if exists(select 1 from public.invoice_items where invoice_id=invoice and measurement_snapshot is not null) then raise exception 'Legacy pricing introduced a JSON-null measurement';end if;
 if (select total_amount from public.invoices where id=invoice)<>90 then raise exception 'Legacy issuance lost trade price';end if;
 select id into rule from public.invoice_items where invoice_id=invoice;
 begin perform public.preview_sale_return(shop,location,invoice,jsonb_build_array(jsonb_build_object('lineId',rule,'quantity',0.001,'disposition','resellable')));raise exception 'Legacy return precision changed';exception when invalid_parameter_value then null;end;
 if (select measurement_status from public.products where id=piece)<>'legacy' then raise exception 'Trade rule changed legacy stock contract';end if;
 -- An explicit ordinary-sales order discount remains separate from automatic bundle offers.
 invoice:=public.save_location_sale_draft(gen_random_uuid(),shop,location,null,customer,null,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',piece,'quantity',1)));
 perform public.set_sale_order_discount(shop,invoice,5);
 perform public.issue_location_sale(gen_random_uuid(),shop,location,invoice);
 if (select total_amount from public.invoices where id=invoice)<>40 or (select tax_order_discount from public.invoices where id=invoice)<>5 then raise exception 'Trade repricing erased authorized manual order discount';end if;
 r:=public.trade_pricing_context(shop,'price',cable,customer,null,1);
 if (r->>'total')::integer<>1 or r#>>'{assignment,group_id}'<>g::text then raise exception 'Scoped pricing context lost filters';end if;

 -- Unused SKU measurement changes never reinterpret a former price rule.
 unit_product:=public.save_product(shop,null,'Reconfigured unused SKU','TRADE-RECONFIG',null,10);
 perform public.configure_product_measurement(shop,unit_product,'m','0.001','["m"]','Initial unused SKU unit');
 r:=public.save_trade_configuration(gen_random_uuid(),shop,'price',jsonb_build_object('revision',0,'productId',unit_product,'unitCode','m','minimumQuantity','1','price','8','startsAt',clock_timestamp()-interval '1 day','active',true),'Original length price');unit_rule:=(r->>'id')::uuid;
 perform public.configure_product_measurement(shop,unit_product,'kg','0.001','["kg"]','Correct unused SKU dimension');
 if (public.quote_customer_sale(shop,location,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',unit_product,'quantity','2','unit_code','kg','measurement_revision',2)),false)->>'total')::numeric<>20 then raise exception 'Former length price crossed to mass';end if;
 r:=public.save_trade_configuration(gen_random_uuid(),shop,'price',jsonb_build_object('id',unit_rule,'revision',1,'productId',unit_product,'active',false),'Archive former unit definition');
 if r->>'active'<>'false' or r->>'stock_unit_code'<>'m' or r->>'product_revision'<>'1' then raise exception 'Archival reinterpreted former rule';end if;
 -- A separate owner creates a genuinely separate shop; onboarding retries intentionally return an owner’s existing shop.
 perform set_config('request.jwt.claim.sub',(select foreign_owner::text from trade_pricing_actor),true);
 foreign_shop:=public.create_owner_shop('Separate pricing shop','mixed'::public.business_mode);
 foreign_product:=public.save_product(foreign_shop,null,'Other piece','OTHER-PIECE',null,90);
 r:=public.save_trade_configuration(gen_random_uuid(),foreign_shop,'price',jsonb_build_object('revision',0,'productId',foreign_product,'unitCode','ea','minimumQuantity','1','price','80','startsAt',clock_timestamp()-interval '1 day','active',true),'Separate shop rule');foreign_rule:=(r->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 begin perform public.save_trade_configuration(gen_random_uuid(),shop,'price',args||jsonb_build_object('id',foreign_rule),'Cross-shop conflicting identity');raise exception 'Foreign rule identity reused';exception when sqlstate '55000' then if sqlerrm<>'TRADE_CONTEXT_CHANGED' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',(select foreign_owner::text from trade_pricing_actor),true);
 if (select unit_price from public.trade_price_rules where id=foreign_rule)<>80 then raise exception 'Foreign upsert modified a different shop';end if;
 perform public.save_business_currency(foreign_shop,'USD');
 select id into rule from public.shop_locations where shop_id=foreign_shop and is_default;
 if (public.quote_customer_sale(foreign_shop,rule,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',foreign_product,'quantity',2)),false)->>'total')::numeric<>180 then raise exception 'Old negotiated currency was silently reinterpreted';end if;
 r:=public.save_trade_configuration(gen_random_uuid(),foreign_shop,'price',jsonb_build_object('id',foreign_rule,'revision',1,'productId',foreign_product,'active',false),'Archive former currency rule');
 if r->>'currency_code'<>'EGP' or r->>'active'<>'false' then raise exception 'Archive changed original pricing currency';end if;
 r:=public.save_trade_configuration(gen_random_uuid(),foreign_shop,'price',jsonb_build_object('revision',0,'productId',foreign_product,'unitCode','ea','minimumQuantity','1','price','123456789.123456789123','startsAt',clock_timestamp()-interval '1 day','active',true),'Exact high precision price');
 if not exists(select 1 from jsonb_array_elements(public.trade_pricing_context(foreign_shop,'price')->'items') item where item->>'id'=r->>'id' and item->>'unit_price'='123456789.123456789123' and jsonb_typeof(item->'unit_price')='string') then raise exception 'Price editor transport lost decimal precision';end if;

 perform set_config('request.jwt.claim.sub',actor::text,true);

 begin perform public.save_trade_configuration(gen_random_uuid(),shop,'assignment',jsonb_build_object('revision',1,'customerId',customer,'groupId',gen_random_uuid()),'Unknown group');raise exception 'Foreign group accepted';exception when no_data_found then if sqlerrm<>'CUSTOMER_GROUP_NOT_FOUND' then raise;end if;end;
 if has_table_privilege('authenticated','public.trade_price_rules','insert') or has_function_privilege('authenticated','shop_private.apply_trade_price(uuid,uuid,uuid,jsonb,jsonb,numeric)','execute') then raise exception 'Private pricing authority exposed';end if;
 perform set_config('trade_test.shop',shop::text,true);perform set_config('trade_test.location',location::text,true);perform set_config('trade_test.customer',customer::text,true);perform set_config('trade_test.product',cable::text,true);
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.quote_customer_sale(shop,location,customer,lines,true);raise exception 'Unauthorized price read accepted';exception when insufficient_privilege then null;end;
 begin perform public.save_trade_configuration(gen_random_uuid(),shop,'group','{"revision":0,"name":"Unauthorized","active":true}','Unauthorized group write');raise exception 'Unauthorized group write accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',actor::text,true);
end;$$;

reset role;
insert into public.profiles(user_id,portal_id,display_name,email_snapshot)
select f.cashier,s.portal_id,'Pricing cashier',f.cashier::text||'@trade-pricing.invalid' from trade_pricing_actor f join public.shops s on s.id=current_setting('trade_test.shop')::uuid;
set local role authenticated;
do $$declare shop uuid:=current_setting('trade_test.shop')::uuid;location uuid:=current_setting('trade_test.location')::uuid;customer uuid:=current_setting('trade_test.customer')::uuid;
 product uuid:=current_setting('trade_test.product')::uuid;counter_role text;invitation jsonb;staff uuid;owner_actor uuid:=auth.uid();invoice uuid;approval text;lines jsonb;begin
 counter_role:=public.save_shop_team_role(gen_random_uuid(),shop,null,'Counter sales','مبيعات المنضدة',array['sales.view','sales.manage','sales.issue','products.view']);
 invitation:=public.invite_shop_member(gen_random_uuid(),shop,(select cashier::text||'@trade-pricing.invalid' from trade_pricing_actor),'Pricing cashier',counter_role,array[location]);
 select id into staff from public.shop_memberships where shop_id=shop and role='owner';
 lines:=jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity','2','unit_code','m','measurement_revision',1,'override_price','28','override_reason','Manager-approved collection price'));
 invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,lines);
 select trade_pricing_snapshot->>'actorProfileId' into approval from public.invoice_items where invoice_id=invoice;
 perform set_config('request.jwt.claim.sub',(select cashier::text from trade_pricing_actor),true);
 perform public.accept_shop_invitation(gen_random_uuid(),(invitation->>'invitationCode')::uuid);
 if (public.quote_customer_sale(shop,location,customer,jsonb_build_array(lines->0 #- '{override_price}' #- '{override_reason}'),true)) is null then raise exception 'Cashier normal quote unavailable';end if;
 begin perform public.quote_customer_sale(shop,location,customer,lines,true);raise exception 'Cashier forged manager price approval';exception when insufficient_privilege then if sqlerrm<>'PRICE_OVERRIDE_PERMISSION_DENIED' then raise;end if;end;
 begin perform public.trade_pricing_context(shop,'price');raise exception 'Cashier read private pricing configuration';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.trade_price_rules where shop_id=shop) then raise exception 'Cashier bypassed pricing RLS';end if;
 if (public.quote_customer_sale(shop,location,customer,lines,true,invoice)->>'total')::numeric<>56 then raise exception 'Cashier could not quote existing approved draft';end if;
 begin perform public.quote_customer_sale(shop,location,customer,jsonb_set(lines,'{0,quantity}','"3"'),true,invoice);raise exception 'Cashier changed approved quantity';exception when insufficient_privilege then null;end;
 if public.save_location_sale_draft(gen_random_uuid(),shop,location,invoice,customer,null,'Cashier collection note',lines)<>invoice then raise exception 'Cashier note edit lost approved draft';end if;
 perform public.issue_location_sale(gen_random_uuid(),shop,location,invoice);
 if (public.get_sale(shop,invoice)->>'total_amount')::numeric<>56 or public.get_sale(shop,invoice)#>>'{lines,0,trade_pricing_snapshot,actorProfileId}' is distinct from approval then raise exception 'Issuing cashier lost original manager approval';end if;
 perform set_config('request.jwt.claim.sub',owner_actor::text,true);
end;$$;
