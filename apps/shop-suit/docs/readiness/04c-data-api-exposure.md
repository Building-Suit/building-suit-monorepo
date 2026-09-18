# Task 04c — Resolve `PGRST106` on the hosted Data API

Completed 2026-09-18 against project `jkdncdexqcymwbihwdhp`. The landing-page
pricing request in the screenshot returned HTTP 406 with `PGRST106` and the hint
that only `public, graphql_public` were exposed. The requested `shop_crm` schema
existed and its grants and RLS checks had already passed, so the failure occurred
before the `plans` query reached the table.

## Change

The connected Supabase account could apply a database migration but could not
edit the project's Data API setting. The `authenticator` role had no preexisting
`pgrst.db_schemas` override. Following [Supabase's PGRST106 guidance](https://supabase.com/docs/guides/troubleshooting/pgrst106-the-schema-must-be-one-of-the-following-error-when-querying-an-exposed-schema),
the scoped migration
[`20260918183601_expose_shop_crm_data_api.sql`](../../supabase/shop_crm_migrations/20260918183601_expose_shop_crm_data_api.sql)
set the list to `public, graphql_public, shop_crm` and notified PostgREST to reload
its configuration. It did not add table or function grants, change RLS, create a
custom API, or deploy the frontend. The hosted migration version is
`20260918183616`; the unlinked deployment script maps the local filename to that
version so a later run will not replay it.

## Live verification

Using the app's existing publishable key as an anonymous caller with
`Accept-Profile: shop_crm`:

| Request | Result |
|---|---|
| `plans` with the same public columns and filters as `usePlans` | HTTP 200; 2 rows |
| `portals` | HTTP 200; 1 row |
| `products` | HTTP 401, PostgreSQL `42501` permission denied |

The role configuration read back as `public, graphql_public, shop_crm`, and a
catalog check found zero `shop_crm` tables without RLS.

The current local Nuxt server on a temporary port also returned HTTP 200 for `/`
and `/dashboard`, with no `Invalid schema: shop_crm` string in their HTML. The
anonymous REST probes are the conclusive test of this failure; the server HTML
check does not certify browser hydration or an authenticated dashboard journey.

Expected after refreshing the user's landing page: the plan request changes
from HTTP 406 to HTTP 200 and the red pricing retry panel disappears. If it
does not, inspect the request's project URL and `Accept-Profile` header against
the app environment. The screenshot's project matched this migration target.

## Operational tradeoff and rollback

This role-level setting takes precedence over the Dashboard **Exposed schemas**
list. Until it is reset, future changes to that list must update the full
`pgrst.db_schemas` role value and reload PostgREST. [Supabase documents this
override behavior](https://supabase.com/docs/guides/troubleshooting/postgrest-error-pgrst002-could-not-query-the-database-for-the-schema-cache-c396e9).

To hand management back to the Dashboard without breaking Shop Suit, first add
`shop_crm` beside `public` and `graphql_public` in **Project Settings → Data API →
Exposed schemas** (or use the prepared `scripts/expose-shop-crm-data-api.py`
Management API helper with a project-scoped personal access token). Then run:

```sql
alter role authenticator reset pgrst.db_schemas;
notify pgrst, 'reload config';
```

Verify the same anonymous `plans` request returns HTTP 200 after the reset. A
reset before updating the Dashboard list would restore `PGRST106`.

## Next bounded step

Repair dashboard and onboarding queries/RPCs against the actual `shop_crm`
contract, remove the remaining 27 legacy page type diagnostics, and verify the
owner/employee browser journeys. Keep write operations blocked until each one
has same-shop, permission, subscription, quota and concurrency enforcement in
Postgres. This task resolves the exposed-schema error, not release readiness.
