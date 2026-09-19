-- Supplier purchases for the dedicated Shop project. Browser roles keep read-only
-- table access; all writes pass through authenticated, tenant-checked RPCs.

alter table public.vendor_invoices
  add column request_id uuid,
  add column request_payload jsonb;

create unique index vendor_invoices_shop_request_unique
  on public.vendor_invoices (shop_id, request_id)
  where request_id is not null;

alter table public.vendor_invoice_items
  add constraint vendor_invoice_items_quantity_positive
    check (quantity > 0),
  add constraint vendor_invoice_items_unit_cost_nonnegative
    check (unit_cost >= 0),
  add constraint vendor_invoice_items_total_cost_nonnegative
    check (total_cost >= 0);

alter table public.inventory_batches
  add constraint inventory_batches_unit_cost_nonnegative
    check (unit_cost >= 0);

create unique index vendor_invoice_items_product_unique
  on public.vendor_invoice_items (vendor_invoice_id, product_id);

create function shop_private.assert_purchase_entitlement(p_shop_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.shop_memberships owner_member
    join public.subscriptions sub
      on sub.profile_id = owner_member.profile_id
    join public.plans plan on plan.id = sub.plan_id
    join public.shops shop on shop.id = owner_member.shop_id
    join public.portals portal on portal.id = shop.portal_id
    where owner_member.shop_id = p_shop_id
      and owner_member.role = 'owner'
      and owner_member.status = 'active'::public.shop_membership_status
      and portal.key = 'shop-crm'
      and plan.portal_id = portal.id
      and plan.features ? 'inventory'
      and jsonb_typeof(plan.features -> 'inventory') = 'boolean'
      and (plan.features ->> 'inventory')::boolean
  ) then
    raise exception 'PURCHASES_NOT_IN_PLAN' using errcode = '42501';
  end if;
end;
$$;

revoke all on function shop_private.assert_purchase_entitlement(uuid)
  from public, anon, authenticated;
grant execute on function shop_private.assert_purchase_entitlement(uuid)
  to authenticated;

create function shop_private.create_vendor(
  p_shop_id uuid,
  p_name text,
  p_contact_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_tax_number text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_vendor_id uuid;
  v_name text := btrim(p_name);
  v_contact_name text := nullif(btrim(p_contact_name), '');
  v_phone text := nullif(btrim(p_phone), '');
  v_email text := nullif(btrim(p_email), '');
  v_address text := nullif(btrim(p_address), '');
  v_tax_number text := nullif(btrim(p_tax_number), '');
  v_notes text := nullif(btrim(p_notes), '');
begin
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'vendors.manage'
  );
  if v_name is null or length(v_name) < 2 or length(v_name) > 160
    or (v_contact_name is not null and length(v_contact_name) > 160)
    or (v_phone is not null and length(v_phone) > 40)
    or (v_email is not null and (
      length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+$'
    ))
    or (v_address is not null and length(v_address) > 500)
    or (v_tax_number is not null and length(v_tax_number) > 80)
    or (v_notes is not null and length(v_notes) > 1000) then
    raise exception 'INVALID_VENDOR' using errcode = '22023';
  end if;

  perform 1 from public.shops where id = p_shop_id for update;
  if not found then raise exception 'SHOP_NOT_FOUND'; end if;
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'vendors.manage'
  );
  perform shop_private.assert_purchase_entitlement(p_shop_id);

  insert into public.vendors (
    shop_id, name, contact_name, phone, email, address, tax_number, notes,
    created_by_profile_id
  ) values (
    p_shop_id, v_name, v_contact_name, v_phone, v_email, v_address,
    v_tax_number, v_notes, v_profile_id
  ) returning id into v_vendor_id;

  return v_vendor_id;
end;
$$;

