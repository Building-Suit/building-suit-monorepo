-- SET-D01: one currency per business; no FX or amount transformation.
-- Newly configurable currencies share the existing two-decimal amount contract.
alter table public.shops
  add column business_currency text not null default 'EGP' check (business_currency ~ '^[A-Z]{3}$'),
  add column currency_locked_at timestamptz,
  add column currency_lock_source text,
  add column currency_lock_record_id uuid;

-- Legacy business monetary amounts were presented in EGP. Preserve that basis,
-- all explicit invoice currencies and every existing issued snapshot unchanged.
update public.shops shop set currency_locked_at = clock_timestamp(), currency_lock_source = 'legacy_history'
where exists (select 1 from public.invoices i where i.shop_id = shop.id and i.status <> 'draft')
   or exists (select 1 from public.vendor_invoices i where i.shop_id = shop.id and i.status <> 'draft')
   or exists (select 1 from public.payments p where p.shop_id = shop.id and p.status in ('completed','void'))
   or exists (select 1 from public.expenses e where e.shop_id = shop.id)
   or exists (select 1 from public.inventory_batches b where b.shop_id = shop.id)
   or exists (select 1 from public.cash_sessions c where c.shop_id = shop.id);

alter table public.vendor_invoices add column currency text not null default 'EGP';
alter table public.payments add column currency text not null default 'EGP';
alter table public.expenses add column currency text not null default 'EGP';

create table public.shop_currency_changes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  previous_currency text not null,
  new_currency text not null,
  changed_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  changed_at timestamptz not null default clock_timestamp(),
  check (previous_currency <> new_currency)
);
create index shop_currency_changes_shop_time_idx on public.shop_currency_changes(shop_id,changed_at,id);
alter table public.shop_currency_changes enable row level security;
revoke all on public.shop_currency_changes from public, anon, authenticated;
grant select on public.shop_currency_changes to authenticated;
grant all on public.shop_currency_changes to service_role;
create policy shop_currency_changes_settings_read on public.shop_currency_changes for select to authenticated
using (shop_private.has_permission(shop_id,'settings.manage'));

create function shop_private.prevent_shop_currency_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'SHOP_CURRENCY_AUDIT_IMMUTABLE' using errcode = '55000'; end;
$$;
revoke all on function shop_private.prevent_shop_currency_audit_mutation() from public,anon,authenticated;
create trigger trg_shop_currency_audit_immutable before update or delete on public.shop_currency_changes
for each row execute function shop_private.prevent_shop_currency_audit_mutation();

-- Invoker context distinguishes an authorized definer command from direct API
-- table updates. No client-selectable transaction flag can bypass this guard.
create function shop_private.protect_shop_currency()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.currency_locked_at is not null and (
    new.business_currency is distinct from old.business_currency
    or new.currency_locked_at is distinct from old.currency_locked_at
    or new.currency_lock_source is distinct from old.currency_lock_source
    or new.currency_lock_record_id is distinct from old.currency_lock_record_id) then
    raise exception 'SHOP_CURRENCY_LOCKED' using errcode = '55000';
  end if;
  if current_user not in ('postgres','service_role','supabase_admin') and (
    new.business_currency is distinct from old.business_currency
    or new.currency_locked_at is distinct from old.currency_locked_at
    or new.currency_lock_source is distinct from old.currency_lock_source
    or new.currency_lock_record_id is distinct from old.currency_lock_record_id) then
    raise exception 'SHOP_CURRENCY_COMMAND_REQUIRED' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function shop_private.protect_shop_currency() from public,anon,authenticated;
create trigger trg_protect_shop_currency before update on public.shops
for each row execute function shop_private.protect_shop_currency();

