begin;
alter table public.trade_orders add unique(id,shop_id,location_id);
alter table public.trade_order_lines add unique(id,order_id,shop_id);
alter table public.inventory_reels add unique(id,batch_id,shop_id,location_id);
create table public.trade_order_reservations (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,location_id uuid not null,order_id uuid not null,line_id uuid not null,
 product_id uuid not null,batch_id uuid not null,reel_id uuid,
 quantity numeric(18,6) not null check(quantity>0),sale_quantity numeric(18,6) not null check(sale_quantity>0 and sale_quantity<=quantity),
 remaining_quantity numeric(18,6) not null,remaining_sale_quantity numeric(18,6) not null,
 status text not null default 'active' check(status in('active','released','expired','fulfilled')),
 expires_at timestamptz not null,created_by_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 released_at timestamptz,released_by_profile_id uuid references public.profiles(id),release_reason text,
 unique(id,shop_id),foreign key(order_id,shop_id,location_id) references public.trade_orders(id,shop_id,location_id),
 foreign key(line_id,order_id,shop_id) references public.trade_order_lines(id,order_id,shop_id),
 foreign key(batch_id,shop_id,location_id) references public.inventory_batches(id,shop_id,location_id),
 foreign key(batch_id,shop_id,product_id) references public.inventory_batches(id,shop_id,product_id),
 foreign key(reel_id,batch_id,shop_id,location_id) references public.inventory_reels(id,batch_id,shop_id,location_id),
 check(remaining_quantity between 0 and quantity and remaining_sale_quantity between 0 and sale_quantity and remaining_sale_quantity<=remaining_quantity),
 check((status='active' and remaining_quantity>0 and released_at is null and released_by_profile_id is null and release_reason is null)
  or (status<>'active' and remaining_quantity=0 and remaining_sale_quantity=0 and released_at is not null and released_by_profile_id is not null and length(btrim(release_reason)) between 3 and 1000))
);
create index order_reservation_batch_capacity on public.trade_order_reservations(batch_id,expires_at) where status='active';
create index order_reservation_reel_capacity on public.trade_order_reservations(reel_id,expires_at) where status='active';
create index order_reservation_product_capacity on public.trade_order_reservations(shop_id,location_id,product_id,expires_at) where status='active';
create index order_reservation_order on public.trade_order_reservations(order_id,created_at,id);
create table public.trade_order_reservation_events (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,reservation_id uuid not null,order_id uuid not null,
 action text not null check(action in('reserve','release','expire','fulfill')),quantity_change numeric(18,6) not null,
 sale_quantity_change numeric(18,6) not null,reason text not null check(length(btrim(reason)) between 3 and 1000),
 actor_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 foreign key(reservation_id,shop_id) references public.trade_order_reservations(id,shop_id),foreign key(order_id,shop_id) references public.trade_orders(id,shop_id)
);
create index order_reservation_history on public.trade_order_reservation_events(order_id,created_at desc,id);
do $$declare t text;begin
 foreach t in array array['trade_order_reservations','trade_order_reservation_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated,service_role',t);
  execute format('create policy order_reservation_service_read on public.%I for select to service_role using(true)',t);
 end loop;
end;$$;
create trigger order_reservation_history_immutable before update or delete on public.trade_order_reservation_events for each row execute function shop_private.measurement_history_immutable();
create function shop_private.protect_order_reservation() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or old.status<>'active' or row(new.id,new.shop_id,new.location_id,new.order_id,new.line_id,new.product_id,new.batch_id,new.reel_id,new.quantity,new.sale_quantity,new.expires_at,new.created_by_profile_id,new.created_at)
 is distinct from row(old.id,old.shop_id,old.location_id,old.order_id,old.line_id,old.product_id,old.batch_id,old.reel_id,old.quantity,old.sale_quantity,old.expires_at,old.created_by_profile_id,old.created_at)
 or new.remaining_quantity>old.remaining_quantity or new.remaining_sale_quantity>old.remaining_sale_quantity then raise exception 'ORDER_RESERVATION_IMMUTABLE' using errcode='55000';end if;
 return new;
end;$$;
revoke all on function shop_private.protect_order_reservation() from public,anon,authenticated,service_role;
create trigger protect_order_reservation before update or delete on public.trade_order_reservations for each row execute function shop_private.protect_order_reservation();

create function shop_private.reserved_batch_quantity(p_batch uuid) returns numeric language sql volatile set search_path='' as $$
 select coalesce(sum(remaining_quantity),0) from public.trade_order_reservations where batch_id=p_batch and status='active' and expires_at>statement_timestamp();
$$;
create function shop_private.reserved_reel_quantity(p_reel uuid) returns numeric language sql volatile set search_path='' as $$
 select coalesce(sum(remaining_quantity),0) from public.trade_order_reservations where reel_id=p_reel and status='active' and expires_at>statement_timestamp();
$$;
revoke all on function shop_private.reserved_batch_quantity(uuid),shop_private.reserved_reel_quantity(uuid) from public,anon,authenticated,service_role;

