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
grant select on website_catalog_fixture to authenticated;
do $$declare a record; b record;begin
 select * into a from website_catalog_fixture order by actor limit 1;select * into b from website_catalog_fixture where actor<>a.actor limit 1;
 begin insert into public.shop_website_catalog_entries(shop_id,product_id,public_name) values(a.shop,b.product,'Foreign reference');raise exception 'composite tenant foreign key failed';exception when foreign_key_violation then null;end;
end$$;

select set_config('request.jwt.claim.sub',actor::text,true) from website_catalog_fixture order by actor limit 1;
set local role authenticated;
do $$declare f record; other record; entry jsonb; profile jsonb; location uuid; v jsonb;begin
 select * into f from website_catalog_fixture where actor=auth.uid(); select * into other from website_catalog_fixture where actor<>auth.uid();
 perform set_config('catalog_test.shop',f.shop::text,true);perform set_config('catalog_test.product',f.product::text,true);perform set_config('catalog_test.service',f.service::text,true);
 begin perform public.shop_website_catalog(other.shop); raise exception 'foreign admin read'; exception when insufficient_privilege then null;end;
 entry:='{"publicName":"Public product","description":"Public description","image":null,"displayOrder":20,"showPrice":true}';
 begin perform public.shop_website_catalog_save(f.shop,'product',other.product,entry); raise exception 'foreign product accepted'; exception when insufficient_privilege then null;end;
 begin perform public.shop_website_catalog_publish(f.shop,'service',other.service,true); raise exception 'foreign service accepted'; exception when insufficient_privilege then null;end;
 begin perform public.shop_website_catalog_save(f.shop,'product',f.service,entry); raise exception 'wrong kind accepted'; exception when insufficient_privilege then null;end;
 if public.shop_website_catalog(f.shop)->'catalog' <> '{"integration":"ready","publishedItemCount":0}' then raise exception 'internal items became public';end if;
 perform public.shop_website_address_save(f.shop,'catalog-fixture');
 reset role;select id into location from public.shop_locations where shop_id=f.shop and is_default;set local role authenticated;
 profile:=jsonb_build_object('publicName','Public shop','description','Public shop description','phone','+201000000002','email','','whatsapp','','openingHours','09:00–17:00','seoTitle','','seoDescription','','locations',jsonb_build_array(jsonb_build_object('id',location,'visible',true,'publicName','Public location','address','Public street')));
 perform public.shop_website_profile_save(f.shop,profile);
 perform public.shop_website_logo_replace(f.shop,'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGMU07RmYGBgYmBgYGBgAAAFvQB+2cWeHgAAAABJRU5ErkJggg==');
 begin perform public.shop_website_profile_publish(f.shop,true); raise exception 'zero item profile published'; exception when invalid_parameter_value then null;end;
 perform public.shop_website_catalog_save(f.shop,'product',f.product,entry);
 perform public.shop_website_catalog_save(f.shop,'service',f.service,entry||'{"publicName":"Public service","showPrice":false,"displayOrder":10}');
 if public.shop_website_catalog(f.shop)->'catalog'->>'publishedItemCount'<>'0' then raise exception 'saving config published';end if;
 begin perform public.shop_website_catalog_save(f.shop,'product',f.product,entry||'{"published":true}'); raise exception 'implicit publication accepted'; exception when invalid_parameter_value then null;end;
 begin perform public.shop_website_catalog_save(f.shop,'product',f.product,entry||'{"image":"data:image/svg+xml;base64,PHN2Zy8+"}'); raise exception 'SVG image accepted'; exception when invalid_parameter_value then null;end;
 perform public.shop_website_catalog_publish(f.shop,'service',f.service,true);
 if public.shop_website_profile(f.shop)->'missing'<>'[]' then raise exception 'service only readiness';end if;
 perform public.shop_website_profile_publish(f.shop,true);
 v:=public.shop_website_public_catalog('catalog-fixture');
 if v->>'total'<>'1' or v->'items'->0->>'kind'<>'service' or v->'items'->0 ? 'price' or v->'items'->0 ? 'currency' or v->'items'->0->>'priceMode'<>'contact' then raise exception 'service hidden price payload leak %',v;end if;
 perform public.shop_website_catalog_publish(f.shop,'service',f.service,false);
 if public.shop_website_public_catalog('catalog-fixture') is not null then raise exception 'last unpublish cached public catalog';end if;
 perform public.shop_website_catalog_publish(f.shop,'product',f.product,true);
 v:=public.shop_website_public_catalog('catalog-fixture');
 if v->>'total'<>'1' or v->'items'->0->>'kind'<>'product' or (v->'items'->0->>'price')::numeric<>12.50 then raise exception 'product only projection %',v;end if;
 perform public.shop_website_catalog_publish(f.shop,'service',f.service,true);
 v:=public.shop_website_public_catalog('catalog-fixture');
 if v->>'total'<>'2' or v->'items'->0->>'name'<>'Public service' or v->'items'->1->>'name'<>'Public product' then raise exception 'mixed order incorrect';end if;
 if v::text ~ 'SECRET|PRIVATE|999.88' then raise exception 'private catalog payload leak';end if;
 perform public.shop_website_catalog_save(f.shop,'product',f.product,entry||'{"showPrice":false}');
 v:=public.shop_website_public_catalog('catalog-fixture');
 if exists(select from jsonb_array_elements(v->'items') i where i ? 'price' or i ? 'currency') then raise exception 'hidden price stayed cached after edit';end if;
 perform public.shop_website_catalog_save(f.shop,'product',f.product,entry);
 v:=public.shop_website_public_catalog('catalog-fixture');
 if exists(select from jsonb_array_elements(v->'items') item cross join lateral jsonb_object_keys(item) key where key not in ('publicId','kind','name','description','image','displayOrder','priceMode','price','currency')) then raise exception 'public key allowlist breached';end if;
 if v::text like '%'||f.product::text||'%' or v::text like '%'||f.service::text||'%' or v::text like '%'||f.shop::text||'%' then raise exception 'internal IDs leaked';end if;
 perform public.shop_website_catalog_publish(f.shop,'product',f.product,false);
 reset role;
 if not(select is_active from public.products where id=f.product) or not(select is_active from public.services where id=f.service) then raise exception 'publication changed operational state';end if;
 update public.products set is_active=false where id=f.product; update public.services set is_active=false where id=f.service;
 set local role authenticated;
 if public.shop_website_public_catalog('catalog-fixture') is not null or public.shop_website_profile(f.shop)->'catalog'->>'publishedItemCount'<>'0' then raise exception 'inactive catalog cached';end if;
 begin perform public.shop_website_catalog_publish(f.shop,'product',f.product,true); raise exception 'inactive publish accepted'; exception when invalid_parameter_value then null;end;
 reset role;update public.products set is_active=true where id=f.product;update public.services set is_active=true where id=f.service;set local role authenticated;
 v:=public.shop_website_public_catalog('catalog-fixture');
 if v->>'total'<>'1' or v->'items'->0->>'kind'<>'service' then raise exception 'archive restore lost independent publication state';end if;
 reset role;update public.services set is_active=false where id=f.service;set local role authenticated;
 perform public.shop_website_catalog_publish(f.shop,'service',f.service,false);
 reset role;update public.services set is_active=true where id=f.service;set local role authenticated;
 if public.shop_website_public_catalog('catalog-fixture') is not null then raise exception 'unpublish while inactive resurrected after restore';end if;
 perform public.shop_website_catalog_publish(f.shop,'product',f.product,true);
 perform public.shop_website_catalog_publish(f.shop,'service',f.service,true);
 set local role anon;
 v:=public.shop_website_public_catalog('catalog-fixture');
 if v->>'total'<>'2' or exists(select from jsonb_array_elements(v->'items') i where i->>'priceMode'='contact' and (i ? 'price' or i ? 'currency')) then raise exception 'anonymous public payload failed';end if;
 set local role authenticated;
 perform public.shop_website_profile_unpublish(f.shop);
 if public.shop_website_public_catalog('catalog-fixture') is not null or public.shop_website_host_resolve('catalog-fixture') is not null then raise exception 'site unpublish leaked catalog';end if;
 perform public.shop_website_catalog_save(f.shop,'product',f.product,entry||'{"description":"Edited while site hidden"}');
 if public.shop_website_public_catalog('catalog-fixture') is not null or public.shop_website_profile(f.shop)->>'state'<>'draft' then raise exception 'catalog save republished site';end if;
