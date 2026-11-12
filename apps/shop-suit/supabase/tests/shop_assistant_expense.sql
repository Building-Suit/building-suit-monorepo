-- Synthetic owner, delegated manager and category. Runner rolls the fixture back.
create temporary table shop_assistant_fixture as
select gen_random_uuid() as owner_id, gen_random_uuid() as manager_id;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select actor, actor::text || '@assistant-expense.invalid', 'x', 'authenticated', 'authenticated',
  now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from (select owner_id as actor from shop_assistant_fixture
  union all select manager_id from shop_assistant_fixture) actors;

do $$
declare
  v_rpc regprocedure := 'public.confirm_assistant_expense(uuid,uuid,uuid,uuid,text,numeric,date,text,text,text)'::regprocedure;
begin
  if not has_function_privilege('authenticated', v_rpc, 'EXECUTE')
    or has_function_privilege('anon', v_rpc, 'EXECUTE')
    or has_function_privilege('service_role', v_rpc, 'EXECUTE')
    or not exists (select 1 from pg_catalog.pg_proc where oid = v_rpc
      and prosecdef and proconfig = array['search_path=""']) then
    raise exception 'Invalid expense confirmation privileges';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true) from shop_assistant_fixture;
set local role authenticated;
select set_config('assistant.shop', public.create_owner_shop('Assistant expense fixture', 'mixed'::public.business_mode)::text, true);
reset role;

do $$
declare
  v_shop uuid := current_setting('assistant.shop')::uuid;
  v_owner_profile uuid;
  v_manager_profile uuid;
  v_manager_membership uuid;
  v_location uuid;
  v_category uuid;
begin
  select profile_id into v_owner_profile from public.shop_memberships
    where shop_id = v_shop and role = 'owner';
  select id into v_location from public.shop_locations where shop_id = v_shop and is_default;
  insert into public.expense_categories (shop_id, name, created_by_profile_id)
    values (v_shop, 'Supplies', v_owner_profile) returning id into v_category;
  perform set_config('assistant.category', v_category::text, true);
  perform set_config('assistant.location', v_location::text, true);

  insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
    select fixture.manager_id, shop.portal_id, 'Expense manager', 'manager@assistant-expense.invalid'
    from shop_assistant_fixture fixture cross join public.shops shop where shop.id = v_shop
    returning id into v_manager_profile;
  insert into public.shop_memberships (shop_id, profile_id, role)
    values (v_shop, v_manager_profile, 'member') returning id into v_manager_membership;
  insert into public.membership_roles (membership_id, role_id)
    select v_manager_membership, id from public.roles where shop_id = v_shop and key = 'manager';
end;
$$;

set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('assistant.shop')::uuid;
  v_location uuid := current_setting('assistant.location')::uuid;
  v_category uuid := current_setting('assistant.category')::uuid;
  v_location_name text;
  v_request uuid := gen_random_uuid();
  v_expense uuid;
begin
  select name into v_location_name from public.shop_locations where id = v_location;
  perform public.save_business_currency(v_shop, 'USD');
  begin
    perform public.confirm_assistant_expense(v_request, v_shop, v_location, v_category,
      'Delivery boxes', 12.35, current_date, 'Supplies', 'EGP', v_location_name);
    raise exception 'A currency change accepted the old review';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'ASSISTANT_EXPENSE_DETAILS_CHANGED' then raise; end if;
  end;

  perform public.save_shop_location(v_shop, v_location, 'Renamed branch', null, null, null);
  begin
    perform public.confirm_assistant_expense(v_request, v_shop, v_location, v_category,
      'Delivery boxes', 12.35, current_date, 'Supplies', 'USD', v_location_name);
    raise exception 'A branch rename accepted the old review';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'ASSISTANT_EXPENSE_DETAILS_CHANGED' then raise; end if;
  end;
  begin
    perform public.confirm_assistant_expense(v_request, v_shop, v_location, v_category,
      'Delivery boxes', 12.35, current_date, 'Wrong category', 'USD', 'Renamed branch');
    raise exception 'A changed category label accepted the old review';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'ASSISTANT_EXPENSE_DETAILS_CHANGED' then raise; end if;
  end;
  begin
    perform public.confirm_assistant_expense(v_request, v_shop, v_location, gen_random_uuid(),
      'Delivery boxes', 12.35, current_date, 'Supplies', 'USD', 'Renamed branch');
    raise exception 'A category outside the shop accepted confirmation';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'ASSISTANT_EXPENSE_DETAILS_CHANGED' then raise; end if;
  end;

  v_expense := public.confirm_assistant_expense(v_request, v_shop, v_location, v_category,
    'Delivery boxes', 12.35, current_date, 'Supplies', 'USD', 'Renamed branch');
  if v_expense is null or public.confirm_assistant_expense(v_request, v_shop, v_location, v_category,
    'Delivery boxes', 12.35, current_date, 'Supplies', 'USD', 'Renamed branch') is distinct from v_expense then
    raise exception 'Expense confirmation replay changed its result';
  end if;
  begin
    perform public.confirm_assistant_expense(v_request, v_shop, v_location, v_category,
      'Delivery boxes', 12.36, current_date, 'Supplies', 'USD', 'Renamed branch');
    raise exception 'A changed amount accepted the original request ID';
  exception when unique_violation then
    if sqlerrm <> 'EXPENSE_REQUEST_CONFLICT' then raise; end if;
  end;
  if not exists (select 1 from public.expenses where id = v_expense and shop_id = v_shop
    and location_id = v_location and category_id = v_category and currency = 'USD'
    and amount = 12.35 and status = 'paid' and corrects_expense_id is null) then
    raise exception 'The persisted expense did not match the review';
  end if;
  perform set_config('assistant.request', v_request::text, true);
end;
$$;
reset role;

do $$
begin
  if (select count(*) from public.expenses where shop_id = current_setting('assistant.shop')::uuid) <> 1
    or (select count(*) from public.expense_events
      where request_id = current_setting('assistant.request')::uuid and action = 'create') <> 1 then
    raise exception 'Rejected reviews or replay left extra expenses or audit events';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', manager_id::text, true) from shop_assistant_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('assistant.shop')::uuid;
  v_location uuid := current_setting('assistant.location')::uuid;
begin
  begin
    perform public.confirm_assistant_expense(gen_random_uuid(), v_shop, v_location,
      current_setting('assistant.category')::uuid, 'Delegated entry', 1.50,
      current_date, 'Supplies', 'USD', 'Renamed branch');
    raise exception 'A manager could confirm an assistant proposal';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_OWNER_REQUIRED' then raise; end if;
  end;
  if public.save_expense(gen_random_uuid(), v_shop, v_location, null, 'Delegated entry',
    1.50, 'Supplies', current_date, null) is null then
    raise exception 'The ordinary delegated expense path stopped working';
  end if;
end;
$$;
reset role;
