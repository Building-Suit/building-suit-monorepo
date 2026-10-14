-- SS-SET-001: fully-paid issuance captures one immutable customer receipt.
create temporary table shop_receipt_fixture as select gen_random_uuid() owner_id;
grant select on shop_receipt_fixture to authenticated;
insert into auth.users (id,email,encrypted_password,aud,role,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id, 'owner@ss-receipt.invalid', 'x', 'authenticated', 'authenticated', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now() from shop_receipt_fixture;

do $$
declare function_row record;
begin
  for function_row in select procedure.oid, procedure.proname, procedure.prosecdef,
    procedure.proconfig from pg_proc procedure join pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public' and procedure.proname = any(array[
      'receipt_settings','save_receipt_settings','save_document_settings','get_location_sale_receipt'
    ])
  loop
    if not function_row.prosecdef
      or function_row.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', function_row.oid, 'execute')
      or has_function_privilege('anon', function_row.oid, 'execute') then
      raise exception 'unsafe receipt wrapper: %', function_row.proname;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.sale_receipts', 'select')
    or has_table_privilege('authenticated', 'public.sale_receipts', 'update')
    or has_table_privilege('authenticated', 'public.sale_receipt_issue_snapshots', 'select')
    or has_table_privilege('authenticated', 'public.shop_receipt_settings', 'select') then
    raise exception 'receipt internals are directly browser-accessible';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true) from shop_receipt_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_location uuid; v_staff uuid; v_service uuid; v_invoice uuid;
  v_credit_invoice uuid; v_customer uuid; v_snapshot jsonb;
