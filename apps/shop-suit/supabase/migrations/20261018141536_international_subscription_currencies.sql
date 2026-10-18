-- Explicit SaaS presentment currency. No provider key, account setting, job,
-- hosted write or customer USD charge is enabled by this forward migration.
alter table shop_private.xpay_configuration add column usd_enabled boolean not null default false;
alter table public.shop_xpay_orders drop constraint shop_xpay_orders_currency_check;
alter table public.shop_xpay_orders add constraint shop_xpay_orders_currency_check check(currency in('EGP','USD'));
alter table public.shop_proration_credit_accounts drop constraint shop_proration_credit_accounts_currency_check;
alter table public.shop_proration_credit_accounts add constraint shop_proration_credit_accounts_currency_check check(currency in('EGP','USD'));
alter table public.shop_proration_credit_accounts drop constraint shop_proration_credit_accounts_pkey;
alter table public.shop_proration_credit_accounts add primary key(subscription_id,currency);
alter table public.shop_proration_credit_ledger drop constraint shop_proration_credit_ledger_currency_check;
alter table public.shop_proration_credit_ledger add constraint shop_proration_credit_ledger_currency_check check(currency in('EGP','USD'));
create function shop_private.require_charge_currency(p_currency text) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if p_currency is null or p_currency not in('EGP','USD') or (p_currency='USD' and not exists(select 1 from shop_private.xpay_configuration where singleton and enabled and usd_enabled)) then
 raise exception 'XPAY_CURRENCY_UNSUPPORTED' using errcode='22023';end if;
end $$;
revoke all on function shop_private.require_charge_currency(text) from public,anon,authenticated,service_role;

-- The price book has exact commercial amounts, not an exchange-rate formula.
create table shop_private.international_price_book(plan_slug text not null,plan_variant text not null,billing_interval text not null,amount_minor bigint not null check(amount_minor>0),primary key(plan_slug,plan_variant,billing_interval));
alter table shop_private.international_price_book enable row level security;
revoke all on shop_private.international_price_book from public,anon,authenticated,service_role;
insert into shop_private.international_price_book values
('solo','solo_1','monthly',699),('solo','solo_1','annual',5699),
('solo','solo_2','monthly',999),('solo','solo_2','annual',8199),
('team','standard','monthly',1399),('team','standard','annual',11399),
('multi','multi_2','monthly',1999),('multi','multi_2','annual',16299),
('multi','multi_3','monthly',2399),('multi','multi_3','annual',19599);
create table shop_private.international_term_sources(usd_terms_id uuid primary key references public.plan_catalog_terms(id),source_terms_id uuid not null unique references public.plan_catalog_terms(id));
alter table shop_private.international_term_sources enable row level security;
revoke all on shop_private.international_term_sources from public,anon,authenticated,service_role;
create function shop_private.seed_international_term(t public.plan_catalog_terms) returns void language plpgsql security definer set search_path='' as $$
declare price bigint;usd uuid;
begin
 if t.currency<>'EGP' or t.private_offer_id is not null or not t.is_public or not t.is_purchasable or exists(select 1 from shop_private.international_term_sources where source_terms_id=t.id) then return;end if;
 select b.amount_minor into price from shop_private.international_price_book b join public.plans p on p.slug=b.plan_slug where p.id=t.plan_id and b.plan_variant=t.plan_variant and b.billing_interval=t.billing_interval;
 if price is null then return;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t.plan_id::text,7));
 insert into public.plan_catalog_terms(plan_id,version,display_name,billing_interval,currency,price_amount,trial_days,resource_limits,is_public,is_purchasable,effective_from,catalog_generation,plan_variant,variant_name,offer_entitlements)
 values(t.plan_id,(select coalesce(max(version),0)+1 from public.plan_catalog_terms where plan_id=t.plan_id),t.display_name,t.billing_interval,'USD',price::numeric/100,t.trial_days,t.resource_limits,t.is_public,t.is_purchasable,t.effective_from,t.catalog_generation,t.plan_variant,t.variant_name,t.offer_entitlements) returning id into usd;
 insert into shop_private.international_term_sources values(usd,t.id);
end $$;
create function shop_private.seed_international_term_trigger() returns trigger language plpgsql security definer set search_path='' as $$begin perform shop_private.seed_international_term(new);return new;end $$;
revoke all on function shop_private.seed_international_term(public.plan_catalog_terms),shop_private.seed_international_term_trigger() from public,anon,authenticated,service_role;
create trigger shop_international_term_after_insert after insert on public.plan_catalog_terms for each row when(new.currency='EGP' and new.private_offer_id is null) execute function shop_private.seed_international_term_trigger();


-- Preserve existing authority/policy from 20261009222852_secure_private_offer_handshake.sql; make currency explicit.
create or replace function shop_private.current_plan_offers(
  p_plan_id uuid, p_at timestamptz default clock_timestamp()
) returns setof public.plan_catalog_terms
language sql stable security definer set search_path = '' as $$
  with effective as (
    select terms.*,
      max(terms.catalog_generation) over (partition by terms.plan_id) current_generation,
      row_number() over (
        partition by terms.plan_id, terms.catalog_generation,
          terms.plan_variant, terms.billing_interval
        order by terms.effective_from desc, terms.version desc, terms.id desc
      ) offer_rank
    from public.plan_catalog_terms terms
    where terms.currency = 'EGP' and terms.plan_id = p_plan_id and terms.effective_from <= p_at
      and terms.private_offer_id is null
  )
  select effective.id, effective.plan_id, effective.version,
    effective.display_name, effective.billing_interval, effective.currency,
    effective.price_amount, effective.trial_days, effective.resource_limits,
    effective.is_public, effective.is_purchasable, effective.effective_from,
    effective.created_at, effective.catalog_generation,
    effective.plan_variant, effective.variant_name, effective.private_offer_id, effective.offer_entitlements
  from effective
  where effective.catalog_generation = effective.current_generation
    and effective.offer_rank = 1
  order by case effective.plan_variant
      when 'standard' then 1 when 'multi_2' then 2 when 'multi_3' then 3 else 9 end,
    case effective.billing_interval when 'monthly' then 1 when 'annual' then 2 else 9 end;
$$;


create function shop_private.current_plan_offers_currency(p_plan_id uuid,p_currency text,p_at timestamptz default clock_timestamp()) returns setof public.plan_catalog_terms language sql stable security definer set search_path='' as $$
 select t.* from public.plan_catalog_terms t where t.catalog_generation=(select max(g.catalog_generation) from public.plan_catalog_terms g where g.plan_id=t.plan_id and g.currency=p_currency and g.private_offer_id is null and g.effective_from<=p_at) and t.plan_id=p_plan_id and t.currency=p_currency and t.private_offer_id is null and t.effective_from<=p_at
 and not exists(select 1 from public.plan_catalog_terms later where later.plan_id=t.plan_id and later.currency=t.currency and later.private_offer_id is null and later.plan_variant=t.plan_variant and later.billing_interval=t.billing_interval and later.effective_from<=p_at and (later.effective_from,later.version,later.id)>(t.effective_from,t.version,t.id));
$$;
revoke all on function shop_private.current_plan_offers_currency(uuid,text,timestamptz) from public,anon,authenticated,service_role;
do $$declare t public.plan_catalog_terms;begin for t in select terms.* from public.plans p cross join lateral shop_private.current_plan_offers(p.id) terms loop perform shop_private.seed_international_term(t);end loop;end $$;
create function public.shop_subscription_currency_catalog(p_currency text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_currency not in('EGP','USD') or p_currency is null then raise exception 'XPAY_CURRENCY_UNSUPPORTED' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'slug',p.slug,'catalog_terms_id',t.id,'plan_variant',t.plan_variant,'variant_name',t.variant_name,'price_amount',t.price_amount,'currency',t.currency,'billing_interval',t.billing_interval,'trial_days',t.trial_days,'features',p.features,'resource_limits',t.resource_limits,'is_purchasable',t.is_purchasable,'is_coming_soon',p.is_coming_soon) order by p.sort_order,t.plan_variant,t.billing_interval),'[]') into result
 from public.plans p join public.portals portal on portal.id=p.portal_id cross join lateral shop_private.current_plan_offers_currency(p.id,p_currency) t
 where portal.key='shop-crm' and portal.is_active and p.is_active and p.is_public and p.is_purchasable and not p.is_coming_soon and t.is_public and t.is_purchasable;
 return result;
