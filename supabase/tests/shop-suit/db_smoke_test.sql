-- Shop Suit database smoke tests
-- Run: docker exec -i supabase_db_shop-suit psql -U postgres -d postgres < supabase/tests/db_smoke_test.sql
-- Exits non-zero on the first failed assertion.

\set ON_ERROR_STOP on

------------------------------------------------------------------ helpers
CREATE OR REPLACE FUNCTION public.__assert(condition boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT condition THEN
    RAISE EXCEPTION 'ASSERT FAILED: %', message;
  END IF;
END;
$$;

------------------------------------------------------------------ fixtures
INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@test.local', 'x', 'authenticated', 'authenticated', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', 'owner-b@test.local', 'x', 'authenticated', 'authenticated', now(), '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'email', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', now(), now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2', 'email', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', now(), now(), now())
ON CONFLICT (provider_id, provider) DO NOTHING;

SELECT public.setup_shop_for_new_user('00000000-0000-0000-0000-0000000000a1', 'Shop A', 'pro');
SELECT public.setup_shop_for_new_user('00000000-0000-0000-0000-0000000000a2', 'Shop B', 'basic');

-- Plan -> module application worked
SELECT public.__assert(
  EXISTS (SELECT 1 FROM shop_modules sm JOIN shops s ON s.id = sm.shop_id
          WHERE s.name = 'Shop A' AND sm.module_key = 'inventory'),
  'pro plan must grant the inventory module');
SELECT public.__assert(
  NOT EXISTS (SELECT 1 FROM shop_modules sm JOIN shops s ON s.id = sm.shop_id
              WHERE s.name = 'Shop B' AND sm.module_key = 'inventory'),
  'basic plan must not grant the inventory module');

------------------------------------------------------------------ 1) Tenant isolation + module gating
BEGIN;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
SELECT public.__assert(
  auth.uid() = '00000000-0000-0000-0000-0000000000a1'::uuid OR auth.uid() = '00000000-0000-0000-0000-0000000000a2'::uuid,
  'auth.uid() must resolve from request.jwt.claims');
SELECT public.__assert(
  auth.uid() = '00000000-0000-0000-0000-0000000000a2'::uuid,
  'auth.uid() must be user B');

-- user B (basic plan, inventory module disabled) sees no products at all
SELECT public.__assert((SELECT count(*) FROM products) = 0, 'user B must see no products');

-- and cannot insert products (module gating)
DO $$
DECLARE v_shop_b uuid := (SELECT id FROM shops WHERE name = 'Shop B');
BEGIN
  BEGIN
    INSERT INTO products (shop_id, name, price) VALUES (v_shop_b, 'nope', 1);
    RAISE EXCEPTION 'ASSERT FAILED: product insert must be blocked without inventory module';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected RLS rejection
  END;
END $$;

-- fixture: seed one product per shop as superuser (bypasses RLS)
SET LOCAL ROLE postgres;
INSERT INTO products (shop_id, name, price) VALUES ((SELECT id FROM shops WHERE name = 'Shop A'), 'prod-a1', 10);

SET LOCAL ROLE authenticated;
UPDATE products SET price = 999 WHERE name = 'prod-a1';
SELECT public.__assert(
  (SELECT count(*) FROM products) = 0,
  'user B must not see or update Shop A products (RLS tenant isolation)');

SET LOCAL ROLE postgres;
SELECT public.__assert(
  (SELECT price = 10 FROM products WHERE name = 'prod-a1'),
  'cross-tenant product update must be blocked by RLS');

------------------------------------------------------------------ 2) Invoices: product creation, stock, FIFO, dashboard
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
SELECT public.__assert(auth.uid() = '00000000-0000-0000-0000-0000000000a1'::uuid, 'must be user A');

-- Vendor invoice: buy 10 units @ 4 EGP
INSERT INTO invoices (shop_id, invoice_source, kind, total, created_by)
VALUES (
  (SELECT id FROM shops WHERE name = 'Shop A'), 'vendor', 'product', 40,
  (SELECT id FROM shop_members WHERE user_id = auth.uid() AND shop_id = (SELECT id FROM shops WHERE name = 'Shop A'))
);
INSERT INTO invoice_items (invoice_id, item_type, description, quantity, unit_price, line_total)
SELECT id, 'product', 'Widget', 10, 4, 40 FROM invoices
WHERE shop_id = (SELECT id FROM shops WHERE name = 'Shop A') AND invoice_source = 'vendor';

