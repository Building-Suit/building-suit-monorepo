-- Disposable synthetic provider proofs; no hosted configuration or real charges.
insert into public.plans(portal_id,name,slug,price_amount,currency,billing_interval,trial_days,features,resource_limits,is_active,is_public,is_purchasable,is_coming_soon)
select id,v.name,v.slug,v.amount,'EGP',v.interval,7,'{}','{"active_locations":1,"active_members":1,"active_products":250,"active_services":50,"active_customers":500,"active_suppliers":50}',true,true,true,false
from public.portals cross join(values('Journey monthly low','journey-month-low',349,'monthly'),('Journey monthly high','journey-month-high',699,'monthly'),('Journey annual low','journey-year-low',4188,'annual'),('Journey annual high','journey-year-high',8388,'annual')) v(name,slug,amount,interval) where key='shop-crm';
select shop_private.reconcile_plan_catalog();
insert into shop_private.xpay_configuration(singleton,enabled,merchant_id,mode) values(true,true,'merchant-journey','test');
update shop_private.proration_configuration set enabled=true where singleton;

create function pg_temp.journey_owner() returns uuid language plpgsql as $$
declare owner_id uuid:=gen_random_uuid();shop_id uuid;begin
 insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(owner_id,owner_id::text||'@journey.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now());
 perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claim.role','authenticated',true);
 perform set_config('request.headers','{}',true);
 shop_id:=public.create_owner_shop('Proration journey','mixed'::public.business_mode,'Main',null,null,null);
 return shop_id;
end $$;
create function pg_temp.journey_paid(order_id uuid) returns jsonb language plpgsql as $$
declare o jsonb;result jsonb;prior_role text:=current_setting('request.jwt.claim.role',true);begin
 perform set_config('request.jwt.claim.role','service_role',true);
 o:=public.shop_xpay_server_order(order_id);
 result:=public.shop_xpay_apply_session(jsonb_build_object('id','cs_test_J'||replace(order_id::text,'-',''),'object','checkout.session','merchantId',o->>'merchantId','livemode',false,'currency','EGP','amountTotal',(o->>'amountMinor')::bigint,'status','complete','paymentStatus','paid','paymentIntentId',null,'paymentIntent',jsonb_build_object('id','pi_J'||replace(order_id::text,'-','')),'metadata',jsonb_build_object('orderId',order_id)));
 perform set_config('request.jwt.claim.role',prior_role,true);
 return result;
end $$;

DO $$declare scenario record;v_shop_id uuid;old_terms uuid;new_terms uuid;order_id uuid;q jsonb;result jsonb;before_sub public.subscriptions;after_sub public.subscriptions;before_cash bigint;trial_before jsonb;settled public.shop_proration_settlements;begin
 for scenario in select * from(values
 ('monthly paid upgrade','journey-month-low','journey-month-high','remaining_period',true,35000),
 ('monthly paid downgrade','journey-month-high','journey-month-low','remaining_period',false,35000),
 ('annual paid upgrade','journey-year-low','journey-year-high','remaining_period',true,420000),
 ('annual paid downgrade','journey-year-high','journey-year-low','remaining_period',false,420000),
 ('monthly to annual','journey-month-low','journey-year-low','new_interval',true,383900),
 ('annual to monthly','journey-year-low','journey-month-low','new_interval',false,383900),
 ('trial day one activation',null,'journey-month-low','trial_conversion',true,34900)
 ) v(name,old_slug,new_slug,mode,cash,expected_minor) loop
  v_shop_id:=pg_temp.journey_owner();
  select catalog_terms_id into new_terms from public.shop_public_plan_catalog() where slug=scenario.new_slug limit 1;
  if scenario.old_slug is not null then
   select catalog_terms_id into old_terms from public.shop_public_plan_catalog() where slug=scenario.old_slug limit 1;
   -- Initial purchase is the existing gate-off full-term path.
   update shop_private.proration_configuration set enabled=false where singleton;
   order_id:=(public.shop_xpay_order_create(gen_random_uuid(),v_shop_id,old_terms)->>'id')::uuid;
   result:=pg_temp.journey_paid(order_id);
   if result->>'state'<>'paid' then raise exception '% initial payment failed',scenario.name;end if;
   update shop_private.proration_configuration set enabled=true where singleton;
  end if;
  select sub.* into before_sub from public.subscriptions sub join public.shop_memberships m on m.profile_id=sub.profile_id where m.shop_id=v_shop_id and m.role='owner';
  trial_before:=jsonb_build_object('start',before_sub.trial_start_at,'end',before_sub.trial_end_at,'consumed',before_sub.trial_consumed);
  select count(*) into before_cash from public.shop_xpay_payments p join public.shop_xpay_orders o on o.id=p.order_id where o.subscription_id=before_sub.id;
  q:=public.shop_xpay_proration_quote(gen_random_uuid(),v_shop_id,new_terms);
  if q#>>'{calculation,mode}'<>scenario.mode then raise exception '% mode wrong',scenario.name;end if;
  if scenario.cash then
   if abs((q#>>'{calculation,amountDueMinor}')::bigint-scenario.expected_minor)>1 then raise exception '% cash differs from expected economic amount: %',scenario.name,q;end if;
   order_id:=(public.shop_xpay_proration_order(v_shop_id,(q->>'quoteId')::uuid)->>'id')::uuid;
   result:=pg_temp.journey_paid(order_id);perform pg_temp.journey_paid(order_id);
   if result->>'state'<>'paid' then raise exception '% cash did not settle',scenario.name;end if;
  else
   if (q#>>'{calculation,amountDueMinor}')::bigint<>0 or abs((q#>>'{calculation,creditAfterMinor}')::bigint-scenario.expected_minor)>1 then raise exception '% carryforward differs from expected economic amount: %',scenario.name,q;end if;
   result:=public.shop_xpay_proration_credit_confirm(v_shop_id,(q->>'quoteId')::uuid);
   perform public.shop_xpay_proration_credit_confirm(v_shop_id,(q->>'quoteId')::uuid);
   if result->>'state'<>'settled' then raise exception '% credit did not settle',scenario.name;end if;
  end if;
  select * into after_sub from public.subscriptions where id=before_sub.id;
  select * into settled from public.shop_proration_settlements where quote_id=(q->>'quoteId')::uuid;
  if after_sub.status<>'active' or after_sub.catalog_terms_id<>new_terms or settled.quote_id is null then raise exception '% access not fulfilled',scenario.name;end if;
  if scenario.mode='remaining_period' then
   if after_sub.current_period_start<>before_sub.current_period_start or after_sub.current_period_end<>before_sub.current_period_end then raise exception '% changed renewal boundary',scenario.name;end if;
  else
   if after_sub.current_period_start<(q->>'createdAt')::timestamptz or after_sub.current_period_end<>after_sub.current_period_start+(case q#>>'{calculation,newBillingInterval}' when 'annual' then interval '1 year' else interval '1 month' end) then raise exception '% new term starts/ends incorrectly',scenario.name;end if;
  end if;
  if jsonb_build_object('start',after_sub.trial_start_at,'end',after_sub.trial_end_at,'consumed',after_sub.trial_consumed)<>trial_before then raise exception '% changed trial history',scenario.name;end if;
  if (select count(*) from public.shop_xpay_payments p join public.shop_xpay_orders o on o.id=p.order_id where o.subscription_id=before_sub.id)<>before_cash+(case when scenario.cash then 1 else 0 end) then raise exception '% fabricated/duplicated payment',scenario.name;end if;
  if (select count(*) from public.shop_proration_credit_ledger where quote_id=settled.quote_id)<>1 or (select count(*) from public.subscription_commercial_periods where proration_quote_id=settled.quote_id)<>1 then raise exception '% duplicate ledger/period',scenario.name;end if;
  raise notice 'PASS %',scenario.name;
 end loop;
end $$;

-- Issue secure terms through the existing SAS target bridge, preserving nonce,
-- exact request identity and the opaque owner-bound offer token.
insert into public.plans(portal_id,name,slug,price_amount,currency,billing_interval,trial_days,features,resource_limits,is_active,is_public,is_purchasable,is_coming_soon)
select portal_id,'Private journey anchor','solo',price_amount,currency,billing_interval,trial_days,features,resource_limits,true,false,false,false from public.plans plan
where slug='journey-month-low' and not exists(select 1 from public.plans existing where existing.portal_id=plan.portal_id and existing.slug='solo');
create temporary table journey_bridge as select gen_random_uuid() principal_id,gen_random_uuid() source_id,gen_random_uuid() binding_id,gen_random_uuid() environment_id,gen_random_uuid() operator_id;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select operator_id,operator_id::text||'@journey-operator.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from journey_bridge;
insert into public.platform_admins(user_id,role,display_name) select operator_id,'operator','Synthetic journey operator' from journey_bridge;
insert into public.shop_super_admin_integrations(id,source_binding_id,target_binding_id,target_environment_id,audience,key_id,allowed_operations,max_clock_skew_seconds,nonce_retention_seconds,valid_from,enabled)
select principal_id,source_id,binding_id,environment_id,'shop-suit:journey-test','journey-test',array['adapter.capabilities.read','shop.billing.command','shop.plan.command'],300,3600,clock_timestamp()-interval '1 minute',true from journey_bridge;
create function pg_temp.journey_dispatch(action text,payload jsonb,request_id uuid default gen_random_uuid(),p_operation text default 'shop.billing.command') returns jsonb language plpgsql as $$
declare f journey_bridge;nonce uuid:=gen_random_uuid();envelope jsonb;digest text;result jsonb;owner_id text:=current_setting('request.jwt.claim.sub',true);prior_role text:=current_setting('request.jwt.claim.role',true);begin
 select * into f from journey_bridge;
 perform set_config('request.jwt.claim.role','service_role',true);perform set_config('request.jwt.claim.sub','',true);
 envelope:=jsonb_build_object('protocolVersion','1.0','operationVersion','1.0','operation',p_operation,'requestId',request_id,'correlationId',request_id,
 'sourceBindingId',f.source_id,'targetBindingId',f.binding_id,'targetEnvironmentId',f.environment_id,
 'actor',jsonb_build_object('authorityBindingId',f.source_id,'subjectId',f.operator_id,'roleSnapshot','super-admin-operator','sessionId','journey-test'),
 'reason','Synthetic reviewed commercial terms','payload',case when p_operation='shop.plan.command' then payload else jsonb_build_object('action',action,'payload',payload) end);
 digest:=encode(extensions.digest(envelope::text,'sha256'),'hex');
 perform public.shop_super_admin_bridge_accept_nonce(f.principal_id,'journey-test',nonce,request_id,extract(epoch from clock_timestamp())::bigint,digest);
 result:=public.shop_super_admin_bridge_invoke(f.principal_id,nonce,digest,envelope);
 perform set_config('request.jwt.claim.sub',owner_id,true);perform set_config('request.jwt.claim.role',prior_role,true);
 return result;
end $$;
DO $$declare f journey_bridge;v_shop uuid;owner_id uuid;offer_id uuid;issue_request uuid;payload jsonb;issued jsonb;replay jsonb;entry jsonb;q jsonb;v_order_id uuid;result jsonb;s public.subscriptions;after_sub public.subscriptions;revoked boolean;begin
 select * into f from journey_bridge;
 foreach revoked in array array[false,true] loop
  v_shop:=pg_temp.journey_owner();owner_id:=auth.uid();offer_id:=gen_random_uuid();issue_request:=gen_random_uuid();
  select sub.* into s from public.subscriptions sub join public.shop_memberships m on m.profile_id=sub.profile_id where m.shop_id=v_shop and m.role='owner';
  payload:=jsonb_build_object('offerId',offer_id,'offerVersion',3,'shopId',v_shop,'recipientUserId',owner_id,'targetBindingId',f.binding_id,'targetEnvironmentId',f.environment_id,'suit','shop-suit',
  'expiresAt',clock_timestamp()+interval '1 day','planId',(select plan.id from public.plans plan join public.portals portal on portal.id=plan.portal_id where portal.key='shop-crm' and plan.slug='solo'),'displayName','Private journey agreement','billingInterval','monthly','currency','EGP','priceAmount',123.45,
  'resourceLimits','{"active_locations":1,"active_members":2,"active_products":10,"active_services":10,"active_customers":10,"active_suppliers":10}'::jsonb,'entitlements','{"appointments":true,"reports":false}'::jsonb);
  issued:=pg_temp.journey_dispatch('register_secure_private_offer',payload,issue_request);replay:=pg_temp.journey_dispatch('register_secure_private_offer',payload,issue_request);
  if not(replay->>'replayed')::boolean or issued#>>'{data,redemptionToken}' is distinct from replay#>>'{data,redemptionToken}' then raise exception 'SAS issue replay replaced token';end if;
  entry:=jsonb_build_object('offerId',offer_id,'offerVersion',3,'targetBindingId',f.binding_id,'targetEnvironmentId',f.environment_id,'redemptionToken',issued#>>'{data,redemptionToken}');
  q:=public.shop_xpay_proration_quote(gen_random_uuid(),v_shop,null,entry);
  if (q#>>'{calculation,amountDueMinor}')::bigint<>12345 or q#>'{details,entitlements}'<>'{"appointments":true,"reports":false}'::jsonb or q::text like '%'||(entry->>'redemptionToken')||'%' then raise exception 'Private frozen price/entitlement/token projection wrong';end if;
  perform set_config('request.jwt.claim.sub',f.operator_id::text,true);
  begin perform public.shop_xpay_proration_read(v_shop,(q->>'quoteId')::uuid);raise exception 'Another actor read owner quote';exception when insufficient_privilege then null;end;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  v_order_id:=(public.shop_xpay_proration_order(v_shop,(q->>'quoteId')::uuid)->>'id')::uuid;
  if revoked then perform pg_temp.journey_dispatch('revoke_secure_private_offer',entry-'redemptionToken');end if;
  result:=pg_temp.journey_paid(v_order_id);
  select * into after_sub from public.subscriptions where id=s.id;
  if revoked then
   if result->>'state'<>'requires_review' or to_jsonb(after_sub)<>to_jsonb(s) or (select count(*) from public.shop_xpay_paid_observations where public.shop_xpay_paid_observations.order_id=v_order_id)<>1 then raise exception 'Revoked offer paid proof lost/changed access';end if;
   if exists(select 1 from public.shop_proration_settlements where quote_id=(q->>'quoteId')::uuid) then raise exception 'Revoked offer settled';end if;
  else
   if result->>'state'<>'paid' or after_sub.status<>'active' or (select offer_entitlements from public.subscription_commercial_periods where proration_quote_id=(q->>'quoteId')::uuid)<>'{"appointments":true,"reports":false}'::jsonb then raise exception 'Private paid terms not frozen at fulfillment';end if;
   begin perform public.shop_xpay_proration_quote(gen_random_uuid(),v_shop,null,entry);raise exception 'Paid private offer reused';exception when sqlstate '55000' then null;end;
  end if;
 end loop;
end $$;

-- Existing operator activation is an access grant, never invented prepaid cash.
DO $$declare f journey_bridge;v_shop uuid;owner_id uuid;low_plan uuid;high_terms uuid;s public.subscriptions;granted public.subscriptions;after_admin public.subscriptions;after_paid public.subscriptions;q jsonb;v_order uuid;result jsonb;change_after_quote boolean;begin
 select * into f from journey_bridge;
 select id into low_plan from public.plans where slug='journey-month-low';
 foreach change_after_quote in array array[false,true] loop
  v_shop:=pg_temp.journey_owner();owner_id:=auth.uid();
  select sub.* into s from public.subscriptions sub join public.shop_memberships m on m.profile_id=sub.profile_id where m.shop_id=v_shop and m.role='owner';
  perform set_config('request.jwt.claim.sub',f.operator_id::text,true);
  perform pg_temp.journey_dispatch('activate_trial',jsonb_build_object('action','activate_trial','planId',low_plan,'shopId',v_shop,'payload',jsonb_build_object('subscriptionId',s.id)),gen_random_uuid(),'shop.plan.command');
  select * into granted from public.subscriptions where id=s.id;
  if granted.status<>'active' or granted.trial_start_at is distinct from s.trial_start_at or granted.trial_end_at is distinct from s.trial_end_at then raise exception 'Operator grant changed trial history';end if;
  if exists(select 1 from public.shop_xpay_orders where subscription_id=s.id) then raise exception 'Operator grant fabricated payment';end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select catalog_terms_id into high_terms from public.shop_public_plan_catalog() where slug='journey-month-high' limit 1;
  q:=public.shop_xpay_proration_quote(gen_random_uuid(),v_shop,high_terms);
  if (q#>>'{calculation,unusedPrepaidMinor}')::numeric<>0 or abs((q#>>'{calculation,amountDueMinor}')::bigint-69900)>1 then raise exception 'Access grant invented unused cash';end if;
  v_order:=(public.shop_xpay_proration_order(v_shop,(q->>'quoteId')::uuid)->>'id')::uuid;
  if change_after_quote then
   perform set_config('request.jwt.claim.sub',f.operator_id::text,true);
   perform pg_temp.journey_dispatch('renew_subscription',jsonb_build_object('action','renew_subscription','planId',null,'shopId',v_shop,'payload','{}'::jsonb),gen_random_uuid(),'shop.plan.command');
   perform set_config('request.jwt.claim.sub',owner_id::text,true);
  end if;
  select * into after_admin from public.subscriptions where id=s.id;
  result:=pg_temp.journey_paid(v_order);
  select * into after_paid from public.subscriptions where id=s.id;
  if change_after_quote then
   if result->>'state'<>'requires_review' or to_jsonb(after_paid)<>to_jsonb(after_admin)
    or (select count(*) from public.shop_xpay_paid_observations where order_id=v_order)<>1
    or exists(select 1 from public.shop_proration_credit_ledger where quote_id=(q->>'quoteId')::uuid) then raise exception 'Concurrent admin grant overwritten or real paid observation lost';end if;
  else
   if result->>'state'<>'paid' or after_paid.catalog_terms_id<>high_terms or after_paid.current_period_end<>granted.current_period_end then raise exception 'Granted-period upgrade failed';end if;
  end if;
 end loop;
end $$;

-- Current gate-off manual renewal and expired-owner access. Historical dates
-- are set only in this disposable synthetic fixture, never in a hosted tenant.
DO $$declare v_shop uuid;terms uuid;s public.subscriptions;renewed public.subscriptions;v_order uuid;result jsonb;at timestamptz;trial_before jsonb;q jsonb;begin
 v_shop:=pg_temp.journey_owner();select catalog_terms_id into terms from public.shop_public_plan_catalog() where slug='journey-month-low' limit 1;
 update shop_private.proration_configuration set enabled=false where singleton;
 v_order:=(public.shop_xpay_order_create(gen_random_uuid(),v_shop,terms)->>'id')::uuid;perform pg_temp.journey_paid(v_order);
 select sub.* into s from public.subscriptions sub join public.shop_memberships m on m.profile_id=sub.profile_id where m.shop_id=v_shop and m.role='owner';
 perform set_config('request.headers',jsonb_build_object('x-shop-payment-intent','renew','x-shop-prior-paid-order',v_order)::text,true);
 v_order:=(public.shop_xpay_order_create(gen_random_uuid(),v_shop,terms)->>'id')::uuid;result:=pg_temp.journey_paid(v_order);
 select * into renewed from public.subscriptions where id=s.id;
 if result->>'state'<>'paid' or renewed.current_period_start<>s.current_period_start or renewed.current_period_end<>s.current_period_end+interval '1 month' then raise exception 'Gate-off same-plan early renewal blocked or reset prepaid period';end if;
 trial_before:=jsonb_build_object('start',s.trial_start_at,'end',s.trial_end_at,'consumed',s.trial_consumed);
 perform set_config('shop.billing_approval','approved',true);
 update public.subscriptions set current_period_start=clock_timestamp()-interval '2 months',current_period_end=clock_timestamp()-interval '1 month',updated_at=clock_timestamp() where id=s.id;
 if public.shop_billing_read(v_shop)#>>'{subscription,accessState}'<>'read_only' then raise exception 'Expired owner cannot read billing or wrong access state';end if;
 begin perform shop_private.assert_shop_write_access(v_shop,'services.manage');raise exception 'Expired writes allowed';exception when insufficient_privilege then if sqlerrm<>'SHOP_SUBSCRIPTION_INACTIVE' then raise;end if;end;
 perform set_config('request.headers','{}',true);
 v_order:=(public.shop_xpay_order_create(gen_random_uuid(),v_shop,terms)->>'id')::uuid;
 at:=clock_timestamp();result:=pg_temp.journey_paid(v_order);select * into renewed from public.subscriptions where id=s.id;
 if result->>'state'<>'paid' or renewed.current_period_start<at or renewed.current_period_end<>renewed.current_period_start+interval '1 month'
 or jsonb_build_object('start',renewed.trial_start_at,'end',renewed.trial_end_at,'consumed',renewed.trial_consumed)<>trial_before then raise exception 'Expired manual renewal backdated, blocked or changed trial history';end if;
 -- Fresh gated same terms is a no-op; expiry changes it to a full-term renewal.
 update shop_private.proration_configuration set enabled=true where singleton;
 q:=public.shop_xpay_proration_quote(gen_random_uuid(),v_shop,terms);
 if q#>>'{calculation,mode}'<>'no_change' then raise exception 'Gated current paid terms fabricated a renewal charge';end if;
 perform public.shop_xpay_proration_credit_confirm(v_shop,(q->>'quoteId')::uuid);
 update public.subscriptions set current_period_start=clock_timestamp()-interval '2 months',current_period_end=clock_timestamp()-interval '1 month',updated_at=clock_timestamp() where id=s.id;
 q:=public.shop_xpay_proration_quote(gen_random_uuid(),v_shop,terms);
 if q#>>'{calculation,mode}'<>'full_term' or (q#>>'{calculation,amountDueMinor}')::bigint<>34900 or (q#>>'{calculation,unusedPrepaidMinor}')::numeric<>0 then raise exception 'Expired gated same-plan renewal quote incorrect';end if;
 v_order:=(public.shop_xpay_proration_order(v_shop,(q->>'quoteId')::uuid)->>'id')::uuid;
 at:=clock_timestamp();result:=pg_temp.journey_paid(v_order);select * into renewed from public.subscriptions where id=s.id;
 if result->>'state'<>'paid' or renewed.current_period_start<at or renewed.current_period_end<>renewed.current_period_start+interval '1 month' then raise exception 'Expired gated renewal did not start at verified settlement';end if;
end $$;

-- Two prepaid annual receipts include a fully future term. Interval switching
-- carries actual remaining funded value once; same-interval composite pricing
-- remains explicitly unsupported rather than treating two years as one rate.
DO $$declare v_shop uuid;annual_terms uuid;monthly_terms uuid;annual_high uuid;s public.subscriptions;v_order uuid;q jsonb;funding jsonb;result jsonb;begin
 v_shop:=pg_temp.journey_owner();
 select catalog_terms_id into annual_terms from public.shop_public_plan_catalog() where slug='journey-year-low' limit 1;
 select catalog_terms_id into annual_high from public.shop_public_plan_catalog() where slug='journey-year-high' limit 1;
 select catalog_terms_id into monthly_terms from public.shop_public_plan_catalog() where slug='journey-month-low' limit 1;
 update shop_private.proration_configuration set enabled=false where singleton;
 for count in 1..2 loop
  if count=2 then perform set_config('request.headers',jsonb_build_object('x-shop-payment-intent','renew','x-shop-prior-paid-order',v_order)::text,true);end if;
 v_order:=(public.shop_xpay_order_create(gen_random_uuid(),v_shop,annual_terms)->>'id')::uuid;perform pg_temp.journey_paid(v_order);end loop;
 select sub.* into s from public.subscriptions sub join public.shop_memberships m on m.profile_id=sub.profile_id where m.shop_id=v_shop and m.role='owner';
 if s.current_period_end<>s.current_period_start+interval '2 years' then raise exception 'Two annual renewals not accumulated';end if;
 funding:=shop_private.proration_funding(s,clock_timestamp());
 if jsonb_array_length(funding->'evidence')<>2 or (funding->>'unusedMinor')::numeric not between 837599 and 837600 then raise exception 'Future funded annual receipt omitted or duplicated';end if;
 update shop_private.proration_configuration set enabled=true where singleton;
 begin perform public.shop_xpay_proration_quote(gen_random_uuid(),v_shop,annual_high);raise exception 'Composite same-interval cycle mispriced';exception when invalid_parameter_value then if sqlerrm<>'SHOP_PRORATION_PERIOD_UNSUPPORTED' then raise;end if;end;
 q:=public.shop_xpay_proration_quote(gen_random_uuid(),v_shop,monthly_terms);
 if q#>>'{calculation,mode}'<>'new_interval' or (q#>>'{calculation,amountDueMinor}')::bigint<>0 or abs((q#>>'{calculation,creditAfterMinor}')::bigint-802700)>1 then raise exception 'Composite interval switch lost real future prepaid value';end if;
 result:=public.shop_xpay_proration_credit_confirm(v_shop,(q->>'quoteId')::uuid);
 if result->>'state'<>'settled' or (select count(*) from public.shop_xpay_payments p join public.shop_xpay_orders o on o.id=p.order_id where o.subscription_id=s.id)<>2 then raise exception 'Composite interval switch fabricated cash';end if;
 select * into s from public.subscriptions where id=s.id;
 funding:=shop_private.proration_funding(s,clock_timestamp());
 if jsonb_array_length(funding->'evidence')<>1 or funding#>>'{evidence,0,kind}'<>'allocation' or (funding->>'unusedMinor')::numeric>34900 then raise exception 'Consumed annual receipts credited twice';end if;
end $$;

-- Consumed by the disposable JS runner to check the actual SQL→client contract.
select jsonb_build_object('prorationContract',shop_private.proration_quote_view(q)) from public.shop_proration_quotes q order by q.created_at,q.id;
