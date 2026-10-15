-- Invoice-linked append-only corrections. Debt-first is a Building Suit policy.
-- Refund reservations are obligations, never evidence of money movement.
-- Forward-only evidence for explicitly disabled/unconfigured tax calculation.
-- Historical receipts without tax evidence are not interpreted as zero-rated.
create table public.sale_return_sources (
 invoice_id uuid primary key,shop_id uuid not null,location_id uuid not null,snapshot jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(invoice_id,shop_id,location_id) references public.invoices(id,shop_id,location_id)
);
alter table public.sale_return_sources enable row level security;
revoke all on public.sale_return_sources from public,anon,authenticated,service_role;
create trigger return_source_immutable before update or delete on public.sale_return_sources for each row execute function shop_private.tax_immutable();
create trigger return_source_no_truncate before truncate on public.sale_return_sources for each statement execute function shop_private.tax_immutable();
create function shop_private.capture_return_source() returns trigger language plpgsql security definer set search_path='' as $$
declare policy public.tax_policy_versions%rowtype; lines jsonb; total numeric;
begin
 if old.status<>'draft' or new.status<>'issued' or exists(select 1 from public.sale_tax_snapshots where invoice_id=new.id) then return new;end if;
 select * into policy from public.tax_policy_versions where shop_id=new.shop_id and effective_at<=statement_timestamp() order by effective_at desc,created_at desc,id desc limit 1;
 if coalesce((policy.policy->>'enabled')::boolean,false) then return new;end if;
 select jsonb_agg(jsonb_build_object('id',l.id,'itemType',l.item_type,'originalQuantity',l.quantity,'originalUnitPrice',l.unit_price,
  'lineDiscount',l.discount_amount,'total',l.total_amount,'net',l.total_amount,'tax',0,'treatment','calculation-disabled') order by l.line_order,l.id),sum(l.total_amount)
 into lines,total from public.invoice_items l where l.invoice_id=new.id;
 if lines is null or total<>new.total_amount then return new;end if;
 insert into public.sale_return_sources(invoice_id,shop_id,location_id,snapshot)
 values(new.id,new.shop_id,new.location_id,jsonb_build_object('version',1,'source','forward-disabled-calculation','currency',new.currency,
  'calculationEnabled',false,'policyVersionId',policy.id,'total',total,'net',total,'tax',0,'lines',lines));
 return new;
end;$$;
create trigger zzz_return_source after update of status on public.invoices for each row execute function shop_private.capture_return_source();
revoke all on function shop_private.capture_return_source() from public,anon,authenticated,service_role;

create table public.sale_returns (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null, location_id uuid not null, invoice_id uuid not null,
 request_id uuid not null, payload jsonb not null, currency text not null, original_document jsonb not null,
 total numeric(12,2) not null check(total>=0), net numeric(12,2) not null check(net>=0), tax numeric(12,2) not null check(tax>=0),
 due_before numeric(12,2) not null check(due_before>=0), debt_reduction numeric(12,2) not null check(debt_reduction>=0),
 refund_due numeric(12,2) not null check(refund_due>=0), due_after numeric(12,2) not null check(due_after>=0),
 reason text not null check(length(btrim(reason)) between 2 and 1000), actor_profile_id uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(), unique(shop_id,request_id), unique(id,shop_id),
 foreign key(invoice_id,shop_id,location_id) references public.invoices(id,shop_id,location_id),
 check(total=net+tax and debt_reduction=least(total,due_before) and refund_due=greatest(total-due_before,0) and due_after=greatest(due_before-total,0))
);
create index sale_returns_invoice on public.sale_returns(invoice_id,created_at,id);
create table public.sale_return_lines (
 return_id uuid not null, shop_id uuid not null, line_id uuid not null, quantity numeric(12,2) not null check(quantity>0),
 disposition text not null check(disposition in('resellable','damaged','service')),
 original_snapshot jsonb not null, total numeric(12,2) not null check(total>=0), net numeric(12,2) not null check(net>=0), tax numeric(12,2) not null check(tax>=0),
 primary key(return_id,line_id), foreign key(return_id,shop_id) references public.sale_returns(id,shop_id),
 foreign key(line_id,shop_id) references public.invoice_items(id,shop_id), check(total=net+tax)
);
create index sale_return_lines_line on public.sale_return_lines(line_id);
create table public.sale_return_stock (
 return_id uuid not null, line_id uuid not null, movement_id uuid not null references public.inventory_movements(id),
 quantity numeric(12,2) not null check(quantity>0), disposition text not null check(disposition in('resellable','damaged')),
 restoration_movement_id uuid unique references public.inventory_movements(id), primary key(return_id,line_id,movement_id),
 foreign key(return_id,line_id) references public.sale_return_lines(return_id,line_id),
 check((disposition='resellable')=(restoration_movement_id is not null))
);
create index sale_return_stock_source on public.sale_return_stock(movement_id);
create table public.sale_return_refunds (
 id uuid primary key default gen_random_uuid(), return_id uuid not null, shop_id uuid not null,
 allocation_id uuid not null, payment_id uuid not null, amount numeric(12,2) not null check(amount>0),
 method public.payment_method not null, created_at timestamptz not null default clock_timestamp(), unique(return_id,allocation_id),
 foreign key(return_id,shop_id) references public.sale_returns(id,shop_id),
 foreign key(allocation_id,shop_id,payment_id) references public.customer_payment_allocations(id,shop_id,payment_id)
);
create index sale_return_refunds_allocation on public.sale_return_refunds(allocation_id);
create table public.sale_return_refund_events (
 id uuid primary key default gen_random_uuid(), refund_id uuid not null references public.sale_return_refunds(id),
 shop_id uuid not null references public.shops(id), request_id uuid not null, state text not null check(state in('pending','failed','completed')),
 operation text not null check(operation in('reserved','failed','external_record','cash_handover')),
 reference text not null check(length(reference)<=200), reason text not null check(length(btrim(reason)) between 2 and 1000),
 payment_id uuid unique references public.payments(id), actor_profile_id uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(), unique(shop_id,request_id),
 check((state='completed')=(payment_id is not null)),
 check((state='completed' and operation in('external_record','cash_handover')) or (state='pending' and operation='reserved') or (state='failed' and operation='failed'))
);
create unique index sale_return_refund_once on public.sale_return_refund_events(refund_id) where state='completed';
create index sale_return_refund_history on public.sale_return_refund_events(refund_id,created_at,id);
alter table public.payments add column sale_return_refund_id uuid unique references public.sale_return_refunds(id);

