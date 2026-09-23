-- Focused SS-SALE-001 regression suite. The runner wraps this file in a
-- transaction and rolls back every synthetic fixture.
create temporary table shop_sale_fixture as
select gen_random_uuid() as owner_a_id, gen_random_uuid() as owner_b_id,
  gen_random_uuid() as product_owner_id, gen_random_uuid() as service_owner_id,
  gen_random_uuid() as employee_id, gen_random_uuid() as outsider_id;

insert into auth.users (
  id, email, encrypted_password, aud, role,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@ss-sale-001.invalid', 'x', 'authenticated',
  'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_a_id as id from shop_sale_fixture
  union all select owner_b_id from shop_sale_fixture
  union all select product_owner_id from shop_sale_fixture
  union all select service_owner_id from shop_sale_fixture
  union all select employee_id from shop_sale_fixture
  union all select outsider_id from shop_sale_fixture
) users;

do $$
declare v_function record;
begin
  for v_function in
    select p.oid, p.proname, p.prosecdef, p.proconfig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'sale_access', 'sale_catalog', 'save_sale_draft', 'issue_sale',
      'list_sales', 'get_sale'
    ])
  loop
    if not v_function.prosecdef
      or v_function.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', v_function.oid, 'execute')
      or has_function_privilege('anon', v_function.oid, 'execute') then
      raise exception 'unsafe sale wrapper: %', v_function.proname;
    end if;
  end loop;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'shop_private' and p.proname like '%sale%'
      and (has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('anon', p.oid, 'execute'))
  ) then raise exception 'private sale implementation is browser-callable'; end if;
  if has_table_privilege('authenticated', 'public.invoices', 'insert')
    or has_table_privilege('authenticated', 'public.invoice_items', 'update')
    or has_table_privilege('authenticated', 'public.inventory_movements', 'insert')
    or has_table_privilege('authenticated', 'public.sale_requests', 'select')
    or has_function_privilege('authenticated',
      'public.issue_invoice_and_deduct_inventory(uuid,uuid)', 'execute') then
    raise exception 'sale direct-write or legacy bypass remains';
  end if;
end;
$$;

\echo sale-phase-owner-core
select set_config('request.jwt.claim.sub', owner_a_id::text, true)
from shop_sale_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid; v_customer uuid; v_product uuid; v_service uuid;
  v_product_sale uuid; v_service_sale uuid; v_mixed_sale uuid;
  v_retry uuid := gen_random_uuid(); v_draft_retry uuid := gen_random_uuid();
  v_detail jsonb; v_page jsonb;
