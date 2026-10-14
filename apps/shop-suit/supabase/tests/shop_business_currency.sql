-- SET-D01: fully-paid issuance captures one immutable customer receipt.
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
      'receipt_settings','save_receipt_settings','get_location_sale_receipt','business_currency_settings','save_business_currency'
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
  if public.business_currency_settings(v_shop)->>'currency' <> 'EGP' or (public.business_currency_settings(v_shop)->>'locked')::boolean then raise exception 'new shop currency is not configurable EGP'; end if;
  begin perform public.save_business_currency(v_shop, 'KWD'); raise exception 'unsupported currency precision accepted'; exception when invalid_parameter_value then null; end;
  perform public.save_business_currency(v_shop,'USD');
  perform public.save_business_currency(v_shop,'USD');
  if (select count(*) from public.shop_currency_changes where shop_id=v_shop) <> 1 then raise exception 'currency retry duplicated audit'; end if;
  select id into v_location from public.shop_locations where shop_id = v_shop and is_default;
  select id into v_staff from public.shop_memberships where shop_id = v_shop and role = 'owner';
  perform public.save_receipt_settings(v_shop, 'Snapshot Barber', '10 Original Street',
    '01000000000', 'Thank you', 'thermal_80');
  perform public.save_shop_location(v_shop, v_location, 'Downtown', 'DT',
    '20 Branch Street', '02000000000');
  v_service := public.save_service(v_shop, null, 'Haircut', null, 75, 'amount', 5);
  v_invoice := public.save_pos_sale_draft(gen_random_uuid(), v_shop, v_location, null,
    v_staff, null, null, null, jsonb_build_array(jsonb_build_object(
      'item_type','service','source_id',v_service,'quantity',1)));
  if public.get_location_sale(v_shop,v_location,v_invoice)->>'currency' <> 'USD' then raise exception 'draft did not use business currency'; end if;
  perform public.save_business_currency(v_shop,'EUR');
  perform public.checkout_pos_sale(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    null, v_shop, v_location, v_invoice, 70, '2026-09-28 12:30:00+00', 'cash', 'COUNTER-1');

  v_snapshot := public.get_location_sale_receipt(v_shop, v_location, v_invoice);
  if v_snapshot->>'currency' <> 'EUR'
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

  if not (public.business_currency_settings(v_shop)->>'locked')::boolean then raise exception 'issued monetary document did not lock currency'; end if;
  begin perform public.save_business_currency(v_shop,'USD'); raise exception 'financial history allowed currency change'; exception when object_not_in_prerequisite_state then if sqlerrm <> 'SHOP_CURRENCY_LOCKED' then raise; end if; end;
  perform public.save_business_currency(v_shop,'EUR');
  if (select count(*) from public.shop_currency_changes where shop_id=v_shop) <> 2 then raise exception 'locked same-code retry changed audit'; end if;
  if public.get_location_sale_receipt(v_shop,v_location,v_invoice) <> v_snapshot then raise exception 'currency change attempt rewrote issued snapshot'; end if;
  perform public.save_receipt_settings(v_shop, 'Changed Later' , null, null, null, 'a4');
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
  perform public.save_receipt_settings(v_shop, 'Changed Before Payment', null,
    null, null, 'a4');
  perform public.record_location_customer_receipt(gen_random_uuid(), v_shop, v_location,
    v_customer, 70, '2026-09-29 12:30:00+00', 'card', 'CREDIT-1', null,
    jsonb_build_array(jsonb_build_object('invoice_id',v_credit_invoice,'amount',70)));
  v_snapshot := public.get_location_sale_receipt(v_shop, v_location, v_credit_invoice);
  if v_snapshot #>> '{business,name}' <> 'Identity At Issue'
    or v_snapshot ->> 'footer' <> 'Issue footer'
    or v_snapshot ->> 'paperSize' <> 'thermal_80'
    or v_snapshot #>> '{payments,0,method}' <> 'card' then
    raise exception 'settings changed after issue rewrote the finalized document: %', v_snapshot;
  end if;

  perform set_config('ss_currency.shop', v_shop::text, true);
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

-- Even a privileged repair cannot silently unlock or relabel financial history.
do $$ begin
  begin update public.shops set business_currency='USD' where id=current_setting('ss_currency.shop')::uuid; raise exception 'history bypassed currency guard'; exception when object_not_in_prerequisite_state then if sqlerrm <> 'SHOP_CURRENCY_LOCKED' then raise; end if; end;
  begin update public.shops set currency_locked_at=null where id=current_setting('ss_currency.shop')::uuid; raise exception 'history currency lock was mutable'; exception when object_not_in_prerequisite_state then if sqlerrm <> 'SHOP_CURRENCY_LOCKED' then raise; end if; end;
