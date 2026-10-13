-- Dormant internal calculation layer. No public API, order/payment mutation,
-- access activation or credit issuance is introduced by this migration.
-- Inputs will be derived from locked server records by the settlement layer.
create function shop_private.proration_quote_v1(
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
 or (p_old_interval is not null and p_old_interval not in ('monthly','annual'))
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
 if p_status='active' and ((p_cycle_start is null)<>(p_cycle_end is null)
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
revoke all on function shop_private.proration_quote_v1(timestamptz,text,text,timestamptz,timestamptz,timestamptz,numeric,text,text,bigint,bigint,boolean,text)
 from public,anon,authenticated,service_role;
