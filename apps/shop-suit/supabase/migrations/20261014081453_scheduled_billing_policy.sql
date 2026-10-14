-- One paid period, deferred cheaper/shorter changes, manual confirmation only.
-- Existing paid receipts/time are immutable. No provider call, debit or refund.
create function shop_private.billing_change_timing(s public.subscriptions,c jsonb)
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
revoke all on function shop_private.billing_change_timing(public.subscriptions,jsonb) from public,anon,authenticated,service_role;

-- Read-only public-plan preview. Deferred changes can be saved with excess
-- resources; payment/activation still rechecks every quota and entitlement.
create function shop_private.billing_public_target(s public.subscriptions,p_terms uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare t public.plan_catalog_terms;q jsonb;
begin
 select terms.* into t from public.plan_catalog_terms terms join public.plans plan on plan.id=terms.plan_id join public.portals portal on portal.id=plan.portal_id
 where terms.id=p_terms and portal.key='shop-crm' and terms.private_offer_id is null and plan.is_active and plan.is_public and plan.is_purchasable and not plan.is_coming_soon
 and exists(select 1 from shop_private.current_plan_offers(plan.id) offered where offered.id=terms.id);
 if t.id is null or t.billing_interval not in('monthly','annual') or t.currency<>'EGP' then raise exception 'PLAN_UNAVAILABLE' using errcode='22023';end if;
 q:=shop_private.subscription_effective_price(s.id,t.id,clock_timestamp());
 if (q->>'effectivePriceAmount')::numeric<=0 or (q->>'effectivePriceAmount')::numeric<>round((q->>'effectivePriceAmount')::numeric,2) then raise exception 'XPAY_QUOTE_INVALID' using errcode='22023';end if;
 return q||jsonb_build_object('planId',t.plan_id,'catalogTermsId',t.id,'planName',t.display_name,'planVariant',t.plan_variant,
 'billingInterval',t.billing_interval,'currency',t.currency,'resourceLimits',t.resource_limits,'entitlements',t.offer_entitlements);
end $$;
revoke all on function shop_private.billing_public_target(public.subscriptions,uuid) from public,anon,authenticated,service_role;

create function shop_private.billing_target_preview(s public.subscriptions,p_shop uuid,p_terms uuid,p_private jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare o jsonb;
begin
 if (p_terms is null)=(p_private is null) then raise exception 'XPAY_QUOTE_INVALID' using errcode='22023';end if;
 if p_private is null then return shop_private.billing_public_target(s,p_terms);end if;
 if jsonb_typeof(p_private) is distinct from 'object' or (p_private-array['offerId','offerVersion','targetBindingId','targetEnvironmentId','redemptionToken'])<>'{}'::jsonb then raise exception 'XPAY_PRIVATE_OFFER_INVALID' using errcode='22023';end if;
 o:=public.shop_private_offer_read(p_shop,(p_private->>'offerId')::uuid,(p_private->>'offerVersion')::integer,(p_private->>'targetBindingId')::uuid,(p_private->>'targetEnvironmentId')::uuid,p_private->>'redemptionToken');
 if o->>'submissionId' is not null or o->>'xpayOrderId' is not null or o->>'settledQuoteId' is not null then raise exception 'XPAY_OFFER_ALREADY_PAID' using errcode='55000';end if;
 if o->>'currency'<>'EGP' or o->>'billingInterval' not in('monthly','annual') then raise exception 'XPAY_CURRENCY_UNSUPPORTED' using errcode='22023';end if;
 return jsonb_build_object('privateOfferId',o->>'offerId','planName',o->>'displayName','planVariant','private_offer','billingInterval',o->>'billingInterval','currency',o->>'currency',
 'listPriceAmount',o->'priceAmount','effectivePriceAmount',o->'priceAmount','priceSource','private_offer','resourceLimits',o->'resourceLimits','entitlements',o->'entitlements','offerExpiresAt',o->'expiresAt');
end $$;
revoke all on function shop_private.billing_target_preview(public.subscriptions,uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create table public.shop_scheduled_plan_changes(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 shop_id uuid not null references public.shops(id) on delete restrict,
 subscription_id uuid not null references public.subscriptions(id) on delete restrict,
 actor_user_id uuid not null,catalog_terms_id uuid references public.plan_catalog_terms(id) on delete restrict,
 private_offer_id uuid references public.shop_private_offers(id) on delete restrict,private_offer_parameters jsonb,
 check((catalog_terms_id is not null and private_offer_id is null) or (catalog_terms_id is null and private_offer_id is not null and jsonb_typeof(private_offer_parameters) is not distinct from 'object' and not(private_offer_parameters?'redemptionToken'))),
 target jsonb not null check(jsonb_typeof(target)='object'),subscription_before jsonb not null check(jsonb_typeof(subscription_before)='object'),
 effective_at timestamptz not null check(isfinite(effective_at)),state text not null default 'scheduled' check(state in('scheduled','cancelled','completed')),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 cancelled_at timestamptz,completed_at timestamptz,completed_quote_id uuid references public.shop_proration_quotes(id) on delete restrict
);
create unique index shop_one_scheduled_plan_change on public.shop_scheduled_plan_changes(subscription_id) where state='scheduled';
alter table public.shop_scheduled_plan_changes enable row level security;
revoke all on public.shop_scheduled_plan_changes from public,anon,authenticated,service_role;
create function shop_private.preserve_scheduled_plan_change() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (to_jsonb(new)-array['state','updated_at','cancelled_at','completed_at','completed_quote_id']) is distinct from (to_jsonb(old)-array['state','updated_at','cancelled_at','completed_at','completed_quote_id'])
 or old.state<>'scheduled' or new.state not in('cancelled','completed') then raise exception 'SHOP_SCHEDULE_IMMUTABLE' using errcode='55000';end if;
 return new;
end $$;
revoke all on function shop_private.preserve_scheduled_plan_change() from public,anon,authenticated,service_role;
create trigger shop_schedule_preserve before update on public.shop_scheduled_plan_changes for each row execute function shop_private.preserve_scheduled_plan_change();
create trigger shop_schedule_no_delete before delete or truncate on public.shop_scheduled_plan_changes for each statement execute function shop_private.reject_commercial_snapshot_mutation();
create function shop_private.scheduled_change_event() returns trigger language plpgsql security definer set search_path='' as $$
begin perform shop_private.bump_realtime(new.shop_id,null,'billing');return new;end $$;
revoke all on function shop_private.scheduled_change_event() from public,anon,authenticated,service_role;
create trigger shop_schedule_version after insert or update on public.shop_scheduled_plan_changes for each row execute function shop_private.scheduled_change_event();

create function shop_private.scheduled_change_view(r public.shop_scheduled_plan_changes,s public.subscriptions) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare target jsonb;blockers jsonb;available boolean:=true;due_at timestamptz;v_offer public.shop_private_offers;
begin
 if r.id is null then return null;end if;
 if r.private_offer_id is null then
 begin target:=shop_private.billing_public_target(s,r.catalog_terms_id);exception when invalid_parameter_value then available:=false;target:=r.target;end;
 else
 target:=r.target;
 select * into v_offer from public.shop_private_offers where id=r.private_offer_id;
 available:=v_offer.id is not null and v_offer.shop_id=r.shop_id and v_offer.recipient_user_id=auth.uid() and v_offer.offer_version=(r.private_offer_parameters->>'offerVersion')::integer
 and v_offer.expires_at>greatest(r.effective_at,s.current_period_end,clock_timestamp())+interval '31 minutes'
 and not exists(select 1 from public.shop_private_offer_revocations where offer_id=v_offer.id)
 and not exists(select 1 from public.shop_private_offer_redemptions where offer_id=v_offer.id);
 end if;
 blockers:=shop_private.plan_change_blockers(r.shop_id,target->'resourceLimits');
 due_at:=case when r.state='scheduled' then greatest(r.effective_at,s.current_period_end) else r.effective_at end;
 return jsonb_build_object('id',r.id,'state',r.state,'catalogTermsId',r.catalog_terms_id,'privateOfferId',r.private_offer_id,'needsOfferLink',r.private_offer_id is not null,'planName',target->>'planName','billingInterval',target->>'billingInterval',
 'currency',target->>'currency','indicativePriceAmount',target->'effectivePriceAmount','effectiveAt',due_at,'createdAt',r.created_at,'available',available,
 'blockers',blockers,'canPayNow',r.state='scheduled' and available and s.current_period_end<=clock_timestamp() and due_at<=clock_timestamp() and jsonb_array_length(blockers)=0,
 'canCancel',r.state='scheduled' and not exists(select 1 from public.shop_proration_quotes q join public.shop_xpay_orders payment_order on payment_order.id=q.xpay_order_id
 where q.commerce->>'scheduledChangeId'=r.id::text and payment_order.state in('creating','open','pending','requires_review')));
end $$;
revoke all on function shop_private.scheduled_change_view(public.shop_scheduled_plan_changes,public.subscriptions) from public,anon,authenticated,service_role;

create function public.shop_billing_change_preview(p_shop_id uuid,p_catalog_terms_id uuid,p_private_offer jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;c jsonb;r public.shop_scheduled_plan_changes;
begin
 s:=shop_private.proration_owner_subscription(p_shop_id);perform shop_private.proration_enabled();c:=shop_private.billing_target_preview(s,p_shop_id,p_catalog_terms_id,p_private_offer);
 select * into r from public.shop_scheduled_plan_changes where shop_id=p_shop_id and subscription_id=s.id and state='scheduled';
 return jsonb_build_object('timing',shop_private.billing_change_timing(s,c),'effectiveAt',s.current_period_end,'catalogTermsId',p_catalog_terms_id,
 'blockers',shop_private.plan_change_blockers(p_shop_id,c->'resourceLimits'),'scheduled',shop_private.scheduled_change_view(r,s));
end $$;
create function public.shop_billing_change_schedule(p_request_id uuid,p_shop_id uuid,p_catalog_terms_id uuid,p_private_offer jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;c jsonb;r public.shop_scheduled_plan_changes;
begin
 s:=shop_private.proration_owner_subscription(p_shop_id);perform shop_private.proration_enabled();
 if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode='22023';end if;
 select * into r from public.shop_scheduled_plan_changes where request_id=p_request_id;
 if found then
 if r.shop_id<>p_shop_id or r.subscription_id<>s.id or r.actor_user_id<>auth.uid() or r.catalog_terms_id is distinct from p_catalog_terms_id or r.private_offer_parameters is distinct from (p_private_offer-'redemptionToken') then raise exception 'XPAY_REQUEST_KEY_REUSED' using errcode='22023';end if;
 return shop_private.scheduled_change_view(r,s);end if;
 if exists(select 1 from public.shop_xpay_orders where subscription_id=s.id and state in('creating','open','pending','requires_review'))
 or exists(select 1 from public.shop_proration_quotes where subscription_id=s.id and state in('quoted','checkout','requires_review'))
 or exists(select 1 from public.shop_billing_submissions where shop_id=p_shop_id and status in('submitted','under_review')) then raise exception 'SHOP_PRORATION_PAYMENT_UNRESOLVED' using errcode='55000';end if;
 c:=shop_private.billing_target_preview(s,p_shop_id,p_catalog_terms_id,p_private_offer);
 if shop_private.billing_change_timing(s,c)<>'term_end' then raise exception 'SHOP_CHANGE_NOT_DEFERRED' using errcode='22023';end if;
 if p_private_offer is not null and (c->>'offerExpiresAt')::timestamptz<s.current_period_end+interval '31 minutes' then raise exception 'XPAY_OFFER_EXPIRING' using errcode='22023';end if;
 if exists(select 1 from public.shop_scheduled_plan_changes where subscription_id=s.id and state='scheduled') then raise exception 'SHOP_CHANGE_ALREADY_SCHEDULED' using errcode='55000';end if;
 insert into public.shop_scheduled_plan_changes(request_id,shop_id,subscription_id,actor_user_id,catalog_terms_id,private_offer_id,private_offer_parameters,target,subscription_before,effective_at)
 values(p_request_id,p_shop_id,s.id,auth.uid(),p_catalog_terms_id,(p_private_offer->>'offerId')::uuid,p_private_offer-'redemptionToken',c,to_jsonb(s),s.current_period_end) returning * into r;
 return shop_private.scheduled_change_view(r,s);
end $$;
create function public.shop_billing_change_read(p_shop_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;r public.shop_scheduled_plan_changes;
begin
 s:=shop_private.proration_owner_subscription(p_shop_id);
 select * into r from public.shop_scheduled_plan_changes where shop_id=p_shop_id and subscription_id=s.id
 order by (state='scheduled') desc,created_at desc,id desc limit 1;
 return shop_private.scheduled_change_view(r,s);
end $$;
create function public.shop_billing_change_cancel(p_shop_id uuid,p_change_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;r public.shop_scheduled_plan_changes;
begin
 s:=shop_private.proration_owner_subscription(p_shop_id);
 select * into r from public.shop_scheduled_plan_changes where id=p_change_id and shop_id=p_shop_id and subscription_id=s.id for update;
 if r.id is null then raise exception 'SHOP_OWNER_REQUIRED' using errcode='42501';end if;
 if r.state<>'scheduled' then return shop_private.scheduled_change_view(r,s);end if;
 if exists(select 1 from public.shop_proration_quotes q join public.shop_xpay_orders o on o.id=q.xpay_order_id
 where q.commerce->>'scheduledChangeId'=r.id::text and o.state in('creating','open','pending','requires_review')) then raise exception 'SHOP_PRORATION_PAYMENT_UNRESOLVED' using errcode='55000';end if;
 update public.shop_proration_quotes set state='abandoned' where commerce->>'scheduledChangeId'=r.id::text and state='quoted' and xpay_order_id is null;
 update public.shop_scheduled_plan_changes set state='cancelled',cancelled_at=clock_timestamp(),updated_at=clock_timestamp() where id=r.id returning * into r;
 return shop_private.scheduled_change_view(r,s);
end $$;
revoke all on function public.shop_billing_change_preview(uuid,uuid,jsonb),public.shop_billing_change_schedule(uuid,uuid,uuid,jsonb),public.shop_billing_change_read(uuid),public.shop_billing_change_cancel(uuid,uuid) from public,anon,service_role;
grant execute on function public.shop_billing_change_preview(uuid,uuid,jsonb),public.shop_billing_change_schedule(uuid,uuid,uuid,jsonb),public.shop_billing_change_read(uuid),public.shop_billing_change_cancel(uuid,uuid) to authenticated;

-- Price only grandfathered canonical funded segments. This does not authorize
-- buying future periods: the admission guard still rejects active repurchases.
create function shop_private.proration_segmented_upgrade(s public.subscriptions,p_at timestamptz,p_term_minor bigint,p_funding jsonb,p_base jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' set timezone='UTC' as $$
declare evidence jsonb:=p_funding->'evidence';basis jsonb;item jsonb;segments jsonb:='[]';term_start timestamptz;term_end timestamptz;coverage_start timestamptz;
 cursor_at timestamptz:=s.current_period_start;fraction numeric;total_fraction numeric:=0;service_cost numeric;net numeric;rounded bigint;months integer;
begin
 months:=case p_base->>'oldBillingInterval' when 'monthly' then 1 when 'annual' then 12 end;
 if months is null or p_base->>'mode'<>'remaining_period' or jsonb_array_length(evidence) not between 1 and 256 then
 raise exception 'SHOP_PRORATION_PERIOD_UNSUPPORTED' using errcode='22023';end if;
 if jsonb_array_length(evidence)=1 and evidence#>>'{0,kind}'='allocation' then
 basis:=evidence#>'{0,serviceSegments}';
 if jsonb_typeof(basis) is distinct from 'array' then raise exception 'SHOP_PRORATION_PERIOD_UNSUPPORTED' using errcode='22023';end if;
 else basis:=evidence;end if;
 if jsonb_array_length(basis) not between 2 and 256 then raise exception 'SHOP_PRORATION_PERIOD_UNSUPPORTED' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(basis) order by coalesce(value->>'termStart',value->>'start')::timestamptz loop
 term_start:=coalesce(item->>'termStart',item->>'start')::timestamptz;term_end:=coalesce(item->>'termEnd',item->>'end')::timestamptz;
 if term_start is null or term_end is null or item->>'valueMinor' is null or not isfinite(term_start) or not isfinite(term_end) or term_start<>cursor_at or term_end<>term_start+make_interval(months=>months)
 or term_end>s.current_period_end or (item->>'valueMinor')::numeric<0 then raise exception 'SHOP_PRORATION_PERIOD_UNSUPPORTED' using errcode='22023';end if;
 coverage_start:=least(term_end,greatest(p_at,term_start));
 fraction:=greatest(0,extract(epoch from term_end-coverage_start))/extract(epoch from term_end-term_start);
 total_fraction:=total_fraction+fraction;cursor_at:=term_end;
 segments:=segments||jsonb_build_array(jsonb_build_object('termStart',term_start,'termEnd',term_end,'start',coverage_start,'end',term_end,'valueMinor',(p_term_minor*fraction)::text));
 end loop;
 if cursor_at<>s.current_period_end then raise exception 'SHOP_PRORATION_PERIOD_UNSUPPORTED' using errcode='22023';end if;
 service_cost:=p_term_minor*total_fraction;net:=service_cost-(p_base->>'unusedPrepaidMinor')::numeric-(p_base->>'creditBeforeMinor')::bigint;rounded:=round(net);
 return p_base||jsonb_build_object('pricingBasis','verified_funded_term_segments','serviceSegments',segments,'targetFraction',total_fraction::text,
 'serviceValueMinor',service_cost::text,'netExactMinor',net::text,'roundingAdjustmentMinor',(rounded-net)::text,
 'amountDueMinor',greatest(rounded,0),'creditAfterMinor',greatest(-rounded,0),
 'transition',case when rounded>0 then 'verified_xpay_payment' else 'explicit_credit_transition' end);
end $$;
revoke all on function shop_private.proration_segmented_upgrade(public.subscriptions,timestamptz,bigint,jsonb,jsonb) from public,anon,authenticated,service_role;

-- Funded allocations decay by their saved individual term boundaries.
create or replace function shop_private.proration_funding(s public.subscriptions,p_as_of timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.shop_proration_settlements;value numeric:=0;evidence jsonb:='[]';row record;service_segments jsonb;segment jsonb;
begin
 if s.status<>'active' or s.current_period_end<=p_as_of then return jsonb_build_object('source','none','unusedMinor','0','evidence',evidence);end if;
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

-- Public admission selects the approved timing before accepting a quote.
create or replace function public.shop_xpay_proration_quote(p_request_id uuid,p_shop_id uuid,p_catalog_terms_id uuid,p_private_offer jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions;q public.shop_proration_quotes;a public.shop_proration_credit_accounts;
 commerce jsonb;parameters jsonb;funding jsonb;calculation jsonb;old_interval text;old_currency text;at timestamptz;target uuid;offer uuid;scheduled_id uuid;
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
 if s.status='active' and s.current_period_end>clock_timestamp() and shop_private.billing_change_timing(s,commerce)='term_end' then raise exception 'SHOP_CHANGE_AT_PERIOD_END' using errcode='55000';end if;
 at:=clock_timestamp();funding:=shop_private.proration_funding(s,at);
 calculation:=shop_private.proration_quote_v1(at,case when s.status='trialing' and s.trial_end_at<=at then 'expired' else s.status end,
 funding->>'source',s.current_period_start,s.current_period_end,at,(funding->>'unusedMinor')::numeric,
 old_interval,commerce->>'billingInterval',((commerce->>'effectivePriceAmount')::numeric*100)::bigint,a.balance_minor,s.catalog_terms_id=target);
 if s.status='active' and s.current_period_end>at and old_interval=commerce->>'billingInterval' and s.catalog_terms_id<>target
 and abs(extract(epoch from s.current_period_end-(s.current_period_start+case old_interval when 'monthly' then interval '1 month' when 'annual' then interval '1 year' end)))>1 then
 calculation:=shop_private.proration_segmented_upgrade(s,at,((commerce->>'effectivePriceAmount')::numeric*100)::bigint,funding,calculation);end if;
 calculation:=calculation||jsonb_build_object('billingPolicyVersion','single_period_deferred_v1');
 if calculation->>'mode'='full_term' then
 select id into scheduled_id from public.shop_scheduled_plan_changes where subscription_id=s.id and shop_id=p_shop_id and actor_user_id=auth.uid() and state='scheduled' and ((catalog_terms_id=target and private_offer_id is null) or(private_offer_id=offer and private_offer_parameters=p_private_offer-'redemptionToken')) and effective_at<=at;
 if scheduled_id is not null then commerce:=commerce||jsonb_build_object('scheduledChangeId',scheduled_id);end if;end if;
 parameters:=jsonb_build_object('catalogTermsId',p_catalog_terms_id,'privateOffer',p_private_offer-'redemptionToken');
 insert into public.shop_proration_quotes(request_id,shop_id,subscription_id,actor_user_id,catalog_terms_id,private_offer_id,parameters,subscription_before,credit_version,commerce,calculation,funding_evidence,expires_at)
 values(p_request_id,p_shop_id,s.id,auth.uid(),target,offer,parameters,to_jsonb(s),a.version,commerce,calculation,funding->'evidence',(calculation->>'expiresAt')::timestamptz) returning * into q;
 return shop_private.proration_quote_view(q);
end $$;

-- Existing accepted pre-policy quotes retain their frozen contract; every new
-- quote carries the current policy marker, and cancelled schedules cannot pay.
create or replace function shop_private.proration_validate(q public.shop_proration_quotes,s public.subscriptions,a public.shop_proration_credit_accounts) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 return (q.calculation->>'billingPolicyVersion' is distinct from 'single_period_deferred_v1' or shop_private.billing_change_timing(s,q.commerce)='now')
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

-- Runs inside the verified cash/explicit credit settlement transaction. A later
-- quota/ledger/access failure rolls this back too. It never creates an order.
create function shop_private.complete_scheduled_change() returns trigger language plpgsql security definer set search_path='' as $$
declare q public.shop_proration_quotes;
begin
 select * into q from public.shop_proration_quotes where id=new.quote_id;
 if q.commerce->>'scheduledChangeId' is not null then
 update public.shop_scheduled_plan_changes set state='completed',completed_at=clock_timestamp(),updated_at=clock_timestamp(),completed_quote_id=q.id
 where id=(q.commerce->>'scheduledChangeId')::uuid and shop_id=q.shop_id and subscription_id=q.subscription_id and actor_user_id=q.actor_user_id
 and ((catalog_terms_id=q.catalog_terms_id and private_offer_id is null) or(private_offer_id=q.private_offer_id and private_offer_parameters=q.parameters->'privateOffer')) and state='scheduled' and effective_at<=clock_timestamp() and q.calculation->>'mode'='full_term';
 if not found then raise exception 'SHOP_PRORATION_QUOTE_STALE' using errcode='55000';end if;
 end if;
 return new;
end $$;
revoke all on function shop_private.complete_scheduled_change() from public,anon,authenticated,service_role;
create trigger shop_schedule_settled after insert on public.shop_proration_settlements for each row execute function shop_private.complete_scheduled_change();
notify pgrst,'reload schema';
