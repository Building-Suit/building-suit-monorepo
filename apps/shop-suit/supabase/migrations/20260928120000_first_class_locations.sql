-- SS-LOC-001: first-class, tenant-owned operating locations. Existing shops
-- and operational history are backfilled to one stable default location.

create type public.shop_location_status as enum ('active', 'archived');
create type public.appointment_status as enum (
  'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'
);
create type public.cash_session_status as enum ('open', 'closed');

create table public.shop_locations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 120),
  code text check (code is null or length(btrim(code)) between 1 and 32),
  address text,
  phone text,
  status public.shop_location_status not null default 'active',
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, shop_id),
  check ((status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null))
);
create unique index shop_locations_one_default_idx
  on public.shop_locations (shop_id) where is_default;
create unique index shop_locations_shop_name_idx
  on public.shop_locations (shop_id, lower(name));
create unique index shop_locations_shop_code_idx
  on public.shop_locations (shop_id, lower(code)) where code is not null;
create index shop_locations_shop_status_idx
  on public.shop_locations (shop_id, status, created_at, id);

alter table public.shop_memberships
  add constraint shop_memberships_id_shop_unique unique (id, shop_id);

create table public.membership_location_assignments (
  shop_id uuid not null,
  membership_id uuid not null,
  location_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (membership_id, location_id),
  foreign key (membership_id, shop_id)
    references public.shop_memberships (id, shop_id) on delete cascade,
  foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict
);
create index membership_location_assignments_location_idx
  on public.membership_location_assignments (location_id, membership_id);

-- The deterministic name/code are compatibility data, not user-facing
-- assumptions. Owners can rename the location after migration.
insert into public.shop_locations (shop_id, name, code, is_default)
select shop.id, 'Main location', 'MAIN', true
from public.shops shop
where not exists (
  select 1 from public.shop_locations location where location.shop_id = shop.id
);

insert into public.membership_location_assignments (
  shop_id, membership_id, location_id
)
select membership.shop_id, membership.id, location.id
from public.shop_memberships membership
join public.shop_locations location
  on location.shop_id = membership.shop_id and location.is_default
on conflict do nothing;

create function shop_private.create_default_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.shop_locations (shop_id, name, code, is_default)
  values (new.id, 'Main location', 'MAIN', true);
  return new;
end;
$$;
revoke all on function shop_private.create_default_location()
  from public, anon, authenticated, service_role;
create trigger trg_shops_create_default_location
after insert on public.shops for each row
execute function shop_private.create_default_location();

create function shop_private.assign_default_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.membership_location_assignments (
    shop_id, membership_id, location_id
  )
  select new.shop_id, new.id, location.id
  from public.shop_locations location
  where location.shop_id = new.shop_id
    and (new.role = 'owner' or location.is_default)
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function shop_private.assign_default_location()
  from public, anon, authenticated, service_role;
create trigger trg_memberships_assign_default_location
after insert on public.shop_memberships for each row
execute function shop_private.assign_default_location();

create function shop_private.assign_new_location_to_owners()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.membership_location_assignments (
    shop_id, membership_id, location_id
  )
  select new.shop_id, membership.id, new.id
  from public.shop_memberships membership
  where membership.shop_id = new.shop_id and membership.role = 'owner'
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function shop_private.assign_new_location_to_owners()
  from public, anon, authenticated, service_role;
create trigger trg_locations_assign_owners
after insert on public.shop_locations for each row
execute function shop_private.assign_new_location_to_owners();

create function shop_private.user_can_access_location(
  p_shop_id uuid,
  p_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shop_memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    join public.shops shop on shop.id = membership.shop_id
      and shop.portal_id = profile.portal_id
    join public.shop_locations location on location.id = p_location_id
      and location.shop_id = membership.shop_id
    where membership.shop_id = p_shop_id
      and profile.user_id = auth.uid()
      and membership.status = 'active'::public.shop_membership_status
      and profile.status = 'active'::public.profile_status
      and shop.status = 'active'::public.shop_status
      and (
        membership.role = 'owner'
        or exists (
          select 1 from public.membership_location_assignments assignment
          where assignment.shop_id = membership.shop_id
            and assignment.membership_id = membership.id
            and assignment.location_id = location.id
        )
      )
  );
$$;
revoke all on function shop_private.user_can_access_location(uuid, uuid)
  from public, anon, authenticated;
grant execute on function shop_private.user_can_access_location(uuid, uuid)
  to authenticated, service_role;

