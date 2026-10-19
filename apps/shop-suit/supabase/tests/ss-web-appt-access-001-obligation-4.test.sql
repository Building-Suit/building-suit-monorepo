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
-- Actual generator format/uniqueness; unbiased 12 symbols over 32 values = 60 bits.
do $$declare bad integer;distinct_count integer;begin
 with codes as materialized(select shop_private.appointment_access_random_code() code from generate_series(1,10000)) select count(*) filter(where code !~ '^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{12}$'),count(distinct code) into bad,distinct_count from codes;
 if bad<>0 or distinct_count<>10000 then raise exception 'code generator format/collision';end if;
 if shop_private.appointment_access_phone('٠١٠ ٠٠٠٠ ٠٠٠٠')<>'01000000000' or shop_private.appointment_access_phone('0020 (100) 000-0002')<>shop_private.appointment_access_phone('+20 100 000 0002') or shop_private.appointment_access_phone('12') is not null then raise exception 'phone normalization';end if;
end$$;
select set_config('request.jwt.claim.sub',actor::text,true) from access_fixture order by actor limit 1;
set local role authenticated;
do $$declare a record;b record;v jsonb;begin
 select * into a from access_fixture where actor=auth.uid();select * into b from access_fixture where actor<>auth.uid();
 begin perform public.appointment_access_issue(b.shop,b.appointment);raise exception 'cross shop staff issue';exception when insufficient_privilege then null;end;
 begin perform public.appointment_access_issue(a.shop,b.appointment);raise exception 'foreign appointment issue';exception when insufficient_privilege then null;end;
 begin perform public.appointment_access_revoke(b.shop,b.appointment);raise exception 'cross shop revoke';exception when insufficient_privilege then null;end;
 begin perform public.appointment_access_issue(a.shop,a.no_phone);raise exception 'missing phone accepted';exception when invalid_parameter_value then null;end;
 update access_fixture set code=public.appointment_access_issue(a.shop,a.appointment)->>'code',walk_code=public.appointment_access_issue(a.shop,a.walk_in)->>'code' where shop=a.shop;
 v:=public.appointment_access_status(a.shop,a.appointment);
 if v->>'enabled'<>'true' or v->>'usablePhone'<>'true' then raise exception 'staff state';end if;
 if public.appointment_access_status(a.shop,a.no_phone)->>'usablePhone'<>'false' then raise exception 'missing phone state';end if;
end$$;
reset role;
set local role anon;
do $$declare a record;b record;v jsonb;begin
 select * into a from access_fixture where code is not null;select * into b from access_fixture where code is null;
 if public.appointment_access_verify('unknown-shop',a.code,'01000000000')<>'{"ok":false}' or public.appointment_access_verify('public-'||replace(b.shop::text,'-',''),a.code,'01000000000')<>'{"ok":false}' then raise exception 'unknown/cross shop replay';end if;
 if public.appointment_access_verify('public-'||replace(a.shop::text,'-',''),a.code,null)<>'{"ok":false}' or public.appointment_access_verify('public-'||replace(a.shop::text,'-',''),'bad-code','01000000000')<>'{"ok":false}' then raise exception 'code alone/invalid enumerated';end if;
 v:=public.appointment_access_verify('public-'||replace(a.shop::text,'-',''),lower(a.code),'010 0000 0000');
 if v->>'ok'<>'true' or length(v->>'token')<>43 or (v-'ok'-'token'-'expiresAt')<>'{}' then raise exception 'verification leaked data or failed';end if;
 update access_fixture set token=v->>'token' where shop=a.shop;
 if public.appointment_access_session_validate('public-'||replace(b.shop::text,'-',''),v->>'token')<>'{"ok":false}' then raise exception 'session cross shop replay';end if;
 perform public.appointment_access_session_revoke('public-'||replace(b.shop::text,'-',''),v->>'token');
 if public.appointment_access_session_rotate('public-'||replace(b.shop::text,'-',''),v->>'token')<>'{"ok":false}' then raise exception 'foreign token rotated';end if;
 if public.appointment_access_session_validate('public-'||replace(a.shop::text,'-',''),v->>'token')->>'ok'<>'true' then raise exception 'valid session rejected';end if;
 begin perform 1 from public.appointment_access_credentials;raise exception 'anon credentials';exception when insufficient_privilege then null;end;
 begin perform 1 from public.appointment_access_sessions;raise exception 'anon sessions';exception when insufficient_privilege then null;end;
 begin perform public.appointment_access_issue(a.shop,a.appointment);raise exception 'anon issue';exception when insufficient_privilege then null;end;
