-- SS-PAY-001: immutable customer receipts, allocation, payment adjustments,
-- receivable queries, explicit due dates, and atomic customerless checkout.

create type public.customer_payment_kind as enum ('receipt', 'refund');
create type public.payment_adjustment_kind as enum ('reversal', 'refund');

alter table public.invoices add column due_date date;

alter table public.payments
  add column customer_kind public.customer_payment_kind,
  add column original_payment_id uuid,
  add constraint payments_id_shop_unique unique (id, shop_id),
  add constraint payments_original_customer_payment_fk
    foreign key (original_payment_id, shop_id)
    references public.payments (id, shop_id) on delete restrict,
  add constraint payments_customer_shape_check check (
    customer_kind is null
    or (vendor_id is null and vendor_invoice_id is null
      and status = 'completed'::public.payment_status
      and ((customer_kind = 'receipt' and payment_direction = 'in')
        or (customer_kind = 'refund' and payment_direction = 'out'
          and original_payment_id is not null)))
  ) not valid;
alter table public.payments validate constraint payments_customer_shape_check;

create table public.customer_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  payment_id uuid not null,
  invoice_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, invoice_id),
  unique (id, shop_id),
  unique (id, shop_id, payment_id),
  foreign key (payment_id, shop_id)
    references public.payments (id, shop_id) on delete restrict,
  foreign key (invoice_id, shop_id)
    references public.invoices (id, shop_id) on delete restrict
);

create table public.customer_payment_adjustments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  kind public.payment_adjustment_kind not null,
  adjustment_group_id uuid not null,
  original_payment_id uuid not null,
  original_allocation_id uuid not null,
  refund_payment_id uuid,
  amount numeric(12, 2) not null check (amount > 0),
  effective_at timestamptz not null,
  reason text not null check (length(btrim(reason)) between 2 and 1000),
  reference text,
  created_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (original_payment_id, shop_id)
    references public.payments (id, shop_id) on delete restrict,
  foreign key (original_allocation_id, shop_id, original_payment_id)
    references public.customer_payment_allocations (id, shop_id, payment_id) on delete restrict,
  foreign key (refund_payment_id, shop_id)
    references public.payments (id, shop_id) on delete restrict,
  check ((kind = 'reversal' and refund_payment_id is null)
    or (kind = 'refund' and refund_payment_id is not null))
);

create table public.customer_payment_requests (
  shop_id uuid not null references public.shops (id) on delete cascade,
  operation text not null check (operation in ('receipt', 'reversal', 'refund', 'checkout', 'save_due_date')),
  request_id uuid not null,
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  payload_hash text not null,
  result_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (shop_id, operation, request_id)
);

create index customer_payment_allocations_invoice_idx
  on public.customer_payment_allocations (shop_id, invoice_id, created_at, id);
create index customer_payment_adjustments_allocation_idx
  on public.customer_payment_adjustments (shop_id, original_allocation_id, created_at, id);
create index customer_payment_adjustments_payment_idx
  on public.customer_payment_adjustments (shop_id, original_payment_id, created_at, id);
create index customer_payment_adjustments_group_idx
  on public.customer_payment_adjustments (shop_id, adjustment_group_id);
create index invoices_receivable_idx
  on public.invoices (shop_id, client_id, due_date, issued_at, id)
  where status = 'issued';

alter table public.customer_payment_allocations enable row level security;
alter table public.customer_payment_adjustments enable row level security;
alter table public.customer_payment_requests enable row level security;

revoke all on table public.customer_payment_allocations,
  public.customer_payment_adjustments, public.customer_payment_requests
from public, anon, authenticated;
grant all on table public.customer_payment_allocations,
  public.customer_payment_adjustments, public.customer_payment_requests
to service_role;

