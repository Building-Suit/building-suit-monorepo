-- Disposable fixtures; runner always rolls back, including actual profile publication.
create temporary table website_catalog_fixture(actor uuid,shop uuid,profile uuid,product uuid,service uuid);
insert into website_catalog_fixture(actor) values(gen_random_uuid()),(gen_random_uuid());
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select actor,actor::text||'@catalog.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from website_catalog_fixture;
do $$declare f record; v_shop uuid; v_profile uuid;begin
 for f in select actor from website_catalog_fixture loop
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  v_shop:=public.create_owner_shop('PRIVATE SHOP','mixed','PRIVATE LOCATION','MAIN','PRIVATE ADDRESS','+201000000001');
  select profile_id into v_profile from public.shop_memberships where shop_id=v_shop and role='owner';
  update website_catalog_fixture set shop=v_shop,profile=v_profile where actor=f.actor;
 end loop;
end$$;
-- Fixture variable names are intentionally distinct in the source insert block.
do $$declare f record; p uuid; s uuid;begin
 for f in select * from website_catalog_fixture loop
  insert into public.products(shop_id,name,sku,barcode,sale_price,created_by_profile_id) values(f.shop,'PRIVATE PRODUCT','SECRET-SKU','SECRET-BARCODE',12.50,f.profile) returning id into p;
  insert into public.services(shop_id,name,description,base_sale_price,default_discount_type,default_discount_value,created_by_profile_id) values(f.shop,'PRIVATE SERVICE','SECRET INTERNAL NOTES',999.88,'amount',0,f.profile) returning id into s;
  update website_catalog_fixture set product=p,service=s where actor=f.actor;
 end loop;
end$$;

grant select on website_catalog_fixture to authenticated,anon;
do $$declare f record; loc uuid; slug text;begin
 for f in select * from website_catalog_fixture loop
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  slug:='public-'||replace(f.shop::text,'-','');
  perform public.shop_website_address_save(f.shop,'old-'||slug);
  perform public.shop_website_address_save(f.shop,slug);
  select id into loc from public.shop_locations where shop_id=f.shop and is_default;
  perform public.shop_website_profile_save(f.shop,jsonb_build_object('publicName',slug,'description','Public description','phone','+201000000002','email','','whatsapp','','openingHours','09:00–17:00','seoTitle','','seoDescription','','locations',jsonb_build_array(jsonb_build_object('id',loc,'visible',true,'publicName','Public showroom','address','Public street'))));
  perform public.shop_website_logo_replace(f.shop,'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGMU07RmYGBgYmBgYGBgAAAFvQB+2cWeHgAAAABJRU5ErkJggg==');
  perform public.shop_website_catalog_save(f.shop,'product',f.product,'{"publicName":"Public product","description":"Public description","image":null,"displayOrder":0,"showPrice":false}');
  perform public.shop_website_catalog_publish(f.shop,'product',f.product,true);
  perform public.shop_website_profile_publish(f.shop,true);
 end loop;
end$$;

-- Synthetic scheduling fixtures; every credential and session rolls back.
create temporary table access_fixture(actor uuid,shop uuid,customer uuid,appointment uuid,walk_in uuid,no_phone uuid,code text,walk_code text,token text);
grant select,update on access_fixture to authenticated,anon;
do $$declare f record; loc uuid; member uuid; customer uuid; a uuid; w uuid; n uuid;begin
 for f in select * from website_catalog_fixture loop
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  select id into loc from public.shop_locations where shop_id=f.shop and is_default;
  select id into member from public.shop_memberships where shop_id=f.shop and role='owner';
  perform public.save_service(f.shop,f.service,'PRIVATE appointment service',null,10,'amount',0,true,30,0,array[loc],array[member]);
  customer:=public.save_customer(f.shop,null,'PRIVATE customer','01000000000',null,null,null);
  perform public.save_staff_schedule(f.shop,loc,member,'Africa/Cairo',(select jsonb_agg(jsonb_build_object('weekday',day,'startsLocal','08:00','endsLocal','20:00')) from generate_series(0,6) day),'[]');
  a:=public.save_appointment(gen_random_uuid(),f.shop,null,loc,member,f.service,date_trunc('day',now())+interval '1 day 10 hours','customer',customer,null,null,'PRIVATE financial notes');
  w:=public.save_appointment(gen_random_uuid(),f.shop,null,loc,member,f.service,date_trunc('day',now())+interval '1 day 11 hours','walk_in',null,'PRIVATE walk-in','+20 100 000 0002','PRIVATE walk-in notes');
  n:=public.save_appointment(gen_random_uuid(),f.shop,null,loc,member,f.service,date_trunc('day',now())+interval '1 day 12 hours','walk_in',null,'No phone',null,null);
  insert into access_fixture values(f.actor,f.shop,customer,a,w,n,null,null,null);
 end loop;
