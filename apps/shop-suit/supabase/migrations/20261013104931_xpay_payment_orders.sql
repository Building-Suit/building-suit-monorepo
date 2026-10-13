-- XPay API 1.0: orders are server quoted; only verified service-side paid
-- observations can create a commercial period. No existing evidence is deleted.
create table shop_private.xpay_configuration (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 merchant_id text not null check(length(merchant_id) between 1 and 255),
 mode text not null check(mode in ('test','live')),
 updated_at timestamptz not null default clock_timestamp()
);
alter table shop_private.xpay_configuration enable row level security;
revoke all on shop_private.xpay_configuration from public,anon,authenticated,service_role;
-- Configuration remains absent/disabled until secure merchant setup. No seed key.
create table public.shop_xpay_orders (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 shop_id uuid not null references public.shops(id) on delete restrict,
 subscription_id uuid not null references public.subscriptions(id) on delete restrict,
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 merchant_id text not null, mode text not null check(mode in ('test','live')),
 catalog_terms_id uuid not null references public.plan_catalog_terms(id) on delete restrict,
 private_offer_id uuid references public.shop_private_offers(id) on delete restrict,
 quote jsonb not null, subscription_before jsonb not null,
 amount_minor bigint not null check(amount_minor between 1 and 999999999999),
 currency text not null check(currency='EGP'),
 state text not null default 'creating' check(state in ('creating','open','pending','expired','failed','paid','requires_review')),
 session_id text unique, checkout_url text, expires_at timestamptz, session_request jsonb,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 check ((session_id is null and checkout_url is null) or session_id is not null)
);
create unique index shop_xpay_one_open_subscription on public.shop_xpay_orders(subscription_id)
 where state in ('creating','open','pending','requires_review');
create index shop_xpay_orders_shop_created on public.shop_xpay_orders(shop_id,created_at desc);
create index shop_xpay_orders_reconcile on public.shop_xpay_orders(updated_at) where state in ('creating','open','pending','requires_review');
alter table public.shop_xpay_orders enable row level security;
revoke all on public.shop_xpay_orders from public,anon,authenticated,service_role;
create table public.shop_xpay_inbox (
 event_id text primary key check(length(event_id) between 1 and 255),
 event_type text not null, session_id text not null, merchant_id text not null,
 mode text not null check(mode in ('test','live')), payload_digest text not null check(payload_digest ~ '^[a-f0-9]{64}$'),
 state text not null default 'pending' check(state in ('pending','processed','ignored')),
 received_at timestamptz not null default clock_timestamp(), processed_at timestamptz
);
create index shop_xpay_inbox_pending on public.shop_xpay_inbox(received_at) where state='pending';
alter table public.shop_xpay_inbox enable row level security;
revoke all on public.shop_xpay_inbox from public,anon,authenticated,service_role;
create table public.shop_xpay_paid_observations (
 order_id uuid primary key references public.shop_xpay_orders(id) on delete restrict,
 session_id text not null unique, payment_intent_id text not null unique,
 merchant_id text not null,mode text not null,amount_minor bigint not null,currency text not null,
 verified_at timestamptz not null default clock_timestamp()
);
alter table public.shop_xpay_paid_observations enable row level security;
revoke all on public.shop_xpay_paid_observations from public,anon,authenticated,service_role;
create trigger shop_xpay_paid_observations_immutable before update or delete or truncate on public.shop_xpay_paid_observations
 for each statement execute function shop_private.reject_commercial_snapshot_mutation();
create table public.shop_xpay_payments (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.shop_xpay_orders(id) on delete restrict,
 session_id text not null unique, payment_intent_id text not null unique,
 merchant_id text not null, mode text not null,
 amount_minor bigint not null, currency text not null,
 period_start timestamptz not null, period_end timestamptz not null check(period_end>period_start),
 verified_at timestamptz not null default clock_timestamp(),
 snapshot jsonb not null
);
alter table public.shop_xpay_payments enable row level security;
revoke all on public.shop_xpay_payments from public,anon,authenticated,service_role;
create trigger shop_xpay_payments_immutable before update or delete or truncate on public.shop_xpay_payments
 for each statement execute function shop_private.reject_commercial_snapshot_mutation();
alter table public.subscription_commercial_periods add column xpay_order_id uuid unique references public.shop_xpay_orders(id) on delete restrict;

