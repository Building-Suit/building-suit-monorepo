-- Reproduce the old local cleanup and prove the repair only removes recognized
-- fixtures whose shop AND Auth user have already gone. The runner rolls back.
create temporary table orphan_cleanup_fixture (
  scenario text, user_id uuid, shop_id uuid, profile_id uuid, invoice_id uuid
);

do $$
declare
  v_scenario text;
  v_user_id uuid;
  v_shop_id uuid;
  v_profile_id uuid;
  v_invoice_id uuid;
begin
  foreach v_scenario in array array['stale', 'active', 'unknown', 'live_user', 'live_shop']
  loop
    v_user_id := gen_random_uuid();
    insert into auth.users (
      id, email, encrypted_password, aud, role,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      v_user_id, v_user_id::text || case when v_scenario = 'unknown'
        then '@unrecognized.invalid' else '@sale-concurrency.invalid' end,
      'x', 'authenticated', 'authenticated', '{}', '{}', now(), now()
    );
    perform set_config('request.jwt.claim.sub', v_user_id::text, true);
    v_shop_id := public.create_owner_shop('Orphan cleanup ' || v_scenario, 'team', 'service');
    select membership.profile_id into v_profile_id
    from public.shop_memberships membership
    where membership.shop_id = v_shop_id and membership.role = 'owner';
    insert into public.invoices (shop_id, created_by_profile_id)
      values (v_shop_id, v_profile_id) returning id into v_invoice_id;
    insert into public.invoice_items (
      invoice_id, shop_id, item_type, item_name, quantity, unit_price,
      discount_amount, total_amount
    ) values (v_invoice_id, v_shop_id, 'custom', 'Cleanup fixture', 1, 10, 0, 10);
    insert into orphan_cleanup_fixture
      values (v_scenario, v_user_id, v_shop_id, v_profile_id, v_invoice_id);
  end loop;
end;
$$;

-- Deliberately reproduce only synthetic damage, inside this test transaction.
set local session_replication_role = replica;
delete from public.shops where id in (
  select shop_id from orphan_cleanup_fixture where scenario in ('stale', 'unknown', 'live_user')
);
delete from auth.users where id in (
  select user_id from orphan_cleanup_fixture where scenario in ('stale', 'unknown', 'live_shop')
);
set local session_replication_role = origin;

do $$
declare
  v_fixture record;
  relation record;
  remaining bigint;
begin
  if pg_temp.cleanup_shop_orphan_fixtures() <> 1 then
    raise exception 'orphan fixture cleanup selected the wrong shops';
  end if;
  if current_setting('session_replication_role') <> 'origin' then
    raise exception 'orphan fixture cleanup did not restore triggers';
  end if;
  select * into v_fixture from orphan_cleanup_fixture where scenario = 'stale';
  if exists (select 1 from public.profiles where id = v_fixture.profile_id)
    or exists (select 1 from public.invoice_items where invoice_id = v_fixture.invoice_id) then
    raise exception 'orphan fixture cleanup left dependent rows';
  end if;
  for relation in
    select table_info.relname
    from pg_catalog.pg_class table_info
    join pg_catalog.pg_namespace namespace on namespace.oid = table_info.relnamespace
    join pg_catalog.pg_attribute column_info on column_info.attrelid = table_info.oid
    where namespace.nspname = 'public' and table_info.relkind = 'r'
      and column_info.attname = 'shop_id' and not column_info.attisdropped
  loop
    execute format('select count(*) from public.%I where shop_id = $1', relation.relname)
      into remaining using v_fixture.shop_id;
    if remaining <> 0 then
      raise exception 'orphan fixture cleanup left rows in %', relation.relname;
    end if;
  end loop;
  if (select count(*) from public.invoices invoice
      join orphan_cleanup_fixture fixture on fixture.invoice_id = invoice.id
      where fixture.scenario <> 'stale') <> 4
    or (select count(*) from public.profiles profile
      join orphan_cleanup_fixture fixture on fixture.profile_id = profile.id
      where fixture.scenario <> 'stale') <> 4 then
    raise exception 'orphan fixture cleanup changed unrelated or live fixtures';
  end if;
  if pg_temp.cleanup_shop_orphan_fixtures() <> 0 then
    raise exception 'orphan fixture cleanup is not repeatable';
  end if;
end;
$$;
