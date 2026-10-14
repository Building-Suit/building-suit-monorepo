-- SET-D02: presentation is captured at issuance; historical snapshots stay untouched.
alter table public.shop_receipt_settings
  add column document_label text check (document_label is null or length(btrim(document_label)) between 1 and 80),
  add column reference_label text check (reference_label is null or length(btrim(reference_label)) between 1 and 80),
  add column document_language text not null default 'ar' check (document_language in ('ar','en')),
  add column document_direction text not null default 'auto' check (document_direction in ('auto','rtl','ltr')),
  add column show_descriptions boolean not null default true,
  add column notes text check (notes is null or length(notes) <= 1000),
  add column logo_data_url text;

create function shop_private.valid_document_logo(p_value text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_bytes bytea;
begin
  if p_value is null then return true; end if;
  if length(p_value) > 175000 or p_value !~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$' then return false; end if;
  begin v_bytes := decode(split_part(p_value, ',', 2), 'base64'); exception when others then return false; end;
  if octet_length(v_bytes) > 131072 then return false; end if;
  return (p_value like 'data:image/png;%' and substring(v_bytes from 1 for 8) = decode('89504e470d0a1a0a','hex'))
      or (p_value like 'data:image/jpeg;%' and substring(v_bytes from 1 for 3) = decode('ffd8ff','hex'));
end;
$$;
revoke all on function shop_private.valid_document_logo(text) from public, anon, authenticated;
alter table public.shop_receipt_settings add constraint shop_receipt_settings_safe_logo check (shop_private.valid_document_logo(logo_data_url));

create or replace function public.receipt_settings(p_shop_id uuid)
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
    'documentLabel', settings.document_label,
    'referenceLabel', settings.reference_label,
    'documentLanguage', coalesce(settings.document_language, 'ar'),
    'documentDirection', coalesce(settings.document_direction, 'auto'),
    'showDescriptions', coalesce(settings.show_descriptions, true),
    'notes', settings.notes,
    'logoDataUrl', settings.logo_data_url,
    'canManage', shop_private.has_permission(p_shop_id, 'settings.manage')
  ) into v_result
  from public.shops shop
  left join public.shop_receipt_settings settings on settings.shop_id = shop.id
  where shop.id = p_shop_id;
  return v_result;
end;
$$;

create function public.save_document_settings(p_shop_id uuid, p_settings jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile_id uuid; v_logo text; v_label text; v_reference text; v_notes text; v_language text; v_direction text;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'settings.manage');
  if jsonb_typeof(p_settings) is distinct from 'object' or jsonb_typeof(p_settings->'showDescriptions') is distinct from 'boolean'
    or exists (select 1 from jsonb_each(p_settings) item where item.key <> 'showDescriptions' and jsonb_typeof(item.value) not in ('string','null')) then
    raise exception 'INVALID_RECEIPT_SETTINGS' using errcode = '22023';
  end if;
  v_logo := nullif(p_settings->>'logoDataUrl','');
  v_label := nullif(btrim(p_settings->>'documentLabel'),'');
  v_reference := nullif(btrim(p_settings->>'referenceLabel'),'');
  v_notes := nullif(btrim(p_settings->>'notes'),'');
  v_language := p_settings->>'documentLanguage';
  v_direction := p_settings->>'documentDirection';
  if not shop_private.valid_document_logo(v_logo) or length(v_label) > 80 or length(v_reference) > 80 or length(v_notes) > 1000
    or v_language is null or v_language not in ('en','ar') or v_direction is null or v_direction not in ('auto','rtl','ltr') then
    raise exception 'INVALID_RECEIPT_SETTINGS' using errcode = '22023';
  end if;
  -- Keep legacy callers compatible: this command uses the supported existing
  -- write and updates the new presentation fields in the same transaction.
  perform public.save_receipt_settings(p_shop_id, p_settings->>'displayName', p_settings->>'address', p_settings->>'phone', p_settings->>'footer', p_settings->>'paperSize');
  update public.shop_receipt_settings set document_label = v_label, reference_label = v_reference, document_language = v_language,
    document_direction = v_direction, show_descriptions = (p_settings->>'showDescriptions')::boolean,
    notes = v_notes, logo_data_url = v_logo, updated_by_profile_id = v_profile_id, updated_at = clock_timestamp()
  where shop_id = p_shop_id;
  return public.receipt_settings(p_shop_id);
end;
$$;
revoke all on function public.save_document_settings(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_document_settings(uuid,jsonb) to authenticated;

create or replace function shop_private.capture_sale_receipt_at_issue()
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
    'presentation', jsonb_build_object(
      'documentLabel', v_settings.document_label,
      'referenceLabel', v_settings.reference_label,
      'language', coalesce(v_settings.document_language, 'ar'),
      'direction', coalesce(v_settings.document_direction, 'auto'),
      'showDescriptions', coalesce(v_settings.show_descriptions, true),
      'notes', v_settings.notes,
      'logoDataUrl', v_settings.logo_data_url
    ),
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
      'description', coalesce((select service.description from public.services service where service.id = item.service_id and service.shop_id = new.shop_id), item.product_sku_snapshot),
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

notify pgrst, 'reload schema';
