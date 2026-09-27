BEGIN;

INSERT INTO control.suits (
  slug,
  display_name,
  stack_key,
  app_path,
  status
)
VALUES
  (
    'ledger-suit',
    'Ledger Suit',
    'ledger-suit',
    'apps/ledger-suit',
    'active'
  ),
  (
    'shop-suit',
    'Shop Suit',
    'shop-suit',
    'apps/shop-suit',
    'active'
  ),
  (
    'inventory-suit',
    'Inventory Suit',
    'inventory-suit',
    'apps/inventory-suit',
    'active'
  )
ON CONFLICT (slug)
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  stack_key = EXCLUDED.stack_key,
  app_path = EXCLUDED.app_path;

COMMIT;
