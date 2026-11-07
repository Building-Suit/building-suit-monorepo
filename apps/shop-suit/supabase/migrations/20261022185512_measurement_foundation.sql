-- SS-ELEC-101/102/104/106/107. Additive preparation; no historical quantity relabeling.
-- Operational activation requires a separate complete precision/snapshot migration.
create table public.units_of_measure (
 code text primary key check(code ~ '^[a-z][a-z0-9]{0,15}$'),
 name_en text not null, name_ar text not null, symbol text not null,
 dimension text not null check(dimension in('count','length','mass','volume','area','package')),
 canonical_conversion_factor numeric,
 allowed_precision integer not null check(allowed_precision between 0 and 6),
 is_active boolean not null default true,
 check ((dimension='package' and canonical_conversion_factor is null) or
        (dimension<>'package' and canonical_conversion_factor is not null and canonical_conversion_factor>0 and canonical_conversion_factor<=1000))
);
-- Packages have no universal conversion factor. Product definitions supply them later.
insert into public.units_of_measure(code,name_en,name_ar,symbol,dimension,canonical_conversion_factor,allowed_precision) values
('ea','Piece','قطعة','pc','count','1',0),
('pair','Pair','زوج','pair','count','2',0),
('dozen','Dozen','دستة','doz','count','12',0),
('set','Set','طقم','set','package',null,0),
('mm','Millimeter','ملليمتر','mm','length','0.001',3),
('cm','Centimeter','سنتيمتر','cm','length','0.01',4),
('m','Meter','متر','m','length','1',6),
('km','Kilometer','كيلومتر','km','length','1000',6),
('ft','Foot','قدم','ft','length','0.3048',6),
('mg','Milligram','ملليجرام','mg','mass','0.000001',0),
('g','Gram','جرام','g','mass','0.001',3),
('kg','Kilogram','كيلوجرام','kg','mass','1',6),
('t','Metric tonne','طن متري','t','mass','1000',6),
('ml','Milliliter','ملليلتر','mL','volume','0.001',3),
('l','Liter','لتر','L','volume','1',6),
('cm2','Square centimeter','سنتيمتر مربع','cm²','area','0.0001',2),
('m2','Square meter','متر مربع','m²','area','1',6),
('pack','Pack','عبوة','pack','package',null,0),
('box','Box','علبة','box','package',null,0),
('carton','Carton','كرتونة','carton','package',null,0),
('bag','Bag','كيس','bag','package',null,0),
('roll','Roll','لفة','roll','package',null,0),
('reel','Reel','بكرة','reel','package',null,0);
alter table public.units_of_measure enable row level security;
revoke all on public.units_of_measure from public,anon,authenticated,service_role;
grant select on public.units_of_measure to authenticated,service_role;
create policy measurement_registry_read on public.units_of_measure for select to authenticated,service_role using(true);
create function shop_private.measurement_history_immutable() returns trigger
language plpgsql set search_path='' as $$begin
 raise exception 'MEASUREMENT_HISTORY_IMMUTABLE' using errcode='55000';
end;$$;
revoke all on function shop_private.measurement_history_immutable() from public,anon,authenticated,service_role;
create trigger measurement_registry_immutable before update or delete on public.units_of_measure
for each row execute function shop_private.measurement_history_immutable();

-- Keep old products' operational meaning. In particular, do not impose integer
-- constraints on existing fractional legacy inventory merely because ea is the default.
alter table public.products
 add column base_unit_code text not null default 'ea' references public.units_of_measure(code),
 add column quantity_increment numeric not null default 1,
 add column measurement_status text not null default 'legacy' check(measurement_status in('legacy','prepared')),
 add constraint product_quantity_increment_valid check(quantity_increment>0 and quantity_increment<=1 and round(quantity_increment,6)=quantity_increment);
-- Existing declarations are immutable physical meaning, not a requested conversion.
update public.products p set base_unit_code=case m.unit when 'each' then 'ea' when 'mL' then 'ml' else 'g' end
from public.service_material_units m where m.product_id=p.id and m.shop_id=p.shop_id;

create table public.product_measurement_changes (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null, product_id uuid not null,
 previous_unit_code text not null references public.units_of_measure(code),
 previous_quantity_increment numeric not null,
 previous_measurement_status text not null check(previous_measurement_status in('legacy','prepared')),
 base_unit_code text not null references public.units_of_measure(code),
 quantity_increment numeric not null, reason text not null check(length(btrim(reason)) between 3 and 500),
 actor_profile_id uuid not null references public.profiles(id), created_at timestamptz not null default clock_timestamp(),
 foreign key(product_id,shop_id) references public.products(id,shop_id)
);
create index product_measurement_changes_history on public.product_measurement_changes(shop_id,product_id,created_at desc,id desc);
alter table public.product_measurement_changes enable row level security;
revoke all on public.product_measurement_changes from public,anon,authenticated,service_role;
grant select on public.product_measurement_changes to authenticated,service_role;
create policy product_measurement_changes_read on public.product_measurement_changes for select to authenticated
 using(shop_private.has_permission(shop_id,'products.view'));
