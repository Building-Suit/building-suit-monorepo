-- Explicit synthetic source quotations; no live price feed or merchant approval.
create temporary table commodity_actors as select gen_random_uuid() owner,gen_random_uuid() outsider,gen_random_uuid() reader;
grant select on commodity_actors to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@commodity.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from(select owner id from commodity_actors union all select outsider from commodity_actors union all select reader from commodity_actors)a;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from commodity_actors;
set local role authenticated;
do $$declare shop uuid;location uuid;staff uuid;vendor uuid;customer uuid;cable uuid;copper uuid;quote uuid;rule uuid;package uuid;invoice uuid;line uuid;request uuid:=gen_random_uuid();r jsonb;again jsonb;v jsonb;input jsonb;preview jsonb;ctx jsonb;returns jsonb;plan jsonb;g uuid;tier uuid;group_rule uuid;contract uuid;args jsonb;future_quote uuid;fine_quote uuid;quotation uuid;order_id uuid;order_line uuid;collection uuid;agreed jsonb;remnant uuid;reel uuid;begin
 shop:=public.create_owner_shop('Synthetic commodity merchant','multi','mixed');select id into location from public.shop_locations where shop_id=shop and is_default;
 select id into staff from public.shop_memberships where shop_id=shop and role='owner';
 vendor:=public.save_vendor(shop,null,'Synthetic source supplier',null,null,null,null,null,null);customer:=public.save_customer(shop,null,'Synthetic cable customer',null,null,null,null);
 cable:=public.save_product(shop,null,'Commodity cable','COMMODITY-CABLE',null,35);perform public.configure_product_measurement(shop,cable,'m','0.001','["m","cm"]','Synthetic length unit');
 copper:=public.save_product(shop,null,'Commodity copper','COMMODITY-COPPER',null,120);perform public.configure_product_measurement(shop,copper,'kg','0.001','["kg","g"]','Synthetic mass unit');
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'COMMODITY-OPEN',current_date,null,jsonb_build_array(jsonb_build_object('product_id',cable,'quantity','100','unit_cost','20','unit_code','m','measurement_revision',1),jsonb_build_object('product_id',copper,'quantity','5','unit_cost','80','unit_code','kg','measurement_revision',1)));
 input:=jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','12.5','unit_code','m','measurement_revision',1));
 preview:=public.quote_customer_sale(shop,location,customer,input);
 if (preview->>'total')::numeric<>437.5 or (preview->>'tradePricingEnabled')::boolean then raise exception 'Unconfigured ordinary catalog behavior changed: %',preview;end if;
 v:=jsonb_build_object('active',true,'confirmed',true,'commodity','Copper','sourceName','Synthetic supplier quotation','evidenceReference','Synthetic source document TEST-COPPER-001','currency','EGP','pricePerKg','100',
  'effectiveAt',clock_timestamp()-interval '1 day','expiresAt',clock_timestamp()+interval '1 day');
 begin perform public.commodity_pricing_command(gen_random_uuid(),shop,'quote',null,0,v||'{"currency":"USD"}','Reject unapproved FX');raise exception 'Cross currency accepted';exception when invalid_parameter_value then if sqlerrm<>'INVALID_COMMODITY_QUOTE' then raise;end if;end;
 begin perform public.commodity_pricing_command(gen_random_uuid(),shop,'quote',null,0,v||'{"confirmed":false}','Reject automatic approval');raise exception 'Unconfirmed source accepted';exception when invalid_parameter_value then if sqlerrm<>'INVALID_COMMODITY_APPROVAL' then raise;end if;end;
 begin perform public.commodity_pricing_command(gen_random_uuid(),shop,'quote',null,0,v||'{"sourceName":{"unverified":"object"}}','Reject malformed source identity');raise exception 'Structured source identity accepted';exception when invalid_parameter_value then if sqlerrm<>'INVALID_COMMODITY_QUOTE' then raise;end if;end;
 begin perform public.commodity_pricing_command(gen_random_uuid(),shop,'quote',null,0,v||'{"effectiveAt":"2026-10-26 12:00:00"}','Reject implicit source timezone');raise exception 'Source time guessed a timezone';exception when invalid_parameter_value then if sqlerrm<>'INVALID_COMMODITY_QUOTE' then raise;end if;end;
 begin perform public.commodity_pricing_command(gen_random_uuid(),shop,'quote',null,0,v||jsonb_build_object('effectiveAt',clock_timestamp()-interval '2 days','expiresAt',clock_timestamp()-interval '1 day'),'Reject expired active source');raise exception 'Expired source activated';exception when sqlstate '55000' then if sqlerrm<>'COMMODITY_QUOTE_UNAVAILABLE' then raise;end if;end;
 r:=public.commodity_pricing_command(request,shop,'quote',null,0,v,'Approve synthetic source quote');quote:=(r->>'id')::uuid;
 again:=public.commodity_pricing_command(request,shop,'quote',null,0,v,'Approve synthetic source quote');if again is distinct from r then raise exception 'Quote retry changed identity';end if;
 begin perform public.commodity_pricing_command(request,shop,'quote',null,0,v||'{"pricePerKg":"101"}','Approve synthetic source quote');raise exception 'Conflicting retry accepted';exception when unique_violation then if sqlerrm<>'COMMODITY_REQUEST_CONFLICT' then raise;end if;end;
 v:=jsonb_build_object('active',true,'confirmed',true,'productId',cable,'quoteId',quote,'kgPerBaseUnit','0.2','premiumPerBaseUnit','5','measurementRevision',1,'baseUnitCode','m','evidenceReference','Synthetic verified copper content and premium');
 r:=public.commodity_pricing_command(gen_random_uuid(),shop,'rule',null,0,v,'Approve synthetic cable rule');rule:=(r->>'id')::uuid;
 ctx:=public.commodity_pricing_context(shop,'rule',null,1,rule);
 if ctx#>>'{record,kg_per_base_unit}' is distinct from '0.2' or ctx#>>'{record,premium_per_base_unit}' is distinct from '5' or (ctx->>'historyTotal')::integer<>1 then raise exception 'Rule context lost exact source: %',ctx;end if;
 if exists(select 1 from public.invoices where shop_id=shop) or (select quantity_on_hand from public.product_stock where product_id=cable)<>100 then raise exception 'Price approvals changed finance or stock';end if;
 preview:=public.quote_customer_sale(shop,location,customer,input);
 if (preview->>'total')::numeric<>312.5 or preview#>>'{lines,0,pricing,source}' is distinct from 'commodity' or preview#>>'{lines,0,pricing,quote,price_per_kg}' is distinct from '100'
  or not (preview->>'tradePricingEnabled')::boolean then raise exception 'Commodity formula/source/offline flag mismatch: %',preview;end if;
 -- A formal accepted agreement freezes the then-authoritative source price.
 args:=jsonb_build_object('customerId',customer,'validUntil',clock_timestamp()+interval '7 days','projectReference','Synthetic copper project','notes','Explicit agreed commodity price','orderDiscount','0','lines',input);
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,args,'Freeze synthetic material quotation');quotation:=(r->>'id')::uuid;
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',quotation,1,'{}','Issue synthetic material quotation');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'accept',quotation,2,'{}','Accept synthetic commodity agreement');
 agreed:=public.trade_quotation_context(shop,location,quotation)#>'{detail,snapshot}';
 if agreed#>>'{lines,0,pricing,quote,price_per_kg}' is distinct from '100' then raise exception 'Formal agreement lost original commodity source: %',agreed;end if;
 -- Explicit fixed packaging retains its approved price; flexible packaging uses commodity pricing.
 package:=public.save_product_packaging(gen_random_uuid(),shop,cable,null,'{"code":"COMMODITY-FIXED","name":"Fixed ten metres","unitCode":"roll","containedQuantity":"10","containedUnitCode":"m","salePrice":240,"canPurchase":true,"canSell":true}');
 preview:=public.quote_customer_sale(shop,location,customer,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','1','package_id',package,'package_version',1,'measurement_revision',1)));
 if (preview->>'total')::numeric<>240 then raise exception 'Fixed package precedence changed: %',preview;end if;
 package:=public.save_product_packaging(gen_random_uuid(),shop,cable,null,'{"code":"COMMODITY-FLEX","name":"Flexible ten metres","unitCode":"roll","containedQuantity":"10","containedUnitCode":"m","canPurchase":true,"canSell":true}');
 preview:=public.quote_customer_sale(shop,location,customer,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity','1','package_id',package,'package_version',1,'measurement_revision',1)));
 if (preview->>'total')::numeric<>250 or preview#>>'{lines,0,pricing,source}' is distinct from 'commodity' then raise exception 'Flexible package lost commodity source: %',preview;end if;
 -- Commodity content is distinct from a scale factor; ordinary g/kg selling remains exact.
 perform public.commodity_pricing_command(gen_random_uuid(),shop,'rule',null,0,v||jsonb_build_object('productId',copper,'baseUnitCode','kg','kgPerBaseUnit','1','premiumPerBaseUnit','10'),'Approve synthetic copper content');
 preview:=public.quote_customer_sale(shop,location,customer,jsonb_build_array(jsonb_build_object('item_type','product','source_id',copper,'quantity','250','unit_code','g','measurement_revision',1)));
 if (preview->>'total')::numeric<>27.5 or preview#>>'{lines,0,pricing,baseUnitPrice}' is distinct from '110' then raise exception 'Gram conversion changed commodity stock-unit price: %',preview;end if;
 args:=jsonb_build_object('revision',0,'productId',cable,'unitCode','m','minimumQuantity','10','price','30','startsAt',clock_timestamp()-interval '1 day','priority',0,'active',true);
 r:=public.save_trade_configuration(gen_random_uuid(),shop,'price',args,'Synthetic quantity price takes precedence');tier:=(r->>'id')::uuid;
 preview:=public.quote_customer_sale(shop,location,customer,input);if (preview->>'total')::numeric<>375 or preview#>>'{lines,0,pricing,source}' is distinct from 'quantity_break' then raise exception 'Quantity agreement precedence changed';end if;
 r:=public.save_trade_configuration(gen_random_uuid(),shop,'group','{"revision":0,"name":"Commodity contractors","active":true}','Synthetic contractor group');g:=(r->>'id')::uuid;
 perform public.save_trade_configuration(gen_random_uuid(),shop,'assignment',jsonb_build_object('revision',0,'customerId',customer,'groupId',g),'Synthetic contractor assignment');
 r:=public.save_trade_configuration(gen_random_uuid(),shop,'price',args||jsonb_build_object('groupId',g,'price','29'),'Synthetic group price takes precedence');group_rule:=(r->>'id')::uuid;
 preview:=public.quote_customer_sale(shop,location,customer,input);if (preview->>'total')::numeric<>362.5 or preview#>>'{lines,0,pricing,source}' is distinct from 'customer_group' then raise exception 'Group agreement precedence changed';end if;
 r:=public.save_trade_configuration(gen_random_uuid(),shop,'price',args||jsonb_build_object('customerId',customer,'price','28'),'Synthetic customer price takes precedence');contract:=(r->>'id')::uuid;
 preview:=public.quote_customer_sale(shop,location,customer,input);if (preview->>'total')::numeric<>350 or preview#>>'{lines,0,pricing,source}' is distinct from 'customer_contract' then raise exception 'Customer agreement precedence changed';end if;
 perform public.save_trade_configuration(gen_random_uuid(),shop,'price',args||jsonb_build_object('id',tier,'revision',1,'active',false),'Retire synthetic quantity agreement');
 perform public.save_trade_configuration(gen_random_uuid(),shop,'price',args||jsonb_build_object('id',group_rule,'revision',1,'groupId',g,'price','29','active',false),'Retire synthetic group agreement');
 perform public.save_trade_configuration(gen_random_uuid(),shop,'price',args||jsonb_build_object('id',contract,'revision',1,'customerId',customer,'price','28','active',false),'Retire synthetic customer agreement');
 -- A selected discounted reel keeps its explicit price above commodity rules.
 remnant:=public.save_product(shop,null,'Commodity tracked remnant','COMMODITY-REMNANT',null,35);perform public.configure_product_measurement(shop,remnant,'m','0.001','["m"]','Synthetic remnant unit');
 perform public.save_product_technical_details(shop,remnant,0,null,'{}',true,'Track synthetic commodity reel');
 package:=public.save_product_packaging(gen_random_uuid(),shop,remnant,null,'{"code":"COMMODITY-REEL","name":"Ten metre source","unitCode":"reel","containedQuantity":"10","containedUnitCode":"m","canPurchase":true,"canSell":true}');
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'COMMODITY-REEL-OPEN',current_date,null,jsonb_build_array(jsonb_build_object('product_id',remnant,'quantity','1','package_id',package,'package_version',1,'measurement_revision',1,'unit_cost',200,'reel_barcodes',jsonb_build_array('COMMODITY-REMNANT-SOURCE'))));
 select id into reel from public.inventory_reels where product_id=remnant and shop_id=shop;
 perform public.update_inventory_reel(gen_random_uuid(),shop,location,reel,1,'classify','{"classification":"discounted","price":"15"}','Synthetic explicit remnant price');
 perform public.commodity_pricing_command(gen_random_uuid(),shop,'rule',null,0,v||jsonb_build_object('productId',remnant),'Approve synthetic reel material rule');
 preview:=public.quote_customer_sale(shop,location,customer,jsonb_build_array(jsonb_build_object('item_type','product','source_id',remnant,'quantity','1','unit_code','m','measurement_revision',1,'reel_id',reel)));
 if (preview->>'total')::numeric<>15 then raise exception 'Commodity rule overrode explicit remnant price';end if;
 invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,input);
 perform public.issue_location_sale(gen_random_uuid(),shop,location,invoice);
 select id into line from public.invoice_items where invoice_id=invoice;
 if (select total_amount from public.invoices where id=invoice)<>312.5 or (select quantity_on_hand from public.product_stock where product_id=cable)<>87.5
  or (select trade_pricing_snapshot#>>'{quote,price_per_kg}' from public.invoice_items where id=line) is distinct from '100' then raise exception 'Commodity ordinary issuance/source mismatch';end if;
 -- Retiring an input cannot rewrite the issued source or original return cost.
 perform public.commodity_pricing_command(gen_random_uuid(),shop,'quote',quote,1,'{"active":false,"confirmed":false}','Retire synthetic quote after issue');
 begin perform public.quote_customer_sale(shop,location,customer,input);raise exception 'Retired source silently fell back';exception when sqlstate '55000' then if sqlerrm<>'COMMODITY_QUOTE_UNAVAILABLE' then raise;end if;end;
 returns:=jsonb_build_array(jsonb_build_object('lineId',line,'quantity',0.5,'disposition','resellable'));plan:=public.preview_sale_return(shop,location,invoice,returns);perform public.create_sale_return(gen_random_uuid(),shop,location,invoice,returns,'Original commodity return',plan);
 if (select quantity_on_hand from public.product_stock where product_id=cable)<>88 or (select sum(remaining_quantity*unit_cost) from public.inventory_batches where product_id=cable and shop_id=shop)<>1760 or (select trade_pricing_snapshot#>>'{quote,price_per_kg}' from public.invoice_items where id=line) is distinct from '100' then raise exception 'Return rewrote original source or quantity';end if;
 preview:=public.quote_customer_sale(shop,location,customer,jsonb_build_array(jsonb_build_object('item_type','product','source_id',remnant,'quantity','1','unit_code','m','measurement_revision',1,'reel_id',reel)));
 if (preview->>'total')::numeric<>15 then raise exception 'Retired commodity source blocked an explicit remnant price';end if;
 -- Collection honors the accepted agreement after its market source retires.
 r:=public.create_trade_order(gen_random_uuid(),shop,location,quotation,3,'Convert frozen commodity agreement');order_id:=(r->>'id')::uuid;
 ctx:=public.trade_order_context(shop,location,order_id);order_line:=(ctx#>>'{detail,lines,0,id}')::uuid;
 if ctx#>'{detail,record,agreed_snapshot}' is distinct from agreed then raise exception 'Order rewrote accepted commodity evidence';end if;
 perform public.reserve_trade_order(gen_random_uuid(),shop,location,order_id,1,'reserve',jsonb_build_array(jsonb_build_object('lineId',order_line,'quantity','1')),clock_timestamp()+interval '1 day','Reserve original agreed commodity material');
 r:=public.fulfill_trade_order(gen_random_uuid(),shop,location,order_id,2,jsonb_build_array(jsonb_build_object('lineId',order_line,'quantity','1')),false,'Collect original agreed commodity material');collection:=(r->>'invoiceId')::uuid;
 if (select total_amount from public.invoices where id=collection)<>25 or (select unit_price from public.invoice_items where invoice_id=collection)<>25 then raise exception 'Collection repriced a frozen commodity agreement';end if;
 -- Staff approval retains its higher precedence even while the source is retired.
 preview:=public.quote_customer_sale(shop,location,customer,jsonb_build_array((input->0)||'{"override_price":"27","override_reason":"Synthetic authorized counter price"}'));
 if (preview->>'total')::numeric<>337.5 or preview#>>'{lines,0,pricing,source}' is distinct from 'staff_override' then raise exception 'Staff precedence changed: %',preview;end if;
 begin perform public.commodity_pricing_command(gen_random_uuid(),shop,'quote',quote,2,'{"active":true,"confirmed":true,"pricePerKg":"200"}','Attempt source term rewrite');raise exception 'Source terms overwritten';exception when sqlstate '55000' then if sqlerrm<>'COMMODITY_QUOTE_TERMS_IMMUTABLE' then raise;end if;end;
 ctx:=public.commodity_pricing_context(shop,'quote_options');if (ctx->>'total')::integer<>0 then raise exception 'Retired source remained a current choice';end if;
 -- Disable the rule explicitly to restore ordinary pricing.
 perform public.commodity_pricing_command(gen_random_uuid(),shop,'rule',rule,1,v||'{"active":false,"confirmed":false}','Disable optional commodity calculation');
 preview:=public.quote_customer_sale(shop,location,customer,input);if (preview->>'total')::numeric<>437.5 then raise exception 'Explicit disable did not restore ordinary price';end if;
 -- Expected measurement identity is checked before approving a new relationship.
 begin perform public.commodity_pricing_command(gen_random_uuid(),shop,'rule',null,0,v||jsonb_build_object('measurementRevision',2),'Reject stale product unit approval');raise exception 'Stale measurement revision approved';exception when sqlstate '55000' then if sqlerrm<>'COMMODITY_PRODUCT_CONTEXT_CHANGED' then raise;end if;end;
 args:=jsonb_build_object('active',true,'confirmed',true,'commodity','Copper','sourceName','Synthetic future source','evidenceReference','Synthetic future price terms','currency','EGP','pricePerKg','100','effectiveAt',clock_timestamp()+interval '1 day','expiresAt',clock_timestamp()+interval '2 days');
 r:=public.commodity_pricing_command(gen_random_uuid(),shop,'quote',null,0,args,'Approve synthetic future source');future_quote:=(r->>'id')::uuid;
 begin perform public.commodity_pricing_command(gen_random_uuid(),shop,'rule',rule,2,v||jsonb_build_object('quoteId',future_quote),'Reject future source before effective time');raise exception 'Future source priced a current sale';exception when sqlstate '55000' then if sqlerrm<>'COMMODITY_QUOTE_UNAVAILABLE' then raise;end if;end;
 r:=public.commodity_pricing_command(gen_random_uuid(),shop,'quote',null,0,args||jsonb_build_object('pricePerKg','100.000000000001','effectiveAt',clock_timestamp()-interval '1 day'),'Approve synthetic exact fractional quote');fine_quote:=(r->>'id')::uuid;
 begin perform public.commodity_pricing_command(gen_random_uuid(),shop,'rule',rule,2,v||jsonb_build_object('quoteId',fine_quote),'Reject rounded intermediate price');raise exception 'Nonrepresentable formula rounded silently';exception when invalid_parameter_value then if sqlerrm<>'COMMODITY_PRICE_PRECISION' then raise;end if;end;
 perform set_config('commodity_test.shop',shop::text,true);perform set_config('commodity_test.location',location::text,true);perform set_config('commodity_test.quote',quote::text,true);
end;$$;
set local role postgres;
insert into public.profiles(user_id,portal_id,display_name,email_snapshot)
select a.reader,s.portal_id,'Synthetic commodity cashier',a.reader::text||'@commodity.invalid' from commodity_actors a join public.shops s on s.id=current_setting('commodity_test.shop')::uuid;
set local role authenticated;
do $$declare shop uuid:=current_setting('commodity_test.shop')::uuid;location uuid:=current_setting('commodity_test.location')::uuid;role text;invitation jsonb;begin
 role:=public.save_shop_team_role(gen_random_uuid(),shop,null,'Commodity counter only','بيع دون اعتماد مصادر',array['products.view','sales.manage']);
 invitation:=public.invite_shop_member(gen_random_uuid(),shop,(select reader::text||'@commodity.invalid' from commodity_actors),'Synthetic commodity cashier',role,array[location]);
 perform set_config('request.jwt.claim.sub',(select reader::text from commodity_actors),true);perform public.accept_shop_invitation(gen_random_uuid(),(invitation->>'invitationCode')::uuid);
 begin perform public.commodity_pricing_context(shop);raise exception 'Cashier read manager source directory';exception when insufficient_privilege then null;end;
 begin perform public.commodity_pricing_command(gen_random_uuid(),shop,'quote',null,0,'{}','Cashier attempted source approval');raise exception 'Cashier approved source';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',(select outsider::text from commodity_actors),true);
 begin perform public.commodity_pricing_context(shop);raise exception 'Outsider read manager source history';exception when insufficient_privilege then null;end;
 begin perform public.commodity_pricing_command(gen_random_uuid(),shop,'rule',null,0,'{}','Outsider attempted rule approval');raise exception 'Outsider changed commodity price';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',(select owner::text from commodity_actors),true);
end;$$;
reset role;
update public.subscriptions set trial_end_at=now()-interval '1 day',current_period_end=now()-interval '1 second' where profile_id in(select profile_id from public.shop_memberships where shop_id=current_setting('commodity_test.shop')::uuid and role='owner');
set local role authenticated;
do $$declare shop uuid:=current_setting('commodity_test.shop')::uuid;begin
 perform public.commodity_pricing_context(shop);perform public.commodity_pricing_context(shop,'rule');
 begin perform public.commodity_pricing_command(gen_random_uuid(),shop,'quote',current_setting('commodity_test.quote')::uuid,2,'{"active":false,"confirmed":false}','Expired plan attempted write');raise exception 'Expired subscription approved pricing write';exception when insufficient_privilege then if sqlerrm<>'SHOP_SUBSCRIPTION_INACTIVE' then raise;end if;end;
end;$$;
reset role;
do $$begin
 if has_function_privilege('authenticated','shop_private.resolve_commodity_price(uuid,uuid,jsonb,numeric)','execute') or has_function_privilege('anon','public.commodity_pricing_command(uuid,uuid,text,uuid,integer,jsonb,text)','execute')
  or has_table_privilege('authenticated','public.commodity_quotes','select') or has_table_privilege('authenticated','public.product_commodity_rules','update') then raise exception 'Private commodity pricing authority exposed';end if;
end;$$;
set constraints all immediate;
