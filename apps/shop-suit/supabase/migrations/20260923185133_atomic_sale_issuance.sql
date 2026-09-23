-- SS-SALE-001: supported draft and atomic sale issuance. The historical
-- issue_invoice_and_deduct_inventory function remains revoked and unused.

alter table public.invoices
  alter column invoice_number drop not null,
  add column issued_by_profile_id uuid references public.profiles (id) on delete restrict,
  add column client_phone_snapshot text,
  add column client_email_snapshot text,
  add column client_address_snapshot text;

alter table public.invoices
  add constraint invoices_id_shop_unique unique (id, shop_id),
  add constraint invoices_issued_shape_check check (
    (status = 'draft'::public.invoice_status and issued_at is null)
    or status <> 'draft'::public.invoice_status
  ) not valid;
alter table public.invoices validate constraint invoices_issued_shape_check;

alter table public.services
  add constraint services_id_shop_unique unique (id, shop_id);

alter table public.invoice_items
  add column shop_id uuid,
  add column service_id uuid,
  add column line_order integer,
  add column product_sku_snapshot text,
  add column product_barcode_snapshot text,
  add column discount_type_snapshot text,
  add column discount_value_snapshot numeric(12, 2);

update public.invoice_items item
set shop_id = invoice.shop_id
from public.invoices invoice
where invoice.id = item.invoice_id;

alter table public.invoice_items
  alter column shop_id set not null,
  add constraint invoice_items_invoice_shop_fk
    foreign key (invoice_id, shop_id)
    references public.invoices (id, shop_id) on delete cascade,
  add constraint invoice_items_product_shop_fk
    foreign key (product_id, shop_id)
    references public.products (id, shop_id) on delete restrict,
  add constraint invoice_items_service_shop_fk
    foreign key (service_id, shop_id)
    references public.services (id, shop_id) on delete restrict,
  add constraint invoice_items_supported_values_check check (
    quantity > 0 and quantity <= 1000000
    and round(quantity, 3) = quantity
    and unit_price >= 0 and discount_amount >= 0 and total_amount >= 0
  ) not valid;
alter table public.invoice_items
  validate constraint invoice_items_supported_values_check;

alter table public.inventory_movements
  add column invoice_item_id uuid references public.invoice_items (id) on delete restrict;

create table public.sale_number_counters (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  next_number bigint not null check (next_number > 0),
  updated_at timestamptz not null default now()
);
alter table public.sale_number_counters enable row level security;

create table public.sale_requests (
  shop_id uuid not null references public.shops (id) on delete cascade,
  operation text not null check (operation in ('save_draft', 'issue')),
  request_id uuid not null,
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  payload_hash text not null,
  invoice_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (shop_id, operation, request_id),
  foreign key (invoice_id, shop_id)
    references public.invoices (id, shop_id) on delete restrict
);
alter table public.sale_requests enable row level security;

create index invoices_shop_sale_list_idx
  on public.invoices (shop_id, created_at desc, id desc);
create index invoices_shop_status_date_idx
  on public.invoices (shop_id, status, created_at desc, id desc);
create index invoice_items_invoice_order_idx
  on public.invoice_items (invoice_id, line_order, id);
create index inventory_movements_sale_trace_idx
  on public.inventory_movements (shop_id, reference_id, invoice_item_id, created_at);

revoke all on table public.sale_number_counters, public.sale_requests
  from public, anon, authenticated;
grant all on table public.sale_number_counters, public.sale_requests to service_role;

-- Existing owners satisfy every permission through shop_private.has_permission;
-- delegated staff receive only the explicit capabilities assigned to their role.
insert into public.permissions (portal_id, key, description)
select portal.id, permission.key, permission.description
from public.portals portal
cross join (values
  ('sales.view', 'View sales and inventory traceability'),
  ('sales.manage', 'Create and edit sale drafts'),
  ('sales.issue', 'Issue sales and deduct product inventory')
) as permission(key, description)
where portal.key = 'shop-crm'
on conflict (portal_id, key) do update
set description = excluded.description;