create policy product_measurement_changes_service_read on public.product_measurement_changes for select to service_role using(true);
create trigger measurement_changes_immutable before update or delete on public.product_measurement_changes
for each row execute function shop_private.measurement_history_immutable();

create function shop_private.convert_measurement(p_quantity numeric,p_from text,p_to text,p_increment numeric default null)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare source public.units_of_measure%rowtype; target public.units_of_measure%rowtype; result numeric;
begin
 if p_quantity is null or p_quantity::text in('NaN','Infinity','-Infinity') or p_quantity<=0
 or p_quantity>999999999999.999999 or round(p_quantity,6)<>p_quantity then
  raise exception 'INVALID_MEASUREMENT_QUANTITY' using errcode='22023';end if;
 select * into source from public.units_of_measure where code=p_from and is_active;
 if not found then raise exception 'MEASUREMENT_UNIT_NOT_FOUND' using errcode='22023';end if;
 select * into target from public.units_of_measure where code=p_to and is_active;
 if not found then raise exception 'MEASUREMENT_UNIT_NOT_FOUND' using errcode='22023';end if;
 if source.dimension='package' or target.dimension='package' then
  raise exception 'PRODUCT_PACKAGING_REQUIRED' using errcode='22023';end if;
 if source.dimension<>target.dimension then raise exception 'INCOMPATIBLE_MEASUREMENT_DIMENSION' using errcode='22023';end if;
 if round(p_quantity,source.allowed_precision)<>p_quantity then
  raise exception 'INVALID_MEASUREMENT_PRECISION' using errcode='22023';end if;
 result:=p_quantity*source.canonical_conversion_factor/target.canonical_conversion_factor;
 -- Equality after multiplication detects inexact NUMERIC division as well as
 -- scale loss, including repeating conversions such as meters to feet.
 if result*target.canonical_conversion_factor<>p_quantity*source.canonical_conversion_factor
 or result>999999999999.999999 or round(result,target.allowed_precision)<>result then
  raise exception 'UNREPRESENTABLE_MEASUREMENT_QUANTITY' using errcode='22023';end if;
 if p_increment is not null and (p_increment::text in('NaN','Infinity','-Infinity') or p_increment<=0
 or p_increment>1 or round(p_increment,target.allowed_precision)<>p_increment or mod(result,p_increment)<>0) then
  raise exception 'INVALID_MEASUREMENT_INCREMENT' using errcode='22023';end if;
 return result;
end;$$;
revoke all on function shop_private.convert_measurement(numeric,text,text,numeric) from public,anon,authenticated,service_role;

create function public.prepare_product_measurement(p_shop_id uuid,p_product_id uuid,p_base_unit_code text,p_quantity_increment text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; product public.products%rowtype; unit public.units_of_measure%rowtype; increment numeric;
begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'products.manage');
 select * into product from public.products where id=p_product_id and shop_id=p_shop_id and is_active for update;
 if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
 if p_quantity_increment is null or p_quantity_increment !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$'
 or p_reason is null or length(btrim(p_reason)) not between 3 and 500 then
  raise exception 'INVALID_PRODUCT_MEASUREMENT' using errcode='22023';end if;
 increment:=p_quantity_increment::numeric;
 select * into unit from public.units_of_measure where code=p_base_unit_code and is_active and dimension<>'package';
 if not found then raise exception 'MEASUREMENT_UNIT_NOT_FOUND' using errcode='22023';end if;
 perform shop_private.convert_measurement(increment,unit.code,unit.code,increment);
 if increment>1 then raise exception 'INVALID_MEASUREMENT_INCREMENT' using errcode='22023';end if;
 if product.measurement_status='prepared' and product.base_unit_code=unit.code and product.quantity_increment=increment then
  return jsonb_build_object('baseUnitCode',unit.code,'quantityIncrement',trim_scale(increment)::text,'status','prepared');
 end if;
 -- A zero balance is not proof of no history. Drafts and public offers matter too.
 if exists(select 1 from public.inventory_batches where product_id=product.id)
 or exists(select 1 from public.inventory_movements where product_id=product.id)
 or exists(select 1 from public.invoice_items where product_id=product.id)
 or exists(select 1 from public.vendor_invoice_items where product_id=product.id)
 or exists(select 1 from public.stock_counts where product_id=product.id)
 or exists(select 1 from public.inventory_threshold_changes where product_id=product.id)
 or exists(select 1 from public.service_material_units where product_id=product.id)
 or exists(select 1 from public.shop_website_catalog_entries where product_id=product.id)
 or exists(select 1 from public.shop_catalog_offers o where o.shop_id=p_shop_id and exists(
  select 1 from jsonb_array_elements(o.lines) l where l->>'kind'='product' and l->>'sourceId'=product.id::text))
 or product.reorder_threshold<>0 then
  raise exception 'MEASUREMENT_REQUIRES_UNUSED_PRODUCT' using errcode='55000';end if;
 update public.products set base_unit_code=unit.code,quantity_increment=increment,measurement_status='prepared',updated_at=now()
 where id=product.id and shop_id=p_shop_id;
 insert into public.product_measurement_changes(shop_id,product_id,previous_unit_code,previous_quantity_increment,previous_measurement_status,base_unit_code,quantity_increment,reason,actor_profile_id)
 values(p_shop_id,product.id,product.base_unit_code,product.quantity_increment,product.measurement_status,unit.code,increment,btrim(p_reason),actor);
 return jsonb_build_object('baseUnitCode',unit.code,'quantityIncrement',trim_scale(increment)::text,'status','prepared');
