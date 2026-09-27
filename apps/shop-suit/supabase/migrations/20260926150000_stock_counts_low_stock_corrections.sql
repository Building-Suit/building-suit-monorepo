-- SS-STOCK-002: physical counts, actionable reorder thresholds, correction
-- history, archived-stock visibility, and FIFO valuation reconciliation.

alter table public.products
  add column reorder_threshold numeric(12, 2) not null default 0,
  add constraint products_reorder_threshold_valid check (
    reorder_threshold >= 0 and reorder_threshold <= 1000000
  );

create table public.stock_counts (
  id uuid primary key,
  shop_id uuid not null references public.shops (id) on delete cascade,
  product_id uuid not null,
  expected_quantity numeric(12, 2) not null check (expected_quantity >= 0),
  counted_quantity numeric(12, 2) not null check (counted_quantity >= 0),
  variance_quantity numeric(12, 2) not null,
  positive_variance_unit_cost numeric(12, 2),
  reason text not null check (length(btrim(reason)) between 3 and 500),
  external_reference text not null check (length(btrim(external_reference)) between 1 and 200),
  counted_at timestamptz not null,
  created_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  foreign key (product_id, shop_id)
    references public.products (id, shop_id) on delete restrict,
  check (variance_quantity = counted_quantity - expected_quantity),
  check (
    (variance_quantity > 0 and positive_variance_unit_cost is not null
      and positive_variance_unit_cost >= 0)
    or (variance_quantity <= 0 and positive_variance_unit_cost is null)
  )
);
alter table public.stock_counts enable row level security;

create table public.inventory_threshold_changes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  product_id uuid not null,
  previous_threshold numeric(12, 2) not null,
  new_threshold numeric(12, 2) not null,
  changed_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  changed_at timestamptz not null default now(),
  foreign key (product_id, shop_id)
    references public.products (id, shop_id) on delete restrict,
  check (previous_threshold >= 0 and new_threshold >= 0)
);
alter table public.inventory_threshold_changes enable row level security;

create function shop_private.prevent_stock_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'STOCK_AUDIT_HISTORY_IMMUTABLE' using errcode = '55000';
end;
$$;
revoke all on function shop_private.prevent_stock_audit_mutation()
  from public, anon, authenticated;
create trigger trg_stock_counts_immutable before update or delete
on public.stock_counts for each row
execute function shop_private.prevent_stock_audit_mutation();
create trigger trg_inventory_threshold_changes_immutable before update or delete
on public.inventory_threshold_changes for each row
execute function shop_private.prevent_stock_audit_mutation();

create index stock_counts_shop_product_date_idx
  on public.stock_counts (shop_id, product_id, counted_at desc, id desc);
create index threshold_changes_shop_product_date_idx
  on public.inventory_threshold_changes (shop_id, product_id, changed_at desc, id desc);

revoke all on table public.stock_counts, public.inventory_threshold_changes
  from public, anon, authenticated;
grant all on table public.stock_counts, public.inventory_threshold_changes to service_role;

-- Preserve the established view contract in its first six columns. Archived
-- products stay visible here so remaining stock, valuation, and history never
-- disappear when the catalog record is discontinued.
create or replace view public.product_stock
with (security_invoker = true)
as
select p.shop_id, p.id as product_id, p.name, p.sku, p.sale_price,
  coalesce(sum(b.remaining_quantity), 0)::numeric as quantity_on_hand,
  p.is_active,
  p.reorder_threshold,
  coalesce(sum(b.remaining_quantity * b.unit_cost), 0)::numeric as inventory_value
from public.products p
left join public.inventory_batches b
  on b.product_id = p.id and b.shop_id = p.shop_id
group by p.shop_id, p.id, p.name, p.sku, p.sale_price,
  p.is_active, p.reorder_threshold;

create view public.low_stock_products
with (security_invoker = true)
as
select shop_id, product_id, name, sku, sale_price, quantity_on_hand,
  reorder_threshold, inventory_value
from public.product_stock
where is_active and reorder_threshold > 0
  and quantity_on_hand <= reorder_threshold;

revoke all on public.product_stock, public.low_stock_products
  from public, anon, authenticated;
grant select on public.product_stock, public.low_stock_products to authenticated;
grant select on public.product_stock, public.low_stock_products to service_role;

