-- Shop Suit task 03: establish a safe read boundary before exposing shop_crm.
-- This migration intentionally grants no browser writes. Subsequent feature
-- migrations must add controlled, tenant-checked write functions and tests.

create schema if not exists shop_private;
revoke all on schema shop_private from public, anon, authenticated;
grant usage on schema shop_private to authenticated;

-- The functions bypass membership-table RLS to avoid policy recursion. Every
-- result is tied to auth.uid(), an active shop profile and active membership.
create or replace function shop_private.is_member(p_shop_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from shop_crm.shop_memberships m
    join shop_crm.profiles p on p.id = m.profile_id
    join shop_crm.shops s on s.id = m.shop_id and s.portal_id = p.portal_id
    where m.shop_id = p_shop_id
      and p.user_id = (select auth.uid())
      and p.status = 'active'::public.profile_status
      and m.status = 'active'::public.shop_membership_status
  );
$$;

create or replace function shop_private.is_owner(p_shop_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from shop_crm.shop_memberships m
    join shop_crm.profiles p on p.id = m.profile_id
    join shop_crm.shops s on s.id = m.shop_id and s.portal_id = p.portal_id
    where m.shop_id = p_shop_id
      and m.role = 'owner'
      and p.user_id = (select auth.uid())
      and p.status = 'active'::public.profile_status
      and m.status = 'active'::public.shop_membership_status
  );
$$;

create or replace function shop_private.has_permission(
  p_shop_id uuid, p_permission_key text
) returns boolean language sql stable security definer set search_path = '' as $$
  select shop_private.is_owner(p_shop_id) or exists (
    select 1
    from shop_crm.shop_memberships m
    join shop_crm.profiles p on p.id = m.profile_id
    join shop_crm.shops s on s.id = m.shop_id and s.portal_id = p.portal_id
    join shop_crm.membership_roles mr on mr.membership_id = m.id
    join shop_crm.roles r on r.id = mr.role_id and r.shop_id = m.shop_id
    join shop_crm.role_permissions rp on rp.role_id = r.id
    join shop_crm.permissions perm on perm.id = rp.permission_id
      and perm.portal_id = s.portal_id
    where m.shop_id = p_shop_id
      and p.user_id = (select auth.uid())
      and p.status = 'active'::public.profile_status
      and m.status = 'active'::public.shop_membership_status
      and perm.key = p_permission_key
  );
$$;

-- A closed accounting period must be checked regardless of the caller's
-- permission to read the accounting_periods table.
create or replace function shop_private.assert_period_is_open(
  p_shop_id uuid, p_when timestamptz
) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_shop_id is null or p_when is null then
    raise exception 'ACCOUNTING_PERIOD_ARGUMENT_REQUIRED';
  end if;
  if exists (
    select 1 from shop_crm.accounting_periods ap
    where ap.shop_id = p_shop_id
      and ap.is_closed
      and p_when::date between ap.period_start and ap.period_end
  ) then
    raise exception 'ACCOUNTING_PERIOD_CLOSED';
  end if;
end;
$$;

revoke all on all functions in schema shop_private from public, anon, authenticated;
grant execute on function shop_private.is_member(uuid),
  shop_private.is_owner(uuid), shop_private.has_permission(uuid, text),
  shop_private.assert_period_is_open(uuid, timestamptz) to authenticated;

-- Existing trigger functions pointed at nonexistent public shop tables. Keep
-- their signatures for the attached triggers, but use the private period check.
create or replace function public.assert_period_is_open(
  _shop_id uuid, _date timestamptz
) returns void language plpgsql set search_path = '' as $$
begin
  perform shop_private.assert_period_is_open(_shop_id, _date);
end;
$$;

create or replace function public.check_expense_period()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'paid'::public.expense_status then
    perform shop_private.assert_period_is_open(new.shop_id, new.expense_date);
  end if;
  return new;
end;
$$;

create or replace function public.check_invoice_period()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform shop_private.assert_period_is_open(new.shop_id, new.issued_at);
  return new;
end;
$$;

create or replace function public.check_payment_period()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform shop_private.assert_period_is_open(new.shop_id, new.paid_at);
  return new;
end;
$$;

-- Legacy shop functions have no reliable tenant checks and several reference
-- nonexistent public tables. They remain for forensic compatibility but cannot
-- be called through the exposed public RPC API by browser roles.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'assert_period_is_open', 'check_expense_period', 'check_invoice_period',
      'check_payment_period', 'deduct_inventory_fifo',
      'issue_invoice_and_deduct_inventory', 'post_vendor_invoice_and_create_batches',
      'prevent_inventory_movment_mutation', 'prevent_invoice_edit_after_issue',
      'prevent_payment_update', 'prevent_vendor_invoice_edit_after_post',
      'return_inventory_for_invoice', 'shop_has_active_subscription',
      'shop_has_feature', 'user_has_shop_permission', 'user_is_member_of_shop'
    ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated',
      f.signature);
  end loop;
end;
$$;

-- Views owned by postgres otherwise bypass underlying RLS. They are not yet
-- granted to browser roles; later report work can grant selected safe views.
do $$
declare v record;
begin
  for v in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'shop_crm' and c.relkind = 'v'
  loop
    execute format('alter view shop_crm.%I set (security_invoker = true)', v.relname);
  end loop;
end;
$$;

