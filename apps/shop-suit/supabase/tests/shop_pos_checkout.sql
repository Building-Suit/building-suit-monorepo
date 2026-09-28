-- SS-POS-001: bounded barcode lookup and idempotent, fully-paid mixed checkout.
create temporary table shop_pos_fixture as select gen_random_uuid() owner_id;
grant select on shop_pos_fixture to authenticated;
insert into auth.users (id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id, 'owner@ss-pos.invalid', 'x', 'authenticated', 'authenticated', now(), '{}', '{}', now(), now() from shop_pos_fixture;
select set_config('request.jwt.claim.sub', owner_id::text, true), set_config('request.jwt.claim.role', 'authenticated', true) from shop_pos_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_location uuid; v_staff uuid; v_customer uuid; v_product uuid; v_service uuid;
  v_invoice uuid; v_retry uuid; v_save uuid := gen_random_uuid(); v_checkout uuid := gen_random_uuid();
  v_issue uuid := gen_random_uuid(); v_payment uuid := gen_random_uuid(); v_result jsonb;
  v_appointment_service uuid; v_appointment uuid; v_appointment_invoice uuid;
  v_start timestamptz := date_trunc('day', now()) + interval '1 day 10 hours';
begin
  v_shop := public.create_owner_shop('POS fixture', 'pro', 'mixed');
  select id into v_location from public.shop_locations where shop_id = v_shop and is_default;
  select id into v_staff from public.shop_memberships where shop_id = v_shop and role = 'owner';
  v_customer := public.save_customer(v_shop, null, 'Counter customer', '01000000000', null, null, null);
  v_product := public.save_product(v_shop, null, 'Barcode product', 'POS-1', '6221234567890', 20);
  v_service := public.save_service(v_shop, null, 'Counter service', null, 50, 'amount', 0);
  perform public.adjust_stock(gen_random_uuid(), v_shop, v_product, 3, 10, 'POS opening stock');
  v_result := public.pos_catalog_search(v_shop, v_location, null, null, '6221234567890', 1, 2);
  if jsonb_array_length(v_result -> 'items') <> 1 or v_result -> 'items' -> 0 ->> 'id' <> v_product::text then
    raise exception 'known barcode was not resolved exactly';
  end if;
  if jsonb_array_length(public.pos_catalog_search(v_shop, v_location, null, null, 'UNKNOWN', 1, 2) -> 'items') <> 0 then
    raise exception 'unknown barcode unexpectedly resolved';
  end if;
  v_invoice := public.save_pos_sale_draft(v_save, v_shop, v_location, null, v_staff, null,
    v_customer, null, jsonb_build_array(
      jsonb_build_object('item_type','product','source_id',v_product,'quantity',1),
      jsonb_build_object('item_type','service','source_id',v_service,'quantity',1)));
  v_retry := public.checkout_pos_sale(v_checkout, v_issue, v_payment, null, v_shop, v_location,
    v_invoice, 70, now(), 'cash', 'POS-TEST');
  if v_retry <> v_invoice then raise exception 'checkout returned another sale'; end if;
  v_retry := public.checkout_pos_sale(v_checkout, v_issue, v_payment, null, v_shop, v_location,
    v_invoice, 70, (select paid_at from public.payments where invoice_id = v_invoice), 'cash', 'POS-TEST');
  if v_retry <> v_invoice or (select count(*) from public.payments where invoice_id = v_invoice) <> 1
    or (select count(*) from public.inventory_movements where reference_id = v_invoice) <> 1 then
    raise exception 'repeat checkout duplicated the sale';
  end if;
  if (select count(*) from public.invoice_items where invoice_id = v_invoice) <> 2
    or not exists (select 1 from public.invoice_items where invoice_id = v_invoice and item_type = 'product')
    or not exists (select 1 from public.invoice_items where invoice_id = v_invoice and item_type = 'service') then
    raise exception 'mixed checkout did not preserve product and service lines';
  end if;
  if (select status from public.invoices where id = v_invoice) <> 'issued'
    or (public.get_sale(v_shop, v_invoice) ->> 'outstanding')::numeric <> 0 then raise exception 'POS checkout was not fully paid'; end if;

  v_appointment_service := public.save_service(v_shop, null, 'Booked service', null, 40,
    'amount', 0, true, 30, 0, array[v_location], array[v_staff]);
  perform public.save_staff_schedule(v_shop, v_location, v_staff, 'Africa/Cairo',
    (select jsonb_agg(jsonb_build_object('weekday', day, 'startsLocal', '08:00',
      'endsLocal', '20:00')) from generate_series(0, 6) day), '[]'::jsonb);
  v_appointment := public.save_appointment(gen_random_uuid(), v_shop, null, v_location,
    v_staff, v_appointment_service, v_start, 'customer', v_customer, null, null, 'POS booking');
  v_appointment_invoice := public.save_pos_sale_draft(gen_random_uuid(), v_shop, v_location,
    null, v_staff, v_appointment, v_customer, null, jsonb_build_array(
      jsonb_build_object('item_type','service','source_id',v_appointment_service,'quantity',1)));
  perform public.checkout_pos_sale(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), v_shop, v_location, v_appointment_invoice, 40, now(), 'card', null);
  if (select sale_id from public.appointments where id = v_appointment) is distinct from v_appointment_invoice
    or public.get_sale(v_shop, v_appointment_invoice) ->> 'client_id' is distinct from v_customer::text then
    raise exception 'appointment checkout did not preserve staff and sale context';
  end if;
end;
$$;
reset role;
