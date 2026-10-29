-- Runner supplies BEGIN/ROLLBACK on the explicitly disposable local Shop only.
create function pg_temp.measurement_reject(statement text, expected_state text, expected_message text) returns void
language plpgsql as $$begin
 begin execute statement;
 exception when others then
  if sqlstate=expected_state and sqlerrm=expected_message then return;end if;
  raise;
 end;
 raise exception 'Expected rejection %: %',expected_message,statement;
end;$$;
-- Role-switched assertions explicitly execute this temporary helper under secure defaults.
grant execute on function pg_temp.measurement_reject(text,text,text) to authenticated;

do $$declare example record;begin
 for example in select * from (values
  (100::numeric,'cm','m',1::numeric),(1000,'mm','m',1),(1000,'g','kg',1),(250,'g','kg',.25),
  (1000,'ml','l',1),(10000,'cm2','m2',1),(1,'ft','m',.3048),(3048,'mm','ft',10),
  (1,'pair','ea',2),(2,'dozen','ea',24),(.000001,'kg','mg',1),(250,'cm','m',2.5)
 ) v(quantity,source,target,expected) loop
  if shop_private.convert_measurement(example.quantity,example.source,example.target)<>example.expected then
   raise exception 'Inexact conversion %',example;
  end if;
 end loop;
 if shop_private.convert_measurement(999999999999.999999,'m','m')<>999999999999.999999 then raise exception 'Large decimal lost digits';end if;
end;$$;
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(1,'kg','m')$q$,'22023','INCOMPATIBLE_MEASUREMENT_DIMENSION');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(1,'l','ea')$q$,'22023','INCOMPATIBLE_MEASUREMENT_DIMENSION');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(1,'m2','m')$q$,'22023','INCOMPATIBLE_MEASUREMENT_DIMENSION');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(1,'reel','m')$q$,'22023','PRODUCT_PACKAGING_REQUIRED');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(1,'box','ea')$q$,'22023','PRODUCT_PACKAGING_REQUIRED');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(1,'set','ea')$q$,'22023','PRODUCT_PACKAGING_REQUIRED');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(1,'m','ft')$q$,'22023','UNREPRESENTABLE_MEASUREMENT_QUANTITY');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(1,'ea','dozen')$q$,'22023','UNREPRESENTABLE_MEASUREMENT_QUANTITY');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(.000001,'ft','m')$q$,'22023','UNREPRESENTABLE_MEASUREMENT_QUANTITY');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(.5,'ea','ea')$q$,'22023','INVALID_MEASUREMENT_PRECISION');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(1,'mm','m',.01)$q$,'22023','INVALID_MEASUREMENT_INCREMENT');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(1,'ea','ea',.1)$q$,'22023','INVALID_MEASUREMENT_INCREMENT');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement('NaN','m','m')$q$,'22023','INVALID_MEASUREMENT_QUANTITY');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement('Infinity','m','m')$q$,'22023','INVALID_MEASUREMENT_QUANTITY');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(1.0000001,'m','m')$q$,'22023','INVALID_MEASUREMENT_QUANTITY');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(0,'m','m')$q$,'22023','INVALID_MEASUREMENT_QUANTITY');
select pg_temp.measurement_reject($q$select shop_private.convert_measurement(-1,'m','m')$q$,'22023','INVALID_MEASUREMENT_QUANTITY');
select pg_temp.measurement_reject($q$update public.units_of_measure set name_en='changed' where code='m'$q$,'55000','MEASUREMENT_HISTORY_IMMUTABLE');
select pg_temp.measurement_reject($q$delete from public.units_of_measure where code='m'$q$,'55000','MEASUREMENT_HISTORY_IMMUTABLE');

