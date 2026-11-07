do $$begin
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.save_sale_draft(uuid,uuid,uuid,uuid,text,jsonb)'::regprocedure) is distinct from '0a47a1a9085e620adf296cc00f872464' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.save_sale_draft' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.issue_sale(uuid,uuid,uuid)'::regprocedure) is distinct from 'beb8c2c77afc09fbdaa42a34bb532c96' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.issue_sale' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.checkout_customerless_sale(uuid,uuid,uuid,numeric,timestamp with time zone,public.payment_method,text)'::regprocedure) is distinct from 'f22fd931dac91a828caf2ff6151a2d11' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.checkout_customerless_sale' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.create_supplier_purchase(uuid,uuid,uuid,text,date,text,jsonb)'::regprocedure) is distinct from '4904a3cf0c614fe2964b24333eabfed5' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.create_supplier_purchase' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.calculate_tax(jsonb,jsonb,numeric)'::regprocedure) is distinct from '65452fb5ea5beff4b9a5e597103c4e14' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.calculate_tax' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.tax_return_components(jsonb,numeric,numeric)'::regprocedure) is distinct from '27fd6553a657074e4b7b81b037b8492d' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.tax_return_components' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.adjust_stock(uuid,uuid,uuid,numeric,numeric,text)'::regprocedure) is distinct from '9aa7c096337fd7be5f16f0f3894f0815' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.adjust_stock' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.record_stock_count(uuid,uuid,uuid,numeric,timestamp with time zone,text,text,numeric)'::regprocedure) is distinct from 'bf1a5cf716acfa83258db093b660ba51' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.record_stock_count' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.set_reorder_threshold(uuid,uuid,numeric)'::regprocedure) is distinct from '92dc2049e864d1dabcf24022368ff7a5' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.set_reorder_threshold' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.return_plan(uuid,uuid,uuid,jsonb)'::regprocedure) is distinct from '403aa7054681f6cff5a67a21e5ecfa59' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.return_plan' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.create_sale_return(uuid,uuid,uuid,uuid,jsonb,text,jsonb)'::regprocedure) is distinct from '84f322acdff486891565a7b6586d656a' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: public.create_sale_return' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.sale_return_context(uuid,uuid,uuid,integer)'::regprocedure) is distinct from '32f6dae4c86368f39ee684936205ed65' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: public.sale_return_context' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.record_purchase_return(uuid,uuid,uuid,timestamp with time zone,text,text,jsonb)'::regprocedure) is distinct from '5594a1fba3e7e1fa14e51b1d76ceb4e8' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.record_purchase_return' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.capture_sale_receipt_at_issue()'::regprocedure) is distinct from '88ae0f0c2e43ba4cf04823e526653322' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.capture_sale_receipt_at_issue' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.capture_return_source()'::regprocedure) is distinct from '0efebad0b2cca360e9fdcf80fa1c9088' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.capture_return_source' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.capture_tax_at_issue()'::regprocedure) is distinct from '3e44710aff8d682e009535275c26c0cc' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.capture_tax_at_issue' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.list_products(uuid,text,uuid,integer,integer)'::regprocedure) is distinct from 'd9d5600137b606941f329e953a0bef3b' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.list_products' using errcode='55000';end if;
 if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.pos_catalog_search(uuid,uuid,text,text,text,uuid,integer,integer)'::regprocedure) is distinct from '39c8c957dd1f2da86116b35162275a00' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.pos_catalog_search' using errcode='55000';end if;
end;$$;


-- SS-ELEC-102/104/105/201-211. Operational measured product contracts.
begin;
alter table public.products drop constraint products_measurement_status_check,
 add constraint products_measurement_status_check check(measurement_status in('legacy','prepared','active')),
 add column measurement_revision integer not null default 0 check(measurement_revision>=0),
 add column sale_unit_codes text[] not null default array['ea'];
alter table public.product_measurement_changes drop constraint product_measurement_changes_previous_measurement_status_check,
 add constraint product_measurement_changes_previous_measurement_status_check check(previous_measurement_status in('legacy','prepared','active'));
alter table public.invoice_items add column measurement_snapshot jsonb;
alter table public.vendor_invoice_items add column measurement_snapshot jsonb;
alter table public.invoice_items drop constraint invoice_items_supported_values_check,
 add constraint invoice_items_supported_values_check check(quantity>0 and quantity<=1000000 and round(quantity,6)=quantity
 and unit_price>=0 and discount_amount>=0 and total_amount>=0);

create table public.product_packagings(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,product_id uuid not null,
 code text not null check(length(btrim(code)) between 1 and 80),name text not null check(length(btrim(name)) between 1 and 160),
 unit_code text not null references public.units_of_measure(code),base_quantity numeric(18,6) not null check(base_quantity>0 and base_quantity<=1000000),
 contained_quantity numeric(18,6) not null check(contained_quantity>0),contained_unit_code text not null references public.units_of_measure(code),
 barcode text check(length(barcode) between 1 and 80),sale_price numeric(18,6) check(sale_price>=0 and sale_price<=999999999.99),
 can_purchase boolean not null,can_sell boolean not null,default_purchase boolean not null default false,default_sale boolean not null default false,
 active boolean not null default true,version integer not null check(version>0),supersedes_id uuid references public.product_packagings(id),
 actor_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 foreign key(product_id,shop_id) references public.products(id,shop_id),unique(product_id,code,version),
 check(can_purchase or can_sell),check(not default_purchase or can_purchase),check(not default_sale or can_sell)
);
create unique index product_packagings_active_code on public.product_packagings(shop_id,product_id,code) where active;
create unique index product_packagings_active_barcode on public.product_packagings(shop_id,barcode) where active and barcode is not null;
create unique index product_packagings_default_purchase on public.product_packagings(product_id) where active and default_purchase;
create unique index product_packagings_default_sale on public.product_packagings(product_id) where active and default_sale;
create index product_packagings_product on public.product_packagings(shop_id,product_id,active);
alter table public.product_packagings enable row level security;
revoke all on public.product_packagings from public,anon,authenticated,service_role;
grant select on public.product_packagings to authenticated,service_role;
create policy product_packagings_read on public.product_packagings for select to authenticated using(shop_private.has_permission(shop_id,'products.view'));
create policy product_packagings_service_read on public.product_packagings for select to service_role using(true);
create table shop_private.packaging_requests(shop_id uuid not null,request_id uuid not null,payload jsonb not null,package_id uuid not null,
 actor_profile_id uuid not null references public.profiles(id),primary key(shop_id,request_id));
alter table shop_private.packaging_requests enable row level security;
revoke all on shop_private.packaging_requests from public,anon,authenticated,service_role;

create function shop_private.quantity_scale(p_shop uuid,p_product uuid,p_legacy integer) returns integer
language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.products where id=p_product and shop_id=p_shop and measurement_status='active') then 6 else p_legacy end;
$$;
revoke all on function shop_private.quantity_scale(uuid,uuid,integer) from public,anon,authenticated,service_role;
create function shop_private.assert_measured_quantity(p_shop uuid,p_product uuid,p_quantity numeric,p_zero boolean default false) returns void
language plpgsql stable security definer set search_path='' as $$declare p public.products%rowtype;begin
 select * into p from public.products where id=p_product and shop_id=p_shop;
 if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
 if p_quantity is null or p_quantity::text in('NaN','Infinity','-Infinity') or abs(p_quantity)>1000000 or round(p_quantity,6)<>p_quantity or (not p_zero and p_quantity=0) then
 raise exception 'INVALID_MEASUREMENT_QUANTITY' using errcode='22023';end if;
 if p.measurement_status='prepared' then raise exception 'MEASUREMENT_WORKFLOW_NOT_READY' using errcode='55000';end if;
 if p.measurement_status='active' and p_quantity<>0 then perform shop_private.convert_measurement(abs(p_quantity),p.base_unit_code,p.base_unit_code,p.quantity_increment);end if;
end;$$;
revoke all on function shop_private.assert_measured_quantity(uuid,uuid,numeric,boolean) from public,anon,authenticated,service_role;

