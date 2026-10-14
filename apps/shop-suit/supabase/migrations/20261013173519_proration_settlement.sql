-- Preserve historical quarterly prepaid periods when switching to supported monthly/annual terms.
-- Dormant internal calculation layer. No public API, order/payment mutation,
-- access activation or credit issuance is introduced by this migration.
-- Inputs will be derived from locked server records by the settlement layer.
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
 or p_same_terms is null or p_currency is distinct from 'EGP' then
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

-- Gated financial implementation. Disabled by default; no hosted changes.
-- Enable only after checkout integration and disposable/native validation.
create table shop_private.proration_configuration(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into shop_private.proration_configuration values(true,false);
alter table shop_private.proration_configuration enable row level security;
revoke all on shop_private.proration_configuration from public,anon,authenticated,service_role;
create table public.shop_proration_credit_accounts(
 subscription_id uuid primary key references public.subscriptions(id) on delete restrict,
 currency text not null default 'EGP' check(currency='EGP'),balance_minor bigint not null default 0 check(balance_minor>=0),
 version bigint not null default 0 check(version>=0),updated_at timestamptz not null default clock_timestamp()
);
create table public.shop_proration_quotes(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 shop_id uuid not null references public.shops(id) on delete restrict,
 subscription_id uuid not null references public.subscriptions(id) on delete restrict,
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 catalog_terms_id uuid not null references public.plan_catalog_terms(id) on delete restrict,
 private_offer_id uuid references public.shop_private_offers(id) on delete restrict,
 parameters jsonb not null,subscription_before jsonb not null,credit_version bigint not null,
 commerce jsonb not null,calculation jsonb not null,funding_evidence jsonb not null,
 expires_at timestamptz not null,created_at timestamptz not null default clock_timestamp(),
 state text not null default 'quoted' check(state in ('quoted','checkout','settled','requires_review','abandoned')),
 xpay_order_id uuid unique references public.shop_xpay_orders(id) on delete restrict
);
create unique index shop_proration_one_unresolved on public.shop_proration_quotes(subscription_id) where state in ('quoted','checkout','requires_review');
create index shop_proration_quotes_shop_created on public.shop_proration_quotes(shop_id,created_at desc);
create index shop_proration_quotes_actor on public.shop_proration_quotes(actor_user_id);
create index shop_proration_quotes_terms on public.shop_proration_quotes(catalog_terms_id);
create index shop_proration_quotes_offer on public.shop_proration_quotes(private_offer_id) where private_offer_id is not null;
create table public.shop_proration_settlements(
 quote_id uuid primary key references public.shop_proration_quotes(id) on delete restrict,
 subscription_id uuid not null references public.subscriptions(id) on delete restrict,
 cash_minor bigint not null check(cash_minor>=0),xpay_order_id uuid unique references public.shop_xpay_orders(id) on delete restrict,
 period_start timestamptz not null,period_end timestamptz not null check(period_end>period_start),
 cycle_start timestamptz not null,prepaid_value_minor numeric not null check(prepaid_value_minor>=0),
 subscription_before jsonb not null,settled_at timestamptz not null default clock_timestamp(),
 check((cash_minor=0)=(xpay_order_id is null))
);
create index shop_proration_settlements_subscription on public.shop_proration_settlements(subscription_id,settled_at desc);
create table public.shop_proration_credit_ledger(
 quote_id uuid primary key references public.shop_proration_quotes(id) on delete restrict,
 subscription_id uuid not null references public.subscriptions(id) on delete restrict,
 currency text not null check(currency='EGP'),version_before bigint not null,version_after bigint not null,
 balance_before_minor bigint not null check(balance_before_minor>=0),balance_after_minor bigint not null check(balance_after_minor>=0),
 delta_minor bigint not null,cash_minor bigint not null check(cash_minor>=0),
 unused_prepaid_minor numeric not null check(unused_prepaid_minor>=0),service_value_minor numeric not null check(service_value_minor>=0),
 rounding_adjustment_minor numeric not null,created_at timestamptz not null default clock_timestamp(),
 unique(subscription_id,version_after),check(version_after=version_before+1),
 check(balance_after_minor=balance_before_minor+delta_minor),
 check(cash_minor+balance_before_minor+unused_prepaid_minor-service_value_minor-balance_after_minor=rounding_adjustment_minor)
);
create index shop_proration_ledger_subscription_created on public.shop_proration_credit_ledger(subscription_id,created_at desc);
alter table public.subscription_commercial_periods add column proration_quote_id uuid unique references public.shop_proration_quotes(id) on delete restrict;
alter table public.shop_proration_credit_accounts enable row level security;
revoke all on public.shop_proration_credit_accounts from public,anon,authenticated,service_role;
alter table public.shop_proration_quotes enable row level security;
revoke all on public.shop_proration_quotes from public,anon,authenticated,service_role;
alter table public.shop_proration_settlements enable row level security;
revoke all on public.shop_proration_settlements from public,anon,authenticated,service_role;
alter table public.shop_proration_credit_ledger enable row level security;
revoke all on public.shop_proration_credit_ledger from public,anon,authenticated,service_role;
create trigger shop_proration_settlements_immutable before update or delete or truncate on public.shop_proration_settlements for each statement execute function shop_private.reject_commercial_snapshot_mutation();
create trigger shop_proration_credit_ledger_immutable before update or delete or truncate on public.shop_proration_credit_ledger for each statement execute function shop_private.reject_commercial_snapshot_mutation();

create function shop_private.proration_enabled() returns void language plpgsql stable security invoker set search_path='' as $$
begin if not exists(select 1 from shop_private.proration_configuration where singleton and enabled) then raise exception 'SHOP_PRORATION_NOT_ENABLED' using errcode='55000';end if;end $$;
create function shop_private.proration_owner_subscription(p_shop_id uuid) returns public.subscriptions
language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) or not shop_private.is_owner(p_shop_id) then
 raise exception 'SHOP_OWNER_REQUIRED' using errcode='42501';end if;
 perform shop_private.lock_all_plan_resources(p_shop_id);
 select subscription.* into s from public.shop_memberships m join public.subscriptions subscription on subscription.profile_id=m.profile_id
 join public.profiles p on p.id=m.profile_id where m.shop_id=p_shop_id and m.role='owner' and m.status='active' and p.user_id=auth.uid()
 order by m.created_at,m.id limit 1 for update of subscription;
 if s.id is null then raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode='22023';end if;
 if s.status='suspended' or exists(select 1 from public.shops where id=p_shop_id and status<>'active') then raise exception 'XPAY_ACCESS_SUSPENDED' using errcode='42501';end if;
 return s;
