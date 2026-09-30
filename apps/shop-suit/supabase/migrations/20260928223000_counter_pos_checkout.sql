-- SS-POS-001: counter checkout context, bounded catalog search and atomic POS completion.
-- Existing sale/payment commands remain the only owners of totals, FIFO and payment records.

create table public.pos_sale_contexts (
  invoice_id uuid primary key,
  shop_id uuid not null,
  location_id uuid not null,
  staff_membership_id uuid not null,
  appointment_id uuid,
  customer_name_snapshot text,
  staff_name_snapshot text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (invoice_id, shop_id, location_id)
    references public.invoices (id, shop_id, location_id) on delete restrict,
  foreign key (staff_membership_id, shop_id)
    references public.shop_memberships (id, shop_id) on delete restrict,
  foreign key (appointment_id, shop_id, location_id)
    references public.appointments (id, shop_id, location_id) on delete restrict
);

create table public.pos_sale_requests (
  request_id uuid primary key,
  shop_id uuid not null references public.shops (id) on delete restrict,
  operation text not null check (operation in ('save', 'checkout')),
  payload_hash text not null,
  invoice_id uuid,
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (invoice_id, shop_id) references public.invoices (id, shop_id) on delete restrict
);

alter table public.pos_sale_contexts enable row level security;
alter table public.pos_sale_requests enable row level security;
revoke all on table public.pos_sale_contexts, public.pos_sale_requests from public, anon, authenticated;
grant all on table public.pos_sale_contexts, public.pos_sale_requests to service_role;

-- Location wrappers predate location-scoped FIFO selection. Refuse any sale
-- movement whose batch differs from the linked sale location, so a retry can
-- never consume another counter's stock silently.
create function shop_private.enforce_sale_inventory_location()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.movement_type = 'out' and new.reference_id is not null and exists (
    select 1 from public.invoices invoice join public.inventory_batches batch
      on batch.id = new.batch_id and batch.shop_id = new.shop_id
    where invoice.id = new.reference_id and invoice.shop_id = new.shop_id
      and invoice.location_id <> batch.location_id
  ) then raise exception 'CROSS_LOCATION_STOCK' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function shop_private.enforce_sale_inventory_location()
from public, anon, authenticated, service_role;
create trigger trg_pos_sale_inventory_location
before insert on public.inventory_movements for each row
execute function shop_private.enforce_sale_inventory_location();

create function shop_private.pos_catalog_search(
  p_shop_id uuid, p_location_id uuid, p_search text default null,
  p_item_type text default null, p_barcode text default null,
  p_page integer default 1, p_page_size integer default 30
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_search text := nullif(btrim(p_search), ''); v_barcode text := nullif(btrim(p_barcode), '');
  v_mode public.business_mode; v_items jsonb; v_total bigint;
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  if not coalesce((select can_manage from shop_private.sale_access(p_shop_id)), false) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_item_type is not null and p_item_type not in ('product', 'service')
    or p_page is null or p_page < 1 or p_page_size is null or p_page_size < 1 or p_page_size > 50
    or length(coalesce(v_search, '')) > 160 or length(coalesce(v_barcode, '')) > 80 then
    raise exception 'INVALID_POS_CATALOG_QUERY' using errcode = '22023';
  end if;
  select business_mode into v_mode from public.shops where id = p_shop_id;
  with catalog as (
    select product.id, 'product'::text item_type, product.name, product.sku,
      product.barcode, product.sale_price unit_price, 0::numeric discount,
      coalesce((select sum(batch.remaining_quantity) from public.inventory_batches batch
        where batch.shop_id = p_shop_id and batch.location_id = p_location_id
          and batch.product_id = product.id), 0) stock
    from public.products product
    where product.shop_id = p_shop_id and product.is_active and v_mode in ('product', 'mixed')
      and (p_item_type is null or p_item_type = 'product')
      and (v_barcode is null or product.barcode = v_barcode)
      and (v_search is null or product.name ilike '%' || v_search || '%'
        or coalesce(product.sku, '') ilike '%' || v_search || '%'
        or coalesce(product.barcode, '') ilike '%' || v_search || '%')
    union all
    select service.id, 'service', service.name, null, null, service.base_sale_price,
      case service.default_discount_type when 'percent'
        then round(service.base_sale_price * service.default_discount_value / 100, 2)
        else service.default_discount_value end, null::numeric
    from public.services service
    where service.shop_id = p_shop_id and service.is_active and v_mode in ('service', 'mixed')
      and v_barcode is null and (p_item_type is null or p_item_type = 'service')
      and (v_search is null or service.name ilike '%' || v_search || '%')
  ), counted as (select *, count(*) over () total_count from catalog), paged as (
    select * from counted order by lower(name), id offset (p_page - 1) * p_page_size limit p_page_size
  )
  select coalesce(max(total_count), 0), coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'itemType', item_type, 'name', name, 'sku', sku, 'barcode', barcode,
    'unitPrice', unit_price, 'discount', discount, 'stock', stock
  ) order by lower(name), id), '[]'::jsonb) into v_total, v_items from paged;
  return jsonb_build_object('items', v_items, 'total', v_total, 'page', p_page,
    'pageSize', p_page_size, 'businessMode', v_mode,
    'ambiguousBarcode', v_barcode is not null and v_total > 1);
