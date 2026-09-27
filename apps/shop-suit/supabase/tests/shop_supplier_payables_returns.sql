-- Focused SS-PUR-002 regression suite. The runner wraps this file in a
-- transaction and rolls every synthetic fixture back.
create temporary table supplier_payable_fixture as
select gen_random_uuid() owner_a_id, gen_random_uuid() owner_b_id,
  gen_random_uuid() employee_id, gen_random_uuid() outsider_id;

insert into auth.users (id, email, encrypted_password, aud, role,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select id::uuid, id || '@ss-pur-002.invalid', 'x', 'authenticated', 'authenticated',
  '{}'::jsonb, '{}'::jsonb, now(), now()
from (select owner_a_id::text id from supplier_payable_fixture union all
  select owner_b_id::text from supplier_payable_fixture union all
  select employee_id::text from supplier_payable_fixture union all
  select outsider_id::text from supplier_payable_fixture) users;

do $$
declare v_function record;
begin
  for v_function in select p.oid, p.proname, p.prosecdef, p.proconfig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'supplier_access', 'save_vendor', 'archive_vendor', 'list_vendors',
      'list_purchases', 'get_purchase', 'record_supplier_payment',
      'reverse_supplier_payment', 'record_supplier_credit', 'record_purchase_return'
    ])
  loop
    if not v_function.prosecdef
      or v_function.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', v_function.oid, 'execute')
      or has_function_privilege('anon', v_function.oid, 'execute') then
      raise exception 'unsafe supplier wrapper: %', v_function.proname;
    end if;
  end loop;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'shop_private' and (p.proname like '%supplier%'
      or p.proname like '%purchase_payable%' or p.proname like '%purchase_return%')
      and (has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('anon', p.oid, 'execute'))) then
    raise exception 'private supplier implementation is browser-callable';
  end if;
  if has_table_privilege('authenticated', 'public.payments', 'insert')
    or has_table_privilege('authenticated', 'public.supplier_payment_allocations', 'update')
    or has_table_privilege('authenticated', 'public.supplier_payment_reversals', 'delete')
    or has_table_privilege('authenticated', 'public.supplier_credits', 'insert')
    or has_table_privilege('authenticated', 'public.purchase_returns', 'update')
    or has_table_privilege('authenticated', 'public.supplier_operation_requests', 'select') then
    raise exception 'supplier direct-write/request boundary is open';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_a_id::text, true)
from supplier_payable_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid; v_vendor uuid; v_product uuid; v_purchase uuid; v_item uuid;
  v_payment_one uuid; v_payment_two uuid; v_allocation uuid; v_reversal uuid;
  v_return uuid; v_credit uuid; v_request uuid := gen_random_uuid();
  v_detail jsonb; v_list jsonb; v_stock numeric;
