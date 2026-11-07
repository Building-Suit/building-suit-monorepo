begin;
-- Ordering is a planning agreement. Stock, purchase debt and payments continue
-- to live in the existing posted supplier invoice and FIFO ledgers.
create table public.supplier_orders(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),location_id uuid not null,vendor_id uuid not null,
 order_number text not null,status text not null default 'draft' check(status in('draft','issued','partially_received','received','cancelled')),
 revision integer not null default 1 check(revision>0),currency text not null,vendor_name text not null,expected_on date,notes text,
 estimated_total numeric(18,2) not null check(estimated_total>=0),created_by_profile_id uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 unique(id,shop_id),unique(id,shop_id,location_id),unique(shop_id,order_number),
 foreign key(location_id,shop_id) references public.shop_locations(id,shop_id),foreign key(vendor_id,shop_id) references public.vendors(id,shop_id)
);
create table public.supplier_order_lines(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,order_id uuid not null,line_order integer not null check(line_order between 1 and 100),
 product_id uuid not null,product_name text not null,quantity numeric(18,6) not null check(quantity>0),entered_quantity numeric(18,6) not null check(entered_quantity>0),
 unit_cost numeric(24,12) not null check(unit_cost>=0),estimated_total numeric(18,2) not null check(estimated_total>=0),
 measurement_snapshot jsonb,original_input jsonb not null,
 unique(id,shop_id),unique(id,order_id,shop_id),unique(order_id,product_id),unique(order_id,line_order),
 foreign key(order_id,shop_id) references public.supplier_orders(id,shop_id),foreign key(product_id,shop_id) references public.products(id,shop_id)
);
alter table public.vendor_invoices add unique(id,shop_id,location_id);
alter table public.vendor_invoice_items add unique(id,vendor_invoice_id);
create table public.supplier_order_receipts(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,location_id uuid not null,order_id uuid not null,invoice_id uuid not null unique,
 reason text not null check(length(btrim(reason)) between 3 and 1000),actor_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 unique(id,shop_id,order_id,invoice_id),foreign key(order_id,shop_id,location_id) references public.supplier_orders(id,shop_id,location_id),
 foreign key(invoice_id,shop_id,location_id) references public.vendor_invoices(id,shop_id,location_id)
);
create table public.supplier_order_receipt_items(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,order_id uuid not null,receipt_id uuid not null,invoice_id uuid not null,order_line_id uuid not null,invoice_item_id uuid not null unique,
 quantity numeric(18,6) not null check(quantity>0),entered_quantity numeric(18,6) not null check(entered_quantity>0),
 foreign key(receipt_id,shop_id,order_id,invoice_id) references public.supplier_order_receipts(id,shop_id,order_id,invoice_id),
 foreign key(order_line_id,order_id,shop_id) references public.supplier_order_lines(id,order_id,shop_id),
 foreign key(invoice_item_id,invoice_id) references public.vendor_invoice_items(id,vendor_invoice_id)
);
create table public.supplier_order_events(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,order_id uuid not null,revision integer not null,
 action text not null check(action in('save','issue','cancel','receive')),previous_status text,status text not null,
 reason text not null check(length(btrim(reason)) between 3 and 1000),actor_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 unique(order_id,revision),foreign key(order_id,shop_id) references public.supplier_orders(id,shop_id)
);
create index supplier_orders_directory on public.supplier_orders(shop_id,location_id,created_at desc,id);
create index supplier_order_history on public.supplier_order_events(order_id,created_at desc,id);
create index supplier_receipt_history on public.supplier_order_receipts(order_id,created_at desc,id);
create index supplier_received_quantity on public.supplier_order_receipt_items(order_line_id);
create table shop_private.supplier_order_counters(shop_id uuid primary key references public.shops(id),last_number bigint not null check(last_number>0));
create table shop_private.supplier_order_requests(
 shop_id uuid not null references public.shops(id),request_id uuid not null,actor_profile_id uuid not null references public.profiles(id),payload jsonb not null,result jsonb,
 created_at timestamptz not null default clock_timestamp(),primary key(shop_id,request_id)
);
-- A server-created plan preserves the issued purchase unit/package version.
-- Browser callers cannot provide a resolution or gain execution of this table.
create table shop_private.supplier_receipt_plans(
 shop_id uuid not null,request_id uuid not null,product_id uuid not null,actor_profile_id uuid not null references public.profiles(id),
 input jsonb not null,resolved jsonb not null,
 primary key(shop_id,request_id,product_id),foreign key(shop_id,request_id) references shop_private.supplier_order_requests(shop_id,request_id),
 foreign key(product_id,shop_id) references public.products(id,shop_id)
);
do $$declare t text;begin
 foreach t in array array['supplier_orders','supplier_order_lines','supplier_order_receipts','supplier_order_receipt_items','supplier_order_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to service_role',t);
  execute format('create policy supplier_order_service_read on public.%I for select to service_role using(true)',t);
 end loop;
 foreach t in array array['supplier_order_receipts','supplier_order_receipt_items','supplier_order_events'] loop
  execute format('create trigger supplier_order_history_immutable before update or delete on public.%I for each row execute function shop_private.measurement_history_immutable()',t);
 end loop;
 foreach t in array array['supplier_order_counters','supplier_order_requests','supplier_receipt_plans'] loop
  execute format('revoke all on shop_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end;$$;
create function shop_private.guard_supplier_order_lines() returns trigger language plpgsql set search_path='' as $$begin
 if (select status from public.supplier_orders where id=coalesce(new.order_id,old.order_id) and shop_id=coalesce(new.shop_id,old.shop_id)) is distinct from 'draft' then
  raise exception 'ISSUED_SUPPLIER_ORDER_IMMUTABLE' using errcode='55000';end if;
 return coalesce(new,old);
end;$$;
revoke all on function shop_private.guard_supplier_order_lines() from public,anon,authenticated,service_role;
create trigger supplier_order_line_guard before insert or update or delete on public.supplier_order_lines for each row execute function shop_private.guard_supplier_order_lines();
create function shop_private.supplier_order_received(p_line uuid) returns numeric language sql volatile set search_path='' as $$
 select coalesce(sum(quantity),0) from public.supplier_order_receipt_items where order_line_id=p_line;
$$;
revoke all on function shop_private.supplier_order_received(uuid) from public,anon,authenticated,service_role;

create function public.supplier_order_command(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_action text,p_order_id uuid,p_revision integer,p_values jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;request shop_private.supplier_order_requests%rowtype;o public.supplier_orders%rowtype;payload jsonb;r jsonb;
 input jsonb;resolved jsonb;rows jsonb:='[]';product public.products%rowtype;line public.supplier_order_lines%rowtype;vendor public.vendors%rowtype;
 v_currency text;quantity numeric;entered numeric;cost numeric;total numeric:=0;expected date;counter bigint;position integer:=0;previous text;begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'vendor_invoices.manage');perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 perform 1 from public.shops where id=p_shop_id for update;
 actor:=shop_private.assert_shop_write_access(p_shop_id,'vendor_invoices.manage');perform shop_private.assert_purchase_entitlement(p_shop_id);
 if p_request_id is null or p_action is null or p_action not in('save','issue','cancel') or p_revision is null or p_revision<0
 or jsonb_typeof(p_values) is distinct from 'object' or p_reason is null or length(btrim(p_reason)) not between 3 and 1000
 or (p_order_id is null and (p_action<>'save' or p_revision<>0)) then raise exception 'INVALID_SUPPLIER_ORDER' using errcode='22023';end if;
 payload:=jsonb_build_object('action',p_action,'order',p_order_id,'location',p_location_id,'revision',p_revision,'values',p_values,'reason',btrim(p_reason));
 insert into shop_private.supplier_order_requests(shop_id,request_id,actor_profile_id,payload) values(p_shop_id,p_request_id,actor,payload) on conflict do nothing;
 select * into request from shop_private.supplier_order_requests where shop_id=p_shop_id and request_id=p_request_id for update;
 if request.actor_profile_id<>actor or request.payload<>payload then raise exception 'SUPPLIER_ORDER_REQUEST_CONFLICT' using errcode='23505';end if;
 if request.result is not null then return request.result;end if;
 select business_currency into v_currency from public.shops where id=p_shop_id;
 if p_order_id is not null then
  select * into o from public.supplier_orders where id=p_order_id and shop_id=p_shop_id and location_id=p_location_id for update;
  if not found then raise exception 'SUPPLIER_ORDER_NOT_FOUND' using errcode='P0002';end if;
  if o.revision<>p_revision then raise exception 'SUPPLIER_ORDER_CONTEXT_CHANGED' using errcode='55000';end if;
  if o.status in('cancelled','received') or (p_action in('save','issue') and o.status<>'draft') then raise exception 'SUPPLIER_ORDER_STATE_DENIED' using errcode='55000';end if;
  previous:=o.status;
 end if;
 if p_action='save' then
  if jsonb_typeof(p_values->'lines') is distinct from 'array' or jsonb_array_length(p_values->'lines') not between 1 and 100
  or length(coalesce(p_values->>'notes',''))>1000 or coalesce(p_values->>'vendorId','') !~ '^[0-9a-fA-F-]{36}$'
  then raise exception 'INVALID_SUPPLIER_ORDER' using errcode='22023';end if;
  if p_values->>'expectedOn' is not null and p_values->>'expectedOn'<>'' then
   if p_values->>'expectedOn' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'INVALID_SUPPLIER_ORDER_DATE' using errcode='22023';end if;
   expected:=(p_values->>'expectedOn')::date;
  end if;
  select * into vendor from public.vendors where id=(p_values->>'vendorId')::uuid and shop_id=p_shop_id and is_active;
  if not found then raise exception 'VENDOR_NOT_FOUND' using errcode='P0002';end if;
  if (select count(distinct value->>'product_id') from jsonb_array_elements(p_values->'lines'))<>jsonb_array_length(p_values->'lines') then raise exception 'DUPLICATE_SUPPLIER_ORDER_PRODUCT' using errcode='22023';end if;
  perform 1 from public.products where shop_id=p_shop_id and id in(select(value->>'product_id')::uuid from jsonb_array_elements(p_values->'lines')) order by id for update;
  for input in select value from jsonb_array_elements(p_values->'lines') loop
   if jsonb_typeof(input) is distinct from 'object' or coalesce(input->>'quantity','') !~ '^[0-9]{1,7}(\.[0-9]{1,6})?$'
   or coalesce(input->>'unit_cost','') !~ '^[0-9]{1,9}(\.[0-9]{1,6})?$' then raise exception 'INVALID_SUPPLIER_ORDER_LINE' using errcode='22023';end if;
   input:=input||jsonb_build_object('quantity',trim_scale((input->>'quantity')::numeric)::text,'unit_cost',trim_scale((input->>'unit_cost')::numeric)::text);
   select * into product from public.products where id=(input->>'product_id')::uuid and shop_id=p_shop_id and is_active;
   if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
   resolved:=shop_private.resolve_measured_line(p_shop_id,product.id,input,true);
   if resolved->'measurement'<>'null'::jsonb then resolved:=jsonb_set(resolved,'{measurement}',resolved->'measurement'||jsonb_build_object('reelTracking',shop_private.is_reel_tracked(p_shop_id,product.id)));end if;
   quantity:=(resolved->>'baseQuantity')::numeric;entered:=(input->>'quantity')::numeric;
   cost:=case when resolved->'measurement'='null'::jsonb then (input->>'unit_cost')::numeric else (resolved->>'baseUnitPrice')::numeric end;
   if quantity<=0 or quantity>1000000 or round(quantity,shop_private.quantity_scale(p_shop_id,product.id,3))<>quantity or cost<0 or cost>999999999.99
    or round(cost,case when product.measurement_status='active' then 12 else 2 end)<>cost then raise exception 'INVALID_SUPPLIER_ORDER_LINE' using errcode='22023';end if;
   total:=total+round(quantity*cost,2);position:=position+1;
   rows:=rows||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'position',position,'product',product.id,'name',product.name,'quantity',quantity,'entered',entered,'cost',cost,'total',round(quantity*cost,2),'measurement',resolved->'measurement','input',input));
  end loop;
  if total>9999999999.99 then raise exception 'INVALID_SUPPLIER_ORDER_TOTAL' using errcode='22023';end if;
  if o.id is null then
   insert into shop_private.supplier_order_counters(shop_id,last_number) values(p_shop_id,1) on conflict(shop_id) do update set last_number=shop_private.supplier_order_counters.last_number+1 returning last_number into counter;
   insert into public.supplier_orders(shop_id,location_id,vendor_id,order_number,currency,vendor_name,expected_on,notes,estimated_total,created_by_profile_id)
   values(p_shop_id,p_location_id,vendor.id,'PO-'||case when length(counter::text)<8 then lpad(counter::text,8,'0') else counter::text end,v_currency,vendor.name,expected,nullif(btrim(p_values->>'notes'),''),total,actor) returning * into o;
  else
   delete from public.supplier_order_lines where order_id=o.id;
   update public.supplier_orders set vendor_id=vendor.id,currency=v_currency,vendor_name=vendor.name,expected_on=expected,notes=nullif(btrim(p_values->>'notes'),''),estimated_total=total where id=o.id;
  end if;
  for input in select value from jsonb_array_elements(rows) loop
   insert into public.supplier_order_lines(id,shop_id,order_id,line_order,product_id,product_name,quantity,entered_quantity,unit_cost,estimated_total,measurement_snapshot,original_input)
   values((input->>'id')::uuid,p_shop_id,o.id,(input->>'position')::integer,(input->>'product')::uuid,input->>'name',(input->>'quantity')::numeric,(input->>'entered')::numeric,(input->>'cost')::numeric,(input->>'total')::numeric,nullif(input->'measurement','null'),input->'input');
  end loop;
 elsif p_action='issue' then
  if o.currency<>v_currency then raise exception 'SUPPLIER_ORDER_CURRENCY_CHANGED' using errcode='55000';end if;
  if not exists(select 1 from public.vendors where id=o.vendor_id and shop_id=p_shop_id and is_active) then raise exception 'VENDOR_NOT_FOUND' using errcode='P0002';end if;
  perform 1 from public.products where shop_id=p_shop_id and id in(select product_id from public.supplier_order_lines where order_id=o.id) order by id for update;
  for line in select * from public.supplier_order_lines where order_id=o.id order by line_order loop
   resolved:=shop_private.resolve_measured_line(p_shop_id,line.product_id,line.original_input,true);
   if resolved->'measurement'<>'null'::jsonb then resolved:=jsonb_set(resolved,'{measurement}',resolved->'measurement'||jsonb_build_object('reelTracking',shop_private.is_reel_tracked(p_shop_id,line.product_id)));end if;
   if resolved->'measurement' is distinct from coalesce(line.measurement_snapshot,'null'::jsonb) then raise exception 'SUPPLIER_ORDER_MEASUREMENT_CHANGED' using errcode='55000';end if;
  end loop;
  update public.supplier_orders set status='issued' where id=o.id;
 else
  update public.supplier_orders set status='cancelled' where id=o.id;
 end if;
 update public.supplier_orders set revision=case when previous is null then revision else revision+1 end,updated_at=clock_timestamp() where id=o.id returning * into o;
 insert into public.supplier_order_events(shop_id,order_id,revision,action,previous_status,status,reason,actor_profile_id)
 values(p_shop_id,o.id,o.revision,p_action,previous,o.status,btrim(p_reason),actor);
 perform shop_private.bump_realtime(p_shop_id,p_location_id,'inventory');
 r:=jsonb_build_object('id',o.id,'revision',o.revision,'status',o.status);
 update shop_private.supplier_order_requests set result=r where shop_id=p_shop_id and request_id=p_request_id;
 return r;
