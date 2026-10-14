-- Preserve #301 explicit purchase context and all #298 proration/offer admission guards.
-- Existing RPC signature, privileges and RLS remain unchanged. No financial history is rewritten.
create or replace function public.shop_xpay_order_create(p_request_id uuid,p_shop_id uuid,p_catalog_terms_id uuid,
 p_private_offer jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions; o public.shop_xpay_orders; c shop_private.xpay_configuration;
 t public.plan_catalog_terms; q jsonb; offer public.shop_private_offers; preview jsonb; amount numeric; intent text; prior_paid uuid; supplied_prior text; headers jsonb;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) or not shop_private.is_owner(p_shop_id) then
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
 or o.quote->'offerBinding' is distinct from preview-array['submissionId','blockers','xpayOrderId','settledQuoteId']))
 then raise exception 'XPAY_REQUEST_KEY_REUSED' using errcode='22023'; end if;
 -- Private offer token authority is rechecked below on new requests; replay must
 -- still require the same owner, and never change a persisted quote.
 return shop_private.xpay_order_view(o);
 end if;
 if exists(select 1 from shop_private.proration_configuration where singleton and enabled) or exists(select 1 from public.shop_proration_quotes where subscription_id=s.id and state in ('quoted','checkout','requires_review')) then raise exception 'SHOP_PRORATION_QUOTE_REQUIRED' using errcode='55000';end if;
 -- Request metadata declares purchase intent, never identity or authority.
 -- Replay above preserves an existing quote before checking a NEW purchase.
 headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 intent:=coalesce(nullif(headers->>'x-shop-payment-intent',''),'subscribe');
 supplied_prior:=nullif(headers->>'x-shop-prior-paid-order','');
 if intent not in ('subscribe','renew','change') or (supplied_prior is not null and supplied_prior !~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$')
 then raise exception 'XPAY_INTENT_INVALID' using errcode='22023';end if;
 if s.status='active' and s.current_period_end>clock_timestamp() then
  if intent='subscribe' then raise exception 'XPAY_ACTIVE_PAYMENT_EXISTS' using errcode='55000';end if;
  select id into prior_paid from public.shop_xpay_orders where subscription_id=s.id and state='paid' order by created_at desc,id desc limit 1;
  if supplied_prior::uuid is distinct from prior_paid then raise exception 'XPAY_PAYMENT_CONTEXT_CHANGED' using errcode='55000';end if;
  if intent='renew' and (p_private_offer is not null or p_catalog_terms_id is distinct from s.catalog_terms_id)
  then raise exception 'XPAY_RENEWAL_TERMS_CHANGED' using errcode='22023';end if;
 elsif intent<>'subscribe' then raise exception 'XPAY_PAYMENT_CONTEXT_CHANGED' using errcode='55000';end if;
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
 if t.currency<>'EGP' or amount<=0 or amount<>round(amount,2) then raise exception 'XPAY_QUOTE_INVALID' using errcode='22023'; end if;
 q:=q||jsonb_build_object('planId',t.plan_id,'planName',t.display_name,'planSlug',(select slug from public.plans where id=t.plan_id),
 'catalogTermsId',t.id,'planVariant',t.plan_variant,'billingInterval',t.billing_interval,'resourceLimits',t.resource_limits,'entitlements',t.offer_entitlements,'offerBinding',preview-array['submissionId','blockers','xpayOrderId','settledQuoteId']);
 insert into public.shop_xpay_orders(request_id,shop_id,subscription_id,actor_user_id,merchant_id,mode,catalog_terms_id,private_offer_id,quote,subscription_before,amount_minor,currency)
 values(p_request_id,p_shop_id,s.id,auth.uid(),c.merchant_id,c.mode,t.id,offer.id,q,to_jsonb(s),(amount*100)::bigint,t.currency) returning * into o;
 return shop_private.xpay_order_view(o);
end $$;

create or replace function shop_private.realtime_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_data jsonb; s uuid; l uuid; f text; features text[];
begin
 row_data:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if TG_TABLE_NAME='shop_xpay_orders' then
  if TG_OP='INSERT' or NEW.state is distinct from OLD.state or NEW.session_id is distinct from OLD.session_id then
   perform shop_private.bump_realtime(NEW.shop_id,null,'billing');
  end if;
 elsif TG_TABLE_NAME='subscriptions' then
  for s in select shop_id from public.shop_memberships where profile_id=(row_data->>'profile_id')::uuid and role='owner' loop
   perform shop_private.bump_realtime(s,null,'billing');
  end loop;
 else
  s:=(row_data->>'shop_id')::uuid; l:=(row_data->>'location_id')::uuid;
  features:=case TG_TABLE_NAME
   when 'appointments' then array['appointments','pos']
   when 'appointment_schedule_blocks' then array['appointments']
   when 'appointment_working_hours' then array['appointments']
   when 'invoices' then array['sales','customers']
   when 'payments' then array['sales','customers','cash-shifts']
   when 'clients' then array['customers','sales','pos']
   when 'cash_sessions' then array['cash-shifts','pos']
   when 'cash_drawer_events' then array['cash-shifts']
   when 'shop_memberships' then array['team']
   when 'roles' then array['team']
   when 'membership_location_assignments' then array['team']
   when 'products' then array['products','inventory','pos']
   when 'catalog_categories' then array['products','services']
   when 'services' then array['services','pos']
   when 'service_location_availability' then array['services']
   when 'service_staff_eligibility' then array['services']
   when 'inventory_batches' then array['inventory']
   when 'inventory_movements' then array['inventory']
   when 'shop_billing_submissions' then array['billing']
  end;
  foreach f in array features loop perform shop_private.bump_realtime(s,l,f); end loop;
 end if;
 return null;
end $$;
create trigger shop_xpay_orders_realtime after insert or update on public.shop_xpay_orders for each row execute function shop_private.realtime_changed();
