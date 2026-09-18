


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."DELETE_get_shop_role"("shop" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$select role from public.shop_members
  where shop_id = shop and user_id = auth.uid()
  limit 1;$$;


ALTER FUNCTION "public"."DELETE_get_shop_role"("shop" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."DELETE_shop_has_module"("p_shop_id" "uuid", "p_module_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$select exists (
    select 1
    from shop_modules sm
    where sm.shop_id = p_shop_id
      and sm.module_key = p_module_key
      and sm.enabled = true
      and (sm.ends_at is null or sm.ends_at > now())
  );$$;


ALTER FUNCTION "public"."DELETE_shop_has_module"("p_shop_id" "uuid", "p_module_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_expense"("p_shop_id" "uuid", "p_amount" numeric, "p_category" "text", "p_note" "text" DEFAULT NULL::"text", "p_employee_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
declare
  new_id uuid;
begin
  insert into store_entries (
    id,
    shop_id,
    kind,
    amount,
    category,
    note,
    created_by,
    employee_id
  )
  values (
    gen_random_uuid(),
    p_shop_id,
    'expense',
    p_amount,
    p_category,
    p_note,
    (
      select id from shop_members
      where user_id = auth.uid()
        and shop_id = p_shop_id
      limit 1
    ),
    p_employee_id
  )
  returning id into new_id;

  return new_id;
end;
$$;


ALTER FUNCTION "public"."add_expense"("p_shop_id" "uuid", "p_amount" numeric, "p_category" "text", "p_note" "text", "p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_store_entry"("p_shop_id" "uuid", "p_kind" "text", "p_amount" numeric, "p_category" "text" DEFAULT 'general'::"text", "p_note" "text" DEFAULT NULL::"text", "p_employee_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
declare
  new_id uuid;
begin
  insert into store_entries (
    id, shop_id, kind, amount, category, note, created_by, employee_id
  )
  values (
    gen_random_uuid(),
    p_shop_id,
    p_kind,
    p_amount,
    p_category,
    p_note,
    (select id from shop_members where user_id = auth.uid() and shop_id = p_shop_id limit 1),
    p_employee_id
  )
  returning id into new_id;

  return new_id;
end;
$$;


ALTER FUNCTION "public"."add_store_entry"("p_shop_id" "uuid", "p_kind" "text", "p_amount" numeric, "p_category" "text", "p_note" "text", "p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."allocate_fifo_for_item"("p_invoice_item_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_item record;
  v_remaining numeric;
  v_batch record;
  v_already_allocated numeric;
  v_available numeric;
  v_to_use numeric;
begin
  -- 1) Load the invoice item + invoice info
  select ii.*, inv.created_at as invoice_created_at
  into v_item
  from invoice_items ii
  join invoices inv on inv.id = ii.invoice_id
  where ii.id = p_invoice_item_id
    and inv.invoice_source = 'client';

  -- Only handle products
  if v_item.item_type <> 'product' or v_item.product_id is null then
    return;
  end if;

  v_remaining := v_item.quantity;

  -- 2) Loop over vendor batches in FIFO order
  for v_batch in
    select
      i.id,
      i.quantity_change,
      i.vendor_price
    from inventory i
    where i.product_id = v_item.product_id
      and i.reason = 'vendor_invoice'
    order by i.created_at asc
  loop
    exit when v_remaining <= 0;

    -- 3) How much of this batch is already used?
    select coalesce(sum(c.qty), 0)
    into v_already_allocated
    from invoice_item_cogs c
    where c.batch_id = v_batch.id;

    v_available := v_batch.quantity_change - v_already_allocated;
    if v_available <= 0 then
      continue;
    end if;

    -- 4) Use as much as we can from this batch
    v_to_use := least(v_available, v_remaining);

    insert into invoice_item_cogs (
      invoice_item_id,
      product_id,
      batch_id,
      qty,
      unit_cost,
      total_cost
    ) values (
      v_item.id,
      v_item.product_id,
      v_batch.id,
      v_to_use,
      v_batch.vendor_price,
      v_to_use * v_batch.vendor_price
    );

    v_remaining := v_remaining - v_to_use;
  end loop;

  -- Optional: if v_remaining > 0, you sold more than stock.
  -- You can log it, raise an exception, or ignore.
end;
$$;


ALTER FUNCTION "public"."allocate_fifo_for_item"("p_invoice_item_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_plan_modules_to_shop"("p_shop_id" "uuid", "p_plan_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into shop_modules (shop_id, module_key, enabled, plan)
  select 
    p_shop_id,
    pm.module_key,
    true,
    (select key from plans where id = p_plan_id)
  from plan_modules pm
  where pm.plan_id = p_plan_id
  on conflict (shop_id, module_key) do update 
    set enabled = excluded.enabled,
        plan = excluded.plan;
end;
$$;


ALTER FUNCTION "public"."apply_plan_modules_to_shop"("p_shop_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_metrics"("p_shop" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  total_revenue_val numeric := 0;
  total_profit_val numeric := 0;
  total_cogs_val numeric := 0;
  total_units_val numeric := 0;

  total_expenses_val numeric := 0;
  total_manual_income_val numeric := 0;
  net_profit_val numeric := 0;

  daily_sales jsonb := '[]'::jsonb;
  profit_by_product jsonb := '[]'::jsonb;
begin

  --------------------------------------------------------------------
  -- 1) MAIN KPI SUMMARY
  --------------------------------------------------------------------
  select
    coalesce(sum(invoice_revenue(inv.id)), 0),
    coalesce(sum(invoice_cogs(inv.id)), 0),
    coalesce(sum(fifo_profit(inv.id)), 0),
    coalesce(sum(ii.quantity), 0)
  into
    total_revenue_val,
    total_cogs_val,
    total_profit_val,
    total_units_val
  from invoices inv
  left join invoice_items ii on ii.invoice_id = inv.id
  where inv.shop_id = p_shop
    and inv.invoice_source = 'client'
    and inv.deleted_at is null;


  --------------------------------------------------------------------
  -- 2) DAILY SALES (using stored FIFO + stored revenue)
  --------------------------------------------------------------------
  daily_sales := (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'day', day,
        'revenue', revenue,
        'cogs', cogs,
        'profit', profit
      )
      order by day
    ), '[]'::jsonb)
    from (
      select
        to_char(date_trunc('day', inv.created_at), 'YYYY-MM-DD') as day,
        sum(invoice_revenue(inv.id)) as revenue,
        sum(invoice_cogs(inv.id))    as cogs,
        sum(fifo_profit(inv.id))     as profit
      from invoices inv
      where inv.shop_id = p_shop
        and inv.invoice_source = 'client'
        and inv.deleted_at is null
      group by day
    ) x
  );


  --------------------------------------------------------------------
  -- 3) PROFIT BY PRODUCT (using invoice_item_cogs)
  --------------------------------------------------------------------
  profit_by_product := (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'product_name', p.name,
        'product_id', product_id,
        'revenue', revenue,
        'cogs', cogs,
        'profit', revenue - cogs
      )
      order by product_id
    ), '[]'::jsonb)
    from (
      select
        ii.product_id,
        p.name,
        sum(ii.line_total
            - coalesce(inv.discount, 0)
            - coalesce(inv.extra_discount, 0)
        ) as revenue,

        sum(c.total_cost) as cogs

      from invoices inv
      join invoice_items ii on ii.invoice_id = inv.id
      left join products as p on p.id = ii.product_id
      left join invoice_item_cogs c on c.invoice_item_id = ii.id

      where inv.shop_id = p_shop
        and inv.invoice_source = 'client'
        and ii.item_type = 'product'
        and inv.deleted_at is null

      group by ii.product_id, p.name
    ) p
  );




  --------------------------------------------------------------------
  -- EXPENSES / INCOMES FROM store_entries
  --------------------------------------------------------------------

  -- total expenses
  select coalesce(sum(amount), 0)
  into total_expenses_val
  from store_entries
  where shop_id = p_shop
    and kind = 'expense'
    and deleted_at is null;

  -- total incomes (manual + non-invoice)
  select coalesce(sum(amount), 0)
  into total_manual_income_val
  from store_entries
  where shop_id = p_shop
    and kind = 'income'
    and deleted_at is null;

  -- net profit
  net_profit_val := total_profit_val - total_expenses_val + total_manual_income_val;




  --------------------------------------------------------------------
  -- RETURN FINAL JSON
  --------------------------------------------------------------------
  return jsonb_build_object(
    'total_revenue', total_revenue_val,
    'total_cogs', total_cogs_val,
    'total_profit', total_profit_val,
    'total_units_sold', total_units_val,

    'total_expenses', total_expenses_val,
    'total_manual_income', total_manual_income_val,
    'net_profit', net_profit_val,

    'daily_sales', daily_sales,
    'profit_by_product', profit_by_product
  );