end$$;

-- Same-name/same-phone identities must never broaden either scope.
do $$declare f record;loc uuid;member uuid;service uuid;other uuid;v_appointment uuid;hidden uuid;i integer;st text;begin
 for f in select * from access_fixture loop
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  select location_id,assigned_membership_id,service_id into loc,member,service from public.appointments where id=f.appointment;
  update public.services set name='Customer service' where id=service;
  update public.appointments set walk_in_phone='01000000000',walk_in_name='PRIVATE customer' where id=f.walk_in;
  other:=public.save_customer(f.shop,null,'PRIVATE customer','01000000000',null,null,null);
  perform public.save_appointment(gen_random_uuid(),f.shop,null,loc,member,service,date_trunc('day',now())+interval '1 day 13 hours','customer',other,null,null,'SECRET_OTHER_CUSTOMER');
  for i in 2..21 loop perform public.save_appointment(gen_random_uuid(),f.shop,null,loc,member,service,date_trunc('day',now())+make_interval(days=>i,hours=>10),'customer',f.customer,null,null,'SECRET_INTERNAL_NOTE');end loop;
  insert into public.shop_locations(shop_id,name,code,address,phone) values(f.shop,'SECRET_LOCATION','HIDDEN','SECRET_ADDRESS','+201000000099') returning id into hidden;
  perform public.save_service(f.shop,service,'Customer service',null,10,'amount',0,true,30,0,array[loc,hidden],array[member]);
  insert into public.appointment_working_hours(shop_id,location_id,membership_id,weekday,starts_local,ends_local,timezone) select shop_id,hidden,membership_id,weekday,starts_local,ends_local,timezone from public.appointment_working_hours where location_id=loc and membership_id=member;
  for i in 1..3 loop
   v_appointment:=public.save_appointment(gen_random_uuid(),f.shop,null,case when i=1 then hidden else loc end,member,service,date_trunc('day',now())-make_interval(days=>i)+interval '10 hours','customer',f.customer,null,null,'SECRET_INTERNAL_NOTE');
   st:=(array['completed','cancelled','no_show'])[i];
   update public.appointments set status=st::public.appointment_status where appointments.id=v_appointment;
  end loop;
  update access_fixture set code=public.appointment_access_issue(f.shop,f.appointment)->>'code',walk_code=public.appointment_access_issue(f.shop,f.walk_in)->>'code' where shop=f.shop;
 end loop;
