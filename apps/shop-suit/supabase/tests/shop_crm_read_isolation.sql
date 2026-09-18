-- Run only against the intended hosted project after the read-isolation
-- migration. This creates synthetic users/shops and rolls back everything.
begin;

create temporary table task03_fixture as
select gen_random_uuid() as owner_id,
  gen_random_uuid() as employee_id,
  gen_random_uuid() as outsider_id,
  gen_random_uuid() as owner_profile_id,
  gen_random_uuid() as employee_profile_id,
  gen_random_uuid() as outsider_profile_id,
  gen_random_uuid() as shop_a_id,
  gen_random_uuid() as shop_b_id;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@task03.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id as id from task03_fixture
  union all select employee_id from task03_fixture
  union all select outsider_id from task03_fixture
) users;

insert into shop_crm.profiles (id, user_id, portal_id, display_name)
select f.owner_profile_id, f.owner_id, p.id, 'Task 03 owner'
from task03_fixture f cross join shop_crm.portals p where p.key = 'shop-crm'
union all
select f.employee_profile_id, f.employee_id, p.id, 'Task 03 employee'
from task03_fixture f cross join shop_crm.portals p where p.key = 'shop-crm'
union all
select f.outsider_profile_id, f.outsider_id, p.id, 'Task 03 outsider'
from task03_fixture f cross join shop_crm.portals p where p.key = 'shop-crm';

insert into shop_crm.shops (id, portal_id, name)
select f.shop_a_id, p.id, 'Task 03 shop A'
from task03_fixture f cross join shop_crm.portals p where p.key = 'shop-crm'
union all
select f.shop_b_id, p.id, 'Task 03 shop B'
from task03_fixture f cross join shop_crm.portals p where p.key = 'shop-crm';

insert into shop_crm.shop_memberships (shop_id, profile_id, role)
select shop_a_id, owner_profile_id, 'owner' from task03_fixture
union all select shop_a_id, employee_profile_id, 'employee' from task03_fixture
union all select shop_b_id, outsider_profile_id, 'owner' from task03_fixture;

insert into shop_crm.products (shop_id, name, created_by_profile_id)
select shop_a_id, 'Task 03 product A', owner_profile_id from task03_fixture
union all
select shop_b_id, 'Task 03 product B', outsider_profile_id from task03_fixture;

-- These settings are test fixture identifiers, not authorization inputs.
select set_config('task03.shop_a', shop_a_id::text, true),
  set_config('task03.shop_b', shop_b_id::text, true),
  set_config('task03.owner_profile', owner_profile_id::text, true),
  set_config('task03.owner_id', owner_id::text, true),
  set_config('task03.employee_id', employee_id::text, true),
  set_config('task03.outsider_id', outsider_id::text, true)
from task03_fixture;

-- Owner can read only their shop, with or without a subscription row.
select set_config('request.jwt.claim.sub', current_setting('task03.owner_id'), true);
set local role authenticated;
do $$ begin
  if (select count(*) from shop_crm.shops
      where id in (current_setting('task03.shop_a')::uuid,
                   current_setting('task03.shop_b')::uuid)) <> 1 then
    raise exception 'owner shop isolation failed';
  end if;
  if (select count(*) from shop_crm.products
      where shop_id in (current_setting('task03.shop_a')::uuid,
                        current_setting('task03.shop_b')::uuid)) <> 1 then
    raise exception 'owner product isolation or history read failed';
  end if;
  if has_table_privilege('authenticated', 'shop_crm.products', 'UPDATE')
    or has_table_privilege('authenticated', 'shop_crm.subscriptions', 'UPDATE')
    or has_table_privilege('authenticated', 'shop_crm.role_permissions', 'INSERT')
    or has_table_privilege('authenticated', 'shop_crm.products', 'TRUNCATE') then
    raise exception 'browser mutation privilege remains';
  end if;
  if has_table_privilege('authenticated', 'shop_crm.net_profit', 'SELECT') then
    raise exception 'unsafe view grant remains';
  end if;
end $$;
reset role;

-- An employee without a permission row sees membership but no product data.
select set_config('request.jwt.claim.sub', current_setting('task03.employee_id'), true);
set local role authenticated;
do $$ begin
  if (select count(*) from shop_crm.shops
      where id = current_setting('task03.shop_a')::uuid) <> 1 then
    raise exception 'active employee membership unreadable';
  end if;
  if (select count(*) from shop_crm.products
      where shop_id = current_setting('task03.shop_a')::uuid) <> 0 then
    raise exception 'employee without permission read products';
  end if;
end $$;
reset role;

-- A matching role grant unlocks only the employee's own shop. The production
-- permission catalog is empty; these are synthetic, rolled-back rows.
insert into shop_crm.permissions (portal_id, key, description)
select p.id, 'inventory.view', 'Task 03 test permission'
from shop_crm.portals p where p.key = 'shop-crm';
insert into shop_crm.roles (shop_id, name)
select shop_a_id, 'Task 03 stock viewer' from task03_fixture;
insert into shop_crm.role_permissions (role_id, permission_id)
select r.id, perm.id from shop_crm.roles r
join shop_crm.permissions perm on perm.key = 'inventory.view'
join task03_fixture f on f.shop_a_id = r.shop_id
where r.name = 'Task 03 stock viewer';
insert into shop_crm.membership_roles (membership_id, role_id)
select m.id, r.id from shop_crm.shop_memberships m
join shop_crm.roles r on r.shop_id = m.shop_id
join task03_fixture f on f.shop_a_id = m.shop_id
where m.profile_id = f.employee_profile_id and r.name = 'Task 03 stock viewer';

