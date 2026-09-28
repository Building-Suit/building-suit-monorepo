-- SS-CASH-001: idempotent shifts, payment linkage, reconciliation, and isolation.
create temporary table shop_cash_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() cashier_id;
grant select on shop_cash_fixture to authenticated;

insert into auth.users (id,email,encrypted_password,aud,role,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id, 'owner@ss-cash.invalid', 'x', 'authenticated', 'authenticated', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now() from shop_cash_fixture
union all
select cashier_id, 'cashier@ss-cash.invalid', 'x', 'authenticated', 'authenticated', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now() from shop_cash_fixture;

do $$
declare function_row record;
begin
  for function_row in select procedure.oid, procedure.proname, procedure.prosecdef,
    procedure.proconfig from pg_proc procedure join pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public' and procedure.proname = any(array[
      'open_cash_shift','record_cash_movement','close_cash_shift','cash_shift_dashboard'
    ])
  loop
    if not function_row.prosecdef
      or function_row.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', function_row.oid, 'execute')
      or has_function_privilege('anon', function_row.oid, 'execute') then
      raise exception 'unsafe cash shift wrapper: %', function_row.proname;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.cash_drawer_events', 'select')
    or has_table_privilege('authenticated', 'public.cash_shift_requests', 'select')
    or has_table_privilege('authenticated', 'public.cash_sessions', 'insert')
    or has_table_privilege('authenticated', 'public.cash_sessions', 'update') then
    raise exception 'cash shift internals expose direct browser mutation';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true) from shop_cash_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_location uuid; v_branch uuid; v_session uuid; v_retry uuid;
  v_open_request uuid := gen_random_uuid(); v_customer uuid; v_service uuid;
  v_invoice uuid; v_card_invoice uuid; v_payment uuid; v_allocation uuid;
  v_dashboard jsonb; v_close uuid := gen_random_uuid();
  v_movement_request uuid := gen_random_uuid();