end$$;
reset role;
do $$declare a record;s jsonb;begin
 select * into a from access_fixture where token is not null;
 s:=shop_private.appointment_access_scope('public-'||replace(a.shop::text,'-',''),a.token);
 if s->>'customerId'<>a.customer::text or s->'appointmentId'<>'null' or s->>'shopId'<>a.shop::text then raise exception 'saved customer scope';end if;
 -- Ordinary edits preserve the exact credential and current session.
 update public.appointments set notes='PRIVATE changed notes' where id=a.appointment;
 if public.appointment_access_session_validate('public-'||replace(a.shop::text,'-',''),a.token)->>'ok'<>'true' then raise exception 'ordinary edit rotated access';end if;
 -- Token rotation retains its original fixed expiry and invalidates the old token.
 s:=public.appointment_access_session_rotate('public-'||replace(a.shop::text,'-',''),a.token);
 if s->>'ok'<>'true' or public.appointment_access_session_validate('public-'||replace(a.shop::text,'-',''),a.token)<>'{"ok":false}' then raise exception 'token rotation';end if;
 update access_fixture set token=s->>'token' where shop=a.shop;
 if public.appointment_access_session_validate('public-'||replace(a.shop::text,'-',''),s->>'token')->'expiresAt'<>s->'expiresAt' then raise exception 'sliding session lifetime';end if;
end$$;
set local role authenticated;
do $$declare a record;old text;begin
 select * into a from access_fixture where token is not null;old:=a.code;
 update access_fixture set code=public.appointment_access_issue(a.shop,a.appointment)->>'code' where shop=a.shop;
 if public.appointment_access_session_validate('public-'||replace(a.shop::text,'-',''),a.token)<>'{"ok":false}' or public.appointment_access_verify('public-'||replace(a.shop::text,'-',''),old,'01000000000')<>'{"ok":false}' then raise exception 'credential rotation retained prior access';end if;
