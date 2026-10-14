-- Disposable-only: real database contracts and synthetic provider observations.
-- The runner prepends journey plan/owner/payment helpers, never hosted fixtures.
create temporary table policy_quote_contracts(value jsonb);
do $$declare shop uuid;high_terms uuid;low_terms uuid;annual_low uuid;annual_high uuid;v_order uuid;sub public.subscriptions;
 before_sub jsonb;preview jsonb;scheduled jsonb;again jsonb;request uuid:=gen_random_uuid();q jsonb;result jsonb;owner_claim text;
begin
 shop:=pg_temp.journey_owner();
 select catalog_terms_id into high_terms from public.shop_public_plan_catalog() where slug='journey-month-high' limit 1;
 select catalog_terms_id into low_terms from public.shop_public_plan_catalog() where slug='journey-month-low' limit 1;
 select catalog_terms_id into annual_low from public.shop_public_plan_catalog() where slug='journey-year-low' limit 1;
 select catalog_terms_id into annual_high from public.shop_public_plan_catalog() where slug='journey-year-high' limit 1;
 update shop_private.proration_configuration set enabled=false where singleton;
 v_order:=(public.shop_xpay_order_create(gen_random_uuid(),shop,high_terms)->>'id')::uuid;perform pg_temp.journey_paid(v_order);
 update shop_private.proration_configuration set enabled=true where singleton;
 select s.* into sub from public.subscriptions s join public.shop_memberships m on m.profile_id=s.profile_id where m.shop_id=shop and m.role='owner';before_sub:=to_jsonb(sub);
 preview:=public.shop_billing_change_preview(shop,low_terms);
 if preview->>'timing'<>'term_end' then raise exception 'Cheaper active plan not deferred';end if;
 begin perform public.shop_xpay_proration_quote(gen_random_uuid(),shop,low_terms);raise exception 'Immediate downgrade quote accepted';
 exception when sqlstate '55000' then if sqlerrm<>'SHOP_CHANGE_AT_PERIOD_END' then raise;end if;end;
 scheduled:=public.shop_billing_change_schedule(request,shop,low_terms);again:=public.shop_billing_change_schedule(request,shop,low_terms);
 if scheduled->>'id'<>again->>'id' or scheduled->>'state'<>'scheduled' or (scheduled->>'effectiveAt')::timestamptz<>sub.current_period_end
 or (scheduled->>'canPayNow')::boolean then raise exception 'Schedule replay/date/payment eligibility incorrect';end if;
 if to_jsonb((select s from public.subscriptions s where s.id=sub.id))<>before_sub
 or (select count(*) from public.shop_xpay_orders where subscription_id=sub.id)<>1
 or exists(select 1 from public.shop_proration_credit_ledger where subscription_id=sub.id) then raise exception 'Schedule charged or changed existing access/credit';end if;
 begin perform public.shop_billing_change_schedule(gen_random_uuid(),shop,low_terms);raise exception 'Second pending schedule accepted';
 exception when sqlstate '55000' then if sqlerrm<>'SHOP_CHANGE_ALREADY_SCHEDULED' then raise;end if;end;
 owner_claim:=current_setting('request.jwt.claim.sub');perform pg_temp.journey_owner();
 begin perform public.shop_billing_change_read(shop);raise exception 'Other tenant read schedule';exception when insufficient_privilege then if sqlerrm<>'SHOP_OWNER_REQUIRED' then raise;end if;end;
 begin perform public.shop_billing_change_preview(shop,low_terms);raise exception 'Other tenant previewed change';exception when insufficient_privilege then if sqlerrm<>'SHOP_OWNER_REQUIRED' then raise;end if;end;
 begin perform public.shop_billing_change_schedule(request,shop,low_terms);raise exception 'Other tenant replayed schedule';exception when insufficient_privilege then if sqlerrm<>'SHOP_OWNER_REQUIRED' then raise;end if;end;
 begin perform public.shop_billing_change_cancel(shop,(scheduled->>'id')::uuid);raise exception 'Other tenant cancelled schedule';exception when insufficient_privilege then if sqlerrm<>'SHOP_OWNER_REQUIRED' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',owner_claim,true);
 scheduled:=public.shop_billing_change_cancel(shop,(scheduled->>'id')::uuid);
 if scheduled->>'state'<>'cancelled' or public.shop_billing_change_cancel(shop,(scheduled->>'id')::uuid)->>'state'<>'cancelled' then raise exception 'Cancel not idempotent';end if;
 if (select count(*) from public.shop_scheduled_plan_changes where subscription_id=sub.id)<>1 then raise exception 'Cancelled history deleted';end if;

 -- Deterministic expired-source fixture with a previously scheduled intent.
 -- Only this disposable source date is aged; immutable receipts are untouched.
 perform set_config('shop.billing_approval','approved',true);
 update public.subscriptions set current_period_start=clock_timestamp()-interval '2 months',current_period_end=clock_timestamp()-interval '1 month',updated_at=clock_timestamp() where id=sub.id;
 select * into sub from public.subscriptions where id=sub.id;
 insert into public.shop_scheduled_plan_changes(request_id,shop_id,subscription_id,actor_user_id,catalog_terms_id,target,subscription_before,effective_at)
 values(gen_random_uuid(),shop,sub.id,auth.uid(),low_terms,shop_private.billing_public_target(sub,low_terms),to_jsonb(sub),sub.current_period_end) returning id into request;
 scheduled:=public.shop_billing_change_read(shop);
 if not (scheduled->>'canPayNow')::boolean then raise exception 'Expired owner cannot manually review scheduled term';end if;
 q:=public.shop_xpay_proration_quote(gen_random_uuid(),shop,low_terms);
 if q#>>'{calculation,mode}'<>'full_term' or (q#>>'{calculation,unusedPrepaidMinor}')::numeric<>0 then raise exception 'Next term invented unused expired value';end if;
 v_order:=(public.shop_xpay_proration_order(shop,(q->>'quoteId')::uuid)->>'id')::uuid;
 begin perform public.shop_billing_change_cancel(shop,request);raise exception 'Pending payment schedule cancelled';exception when sqlstate '55000' then if sqlerrm<>'SHOP_PRORATION_PAYMENT_UNRESOLVED' then raise;end if;end;
 result:=pg_temp.journey_paid(v_order);perform pg_temp.journey_paid(v_order);
 scheduled:=public.shop_billing_change_read(shop);
 select * into sub from public.subscriptions where id=sub.id;
 if result->>'state'<>'paid' or scheduled->>'state'<>'completed' or sub.catalog_terms_id<>low_terms
 or sub.current_period_end<>sub.current_period_start+interval '1 month'
 or (select count(*) from public.shop_xpay_payments p where p.order_id=v_order)<>1 then raise exception 'Manual scheduled settlement did not produce one term/completion';end if;
 insert into policy_quote_contracts values(public.shop_xpay_proration_read(shop,(q->>'quoteId')::uuid));
