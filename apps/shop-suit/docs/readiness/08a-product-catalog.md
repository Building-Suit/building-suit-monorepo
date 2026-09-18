# Task 08a — Owner product catalog

Completed 2026-09-18 against hosted project `jkdncdexqcymwbihwdhp`, schema
`shop_crm`. The old Products page used obsolete `public` RPCs, `shop_modules`,
and product columns that never existed in `shop_crm`. This task replaces it with
a working active-product list, search, create, edit and archive page. The sidebar
Products link is enabled. Stock quantities remain a separate inventory task.

## Database behavior

- `products.sale_price` stores a nonnegative EGP sale price. Active SKUs are
  unique per shop, ignoring letter case. Archiving keeps history and frees a
  product slot; it does not delete invoice references.
- The hosted Basic and Pro feature documents now contain initial
  `max_products` caps of **100** and **1,000** respectively. These are enforced
  in Postgres under a shop row lock. They are operational limits for this build,
  not approved marketing claims; [the commercial plan review](plans.md) must
  confirm or adjust them before sale.
- `shop_private.assert_shop_write_access` checks the caller's active profile,
  shop membership, permission and unexpired owner trial/paid period. Missing or
  unconfigured access fails closed. `save_product` and `archive_product` use it;
  they live in the non-exposed private schema. Exposed `shop_crm` wrappers are
  `SECURITY INVOKER` and executable only by `authenticated`. Direct browser
  table writes remain revoked.
- The migration is
  [`20260918185827_shop_product_catalog.sql`](../../supabase/shop_crm_migrations/20260918185827_shop_product_catalog.sql),
  hosted version `20260918190026`.

## Verification and review

The rollback-only [catalog fixture](../../supabase/tests/shop_crm_product_catalog.sql)
passed against the hosted database: create/read/update/archive, quota rejection,
slot reuse after archive, cross-user denial and expired-trial denial. No fixture
users, plans or products remained. Anonymous calls to both catalog RPCs returned
HTTP 401 (`42501`); security advisors reported no Shop Suit findings. The Nuxt
production build passed, and there are no typecheck errors in the new Products
page. Twelve diagnostics remain in the old inventory, service and expense pages.

To review locally, refresh the app, sign in, open **Products**, add a named item
and price, edit it, search it, and archive it. The authenticated browser journey
has not been independently observed by this task; database fixtures and build
checks are the verification evidence. The dashboard and page both state that
stock and purchasing are still in progress.

Next: migrate stock intake and adjustments with batch/quantity invariants, then
enable Inventory. Product, plan and stock behavior must be tested together
before this can be called a sellable workflow.
