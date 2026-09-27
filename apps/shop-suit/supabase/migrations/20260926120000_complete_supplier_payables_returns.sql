-- SS-PUR-002: supplier lifecycle, authoritative payables, immutable supplier
-- payments/reversals, and traceable physical returns / financial credits.

create type public.supplier_payment_kind as enum ('payment');

alter table public.vendors
  add column archived_at timestamptz,
  add column archived_by_profile_id uuid references public.profiles (id) on delete restrict;

alter table public.vendor_invoices
  add constraint vendor_invoices_id_shop_unique unique (id, shop_id);

alter table public.payments
  add column supplier_kind public.supplier_payment_kind,
  add constraint payments_supplier_shape_check check (
    supplier_kind is null
    or (supplier_kind = 'payment'
      and customer_kind is null
      and payment_direction = 'out'
      and status = 'completed'
      and vendor_id is not null)
  ) not valid;
alter table public.payments validate constraint payments_supplier_shape_check;

create table public.supplier_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  payment_id uuid not null,
  vendor_invoice_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, vendor_invoice_id),
  unique (id, shop_id),
  unique (id, shop_id, payment_id),
  foreign key (payment_id, shop_id)
    references public.payments (id, shop_id) on delete restrict,
  foreign key (vendor_invoice_id, shop_id)
    references public.vendor_invoices (id, shop_id) on delete restrict
);

create table public.supplier_payment_reversals (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  reversal_group_id uuid not null,
  original_payment_id uuid not null,
  original_allocation_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  effective_at timestamptz not null,
  reason text not null check (length(btrim(reason)) between 2 and 1000),
  reference text,
  created_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (original_payment_id, shop_id)
    references public.payments (id, shop_id) on delete restrict,
  foreign key (original_allocation_id, shop_id, original_payment_id)
    references public.supplier_payment_allocations (id, shop_id, payment_id) on delete restrict
);

create table public.purchase_returns (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  vendor_id uuid not null,
  vendor_invoice_id uuid not null,
  vendor_name_snapshot text not null,
  returned_at timestamptz not null,
  reason text not null check (length(btrim(reason)) between 2 and 1000),
  reference text,
  total_amount numeric(12, 2) not null check (total_amount > 0),
  created_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, shop_id),
  foreign key (vendor_id, shop_id)
    references public.vendors (id, shop_id) on delete restrict,
  foreign key (vendor_invoice_id, shop_id)
    references public.vendor_invoices (id, shop_id) on delete restrict
);

create table public.purchase_return_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  purchase_return_id uuid not null,
  vendor_invoice_item_id uuid not null references public.vendor_invoice_items (id) on delete restrict,
  product_id uuid not null,
  inventory_batch_id uuid not null references public.inventory_batches (id) on delete restrict,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost numeric(12, 4) not null check (unit_cost >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  unique (purchase_return_id, vendor_invoice_item_id),
  foreign key (purchase_return_id, shop_id)
    references public.purchase_returns (id, shop_id) on delete restrict,
  foreign key (product_id, shop_id)
    references public.products (id, shop_id) on delete restrict
);

create table public.supplier_credits (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  vendor_id uuid not null,
  vendor_invoice_id uuid not null,
  purchase_return_id uuid,
  vendor_name_snapshot text not null,
  amount numeric(12, 2) not null check (amount > 0),
  effective_at timestamptz not null,
  reason text not null check (length(btrim(reason)) between 2 and 1000),
  reference text,
  created_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (purchase_return_id),
  unique (id, shop_id),
  foreign key (vendor_id, shop_id)
    references public.vendors (id, shop_id) on delete restrict,
  foreign key (vendor_invoice_id, shop_id)
    references public.vendor_invoices (id, shop_id) on delete restrict,
  foreign key (purchase_return_id, shop_id)
    references public.purchase_returns (id, shop_id) on delete restrict
);

create table public.supplier_operation_requests (
  shop_id uuid not null references public.shops (id) on delete cascade,
  operation text not null check (operation in ('payment', 'payment_reversal', 'credit', 'return')),
  request_id uuid not null,
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  payload_hash text not null,
  result_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (shop_id, operation, request_id)
);

create index supplier_payment_allocations_invoice_idx
  on public.supplier_payment_allocations (shop_id, vendor_invoice_id, created_at, id);
create index supplier_payment_reversals_allocation_idx
  on public.supplier_payment_reversals (shop_id, original_allocation_id, created_at, id);
create index purchase_returns_invoice_idx
  on public.purchase_returns (shop_id, vendor_invoice_id, returned_at, id);
create index supplier_credits_invoice_idx
  on public.supplier_credits (shop_id, vendor_invoice_id, effective_at, id);
create index vendors_search_idx on public.vendors (shop_id, is_active, lower(name));
create index vendor_invoices_list_idx on public.vendor_invoices (shop_id, issued_at desc, id);