create function shop_private.default_location_id(p_shop_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_location_id uuid;
begin
  select location.id into v_location_id
  from public.shop_locations location
  where location.shop_id = p_shop_id and location.is_default;
  if v_location_id is null then
    raise exception 'SHOP_DEFAULT_LOCATION_MISSING' using errcode = '23514';
  end if;
  return v_location_id;
end;
$$;
revoke all on function shop_private.default_location_id(uuid)
  from public, anon, authenticated;
grant execute on function shop_private.default_location_id(uuid) to service_role;

create function shop_private.assert_location_access(
  p_shop_id uuid,
  p_location_id uuid,
  p_require_active boolean default true
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_location_id uuid := coalesce(
  p_location_id, shop_private.default_location_id(p_shop_id)
);
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not shop_private.user_can_access_location(p_shop_id, v_location_id) then
    raise exception 'LOCATION_ACCESS_DENIED' using errcode = '42501';
  end if;
  if p_require_active and not exists (
    select 1 from public.shop_locations location
    where location.id = v_location_id and location.shop_id = p_shop_id
      and location.status = 'active'::public.shop_location_status
  ) then
    raise exception 'LOCATION_INACTIVE' using errcode = '55000';
  end if;
  return v_location_id;
end;
$$;
revoke all on function shop_private.assert_location_access(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function shop_private.assert_location_access(uuid, uuid, boolean)
  to service_role;

-- Add the authoritative location key without rewriting existing identities or
-- timestamps. Linked payments inherit the sale/purchase location first.
alter table public.invoices add column location_id uuid;
alter table public.vendor_invoices add column location_id uuid;
alter table public.expenses add column location_id uuid;
alter table public.inventory_batches add column location_id uuid;
alter table public.inventory_movements add column location_id uuid;
alter table public.stock_counts add column location_id uuid;
alter table public.payments add column location_id uuid;

-- Suspend only the historical mutation guards for these location-only updates.
-- Restore each guard immediately, before enforcing the new location constraints.
alter table public.invoices disable trigger trg_prevent_invoice_edit;
update public.invoices record set location_id = location.id
from public.shop_locations location
where location.shop_id = record.shop_id and location.is_default;
alter table public.invoices enable trigger trg_prevent_invoice_edit;
alter table public.vendor_invoices disable trigger trg_prevent_vendor_invoice_edit;
update public.vendor_invoices record set location_id = location.id
from public.shop_locations location
where location.shop_id = record.shop_id and location.is_default;
alter table public.vendor_invoices enable trigger trg_prevent_vendor_invoice_edit;
update public.expenses record set location_id = location.id
from public.shop_locations location
where location.shop_id = record.shop_id and location.is_default;
update public.inventory_batches record set location_id = location.id
from public.shop_locations location
where location.shop_id = record.shop_id and location.is_default;
alter table public.inventory_movements disable trigger trg_prevent_inventory_movement_update;
update public.inventory_movements record set location_id = location.id
from public.shop_locations location
where location.shop_id = record.shop_id and location.is_default;
alter table public.inventory_movements enable trigger trg_prevent_inventory_movement_update;
alter table public.stock_counts disable trigger trg_stock_counts_immutable;
update public.stock_counts record set location_id = location.id
from public.shop_locations location
where location.shop_id = record.shop_id and location.is_default;
alter table public.stock_counts enable trigger trg_stock_counts_immutable;
alter table public.payments disable trigger trg_prevent_payment_update;
update public.payments payment
set location_id = coalesce(
  (select invoice.location_id from public.invoices invoice
    where invoice.id = payment.invoice_id and invoice.shop_id = payment.shop_id),
  (select invoice.location_id from public.vendor_invoices invoice
    where invoice.id = payment.vendor_invoice_id and invoice.shop_id = payment.shop_id),
  (select location.id from public.shop_locations location
    where location.shop_id = payment.shop_id and location.is_default)
);
alter table public.payments enable trigger trg_prevent_payment_update;

alter table public.invoices alter column location_id set not null;
alter table public.vendor_invoices alter column location_id set not null;
alter table public.expenses alter column location_id set not null;
alter table public.inventory_batches alter column location_id set not null;
alter table public.inventory_movements alter column location_id set not null;
alter table public.stock_counts alter column location_id set not null;
alter table public.payments alter column location_id set not null;

alter table public.invoices
  add constraint invoices_id_shop_location_unique unique (id, shop_id, location_id),
  add constraint invoices_location_shop_fk foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict;
alter table public.vendor_invoices
  add constraint vendor_invoices_id_shop_location_unique
    unique (id, shop_id, location_id),
  add constraint vendor_invoices_location_shop_fk foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict;
alter table public.expenses
  add constraint expenses_location_shop_fk foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict;
alter table public.inventory_batches
  add constraint inventory_batches_id_shop_location_unique
    unique (id, shop_id, location_id),
  add constraint inventory_batches_location_shop_fk foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict;
alter table public.inventory_movements
  add constraint inventory_movements_location_shop_fk foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict,
  add constraint inventory_movements_batch_location_fk
    foreign key (batch_id, shop_id, location_id)
    references public.inventory_batches (id, shop_id, location_id) on delete restrict;
alter table public.stock_counts
  add constraint stock_counts_location_shop_fk foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict;
alter table public.payments
  add constraint payments_id_shop_location_unique unique (id, shop_id, location_id),
  add constraint payments_location_shop_fk foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict,
  add constraint payments_invoice_location_fk
    foreign key (invoice_id, shop_id, location_id)
    references public.invoices (id, shop_id, location_id) on delete restrict,
  add constraint payments_vendor_invoice_location_fk
    foreign key (vendor_invoice_id, shop_id, location_id)
    references public.vendor_invoices (id, shop_id, location_id) on delete restrict;

alter table public.customer_payment_allocations add column location_id uuid;
alter table public.supplier_payment_allocations add column location_id uuid;
alter table public.customer_payment_allocations
  disable trigger trg_customer_payment_allocation_immutable;
update public.customer_payment_allocations allocation
set location_id = payment.location_id
from public.payments payment
where payment.id = allocation.payment_id and payment.shop_id = allocation.shop_id;
alter table public.customer_payment_allocations
  enable trigger trg_customer_payment_allocation_immutable;
alter table public.supplier_payment_allocations
  disable trigger trg_supplier_payment_allocation_immutable;
update public.supplier_payment_allocations allocation
set location_id = payment.location_id
from public.payments payment
where payment.id = allocation.payment_id and payment.shop_id = allocation.shop_id;
alter table public.supplier_payment_allocations
  enable trigger trg_supplier_payment_allocation_immutable;
alter table public.customer_payment_allocations
  alter column location_id set not null,
  add constraint customer_payment_allocations_location_shop_fk
    foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict,
  add constraint customer_payment_allocations_payment_location_fk
    foreign key (payment_id, shop_id, location_id)
    references public.payments (id, shop_id, location_id) on delete restrict,
  add constraint customer_payment_allocations_invoice_location_fk
    foreign key (invoice_id, shop_id, location_id)
    references public.invoices (id, shop_id, location_id) on delete restrict;
alter table public.supplier_payment_allocations
  alter column location_id set not null,
  add constraint supplier_payment_allocations_location_shop_fk
    foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict,
  add constraint supplier_payment_allocations_payment_location_fk
    foreign key (payment_id, shop_id, location_id)
    references public.payments (id, shop_id, location_id) on delete restrict,
  add constraint supplier_payment_allocations_invoice_location_fk
    foreign key (vendor_invoice_id, shop_id, location_id)
    references public.vendor_invoices (id, shop_id, location_id) on delete restrict;

alter table public.customer_payment_adjustments add column location_id uuid;
alter table public.customer_payment_adjustments
  disable trigger trg_customer_payment_adjustment_immutable;
update public.customer_payment_adjustments adjustment
set location_id = payment.location_id
from public.payments payment
where payment.id = adjustment.original_payment_id
  and payment.shop_id = adjustment.shop_id;
alter table public.customer_payment_adjustments
  enable trigger trg_customer_payment_adjustment_immutable;
alter table public.customer_payment_adjustments
  alter column location_id set not null,
  add constraint customer_payment_adjustments_location_shop_fk
    foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict,
  add constraint customer_payment_adjustments_original_location_fk
    foreign key (original_payment_id, shop_id, location_id)
    references public.payments (id, shop_id, location_id) on delete restrict,
  add constraint customer_payment_adjustments_refund_location_fk
    foreign key (refund_payment_id, shop_id, location_id)
    references public.payments (id, shop_id, location_id) on delete restrict;

create index invoices_shop_location_date_idx
  on public.invoices (shop_id, location_id, created_at desc, id desc);
create index payments_shop_location_date_idx
  on public.payments (shop_id, location_id, paid_at desc, id desc);
create index expenses_shop_location_date_idx
  on public.expenses (shop_id, location_id, expense_date desc, id desc);
create index vendor_invoices_shop_location_date_idx
  on public.vendor_invoices (shop_id, location_id, created_at desc, id desc);
create index inventory_batches_shop_location_product_idx
  on public.inventory_batches (shop_id, location_id, product_id, received_at, id);
create index inventory_movements_shop_location_product_idx
  on public.inventory_movements (shop_id, location_id, product_id, created_at desc, id desc);
create index stock_counts_shop_location_product_idx
  on public.stock_counts (shop_id, location_id, product_id, counted_at desc, id desc);

create function shop_private.apply_operational_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linked_location uuid;
begin
  if tg_table_name = 'payments' then
    if cast((to_jsonb(new)->>'invoice_id') as uuid) is not null then
      select invoice.location_id into v_linked_location
      from public.invoices invoice
      where invoice.id = cast((to_jsonb(new)->>'invoice_id') as uuid) and invoice.shop_id = new.shop_id;
    elsif cast((to_jsonb(new)->>'vendor_invoice_id') as uuid) is not null then
      select invoice.location_id into v_linked_location
      from public.vendor_invoices invoice
      where invoice.id = cast((to_jsonb(new)->>'vendor_invoice_id') as uuid) and invoice.shop_id = new.shop_id;
    elsif cast((to_jsonb(new)->>'original_payment_id') as uuid) is not null then
      select payment.location_id into v_linked_location
      from public.payments payment
      where payment.id = cast((to_jsonb(new)->>'original_payment_id') as uuid) and payment.shop_id = new.shop_id;
    end if;
  elsif tg_table_name = 'inventory_movements' then
    -- Other trigger tables have no batch_id; access it only in this branch.
    if (to_jsonb(new)->>'batch_id')::uuid is not null then
      select batch.location_id into v_linked_location
      from public.inventory_batches batch
      where batch.id = (to_jsonb(new)->>'batch_id')::uuid and batch.shop_id = new.shop_id;
    end if;
  end if;

  if new.location_id is null then
    new.location_id := coalesce(
      v_linked_location,
      nullif(current_setting('shop.location_id', true), '')::uuid,
      shop_private.default_location_id(new.shop_id)
    );
  elsif v_linked_location is not null and new.location_id <> v_linked_location then
    raise exception 'CROSS_LOCATION_REFERENCE' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and (
    new.shop_id is distinct from old.shop_id
    or new.location_id is distinct from old.location_id
  ) then
    raise exception 'OPERATIONAL_LOCATION_IMMUTABLE' using errcode = '55000';
  end if;

  if auth.role() = 'authenticated'
    and not shop_private.user_can_access_location(new.shop_id, new.location_id) then
    raise exception 'LOCATION_ACCESS_DENIED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.shop_locations location
    where location.id = new.location_id and location.shop_id = new.shop_id
      and (tg_op = 'UPDATE'
        or location.status = 'active'::public.shop_location_status)
  ) then
    raise exception 'LOCATION_INACTIVE' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function shop_private.apply_operational_location()
  from public, anon, authenticated, service_role;

create trigger trg_invoices_location before insert or update on public.invoices
for each row execute function shop_private.apply_operational_location();
create trigger trg_vendor_invoices_location before insert or update on public.vendor_invoices
for each row execute function shop_private.apply_operational_location();
create trigger trg_expenses_location before insert or update on public.expenses
for each row execute function shop_private.apply_operational_location();
create trigger trg_inventory_batches_location before insert or update on public.inventory_batches
for each row execute function shop_private.apply_operational_location();
create trigger trg_inventory_movements_location before insert or update on public.inventory_movements
for each row execute function shop_private.apply_operational_location();
create trigger trg_stock_counts_location before insert or update on public.stock_counts
for each row execute function shop_private.apply_operational_location();
create trigger trg_payments_location before insert or update on public.payments
for each row execute function shop_private.apply_operational_location();

create function shop_private.apply_payment_allocation_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select payment.location_id into new.location_id
  from public.payments payment
  where payment.id = new.payment_id and payment.shop_id = new.shop_id;
  if new.location_id is null then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function shop_private.apply_payment_allocation_location()
  from public, anon, authenticated, service_role;
create trigger trg_customer_payment_allocations_location
before insert or update on public.customer_payment_allocations for each row
execute function shop_private.apply_payment_allocation_location();
create trigger trg_supplier_payment_allocations_location
before insert or update on public.supplier_payment_allocations for each row
execute function shop_private.apply_payment_allocation_location();

create function shop_private.apply_payment_adjustment_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select payment.location_id into new.location_id
  from public.payments payment
  where payment.id = new.original_payment_id and payment.shop_id = new.shop_id;
  if new.location_id is null then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = '23503';
  end if;
  if auth.role() = 'authenticated'
    and not shop_private.user_can_access_location(new.shop_id, new.location_id) then
    raise exception 'LOCATION_ACCESS_DENIED' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function shop_private.apply_payment_adjustment_location()
  from public, anon, authenticated, service_role;
create trigger trg_customer_payment_adjustments_location
before insert or update on public.customer_payment_adjustments for each row
execute function shop_private.apply_payment_adjustment_location();

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  location_id uuid not null,
  client_id uuid,
  service_id uuid,
  assigned_membership_id uuid,
  status public.appointment_status not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  created_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, shop_id, location_id),
  foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict,
  foreign key (client_id, shop_id)
    references public.clients (id, shop_id) on delete restrict,
  foreign key (service_id, shop_id)
    references public.services (id, shop_id) on delete restrict,
  foreign key (assigned_membership_id, shop_id)
    references public.shop_memberships (id, shop_id) on delete restrict,
  check (ends_at > starts_at)
);
create index appointments_shop_location_start_idx
  on public.appointments (shop_id, location_id, starts_at, id);

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  location_id uuid not null,
  opened_by_membership_id uuid not null,
  closed_by_membership_id uuid,
  status public.cash_session_status not null default 'open',
  opening_amount numeric(12, 2) not null check (opening_amount >= 0),
  closing_amount numeric(12, 2),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, shop_id, location_id),
  foreign key (location_id, shop_id)
    references public.shop_locations (id, shop_id) on delete restrict,
  foreign key (opened_by_membership_id, shop_id)
    references public.shop_memberships (id, shop_id) on delete restrict,
  foreign key (closed_by_membership_id, shop_id)
    references public.shop_memberships (id, shop_id) on delete restrict,
  check ((status = 'open' and closed_at is null and closing_amount is null
      and closed_by_membership_id is null)
    or (status = 'closed' and closed_at is not null and closing_amount is not null
      and closing_amount >= 0 and closed_by_membership_id is not null))
);
create unique index cash_sessions_one_open_per_location_idx
  on public.cash_sessions (location_id) where status = 'open';