-- Replace every permissive policy as one atomic migration. Accounting periods
-- had RLS disabled. All shop data reads remain available to authorized members
-- after a trial lapses; product writes are separately disabled by grants.
do $$
declare p record;
begin
  for p in select tablename from pg_tables where schemaname = 'shop_crm' loop
    execute format('alter table shop_crm.%I enable row level security', p.tablename);
  end loop;
  for p in select tablename, policyname from pg_policies where schemaname = 'shop_crm' loop
    execute format('drop policy %I on shop_crm.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

create policy portal_catalog_read on shop_crm.portals for select
  to anon, authenticated using (key = 'shop-crm' and is_active);
create policy plan_catalog_read on shop_crm.plans for select
  to anon, authenticated using (
    is_active and is_public and exists (
      select 1 from shop_crm.portals p
      where p.id = portal_id and p.key = 'shop-crm' and p.is_active
    )
  );
create policy profile_self_read on shop_crm.profiles for select
  to authenticated using (user_id = (select auth.uid()));
create policy shop_member_read on shop_crm.shops for select
  to authenticated using (shop_private.is_member(id));
create policy membership_self_or_owner_read on shop_crm.shop_memberships for select
  to authenticated using (
    shop_private.is_owner(shop_id) or exists (
      select 1 from shop_crm.profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );
create policy subscription_owner_read on shop_crm.subscriptions for select
  to authenticated using (
    exists (
      select 1 from shop_crm.shop_memberships m
      where m.profile_id = subscriptions.profile_id
        and m.role = 'owner' and shop_private.is_owner(m.shop_id)
    )
  );
create policy role_member_read on shop_crm.roles for select
  to authenticated using (shop_private.is_member(shop_id));
create policy permission_portal_read on shop_crm.permissions for select
  to authenticated using (
    exists (
      select 1 from shop_crm.profiles p
      where p.portal_id = permissions.portal_id
        and p.user_id = (select auth.uid())
        and p.status = 'active'::public.profile_status
    )
  );
create policy membership_role_self_or_owner_read on shop_crm.membership_roles for select
  to authenticated using (
    exists (
      select 1 from shop_crm.shop_memberships m
      where m.id = membership_roles.membership_id
        and (shop_private.is_owner(m.shop_id) or exists (
          select 1 from shop_crm.profiles p
          where p.id = m.profile_id and p.user_id = (select auth.uid())
        ))
    )
  );
create policy role_permission_member_read on shop_crm.role_permissions for select
  to authenticated using (
    exists (
      select 1 from shop_crm.roles r
      where r.id = role_permissions.role_id and shop_private.is_member(r.shop_id)
    )
  );
create policy period_owner_read on shop_crm.accounting_periods for select
  to authenticated using (shop_private.is_owner(shop_id));

create policy products_permission_read on shop_crm.products for select
  to authenticated using (shop_private.has_permission(shop_id, 'inventory.view'));
create policy services_permission_read on shop_crm.services for select
  to authenticated using (shop_private.has_permission(shop_id, 'services.view'));
create policy clients_permission_read on shop_crm.clients for select
  to authenticated using (shop_private.has_permission(shop_id, 'clients.view'));
create policy vendors_permission_read on shop_crm.vendors for select
  to authenticated using (shop_private.has_permission(shop_id, 'vendors.view'));
create policy invoice_permission_read on shop_crm.invoices for select
  to authenticated using (shop_private.has_permission(shop_id, 'invoice.view'));
create policy vendor_invoice_permission_read on shop_crm.vendor_invoices for select
  to authenticated using (shop_private.has_permission(shop_id, 'vendor_invoices.view'));
create policy payment_permission_read on shop_crm.payments for select
  to authenticated using (shop_private.has_permission(shop_id, 'payments.view'));
create policy expense_permission_read on shop_crm.expenses for select
  to authenticated using (shop_private.has_permission(shop_id, 'expenses.view'));
create policy expense_category_permission_read on shop_crm.expense_categories for select
  to authenticated using (shop_private.has_permission(shop_id, 'expenses.view'));
create policy inventory_batch_permission_read on shop_crm.inventory_batches for select
  to authenticated using (shop_private.has_permission(shop_id, 'inventory.view'));
create policy inventory_movement_permission_read on shop_crm.inventory_movements for select
  to authenticated using (shop_private.has_permission(shop_id, 'inventory.view'));
create policy invoice_item_permission_read on shop_crm.invoice_items for select
  to authenticated using (
    exists (select 1 from shop_crm.invoices i where i.id = invoice_id
      and shop_private.has_permission(i.shop_id, 'invoice.view'))
  );
create policy vendor_invoice_item_permission_read on shop_crm.vendor_invoice_items for select
  to authenticated using (
    exists (select 1 from shop_crm.vendor_invoices vi where vi.id = vendor_invoice_id
      and shop_private.has_permission(vi.shop_id, 'vendor_invoices.view'))
  );

-- Remove all browser table/view privileges, including TRUNCATE. Allow only
-- the specific reads above. No INSERT/UPDATE/DELETE/EXECUTE path is granted
-- for business mutations by this migration.
revoke all on all tables in schema shop_crm from public, anon, authenticated;
grant usage on schema shop_crm to anon, authenticated;

do $$
declare t record;
begin
  for t in select tablename from pg_tables
    where schemaname = 'shop_crm'
      and tablename not in ('portals', 'plans', 'subscriptions')
  loop
    execute format('grant select on table shop_crm.%I to authenticated', t.tablename);
  end loop;
end;
$$;

grant select (id, key, name, is_active) on shop_crm.portals to anon, authenticated;
grant select (
  id, portal_id, name, slug, price_amount, currency, billing_interval,
  trial_days, features, sort_order, is_active, is_public, is_coming_soon
) on shop_crm.plans to anon, authenticated;
grant select (
  id, profile_id, plan_id, status, trial_start_at, trial_end_at,
  current_period_start, current_period_end, trial_consumed, locked_at,
  created_at, updated_at
) on shop_crm.subscriptions to authenticated;