create function shop_private.configure_product_measurement(p_shop_id uuid,p_product_id uuid,p_unit text,p_increment text,p_sale_units jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.products%rowtype;unit public.units_of_measure%rowtype;codes text[];q numeric;begin
 perform shop_private.assert_shop_write_access(p_shop_id,'products.manage');
 select * into p from public.products where id=p_product_id and shop_id=p_shop_id and is_active for update;
 if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
 select * into unit from public.units_of_measure where code=p_unit and dimension<>'package' and is_active;
 if not found or p_increment is null or p_increment !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' then raise exception 'INVALID_PRODUCT_MEASUREMENT' using errcode='22023';end if;
 q:=p_increment::numeric;perform shop_private.convert_measurement(q,p_unit,p_unit,q);
 if p_sale_units is null then p_sale_units:=jsonb_build_array(p_unit);end if;
 if jsonb_typeof(p_sale_units) is distinct from 'array' or jsonb_array_length(p_sale_units) not between 1 and 23 then raise exception 'INVALID_SALE_UNITS' using errcode='22023';end if;
 select array_agg(value order by value) into codes from jsonb_array_elements_text(p_sale_units) value;
 if not(p_unit=any(codes)) or cardinality(codes)<>(select count(distinct x) from unnest(codes)x)
 or exists(select 1 from unnest(codes)c left join public.units_of_measure u on u.code=c and u.is_active and u.dimension=unit.dimension where u.code is null) then raise exception 'INVALID_SALE_UNITS' using errcode='22023';end if;
 if p.measurement_status='active' and p.base_unit_code=p_unit and p.quantity_increment=q and p.sale_unit_codes=codes then
 return jsonb_build_object('status','active','baseUnitCode',p_unit,'quantityIncrement',trim_scale(q)::text,'revision',p.measurement_revision,'saleUnits',codes);end if;
 if exists(select 1 from public.product_packagings where product_id=p.id) then raise exception 'MEASUREMENT_REQUIRES_UNUSED_PRODUCT' using errcode='55000';end if;
 perform public.prepare_product_measurement(p_shop_id,p_product_id,p_unit,p_increment,p_reason);
 update public.products set measurement_status='active',measurement_revision=measurement_revision+1,sale_unit_codes=codes where id=p.id and shop_id=p_shop_id returning * into p;
 return jsonb_build_object('status','active','baseUnitCode',p_unit,'quantityIncrement',trim_scale(q)::text,'revision',p.measurement_revision,'saleUnits',codes);
end;$$;
revoke all on function shop_private.configure_product_measurement(uuid,uuid,text,text,jsonb,text) from public,anon,authenticated,service_role;
create function public.configure_product_measurement(p_shop_id uuid,p_product_id uuid,p_unit text,p_increment text,p_sale_units jsonb,p_reason text)
returns jsonb language sql security definer set search_path='' as $$ select shop_private.configure_product_measurement(p_shop_id,p_product_id,p_unit,p_increment,p_sale_units,p_reason);$$;
revoke all on function public.configure_product_measurement(uuid,uuid,text,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.configure_product_measurement(uuid,uuid,text,text,jsonb,text) to authenticated;

create function shop_private.packaging_immutable() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or (to_jsonb(new)-'active') is distinct from (to_jsonb(old)-'active') or new.active or not old.active then
 raise exception 'MEASUREMENT_HISTORY_IMMUTABLE' using errcode='55000';end if;
 return new;
end;$$;
revoke all on function shop_private.packaging_immutable() from public,anon,authenticated,service_role;
create trigger packaging_immutable before update or delete on public.product_packagings for each row execute function shop_private.packaging_immutable();
create function shop_private.measurement_barcode_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.barcode is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('shop-barcode:'||new.shop_id::text,0));
 if tg_table_name='products' then
 if new.is_active and exists(select 1 from public.product_packagings where shop_id=new.shop_id and barcode=new.barcode and active) then raise exception 'BARCODE_IDENTITY_CONFLICT' using errcode='23505';end if;
 else
 if new.active and exists(select 1 from public.products where shop_id=new.shop_id and barcode=new.barcode and is_active) then raise exception 'BARCODE_IDENTITY_CONFLICT' using errcode='23505';end if;
 end if;
 return new;
end;$$;
revoke all on function shop_private.measurement_barcode_guard() from public,anon,authenticated,service_role;
create trigger measurement_barcode_guard before insert or update of barcode,is_active on public.products for each row execute function shop_private.measurement_barcode_guard();
create trigger measurement_barcode_guard before insert or update of barcode,active on public.product_packagings for each row execute function shop_private.measurement_barcode_guard();

create function public.save_product_packaging(p_request_id uuid,p_shop_id uuid,p_product_id uuid,p_package_id uuid,p_definition jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;p public.products%rowtype;old public.product_packagings%rowtype;previous shop_private.packaging_requests%rowtype;
 result uuid:=gen_random_uuid();base numeric;entered numeric;version_no integer;payload jsonb;begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'products.manage');
 if p_request_id is null or jsonb_typeof(p_definition) is distinct from 'object' then raise exception 'INVALID_PRODUCT_PACKAGING' using errcode='22023';end if;
 perform 1 from public.shops where id=p_shop_id for update;
 payload:=jsonb_build_array(p_product_id,p_package_id,p_definition);
 select * into previous from shop_private.packaging_requests where shop_id=p_shop_id and request_id=p_request_id;
 if found then if previous.payload<>payload or previous.actor_profile_id<>actor then raise exception 'PACKAGING_REQUEST_CONFLICT' using errcode='23505';end if;return previous.package_id;end if;
 select * into p from public.products where id=p_product_id and shop_id=p_shop_id and is_active for update;
 if not found or p.measurement_status<>'active' then raise exception 'ACTIVE_MEASURED_PRODUCT_REQUIRED' using errcode='55000';end if;
 if p_package_id is not null then
 select * into old from public.product_packagings where id=p_package_id and product_id=p.id and shop_id=p_shop_id and active for update;
 if not found then raise exception 'PACKAGE_NOT_AVAILABLE' using errcode='P0002';end if;
 if p_definition='{"archive":true}'::jsonb then update public.product_packagings set active=false where id=old.id;
 insert into shop_private.packaging_requests values(p_shop_id,p_request_id,payload,old.id,actor);return old.id;end if;
 end if;
 if (p_definition-array['code','name','unitCode','containedQuantity','containedUnitCode','barcode','salePrice','canPurchase','canSell','defaultPurchase','defaultSale'])<>'{}'::jsonb
 or not(p_definition ?& array['code','name','unitCode','containedQuantity','containedUnitCode','canPurchase','canSell'])
 or p_definition->>'containedQuantity' !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$'
 or jsonb_typeof(p_definition->'canPurchase') is distinct from 'boolean' or jsonb_typeof(p_definition->'canSell') is distinct from 'boolean'
 or not exists(select 1 from public.units_of_measure where code=p_definition->>'unitCode' and dimension='package') then raise exception 'INVALID_PRODUCT_PACKAGING' using errcode='22023';end if;
 entered:=(p_definition->>'containedQuantity')::numeric;
 base:=shop_private.convert_measurement(entered,p_definition->>'containedUnitCode',p.base_unit_code,p.quantity_increment);
 if base>1000000 then raise exception 'INVALID_PRODUCT_PACKAGING' using errcode='22023';end if;
 if old.id is not null then update public.product_packagings set active=false where id=old.id;end if;
 select coalesce(max(version),0)+1 into version_no from public.product_packagings where product_id=p.id and code=btrim(p_definition->>'code');
 insert into public.product_packagings(id,shop_id,product_id,code,name,unit_code,base_quantity,contained_quantity,contained_unit_code,barcode,sale_price,can_purchase,can_sell,default_purchase,default_sale,version,supersedes_id,actor_profile_id)
 values(result,p_shop_id,p.id,btrim(p_definition->>'code'),btrim(p_definition->>'name'),p_definition->>'unitCode',base,entered,p_definition->>'containedUnitCode',nullif(btrim(p_definition->>'barcode'),''),
 (p_definition->>'salePrice')::numeric,(p_definition->>'canPurchase')::boolean,(p_definition->>'canSell')::boolean,coalesce((p_definition->>'defaultPurchase')::boolean,false),coalesce((p_definition->>'defaultSale')::boolean,false),version_no,old.id,actor);
 insert into shop_private.packaging_requests values(p_shop_id,p_request_id,payload,result,actor);return result;
end;$$;
revoke all on function public.save_product_packaging(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_product_packaging(uuid,uuid,uuid,uuid,jsonb) to authenticated;

-- Private line resolver ignores client base quantities, factors, prices and totals.
create function shop_private.resolve_measured_line(p_shop uuid,p_product uuid,p_line jsonb,p_purchase boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.products%rowtype;package public.product_packagings%rowtype;entered numeric;base numeric;price numeric;entered_price numeric;unit text;factor numeric;begin
 select * into p from public.products where id=p_product and shop_id=p_shop and is_active;
 if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
 if p.measurement_status='prepared' then raise exception 'MEASUREMENT_WORKFLOW_NOT_READY' using errcode='55000';end if;
 if p_line->>'quantity' is null or p_line->>'quantity' !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' then raise exception 'INVALID_MEASUREMENT_QUANTITY' using errcode='22023';end if;
 entered:=(p_line->>'quantity')::numeric;
 if entered<=0 or entered>1000000 then raise exception 'INVALID_MEASUREMENT_QUANTITY' using errcode='22023';end if;
 if p.measurement_status='legacy' then
 if p_line ? 'unit_code' or p_line ? 'package_id' then raise exception 'PRODUCT_MEASUREMENT_NOT_CONFIGURED' using errcode='55000';end if;
 return jsonb_build_object('baseQuantity',trim_scale(entered)::text,'baseUnitPrice',p.sale_price,'measurement',null);end if;
 if p_line->>'measurement_revision' is distinct from p.measurement_revision::text then raise exception 'MEASUREMENT_CONTEXT_CHANGED' using errcode='55000';end if;
 if p_line->>'package_id' is not null then
 select * into package from public.product_packagings where id=(p_line->>'package_id')::uuid and product_id=p.id and shop_id=p_shop and active;
 if not found or (p_purchase and not package.can_purchase) or (not p_purchase and not package.can_sell)
 or p_line->>'package_version' is distinct from package.version::text then raise exception 'PACKAGE_CONTEXT_CHANGED' using errcode='55000';end if;
 if round(entered,0)<>entered then raise exception 'INVALID_MEASUREMENT_PRECISION' using errcode='22023';end if;
 unit:=package.unit_code;factor:=package.base_quantity;base:=entered*factor;
 perform shop_private.assert_measured_quantity(p_shop,p.id,base);
 else
 unit:=p_line->>'unit_code';
 if unit is null or (not p_purchase and not(unit=any(p.sale_unit_codes))) then raise exception 'MEASUREMENT_UNIT_NOT_ALLOWED' using errcode='22023';end if;
 base:=shop_private.convert_measurement(entered,unit,p.base_unit_code,p.quantity_increment);factor:=base/entered;
 end if;
 if base>1000000 then raise exception 'INVALID_MEASUREMENT_QUANTITY' using errcode='22023';end if;
 entered_price:=case when p_purchase then (p_line->>'unit_cost')::numeric when package.sale_price is not null then package.sale_price else p.sale_price*factor end;
 if entered_price is null or entered_price::text in('NaN','Infinity','-Infinity') or entered_price<0 or entered_price>999999999.99 or round(entered_price,case when p_purchase then 6 else 12 end)<>entered_price then raise exception 'INVALID_MEASUREMENT_PRICE' using errcode='22023';end if;
 price:=round(entered_price/factor,12);
 if round(price*base,5)<>round(entered_price*entered,5) then raise exception 'MEASUREMENT_PRICE_PRECISION' using errcode='22023';end if;
 return jsonb_build_object('baseQuantity',trim_scale(base)::text,'baseUnitPrice',price,'lineTotal',round(entered*entered_price,2),
 'measurement',jsonb_build_object('version',1,'baseUnitCode',p.base_unit_code,'baseQuantity',trim_scale(base)::text,'quantityIncrement',trim_scale(p.quantity_increment)::text,
 'enteredUnitCode',unit,'enteredQuantity',trim_scale(entered)::text,'enteredUnitPrice',trim_scale(entered_price)::text,'baseUnitPrice',trim_scale(price)::text,
 'productRevision',p.measurement_revision,'packageId',package.id,'packageVersion',package.version,'packageName',package.name,
 'unitNameEn',(select name_en from public.units_of_measure where code=unit),'unitNameAr',(select name_ar from public.units_of_measure where code=unit),
 'baseUnitNameEn',(select name_en from public.units_of_measure where code=p.base_unit_code),'baseUnitNameAr',(select name_ar from public.units_of_measure where code=p.base_unit_code)));
end;$$;
revoke all on function shop_private.resolve_measured_line(uuid,uuid,jsonb,boolean) from public,anon,authenticated,service_role;

create function shop_private.reprice_measured_invoice_line(p_line_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare p_line public.invoice_items%rowtype;m jsonb;r jsonb;begin
 select * into strict p_line from public.invoice_items where id=p_line_id;
 m:=p_line.measurement_snapshot;
 if m is null or m='null'::jsonb then return null;end if;
 r:=shop_private.resolve_measured_line(p_line.shop_id,p_line.product_id,jsonb_strip_nulls(jsonb_build_object('quantity',m->>'enteredQuantity','unit_code',m->>'enteredUnitCode',
 'measurement_revision',m->'productRevision','package_id',m->'packageId','package_version',m->'packageVersion')));
 if (r->>'baseQuantity')::numeric<>p_line.quantity then raise exception 'MEASUREMENT_CONTEXT_CHANGED' using errcode='55000';end if;
 return r;
end;$$;
revoke all on function shop_private.reprice_measured_invoice_line(uuid) from public,anon,authenticated,service_role;


-- Extend the reviewed current shop_private.save_sale_draft; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION shop_private.save_sale_draft(p_request_id uuid, p_shop_id uuid, p_invoice_id uuid, p_customer_id uuid, p_notes text, p_lines jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_profile_id uuid;
  v_invoice_id uuid;
  v_request public.sale_requests%rowtype;
  v_payload_hash text;
  v_mode public.business_mode;
  v_customer_name text;
  v_line record;
  v_product public.products%rowtype;
  v_service public.services%rowtype;
  v_quantity numeric;
  v_unit_discount numeric;
  v_discount numeric;
  v_total numeric;
  v_measurement jsonb;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'sales.manage');
  if p_request_id is null or p_lines is null or jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 100
    or (p_notes is not null and length(btrim(p_notes)) > 2000) then
    raise exception 'INVALID_SALE_DRAFT' using errcode = '22023';
  end if;

  v_payload_hash := md5(jsonb_build_object(
    'invoiceId', p_invoice_id, 'customerId', p_customer_id,
    'notes', nullif(btrim(p_notes), ''), 'lines', p_lines
  )::text);
  insert into public.sale_requests (
    shop_id, operation, request_id, actor_profile_id, payload_hash
  ) values (
    p_shop_id, 'save_draft', p_request_id, v_profile_id, v_payload_hash
  ) on conflict do nothing;
  select * into v_request from public.sale_requests
  where shop_id = p_shop_id and operation = 'save_draft'
    and request_id = p_request_id
  for update;
  if v_request.actor_profile_id <> v_profile_id
    or v_request.payload_hash <> v_payload_hash then
    raise exception 'SALE_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if v_request.invoice_id is not null then
    return v_request.invoice_id;
  end if;

  select business_mode into v_mode from public.shops where id = p_shop_id for update;
  if p_customer_id is not null then
    select name into v_customer_name from public.clients
    where id = p_customer_id and shop_id = p_shop_id and is_active;
    if v_customer_name is null then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  end if;

  if p_invoice_id is null then
    insert into public.invoices (
      shop_id, created_by_profile_id, invoice_number, status, total_amount,
      discount_amount, notes, client_id, client_name_snapshot
    ) values (
      p_shop_id, v_profile_id, null, 'draft', 0, 0,
      nullif(btrim(p_notes), ''), p_customer_id, v_customer_name
    ) returning id into v_invoice_id;
  else
    select id into v_invoice_id from public.invoices
    where id = p_invoice_id and shop_id = p_shop_id and status = 'draft'
    for update;
    if v_invoice_id is null then raise exception 'SALE_DRAFT_NOT_FOUND'; end if;
    update public.invoices set
      client_id = p_customer_id, client_name_snapshot = v_customer_name,
      notes = nullif(btrim(p_notes), ''), updated_at = now()
    where id = v_invoice_id;
    delete from public.invoice_items where invoice_id = v_invoice_id;
  end if;

  for v_line in
    select value as body, ordinality::integer as line_order
    from jsonb_array_elements(p_lines) with ordinality
  loop
    begin
      v_quantity := (v_line.body ->> 'quantity')::numeric;
    exception when others then
      raise exception 'INVALID_SALE_LINE' using errcode = '22023';
    end;
    if v_quantity is null or v_quantity <= 0 or v_quantity > 1000000
      or round(v_quantity,case when v_line.body->>'item_type'='product' then shop_private.quantity_scale(p_shop_id,(v_line.body->>'source_id')::uuid,3) else 3 end) <> v_quantity then
      raise exception 'INVALID_SALE_LINE' using errcode = '22023';
    end if;

    if v_line.body ->> 'item_type' = 'product' then
      if v_mode not in ('product', 'mixed') then
        raise exception 'BUSINESS_MODE_PRODUCT_DISABLED' using errcode = '23514';
      end if;
      select * into v_product from public.products
      where id = (v_line.body ->> 'source_id')::uuid
        and shop_id = p_shop_id and is_active;
      if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
      v_discount := 0;
      v_measurement:=shop_private.resolve_measured_line(p_shop_id,v_product.id,v_line.body);
      v_quantity:=(v_measurement->>'baseQuantity')::numeric;
      v_total := coalesce((v_measurement->>'lineTotal')::numeric,round(v_product.sale_price*v_quantity,2));
      insert into public.invoice_items (
        invoice_id, shop_id, line_order, item_type, item_name, quantity,
        unit_price, discount_amount, total_amount, product_id, measurement_snapshot,
        product_sku_snapshot, product_barcode_snapshot,
        discount_type_snapshot, discount_value_snapshot
      ) values (
        v_invoice_id, p_shop_id, v_line.line_order, 'product', v_product.name,
        v_quantity, (v_measurement->>'baseUnitPrice')::numeric, 0, v_total, v_product.id, nullif(v_measurement->'measurement','null'::jsonb),
        v_product.sku, v_product.barcode, null, 0
      );
    elsif v_line.body ->> 'item_type' = 'service' then
      if v_mode not in ('service', 'mixed') then
        raise exception 'BUSINESS_MODE_SERVICE_DISABLED' using errcode = '23514';
      end if;
      select * into v_service from public.services
      where id = (v_line.body ->> 'source_id')::uuid
        and shop_id = p_shop_id and is_active;
      if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
      v_unit_discount := case v_service.default_discount_type
        when 'percent' then round(v_service.base_sale_price * v_service.default_discount_value / 100, 2)
        else v_service.default_discount_value end;
      v_discount := round(v_unit_discount * v_quantity, 2);
      v_total := round(v_service.base_sale_price * v_quantity - v_discount, 2);
      insert into public.invoice_items (
        invoice_id, shop_id, line_order, item_type, item_name, quantity,
        unit_price, discount_amount, total_amount, service_id,
        discount_type_snapshot, discount_value_snapshot
      ) values (
        v_invoice_id, p_shop_id, v_line.line_order, 'service', v_service.name,
        v_quantity, v_service.base_sale_price, v_discount, v_total, v_service.id,
        v_service.default_discount_type, v_service.default_discount_value
      );
    else
      raise exception 'UNSUPPORTED_SALE_LINE_TYPE' using errcode = '22023';
    end if;
  end loop;

  update public.invoices invoice set
    total_amount = totals.total_amount,
    discount_amount = totals.discount_amount,
    updated_at = now()
  from (
    select coalesce(sum(total_amount), 0) as total_amount,
      coalesce(sum(discount_amount), 0) as discount_amount
    from public.invoice_items where invoice_id = v_invoice_id
  ) totals where invoice.id = v_invoice_id;
  update public.sale_requests set invoice_id = v_invoice_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'save_draft'
    and request_id = p_request_id;
  return v_invoice_id;
exception
  when invalid_text_representation then
    raise exception 'INVALID_SALE_LINE' using errcode = '22023';
end;
$$;

-- Extend the reviewed current shop_private.issue_sale; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION shop_private.issue_sale(p_request_id uuid, p_shop_id uuid, p_invoice_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_profile_id uuid;
  v_request public.sale_requests%rowtype;
  v_invoice public.invoices%rowtype;
  v_product public.products%rowtype;
  v_service public.services%rowtype;
  v_line record;
  v_batch record;
  v_remaining numeric;
  v_take numeric;
  v_unit_discount numeric;
  v_discount numeric;
  v_total numeric;
  v_measurement jsonb;
  v_number bigint;
  v_issued_at timestamptz := clock_timestamp();
  v_payload_hash text := md5(coalesce(p_invoice_id::text, ''));
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'sales.issue');
  if p_request_id is null or p_invoice_id is null then
    raise exception 'INVALID_SALE_ISSUE' using errcode = '22023';
  end if;

  insert into public.sale_requests (
    shop_id, operation, request_id, actor_profile_id, payload_hash
  ) values (
    p_shop_id, 'issue', p_request_id, v_profile_id, v_payload_hash
  ) on conflict do nothing;
  select * into v_request from public.sale_requests
  where shop_id = p_shop_id and operation = 'issue' and request_id = p_request_id
  for update;
  if v_request.actor_profile_id <> v_profile_id
    or v_request.payload_hash <> v_payload_hash then
    raise exception 'SALE_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if v_request.invoice_id is not null then return v_request.invoice_id; end if;

  select * into v_invoice from public.invoices
  where id = p_invoice_id and shop_id = p_shop_id for update;
  if not found then raise exception 'SALE_DRAFT_NOT_FOUND'; end if;
  if v_invoice.status <> 'draft'::public.invoice_status then
    raise exception 'SALE_NOT_DRAFT' using errcode = '23514';
  end if;
  if v_invoice.client_id is null then
    raise exception 'OUTSTANDING_SALE_REQUIRES_CUSTOMER' using errcode = '23514';
  end if;
  if not exists (select 1 from public.invoice_items where invoice_id = p_invoice_id) then
    raise exception 'SALE_REQUIRES_LINES' using errcode = '23514';
  end if;

  -- Product rows are the serialization point shared by supported stock writes.
  -- The stable ordering prevents opposite-order multi-product deadlocks.
  perform product.id
  from public.products product
  join (
    select distinct item.product_id
    from public.invoice_items item
    where item.invoice_id = p_invoice_id and item.item_type = 'product'
  ) requested on requested.product_id = product.id
  order by product.id
  for update of product;

  perform service.id
  from public.services service
  join (
    select distinct item.service_id
    from public.invoice_items item
    where item.invoice_id = p_invoice_id and item.item_type = 'service'
  ) requested on requested.service_id = service.id
  order by service.id
  for update of service;

  update public.invoices invoice set
    client_name_snapshot = client.name,
    client_phone_snapshot = client.phone,
    client_email_snapshot = client.email,
    client_address_snapshot = client.address
  from public.clients client
  where invoice.id = p_invoice_id and client.id = invoice.client_id
    and client.shop_id = p_shop_id and client.is_active;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;

  -- Re-price every line from the locked active catalog. Draft values are only
  -- a preview and cannot become authoritative through browser input.
  for v_line in
    select * from public.invoice_items
    where invoice_id = p_invoice_id order by line_order, id
  loop
    if v_line.item_type = 'product'::public.invoice_item_type then
      select * into v_product from public.products
      where id = v_line.product_id and shop_id = p_shop_id and is_active;
      if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
      v_discount := 0;
      v_measurement:=shop_private.reprice_measured_invoice_line(v_line.id);
      v_total:=coalesce((v_measurement->>'lineTotal')::numeric,round(v_product.sale_price*v_line.quantity,2));
      update public.invoice_items set
        item_name = v_product.name, unit_price = coalesce((v_measurement->>'baseUnitPrice')::numeric,v_product.sale_price), measurement_snapshot=case when v_measurement is null then null else v_measurement->'measurement' end,
        discount_amount = 0, total_amount = v_total,
        product_sku_snapshot = v_product.sku,
        product_barcode_snapshot = v_product.barcode,
        discount_type_snapshot = null, discount_value_snapshot = 0
      where id = v_line.id;
    elsif v_line.item_type = 'service'::public.invoice_item_type then
      select * into v_service from public.services
      where id = v_line.service_id and shop_id = p_shop_id and is_active;
      if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
      v_unit_discount := case v_service.default_discount_type
        when 'percent' then round(v_service.base_sale_price * v_service.default_discount_value / 100, 2)
        else v_service.default_discount_value end;
      v_discount := round(v_unit_discount * v_line.quantity, 2);
      v_total := round(v_service.base_sale_price * v_line.quantity - v_discount, 2);
      update public.invoice_items set
        item_name = v_service.name, unit_price = v_service.base_sale_price,
        discount_amount = v_discount, total_amount = v_total,
        discount_type_snapshot = v_service.default_discount_type,
        discount_value_snapshot = v_service.default_discount_value
      where id = v_line.id;
    else
      raise exception 'UNSUPPORTED_SALE_LINE_TYPE' using errcode = '22023';
    end if;
  end loop;

  -- Aggregate before mutation so duplicate product lines cannot evade the
  -- available-stock check.
  if exists (
    select requested.product_id
    from (
      select product_id, sum(quantity) as quantity
      from public.invoice_items
      where invoice_id = p_invoice_id and item_type = 'product'
      group by product_id
    ) requested
    left join public.inventory_batches batch
      on batch.shop_id = p_shop_id and batch.product_id = requested.product_id
    group by requested.product_id, requested.quantity
    having coalesce(sum(batch.remaining_quantity), 0) < requested.quantity
  ) then
    raise exception 'INSUFFICIENT_STOCK' using errcode = '23514';
  end if;

  perform shop_private.assert_period_is_open(p_shop_id, v_issued_at);
  insert into public.sale_number_counters (shop_id, next_number)
  values (p_shop_id, 2)
  on conflict (shop_id) do update set
    next_number = public.sale_number_counters.next_number + 1,
    updated_at = now()
  returning next_number - 1 into v_number;

  update public.invoices invoice set
    invoice_number = 'SALE-' || lpad(v_number::text, 6, '0'),
    total_amount = totals.total_amount,
    discount_amount = totals.discount_amount,
    status = 'issued',
    issued_at = v_issued_at,
    issued_by_profile_id = v_profile_id,
    updated_at = v_issued_at
  from (
    select sum(total_amount) as total_amount, sum(discount_amount) as discount_amount
    from public.invoice_items where invoice_id = p_invoice_id
  ) totals where invoice.id = p_invoice_id;

  for v_line in
    select item.id, item.product_id, item.quantity
    from public.invoice_items item
    where item.invoice_id = p_invoice_id and item.item_type = 'product'
    order by item.product_id, item.line_order, item.id
  loop
    v_remaining := v_line.quantity;
    for v_batch in
      select batch.id, batch.remaining_quantity, batch.unit_cost
      from public.inventory_batches batch
      where batch.shop_id = p_shop_id and batch.product_id = v_line.product_id
        and batch.remaining_quantity > 0
      order by batch.received_at, batch.id
      for update
    loop
      v_take := least(v_remaining, v_batch.remaining_quantity);
      update public.inventory_batches set
        remaining_quantity = remaining_quantity - v_take
      where id = v_batch.id;
      insert into public.inventory_movements (
        shop_id, product_id, batch_id, quantity_change, movement_type,
        reference_id, created_by_profile_id, unit_cost_snapshot, invoice_item_id
      ) values (
        p_shop_id, v_line.product_id, v_batch.id, -v_take, 'out',
        p_invoice_id, v_profile_id, v_batch.unit_cost, v_line.id
      );
      v_remaining := v_remaining - v_take;
      exit when v_remaining = 0;
    end loop;
    if v_remaining > 0 then
      raise exception 'INSUFFICIENT_STOCK' using errcode = '23514';
    end if;
  end loop;

  update public.sale_requests set invoice_id = p_invoice_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'issue' and request_id = p_request_id;
  return p_invoice_id;
end;
$$;

-- Extend the reviewed current shop_private.checkout_customerless_sale; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION shop_private.checkout_customerless_sale(p_request_id uuid, p_shop_id uuid, p_invoice_id uuid, p_amount numeric, p_paid_at timestamp with time zone, p_method public.payment_method, p_reference text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_profile_id uuid;
  v_request public.customer_payment_requests%rowtype;
  v_invoice public.invoices%rowtype;
  v_product public.products%rowtype;
  v_service public.services%rowtype;
  v_line record;
  v_batch record;
  v_remaining numeric;
  v_take numeric;
  v_unit_discount numeric;
  v_discount numeric;
  v_total numeric;
  v_measurement jsonb;
  v_number bigint;
  v_payment_id uuid;
  v_hash text;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'sales.issue');
  if not shop_private.has_permission(p_shop_id, 'payments.receive') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_request_id is null or p_invoice_id is null or p_amount is null or p_amount <= 0
    or round(p_amount, 2) <> p_amount or p_paid_at is null or p_method is null
    or length(coalesce(p_reference, '')) > 200 then
    raise exception 'INVALID_CUSTOMERLESS_CHECKOUT' using errcode = '22023';
  end if;
  perform shop_private.assert_period_is_open(p_shop_id, p_paid_at);
  v_hash := md5(jsonb_build_object('invoiceId', p_invoice_id, 'amount', p_amount,
    'paidAt', p_paid_at, 'method', p_method,
    'reference', nullif(btrim(p_reference), ''))::text);
  insert into public.customer_payment_requests
    (shop_id, operation, request_id, actor_profile_id, payload_hash)
  values (p_shop_id, 'checkout', p_request_id, v_profile_id, v_hash) on conflict do nothing;
  select * into v_request from public.customer_payment_requests
  where shop_id = p_shop_id and operation = 'checkout' and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_profile_id or v_request.payload_hash <> v_hash then
    raise exception 'PAYMENT_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;

  select * into v_invoice from public.invoices
  where id = p_invoice_id and shop_id = p_shop_id for update;
  if not found then raise exception 'SALE_DRAFT_NOT_FOUND'; end if;
  if v_invoice.status <> 'draft' then raise exception 'SALE_NOT_DRAFT' using errcode = '23514'; end if;
  if v_invoice.client_id is not null then
    raise exception 'CUSTOMERLESS_CHECKOUT_REQUIRES_ANONYMOUS_DRAFT' using errcode = '23514';
  end if;
  if not exists (select 1 from public.invoice_items where invoice_id = p_invoice_id) then
    raise exception 'SALE_REQUIRES_LINES' using errcode = '23514';
  end if;

  perform product.id from public.products product join (
    select distinct item.product_id from public.invoice_items item
    where item.invoice_id = p_invoice_id and item.item_type = 'product'
  ) requested on requested.product_id = product.id order by product.id for update of product;
  perform service.id from public.services service join (
    select distinct item.service_id from public.invoice_items item
    where item.invoice_id = p_invoice_id and item.item_type = 'service'
  ) requested on requested.service_id = service.id order by service.id for update of service;

  for v_line in select * from public.invoice_items
    where invoice_id = p_invoice_id order by line_order, id
  loop
    if v_line.item_type = 'product' then
      select * into v_product from public.products where id = v_line.product_id
        and shop_id = p_shop_id and is_active;
      if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
      v_measurement:=shop_private.reprice_measured_invoice_line(v_line.id);
      v_total:=coalesce((v_measurement->>'lineTotal')::numeric,round(v_product.sale_price*v_line.quantity,2));
      update public.invoice_items set item_name = v_product.name,
        unit_price = coalesce((v_measurement->>'baseUnitPrice')::numeric,v_product.sale_price), measurement_snapshot=case when v_measurement is null then null else v_measurement->'measurement' end, discount_amount = 0, total_amount = v_total,
        product_sku_snapshot = v_product.sku, product_barcode_snapshot = v_product.barcode,
        discount_type_snapshot = null, discount_value_snapshot = 0 where id = v_line.id;
    elsif v_line.item_type = 'service' then
      select * into v_service from public.services where id = v_line.service_id
        and shop_id = p_shop_id and is_active;
      if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
      v_unit_discount := case v_service.default_discount_type when 'percent'
        then round(v_service.base_sale_price * v_service.default_discount_value / 100, 2)
        else v_service.default_discount_value end;
      v_discount := round(v_unit_discount * v_line.quantity, 2);
      v_total := round(v_service.base_sale_price * v_line.quantity - v_discount, 2);
      update public.invoice_items set item_name = v_service.name,
        unit_price = v_service.base_sale_price, discount_amount = v_discount,
        total_amount = v_total, discount_type_snapshot = v_service.default_discount_type,
        discount_value_snapshot = v_service.default_discount_value where id = v_line.id;
    else raise exception 'UNSUPPORTED_SALE_LINE_TYPE' using errcode = '22023';
    end if;
  end loop;

  select sum(total_amount), sum(discount_amount) into v_total, v_discount
  from public.invoice_items where invoice_id = p_invoice_id;
  v_total := (shop_private.quote_invoice_tax(p_invoice_id,clock_timestamp())->>'total')::numeric;
  if p_amount <> v_total then
    raise exception 'CUSTOMERLESS_CHECKOUT_REQUIRES_FULL_PAYMENT' using errcode = '23514';
  end if;
  if exists (
    select requested.product_id from (select product_id, sum(quantity) quantity
      from public.invoice_items where invoice_id = p_invoice_id and item_type = 'product'
      group by product_id) requested
    left join public.inventory_batches batch on batch.shop_id = p_shop_id
      and batch.product_id = requested.product_id
    group by requested.product_id, requested.quantity
    having coalesce(sum(batch.remaining_quantity), 0) < requested.quantity
  ) then raise exception 'INSUFFICIENT_STOCK' using errcode = '23514'; end if;

  insert into public.sale_number_counters (shop_id, next_number) values (p_shop_id, 2)
  on conflict (shop_id) do update set next_number = public.sale_number_counters.next_number + 1,
    updated_at = now() returning next_number - 1 into v_number;
  update public.invoices set invoice_number = 'SALE-' || lpad(v_number::text, 6, '0'),
    total_amount = v_total, discount_amount = v_discount, status = 'issued',
    issued_at = p_paid_at, issued_by_profile_id = v_profile_id, due_date = null,
    updated_at = p_paid_at where id = p_invoice_id;
  select total_amount into v_total from public.invoices where id=p_invoice_id;
  if p_amount<>v_total then raise exception 'TAX_QUOTE_CHANGED' using errcode='23514'; end if;

  for v_line in select item.id, item.product_id, item.quantity
    from public.invoice_items item where item.invoice_id = p_invoice_id
      and item.item_type = 'product' order by item.product_id, item.line_order, item.id
  loop
    v_remaining := v_line.quantity;
    for v_batch in select batch.id, batch.remaining_quantity, batch.unit_cost
      from public.inventory_batches batch where batch.shop_id = p_shop_id
        and batch.product_id = v_line.product_id and batch.remaining_quantity > 0
      order by batch.received_at, batch.id for update
    loop
      v_take := least(v_remaining, v_batch.remaining_quantity);
      update public.inventory_batches set remaining_quantity = remaining_quantity - v_take
      where id = v_batch.id;
      insert into public.inventory_movements (shop_id, product_id, batch_id,
        quantity_change, movement_type, reference_id, created_by_profile_id,
        unit_cost_snapshot, invoice_item_id)
      values (p_shop_id, v_line.product_id, v_batch.id, -v_take, 'out', p_invoice_id,
        v_profile_id, v_batch.unit_cost, v_line.id);
      v_remaining := v_remaining - v_take;
      exit when v_remaining = 0;
    end loop;
    if v_remaining > 0 then raise exception 'INSUFFICIENT_STOCK' using errcode = '23514'; end if;
  end loop;

  insert into public.payments (shop_id, payment_direction, invoice_id, client_id,
    amount, method, status, reference, paid_at, created_by_profile_id, customer_kind)
  values (p_shop_id, 'in', p_invoice_id, null, v_total, p_method, 'completed',
    nullif(btrim(p_reference), ''), p_paid_at, v_profile_id, 'receipt')
  returning id into v_payment_id;
  insert into public.customer_payment_allocations (shop_id, payment_id, invoice_id, amount)
  values (p_shop_id, v_payment_id, p_invoice_id, v_total);
  update public.customer_payment_requests set result_id = p_invoice_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'checkout' and request_id = p_request_id;
  return p_invoice_id;
end;
$$;

-- Extend the reviewed current shop_private.create_supplier_purchase; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION shop_private.create_supplier_purchase(p_request_id uuid, p_shop_id uuid, p_vendor_id uuid, p_invoice_number text, p_issued_on date, p_notes text, p_items jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_profile_id uuid;
  v_vendor_name text;
  v_invoice_id uuid;
  v_invoice_number text := nullif(btrim(p_invoice_number), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_issued_at timestamptz;
  v_items jsonb;
  v_item_count integer;
  v_distinct_product_count integer;
  v_valid_product_count integer;
  v_total numeric;
  v_request_payload jsonb;
  v_existing public.vendor_invoices%rowtype;
  v_item record;
  v_batch_id uuid;
  v_input jsonb; v_resolved jsonb; v_original jsonb:=p_items; v_snapshots jsonb:='{}';
begin
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'vendor_invoices.manage'
  );
  if p_request_id is null or p_vendor_id is null or p_issued_on is null
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100
    or (v_invoice_number is not null and length(v_invoice_number) > 120)
    or (v_notes is not null and length(v_notes) > 1000) then
    raise exception 'INVALID_PURCHASE' using errcode = '22023';
  end if;

  perform 1 from public.shops where id=p_shop_id for update;
  perform shop_private.assert_purchase_entitlement(p_shop_id);
  select * into v_existing from public.vendor_invoices where shop_id=p_shop_id and request_id=p_request_id for update;
  if found and v_existing.request_payload ? 'measurementInput' then
    if v_existing.request_payload->'measurementInput' is distinct from p_items
      or v_existing.request_payload->>'vendor_id' is distinct from p_vendor_id::text
      or v_existing.request_payload->>'invoice_number' is distinct from v_invoice_number
      or v_existing.request_payload->>'issued_on' is distinct from p_issued_on::text
      or v_existing.request_payload->>'notes' is distinct from v_notes
      or v_existing.status not in('posted','void') then raise exception 'PURCHASE_REQUEST_CONFLICT' using errcode='23505';end if;
    return v_existing.id;
  end if;
  if v_existing.id is not null and exists(select 1 from jsonb_array_elements(p_items)e where e ? 'unit_code' or e ? 'package_id') then
   raise exception 'PURCHASE_REQUEST_CONFLICT' using errcode='23505';end if;
  p_items:='[]'::jsonb;
  for v_input in select value from jsonb_array_elements(v_original) loop
   v_resolved:=shop_private.resolve_measured_line(p_shop_id,(v_input->>'product_id')::uuid,v_input,true);
   p_items:=p_items||jsonb_build_array(jsonb_build_object('product_id',v_input->>'product_id','quantity',(v_resolved->>'baseQuantity')::numeric,
    'unit_cost',case when v_resolved->'measurement'='null'::jsonb then (v_input->>'unit_cost')::numeric else (v_resolved->>'baseUnitPrice')::numeric end));
   v_snapshots:=jsonb_set(v_snapshots,array[v_input->>'product_id'],coalesce(v_resolved->'measurement','null'));
  end loop;
  begin
    select
      jsonb_agg(jsonb_build_object(
        'product_id', parsed.product_id,
        'quantity', parsed.quantity,
        'unit_cost', parsed.unit_cost
      ) order by parsed.product_id),
      count(*), count(distinct parsed.product_id),
      sum(round(parsed.quantity * parsed.unit_cost, 2))
    into v_items, v_item_count, v_distinct_product_count, v_total
    from (
      select
        (entry ->> 'product_id')::uuid as product_id,
        (entry ->> 'quantity')::numeric as quantity,
        (entry ->> 'unit_cost')::numeric as unit_cost
      from jsonb_array_elements(p_items) entry
    ) parsed;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'INVALID_PURCHASE' using errcode = '22023';
  end;

  if v_item_count <> jsonb_array_length(p_items)
    or v_distinct_product_count <> v_item_count
    or exists (
      select 1
      from jsonb_to_recordset(v_items)
        as item(product_id uuid, quantity numeric, unit_cost numeric)
      where item.product_id is null or item.quantity is null
        or item.unit_cost is null or item.quantity <= 0
        or item.quantity > 1000000 or round(item.quantity,shop_private.quantity_scale(p_shop_id,item.product_id,3)) <> item.quantity
        or item.unit_cost < 0 or item.unit_cost > 999999999.99
        or round(item.unit_cost,case when shop_private.quantity_scale(p_shop_id,item.product_id,3)=6 then 12 else 2 end) <> item.unit_cost
    )
    or v_total is null or v_total > 9999999999.99 then
    raise exception 'INVALID_PURCHASE' using errcode = '22023';
  end if;

  v_issued_at := (
    p_issued_on::timestamp + interval '12 hours'
  ) at time zone 'Africa/Cairo';
  v_request_payload := jsonb_build_object(
    'vendor_id', p_vendor_id,
    'invoice_number', v_invoice_number,
    'issued_on', p_issued_on,
    'notes', v_notes,
    'items', v_items
  );
  if v_existing.id is null then v_request_payload:=v_request_payload||jsonb_build_object('measurementInput',v_original);end if;

  -- Serialize document creation and retries for a shop.
  perform 1 from public.shops where id = p_shop_id for update;
  if not found then raise exception 'SHOP_NOT_FOUND'; end if;
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'vendor_invoices.manage'
  );
  perform shop_private.assert_purchase_entitlement(p_shop_id);

  select * into v_existing
  from public.vendor_invoices
  where shop_id = p_shop_id and request_id = p_request_id
  for update;
  if found then
    if v_existing.request_payload = v_request_payload
      and v_existing.status in (
        'posted'::public.vendor_invoice_status,
        'void'::public.vendor_invoice_status
      ) then
      return v_existing.id;
    end if;
    raise exception 'PURCHASE_REQUEST_CONFLICT' using errcode = '23505';
  end if;

  select v.name into v_vendor_name
  from public.vendors v
  where v.id = p_vendor_id and v.shop_id = p_shop_id and v.is_active;
  if v_vendor_name is null then
    raise exception 'VENDOR_NOT_FOUND';
  end if;

  select count(*) into v_valid_product_count
  from public.products product
  join jsonb_to_recordset(v_items)
    as item(product_id uuid, quantity numeric, unit_cost numeric)
    on item.product_id = product.id
  where product.shop_id = p_shop_id and product.is_active;
  if v_valid_product_count <> v_item_count then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  perform shop_private.assert_period_is_open(p_shop_id, v_issued_at);

  insert into public.vendor_invoices (
    shop_id, vendor_id, vendor_name_snapshot, invoice_number, status,
    issued_at, total_amount, notes, created_by_profile_id, request_id,
    request_payload
  ) values (
    p_shop_id, p_vendor_id, v_vendor_name, v_invoice_number, 'draft',
    v_issued_at, v_total, v_notes, v_profile_id, p_request_id,
    v_request_payload
  ) returning id into v_invoice_id;

  for v_item in
    select item.product_id, item.quantity, item.unit_cost
    from jsonb_to_recordset(v_items)
      as item(product_id uuid, quantity numeric, unit_cost numeric)
    order by item.product_id
  loop
    insert into public.vendor_invoice_items (
      vendor_invoice_id, product_id, quantity, unit_cost, total_cost, measurement_snapshot
    ) values (
      v_invoice_id, v_item.product_id, v_item.quantity, v_item.unit_cost,
      round(v_item.quantity * v_item.unit_cost, 2), nullif(v_snapshots->v_item.product_id::text,'null'::jsonb)
    );

    insert into public.inventory_batches (
      shop_id, product_id, quantity_received, remaining_quantity,
      unit_cost, received_at, source_type, source_id
    ) values (
      p_shop_id, v_item.product_id, v_item.quantity, v_item.quantity,
      v_item.unit_cost, v_issued_at, 'vendor_invoice', v_invoice_id
    ) returning id into v_batch_id;

    insert into public.inventory_movements (
      shop_id, product_id, batch_id, quantity_change, movement_type,
      reference_id, created_by_profile_id, unit_cost_snapshot
    ) values (
      p_shop_id, v_item.product_id, v_batch_id, v_item.quantity, 'in',
      v_invoice_id, v_profile_id, v_item.unit_cost
    );
  end loop;

  update public.vendor_invoices
  set status = 'posted', updated_at = now()
  where id = v_invoice_id and status = 'draft';
  if not found then raise exception 'PURCHASE_POST_FAILED'; end if;

  return v_invoice_id;
end;
$$;

-- Extend the reviewed current shop_private.calculate_tax; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION shop_private.calculate_tax(p_lines jsonb, p_policy jsonb, p_order_discount numeric DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare line jsonb; rule jsonb; rows jsonb:='[]'; enabled boolean:=coalesce((p_policy->>'enabled')::boolean,false);
 gross numeric; line_discount numeric; available numeric:=0; cumulative numeric:=0; allocated numeric:=0; share numeric;
 net5 numeric; tax5 numeric; total5 numeric; net_sum numeric:=0; tax_sum numeric:=0; total_sum numeric:=0;
 previous_net numeric:=0; previous_tax numeric:=0; previous_total numeric:=0; net_money numeric; tax_money numeric; total_money numeric;
 qty numeric; price numeric; rate numeric; amount numeric; discount_net5 numeric; discount_net_money numeric:=0;
begin
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100
 or p_order_discount is null or p_order_discount<0 or round(p_order_discount,2)<>p_order_discount then
 raise exception 'INVALID_TAX_INPUT' using errcode='22023'; end if;
 for line in select value from jsonb_array_elements(p_lines) loop
 qty:=(line->>'quantity')::numeric; price:=(line->>'unitPrice')::numeric; line_discount:=(line->>'lineDiscount')::numeric;
 if qty is null or qty<=0 or qty>1000000 or round(qty,6)<>qty or price is null or price<0 or price>9999999999.99 or round(price,12)<>price
 or line_discount is null or line_discount<0 or round(line_discount,5)<>line_discount then
 raise exception 'INVALID_TAX_INPUT' using errcode='22023'; end if;
 gross:=round(qty*price,case when enabled then 5 else 2 end);
 if line_discount>gross then raise exception 'DISCOUNT_EXCEEDS_SALE' using errcode='22023'; end if;
 available:=available+gross-line_discount;
 end loop;
 if p_order_discount>available then raise exception 'DISCOUNT_EXCEEDS_SALE' using errcode='22023'; end if;
 for line in select value from jsonb_array_elements(p_lines) loop
 qty:=(line->>'quantity')::numeric; price:=(line->>'unitPrice')::numeric;
 gross:=round(qty*price,case when enabled then 5 else 2 end); line_discount:=(line->>'lineDiscount')::numeric;
 cumulative:=cumulative+gross-line_discount;
 share:=case when available=0 then 0 else round(p_order_discount*cumulative/available,5)-allocated end;
 allocated:=allocated+share; amount:=gross-line_discount-share;
 select value into rule from jsonb_array_elements(coalesce(p_policy->'items','[]'))
 where value->>'itemType'=line->>'itemType' and value->>'sourceId'=line->>'sourceId';
 rule:=coalesce(rule,p_policy->'default'); rate:=0;
 if enabled then perform shop_private.validate_tax_rule(rule); rate:=(rule->>'rate')::numeric; end if;
 net5:=case when enabled and rule->>'priceMode'='inclusive' then round(amount/(1+rate/100),5) else amount end;
 tax5:=case when enabled and rule->>'priceMode'='inclusive' then amount-net5 else round(net5*rate/100,5) end;
 discount_net5:=case when enabled and rule->>'priceMode'='inclusive' then round((line_discount+share)/(1+rate/100),5) else line_discount+share end;
 discount_net_money:=discount_net_money+round(discount_net5,2);
 total5:=net5+tax5;
 net_sum:=net_sum+net5; tax_sum:=tax_sum+tax5; total_sum:=total_sum+total5;
 -- Currency money rounds per line; document money sums those rounded lines.
 -- Five-decimal ETA components stay separate, including the explicit rounding delta.
 total_money:=round(total5,2); tax_money:=least(total_money,round(tax5,2));
 net_money:=total_money-tax_money;
 previous_total:=previous_total+total_money; previous_tax:=previous_tax+tax_money; previous_net:=previous_net+net_money;
 rows:=rows||jsonb_build_array(line||jsonb_build_object('originalUnitPrice',price,'originalQuantity',qty,
 'discountNet5',discount_net5,'gross5',gross,'lineDiscount5',line_discount,'orderDiscount5',share,'net5',net5,'tax5',tax5,'total5',total5,
 'net',net_money,'tax',tax_money,'total',total_money,'calculationEnabled',enabled,
 'rule',case when enabled then rule else null end));
 end loop;
 return jsonb_build_object('version',1,'calculationEnabled',enabled,'minorUnits',2,'componentDecimals',5,
 'orderDiscount',p_order_discount,'discountNet',discount_net_money,'net5',net_sum,'tax5',tax_sum,'total5',total_sum,
 'net',previous_net,'tax',previous_tax,'total',previous_total,'moneyRounding5',previous_total-total_sum,'lines',rows);
end; $$;

-- Extend the reviewed current shop_private.tax_return_components; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION shop_private.tax_return_components(p_line jsonb, p_cumulative_quantity numeric, p_previous_quantity numeric DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare qty numeric:=(p_line->>'originalQuantity')::numeric;
 original_total numeric:=(p_line->>'total')::numeric; original_tax numeric:=(p_line->>'tax')::numeric;
 current_total numeric; prior_total numeric; current_tax numeric; prior_tax numeric;
begin
 if qty is null or qty<=0 or p_cumulative_quantity is null or p_previous_quantity is null
 or p_previous_quantity<0 or p_cumulative_quantity<p_previous_quantity or p_cumulative_quantity>qty
 or round(p_cumulative_quantity,6)<>p_cumulative_quantity or round(p_previous_quantity,6)<>p_previous_quantity
 or original_total is null or original_tax is null or original_tax<0 or original_total<original_tax then
 raise exception 'INVALID_CUMULATIVE_TAX_RETURN' using errcode='22023'; end if;
 current_total:=round(original_total*p_cumulative_quantity/qty,2);
 prior_total:=round(original_total*p_previous_quantity/qty,2);
 -- Apportion cumulative refunded minor units. Independent tax rounding can
 -- produce negative pre-tax deltas; this monotonic allocation cannot.
 current_tax:=case when original_total=0 then 0 else floor(current_total*100*original_tax/original_total)/100 end;
 prior_tax:=case when original_total=0 then 0 else floor(prior_total*100*original_tax/original_total)/100 end;
 return jsonb_build_object('total',current_total-prior_total,'tax',current_tax-prior_tax,
 'net',(current_total-prior_total)-(current_tax-prior_tax));
end; $$;

-- Extend the reviewed current shop_private.adjust_stock; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION shop_private.adjust_stock(p_request_id uuid, p_shop_id uuid, p_product_id uuid, p_quantity_change numeric, p_unit_cost numeric, p_note text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_profile_id uuid;
  v_existing public.stock_adjustment_requests%rowtype;
  v_batch record;
  v_batch_id uuid;
  v_remaining numeric;
  v_take numeric;
begin
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'inventory.manage'
  );
  if p_request_id is null or p_product_id is null
    or p_quantity_change is null or p_quantity_change = 0
    or abs(p_quantity_change) > 1000000
    or round(p_quantity_change,shop_private.quantity_scale(p_shop_id,p_product_id,3)) <> p_quantity_change
    or (p_quantity_change > 0 and
        (p_unit_cost is null or p_unit_cost < 0 or p_unit_cost > 999999999.99))
    or (p_quantity_change < 0 and
        (p_unit_cost is not null or p_note is null
         or length(btrim(p_note)) < 3))
    or (p_note is not null and length(btrim(p_note)) > 500) then
    raise exception 'INVALID_STOCK_ADJUSTMENT' using errcode = '22023';
  end if;

  -- All batch mutations for a product serialize here.
  perform 1 from public.products p
  where p.id = p_product_id and p.shop_id = p_shop_id and p.is_active
  for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  perform shop_private.assert_shop_write_access(
    p_shop_id, 'inventory.manage'
  );

  if not exists (
    select 1 from public.shop_memberships m
    join public.subscriptions sub on sub.profile_id = m.profile_id
    join public.plans plan on plan.id = sub.plan_id
    where m.shop_id = p_shop_id and m.role = 'owner'
      and m.status = 'active'
      and coalesce((plan.features ->> 'inventory')::boolean, false)
  ) then
    raise exception 'INVENTORY_NOT_IN_PLAN' using errcode = '42501';
  end if;

  select * into v_existing
  from public.stock_adjustment_requests
  where id = p_request_id;
  if found then
    if v_existing.shop_id = p_shop_id
      and v_existing.product_id = p_product_id
      and v_existing.quantity_change = p_quantity_change
      and v_existing.unit_cost is not distinct from p_unit_cost
      and v_existing.note is not distinct from nullif(btrim(p_note), '') then
      return p_request_id;
    end if;
    raise exception 'STOCK_REQUEST_CONFLICT' using errcode = '23505';
  end if;

  insert into public.stock_adjustment_requests (
    id, shop_id, product_id, quantity_change, unit_cost, note,
    created_by_profile_id
  ) values (
    p_request_id, p_shop_id, p_product_id, p_quantity_change,
    case when p_quantity_change > 0 then p_unit_cost else null end,
    nullif(btrim(p_note), ''), v_profile_id
  );

  if p_quantity_change > 0 then
    insert into public.inventory_batches (
      shop_id, product_id, quantity_received, remaining_quantity,
      unit_cost, source_type, received_at
    ) values (
      p_shop_id, p_product_id, p_quantity_change, p_quantity_change,
      p_unit_cost, 'manual', clock_timestamp()
    ) returning id into v_batch_id;
    insert into public.inventory_movements (
      shop_id, product_id, batch_id, quantity_change, movement_type,
      reference_id, created_by_profile_id, unit_cost_snapshot
    ) values (
      p_shop_id, p_product_id, v_batch_id, p_quantity_change, 'in',
      p_request_id, v_profile_id, p_unit_cost
    );
  else
    v_remaining := -p_quantity_change;
    for v_batch in
      select id, remaining_quantity, unit_cost
      from public.inventory_batches
      where shop_id = p_shop_id and product_id = p_product_id
        and remaining_quantity > 0
      order by received_at, id
      for update
    loop
      v_take := least(v_remaining, v_batch.remaining_quantity);
      update public.inventory_batches
      set remaining_quantity = remaining_quantity - v_take
      where id = v_batch.id;
      insert into public.inventory_movements (
        shop_id, product_id, batch_id, quantity_change, movement_type,
        reference_id, created_by_profile_id, unit_cost_snapshot
      ) values (
        p_shop_id, p_product_id, v_batch.id, -v_take, 'adjustment',
        p_request_id, v_profile_id, v_batch.unit_cost
      );
      v_remaining := v_remaining - v_take;
      exit when v_remaining = 0;
    end loop;
    if v_remaining > 0 then
      raise exception 'INSUFFICIENT_STOCK' using errcode = '23514';
    end if;
  end if;
  return p_request_id;
end;
$$;

-- Extend the reviewed current shop_private.record_stock_count; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION shop_private.record_stock_count(p_request_id uuid, p_shop_id uuid, p_product_id uuid, p_counted_quantity numeric, p_counted_at timestamp with time zone, p_reason text, p_reference text, p_positive_variance_unit_cost numeric) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_profile_id uuid; v_existing public.stock_counts%rowtype;
  v_expected numeric; v_variance numeric; v_batch record;
  v_batch_id uuid; v_remaining numeric; v_take numeric;
begin
  v_profile_id := shop_private.assert_inventory_write_access(p_shop_id);
  if p_request_id is null or p_product_id is null
    or p_counted_quantity is null or p_counted_quantity < 0
    or p_counted_quantity > 1000000
    or round(p_counted_quantity,shop_private.quantity_scale(p_shop_id,p_product_id,2)) <> p_counted_quantity
    or p_counted_at is null or p_counted_at > now() + interval '5 minutes'
    or p_reason is null or length(btrim(p_reason)) not between 3 and 500
    or p_reference is null or length(btrim(p_reference)) not between 1 and 200
    or (p_positive_variance_unit_cost is not null
      and (p_positive_variance_unit_cost < 0
        or p_positive_variance_unit_cost > 999999999.99
        or round(p_positive_variance_unit_cost, 2) <> p_positive_variance_unit_cost)) then
    raise exception 'INVALID_STOCK_COUNT' using errcode = '22023';
  end if;

  -- Sale issuance and manual adjustments use this same product lock. Supplier
  -- returns also lock affected batches, so a concurrent supplier change is
  -- ordered before or after this correction without a partial balance.
  perform 1 from public.products product
  where product.id = p_product_id and product.shop_id = p_shop_id
  for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  perform shop_private.assert_inventory_write_access(p_shop_id);

  select * into v_existing from public.stock_counts where id = p_request_id;
  if found then
    if v_existing.shop_id = p_shop_id
      and v_existing.product_id = p_product_id
      and v_existing.counted_quantity = p_counted_quantity
      and v_existing.counted_at = p_counted_at
      and v_existing.reason = btrim(p_reason)
      and v_existing.external_reference = btrim(p_reference)
      and v_existing.positive_variance_unit_cost
        is not distinct from p_positive_variance_unit_cost then
      return p_request_id;
    end if;
    raise exception 'STOCK_COUNT_REQUEST_CONFLICT' using errcode = '23505';
  end if;

  perform shop_private.assert_period_is_open(p_shop_id, p_counted_at);
  select coalesce(sum(batch.remaining_quantity), 0) into v_expected
  from public.inventory_batches batch
  where batch.shop_id = p_shop_id and batch.product_id = p_product_id;
  v_variance := p_counted_quantity - v_expected;
  if v_variance > 0 and p_positive_variance_unit_cost is null then
    raise exception 'POSITIVE_VARIANCE_COST_REQUIRED' using errcode = '22023';
  end if;
  if v_variance <= 0 and p_positive_variance_unit_cost is not null then
    raise exception 'POSITIVE_VARIANCE_COST_NOT_ALLOWED' using errcode = '22023';
  end if;

  insert into public.stock_counts (
    id, shop_id, product_id, expected_quantity, counted_quantity,
    variance_quantity, positive_variance_unit_cost, reason,
    external_reference, counted_at, created_by_profile_id
  ) values (
    p_request_id, p_shop_id, p_product_id, v_expected,
    p_counted_quantity, v_variance, p_positive_variance_unit_cost,
    btrim(p_reason), btrim(p_reference), p_counted_at, v_profile_id
  );

  if v_variance > 0 then
    insert into public.inventory_batches (
      shop_id, product_id, quantity_received, remaining_quantity,
      unit_cost, source_type, source_id, received_at
    ) values (
      p_shop_id, p_product_id, v_variance, v_variance,
      p_positive_variance_unit_cost, 'manual', p_request_id, p_counted_at
    ) returning id into v_batch_id;
    insert into public.inventory_movements (
      shop_id, product_id, batch_id, quantity_change, movement_type,
      reference_id, created_by_profile_id, unit_cost_snapshot, created_at
    ) values (
      p_shop_id, p_product_id, v_batch_id, v_variance, 'adjustment',
      p_request_id, v_profile_id, p_positive_variance_unit_cost, p_counted_at
    );
  elsif v_variance < 0 then
    v_remaining := -v_variance;
    for v_batch in
      select batch.id, batch.remaining_quantity, batch.unit_cost
      from public.inventory_batches batch
      where batch.shop_id = p_shop_id and batch.product_id = p_product_id
        and batch.remaining_quantity > 0
      order by batch.received_at, batch.id
      for update
    loop
      v_take := least(v_remaining, v_batch.remaining_quantity);
      update public.inventory_batches
      set remaining_quantity = remaining_quantity - v_take
      where id = v_batch.id;
      insert into public.inventory_movements (
        shop_id, product_id, batch_id, quantity_change, movement_type,
        reference_id, created_by_profile_id, unit_cost_snapshot, created_at
      ) values (
        p_shop_id, p_product_id, v_batch.id, -v_take, 'adjustment',
        p_request_id, v_profile_id, v_batch.unit_cost, p_counted_at
      );
      v_remaining := v_remaining - v_take;
      exit when v_remaining = 0;
    end loop;
    if v_remaining > 0 then
      raise exception 'INSUFFICIENT_STOCK' using errcode = '23514';
    end if;
  end if;
  return p_request_id;
end;
$$;

-- Extend the reviewed current shop_private.set_reorder_threshold; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION shop_private.set_reorder_threshold(p_shop_id uuid, p_product_id uuid, p_threshold numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_profile_id uuid; v_previous numeric;
begin
  v_profile_id := shop_private.assert_inventory_write_access(p_shop_id);
  if p_product_id is null or p_threshold is null or p_threshold < 0
    or p_threshold > 1000000 or round(p_threshold,shop_private.quantity_scale(p_shop_id,p_product_id,2)) <> p_threshold then
    raise exception 'INVALID_REORDER_THRESHOLD' using errcode = '22023';
  end if;
  select product.reorder_threshold into v_previous
  from public.products product
  where product.id = p_product_id and product.shop_id = p_shop_id
    and product.is_active
  for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  perform shop_private.assert_inventory_write_access(p_shop_id);
  if v_previous = p_threshold then return; end if;
  update public.products set reorder_threshold = p_threshold, updated_at = now()
  where id = p_product_id and shop_id = p_shop_id;
  insert into public.inventory_threshold_changes (
    shop_id, product_id, previous_threshold, new_threshold,
    changed_by_profile_id
  ) values (
    p_shop_id, p_product_id, v_previous, p_threshold, v_profile_id
  );
end;
$$;

-- Extend the reviewed current shop_private.return_plan; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION shop_private.return_plan(p_shop_id uuid, p_location_id uuid, p_invoice_id uuid, p_lines jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare sale public.invoices%rowtype; source jsonb; item jsonb; line public.invoice_items%rowtype; frozen jsonb; prior numeric; qty numeric;
 components jsonb; rows jsonb:='[]'; allocations jsonb:='[]'; total numeric:=0; tax numeric:=0; due numeric; needed numeric; take_amount numeric; receipt_part record;
begin
 perform shop_private.return_actor(p_shop_id,p_location_id);
 select * into sale from public.invoices where id=p_invoice_id and shop_id=p_shop_id and location_id=p_location_id for update;
 if not found then raise exception 'SALE_NOT_FOUND' using errcode='P0002';end if;
 if sale.status<>'issued' or exists(select 1 from public.sale_corrections where invoice_id=sale.id) then raise exception 'SALE_NOT_RETURNABLE' using errcode='23514';end if;
 source:=shop_private.return_source(sale.id);
 if source is null or source->>'currency' is distinct from sale.currency then raise exception 'RETURN_ORIGINAL_SNAPSHOT_UNSUPPORTED' using errcode='55000';end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 100
 or exists(select 1 from jsonb_array_elements(p_lines)e group by e->>'lineId' having count(*)>1) then
  raise exception 'INVALID_RETURN_LINES' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(p_lines) order by value->>'lineId' loop
  qty:=(item->>'quantity')::numeric;
  if jsonb_typeof(item->'quantity') is distinct from 'number' or qty is null or qty<=0 or qty>1000000 or round(qty,6)<>qty
   or (item-array['lineId','quantity','disposition'])<>'{}'::jsonb then raise exception 'INVALID_RETURN_QUANTITY_PRECISION' using errcode='22023';end if;
  select * into line from public.invoice_items where id=(item->>'lineId')::uuid and invoice_id=sale.id and shop_id=p_shop_id;
  if not found then raise exception 'RETURN_LINE_NOT_FOUND' using errcode='P0002';end if;
  if (line.item_type='service' and item->>'disposition' is distinct from 'service') or (line.item_type='product' and coalesce(item->>'disposition','') not in('resellable','damaged')) then
   raise exception 'INVALID_RETURN_DISPOSITION' using errcode='22023';end if;
  select value into frozen from jsonb_array_elements(source->'lines') where value->>'id'=line.id::text;
  if frozen is null or (frozen->>'originalQuantity')::numeric<>line.quantity then raise exception 'RETURN_ORIGINAL_SNAPSHOT_UNSUPPORTED' using errcode='55000';end if;
  if line.measurement_snapshot is null and round(qty,2)<>qty then raise exception 'INVALID_RETURN_QUANTITY_PRECISION' using errcode='22023';end if;
  if line.measurement_snapshot is null and round(line.quantity,2)<>line.quantity then raise exception 'RETURN_ORIGINAL_QUANTITY_PRECISION_UNSUPPORTED' using errcode='55000';end if;
  if line.measurement_snapshot is not null and mod(qty,(line.measurement_snapshot->>'quantityIncrement')::numeric)<>0 then raise exception 'INVALID_MEASUREMENT_INCREMENT' using errcode='22023';end if;
  select coalesce(sum(quantity),0) into prior from public.sale_return_lines where line_id=line.id;
  if qty+prior>line.quantity then raise exception 'RETURN_QUANTITY_EXCEEDED' using errcode='23514';end if;
  components:=shop_private.tax_return_components(frozen,prior+qty,prior);
  total:=total+(components->>'total')::numeric;tax:=tax+(components->>'tax')::numeric;
  rows:=rows||jsonb_build_array(item||components||jsonb_build_object('originalSnapshot',frozen,'cumulativeQuantity',prior+qty));
 end loop;
 -- Same allocation locks used by legacy refunds; verify again after waiting.
 perform a.id from public.customer_payment_allocations a where a.invoice_id=sale.id order by a.id for update;
 due:=shop_private.invoice_outstanding(sale.id);needed:=greatest(total-due,0);
 for receipt_part in select a.id,a.payment_id,p.method,p.paid_at,shop_private.allocation_remaining(a.id) capacity
  from public.customer_payment_allocations a join public.payments p on p.id=a.payment_id and p.shop_id=a.shop_id
  where a.invoice_id=sale.id and p.customer_kind='receipt' and p.status='completed' order by p.paid_at,p.id,a.id loop
  take_amount:=least(needed,receipt_part.capacity);
  if take_amount>0 then allocations:=allocations||jsonb_build_array(jsonb_build_object('allocationId',receipt_part.id,'paymentId',receipt_part.payment_id,'method',receipt_part.method,'amount',take_amount));needed:=needed-take_amount;end if;
 end loop;
 if needed>0 then raise exception 'RETURN_REFUND_CAPACITY_UNAVAILABLE' using errcode='23514';end if;
 return jsonb_build_object('version',1,'currency',sale.currency,'lines',rows,'total',total,'tax',tax,'net',total-tax,
  'dueBefore',due,'debtReduction',least(total,due),'refundDue',greatest(total-due,0),'dueAfter',greatest(due-total,0),'allocations',allocations,
  'originalDocument',jsonb_build_object('invoiceId',sale.id,'invoiceNumber',sale.invoice_number,'issuedAt',sale.issued_at,
   'receiptId',(select invoice_id from public.sale_receipts where invoice_id=sale.id),'etaSourceAvailable',exists(select 1 from public.eta_sale_sources where invoice_id=sale.id)));
end;$$;

-- Extend the reviewed current public.create_sale_return; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION public.create_sale_return(p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid, p_lines jsonb, p_reason text, p_expected_plan jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare actor uuid; payload jsonb; previous public.sale_returns%rowtype; plan jsonb; result uuid:=gen_random_uuid(); item jsonb; refund_part jsonb;
 line public.invoice_items%rowtype; fifo_part record; needed numeric; take_qty numeric; movement uuid; refund uuid; stamp timestamptz:=clock_timestamp();
begin
 actor:=shop_private.return_actor(p_shop_id,p_location_id);
 if p_request_id is null or length(btrim(coalesce(p_reason,''))) not between 2 and 1000 or p_expected_plan is null then raise exception 'INVALID_RETURN_REQUEST' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('return:'||p_shop_id::text||':'||p_request_id::text,0));
 payload:=jsonb_build_array(p_location_id,p_invoice_id,p_lines,btrim(p_reason),p_expected_plan);
 select * into previous from public.sale_returns where shop_id=p_shop_id and request_id=p_request_id;
 if found then
  if previous.payload<>payload or previous.actor_profile_id<>actor then raise exception 'RETURN_REQUEST_CONFLICT' using errcode='23505';end if;
  return previous.id;
 end if;
 perform shop_private.assert_period_is_open(p_shop_id,stamp);
 plan:=shop_private.return_plan(p_shop_id,p_location_id,p_invoice_id,p_lines);
 if plan<>p_expected_plan then raise exception 'RETURN_PREVIEW_CHANGED' using errcode='40001';end if;
 insert into public.sale_returns(id,shop_id,location_id,invoice_id,request_id,payload,currency,original_document,total,net,tax,due_before,debt_reduction,refund_due,due_after,reason,actor_profile_id,created_at)
 values(result,p_shop_id,p_location_id,p_invoice_id,p_request_id,payload,plan->>'currency',plan->'originalDocument',(plan->>'total')::numeric,(plan->>'net')::numeric,(plan->>'tax')::numeric,
  (plan->>'dueBefore')::numeric,(plan->>'debtReduction')::numeric,(plan->>'refundDue')::numeric,(plan->>'dueAfter')::numeric,btrim(p_reason),actor,stamp);
 -- Product and batch lock order agrees with stock commands. Track damaged FIFO
 -- allocations too, so later resellable returns cannot restore them a second time.
 perform p.id from public.products p where p.id in(select l.product_id from public.invoice_items l join jsonb_array_elements(p_lines)e on (e->>'lineId')::uuid=l.id) order by p.id for update;
 perform b.id from public.inventory_batches b where b.id in(select m.batch_id from public.inventory_movements m where m.reference_id=p_invoice_id and m.invoice_item_id in(select (e->>'lineId')::uuid from jsonb_array_elements(p_lines)e)) order by b.id for update;
 for item in select value from jsonb_array_elements(plan->'lines') loop
  select * into line from public.invoice_items where id=(item->>'lineId')::uuid;
  insert into public.sale_return_lines(return_id,shop_id,line_id,quantity,disposition,original_snapshot,total,net,tax)
  values(result,p_shop_id,line.id,(item->>'quantity')::numeric,item->>'disposition',item->'originalSnapshot',(item->>'total')::numeric,(item->>'net')::numeric,(item->>'tax')::numeric);
  if line.item_type='product' then
   needed:=(item->>'quantity')::numeric;
   for fifo_part in select m.*,abs(m.quantity_change)-coalesce((select sum(s.quantity) from public.sale_return_stock s where s.movement_id=m.id),0) capacity
    from public.inventory_movements m join public.inventory_batches b on b.id=m.batch_id
    where m.reference_id=p_invoice_id and m.invoice_item_id=line.id and m.product_id=line.product_id and m.shop_id=p_shop_id
     and m.location_id=p_location_id and m.movement_type='out' and m.sale_correction_id is null
     and not exists(select 1 from public.service_material_consumptions c where c.movement_id=m.id)
    order by b.received_at,b.id,m.id loop
    take_qty:=least(needed,fifo_part.capacity);if take_qty<=0 then continue;end if;
    if fifo_part.unit_cost_snapshot is null or round(take_qty,6)<>take_qty then raise exception 'RETURN_FIFO_LINEAGE_UNSUPPORTED' using errcode='55000';end if;
    movement:=null;
    if item->>'disposition'='resellable' then
     update public.inventory_batches set remaining_quantity=remaining_quantity+take_qty where id=fifo_part.batch_id and shop_id=p_shop_id and location_id=p_location_id;
     if not found then raise exception 'RETURN_FIFO_LINEAGE_UNSUPPORTED' using errcode='55000';end if;
     insert into public.inventory_movements(shop_id,location_id,product_id,batch_id,quantity_change,movement_type,reference_id,created_by_profile_id,unit_cost_snapshot,invoice_item_id)
     values(p_shop_id,p_location_id,fifo_part.product_id,fifo_part.batch_id,take_qty,'in',result,actor,fifo_part.unit_cost_snapshot,line.id) returning id into movement;
    end if;
    insert into public.sale_return_stock(return_id,line_id,movement_id,quantity,disposition,restoration_movement_id)
    values(result,line.id,fifo_part.id,take_qty,item->>'disposition',movement);
    needed:=needed-take_qty;if needed=0 then exit;end if;
   end loop;
   if needed<>0 then raise exception 'RETURN_FIFO_LINEAGE_UNSUPPORTED' using errcode='55000';end if;
  end if;
 end loop;
 for refund_part in select value from jsonb_array_elements(plan->'allocations') loop
  insert into public.sale_return_refunds(return_id,shop_id,allocation_id,payment_id,amount,method)
  values(result,p_shop_id,(refund_part->>'allocationId')::uuid,(refund_part->>'paymentId')::uuid,(refund_part->>'amount')::numeric,(refund_part->>'method')::public.payment_method) returning id into refund;
  insert into public.sale_return_refund_events(refund_id,shop_id,request_id,state,operation,reference,reason,actor_profile_id)
  values(refund,p_shop_id,refund,'pending','reserved','',btrim(p_reason),actor);
 end loop;
 perform shop_private.reconcile_commission(p_invoice_id);
 return result;
end;$$;

-- Extend the reviewed current public.sale_return_context; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION public.sale_return_context(p_shop_id uuid, p_location_id uuid, p_invoice_id uuid, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare sale public.invoices%rowtype; source jsonb; allowed boolean:=true;
begin
 perform shop_private.assert_sale_read_access(p_shop_id);
 perform shop_private.assert_payment_read_access(p_shop_id);
 perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_offset<0 or p_offset>100000 then raise exception 'INVALID_RETURN_OFFSET' using errcode='22023';end if;
 select * into sale from public.invoices where id=p_invoice_id and shop_id=p_shop_id and location_id=p_location_id;
 if not found then raise exception 'SALE_NOT_FOUND' using errcode='P0002';end if;
 begin perform shop_private.return_actor(p_shop_id,p_location_id);exception when insufficient_privilege then allowed:=false;end;
 source:=shop_private.return_source(sale.id);
 if exists(select 1 from public.invoice_items where invoice_id=sale.id and measurement_snapshot is null and round(quantity,2)<>quantity) then source:=null;end if;
 return jsonb_build_object('version',1,'canReturn',allowed and sale.status='issued' and source is not null and not exists(select 1 from public.sale_corrections where invoice_id=sale.id),
 'supported',source is not null,'due',shop_private.invoice_outstanding(sale.id),'currency',sale.currency,
 'lines',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.item_name,'itemType',l.item_type,'quantity',l.quantity,'measurement',l.measurement_snapshot,
  'remaining',l.quantity-coalesce((select sum(quantity) from public.sale_return_lines where line_id=l.id),0)) order by l.line_order,l.id),'[]'::jsonb) from public.invoice_items l where l.invoice_id=sale.id),
 'totalCount',(select count(*) from public.sale_returns where invoice_id=sale.id),
 'history',(select coalesce(jsonb_agg(shop_private.return_document(r.id) order by r.created_at desc,r.id desc),'[]'::jsonb)
  from(select id,created_at from public.sale_returns where invoice_id=sale.id order by created_at desc,id desc offset p_offset limit 50)r));
end;$$;

-- Extend the reviewed current shop_private.record_purchase_return; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION shop_private.record_purchase_return(p_request_id uuid, p_shop_id uuid, p_purchase_id uuid, p_returned_at timestamp with time zone, p_reason text, p_reference text, p_items jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_profile_id uuid; v_request public.supplier_operation_requests%rowtype;
  v_invoice public.vendor_invoices%rowtype; v_items jsonb; v_count integer;
  v_distinct integer; v_total numeric; v_hash text; v_return_id uuid;
  v_credit_id uuid; v_item record; v_line record; v_batch public.inventory_batches%rowtype;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'purchase_returns.manage');
  if p_request_id is null or p_purchase_id is null or p_returned_at is null
    or length(btrim(coalesce(p_reason, ''))) < 2 or length(p_reason) > 1000
    or length(coalesce(p_reference, '')) > 200 or p_items is null
    or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_PURCHASE_RETURN' using errcode = '22023'; end if;
  begin
    select jsonb_agg(jsonb_build_object('vendor_invoice_item_id', parsed.item_id,
      'quantity', parsed.quantity) order by parsed.item_id), count(*), count(distinct parsed.item_id)
    into v_items, v_count, v_distinct from (select
      (entry ->> 'vendor_invoice_item_id')::uuid item_id,
      (entry ->> 'quantity')::numeric quantity from jsonb_array_elements(p_items) entry) parsed;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'INVALID_PURCHASE_RETURN' using errcode = '22023'; end;
  if v_count <> jsonb_array_length(p_items) or v_distinct <> v_count or exists (
    select 1 from jsonb_to_recordset(v_items) item(vendor_invoice_item_id uuid, quantity numeric)
    where item.vendor_invoice_item_id is null or item.quantity is null or item.quantity <= 0
      or item.quantity > 1000000 or round(item.quantity,6) <> item.quantity) then
    raise exception 'INVALID_PURCHASE_RETURN' using errcode = '22023'; end if;
  perform shop_private.assert_period_is_open(p_shop_id, p_returned_at);
  v_hash := md5(jsonb_build_object('purchaseId', p_purchase_id,
    'returnedAt', p_returned_at, 'reason', btrim(p_reason),
    'reference', nullif(btrim(p_reference), ''), 'items', v_items)::text);
  insert into public.supplier_operation_requests
    (shop_id, operation, request_id, actor_profile_id, payload_hash)
  values (p_shop_id, 'return', p_request_id, v_profile_id, v_hash) on conflict do nothing;
  select * into v_request from public.supplier_operation_requests
  where shop_id = p_shop_id and operation = 'return' and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_profile_id or v_request.payload_hash <> v_hash then
    raise exception 'SUPPLIER_REQUEST_CONFLICT' using errcode = '23505'; end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;
  select * into v_invoice from public.vendor_invoices where id = p_purchase_id
    and shop_id = p_shop_id and status = 'posted' for update;
  if not found or v_invoice.vendor_id is null then raise exception 'PURCHASE_RETURN_NOT_ELIGIBLE'; end if;
  perform batch.id from public.inventory_batches batch join public.vendor_invoice_items line
    on line.product_id = batch.product_id and line.vendor_invoice_id = p_purchase_id
  join jsonb_array_elements(v_items) item
    on (item ->> 'vendor_invoice_item_id')::uuid = line.id
  where batch.shop_id = p_shop_id and batch.source_type = 'vendor_invoice'
    and batch.source_id = p_purchase_id order by batch.product_id, batch.id for update of batch;
  v_total := 0;
  for v_item in select value from jsonb_array_elements(v_items) loop
    select line.* into v_line from public.vendor_invoice_items line
    where line.id = (v_item.value ->> 'vendor_invoice_item_id')::uuid
      and line.vendor_invoice_id = p_purchase_id;
    if not found then raise exception 'PURCHASE_RETURN_ITEM_NOT_FOUND'; end if;
    select * into v_batch from public.inventory_batches batch where batch.shop_id = p_shop_id
      and batch.source_type = 'vendor_invoice' and batch.source_id = p_purchase_id
      and batch.product_id = v_line.product_id for update;
    if not found then raise exception 'PURCHASE_BATCHES_MISSING'; end if;
    if (v_item.value ->> 'quantity')::numeric > v_batch.remaining_quantity then
      raise exception 'PURCHASE_RETURN_STOCK_UNAVAILABLE' using errcode = '23514'; end if;
    v_total := v_total + round((v_item.value ->> 'quantity')::numeric * v_line.unit_cost, 2);
  end loop;
  if v_total <= 0 then raise exception 'ZERO_VALUE_PURCHASE_RETURN_REQUIRES_EXPLICIT_CREDIT' using errcode = '23514'; end if;
  if v_total > shop_private.purchase_payable(p_purchase_id) then
    raise exception 'SUPPLIER_CREDIT_EXCEEDS_PAYABLE' using errcode = '23514'; end if;
  insert into public.purchase_returns (shop_id, vendor_id, vendor_invoice_id,
    vendor_name_snapshot, returned_at, reason, reference, total_amount, created_by_profile_id)
  values (p_shop_id, v_invoice.vendor_id, p_purchase_id, v_invoice.vendor_name_snapshot,
    p_returned_at, btrim(p_reason), nullif(btrim(p_reference), ''), v_total, v_profile_id)
  returning id into v_return_id;
  for v_item in select value from jsonb_array_elements(v_items) loop
    select line.* into v_line from public.vendor_invoice_items line
    where line.id = (v_item.value ->> 'vendor_invoice_item_id')::uuid;
    select * into v_batch from public.inventory_batches batch where batch.shop_id = p_shop_id
      and batch.source_type = 'vendor_invoice' and batch.source_id = p_purchase_id
      and batch.product_id = v_line.product_id for update;
    update public.inventory_batches set remaining_quantity = remaining_quantity
      - (v_item.value ->> 'quantity')::numeric where id = v_batch.id;
    insert into public.purchase_return_items (shop_id, purchase_return_id,
      vendor_invoice_item_id, product_id, inventory_batch_id, quantity, unit_cost, total_amount)
    values (p_shop_id, v_return_id, v_line.id, v_line.product_id, v_batch.id,
      (v_item.value ->> 'quantity')::numeric, v_line.unit_cost,
      round((v_item.value ->> 'quantity')::numeric * v_line.unit_cost, 2));
    insert into public.inventory_movements (shop_id, product_id, batch_id,
      quantity_change, movement_type, reference_id, created_by_profile_id, unit_cost_snapshot)
    values (p_shop_id, v_line.product_id, v_batch.id,
      -(v_item.value ->> 'quantity')::numeric, 'adjustment', v_return_id,
      v_profile_id, v_line.unit_cost);
  end loop;
  insert into public.supplier_credits (shop_id, vendor_id, vendor_invoice_id,
    purchase_return_id, vendor_name_snapshot, amount, effective_at, reason,
    reference, created_by_profile_id)
  values (p_shop_id, v_invoice.vendor_id, p_purchase_id, v_return_id,
    v_invoice.vendor_name_snapshot, v_total, p_returned_at, btrim(p_reason),
    nullif(btrim(p_reference), ''), v_profile_id) returning id into v_credit_id;
  update public.supplier_operation_requests set result_id = v_return_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'return' and request_id = p_request_id;
  return v_return_id;
end;
$$;

-- Extend the reviewed current shop_private.capture_sale_receipt_at_issue; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION shop_private.capture_sale_receipt_at_issue() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_settings public.shop_receipt_settings%rowtype;
  v_shop_name text;
  v_location public.shop_locations%rowtype;
  v_staff_name text;
  v_snapshot jsonb;
begin
  if old.status <> 'draft'::public.invoice_status
    or new.status <> 'issued'::public.invoice_status then return new; end if;
  select shop.name into v_shop_name from public.shops shop where shop.id = new.shop_id;
  select * into v_location from public.shop_locations location
  where location.id = new.location_id and location.shop_id = new.shop_id;
  select * into v_settings from public.shop_receipt_settings settings
  where settings.shop_id = new.shop_id;
  select coalesce(context.staff_name_snapshot, profile.display_name, profile.email_snapshot)
  into v_staff_name
  from public.invoices invoice
  left join public.pos_sale_contexts context on context.invoice_id = invoice.id
  left join public.profiles profile on profile.id = invoice.issued_by_profile_id
  where invoice.id = new.id;

  v_snapshot := jsonb_build_object(
    'version', 1,
    'tax', (select snapshot from public.sale_tax_snapshots where invoice_id=new.id),
    'presentation', jsonb_build_object(
      'documentLabel', v_settings.document_label,
      'referenceLabel', v_settings.reference_label,
      'language', coalesce(v_settings.document_language, 'ar'),
      'direction', coalesce(v_settings.document_direction, 'auto'),
      'showDescriptions', coalesce(v_settings.show_descriptions, true),
      'notes', v_settings.notes,
      'logoDataUrl', v_settings.logo_data_url
    ),
    'invoiceId', new.id,
    'invoiceNumber', new.invoice_number,
    'issuedAt', new.issued_at,
    'currency', new.currency,
    'business', jsonb_build_object(
      'name', coalesce(nullif(btrim(v_settings.display_name), ''), v_shop_name),
      'address', nullif(btrim(v_settings.address), ''),
      'phone', nullif(btrim(v_settings.phone), '')
    ),
    'location', jsonb_build_object(
      'name', v_location.name,
      'code', v_location.code,
      'address', v_location.address,
      'phone', v_location.phone
    ),
    'staffName', v_staff_name,
    'customer', jsonb_build_object(
      'name', new.client_name_snapshot,
      'phone', new.client_phone_snapshot
    ),
    'lines', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', item.id,
      'itemType', item.item_type,
      'name', item.item_name,
      'sku', item.product_sku_snapshot,
      'description', coalesce((select service.description from public.services service where service.id = item.service_id and service.shop_id = new.shop_id), item.product_sku_snapshot),
      'quantity', item.quantity,
      'measurement', item.measurement_snapshot,
      'unitPrice', item.unit_price,
      'discount', coalesce(item.discount_amount, 0),
      'total', item.total_amount
    ) order by item.line_order, item.id), '[]'::jsonb)
      from public.invoice_items item where item.invoice_id = new.id),
    'payments', '[]'::jsonb,
    'subtotal', coalesce((select (snapshot->>'net')::numeric+(snapshot->>'discountNet')::numeric from public.sale_tax_snapshots where invoice_id=new.id),new.total_amount+coalesce(new.discount_amount,0)),
    'discount', coalesce((select (snapshot->>'discountNet')::numeric from public.sale_tax_snapshots where invoice_id=new.id),coalesce(new.discount_amount,0)),
    'total', new.total_amount,
    'footer', nullif(btrim(v_settings.footer), ''),
    'paperSize', coalesce(v_settings.paper_size, 'thermal_80')
  );
  insert into public.sale_receipt_issue_snapshots (invoice_id, shop_id, location_id, snapshot)
  values (new.id, new.shop_id, new.location_id, v_snapshot)
  on conflict (invoice_id) do nothing;
  return new;
end;
$$;

-- Extend the reviewed current shop_private.capture_return_source; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION shop_private.capture_return_source() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare policy public.tax_policy_versions%rowtype; lines jsonb; total numeric;
begin
 if old.status<>'draft' or new.status<>'issued' or exists(select 1 from public.sale_tax_snapshots where invoice_id=new.id) then return new;end if;
 select * into policy from public.tax_policy_versions where shop_id=new.shop_id and effective_at<=statement_timestamp() order by effective_at desc,created_at desc,id desc limit 1;
 if coalesce((policy.policy->>'enabled')::boolean,false) then return new;end if;
 select jsonb_agg(jsonb_build_object('id',l.id,'itemType',l.item_type,'originalQuantity',l.quantity,'originalUnitPrice',l.unit_price,'measurement',l.measurement_snapshot,
  'lineDiscount',l.discount_amount,'total',l.total_amount,'net',l.total_amount,'tax',0,'treatment','calculation-disabled') order by l.line_order,l.id),sum(l.total_amount)
 into lines,total from public.invoice_items l where l.invoice_id=new.id;
 if lines is null or total<>new.total_amount then return new;end if;
 insert into public.sale_return_sources(invoice_id,shop_id,location_id,snapshot)
 values(new.id,new.shop_id,new.location_id,jsonb_build_object('version',1,'source','forward-disabled-calculation','currency',new.currency,
  'calculationEnabled',false,'policyVersionId',policy.id,'total',total,'net',total,'tax',0,'lines',lines));
 return new;
end;$$;

-- Extend the reviewed current shop_private.capture_tax_at_issue; existing grants/authorization retained.
CREATE OR REPLACE FUNCTION shop_private.capture_tax_at_issue() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare policy public.tax_policy_versions%rowtype; snapshot jsonb; line jsonb;
begin
 if old.status<>'draft' or new.status<>'issued' then return new; end if;
 perform shop_private.assert_location_access(new.shop_id,new.location_id,true);
 perform 1 from public.shops where id=new.shop_id for update;
 select * into policy from public.tax_policy_versions where shop_id=new.shop_id and effective_at<=statement_timestamp()
 order by effective_at desc,created_at desc,id desc limit 1;
 -- Unconfigured/disabled shops keep every existing arithmetic path unchanged.
 if not coalesce((policy.policy->>'enabled')::boolean,false) and new.tax_order_discount=0 then return new; end if;
 snapshot:=shop_private.calculate_tax((select jsonb_agg(jsonb_build_object('id',id,'itemType',item_type,
 'sourceId',coalesce(product_id,service_id),'quantity',quantity,'unitPrice',unit_price,'lineDiscount',discount_amount)
 order by line_order,id) from public.invoice_items where invoice_id=new.id),policy.policy,new.tax_order_discount)
 ||jsonb_build_object('currency',new.currency,'policyVersionId',policy.id,'effectiveAt',policy.effective_at);
 snapshot:=jsonb_set(snapshot,'{lines}',(select jsonb_agg(e||jsonb_build_object('measurement',i.measurement_snapshot) order by n) from jsonb_array_elements(snapshot->'lines') with ordinality a(e,n) join public.invoice_items i on i.id=(e->>'id')::uuid));
 for line in select value from jsonb_array_elements(snapshot->'lines') loop
 update public.invoice_items set total_amount=(line->>'total')::numeric where id=(line->>'id')::uuid and invoice_id=new.id;
 end loop;
 new.total_amount:=(snapshot->>'total')::numeric;
 new.discount_amount:=new.discount_amount+new.tax_order_discount;
 insert into public.sale_tax_snapshots(invoice_id,shop_id,location_id,policy_version_id,snapshot)
 values(new.id,new.shop_id,new.location_id,policy.id,snapshot);
 return new;
end; $$;

-- Extend the reviewed current shop_private.list_products; existing grants/authorization retained.
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
      or coalesce(category.name, '') ilike '%' || v_search || '%');
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.name, rows.id), '[]'::jsonb)
  into v_items from (select product.id, product.name, product.sku, product.barcode,
      product.sale_price, product.base_unit_code,product.quantity_increment,product.measurement_status,product.measurement_revision,product.sale_unit_codes, product.category_id, category.name category_name, product.created_at
    from public.products product left join public.catalog_categories category on category.id = product.category_id
    where product.shop_id = p_shop_id and product.is_active
      and (p_category_id is null or product.category_id = p_category_id)
      and (v_search is null or product.name ilike '%' || v_search || '%'
        or coalesce(product.sku, '') ilike '%' || v_search || '%'
        or coalesce(product.barcode, '') ilike '%' || v_search || '%'
        or coalesce(category.name, '') ilike '%' || v_search || '%')
    order by lower(product.name), product.id offset (p_page - 1) * p_page_size limit p_page_size) rows;
  return jsonb_build_object('items', v_items, 'total', v_total, 'page', p_page, 'pageSize', p_page_size,'supportsMeasurements',true);
