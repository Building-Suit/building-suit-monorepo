begin;
-- Supported, verified GS1 subset. National RCN/EAN weight/price layouts are not
-- inferred from prefixes. AI01 + AI3100..3105 has fixed lengths and net kg.
create function shop_private.parse_gs1_weight_barcode(p_value text) returns jsonb language plpgsql immutable set search_path='' as $$
declare raw text;value text;parts text[];gtin text;n integer;checksum integer:=0;weight numeric;begin
 if p_value is null or length(p_value)>80 then return null;end if;
 raw:=btrim(p_value,E' \t\r\n');value:=raw;
 if left(value,3)=']C1' then
  value:=substr(value,4);parts:=regexp_match(value,'^01([0-9]{14})310([0-5])([0-9]{6})$');
 else
  parts:=regexp_match(value,'^01([0-9]{14})310([0-5])([0-9]{6})$');
  if parts is null then parts:=regexp_match(value,'^\(01\)([0-9]{14})\(310([0-5])\)([0-9]{6})$');end if;
 end if;
 if parts is null then return null;end if;
 gtin:=parts[1];n:=parts[2]::integer;
 for i in 1..13 loop checksum:=checksum+substr(gtin,i,1)::integer*case when mod(i,2)=1 then 3 else 1 end;end loop;
 if left(gtin,1)<>'9' or right(gtin,1)::integer<>mod(10-mod(checksum,10),10) then raise exception 'INVALID_WEIGHT_BARCODE' using errcode='22023';end if;
 weight:=parts[3]::numeric/('1'||repeat('0',n))::numeric;
 if weight<=0 then raise exception 'INVALID_WEIGHT_BARCODE' using errcode='22023';end if;
 return jsonb_build_object('format','gs1-01-310n','raw',raw,'gtin',gtin,'netQuantity',trim_scale(weight)::text,'unitCode','kg');
end;$$;
revoke all on function shop_private.parse_gs1_weight_barcode(text) from public,anon,authenticated,service_role;

create function shop_private.resolve_weight_capture(p_shop uuid,p_product uuid,p_capture jsonb,p_base_quantity numeric) returns jsonb
language plpgsql stable set search_path='' as $$
declare p public.products%rowtype;parsed jsonb;expected numeric;capture_id uuid;begin
 if jsonb_typeof(p_capture) is distinct from 'object' or (p_capture-array['kind','id','raw'])<>'{}' or p_capture->>'kind' is distinct from 'gs1'
 or jsonb_typeof(p_capture->'id') is distinct from 'string' or jsonb_typeof(p_capture->'raw') is distinct from 'string' then raise exception 'INVALID_WEIGHT_CAPTURE' using errcode='22023';end if;
 capture_id:=(p_capture->>'id')::uuid;
 parsed:=shop_private.parse_gs1_weight_barcode(p_capture->>'raw');
 if capture_id is null or parsed is null then raise exception 'INVALID_WEIGHT_CAPTURE' using errcode='22023';end if;
 select * into p from public.products where id=p_product and shop_id=p_shop and is_active;
 if not found or p.measurement_status<>'active' or p.barcode is distinct from parsed->>'gtin'
 or not exists(select 1 from public.units_of_measure where code=p.base_unit_code and dimension='mass' and is_active) then raise exception 'WEIGHT_BARCODE_PRODUCT_UNAVAILABLE' using errcode='55000';end if;
 -- An existing literal barcode retains its ordinary meaning, even when its
 -- digits also resemble this GS1 subset. Archived identities stay reserved.
 if exists(select 1 from public.products where shop_id=p_shop and barcode=parsed->>'raw')
 or exists(select 1 from public.product_packagings where shop_id=p_shop and barcode=parsed->>'raw')
 or exists(select 1 from public.inventory_reels where shop_id=p_shop and barcode=parsed->>'raw') then raise exception 'FIXED_BARCODE_USE_NORMAL_SCAN' using errcode='55000';end if;
 expected:=shop_private.convert_measurement((parsed->>'netQuantity')::numeric,'kg',p.base_unit_code,p.quantity_increment);
 perform shop_private.assert_measured_quantity(p_shop,p_product,expected);
 if p_base_quantity is distinct from expected then raise exception 'WEIGHT_CAPTURE_QUANTITY_CHANGED' using errcode='55000';end if;
 return parsed||jsonb_build_object('id',capture_id,'kind','gs1','baseQuantity',trim_scale(expected)::text,'baseUnitCode',p.base_unit_code,'productRevision',p.measurement_revision);
