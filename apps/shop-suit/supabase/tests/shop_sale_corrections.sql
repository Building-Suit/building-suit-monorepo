-- SS-SALE-CORR-001: append-only full correction, payment reconciliation,
-- exact FIFO restoration, idempotency, isolation, and permission boundaries.
create temporary table shop_sale_correction_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() employee_id,
  gen_random_uuid() outsider_id, gen_random_uuid() other_owner_id;
grant select on shop_sale_correction_fixture to authenticated;

insert into auth.users (id,email,encrypted_password,aud,role,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id, 'owner@ss-sale-correction.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{}'::jsonb, now(), now() from shop_sale_correction_fixture
union all
select employee_id, 'employee@ss-sale-correction.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{}'::jsonb, now(), now() from shop_sale_correction_fixture
union all
select outsider_id, 'outsider@ss-sale-correction.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{}'::jsonb, now(), now() from shop_sale_correction_fixture
union all
select other_owner_id, 'other-owner@ss-sale-correction.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{}'::jsonb, now(), now() from shop_sale_correction_fixture;

do $$
declare function_row record;
begin
  for function_row in select procedure.oid, procedure.proname, procedure.prosecdef,
    procedure.proconfig from pg_proc procedure join pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public' and procedure.proname = any(array[
      'correct_location_sale','sale_correction_state'
    ])
  loop
    if not function_row.prosecdef
      or function_row.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', function_row.oid, 'execute')
      or has_function_privilege('anon', function_row.oid, 'execute') then
      raise exception 'unsafe sale correction wrapper: %', function_row.proname;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.sale_corrections', 'insert')
    or has_table_privilege('authenticated', 'public.sale_corrections', 'update')
    or has_table_privilege('authenticated', 'public.inventory_movements', 'insert')
    or has_table_privilege('authenticated', 'public.payments', 'insert') then
    raise exception 'sale correction history exposes direct browser mutation';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_sale_correction_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid; v_location uuid; v_customer uuid; v_product uuid; v_service uuid;
  v_staff uuid; v_sale uuid; v_partial_sale uuid; v_service_sale uuid; v_walk_in_sale uuid;
  v_payment uuid; v_allocation uuid; v_correction uuid; v_retry uuid;
  v_request uuid := gen_random_uuid(); v_effective_at timestamptz := clock_timestamp();
  v_state jsonb; v_statement jsonb; v_other_shop uuid;
  v_original_updated_at timestamptz; v_original_issued_at timestamptz;
