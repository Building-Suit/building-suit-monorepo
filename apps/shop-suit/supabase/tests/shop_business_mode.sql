-- Focused SS-BIZ-001 regression suite. Run inside a transaction and roll back.
create temporary table shop_business_mode_fixture as
select gen_random_uuid() as product_owner_id,
  gen_random_uuid() as service_owner_id,
  gen_random_uuid() as mixed_owner_id,
  gen_random_uuid() as employee_id,
  gen_random_uuid() as outsider_id;

insert into auth.users (
  id, email, encrypted_password, aud, role,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@ss-biz-001.invalid', 'x', 'authenticated',
  'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select product_owner_id as id from shop_business_mode_fixture
  union all select service_owner_id from shop_business_mode_fixture
  union all select mixed_owner_id from shop_business_mode_fixture
  union all select employee_id from shop_business_mode_fixture
  union all select outsider_id from shop_business_mode_fixture
) users;

do $$
declare
  v_default text;
begin
  if (select array_agg(enumlabel::text order by enumsortorder)
      from pg_enum where enumtypid = 'public.business_mode'::regtype)
      <> array['product', 'service', 'mixed'] then
    raise exception 'business mode enum values differ from the supported contract';
  end if;
  if (select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'shops'
        and column_name = 'business_mode') <> 'NO' then
    raise exception 'shops.business_mode is nullable';
  end if;
  select pg_get_expr(ad.adbin, ad.adrelid) into v_default
  from pg_attribute a
  join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
  where a.attrelid = 'public.shops'::regclass and a.attname = 'business_mode';
  if v_default <> '''mixed''::business_mode' then
    raise exception 'existing-shop compatibility default is not mixed: %', v_default;
  end if;
  if exists (select 1 from public.shops where business_mode is null)
    or exists (select 1 from public.shops where business_mode::text not in ('product', 'service', 'mixed')) then
    raise exception 'existing shop backfill produced an invalid mode';
  end if;
  if has_function_privilege('anon',
      'public.set_shop_business_mode(uuid,public.business_mode)', 'EXECUTE')
    or has_table_privilege('authenticated', 'public.shops', 'UPDATE')
    or has_table_privilege('authenticated', 'public.shop_business_mode_changes', 'INSERT') then
    raise exception 'business mode browser grants are too broad';
  end if;
  begin
    perform public.create_owner_shop('Invalid enum fixture', 'pro', 'retail');
    raise exception 'unsupported business mode accepted';
  exception when invalid_text_representation then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', product_owner_id::text, true)
from shop_business_mode_fixture;
set local role authenticated;
do $$
declare
  v_shop_id uuid;
  v_retry_id uuid;
  v_product_id uuid;
  v_vendor_id uuid;
  v_purchase_id uuid;
  v_request_id uuid := gen_random_uuid();
  v_subscription_before jsonb;
  v_plan_before jsonb;
begin
  begin
    perform public.create_owner_shop(
      'Invalid mode fixture', 'pro', null::public.business_mode
    );
    raise exception 'null business mode accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'INVALID_BUSINESS_MODE' then raise; end if;
  end;

  v_shop_id := public.create_owner_shop(
    'Product mode fixture', 'pro', 'product'::public.business_mode
  );
  v_retry_id := public.create_owner_shop(
    'Changed retry name', 'basic', 'mixed'::public.business_mode
  );
  if v_retry_id <> v_shop_id
    or (select business_mode from public.shops where id = v_shop_id) <> 'product'
    or (select count(*) from public.shops) <> 1
    or (select count(*) from public.subscriptions) <> 1 then
    raise exception 'explicit-mode bootstrap retry was not idempotent';
  end if;

  select jsonb_build_object(
      'plan_id', s.plan_id,
      'status', s.status,
      'trial_start_at', s.trial_start_at,
      'trial_end_at', s.trial_end_at,
      'current_period_start', s.current_period_start,
      'current_period_end', s.current_period_end,
      'trial_consumed', s.trial_consumed,
      'locked_at', s.locked_at,
      'created_at', s.created_at,
      'updated_at', s.updated_at
    ), to_jsonb(p.features)
    into v_subscription_before, v_plan_before
  from public.subscriptions s
  join public.shop_memberships m on m.profile_id = s.profile_id
  join public.plans p on p.id = s.plan_id
  where m.shop_id = v_shop_id and m.role = 'owner';

  v_product_id := public.save_product(
    v_shop_id, null, 'Preserved product', 'BIZ-PRODUCT', null, 20
  );
  perform public.adjust_stock(
    gen_random_uuid(), v_shop_id, v_product_id, 5, 7, 'Preserved stock'
  );
  v_vendor_id := public.create_vendor(
    v_shop_id, 'Preserved supplier', null, null, null, null, null, null
  );
  v_purchase_id := public.create_supplier_purchase(
    v_request_id, v_shop_id, v_vendor_id, 'BIZ-PURCHASE', current_date,
    'Preserved purchase',
    jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id, 'quantity', 2, 'unit_cost', 6
    ))
  );

  if public.set_shop_business_mode(v_shop_id, 'mixed') <> 'mixed' then
    raise exception 'owner could not change mode';
  end if;
  perform public.save_service(
    v_shop_id, null, 'Preserved service', null, 30, 'amount', 0
  );
  if public.set_shop_business_mode(v_shop_id, 'service') <> 'service' then
    raise exception 'owner could not switch to service mode';
  end if;
  if public.set_shop_business_mode(v_shop_id, 'service') <> 'service'
    or (select count(*) from public.shop_business_mode_changes where shop_id = v_shop_id) <> 2 then
    raise exception 'identical mode update was not idempotent';
  end if;

  if not exists (select 1 from public.products where id = v_product_id)
    or not exists (select 1 from public.services where shop_id = v_shop_id and name = 'Preserved service')
    or not exists (select 1 from public.inventory_batches where shop_id = v_shop_id and product_id = v_product_id)
    or not exists (select 1 from public.inventory_movements where shop_id = v_shop_id and product_id = v_product_id)
    or not exists (select 1 from public.vendor_invoices where id = v_purchase_id)
    or not exists (select 1 from public.vendor_invoice_items where vendor_invoice_id = v_purchase_id) then
    raise exception 'historical product, service, stock, or purchase data was lost';
  end if;
  if (select jsonb_build_object(
        'plan_id', s.plan_id,
        'status', s.status,
        'trial_start_at', s.trial_start_at,
        'trial_end_at', s.trial_end_at,
        'current_period_start', s.current_period_start,
        'current_period_end', s.current_period_end,
        'trial_consumed', s.trial_consumed,
        'locked_at', s.locked_at,
        'created_at', s.created_at,
        'updated_at', s.updated_at
      ) from public.subscriptions s
      join public.shop_memberships m on m.profile_id = s.profile_id
      where m.shop_id = v_shop_id and m.role = 'owner') <> v_subscription_before then
    raise exception 'mode change mutated subscription, quota, trial, or renewal state';
  end if;
  if (select to_jsonb(p.features) from public.plans p
      join public.subscriptions s on s.plan_id = p.id
      join public.shop_memberships m on m.profile_id = s.profile_id
      where m.shop_id = v_shop_id and m.role = 'owner') <> v_plan_before then
    raise exception 'mode change mutated plan quota or inventory entitlement';
  end if;
  if not exists (
    select 1 from public.shop_business_mode_changes c
    where c.shop_id = v_shop_id and c.previous_mode = 'product'
      and c.new_mode = 'mixed' and c.changed_by_profile_id is not null
      and c.changed_at is not null
  ) or not exists (
    select 1 from public.shop_business_mode_changes c
    where c.shop_id = v_shop_id and c.previous_mode = 'mixed'
      and c.new_mode = 'service'
  ) then
    raise exception 'business mode audit evidence is incomplete';
  end if;

  perform set_config('ss_biz.product_shop', v_shop_id::text, true);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', service_owner_id::text, true)
from shop_business_mode_fixture;
set local role authenticated;
do $$
declare
  v_shop_id uuid;
begin
  v_shop_id := public.create_owner_shop(
    'Service mode fixture', 'basic', 'service'::public.business_mode
  );
  perform public.save_service(
    v_shop_id, null, 'Stock-free service', null, 15, 'amount', 0
  );
  if (select business_mode from public.shops where id = v_shop_id) <> 'service'
    or exists (select 1 from public.products where shop_id = v_shop_id)
    or exists (select 1 from public.inventory_batches where shop_id = v_shop_id)
    or not exists (select 1 from public.services where shop_id = v_shop_id) then
    raise exception 'service-mode shop required or created stock records';
  end if;
  perform set_config('ss_biz.service_shop', v_shop_id::text, true);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', mixed_owner_id::text, true)
from shop_business_mode_fixture;
set local role authenticated;
do $$
declare
  v_shop_id uuid;
begin
  v_shop_id := public.create_owner_shop(
    'Mixed mode fixture', 'basic', 'mixed'::public.business_mode
  );
  if (select business_mode from public.shops where id = v_shop_id) <> 'mixed' then
    raise exception 'mixed-mode shop was not created';
  end if;
  begin
    perform public.set_shop_business_mode(
      current_setting('ss_biz.product_shop')::uuid, 'mixed'
    );
    raise exception 'cross-shop mode change accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_OWNER_REQUIRED' then raise; end if;
  end;
end;
$$;
reset role;

do $$
declare
  v_portal_id uuid;
  v_profile_id uuid;
begin
  select portal_id into v_portal_id from public.shops
  where id = current_setting('ss_biz.product_shop')::uuid;
  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select employee_id, v_portal_id, 'Fixture employee', 'employee@ss-biz-001.invalid'
  from shop_business_mode_fixture
  returning id into v_profile_id;
  insert into public.shop_memberships (shop_id, profile_id, role)
  values (current_setting('ss_biz.product_shop')::uuid, v_profile_id, 'employee');
end;
$$;

select set_config('request.jwt.claim.sub', employee_id::text, true)
from shop_business_mode_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.set_shop_business_mode(
      current_setting('ss_biz.product_shop')::uuid, 'mixed'
    );
    raise exception 'employee mode change accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_OWNER_REQUIRED' then raise; end if;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', outsider_id::text, true)
from shop_business_mode_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.set_shop_business_mode(
      current_setting('ss_biz.product_shop')::uuid, 'product'
    );
    raise exception 'outsider mode change accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_OWNER_REQUIRED' then raise; end if;
  end;
end;
$$;
reset role;
