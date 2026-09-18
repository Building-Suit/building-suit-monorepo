-- Run after the service migration inside BEGIN, then ROLLBACK.
create temporary table shop_service_fixture as
select gen_random_uuid() as owner_id, gen_random_uuid() as outsider_id;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@task08-service.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id as id from shop_service_fixture
  union all select outsider_id from shop_service_fixture
) users;

insert into shop_crm.plans (portal_id, name, slug, price_amount, features)
select id, 'Service fixture', 'task-service', 0,
  '{"max_services":1}'::jsonb
from shop_crm.portals where key = 'shop-crm';

do $$ begin
  if has_function_privilege('anon',
      'shop_crm.save_service(uuid,uuid,text,text,numeric,text,numeric)', 'EXECUTE')
    or has_function_privilege('anon',
      'shop_crm.archive_service(uuid,uuid)', 'EXECUTE')
    or has_table_privilege('authenticated', 'shop_crm.services', 'INSERT')
    or has_table_privilege('authenticated', 'shop_crm.services', 'UPDATE') then
    raise exception 'browser service privilege too broad';
  end if;
end $$;

select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_service_fixture;
set local role authenticated;
do $$
declare
  shop_id uuid;
  service_id uuid;
begin
  shop_id := shop_crm.create_owner_shop('Service fixture', 'task-service');
  perform set_config('task_service.shop_id', shop_id::text, true);
  service_id := shop_crm.save_service(
    shop_id, null, 'Repair work', 'Small repair', 100, 'percent', 10
  );
  if not exists (
    select 1 from shop_crm.services
    where id = service_id and base_sale_price = 100
      and default_discount_type = 'percent' and default_discount_value = 10
  ) then raise exception 'service was not readable after creation'; end if;
  if shop_crm.save_service(
      shop_id, service_id, 'Repair work', null, 120, 'amount', 20
    ) <> service_id then raise exception 'service update failed'; end if;
  begin
    perform shop_crm.save_service(shop_id, null, 'Second service', null, 1, 'amount', 0);
    raise exception 'service cap not enforced';
  exception when sqlstate '23514' then
    if sqlerrm <> 'SERVICE_LIMIT_REACHED' then raise; end if;
  end;
  begin
    perform shop_crm.save_service(shop_id, service_id, 'Repair work', null, 10, 'percent', 101);
    raise exception 'invalid percentage accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'INVALID_SERVICE' then raise; end if;
  end;
  perform shop_crm.archive_service(shop_id, service_id);
  perform shop_crm.save_service(shop_id, null, 'Second service', null, 1, 'amount', 0);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', outsider_id::text, true)
from shop_service_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.save_service(
      current_setting('task_service.shop_id')::uuid,
      null, 'Outsider service', null, 1, 'amount', 0
    );
    raise exception 'cross-shop service write accepted';
  exception when sqlstate '42501' then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end $$;
reset role;

update shop_crm.subscriptions set trial_end_at = now() - interval '1 second'
where profile_id in (
  select m.profile_id from shop_crm.shop_memberships m
  where m.shop_id = current_setting('task_service.shop_id')::uuid
);
select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_service_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.save_service(
      current_setting('task_service.shop_id')::uuid,
      null, 'Expired service', null, 1, 'amount', 0
    );
    raise exception 'expired trial service write accepted';
  exception when sqlstate '42501' then
    if sqlerrm <> 'SHOP_SUBSCRIPTION_INACTIVE' then raise; end if;
  end;
end $$;
reset role;

rollback;