begin
  v_shop := public.create_owner_shop('Receipt fixture', 'team', 'service');
  select id into v_location from public.shop_locations where shop_id = v_shop and is_default;
  select id into v_staff from public.shop_memberships where shop_id = v_shop and role = 'owner';
  perform public.save_document_settings(v_shop, jsonb_build_object(
    'displayName','Snapshot Barber','address','10 Original Street','phone','01000000000','footer','Thank you','paperSize','thermal_80',
    'documentLabel','Original receipt','referenceLabel','Original reference label','documentLanguage','en','documentDirection','ltr','showDescriptions',false,'notes','Original note',
    'logoDataUrl','data:image/png;base64,iVBORw0KGgo='));
  if public.receipt_settings(v_shop)->>'documentLanguage' <> 'en' then raise exception 'document settings did not persist'; end if;
  begin
    perform public.save_document_settings(v_shop, (public.receipt_settings(v_shop) - 'canManage') || '{"logoDataUrl":"https://mutable.invalid/logo.svg"}'::jsonb);
    raise exception 'mutable logo URL accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_document_settings(v_shop, (public.receipt_settings(v_shop) - 'canManage') || '{"documentLanguage":"zz"}'::jsonb);
    raise exception 'invalid language accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_document_settings(v_shop, (public.receipt_settings(v_shop) - 'canManage') || '{"logoDataUrl":"data:image/png;base64,SGVsbG8="}'::jsonb);
    raise exception 'invalid image bytes accepted';
  exception when invalid_parameter_value then null; end;
  perform public.save_shop_location(v_shop, v_location, 'Downtown', 'DT',
    '20 Branch Street', '02000000000');
  v_service := public.save_service(v_shop, null, 'Haircut', 'Original line description', 75, 'amount', 5);
  v_invoice := public.save_pos_sale_draft(gen_random_uuid(), v_shop, v_location, null,
    v_staff, null, null, null, jsonb_build_array(jsonb_build_object(
      'item_type','service','source_id',v_service,'quantity',1)));
  perform public.checkout_pos_sale(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    null, v_shop, v_location, v_invoice, 70, '2026-09-28 12:30:00+00', 'cash', 'COUNTER-1');

  v_snapshot := public.get_location_sale_receipt(v_shop, v_location, v_invoice);
  if v_snapshot #>> '{presentation,referenceLabel}' <> 'Original reference label'
    or v_snapshot #>> '{presentation,documentLabel}' <> 'Original receipt'
    or v_snapshot #>> '{presentation,language}' <> 'en'
    or v_snapshot #>> '{presentation,direction}' <> 'ltr'
    or v_snapshot #>> '{presentation,notes}' <> 'Original note'
    or v_snapshot #>> '{presentation,logoDataUrl}' <> 'data:image/png;base64,iVBORw0KGgo='
    or (v_snapshot #>> '{presentation,showDescriptions}')::boolean <> false
    or v_snapshot #>> '{lines,0,description}' <> 'Original line description'
    or v_snapshot #>> '{business,name}' <> 'Snapshot Barber'
    or v_snapshot #>> '{location,name}' <> 'Downtown'
    or v_snapshot #>> '{lines,0,name}' <> 'Haircut'
    or (v_snapshot #>> '{lines,0,total}')::numeric <> 70
    or v_snapshot #>> '{payments,0,method}' <> 'cash'
    or v_snapshot #>> '{payments,0,reference}' <> 'COUNTER-1'
    or (v_snapshot ->> 'total')::numeric <> 70
    or v_snapshot ->> 'paperSize' <> 'thermal_80' then
    raise exception 'receipt omitted issued proof-of-sale values: %', v_snapshot;
  end if;

  perform public.save_document_settings(v_shop, (public.receipt_settings(v_shop) - 'canManage') || '{"displayName":"Changed Later","documentLabel":"Changed title","documentLanguage":"ar","documentDirection":"rtl","notes":"Changed notes","showDescriptions":true,"logoDataUrl":null}'::jsonb);
  perform public.save_service(v_shop, v_service, 'Changed service', 'Changed description', 75, 'amount', 5);
  perform public.save_shop_location(v_shop, v_location, 'Renamed Later', 'NEW', null, null);
  if public.get_location_sale_receipt(v_shop, v_location, v_invoice) <> v_snapshot then
    raise exception 'settings or location change rewrote issued receipt snapshot';
  end if;
  if public.get_location_sale_receipt(v_shop, v_location, gen_random_uuid()) is not null then
    raise exception 'unknown sale unexpectedly returned a receipt';
  end if;

  -- Freeze presentation at issuance even if a credit sale is paid later.
  v_customer := public.save_customer(v_shop, null, 'Credit customer', null, null, null, null);
  perform public.save_receipt_settings(v_shop, 'Identity At Issue', 'Issue Address',
    null, 'Issue footer', 'thermal_80');
  v_credit_invoice := public.save_pos_sale_draft(gen_random_uuid(), v_shop, v_location, null,
    v_staff, null, v_customer, null, jsonb_build_array(jsonb_build_object(
      'item_type','service','source_id',v_service,'quantity',1)));
  perform public.issue_location_sale(gen_random_uuid(), v_shop, v_location, v_credit_invoice);
  perform public.save_document_settings(v_shop, (public.receipt_settings(v_shop) - 'canManage') || '{"displayName":"Changed Before Payment","documentLabel":"Changed after issue","documentLanguage":"en","documentDirection":"ltr","notes":null,"showDescriptions":false}'::jsonb);
  perform public.record_location_customer_receipt(gen_random_uuid(), v_shop, v_location,
    v_customer, 70, '2026-09-29 12:30:00+00', 'card', 'CREDIT-1', null,
    jsonb_build_array(jsonb_build_object('invoice_id',v_credit_invoice,'amount',70)));
  v_snapshot := public.get_location_sale_receipt(v_shop, v_location, v_credit_invoice);
  if v_snapshot #>> '{presentation,documentLabel}' <> 'Changed title'
    or v_snapshot #>> '{presentation,language}' <> 'ar'
    or v_snapshot #>> '{presentation,direction}' <> 'rtl'
    or v_snapshot #>> '{presentation,notes}' <> 'Changed notes'
    or (v_snapshot #>> '{presentation,showDescriptions}')::boolean <> true
    or v_snapshot #>> '{business,name}' <> 'Identity At Issue'
    or v_snapshot ->> 'footer' <> 'Issue footer'
    or v_snapshot ->> 'paperSize' <> 'thermal_80'
    or v_snapshot #>> '{payments,0,method}' <> 'card' then
    raise exception 'settings changed after issue rewrote the finalized document: %', v_snapshot;
  end if;

  perform set_config('ss_receipt.shop', v_shop::text, true);
  perform set_config('ss_receipt.invoice', v_invoice::text, true);
end;
$$;
reset role;

do $$
begin
  begin
    update public.sale_receipts set snapshot = '{}'::jsonb
    where invoice_id = current_setting('ss_receipt.invoice')::uuid;
    raise exception 'issued receipt snapshot was mutable';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'SALE_RECEIPT_IMMUTABLE' then raise; end if;
  end;
  begin
    delete from public.sale_receipts
    where invoice_id = current_setting('ss_receipt.invoice')::uuid;
    raise exception 'issued receipt snapshot was deletable';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'SALE_RECEIPT_IMMUTABLE' then raise; end if;
  end;
end;
$$;

-- A caller-selected shop ID does not confer settings authority.
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
set local role authenticated;
do $$ begin
  begin
    perform public.save_document_settings(current_setting('ss_receipt.shop')::uuid, '{}'::jsonb);
    raise exception 'outsider document settings write accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end; $$;
reset role;
