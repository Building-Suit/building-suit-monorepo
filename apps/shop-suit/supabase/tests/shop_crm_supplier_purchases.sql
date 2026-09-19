-- Run after the supplier-purchase migration inside BEGIN, then ROLLBACK.
create temporary table shop_purchase_fixture as
select gen_random_uuid() as owner_id, gen_random_uuid() as other_owner_id,
  gen_random_uuid() as basic_owner_id, gen_random_uuid() as outsider_id;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@task09b.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id as id from shop_purchase_fixture
  union all select other_owner_id from shop_purchase_fixture
  union all select basic_owner_id from shop_purchase_fixture
  union all select outsider_id from shop_purchase_fixture
) users;

do $$ begin
  if has_function_privilege('anon',
      'shop_crm.create_vendor(uuid,text,text,text,text,text,text,text)', 'EXECUTE')
    or has_function_privilege('anon',
      'shop_crm.create_supplier_purchase(uuid,uuid,uuid,text,date,text,jsonb)',
      'EXECUTE')
    or has_function_privilege('anon',
      'shop_crm.void_supplier_purchase(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'shop_crm.post_vendor_invoice_and_create_batches(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('service_role',
      'shop_crm.post_vendor_invoice_and_create_batches(uuid,uuid)', 'EXECUTE')
    or has_table_privilege('anon', 'shop_crm.vendors', 'SELECT')
    or has_table_privilege('authenticated', 'shop_crm.vendors', 'INSERT')
    or has_table_privilege('authenticated', 'shop_crm.vendor_invoices', 'UPDATE')
    or has_table_privilege('authenticated', 'shop_crm.vendor_invoice_items', 'INSERT')
    or has_table_privilege('authenticated', 'shop_crm.inventory_batches', 'INSERT')
    or has_table_privilege('authenticated', 'shop_crm.inventory_movements', 'UPDATE')
    or has_table_privilege('authenticated', 'shop_crm.payments', 'INSERT') then
    raise exception 'supplier-purchase browser grants are too broad';
  end if;
end $$;

select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_purchase_fixture;
set local role authenticated;
do $$
declare
  v_shop_id uuid;
  v_vendor_id uuid;
  v_product_one uuid;
  v_product_two uuid;
  v_purchase_id uuid;
  v_retry_id uuid;
  v_request_id uuid := gen_random_uuid();
  v_items jsonb;
begin
  v_shop_id := shop_crm.create_owner_shop('Purchase fixture Pro', 'pro');
  v_product_one := shop_crm.save_product(
    v_shop_id, null, 'Purchase item one', 'PURCHASE-1', null, 12
  );
  v_product_two := shop_crm.save_product(
    v_shop_id, null, 'Purchase item two', 'PURCHASE-2', null, 8
  );
  v_vendor_id := shop_crm.create_vendor(
    v_shop_id, 'Fixture supplier', 'Supplier contact', '01000000000',
    'supplier@task09b.invalid', 'Fixture address', 'TAX-09B', 'Fixture note'
  );
  v_items := jsonb_build_array(
    jsonb_build_object(
      'product_id', v_product_one, 'quantity', 2.5, 'unit_cost', 4.12
    ),
    jsonb_build_object(
      'product_id', v_product_two, 'quantity', 3, 'unit_cost', 2
    )
  );
  v_purchase_id := shop_crm.create_supplier_purchase(
    v_request_id, v_shop_id, v_vendor_id, 'SUP-001', current_date,
    'Atomic fixture purchase', v_items
  );
  perform set_config('task09b.shop_id', v_shop_id::text, true);
  perform set_config('task09b.vendor_id', v_vendor_id::text, true);
  perform set_config('task09b.product_one', v_product_one::text, true);
  perform set_config('task09b.product_two', v_product_two::text, true);
  perform set_config('task09b.purchase_id', v_purchase_id::text, true);
  perform set_config('task09b.request_id', v_request_id::text, true);
  perform set_config('task09b.items', v_items::text, true);

  if not exists (
    select 1 from shop_crm.vendor_invoices invoice
    where invoice.id = v_purchase_id and invoice.shop_id = v_shop_id
      and invoice.vendor_id = v_vendor_id and invoice.status = 'posted'
      and invoice.total_amount = 16.30 and invoice.request_id = v_request_id
  ) then raise exception 'posted purchase header or total is wrong'; end if;
  if (select count(*) from shop_crm.vendor_invoice_items item
      where item.vendor_invoice_id = v_purchase_id) <> 2
    or not exists (
      select 1 from shop_crm.vendor_invoice_items item
      where item.vendor_invoice_id = v_purchase_id
        and item.product_id = v_product_one and item.quantity = 2.5
        and item.unit_cost = 4.1200 and item.total_cost = 10.30
    ) then raise exception 'purchase line totals are wrong'; end if;
  if (select count(*) from shop_crm.inventory_batches batch
      where batch.source_type = 'vendor_invoice'
        and batch.source_id = v_purchase_id
        and batch.quantity_received = batch.remaining_quantity) <> 2
    or not exists (
      select 1 from shop_crm.inventory_batches batch
      where batch.source_id = v_purchase_id
        and batch.product_id = v_product_one
        and batch.quantity_received = 2.5 and batch.unit_cost = 4.12
    ) then raise exception 'FIFO purchase batches are wrong'; end if;
  if (select count(*) from shop_crm.inventory_movements movement
      where movement.reference_id = v_purchase_id
        and movement.movement_type = 'in') <> 2 then
    raise exception 'purchase inventory movements are wrong';
  end if;
  if not exists (
    select 1 from shop_crm.inventory_movements movement
    where movement.reference_id = v_purchase_id
      and movement.product_id = v_product_one
      and movement.unit_cost_snapshot = 4.12
  ) then raise exception 'movement unit-cost precision is wrong'; end if;

  v_retry_id := shop_crm.create_supplier_purchase(
    v_request_id, v_shop_id, v_vendor_id, 'SUP-001', current_date,
    'Atomic fixture purchase', v_items
  );
  if v_retry_id <> v_purchase_id
    or (select count(*) from shop_crm.vendor_invoices invoice
        where invoice.shop_id = v_shop_id) <> 1
    or (select count(*) from shop_crm.inventory_batches batch
        where batch.source_id = v_purchase_id) <> 2
    or (select count(*) from shop_crm.inventory_movements movement
        where movement.reference_id = v_purchase_id) <> 2 then
    raise exception 'purchase retry duplicated the document or stock';
  end if;

  begin
    perform shop_crm.create_supplier_purchase(
      v_request_id, v_shop_id, v_vendor_id, 'SUP-001-CHANGED', current_date,
      'Atomic fixture purchase', v_items
    );
    raise exception 'conflicting purchase request accepted';
  exception when unique_violation then
    if sqlerrm <> 'PURCHASE_REQUEST_CONFLICT' then raise; end if;
  end;
end $$;
reset role;

do $$ begin
  begin
    update shop_crm.vendor_invoices set total_amount = total_amount + 1
    where id = current_setting('task09b.purchase_id')::uuid;
    raise exception 'posted purchase header changed';
  exception when sqlstate '55000' then
    if sqlerrm <> 'POSTED_PURCHASE_IMMUTABLE' then raise; end if;
  end;
  begin
    update shop_crm.vendor_invoice_items set quantity = quantity + 1
    where vendor_invoice_id = current_setting('task09b.purchase_id')::uuid;
    raise exception 'posted purchase item changed';
  exception when sqlstate '55000' then
    if sqlerrm <> 'POSTED_PURCHASE_IMMUTABLE' then raise; end if;
  end;
  begin
    perform shop_crm.post_vendor_invoice_and_create_batches(
      current_setting('task09b.purchase_id')::uuid,
      (select created_by_profile_id from shop_crm.vendor_invoices
       where id = current_setting('task09b.purchase_id')::uuid)
    );
    raise exception 'historical poster duplicated a posted purchase';
  exception when others then
    if sqlerrm not like '%is not in draft state%' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', other_owner_id::text, true)
from shop_purchase_fixture;
set local role authenticated;
do $$
declare
  v_other_shop uuid;
  v_other_vendor uuid;
  v_other_product uuid;
begin
  v_other_shop := shop_crm.create_owner_shop('Purchase fixture other', 'pro');
  v_other_product := shop_crm.save_product(
    v_other_shop, null, 'Other product', 'PURCHASE-OTHER', null, 3
  );
  v_other_vendor := shop_crm.create_vendor(
    v_other_shop, 'Other supplier', null, null, null, null, null, null
  );
  perform set_config('task09b.other_shop', v_other_shop::text, true);
  perform set_config('task09b.other_vendor', v_other_vendor::text, true);
  perform set_config('task09b.other_product', v_other_product::text, true);

  begin
    perform shop_crm.void_supplier_purchase(
      current_setting('task09b.shop_id')::uuid,
      current_setting('task09b.purchase_id')::uuid
    );
    raise exception 'cross-shop purchase void accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_purchase_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.create_supplier_purchase(
      gen_random_uuid(), current_setting('task09b.shop_id')::uuid,
      current_setting('task09b.other_vendor')::uuid, 'CROSS-VENDOR',
      current_date, null, current_setting('task09b.items')::jsonb
    );
    raise exception 'cross-shop vendor accepted';
  exception when others then
    if sqlerrm <> 'VENDOR_NOT_FOUND' then raise; end if;
  end;
  begin
    perform shop_crm.create_supplier_purchase(
      gen_random_uuid(), current_setting('task09b.shop_id')::uuid,
      current_setting('task09b.vendor_id')::uuid, 'CROSS-PRODUCT',
      current_date, null, jsonb_build_array(jsonb_build_object(
        'product_id', current_setting('task09b.other_product')::uuid,
        'quantity', 1, 'unit_cost', 1
      ))
    );
    raise exception 'cross-shop product accepted';
  exception when others then
    if sqlerrm <> 'PRODUCT_NOT_FOUND' then raise; end if;
  end;
end $$;
reset role;

update shop_crm.subscriptions set trial_end_at = now() - interval '1 second'
where profile_id in (
  select profile_id from shop_crm.shop_memberships
  where shop_id = current_setting('task09b.shop_id')::uuid and role = 'owner'
);
select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_purchase_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.create_supplier_purchase(
      gen_random_uuid(), current_setting('task09b.shop_id')::uuid,
      current_setting('task09b.vendor_id')::uuid, 'EXPIRED', current_date,
      null, current_setting('task09b.items')::jsonb
    );
    raise exception 'expired trial created a purchase';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_SUBSCRIPTION_INACTIVE' then raise; end if;
  end;
end $$;
reset role;
update shop_crm.subscriptions set trial_end_at = now() + interval '30 days'
where profile_id in (
  select profile_id from shop_crm.shop_memberships
  where shop_id = current_setting('task09b.shop_id')::uuid and role = 'owner'
);

insert into shop_crm.accounting_periods (
  shop_id, period_start, period_end, is_closed, closed_at
) values (
  current_setting('task09b.shop_id')::uuid, current_date, current_date,
  true, now()
);
select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_purchase_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.create_supplier_purchase(
      gen_random_uuid(), current_setting('task09b.shop_id')::uuid,
      current_setting('task09b.vendor_id')::uuid, 'CLOSED', current_date,
      null, current_setting('task09b.items')::jsonb
    );
    raise exception 'closed period created a purchase';
  exception when others then
    if sqlerrm <> 'ACCOUNTING_PERIOD_CLOSED' then raise; end if;
  end;
  begin
    perform shop_crm.void_supplier_purchase(
      current_setting('task09b.shop_id')::uuid,
      current_setting('task09b.purchase_id')::uuid
    );
    raise exception 'closed period voided a purchase';
  exception when others then
    if sqlerrm <> 'ACCOUNTING_PERIOD_CLOSED' then raise; end if;
  end;
end $$;
reset role;
update shop_crm.accounting_periods set is_closed = false, closed_at = null
where shop_id = current_setting('task09b.shop_id')::uuid;

select set_config('request.jwt.claim.sub', basic_owner_id::text, true)
from shop_purchase_fixture;
set local role authenticated;
do $$
declare
  v_basic_shop uuid;
  v_basic_product uuid;
begin
  v_basic_shop := shop_crm.create_owner_shop('Purchase fixture Basic', 'basic');
  v_basic_product := shop_crm.save_product(
    v_basic_shop, null, 'Basic purchase item', 'PURCHASE-BASIC', null, 2
  );
  perform set_config('task09b.basic_shop', v_basic_shop::text, true);
  perform set_config('task09b.basic_product', v_basic_product::text, true);
  begin
    perform shop_crm.create_vendor(
      v_basic_shop, 'Basic supplier', null, null, null, null, null, null
    );
    raise exception 'plan without inventory created a supplier';
  exception when insufficient_privilege then
    if sqlerrm <> 'PURCHASES_NOT_IN_PLAN' then raise; end if;
  end;
end $$;
reset role;

create temporary table basic_vendor_id (id uuid primary key);
with inserted as (
  insert into shop_crm.vendors (
    shop_id, name, created_by_profile_id
  ) select
    current_setting('task09b.basic_shop')::uuid, 'Basic fixture supplier',
    membership.profile_id
  from shop_crm.shop_memberships membership
  where membership.shop_id = current_setting('task09b.basic_shop')::uuid
    and membership.role = 'owner'
  returning id
)
insert into basic_vendor_id select id from inserted;
select set_config('task09b.basic_vendor', id::text, true)
from basic_vendor_id;

select set_config('request.jwt.claim.sub', basic_owner_id::text, true)
from shop_purchase_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.create_supplier_purchase(
      gen_random_uuid(), current_setting('task09b.basic_shop')::uuid,
      current_setting('task09b.basic_vendor')::uuid, 'BASIC-DENIED', current_date,
      null, jsonb_build_array(jsonb_build_object(
        'product_id', current_setting('task09b.basic_product')::uuid,
        'quantity', 1, 'unit_cost', 1
      ))
    );
    raise exception 'plan without inventory posted a purchase';
  exception when insufficient_privilege then
    if sqlerrm <> 'PURCHASES_NOT_IN_PLAN' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_purchase_fixture;
set local role authenticated;
do $$ begin
  perform shop_crm.void_supplier_purchase(
    current_setting('task09b.shop_id')::uuid,
    current_setting('task09b.purchase_id')::uuid
  );
  perform shop_crm.void_supplier_purchase(
    current_setting('task09b.shop_id')::uuid,
    current_setting('task09b.purchase_id')::uuid
  );
  if not exists (
    select 1 from shop_crm.vendor_invoices
    where id = current_setting('task09b.purchase_id')::uuid and status = 'void'
  )
    or exists (
      select 1 from shop_crm.inventory_batches
      where source_id = current_setting('task09b.purchase_id')::uuid
        and remaining_quantity <> 0
    )
    or (select count(*) from shop_crm.inventory_movements
        where reference_id = current_setting('task09b.purchase_id')::uuid) <> 4 then
    raise exception 'purchase void or reversal is wrong';
  end if;
  if shop_crm.create_supplier_purchase(
      current_setting('task09b.request_id')::uuid,
      current_setting('task09b.shop_id')::uuid,
      current_setting('task09b.vendor_id')::uuid, 'SUP-001', current_date,
      'Atomic fixture purchase', current_setting('task09b.items')::jsonb
    ) <> current_setting('task09b.purchase_id')::uuid then
    raise exception 'voided purchase retry created another document';
  end if;
end $$;
reset role;

set local role anon;
do $$ begin
  begin
    perform shop_crm.create_supplier_purchase(
      gen_random_uuid(), current_setting('task09b.shop_id')::uuid,
      current_setting('task09b.vendor_id')::uuid, null, current_date, null,
      current_setting('task09b.items')::jsonb
    );
    raise exception 'anonymous purchase RPC accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
