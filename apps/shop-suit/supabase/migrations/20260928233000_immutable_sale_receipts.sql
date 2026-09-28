-- SS-RECEIPT-001: immutable, share-ready proof of a fully-paid issued sale.
-- Receipt presentation settings affect future documents only. Identity, lines,
-- and totals freeze at issuance; payment evidence joins that immutable snapshot
-- once the sale becomes fully paid.

create table public.shop_receipt_settings (
  shop_id uuid primary key references public.shops (id) on delete restrict,
  display_name text check (display_name is null or length(btrim(display_name)) between 2 and 160),
  address text check (address is null or length(btrim(address)) <= 500),
  phone text check (phone is null or length(btrim(phone)) <= 80),
  footer text check (footer is null or length(btrim(footer)) <= 500),
  paper_size text not null default 'thermal_80'
    check (paper_size in ('thermal_80', 'a4')),
  updated_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.sale_receipts (
  invoice_id uuid primary key,
  shop_id uuid not null,
  location_id uuid not null,
  snapshot_version integer not null default 1 check (snapshot_version = 1),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (invoice_id, shop_id, location_id)
    references public.invoices (id, shop_id, location_id) on delete restrict
);

create table public.sale_receipt_issue_snapshots (
  invoice_id uuid primary key,
  shop_id uuid not null,
  location_id uuid not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (invoice_id, shop_id, location_id)
    references public.invoices (id, shop_id, location_id) on delete restrict
);

create index sale_receipts_shop_location_created_idx
  on public.sale_receipts (shop_id, location_id, created_at desc, invoice_id);

alter table public.shop_receipt_settings enable row level security;
alter table public.sale_receipts enable row level security;
alter table public.sale_receipt_issue_snapshots enable row level security;
revoke all on table public.shop_receipt_settings, public.sale_receipts,
  public.sale_receipt_issue_snapshots
  from public, anon, authenticated;
grant all on table public.shop_receipt_settings, public.sale_receipts,
  public.sale_receipt_issue_snapshots to service_role;

create function shop_private.prevent_sale_receipt_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'SALE_RECEIPT_IMMUTABLE' using errcode = '55000';
end;
$$;
revoke all on function shop_private.prevent_sale_receipt_mutation()
  from public, anon, authenticated, service_role;
create trigger trg_prevent_sale_receipt_mutation
before update or delete on public.sale_receipts
for each row execute function shop_private.prevent_sale_receipt_mutation();
create trigger trg_prevent_sale_receipt_issue_snapshot_mutation
before update or delete on public.sale_receipt_issue_snapshots
for each row execute function shop_private.prevent_sale_receipt_mutation();

create function shop_private.capture_sale_receipt_at_issue()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.shop_receipt_settings%rowtype;
  v_shop_name text;
  v_location public.shop_locations%rowtype;
  v_staff_name text;
  v_snapshot jsonb;
begin
  if old.status <> 'draft'::public.invoice_status
    or new.status <> 'issued'::public.invoice_status then return new; end if;
  select shop.name into v_shop_name from public.shops shop where shop.id = new.shop_id;
  select * into v_location from public.shop_locations location
  where location.id = new.location_id and location.shop_id = new.shop_id;
  select * into v_settings from public.shop_receipt_settings settings
  where settings.shop_id = new.shop_id;
  select coalesce(context.staff_name_snapshot, profile.display_name, profile.email_snapshot)
  into v_staff_name
  from public.invoices invoice
  left join public.pos_sale_contexts context on context.invoice_id = invoice.id
  left join public.profiles profile on profile.id = invoice.issued_by_profile_id
  where invoice.id = new.id;

  v_snapshot := jsonb_build_object(
    'version', 1,
    'invoiceId', new.id,
    'invoiceNumber', new.invoice_number,
    'issuedAt', new.issued_at,
    'currency', new.currency,
    'business', jsonb_build_object(
      'name', coalesce(nullif(btrim(v_settings.display_name), ''), v_shop_name),
      'address', nullif(btrim(v_settings.address), ''),
      'phone', nullif(btrim(v_settings.phone), '')
    ),
    'location', jsonb_build_object(
      'name', v_location.name,
      'code', v_location.code,
      'address', v_location.address,
      'phone', v_location.phone
    ),
    'staffName', v_staff_name,
    'customer', jsonb_build_object(
      'name', new.client_name_snapshot,
      'phone', new.client_phone_snapshot
    ),
    'lines', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', item.id,
      'itemType', item.item_type,
      'name', item.item_name,
      'sku', item.product_sku_snapshot,
      'quantity', item.quantity,
      'unitPrice', item.unit_price,
      'discount', coalesce(item.discount_amount, 0),
      'total', item.total_amount
    ) order by item.line_order, item.id), '[]'::jsonb)
      from public.invoice_items item where item.invoice_id = new.id),
    'payments', '[]'::jsonb,
    'subtotal', new.total_amount + coalesce(new.discount_amount, 0),
    'discount', coalesce(new.discount_amount, 0),
    'total', new.total_amount,
    'footer', nullif(btrim(v_settings.footer), ''),
    'paperSize', coalesce(v_settings.paper_size, 'thermal_80')
  );
  insert into public.sale_receipt_issue_snapshots (invoice_id, shop_id, location_id, snapshot)
  values (new.id, new.shop_id, new.location_id, v_snapshot)
  on conflict (invoice_id) do nothing;
  return new;