begin
  v_shop := public.create_owner_shop('Cash fixture', 'pro', 'service');
  select id into v_location from public.shop_locations where shop_id = v_shop and is_default;
  v_branch := public.save_shop_location(v_shop, null, 'Other branch', 'OTHER', null, null);
  v_session := public.open_cash_shift(v_open_request, v_shop, v_location, 'main', 100, 'Opening float');
  v_retry := public.open_cash_shift(v_open_request, v_shop, v_location, 'main', 100, 'Opening float');
  if v_retry <> v_session then raise exception 'open retry created another shift'; end if;
  begin
    perform public.open_cash_shift(gen_random_uuid(), v_shop, v_location, 'main', 100, null);
    raise exception 'conflicting shift opened for one register';
  exception when unique_violation then
    if sqlerrm not like '%CASH_SHIFT_ALREADY_OPEN%' then raise; end if;
  end;

  v_customer := public.save_customer(v_shop, null, 'Drawer customer', null, null, null, null);
  v_service := public.save_service(v_shop, null, 'Drawer service', null, 70, 'amount', 0);
  v_invoice := public.save_pos_sale_draft(gen_random_uuid(), v_shop, v_location, null,
    (select id from public.shop_memberships where shop_id = v_shop and role = 'owner'),
    null, v_customer, null, jsonb_build_array(jsonb_build_object(
      'item_type','service','source_id',v_service,'quantity',1)));
  perform public.checkout_pos_sale(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    null, v_shop, v_location, v_invoice, 70, now(), 'cash', 'CASH-SALE');
  select payment.id into v_payment from public.payments payment
    where payment.invoice_id = v_invoice and payment.customer_kind = 'receipt';
  select allocation.id into v_allocation from public.customer_payment_allocations allocation
    where allocation.payment_id = v_payment;
  perform public.refund_customer_receipt(gen_random_uuid(), v_shop, v_payment, now(),
    'cash', 'CASH-REFUND', 'Partial customer refund', jsonb_build_array(
      jsonb_build_object('allocation_id', v_allocation, 'amount', 20)));

  v_card_invoice := public.save_pos_sale_draft(gen_random_uuid(), v_shop, v_location, null,
    (select id from public.shop_memberships where shop_id = v_shop and role = 'owner'),
    null, v_customer, null, jsonb_build_array(jsonb_build_object(
      'item_type','service','source_id',v_service,'quantity',1)));
  perform public.checkout_pos_sale(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    null, v_shop, v_location, v_card_invoice, 70, now(), 'card', 'CARD-SALE');

  v_retry := public.record_cash_movement(v_movement_request, v_shop, v_session,
    'pay_in', 10, 'Petty cash returned', 'IN-1');
  if public.record_cash_movement(v_movement_request,
      v_shop, v_session, 'pay_in', 10, 'Petty cash returned', 'IN-1') <> v_retry then
    raise exception 'pay-in retry duplicated the event';
  end if;
  perform public.record_cash_movement(gen_random_uuid(), v_shop, v_session,
    'pay_out', 5, 'Courier cash payment', 'OUT-1');

  v_dashboard := public.cash_shift_dashboard(v_shop, v_location, null, 1, 20);
  if (v_dashboard #>> '{active,cashSales}')::numeric <> 70
    or (v_dashboard #>> '{active,cashRefunds}')::numeric <> 20
    or (v_dashboard #>> '{active,payIns}')::numeric <> 10
    or (v_dashboard #>> '{active,payOuts}')::numeric <> 5
    or (v_dashboard #>> '{active,expectedCash}')::numeric <> 155
    or (v_dashboard #>> '{active,nonCashTotal}')::numeric <> 70
    or jsonb_array_length(v_dashboard #> '{active,events}') <> 4 then
    raise exception 'open shift did not reconcile payment and drawer events exactly once: %', v_dashboard;
  end if;

  perform public.close_cash_shift(v_close, v_shop, v_session, 150, 'Counted by owner');
  perform public.close_cash_shift(v_close, v_shop, v_session, 150, 'Counted by owner');
  if (select expected_amount from public.cash_sessions where id = v_session) <> 155
    or (select variance_amount from public.cash_sessions where id = v_session) <> -5
    or (select status from public.cash_sessions where id = v_session) <> 'closed' then
    raise exception 'closed shift reconciliation was not persisted';
  end if;
  begin
    update public.cash_drawer_events set amount = 999 where session_id = v_session;
    raise exception 'authenticated user could mutate drawer event history';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.cash_sessions set closing_amount = 999 where id = v_session;
    raise exception 'authenticated user could mutate closed shift history';
  exception when insufficient_privilege then null;
  end;

  perform set_config('ss_cash.shop', v_shop::text, true);
  perform set_config('ss_cash.location', v_location::text, true);
  perform set_config('ss_cash.branch', v_branch::text, true);
  perform set_config('ss_cash.session', v_session::text, true);
  perform set_config('ss_cash.payment', v_payment::text, true);
end;
$$;
reset role;

-- Inspect private evidence and exercise immutable-history triggers as the local
-- test administrator; authenticated callers intentionally lack table access.
do $$
declare v_session uuid := current_setting('ss_cash.session')::uuid;
begin
  if (select count(*) from public.cash_drawer_events
      where payment_id = current_setting('ss_cash.payment')::uuid) <> 1
    or (select count(*) from public.cash_drawer_events where session_id = v_session) <> 4 then
    raise exception 'payment and drawer events were not recorded exactly once';
  end if;
  begin
    update public.cash_drawer_events set amount = 999 where session_id = v_session;
    raise exception 'drawer event history was mutable';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'CASH_DRAWER_EVENT_IMMUTABLE' then raise; end if;
  end;
  begin
    update public.cash_sessions set closing_amount = 999 where id = v_session;
    raise exception 'closed shift history was mutable';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'CASH_SESSION_IMMUTABLE' then raise; end if;
  end;
end;
$$;

-- Another user's profile is fixture setup, not an owner browser operation.
insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
select fixture.cashier_id, shop.portal_id, 'Branch cashier', 'cashier@ss-cash.invalid'
from shop_cash_fixture fixture
join public.shops shop on shop.id = current_setting('ss_cash.shop')::uuid;

set local role authenticated;
select public.invite_shop_member(gen_random_uuid(), current_setting('ss_cash.shop')::uuid,
  'cashier@ss-cash.invalid', 'Branch cashier', 'cashier',
  array[current_setting('ss_cash.location')::uuid]);
reset role;

select set_config('request.jwt.claim.sub', cashier_id::text, true) from shop_cash_fixture;
set local role authenticated;
do $$
declare v_session uuid;
begin
  begin
    perform public.cash_shift_dashboard(current_setting('ss_cash.shop')::uuid,
      current_setting('ss_cash.branch')::uuid, null, 1, 20);
    raise exception 'cashier viewed an unauthorized branch';
  exception when insufficient_privilege then null;
  end;
  v_session := public.open_cash_shift(gen_random_uuid(), current_setting('ss_cash.shop')::uuid,
    current_setting('ss_cash.location')::uuid, 'main', 25, null);
  begin
    perform public.record_cash_movement(gen_random_uuid(), current_setting('ss_cash.shop')::uuid,
      v_session, 'pay_out', 1, 'Unauthorized movement', 'DENY-1');
    raise exception 'cashier recorded a manager-authorized movement';
  exception when insufficient_privilege then null;
  end;
  perform public.close_cash_shift(gen_random_uuid(), current_setting('ss_cash.shop')::uuid,
    v_session, 25, null);
end;
$$;
reset role;
