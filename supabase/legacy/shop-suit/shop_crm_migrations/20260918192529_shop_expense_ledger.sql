-- Paid shop expenses with same-shop category resolution and retry-safe creation.
alter table shop_crm.expenses add column request_id uuid;
create unique index expenses_shop_request_unique
  on shop_crm.expenses (shop_id, request_id) where request_id is not null;
create unique index expense_categories_shop_active_name_unique
  on shop_crm.expense_categories (shop_id, lower(name)) where is_active;

create function shop_private.save_expense(
  p_shop_id uuid, p_expense_id uuid, p_request_id uuid, p_title text,
  p_amount numeric, p_category_name text, p_expense_date date, p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_category_id uuid;
  v_expense_id uuid;
  v_existing shop_crm.expenses%rowtype;
  v_date timestamp with time zone;
  v_title text;
  v_category text;
  v_notes text;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'expenses.manage');
  v_title := btrim(p_title);
  v_category := btrim(p_category_name);
  v_notes := nullif(btrim(p_notes), '');
  if v_title is null or length(v_title) < 2 or length(v_title) > 160
    or v_category is null or length(v_category) < 2 or length(v_category) > 80
    or (v_notes is not null and length(v_notes) > 1000)
    or p_amount is null or p_amount <= 0 or p_amount > 999999999.99
    or round(p_amount, 2) <> p_amount
    or p_expense_date is null
    or (p_expense_id is null and p_request_id is null) then
    raise exception 'INVALID_EXPENSE' using errcode = '22023';
  end if;
  v_date := (p_expense_date::timestamp + interval '12 hours') at time zone 'UTC';

  perform 1 from shop_crm.shops where id = p_shop_id for update;
  if not found then raise exception 'SHOP_NOT_FOUND'; end if;
  perform shop_private.assert_shop_write_access(p_shop_id, 'expenses.manage');

  select id into v_category_id
  from shop_crm.expense_categories
  where shop_id = p_shop_id and is_active and lower(name) = lower(v_category);
  if v_category_id is null then
    insert into shop_crm.expense_categories (
      shop_id, name, created_by_profile_id
    ) values (p_shop_id, v_category, v_profile_id)
    returning id into v_category_id;
  end if;

  if p_expense_id is null then
    select * into v_existing from shop_crm.expenses
    where shop_id = p_shop_id and request_id = p_request_id;
    if found then
      if v_existing.title = v_title and v_existing.amount = p_amount
        and v_existing.category_id = v_category_id
        and v_existing.expense_date = v_date
        and v_existing.notes is not distinct from v_notes
        and v_existing.status = 'paid' then
        return v_existing.id;
      end if;
      raise exception 'EXPENSE_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    perform shop_private.assert_period_is_open(p_shop_id, v_date);
    insert into shop_crm.expenses (
      shop_id, category_id, title, amount, status, expense_date,
      paid_at, notes, created_by_profile_id, request_id
    ) values (
      p_shop_id, v_category_id, v_title, p_amount, 'paid', v_date,
      now(), v_notes, v_profile_id, p_request_id
    ) returning id into v_expense_id;
  else
    select * into v_existing from shop_crm.expenses
    where id = p_expense_id and shop_id = p_shop_id for update;
    if not found or v_existing.status <> 'paid' then
      raise exception 'EXPENSE_NOT_FOUND';
    end if;
    perform shop_private.assert_period_is_open(p_shop_id, v_existing.expense_date);
    perform shop_private.assert_period_is_open(p_shop_id, v_date);
    update shop_crm.expenses
    set category_id = v_category_id, title = v_title, amount = p_amount,
      expense_date = v_date, notes = v_notes
    where id = p_expense_id and shop_id = p_shop_id
    returning id into v_expense_id;
  end if;
  return v_expense_id;
end;
$$;
revoke all on function shop_private.save_expense(uuid,uuid,uuid,text,numeric,text,date,text)
  from public, anon, authenticated;
grant execute on function shop_private.save_expense(uuid,uuid,uuid,text,numeric,text,date,text)
  to authenticated;

create function shop_crm.save_expense(
  p_shop_id uuid, p_expense_id uuid, p_request_id uuid, p_title text,
  p_amount numeric, p_category_name text, p_expense_date date, p_notes text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select shop_private.save_expense(
    p_shop_id, p_expense_id, p_request_id, p_title, p_amount,
    p_category_name, p_expense_date, p_notes
  );
$$;
revoke all on function shop_crm.save_expense(uuid,uuid,uuid,text,numeric,text,date,text)
  from public, anon, authenticated;
grant execute on function shop_crm.save_expense(uuid,uuid,uuid,text,numeric,text,date,text)
  to authenticated;

create function shop_private.void_expense(p_shop_id uuid, p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense shop_crm.expenses%rowtype;
begin
  perform shop_private.assert_shop_write_access(p_shop_id, 'expenses.manage');
  select * into v_expense from shop_crm.expenses
  where id = p_expense_id and shop_id = p_shop_id for update;
  if not found then raise exception 'EXPENSE_NOT_FOUND'; end if;
  if v_expense.status = 'void' then return; end if;
  if v_expense.status <> 'paid' then raise exception 'EXPENSE_NOT_PAID'; end if;
  perform shop_private.assert_period_is_open(p_shop_id, v_expense.expense_date);
  update shop_crm.expenses set status = 'void'
  where id = p_expense_id and shop_id = p_shop_id;
end;
$$;
revoke all on function shop_private.void_expense(uuid,uuid)
  from public, anon, authenticated;
grant execute on function shop_private.void_expense(uuid,uuid) to authenticated;

create function shop_crm.void_expense(p_shop_id uuid, p_expense_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select shop_private.void_expense(p_shop_id, p_expense_id);
$$;
revoke all on function shop_crm.void_expense(uuid,uuid)
  from public, anon, authenticated;
grant execute on function shop_crm.void_expense(uuid,uuid) to authenticated;

notify pgrst, 'reload schema';
