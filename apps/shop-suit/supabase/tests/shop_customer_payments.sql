-- Focused SS-PAY-001 regression suite. The runner wraps this file in a
-- transaction and rolls back every synthetic fixture.
create temporary table shop_payment_fixture as
select gen_random_uuid() owner_a_id, gen_random_uuid() owner_b_id,
  gen_random_uuid() employee_id, gen_random_uuid() outsider_id;

insert into auth.users (id, email, encrypted_password, aud, role,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select id::uuid, id || '@ss-pay-001.invalid', 'x', 'authenticated', 'authenticated',
  '{}'::jsonb, '{}'::jsonb, now(), now()
from (select owner_a_id::text id from shop_payment_fixture union all
  select owner_b_id::text from shop_payment_fixture union all
  select employee_id::text from shop_payment_fixture union all
  select outsider_id::text from shop_payment_fixture) users;

do $$
declare v_function record;
begin
  for v_function in select p.oid, p.proname, p.prosecdef, p.proconfig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'payment_access', 'record_customer_receipt', 'reverse_customer_receipt',
      'refund_customer_receipt', 'list_outstanding_invoices', 'customer_statement',
      'save_sale_draft_with_due_date', 'checkout_customerless_sale'
    ])
  loop
    if not v_function.prosecdef
      or v_function.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', v_function.oid, 'execute')
      or has_function_privilege('anon', v_function.oid, 'execute') then
      raise exception 'unsafe payment wrapper: %', v_function.proname;
    end if;
  end loop;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'shop_private' and (p.proname like '%payment%'
      or p.proname like '%receipt%' or p.proname like '%statement%')
      and (has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('anon', p.oid, 'execute'))) then
    raise exception 'private payment implementation is browser-callable';
  end if;
  if has_table_privilege('authenticated', 'public.payments', 'insert')
    or has_table_privilege('authenticated', 'public.customer_payment_allocations', 'update')
    or has_table_privilege('authenticated', 'public.customer_payment_adjustments', 'delete')
    or has_table_privilege('authenticated', 'public.customer_payment_requests', 'select') then
    raise exception 'payment direct-write/request boundary is open';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_a_id::text, true) from shop_payment_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid; v_customer uuid; v_service uuid; v_invoice_one uuid; v_invoice_two uuid;
  v_receipt_one uuid; v_receipt_two uuid; v_multi uuid; v_allocation uuid;
  v_request uuid := gen_random_uuid(); v_statement jsonb; v_outstanding jsonb;
