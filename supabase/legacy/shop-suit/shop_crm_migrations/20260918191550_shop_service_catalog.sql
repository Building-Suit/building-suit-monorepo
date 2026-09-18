-- A bounded service catalog using the existing shop_crm price and discount shape.
alter table shop_crm.services
  add constraint services_price_nonnegative
    check (base_sale_price is not null and base_sale_price >= 0),
  add constraint services_discount_valid
    check (
      default_discount_type is not null
      and default_discount_value is not null
      and default_discount_value >= 0
      and (
        (default_discount_type = 'percent' and default_discount_value <= 100)
        or (default_discount_type = 'amount' and default_discount_value <= base_sale_price)
      )
    );

update shop_crm.plans p
set features = jsonb_set(p.features, '{max_services}', to_jsonb(50), true)
where p.slug = 'basic'
  and p.portal_id = (select id from shop_crm.portals where key = 'shop-crm')
  and not (p.features ? 'max_services');
update shop_crm.plans p
set features = jsonb_set(p.features, '{max_services}', to_jsonb(500), true)
where p.slug = 'pro'
  and p.portal_id = (select id from shop_crm.portals where key = 'shop-crm')
  and not (p.features ? 'max_services');

create function shop_private.save_service(
  p_shop_id uuid,
  p_service_id uuid,
  p_name text,
  p_description text,
  p_base_sale_price numeric,
  p_discount_type text,
  p_discount_value numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_service_id uuid;
  v_limit integer;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'services.manage');
  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 160
    or (p_description is not null and length(btrim(p_description)) > 1000)
    or p_base_sale_price is null or p_base_sale_price < 0 or p_base_sale_price > 999999999.99
    or p_discount_type not in ('amount', 'percent') or p_discount_type is null
    or p_discount_value is null or p_discount_value < 0
    or (p_discount_type = 'percent' and p_discount_value > 100)
    or (p_discount_type = 'amount' and p_discount_value > p_base_sale_price) then
    raise exception 'INVALID_SERVICE' using errcode = '22023';
  end if;

  perform 1 from shop_crm.shops where id = p_shop_id for update;
  if not found then raise exception 'SHOP_NOT_FOUND'; end if;
  perform shop_private.assert_shop_write_access(p_shop_id, 'services.manage');

  if p_service_id is null then
    select (plan.features ->> 'max_services')::integer into v_limit
    from shop_crm.shop_memberships m
    join shop_crm.subscriptions sub on sub.profile_id = m.profile_id
    join shop_crm.plans plan on plan.id = sub.plan_id
    where m.shop_id = p_shop_id and m.role = 'owner' and m.status = 'active';
    if v_limit is null or v_limit < 1 then
      raise exception 'SERVICE_LIMIT_UNCONFIGURED' using errcode = '23514';
    end if;
    if (select count(*) from shop_crm.services
        where shop_id = p_shop_id and is_active) >= v_limit then
      raise exception 'SERVICE_LIMIT_REACHED' using errcode = '23514';
    end if;
    insert into shop_crm.services (
      shop_id, name, description, base_sale_price,
      default_discount_type, default_discount_value, created_by_profile_id
    ) values (
      p_shop_id, btrim(p_name), nullif(btrim(p_description), ''), p_base_sale_price,
      p_discount_type, p_discount_value, v_profile_id
    ) returning id into v_service_id;
  else
    update shop_crm.services
    set name = btrim(p_name), description = nullif(btrim(p_description), ''),
      base_sale_price = p_base_sale_price,
      default_discount_type = p_discount_type,
      default_discount_value = p_discount_value, updated_at = now()
    where id = p_service_id and shop_id = p_shop_id and is_active
    returning id into v_service_id;
    if v_service_id is null then raise exception 'SERVICE_NOT_FOUND'; end if;
  end if;
  return v_service_id;
end;
$$;
revoke all on function shop_private.save_service(uuid,uuid,text,text,numeric,text,numeric)
  from public, anon, authenticated;
grant execute on function shop_private.save_service(uuid,uuid,text,text,numeric,text,numeric)
  to authenticated;

create function shop_crm.save_service(
  p_shop_id uuid, p_service_id uuid, p_name text, p_description text,
  p_base_sale_price numeric, p_discount_type text, p_discount_value numeric
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select shop_private.save_service(
    p_shop_id, p_service_id, p_name, p_description,
    p_base_sale_price, p_discount_type, p_discount_value
  );
$$;
revoke all on function shop_crm.save_service(uuid,uuid,text,text,numeric,text,numeric)
  from public, anon, authenticated;
grant execute on function shop_crm.save_service(uuid,uuid,text,text,numeric,text,numeric)
  to authenticated;

create function shop_private.archive_service(p_shop_id uuid, p_service_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform shop_private.assert_shop_write_access(p_shop_id, 'services.manage');
  update shop_crm.services set is_active = false, updated_at = now()
  where id = p_service_id and shop_id = p_shop_id and is_active;
  if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
end;
$$;
revoke all on function shop_private.archive_service(uuid,uuid)
  from public, anon, authenticated;
grant execute on function shop_private.archive_service(uuid,uuid) to authenticated;

create function shop_crm.archive_service(p_shop_id uuid, p_service_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select shop_private.archive_service(p_shop_id, p_service_id);
$$;
revoke all on function shop_crm.archive_service(uuid,uuid)
  from public, anon, authenticated;
grant execute on function shop_crm.archive_service(uuid,uuid) to authenticated;

notify pgrst, 'reload schema';