end$$;
reset role;
do $$declare a record;v jsonb;slug text;i integer;begin
 select * into a from access_fixture where code is not null;slug:='public-'||replace(a.shop::text,'-','');
 v:=public.appointment_access_verify(slug,a.walk_code,'00201000000002');
 if v->>'ok'<>'true' then raise exception 'walk in verification';end if;
 if shop_private.appointment_access_scope(slug,v->>'token')->>'appointmentId'<>a.walk_in::text or shop_private.appointment_access_scope(slug,v->>'token')->'customerId'<>'null' then raise exception 'walk in scope';end if;
 update public.appointments set walk_in_phone='0020 (100) 000-0002' where id=a.walk_in;
 if public.appointment_access_session_validate(slug,v->>'token')->>'ok'<>'true' then raise exception 'phone formatting revoked access';end if;
 perform public.appointment_access_session_revoke(slug,v->>'token');
 if public.appointment_access_session_validate(slug,v->>'token')<>'{"ok":false}' then raise exception 'logout failed';end if;
 v:=public.appointment_access_verify(slug,a.code,'01000000000');
 if v->>'ok'<>'true' then raise exception 'new code not usable';end if;
 -- Relinking an appointment cannot transfer a prior credential to a different
 -- saved customer, even if that customer happens to have the same phone.
 update public.appointments set client_id=(select public.save_customer(a.shop,null,'Other private customer','01000000000',null,null,null)) where id=a.appointment;
 update public.appointments set client_id=a.customer where id=a.appointment;
 if public.appointment_access_session_validate(slug,v->>'token')<>'{"ok":false}' or public.appointment_access_verify(slug,a.code,'01000000000')<>'{"ok":false}' then raise exception 'identity restoration resurrected access';end if;
 update access_fixture set code=public.appointment_access_issue(a.shop,a.appointment)->>'code' where shop=a.shop returning code into a.code;
 v:=public.appointment_access_verify(slug,a.code,'01000000000');
 if v->>'ok'<>'true' then raise exception 'reissued identity code unusable';end if;
 -- Phone changes revoke permanently, even if a former phone is restored later.
 update public.clients set phone='01000000009' where id=a.customer;update public.clients set phone='01000000000' where id=a.customer;
 if public.appointment_access_session_validate(slug,v->>'token')<>'{"ok":false}' or public.appointment_access_verify(slug,a.code,'01000000000')<>'{"ok":false}' then raise exception 'phone restoration resurrected access';end if;
 -- Rotate, expire a session in the fixture, then revoke the credential explicitly.
 update access_fixture set code=public.appointment_access_issue(a.shop,a.appointment)->>'code' where shop=a.shop returning code into a.code;
 v:=public.appointment_access_verify(slug,a.code,'01000000000');
 update public.appointment_access_sessions set created_at=statement_timestamp()-interval '11 minutes',expires_at=statement_timestamp()-interval '1 minute' where token_hash=shop_private.appointment_access_hash(v->>'token');
 if public.appointment_access_session_validate(slug,v->>'token')<>'{"ok":false}' then raise exception 'expired token accepted';end if;
 perform public.appointment_access_revoke(a.shop,a.appointment);
 if public.appointment_access_verify(slug,a.code,'01000000000')<>'{"ok":false}' then raise exception 'revocation failed';end if;
 -- Rate attempts must persist on failure, never roll back via an exception.
 update access_fixture set code=public.appointment_access_issue(a.shop,a.appointment)->>'code' where shop=a.shop returning code into a.code;
 delete from public.appointment_access_rate_windows;
 for i in 1..5 loop if public.appointment_access_verify(slug,a.code,'01000000009')<>'{"ok":false}' then raise exception 'wrong phone accepted';end if;end loop;
 if public.appointment_access_verify(slug,a.code,'01000000000')<>'{"ok":false}' then raise exception 'credential quota bypass';end if;
 if not exists(select from public.appointment_access_rate_windows where attempts=6) then raise exception 'failed rate attempts rolled back';end if;
 if (select count(*) from public.appointment_access_events where shop_id=a.shop)<10 then raise exception 'access audit missing';end if;
 if exists(select from public.appointment_access_events e where e.shop_id=a.shop and (to_jsonb(e)::text like '%'||a.code||'%' or to_jsonb(e)::text like '%'||coalesce(v->>'token','TOKEN-ABSENT')||'%')) then raise exception 'audit secret leak';end if;
 if exists(select from public.appointment_events e where e.shop_id=a.shop and (e.after_state ? 'code_hash' or e.after_state ? 'token_hash')) then raise exception 'appointment audit contains credentials';end if;
end$$;
-- Force collisions transaction-locally to exercise retry and rollback behavior.
create temporary sequence access_collision;
do $test$declare a record;definition text;issued jsonb;before_id uuid;begin
 select * into a from access_fixture where code is not null;
 select pg_get_functiondef('shop_private.appointment_access_random_code()'::regprocedure) into definition;
 perform set_config('access_test.collision_code',shop_private.appointment_access_code(a.code),true);
 execute $stub$create or replace function shop_private.appointment_access_random_code() returns text language plpgsql volatile set search_path='' as $body$begin if nextval('pg_temp.access_collision')=1 then return current_setting('access_test.collision_code');end if;return 'ZZZZZZZZZZZZ';end$body$$stub$;
 issued:=public.appointment_access_issue(a.shop,a.appointment);
 if issued->>'code'<>'ZZZZ-ZZZZ-ZZZZ' or (select last_value from access_collision)<>2 then raise exception 'collision retry failed';end if;
 select id into before_id from public.appointment_access_credentials where appointment_id=a.appointment and revoked_at is null;
 begin perform public.appointment_access_issue(a.shop,a.appointment);raise exception 'collision retry unbounded';exception when object_not_in_prerequisite_state then if sqlerrm<>'APPOINTMENT_ACCESS_UNAVAILABLE' then raise;end if;end;
 if not exists(select from public.appointment_access_credentials where id=before_id and revoked_at is null) then raise exception 'failed collision rotated existing credential';end if;
 execute definition;
 update access_fixture set code=public.appointment_access_issue(a.shop,a.appointment)->>'code' where shop=a.shop;