-- Deferred capacity checks also cover counts, supplier returns, scrapping and
-- other existing stock commands. No client flag can bypass another order's hold.
create function shop_private.check_order_reservation_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
declare batch uuid;stock numeric;held numeric;line uuid;begin
 if tg_table_name='inventory_batches' then batch:=coalesce(new.id,old.id);
 else batch:=coalesce(new.batch_id,old.batch_id);end if;
 select remaining_quantity into stock from public.inventory_batches where id=batch;
 held:=shop_private.reserved_batch_quantity(batch);
 if held>coalesce(stock,0) then raise exception 'STOCK_RESERVED_FOR_ORDER' using errcode='23514';end if;
 if exists(select 1 from public.inventory_reels r where r.batch_id=batch and shop_private.reserved_reel_quantity(r.id)>0
  and (r.status not in('sealed','open') or r.classification not in('sellable','discounted') or shop_private.reserved_reel_quantity(r.id)>r.remaining_length)) then raise exception 'REEL_RESERVED_FOR_ORDER' using errcode='23514';end if;
 if tg_table_name='trade_order_reservations' then
  line:=coalesce(new.line_id,old.line_id);
  if (select coalesce(sum(remaining_sale_quantity),0) from public.trade_order_reservations where line_id=line and status='active' and expires_at>statement_timestamp())
   >(select quantity from public.trade_order_lines where id=line) then raise exception 'ORDER_RESERVATION_EXCEEDS_QUANTITY' using errcode='23514';end if;
 end if;
 return null;
end;$$;
revoke all on function shop_private.check_order_reservation_capacity() from public,anon,authenticated,service_role;
create constraint trigger order_reservation_capacity after insert or update or delete on public.trade_order_reservations deferrable initially deferred for each row execute function shop_private.check_order_reservation_capacity();
create constraint trigger order_reservation_batch_capacity after update or delete on public.inventory_batches deferrable initially deferred for each row execute function shop_private.check_order_reservation_capacity();
create constraint trigger order_reservation_reel_capacity after update or delete on public.inventory_reels deferrable initially deferred for each row execute function shop_private.check_order_reservation_capacity();

