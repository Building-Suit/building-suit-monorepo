create schema measurement_test;
create table measurement_test.race(owner_id uuid,shop_id uuid,product_id uuid);
insert into measurement_test.race(owner_id) values(gen_random_uuid());
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id,owner_id::text||'@measurement-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from measurement_test.race;
select set_config('request.jwt.claim.sub',owner_id::text,false),set_config('request.jwt.claim.role','authenticated',false) from measurement_test.race;
do $$declare shop uuid;product uuid;begin
 shop:=public.create_owner_shop('Measurement race fixture','mixed'::public.business_mode);
 product:=public.save_product(shop,null,'Configure versus receipt race',null,null,35);
 update measurement_test.race set shop_id=shop,product_id=product;
end;$$;