create index cash_sessions_shop_location_opened_idx
  on public.cash_sessions (shop_id, location_id, opened_at desc, id desc);

create function shop_private.validate_location_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_membership_id uuid;
begin
  if tg_table_name = 'appointments' then
    v_membership_id := cast((to_jsonb(new)->>'assigned_membership_id') as uuid);
    if not exists (
      select 1 from public.shop_memberships membership
      join public.profiles profile on profile.id = membership.profile_id
      where membership.shop_id = new.shop_id
        and membership.profile_id = cast((to_jsonb(new)->>'created_by_profile_id') as uuid)
        and membership.status = 'active'
        and profile.status = 'active'
        and (coalesce(auth.role(), '') <> 'authenticated' or profile.user_id = auth.uid())
    ) then
      raise exception 'INVALID_APPOINTMENT_ACTOR' using errcode = '23514';
    end if;
  else
    v_membership_id := case when new.status = 'closed'
      then cast((to_jsonb(new)->>'closed_by_membership_id') as uuid) else cast((to_jsonb(new)->>'opened_by_membership_id') as uuid) end;
  end if;
  if v_membership_id is not null and not exists (
    select 1 from public.shop_memberships membership
    where membership.id = v_membership_id and membership.shop_id = new.shop_id
      and membership.status = 'active'
      and (membership.role = 'owner' or exists (
        select 1 from public.membership_location_assignments assignment
        where assignment.shop_id = new.shop_id
          and assignment.membership_id = membership.id
          and assignment.location_id = new.location_id
      ))
  ) then
    raise exception 'STAFF_LOCATION_ASSIGNMENT_REQUIRED' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (
    new.shop_id is distinct from old.shop_id
    or new.location_id is distinct from old.location_id
  ) then
    raise exception 'OPERATIONAL_LOCATION_IMMUTABLE' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and tg_table_name = 'appointments'
    and cast((to_jsonb(new)->>'created_by_profile_id') as uuid) is distinct from cast((to_jsonb(old)->>'created_by_profile_id') as uuid) then
    raise exception 'APPOINTMENT_ACTOR_IMMUTABLE' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and tg_table_name = 'cash_sessions' and (
    cast((to_jsonb(new)->>'opened_by_membership_id') as uuid) is distinct from cast((to_jsonb(old)->>'opened_by_membership_id') as uuid)
    or cast((to_jsonb(new)->>'opening_amount') as numeric(12,2)) is distinct from cast((to_jsonb(old)->>'opening_amount') as numeric(12,2))
    or cast((to_jsonb(new)->>'opened_at') as timestamp with time zone) is distinct from cast((to_jsonb(old)->>'opened_at') as timestamp with time zone)
  ) then
    raise exception 'CASH_SESSION_OPENING_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function shop_private.validate_location_participants()
  from public, anon, authenticated, service_role;
