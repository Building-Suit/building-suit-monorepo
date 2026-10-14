-- Integrate merged #292 opaque/nested intent verification with draft proration dispatch.
-- All hotfix authority, amount, merchant, session, mode and alias checks preserved.
-- XPay API 1.0: optional flat ID or expanded paymentIntent.id; opaque pi_* IDs.
-- CREATE OR REPLACE preserves the existing server-only grants.
create or replace function public.shop_xpay_apply_session(p_session jsonb,p_event_id text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.shop_xpay_orders; s public.subscriptions; payment public.shop_xpay_payments;
 observation public.shop_xpay_paid_observations; t public.plan_catalog_terms; start_at timestamptz; end_at timestamptz; review boolean; event public.shop_xpay_inbox; intent_id text; flat_id text; nested_id text;
begin
 perform shop_private.xpay_server_required();
 if jsonb_typeof(p_session) is distinct from 'object' or p_session->>'object' is distinct from 'checkout.session'
 or p_session->>'id' is null or p_session#>>'{metadata,orderId}' is null then
 raise exception 'XPAY_SESSION_INVALID' using errcode='22023'; end if;
 select * into o from public.shop_xpay_orders where id=(p_session#>>'{metadata,orderId}')::uuid;
 if o.id is null then
 -- Other uses of this merchant account are not Shop subscription payments.
 if p_event_id is not null then update public.shop_xpay_inbox set state='ignored',processed_at=clock_timestamp() where event_id=p_event_id; end if;
 return jsonb_build_object('state','ignored'); end if;
 perform shop_private.lock_all_plan_resources(o.shop_id);
 select * into s from public.subscriptions where id=o.subscription_id for update;
 select * into o from public.shop_xpay_orders where id=o.id for update;
 if p_session->>'merchantId' is distinct from o.merchant_id or p_session->>'currency' is distinct from o.currency
 or jsonb_typeof(p_session->'amountTotal') is distinct from 'number'
 or (p_session->>'amountTotal')::numeric is distinct from o.amount_minor::numeric
 or (p_session->>'livemode')::boolean is distinct from (o.mode='live')
 or p_session->>'id' is null or p_session->>'id' !~ ('^cs_'||o.mode||'_[A-Za-z0-9]+$')
 or (o.session_id is not null and o.session_id<>p_session->>'id') then
 raise exception 'XPAY_SESSION_MISMATCH' using errcode='22023'; end if;
 if p_event_id is not null then
 select * into event from public.shop_xpay_inbox where event_id=p_event_id for update;
 if event.event_id is null or event.session_id<>p_session->>'id' or event.merchant_id<>o.merchant_id or event.mode<>o.mode then
 raise exception 'XPAY_EVENT_MISMATCH' using errcode='22023'; end if;
 end if;
 -- Recover a lost session-bind response from the authenticated provider lookup.
 if o.session_id is null then update public.shop_xpay_orders set session_id=p_session->>'id' where id=o.id returning * into o; end if;
 if p_session->>'status'='open' and p_session->>'paymentStatus'='unpaid' and o.checkout_url is null then
 if p_session->>'url' is distinct from ('https://checkout.xpay.app/c/'||(p_session->>'id'))
 or (p_session->>'isExpired')::boolean is distinct from false or p_session->>'expiresAt' is null
 or not isfinite((p_session->>'expiresAt')::timestamptz) or (p_session->>'expiresAt')::timestamptz<=clock_timestamp() then
 raise exception 'XPAY_SESSION_UNAVAILABLE' using errcode='22023'; end if;
 update public.shop_xpay_orders set checkout_url=p_session->>'url',expires_at=(p_session->>'expiresAt')::timestamptz,
 updated_at=clock_timestamp() where id=o.id returning * into o;
 end if;
 if p_session->>'paymentStatus'='paid' then
 -- IDs are opaque. Mode was verified above from the authenticated session.
 flat_id:=p_session->>'paymentIntentId';
 nested_id:=p_session#>>'{paymentIntent,id}';
 intent_id:=coalesce(flat_id,nested_id);
 if (flat_id is not null and (jsonb_typeof(p_session->'paymentIntentId')<>'string' or length(flat_id)>255 or flat_id !~ '^pi_[A-Za-z0-9_]+$'))
 or (nested_id is not null and (jsonb_typeof(p_session#>'{paymentIntent,id}')<>'string' or length(nested_id)>255 or nested_id !~ '^pi_[A-Za-z0-9_]+$'))
 or (flat_id is not null and nested_id is not null and flat_id<>nested_id) then
 raise exception 'XPAY_PAYMENT_NOT_VERIFIED' using errcode='22023'; end if;
 if p_session->>'status' is distinct from 'complete' or intent_id is null then
 raise exception 'XPAY_PAYMENT_NOT_VERIFIED' using errcode='22023'; end if;
 insert into public.shop_xpay_paid_observations(order_id,session_id,payment_intent_id,merchant_id,mode,amount_minor,currency)
 values(o.id,o.session_id,intent_id,o.merchant_id,o.mode,o.amount_minor,o.currency) on conflict(order_id) do nothing;
 select * into observation from public.shop_xpay_paid_observations where order_id=o.id;
 if observation.payment_intent_id<>intent_id or observation.session_id<>o.session_id then
 raise exception 'XPAY_PAYMENT_ALREADY_BOUND' using errcode='22023'; end if;
 if o.quote->>'prorationQuoteId' is not null then
 perform shop_private.proration_settle((o.quote->>'prorationQuoteId')::uuid,o.id);
 if p_event_id is not null then update public.shop_xpay_inbox set state='processed',processed_at=clock_timestamp() where event_id=p_event_id;end if;
 select * into o from public.shop_xpay_orders where id=o.id;
 return shop_private.xpay_order_view(o);
 end if;
 select * into payment from public.shop_xpay_payments where order_id=o.id;
 if payment.id is not null then
 if payment.payment_intent_id<>intent_id then raise exception 'XPAY_PAYMENT_ALREADY_BOUND' using errcode='22023'; end if;
 else
 select * into t from public.plan_catalog_terms where id=o.catalog_terms_id;
 review:=to_jsonb(s) is distinct from o.subscription_before
 or not exists(select 1 from public.shop_memberships m join public.profiles p on p.id=m.profile_id
 where m.shop_id=o.shop_id and m.profile_id=s.profile_id and m.role='owner' and m.status='active' and p.user_id=o.actor_user_id)
 or exists(select 1 from public.shops where id=o.shop_id and status<>'active')
 or jsonb_array_length(shop_private.plan_change_blockers(o.shop_id,t.resource_limits))>0
 or exists(select 1 from public.subscription_plan_change_requests where subscription_id=s.id and from_plan_id=s.plan_id and from_catalog_terms_id=s.catalog_terms_id);
 if o.private_offer_id is not null then
 review:=review or exists(select 1 from public.shop_private_offer_revocations where offer_id=o.private_offer_id)
 or exists(select 1 from public.shop_private_offer_redemptions where offer_id=o.private_offer_id)
 or exists(select 1 from public.shop_xpay_orders where private_offer_id=o.private_offer_id and state='paid' and id<>o.id);
 end if;
 if review then
 update public.shop_xpay_orders set state='requires_review',updated_at=clock_timestamp() where id=o.id returning * into o;
 -- Money is real, but concurrent admin changes/usage/offer revocation must not
 -- silently overwrite access. No automatic refund or second credit.
 if p_event_id is not null then update public.shop_xpay_inbox set state='processed',processed_at=clock_timestamp() where event_id=p_event_id; end if;
 return shop_private.xpay_order_view(o);
 end if;
 start_at:=case when s.status='active' and s.current_period_end>clock_timestamp() then s.current_period_end else clock_timestamp() end;
 end_at:=start_at+case t.billing_interval when 'monthly' then interval '1 month' when 'quarterly' then interval '3 months' when 'annual' then interval '1 year' end;
 if end_at is null then raise exception 'XPAY_INTERVAL_INVALID' using errcode='22023'; end if;
 -- The immutable payment receipt is the precise trigger authority within this
 -- transaction. A later failure rolls back receipt, access, period and order.
 insert into public.shop_xpay_payments(order_id,session_id,payment_intent_id,merchant_id,mode,amount_minor,currency,period_start,period_end,snapshot)
 values(o.id,o.session_id,intent_id,o.merchant_id,o.mode,o.amount_minor,o.currency,start_at,end_at,o.quote) returning * into payment;
 perform set_config('shop.xpay_fulfillment_order_id',o.id::text,true);
 update public.subscriptions set plan_id=t.plan_id,catalog_terms_id=t.id,status='active',
 current_period_start=case when s.status='active' and s.current_period_end>clock_timestamp() then s.current_period_start else start_at end,
 current_period_end=end_at,locked_at=null,updated_at=clock_timestamp() where id=s.id;
 insert into public.subscription_commercial_periods(subscription_id,catalog_terms_id,plan_slug,plan_name,plan_variant,billing_interval,currency,
 price_amount,list_price_amount,price_override_id,resource_limits,period_start,period_end,approved_at,xpay_order_id,offer_entitlements)
 values(s.id,t.id,o.quote->>'planSlug',t.display_name,t.plan_variant,t.billing_interval,t.currency,o.amount_minor::numeric/100,
 (o.quote->>'listPriceAmount')::numeric,(o.quote->>'priceOverrideId')::uuid,t.resource_limits,start_at,end_at,clock_timestamp(),o.id,t.offer_entitlements);
 update public.shop_xpay_orders set state='paid',updated_at=clock_timestamp() where id=o.id returning * into o;
 end if;
 elsif o.state not in ('paid','requires_review') then
 update public.shop_xpay_orders set state=case
 when p_session->>'status'='expired' then 'expired'
 when p_event_id is not null and event.event_type='checkout.session.async_payment_failed' and p_session->>'paymentStatus'='unpaid' then 'failed'
 when p_session->>'status'='complete' and p_session->>'paymentStatus'='unpaid' then 'pending'
 else 'open' end,updated_at=clock_timestamp() where id=o.id returning * into o;
 end if;
 if o.quote->>'prorationQuoteId' is not null and o.state in ('expired','failed') then update public.shop_proration_quotes set state='abandoned' where id=(o.quote->>'prorationQuoteId')::uuid and state='checkout';end if;
 if p_event_id is not null then update public.shop_xpay_inbox set state='processed',processed_at=clock_timestamp() where event_id=p_event_id; end if;
 return shop_private.xpay_order_view(o);
end $$;