end $$;
revoke all on function public.shop_subscription_currency_catalog(text) from public,anon,authenticated,service_role;
grant execute on function public.shop_subscription_currency_catalog(text) to anon,authenticated;


-- Preserve existing authority/policy from 20261013173519_proration_settlement.sql; make currency explicit.
create or replace function shop_private.proration_quote_v1(
 p_as_of timestamptz, p_status text, p_source text,
 p_cycle_start timestamptz, p_cycle_end timestamptz,
 p_funding_start timestamptz, p_prepaid_minor numeric,
 p_old_interval text, p_new_interval text,
 p_new_term_minor bigint, p_credit_balance_minor bigint,
 p_same_terms boolean, p_currency text default 'EGP'
) returns jsonb language plpgsql immutable security invoker
set search_path='' set timezone='UTC' as $$
declare
 active_cycle boolean; funded boolean; mode text; fraction numeric:=1;
 unused numeric:=0; service_cost numeric; net numeric; rounded bigint;
 due bigint; credit_after bigint; starts timestamptz; ends timestamptz;
 expires timestamptz; duration_seconds numeric; remaining_seconds numeric;
 same_interval boolean:=p_old_interval=p_new_interval;
begin
 if p_as_of is null or not isfinite(p_as_of)
 or p_status is null or p_status not in ('active','trialing','expired','cancelled')
 or p_source is null or p_source not in ('paid','operator_grant','trial','none')
 or p_new_interval is null or p_new_interval not in ('monthly','annual')
 or (p_old_interval is not null and p_old_interval not in ('monthly','annual','quarterly'))
 or p_new_term_minor is null or p_new_term_minor not between 1 and 999999999999
 or p_credit_balance_minor is null or p_credit_balance_minor not between 0 and 999999999999
 or p_prepaid_minor is null or p_prepaid_minor::text in ('NaN','Infinity','-Infinity')
 or p_prepaid_minor not between 0 and 999999999999
 or p_same_terms is null or (p_currency is null or p_currency not in('EGP','USD')) then
 raise exception 'SHOP_PRORATION_INPUT_INVALID' using errcode='22023'; end if;
 if (p_cycle_start is not null and not isfinite(p_cycle_start))
 or (p_cycle_end is not null and not isfinite(p_cycle_end))
 or (p_funding_start is not null and not isfinite(p_funding_start)) then
 raise exception 'SHOP_PRORATION_PERIOD_INVALID' using errcode='22023'; end if;
 active_cycle:=p_status='active' and p_cycle_start is not null and p_cycle_end is not null
 and p_cycle_start<=p_as_of and p_as_of<p_cycle_end;
 if p_status='active' and (p_cycle_start is null or p_cycle_end is null
 or (p_cycle_start is not null and (p_cycle_start>=p_cycle_end or p_cycle_start>p_as_of))) then
 raise exception 'SHOP_PRORATION_PERIOD_INVALID' using errcode='22023'; end if;
 if active_cycle and p_old_interval is null then
 raise exception 'SHOP_PRORATION_PERIOD_INVALID' using errcode='22023'; end if;
 if p_same_terms and active_cycle and not same_interval then
 raise exception 'SHOP_PRORATION_TERMS_INVALID' using errcode='22023'; end if;
 funded:=active_cycle and p_source='paid';
 if funded and (p_funding_start is null or p_funding_start<p_cycle_start
 or p_funding_start>p_as_of or p_funding_start>=p_cycle_end) then
 raise exception 'SHOP_PRORATION_FUNDING_INVALID' using errcode='22023'; end if;
 -- A paid allocation may begin after the original cycle start following a
 -- previous change. Funding duration and billing-cycle duration are distinct.
 if active_cycle then
 duration_seconds:=extract(epoch from p_cycle_end-p_cycle_start);
 remaining_seconds:=extract(epoch from p_cycle_end-p_as_of);
 end if;
 if funded then
 unused:=p_prepaid_minor*remaining_seconds/extract(epoch from p_cycle_end-p_funding_start);
 end if;
 if p_same_terms and active_cycle then
 mode:='no_change'; service_cost:=0; unused:=0; starts:=p_cycle_start; ends:=p_cycle_end;
 elsif active_cycle and same_interval then
 mode:='remaining_period'; fraction:=remaining_seconds/duration_seconds;
 service_cost:=p_new_term_minor*fraction; starts:=p_as_of; ends:=p_cycle_end;
 elsif active_cycle then
 mode:='new_interval'; service_cost:=p_new_term_minor;
 else
 mode:=case when p_status='trialing' then 'trial_conversion' else 'full_term' end;
 service_cost:=p_new_term_minor;
 end if;
 -- Never round credit and cost individually before netting. PostgreSQL numeric
 -- half ties round away from zero; the only currency rounding is this net.
 net:=case when mode='no_change' then 0 else service_cost-unused-p_credit_balance_minor end;
 rounded:=round(net)::bigint;
 due:=greatest(rounded,0);
 credit_after:=case when mode='no_change' then p_credit_balance_minor else greatest(-rounded,0) end;
 expires:=case when active_cycle then least(p_as_of+interval '15 minutes',p_cycle_end)
 else p_as_of+interval '15 minutes' end;
 return jsonb_build_object(
 'version',1,'currency',p_currency,'quotedAt',p_as_of,'expiresAt',expires,
 'mode',mode,'source',p_source,'status',p_status,'sameTerms',p_same_terms,
 'oldBillingInterval',p_old_interval,'newBillingInterval',p_new_interval,
 'cycleStart',p_cycle_start,'cycleEnd',p_cycle_end,'fundingStart',p_funding_start,
 'prepaidValueMinor',p_prepaid_minor::text,'newTermMinor',p_new_term_minor,
 'cycleSeconds',duration_seconds::text,'remainingSeconds',remaining_seconds::text,
 'targetFraction',fraction::text,'serviceValueMinor',service_cost::text,
 'unusedPrepaidMinor',unused::text,'creditBeforeMinor',p_credit_balance_minor,
 'netUnroundedMinor',net::text,'roundingAdjustmentMinor',(rounded-net)::text,
 'amountDueMinor',due,'creditAfterMinor',credit_after,
 'periodStart',starts,'periodEnd',ends,
 'periodStartPolicy',case when starts is null then 'verified_settlement' else 'frozen_quote' end,
 'periodMonths',case p_new_interval when 'monthly' then 1 else 12 end,
 'transition',case when mode='no_change' then 'no_change' when due=0 then 'explicit_credit_transition' else 'verified_xpay_payment' end
 );
end $$;


-- Preserve existing authority/policy from 20261013190345_proration_checkout_windows.sql; make currency explicit.
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
 and exists(select 1 from shop_private.current_plan_offers_currency(plan.id,terms.currency) current_terms where current_terms.id=terms.id);
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
 if t.currency not in('EGP','USD') then raise exception 'XPAY_CURRENCY_UNSUPPORTED' using errcode='22023';end if;
 if amount<=0 or amount<>round(amount,2) then raise exception 'XPAY_QUOTE_INVALID' using errcode='22023'; end if;
 q:=q||jsonb_build_object('planId',t.plan_id,'planName',t.display_name,'planSlug',(select slug from public.plans where id=t.plan_id),
 'catalogTermsId',t.id,'planVariant',t.plan_variant,'billingInterval',t.billing_interval,'resourceLimits',t.resource_limits,'entitlements',t.offer_entitlements,'offerBinding',preview-array['submissionId','blockers','xpayOrderId','settledQuoteId']);
 return q;
end $$;