create trigger trg_appointments_location_participants
before insert or update on public.appointments for each row
execute function shop_private.validate_location_participants();
create trigger trg_cash_sessions_location_participants
before insert or update on public.cash_sessions for each row
execute function shop_private.validate_location_participants();

alter table public.shop_locations enable row level security;
alter table public.membership_location_assignments enable row level security;
alter table public.appointments enable row level security;
alter table public.cash_sessions enable row level security;

create policy shop_locations_accessible_read on public.shop_locations
  for select to authenticated
  using (shop_private.user_can_access_location(shop_id, id));
create policy shop_locations_owner_insert on public.shop_locations
  for insert to authenticated
  with check (shop_private.is_owner(shop_id));
create policy shop_locations_owner_update on public.shop_locations
  for update to authenticated
  using (shop_private.is_owner(shop_id)) with check (shop_private.is_owner(shop_id));

create policy membership_location_assignments_self_or_owner_read
  on public.membership_location_assignments for select to authenticated
  using (shop_private.is_owner(shop_id) or exists (
    select 1 from public.shop_memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    where membership.id = membership_id and profile.user_id = auth.uid()
      and membership.status = 'active'::public.shop_membership_status
      and profile.status = 'active'::public.profile_status
  ));
create policy membership_location_assignments_owner_insert
  on public.membership_location_assignments for insert to authenticated
  with check (shop_private.is_owner(shop_id));
