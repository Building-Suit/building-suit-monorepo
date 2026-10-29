begin;
-- Optional shop-wide price metadata, independent of inventory and scale factors.
create table public.commodity_quotes(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),commodity text not null check(length(btrim(commodity)) between 2 and 120),
 source_name text not null check(length(btrim(source_name)) between 3 and 120),evidence_reference text not null check(length(btrim(evidence_reference)) between 3 and 500),
 currency_code text not null check(currency_code ~ '^[A-Z]{3}$'),price_per_kg numeric(24,12) not null check(price_per_kg>0 and price_per_kg<=999999999.99),
 effective_at timestamptz not null,expires_at timestamptz not null check(expires_at>effective_at),
 active boolean not null default false,revision integer not null default 1 check(revision>0),
 approved_by uuid not null references public.profiles(id),approved_at timestamptz not null default clock_timestamp(),unique(id,shop_id)
);
create index commodity_quote_directory on public.commodity_quotes(shop_id,approved_at desc,id);
create table public.product_commodity_rules(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,product_id uuid not null,quote_id uuid not null,
 base_unit_code text not null references public.units_of_measure(code),measurement_revision integer not null,
 kg_per_base_unit numeric(24,12) not null check(kg_per_base_unit>0 and kg_per_base_unit<=1000000),
 premium_per_base_unit numeric(24,12) not null check(premium_per_base_unit>=0 and premium_per_base_unit<=999999999.99),currency_code text not null,
 evidence_reference text not null check(length(btrim(evidence_reference)) between 3 and 500),active boolean not null default false,
 revision integer not null default 1 check(revision>0),approved_by uuid not null references public.profiles(id),approved_at timestamptz not null default clock_timestamp(),
 foreign key(product_id,shop_id) references public.products(id,shop_id),foreign key(quote_id,shop_id) references public.commodity_quotes(id,shop_id),unique(shop_id,product_id),unique(id,shop_id)
);
create table public.commodity_pricing_events(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),kind text not null check(kind in('quote','rule')),
 record_id uuid not null,revision integer not null,snapshot jsonb not null,reason text not null check(length(btrim(reason)) between 3 and 500),
 actor_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),unique(shop_id,kind,record_id,revision)
);
create index commodity_pricing_history on public.commodity_pricing_events(shop_id,kind,record_id,created_at desc,id);
create table shop_private.commodity_pricing_requests(
 shop_id uuid not null,request_id uuid not null,actor_profile_id uuid not null references public.profiles(id),payload jsonb not null,result jsonb,primary key(shop_id,request_id)
);
alter table shop_private.commodity_pricing_requests enable row level security;
revoke all on shop_private.commodity_pricing_requests from public,anon,authenticated,service_role;
do $$declare t text;begin
 foreach t in array array['commodity_quotes','product_commodity_rules','commodity_pricing_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to service_role',t);
  execute format('create policy commodity_service_read on public.%I for select to service_role using(true)',t);
 end loop;
end;$$;
create trigger commodity_pricing_history_immutable before update or delete on public.commodity_pricing_events for each row execute function shop_private.measurement_history_immutable();
create function shop_private.commodity_quote_immutable() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or (to_jsonb(new)-array['active','revision']) is distinct from (to_jsonb(old)-array['active','revision']) or new.revision<>old.revision+1 then raise exception 'COMMODITY_QUOTE_TERMS_IMMUTABLE' using errcode='55000';end if;return new;
end;$$;
revoke all on function shop_private.commodity_quote_immutable() from public,anon,authenticated,service_role;
create trigger commodity_quote_terms_immutable before update or delete on public.commodity_quotes for each row execute function shop_private.commodity_quote_immutable();

create function shop_private.commodity_record(p_kind text,p_record jsonb) returns jsonb language plpgsql immutable set search_path='' as $$begin
 if p_record is null then return null;end if;
 if p_kind='quote' then return p_record||jsonb_build_object('price_per_kg',trim_scale((p_record->>'price_per_kg')::numeric)::text);end if;
 return p_record||jsonb_build_object('kg_per_base_unit',trim_scale((p_record->>'kg_per_base_unit')::numeric)::text,'premium_per_base_unit',trim_scale((p_record->>'premium_per_base_unit')::numeric)::text);