begin
  v_shop := public.create_owner_shop('Sale fixture A', 'pro', 'mixed'::public.business_mode);
  v_customer := public.save_customer(v_shop, null, 'Sale Customer', '+20100',
    'sale@example.invalid', 'Cairo', null);
  v_product := public.save_product(v_shop, null, 'Sale Product', 'SALE-SKU', 'SALE-BAR', 10);
  v_service := public.save_service(v_shop, null, 'Sale Service', null, 20, 'percent', 10);
  perform public.adjust_stock(gen_random_uuid(), v_shop, v_product, 3, 5, 'FIFO layer one');
  perform public.adjust_stock(gen_random_uuid(), v_shop, v_product, 4, 7, 'FIFO layer two');

  v_product_sale := public.save_sale_draft(
    v_draft_retry, v_shop, null, v_customer, 'Product only',
    jsonb_build_array(jsonb_build_object('item_type','product','source_id',v_product,'quantity',5))
  );
  if public.save_sale_draft(
    v_draft_retry, v_shop, null, v_customer, 'Product only',
    jsonb_build_array(jsonb_build_object('item_type','product','source_id',v_product,'quantity',5))
  ) <> v_product_sale then raise exception 'draft retry changed document identity'; end if;
  if public.issue_sale(v_retry, v_shop, v_product_sale) <> v_product_sale
    or public.issue_sale(v_retry, v_shop, v_product_sale) <> v_product_sale then
    raise exception 'issue retry did not return the original sale';
  end if;
  if (select total_amount from public.invoices where id = v_product_sale) <> 50
    or (select quantity_on_hand from public.product_stock where product_id = v_product) <> 2
    or (select count(*) from public.inventory_movements
        where reference_id = v_product_sale and movement_type = 'out') <> 2
    or (select sum(quantity_change) from public.inventory_movements
        where reference_id = v_product_sale and movement_type = 'out') <> -5 then
    raise exception 'product sale/FIFO reconciliation failed';
  end if;

  v_service_sale := public.save_sale_draft(
    gen_random_uuid(), v_shop, null, v_customer, 'Service only',
    jsonb_build_array(jsonb_build_object('item_type','service','source_id',v_service,'quantity',1))
  );
  if public.save_sale_draft(
    gen_random_uuid(), v_shop, v_service_sale, v_customer, 'Edited service draft',
    jsonb_build_array(jsonb_build_object('item_type','service','source_id',v_service,'quantity',2))
  ) <> v_service_sale then raise exception 'draft edit changed document identity'; end if;
  perform public.issue_sale(gen_random_uuid(), v_shop, v_service_sale);
  if (select total_amount from public.invoices where id = v_service_sale) <> 36
    or exists (select 1 from public.inventory_movements where reference_id = v_service_sale) then
    raise exception 'service sale changed inventory or calculated incorrectly';
  end if;

  v_mixed_sale := public.save_sale_draft(
    gen_random_uuid(), v_shop, null, v_customer, 'Mixed', jsonb_build_array(
      jsonb_build_object('item_type','product','source_id',v_product,'quantity',1),
      jsonb_build_object('item_type','service','source_id',v_service,'quantity',1)
    )
  );
  perform public.issue_sale(gen_random_uuid(), v_shop, v_mixed_sale);
  if (select total_amount from public.invoices where id = v_mixed_sale) <> 28
    or (select count(*) from public.inventory_movements where reference_id = v_mixed_sale) <> 1
    or (select quantity_on_hand from public.product_stock where product_id = v_product) <> 1 then
    raise exception 'mixed sale reconciliation failed';
  end if;

  begin
    perform public.issue_sale(v_retry, v_shop, v_service_sale);
    raise exception 'conflicting issue request key accepted';
  exception when unique_violation then
    if sqlerrm <> 'SALE_REQUEST_CONFLICT' then raise; end if;
  end;

  v_detail := public.get_sale(v_shop, v_product_sale);
  v_page := public.list_sales(v_shop, 'SALE-', 'issued', current_date, current_date, 1, 20);
  if v_detail ->> 'invoice_number' is null
    or jsonb_array_length(v_detail -> 'lines') <> 1
    or jsonb_array_length(v_detail -> 'movements') <> 2
    or (v_page ->> 'total')::integer <> 3 then
    raise exception 'sale list/detail contract failed: %, %', v_detail, v_page;
  end if;
  if (select count(distinct invoice_number) from public.invoices
      where id in (v_product_sale, v_service_sale, v_mixed_sale)) <> 3 then
    raise exception 'issued numbers are not unique';
  end if;

  perform set_config('ss_sale.shop_a', v_shop::text, true);
  perform set_config('ss_sale.customer_a', v_customer::text, true);
  perform set_config('ss_sale.product_a', v_product::text, true);
  perform set_config('ss_sale.service_a', v_service::text, true);
  perform set_config('ss_sale.product_sale', v_product_sale::text, true);
end;
$$;
reset role;