create policy membership_location_assignments_owner_delete
  on public.membership_location_assignments for delete to authenticated
  using (shop_private.is_owner(shop_id));

create policy appointments_location_read on public.appointments
  for select to authenticated
  using (shop_private.user_can_access_location(shop_id, location_id));
create policy appointments_location_insert on public.appointments
  for insert to authenticated
  with check (shop_private.user_can_access_location(shop_id, location_id)
    and shop_private.has_permission(shop_id, 'sales.manage'));
create policy appointments_location_update on public.appointments
  for update to authenticated
  using (shop_private.user_can_access_location(shop_id, location_id))
  with check (shop_private.user_can_access_location(shop_id, location_id)
    and shop_private.has_permission(shop_id, 'sales.manage'));

create policy cash_sessions_location_read on public.cash_sessions
  for select to authenticated
  using (shop_private.user_can_access_location(shop_id, location_id));
create policy cash_sessions_location_insert on public.cash_sessions
  for insert to authenticated
  with check (shop_private.user_can_access_location(shop_id, location_id)
    and shop_private.has_permission(shop_id, 'payments.receive'));
create policy cash_sessions_location_update on public.cash_sessions
  for update to authenticated
  using (shop_private.user_can_access_location(shop_id, location_id))
  with check (shop_private.user_can_access_location(shop_id, location_id)
    and shop_private.has_permission(shop_id, 'payments.receive'));

-- Existing permissive shop policies remain intact; restrictive policies add
-- the required row-level location boundary for every directly reachable table.
create policy invoices_location_boundary on public.invoices as restrictive
  for all to authenticated
  using (shop_private.user_can_access_location(shop_id, location_id))
  with check (shop_private.user_can_access_location(shop_id, location_id));
create policy payments_location_boundary on public.payments as restrictive
  for all to authenticated
  using (shop_private.user_can_access_location(shop_id, location_id))
  with check (shop_private.user_can_access_location(shop_id, location_id));
create policy expenses_location_boundary on public.expenses as restrictive
  for all to authenticated
  using (shop_private.user_can_access_location(shop_id, location_id))
  with check (shop_private.user_can_access_location(shop_id, location_id));
create policy vendor_invoices_location_boundary on public.vendor_invoices as restrictive
  for all to authenticated
  using (shop_private.user_can_access_location(shop_id, location_id))
  with check (shop_private.user_can_access_location(shop_id, location_id));
create policy inventory_batches_location_boundary on public.inventory_batches as restrictive
  for all to authenticated
  using (shop_private.user_can_access_location(shop_id, location_id))
  with check (shop_private.user_can_access_location(shop_id, location_id));
create policy inventory_movements_location_boundary on public.inventory_movements as restrictive
  for all to authenticated
  using (shop_private.user_can_access_location(shop_id, location_id))
  with check (shop_private.user_can_access_location(shop_id, location_id));
create policy stock_counts_location_boundary on public.stock_counts as restrictive
  for all to authenticated
  using (shop_private.user_can_access_location(shop_id, location_id))
  with check (shop_private.user_can_access_location(shop_id, location_id));

revoke all on public.shop_locations, public.membership_location_assignments,
  public.appointments, public.cash_sessions from public, anon, authenticated;
grant select on public.shop_locations, public.membership_location_assignments,
  public.appointments, public.cash_sessions to authenticated;
grant insert, update on public.appointments, public.cash_sessions to authenticated;
grant all on public.shop_locations, public.membership_location_assignments,
  public.appointments, public.cash_sessions to service_role;

