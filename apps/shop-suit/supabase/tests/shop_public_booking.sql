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

create temporary table booking_fixture(shop uuid,slug text,service uuid,location uuid,staff uuid,reference uuid,token text,code text,starts timestamptz,request_key text);
do $$declare f record;member uuid;loc uuid;slug text;opt jsonb;slots jsonb;result jsonb;t timestamptz;begin
 for f in select * from website_catalog_fixture loop
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  slug:='public-'||replace(f.shop::text,'-','');
  assert public.appointment_booking_options(slug)->>'enabled'='false','booking defaults private';
  select id into member from public.shop_memberships where shop_id=f.shop and role='owner';
  select id into loc from public.shop_locations where shop_id=f.shop and is_default;
  perform public.shop_website_catalog_save(f.shop,'service',f.service,'{"publicName":"Published appointment","description":"Public service","image":null,"displayOrder":0,"showPrice":false}');
  perform public.shop_website_catalog_publish(f.shop,'service',f.service,true);
  perform public.shop_booking_settings_save(f.shop,'{"enabled":true,"lead_minutes":0,"horizon_days":30,"change_notice_minutes":60,"allow_reschedule":true,"allow_cancel":true,"reminder_lead_minutes":1440}',jsonb_build_array(jsonb_build_object('membershipId',member,'publicName','Public specialist')));
  opt:=public.appointment_booking_options(slug);
  assert jsonb_array_length(opt->'combinations')=1,'only explicitly published combination';
  assert opt::text not like '%PRIVATE%' and opt::text not like '%SECRET%' and opt->>'remindersEnabled'='false','public projection and disabled reminders';
  slots:=public.appointment_booking_slots(slug,(opt->'combinations'->0->>'service')::uuid,loc,(opt->'combinations'->0->>'staff')::uuid,current_date+2);
  assert jsonb_array_length(slots->'slots')>0,'future slots available';
  t:=(slots->'slots'->0->>'startsAt')::timestamptz;
  result:=public.appointment_booking_command(slug,null,'create',repeat('a',64),null,(opt->'combinations'->0->>'service')::uuid,loc,(opt->'combinations'->0->>'staff')::uuid,t,'Guest booking','+201000000002');
  assert result->>'ok'='true','guest create';
  assert length(result->>'token')=43 and length(result->>'code')=12,'scoped secret returned only to transport';
  insert into booking_fixture values(f.shop,slug,(opt->'combinations'->0->>'service')::uuid,loc,(opt->'combinations'->0->>'staff')::uuid,(result->>'reference')::uuid,result->>'token',result->>'code',t,repeat('a',64));
 end loop;
