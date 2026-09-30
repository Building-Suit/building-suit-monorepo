-- SS-CASH-001: cashier shifts, immutable drawer movements, and reconciliation.
-- Payment rows remain the money source of truth; drawer events only link cash
-- effects to the active register exactly once.

alter table public.cash_sessions
  add column register_key text not null default 'main',
  add column expected_amount numeric(12, 2),
  add column variance_amount numeric(12, 2),
  add column closing_notes text;

-- Preserve any pre-feature closed foundation rows without inventing movement
-- history: their recorded close is the only available expected amount.
alter table public.cash_sessions disable trigger trg_cash_sessions_location_participants;
update public.cash_sessions
set expected_amount = closing_amount, variance_amount = 0
where status = 'closed';
alter table public.cash_sessions enable trigger trg_cash_sessions_location_participants;

alter table public.cash_sessions
  add constraint cash_sessions_register_key_check
    check (register_key ~ '^[a-z0-9][a-z0-9_-]{0,31}$'),
  add constraint cash_sessions_reconciliation_check check (
    (status = 'open' and expected_amount is null and variance_amount is null)
    or (status = 'closed' and expected_amount is not null
      and variance_amount = closing_amount - expected_amount)
  ),
  add constraint cash_sessions_closing_notes_check
    check (closing_notes is null or length(btrim(closing_notes)) between 2 and 1000);

drop index public.cash_sessions_one_open_per_location_idx;
create unique index cash_sessions_one_open_per_register_idx
  on public.cash_sessions (shop_id, location_id, register_key)
  where status = 'open';

create table public.cash_drawer_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  shop_id uuid not null,
  location_id uuid not null,
  session_id uuid not null,
  event_kind text not null check (event_kind in ('cash_sale', 'cash_refund', 'pay_in', 'pay_out')),
  amount numeric(12, 2) not null check (amount > 0),
  payment_id uuid,
  reason text,
  reference text,
  actor_membership_id uuid not null,
  occurred_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  unique (shop_id, request_id),
  unique (payment_id),
  unique (id, shop_id, location_id),
  foreign key (session_id, shop_id, location_id)
    references public.cash_sessions (id, shop_id, location_id) on delete restrict,
  foreign key (payment_id, shop_id, location_id)
    references public.payments (id, shop_id, location_id) on delete restrict,
  foreign key (actor_membership_id, shop_id)
    references public.shop_memberships (id, shop_id) on delete restrict,
  check (
    (event_kind in ('cash_sale', 'cash_refund') and payment_id is not null
      and request_id is null and reason is null)
    or (event_kind in ('pay_in', 'pay_out') and payment_id is null
      and request_id is not null and length(btrim(reason)) between 2 and 1000
      and length(btrim(reference)) between 1 and 200)
  )
);
create index cash_drawer_events_session_time_idx
  on public.cash_drawer_events (session_id, occurred_at, id);

create table public.cash_shift_requests (
  shop_id uuid not null references public.shops (id) on delete restrict,
  operation text not null check (operation in ('open', 'close')),
  request_id uuid not null,
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  payload_hash text not null,
  result_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  primary key (shop_id, operation, request_id)
);

alter table public.cash_drawer_events enable row level security;
alter table public.cash_shift_requests enable row level security;
revoke all on public.cash_sessions, public.cash_drawer_events, public.cash_shift_requests
  from public, anon, authenticated;
grant select on public.cash_sessions to authenticated;
grant all on public.cash_sessions, public.cash_drawer_events, public.cash_shift_requests
  to service_role;

