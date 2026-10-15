-- Synthetic fixtures only. Caller wraps the entire suite in BEGIN/ROLLBACK.
create temporary table public_profile_fixture(actor uuid,shop uuid);
insert into public_profile_fixture values(gen_random_uuid(),null),(gen_random_uuid(),null);
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select actor,actor::text||'@public-profile.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from public_profile_fixture;
do $$declare f record; begin
 for f in select actor from public_profile_fixture loop
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  update public_profile_fixture set shop=public.create_owner_shop('PRIVATE SHOP','mixed','PRIVATE LOCATION','MAIN','PRIVATE ADDRESS','+201000000001') where actor=f.actor;
 end loop;
end$$;
grant select on public_profile_fixture to authenticated;
select set_config('request.jwt.claim.sub',actor::text,true) from public_profile_fixture order by actor limit 1;
set local role authenticated;
do $$declare a uuid; b uuid; v jsonb; d jsonb; loc uuid; foreign_loc uuid; begin
 select shop into a from public_profile_fixture where actor=auth.uid();
 select shop into b from public_profile_fixture where actor<>auth.uid();
 begin perform public.shop_website_profile(b); raise exception 'cross tenant read'; exception when insufficient_privilege then null; end;
 begin perform public.shop_website_logo_replace(b,null); raise exception 'cross tenant logo mutation'; exception when insufficient_privilege then null; end;
 begin perform public.shop_website_profile_unpublish(b); raise exception 'cross tenant unpublish'; exception when insufficient_privilege then null; end;
 perform public.shop_website_address_save(a,'profile-fixture');
 v:=public.shop_website_profile(a);
 if v->'draft'<>'{}' or v->>'logoDataUrl' is not null or v->>'ownerOptedIn'<>'false' then raise exception 'public defaults copied private data'; end if;
 if v->'catalog'<>'{"integration":"pending","publishedItemCount":0}' then raise exception 'catalog boundary violated'; end if;
 d:='{"publicName":"Public shop","description":"Public description","phone":"","whatsapp":"","email":"","openingHours":"Sun–Thu 09:00–17:00","seoTitle":"Public search title","seoDescription":"Public search description","locations":[]}';
 v:=public.shop_website_profile_save(a,d);
 if not(v->'missing' @> '["logo","contact","location","publishedItem"]') then raise exception 'readiness missing checks'; end if;
 begin perform public.shop_website_profile_publish(a,false); raise exception 'implicit opt in'; exception when insufficient_privilege then null; end;
 begin perform public.shop_website_profile_publish(a,true); raise exception 'incomplete publication'; exception when invalid_parameter_value then null; end;
 begin perform public.shop_website_logo_replace(a,'data:image/svg+xml;base64,PHN2Zy8+'); raise exception 'SVG accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.shop_website_logo_replace(a,'data:image/png;base64,PHN2ZyBvbmxvYWQ9IngiLz4='); raise exception 'false mime accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.shop_website_logo_replace(a,'data:image/png;base64,'||repeat('A',175000)); raise exception 'oversize accepted'; exception when invalid_parameter_value then null; end;
 perform public.shop_website_logo_replace(a,'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGMU07RmYGBgYmBgYGBgAAAFvQB+2cWeHgAAAABJRU5ErkJggg==');
 perform public.shop_website_logo_replace(a,'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCDAFACf//Z');
 perform public.shop_website_logo_replace(a,'data:image/webp;base64,UklGRhICAABXRUJQVlA4WAoAAAAgAAAAAQAAAQAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZWUDggJAAAAHABAJ0BKgIAAgABQCYljAJ0AUAAAP76eV+RzvSpVdcXNkN4AA==');
 -- Private fields are not read even when selecting an operational location.
 reset role;
 select id into loc from public.shop_locations where shop_id=a and is_default;
 select id into foreign_loc from public.shop_locations where shop_id=b and is_default;
 set local role authenticated;
 d:=d||jsonb_build_object('phone','+201000000002','locations',jsonb_build_array(jsonb_build_object('id',loc,'visible',false,'publicName','Public branch','address','Public street')));
 v:=public.shop_website_profile_save(a,d);
 if not(v->'missing' @> '["location"]') then raise exception 'hidden location counted'; end if;
 d:=jsonb_set(d,'{locations,0,visible}','true');
 v:=public.shop_website_profile_save(a,d);
 if v->'missing'<>'["publishedItem"]' then raise exception 'unexpected readiness %',v->'missing'; end if;
 begin perform public.shop_website_profile_publish(a,true); raise exception 'zero catalog published'; exception when invalid_parameter_value then null; end;
 begin perform public.shop_website_profile_save(a,jsonb_set(d,'{locations,0,id}',to_jsonb(foreign_loc::text))); raise exception 'foreign location accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.shop_website_profile_save(a,jsonb_set(d,'{phone}','"javascript:alert(1)"')); raise exception 'unsafe contact accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.shop_website_profile_save(a,d||'{"publishedItemCount":1}'); raise exception 'browser catalog accepted'; exception when invalid_parameter_value then null; end;
 perform set_config('profile_test.shop',a::text,true);