end$$;
select set_config('request.jwt.claim.sub',actor::text,true) from access_fixture order by actor limit 1;
set local role anon;
do $$declare f record;v jsonb;t text;begin
 for f in select * from access_fixture loop
  v:=public.appointment_access_verify('public-'||replace(f.shop::text,'-',''),f.code,'01000000000');t:=v->>'token';
  if v->>'ok'<>'true' then raise exception 'fixture saved session';end if;
  update access_fixture set token=t where shop=f.shop;
  v:=public.appointment_customer_portal('public-'||replace(f.shop::text,'-',''),t,'upcoming',1);
  if v->>'authenticated'<>'true' or v->>'scope'<>'customer' or v->>'total'<>'21' or jsonb_array_length(v->'items')<>20 then raise exception 'saved upcoming scope/pagination %',v-'items';end if;
  if v::text ~ 'SECRET|PRIVATE|saleId|clientId|customerId|invoice|receipt|payment|balance|price|cost|notes|email|phone|audit' then raise exception 'forbidden saved payload';end if;
  if v->'items'->0->'location'<> '{"name":"Public showroom","address":"Public street"}' then raise exception 'public location projection';end if;
  v:=public.appointment_customer_portal('public-'||replace(f.shop::text,'-',''),t,'upcoming',2);
  if jsonb_array_length(v->'items')<>1 or v->>'page'<>'2' then raise exception 'second history page';end if;
  v:=public.appointment_customer_portal('public-'||replace(f.shop::text,'-',''),t,'past',1);
  if v->>'total'<>'3' or v->'items'->0->>'status'<>'completed' or v->'items'->1->>'status'<>'cancelled' or v->'items'->2->>'status'<>'no_show' then raise exception 'historical statuses';end if;
  if v->'items'->0->'location'<>'null' or v::text ~ 'SECRET|PRIVATE' then raise exception 'hidden location exposed';end if;
  v:=public.appointment_access_verify('public-'||replace(f.shop::text,'-',''),f.walk_code,'01000000000');
  if v->>'ok'<>'true' then raise exception 'fixture walk session';end if;
  v:=public.appointment_customer_portal('public-'||replace(f.shop::text,'-',''),v->>'token','upcoming',1);
  if v->>'scope'<>'appointment' or v->>'total'<>'1' or jsonb_array_length(v->'items')<>1 then raise exception 'walk in broadened by phone/name';end if;
 end loop;
end$$;
reset role;
set local role anon;
do $$declare a record;b record;slug text;v jsonb;begin
 select * into a from access_fixture order by actor limit 1;select * into b from access_fixture where actor<>a.actor;slug:='public-'||replace(a.shop::text,'-','');
 if public.appointment_customer_portal(slug,null)<>'{"authenticated":false}' or public.appointment_customer_portal(slug,'bad')<>'{"authenticated":false}' or public.appointment_customer_portal('public-'||replace(b.shop::text,'-',''),a.token)<>'{"authenticated":false}' or public.appointment_customer_portal(slug,a.token,'all',1)<>'{"authenticated":false}' or public.appointment_customer_portal(slug,a.token,'upcoming',0)<>'{"authenticated":false}' then raise exception 'unauthorized/query denial';end if;
 perform public.appointment_access_session_revoke(slug,a.token);
 if public.appointment_customer_portal(slug,a.token)<>'{"authenticated":false}' then raise exception 'revoked session history';end if;
 begin perform 1 from public.appointments;raise exception 'anonymous direct history';exception when insufficient_privilege then null;end;
end$$;
reset role;
do $$declare f record;v jsonb;t text;slug text;begin
 select * into f from access_fixture order by actor limit 1;slug:='public-'||replace(f.shop::text,'-','');
 v:=public.appointment_access_verify(slug,f.code,'01000000000');t:=v->>'token';
 update public.appointment_access_sessions set created_at=statement_timestamp()-interval '11 minutes',expires_at=statement_timestamp()-interval '1 minute' where token_hash=shop_private.appointment_access_hash(t);
 if public.appointment_customer_portal(slug,t)<>'{"authenticated":false}' then raise exception 'expired history';end if;
 v:=public.appointment_access_verify(slug,f.code,'01000000000');t:=v->>'token';
 perform set_config('request.jwt.claim.sub',f.actor::text,true);
 perform public.appointment_access_revoke(f.shop,f.appointment);
 if public.appointment_customer_portal(slug,t)<>'{"authenticated":false}' then raise exception 'revoked code history';end if;
 if has_function_privilege('anon','shop_private.appointment_access_scope(text,text)','EXECUTE') then raise exception 'private identity scope exposed';end if;
end$$;