create function shop_private.list_shop_locations(p_shop_id uuid)
returns table (
  id uuid, shop_id uuid, name text, code text, address text, phone text,
  status public.shop_location_status, is_default boolean, archived_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select location.id, location.shop_id, location.name, location.code,
    location.address, location.phone, location.status, location.is_default,
    location.archived_at
  from public.shop_locations location
  where location.shop_id = p_shop_id
    and shop_private.user_can_access_location(p_shop_id, location.id)
  order by location.is_default desc, location.created_at, location.id;
$$;

create function public.list_shop_locations(p_shop_id uuid)
returns table (
  id uuid, shop_id uuid, name text, code text, address text, phone text,
  status public.shop_location_status, is_default boolean, archived_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$ select * from shop_private.list_shop_locations(p_shop_id); $$;

create function shop_private.save_shop_location(
  p_shop_id uuid, p_location_id uuid, p_name text, p_code text,
  p_address text, p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_location_id uuid;
begin
  if not shop_private.is_owner(p_shop_id) then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if p_name is null or length(btrim(p_name)) not between 2 and 120 then
    raise exception 'INVALID_LOCATION_NAME' using errcode = '22023';
  end if;
  if p_location_id is null then
    insert into public.shop_locations (shop_id, name, code, address, phone)
    values (p_shop_id, btrim(p_name), nullif(btrim(p_code), ''),
      nullif(btrim(p_address), ''), nullif(btrim(p_phone), ''))
    returning id into v_location_id;
  else
    update public.shop_locations location
    set name = btrim(p_name), code = nullif(btrim(p_code), ''),
      address = nullif(btrim(p_address), ''), phone = nullif(btrim(p_phone), ''),
      updated_at = now()
    where location.id = p_location_id and location.shop_id = p_shop_id
    returning location.id into v_location_id;
    if v_location_id is null then
      raise exception 'LOCATION_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;
  return v_location_id;
end;
$$;

create function public.save_shop_location(
  p_shop_id uuid, p_location_id uuid, p_name text, p_code text default null,
  p_address text default null, p_phone text default null
)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.save_shop_location(
    p_shop_id, p_location_id, p_name, p_code, p_address, p_phone
  );
$$;

create function shop_private.archive_shop_location(
  p_shop_id uuid, p_location_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not shop_private.is_owner(p_shop_id) then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  update public.shop_locations location
  set status = 'archived', archived_at = now(), updated_at = now()
  where location.id = p_location_id and location.shop_id = p_shop_id
    and not location.is_default and location.status = 'active';
  if not found then
    raise exception 'LOCATION_NOT_ARCHIVABLE' using errcode = '55000';
  end if;
end;
$$;

create function public.archive_shop_location(p_shop_id uuid, p_location_id uuid)
returns void language sql security definer set search_path = '' as $$
  select shop_private.archive_shop_location(p_shop_id, p_location_id);
$$;

create function shop_private.assign_membership_locations(
  p_shop_id uuid, p_membership_id uuid, p_location_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not shop_private.is_owner(p_shop_id) then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.shop_memberships membership
    where membership.id = p_membership_id and membership.shop_id = p_shop_id
  ) or exists (
    select 1 from unnest(coalesce(p_location_ids, '{}'::uuid[])) requested(id)
    where not exists (
      select 1 from public.shop_locations location
      where location.id = requested.id and location.shop_id = p_shop_id
        and location.status = 'active'
    )
  ) then
    raise exception 'INVALID_LOCATION_ASSIGNMENT' using errcode = '23514';
  end if;
  delete from public.membership_location_assignments assignment
  where assignment.shop_id = p_shop_id
    and assignment.membership_id = p_membership_id;
  insert into public.membership_location_assignments (
    shop_id, membership_id, location_id
  )
  select p_shop_id, p_membership_id, requested.id
  from unnest(coalesce(p_location_ids, '{}'::uuid[])) requested(id);
end;
$$;

create function public.assign_membership_locations(
  p_shop_id uuid, p_membership_id uuid, p_location_ids uuid[]
)
returns void language sql security definer set search_path = '' as $$
  select shop_private.assign_membership_locations(
    p_shop_id, p_membership_id, p_location_ids
  );
$$;

create function shop_private.save_location_sale_draft(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid,
  p_customer_id uuid, p_due_date date, p_notes text, p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_invoice_id uuid;
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if p_invoice_id is not null and not exists (
    select 1 from public.invoices invoice
    where invoice.id = p_invoice_id and invoice.shop_id = p_shop_id
      and invoice.location_id = p_location_id
  ) then
    raise exception 'CROSS_LOCATION_REFERENCE' using errcode = '23514';
  end if;
  perform set_config('shop.location_id', p_location_id::text, true);
  v_invoice_id := shop_private.save_sale_draft_with_due_date(
    p_request_id, p_shop_id, p_invoice_id, p_customer_id,
    p_due_date, p_notes, p_lines
  );
  return v_invoice_id;
end;
$$;

create function public.save_location_sale_draft(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid,
  p_customer_id uuid, p_due_date date, p_notes text, p_lines jsonb
)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.save_location_sale_draft(
    p_request_id, p_shop_id, p_location_id, p_invoice_id, p_customer_id,
    p_due_date, p_notes, p_lines
  );
$$;

create function shop_private.list_location_sales(
  p_shop_id uuid, p_location_id uuid, p_search text default null,
  p_status public.invoice_status default null, p_from date default null,
  p_to date default null, p_page integer default 1, p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(p_search), '');
  v_total bigint;
  v_items jsonb;
  v_access record;
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  perform shop_private.assert_sale_read_access(p_shop_id);
  select * into v_access from shop_private.sale_access(p_shop_id);
  if p_page is null or p_page < 1 or p_page_size is null
    or p_page_size < 1 or p_page_size > 100
    or (v_search is not null and length(v_search) > 160)
    or (p_status is not null and p_status not in ('draft', 'issued'))
    or (p_from is not null and p_to is not null and p_from > p_to) then
    raise exception 'INVALID_SALE_QUERY' using errcode = '22023';
  end if;
  select count(*) into v_total from public.invoices invoice
  where invoice.shop_id = p_shop_id and invoice.location_id = p_location_id
    and invoice.status in ('draft', 'issued')
    and (p_status is null or invoice.status = p_status)
    and (p_from is null or coalesce(invoice.issued_at, invoice.created_at)::date >= p_from)
    and (p_to is null or coalesce(invoice.issued_at, invoice.created_at)::date <= p_to)
    and (v_search is null or coalesce(invoice.invoice_number, '') ilike '%' || v_search || '%'
      or coalesce(invoice.client_name_snapshot, '') ilike '%' || v_search || '%'
      or coalesce(invoice.notes, '') ilike '%' || v_search || '%');
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.sort_at desc, rows.id desc), '[]'::jsonb)
  into v_items from (
    select invoice.id, invoice.invoice_number, invoice.status,
      invoice.client_id, invoice.client_name_snapshot, invoice.total_amount,
      invoice.discount_amount, invoice.currency, invoice.created_at,
      invoice.updated_at, invoice.issued_at, invoice.location_id,
      coalesce(invoice.issued_at, invoice.created_at) as sort_at,
      (select count(*) from public.invoice_items item
        where item.invoice_id = invoice.id) as line_count
    from public.invoices invoice
    where invoice.shop_id = p_shop_id and invoice.location_id = p_location_id
      and invoice.status in ('draft', 'issued')
      and (p_status is null or invoice.status = p_status)
      and (p_from is null or coalesce(invoice.issued_at, invoice.created_at)::date >= p_from)
      and (p_to is null or coalesce(invoice.issued_at, invoice.created_at)::date <= p_to)
      and (v_search is null or coalesce(invoice.invoice_number, '') ilike '%' || v_search || '%'
        or coalesce(invoice.client_name_snapshot, '') ilike '%' || v_search || '%'
        or coalesce(invoice.notes, '') ilike '%' || v_search || '%')
    order by coalesce(invoice.issued_at, invoice.created_at) desc, invoice.id desc
    offset (p_page - 1) * p_page_size limit p_page_size
  ) rows;
  return jsonb_build_object(
    'items', v_items, 'total', v_total, 'page', p_page, 'pageSize', p_page_size,
    'canManage', v_access.can_manage, 'canIssue', v_access.can_issue
  );
end;
$$;

create function public.list_location_sales(
  p_shop_id uuid, p_location_id uuid, p_search text default null,
  p_status public.invoice_status default null, p_from date default null,
  p_to date default null, p_page integer default 1, p_page_size integer default 20
)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.list_location_sales(
    p_shop_id, p_location_id, p_search, p_status, p_from, p_to, p_page, p_page_size
  );
$$;

create function public.get_location_sale(
  p_shop_id uuid, p_location_id uuid, p_invoice_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  if not exists (
    select 1 from public.invoices invoice
    where invoice.id = p_invoice_id and invoice.shop_id = p_shop_id
      and invoice.location_id = p_location_id
  ) then return null; end if;
  return shop_private.get_sale(p_shop_id, p_invoice_id);
end;
$$;

create function public.issue_location_sale(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if not exists (
    select 1 from public.invoices invoice
    where invoice.id = p_invoice_id and invoice.shop_id = p_shop_id
      and invoice.location_id = p_location_id
  ) then raise exception 'CROSS_LOCATION_REFERENCE' using errcode = '23514'; end if;
  return shop_private.issue_sale(p_request_id, p_shop_id, p_invoice_id);
end;
$$;

create function public.checkout_location_sale(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid,
  p_amount numeric, p_paid_at timestamptz, p_method public.payment_method,
  p_reference text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if not exists (
    select 1 from public.invoices invoice
    where invoice.id = p_invoice_id and invoice.shop_id = p_shop_id
      and invoice.location_id = p_location_id
  ) then raise exception 'CROSS_LOCATION_REFERENCE' using errcode = '23514'; end if;
  perform set_config('shop.location_id', p_location_id::text, true);
  return shop_private.checkout_customerless_sale(
    p_request_id, p_shop_id, p_invoice_id, p_amount, p_paid_at,
    p_method, p_reference
  );
end;
$$;

create function shop_private.record_location_customer_receipt(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_customer_id uuid,
  p_amount numeric, p_paid_at timestamptz, p_method public.payment_method,
  p_reference text, p_notes text, p_allocations jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) part
    where not exists (
      select 1 from public.invoices invoice
      where invoice.id = (part ->> 'invoice_id')::uuid
        and invoice.shop_id = p_shop_id and invoice.location_id = p_location_id
    )
  ) then raise exception 'CROSS_LOCATION_REFERENCE' using errcode = '23514'; end if;
  perform set_config('shop.location_id', p_location_id::text, true);
  return shop_private.record_customer_receipt(
    p_request_id, p_shop_id, p_customer_id, p_amount, p_paid_at,
    p_method, p_reference, p_notes, p_allocations
  );
end;
$$;

create function public.record_location_customer_receipt(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_customer_id uuid,
  p_amount numeric, p_paid_at timestamptz, p_method public.payment_method,
  p_reference text, p_notes text, p_allocations jsonb
)
returns uuid language sql security definer set search_path = '' as $$
  select shop_private.record_location_customer_receipt(
    p_request_id, p_shop_id, p_location_id, p_customer_id, p_amount,
    p_paid_at, p_method, p_reference, p_notes, p_allocations
  );
$$;

create function shop_private.location_operational_report(
  p_shop_id uuid, p_location_id uuid default null,
  p_from timestamptz default null, p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not shop_private.is_member(p_shop_id) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_location_id is not null then
    perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  end if;
  select jsonb_build_object(
    'shopId', p_shop_id,
    'locationId', p_location_id,
    'sales', coalesce(sum(invoice.total_amount)
      filter (where invoice.status in ('issued', 'paid')), 0),
    'saleCount', count(invoice.id)
      filter (where invoice.status in ('issued', 'paid')),
    'paymentsIn', coalesce((select sum(payment.amount)
      from public.payments payment
      where payment.shop_id = p_shop_id
        and payment.payment_direction = 'in'
        and payment.status = 'completed'
        and (p_location_id is null or payment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, payment.location_id)
        and (p_from is null or payment.paid_at >= p_from)
        and (p_to is null or payment.paid_at < p_to)), 0),
    'paymentsOut', coalesce((select sum(payment.amount)
      from public.payments payment
      where payment.shop_id = p_shop_id
        and payment.payment_direction = 'out'
        and payment.status = 'completed'
        and (p_location_id is null or payment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, payment.location_id)
        and (p_from is null or payment.paid_at >= p_from)
        and (p_to is null or payment.paid_at < p_to)), 0),
    'appointmentCount', (select count(*) from public.appointments appointment
      where appointment.shop_id = p_shop_id
        and (p_location_id is null or appointment.location_id = p_location_id)
        and shop_private.user_can_access_location(p_shop_id, appointment.location_id)
        and (p_from is null or appointment.starts_at >= p_from)
        and (p_to is null or appointment.starts_at < p_to))
  ) into v_result
  from public.invoices invoice
  where invoice.shop_id = p_shop_id
    and (p_location_id is null or invoice.location_id = p_location_id)
    and shop_private.user_can_access_location(p_shop_id, invoice.location_id)
    and (p_from is null or invoice.created_at >= p_from)
    and (p_to is null or invoice.created_at < p_to);
  return v_result;
end;
$$;

create function public.location_operational_report(
  p_shop_id uuid, p_location_id uuid default null,
  p_from timestamptz default null, p_to timestamptz default null
)
returns jsonb language sql stable security definer set search_path = '' as $$
  select shop_private.location_operational_report(
    p_shop_id, p_location_id, p_from, p_to
  );
$$;

-- Compatibility endpoints may omit a location only while the shop still has
-- one active location (owners retain explicit all-location visibility).
create function shop_private.assert_legacy_location_context(p_shop_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not shop_private.is_owner(p_shop_id) and (
    select count(*) from public.shop_locations location
    where location.shop_id = p_shop_id and location.status = 'active'
  ) > 1 then
    raise exception 'LOCATION_CONTEXT_REQUIRED' using errcode = '42501';
  end if;
end;
$$;
revoke all on function shop_private.assert_legacy_location_context(uuid)
  from public, anon, authenticated;
grant execute on function shop_private.assert_legacy_location_context(uuid)
  to service_role;

create or replace function public.list_sales(
  p_shop_id uuid, p_search text default null,
  p_status public.invoice_status default null, p_from date default null,
  p_to date default null, p_page integer default 1, p_page_size integer default 20
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform shop_private.assert_legacy_location_context(p_shop_id);
  return shop_private.list_sales(
    p_shop_id, p_search, p_status, p_from, p_to, p_page, p_page_size
  );
end;
$$;

create or replace function public.get_sale(p_shop_id uuid, p_invoice_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_location_id uuid;
begin
  select invoice.location_id into v_location_id from public.invoices invoice
  where invoice.id = p_invoice_id and invoice.shop_id = p_shop_id;
  if v_location_id is not null
    and not shop_private.user_can_access_location(p_shop_id, v_location_id) then
    raise exception 'LOCATION_ACCESS_DENIED' using errcode = '42501';
  end if;
  return shop_private.get_sale(p_shop_id, p_invoice_id);
end;
$$;

create or replace function public.list_outstanding_invoices(
  p_shop_id uuid, p_customer_id uuid default null,
  p_overdue_only boolean default false, p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform shop_private.assert_legacy_location_context(p_shop_id);
  return shop_private.list_outstanding_invoices(
    p_shop_id, p_customer_id, p_overdue_only, p_page, p_page_size
  );
end;
$$;

create or replace function public.customer_statement(
  p_shop_id uuid, p_customer_id uuid, p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform shop_private.assert_legacy_location_context(p_shop_id);
  return shop_private.customer_statement(
    p_shop_id, p_customer_id, p_page, p_page_size
  );
end;
$$;

revoke all on function shop_private.list_shop_locations(uuid),
  shop_private.save_shop_location(uuid, uuid, text, text, text, text),
  shop_private.archive_shop_location(uuid, uuid),
  shop_private.assign_membership_locations(uuid, uuid, uuid[]),
  shop_private.save_location_sale_draft(uuid, uuid, uuid, uuid, uuid, date, text, jsonb),
  shop_private.list_location_sales(uuid, uuid, text, public.invoice_status, date, date, integer, integer),
  shop_private.record_location_customer_receipt(uuid, uuid, uuid, uuid, numeric, timestamptz, public.payment_method, text, text, jsonb),
  shop_private.location_operational_report(uuid, uuid, timestamptz, timestamptz)
from public, anon, authenticated;
grant execute on function shop_private.list_shop_locations(uuid),
  shop_private.save_shop_location(uuid, uuid, text, text, text, text),
  shop_private.archive_shop_location(uuid, uuid),
  shop_private.assign_membership_locations(uuid, uuid, uuid[]),
  shop_private.save_location_sale_draft(uuid, uuid, uuid, uuid, uuid, date, text, jsonb),
  shop_private.list_location_sales(uuid, uuid, text, public.invoice_status, date, date, integer, integer),
  shop_private.record_location_customer_receipt(uuid, uuid, uuid, uuid, numeric, timestamptz, public.payment_method, text, text, jsonb),
  shop_private.location_operational_report(uuid, uuid, timestamptz, timestamptz)
to service_role;

revoke all on function public.list_shop_locations(uuid),
  public.save_shop_location(uuid, uuid, text, text, text, text),
  public.archive_shop_location(uuid, uuid),
  public.assign_membership_locations(uuid, uuid, uuid[]),
  public.save_location_sale_draft(uuid, uuid, uuid, uuid, uuid, date, text, jsonb),
  public.list_location_sales(uuid, uuid, text, public.invoice_status, date, date, integer, integer),
  public.get_location_sale(uuid, uuid, uuid),
  public.issue_location_sale(uuid, uuid, uuid, uuid),
  public.checkout_location_sale(uuid, uuid, uuid, uuid, numeric, timestamptz, public.payment_method, text),
  public.record_location_customer_receipt(uuid, uuid, uuid, uuid, numeric, timestamptz, public.payment_method, text, text, jsonb),
  public.location_operational_report(uuid, uuid, timestamptz, timestamptz)
from public, anon, authenticated;
grant execute on function public.list_shop_locations(uuid),
  public.save_shop_location(uuid, uuid, text, text, text, text),
  public.archive_shop_location(uuid, uuid),
  public.assign_membership_locations(uuid, uuid, uuid[]),
  public.save_location_sale_draft(uuid, uuid, uuid, uuid, uuid, date, text, jsonb),
  public.list_location_sales(uuid, uuid, text, public.invoice_status, date, date, integer, integer),
  public.get_location_sale(uuid, uuid, uuid),
  public.issue_location_sale(uuid, uuid, uuid, uuid),
  public.checkout_location_sale(uuid, uuid, uuid, uuid, numeric, timestamptz, public.payment_method, text),
  public.record_location_customer_receipt(uuid, uuid, uuid, uuid, numeric, timestamptz, public.payment_method, text, text, jsonb),
  public.location_operational_report(uuid, uuid, timestamptz, timestamptz)
to authenticated, service_role;

notify pgrst, 'reload schema';
