-- SS-EXP-002. The local runner wraps this suite in BEGIN/ROLLBACK and
-- relocates the historical shop_crm identifier to public.
create temporary table shop_expense_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() manager_id, gen_random_uuid() outsider_id;

insert into auth.users (id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select id, id::text || '@ss-exp-002.invalid', 'x', 'authenticated', 'authenticated',
  now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from (select owner_id id from shop_expense_fixture union all
  select manager_id from shop_expense_fixture union all select outsider_id from shop_expense_fixture) users;

insert into shop_crm.plans (portal_id, name, slug, price_amount, features)
select id, 'Expense fixture', 'task-expense', 0, '{}'::jsonb
from shop_crm.portals where key = 'shop-crm';

do $$ begin
  if has_function_privilege('anon', 'shop_crm.save_expense(uuid,uuid,uuid,uuid,text,numeric,text,date,text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'shop_crm.void_expense(uuid,uuid,uuid,uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'shop_crm.list_expenses(uuid,uuid,text,text,uuid,date,date,integer,integer)', 'EXECUTE')
    or has_table_privilege('authenticated', 'shop_crm.expenses', 'INSERT')
    or has_table_privilege('authenticated', 'shop_crm.expenses', 'UPDATE')
    or has_table_privilege('authenticated', 'shop_crm.expenses', 'DELETE')
    or has_table_privilege('authenticated', 'shop_crm.expense_events', 'SELECT') then
    raise exception 'browser expense privilege too broad';
  end if;
end $$;

select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_expense_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid; v_location uuid; v_expense uuid; v_correction uuid; v_category uuid;
  v_request uuid := gen_random_uuid(); v_correct_request uuid := gen_random_uuid(); v_page jsonb;
begin
  v_shop := shop_crm.create_owner_shop('Expense history fixture', 'task-expense');
  select id into v_location from shop_crm.shop_locations where shop_id = v_shop and is_default;
  perform set_config('task_expense.shop_id', v_shop::text, true);
  perform set_config('task_expense.location_id', v_location::text, true);
  perform set_config('task_expense.create_request_id', v_request::text, true);
  perform set_config('task_expense.correct_request_id', v_correct_request::text, true);
  v_expense := shop_crm.save_expense(v_request, v_shop, v_location, null,
    'Monthly rent', 100, 'Rent', current_date - 2, 'First payment', null);
  perform set_config('task_expense.expense_id', v_expense::text, true);
  if shop_crm.save_expense(v_request, v_shop, v_location, null,
      'Monthly rent', 100, 'Rent', current_date - 2, 'First payment', null) <> v_expense
    or (select count(*) from shop_crm.expenses where shop_id = v_shop) <> 1 then
    raise exception 'expense replay changed history';
  end if;
  begin
    perform shop_crm.save_expense(v_request, v_shop, v_location, null,
      'Changed request', 100, 'Rent', current_date - 2, null, null);
    raise exception 'request conflict accepted';
  exception when sqlstate '23505' then
    if sqlerrm <> 'EXPENSE_REQUEST_CONFLICT' then raise; end if;
  end;

  v_correction := shop_crm.save_expense(v_correct_request, v_shop, v_location, v_expense,
    'Monthly rent corrected', 120, 'Rent', current_date - 1, null,
    'Corrected supplier invoice amount');
  if v_correction = v_expense or shop_crm.save_expense(v_correct_request, v_shop, v_location,
      v_expense, 'Monthly rent corrected', 120, 'Rent', current_date - 1, null,
      'Corrected supplier invoice amount') <> v_correction then
    raise exception 'correction replay failed';
  end if;
  if not exists (select 1 from shop_crm.expenses original
      join shop_crm.expenses replacement on replacement.id = original.replaced_by_expense_id
      where original.id = v_expense and original.status = 'void' and original.amount = 100
        and original.superseded_reason = 'Corrected supplier invoice amount'
        and replacement.id = v_correction and replacement.status = 'paid' and replacement.amount = 120
        and replacement.corrects_expense_id = original.id
        and replacement.correction_reason = 'Corrected supplier invoice amount') then
    raise exception 'correction history is incomplete';
  end if;
  perform set_config('task_expense.corrected_id', v_correction::text, true);

  for counter in 1..45 loop
    perform shop_crm.save_expense(gen_random_uuid(), v_shop, v_location, null,
      'Paged expense ' || lpad(counter::text, 2, '0'), counter,
      case when counter % 2 = 0 then 'Supplies' else 'Utilities' end,
      current_date - (counter % 10), 'server-page-fixture', null);
  end loop;
  select id into v_category from shop_crm.expense_categories
    where shop_id = v_shop and name = 'Supplies';
  v_page := shop_crm.list_expenses(v_shop, v_location, 'Paged expense', 'paid',
    v_category, current_date - 20, current_date, 2, 10);
  if (v_page->>'total')::integer <> 22 or (v_page->>'page')::integer <> 2
    or jsonb_array_length(v_page->'items') <> 10 or not (v_page->>'canManage')::boolean
    or exists (select 1 from jsonb_array_elements(v_page->'items') item
      where item->>'category_name' <> 'Supplies' or item->>'status' <> 'paid') then
    raise exception 'server expense pagination/filtering failed';
  end if;
end $$;
reset role;

do $$ begin
  if (select count(*) from shop_crm.expense_events
      where request_id = current_setting('task_expense.create_request_id')::uuid
        and action = 'create') <> 1
    or (select count(*) from shop_crm.expense_events
      where request_id = current_setting('task_expense.correct_request_id')::uuid
        and action = 'correct') <> 1 then
    raise exception 'expense replay or correction changed history';
  end if;
end $$;

-- Prove delegated expense work does not depend on owner status.
do $$
declare v_profile uuid; v_membership uuid; v_shop uuid := current_setting('task_expense.shop_id')::uuid;
begin
  insert into shop_crm.profiles (user_id, portal_id, display_name, email_snapshot)
  select fixture.manager_id, shop.portal_id, 'Delegated manager', 'manager@ss-exp-002.invalid'
  from shop_expense_fixture fixture cross join shop_crm.shops shop where shop.id = v_shop
  returning id into v_profile;
  insert into shop_crm.shop_memberships (shop_id, profile_id, role)
    values (v_shop, v_profile, 'member') returning id into v_membership;
  insert into shop_crm.membership_roles (membership_id, role_id)
    select v_membership, id from shop_crm.roles where shop_id = v_shop and key = 'manager';
  insert into shop_crm.membership_location_assignments (shop_id, membership_id, location_id)
    values (v_shop, v_membership, current_setting('task_expense.location_id')::uuid)
    on conflict (membership_id, location_id) do nothing;
end $$;
select set_config('request.jwt.claim.sub', manager_id::text, true) from shop_expense_fixture;
set local role authenticated;
do $$ declare v_id uuid; v_page jsonb; begin
  v_id := shop_crm.save_expense(gen_random_uuid(), current_setting('task_expense.shop_id')::uuid,
    current_setting('task_expense.location_id')::uuid, null, 'Delegated expense', 25,
    'Supplies', current_date, 'Manager entry', null);
  v_page := shop_crm.list_expenses(current_setting('task_expense.shop_id')::uuid,
    current_setting('task_expense.location_id')::uuid, 'Delegated expense', null, null,
    null, null, 1, 20);
  if v_id is null or (v_page->>'total')::integer <> 1 then
    raise exception 'delegated expense permission failed';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', outsider_id::text, true) from shop_expense_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.list_expenses(current_setting('task_expense.shop_id')::uuid,
      current_setting('task_expense.location_id')::uuid, null, null, null, null, null, 1, 20);
    raise exception 'outsider expense read accepted';
  exception when sqlstate '42501' then if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if; end;
  begin
    perform shop_crm.save_expense(gen_random_uuid(), current_setting('task_expense.shop_id')::uuid,
      current_setting('task_expense.location_id')::uuid, null, 'Outsider expense', 1,
      'Other', current_date, null, null);
    raise exception 'outsider expense accepted';
  exception when sqlstate '42501' then if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if; end;
end $$;
reset role;

insert into shop_crm.accounting_periods (shop_id, period_start, period_end, is_closed, closed_at)
values (current_setting('task_expense.shop_id')::uuid, current_date - 30, current_date + 1, true, now());
select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_expense_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.save_expense(gen_random_uuid(), current_setting('task_expense.shop_id')::uuid,
      current_setting('task_expense.location_id')::uuid, null, 'Closed expense', 1,
      'Other', current_date, null, null);
    raise exception 'closed-period expense accepted';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ACCOUNTING_PERIOD_CLOSED' then raise; end if; end;
  begin
    perform shop_crm.save_expense(gen_random_uuid(), current_setting('task_expense.shop_id')::uuid,
      current_setting('task_expense.location_id')::uuid, current_setting('task_expense.corrected_id')::uuid,
      'Closed correction', 121, 'Rent', current_date, null, 'Closed correction test');
    raise exception 'closed-period correction accepted';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ACCOUNTING_PERIOD_CLOSED' then raise; end if; end;
  begin
    perform shop_crm.void_expense(gen_random_uuid(), current_setting('task_expense.shop_id')::uuid,
      current_setting('task_expense.location_id')::uuid, current_setting('task_expense.corrected_id')::uuid,
      'Closed void test');
    raise exception 'closed-period void accepted';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ACCOUNTING_PERIOD_CLOSED' then raise; end if; end;
end $$;
reset role;

update shop_crm.accounting_periods set is_closed = false, closed_at = null
where shop_id = current_setting('task_expense.shop_id')::uuid;
select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_expense_fixture;
set local role authenticated;
do $$ declare v_request uuid := gen_random_uuid(); begin
  perform set_config('task_expense.void_request_id', v_request::text, true);
  perform shop_crm.void_expense(v_request, current_setting('task_expense.shop_id')::uuid,
    current_setting('task_expense.location_id')::uuid, current_setting('task_expense.corrected_id')::uuid,
    'Duplicate invoice entry');
  perform shop_crm.void_expense(v_request, current_setting('task_expense.shop_id')::uuid,
    current_setting('task_expense.location_id')::uuid, current_setting('task_expense.corrected_id')::uuid,
    'Duplicate invoice entry');
  if not exists (select 1 from shop_crm.expenses
    where id = current_setting('task_expense.corrected_id')::uuid
      and correction_reason = 'Corrected supplier invoice amount'
      and void_reason = 'Duplicate invoice entry') then
    raise exception 'void overwrote correction evidence';
  end if;
  begin
    perform shop_crm.void_expense(v_request, current_setting('task_expense.shop_id')::uuid,
      current_setting('task_expense.location_id')::uuid, current_setting('task_expense.corrected_id')::uuid,
      'Different reason');
    raise exception 'void request conflict accepted';
  exception when sqlstate '23505' then if sqlerrm <> 'EXPENSE_REQUEST_CONFLICT' then raise; end if; end;
  begin
    perform shop_crm.void_expense(gen_random_uuid(), current_setting('task_expense.shop_id')::uuid,
      current_setting('task_expense.location_id')::uuid, current_setting('task_expense.corrected_id')::uuid,
      'Second void request');
    raise exception 'second void request accepted';
  exception when sqlstate '55000' then if sqlerrm <> 'EXPENSE_NOT_PAID' then raise; end if; end;
end $$;
reset role;

do $$ begin
  if (select count(*) from shop_crm.expense_events
      where request_id = current_setting('task_expense.void_request_id')::uuid
        and action = 'void') <> 1 then
    raise exception 'void replay duplicated history';
  end if;
end $$;

do $$ begin
  begin
    update shop_crm.expense_events set reason = 'rewritten'
      where shop_id = current_setting('task_expense.shop_id')::uuid;
    raise exception 'expense event mutation accepted';
  exception when sqlstate '55000' then if sqlerrm <> 'EXPENSE_EVENT_IMMUTABLE' then raise; end if; end;
  begin
    delete from shop_crm.expenses where id = current_setting('task_expense.expense_id')::uuid;
    raise exception 'expense history deletion accepted';
  exception when sqlstate '55000' then if sqlerrm <> 'EXPENSE_HISTORY_IMMUTABLE' then raise; end if; end;
end $$;

update shop_crm.subscriptions set trial_end_at = now() - interval '1 second'
where profile_id in (select profile_id from shop_crm.shop_memberships
  where shop_id = current_setting('task_expense.shop_id')::uuid and role = 'owner');
select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_expense_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.save_expense(gen_random_uuid(), current_setting('task_expense.shop_id')::uuid,
      current_setting('task_expense.location_id')::uuid, null, 'Expired expense', 1,
      'Other', current_date, null, null);
    raise exception 'expired-subscription expense accepted';
  exception when sqlstate '42501' then
    if sqlerrm <> 'SHOP_SUBSCRIPTION_INACTIVE' then raise; end if;
  end;
end $$;
reset role;