begin
  v_shop := public.create_owner_shop('Sale correction fixture', 'team', 'mixed');
  select id into v_location from public.shop_locations where shop_id = v_shop and is_default;
  select id into v_staff from public.shop_memberships where shop_id = v_shop and role = 'owner';
  v_customer := public.save_customer(v_shop, null, 'Correction customer', null, null, null, null);
  v_product := public.save_product(v_shop, null, 'Correction product', 'CORR-1', null, 20);
  v_service := public.save_service(v_shop, null, 'Correction service', null, 30, 'amount', 0);
  perform public.adjust_stock(gen_random_uuid(), v_shop, v_product, 1, 4, 'FIFO one');
  perform public.adjust_stock(gen_random_uuid(), v_shop, v_product, 2, 7, 'FIFO two');

  v_sale := public.save_pos_sale_draft(gen_random_uuid(), v_shop, v_location, null,
    v_staff, null, v_customer, 'Mixed paid sale', jsonb_build_array(
      jsonb_build_object('item_type','product','source_id',v_product,'quantity',2),
      jsonb_build_object('item_type','service','source_id',v_service,'quantity',1)));
  perform public.checkout_pos_sale(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    null, v_shop, v_location, v_sale, 70, clock_timestamp(), 'cash', 'ORIGINAL');
  select updated_at, issued_at into v_original_updated_at, v_original_issued_at
    from public.invoices where id = v_sale;
  select payment.id, allocation.id into v_payment, v_allocation
  from public.payments payment join public.customer_payment_allocations allocation
    on allocation.payment_id = payment.id where allocation.invoice_id = v_sale
      and payment.customer_kind = 'receipt';

  v_correction := public.correct_location_sale(v_request, v_shop, v_location,
    v_sale, v_effective_at, 'Customer returned the complete sale', 'RETURN-1');
  v_retry := public.correct_location_sale(v_request, v_shop, v_location,
    v_sale, v_effective_at, 'Customer returned the complete sale', 'RETURN-1');
  if v_retry <> v_correction then raise exception 'correction retry changed identity'; end if;
  begin
    perform public.correct_location_sale(v_request, v_shop, v_location,
      v_sale, v_effective_at, 'Conflicting request payload', 'RETURN-2');
    raise exception 'conflicting correction request key accepted';
  exception when unique_violation then
    if sqlerrm <> 'SALE_CORRECTION_REQUEST_CONFLICT' then raise; end if;
  end;
  begin
    perform public.correct_location_sale(gen_random_uuid(), v_shop, v_location,
      v_sale, v_effective_at, 'Second full return', null);
    raise exception 'sale corrected twice';
  exception when check_violation then
    if sqlerrm <> 'SALE_ALREADY_CORRECTED' then raise; end if;
  end;

  if (select count(*) from public.sale_corrections where invoice_id = v_sale) <> 1
    or (select kind from public.sale_corrections where id = v_correction) <> 'full_return'
    or (select refund_amount from public.sale_corrections where id = v_correction) <> 70
    or (select restored_quantity from public.sale_corrections where id = v_correction) <> 2
    or (select status from public.invoices where id = v_sale) <> 'issued'
    or (select updated_at from public.invoices where id = v_sale) <> v_original_updated_at
    or (select issued_at from public.invoices where id = v_sale) <> v_original_issued_at then
    raise exception 'correction changed the issued sale or recorded wrong totals';
  end if;
  if (select count(*) from public.inventory_movements
      where sale_correction_id = v_correction) <> 2
    or exists (select 1 from public.inventory_movements reversal
      join public.inventory_movements original on original.id = reversal.reversal_of_movement_id
      where reversal.sale_correction_id = v_correction
        and (reversal.batch_id <> original.batch_id
          or reversal.product_id <> original.product_id
          or reversal.quantity_change <> abs(original.quantity_change)
          or reversal.unit_cost_snapshot <> original.unit_cost_snapshot))
    or (select quantity_on_hand from public.product_stock where product_id = v_product) <> 3 then
    raise exception 'FIFO stock was not restored to the exact original layers';
  end if;
  if (select coalesce(sum(amount), 0) from public.payments
      where sale_correction_id = v_correction and payment_direction = 'out') <> 70
    or (select count(*) from public.customer_payment_adjustments
      where sale_correction_id = v_correction) <> 1
    or (select allocation.amount - coalesce(sum(adjustment.amount), 0)
      from public.customer_payment_allocations allocation
      left join public.customer_payment_adjustments adjustment
        on adjustment.original_allocation_id = allocation.id
      where allocation.id = v_allocation group by allocation.id) <> 0
    or (public.get_location_sale(v_shop, v_location, v_sale)
      ->> 'outstanding')::numeric <> 0 then
    raise exception 'sale payment/refund effects did not reconcile exactly once';
  end if;
  v_statement := public.customer_statement(v_shop, v_customer, 1, 50);
  if (v_statement ->> 'outstanding')::numeric <> 0
    or not exists (select 1 from jsonb_array_elements(v_statement -> 'items') event
      where event ->> 'event_type' = 'full_return' and event ->> 'invoice_id' = v_sale::text) then
    raise exception 'customer balance does not include the append-only correction credit';
  end if;
  v_state := public.sale_correction_state(v_shop, v_location, v_sale);
  if (v_state ->> 'canCorrect')::boolean
    or (v_state #>> '{correction,id}')::uuid <> v_correction
    or (v_state ->> 'partialReturnsAvailable')::boolean then
    raise exception 'correction state exposed another or partial return';
  end if;
  begin
    perform public.refund_customer_receipt(gen_random_uuid(), v_shop, v_payment,
      clock_timestamp(), 'cash', null, 'Late partial refund', jsonb_build_array(
        jsonb_build_object('allocation_id',v_allocation,'amount',1)));
    raise exception 'partial payment adjustment accepted after sale correction';
  exception when check_violation then
    if sqlerrm not in ('SALE_ALREADY_CORRECTED', 'PAYMENT_ADJUSTMENT_EXCEEDS_EFFECTIVE_AMOUNT') then raise; end if;
  end;

  -- A partially paid customer sale refunds only money actually received while
  -- the full correction credit clears the remaining receivable.
  v_partial_sale := public.save_pos_sale_draft(gen_random_uuid(), v_shop, v_location,
    null, v_staff, null, v_customer, null, jsonb_build_array(
      jsonb_build_object('item_type','service','source_id',v_service,'quantity',1)));
  perform public.issue_location_sale(gen_random_uuid(), v_shop, v_location, v_partial_sale);
  perform public.record_location_customer_receipt(gen_random_uuid(), v_shop, v_location,
    v_customer, 10, clock_timestamp(), 'card', 'PARTIAL', null,
    jsonb_build_array(jsonb_build_object('invoice_id',v_partial_sale,'amount',10)));
  v_retry := public.correct_location_sale(gen_random_uuid(), v_shop, v_location,
    v_partial_sale, clock_timestamp(), 'Correct partially paid sale', 'PARTIAL-RETURN');
  if (select refund_amount from public.sale_corrections where id = v_retry) <> 10
    or (select coalesce(sum(amount), 0) from public.payments
      where sale_correction_id = v_retry and payment_direction = 'out') <> 10
    or (public.get_location_sale(v_shop, v_location, v_partial_sale)
      ->> 'outstanding')::numeric <> 0 then
    raise exception 'partially paid sale correction did not reconcile money and receivable';
  end if;

  -- Service-only unpaid correction is a void and never creates stock or money.
  v_service_sale := public.save_pos_sale_draft(gen_random_uuid(), v_shop, v_location,
    null, v_staff, null, v_customer, null, jsonb_build_array(
      jsonb_build_object('item_type','service','source_id',v_service,'quantity',1)));
  perform public.issue_location_sale(gen_random_uuid(), v_shop, v_location, v_service_sale);
  v_retry := public.correct_location_sale(gen_random_uuid(), v_shop, v_location,
    v_service_sale, clock_timestamp(), 'Service sale entered in error', null);
  if (select kind from public.sale_corrections where id = v_retry) <> 'void'
    or exists (select 1 from public.inventory_movements where sale_correction_id = v_retry)
    or exists (select 1 from public.payments where sale_correction_id = v_retry) then
    raise exception 'service-only void created stock or payment effects';
  end if;

  -- A customerless fully-paid sale is returned atomically without creating an
  -- anonymous receivable.
  v_walk_in_sale := public.save_pos_sale_draft(gen_random_uuid(), v_shop, v_location,
    null, v_staff, null, null, null, jsonb_build_array(
      jsonb_build_object('item_type','product','source_id',v_product,'quantity',1)));
  perform public.checkout_pos_sale(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    null, v_shop, v_location, v_walk_in_sale, 20, clock_timestamp(), 'card', 'WALK-IN');
  v_retry := public.correct_location_sale(gen_random_uuid(), v_shop, v_location,
    v_walk_in_sale, clock_timestamp(), 'Walk-in full return', 'WALK-IN-RETURN');
  if (select refund_amount from public.sale_corrections where id = v_retry) <> 20
    or not exists (select 1 from public.payments where sale_correction_id = v_retry
      and payment_direction = 'out' and client_id is null and amount = 20)
    or (public.get_location_sale(v_shop, v_location, v_walk_in_sale)
      ->> 'outstanding')::numeric <> 0 then
    raise exception 'customerless sale correction created an anonymous receivable';
  end if;

  -- Owner onboarding retries return the existing shop, so use a distinct owner
  -- to exercise invoice isolation after authorization for the other shop passes.
  perform set_config('request.jwt.claim.sub', other_owner_id::text, true)
  from shop_sale_correction_fixture;
  v_other_shop := public.create_owner_shop('Other correction shop', 'team', 'service');
  if v_other_shop is null or v_other_shop = v_shop then
    raise exception 'cross-shop correction fixture requires a distinct shop';
  end if;
  begin
    perform public.correct_location_sale(gen_random_uuid(), v_other_shop,
      (select id from public.shop_locations where shop_id = v_other_shop and is_default),
      v_service_sale, clock_timestamp(), 'Cross-shop attempt', null);
    raise exception 'cross-shop correction accepted';
  exception when no_data_found then
    if sqlerrm <> 'SALE_NOT_FOUND' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', owner_id::text, true)
  from shop_sale_correction_fixture;

  perform set_config('ss_corr.shop', v_shop::text, true);
  perform set_config('ss_corr.location', v_location::text, true);
  perform set_config('ss_corr.sale', v_service_sale::text, true);
end;
$$;
reset role;

-- Direct history mutation is blocked even for the test administrator.
do $$ begin
  begin
    update public.sale_corrections set reason = 'Rewritten history'
    where invoice_id = current_setting('ss_corr.sale')::uuid;
    raise exception 'sale correction history was mutable';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'SALE_CORRECTION_IMMUTABLE' then raise; end if;
  end;
end $$;

-- Staff with issue access but no refund authority cannot perform the combined
-- money/stock correction. Suspension and outsider checks remain server-side.
do $$
declare v_profile uuid; v_membership uuid; v_role uuid;
begin
  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select fixture.employee_id, shop.portal_id, 'Correction employee',
    'employee@ss-sale-correction.invalid'
  from shop_sale_correction_fixture fixture join public.shops shop
    on shop.id = current_setting('ss_corr.shop')::uuid returning id into v_profile;
  insert into public.shop_memberships (shop_id, profile_id, role)
  values (current_setting('ss_corr.shop')::uuid, v_profile, 'employee')
  returning id into v_membership;
  -- Membership creation assigns the default location through its trigger.
  if not exists (select 1 from public.membership_location_assignments
    where membership_id = v_membership
      and shop_id = current_setting('ss_corr.shop')::uuid
      and location_id = current_setting('ss_corr.location')::uuid) then
    raise exception 'correction employee is missing the default location assignment';
  end if;
  insert into public.roles (shop_id, name) values (
    current_setting('ss_corr.shop')::uuid, 'Sale correction test staff') returning id into v_role;
  insert into public.role_permissions (role_id, permission_id)
  select v_role, permission.id from public.permissions permission join public.shops shop
    on shop.portal_id = permission.portal_id
  where shop.id = current_setting('ss_corr.shop')::uuid
    and permission.key in ('sales.view','sales.issue');
  insert into public.membership_roles values (v_membership, v_role);
  perform set_config('ss_corr.employee_membership', v_membership::text, true);
end $$;

select set_config('request.jwt.claim.sub', employee_id::text, true)
from shop_sale_correction_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.correct_location_sale(gen_random_uuid(), current_setting('ss_corr.shop')::uuid,
      current_setting('ss_corr.location')::uuid, current_setting('ss_corr.sale')::uuid,
      clock_timestamp(), 'Unauthorized correction', null);
    raise exception 'staff without refund authority corrected a sale';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end $$;
reset role;

update public.shop_memberships set status = 'suspended'
where id = current_setting('ss_corr.employee_membership')::uuid;
select set_config('request.jwt.claim.sub', employee_id::text, true)
from shop_sale_correction_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.sale_correction_state(current_setting('ss_corr.shop')::uuid,
      current_setting('ss_corr.location')::uuid, current_setting('ss_corr.sale')::uuid);
    raise exception 'suspended staff read sale correction state';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', outsider_id::text, true)
from shop_sale_correction_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.sale_correction_state(current_setting('ss_corr.shop')::uuid,
      current_setting('ss_corr.location')::uuid, current_setting('ss_corr.sale')::uuid);
    raise exception 'outsider read sale correction state';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end $$;
reset role;