begin
  v_shop := public.create_owner_shop('Supplier payable fixture A', 'pro', 'product');
  v_product := public.save_product(v_shop, null, 'Returnable item', 'PUR-RET-1', null, 20);
  v_vendor := public.save_vendor(v_shop, null, 'Original supplier', 'Contact',
    '01000000000', 'supplier@ss-pur.invalid', 'Address', 'TAX-PUR', 'Note');
  v_purchase := public.create_supplier_purchase(gen_random_uuid(), v_shop, v_vendor,
    'SUP-100', current_date, 'Payable purchase', jsonb_build_array(
      jsonb_build_object('product_id', v_product, 'quantity', 10, 'unit_cost', 10)));
  select id into v_item from public.vendor_invoice_items where vendor_invoice_id = v_purchase;

  perform public.save_vendor(v_shop, v_vendor, 'Renamed supplier', 'New contact',
    null, null, null, null, null);
  if (select vendor_name_snapshot from public.vendor_invoices where id = v_purchase)
      <> 'Original supplier' then
    raise exception 'supplier snapshot changed with supplier edit'; end if;
  v_list := public.list_vendors(v_shop, 'Renamed', true, 1, 20);
  if (v_list ->> 'total')::integer <> 1
    or (v_list -> 'items' -> 0 ->> 'payable')::numeric <> 100 then
    raise exception 'supplier search/payable failed: %', v_list; end if;

  v_payment_one := public.record_supplier_payment(v_request, v_shop, v_vendor, 40,
    now(), 'cash', 'PAY-1', 'First part', jsonb_build_array(
      jsonb_build_object('vendor_invoice_id', v_purchase, 'amount', 40)));
  if public.record_supplier_payment(v_request, v_shop, v_vendor, 40,
      now(), 'cash', 'PAY-1', 'First part', jsonb_build_array(
        jsonb_build_object('vendor_invoice_id', v_purchase, 'amount', 40))) <> v_payment_one
    or (select count(*) from public.payments where id = v_payment_one) <> 1
    or shop_private.purchase_payable(v_purchase) <> 60 then
    raise exception 'supplier payment retry/reconciliation failed'; end if;
  v_payment_two := public.record_supplier_payment(gen_random_uuid(), v_shop, v_vendor, 20,
    now(), 'bank_transfer', 'PAY-2', null, jsonb_build_array(
      jsonb_build_object('vendor_invoice_id', v_purchase, 'amount', 20)));
  if shop_private.purchase_payable(v_purchase) <> 40 then
    raise exception 'multiple partial supplier payments failed'; end if;
  begin
    perform public.record_supplier_payment(gen_random_uuid(), v_shop, v_vendor, 41,
      now(), 'cash', null, null, jsonb_build_array(
        jsonb_build_object('vendor_invoice_id', v_purchase, 'amount', 41)));
    raise exception 'supplier overpayment accepted';
  exception when check_violation then
    if sqlerrm <> 'SUPPLIER_PAYMENT_OVERPAYMENT_REJECTED' then raise; end if;
  end;
  begin
    perform public.record_supplier_payment(gen_random_uuid(), v_shop, v_vendor, 10,
      now(), 'cash', null, null, jsonb_build_array(
        jsonb_build_object('vendor_invoice_id', v_purchase, 'amount', 9)));
    raise exception 'unallocated supplier payment accepted';
  exception when check_violation then
    if sqlerrm <> 'UNALLOCATED_SUPPLIER_PAYMENT_REJECTED' then raise; end if;
  end;

  select id into v_allocation from public.supplier_payment_allocations
  where payment_id = v_payment_one;
  v_request := gen_random_uuid();
  v_reversal := public.reverse_supplier_payment(v_request, v_shop, v_payment_one,
    now(), 'Correct amount', 'REV-1', jsonb_build_array(
      jsonb_build_object('allocation_id', v_allocation, 'amount', 10)));
  if public.reverse_supplier_payment(v_request, v_shop, v_payment_one,
      now(), 'Correct amount', 'REV-1', jsonb_build_array(
        jsonb_build_object('allocation_id', v_allocation, 'amount', 10))) <> v_reversal
    or shop_private.purchase_payable(v_purchase) <> 50
    or (select amount from public.payments where id = v_payment_one) <> 40 then
    raise exception 'supplier reversal retry/history failed'; end if;

  v_request := gen_random_uuid();
  v_return := public.record_purchase_return(v_request, v_shop, v_purchase, now(),
    'Damaged on receipt', 'RET-1', jsonb_build_array(
      jsonb_build_object('vendor_invoice_item_id', v_item, 'quantity', 2)));
  if public.record_purchase_return(v_request, v_shop, v_purchase, now(),
      'Damaged on receipt', 'RET-1', jsonb_build_array(
        jsonb_build_object('vendor_invoice_item_id', v_item, 'quantity', 2))) <> v_return
    or shop_private.purchase_payable(v_purchase) <> 30
    or (select count(*) from public.purchase_returns where id = v_return) <> 1
    or (select count(*) from public.supplier_credits where purchase_return_id = v_return) <> 1
    or (select sum(quantity_change) from public.inventory_movements
        where reference_id = v_return) <> -2 then
    raise exception 'physical return/credit retry failed'; end if;

  v_credit := public.record_supplier_credit(gen_random_uuid(), v_shop, v_vendor,
    v_purchase, 5, now(), 'Concession for consumed units', 'CR-1');
  if shop_private.purchase_payable(v_purchase) <> 25
    or (select purchase_return_id from public.supplier_credits where id = v_credit) is not null then
    raise exception 'financial-only supplier credit failed'; end if;
  begin
    perform public.record_supplier_credit(gen_random_uuid(), v_shop, v_vendor,
      v_purchase, 26, now(), 'Too much credit', null);
    raise exception 'excess supplier credit accepted';
  exception when check_violation then
    if sqlerrm <> 'SUPPLIER_CREDIT_EXCEEDS_PAYABLE' then raise; end if;
  end;

  -- Consume seven of the eight remaining units. Only one remains physically
  -- traceable to this receipt, so a two-unit physical return must fail cleanly.
  perform public.adjust_stock(gen_random_uuid(), v_shop, v_product, -7, null, 'Consumed stock');
  select quantity_on_hand into v_stock from public.product_stock where product_id = v_product;
  begin
    perform public.record_purchase_return(gen_random_uuid(), v_shop, v_purchase, now(),
      'Unavailable units', null, jsonb_build_array(
        jsonb_build_object('vendor_invoice_item_id', v_item, 'quantity', 2)));
    raise exception 'consumed stock was physically returned';
  exception when check_violation then
    if sqlerrm <> 'PURCHASE_RETURN_STOCK_UNAVAILABLE' then raise; end if;
  end;
  if (select quantity_on_hand from public.product_stock where product_id = v_product) <> v_stock
    or (select count(*) from public.purchase_returns where vendor_invoice_id = v_purchase) <> 1 then
    raise exception 'failed consumed-stock return left partial effects'; end if;

  v_detail := public.get_purchase(v_shop, v_purchase);
  if (v_detail ->> 'payable')::numeric <> 25
    or jsonb_array_length(v_detail -> 'paymentEvents') <> 3
    or jsonb_array_length(v_detail -> 'credits') <> 2
    or jsonb_array_length(v_detail -> 'returns') <> 1 then
    raise exception 'purchase drill-through does not reconcile: %', v_detail; end if;
  v_list := public.list_purchases(v_shop, 'SUP-100', v_vendor, 'posted',
    'partial', current_date, current_date, 1, 20);
  if (v_list ->> 'total')::integer <> 1
    or (v_list -> 'items' -> 0 ->> 'payable')::numeric <> 25 then
    raise exception 'server purchase filters failed: %', v_list; end if;

  perform public.record_supplier_payment(gen_random_uuid(), v_shop, v_vendor, 25,
    now(), 'cheque', 'PAY-FINAL', 'Full settlement', jsonb_build_array(
      jsonb_build_object('vendor_invoice_id', v_purchase, 'amount', 25)));
  if shop_private.purchase_payable(v_purchase) <> 0
    or (public.get_purchase(v_shop, v_purchase) ->> 'settlementState') <> 'paid' then
    raise exception 'full supplier settlement failed'; end if;

  perform public.archive_vendor(v_shop, v_vendor);
  if not exists (select 1 from public.vendors where id = v_vendor
      and not is_active and archived_at is not null)
    or (public.get_purchase(v_shop, v_purchase) ->> 'vendorNameSnapshot') <> 'Original supplier' then
    raise exception 'supplier archive destroyed history'; end if;

  perform set_config('ss_pur.shop_a', v_shop::text, true);
  perform set_config('ss_pur.vendor_a', v_vendor::text, true);
  perform set_config('ss_pur.purchase_a', v_purchase::text, true);
  perform set_config('ss_pur.payment_a', v_payment_two::text, true);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', owner_b_id::text, true)
