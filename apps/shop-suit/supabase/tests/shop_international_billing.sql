-- Synthetic provider receipts in a disposable transaction. No provider calls.
insert into public.plans(portal_id,name,slug,price_amount,currency,billing_interval,trial_days,features,resource_limits,is_active,is_public,is_purchasable,is_coming_soon)
select portal.id,v.name,v.slug,v.amount,'EGP','monthly',7,'{}',v.limits,true,true,true,false
from public.portals portal cross join(values
('Solo','solo',349,'{"active_locations":1,"active_members":1,"active_products":250,"active_services":50,"active_customers":500,"active_suppliers":50}'::jsonb),
('Team','team',699,'{"active_locations":1,"active_members":8,"active_products":500,"active_services":100,"active_customers":2000,"active_suppliers":150}'::jsonb),
('Multi','multi',999,'{"active_locations":2,"active_members":16,"active_products":1000,"active_services":200,"active_customers":5000,"active_suppliers":300}'::jsonb)) v(name,slug,amount,limits)
where portal.key='shop-crm' on conflict(portal_id,slug) do nothing;
select shop_private.reconcile_plan_catalog();
-- The minimal provider seed creates families after historical catalog migrations.
-- Complete the already-approved EGP matrix as fixture data, then derive USD terms.
with offers(slug,variant,cadence,amount,members,locations) as(values
('solo','solo_1','monthly',349::numeric,1,1),('solo','solo_1','annual',2847.84,1,1),
('solo','solo_2','monthly',499,2,1),('solo','solo_2','annual',4071.84,2,1),
('team','standard','monthly',699,8,1),('team','standard','annual',5703.84,8,1),
('multi','multi_2','monthly',999,16,2),('multi','multi_2','annual',8151.84,16,2),
('multi','multi_3','monthly',1199,25,3),('multi','multi_3','annual',9783.84,25,3)),selected as(
select p.*,o.variant,o.cadence,o.amount,o.members,o.locations,(select coalesce(max(version),0) from public.plan_catalog_terms where plan_id=p.id) base,
 row_number() over(partition by p.id order by o.variant,o.cadence) ordinal
from public.plans p join offers o on o.slug=p.slug where not exists(select 1 from public.plan_catalog_terms t where t.plan_id=p.id and t.currency='EGP' and t.plan_variant=o.variant and t.billing_interval=o.cadence))
insert into public.plan_catalog_terms(plan_id,version,display_name,billing_interval,currency,price_amount,trial_days,resource_limits,is_public,is_purchasable,plan_variant,variant_name)
select id,base+ordinal,name,cadence,'EGP',amount,7,resource_limits||jsonb_build_object('active_members',members,'active_locations',locations),true,true,variant,name from selected;