end$$;
reset role;
-- Real paging plus immediate visibility after a mutation; all synthetic.
do $$declare a uuid:=current_setting('catalog_test.shop')::uuid; profile uuid; p uuid; first_product uuid; i integer; v1 jsonb; v2 jsonb;begin
 select profile_id into profile from public.shop_memberships where shop_id=a and role='owner';
 for i in 1..21 loop
  insert into public.products(shop_id,name,sale_price,created_by_profile_id) values(a,'Paging item '||i,1,profile) returning id into p;
  if i=1 then first_product:=p;end if;
  set local role authenticated;
  perform public.shop_website_catalog_save(a,'product',p,jsonb_build_object('publicName','Paging public '||i,'description','','image',null,'displayOrder',100+i,'showPrice',false));
  perform public.shop_website_catalog_publish(a,'product',p,true);
  reset role;
 end loop;
 set local role authenticated;
 perform public.shop_website_profile_publish(a,true);
 v1:=public.shop_website_public_catalog('catalog-fixture',1);v2:=public.shop_website_public_catalog('catalog-fixture',2);
 if v1->>'total'<>'23' or jsonb_array_length(v1->'items')<>20 or jsonb_array_length(v2->'items')<>3 then raise exception 'public pagination failed';end if;
 if exists(select from jsonb_array_elements(v1->'items') x join jsonb_array_elements(v2->'items') y on x->>'publicId'=y->>'publicId') then raise exception 'duplicate public page entries';end if;
 perform public.shop_website_catalog_publish(a,'product',first_product,false);
 if public.shop_website_public_catalog('catalog-fixture',2)->>'total'<>'22' or jsonb_array_length(public.shop_website_public_catalog('catalog-fixture',2)->'items')<>2 then raise exception 'public page stayed stale';end if;
 begin perform public.shop_website_public_catalog('catalog-fixture',0);raise exception 'invalid page accepted';exception when invalid_parameter_value then null;end;
 perform public.shop_website_profile_unpublish(a);
 reset role;
