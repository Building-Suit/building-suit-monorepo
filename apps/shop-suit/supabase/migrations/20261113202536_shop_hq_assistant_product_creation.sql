begin;

-- Name-only products stay in the catalogue without entering a sale until
-- the owner explicitly sets a price. Existing and manually created products
-- keep their current pricing semantics, including an explicit zero price.
alter table public.products
  add column price_pending boolean not null default false,
  add constraint products_pending_price_placeholder check (not price_pending or sale_price = 0);

create function shop_private.clear_pending_product_price() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.price_pending := false;
  return new;
end;
$$;

create trigger products_clear_pending_price before update of sale_price on public.products
  for each row when (old.price_pending) execute function shop_private.clear_pending_product_price();

create function shop_private.require_invoice_product_price() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.products product
    where product.id = new.product_id and product.shop_id = new.shop_id and product.price_pending
  ) then
    raise exception 'PRODUCT_PRICE_REQUIRED' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger invoice_items_require_product_price
  before insert or update of product_id,shop_id,unit_price on public.invoice_items
  for each row when (new.product_id is not null) execute function shop_private.require_invoice_product_price();

revoke all on function shop_private.clear_pending_product_price() from public,anon,authenticated,service_role;
revoke all on function shop_private.require_invoice_product_price() from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION shop_private.list_products(p_shop_id uuid, p_search text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_search text := nullif(btrim(p_search), ''); v_items jsonb; v_total bigint;
begin
  if not shop_private.has_permission(p_shop_id, 'products.view') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501'; end if;
  if p_page < 1 or p_page_size < 1 or p_page_size > 100
    or length(coalesce(v_search, '')) > 160 then
    raise exception 'INVALID_PRODUCT_QUERY' using errcode = '22023'; end if;
  if p_category_id is not null and not exists (select 1 from public.catalog_categories
    where id = p_category_id and shop_id = p_shop_id and is_active) then
    raise exception 'CATEGORY_NOT_FOUND'; end if;
  select count(*) into v_total from public.products product
  left join public.catalog_categories category on category.id = product.category_id
  where product.shop_id = p_shop_id and product.is_active
    and (p_category_id is null or product.category_id = p_category_id)
    and (v_search is null or product.name ilike '%' || v_search || '%'
      or coalesce(product.sku, '') ilike '%' || v_search || '%'
      or coalesce(product.barcode, '') ilike '%' || v_search || '%'
      or coalesce(category.name, '') ilike '%' || v_search || '%'
        or shop_private.matches_technical_search(p_shop_id,product.id,v_search));
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.name, rows.id), '[]'::jsonb)
  into v_items from (select product.id, product.name, product.sku, product.barcode,
      product.sale_price, product.price_pending, product.base_unit_code,product.quantity_increment,product.measurement_status,product.measurement_revision,product.sale_unit_codes, product.category_id, category.name category_name, product.created_at,shop_private.product_technical_snapshot(p_shop_id,product.id) technical_details
    from public.products product left join public.catalog_categories category on category.id = product.category_id
    where product.shop_id = p_shop_id and product.is_active
      and (p_category_id is null or product.category_id = p_category_id)
      and (v_search is null or product.name ilike '%' || v_search || '%'
        or coalesce(product.sku, '') ilike '%' || v_search || '%'
        or coalesce(product.barcode, '') ilike '%' || v_search || '%'
        or coalesce(category.name, '') ilike '%' || v_search || '%'
        or shop_private.matches_technical_search(p_shop_id,product.id,v_search))
    order by lower(product.name), product.id offset (p_page - 1) * p_page_size limit p_page_size) rows;
  return jsonb_build_object('items', v_items, 'total', v_total, 'page', p_page, 'pageSize', p_page_size,'supportsMeasurements',true,'supportsTechnicalDetails',true);
end;
$$;