end;
$$;


ALTER FUNCTION "public"."dashboard_metrics"("p_shop" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fifo_cogs"("product" "uuid") RETURNS numeric
    LANGUAGE "sql"
    AS $$
  select coalesce(sum(total_cost), 0)
  from invoice_item_cogs
  where product_id = product;
$$;


ALTER FUNCTION "public"."fifo_cogs"("product" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fifo_cogs_for_invoice"("inv" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
declare
  rec record;
  prod record;
  total_cogs numeric := 0;
  remaining_qty numeric;
  used_qty numeric;
begin
  --------------------------------------------------------------------
  -- Loop through each PRODUCT in this invoice
  --------------------------------------------------------------------
  for prod in
    select product_id, sum(quantity) as qty_in_invoice
    from invoice_items
    where invoice_id = inv
      and item_type = 'product'
      and product_id is not null
    group by product_id
  loop
    remaining_qty := prod.qty_in_invoice;

    --------------------------------------------------------------------
    -- First: simulate ALL SALES BEFORE THIS INVOICE
    --------------------------------------------------------------------
    for rec in
      select
        quantity_change as sold_qty
      from inventory
      where product_id = prod.product_id
        and reason = 'client_invoice'
        and created_at < (
          select created_at from invoices where id = inv
        )
      order by created_at
    loop
      -- this is sales, so subtract from remaining_qty BEFORE this invoice
      remaining_qty := remaining_qty + rec.sold_qty; -- rec.sold_qty is negative
    end loop;

    --------------------------------------------------------------------
    -- Now: consume vendor batches for THIS INVOICE ONLY
    --------------------------------------------------------------------
    for rec in
      select
        quantity_change as batch_qty,
        vendor_price
      from inventory
      where product_id = prod.product_id
        and reason = 'vendor_invoice'
      order by created_at asc
    loop
      exit when remaining_qty <= 0;

      if rec.batch_qty <= remaining_qty then
        used_qty := rec.batch_qty;
      else
        used_qty := remaining_qty;
      end if;

      total_cogs := total_cogs + (used_qty * rec.vendor_price);
      remaining_qty := remaining_qty - used_qty;
    end loop;
  end loop;

  return total_cogs;
end;
$$;


ALTER FUNCTION "public"."fifo_cogs_for_invoice"("inv" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fifo_profit"("invoice" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
declare
  revenue numeric := 0;
  cogs numeric := 0;
begin
  revenue := invoice_revenue(invoice); -- your existing function
  cogs := invoice_cogs(invoice);

  return revenue - cogs;
end;
$$;


ALTER FUNCTION "public"."fifo_profit"("invoice" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_invoice_item"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  parent_invoice record;
  new_product uuid;
begin
  -- Get invoice info
  select id, invoice_source, shop_id
  into parent_invoice
  from invoices
  where id = new.invoice_id;

  -- Only process product items
  if new.item_type <> 'product' then
    return new;
  end if;

  -- ================================================
  -- 1) CREATE PRODUCT ONLY IF vendor invoice
  -- ================================================
  if parent_invoice.invoice_source = 'vendor'
     and new.product_id is null then

      insert into products (shop_id, name, vendor_price, price, stock)
      values (
        parent_invoice.shop_id,
        coalesce(new.description, 'Unnamed Product'),
        new.unit_price,
        0,
        0
      )
      returning id into new_product;

      new.product_id := new_product;

  elsif parent_invoice.invoice_source = 'client'
        and new.product_id is null then
      -- client invoice with no product_id = INVALID
      raise exception 'Client invoice item missing product_id';
  else
      new_product := new.product_id;
  end if;

  -- ================================================
  -- 2) Update vendor price only for vendor invoices
  -- ================================================
  if parent_invoice.invoice_source = 'vendor' then
    update products
    set vendor_price = new.unit_price
    where id = new_product;
  end if;

  -- ================================================
  -- 3) STOCK MOVEMENT
  -- ================================================

  if parent_invoice.invoice_source = 'vendor' then
    -- Stock IN
    update products
    set stock = stock + new.quantity
    where id = new_product;

    insert into inventory (shop_id, product_id, quantity_change, reason, vendor_price, invoice_id)
    values (
      parent_invoice.shop_id,
      new_product,
      new.quantity,
      'vendor_invoice',
      new.unit_price,
      parent_invoice.id
    );

  elsif parent_invoice.invoice_source = 'client' then
    -- Stock OUT
    update products
    set stock = stock - new.quantity
    where id = new_product;

    insert into inventory (shop_id, product_id, quantity_change, reason, invoice_id)
    values (
      parent_invoice.shop_id,
      new_product,
      -new.quantity,
      'client_invoice',
      parent_invoice.id
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_invoice_item"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoice_cogs"("p_invoice" "uuid") RETURNS numeric
    LANGUAGE "sql"
    AS $$
  select coalesce(sum(c.total_cost), 0)
  from invoice_item_cogs c
  join invoice_items ii on ii.id = c.invoice_item_id
  where ii.invoice_id = p_invoice;
$$;


ALTER FUNCTION "public"."invoice_cogs"("p_invoice" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoice_revenue"("invoice" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
declare
  total_revenue numeric := 0;
begin
  with items as (
    select
      ii.line_total,
      inv.discount as invoice_discount,
      inv.extra_discount,
      sum(ii.line_total) over (partition by ii.invoice_id) as invoice_subtotal
    from invoice_items ii
    join invoices inv on inv.id = ii.invoice_id
    where ii.invoice_id = invoice
      and inv.invoice_source = 'client'
      and inv.deleted_at is null
  ),
  revenue_calc as (
    select
      (
        line_total
        - (case when invoice_subtotal > 0
             then (coalesce(invoice_discount, 0) * (line_total / invoice_subtotal))
             else 0 end)
        - (case when invoice_subtotal > 0
             then (coalesce(extra_discount, 0) * (line_total / invoice_subtotal))
             else 0 end)
      ) as final_revenue
    from items
  )
  select sum(final_revenue)
  into total_revenue
  from revenue_calc;

  return coalesce(total_revenue, 0);
end;
$$;


ALTER FUNCTION "public"."invoice_revenue"("invoice" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_shop_member"("shop_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1
    from shop_members
    where shop_members.shop_id = shop_id
    and shop_members.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_shop_member"("shop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_shop_member"("p_user" "uuid", "p_shop" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from shop_members sm
    where sm.shop_id = p_shop
      and sm.user_id = p_user
      and sm.deleted_at is null
  );
$$;


ALTER FUNCTION "public"."is_shop_member"("p_user" "uuid", "p_shop" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_shop_owner"("target_user" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from shop_members sm_owner
    where sm_owner.user_id = auth.uid()
      and sm_owner.role = 'owner'
      and sm_owner.shop_id in (
         select shop_id
         from shop_members
         where user_id = target_user
      )
  );
$$;


ALTER FUNCTION "public"."is_shop_owner"("target_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."setup_shop_for_new_user"("p_user_id" "uuid", "p_shop_name" "text", "p_plan_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$declare
  v_plan record;
  v_user record;
  v_shop_id uuid;
  v_member_id uuid;
  v_sub_id uuid;
begin
  -- 1) get plan
  select * into v_plan
  from plans
  where key = p_plan_key
    and is_active = true;

  if not found then
    raise exception 'Invalid plan key %', p_plan_key;
  end if;

  -- 1.5) get user
  select * into v_user
  from auth.users
  where id = p_user_id;

  if not found then
    raise exception 'Invalid User%', p_user_id;
  end if;

  -- 2) create shop
  insert into shops (name, owner_id)
  values (p_shop_name, p_user_id)
  returning id into v_shop_id;

  -- 3) create shop_member (owner)
  insert into shop_members (shop_id, user_id, role, full_name, email)
  values (
    v_shop_id,
    p_user_id,
    'owner',
    p_shop_name, -- or null
    v_user.email
  )
  returning id into v_member_id;

  -- -- 4) create subscription
  -- insert into shop_subscriptions (
  --   shop_id,
  --   plan_id,
  --   status,
  --   trial_ends_at,
  --   current_period_start,
  --   current_period_end
  -- )
  -- values (
  --   v_shop_id,
  --   v_plan.id,
  --   case when v_plan.trial_days > 0 then 'trialing' else 'pending_payment' end,
  --   case 
  --     when v_plan.trial_days > 0 
  --     then now() + (v_plan.trial_days || ' days')::interval 
  --     else null 
  --   end,
  --   now(),
  --   null
  -- )
  -- returning id into v_sub_id;


  -- 4) create subscription (always pending_payment, Stripe will set trialing)

  -- mark any old current subscription as not current (safety)
  update shop_subscriptions
  set is_current = false
  where shop_id = v_shop_id
    and is_current = true;

  insert into shop_subscriptions (
    shop_id,
    plan_id,
    status,
    trial_ends_at,
    current_period_start,
    current_period_end,
    is_current
  )
  values (
    v_shop_id,
    v_plan.id,
    'pending_payment',
    null,
    now(),
    null,
    true
  )
  returning id into v_sub_id;


  -- 5) apply modules for that plan
  perform apply_plan_modules_to_shop(v_shop_id, v_plan.id);

  return jsonb_build_object(
    'shop_id', v_shop_id,
    'shop_member_id', v_member_id,
    'subscription_id', v_sub_id
  );