revoke all on function shop_private.create_vendor(
  uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function shop_private.create_vendor(
  uuid, text, text, text, text, text, text, text
) to authenticated;

create function public.create_vendor(
  p_shop_id uuid,
  p_name text,
  p_contact_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_tax_number text,
  p_notes text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select shop_private.create_vendor(
    p_shop_id, p_name, p_contact_name, p_phone, p_email, p_address,
    p_tax_number, p_notes
  );
$$;

revoke all on function public.create_vendor(
  uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_vendor(
  uuid, text, text, text, text, text, text, text
) to authenticated;

create function shop_private.create_supplier_purchase(
  p_request_id uuid,
  p_shop_id uuid,
  p_vendor_id uuid,
  p_invoice_number text,
  p_issued_on date,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
        or item.quantity > 1000000 or round(item.quantity, 3) <> item.quantity
        or item.unit_cost < 0 or item.unit_cost > 999999999.99
        or round(item.unit_cost, 2) <> item.unit_cost
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
      vendor_invoice_id, product_id, quantity, unit_cost, total_cost
    ) values (
      v_invoice_id, v_item.product_id, v_item.quantity, v_item.unit_cost,
      round(v_item.quantity * v_item.unit_cost, 2)
    );

    insert into public.inventory_batches (
      shop_id, product_id, quantity_received, remaining_quantity,
      unit_cost, received_at, source_type, source_id
    ) values (
      p_shop_id, v_item.product_id, v_item.quantity, v_item.quantity,
      v_item.unit_cost, v_issued_at, 'vendor_invoice', v_invoice_id
    ) returning id into v_batch_id;

    insert into public.inventory_movements (
      shop_id, product_id, batch_id, quantity_change, movement_type,
      reference_id, created_by_profile_id, unit_cost_snapshot
    ) values (
      p_shop_id, v_item.product_id, v_batch_id, v_item.quantity, 'in',
      v_invoice_id, v_profile_id, round(v_item.unit_cost, 2)
    );
  end loop;

  update public.vendor_invoices
  set status = 'posted', updated_at = now()
  where id = v_invoice_id and status = 'draft';
  if not found then raise exception 'PURCHASE_POST_FAILED'; end if;

  return v_invoice_id;
end;
$$;

revoke all on function shop_private.create_supplier_purchase(
  uuid, uuid, uuid, text, date, text, jsonb
) from public, anon, authenticated;
grant execute on function shop_private.create_supplier_purchase(
  uuid, uuid, uuid, text, date, text, jsonb
) to authenticated;

create function public.create_supplier_purchase(
  p_request_id uuid,
  p_shop_id uuid,
  p_vendor_id uuid,
  p_invoice_number text,
  p_issued_on date,
  p_notes text,
  p_items jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select shop_private.create_supplier_purchase(
    p_request_id, p_shop_id, p_vendor_id, p_invoice_number, p_issued_on,
    p_notes, p_items
  );
$$;

revoke all on function public.create_supplier_purchase(
  uuid, uuid, uuid, text, date, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_supplier_purchase(
  uuid, uuid, uuid, text, date, text, jsonb
) to authenticated;

-- Posted purchase headers and lines are immutable. The private void command may
-- make the sole posted -> void transition while preserving every other field.
create or replace function public.prevent_vendor_invoice_edit_after_post()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in (
      'posted'::public.vendor_invoice_status,
      'void'::public.vendor_invoice_status
    ) then
      raise exception 'POSTED_PURCHASE_IMMUTABLE' using errcode = '55000';
    end if;
    return old;
  end if;

  if old.status = 'void'::public.vendor_invoice_status then
    raise exception 'POSTED_PURCHASE_IMMUTABLE' using errcode = '55000';
  end if;
  if old.status = 'posted'::public.vendor_invoice_status then
    if current_user = 'postgres'
      and new.status = 'void'::public.vendor_invoice_status
      and new.id is not distinct from old.id
      and new.shop_id is not distinct from old.shop_id
      and new.vendor_id is not distinct from old.vendor_id
      and new.vendor_name_snapshot is not distinct from old.vendor_name_snapshot
      and new.invoice_number is not distinct from old.invoice_number
      and new.issued_at is not distinct from old.issued_at
      and new.total_amount is not distinct from old.total_amount
      and new.notes is not distinct from old.notes
      and new.created_by_profile_id is not distinct from old.created_by_profile_id
      and new.created_at is not distinct from old.created_at
      and new.request_id is not distinct from old.request_id
      and new.request_payload is not distinct from old.request_payload then
      return new;
    end if;
    raise exception 'POSTED_PURCHASE_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_vendor_invoice_edit
  on public.vendor_invoices;
create trigger trg_prevent_vendor_invoice_edit
before update or delete on public.vendor_invoices
for each row execute function public.prevent_vendor_invoice_edit_after_post();

create function public.prevent_posted_vendor_invoice_item_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice_id uuid := case when tg_op = 'DELETE'
    then old.vendor_invoice_id else new.vendor_invoice_id end;
  v_status public.vendor_invoice_status;
begin
  select status into v_status
  from public.vendor_invoices where id = v_invoice_id;
  if v_status is null then raise exception 'PURCHASE_NOT_FOUND'; end if;
  if v_status <> 'draft'::public.vendor_invoice_status then
    raise exception 'POSTED_PURCHASE_IMMUTABLE' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.prevent_posted_vendor_invoice_item_mutation()
  from public, anon, authenticated;

create trigger trg_prevent_posted_vendor_invoice_item_mutation
before insert or update or delete on public.vendor_invoice_items
for each row execute function public.prevent_posted_vendor_invoice_item_mutation();

create function shop_private.void_supplier_purchase(
  p_shop_id uuid,
  p_purchase_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_purchase public.vendor_invoices%rowtype;
  v_batch record;
begin
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'vendor_invoices.manage'
  );
  perform shop_private.assert_purchase_entitlement(p_shop_id);

  select * into v_purchase
  from public.vendor_invoices
  where id = p_purchase_id and shop_id = p_shop_id
  for update;
  if not found then raise exception 'PURCHASE_NOT_FOUND'; end if;
  if v_purchase.status = 'void'::public.vendor_invoice_status then return; end if;
  if v_purchase.status <> 'posted'::public.vendor_invoice_status then
    raise exception 'PURCHASE_NOT_POSTED';
  end if;

  perform shop_private.assert_period_is_open(
    p_shop_id, v_purchase.issued_at
  );

  if not exists (
    select 1 from public.inventory_batches batch
    where batch.shop_id = p_shop_id
      and batch.source_type = 'vendor_invoice'::public.inventory_source_type
      and batch.source_id = p_purchase_id
  ) then
    raise exception 'PURCHASE_BATCHES_MISSING';
  end if;

  for v_batch in
    select batch.*
    from public.inventory_batches batch
    where batch.shop_id = p_shop_id
      and batch.source_type = 'vendor_invoice'::public.inventory_source_type
      and batch.source_id = p_purchase_id
    order by batch.product_id, batch.id
    for update
  loop
    if v_batch.remaining_quantity <> v_batch.quantity_received then
      raise exception 'PURCHASE_STOCK_ALREADY_USED' using errcode = '55000';
    end if;
    update public.inventory_batches
    set remaining_quantity = 0
    where id = v_batch.id;
    insert into public.inventory_movements (
      shop_id, product_id, batch_id, quantity_change, movement_type,
      reference_id, created_by_profile_id, unit_cost_snapshot
    ) values (
      p_shop_id, v_batch.product_id, v_batch.id,
      -v_batch.quantity_received, 'adjustment', p_purchase_id,
      v_profile_id, round(v_batch.unit_cost, 2)
    );
  end loop;

  update public.vendor_invoices
  set status = 'void', updated_at = now()
  where id = p_purchase_id and shop_id = p_shop_id and status = 'posted';
  if not found then raise exception 'PURCHASE_VOID_FAILED'; end if;
end;
$$;

revoke all on function shop_private.void_supplier_purchase(uuid, uuid)
  from public, anon, authenticated;
grant execute on function shop_private.void_supplier_purchase(uuid, uuid)
  to authenticated;

create function public.void_supplier_purchase(
  p_shop_id uuid,
  p_purchase_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select shop_private.void_supplier_purchase(p_shop_id, p_purchase_id);
$$;

revoke all on function public.void_supplier_purchase(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.void_supplier_purchase(uuid, uuid)
  to authenticated;

-- Retire the unsafe historical poster even for service-role callers. It remains
-- in the catalog only as source evidence and is not part of the supported API.
revoke all on function public.post_vendor_invoice_and_create_batches(uuid, uuid)
  from public, anon, authenticated, service_role;

-- Reassert the table boundary explicitly alongside the new RPC grants.
revoke insert, update, delete, truncate on table
  public.vendors,
  public.vendor_invoices,
  public.vendor_invoice_items,
  public.inventory_batches,
  public.inventory_movements,
  public.payments
from anon, authenticated;

notify pgrst, 'reload schema';
