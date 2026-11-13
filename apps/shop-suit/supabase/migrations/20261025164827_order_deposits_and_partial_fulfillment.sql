begin;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.assert_shop_write_access(uuid,text)'::regprocedure) is distinct from '6742f69338f6ccc1b300d5f8e9681bba' then raise exception 'ORDER_WRITE_LOCK_ROUTINE_REVIEW_REQUIRED' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.assert_shop_write_access(p_shop_id uuid, p_permission_key text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  -- All supported stock/financial commands take the same tenant boundary
  -- before product, invoice or payment locks. Currency and tax triggers already
  -- lock this row; taking it late after a product/payment creates lock inversion.
  perform s.id from public.shops s where s.id=p_shop_id and s.status='active'
    and exists(select 1 from public.shop_memberships m join public.profiles p on p.id=m.profile_id
      where m.shop_id=s.id and p.user_id=auth.uid() and m.status='active' and p.status='active')
    for update of s;
  if not found then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501';end if;
  -- Recheck the existing actor, permission and subscription predicates after any
  -- wait, so a revoked membership cannot proceed from the earlier lock probe.
  select m.profile_id into v_profile_id
  from public.shop_memberships m
  join public.profiles p on p.id = m.profile_id
  join public.shops s on s.id = m.shop_id and s.portal_id = p.portal_id
  where m.shop_id = p_shop_id and p.user_id = auth.uid()
    and m.status = 'active' and p.status = 'active' and s.status = 'active';
  if v_profile_id is null
    or not shop_private.has_permission(p_shop_id, p_permission_key) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.shop_memberships owner_member
    join public.profiles owner_profile
      on owner_profile.id = owner_member.profile_id
    join public.subscriptions sub
      on sub.profile_id = owner_member.profile_id
    where owner_member.shop_id = p_shop_id
      and owner_member.role = 'owner'
      and owner_member.status = 'active'
      and owner_profile.status = 'active'
      and (
        (sub.status = 'trialing' and sub.trial_end_at > now())
        or (sub.status = 'active' and sub.current_period_end > now())
      )
  ) then
    raise exception 'SHOP_SUBSCRIPTION_INACTIVE' using errcode = '42501';
  end if;
  return v_profile_id;
end;
$$;
alter table public.invoice_items add unique(id,shop_id);
alter table public.trade_order_reservations add unique(id,shop_id,line_id);

-- Delivery records link commercial quantities to the existing invoice, stock
-- and payment histories. They are not a second financial or inventory ledger.
create table public.trade_order_deliveries (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,location_id uuid not null,order_id uuid not null,invoice_id uuid not null unique,
 reason text not null check(length(btrim(reason)) between 3 and 1000),tax_snapshot jsonb not null,
 actor_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 unique(id,shop_id),unique(id,shop_id,order_id),foreign key(order_id,shop_id,location_id) references public.trade_orders(id,shop_id,location_id),
 foreign key(invoice_id,shop_id,location_id) references public.invoices(id,shop_id,location_id)
);
create table public.trade_order_delivery_items (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,delivery_id uuid not null,order_id uuid not null,order_line_id uuid not null,invoice_item_id uuid not null unique,
 quantity numeric(18,6) not null check(quantity>0),tax_snapshot jsonb not null,
 unique(id,shop_id),unique(id,shop_id,order_line_id),foreign key(delivery_id,shop_id,order_id) references public.trade_order_deliveries(id,shop_id,order_id),
 foreign key(order_line_id,order_id,shop_id) references public.trade_order_lines(id,order_id,shop_id),foreign key(invoice_item_id,shop_id) references public.invoice_items(id,shop_id)
);
create index trade_order_delivery_history on public.trade_order_deliveries(order_id,created_at desc,id);
create index trade_order_delivered_line_quantity on public.trade_order_delivery_items(order_line_id);
create table public.trade_order_delivery_allocations (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,delivery_item_id uuid not null,order_line_id uuid not null,reservation_id uuid not null,
 quantity numeric(18,6) not null check(quantity>0),cutting_loss numeric(18,6) not null check(cutting_loss>=0),
 unique(delivery_item_id,reservation_id),foreign key(delivery_item_id,shop_id,order_line_id) references public.trade_order_delivery_items(id,shop_id,order_line_id),
 foreign key(reservation_id,shop_id,order_line_id) references public.trade_order_reservations(id,shop_id,line_id)
);
do $$declare t text;begin
 foreach t in array array['trade_order_deliveries','trade_order_delivery_items','trade_order_delivery_allocations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to service_role',t);
  execute format('create policy delivery_service_read on public.%I for select to service_role using(true)',t);
  execute format('create trigger delivery_history_immutable before update or delete on public.%I for each row execute function shop_private.measurement_history_immutable()',t);
 end loop;
end;$$;

-- A deposit is an ordinary existing customer receipt with an advance allocation.
-- Applying it appends an invoice allocation referencing its immutable advance;
-- cash is recorded once, and transfers cannot replenish the advance after refund.
alter table public.customer_payment_allocations alter column invoice_id drop not null,
 add column advance_order_id uuid,
 add column source_allocation_id uuid,
 add column allocation_reason text,
 add column created_by_profile_id uuid references public.profiles(id),
 add constraint customer_advance_order_fk foreign key(advance_order_id,shop_id,location_id) references public.trade_orders(id,shop_id,location_id),
 add constraint customer_advance_source_fk foreign key(source_allocation_id,shop_id,payment_id) references public.customer_payment_allocations(id,shop_id,payment_id),
 add constraint customer_advance_shape check((invoice_id is not null and advance_order_id is null)
  or (invoice_id is null and advance_order_id is not null and source_allocation_id is null)),
 add constraint customer_advance_audit check((advance_order_id is null and source_allocation_id is null) or (created_by_profile_id is not null and allocation_reason is not null and length(btrim(allocation_reason)) between 3 and 1000));
alter table public.customer_payment_allocations drop constraint customer_payment_allocations_payment_id_invoice_id_key;
create unique index customer_original_invoice_allocation on public.customer_payment_allocations(payment_id,invoice_id) where source_allocation_id is null and invoice_id is not null;
create unique index customer_original_advance_allocation on public.customer_payment_allocations(payment_id) where advance_order_id is not null;
create index customer_advance_transfers on public.customer_payment_allocations(source_allocation_id) where source_allocation_id is not null;
create index customer_order_advances on public.customer_payment_allocations(advance_order_id,created_at desc,id) where advance_order_id is not null;

create function shop_private.guard_customer_advance_allocation() returns trigger language plpgsql security definer set search_path='' as $$
declare payment public.payments%rowtype;source public.customer_payment_allocations%rowtype;begin
 if new.advance_order_id is null and new.source_allocation_id is null then return new;end if;
 new.created_by_profile_id:=shop_private.assert_shop_write_access(new.shop_id,'payments.receive');
 select * into payment from public.payments where id=new.payment_id and shop_id=new.shop_id and customer_kind='receipt' and status='completed' for update;
 if not found then raise exception 'CUSTOMER_RECEIPT_NOT_FOUND' using errcode='23503';end if;
 new.location_id:=payment.location_id;
 if new.advance_order_id is not null then
  if not exists(select 1 from public.trade_orders where id=new.advance_order_id and shop_id=new.shop_id and location_id=payment.location_id and customer_id=payment.client_id and currency=payment.currency)
   or new.amount>payment.amount-coalesce((select sum(amount) from public.customer_payment_allocations where payment_id=payment.id and source_allocation_id is null),0)
  then raise exception 'INVALID_CUSTOMER_ADVANCE' using errcode='23514';end if;
 else
  select * into source from public.customer_payment_allocations where id=new.source_allocation_id and shop_id=new.shop_id and payment_id=payment.id and advance_order_id is not null for update;
  if not found or new.amount>shop_private.allocation_remaining(source.id) then raise exception 'ADVANCE_AMOUNT_UNAVAILABLE' using errcode='23514';end if;
  if not exists(select 1 from public.invoices i join public.trade_order_deliveries d on d.invoice_id=i.id and d.shop_id=i.shop_id
   where i.id=new.invoice_id and i.shop_id=new.shop_id and i.location_id=payment.location_id and i.client_id=payment.client_id and i.currency=payment.currency and i.status='issued' and d.order_id=source.advance_order_id)
   or new.amount>shop_private.invoice_outstanding(new.invoice_id) then raise exception 'ADVANCE_INVOICE_NOT_ELIGIBLE' using errcode='23514';end if;
 end if;
 return new;