\echo sale-phase-failure-boundaries
-- Failing issue attempts retain a draft and leave stock/movements untouched.
select set_config('request.jwt.claim.sub', owner_a_id::text, true) from shop_sale_fixture;
set local role authenticated;
do $$
declare v_sale uuid; v_no_customer uuid; v_request uuid := gen_random_uuid();
begin
  v_sale := public.save_sale_draft(
    gen_random_uuid(), current_setting('ss_sale.shop_a')::uuid, null,
    current_setting('ss_sale.customer_a')::uuid, null,
    jsonb_build_array(jsonb_build_object('item_type','product','source_id',
      current_setting('ss_sale.product_a')::uuid,'quantity',2))
  );
  begin
    perform public.issue_sale(v_request, current_setting('ss_sale.shop_a')::uuid, v_sale);
    raise exception 'insufficient stock sale issued';
  exception when check_violation then
    if sqlerrm <> 'INSUFFICIENT_STOCK' then raise; end if;
  end;
  if (select status from public.invoices where id = v_sale) <> 'draft'
    or exists (select 1 from public.inventory_movements where reference_id = v_sale) then
    raise exception 'failed issue left partial effects';
  end if;
  perform set_config('ss_sale.failed_request', v_request::text, true);
  v_no_customer := public.save_sale_draft(
    gen_random_uuid(), current_setting('ss_sale.shop_a')::uuid, null, null, null,
    jsonb_build_array(jsonb_build_object('item_type','service','source_id',
      current_setting('ss_sale.service_a')::uuid,'quantity',1))
  );
  begin
    perform public.issue_sale(gen_random_uuid(), current_setting('ss_sale.shop_a')::uuid, v_no_customer);
    raise exception 'anonymous outstanding sale issued';
  exception when check_violation then
    if sqlerrm <> 'OUTSTANDING_SALE_REQUIRES_CUSTOMER' then raise; end if;
  end;
  begin
    perform public.save_sale_draft(
      gen_random_uuid(), current_setting('ss_sale.shop_a')::uuid, null,
      current_setting('ss_sale.customer_a')::uuid, null,
      '[{"item_type":"custom","quantity":1}]'::jsonb
    );
    raise exception 'custom line accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'UNSUPPORTED_SALE_LINE_TYPE' then raise; end if;
  end;
end;
$$;
reset role;
do $$ begin
  if exists (
    select 1 from public.sale_requests
    where request_id = current_setting('ss_sale.failed_request')::uuid
  ) then raise exception 'failed issue retained an idempotency record'; end if;
end $$;

\echo sale-phase-explicit-business-modes
select set_config('request.jwt.claim.sub', product_owner_id::text, true) from shop_sale_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_customer uuid; v_product uuid; v_sale uuid;
begin
  v_shop := public.create_owner_shop('Product mode sale fixture', 'pro', 'product'::public.business_mode);
  v_customer := public.save_customer(v_shop, null, 'Product Customer', null, null, null, null);
  v_product := public.save_product(v_shop, null, 'Mode Product', null, null, 8);
  perform public.adjust_stock(gen_random_uuid(), v_shop, v_product, 2, 3, 'Mode opening stock');
  v_sale := public.save_sale_draft(gen_random_uuid(), v_shop, null, v_customer, null,
    jsonb_build_array(jsonb_build_object('item_type','product','source_id',v_product,'quantity',1)));
  perform public.issue_sale(gen_random_uuid(), v_shop, v_sale);
  if (select quantity_on_hand from public.product_stock where product_id = v_product) <> 1 then
    raise exception 'product-mode sale did not deduct stock';
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', service_owner_id::text, true) from shop_sale_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_customer uuid; v_service uuid; v_sale uuid;
begin
  v_shop := public.create_owner_shop('Service mode sale fixture', 'pro', 'service'::public.business_mode);
  v_customer := public.save_customer(v_shop, null, 'Service Customer', null, null, null, null);
  v_service := public.save_service(v_shop, null, 'Mode Service', null, 12, 'amount', 2);
  v_sale := public.save_sale_draft(gen_random_uuid(), v_shop, null, v_customer, null,
    jsonb_build_array(jsonb_build_object('item_type','service','source_id',v_service,'quantity',2)));
  perform public.issue_sale(gen_random_uuid(), v_shop, v_sale);
  if (select total_amount from public.invoices where id = v_sale) <> 20
    or exists (select 1 from public.inventory_movements where reference_id = v_sale) then
    raise exception 'service-mode sale is not inventory-independent';
  end if;
