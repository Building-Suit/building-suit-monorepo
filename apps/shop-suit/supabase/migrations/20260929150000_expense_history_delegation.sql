-- SS-EXP-002: full-history expense queries and traceable delegated mutations.
-- Operational income remains excluded by EXP-D01/EXP-D02.

alter table public.expenses
  add column corrects_expense_id uuid,
  add column replaced_by_expense_id uuid,
  add column voided_at timestamp with time zone,
  add column voided_by_profile_id uuid,
  add column correction_reason text,
  add column superseded_reason text,
  add column void_reason text;

-- Preserve already-void history while making its previously absent action
-- metadata explicit. No business amount/date/category value is rewritten.
update public.expenses expense set
  voided_at = coalesce(expense.paid_at, expense.created_at),
  voided_by_profile_id = expense.created_by_profile_id,
  void_reason = 'Legacy void (reason unavailable)'
where expense.status = 'void'::public.expense_status;

alter table public.expenses
  add constraint expenses_id_shop_unique unique (id, shop_id),
  add constraint expenses_corrects_shop_fk
    foreign key (corrects_expense_id, shop_id)
    references public.expenses (id, shop_id) on delete restrict,
  add constraint expenses_replaced_by_shop_fk
    foreign key (replaced_by_expense_id, shop_id)
    references public.expenses (id, shop_id) on delete restrict,
  add constraint expenses_voided_by_profile_fk
    foreign key (voided_by_profile_id)
    references public.profiles (id) on delete restrict,
  add constraint expenses_change_metadata_check check (
    (status = 'paid'::public.expense_status
      and voided_at is null and voided_by_profile_id is null
      and replaced_by_expense_id is null)
    or
    (status = 'void'::public.expense_status
      and voided_at is not null and voided_by_profile_id is not null
      and ((replaced_by_expense_id is not null
          and superseded_reason is not null
          and length(btrim(superseded_reason)) between 2 and 500)
        or (replaced_by_expense_id is null
          and void_reason is not null
          and length(btrim(void_reason)) between 2 and 500)))
    or status = 'unpaid'::public.expense_status
  ),
  add constraint expenses_correction_reason_check check (
    corrects_expense_id is null
    or (correction_reason is not null and length(btrim(correction_reason)) between 2 and 500)
  );

create unique index expenses_one_replacement_per_original
  on public.expenses (corrects_expense_id)
  where corrects_expense_id is not null;
create index expenses_full_history_query_idx
  on public.expenses (shop_id, location_id, status, expense_date desc, id desc);
create index expenses_category_history_query_idx
  on public.expenses (shop_id, location_id, category_id, expense_date desc, id desc);

create table public.expense_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  location_id uuid not null,
  expense_id uuid not null,
  result_expense_id uuid,
  request_id uuid not null,
  action text not null check (action in ('create', 'correct', 'void')),
  reason text,
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  before_snapshot jsonb,
  after_snapshot jsonb not null,
  created_at timestamp with time zone not null default now(),
  unique (shop_id, request_id),
  foreign key (expense_id, shop_id) references public.expenses (id, shop_id) on delete restrict,
  foreign key (result_expense_id, shop_id) references public.expenses (id, shop_id) on delete restrict,
  foreign key (location_id, shop_id) references public.shop_locations (id, shop_id) on delete restrict,
  check ((action = 'create' and before_snapshot is null and result_expense_id = expense_id)
    or (action = 'correct' and before_snapshot is not null and result_expense_id is not null)
    or (action = 'void' and before_snapshot is not null and result_expense_id = expense_id)),
  check (reason is null or length(btrim(reason)) between 2 and 500)
);
create index expense_events_history_idx
  on public.expense_events (shop_id, location_id, created_at desc, id desc);
alter table public.expense_events enable row level security;
revoke all on table public.expense_events from public, anon, authenticated;
grant select, insert on table public.expense_events to service_role;

create function shop_private.prevent_expense_event_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'EXPENSE_EVENT_IMMUTABLE' using errcode = '55000';
end;
$$;
revoke all on function shop_private.prevent_expense_event_mutation()
  from public, anon, authenticated, service_role;