select set_config('request.jwt.claim.sub', current_setting('task03.employee_id'), true);
set local role authenticated;
do $$ begin
  if (select count(*) from shop_crm.products
      where shop_id in (current_setting('task03.shop_a')::uuid,
                        current_setting('task03.shop_b')::uuid)) <> 1 then
    raise exception 'employee role grant or tenant filter failed';
  end if;
end $$;
reset role;

-- Suspension takes effect without a new JWT.
update shop_crm.shop_memberships set status = 'suspended'
where profile_id = (select employee_profile_id from task03_fixture);
select set_config('request.jwt.claim.sub', current_setting('task03.employee_id'), true);
set local role authenticated;
do $$ begin
  if (select count(*) from shop_crm.shops
      where id = current_setting('task03.shop_a')::uuid) <> 0 then
    raise exception 'suspended employee still sees shop';
  end if;
end $$;
reset role;

-- Another shop's owner cannot see Shop A.
select set_config('request.jwt.claim.sub', current_setting('task03.outsider_id'), true);
set local role authenticated;
do $$ begin
  if (select count(*) from shop_crm.products
      where shop_id = current_setting('task03.shop_a')::uuid) <> 0 then
    raise exception 'other shop owner crossed tenant boundary';
  end if;
end $$;
reset role;

-- The closed-period trigger must read the private shop table regardless of
-- the actor's ability to list accounting periods.
insert into shop_crm.accounting_periods (
  shop_id, period_start, period_end, is_closed
) select shop_a_id, current_date, current_date, true from task03_fixture;
set local role service_role;
do $$ begin
  begin
    insert into shop_crm.expenses (
      shop_id, title, amount, created_by_profile_id
    ) values (current_setting('task03.shop_a')::uuid,
      'Task 03 closed period expense', 1,
      current_setting('task03.owner_profile')::uuid);
    raise exception 'closed-period trigger did not run';
  exception when others then
    if sqlerrm <> 'ACCOUNTING_PERIOD_CLOSED' then raise; end if;
  end;
  begin
    insert into shop_crm.invoices (
      shop_id, created_by_profile_id, invoice_number, status, issued_at,
      total_amount
    ) values (current_setting('task03.shop_a')::uuid,
      current_setting('task03.owner_profile')::uuid,
      'TASK03-CLOSED', 'issued', now(), 1);
    raise exception 'closed-period invoice trigger did not run';
  exception when others then
    if sqlerrm <> 'ACCOUNTING_PERIOD_CLOSED' then raise; end if;
  end;
  begin
    insert into shop_crm.payments (
      shop_id, payment_direction, amount, method, created_by_profile_id
    ) values (current_setting('task03.shop_a')::uuid, 'in', 1, 'cash',
      current_setting('task03.owner_profile')::uuid);
    raise exception 'closed-period payment trigger did not run';
  exception when others then
    if sqlerrm <> 'ACCOUNTING_PERIOD_CLOSED' then raise; end if;
  end;
end $$;
reset role;

-- Anonymous visitors cannot read shops or the unrestricted plan columns.
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$ begin
  if has_table_privilege('anon', 'shop_crm.shops', 'SELECT')
    or has_column_privilege('anon', 'shop_crm.plans', 'stripe_price_id', 'SELECT')
    or has_table_privilege('anon', 'shop_crm.net_profit', 'SELECT') then
    raise exception 'anonymous shop or provider access remains';
  end if;
end $$;
reset role;

-- One explicit public setting is all that should still be outside shop_crm.
do $$ begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'shop_crm' and c.relkind = 'v'
      and not (c.reloptions @> array['security_invoker=true'])
  ) then raise exception 'a shop reporting view still bypasses RLS'; end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'shop_crm' and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  ) then raise exception 'a shop table has RLS disabled'; end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'shop_crm' and c.relkind in ('r', 'p', 'v')
      and (
        has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE')
        or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('anon', c.oid, 'TRUNCATE')
        or has_table_privilege('authenticated', c.oid, 'INSERT')
        or has_table_privilege('authenticated', c.oid, 'UPDATE')
        or has_table_privilege('authenticated', c.oid, 'DELETE')
        or has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      )
  ) then raise exception 'a shop browser write privilege remains'; end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'shop_crm' and c.relkind = 'v'
      and (has_table_privilege('anon', c.oid, 'SELECT')
        or has_table_privilege('authenticated', c.oid, 'SELECT'))
  ) then raise exception 'a shop report view is browser-readable'; end if;
  if has_function_privilege('authenticated',
      'public.issue_invoice_and_deduct_inventory(uuid, uuid)', 'EXECUTE') then
    raise exception 'legacy invoice RPC is browser-callable';
  end if;
end $$;

rollback;
select 'task03_read_isolation_passed_and_rolled_back' as result;
