-- SS-SALE-CORR-001: append-only full-sale void/return with exactly-once
-- payment and FIFO stock reversal. Partial item returns remain unsupported.

create type public.sale_correction_kind as enum ('void', 'full_return');

create table public.sale_corrections (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  shop_id uuid not null,
  location_id uuid not null,
  invoice_id uuid not null,
  kind public.sale_correction_kind not null,
  payload_hash text not null,
  effective_at timestamptz not null,
  reason text not null check (length(btrim(reason)) between 2 and 1000),
  reference text check (reference is null or length(reference) <= 200),
  refund_amount numeric(12, 2) not null check (refund_amount >= 0),
  restored_quantity numeric(12, 3) not null check (restored_quantity >= 0),
  created_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  unique (shop_id, request_id),
  unique (invoice_id),
  unique (id, shop_id, location_id),
  foreign key (invoice_id, shop_id, location_id)
    references public.invoices (id, shop_id, location_id) on delete restrict,
  foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict,
  check ((kind = 'void' and refund_amount = 0)
    or (kind = 'full_return' and refund_amount > 0))
);

alter table public.inventory_movements
  add column sale_correction_id uuid,
  add column reversal_of_movement_id uuid,
  add constraint inventory_movements_sale_correction_fk
    foreign key (sale_correction_id, shop_id, location_id)
    references public.sale_corrections (id, shop_id, location_id) on delete restrict,
  add constraint inventory_movements_reversal_source_fk
    foreign key (reversal_of_movement_id)
    references public.inventory_movements (id) on delete restrict,
  add constraint inventory_movements_sale_reversal_shape_check check (
    (sale_correction_id is null and reversal_of_movement_id is null)
    or (sale_correction_id is not null and reversal_of_movement_id is not null
      and movement_type = 'in'::public.inventory_movement_type
      and quantity_change > 0)
  );
create unique index inventory_movements_one_sale_reversal_idx
  on public.inventory_movements (reversal_of_movement_id)
  where reversal_of_movement_id is not null;

alter table public.payments
  add column sale_correction_id uuid,
  add constraint payments_sale_correction_fk
    foreign key (sale_correction_id, shop_id, location_id)
    references public.sale_corrections (id, shop_id, location_id) on delete restrict;

alter table public.customer_payment_adjustments
  add column sale_correction_id uuid,
  add constraint customer_payment_adjustments_sale_correction_fk
    foreign key (sale_correction_id, shop_id, location_id)
    references public.sale_corrections (id, shop_id, location_id) on delete restrict;

create index sale_corrections_shop_date_idx
  on public.sale_corrections (shop_id, location_id, effective_at desc, id desc);
create index payments_sale_correction_idx
  on public.payments (sale_correction_id) where sale_correction_id is not null;
create index customer_payment_adjustments_sale_correction_idx
  on public.customer_payment_adjustments (sale_correction_id)
  where sale_correction_id is not null;

alter table public.sale_corrections enable row level security;
revoke all on table public.sale_corrections from public, anon, authenticated;
grant select on table public.sale_corrections to authenticated;
grant all on table public.sale_corrections to service_role;
create policy sale_corrections_read on public.sale_corrections for select to authenticated
using (shop_private.has_permission(shop_id, 'sales.view')
  and shop_private.user_can_access_location(shop_id, location_id));

create function shop_private.prevent_sale_correction_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'SALE_CORRECTION_IMMUTABLE' using errcode = '55000'; end;
$$;
revoke all on function shop_private.prevent_sale_correction_mutation()
  from public, anon, authenticated, service_role;
create trigger trg_sale_corrections_immutable
before update or delete on public.sale_corrections
for each row execute function shop_private.prevent_sale_correction_mutation();
create trigger trg_sale_corrections_no_truncate
before truncate on public.sale_corrections
for each statement execute function shop_private.prevent_sale_correction_mutation();