create function shop_private.xpay_server_required() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'XPAY_SERVER_REQUIRED' using errcode='42501'; end if;
end $$;
create function shop_private.xpay_order_view(o public.shop_xpay_orders) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',o.id,'idempotencyKey',o.request_id,'shopId',o.shop_id,'merchantId',o.merchant_id,'mode',o.mode,
 'amountMinor',o.amount_minor,'currency',o.currency,'description',o.quote->>'planName','state',o.state,'sessionId',o.session_id,
 'url',o.checkout_url,'expiresAt',o.expires_at,'createdAt',o.created_at,'quote',o.quote,
 'expiresAfterMinutes',30,'sessionRequest',o.session_request);
$$;
create function public.shop_xpay_order_read(p_shop_id uuid,p_order_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not shop_private.is_owner(p_shop_id) then raise exception 'SHOP_OWNER_REQUIRED' using errcode='42501'; end if;
 select coalesce(jsonb_agg(shop_private.xpay_order_view(o) order by o.created_at desc),'[]'::jsonb) into result
 from (select * from public.shop_xpay_orders where shop_id=p_shop_id and (p_order_id is null or id=p_order_id)
 order by created_at desc limit 20) o;
 return result;
end $$;
create function public.shop_xpay_order_create(p_request_id uuid,p_shop_id uuid,p_catalog_terms_id uuid,
 p_private_offer jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions; o public.shop_xpay_orders; c shop_private.xpay_configuration;
 t public.plan_catalog_terms; q jsonb; offer public.shop_private_offers; preview jsonb; amount numeric;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null or not shop_private.is_owner(p_shop_id) then
 raise exception 'SHOP_OWNER_REQUIRED' using errcode='42501'; end if;
 if p_request_id is null or (p_catalog_terms_id is null)=(p_private_offer is null) then raise exception 'XPAY_QUOTE_INVALID' using errcode='22023'; end if;
 perform shop_private.lock_all_plan_resources(p_shop_id);
 select subscription.* into s from public.shop_memberships m join public.subscriptions subscription on subscription.profile_id=m.profile_id
 where m.shop_id=p_shop_id and m.role='owner' and m.status='active' and exists(select 1 from public.profiles p where p.id=m.profile_id and p.user_id=auth.uid())
 order by m.created_at,m.id limit 1 for update of subscription;
 if s.id is null then raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode='22023'; end if;
 if s.status='suspended' or exists(select 1 from public.shops where id=p_shop_id and status<>'active') then
 raise exception 'XPAY_ACCESS_SUSPENDED' using errcode='42501'; end if;
 if p_private_offer is not null then
 if jsonb_typeof(p_private_offer) is distinct from 'object' or (p_private_offer-array['offerId','offerVersion','targetBindingId','targetEnvironmentId','redemptionToken'])<>'{}'::jsonb then
 raise exception 'XPAY_PRIVATE_OFFER_INVALID' using errcode='22023'; end if;
 preview:=public.shop_private_offer_read(p_shop_id,(p_private_offer->>'offerId')::uuid,(p_private_offer->>'offerVersion')::integer,
 (p_private_offer->>'targetBindingId')::uuid,(p_private_offer->>'targetEnvironmentId')::uuid,p_private_offer->>'redemptionToken');
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into o from public.shop_xpay_orders where request_id=p_request_id;
 if found then
 if o.shop_id<>p_shop_id or o.actor_user_id<>auth.uid()
 or (p_catalog_terms_id is not null and o.catalog_terms_id<>p_catalog_terms_id)
 or (p_private_offer is not null and (o.private_offer_id is distinct from (preview->>'offerId')::uuid
 or o.quote->'offerBinding' is distinct from preview-array['submissionId','blockers']))
 then raise exception 'XPAY_REQUEST_KEY_REUSED' using errcode='22023'; end if;
 -- Private offer token authority is rechecked below on new requests; replay must
 -- still require the same owner, and never change a persisted quote.
 return shop_private.xpay_order_view(o);
 end if;
 select * into c from shop_private.xpay_configuration where singleton and enabled;
 if not found then raise exception 'XPAY_NOT_CONFIGURED' using errcode='55000'; end if;
 if exists(select 1 from public.shop_xpay_orders where subscription_id=s.id and state in ('creating','open','pending','requires_review')) then
 raise exception 'XPAY_ORDER_ALREADY_OPEN' using errcode='55000'; end if;
 if exists(select 1 from public.shop_billing_submissions where shop_id=p_shop_id and status in ('submitted','under_review')) then
 raise exception 'XPAY_HISTORICAL_REVIEW_OPEN' using errcode='55000'; end if;
 if p_private_offer is null then
 select terms.* into t from public.plan_catalog_terms terms join public.plans plan on plan.id=terms.plan_id
 join public.portals portal on portal.id=plan.portal_id
 where terms.id=p_catalog_terms_id and portal.key='shop-crm' and terms.private_offer_id is null
 and plan.is_active and plan.is_public and plan.is_purchasable and not plan.is_coming_soon
 and exists(select 1 from shop_private.current_plan_offers(plan.id) current_terms where current_terms.id=terms.id);
 if t.id is null then raise exception 'PLAN_UNAVAILABLE' using errcode='22023'; end if;
 q:=shop_private.subscription_effective_price(s.id,t.id,clock_timestamp());
 else
 if jsonb_typeof(p_private_offer) is distinct from 'object' or (p_private_offer-array['offerId','offerVersion','targetBindingId','targetEnvironmentId','redemptionToken'])<>'{}'::jsonb then
 raise exception 'XPAY_PRIVATE_OFFER_INVALID' using errcode='22023'; end if;
 preview:=public.shop_private_offer_read(p_shop_id,(p_private_offer->>'offerId')::uuid,(p_private_offer->>'offerVersion')::integer,
 (p_private_offer->>'targetBindingId')::uuid,(p_private_offer->>'targetEnvironmentId')::uuid,p_private_offer->>'redemptionToken');
 select * into offer from public.shop_private_offers where id=(preview->>'offerId')::uuid for update;
 if preview->>'submissionId' is not null or exists(select 1 from public.shop_xpay_orders where private_offer_id=offer.id and state='paid') then
 raise exception 'XPAY_OFFER_ALREADY_PAID' using errcode='55000'; end if;
 select * into t from public.plan_catalog_terms where private_offer_id=offer.id;
 if t.id is null then
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(offer.plan_id::text,7));
 insert into public.plan_catalog_terms(plan_id,version,display_name,billing_interval,currency,price_amount,trial_days,resource_limits,is_public,is_purchasable,private_offer_id,plan_variant,variant_name)
 values(offer.plan_id,(select coalesce(max(version),0)+1 from public.plan_catalog_terms where plan_id=offer.plan_id),offer.display_name,offer.billing_interval,offer.currency,offer.price_amount,7,offer.resource_limits,false,false,offer.id,'private_offer',offer.display_name)
 returning * into t;
 end if;
 q:=jsonb_build_object('listPriceAmount',offer.price_amount,'effectivePriceAmount',offer.price_amount,'currency',offer.currency,'priceSource','private_offer');
 end if;
 if jsonb_array_length(shop_private.plan_change_blockers(p_shop_id,t.resource_limits))>0 then raise exception 'PLAN_CHANGE_BLOCKED' using errcode='23514'; end if;
 if offer.id is not null and offer.expires_at<clock_timestamp()+interval '31 minutes' then raise exception 'XPAY_OFFER_EXPIRING' using errcode='22023'; end if;
 amount:=(q->>'effectivePriceAmount')::numeric;
 if t.currency<>'EGP' or amount<=0 or amount<>round(amount,2) then raise exception 'XPAY_QUOTE_INVALID' using errcode='22023'; end if;
 q:=q||jsonb_build_object('planId',t.plan_id,'planName',t.display_name,'planSlug',(select slug from public.plans where id=t.plan_id),
 'catalogTermsId',t.id,'planVariant',t.plan_variant,'billingInterval',t.billing_interval,'resourceLimits',t.resource_limits,'entitlements',t.offer_entitlements,'offerBinding',preview-array['submissionId','blockers']);
 insert into public.shop_xpay_orders(request_id,shop_id,subscription_id,actor_user_id,merchant_id,mode,catalog_terms_id,private_offer_id,quote,subscription_before,amount_minor,currency)
 values(p_request_id,p_shop_id,s.id,auth.uid(),c.merchant_id,c.mode,t.id,offer.id,q,to_jsonb(s),(amount*100)::bigint,t.currency) returning * into o;
 return shop_private.xpay_order_view(o);
end $$;
create function public.shop_xpay_server_order(p_order_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.shop_xpay_orders;
begin
 perform shop_private.xpay_server_required();
 select * into o from public.shop_xpay_orders where id=p_order_id;
 if o.id is null then return null; end if;
 return shop_private.xpay_order_view(o);
end $$;
create function public.shop_xpay_bind_session(p_order_id uuid,p_session jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.shop_xpay_orders;
begin
 perform shop_private.xpay_server_required();
 select * into o from public.shop_xpay_orders where id=p_order_id for update;
 if o.id is null or p_session->>'object' is distinct from 'checkout.session' or p_session->>'merchantId' is distinct from o.merchant_id
 or p_session->>'currency' is distinct from o.currency or jsonb_typeof(p_session->'amountTotal') is distinct from 'number' or (p_session->>'amountTotal')::numeric is distinct from o.amount_minor::numeric
 or (p_session->>'livemode')::boolean is distinct from (o.mode='live') or p_session#>>'{metadata,orderId}' is distinct from o.id::text
 or p_session->>'id' is null or p_session->>'id' !~ ('^cs_'||o.mode||'_[A-Za-z0-9]+$') then raise exception 'XPAY_SESSION_MISMATCH' using errcode='22023'; end if;
 if o.session_id is not null then
 if o.session_id<>p_session->>'id' then raise exception 'XPAY_SESSION_ALREADY_BOUND' using errcode='22023'; end if;
 return shop_private.xpay_order_view(o); end if;
 if o.state<>'creating' or p_session->>'status' is distinct from 'open' or (p_session->>'isExpired')::boolean is distinct from false
 or p_session->>'expiresAt' is null or not isfinite((p_session->>'expiresAt')::timestamptz) or (p_session->>'expiresAt')::timestamptz<=clock_timestamp()
 or p_session->>'url' is distinct from ('https://checkout.xpay.app/c/'||(p_session->>'id')) then raise exception 'XPAY_SESSION_UNAVAILABLE' using errcode='22023'; end if;
 update public.shop_xpay_orders set session_id=p_session->>'id',checkout_url=p_session->>'url',expires_at=(p_session->>'expiresAt')::timestamptz,state='open',updated_at=clock_timestamp() where id=o.id returning * into o;
 return shop_private.xpay_order_view(o);
end $$;
create function public.shop_xpay_inbox_receive(p_event_id text,p_type text,p_session_id text,p_merchant_id text,p_mode text,p_digest text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.shop_xpay_inbox;
begin
 perform shop_private.xpay_server_required();
 if p_event_id is null or p_type is null or p_mode is null or p_session_id is null or p_digest is null or p_merchant_id is null or length(p_event_id) not between 1 and 255 or p_type not like 'checkout.session.%'
 or p_mode not in ('test','live') or p_session_id !~ ('^cs_'||p_mode||'_[A-Za-z0-9]+$') or p_digest !~ '^[a-f0-9]{64}$'
 or not exists(select 1 from shop_private.xpay_configuration where singleton and mode=p_mode and merchant_id=p_merchant_id)
 then raise exception 'XPAY_EVENT_INVALID' using errcode='22023'; end if;
 insert into public.shop_xpay_inbox(event_id,event_type,session_id,merchant_id,mode,payload_digest)
 values(p_event_id,p_type,p_session_id,p_merchant_id,p_mode,p_digest) on conflict(event_id) do nothing;
 select * into e from public.shop_xpay_inbox where event_id=p_event_id;
 if e.event_type<>p_type or e.session_id<>p_session_id or e.merchant_id<>p_merchant_id or e.mode<>p_mode or e.payload_digest<>p_digest
 then raise exception 'XPAY_EVENT_KEY_REUSED' using errcode='22023'; end if;
 return jsonb_build_object('processed',e.state<>'pending');
end $$;

create function public.shop_xpay_apply_session(p_session jsonb,p_event_id text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.shop_xpay_orders; s public.subscriptions; payment public.shop_xpay_payments;
 observation public.shop_xpay_paid_observations; t public.plan_catalog_terms; start_at timestamptz; end_at timestamptz; review boolean; event public.shop_xpay_inbox;
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
 if p_session->>'paymentStatus'='paid' then
 if p_session->>'status' is distinct from 'complete' or p_session->>'paymentIntentId' is null
 or p_session->>'paymentIntentId' !~ ('^pi_'||o.mode||'_[A-Za-z0-9]+$') then
 raise exception 'XPAY_PAYMENT_NOT_VERIFIED' using errcode='22023'; end if;
 insert into public.shop_xpay_paid_observations(order_id,session_id,payment_intent_id,merchant_id,mode,amount_minor,currency)
 values(o.id,o.session_id,p_session->>'paymentIntentId',o.merchant_id,o.mode,o.amount_minor,o.currency) on conflict(order_id) do nothing;
 select * into observation from public.shop_xpay_paid_observations where order_id=o.id;
 if observation.payment_intent_id<>p_session->>'paymentIntentId' or observation.session_id<>o.session_id then
 raise exception 'XPAY_PAYMENT_ALREADY_BOUND' using errcode='22023'; end if;
 select * into payment from public.shop_xpay_payments where order_id=o.id;
 if payment.id is not null then
 if payment.payment_intent_id<>p_session->>'paymentIntentId' then raise exception 'XPAY_PAYMENT_ALREADY_BOUND' using errcode='22023'; end if;
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
 values(o.id,o.session_id,p_session->>'paymentIntentId',o.merchant_id,o.mode,o.amount_minor,o.currency,start_at,end_at,o.quote) returning * into payment;
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
 if p_event_id is not null then update public.shop_xpay_inbox set state='processed',processed_at=clock_timestamp() where event_id=p_event_id; end if;
 return shop_private.xpay_order_view(o);
end $$;
create function public.shop_xpay_reconcile_candidates() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform shop_private.xpay_server_required();
 select coalesce(jsonb_agg(shop_private.xpay_order_view(o)),'[]'::jsonb) into result from
 (select orders.* from public.shop_xpay_orders orders join shop_private.xpay_configuration c
 on c.singleton and c.merchant_id=orders.merchant_id and c.mode=orders.mode
 where orders.state in ('creating','open','pending','requires_review')
 order by (orders.session_id is not null) desc,orders.updated_at limit 4) o;
 return result;
end $$;

-- Retirement removes only new subscription manual writes. Preserve legacy
-- records, review grants, evidence reads/signing and catalog/POS Storage.
revoke execute on function public.submit_shop_billing_notice(uuid,uuid,numeric,date,text),
 public.submit_shop_billing_notice(uuid,uuid,text,numeric,date,text),
 public.submit_shop_billing_notice(uuid,uuid,text,uuid,numeric,date,text),
 public.redeem_shop_private_offer(uuid,uuid,integer,uuid,uuid,uuid,numeric,date,text),
 public.redeem_shop_private_offer(uuid,uuid,integer,uuid,uuid,uuid,numeric,date,text,text),
 public.reserve_shop_billing_payment_evidence(uuid,text,text,bigint,text)
 from public,anon,authenticated,service_role;
alter policy shop_payment_evidence_owner_insert on storage.objects to authenticated with check(false);

revoke all on function shop_private.xpay_server_required(),shop_private.xpay_order_view(public.shop_xpay_orders)
 from public,anon,authenticated,service_role;
revoke all on function public.shop_xpay_order_read(uuid,uuid),public.shop_xpay_order_create(uuid,uuid,uuid,jsonb)
 from public,anon,service_role;
grant execute on function public.shop_xpay_order_read(uuid,uuid),public.shop_xpay_order_create(uuid,uuid,uuid,jsonb) to authenticated;
revoke all on function public.shop_xpay_server_order(uuid),public.shop_xpay_bind_session(uuid,jsonb),
 public.shop_xpay_inbox_receive(text,text,text,text,text,text),public.shop_xpay_apply_session(jsonb,text),public.shop_xpay_reconcile_candidates()
 from public,anon,authenticated;
grant execute on function public.shop_xpay_server_order(uuid),public.shop_xpay_bind_session(uuid,jsonb),
 public.shop_xpay_inbox_receive(text,text,text,text,text,text),public.shop_xpay_apply_session(jsonb,text),public.shop_xpay_reconcile_candidates()
 to service_role;

create or replace function shop_private.subscription_catalog_terms()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_shop_id uuid; v_limits jsonb; v_limit integer; v_usage bigint; v_resource text;
  v_operator_approval boolean := false;
begin
  if tg_op = 'INSERT' and auth.uid() is not null and not exists (
    select 1 from public.plans plan
    where plan.id = new.plan_id and plan.is_active and not plan.is_coming_soon
      and ((plan.is_public and plan.is_purchasable)
        or (plan.slug = 'full-product-trial' and new.status = 'trialing'))
  ) then raise exception 'PLAN_UNAVAILABLE' using errcode = '22023'; end if;
  if tg_op = 'UPDATE' then
    v_operator_approval := current_setting('shop.billing_approval', true) = 'approved'
      and (
        exists (select 1 from public.platform_admins administrator
          where administrator.user_id = auth.uid() and administrator.enabled
            and administrator.role = 'operator')
        or (auth.role() = 'service_role'
          and nullif(current_setting('shop.super_admin_bridge_principal_id', true), '') is not null)
      );
  end if;
  if tg_op='UPDATE' and auth.role()='service_role' and exists (
    select 1 from public.shop_xpay_payments payment join public.shop_xpay_orders o on o.id=payment.order_id
    where o.id::text=current_setting('shop.xpay_fulfillment_order_id',true)
    and o.subscription_id=old.id and o.subscription_before=to_jsonb(old)
    and o.catalog_terms_id=new.catalog_terms_id and (o.quote->>'planId')::uuid=new.plan_id
    and new.status='active' and new.current_period_end=payment.period_end
  ) then v_operator_approval:=true; end if;
  if tg_op = 'INSERT' or new.plan_id is distinct from old.plan_id
    or new.catalog_terms_id is null then
    if new.catalog_terms_id is not null then
      select terms.resource_limits into v_limits
      from public.plan_catalog_terms terms
      where terms.id = new.catalog_terms_id and terms.plan_id = new.plan_id
        and terms.effective_from <= clock_timestamp();
    end if;
    if v_limits is null then
      select terms.id, terms.resource_limits into new.catalog_terms_id, v_limits
      from shop_private.current_plan_terms(new.plan_id) terms;
    end if;
    if new.catalog_terms_id is null or v_limits is null then
      raise exception 'PLAN_COMMERCIAL_TERMS_NOT_FOUND' using errcode = '23503';
    end if;
  else
    select terms.resource_limits into v_limits from public.plan_catalog_terms terms
    where terms.id = new.catalog_terms_id and terms.plan_id = new.plan_id;
  end if;
  if tg_op = 'UPDATE' and old.catalog_terms_id is not null
    and new.catalog_terms_id is distinct from old.catalog_terms_id
    and new.plan_id = old.plan_id and not v_operator_approval then
    raise exception 'SUBSCRIPTION_TERMS_CHANGE_REQUIRES_PLAN_CHANGE' using errcode = '23514';
  end if;
  select membership.shop_id into v_shop_id from public.shop_memberships membership
  where membership.profile_id = new.profile_id and membership.role = 'owner'
  order by (membership.status = 'active') desc, membership.created_at, membership.id limit 1;
  if v_shop_id is not null and (tg_op = 'INSERT'
    or new.plan_id is distinct from old.plan_id
    or new.catalog_terms_id is distinct from old.catalog_terms_id) then
    perform shop_private.lock_all_plan_resources(v_shop_id);
    foreach v_resource in array array[
      'active_locations', 'active_members', 'active_products', 'active_services',
      'active_customers', 'active_suppliers'
    ] loop
      v_limit := (v_limits ->> v_resource)::integer;
      if v_limit is not null then
        v_usage := shop_private.plan_resource_usage(v_shop_id, v_resource);
        if v_usage > v_limit then
          raise exception 'PLAN_RESOURCE_LIMIT_EXCEEDED:%:%:%',
            v_resource, v_usage, v_limit using errcode = '23514';
        end if;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create or replace function shop_private.subscription_private_offer_binding()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_offer public.shop_private_offers; v_changed boolean;
begin
  select offer.* into v_offer from public.plan_catalog_terms terms
  join public.shop_private_offers offer on offer.id = terms.private_offer_id
  where terms.id = new.catalog_terms_id;
  if not found then return new; end if;
  if not exists (select 1 from public.profiles profile
    join public.shop_memberships membership on membership.profile_id = profile.id
    where profile.id = new.profile_id and profile.user_id = v_offer.recipient_user_id
      and membership.shop_id = v_offer.shop_id and membership.role = 'owner'
      and membership.status = 'active') then
    raise exception 'SHOP_PRIVATE_OFFER_RECIPIENT_MISMATCH' using errcode = '42501';
  end if;
  v_changed := tg_op = 'INSERT';
  if tg_op = 'UPDATE' then
    v_changed := new.catalog_terms_id is distinct from old.catalog_terms_id
      or new.profile_id is distinct from old.profile_id;
  end if;
  if v_changed and auth.role()='service_role' and exists (
    select 1 from public.shop_xpay_payments payment join public.shop_xpay_orders o on o.id=payment.order_id
    where o.id::text=current_setting('shop.xpay_fulfillment_order_id',true) and o.subscription_id=old.id
    and o.private_offer_id=v_offer.id and o.catalog_terms_id=new.catalog_terms_id
    and o.subscription_before=to_jsonb(old) and new.current_period_end=payment.period_end
  ) then return new; end if;
  if v_changed and (current_setting('shop.billing_approval', true) is distinct from 'approved'
    or shop_private.platform_admin_role() is distinct from 'operator'
    or not exists (select 1 from public.shop_billing_submissions notice
      join public.shop_private_offer_redemptions redemption on redemption.submission_id = notice.id
      where redemption.offer_id = v_offer.id and notice.shop_id = v_offer.shop_id
        and notice.catalog_terms_id = new.catalog_terms_id
        and notice.status in ('submitted','under_review'))) then
    raise exception 'SHOP_PRIVATE_OFFER_APPROVAL_REQUIRED' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function shop_private.freeze_offer_entitlements()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.offer_entitlements is distinct from old.offer_entitlements then raise exception 'SHOP_OFFER_ENTITLEMENTS_IMMUTABLE' using errcode='55000'; end if;
  return new;
 end if;
 if tg_table_name='plan_catalog_terms' then
  new.offer_entitlements:=coalesce((select entitlements from public.shop_private_offer_security where offer_id=new.private_offer_id),'{}'::jsonb);
 elsif tg_table_name='shop_billing_submissions' then
  new.offer_entitlements:=coalesce((select offer_entitlements from public.plan_catalog_terms where id=new.catalog_terms_id),'{}'::jsonb);
 elsif new.xpay_order_id is not null then
  new.offer_entitlements:=coalesce((select quote->'entitlements' from public.shop_xpay_orders where id=new.xpay_order_id),'{}'::jsonb);
 else
  new.offer_entitlements:=coalesce((select offer_entitlements from public.shop_billing_submissions where id=new.billing_submission_id),'{}'::jsonb);
 end if;
 return new;
end $$;

notify pgrst,'reload schema';

create or replace function shop_private.billing_subscription_snapshot(p_shop_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', subscription.id, 'status', subscription.status,
    'planId', plan.id, 'planSlug', plan.slug, 'planName', terms.display_name,
    'planVariant', terms.plan_variant, 'variantName', terms.variant_name,
    'priceAmount', (coalesce(paid.quote,price.quote) ->> 'effectivePriceAmount')::numeric,
    'listPriceAmount', (coalesce(paid.quote,price.quote) ->> 'listPriceAmount')::numeric,
    'effectivePriceAmount', (coalesce(paid.quote,price.quote) ->> 'effectivePriceAmount')::numeric,
    'priceSource', coalesce(paid.quote,price.quote) ->> 'priceSource',
    'priceOverrideId', coalesce(paid.quote,price.quote) ->> 'priceOverrideId',
    'priceOverrideReason', coalesce(paid.quote,price.quote) ->> 'priceOverrideReason',
    'priceOverrideEffectiveFrom', coalesce(paid.quote,price.quote) ->> 'priceOverrideEffectiveFrom',
    'priceOverrideExpiresAt', coalesce(paid.quote,price.quote) ->> 'priceOverrideExpiresAt',
    'currency', terms.currency, 'billingInterval', terms.billing_interval,
    'resourceLimits', terms.resource_limits,
    'trialStartAt', subscription.trial_start_at, 'trialEndAt', subscription.trial_end_at,
    'periodStart', subscription.current_period_start, 'periodEnd', subscription.current_period_end,
    'accessState', case
      when shop.status = 'suspended' then 'suspended'
      when subscription.status = 'trialing' and subscription.trial_end_at > now() then 'trialing'
      when subscription.status = 'active' and subscription.current_period_end > now() then 'active'
      else 'read_only' end,
    'trialDaysRemaining', case
      when subscription.status = 'trialing' and subscription.trial_end_at > now()
      then ceil(extract(epoch from subscription.trial_end_at - now()) / 86400.0)::integer else 0 end
  )
  from public.shops shop
  join public.shop_memberships membership on membership.shop_id = shop.id and membership.role = 'owner'
  join public.subscriptions subscription on subscription.profile_id = membership.profile_id
  join public.plans plan on plan.id = subscription.plan_id
  join public.plan_catalog_terms terms on terms.id = subscription.catalog_terms_id
  cross join lateral (select shop_private.subscription_effective_price(
    subscription.id, subscription.catalog_terms_id, clock_timestamp()) quote) price
  left join lateral (
    select payment.snapshot quote from public.shop_xpay_payments payment
    join public.shop_xpay_orders o on o.id=payment.order_id
    where o.subscription_id=subscription.id and o.catalog_terms_id=subscription.catalog_terms_id
      and payment.period_start<=clock_timestamp() and payment.period_end>clock_timestamp()
      and subscription.status='active'
    order by payment.period_start desc limit 1
  ) paid on true
  where shop.id = p_shop_id
  order by (membership.status = 'active') desc, membership.created_at, membership.id limit 1;
$$;

create function public.shop_xpay_prepare_session(p_order_id uuid,p_body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.shop_xpay_orders;
begin
 perform shop_private.xpay_server_required();
 select * into o from public.shop_xpay_orders where id=p_order_id for update;
 if o.id is null or jsonb_typeof(p_body) is distinct from 'object' then raise exception 'XPAY_SESSION_INVALID' using errcode='22023'; end if;
 if o.session_request is not null then return shop_private.xpay_order_view(o); end if;
 if o.state<>'creating' or o.created_at<clock_timestamp()-interval '23 hours' then raise exception 'XPAY_RECONCILIATION_REQUIRED' using errcode='55000'; end if;
 if o.private_offer_id is not null and (o.quote#>>'{offerBinding,expiresAt}')::timestamptz<clock_timestamp()+interval '31 minutes' then
 raise exception 'XPAY_OFFER_EXPIRING' using errcode='22023'; end if;
 update public.shop_xpay_orders set session_request=p_body,updated_at=clock_timestamp() where id=o.id returning * into o;
 return shop_private.xpay_order_view(o);
end $$;
revoke all on function public.shop_xpay_prepare_session(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.shop_xpay_prepare_session(uuid,jsonb) to service_role;

-- Preserve paid private-offer preview/history without manufacturing a manual
-- redemption or putting the bearer redemption token in an order snapshot.

create or replace function public.shop_private_offer_read(p_shop_id uuid,p_offer_id uuid,p_offer_version integer,
 p_target_binding_id uuid,p_target_environment_id uuid,p_redemption_token text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.shop_private_offers;s public.shop_private_offer_security;redeemed uuid; paid_order uuid;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null or not shop_private.is_owner(p_shop_id) then
  raise exception 'SHOP_OWNER_REQUIRED' using errcode='42501';end if;
 select * into o from public.shop_private_offers where id=p_offer_id;
 if o.id is null or o.recipient_user_id<>auth.uid() or o.shop_id<>p_shop_id
 or o.offer_version is distinct from p_offer_version or o.target_binding_id is distinct from p_target_binding_id
 or o.target_environment_id is distinct from p_target_environment_id then
  raise exception 'SHOP_PRIVATE_OFFER_RECIPIENT_MISMATCH' using errcode='42501';end if;
 select * into s from public.shop_private_offer_security where offer_id=o.id;
 if s.offer_id is null or p_redemption_token is null or p_redemption_token !~ '^[A-Za-z0-9_-]{43}$'
 or encode(extensions.digest(p_redemption_token,'sha256'),'hex') is distinct from s.token_digest then
  raise exception 'SHOP_PRIVATE_OFFER_TOKEN_INVALID' using errcode='42501';end if;
 if exists(select 1 from public.shop_private_offer_revocations where offer_id=o.id) then
  raise exception 'SHOP_PRIVATE_OFFER_REVOKED' using errcode='42501';end if;
 select submission_id into redeemed from public.shop_private_offer_redemptions where offer_id=o.id;
 select id into paid_order from public.shop_xpay_orders where private_offer_id=o.id and state='paid' order by created_at desc limit 1;
 if redeemed is null and paid_order is null and o.expires_at<=statement_timestamp() then
  raise exception 'SHOP_PRIVATE_OFFER_EXPIRED' using errcode='22023';end if;
 return jsonb_build_object('offerId',o.id,'offerVersion',o.offer_version,'shopId',o.shop_id,
 'targetBindingId',o.target_binding_id,'targetEnvironmentId',o.target_environment_id,
 'displayName',o.display_name,'priceAmount',o.price_amount,'currency',o.currency,
 'billingInterval',o.billing_interval,'expiresAt',o.expires_at,'resourceLimits',o.resource_limits,
 'entitlements',s.entitlements,'submissionId',redeemed,'xpayOrderId',paid_order,
 'blockers',shop_private.plan_change_blockers(o.shop_id,o.resource_limits));
end $$;
create unique index shop_xpay_one_paid_private_offer on public.shop_xpay_orders(private_offer_id) where private_offer_id is not null and state='paid';
create index shop_xpay_orders_subscription_history on public.shop_xpay_orders(subscription_id,created_at desc);
create index shop_xpay_orders_actor on public.shop_xpay_orders(actor_user_id);

create function shop_private.xpay_preserve_quote() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['state','session_id','checkout_url','expires_at','updated_at','session_request'])
 is distinct from (to_jsonb(old)-array['state','session_id','checkout_url','expires_at','updated_at','session_request'])
 or (old.session_id is not null and new.session_id is distinct from old.session_id)
 or (old.session_request is not null and new.session_request is distinct from old.session_request)
 or (old.state='paid' and new.state<>'paid') then
 raise exception 'XPAY_QUOTE_IMMUTABLE' using errcode='55000'; end if;
 return new;
end $$;
revoke all on function shop_private.xpay_preserve_quote() from public,anon,authenticated,service_role;
create trigger shop_xpay_orders_quote_immutable before update on public.shop_xpay_orders
 for each row execute function shop_private.xpay_preserve_quote();