create temporary table international_fixture(owner_id uuid default gen_random_uuid(),other_id uuid default gen_random_uuid(),shop_id uuid,other_shop uuid,other_order uuid,subscription_id uuid,usd_terms uuid,usd_upgrade uuid,egp_terms uuid,order_id uuid,upgrade_order uuid,quote_id uuid,session jsonb);
insert into international_fixture default values;
grant all on international_fixture to authenticated,service_role;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@international.invalid','synthetic','authenticated','authenticated',now(),'{}','{}',now(),now() from(select owner_id id from international_fixture union all select other_id from international_fixture) users;
insert into shop_private.xpay_configuration(singleton,enabled,merchant_id,mode) values(true,true,'merchant-fixture','test');
update shop_private.proration_configuration set enabled=false;
select set_config('request.jwt.claim.sub',owner_id::text,true),set_config('request.jwt.claim.role','authenticated',true) from international_fixture;
set local role authenticated;
update international_fixture set shop_id=public.create_owner_shop('International fixture','mixed'::public.business_mode,'Main',null,null,null);
update international_fixture set subscription_id=(public.shop_billing_read(shop_id)#>>'{subscription,id}')::uuid;
update international_fixture set usd_terms=(select (v->>'catalog_terms_id')::uuid from jsonb_array_elements(public.shop_subscription_currency_catalog('USD')) v where v->>'slug'='solo' and v->>'plan_variant'='solo_1' and v->>'billing_interval'='monthly'),
 usd_upgrade=(select (v->>'catalog_terms_id')::uuid from jsonb_array_elements(public.shop_subscription_currency_catalog('USD')) v where v->>'slug'='solo' and v->>'plan_variant'='solo_2' and v->>'billing_interval'='monthly'),
 egp_terms=(select catalog_terms_id from public.shop_public_plan_catalog() where slug='solo' and plan_variant='solo_1' and billing_interval='monthly');
do $$declare f international_fixture;begin select * into f from international_fixture;
 if jsonb_array_length(public.shop_subscription_currency_catalog('USD'))<>10 then raise exception 'USD matrix incomplete';end if;
 if (select count(*) from public.shop_public_plan_catalog() where currency<>'EGP')<>0 then raise exception 'Legacy EGP catalog changed';end if;
 if (select count(*) from jsonb_array_elements(public.shop_subscription_currency_catalog('USD')) v where (v->>'price_amount')::numeric*100 not in(699,5699,999,8199,1399,11399,1999,16299,2399,19599))<>0 then raise exception 'Fixed price book changed';end if;
 if public.shop_xpay_checkout_status(f.shop_id)->>'usdEnabled'<>'false' then raise exception 'USD enabled by migration';end if;
 begin perform public.shop_xpay_order_create(gen_random_uuid(),f.shop_id,f.usd_terms);raise exception 'Disabled USD order admitted';exception when sqlstate '22023' then if sqlerrm<>'XPAY_CURRENCY_UNSUPPORTED' then raise;end if;end;
 begin perform public.shop_xpay_record_refund(gen_random_uuid(),gen_random_uuid(),'{}',f.owner_id,'forged');raise exception 'Owner recorded refund';exception when insufficient_privilege then null;end;
end $$;
reset role;
update shop_private.xpay_configuration set usd_enabled=true;
set local role authenticated;
update international_fixture set order_id=(public.shop_xpay_order_create(gen_random_uuid(),shop_id,usd_terms)->>'id')::uuid;
select set_config('request.jwt.claim.sub',other_id::text,true) from international_fixture;
do $$declare f international_fixture;begin select * into f from international_fixture;
 begin perform public.shop_xpay_order_read(f.shop_id,f.order_id);raise exception 'Cross-owner order visible';exception when insufficient_privilege then null;end;
 begin perform public.shop_billing_currency_plans(f.shop_id,'USD');raise exception 'Cross-owner quotes visible';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
update international_fixture set session=jsonb_build_object('id','cs_test_international','object','checkout.session','merchantId','merchant-fixture','currency','EGP','amountTotal',34182,'livemode',false,'metadata',jsonb_build_object('orderId',order_id),'status','open','paymentStatus','unpaid','url','https://checkout.xpay.app/c/cs_test_international','isExpired',false,'expiresAt',clock_timestamp()+interval '30 minutes','presentmentDetails',jsonb_build_object('currency','USD','amountTotal',699,'exchangeRate',48.9,'exchangeRateId','fx_international'));
do $$declare f international_fixture;r jsonb;begin select * into f from international_fixture;
 r:=public.shop_xpay_bind_session(f.order_id,f.session);
 if r#>>'{moneyTracks,presentment,currency}'<>'USD' or r#>>'{moneyTracks,presentment,amountMinor}'<>'699' or r#>>'{moneyTracks,processing,amountMinor}'<>'34182' then raise exception 'Money tracks collapsed';end if;
 begin perform public.shop_xpay_apply_session(jsonb_set(f.session,'{amountTotal}','34900'));raise exception 'Locked processing total changed';exception when sqlstate '22023' then null;end;
 begin perform public.shop_xpay_apply_session(jsonb_set(f.session,'{presentmentDetails,amountTotal}','1'));raise exception 'Customer price changed';exception when sqlstate '22023' then null;end;
end $$;
reset role;
-- Pausing new USD charges cannot prevent reconciliation of an existing payment.
update shop_private.xpay_configuration set usd_enabled=false;
set local role service_role;
do $$declare f international_fixture;r jsonb;begin select * into f from international_fixture;
 r:=public.shop_xpay_apply_session(f.session||jsonb_build_object('status','complete','paymentStatus','paid','paymentIntentId','pi_international','processingFeeDetails',jsonb_build_object('feeAmount',210)));
 if r->>'state'<>'paid' then raise exception 'USD paid fulfillment failed';end if;
 perform public.shop_xpay_apply_session(f.session||jsonb_build_object('status','complete','paymentStatus','paid','paymentIntentId','pi_international'));
end $$;
reset role;
do $$declare f international_fixture;begin select * into f from international_fixture;
 if (select count(*) from public.shop_xpay_payments where order_id=f.order_id and currency='USD' and amount_minor=699)<>1 then raise exception 'USD receipt wrong or duplicated';end if;
 if (select count(*) from public.shop_xpay_processing_receipts where order_id=f.order_id)<>1 then raise exception 'Processing receipt duplicated';end if;
 if (select currency from public.subscription_commercial_periods where xpay_order_id=f.order_id)<>'USD' then raise exception 'Commercial period converted to EGP';end if;
 if has_table_privilege('authenticated','public.shop_xpay_money_tracks','insert') or has_table_privilege('service_role','public.shop_xpay_refund_observations','insert') then raise exception 'Financial table authority exposed';end if;
end $$;
update shop_private.xpay_configuration set usd_enabled=true;
update shop_private.proration_configuration set enabled=true;
select set_config('request.jwt.claim.sub',owner_id::text,true),set_config('request.jwt.claim.role','authenticated',true) from international_fixture;
set local role authenticated;
do $$declare f international_fixture;q jsonb;begin select * into f from international_fixture;
 q:=public.shop_billing_change_preview(f.shop_id,f.egp_terms);
 if q->>'timing'<>'term_end' then raise exception 'Cross-currency paid change was immediate';end if;
 begin perform public.shop_xpay_proration_quote(gen_random_uuid(),f.shop_id,f.egp_terms);raise exception 'Cross-currency proration admitted';exception when sqlstate '22023' then if sqlerrm<>'SHOP_PRORATION_CURRENCY_MISMATCH' then raise;end if;end;
 q:=public.shop_xpay_proration_quote(gen_random_uuid(),f.shop_id,f.usd_upgrade);
 if q#>>'{calculation,currency}'<>'USD' or (q#>>'{calculation,amountDueMinor}')::bigint not between 299 and 301 then raise exception 'USD proration arithmetic wrong: %',q;end if;
 update international_fixture set quote_id=(q->>'quoteId')::uuid;
 update international_fixture set upgrade_order=(public.shop_xpay_proration_order(f.shop_id,(q->>'quoteId')::uuid)->>'id')::uuid;
end $$;
reset role;
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
do $$declare f international_fixture;o jsonb;r jsonb;begin select * into f from international_fixture;o:=public.shop_xpay_server_order(f.upgrade_order);
 r:=public.shop_xpay_apply_session(jsonb_build_object('id','cs_test_usdupgrade','object','checkout.session','merchantId','merchant-fixture','currency','EGP','amountTotal',14670,'livemode',false,'metadata',jsonb_build_object('orderId',f.upgrade_order),'status','complete','paymentStatus','paid','paymentIntentId','pi_usdupgrade','presentmentDetails',jsonb_build_object('currency','USD','amountTotal',(o->>'amountMinor')::bigint,'exchangeRate',48.9,'exchangeRateId','fx_upgrade')));
 if r->>'state'<>'paid' then raise exception 'USD prorated settlement failed: %',r;end if;
end $$;
reset role;
do $$declare f international_fixture;begin select * into f from international_fixture;
 insert into public.shop_proration_credit_accounts(subscription_id,currency) values(f.subscription_id,'EGP');
 if (select version from public.shop_proration_credit_accounts where subscription_id=f.subscription_id and currency='USD')<>1 or (select version from public.shop_proration_credit_accounts where subscription_id=f.subscription_id and currency='EGP')<>0 then raise exception 'Credit currencies mixed';end if;
 if exists(select 1 from public.shop_proration_credit_ledger where subscription_id=f.subscription_id and currency<>'USD') then raise exception 'USD change touched EGP ledger';end if;
end $$;
select set_config('request.jwt.claim.sub',owner_id::text,true),set_config('request.jwt.claim.role','authenticated',true) from international_fixture;
set local role authenticated;
do $$declare f international_fixture;q jsonb;target uuid;begin select * into f from international_fixture;
 select (v->>'catalog_terms_id')::uuid into target from jsonb_array_elements(public.shop_subscription_currency_catalog('USD')) v where v->>'slug'='solo' and v->>'plan_variant'='solo_2' and v->>'billing_interval'='annual';
 q:=public.shop_xpay_proration_quote(gen_random_uuid(),f.shop_id,target);
 if q#>>'{calculation,currency}'<>'USD' or q#>>'{calculation,mode}'<>'new_interval' or (q#>>'{calculation,amountDueMinor}')::bigint not between 7199 and 7201 then raise exception 'USD monthly/yearly proration changed: %',q;end if;
 perform public.shop_xpay_proration_abandon(f.shop_id,(q->>'quoteId')::uuid);
end $$;
reset role;
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
do $$declare f international_fixture;r jsonb;request uuid:=gen_random_uuid();refund jsonb;begin select * into f from international_fixture;
 refund:=jsonb_build_object('refundId','refund_international_1','status','succeeded','sessionId','cs_test_international','amountTrackEvidence','provider_presentment_and_processing','providerEvidenceDigest',repeat('a',64),'processing',jsonb_build_object('currency','EGP','amountMinor',10000),'presentment',jsonb_build_object('currency','USD','amountMinor',200));
 r:=public.shop_xpay_record_refund(request,f.order_id,refund,f.owner_id,'Verified synthetic paired receipt');
 if public.shop_xpay_record_refund(request,f.order_id,refund,f.owner_id,'Verified synthetic paired receipt')<>r then raise exception 'Refund replay changed';end if;
 begin perform public.shop_xpay_record_refund(gen_random_uuid(),f.order_id,jsonb_set(refund,'{presentment,currency}','"EGP"'),f.owner_id,'wrong currency');raise exception 'Refund currency changed';exception when sqlstate '22023' then null;end;
 refund:=refund||jsonb_build_object('refundId','refund_international_2','processing',jsonb_build_object('currency','EGP','amountMinor',24182),'presentment',jsonb_build_object('currency','USD','amountMinor',499));
 perform public.shop_xpay_record_refund(gen_random_uuid(),f.order_id,refund,f.owner_id,'Remaining verified synthetic receipt');
 begin perform public.shop_xpay_record_refund(gen_random_uuid(),f.order_id,refund||jsonb_build_object('refundId','refund_over'),f.owner_id,'over-refund');raise exception 'Cumulative over-refund accepted';exception when sqlstate '22023' then null;end;
end $$;
reset role;
do $$declare f international_fixture;begin select * into f from international_fixture;
 if (select count(*) from public.shop_xpay_refund_observations where order_id=f.order_id)<>2 or (select sum(presentment_amount_minor) from public.shop_xpay_refund_observations where order_id=f.order_id)<>699 or (select sum(processing_amount_minor) from public.shop_xpay_refund_observations where order_id=f.order_id)<>34182 then raise exception 'Refund totals/replay wrong';end if;
 if (select status from public.subscriptions where id=f.subscription_id)<>'active' then raise exception 'Refund rewrote access without operator decision';end if;
end $$;
select set_config('request.jwt.claim.sub',owner_id::text,true),set_config('request.jwt.claim.role','authenticated',true) from international_fixture;
set local role authenticated;
do $$declare f international_fixture;target uuid;begin select * into f from international_fixture;
 select (v->>'catalog_terms_id')::uuid into target from jsonb_array_elements(public.shop_subscription_currency_catalog('USD')) v where v->>'slug'='team' and v->>'billing_interval'='monthly';
 begin perform public.shop_xpay_proration_quote(gen_random_uuid(),f.shop_id,target);raise exception 'Refunded funding spent twice';exception when sqlstate '55000' then if sqlerrm<>'SHOP_PRORATION_REFUND_REVIEW_REQUIRED' then raise;end if;end;
end $$;
reset role;
select 'International fixed catalog, isolation, dual tracks, replay, paused reconciliation, USD proration and verified paired refunds passed';

-- A fresh owner's USD trial quote never consumes another currency or tenant's funds.
reset role;
update shop_private.xpay_configuration set usd_enabled=false;
select set_config('request.jwt.claim.sub',other_id::text,true),set_config('request.jwt.claim.role','authenticated',true) from international_fixture;
set local role authenticated;
do $$declare f international_fixture;shop uuid;q jsonb;begin select * into f from international_fixture;
 shop:=public.create_owner_shop('USD trial fixture','mixed'::public.business_mode,'Main',null,null,null);
 q:=public.shop_xpay_proration_quote(gen_random_uuid(),shop,f.usd_terms);
 if q#>>'{calculation,currency}'<>'USD' or q#>>'{calculation,mode}'<>'trial_conversion' or q#>>'{calculation,amountDueMinor}'<>'699' or q#>>'{calculation,creditBeforeMinor}'<>'0' then raise exception 'USD trial quote funded incorrectly';end if;
 begin perform public.shop_xpay_proration_order(shop,(q->>'quoteId')::uuid);raise exception 'Unverified USD proration payment admitted';exception when sqlstate '22023' then if sqlerrm<>'XPAY_CURRENCY_UNSUPPORTED' then raise;end if;end;
 perform public.shop_xpay_proration_abandon(shop,(q->>'quoteId')::uuid);
 q:=public.shop_xpay_proration_quote(gen_random_uuid(),shop,f.egp_terms);
 if q#>>'{calculation,currency}'<>'EGP' or q#>>'{calculation,amountDueMinor}'<>'34900' then raise exception 'Existing EGP amount changed';end if;
 update international_fixture set other_shop=shop,other_order=(public.shop_xpay_proration_order(shop,(q->>'quoteId')::uuid)->>'id')::uuid;

end $$;
reset role;

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
do $$declare f international_fixture;r jsonb;begin select * into f from international_fixture;
 r:=public.shop_xpay_apply_session(jsonb_build_object('id','cs_test_egppreserved','object','checkout.session','merchantId','merchant-fixture','currency','EGP','amountTotal',34900,'livemode',false,'metadata',jsonb_build_object('orderId',f.other_order),'status','complete','paymentStatus','paid','paymentIntentId','pi_egppreserved'));
 if r->>'state'<>'paid' or r#>>'{moneyTracks,presentment,currency}'<>'EGP' or r#>>'{moneyTracks,presentment,amountMinor}'<>'34900' then raise exception 'Existing EGP settlement regressed';end if;
end $$;
reset role;