end$$;
do $$declare f record;g record;r jsonb;h jsonb;t timestamptz;aid uuid;n integer;begin
 for f in select * from booking_fixture loop
  select * into g from booking_fixture where shop<>f.shop limit 1;
  r:=public.appointment_booking_command(f.slug,null,'create',f.request_key,null,f.service,f.location,f.staff,f.starts,'Guest booking','+201000000002');
  assert r->>'ok'='true' and r->>'reference'=f.reference::text and r->>'code' is null,'idempotent create, no code replay';
  assert (select count(*)=1 from public.appointment_booking_commands where shop_id=f.shop),'one command';
  assert (select count(*)=1 from public.appointment_reminder_intents where shop_id=f.shop and state='disabled'),'one disabled reminder intent';
  assert public.appointment_booking_command(f.slug,null,'create',f.request_key,null,f.service,f.location,f.staff,f.starts,'Changed name','+201000000002')->>'ok'='false','key reuse rejected';
  assert public.appointment_booking_command(f.slug,null,'create',repeat('b',64),null,f.service,f.location,f.staff,f.starts,'Another guest','+201000000003')->>'ok'='false','already booked slot rejected';
  assert public.appointment_booking_command(f.slug,f.token,'create',repeat('c',64),null,f.service,f.location,f.staff,f.starts+interval '1 hour',null,null)->>'ok'='false','walk-in cannot broaden';
  assert public.appointment_booking_command(g.slug,f.token,'cancel',repeat('d',64),g.reference)->>'ok'='false','cross-shop token denied';
  assert public.appointment_booking_command(f.slug,f.token,'cancel',repeat('e',64),g.reference)->>'ok'='false','foreign reference denied';
  h:=public.appointment_booking_manage(f.slug,f.token);
  assert h->>'authenticated'='true' and jsonb_array_length(h->'items')=1 and h->'items'->0->>'reference'=f.reference::text,'guest manage one';
  assert h::text not like '%PRIVATE%' and h::text not like '%SECRET%' and h::text not like '%payment%' and h::text not like '%customerId%' and h::text not like '%notes%','allowlisted management';
  assert public.appointment_customer_portal(f.slug,f.token)->>'scope'='appointment','guest uses existing one-appointment scope';
  t:=(public.appointment_booking_slots(f.slug,f.service,f.location,f.staff,(f.starts at time zone 'Africa/Cairo')::date,f.token,f.reference)->'slots'->1->>'startsAt')::timestamptz;
  assert t is not null and t<>f.starts,'new slot exists excluding own interval';
  r:=public.appointment_booking_command(f.slug,f.token,'reschedule',repeat('f',64),f.reference,f.service,f.location,f.staff,t);
  assert r->>'ok'='true','scoped reschedule';
  assert public.appointment_booking_command(f.slug,f.token,'reschedule',repeat('f',64),f.reference,f.service,f.location,f.staff,t)->>'ok'='true','idempotent reschedule';
  assert (select count(*)=1 from public.appointment_reminder_intents where shop_id=f.shop and state='disabled'),'one current disabled reminder';
  assert (select count(*)=1 from public.appointment_reminder_intents where shop_id=f.shop and state='cancelled'),'old disabled reminder cancelled';
  r:=public.appointment_booking_command(f.slug,f.token,'cancel',repeat('1',64),f.reference);
  assert r->>'ok'='true','scoped cancel';
  assert public.appointment_booking_command(f.slug,f.token,'cancel',repeat('1',64),f.reference)->>'ok'='true','idempotent cancel';
  select appointment_id into aid from public.appointment_booking_references where reference=f.reference;
  assert (select status='cancelled' and booking_origin='public' and created_by_profile_id is null from public.appointments where id=aid),'accurate cancellation, honest creator';
  assert not exists(select 1 from public.appointment_reminder_intents where appointment_id=aid and state<>'cancelled'),'no live reminders';
  assert (select count(*)>=3 from public.appointment_events where appointment_id=aid and actor_kind='public_customer' and actor_profile_id is null),'customer audit';
  assert (select count(*)=1 from public.appointment_booking_events where appointment_id=aid and action='created'),'idempotent creation audit';
  assert coalesce(current_setting('shop.public_booking',true),'')<>'true','actor context cleared';
 end loop;
end$$;
-- Saved-customer create is bound to its saved ID, never a phone/name lookup.
do $$declare f record;b record;cr jsonb;session jsonb;slots jsonb;r jsonb;aid uuid;t timestamptz;begin
 for f in select * from access_fixture loop
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  select * into b from booking_fixture where shop=f.shop;
  cr:=public.appointment_access_issue(f.shop,f.appointment);
  session:=public.appointment_access_verify(b.slug,cr->>'code','01000000000');
  assert session->>'ok'='true','saved customer verifies';
  slots:=public.appointment_booking_slots(b.slug,b.service,b.location,b.staff,current_date+3);t:=(slots->'slots'->0->>'startsAt')::timestamptz;
  r:=public.appointment_booking_command(b.slug,session->>'token','create',repeat('2',64),null,b.service,b.location,b.staff,t);
  assert r->>'ok'='true','saved customer create';
  select appointment_id into aid from public.appointment_booking_references where reference=(r->>'reference')::uuid;
  assert (select client_id=f.customer and identity_kind='customer' from public.appointments where id=aid),'saved customer exact identity';
  assert public.appointment_booking_command(b.slug,null,'cancel',repeat('3',64),(r->>'reference')::uuid)->>'ok'='false','missing session denied';
  update public.appointment_access_sessions set revoked_at=clock_timestamp() where token_hash=shop_private.appointment_access_hash(session->>'token');
  assert public.appointment_booking_command(b.slug,session->>'token','cancel',repeat('4',64),(r->>'reference')::uuid)->>'accessEnded'='true','revoked session denied';
  update public.shop_booking_policies set change_notice_minutes=10080 where shop_id=f.shop;
  assert public.appointment_booking_command(b.slug,b.token,'reschedule',repeat('5',64),b.reference,b.service,b.location,b.staff,b.starts+interval '3 hours')->>'ok'='false','notice/status policy enforced';
  update public.shop_booking_policies set enabled=false where shop_id=f.shop;
  assert public.appointment_booking_options(b.slug)->>'enabled'='false','owner disables immediately';
  assert jsonb_array_length(public.appointment_booking_slots(b.slug,b.service,b.location,b.staff,current_date+3)->'slots')=0,'disabled slots hidden';
 end loop;