CREATE OR REPLACE FUNCTION shop_private.pos_catalog_search(p_shop_id uuid, p_location_id uuid, p_search text DEFAULT NULL::text, p_item_type text DEFAULT NULL::text, p_barcode text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 30) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_search text := nullif(btrim(p_search), ''); v_barcode text := nullif(btrim(p_barcode), '');
  v_mode public.business_mode; v_items jsonb; v_total bigint;
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  if not coalesce((select can_manage from shop_private.sale_access(p_shop_id)), false) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501'; end if;
  if p_item_type is not null and p_item_type not in ('product', 'service')
    or p_page is null or p_page < 1 or p_page_size is null or p_page_size < 1 or p_page_size > 50
    or length(coalesce(v_search, '')) > 160 or length(coalesce(v_barcode, '')) > 80 then
    raise exception 'INVALID_POS_CATALOG_QUERY' using errcode = '22023'; end if;
  if p_category_id is not null and not exists (select 1 from public.catalog_categories
    where id = p_category_id and shop_id = p_shop_id and is_active) then
    raise exception 'CATEGORY_NOT_FOUND'; end if;
  select business_mode into v_mode from public.shops where id = p_shop_id;
  with catalog as (
    select product.id, 'product'::text item_type, product.name, product.sku,
      product.barcode, product.sale_price unit_price, 0::numeric discount,
      greatest(coalesce((select sum(batch.remaining_quantity) from public.inventory_batches batch
        where batch.shop_id = p_shop_id and batch.location_id = p_location_id
          and batch.product_id = product.id), 0)-coalesce((select sum(remaining_quantity) from public.trade_order_reservations where shop_id=p_shop_id and location_id=p_location_id and product_id=product.id and status='active' and expires_at>statement_timestamp()),0),0) stock,
      product.category_id, category.name category_name
    from public.products product left join public.catalog_categories category on category.id = product.category_id
    where product.shop_id = p_shop_id and product.is_active and not product.price_pending and v_mode in ('product', 'mixed')
      and (p_item_type is null or p_item_type = 'product')
      and (p_category_id is null or product.category_id = p_category_id)
      and (v_barcode is null or product.barcode = v_barcode or exists(select 1 from public.product_packagings k where k.shop_id=product.shop_id and k.product_id=product.id and k.active and k.can_sell and k.barcode=v_barcode) or exists(select 1 from public.inventory_reels r where r.shop_id=product.shop_id and r.location_id=p_location_id and r.product_id=product.id and r.barcode=v_barcode and r.status<>'archived'))
      and (v_search is null or product.name ilike '%' || v_search || '%'
        or coalesce(product.sku, '') ilike '%' || v_search || '%'
        or coalesce(product.barcode, '') ilike '%' || v_search || '%'
        or coalesce(category.name, '') ilike '%' || v_search || '%'
        or shop_private.matches_technical_search(p_shop_id,product.id,v_search))
    union all
    select service.id, 'service', service.name, null, null, service.base_sale_price,
      case service.default_discount_type when 'percent'
        then round(service.base_sale_price * service.default_discount_value / 100, 2)
        else service.default_discount_value end, null::numeric,
      service.category_id, category.name
    from public.services service left join public.catalog_categories category on category.id = service.category_id
    where service.shop_id = p_shop_id and service.is_active and v_mode in ('service', 'mixed')
      and v_barcode is null and (p_item_type is null or p_item_type = 'service')
      and (p_category_id is null or service.category_id = p_category_id)
      and (v_search is null or service.name ilike '%' || v_search || '%'
        or coalesce(category.name, '') ilike '%' || v_search || '%')
  ), counted as (select *, count(*) over () total_count from catalog), paged as (
    select * from counted order by lower(name), id offset (p_page - 1) * p_page_size limit p_page_size
  ) select coalesce(max(total_count), 0), coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'itemType', item_type, 'name', name, 'sku', sku, 'barcode', barcode,
    'unitPrice', unit_price, 'discount', discount, 'stock', stock,
    'categoryId', category_id, 'categoryName', category_name
  ) order by lower(name), id), '[]'::jsonb) into v_total, v_items from paged;
  select coalesce(jsonb_agg(e||case when shop_private.is_reel_tracked(p_shop_id,(e->>'id')::uuid) then jsonb_build_object('stock',(shop_private.reel_availability(p_shop_id,p_location_id,(e->>'id')::uuid)->>'available')::numeric,'catalogStock',(shop_private.reel_availability(p_shop_id,p_location_id,(e->>'id')::uuid)->>'available')::numeric,'reelSummary',shop_private.reel_availability(p_shop_id,p_location_id,(e->>'id')::uuid)) else '{}'::jsonb end||jsonb_build_object('measurement',shop_private.pos_measurement(p_shop_id,(e->>'id')::uuid))||coalesce((select jsonb_build_object('unitSelection','package:'||k.id::text,'unitPrice',coalesce(k.sale_price,(e->>'unitPrice')::numeric*k.base_quantity),'barcode',k.barcode) from public.product_packagings k where k.shop_id=p_shop_id and k.product_id=(e->>'id')::uuid and k.active and k.can_sell and k.barcode=v_barcode),'{}')||coalesce((select jsonb_build_object('reelId',r.id,'reelBarcode',r.barcode,'reelStatus',r.status,'reelRemaining',trim_scale(greatest(r.remaining_length-shop_private.reserved_reel_quantity(r.id),0))::text,'reelOnHand',trim_scale(r.remaining_length)::text,'reelPrice',case when r.classification='discounted' then r.remnant_price else null end,'stock',case when r.status in('sealed','open') and r.classification in('sellable','discounted') then greatest(r.remaining_length-shop_private.reserved_reel_quantity(r.id),0) else 0 end,'unitPrice',case when r.classification='discounted' then r.remnant_price else p.sale_price end,'unitSelection','unit:'||p.base_unit_code,'barcode',r.barcode) from public.inventory_reels r join public.products p on p.id=r.product_id and p.shop_id=r.shop_id where r.shop_id=p_shop_id and r.location_id=p_location_id and r.product_id=(e->>'id')::uuid and r.barcode=v_barcode and r.status<>'archived'),'{}') order by n),'[]') into v_items from jsonb_array_elements(v_items) with ordinality a(e,n);
  select coalesce(jsonb_agg(e||case when e->>'itemType'='product' then jsonb_build_object(
   'stockOnHand',trim_scale(coalesce((select sum(remaining_quantity) from public.inventory_batches where shop_id=p_shop_id and location_id=p_location_id and product_id=(e->>'id')::uuid),0))::text,
   'stockReserved',trim_scale(coalesce((select sum(remaining_quantity) from public.trade_order_reservations where shop_id=p_shop_id and location_id=p_location_id and product_id=(e->>'id')::uuid and status='active' and expires_at>statement_timestamp()),0))::text) else '{}'::jsonb end order by n),'[]') into v_items from jsonb_array_elements(v_items) with ordinality rows(e,n);
  return jsonb_build_object('items', v_items, 'total', v_total, 'page', p_page,
    'pageSize', p_page_size, 'businessMode', v_mode,
    'ambiguousBarcode', v_barcode is not null and v_total > 1);