create trigger trg_expense_events_immutable
before update or delete on public.expense_events for each row
execute function shop_private.prevent_expense_event_mutation();

create function shop_private.protect_expense_history()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'EXPENSE_HISTORY_IMMUTABLE' using errcode = '55000';
  end if;
  if new.shop_id is distinct from old.shop_id
    or new.location_id is distinct from old.location_id
    or new.category_id is distinct from old.category_id
    or new.title is distinct from old.title
    or new.amount is distinct from old.amount
    or new.expense_date is distinct from old.expense_date
    or new.paid_at is distinct from old.paid_at
    or new.notes is distinct from old.notes
    or new.created_by_profile_id is distinct from old.created_by_profile_id
    or new.created_at is distinct from old.created_at
    or new.request_id is distinct from old.request_id
    or new.corrects_expense_id is distinct from old.corrects_expense_id
    or old.status <> 'paid'::public.expense_status
    or new.status <> 'void'::public.expense_status
    or old.voided_at is not null or new.voided_at is null
    or old.voided_by_profile_id is not null or new.voided_by_profile_id is null then
    raise exception 'EXPENSE_HISTORY_IMMUTABLE' using errcode = '55000';
  end if;
  if new.replaced_by_expense_id is not null then
    if old.replaced_by_expense_id is not null
      or new.correction_reason is distinct from old.correction_reason
      or old.superseded_reason is not null or new.superseded_reason is null
      or length(btrim(new.superseded_reason)) not between 2 and 500
      or new.void_reason is not null then
      raise exception 'EXPENSE_HISTORY_IMMUTABLE' using errcode = '55000';
    end if;
  elsif new.replaced_by_expense_id is distinct from old.replaced_by_expense_id
    or new.correction_reason is distinct from old.correction_reason
    or new.superseded_reason is distinct from old.superseded_reason
    or old.void_reason is not null or new.void_reason is null
    or length(btrim(new.void_reason)) not between 2 and 500 then
    raise exception 'EXPENSE_HISTORY_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function shop_private.protect_expense_history()
  from public, anon, authenticated, service_role;
create trigger trg_expenses_preserve_history
before update or delete on public.expenses for each row
execute function shop_private.protect_expense_history();

drop function public.save_expense(uuid, uuid, uuid, text, numeric, text, date, text);
drop function shop_private.save_expense(uuid, uuid, uuid, text, numeric, text, date, text);
drop function public.void_expense(uuid, uuid);
drop function shop_private.void_expense(uuid, uuid);