create function public.business_currency_settings(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if not shop_private.is_member(p_shop_id) then raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501'; end if;
  select jsonb_build_object('currency',business_currency,'locked',currency_locked_at is not null,
    'lockedAt',currency_locked_at,'canManage',shop_private.has_permission(p_shop_id,'settings.manage'),
    'supportedCurrencies',jsonb_build_array('EGP','USD','EUR','GBP','SAR','AED')) into v_result
  from public.shops where id=p_shop_id;
  return v_result;
end;
$$;

create function public.save_business_currency(p_shop_id uuid,p_currency text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_previous text; v_locked timestamptz; v_code text := upper(btrim(p_currency));
begin
  v_actor := shop_private.assert_shop_write_access(p_shop_id,'settings.manage');
  -- This is the same row lock taken by every finalization trigger below.
  select business_currency,currency_locked_at into v_previous,v_locked from public.shops where id=p_shop_id for update;
  if v_code = v_previous then return public.business_currency_settings(p_shop_id); end if;
  if v_locked is not null then raise exception 'SHOP_CURRENCY_LOCKED' using errcode='55000'; end if;
  if v_code is null or v_code not in ('EGP','USD','EUR','GBP','SAR','AED') then
    raise exception 'SHOP_CURRENCY_UNSUPPORTED' using errcode='22023';
  end if;
  update public.shops set business_currency=v_code,updated_at=clock_timestamp() where id=p_shop_id;
  insert into public.shop_currency_changes(shop_id,previous_currency,new_currency,changed_by_profile_id)
  values(p_shop_id,v_previous,v_code,v_actor);
  return public.business_currency_settings(p_shop_id);
end;
$$;
revoke all on function public.business_currency_settings(uuid),public.save_business_currency(uuid,text) from public,anon,authenticated;
grant execute on function public.business_currency_settings(uuid),public.save_business_currency(uuid,text) to authenticated;

create function shop_private.capture_business_currency()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_code text; v_finalize boolean := true;
begin
  select business_currency into v_code from public.shops where id=new.shop_id for update;
  if v_code is null then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501'; end if;
  if tg_table_name in ('invoices','vendor_invoices') then
    if tg_op='UPDATE' and old.status::text <> 'draft' then
      if new.currency is distinct from old.currency then raise exception 'DOCUMENT_CURRENCY_IMMUTABLE' using errcode='55000'; end if;
    else new.currency := v_code; end if;
    v_finalize := new.status::text <> 'draft';
  elsif tg_table_name='payments' then
    if tg_op='UPDATE' and old.status::text in ('completed','void') then
      if new.currency is distinct from old.currency then raise exception 'DOCUMENT_CURRENCY_IMMUTABLE' using errcode='55000'; end if;
    else new.currency := v_code; end if;
    v_finalize := new.status::text in ('completed','void');
  elsif tg_table_name='expenses' then
    if tg_op='UPDATE' then
      if new.currency is distinct from old.currency then raise exception 'DOCUMENT_CURRENCY_IMMUTABLE' using errcode='55000'; end if;
    else new.currency := v_code; end if;
  end if;
  if v_finalize then
    update public.shops set currency_locked_at=clock_timestamp(),currency_lock_source=tg_table_name,currency_lock_record_id=new.id
    where id=new.shop_id and currency_locked_at is null;
  end if;
  return new;
end;
$$;
revoke all on function shop_private.capture_business_currency() from public,anon,authenticated,service_role;
create trigger trg_capture_business_currency before insert or update on public.invoices for each row execute function shop_private.capture_business_currency();
create trigger trg_capture_business_currency before insert or update on public.vendor_invoices for each row execute function shop_private.capture_business_currency();
create trigger trg_capture_business_currency before insert or update on public.payments for each row execute function shop_private.capture_business_currency();
create trigger trg_capture_business_currency before insert or update on public.expenses for each row execute function shop_private.capture_business_currency();
create trigger trg_capture_business_currency before insert on public.inventory_batches for each row execute function shop_private.capture_business_currency();
create trigger trg_capture_business_currency before insert on public.cash_sessions for each row execute function shop_private.capture_business_currency();
notify pgrst,'reload schema';
