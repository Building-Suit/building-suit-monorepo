# Task 02 — Hosted database contract

Reviewed 2026-09-18. Target confirmed by the user: Supabase project
`jkdncdexqcymwbihwdhp` (named Building Suit), PostgreSQL schema `shop_crm`.
Shop Suit must remain isolated from Building Suit's `public` business tables.
Supabase Auth is shared by the project.
This document describes the Task 02 baseline; [Task 03](03-read-isolation.md)
records the later security changes.

## Connection and exposure

The browser client is now configured with `db.schema = 'shop_crm'` in
`apps/shop-crm/nuxt.config.ts`. The installed `@nuxtjs/supabase` module passes
`clientOptions` to the Supabase JS client. The hosted `shop_crm` portal key is
`shop-crm`; the ignored local `.env` and committed `.env.example` use that key.
At Task 02, the transitional API-layer runtime config read the same
publishable-key variable as `@nuxtjs/supabase`. Task 04a subsequently removed
that API layer and its routes; see [the app record](04-client-only-shell.md).

**Cloud exposure is still closed.** An anonymous read with `Accept-Profile:
shop_crm` returned HTTP 406 / `PGRST106`: only `public` and `graphql_public`
are exposed. PostgreSQL grants already give anon/authenticated schema usage and
broad table access, so exposure would immediately make the current insecure
views and policies reachable. Task 03 must first tighten grants, RLS and views,
then add `shop_crm` in the hosted project's Data API “Exposed schemas” setting
and repeat the client check. [Supabase custom-schema guidance](https://supabase.com/docs/guides/api/using-custom-schemas)
describes the setting and client option; the project should use narrower grants
than its broad example.

The repository's `supabase/config.toml` is **local CLI configuration**, not the
cloud Data API setting. Its migration runner is disabled because the checked-in
`supabase/migrations` chain targets the old `public` shop model. Those migrations
are historical evidence; never `db push` them to this shared project. New
`shop_crm` changes must be reviewed as separately tracked, scoped migrations.
Task 03's applied migrations are in `supabase/shop_crm_migrations/`, not the old
runner directory.

## Schema-only recovery baseline

[`shop_crm_schema_baseline.sql`](shop_crm_schema_baseline.sql) reconstructs the
pre-Task-03 observed schema, 12 shared enum types, 24 tables, 91 constraints, 32 extra
indexes, 16 public shop helper functions, 25 views, 58 policies, 7 triggers,
and current grants. It includes observed defects and intentionally has no data.
It is a **schema recovery artifact for a fresh, isolated Supabase project**,
not an upgrade script for the live shared project or a customer-data backup.
Supabase-managed `auth.users` and roles must exist in the recovery target.

Validation ran a copy with every `shop_crm` reference changed to a new probe
schema inside one cloud transaction. Existing public enums/functions were
reused, the DDL executed successfully, and the transaction rolled back. A
follow-up catalog query confirmed that the probe schema does not remain and the
live `shop_crm` still has 24 tables and 25 views. This verifies structural
replay of tables, constraints, indexes, views, RLS policies, triggers and grants;
it does **not** verify a full restore with data or the public functions against
a fresh project. A database backup and restore drill remains a release task.

Metadata JSON snapshots in this directory provide a second way to inspect the
observed objects without executing SQL. They contain no customer rows or keys.

## App to hosted-schema map

| App expectation | Hosted contract | Required next change |
|---|---|---|
| `public.portals.key = shop_suit` | `shop_crm.portals.key = shop-crm` | Resolve the portal by key in the correct schema |
| `public.profiles` | `shop_crm.profiles` has `user_id`, `portal_id`, `status` | Build shop profile provisioning; Auth signup currently triggers Building Suit's `public.handle_new_user`, not a Shop Suit profile |
| `shop_members.user_id`, `role`, `deleted_at` | `shop_memberships.profile_id`, `role`, `status` | Join to `shop_crm.profiles`; only active membership grants access |
| `shops.owner_id`, `type` | `shops.portal_id`, `name`, `status` | Owner comes from active membership, not a column; shop creation needs an atomic RPC |
| `plans.key`, `is_coming_soon`, features | `plans.slug`, `portal_id`, `price_amount`, `features` | Query active/public portal plans directly via client; pricing and entitlement rules must be defined in DB |
| Shop subscription row | `subscriptions.profile_id`, `plan_id`, status and period fields | Define shop owner to subscription binding and server-authoritative trial/paid access |
| `products.price`, `stock`, low-stock threshold | `products` has identity, SKU/barcode and `is_active`; stock is in FIFO batches | Decide catalog sale price model; derive stock from batches; no direct stock field edits |
| `services.price`, `discount`, `deleted_at` | `services.base_sale_price`, default discount type/value, `is_active` | Update form and archive behavior |
| `inventory` with one movement/cost column | `inventory_batches`, `inventory_movements` | Map history, adjustment and cost rules; use atomic RPCs for stock writes |
| Combined `invoices` client/vendor source | Sales `invoices` and `vendor_invoices`, each with items | Separate sales/purchase workflows and transactional posting |
| `store_entries` income/expense | `expenses` + `expense_categories`; `payments` handles money direction | Define other-income representation; avoid presenting it as implemented |
| No customer/vendor management | `clients`, `vendors` | Build tenant-safe forms and same-shop references |
| `shop_members` role string only | `roles`, `permissions`, `membership_roles`, `role_permissions` | Fix role policies and build employee management |
| Dashboard/report RPCs | 25 reporting views, mostly with no `security_invoker` | Secure and verify views before use |

None of the 11 RPC names called by the current dashboard, products, services,
inventory and expenses pages exists in hosted `public` or `shop_crm`. The local
SQL migrations contain some of these names but are for the old schema. The
public shop helper functions that do exist in the hosted project reference old
`public` table names and must be repaired or replaced. Their definitions are
recorded in `cloud-shop-functions.json`.

## Plans currently in the hosted shop portal

The only existing portal row is `shop-crm`. Its visible active plans are Basic
at EGP 799/month and Pro at EGP 1,199/month, both with 30 trial days. Basic
has an empty `features` object; Pro has `{ "inventory": true }`. These rows
are **not** Ledger Suit's Solo/Starter/Business/Scale catalog, contain no
quantitative limits, and do not prove billing or enforcement works. They must
be preserved until Task 06 defines a safe transition policy.

## Original handoff to Task 03

First protect `shop_crm` tables and views while they are still outside the Data
API. Exercise access as anon, owner, employee, suspended member and unrelated
user with tests that can safely roll back. Use fixed schema-qualified function
references, explicit role grants, and no client-controlled subscription update.
Only then expose `shop_crm` and verify a real Supabase client query.
The [Task 03 record](03-read-isolation.md) documents the security work completed
and the still-closed Data API setting.