end;$$;
revoke all on function shop_private.commodity_record(text,jsonb) from public,anon,authenticated,service_role;

create function public.commodity_pricing_command(p_request_id uuid,p_shop_id uuid,p_kind text,p_id uuid,p_revision integer,p_values jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;request shop_private.commodity_pricing_requests%rowtype;payload jsonb;v_result jsonb;previous jsonb;v_id uuid:=coalesce(p_id,gen_random_uuid());
 quote public.commodity_quotes%rowtype;rule public.product_commodity_rules%rowtype;product public.products%rowtype;enabled boolean;currency text;kg numeric;premium numeric;rate numeric;starts timestamptz;ends timestamptz;begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'products.manage');
 perform 1 from public.shops where id=p_shop_id for update;
 if p_kind is null or p_kind not in('quote','rule') or p_request_id is null or p_revision is null or p_revision<0 or p_id is null and p_revision<>0
  or jsonb_typeof(p_values) is distinct from 'object' or jsonb_typeof(p_values->'active') is distinct from 'boolean' or jsonb_typeof(p_values->'confirmed') is distinct from 'boolean'
  or (p_values->>'active')::boolean and not (p_values->>'confirmed')::boolean or p_reason is null or length(btrim(p_reason)) not between 3 and 500 then raise exception 'INVALID_COMMODITY_APPROVAL' using errcode='22023';end if;
 enabled:=(p_values->>'active')::boolean;
 select business_currency into currency from public.shops where id=p_shop_id and business_mode in('product','mixed');
 if enabled and currency is null then raise exception 'BUSINESS_MODE_PRODUCT_DISABLED' using errcode='23514';end if;
 payload:=jsonb_build_array(p_kind,p_id,p_revision,p_values,btrim(p_reason));
 insert into shop_private.commodity_pricing_requests(shop_id,request_id,actor_profile_id,payload) values(p_shop_id,p_request_id,actor,payload) on conflict do nothing;
 select * into request from shop_private.commodity_pricing_requests where shop_id=p_shop_id and request_id=p_request_id for update;
 if request.actor_profile_id<>actor or request.payload<>payload then raise exception 'COMMODITY_REQUEST_CONFLICT' using errcode='23505';end if;
 if request.result is not null then return request.result;end if;
 if p_kind='quote' then
  if p_id is null then
   if (p_values-array['active','confirmed','commodity','sourceName','evidenceReference','currency','pricePerKg','effectiveAt','expiresAt'])<>'{}'
    or jsonb_typeof(p_values->'pricePerKg') is distinct from 'string' or p_values->>'pricePerKg'!~ '^[0-9]{1,9}(\.[0-9]{1,12})?$'
    or p_values->>'currency' is distinct from currency or jsonb_typeof(p_values->'commodity') is distinct from 'string' or jsonb_typeof(p_values->'sourceName') is distinct from 'string' or jsonb_typeof(p_values->'evidenceReference') is distinct from 'string'
    or jsonb_typeof(p_values->'effectiveAt') is distinct from 'string' or jsonb_typeof(p_values->'expiresAt') is distinct from 'string'
    or p_values->>'effectiveAt'!~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
    or p_values->>'expiresAt'!~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'INVALID_COMMODITY_QUOTE' using errcode='22023';end if;
   starts:=(p_values->>'effectiveAt')::timestamptz;ends:=(p_values->>'expiresAt')::timestamptz;
   if not isfinite(starts) or not isfinite(ends) or ends<=starts then raise exception 'INVALID_COMMODITY_VALIDITY' using errcode='22023';end if;
   if enabled and ends<=clock_timestamp() then raise exception 'COMMODITY_QUOTE_UNAVAILABLE' using errcode='55000';end if;
   insert into public.commodity_quotes(id,shop_id,commodity,source_name,evidence_reference,currency_code,price_per_kg,effective_at,expires_at,active,approved_by)
    values(v_id,p_shop_id,btrim(p_values->>'commodity'),btrim(p_values->>'sourceName'),btrim(p_values->>'evidenceReference'),currency,(p_values->>'pricePerKg')::numeric,starts,ends,enabled,actor) returning * into quote;
  else
   if (p_values-array['active','confirmed'])<>'{}' then raise exception 'COMMODITY_QUOTE_TERMS_IMMUTABLE' using errcode='55000';end if;
   select * into quote from public.commodity_quotes where id=p_id and shop_id=p_shop_id for update;
   if not found or quote.revision<>p_revision then raise exception 'COMMODITY_CONTEXT_CHANGED' using errcode='55000';end if;
   if enabled and (quote.currency_code is distinct from currency or quote.expires_at<=clock_timestamp()) then raise exception 'COMMODITY_QUOTE_UNAVAILABLE' using errcode='55000';end if;
   previous:=shop_private.commodity_record('quote',to_jsonb(quote));
   update public.commodity_quotes set active=enabled,revision=revision+1 where id=v_id returning * into quote;
  end if;
  v_result:=shop_private.commodity_record('quote',to_jsonb(quote));
 else
  if (p_values-array['active','confirmed','productId','quoteId','kgPerBaseUnit','premiumPerBaseUnit','measurementRevision','baseUnitCode','evidenceReference'])<>'{}'
   or jsonb_typeof(p_values->'productId') is distinct from 'string' or jsonb_typeof(p_values->'quoteId') is distinct from 'string' or jsonb_typeof(p_values->'evidenceReference') is distinct from 'string'
   or jsonb_typeof(p_values->'kgPerBaseUnit') is distinct from 'string' or p_values->>'kgPerBaseUnit'!~ '^[0-9]{1,7}(\.[0-9]{1,12})?$'
   or jsonb_typeof(p_values->'premiumPerBaseUnit') is distinct from 'string' or p_values->>'premiumPerBaseUnit'!~ '^[0-9]{1,9}(\.[0-9]{1,12})?$' then raise exception 'INVALID_COMMODITY_RULE' using errcode='22023';end if;
  kg:=(p_values->>'kgPerBaseUnit')::numeric;premium:=(p_values->>'premiumPerBaseUnit')::numeric;
  if kg<=0 or kg>1000000 or premium<0 or premium>999999999.99 then raise exception 'INVALID_COMMODITY_RULE' using errcode='22023';end if;
  select * into rule from public.product_commodity_rules where id=p_id and shop_id=p_shop_id for update;
  if p_id is not null and (rule.id is null or rule.revision<>p_revision or rule.product_id::text is distinct from p_values->>'productId') then raise exception 'COMMODITY_CONTEXT_CHANGED' using errcode='55000';end if;
  select * into product from public.products where id=(p_values->>'productId')::uuid and shop_id=p_shop_id;
  if not found or (enabled or p_id is null) and (not product.is_active or product.measurement_status<>'active' or not exists(select 1 from public.units_of_measure where code=product.base_unit_code and is_active and dimension in('mass','length')))
   then raise exception 'COMMODITY_PRODUCT_UNAVAILABLE' using errcode='55000';end if;
  if (enabled or p_id is null) and (jsonb_typeof(p_values->'measurementRevision') is distinct from 'number' or p_values->>'measurementRevision' is distinct from product.measurement_revision::text or p_values->>'baseUnitCode' is distinct from product.base_unit_code) then raise exception 'COMMODITY_PRODUCT_CONTEXT_CHANGED' using errcode='55000';end if;
  select * into quote from public.commodity_quotes where id=(p_values->>'quoteId')::uuid and shop_id=p_shop_id;
  if not found then raise exception 'COMMODITY_QUOTE_UNAVAILABLE' using errcode='55000';end if;
  rate:=kg*quote.price_per_kg+premium;
  if enabled and (not quote.active or quote.currency_code is distinct from currency or quote.effective_at>clock_timestamp() or quote.expires_at<=clock_timestamp()) then raise exception 'COMMODITY_QUOTE_UNAVAILABLE' using errcode='55000';end if;
  if enabled and (rate>999999999.99 or round(rate,12)<>rate) then raise exception 'COMMODITY_PRICE_PRECISION' using errcode='22023';end if;
  if p_id is null then
   insert into public.product_commodity_rules(id,shop_id,product_id,quote_id,base_unit_code,measurement_revision,kg_per_base_unit,premium_per_base_unit,currency_code,evidence_reference,active,approved_by)
    values(v_id,p_shop_id,product.id,quote.id,product.base_unit_code,product.measurement_revision,kg,premium,quote.currency_code,btrim(p_values->>'evidenceReference'),enabled,actor) returning * into rule;
  else
   previous:=shop_private.commodity_record('rule',to_jsonb(rule))||jsonb_build_object('product_name',product.name);
   update public.product_commodity_rules set quote_id=quote.id,kg_per_base_unit=kg,premium_per_base_unit=premium,evidence_reference=btrim(p_values->>'evidenceReference'),
    base_unit_code=case when enabled then product.base_unit_code else rule.base_unit_code end,measurement_revision=case when enabled then product.measurement_revision else rule.measurement_revision end,
    currency_code=quote.currency_code,active=enabled,revision=revision+1,approved_by=actor,approved_at=clock_timestamp() where id=v_id returning * into rule;
  end if;
  v_result:=shop_private.commodity_record('rule',to_jsonb(rule))||jsonb_build_object('product_name',product.name);
 end if;
 insert into public.commodity_pricing_events(shop_id,kind,record_id,revision,snapshot,reason,actor_profile_id)
 values(p_shop_id,p_kind,v_id,(v_result->>'revision')::integer,jsonb_build_object('previous',previous,'current',v_result),btrim(p_reason),actor);
 v_result:=jsonb_build_object('kind',p_kind,'id',v_id,'revision',(v_result->>'revision')::integer);
 update shop_private.commodity_pricing_requests set result=v_result where shop_id=p_shop_id and request_id=p_request_id;return v_result;