-- A corrected invoice cannot accept a later receipt. A standalone payment
-- adjustment cannot race behind the correction either; only adjustments that
-- belong to the same atomic correction are accepted.
create function shop_private.enforce_sale_correction_payment_boundary()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_invoice_id uuid; v_correction_id uuid;
begin
  if tg_table_name = 'customer_payment_allocations' then
    v_invoice_id := new.invoice_id;
  else
    select allocation.invoice_id into v_invoice_id
    from public.customer_payment_allocations allocation
    where allocation.id = new.original_allocation_id;
  end if;
  select correction.id into v_correction_id from public.sale_corrections correction
  where correction.invoice_id = v_invoice_id;
  if v_correction_id is not null and (tg_table_name = 'customer_payment_allocations'
    or (to_jsonb(new) ->> 'sale_correction_id')::uuid is distinct from v_correction_id) then
    raise exception 'SALE_ALREADY_CORRECTED' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function shop_private.enforce_sale_correction_payment_boundary()
  from public, anon, authenticated, service_role;
create trigger trg_customer_payment_allocations_sale_correction
before insert on public.customer_payment_allocations for each row
execute function shop_private.enforce_sale_correction_payment_boundary();
create trigger trg_customer_payment_adjustments_sale_correction
before insert on public.customer_payment_adjustments for each row
execute function shop_private.enforce_sale_correction_payment_boundary();