do $$declare t text;begin
 foreach t in array array['sale_returns','sale_return_lines','sale_return_stock','sale_return_refunds','sale_return_refund_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger return_history_immutable before update or delete on public.%I for each row execute function shop_private.tax_immutable()',t);
  execute format('create trigger return_history_no_truncate before truncate on public.%I for each statement execute function shop_private.tax_immutable()',t);
 end loop;
end;$$;

create function shop_private.return_actor(p_shop_id uuid,p_location_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'sales.issue');
 perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 if not shop_private.has_permission(p_shop_id,'payments.refund') or not exists(
  select 1 from public.shop_memberships m where m.shop_id=p_shop_id and m.profile_id=actor and m.status='active'
  and (m.role='owner' or exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id
    where mr.membership_id=m.id and r.shop_id=p_shop_id and r.key='manager' and r.is_system))) then
  raise exception 'RETURN_MANAGER_REQUIRED' using errcode='42501';end if;
 return actor;
end;$$;

-- Reservations, including failed attempts, retain capacity until the same obligation completes.
-- They cannot be released into an unlinked payout or silently retried at another tender.
create or replace function shop_private.allocation_remaining(p_allocation_id uuid)
returns numeric language sql stable security definer set search_path='' as $$
 select greatest(0,a.amount-coalesce((select sum(amount) from public.customer_payment_adjustments where original_allocation_id=a.id),0)
 -coalesce((select sum(amount) from public.sale_return_refunds where allocation_id=a.id),0))
 from public.customer_payment_allocations a where a.id=p_allocation_id;
$$;
create or replace function shop_private.invoice_outstanding(p_invoice_id uuid)
returns numeric language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.sale_corrections where invoice_id=i.id) then 0 else greatest(0,i.total_amount
 -coalesce((select sum(a.amount) from public.customer_payment_allocations a join public.payments p on p.id=a.payment_id
  where a.invoice_id=i.id and p.customer_kind='receipt' and p.status='completed'),0)
 +coalesce((select sum(ad.amount) from public.customer_payment_adjustments ad join public.customer_payment_allocations a on a.id=ad.original_allocation_id where a.invoice_id=i.id),0)
 -coalesce((select sum(r.debt_reduction) from public.sale_returns r where r.invoice_id=i.id),0)) end
 from public.invoices i where i.id=p_invoice_id;
$$;