end;
$$;
revoke all on function shop_private.capture_sale_receipt_at_issue()
  from public, anon, authenticated, service_role;
create trigger trg_capture_sale_receipt_at_issue
after update of status on public.invoices
for each row execute function shop_private.capture_sale_receipt_at_issue();

create function shop_private.capture_paid_sale_receipt(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_invoice public.invoices%rowtype;
  v_snapshot jsonb;
begin
  if p_invoice_id is null
    or exists (select 1 from public.sale_receipts receipt where receipt.invoice_id = p_invoice_id) then
    return;
  end if;

  select * into v_invoice from public.invoices invoice
  where invoice.id = p_invoice_id for update;
  if not found or v_invoice.status <> 'issued'::public.invoice_status
    or shop_private.invoice_outstanding(v_invoice.id) <> 0 then
    return;
  end if;

  select issue.snapshot into v_snapshot
  from public.sale_receipt_issue_snapshots issue where issue.invoice_id = v_invoice.id;
  if v_snapshot is null then return; end if;
  v_snapshot := v_snapshot || jsonb_build_object(
    'payments', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', allocation.id,
      'amount', allocation.amount,
      'method', payment.method,
      'reference', payment.reference,
      'paidAt', payment.paid_at
    ) order by payment.paid_at, allocation.id), '[]'::jsonb)
      from public.customer_payment_allocations allocation
      join public.payments payment on payment.id = allocation.payment_id
      where allocation.invoice_id = v_invoice.id
        and payment.payment_direction = 'in'
        and payment.status = 'completed'
        and payment.customer_kind = 'receipt')
  );

  insert into public.sale_receipts (
    invoice_id, shop_id, location_id, snapshot_version, snapshot
  ) values (
    v_invoice.id, v_invoice.shop_id, v_invoice.location_id, 1, v_snapshot
  ) on conflict (invoice_id) do nothing;
end;
$$;
revoke all on function shop_private.capture_paid_sale_receipt(uuid)
  from public, anon, authenticated, service_role;

create function shop_private.capture_paid_sale_receipt_from_allocation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform shop_private.capture_paid_sale_receipt(new.invoice_id);
  return new;
end;
$$;
revoke all on function shop_private.capture_paid_sale_receipt_from_allocation()
  from public, anon, authenticated, service_role;
create trigger trg_capture_paid_sale_receipt
after insert on public.customer_payment_allocations
for each row execute function shop_private.capture_paid_sale_receipt_from_allocation();

create function public.receipt_settings(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if not shop_private.is_member(p_shop_id) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'displayName', coalesce(nullif(btrim(settings.display_name), ''), shop.name),
    'address', settings.address,
    'phone', settings.phone,
    'footer', settings.footer,
    'paperSize', coalesce(settings.paper_size, 'thermal_80'),
    'canManage', shop_private.has_permission(p_shop_id, 'settings.manage')
  ) into v_result
  from public.shops shop
  left join public.shop_receipt_settings settings on settings.shop_id = shop.id
  where shop.id = p_shop_id;
  return v_result;
end;
$$;

create function public.save_receipt_settings(
  p_shop_id uuid, p_display_name text, p_address text, p_phone text,
  p_footer text, p_paper_size text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile_id uuid;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'settings.manage');
  if length(btrim(coalesce(p_display_name, ''))) not between 2 and 160
    or length(coalesce(p_address, '')) > 500
    or length(coalesce(p_phone, '')) > 80
    or length(coalesce(p_footer, '')) > 500
    or p_paper_size is null or p_paper_size not in ('thermal_80', 'a4') then
    raise exception 'INVALID_RECEIPT_SETTINGS' using errcode = '22023';
  end if;
  insert into public.shop_receipt_settings (
    shop_id, display_name, address, phone, footer, paper_size, updated_by_profile_id
  ) values (
    p_shop_id, btrim(p_display_name), nullif(btrim(p_address), ''),
    nullif(btrim(p_phone), ''), nullif(btrim(p_footer), ''),
    p_paper_size, v_profile_id
  ) on conflict (shop_id) do update set
    display_name = excluded.display_name,
    address = excluded.address,
    phone = excluded.phone,
    footer = excluded.footer,
    paper_size = excluded.paper_size,
    updated_by_profile_id = excluded.updated_by_profile_id,
    updated_at = clock_timestamp();
  return public.receipt_settings(p_shop_id);
end;
$$;

create function public.get_location_sale_receipt(
  p_shop_id uuid, p_location_id uuid, p_invoice_id uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_snapshot jsonb;
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  perform shop_private.assert_sale_read_access(p_shop_id);
  select receipt.snapshot into v_snapshot from public.sale_receipts receipt
  where receipt.invoice_id = p_invoice_id and receipt.shop_id = p_shop_id
    and receipt.location_id = p_location_id;
  return v_snapshot;
end;
$$;

revoke all on function public.receipt_settings(uuid),
  public.save_receipt_settings(uuid,text,text,text,text,text),
  public.get_location_sale_receipt(uuid,uuid,uuid)
from public, anon, authenticated;
grant execute on function public.receipt_settings(uuid),
  public.save_receipt_settings(uuid,text,text,text,text,text),
  public.get_location_sale_receipt(uuid,uuid,uuid)
to authenticated;

notify pgrst, 'reload schema';