end$$;
set local role anon;
do $$declare denied boolean:=false;begin
 begin perform * from public.appointments limit 1;exception when insufficient_privilege then denied:=true;end;assert denied,'no raw appointment read';
 denied:=false;begin perform * from public.shop_booking_policies limit 1;exception when insufficient_privilege then denied:=true;end;assert denied,'no raw policy write/read';
 denied:=false;begin perform shop_private.booking_session(gen_random_uuid(),gen_random_uuid());exception when insufficient_privilege then denied:=true;end;assert denied,'no direct session mint';
 denied:=false;begin perform public.shop_booking_settings((select shop from website_catalog_fixture limit 1));exception when insufficient_privilege then denied:=true;end;assert denied,'owner-only settings';
end$$;
reset role;
-- Publication, availability and numeric policy cannot be bypassed by a caller.
do $$declare f record;b record;owner_actor uuid;member uuid;other_shop uuid;t timestamptz;n integer;denied boolean;begin
 select * into b from booking_fixture order by shop limit 1;select actor into owner_actor from access_fixture where shop=b.shop;
 perform set_config('request.jwt.claim.sub',owner_actor::text,true);
 update public.shop_booking_policies set enabled=true,change_notice_minutes=60 where shop_id=b.shop;
 t:=(public.appointment_booking_slots(b.slug,b.service,b.location,b.staff,current_date+8)->'slots'->0->>'startsAt')::timestamptz;
 assert t is not null,'known available slot';
 assert public.appointment_booking_command(b.slug,null,'create',repeat('6',64),null,b.service,b.location,b.staff,t+interval '1 second','Unaligned guest','+201000000077')->>'ok'='false','off-grid write rejected';
 select membership_id into member from public.shop_booking_staff where public_id=b.staff;
 insert into public.appointment_schedule_blocks(shop_id,location_id,membership_id,kind,starts_at,ends_at,created_by_profile_id) select b.shop,b.location,member,'time_off',t,t+interval '1 hour',profile from website_catalog_fixture where shop=b.shop;
 assert public.appointment_booking_command(b.slug,null,'create',repeat('7',64),null,b.service,b.location,b.staff,t,'Unavailable guest','+201000000077')->>'ok'='false','time off rechecked at commit';
 update public.shop_booking_staff set published=false where public_id=b.staff;
 assert jsonb_array_length(public.appointment_booking_options(b.slug)->'combinations')=0,'unlisted staff hidden';
 update public.shop_booking_staff set published=true where public_id=b.staff;
 update public.shop_website_catalog_entries set published=false where id=b.service;
 assert jsonb_array_length(public.appointment_booking_options(b.slug)->'combinations')=0,'unpublished service hidden';
 update public.shop_website_catalog_entries set published=true where id=b.service;
 update public.shop_locations set status='archived',archived_at=clock_timestamp(),is_default=false where id=b.location;
 assert public.appointment_booking_options(b.slug)->>'enabled'='false' or jsonb_array_length(public.appointment_booking_options(b.slug)->'combinations')=0,'inactive location hidden';
 update public.shop_locations set status='active',archived_at=null,is_default=true where id=b.location;
 select shop into other_shop from booking_fixture where shop<>b.shop limit 1;
 denied:=false;begin perform public.shop_booking_settings(other_shop);exception when insufficient_privilege then denied:=true;end;assert denied,'foreign owner settings denied';
 denied:=false;begin perform public.shop_booking_settings_save(b.shop,'{"enabled":false,"lead_minutes":0,"horizon_days":30,"change_notice_minutes":60,"allow_reschedule":true,"allow_cancel":true,"reminder_lead_minutes":1440,"reminders_enabled":true}','[]');exception when others then denied:=true;end;assert denied,'no unconfigured reminder enable';
 perform public.shop_website_profile_unpublish(b.shop);
 assert public.appointment_booking_options(b.slug)->>'enabled'='false','unpublish immediately hides booking';
 assert public.appointment_booking_manage(b.slug,b.token)->>'authenticated'='false','unpublish hides private management read';
 assert public.appointment_booking_command(b.slug,b.token,'cancel',repeat('8',64),b.reference)->>'ok'='false','unpublished writes denied';
end$$;
