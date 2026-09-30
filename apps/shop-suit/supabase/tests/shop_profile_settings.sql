-- SS-HOT-SHOP-SET-001: editable Shop identity, authorization, isolation,
-- audit evidence, and immutable account/document snapshots.
create temporary table shop_profile_fixture as
select gen_random_uuid() owner_id,
  gen_random_uuid() manager_id,
  gen_random_uuid() employee_id,
  gen_random_uuid() outsider_id;

grant select on shop_profile_fixture to authenticated;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@ss-hot-shop-set.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb,
  jsonb_build_object('display_name', display_name), now(), now()
from (
  select owner_id id, 'Personal owner' display_name from shop_profile_fixture
  union all select manager_id, 'Personal manager' from shop_profile_fixture
  union all select employee_id, 'Personal employee' from shop_profile_fixture
  union all select outsider_id, 'Personal outsider' from shop_profile_fixture
) fixture;

do $$
begin
  if has_function_privilege('anon', 'public.save_shop_profile(uuid,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.save_shop_profile(uuid,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'shop_private.save_shop_profile(uuid,text)', 'EXECUTE')
    or has_table_privilege('authenticated', 'public.shops', 'UPDATE')
    or has_table_privilege('authenticated', 'public.shop_profile_changes', 'INSERT') then
    raise exception 'Shop profile browser grant boundary is too broad';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_profile_fixture;
set local role authenticated;
do $$
declare v_shop uuid;
begin
  v_shop := public.create_owner_shop(
    'Original Shop identity', 'mixed'::public.business_mode,
    'Main location', 'MAIN', 'Original address', '+201000000001'
  );
  perform set_config('ss_hot_shop_set.shop', v_shop::text, true);
end;
$$;
reset role;

do $$
declare
  v_shop uuid := current_setting('ss_hot_shop_set.shop')::uuid;
  v_portal uuid;
  v_owner_profile uuid;
  v_location uuid;
  v_manager_profile uuid;
  v_employee_profile uuid;
  v_manager_membership uuid;
  v_invoice uuid;
begin
  select shop.portal_id into v_portal from public.shops shop where shop.id = v_shop;
  select membership.profile_id into v_owner_profile
  from public.shop_memberships membership
  where membership.shop_id = v_shop and membership.role = 'owner';
  select location.id into v_location from public.shop_locations location
  where location.shop_id = v_shop and location.is_default;

  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select manager_id, v_portal, 'Personal manager', manager_id::text || '@ss-hot-shop-set.invalid'
  from shop_profile_fixture returning id into v_manager_profile;
  insert into public.shop_memberships (shop_id, profile_id, role)
  values (v_shop, v_manager_profile, 'employee') returning id into v_manager_membership;
  insert into public.membership_roles (membership_id, role_id)
  select v_manager_membership, role.id from public.roles role
  where role.shop_id = v_shop and role.key = 'manager';

  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select employee_id, v_portal, 'Personal employee', employee_id::text || '@ss-hot-shop-set.invalid'
  from shop_profile_fixture returning id into v_employee_profile;
  insert into public.shop_memberships (shop_id, profile_id, role)
  values (v_shop, v_employee_profile, 'employee');

  insert into public.invoices (
    shop_id, location_id, created_by_profile_id, invoice_number, status,
    issued_at, total_amount, currency
  ) values (
    v_shop, v_location, v_owner_profile, 'PROFILE-SNAPSHOT-1', 'issued',
    now(), 10, 'EGP'
  ) returning id into v_invoice;
  insert into public.sale_receipt_issue_snapshots (invoice_id, shop_id, location_id, snapshot)
  values (v_invoice, v_shop, v_location,
    '{"business":{"name":"Original Shop identity"},"version":1}'::jsonb);
  insert into public.sale_receipts (invoice_id, shop_id, location_id, snapshot, snapshot_version)
  values (v_invoice, v_shop, v_location,
    '{"business":{"name":"Original Shop identity"},"version":1}'::jsonb, 1);
  perform set_config('ss_hot_shop_set.invoice', v_invoice::text, true);
end;
$$;

create temporary table shop_profile_account_snapshot as
select auth_user.id,
  jsonb_build_object('email', auth_user.email, 'metadata', auth_user.raw_user_meta_data) identity
from auth.users auth_user
join shop_profile_fixture fixture on fixture.owner_id = auth_user.id;

select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_profile_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('ss_hot_shop_set.shop')::uuid;
  v_profile_snapshot jsonb;
  v_saved_name text;
  v_persisted_name text;
  v_change_count bigint;
begin
  select to_jsonb(profile) into v_profile_snapshot from public.profiles profile
  join shop_profile_fixture fixture on fixture.owner_id = profile.user_id;

  v_saved_name := public.save_shop_profile(v_shop, '  Owner-renamed Shop  ');
  select name into v_persisted_name from public.shops where id = v_shop;
  if v_saved_name is distinct from 'Owner-renamed Shop'
    or v_persisted_name is distinct from 'Owner-renamed Shop' then
    raise exception 'owner Shop profile update failed';
  end if;
  v_saved_name := public.save_shop_profile(v_shop, 'Owner-renamed Shop');
  select count(*) into v_change_count
  from public.shop_profile_changes where shop_id = v_shop;
  if v_saved_name is distinct from 'Owner-renamed Shop'
    or v_change_count <> 1 then
    raise exception 'identical Shop profile update was not idempotent';
  end if;
  if (select to_jsonb(profile) from public.profiles profile
      join shop_profile_fixture fixture on fixture.owner_id = profile.user_id) <> v_profile_snapshot then
    raise exception 'Shop profile update changed personal profile identity';
  end if;
end;
$$;
reset role;

do $$
begin
  if (
    select jsonb_build_object(
      'email', auth_user.email,
      'metadata', auth_user.raw_user_meta_data
    )
    from auth.users auth_user
    join shop_profile_fixture fixture on fixture.owner_id = auth_user.id
  ) is distinct from (
    select snapshot.identity from shop_profile_account_snapshot snapshot
  ) then
    raise exception 'Shop profile update changed personal Auth identity';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', manager_id::text, true)
from shop_profile_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_hot_shop_set.shop')::uuid;
begin
  if public.save_shop_profile(v_shop, 'Manager-renamed Shop') <> 'Manager-renamed Shop' then
    raise exception 'settings manager Shop profile update failed';
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', employee_id::text, true)
from shop_profile_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.save_shop_profile(
      current_setting('ss_hot_shop_set.shop')::uuid, 'Employee rename'
    );
    raise exception 'ordinary employee Shop profile update accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', outsider_id::text, true)
