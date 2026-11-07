-- Synthetic protocol evidence only; used exclusively by owned disposable runners.
create table scale_capture_test.race(owner_id uuid,shop_id uuid,product_id uuid,location_id uuid,staff_id uuid,customer_id uuid,device_id uuid,reading jsonb);
insert into scale_capture_test.race(owner_id) values(gen_random_uuid());
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id,owner_id::text||'@scale-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from scale_capture_test.race;
select set_config('request.jwt.claim.sub',owner_id::text,false),set_config('request.jwt.claim.role','authenticated',false) from scale_capture_test.race;
do $$declare shop uuid;product uuid;location uuid;staff uuid;customer uuid;device uuid;r jsonb;v_reading jsonb;begin
 set local role authenticated;
 shop:=public.create_owner_shop('Synthetic scale concurrency merchant','multi','product');select id into location from public.shop_locations where shop_id=shop and is_default;
 select id into staff from public.shop_memberships where shop_id=shop and role='owner';
 customer:=public.save_customer(shop,null,'Synthetic scale race customer',null,null,null,null);
 product:=public.save_product(shop,null,'Concurrent copper','SCALE-RACE',null,120);perform public.configure_product_measurement(shop,product,'kg','0.001','["kg"]','Synthetic concurrent mass stock');
 perform public.adjust_stock(gen_random_uuid(),shop,product,5,80,'Synthetic scale opening stock');
 r:=public.weighing_setup_command(gen_random_uuid(),shop,location,'device',null,0,'{"label":"Synthetic race scale","model":"Protocol fixture, not hardware","serialNumber":"TEST-RACE-SCALE","serialOptions":{"baudRate":9600,"dataBits":8,"stopBits":1,"parity":"none","flowControl":"none"},"evidenceReference":"Synthetic concurrency fixture only","active":true,"confirmed":true}','Approve synthetic race profile');device:=(r->>'id')::uuid;
 v_reading:=jsonb_build_object('tareBefore','TA A '||lpad('0.125',10,' ')||' kg'||E'\r\n','stable','S S '||lpad('0.25',10,' ')||' kg'||E'\r\n','tareAfter','TA A '||lpad('0.125',10,' ')||' kg'||E'\r\n','serial','TEST-RACE-SCALE','confirmed',true);
 reset role;
 update scale_capture_test.race set shop_id=shop,product_id=product,location_id=location,staff_id=staff,customer_id=customer,device_id=device,reading=v_reading;
end;$$;
