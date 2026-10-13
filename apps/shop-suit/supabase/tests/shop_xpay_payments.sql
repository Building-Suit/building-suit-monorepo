-- Disposable rollback-only payment contract tests. Provider results below are
-- synthetic; this proves SQL authority/atomicity, not XPay sandbox compatibility.
create temporary table xpay_fixture(owner_id uuid default gen_random_uuid(),other_id uuid default gen_random_uuid(),shop_id uuid,terms_id uuid,order_id uuid,trial_start timestamptz,trial_end timestamptz,session jsonb);
insert into xpay_fixture default values;
grant all on xpay_fixture to authenticated,service_role;
insert into auth.users(id,email,encrypted_password,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id::text||'@xpay-disposable.invalid','x','authenticated','authenticated','{}','{}',now(),now()
from (select owner_id id from xpay_fixture union all select other_id from xpay_fixture) users;
insert into shop_private.xpay_configuration(singleton,enabled,merchant_id,mode) values(true,true,'merchant-fixture','test');
select set_config('request.jwt.claim.sub',owner_id::text,true),set_config('request.jwt.claim.role','authenticated',true) from xpay_fixture;
set local role authenticated;
update xpay_fixture set shop_id=public.create_owner_shop('XPay disposable','mixed'::public.business_mode,'Main fixture location',null,null,null);
update xpay_fixture set terms_id=(select catalog_terms_id from public.shop_public_plan_catalog() where slug='solo' and billing_interval='monthly' order by price_amount limit 1);
update xpay_fixture set trial_start=(public.shop_billing_read(shop_id)#>>'{subscription,trialStartAt}')::timestamptz,
 trial_end=(public.shop_billing_read(shop_id)#>>'{subscription,trialEndAt}')::timestamptz;
reset role;
do $$declare f xpay_fixture; legacy uuid; amount numeric;begin
 select * into f from xpay_fixture;
 select price_amount into amount from public.plan_catalog_terms where id=f.terms_id;
 legacy:=public.submit_shop_billing_notice(gen_random_uuid(),f.shop_id,'solo',f.terms_id,amount,current_date,'IPN-HISTORICAL-XPAY');
 update public.shop_billing_submissions set status='rejected',review_reason='Historical fixture only' where id=legacy;
end $$;
set local role authenticated;
do $$
declare f xpay_fixture; result jsonb; again jsonb;
begin
 select * into f from xpay_fixture;
 result:=public.shop_xpay_order_create(f.owner_id,f.shop_id,f.terms_id);
 again:=public.shop_xpay_order_create(f.owner_id,f.shop_id,f.terms_id);
 if result<>again or result->>'state'<>'creating' or (result->>'amountMinor')::bigint<=0 then raise exception 'quote replay failure'; end if;
 update xpay_fixture set order_id=(result->>'id')::uuid;
 if public.shop_billing_read(f.shop_id)#>>'{submissions,0,transferReference}'<>'IPN-HISTORICAL-XPAY' then raise exception 'historical notice lost';end if;
 if public.shop_billing_read(f.shop_id)#>>'{subscription,status}'<>'trialing' then raise exception 'quote granted access'; end if;
 begin perform public.shop_xpay_order_create(gen_random_uuid(),f.shop_id,f.terms_id);raise exception 'second open order accepted';exception when sqlstate '55000' then null;end;
 begin perform public.shop_xpay_server_order((result->>'id')::uuid);raise exception 'owner used server read';exception when insufficient_privilege then null;end;
 begin perform public.submit_shop_billing_notice(gen_random_uuid(),f.shop_id,349,current_date,'manual-new');raise exception 'manual notice accepted';exception when insufficient_privilege then null;end;
 begin perform public.reserve_shop_billing_payment_evidence(gen_random_uuid(),'new.png','image/png',1,repeat('a',64));raise exception 'manual upload accepted';exception when insufficient_privilege then null;end;
 begin perform public.shop_xpay_apply_session('{}');raise exception 'owner forged payment';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Immutable order snapshots must not be writable through the Data API.
do $$ begin
 if has_table_privilege('authenticated','public.shop_xpay_orders','insert') or has_table_privilege('service_role','public.shop_xpay_payments','insert')
 or has_function_privilege('anon','public.shop_xpay_order_create(uuid,uuid,uuid,jsonb)','execute') then raise exception 'unsafe payment privileges'; end if;
 if not has_function_privilege('authenticated','public.shop_billing_payment_evidence_read(uuid)','execute') then raise exception 'historical evidence read lost';end if;
end $$;
-- The actual owner query must reject another tenant, not rely on a hidden button.
select set_config('request.jwt.claim.sub',other_id::text,true) from xpay_fixture;
set local role authenticated;
do $$declare f xpay_fixture;begin select * into f from xpay_fixture;
 begin perform public.shop_xpay_order_read(f.shop_id);raise exception 'cross-tenant read accepted';exception when insufficient_privilege then null;end;
 begin perform public.shop_xpay_order_create(gen_random_uuid(),f.shop_id,f.terms_id);raise exception 'cross-tenant quote accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','',true);
set local role service_role;
update xpay_fixture set session=(select jsonb_build_object('id','cs_test_SQLfixture','object','checkout.session','merchantId',o->>'merchantId','livemode',false,
 'metadata',jsonb_build_object('orderId',o->>'id'),'currency','EGP','amountTotal',(o->>'amountMinor')::bigint,
 'status','open','paymentStatus','unpaid','url','https://checkout.xpay.app/c/cs_test_SQLfixture','isExpired',false,'expiresAt',clock_timestamp()+interval '30 minutes')
 from (select public.shop_xpay_server_order(order_id) o from xpay_fixture) q);
do $$declare f xpay_fixture; result jsonb; paid jsonb; before_end timestamptz;
begin
 select * into f from xpay_fixture;
 begin perform public.shop_xpay_bind_session(f.order_id,f.session||'{"amountTotal":1}');raise exception 'price mismatch accepted';exception when sqlstate '22023' then null;end;
 begin perform public.shop_xpay_bind_session(f.order_id,f.session-'livemode');raise exception 'missing mode accepted';exception when sqlstate '22023' then null;end;
 begin perform public.shop_xpay_bind_session(f.order_id,f.session||'{"merchantId":"other"}');raise exception 'merchant mismatch accepted';exception when sqlstate '22023' then null;end;
 perform public.shop_xpay_bind_session(f.order_id,f.session);
 perform public.shop_xpay_inbox_receive('evt_sql_pending','checkout.session.completed','cs_test_SQLfixture','merchant-fixture','test',repeat('a',64));
 result:=public.shop_xpay_apply_session(f.session||'{"status":"complete"}','evt_sql_pending');
 if result->>'state'<>'pending' then raise exception 'unpaid session treated as paid';end if;
 paid:=f.session||'{"status":"complete","paymentStatus":"paid","paymentIntentId":"pi_test_SQLfixture"}';
 perform public.shop_xpay_inbox_receive('evt_sql_paid','checkout.session.async_payment_succeeded','cs_test_SQLfixture','merchant-fixture','test',repeat('b',64));
 result:=public.shop_xpay_apply_session(paid,'evt_sql_paid');
 if result->>'state'<>'paid' then raise exception 'verified result did not pay';end if;
 perform public.shop_xpay_apply_session(paid,'evt_sql_paid');
 -- Distinct events carrying the same paid result still grant exactly once.
 perform public.shop_xpay_inbox_receive('evt_sql_duplicate','checkout.session.completed','cs_test_SQLfixture','merchant-fixture','test',repeat('c',64));
 perform public.shop_xpay_apply_session(paid,'evt_sql_duplicate');
 -- Old failure/expiry cannot roll back a paid order.
 perform public.shop_xpay_apply_session(f.session||'{"status":"expired"}');
 if public.shop_xpay_server_order(f.order_id)->>'state'<>'paid' then raise exception 'late expiry downgraded payment';end if;
 begin perform public.shop_xpay_inbox_receive('evt_sql_paid','checkout.session.expired','cs_test_SQLfixture','merchant-fixture','test',repeat('b',64));raise exception 'event mutation accepted';exception when sqlstate '22023' then null;end;
end $$;
reset role;
do $$declare f xpay_fixture;s public.subscriptions;p public.shop_xpay_payments;
begin
 select * into f from xpay_fixture;
 select * into s from public.subscriptions where id=(select subscription_id from public.shop_xpay_orders where id=f.order_id);
 select * into p from public.shop_xpay_payments where order_id=f.order_id;
 if s.status<>'active' or s.trial_start_at<>f.trial_start or s.trial_end_at<>f.trial_end then raise exception 'day-one activation changed historical trial';end if;
 if p.period_start>=f.trial_end or p.period_end<>p.period_start+interval '1 month' then raise exception 'paid term deferred until trial end';end if;
 if (select count(*) from public.shop_xpay_payments where order_id=f.order_id)<>1
 or (select count(*) from public.subscription_commercial_periods where xpay_order_id=f.order_id)<>1 then raise exception 'duplicate entitlement';end if;
 begin update public.shop_xpay_payments set amount_minor=1 where order_id=f.order_id;raise exception 'immutable payment changed';exception when sqlstate '55000' then null;end;
end $$;
-- Concurrent administrative changes cause a paid hold, not an overwrite. The
-- money observation is immutable even while access requires operator review.
select set_config('request.jwt.claim.sub',owner_id::text,true),set_config('request.jwt.claim.role','authenticated',true) from xpay_fixture;
set local role authenticated;
update xpay_fixture set order_id=(public.shop_xpay_order_create(gen_random_uuid(),shop_id,terms_id)->>'id')::uuid;
reset role;
update public.subscriptions set updated_at=clock_timestamp()+interval '1 second'
where id=(select subscription_id from public.shop_xpay_orders where id=(select order_id from xpay_fixture));
select set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','',true);
set local role service_role;
do $$declare f xpay_fixture; o jsonb;result jsonb;
begin
 select * into f from xpay_fixture; o:=public.shop_xpay_server_order(f.order_id);
 result:=public.shop_xpay_apply_session(jsonb_build_object('id','cs_test_Heldfixture','object','checkout.session','merchantId',o->>'merchantId','livemode',false,
 'metadata',jsonb_build_object('orderId',o->>'id'),'currency','EGP','amountTotal',(o->>'amountMinor')::bigint,
 'status','complete','paymentStatus','paid','paymentIntentId','pi_test_Heldfixture'));
 if result->>'state'<>'requires_review' then raise exception 'concurrent admin change was overwritten';end if;
end $$;
reset role;
do $$declare f xpay_fixture;begin
 select * into f from xpay_fixture;
 if exists(select 1 from public.shop_xpay_payments where order_id=f.order_id)
 or not exists(select 1 from public.shop_xpay_paid_observations where order_id=f.order_id)
 then raise exception 'held payment fabricated grant or lost actual payment observation';end if;
 if (select count(*) from public.subscription_commercial_periods where xpay_order_id is not null)<>1 then raise exception 'held payment extended access';end if;
end $$;