from shop_profile_fixture;
set local role authenticated;
do $$
declare v_other_shop uuid;
begin
  v_other_shop := public.create_owner_shop(
    'Outsider Shop', 'service'::public.business_mode,
    'Outsider main', null, null, null
  );
  begin
    perform public.save_shop_profile(
      current_setting('ss_hot_shop_set.shop')::uuid, 'Cross-shop rename'
    );
    raise exception 'cross-shop profile update accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
  if (select name from public.shops where id = v_other_shop) <> 'Outsider Shop' then
    raise exception 'cross-shop denial changed the caller Shop';
  end if;
end;
$$;
reset role;

do $$
declare
  v_shop uuid := current_setting('ss_hot_shop_set.shop')::uuid;
  v_invoice uuid := current_setting('ss_hot_shop_set.invoice')::uuid;
begin
  if (select name from public.shops where id = v_shop) <> 'Manager-renamed Shop'
    or (select count(*) from public.shop_profile_changes where shop_id = v_shop) <> 2
    or not exists (
      select 1 from public.shop_profile_changes profile_change
      join public.profiles profile on profile.id = profile_change.changed_by_profile_id
      join shop_profile_fixture fixture on fixture.owner_id = profile.user_id
      where profile_change.shop_id = v_shop
        and profile_change.previous_name = 'Original Shop identity'
        and profile_change.new_name = 'Owner-renamed Shop'
    )
    or not exists (
      select 1 from public.shop_profile_changes profile_change
      join public.profiles profile on profile.id = profile_change.changed_by_profile_id
      join shop_profile_fixture fixture on fixture.manager_id = profile.user_id
      where profile_change.shop_id = v_shop
        and profile_change.previous_name = 'Owner-renamed Shop'
        and profile_change.new_name = 'Manager-renamed Shop'
    ) then
    raise exception 'Shop profile audit evidence is incomplete';
  end if;
  if (select snapshot #>> '{business,name}' from public.sale_receipt_issue_snapshots
      where invoice_id = v_invoice) <> 'Original Shop identity'
    or (select snapshot #>> '{business,name}' from public.sale_receipts
      where invoice_id = v_invoice) <> 'Original Shop identity' then
    raise exception 'Shop profile update rewrote historical receipt snapshots';
  end if;
  if (select address from public.shop_locations where shop_id = v_shop and is_default)
      <> 'Original address'
    or (select phone from public.shop_locations where shop_id = v_shop and is_default)
      <> '+201000000001' then
    raise exception 'Shop profile update duplicated or changed main-location contact data';
  end if;
  begin
    update public.shop_profile_changes set new_name = 'Tampered' where shop_id = v_shop;
    raise exception 'Shop profile audit history was mutable';
  exception when sqlstate '55000' then
    if sqlerrm <> 'SHOP_PROFILE_CHANGE_IMMUTABLE' then raise; end if;
  end;
end;
$$;