end;$$;
revoke all on function public.commodity_pricing_command(uuid,uuid,text,uuid,integer,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.commodity_pricing_command(uuid,uuid,text,uuid,integer,jsonb,text) to authenticated;

create function shop_private.resolve_commodity_price(p_shop uuid,p_product uuid,p_measurement jsonb,p_original numeric) returns jsonb
language plpgsql stable set search_path='' as $$
declare rule public.product_commodity_rules%rowtype;quote public.commodity_quotes%rowtype;product public.products%rowtype;currency text;price numeric;begin
 select * into rule from public.product_commodity_rules where shop_id=p_shop and product_id=p_product and active;
 if not found then return null;end if;
 select * into product from public.products where id=p_product and shop_id=p_shop;
 select business_currency into currency from public.shops where id=p_shop;
 if product.measurement_status<>'active' or rule.measurement_revision<>product.measurement_revision or rule.base_unit_code<>product.base_unit_code or rule.currency_code is distinct from currency then raise exception 'COMMODITY_PRODUCT_CONTEXT_CHANGED' using errcode='55000';end if;
 select * into quote from public.commodity_quotes where id=rule.quote_id and shop_id=p_shop;
 if not found or not quote.active or quote.currency_code is distinct from currency or quote.effective_at>statement_timestamp() or quote.expires_at<=statement_timestamp() then raise exception 'COMMODITY_QUOTE_UNAVAILABLE' using errcode='55000';end if;
 price:=rule.kg_per_base_unit*quote.price_per_kg+rule.premium_per_base_unit;
 if price>999999999.99 or round(price,12)<>price then raise exception 'COMMODITY_PRICE_PRECISION' using errcode='22023';end if;
 return jsonb_build_object('source','commodity','currency',currency,'productRevision',product.measurement_revision,'stockUnitCode',product.base_unit_code,'originalBaseUnitPrice',trim_scale(p_original)::text,
  'baseUnitPrice',trim_scale(price)::text,'resolvedAt',statement_timestamp(),'ruleId',rule.id,'revision',rule.revision,'kgPerBaseUnit',trim_scale(rule.kg_per_base_unit)::text,
  'premiumPerBaseUnit',trim_scale(rule.premium_per_base_unit)::text,'ruleEvidenceReference',rule.evidence_reference,'approvedBy',rule.approved_by,'approvedAt',rule.approved_at,
  'quote',shop_private.commodity_record('quote',to_jsonb(quote)));
end;$$;
revoke all on function shop_private.resolve_commodity_price(uuid,uuid,jsonb,numeric) from public,anon,authenticated,service_role;

create function public.commodity_pricing_context(p_shop_id uuid,p_kind text default 'quote',p_search text default null,p_page integer default 1,p_id uuid default null,p_history_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb;total bigint;record jsonb;history jsonb;history_total bigint;currency text;begin
 if not shop_private.has_permission(p_shop_id,'products.manage') or not shop_private.has_permission(p_shop_id,'products.view') then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501';end if;
 if p_kind is null or p_kind not in('quote','rule','quote_options') or p_page is null or p_page<1 or p_history_page is null or p_history_page<1 or length(coalesce(p_search,''))>120 then raise exception 'INVALID_COMMODITY_QUERY' using errcode='22023';end if;
 select business_currency into currency from public.shops where id=p_shop_id;
 if p_kind in('quote','quote_options') then
  with eligible as(select q.* from public.commodity_quotes q where shop_id=p_shop_id and (p_kind<>'quote_options' or q.active and q.currency_code=currency and q.effective_at<=statement_timestamp() and q.expires_at>statement_timestamp()) and (nullif(btrim(p_search),'') is null or commodity ilike '%'||btrim(p_search)||'%' or source_name ilike '%'||btrim(p_search)||'%' or evidence_reference ilike '%'||btrim(p_search)||'%')),
   page as(select * from eligible order by approved_at desc,id offset (p_page-1)*20 limit 20)
  select (select count(*) from eligible),coalesce((select jsonb_agg(shop_private.commodity_record('quote',to_jsonb(page)) order by approved_at desc,id) from page),'[]') into total,items;
  select shop_private.commodity_record('quote',to_jsonb(q)) into record from public.commodity_quotes q where shop_id=p_shop_id and id=p_id;
 else
  with eligible as(select r.*,p.name product_name,p.sku,p.measurement_revision current_measurement_revision,q.commodity,q.source_name,q.effective_at,q.expires_at,q.active quote_active from public.product_commodity_rules r join public.products p on p.id=r.product_id and p.shop_id=r.shop_id
   join public.commodity_quotes q on q.id=r.quote_id and q.shop_id=r.shop_id where r.shop_id=p_shop_id and (nullif(btrim(p_search),'') is null or p.name ilike '%'||btrim(p_search)||'%' or p.sku ilike '%'||btrim(p_search)||'%' or q.commodity ilike '%'||btrim(p_search)||'%')),
   page as(select * from eligible order by product_name,id offset (p_page-1)*20 limit 20)
  select (select count(*) from eligible),coalesce((select jsonb_agg(shop_private.commodity_record('rule',to_jsonb(page)) order by product_name,id) from page),'[]') into total,items;
  select shop_private.commodity_record('rule',to_jsonb(r))||jsonb_build_object('product_name',p.name,'current_measurement_revision',p.measurement_revision) into record
   from public.product_commodity_rules r join public.products p on p.id=r.product_id and p.shop_id=r.shop_id where r.shop_id=p_shop_id and r.id=p_id;
 end if;
 select count(*) into history_total from public.commodity_pricing_events where shop_id=p_shop_id and kind=p_kind and record_id=p_id;
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('actor_name',p.display_name) order by e.created_at desc,e.id),'[]') into history
  from(select * from public.commodity_pricing_events where shop_id=p_shop_id and kind=p_kind and record_id=p_id order by created_at desc,id offset (p_history_page-1)*20 limit 20)e left join public.profiles p on p.id=e.actor_profile_id;
 return jsonb_build_object('items',items,'total',total,'page',p_page,'pageSize',20,'record',record,'history',history,'historyTotal',history_total,'historyPage',p_history_page,'currency',currency,'canManage',true);
