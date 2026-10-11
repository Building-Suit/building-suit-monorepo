-- SS-LAUNCH-R04 / D02. Compatible opt-in; current checkout uses the main drawer.
alter table public.shops add column require_open_cash_shift boolean not null default false;

create table public.shop_cash_policy_changes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  previous_required boolean not null,
  new_required boolean not null,
  changed_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  changed_at timestamptz not null default clock_timestamp(),
  check (previous_required <> new_required)
);
alter table public.shop_cash_policy_changes enable row level security;
revoke all on public.shop_cash_policy_changes from public, anon, authenticated;
grant select on public.shop_cash_policy_changes to authenticated;
grant all on public.shop_cash_policy_changes to service_role;
create policy shop_cash_policy_changes_read on public.shop_cash_policy_changes
  for select to authenticated using (shop_private.has_permission(shop_id, 'settings.manage'));
create function shop_private.prevent_cash_policy_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'CASH_POLICY_AUDIT_IMMUTABLE' using errcode = '55000'; end;
$$;
revoke all on function shop_private.prevent_cash_policy_audit_mutation()
  from public, anon, authenticated, service_role;
create trigger trg_shop_cash_policy_changes_immutable
  before update or delete or truncate on public.shop_cash_policy_changes
  for each statement execute function shop_private.prevent_cash_policy_audit_mutation();

-- Authorize and audit every change, including any future direct table write.
create function shop_private.audit_shop_cash_policy()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid;
begin
  if new.require_open_cash_shift is not distinct from old.require_open_cash_shift then return new; end if;
  v_actor := shop_private.assert_shop_write_access(new.id, 'settings.manage');
  insert into public.shop_cash_policy_changes
    (shop_id, previous_required, new_required, changed_by_profile_id)
  values (new.id, old.require_open_cash_shift, new.require_open_cash_shift, v_actor);
  return new;
end;
$$;
revoke all on function shop_private.audit_shop_cash_policy() from public, anon, authenticated, service_role;
create trigger trg_shops_cash_policy_audit before update of require_open_cash_shift
  on public.shops for each row execute function shop_private.audit_shop_cash_policy();

create function public.shop_cash_policy(p_shop_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_required boolean;
begin
  if not exists (select 1 from shop_private.current_shop_membership(p_shop_id)) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  select require_open_cash_shift into v_required from public.shops where id = p_shop_id;
  return v_required;
end;
$$;
create function public.set_shop_cash_policy(p_shop_id uuid, p_required boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform shop_private.assert_shop_write_access(p_shop_id, 'settings.manage');
  if p_required is null then raise exception 'INVALID_CASH_POLICY' using errcode = '22023'; end if;
  update public.shops set require_open_cash_shift = p_required, updated_at = clock_timestamp()
    where id = p_shop_id;
  return p_required;
end;
$$;
revoke all on function public.shop_cash_policy(uuid), public.set_shop_cash_policy(uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.shop_cash_policy(uuid), public.set_shop_cash_policy(uuid,boolean)
  to authenticated, service_role;

create function shop_private.assert_sale_cash_shift(p_shop_id uuid, p_location_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_required boolean; v_session uuid;
begin
  -- Hold the policy and shift until the command commits. A concurrent toggle or
  -- close cannot invalidate a successful check before the sale/payment is written.
  select require_open_cash_shift into v_required from public.shops
    where id = p_shop_id for share;
  if not coalesce(v_required, false) then return; end if;
  select id into v_session from public.cash_sessions
    where shop_id = p_shop_id and location_id = p_location_id
      and register_key = 'main' and status = 'open' for update;
  if v_session is null then
    raise exception 'SALE_OPEN_CASH_SHIFT_REQUIRED' using errcode = '23514';
  end if;
end;
$$;
revoke all on function shop_private.assert_sale_cash_shift(uuid,uuid)
  from public, anon, authenticated, service_role;

create function shop_private.enforce_sale_cash_policy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'invoices' then
    if new.status = 'issued' and (tg_op = 'INSERT' or old.status = 'draft') then
      perform shop_private.assert_sale_cash_shift(new.shop_id, new.location_id);
    end if;
  elsif new.status = 'completed' and new.customer_kind is not null
    and new.payment_direction = 'in' then
    perform shop_private.assert_sale_cash_shift(new.shop_id, new.location_id);
  end if;
  return new;
end;
$$;
revoke all on function shop_private.enforce_sale_cash_policy()
  from public, anon, authenticated, service_role;
-- AFTER ensures the existing location trigger has resolved the authoritative
-- location, including legacy RPCs without a location argument. Exceptions roll
-- back the entire atomic command, including stock and request records.
create trigger trg_invoices_cash_policy after insert or update on public.invoices
  for each row execute function shop_private.enforce_sale_cash_policy();
create trigger trg_payments_cash_policy after insert on public.payments
  for each row execute function shop_private.enforce_sale_cash_policy();
notify pgrst, 'reload schema';
