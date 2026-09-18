-- Run inside BEGIN after the inventory migration, then ROLLBACK.
create temporary table shop_stock_fixture as
select gen_random_uuid() as pro_user, gen_random_uuid() as basic_user,
  gen_random_uuid() as outsider_user;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@task09.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select pro_user as id from shop_stock_fixture
  union all select basic_user from shop_stock_fixture
  union all select outsider_user from shop_stock_fixture
) users;

do $$ begin
  if has_function_privilege('anon',
      'shop_crm.adjust_stock(uuid,uuid,uuid,numeric,numeric,text)', 'EXECUTE')
    or has_table_privilege('authenticated',
      'shop_crm.inventory_batches', 'INSERT')
    or has_table_privilege('authenticated',
      'shop_crm.inventory_movements', 'UPDATE')
    or has_table_privilege('authenticated',
      'shop_crm.stock_adjustment_requests', 'SELECT')
    or has_table_privilege('anon', 'shop_crm.product_stock', 'SELECT')
    or not has_table_privilege('authenticated',
      'shop_crm.product_stock', 'SELECT') then
    raise exception 'stock browser grants are wrong';
  end if;
end $$;

select set_config('request.jwt.claim.sub', pro_user::text, true)
from shop_stock_fixture;
set local role authenticated;
do $$
declare
  shop_id uuid;
  v_product_id uuid;
  receipt_one uuid := gen_random_uuid();
  receipt_two uuid := gen_random_uuid();
  writeoff uuid := gen_random_uuid();
begin
  shop_id := shop_crm.create_owner_shop('Stock fixture Pro', 'pro');
  v_product_id := shop_crm.save_product(
    shop_id, null, 'Stock item', 'STOCK-1', null, 20
  );
  perform set_config('task09.shop_id', shop_id::text, true);
  perform set_config('task09.product_id', v_product_id::text, true);

  perform shop_crm.adjust_stock(receipt_one, shop_id, v_product_id, 5, 10, 'First receipt');
  perform shop_crm.adjust_stock(receipt_two, shop_id, v_product_id, 4, 12, 'Second receipt');
  perform shop_crm.adjust_stock(receipt_one, shop_id, v_product_id, 5, 10, 'First receipt');
  if (select quantity_on_hand from shop_crm.product_stock
      where product_id = v_product_id) <> 9 then
    raise exception 'receipt replay changed stock';
  end if;
  perform shop_crm.adjust_stock(writeoff, shop_id, v_product_id, -7, null, 'Fixture write-off');
  if (select quantity_on_hand from shop_crm.product_stock ps
      where ps.product_id = v_product_id) <> 2 then
    raise exception 'write-off balance wrong';
  end if;
  if (select count(*) from shop_crm.inventory_batches b
      where b.product_id = v_product_id and b.remaining_quantity = 0) <> 1
    or (select count(*) from shop_crm.inventory_batches b
        where b.product_id = v_product_id and b.remaining_quantity = 2) <> 1 then
    raise exception 'FIFO batch balance wrong';
  end if;
  if (select count(*) from shop_crm.inventory_movements m
      where m.reference_id = writeoff) <> 2 then
    raise exception 'FIFO cost movements missing';
  end if;
  begin
    perform shop_crm.adjust_stock(
      gen_random_uuid(), shop_id, v_product_id, -3, null, 'Too much stock'
    );
    raise exception 'negative stock accepted';
  exception when sqlstate '23514' then
    if sqlerrm <> 'INSUFFICIENT_STOCK' then raise; end if;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', basic_user::text, true)
from shop_stock_fixture;
set local role authenticated;
do $$
declare
  shop_id uuid;
  product_id uuid;
begin
  shop_id := shop_crm.create_owner_shop('Stock fixture Basic', 'basic');
  product_id := shop_crm.save_product(
    shop_id, null, 'Basic item', null, null, 5
  );
  begin
    perform shop_crm.adjust_stock(
      gen_random_uuid(), shop_id, product_id, 1, 1, null
    );
    raise exception 'Basic received stock';
  exception when sqlstate '42501' then
    if sqlerrm <> 'INVENTORY_NOT_IN_PLAN' then raise; end if;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', outsider_user::text, true)
from shop_stock_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.adjust_stock(
      gen_random_uuid(), current_setting('task09.shop_id')::uuid,
      current_setting('task09.product_id')::uuid, 1, 1, null
    );
    raise exception 'outsider adjusted stock';
  exception when sqlstate '42501' then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end $$;
reset role;

rollback;