create function shop_private.save_expense(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_expense_id uuid,
  p_title text, p_amount numeric, p_category_name text, p_expense_date date,
  p_notes text, p_correction_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_location_id uuid;
  v_category_id uuid;
  v_result_id uuid;
  v_existing public.expenses%rowtype;
  v_original public.expenses%rowtype;
  v_result public.expenses%rowtype;
  v_date timestamp with time zone;
  v_title text := nullif(btrim(p_title), '');
  v_category text := nullif(btrim(p_category_name), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_reason text := nullif(btrim(p_correction_reason), '');
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'expenses.manage');
  v_location_id := shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if p_request_id is null or v_title is null or length(v_title) not between 2 and 160
    or v_category is null or length(v_category) not between 2 and 80
    or length(coalesce(v_notes, '')) > 1000
    or p_amount is null or p_amount <= 0 or p_amount > 999999999.99
    or round(p_amount, 2) <> p_amount or p_expense_date is null
    or (p_expense_id is null and v_reason is not null)
    or (p_expense_id is not null and (v_reason is null or length(v_reason) not between 2 and 500)) then
    raise exception 'INVALID_EXPENSE' using errcode = '22023';
  end if;
  v_date := (p_expense_date::timestamp + interval '12 hours') at time zone 'UTC';

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select expense.* into v_existing
  from public.expenses expense
  where expense.shop_id = p_shop_id and expense.request_id = p_request_id;
  if found then
    if v_existing.location_id = v_location_id
      and v_existing.corrects_expense_id is not distinct from p_expense_id
      and v_existing.title = v_title and v_existing.amount = p_amount
      and v_existing.expense_date = v_date
      and v_existing.notes is not distinct from v_notes
      and v_existing.correction_reason is not distinct from v_reason
      and exists (select 1 from public.expense_categories category
        where category.id = v_existing.category_id and category.shop_id = p_shop_id
          and lower(category.name) = lower(v_category)) then
      return v_existing.id;
    end if;
    raise exception 'EXPENSE_REQUEST_CONFLICT' using errcode = '23505';
  end if;

  perform 1 from public.shops shop where shop.id = p_shop_id for update;
  if not found then raise exception 'SHOP_NOT_FOUND' using errcode = 'P0002'; end if;
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'expenses.manage');
  v_location_id := shop_private.assert_location_access(p_shop_id, v_location_id, true);

  select category.id into v_category_id
  from public.expense_categories category
  where category.shop_id = p_shop_id and category.is_active
    and lower(category.name) = lower(v_category);
  if v_category_id is null then
    insert into public.expense_categories (shop_id, name, created_by_profile_id)
    values (p_shop_id, v_category, v_profile_id)
    returning id into v_category_id;
  end if;

  perform shop_private.assert_period_is_open(p_shop_id, v_date);
  if p_expense_id is null then
    perform set_config('shop.location_id', v_location_id::text, true);
    insert into public.expenses (
      shop_id, location_id, category_id, title, amount, status, expense_date,
      paid_at, notes, created_by_profile_id, request_id
    ) values (
      p_shop_id, v_location_id, v_category_id, v_title, p_amount, 'paid', v_date,
      now(), v_notes, v_profile_id, p_request_id
    ) returning * into v_result;
    v_result_id := v_result.id;
    insert into public.expense_events (
      shop_id, location_id, expense_id, result_expense_id, request_id,
      action, actor_profile_id, after_snapshot
    ) values (
      p_shop_id, v_location_id, v_result.id, v_result.id, p_request_id,
      'create', v_profile_id, to_jsonb(v_result)
    );
  else
    select expense.* into v_original from public.expenses expense
    where expense.id = p_expense_id and expense.shop_id = p_shop_id
      and expense.location_id = v_location_id for update;
    if not found then raise exception 'EXPENSE_NOT_FOUND' using errcode = 'P0002'; end if;
    if v_original.status <> 'paid'::public.expense_status then
      raise exception 'EXPENSE_NOT_PAID' using errcode = '55000';
    end if;
    perform shop_private.assert_period_is_open(p_shop_id, v_original.expense_date);
    perform set_config('shop.location_id', v_location_id::text, true);
    insert into public.expenses (
      shop_id, location_id, category_id, title, amount, status, expense_date,
      paid_at, notes, created_by_profile_id, request_id,
      corrects_expense_id, correction_reason
    ) values (
      p_shop_id, v_location_id, v_category_id, v_title, p_amount, 'paid', v_date,
      now(), v_notes, v_profile_id, p_request_id, v_original.id, v_reason
    ) returning * into v_result;
    update public.expenses expense set
      status = 'void', voided_at = now(), voided_by_profile_id = v_profile_id,
      superseded_reason = v_reason, replaced_by_expense_id = v_result.id
    where expense.id = v_original.id and expense.shop_id = p_shop_id;
    v_result_id := v_result.id;
    insert into public.expense_events (
      shop_id, location_id, expense_id, result_expense_id, request_id,
      action, reason, actor_profile_id, before_snapshot, after_snapshot
    ) values (
      p_shop_id, v_location_id, v_original.id, v_result.id, p_request_id,
      'correct', v_reason, v_profile_id, to_jsonb(v_original), to_jsonb(v_result)
    );
  end if;
  return v_result_id;
end;
$$;
revoke all on function shop_private.save_expense(uuid,uuid,uuid,uuid,text,numeric,text,date,text,text)
  from public, anon, authenticated, service_role;