create function public.reserve_trade_order(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_order_id uuid,p_revision integer,p_action text,p_lines jsonb,p_expires_at timestamptz,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;request shop_private.trade_order_requests%rowtype;payload jsonb;v_result jsonb;o public.trade_orders%rowtype;
 previous public.trade_order_reservations%rowtype;line public.trade_order_lines%rowtype;product public.products%rowtype;b public.inventory_batches%rowtype;
 input jsonb;measurement jsonb;plan jsonb;entry jsonb;id uuid;quantity numeric;loss numeric;remaining numeric;available numeric;take_qty numeric;factor numeric;
 count integer:=0;expire boolean;begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'sales.manage');perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 if p_request_id is null or p_order_id is null or p_revision is null or p_revision<1 or p_action is null or p_action not in('reserve','release','expire','cancel')
 or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)>100 or (p_action='reserve' and jsonb_array_length(p_lines)=0)
 or (p_action<>'reserve' and jsonb_array_length(p_lines)<>0) or p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then raise exception 'INVALID_ORDER_RESERVATION' using errcode='22023';end if;
 payload:=jsonb_build_object('action',p_action,'order',p_order_id,'location',p_location_id,'revision',p_revision,'lines',p_lines,'expiresAt',p_expires_at,'reason',btrim(p_reason));
 insert into shop_private.trade_order_requests(shop_id,request_id,actor_profile_id,payload) values(p_shop_id,p_request_id,actor,payload) on conflict do nothing;
 select * into request from shop_private.trade_order_requests where shop_id=p_shop_id and request_id=p_request_id for update;
 if request.actor_profile_id<>actor or request.payload<>payload then raise exception 'ORDER_REQUEST_CONFLICT' using errcode='23505';end if;
 if request.result is not null then return request.result;end if;
 perform 1 from public.shops where shops.id=p_shop_id for update;
 select * into o from public.trade_orders where trade_orders.id=p_order_id and shop_id=p_shop_id and location_id=p_location_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002';end if;
 if o.revision<>p_revision then raise exception 'ORDER_CONTEXT_CHANGED' using errcode='55000';end if;
 if o.status<>'open' then raise exception 'ORDER_RESERVATION_STATE_DENIED' using errcode='55000';end if;
 if p_action='reserve' and (p_expires_at is null or p_expires_at<=clock_timestamp() or p_expires_at>clock_timestamp()+interval '31 days') then raise exception 'INVALID_RESERVATION_EXPIRY' using errcode='22023';end if;
 if (select count(distinct value->>'lineId') from jsonb_array_elements(p_lines))<>jsonb_array_length(p_lines) then raise exception 'DUPLICATE_ORDER_LINE' using errcode='22023';end if;
 perform 1 from public.products where shop_id=p_shop_id and products.id in(select product_id from public.trade_order_lines where order_id=o.id and item_type='product') order by products.id for update;
 perform 1 from public.inventory_reels where shop_id=p_shop_id and location_id=p_location_id and product_id in(select product_id from public.trade_order_lines where order_id=o.id and item_type='product') order by product_id,inventory_reels.id for update;
 perform 1 from public.inventory_batches where shop_id=p_shop_id and location_id=p_location_id and product_id in(select product_id from public.trade_order_lines where order_id=o.id and item_type='product') order by product_id,received_at,inventory_batches.id for update;
 for previous in select * from public.trade_order_reservations where order_id=o.id and shop_id=p_shop_id and status='active' and (p_action<>'expire' or expires_at<=clock_timestamp()) order by trade_order_reservations.id for update loop
  expire:=previous.expires_at<=clock_timestamp();
  update public.trade_order_reservations set status=case when expire then 'expired' else 'released' end,remaining_quantity=0,remaining_sale_quantity=0,released_at=clock_timestamp(),released_by_profile_id=actor,release_reason=btrim(p_reason) where trade_order_reservations.id=previous.id;
  insert into public.trade_order_reservation_events(shop_id,reservation_id,order_id,action,quantity_change,sale_quantity_change,reason,actor_profile_id)
  values(p_shop_id,previous.id,o.id,case when expire then 'expire' else 'release' end,-previous.remaining_quantity,-previous.remaining_sale_quantity,btrim(p_reason),actor);
 end loop;
 if p_action='reserve' then
  for input in select value from jsonb_array_elements(p_lines) loop
   select * into line from public.trade_order_lines where trade_order_lines.id=(input->>'lineId')::uuid and order_id=o.id and shop_id=p_shop_id and item_type='product';
   if not found then raise exception 'ORDER_PRODUCT_LINE_NOT_FOUND' using errcode='P0002';end if;
   if coalesce(input->>'quantity','') !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' or coalesce(input->>'cuttingLoss','0') !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' then raise exception 'INVALID_RESERVATION_QUANTITY' using errcode='22023';end if;
   quantity:=(input->>'quantity')::numeric;loss:=coalesce(input->>'cuttingLoss','0')::numeric;
   if quantity<=0 or quantity>line.quantity or loss>1000000 then raise exception 'ORDER_RESERVATION_EXCEEDS_QUANTITY' using errcode='22023';end if;
   select * into product from public.products where products.id=line.product_id and shop_id=p_shop_id and is_active;
   if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
   measurement:=line.measurement_snapshot;
   if measurement is null then
    if product.measurement_status<>'legacy' or round(quantity,3)<>quantity then raise exception 'ORDER_MEASUREMENT_CONTEXT_CHANGED' using errcode='55000';end if;
   else
    if product.measurement_status<>'active' or product.base_unit_code is distinct from measurement->>'baseUnitCode' or product.measurement_revision is distinct from (measurement->>'productRevision')::integer then raise exception 'ORDER_MEASUREMENT_CONTEXT_CHANGED' using errcode='55000';end if;
    perform shop_private.assert_measured_quantity(p_shop_id,product.id,quantity);
    factor:=(measurement->>'baseQuantity')::numeric/(measurement->>'enteredQuantity')::numeric;
    measurement:=measurement||jsonb_build_object('baseQuantity',trim_scale(quantity)::text,'enteredQuantity',trim_scale(quantity/factor)::text);
    if measurement->>'packageId' is not null and trunc(quantity/factor)<>quantity/factor then raise exception 'WHOLE_PACKAGE_QUANTITY_REQUIRED' using errcode='22023';end if;
   end if;
   if not shop_private.is_reel_tracked(p_shop_id,product.id) then
    if loss<>0 or input->>'reelId' is not null or coalesce((line.measurement_snapshot->>'reelTracking')::boolean,false) then raise exception 'ORDER_REEL_CONTEXT_CHANGED' using errcode='55000';end if;
    remaining:=quantity;
    for b in select * from public.inventory_batches where shop_id=p_shop_id and product_id=product.id and location_id=p_location_id and remaining_quantity>0 order by received_at,inventory_batches.id loop
     available:=b.remaining_quantity-shop_private.reserved_batch_quantity(b.id);take_qty:=least(remaining,greatest(available,0));
     if take_qty<=0 then continue;end if;
     insert into public.trade_order_reservations(shop_id,location_id,order_id,line_id,product_id,batch_id,quantity,sale_quantity,remaining_quantity,remaining_sale_quantity,expires_at,created_by_profile_id)
     values(p_shop_id,p_location_id,o.id,line.id,product.id,b.id,take_qty,take_qty,take_qty,take_qty,p_expires_at,actor) returning trade_order_reservations.id into id;
     insert into public.trade_order_reservation_events(shop_id,reservation_id,order_id,action,quantity_change,sale_quantity_change,reason,actor_profile_id) values(p_shop_id,id,o.id,'reserve',take_qty,take_qty,btrim(p_reason),actor);
     count:=count+1;remaining:=remaining-take_qty;exit when remaining=0;
    end loop;
    if remaining<>0 then raise exception 'INSUFFICIENT_AVAILABLE_STOCK' using errcode='23514';end if;
   else
    if loss>0 then perform shop_private.assert_measured_quantity(p_shop_id,product.id,loss);end if;
    measurement:=measurement||jsonb_build_object('cuttingLoss',trim_scale(loss)::text);
    if input->>'reelId' is not null then measurement:=measurement||jsonb_build_object('reelId',input->>'reelId');end if;
    plan:=shop_private.plan_reel_sale(p_shop_id,product.id,p_location_id,quantity,measurement);
    for entry in select value from jsonb_array_elements(plan) loop
     select * into b from public.inventory_batches where inventory_batches.id=(select batch_id from public.inventory_reels where inventory_reels.id=(entry->>'reelId')::uuid and shop_id=p_shop_id and location_id=p_location_id);
     take_qty:=(entry->>'soldQuantity')::numeric;available:=(entry->>'actualCutLength')::numeric;
     insert into public.trade_order_reservations(shop_id,location_id,order_id,line_id,product_id,batch_id,reel_id,quantity,sale_quantity,remaining_quantity,remaining_sale_quantity,expires_at,created_by_profile_id)
     values(p_shop_id,p_location_id,o.id,line.id,product.id,b.id,(entry->>'reelId')::uuid,available,take_qty,available,take_qty,p_expires_at,actor) returning trade_order_reservations.id into id;
     insert into public.trade_order_reservation_events(shop_id,reservation_id,order_id,action,quantity_change,sale_quantity_change,reason,actor_profile_id) values(p_shop_id,id,o.id,'reserve',available,take_qty,btrim(p_reason),actor);
     count:=count+1;
    end loop;
   end if;
   if count>1000 then raise exception 'TOO_MANY_ORDER_ALLOCATIONS' using errcode='22023';end if;
  end loop;
 end if;
 update public.trade_orders set revision=revision+1,status=case when p_action='cancel' then 'cancelled' else status end,updated_at=clock_timestamp() where trade_orders.id=o.id returning * into o;
 insert into public.trade_order_events(shop_id,order_id,revision,action,previous_status,status,reason,actor_profile_id) values(p_shop_id,o.id,o.revision,p_action,'open',o.status,btrim(p_reason),actor);
 perform shop_private.bump_realtime(p_shop_id,p_location_id,'inventory');
 perform shop_private.bump_realtime(p_shop_id,p_location_id,'pos');
 v_result:=jsonb_build_object('id',o.id,'revision',o.revision,'status',o.status,'allocations',count);
 update shop_private.trade_order_requests set result=v_result where shop_id=p_shop_id and request_id=p_request_id;
 return v_result;
