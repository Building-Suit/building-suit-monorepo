# Shop Suit — Behavioral Parity Matrix

Baseline = working tree at rebuild start (commit `ca9fd7f`, branch `dev`).
Features are derived from actual code; landing-copy-only promises are roadmap, not parity items.

| Feature | Current behavior | DB dependency | Auth/RLS dependency | Rebuild status | Test |
|---|---|---|---|---|---|
| Landing page (ar default RTL) | Single page: hero, social proof bar, features, inventory, pricing, FAQs, closing CTA; `landing` layout; i18n via `no_prefix` strategy | none (except pricing fetch) | none | Rebuilt with Building Suit design system; same sections & copy keys | e2e render test |
| Language switch | `LanguageSwitcher` shows the other locale; detector: query → cookie `i18n_locale` → header; default `ar` | none | none | Preserved | e2e |
| Pricing cards (live data) | `usePlans` → Colada query → `/api/billing/plans`; BFF selects active+public plans ordered by `sort_order`; renders name, price, currency label, interval, trial badge, feature list incl. `features.inventory` check/x, "most popular" badge for slug `pro` | `plans` (+ `portals` indirectly) | plans_public_select | Preserved; add loading/error/empty states | e2e render + seed check |
| Login flow | POST `/api/auth/login` → GoTrue password grant → httpOnly cookies (`sb-access-token`, `sb-refresh-token`) → returns session | auth.users | GoTrue | **Page added** (`/auth/login`) wired to existing endpoint + `useLoginMutation` | e2e login page renders; API contract covered by e2e fixture test |
| Signup flow | POST `/api/auth/signup`: portal lookup by key → GoTrue signup with `display_name` metadata → manual profiles insert | portals, profiles, auth.users | service-path insert (see security review) | **Page added** (`/auth/signup`) | e2e render |
| Session | GET `/api/auth/session` reads cookie → GoTrue `/user` → profile select | profiles | GoTrue; profile read bug fixed | Preserved (fixed) | e2e via fixture |
| Logout | POST `/api/auth/logout`: GoTrue revoke (if cookie) + clear cookies | — | GoTrue | Preserved | e2e fixture |
| Reset password | POST `/api/auth/reset-password` → GoTrue `/recover` | — | GoTrue | **Page added** (`/auth/forgot-password`) | e2e render |
| Google OAuth entry | POST `/api/auth/oauth/google` returns authorize URL | — | GoTrue | Preserved; **URL bug fixed** (`config.public.apiBaseUrl` → proper Supabase URL) | unit test for URL building |
| 401 handling | api-client `onResponseError` redirects to `/auth/login` | — | — | Preserved (path now exists) | code review |
| Theme | `.dark` CSS variant exists; no toggle/persistence | none | none | **Toggle + persistence added** (saved → system → default light) | e2e |
| api-layer contracts | `useQueryContract`/`useMutationContract` + Colada adapter; auth + billing factories | — | — | Preserved; consumed by new auth pages | vitest |
| Server REST utils | `useApiServer` wrapper (rest/auth/functions endpoints, anon/service key) | all | — | Preserved; service-key signup path documented | vitest (fixture) |

DB-level behavior (preserved via migrations, tested by db tests):

| Behavior | Mechanism | Status |
|---|---|---|
| Product auto-creation on vendor invoice items; stock in/out | `handle_invoice_item` trigger | Preserved in schema + smoke test |
| FIFO COGS allocation per invoice item | `allocate_fifo_for_item` + after-insert trigger | Preserved |
| Revenue = lines minus proportional discounts | `invoice_revenue` | Preserved |
| Dashboard aggregates (revenue/cogs/profit/units/expenses/net/daily/product) | `dashboard_metrics` | Preserved |
| Subscription gating (`allowed/reason`) | `shop_access_state` | Preserved |
| Shop onboarding (shop+member+subscription+modules) | `setup_shop_for_new_user` | Preserved |
| Module gating on products/inventory RLS | `DELETE_shop_has_module` in policies | Preserved |
| Shop member / owner restrictions | RLS policies | Preserved (+ products_update hole fixed in forward migration) |

## Addendum — plans endpoint (runtime-verified finding)

The original `plans.get.ts` filtered plans by `portal_id`, but the authoritative
database contract has **global plans**: no `portal_id` column, `UNIQUE(key)`
(`plans_key_key`), and the `setup_shop_for_new_user` RPC resolves plans by `key`
alone. Against the recovered schema the original filter could never match — the
endpoint was broken before the rebuild (would always 500/406 once reached). The
rebuilt endpoint:

- keeps the `getCurrentPortal()` guard (request targets an active portal);
- drops the impossible `portal_id` filter (fix-forward, documented here);
- selects `plans.key` and exposes it as `slug` — the application-contract name
  consumed by the pricing UI and the api-layer `Plan` type;
- returns HTTP 500 with a generic message on upstream failure (no PG internals).

Verified at runtime: `/api/billing/plans` returns Basic (800 EGP, sort 1) and
Pro (1200 EGP, sort 2) with the full `features` map.
