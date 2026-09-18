# Task 05a — First-shop access and a reviewable dashboard

Completed 2026-09-18 against hosted project `jkdncdexqcymwbihwdhp`, schema
`shop_crm`. The old `/dashboard` crashed because `useShop` called Nuxt's cache
utilities after an `await`, outside the implicit app context. It also queried
nonexistent `dashboard_metrics`, `shop_access_state` and
`setup_shop_for_new_user` RPCs and old plan/invoice columns. The database had no
Shop Suit profile or shop before this task, so there was no account path into the
app even after the crash was fixed.

## Working path

1. Sign up or sign in with Supabase Auth. Authenticated users go to `/dashboard`;
   unsigned visitors are redirected to `/auth/login`.
2. The dashboard reads the real public Basic/Pro catalog and lets a new owner
   choose one trial plan and name a shop.
3. `shop_crm.create_owner_shop` calls a private transaction using the caller's
   validated `auth.uid()`. It creates a `shop_crm` profile, active shop, owner
   membership and one trial subscription. A repeated call returns the same shop
   without extending the trial or switching plans. It cannot create a shop for a
   supplied user ID. Direct browser writes to these tables remain revoked.
4. `useShop` reloads active memberships and shops; the dashboard shows the
   owner's real subscription state and readable issued/paid invoices using the
   actual `shop_crm` columns. It no longer shows invented financial totals.
5. The dashboard names available and unfinished areas. The sidebar still
   disables unported feature pages so old public-schema RPCs cannot appear to
   work while failing or bypassing planned rules.

The privileged function is in the non-exposed `shop_private` schema with an
empty search path and explicit identity check. The exposed `shop_crm` wrapper is
`SECURITY INVOKER`; only `authenticated` can execute either function. The SQL is
in [`20260918184551_bootstrap_owner_shop.sql`](../../supabase/shop_crm_migrations/20260918184551_bootstrap_owner_shop.sql),
hosted migration version `20260918184731`. The unlinked deployment script maps
these versions to prevent replay.

## Verification

- The rollback-only SQL fixture in
  [`shop_crm_owner_bootstrap.sql`](../../supabase/tests/shop_crm_owner_bootstrap.sql)
  passed against the hosted database: invalid names/plans rejected, first-shop
  retry idempotent, trial end unchanged on retry, second owner isolated, and
  anonymous execution/direct browser writes denied. Fixture users and shops
  were absent afterward.
- A real shop, active owner membership and Pro trial subscription were observed
  in the hosted project after this change. No account or shop identifiers are
  stored in this document. This confirms a live setup transaction, but the
  owner's full browser journey still needs an authenticated visual check.
- Anonymous Data API invocation of `create_owner_shop` returned HTTP 401 with
  `42501`. Security advisors found no Shop Suit findings; the existing warnings
  concern the other app and shared Auth setting.
- The Nuxt production build passed. Typecheck has no diagnostics in the changed
  dashboard, auth, layout or `useShop` files; 18 diagnostics remain in the old
  product, inventory, service and expense pages.
- Anonymous HTTP checks returned 200 for `/`, `/auth/login` and `/auth/signup`,
  and 302 from `/dashboard` to `/auth/login`, without the Nuxt context error.

## What is not yet working

Product, service, stock, invoice and expense creation and employee management
still call obsolete public-schema functions/fields. Plan quotas and write access
are not yet enforced for those workflows. A trial subscription now records the
chosen plan and expiry, but it is not payment activation. Do not call the app
sellable at this point.

Next: migrate the catalog and inventory workflow to `shop_crm` with atomic
permission, same-shop and plan checks; then re-enable its navigation. Continue
feature by feature, followed by authenticated browser journeys and release
checks. No GitHub push or frontend deployment was made.