create function shop_private.assert_inventory_read_access(p_shop_id uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  select membership.profile_id into v_profile_id
  from public.shop_memberships membership
  join public.profiles profile on profile.id = membership.profile_id
  join public.shops shop on shop.id = membership.shop_id
    and shop.portal_id = profile.portal_id
  where membership.shop_id = p_shop_id and profile.user_id = auth.uid()
    and membership.status = 'active' and profile.status = 'active'
    and shop.status = 'active';
  if v_profile_id is null
    or not shop_private.has_permission(p_shop_id, 'inventory.view') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  return v_profile_id;
end;
$$;

create function shop_private.inventory_access(p_shop_id uuid)
returns table (can_view boolean, can_manage boolean, inventory_enabled boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform shop_private.assert_inventory_read_access(p_shop_id);
  return query select true,
    shop_private.has_permission(p_shop_id, 'inventory.manage'),
    exists (
      select 1 from public.shop_memberships owner_member
      join public.subscriptions subscription
        on subscription.profile_id = owner_member.profile_id
      join public.plans plan on plan.id = subscription.plan_id
      where owner_member.shop_id = p_shop_id and owner_member.role = 'owner'
        and owner_member.status = 'active'
        and coalesce((plan.features ->> 'inventory')::boolean, false)
        and (
          (subscription.status = 'trialing' and subscription.trial_end_at > now())
          or (subscription.status = 'active' and subscription.current_period_end > now())
        )
    );
end;
$$;

create function shop_private.assert_inventory_write_access(p_shop_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_profile_id uuid;
begin
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'inventory.manage'
  );
  if not exists (
    select 1 from public.shop_memberships owner_member
    join public.subscriptions subscription
      on subscription.profile_id = owner_member.profile_id
    join public.plans plan on plan.id = subscription.plan_id
    where owner_member.shop_id = p_shop_id and owner_member.role = 'owner'
      and owner_member.status = 'active'
      and coalesce((plan.features ->> 'inventory')::boolean, false)
  ) then
    raise exception 'INVENTORY_NOT_IN_PLAN' using errcode = '42501';
  end if;
  return v_profile_id;
end;
$$;

create function shop_private.set_reorder_threshold(
  p_shop_id uuid, p_product_id uuid, p_threshold numeric
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_profile_id uuid; v_previous numeric;
begin
  v_profile_id := shop_private.assert_inventory_write_access(p_shop_id);
  if p_product_id is null or p_threshold is null or p_threshold < 0
    or p_threshold > 1000000 or round(p_threshold, 2) <> p_threshold then
    raise exception 'INVALID_REORDER_THRESHOLD' using errcode = '22023';
  end if;
  select product.reorder_threshold into v_previous
  from public.products product
  where product.id = p_product_id and product.shop_id = p_shop_id
    and product.is_active
  for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  perform shop_private.assert_inventory_write_access(p_shop_id);
  if v_previous = p_threshold then return; end if;
  update public.products set reorder_threshold = p_threshold, updated_at = now()
  where id = p_product_id and shop_id = p_shop_id;
  insert into public.inventory_threshold_changes (
    shop_id, product_id, previous_threshold, new_threshold,
    changed_by_profile_id
  ) values (
    p_shop_id, p_product_id, v_previous, p_threshold, v_profile_id
  );
end;
$$;

create function shop_private.record_stock_count(
  p_request_id uuid,
  p_shop_id uuid,
  p_product_id uuid,
  p_counted_quantity numeric,
  p_counted_at timestamptz,
  p_reason text,
  p_reference text,
  p_positive_variance_unit_cost numeric
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile_id uuid; v_existing public.stock_counts%rowtype;
  v_expected numeric; v_variance numeric; v_batch record;
  v_batch_id uuid; v_remaining numeric; v_take numeric;
begin
  v_profile_id := shop_private.assert_inventory_write_access(p_shop_id);
  if p_request_id is null or p_product_id is null
    or p_counted_quantity is null or p_counted_quantity < 0
    or p_counted_quantity > 1000000
    or round(p_counted_quantity, 2) <> p_counted_quantity
    or p_counted_at is null or p_counted_at > now() + interval '5 minutes'
    or p_reason is null or length(btrim(p_reason)) not between 3 and 500
    or p_reference is null or length(btrim(p_reference)) not between 1 and 200
    or (p_positive_variance_unit_cost is not null
      and (p_positive_variance_unit_cost < 0
        or p_positive_variance_unit_cost > 999999999.99
        or round(p_positive_variance_unit_cost, 2) <> p_positive_variance_unit_cost)) then
    raise exception 'INVALID_STOCK_COUNT' using errcode = '22023';
  end if;

  -- Sale issuance and manual adjustments use this same product lock. Supplier
  -- returns also lock affected batches, so a concurrent supplier change is
  -- ordered before or after this correction without a partial balance.
  perform 1 from public.products product
  where product.id = p_product_id and product.shop_id = p_shop_id
  for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  perform shop_private.assert_inventory_write_access(p_shop_id);

  select * into v_existing from public.stock_counts where id = p_request_id;
  if found then
    if v_existing.shop_id = p_shop_id
      and v_existing.product_id = p_product_id
      and v_existing.counted_quantity = p_counted_quantity
      and v_existing.counted_at = p_counted_at
      and v_existing.reason = btrim(p_reason)
      and v_existing.external_reference = btrim(p_reference)
      and v_existing.positive_variance_unit_cost
        is not distinct from p_positive_variance_unit_cost then
      return p_request_id;
    end if;
    raise exception 'STOCK_COUNT_REQUEST_CONFLICT' using errcode = '23505';
  end if;

  perform shop_private.assert_period_is_open(p_shop_id, p_counted_at);
  select coalesce(sum(batch.remaining_quantity), 0) into v_expected
  from public.inventory_batches batch
  where batch.shop_id = p_shop_id and batch.product_id = p_product_id;
  v_variance := p_counted_quantity - v_expected;
  if v_variance > 0 and p_positive_variance_unit_cost is null then
    raise exception 'POSITIVE_VARIANCE_COST_REQUIRED' using errcode = '22023';
  end if;
  if v_variance <= 0 and p_positive_variance_unit_cost is not null then
    raise exception 'POSITIVE_VARIANCE_COST_NOT_ALLOWED' using errcode = '22023';
  end if;

  insert into public.stock_counts (
    id, shop_id, product_id, expected_quantity, counted_quantity,
    variance_quantity, positive_variance_unit_cost, reason,
    external_reference, counted_at, created_by_profile_id
  ) values (
    p_request_id, p_shop_id, p_product_id, v_expected,
    p_counted_quantity, v_variance, p_positive_variance_unit_cost,
    btrim(p_reason), btrim(p_reference), p_counted_at, v_profile_id
  );

  if v_variance > 0 then
    insert into public.inventory_batches (
      shop_id, product_id, quantity_received, remaining_quantity,
      unit_cost, source_type, source_id, received_at
    ) values (
      p_shop_id, p_product_id, v_variance, v_variance,
      p_positive_variance_unit_cost, 'manual', p_request_id, p_counted_at
    ) returning id into v_batch_id;
    insert into public.inventory_movements (
      shop_id, product_id, batch_id, quantity_change, movement_type,
      reference_id, created_by_profile_id, unit_cost_snapshot, created_at
    ) values (
      p_shop_id, p_product_id, v_batch_id, v_variance, 'adjustment',
      p_request_id, v_profile_id, p_positive_variance_unit_cost, p_counted_at
    );
  elsif v_variance < 0 then
    v_remaining := -v_variance;
    for v_batch in
      select batch.id, batch.remaining_quantity, batch.unit_cost
      from public.inventory_batches batch
      where batch.shop_id = p_shop_id and batch.product_id = p_product_id
        and batch.remaining_quantity > 0
      order by batch.received_at, batch.id
      for update
    loop
      v_take := least(v_remaining, v_batch.remaining_quantity);
      update public.inventory_batches
      set remaining_quantity = remaining_quantity - v_take
      where id = v_batch.id;
      insert into public.inventory_movements (
        shop_id, product_id, batch_id, quantity_change, movement_type,
        reference_id, created_by_profile_id, unit_cost_snapshot, created_at
      ) values (
        p_shop_id, p_product_id, v_batch.id, -v_take, 'adjustment',
        p_request_id, v_profile_id, v_batch.unit_cost, p_counted_at
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

create function shop_private.list_inventory(
  p_shop_id uuid, p_low_stock_only boolean default false
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  perform shop_private.assert_inventory_read_access(p_shop_id);
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(item) order by item.is_low_stock desc,
      item.is_active desc, item.name, item.product_id), '[]'::jsonb),
    'total_valuation', coalesce(sum(item.inventory_value), 0),
    'low_stock_count', count(*) filter (where item.is_low_stock)
  ) into v_result
  from (
    select product.id as product_id, product.name, product.sku,
      product.sale_price, product.is_active, product.reorder_threshold,
      coalesce(sum(batch.remaining_quantity), 0)::numeric as quantity_on_hand,
      coalesce(sum(batch.remaining_quantity * batch.unit_cost), 0)::numeric
        as inventory_value,
      (product.is_active and product.reorder_threshold > 0
        and coalesce(sum(batch.remaining_quantity), 0)
          <= product.reorder_threshold) as is_low_stock
    from public.products product
    left join public.inventory_batches batch
      on batch.shop_id = product.shop_id and batch.product_id = product.id
    where product.shop_id = p_shop_id
      and (
        product.is_active
        or exists (select 1 from public.inventory_batches historical_batch
          where historical_batch.shop_id = product.shop_id
            and historical_batch.product_id = product.id)
        or exists (select 1 from public.inventory_movements movement
          where movement.shop_id = product.shop_id
            and movement.product_id = product.id)
        or exists (select 1 from public.stock_counts stock_count
          where stock_count.shop_id = product.shop_id
            and stock_count.product_id = product.id)
      )
    group by product.id
  ) item
  where not coalesce(p_low_stock_only, false) or item.is_low_stock;
  return coalesce(v_result, jsonb_build_object(
    'items', '[]'::jsonb, 'total_valuation', 0, 'low_stock_count', 0
  ));
end;
$$;

create function shop_private.list_inventory_history(
  p_shop_id uuid, p_product_id uuid default null,
  p_page integer default 1, p_page_size integer default 50
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  perform shop_private.assert_inventory_read_access(p_shop_id);
  if p_product_id is not null and not exists (
    select 1 from public.products product
    where product.id = p_product_id and product.shop_id = p_shop_id
  ) then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if p_page is null or p_page_size is null
    or p_page < 1 or p_page_size < 1 or p_page_size > 100 then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  with events as (
    select movement.id, movement.product_id, product.name as product_name,
      product.sku, movement.created_at as event_at,
      movement.movement_type::text, movement.quantity_change,
      movement.unit_cost_snapshot,
      movement.quantity_change * movement.unit_cost_snapshot as value_change,
      case
        when stock_count.id is not null then 'physical_count'
        when adjustment.id is not null and movement.quantity_change > 0 then 'manual_receipt'
        when adjustment.id is not null then 'manual_writeoff'
        when purchase_return.id is not null then 'purchase_return'
        when invoice.id is not null then 'sale'
        when vendor_invoice.id is not null then 'purchase_receipt'
        else movement.movement_type::text
      end as source_type,
      movement.reference_id as source_id,
      coalesce(stock_count.external_reference, purchase_return.reference,
        invoice.invoice_number, vendor_invoice.invoice_number,
        movement.reference_id::text) as reference,
      coalesce(stock_count.reason, adjustment.note, purchase_return.reason) as reason,
      movement.created_by_profile_id as actor_profile_id,
      profile.display_name as actor_name
    from public.inventory_movements movement
    join public.products product on product.id = movement.product_id
      and product.shop_id = movement.shop_id
    left join public.stock_counts stock_count
      on stock_count.id = movement.reference_id
      and stock_count.shop_id = movement.shop_id
    left join public.stock_adjustment_requests adjustment
      on adjustment.id = movement.reference_id
      and adjustment.shop_id = movement.shop_id
    left join public.invoices invoice on invoice.id = movement.reference_id
      and invoice.shop_id = movement.shop_id
    left join public.vendor_invoices vendor_invoice
      on vendor_invoice.id = movement.reference_id
      and vendor_invoice.shop_id = movement.shop_id
    left join public.purchase_returns purchase_return
      on purchase_return.id = movement.reference_id
      and purchase_return.shop_id = movement.shop_id
    left join public.profiles profile on profile.id = movement.created_by_profile_id
    where movement.shop_id = p_shop_id
      and (p_product_id is null or movement.product_id = p_product_id)
  ), page_rows as (
    select * from events order by event_at desc, id desc
    offset (p_page - 1) * p_page_size limit p_page_size
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by event_at desc, id desc) from page_rows), '[]'::jsonb),
    'total', (select count(*) from events)
  ) into v_result;
  return v_result;
end;
$$;

create function shop_private.list_stock_counts(
  p_shop_id uuid, p_product_id uuid default null,
  p_page integer default 1, p_page_size integer default 50
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  perform shop_private.assert_inventory_read_access(p_shop_id);
  if p_page is null or p_page_size is null
    or p_page < 1 or p_page_size < 1 or p_page_size > 100 then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  with events as (
    select stock_count.id, stock_count.product_id, product.name as product_name,
      product.sku, stock_count.expected_quantity, stock_count.counted_quantity,
      stock_count.variance_quantity, stock_count.positive_variance_unit_cost,
      stock_count.reason, stock_count.external_reference as reference,
      stock_count.counted_at, stock_count.created_at,
      stock_count.created_by_profile_id as actor_profile_id,
      profile.display_name as actor_name
    from public.stock_counts stock_count
    join public.products product on product.id = stock_count.product_id
      and product.shop_id = stock_count.shop_id
    left join public.profiles profile on profile.id = stock_count.created_by_profile_id
    where stock_count.shop_id = p_shop_id
      and (p_product_id is null or stock_count.product_id = p_product_id)
  ), page_rows as (
    select * from events order by counted_at desc, id desc
    offset (p_page - 1) * p_page_size limit p_page_size
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(page_rows)
      order by counted_at desc, id desc) from page_rows), '[]'::jsonb),
    'total', (select count(*) from events)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function
  shop_private.assert_inventory_read_access(uuid),
  shop_private.assert_inventory_write_access(uuid),
  shop_private.inventory_access(uuid),
  shop_private.set_reorder_threshold(uuid, uuid, numeric),
  shop_private.record_stock_count(uuid, uuid, uuid, numeric, timestamptz, text, text, numeric),
  shop_private.list_inventory(uuid, boolean),
  shop_private.list_inventory_history(uuid, uuid, integer, integer),
  shop_private.list_stock_counts(uuid, uuid, integer, integer)
