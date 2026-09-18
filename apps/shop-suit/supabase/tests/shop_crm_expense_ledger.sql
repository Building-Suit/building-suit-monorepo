-- Run after the expense migration inside BEGIN, then ROLLBACK.
create temporary table shop_expense_fixture as
select gen_random_uuid() as owner_id, gen_random_uuid() as outsider_id;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@task11-expense.invalid', 'x', 'authenticated',
  'authenticated', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id as id from shop_expense_fixture
  union all select outsider_id from shop_expense_fixture
) users;

insert into shop_crm.plans (portal_id, name, slug, price_amount, features)
select id, 'Expense fixture', 'task-expense', 0, '{}'::jsonb
from shop_crm.portals where key = 'shop-crm';

do $$ begin
  if has_function_privilege('anon',
      'shop_crm.save_expense(uuid,uuid,uuid,text,numeric,text,date,text)', 'EXECUTE')
    or has_function_privilege('anon',
      'shop_crm.void_expense(uuid,uuid)', 'EXECUTE')
    or has_table_privilege('authenticated', 'shop_crm.expenses', 'INSERT')
    or has_table_privilege('authenticated', 'shop_crm.expenses', 'UPDATE')
    or has_table_privilege('authenticated', 'shop_crm.expense_categories', 'INSERT') then
    raise exception 'browser expense privilege too broad';
  end if;
end $$;

select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_expense_fixture;
set local role authenticated;
do $$
declare
  v_shop_id uuid;
  expense_id uuid;
  request_id uuid := gen_random_uuid();
begin
  v_shop_id := shop_crm.create_owner_shop('Expense fixture', 'task-expense');
  perform set_config('task_expense.shop_id', v_shop_id::text, true);
  expense_id := shop_crm.save_expense(
    v_shop_id, null, request_id, 'Monthly rent', 100, 'Rent', current_date, 'First payment'
  );
  perform set_config('task_expense.expense_id', expense_id::text, true);
  if shop_crm.save_expense(
      v_shop_id, null, request_id, 'Monthly rent', 100, 'Rent', current_date, 'First payment'
    ) <> expense_id then raise exception 'expense replay duplicated'; end if;
  if (select count(*) from shop_crm.expenses where shop_id = v_shop_id) <> 1
    or (select count(*) from shop_crm.expense_categories
        where expense_categories.shop_id = v_shop_id) <> 1 then
    raise exception 'expense replay changed row counts';
  end if;
  begin
    perform shop_crm.save_expense(
      v_shop_id, null, request_id, 'Changed request', 100, 'Rent', current_date, null
    );
    raise exception 'request conflict accepted';
  exception when sqlstate '23505' then
    if sqlerrm <> 'EXPENSE_REQUEST_CONFLICT' then raise; end if;
  end;
  if shop_crm.save_expense(
      v_shop_id, expense_id, null, 'Monthly rent updated', 120, 'Rent', current_date, null
    ) <> expense_id then raise exception 'expense update failed'; end if;
  if not exists (
    select 1 from shop_crm.expenses where id = expense_id and amount = 120
  ) then raise exception 'expense amount update missing'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', outsider_id::text, true)
from shop_expense_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.save_expense(
      current_setting('task_expense.shop_id')::uuid, null, gen_random_uuid(),
      'Outsider expense', 1, 'Other', current_date, null
    );
    raise exception 'outsider expense accepted';
  exception when sqlstate '42501' then
    if sqlerrm <> 'SHOP_PERMISSION_DENIED' then raise; end if;
  end;
end $$;
reset role;

insert into shop_crm.accounting_periods (
  shop_id, period_start, period_end, is_closed, closed_at
) values (
  current_setting('task_expense.shop_id')::uuid, current_date, current_date, true, now()
);
select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_expense_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.save_expense(
      current_setting('task_expense.shop_id')::uuid, null, gen_random_uuid(),
      'Closed expense', 1, 'Other', current_date, null
    );
    raise exception 'closed-period expense accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ACCOUNTING_PERIOD_CLOSED' then raise; end if;
  end;
  begin
    perform shop_crm.void_expense(
      current_setting('task_expense.shop_id')::uuid,
      current_setting('task_expense.expense_id')::uuid
    );
    raise exception 'closed-period void accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ACCOUNTING_PERIOD_CLOSED' then raise; end if;
  end;
end $$;
reset role;

update shop_crm.accounting_periods set is_closed = false, closed_at = null
where shop_id = current_setting('task_expense.shop_id')::uuid;
select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_expense_fixture;
set local role authenticated;
do $$ begin
  perform shop_crm.void_expense(
    current_setting('task_expense.shop_id')::uuid,
    current_setting('task_expense.expense_id')::uuid
  );
  perform shop_crm.void_expense(
    current_setting('task_expense.shop_id')::uuid,
    current_setting('task_expense.expense_id')::uuid
  );
  if not exists (
    select 1 from shop_crm.expenses
    where id = current_setting('task_expense.expense_id')::uuid and status = 'void'
  ) then raise exception 'void did not change expense status'; end if;
end $$;
reset role;

update shop_crm.subscriptions set trial_end_at = now() - interval '1 second'
where profile_id in (
  select profile_id from shop_crm.shop_memberships
  where shop_id = current_setting('task_expense.shop_id')::uuid
);
select set_config('request.jwt.claim.sub', owner_id::text, true)
from shop_expense_fixture;
set local role authenticated;
do $$ begin
  begin
    perform shop_crm.save_expense(
      current_setting('task_expense.shop_id')::uuid, null, gen_random_uuid(),
      'Expired expense', 1, 'Other', current_date, null
    );
    raise exception 'expired-trial expense accepted';
  exception when sqlstate '42501' then
    if sqlerrm <> 'SHOP_SUBSCRIPTION_INACTIVE' then raise; end if;
  end;
end $$;
reset role;

rollback;