end$$;
do $$declare a uuid:=current_setting('catalog_test.shop')::uuid; actor uuid:=gen_random_uuid(); profile uuid; member uuid;begin
 perform set_config('catalog_test.owner',current_setting('request.jwt.claim.sub'),true);
 insert into auth.users(id,email,email_confirmed_at) values(actor,actor::text||'@catalog-manager.invalid',now());
 insert into public.profiles(user_id,portal_id,display_name,email_snapshot) select actor,portal_id,'Manager','manager@catalog.invalid' from public.shops where id=a returning id into profile;
 insert into public.shop_memberships(shop_id,profile_id,role) values(a,profile,'employee') returning id into member;
 insert into public.membership_roles(membership_id,role_id) select member,id from public.roles where shop_id=a and key='manager';
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if not shop_private.has_permission(a,'settings.manage') then raise exception 'manager fixture lacks settings permission';end if;
 set local role authenticated;
 begin perform public.shop_website_catalog(a); raise exception 'manager read owner catalog'; exception when insufficient_privilege then null;end;
 begin perform public.shop_website_catalog_publish(a,'product',current_setting('catalog_test.product')::uuid,true); raise exception 'manager published catalog'; exception when insufficient_privilege then null;end;
 begin perform public.shop_website_catalog_save(a,'product',current_setting('catalog_test.product')::uuid,'{}'); raise exception 'manager edited public catalog'; exception when insufficient_privilege then null;end;
 reset role;
 perform set_config('request.jwt.claim.sub',current_setting('catalog_test.owner'),true);
end$$;
set local role anon;
do $$begin if public.shop_website_public_catalog('catalog-fixture') is not null then raise exception 'anonymous unpublished site leaked';end if;end$$;
reset role;
do $$begin
 if has_table_privilege('anon','public.shop_website_catalog_entries','SELECT') or has_table_privilege('authenticated','public.shop_website_catalog_entries','UPDATE') or has_function_privilege('anon','public.shop_website_catalog(uuid,text,integer)','EXECUTE') or has_function_privilege('authenticated','shop_private.website_catalog_items(uuid,integer)','EXECUTE') then raise exception 'catalog grant leak';end if;
 if (select count(*) from public.shop_website_catalog_events where shop_id=current_setting('catalog_test.shop')::uuid)<10 then raise exception 'catalog audit missing';end if;
end$$;
