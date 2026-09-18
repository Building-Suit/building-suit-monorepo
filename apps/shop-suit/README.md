# Shop Suit

Shop Suit is the shop-management application in the Building Suit workspace. Product, service, inventory and expense adapters remain product-owned; Building tokens, layouts, PrimeVue components, tables and interaction controllers are shared.

Run from the monorepo root:

```sh
pnpm install
pnpm run setup
cp apps/shop-suit/.env.example apps/shop-suit/.env
pnpm dev:shop
pnpm --filter @building-suit/shop-suit typecheck
pnpm --filter @building-suit/shop-suit build
```

Set the ignored `.env` to the designated backend and its browser-safe publishable key. API contracts use `public`; the business portal key remains `shop-crm`. Run `pnpm db shop-suit start` to initialize the dedicated local API on port 61321 (database 61322; email inbox 61324). Production and staging are separate Shop projects with independent Auth. The old hosted source still uses `shop_crm` until the documented scoped transfer is performed. Check the root [environment registry](../../docs/architecture/environments.json) and [identity architecture](../../docs/architecture/identity.md) before using a backend.

The app contains no privileged server credentials. Catalog, inventory and expense writes use authorized atomic RPCs; UI permissions are not a security boundary. The root [database runbook](../../docs/shared/database.md) governs database work, and the app’s `supabase/` directory owns its active SQL history. Root `supabase/legacy/shop-suit` preserves original SQL histories. Follow the [manual key setup](../../docs/shared/supabase-manual-setup.md) for hosted configuration.

The original [readiness record](docs/readiness/README.md) describes source-product capabilities and unfinished features. Its standalone paths/deployment commands are historical. Use the root workspace commands and scoped `AGENTS.md` for current development. The monorepo migration does not implement the source product's unfinished roadmap.
