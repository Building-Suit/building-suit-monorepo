-- Execute inside BEGIN after the bootstrap migration (or prepend the migration
-- inside BEGIN for a preflight). Synthetic auth users and shops are rolled back.
create temporary table shop_bootstrap_fixture as
select gen_random_uuid() as first_user, gen_random_uuid() as second_user;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@task05.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb,
  '{"display_name":"Fixture owner"}'::jsonb, now(), now()
from (
  select first_user as id from shop_bootstrap_fixture
  union all select second_user from shop_bootstrap_fixture
) users;

do $$ begin
  if has_function_privilege('anon',
       'shop_crm.create_owner_shop(text,text)', 'EXECUTE')
    or has_function_privilege('anon',
       'shop_private.create_owner_shop(text,text)', 'EXECUTE') then
    raise exception 'anonymous bootstrap execution grant';
  end if;
  if has_table_privilege('authenticated', 'shop_crm.shops', 'INSERT')
    or has_table_privilege('authenticated',
       'shop_crm.subscriptions', 'UPDATE') then
    raise exception 'browser write grant escaped bootstrap';
  end if;
end $$;

select set_config('request.jwt.claim.sub', first_user::text, true)
from shop_bootstrap_fixture;
set local role authenticated;
do $$
declare
  first_shop uuid;
  repeated_shop uuid;
  original_end timestamptz;
begin
  begin
    perform shop_crm.create_owner_shop('x', 'basic');
    raise exception 'short shop name accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'INVALID_SHOP_NAME' then raise; end if;
  end;

  first_shop := shop_crm.create_owner_shop('Fixture shop', 'basic');
  select s.trial_end_at into original_end
  from shop_crm.subscriptions s
  join shop_crm.shop_memberships m on m.profile_id = s.profile_id
  where m.shop_id = first_shop and m.role = 'owner';
  repeated_shop := shop_crm.create_owner_shop('Changed name', 'pro');

  if repeated_shop <> first_shop
    or (select count(*) from shop_crm.shops) <> 1
    or (select count(*) from shop_crm.profiles) <> 1
    or (select count(*) from shop_crm.shop_memberships) <> 1
    or (select count(*) from shop_crm.subscriptions) <> 1 then
    raise exception 'bootstrap was not idempotent';
  end if;
  if (select s.trial_end_at from shop_crm.subscriptions s
      join shop_crm.shop_memberships m on m.profile_id = s.profile_id
      where m.shop_id = first_shop) <> original_end then
    raise exception 'retry extended trial';
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', second_user::text, true)
from shop_bootstrap_fixture;
set local role authenticated;
do $$
declare
  second_shop uuid;
begin
  begin
    perform shop_crm.create_owner_shop('Second shop', 'missing-plan');
    raise exception 'unknown plan accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'PLAN_UNAVAILABLE' then raise; end if;
  end;

  second_shop := shop_crm.create_owner_shop('Second shop', 'pro');
  if (select count(*) from shop_crm.shops) <> 1
    or (select count(*) from shop_crm.shop_memberships) <> 1
    or (select count(*) from shop_crm.subscriptions) <> 1 then
    raise exception 'cross-owner read or bootstrap failed';
  end if;
  if not exists (select 1 from shop_crm.shops where id = second_shop) then
    raise exception 'second owner cannot read own shop';
  end if;
end;
$$;
reset role;

rollback;