end$$;
reset role;
-- A future CATALOG implementation is simulated only inside this rolled-back
-- transaction to exercise snapshot/unpublish behavior, never shipped as readiness.
create or replace function shop_private.website_catalog_readiness(p_shop_id uuid)
returns jsonb language sql stable set search_path='' as $$ select '{"integration":"ready","publishedItemCount":1}'::jsonb; $$;
do $$declare a uuid:=current_setting('profile_test.shop')::uuid; actor uuid:=gen_random_uuid(); profile uuid; member uuid; begin
 perform set_config('profile_test.owner',current_setting('request.jwt.claim.sub'),true);
 insert into auth.users(id,email,email_confirmed_at) values(actor,actor::text||'@profile-manager.invalid',now());
 insert into public.profiles(user_id,portal_id,display_name,email_snapshot) select actor,portal_id,'Manager','manager@profile.invalid' from public.shops where id=a returning id into profile;
 insert into public.shop_memberships(shop_id,profile_id,role) values(a,profile,'employee') returning id into member;
 insert into public.membership_roles(membership_id,role_id) select member,id from public.roles where shop_id=a and key='manager';
 perform set_config('request.jwt.claim.sub',actor::text,true);
 set local role authenticated;
 perform public.shop_website_profile_save(a,public.shop_website_profile(a)->'draft');
 begin perform public.shop_website_profile_publish(a,true); raise exception 'non-owner published'; exception when insufficient_privilege then null; end;
 reset role;
 delete from public.membership_roles where membership_id=member;
 set local role authenticated;
 begin perform public.shop_website_profile(a); raise exception 'ordinary employee read accepted'; exception when insufficient_privilege then null; end;
 begin perform public.shop_website_profile_save(a,'{}'); raise exception 'ordinary employee write accepted'; exception when insufficient_privilege then null; end;
 reset role;
 perform set_config('request.jwt.claim.sub',current_setting('profile_test.owner'),true);
end$$;
set local role authenticated;
select public.shop_website_profile_publish(current_setting('profile_test.shop')::uuid,true);
select public.shop_website_address_save(current_setting('profile_test.shop')::uuid,'profile-fixture-new');
reset role;
set local role anon;
do $$declare p jsonb; begin
 begin perform public.shop_website_profile(current_setting('profile_test.shop')::uuid); raise exception 'anonymous private read'; exception when insufficient_privilege then null; end;
 p:=public.shop_website_public_profile('profile-fixture');
 if p->>'canonicalSlug'<>'profile-fixture-new' or p->>'publicName'<>'Public shop' or p->'locations'<>'[{"publicName":"Public branch","address":"Public street"}]' then raise exception 'published projection incorrect %',p; end if;
 if p::text like '%PRIVATE%' or p::text like '%shop_id%' then raise exception 'private data published'; end if;
end$$;
reset role;
set local role authenticated;
do $$declare a uuid:=current_setting('profile_test.shop')::uuid; d jsonb; begin
 d:=public.shop_website_profile(a)->'draft';
 perform public.shop_website_profile_save(a,d||'{"publicName":"Edited draft"}');
 perform public.shop_website_logo_replace(a,null);
 if public.shop_website_public_profile('profile-fixture')->>'publicName'<>'Public shop' then raise exception 'draft edit changed publication'; end if;
 perform public.shop_website_profile_unpublish(a);
 if public.shop_website_public_profile('profile-fixture') is not null or public.shop_website_public_profile('profile-fixture-new') is not null or public.shop_website_host_resolve('profile-fixture') is not null then raise exception 'unpublish failed'; end if;
 if public.shop_website_profile(a)->'draft'->>'publicName'<>'Edited draft' then raise exception 'unpublish lost configuration'; end if;
end$$;
reset role;
-- Suspended/archived operational records cannot surface through a public snapshot.
set local role authenticated;
select public.shop_website_logo_replace(current_setting('profile_test.shop')::uuid,'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGMU07RmYGBgYmBgYGBgAAAFvQB+2cWeHgAAAABJRU5ErkJggg==');
select public.shop_website_profile_publish(current_setting('profile_test.shop')::uuid,true);
reset role;
update public.shop_locations set status='archived',archived_at=now(),is_default=false where shop_id=current_setting('profile_test.shop')::uuid;
do $$begin if public.shop_website_public_profile('profile-fixture-new') is not null then raise exception 'archived location leaked'; end if;end$$;
update public.shop_locations set status='active',archived_at=null,is_default=true where shop_id=current_setting('profile_test.shop')::uuid;
update public.shops set status='suspended' where id=current_setting('profile_test.shop')::uuid;
do $$begin if public.shop_website_public_profile('profile-fixture-new') is not null then raise exception 'suspended shop leaked'; end if;end$$;
update public.shops set status='active' where id=current_setting('profile_test.shop')::uuid;
set local role authenticated;
select public.shop_website_profile_unpublish(current_setting('profile_test.shop')::uuid);
do $$declare p jsonb:=public.shop_website_profile(current_setting('profile_test.shop')::uuid);begin
 if p->>'logoDataUrl' is null or p->'draft'->>'publicName'<>'Edited draft' then raise exception 'unpublish lost logo or draft'; end if;
end$$;
reset role;
-- Audit and direct-access boundaries.
do $$begin
 if (select count(*) from public.shop_website_profile_events where shop_id=current_setting('profile_test.shop')::uuid)<7 then raise exception 'audit missing'; end if;
 if has_table_privilege('anon','public.shop_website_logos','SELECT') or has_table_privilege('authenticated','public.shop_website_logos','SELECT')
 or has_table_privilege('authenticated','public.shop_website_profiles','UPDATE') or has_table_privilege('authenticated','public.shop_website_profile_events','DELETE')
 or has_function_privilege('authenticated','shop_private.website_catalog_readiness(uuid)','EXECUTE')
 or has_function_privilege('anon','public.shop_website_profile(uuid)','EXECUTE') then raise exception 'grant leak'; end if;
end$$;