create function shop_private.sale_access(p_shop_id uuid)
returns table (can_view boolean, can_manage boolean, can_issue boolean)
language sql stable security definer set search_path = '' as $$
  select
    shop_private.has_permission(p_shop_id, 'sales.view'),
    shop_private.has_permission(p_shop_id, 'sales.manage'),
    shop_private.has_permission(p_shop_id, 'sales.issue')
  where shop_private.is_member(p_shop_id);
$$;

create function shop_private.assert_sale_read_access(p_shop_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not coalesce((select access.can_view from shop_private.sale_access(p_shop_id) access), false) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
end;
$$;

-- Forward declarations let the public API signatures be established together;
-- each body is replaced below before the migration commits.
create function shop_private.sale_catalog(p_shop_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin raise exception 'SALE_MIGRATION_INCOMPLETE'; end;
$$;
create function shop_private.save_sale_draft(
  p_request_id uuid, p_shop_id uuid, p_invoice_id uuid,
  p_customer_id uuid, p_notes text, p_lines jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
begin raise exception 'SALE_MIGRATION_INCOMPLETE'; end;
$$;
create function shop_private.issue_sale(
  p_request_id uuid, p_shop_id uuid, p_invoice_id uuid
)
returns uuid language plpgsql security definer set search_path = '' as $$
begin raise exception 'SALE_MIGRATION_INCOMPLETE'; end;
$$;
create function shop_private.list_sales(
  p_shop_id uuid, p_search text, p_status public.invoice_status,
  p_from date, p_to date, p_page integer, p_page_size integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin raise exception 'SALE_MIGRATION_INCOMPLETE'; end;
$$;
create function shop_private.get_sale(p_shop_id uuid, p_invoice_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin raise exception 'SALE_MIGRATION_INCOMPLETE'; end;
$$;

-- Public wrappers are the only browser-callable sale surface. They retain the
-- caller's JWT settings while the private implementations own the transaction.
create function public.sale_access(p_shop_id uuid)
returns table (can_view boolean, can_manage boolean, can_issue boolean)
language sql stable security definer set search_path = '' as $$
  select * from shop_private.sale_access(p_shop_id);
$$;

create function public.sale_catalog(p_shop_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.sale_catalog(p_shop_id);
$$;

create function public.save_sale_draft(
  p_request_id uuid, p_shop_id uuid, p_invoice_id uuid,
  p_customer_id uuid, p_notes text, p_lines jsonb
)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.save_sale_draft(
    p_request_id, p_shop_id, p_invoice_id, p_customer_id, p_notes, p_lines
  );
$$;

create function public.issue_sale(
  p_request_id uuid, p_shop_id uuid, p_invoice_id uuid
)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.issue_sale(p_request_id, p_shop_id, p_invoice_id);
$$;

create function public.list_sales(
  p_shop_id uuid,
  p_search text default null,
  p_status public.invoice_status default null,
  p_from date default null,
  p_to date default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.list_sales(
    p_shop_id, p_search, p_status, p_from, p_to, p_page, p_page_size
  );
$$;

create function public.get_sale(p_shop_id uuid, p_invoice_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.get_sale(p_shop_id, p_invoice_id);
$$;

revoke all on function
  shop_private.sale_access(uuid),
  shop_private.assert_sale_read_access(uuid),
  shop_private.sale_catalog(uuid),
  shop_private.save_sale_draft(uuid, uuid, uuid, uuid, text, jsonb),
  shop_private.issue_sale(uuid, uuid, uuid),
  shop_private.list_sales(uuid, text, public.invoice_status, date, date, integer, integer),
  shop_private.get_sale(uuid, uuid)
from public, anon, authenticated, service_role;

revoke all on function
  public.sale_access(uuid),
  public.sale_catalog(uuid),
  public.save_sale_draft(uuid, uuid, uuid, uuid, text, jsonb),
  public.issue_sale(uuid, uuid, uuid),
  public.list_sales(uuid, text, public.invoice_status, date, date, integer, integer),
  public.get_sale(uuid, uuid)
from public, anon, authenticated;
grant execute on function
  public.sale_access(uuid),
  public.sale_catalog(uuid),
  public.save_sale_draft(uuid, uuid, uuid, uuid, text, jsonb),
  public.issue_sale(uuid, uuid, uuid),
  public.list_sales(uuid, text, public.invoice_status, date, date, integer, integer),
  public.get_sale(uuid, uuid)
to authenticated;

-- Read access follows the new sale capability; direct document writes remain
-- unavailable even when legacy RLS policies still exist.
drop policy if exists invoice_permission_read on public.invoices;
create policy invoice_sale_read on public.invoices for select to authenticated
using (shop_private.has_permission(shop_id, 'sales.view'));
drop policy if exists invoice_item_permission_read on public.invoice_items;
create policy invoice_item_sale_read on public.invoice_items for select to authenticated
using (exists (
  select 1 from public.invoices invoice
  where invoice.id = invoice_items.invoice_id
    and shop_private.has_permission(invoice.shop_id, 'sales.view')
));
revoke insert, update, delete, truncate on table
  public.invoices, public.invoice_items, public.inventory_batches,
  public.inventory_movements, public.sale_number_counters, public.sale_requests
from anon, authenticated;

create function shop_private.prevent_issued_invoice_item_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_invoice_id uuid := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
begin
  if exists (
    select 1 from public.invoices invoice
    where invoice.id = v_invoice_id and invoice.status <> 'draft'
  ) then
    raise exception 'ISSUED_SALE_IMMUTABLE' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function shop_private.prevent_issued_invoice_item_mutation()
from public, anon, authenticated, service_role;

create function shop_private.prevent_issued_invoice_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status <> 'draft'::public.invoice_status then
    raise exception 'ISSUED_SALE_IMMUTABLE' using errcode = '23514';
  end if;
  return old;
end;
$$;
revoke all on function shop_private.prevent_issued_invoice_delete()
from public, anon, authenticated, service_role;

create trigger trg_prevent_issued_invoice_item_mutation
before update or delete on public.invoice_items
for each row execute function shop_private.prevent_issued_invoice_item_mutation();
create trigger trg_prevent_issued_invoice_delete
before delete on public.invoices
for each row execute function shop_private.prevent_issued_invoice_delete();

-- Keep the broken historical implementation as service-role compatibility
-- surface only. Supported callers cannot execute it.
revoke all on function public.issue_invoice_and_deduct_inventory(uuid, uuid)
from public, anon, authenticated;

notify pgrst, 'reload schema';

create or replace function shop_private.issue_sale(
  p_request_id uuid,
  p_shop_id uuid,
  p_invoice_id uuid
)
returns uuid language plpgsql security definer set search_path = '' as $$
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
      v_total := round(v_product.sale_price * v_line.quantity, 2);
      update public.invoice_items set
        item_name = v_product.name, unit_price = v_product.sale_price,
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

create or replace function shop_private.list_sales(
  p_shop_id uuid,
  p_search text default null,
  p_status public.invoice_status default null,
  p_from date default null,
  p_to date default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_search text := nullif(btrim(p_search), '');
  v_total bigint;
  v_items jsonb;
  v_access record;
begin
  perform shop_private.assert_sale_read_access(p_shop_id);
  select * into v_access from shop_private.sale_access(p_shop_id);
  if p_page is null or p_page < 1 or p_page_size is null
    or p_page_size < 1 or p_page_size > 100
    or (v_search is not null and length(v_search) > 160)
    or (p_status is not null and p_status not in ('draft', 'issued'))
    or (p_from is not null and p_to is not null and p_from > p_to) then
    raise exception 'INVALID_SALE_QUERY' using errcode = '22023';
  end if;
  select count(*) into v_total from public.invoices invoice
  where invoice.shop_id = p_shop_id
    and invoice.status in ('draft', 'issued')
    and (p_status is null or invoice.status = p_status)
    and (p_from is null or coalesce(invoice.issued_at, invoice.created_at)::date >= p_from)
    and (p_to is null or coalesce(invoice.issued_at, invoice.created_at)::date <= p_to)
    and (v_search is null or coalesce(invoice.invoice_number, '') ilike '%' || v_search || '%'
      or coalesce(invoice.client_name_snapshot, '') ilike '%' || v_search || '%'
      or coalesce(invoice.notes, '') ilike '%' || v_search || '%');

  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.sort_at desc, rows.id desc), '[]'::jsonb)
  into v_items from (
    select invoice.id, invoice.invoice_number, invoice.status,
      invoice.client_id, invoice.client_name_snapshot, invoice.total_amount,
      invoice.discount_amount, invoice.currency, invoice.created_at,
      invoice.updated_at, invoice.issued_at,
      coalesce(invoice.issued_at, invoice.created_at) as sort_at,
      (select count(*) from public.invoice_items item where item.invoice_id = invoice.id) as line_count
    from public.invoices invoice
    where invoice.shop_id = p_shop_id
      and invoice.status in ('draft', 'issued')
      and (p_status is null or invoice.status = p_status)
      and (p_from is null or coalesce(invoice.issued_at, invoice.created_at)::date >= p_from)
      and (p_to is null or coalesce(invoice.issued_at, invoice.created_at)::date <= p_to)
      and (v_search is null or coalesce(invoice.invoice_number, '') ilike '%' || v_search || '%'
        or coalesce(invoice.client_name_snapshot, '') ilike '%' || v_search || '%'
        or coalesce(invoice.notes, '') ilike '%' || v_search || '%')
    order by coalesce(invoice.issued_at, invoice.created_at) desc, invoice.id desc
    offset (p_page - 1) * p_page_size limit p_page_size
  ) rows;
  return jsonb_build_object(
    'items', v_items, 'total', v_total, 'page', p_page, 'pageSize', p_page_size,
    'canManage', v_access.can_manage, 'canIssue', v_access.can_issue
  );
end;
$$;

create or replace function shop_private.get_sale(p_shop_id uuid, p_invoice_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_access record;
begin
  perform shop_private.assert_sale_read_access(p_shop_id);
  select * into v_access from shop_private.sale_access(p_shop_id);
  select to_jsonb(invoice) || jsonb_build_object(
    'canManage', v_access.can_manage,
    'canIssue', v_access.can_issue,
    'lines', (select coalesce(jsonb_agg(to_jsonb(item) order by item.line_order, item.id), '[]'::jsonb)
      from public.invoice_items item where item.invoice_id = invoice.id),
    'movements', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', movement.id, 'productId', movement.product_id,
      'invoiceItemId', movement.invoice_item_id, 'batchId', movement.batch_id,
      'quantityChange', movement.quantity_change,
      'unitCostSnapshot', movement.unit_cost_snapshot,
      'createdAt', movement.created_at
    ) order by movement.created_at, movement.id), '[]'::jsonb)
      from public.inventory_movements movement
      where movement.shop_id = p_shop_id and movement.reference_id = invoice.id
        and movement.movement_type = 'out')
  ) into v_result
  from public.invoices invoice
  where invoice.id = p_invoice_id and invoice.shop_id = p_shop_id
    and invoice.status in ('draft', 'issued');
  return v_result;
end;
$$;

create or replace function shop_private.sale_catalog(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
        'barcode', product.barcode, 'unitPrice', product.sale_price,
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

create or replace function shop_private.save_sale_draft(
  p_request_id uuid,
  p_shop_id uuid,
  p_invoice_id uuid,
  p_customer_id uuid,
  p_notes text,
  p_lines jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
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
      or round(v_quantity, 3) <> v_quantity then
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
      v_total := round(v_product.sale_price * v_quantity, 2);
      insert into public.invoice_items (
        invoice_id, shop_id, line_order, item_type, item_name, quantity,
        unit_price, discount_amount, total_amount, product_id,
        product_sku_snapshot, product_barcode_snapshot,
        discount_type_snapshot, discount_value_snapshot
      ) values (
        v_invoice_id, p_shop_id, v_line.line_order, 'product', v_product.name,
        v_quantity, v_product.sale_price, 0, v_total, v_product.id,
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