do $$declare role_name text;begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if has_function_privilege(role_name,'shop_private.convert_measurement(numeric,text,text,numeric)','execute')
  or has_table_privilege(role_name,'public.units_of_measure','insert')
  or has_table_privilege(role_name,'public.units_of_measure','update')
  or has_table_privilege(role_name,'public.product_measurement_changes','insert') then raise exception 'Measurement privileges too broad: %',role_name;end if;
 end loop;
 if has_function_privilege('anon','public.prepare_product_measurement(uuid,uuid,text,text,text)','execute')
 or has_function_privilege('anon','public.resolve_product_measurement(uuid,uuid,text,text)','execute')
 then raise exception 'Anon business RPC exposed';end if;
end;$$;

create temporary table measurement_fixture as select gen_random_uuid() owner,gen_random_uuid() outsider;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 select id,id::text||'@measurement.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now()
 from(select owner id from measurement_fixture union all select outsider from measurement_fixture)u;
grant select on measurement_fixture to authenticated;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from measurement_fixture;
set local role authenticated;
do $$declare shop uuid; cable uuid; copper uuid; pieces uuid; legacy uuid; material uuid; customer uuid; sale uuid; ctx jsonb; before_count bigint; vendor uuid;begin
 shop:=public.create_owner_shop('Measurement foundation fixture','mixed'::public.business_mode);
 perform set_config('measurement_test.shop',shop::text,true);
 cable:=public.save_product(shop,null,'Cable measured preparation',null,null,35);
 copper:=public.save_product(shop,null,'Copper measured preparation',null,null,200);
 pieces:=public.save_product(shop,null,'Piece measured preparation',null,null,150);
 legacy:=public.save_product(shop,null,'Legacy fractional stock',null,null,20);
 material:=public.save_product(shop,null,'Legacy grams declaration',null,null,1);
 customer:=public.save_customer(shop,null,'Measurement customer',null,null,null,null);
 perform set_config('measurement_test.product',cable::text,true);
 perform public.prepare_product_measurement(shop,cable,'m','0.001','Prepare unused cable');
 perform public.prepare_product_measurement(shop,copper,'kg','0.001','Prepare unused copper');
 perform public.prepare_product_measurement(shop,pieces,'ea','1','Prepare unused pieces');
 ctx:=public.resolve_product_measurement(shop,cable,'250','cm');
 if ctx->>'baseQuantity'<>'2.5' or ctx->>'baseUnitCode'<>'m' or ctx->>'enteredQuantity'<>'250' or ctx->>'status'<>'prepared' then raise exception 'Canonical resolver snapshot invalid';end if;
 if public.resolve_product_measurement(shop,copper,'250','g')->>'baseQuantity'<>'0.25' then raise exception 'Mass resolver incorrect';end if;
 perform pg_temp.measurement_reject(format('select public.resolve_product_measurement(%L,%L,%L,%L)',shop,pieces,'0.3','ea'),'22023','INVALID_MEASUREMENT_PRECISION');
 perform pg_temp.measurement_reject(format('select public.resolve_product_measurement(%L,%L,%L,%L)',shop,cable,'1','kg'),'22023','INCOMPATIBLE_MEASUREMENT_DIMENSION');
 perform pg_temp.measurement_reject(format('select public.resolve_product_measurement(%L,%L,%L,%L)',shop,cable,'1e3','m'),'22023','INVALID_MEASUREMENT_QUANTITY');
 select count(*) into before_count from public.product_measurement_changes where product_id=cable;
 perform public.prepare_product_measurement(shop,cable,'m','0.001','Prepare unused cable');
 if (select count(*) from public.product_measurement_changes where product_id=cable)<>before_count then raise exception 'Identical configuration retry duplicated audit';end if;
 -- Legacy fractional behavior is preserved. Historic use prevents later relabeling.
 perform public.adjust_stock(gen_random_uuid(),shop,legacy,10.5,2,'Legacy fractional opening');
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',legacy,'quantity',.5)));
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 if (select quantity_on_hand from public.product_stock where product_id=legacy)<>10 then raise exception 'Legacy stock behavior changed';end if;
 perform pg_temp.measurement_reject(format('select public.prepare_product_measurement(%L,%L,%L,%L,%L)',shop,legacy,'m','0.01','Unsafe historical relabel'),'55000','MEASUREMENT_REQUIRES_UNUSED_PRODUCT');
 -- New service declarations synchronize metadata without converting old quantities.
 perform public.define_service_material_unit(shop,material,'g');
 if (select base_unit_code from public.products where id=material)<>'g' then raise exception 'Service declaration not reconciled';end if;
 perform pg_temp.measurement_reject(format('select public.prepare_product_measurement(%L,%L,%L,%L,%L)',shop,material,'kg','0.001','Unsafe service relabel'),'55000','MEASUREMENT_REQUIRES_UNUSED_PRODUCT');
 -- Prepared products cannot reach old two-decimal stock/sale writers.
 vendor:=public.save_vendor(shop,null,'Measurement supplier',null,null,null,null,null,null);
 perform pg_temp.measurement_reject(format('select public.create_supplier_purchase(gen_random_uuid(),%L,%L,%L,current_date,null,%L::jsonb)',shop,vendor,'PREPARED-BLOCK',jsonb_build_array(jsonb_build_object('product_id',cable,'quantity',100,'unit_cost',25))),'55000','MEASUREMENT_WORKFLOW_NOT_READY');
 if exists(select 1 from public.vendor_invoice_items where product_id=cable) then raise exception 'Blocked purchase left a supplier line';end if;
 perform pg_temp.measurement_reject(format('select public.adjust_stock(gen_random_uuid(),%L,%L,100,25,%L)',shop,cable,'Premature measured receipt'),'55000','MEASUREMENT_WORKFLOW_NOT_READY');
 perform pg_temp.measurement_reject(format('select public.save_sale_draft(gen_random_uuid(),%L,null,%L,null,%L::jsonb)',shop,customer,jsonb_build_array(jsonb_build_object('item_type','product','source_id',cable,'quantity',12.5))),'55000','MEASUREMENT_WORKFLOW_NOT_READY');
 perform pg_temp.measurement_reject(format('select public.define_service_material_unit(%L,%L,%L)',shop,cable,'g'),'55000','MEASUREMENT_WORKFLOW_NOT_READY');
 if exists(select 1 from public.inventory_batches where product_id=cable) or exists(select 1 from public.invoice_items where product_id=cable) then raise exception 'Blocked operation left partial stock/line';end if;
 if (select count(*) from public.units_of_measure)<>23 then raise exception 'Registry unavailable to authenticated reader';end if;