from supplier_payable_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_vendor uuid; v_product uuid; v_purchase uuid;
begin
  v_shop := public.create_owner_shop('Supplier payable fixture B', 'pro', 'product');
  v_product := public.save_product(v_shop, null, 'Foreign item', 'PUR-FOREIGN', null, 10);
  v_vendor := public.save_vendor(v_shop, null, 'Foreign supplier', null, null, null, null, null, null);
  v_purchase := public.create_supplier_purchase(gen_random_uuid(), v_shop, v_vendor,
    'FOREIGN-1', current_date, null, jsonb_build_array(
      jsonb_build_object('product_id', v_product, 'quantity', 1, 'unit_cost', 10)));
  perform set_config('ss_pur.shop_b', v_shop::text, true);
  perform set_config('ss_pur.vendor_b', v_vendor::text, true);
  perform set_config('ss_pur.purchase_b', v_purchase::text, true);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', owner_a_id::text, true)
from supplier_payable_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.record_supplier_payment(gen_random_uuid(), current_setting('ss_pur.shop_a')::uuid,
      current_setting('ss_pur.vendor_b')::uuid, 1, now(), 'cash', null, null,
      jsonb_build_array(jsonb_build_object('vendor_invoice_id',
        current_setting('ss_pur.purchase_b')::uuid, 'amount', 1)));
    raise exception 'cross-shop supplier payment accepted';
  exception when others then if sqlerrm <> 'VENDOR_NOT_FOUND' then raise; end if; end;
  begin
    perform public.get_purchase(current_setting('ss_pur.shop_b')::uuid,
      current_setting('ss_pur.purchase_b')::uuid);
    raise exception 'cross-shop purchase read accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if; end;