end;$$;
revoke all on function public.reserve_trade_order(uuid,uuid,uuid,uuid,integer,text,jsonb,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function public.reserve_trade_order(uuid,uuid,uuid,uuid,integer,text,jsonb,timestamptz,text) to authenticated;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.plan_reel_sale(uuid,uuid,uuid,numeric,jsonb,jsonb)'::regprocedure) is distinct from 'c6628018460c9d8cecfe444d91843985' then raise exception 'RESERVATION_ROUTINE_REVIEW_REQUIRED: shop_private.plan_reel_sale' using errcode='55000';end if;end;$$;
create or replace function shop_private.plan_reel_sale(p_shop uuid,p_product uuid,p_location uuid,p_quantity numeric,p_measurement jsonb,p_used jsonb default '{}') returns jsonb
language plpgsql stable set search_path='' as $$
declare selected uuid:=nullif(p_measurement->>'reelId','')::uuid;split boolean:=coalesce((p_measurement->>'allowSplit')::boolean,false);
 loss numeric:=coalesce((p_measurement->>'cuttingLoss')::numeric,0);needed numeric:=p_quantity;factor numeric;packages integer;
 r record;available numeric;take_qty numeric;take_loss numeric;result jsonb:='[]';begin
 if not shop_private.is_reel_tracked(p_shop,p_product) then return '[]';end if;
 if p_quantity is null or p_quantity<=0 or loss<0 then raise exception 'INVALID_REEL_CUT' using errcode='22023';end if;
 if p_measurement->>'packageId' is not null then
  packages:=(p_measurement->>'enteredQuantity')::integer;factor:=p_quantity/packages;
  if loss<>0 or (selected is not null and packages<>1) then raise exception 'INVALID_SEALED_REEL_SALE' using errcode='22023';end if;
 end if;
 for r in select reel.*,batch.received_at from public.inventory_reels reel join public.inventory_batches batch on batch.id=reel.batch_id
 where reel.shop_id=p_shop and reel.product_id=p_product and reel.location_id=p_location
 and reel.status in('sealed','open') and reel.classification in('sellable','discounted') and (selected is null or reel.id=selected)
 and (reel.classification='sellable' or selected=reel.id)
 order by batch.received_at,reel.id loop
  available:=r.remaining_length-shop_private.reserved_reel_quantity(r.id)-coalesce((p_used->>r.id::text)::numeric,0);
  if available<=0 then continue;end if;
  take_loss:=0;
  if packages is not null then
   if r.status<>'sealed' or r.original_length<>factor or available<>factor then continue;end if;
   take_qty:=factor;packages:=packages-1;
  elsif not split then
   if available<needed+loss then continue;end if;
   take_qty:=needed;take_loss:=loss;
  elsif available>=needed+loss then take_qty:=needed;take_loss:=loss;
  elsif available<needed then take_qty:=available;
  else take_qty:=greatest(available-loss,0);end if;
  if take_qty<=0 then continue;end if;
  result:=result||jsonb_build_array(jsonb_build_object('reelId',r.id,'barcode',r.barcode,'soldQuantity',trim_scale(take_qty)::text,
   'cuttingLoss',trim_scale(take_loss)::text,'actualCutLength',trim_scale(take_qty+take_loss)::text,'kind',case when packages is not null then 'sealed_sale' else 'cut' end));
  needed:=needed-take_qty;
  if jsonb_array_length(result)>1000 then raise exception 'TOO_MANY_REEL_ALLOCATIONS' using errcode='22023';end if;
  exit when needed=0;
 end loop;
 if needed<>0 then
  if selected is not null then raise exception 'SELECTED_REEL_CANNOT_FULFILL' using errcode='23514';end if;
  if packages is not null then raise exception 'INSUFFICIENT_SEALED_REELS' using errcode='23514';end if;
  if not split then raise exception 'CONTINUOUS_LENGTH_UNAVAILABLE' using errcode='23514';end if;
  raise exception 'INSUFFICIENT_REEL_LENGTH' using errcode='23514';
 end if;
 return result;
end;$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.consume_product_sale_line(uuid,uuid,uuid,uuid)'::regprocedure) is distinct from 'd17be2ec8f96388d38dc1e83314a5c35' then raise exception 'RESERVATION_ROUTINE_REVIEW_REQUIRED: shop_private.consume_product_sale_line' using errcode='55000';end if;end;$$;
create or replace function shop_private.consume_product_sale_line(p_shop uuid,p_invoice uuid,p_line uuid,p_actor uuid) returns void
language plpgsql set search_path='' as $$
declare line public.invoice_items%rowtype;location uuid;r public.inventory_reels%rowtype;b public.inventory_batches%rowtype;
 plan jsonb;entry jsonb;qty numeric;loss numeric;physical numeric;remaining numeric;take_qty numeric;cut uuid;movement uuid;loss_movement uuid;begin
 select * into line from public.invoice_items where id=p_line and shop_id=p_shop and invoice_id=p_invoice and item_type='product';
 select location_id into location from public.invoices where id=p_invoice and shop_id=p_shop;
 if not found or line.id is null or location is null then raise exception 'SALE_LINE_NOT_FOUND' using errcode='P0002';end if;
 if not shop_private.is_reel_tracked(p_shop,line.product_id) then
  remaining:=line.quantity;
  for b in select * from public.inventory_batches where shop_id=p_shop and product_id=line.product_id and location_id=location and remaining_quantity>0 order by received_at,id for update loop
   take_qty:=least(remaining,greatest(b.remaining_quantity-shop_private.reserved_batch_quantity(b.id),0));
   if take_qty<=0 then continue;end if;
   update public.inventory_batches set remaining_quantity=remaining_quantity-take_qty where id=b.id;
   insert into public.inventory_movements(shop_id,location_id,product_id,batch_id,quantity_change,movement_type,reference_id,created_by_profile_id,unit_cost_snapshot,invoice_item_id)
   values(p_shop,location,line.product_id,b.id,-take_qty,'out',p_invoice,p_actor,b.unit_cost,line.id);
   remaining:=remaining-take_qty;exit when remaining=0;
  end loop;
  if remaining<>0 then raise exception 'INSUFFICIENT_STOCK' using errcode='23514';end if;
  return;
 end if;
 plan:=line.measurement_snapshot->'reelAllocations';
 if jsonb_typeof(plan) is distinct from 'array' or jsonb_array_length(plan)<1
 or (select sum((e->>'soldQuantity')::numeric) from jsonb_array_elements(plan)e)<>line.quantity
 or (select sum((e->>'cuttingLoss')::numeric) from jsonb_array_elements(plan)e)<>coalesce((line.measurement_snapshot->>'cuttingLoss')::numeric,0) then raise exception 'SERVER_REEL_PLAN_REQUIRED' using errcode='55000';end if;
 for entry in select value from jsonb_array_elements(plan) loop
  qty:=(entry->>'soldQuantity')::numeric;loss:=(entry->>'cuttingLoss')::numeric;physical:=qty+loss;cut:=gen_random_uuid();loss_movement:=null;
  select * into r from public.inventory_reels where id=(entry->>'reelId')::uuid and shop_id=p_shop and location_id=location and product_id=line.product_id for update;
  if not found or r.status not in('sealed','open') or r.classification not in('sellable','discounted') or r.remaining_length-shop_private.reserved_reel_quantity(r.id)<physical then raise exception 'REEL_PLAN_CHANGED' using errcode='23514';end if;
  select * into b from public.inventory_batches where id=r.batch_id and shop_id=p_shop and location_id=location for update;
  if not found or b.remaining_quantity-shop_private.reserved_batch_quantity(b.id)<physical then raise exception 'REEL_STOCK_RECONCILIATION_REQUIRED' using errcode='23514';end if;
  perform shop_private.assert_measured_quantity(p_shop,line.product_id,qty);
  if loss>0 then perform shop_private.assert_measured_quantity(p_shop,line.product_id,loss);end if;
  update public.inventory_reels set remaining_length=remaining_length-physical,status=case when remaining_length=physical then 'empty' else 'open' end,last_movement_at=clock_timestamp() where id=r.id;
  update public.inventory_batches set remaining_quantity=remaining_quantity-physical where id=b.id;
  insert into public.inventory_movements(shop_id,location_id,product_id,batch_id,quantity_change,movement_type,reference_id,created_by_profile_id,unit_cost_snapshot,invoice_item_id)
  values(p_shop,location,line.product_id,b.id,-qty,'out',p_invoice,p_actor,b.unit_cost,line.id) returning id into movement;
  if loss>0 then
   insert into public.inventory_movements(shop_id,location_id,product_id,batch_id,quantity_change,movement_type,reference_id,created_by_profile_id,unit_cost_snapshot)
   values(p_shop,location,line.product_id,b.id,-loss,'out',cut,p_actor,b.unit_cost) returning id into loss_movement;
  end if;
  insert into public.inventory_reel_cuts(id,shop_id,location_id,reel_id,invoice_item_id,requested_length,actual_cut_length,cutting_loss,resulting_remaining_length,kind,sale_movement_id,loss_movement_id,actor_profile_id)
  values(cut,p_shop,location,r.id,line.id,qty,physical,loss,r.remaining_length-physical,entry->>'kind',movement,loss_movement,p_actor);
  insert into public.inventory_reel_movements(shop_id,location_id,reel_id,kind,quantity_change,value_change,inventory_movement_id,reference_id,reason,snapshot,actor_profile_id)
  values(p_shop,location,r.id,entry->>'kind',-physical,-physical*b.unit_cost,movement,cut,'Issued reel sale',entry||jsonb_build_object('resultingRemainingLength',trim_scale(r.remaining_length-physical)::text,'invoiceId',p_invoice),p_actor);
 end loop;
end;$$;

create function public.trade_order_reservation_context(p_shop_id uuid,p_location_id uuid,p_order_id uuid,p_page integer default 1,p_history_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.trade_orders%rowtype;items jsonb;history jsonb;stock jsonb;total bigint;history_total bigint;begin
 perform shop_private.assert_sale_read_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_page is null or p_page<1 or p_history_page is null or p_history_page<1 then raise exception 'INVALID_RESERVATION_QUERY' using errcode='22023';end if;
 select * into o from public.trade_orders where id=p_order_id and shop_id=p_shop_id and location_id=p_location_id;
 if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002';end if;
 select count(*) into total from public.trade_order_reservations where order_id=o.id and shop_id=p_shop_id;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]') into items from(
  select res.id,res.line_id,res.product_id,res.reel_id,reel.barcode,res.expires_at,res.created_at,
   trim_scale(res.quantity)::text quantity,trim_scale(res.sale_quantity)::text sale_quantity,trim_scale(res.remaining_quantity)::text remaining_quantity,
   trim_scale(res.remaining_sale_quantity)::text remaining_sale_quantity,case when res.status='active' and res.expires_at<=statement_timestamp() then 'expired' else res.status end status
  from public.trade_order_reservations res left join public.inventory_reels reel on reel.id=res.reel_id and reel.shop_id=res.shop_id
  where res.order_id=o.id and res.shop_id=p_shop_id order by res.created_at desc,res.id offset (p_page-1)*20 limit 20)r;
 select count(*) into history_total from public.trade_order_reservation_events where order_id=o.id and shop_id=p_shop_id;
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('actor_name',(select display_name from public.profiles where id=e.actor_profile_id)) order by e.created_at desc,e.id),'[]') into history from(
  select id,reservation_id,action,trim_scale(quantity_change)::text quantity_change,trim_scale(sale_quantity_change)::text sale_quantity_change,reason,actor_profile_id,created_at
  from public.trade_order_reservation_events where order_id=o.id and shop_id=p_shop_id order by created_at desc,id offset (p_history_page-1)*20 limit 20)e;
 select coalesce(jsonb_agg(jsonb_build_object('lineId',line.id,'productId',line.product_id,'name',line.item_name,
  'unitCode',coalesce(line.measurement_snapshot->>'baseUnitCode','ea'),'unitNameEn',coalesce(line.measurement_snapshot->>'baseUnitNameEn','Piece'),'unitNameAr',coalesce(line.measurement_snapshot->>'baseUnitNameAr','قطعة'),
  'orderedQuantity',trim_scale(line.quantity)::text,'onHand',trim_scale(coalesce(onhand.quantity,0))::text,
  'reserved',trim_scale(coalesce(held.quantity,0))::text,'orderReserved',trim_scale(coalesce(own.quantity,0))::text,
  'available',trim_scale(greatest((case when shop_private.is_reel_tracked(p_shop_id,line.product_id) then coalesce(sellable.quantity,0) else coalesce(onhand.quantity,0) end)-coalesce(held.quantity,0),0))::text,
  'reelTracked',shop_private.is_reel_tracked(p_shop_id,line.product_id)) order by line.line_order),'[]') into stock
 from public.trade_order_lines line
 left join lateral(select sum(remaining_quantity) quantity from public.inventory_batches where shop_id=p_shop_id and location_id=p_location_id and product_id=line.product_id)onhand on true
 left join lateral(select sum(remaining_length) quantity from public.inventory_reels where shop_id=p_shop_id and location_id=p_location_id and product_id=line.product_id and status in('sealed','open') and classification in('sellable','discounted'))sellable on true
 left join lateral(select sum(remaining_quantity) quantity from public.trade_order_reservations where shop_id=p_shop_id and location_id=p_location_id and product_id=line.product_id and status='active' and expires_at>statement_timestamp())held on true
 left join lateral(select sum(remaining_sale_quantity) quantity from public.trade_order_reservations where line_id=line.id and shop_id=p_shop_id and status='active' and expires_at>statement_timestamp())own on true
 where line.order_id=o.id and line.shop_id=p_shop_id and line.item_type='product';
 return jsonb_build_object('items',items,'total',total,'page',p_page,'pageSize',20,'history',history,'historyTotal',history_total,'historyPage',p_history_page,
  'stock',stock,'revision',o.revision,'status',o.status,'serverNow',statement_timestamp(),'canManage',shop_private.has_permission(p_shop_id,'sales.manage'));