-- Only immutable issuance evidence is accepted. No historical reconstruction.
create function shop_private.return_source(p_invoice_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select snapshot from public.sale_tax_snapshots where invoice_id=p_invoice_id
 union all select snapshot from public.sale_return_sources where invoice_id=p_invoice_id limit 1;
$$;

create function shop_private.return_plan(p_shop_id uuid,p_location_id uuid,p_invoice_id uuid,p_lines jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
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
  if jsonb_typeof(item->'quantity') is distinct from 'number' or qty is null or qty<=0 or qty>1000000 or round(qty,2)<>qty
   or (item-array['lineId','quantity','disposition'])<>'{}'::jsonb then raise exception 'INVALID_RETURN_QUANTITY_PRECISION' using errcode='22023';end if;
  select * into line from public.invoice_items where id=(item->>'lineId')::uuid and invoice_id=sale.id and shop_id=p_shop_id;
  if not found then raise exception 'RETURN_LINE_NOT_FOUND' using errcode='P0002';end if;
  if (line.item_type='service' and item->>'disposition' is distinct from 'service') or (line.item_type='product' and coalesce(item->>'disposition','') not in('resellable','damaged')) then
   raise exception 'INVALID_RETURN_DISPOSITION' using errcode='22023';end if;
  select value into frozen from jsonb_array_elements(source->'lines') where value->>'id'=line.id::text;
  if frozen is null or (frozen->>'originalQuantity')::numeric<>line.quantity then raise exception 'RETURN_ORIGINAL_SNAPSHOT_UNSUPPORTED' using errcode='55000';end if;
  if round(line.quantity,2)<>line.quantity then raise exception 'RETURN_ORIGINAL_QUANTITY_PRECISION_UNSUPPORTED' using errcode='55000';end if;
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

create function public.preview_sale_return(p_shop_id uuid,p_location_id uuid,p_invoice_id uuid,p_lines jsonb) returns jsonb
language sql security definer set search_path='' as $$select shop_private.return_plan(p_shop_id,p_location_id,p_invoice_id,p_lines);$$;

create function public.create_sale_return(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_invoice_id uuid,p_lines jsonb,p_reason text,p_expected_plan jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
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
    if fifo_part.unit_cost_snapshot is null or round(take_qty,2)<>take_qty then raise exception 'RETURN_FIFO_LINEAGE_UNSUPPORTED' using errcode='55000';end if;
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

-- Explicit evidence recording: this command never calls a payment provider.
-- A failed attempt keeps its reservation; retry uses the same refund ID.
create function public.record_sale_return_refund(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_refund_id uuid,p_operation text,p_reference text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; r public.sale_return_refunds%rowtype; ret public.sale_returns%rowtype; previous public.sale_return_refund_events%rowtype;
 original public.payments%rowtype; payment uuid; result uuid; stamp timestamptz:=clock_timestamp();
begin
 actor:=shop_private.return_actor(p_shop_id,p_location_id);
 if p_request_id is null or coalesce(p_operation,'') not in('failed','cash_handover','external_record') or length(btrim(coalesce(p_reason,''))) not between 2 and 1000
  or p_reference is null or length(p_reference)>200 then raise exception 'INVALID_REFUND_RECORD' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('return-refund:'||p_shop_id::text||':'||p_request_id::text,0));
 select * into r from public.sale_return_refunds where id=p_refund_id and shop_id=p_shop_id;
 select * into ret from public.sale_returns where id=r.return_id and shop_id=p_shop_id and location_id=p_location_id;
 if ret.id is null then raise exception 'RETURN_REFUND_NOT_FOUND' using errcode='P0002';end if;
 perform 1 from public.invoices where id=ret.invoice_id for update;
 select * into previous from public.sale_return_refund_events where shop_id=p_shop_id and request_id=p_request_id;
 if found then
  if previous.refund_id<>p_refund_id or previous.operation<>p_operation or previous.reference<>btrim(p_reference) or previous.reason<>btrim(p_reason) or previous.actor_profile_id<>actor then
   raise exception 'REFUND_REQUEST_CONFLICT' using errcode='23505';end if;
  return previous.id;
 end if;
 if exists(select 1 from public.sale_return_refund_events where refund_id=r.id and state='completed') then raise exception 'REFUND_ALREADY_COMPLETED' using errcode='23514';end if;
 perform shop_private.assert_period_is_open(p_shop_id,stamp);
 if p_operation<>'failed' then
  if (r.method='cash')<>(p_operation='cash_handover') then raise exception 'REFUND_ORIGINAL_TENDER_REQUIRED' using errcode='23514';end if;
  if p_operation='external_record' and length(btrim(p_reference))<2 then raise exception 'REFUND_EXTERNAL_EVIDENCE_REQUIRED' using errcode='22023';end if;
  if p_operation='cash_handover' then
   -- Keep this shift open until the payment's cash-event trigger has run.
   perform 1 from public.cash_sessions where shop_id=p_shop_id and location_id=p_location_id and register_key='main' and status='open' for update;
   if not found then raise exception 'REFUND_CASH_SHIFT_REQUIRED' using errcode='23514';end if;
  end if;
  select * into original from public.payments where id=r.payment_id and shop_id=p_shop_id;
  insert into public.payments(shop_id,location_id,payment_direction,invoice_id,client_id,amount,method,status,reference,paid_at,created_by_profile_id,notes,customer_kind,original_payment_id,sale_return_refund_id)
  values(p_shop_id,p_location_id,'out',ret.invoice_id,original.client_id,r.amount,r.method,'completed',btrim(p_reference),stamp,actor,btrim(p_reason),'refund',r.payment_id,r.id) returning id into payment;
 end if;
 insert into public.sale_return_refund_events(refund_id,shop_id,request_id,state,operation,reference,reason,payment_id,actor_profile_id)
 values(r.id,p_shop_id,p_request_id,case when p_operation='failed' then 'failed' else 'completed' end,p_operation,btrim(p_reference),btrim(p_reason),payment,actor) returning id into result;
 return result;
end;$$;

-- Block old all-or-nothing correction paths after any partial return and protect
-- the reservation boundary against old receipt-adjustment RPCs and concurrent writes.
create function shop_private.return_legacy_boundary() returns trigger language plpgsql security definer set search_path='' as $$
declare invoice uuid;
begin
 if tg_table_name='sale_corrections' then
  perform 1 from public.invoices where id=new.invoice_id for update;
  if exists(select 1 from public.sale_returns where invoice_id=new.invoice_id) then raise exception 'SALE_HAS_PARTIAL_RETURNS' using errcode='23514';end if;
 else
  select invoice_id into invoice from public.customer_payment_allocations where id=new.original_allocation_id;
  perform 1 from public.invoices where id=invoice for update;
  if new.amount>shop_private.allocation_remaining(new.original_allocation_id) then raise exception 'PAYMENT_ADJUSTMENT_EXCEEDS_EFFECTIVE_AMOUNT' using errcode='23514';end if;
  if exists(select 1 from public.sale_returns where invoice_id=invoice) then raise exception 'SALE_HAS_PARTIAL_RETURNS' using errcode='23514';end if;
 end if;
 return new;
end;$$;
create trigger aa_return_legacy_boundary before insert on public.sale_corrections for each row execute function shop_private.return_legacy_boundary();
create trigger aa_return_adjustment_boundary before insert on public.customer_payment_adjustments for each row execute function shop_private.return_legacy_boundary();

create function shop_private.return_service_boundary() returns trigger language plpgsql security definer set search_path='' as $$
declare line public.invoice_items%rowtype; returned numeric;
begin
 if new.line_id is null then return new;end if;
 select * into line from public.invoice_items where id=new.line_id;
 perform 1 from public.invoices where id=line.invoice_id for update;
 select coalesce(sum(quantity),0) into returned from public.sale_return_lines where line_id=line.id;
 if shop_private.service_completed_quantity(line.id)+new.quantity+returned>line.quantity then raise exception 'SERVICE_RETURNED_QUANTITY' using errcode='23514';end if;
 return new;
end;$$;
create trigger aa_return_fulfillment_boundary before insert on public.service_fulfillments for each row execute function shop_private.return_service_boundary();

create function shop_private.return_service_link_boundary() returns trigger language plpgsql security definer set search_path='' as $$
declare line public.invoice_items%rowtype; returned numeric; fulfilled numeric;
begin
 select * into line from public.invoice_items where id=new.line_id and shop_id=new.shop_id;
 perform 1 from public.invoices where id=line.invoice_id for update;
 select coalesce(sum(quantity),0) into returned from public.sale_return_lines where line_id=line.id;
 select quantity into fulfilled from public.service_fulfillments where id=new.fulfillment_id and shop_id=new.shop_id;
 if shop_private.service_completed_quantity(line.id)+fulfilled+returned>line.quantity then raise exception 'SERVICE_RETURNED_QUANTITY' using errcode='23514';end if;
 return new;
end;$$;
create trigger aa_return_fulfillment_link_boundary before insert on public.service_fulfillment_sale_links for each row execute function shop_private.return_service_link_boundary();
revoke all on function shop_private.return_service_link_boundary() from public,anon,authenticated,service_role;

-- Existing customer statements retain their original rows; add correction credits
-- at their occurrence time instead of rewriting the original debit/cash day.

create or replace function shop_private.reconcile_commission(p_invoice_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.commission_snapshots%rowtype; paid boolean; refunded numeric; payable numeric;
 correction public.sale_corrections%rowtype; returned_qty numeric; returned_net numeric;
begin
 perform 1 from public.invoices where id=p_invoice_id for update;
 select * into correction from public.sale_corrections c where c.invoice_id=p_invoice_id;
 -- invoice_outstanding also returns zero for a void/return. Closure is not
 -- proof of payment, and a corrected sale can never create a new earning.
 select correction.id is null and shop_private.invoice_outstanding(p_invoice_id)=0,total_amount
 into paid,payable from public.invoices where id=p_invoice_id and status='issued';
 for s in select * from public.commission_snapshots where invoice_id=p_invoice_id order by id loop
  select coalesce(sum(quantity),0),coalesce(sum(net),0) into returned_qty,returned_net from public.sale_return_lines where line_id=s.line_id;
  if paid and returned_qty<s.quantity and not exists(select 1 from public.appointments a where a.id=s.appointment_id and a.status in('cancelled','no_show')) and (s.item_type='product' or (shop_private.service_completed_quantity(s.line_id)>=s.quantity-returned_qty
   and (s.appointment_id is null or exists(select 1 from public.appointments a where a.id=s.appointment_id
    and a.shop_id=s.shop_id and a.sale_id=s.invoice_id and a.assigned_membership_id=s.membership_id and a.status='completed')))) then
   insert into public.commission_events(snapshot_id,kind,event_key,amount,reason)
   values(s.id,'earned','earned',s.original_commission,'Fully paid and fulfilled') on conflict do nothing;
  end if;
  select coalesce(sum(a.amount),0) into refunded from public.customer_payment_adjustments a
   join public.customer_payment_allocations alloc on alloc.id=a.original_allocation_id where alloc.invoice_id=p_invoice_id;
  if exists(select 1 from public.appointments a where a.id=s.appointment_id and a.status in('cancelled','no_show')) then
   perform shop_private.adjust_commission_return(s.id,'appointment-cancellation',s.net_line_amount,s.quantity,'Appointment cancelled');
  elsif correction.id is not null then
   perform shop_private.adjust_commission_return(s.id,'sale-correction:'||correction.id::text,
    s.net_line_amount,s.quantity,correction.reason);
  elsif returned_qty>0 then
   perform shop_private.adjust_commission_return(s.id,'partial:'||returned_qty::text,returned_net,returned_qty,'Original line partially returned');
  elsif refunded>0 then
   -- The helper also considers payment adjustments; zero inputs here preserve
   -- the common cumulative money/quantity contract without changing refunds.
   perform shop_private.adjust_commission_return(s.id,'financial:'||refunded::text,0,0,'Customer payment refund or reversal');
  end if;
 end loop;
end; $$;


create function shop_private.return_document(p_return_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(r)-'payload'||jsonb_build_object('version',1,
 'lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.line_id) from public.sale_return_lines l where l.return_id=r.id),'[]'::jsonb),
 'stock',coalesce((select jsonb_agg(to_jsonb(s) order by s.line_id,s.movement_id) from public.sale_return_stock s where s.return_id=r.id),'[]'::jsonb),
 'refunds',coalesce((select jsonb_agg(to_jsonb(f)||jsonb_build_object('state',
  (select state from public.sale_return_refund_events e where e.refund_id=f.id order by e.created_at desc,e.id desc limit 1),
  'events',(select jsonb_agg(to_jsonb(e) order by e.created_at,e.id) from public.sale_return_refund_events e where e.refund_id=f.id)) order by f.id)
  from public.sale_return_refunds f where f.return_id=r.id),'[]'::jsonb)) from public.sale_returns r where r.id=p_return_id;
$$;
create function public.get_sale_return(p_shop_id uuid,p_location_id uuid,p_return_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform shop_private.assert_sale_read_access(p_shop_id);
 perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if not exists(select 1 from public.sale_returns where id=p_return_id and shop_id=p_shop_id and location_id=p_location_id) then raise exception 'RETURN_NOT_FOUND' using errcode='P0002';end if;
 return shop_private.return_document(p_return_id);
end;$$;
create function public.sale_return_context(p_shop_id uuid,p_location_id uuid,p_invoice_id uuid,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare sale public.invoices%rowtype; source jsonb; allowed boolean:=true;
begin
 perform shop_private.assert_sale_read_access(p_shop_id);
 perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_offset<0 or p_offset>100000 then raise exception 'INVALID_RETURN_OFFSET' using errcode='22023';end if;
 select * into sale from public.invoices where id=p_invoice_id and shop_id=p_shop_id and location_id=p_location_id;
 if not found then raise exception 'SALE_NOT_FOUND' using errcode='P0002';end if;
 begin perform shop_private.return_actor(p_shop_id,p_location_id);exception when insufficient_privilege then allowed:=false;end;
 source:=shop_private.return_source(sale.id);
 if exists(select 1 from public.invoice_items where invoice_id=sale.id and round(quantity,2)<>quantity) then source:=null;end if;
 return jsonb_build_object('version',1,'canReturn',allowed and sale.status='issued' and source is not null and not exists(select 1 from public.sale_corrections where invoice_id=sale.id),
 'supported',source is not null,'due',shop_private.invoice_outstanding(sale.id),'currency',sale.currency,
 'lines',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.item_name,'itemType',l.item_type,'quantity',l.quantity,
  'remaining',l.quantity-coalesce((select sum(quantity) from public.sale_return_lines where line_id=l.id),0)) order by l.line_order,l.id),'[]'::jsonb) from public.invoice_items l where l.invoice_id=sale.id),
 'totalCount',(select count(*) from public.sale_returns where invoice_id=sale.id),
 'history',(select coalesce(jsonb_agg(shop_private.return_document(r.id) order by r.created_at desc,r.id desc),'[]'::jsonb)
  from(select id,created_at from public.sale_returns where invoice_id=sale.id order by created_at desc,id desc offset p_offset limit 50)r));
end;$$;

revoke all on function shop_private.return_actor(uuid,uuid),shop_private.return_source(uuid),shop_private.return_plan(uuid,uuid,uuid,jsonb),
 shop_private.return_document(uuid),shop_private.return_legacy_boundary(),shop_private.return_service_boundary() from public,anon,authenticated,service_role;
revoke all on function public.preview_sale_return(uuid,uuid,uuid,jsonb),public.create_sale_return(uuid,uuid,uuid,uuid,jsonb,text,jsonb),
 public.record_sale_return_refund(uuid,uuid,uuid,uuid,text,text,text),public.get_sale_return(uuid,uuid,uuid),public.sale_return_context(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.preview_sale_return(uuid,uuid,uuid,jsonb),public.create_sale_return(uuid,uuid,uuid,uuid,jsonb,text,jsonb),
 public.record_sale_return_refund(uuid,uuid,uuid,uuid,text,text,text),public.get_sale_return(uuid,uuid,uuid),public.sale_return_context(uuid,uuid,uuid,integer) to authenticated;
notify pgrst,'reload schema';

create or replace function shop_private.customer_statement(
  p_shop_id uuid, p_customer_id uuid, p_page integer default 1, p_page_size integer default 50
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_total bigint; v_outstanding numeric; v_items jsonb;
begin
  perform shop_private.assert_payment_read_access(p_shop_id);
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then
    raise exception 'INVALID_STATEMENT_QUERY' using errcode = '22023'; end if;
  if not exists (select 1 from public.clients where id = p_customer_id and shop_id = p_shop_id)
    then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  with events as (
    select invoice.id as event_id, 'sale'::text as event_type, invoice.issued_at as event_at,
      invoice.id as invoice_id, invoice.invoice_number as document_number,
      invoice.total_amount as debit, 0::numeric as credit, null::text as method,
      null::text as reference, invoice.issued_by_profile_id as actor_profile_id, 1 as rank
    from public.invoices invoice where invoice.shop_id = p_shop_id
      and invoice.client_id = p_customer_id and invoice.status = 'issued'
    union all
    select allocation.id, 'receipt', payment.paid_at, allocation.invoice_id,
      invoice.invoice_number, 0, allocation.amount, payment.method::text,
      payment.reference, payment.created_by_profile_id, 2
    from public.customer_payment_allocations allocation
    join public.payments payment on payment.id = allocation.payment_id
    join public.invoices invoice on invoice.id = allocation.invoice_id
    where allocation.shop_id = p_shop_id and payment.client_id = p_customer_id
      and payment.customer_kind = 'receipt'
    union all
    select adjustment.id, adjustment.kind::text, adjustment.effective_at,
      allocation.invoice_id, invoice.invoice_number, adjustment.amount, 0,
      refund.method::text, coalesce(adjustment.reference, refund.reference),
      adjustment.created_by_profile_id, case when adjustment.kind = 'reversal' then 3 else 4 end
    from public.customer_payment_adjustments adjustment
    join public.customer_payment_allocations allocation on allocation.id = adjustment.original_allocation_id
    join public.invoices invoice on invoice.id = allocation.invoice_id
    join public.payments original on original.id = adjustment.original_payment_id
    left join public.payments refund on refund.id = adjustment.refund_payment_id
    where adjustment.shop_id = p_shop_id and original.client_id = p_customer_id
    union all
    select correction.id, correction.kind::text, correction.effective_at,
      invoice.id, invoice.invoice_number, 0, invoice.total_amount, null::text,
      correction.reference, correction.created_by_profile_id, 5
    from public.sale_corrections correction
    join public.invoices invoice on invoice.id = correction.invoice_id
    where correction.shop_id = p_shop_id and invoice.client_id = p_customer_id
    union all
    select r.id, 'partial_return', r.created_at, invoice.id, invoice.invoice_number,
      0, r.debt_reduction, null::text, r.id::text, r.actor_profile_id, 6
    from public.sale_returns r join public.invoices invoice on invoice.id=r.invoice_id
    where r.shop_id=p_shop_id and invoice.client_id=p_customer_id
  ), running as (
    select events.*, sum(debit - credit) over (order by event_at, rank, event_id) as running_balance
    from events
  ), counted as (select count(*) over () as full_count, * from running)
  select coalesce(max(full_count), 0), coalesce(jsonb_agg(to_jsonb(page_rows)
    order by event_at, rank, event_id), '[]'::jsonb)
  into v_total, v_items from (select * from counted order by event_at, rank, event_id
    offset (p_page - 1) * p_page_size limit p_page_size) page_rows;
  select coalesce(sum(shop_private.invoice_outstanding(invoice.id)), 0) into v_outstanding
  from public.invoices invoice where invoice.shop_id = p_shop_id
    and invoice.client_id = p_customer_id and invoice.status = 'issued';
  return jsonb_build_object('items', v_items, 'total', v_total, 'page', p_page,
    'pageSize', p_page_size, 'outstanding', v_outstanding);
end;
$$;


-- Actual payment totals remain distinct from correction credits and reservations.
create or replace function shop_private.get_sale(p_shop_id uuid, p_invoice_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb; v_access record; v_payment_access record;
begin
  perform shop_private.assert_sale_read_access(p_shop_id);
  select * into v_access from shop_private.sale_access(p_shop_id);
  select * into v_payment_access from shop_private.payment_access(p_shop_id);
  select to_jsonb(invoice) || jsonb_build_object(
    'canManage', v_access.can_manage, 'canIssue', v_access.can_issue,
    'canReceivePayment', coalesce(v_payment_access.can_receive, false),
    'canReversePayment', coalesce(v_payment_access.can_reverse, false),
    'canRefundPayment', coalesce(v_payment_access.can_refund, false),
    'amountPaid', case when invoice.status = 'issued'
      then coalesce((select sum(a.amount) from public.customer_payment_allocations a where a.invoice_id=invoice.id),0)
      - coalesce((select sum(ad.amount) from public.customer_payment_adjustments ad join public.customer_payment_allocations a on a.id=ad.original_allocation_id where a.invoice_id=invoice.id),0)
      - coalesce((select sum(p.amount) from public.payments p where p.invoice_id=invoice.id and p.sale_return_refund_id is not null),0) else 0 end,
    'outstanding', case when invoice.status = 'issued'
      then shop_private.invoice_outstanding(invoice.id) else invoice.total_amount end,
    'settlementState', case when invoice.status <> 'issued' then null
      when shop_private.invoice_outstanding(invoice.id) = 0 then 'paid'
      when shop_private.invoice_outstanding(invoice.id) = invoice.total_amount then 'unpaid'
      else 'partial' end,
    'overdue', invoice.status = 'issued' and invoice.due_date is not null
      and invoice.due_date < current_date and shop_private.invoice_outstanding(invoice.id) > 0,
    'lines', (select coalesce(jsonb_agg(to_jsonb(item) order by item.line_order, item.id), '[]'::jsonb)
      from public.invoice_items item where item.invoice_id = invoice.id),
    'movements', (select coalesce(jsonb_agg(jsonb_build_object('id', movement.id,
      'productId', movement.product_id, 'invoiceItemId', movement.invoice_item_id,
      'batchId', movement.batch_id, 'quantityChange', movement.quantity_change,
      'unitCostSnapshot', movement.unit_cost_snapshot, 'createdAt', movement.created_at)
      order by movement.created_at, movement.id), '[]'::jsonb)
      from public.inventory_movements movement where movement.shop_id = p_shop_id
        and movement.reference_id = invoice.id and movement.movement_type = 'out'),
    'payments', case when coalesce(v_payment_access.can_view, false) then (
      select coalesce(jsonb_agg(event order by event ->> 'eventAt', event ->> 'id'), '[]'::jsonb)
      from (
        select jsonb_build_object('id', allocation.id, 'eventType', 'receipt',
          'paymentId', payment.id, 'allocationId', allocation.id,
          'amount', allocation.amount, 'eventAt', payment.paid_at, 'method', payment.method,
          'reference', payment.reference, 'actorProfileId', payment.created_by_profile_id,
          'remainingEffective', shop_private.allocation_remaining(allocation.id)) event
        from public.customer_payment_allocations allocation join public.payments payment
          on payment.id = allocation.payment_id where allocation.invoice_id = invoice.id
        union all
        select jsonb_build_object('id', adjustment.id, 'eventType', adjustment.kind,
          'paymentId', adjustment.original_payment_id,
          'allocationId', adjustment.original_allocation_id, 'amount', adjustment.amount,
          'eventAt', adjustment.effective_at, 'method', refund.method,
          'reference', coalesce(adjustment.reference, refund.reference),
          'reason', adjustment.reason, 'actorProfileId', adjustment.created_by_profile_id,
          'remainingEffective', shop_private.allocation_remaining(adjustment.original_allocation_id))
        from public.customer_payment_adjustments adjustment
        join public.customer_payment_allocations allocation
          on allocation.id = adjustment.original_allocation_id
        left join public.payments refund on refund.id = adjustment.refund_payment_id
        where allocation.invoice_id = invoice.id
      ) payment_events
    ) else '[]'::jsonb end
  ) into v_result from public.invoices invoice
  where invoice.id = p_invoice_id and invoice.shop_id = p_shop_id
    and invoice.status in ('draft', 'issued');
  return v_result;
end;
$$;


create or replace function shop_private.adjust_commission_return(p_snapshot_id uuid,p_event_key text,p_net_returned numeric,p_quantity_returned numeric,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare s public.commission_snapshots%rowtype; fraction numeric; prior numeric; delta numeric; payable numeric; invoice_refunds numeric;
 correction public.sale_corrections%rowtype;
begin
 select * into s from public.commission_snapshots where id=p_snapshot_id;
 if not found then raise exception 'COMMISSION_SNAPSHOT_NOT_FOUND'; end if;
 perform 1 from public.invoices where id=s.invoice_id for update;
 if p_event_key is null or p_net_returned is null or p_quantity_returned is null or p_net_returned<0 or p_net_returned>s.net_line_amount
  or p_quantity_returned<0 or p_quantity_returned>s.quantity or length(btrim(coalesce(p_reason,''))) not between 2 and 1000 then
  raise exception 'INVALID_COMMISSION_RETURN' using errcode='22023'; end if;
 select i.total_amount into payable from public.invoices i where i.id=s.invoice_id;
 select * into correction from public.sale_corrections c where c.invoice_id=s.invoice_id;
 select coalesce(sum(a.amount),0) into invoice_refunds from public.customer_payment_adjustments a
 join public.customer_payment_allocations alloc on alloc.id=a.original_allocation_id where alloc.invoice_id=s.invoice_id;
 -- A full sale correction closes the sale, even when it refunds no money or
 -- only the paid portion. It always reverses the entire original earning.
 fraction:=greatest(case when correction.id is not null then 1 else 0 end,
 case when s.net_line_amount>0 then p_net_returned/s.net_line_amount else 0 end,
 p_quantity_returned/s.quantity,case when payable>0 then least(1,invoice_refunds/payable) else 0 end);
 if not exists(select 1 from public.commission_events where snapshot_id=s.id and kind='earned') then return; end if;
 select coalesce(max(cumulative_fraction),0),coalesce(-sum(amount),0) into prior,delta
 from public.commission_events where snapshot_id=s.id and kind='return';
 if fraction<prior then raise exception 'COMMISSION_RETURN_NOT_CUMULATIVE' using errcode='22023'; end if;
 delta:=case when fraction=1 then s.original_commission else round(s.original_commission*fraction,2) end-delta;
 if fraction=prior then return; end if;
 insert into public.commission_events(snapshot_id,kind,event_key,amount,cumulative_fraction,reason,actor_profile_id)
 values(s.id,'return','return:'||p_event_key,-delta,fraction,btrim(p_reason),coalesce(correction.created_by_profile_id,(select r.actor_profile_id from public.sale_returns r where r.invoice_id=s.invoice_id order by r.created_at desc,r.id desc limit 1)));
end; $$;
revoke all on function shop_private.adjust_commission_return(uuid,text,numeric,numeric,text) from public,anon,authenticated,service_role;