-- Preserve existing authority/policy from 20261014081453_scheduled_billing_policy.sql; make currency explicit.
create or replace function shop_private.proration_funding(s public.subscriptions,p_as_of timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.shop_proration_settlements;value numeric:=0;evidence jsonb:='[]';row record;service_segments jsonb;segment jsonb;
begin
 if s.status<>'active' or s.current_period_end<=p_as_of then return jsonb_build_object('source','none','unusedMinor','0','evidence',evidence);end if;
 if exists(select 1 from public.shop_xpay_refund_observations r join public.shop_xpay_orders o on o.id=r.order_id where o.subscription_id=s.id) then return jsonb_build_object('source','none','unusedMinor','0','evidence',jsonb_build_array(jsonb_build_object('kind','refund_review')),'refundReviewRequired',true);end if;
 select settled.* into a from public.shop_proration_settlements settled join public.shop_proration_quotes q on q.id=settled.quote_id
 where settled.subscription_id=s.id and q.catalog_terms_id=s.catalog_terms_id and settled.cycle_start=s.current_period_start
 and settled.period_end=s.current_period_end order by settled.settled_at desc,settled.quote_id desc limit 1;
 if found then
 select q.calculation->'serviceSegments' into service_segments from public.shop_proration_quotes q where q.id=a.quote_id;
 if jsonb_typeof(service_segments)='array' then
 for segment in select parts.value from jsonb_array_elements(service_segments) parts loop
 if (segment->>'end')::timestamptz>(segment->>'start')::timestamptz then
 value:=value+(segment->>'valueMinor')::numeric*greatest(0,extract(epoch from (segment->>'end')::timestamptz-greatest(p_as_of,(segment->>'start')::timestamptz)))/extract(epoch from (segment->>'end')::timestamptz-(segment->>'start')::timestamptz);
 end if;end loop;
 else
 value:=a.prepaid_value_minor*extract(epoch from a.period_end-p_as_of)/extract(epoch from a.period_end-a.period_start);
 end if;
 evidence:=jsonb_build_array(jsonb_build_object('kind','allocation','id',a.quote_id,'valueMinor',a.prepaid_value_minor::text,'start',a.period_start,'end',a.period_end));
 if jsonb_typeof(service_segments)='array' then evidence:=jsonb_set(evidence,'{0,serviceSegments}',service_segments);end if;
 else
 for row in
 select 'xpay'::text kind,p.id,p.amount_minor::numeric amount,p.period_start start_at,p.period_end end_at
 from public.shop_xpay_payments p join public.shop_xpay_orders o on o.id=p.order_id
 join public.shop_xpay_paid_observations observation on observation.order_id=p.order_id and observation.amount_minor=p.amount_minor and observation.currency=p.currency and observation.session_id=p.session_id and observation.payment_intent_id=p.payment_intent_id
 where o.subscription_id=s.id and o.catalog_terms_id=s.catalog_terms_id and o.currency=(select currency from public.plan_catalog_terms where id=s.catalog_terms_id)
 and o.quote->>'prorationQuoteId' is null and p.period_start>=s.current_period_start and p.period_end<=s.current_period_end
 and not exists(select 1 from public.shop_proration_settlements consumed join public.shop_proration_quotes cq on cq.id=consumed.quote_id
 where consumed.subscription_id=s.id and cq.funding_evidence @> jsonb_build_array(jsonb_build_object('kind','xpay','id',p.id)))
 union all
 select 'manual',period.id,notice.received_amount*100,period.period_start,period.period_end
 from public.subscription_commercial_periods period join public.shop_billing_submissions notice on notice.id=period.billing_submission_id
 where period.subscription_id=s.id and period.catalog_terms_id=s.catalog_terms_id and period.currency=(select currency from public.plan_catalog_terms where id=s.catalog_terms_id)
 and notice.status='approved' and notice.received_amount>0 and notice.received_amount=round(notice.received_amount,2)
 and period.period_start>=s.current_period_start and period.period_end<=s.current_period_end
 and not exists(select 1 from public.shop_proration_settlements consumed join public.shop_proration_quotes cq on cq.id=consumed.quote_id
 where consumed.subscription_id=s.id and cq.funding_evidence @> jsonb_build_array(jsonb_build_object('kind','manual','id',period.id)))
 order by kind,id
 loop
 value:=value+row.amount*greatest(0,extract(epoch from row.end_at-greatest(p_as_of,row.start_at)))/extract(epoch from row.end_at-row.start_at);
 evidence:=evidence||jsonb_build_array(jsonb_build_object('kind',row.kind,'id',row.id,'valueMinor',row.amount::text,'start',row.start_at,'end',row.end_at));
 end loop;
 end if;
 return jsonb_build_object('source',case when jsonb_array_length(evidence)>0 then 'paid' else 'none' end,'unusedMinor',value::text,'evidence',evidence);
end $$;


-- Preserve existing authority/policy from 20261014081453_scheduled_billing_policy.sql; make currency explicit.
create or replace function public.shop_xpay_proration_quote(p_request_id uuid,p_shop_id uuid,p_catalog_terms_id uuid,p_private_offer jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;q public.shop_proration_quotes;a public.shop_proration_credit_accounts;
 commerce jsonb;parameters jsonb;funding jsonb;calculation jsonb;old_interval text;old_currency text;at timestamptz;v_target_terms uuid;offer uuid;scheduled_id uuid;
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
 v_target_terms:=(commerce->>'catalogTermsId')::uuid;offer:=(p_private_offer->>'offerId')::uuid;
 insert into public.shop_proration_credit_accounts(subscription_id,currency) values(s.id,commerce->>'currency') on conflict(subscription_id,currency) do nothing;
 select * into a from public.shop_proration_credit_accounts where subscription_id=s.id and currency=commerce->>'currency' for update;
 select billing_interval,currency into old_interval,old_currency from public.plan_catalog_terms where id=s.catalog_terms_id;
 if s.status='active' and s.current_period_end>clock_timestamp() and old_currency is distinct from (commerce->>'currency') then raise exception 'SHOP_PRORATION_CURRENCY_MISMATCH' using errcode='22023';end if;
 if s.status='active' and s.current_period_end>clock_timestamp() and shop_private.billing_change_timing(s,commerce)='term_end' then raise exception 'SHOP_CHANGE_AT_PERIOD_END' using errcode='55000';end if;
 at:=clock_timestamp();funding:=shop_private.proration_funding(s,at); if funding->>'refundReviewRequired'='true' then raise exception 'SHOP_PRORATION_REFUND_REVIEW_REQUIRED' using errcode='55000';end if;
 calculation:=shop_private.proration_quote_v1(at,case when s.status='trialing' and s.trial_end_at<=at then 'expired' else s.status end,
 funding->>'source',s.current_period_start,s.current_period_end,at,(funding->>'unusedMinor')::numeric,
 old_interval,commerce->>'billingInterval',((commerce->>'effectivePriceAmount')::numeric*100)::bigint,a.balance_minor,s.catalog_terms_id=v_target_terms,commerce->>'currency');
 if s.status='active' and s.current_period_end>at and old_interval=commerce->>'billingInterval' and s.catalog_terms_id<>v_target_terms
 and abs(extract(epoch from s.current_period_end-(s.current_period_start+case old_interval when 'monthly' then interval '1 month' when 'annual' then interval '1 year' end)))>1 then
 calculation:=shop_private.proration_segmented_upgrade(s,at,((commerce->>'effectivePriceAmount')::numeric*100)::bigint,funding,calculation);end if;
 calculation:=calculation||jsonb_build_object('billingPolicyVersion','single_period_deferred_v1');
 if calculation->>'mode'='full_term' then
 select id into scheduled_id from public.shop_scheduled_plan_changes where subscription_id=s.id and shop_id=p_shop_id and actor_user_id=auth.uid() and state='scheduled' and ((catalog_terms_id=v_target_terms and private_offer_id is null) or(private_offer_id=offer and private_offer_parameters=p_private_offer-'redemptionToken')) and effective_at<=at;
 if scheduled_id is not null then commerce:=commerce||jsonb_build_object('scheduledChangeId',scheduled_id);end if;end if;
 parameters:=jsonb_build_object('catalogTermsId',p_catalog_terms_id,'privateOffer',p_private_offer-'redemptionToken');
 insert into public.shop_proration_quotes(request_id,shop_id,subscription_id,actor_user_id,catalog_terms_id,private_offer_id,parameters,subscription_before,credit_version,commerce,calculation,funding_evidence,expires_at)
 values(p_request_id,p_shop_id,s.id,auth.uid(),v_target_terms,offer,parameters,to_jsonb(s),a.version,commerce,calculation,funding->'evidence',(calculation->>'expiresAt')::timestamptz) returning * into q;
 return shop_private.proration_quote_view(q);
end $$;


-- Preserve existing authority/policy from 20261014081453_scheduled_billing_policy.sql; make currency explicit.
create or replace function shop_private.proration_validate(q public.shop_proration_quotes,s public.subscriptions,a public.shop_proration_credit_accounts) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 return a.currency=q.calculation->>'currency' and q.commerce->>'currency'=q.calculation->>'currency' and (q.calculation->>'billingPolicyVersion' is distinct from 'single_period_deferred_v1' or shop_private.billing_change_timing(s,q.commerce)='now')
 and (q.commerce->>'scheduledChangeId' is null or exists(select 1 from public.shop_scheduled_plan_changes change where change.id=(q.commerce->>'scheduledChangeId')::uuid
 and change.shop_id=q.shop_id and change.subscription_id=s.id and change.actor_user_id=q.actor_user_id and change.state='scheduled'
 and ((change.catalog_terms_id=q.catalog_terms_id and change.private_offer_id is null) or(change.private_offer_id=q.private_offer_id and change.private_offer_parameters=q.parameters->'privateOffer')) and change.effective_at<=clock_timestamp()))
 and q.subscription_before=to_jsonb(s) and a.version=q.credit_version and a.balance_minor=(q.calculation->>'creditBeforeMinor')::bigint
 and shop_private.proration_window_valid(q.state,q.expires_at,clock_timestamp(),
 (select accepted.created_at from public.shop_xpay_orders accepted where accepted.id=q.xpay_order_id),
 (select (accepted.session_request->>'expiresAfterMinutes')::integer from public.shop_xpay_orders accepted where accepted.id=q.xpay_order_id))
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


-- Preserve existing authority/policy from 20261013190345_proration_checkout_windows.sql; make currency explicit.
create or replace function public.shop_xpay_proration_order(p_shop_id uuid,p_quote_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;q public.shop_proration_quotes;a public.shop_proration_credit_accounts;o public.shop_xpay_orders;c shop_private.xpay_configuration;
begin
 s:=shop_private.proration_owner_subscription(p_shop_id);perform shop_private.proration_enabled();
 select * into q from public.shop_proration_quotes where id=p_quote_id and shop_id=p_shop_id and subscription_id=s.id and actor_user_id=auth.uid() for update;
 select * into a from public.shop_proration_credit_accounts where subscription_id=s.id and currency=q.calculation->>'currency' for update;
 if q.id is null then raise exception 'SHOP_PRORATION_QUOTE_UNAVAILABLE' using errcode='42501';end if;
 if q.xpay_order_id is not null then select * into o from public.shop_xpay_orders where id=q.xpay_order_id;return shop_private.xpay_order_view(o);end if;
 if q.state<>'quoted' or not shop_private.proration_validate(q,s,a) then raise exception 'SHOP_PRORATION_QUOTE_STALE' using errcode='55000';end if;
 if (q.calculation->>'amountDueMinor')::bigint=0 then raise exception 'SHOP_PRORATION_CREDIT_CONFIRMATION_REQUIRED' using errcode='55000';end if;
 if q.private_offer_id is not null and (q.commerce#>>'{offerBinding,expiresAt}')::timestamptz<clock_timestamp()+interval '31 minutes' then raise exception 'XPAY_OFFER_EXPIRING' using errcode='22023';end if;
 select * into c from shop_private.xpay_configuration where singleton and enabled;
 if not found then raise exception 'XPAY_NOT_CONFIGURED' using errcode='55000';end if;
 perform shop_private.require_charge_currency(q.commerce->>'currency');
 if exists(select 1 from public.shop_xpay_orders where subscription_id=s.id and state in ('creating','open','pending','requires_review')) then raise exception 'XPAY_ORDER_ALREADY_OPEN' using errcode='55000';end if;
 insert into public.shop_xpay_orders(request_id,shop_id,subscription_id,actor_user_id,merchant_id,mode,catalog_terms_id,private_offer_id,quote,subscription_before,amount_minor,currency)
 values(q.request_id,q.shop_id,q.subscription_id,q.actor_user_id,c.merchant_id,c.mode,q.catalog_terms_id,q.private_offer_id,
 q.commerce||jsonb_build_object('prorationQuoteId',q.id,'proration',q.calculation),q.subscription_before,(q.calculation->>'amountDueMinor')::bigint,q.commerce->>'currency') returning * into o;
 update public.shop_proration_quotes set state='checkout',xpay_order_id=o.id where id=q.id;
 return shop_private.xpay_order_view(o);
end $$;


-- Preserve existing authority/policy from 20261013173519_proration_settlement.sql; make currency explicit.
create or replace function shop_private.proration_settle(p_quote_id uuid,p_order_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare q public.shop_proration_quotes;s public.subscriptions;a public.shop_proration_credit_accounts;o public.shop_xpay_orders;
 observation public.shop_xpay_paid_observations;receipt public.shop_xpay_payments;settled public.shop_proration_settlements;
 due bigint;credit_after bigint;start_at timestamptz;end_at timestamptz;cycle_start timestamptz;
begin
 select * into q from public.shop_proration_quotes where id=p_quote_id;
 if q.id is null then raise exception 'SHOP_PRORATION_QUOTE_UNAVAILABLE' using errcode='42501';end if;
 perform shop_private.lock_all_plan_resources(q.shop_id);
 select * into s from public.subscriptions where id=q.subscription_id for update;
 select * into a from public.shop_proration_credit_accounts where subscription_id=s.id and currency=q.calculation->>'currency' for update;
 select * into q from public.shop_proration_quotes where id=p_quote_id for update;
 due:=(q.calculation->>'amountDueMinor')::bigint;credit_after:=(q.calculation->>'creditAfterMinor')::bigint;
 if due=0 then
 if p_order_id is not null or auth.role() is distinct from 'authenticated' or auth.uid() is distinct from q.actor_user_id or not shop_private.is_owner(q.shop_id) then raise exception 'SHOP_OWNER_REQUIRED' using errcode='42501';end if;
 else
 perform shop_private.xpay_server_required();
 select * into o from public.shop_xpay_orders where id=p_order_id for update;
 select * into observation from public.shop_xpay_paid_observations where order_id=p_order_id;
 if o.id is null or q.xpay_order_id is distinct from o.id or o.subscription_id<>s.id or o.catalog_terms_id<>q.catalog_terms_id
 or o.subscription_before<>q.subscription_before or (o.quote->>'prorationQuoteId')::uuid is distinct from q.id or o.amount_minor<>due
 or o.currency is distinct from (q.calculation->>'currency') or observation.order_id is null or observation.amount_minor<>due or observation.currency is distinct from (q.calculation->>'currency')
 or observation.session_id is distinct from o.session_id or observation.merchant_id<>o.merchant_id or observation.mode<>o.mode then
 raise exception 'XPAY_PAYMENT_NOT_VERIFIED' using errcode='22023';end if;
 end if;
 if q.state='settled' then return shop_private.proration_quote_view(q);end if;
 if q.state not in ('quoted','checkout','requires_review') or not shop_private.proration_validate(q,s,a) then
 if due>0 then
 update public.shop_proration_quotes set state='requires_review' where id=q.id and state<>'abandoned';
 update public.shop_xpay_orders set state='requires_review',updated_at=clock_timestamp() where id=o.id;
 return jsonb_build_object('quoteId',q.id,'state','requires_review');
 end if;
 raise exception 'SHOP_PRORATION_QUOTE_STALE' using errcode='55000';end if;
 if q.calculation->>'mode'='no_change' then
 update public.shop_proration_quotes set state='settled' where id=q.id returning * into q;
 return shop_private.proration_quote_view(q);
 end if;
 if q.calculation->>'mode'='remaining_period' then
 start_at:=(q.calculation->>'periodStart')::timestamptz;end_at:=(q.calculation->>'periodEnd')::timestamptz;cycle_start:=s.current_period_start;
 else
 start_at:=case when due>0 then observation.verified_at else clock_timestamp() end;
 end_at:=start_at+make_interval(months=>(q.calculation->>'periodMonths')::integer);cycle_start:=start_at;
 end if;
 if end_at<=clock_timestamp() then raise exception 'SHOP_PRORATION_QUOTE_STALE' using errcode='55000';end if;
 -- Real provider receipts contain actual cash only. Zero-credit transitions
 -- deliberately create neither paid observations nor XPay payment records.
 if due>0 then
 insert into public.shop_xpay_payments(order_id,session_id,payment_intent_id,merchant_id,mode,amount_minor,currency,period_start,period_end,snapshot)
 values(o.id,observation.session_id,observation.payment_intent_id,o.merchant_id,o.mode,due,q.calculation->>'currency',start_at,end_at,o.quote) returning * into receipt;
 end if;
 insert into public.shop_proration_settlements(quote_id,subscription_id,cash_minor,xpay_order_id,period_start,period_end,cycle_start,prepaid_value_minor,subscription_before)
 values(q.id,s.id,due,p_order_id,start_at,end_at,cycle_start,(q.calculation->>'serviceValueMinor')::numeric,q.subscription_before);
 insert into public.shop_proration_credit_ledger(quote_id,subscription_id,currency,version_before,version_after,balance_before_minor,balance_after_minor,delta_minor,cash_minor,unused_prepaid_minor,service_value_minor,rounding_adjustment_minor)
 values(q.id,s.id,q.calculation->>'currency',a.version,a.version+1,a.balance_minor,credit_after,credit_after-a.balance_minor,due,(q.calculation->>'unusedPrepaidMinor')::numeric,(q.calculation->>'serviceValueMinor')::numeric,(q.calculation->>'roundingAdjustmentMinor')::numeric);
 update public.shop_proration_credit_accounts set balance_minor=credit_after,version=version+1,updated_at=clock_timestamp() where subscription_id=s.id and currency=q.calculation->>'currency';
 perform set_config('shop.proration_quote_id',q.id::text,true);
 update public.subscriptions set plan_id=(q.commerce->>'planId')::uuid,catalog_terms_id=q.catalog_terms_id,status='active',current_period_start=cycle_start,current_period_end=end_at,locked_at=null,updated_at=clock_timestamp() where id=s.id;
 insert into public.subscription_commercial_periods(subscription_id,catalog_terms_id,plan_slug,plan_name,plan_variant,billing_interval,currency,price_amount,list_price_amount,price_override_id,resource_limits,period_start,period_end,approved_at,xpay_order_id,offer_entitlements,proration_quote_id)
 values(s.id,q.catalog_terms_id,q.commerce->>'planSlug',q.commerce->>'planName',q.commerce->>'planVariant',q.commerce->>'billingInterval',q.calculation->>'currency',due::numeric/100,
 (q.commerce->>'listPriceAmount')::numeric,(q.commerce->>'priceOverrideId')::uuid,q.commerce->'resourceLimits',start_at,end_at,clock_timestamp(),p_order_id,q.commerce->'entitlements',q.id);
 update public.shop_proration_quotes set state='settled' where id=q.id returning * into q;
 if due>0 then update public.shop_xpay_orders set state='paid',updated_at=clock_timestamp() where id=o.id;end if;
 return shop_private.proration_quote_view(q);
end $$;


-- Preserve existing authority/policy from 20261013173519_proration_settlement.sql; make currency explicit.
create or replace function public.shop_xpay_proration_credit_confirm(p_shop_id uuid,p_quote_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;q public.shop_proration_quotes;
begin
 s:=shop_private.proration_owner_subscription(p_shop_id);perform shop_private.proration_enabled();
 select * into q from public.shop_proration_quotes where id=p_quote_id and shop_id=p_shop_id and subscription_id=s.id and actor_user_id=auth.uid();
 if q.id is null then raise exception 'SHOP_PRORATION_QUOTE_UNAVAILABLE' using errcode='42501';end if;
 if (q.calculation->>'amountDueMinor')::bigint<>0 then raise exception 'XPAY_PAYMENT_REQUIRED' using errcode='55000';end if;
 perform shop_private.require_charge_currency(q.commerce->>'currency');
 return shop_private.proration_settle(q.id,null);
end $$;


-- Preserve existing authority/policy from 20261013173519_proration_settlement.sql; make currency explicit.
create or replace function shop_private.proration_balance_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
 if new.balance_minor<>0 or new.version<>0 then raise exception 'SHOP_PRORATION_UNFUNDED_BALANCE' using errcode='55000';end if;
 elsif not exists(select 1 from public.shop_proration_credit_ledger ledger join public.shop_proration_settlements settled on settled.quote_id=ledger.quote_id
 where ledger.currency=old.currency and ledger.subscription_id=old.subscription_id and ledger.version_before=old.version and ledger.version_after=new.version
 and ledger.balance_before_minor=old.balance_minor and ledger.balance_after_minor=new.balance_minor and new.currency=old.currency
 and new.subscription_id=old.subscription_id) then raise exception 'SHOP_PRORATION_UNAUDITED_BALANCE' using errcode='55000';end if;
 return new;
end $$;


-- Preserve existing authority/policy from 20261014072920_single_period_purchase_guard.sql; make currency explicit.
create or replace function public.shop_xpay_order_create(p_request_id uuid,p_shop_id uuid,p_catalog_terms_id uuid,
 p_private_offer jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions; o public.shop_xpay_orders; c shop_private.xpay_configuration;
 t public.plan_catalog_terms; q jsonb; offer public.shop_private_offers; preview jsonb; amount numeric; intent text; supplied_prior text; headers jsonb;
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
 -- Request metadata declares purchase intent, never identity or authority.
 -- Replay above preserves an existing quote before checking a NEW purchase.
 headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 intent:=coalesce(nullif(headers->>'x-shop-payment-intent',''),'subscribe');
 supplied_prior:=nullif(headers->>'x-shop-prior-paid-order','');
 if intent not in ('subscribe','renew','change') or (supplied_prior is not null and supplied_prior !~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$')
 then raise exception 'XPAY_INTENT_INVALID' using errcode='22023';end if;
 if s.status='active' and s.current_period_end>clock_timestamp() then
  raise exception 'XPAY_ACTIVE_PERIOD_EXISTS' using errcode='55000';
 elsif intent<>'subscribe' then raise exception 'XPAY_PAYMENT_CONTEXT_CHANGED' using errcode='55000';end if;
 if exists(select 1 from shop_private.proration_configuration where singleton and enabled) or exists(select 1 from public.shop_proration_quotes where subscription_id=s.id and state in ('quoted','checkout','requires_review')) then raise exception 'SHOP_PRORATION_QUOTE_REQUIRED' using errcode='55000';end if;
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
 and exists(select 1 from shop_private.current_plan_offers_currency(plan.id,terms.currency) current_terms where current_terms.id=terms.id);
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
 perform shop_private.require_charge_currency(t.currency);
 amount:=(q->>'effectivePriceAmount')::numeric;
 if t.currency not in('EGP','USD') or amount<=0 or amount<>round(amount,2) then raise exception 'XPAY_QUOTE_INVALID' using errcode='22023'; end if;
 q:=q||jsonb_build_object('planId',t.plan_id,'planName',t.display_name,'planSlug',(select slug from public.plans where id=t.plan_id),
 'catalogTermsId',t.id,'planVariant',t.plan_variant,'billingInterval',t.billing_interval,'resourceLimits',t.resource_limits,'entitlements',t.offer_entitlements,'offerBinding',preview-array['submissionId','blockers','xpayOrderId','settledQuoteId']);
 insert into public.shop_xpay_orders(request_id,shop_id,subscription_id,actor_user_id,merchant_id,mode,catalog_terms_id,private_offer_id,quote,subscription_before,amount_minor,currency)
 values(p_request_id,p_shop_id,s.id,auth.uid(),c.merchant_id,c.mode,t.id,offer.id,q,to_jsonb(s),(amount*100)::bigint,t.currency) returning * into o;
 return shop_private.xpay_order_view(o);
end $$;


-- Preserve existing authority/policy from 20261014081453_scheduled_billing_policy.sql; make currency explicit.
create or replace function shop_private.billing_public_target(s public.subscriptions,p_terms uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare t public.plan_catalog_terms;q jsonb;
begin
 select terms.* into t from public.plan_catalog_terms terms join public.plans plan on plan.id=terms.plan_id join public.portals portal on portal.id=plan.portal_id
 where terms.id=p_terms and portal.key='shop-crm' and terms.private_offer_id is null and plan.is_active and plan.is_public and plan.is_purchasable and not plan.is_coming_soon
 and exists(select 1 from shop_private.current_plan_offers_currency(plan.id,terms.currency) offered where offered.id=terms.id);
 if t.id is null or t.billing_interval not in('monthly','annual') or t.currency not in('EGP','USD') then raise exception 'PLAN_UNAVAILABLE' using errcode='22023';end if;
 q:=shop_private.subscription_effective_price(s.id,t.id,clock_timestamp());
 if (q->>'effectivePriceAmount')::numeric<=0 or (q->>'effectivePriceAmount')::numeric<>round((q->>'effectivePriceAmount')::numeric,2) then raise exception 'XPAY_QUOTE_INVALID' using errcode='22023';end if;
 return q||jsonb_build_object('planId',t.plan_id,'catalogTermsId',t.id,'planName',t.display_name,'planVariant',t.plan_variant,
 'billingInterval',t.billing_interval,'currency',t.currency,'resourceLimits',t.resource_limits,'entitlements',t.offer_entitlements);
end $$;


-- Preserve existing authority/policy from 20261014081453_scheduled_billing_policy.sql; make currency explicit.
create or replace function shop_private.billing_target_preview(s public.subscriptions,p_shop uuid,p_terms uuid,p_private jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare o jsonb;
begin
 if (p_terms is null)=(p_private is null) then raise exception 'XPAY_QUOTE_INVALID' using errcode='22023';end if;
 if p_private is null then return shop_private.billing_public_target(s,p_terms);end if;
 if jsonb_typeof(p_private) is distinct from 'object' or (p_private-array['offerId','offerVersion','targetBindingId','targetEnvironmentId','redemptionToken'])<>'{}'::jsonb then raise exception 'XPAY_PRIVATE_OFFER_INVALID' using errcode='22023';end if;
 o:=public.shop_private_offer_read(p_shop,(p_private->>'offerId')::uuid,(p_private->>'offerVersion')::integer,(p_private->>'targetBindingId')::uuid,(p_private->>'targetEnvironmentId')::uuid,p_private->>'redemptionToken');
 if o->>'submissionId' is not null or o->>'xpayOrderId' is not null or o->>'settledQuoteId' is not null then raise exception 'XPAY_OFFER_ALREADY_PAID' using errcode='55000';end if;
 if o->>'currency' not in('EGP','USD') or o->>'billingInterval' not in('monthly','annual') then raise exception 'XPAY_CURRENCY_UNSUPPORTED' using errcode='22023';end if;
 return jsonb_build_object('privateOfferId',o->>'offerId','planName',o->>'displayName','planVariant','private_offer','billingInterval',o->>'billingInterval','currency',o->>'currency',
 'listPriceAmount',o->'priceAmount','effectivePriceAmount',o->'priceAmount','priceSource','private_offer','resourceLimits',o->'resourceLimits','entitlements',o->'entitlements','offerExpiresAt',o->'expiresAt');
end $$;


-- Preserve existing authority/policy from 20261014081453_scheduled_billing_policy.sql; make currency explicit.
create or replace function shop_private.billing_change_timing(s public.subscriptions,c jsonb)
returns text language plpgsql stable security invoker set search_path='' as $$
declare old_terms public.plan_catalog_terms;old_commerce jsonb;old_rate numeric;key text;old_limit numeric;new_limit numeric;
begin
 if s.status<>'active' or s.current_period_end is null or s.current_period_end<=clock_timestamp() then return 'now';end if;
 select * into old_terms from public.plan_catalog_terms where id=s.catalog_terms_id;
 if old_terms.id is null then raise exception 'SHOP_PRORATION_PERIOD_UNSUPPORTED' using errcode='22023';end if;
 select q.commerce into old_commerce from public.shop_proration_settlements a join public.shop_proration_quotes q on q.id=a.quote_id
 where a.subscription_id=s.id and q.catalog_terms_id=s.catalog_terms_id and a.cycle_start=s.current_period_start and a.period_end=s.current_period_end
 order by a.settled_at desc,a.quote_id desc limit 1;
 if old_commerce is null then
 select p.snapshot into old_commerce from public.shop_xpay_payments p join public.shop_xpay_orders o on o.id=p.order_id
 where o.subscription_id=s.id and o.catalog_terms_id=s.catalog_terms_id and p.period_start>=s.current_period_start and p.period_end<=s.current_period_end
 order by p.period_start desc,p.id desc limit 1;
 end if;
 if old_terms.currency is distinct from (c->>'currency') then return 'term_end';end if;
 old_rate:=coalesce((old_commerce->>'effectivePriceAmount')::numeric,old_terms.price_amount);
 if old_terms.billing_interval='annual' and c->>'billingInterval'='monthly' then return 'term_end';end if;
 if old_terms.billing_interval=c->>'billingInterval' and (c->>'effectivePriceAmount')::numeric<old_rate then return 'term_end';end if;
 foreach key in array array['active_locations','active_members','active_products','active_services','active_customers','active_suppliers'] loop
 old_limit:=(coalesce(old_commerce->'resourceLimits',old_terms.resource_limits)->>key)::numeric;
 new_limit:=(c->'resourceLimits'->>key)::numeric;
 if new_limit is not null and (old_limit is null or new_limit<old_limit) then return 'term_end';end if;
 end loop;
 if exists(select 1 from jsonb_each(coalesce(old_commerce->'entitlements',old_terms.offer_entitlements,'{}')) feature
 where feature.value='true'::jsonb and coalesce(c->'entitlements'->feature.key,'false'::jsonb)<>'true'::jsonb) then return 'term_end';end if;
 return 'now';
end $$;


-- Preserve existing authority/policy from 20261013173519_proration_settlement.sql; make currency explicit.
create or replace function public.shop_xpay_proration_status(p_shop_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;balance bigint;
begin s:=shop_private.proration_owner_subscription(p_shop_id);
 select balance_minor into balance from public.shop_proration_credit_accounts where subscription_id=s.id and currency=(select currency from public.plan_catalog_terms where id=s.catalog_terms_id);
 return jsonb_build_object('enabled',exists(select 1 from shop_private.proration_configuration where singleton and enabled),'currency',(select currency from public.plan_catalog_terms where id=s.catalog_terms_id),'creditBalances',coalesce((select jsonb_object_agg(currency,balance_minor) from public.shop_proration_credit_accounts where subscription_id=s.id),'{}'::jsonb),'creditBalanceMinor',coalesce(balance,0));
end $$;


-- Preserve existing authority/policy from 20261013115916_xpay_checkout_readiness_scheduler.sql; make currency explicit.
create or replace function public.shop_xpay_checkout_status(p_shop_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c shop_private.xpay_configuration;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not shop_private.is_owner(p_shop_id) then
 raise exception 'SHOP_OWNER_REQUIRED' using errcode='42501';end if;
 select * into c from shop_private.xpay_configuration where singleton;
 return jsonb_build_object('enabled',coalesce(c.enabled,false),'merchantId',c.merchant_id,'mode',c.mode,'usdEnabled',coalesce(c.usd_enabled,false));
end $$;

-- Paired amounts are append-only provider evidence. Commercial receipts retain
-- the original customer currency; bank processing never substitutes for it.
create table public.shop_xpay_money_tracks(
 order_id uuid primary key references public.shop_xpay_orders(id) on delete restrict,
 session_id text not null unique,processing_currency text not null check(processing_currency='EGP'),
 processing_amount_minor bigint not null check(processing_amount_minor between 1 and 9007199254740991),
 presentment_currency text not null check(presentment_currency in('EGP','USD')),
 presentment_amount_minor bigint not null check(presentment_amount_minor between 1 and 999999999999),
 exchange_rate numeric,exchange_rate_id text,bound_at timestamptz not null default clock_timestamp(),
 check((presentment_currency='EGP' and processing_amount_minor=presentment_amount_minor and exchange_rate is null and exchange_rate_id is null)
 or(presentment_currency='USD' and exchange_rate is not null and exchange_rate_id is not null and exchange_rate>0 and exchange_rate::text not in('NaN','Infinity','-Infinity') and length(exchange_rate_id) between 1 and 255))
);
create table public.shop_xpay_processing_receipts(
 order_id uuid primary key references public.shop_xpay_money_tracks(order_id) on delete restrict,
 payment_intent_id text not null unique,fee_details jsonb,received_at timestamptz not null default clock_timestamp()
);
create table public.shop_xpay_refund_observations(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,refund_id text not null unique check(length(refund_id) between 1 and 255),
 order_id uuid not null references public.shop_xpay_money_tracks(order_id) on delete restrict,
 processing_currency text not null check(processing_currency='EGP'),processing_amount_minor bigint not null check(processing_amount_minor>0),
 presentment_currency text not null check(presentment_currency in('EGP','USD')),presentment_amount_minor bigint not null check(presentment_amount_minor>0),
 reviewed_by uuid not null references auth.users(id),reason text not null check(length(btrim(reason)) between 1 and 500),
 provider_evidence_digest text not null check(provider_evidence_digest ~ '^[a-f0-9]{64}$'),verified_at timestamptz not null default clock_timestamp()
);
alter table public.shop_xpay_money_tracks enable row level security;
alter table public.shop_xpay_processing_receipts enable row level security;
alter table public.shop_xpay_refund_observations enable row level security;
revoke all on public.shop_xpay_money_tracks,public.shop_xpay_processing_receipts,public.shop_xpay_refund_observations from public,anon,authenticated,service_role;
create trigger shop_xpay_money_tracks_immutable before update or delete or truncate on public.shop_xpay_money_tracks for each statement execute function shop_private.reject_commercial_snapshot_mutation();
create trigger shop_xpay_processing_receipts_immutable before update or delete or truncate on public.shop_xpay_processing_receipts for each statement execute function shop_private.reject_commercial_snapshot_mutation();
create trigger shop_xpay_refund_observations_immutable before update or delete or truncate on public.shop_xpay_refund_observations for each statement execute function shop_private.reject_commercial_snapshot_mutation();

create function shop_private.xpay_capture_money(p_session jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.shop_xpay_orders;m public.shop_xpay_money_tracks;processing numeric;presentment numeric;currency text;rate numeric;rate_id text;mirror jsonb;
begin
 perform shop_private.xpay_server_required();
 select * into o from public.shop_xpay_orders where id=(p_session#>>'{metadata,orderId}')::uuid;
 if o.id is null then return p_session;end if;
 perform shop_private.lock_all_plan_resources(o.shop_id);
 perform 1 from public.subscriptions where id=o.subscription_id for update;
 select * into o from public.shop_xpay_orders where id=o.id for update;
 if p_session->>'object' is distinct from 'checkout.session' or p_session->>'merchantId' is distinct from o.merchant_id or p_session->>'currency' is distinct from 'EGP'
 or (p_session->>'livemode')::boolean is distinct from (o.mode='live') or p_session->>'id' is null or p_session->>'id' !~ ('^cs_'||o.mode||'_[A-Za-z0-9]+$')
 or (o.session_id is not null and o.session_id<>p_session->>'id') or jsonb_typeof(p_session->'amountTotal') is distinct from 'number' then raise exception 'XPAY_SESSION_MISMATCH' using errcode='22023';end if;
 processing:=(p_session->>'amountTotal')::numeric;
 if processing<1 or processing>9007199254740991 or processing<>round(processing) then raise exception 'XPAY_SESSION_MISMATCH' using errcode='22023';end if;
 mirror:=p_session->'presentmentDetails';
 if mirror is null or mirror='null'::jsonb then currency:='EGP';presentment:=processing;
 else
 currency:=mirror->>'currency';
 if jsonb_typeof(mirror->'amountTotal') is distinct from 'number' then raise exception 'XPAY_SESSION_MISMATCH' using errcode='22023';end if;
 presentment:=(mirror->>'amountTotal')::numeric;
 if currency='USD' then
 if jsonb_typeof(mirror->'exchangeRate') is distinct from 'number' then raise exception 'XPAY_SESSION_MISMATCH' using errcode='22023';end if;
 rate:=(mirror->>'exchangeRate')::numeric;rate_id:=mirror->>'exchangeRateId';
 if rate is null or rate<=0 or rate::text in('NaN','Infinity','-Infinity') or rate_id is null or length(rate_id) not between 1 and 255 then raise exception 'XPAY_SESSION_MISMATCH' using errcode='22023';end if;
 elsif currency is distinct from 'EGP' or presentment<>processing then raise exception 'XPAY_SESSION_MISMATCH' using errcode='22023';end if;
 end if;
 if currency is distinct from o.currency or presentment is distinct from o.amount_minor::numeric then raise exception 'XPAY_SESSION_MISMATCH' using errcode='22023';end if;
 insert into public.shop_xpay_money_tracks(order_id,session_id,processing_currency,processing_amount_minor,presentment_currency,presentment_amount_minor,exchange_rate,exchange_rate_id)
 values(o.id,p_session->>'id','EGP',processing::bigint,currency,presentment::bigint,rate,rate_id) on conflict(order_id) do nothing;
 select * into m from public.shop_xpay_money_tracks where order_id=o.id;
 if m.session_id<>p_session->>'id' or m.processing_amount_minor<>processing or m.presentment_currency<>currency or m.presentment_amount_minor<>presentment or m.exchange_rate is distinct from rate or m.exchange_rate_id is distinct from rate_id then raise exception 'XPAY_MONEY_TRACKS_CHANGED' using errcode='22023';end if;
 -- Only the private, unchanged commercial settlement implementation receives
 -- normalized commercial totals, after raw paired-track verification above.
 return p_session||jsonb_build_object('currency',currency,'amountTotal',presentment);
end $$;
revoke all on function shop_private.xpay_capture_money(jsonb) from public,anon,authenticated,service_role;

alter function public.shop_xpay_bind_session(uuid,jsonb) set schema shop_private;
alter function shop_private.shop_xpay_bind_session(uuid,jsonb) rename to xpay_bind_commercial_session;
revoke all on function shop_private.xpay_bind_commercial_session(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.shop_xpay_bind_session(p_order_id uuid,p_session jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform shop_private.xpay_server_required();
 if p_session#>>'{metadata,orderId}' is distinct from p_order_id::text then raise exception 'XPAY_SESSION_MISMATCH' using errcode='22023';end if;
 return shop_private.xpay_bind_commercial_session(p_order_id,shop_private.xpay_capture_money(p_session));
end $$;
alter function public.shop_xpay_apply_session(jsonb,text) set schema shop_private;
alter function shop_private.shop_xpay_apply_session(jsonb,text) rename to xpay_apply_commercial_session;
revoke all on function shop_private.xpay_apply_commercial_session(jsonb,text) from public,anon,authenticated,service_role;
create function public.shop_xpay_apply_session(p_session jsonb,p_event_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform shop_private.xpay_server_required();
 result:=shop_private.xpay_apply_commercial_session(shop_private.xpay_capture_money(p_session),p_event_id);
 -- The original validator checks paid status and flat/expanded intent IDs
 -- before a processing receipt is written. All effects share this transaction.
 if p_session->>'status'='complete' and p_session->>'paymentStatus'='paid' and exists(select 1 from public.shop_xpay_money_tracks where order_id=(p_session#>>'{metadata,orderId}')::uuid) then
 insert into public.shop_xpay_processing_receipts(order_id,payment_intent_id,fee_details)
 values((p_session#>>'{metadata,orderId}')::uuid,coalesce(p_session->>'paymentIntentId',p_session#>>'{paymentIntent,id}'),p_session->'processingFeeDetails') on conflict(order_id) do nothing;
 end if;
 return result;
end $$;
revoke all on function public.shop_xpay_bind_session(uuid,jsonb),public.shop_xpay_apply_session(jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.shop_xpay_bind_session(uuid,jsonb),public.shop_xpay_apply_session(jsonb,text) to service_role;

-- This records a provider-confirmed refund; it never sends a refund request,
-- converts units, changes the original receipt or issues/revokes subscription
-- access. Partial USD refunds require separately verified paired evidence.
create function public.shop_xpay_record_refund(p_request_id uuid,p_order_id uuid,p_refund jsonb,p_reviewed_by uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.shop_xpay_money_tracks;r public.shop_xpay_refund_observations;pc numeric;cc numeric;used_processing bigint;used_presentment bigint;o public.shop_xpay_orders;
begin
 perform shop_private.xpay_server_required();
 if p_request_id is null or p_order_id is null or p_reviewed_by is null or not exists(select 1 from auth.users where id=p_reviewed_by)
 or p_reason is null or length(btrim(p_reason)) not between 1 and 500 or p_refund->>'status' is distinct from 'succeeded'
 or p_refund->>'refundId' is null or length(p_refund->>'refundId') not between 1 and 255 or p_refund->>'providerEvidenceDigest' is null or p_refund->>'providerEvidenceDigest' !~ '^[a-f0-9]{64}$'
 or p_refund->>'amountTrackEvidence' is distinct from 'provider_presentment_and_processing' then raise exception 'XPAY_REFUND_EVIDENCE_REQUIRED' using errcode='22023';end if;
 select * into o from public.shop_xpay_orders where id=p_order_id;
 if o.id is null then raise exception 'XPAY_REFUND_MISMATCH' using errcode='22023';end if;
 perform shop_private.lock_all_plan_resources(o.shop_id);
 perform 1 from public.subscriptions where id=o.subscription_id for update;
 select * into m from public.shop_xpay_money_tracks where order_id=p_order_id for update;
 if m.order_id is null or not exists(select 1 from public.shop_xpay_paid_observations where order_id=p_order_id and session_id=m.session_id)
 or p_refund->>'sessionId' is distinct from m.session_id or p_refund#>>'{processing,currency}' is distinct from m.processing_currency or p_refund#>>'{presentment,currency}' is distinct from m.presentment_currency
 or jsonb_typeof(p_refund#>'{processing,amountMinor}') is distinct from 'number' or jsonb_typeof(p_refund#>'{presentment,amountMinor}') is distinct from 'number' then raise exception 'XPAY_REFUND_MISMATCH' using errcode='22023';end if;
 pc:=(p_refund#>>'{processing,amountMinor}')::numeric;cc:=(p_refund#>>'{presentment,amountMinor}')::numeric;
 if pc<1 or pc<>round(pc) or pc>m.processing_amount_minor or cc<1 or cc<>round(cc) or cc>m.presentment_amount_minor then raise exception 'XPAY_REFUND_AMOUNT_INVALID' using errcode='22023';end if;
 select * into r from public.shop_xpay_refund_observations where request_id=p_request_id or refund_id=p_refund->>'refundId';
 if found then
 if r.request_id<>p_request_id or r.order_id<>p_order_id or r.refund_id<>p_refund->>'refundId' or r.processing_amount_minor<>pc or r.presentment_amount_minor<>cc or r.reviewed_by<>p_reviewed_by or r.reason<>btrim(p_reason) or r.provider_evidence_digest<>p_refund->>'providerEvidenceDigest' then raise exception 'XPAY_REFUND_KEY_REUSED' using errcode='22023';end if;
 return jsonb_build_object('refundId',r.refund_id,'recorded',true);end if;
 select coalesce(sum(processing_amount_minor),0),coalesce(sum(presentment_amount_minor),0) into used_processing,used_presentment from public.shop_xpay_refund_observations where order_id=p_order_id;
 if used_processing+pc>m.processing_amount_minor or used_presentment+cc>m.presentment_amount_minor then raise exception 'XPAY_REFUND_EXCEEDS_PAYMENT' using errcode='22023';end if;
 insert into public.shop_xpay_refund_observations(request_id,refund_id,order_id,processing_currency,processing_amount_minor,presentment_currency,presentment_amount_minor,reviewed_by,reason,provider_evidence_digest)
 values(p_request_id,p_refund->>'refundId',p_order_id,m.processing_currency,pc::bigint,m.presentment_currency,cc::bigint,p_reviewed_by,btrim(p_reason),p_refund->>'providerEvidenceDigest');
 return jsonb_build_object('refundId',p_refund->>'refundId','recorded',true);
end $$;
revoke all on function public.shop_xpay_record_refund(uuid,uuid,jsonb,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.shop_xpay_record_refund(uuid,uuid,jsonb,uuid,text) to service_role;

create function public.shop_billing_currency_plans(p_shop_id uuid,p_currency text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;result jsonb;
begin
 s:=shop_private.proration_owner_subscription(p_shop_id);
 if p_currency not in('EGP','USD') or p_currency is null then raise exception 'XPAY_CURRENCY_UNSUPPORTED' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('planId',p.id,'planSlug',p.slug,'planName',t.display_name,'catalogTermsId',t.id,'planVariant',t.plan_variant,'variantName',t.variant_name,'billingInterval',t.billing_interval,'currency',t.currency,
 'listPriceAmount',(price.q->>'listPriceAmount')::numeric,'effectivePriceAmount',(price.q->>'effectivePriceAmount')::numeric,'priceSource',price.q->>'priceSource','resourceLimits',t.resource_limits,'blockers',shop_private.plan_change_blockers(p_shop_id,t.resource_limits)) order by p.sort_order,t.plan_variant,t.billing_interval),'[]') into result
 from public.plans p join public.portals portal on portal.id=p.portal_id cross join lateral shop_private.current_plan_offers_currency(p.id,p_currency) t
 cross join lateral(select shop_private.subscription_effective_price(s.id,t.id,clock_timestamp()) q) price
 where portal.key='shop-crm' and p.is_active and p.is_public and p.is_purchasable and not p.is_coming_soon and t.is_public and t.is_purchasable;
 return result;
end $$;
revoke all on function public.shop_billing_currency_plans(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.shop_billing_currency_plans(uuid,text) to authenticated;
notify pgrst,'reload schema';

-- Preserve existing authority/policy from 20261013104931_xpay_payment_orders.sql; make currency explicit.
create or replace function shop_private.xpay_order_view(o public.shop_xpay_orders) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',o.id,'idempotencyKey',o.request_id,'shopId',o.shop_id,'merchantId',o.merchant_id,'mode',o.mode,
 'amountMinor',o.amount_minor,'currency',o.currency,'description',o.quote->>'planName','state',o.state,'sessionId',o.session_id,
 'url',o.checkout_url,'expiresAt',o.expires_at,'createdAt',o.created_at,'quote',o.quote,
 'expiresAfterMinutes',30,'sessionRequest',o.session_request,'moneyTracks',(select jsonb_build_object('processing',jsonb_build_object('currency',m.processing_currency,'amountMinor',m.processing_amount_minor),'presentment',jsonb_build_object('currency',m.presentment_currency,'amountMinor',m.presentment_amount_minor),'exchangeRate',case when m.exchange_rate is null then null else jsonb_build_object('id',m.exchange_rate_id,'rate',m.exchange_rate) end) from public.shop_xpay_money_tracks m where m.order_id=o.id),'refundedAmountMinor',coalesce((select sum(r.presentment_amount_minor) from public.shop_xpay_refund_observations r where r.order_id=o.id),0));
$$;
