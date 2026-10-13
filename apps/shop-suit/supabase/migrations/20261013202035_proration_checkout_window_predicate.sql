-- Preserve the existing timing policy; isolate its immutable predicate for exact
-- boundary fixtures. This helper cannot read/write or authorize any tenant.
create function shop_private.proration_window_valid(p_state text,p_quote_expires timestamptz,p_as_of timestamptz,p_order_created timestamptz,p_session_minutes integer)
returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(p_quote_expires>p_as_of or (p_state in ('checkout','requires_review')
 and p_order_created<=p_quote_expires and p_session_minutes=30
 and p_as_of<=p_order_created+interval '35 minutes'),false);
$$;
revoke all on function shop_private.proration_window_valid(text,timestamptz,timestamptz,timestamptz,integer) from public,anon,authenticated,service_role;
create or replace function shop_private.proration_validate(q public.shop_proration_quotes,s public.subscriptions,a public.shop_proration_credit_accounts) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 return q.subscription_before=to_jsonb(s) and a.version=q.credit_version and a.balance_minor=(q.calculation->>'creditBeforeMinor')::bigint
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
