-- Shop Suit Batch 05
-- Inventory adjustments + store-entry mutation contracts.
--
-- Key design:
-- * products.stock is never edited directly by the browser.
-- * positive manual adjustments become FIFO cost-bearing batches.
-- * negative manual adjustments consume FIFO batches and are recorded in
--   inventory_adjustment_cogs, so later sales do not reuse written-off stock.
-- * store-entry writes enforce subscription state and preserve the original
--   "members create, owners edit/archive" permission model.

---------------------------------------------------------------------------
-- 1. Inventory adjustment metadata + FIFO consumption table
---------------------------------------------------------------------------

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS note text;

CREATE TABLE IF NOT EXISTS public.inventory_adjustment_cogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  adjustment_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE RESTRICT,
  qty numeric(12,2) NOT NULL CHECK (qty > 0),
  unit_cost numeric NOT NULL CHECK (unit_cost >= 0),
  total_cost numeric NOT NULL CHECK (total_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (adjustment_id, batch_id)
);

CREATE INDEX IF NOT EXISTS inventory_adjustment_cogs_batch_idx
  ON public.inventory_adjustment_cogs(batch_id);

CREATE INDEX IF NOT EXISTS inventory_adjustment_cogs_product_idx
  ON public.inventory_adjustment_cogs(product_id);

ALTER TABLE public.inventory_adjustment_cogs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE public.inventory_adjustment_cogs TO authenticated;
GRANT ALL ON TABLE public.inventory_adjustment_cogs TO service_role;

DROP POLICY IF EXISTS inventory_adjustment_cogs_select
  ON public.inventory_adjustment_cogs;
CREATE POLICY inventory_adjustment_cogs_select
  ON public.inventory_adjustment_cogs
  FOR SELECT TO authenticated
  USING (
    public.is_shop_member(auth.uid(), shop_id)
    AND public."DELETE_shop_has_module"(shop_id, 'inventory')
  );

DROP POLICY IF EXISTS inventory_adjustment_cogs_insert
  ON public.inventory_adjustment_cogs;
CREATE POLICY inventory_adjustment_cogs_insert
  ON public.inventory_adjustment_cogs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_shop_member(auth.uid(), shop_id)
    AND public."DELETE_shop_has_module"(shop_id, 'inventory')
  );

---------------------------------------------------------------------------
-- 2. Make invoice FIFO aware of positive/negative manual adjustments
---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.allocate_fifo_for_item(
  p_invoice_item_id bigint
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_remaining numeric;
  v_batch record;
  v_sale_allocated numeric;
  v_adjustment_allocated numeric;
  v_available numeric;
  v_to_use numeric;
BEGIN
  SELECT
    ii.*,
    inv.shop_id,
    inv.created_at AS invoice_created_at
  INTO v_item
  FROM public.invoice_items ii
  JOIN public.invoices inv ON inv.id = ii.invoice_id
  WHERE ii.id = p_invoice_item_id
    AND inv.invoice_source = 'client';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_item.item_type <> 'product' OR v_item.product_id IS NULL THEN
    RETURN;
  END IF;

  v_remaining := v_item.quantity;

  -- Eligible FIFO batches:
  --   1) vendor purchases
  --   2) positive manual adjustments carrying an explicit unit cost
  FOR v_batch IN
    SELECT
      i.id,
      i.quantity_change,
      COALESCE(i.vendor_price, 0) AS vendor_price,
      i.created_at
    FROM public.inventory i
    WHERE i.product_id = v_item.product_id
      AND i.shop_id = v_item.shop_id
      AND i.quantity_change > 0
      AND (
        i.reason = 'vendor_invoice'
        OR i.reason = 'manual_adjustment'
      )
      AND i.created_at <= v_item.invoice_created_at
    ORDER BY i.created_at ASC, i.id ASC
  LOOP
    EXIT WHEN v_remaining <= 0;

    SELECT COALESCE(SUM(c.qty), 0)
    INTO v_sale_allocated
    FROM public.invoice_item_cogs c
    WHERE c.batch_id = v_batch.id;

    SELECT COALESCE(SUM(c.qty), 0)
    INTO v_adjustment_allocated
    FROM public.inventory_adjustment_cogs c
    WHERE c.batch_id = v_batch.id;

    v_available :=
      v_batch.quantity_change
      - v_sale_allocated
      - v_adjustment_allocated;

    IF v_available <= 0 THEN
      CONTINUE;
    END IF;

    v_to_use := LEAST(v_available, v_remaining);

    INSERT INTO public.invoice_item_cogs (
      invoice_item_id,
      product_id,
      batch_id,
      qty,
      unit_cost,
      total_cost
    )
    VALUES (
      v_item.id,
      v_item.product_id,
      v_batch.id,
      v_to_use,
      v_batch.vendor_price,
      v_to_use * v_batch.vendor_price
    );

    v_remaining := v_remaining - v_to_use;
  END LOOP;

  -- Preserve compatibility with historical pre-rebuild rows that may have
  -- stock without a complete cost-batch history. New Batch 05 adjustments are
  -- fully allocated; old inconsistencies are warned about rather than making
  -- every future sale impossible.
  IF v_remaining > 0 THEN
    RAISE WARNING 'FIFO_SOURCE_INSUFFICIENT:%', v_remaining;
  END IF;
