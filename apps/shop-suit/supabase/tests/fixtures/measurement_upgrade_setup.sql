-- Schema upgrade fixture: legitimate service declarations and fractional legacy
-- transactions exist BEFORE the measurement migration is installed.
create temporary table measurement_upgrade_fixture(id uuid default gen_random_uuid(),shop_id uuid,product_id uuid,gram_id uuid,ml_id uuid,before_snapshot jsonb);
insert into measurement_upgrade_fixture default values;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@measurement-upgrade.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from measurement_upgrade_fixture;
select set_config('request.jwt.claim.sub',id::text,false),set_config('request.jwt.claim.role','authenticated',false) from measurement_upgrade_fixture;
do $$declare shop uuid; product uuid; grams uuid; ml uuid; customer uuid; sale uuid;begin
 shop:=public.create_owner_shop('Measurement upgrade history','mixed'::public.business_mode);
 product:=public.save_product(shop,null,'Historically ambiguous quantity',null,null,35);
 grams:=public.save_product(shop,null,'Immutable gram declaration',null,null,2);
 ml:=public.save_product(shop,null,'Immutable milliliter declaration',null,null,3);
 perform public.define_service_material_unit(shop,grams,'g');
 perform public.define_service_material_unit(shop,ml,'mL');
 perform public.adjust_stock(gen_random_uuid(),shop,product,100.5,25,'Historical fractional opening');
 perform public.adjust_stock(gen_random_uuid(),shop,grams,250.5,2,'Historical gram stock');
 perform public.adjust_stock(gen_random_uuid(),shop,ml,1000.5,3,'Historical milliliter stock');
 customer:=public.save_customer(shop,null,'Historical customer',null,null,null,null);
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',12.5)));
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 update measurement_upgrade_fixture set shop_id=shop,product_id=product,gram_id=grams,ml_id=ml;
end;$$;
create function pg_temp.measurement_upgrade_snapshot(p_shop uuid) returns jsonb language sql as $$
 select jsonb_build_object(
 'batches',(select jsonb_agg(to_jsonb(t) order by id) from public.inventory_batches t where shop_id=p_shop),
 'movements',(select jsonb_agg(to_jsonb(t) order by id) from public.inventory_movements t where shop_id=p_shop),
 'lines',(select jsonb_agg(to_jsonb(t) order by id) from public.invoice_items t where shop_id=p_shop),
 'invoices',(select jsonb_agg(to_jsonb(t) order by id) from public.invoices t where shop_id=p_shop),
 'declarations',(select jsonb_agg(to_jsonb(t) order by product_id) from public.service_material_units t where shop_id=p_shop),
 'receipts',(select jsonb_agg(to_jsonb(t) order by invoice_id) from public.sale_receipt_issue_snapshots t where shop_id=p_shop));
$$;
update measurement_upgrade_fixture set before_snapshot=pg_temp.measurement_upgrade_snapshot(shop_id);