create or replace function shop_private.invoice_outstanding(p_invoice_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select case when exists (
    select 1 from public.sale_corrections correction where correction.invoice_id = invoice.id
  ) then 0::numeric else greatest(0::numeric, invoice.total_amount
    - coalesce((select sum(allocation.amount)
      from public.customer_payment_allocations allocation
      join public.payments payment on payment.id = allocation.payment_id
        and payment.shop_id = allocation.shop_id
      where allocation.invoice_id = invoice.id
        and payment.customer_kind = 'receipt'
        and payment.status = 'completed'), 0)
    + coalesce((select sum(adjustment.amount)
      from public.customer_payment_adjustments adjustment
      join public.customer_payment_allocations allocation
        on allocation.id = adjustment.original_allocation_id
      where allocation.invoice_id = invoice.id), 0)) end
  from public.invoices invoice where invoice.id = p_invoice_id;
$$;

create function shop_private.correct_sale(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid,
  p_effective_at timestamptz, p_reason text, p_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_invoice public.invoices%rowtype;
  v_existing public.sale_corrections%rowtype;
  v_correction_id uuid := gen_random_uuid();
  v_hash text;
  v_refund_total numeric := 0;
  v_restored_quantity numeric := 0;
  v_part record;
  v_movement record;
  v_refund_id uuid;
begin
  v_actor := shop_private.assert_shop_write_access(p_shop_id, 'sales.issue');
  perform shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if not shop_private.has_permission(p_shop_id, 'payments.refund') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_request_id is null or p_invoice_id is null or p_effective_at is null
    or length(btrim(coalesce(p_reason, ''))) < 2 or length(p_reason) > 1000
    or length(coalesce(p_reference, '')) > 200 then
    raise exception 'INVALID_SALE_CORRECTION' using errcode = '22023';
  end if;
  perform shop_private.assert_period_is_open(p_shop_id, p_effective_at);
  v_hash := md5(jsonb_build_object('locationId', p_location_id,
    'invoiceId', p_invoice_id, 'effectiveAt', p_effective_at,
    'reason', btrim(p_reason), 'reference', nullif(btrim(p_reference), ''))::text);

  select * into v_existing from public.sale_corrections correction
  where correction.shop_id = p_shop_id and correction.request_id = p_request_id for update;
  if found then
    if v_existing.payload_hash <> v_hash or v_existing.created_by_profile_id <> v_actor then
      raise exception 'SALE_CORRECTION_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return v_existing.id;
  end if;

  select * into v_invoice from public.invoices invoice
  where invoice.id = p_invoice_id and invoice.shop_id = p_shop_id
    and invoice.location_id = p_location_id for update;
  if not found then raise exception 'SALE_NOT_FOUND' using errcode = 'P0002'; end if;
  -- A concurrent identical request may have completed while this transaction
  -- waited on the invoice serialization lock.
  select * into v_existing from public.sale_corrections correction
  where correction.shop_id = p_shop_id and correction.request_id = p_request_id;
  if found then
    if v_existing.payload_hash <> v_hash or v_existing.created_by_profile_id <> v_actor then
      raise exception 'SALE_CORRECTION_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return v_existing.id;
  end if;
  if v_invoice.status <> 'issued'::public.invoice_status then
    raise exception 'SALE_CORRECTION_REQUIRES_ISSUED_SALE' using errcode = '23514';
  end if;
  select * into v_existing from public.sale_corrections correction
  where correction.invoice_id = p_invoice_id for update;
  if found then raise exception 'SALE_ALREADY_CORRECTED' using errcode = '23514'; end if;

  -- Serialize against receipt reversals/refunds and calculate only the still
  -- effective portion of every receipt allocated to this sale.
  perform allocation.id from public.customer_payment_allocations allocation
  where allocation.invoice_id = p_invoice_id order by allocation.id for update;
  select coalesce(sum(shop_private.allocation_remaining(allocation.id)), 0)
  into v_refund_total from public.customer_payment_allocations allocation
  where allocation.invoice_id = p_invoice_id;
  if v_refund_total > v_invoice.total_amount then
    raise exception 'SALE_PAYMENT_RECONCILIATION_INVALID' using errcode = '23514';
  end if;

  perform product.id from public.products product join (
    select distinct movement.product_id from public.inventory_movements movement
    where movement.reference_id = p_invoice_id and movement.movement_type = 'out'
      and movement.sale_correction_id is null
  ) affected on affected.product_id = product.id
  order by product.id for update of product;
  perform batch.id from public.inventory_batches batch join (
    select distinct movement.batch_id from public.inventory_movements movement
    where movement.reference_id = p_invoice_id and movement.movement_type = 'out'
      and movement.sale_correction_id is null
  ) affected on affected.batch_id = batch.id
  order by batch.id for update of batch;
  select coalesce(sum(abs(movement.quantity_change)), 0)
  into v_restored_quantity from public.inventory_movements movement
  where movement.reference_id = p_invoice_id and movement.shop_id = p_shop_id
    and movement.location_id = p_location_id and movement.movement_type = 'out'
    and movement.sale_correction_id is null;

  insert into public.sale_corrections (
    id, request_id, shop_id, location_id, invoice_id, kind, payload_hash,
    effective_at, reason, reference, refund_amount, restored_quantity,
    created_by_profile_id
  ) values (
    v_correction_id, p_request_id, p_shop_id, p_location_id, p_invoice_id,
    case when v_refund_total > 0 then 'full_return'::public.sale_correction_kind
      else 'void'::public.sale_correction_kind end,
    v_hash, p_effective_at, btrim(p_reason), nullif(btrim(p_reference), ''),
    v_refund_total, v_restored_quantity, v_actor
  );

  for v_movement in
    select movement.* from public.inventory_movements movement
    where movement.reference_id = p_invoice_id and movement.shop_id = p_shop_id
      and movement.location_id = p_location_id and movement.movement_type = 'out'
      and movement.sale_correction_id is null
    order by movement.product_id, movement.batch_id, movement.id
  loop
    update public.inventory_batches batch
    set remaining_quantity = batch.remaining_quantity + abs(v_movement.quantity_change)
    where batch.id = v_movement.batch_id and batch.shop_id = p_shop_id
      and batch.location_id = p_location_id;
    if not found then raise exception 'SALE_FIFO_LAYER_NOT_FOUND' using errcode = '23514'; end if;
    insert into public.inventory_movements (
      shop_id, location_id, product_id, batch_id, quantity_change, movement_type,
      reference_id, created_by_profile_id, unit_cost_snapshot, invoice_item_id,
      sale_correction_id, reversal_of_movement_id
    ) values (
      p_shop_id, p_location_id, v_movement.product_id, v_movement.batch_id,
      abs(v_movement.quantity_change), 'in', p_invoice_id, v_actor,
      v_movement.unit_cost_snapshot, v_movement.invoice_item_id,
      v_correction_id, v_movement.id
    );
  end loop;

  for v_part in
    select allocation.id as allocation_id, allocation.payment_id,
      shop_private.allocation_remaining(allocation.id) as amount,
      payment.client_id, payment.method, payment.reference
    from public.customer_payment_allocations allocation
    join public.payments payment on payment.id = allocation.payment_id
      and payment.shop_id = allocation.shop_id
    where allocation.invoice_id = p_invoice_id
    order by allocation.id
  loop
    if v_part.amount > 0 then
      insert into public.payments (
        shop_id, location_id, payment_direction, invoice_id, client_id, amount,
        method, status, reference, paid_at, created_by_profile_id, notes,
        customer_kind, original_payment_id, sale_correction_id
      ) values (
        p_shop_id, p_location_id, 'out', p_invoice_id, v_part.client_id,
        v_part.amount, v_part.method, 'completed',
        coalesce(nullif(btrim(p_reference), ''), v_part.reference), p_effective_at,
        v_actor, btrim(p_reason), 'refund', v_part.payment_id, v_correction_id
      ) returning id into v_refund_id;
      insert into public.customer_payment_adjustments (
        shop_id, location_id, kind, adjustment_group_id, original_payment_id,
        original_allocation_id, refund_payment_id, amount, effective_at, reason,
        reference, created_by_profile_id, sale_correction_id
      ) values (
        p_shop_id, p_location_id, 'refund', v_correction_id, v_part.payment_id,
        v_part.allocation_id, v_refund_id, v_part.amount, p_effective_at,
        btrim(p_reason), nullif(btrim(p_reference), ''), v_actor, v_correction_id
      );
    end if;
  end loop;
  return v_correction_id;
exception when unique_violation then
  select * into v_existing from public.sale_corrections correction
  where correction.shop_id = p_shop_id and correction.request_id = p_request_id;
  if found and v_existing.payload_hash = v_hash
    and v_existing.created_by_profile_id = v_actor then return v_existing.id; end if;
  raise;
end;
$$;

create function shop_private.sale_correction_state(
  p_shop_id uuid, p_location_id uuid, p_invoice_id uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_invoice public.invoices%rowtype; v_correction public.sale_corrections%rowtype;
begin
  perform shop_private.assert_sale_read_access(p_shop_id);
  perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  select * into v_invoice from public.invoices invoice
  where invoice.id = p_invoice_id and invoice.shop_id = p_shop_id
    and invoice.location_id = p_location_id;
  if not found then return null; end if;
  select * into v_correction from public.sale_corrections correction
  where correction.invoice_id = p_invoice_id;
  return jsonb_build_object(
    'canCorrect', v_invoice.status = 'issued'::public.invoice_status
      and v_correction.id is null
      and shop_private.has_permission(p_shop_id, 'sales.issue')
      and shop_private.has_permission(p_shop_id, 'payments.refund'),
    'partialReturnsAvailable', false,
    'correction', case when v_correction.id is null then null else jsonb_build_object(
      'id', v_correction.id, 'kind', v_correction.kind,
      'effectiveAt', v_correction.effective_at, 'reason', v_correction.reason,
      'reference', v_correction.reference, 'refundAmount', v_correction.refund_amount,
      'restoredQuantity', v_correction.restored_quantity,
      'createdAt', v_correction.created_at,
      'actorProfileId', v_correction.created_by_profile_id
    ) end
  );
end;
$$;

create function public.correct_location_sale(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid,
  p_effective_at timestamptz, p_reason text, p_reference text default null
) returns uuid language sql security definer set search_path = '' as $$
  select shop_private.correct_sale(p_request_id, p_shop_id, p_location_id,
    p_invoice_id, p_effective_at, p_reason, p_reference);
$$;
create function public.sale_correction_state(
  p_shop_id uuid, p_location_id uuid, p_invoice_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.sale_correction_state(p_shop_id, p_location_id, p_invoice_id);
$$;

-- Keep the customer running balance correct without changing the original
-- sale debit or immutable payment history.
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

revoke all on function shop_private.correct_sale(uuid,uuid,uuid,uuid,timestamptz,text,text),
  shop_private.sale_correction_state(uuid,uuid,uuid)
from public, anon, authenticated, service_role;
revoke all on function public.correct_location_sale(uuid,uuid,uuid,uuid,timestamptz,text,text),
  public.sale_correction_state(uuid,uuid,uuid)
from public, anon, authenticated;
grant execute on function public.correct_location_sale(uuid,uuid,uuid,uuid,timestamptz,text,text),
  public.sale_correction_state(uuid,uuid,uuid)
to authenticated, service_role;

notify pgrst, 'reload schema';
