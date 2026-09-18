-- Shop Suit rebuild alignment (2026-09-09)
--
-- Categories per docs/rebuild/database-contract.md:
--   B. Compatibility fix : plans table alignment with current app contract; portals + profiles tables
--   C. Security fix      : products_update member check; shop_modules RLS; search_path on definer fns
--   Perf                 : three targeted indexes for dashboard/FIFO hot paths
--
-- All statements are idempotent (safe to run against an already-aligned database).
-- Historical columns (plans.price_monthly, plans.soon) are kept for compatibility.

------------------------------------------------------------------
-- 1) B: plans alignment with the application contract
------------------------------------------------------------------

-- The application (server/api/billing/plans.get.ts + api-layer types) expects:
-- price_amount, currency, billing_interval, trial_days, features (jsonb),
-- sort_order, is_active, is_public, is_coming_soon, stripe_product_id, stripe_mode.

ALTER TABLE public.plans ALTER COLUMN currency SET DEFAULT 'EGP';

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_amount numeric;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'monthly';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{"employees": false, "invoices": false, "expenses": false, "dashboard": false, "reports": false, "inventory": false}'::jsonb;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_coming_soon boolean;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS stripe_product_id text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS stripe_mode text;

-- Backfill from historical columns.
UPDATE public.plans SET price_amount = price_monthly WHERE price_amount IS NULL;
UPDATE public.plans SET is_coming_soon = soon WHERE is_coming_soon IS NULL;

ALTER TABLE public.plans ALTER COLUMN price_amount SET DEFAULT 0;
ALTER TABLE public.plans ALTER COLUMN price_amount SET NOT NULL;
ALTER TABLE public.plans ALTER COLUMN is_coming_soon SET DEFAULT false;
ALTER TABLE public.plans ALTER COLUMN is_coming_soon SET NOT NULL;

-- New rows must satisfy the app contract; NOT VALID keeps history loadable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'plans_billing_interval_check' AND conrelid = 'public.plans'::regclass
  ) THEN
    ALTER TABLE public.plans
      ADD CONSTRAINT plans_billing_interval_check CHECK (billing_interval IN ('monthly', 'yearly')) NOT VALID;
  END IF;
END $$;

------------------------------------------------------------------
-- 2) B: portals + profiles (required by auth BFF endpoints)
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.portals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  is_original boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  portal_id uuid NOT NULL REFERENCES public.portals (id) ON DELETE CASCADE,
  display_name text,
  email_snapshot text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, portal_id)
);

CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles (user_id);

ALTER TABLE public.portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Portal catalog is public (matches plans_public_select semantics); writes are service-only.
DROP POLICY IF EXISTS portals_select_public ON public.portals;
CREATE POLICY portals_select_public ON public.portals FOR SELECT USING (true);

-- Profiles: users read/update their own rows; inserts happen server-side (service key).
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Shared updated_at trigger for the new tables.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  new.updated_at := now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS portals_set_updated_at ON public.portals;
CREATE TRIGGER portals_set_updated_at BEFORE UPDATE ON public.portals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

------------------------------------------------------------------
-- 3) C: RLS security fixes
------------------------------------------------------------------

-- 3a. products_update allowed ANY authenticated user (module check only, no membership).
--     Restore the member requirement to match products_insert/products_select.
DROP POLICY IF EXISTS products_update ON public.products;
CREATE POLICY products_update ON public.products FOR UPDATE
  USING (
    public.is_shop_member(auth.uid(), shop_id)
    AND public."DELETE_shop_has_module"(shop_id, 'inventory')
  )
  WITH CHECK (
    public.is_shop_member(auth.uid(), shop_id)
    AND public."DELETE_shop_has_module"(shop_id, 'inventory')
  );

-- 3b. shop_modules had RLS disabled: any authenticated user could read every shop's
--     module grants. Enable RLS with member-read (writes stay service/definer-only).
ALTER TABLE public.shop_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_modules_select ON public.shop_modules;
CREATE POLICY shop_modules_select ON public.shop_modules FOR SELECT
  USING (public.is_shop_member(auth.uid(), shop_id));

------------------------------------------------------------------
-- 4) C: safe search_path on SECURITY DEFINER functions
-- `public` keeps unqualified references working while excluding pg_temp shadowing.
------------------------------------------------------------------

ALTER FUNCTION public."DELETE_shop_has_module"(uuid, text) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.is_shop_member(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.handle_invoice_item() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.setup_shop_for_new_user(uuid, text, text) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.shop_access_state(uuid) SECURITY DEFINER SET search_path = public;

------------------------------------------------------------------
-- 5) Perf: indexes matching measured query patterns
------------------------------------------------------------------

-- dashboard_metrics: invoices per shop/source over time.
CREATE INDEX IF NOT EXISTS invoices_shop_source_created_idx
  ON public.invoices (shop_id, invoice_source, created_at DESC);

-- dashboard_metrics: store_entries per shop/kind.
CREATE INDEX IF NOT EXISTS store_entries_shop_kind_idx
  ON public.store_entries (shop_id, kind);

-- FIFO allocation: vendor batches per product in chronological order.
CREATE INDEX IF NOT EXISTS inventory_product_reason_created_idx
  ON public.inventory (product_id, reason, created_at);

------------------------------------------------------------------
-- 6) B: structural seed data (portal, modules, plans)
--    Idempotent upserts so clean resets and db push both converge.
------------------------------------------------------------------

INSERT INTO public.portals (key, name, is_original, is_active)
VALUES
  ('shop-crm', 'Shop CRM', true, true),
  ('shop_suit', 'Shop Suit', false, true)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active;

INSERT INTO public.modules (key, name, description)
VALUES
  ('inventory', 'Inventory', 'Products, stock tracking and FIFO cost tracking')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.plans (
  key, name, description, price_amount, price_monthly, currency, billing_interval,
  trial_days, is_active, is_public, is_coming_soon, sort_order, features
)
VALUES
  (
    'basic', 'Basic', 'Essentials to run your shop',
    800, 800, 'EGP', 'monthly', 30, true, true, false, 1,
    '{"employees": true, "invoices": true, "expenses": true, "dashboard": true, "reports": true, "inventory": false}'::jsonb
  ),
  (
    'pro', 'Pro', 'Everything in Basic plus inventory',
    1200, 1200, 'EGP', 'monthly', 30, true, true, false, 2,
    '{"employees": true, "invoices": true, "expenses": true, "dashboard": true, "reports": true, "inventory": true}'::jsonb
  )
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_amount = EXCLUDED.price_amount,
    price_monthly = EXCLUDED.price_monthly,
    currency = EXCLUDED.currency,
    billing_interval = EXCLUDED.billing_interval,
    trial_days = EXCLUDED.trial_days,
    is_active = EXCLUDED.is_active,
    is_public = EXCLUDED.is_public,
    is_coming_soon = EXCLUDED.is_coming_soon,
    sort_order = EXCLUDED.sort_order,
    features = EXCLUDED.features;

-- Only the Pro plan includes the inventory module.
INSERT INTO public.plan_modules (plan_id, module_key)
SELECT p.id, 'inventory' FROM public.plans p
WHERE p.key = 'pro'
ON CONFLICT (plan_id, module_key) DO NOTHING;