end;
$$;


-- Shared internal read projection; exposed only through permission-checked RPCs.
create function shop_private.pos_measurement(p_shop_id uuid,p_product_id uuid) returns jsonb language sql stable set search_path='' as $$
 select case when p.measurement_status='active' then jsonb_build_object('baseUnitCode',p.base_unit_code,'increment',trim_scale(p.quantity_increment)::text,'revision',p.measurement_revision,'saleUnits',p.sale_unit_codes,'baseUnitPrice',trim_scale(p.sale_price)::text,
 'packages',(select coalesce(jsonb_agg(jsonb_build_object('id',k.id,'code',k.code,'name',k.name,'unitCode',k.unit_code,'baseQuantity',trim_scale(k.base_quantity)::text,'containedQuantity',trim_scale(k.contained_quantity)::text,'containedUnitCode',k.contained_unit_code,'version',k.version,'salePrice',k.sale_price,'barcode',k.barcode,'canSell',k.can_sell,'canPurchase',k.can_purchase,'defaultSale',k.default_sale,'defaultPurchase',k.default_purchase) order by k.name,k.id),'[]') from public.product_packagings k where k.shop_id=p.shop_id and k.product_id=p.id and k.active)) else null end from public.products p where p.shop_id=p_shop_id and p.id=p_product_id;