end;$$;
revoke all on function public.prepare_product_measurement(uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.prepare_product_measurement(uuid,uuid,text,text,text) to authenticated;

create function public.resolve_product_measurement(p_shop_id uuid,p_product_id uuid,p_quantity text,p_unit_code text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare product public.products%rowtype; quantity numeric; result numeric;
begin
 if auth.uid() is null or not shop_private.has_permission(p_shop_id,'products.view') then
  raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501';end if;
 select * into product from public.products where id=p_product_id and shop_id=p_shop_id and is_active;
 if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
 if product.measurement_status<>'prepared' then raise exception 'PRODUCT_MEASUREMENT_NOT_CONFIGURED' using errcode='55000';end if;
 if p_quantity is null or p_quantity !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' then
  raise exception 'INVALID_MEASUREMENT_QUANTITY' using errcode='22023';end if;
 quantity:=p_quantity::numeric;
 result:=shop_private.convert_measurement(quantity,p_unit_code,product.base_unit_code,product.quantity_increment);
 return jsonb_build_object('enteredQuantity',trim_scale(quantity)::text,'enteredUnitCode',p_unit_code,
  'baseQuantity',trim_scale(result)::text,'baseUnitCode',product.base_unit_code,
  'quantityIncrement',trim_scale(product.quantity_increment)::text,'status','prepared');
end;$$;
revoke all on function public.resolve_product_measurement(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.resolve_product_measurement(uuid,uuid,text,text) to authenticated;

-- Old writers do not know measurement snapshots/precision. Block prepared
-- products at their common persistence boundary, regardless of the caller/RPC.
create function shop_private.guard_prepared_measurement_stock() returns trigger
language plpgsql security definer set search_path='' as $$
declare status text; target_shop uuid;
begin
 if tg_table_name='vendor_invoice_items' then
  select shop_id into target_shop from public.vendor_invoices where id=new.vendor_invoice_id;
 else target_shop:=new.shop_id;
 end if;
 if new.product_id is not null then
  select measurement_status into status from public.products where id=new.product_id and shop_id=target_shop for share;
  if status='prepared' then raise exception 'MEASUREMENT_WORKFLOW_NOT_READY' using errcode='55000';end if;
 end if;
 return new;
end;$$;
revoke all on function shop_private.guard_prepared_measurement_stock() from public,anon,authenticated,service_role;
create trigger measurement_stock_guard before insert or update on public.inventory_batches
 for each row execute function shop_private.guard_prepared_measurement_stock();
create trigger measurement_movement_guard before insert or update on public.inventory_movements
 for each row execute function shop_private.guard_prepared_measurement_stock();
create trigger measurement_sale_guard before insert or update on public.invoice_items
 for each row execute function shop_private.guard_prepared_measurement_stock();
create trigger measurement_purchase_guard before insert or update on public.vendor_invoice_items
 for each row execute function shop_private.guard_prepared_measurement_stock();
create trigger measurement_count_guard before insert on public.stock_counts
 for each row execute function shop_private.guard_prepared_measurement_stock();

-- Preserve declarations created after this migration as well as existing ones.
create function shop_private.guard_service_measurement_declaration() returns trigger
language plpgsql security definer set search_path='' as $$
declare status text;
begin
 select measurement_status into status from public.products where id=new.product_id and shop_id=new.shop_id for update;
 if status='prepared' then raise exception 'MEASUREMENT_WORKFLOW_NOT_READY' using errcode='55000';end if;
 update public.products set base_unit_code=case new.unit when 'each' then 'ea' when 'mL' then 'ml' else 'g' end
 where id=new.product_id and shop_id=new.shop_id;
 return new;
end;$$;
revoke all on function shop_private.guard_service_measurement_declaration() from public,anon,authenticated,service_role;
create trigger measurement_service_unit_guard before insert on public.service_material_units
 for each row execute function shop_private.guard_service_measurement_declaration();

create function shop_private.guard_prepared_measurement_threshold() returns trigger
language plpgsql set search_path='' as $$begin
 if new.measurement_status='prepared' and new.reorder_threshold is distinct from old.reorder_threshold then
  raise exception 'MEASUREMENT_WORKFLOW_NOT_READY' using errcode='55000';end if;
 return new;
end;$$;
revoke all on function shop_private.guard_prepared_measurement_threshold() from public,anon,authenticated,service_role;
create trigger measurement_threshold_guard before update of reorder_threshold on public.products
 for each row execute function shop_private.guard_prepared_measurement_threshold();

notify pgrst,'reload schema';