end;
$$;

create function shop_private.pos_checkout_context(
  p_shop_id uuid, p_location_id uuid, p_customer_search text default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_search text := nullif(btrim(p_customer_search), '');
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  if not coalesce((select can_manage from shop_private.sale_access(p_shop_id)), false) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if length(coalesce(v_search, '')) > 160 then raise exception 'INVALID_POS_CONTEXT_QUERY'; end if;
  return jsonb_build_object(
    'staff', (select coalesce(jsonb_agg(jsonb_build_object('id', member.id,
      'name', coalesce(profile.display_name, profile.email_snapshot))
      order by coalesce(profile.display_name, profile.email_snapshot)), '[]'::jsonb)
      from public.shop_memberships member join public.profiles profile on profile.id = member.profile_id
      where member.shop_id = p_shop_id and member.status = 'active' and member.removed_at is null
        and profile.status = 'active' and (member.role = 'owner' or exists (select 1
          from public.membership_location_assignments assignment where assignment.membership_id = member.id
            and assignment.shop_id = p_shop_id and assignment.location_id = p_location_id))),
    'appointments', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', appointment.id, 'staffId', appointment.assigned_membership_id,
      'customerId', appointment.client_id,
      'customerName', coalesce(appointment.customer_name_snapshot, appointment.walk_in_name),
      'startsAt', appointment.starts_at, 'status', appointment.status,
      'service', jsonb_build_object('id', service.id, 'itemType', 'service',
        'name', service.name, 'unitPrice', service.base_sale_price,
        'sku', null, 'barcode', null, 'stock', null,
        'discount', case service.default_discount_type when 'percent'
          then round(service.base_sale_price * service.default_discount_value / 100, 2)
          else service.default_discount_value end)
    ) order by appointment.starts_at, appointment.id), '[]'::jsonb)
      from public.appointments appointment join public.services service on service.id = appointment.service_id
      where appointment.shop_id = p_shop_id and appointment.location_id = p_location_id
        and shop_private.has_permission(p_shop_id, 'appointments.view')
        and appointment.sale_id is null and appointment.status in ('booked','arrived','waiting','in_service','completed')
        and appointment.starts_at >= date_trunc('day', now()) - interval '1 day'
        and appointment.starts_at < date_trunc('day', now()) + interval '2 days'),
    'customers', (select coalesce(jsonb_agg(jsonb_build_object('id', customer.id,
      'name', customer.name, 'phone', customer.phone) order by customer.name, customer.id), '[]'::jsonb)
      from (select client.id, client.name, client.phone from public.clients client
        where client.shop_id = p_shop_id and client.is_active
          and v_search is not null and (client.name ilike '%' || v_search || '%'
            or coalesce(client.phone, '') ilike '%' || v_search || '%')
        order by lower(client.name), client.id limit 20) customer)
  );
end;
$$;