$$;
revoke all on function shop_private.pos_measurement(uuid,uuid) from public,anon,authenticated,service_role;

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
      coalesce((select sum(batch.remaining_quantity) from public.inventory_batches batch
        where batch.shop_id = p_shop_id and batch.location_id = p_location_id
          and batch.product_id = product.id), 0) stock,
      product.category_id, category.name category_name
    from public.products product left join public.catalog_categories category on category.id = product.category_id
    where product.shop_id = p_shop_id and product.is_active and v_mode in ('product', 'mixed')
      and (p_item_type is null or p_item_type = 'product')
      and (p_category_id is null or product.category_id = p_category_id)
      and (v_barcode is null or product.barcode = v_barcode or exists(select 1 from public.product_packagings k where k.shop_id=product.shop_id and k.product_id=product.id and k.active and k.can_sell and k.barcode=v_barcode))
      and (v_search is null or product.name ilike '%' || v_search || '%'
        or coalesce(product.sku, '') ilike '%' || v_search || '%'
        or coalesce(product.barcode, '') ilike '%' || v_search || '%'
        or coalesce(category.name, '') ilike '%' || v_search || '%')
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
  select coalesce(jsonb_agg(e||jsonb_build_object('measurement',shop_private.pos_measurement(p_shop_id,(e->>'id')::uuid))||coalesce((select jsonb_build_object('unitSelection','package:'||k.id::text,'unitPrice',coalesce(k.sale_price,(e->>'unitPrice')::numeric*k.base_quantity),'barcode',k.barcode) from public.product_packagings k where k.shop_id=p_shop_id and k.product_id=(e->>'id')::uuid and k.active and k.can_sell and k.barcode=v_barcode),'{}') order by n),'[]') into v_items from jsonb_array_elements(v_items) with ordinality a(e,n);
  return jsonb_build_object('items', v_items, 'total', v_total, 'page', p_page,
    'pageSize', p_page_size, 'businessMode', v_mode,
    'ambiguousBarcode', v_barcode is not null and v_total > 1);