begin
  v_shop := public.create_owner_shop('Payment fixture A', 'pro', 'service'::public.business_mode);
  v_customer := public.save_customer(v_shop, null, 'Payment Customer', null, null, null, null);
  v_service := public.save_service(v_shop, null, 'Payment Service', null, 100, 'amount', 0);
  v_invoice_one := public.save_sale_draft_with_due_date(gen_random_uuid(), v_shop, null,
    v_customer, current_date - 1, 'Invoice one', jsonb_build_array(
      jsonb_build_object('item_type','service','source_id',v_service,'quantity',1)));
  perform public.issue_sale(gen_random_uuid(), v_shop, v_invoice_one);
  v_invoice_two := public.save_sale_draft_with_due_date(gen_random_uuid(), v_shop, null,
    v_customer, current_date + 10, 'Invoice two', jsonb_build_array(
      jsonb_build_object('item_type','service','source_id',v_service,'quantity',1)));
  perform public.issue_sale(gen_random_uuid(), v_shop, v_invoice_two);

  v_receipt_one := public.record_customer_receipt(v_request, v_shop, v_customer, 40,
    now(), 'cash', 'R-1', null,
    jsonb_build_array(jsonb_build_object('invoice_id',v_invoice_one,'amount',40)));
  if public.record_customer_receipt(v_request, v_shop, v_customer, 40, now(),
    'cash', 'R-1', null, jsonb_build_array(
      jsonb_build_object('invoice_id',v_invoice_one,'amount',40))) <> v_receipt_one then
    raise exception 'receipt retry changed identity';
  end if;
  if (public.get_sale(v_shop, v_invoice_one) ->> 'outstanding')::numeric <> 60 then
    raise exception 'partial receipt did not produce outstanding 60'; end if;
  v_receipt_two := public.record_customer_receipt(gen_random_uuid(), v_shop, v_customer, 60,
    now(), 'card', 'R-2', null,
    jsonb_build_array(jsonb_build_object('invoice_id',v_invoice_one,'amount',60)));
  if (public.get_sale(v_shop, v_invoice_one) ->> 'outstanding')::numeric <> 0 then
    raise exception 'second receipt did not settle invoice'; end if;

  v_multi := public.record_customer_receipt(gen_random_uuid(), v_shop, v_customer, 50,
    now(), 'bank_transfer', 'R-MULTI', null,
    jsonb_build_array(jsonb_build_object('invoice_id',v_invoice_two,'amount',30),
      jsonb_build_object('invoice_id',v_invoice_two,'amount',20)));
  if (public.get_sale(v_shop, v_invoice_two) ->> 'outstanding')::numeric <> 50
    or (select amount from public.customer_payment_allocations where payment_id = v_multi) <> 50 then
    raise exception 'normalized receipt allocation failed'; end if;

  begin
    perform public.record_customer_receipt(v_request, v_shop, v_customer, 1, now(),
      'cash', null, null, jsonb_build_array(
        jsonb_build_object('invoice_id',v_invoice_two,'amount',1)));
    raise exception 'conflicting receipt request accepted';
  exception when unique_violation then
    if sqlerrm <> 'PAYMENT_REQUEST_CONFLICT' then raise; end if;
  end;
  begin
    perform public.record_customer_receipt(gen_random_uuid(), v_shop, v_customer, 51,
      now(), 'cash', null, null, jsonb_build_array(
        jsonb_build_object('invoice_id',v_invoice_two,'amount',51)));
    raise exception 'overpayment accepted';
  exception when check_violation then
    if sqlerrm <> 'PAYMENT_OVERPAYMENT_REJECTED' then raise; end if;
  end;
  begin
    perform public.record_customer_receipt(gen_random_uuid(), v_shop, v_customer, 50,
      now(), 'cash', null, null, jsonb_build_array(
        jsonb_build_object('invoice_id',v_invoice_two,'amount',49)));
    raise exception 'unallocated receipt accepted';
  exception when check_violation then
    if sqlerrm <> 'UNALLOCATED_RECEIPT_REJECTED' then raise; end if;
  end;

  select id into v_allocation from public.customer_payment_allocations
    where payment_id = v_receipt_one;
  perform public.reverse_customer_receipt(gen_random_uuid(), v_shop, v_receipt_one,
    now(), 'Mistaken amount', jsonb_build_array(
      jsonb_build_object('allocation_id',v_allocation,'amount',10)));
  if (public.get_sale(v_shop, v_invoice_one) ->> 'outstanding')::numeric <> 10
    or (select amount from public.payments where id = v_receipt_one) <> 40 then
    raise exception 'partial reversal changed original or balance incorrectly'; end if;
  perform public.refund_customer_receipt(gen_random_uuid(), v_shop, v_receipt_one,
    now(), 'cash', 'REF-1', 'Customer refund', jsonb_build_array(
      jsonb_build_object('allocation_id',v_allocation,'amount',15)));
  if (public.get_sale(v_shop, v_invoice_one) ->> 'outstanding')::numeric <> 25
    or not exists (select 1 from public.payments where customer_kind = 'refund'
      and original_payment_id = v_receipt_one and payment_direction = 'out' and amount = 15) then
    raise exception 'partial refund did not create outbound event or balance'; end if;
  begin
    perform public.reverse_customer_receipt(gen_random_uuid(), v_shop, v_receipt_one,
      now(), 'Too much', jsonb_build_array(
        jsonb_build_object('allocation_id',v_allocation,'amount',16)));
    raise exception 'adjustment ceiling exceeded';
  exception when check_violation then
    if sqlerrm <> 'PAYMENT_ADJUSTMENT_EXCEEDS_EFFECTIVE_AMOUNT' then raise; end if;
  end;
  perform public.reverse_customer_receipt(gen_random_uuid(), v_shop, v_receipt_one,
    now(), 'Reverse remainder', jsonb_build_array(
      jsonb_build_object('allocation_id',v_allocation,'amount',15)));
  if (select allocation.amount - coalesce(sum(adjustment.amount), 0)
      from public.customer_payment_allocations allocation
      left join public.customer_payment_adjustments adjustment
        on adjustment.original_allocation_id = allocation.id
      where allocation.id = v_allocation group by allocation.amount) <> 0
    or (public.get_sale(v_shop, v_invoice_one) ->> 'outstanding')::numeric <> 40 then
    raise exception 'full combined adjustment failed'; end if;

  v_statement := public.customer_statement(v_shop, v_customer, 1, 100);
  if (v_statement ->> 'outstanding')::numeric <> 90
    or (select (event ->> 'running_balance')::numeric from jsonb_array_elements(v_statement -> 'items') event
        order by event ->> 'event_at' desc, event ->> 'event_id' desc limit 1) <> 90 then
    raise exception 'statement did not reconcile: %', v_statement; end if;
  v_outstanding := public.list_outstanding_invoices(v_shop, v_customer, true, 1, 20);
  if (v_outstanding ->> 'total')::integer <> 1
    or not ((v_outstanding -> 'items' -> 0 ->> 'overdue')::boolean) then
    raise exception 'overdue query failed: %', v_outstanding; end if;

  perform set_config('ss_pay.shop_a', v_shop::text, true);
  perform set_config('ss_pay.customer_a', v_customer::text, true);
  perform set_config('ss_pay.service_a', v_service::text, true);
  perform set_config('ss_pay.invoice_two', v_invoice_two::text, true);
  perform set_config('ss_pay.receipt_two', v_receipt_two::text, true);