end;
$$;
reset role;

\echo sale-phase-cross-shop
-- Create a second tenant and prove all three master references are tenant-safe.
select set_config('request.jwt.claim.sub', owner_b_id::text, true) from shop_sale_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_customer uuid; v_product uuid; v_service uuid;
begin
  v_shop := public.create_owner_shop('Sale fixture B', 'pro', 'mixed'::public.business_mode);
  v_customer := public.save_customer(v_shop, null, 'Foreign Customer', null, null, null, null);
  v_product := public.save_product(v_shop, null, 'Foreign Product', null, null, 1);
  v_service := public.save_service(v_shop, null, 'Foreign Service', null, 1, 'amount', 0);
  perform set_config('ss_sale.shop_b', v_shop::text, true);
  perform set_config('ss_sale.customer_b', v_customer::text, true);
  perform set_config('ss_sale.product_b', v_product::text, true);
  perform set_config('ss_sale.service_b', v_service::text, true);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', owner_a_id::text, true) from shop_sale_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.save_sale_draft(gen_random_uuid(), current_setting('ss_sale.shop_a')::uuid,
      null, current_setting('ss_sale.customer_b')::uuid, null,
      jsonb_build_array(jsonb_build_object('item_type','service','source_id',
        current_setting('ss_sale.service_a')::uuid,'quantity',1)));
    raise exception 'foreign customer accepted';
  exception when others then if sqlerrm <> 'CUSTOMER_NOT_FOUND' then raise; end if; end;
  begin
    perform public.save_sale_draft(gen_random_uuid(), current_setting('ss_sale.shop_a')::uuid,
      null, current_setting('ss_sale.customer_a')::uuid, null,
      jsonb_build_array(jsonb_build_object('item_type','product','source_id',
        current_setting('ss_sale.product_b')::uuid,'quantity',1)));
    raise exception 'foreign product accepted';
  exception when others then if sqlerrm <> 'PRODUCT_NOT_FOUND' then raise; end if; end;
  begin
    perform public.save_sale_draft(gen_random_uuid(), current_setting('ss_sale.shop_a')::uuid,
      null, current_setting('ss_sale.customer_a')::uuid, null,
      jsonb_build_array(jsonb_build_object('item_type','service','source_id',
        current_setting('ss_sale.service_b')::uuid,'quantity',1)));
    raise exception 'foreign service accepted';
  exception when others then if sqlerrm <> 'SERVICE_NOT_FOUND' then raise; end if; end;
end;
$$;
reset role;

\echo sale-phase-delegated
-- Delegated staff need explicit permissions; suspension and outsider access are
-- enforced on every call, not only in the UI.
do $$
declare v_profile uuid; v_membership uuid; v_role uuid;
begin
  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select employee_id, shop.portal_id, 'Sale employee', 'employee@ss-sale.invalid'
  from shop_sale_fixture f join public.shops shop on shop.id = current_setting('ss_sale.shop_a')::uuid
  returning id into v_profile;
  insert into public.shop_memberships (shop_id, profile_id, role)
  values (current_setting('ss_sale.shop_a')::uuid, v_profile, 'employee') returning id into v_membership;
  insert into public.roles (shop_id, name)
  values (current_setting('ss_sale.shop_a')::uuid, 'Sales operator') returning id into v_role;
  perform set_config('ss_sale.employee_membership', v_membership::text, true);
  perform set_config('ss_sale.employee_role', v_role::text, true);
end;
$$;
select set_config('request.jwt.claim.sub', employee_id::text, true) from shop_sale_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.list_sales(current_setting('ss_sale.shop_a')::uuid, null, null, null, null, 1, 20);
    raise exception 'unprivileged member read sales';
  exception when insufficient_privilege then if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if; end;