end;
$$;

CREATE OR REPLACE FUNCTION shop_private.match_catalog_offers(p_shop_id uuid, p_lines jsonb, p_allowed uuid[] DEFAULT NULL::uuid[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare remaining jsonb:='{}'; entry jsonb; recipe jsonb; offer public.shop_catalog_offers%rowtype; source record;
 key text; qty numeric; count_sets numeric; old_price numeric; savings numeric; discount numeric:=0; matched jsonb:='[]'; eligible boolean; resolved jsonb;
begin
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'INVALID_OFFER_CART' using errcode='22023'; end if;
 for entry in select value from jsonb_array_elements(p_lines) loop
 if entry->>'item_type'='product' then
 resolved:=shop_private.resolve_measured_line(p_shop_id,(entry->>'source_id')::uuid,entry);
 if resolved#>>'{measurement,packageId}' is not null then continue;end if;
 qty:=(resolved->>'baseQuantity')::numeric;
 else qty:=(entry->>'quantity')::numeric;end if;
 key:=(entry->>'item_type')||':'||(entry->>'source_id');
 if key is null or qty is null or qty not between 0.000001 and 1000000 or round(qty,6)<>qty then raise exception 'INVALID_OFFER_CART' using errcode='22023'; end if;
 remaining:=jsonb_set(remaining,array[key],to_jsonb(coalesce((remaining->>key)::numeric,0)+qty));
 end loop;
 for offer in select * from public.shop_catalog_offers o where o.shop_id=p_shop_id and o.active
 and (o.starts_at is null or o.starts_at<=statement_timestamp()) and (o.ends_at is null or o.ends_at>statement_timestamp())
 and (p_allowed is null or o.id=any(p_allowed)) order by o.priority,o.created_at,o.id loop
 count_sets:=1000000; old_price:=0; eligible:=true;
 for recipe in select value from jsonb_array_elements(offer.lines) loop
 key:=(recipe->>'kind')||':'||(recipe->>'sourceId'); qty:=(recipe->>'quantity')::numeric;
 select * into source from shop_private.offer_sources(p_shop_id) where id=(recipe->>'sourceId')::uuid and kind=recipe->>'kind';
 if not found then eligible:=false; exit; end if;
 count_sets:=least(count_sets,floor(coalesce((remaining->>key)::numeric,0)/qty));
 old_price:=old_price+round((source.price-source.discount)*qty,2);
 end loop;
 savings:=round(old_price-offer.price,2);
 if not eligible or count_sets<1 or savings<=0 then continue; end if;
 for recipe in select value from jsonb_array_elements(offer.lines) loop
 key:=(recipe->>'kind')||':'||(recipe->>'sourceId');
 remaining:=jsonb_set(remaining,array[key],to_jsonb((remaining->>key)::numeric-(recipe->>'quantity')::numeric*count_sets));
 end loop;
 discount:=discount+savings*count_sets;
 matched:=matched||jsonb_build_array(jsonb_build_object('id',offer.id,'name',offer.name,'revision',offer.revision,'quantity',count_sets,'price',offer.price,'oldPrice',old_price,'saving',savings*count_sets));
 end loop;
 return jsonb_build_object('discount',discount,'offers',matched);
end; $$;
create or replace function shop_private.guard_prepared_measurement_stock() returns trigger
language plpgsql security definer set search_path='' as $$declare p public.products%rowtype;target_shop uuid;begin
 if tg_table_name='vendor_invoice_items' then select shop_id into target_shop from public.vendor_invoices where id=new.vendor_invoice_id;else target_shop:=new.shop_id;end if;
 if new.product_id is null then return new;end if;
 select * into p from public.products where id=new.product_id and shop_id=target_shop for share;
 if p.measurement_status='prepared' then raise exception 'MEASUREMENT_WORKFLOW_NOT_READY' using errcode='55000';end if;
 if p.measurement_status<>'active' then return new;end if;
 if tg_table_name='inventory_batches' then
 perform shop_private.assert_measured_quantity(target_shop,p.id,new.quantity_received);
 perform shop_private.assert_measured_quantity(target_shop,p.id,new.remaining_quantity,true);
 elsif tg_table_name='inventory_movements' then perform shop_private.assert_measured_quantity(target_shop,p.id,new.quantity_change);
 elsif tg_table_name='stock_counts' then perform shop_private.assert_measured_quantity(target_shop,p.id,new.counted_quantity,true);
 else
 perform shop_private.assert_measured_quantity(target_shop,p.id,new.quantity);
 if new.measurement_snapshot is null or new.measurement_snapshot='null'::jsonb or (new.measurement_snapshot->>'baseQuantity')::numeric<>new.quantity
 or new.measurement_snapshot->>'baseUnitCode' is distinct from p.base_unit_code then raise exception 'MEASUREMENT_SNAPSHOT_REQUIRED' using errcode='55000';end if;
 end if;
 return new;
end;$$;
create or replace function shop_private.guard_prepared_measurement_threshold() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.reorder_threshold is distinct from old.reorder_threshold then perform shop_private.assert_measured_quantity(new.shop_id,new.id,new.reorder_threshold,true);end if;
 return new;
end;$$;

-- Unit and package snapshots enter the same trusted quote used by existing POS.
create or replace function public.quote_sale_tax(p_shop_id uuid,p_location_id uuid,p_lines jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare policy jsonb;lines jsonb:='[]';item jsonb;price numeric;discount numeric;qty numeric;r jsonb;begin
 perform shop_private.assert_sale_read_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'INVALID_TAX_INPUT' using errcode='22023';end if;
 select p.policy into policy from public.tax_policy_versions p where shop_id=p_shop_id and effective_at<=statement_timestamp() order by effective_at desc,created_at desc,id desc limit 1;
 for item in select value from jsonb_array_elements(p_lines) loop
 qty:=(item->>'quantity')::numeric;r:=null;
 if item->>'item_type'='product' then
 r:=shop_private.resolve_measured_line(p_shop_id,(item->>'source_id')::uuid,item);
 qty:=(r->>'baseQuantity')::numeric;price:=(r->>'baseUnitPrice')::numeric;discount:=0;
 elsif item->>'item_type'='service' then
 select base_sale_price,round((case default_discount_type when 'percent' then round(base_sale_price*default_discount_value/100,2) else default_discount_value end)*qty,2)
 into price,discount from public.services where id=(item->>'source_id')::uuid and shop_id=p_shop_id and is_active;
 else raise exception 'UNSUPPORTED_SALE_LINE_TYPE' using errcode='22023';end if;
 if price is null then raise exception 'TAX_ITEM_NOT_FOUND' using errcode='P0002';end if;
 lines:=lines||jsonb_build_array(jsonb_build_object('itemType',item->>'item_type','sourceId',item->>'source_id','quantity',qty,'unitPrice',price,'lineDiscount',discount,'measurement',r->'measurement'));
 end loop;
 return shop_private.calculate_tax(lines,policy,0);
end;$$;
create or replace function public.quote_pos_sale(p_shop_id uuid,p_location_id uuid,p_lines jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare base jsonb;matched jsonb;policy jsonb;begin
 base:=public.quote_sale_tax(p_shop_id,p_location_id,p_lines);
 matched:=shop_private.match_catalog_offers(p_shop_id,p_lines);
 if (matched->>'discount')::numeric=0 then return base||matched;end if;
 select p.policy into policy from public.tax_policy_versions p where shop_id=p_shop_id and effective_at<=statement_timestamp() order by effective_at desc,created_at desc,id desc limit 1;
 return shop_private.calculate_tax(base->'lines',policy,(matched->>'discount')::numeric)||matched;
end;$$;

-- Atomic catalog save: optional measurement settings participate in the same
-- transaction as the existing image/category/product mutation.
alter function shop_private.catalog_media(uuid,text,jsonb) rename to catalog_media_before_measurements;
revoke all on function shop_private.catalog_media_before_measurements(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function shop_private.catalog_media(p_shop_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 result:=shop_private.catalog_media_before_measurements(p_shop_id,p_action,p_payload);
 if p_action='save_product' and (p_payload->>'p_measurement_enabled')::boolean is true then
 perform shop_private.configure_product_measurement(p_shop_id,(result#>>'{}')::uuid,p_payload->>'p_base_unit_code',p_payload->>'p_quantity_increment',p_payload->'p_sale_unit_codes',p_payload->>'p_measurement_reason');end if;
 return result;
end;$$;
revoke all on function shop_private.catalog_media(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function shop_private.catalog_media(uuid,text,jsonb) to authenticated;

-- A dedicated read projection has product permissions, not cost/margin access.
create function public.product_measurement_options(p_shop_id uuid,p_product_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare p public.products%rowtype;begin
 if not shop_private.has_permission(p_shop_id,'products.view') then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501';end if;
 select * into p from public.products where shop_id=p_shop_id and id=p_product_id;
 if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
 return jsonb_build_object('baseUnitCode',p.base_unit_code,'increment',trim_scale(p.quantity_increment)::text,'revision',p.measurement_revision,'status',p.measurement_status,'saleUnits',p.sale_unit_codes,
 'packages',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'unitCode',unit_code,'baseQuantity',trim_scale(base_quantity)::text,'containedQuantity',trim_scale(contained_quantity)::text,'containedUnitCode',contained_unit_code,'version',version,'salePrice',sale_price,'barcode',barcode,'canSell',can_sell,'canPurchase',can_purchase,'defaultSale',default_sale,'defaultPurchase',default_purchase) order by name,id),'[]') from public.product_packagings where shop_id=p_shop_id and product_id=p.id and active),
 'locked',exists(select 1 from public.inventory_batches where product_id=p.id) or exists(select 1 from public.invoice_items where product_id=p.id) or exists(select 1 from public.vendor_invoice_items where product_id=p.id) or exists(select 1 from public.service_material_units where product_id=p.id) or exists(select 1 from public.product_packagings where product_id=p.id));
end;$$;
revoke all on function public.product_measurement_options(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.product_measurement_options(uuid,uuid) to authenticated;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.get_purchase(uuid,uuid)'::regprocedure) is distinct from '0a825f1734c13469f94f8efb75fcf22e' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.get_purchase' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.get_purchase(p_shop_id uuid, p_purchase_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_result jsonb; v_access record;
begin
  perform shop_private.assert_supplier_read_access(p_shop_id);
  select * into v_access from shop_private.supplier_access(p_shop_id);
  select jsonb_build_object(
    'id', invoice.id, 'vendorId', invoice.vendor_id,
    'vendorNameSnapshot', invoice.vendor_name_snapshot,
    'invoiceNumber', invoice.invoice_number, 'status', invoice.status,
    'issuedAt', invoice.issued_at, 'totalAmount', invoice.total_amount,
    'payable', shop_private.purchase_payable(invoice.id),
    'settlementState', case when shop_private.purchase_payable(invoice.id) = 0 then 'paid'
      when shop_private.purchase_payable(invoice.id) = invoice.total_amount then 'unpaid' else 'partial' end,
    'notes', invoice.notes, 'createdAt', invoice.created_at,
    'canManageSuppliers', v_access.can_manage_suppliers,
    'canManagePurchases', v_access.can_manage_purchases,
    'canRecordPayment', v_access.can_record_payment,
    'canReversePayment', v_access.can_reverse_payment,
    'canRecordCredit', v_access.can_record_credit,
    'canReturnStock', v_access.can_return_stock,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', item.id, 'productId', item.product_id, 'productName', product.name,
      'quantity', item.quantity, 'unitCost', item.unit_cost, 'measurement',item.measurement_snapshot,
      'totalCost', item.total_cost, 'availableToReturn', coalesce(batch.remaining_quantity, 0),
      'batchId', batch.id) order by item.id), '[]'::jsonb)
      from public.vendor_invoice_items item join public.products product on product.id = item.product_id
      left join public.inventory_batches batch on batch.shop_id = p_shop_id
        and batch.source_type = 'vendor_invoice' and batch.source_id = invoice.id
        and batch.product_id = item.product_id where item.vendor_invoice_id = invoice.id),
    'paymentEvents', (select coalesce(jsonb_agg(event order by event ->> 'eventAt', event ->> 'id'), '[]'::jsonb)
      from (
        select jsonb_build_object('id', allocation.id, 'eventType', 'payment',
          'paymentId', payment.id, 'allocationId', allocation.id,
          'amount', allocation.amount, 'eventAt', payment.paid_at,
          'method', payment.method, 'reference', payment.reference,
          'notes', payment.notes, 'actorProfileId', payment.created_by_profile_id,
          'remainingEffective', shop_private.supplier_allocation_remaining(allocation.id)) event
        from public.supplier_payment_allocations allocation join public.payments payment
          on payment.id = allocation.payment_id where allocation.vendor_invoice_id = invoice.id
        union all
        select jsonb_build_object('id', reversal.id, 'eventType', 'reversal',
          'paymentId', reversal.original_payment_id,
          'allocationId', reversal.original_allocation_id, 'amount', reversal.amount,
          'eventAt', reversal.effective_at, 'reference', reversal.reference,
          'reason', reversal.reason, 'actorProfileId', reversal.created_by_profile_id)
        from public.supplier_payment_reversals reversal
        join public.supplier_payment_allocations allocation
          on allocation.id = reversal.original_allocation_id
        where allocation.vendor_invoice_id = invoice.id
      ) events),
    'credits', (select coalesce(jsonb_agg(jsonb_build_object('id', credit.id,
      'amount', credit.amount, 'effectiveAt', credit.effective_at,
      'reason', credit.reason, 'reference', credit.reference,
      'purchaseReturnId', credit.purchase_return_id,
      'actorProfileId', credit.created_by_profile_id) order by credit.effective_at, credit.id), '[]'::jsonb)
      from public.supplier_credits credit where credit.vendor_invoice_id = invoice.id),
    'returns', (select coalesce(jsonb_agg(jsonb_build_object('id', return_doc.id,
      'returnedAt', return_doc.returned_at, 'reason', return_doc.reason,
      'reference', return_doc.reference, 'totalAmount', return_doc.total_amount,
      'items', (select coalesce(jsonb_agg(jsonb_build_object('id', return_item.id,
        'productId', return_item.product_id, 'quantity', return_item.quantity,
        'unitCost', return_item.unit_cost, 'totalAmount', return_item.total_amount,
        'batchId', return_item.inventory_batch_id) order by return_item.id), '[]'::jsonb)
        from public.purchase_return_items return_item
        where return_item.purchase_return_id = return_doc.id))
      order by return_doc.returned_at, return_doc.id), '[]'::jsonb)
      from public.purchase_returns return_doc where return_doc.vendor_invoice_id = invoice.id),
    'receiptMovements', (select coalesce(jsonb_agg(jsonb_build_object('id', movement.id,
      'productId', movement.product_id, 'batchId', movement.batch_id,
      'quantityChange', movement.quantity_change,
      'unitCostSnapshot', movement.unit_cost_snapshot,
      'createdAt', movement.created_at, 'referenceId', movement.reference_id)
      order by movement.created_at, movement.id), '[]'::jsonb)
      from public.inventory_movements movement join public.inventory_batches batch
        on batch.id = movement.batch_id where movement.shop_id = p_shop_id
        and batch.source_type = 'vendor_invoice' and batch.source_id = invoice.id)
  ) into v_result from public.vendor_invoices invoice
  where invoice.id = p_purchase_id and invoice.shop_id = p_shop_id;
  return v_result;
end;
$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.pos_catalog_offers(uuid,uuid)'::regprocedure) is distinct from '93236d005cb139b355af43ae06753037' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: public.pos_catalog_offers' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION public.pos_catalog_offers(p_shop_id uuid, p_location_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare items jsonb;
begin
 perform shop_private.assert_sale_read_access(p_shop_id);
 perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 select coalesce(jsonb_agg(shop_private.offer_projection(p_shop_id,o.id)||jsonb_build_object('lines',(select jsonb_agg(l||jsonb_build_object('measurement',case when l->>'kind'='product' then shop_private.pos_measurement(p_shop_id,(l->>'sourceId')::uuid) else null end,'stock',case when l->>'kind'='product' then coalesce((select sum(b.remaining_quantity) from public.inventory_batches b where b.shop_id=p_shop_id and b.location_id=p_location_id and b.product_id=(l->>'sourceId')::uuid),0) else null end) order by n) from jsonb_array_elements(shop_private.offer_projection(p_shop_id,o.id)->'lines') with ordinality a(l,n))) order by priority,created_at,id),'[]'::jsonb) into items from public.shop_catalog_offers o
 where shop_id=p_shop_id and active and (starts_at is null or starts_at<=statement_timestamp()) and (ends_at is null or ends_at>statement_timestamp())
 and not exists(select 1 from jsonb_array_elements(o.lines) l where not exists(select 1 from shop_private.offer_sources(p_shop_id) s where s.id::text=l->>'sourceId' and s.kind=l->>'kind'));
 return items;
end; $$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.list_inventory(uuid,boolean)'::regprocedure) is distinct from '40cd6e17ffdce8ecd6a5a7f4e11d4c59' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: list_inventory' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.list_inventory(p_shop_id uuid, p_low_stock_only boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_result jsonb;
begin
  perform shop_private.assert_inventory_read_access(p_shop_id);
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(item) order by item.is_low_stock desc,
      item.is_active desc, item.name, item.product_id), '[]'::jsonb),
    'total_valuation', coalesce(sum(item.inventory_value), 0),
    'low_stock_count', count(*) filter (where item.is_low_stock)
  ) into v_result
  from (
    select product.id as product_id, product.name, product.sku,
      product.sale_price, product.is_active, product.reorder_threshold, product.base_unit_code, product.quantity_increment, product.measurement_status,
      coalesce(sum(batch.remaining_quantity), 0)::numeric as quantity_on_hand,
      coalesce(sum(batch.remaining_quantity * batch.unit_cost), 0)::numeric
        as inventory_value,
      (product.is_active and product.reorder_threshold > 0
        and coalesce(sum(batch.remaining_quantity), 0)
          <= product.reorder_threshold) as is_low_stock
    from public.products product
    left join public.inventory_batches batch
      on batch.shop_id = product.shop_id and batch.product_id = product.id
    where product.shop_id = p_shop_id
      and (
        product.is_active
        or exists (select 1 from public.inventory_batches historical_batch
          where historical_batch.shop_id = product.shop_id
            and historical_batch.product_id = product.id)
        or exists (select 1 from public.inventory_movements movement
          where movement.shop_id = product.shop_id
            and movement.product_id = product.id)
        or exists (select 1 from public.stock_counts stock_count
          where stock_count.shop_id = product.shop_id
            and stock_count.product_id = product.id)
      )
    group by product.id
  ) item
  where not coalesce(p_low_stock_only, false) or item.is_low_stock;
  return coalesce(v_result, jsonb_build_object(
    'items', '[]'::jsonb, 'total_valuation', 0, 'low_stock_count', 0
  ));
end;
$$;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.catalog_import(uuid,uuid,text,jsonb,boolean)'::regprocedure) is distinct from 'ff0e75d80e41b50f4eaa10e5dbdfedd6' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.catalog_import' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.catalog_import(p_request_id uuid, p_shop_id uuid, p_kind text, p_rows jsonb, p_dry_run boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_profile uuid; v_row jsonb; v_ordinal bigint; v_errors jsonb := '[]'::jsonb;
  v_result jsonb; v_hash text; v_existing public.catalog_import_requests%rowtype;
  v_name text; v_email text; v_phone text; v_sku text; v_barcode text;
  v_category text; v_supplier text; v_price numeric; v_stock numeric; v_cost numeric;
  v_product_id uuid; v_category_id uuid; v_vendor_id uuid; v_match_a uuid; v_match_b uuid;
  v_count_a integer; v_count_b integer; v_unit text; v_increment text; v_measured boolean; v_existing_product public.products%rowtype;
  v_created integer := 0; v_updated integer := 0; v_stocked integer := 0; v_limit integer;
begin
  if p_request_id is null or p_kind not in ('products', 'customers', 'suppliers')
    or p_rows is null or jsonb_typeof(p_rows) <> 'array'
    or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 1000 then
    raise exception 'INVALID_IMPORT' using errcode = '22023';
  end if;
  if p_kind = 'products' then
    v_profile := shop_private.assert_shop_write_access(p_shop_id, 'products.manage');
  elsif p_kind = 'customers' then
    v_profile := shop_private.assert_shop_write_access(p_shop_id, 'clients.manage');
  else
    v_profile := shop_private.assert_shop_write_access(p_shop_id, 'vendors.manage');
    perform shop_private.assert_purchase_entitlement(p_shop_id);
  end if;
  v_hash := md5(p_kind || ':' || p_rows::text);
  if not p_dry_run then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
    select * into v_existing from public.catalog_import_requests where request_id = p_request_id;
    if found then
      if v_existing.shop_id = p_shop_id and v_existing.import_kind = p_kind
        and v_existing.payload_hash = v_hash then return v_existing.result; end if;
      raise exception 'IMPORT_REQUEST_CONFLICT' using errcode = '23505';
    end if;
  end if;

  for v_row, v_ordinal in select value, ordinality from jsonb_array_elements(p_rows) with ordinality loop
    v_name := nullif(btrim(v_row->>'name'), '');
    v_email := nullif(lower(btrim(v_row->>'email')), '');
    v_phone := nullif(btrim(v_row->>'phone'), '');
    if v_name is null or length(v_name) < 2 or length(v_name) > 160 then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'name', 'code', 'INVALID_NAME'));
    end if;
    if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+$') then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'email', 'code', 'INVALID_EMAIL'));
    end if;
    if p_kind = 'products' then
      v_sku := nullif(btrim(v_row->>'sku'), ''); v_barcode := nullif(btrim(v_row->>'barcode'), '');
      v_category := nullif(btrim(v_row->>'category'), ''); v_supplier := nullif(btrim(v_row->>'supplier'), '');
      if length(coalesce(v_sku, '')) > 80 or length(coalesce(v_barcode, '')) > 80 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'sku/barcode', 'code', 'IDENTIFIER_TOO_LONG'));
      end if;
      v_unit:=nullif(btrim(v_row->>'base_unit_code'),'');v_increment:=coalesce(nullif(btrim(v_row->>'quantity_increment'),''),'1');v_measured:=v_unit is not null;
      begin v_price := (v_row->>'sale_price')::numeric; exception when others then v_price := null; end;
      begin v_stock := coalesce(nullif(v_row->>'opening_stock', '')::numeric, 0); exception when others then v_stock := null; end;
      begin v_cost := coalesce(nullif(v_row->>'opening_cost', '')::numeric, 0); exception when others then v_cost := null; end;
      if v_price is null or v_price < 0 or v_price > 999999999.99 or round(v_price, case when v_measured then 6 else 2 end) <> v_price then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'sale_price', 'code', 'INVALID_PRICE'));
      end if;
      if v_stock is null or v_stock < 0 or v_stock > 1000000 or round(v_stock, case when v_measured then 6 else 3 end) <> v_stock
        or v_cost is null or v_cost < 0 or v_cost > 999999999.99 or round(v_cost, case when v_measured then 6 else 2 end) <> v_cost then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'opening_stock', 'code', 'INVALID_OPENING_STOCK'));
      end if;
      select product.id into v_match_a from public.products product where product.shop_id = p_shop_id
        and product.is_active and v_sku is not null and lower(product.sku) = lower(v_sku);
      select product.id into v_match_b from public.products product where product.shop_id = p_shop_id
        and product.is_active and v_barcode is not null and lower(product.barcode) = lower(v_barcode);
      if v_match_a is not null and v_match_b is not null and v_match_a <> v_match_b then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'sku/barcode', 'code', 'IDENTIFIER_CONFLICT'));
      end if;
      if exists(select 1 from public.product_packagings k where k.shop_id=p_shop_id and k.active and k.barcode=v_barcode) then
        v_errors:=v_errors||jsonb_build_array(jsonb_build_object('row',v_ordinal+1,'field','barcode','code','BARCODE_IDENTITY_CONFLICT'));
      end if;
      select * into v_existing_product from public.products where id=coalesce(v_match_a,v_match_b) and shop_id=p_shop_id;
      if not v_measured and v_existing_product.measurement_status='active' then
        v_errors:=v_errors||jsonb_build_array(jsonb_build_object('row',v_ordinal+1,'field','base_unit_code','code','MEASUREMENT_CONTEXT_REQUIRED'));
      end if;
      if v_measured then
        begin
          if v_increment !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' then raise exception 'INVALID_MEASUREMENT_INCREMENT' using errcode='22023';end if;
          perform shop_private.convert_measurement(v_increment::numeric,v_unit,v_unit,v_increment::numeric);
          if v_stock>0 then perform shop_private.convert_measurement(v_stock,v_unit,v_unit,v_increment::numeric);end if;
          if v_existing_product.id is not null and not(v_existing_product.measurement_status='active' and v_existing_product.base_unit_code=v_unit and v_existing_product.quantity_increment=v_increment::numeric)
            and (exists(select 1 from public.inventory_batches where product_id=v_existing_product.id)
              or exists(select 1 from public.invoice_items where product_id=v_existing_product.id)
              or exists(select 1 from public.vendor_invoice_items where product_id=v_existing_product.id)
              or exists(select 1 from public.inventory_movements where product_id=v_existing_product.id)
              or exists(select 1 from public.stock_counts where product_id=v_existing_product.id)
              or exists(select 1 from public.product_packagings where product_id=v_existing_product.id)
              or exists(select 1 from public.service_material_units where product_id=v_existing_product.id)) then
            raise exception 'MEASUREMENT_REQUIRES_UNUSED_PRODUCT' using errcode='55000';end if;
        exception when invalid_text_representation or numeric_value_out_of_range or sqlstate '22023' or sqlstate '55000' then
          v_errors:=v_errors||jsonb_build_array(jsonb_build_object('row',v_ordinal+1,'field','base_unit_code/quantity_increment','code',sqlerrm));
        end;
      end if;
      if v_category is not null and (length(v_category) < 2 or length(v_category) > 80) then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'category', 'code', 'INVALID_CATEGORY'));
      end if;
      if v_supplier is not null then
        select count(*) into v_count_a from public.vendors vendor where vendor.shop_id = p_shop_id
          and vendor.is_active and lower(vendor.name) = lower(v_supplier);
        if v_count_a = 0 then v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'supplier', 'code', 'SUPPLIER_NOT_FOUND'));
        elsif v_count_a > 1 then v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'supplier', 'code', 'SUPPLIER_AMBIGUOUS')); end if;
      end if;
      if v_stock > 0 and not exists (select 1 from shop_private.inventory_access(p_shop_id) access where access.can_manage and access.inventory_enabled) then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'opening_stock', 'code', 'INVENTORY_NOT_AVAILABLE'));
      end if;
    elsif p_kind = 'customers' then
      if length(coalesce(v_phone, '')) > 50 or length(coalesce(btrim(v_row->>'address'), '')) > 500
        or length(coalesce(btrim(v_row->>'notes'), '')) > 2000 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'contact', 'code', 'INVALID_CUSTOMER'));
      end if;
      select client.id into v_match_a from public.clients client where client.shop_id = p_shop_id and client.is_active
        and v_email is not null and lower(client.email) = v_email order by client.id limit 1;
      select client.id into v_match_b from public.clients client where client.shop_id = p_shop_id and client.is_active
        and v_phone is not null and client.phone = v_phone order by client.id limit 1;
      select count(*) into v_count_a from public.clients client where client.shop_id = p_shop_id and client.is_active and v_email is not null and lower(client.email) = v_email;
      select count(*) into v_count_b from public.clients client where client.shop_id = p_shop_id and client.is_active and v_phone is not null and client.phone = v_phone;
      if v_count_a > 1 or v_count_b > 1 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'email/phone', 'code', 'DEDUPLICATION_AMBIGUOUS'));
      elsif v_match_a is not null and v_match_b is not null and v_match_a <> v_match_b then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'email/phone', 'code', 'DEDUPLICATION_CONFLICT'));
      end if;
    else
      if length(coalesce(v_phone, '')) > 40 or length(coalesce(btrim(v_row->>'contact_name'), '')) > 160
        or length(coalesce(btrim(v_row->>'address'), '')) > 500 or length(coalesce(btrim(v_row->>'tax_number'), '')) > 80
        or length(coalesce(btrim(v_row->>'notes'), '')) > 1000 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'contact', 'code', 'INVALID_SUPPLIER'));
      end if;
      select vendor.id into v_match_a from public.vendors vendor where vendor.shop_id = p_shop_id and vendor.is_active
        and v_email is not null and lower(vendor.email) = v_email order by vendor.id limit 1;
      select vendor.id into v_match_b from public.vendors vendor where vendor.shop_id = p_shop_id and vendor.is_active
        and v_phone is not null and vendor.phone = v_phone order by vendor.id limit 1;
      select count(*) into v_count_a from public.vendors vendor where vendor.shop_id = p_shop_id and vendor.is_active and v_email is not null and lower(vendor.email) = v_email;
      select count(*) into v_count_b from public.vendors vendor where vendor.shop_id = p_shop_id and vendor.is_active and v_phone is not null and vendor.phone = v_phone;
      if v_count_a > 1 or v_count_b > 1 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'email/phone', 'code', 'DEDUPLICATION_AMBIGUOUS'));
      elsif v_match_a is not null and v_match_b is not null and v_match_a <> v_match_b then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_ordinal + 1, 'field', 'email/phone', 'code', 'DEDUPLICATION_CONFLICT'));
      end if;
    end if;
  end loop;

  if p_kind = 'products' then
    if exists (select 1
      from jsonb_array_elements(p_rows) with ordinality a(value, ordinal)
      join jsonb_array_elements(p_rows) with ordinality b(value, ordinal)
        on a.ordinal < b.ordinal
      where nullif(lower(btrim(a.value->>'sku')), '') is not null
        and lower(btrim(a.value->>'sku')) = lower(btrim(b.value->>'sku'))) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', null, 'field', 'sku', 'code', 'DUPLICATE_BATCH_IDENTIFIER'));
    end if;
    if exists (select 1
      from jsonb_array_elements(p_rows) with ordinality a(value, ordinal)
      join jsonb_array_elements(p_rows) with ordinality b(value, ordinal)
        on a.ordinal < b.ordinal
      where nullif(lower(btrim(a.value->>'barcode')), '') is not null
        and lower(btrim(a.value->>'barcode')) = lower(btrim(b.value->>'barcode'))) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', null, 'field', 'barcode', 'code', 'DUPLICATE_BATCH_IDENTIFIER'));
    end if;
    v_limit:=shop_private.subscription_resource_limit(p_shop_id,'active_products');
    -- NULL is the existing entitlement contract for unlimited grandfathered plans.
    if (select count(*) from public.products where shop_id = p_shop_id and is_active)
      + (select count(*) from jsonb_array_elements(p_rows) row
        where not exists (select 1 from public.products product
          where product.shop_id = p_shop_id and product.is_active
            and ((nullif(btrim(row->>'sku'), '') is not null and lower(product.sku) = lower(btrim(row->>'sku')))
              or (nullif(btrim(row->>'barcode'), '') is not null and lower(product.barcode) = lower(btrim(row->>'barcode')))))) > v_limit then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', null, 'field', 'file', 'code', 'PRODUCT_LIMIT_REACHED'));
    end if;
  end if;

  if jsonb_array_length(v_errors) > 0 or p_dry_run then
    return jsonb_build_object('valid', jsonb_array_length(v_errors) = 0, 'dryRun', true,
      'kind', p_kind, 'rowCount', jsonb_array_length(p_rows), 'errors', v_errors);
  end if;

  for v_row, v_ordinal in select value, ordinality from jsonb_array_elements(p_rows) with ordinality loop
    v_name := btrim(v_row->>'name'); v_email := nullif(lower(btrim(v_row->>'email')), ''); v_phone := nullif(btrim(v_row->>'phone'), '');
    if p_kind = 'products' then
      v_sku := nullif(btrim(v_row->>'sku'), ''); v_barcode := nullif(btrim(v_row->>'barcode'), '');
      select product.id into v_product_id from public.products product where product.shop_id = p_shop_id and product.is_active
        and ((v_sku is not null and lower(product.sku) = lower(v_sku)) or (v_barcode is not null and lower(product.barcode) = lower(v_barcode)))
        order by case when v_sku is not null and lower(product.sku) = lower(v_sku) then 0 else 1 end limit 1;
      if v_product_id is null then v_created := v_created + 1; else v_updated := v_updated + 1; end if;
      v_product_id := shop_private.save_product(p_shop_id, v_product_id, v_name, v_sku, v_barcode, (v_row->>'sale_price')::numeric);
      v_unit:=nullif(btrim(v_row->>'base_unit_code'),'');
      if v_unit is not null then
        select * into v_existing_product from public.products where id=v_product_id;
        perform shop_private.configure_product_measurement(p_shop_id,v_product_id,v_unit,coalesce(nullif(btrim(v_row->>'quantity_increment'),''),'1'),
          case when v_existing_product.measurement_status='active' then to_jsonb(v_existing_product.sale_unit_codes) else jsonb_build_array(v_unit) end,'CSV measurement import');
      end if;
      v_category_id := shop_private.resolve_catalog_category(p_shop_id, v_row->>'category', v_profile, true);
      update public.products set category_id = v_category_id where id = v_product_id and shop_id = p_shop_id;
      if nullif(btrim(v_row->>'supplier'), '') is not null then
        select vendor.id into v_vendor_id from public.vendors vendor where vendor.shop_id = p_shop_id and vendor.is_active
          and lower(vendor.name) = lower(btrim(v_row->>'supplier')) order by vendor.id limit 1;
        insert into public.product_suppliers (shop_id, product_id, vendor_id) values (p_shop_id, v_product_id, v_vendor_id) on conflict do nothing;
      end if;
      v_stock := coalesce(nullif(v_row->>'opening_stock', '')::numeric, 0);
      if v_stock > 0 then
        perform shop_private.adjust_stock(md5(p_request_id::text || ':stock:' || v_ordinal::text)::uuid,
          p_shop_id, v_product_id, v_stock, coalesce(nullif(v_row->>'opening_cost', '')::numeric, 0), 'Opening stock import');
        v_stocked := v_stocked + 1;
      end if;
    elsif p_kind = 'customers' then
      select client.id into v_match_a from public.clients client where client.shop_id = p_shop_id and client.is_active
        and ((v_email is not null and lower(client.email) = v_email) or (v_phone is not null and client.phone = v_phone))
        order by case when v_email is not null and lower(client.email) = v_email then 0 else 1 end, client.id limit 1;
      if v_match_a is null then v_created := v_created + 1; else v_updated := v_updated + 1; end if;
      perform shop_private.save_customer(p_shop_id, v_match_a, v_name, v_phone, v_email,
        nullif(btrim(v_row->>'address'), ''), nullif(btrim(v_row->>'notes'), ''));
    else
      select vendor.id into v_match_a from public.vendors vendor where vendor.shop_id = p_shop_id and vendor.is_active
        and ((v_email is not null and lower(vendor.email) = v_email) or (v_phone is not null and vendor.phone = v_phone))
        order by case when v_email is not null and lower(vendor.email) = v_email then 0 else 1 end, vendor.id limit 1;
      if v_match_a is null then v_created := v_created + 1; else v_updated := v_updated + 1; end if;
      perform shop_private.save_vendor(p_shop_id, v_match_a, v_name, nullif(btrim(v_row->>'contact_name'), ''),
        v_phone, v_email, nullif(btrim(v_row->>'address'), ''), nullif(btrim(v_row->>'tax_number'), ''), nullif(btrim(v_row->>'notes'), ''));
    end if;
  end loop;
  v_result := jsonb_build_object('valid', true, 'dryRun', false, 'kind', p_kind,
    'rowCount', jsonb_array_length(p_rows), 'created', v_created, 'updated', v_updated,
    'openingStockPosted', v_stocked, 'errors', '[]'::jsonb);
  insert into public.catalog_import_requests (request_id, shop_id, import_kind, payload_hash, result, created_by_profile_id)
    values (p_request_id, p_shop_id, p_kind, v_hash, v_result, v_profile);
  return v_result;
