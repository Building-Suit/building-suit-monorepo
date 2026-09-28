-- SS-ADMIN-001: authority separation, cross-tenant reads, bounded controls,
-- immutable mutation evidence, subscription state, and suspension enforcement.

create temporary table shop_platform_admin_fixture as
select gen_random_uuid() as owner_id, gen_random_uuid() as staff_id,
  gen_random_uuid() as observer_id, gen_random_uuid() as operator_id,
  gen_random_uuid() as outsider_id, gen_random_uuid() as command_id;

grant select on shop_platform_admin_fixture to authenticated;

insert into auth.users (
  id, email, encrypted_password, aud, role,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@ss-admin-001.invalid', 'x', 'authenticated',
  'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id as id from shop_platform_admin_fixture
  union all select staff_id from shop_platform_admin_fixture
  union all select observer_id from shop_platform_admin_fixture
  union all select operator_id from shop_platform_admin_fixture
  union all select outsider_id from shop_platform_admin_fixture
) users;

do $$
declare function_row record;
begin
  for function_row in
    select procedure.oid, procedure.proname, procedure.prosecdef, procedure.proconfig
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        'platform_admin_session', 'platform_admin_read', 'platform_admin_command'
      ])
  loop
    if not function_row.prosecdef
      or function_row.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', function_row.oid, 'execute')
      or has_function_privilege('anon', function_row.oid, 'execute') then
      raise exception 'unsafe platform-admin wrapper: %', function_row.proname;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.platform_admins', 'select')
    or has_table_privilege('authenticated', 'public.platform_admins', 'insert')
    or has_table_privilege('authenticated', 'public.platform_admin_events', 'select')
    or has_table_privilege('authenticated', 'public.shop_membership_events', 'select')
    or has_table_privilege('authenticated', 'public.shop_billing_submissions', 'update') then
    raise exception 'platform-admin tables are browser-accessible';
  end if;
  if exists (
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname ilike '%impersonat%'
  ) then
    raise exception 'tenant impersonation surface exists';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_platform_admin_fixture;
set local role authenticated;
do $$
declare v_shop uuid;
begin
  v_shop := public.create_owner_shop('Admin fixture shop', 'pro', 'mixed');
  perform set_config('ss_admin.shop', v_shop::text, true);
end;
$$;
reset role;

do $$
declare
  v_shop uuid := current_setting('ss_admin.shop')::uuid;
  v_staff_profile uuid;
begin
  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
  select fixture.staff_id, shop.portal_id, 'Admin fixture staff', 'staff@ss-admin-001.invalid'
  from shop_platform_admin_fixture fixture
  join public.shops shop on shop.id = v_shop
  returning id into v_staff_profile;
  insert into public.shop_memberships (shop_id, profile_id, role, status)
  values (v_shop, v_staff_profile, 'staff', 'active');

  insert into public.platform_admins (user_id, role, display_name)
  select observer_id, 'observer', 'Read-only operator' from shop_platform_admin_fixture
  union all
  select operator_id, 'operator', 'Support operator' from shop_platform_admin_fixture;

  insert into public.shop_billing_submissions (
    shop_id, kind, status, amount, reference, metadata
  ) values (v_shop, 'activation', 'submitted', 1199, 'BILL-001', '{"channel":"instapay_manual"}');
end;
$$;

-- A tenant owner and an outsider cannot read or self-grant platform authority.
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_platform_admin_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.platform_admin_session();
    raise exception 'tenant owner entered platform admin';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.platform_admins (user_id, role) values (auth.uid(), 'operator');
    raise exception 'tenant owner self-granted platform authority';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', outsider_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_platform_admin_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.platform_admin_read('dashboard');
    raise exception 'outsider read cross-tenant administration data';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- An observer can inspect cross-tenant state but cannot mutate it.
