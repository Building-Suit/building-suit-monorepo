-- First daily workflow: a sale price and a quota-checked product catalog.
alter table shop_crm.products
  add column sale_price numeric(12, 2) not null default 0;
alter table shop_crm.products
  add constraint products_sale_price_nonnegative check (sale_price >= 0);
create unique index products_shop_active_sku_unique
  on shop_crm.products (shop_id, lower(sku))
  where is_active and sku is not null;

-- These initial Shop Suit catalog caps are stored with each commercial plan,
-- not in the browser. Existing feature keys are preserved.
update shop_crm.plans p
set features = jsonb_set(p.features, '{max_products}', to_jsonb(100), true)
where p.slug = 'basic'
  and p.portal_id = (select id from shop_crm.portals where key = 'shop-crm')
  and not (p.features ? 'max_products');
update shop_crm.plans p
set features = jsonb_set(p.features, '{max_products}', to_jsonb(1000), true)
where p.slug = 'pro'
  and p.portal_id = (select id from shop_crm.portals where key = 'shop-crm')
  and not (p.features ? 'max_products');

create function shop_private.assert_shop_write_access(
  p_shop_id uuid,
  p_permission_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  select m.profile_id into v_profile_id
  from shop_crm.shop_memberships m
  join shop_crm.profiles p on p.id = m.profile_id
  join shop_crm.shops s on s.id = m.shop_id and s.portal_id = p.portal_id
  where m.shop_id = p_shop_id and p.user_id = auth.uid()
    and m.status = 'active' and p.status = 'active' and s.status = 'active';
  if v_profile_id is null
    or not shop_private.has_permission(p_shop_id, p_permission_key) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from shop_crm.shop_memberships owner_member
    join shop_crm.profiles owner_profile
      on owner_profile.id = owner_member.profile_id
    join shop_crm.subscriptions sub
      on sub.profile_id = owner_member.profile_id
    where owner_member.shop_id = p_shop_id
      and owner_member.role = 'owner'
      and owner_member.status = 'active'
      and owner_profile.status = 'active'
      and (
        (sub.status = 'trialing' and sub.trial_end_at > now())
        or (sub.status = 'active' and sub.current_period_end > now())
      )
  ) then
    raise exception 'SHOP_SUBSCRIPTION_INACTIVE' using errcode = '42501';
  end if;
  return v_profile_id;
end;
$$;
revoke all on function shop_private.assert_shop_write_access(uuid, text)
  from public, anon, authenticated;

create function shop_private.save_product(
  p_shop_id uuid,
  p_product_id uuid,
  p_name text,
  p_sku text,
  p_barcode text,
  p_sale_price numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_product_id uuid;
  v_limit integer;
begin
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'inventory.manage'
  );
  if p_name is null or length(btrim(p_name)) < 2
     or length(btrim(p_name)) > 160
     or p_sale_price is null or p_sale_price < 0
     or p_sale_price > 999999999.99
     or (p_sku is not null and length(btrim(p_sku)) > 80)
     or (p_barcode is not null and length(btrim(p_barcode)) > 80) then
    raise exception 'INVALID_PRODUCT' using errcode = '22023';
  end if;

  -- One lock coordinates quota-increasing calls for this shop.
  perform 1 from shop_crm.shops s where s.id = p_shop_id for update;
  if not found then
    raise exception 'SHOP_NOT_FOUND';
  end if;
  perform shop_private.assert_shop_write_access(
    p_shop_id, 'inventory.manage'
  );

  if p_product_id is null then
    select (plan.features ->> 'max_products')::integer into v_limit
    from shop_crm.shop_memberships m
    join shop_crm.subscriptions sub on sub.profile_id = m.profile_id
    join shop_crm.plans plan on plan.id = sub.plan_id
    where m.shop_id = p_shop_id and m.role = 'owner'
      and m.status = 'active';
    if v_limit is null or v_limit < 1 then
      raise exception 'PRODUCT_LIMIT_UNCONFIGURED';
    end if;
    if (select count(*) from shop_crm.products
        where shop_id = p_shop_id and is_active) >= v_limit then
      raise exception 'PRODUCT_LIMIT_REACHED' using errcode = '23514';
    end if;
    insert into shop_crm.products (
      shop_id, name, sku, barcode, sale_price, created_by_profile_id
    ) values (
      p_shop_id, btrim(p_name), nullif(btrim(p_sku), ''),
      nullif(btrim(p_barcode), ''), p_sale_price, v_profile_id
    ) returning id into v_product_id;
  else
    update shop_crm.products
    set name = btrim(p_name), sku = nullif(btrim(p_sku), ''),
        barcode = nullif(btrim(p_barcode), ''), sale_price = p_sale_price,
        updated_at = now()
    where id = p_product_id and shop_id = p_shop_id and is_active
    returning id into v_product_id;
    if v_product_id is null then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;
  end if;
  return v_product_id;
end;
$$;
revoke all on function shop_private.save_product(uuid, uuid, text, text, text, numeric)
  from public, anon, authenticated;
grant execute on function shop_private.save_product(uuid, uuid, text, text, text, numeric)
  to authenticated;

create function shop_crm.save_product(
  p_shop_id uuid,
  p_product_id uuid,
  p_name text,
  p_sku text,
  p_barcode text,
  p_sale_price numeric
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select shop_private.save_product(
    p_shop_id, p_product_id, p_name, p_sku, p_barcode, p_sale_price
  );
$$;
revoke all on function shop_crm.save_product(uuid, uuid, text, text, text, numeric)
  from public, anon, authenticated;
grant execute on function shop_crm.save_product(uuid, uuid, text, text, text, numeric)
  to authenticated;

create function shop_private.archive_product(p_shop_id uuid, p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform shop_private.assert_shop_write_access(
    p_shop_id, 'inventory.manage'
  );
  update shop_crm.products
  set is_active = false, updated_at = now()
  where id = p_product_id and shop_id = p_shop_id and is_active;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
end;
$$;
revoke all on function shop_private.archive_product(uuid, uuid)
  from public, anon, authenticated;
grant execute on function shop_private.archive_product(uuid, uuid)
  to authenticated;

create function shop_crm.archive_product(p_shop_id uuid, p_product_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select shop_private.archive_product(p_shop_id, p_product_id);
$$;
revoke all on function shop_crm.archive_product(uuid, uuid)
  from public, anon, authenticated;
grant execute on function shop_crm.archive_product(uuid, uuid)
  to authenticated;

notify pgrst, 'reload schema';
