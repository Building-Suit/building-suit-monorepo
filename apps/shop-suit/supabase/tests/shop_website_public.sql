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
set local role anon;
do $$declare a record; b record; slug text; v jsonb; i int;begin
 select * into a from website_catalog_fixture order by actor limit 1;select * into b from website_catalog_fixture where actor<>a.actor;
 slug:='public-'||replace(a.shop::text,'-','');
 v:=public.shop_website_showcase(slug);
 if v->'profile'->>'canonicalSlug'<>slug or v::text ~ 'PRIVATE|SECRET' then raise exception 'public projection leak';end if;
 if public.shop_website_host_resolve('old-'||slug)->>'canonicalSlug'<>slug or public.shop_website_showcase('old-'||slug)->'profile'->>'canonicalSlug'<>slug then raise exception 'alias canonical contract';end if;
 if public.shop_website_host_resolve(slug) is null then raise exception 'ready host unavailable';end if;
 if public.shop_website_showcase('unknown-shop') is not null then raise exception 'unknown visible';end if;
 begin perform public.shop_website_inquiries(a.shop);raise exception 'anon inbox';exception when insufficient_privilege then null;end;
 begin perform 1 from public.shop_website_inquiries;raise exception 'anon storage';exception when insufficient_privilege then null;end;
 begin perform public.shop_website_inquiry_submit(slug,'Visitor','bad-contact','Message','en','');raise exception 'invalid contact';exception when invalid_parameter_value then null;end;
 begin perform public.shop_website_inquiry_submit(slug,'Visitor','visitor@example.invalid',E'\n\t','en','');raise exception 'blank message';exception when invalid_parameter_value then null;end;
 begin perform public.shop_website_inquiry_submit(slug,repeat('a',121),'visitor@example.invalid','Message','en','');raise exception 'unbounded name';exception when invalid_parameter_value then null;end;
 v:=public.shop_website_inquiry_submit(slug,'','','','en','bot');
 if v<>'{"ok":true}' then raise exception 'honeypot response';end if;
 v:=public.shop_website_inquiry_submit(slug,'Visitor','visitor@example.invalid','<script>private inquiry</script>','en','');
 if v<>'{"ok":true}' then raise exception 'public response leak';end if;
 begin perform public.shop_website_inquiry_submit(slug,'Visitor','VISITOR@example.invalid','Again','en','');raise exception 'duplicate rate';exception when raise_exception then if sqlerrm<>'WEBSITE_INQUIRY_RATE_LIMITED' then raise;end if;end;
 -- Same contact may reach another independently resolved shop.
 perform public.shop_website_inquiry_submit('public-'||replace(b.shop::text,'-',''),'Visitor','visitor@example.invalid','Beta message','ar','');
 for i in 2..40 loop perform public.shop_website_inquiry_submit(slug,'Visitor',i||'@example.invalid','Message','en','');end loop;
 begin perform public.shop_website_inquiry_submit(slug,'Visitor','41@example.invalid','Message','en','');raise exception 'site rate';exception when raise_exception then if sqlerrm<>'WEBSITE_INQUIRY_RATE_LIMITED' then raise;end if;end;
end$$;
reset role;
do $$declare a record;begin
 select * into a from website_catalog_fixture order by actor limit 1;
 if (select count(*) from public.shop_website_inquiries where shop_id=a.shop)<>40 then raise exception 'honeypot stored or quota bypassed';end if;
end$$;
select set_config('request.jwt.claim.sub',actor::text,true) from website_catalog_fixture order by actor limit 1;
set local role authenticated;
do $$declare a record; b record; v jsonb; id uuid;begin
 select * into a from website_catalog_fixture where actor=auth.uid();select * into b from website_catalog_fixture where actor<>auth.uid();
 v:=public.shop_website_inquiries(a.shop);
 if v->>'total'<>'40' or jsonb_array_length(v->'items')<>20 or v::text like '%Beta message%' then raise exception 'inbox pagination/isolation';end if;
 begin perform public.shop_website_inquiries(b.shop);raise exception 'foreign inbox';exception when insufficient_privilege then null;end;
 id:=(v->'items'->0->>'id')::uuid;
 begin perform public.shop_website_inquiry_status(b.shop,id,'read');raise exception 'foreign write';exception when insufficient_privilege then null;end;
 perform public.shop_website_inquiry_status(a.shop,id,'read');
 if public.shop_website_inquiries(a.shop,'read')->>'total'<>'1' then raise exception 'status not saved';end if;
 perform public.shop_website_profile_unpublish(a.shop);
 if public.shop_website_showcase('public-'||replace(a.shop::text,'-','')) is not null or public.shop_website_host_resolve('public-'||replace(a.shop::text,'-','')) is not null then raise exception 'unpublish stale content';end if;
 begin perform public.shop_website_inquiry_submit('public-'||replace(a.shop::text,'-',''),'Visitor','new@example.invalid','Message','en','');raise exception 'unpublished inquiry';exception when no_data_found then null;end;
 if public.shop_website_inquiries(a.shop)->>'total'<>'40' then raise exception 'unpublish lost inbox';end if;
end$$;
reset role;
do $$begin
 if (select count(*) from public.shop_website_inquiry_events where shop_id in(select shop from website_catalog_fixture))<>1 then raise exception 'audit missing';end if;
 if has_table_privilege('anon','public.shop_website_inquiry_events','SELECT') or has_table_privilege('authenticated','public.shop_website_inquiries','SELECT') then raise exception 'private grant leak';end if;
end$$;
-- A settings manager still cannot read the owner's private inbox.
do $$declare f record; actor uuid:=gen_random_uuid(); profile uuid; member uuid; inquiry uuid;begin
 select * into f from website_catalog_fixture order by actor limit 1;
 select id into inquiry from public.shop_website_inquiries where shop_id=f.shop limit 1;
 insert into auth.users(id,email,email_confirmed_at) values(actor,actor::text||'@inquiry-manager.invalid',now());
 insert into public.profiles(user_id,portal_id,display_name,email_snapshot) select actor,portal_id,'Manager','manager@inquiry.invalid' from public.shops where id=f.shop returning id into profile;
 insert into public.shop_memberships(shop_id,profile_id,role) values(f.shop,profile,'employee') returning id into member;
 insert into public.membership_roles(membership_id,role_id) select member,id from public.roles where shop_id=f.shop and key='manager';
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if not shop_private.has_permission(f.shop,'settings.manage') then raise exception 'manager fixture lacks settings permission';end if;
 set local role authenticated;
 begin perform public.shop_website_inquiries(f.shop);raise exception 'manager read owner inbox';exception when insufficient_privilege then null;end;
 begin perform public.shop_website_inquiry_status(f.shop,inquiry,'closed');raise exception 'manager wrote owner inbox';exception when insufficient_privilege then null;end;
 reset role;
end$$;