from public, anon, authenticated, service_role;

create function public.inventory_access(p_shop_id uuid)
returns table (can_view boolean, can_manage boolean, inventory_enabled boolean)
language sql stable security definer set search_path = ''
as $$ select * from shop_private.inventory_access(p_shop_id); $$;

create function public.set_reorder_threshold(
  p_shop_id uuid, p_product_id uuid, p_threshold numeric
) returns void language sql security definer set search_path = ''
as $$ select shop_private.set_reorder_threshold(
  p_shop_id, p_product_id, p_threshold
); $$;

create function public.record_stock_count(
  p_request_id uuid, p_shop_id uuid, p_product_id uuid,
  p_counted_quantity numeric, p_counted_at timestamptz,
  p_reason text, p_reference text, p_positive_variance_unit_cost numeric
) returns uuid language sql security definer set search_path = ''
as $$ select shop_private.record_stock_count(
  p_request_id, p_shop_id, p_product_id, p_counted_quantity,
  p_counted_at, p_reason, p_reference, p_positive_variance_unit_cost
); $$;

create function public.list_inventory(
  p_shop_id uuid, p_low_stock_only boolean default false
) returns jsonb language sql stable security definer set search_path = ''
as $$ select shop_private.list_inventory(p_shop_id, p_low_stock_only); $$;