insert into public.permissions (portal_id, key, description)
select portal.id, permission.key, permission.description
from public.portals portal
cross join (values
  ('payments.view', 'View customer payments and receivables'),
  ('payments.receive', 'Record and allocate customer receipts'),
  ('payments.reverse', 'Reverse mistaken customer receipts'),
  ('payments.refund', 'Record outbound customer refunds')
) as permission(key, description)
where portal.key = 'shop-crm'
on conflict (portal_id, key) do update set description = excluded.description;

create function shop_private.prevent_customer_payment_event_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'CUSTOMER_PAYMENT_EVENT_IMMUTABLE' using errcode = '23514';
end;
$$;
revoke all on function shop_private.prevent_customer_payment_event_mutation()
from public, anon, authenticated, service_role;

create trigger trg_customer_payment_allocation_immutable
before update or delete on public.customer_payment_allocations
for each row execute function shop_private.prevent_customer_payment_event_mutation();
create trigger trg_customer_payment_adjustment_immutable
before update or delete on public.customer_payment_adjustments
for each row execute function shop_private.prevent_customer_payment_event_mutation();

create function shop_private.payment_access(p_shop_id uuid)
returns table (
  can_view boolean, can_receive boolean, can_reverse boolean, can_refund boolean
) language sql stable security definer set search_path = '' as $$
  select
    shop_private.has_permission(p_shop_id, 'payments.view'),
    shop_private.has_permission(p_shop_id, 'payments.receive'),
    shop_private.has_permission(p_shop_id, 'payments.reverse'),
    shop_private.has_permission(p_shop_id, 'payments.refund')
  where shop_private.is_member(p_shop_id);
$$;

create function shop_private.assert_payment_read_access(p_shop_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if not coalesce((select can_view from shop_private.payment_access(p_shop_id)), false) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
end;
$$;

create function shop_private.invoice_outstanding(p_invoice_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select greatest(0::numeric, invoice.total_amount
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
      where allocation.invoice_id = invoice.id), 0))
  from public.invoices invoice where invoice.id = p_invoice_id;
$$;

