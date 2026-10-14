-- Owner-facing projection must expose the frozen commercial subset, never offer credentials.
DO $$declare q public.shop_proration_quotes;v jsonb;begin
 q.id:=gen_random_uuid();q.shop_id:=gen_random_uuid();q.catalog_terms_id:=gen_random_uuid();q.state:='quoted';q.created_at:=clock_timestamp();q.expires_at:=q.created_at+interval '15 minutes';
 q.commerce:='{"planName":"Frozen Team","planVariant":"multi_3","billingInterval":"monthly","listPriceAmount":699,"effectivePriceAmount":599,"priceSource":"override","resourceLimits":{"active_locations":3,"active_members":5,"active_products":null,"active_services":50,"active_customers":500,"active_suppliers":50},"entitlements":{"appointments":true},"offerBinding":{"redemptionToken":"synthetic-secret"},"sourceSubscription":{"private":"synthetic-secret"}}';
 q.calculation:='{"version":1,"amountDueMinor":23333}';
 v:=shop_private.proration_quote_view(q);
 if v#>>'{details,planVariant}'<>'multi_3' or (v#>>'{details,effectivePriceAmount}')::numeric<>599
 or v#>'{details,resourceLimits,active_products}'<>'null'::jsonb or v#>'{details,entitlements,appointments}'<>'true'::jsonb
 or (v#>>'{calculation,amountDueMinor}')::bigint<>23333 then raise exception 'Frozen commercial projection changed';end if;
 if v::text like '%synthetic-secret%' or v::text like '%offerBinding%' or v::text like '%sourceSubscription%' then raise exception 'Private quote fields exposed';end if;
 if has_function_privilege('authenticated','shop_private.proration_quote_view(public.shop_proration_quotes)','execute') or has_function_privilege('anon','shop_private.proration_quote_view(public.shop_proration_quotes)','execute') then raise exception 'Private quote helper granted directly';end if;
end $$;