end;$$;


ALTER FUNCTION "public"."setup_shop_for_new_user"("p_user_id" "uuid", "p_shop_name" "text", "p_plan_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."shop_access_state"("p_shop_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  sub record;
  now_ts timestamptz := now();
begin
  select *
  into sub
  from shop_subscriptions
  where shop_id = p_shop_id
    and is_current = true
  limit 1;

  if not found then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'no_subscription'
    );
  end if;

  -- trial expired
  if sub.status = 'trialing'
     and sub.trial_ends_at is not null
     and sub.trial_ends_at < now_ts then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'trial_expired'
    );
  end if;

  -- blocked states
  if sub.status in ('pending_payment','incomplete','past_due','unpaid','canceled') then
    return jsonb_build_object(
      'allowed', false,
      'reason', sub.status
    );
  end if;

  -- allowed
  return jsonb_build_object(
    'allowed', true,
    'reason', 'ok'
  );
end;
$$;


ALTER FUNCTION "public"."shop_access_state"("p_shop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_invoice_items_after_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform allocate_fifo_for_item(NEW.id);
  return NEW;
end;
$$;


ALTER FUNCTION "public"."trg_invoice_items_after_insert"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."inventory" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity_change" numeric NOT NULL,
    "reason" "text" NOT NULL,
    "invoice_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "vendor_price" numeric,
    CONSTRAINT "inventory_reason_check" CHECK (("reason" = ANY (ARRAY['vendor_invoice'::"text", 'client_invoice'::"text", 'manual_adjustment'::"text"])))
);