end;
$_$;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.barcode_label_data(uuid,text,uuid,integer,integer)'::regprocedure) is distinct from 'b7770549020e2b591b15b20b98b4cadf' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.barcode_label_data' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.barcode_label_data(p_shop_id uuid, p_search text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 200) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_page jsonb;
begin
  if p_page_size > 500 then raise exception 'INVALID_PAGINATION' using errcode = '22023'; end if;
  v_page := shop_private.list_products(p_shop_id, p_search, p_category_id, p_page, p_page_size);
  return jsonb_set(v_page, '{items}', coalesce((select jsonb_agg(jsonb_build_object(
    'productId', item->>'id', 'name', item->>'name', 'sku', item->>'sku',
    'barcode', item->>'barcode', 'salePrice', (item->>'sale_price')::numeric,
    'category', item->>'category_name','baseUnitCode',item->>'base_unit_code','quantityIncrement',item->>'quantity_increment','measurementStatus',item->>'measurement_status') order by item->>'name', item->>'id')
    from jsonb_array_elements(v_page->'items') item where nullif(item->>'barcode', '') is not null), '[]'::jsonb));
end;
$$;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.save_eta_configuration(uuid,uuid,jsonb,text)'::regprocedure) is distinct from 'ef375fa6c76ab2791dff0ddb36f6b6c9' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: public.save_eta_configuration' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION public.save_eta_configuration(p_request_id uuid, p_shop_id uuid, p_configuration jsonb, p_reason text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare actor uuid; existing public.eta_profile_versions%rowtype; entry jsonb; result uuid;
begin
 actor:=shop_private.tax_manager(p_shop_id);
 perform shop_private.assert_location_access(p_shop_id,l.id,true) from public.shop_locations l where l.shop_id=p_shop_id;
 perform 1 from public.shops where id=p_shop_id for update;
 if p_request_id is null or length(btrim(coalesce(p_reason,''))) not between 2 and 1000
 or jsonb_typeof(p_configuration) is distinct from 'object' or (p_configuration-array['profile','branches','items'])<>'{}'::jsonb
 or jsonb_typeof(p_configuration->'profile') is distinct from 'object'
 or ((p_configuration->'profile')-array['legalName','rin','activityCode'])<>'{}'::jsonb
 or length(btrim(coalesce(p_configuration->'profile'->>'legalName',''))) not between 1 and 200
 or coalesce(p_configuration->'profile'->>'rin','') !~ '^[0-9]{9}$'
 or coalesce(p_configuration->'profile'->>'activityCode','') !~ '^[0-9]{4,10}$'
 or jsonb_typeof(p_configuration->'branches') is distinct from 'array' or jsonb_array_length(p_configuration->'branches')>100
 or jsonb_typeof(p_configuration->'items') is distinct from 'array' or jsonb_array_length(p_configuration->'items')>1000 then
 raise exception 'ETA_CONFIGURATION_INVALID' using errcode='22023'; end if;
 select * into existing from public.eta_profile_versions where shop_id=p_shop_id and request_id=p_request_id;
 if found then
 if existing.configuration<>p_configuration or existing.reason<>btrim(p_reason) or existing.actor_profile_id<>actor then raise exception 'ETA_REQUEST_CONFLICT' using errcode='23505'; end if;
 return existing.id; end if;
 if exists(select 1 from jsonb_array_elements(p_configuration->'branches') b group by b->>'locationId' having count(*)>1)
 or exists(select 1 from jsonb_array_elements(p_configuration->'branches') b where coalesce(b->>'deviceSerialNumber','')<>'' group by b->>'deviceSerialNumber' having count(*)>1)
 or exists(select 1 from jsonb_array_elements(p_configuration->'items') i group by i->>'sourceType',i->>'sourceId' having count(*)>1) then raise exception 'ETA_DUPLICATE_CONFIGURATION' using errcode='22023'; end if;
 for entry in select value from jsonb_array_elements(p_configuration->'branches') loop
 if (entry-array['locationId','branchCode','deviceSerialNumber','address'])<>'{}'::jsonb
 or not exists(select 1 from public.shop_locations where id=(entry->>'locationId')::uuid and shop_id=p_shop_id)
 or length(btrim(coalesce(entry->>'branchCode',''))) not between 1 and 50
 or length(btrim(coalesce(entry->>'deviceSerialNumber',''))) not between 0 and 100
 or jsonb_typeof(entry->'address') is distinct from 'object'
 or ((entry->'address')-array['country','governate','regionCity','street','buildingNumber'])<>'{}'::jsonb
 or entry->'address'->>'country' is distinct from 'EG'
 or length(btrim(coalesce(entry->'address'->>'governate',''))) not between 1 and 100
 or length(btrim(coalesce(entry->'address'->>'regionCity',''))) not between 1 and 100
 or length(btrim(coalesce(entry->'address'->>'street',''))) not between 1 and 200
 or length(btrim(coalesce(entry->'address'->>'buildingNumber',''))) not between 1 and 100 then raise exception 'ETA_BRANCH_INVALID' using errcode='22023'; end if;
 perform shop_private.assert_location_access(p_shop_id,(entry->>'locationId')::uuid,true);
 -- An existing serial cannot move to another location and silently restart a chain.
 if coalesce(entry->>'deviceSerialNumber','')<>'' and exists(select 1 from public.eta_profile_versions v cross join lateral jsonb_array_elements(v.configuration->'branches') b
 where v.shop_id=p_shop_id and b->>'deviceSerialNumber'=entry->>'deviceSerialNumber' and b->>'locationId'<>entry->>'locationId') then raise exception 'ETA_POS_LOCATION_CONFLICT' using errcode='22023'; end if;
 end loop;
 for entry in select value from jsonb_array_elements(p_configuration->'items') loop
 if (entry-array['sourceType','sourceId','itemType','itemCode','unitType','stockUnitCode'])<>'{}'::jsonb
 or coalesce(entry->>'sourceType','') not in('product','service') or coalesce(entry->>'itemType','') not in('GS1','EGS')
 or length(coalesce(entry->>'itemCode','')) not between 1 and 100 or coalesce(entry->>'unitType','') !~ '^[A-Za-z0-9]{1,30}$'
 or (entry->>'itemType'='GS1' and entry->>'itemCode' !~ '^[0-9]{8,14}$')
 or (entry->>'itemType'='EGS' and entry->>'itemCode' !~ ('^EG-'||(p_configuration->'profile'->>'rin')||'-[A-Za-z0-9_-]+$'))
 or not ((entry->>'sourceType'='product' and exists(select 1 from public.products where shop_id=p_shop_id and id=(entry->>'sourceId')::uuid))
 or (entry->>'sourceType'='service' and exists(select 1 from public.services where shop_id=p_shop_id and id=(entry->>'sourceId')::uuid))) or (entry->>'sourceType'='product' and exists(select 1 from public.products p where p.shop_id=p_shop_id and p.id=(entry->>'sourceId')::uuid and p.measurement_status='active' and entry->>'stockUnitCode' is distinct from p.base_unit_code))
 or (entry ? 'stockUnitCode' and not exists(select 1 from public.units_of_measure where code=entry->>'stockUnitCode' and dimension<>'package')) then raise exception 'ETA_ITEM_INVALID' using errcode='22023'; end if;
 end loop;
 insert into public.eta_profile_versions(shop_id,request_id,configuration,reason,actor_profile_id) values(p_shop_id,p_request_id,p_configuration,btrim(p_reason),actor) returning id into result;
 return result;
end; $_$;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.eta_settings(uuid,integer)'::regprocedure) is distinct from 'c975e460b5f33402c39a5a058367fe99' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: public.eta_settings' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION public.eta_settings(p_shop_id uuid, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 perform shop_private.tax_manager(p_shop_id);
 perform shop_private.assert_location_access(p_shop_id,l.id,true) from public.shop_locations l where l.shop_id=p_shop_id;
 return jsonb_build_object('configuration',(select configuration from public.eta_profile_versions where shop_id=p_shop_id order by created_at desc,id desc limit 1),
 'activation','not_activated','locations',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name)) from public.shop_locations l where l.shop_id=p_shop_id and shop_private.user_can_access_location(p_shop_id,l.id)),'[]'),
 'items',coalesce((select jsonb_agg(i) from (select id,name,'product' as "sourceType",case when measurement_status='active' then base_unit_code else null end as "stockUnitCode" from public.products where shop_id=p_shop_id union all select id,name,'service',null::text from public.services where shop_id=p_shop_id)i),'[]'),
 'sales',coalesce((select jsonb_agg(s) from(select i.id,i.invoice_number as label from public.invoices i join public.eta_sale_sources e on e.invoice_id=i.id and e.shop_id=i.shop_id where i.shop_id=p_shop_id and i.status='issued' and shop_private.user_can_access_location(p_shop_id,i.location_id) and not exists(select 1 from public.eta_outbox o where o.shop_id=p_shop_id and o.invoice_id=i.id) order by i.issued_at desc,i.id desc limit 100)s),'[]'),
 'documents',coalesce((select jsonb_agg(d) from(select id,channel,invoice_id,(select invoice_number from public.invoices i where i.id=o.invoice_id and i.shop_id=p_shop_id) as invoice_number,state,document_uuid,submission_uuid,error_code,created_at from public.eta_outbox o where shop_id=p_shop_id and shop_private.user_can_access_location(p_shop_id,o.location_id) order by created_at desc,id desc limit 50 offset greatest(0,least(coalesce(p_offset,0),100000)))d),'[]'));
