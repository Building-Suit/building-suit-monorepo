# Task 04b — Shop selection and the `Invalid schema` error

Updated 2026-09-18. The `/dashboard` screenshot shows the hosted PostgREST
response `PGRST106: Invalid schema: shop_crm`. A fresh anonymous Data API probe
still returns HTTP 406 and lists only `public, graphql_public`. The Nuxt layout
previously awaited an unhandled request to the nonexistent old `shop_members`
table, so the error became a full-page 500. The schema setting and the old app
contract are separate problems.

## Completed in this bounded step

- `useShop` now resolves the active `shop-crm` portal, the signed-in user's
  profile, active memberships and active shops from the actual `shop_crm`
  columns. It no longer requests `shop_members`, `owner_id`, `type` or
  `deleted_at` from the old schema.
- A failed shop load clears cached shop state and displays a retryable layout
  error rather than throwing through SSR. Development mode shows the underlying
  error message. Request versioning prevents an older user/session request from
  overwriting newer shop state.
- The production Nuxt build passes. The 46 baseline TypeScript diagnostics are
  down to 27; none are in `useShop` or the layout. The remaining diagnostics
  belong to dashboard and legacy feature pages. No cloud migration or frontend
  deployment was performed.

This fallback is **not** a substitute for exposing the schema. Task 04c has now
exposed it on the hosted project and verified anonymous reads.

## Cloud resolution

The original preferred path was the Dashboard or Management API exposed-schema
setting. Task 04c instead used Supabase's documented `authenticator` role setting
because the connected account could run SQL but lacked project configuration
access. The prior recommendation to avoid that override was conservative: it
changes who manages the list, but it does resolve this error when the full prior
list is preserved. See [Task 04c](04c-data-api-exposure.md) for the actual SQL,
verification and rollback. Owner and employee shop-selection journeys still need
authenticated testing. The dashboard and onboarding still contain old contract
references that require separate app work.

## Execution order and expected behavior

| Step | Work | Expected result |
|---|---|---|
| 1. Data API exposure | Completed in Task 04c; anonymous browser-role reads verified | `PGRST106` disappears on public catalog reads; anonymous product access remains denied |
| 2. Shop selection | Completed locally in this task; authenticated verification remains | Active owner/employee sees only allowed shops; failures show retry UI |
| 3. Dashboard and onboarding contract | Replace absent RPCs and old fields; add controlled shop setup in Supabase SQL | Owner can create a shop and dashboard data comes from real `shop_crm` tables/views |
| 4. Feature workflows | Products, inventory, sales, expenses, employees, plan/seat/usage limits, reports; each with its own database tests | Daily workflows persist safely and enforced limits match the documented plan |
| 5. Release checks | Typecheck, production build, browser journeys and restore procedure | Only then call the product ready for sale |

Each step gets its own documentation, verification and local commit. Nothing is
pushed to GitHub or deployed as a frontend by this plan.