create function shop_private.save_pos_sale_draft(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid,
  p_staff_membership_id uuid, p_appointment_id uuid, p_customer_id uuid,
  p_notes text, p_lines jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_request public.pos_sale_requests%rowtype;
  v_invoice uuid; v_staff_name text; v_customer_name text;
begin
  v_actor := shop_private.assert_shop_write_access(p_shop_id, 'sales.manage');
  perform shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if p_request_id is null or p_staff_membership_id is null then raise exception 'INVALID_POS_CONTEXT'; end if;
  select coalesce(profile.display_name, profile.email_snapshot) into v_staff_name
  from public.shop_memberships member join public.profiles profile on profile.id = member.profile_id
  where member.id = p_staff_membership_id and member.shop_id = p_shop_id
    and member.status = 'active' and member.removed_at is null and profile.status = 'active'
    and (member.role = 'owner' or exists (select 1 from public.membership_location_assignments assignment
      where assignment.membership_id = member.id and assignment.location_id = p_location_id));
  if v_staff_name is null then raise exception 'INVALID_POS_STAFF' using errcode = '23514'; end if;
  if p_customer_id is not null then select name into v_customer_name from public.clients
    where id = p_customer_id and shop_id = p_shop_id and is_active; end if;
  if p_customer_id is not null and v_customer_name is null then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if p_appointment_id is not null and not shop_private.has_permission(p_shop_id, 'appointments.manage') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_appointment_id is not null and not exists (select 1 from public.appointments appointment
    where appointment.id = p_appointment_id and appointment.shop_id = p_shop_id
      and appointment.location_id = p_location_id and appointment.assigned_membership_id = p_staff_membership_id
      and appointment.client_id is not distinct from p_customer_id
      and (appointment.sale_id is null or appointment.sale_id = p_invoice_id)
      and appointment.status in ('booked','arrived','waiting','in_service','completed')) then
    raise exception 'INVALID_POS_APPOINTMENT' using errcode = '23514';
  end if;
  v_hash := md5(jsonb_build_object('location', p_location_id, 'invoice', p_invoice_id,
    'staff', p_staff_membership_id, 'appointment', p_appointment_id, 'customer', p_customer_id,
    'notes', nullif(btrim(p_notes), ''), 'lines', p_lines)::text);
  insert into public.pos_sale_requests(request_id, shop_id, operation, payload_hash, actor_profile_id)
    values (p_request_id, p_shop_id, 'save', v_hash, v_actor) on conflict do nothing;
  select * into v_request from public.pos_sale_requests where request_id = p_request_id for update;
  if v_request.shop_id <> p_shop_id or v_request.operation <> 'save' or v_request.payload_hash <> v_hash
    or v_request.actor_profile_id <> v_actor then raise exception 'POS_REQUEST_CONFLICT' using errcode = '23505'; end if;
  if v_request.completed_at is not null then return v_request.invoice_id; end if;
  perform set_config('shop.location_id', p_location_id::text, true);
  v_invoice := shop_private.save_location_sale_draft(p_request_id, p_shop_id, p_location_id,
    p_invoice_id, p_customer_id, null, p_notes, p_lines);
  insert into public.pos_sale_contexts(invoice_id, shop_id, location_id, staff_membership_id,
    appointment_id, customer_name_snapshot, staff_name_snapshot)
  values (v_invoice, p_shop_id, p_location_id, p_staff_membership_id, p_appointment_id,
    v_customer_name, v_staff_name)
  on conflict (invoice_id) do update set staff_membership_id = excluded.staff_membership_id,
    appointment_id = excluded.appointment_id, customer_name_snapshot = excluded.customer_name_snapshot,
    staff_name_snapshot = excluded.staff_name_snapshot, updated_at = clock_timestamp();
  update public.pos_sale_requests set invoice_id = v_invoice, completed_at = clock_timestamp()
    where request_id = p_request_id;
  return v_invoice;
end;
$$;

create function shop_private.checkout_pos_sale(
  p_request_id uuid, p_issue_request_id uuid, p_payment_request_id uuid,
  p_appointment_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid,
  p_amount numeric, p_paid_at timestamptz, p_method public.payment_method, p_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_request public.pos_sale_requests%rowtype;
  v_invoice public.invoices%rowtype; v_context public.pos_sale_contexts%rowtype;
begin
  v_actor := shop_private.assert_shop_write_access(p_shop_id, 'sales.issue');
  perform shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if not shop_private.has_permission(p_shop_id, 'payments.receive') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_request_id is null or p_issue_request_id is null or p_payment_request_id is null
    or p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount or p_paid_at is null then
    raise exception 'INVALID_POS_CHECKOUT' using errcode = '22023';
  end if;
  select * into v_invoice from public.invoices where id = p_invoice_id and shop_id = p_shop_id
    and location_id = p_location_id for update;
  select * into v_context from public.pos_sale_contexts where invoice_id = p_invoice_id
    and shop_id = p_shop_id and location_id = p_location_id;
  if v_invoice.id is null or v_context.invoice_id is null then raise exception 'INVALID_POS_CHECKOUT'; end if;
  if p_amount <> v_invoice.total_amount then raise exception 'POS_CHECKOUT_REQUIRES_FULL_PAYMENT' using errcode = '23514'; end if;
  if v_context.appointment_id is not null and p_appointment_request_id is null then
    raise exception 'INVALID_POS_APPOINTMENT' using errcode = '22023';
  end if;
  v_hash := md5(jsonb_build_object('invoice', p_invoice_id, 'amount', p_amount,
    'paidAt', p_paid_at, 'method', p_method, 'reference', nullif(btrim(p_reference), ''),
    'issueRequest', p_issue_request_id, 'paymentRequest', p_payment_request_id,
    'appointmentRequest', p_appointment_request_id)::text);
  insert into public.pos_sale_requests(request_id, shop_id, operation, payload_hash, invoice_id, actor_profile_id)
    values (p_request_id, p_shop_id, 'checkout', v_hash, p_invoice_id, v_actor) on conflict do nothing;
  select * into v_request from public.pos_sale_requests where request_id = p_request_id for update;
  if v_request.shop_id <> p_shop_id or v_request.operation <> 'checkout' or v_request.payload_hash <> v_hash
    or v_request.actor_profile_id <> v_actor then raise exception 'POS_REQUEST_CONFLICT' using errcode = '23505'; end if;
  if v_request.completed_at is not null then return v_request.invoice_id; end if;
  perform set_config('shop.location_id', p_location_id::text, true);
  if v_invoice.client_id is null then
    perform shop_private.checkout_customerless_sale(p_payment_request_id, p_shop_id, p_invoice_id,
      p_amount, p_paid_at, p_method, p_reference);
  else
    perform shop_private.issue_sale(p_issue_request_id, p_shop_id, p_invoice_id);
    select * into v_invoice from public.invoices where id = p_invoice_id and shop_id = p_shop_id;
    if p_amount <> v_invoice.total_amount then
      raise exception 'POS_CHECKOUT_REQUIRES_FULL_PAYMENT' using errcode = '23514';
    end if;
    perform shop_private.record_customer_receipt(p_payment_request_id, p_shop_id, v_invoice.client_id,
      p_amount, p_paid_at, p_method, p_reference, 'POS checkout',
      jsonb_build_array(jsonb_build_object('invoice_id', p_invoice_id, 'amount', p_amount)));
  end if;
  if v_context.appointment_id is not null then perform shop_private.link_appointment_sale(
    p_appointment_request_id, p_shop_id, v_context.appointment_id, p_invoice_id); end if;
  update public.pos_sale_requests set completed_at = clock_timestamp() where request_id = p_request_id;
  return p_invoice_id;
end;
$$;

create function public.pos_catalog_search(p_shop_id uuid, p_location_id uuid,
  p_search text default null, p_item_type text default null, p_barcode text default null,
  p_page integer default 1, p_page_size integer default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.pos_catalog_search(p_shop_id, p_location_id, p_search, p_item_type, p_barcode, p_page, p_page_size);
$$;
create function public.pos_checkout_context(p_shop_id uuid, p_location_id uuid, p_customer_search text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.pos_checkout_context(p_shop_id, p_location_id, p_customer_search);
$$;
create function public.save_pos_sale_draft(p_request_id uuid, p_shop_id uuid, p_location_id uuid,
  p_invoice_id uuid, p_staff_membership_id uuid, p_appointment_id uuid, p_customer_id uuid,
  p_notes text, p_lines jsonb) returns uuid language sql security definer set search_path = '' as $$
  select shop_private.save_pos_sale_draft(p_request_id, p_shop_id, p_location_id, p_invoice_id,
    p_staff_membership_id, p_appointment_id, p_customer_id, p_notes, p_lines);
$$;
create function public.checkout_pos_sale(p_request_id uuid, p_issue_request_id uuid,
  p_payment_request_id uuid, p_appointment_request_id uuid, p_shop_id uuid, p_location_id uuid,
  p_invoice_id uuid, p_amount numeric, p_paid_at timestamptz, p_method public.payment_method,
  p_reference text) returns uuid language sql security definer set search_path = '' as $$
  select shop_private.checkout_pos_sale(p_request_id, p_issue_request_id, p_payment_request_id,
    p_appointment_request_id, p_shop_id, p_location_id, p_invoice_id, p_amount, p_paid_at, p_method, p_reference);
$$;

revoke all on function shop_private.pos_catalog_search(uuid,uuid,text,text,text,integer,integer),
  shop_private.pos_checkout_context(uuid,uuid,text),
  shop_private.save_pos_sale_draft(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb),
  shop_private.checkout_pos_sale(uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,timestamptz,public.payment_method,text)
from public, anon, authenticated, service_role;
revoke all on function public.pos_catalog_search(uuid,uuid,text,text,text,integer,integer),
  public.pos_checkout_context(uuid,uuid,text),
  public.save_pos_sale_draft(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb),
  public.checkout_pos_sale(uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,timestamptz,public.payment_method,text)
from public, anon, authenticated;
grant execute on function public.pos_catalog_search(uuid,uuid,text,text,text,integer,integer),
  public.pos_checkout_context(uuid,uuid,text),
  public.save_pos_sale_draft(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb),
  public.checkout_pos_sale(uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,timestamptz,public.payment_method,text)
to authenticated;
