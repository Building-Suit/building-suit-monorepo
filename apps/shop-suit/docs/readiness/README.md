# Shop Suit readiness work

Updated: 2026-09-18. Status: **not ready for sale**.

This is the current implementation guide. Earlier documents under `docs/rebuild/`
and the batch notes in the root README describe historical work; their claims of
working features must not be treated as current verification.

## Working agreement

- Complete one bounded task, update this documentation, verify it, and commit locally.
- Do not push to GitHub or deploy the frontend.
- Keep Supabase hosted in the cloud; do not start/reset a local Supabase database.
- Application data access uses the Supabase client: Auth, table queries, and Postgres
  RPCs. No custom HTTP API routes, external backend, payment provider, or Edge Function
  backend is required or permitted by the current scope.
- Enforce permissions, subscription access, and quotas in Postgres. Hiding a button
  does not enforce a restriction.
- Preserve existing cloud data and other applications in a shared project.
- Carry Ledger Suit's entitlement and limit design into Shop Suit; distinguish
  reference prices from approved Shop Suit commercial terms.

## Documents and evidence

- [Capability and database audit](capabilities.md)
- [Confirmed hosted database contract and schema baseline](02-database-contract.md)
- [Task 03 read isolation and cloud handoff](03-read-isolation.md)
- [Task 04a client-only app shell](04-client-only-shell.md)
- [Task 04b shop selection and schema-error plan](04b-shop-selection-and-schema-error.md)
- [Task 04c live Data API exposure and verification](04c-data-api-exposure.md)
- [Task 05a first-shop access and reviewable dashboard](05-owner-bootstrap.md)
- [Task 08a owner product catalog](08a-product-catalog.md)
- [Task 09a manual inventory](09a-manual-inventory.md)
- [Unlinked Supabase deployment command](deploy-without-link.md)
- [Plans and limitations reference](plans.md)
- [Ordered task list and acceptance criteria](tasks.md)
- [Cloud tables, columns, and policies](cloud-schema-audit.json)
- [Cloud constraints, triggers, and grants](cloud-schema-constraints.json)
- [Cloud public shop helper functions](cloud-shop-functions.json)
- [Cloud reporting views](cloud-shop-views.json)
- [Pre-hardening schema-only recovery baseline](shop_crm_schema_baseline.sql)

Snapshots contain database metadata, not customer records or credentials. They are
review evidence, not runnable migrations or a complete backup. The `functions`
field in the table snapshot is null because no functions were found in `shop_crm`
or referencing that schema explicitly; the separate function snapshot captures
the public helpers that still reference the old `public` tables.

## Task 01 record

Completed the initial repository/cloud metadata review and Ledger Suit comparison.
Shop Suit baseline: `a218d15`; Ledger Suit local reference: `6802580`.
The working tree was clean before the review.

Cloud project selected by the existing app environment:
`jkdncdexqcymwbihwdhp` (dashboard name: **Building Suit**). It contains a separate
`shop_crm` schema. The user subsequently confirmed this as the target. All cloud
access in Task 01 was read-only.

Verification: `pnpm run typecheck:shop-crm` **failed** with 46 TypeScript diagnostics:
RPC arguments inferred as `undefined`, result rows inferred as `never`, missing
Nuxt auto-import names in `useShop.ts`, and implicit-any callbacks. This is a
baseline failure, not a completed build verification. The app package has no
`test` script despite the root `test:shop-crm` command. The existing database smoke
test targets Docker and inserts fixtures; it was not run against the shared cloud.
No end-to-end business workflow is certified by this audit.

Task 02 confirms `shop_crm` in the existing hosted project, records the
schema-only recovery baseline, and maps application expectations to the cloud.
Next: secure tenant and permission boundaries before exposing the schema (Task 03).

## Task 02 record

Changed the app's Supabase client schema and publishable-key fallback, corrected
the sample/local portal key, and disabled replay of the legacy `public` migrations
through the local CLI configuration. No cloud migration or persistent database
change was made.

Validation: the hosted Data API returned `PGRST106` for `shop_crm` before
exposure; the recovery DDL replayed into a probe schema inside a transaction,
which rolled back; a follow-up query found no probe schema and the same 24
tables/25 views in `shop_crm`. Snapshot JSON and document links parsed. Baseline
object counts matched the cloud catalog. Nuxt type checking still reports the
same 46 existing application errors; no `nuxt.config.ts` diagnostic was added.
The schema-only recovery test does not replace a customer-data restore drill.

