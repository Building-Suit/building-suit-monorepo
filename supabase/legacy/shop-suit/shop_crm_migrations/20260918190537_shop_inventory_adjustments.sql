-- Idempotent manual stock intake/write-off. Sales and supplier posting will use
-- the same product lock and FIFO batch order in later migrations.
alter table shop_crm.inventory_movements
  add column unit_cost_snapshot numeric(12, 2);
alter table shop_crm.inventory_movements
  add constraint inventory_movement_nonzero check (quantity_change <> 0);
alter table shop_crm.inventory_batches
  add constraint inventory_batch_positive_received check (quantity_received > 0);

create table shop_crm.stock_adjustment_requests (
  id uuid primary key,
  shop_id uuid not null references shop_crm.shops(id) on delete cascade,
  product_id uuid not null references shop_crm.products(id) on delete restrict,
  quantity_change numeric not null check (quantity_change <> 0),
  unit_cost numeric(12, 2),
  note text,
  created_by_profile_id uuid not null references shop_crm.profiles(id),
  created_at timestamptz not null default now()
);
alter table shop_crm.stock_adjustment_requests enable row level security;
revoke all on table shop_crm.stock_adjustment_requests from public, anon, authenticated;

create view shop_crm.product_stock
with (security_invoker = true)
as
select p.shop_id, p.id as product_id, p.name, p.sku, p.sale_price,
  coalesce(sum(b.remaining_quantity), 0)::numeric as quantity_on_hand
from shop_crm.products p
left join shop_crm.inventory_batches b
  on b.product_id = p.id and b.shop_id = p.shop_id
where p.is_active
group by p.shop_id, p.id, p.name, p.sku, p.sale_price;
revoke all on shop_crm.product_stock from public, anon, authenticated;
grant select on shop_crm.product_stock to authenticated;

create function shop_private.adjust_stock(
  p_request_id uuid,
  p_shop_id uuid,
  p_product_id uuid,
  p_quantity_change numeric,
  p_unit_cost numeric,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_existing shop_crm.stock_adjustment_requests%rowtype;
  v_batch record;
  v_batch_id uuid;
  v_remaining numeric;
  v_take numeric;
begin
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'inventory.manage'
  );
  if p_request_id is null or p_product_id is null
    or p_quantity_change is null or p_quantity_change = 0
    or abs(p_quantity_change) > 1000000
    or round(p_quantity_change, 3) <> p_quantity_change
    or (p_quantity_change > 0 and
        (p_unit_cost is null or p_unit_cost < 0 or p_unit_cost > 999999999.99))
    or (p_quantity_change < 0 and
        (p_unit_cost is not null or p_note is null
         or length(btrim(p_note)) < 3))
    or (p_note is not null and length(btrim(p_note)) > 500) then
    raise exception 'INVALID_STOCK_ADJUSTMENT' using errcode = '22023';
  end if;

  -- All batch mutations for a product serialize here.
  perform 1 from shop_crm.products p
  where p.id = p_product_id and p.shop_id = p_shop_id and p.is_active
  for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  perform shop_private.assert_shop_write_access(
    p_shop_id, 'inventory.manage'
  );

  if not exists (
    select 1 from shop_crm.shop_memberships m
    join shop_crm.subscriptions sub on sub.profile_id = m.profile_id
    join shop_crm.plans plan on plan.id = sub.plan_id
    where m.shop_id = p_shop_id and m.role = 'owner'
      and m.status = 'active'
      and coalesce((plan.features ->> 'inventory')::boolean, false)
  ) then
    raise exception 'INVENTORY_NOT_IN_PLAN' using errcode = '42501';
  end if;

  select * into v_existing
  from shop_crm.stock_adjustment_requests
  where id = p_request_id;
  if found then
    if v_existing.shop_id = p_shop_id
      and v_existing.product_id = p_product_id
      and v_existing.quantity_change = p_quantity_change
      and v_existing.unit_cost is not distinct from p_unit_cost
      and v_existing.note is not distinct from nullif(btrim(p_note), '') then
      return p_request_id;
    end if;
    raise exception 'STOCK_REQUEST_CONFLICT' using errcode = '23505';
  end if;

  insert into shop_crm.stock_adjustment_requests (
    id, shop_id, product_id, quantity_change, unit_cost, note,
    created_by_profile_id
  ) values (
    p_request_id, p_shop_id, p_product_id, p_quantity_change,
    case when p_quantity_change > 0 then p_unit_cost else null end,
    nullif(btrim(p_note), ''), v_profile_id
  );

  if p_quantity_change > 0 then
    insert into shop_crm.inventory_batches (
      shop_id, product_id, quantity_received, remaining_quantity,
      unit_cost, source_type, received_at
    ) values (
      p_shop_id, p_product_id, p_quantity_change, p_quantity_change,
      p_unit_cost, 'manual', clock_timestamp()
    ) returning id into v_batch_id;
    insert into shop_crm.inventory_movements (
      shop_id, product_id, batch_id, quantity_change, movement_type,
      reference_id, created_by_profile_id, unit_cost_snapshot
    ) values (
      p_shop_id, p_product_id, v_batch_id, p_quantity_change, 'in',
      p_request_id, v_profile_id, p_unit_cost
    );
  else
    v_remaining := -p_quantity_change;
    for v_batch in
      select id, remaining_quantity, unit_cost
      from shop_crm.inventory_batches
      where shop_id = p_shop_id and product_id = p_product_id
        and remaining_quantity > 0
      order by received_at, id
      for update
    loop
      v_take := least(v_remaining, v_batch.remaining_quantity);
      update shop_crm.inventory_batches
      set remaining_quantity = remaining_quantity - v_take
      where id = v_batch.id;
      insert into shop_crm.inventory_movements (
        shop_id, product_id, batch_id, quantity_change, movement_type,
        reference_id, created_by_profile_id, unit_cost_snapshot
      ) values (
        p_shop_id, p_product_id, v_batch.id, -v_take, 'adjustment',
        p_request_id, v_profile_id, v_batch.unit_cost
      );
      v_remaining := v_remaining - v_take;
      exit when v_remaining = 0;
    end loop;
    if v_remaining > 0 then
      raise exception 'INSUFFICIENT_STOCK' using errcode = '23514';
    end if;
  end if;
  return p_request_id;
end;
$$;
revoke all on function shop_private.adjust_stock(uuid, uuid, uuid, numeric, numeric, text)
  from public, anon, authenticated;
grant execute on function shop_private.adjust_stock(uuid, uuid, uuid, numeric, numeric, text)
  to authenticated;

create function shop_crm.adjust_stock(
  p_request_id uuid,
  p_shop_id uuid,
  p_product_id uuid,
  p_quantity_change numeric,
  p_unit_cost numeric,
  p_note text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select shop_private.adjust_stock(
    p_request_id, p_shop_id, p_product_id, p_quantity_change,
    p_unit_cost, p_note
  );
$$;
revoke all on function shop_crm.adjust_stock(uuid, uuid, uuid, numeric, numeric, text)
  from public, anon, authenticated;
grant execute on function shop_crm.adjust_stock(uuid, uuid, uuid, numeric, numeric, text)
  to authenticated;

notify pgrst, 'reload schema';