end; $$;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin
  begin perform public.save_business_currency(current_setting('ss_currency.shop')::uuid,'USD'); raise exception 'outsider currency mutation accepted'; exception when insufficient_privilege then if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if; end;
end; $$;
reset role;

-- First monetary history outside sales locks currency through the same row.
create temporary table currency_first_money_fixture(owner_id uuid, kind text);
insert into currency_first_money_fixture select gen_random_uuid(),kind from unnest(array['expense','cash','stock','purchase','payment']) kind;
grant select on currency_first_money_fixture to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id,owner_id::text || '@first-currency.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from currency_first_money_fixture;
set local role authenticated;
do $$ declare fixture record; shop uuid; location uuid; product uuid; vendor uuid; customer uuid; begin
  for fixture in select * from currency_first_money_fixture loop
    perform set_config('request.jwt.claim.sub',fixture.owner_id::text,true);
    shop := public.create_owner_shop('First monetary ' || fixture.kind,'team','mixed');
    perform public.save_business_currency(shop,'USD');
    select id into location from public.shop_locations where shop_id=shop and is_default;
    -- Each loop emulates a separate scoped request, not a previous tenant's GUC.
    perform set_config('shop.location_id',location::text,true);
    if fixture.kind='expense' then
      perform public.save_expense(gen_random_uuid(),shop,location,null,'Synthetic expense',10.23,'General','2026-10-14',null,null);
    elsif fixture.kind='cash' then
      perform public.open_cash_shift(gen_random_uuid(),shop,location,'main',10.23,'Synthetic opening');
    elsif fixture.kind='payment' then
      customer := public.save_customer(shop,null,'Synthetic credit customer',null,null,null,null);
      perform public.record_location_customer_receipt(gen_random_uuid(),shop,location,customer,10.23,clock_timestamp(),'cash','Synthetic credit',null,'[]'::jsonb);
    else
      product := public.save_product(shop,null,'Synthetic product','CUR-' || fixture.kind,null,20);
      if fixture.kind='stock' then
        perform public.adjust_stock(gen_random_uuid(),shop,product,1,10.23,'Synthetic opening stock');
      else
        vendor := public.save_vendor(shop,null,'Synthetic vendor',null,null,null,null,null,null);
        perform public.create_supplier_purchase(gen_random_uuid(),shop,vendor,'CUR-PURCHASE','2026-10-14',null,jsonb_build_array(jsonb_build_object('product_id',product,'quantity',1,'unit_cost',10.23)));
      end if;
    end if;
    if not (public.business_currency_settings(shop)->>'locked')::boolean or public.business_currency_settings(shop)->>'currency' <> 'USD' then raise exception 'first % did not freeze business currency',fixture.kind; end if;
    begin perform public.save_business_currency(shop,'EUR'); raise exception 'first % allowed relabeling',fixture.kind; exception when object_not_in_prerequisite_state then if sqlerrm <> 'SHOP_CURRENCY_LOCKED' then raise; end if; end;
  end loop;
end; $$;
reset role;

-- Active staff without settings.manage cannot change even to the existing code.
select set_config('request.jwt.claim.sub',owner_id::text,true) from shop_receipt_fixture;
create temporary table currency_employee_fixture(user_id uuid,profile_id uuid);
insert into currency_employee_fixture values(gen_random_uuid(),gen_random_uuid());
grant select on currency_employee_fixture to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select user_id,user_id::text || '@currency-employee.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now() from currency_employee_fixture;
insert into public.profiles(id,user_id,portal_id,display_name,email_snapshot)
select fixture.profile_id,fixture.user_id,shop.portal_id,'Synthetic employee',fixture.user_id::text || '@currency-employee.invalid'
from currency_employee_fixture fixture join public.shops shop on shop.id=current_setting('ss_currency.shop')::uuid;
insert into public.shop_memberships(shop_id,profile_id,role,status)
select current_setting('ss_currency.shop')::uuid,profile_id,'employee','active' from currency_employee_fixture;
select set_config('request.jwt.claim.sub',user_id::text,true) from currency_employee_fixture;
set local role authenticated;
do $$ begin
  begin perform public.save_business_currency(current_setting('ss_currency.shop')::uuid,'EUR'); raise exception 'unauthorized staff currency write accepted'; exception when insufficient_privilege then if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if; end;
end; $$;
reset role;