end;
$$;
reset role;

-- One receipt can cover distinct invoices; a full outbound refund restores both.
select set_config('request.jwt.claim.sub', owner_a_id::text, true) from shop_payment_fixture;
set local role authenticated;
do $$
declare v_first uuid; v_second uuid; v_receipt uuid; v_parts jsonb; v_refund uuid;
begin
  v_first := public.save_sale_draft(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
    null, current_setting('ss_pay.customer_a')::uuid, null, jsonb_build_array(
      jsonb_build_object('item_type','service','source_id',current_setting('ss_pay.service_a')::uuid,'quantity',1)));
  v_second := public.save_sale_draft(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
    null, current_setting('ss_pay.customer_a')::uuid, null, jsonb_build_array(
      jsonb_build_object('item_type','service','source_id',current_setting('ss_pay.service_a')::uuid,'quantity',1)));
  perform public.issue_sale(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid, v_first);
  perform public.issue_sale(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid, v_second);
  v_receipt := public.record_customer_receipt(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
    current_setting('ss_pay.customer_a')::uuid, 60, now(), 'card', 'TWO-DOC', null,
    jsonb_build_array(jsonb_build_object('invoice_id',v_first,'amount',25),
      jsonb_build_object('invoice_id',v_second,'amount',35)));
  if (public.get_sale(current_setting('ss_pay.shop_a')::uuid, v_first)->>'outstanding')::numeric <> 75
    or (public.get_sale(current_setting('ss_pay.shop_a')::uuid, v_second)->>'outstanding')::numeric <> 65
    or (select count(*) from public.customer_payment_allocations where payment_id = v_receipt) <> 2 then
    raise exception 'distinct-invoice receipt failed';
  end if;
  select jsonb_agg(jsonb_build_object('allocation_id',id,'amount',amount)) into v_parts
    from public.customer_payment_allocations where payment_id = v_receipt;
  v_refund := public.refund_customer_receipt(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
    v_receipt, now(), 'bank_transfer', 'FULL-REFUND', 'Full refund', v_parts);
  if (select amount from public.payments where id = v_refund) <> 60
    or (public.get_sale(current_setting('ss_pay.shop_a')::uuid, v_first)->>'outstanding')::numeric <> 100
    or (public.get_sale(current_setting('ss_pay.shop_a')::uuid, v_second)->>'outstanding')::numeric <> 100 then
    raise exception 'full multi-invoice refund failed';
  end if;
  v_receipt := public.record_customer_receipt(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
    current_setting('ss_pay.customer_a')::uuid, 40, now(), 'cash', 'TWO-DOC-REV', null,
    jsonb_build_array(jsonb_build_object('invoice_id',v_first,'amount',15),
      jsonb_build_object('invoice_id',v_second,'amount',25)));
  select jsonb_agg(jsonb_build_object('allocation_id',id,'amount',amount)) into v_parts
    from public.customer_payment_allocations where payment_id = v_receipt;
  v_refund := public.reverse_customer_receipt(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
    v_receipt, now(), 'Full correction', v_parts);
  if (select count(*) from public.customer_payment_adjustments
      where adjustment_group_id = v_refund and kind = 'reversal') <> 2
    or (public.get_sale(current_setting('ss_pay.shop_a')::uuid, v_first)->>'outstanding')::numeric <> 100
    or (public.get_sale(current_setting('ss_pay.shop_a')::uuid, v_second)->>'outstanding')::numeric <> 100 then
    raise exception 'full multi-invoice reversal failed';
  end if;
  begin
    perform public.record_customer_receipt(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
      current_setting('ss_pay.customer_a')::uuid, 0.01, now(), 'cash', null, null,
      jsonb_build_array(jsonb_build_object('invoice_id',v_first,'amount',0.005),
        jsonb_build_object('invoice_id',v_first,'amount',0.005)));
    raise exception 'sub-cent allocation accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'INVALID_PAYMENT_ALLOCATION' then raise; end if;
  end;