end $$;
create function shop_private.proration_quote_view(q public.shop_proration_quotes) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('quoteId',q.id,'state',q.state,'shopId',q.shop_id,'planName',q.commerce->>'planName',
 'catalogTermsId',q.catalog_terms_id,'privateOfferId',q.private_offer_id,'createdAt',q.created_at,'expiresAt',q.expires_at,
 'calculation',q.calculation,'xpayOrderId',q.xpay_order_id);
$$;

create function shop_private.proration_target(p_shop_id uuid,p_subscription_id uuid,p_catalog_terms_id uuid,p_private_offer jsonb)
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
 if t.currency<>'EGP' or amount<=0 or amount<>round(amount,2) then raise exception 'XPAY_QUOTE_INVALID' using errcode='22023'; end if;
 q:=q||jsonb_build_object('planId',t.plan_id,'planName',t.display_name,'planSlug',(select slug from public.plans where id=t.plan_id),
 'catalogTermsId',t.id,'planVariant',t.plan_variant,'billingInterval',t.billing_interval,'resourceLimits',t.resource_limits,'entitlements',t.offer_entitlements,'offerBinding',preview-array['submissionId','blockers','xpayOrderId','settledQuoteId']);
 return q;
end $$;

create function shop_private.proration_funding(s public.subscriptions,p_as_of timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.shop_proration_settlements;value numeric:=0;evidence jsonb:='[]';row record;
begin
 if s.status<>'active' or s.current_period_end<=p_as_of then return jsonb_build_object('source','none','unusedMinor','0','evidence',evidence);end if;
 select settled.* into a from public.shop_proration_settlements settled join public.shop_proration_quotes q on q.id=settled.quote_id
 where settled.subscription_id=s.id and q.catalog_terms_id=s.catalog_terms_id and settled.cycle_start=s.current_period_start
 and settled.period_end=s.current_period_end order by settled.settled_at desc,settled.quote_id desc limit 1;
 if found then
 value:=a.prepaid_value_minor*extract(epoch from a.period_end-p_as_of)/extract(epoch from a.period_end-a.period_start);
 evidence:=jsonb_build_array(jsonb_build_object('kind','allocation','id',a.quote_id,'valueMinor',a.prepaid_value_minor::text,'start',a.period_start,'end',a.period_end));
 else
 for row in
 select 'xpay'::text kind,p.id,p.amount_minor::numeric amount,p.period_start start_at,p.period_end end_at
 from public.shop_xpay_payments p join public.shop_xpay_orders o on o.id=p.order_id
 join public.shop_xpay_paid_observations observation on observation.order_id=p.order_id and observation.amount_minor=p.amount_minor and observation.currency=p.currency and observation.session_id=p.session_id and observation.payment_intent_id=p.payment_intent_id
 where o.subscription_id=s.id and o.catalog_terms_id=s.catalog_terms_id and o.currency='EGP'
 and o.quote->>'prorationQuoteId' is null and p.period_start>=s.current_period_start and p.period_end<=s.current_period_end
 and not exists(select 1 from public.shop_proration_settlements consumed join public.shop_proration_quotes cq on cq.id=consumed.quote_id
 where consumed.subscription_id=s.id and cq.funding_evidence @> jsonb_build_array(jsonb_build_object('kind','xpay','id',p.id)))
 union all
 select 'manual',period.id,notice.received_amount*100,period.period_start,period.period_end
 from public.subscription_commercial_periods period join public.shop_billing_submissions notice on notice.id=period.billing_submission_id
 where period.subscription_id=s.id and period.catalog_terms_id=s.catalog_terms_id and period.currency='EGP'
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
create function public.shop_xpay_proration_quote(p_request_id uuid,p_shop_id uuid,p_catalog_terms_id uuid,p_private_offer jsonb default null)
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
 at:=clock_timestamp();funding:=shop_private.proration_funding(s,at);
 calculation:=shop_private.proration_quote_v1(at,case when s.status='trialing' and s.trial_end_at<=at then 'expired' else s.status end,
 funding->>'source',s.current_period_start,s.current_period_end,at,(funding->>'unusedMinor')::numeric,
 old_interval,commerce->>'billingInterval',((commerce->>'effectivePriceAmount')::numeric*100)::bigint,a.balance_minor,s.catalog_terms_id=target);
 parameters:=jsonb_build_object('catalogTermsId',p_catalog_terms_id,'privateOffer',p_private_offer-'redemptionToken');
 insert into public.shop_proration_quotes(request_id,shop_id,subscription_id,actor_user_id,catalog_terms_id,private_offer_id,parameters,subscription_before,credit_version,commerce,calculation,funding_evidence,expires_at)
 values(p_request_id,p_shop_id,s.id,auth.uid(),target,offer,parameters,to_jsonb(s),a.version,commerce,calculation,funding->'evidence',(calculation->>'expiresAt')::timestamptz) returning * into q;
 return shop_private.proration_quote_view(q);
end $$;
create function public.shop_xpay_proration_read(p_shop_id uuid,p_quote_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;q public.shop_proration_quotes;
begin
 s:=shop_private.proration_owner_subscription(p_shop_id);
 select * into q from public.shop_proration_quotes where id=p_quote_id and shop_id=p_shop_id and subscription_id=s.id;
 if q.id is null then raise exception 'SHOP_PRORATION_QUOTE_UNAVAILABLE' using errcode='42501';end if;
 return shop_private.proration_quote_view(q);
end $$;
create function shop_private.proration_validate(q public.shop_proration_quotes,s public.subscriptions,a public.shop_proration_credit_accounts) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 return q.subscription_before=to_jsonb(s) and a.version=q.credit_version and a.balance_minor=(q.calculation->>'creditBeforeMinor')::bigint
 and q.expires_at>clock_timestamp() and shop_private.proration_funding(s,(q.calculation->>'quotedAt')::timestamptz)->'evidence'=q.funding_evidence
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
create function public.shop_xpay_proration_order(p_shop_id uuid,p_quote_id uuid) returns jsonb
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
 select * into c from shop_private.xpay_configuration where singleton and enabled;
 if not found then raise exception 'XPAY_NOT_CONFIGURED' using errcode='55000';end if;
 if exists(select 1 from public.shop_xpay_orders where subscription_id=s.id and state in ('creating','open','pending','requires_review')) then raise exception 'XPAY_ORDER_ALREADY_OPEN' using errcode='55000';end if;
 insert into public.shop_xpay_orders(request_id,shop_id,subscription_id,actor_user_id,merchant_id,mode,catalog_terms_id,private_offer_id,quote,subscription_before,amount_minor,currency)
 values(q.request_id,q.shop_id,q.subscription_id,q.actor_user_id,c.merchant_id,c.mode,q.catalog_terms_id,q.private_offer_id,
 q.commerce||jsonb_build_object('prorationQuoteId',q.id,'proration',q.calculation),q.subscription_before,(q.calculation->>'amountDueMinor')::bigint,'EGP') returning * into o;
 update public.shop_proration_quotes set state='checkout',xpay_order_id=o.id where id=q.id;
 return shop_private.xpay_order_view(o);
end $$;

create function shop_private.proration_settle(p_quote_id uuid,p_order_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare q public.shop_proration_quotes;s public.subscriptions;a public.shop_proration_credit_accounts;o public.shop_xpay_orders;
 observation public.shop_xpay_paid_observations;receipt public.shop_xpay_payments;settled public.shop_proration_settlements;
 due bigint;credit_after bigint;start_at timestamptz;end_at timestamptz;cycle_start timestamptz;
begin
 select * into q from public.shop_proration_quotes where id=p_quote_id;
 if q.id is null then raise exception 'SHOP_PRORATION_QUOTE_UNAVAILABLE' using errcode='42501';end if;
 perform shop_private.lock_all_plan_resources(q.shop_id);
 select * into s from public.subscriptions where id=q.subscription_id for update;
 select * into a from public.shop_proration_credit_accounts where subscription_id=s.id for update;
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
 or o.currency<>'EGP' or observation.order_id is null or observation.amount_minor<>due or observation.currency<>'EGP'
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
 values(o.id,observation.session_id,observation.payment_intent_id,o.merchant_id,o.mode,due,'EGP',start_at,end_at,o.quote) returning * into receipt;
 end if;
 insert into public.shop_proration_settlements(quote_id,subscription_id,cash_minor,xpay_order_id,period_start,period_end,cycle_start,prepaid_value_minor,subscription_before)
 values(q.id,s.id,due,p_order_id,start_at,end_at,cycle_start,(q.calculation->>'serviceValueMinor')::numeric,q.subscription_before);
 insert into public.shop_proration_credit_ledger(quote_id,subscription_id,currency,version_before,version_after,balance_before_minor,balance_after_minor,delta_minor,cash_minor,unused_prepaid_minor,service_value_minor,rounding_adjustment_minor)
 values(q.id,s.id,'EGP',a.version,a.version+1,a.balance_minor,credit_after,credit_after-a.balance_minor,due,(q.calculation->>'unusedPrepaidMinor')::numeric,(q.calculation->>'serviceValueMinor')::numeric,(q.calculation->>'roundingAdjustmentMinor')::numeric);
 update public.shop_proration_credit_accounts set balance_minor=credit_after,version=version+1,updated_at=clock_timestamp() where subscription_id=s.id;
 perform set_config('shop.proration_quote_id',q.id::text,true);
 update public.subscriptions set plan_id=(q.commerce->>'planId')::uuid,catalog_terms_id=q.catalog_terms_id,status='active',current_period_start=cycle_start,current_period_end=end_at,locked_at=null,updated_at=clock_timestamp() where id=s.id;
 insert into public.subscription_commercial_periods(subscription_id,catalog_terms_id,plan_slug,plan_name,plan_variant,billing_interval,currency,price_amount,list_price_amount,price_override_id,resource_limits,period_start,period_end,approved_at,xpay_order_id,offer_entitlements,proration_quote_id)
 values(s.id,q.catalog_terms_id,q.commerce->>'planSlug',q.commerce->>'planName',q.commerce->>'planVariant',q.commerce->>'billingInterval','EGP',due::numeric/100,
 (q.commerce->>'listPriceAmount')::numeric,(q.commerce->>'priceOverrideId')::uuid,q.commerce->'resourceLimits',start_at,end_at,clock_timestamp(),p_order_id,q.commerce->'entitlements',q.id);
 update public.shop_proration_quotes set state='settled' where id=q.id returning * into q;
 if due>0 then update public.shop_xpay_orders set state='paid',updated_at=clock_timestamp() where id=o.id;end if;
 return shop_private.proration_quote_view(q);
end $$;
create function public.shop_xpay_proration_credit_confirm(p_shop_id uuid,p_quote_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;q public.shop_proration_quotes;
begin
 s:=shop_private.proration_owner_subscription(p_shop_id);perform shop_private.proration_enabled();
 select * into q from public.shop_proration_quotes where id=p_quote_id and shop_id=p_shop_id and subscription_id=s.id and actor_user_id=auth.uid();
 if q.id is null then raise exception 'SHOP_PRORATION_QUOTE_UNAVAILABLE' using errcode='42501';end if;
 if (q.calculation->>'amountDueMinor')::bigint<>0 then raise exception 'XPAY_PAYMENT_REQUIRED' using errcode='55000';end if;
 return shop_private.proration_settle(q.id,null);
end $$;
create function public.shop_xpay_proration_abandon(p_shop_id uuid,p_quote_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;q public.shop_proration_quotes;o public.shop_xpay_orders;
begin
 s:=shop_private.proration_owner_subscription(p_shop_id);
 select * into q from public.shop_proration_quotes where id=p_quote_id and shop_id=p_shop_id and subscription_id=s.id and actor_user_id=auth.uid() for update;
 if q.id is null then raise exception 'SHOP_PRORATION_QUOTE_UNAVAILABLE' using errcode='42501';end if;
 if q.state='abandoned' then return shop_private.proration_quote_view(q);end if;
 if q.state not in ('quoted','checkout') then raise exception 'SHOP_PRORATION_REVIEW_REQUIRED' using errcode='55000';end if;
 if q.xpay_order_id is not null then
 select * into o from public.shop_xpay_orders where id=q.xpay_order_id for update;
 if o.state not in ('expired','failed') then
 -- Once a session request was frozen, a lost provider response may represent
 -- money in flight. Never abandon it based on a browser close/cancel action.
 if o.state<>'creating' or o.session_request is not null or o.session_id is not null then raise exception 'SHOP_PRORATION_PAYMENT_UNRESOLVED' using errcode='55000';end if;
 update public.shop_xpay_orders set state='failed',updated_at=clock_timestamp() where id=o.id;
 end if;
 end if;
 update public.shop_proration_quotes set state='abandoned' where id=q.id returning * into q;
 return shop_private.proration_quote_view(q);
end $$;
create function shop_private.proration_transition_authorized(old_subscription public.subscriptions,new_subscription public.subscriptions)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.shop_proration_settlements settled join public.shop_proration_quotes q on q.id=settled.quote_id
 where q.id::text=current_setting('shop.proration_quote_id',true) and q.subscription_id=old_subscription.id
 and q.subscription_before=to_jsonb(old_subscription) and settled.subscription_before=q.subscription_before
 and new_subscription.plan_id=(q.commerce->>'planId')::uuid and new_subscription.catalog_terms_id=q.catalog_terms_id
 and new_subscription.status='active' and new_subscription.current_period_start=settled.cycle_start and new_subscription.current_period_end=settled.period_end
 and (to_jsonb(new_subscription)-array['plan_id','catalog_terms_id','status','current_period_start','current_period_end','locked_at','updated_at'])
 =(q.subscription_before-array['plan_id','catalog_terms_id','status','current_period_start','current_period_end','locked_at','updated_at'])
 and ((settled.cash_minor=0 and auth.uid()=q.actor_user_id and shop_private.is_owner(q.shop_id))
 or (settled.cash_minor>0 and auth.role()='service_role' and exists(select 1 from public.shop_xpay_payments p where p.order_id=settled.xpay_order_id and p.amount_minor=settled.cash_minor))));
$$;
create function shop_private.proration_preserve_quote() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['state','xpay_order_id']) is distinct from (to_jsonb(old)-array['state','xpay_order_id'])
 or (old.xpay_order_id is not null and new.xpay_order_id is distinct from old.xpay_order_id)
 or (old.state in ('settled','abandoned') and new.state<>old.state) then raise exception 'SHOP_PRORATION_QUOTE_IMMUTABLE' using errcode='55000';end if;
 return new;
end $$;
create trigger shop_proration_quotes_immutable before update on public.shop_proration_quotes for each row execute function shop_private.proration_preserve_quote();

-- Reviews are not a payable checkout. Multiple late real payments can need
-- review simultaneously; admission RPCs still reject any unresolved review.
drop index public.shop_xpay_one_open_subscription;
create unique index shop_xpay_one_open_subscription on public.shop_xpay_orders(subscription_id) where state in ('creating','open','pending');

create or replace function public.shop_xpay_apply_session(p_session jsonb,p_event_id text default null) returns jsonb
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
 if p_session->>'status'='open' and p_session->>'paymentStatus'='unpaid' and o.checkout_url is null then
 if p_session->>'url' is distinct from ('https://checkout.xpay.app/c/'||(p_session->>'id'))
 or (p_session->>'isExpired')::boolean is distinct from false or p_session->>'expiresAt' is null
 or not isfinite((p_session->>'expiresAt')::timestamptz) or (p_session->>'expiresAt')::timestamptz<=clock_timestamp() then
 raise exception 'XPAY_SESSION_UNAVAILABLE' using errcode='22023'; end if;
 update public.shop_xpay_orders set checkout_url=p_session->>'url',expires_at=(p_session->>'expiresAt')::timestamptz,
 updated_at=clock_timestamp() where id=o.id returning * into o;
 end if;
 if p_session->>'paymentStatus'='paid' then
 if p_session->>'status' is distinct from 'complete' or p_session->>'paymentIntentId' is null
 or p_session->>'paymentIntentId' !~ ('^pi_'||o.mode||'_[A-Za-z0-9]+$') then
 raise exception 'XPAY_PAYMENT_NOT_VERIFIED' using errcode='22023'; end if;
 insert into public.shop_xpay_paid_observations(order_id,session_id,payment_intent_id,merchant_id,mode,amount_minor,currency)
 values(o.id,o.session_id,p_session->>'paymentIntentId',o.merchant_id,o.mode,o.amount_minor,o.currency) on conflict(order_id) do nothing;
 select * into observation from public.shop_xpay_paid_observations where order_id=o.id;
 if observation.payment_intent_id<>p_session->>'paymentIntentId' or observation.session_id<>o.session_id then
 raise exception 'XPAY_PAYMENT_ALREADY_BOUND' using errcode='22023'; end if;
 if o.quote->>'prorationQuoteId' is not null then
 perform shop_private.proration_settle((o.quote->>'prorationQuoteId')::uuid,o.id);
 if p_event_id is not null then update public.shop_xpay_inbox set state='processed',processed_at=clock_timestamp() where event_id=p_event_id;end if;
 select * into o from public.shop_xpay_orders where id=o.id;
 return shop_private.xpay_order_view(o);
 end if;
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
 if o.quote->>'prorationQuoteId' is not null and o.state in ('expired','failed') then update public.shop_proration_quotes set state='abandoned' where id=(o.quote->>'prorationQuoteId')::uuid and state='checkout';end if;
 if p_event_id is not null then update public.shop_xpay_inbox set state='processed',processed_at=clock_timestamp() where event_id=p_event_id; end if;
 return shop_private.xpay_order_view(o);
end $$;

create or replace function public.shop_xpay_order_create(p_request_id uuid,p_shop_id uuid,p_catalog_terms_id uuid,
 p_private_offer jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions; o public.shop_xpay_orders; c shop_private.xpay_configuration;
 t public.plan_catalog_terms; q jsonb; offer public.shop_private_offers; preview jsonb; amount numeric;
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
 or o.quote->'offerBinding' is distinct from preview-array['submissionId','blockers','xpayOrderId']))
 then raise exception 'XPAY_REQUEST_KEY_REUSED' using errcode='22023'; end if;
 -- Private offer token authority is rechecked below on new requests; replay must
 -- still require the same owner, and never change a persisted quote.
 return shop_private.xpay_order_view(o);
 end if;
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
 'catalogTermsId',t.id,'planVariant',t.plan_variant,'billingInterval',t.billing_interval,'resourceLimits',t.resource_limits,'entitlements',t.offer_entitlements,'offerBinding',preview-array['submissionId','blockers','xpayOrderId']);
 insert into public.shop_xpay_orders(request_id,shop_id,subscription_id,actor_user_id,merchant_id,mode,catalog_terms_id,private_offer_id,quote,subscription_before,amount_minor,currency)
 values(p_request_id,p_shop_id,s.id,auth.uid(),c.merchant_id,c.mode,t.id,offer.id,q,to_jsonb(s),(amount*100)::bigint,t.currency) returning * into o;
 return shop_private.xpay_order_view(o);
end $$;

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
  if tg_op='UPDATE' and shop_private.proration_transition_authorized(old,new) then v_operator_approval:=true;end if;
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
  if tg_op='UPDATE' and v_changed and shop_private.proration_transition_authorized(old,new) then return new;end if;
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
 elsif new.proration_quote_id is not null then
  new.offer_entitlements:=coalesce((select commerce->'entitlements' from public.shop_proration_quotes where id=new.proration_quote_id),'{}'::jsonb);
 elsif new.xpay_order_id is not null then
  new.offer_entitlements:=coalesce((select quote->'entitlements' from public.shop_xpay_orders where id=new.xpay_order_id),'{}'::jsonb);
 else
  new.offer_entitlements:=coalesce((select offer_entitlements from public.shop_billing_submissions where id=new.billing_submission_id),'{}'::jsonb);
 end if;
 return new;
end $$;

create or replace function public.shop_private_offer_read(p_shop_id uuid,p_offer_id uuid,p_offer_version integer,
 p_target_binding_id uuid,p_target_environment_id uuid,p_redemption_token text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.shop_private_offers;s public.shop_private_offer_security;redeemed uuid; paid_order uuid;settled_quote uuid;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not shop_private.is_owner(p_shop_id) then
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
 select q.id into settled_quote from public.shop_proration_quotes q join public.shop_proration_settlements settled on settled.quote_id=q.id where q.private_offer_id=o.id order by settled.settled_at desc limit 1;
 if redeemed is null and paid_order is null and settled_quote is null and o.expires_at<=statement_timestamp() then
  raise exception 'SHOP_PRIVATE_OFFER_EXPIRED' using errcode='22023';end if;
 return jsonb_build_object('offerId',o.id,'offerVersion',o.offer_version,'shopId',o.shop_id,
 'targetBindingId',o.target_binding_id,'targetEnvironmentId',o.target_environment_id,
 'displayName',o.display_name,'priceAmount',o.price_amount,'currency',o.currency,
 'billingInterval',o.billing_interval,'expiresAt',o.expires_at,'resourceLimits',o.resource_limits,
 'entitlements',s.entitlements,'submissionId',redeemed,'xpayOrderId',paid_order,'settledQuoteId',settled_quote,
 'blockers',shop_private.plan_change_blockers(o.shop_id,o.resource_limits));
end $$;

create or replace function shop_private.billing_subscription_snapshot(p_shop_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', subscription.id, 'status', subscription.status,
    'planId', plan.id, 'planSlug', plan.slug, 'planName', terms.display_name,
    'planVariant', terms.plan_variant, 'variantName', terms.variant_name,
    'priceAmount', (coalesce(prorated.quote,paid.quote,price.quote) ->> 'effectivePriceAmount')::numeric,
    'listPriceAmount', (coalesce(prorated.quote,paid.quote,price.quote) ->> 'listPriceAmount')::numeric,
    'effectivePriceAmount', (coalesce(prorated.quote,paid.quote,price.quote) ->> 'effectivePriceAmount')::numeric,
    'priceSource', coalesce(prorated.quote,paid.quote,price.quote) ->> 'priceSource',
    'priceOverrideId', coalesce(prorated.quote,paid.quote,price.quote) ->> 'priceOverrideId',
    'priceOverrideReason', coalesce(prorated.quote,paid.quote,price.quote) ->> 'priceOverrideReason',
    'priceOverrideEffectiveFrom', coalesce(prorated.quote,paid.quote,price.quote) ->> 'priceOverrideEffectiveFrom',
    'priceOverrideExpiresAt', coalesce(prorated.quote,paid.quote,price.quote) ->> 'priceOverrideExpiresAt',
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
  left join lateral (
    select q.commerce quote from public.shop_proration_settlements settled join public.shop_proration_quotes q on q.id=settled.quote_id
    where settled.subscription_id=subscription.id and q.catalog_terms_id=subscription.catalog_terms_id
      and settled.cycle_start=subscription.current_period_start and settled.period_end=subscription.current_period_end
      and subscription.status='active' and settled.period_end>clock_timestamp()
    order by settled.settled_at desc limit 1
  ) prorated on true
  where shop.id = p_shop_id
  order by (membership.status = 'active') desc, membership.created_at, membership.id limit 1;
$$;

create function public.shop_xpay_proration_status(p_shop_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;balance bigint;
begin s:=shop_private.proration_owner_subscription(p_shop_id);
 select balance_minor into balance from public.shop_proration_credit_accounts where subscription_id=s.id;
 return jsonb_build_object('enabled',exists(select 1 from shop_private.proration_configuration where singleton and enabled),'currency','EGP','creditBalanceMinor',coalesce(balance,0));
end $$;
revoke all on function shop_private.proration_enabled(),shop_private.proration_owner_subscription(uuid),shop_private.proration_quote_view(public.shop_proration_quotes),
 shop_private.proration_target(uuid,uuid,uuid,jsonb),shop_private.proration_funding(public.subscriptions,timestamptz),
 shop_private.proration_validate(public.shop_proration_quotes,public.subscriptions,public.shop_proration_credit_accounts),
 shop_private.proration_settle(uuid,uuid),shop_private.proration_transition_authorized(public.subscriptions,public.subscriptions),shop_private.proration_preserve_quote()
 from public,anon,authenticated,service_role;
revoke all on function public.shop_xpay_proration_quote(uuid,uuid,uuid,jsonb),public.shop_xpay_proration_read(uuid,uuid),
 public.shop_xpay_proration_order(uuid,uuid),public.shop_xpay_proration_credit_confirm(uuid,uuid),public.shop_xpay_proration_abandon(uuid,uuid),public.shop_xpay_proration_status(uuid)
 from public,anon,service_role;
grant execute on function public.shop_xpay_proration_quote(uuid,uuid,uuid,jsonb),public.shop_xpay_proration_read(uuid,uuid),
 public.shop_xpay_proration_order(uuid,uuid),public.shop_xpay_proration_credit_confirm(uuid,uuid),public.shop_xpay_proration_abandon(uuid,uuid),public.shop_xpay_proration_status(uuid) to authenticated;
notify pgrst,'reload schema';

create trigger shop_proration_quotes_no_delete before delete or truncate on public.shop_proration_quotes for each statement execute function shop_private.reject_commercial_snapshot_mutation();
create trigger shop_proration_accounts_no_delete before delete or truncate on public.shop_proration_credit_accounts for each statement execute function shop_private.reject_commercial_snapshot_mutation();
create function shop_private.proration_balance_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
 if new.balance_minor<>0 or new.version<>0 then raise exception 'SHOP_PRORATION_UNFUNDED_BALANCE' using errcode='55000';end if;
 elsif not exists(select 1 from public.shop_proration_credit_ledger ledger join public.shop_proration_settlements settled on settled.quote_id=ledger.quote_id
 where ledger.subscription_id=old.subscription_id and ledger.version_before=old.version and ledger.version_after=new.version
 and ledger.balance_before_minor=old.balance_minor and ledger.balance_after_minor=new.balance_minor and new.currency=old.currency
 and new.subscription_id=old.subscription_id) then raise exception 'SHOP_PRORATION_UNAUDITED_BALANCE' using errcode='55000';end if;
 return new;
end $$;
revoke all on function shop_private.proration_balance_guard() from public,anon,authenticated,service_role;
create trigger shop_proration_accounts_balanced before insert or update on public.shop_proration_credit_accounts for each row execute function shop_private.proration_balance_guard();