end;$$;
revoke all on function public.commodity_pricing_context(uuid,text,text,integer,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.commodity_pricing_context(uuid,text,text,integer,uuid,integer) to authenticated;

-- Reviewed forward replacement; no published migration is changed.
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.apply_trade_price(uuid,uuid,uuid,jsonb,jsonb,numeric)'::regprocedure) is distinct from '68b49851bf64b9365a5108e5a186b822' then raise exception 'COMMODITY_ROUTINE_REVIEW_REQUIRED' using errcode='55000';end if;end;$$;
create or replace function shop_private.apply_trade_price(p_shop uuid,p_product uuid,p_customer uuid,p_input jsonb,p_resolved jsonb,p_threshold_quantity numeric default null) returns jsonb
language plpgsql stable set search_path='' as $$
declare product public.products%rowtype;r public.trade_price_rules%rowtype;g uuid;factor numeric;price numeric;entered_price numeric;
 quantity numeric:=(p_resolved->>'baseQuantity')::numeric;measurement jsonb:=p_resolved->'measurement';snapshot jsonb;original numeric:=(p_resolved->>'baseUnitPrice')::numeric;
 override_price text:=p_input->>'override_price';override_reason text:=nullif(btrim(p_input->>'override_reason'),'');begin
 select * into strict product from public.products where id=p_product and shop_id=p_shop;
 if p_customer is not null then
  if not exists(select 1 from public.clients where id=p_customer and shop_id=p_shop and is_active) then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002';end if;
  select a.group_id into g from public.customer_group_assignments a join public.customer_groups c on c.id=a.group_id and c.shop_id=a.shop_id and c.active where a.customer_id=p_customer and a.shop_id=p_shop;
 end if;
 if coalesce(measurement->>'priceSource','')<>'reel_remnant' then
  select rule.* into r from public.trade_price_rules rule
  where rule.shop_id=p_shop and rule.product_id=p_product and rule.active and rule.currency_code=(select business_currency from public.shops where id=p_shop) and rule.product_revision=product.measurement_revision and rule.stock_unit_code=case when product.measurement_status='legacy' then 'ea' else product.base_unit_code end and rule.minimum_quantity<=coalesce(p_threshold_quantity,quantity)
   and rule.starts_at<=statement_timestamp() and (rule.ends_at is null or rule.ends_at>statement_timestamp())
   and (rule.customer_id is null or rule.customer_id=p_customer) and (rule.group_id is null or rule.group_id=g)
   and (rule.package_id is null or (rule.package_id=nullif(measurement->>'packageId','')::uuid and rule.package_version=(measurement->>'packageVersion')::integer))
  order by case when rule.customer_id is not null then 0 when rule.group_id is not null then 1 else 2 end,rule.priority desc,rule.minimum_quantity desc,rule.created_at desc,rule.id limit 1;
 end if;
 if r.id is not null then
  if r.package_id is not null then select base_quantity into factor from public.product_packagings where id=r.package_id and shop_id=p_shop and product_id=p_product;
  elsif product.measurement_status='legacy' then factor:=1;
  else select u.canonical_conversion_factor/b.canonical_conversion_factor into factor from public.units_of_measure u cross join public.units_of_measure b where u.code=r.unit_code and b.code=product.base_unit_code;end if;
  price:=round(r.unit_price/factor,12);
  if round(price*factor,8)<>round(r.unit_price,8) then raise exception 'MEASUREMENT_PRICE_PRECISION' using errcode='22023';end if;
  snapshot:=jsonb_build_object('source',case when r.customer_id is not null then 'customer_contract' when r.group_id is not null then 'customer_group' else 'quantity_break' end,
   'ruleId',r.id,'revision',r.revision,'productRevision',r.product_revision,'stockUnitCode',r.stock_unit_code,'currency',r.currency_code,'customerId',p_customer,'groupId',g,'minimumBaseQuantity',trim_scale(r.minimum_quantity)::text,'unitCode',r.unit_code,'packageId',r.package_id,'packageVersion',r.package_version,
   'ruleUnitPrice',trim_scale(r.unit_price)::text,'originalBaseUnitPrice',trim_scale(original)::text,'baseUnitPrice',trim_scale(price)::text,'resolvedAt',statement_timestamp());
 else
  -- Existing contracts, explicit fixed packages, remnants and staff overrides
  -- retain precedence. Commodity is an explicitly enabled catalog alternative.
  if override_price is null and coalesce(measurement->>'priceSource','')<>'reel_remnant'
   and not exists(select 1 from public.product_packagings k where k.id=nullif(measurement->>'packageId','')::uuid and k.shop_id=p_shop and k.product_id=p_product and k.sale_price is not null) then
   snapshot:=shop_private.resolve_commodity_price(p_shop,p_product,measurement,original);
  end if;
  price:=coalesce((snapshot->>'baseUnitPrice')::numeric,original);
 end if;
 if override_price is not null then
  if not shop_private.has_permission(p_shop,'products.manage') then raise exception 'PRICE_OVERRIDE_PERMISSION_DENIED' using errcode='42501';end if;
  if override_price !~ '^[0-9]{1,9}(\.[0-9]{1,12})?$' or override_reason is null or length(override_reason) not between 3 and 1000 then raise exception 'INVALID_PRICE_OVERRIDE' using errcode='22023';end if;
  entered_price:=override_price::numeric;
  factor:=case when measurement is null or measurement='null'::jsonb then 1 else quantity/(measurement->>'enteredQuantity')::numeric end;
  snapshot:=coalesce(snapshot,'{}')||jsonb_build_object('source','staff_override','currency',(select business_currency from public.shops where id=p_shop),'productRevision',product.measurement_revision,'stockUnitCode',case when product.measurement_status='legacy' then 'ea' else product.base_unit_code end,'originalBaseUnitPrice',trim_scale(price)::text,'overrideEnteredUnitPrice',override_price,'reason',override_reason,
   'customerId',p_customer,'actorProfileId',(select p.id from public.profiles p where p.user_id=auth.uid() and p.status='active' and p.portal_id=(select portal_id from public.shops where id=p_shop)), 'resolvedAt',statement_timestamp());
  price:=round(entered_price/factor,12);
  if round(price*factor,8)<>round(entered_price,8) then raise exception 'MEASUREMENT_PRICE_PRECISION' using errcode='22023';end if;
  snapshot:=snapshot||jsonb_build_object('baseUnitPrice',trim_scale(price)::text);
 end if;
 if snapshot is null then return p_resolved||jsonb_build_object('pricing',null);end if;
 if measurement is not null and measurement<>'null'::jsonb then
  entered_price:=price*quantity/(measurement->>'enteredQuantity')::numeric;
  if round(entered_price,12)<>entered_price then raise exception 'MEASUREMENT_PRICE_PRECISION' using errcode='22023';end if;
  measurement:=measurement||jsonb_build_object('enteredUnitPrice',trim_scale(entered_price)::text,'baseUnitPrice',trim_scale(price)::text,'tradePricing',snapshot);
 end if;
 return p_resolved||jsonb_build_object('baseUnitPrice',price,'lineTotal',round(price*quantity,2),'measurement',measurement,'pricing',snapshot);
end;$$;
revoke all on function shop_private.apply_trade_price(uuid,uuid,uuid,jsonb,jsonb,numeric) from public,anon,authenticated,service_role;

-- Reviewed forward replacement; no published migration is changed.
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.quote_customer_sale(uuid,uuid,uuid,jsonb,boolean,uuid)'::regprocedure) is distinct from 'cac0e74636f98fa6b01738f20d1899c7' then raise exception 'COMMODITY_ROUTINE_REVIEW_REQUIRED' using errcode='55000';end if;end;$$;
create or replace function public.quote_customer_sale(p_shop_id uuid,p_location_id uuid,p_customer_id uuid,p_lines jsonb,p_bundles boolean default true,p_invoice_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare policy jsonb;lines jsonb:='[]';item jsonb;price numeric;discount numeric;qty numeric;r jsonb;base jsonb;matched jsonb;trade boolean:=false;prior jsonb;line_index integer:=0;begin
 perform shop_private.assert_sale_read_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_bundles is null or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'INVALID_TAX_INPUT' using errcode='22023';end if;
 if p_customer_id is not null then
  if not exists(select 1 from public.clients where id=p_customer_id and shop_id=p_shop_id and is_active) then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002';end if;
 end if;
 if p_invoice_id is not null and not exists(select 1 from public.invoices where id=p_invoice_id and shop_id=p_shop_id and location_id=p_location_id and status='draft' and client_id is not distinct from p_customer_id) then raise exception 'SALE_DRAFT_NOT_FOUND' using errcode='P0002';end if;
 select p.policy into policy from public.tax_policy_versions p where shop_id=p_shop_id and effective_at<=statement_timestamp() order by effective_at desc,created_at desc,id desc limit 1;
 for item in select value from jsonb_array_elements(p_lines) loop
  line_index:=line_index+1;prior:=null;
  if p_invoice_id is not null then select to_jsonb(i) into prior from public.invoice_items i where i.invoice_id=p_invoice_id and i.shop_id=p_shop_id and i.line_order=line_index;end if;
  qty:=(item->>'quantity')::numeric;r:=null;
  if item->>'item_type'='product' then
   r:=shop_private.resolve_measured_line(p_shop_id,(item->>'source_id')::uuid,item);
   r:=shop_private.apply_trade_line_price(p_shop_id,(item->>'source_id')::uuid,p_customer_id,item,r,shop_private.trade_cart_quantity(p_shop_id,(item->>'source_id')::uuid,p_lines),prior,p_customer_id);
   trade:=trade or coalesce(r->'pricing','null'::jsonb)<>'null'::jsonb;
   qty:=(r->>'baseQuantity')::numeric;price:=(r->>'baseUnitPrice')::numeric;discount:=0;
   if shop_private.is_reel_tracked(p_shop_id,(item->>'source_id')::uuid) then perform shop_private.plan_reel_sale(p_shop_id,(item->>'source_id')::uuid,p_location_id,qty,r->'measurement');end if;
  elsif item->>'item_type'='service' then
   select base_sale_price,round((case default_discount_type when 'percent' then round(base_sale_price*default_discount_value/100,2) else default_discount_value end)*qty,2)
   into price,discount from public.services where id=(item->>'source_id')::uuid and shop_id=p_shop_id and is_active;
  else raise exception 'UNSUPPORTED_SALE_LINE_TYPE' using errcode='22023';end if;
  if price is null or qty is null or qty<=0 or qty>1000000 then raise exception 'TAX_ITEM_NOT_FOUND' using errcode='P0002';end if;
  lines:=lines||jsonb_build_array(jsonb_build_object('itemType',item->>'item_type','sourceId',item->>'source_id','quantity',qty,'unitPrice',price,'lineDiscount',discount,'measurement',r->'measurement','pricing',r->'pricing'));
 end loop;
 -- A cart uses either agreed trade/override prices or bundle discounts. Mixing
 -- both would apply an unrelated base-catalog discount to negotiated prices.
 if p_bundles and not trade then matched:=shop_private.match_catalog_offers(p_shop_id,p_lines);else matched:='{"discount":0,"offers":[]}'::jsonb;end if;
 base:=shop_private.calculate_tax(lines,policy,(matched->>'discount')::numeric);
 return base||matched||jsonb_build_object('tradePricingApplied',trade,'tradePricingEnabled',exists(select 1 from public.trade_price_rules where shop_id=p_shop_id and active and starts_at<=statement_timestamp() and (ends_at is null or ends_at>statement_timestamp())) or exists(select 1 from public.product_commodity_rules where shop_id=p_shop_id and active));
end;$$;
revoke all on function public.quote_customer_sale(uuid,uuid,uuid,jsonb,boolean,uuid) from public,anon,authenticated,service_role;
grant execute on function public.quote_customer_sale(uuid,uuid,uuid,jsonb,boolean,uuid) to authenticated;

commit;
