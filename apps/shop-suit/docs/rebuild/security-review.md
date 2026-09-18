# Security Review — Shop Suit rebuild

Scope: everything changed or verified during the rebuild. Fixes are also called
out inline in `current-state-audit.md`.

## Fixed

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | `products_update` RLS policy checked shop membership only, not row ownership — any shop member could update another member's product rows | Medium | Forward migration rewrites the policy to `member_of_shop AND (owner_id = auth.uid() OR shop owner)`; covered by DB smoke test |
| 2 | `shop_modules` was RLS-enabled but had **no policies** — table was fully inaccessible to clients (and any future broad policy would have been the only gate) | Medium | Explicit member-select policy + module-gated insert; smoke-tested |
| 3 | `SECURITY DEFINER` functions ran with caller-controlled search path (shadowing risk) | Medium | All definer functions pinned to `SET search_path = public` in the forward migration; verified via `db reset` + tests |
| 4 | Session endpoint read `profiles` with the anon key (no user JWT) after validating the session cookie | High | Session endpoint now resolves the profile with the **user's** access token so RLS applies |
| 5 | Signup inserted into `profiles` with the anon key — always blocked by the (correct) RLS insert policy | High | Signup uses the service key **only** for the profile row; user creation still goes through GoTrue; no service key ever reaches the client |
| 6 | Google OAuth authorize URL was built from `config.public.apiBaseUrl` (an app path), producing invalid redirect targets | Medium | URL now built from the Supabase project URL with proper redirect allow-list |
| 7 | `plans.get.ts` exposed raw upstream failures; select-list drift caused 500s with PG error leakage in logs | Low | Generic 500 mapping (`Failed to fetch plans`); details remain server-side only |

## Verified clean

- **No service-role key in any client-reachable path.** `runtimeConfig` keeps
  `supabaseServiceKey` server-only; public config carries only URL + anon key.
  (Note: the user's local untracked `apps/shop-crm/.env` exists and was
  deliberately never read or committed.)
- **Storage**: no buckets are defined by any migration and no code calls
  `supabase.storage`; nothing to scope (re-check when uploads are introduced).
- **Edge Functions**: none exist; `[edge_runtime] enabled = false` locally.
- **Auth callbacks**: reset/OAuth flows rely on GoTrue redirect allow-list from
  `config.toml` (`site_url`, `redirect_urls`); no open-redirect found.
- **Secrets in Git**: none added; `.env.example` documents variable names only,
  marking `SUPABASE_SERVICE_KEY` as server-only.

## RLS posture summary

- Every `public` table is RLS-enabled; policies enforce shop membership
  (`shop_members`), ownership (`owner_id`), and module gating
  (`DELETE_shop_has_module`).
- `portals`/`plans`/`modules` are world-readable by design (public pricing +
  portal resolution); `profiles` is self-rows only; `shops` restricts to
  members/owners.
- Tenant isolation is regression-tested (`supabase/tests/db_smoke_test.sql`):
  cross-shop reads/writes, role restriction (cashier vs owner), and
  subscription-gated module access.

## Residual risks (accepted/documented)

1. `db_smoke_test.sql` runs as superuser inside the DB container; it is a
   development harness, not a CI secret.
2. Local Supabase uses the deterministic demo JWT secret from `config.toml`;
   production credentials remain in Supabase project settings, never in Git.
3. Client-side route guards (401 redirect) are UX only; the DB remains the
   authorization boundary — verified by the RLS tests.
