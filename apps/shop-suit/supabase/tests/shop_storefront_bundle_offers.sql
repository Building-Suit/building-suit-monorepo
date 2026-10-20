-- Disposable transaction only; execute after all Shop migrations. No hosted fixtures.
create temporary table storefront_offer_fixture(owner_id uuid);
insert into storefront_offer_fixture values(gen_random_uuid());
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id,'bundle-'||owner_id||'@fixture.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from storefront_offer_fixture;
select set_config('request.jwt.claim.sub',owner_id::text,true),set_config('request.jwt.claim.role','authenticated',true) from storefront_offer_fixture;
set local role authenticated;
do $$ declare shop uuid; location uuid; staff uuid; product uuid; service uuid; offer uuid; customer uuid; invoice uuid;
 recipe jsonb; cart jsonb; quote jsonb; receipt jsonb; save_request uuid:=gen_random_uuid(); checkout_request uuid:=gen_random_uuid();issue_request uuid:=gen_random_uuid();payment_request uuid:=gen_random_uuid();paid_at timestamptz:=clock_timestamp();input jsonb;
begin
 shop:=public.create_owner_shop('Bundle fixture','mixed'::public.business_mode);
 select id into location from public.shop_locations where shop_id=shop and is_default;
 select id into staff from public.shop_memberships where shop_id=shop and role='owner';
 product:=public.save_product(shop,null,'Bundle product','BUNDLE-P',null,20);
 service:=public.save_service(shop,null,'Bundle service',null,30,'amount',0);
 customer:=public.save_customer(shop,null,'Bundle customer','01000000000',null,null,null);
 perform public.adjust_stock(gen_random_uuid(),shop,product,20,10,'Bundle fixture opening');
 recipe:=jsonb_build_array(jsonb_build_object('kind','product','sourceId',product,'quantity',2),jsonb_build_object('kind','service','sourceId',service,'quantity',1));
 input:=jsonb_build_object('name','Original bundle','description','','price',50,'priority',0,'active',true,'websiteVisible',false,'startsAt',null,'endsAt',null,'lines',recipe);
 offer:=public.shop_offer_save(shop,null,0,input);
 cart:=jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',5),jsonb_build_object('item_type','service','source_id',service,'quantity',2));
 quote:=public.quote_pos_sale(shop,location,cart);
 if (quote->>'discount')::numeric<>40 or (quote->>'total')::numeric<>120 or (quote->'offers'->0->>'quantity')::numeric<>2 then raise exception 'Repeated bundle matching or remainder price changed';end if;
 if (public.quote_pos_sale(shop,location,jsonb_build_array(cart->0))->>'discount')::numeric<>0 then raise exception 'Incomplete bundle discounted';end if;
 invoice:=public.save_pos_sale_draft(save_request,shop,location,null,staff,null,customer,null,cart);
 perform public.checkout_pos_sale(checkout_request,issue_request,payment_request,null,shop,location,invoice,120,paid_at,'cash',null);
 receipt:=public.get_location_sale_receipt(shop,location,invoice);
 if receipt->'offers'->0->>'name'<>'Original bundle' or (receipt->>'total')::numeric<>120 then raise exception 'Receipt lost bundle snapshot';end if;
 perform public.shop_offer_save(shop,offer,1,input||'{"name":"Changed bundle","price":55}'::jsonb);
 if public.get_location_sale_receipt(shop,location,invoice)->'offers'->0->>'name'<>'Original bundle' then raise exception 'Offer editing rewrote old receipt';end if;
 if public.save_pos_sale_draft(save_request,shop,location,null,staff,null,customer,null,cart)<>invoice then raise exception 'Retry duplicated draft';end if;
 if public.checkout_pos_sale(checkout_request,issue_request,payment_request,null,shop,location,invoice,120,paid_at,'cash',null)<>invoice then raise exception 'Retry duplicated checkout';end if;
 begin perform public.shop_offer_save(shop,offer,1,input);raise exception 'Stale revision accepted';exception when serialization_failure then null;end;
end $$;
reset role;
-- New storage and helpers are inaccessible outside their authorized RPCs.
do $$ begin
 if has_table_privilege('anon','public.shop_storefront_layouts','SELECT') or has_table_privilege('authenticated','public.shop_catalog_offers','UPDATE')
 or has_function_privilege('anon','public.shop_storefront_builder(uuid)','EXECUTE')
 or has_function_privilege('authenticated','shop_private.match_catalog_offers(uuid,jsonb,uuid[])','EXECUTE') then raise exception 'Storefront privilege boundary leaked';end if;
end $$;
