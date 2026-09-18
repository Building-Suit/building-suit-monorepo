# Task 04a — Remove the application API layer

Updated 2026-09-18. This is a bounded part of Task 04. The Shop Suit app now
uses the Supabase client directly for its public plan catalog and no longer
builds a custom API module or serves application `/api` routes. No cloud schema
or application deployment changed in this step.

## Changes

- `usePlans` queries `shop_crm.plans` through `useSupabaseClient`, selecting only
  the public catalog fields, filtering to active/public plans, and ordering by
  `sort_order`. PostgreSQL's Task 03 plan policy also limits rows to the active
  `shop-crm` portal. The landing page keeps its loading, error/retry and empty
  states.
- Removed seven unused Nuxt server API routes, the `@buildingsuit/api-layer`
  package, its app dependency/configuration, and its build scripts. Existing
  Auth pages already call Supabase Auth through the client.
- Removed sample environment variables for the server-only service key, custom
  API base, and external payment provider. The app README now points to the
  hosted Supabase workflow. The lockfile was regenerated offline.

## Verification and limits

`pnpm run build:shop-crm` passed. The built server returned HTTP 200 for `/`
and HTTP 404 for the removed `/api/billing/plans` and `/api/auth/session`
routes; its route bundle contains only the Nuxt renderer. A source search found
no remaining app imports of the API package, API helper, or service key.

`pnpm run typecheck:shop-crm` still fails with the 46 preexisting diagnostics in
legacy shop pages and `useShop`: old RPC arguments are inferred as `undefined`,
rows as `never`, and some auto-imports are missing. The new plan composable
adds no diagnostic. The dashboard, catalog, inventory, expense and shop
selection flows still target the old `public` contract and have not been
repaired or certified.

At this Task 04a checkpoint, the hosted Data API returned `PGRST106`, so the
actual plan request could not succeed. Task 04c later exposed `shop_crm` and
verified anonymous plan reads; authenticated shop reads still need browser
checks. The app's client uses `db.schema = 'shop_crm'`; changing the local
`supabase/config.toml` would not have changed the hosted setting.

Next app step: generate/currently type the hosted database contract and replace
the legacy shop selection and dashboard RPCs with `shop_crm` reads and controlled
write RPCs. Do not bring back a custom API route or browser service key.