create function shop_private.allocation_remaining(p_allocation_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select greatest(0::numeric, allocation.amount - coalesce(sum(adjustment.amount), 0))
  from public.customer_payment_allocations allocation
  left join public.customer_payment_adjustments adjustment
    on adjustment.original_allocation_id = allocation.id
  where allocation.id = p_allocation_id
  group by allocation.id, allocation.amount;
$$;

create function shop_private.normalized_payment_parts(p_parts jsonb, p_id_key text)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare v_result jsonb;
begin
  if p_parts is null or jsonb_typeof(p_parts) <> 'array' or jsonb_array_length(p_parts) = 0 then
    raise exception 'PAYMENT_ALLOCATIONS_REQUIRED' using errcode = '22023';
  end if;
  begin
    if exists (
      select 1 from jsonb_array_elements(p_parts) value
      where (value ->> p_id_key) is null
        or (value ->> 'amount') is null
        or (value ->> 'amount')::numeric <= 0
        or round((value ->> 'amount')::numeric, 2) <> (value ->> 'amount')::numeric
    ) then
      raise exception 'INVALID_PAYMENT_ALLOCATION';
    end if;
    select jsonb_agg(jsonb_build_object(p_id_key, part_id, 'amount', amount) order by part_id)
    into v_result
    from (
      select (value ->> p_id_key)::uuid as part_id,
        sum((value ->> 'amount')::numeric) as amount
      from jsonb_array_elements(p_parts)
      group by (value ->> p_id_key)::uuid
    ) normalized;
  exception when others then
    raise exception 'INVALID_PAYMENT_ALLOCATION' using errcode = '22023';
  end;
  if exists (select 1 from jsonb_array_elements(v_result) value
    where (value ->> 'amount')::numeric <= 0) then
    raise exception 'INVALID_PAYMENT_ALLOCATION' using errcode = '22023';
  end if;
  return v_result;
end;
$$;

create function shop_private.record_customer_receipt(
  p_request_id uuid, p_shop_id uuid, p_customer_id uuid, p_amount numeric,
  p_paid_at timestamptz, p_method public.payment_method,
  p_reference text, p_notes text, p_allocations jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_profile_id uuid;
  v_request public.customer_payment_requests%rowtype;
  v_payment_id uuid;
  v_parts jsonb;
  v_hash text;
  v_total numeric;
  v_part record;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'payments.receive');
  if p_request_id is null or p_customer_id is null or p_amount is null or p_amount <= 0
    or round(p_amount, 2) <> p_amount or p_paid_at is null or p_method is null
    or length(coalesce(p_reference, '')) > 200 or length(coalesce(p_notes, '')) > 2000 then
    raise exception 'INVALID_CUSTOMER_RECEIPT' using errcode = '22023';
  end if;
  perform shop_private.assert_period_is_open(p_shop_id, p_paid_at);
  if not exists (select 1 from public.clients where id = p_customer_id
    and shop_id = p_shop_id and is_active) then raise exception 'CUSTOMER_NOT_FOUND'; end if;

  v_parts := shop_private.normalized_payment_parts(p_allocations, 'invoice_id');
  select sum((value ->> 'amount')::numeric) into v_total from jsonb_array_elements(v_parts);
  if v_total <> p_amount then raise exception 'UNALLOCATED_RECEIPT_REJECTED' using errcode = '23514'; end if;
  v_hash := md5(jsonb_build_object('customerId', p_customer_id, 'amount', p_amount,
    'paidAt', p_paid_at, 'method', p_method, 'reference', nullif(btrim(p_reference), ''),
    'notes', nullif(btrim(p_notes), ''), 'allocations', v_parts)::text);
  insert into public.customer_payment_requests
    (shop_id, operation, request_id, actor_profile_id, payload_hash)
  values (p_shop_id, 'receipt', p_request_id, v_profile_id, v_hash)
  on conflict do nothing;
  select * into v_request from public.customer_payment_requests
  where shop_id = p_shop_id and operation = 'receipt' and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_profile_id or v_request.payload_hash <> v_hash then
    raise exception 'PAYMENT_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;

  perform invoice.id from public.invoices invoice
  join jsonb_array_elements(v_parts) part on (part ->> 'invoice_id')::uuid = invoice.id
  order by invoice.id for update of invoice;
  for v_part in select value from jsonb_array_elements(v_parts) loop
    if not exists (select 1 from public.invoices invoice
      where invoice.id = (v_part.value ->> 'invoice_id')::uuid
        and invoice.shop_id = p_shop_id and invoice.client_id = p_customer_id
        and invoice.status = 'issued') then
      raise exception 'PAYMENT_INVOICE_NOT_ELIGIBLE' using errcode = '23514';
    end if;
    if (v_part.value ->> 'amount')::numeric
      > shop_private.invoice_outstanding((v_part.value ->> 'invoice_id')::uuid) then
      raise exception 'PAYMENT_OVERPAYMENT_REJECTED' using errcode = '23514';
    end if;
  end loop;

  insert into public.payments (shop_id, payment_direction, invoice_id, client_id,
    amount, method, status, reference, paid_at, created_by_profile_id, notes, customer_kind)
  values (p_shop_id, 'in', case when jsonb_array_length(v_parts) = 1
      then (v_parts -> 0 ->> 'invoice_id')::uuid else null end,
    p_customer_id, p_amount, p_method, 'completed', nullif(btrim(p_reference), ''),
    p_paid_at, v_profile_id, nullif(btrim(p_notes), ''), 'receipt')
  returning id into v_payment_id;
  insert into public.customer_payment_allocations (shop_id, payment_id, invoice_id, amount)
  select p_shop_id, v_payment_id, (value ->> 'invoice_id')::uuid,
    (value ->> 'amount')::numeric from jsonb_array_elements(v_parts);
  update public.customer_payment_requests set result_id = v_payment_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'receipt' and request_id = p_request_id;
  return v_payment_id;
end;
$$;

create function shop_private.adjust_customer_receipt(
  p_operation text, p_request_id uuid, p_shop_id uuid, p_original_payment_id uuid,
  p_effective_at timestamptz, p_reason text, p_method public.payment_method,
  p_reference text, p_parts jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_profile_id uuid;
  v_permission text := case when p_operation = 'reversal' then 'payments.reverse' else 'payments.refund' end;
  v_request public.customer_payment_requests%rowtype;
  v_original public.payments%rowtype;
  v_parts jsonb;
  v_hash text;
  v_total numeric;
  v_result_id uuid := gen_random_uuid();
  v_refund_id uuid;
  v_part record;
begin
  if p_operation not in ('reversal', 'refund') then raise exception 'INVALID_PAYMENT_ADJUSTMENT'; end if;
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, v_permission);
  if p_request_id is null or p_original_payment_id is null or p_effective_at is null
    or length(btrim(coalesce(p_reason, ''))) < 2 or length(p_reason) > 1000
    or length(coalesce(p_reference, '')) > 200
    or (p_operation = 'refund' and p_method is null) then
    raise exception 'INVALID_PAYMENT_ADJUSTMENT' using errcode = '22023';
  end if;
  perform shop_private.assert_period_is_open(p_shop_id, p_effective_at);
  v_parts := shop_private.normalized_payment_parts(p_parts, 'allocation_id');
  select sum((value ->> 'amount')::numeric) into v_total from jsonb_array_elements(v_parts);
  v_hash := md5(jsonb_build_object('originalPaymentId', p_original_payment_id,
    'effectiveAt', p_effective_at, 'reason', btrim(p_reason), 'method', p_method,
    'reference', nullif(btrim(p_reference), ''), 'allocations', v_parts)::text);
  insert into public.customer_payment_requests
    (shop_id, operation, request_id, actor_profile_id, payload_hash)
  values (p_shop_id, p_operation, p_request_id, v_profile_id, v_hash) on conflict do nothing;
  select * into v_request from public.customer_payment_requests
  where shop_id = p_shop_id and operation = p_operation and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_profile_id or v_request.payload_hash <> v_hash then
    raise exception 'PAYMENT_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;

  select * into v_original from public.payments where id = p_original_payment_id
    and shop_id = p_shop_id and customer_kind = 'receipt' and status = 'completed' for update;
  if not found then raise exception 'CUSTOMER_RECEIPT_NOT_FOUND'; end if;
  if v_original.client_id is null then
    raise exception 'CUSTOMERLESS_PAYMENT_ADJUSTMENT_DEFERRED' using errcode = '23514';
  end if;
  perform allocation.id from public.customer_payment_allocations allocation
  join jsonb_array_elements(v_parts) part
    on (part ->> 'allocation_id')::uuid = allocation.id
  order by allocation.id for update of allocation;
  for v_part in select value from jsonb_array_elements(v_parts) loop
    if not exists (select 1 from public.customer_payment_allocations allocation
      where allocation.id = (v_part.value ->> 'allocation_id')::uuid
        and allocation.shop_id = p_shop_id and allocation.payment_id = p_original_payment_id) then
      raise exception 'PAYMENT_ALLOCATION_NOT_FOUND';
    end if;
    if (v_part.value ->> 'amount')::numeric
      > shop_private.allocation_remaining((v_part.value ->> 'allocation_id')::uuid) then
      raise exception 'PAYMENT_ADJUSTMENT_EXCEEDS_EFFECTIVE_AMOUNT' using errcode = '23514';
    end if;
  end loop;
  if p_operation = 'refund' then
    insert into public.payments (shop_id, payment_direction, client_id, amount, method,
      status, reference, paid_at, created_by_profile_id, notes, customer_kind, original_payment_id)
    values (p_shop_id, 'out', v_original.client_id, v_total, p_method, 'completed',
      nullif(btrim(p_reference), ''), p_effective_at, v_profile_id, btrim(p_reason),
      'refund', p_original_payment_id) returning id into v_refund_id;
    v_result_id := v_refund_id;
  end if;
  insert into public.customer_payment_adjustments (id, shop_id, kind, adjustment_group_id,
    original_payment_id, original_allocation_id, refund_payment_id, amount,
    effective_at, reason, reference, created_by_profile_id)
  select case when jsonb_array_length(v_parts) = 1 and p_operation = 'reversal'
      then v_result_id else gen_random_uuid() end,
    p_shop_id, p_operation::public.payment_adjustment_kind, v_result_id, p_original_payment_id,
    (value ->> 'allocation_id')::uuid, v_refund_id, (value ->> 'amount')::numeric,
    p_effective_at, btrim(p_reason), nullif(btrim(p_reference), ''), v_profile_id
  from jsonb_array_elements(v_parts);
  update public.customer_payment_requests set result_id = v_result_id, completed_at = now()
  where shop_id = p_shop_id and operation = p_operation and request_id = p_request_id;
  return v_result_id;
end;
$$;

create function shop_private.list_outstanding_invoices(
  p_shop_id uuid, p_customer_id uuid default null, p_overdue_only boolean default false,
  p_page integer default 1, p_page_size integer default 20
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_total bigint; v_items jsonb;
begin
  perform shop_private.assert_payment_read_access(p_shop_id);
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then
    raise exception 'INVALID_RECEIVABLE_QUERY' using errcode = '22023';
  end if;
  if p_customer_id is not null and not exists (select 1 from public.clients
    where id = p_customer_id and shop_id = p_shop_id) then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  select coalesce(max(rows.full_count), 0),
    coalesce(jsonb_agg((to_jsonb(rows) - 'full_count') order by rows.sort_at, rows.id), '[]'::jsonb)
  into v_total, v_items from (
    select count(*) over () as full_count, invoice.id, invoice.invoice_number, invoice.client_id,
      invoice.client_name_snapshot, invoice.total_amount, invoice.due_date,
      shop_private.invoice_outstanding(invoice.id) as outstanding,
      case when shop_private.invoice_outstanding(invoice.id) = invoice.total_amount then 'unpaid' else 'partial' end as settlement_state,
      (invoice.due_date is not null and invoice.due_date < current_date) as overdue,
      coalesce(invoice.due_date, invoice.issued_at::date) as sort_at
    from public.invoices invoice
    where invoice.shop_id = p_shop_id and invoice.status = 'issued'
      and invoice.client_id is not null
      and (p_customer_id is null or invoice.client_id = p_customer_id)
      and shop_private.invoice_outstanding(invoice.id) > 0
      and (not p_overdue_only or (invoice.due_date is not null and invoice.due_date < current_date))
    order by coalesce(invoice.due_date, invoice.issued_at::date), invoice.id
    offset (p_page - 1) * p_page_size limit p_page_size
  ) rows;
  return jsonb_build_object('items', v_items, 'total', v_total,
    'page', p_page, 'pageSize', p_page_size);
end;
$$;

create function shop_private.customer_statement(
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

create function shop_private.save_sale_draft_with_due_date(
  p_request_id uuid, p_shop_id uuid, p_invoice_id uuid, p_customer_id uuid,
  p_due_date date, p_notes text, p_lines jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_profile_id uuid;
  v_request public.customer_payment_requests%rowtype;
  v_invoice_id uuid;
  v_hash text;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'sales.manage');
  v_hash := md5(jsonb_build_object('invoiceId', p_invoice_id, 'customerId', p_customer_id,
    'dueDate', p_due_date, 'notes', nullif(btrim(p_notes), ''), 'lines', p_lines)::text);
  insert into public.customer_payment_requests
    (shop_id, operation, request_id, actor_profile_id, payload_hash)
  values (p_shop_id, 'save_due_date', p_request_id, v_profile_id, v_hash) on conflict do nothing;
  select * into v_request from public.customer_payment_requests
  where shop_id = p_shop_id and operation = 'save_due_date' and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_profile_id or v_request.payload_hash <> v_hash then
    raise exception 'SALE_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;
  v_invoice_id := shop_private.save_sale_draft(p_request_id, p_shop_id, p_invoice_id,
    p_customer_id, p_notes, p_lines);
  update public.invoices set due_date = p_due_date where id = v_invoice_id
    and shop_id = p_shop_id and status = 'draft';
  update public.customer_payment_requests set result_id = v_invoice_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'save_due_date' and request_id = p_request_id;
  return v_invoice_id;
end;
$$;

create function shop_private.checkout_customerless_sale(
  p_request_id uuid, p_shop_id uuid, p_invoice_id uuid, p_amount numeric,
  p_paid_at timestamptz, p_method public.payment_method, p_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
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
      v_total := round(v_product.sale_price * v_line.quantity, 2);
      update public.invoice_items set item_name = v_product.name,
        unit_price = v_product.sale_price, discount_amount = 0, total_amount = v_total,
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
      then invoice.total_amount - shop_private.invoice_outstanding(invoice.id) else 0 end,
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

create function public.payment_access(p_shop_id uuid)
returns table (can_view boolean, can_receive boolean, can_reverse boolean, can_refund boolean)
language sql stable security definer set search_path = '' as $$
  select * from shop_private.payment_access(p_shop_id);
$$;
create function public.record_customer_receipt(
  p_request_id uuid, p_shop_id uuid, p_customer_id uuid, p_amount numeric,
  p_paid_at timestamptz, p_method public.payment_method,
  p_reference text, p_notes text, p_allocations jsonb
) returns uuid language sql security definer set search_path = '' as $$
  select shop_private.record_customer_receipt(p_request_id, p_shop_id, p_customer_id,
    p_amount, p_paid_at, p_method, p_reference, p_notes, p_allocations);
$$;
create function public.reverse_customer_receipt(
  p_request_id uuid, p_shop_id uuid, p_original_payment_id uuid,
  p_effective_at timestamptz, p_reason text, p_allocations jsonb
) returns uuid language sql security definer set search_path = '' as $$
  select shop_private.adjust_customer_receipt('reversal', p_request_id, p_shop_id,
    p_original_payment_id, p_effective_at, p_reason, null, null, p_allocations);
$$;
create function public.refund_customer_receipt(
  p_request_id uuid, p_shop_id uuid, p_original_payment_id uuid,
  p_effective_at timestamptz, p_method public.payment_method, p_reference text,
  p_reason text, p_allocations jsonb
) returns uuid language sql security definer set search_path = '' as $$
  select shop_private.adjust_customer_receipt('refund', p_request_id, p_shop_id,
    p_original_payment_id, p_effective_at, p_reason, p_method, p_reference, p_allocations);
$$;
create function public.list_outstanding_invoices(p_shop_id uuid, p_customer_id uuid default null,
  p_overdue_only boolean default false, p_page integer default 1, p_page_size integer default 20)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.list_outstanding_invoices(p_shop_id, p_customer_id, p_overdue_only, p_page, p_page_size);
$$;
create function public.customer_statement(p_shop_id uuid, p_customer_id uuid,
  p_page integer default 1, p_page_size integer default 50)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.customer_statement(p_shop_id, p_customer_id, p_page, p_page_size);
$$;
create function public.save_sale_draft_with_due_date(p_request_id uuid, p_shop_id uuid,
  p_invoice_id uuid, p_customer_id uuid, p_due_date date, p_notes text, p_lines jsonb)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.save_sale_draft_with_due_date(p_request_id, p_shop_id, p_invoice_id,
    p_customer_id, p_due_date, p_notes, p_lines);
$$;
create function public.checkout_customerless_sale(p_request_id uuid, p_shop_id uuid,
  p_invoice_id uuid, p_amount numeric, p_paid_at timestamptz,
  p_method public.payment_method, p_reference text)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.checkout_customerless_sale(p_request_id, p_shop_id, p_invoice_id,
    p_amount, p_paid_at, p_method, p_reference);
$$;

revoke all on function shop_private.payment_access(uuid),
  shop_private.assert_payment_read_access(uuid), shop_private.invoice_outstanding(uuid),
  shop_private.allocation_remaining(uuid), shop_private.normalized_payment_parts(jsonb, text),
  shop_private.record_customer_receipt(uuid, uuid, uuid, numeric, timestamptz,
    public.payment_method, text, text, jsonb),
  shop_private.adjust_customer_receipt(text, uuid, uuid, uuid, timestamptz, text,
    public.payment_method, text, jsonb),
  shop_private.list_outstanding_invoices(uuid, uuid, boolean, integer, integer),
  shop_private.customer_statement(uuid, uuid, integer, integer),
  shop_private.save_sale_draft_with_due_date(uuid, uuid, uuid, uuid, date, text, jsonb),
  shop_private.checkout_customerless_sale(uuid, uuid, uuid, numeric, timestamptz,
    public.payment_method, text)
from public, anon, authenticated, service_role;

revoke all on function public.payment_access(uuid),
  public.record_customer_receipt(uuid, uuid, uuid, numeric, timestamptz,
    public.payment_method, text, text, jsonb),
  public.reverse_customer_receipt(uuid, uuid, uuid, timestamptz, text, jsonb),
  public.refund_customer_receipt(uuid, uuid, uuid, timestamptz,
    public.payment_method, text, text, jsonb),
  public.list_outstanding_invoices(uuid, uuid, boolean, integer, integer),
  public.customer_statement(uuid, uuid, integer, integer),
  public.save_sale_draft_with_due_date(uuid, uuid, uuid, uuid, date, text, jsonb),
  public.checkout_customerless_sale(uuid, uuid, uuid, numeric, timestamptz,
    public.payment_method, text)
from public, anon, authenticated;
grant execute on function public.payment_access(uuid),
  public.record_customer_receipt(uuid, uuid, uuid, numeric, timestamptz,
    public.payment_method, text, text, jsonb),
  public.reverse_customer_receipt(uuid, uuid, uuid, timestamptz, text, jsonb),
  public.refund_customer_receipt(uuid, uuid, uuid, timestamptz,
    public.payment_method, text, text, jsonb),
  public.list_outstanding_invoices(uuid, uuid, boolean, integer, integer),
  public.customer_statement(uuid, uuid, integer, integer),
  public.save_sale_draft_with_due_date(uuid, uuid, uuid, uuid, date, text, jsonb),
  public.checkout_customerless_sale(uuid, uuid, uuid, numeric, timestamptz,
    public.payment_method, text)
to authenticated;

drop policy if exists payment_permission_read on public.payments;
create policy payment_capability_read on public.payments for select to authenticated
using (shop_private.has_permission(shop_id, 'payments.view'));
create policy customer_payment_allocation_read on public.customer_payment_allocations
for select to authenticated using (shop_private.has_permission(shop_id, 'payments.view'));
create policy customer_payment_adjustment_read on public.customer_payment_adjustments
for select to authenticated using (shop_private.has_permission(shop_id, 'payments.view'));
grant select on table public.customer_payment_allocations,
  public.customer_payment_adjustments to authenticated;

revoke insert, update, delete, truncate on table public.payments,
  public.customer_payment_allocations, public.customer_payment_adjustments,
  public.customer_payment_requests from anon, authenticated;

notify pgrst, 'reload schema';