create function public.save_expense(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_expense_id uuid,
  p_title text, p_amount numeric, p_category_name text, p_expense_date date,
  p_notes text, p_correction_reason text default null
)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.save_expense(
    p_request_id, p_shop_id, p_location_id, p_expense_id, p_title, p_amount,
    p_category_name, p_expense_date, p_notes, p_correction_reason
  );
$$;
revoke all on function public.save_expense(uuid,uuid,uuid,uuid,text,numeric,text,date,text,text)
  from public, anon, authenticated;
grant execute on function public.save_expense(uuid,uuid,uuid,uuid,text,numeric,text,date,text,text)
  to authenticated;

create function shop_private.void_expense(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid,
  p_expense_id uuid, p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_location_id uuid;
  v_expense public.expenses%rowtype;
  v_after public.expenses%rowtype;
  v_event public.expense_events%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'expenses.manage');
  v_location_id := shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if p_request_id is null or p_expense_id is null or v_reason is null
    or length(v_reason) not between 2 and 500 then
    raise exception 'INVALID_EXPENSE_VOID' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select event.* into v_event from public.expense_events event
  where event.shop_id = p_shop_id and event.request_id = p_request_id;
  if found then
    if v_event.action = 'void' and v_event.expense_id = p_expense_id
      and v_event.location_id = v_location_id and v_event.reason = v_reason then return; end if;
    raise exception 'EXPENSE_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  select expense.* into v_expense from public.expenses expense
  where expense.id = p_expense_id and expense.shop_id = p_shop_id
    and expense.location_id = v_location_id for update;
  if not found then raise exception 'EXPENSE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_expense.status <> 'paid'::public.expense_status then
    raise exception 'EXPENSE_NOT_PAID' using errcode = '55000'; end if;
  perform shop_private.assert_period_is_open(p_shop_id, v_expense.expense_date);
  update public.expenses expense set
    status = 'void', voided_at = now(), voided_by_profile_id = v_profile_id,
    void_reason = v_reason
  where expense.id = p_expense_id and expense.shop_id = p_shop_id
  returning * into v_after;
  insert into public.expense_events (
    shop_id, location_id, expense_id, result_expense_id, request_id,
    action, reason, actor_profile_id, before_snapshot, after_snapshot
  ) values (
    p_shop_id, v_location_id, p_expense_id, p_expense_id, p_request_id,
    'void', v_reason, v_profile_id, to_jsonb(v_expense), to_jsonb(v_after)
  );
end;
$$;
revoke all on function shop_private.void_expense(uuid,uuid,uuid,uuid,text)
  from public, anon, authenticated, service_role;

create function public.void_expense(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid,
  p_expense_id uuid, p_reason text
)
returns void language sql security definer set search_path = '' as $$
  select shop_private.void_expense(
    p_request_id, p_shop_id, p_location_id, p_expense_id, p_reason
  );