select set_config('request.jwt.claim.sub', observer_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_platform_admin_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('ss_admin.shop')::uuid;
  v_dashboard jsonb;
  v_detail jsonb;
begin
  if public.platform_admin_session() ->> 'role' <> 'observer' then
    raise exception 'observer session role missing';
  end if;
  v_dashboard := public.platform_admin_read('dashboard');
  v_detail := public.platform_admin_read('shop', v_shop);
  if (v_dashboard ->> 'shops')::integer < 1
    or (public.platform_admin_billing_read('summary') ->> 'open')::integer < 1
    or jsonb_array_length(v_detail -> 'locations') <> 1
    or jsonb_array_length(v_detail -> 'members') <> 2
    or v_detail #>> '{owner,email}' is null then
    raise exception 'observer projection is incomplete';
  end if;
  begin
    perform public.platform_admin_command(
      gen_random_uuid(), v_shop, 'suspend_shop', 'Observer denial test', '{}'::jsonb
    );
    raise exception 'observer mutated tenant state';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- The operator uses only the bounded command surface. Each actual mutation is
-- atomic with a complete before/after audit event and explicit reason.
select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_platform_admin_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('ss_admin.shop')::uuid;
  v_command uuid := (select command_id from shop_platform_admin_fixture);
  v_result jsonb;
  v_detail jsonb;
  v_audit jsonb;
begin
  if public.platform_admin_session() ->> 'role' <> 'operator' then
    raise exception 'operator session role missing';
  end if;

  v_result := public.platform_admin_command(
    v_command, v_shop, 'suspend_shop', 'Investigating reported account takeover', '{}'::jsonb
  );
  if (v_result ->> 'replayed')::boolean
    or public.platform_admin_read('shop', v_shop) #>> '{shop,status}' <> 'suspended' then
    raise exception 'shop suspension failed';
  end if;
  v_result := public.platform_admin_command(
    v_command, v_shop, 'suspend_shop', 'Investigating reported account takeover', '{}'::jsonb
  );
  if not (v_result ->> 'replayed')::boolean
    or (public.platform_admin_read('audit', v_shop) ->> 'total')::integer <> 1 then
    raise exception 'admin command idempotency failed';
  end if;

  perform public.platform_admin_command(
    gen_random_uuid(), v_shop, 'reactivate_shop', 'Identity was verified', '{}'::jsonb
  );
  perform public.platform_admin_command(
    gen_random_uuid(), v_shop, 'extend_trial', 'Approved seven-day support extension', '{"days":7}'::jsonb
  );
  perform public.platform_admin_command(
    gen_random_uuid(), v_shop, 'end_trial', 'Customer requested trial closure', '{}'::jsonb
  );
  if public.platform_admin_read('shop', v_shop) #>> '{subscription,status}' <> 'expired' then
    raise exception 'trial end state failed';
  end if;
  perform public.platform_admin_command(
    gen_random_uuid(), v_shop, 'activate_subscription', 'Offline payment approved',
    '{"days":30,"planSlug":"pro"}'::jsonb
  );
  perform public.platform_admin_command(
    gen_random_uuid(), v_shop, 'extend_subscription', 'Annual loyalty extension', '{"days":30}'::jsonb
  );
  perform public.platform_admin_command(
    gen_random_uuid(), v_shop, 'correct_billing_metadata', 'Corrected bank transfer reference',
    '{"billingReference":"BANK-002","billingNote":"Verified against receipt"}'::jsonb
  );
  perform public.platform_admin_command(
    gen_random_uuid(), v_shop, 'add_support_note', 'Recorded support outcome',
    '{"note":"Owner identity verified by the approved support process."}'::jsonb
  );

  v_detail := public.platform_admin_read('shop', v_shop);
  if v_detail #>> '{subscription,status}' <> 'active'
    or v_detail #>> '{subscription,billingMetadata,billingReference}' <> 'BANK-002'
    or jsonb_array_length(v_detail -> 'supportNotes') <> 1
    or v_detail #>> '{supportNotes,0,note}' <> 'Owner identity verified by the approved support process.'
    or jsonb_array_length(v_detail -> 'sensitiveEvents') < 8 then
    raise exception 'support projection did not retain admin history';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_detail -> 'sensitiveEvents') event
    where event ->> 'type' = 'team'
  ) then
    raise exception 'team membership history is missing from sensitive audit';
  end if;
  v_audit := public.platform_admin_read('audit', v_shop, null, null, 1, 100);
  if (v_audit ->> 'total')::integer <> 8 or exists (
    select 1 from jsonb_array_elements(v_audit -> 'items') event
    where event ->> 'reason' is null
      or event -> 'beforeState' is null
      or event -> 'afterState' is null
  ) then
    raise exception 'admin mutation is missing audit evidence';
  end if;
  if has_table_privilege('authenticated', 'public.invoices', 'update')
    or has_table_privilege('authenticated', 'public.inventory_movements', 'delete')
    or has_table_privilege('authenticated', 'public.payments', 'update') then
    raise exception 'operator role can directly edit operational history';
  end if;