end;$$;
revoke all on function shop_private.resolve_weight_capture(uuid,uuid,jsonb,numeric) from public,anon,authenticated,service_role;

create function public.resolve_weight_barcode(p_shop_id uuid,p_location_id uuid,p_barcode text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare original jsonb;parsed jsonb;catalog jsonb;item jsonb;p public.products%rowtype;quantity numeric;begin
 -- The existing POS reader owns tenant/location, role and catalog authority.
 original:=public.pos_catalog_search(p_shop_id=>p_shop_id,p_location_id=>p_location_id,p_barcode=>p_barcode,p_page=>1,p_page_size=>2);
 if coalesce((original->>'ambiguousBarcode')::boolean,false) or jsonb_array_length(original->'items')<>0 then raise exception 'FIXED_BARCODE_USE_NORMAL_SCAN' using errcode='55000';end if;
 parsed:=shop_private.parse_gs1_weight_barcode(p_barcode);
 if parsed is null then raise exception 'UNSUPPORTED_WEIGHT_BARCODE_FORMAT' using errcode='22023';end if;
 select * into p from public.products where shop_id=p_shop_id and barcode=parsed->>'gtin' and is_active;
 if not found or p.measurement_status<>'active' or not exists(select 1 from public.units_of_measure where code=p.base_unit_code and dimension='mass' and is_active) then raise exception 'WEIGHT_BARCODE_PRODUCT_UNAVAILABLE' using errcode='55000';end if;
 catalog:=public.pos_catalog_search(p_shop_id=>p_shop_id,p_location_id=>p_location_id,p_barcode=>p.barcode,p_page=>1,p_page_size=>2);
 if coalesce((catalog->>'ambiguousBarcode')::boolean,false) or jsonb_array_length(catalog->'items')<>1 or catalog#>>'{items,0,id}'<>p.id::text then raise exception 'WEIGHT_BARCODE_PRODUCT_UNAVAILABLE' using errcode='55000';end if;
 item:=catalog#>'{items,0}';quantity:=shop_private.convert_measurement((parsed->>'netQuantity')::numeric,'kg',p.base_unit_code,p.quantity_increment);
 perform shop_private.resolve_weight_capture(p_shop_id,p.id,jsonb_build_object('kind','gs1','id','00000000-0000-4000-8000-000000000000','raw',parsed->>'raw'),quantity);
 return jsonb_build_object('item',item,'quantity',trim_scale(quantity)::text,'availableQuantity',trim_scale(coalesce((item->>'stock')::numeric,0))::text,'unitCode',p.base_unit_code,'raw',parsed->>'raw','gtin',parsed->>'gtin','netQuantity',parsed->>'netQuantity','weightUnitCode','kg');
end;$$;
revoke all on function public.resolve_weight_barcode(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.resolve_weight_barcode(uuid,uuid,text) to authenticated;

-- Reviewed additive capture validation around the unchanged unit/reel kernel.
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.resolve_measured_line(uuid,uuid,jsonb,boolean)'::regprocedure) is distinct from '4d878690616d9a545db3a10fa9fe8ba2' then raise exception 'WEIGHT_CAPTURE_ROUTINE_REVIEW_REQUIRED' using errcode='55000';end if;end;$$;
create or replace function shop_private.resolve_measured_line(p_shop uuid,p_product uuid,p_line jsonb,p_purchase boolean default false) returns jsonb
language plpgsql stable set search_path='' as $capture$
declare result jsonb;measurement jsonb;loss_text text:=coalesce(p_line->>'cutting_loss','0');loss numeric;split boolean;reel public.inventory_reels%rowtype;
 entered_price numeric;factor numeric;fixed_package boolean;begin
 result:=shop_private.resolve_measured_line_before_reels(p_shop,p_product,p_line,p_purchase);
 if p_line ? 'measurement_capture' then
  if p_purchase or result->'measurement' is null or result->'measurement'='null'::jsonb then raise exception 'WEIGHT_CAPTURE_NOT_ALLOWED' using errcode='22023';end if;
  measurement:=result->'measurement';
  measurement:=measurement||jsonb_build_object('capture',shop_private.resolve_weight_capture(p_shop,p_product,p_line->'measurement_capture',(result->>'baseQuantity')::numeric));
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
revoke all on function shop_private.resolve_measured_line(uuid,uuid,jsonb,boolean) from public,anon,authenticated,service_role;

-- Ordinary issuance reconstructs inputs from the saved measurement. Preserve
-- the capture so the existing locked repricing path verifies it again.
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.reprice_measured_invoice_line(uuid)'::regprocedure) is distinct from '4e2f2ecb69606ad47daa55dc4b4899f8' then raise exception 'WEIGHT_REPRICE_ROUTINE_REVIEW_REQUIRED' using errcode='55000';end if;end;$$;
create or replace function shop_private.reprice_measured_invoice_line(p_line_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $capture$declare p_line public.invoice_items%rowtype;m jsonb;r jsonb;customer uuid;input jsonb;frozen jsonb;begin
 select * into strict p_line from public.invoice_items where id=p_line_id;
 m:=p_line.measurement_snapshot;
 select client_id into customer from public.invoices where id=p_line.invoice_id and shop_id=p_line.shop_id;
 if m is null or m='null'::jsonb then
  input:=jsonb_build_object('quantity',trim_scale(p_line.quantity)::text);
 else
  input:=jsonb_strip_nulls(jsonb_build_object('quantity',m->>'enteredQuantity','unit_code',m->>'enteredUnitCode',
   'reel_id',m->'reelId','allow_split',m->'allowSplit','cutting_loss',m->'cuttingLoss','measurement_revision',m->'productRevision','package_id',m->'packageId','package_version',m->'packageVersion'));
 end if;
 if m ? 'capture' then input:=input||jsonb_build_object('measurement_capture',jsonb_build_object('kind',m#>>'{capture,kind}','id',m#>>'{capture,id}','raw',m#>>'{capture,raw}'));end if;
 r:=shop_private.resolve_measured_line(p_line.shop_id,p_line.product_id,input);
 if (r->>'baseQuantity')::numeric<>p_line.quantity then raise exception 'MEASUREMENT_CONTEXT_CHANGED' using errcode='55000';end if;
 frozen:=p_line.trade_pricing_snapshot;
 if frozen->>'source'='staff_override' then
  if frozen->>'currency' is distinct from (select business_currency from public.shops where id=p_line.shop_id) then raise exception 'PRICE_APPROVAL_CONTEXT_CHANGED' using errcode='55000';end if;
  -- The original manager approval is server-written draft history. Issuing
  -- staff need not reacquire product-management authority to honor that approval.
  if frozen->>'actorProfileId' is null or frozen->>'reason' is null then raise exception 'INVALID_PRICE_APPROVAL' using errcode='23514';end if;
  m:=r->'measurement';
  if m is not null and m<>'null'::jsonb then m:=m||jsonb_build_object('tradePricing',frozen,'baseUnitPrice',trim_scale(p_line.unit_price)::text,
   'enteredUnitPrice',trim_scale(p_line.unit_price*p_line.quantity/(m->>'enteredQuantity')::numeric)::text);end if;
  return r||jsonb_build_object('baseUnitPrice',p_line.unit_price,'lineTotal',round(p_line.quantity*p_line.unit_price,2),'measurement',m,'pricing',frozen);
 end if;
 return shop_private.apply_trade_price(p_line.shop_id,p_line.product_id,customer,input,r,(select sum(quantity) from public.invoice_items where invoice_id=p_line.invoice_id and product_id=p_line.product_id));
end;$capture$;
revoke all on function shop_private.reprice_measured_invoice_line(uuid) from public,anon,authenticated,service_role;
commit;