$$;
revoke all on function public.void_expense(uuid,uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.void_expense(uuid,uuid,uuid,uuid,text)
  to authenticated;

create function shop_private.list_expenses(
  p_shop_id uuid, p_location_id uuid, p_search text default null,
  p_status text default null, p_category_id uuid default null,
  p_from date default null, p_to date default null,
  p_page integer default 1, p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_location_id uuid;
  v_search text := nullif(btrim(p_search), '');
  v_items jsonb;
  v_total bigint;
begin
  if not shop_private.has_permission(p_shop_id, 'expenses.view') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  v_location_id := shop_private.assert_location_access(p_shop_id, p_location_id, false);
  if p_page < 1 or p_page_size < 1 or p_page_size > 100
    or length(coalesce(v_search, '')) > 160
    or (p_status is not null and p_status not in ('paid', 'void'))
    or (p_from is not null and p_to is not null and p_from > p_to)
    or (p_category_id is not null and not exists (
      select 1 from public.expense_categories category
      where category.id = p_category_id and category.shop_id = p_shop_id
    )) then
    raise exception 'INVALID_EXPENSE_QUERY' using errcode = '22023';
  end if;
  select count(*) into v_total
  from public.expenses expense
  left join public.expense_categories category on category.id = expense.category_id
  where expense.shop_id = p_shop_id and expense.location_id = v_location_id
    and (p_status is null or expense.status::text = p_status)
    and (p_category_id is null or expense.category_id = p_category_id)
    and (p_from is null or expense.expense_date::date >= p_from)
    and (p_to is null or expense.expense_date::date <= p_to)
    and (v_search is null or expense.title ilike '%' || v_search || '%'
      or coalesce(expense.notes, '') ilike '%' || v_search || '%'
      or coalesce(category.name, '') ilike '%' || v_search || '%'
      or coalesce(expense.correction_reason, '') ilike '%' || v_search || '%'
      or coalesce(expense.superseded_reason, '') ilike '%' || v_search || '%'
      or coalesce(expense.void_reason, '') ilike '%' || v_search || '%');

  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.expense_date desc, rows.id desc), '[]'::jsonb)
  into v_items from (
    select expense.id, expense.title, expense.amount, expense.status,
      expense.category_id, category.name as category_name, expense.expense_date,
      expense.notes, expense.location_id, expense.created_at,
      creator.display_name as created_by_name, expense.corrects_expense_id,
      expense.replaced_by_expense_id, expense.voided_at,
      voider.display_name as voided_by_name,
      nullif(concat_ws(' · ', expense.correction_reason, expense.superseded_reason, expense.void_reason), '') as change_reason,
      case when expense.corrects_expense_id is not null then 'correction'
        when expense.replaced_by_expense_id is not null then 'corrected'
        when expense.status = 'void'::public.expense_status then 'voided'
        else 'original' end as history_kind
    from public.expenses expense
    left join public.expense_categories category on category.id = expense.category_id
    left join public.profiles creator on creator.id = expense.created_by_profile_id
    left join public.profiles voider on voider.id = expense.voided_by_profile_id
    where expense.shop_id = p_shop_id and expense.location_id = v_location_id
      and (p_status is null or expense.status::text = p_status)
      and (p_category_id is null or expense.category_id = p_category_id)
      and (p_from is null or expense.expense_date::date >= p_from)
      and (p_to is null or expense.expense_date::date <= p_to)
      and (v_search is null or expense.title ilike '%' || v_search || '%'
        or coalesce(expense.notes, '') ilike '%' || v_search || '%'
        or coalesce(category.name, '') ilike '%' || v_search || '%'
        or coalesce(expense.correction_reason, '') ilike '%' || v_search || '%'
        or coalesce(expense.superseded_reason, '') ilike '%' || v_search || '%'
        or coalesce(expense.void_reason, '') ilike '%' || v_search || '%')
    order by expense.expense_date desc, expense.id desc
    offset (p_page - 1) * p_page_size limit p_page_size
  ) rows;
  return jsonb_build_object(
    'items', v_items, 'total', v_total, 'page', p_page, 'pageSize', p_page_size,
    'canManage', shop_private.has_permission(p_shop_id, 'expenses.manage')
  );
end;
$$;
revoke all on function shop_private.list_expenses(uuid,uuid,text,text,uuid,date,date,integer,integer)
  from public, anon, authenticated, service_role;

create function public.list_expenses(
  p_shop_id uuid, p_location_id uuid, p_search text default null,
  p_status text default null, p_category_id uuid default null,
  p_from date default null, p_to date default null,
  p_page integer default 1, p_page_size integer default 20
)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.list_expenses(
    p_shop_id, p_location_id, p_search, p_status, p_category_id,
    p_from, p_to, p_page, p_page_size
  );
$$;
revoke all on function public.list_expenses(uuid,uuid,text,text,uuid,date,date,integer,integer)
  from public, anon, authenticated;
grant execute on function public.list_expenses(uuid,uuid,text,text,uuid,date,date,integer,integer)
  to authenticated;

notify pgrst, 'reload schema';