end $$;

-- The exact grandfathered two-year case: both verified annual receipts survive.
do $$declare shop uuid;low uuid;high uuid;highest uuid;monthly uuid;v_order uuid;sub public.subscriptions;q jsonb;funding jsonb;invalid_funding jsonb;before_end timestamptz;
begin
 shop:=pg_temp.journey_owner();
 select catalog_terms_id into low from public.shop_public_plan_catalog() where slug='journey-year-low' limit 1;
 select catalog_terms_id into high from public.shop_public_plan_catalog() where slug='journey-year-high' limit 1;
 select catalog_terms_id into monthly from public.shop_public_plan_catalog() where slug='journey-month-low' limit 1;
 update shop_private.proration_configuration set enabled=false where singleton;
 for i in 1..2 loop
 if i=2 then perform set_config('request.headers',jsonb_build_object('x-shop-payment-intent','renew','x-shop-prior-paid-order',v_order)::text,true);end if;
 v_order:=(pg_temp.historical_order_create(gen_random_uuid(),shop,low)->>'id')::uuid;perform pg_temp.journey_paid(v_order);
 end loop;
 update shop_private.proration_configuration set enabled=true where singleton;
 select s.* into sub from public.subscriptions s join public.shop_memberships m on m.profile_id=s.profile_id where m.shop_id=shop and m.role='owner';before_end:=sub.current_period_end;
 if public.shop_billing_change_preview(shop,monthly)->>'timing'<>'term_end' then raise exception 'Annual-to-monthly not deferred';end if;
 begin perform public.shop_xpay_proration_quote(gen_random_uuid(),shop,monthly);raise exception 'Annual-to-monthly immediate quote accepted';exception when sqlstate '55000' then if sqlerrm<>'SHOP_CHANGE_AT_PERIOD_END' then raise;end if;end;
 q:=public.shop_xpay_proration_quote(gen_random_uuid(),shop,high);
 if q#>>'{calculation,pricingBasis}'<>'verified_funded_term_segments' or jsonb_array_length(q#>'{calculation,serviceSegments}')<>2
 or (q#>>'{calculation,periodEnd}')::timestamptz<>before_end or (q#>>'{calculation,amountDueMinor}')::bigint not between 839999 and 840000
 then raise exception 'Grandfathered upgrade not priced over both actual funded terms';end if;
 v_order:=(public.shop_xpay_proration_order(shop,(q->>'quoteId')::uuid)->>'id')::uuid;perform pg_temp.journey_paid(v_order);perform pg_temp.journey_paid(v_order);
 select * into sub from public.subscriptions where id=sub.id;
 if sub.current_period_end<>before_end or (select count(*) from public.shop_xpay_payments p join public.shop_xpay_orders o on o.id=p.order_id where o.subscription_id=sub.id)<>3
 then raise exception 'Upgrade lost historical time/receipts or duplicated payment';end if;
 funding:=shop_private.proration_funding(sub,clock_timestamp());
 if jsonb_array_length(funding->'evidence')<>1 or jsonb_array_length(funding#>'{evidence,0,serviceSegments}')<>2 then raise exception 'Segmented allocation not retained for subsequent remaining-value credit';end if;
 insert into policy_quote_contracts values(public.shop_xpay_proration_read(shop,(q->>'quoteId')::uuid));
 -- Further upgrade consumes only the allocation, never the old receipts again.
 insert into public.plans(portal_id,name,slug,price_amount,currency,billing_interval,trial_days,features,resource_limits,is_active,is_public,is_purchasable,is_coming_soon)
 select portal_id,'Journey annual highest','journey-year-highest',12588,'EGP','annual',7,features,resource_limits,true,true,true,false from public.plans where slug='journey-year-high';
 perform shop_private.reconcile_plan_catalog();
 select catalog_terms_id into highest from public.shop_public_plan_catalog() where slug='journey-year-highest' limit 1;
 q:=public.shop_xpay_proration_quote(gen_random_uuid(),shop,highest);
 if q#>>'{calculation,pricingBasis}'<>'verified_funded_term_segments' or (q#>>'{calculation,amountDueMinor}')::bigint not between 839998 and 840000
 then raise exception 'Second upgrade double-counted receipts or lost funded term span';end if;
 -- Malformed allocation evidence must not supply custom/gapped paid time.
 invalid_funding:=jsonb_set(funding,'{evidence,0,serviceSegments,1,termStart}',to_jsonb((sub.current_period_start+interval '1 year 1 day')::text));
 begin perform shop_private.proration_segmented_upgrade(sub,clock_timestamp(),1258800,invalid_funding,q->'calculation');raise exception 'Gapped paid segments accepted';exception when sqlstate '22023' then if sqlerrm<>'SHOP_PRORATION_PERIOD_UNSUPPORTED' then raise;end if;end;
 invalid_funding:=jsonb_set(funding,'{evidence,0,serviceSegments,0,termEnd}',to_jsonb((sub.current_period_start+interval '1 year 1 day')::text));
 begin perform shop_private.proration_segmented_upgrade(sub,clock_timestamp(),1258800,invalid_funding,q->'calculation');raise exception 'Custom paid segment accepted';exception when sqlstate '22023' then if sqlerrm<>'SHOP_PRORATION_PERIOD_UNSUPPORTED' then raise;end if;end;
 v_order:=(public.shop_xpay_proration_order(shop,(q->>'quoteId')::uuid)->>'id')::uuid;perform pg_temp.journey_paid(v_order);perform pg_temp.journey_paid(v_order);
 select * into sub from public.subscriptions where id=sub.id;
 if sub.current_period_end<>before_end or (select count(*) from public.shop_xpay_payments p join public.shop_xpay_orders o on o.id=p.order_id where o.subscription_id=sub.id)<>4 then raise exception 'Second upgrade rewrote history/time or duplicated settlement';end if;
 insert into policy_quote_contracts values(public.shop_xpay_proration_read(shop,(q->>'quoteId')::uuid));
end $$;

-- Expired owners resolve excess quotas through existing suspend/archive commands.
do $$declare shop uuid;other_shop uuid;owner_id uuid;staff_id uuid;staff_profile uuid;membership uuid;branch uuid;high uuid;low uuid;v_order uuid;s public.subscriptions;r jsonb;q jsonb;
begin
 insert into public.plans(portal_id,name,slug,price_amount,currency,billing_interval,trial_days,features,resource_limits,is_active,is_public,is_purchasable,is_coming_soon)
 select id,'Quota source','journey-quota-source',699,'EGP','monthly',7,'{}','{"active_locations":2,"active_members":8,"active_products":250,"active_services":50,"active_customers":500,"active_suppliers":50}',true,true,true,false from public.portals where key='shop-crm';
 perform shop_private.reconcile_plan_catalog();
 select catalog_terms_id into high from public.shop_public_plan_catalog() where slug='journey-quota-source' limit 1;
 select catalog_terms_id into low from public.shop_public_plan_catalog() where slug='journey-month-low' limit 1;
 shop:=pg_temp.journey_owner();owner_id:=auth.uid();
 update shop_private.proration_configuration set enabled=false where singleton;
 v_order:=(public.shop_xpay_order_create(gen_random_uuid(),shop,high)->>'id')::uuid;perform pg_temp.journey_paid(v_order);
 update shop_private.proration_configuration set enabled=true where singleton;
 branch:=public.save_shop_location(shop,null,'Extra retained branch');
 other_shop:=pg_temp.journey_owner();staff_id:=auth.uid();
 select id into staff_profile from public.profiles where user_id=staff_id and portal_id=(select id from public.portals where key='shop-crm');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 -- Synthetic member setup; all quota-resolution writes below use public RPCs.
 insert into public.shop_memberships(shop_id,profile_id,role) values(shop,staff_profile,'employee') returning id into membership;
 r:=public.shop_billing_change_schedule(gen_random_uuid(),shop,low);
 if jsonb_array_length(r->'blockers')<>2 then raise exception 'Excess team/branches not reported before due';end if;
 select subscription.* into s from public.subscriptions subscription join public.shop_memberships m on m.profile_id=subscription.profile_id where m.shop_id=shop and m.role='owner';
 perform set_config('shop.billing_approval','approved',true);
 update public.subscriptions set current_period_start=clock_timestamp()-interval '2 months',current_period_end=clock_timestamp()-interval '1 month',updated_at=clock_timestamp() where id=s.id;
 -- Preserve the cancelled intent; seed a separate past-due intent only in
 -- this disposable fixture, without rewriting its immutable schedule date.
 perform public.shop_billing_change_cancel(shop,(r->>'id')::uuid);
 select * into s from public.subscriptions where id=s.id;
 insert into public.shop_scheduled_plan_changes(request_id,shop_id,subscription_id,actor_user_id,catalog_terms_id,target,subscription_before,effective_at)
 values(gen_random_uuid(),shop,s.id,owner_id,low,shop_private.billing_public_target(s,low),to_jsonb(s),s.current_period_end);
 r:=public.shop_billing_change_read(shop);
 if (r->>'canPayNow')::boolean then raise exception 'Over-quota expired owner allowed payment';end if;
 begin perform public.shop_xpay_proration_quote(gen_random_uuid(),shop,low);raise exception 'Over-quota quote accepted';exception when check_violation then if sqlerrm<>'PLAN_CHANGE_BLOCKED' then raise;end if;end;
 perform public.manage_shop_member(gen_random_uuid(),shop,membership,'suspend');
 perform public.archive_shop_location(shop,branch);
 if not exists(select 1 from public.shop_memberships where id=membership and status='suspended' and removed_at is null)
 or not exists(select 1 from public.shop_locations where id=branch and status='archived') then raise exception 'Quota resolution deleted records or failed after expiry';end if;
 r:=public.shop_billing_change_read(shop);
 if not (r->>'canPayNow')::boolean or jsonb_array_length(r->'blockers')<>0 then raise exception 'Suspended/archived resources still block next term';end if;
 q:=public.shop_xpay_proration_quote(gen_random_uuid(),shop,low);
 if q#>>'{calculation,mode}'<>'full_term' then raise exception 'Resolved expired owner missing manual next-term quote';end if;
end $$;

-- Private deferred intent validates recipient/version/token and future validity.
do $$declare f journey_bridge;shop uuid;terms uuid;owner_id uuid;entry jsonb;payload jsonb;issued jsonb;scheduled jsonb;v_order uuid;offer uuid;duration interval;
begin
 select * into f from journey_bridge;shop:=pg_temp.journey_owner();owner_id:=auth.uid();
 select catalog_terms_id into terms from public.shop_public_plan_catalog() where slug='journey-month-high' limit 1;
 update shop_private.proration_configuration set enabled=false where singleton;
 v_order:=(public.shop_xpay_order_create(gen_random_uuid(),shop,terms)->>'id')::uuid;perform pg_temp.journey_paid(v_order);
 update shop_private.proration_configuration set enabled=true where singleton;
 foreach duration in array array[interval '1 day',interval '40 days'] loop
 offer:=gen_random_uuid();
 payload:=jsonb_build_object('offerId',offer,'offerVersion',3,'shopId',shop,'recipientUserId',owner_id,'targetBindingId',f.binding_id,'targetEnvironmentId',f.environment_id,'suit','shop-suit',
 'expiresAt',clock_timestamp()+duration,'planId',(select plan.id from public.plans plan join public.portals portal on portal.id=plan.portal_id where portal.key='shop-crm' and plan.slug='solo'),'displayName','Private deferred terms','billingInterval','monthly','currency','EGP','priceAmount',123.45,
 'resourceLimits','{"active_locations":1,"active_members":2,"active_products":10,"active_services":10,"active_customers":10,"active_suppliers":10}'::jsonb,'entitlements','{"appointments":true,"reports":false}'::jsonb);
 issued:=pg_temp.journey_dispatch('register_secure_private_offer',payload);
 entry:=jsonb_build_object('offerId',offer,'offerVersion',3,'targetBindingId',f.binding_id,'targetEnvironmentId',f.environment_id,'redemptionToken',issued#>>'{data,redemptionToken}');
 begin perform public.shop_billing_change_preview(shop,null,jsonb_set(entry,'{offerVersion}','99'));raise exception 'Wrong offer version accepted';exception when insufficient_privilege then if sqlerrm<>'SHOP_PRIVATE_OFFER_RECIPIENT_MISMATCH' then raise;end if;end;
 begin perform public.shop_billing_change_preview(shop,null,jsonb_set(entry,'{redemptionToken}',to_jsonb(repeat('A',43))));raise exception 'Wrong bearer token accepted';exception when insufficient_privilege then if sqlerrm<>'SHOP_PRIVATE_OFFER_TOKEN_INVALID' then raise;end if;end;
 if duration=interval '1 day' then
 begin perform public.shop_billing_change_schedule(gen_random_uuid(),shop,null,entry);raise exception 'Offer expiring before due accepted';exception when sqlstate '22023' then if sqlerrm<>'XPAY_OFFER_EXPIRING' then raise;end if;end;
 else
 scheduled:=public.shop_billing_change_schedule(gen_random_uuid(),shop,null,entry);
 if not (scheduled->>'needsOfferLink')::boolean or scheduled::text like '%'||(entry->>'redemptionToken')||'%'
 or exists(select 1 from public.shop_scheduled_plan_changes where private_offer_id=offer and private_offer_parameters?'redemptionToken') then raise exception 'Deferred offer leaked bearer';end if;
 perform pg_temp.journey_dispatch('revoke_secure_private_offer',entry-'redemptionToken');scheduled:=public.shop_billing_change_read(shop);
 if (scheduled->>'available')::boolean or (scheduled->>'canPayNow')::boolean or not (scheduled->>'canCancel')::boolean then raise exception 'Revoked schedule remained payable or lost cancel';end if;
 perform public.shop_billing_change_cancel(shop,(scheduled->>'id')::uuid);
 end if;
 end loop;
 if (select count(*) from public.shop_xpay_orders where shop_id=shop)<>1 then raise exception 'Private scheduling created payment';end if;
end $$;

do $$begin
 if not (select relrowsecurity from pg_class where oid='public.shop_scheduled_plan_changes'::regclass)
 or has_table_privilege('authenticated','public.shop_scheduled_plan_changes','SELECT')
 or has_table_privilege('service_role','public.shop_scheduled_plan_changes','UPDATE')
 or has_function_privilege('anon','public.shop_billing_change_schedule(uuid,uuid,uuid,jsonb)','EXECUTE')
 then raise exception 'Scheduled financial boundary exposed';end if;
end $$;

select jsonb_build_object('prorationContract',value) from policy_quote_contracts;