end;$$;
revoke all on function public.trade_order_reservation_context(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.trade_order_reservation_context(uuid,uuid,uuid,integer,integer) to authenticated;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.reel_availability(uuid,uuid,uuid)'::regprocedure) is distinct from '6521e2b053123893980f7add5ebb2343' then raise exception 'RESERVATION_ROUTINE_REVIEW_REQUIRED: shop_private.reel_availability' using errcode='55000';end if;end;$$;
create or replace function shop_private.reel_availability(p_shop uuid,p_location uuid,p_product uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('baseUnitCode',(select base_unit_code from public.products where id=p_product and shop_id=p_shop),'reelCount',count(*),'onHand',trim_scale(coalesce(sum(remaining_length),0))::text,
 'available',trim_scale(coalesce(sum(greatest(remaining_length-shop_private.reserved_reel_quantity(id),0)) filter(where status in('sealed','open') and classification in('sellable','discounted')),0))::text,
 'largestContinuous',trim_scale(coalesce(max(greatest(remaining_length-shop_private.reserved_reel_quantity(id),0)) filter(where status in('sealed','open') and classification in('sellable','discounted')),0))::text,
 'largestAutomatic',trim_scale(coalesce(max(greatest(remaining_length-shop_private.reserved_reel_quantity(id),0)) filter(where status in('sealed','open') and classification='sellable'),0))::text,'automaticAvailable',trim_scale(coalesce(sum(greatest(remaining_length-shop_private.reserved_reel_quantity(id),0)) filter(where status in('sealed','open') and classification='sellable'),0))::text,
 'sealedByLength',(select coalesce(jsonb_object_agg(trim_scale(length)::text,n),'{}') from(select remaining_length length,count(*) n from public.inventory_reels where shop_id=p_shop and location_id=p_location and product_id=p_product and status='sealed' and classification='sellable' and shop_private.reserved_reel_quantity(id)=0 group by remaining_length)q),
 'reserved',trim_scale(coalesce(sum(shop_private.reserved_reel_quantity(id)),0))::text,'sealedCount',count(*) filter(where status='sealed' and classification='sellable' and shop_private.reserved_reel_quantity(id)=0))
 from public.inventory_reels where shop_id=p_shop and location_id=p_location and product_id=p_product and status<>'archived';
$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.pos_reel_options(uuid,uuid,uuid,text,integer)'::regprocedure) is distinct from '071dfc0638bf70647d1a7625d2b02ead' then raise exception 'RESERVATION_ROUTINE_REVIEW_REQUIRED: public.pos_reel_options' using errcode='55000';end if;end;$$;
create or replace function public.pos_reel_options(p_shop_id uuid,p_location_id uuid,p_product_id uuid,p_search text default null,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare items jsonb;total bigint;begin
 perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if not coalesce((select can_manage from shop_private.sale_access(p_shop_id)),false) then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501';end if;
 if p_page<1 or length(coalesce(p_search,''))>160 or not shop_private.is_reel_tracked(p_shop_id,p_product_id) then raise exception 'INVALID_REEL_QUERY' using errcode='22023';end if;
 with rows as(select r.*,b.received_at,count(*) over() total_count from public.inventory_reels r join public.inventory_batches b on b.id=r.batch_id
 where r.shop_id=p_shop_id and r.location_id=p_location_id and r.product_id=p_product_id and r.status in('sealed','open') and r.classification in('sellable','discounted') and r.remaining_length-shop_private.reserved_reel_quantity(r.id)>0
 and(nullif(btrim(p_search),'') is null or r.barcode ilike '%'||btrim(p_search)||'%' or coalesce(r.storage_position,'') ilike '%'||btrim(p_search)||'%')),
 paged as(select * from rows order by received_at,id offset(p_page-1)*20 limit 20)
 select (select count(*) from rows),coalesce(jsonb_agg(jsonb_build_object('id',id,'barcode',barcode,'remainingLength',trim_scale(greatest(remaining_length-shop_private.reserved_reel_quantity(id),0))::text,'onHandLength',trim_scale(remaining_length)::text,'reservedLength',trim_scale(shop_private.reserved_reel_quantity(id))::text,'originalLength',trim_scale(original_length)::text,'status',status,'classification',classification,'price',remnant_price,'storagePosition',storage_position,'revision',revision) order by received_at,id),'[]') into total,items from paged;
 return jsonb_build_object('items',items,'total',total,'page',p_page,'pageSize',20,'summary',shop_private.reel_availability(p_shop_id,p_location_id,p_product_id));
end;$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.inventory_reel_context(uuid,uuid,uuid,text,integer,integer,uuid,integer)'::regprocedure) is distinct from 'cf92a119db598ed3f385fccc235f0e47' then raise exception 'RESERVATION_ROUTINE_REVIEW_REQUIRED: public.inventory_reel_context' using errcode='55000';end if;end;$$;
create or replace function public.inventory_reel_context(p_shop_id uuid,p_location_id uuid,p_product_id uuid default null,p_search text default null,p_page integer default 1,p_page_size integer default 20,p_reel_id uuid default null,p_history_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb;total bigint;costs boolean;history jsonb;history_total bigint;enabled boolean;begin
 perform shop_private.assert_inventory_read_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 costs:=shop_private.has_permission(p_shop_id,'reports.cost_profit.view');
 select inventory_enabled into enabled from shop_private.inventory_access(p_shop_id);
 if p_page<1 or p_page_size not between 1 and 100 or p_history_page<1 or length(coalesce(p_search,''))>160 then raise exception 'INVALID_REEL_QUERY' using errcode='22023';end if;
 if p_product_id is not null and not exists(select 1 from public.products where id=p_product_id and shop_id=p_shop_id) then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
 if p_reel_id is not null and not exists(select 1 from public.inventory_reels where id=p_reel_id and shop_id=p_shop_id and location_id=p_location_id) then raise exception 'REEL_NOT_FOUND' using errcode='P0002';end if;
 with rows as(select r.*,p.name,p.sku,p.base_unit_code,b.unit_cost,count(*) over() total_count from public.inventory_reels r join public.products p on p.id=r.product_id and p.shop_id=r.shop_id join public.inventory_batches b on b.id=r.batch_id
 where r.shop_id=p_shop_id and r.location_id=p_location_id and (p_product_id is null or r.product_id=p_product_id)
 and (nullif(btrim(p_search),'') is null or r.barcode ilike '%'||btrim(p_search)||'%' or p.name ilike '%'||btrim(p_search)||'%' or coalesce(r.storage_position,'') ilike '%'||btrim(p_search)||'%')),
 paged as(select * from rows order by created_at desc,id offset(p_page-1)*p_page_size limit p_page_size)
 select (select count(*) from rows),coalesce(jsonb_agg(jsonb_build_object('id',id,'productId',product_id,'name',name,'sku',sku,'barcode',barcode,'unit',base_unit_code,
 'originalLength',trim_scale(original_length)::text,'remainingLength',trim_scale(remaining_length)::text,'reservedLength',trim_scale(shop_private.reserved_reel_quantity(id))::text,'status',status,'classification',classification,'storagePosition',storage_position,'revision',revision,
 'remnantPrice',remnant_price,'lastMovementAt',last_movement_at,'value',case when costs then remaining_length*unit_cost else null end) order by created_at desc,id),'[]') into total,items from paged;
 select count(*) into history_total from public.inventory_reel_movements where shop_id=p_shop_id and location_id=p_location_id and reel_id=p_reel_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'quantityChange',trim_scale(m.quantity_change)::text,'valueChange',case when costs then m.value_change else null end,'reason',m.reason,'createdAt',m.created_at,'actorName',profile.display_name,'snapshot',m.snapshot) order by m.created_at desc,m.id desc),'[]') into history
 from(select * from public.inventory_reel_movements where shop_id=p_shop_id and location_id=p_location_id and reel_id=p_reel_id order by created_at desc,id desc offset(p_history_page-1)*20 limit 20)m left join public.profiles profile on profile.id=m.actor_profile_id;
 return jsonb_build_object('items',items,'total',total,'page',p_page,'pageSize',p_page_size,'canManage',enabled and shop_private.has_permission(p_shop_id,'inventory.manage'),
 'canCount',enabled and shop_private.has_permission(p_shop_id,'inventory.manage') and shop_private.has_permission(p_shop_id,'inventory.adjust'),'canSetPrices',shop_private.has_permission(p_shop_id,'products.manage'),'canViewCosts',costs,
 'summary',case when p_product_id is not null then shop_private.reel_availability(p_shop_id,p_location_id,p_product_id) else jsonb_build_object('reelCount',total) end,
 'history',history,'historyTotal',history_total);
end;$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.pos_catalog_search(uuid,uuid,text,text,text,uuid,integer,integer)'::regprocedure) is distinct from 'a334f7bc855f8bcf6544d965264beebe' then raise exception 'RESERVATION_ROUTINE_REVIEW_REQUIRED: shop_private.pos_catalog_search' using errcode='55000';end if;end;$$;
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
    where product.shop_id = p_shop_id and product.is_active and v_mode in ('product', 'mixed')
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
commit;
