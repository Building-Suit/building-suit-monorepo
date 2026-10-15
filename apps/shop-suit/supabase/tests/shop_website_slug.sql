-- Transaction-scoped synthetic identities. Runs only on the disposable local Shop.
create temporary table website_fixture (actor uuid, shop uuid);
insert into website_fixture values(gen_random_uuid(),null),(gen_random_uuid(),null);
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select actor, actor::text || '@website.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from website_fixture;
do $$declare f record; begin
  for f in select actor from website_fixture loop
    perform set_config('request.jwt.claim.sub',f.actor::text,true);
    update website_fixture set shop = public.create_owner_shop('Website fixture','mixed','Main','MAIN',null,null) where actor = f.actor;
  end loop;
end$$;
grant select on website_fixture to authenticated;

do $$declare s text; begin
  foreach s in array array['ab','ABC','-abc','abc-','a--b','xn--foo','a.b','a_b','متجر','café','abc/def','abc' || chr(10),repeat('a',51),'www','api','admin','auth','shop','shops','support','stg','staging','owner','staff','building-suit'] loop
    if shop_private.valid_website_slug(s) then raise exception 'unsafe slug accepted: %',s; end if;
  end loop;
  if has_table_privilege('anon','public.shop_websites','SELECT') or has_table_privilege('authenticated','public.shop_websites','UPDATE')
    or has_table_privilege('service_role','public.shop_websites','UPDATE')
    or has_table_privilege('authenticated','public.shop_website_slug_claims','INSERT')
    or has_function_privilege('anon','public.shop_website_address_save(uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','shop_private.valid_website_slug(text)','EXECUTE') then raise exception 'grant leak'; end if;
  if exists(select from public.shop_websites where shop_id in (select shop from website_fixture)) then raise exception 'migration must not publish/assign existing shops'; end if;
end$$;
select set_config('request.jwt.claim.sub',actor::text,true) from website_fixture order by actor limit 1;
set local role authenticated;
do $$declare a uuid; b uuid; v jsonb; begin
  select shop into a from website_fixture where actor = auth.uid();
  select shop into b from website_fixture where actor <> auth.uid();
  begin perform public.shop_website_address(b); raise exception 'tenant read leaked'; exception when insufficient_privilege then null; end;
  begin perform public.shop_website_address_save(b,'cross-tenant'); raise exception 'tenant write leaked'; exception when insufficient_privilege then null; end;
  begin perform public.shop_website_address_save(a,'Admin'); raise exception 'invalid accepted'; exception when invalid_parameter_value then null; end;
  v := public.shop_website_address_save(a,'website-first');
  if v->>'state' <> 'draft' then raise exception 'saved address published'; end if;
  perform public.save_shop_profile(a,'Renamed display only');
  if public.shop_website_address(a)->>'slug' <> 'website-first' then raise exception 'display rename changed address'; end if;
  v := public.shop_website_address_save(a,'website-second');
  if v->'aliases' <> '["website-first"]'::jsonb then raise exception 'alias lost'; end if;
  -- Returning to an owned alias is safe and retains the other claim.
  v := public.shop_website_address_save(a,'website-first');
  if v->'aliases' <> '["website-second"]'::jsonb then raise exception 'owned alias reuse failed'; end if;
  if public.shop_website_host_resolve('website-first') is not null or public.shop_website_host_resolve('website-second') is not null then raise exception 'unpublished leaked'; end if;
end$$;
reset role;
select set_config('request.jwt.claim.sub',actor::text,true) from website_fixture where actor::text <> current_setting('request.jwt.claim.sub') limit 1;
set local role authenticated;
do $$declare a uuid; begin
  select shop into a from website_fixture where actor = auth.uid();
  begin perform public.shop_website_address_save(a,'website-second'); raise exception 'alias takeover'; exception when unique_violation then null; end;
  begin perform public.shop_website_address_save(a,'website-first'); raise exception 'canonical takeover'; exception when unique_violation then null; end;
end$$;
reset role;
-- Only the fixture administrator simulates a future reviewed publishing layer.
update public.shop_websites set publication_state = 'published';
set local role anon;
do $$begin
  if public.shop_website_host_resolve('website-second') <> '{"canonicalSlug":"website-first","isAlias":true}'::jsonb then raise exception 'wrong alias target'; end if;
  if public.shop_website_host_resolve('website-first') <> '{"canonicalSlug":"website-first","isAlias":false}'::jsonb then raise exception 'wrong canonical target'; end if;
  if public.shop_website_host_resolve('unknown-shop') is not null then raise exception 'unknown leak'; end if;
end$$;
reset role;
update public.shop_websites set publication_state = 'suspended';
do $$begin if public.shop_website_host_resolve('website-second') is not null then raise exception 'suspended site leak'; end if; end$$;
update public.shop_websites set publication_state = 'published';
update public.shops set status = 'suspended' where id in (select shop_id from public.shop_websites);
do $$begin if public.shop_website_host_resolve('website-first') is not null then raise exception 'suspended shop leak'; end if; end$$;
update public.shops set status = 'archived' where id in (select shop_id from public.shop_websites);
do $$begin
  if public.shop_website_host_resolve('website-second') is not null then raise exception 'archived shop leak'; end if;
  begin update public.shop_website_slug_claims set shop_id = (select shop from website_fixture where shop <> shop_id limit 1); raise exception 'claim reassigned'; exception when object_not_in_prerequisite_state then null; end;
  begin delete from public.shop_website_slug_claims; raise exception 'claim released'; exception when object_not_in_prerequisite_state then null; end;
end$$;