end;
$$;

create or replace function shop_private.resolve_measured_line(p_shop uuid,p_product uuid,p_line jsonb,p_purchase boolean default false) returns jsonb
language plpgsql stable set search_path='' as $capture$
declare result jsonb;measurement jsonb;loss_text text:=coalesce(p_line->>'cutting_loss','0');loss numeric;split boolean;reel public.inventory_reels%rowtype;
 entered_price numeric;factor numeric;fixed_package boolean;begin
 if not p_purchase and exists (
  select 1 from public.products product where product.id=p_product and product.shop_id=p_shop and product.price_pending
 ) then raise exception 'PRODUCT_PRICE_REQUIRED' using errcode = '23514'; end if;
 result:=shop_private.resolve_measured_line_before_reels(p_shop,p_product,p_line,p_purchase);
 if p_line ? 'measurement_capture' then
  if p_purchase or result->'measurement' is null or result->'measurement'='null'::jsonb then raise exception 'WEIGHT_CAPTURE_NOT_ALLOWED' using errcode='22023';end if;
  measurement:=result->'measurement';
  measurement:=measurement||jsonb_build_object('capture',case when p_line#>>'{measurement_capture,kind}'='scale' then shop_private.resolve_scale_capture(p_shop,p_product,p_line->'measurement_capture',(result->>'baseQuantity')::numeric) else shop_private.resolve_weight_capture(p_shop,p_product,p_line->'measurement_capture',(result->>'baseQuantity')::numeric) end);
  result:=result||jsonb_build_object('measurement',measurement);
 end if;
 if p_purchase or not shop_private.is_reel_tracked(p_shop,p_product) then return result;end if;
 if loss_text !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' or (p_line ? 'allow_split' and jsonb_typeof(p_line->'allow_split')<>'boolean') then raise exception 'INVALID_REEL_CUT' using errcode='22023';end if;
 loss:=loss_text::numeric;split:=coalesce((p_line->>'allow_split')::boolean,false);
 if loss>0 then perform shop_private.assert_measured_quantity(p_shop,p_product,loss);end if;
 if loss>1000000 then raise exception 'INVALID_REEL_CUT' using errcode='22023';end if;
 measurement:=result->'measurement';
 if p_line->>'reel_id' is not null then
  select * into reel from public.inventory_reels where id=(p_line->>'reel_id')::uuid and shop_id=p_shop and product_id=p_product;
  if not found or reel.status not in('sealed','open') or reel.classification not in('sellable','discounted') then raise exception 'REEL_NOT_AVAILABLE' using errcode='55000';end if;
  fixed_package:=exists(select 1 from public.product_packagings where id=(measurement->>'packageId')::uuid and shop_id=p_shop and product_id=p_product and sale_price is not null);
  if reel.classification='discounted' and not fixed_package then
   factor:=(measurement->>'baseQuantity')::numeric/(measurement->>'enteredQuantity')::numeric;
   entered_price:=reel.remnant_price*factor;
   if round(entered_price,12)<>entered_price then raise exception 'MEASUREMENT_PRICE_PRECISION' using errcode='22023';end if;
   result:=result||jsonb_build_object('baseUnitPrice',reel.remnant_price,'lineTotal',round(reel.remnant_price*(measurement->>'baseQuantity')::numeric,2));
   measurement:=measurement||jsonb_build_object('enteredUnitPrice',trim_scale(entered_price)::text,'baseUnitPrice',trim_scale(reel.remnant_price)::text,'priceSource','reel_remnant');
  end if;
 end if;
 measurement:=measurement||jsonb_build_object('reelTracking',true,'reelId',reel.id,'allowSplit',split,'cuttingLoss',trim_scale(loss)::text,
  'reelReturnPolicy',(select reel_return_policy||jsonb_build_object('damagedRestock',false) from public.product_technical_profiles where shop_id=p_shop and product_id=p_product));
 if measurement->>'packageId' is not null and loss<>0 then raise exception 'INVALID_SEALED_REEL_SALE' using errcode='22023';end if;
 return result||jsonb_build_object('measurement',measurement);
end;$capture$;

alter table shop_private.hq_assistant_chat_messages drop constraint hq_assistant_chat_messages_kind_check,
  add constraint hq_assistant_chat_messages_kind_check
    check (kind in ('message','receipt','clarification','status','action','product'));

-- Get the current Shop Suit mode under the same authenticated queue lease and
-- consent checks used by the worker's conversation recall.
create function public.shop_hq_assistant_shop_context(p_job_id uuid,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_worker uuid;
  v_job shop_private.hq_assistant_jobs%rowtype;
  v_mode public.business_mode;
begin
  perform shop_private.hq_assistant_queue_lock();
  v_worker := shop_private.hq_assistant_require_queue_worker();
  select * into v_job from shop_private.hq_assistant_jobs where id = p_job_id;
  if not found or p_lease_token is null or v_job.lease_token is distinct from p_lease_token
    or v_job.worker_id is distinct from v_worker or v_job.employee_id is null
    or v_job.stage not in ('employee','reviewing') or v_job.expires_at <= clock_timestamp()
    or v_job.lease_expires_at is null or v_job.lease_expires_at <= clock_timestamp()
    or v_job.transcript_expires_at is null or v_job.transcript_expires_at <= clock_timestamp()
    or not shop_private.hq_assistant_current_consent(v_job) then
    raise exception 'SHOP_HQ_ASSISTANT_CONTEXT_LEASE_REQUIRED' using errcode = '42501';
  end if;
  select shop.business_mode into strict v_mode from public.shops shop where shop.id = v_job.shop_id;
  return jsonb_build_object('businessMode',v_mode,'productsEnabled',v_mode in ('product','mixed'));
end;
$$;

revoke all on function public.shop_hq_assistant_shop_context(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.shop_hq_assistant_shop_context(uuid,uuid) to authenticated;

-- Only the current owner message can substantiate a supplied amount. When the
-- message does not supply a verifiable selling price, keep pricing pending.
create function shop_private.hq_assistant_create_product(p_job shop_private.hq_assistant_jobs,p_product jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := btrim(p_product->>'name');
  v_message text := shop_private.hq_sale_name(p_job.owner_message);
  v_claim_sub text := current_setting('request.jwt.claim.sub',true);
  v_claims text := current_setting('request.jwt.claims',true);
  v_product_id uuid;
  v_price numeric;
  v_evidence text[];
  v_mode public.business_mode;
  v_currency text;
begin
  if not coalesce(shop_private.hq_sale_mentions(v_message,
    btrim(regexp_replace(shop_private.hq_sale_name(v_name),'[[:space:][:punct:]،؛؟]+',' ','g'))),false) then
    return null;
  end if;
  -- Match the lock used by the regular catalogue write and shop-mode changes.
  select shop.business_mode,shop.business_currency into v_mode,v_currency
  from public.shops shop where shop.id = p_job.shop_id for update;
  if not found or v_mode not in ('product','mixed') then return null; end if;

  if p_product->>'salePrice' is not null then
    v_evidence := regexp_match(translate(v_message,'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹٫','01234567890123456789.'),
      '(?:^| )(?:sale price|price|priced at|سعر البيع|سعره|السعر|بسعر) *[:=]? *([0-9]{1,9}(?:[.][0-9]{1,2})?) *([a-z]{3}|جنيه(?: مصري)?)?[.!؟]?$');
    if (v_evidence[1])::numeric = (p_product->>'salePrice')::numeric
      and (v_evidence[2] is null or upper(v_evidence[2]) = v_currency
        or (v_currency = 'EGP' and v_evidence[2] in ('جنيه','جنيه مصري'))) then
      v_price := (p_product->>'salePrice')::numeric;
    end if;
  end if;

  begin
    -- The usual catalogue operation enforces the owner's permissions and plan.
    perform set_config('request.jwt.claim.sub',p_job.actor_id::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object(
      'sub',p_job.actor_id,'role','authenticated','is_anonymous',false)::text,true);
    v_product_id := shop_private.save_product_with_category(
      p_job.shop_id,null,v_name,null,null,coalesce(v_price,0),null);
    perform set_config('request.jwt.claim.sub',coalesce(v_claim_sub,''),true);
    perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
  exception when insufficient_privilege then
    return null;
  when check_violation then
    if sqlerrm = 'PRODUCT_LIMIT_REACHED' then return null; end if;
    raise;
  end;

  if v_price is null then
    update public.products set price_pending = true where id = v_product_id and shop_id = p_job.shop_id;
  end if;
  return jsonb_build_object('kind','product','productId',v_product_id,'name',v_name,'pricePending',v_price is null);
end;
$$;

revoke all on function shop_private.hq_assistant_create_product(shop_private.hq_assistant_jobs,jsonb)
  from public,anon,authenticated,service_role;

create or replace function shop_private.hq_assistant_valid_intent(p_intent jsonb) returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
  v_keys constant text[] := array['kind','customerName','customerPhone','services','paymentMethod','paidAmount','paymentReceived','reply'];
  v_amount numeric;
  v_product jsonb;
begin
  if jsonb_typeof(p_intent) is distinct from 'object' or octet_length(p_intent::text) > 8192 then
    return false;
  end if;
  if not (p_intent ?& v_keys) or (p_intent - v_keys - 'links' - 'product') <> '{}'::jsonb
    or jsonb_typeof(p_intent->'reply') is distinct from 'string'
    or (p_intent->>'reply') !~ '[^[:space:]]' or length(p_intent->>'reply') > 1000
    or jsonb_typeof(p_intent->'services') is distinct from 'array'
    or jsonb_typeof(p_intent->'paymentReceived') is distinct from 'boolean' then
    return false;
  end if;
  if p_intent ? 'links' then
    if jsonb_typeof(p_intent->'links') <> 'array' then return false; end if;
    if jsonb_array_length(p_intent->'links') > 3 or exists (
      select 1 from jsonb_array_elements(p_intent->'links') link(value)
      where jsonb_typeof(link.value) <> 'string' or not shop_private.hq_assistant_page(link.value #>> '{}')
    ) or (select count(distinct link.value) from jsonb_array_elements(p_intent->'links') link(value))
      <> jsonb_array_length(p_intent->'links') then return false; end if;
  end if;
  if p_intent->>'kind' = 'create_product' then
    v_product := p_intent->'product';
    if jsonb_typeof(v_product) is distinct from 'object'
      or not (v_product ?& array['name','salePrice']) or (v_product - 'name' - 'salePrice') <> '{}'::jsonb
      or jsonb_typeof(v_product->'name') is distinct from 'string'
      or length(btrim(v_product->>'name')) not between 2 and 160 or length(v_product->>'name') > 160
      or coalesce(p_intent->'links','[]'::jsonb) <> '[]'::jsonb then return false; end if;
    if jsonb_typeof(v_product->'salePrice') = 'number' then
      v_amount := (v_product->>'salePrice')::numeric;
      if v_amount < 0 or v_amount > 999999999.99 or v_amount <> round(v_amount,2) then return false; end if;
    elsif v_product->'salePrice' <> 'null'::jsonb then return false; end if;
  elsif p_intent ? 'product' then
    return false;
  end if;
  if p_intent->>'kind' in ('reply','create_product') then
    return p_intent->'customerName' = 'null'::jsonb and p_intent->'customerPhone' = 'null'::jsonb
      and p_intent->'services' = '[]'::jsonb and p_intent->'paymentMethod' = 'null'::jsonb
      and p_intent->'paidAmount' = 'null'::jsonb and p_intent->'paymentReceived' = 'false'::jsonb;
  end if;
  if jsonb_typeof(p_intent->'paidAmount') = 'number' then
    v_amount := (p_intent->>'paidAmount')::numeric;
    if v_amount <= 0 or v_amount > 9999999999.99 or v_amount <> round(v_amount, 2) then return false; end if;
  elsif p_intent->'paidAmount' <> 'null'::jsonb then
    return false;
  end if;
  return coalesce(p_intent->>'kind' = 'service_sale', false)
    and jsonb_typeof(p_intent->'customerName') = 'string'
    and length(btrim(p_intent->>'customerName')) between 2 and 160 and length(p_intent->>'customerName') <= 160
    and (p_intent->'customerPhone' = 'null'::jsonb or
      (jsonb_typeof(p_intent->'customerPhone') = 'string' and length(btrim(p_intent->>'customerPhone')) between 7 and 32))
    and (p_intent->'paymentMethod' = 'null'::jsonb or coalesce(p_intent->>'paymentMethod', '') in ('cash','card','transfer'))
    and jsonb_array_length(p_intent->'services') between 1 and 6
    and not exists (
      select 1 from jsonb_array_elements(p_intent->'services') as item(value)
      where jsonb_typeof(item.value) <> 'string' or length(btrim(item.value #>> '{}')) not between 2 and 120
        or length(item.value #>> '{}') > 120
    );
end;
$$;

create or replace function shop_private.hq_assistant_latest_action(p_updates jsonb) returns jsonb
language sql immutable set search_path = ''
as $$
  select action.value from jsonb_array_elements(p_updates) with ordinality as action(value, sequence)
  where action.value->>'kind' in ('receipt','clarification','product')
  order by action.sequence desc limit 1;
$$;

create or replace function public.shop_hq_assistant_finish(p_job_id uuid,p_lease_token uuid,p_intent jsonb,p_succeeded boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_worker uuid; v_job shop_private.hq_assistant_jobs%rowtype; v_digest bytea; v_sale_pending boolean; v_destination text;
  v_product jsonb; v_success boolean := p_succeeded;
begin
  perform shop_private.hq_assistant_queue_lock();
  v_worker := shop_private.hq_assistant_require_queue_worker();
  if p_succeeded is null or (p_succeeded and not shop_private.hq_assistant_valid_intent(p_intent))
    or (not p_succeeded and p_intent is not null and p_intent <> 'null'::jsonb) then
    raise exception 'SHOP_HQ_ASSISTANT_INVALID_RESULT' using errcode = '22023';
  end if;
  perform shop_private.hq_assistant_cleanup();
  select * into v_job from shop_private.hq_assistant_jobs where id = p_job_id;
  if not found or v_job.transcript_expires_at is null or v_job.transcript_expires_at <= clock_timestamp()
    or not shop_private.hq_assistant_current_consent(v_job) then return false; end if;
  v_digest := extensions.digest(convert_to(jsonb_build_array(p_lease_token,p_succeeded,p_intent)::text,'UTF8'),'sha256');
  if v_job.employee_finish_token = p_lease_token and v_job.employee_finish_worker = v_worker then
    return v_job.employee_finish_digest = v_digest;
  end if;
  if v_job.stage <> 'employee' or v_job.worker_id is distinct from v_worker
    or v_job.lease_token is distinct from p_lease_token or p_lease_token is null
    or v_job.lease_expires_at <= clock_timestamp() then return false; end if;
  if p_succeeded and p_intent->>'kind' = 'create_product' then
    -- A correction uses a new lease but must not duplicate a committed record.
    if not (v_job.updates @> '[{"kind":"product"}]'::jsonb) then
      v_product := shop_private.hq_assistant_create_product(v_job,p_intent->'product');
      v_success := v_product is not null;
      if v_success then perform shop_private.hq_assistant_append_update(p_job_id,v_product); end if;
    end if;
  end if;
  v_sale_pending := p_succeeded and p_intent->>'kind' = 'service_sale'
    and not (v_job.updates @> '[{"kind":"receipt"}]'::jsonb or v_job.updates @> '[{"kind":"product"}]'::jsonb);
  if p_succeeded and p_intent->>'kind' <> 'create_product' then
    perform shop_private.hq_assistant_append_update(p_job_id,jsonb_build_object('kind','reply','text',p_intent->>'reply'));
    for v_destination in select jsonb_array_elements_text(coalesce(p_intent->'links','[]'::jsonb))
    loop
      perform shop_private.hq_assistant_append_update(p_job_id,
        jsonb_build_object('kind','action','destination',v_destination));
    end loop;
  end if;
  update shop_private.hq_assistant_jobs
  set state = case when v_success or v_job.state = 'completed' then 'completed' else 'failed' end,
    stage = case when v_sale_pending then 'sale_pending' when v_success then 'review_pending' else 'closed' end,
    intent = case when v_success then p_intent else intent end,
    intent_expires_at = case when v_success then transcript_expires_at else intent_expires_at end,
    context_messages = case when v_success then context_messages end,
    feedback = null,
    worker_id = case when v_sale_pending then v_worker end,
    lease_token = case when v_sale_pending then p_lease_token end,
    lease_expires_at = case when v_sale_pending then least(expires_at, clock_timestamp() + interval '60 seconds') end,
    employee_finish_worker = v_worker, employee_finish_token = p_lease_token, employee_finish_digest = v_digest
  where id = p_job_id;
  perform shop_private.hq_assistant_signal_owner(p_job_id);
  perform shop_private.hq_assistant_signal_staff();
  return true;
end;
$$;

create or replace function shop_private.hq_assistant_mirror_chat() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_changed boolean := false;
  v_update jsonb;
  v_kind text;
  v_text text;
  v_detail jsonb;
begin
  -- Only requests newly admitted with persistent-history consent enter this
  -- table. Operationally retained v2 messages cannot silently be archived.
  if old.owner_message is null and new.owner_message is not null and exists (
    select 1 from shop_private.hq_assistant_assignments assignment
    where assignment.actor_id = new.actor_id and assignment.shop_id = new.shop_id and assignment.enabled
      and assignment.consent_version = 3 and assignment.generation = new.consent_generation
  ) then
    insert into shop_private.hq_assistant_chat_messages
      (actor_id,shop_id,location_id,job_id,request_id,consent_generation,source_sequence,role,kind,text,created_at)
    values (new.actor_id,new.shop_id,new.location_id,new.id,new.request_id,new.consent_generation,0,
      'user','message',new.owner_message,new.created_at)
    on conflict (job_id,source_sequence) do nothing;
    v_changed := found;
  end if;
  if not exists (
    select 1 from shop_private.hq_assistant_chat_messages message where message.job_id = new.id and message.source_sequence = 0
  ) then return null; end if;

  if new.transcript_expires_at is not null and new.updates is distinct from old.updates then
    for v_update in select item.value from jsonb_array_elements(new.updates) with ordinality item(value,position)
      where item.position > jsonb_array_length(old.updates) order by item.position
    loop
      v_kind := v_update->>'kind';
      v_text := null;
      v_detail := null;
      case v_kind
        when 'reply' then
          v_kind := 'message';
          v_text := v_update->>'text';
        when 'receipt' then
          v_detail := jsonb_build_object('destination','receipt','saleId',(v_update->>'invoiceId')::uuid);
        when 'product' then
          v_detail := jsonb_build_object('destination','product','productId',(v_update->>'productId')::uuid,
            'name',v_update->>'name','pricePending',(v_update->>'pricePending')::boolean);
        when 'action' then
          if shop_private.hq_assistant_page(v_update->>'destination') then
            v_detail := jsonb_build_object('destination',v_update->>'destination');
          end if;
        when 'clarification' then
          v_detail := shop_private.hq_assistant_chat_clarification(v_update->'outcome');
        else continue;
      end case;
      if v_text is null and v_detail is null then continue; end if;
      insert into shop_private.hq_assistant_chat_messages
        (actor_id,shop_id,location_id,job_id,request_id,consent_generation,source_sequence,role,kind,text,detail)
      values (new.actor_id,new.shop_id,new.location_id,new.id,new.request_id,new.consent_generation,
        (v_update->>'sequence')::int,'assistant',v_kind,v_text,v_detail)
      on conflict (job_id,source_sequence) do nothing;
      v_changed := v_changed or found;
    end loop;
  end if;

  if new.state is distinct from old.state and (
    new.state in ('failed','expired') and new.transcript_expires_at is not null
    or new.state = 'revoked' and old.stage <> 'closed'
  ) then
    insert into shop_private.hq_assistant_chat_messages
      (actor_id,shop_id,location_id,job_id,request_id,consent_generation,source_sequence,role,kind,detail)
    values (new.actor_id,new.shop_id,new.location_id,new.id,new.request_id,new.consent_generation,
      -1,'assistant','status',jsonb_build_object('status',new.state))
    on conflict (job_id,source_sequence) do nothing;
    v_changed := v_changed or found;
  end if;

  if v_changed or ((new.state,new.stage) is distinct from (old.state,old.stage)
    and (new.transcript_expires_at is not null or old.stage <> 'closed')) then
    declare
      v_previous_topic text := current_setting('realtime.topic',true);
    begin
      perform realtime.send('{}'::jsonb,'chat',
        shop_private.hq_assistant_chat_topic(new.actor_id,new.shop_id,new.location_id),true);
      perform set_config('realtime.topic',coalesce(v_previous_topic,''),true);
    end;
  end if;
  return null;
end;
$$;

create or replace function public.shop_hq_assistant_history(
  p_shop_id uuid,p_location_id uuid,p_before_sequence bigint default null,p_limit integer default 30
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_limit integer := coalesce(p_limit,30);
  v_page jsonb;
  v_active jsonb;
  v_now timestamptz := clock_timestamp();
  v_more boolean;
begin
  if not coalesce(shop_private.hq_assistant_chat_owner(v_actor,p_shop_id,p_location_id),false) then
    raise exception 'SHOP_HQ_ASSISTANT_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if v_limit not between 1 and 30 or (p_before_sequence is not null and p_before_sequence not between 1 and 9007199254740991) then
    raise exception 'SHOP_HQ_ASSISTANT_INVALID_HISTORY_PAGE' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('sequence',page.sequence,'jobId',page.job_id,'role',page.role,
    'kind',page.kind,'createdAt',page.created_at) || case page.kind
      when 'message' then jsonb_build_object('text',page.text)
      when 'receipt' then jsonb_build_object('link',page.detail)
      when 'product' then jsonb_build_object('link',page.detail)
      when 'action' then jsonb_build_object('link',page.detail)
      when 'clarification' then jsonb_build_object('outcome',page.detail)
      else page.detail end order by page.sequence desc),'[]'::jsonb)
  into v_page from (
    select message.sequence,message.job_id,message.role,message.kind,message.created_at,message.text,message.detail
    from shop_private.hq_assistant_chat_messages message
    where message.actor_id = v_actor and message.shop_id = p_shop_id and message.location_id = p_location_id
      and (p_before_sequence is null or message.sequence < p_before_sequence)
    order by message.sequence desc limit v_limit + 1
  ) page;
  v_more := jsonb_array_length(v_page) > v_limit;
  if v_more then v_page := v_page - v_limit; end if;
  select coalesce(jsonb_agg(item.value order by item.position desc),'[]'::jsonb) into v_page
  from jsonb_array_elements(v_page) with ordinality item(value,position);

  select coalesce(jsonb_agg(jsonb_build_object('jobId',job.id,
    'state',case when job.stage = 'sale_pending' then 'working' else job.state end,
    'reviewPending',job.state = 'completed' and job.stage <> 'sale_pending')
    order by job.created_at,job.id),'[]'::jsonb) into v_active
  from shop_private.hq_assistant_jobs job
  join shop_private.hq_assistant_assignments assignment on assignment.actor_id = job.actor_id
    and assignment.shop_id = job.shop_id and assignment.generation = job.consent_generation
  where job.actor_id = v_actor and job.shop_id = p_shop_id and job.location_id = p_location_id
    and job.stage <> 'closed' and job.state in ('queued','working','completed') and job.expires_at > v_now
    and (job.state <> 'working' or job.lease_expires_at > v_now)
    and assignment.enabled and assignment.consent_version = shop_private.hq_assistant_consent_version();

  return jsonb_build_object('messages',v_page,'hasMore',v_more,'activeJobs',v_active);
end;
$$;

notify pgrst, 'reload schema';
commit;