alter table public.supplier_payment_allocations enable row level security;
alter table public.supplier_payment_reversals enable row level security;
alter table public.purchase_returns enable row level security;
alter table public.purchase_return_items enable row level security;
alter table public.supplier_credits enable row level security;
alter table public.supplier_operation_requests enable row level security;

revoke all on table public.supplier_payment_allocations,
  public.supplier_payment_reversals, public.purchase_returns,
  public.purchase_return_items, public.supplier_credits,
  public.supplier_operation_requests from public, anon, authenticated;
grant all on table public.supplier_payment_allocations,
  public.supplier_payment_reversals, public.purchase_returns,
  public.purchase_return_items, public.supplier_credits,
  public.supplier_operation_requests to service_role;

insert into public.permissions (portal_id, key, description)
select portal.id, permission.key, permission.description
from public.portals portal
cross join (values
  ('supplier_payments.record', 'Record fully allocated supplier payments'),
  ('supplier_payments.reverse', 'Reverse supplier payments'),
  ('supplier_credits.manage', 'Record supplier credits'),
  ('purchase_returns.manage', 'Return available purchase stock')
) as permission(key, description)
where portal.key = 'shop-crm'
on conflict (portal_id, key) do update set description = excluded.description;

create function shop_private.prevent_supplier_event_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'SUPPLIER_EVENT_IMMUTABLE' using errcode = '23514';
end;
$$;
revoke all on function shop_private.prevent_supplier_event_mutation()
from public, anon, authenticated, service_role;

create trigger trg_supplier_payment_allocation_immutable before update or delete
on public.supplier_payment_allocations for each row
execute function shop_private.prevent_supplier_event_mutation();
create trigger trg_supplier_payment_reversal_immutable before update or delete
on public.supplier_payment_reversals for each row
execute function shop_private.prevent_supplier_event_mutation();
create trigger trg_purchase_return_immutable before update or delete
on public.purchase_returns for each row
execute function shop_private.prevent_supplier_event_mutation();
create trigger trg_purchase_return_item_immutable before update or delete
on public.purchase_return_items for each row
execute function shop_private.prevent_supplier_event_mutation();
create trigger trg_supplier_credit_immutable before update or delete
on public.supplier_credits for each row
execute function shop_private.prevent_supplier_event_mutation();

create function shop_private.supplier_access(p_shop_id uuid)
returns table (
  can_view boolean, can_manage_suppliers boolean, can_manage_purchases boolean,
  can_record_payment boolean, can_reverse_payment boolean,
  can_record_credit boolean, can_return_stock boolean
) language sql stable security definer set search_path = '' as $$
  select
    shop_private.has_permission(p_shop_id, 'vendor_invoices.view'),
    shop_private.has_permission(p_shop_id, 'vendors.manage'),
    shop_private.has_permission(p_shop_id, 'vendor_invoices.manage'),
    shop_private.has_permission(p_shop_id, 'supplier_payments.record'),
    shop_private.has_permission(p_shop_id, 'supplier_payments.reverse'),
    shop_private.has_permission(p_shop_id, 'supplier_credits.manage'),
    shop_private.has_permission(p_shop_id, 'purchase_returns.manage')
  where shop_private.is_member(p_shop_id);
$$;