end;$$;
revoke all on function public.supplier_order_command(uuid,uuid,uuid,text,uuid,integer,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.supplier_order_command(uuid,uuid,uuid,text,uuid,integer,jsonb,text) to authenticated;

create function public.receive_supplier_order(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_order_id uuid,p_revision integer,p_received_on date,p_invoice_number text,p_items jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;request shop_private.supplier_order_requests%rowtype;o public.supplier_orders%rowtype;line public.supplier_order_lines%rowtype;
 product public.products%rowtype;payload jsonb;r jsonb;entry jsonb;input jsonb;measurement jsonb;resolved jsonb;items jsonb:='[]';received jsonb:='[]';
 quantity numeric;entered numeric;remaining numeric;factor numeric;invoice uuid;receipt uuid:=gen_random_uuid();invoice_item uuid;previous text;v_currency text;begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'vendor_invoices.manage');perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 perform 1 from public.shops where id=p_shop_id for update;
 actor:=shop_private.assert_shop_write_access(p_shop_id,'vendor_invoices.manage');perform shop_private.assert_purchase_entitlement(p_shop_id);
 if p_request_id is null or p_order_id is null or p_revision is null or p_revision<1 or p_received_on is null or not isfinite(p_received_on)
 or length(coalesce(p_invoice_number,''))>120 or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100
 or p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then raise exception 'INVALID_SUPPLIER_RECEIPT' using errcode='22023';end if;
 payload:=jsonb_build_object('action','receive','order',p_order_id,'location',p_location_id,'revision',p_revision,'receivedOn',p_received_on,'invoiceNumber',nullif(btrim(p_invoice_number),''),'items',p_items,'reason',btrim(p_reason));
 insert into shop_private.supplier_order_requests(shop_id,request_id,actor_profile_id,payload) values(p_shop_id,p_request_id,actor,payload) on conflict do nothing;
 select * into request from shop_private.supplier_order_requests where shop_id=p_shop_id and request_id=p_request_id for update;
 if request.actor_profile_id<>actor or request.payload<>payload then raise exception 'SUPPLIER_ORDER_REQUEST_CONFLICT' using errcode='23505';end if;
 if request.result is not null then return request.result;end if;
 if exists(select 1 from public.vendor_invoices where shop_id=p_shop_id and request_id=p_request_id) then raise exception 'SUPPLIER_RECEIPT_REQUEST_CONFLICT' using errcode='23505';end if;
 select * into o from public.supplier_orders where id=p_order_id and shop_id=p_shop_id and location_id=p_location_id for update;
 if not found then raise exception 'SUPPLIER_ORDER_NOT_FOUND' using errcode='P0002';end if;
 if o.revision<>p_revision then raise exception 'SUPPLIER_ORDER_CONTEXT_CHANGED' using errcode='55000';end if;
 if o.status not in('issued','partially_received') then raise exception 'SUPPLIER_ORDER_STATE_DENIED' using errcode='55000';end if;
 select business_currency into v_currency from public.shops where id=p_shop_id;
 if o.currency<>v_currency then raise exception 'SUPPLIER_ORDER_CURRENCY_CHANGED' using errcode='55000';end if;
 if (select count(distinct value->>'lineId') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise exception 'DUPLICATE_SUPPLIER_ORDER_LINE' using errcode='22023';end if;
 perform 1 from public.products where shop_id=p_shop_id and id in(select product_id from public.supplier_order_lines where order_id=o.id) order by id for update;
 for entry in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(entry) is distinct from 'object' or coalesce(entry->>'quantity','') !~ '^[0-9]{1,7}(\.[0-9]{1,6})?$' then raise exception 'INVALID_SUPPLIER_RECEIPT_QUANTITY' using errcode='22023';end if;
  select * into line from public.supplier_order_lines where id=(entry->>'lineId')::uuid and order_id=o.id and shop_id=p_shop_id;
  if not found then raise exception 'SUPPLIER_ORDER_LINE_NOT_FOUND' using errcode='P0002';end if;
  select * into product from public.products where id=line.product_id and shop_id=p_shop_id and is_active;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
  entered:=(entry->>'quantity')::numeric;factor:=line.quantity/line.entered_quantity;quantity:=entered*factor;remaining:=line.quantity-shop_private.supplier_order_received(line.id);
  if entered<=0 or quantity>remaining or round(quantity,6)<>quantity then raise exception 'SUPPLIER_RECEIPT_EXCEEDS_ORDER' using errcode='23514';end if;
  measurement:=line.measurement_snapshot;
  if measurement is null then
   if product.measurement_status<>'legacy' or round(quantity,3)<>quantity then raise exception 'SUPPLIER_ORDER_MEASUREMENT_CHANGED' using errcode='55000';end if;
  else
   if product.measurement_status<>'active' or product.base_unit_code is distinct from measurement->>'baseUnitCode' or product.measurement_revision is distinct from (measurement->>'productRevision')::integer
   or shop_private.is_reel_tracked(p_shop_id,product.id) is distinct from (measurement->>'reelTracking')::boolean then raise exception 'SUPPLIER_ORDER_MEASUREMENT_CHANGED' using errcode='55000';end if;
   perform shop_private.assert_measured_quantity(p_shop_id,product.id,quantity);
   if measurement->>'packageId' is not null and trunc(entered)<>entered then raise exception 'WHOLE_PACKAGE_QUANTITY_REQUIRED' using errcode='22023';end if;
   measurement:=measurement||jsonb_build_object('baseQuantity',trim_scale(quantity)::text,'enteredQuantity',trim_scale(entered)::text);
  end if;
  input:=line.original_input||jsonb_build_object('quantity',trim_scale(entered)::text);
  if entry ? 'reel_barcodes' then input:=input||jsonb_build_object('reel_barcodes',entry->'reel_barcodes');end if;
  resolved:=jsonb_build_object('baseQuantity',trim_scale(quantity)::text,'baseUnitPrice',trim_scale(line.unit_cost)::text,'measurement',measurement);
  insert into shop_private.supplier_receipt_plans(shop_id,request_id,product_id,actor_profile_id,input,resolved) values(p_shop_id,p_request_id,product.id,actor,input,resolved);
  items:=items||jsonb_build_array(input);received:=received||jsonb_build_array(jsonb_build_object('line',line.id,'product',product.id,'quantity',quantity,'entered',entered));
 end loop;
 perform set_config('shop.location_id',p_location_id::text,true);
 -- The reviewed existing purchase command still owns validation, the accounting
 -- period, invoice number/currency, FIFO, physical reels and supplier liability.
 invoice:=shop_private.create_supplier_purchase(p_request_id,p_shop_id,o.vendor_id,p_invoice_number,p_received_on,btrim(p_reason),items);
 insert into public.supplier_order_receipts(id,shop_id,location_id,order_id,invoice_id,reason,actor_profile_id) values(receipt,p_shop_id,p_location_id,o.id,invoice,btrim(p_reason),actor);
 for entry in select value from jsonb_array_elements(received) loop
  select id into invoice_item from public.vendor_invoice_items where vendor_invoice_id=invoice and product_id=(entry->>'product')::uuid;
  if invoice_item is null then raise exception 'SUPPLIER_RECEIPT_MAPPING_FAILED' using errcode='23514';end if;
  insert into public.supplier_order_receipt_items(shop_id,order_id,receipt_id,invoice_id,order_line_id,invoice_item_id,quantity,entered_quantity)
  values(p_shop_id,o.id,receipt,invoice,(entry->>'line')::uuid,invoice_item,(entry->>'quantity')::numeric,(entry->>'entered')::numeric);
 end loop;
 previous:=o.status;
 update public.supplier_orders set revision=revision+1,status=case when exists(select 1 from public.supplier_order_lines l where l.order_id=o.id and shop_private.supplier_order_received(l.id)<l.quantity) then 'partially_received' else 'received' end,updated_at=clock_timestamp() where id=o.id returning * into o;
 insert into public.supplier_order_events(shop_id,order_id,revision,action,previous_status,status,reason,actor_profile_id) values(p_shop_id,o.id,o.revision,'receive',previous,o.status,btrim(p_reason),actor);
 perform shop_private.bump_realtime(p_shop_id,p_location_id,'inventory');
 r:=jsonb_build_object('id',o.id,'revision',o.revision,'status',o.status,'receiptId',receipt,'invoiceId',invoice);
 update shop_private.supplier_order_requests set result=r where shop_id=p_shop_id and request_id=p_request_id;
 return r;
end;$$;
revoke all on function public.receive_supplier_order(uuid,uuid,uuid,uuid,integer,date,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.receive_supplier_order(uuid,uuid,uuid,uuid,integer,date,text,jsonb,text) to authenticated;

-- Preserve the reviewed ordinary purchase path; only a private, actor-bound
-- order receipt plan supplies an already issued historical package resolution.
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.create_supplier_purchase(uuid,uuid,uuid,text,date,text,jsonb)'::regprocedure) is distinct from '580f7e5d9b5091e4303c74d0c065178e' then raise exception 'SUPPLIER_ORDER_PURCHASE_REVIEW_REQUIRED' using errcode='55000';end if;end;$$;
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
  v_receipt_plan shop_private.supplier_receipt_plans%rowtype;
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
   select * into v_receipt_plan from shop_private.supplier_receipt_plans where shop_id=p_shop_id and request_id=p_request_id and product_id=(v_input->>'product_id')::uuid;
   if found then
    if v_receipt_plan.actor_profile_id<>v_profile_id or v_receipt_plan.input is distinct from v_input then raise exception 'SUPPLIER_RECEIPT_PLAN_MISMATCH' using errcode='23514';end if;
    v_resolved:=v_receipt_plan.resolved;
   else
    v_resolved:=shop_private.resolve_measured_line(p_shop_id,(v_input->>'product_id')::uuid,v_input,true);
   end if;
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

  perform p.id from public.products p where p.shop_id=p_shop_id and p.id in(select(v->>'product_id')::uuid from jsonb_array_elements(v_items)v) order by p.id for update;
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
    perform shop_private.register_purchase_reels(p_shop_id,v_item.product_id,v_batch_id,v_snapshots->v_item.product_id::text,
      (select e from jsonb_array_elements(v_original)e where e->>'product_id'=v_item.product_id::text),v_profile_id);

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

create function shop_private.guard_supplier_order_document() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' then raise exception 'SUPPLIER_ORDER_HISTORY_REQUIRED' using errcode='55000';end if;
 if (new.id,new.shop_id,new.location_id,new.order_number,new.created_by_profile_id,new.created_at)
  is distinct from (old.id,old.shop_id,old.location_id,old.order_number,old.created_by_profile_id,old.created_at)
 or (old.status<>'draft' and (new.vendor_id,new.vendor_name,new.currency,new.expected_on,new.notes,new.estimated_total)
  is distinct from (old.vendor_id,old.vendor_name,old.currency,old.expected_on,old.notes,old.estimated_total))
 then raise exception 'ISSUED_SUPPLIER_ORDER_IMMUTABLE' using errcode='55000';end if;
 if old.status in('received','cancelled') and new.status<>old.status then raise exception 'SUPPLIER_ORDER_STATE_DENIED' using errcode='55000';end if;
 return new;
end;$$;
revoke all on function shop_private.guard_supplier_order_document() from public,anon,authenticated,service_role;
create trigger supplier_order_document_guard before update or delete on public.supplier_orders for each row execute function shop_private.guard_supplier_order_document();
create function shop_private.check_supplier_received_capacity() returns trigger language plpgsql security definer set search_path='' as $$
declare line public.supplier_order_lines%rowtype;begin
 select * into line from public.supplier_order_lines where id=new.order_line_id and order_id=new.order_id and shop_id=new.shop_id;
 if not found or new.quantity*line.entered_quantity<>new.entered_quantity*line.quantity or shop_private.supplier_order_received(line.id)>line.quantity then raise exception 'SUPPLIER_RECEIPT_EXCEEDS_ORDER' using errcode='23514';end if;
 return null;
end;$$;
revoke all on function shop_private.check_supplier_received_capacity() from public,anon,authenticated,service_role;
create constraint trigger supplier_received_capacity after insert on public.supplier_order_receipt_items deferrable initially deferred for each row execute function shop_private.check_supplier_received_capacity();

create function public.supplier_order_context(p_shop_id uuid,p_location_id uuid,p_order_id uuid default null,p_search text default null,p_status text default null,p_page integer default 1,p_history_page integer default 1,p_receipt_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.supplier_orders%rowtype;items jsonb;detail jsonb;lines jsonb;history jsonb;receipts jsonb;total bigint;history_total bigint;receipt_total bigint;can_manage boolean;begin
 perform shop_private.assert_supplier_read_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_page is null or p_page<1 or p_history_page is null or p_history_page<1 or p_receipt_page is null or p_receipt_page<1 or length(coalesce(p_search,''))>120
 or (p_status is not null and p_status not in('draft','issued','partially_received','received','cancelled')) then raise exception 'INVALID_SUPPLIER_ORDER_QUERY' using errcode='22023';end if;
 can_manage:=shop_private.has_permission(p_shop_id,'vendor_invoices.manage');
 select count(*) into total from public.supplier_orders s where s.shop_id=p_shop_id and s.location_id=p_location_id and (p_status is null or s.status=p_status)
 and (nullif(btrim(p_search),'') is null or s.order_number ilike '%'||btrim(p_search)||'%' or s.vendor_name ilike '%'||btrim(p_search)||'%');
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]') into items from(
  select s.id,s.order_number,s.status,s.revision,s.currency,s.vendor_id,s.vendor_name,s.expected_on,s.created_at,trim_scale(s.estimated_total)::text estimated_total
  from public.supplier_orders s where s.shop_id=p_shop_id and s.location_id=p_location_id and (p_status is null or s.status=p_status)
  and (nullif(btrim(p_search),'') is null or s.order_number ilike '%'||btrim(p_search)||'%' or s.vendor_name ilike '%'||btrim(p_search)||'%') order by s.created_at desc,s.id offset(p_page-1)*20 limit 20)r;
 if p_order_id is not null then
  select * into o from public.supplier_orders where id=p_order_id and shop_id=p_shop_id and location_id=p_location_id;
  if not found then raise exception 'SUPPLIER_ORDER_NOT_FOUND' using errcode='P0002';end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.line_order),'[]') into lines from(
   select l.id,l.line_order,l.product_id,l.product_name,trim_scale(l.quantity)::text quantity,trim_scale(l.entered_quantity)::text entered_quantity,
    trim_scale(l.unit_cost)::text unit_cost,trim_scale(l.estimated_total)::text estimated_total,l.measurement_snapshot,l.original_input,
    trim_scale(coalesce(received.quantity,0))::text received_quantity,trim_scale(l.quantity-coalesce(received.quantity,0))::text remaining_quantity,
    trim_scale(coalesce(received.entered,0))::text received_entered_quantity,trim_scale(l.entered_quantity-coalesce(received.entered,0))::text remaining_entered_quantity
   from public.supplier_order_lines l left join lateral(select sum(quantity) quantity,sum(entered_quantity) entered from public.supplier_order_receipt_items where order_line_id=l.id) received on true
   where l.order_id=o.id and l.shop_id=p_shop_id order by l.line_order limit 100)r;
  select count(*) into history_total from public.supplier_order_events where order_id=o.id and shop_id=p_shop_id;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]') into history from(
   select e.id,e.revision,e.action,e.previous_status,e.status,e.reason,e.created_at,(select display_name from public.profiles where id=e.actor_profile_id) actor_name
   from public.supplier_order_events e where e.order_id=o.id and e.shop_id=p_shop_id order by e.created_at desc,e.id offset(p_history_page-1)*20 limit 20)r;
  select count(*) into receipt_total from public.supplier_order_receipts where order_id=o.id and shop_id=p_shop_id;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]') into receipts from(
   select receipt.id,receipt.invoice_id,i.invoice_number,i.status invoice_status,i.issued_at,trim_scale(i.total_amount)::text total,receipt.reason,receipt.created_at,
    (select display_name from public.profiles where id=receipt.actor_profile_id) actor_name
   from public.supplier_order_receipts receipt join public.vendor_invoices i on i.id=receipt.invoice_id and i.shop_id=receipt.shop_id
   where receipt.order_id=o.id and receipt.shop_id=p_shop_id order by receipt.created_at desc,receipt.id offset(p_receipt_page-1)*20 limit 20)r;
  detail:=jsonb_build_object('record',to_jsonb(o)||jsonb_build_object('estimated_total',trim_scale(o.estimated_total)::text),'lines',lines,
   'history',history,'historyTotal',history_total,'historyPage',p_history_page,'receipts',receipts,'receiptTotal',receipt_total,'receiptPage',p_receipt_page,
   'canEdit',can_manage and o.status='draft','canIssue',can_manage and o.status='draft','canReceive',can_manage and o.status in('issued','partially_received'),
   'canCancel',can_manage and o.status in('draft','issued','partially_received'));
 end if;
 return jsonb_build_object('items',items,'total',total,'page',p_page,'pageSize',20,'detail',detail,'canManage',can_manage);
end;$$;
revoke all on function public.supplier_order_context(uuid,uuid,uuid,text,text,integer,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.supplier_order_context(uuid,uuid,uuid,text,text,integer,integer,integer) to authenticated;
commit;
