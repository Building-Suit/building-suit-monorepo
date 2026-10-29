-- Independent Oct29 audit overlay, not published application/migration source.
-- The maintained harness supplies BEGIN/ROLLBACK and a uniquely owned database.
-- Existing public plan terms remain unchanged. Privileged synthetic setup only
-- selects those existing terms and seeds ordinary catalog records; boundary
-- writes and all measured reads use the authenticated public commands.
create temporary table capacity_fixture as
select gen_random_uuid() actor, variant, slug, cap, null::uuid shop, null::uuid profile
from (values ('solo_1','solo',250),('standard','team',500),
  ('multi_2','multi',1000),('multi_3','multi',2000)) v(variant,slug,cap);
grant select,update on capacity_fixture to authenticated;
create temporary table capacity_metrics(stage text,cap integer,mean_ms numeric,items integer);
grant insert,select on capacity_metrics to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select actor,actor::text||'@capacity-audit.invalid','x','authenticated','authenticated',
 now(),'{}','{}',now(),now() from capacity_fixture;
select set_config('request.jwt.claim.role','authenticated',true);
-- Initial fixture tenants select the real offered term at INSERT time.
-- Never rewrite an existing subscription or set an approval bypass flag.
do $$declare f record; offered record; portal uuid; fixture_profile uuid; fixture_shop uuid;begin
 select id into strict portal from public.portals where key='shop-crm';
 for f in select * from capacity_fixture order by cap loop
  select * into strict offered from public.shop_public_plan_catalog()
   where plan_variant=f.variant and billing_interval='monthly';
  if (offered.resource_limits->>'active_products')::integer is distinct from f.cap then
   raise exception 'Approved product cap differs for %',f.variant;
  end if;
  insert into public.profiles(user_id,portal_id,display_name,email_snapshot)
   values(f.actor,portal,'Capacity fixture owner',f.actor::text||'@capacity-audit.invalid') returning id into fixture_profile;
  insert into public.subscriptions(profile_id,plan_id,catalog_terms_id,status,trial_start_at,trial_end_at)
   values(fixture_profile,offered.id,offered.catalog_terms_id,'trialing',now(),now()+interval '7 days');
  insert into public.shops(portal_id,name,business_mode)
   values(portal,'Disposable capacity '||f.variant,'product') returning id into fixture_shop;
  insert into public.shop_memberships(shop_id,profile_id,role) values(fixture_shop,fixture_profile,'owner');
  if not exists(select 1 from public.shop_locations where shop_id=fixture_shop and is_default and status='active') then
   raise exception 'Default fixture location was not created';end if;
  update capacity_fixture set shop=fixture_shop,profile=fixture_profile where actor=f.actor;
  insert into public.products(shop_id,name,sku,sale_price,created_by_profile_id)
   select fixture_shop,'Capacity item '||lpad(n::text,5,'0'),'CAP-'||lpad(n::text,5,'0'),35,fixture_profile
   from generate_series(1,f.cap-1)n;
 end loop;
end;$$;
set local role authenticated;
do $$declare f record; p uuid; r jsonb;begin
 for f in select * from capacity_fixture order by cap loop
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  p:=public.save_product(f.shop,null,'Boundary product','BOUNDARY',null,35);
  r:=public.list_products(f.shop,null,null,1,100);
  if (r->>'total')::integer is distinct from f.cap or jsonb_array_length(r->'items')<>100 then
   raise exception 'Public directory cap/bounds differ for %: %',f.variant,r;
  end if;
  begin
   perform public.save_product(f.shop,null,'Rejected overflow','OVERFLOW',null,35);
   raise exception 'Product cap not enforced for %',f.variant;
  exception when check_violation then
   if sqlerrm<>'PRODUCT_LIMIT_REACHED' and sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_products:%' then raise;end if;
  end;
  r:=public.list_products(f.shop,null,null,1,100);
  if (r->>'total')::integer is distinct from f.cap then raise exception 'Rejected product left a partial row';end if;
  perform public.archive_product(f.shop,p);
  perform public.save_product(f.shop,null,'Replacement product','REPLACEMENT',null,35);
  if (public.list_products(f.shop,null,null,1,20)->>'total')::integer is distinct from f.cap then
   raise exception 'Archival did not release exactly one product slot';end if;
  begin
   perform public.list_products(f.shop,null,null,1,101);
   raise exception 'Unbounded directory page accepted';
  exception when invalid_parameter_value then
   if sqlerrm<>'INVALID_PRODUCT_QUERY' then raise;end if;
  end;
  insert into capacity_metrics values('approved-cap-boundary',f.cap,null,f.cap);
 end loop;
end;$$;
reset role;
-- 10,000 retained records in the largest approved public plan:2,000 active,
-- 8,000 archived. This does not claim entitlement to10,000 active products.
do $$declare f record;begin
 select * into strict f from capacity_fixture where cap=2000;
 perform set_config('request.jwt.claim.sub',f.actor::text,true);
 insert into public.products(shop_id,name,sku,sale_price,is_active,created_by_profile_id)
  select f.shop,'Archived capacity '||n,'ARCHIVED-'||n,35,false,f.profile
  from generate_series(1,10000-(select count(*)::integer from public.products where shop_id=f.shop))n;
 insert into public.product_technical_profiles(product_id,shop_id,revision,search_text)
  select id,f.shop,1,'capacitytag' from public.products where shop_id=f.shop and is_active;
 if (select count(*) from public.products where shop_id=f.shop)<>10000 then raise exception 'Capacity seed is not10000 retained records';end if;
end;$$;
analyze public.products;
analyze public.product_technical_profiles;
set local role authenticated;
do $$declare f record; r jsonb; started timestamptz; search_term text; page_no integer;begin
 select * into strict f from capacity_fixture where cap=2000;
 perform set_config('request.jwt.claim.sub',f.actor::text,true);
 foreach page_no in array array[1,100,101] loop
  r:=public.list_products(f.shop,null,null,page_no,20);
  if (r->>'total')::integer is distinct from 2000
   or jsonb_array_length(r->'items') is distinct from (case when page_no=101 then 0 else 20 end) then
   raise exception 'Retained catalog pagination differs at page %',page_no;
  end if;
 end loop;
 foreach search_term in array array[null::text,'CAP-01999','capacitytag'] loop
  started:=clock_timestamp();
  for attempt in 1..10 loop r:=public.list_products(f.shop,search_term,null,1,20);end loop;
  if jsonb_array_length(r->'items') is distinct from (case when search_term='CAP-01999' then 1 else 20 end)
   or (r->>'total')::integer is distinct from
   (case when search_term='CAP-01999' then 1 else 2000 end) then raise exception 'Capacity search total/bound incorrect';end if;
  insert into capacity_metrics values('list_products:'||coalesce(search_term,'unfiltered'),2000,
   extract(epoch from clock_timestamp()-started)*1000/10,jsonb_array_length(r->'items'));
 end loop;
 -- A separate actor cannot read the large tenant's catalog.
 perform set_config('request.jwt.claim.sub',(select actor::text from capacity_fixture where cap=250),true);
 begin perform public.list_products(f.shop,null,null,1,20);raise exception 'Capacity tenant isolation failed';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;
select jsonb_agg(to_jsonb(m) order by cap,stage) from capacity_metrics m;
set constraints all immediate;