end;$$;
revoke all on function shop_private.guard_customer_advance_allocation() from public,anon,authenticated,service_role;
create trigger customer_advance_allocation_guard before insert on public.customer_payment_allocations for each row execute function shop_private.guard_customer_advance_allocation();

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.allocation_remaining(uuid)'::regprocedure) is distinct from 'b3fc11da0fa87e9da625c40ed61ab2fe' then raise exception 'ORDER_FUNDING_ROUTINE_REVIEW_REQUIRED: shop_private.allocation_remaining' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.allocation_remaining(p_allocation_id uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select greatest(0,a.amount-coalesce((select sum(amount) from public.customer_payment_adjustments where original_allocation_id=a.id),0)
 -coalesce((select sum(amount) from public.sale_return_refunds where allocation_id=a.id),0)
 -coalesce((select sum(amount) from public.customer_payment_allocations where source_allocation_id=a.id),0))
 from public.customer_payment_allocations a where a.id=p_allocation_id;
$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.customer_statement(uuid,uuid,integer,integer)'::regprocedure) is distinct from 'ed78f571f41d1c737cb1639fc1295d5e' then raise exception 'ORDER_FUNDING_ROUTINE_REVIEW_REQUIRED: shop_private.customer_statement' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.customer_statement(p_shop_id uuid, p_customer_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
      coalesce(invoice.invoice_number,advance_order.order_number), 0, allocation.amount, payment.method::text,
      payment.reference, payment.created_by_profile_id, 2
    from public.customer_payment_allocations allocation
    join public.payments payment on payment.id = allocation.payment_id
    left join public.invoices invoice on invoice.id = allocation.invoice_id
    left join public.trade_orders advance_order on advance_order.id=allocation.advance_order_id and advance_order.shop_id=allocation.shop_id
    where allocation.shop_id = p_shop_id and payment.client_id = p_customer_id
      and payment.customer_kind = 'receipt' and allocation.source_allocation_id is null
    union all
    select adjustment.id, adjustment.kind::text, adjustment.effective_at,
      allocation.invoice_id, coalesce(invoice.invoice_number,advance_order.order_number), adjustment.amount, 0,
      refund.method::text, coalesce(adjustment.reference, refund.reference),
      adjustment.created_by_profile_id, case when adjustment.kind = 'reversal' then 3 else 4 end
    from public.customer_payment_adjustments adjustment
    join public.customer_payment_allocations allocation on allocation.id = adjustment.original_allocation_id
    left join public.invoices invoice on invoice.id = allocation.invoice_id
    left join public.trade_orders advance_order on advance_order.id=allocation.advance_order_id and advance_order.shop_id=allocation.shop_id
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
  select coalesce(max(full_count), 0), coalesce(jsonb_agg(to_jsonb(page_rows)||jsonb_strip_nulls(jsonb_build_object('order_id',case when page_rows.invoice_id is null then coalesce(
      (select a.advance_order_id from public.customer_payment_allocations a where a.id=page_rows.event_id),
      (select a.advance_order_id from public.customer_payment_adjustments adjustment join public.customer_payment_allocations a on a.id=adjustment.original_allocation_id where adjustment.id=page_rows.event_id)) end))
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

create function shop_private.order_funded_amount(p_order uuid) returns numeric language sql stable set search_path='' as $$
 select coalesce((select sum(amount) from public.customer_payment_allocations where advance_order_id=p_order),0)
 -coalesce((select sum(adjustment.amount) from public.customer_payment_adjustments adjustment
 join public.customer_payment_allocations a on a.id=adjustment.original_allocation_id
 left join public.customer_payment_allocations source on source.id=a.source_allocation_id
 where coalesce(a.advance_order_id,source.advance_order_id)=p_order),0)
 -coalesce((select sum(refund.amount) from public.sale_return_refunds refund
 join public.customer_payment_allocations a on a.id=refund.allocation_id
 left join public.customer_payment_allocations source on source.id=a.source_allocation_id
 where coalesce(a.advance_order_id,source.advance_order_id)=p_order),0);
$$;
revoke all on function shop_private.order_funded_amount(uuid) from public,anon,authenticated,service_role;

create function shop_private.order_deposit_capacity(p_order uuid) returns numeric language sql stable set search_path='' as $$
 select o.total_amount-coalesce((select sum((tax_snapshot->>'total')::numeric) from public.trade_order_deliveries where order_id=o.id),0)
 +coalesce((select sum(shop_private.invoice_outstanding(invoice_id)) from public.trade_order_deliveries where order_id=o.id),0)
 -coalesce((select sum(shop_private.allocation_remaining(id)) from public.customer_payment_allocations where advance_order_id=o.id),0)
 from public.trade_orders o where o.id=p_order;
$$;
revoke all on function shop_private.order_deposit_capacity(uuid) from public,anon,authenticated,service_role;

create function public.trade_order_deposit(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_order_id uuid,p_revision integer,
 p_action text,p_amount text,p_at timestamptz,p_method public.payment_method,p_allocation_id uuid default null,p_invoice_id uuid default null,p_reference text default null,p_reason text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;request shop_private.trade_order_requests%rowtype;payload jsonb;o public.trade_orders%rowtype;
 allocation public.customer_payment_allocations%rowtype;payment_id uuid;result_id uuid;amount numeric;v_result jsonb;v_currency text;begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,case p_action when 'refund' then 'payments.refund' when 'reverse' then 'payments.reverse' else 'payments.receive' end);
 perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 if p_request_id is null or p_order_id is null or p_revision is null or p_revision<1 or p_action is null or p_action not in('receive','apply','refund','reverse')
 or p_amount is null or p_amount !~ '^[0-9]{1,10}(\.[0-9]{1,2})?$' or p_at is null
 or (p_action in('receive','refund') and p_method is null) or (p_action in('apply','reverse') and p_method is not null)
 or (p_action='receive' and (p_allocation_id is not null or p_invoice_id is not null))
 or (p_action<>'receive' and p_allocation_id is null) or (p_action='apply' and p_invoice_id is null) or (p_action<>'apply' and p_invoice_id is not null)
 or length(coalesce(p_reference,''))>200 or p_reason is null or length(btrim(p_reason)) not between 3 and 1000
 then raise exception 'INVALID_ORDER_DEPOSIT' using errcode='22023';end if;
 amount:=p_amount::numeric;
 if amount<=0 or amount>9999999999.99 then raise exception 'INVALID_ORDER_DEPOSIT_AMOUNT' using errcode='22023';end if;
 payload:=jsonb_build_object('action','deposit:'||p_action,'order',p_order_id,'location',p_location_id,'revision',p_revision,'amount',p_amount,'at',p_at,'method',p_method,'allocation',p_allocation_id,'invoice',p_invoice_id,'reference',nullif(btrim(p_reference),''),'reason',btrim(p_reason));
 insert into shop_private.trade_order_requests(shop_id,request_id,actor_profile_id,payload) values(p_shop_id,p_request_id,actor,payload) on conflict do nothing;
 select * into request from shop_private.trade_order_requests where shop_id=p_shop_id and request_id=p_request_id for update;
 if request.actor_profile_id<>actor or request.payload<>payload then raise exception 'ORDER_REQUEST_CONFLICT' using errcode='23505';end if;
 if request.result is not null then return request.result;end if;
 select business_currency into v_currency from public.shops where id=p_shop_id for update;
 select * into o from public.trade_orders where id=p_order_id and shop_id=p_shop_id and location_id=p_location_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002';end if;
 if o.revision<>p_revision then raise exception 'ORDER_CONTEXT_CHANGED' using errcode='55000';end if;
 if o.currency<>v_currency then raise exception 'ORDER_CURRENCY_CHANGED' using errcode='55000';end if;
 perform shop_private.assert_period_is_open(p_shop_id,p_at);
 perform set_config('shop.location_id',p_location_id::text,true);
 if p_action='receive' then
  if o.status not in('open','partially_fulfilled') then raise exception 'ORDER_DEPOSIT_STATE_DENIED' using errcode='55000';end if;
  if not exists(select 1 from public.clients where id=o.customer_id and shop_id=p_shop_id and is_active) then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002';end if;
  if amount>shop_private.order_deposit_capacity(o.id) then raise exception 'ORDER_DEPOSIT_EXCEEDS_AGREEMENT' using errcode='23514';end if;
  insert into public.payments(shop_id,location_id,payment_direction,client_id,amount,method,status,reference,paid_at,created_by_profile_id,notes,customer_kind)
  values(p_shop_id,p_location_id,'in',o.customer_id,amount,p_method,'completed',nullif(btrim(p_reference),''),p_at,actor,btrim(p_reason),'receipt') returning id into payment_id;
  insert into public.customer_payment_allocations(shop_id,payment_id,advance_order_id,amount,created_at,allocation_reason)
  values(p_shop_id,payment_id,o.id,amount,p_at,btrim(p_reason)) returning id into result_id;
 else
  -- Match existing correction lock order: invoice, receipt, allocation. Source
  -- allocations and receipts remain immutable; every transfer is appended.
  if p_action='apply' then
   perform 1 from public.invoices i join public.trade_order_deliveries d on d.invoice_id=i.id and d.shop_id=i.shop_id
   where i.id=p_invoice_id and i.shop_id=p_shop_id and i.location_id=p_location_id and i.client_id=o.customer_id and i.status='issued' and d.order_id=o.id for update of i;
   if not found then raise exception 'ADVANCE_INVOICE_NOT_ELIGIBLE' using errcode='23514';end if;
  end if;
  select a.payment_id into payment_id from public.customer_payment_allocations a where a.id=p_allocation_id and a.shop_id=p_shop_id and a.advance_order_id=o.id;
  if payment_id is null then raise exception 'ORDER_ADVANCE_NOT_FOUND' using errcode='P0002';end if;
  perform 1 from public.payments where id=payment_id and shop_id=p_shop_id and location_id=p_location_id and client_id=o.customer_id and currency=o.currency for update;
  if not found then raise exception 'ORDER_ADVANCE_NOT_FOUND' using errcode='P0002';end if;
  select * into allocation from public.customer_payment_allocations where id=p_allocation_id and shop_id=p_shop_id and advance_order_id=o.id for update;
  if amount>shop_private.allocation_remaining(allocation.id) then raise exception 'ADVANCE_AMOUNT_UNAVAILABLE' using errcode='23514';end if;
  if p_action='apply' then
   insert into public.customer_payment_allocations(shop_id,payment_id,invoice_id,source_allocation_id,amount,created_at,allocation_reason)
   values(p_shop_id,payment_id,p_invoice_id,allocation.id,amount,p_at,btrim(p_reason)) returning id into result_id;
  else
   result_id:=shop_private.adjust_customer_receipt(case when p_action='reverse' then 'reversal' else 'refund' end,p_request_id,p_shop_id,payment_id,p_at,btrim(p_reason),p_method,p_reference,
    jsonb_build_array(jsonb_build_object('allocation_id',allocation.id,'amount',amount)));
  end if;
 end if;
 update public.trade_orders set revision=revision+1,updated_at=clock_timestamp() where id=o.id returning * into o;
 insert into public.trade_order_events(shop_id,order_id,revision,action,previous_status,status,reason,actor_profile_id)
 values(p_shop_id,o.id,o.revision,'deposit_'||p_action,o.status,o.status,btrim(p_reason),actor);
 perform shop_private.bump_realtime(p_shop_id,p_location_id,'sales');perform shop_private.bump_realtime(p_shop_id,p_location_id,'customers');
 v_result:=jsonb_build_object('id',o.id,'revision',o.revision,'status',o.status,'action',p_action,'paymentId',payment_id,'resultId',result_id);
 update shop_private.trade_order_requests set result=v_result where shop_id=p_shop_id and request_id=p_request_id;
 return v_result;
end;$$;
revoke all on function public.trade_order_deposit(uuid,uuid,uuid,uuid,integer,text,text,timestamptz,public.payment_method,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.trade_order_deposit(uuid,uuid,uuid,uuid,integer,text,text,timestamptz,public.payment_method,uuid,uuid,text,text) to authenticated;

create function public.trade_order_funding_context(p_shop_id uuid,p_location_id uuid,p_order_id uuid,p_page integer default 1,p_history_page integer default 1,p_invoice_page integer default 1,p_invoice_search text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.trade_orders%rowtype;items jsonb;history jsonb;invoices jsonb;total bigint;history_total bigint;invoice_total bigint;begin
 perform shop_private.assert_payment_read_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_page is null or p_page<1 or p_history_page is null or p_history_page<1 or p_invoice_page is null or p_invoice_page<1 or length(coalesce(p_invoice_search,''))>120 then raise exception 'INVALID_ORDER_FUNDING_QUERY' using errcode='22023';end if;
 select * into o from public.trade_orders where id=p_order_id and shop_id=p_shop_id and location_id=p_location_id;
 if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002';end if;
 select count(*) into total from public.customer_payment_allocations where advance_order_id=o.id and shop_id=p_shop_id;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]') into items from(
  select a.id,a.payment_id,trim_scale(a.amount)::text amount,trim_scale(shop_private.allocation_remaining(a.id))::text available,
   trim_scale(coalesce((select sum(amount) from public.customer_payment_allocations where source_allocation_id=a.id),0))::text applied,
   p.method::text method,p.reference,p.paid_at,a.created_at
  from public.customer_payment_allocations a join public.payments p on p.id=a.payment_id and p.shop_id=a.shop_id
  where a.advance_order_id=o.id and a.shop_id=p_shop_id order by a.created_at desc,a.id offset(p_page-1)*20 limit 20)r;
 with order_allocations as(
  select a.* from public.customer_payment_allocations a left join public.customer_payment_allocations source on source.id=a.source_allocation_id
  where a.shop_id=p_shop_id and coalesce(a.advance_order_id,source.advance_order_id)=o.id
 ),events as(
  select adjustment.id,adjustment.kind::text kind,trim_scale(adjustment.amount)::text amount,adjustment.reason,adjustment.reference,adjustment.effective_at,
   a.id allocation_id,a.invoice_id,adjustment.refund_payment_id,(select display_name from public.profiles where id=adjustment.created_by_profile_id) actor_name
  from public.customer_payment_adjustments adjustment join order_allocations a on a.id=adjustment.original_allocation_id where adjustment.shop_id=p_shop_id
  union all
  select a.id,'apply',trim_scale(a.amount)::text,a.allocation_reason,p.reference,a.created_at,a.id,a.invoice_id,null::uuid,
   (select display_name from public.profiles where id=a.created_by_profile_id)
  from order_allocations a join public.payments p on p.id=a.payment_id where a.source_allocation_id is not null
 )
 select (select count(*) from events),coalesce((select jsonb_agg(to_jsonb(r) order by r.effective_at desc,r.id)
  from(select * from events order by effective_at desc,id offset(p_history_page-1)*20 limit 20)r),'[]') into history_total,history;
 select count(*) into invoice_total from public.trade_order_deliveries d join public.invoices i on i.id=d.invoice_id
 where d.order_id=o.id and d.shop_id=p_shop_id and i.status='issued' and shop_private.invoice_outstanding(i.id)>0 and (p_invoice_search is null or i.invoice_number ilike '%'||p_invoice_search||'%');
 select coalesce(jsonb_agg(to_jsonb(r) order by r.issued_at,r.id),'[]') into invoices from(
  select i.id,i.invoice_number,i.issued_at,trim_scale(shop_private.invoice_outstanding(i.id))::text outstanding
  from public.trade_order_deliveries d join public.invoices i on i.id=d.invoice_id and i.shop_id=d.shop_id
  where d.order_id=o.id and d.shop_id=p_shop_id and i.status='issued' and shop_private.invoice_outstanding(i.id)>0 and (p_invoice_search is null or i.invoice_number ilike '%'||p_invoice_search||'%')
  order by i.issued_at,i.id offset(p_invoice_page-1)*20 limit 20)r;
 return jsonb_build_object('items',items,'total',total,'page',p_page,'pageSize',20,'history',history,'historyTotal',history_total,'historyPage',p_history_page,
  'invoices',invoices,'invoiceTotal',invoice_total,'invoicePage',p_invoice_page,'revision',o.revision,'status',o.status,'currency',o.currency,
  'depositsNet',trim_scale(shop_private.order_funded_amount(o.id))::text,
  'unapplied',trim_scale(coalesce((select sum(shop_private.allocation_remaining(id)) from public.customer_payment_allocations where advance_order_id=o.id),0))::text,
  'depositCapacity',trim_scale(greatest(shop_private.order_deposit_capacity(o.id),0))::text,
  'canReceive',shop_private.has_permission(p_shop_id,'payments.receive'),'canRefund',shop_private.has_permission(p_shop_id,'payments.refund'),'canReverse',shop_private.has_permission(p_shop_id,'payments.reverse'));
end;$$;
revoke all on function public.trade_order_funding_context(uuid,uuid,uuid,integer,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.trade_order_funding_context(uuid,uuid,uuid,integer,integer,integer,text) to authenticated;

create function shop_private.delivered_order_quantity(p_line uuid) returns numeric language sql volatile set search_path='' as $$
 select coalesce(sum(quantity),0) from public.trade_order_delivery_items where order_line_id=p_line;
$$;
revoke all on function shop_private.delivered_order_quantity(uuid) from public,anon,authenticated,service_role;

-- Allocate cumulative agreed components, then take the delta. Every completed
-- line reconciles to its original cents and five-decimal tax components even
-- when collected over many visits. No current catalog/tax rule is consulted.
create function shop_private.order_delivery_tax_line(p_original jsonb,p_before numeric,p_quantity numeric,p_item uuid,p_measurement jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:=p_original;original_quantity numeric:=(p_original->>'quantity')::numeric;key text;scale integer;amount numeric;total numeric;tax numeric;begin
 if original_quantity is null or original_quantity<=0 or p_before is null or p_before<0 or p_quantity is null or p_quantity<=0 or p_before+p_quantity>original_quantity then raise exception 'ORDER_DELIVERY_EXCEEDS_QUANTITY' using errcode='22023';end if;
 foreach key in array array['gross5','lineDiscount5','orderDiscount5','discountNet5','net5','tax5','total5','lineDiscount','total','tax'] loop
  if p_original ? key then
   scale:=case when key in('total','tax') then 2 else 5 end;
   amount:=round((p_original->>key)::numeric*(p_before+p_quantity)/original_quantity,scale)-round((p_original->>key)::numeric*p_before/original_quantity,scale);
   result:=jsonb_set(result,array[key],to_jsonb(amount));
  end if;
 end loop;
 total:=(result->>'total')::numeric;tax:=coalesce((result->>'tax')::numeric,0);
 if result ? 'total5' and result ? 'tax5' then result:=result||jsonb_build_object('net5',(result->>'total5')::numeric-(result->>'tax5')::numeric);end if;
 result:=result||jsonb_build_object('id',p_item,'quantity',trim_scale(p_quantity)::text,'originalQuantity',p_quantity,'net',total-tax,
  'originalUnitPrice',(p_original->>'unitPrice')::numeric,'measurement',p_measurement);
 -- discountNet is a currency projection; retain its own cumulative rounding.
 result:=jsonb_set(result,'{discountNet}',to_jsonb(round(round(coalesce((p_original->>'discountNet5')::numeric,0),2)*(p_before+p_quantity)/original_quantity,2)
  -round(round(coalesce((p_original->>'discountNet5')::numeric,0),2)*p_before/original_quantity,2)));
 return result;
end;$$;
revoke all on function shop_private.order_delivery_tax_line(jsonb,numeric,numeric,uuid,jsonb) from public,anon,authenticated,service_role;

create function shop_private.consume_order_delivery_bulk(p_shop uuid,p_invoice uuid,p_item uuid,p_actor uuid) returns void
language plpgsql set search_path='' as $$
declare line public.invoice_items%rowtype;allocation record;batch public.inventory_batches%rowtype;consumed numeric:=0;begin
 select * into line from public.invoice_items where id=p_item and shop_id=p_shop and invoice_id=p_invoice and item_type='product';
 if not found then raise exception 'SALE_LINE_NOT_FOUND' using errcode='P0002';end if;
 for allocation in select a.quantity,a.cutting_loss,r.batch_id,r.reel_id,r.product_id,r.location_id
 from public.trade_order_delivery_allocations a
 join public.trade_order_delivery_items d on d.id=a.delivery_item_id and d.shop_id=a.shop_id
 join public.trade_order_reservations r on r.id=a.reservation_id and r.shop_id=a.shop_id
 where d.invoice_item_id=line.id and d.shop_id=p_shop order by r.batch_id,r.id loop
  if allocation.reel_id is not null or allocation.cutting_loss<>0 or allocation.product_id<>line.product_id
   or allocation.location_id<>(select location_id from public.invoices where id=p_invoice and shop_id=p_shop) then raise exception 'ORDER_DELIVERY_SOURCE_MISMATCH' using errcode='23514';end if;
  select * into batch from public.inventory_batches where id=allocation.batch_id and shop_id=p_shop and product_id=line.product_id and location_id=allocation.location_id for update;
  if not found or batch.remaining_quantity-shop_private.reserved_batch_quantity(batch.id)<allocation.quantity then raise exception 'ORDER_DELIVERY_SOURCE_UNAVAILABLE' using errcode='23514';end if;
  update public.inventory_batches set remaining_quantity=remaining_quantity-allocation.quantity where id=batch.id;
  insert into public.inventory_movements(shop_id,location_id,product_id,batch_id,quantity_change,movement_type,reference_id,created_by_profile_id,unit_cost_snapshot,invoice_item_id)
  values(p_shop,allocation.location_id,line.product_id,batch.id,-allocation.quantity,'out',p_invoice,p_actor,batch.unit_cost,line.id);
  consumed:=consumed+allocation.quantity;
 end loop;
 if consumed<>line.quantity then raise exception 'ORDER_DELIVERY_SOURCE_MISMATCH' using errcode='23514';end if;
end;$$;
revoke all on function shop_private.consume_order_delivery_bulk(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function shop_private.plan_order_reel_sources(p_shop uuid,p_product uuid,p_location uuid,p_quantity numeric,p_measurement jsonb,p_allowed uuid[]) returns jsonb
language plpgsql volatile set search_path='' as $$
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
 and reel.id=any(p_allowed) and reel.status in('sealed','open') and reel.classification in('sellable','discounted') and (selected is null or reel.id=selected)
 and (reel.classification='sellable' or selected=reel.id)
 order by batch.received_at,reel.id loop
  available:=r.remaining_length-shop_private.reserved_reel_quantity(r.id);
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
revoke all on function shop_private.plan_order_reel_sources(uuid,uuid,uuid,numeric,jsonb,uuid[]) from public,anon,authenticated,service_role;

create function shop_private.plan_order_bulk_sources(p_shop uuid,p_location uuid,p_product uuid,p_quantity numeric,p_allowed uuid[]) returns jsonb
language plpgsql volatile set search_path='' as $$
declare b public.inventory_batches%rowtype;remaining numeric:=p_quantity;take_qty numeric;result jsonb:='[]';begin
 for b in select * from public.inventory_batches where shop_id=p_shop and location_id=p_location and product_id=p_product and id=any(p_allowed) and remaining_quantity>0 order by received_at,id loop
  take_qty:=least(remaining,greatest(b.remaining_quantity-shop_private.reserved_batch_quantity(b.id),0));
  if take_qty<=0 then continue;end if;
  result:=result||jsonb_build_array(jsonb_build_object('batchId',b.id,'soldQuantity',trim_scale(take_qty)::text,'actualCutLength',trim_scale(take_qty)::text,'cuttingLoss','0'));
  remaining:=remaining-take_qty;exit when remaining=0;
 end loop;
 if remaining<>0 then raise exception 'ORDER_DELIVERY_SOURCE_UNAVAILABLE' using errcode='23514';end if;
 return result;
end;$$;
revoke all on function shop_private.plan_order_bulk_sources(uuid,uuid,uuid,numeric,uuid[]) from public,anon,authenticated,service_role;

create function shop_private.reserve_order_delivery_plan(p_shop uuid,p_location uuid,p_order uuid,p_line uuid,p_product uuid,p_plan jsonb,p_expiry timestamptz,p_actor uuid,p_reason text) returns jsonb
language plpgsql volatile set search_path='' as $$
declare entry jsonb;batch uuid;reservation uuid;result jsonb:='[]';begin
 for entry in select value from jsonb_array_elements(p_plan) loop
  batch:=case when entry->>'reelId' is not null then (select batch_id from public.inventory_reels where id=(entry->>'reelId')::uuid and shop_id=p_shop and location_id=p_location and product_id=p_product) else (entry->>'batchId')::uuid end;
  if batch is null then raise exception 'ORDER_DELIVERY_SOURCE_MISMATCH' using errcode='23514';end if;
  insert into public.trade_order_reservations(shop_id,location_id,order_id,line_id,product_id,batch_id,reel_id,quantity,sale_quantity,remaining_quantity,remaining_sale_quantity,expires_at,created_by_profile_id)
  values(p_shop,p_location,p_order,p_line,p_product,batch,(entry->>'reelId')::uuid,(entry->>'actualCutLength')::numeric,(entry->>'soldQuantity')::numeric,
   (entry->>'actualCutLength')::numeric,(entry->>'soldQuantity')::numeric,p_expiry,p_actor) returning id into reservation;
  insert into public.trade_order_reservation_events(shop_id,reservation_id,order_id,action,quantity_change,sale_quantity_change,reason,actor_profile_id)
  values(p_shop,reservation,p_order,'reserve',(entry->>'actualCutLength')::numeric,(entry->>'soldQuantity')::numeric,p_reason,p_actor);
  result:=result||jsonb_build_array(entry||jsonb_build_object('reservationId',reservation,'batchId',batch));
 end loop;
 return result;
end;$$;
revoke all on function shop_private.reserve_order_delivery_plan(uuid,uuid,uuid,uuid,uuid,jsonb,timestamptz,uuid,text) from public,anon,authenticated,service_role;

create function shop_private.order_delivery_measurement(p_original jsonb,p_quantity numeric,p_loss numeric) returns jsonb
language plpgsql immutable set search_path='' as $$
declare factor numeric;entered numeric;begin
 if p_original is null or p_original='null'::jsonb then return null;end if;
 factor:=(p_original->>'baseQuantity')::numeric/(p_original->>'enteredQuantity')::numeric;entered:=p_quantity/factor;
 if factor is null or factor<=0 or round(entered,6)<>entered then raise exception 'ORDER_DELIVERY_ENTERED_INCREMENT_REQUIRED' using errcode='22023';end if;
 if p_original->>'packageId' is not null and trunc(entered)<>entered then raise exception 'WHOLE_PACKAGE_QUANTITY_REQUIRED' using errcode='22023';end if;
 return (p_original-'reelAllocations')||jsonb_build_object('baseQuantity',trim_scale(p_quantity)::text,'enteredQuantity',trim_scale(entered)::text,'cuttingLoss',trim_scale(p_loss)::text);
end;$$;
revoke all on function shop_private.order_delivery_measurement(jsonb,numeric,numeric) from public,anon,authenticated,service_role;

create function public.fulfill_trade_order(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_order_id uuid,p_revision integer,p_lines jsonb,p_apply_deposits boolean,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;request shop_private.trade_order_requests%rowtype;payload jsonb;o public.trade_orders%rowtype;line public.trade_order_lines%rowtype;
 product public.products%rowtype;hold public.trade_order_reservations%rowtype;advance public.customer_payment_allocations%rowtype;
 input jsonb;row_data jsonb;entry jsonb;measurement jsonb;remaining_measurement jsonb;tax_line jsonb;tax_snapshot jsonb;
 collection_plan jsonb;collection_allocations jsonb;pending_plan jsonb;pending_allocations jsonb;rows jsonb:='[]';tax_lines jsonb;v_result jsonb;
 quantity numeric;loss numeric;before_quantity numeric;held_quantity numeric;held_physical numeric;pending_quantity numeric;pending_loss numeric;
 total numeric;tax numeric;net numeric;gross5 numeric;net5 numeric;tax5 numeric;total5 numeric;discount_net numeric;order_discount numeric;
 historical_discount5 numeric;historical_discount numeric;new_discount5 numeric;applied numeric:=0;take_amount numeric;
 old_holds uuid[];allowed_reels uuid[];allowed_batches uuid[];expiry timestamptz;currency text;invoice uuid:=gen_random_uuid();delivery uuid:=gen_random_uuid();item uuid;delivery_item uuid;
 previous_status text;position integer:=0;allocation_count integer:=0;derived_reason text;begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'sales.issue');perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 if p_request_id is null or p_order_id is null or p_revision is null or p_revision<1 or p_apply_deposits is null
 or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100
 or p_reason is null or length(btrim(p_reason)) not between 3 and 1000
 then raise exception 'INVALID_ORDER_DELIVERY' using errcode='22023';end if;
 if p_apply_deposits and not shop_private.has_permission(p_shop_id,'payments.receive') then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501';end if;
 if (select count(distinct value->>'lineId') from jsonb_array_elements(p_lines))<>jsonb_array_length(p_lines) then raise exception 'DUPLICATE_ORDER_LINE' using errcode='22023';end if;
 payload:=jsonb_build_object('action','fulfill','order',p_order_id,'location',p_location_id,'revision',p_revision,'lines',p_lines,'applyDeposits',p_apply_deposits,'reason',btrim(p_reason));
 insert into shop_private.trade_order_requests(shop_id,request_id,actor_profile_id,payload) values(p_shop_id,p_request_id,actor,payload) on conflict do nothing;
 select * into request from shop_private.trade_order_requests where shop_id=p_shop_id and request_id=p_request_id for update;
 if request.actor_profile_id<>actor or request.payload<>payload then raise exception 'ORDER_REQUEST_CONFLICT' using errcode='23505';end if;
 if request.result is not null then return request.result;end if;
 select business_currency into currency from public.shops where id=p_shop_id;
 select * into o from public.trade_orders where id=p_order_id and shop_id=p_shop_id and location_id=p_location_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002';end if;
 if o.revision<>p_revision then raise exception 'ORDER_CONTEXT_CHANGED' using errcode='55000';end if;
 if o.status not in('open','partially_fulfilled') then raise exception 'ORDER_DELIVERY_STATE_DENIED' using errcode='55000';end if;
 if o.currency<>currency then raise exception 'ORDER_CURRENCY_CHANGED' using errcode='55000';end if;
 if not exists(select 1 from public.clients where id=o.customer_id and shop_id=p_shop_id and is_active) then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002';end if;
 previous_status:=o.status;derived_reason:=btrim(p_reason);
 -- Same ordering as reservations, stock writes and the inherited issue path.
 perform 1 from public.products where shop_id=p_shop_id and id in(select product_id from public.trade_order_lines where order_id=o.id and item_type='product') order by id for update;
 perform 1 from public.services where shop_id=p_shop_id and id in(select service_id from public.trade_order_lines where order_id=o.id and item_type='service') order by id for update;
 perform 1 from public.inventory_reels where shop_id=p_shop_id and location_id=p_location_id and product_id in(select product_id from public.trade_order_lines where order_id=o.id and item_type='product') order by product_id,id for update;
 perform 1 from public.inventory_batches where shop_id=p_shop_id and location_id=p_location_id and product_id in(select product_id from public.trade_order_lines where order_id=o.id and item_type='product') order by product_id,received_at,id for update;
 insert into public.invoices(id,shop_id,location_id,created_by_profile_id,invoice_number,status,total_amount,discount_amount,client_id,notes)
 values(invoice,p_shop_id,p_location_id,actor,'DRAFT-'||invoice::text,'draft',0,0,o.customer_id,left(concat_ws(E'\n',o.agreed_snapshot->>'notes',o.order_number,btrim(p_reason)),2000));
 for input in select value from jsonb_array_elements(p_lines) loop
  select * into line from public.trade_order_lines where id=(input->>'lineId')::uuid and order_id=o.id and shop_id=p_shop_id;
  if not found then raise exception 'ORDER_LINE_NOT_FOUND' using errcode='P0002';end if;
  if coalesce(input->>'quantity','') !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' or coalesce(input->>'cuttingLoss','0') !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' then raise exception 'INVALID_ORDER_DELIVERY_QUANTITY' using errcode='22023';end if;
  quantity:=(input->>'quantity')::numeric;loss:=coalesce(input->>'cuttingLoss','0')::numeric;before_quantity:=shop_private.delivered_order_quantity(line.id);
  if quantity<=0 or quantity>line.quantity-before_quantity or loss>1000000 then raise exception 'ORDER_DELIVERY_EXCEEDS_QUANTITY' using errcode='22023';end if;
  measurement:=shop_private.order_delivery_measurement(line.measurement_snapshot,quantity,loss);collection_plan:='[]';collection_allocations:='[]';
  if line.item_type='product' then
   select * into product from public.products where id=line.product_id and shop_id=p_shop_id and is_active;
   if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
   if measurement is null then
    if product.measurement_status<>'legacy' or round(quantity,3)<>quantity then raise exception 'ORDER_MEASUREMENT_CONTEXT_CHANGED' using errcode='55000';end if;
   else
    if product.measurement_status<>'active' or product.base_unit_code is distinct from measurement->>'baseUnitCode' or product.measurement_revision is distinct from (measurement->>'productRevision')::integer then raise exception 'ORDER_MEASUREMENT_CONTEXT_CHANGED' using errcode='55000';end if;
    perform shop_private.assert_measured_quantity(p_shop_id,product.id,quantity);
    if loss>0 then perform shop_private.assert_measured_quantity(p_shop_id,product.id,loss);end if;
   end if;
   select array_agg(id order by id),array_agg(distinct reel_id) filter(where reel_id is not null),array_agg(distinct batch_id),min(expires_at),coalesce(sum(remaining_sale_quantity),0),coalesce(sum(remaining_quantity),0)
   into old_holds,allowed_reels,allowed_batches,expiry,held_quantity,held_physical
   from public.trade_order_reservations where line_id=line.id and shop_id=p_shop_id and status='active' and expires_at>clock_timestamp();
   if quantity>held_quantity then raise exception 'ORDER_COLLECTION_REQUIRES_RESERVATION' using errcode='23514';end if;
   if loss>held_physical-held_quantity then raise exception 'ORDER_CUTTING_ALLOWANCE_EXCEEDED' using errcode='23514';end if;
   for hold in select * from public.trade_order_reservations where id=any(old_holds) order by id for update loop
    update public.trade_order_reservations set status='released',remaining_quantity=0,remaining_sale_quantity=0,released_at=clock_timestamp(),released_by_profile_id=actor,release_reason=derived_reason where id=hold.id;
    insert into public.trade_order_reservation_events(shop_id,reservation_id,order_id,action,quantity_change,sale_quantity_change,reason,actor_profile_id)
    values(p_shop_id,hold.id,o.id,'release',-hold.remaining_quantity,-hold.remaining_sale_quantity,derived_reason,actor);
   end loop;
   if shop_private.is_reel_tracked(p_shop_id,product.id) then
    collection_plan:=shop_private.plan_order_reel_sources(p_shop_id,product.id,p_location_id,quantity,measurement,allowed_reels);
    measurement:=measurement||jsonb_build_object('reelAllocations',collection_plan,'physicalConsumedQuantity',trim_scale(quantity+loss)::text);
   else
    if loss<>0 or coalesce((line.measurement_snapshot->>'reelTracking')::boolean,false) then raise exception 'ORDER_REEL_CONTEXT_CHANGED' using errcode='55000';end if;
    collection_plan:=shop_private.plan_order_bulk_sources(p_shop_id,p_location_id,product.id,quantity,allowed_batches);
   end if;
   collection_allocations:=shop_private.reserve_order_delivery_plan(p_shop_id,p_location_id,o.id,line.id,product.id,collection_plan,expiry,actor,derived_reason);
   allocation_count:=allocation_count+jsonb_array_length(collection_allocations);
   pending_quantity:=held_quantity-quantity;pending_loss:=held_physical-held_quantity-loss;
   if pending_quantity>0 then
    remaining_measurement:=shop_private.order_delivery_measurement(line.measurement_snapshot,pending_quantity,pending_loss);
    pending_plan:=case when shop_private.is_reel_tracked(p_shop_id,product.id) then shop_private.plan_order_reel_sources(p_shop_id,product.id,p_location_id,pending_quantity,remaining_measurement,allowed_reels)
     else shop_private.plan_order_bulk_sources(p_shop_id,p_location_id,product.id,pending_quantity,allowed_batches) end;
    pending_allocations:=shop_private.reserve_order_delivery_plan(p_shop_id,p_location_id,o.id,line.id,product.id,pending_plan,expiry,actor,derived_reason);
    allocation_count:=allocation_count+jsonb_array_length(pending_allocations);
   end if;
  else
   if loss<>0 or round(quantity,3)<>quantity or not exists(select 1 from public.services where id=line.service_id and shop_id=p_shop_id and is_active) then raise exception 'INVALID_ORDER_SERVICE_DELIVERY' using errcode='22023';end if;
  end if;
  if allocation_count>2000 then raise exception 'TOO_MANY_ORDER_ALLOCATIONS' using errcode='22023';end if;
  item:=gen_random_uuid();position:=position+1;
  tax_line:=shop_private.order_delivery_tax_line(line.tax_snapshot,before_quantity,quantity,item,measurement);
  insert into public.invoice_items(id,shop_id,invoice_id,item_type,product_id,service_id,item_name,quantity,unit_price,discount_amount,total_amount,line_order,measurement_snapshot,trade_pricing_snapshot,product_sku_snapshot,product_barcode_snapshot)
  values(item,p_shop_id,invoice,line.item_type,line.product_id,line.service_id,line.item_name,quantity,line.unit_price,(tax_line->>'lineDiscount')::numeric,(tax_line->>'total')::numeric,position,measurement,line.pricing_snapshot,
   case when line.item_type='product' then product.sku end,case when line.item_type='product' then product.barcode end);
  rows:=rows||jsonb_build_array(jsonb_build_object('lineId',line.id,'itemId',item,'quantity',trim_scale(quantity)::text,'tax',tax_line,'allocations',collection_allocations));
 end loop;
 select jsonb_agg(value->'tax' order by n),sum((value#>>'{tax,total}')::numeric),sum((value#>>'{tax,tax}')::numeric),sum((value#>>'{tax,net}')::numeric),
 sum(coalesce((value#>>'{tax,gross5}')::numeric,0)),sum(coalesce((value#>>'{tax,net5}')::numeric,0)),sum(coalesce((value#>>'{tax,tax5}')::numeric,0)),sum(coalesce((value#>>'{tax,total5}')::numeric,0)),
 sum(coalesce((value#>>'{tax,discountNet}')::numeric,0)),sum(coalesce((value#>>'{tax,orderDiscount5}')::numeric,0))
 into tax_lines,total,tax,net,gross5,net5,tax5,total5,discount_net,new_discount5 from jsonb_array_elements(rows) with ordinality r(value,n);
 select coalesce(sum((d.tax_snapshot->>'orderDiscount5')::numeric),0) into historical_discount5 from public.trade_order_delivery_items d join public.trade_order_deliveries h on h.id=d.delivery_id and h.shop_id=d.shop_id where h.order_id=o.id;
 select coalesce(sum((d.tax_snapshot->>'orderDiscount')::numeric),0) into historical_discount from public.trade_order_deliveries d where d.order_id=o.id;
 order_discount:=round(historical_discount5+new_discount5,2)-historical_discount;
 tax_snapshot:=jsonb_build_object('version',1,'source','accepted-order-delivery','orderId',o.id,'quotationId',o.quotation_id,'quotationVersion',o.quotation_version,
  'currency',o.currency,'calculationEnabled',coalesce((o.agreed_snapshot->>'calculationEnabled')::boolean,false),'minorUnits',2,'componentDecimals',5,
  'policyVersionId',null,'taxPolicy',o.agreed_snapshot->'taxPolicy','orderDiscount',order_discount,'discountNet',discount_net,'net',net,'tax',tax,'total',total,
  'gross5',gross5,'net5',net5,'tax5',tax5,'total5',total5,'moneyRounding5',total-total5,'lines',tax_lines);
 insert into public.trade_order_deliveries(id,shop_id,location_id,order_id,invoice_id,reason,tax_snapshot,actor_profile_id)
 values(delivery,p_shop_id,p_location_id,o.id,invoice,btrim(p_reason),tax_snapshot,actor);
 for row_data in select value from jsonb_array_elements(rows) loop
  insert into public.trade_order_delivery_items(shop_id,delivery_id,order_id,order_line_id,invoice_item_id,quantity,tax_snapshot)
  values(p_shop_id,delivery,o.id,(row_data->>'lineId')::uuid,(row_data->>'itemId')::uuid,(row_data->>'quantity')::numeric,row_data->'tax') returning id into delivery_item;
  for entry in select value from jsonb_array_elements(row_data->'allocations') loop
   insert into public.trade_order_delivery_allocations(shop_id,delivery_item_id,order_line_id,reservation_id,quantity,cutting_loss)
   values(p_shop_id,delivery_item,(row_data->>'lineId')::uuid,(entry->>'reservationId')::uuid,(entry->>'soldQuantity')::numeric,(entry->>'cuttingLoss')::numeric);
   update public.trade_order_reservations set status='fulfilled',remaining_quantity=0,remaining_sale_quantity=0,released_at=clock_timestamp(),released_by_profile_id=actor,release_reason=btrim(p_reason) where id=(entry->>'reservationId')::uuid;
   insert into public.trade_order_reservation_events(shop_id,reservation_id,order_id,action,quantity_change,sale_quantity_change,reason,actor_profile_id)
   values(p_shop_id,(entry->>'reservationId')::uuid,o.id,'fulfill',-(entry->>'actualCutLength')::numeric,-(entry->>'soldQuantity')::numeric,btrim(p_reason),actor);
  end loop;
 end loop;
 update public.invoices set tax_order_discount=order_discount where id=invoice;
 perform public.issue_location_sale(gen_random_uuid(),p_shop_id,p_location_id,invoice);
 if p_apply_deposits then
  perform p.id from public.payments p where p.id in(select payment_id from public.customer_payment_allocations where advance_order_id=o.id) order by p.id for update;
  for advance in select * from public.customer_payment_allocations where advance_order_id=o.id order by created_at,id for update loop
   take_amount:=least(shop_private.allocation_remaining(advance.id),shop_private.invoice_outstanding(invoice));
   if take_amount>0 then
    insert into public.customer_payment_allocations(shop_id,payment_id,invoice_id,source_allocation_id,amount,allocation_reason)
    values(p_shop_id,advance.payment_id,invoice,advance.id,take_amount,btrim(p_reason));applied:=applied+take_amount;
   end if;
   exit when shop_private.invoice_outstanding(invoice)=0;
  end loop;
 end if;
 update public.trade_orders set revision=revision+1,status=case when exists(select 1 from public.trade_order_lines l where l.order_id=o.id and shop_private.delivered_order_quantity(l.id)<l.quantity) then 'partially_fulfilled' else 'fulfilled' end,updated_at=clock_timestamp() where id=o.id returning * into o;
 insert into public.trade_order_events(shop_id,order_id,revision,action,previous_status,status,reason,actor_profile_id)
 values(p_shop_id,o.id,o.revision,'fulfill',previous_status,o.status,btrim(p_reason),actor);
 perform shop_private.bump_realtime(p_shop_id,p_location_id,'inventory');perform shop_private.bump_realtime(p_shop_id,p_location_id,'pos');
 v_result:=jsonb_build_object('id',o.id,'revision',o.revision,'status',o.status,'deliveryId',delivery,'invoiceId',invoice,'appliedDeposit',trim_scale(applied)::text);
 update shop_private.trade_order_requests set result=v_result where shop_id=p_shop_id and request_id=p_request_id;
 return v_result;
end;$$;
revoke all on function public.fulfill_trade_order(uuid,uuid,uuid,uuid,integer,jsonb,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.fulfill_trade_order(uuid,uuid,uuid,uuid,integer,jsonb,boolean,text) to authenticated;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.issue_sale(uuid,uuid,uuid)'::regprocedure) is distinct from 'ee58f0e3091c41a87e9f790dee51e038' then raise exception 'ORDER_DELIVERY_ROUTINE_REVIEW_REQUIRED: shop_private.issue_sale' using errcode='55000';end if;end;$$;
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
    client_name_snapshot = coalesce((select o.agreed_snapshot->>'customerName' from public.trade_order_deliveries d join public.trade_orders o on o.id=d.order_id and o.shop_id=d.shop_id where d.invoice_id=invoice.id and d.shop_id=p_shop_id),client.name),
    client_phone_snapshot = client.phone,
    client_email_snapshot = client.email,
    client_address_snapshot = client.address
  from public.clients client
  where invoice.id = p_invoice_id and client.id = invoice.client_id
    and client.shop_id = p_shop_id and client.is_active;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;

  if not exists(select 1 from public.trade_order_deliveries where invoice_id=p_invoice_id and shop_id=p_shop_id) then
  perform shop_private.lock_trade_customer(p_shop_id,p_invoice_id);
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
        item_name = v_product.name, unit_price = coalesce((v_measurement->>'baseUnitPrice')::numeric,v_product.sale_price), measurement_snapshot=nullif(v_measurement->'measurement','null'::jsonb), trade_pricing_snapshot=nullif(v_measurement->'pricing','null'::jsonb),
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

  perform shop_private.remove_stacked_trade_offers(p_shop_id,p_invoice_id);
  end if;

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

  if not exists(select 1 from public.trade_order_deliveries where invoice_id=p_invoice_id and shop_id=p_shop_id) then
  perform shop_private.stage_invoice_reel_plans(p_shop_id,p_invoice_id);
  end if;
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

  for v_line in select id from public.invoice_items where invoice_id=p_invoice_id and shop_id=p_shop_id and item_type='product' order by product_id,line_order,id loop
    perform shop_private.consume_product_sale_line(p_shop_id,p_invoice_id,v_line.id,v_profile_id);
  end loop;

  update public.sale_requests set invoice_id = p_invoice_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'issue' and request_id = p_request_id;
  return p_invoice_id;
end;
$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.capture_tax_at_issue()'::regprocedure) is distinct from 'b508aa0ce1b3cacfdf9f0e95653ee1c2' then raise exception 'ORDER_DELIVERY_ROUTINE_REVIEW_REQUIRED: shop_private.capture_tax_at_issue' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.capture_tax_at_issue() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare policy public.tax_policy_versions%rowtype; snapshot jsonb; line jsonb;
begin
 if old.status<>'draft' or new.status<>'issued' then return new; end if;
 perform shop_private.assert_location_access(new.shop_id,new.location_id,true);
 perform 1 from public.shops where id=new.shop_id for update;
 select d.tax_snapshot into snapshot from public.trade_order_deliveries d where d.invoice_id=new.id and d.shop_id=new.shop_id and d.location_id=new.location_id;
 if found then
  for line in select value from jsonb_array_elements(snapshot->'lines') loop
   update public.invoice_items set total_amount=(line->>'total')::numeric where id=(line->>'id')::uuid and invoice_id=new.id and shop_id=new.shop_id;
  end loop;
  new.total_amount:=(snapshot->>'total')::numeric;
  new.discount_amount:=new.discount_amount+(snapshot->>'orderDiscount')::numeric;
  insert into public.sale_tax_snapshots(invoice_id,shop_id,location_id,policy_version_id,snapshot) values(new.id,new.shop_id,new.location_id,null,snapshot);
  return new;
 end if;

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

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.consume_product_sale_line(uuid,uuid,uuid,uuid)'::regprocedure) is distinct from 'ebff9129620d669789f57ee33c2f0325' then raise exception 'ORDER_DELIVERY_ROUTINE_REVIEW_REQUIRED: shop_private.consume_product_sale_line' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.consume_product_sale_line(p_shop uuid, p_invoice uuid, p_line uuid, p_actor uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare line public.invoice_items%rowtype;location uuid;r public.inventory_reels%rowtype;b public.inventory_batches%rowtype;
 plan jsonb;entry jsonb;qty numeric;loss numeric;physical numeric;remaining numeric;take_qty numeric;cut uuid;movement uuid;loss_movement uuid;begin
 select * into line from public.invoice_items where id=p_line and shop_id=p_shop and invoice_id=p_invoice and item_type='product';
 select location_id into location from public.invoices where id=p_invoice and shop_id=p_shop;
 if not found or line.id is null or location is null then raise exception 'SALE_LINE_NOT_FOUND' using errcode='P0002';end if;
 if not shop_private.is_reel_tracked(p_shop,line.product_id) then
  if exists(select 1 from public.trade_order_delivery_items d join public.trade_order_deliveries h on h.id=d.delivery_id and h.shop_id=d.shop_id where d.invoice_item_id=p_line and h.invoice_id=p_invoice and h.shop_id=p_shop) then
   perform shop_private.consume_order_delivery_bulk(p_shop,p_invoice,p_line,p_actor);return;
  end if;

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

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.reserve_trade_order(uuid,uuid,uuid,uuid,integer,text,jsonb,timestamptz,text)'::regprocedure) is distinct from '17a9b63c93d1eb66d8a78ab3d2090a3d' then raise exception 'ORDER_DELIVERY_ROUTINE_REVIEW_REQUIRED: public.reserve_trade_order' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION public.reserve_trade_order(p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_order_id uuid, p_revision integer, p_action text, p_lines jsonb, p_expires_at timestamp with time zone, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare actor uuid;request shop_private.trade_order_requests%rowtype;payload jsonb;v_result jsonb;o public.trade_orders%rowtype;
 previous public.trade_order_reservations%rowtype;line public.trade_order_lines%rowtype;product public.products%rowtype;b public.inventory_batches%rowtype;
 input jsonb;measurement jsonb;plan jsonb;entry jsonb;id uuid;quantity numeric;loss numeric;remaining numeric;available numeric;take_qty numeric;factor numeric;
 count integer:=0;expire boolean;previous_status text;begin
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
 if o.status not in('open','partially_fulfilled') then raise exception 'ORDER_RESERVATION_STATE_DENIED' using errcode='55000';end if;
 previous_status:=o.status;
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
   if quantity<=0 or quantity>line.quantity-shop_private.delivered_order_quantity(line.id) or loss>1000000 then raise exception 'ORDER_RESERVATION_EXCEEDS_QUANTITY' using errcode='22023';end if;
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
 insert into public.trade_order_events(shop_id,order_id,revision,action,previous_status,status,reason,actor_profile_id) values(p_shop_id,o.id,o.revision,p_action,previous_status,o.status,btrim(p_reason),actor);
 perform shop_private.bump_realtime(p_shop_id,p_location_id,'inventory');
 perform shop_private.bump_realtime(p_shop_id,p_location_id,'pos');
 v_result:=jsonb_build_object('id',o.id,'revision',o.revision,'status',o.status,'allocations',count);
 update shop_private.trade_order_requests set result=v_result where shop_id=p_shop_id and request_id=p_request_id;
 return v_result;
end;$_$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.check_order_reservation_capacity()'::regprocedure) is distinct from 'c6b5a5ece6416d52b5d82b1dfa16c265' then raise exception 'ORDER_DELIVERY_ROUTINE_REVIEW_REQUIRED: shop_private.check_order_reservation_capacity' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.check_order_reservation_capacity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
   >(select quantity-shop_private.delivered_order_quantity(id) from public.trade_order_lines where id=line) then raise exception 'ORDER_RESERVATION_EXCEEDS_QUANTITY' using errcode='23514';end if;
 end if;
 return null;
end;$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.trade_order_reservation_context(uuid,uuid,uuid,integer,integer)'::regprocedure) is distinct from '87bd534ad28b17f483886f8f348a8d44' then raise exception 'ORDER_DELIVERY_ROUTINE_REVIEW_REQUIRED: public.trade_order_reservation_context' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION public.trade_order_reservation_context(p_shop_id uuid, p_location_id uuid, p_order_id uuid, p_page integer DEFAULT 1, p_history_page integer DEFAULT 1) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
  'orderedQuantity',trim_scale(line.quantity)::text,'fulfilledQuantity',trim_scale(shop_private.delivered_order_quantity(line.id))::text,'remainingQuantity',trim_scale(line.quantity-shop_private.delivered_order_quantity(line.id))::text,'onHand',trim_scale(coalesce(onhand.quantity,0))::text,
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

create function public.trade_order_delivery_context(p_shop_id uuid,p_location_id uuid,p_order_id uuid,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.trade_orders%rowtype;lines jsonb;history jsonb;total bigint;begin
 perform shop_private.assert_sale_read_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_page is null or p_page<1 then raise exception 'INVALID_ORDER_DELIVERY_QUERY' using errcode='22023';end if;
 select * into o from public.trade_orders where id=p_order_id and shop_id=p_shop_id and location_id=p_location_id;
 if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.item_name,'itemType',l.item_type,
  'unitCode',coalesce(l.measurement_snapshot->>'baseUnitCode','ea'),'packageName',l.measurement_snapshot->>'packageName',
  'orderedQuantity',trim_scale(l.quantity)::text,'deliveredQuantity',trim_scale(shop_private.delivered_order_quantity(l.id))::text,
  'remainingQuantity',trim_scale(l.quantity-shop_private.delivered_order_quantity(l.id))::text,
  'heldQuantity',trim_scale(coalesce(held.nominal,0))::text,'heldLoss',trim_scale(coalesce(held.physical-held.nominal,0))::text,
  'reelTracked',case when l.item_type='product' then shop_private.is_reel_tracked(p_shop_id,l.product_id) else false end,
  'allowSplit',coalesce((l.measurement_snapshot->>'allowSplit')::boolean,false)) order by l.line_order),'[]') into lines
 from public.trade_order_lines l left join lateral(select sum(remaining_sale_quantity) nominal,sum(remaining_quantity) physical
  from public.trade_order_reservations where line_id=l.id and shop_id=p_shop_id and status='active' and expires_at>statement_timestamp())held on true
 where l.order_id=o.id and l.shop_id=p_shop_id;
 select count(*) into total from public.trade_order_deliveries where order_id=o.id and shop_id=p_shop_id;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]') into history from(
  select d.id,d.invoice_id,i.invoice_number,i.status::text invoice_status,trim_scale(i.total_amount)::text total,d.reason,d.created_at,
   (select display_name from public.profiles where id=d.actor_profile_id) actor_name
  from public.trade_order_deliveries d join public.invoices i on i.id=d.invoice_id and i.shop_id=d.shop_id
  where d.order_id=o.id and d.shop_id=p_shop_id order by d.created_at desc,d.id offset(p_page-1)*20 limit 20)r;
 return jsonb_build_object('lines',lines,'history',history,'total',total,'page',p_page,'pageSize',20,'revision',o.revision,'status',o.status,'currency',o.currency,
  'canFulfill',shop_private.has_permission(p_shop_id,'sales.issue') and o.status in('open','partially_fulfilled'),'canApplyDeposits',shop_private.has_permission(p_shop_id,'payments.receive'));
end;$$;
revoke all on function public.trade_order_delivery_context(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.trade_order_delivery_context(uuid,uuid,uuid,integer) to authenticated;

commit;
