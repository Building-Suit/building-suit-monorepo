-- Run inside BEGIN after the catalog migration, then ROLLBACK.
create temporary table shop_product_fixture as
select gen_random_uuid() as owner_id, gen_random_uuid() as outsider_id;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@task08.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id as id from shop_product_fixture
  union all select outsider_id from shop_product_fixture
) users;

insert into shop_crm.plans (portal_id, name, slug, price_amount, features)
select id, 'Catalog fixture', 'task-catalog', 0,
  '{"max_products":1}'::jsonb
from shop_crm.portals where key = 'shop-crm';

do $$ begin
  if has_function_privilege('anon',
      'shop_crm.save_product(uuid,uuid,text,text,text,numeric)', 'EXECUTE')
    or has_function_privilege('anon',
      'shop_crm.archive_product(uuid,uuid)', 'EXECUTE')
    or has_table_privilege('authenticated', 'shop_crm.products', 'INSERT')
    or has_table_privilege('authenticated', 'shop_crm.products', 'UPDATE') then
    raise exception 'browser product privilege too broad';
  end if;
end $$;

select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_product_fixture;
set local role authenticated;
do $$
declare
  shop_id uuid;
  product_id uuid;
begin
  shop_id := shop_crm.create_owner_shop('Catalog fixture', 'task-catalog');
  perform set_config('task08.shop_id', shop_id::text, true);
  product_id := shop_crm.save_product(
    shop_id, null, 'Test item', 'sku-1', null, 12.50
  );
  if not exists (
    select 1 from shop_crm.products
    where id = product_id and sale_price = 12.50 and is_active
  ) then
    raise exception 'product was not readable after creation';
  end if;
  if shop_crm.save_product(
      shop_id, product_id, 'Updated item', 'sku-1', null, 15.75
    ) <> product_id then
    raise exception 'product update failed';
  end if;
  begin
    perform shop_crm.save_product(
      shop_id, null, 'Second item', 'sku-2', null, 1
    );
    raise exception 'product cap not enforced';
  exception when sqlstate '23514' then
    if sqlerrm <> 'PRODUCT_LIMIT_REACHED' then raise; end if;
  end;
  perform shop_crm.archive_product(shop_id, product_id);
  perform shop_crm.save_product(
    shop_id, null, 'Second item', 'sku-1', null, 1
  );
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', outsider_id::text, true)
from shop_product_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.save_product(
      current_setting('task08.shop_id')::uuid,
      null, 'Outsider item', null, null, 1
    );
    raise exception 'cross-shop write accepted';
  exception when sqlstate '42501' then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end $$;
reset role;

update shop_crm.subscriptions
set trial_end_at = now() - interval '1 second'
where profile_id in (
  select m.profile_id from shop_crm.shop_memberships m
  where m.shop_id = current_setting('task08.shop_id')::uuid
);
select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_product_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.save_product(
      current_setting('task08.shop_id')::uuid,
      null, 'Expired item', null, null, 1
    );
    raise exception 'expired trial write accepted';
  exception when sqlstate '42501' then
    if sqlerrm <> 'SHOP_SUBSCRIPTION_INACTIVE' then raise; end if;
  end;
end $$;
reset role;

rollback;
