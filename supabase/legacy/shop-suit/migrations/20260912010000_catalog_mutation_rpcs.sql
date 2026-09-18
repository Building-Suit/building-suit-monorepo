-- Shop Suit Batch 04
-- Product + service catalog mutation RPCs.
-- Reads stay direct table queries protected by RLS.
-- Writes use RPCs so subscription access is enforced server-side.

CREATE OR REPLACE FUNCTION public.upsert_shop_product(
  p_shop_id uuid,
  p_product_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_sku text DEFAULT NULL,
  p_price numeric DEFAULT 0,
  p_discount numeric DEFAULT 0,
  p_low_stock_threshold integer DEFAULT 5
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_access jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'SHOP_MEMBERSHIP_REQUIRED';
  END IF;

  v_access := public.shop_access_state(p_shop_id);
  IF NOT COALESCE((v_access ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'SHOP_ACCESS_BLOCKED:%', COALESCE(v_access ->> 'reason', 'unknown');
  END IF;

  IF NOT public."DELETE_shop_has_module"(p_shop_id, 'inventory') THEN
    RAISE EXCEPTION 'INVENTORY_MODULE_REQUIRED';
  END IF;

  p_name := NULLIF(btrim(COALESCE(p_name, '')), '');
  p_sku := NULLIF(btrim(COALESCE(p_sku, '')), '');
  IF p_name IS NULL THEN RAISE EXCEPTION 'PRODUCT_NAME_REQUIRED'; END IF;

  p_price := COALESCE(p_price, 0);
  p_discount := COALESCE(p_discount, 0);
  p_low_stock_threshold := COALESCE(p_low_stock_threshold, 5);

  IF p_price < 0 OR p_discount < 0 OR p_low_stock_threshold < 0 THEN
    RAISE EXCEPTION 'INVALID_PRODUCT_VALUE';
  END IF;
  IF p_discount > p_price THEN RAISE EXCEPTION 'PRODUCT_DISCOUNT_EXCEEDS_PRICE'; END IF;

  IF p_product_id IS NULL THEN
    INSERT INTO public.products (
      shop_id, name, sku, price, discount, stock, low_stock_threshold
    )
    VALUES (
      p_shop_id, p_name, p_sku, p_price, p_discount, 0, p_low_stock_threshold
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.products
    SET name = p_name,
        sku = p_sku,
        price = p_price,
        discount = p_discount,
        low_stock_threshold = p_low_stock_threshold
    WHERE id = p_product_id
      AND shop_id = p_shop_id
      AND deleted_at IS NULL
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_shop_product(
  p_shop_id uuid,
  p_product_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_access jsonb;
  v_stock numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'SHOP_MEMBERSHIP_REQUIRED';
  END IF;

  v_access := public.shop_access_state(p_shop_id);
  IF NOT COALESCE((v_access ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'SHOP_ACCESS_BLOCKED:%', COALESCE(v_access ->> 'reason', 'unknown');
  END IF;

  IF NOT public."DELETE_shop_has_module"(p_shop_id, 'inventory') THEN
    RAISE EXCEPTION 'INVENTORY_MODULE_REQUIRED';
  END IF;

  SELECT stock INTO v_stock
  FROM public.products
  WHERE id = p_product_id
    AND shop_id = p_shop_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
  IF COALESCE(v_stock, 0) <> 0 THEN RAISE EXCEPTION 'PRODUCT_HAS_STOCK'; END IF;

  UPDATE public.products
  SET deleted_at = now()
  WHERE id = p_product_id
    AND shop_id = p_shop_id
    AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_shop_service(
  p_shop_id uuid,
  p_service_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_price numeric DEFAULT 0,
  p_discount numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_access jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'SHOP_MEMBERSHIP_REQUIRED';
  END IF;

  v_access := public.shop_access_state(p_shop_id);
  IF NOT COALESCE((v_access ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'SHOP_ACCESS_BLOCKED:%', COALESCE(v_access ->> 'reason', 'unknown');
  END IF;

  p_name := NULLIF(btrim(COALESCE(p_name, '')), '');
  IF p_name IS NULL THEN RAISE EXCEPTION 'SERVICE_NAME_REQUIRED'; END IF;

  p_price := COALESCE(p_price, 0);
  p_discount := COALESCE(p_discount, 0);

  IF p_price < 0 OR p_discount < 0 THEN RAISE EXCEPTION 'INVALID_SERVICE_VALUE'; END IF;
  IF p_discount > p_price THEN RAISE EXCEPTION 'SERVICE_DISCOUNT_EXCEEDS_PRICE'; END IF;

  IF p_service_id IS NULL THEN
    INSERT INTO public.services (shop_id, name, price, discount)
    VALUES (p_shop_id, p_name, p_price, p_discount)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.services
    SET name = p_name, price = p_price, discount = p_discount
    WHERE id = p_service_id
      AND shop_id = p_shop_id
      AND deleted_at IS NULL
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN RAISE EXCEPTION 'SERVICE_NOT_FOUND'; END IF;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_shop_service(
  p_shop_id uuid,
  p_service_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_access jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'SHOP_MEMBERSHIP_REQUIRED';
  END IF;

  v_access := public.shop_access_state(p_shop_id);
  IF NOT COALESCE((v_access ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'SHOP_ACCESS_BLOCKED:%', COALESCE(v_access ->> 'reason', 'unknown');
  END IF;

  UPDATE public.services
  SET deleted_at = now()
  WHERE id = p_service_id
    AND shop_id = p_shop_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'SERVICE_NOT_FOUND'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_shop_product(uuid, uuid, text, text, numeric, numeric, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_shop_product(uuid, uuid, text, text, numeric, numeric, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_shop_product(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_shop_product(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_shop_service(uuid, uuid, text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_shop_service(uuid, uuid, text, numeric, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_shop_service(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_shop_service(uuid, uuid) TO authenticated;