end; $$;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.catalog_sales_report(uuid,uuid,date,date)'::regprocedure) is distinct from '6324bcb471bce4b8274148949a3ada32' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.catalog_sales_report' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.catalog_sales_report(p_shop_id uuid, p_category_id uuid DEFAULT NULL::uuid, p_from date DEFAULT (((now() AT TIME ZONE 'Africa/Cairo'::text))::date - 30), p_to date DEFAULT ((now() AT TIME ZONE 'Africa/Cairo'::text))::date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform shop_private.assert_team_permission(p_shop_id, 'reports.view');
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366 then
    raise exception 'INVALID_REPORT_PERIOD' using errcode = '22023'; end if;
  if p_category_id is not null and not exists (select 1 from public.catalog_categories
    where id = p_category_id and shop_id = p_shop_id and is_active) then
    raise exception 'CATEGORY_NOT_FOUND'; end if;
  return jsonb_build_object('categoryId', p_category_id, 'from', p_from, 'to', p_to,
    'items', (select coalesce(jsonb_agg(to_jsonb(rows) order by rows.amount desc, rows.name), '[]'::jsonb)
      from (select item.item_type::text type, item.item_name name,
          coalesce(category.name, 'Uncategorized') category,
          case when item.item_type='product' then coalesce(item.measurement_snapshot->>'baseUnitCode','legacy') else 'service' end as "baseUnitCode",
          coalesce(item.product_id,item.service_id) as "sourceId",
          sum(item.quantity) quantity, sum(item.total_amount) amount
        from public.invoice_items item
        join public.invoices invoice on invoice.id = item.invoice_id and invoice.shop_id = item.shop_id
        left join public.products product on item.item_type = 'product' and product.id = item.product_id and product.shop_id = item.shop_id
        left join public.services service on item.item_type = 'service' and service.id = item.service_id and service.shop_id = item.shop_id
        left join public.catalog_categories category on category.id = coalesce(product.category_id, service.category_id)
        where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
          and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
          and coalesce(invoice.issued_at, invoice.created_at)::date between p_from and p_to
          and (p_category_id is null or coalesce(product.category_id, service.category_id) = p_category_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        group by item.item_type, item.item_name, category.name, coalesce(item.product_id,item.service_id), case when item.item_type='product' then coalesce(item.measurement_snapshot->>'baseUnitCode','legacy') else 'service' end) rows));
end;
$$;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.sale_catalog(uuid)'::regprocedure) is distinct from 'b196f803f13cd73a2e286e63e3a1bcf4' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: sale_catalog' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.sale_catalog(p_shop_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_mode public.business_mode;
  v_access record;
begin
  select * into v_access from shop_private.sale_access(p_shop_id);
  if not coalesce(v_access.can_manage, false) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  select business_mode into v_mode from public.shops where id = p_shop_id;
  return jsonb_build_object(
    'businessMode', v_mode,
    'canIssue', coalesce(v_access.can_issue, false),
    'products', case when v_mode in ('product', 'mixed') then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', product.id, 'name', product.name, 'sku', product.sku,
        'barcode', product.barcode, 'unitPrice', product.sale_price,'measurement',shop_private.pos_measurement(p_shop_id,product.id),
        'stock', coalesce(stock.quantity_on_hand, 0)
      ) order by lower(product.name), product.id), '[]'::jsonb)
      from public.products product
      left join public.product_stock stock
        on stock.shop_id = product.shop_id and stock.product_id = product.id
      where product.shop_id = p_shop_id and product.is_active
    ) else '[]'::jsonb end,
    'services', case when v_mode in ('service', 'mixed') then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', service.id, 'name', service.name,
        'unitPrice', service.base_sale_price,
        'discountType', service.default_discount_type,
        'discountValue', service.default_discount_value
      ) order by lower(service.name), service.id), '[]'::jsonb)
      from public.services service
      where service.shop_id = p_shop_id and service.is_active
    ) else '[]'::jsonb end,
    'customers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', client.id, 'name', client.name
      ) order by lower(client.name), client.id), '[]'::jsonb)
      from public.clients client
      where client.shop_id = p_shop_id and client.is_active
    )
  );
end;
$$;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.shop_operating_report(uuid,uuid,text,date)'::regprocedure) is distinct from '537bff862e7f7892dc94e1c0d8fb8012' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.shop_operating_report' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.shop_operating_report(p_shop_id uuid, p_location_id uuid DEFAULT NULL::uuid, p_period text DEFAULT 'day'::text, p_anchor_date date DEFAULT ((now() AT TIME ZONE 'Africa/Cairo'::text))::date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_from_date date;
  v_to_date date;
  v_from timestamptz;
  v_to timestamptz;
  v_sales numeric := 0;
  v_expenses numeric := 0;
  v_can_view_costs boolean := false;
  v_result jsonb;
begin
  perform shop_private.assert_team_permission(p_shop_id, 'reports.view');
  v_can_view_costs := shop_private.has_permission(p_shop_id, 'reports.cost_profit.view');
  if p_period is null or p_period not in ('day', 'week', 'month') or p_anchor_date is null then
    raise exception 'INVALID_REPORT_PERIOD' using errcode = '22023';
  end if;
  if p_location_id is not null then
    perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  end if;

  v_from_date := case p_period
    when 'day' then p_anchor_date
    when 'week' then p_anchor_date - extract(isodow from p_anchor_date)::integer + 1
    else date_trunc('month', p_anchor_date)::date
  end;
  v_to_date := case p_period
    when 'day' then v_from_date + 1
    when 'week' then v_from_date + 7
    else (v_from_date + interval '1 month')::date
  end;
  v_from := v_from_date::timestamp at time zone 'Africa/Cairo';
  v_to := v_to_date::timestamp at time zone 'Africa/Cairo';

  select coalesce(sum(invoice.total_amount), 0) into v_sales
  from public.invoices invoice
  where invoice.shop_id = p_shop_id
    and invoice.status in ('issued', 'paid')
    and not exists (select 1 from public.sale_corrections correction
      where correction.invoice_id = invoice.id)
    and (p_location_id is null or invoice.location_id = p_location_id)
    and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
    and coalesce(invoice.issued_at, invoice.created_at) >= v_from
    and coalesce(invoice.issued_at, invoice.created_at) < v_to;

  if v_can_view_costs then
    select coalesce(sum(expense.amount), 0) into v_expenses
    from public.expenses expense
    where expense.shop_id = p_shop_id and expense.status = 'paid'
      and (p_location_id is null or expense.location_id = p_location_id)
      and shop_private.user_can_access_location(p_shop_id, expense.location_id)
      and expense.expense_date >= v_from and expense.expense_date < v_to;
  end if;

  select jsonb_build_object(
    'shopId', p_shop_id,
    'locationId', p_location_id,
    'period', p_period,
    'canViewCosts', v_can_view_costs,
    'fromDate', v_from_date,
    'toDateExclusive', v_to_date,
    'generatedAt', clock_timestamp(),
    'sales', v_sales,
    'saleCount', (select count(*) from public.invoices invoice
      where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        and coalesce(invoice.issued_at, invoice.created_at) >= v_from
        and coalesce(invoice.issued_at, invoice.created_at) < v_to),
    'averageTicket', case when (select count(*) from public.invoices invoice
      where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
        and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        and coalesce(invoice.issued_at, invoice.created_at) >= v_from
        and coalesce(invoice.issued_at, invoice.created_at) < v_to) = 0 then 0
      else round(v_sales / (select count(*) from public.invoices invoice
        where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
          and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
          and (p_location_id is null or invoice.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
          and coalesce(invoice.issued_at, invoice.created_at) >= v_from
          and coalesce(invoice.issued_at, invoice.created_at) < v_to), 2) end,
    'salesMix', (select coalesce(jsonb_agg(jsonb_build_object(
        'type', mix.item_type, 'baseUnitCode',mix.base_unit_code, 'amount', mix.amount, 'quantity', mix.quantity)
        order by mix.item_type,mix.base_unit_code), '[]'::jsonb)
      from (select item.item_type::text item_type,coalesce(item.measurement_snapshot->>'baseUnitCode',case when item.item_type='service' then 'service' else 'legacy' end) base_unit_code, sum(item.total_amount) amount,
          sum(item.quantity) quantity
        from public.invoice_items item
        join public.invoices invoice on invoice.id = item.invoice_id and invoice.shop_id = item.shop_id
        where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
          and item.item_type in ('product', 'service')
          and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
          and (p_location_id is null or invoice.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
          and coalesce(invoice.issued_at, invoice.created_at) >= v_from
          and coalesce(invoice.issued_at, invoice.created_at) < v_to
        group by item.item_type,coalesce(item.measurement_snapshot->>'baseUnitCode',case when item.item_type='service' then 'service' else 'legacy' end)) mix),
    'paymentMix', (select coalesce(jsonb_agg(jsonb_build_object(
        'method', mix.method, 'collected', mix.collected, 'refunded', mix.refunded,
        'net', mix.collected - mix.refunded, 'count', mix.payment_count)
        order by mix.method), '[]'::jsonb)
      from (select payment.method::text method,
          coalesce(sum(payment.amount) filter (where payment.payment_direction = 'in'), 0) collected,
          coalesce(sum(payment.amount) filter (where payment.payment_direction = 'out'), 0) refunded,
          count(*) payment_count
        from public.payments payment
        where payment.shop_id = p_shop_id and payment.status = 'completed'
          and payment.customer_kind is not null
          and (p_location_id is null or payment.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, payment.location_id)
          and payment.paid_at >= v_from and payment.paid_at < v_to
        group by payment.method) mix),
    'paymentsIn', (select coalesce(sum(payment.amount), 0) from public.payments payment
      where payment.shop_id = p_shop_id and payment.status = 'completed'
        and payment.payment_direction = 'in' and payment.customer_kind is not null
        and (p_location_id is null or payment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, payment.location_id)
        and payment.paid_at >= v_from and payment.paid_at < v_to),
    'outstanding', (with customer_balances as (
        select invoice.client_id customer_id,
          coalesce(max(client.name), max(invoice.client_name_snapshot), '—') name,
          sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
            from public.customer_payment_allocations allocation where allocation.invoice_id = invoice.id), 0)) amount
        from public.invoices invoice
        left join public.clients client on client.id = invoice.client_id and client.shop_id = invoice.shop_id
        where invoice.shop_id = p_shop_id and invoice.client_id is not null
          and invoice.status in ('issued', 'paid')
          and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
          and (p_location_id is null or invoice.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        group by invoice.client_id
        having sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
          from public.customer_payment_allocations allocation where allocation.invoice_id = invoice.id), 0)) > 0
      ) select jsonb_build_object(
        'amount', coalesce((select sum(balance.amount) from customer_balances balance), 0),
        'customerCount', (select count(*) from customer_balances),
        'customers', coalesce((select jsonb_agg(jsonb_build_object(
          'customerId', customer.customer_id, 'name', customer.name, 'amount', customer.amount)
          order by customer.amount desc, customer.name, customer.customer_id)
          from (select * from customer_balances balance
            order by balance.amount desc, balance.name, balance.customer_id limit 10) customer), '[]'::jsonb))),
    'expenses', jsonb_build_object(
      'amount', case when v_can_view_costs then v_expenses else null end,
      'count', case when v_can_view_costs then (select count(*) from public.expenses expense
        where expense.shop_id = p_shop_id and expense.status = 'paid'
          and (p_location_id is null or expense.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, expense.location_id)
          and expense.expense_date >= v_from and expense.expense_date < v_to) else null end,
      'operatingBalance', case when v_can_view_costs then v_sales - v_expenses else null end),
    'appointments', (select jsonb_build_object(
        'total', count(*),
        'completed', count(*) filter (where appointment.status = 'completed'),
        'cancelled', count(*) filter (where appointment.status = 'cancelled'),
        'noShow', count(*) filter (where appointment.status = 'no_show'),
        'busiestTimes', coalesce((select jsonb_agg(jsonb_build_object(
          'hour', busy.hour_of_day, 'count', busy.appointment_count) order by busy.appointment_count desc, busy.hour_of_day)
          from (select extract(hour from timed.starts_at at time zone 'Africa/Cairo')::integer hour_of_day,
              count(*) appointment_count
            from public.appointments timed
            where timed.shop_id = p_shop_id
              and (p_location_id is null or timed.location_id = p_location_id)
              and shop_private.user_can_access_location(p_shop_id, timed.location_id)
              and timed.starts_at >= v_from and timed.starts_at < v_to
            group by 1 order by appointment_count desc, hour_of_day limit 5) busy), '[]'::jsonb))
      from public.appointments appointment
      where appointment.shop_id = p_shop_id
        and (p_location_id is null or appointment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, appointment.location_id)
        and appointment.starts_at >= v_from and appointment.starts_at < v_to),
    'appointmentCount', (select count(*) from public.appointments appointment
      where appointment.shop_id = p_shop_id
        and (p_location_id is null or appointment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, appointment.location_id)
        and appointment.starts_at >= v_from and appointment.starts_at < v_to),
    'cash', (select jsonb_build_object(
        'closedShifts', count(*), 'expected', coalesce(sum(session.expected_amount), 0),
        'counted', coalesce(sum(session.closing_amount), 0),
        'variance', coalesce(sum(session.variance_amount), 0))
      from public.cash_sessions session
      where session.shop_id = p_shop_id and session.status = 'closed'
        and (p_location_id is null or session.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, session.location_id)
        and session.closed_at >= v_from and session.closed_at < v_to),
    'staff', (select coalesce(jsonb_agg(jsonb_build_object(
        'membershipId', staff.membership_id, 'name', staff.name, 'sales', staff.sales,
        'saleCount', staff.sale_count, 'serviceCount', staff.service_count)
        order by staff.sales desc, staff.name, staff.membership_id), '[]'::jsonb)
      from (select context.staff_membership_id membership_id,
          max(context.staff_name_snapshot) name, sum(invoice.total_amount) sales,
          count(distinct invoice.id) sale_count,
          coalesce(sum(item.service_quantity), 0) service_count
        from public.pos_sale_contexts context
        join public.invoices invoice on invoice.id = context.invoice_id and invoice.shop_id = context.shop_id
        left join lateral (select coalesce(sum(line.quantity), 0) service_quantity
          from public.invoice_items line where line.invoice_id = invoice.id
            and line.shop_id = invoice.shop_id and line.item_type = 'service') item on true
        where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
          and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
          and (p_location_id is null or invoice.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
          and coalesce(invoice.issued_at, invoice.created_at) >= v_from
          and coalesce(invoice.issued_at, invoice.created_at) < v_to
        group by context.staff_membership_id) staff),
    'locations', (select coalesce(jsonb_agg(jsonb_build_object(
        'locationId', location.id, 'name', location.name,
        'sales', coalesce((select sum(invoice.total_amount) from public.invoices invoice
          where invoice.shop_id = p_shop_id and invoice.location_id = location.id
            and invoice.status in ('issued', 'paid')
            and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
            and coalesce(invoice.issued_at, invoice.created_at) >= v_from
            and coalesce(invoice.issued_at, invoice.created_at) < v_to), 0),
        'saleCount', (select count(*) from public.invoices invoice
          where invoice.shop_id = p_shop_id and invoice.location_id = location.id
            and invoice.status in ('issued', 'paid')
            and not exists (select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id)
            and coalesce(invoice.issued_at, invoice.created_at) >= v_from
            and coalesce(invoice.issued_at, invoice.created_at) < v_to),
        'collections', coalesce((select coalesce(sum(payment.amount) filter (where payment.payment_direction = 'in'), 0)
          - coalesce(sum(payment.amount) filter (where payment.payment_direction = 'out'), 0)
          from public.payments payment where payment.shop_id = p_shop_id
            and payment.location_id = location.id and payment.status = 'completed'
            and payment.customer_kind is not null and payment.paid_at >= v_from and payment.paid_at < v_to), 0),
        'expenses', case when v_can_view_costs then coalesce((select sum(expense.amount) from public.expenses expense
          where expense.shop_id = p_shop_id and expense.location_id = location.id
            and expense.status = 'paid' and expense.expense_date >= v_from and expense.expense_date < v_to), 0) else null end,
        'cashVariance', coalesce((select sum(session.variance_amount) from public.cash_sessions session
          where session.shop_id = p_shop_id and session.location_id = location.id
            and session.status = 'closed' and session.closed_at >= v_from and session.closed_at < v_to), 0))
        order by location.is_default desc, location.name, location.id), '[]'::jsonb)
      from public.shop_locations location
      where location.shop_id = p_shop_id
        and (p_location_id is null or location.id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, location.id))
  ) into v_result;
  return v_result;