end $$;
reset role;

insert into public.role_permissions (role_id, permission_id)
select current_setting('ss_sale.employee_role')::uuid, permission.id
from public.permissions permission join public.shops shop on shop.portal_id = permission.portal_id
where shop.id = current_setting('ss_sale.shop_a')::uuid
  and permission.key in ('sales.view', 'sales.manage', 'sales.issue');
insert into public.membership_roles (membership_id, role_id) values (
  current_setting('ss_sale.employee_membership')::uuid,
  current_setting('ss_sale.employee_role')::uuid
);
select set_config('request.jwt.claim.sub', employee_id::text, true) from shop_sale_fixture;
set local role authenticated;
do $$
declare v_sale uuid;
begin
  v_sale := public.save_sale_draft(gen_random_uuid(), current_setting('ss_sale.shop_a')::uuid,
    null, current_setting('ss_sale.customer_a')::uuid, null,
    jsonb_build_array(jsonb_build_object('item_type','service','source_id',
      current_setting('ss_sale.service_a')::uuid,'quantity',1)));
  perform public.issue_sale(gen_random_uuid(), current_setting('ss_sale.shop_a')::uuid, v_sale);
end;
$$;
reset role;
update public.shop_memberships set status = 'suspended'
where id = current_setting('ss_sale.employee_membership')::uuid;
select set_config('request.jwt.claim.sub', employee_id::text, true) from shop_sale_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.sale_catalog(current_setting('ss_sale.shop_a')::uuid);
    raise exception 'suspended member accessed sales';
  exception when insufficient_privilege then if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', outsider_id::text, true) from shop_sale_fixture;
set local role authenticated;
do $$ begin
  begin
    perform public.list_sales(current_setting('ss_sale.shop_a')::uuid, null, null, null, null, 1, 20);
    raise exception 'outsider accessed sales';
  exception when insufficient_privilege then if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if; end;
end $$;
reset role;

\echo sale-phase-snapshots
-- Issued snapshots and document history survive later supported master edits.
select set_config('request.jwt.claim.sub', owner_a_id::text, true) from shop_sale_fixture;
set local role authenticated;
do $$ begin
  perform public.save_product(current_setting('ss_sale.shop_a')::uuid,
    current_setting('ss_sale.product_a')::uuid, 'Changed Product', 'NEW-SKU', null, 99);
  perform public.save_service(current_setting('ss_sale.shop_a')::uuid,
    current_setting('ss_sale.service_a')::uuid, 'Changed Service', null, 99, 'amount', 0);
  perform public.archive_customer(current_setting('ss_sale.shop_a')::uuid,
    current_setting('ss_sale.customer_a')::uuid);
end $$;
reset role;
do $$ begin
  if not exists (
    select 1 from public.invoices invoice join public.invoice_items item on item.invoice_id = invoice.id
    where invoice.id = current_setting('ss_sale.product_sale')::uuid
      and invoice.client_name_snapshot = 'Sale Customer'
      and invoice.client_phone_snapshot = '+20100'
      and item.item_name = 'Sale Product' and item.product_sku_snapshot = 'SALE-SKU'
      and item.unit_price = 10
  ) then raise exception 'issued snapshots changed with master data'; end if;
  begin
    update public.invoices set notes = 'rewritten' where id = current_setting('ss_sale.product_sale')::uuid;
    raise exception 'issued header changed';
  exception when others then if sqlerrm <> 'Issued invoice are immutable' then raise; end if; end;
  begin
    update public.invoice_items set item_name = 'rewritten'
    where invoice_id = current_setting('ss_sale.product_sale')::uuid;
    raise exception 'issued line changed';
  exception when check_violation then if sqlerrm <> 'ISSUED_SALE_IMMUTABLE' then raise; end if; end;
end $$;