ALTER TABLE ONLY "public"."inventory" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_item_cogs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_item_id" bigint NOT NULL,
    "product_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "qty" numeric NOT NULL,
    "unit_cost" numeric NOT NULL,
    "total_cost" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invoice_item_cogs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" bigint NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "product_id" "uuid",
    "service_id" "uuid",
    "description" "text",
    "quantity" numeric(12,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "line_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "discount" numeric DEFAULT '0'::numeric NOT NULL,
    CONSTRAINT "invoice_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['product'::"text", 'service'::"text", 'manual'::"text"])))
);

ALTER TABLE ONLY "public"."invoice_items" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."invoice_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."invoice_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."invoice_items_id_seq" OWNED BY "public"."invoice_items"."id";



CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "customer_name" "text",
    "kind" "text" DEFAULT 'product'::"text",
    "total" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "extra_discount" numeric DEFAULT '0'::numeric NOT NULL,
    "discount" numeric DEFAULT '0'::numeric NOT NULL,
    "invoice_source" "text" DEFAULT 'client'::"text" NOT NULL,
    CONSTRAINT "invoices_invoice_source_check" CHECK (("invoice_source" = ANY (ARRAY['client'::"text", 'vendor'::"text"]))),
    CONSTRAINT "invoices_kind_check" CHECK (("kind" = ANY (ARRAY['product'::"text", 'service'::"text", 'mixed'::"text"])))
);