end$test$;
do $$declare a record;slug text;i integer;begin
 select * into a from access_fixture where code is not null;slug:='public-'||replace(a.shop::text,'-','');
 delete from public.appointment_access_rate_windows;
 for i in 1..10 loop perform public.appointment_access_verify(slug,lpad(i::text,12,'0'),'01000000000');end loop;
 if public.appointment_access_verify(slug,a.code,'01000000000')<>'{"ok":false}' then raise exception 'phone quota bypass';end if;
 if not exists(select from public.appointment_access_rate_windows where attempts=11) then raise exception 'phone quota not counted';end if;
 delete from public.appointment_access_rate_windows;
 for i in 1..100 loop perform public.appointment_access_verify(slug,lpad(i::text,12,'0'),'010'||lpad(i::text,8,'0'));end loop;
 if public.appointment_access_verify(slug,a.code,'01000000000')<>'{"ok":false}' then raise exception 'shop quota bypass';end if;
 if not exists(select from public.appointment_access_rate_windows where attempts=101) then raise exception 'shop quota not counted';end if;
 -- No role gets direct secrets or the future private scope authority.
 if has_table_privilege('authenticated','public.appointment_access_credentials','SELECT') or has_table_privilege('service_role','public.appointment_access_sessions','SELECT') or has_function_privilege('anon','shop_private.appointment_access_scope(text,text)','EXECUTE') then raise exception 'private grant leak';end if;
end$$;
do $$declare a record;v jsonb;actor uuid:=gen_random_uuid();profile uuid;begin
 select * into a from access_fixture where code is not null;
 update public.appointment_access_rate_windows set window_started_at=clock_timestamp()-interval '11 minutes';
 v:=public.appointment_access_verify('public-'||replace(a.shop::text,'-',''),a.code,'01000000000');
 if v->>'ok'<>'true' then raise exception 'quota did not expire';end if;
 perform public.shop_website_profile_unpublish(a.shop);
 if public.appointment_access_session_validate('public-'||replace(a.shop::text,'-',''),v->>'token')<>'{"ok":false}' or public.appointment_access_verify('public-'||replace(a.shop::text,'-',''),a.code,'01000000000')<>'{"ok":false}' then raise exception 'unpublished shop retained customer access';end if;
 perform public.appointment_access_session_revoke('public-'||replace(a.shop::text,'-',''),v->>'token');
 if exists(select from public.appointment_access_sessions where token_hash=shop_private.appointment_access_hash(v->>'token') and revoked_at is null) then raise exception 'unpublished logout did not revoke';end if;
 insert into auth.users(id,email,email_confirmed_at) values(actor,actor::text||'@access-viewer.invalid',now());
 insert into public.profiles(user_id,portal_id,display_name,email_snapshot) select actor,portal_id,'Viewer','viewer@access.invalid' from public.shops where id=a.shop returning id into profile;
 insert into public.shop_memberships(shop_id,profile_id,role) values(a.shop,profile,'employee');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 set local role authenticated;
 begin perform public.appointment_access_issue(a.shop,a.appointment);raise exception 'view-only staff issued';exception when insufficient_privilege then null;end;
 begin perform public.appointment_access_revoke(a.shop,a.appointment);raise exception 'view-only staff revoked';exception when insufficient_privilege then null;end;
 begin perform public.appointment_access_status(a.shop,a.appointment);raise exception 'view-only staff credential state';exception when insufficient_privilege then null;end;
 reset role;
end$$;