create function public.list_inventory_history(
  p_shop_id uuid, p_product_id uuid default null,
  p_page integer default 1, p_page_size integer default 50
) returns jsonb language sql stable security definer set search_path = ''
as $$ select shop_private.list_inventory_history(
  p_shop_id, p_product_id, p_page, p_page_size
); $$;

create function public.list_stock_counts(
  p_shop_id uuid, p_product_id uuid default null,
  p_page integer default 1, p_page_size integer default 50
) returns jsonb language sql stable security definer set search_path = ''
as $$ select shop_private.list_stock_counts(
  p_shop_id, p_product_id, p_page, p_page_size
); $$;

revoke all on function
  public.inventory_access(uuid),
  public.set_reorder_threshold(uuid, uuid, numeric),
  public.record_stock_count(uuid, uuid, uuid, numeric, timestamptz, text, text, numeric),
  public.list_inventory(uuid, boolean),
  public.list_inventory_history(uuid, uuid, integer, integer),
  public.list_stock_counts(uuid, uuid, integer, integer)
from public, anon, authenticated;
grant execute on function
  public.inventory_access(uuid),
  public.set_reorder_threshold(uuid, uuid, numeric),
  public.record_stock_count(uuid, uuid, uuid, numeric, timestamptz, text, text, numeric),
  public.list_inventory(uuid, boolean),
  public.list_inventory_history(uuid, uuid, integer, integer),
  public.list_stock_counts(uuid, uuid, integer, integer)
to authenticated;
grant execute on function
  public.inventory_access(uuid),
  public.set_reorder_threshold(uuid, uuid, numeric),
  public.record_stock_count(uuid, uuid, uuid, numeric, timestamptz, text, text, numeric),
  public.list_inventory(uuid, boolean),
  public.list_inventory_history(uuid, uuid, integer, integer),
  public.list_stock_counts(uuid, uuid, integer, integer)
to service_role;

notify pgrst, 'reload schema';