## Task 03 record

Applied three scoped migrations to the hosted `shop_crm` read boundary and saved
their SQL under `supabase/shop_crm_migrations/`. All 24 tables have RLS and
SELECT-only tenant/permission policies; no browser business-write or report-view
grants remain. All 25 views use invoker security. Existing public Shop Suit RPCs
are revoked from browser roles until their broken contracts can be replaced.
The attached closed-period triggers now resolve `shop_crm` periods correctly.

The rollback-only fixture in `supabase/tests/shop_crm_read_isolation.sql` passed
against the hosted database, including owner/employee/outsider isolation,
suspension, and closed-period writes. A separate catalog check found zero tables
without RLS, zero unsafe views, zero browser-write relations, and zero readable
report views. At this checkpoint, the Data API rejected `shop_crm` with
`PGRST106`; Task 04c resolved that exposure gap. Exact versions and limits are
in [Task 03](03-read-isolation.md).

## Task 04a record

Removed the app's custom API-layer package and seven server API routes. Public
pricing now queries the hosted plan table through the Supabase client. The Nuxt
production build passes, and the removed API URLs return 404 in the local built
server. At this checkpoint, typechecking failed on 46 legacy shop-contract
diagnostics and Data API exposure blocked live client verification. See
[Task 04a](04-client-only-shell.md) for exact scope and next work.

## Task 04b record

Mapped shop selection to the hosted `shop_crm` profile, membership and shop
tables. The dashboard layout now shows a retryable error instead of a Nuxt 500
when the shop query fails. Production build passes; typecheck diagnostics fell
from 46 to 27, all remaining in legacy pages. At this checkpoint, the hosted
Data API rejected `shop_crm`; [Task 04b](04b-shop-selection-and-schema-error.md)
records that finding and the remaining dashboard/onboarding work.

## Task 04c record

Applied a scoped hosted migration to add `shop_crm` to PostgREST's exposed
schemas while keeping `public` and `graphql_public`. The anonymous Supabase
Client request behind the landing-page pricing error now returns two plans with
HTTP 200; the portal query returns HTTP 200, and anonymous product access is
still denied. A local Nuxt server returned HTTP 200 for `/` and `/dashboard`
without the former schema error in their HTML. See [Task 04c](04c-data-api-exposure.md)
for the role-setting tradeoff, rollback, exact checks and remaining work.

## Task 05a record

Restored the Nuxt context around deferred shop cache operations, replaced the
dashboard's absent RPCs/old columns, and added an authenticated first-shop RPC
in `shop_crm`. A hosted owner shop and Pro trial are now present; the rollback
fixture and anonymous denial checks passed. The dashboard gives an honest review
of available and unfinished features. See [Task 05a](05-owner-bootstrap.md) for
exact verification and remaining work.

## Task 08a record

The Products page now lists, searches, creates, edits and archives active
`shop_crm` products. A private database write check enforces active access and
Basic/Pro product caps under a shop lock. The Products navigation is enabled.
The hosted rollback fixture, anonymous-denial checks and Nuxt build passed;
stock and sales are still pending. See [Task 08a](08a-product-catalog.md).

## Task 09a record

The Inventory page now lists stock and records manual receipts/write-offs for
Pro owners. Idempotent requests and FIFO batch deductions are enforced in
Postgres. The hosted rollback fixture, anonymous-denial check and Nuxt build
passed. Supplier purchases and sales remain pending. See [Task 09a](09a-manual-inventory.md).

## Task 08b record

The Services page now lists, searches, creates, edits and archives active
`shop_crm` services with amount or percentage discounts. A private write check
enforces active access and Basic/Pro service caps under a shop lock. The Services
navigation is enabled. The hosted rollback fixture passed; service invoicing
and authenticated browser verification remain pending. See
[Task 08b](08b-service-catalog.md).

## Task 11a record

The Expenses page now records, edits and voids paid `shop_crm` expenses,
auto-creates same-shop categories and shows recent paid/void history. Creation
uses a request UUID so a repeated submission cannot charge twice. The hosted
rollback fixture covered idempotency, closed periods, outsider denial and
expired trials. Nuxt build and typecheck pass. Other income and reports remain
pending. See [Task 11a](11a-expense-ledger.md).