end;
$$;
reset role;

-- Customerless checkout is one stock/sale/payment transaction and rejects any
-- correction that would create an anonymous receivable.
select set_config('request.jwt.claim.sub', owner_a_id::text, true) from shop_payment_fixture;
set local role authenticated;
do $$
declare v_sale uuid; v_payment uuid; v_allocation uuid; v_request uuid := gen_random_uuid();
begin
  v_sale := public.save_sale_draft_with_due_date(gen_random_uuid(),
    current_setting('ss_pay.shop_a')::uuid, null, null, null, null,
    jsonb_build_array(jsonb_build_object('item_type','service','source_id',
      current_setting('ss_pay.service_a')::uuid,'quantity',1)));
  begin
    perform public.checkout_customerless_sale(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
      v_sale, 99, now(), 'card', null);
    raise exception 'partial customerless checkout accepted';
  exception when check_violation then
    if sqlerrm <> 'CUSTOMERLESS_CHECKOUT_REQUIRES_FULL_PAYMENT' then raise; end if;
  end;
  if (select status from public.invoices where id = v_sale) <> 'draft'
    or exists (select 1 from public.payments where invoice_id = v_sale) then
    raise exception 'failed checkout left partial effects'; end if;
  if public.checkout_customerless_sale(v_request, current_setting('ss_pay.shop_a')::uuid,
      v_sale, 100, now(), 'card', 'POS-1') <> v_sale
    or public.checkout_customerless_sale(v_request, current_setting('ss_pay.shop_a')::uuid,
      v_sale, 100, now(), 'card', 'POS-1') <> v_sale then
    raise exception 'customerless checkout retry failed'; end if;
  select payment.id, allocation.id into v_payment, v_allocation
  from public.payments payment join public.customer_payment_allocations allocation
    on allocation.payment_id = payment.id where payment.invoice_id = v_sale;
  if (public.get_sale(current_setting('ss_pay.shop_a')::uuid, v_sale)
      ->> 'outstanding')::numeric <> 0 or v_payment is null then
    raise exception 'customerless checkout not fully settled'; end if;
  begin
    perform public.reverse_customer_receipt(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
      v_payment, now(), 'Deferred correction', jsonb_build_array(
        jsonb_build_object('allocation_id',v_allocation,'amount',1)));
    raise exception 'customerless reversal accepted';
  exception when check_violation then
    if sqlerrm <> 'CUSTOMERLESS_PAYMENT_ADJUSTMENT_DEFERRED' then raise; end if;
  end;