ALTER TABLE ONLY "public"."invoices" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modules" (
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_modules" (
    "id" bigint NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "module_key" "text" NOT NULL
);


ALTER TABLE "public"."plan_modules" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."plan_modules_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."plan_modules_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."plan_modules_id_seq" OWNED BY "public"."plan_modules"."id";



CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price_monthly" numeric NOT NULL,
    "currency" "text" DEFAULT '''EGP''::text'::"text" NOT NULL,
    "trial_days" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "stripe_price_id" "text",
    "soon" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text",
    "price" numeric(12,2) DEFAULT 0 NOT NULL,
    "stock" integer DEFAULT 0 NOT NULL,
    "low_stock_threshold" integer DEFAULT 5,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "discount" numeric DEFAULT '0'::numeric NOT NULL,
    "vendor_price" numeric DEFAULT '0'::numeric NOT NULL,
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."products" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "discount" numeric DEFAULT '0'::numeric
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_members" (
    "shop_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'employee'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "full_name" "text",
    "email" "text"
);


ALTER TABLE "public"."shop_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "module_key" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "plan" "text",
    "starts_at" timestamp with time zone DEFAULT "now"(),
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shop_modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'trialing'::"text" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_current" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."shop_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shops" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'generic'::"text",
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shops_type_check" CHECK (("type" = ANY (ARRAY['electricity'::"text", 'barbershop'::"text", 'generic'::"text"])))
);


ALTER TABLE "public"."shops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category" "text" DEFAULT 'general'::"text",
    "employee_id" "uuid",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "store_entries_kind_check" CHECK (("kind" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."store_entries" OWNER TO "postgres";


ALTER TABLE ONLY "public"."invoice_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."invoice_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."plan_modules" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."plan_modules_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_item_cogs"
    ADD CONSTRAINT "invoice_item_cogs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."plan_modules"
    ADD CONSTRAINT "plan_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_modules"
    ADD CONSTRAINT "plan_modules_plan_id_module_key_key" UNIQUE ("plan_id", "module_key");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_members"
    ADD CONSTRAINT "shop_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_members"
    ADD CONSTRAINT "shop_members_shop_id_user_id_key" UNIQUE ("shop_id", "user_id");



ALTER TABLE ONLY "public"."shop_members"
    ADD CONSTRAINT "shop_members_unique_per_shop" UNIQUE ("shop_id", "user_id");



ALTER TABLE ONLY "public"."shop_modules"
    ADD CONSTRAINT "shop_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_modules"
    ADD CONSTRAINT "shop_modules_unique" UNIQUE ("shop_id", "module_key");



ALTER TABLE ONLY "public"."shop_subscriptions"
    ADD CONSTRAINT "shop_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_entries"
    ADD CONSTRAINT "store_entries_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_shop_subscriptions_shop_id" ON "public"."shop_subscriptions" USING "btree" ("shop_id");



CREATE INDEX "inventory_product_id_idx" ON "public"."inventory" USING "btree" ("product_id");



CREATE INDEX "inventory_shop_id_idx" ON "public"."inventory" USING "btree" ("shop_id");



CREATE INDEX "invoice_items_invoice_id_idx" ON "public"."invoice_items" USING "btree" ("invoice_id");



CREATE INDEX "invoice_items_product_id_idx" ON "public"."invoice_items" USING "btree" ("product_id");



CREATE INDEX "invoices_invoice_source_idx" ON "public"."invoices" USING "btree" ("invoice_source");



CREATE INDEX "invoices_shop_id_idx" ON "public"."invoices" USING "btree" ("shop_id");



CREATE UNIQUE INDEX "shop_subscriptions_one_current" ON "public"."shop_subscriptions" USING "btree" ("shop_id") WHERE ("is_current" = true);



CREATE OR REPLACE TRIGGER "invoice_items_after_insert_fifo" AFTER INSERT ON "public"."invoice_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_invoice_items_after_insert"();



CREATE OR REPLACE TRIGGER "trg_invoice_item" AFTER INSERT ON "public"."invoice_items" FOR EACH ROW EXECUTE FUNCTION "public"."handle_invoice_item"();



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_item_cogs"
    ADD CONSTRAINT "invoice_item_cogs_invoice_item_id_fkey" FOREIGN KEY ("invoice_item_id") REFERENCES "public"."invoice_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_modules"
    ADD CONSTRAINT "plan_modules_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "public"."modules"("key");



ALTER TABLE ONLY "public"."plan_modules"
    ADD CONSTRAINT "plan_modules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_members"
    ADD CONSTRAINT "shop_members_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_members"
    ADD CONSTRAINT "shop_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_modules"
    ADD CONSTRAINT "shop_modules_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "public"."modules"("key") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_modules"
    ADD CONSTRAINT "shop_modules_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_subscriptions"
    ADD CONSTRAINT "shop_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."shop_subscriptions"
    ADD CONSTRAINT "shop_subscriptions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_entries"
    ADD CONSTRAINT "store_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."store_entries"
    ADD CONSTRAINT "store_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."shop_members"("id");



ALTER TABLE ONLY "public"."store_entries"
    ADD CONSTRAINT "store_entries_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



CREATE POLICY "Shop members can insert inventory" ON "public"."inventory" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."shop_members" "sm"
  WHERE (("sm"."user_id" = "auth"."uid"()) AND ("sm"."shop_id" = "inventory"."shop_id") AND ("sm"."deleted_at" IS NULL)))));



CREATE POLICY "Shop members can read inventory" ON "public"."inventory" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."shop_members" "sm"
  WHERE (("sm"."user_id" = "auth"."uid"()) AND ("sm"."shop_id" = "inventory"."shop_id") AND ("sm"."deleted_at" IS NULL)))));



CREATE POLICY "entries_shop_members_insert" ON "public"."store_entries" FOR INSERT WITH CHECK ("public"."is_shop_member"("shop_id"));



CREATE POLICY "entries_shop_members_select" ON "public"."store_entries" FOR SELECT USING ("public"."is_shop_member"("shop_id"));



ALTER TABLE "public"."inventory" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_insert" ON "public"."inventory" FOR INSERT WITH CHECK (("public"."is_shop_member"("auth"."uid"(), "shop_id") AND "public"."DELETE_shop_has_module"("shop_id", 'inventory'::"text")));



CREATE POLICY "inventory_select" ON "public"."inventory" FOR SELECT USING (("public"."is_shop_member"("auth"."uid"(), "shop_id") AND "public"."DELETE_shop_has_module"("shop_id", 'inventory'::"text")));



ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_items_insert" ON "public"."invoice_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."invoices" "inv"
  WHERE (("inv"."id" = "invoice_items"."invoice_id") AND "public"."is_shop_member"("auth"."uid"(), "inv"."shop_id") AND (("inv"."invoice_source" = 'client'::"text") OR "public"."DELETE_shop_has_module"("inv"."shop_id", 'inventory'::"text"))))));



CREATE POLICY "invoice_items_select" ON "public"."invoice_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "inv"
  WHERE (("inv"."id" = "invoice_items"."invoice_id") AND "public"."is_shop_member"("auth"."uid"(), "inv"."shop_id") AND (("inv"."invoice_source" = 'client'::"text") OR "public"."DELETE_shop_has_module"("inv"."shop_id", 'inventory'::"text"))))));



CREATE POLICY "invoice_items_update" ON "public"."invoice_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_items"."invoice_id") AND "public"."is_shop_member"("i"."shop_id")))));



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_insert" ON "public"."invoices" FOR INSERT WITH CHECK ("public"."is_shop_member"("shop_id"));



CREATE POLICY "invoices_select" ON "public"."invoices" FOR SELECT USING ("public"."is_shop_member"("shop_id"));



CREATE POLICY "invoices_update" ON "public"."invoices" FOR UPDATE USING ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members can view their shop subscription" ON "public"."shop_subscriptions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."shop_members" "sm"
  WHERE (("sm"."shop_id" = "shop_subscriptions"."shop_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."deleted_at" IS NULL)))));



CREATE POLICY "members_insert_owner_only" ON "public"."shop_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."shops" "s"
  WHERE (("s"."id" = "shop_members"."shop_id") AND ("s"."owner_id" = "auth"."uid"())))));



CREATE POLICY "members_select_members_only" ON "public"."shop_members" FOR SELECT USING ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members_update_owner_only" ON "public"."shop_members" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."shops" "s"
  WHERE (("s"."id" = "shop_members"."shop_id") AND ("s"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."plan_modules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_modules_public_select" ON "public"."plan_modules" FOR SELECT USING (true);



ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plans_public_select" ON "public"."plans" FOR SELECT USING (true);



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_insert" ON "public"."products" FOR INSERT WITH CHECK (("public"."is_shop_member"("auth"."uid"(), "shop_id") AND "public"."DELETE_shop_has_module"("shop_id", 'inventory'::"text")));



CREATE POLICY "products_select" ON "public"."products" FOR SELECT USING (("public"."is_shop_member"("auth"."uid"(), "shop_id") AND "public"."DELETE_shop_has_module"("shop_id", 'inventory'::"text")));



CREATE POLICY "products_update" ON "public"."products" FOR UPDATE USING ("public"."DELETE_shop_has_module"("shop_id", 'inventory'::"text")) WITH CHECK ("public"."DELETE_shop_has_module"("shop_id", 'inventory'::"text"));



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_insert" ON "public"."services" FOR INSERT WITH CHECK ("public"."is_shop_member"("shop_id"));



CREATE POLICY "services_select" ON "public"."services" FOR SELECT USING ("public"."is_shop_member"("shop_id"));



CREATE POLICY "services_update" ON "public"."services" FOR UPDATE USING ("public"."is_shop_member"("shop_id"));



ALTER TABLE "public"."shop_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shop_subscriptions_select" ON "public"."shop_subscriptions" FOR SELECT USING ("public"."is_shop_member"("auth"."uid"(), "shop_id"));



ALTER TABLE "public"."shops" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shops_insert_owner_only" ON "public"."shops" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "shops_select_members_only" ON "public"."shops" FOR SELECT USING (("public"."is_shop_member"("id") OR ("owner_id" = "auth"."uid"())));



CREATE POLICY "shops_update_owner_only" ON "public"."shops" FOR UPDATE USING (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."store_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_entries_insert" ON "public"."store_entries" FOR INSERT WITH CHECK ("public"."is_shop_member"("auth"."uid"(), "shop_id"));



CREATE POLICY "store_entries_owner_delete" ON "public"."store_entries" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."shop_members" "sm"
  WHERE (("sm"."shop_id" = "store_entries"."shop_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."role" = 'owner'::"text") AND ("sm"."deleted_at" IS NULL)))));



CREATE POLICY "store_entries_owner_update" ON "public"."store_entries" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."shop_members" "sm"
  WHERE (("sm"."shop_id" = "store_entries"."shop_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."role" = 'owner'::"text") AND ("sm"."deleted_at" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."shop_members" "sm"
  WHERE (("sm"."shop_id" = "store_entries"."shop_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."role" = 'owner'::"text") AND ("sm"."deleted_at" IS NULL)))));



CREATE POLICY "store_entries_select" ON "public"."store_entries" FOR SELECT USING ("public"."is_shop_member"("auth"."uid"(), "shop_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."DELETE_get_shop_role"("shop" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."DELETE_get_shop_role"("shop" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."DELETE_get_shop_role"("shop" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."DELETE_shop_has_module"("p_shop_id" "uuid", "p_module_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."DELETE_shop_has_module"("p_shop_id" "uuid", "p_module_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."DELETE_shop_has_module"("p_shop_id" "uuid", "p_module_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_expense"("p_shop_id" "uuid", "p_amount" numeric, "p_category" "text", "p_note" "text", "p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_expense"("p_shop_id" "uuid", "p_amount" numeric, "p_category" "text", "p_note" "text", "p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_expense"("p_shop_id" "uuid", "p_amount" numeric, "p_category" "text", "p_note" "text", "p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_store_entry"("p_shop_id" "uuid", "p_kind" "text", "p_amount" numeric, "p_category" "text", "p_note" "text", "p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_store_entry"("p_shop_id" "uuid", "p_kind" "text", "p_amount" numeric, "p_category" "text", "p_note" "text", "p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_store_entry"("p_shop_id" "uuid", "p_kind" "text", "p_amount" numeric, "p_category" "text", "p_note" "text", "p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."allocate_fifo_for_item"("p_invoice_item_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."allocate_fifo_for_item"("p_invoice_item_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."allocate_fifo_for_item"("p_invoice_item_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_plan_modules_to_shop"("p_shop_id" "uuid", "p_plan_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_plan_modules_to_shop"("p_shop_id" "uuid", "p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_plan_modules_to_shop"("p_shop_id" "uuid", "p_plan_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."dashboard_metrics"("p_shop" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_metrics"("p_shop" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_metrics"("p_shop" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fifo_cogs"("product" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fifo_cogs"("product" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fifo_cogs"("product" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fifo_cogs_for_invoice"("inv" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fifo_cogs_for_invoice"("inv" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fifo_cogs_for_invoice"("inv" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fifo_profit"("invoice" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fifo_profit"("invoice" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fifo_profit"("invoice" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_invoice_item"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_invoice_item"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_invoice_item"() TO "service_role";



GRANT ALL ON FUNCTION "public"."invoice_cogs"("p_invoice" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."invoice_cogs"("p_invoice" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoice_cogs"("p_invoice" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."invoice_revenue"("invoice" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."invoice_revenue"("invoice" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoice_revenue"("invoice" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_shop_member"("shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_shop_member"("shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_shop_member"("shop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_shop_member"("p_user" "uuid", "p_shop" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_shop_member"("p_user" "uuid", "p_shop" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_shop_member"("p_user" "uuid", "p_shop" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_shop_owner"("target_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_shop_owner"("target_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_shop_owner"("target_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."setup_shop_for_new_user"("p_user_id" "uuid", "p_shop_name" "text", "p_plan_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."setup_shop_for_new_user"("p_user_id" "uuid", "p_shop_name" "text", "p_plan_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."setup_shop_for_new_user"("p_user_id" "uuid", "p_shop_name" "text", "p_plan_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."shop_access_state"("p_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."shop_access_state"("p_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."shop_access_state"("p_shop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_invoice_items_after_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_invoice_items_after_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_invoice_items_after_insert"() TO "service_role";


















GRANT ALL ON TABLE "public"."inventory" TO "anon";
GRANT ALL ON TABLE "public"."inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_item_cogs" TO "anon";
GRANT ALL ON TABLE "public"."invoice_item_cogs" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_item_cogs" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invoice_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invoice_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invoice_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."modules" TO "anon";
GRANT ALL ON TABLE "public"."modules" TO "authenticated";
GRANT ALL ON TABLE "public"."modules" TO "service_role";



GRANT ALL ON TABLE "public"."plan_modules" TO "anon";
GRANT ALL ON TABLE "public"."plan_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_modules" TO "service_role";



GRANT ALL ON SEQUENCE "public"."plan_modules_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."plan_modules_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."plan_modules_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."shop_members" TO "anon";
GRANT ALL ON TABLE "public"."shop_members" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_members" TO "service_role";



GRANT ALL ON TABLE "public"."shop_modules" TO "anon";
GRANT ALL ON TABLE "public"."shop_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_modules" TO "service_role";



GRANT ALL ON TABLE "public"."shop_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."shop_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."shops" TO "anon";
GRANT ALL ON TABLE "public"."shops" TO "authenticated";
GRANT ALL ON TABLE "public"."shops" TO "service_role";



GRANT ALL ON TABLE "public"."store_entries" TO "anon";
GRANT ALL ON TABLE "public"."store_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."store_entries" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


  create policy "blocked users cannot log in"
  on "auth"."users"
  as permissive
  for select
  to public
using ((deleted_at IS NULL));