END;
$$;

---------------------------------------------------------------------------
-- 3. Atomic manual stock adjustment
---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.adjust_shop_stock(
  p_shop_id uuid,
  p_product_id uuid,
  p_quantity_change integer,
  p_unit_cost numeric DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_record_cost_as_expense boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_access jsonb;
  v_member_id uuid;
  v_current_stock integer;
  v_adjustment_id uuid;
  v_remaining numeric;
  v_batch record;
  v_sale_allocated numeric;
  v_adjustment_allocated numeric;
  v_available numeric;
  v_to_use numeric;
  v_adjustment_cost numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT sm.id
  INTO v_member_id
  FROM public.shop_members sm
  WHERE sm.shop_id = p_shop_id
    AND sm.user_id = auth.uid()
    AND sm.deleted_at IS NULL
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'SHOP_MEMBERSHIP_REQUIRED';
  END IF;

  v_access := public.shop_access_state(p_shop_id);
  IF NOT COALESCE((v_access ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'SHOP_ACCESS_BLOCKED:%',
      COALESCE(v_access ->> 'reason', 'unknown');
  END IF;

  IF NOT public."DELETE_shop_has_module"(p_shop_id, 'inventory') THEN
    RAISE EXCEPTION 'INVENTORY_MODULE_REQUIRED';
  END IF;

  IF p_quantity_change IS NULL OR p_quantity_change = 0 THEN
    RAISE EXCEPTION 'ADJUSTMENT_QUANTITY_REQUIRED';
  END IF;

  p_note := NULLIF(btrim(COALESCE(p_note, '')), '');

  IF p_note IS NULL THEN
    RAISE EXCEPTION 'ADJUSTMENT_NOTE_REQUIRED';
  END IF;

  SELECT p.stock
  INTO v_current_stock
  FROM public.products p
  WHERE p.id = p_product_id
    AND p.shop_id = p_shop_id
    AND p.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
  END IF;

  IF (v_current_stock + p_quantity_change) < 0 THEN
    RAISE EXCEPTION 'ADJUSTMENT_EXCEEDS_STOCK:%', v_current_stock;
  END IF;

  IF p_quantity_change > 0 THEN
    IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
      RAISE EXCEPTION 'POSITIVE_ADJUSTMENT_COST_REQUIRED';
    END IF;
  ELSE
    -- Negative adjustments consume FIFO stock; no caller-supplied cost is used.
    p_unit_cost := NULL;
  END IF;

  INSERT INTO public.inventory (
    shop_id,
    product_id,
    quantity_change,
    reason,
    vendor_price,
    created_by,
    note
  )
  VALUES (
    p_shop_id,
    p_product_id,
    p_quantity_change,
    'manual_adjustment',
    p_unit_cost,
    v_member_id,
    p_note
  )
  RETURNING id INTO v_adjustment_id;

  -- For a negative adjustment, consume available positive batches FIFO.
  IF p_quantity_change < 0 THEN
    v_remaining := ABS(p_quantity_change);

    FOR v_batch IN
      SELECT
        i.id,
        i.quantity_change,
        COALESCE(i.vendor_price, 0) AS vendor_price
      FROM public.inventory i
      WHERE i.shop_id = p_shop_id
        AND i.product_id = p_product_id
        AND i.quantity_change > 0
        AND (
          i.reason = 'vendor_invoice'
          OR i.reason = 'manual_adjustment'
        )
        AND i.id <> v_adjustment_id
      ORDER BY i.created_at ASC, i.id ASC
    LOOP
      EXIT WHEN v_remaining <= 0;

      SELECT COALESCE(SUM(c.qty), 0)
      INTO v_sale_allocated
      FROM public.invoice_item_cogs c
      WHERE c.batch_id = v_batch.id;

      SELECT COALESCE(SUM(c.qty), 0)
      INTO v_adjustment_allocated
      FROM public.inventory_adjustment_cogs c
      WHERE c.batch_id = v_batch.id;

      v_available :=
        v_batch.quantity_change
        - v_sale_allocated
        - v_adjustment_allocated;

      IF v_available <= 0 THEN
        CONTINUE;
      END IF;

      v_to_use := LEAST(v_available, v_remaining);

      INSERT INTO public.inventory_adjustment_cogs (
        shop_id,
        adjustment_id,
        product_id,
        batch_id,
        qty,
        unit_cost,
        total_cost
      )
      VALUES (
        p_shop_id,
        v_adjustment_id,
        p_product_id,
        v_batch.id,
        v_to_use,
        v_batch.vendor_price,
        v_to_use * v_batch.vendor_price
      );

      v_adjustment_cost :=
        v_adjustment_cost + (v_to_use * v_batch.vendor_price);

      v_remaining := v_remaining - v_to_use;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'FIFO_SOURCE_INSUFFICIENT:%', v_remaining;
    END IF;
  END IF;

  UPDATE public.products
  SET stock = stock + p_quantity_change
  WHERE id = p_product_id
    AND shop_id = p_shop_id;

  -- Inventory shrinkage/damage is normally an operating expense. Keep this
  -- optional because some manual adjustments are opening-balance/data
  -- corrections rather than current-period losses.
  IF p_quantity_change < 0
     AND COALESCE(p_record_cost_as_expense, true)
     AND v_adjustment_cost > 0 THEN
    INSERT INTO public.store_entries (
      shop_id,
      kind,
      amount,
      category,
      note,
      created_by
    )
    VALUES (
      p_shop_id,
      'expense',
      v_adjustment_cost,
      'inventory_adjustment',
      p_note,
      v_member_id
    );
  END IF;

  RETURN v_adjustment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_shop_stock(
  uuid, uuid, integer, numeric, text, boolean
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.adjust_shop_stock(
  uuid, uuid, integer, numeric, text, boolean
) TO authenticated;

---------------------------------------------------------------------------
-- 4. Store-entry writes
---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_shop_store_entry(
  p_shop_id uuid,
  p_kind text,
  p_amount numeric,
  p_category text DEFAULT 'general',
  p_note text DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_access jsonb;
  v_member_id uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT sm.id
  INTO v_member_id
  FROM public.shop_members sm
  WHERE sm.shop_id = p_shop_id
    AND sm.user_id = auth.uid()
    AND sm.deleted_at IS NULL
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'SHOP_MEMBERSHIP_REQUIRED';
  END IF;

  v_access := public.shop_access_state(p_shop_id);
  IF NOT COALESCE((v_access ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'SHOP_ACCESS_BLOCKED:%',
      COALESCE(v_access ->> 'reason', 'unknown');
  END IF;

  IF p_kind NOT IN ('income', 'expense') THEN
    RAISE EXCEPTION 'INVALID_ENTRY_KIND';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'ENTRY_AMOUNT_MUST_BE_POSITIVE';
  END IF;

  p_category := COALESCE(NULLIF(btrim(COALESCE(p_category, '')), ''), 'general');
  p_note := NULLIF(btrim(COALESCE(p_note, '')), '');

  IF p_employee_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.shop_members sm
       WHERE sm.id = p_employee_id
         AND sm.shop_id = p_shop_id
         AND sm.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'EMPLOYEE_NOT_FOUND';
  END IF;

  INSERT INTO public.store_entries (
    shop_id,
    kind,
    amount,
    category,
    note,
    created_by,
    employee_id
  )
  VALUES (
    p_shop_id,
    p_kind,
    p_amount,
    p_category,
    p_note,
    v_member_id,
    p_employee_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_shop_store_entry(
  p_shop_id uuid,
  p_entry_id uuid,
  p_kind text,
  p_amount numeric,
  p_category text DEFAULT 'general',
  p_note text DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_access jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.shop_members sm
    WHERE sm.shop_id = p_shop_id
      AND sm.user_id = auth.uid()
      AND sm.role = 'owner'
      AND sm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SHOP_OWNER_REQUIRED';
  END IF;

  v_access := public.shop_access_state(p_shop_id);
  IF NOT COALESCE((v_access ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'SHOP_ACCESS_BLOCKED:%',
      COALESCE(v_access ->> 'reason', 'unknown');
  END IF;

  IF p_kind NOT IN ('income', 'expense') THEN
    RAISE EXCEPTION 'INVALID_ENTRY_KIND';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'ENTRY_AMOUNT_MUST_BE_POSITIVE';
  END IF;

  p_category := COALESCE(NULLIF(btrim(COALESCE(p_category, '')), ''), 'general');
  p_note := NULLIF(btrim(COALESCE(p_note, '')), '');

  IF p_employee_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.shop_members sm
       WHERE sm.id = p_employee_id
         AND sm.shop_id = p_shop_id
         AND sm.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'EMPLOYEE_NOT_FOUND';
  END IF;

  UPDATE public.store_entries
  SET kind = p_kind,
      amount = p_amount,
      category = p_category,
      note = p_note,
      employee_id = p_employee_id
  WHERE id = p_entry_id
    AND shop_id = p_shop_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STORE_ENTRY_NOT_FOUND';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_shop_store_entry(
  p_shop_id uuid,
  p_entry_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_access jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.shop_members sm
    WHERE sm.shop_id = p_shop_id
      AND sm.user_id = auth.uid()
      AND sm.role = 'owner'
      AND sm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SHOP_OWNER_REQUIRED';
  END IF;

  v_access := public.shop_access_state(p_shop_id);
  IF NOT COALESCE((v_access ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'SHOP_ACCESS_BLOCKED:%',
      COALESCE(v_access ->> 'reason', 'unknown');
  END IF;

  UPDATE public.store_entries
  SET deleted_at = now()
  WHERE id = p_entry_id
    AND shop_id = p_shop_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STORE_ENTRY_NOT_FOUND';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_shop_store_entry(
  uuid, text, numeric, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_shop_store_entry(
  uuid, text, numeric, text, text, uuid
) TO authenticated;

REVOKE ALL ON FUNCTION public.update_shop_store_entry(
  uuid, uuid, text, numeric, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_shop_store_entry(
  uuid, uuid, text, numeric, text, text, uuid
) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_shop_store_entry(
  uuid, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_shop_store_entry(
  uuid, uuid
) TO authenticated;