end;
$$;
reset role;

-- Product checkout rolls stock and payment effects back together on a bad amount.
select set_config('request.jwt.claim.sub', owner_a_id::text, true) from shop_payment_fixture;
set local role authenticated;
do $$
declare v_product uuid; v_sale uuid; v_request uuid := gen_random_uuid(); v_paid_at timestamptz := now();
  v_first_result uuid; v_second_result uuid;
begin
  perform public.set_shop_business_mode(current_setting('ss_pay.shop_a')::uuid, 'mixed');
  v_product := public.save_product(current_setting('ss_pay.shop_a')::uuid,
    null, 'Checkout product', 'PAY-CHECKOUT', null, 10);
  perform public.adjust_stock(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
    v_product, 3, 5, 'Checkout stock');
  v_sale := public.save_sale_draft(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
    null, null, null, jsonb_build_array(jsonb_build_object('item_type','product',
      'source_id',v_product,'quantity',2)));
  begin
    perform public.checkout_customerless_sale(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
      v_sale, 19, v_paid_at, 'cash', null);
    raise exception 'product partial checkout accepted';
  exception when check_violation then
    if sqlerrm <> 'CUSTOMERLESS_CHECKOUT_REQUIRES_FULL_PAYMENT' then raise; end if;
  end;
  if (select status from public.invoices where id = v_sale) <> 'draft'
    or (select quantity_on_hand from public.product_stock where product_id = v_product) <> 3
    or exists (select 1 from public.inventory_movements where reference_id = v_sale)
    or exists (select 1 from public.payments where invoice_id = v_sale) then
    raise exception 'failed product checkout left effects';
  end if;
  v_first_result := public.checkout_customerless_sale(v_request, current_setting('ss_pay.shop_a')::uuid,
    v_sale, 20, v_paid_at, 'cash', null);
  v_second_result := public.checkout_customerless_sale(v_request, current_setting('ss_pay.shop_a')::uuid,
    v_sale, 20, v_paid_at, 'cash', null);
  if v_first_result <> v_sale or v_second_result <> v_sale
    or (select quantity_on_hand from public.product_stock where product_id = v_product) <> 1
    or (select sum(quantity_change) from public.inventory_movements where reference_id = v_sale) <> -2
    or (select count(*) from public.payments where invoice_id = v_sale) <> 1
    or (public.get_sale(current_setting('ss_pay.shop_a')::uuid, v_sale)->>'outstanding')::numeric <> 0 then
    raise exception 'product checkout mismatch: results %/% vs %, stock %, movements %, payments %, outstanding %',
      v_first_result, v_second_result, v_sale,
      (select quantity_on_hand from public.product_stock where product_id = v_product),
      (select sum(quantity_change) from public.inventory_movements where reference_id = v_sale),
      (select count(*) from public.payments where invoice_id = v_sale),
      (public.get_sale(current_setting('ss_pay.shop_a')::uuid, v_sale)->>'outstanding');
  end if;
end;
$$;
reset role;

-- Cross-shop references fail inside the authoritative command.
select set_config('request.jwt.claim.sub', owner_b_id::text, true) from shop_payment_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_customer uuid;
begin
  v_shop := public.create_owner_shop('Payment fixture B', 'pro', 'service'::public.business_mode);
  v_customer := public.save_customer(v_shop, null, 'Foreign customer', null, null, null, null);
  perform set_config('ss_pay.shop_b', v_shop::text, true);
  perform set_config('ss_pay.customer_b', v_customer::text, true);
end;
$$;
reset role;
select set_config('request.jwt.claim.sub', owner_a_id::text, true) from shop_payment_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.record_customer_receipt(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
      current_setting('ss_pay.customer_b')::uuid, 1, now(), 'cash', null, null,
      jsonb_build_array(jsonb_build_object('invoice_id',current_setting('ss_pay.invoice_two')::uuid,'amount',1)));
    raise exception 'foreign customer accepted';
  exception when others then if sqlerrm <> 'CUSTOMER_NOT_FOUND' then raise; end if; end;
  begin
    perform public.record_customer_receipt(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
      current_setting('ss_pay.customer_a')::uuid, 1, now(), 'cash', null, null,
      jsonb_build_array(jsonb_build_object('invoice_id',gen_random_uuid(),'amount',1)));
    raise exception 'foreign/missing invoice accepted';
  exception when check_violation then
    if sqlerrm <> 'PAYMENT_INVOICE_NOT_ELIGIBLE' then raise; end if; end;
