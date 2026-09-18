-- Shop Suit: direct Supabase auth/profile bridge
-- Purpose:
--   - New Nuxt pages authenticate directly with Supabase.
--   - A SECURITY DEFINER trigger creates the Shop Suit profile automatically.
--   - Browser code never needs a service-role key and never inserts profiles directly.

CREATE OR REPLACE FUNCTION public.handle_new_shop_suit_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portal_key text;
  v_portal_id uuid;
  v_display_name text;
BEGIN
  v_portal_key := COALESCE(
    NULLIF(new.raw_user_meta_data ->> 'portal_key', ''),
    'shop_suit'
  );

  SELECT id
  INTO v_portal_id
  FROM public.portals
  WHERE key = v_portal_key
    AND is_active = true
  LIMIT 1;

  -- Auth must not fail just because an unrelated/unknown portal key was sent.
  -- Shop Suit itself always sends shop_suit.
  IF v_portal_id IS NULL THEN
    RETURN new;
  END IF;

  v_display_name := COALESCE(
    NULLIF(new.raw_user_meta_data ->> 'display_name', ''),
    NULLIF(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(COALESCE(new.email, ''), '@', 1)
  );

  INSERT INTO public.profiles (
    user_id,
    portal_id,
    display_name,
    email_snapshot,
    status
  )
  VALUES (
    new.id,
    v_portal_id,
    v_display_name,
    new.email,
    'active'
  )
  ON CONFLICT (user_id, portal_id)
  DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    email_snapshot = COALESCE(EXCLUDED.email_snapshot, public.profiles.email_snapshot),
    updated_at = now();

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_shop_suit ON auth.users;

CREATE TRIGGER on_auth_user_created_shop_suit
AFTER INSERT OR UPDATE OF email, raw_user_meta_data
ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_shop_suit_user();

-- Backfill existing auth users into the Shop Suit portal when they do not
-- already have a Shop Suit profile.
INSERT INTO public.profiles (
  user_id,
  portal_id,
  display_name,
  email_snapshot,
  status
)
SELECT
  u.id,
  p.id,
  COALESCE(
    NULLIF(u.raw_user_meta_data ->> 'display_name', ''),
    NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
    split_part(COALESCE(u.email, ''), '@', 1)
  ),
  u.email,
  'active'
FROM auth.users u
JOIN public.portals p
  ON p.key = 'shop_suit'
 AND p.is_active = true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.profiles pr
  WHERE pr.user_id = u.id
    AND pr.portal_id = p.id
)
ON CONFLICT (user_id, portal_id) DO NOTHING;