end;$$;
reset role;
select set_config('request.jwt.claim.sub',outsider::text,true) from measurement_fixture;
set local role authenticated;
select pg_temp.measurement_reject(format('select public.prepare_product_measurement(%L,%L,%L,%L,%L)',current_setting('measurement_test.shop'),current_setting('measurement_test.product'),'m','0.01','Cross tenant attempt'),'42501','SHOP_PERMISSION_DENIED');
select pg_temp.measurement_reject(format('select public.resolve_product_measurement(%L,%L,%L,%L)',current_setting('measurement_test.shop'),current_setting('measurement_test.product'),'1','m'),'42501','SHOP_PERMISSION_DENIED');
do $$begin
 if exists(select 1 from public.product_measurement_changes where shop_id=current_setting('measurement_test.shop')::uuid) then raise exception 'Cross tenant audit leak';end if;
end;$$;
reset role;
-- Expired subscriptions cannot mutate measurement settings.
update public.subscriptions set trial_end_at=now()-interval '1 second'
where profile_id in(select m.profile_id from public.shop_memberships m where m.shop_id=current_setting('measurement_test.shop')::uuid);
select set_config('request.jwt.claim.sub',owner::text,true) from measurement_fixture;
set local role authenticated;
select pg_temp.measurement_reject(format('select public.prepare_product_measurement(%L,%L,%L,%L,%L)',current_setting('measurement_test.shop'),current_setting('measurement_test.product'),'m','0.01','Expired subscription attempt'),'42501','SHOP_SUBSCRIPTION_INACTIVE');
reset role;
