-- Owned synthetic source quotations; these are not live commodity market data.
create table commodity_pricing_test.race(owner_id uuid,shop_id uuid,location_id uuid,staff_id uuid,product_id uuid,quote_id uuid,rule_id uuid,invoice_id uuid,quote_values jsonb,rule_values jsonb);
insert into commodity_pricing_test.race(owner_id) values(gen_random_uuid());
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id,owner_id::text||'@commodity-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from commodity_pricing_test.race;
select set_config('request.jwt.claim.sub',owner_id::text,false),set_config('request.jwt.claim.role','authenticated',false) from commodity_pricing_test.race;
set role authenticated;
do $$declare shop uuid;location uuid;staff uuid;vendor uuid;customer uuid;product uuid;quote uuid;rule uuid;invoice uuid;q jsonb;v jsonb;begin
 shop:=public.create_owner_shop('Synthetic commodity race merchant','multi','mixed');select id into location from public.shop_locations where shop_id=shop and is_default;select id into staff from public.shop_memberships where shop_id=shop and role='owner';
 vendor:=public.save_vendor(shop,null,'Synthetic commodity race supplier',null,null,null,null,null,null);customer:=public.save_customer(shop,null,'Synthetic commodity race customer',null,null,null,null);
 product:=public.save_product(shop,null,'Synthetic commodity race cable','COMMODITY-RACE',null,35);perform public.configure_product_measurement(shop,product,'m','0.001','["m"]','Synthetic race stock unit');
 perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'COMMODITY-RACE-OPEN',current_date,null,jsonb_build_array(jsonb_build_object('product_id',product,'quantity','10','unit_code','m','measurement_revision',1,'unit_cost','20')));
 q:=jsonb_build_object('active',true,'confirmed',true,'commodity','Copper','sourceName','Synthetic race supplier quote','evidenceReference','Synthetic race source TEST-001','currency','EGP','pricePerKg','100','effectiveAt',clock_timestamp()-interval '1 day','expiresAt',clock_timestamp()+interval '1 day');
 quote:=(public.commodity_pricing_command(gen_random_uuid(),shop,'quote',null,0,q,'Approve synthetic race source')->>'id')::uuid;
 v:=jsonb_build_object('active',true,'confirmed',true,'productId',product,'quoteId',quote,'kgPerBaseUnit','0.2','premiumPerBaseUnit','5','measurementRevision',1,'baseUnitCode','m','evidenceReference','Synthetic commodity race content');
 rule:=(public.commodity_pricing_command(gen_random_uuid(),shop,'rule',null,0,v,'Approve synthetic race rule')->>'id')::uuid;
 invoice:=public.save_pos_sale_draft(gen_random_uuid(),shop,location,null,staff,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity','1','unit_code','m','measurement_revision',1)));
 perform set_config('commodity_race.shop',shop::text,false);perform set_config('commodity_race.location',location::text,false);perform set_config('commodity_race.staff',staff::text,false);perform set_config('commodity_race.product',product::text,false);perform set_config('commodity_race.quote',quote::text,false);perform set_config('commodity_race.rule',rule::text,false);perform set_config('commodity_race.invoice',invoice::text,false);perform set_config('commodity_race.quote_values',q::text,false);perform set_config('commodity_race.rule_values',v::text,false);
end;$$;
reset role;
update commodity_pricing_test.race set shop_id=current_setting('commodity_race.shop')::uuid,location_id=current_setting('commodity_race.location')::uuid,staff_id=current_setting('commodity_race.staff')::uuid,product_id=current_setting('commodity_race.product')::uuid,quote_id=current_setting('commodity_race.quote')::uuid,rule_id=current_setting('commodity_race.rule')::uuid,invoice_id=current_setting('commodity_race.invoice')::uuid,quote_values=current_setting('commodity_race.quote_values')::jsonb,rule_values=current_setting('commodity_race.rule_values')::jsonb;