end;
$$;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.shop_operational_report(uuid,text,uuid,date,date,integer,integer)'::regprocedure) is distinct from '8ebd0d181072ab90460f41a8c06c0a59' then raise exception 'MEASUREMENT_ROUTINE_REVIEW_REQUIRED: shop_private.shop_operational_report' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.shop_operational_report(p_shop_id uuid, p_report text, p_location_id uuid DEFAULT NULL::uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_from timestamptz;
  v_to timestamptz;
  v_can_view_costs boolean;
  v_summary jsonb := '{}'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_total bigint := 0;
begin
  perform shop_private.assert_team_permission(p_shop_id, 'reports.view');
  v_can_view_costs := shop_private.has_permission(p_shop_id, 'reports.cost_profit.view');

  if p_report is null or p_report not in (
    'sales', 'collections', 'receivables', 'suppliers', 'expenses', 'inventory', 'margin', 'activity'
  ) or p_page is null or p_page_size is null or p_page < 1
    or p_page_size < 1 or p_page_size > 500
    or (p_from is not null and p_to is not null and p_from > p_to) then
    raise exception 'INVALID_OPERATIONAL_REPORT_QUERY' using errcode = '22023';
  end if;
  if p_location_id is not null then
    perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  end if;
  if p_report in ('suppliers', 'expenses', 'inventory', 'margin')
    and not v_can_view_costs then
    raise exception 'REPORT_COST_PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_from := case when p_from is null then null
    else p_from::timestamp at time zone 'Africa/Cairo' end;
  v_to := case when p_to is null then null
    else (p_to + 1)::timestamp at time zone 'Africa/Cairo' end;

  if p_report = 'sales' then
    with rows as (
      select item.id, invoice.id invoice_id, invoice.invoice_number,
        coalesce(invoice.issued_at, invoice.created_at) occurred_at,
        invoice.location_id, location.name location_name,
        item.item_type::text item_type, item.item_name,
        item.product_id, item.service_id, item.quantity,coalesce(item.measurement_snapshot->>'baseUnitCode',case when item.item_type='service' then 'service' else 'legacy' end) base_unit_code,
        item.total_amount amount, invoice.client_id,
        invoice.client_name_snapshot customer_name,
        '/sales/' || invoice.id::text source_path
      from public.invoice_items item
      join public.invoices invoice on invoice.id = item.invoice_id
        and invoice.shop_id = item.shop_id
      join public.shop_locations location on location.id = invoice.location_id
        and location.shop_id = invoice.shop_id
      where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        and (v_from is null or coalesce(invoice.issued_at, invoice.created_at) >= v_from)
        and (v_to is null or coalesce(invoice.issued_at, invoice.created_at) < v_to)
    ), page_rows as (
      select * from rows order by occurred_at desc, id desc
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from rows), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by occurred_at desc, id desc) from page_rows), '[]'::jsonb)
    into v_total, v_items;

    select jsonb_build_object(
      'sales', coalesce(sum(invoice.total_amount), 0),
      'saleCount', count(*),
      'averageTicket', case when count(*) = 0 then 0
        else round(sum(invoice.total_amount) / count(*), 2) end,
      'productSales', coalesce(sum((select sum(item.total_amount)
        from public.invoice_items item where item.invoice_id = invoice.id
          and item.item_type = 'product')), 0),
      'serviceSales', coalesce(sum((select sum(item.total_amount)
        from public.invoice_items item where item.invoice_id = invoice.id
          and item.item_type = 'service')), 0)
    ) into v_summary
    from public.invoices invoice
    where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
      and not exists (select 1 from public.sale_corrections correction
        where correction.invoice_id = invoice.id)
      and (p_location_id is null or invoice.location_id = p_location_id)
      and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
      and (v_from is null or coalesce(invoice.issued_at, invoice.created_at) >= v_from)
      and (v_to is null or coalesce(invoice.issued_at, invoice.created_at) < v_to);

  elsif p_report = 'collections' then
    with rows as (
      select payment.id, payment.paid_at occurred_at, payment.location_id,
        location.name location_name, payment.client_id customer_id,
        coalesce(client.name, 'Walk-in') customer_name,
        payment.payment_direction::text direction, payment.method::text method,
        payment.amount, payment.reference,
        case when payment.client_id is null then '/sales'
          else '/customers/' || payment.client_id::text end source_path
      from public.payments payment
      join public.shop_locations location on location.id = payment.location_id
        and location.shop_id = payment.shop_id
      left join public.clients client on client.id = payment.client_id
        and client.shop_id = payment.shop_id
      where payment.shop_id = p_shop_id and payment.status = 'completed'
        and payment.customer_kind is not null
        and (p_location_id is null or payment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, payment.location_id)
        and (v_from is null or payment.paid_at >= v_from)
        and (v_to is null or payment.paid_at < v_to)
    ), page_rows as (
      select * from rows order by occurred_at desc, id desc
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from rows), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by occurred_at desc, id desc) from page_rows), '[]'::jsonb)
    into v_total, v_items;

    with payment_totals as (
      select coalesce(sum(payment.amount) filter (where payment.payment_direction = 'in'), 0) collected,
        coalesce(sum(payment.amount) filter (where payment.payment_direction = 'out'), 0) refunded
      from public.payments payment
      where payment.shop_id = p_shop_id and payment.status = 'completed'
        and payment.customer_kind is not null
        and (p_location_id is null or payment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, payment.location_id)
        and (v_from is null or payment.paid_at >= v_from)
        and (v_to is null or payment.paid_at < v_to)
    ), balances as (
      select invoice.client_id,
        sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
          from public.customer_payment_allocations allocation
          where allocation.invoice_id = invoice.id), 0)) amount
      from public.invoices invoice
      where invoice.shop_id = p_shop_id and invoice.client_id is not null
        and invoice.status in ('issued', 'paid')
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
      group by invoice.client_id
      having sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
        from public.customer_payment_allocations allocation
        where allocation.invoice_id = invoice.id), 0)) > 0
    )
    select jsonb_build_object('collected', totals.collected,
      'refunded', totals.refunded, 'netCollections', totals.collected - totals.refunded,
      'outstanding', coalesce((select sum(amount) from balances), 0),
      'outstandingCustomerCount', (select count(*) from balances))
    into v_summary from payment_totals totals;

  elsif p_report = 'receivables' then
    with rows as (
      select invoice.client_id id, coalesce(max(client.name), max(invoice.client_name_snapshot), '—') customer_name,
        count(*) invoice_count, min(invoice.due_date) oldest_due_date,
        sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
          from public.customer_payment_allocations allocation
          where allocation.invoice_id = invoice.id), 0)) outstanding,
        '/customers/' || invoice.client_id::text source_path
      from public.invoices invoice
      left join public.clients client on client.id = invoice.client_id
        and client.shop_id = invoice.shop_id
      where invoice.shop_id = p_shop_id and invoice.client_id is not null
        and invoice.status in ('issued', 'paid')
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
      group by invoice.client_id
      having sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
        from public.customer_payment_allocations allocation
        where allocation.invoice_id = invoice.id), 0)) > 0
    ), page_rows as (
      select * from rows order by outstanding desc, customer_name, id
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from rows), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by outstanding desc, customer_name, id) from page_rows), '[]'::jsonb)
    into v_total, v_items;
    select jsonb_build_object('outstanding', coalesce(sum(balance.outstanding), 0),
      'outstandingCustomerCount', count(*),
      'overdueCustomerCount', count(*) filter (where balance.oldest_due_date <
        (now() at time zone 'Africa/Cairo')::date))
    into v_summary from (
      select invoice.client_id, min(invoice.due_date) oldest_due_date,
        sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
          from public.customer_payment_allocations allocation
          where allocation.invoice_id = invoice.id), 0)) outstanding
      from public.invoices invoice
      where invoice.shop_id = p_shop_id and invoice.client_id is not null
        and invoice.status in ('issued', 'paid')
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
      group by invoice.client_id
      having sum(invoice.total_amount - coalesce((select sum(shop_private.allocation_remaining(allocation.id))
        from public.customer_payment_allocations allocation
        where allocation.invoice_id = invoice.id), 0)) > 0
    ) balance;

  elsif p_report = 'suppliers' then
    with rows as (
      select invoice.id, invoice.issued_at occurred_at, invoice.location_id,
        location.name location_name, invoice.vendor_id supplier_id,
        invoice.vendor_name_snapshot supplier_name, invoice.invoice_number,
        invoice.total_amount purchase_amount,
        shop_private.purchase_payable(invoice.id) payable,
        invoice.status::text status,
        '/purchases/' || invoice.id::text source_path
      from public.vendor_invoices invoice
      join public.shop_locations location on location.id = invoice.location_id
        and location.shop_id = invoice.shop_id
      where invoice.shop_id = p_shop_id
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        and (v_from is null or invoice.issued_at >= v_from)
        and (v_to is null or invoice.issued_at < v_to)
    ), page_rows as (
      select * from rows order by occurred_at desc nulls last, id desc
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from rows), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by occurred_at desc nulls last, id desc) from page_rows), '[]'::jsonb)
    into v_total, v_items;

    select jsonb_build_object(
      'purchases', coalesce((select sum(invoice.total_amount)
        from public.vendor_invoices invoice where invoice.shop_id = p_shop_id
          and invoice.status = 'posted'
          and (p_location_id is null or invoice.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
          and (v_from is null or invoice.issued_at >= v_from)
          and (v_to is null or invoice.issued_at < v_to)), 0),
      'supplierPayments', coalesce((select sum(payment.amount)
        from public.payments payment where payment.shop_id = p_shop_id
          and payment.status = 'completed' and payment.supplier_kind = 'payment'
          and (p_location_id is null or payment.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, payment.location_id)
          and (v_from is null or payment.paid_at >= v_from)
          and (v_to is null or payment.paid_at < v_to)), 0)
        - coalesce((select sum(reversal.amount)
          from public.supplier_payment_reversals reversal
          join public.supplier_payment_allocations allocation
            on allocation.id = reversal.original_allocation_id
          join public.payments payment on payment.id = allocation.payment_id
          where reversal.shop_id = p_shop_id
            and (p_location_id is null or payment.location_id = p_location_id)
            and shop_private.user_can_access_location(p_shop_id, payment.location_id)
            and (v_from is null or reversal.effective_at >= v_from)
            and (v_to is null or reversal.effective_at < v_to)), 0),
      'payable', coalesce((select sum(shop_private.purchase_payable(invoice.id))
        from public.vendor_invoices invoice where invoice.shop_id = p_shop_id
          and (p_location_id is null or invoice.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id)), 0),
      'openPurchaseCount', (select count(*) from public.vendor_invoices invoice
        where invoice.shop_id = p_shop_id and shop_private.purchase_payable(invoice.id) > 0
          and (p_location_id is null or invoice.location_id = p_location_id)
          and shop_private.user_can_access_location(p_shop_id, invoice.location_id))
    ) into v_summary;

  elsif p_report = 'expenses' then
    with rows as (
      select expense.id, expense.expense_date occurred_at, expense.location_id,
        location.name location_name, expense.title,
        coalesce(category.name, 'Uncategorised') category_name,
        expense.amount, expense.status::text status, expense.notes,
        '/expenses' source_path
      from public.expenses expense
      join public.shop_locations location on location.id = expense.location_id
        and location.shop_id = expense.shop_id
      left join public.expense_categories category on category.id = expense.category_id
        and category.shop_id = expense.shop_id
      where expense.shop_id = p_shop_id and expense.status = 'paid'
        and (p_location_id is null or expense.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, expense.location_id)
        and (v_from is null or expense.expense_date >= v_from)
        and (v_to is null or expense.expense_date < v_to)
    ), page_rows as (
      select * from rows order by occurred_at desc, id desc
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from rows), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by occurred_at desc, id desc) from page_rows), '[]'::jsonb)
    into v_total, v_items;

    with expense_totals as (
      select coalesce(sum(expense.amount), 0) expenses, count(*) expense_count,
        count(distinct expense.category_id) category_count
      from public.expenses expense
      where expense.shop_id = p_shop_id and expense.status = 'paid'
        and (p_location_id is null or expense.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, expense.location_id)
        and (v_from is null or expense.expense_date >= v_from)
        and (v_to is null or expense.expense_date < v_to)
    ), sales_total as (
      select coalesce(sum(invoice.total_amount), 0) sales
      from public.invoices invoice
      where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        and (v_from is null or coalesce(invoice.issued_at, invoice.created_at) >= v_from)
        and (v_to is null or coalesce(invoice.issued_at, invoice.created_at) < v_to)
    )
    select jsonb_build_object('expenses', expenses.expenses,
      'expenseCount', expenses.expense_count, 'categoryCount', expenses.category_count,
      'sales', sales.sales, 'operatingResult', sales.sales - expenses.expenses)
    into v_summary from expense_totals expenses cross join sales_total sales;

  elsif p_report = 'inventory' then
    with rows as (
      select product.id, product.name, product.sku, product.is_active,case when product.measurement_status='active' then product.base_unit_code else 'legacy' end base_unit_code,
        coalesce(sum(batch.remaining_quantity), 0) quantity_on_hand,
        coalesce(sum(batch.remaining_quantity * batch.unit_cost), 0) inventory_value,
        product.reorder_threshold,
        product.is_active and product.reorder_threshold > 0
          and coalesce(sum(batch.remaining_quantity), 0) <= product.reorder_threshold low_stock,
        (select count(*) from public.inventory_movements movement
          where movement.shop_id = p_shop_id and movement.product_id = product.id
            and (p_location_id is null or movement.location_id = p_location_id)
            and shop_private.user_can_access_location(p_shop_id, movement.location_id)
            and (v_from is null or movement.created_at >= v_from)
            and (v_to is null or movement.created_at < v_to)) movement_count,
        (select max(movement.created_at) from public.inventory_movements movement
          where movement.shop_id = p_shop_id and movement.product_id = product.id
            and (p_location_id is null or movement.location_id = p_location_id)
            and shop_private.user_can_access_location(p_shop_id, movement.location_id)) last_movement_at,
        '/inventory?product=' || product.id::text source_path
      from public.products product
      left join public.inventory_batches batch on batch.product_id = product.id
        and batch.shop_id = product.shop_id
        and (p_location_id is null or batch.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, batch.location_id)
      where product.shop_id = p_shop_id
      group by product.id
    ), page_rows as (
      select * from rows order by low_stock desc, name, id
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from rows), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by low_stock desc, name, id) from page_rows), '[]'::jsonb)
    into v_total, v_items;

    with stock as (
      select product.id, product.is_active, product.reorder_threshold,case when product.measurement_status='active' then product.base_unit_code else 'legacy' end base_unit_code,
        coalesce(sum(batch.remaining_quantity), 0) quantity,
        coalesce(sum(batch.remaining_quantity * batch.unit_cost), 0) value
      from public.products product
      left join public.inventory_batches batch on batch.product_id = product.id
        and batch.shop_id = product.shop_id
        and (p_location_id is null or batch.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, batch.location_id)
      where product.shop_id = p_shop_id group by product.id
    )
    select jsonb_build_object('quantityOnHand',case when count(distinct base_unit_code)<=1 then coalesce(sum(quantity),0) else null end,
      'quantityByUnit',(select string_agg(trim_scale(q.quantity)::text||' '||q.base_unit_code,' · ' order by q.base_unit_code) from(select base_unit_code,sum(quantity) quantity from stock group by base_unit_code)q),
      'inventoryValue', coalesce(sum(value), 0), 'productCount', count(*),
      'lowStockCount', count(*) filter (where is_active and reorder_threshold > 0
        and quantity <= reorder_threshold), 'snapshot', true)
    into v_summary from stock;

  elsif p_report = 'margin' then
    with lines as (
      select item.id, invoice.id invoice_id, invoice.invoice_number,
        coalesce(invoice.issued_at, invoice.created_at) occurred_at,
        invoice.location_id, location.name location_name,
        item.product_id, item.item_name, item.quantity,coalesce(item.measurement_snapshot->>'baseUnitCode','legacy') base_unit_code,
        item.total_amount revenue,
        coalesce(sum(-movement.quantity_change * movement.unit_cost_snapshot), 0) fifo_cost,
        count(movement.id) > 0
          and bool_and(movement.unit_cost_snapshot is not null)
          and coalesce(sum(-movement.quantity_change), 0) = item.quantity cost_defined,
        '/sales/' || invoice.id::text source_path
      from public.invoice_items item
      join public.invoices invoice on invoice.id = item.invoice_id
        and invoice.shop_id = item.shop_id
      join public.shop_locations location on location.id = invoice.location_id
        and location.shop_id = invoice.shop_id
      left join public.inventory_movements movement on movement.invoice_item_id = item.id
        and movement.shop_id = invoice.shop_id and movement.movement_type = 'out'
      where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
        and item.item_type = 'product'
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        and (v_from is null or coalesce(invoice.issued_at, invoice.created_at) >= v_from)
        and (v_to is null or coalesce(invoice.issued_at, invoice.created_at) < v_to)
      group by item.id, invoice.id, invoice.invoice_number, invoice.issued_at,
        invoice.created_at, invoice.location_id, location.name
    ), reconciled as (
      select *, revenue - fifo_cost margin,
        case when revenue = 0 then null else round((revenue - fifo_cost) / revenue * 100, 2) end margin_percent
      from lines where cost_defined
    ), page_rows as (
      select * from reconciled order by occurred_at desc, id desc
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from reconciled), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by occurred_at desc, id desc) from page_rows), '[]'::jsonb)
    into v_total, v_items;

    with lines as (
      select item.id, item.quantity, item.total_amount revenue,
        coalesce(sum(-movement.quantity_change * movement.unit_cost_snapshot), 0) fifo_cost,
        count(movement.id) > 0
          and bool_and(movement.unit_cost_snapshot is not null)
          and coalesce(sum(-movement.quantity_change), 0) = item.quantity cost_defined
      from public.invoice_items item
      join public.invoices invoice on invoice.id = item.invoice_id
        and invoice.shop_id = item.shop_id
      left join public.inventory_movements movement on movement.invoice_item_id = item.id
        and movement.shop_id = invoice.shop_id and movement.movement_type = 'out'
      where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
        and item.item_type = 'product'
        and not exists (select 1 from public.sale_corrections correction
          where correction.invoice_id = invoice.id)
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
        and (v_from is null or coalesce(invoice.issued_at, invoice.created_at) >= v_from)
        and (v_to is null or coalesce(invoice.issued_at, invoice.created_at) < v_to)
      group by item.id
    )
    select jsonb_build_object(
      'revenue', coalesce(sum(revenue) filter (where cost_defined), 0),
      'fifoCost', coalesce(sum(fifo_cost) filter (where cost_defined), 0),
      'margin', coalesce(sum(revenue - fifo_cost) filter (where cost_defined), 0),
      'marginPercent', case when coalesce(sum(revenue) filter (where cost_defined), 0) = 0 then null
        else round(sum(revenue - fifo_cost) filter (where cost_defined)
          / sum(revenue) filter (where cost_defined) * 100, 2) end,
      'reconciledLineCount', count(*) filter (where cost_defined),
      'excludedLineCount', count(*) filter (where not cost_defined),
      'costBasis', 'FIFO inventory movements; services and unreconciled product lines excluded'
    ) into v_summary from lines;

  else
    with events as (
      select invoice.id, coalesce(invoice.issued_at, invoice.created_at) occurred_at,
        invoice.location_id, location.name location_name, 'sale' event_type,
        coalesce(invoice.invoice_number, invoice.id::text) label,
        invoice.total_amount amount, '/sales/' || invoice.id::text source_path
      from public.invoices invoice join public.shop_locations location
        on location.id = invoice.location_id and location.shop_id = invoice.shop_id
      where invoice.shop_id = p_shop_id and invoice.status in ('issued', 'paid')
        and (p_location_id is null or invoice.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
      union all
      select payment.id, payment.paid_at, payment.location_id, location.name,
        'customer_payment', coalesce(payment.reference, payment.method::text), payment.amount,
        case when payment.client_id is null then '/sales'
          else '/customers/' || payment.client_id::text end
      from public.payments payment join public.shop_locations location
        on location.id = payment.location_id and location.shop_id = payment.shop_id
      where payment.shop_id = p_shop_id and payment.customer_kind is not null
        and payment.status = 'completed'
        and (p_location_id is null or payment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, payment.location_id)
      union all
      select purchase.id, coalesce(purchase.issued_at, purchase.created_at), purchase.location_id,
        location.name, 'purchase', purchase.vendor_name_snapshot,
        case when v_can_view_costs then purchase.total_amount else null end,
        '/purchases/' || purchase.id::text
      from public.vendor_invoices purchase join public.shop_locations location
        on location.id = purchase.location_id and location.shop_id = purchase.shop_id
      where purchase.shop_id = p_shop_id
        and (p_location_id is null or purchase.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, purchase.location_id)
      union all
      select expense.id, expense.expense_date, expense.location_id, location.name,
        'expense', expense.title, case when v_can_view_costs then expense.amount else null end,
        '/expenses'
      from public.expenses expense join public.shop_locations location
        on location.id = expense.location_id and location.shop_id = expense.shop_id
      where expense.shop_id = p_shop_id
        and (p_location_id is null or expense.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, expense.location_id)
      union all
      select movement.id, movement.created_at, movement.location_id, location.name,
        'stock_movement', product.name,
        case when v_can_view_costs then movement.quantity_change * movement.unit_cost_snapshot else null end,
        '/inventory?product=' || movement.product_id::text
      from public.inventory_movements movement
      join public.products product on product.id = movement.product_id
        and product.shop_id = movement.shop_id
      join public.shop_locations location on location.id = movement.location_id
        and location.shop_id = movement.shop_id
      where movement.shop_id = p_shop_id
        and (p_location_id is null or movement.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, movement.location_id)
    ), filtered as (
      select * from events where (v_from is null or occurred_at >= v_from)
        and (v_to is null or occurred_at < v_to)
    ), page_rows as (
      select * from filtered order by occurred_at desc, event_type, id desc
      offset (p_page - 1) * p_page_size limit p_page_size
    )
    select (select count(*) from filtered), coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by occurred_at desc, event_type, id desc) from page_rows), '[]'::jsonb)
    into v_total, v_items;
    v_summary := jsonb_build_object('activityCount', v_total);
  end if;

  return jsonb_build_object(
    'report', p_report, 'locationId', p_location_id, 'fromDate', p_from,
    'toDate', p_to, 'timezone', 'Africa/Cairo', 'canViewCosts', v_can_view_costs,
    'operationalOnly', true, 'summary', coalesce(v_summary, '{}'::jsonb),
    'items', coalesce(v_items, '[]'::jsonb), 'total', v_total,
    'page', p_page, 'pageSize', p_page_size
  );
end;
$$;
notify pgrst,'reload schema';
commit;