create function shop_private.assert_supplier_read_access(p_shop_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if not coalesce((select can_view from shop_private.supplier_access(p_shop_id)), false) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
end;
$$;

create function shop_private.purchase_payable(p_vendor_invoice_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select case when invoice.status = 'posted' then greatest(0::numeric,
    invoice.total_amount
    - coalesce((select sum(allocation.amount)
      from public.supplier_payment_allocations allocation
      join public.payments payment on payment.id = allocation.payment_id
      where allocation.vendor_invoice_id = invoice.id
        and payment.supplier_kind = 'payment' and payment.status = 'completed'), 0)
    + coalesce((select sum(reversal.amount)
      from public.supplier_payment_reversals reversal
      join public.supplier_payment_allocations allocation
        on allocation.id = reversal.original_allocation_id
      where allocation.vendor_invoice_id = invoice.id), 0)
    - coalesce((select sum(credit.amount) from public.supplier_credits credit
      where credit.vendor_invoice_id = invoice.id), 0)) else 0 end
  from public.vendor_invoices invoice where invoice.id = p_vendor_invoice_id;
$$;

create function shop_private.supplier_allocation_remaining(p_allocation_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select greatest(0::numeric, allocation.amount - coalesce(sum(reversal.amount), 0))
  from public.supplier_payment_allocations allocation
  left join public.supplier_payment_reversals reversal
    on reversal.original_allocation_id = allocation.id
  where allocation.id = p_allocation_id
  group by allocation.id, allocation.amount;
$$;

create function shop_private.save_vendor(
  p_shop_id uuid, p_vendor_id uuid, p_name text, p_contact_name text,
  p_phone text, p_email text, p_address text, p_tax_number text, p_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_profile_id uuid;
  v_vendor_id uuid;
  v_name text := btrim(p_name);
  v_email text := nullif(btrim(p_email), '');
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'vendors.manage');
  perform shop_private.assert_purchase_entitlement(p_shop_id);
  if v_name is null or length(v_name) < 2 or length(v_name) > 160
    or length(coalesce(btrim(p_contact_name), '')) > 160
    or length(coalesce(btrim(p_phone), '')) > 40
    or (v_email is not null and (length(v_email) > 254
      or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+$'))
    or length(coalesce(btrim(p_address), '')) > 500
    or length(coalesce(btrim(p_tax_number), '')) > 80
    or length(coalesce(btrim(p_notes), '')) > 1000 then
    raise exception 'INVALID_VENDOR' using errcode = '22023';
  end if;
  if p_vendor_id is null then
    insert into public.vendors (shop_id, name, contact_name, phone, email,
      address, tax_number, notes, created_by_profile_id)
    values (p_shop_id, v_name, nullif(btrim(p_contact_name), ''),
      nullif(btrim(p_phone), ''), v_email, nullif(btrim(p_address), ''),
      nullif(btrim(p_tax_number), ''), nullif(btrim(p_notes), ''), v_profile_id)
    returning id into v_vendor_id;
  else
    update public.vendors set name = v_name,
      contact_name = nullif(btrim(p_contact_name), ''),
      phone = nullif(btrim(p_phone), ''), email = v_email,
      address = nullif(btrim(p_address), ''),
      tax_number = nullif(btrim(p_tax_number), ''),
      notes = nullif(btrim(p_notes), ''), updated_at = now()
    where id = p_vendor_id and shop_id = p_shop_id and is_active
    returning id into v_vendor_id;
    if v_vendor_id is null then raise exception 'VENDOR_NOT_FOUND'; end if;
  end if;
  return v_vendor_id;
end;
$$;

create function shop_private.archive_vendor(p_shop_id uuid, p_vendor_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_profile_id uuid;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'vendors.manage');
  update public.vendors set is_active = false, archived_at = now(),
    archived_by_profile_id = v_profile_id, updated_at = now()
  where id = p_vendor_id and shop_id = p_shop_id and is_active;
  if not found then raise exception 'VENDOR_NOT_FOUND'; end if;
end;
$$;

create function shop_private.list_vendors(
  p_shop_id uuid, p_search text default null, p_is_active boolean default true,
  p_page integer default 1, p_page_size integer default 20
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_search text := nullif(btrim(p_search), ''); v_total bigint; v_items jsonb;
begin
  perform shop_private.assert_supplier_read_access(p_shop_id);
  if p_page < 1 or p_page_size < 1 or p_page_size > 100
    or length(coalesce(v_search, '')) > 160 then
    raise exception 'INVALID_VENDOR_QUERY' using errcode = '22023'; end if;
  select count(*) into v_total from public.vendors vendor
  where vendor.shop_id = p_shop_id
    and (p_is_active is null or vendor.is_active = p_is_active)
    and (v_search is null or vendor.name ilike '%' || v_search || '%'
      or vendor.contact_name ilike '%' || v_search || '%'
      or vendor.phone ilike '%' || v_search || '%'
      or vendor.email ilike '%' || v_search || '%');
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.name, rows.id), '[]'::jsonb)
  into v_items from (
    select vendor.id, vendor.name, vendor.contact_name, vendor.phone, vendor.email,
      vendor.address, vendor.tax_number, vendor.notes, vendor.is_active,
      vendor.created_at, vendor.updated_at, vendor.archived_at,
      coalesce((select sum(shop_private.purchase_payable(invoice.id))
        from public.vendor_invoices invoice where invoice.vendor_id = vendor.id), 0) payable
    from public.vendors vendor where vendor.shop_id = p_shop_id
      and (p_is_active is null or vendor.is_active = p_is_active)
      and (v_search is null or vendor.name ilike '%' || v_search || '%'
        or vendor.contact_name ilike '%' || v_search || '%'
        or vendor.phone ilike '%' || v_search || '%'
        or vendor.email ilike '%' || v_search || '%')
    order by lower(vendor.name), vendor.id
    offset (p_page - 1) * p_page_size limit p_page_size
  ) rows;
  return jsonb_build_object('items', v_items, 'total', v_total,
    'page', p_page, 'pageSize', p_page_size);
end;
$$;

create function shop_private.list_purchases(
  p_shop_id uuid, p_search text default null, p_vendor_id uuid default null,
  p_status public.vendor_invoice_status default null, p_settlement text default null,
  p_from date default null, p_to date default null,
  p_page integer default 1, p_page_size integer default 20
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_search text := nullif(btrim(p_search), ''); v_total bigint; v_items jsonb;
begin
  perform shop_private.assert_supplier_read_access(p_shop_id);
  if p_page < 1 or p_page_size < 1 or p_page_size > 100
    or length(coalesce(v_search, '')) > 160
    or p_settlement not in ('unpaid', 'partial', 'paid')
      and p_settlement is not null or (p_from is not null and p_to is not null and p_from > p_to) then
    raise exception 'INVALID_PURCHASE_QUERY' using errcode = '22023'; end if;
  if p_vendor_id is not null and not exists (select 1 from public.vendors
    where id = p_vendor_id and shop_id = p_shop_id) then raise exception 'VENDOR_NOT_FOUND'; end if;
  with matching as (
    select invoice.*, shop_private.purchase_payable(invoice.id) payable
    from public.vendor_invoices invoice where invoice.shop_id = p_shop_id
      and (p_vendor_id is null or invoice.vendor_id = p_vendor_id)
      and (p_status is null or invoice.status = p_status)
      and (p_from is null or invoice.issued_at::date >= p_from)
      and (p_to is null or invoice.issued_at::date <= p_to)
      and (v_search is null or invoice.vendor_name_snapshot ilike '%' || v_search || '%'
        or invoice.invoice_number ilike '%' || v_search || '%'
        or invoice.notes ilike '%' || v_search || '%')
  ), filtered as (
    select * from matching where p_settlement is null
      or (p_settlement = 'paid' and payable = 0)
      or (p_settlement = 'unpaid' and payable = total_amount)
      or (p_settlement = 'partial' and payable > 0 and payable < total_amount)
  ) select count(*) into v_total from filtered;
  with matching as (
    select invoice.*, shop_private.purchase_payable(invoice.id) payable
    from public.vendor_invoices invoice where invoice.shop_id = p_shop_id
      and (p_vendor_id is null or invoice.vendor_id = p_vendor_id)
      and (p_status is null or invoice.status = p_status)
      and (p_from is null or invoice.issued_at::date >= p_from)
      and (p_to is null or invoice.issued_at::date <= p_to)
      and (v_search is null or invoice.vendor_name_snapshot ilike '%' || v_search || '%'
        or invoice.invoice_number ilike '%' || v_search || '%'
        or invoice.notes ilike '%' || v_search || '%')
  ), filtered as (
    select * from matching where p_settlement is null
      or (p_settlement = 'paid' and payable = 0)
      or (p_settlement = 'unpaid' and payable = total_amount)
      or (p_settlement = 'partial' and payable > 0 and payable < total_amount)
  ) select coalesce(jsonb_agg(jsonb_build_object(
      'id', rows.id, 'vendorId', rows.vendor_id,
      'vendorNameSnapshot', rows.vendor_name_snapshot,
      'invoiceNumber', rows.invoice_number, 'status', rows.status,
      'issuedAt', rows.issued_at, 'totalAmount', rows.total_amount,
      'payable', rows.payable, 'settlementState', case
        when rows.payable = 0 then 'paid'
        when rows.payable = rows.total_amount then 'unpaid' else 'partial' end,
      'notes', rows.notes, 'createdAt', rows.created_at)
      order by rows.issued_at desc nulls last, rows.id desc), '[]'::jsonb)
  into v_items from (select * from filtered order by issued_at desc nulls last, id desc
    offset (p_page - 1) * p_page_size limit p_page_size) rows;
  return jsonb_build_object('items', v_items, 'total', v_total,
    'page', p_page, 'pageSize', p_page_size);
end;
$$;

create function shop_private.get_purchase(p_shop_id uuid, p_purchase_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
      'quantity', item.quantity, 'unitCost', item.unit_cost,
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

create function shop_private.record_supplier_payment(
  p_request_id uuid, p_shop_id uuid, p_vendor_id uuid, p_amount numeric,
  p_paid_at timestamptz, p_method public.payment_method,
  p_reference text, p_notes text, p_allocations jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile_id uuid; v_request public.supplier_operation_requests%rowtype;
  v_payment_id uuid; v_parts jsonb; v_hash text; v_total numeric; v_part record;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'supplier_payments.record');
  if p_request_id is null or p_vendor_id is null or p_amount is null or p_amount <= 0
    or round(p_amount, 2) <> p_amount or p_paid_at is null or p_method is null
    or length(coalesce(p_reference, '')) > 200 or length(coalesce(p_notes, '')) > 2000 then
    raise exception 'INVALID_SUPPLIER_PAYMENT' using errcode = '22023'; end if;
  perform shop_private.assert_period_is_open(p_shop_id, p_paid_at);
  if not exists (select 1 from public.vendors where id = p_vendor_id
    and shop_id = p_shop_id) then raise exception 'VENDOR_NOT_FOUND'; end if;
  v_parts := shop_private.normalized_payment_parts(p_allocations, 'vendor_invoice_id');
  select sum((value ->> 'amount')::numeric) into v_total from jsonb_array_elements(v_parts);
  if v_total <> p_amount then raise exception 'UNALLOCATED_SUPPLIER_PAYMENT_REJECTED' using errcode = '23514'; end if;
  v_hash := md5(jsonb_build_object('vendorId', p_vendor_id, 'amount', p_amount,
    'paidAt', p_paid_at, 'method', p_method, 'reference', nullif(btrim(p_reference), ''),
    'notes', nullif(btrim(p_notes), ''), 'allocations', v_parts)::text);
  insert into public.supplier_operation_requests
    (shop_id, operation, request_id, actor_profile_id, payload_hash)
  values (p_shop_id, 'payment', p_request_id, v_profile_id, v_hash) on conflict do nothing;
  select * into v_request from public.supplier_operation_requests
  where shop_id = p_shop_id and operation = 'payment' and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_profile_id or v_request.payload_hash <> v_hash then
    raise exception 'SUPPLIER_REQUEST_CONFLICT' using errcode = '23505'; end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;
  perform invoice.id from public.vendor_invoices invoice
  join jsonb_array_elements(v_parts) part
    on (part ->> 'vendor_invoice_id')::uuid = invoice.id
  order by invoice.id for update of invoice;
  for v_part in select value from jsonb_array_elements(v_parts) loop
    if not exists (select 1 from public.vendor_invoices invoice
      where invoice.id = (v_part.value ->> 'vendor_invoice_id')::uuid
        and invoice.shop_id = p_shop_id and invoice.vendor_id = p_vendor_id
        and invoice.status = 'posted') then
      raise exception 'SUPPLIER_PAYMENT_PURCHASE_NOT_ELIGIBLE' using errcode = '23514'; end if;
    if (v_part.value ->> 'amount')::numeric
      > shop_private.purchase_payable((v_part.value ->> 'vendor_invoice_id')::uuid) then
      raise exception 'SUPPLIER_PAYMENT_OVERPAYMENT_REJECTED' using errcode = '23514'; end if;
  end loop;
  insert into public.payments (shop_id, payment_direction, vendor_invoice_id, vendor_id,
    amount, method, status, reference, paid_at, created_by_profile_id, notes, supplier_kind)
  values (p_shop_id, 'out', case when jsonb_array_length(v_parts) = 1
      then (v_parts -> 0 ->> 'vendor_invoice_id')::uuid else null end,
    p_vendor_id, p_amount, p_method, 'completed', nullif(btrim(p_reference), ''),
    p_paid_at, v_profile_id, nullif(btrim(p_notes), ''), 'payment')
  returning id into v_payment_id;
  insert into public.supplier_payment_allocations (shop_id, payment_id, vendor_invoice_id, amount)
  select p_shop_id, v_payment_id, (value ->> 'vendor_invoice_id')::uuid,
    (value ->> 'amount')::numeric from jsonb_array_elements(v_parts);
  update public.supplier_operation_requests set result_id = v_payment_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'payment' and request_id = p_request_id;
  return v_payment_id;
end;
$$;

create function shop_private.reverse_supplier_payment(
  p_request_id uuid, p_shop_id uuid, p_original_payment_id uuid,
  p_effective_at timestamptz, p_reason text, p_reference text, p_allocations jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile_id uuid; v_request public.supplier_operation_requests%rowtype;
  v_original public.payments%rowtype; v_parts jsonb; v_hash text;
  v_result_id uuid := gen_random_uuid(); v_part record;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'supplier_payments.reverse');
  if p_request_id is null or p_original_payment_id is null or p_effective_at is null
    or length(btrim(coalesce(p_reason, ''))) < 2 or length(p_reason) > 1000
    or length(coalesce(p_reference, '')) > 200 then
    raise exception 'INVALID_SUPPLIER_PAYMENT_REVERSAL' using errcode = '22023'; end if;
  perform shop_private.assert_period_is_open(p_shop_id, p_effective_at);
  v_parts := shop_private.normalized_payment_parts(p_allocations, 'allocation_id');
  v_hash := md5(jsonb_build_object('originalPaymentId', p_original_payment_id,
    'effectiveAt', p_effective_at, 'reason', btrim(p_reason),
    'reference', nullif(btrim(p_reference), ''), 'allocations', v_parts)::text);
  insert into public.supplier_operation_requests
    (shop_id, operation, request_id, actor_profile_id, payload_hash)
  values (p_shop_id, 'payment_reversal', p_request_id, v_profile_id, v_hash) on conflict do nothing;
  select * into v_request from public.supplier_operation_requests
  where shop_id = p_shop_id and operation = 'payment_reversal'
    and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_profile_id or v_request.payload_hash <> v_hash then
    raise exception 'SUPPLIER_REQUEST_CONFLICT' using errcode = '23505'; end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;
  select * into v_original from public.payments where id = p_original_payment_id
    and shop_id = p_shop_id and supplier_kind = 'payment' and status = 'completed' for update;
  if not found then raise exception 'SUPPLIER_PAYMENT_NOT_FOUND'; end if;
  perform allocation.id from public.supplier_payment_allocations allocation
  join jsonb_array_elements(v_parts) part on (part ->> 'allocation_id')::uuid = allocation.id
  order by allocation.id for update of allocation;
  for v_part in select value from jsonb_array_elements(v_parts) loop
    if not exists (select 1 from public.supplier_payment_allocations allocation
      where allocation.id = (v_part.value ->> 'allocation_id')::uuid
        and allocation.shop_id = p_shop_id and allocation.payment_id = p_original_payment_id) then
      raise exception 'SUPPLIER_PAYMENT_ALLOCATION_NOT_FOUND'; end if;
    if (v_part.value ->> 'amount')::numeric
      > shop_private.supplier_allocation_remaining((v_part.value ->> 'allocation_id')::uuid) then
      raise exception 'SUPPLIER_PAYMENT_REVERSAL_EXCEEDS_EFFECTIVE_AMOUNT' using errcode = '23514'; end if;
  end loop;
  insert into public.supplier_payment_reversals (shop_id, reversal_group_id,
    original_payment_id, original_allocation_id, amount, effective_at,
    reason, reference, created_by_profile_id)
  select p_shop_id, v_result_id, p_original_payment_id,
    (value ->> 'allocation_id')::uuid, (value ->> 'amount')::numeric,
    p_effective_at, btrim(p_reason), nullif(btrim(p_reference), ''), v_profile_id
  from jsonb_array_elements(v_parts);
  update public.supplier_operation_requests set result_id = v_result_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'payment_reversal' and request_id = p_request_id;
  return v_result_id;
end;
$$;

create function shop_private.record_supplier_credit(
  p_request_id uuid, p_shop_id uuid, p_vendor_id uuid, p_purchase_id uuid,
  p_amount numeric, p_effective_at timestamptz, p_reason text, p_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile_id uuid; v_request public.supplier_operation_requests%rowtype;
  v_invoice public.vendor_invoices%rowtype; v_credit_id uuid; v_hash text;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'supplier_credits.manage');
  if p_request_id is null or p_vendor_id is null or p_purchase_id is null
    or p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount
    or p_effective_at is null or length(btrim(coalesce(p_reason, ''))) < 2
    or length(p_reason) > 1000 or length(coalesce(p_reference, '')) > 200 then
    raise exception 'INVALID_SUPPLIER_CREDIT' using errcode = '22023'; end if;
  perform shop_private.assert_period_is_open(p_shop_id, p_effective_at);
  v_hash := md5(jsonb_build_object('vendorId', p_vendor_id, 'purchaseId', p_purchase_id,
    'amount', p_amount, 'effectiveAt', p_effective_at, 'reason', btrim(p_reason),
    'reference', nullif(btrim(p_reference), ''))::text);
  insert into public.supplier_operation_requests
    (shop_id, operation, request_id, actor_profile_id, payload_hash)
  values (p_shop_id, 'credit', p_request_id, v_profile_id, v_hash) on conflict do nothing;
  select * into v_request from public.supplier_operation_requests
  where shop_id = p_shop_id and operation = 'credit' and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_profile_id or v_request.payload_hash <> v_hash then
    raise exception 'SUPPLIER_REQUEST_CONFLICT' using errcode = '23505'; end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;
  select * into v_invoice from public.vendor_invoices where id = p_purchase_id
    and shop_id = p_shop_id and vendor_id = p_vendor_id and status = 'posted' for update;
  if not found then raise exception 'SUPPLIER_CREDIT_PURCHASE_NOT_ELIGIBLE'; end if;
  if p_amount > shop_private.purchase_payable(p_purchase_id) then
    raise exception 'SUPPLIER_CREDIT_EXCEEDS_PAYABLE' using errcode = '23514'; end if;
  insert into public.supplier_credits (shop_id, vendor_id, vendor_invoice_id,
    vendor_name_snapshot, amount, effective_at, reason, reference, created_by_profile_id)
  values (p_shop_id, p_vendor_id, p_purchase_id, v_invoice.vendor_name_snapshot,
    p_amount, p_effective_at, btrim(p_reason), nullif(btrim(p_reference), ''), v_profile_id)
  returning id into v_credit_id;
  update public.supplier_operation_requests set result_id = v_credit_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'credit' and request_id = p_request_id;
  return v_credit_id;
end;
$$;

create function shop_private.record_purchase_return(
  p_request_id uuid, p_shop_id uuid, p_purchase_id uuid,
  p_returned_at timestamptz, p_reason text, p_reference text, p_items jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
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
      or item.quantity > 1000000 or round(item.quantity, 3) <> item.quantity) then
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
      v_profile_id, round(v_line.unit_cost, 2));
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

-- A purchase with settlement/credit history cannot be voided. Physical partial
-- returns use the return command; a clean, wholly available purchase retains
-- the original full-void behavior.
create or replace function shop_private.void_supplier_purchase(p_shop_id uuid, p_purchase_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_profile_id uuid; v_purchase public.vendor_invoices%rowtype; v_batch record;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'vendor_invoices.manage');
  perform shop_private.assert_purchase_entitlement(p_shop_id);
  select * into v_purchase from public.vendor_invoices
  where id = p_purchase_id and shop_id = p_shop_id for update;
  if not found then raise exception 'PURCHASE_NOT_FOUND'; end if;
  if v_purchase.status = 'void' then return; end if;
  if v_purchase.status <> 'posted' then raise exception 'PURCHASE_NOT_POSTED'; end if;
  perform shop_private.assert_period_is_open(p_shop_id, now());
  if exists (select 1 from public.supplier_payment_allocations where vendor_invoice_id = p_purchase_id)
    or exists (select 1 from public.supplier_credits where vendor_invoice_id = p_purchase_id)
    or exists (select 1 from public.purchase_returns where vendor_invoice_id = p_purchase_id) then
    raise exception 'PURCHASE_WITH_PAYABLE_HISTORY_CANNOT_BE_VOIDED' using errcode = '23514'; end if;
  for v_batch in select batch.* from public.inventory_batches batch
    where batch.shop_id = p_shop_id and batch.source_type = 'vendor_invoice'
      and batch.source_id = p_purchase_id order by batch.product_id, batch.id for update
  loop
    if v_batch.remaining_quantity <> v_batch.quantity_received then
      raise exception 'PURCHASE_STOCK_ALREADY_USED' using errcode = '55000'; end if;
    update public.inventory_batches set remaining_quantity = 0 where id = v_batch.id;
    insert into public.inventory_movements (shop_id, product_id, batch_id,
      quantity_change, movement_type, reference_id, created_by_profile_id, unit_cost_snapshot)
    values (p_shop_id, v_batch.product_id, v_batch.id, -v_batch.quantity_received,
      'adjustment', p_purchase_id, v_profile_id, round(v_batch.unit_cost, 2));
  end loop;
  update public.vendor_invoices set status = 'void', updated_at = now()
  where id = p_purchase_id and shop_id = p_shop_id and status = 'posted';
  if not found then raise exception 'PURCHASE_VOID_FAILED'; end if;
end;
$$;

create function public.supplier_access(p_shop_id uuid)
returns table (can_view boolean, can_manage_suppliers boolean, can_manage_purchases boolean,
  can_record_payment boolean, can_reverse_payment boolean,
  can_record_credit boolean, can_return_stock boolean)
language sql stable security definer set search_path = '' as $$
  select * from shop_private.supplier_access(p_shop_id);
$$;
create function public.save_vendor(p_shop_id uuid, p_vendor_id uuid, p_name text,
  p_contact_name text, p_phone text, p_email text, p_address text,
  p_tax_number text, p_notes text) returns uuid
language sql security definer set search_path = '' as $$
  select shop_private.save_vendor(p_shop_id, p_vendor_id, p_name, p_contact_name,
    p_phone, p_email, p_address, p_tax_number, p_notes);
$$;
create function public.archive_vendor(p_shop_id uuid, p_vendor_id uuid)
returns void language sql security definer set search_path = '' as $$
  select shop_private.archive_vendor(p_shop_id, p_vendor_id);
$$;
create function public.list_vendors(p_shop_id uuid, p_search text default null,
  p_is_active boolean default true, p_page integer default 1, p_page_size integer default 20)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.list_vendors(p_shop_id, p_search, p_is_active, p_page, p_page_size);
$$;
create function public.list_purchases(p_shop_id uuid, p_search text default null,
  p_vendor_id uuid default null, p_status public.vendor_invoice_status default null,
  p_settlement text default null, p_from date default null, p_to date default null,
  p_page integer default 1, p_page_size integer default 20)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.list_purchases(p_shop_id, p_search, p_vendor_id, p_status,
    p_settlement, p_from, p_to, p_page, p_page_size);
$$;
create function public.get_purchase(p_shop_id uuid, p_purchase_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.get_purchase(p_shop_id, p_purchase_id);
$$;
create function public.record_supplier_payment(p_request_id uuid, p_shop_id uuid,
  p_vendor_id uuid, p_amount numeric, p_paid_at timestamptz,
  p_method public.payment_method, p_reference text, p_notes text, p_allocations jsonb)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.record_supplier_payment(p_request_id, p_shop_id, p_vendor_id,
    p_amount, p_paid_at, p_method, p_reference, p_notes, p_allocations);
$$;
create function public.reverse_supplier_payment(p_request_id uuid, p_shop_id uuid,
  p_original_payment_id uuid, p_effective_at timestamptz, p_reason text,
  p_reference text, p_allocations jsonb)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.reverse_supplier_payment(p_request_id, p_shop_id,
    p_original_payment_id, p_effective_at, p_reason, p_reference, p_allocations);
$$;
create function public.record_supplier_credit(p_request_id uuid, p_shop_id uuid,
  p_vendor_id uuid, p_purchase_id uuid, p_amount numeric, p_effective_at timestamptz,
  p_reason text, p_reference text)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.record_supplier_credit(p_request_id, p_shop_id, p_vendor_id,
    p_purchase_id, p_amount, p_effective_at, p_reason, p_reference);
$$;
create function public.record_purchase_return(p_request_id uuid, p_shop_id uuid,
  p_purchase_id uuid, p_returned_at timestamptz, p_reason text,
  p_reference text, p_items jsonb)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.record_purchase_return(p_request_id, p_shop_id, p_purchase_id,
    p_returned_at, p_reason, p_reference, p_items);
$$;

revoke all on function shop_private.supplier_access(uuid),
  shop_private.assert_supplier_read_access(uuid), shop_private.purchase_payable(uuid),
  shop_private.supplier_allocation_remaining(uuid),
  shop_private.save_vendor(uuid, uuid, text, text, text, text, text, text, text),
  shop_private.archive_vendor(uuid, uuid),
  shop_private.list_vendors(uuid, text, boolean, integer, integer),
  shop_private.list_purchases(uuid, text, uuid, public.vendor_invoice_status, text, date, date, integer, integer),
  shop_private.get_purchase(uuid, uuid),
  shop_private.record_supplier_payment(uuid, uuid, uuid, numeric, timestamptz, public.payment_method, text, text, jsonb),
  shop_private.reverse_supplier_payment(uuid, uuid, uuid, timestamptz, text, text, jsonb),
  shop_private.record_supplier_credit(uuid, uuid, uuid, uuid, numeric, timestamptz, text, text),
  shop_private.record_purchase_return(uuid, uuid, uuid, timestamptz, text, text, jsonb)
from public, anon, authenticated, service_role;

revoke all on function public.supplier_access(uuid),
  public.save_vendor(uuid, uuid, text, text, text, text, text, text, text),
  public.archive_vendor(uuid, uuid),
  public.list_vendors(uuid, text, boolean, integer, integer),
  public.list_purchases(uuid, text, uuid, public.vendor_invoice_status, text, date, date, integer, integer),
  public.get_purchase(uuid, uuid),
  public.record_supplier_payment(uuid, uuid, uuid, numeric, timestamptz, public.payment_method, text, text, jsonb),
  public.reverse_supplier_payment(uuid, uuid, uuid, timestamptz, text, text, jsonb),
  public.record_supplier_credit(uuid, uuid, uuid, uuid, numeric, timestamptz, text, text),
  public.record_purchase_return(uuid, uuid, uuid, timestamptz, text, text, jsonb)
from public, anon, authenticated;
grant execute on function public.supplier_access(uuid),
  public.save_vendor(uuid, uuid, text, text, text, text, text, text, text),
  public.archive_vendor(uuid, uuid),
  public.list_vendors(uuid, text, boolean, integer, integer),
  public.list_purchases(uuid, text, uuid, public.vendor_invoice_status, text, date, date, integer, integer),
  public.get_purchase(uuid, uuid),
  public.record_supplier_payment(uuid, uuid, uuid, numeric, timestamptz, public.payment_method, text, text, jsonb),
  public.reverse_supplier_payment(uuid, uuid, uuid, timestamptz, text, text, jsonb),
  public.record_supplier_credit(uuid, uuid, uuid, uuid, numeric, timestamptz, text, text),
  public.record_purchase_return(uuid, uuid, uuid, timestamptz, text, text, jsonb)
to authenticated;

create policy supplier_payment_allocation_read on public.supplier_payment_allocations
for select to authenticated using (shop_private.has_permission(shop_id, 'vendor_invoices.view'));
create policy supplier_payment_reversal_read on public.supplier_payment_reversals
for select to authenticated using (shop_private.has_permission(shop_id, 'vendor_invoices.view'));
create policy purchase_return_read on public.purchase_returns
for select to authenticated using (shop_private.has_permission(shop_id, 'vendor_invoices.view'));
create policy purchase_return_item_read on public.purchase_return_items
for select to authenticated using (shop_private.has_permission(shop_id, 'vendor_invoices.view'));
create policy supplier_credit_read on public.supplier_credits
for select to authenticated using (shop_private.has_permission(shop_id, 'vendor_invoices.view'));
grant select on table public.supplier_payment_allocations,
  public.supplier_payment_reversals, public.purchase_returns,
  public.purchase_return_items, public.supplier_credits to authenticated;
revoke insert, update, delete, truncate on table public.payments,
  public.supplier_payment_allocations, public.supplier_payment_reversals,
  public.purchase_returns, public.purchase_return_items, public.supplier_credits,
  public.supplier_operation_requests from anon, authenticated;

notify pgrst, 'reload schema';