end $$;
reset role;

-- Delegated permissions are distinct; view-only cannot write, explicitly
-- authorized staff can receive, and suspension/outsider access fails.
do $$
declare v_profile uuid; v_membership uuid; v_role uuid;
begin
  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select employee_id, shop.portal_id, 'Payment employee', 'employee@ss-pay.invalid'
  from shop_payment_fixture f join public.shops shop on shop.id = current_setting('ss_pay.shop_a')::uuid
  returning id into v_profile;
  insert into public.shop_memberships (shop_id, profile_id, role)
  values (current_setting('ss_pay.shop_a')::uuid, v_profile, 'employee') returning id into v_membership;
  insert into public.roles (shop_id, name) values (current_setting('ss_pay.shop_a')::uuid,
    'Payment operator') returning id into v_role;
  insert into public.role_permissions (role_id, permission_id)
  select v_role, permission.id from public.permissions permission join public.shops shop
    on shop.portal_id = permission.portal_id where shop.id = current_setting('ss_pay.shop_a')::uuid
    and permission.key in ('payments.view', 'payments.receive');
  insert into public.membership_roles values (v_membership, v_role);
  perform set_config('ss_pay.employee_membership', v_membership::text, true);
end $$;
select set_config('request.jwt.claim.sub', employee_id::text, true) from shop_payment_fixture;
set local role authenticated;
do $$ begin
  if not coalesce((select can_receive from public.payment_access(current_setting('ss_pay.shop_a')::uuid)), false) then
    raise exception 'authorized payment staff did not receive payments.receive';
  end if;
  perform public.record_customer_receipt(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
    current_setting('ss_pay.customer_a')::uuid, 1, now(), 'cash', null, null,
    jsonb_build_array(jsonb_build_object('invoice_id',current_setting('ss_pay.invoice_two')::uuid,'amount',1)));
  begin
    perform public.reverse_customer_receipt(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
      current_setting('ss_pay.receipt_two')::uuid, now(), 'No permission', '[]'::jsonb);
    raise exception 'receive-only staff reversed payment';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if; end;
end $$;
reset role;
update public.shop_memberships set status = 'suspended'
where id = current_setting('ss_pay.employee_membership')::uuid;
select set_config('request.jwt.claim.sub', employee_id::text, true) from shop_payment_fixture;
set local role authenticated;
do $$ begin
  if exists (select 1 from public.payment_access(current_setting('ss_pay.shop_a')::uuid)) then
    raise exception 'suspended member accessed payments';
  end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', outsider_id::text, true) from shop_payment_fixture;
set local role authenticated;
do $$ begin
  begin perform public.customer_statement(current_setting('ss_pay.shop_a')::uuid,
    current_setting('ss_pay.customer_a')::uuid, 1, 20);
    raise exception 'outsider read statement';
  exception when insufficient_privilege then if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if; end;
end $$;
reset role;

-- Closed periods reject every effective-money-date command before mutation.
insert into public.accounting_periods (shop_id, period_start, period_end, is_closed)
values (current_setting('ss_pay.shop_a')::uuid, current_date - 30, current_date - 20, true);
select set_config('request.jwt.claim.sub', owner_a_id::text, true) from shop_payment_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.record_customer_receipt(gen_random_uuid(), current_setting('ss_pay.shop_a')::uuid,
      current_setting('ss_pay.customer_a')::uuid, 1, current_date - 25, 'cash', null, null,
      jsonb_build_array(jsonb_build_object('invoice_id',current_setting('ss_pay.invoice_two')::uuid,'amount',1)));
    raise exception 'closed-period receipt accepted';
  exception when others then if sqlerrm <> 'ACCOUNTING_PERIOD_CLOSED' then raise; end if; end;
end $$;
reset role;
