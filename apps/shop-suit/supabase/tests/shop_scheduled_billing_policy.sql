-- Disposable-only: real database contracts and synthetic provider observations.
-- The runner prepends journey plan/owner/payment helpers, never hosted fixtures.
create temporary table policy_quote_contracts(value jsonb);
do $$declare shop uuid;high_terms uuid;low_terms uuid;annual_low uuid;annual_high uuid;v_order uuid;sub public.subscriptions;
 before_sub jsonb;preview jsonb;scheduled jsonb;again jsonb;request uuid:=gen_random_uuid();q jsonb;result jsonb;
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
do $$declare shop uuid;low uuid;high uuid;monthly uuid;v_order uuid;sub public.subscriptions;q jsonb;funding jsonb;before_end timestamptz;
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
end $$;

do $$begin
 if not (select relrowsecurity from pg_class where oid='public.shop_scheduled_plan_changes'::regclass)
 or has_table_privilege('authenticated','public.shop_scheduled_plan_changes','SELECT')
 or has_table_privilege('service_role','public.shop_scheduled_plan_changes','UPDATE')
 or has_function_privilege('anon','public.shop_billing_change_schedule(uuid,uuid,uuid,jsonb)','EXECUTE')
 then raise exception 'Scheduled financial boundary exposed';end if;
end $$;

select jsonb_build_object('prorationContract',value) from policy_quote_contracts;
