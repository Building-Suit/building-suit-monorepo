create temporary table order_actors as select gen_random_uuid() owner,gen_random_uuid() outsider;
grant select on order_actors to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@order.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from(select owner id from order_actors union all select outsider from order_actors)i;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from order_actors;
set local role authenticated;
do $$declare shop uuid;location uuid;customer uuid;product uuid;other_product uuid;q uuid;order_id uuid;r jsonb;again jsonb;values jsonb;context jsonb;agreed jsonb;op uuid:=gen_random_uuid();begin
 shop:=public.create_owner_shop('Contractor order shop','mixed'::public.business_mode);
 select id into location from public.shop_locations where shop_id=shop and is_default;
 customer:=public.save_customer(shop,null,'Contractor order customer',null,null,null,null);
 product:=public.save_product(shop,null,'Agreed project cable','ORDER-CABLE',null,35);
 perform public.configure_product_measurement(shop,product,'m','0.001','["m","cm"]','Order measurement fixture');
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp(),'{"enabled":true,"default":{"treatment":"vat","rate":14,"priceMode":"exclusive","subtype":"V009"},"items":[]}','Order quote tax policy');
 values:=jsonb_build_object('customerId',customer,'validUntil',clock_timestamp()+interval '7 days','projectReference','Project order A','notes','Agreed cable for collection','orderDiscount','5',
 'lines',jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity','100','unit_code','m','measurement_revision',1)));
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,values,'Prepare order offer');q:=(r->>'id')::uuid;
 begin perform public.create_trade_order(gen_random_uuid(),shop,location,q,1,'Attempt unaccepted quote');raise exception 'Draft quote converted';exception when sqlstate '55000' then if sqlerrm<>'ORDER_REQUIRES_ACCEPTED_QUOTATION' then raise;end if;end;
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',q,1,'{}','Issue order offer');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'accept',q,2,'{}','Customer agrees order material');
 agreed:=public.trade_quotation_context(shop,location,q)#>'{detail,snapshot}';
 perform public.save_product(shop,product,'Later cable name','ORDER-CABLE',null,99);
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp(),'{"enabled":true,"default":{"treatment":"vat","rate":20,"priceMode":"exclusive","subtype":"V009"},"items":[]}','Later tax policy after acceptance');
 r:=public.create_trade_order(op,shop,location,q,3,'Convert accepted material agreement');order_id:=(r->>'id')::uuid;
 again:=public.create_trade_order(op,shop,location,q,3,'Convert accepted material agreement');
 if again<>r then raise exception 'Order conversion retry changed result';end if;
 context:=public.trade_order_context(shop,location,order_id);
 if context#>'{detail,record,agreed_snapshot}' is distinct from agreed or (context#>>'{detail,record,total_amount}')::numeric is distinct from 3984.30
 or context#>>'{detail,lines,0,unit_price}' is distinct from '35' or context#>>'{detail,lines,0,quantity}' is distinct from '100'
 or context#>>'{detail,lines,0,item_name}' is distinct from 'Agreed project cable' then raise exception 'Order did not retain agreed quantity/price/name/tax: %',context;end if;
 begin perform public.create_trade_order(op,shop,location,q,3,'Changed same request');raise exception 'Conflicting order request accepted';exception when unique_violation then if sqlerrm<>'ORDER_REQUEST_CONFLICT' then raise;end if;end;
 again:=public.create_trade_order(gen_random_uuid(),shop,location,q,3,'Independent repeated conversion');
 if again->>'id' is distinct from order_id::text or again->>'alreadyConverted'<>'true' or (public.trade_order_context(shop,location)->>'total')::integer<>1 then raise exception 'Independent conversion duplicated order';end if;
 if (public.trade_order_context(shop,location,null,q)->'quotation'->>'orderId') is distinct from order_id::text then raise exception 'Quote/order lineage missing';end if;
 if (public.trade_order_context(shop,location,null,null,null,1,1,'quotations')->>'total')::integer<>0 then raise exception 'Converted quote remained eligible in picker';end if;
 begin perform public.trade_quotation_command(gen_random_uuid(),shop,location,'cancel',q,4,'{}','Attempt to cancel converted offer');raise exception 'Converted quote cancelled independently';exception when sqlstate '55000' then if sqlerrm<>'QUOTATION_ALREADY_CONVERTED' then raise;end if;end;
 if exists(select 1 from public.invoices where shop_id=shop) or exists(select 1 from public.payments where shop_id=shop) or exists(select 1 from public.inventory_batches where shop_id=shop) then raise exception 'Order creation posted stock or financial ledgers';end if;
 -- An unused product may be corrected, but its accepted length offer must never
 -- become a mass order. A fresh customer-reviewed agreement is required.
 other_product:=public.save_product(shop,null,'Unused reconfigured order SKU','ORDER-RECONFIG',null,10);
 perform public.configure_product_measurement(shop,other_product,'m','0.001','["m"]','Original order dimension');
 values:=values||jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('item_type','product','source_id',other_product,'quantity','10','unit_code','m','measurement_revision',1)));
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,values,'Unused product offer');q:=(r->>'id')::uuid;
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'issue',q,1,'{}','Issue unused material offer');
 perform public.trade_quotation_command(gen_random_uuid(),shop,location,'accept',q,2,'{}','Accept unused material offer');
 perform public.configure_product_measurement(shop,other_product,'kg','0.001','["kg"]','Correct unused product dimension');
 begin perform public.create_trade_order(gen_random_uuid(),shop,location,q,3,'Attempt changed dimension conversion');raise exception 'Length agreement became mass order';exception when sqlstate '55000' then if sqlerrm<>'ORDER_MEASUREMENT_CONTEXT_CHANGED' then raise;end if;end;
 perform public.save_business_currency(shop,'USD');
 begin perform public.create_trade_order(gen_random_uuid(),shop,location,q,3,'Attempt changed currency conversion');raise exception 'Old agreement currency reinterpreted';exception when sqlstate '55000' then if sqlerrm<>'QUOTATION_CURRENCY_CHANGED' then raise;end if;end;
 -- Money beyond JavaScript's cent precision remains exact decimal text in
 -- current, historical and order/quote directory projections.
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp(),'{"enabled":false,"default":{"treatment":"vat","rate":14,"priceMode":"exclusive","subtype":"V009"},"items":[]}','Exact money transport fixture');
 other_product:=public.save_product(shop,null,'Large exact order price','ORDER-EXACT',null,999999999.99);
 values:=values||jsonb_build_object('orderDiscount','0','lines',jsonb_build_array(jsonb_build_object('item_type','product','source_id',other_product,'quantity','999999')));
 r:=public.trade_quotation_command(gen_random_uuid(),shop,location,'save',null,0,values,'Large exact commercial amount');
 context:=public.trade_quotation_context(shop,location,(r->>'id')::uuid);
 if context#>>'{detail,snapshot,total}' is distinct from '999998999990000.01' or jsonb_typeof(context#>'{detail,snapshot,total}')<>'string'
 or context#>>'{detail,record,total_amount}' is distinct from '999998999990000.01' or context#>>'{detail,versions,0,snapshot,total}' is distinct from '999998999990000.01'
 or context#>>'{detail,snapshot,lines,0,total}' is distinct from '999998999990000.01' then raise exception 'Commercial decimal transport lost large cents';end if;
 if has_table_privilege('authenticated','public.trade_orders','insert') or exists(select 1 from public.trade_orders) then raise exception 'Unbounded order write/read exposed';end if;
 perform set_config('order_test.shop',shop::text,true);perform set_config('order_test.location',location::text,true);perform set_config('order_test.order',order_id::text,true);perform set_config('order_test.quote',q::text,true);
 perform set_config('request.jwt.claim.sub',(select outsider::text from order_actors),true);
 begin perform public.trade_order_context(shop,location,order_id);raise exception 'Outsider order read';exception when insufficient_privilege then null;end;
 begin perform public.create_trade_order(gen_random_uuid(),shop,location,q,3,'Outsider conversion');raise exception 'Outsider order created';exception when insufficient_privilege then null;end;
end;$$;
reset role;
do $$begin
 begin update public.trade_orders set agreed_snapshot='{}' where id=current_setting('order_test.order')::uuid;raise exception 'Order agreement changed';exception when sqlstate '55000' then if sqlerrm<>'ORDER_AGREEMENT_IMMUTABLE' then raise;end if;end;
 begin update public.trade_order_lines set unit_price=1 where order_id=current_setting('order_test.order')::uuid;raise exception 'Order line price changed';exception when sqlstate '55000' then if sqlerrm<>'MEASUREMENT_HISTORY_IMMUTABLE' then raise;end if;end;
end;$$;
