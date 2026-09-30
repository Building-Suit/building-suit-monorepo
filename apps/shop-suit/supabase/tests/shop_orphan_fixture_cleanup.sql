-- Local test harness only; never a migration. Older concurrency runners deleted
-- their shop/user with FK triggers disabled, leaving synthetic children behind.
create function pg_temp.cleanup_shop_orphan_fixtures()
returns integer language plpgsql set search_path = '' as $$
declare
  fixture record;
  relation record;
  cleaned integer := 0;
  previous_replication_role text := current_setting('session_replication_role');
begin
  -- A fresh local instance may not have applied the Shop baseline yet.
  if to_regclass('public.shop_memberships') is null then return 0; end if;
  for fixture in
    select membership.shop_id, profile.id as profile_id
    from public.shop_memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    where membership.role = 'owner'
      and profile.email_snapshot = any(array[
        profile.user_id::text || '@sale-concurrency.invalid',
        profile.user_id::text || '@payment-concurrency.invalid',
        profile.user_id::text || '@supplier-concurrency.invalid',
        profile.user_id::text || '@stock-concurrency.invalid'
      ])
      and not exists (select 1 from public.shops shop where shop.id = membership.shop_id)
      and not exists (select 1 from auth.users auth_user where auth_user.id = profile.user_id)
      and not exists (
        select 1 from public.shop_memberships other
        where other.id <> membership.id
          and (other.shop_id = membership.shop_id or other.profile_id = profile.id)
      )
  loop
    -- All deletes are restricted to the identified, already-deleted fixture.
    -- Remove children without shop_id before their parent rows disappear.
    perform set_config('session_replication_role', 'replica', true);
    delete from public.invoice_items item using public.invoices invoice
      where item.invoice_id = invoice.id and invoice.shop_id = fixture.shop_id;
    delete from public.vendor_invoice_items item using public.vendor_invoices invoice
      where item.vendor_invoice_id = invoice.id and invoice.shop_id = fixture.shop_id;
    delete from public.membership_roles item using public.shop_memberships membership
      where item.membership_id = membership.id and membership.shop_id = fixture.shop_id;
    delete from public.role_permissions item using public.roles role
      where item.role_id = role.id and role.shop_id = fixture.shop_id;
    for relation in
      select table_info.relname
      from pg_catalog.pg_class table_info
      join pg_catalog.pg_namespace namespace on namespace.oid = table_info.relnamespace
      join pg_catalog.pg_attribute column_info on column_info.attrelid = table_info.oid
      where namespace.nspname = 'public' and table_info.relkind = 'r'
        and column_info.attname = 'shop_id' and not column_info.attisdropped
    loop
      execute format('delete from public.%I where shop_id = $1', relation.relname)
        using fixture.shop_id;
    end loop;
    delete from public.subscriptions where profile_id = fixture.profile_id;
    delete from public.profiles where id = fixture.profile_id;
    perform set_config('session_replication_role', previous_replication_role, true);
    cleaned := cleaned + 1;
  end loop;
  return cleaned;
end;
$$;
