create temporary table tax_fixture as select gen_random_uuid() owner,gen_random_uuid() outsider;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@tax.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from(select owner id from tax_fixture union all select outsider from tax_fixture)u;
grant select on tax_fixture to authenticated;
select set_config('request.jwt.claim.sub',owner::text,true),set_config('request.jwt.claim.role','authenticated',true) from tax_fixture;
set local role authenticated;
do $$
declare shop uuid; location uuid; customer uuid; product uuid; member uuid; sale uuid; line uuid; policy jsonb;
 version uuid; snap jsonb; commission jsonb; amount numeric; receipt uuid; original jsonb;
begin
 shop:=public.create_owner_shop('Tax fixture','pro','mixed'::public.business_mode);
 select id into location from public.shop_locations where shop_id=shop and is_default;
 select id into member from public.shop_memberships where shop_id=shop and role='owner';
 customer:=public.save_customer(shop,null,'Tax customer',null,null,null,null);
 product:=public.save_product(shop,null,'Tax product',null,null,114);
 perform public.save_business_currency(shop,'USD');
 perform public.adjust_stock(gen_random_uuid(),shop,product,20,1,'Tax fixture opening');
 -- Non-EGP sales continue to work, with no ETA restriction in calculation.

 policy:='{"enabled":true,"default":{"treatment":"vat","rate":14,"priceMode":"inclusive","subtype":"V009"},"items":[]}';
 version:=public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp()-interval '1 minute',policy,'Initial tax policy');
 perform public.save_commission_policy(gen_random_uuid(),shop,jsonb_build_object('enabled',true,'currency','USD','service',null,'product',jsonb_build_object('type','percentage','rate',10),'employees',jsonb_build_array(jsonb_build_object('membershipId',member,'enabled',true))),'Commission tax basis fixture');
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,customer,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',1)));
 select id into line from public.invoice_items where invoice_id=sale;
 perform public.assign_sale_commission(shop,line,member,null);
 perform public.issue_sale(gen_random_uuid(),shop,sale);
 snap:=public.get_sale_tax_snapshot(shop,sale); original:=snap;
 if snap->>'currency'<>'USD' or (snap->>'net')::numeric<>100 or (snap->>'tax')::numeric<>14 then raise exception 'Tax snapshot failed %',snap; end if;
 commission:=public.commission_history(shop,sale)->'lines'->0;
 if (commission->>'netLineAmount')::numeric<>100 or (commission->>'estimate')::numeric<>10 then raise exception 'Taxed commission %',commission; end if;
 perform public.record_customer_receipt(gen_random_uuid(),shop,customer,114,now(),'cash',null,null,jsonb_build_array(jsonb_build_object('invoice_id',sale,'amount',114)));
 if public.get_location_sale_receipt(shop,location,sale)->'tax'<>snap then raise exception 'Receipt tax not frozen'; end if;
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp(),jsonb_set(policy,'{default,rate}','20'),'Changed rate');
 if public.get_sale_tax_snapshot(shop,sale)<>original then raise exception 'Tax history repriced'; end if;
 perform set_config('tax_test.shop',shop::text,true); perform set_config('tax_test.sale',sale::text,true);
 -- Customerless exclusive checkout must collect the taxed total.
 policy:=jsonb_set(jsonb_set(policy,'{default,priceMode}','"exclusive"'),'{default,rate}','14');
 perform public.save_tax_policy(gen_random_uuid(),shop,statement_timestamp(),policy,'Exclusive checkout');
 sale:=public.save_sale_draft(gen_random_uuid(),shop,null,null,null,jsonb_build_array(jsonb_build_object('item_type','product','source_id',product,'quantity',1)));
 perform public.checkout_customerless_sale(gen_random_uuid(),shop,sale,129.96,now(),'cash',null);
 select total_amount into amount from public.invoices where id=sale;
 if amount<>129.96 then raise exception 'Customerless total wrong %',amount; end if;
end; $$;
reset role;
do $$ begin
 if has_table_privilege('authenticated','public.sale_tax_snapshots','INSERT') or has_table_privilege('authenticated','public.tax_policy_versions','INSERT') then raise exception 'Direct tax writes granted'; end if;
 begin update public.sale_tax_snapshots set snapshot='{}' where invoice_id=current_setting('tax_test.sale')::uuid; raise exception 'Tax mutable'; exception when object_not_in_prerequisite_state then null; end;
 begin delete from public.tax_policy_versions where shop_id=current_setting('tax_test.shop')::uuid; raise exception 'Policy mutable'; exception when object_not_in_prerequisite_state then null; end;
end; $$;
select set_config('request.jwt.claim.sub',outsider::text,true) from tax_fixture;
set local role authenticated;
do $$ begin
 begin perform public.tax_settings(current_setting('tax_test.shop')::uuid); raise exception 'Outsider settings read'; exception when insufficient_privilege then null; end;
 begin perform public.get_sale_tax_snapshot(current_setting('tax_test.shop')::uuid,current_setting('tax_test.sale')::uuid); raise exception 'Outsider tax read'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
