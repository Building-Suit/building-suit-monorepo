# Task 08b — Service catalog

Completed 2026-09-18 against hosted project `jkdncdexqcymwbihwdhp`,
schema `shop_crm`. The old Services page queried obsolete `price`,
`discount` and `deleted_at` fields and called missing `public` RPCs.
It now reads the actual service price/discount fields and offers owner create,
edit, archive and search from the Services navigation item. Service invoicing
is still a separate unfinished workflow.

## Database behavior

- `shop_crm.save_service` and `shop_crm.archive_service` are authenticated
  invoker wrappers around private checked functions. They require active
  membership, the `services.manage` permission, and an unexpired trial or
  paid period. The owner receives the permission through the existing
  `shop_private.has_permission` owner rule.
- The active service count is checked under a shop row lock. The provisional
  Basic/Pro caps are 50/500. Missing plan limits fail closed. Archive preserves
  the row and frees a slot.
- Price and default amount/percentage discounts are validated by the RPC and
  table constraints. Invalid discounts, cross-shop writes and expired-plan
  writes fail in Postgres. Browser roles retain SELECT-only table access and
  cannot call the RPC anonymously.

SQL: [`20260918191550_shop_service_catalog.sql`](../../supabase/shop_crm_migrations/20260918191550_shop_service_catalog.sql),
hosted migration version `20260918192011`.

## Verification and review

The rollback-only [service fixture](../../supabase/tests/shop_crm_service_catalog.sql)
passed on the hosted database: create/read/edit/archive, cap enforcement,
invalid discount rejection, outsider denial, expired-trial denial, and grant
checks. The fixture users and plan were absent after rollback. Hosted checks
confirmed Basic 50 and Pro 500, anonymous RPC denial (HTTP 401) and no authenticated
direct table INSERT. Nuxt production build passed. Typecheck now reports four
legacy diagnostics, all in the Expenses page; the Services page has none.

Refresh the local app, open **Services**, and add a priced service with an
amount or percentage discount. Edit and archive it to review the catalog.
The authenticated browser journey has not yet been independently observed.
The plan caps are provisional commercial values and should be confirmed before
selling Shop Suit.
