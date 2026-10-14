-- Safe owner-authorized projection of already frozen commerce; no new pricing or authority.
create or replace function shop_private.proration_quote_view(q public.shop_proration_quotes)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('quoteId',q.id,'state',q.state,'shopId',q.shop_id,'planName',q.commerce->>'planName',
 'catalogTermsId',q.catalog_terms_id,'privateOfferId',q.private_offer_id,'createdAt',q.created_at,'expiresAt',q.expires_at,
 'calculation',q.calculation,'xpayOrderId',q.xpay_order_id,'details',jsonb_build_object(
 'planVariant',q.commerce->>'planVariant','billingInterval',q.commerce->>'billingInterval',
 'resourceLimits',q.commerce->'resourceLimits','entitlements',q.commerce->'entitlements',
 'listPriceAmount',q.commerce->'listPriceAmount','effectivePriceAmount',q.commerce->'effectivePriceAmount',
 'priceSource',q.commerce->>'priceSource'));
$$;