end $$;
reset role;

-- Delegated view and money permissions are independent; suspension and outsider
-- access are denied by the authoritative membership checks.
do $$
declare v_profile uuid; v_membership uuid; v_role uuid;
begin
  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select employee_id, shop.portal_id, 'Supplier employee', 'employee@ss-pur.invalid'
  from supplier_payable_fixture f join public.shops shop
    on shop.id = current_setting('ss_pur.shop_a')::uuid returning id into v_profile;
  insert into public.shop_memberships (shop_id, profile_id, role)
  values (current_setting('ss_pur.shop_a')::uuid, v_profile, 'employee') returning id into v_membership;
  insert into public.roles (shop_id, name) values (current_setting('ss_pur.shop_a')::uuid,
    'Supplier payment operator') returning id into v_role;
  insert into public.role_permissions (role_id, permission_id)
  select v_role, permission.id from public.permissions permission join public.shops shop
    on shop.portal_id = permission.portal_id
  where shop.id = current_setting('ss_pur.shop_a')::uuid
    and permission.key in ('vendor_invoices.view', 'supplier_payments.record');
  insert into public.membership_roles values (v_membership, v_role);
  perform set_config('ss_pur.employee_membership', v_membership::text, true);
end $$;
select set_config('request.jwt.claim.sub', employee_id::text, true)
from supplier_payable_fixture;
set local role authenticated;
do $$ begin
  if (public.list_purchases(current_setting('ss_pur.shop_a')::uuid) ->> 'total')::integer <> 1 then
    raise exception 'authorized employee cannot read purchases'; end if;
  begin
    perform public.record_supplier_credit(gen_random_uuid(), current_setting('ss_pur.shop_a')::uuid,
      current_setting('ss_pur.vendor_a')::uuid, current_setting('ss_pur.purchase_a')::uuid,
      1, now(), 'No permission', null);
    raise exception 'payment-only employee recorded credit';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if; end;
end $$;
reset role;
update public.shop_memberships set status = 'suspended'
where id = current_setting('ss_pur.employee_membership')::uuid;
select set_config('request.jwt.claim.sub', employee_id::text, true)
from supplier_payable_fixture;
set local role authenticated;
do $$ begin
  begin perform public.list_purchases(current_setting('ss_pur.shop_a')::uuid);
    raise exception 'suspended employee read purchases';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', outsider_id::text, true)
from supplier_payable_fixture;
set local role authenticated;
do $$ begin
  begin perform public.list_vendors(current_setting('ss_pur.shop_a')::uuid);
    raise exception 'outsider read suppliers';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if; end;
end $$;
reset role;

-- Every effective financial/stock date respects closed periods.
insert into public.accounting_periods (shop_id, period_start, period_end, is_closed)
values (current_setting('ss_pur.shop_a')::uuid, current_date - 30, current_date - 20, true);
select set_config('request.jwt.claim.sub', owner_a_id::text, true)
from supplier_payable_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.record_supplier_credit(gen_random_uuid(), current_setting('ss_pur.shop_a')::uuid,
      current_setting('ss_pur.vendor_a')::uuid, current_setting('ss_pur.purchase_a')::uuid,
      1, current_date - 25, 'Closed credit', null);
    raise exception 'closed-period supplier credit accepted';
  exception when others then if sqlerrm <> 'ACCOUNTING_PERIOD_CLOSED' then raise; end if; end;
end $$;
reset role;