insert into public.permissions (portal_id, key, description)
select portal.id, permission.key, permission.description
from public.portals portal
cross join (values
  ('cash_shifts.use', 'Open and close the signed-in cashier drawer'),
  ('cash_shifts.adjust', 'Record authorized drawer pay-ins and pay-outs'),
  ('cash_shifts.manage', 'Review and manage cashier shifts')
) as permission(key, description)
where portal.key = 'shop-crm'
on conflict (portal_id, key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
join public.permissions permission on permission.portal_id = (
  select shop.portal_id from public.shops shop where shop.id = role.shop_id
)
where role.key = 'manager' and permission.key in (
  'cash_shifts.use', 'cash_shifts.adjust', 'cash_shifts.manage'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
join public.permissions permission on permission.portal_id = (
  select shop.portal_id from public.shops shop where shop.id = role.shop_id
)
where role.key = 'cashier' and permission.key = 'cash_shifts.use'
on conflict do nothing;

create function shop_private.assign_cash_shift_role_permissions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.key in ('manager', 'cashier') then
    insert into public.role_permissions (role_id, permission_id)
    select new.id, permission.id from public.permissions permission
    join public.shops shop on shop.id = new.shop_id
      and shop.portal_id = permission.portal_id
    where (new.key = 'manager' and permission.key in (
      'cash_shifts.use', 'cash_shifts.adjust', 'cash_shifts.manage'
    )) or (new.key = 'cashier' and permission.key = 'cash_shifts.use')
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function shop_private.assign_cash_shift_role_permissions()
  from public, anon, authenticated, service_role;
create trigger trg_roles_assign_cash_shift_permissions
after insert or update of key on public.roles for each row
execute function shop_private.assign_cash_shift_role_permissions();

create function shop_private.current_shop_membership(p_shop_id uuid)
returns table (membership_id uuid, profile_id uuid)
language sql stable security definer set search_path = '' as $$
  select membership.id, membership.profile_id
  from public.shop_memberships membership
  join public.profiles profile on profile.id = membership.profile_id
  join public.shops shop on shop.id = membership.shop_id
    and shop.portal_id = profile.portal_id
  where membership.shop_id = p_shop_id and profile.user_id = auth.uid()
    and membership.status = 'active'::public.shop_membership_status
    and membership.removed_at is null
    and profile.status = 'active'::public.profile_status
    and shop.status = 'active'::public.shop_status
  limit 1;
$$;
revoke all on function shop_private.current_shop_membership(uuid)
  from public, anon, authenticated;
grant execute on function shop_private.current_shop_membership(uuid) to service_role;

create function shop_private.assert_cash_shift_access(
  p_shop_id uuid, p_location_id uuid, p_permission text
)
returns table (membership_id uuid, profile_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if not shop_private.has_permission(p_shop_id, p_permission) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  return query select current_member.membership_id, current_member.profile_id
    from shop_private.current_shop_membership(p_shop_id) current_member;
  if not found then raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501'; end if;
end;
$$;
revoke all on function shop_private.assert_cash_shift_access(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function shop_private.assert_cash_shift_access(uuid,uuid,text) to service_role;

create function shop_private.prevent_cash_drawer_event_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'CASH_DRAWER_EVENT_IMMUTABLE' using errcode = '55000'; end;
$$;
revoke all on function shop_private.prevent_cash_drawer_event_mutation()
  from public, anon, authenticated, service_role;
create trigger trg_cash_drawer_events_immutable
before update or delete or truncate on public.cash_drawer_events
for each statement execute function shop_private.prevent_cash_drawer_event_mutation();

create function shop_private.prevent_closed_cash_session_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or old.status = 'closed'::public.cash_session_status
    or new.status <> 'closed'::public.cash_session_status
    or new.closed_at is null or new.closed_by_membership_id is null
    or new.closing_amount is null or new.expected_amount is null
    or new.shop_id is distinct from old.shop_id
    or new.location_id is distinct from old.location_id
    or new.register_key is distinct from old.register_key
    or new.notes is distinct from old.notes then
    raise exception 'CASH_SESSION_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function shop_private.prevent_closed_cash_session_mutation()
  from public, anon, authenticated, service_role;
create trigger trg_cash_sessions_close_only
before update or delete on public.cash_sessions for each row
execute function shop_private.prevent_closed_cash_session_mutation();

create function shop_private.capture_cash_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_session_id uuid; v_actor_membership_id uuid;
begin
  if new.status <> 'completed'::public.payment_status or new.method <> 'cash'::public.payment_method
    or new.customer_kind is null then return new; end if;
  select session.id into v_session_id
  from public.cash_sessions session
  where session.shop_id = new.shop_id and session.location_id = new.location_id
    and session.register_key = 'main' and session.status = 'open'
  for update;
  if v_session_id is null then return new; end if;
  select membership.id into v_actor_membership_id
  from public.shop_memberships membership
  where membership.shop_id = new.shop_id and membership.profile_id = new.created_by_profile_id
  order by membership.created_at, membership.id limit 1;
  if v_actor_membership_id is null then
    raise exception 'CASH_PAYMENT_ACTOR_NOT_FOUND' using errcode = '23514';
  end if;
  insert into public.cash_drawer_events (
    shop_id, location_id, session_id, event_kind, amount, payment_id,
    reference, actor_membership_id, occurred_at
  ) values (
    new.shop_id, new.location_id, v_session_id,
    case when new.payment_direction = 'in' then 'cash_sale' else 'cash_refund' end,
    new.amount, new.id, new.reference, v_actor_membership_id, new.paid_at
  );
  return new;
end;
$$;
revoke all on function shop_private.capture_cash_payment()
  from public, anon, authenticated, service_role;
create trigger trg_payments_capture_cash_drawer
after insert on public.payments for each row
execute function shop_private.capture_cash_payment();

create function shop_private.cash_session_totals(p_session_id uuid)
returns table (
  cash_sales numeric, cash_refunds numeric, pay_ins numeric, pay_outs numeric,
  expected_cash numeric
) language sql stable security definer set search_path = '' as $$
  select
    coalesce(sum(event.amount) filter (where event.event_kind = 'cash_sale'), 0),
    coalesce(sum(event.amount) filter (where event.event_kind = 'cash_refund'), 0),
    coalesce(sum(event.amount) filter (where event.event_kind = 'pay_in'), 0),
    coalesce(sum(event.amount) filter (where event.event_kind = 'pay_out'), 0),
    session.opening_amount
      + coalesce(sum(event.amount) filter (where event.event_kind in ('cash_sale','pay_in')), 0)
      - coalesce(sum(event.amount) filter (where event.event_kind in ('cash_refund','pay_out')), 0)
  from public.cash_sessions session
  left join public.cash_drawer_events event on event.session_id = session.id
  where session.id = p_session_id
  group by session.id, session.opening_amount;
$$;
revoke all on function shop_private.cash_session_totals(uuid)
  from public, anon, authenticated;
grant execute on function shop_private.cash_session_totals(uuid) to service_role;

create function shop_private.open_cash_shift(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid,
  p_register_key text, p_opening_amount numeric, p_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_request public.cash_shift_requests%rowtype;
  v_session_id uuid; v_register text := lower(btrim(coalesce(p_register_key, 'main')));
  v_hash text;
begin
  select * into v_actor from shop_private.assert_cash_shift_access(
    p_shop_id, p_location_id, 'cash_shifts.use');
  if p_request_id is null or p_opening_amount is null or p_opening_amount < 0
    or round(p_opening_amount, 2) <> p_opening_amount
    or v_register !~ '^[a-z0-9][a-z0-9_-]{0,31}$'
    or length(coalesce(p_notes, '')) > 1000 then
    raise exception 'INVALID_CASH_SHIFT' using errcode = '22023';
  end if;
  v_hash := md5(jsonb_build_object('location', p_location_id, 'register', v_register,
    'openingAmount', p_opening_amount, 'notes', nullif(btrim(p_notes), ''))::text);
  insert into public.cash_shift_requests
    (shop_id, operation, request_id, actor_profile_id, payload_hash)
  values (p_shop_id, 'open', p_request_id, v_actor.profile_id, v_hash) on conflict do nothing;
  select * into v_request from public.cash_shift_requests
  where shop_id = p_shop_id and operation = 'open' and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_actor.profile_id or v_request.payload_hash <> v_hash then
    raise exception 'CASH_SHIFT_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;
  begin
    insert into public.cash_sessions (shop_id, location_id, opened_by_membership_id,
      opening_amount, register_key, notes)
    values (p_shop_id, p_location_id, v_actor.membership_id, p_opening_amount,
      v_register, nullif(btrim(p_notes), '')) returning id into v_session_id;
  exception when unique_violation then
    raise exception 'CASH_SHIFT_ALREADY_OPEN' using errcode = '23505';
  end;
  update public.cash_shift_requests set result_id = v_session_id,
    completed_at = clock_timestamp()
  where shop_id = p_shop_id and operation = 'open' and request_id = p_request_id;
  return v_session_id;
end;
$$;

create function shop_private.record_cash_movement(
  p_request_id uuid, p_shop_id uuid, p_session_id uuid, p_kind text,
  p_amount numeric, p_reason text, p_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_session public.cash_sessions%rowtype; v_actor record; v_event_id uuid;
begin
  if p_request_id is null or p_kind not in ('pay_in','pay_out')
    or p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount
    or length(btrim(coalesce(p_reason, ''))) < 2 or length(p_reason) > 1000
    or length(btrim(coalesce(p_reference, ''))) < 1 or length(p_reference) > 200 then
    raise exception 'INVALID_CASH_MOVEMENT' using errcode = '22023';
  end if;
  select * into v_session from public.cash_sessions
  where id = p_session_id and shop_id = p_shop_id for update;
  if not found or v_session.status <> 'open' then
    raise exception 'CASH_SHIFT_NOT_OPEN' using errcode = '55000';
  end if;
  select * into v_actor from shop_private.assert_cash_shift_access(
    p_shop_id, v_session.location_id, 'cash_shifts.adjust');
  insert into public.cash_drawer_events (request_id, shop_id, location_id, session_id,
    event_kind, amount, reason, reference, actor_membership_id)
  values (p_request_id, p_shop_id, v_session.location_id, p_session_id, p_kind,
    p_amount, btrim(p_reason), btrim(p_reference), v_actor.membership_id)
  on conflict (shop_id, request_id) do nothing returning id into v_event_id;
  if v_event_id is null then
    select event.id into v_event_id from public.cash_drawer_events event
    where event.shop_id = p_shop_id and event.request_id = p_request_id
      and event.session_id = p_session_id and event.event_kind = p_kind
      and event.amount = p_amount and event.reason = btrim(p_reason)
      and event.reference = btrim(p_reference)
      and event.actor_membership_id = v_actor.membership_id;
    if v_event_id is null then
      raise exception 'CASH_MOVEMENT_REQUEST_CONFLICT' using errcode = '23505';
    end if;
  end if;
  return v_event_id;
end;
$$;

create function shop_private.close_cash_shift(
  p_request_id uuid, p_shop_id uuid, p_session_id uuid,
  p_counted_amount numeric, p_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_session public.cash_sessions%rowtype; v_actor record;
  v_request public.cash_shift_requests%rowtype; v_totals record; v_hash text;
begin
  if p_request_id is null or p_counted_amount is null or p_counted_amount < 0
    or round(p_counted_amount, 2) <> p_counted_amount
    or (nullif(btrim(p_notes), '') is not null and length(btrim(p_notes)) < 2)
    or length(coalesce(p_notes, '')) > 1000 then
    raise exception 'INVALID_CASH_SHIFT_CLOSE' using errcode = '22023';
  end if;
  select * into v_session from public.cash_sessions
  where id = p_session_id and shop_id = p_shop_id for update;
  if not found then raise exception 'CASH_SHIFT_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into v_actor from shop_private.assert_cash_shift_access(
    p_shop_id, v_session.location_id, 'cash_shifts.use');
  if v_session.opened_by_membership_id <> v_actor.membership_id
    and not shop_private.has_permission(p_shop_id, 'cash_shifts.manage') then
    raise exception 'CASH_SHIFT_OWNER_REQUIRED' using errcode = '42501';
  end if;
  v_hash := md5(jsonb_build_object('session', p_session_id,
    'countedAmount', p_counted_amount, 'notes', nullif(btrim(p_notes), ''))::text);
  insert into public.cash_shift_requests
    (shop_id, operation, request_id, actor_profile_id, payload_hash)
  values (p_shop_id, 'close', p_request_id, v_actor.profile_id, v_hash) on conflict do nothing;
  select * into v_request from public.cash_shift_requests
  where shop_id = p_shop_id and operation = 'close' and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_actor.profile_id or v_request.payload_hash <> v_hash then
    raise exception 'CASH_SHIFT_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;
  if v_session.status <> 'open' then raise exception 'CASH_SHIFT_NOT_OPEN' using errcode = '55000'; end if;
  select * into v_totals from shop_private.cash_session_totals(p_session_id);
  update public.cash_sessions set status = 'closed', closing_amount = p_counted_amount,
    expected_amount = v_totals.expected_cash,
    variance_amount = p_counted_amount - v_totals.expected_cash,
    closed_by_membership_id = v_actor.membership_id, closed_at = clock_timestamp(),
    closing_notes = nullif(btrim(p_notes), '')
  where id = p_session_id;
  update public.cash_shift_requests set result_id = p_session_id,
    completed_at = clock_timestamp()
  where shop_id = p_shop_id and operation = 'close' and request_id = p_request_id;
  return p_session_id;
end;
$$;

create function shop_private.cash_shift_dashboard(
  p_shop_id uuid, p_location_id uuid, p_cashier_membership_id uuid default null,
  p_page integer default 1, p_page_size integer default 20
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_actor record; v_can_manage boolean; v_active jsonb; v_items jsonb; v_total bigint;
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  if not shop_private.has_permission(p_shop_id, 'cash_shifts.use')
    and not shop_private.has_permission(p_shop_id, 'cash_shifts.manage') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  select * into v_actor from shop_private.current_shop_membership(p_shop_id);
  if v_actor.membership_id is null then raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501'; end if;
  v_can_manage := shop_private.has_permission(p_shop_id, 'cash_shifts.manage');
  if p_page < 1 or p_page_size < 1 or p_page_size > 100
    or (p_cashier_membership_id is not null and not v_can_manage) then
    raise exception 'INVALID_CASH_SHIFT_QUERY' using errcode = '22023';
  end if;
  if p_cashier_membership_id is not null and not exists (
    select 1 from public.shop_memberships membership
    where membership.id = p_cashier_membership_id and membership.shop_id = p_shop_id
  ) then raise exception 'CASHIER_NOT_FOUND' using errcode = 'P0002'; end if;

  select jsonb_build_object(
    'id', session.id, 'registerKey', session.register_key,
    'cashierMembershipId', session.opened_by_membership_id,
    'cashierName', coalesce(profile.display_name, profile.email_snapshot),
    'openingAmount', session.opening_amount, 'openedAt', session.opened_at,
    'notes', session.notes, 'cashSales', totals.cash_sales,
    'cashRefunds', totals.cash_refunds, 'payIns', totals.pay_ins,
    'payOuts', totals.pay_outs, 'expectedCash', totals.expected_cash,
    'nonCashTotal', coalesce(non_cash.total, 0),
    'nonCashByMethod', coalesce(non_cash.methods, '{}'::jsonb),
    'events', coalesce(events.items, '[]'::jsonb)
  ) into v_active
  from public.cash_sessions session
  join public.shop_memberships membership on membership.id = session.opened_by_membership_id
  join public.profiles profile on profile.id = membership.profile_id
  cross join lateral shop_private.cash_session_totals(session.id) totals
  left join lateral (
    select sum(payment.amount) total,
      jsonb_object_agg(payment.method::text, payment.method_total) methods
    from (select payment.method, sum(payment.amount) amount, sum(payment.amount) method_total
      from public.payments payment where payment.shop_id = p_shop_id
        and payment.location_id = p_location_id and payment.method <> 'cash'
        and payment.status = 'completed' and payment.paid_at >= session.opened_at
      group by payment.method) payment
  ) non_cash on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', event.id, 'kind', event.event_kind,
      'amount', event.amount, 'reason', event.reason, 'reference', event.reference,
      'occurredAt', event.occurred_at, 'actorName', coalesce(actor.display_name, actor.email_snapshot))
      order by event.occurred_at desc, event.id desc) items
    from public.cash_drawer_events event
    join public.shop_memberships actor_member on actor_member.id = event.actor_membership_id
    join public.profiles actor on actor.id = actor_member.profile_id
    where event.session_id = session.id
  ) events on true
  where session.shop_id = p_shop_id and session.location_id = p_location_id
    and session.register_key = 'main' and session.status = 'open'
    and (v_can_manage or session.opened_by_membership_id = v_actor.membership_id);

  select count(*) into v_total from public.cash_sessions session
  where session.shop_id = p_shop_id and session.location_id = p_location_id
    and session.status = 'closed'
    and (v_can_manage or session.opened_by_membership_id = v_actor.membership_id)
    and (p_cashier_membership_id is null or session.opened_by_membership_id = p_cashier_membership_id);
  select coalesce(jsonb_agg(row.item order by row.opened_at desc, row.id desc), '[]'::jsonb)
  into v_items from (
    select session.id, session.opened_at, jsonb_build_object(
      'id', session.id, 'registerKey', session.register_key,
      'cashierMembershipId', session.opened_by_membership_id,
      'cashierName', coalesce(profile.display_name, profile.email_snapshot),
      'openingAmount', session.opening_amount, 'cashSales', totals.cash_sales,
      'cashRefunds', totals.cash_refunds, 'payIns', totals.pay_ins,
      'payOuts', totals.pay_outs, 'expectedCash', session.expected_amount,
      'countedCash', session.closing_amount, 'variance', session.variance_amount,
      'openedAt', session.opened_at, 'closedAt', session.closed_at,
      'closingNotes', session.closing_notes,
      'nonCashTotal', coalesce(non_cash.total, 0),
      'nonCashByMethod', coalesce(non_cash.methods, '{}'::jsonb)
    ) item
    from public.cash_sessions session
    join public.shop_memberships membership on membership.id = session.opened_by_membership_id
    join public.profiles profile on profile.id = membership.profile_id
    cross join lateral shop_private.cash_session_totals(session.id) totals
    left join lateral (
      select sum(payment.amount) total,
        jsonb_object_agg(payment.method::text, payment.method_total) methods
      from (select payment.method, sum(payment.amount) amount, sum(payment.amount) method_total
        from public.payments payment where payment.shop_id = p_shop_id
          and payment.location_id = p_location_id and payment.method <> 'cash'
          and payment.status = 'completed' and payment.paid_at >= session.opened_at
          and payment.paid_at <= session.closed_at group by payment.method) payment
    ) non_cash on true
    where session.shop_id = p_shop_id and session.location_id = p_location_id
      and session.status = 'closed'
      and (v_can_manage or session.opened_by_membership_id = v_actor.membership_id)
      and (p_cashier_membership_id is null or session.opened_by_membership_id = p_cashier_membership_id)
    order by session.opened_at desc, session.id desc
    offset (p_page - 1) * p_page_size limit p_page_size
  ) row;
  return jsonb_build_object(
    'canManage', v_can_manage,
    'canAdjust', shop_private.has_permission(p_shop_id, 'cash_shifts.adjust'),
    'currentMembershipId', v_actor.membership_id,
    'active', v_active,
    'items', v_items, 'total', v_total, 'page', p_page, 'pageSize', p_page_size,
    'cashiers', case when v_can_manage then (select coalesce(jsonb_agg(jsonb_build_object(
      'id', membership.id, 'name', coalesce(profile.display_name, profile.email_snapshot))
      order by coalesce(profile.display_name, profile.email_snapshot)), '[]'::jsonb)
      from public.shop_memberships membership join public.profiles profile on profile.id = membership.profile_id
      where membership.shop_id = p_shop_id and membership.status = 'active'
        and membership.removed_at is null and (membership.role = 'owner' or exists (
          select 1 from public.membership_location_assignments assignment
          where assignment.membership_id = membership.id and assignment.location_id = p_location_id
        ))) else '[]'::jsonb end
  );
end;
$$;

create function public.open_cash_shift(p_request_id uuid, p_shop_id uuid,
  p_location_id uuid, p_register_key text, p_opening_amount numeric, p_notes text default null)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.open_cash_shift(p_request_id, p_shop_id, p_location_id,
    p_register_key, p_opening_amount, p_notes);
$$;
create function public.record_cash_movement(p_request_id uuid, p_shop_id uuid,
  p_session_id uuid, p_kind text, p_amount numeric, p_reason text, p_reference text)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.record_cash_movement(p_request_id, p_shop_id, p_session_id,
    p_kind, p_amount, p_reason, p_reference);
$$;
create function public.close_cash_shift(p_request_id uuid, p_shop_id uuid,
  p_session_id uuid, p_counted_amount numeric, p_notes text default null)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.close_cash_shift(p_request_id, p_shop_id, p_session_id,
    p_counted_amount, p_notes);
$$;
create function public.cash_shift_dashboard(p_shop_id uuid, p_location_id uuid,
  p_cashier_membership_id uuid default null, p_page integer default 1, p_page_size integer default 20)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.cash_shift_dashboard(p_shop_id, p_location_id,
    p_cashier_membership_id, p_page, p_page_size);
$$;

revoke all on function shop_private.open_cash_shift(uuid,uuid,uuid,text,numeric,text),
  shop_private.record_cash_movement(uuid,uuid,uuid,text,numeric,text,text),
  shop_private.close_cash_shift(uuid,uuid,uuid,numeric,text),
  shop_private.cash_shift_dashboard(uuid,uuid,uuid,integer,integer)
from public, anon, authenticated, service_role;
revoke all on function public.open_cash_shift(uuid,uuid,uuid,text,numeric,text),
  public.record_cash_movement(uuid,uuid,uuid,text,numeric,text,text),
  public.close_cash_shift(uuid,uuid,uuid,numeric,text),
  public.cash_shift_dashboard(uuid,uuid,uuid,integer,integer)
from public, anon, authenticated;
grant execute on function public.open_cash_shift(uuid,uuid,uuid,text,numeric,text),
  public.record_cash_movement(uuid,uuid,uuid,text,numeric,text,text),
  public.close_cash_shift(uuid,uuid,uuid,numeric,text),
  public.cash_shift_dashboard(uuid,uuid,uuid,integer,integer)
to authenticated, service_role;