SELECT public.__assert(
  (SELECT stock = 10 AND vendor_price = 4 FROM products WHERE name = 'Widget'),
  'vendor invoice must create the product, set vendor price and stock in');

-- Client invoice: sell 4 units @ 10 EGP with extra_discount 6
INSERT INTO invoices (shop_id, invoice_source, kind, total, discount, extra_discount, created_by, customer_name)
VALUES (
  (SELECT id FROM shops WHERE name = 'Shop A'), 'client', 'product', 40, 0, 6,
  (SELECT id FROM shop_members WHERE user_id = auth.uid() AND shop_id = (SELECT id FROM shops WHERE name = 'Shop A')),
  'Test Customer'
);
INSERT INTO invoice_items (invoice_id, item_type, product_id, quantity, unit_price, line_total)
SELECT i.id, 'product', p.id, 4, 10, 40 FROM invoices i, products p
WHERE i.shop_id = (SELECT id FROM shops WHERE name = 'Shop A') AND i.invoice_source = 'client' AND p.name = 'Widget';

SELECT public.__assert(
  (SELECT stock = 6 FROM products WHERE name = 'Widget'),
  'client invoice must deduct stock');

SELECT public.__assert(
  (SELECT public.invoice_revenue((SELECT id FROM invoices WHERE invoice_source = 'client')) = 34),
  'invoice_revenue must subtract discounts proportionally (40 - 6 = 34)');

SELECT public.__assert(
  (SELECT public.invoice_cogs((SELECT id FROM invoices WHERE invoice_source = 'client')) = 16),
  'invoice_cogs must equal FIFO batch cost (4 units x 4 EGP = 16)');

-- Expenses and manual income
SELECT public.add_expense((SELECT id FROM shops WHERE name = 'Shop A'), 8, 'rent');
SELECT public.add_store_entry((SELECT id FROM shops WHERE name = 'Shop A'), 'income', 5, 'other');

SELECT public.__assert(
  (SELECT (dashboard_metrics->>'total_revenue')::numeric = 34
     AND (dashboard_metrics->>'total_cogs')::numeric = 16
     AND (dashboard_metrics->>'total_profit')::numeric = 18
     AND (dashboard_metrics->>'total_units_sold')::numeric = 4
     AND (dashboard_metrics->>'total_expenses')::numeric = 8
     AND (dashboard_metrics->>'total_manual_income')::numeric = 5
     AND (dashboard_metrics->>'net_profit')::numeric = 15
   FROM (SELECT public.dashboard_metrics((SELECT id FROM shops WHERE name = 'Shop A')) AS dashboard_metrics) m),
  'dashboard_metrics must aggregate revenue/cogs/profit/units/expenses/income/net exactly');

ROLLBACK;

------------------------------------------------------------------ 3) Subscription gating
SELECT public.__assert(
  (SELECT gating->>'allowed' = 'false' AND gating->>'reason' = 'pending_payment'
   FROM (SELECT public.shop_access_state((SELECT id FROM shops WHERE name = 'Shop A')) AS gating) g),
  'pending_payment subscription must block access with reason pending_payment');

-- trialing but expired trial must block with trial_expired
BEGIN;
SET LOCAL ROLE postgres;
UPDATE shop_subscriptions SET status = 'trialing', trial_ends_at = now() - interval '1 day'
WHERE shop_id = (SELECT id FROM shops WHERE name = 'Shop A') AND is_current;
SELECT public.__assert(
  (SELECT gating->>'allowed' = 'false' AND gating->>'reason' = 'trial_expired'
   FROM (SELECT public.shop_access_state((SELECT id FROM shops WHERE name = 'Shop A')) AS gating) g),
  'expired trial must block access with reason trial_expired');
ROLLBACK;

------------------------------------------------------------------ cleanup
DROP FUNCTION IF EXISTS public.__assert(boolean, text);
SELECT 'DB SMOKE TESTS PASSED' AS result;
