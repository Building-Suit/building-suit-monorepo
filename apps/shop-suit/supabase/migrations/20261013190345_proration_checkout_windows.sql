-- Quote admission remains15minutes; accepted card orders get a bounded35minute
-- verification window for XPay's documented30minute minimum session lifetime.
-- Zero-credit confirmation still requires an unexpired quote. Every source,
-- funding/version, owner, quota, revocation and private-offer check remains.
-- Rollout gate remains OFF. No merchant/provider setting changes.
create or replace function shop_private.proration_validate(q public.shop_proration_quotes,s public.subscriptions,a public.shop_proration_credit_accounts) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 return q.subscription_before=to_jsonb(s) and a.version=q.credit_version and a.balance_minor=(q.calculation->>'creditBeforeMinor')::bigint
 and (q.expires_at>clock_timestamp() or (q.state in ('checkout','requires_review') and exists(
 select 1 from public.shop_xpay_orders accepted where accepted.id=q.xpay_order_id
 and accepted.created_at<=q.expires_at and accepted.session_request is not null
 and (accepted.session_request->>'expiresAfterMinutes')::integer=30
 and clock_timestamp()<=accepted.created_at+interval '35 minutes')))
 and (q.calculation->>'mode'<>'remaining_period' or (q.calculation->>'periodEnd')::timestamptz>clock_timestamp()) and shop_private.proration_funding(s,(q.calculation->>'quotedAt')::timestamptz)->'evidence'=q.funding_evidence
 and not exists(select 1 from public.shops where id=q.shop_id and status<>'active')
 and exists(select 1 from public.shop_memberships m join public.profiles p on p.id=m.profile_id where m.shop_id=q.shop_id and m.profile_id=s.profile_id and m.role='owner' and m.status='active' and p.user_id=q.actor_user_id)
 and jsonb_array_length(shop_private.plan_change_blockers(q.shop_id,q.commerce->'resourceLimits'))=0
 and not exists(select 1 from public.shop_billing_submissions where shop_id=q.shop_id and status in ('submitted','under_review'))
 and not exists(select 1 from public.shop_xpay_orders where subscription_id=s.id and state in ('creating','open','pending','requires_review') and id is distinct from q.xpay_order_id)
 and not exists(select 1 from public.subscription_plan_change_requests where subscription_id=s.id and from_plan_id=s.plan_id and from_catalog_terms_id=s.catalog_terms_id)
 and (q.private_offer_id is null or (not exists(select 1 from public.shop_private_offer_revocations where offer_id=q.private_offer_id)
 and not exists(select 1 from public.shop_private_offer_redemptions where offer_id=q.private_offer_id)
 and (q.commerce#>>'{offerBinding,expiresAt}')::timestamptz>clock_timestamp()
 and not exists(select 1 from public.shop_proration_settlements other join public.shop_proration_quotes oq on oq.id=other.quote_id where oq.private_offer_id=q.private_offer_id and oq.id<>q.id)));
end $$;
create or replace function public.shop_xpay_proration_quote(p_request_id uuid,p_shop_id uuid,p_catalog_terms_id uuid,p_private_offer jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;q public.shop_proration_quotes;a public.shop_proration_credit_accounts;
 commerce jsonb;parameters jsonb;funding jsonb;calculation jsonb;old_interval text;old_currency text;at timestamptz;target uuid;offer uuid;
begin
 s:=shop_private.proration_owner_subscription(p_shop_id);perform shop_private.proration_enabled();
 if p_request_id is null or (p_catalog_terms_id is null)=(p_private_offer is null) then raise exception 'XPAY_QUOTE_INVALID' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into q from public.shop_proration_quotes where request_id=p_request_id;
 if found then
 if q.shop_id<>p_shop_id or q.actor_user_id<>auth.uid() or q.parameters->>'catalogTermsId' is distinct from p_catalog_terms_id::text
 or q.parameters->'privateOffer' is distinct from coalesce(p_private_offer-'redemptionToken','null'::jsonb) then raise exception 'XPAY_REQUEST_KEY_REUSED' using errcode='22023';end if;
 -- Replays never reprice; private bearer authority is still checked without
 -- persisting it. Settled offers remain readable through settlement history.
 if p_private_offer is not null then perform public.shop_private_offer_read(p_shop_id,(p_private_offer->>'offerId')::uuid,(p_private_offer->>'offerVersion')::integer,(p_private_offer->>'targetBindingId')::uuid,(p_private_offer->>'targetEnvironmentId')::uuid,p_private_offer->>'redemptionToken');end if;
 return shop_private.proration_quote_view(q);
 end if;
 if exists(select 1 from public.shop_xpay_orders where subscription_id=s.id and state in ('creating','open','pending','requires_review')) then raise exception 'XPAY_ORDER_ALREADY_OPEN' using errcode='55000';end if;
 if exists(select 1 from public.shop_billing_submissions where shop_id=p_shop_id and status in ('submitted','under_review')) then raise exception 'XPAY_HISTORICAL_REVIEW_OPEN' using errcode='55000';end if;
 -- Unbound expired previews are safely abandoned; bound or paid-review quotes
 -- require explicit provider resolution and cannot be replaced by a new charge.
 update public.shop_proration_quotes set state='abandoned' where subscription_id=s.id and state='quoted' and expires_at<=clock_timestamp();
 if exists(select 1 from public.shop_proration_quotes where subscription_id=s.id and state in ('quoted','checkout','requires_review')) then raise exception 'SHOP_PRORATION_QUOTE_OPEN' using errcode='55000';end if;
 commerce:=shop_private.proration_target(p_shop_id,s.id,p_catalog_terms_id,p_private_offer);
 target:=(commerce->>'catalogTermsId')::uuid;offer:=(p_private_offer->>'offerId')::uuid;
 insert into public.shop_proration_credit_accounts(subscription_id) values(s.id) on conflict(subscription_id) do nothing;
 select * into a from public.shop_proration_credit_accounts where subscription_id=s.id for update;
 select billing_interval,currency into old_interval,old_currency from public.plan_catalog_terms where id=s.catalog_terms_id;
 if s.status='active' and s.current_period_end>clock_timestamp() and old_currency<>'EGP' then raise exception 'SHOP_PRORATION_CURRENCY_MISMATCH' using errcode='22023';end if;
 -- Composite prepaid cycles and custom grant durations need segmented pricing.
 -- Never silently use an extended access range as one monthly/yearly rate.
 if s.status='active' and s.current_period_end>clock_timestamp() and old_interval=commerce->>'billingInterval'
 and abs(extract(epoch from s.current_period_end-(s.current_period_start+case old_interval when 'monthly' then interval '1 month' when 'annual' then interval '1 year' end)))>1 then
 raise exception 'SHOP_PRORATION_PERIOD_UNSUPPORTED' using errcode='22023';end if;
 at:=clock_timestamp();funding:=shop_private.proration_funding(s,at);
 calculation:=shop_private.proration_quote_v1(at,case when s.status='trialing' and s.trial_end_at<=at then 'expired' else s.status end,
 funding->>'source',s.current_period_start,s.current_period_end,at,(funding->>'unusedMinor')::numeric,
 old_interval,commerce->>'billingInterval',((commerce->>'effectivePriceAmount')::numeric*100)::bigint,a.balance_minor,s.catalog_terms_id=target);
 parameters:=jsonb_build_object('catalogTermsId',p_catalog_terms_id,'privateOffer',p_private_offer-'redemptionToken');
 insert into public.shop_proration_quotes(request_id,shop_id,subscription_id,actor_user_id,catalog_terms_id,private_offer_id,parameters,subscription_before,credit_version,commerce,calculation,funding_evidence,expires_at)
 values(p_request_id,p_shop_id,s.id,auth.uid(),target,offer,parameters,to_jsonb(s),a.version,commerce,calculation,funding->'evidence',(calculation->>'expiresAt')::timestamptz) returning * into q;
 return shop_private.proration_quote_view(q);
end $$;
create or replace function public.shop_xpay_proration_order(p_shop_id uuid,p_quote_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;q public.shop_proration_quotes;a public.shop_proration_credit_accounts;o public.shop_xpay_orders;c shop_private.xpay_configuration;
begin
 s:=shop_private.proration_owner_subscription(p_shop_id);perform shop_private.proration_enabled();
 select * into a from public.shop_proration_credit_accounts where subscription_id=s.id for update;
 select * into q from public.shop_proration_quotes where id=p_quote_id and shop_id=p_shop_id and subscription_id=s.id and actor_user_id=auth.uid() for update;
 if q.id is null then raise exception 'SHOP_PRORATION_QUOTE_UNAVAILABLE' using errcode='42501';end if;
 if q.xpay_order_id is not null then select * into o from public.shop_xpay_orders where id=q.xpay_order_id;return shop_private.xpay_order_view(o);end if;
 if q.state<>'quoted' or not shop_private.proration_validate(q,s,a) then raise exception 'SHOP_PRORATION_QUOTE_STALE' using errcode='55000';end if;
 if (q.calculation->>'amountDueMinor')::bigint=0 then raise exception 'SHOP_PRORATION_CREDIT_CONFIRMATION_REQUIRED' using errcode='55000';end if;
 if q.private_offer_id is not null and (q.commerce#>>'{offerBinding,expiresAt}')::timestamptz<clock_timestamp()+interval '31 minutes' then raise exception 'XPAY_OFFER_EXPIRING' using errcode='22023';end if;
 select * into c from shop_private.xpay_configuration where singleton and enabled;
 if not found then raise exception 'XPAY_NOT_CONFIGURED' using errcode='55000';end if;
 if exists(select 1 from public.shop_xpay_orders where subscription_id=s.id and state in ('creating','open','pending','requires_review')) then raise exception 'XPAY_ORDER_ALREADY_OPEN' using errcode='55000';end if;
 insert into public.shop_xpay_orders(request_id,shop_id,subscription_id,actor_user_id,merchant_id,mode,catalog_terms_id,private_offer_id,quote,subscription_before,amount_minor,currency)
 values(q.request_id,q.shop_id,q.subscription_id,q.actor_user_id,c.merchant_id,c.mode,q.catalog_terms_id,q.private_offer_id,
 q.commerce||jsonb_build_object('prorationQuoteId',q.id,'proration',q.calculation),q.subscription_before,(q.calculation->>'amountDueMinor')::bigint,'EGP') returning * into o;
 update public.shop_proration_quotes set state='checkout',xpay_order_id=o.id where id=q.id;
 return shop_private.xpay_order_view(o);
end $$;
create or replace function shop_private.proration_target(p_shop_id uuid,p_subscription_id uuid,p_catalog_terms_id uuid,p_private_offer jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;t public.plan_catalog_terms;q jsonb;offer public.shop_private_offers;preview jsonb;amount numeric;
begin
 select * into s from public.subscriptions where id=p_subscription_id;
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
 if preview->>'submissionId' is not null or exists(select 1 from public.shop_proration_quotes pq join public.shop_proration_settlements ps on ps.quote_id=pq.id where pq.private_offer_id=offer.id) or exists(select 1 from public.shop_xpay_orders where private_offer_id=offer.id and state='paid') then
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
 if t.currency<>'EGP' then raise exception 'XPAY_CURRENCY_UNSUPPORTED' using errcode='22023';end if;
 if amount<=0 or amount<>round(amount,2) then raise exception 'XPAY_QUOTE_INVALID' using errcode='22023'; end if;
 q:=q||jsonb_build_object('planId',t.plan_id,'planName',t.display_name,'planSlug',(select slug from public.plans where id=t.plan_id),
 'catalogTermsId',t.id,'planVariant',t.plan_variant,'billingInterval',t.billing_interval,'resourceLimits',t.resource_limits,'entitlements',t.offer_entitlements,'offerBinding',preview-array['submissionId','blockers','xpayOrderId','settledQuoteId']);
 return q;
end $$;
notify pgrst,'reload schema';