end;
$$;
reset role;

do $$
begin
  begin
    update public.platform_admin_events set reason = 'rewritten'
    where request_id = (select command_id from shop_platform_admin_fixture);
    raise exception 'platform audit was mutable';
  exception when sqlstate '55000' then null;
  end;
end;
$$;

-- Shop suspension is enforced by the common backend membership boundary while
-- preserving every membership, subscription, location, and operational row.
select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_platform_admin_fixture;
set local role authenticated;
select public.platform_admin_command(
  gen_random_uuid(), current_setting('ss_admin.shop')::uuid,
  'suspend_shop', 'Final suspension enforcement check', '{}'::jsonb
);
reset role;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_platform_admin_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('ss_admin.shop')::uuid;
  v_user uuid;
begin
  for v_user in
    select owner_id from shop_platform_admin_fixture
    union all select staff_id from shop_platform_admin_fixture
    union all select outsider_id from shop_platform_admin_fixture
  loop
    perform set_config('request.jwt.claim.sub', v_user::text, true);
    if (select count(*) from public.list_shop_locations(v_shop)) <> 0 then
      raise exception 'suspended tenant locations leaked through RPC';
    end if;
    if (select count(*) from public.shop_memberships where shop_id = v_shop) <> 0 then
      raise exception 'suspended tenant rows leaked through RLS';
    end if;
  end loop;
end;
$$;
reset role;

do $$
declare v_shop uuid := current_setting('ss_admin.shop')::uuid;
begin
  if (select count(*) from public.shop_memberships where shop_id = v_shop) <> 2
    or (select count(*) from public.shop_locations where shop_id = v_shop) <> 1
    or not exists (select 1 from public.subscriptions subscription
      join public.shop_memberships membership on membership.profile_id = subscription.profile_id
      where membership.shop_id = v_shop and membership.role = 'owner') then
    raise exception 'suspension deleted tenant history';
  end if;
end;
$$;

-- Reactivation restores owner/team and staff/self reads without opening access
-- to outsiders or granting staff visibility of another member's row.
select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_platform_admin_fixture;
set local role authenticated;
select public.platform_admin_command(
  gen_random_uuid(), current_setting('ss_admin.shop')::uuid,
  'reactivate_shop', 'Verify membership access after reactivation', '{}'::jsonb
);
do $$
declare
  v_shop uuid := current_setting('ss_admin.shop')::uuid;
  v_case record;
begin
  for v_case in
    select owner_id as user_id, 2 as expected from shop_platform_admin_fixture
    union all select staff_id, 1 from shop_platform_admin_fixture
    union all select outsider_id, 0 from shop_platform_admin_fixture
  loop
    perform set_config('request.jwt.claim.sub', v_case.user_id::text, true);
    if (select count(*) from public.shop_memberships where shop_id = v_shop) <> v_case.expected then
      raise exception 'reactivation changed owner/self membership visibility';
    end if;
  end loop;
end;
$$;
reset role;
