# Final Validation — commands and results

Environment: pnpm 10.24.0 monorepo, Node 26.8.1 local (CI pins Node 22),
Supabase CLI local stack (project id `shop-suit`, API on `127.0.0.1:55321`).

## Repository / app

| Command | Result |
|---|---|
| `pnpm install` | ✅ pass |
| `pnpm run module:lint` (api-layer eslint) | ✅ pass (0 errors, 0 warnings) |
| `pnpm run module:test` (vitest) | ✅ pass (1 passed) |
| `pnpm run typecheck:shop-crm` (nuxt typecheck: app/server/node/shared projects via vue-tsc) | ✅ pass |
| `pnpm run build:shop-crm` (nuxt build) | ✅ pass |
| `rg -n "supabase/supabase\|supabase\\supabase" .` | ✅ only historical doc mention |

## Database

| Command | Result |
|---|---|
| `supabase start` | ✅ stack healthy (analytics/edge disabled locally, documented) |
| `supabase db reset` | ✅ pass (historical schema + alignment migration + seed) |
| `docker exec -i supabase_db_shop-suit psql -U postgres -d postgres < supabase/tests/db_smoke_test.sql` | ✅ pass — tenant isolation, roles, FIFO/stock/revenue/dashboard math, subscription + module gating |
| `supabase gen types typescript --local` | ✅ regenerated `packages/api-layer/src/runtime/server/types/database.generated.ts` from live local DB |

## Runtime smoke test (production build, local Supabase)

```bash
pnpm run build:shop-crm
# server started with NUXT_PUBLIC_* runtime config pointed at the local stack
curl http://127.0.0.1:3400/                      # 200, 75.8 KB SSR HTML, dir="rtl"
curl http://127.0.0.1:3400/api/billing/plans     # 200 JSON: Basic + Pro with features/slug
curl -X POST .../api/auth/login (bad creds)      # 401 (proper error mapping)
curl http://127.0.0.1:3400/auth/signup           # 200
```

The pre-rebuild build crashed on boot under Node ≥22
(`SyntaxError: The requested module 'vue' does not provide an export named 'default'`
from pinia's CJS build — confirmed identical on the base commit before any
rebuild change). Fixed in `nuxt.config.ts` by substituting pinia's ESM build at
bundle time in both the Vite SSR pass and Nitro's Rollup server build
(`piniaEsmPlugin`); verified by zero `Vue__default` imports in `.output` and the
successful SSR run above.

## Not verified (with reasons)

- **Hosted (remote) Supabase parity**: no remote credentials are available in
  this environment; the recovered schema snapshot is the authoritative proxy.
  `supabase db push` / `migration list` against the hosted project must be run
  by an operator with `supabase link` access.
- **Full E2E browser suite**: no Playwright/e2e harness exists in the repo;
  verification was via typecheck, unit tests, SQL assertions, and the HTTP smoke
  test above.
- **Stripe checkout**: schema and `shop_subscriptions` are wired, but no Stripe
  keys/endpoints exist in the repo to exercise payment flows; the same was true
  before the rebuild.
- **Google OAuth end-to-end**: authorize-URL generation is fixed and unit-
  checked, but a real client ID/secret lives in the Supabase dashboard, not the
  repo.
- **Arabic copy review**: locale files compile and render (`dir="rtl"` verified
  in SSR HTML); native-speaker copy review is out of scope for this pass.
