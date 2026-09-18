# Shop Suit — Current-State Audit

Derived from repository evidence (working tree + Git history), 2026-09-09.

## Important discovery

The rebuild prompt assumes a nested `./supabase/supabase` exists. It does **not** exist in the
working tree. Git history shows it **did** exist twice, under different roots, and was deleted:

- `packages/supabase/supabase/…` (initially, commit `141d9f8`, incl. linked-project `.temp/` files)
- moved to `database/supabase/supabase/…` (`6706c4a`)
- deleted in `9b7647a` ("remove: local database folder") on 2026-02-01
- `apps/shop-admin` (a second app) was deleted in `4bc1433`

The only authoritative DB artifacts recovered from history (at `9b7647a~1`):

- `database/supabase/supabase/config.toml` (Supabase CLI v2 config, `major_version = 17`)
- `database/supabase/supabase/migrations/20251224154509_remote_schema.sql` (a `db pull` snapshot
  of the **live** database: 2,060 lines, 16 tables, 18 functions, triggers, RLS)
- `database/supabase/types/database.types.ts` (generated types, UTF-16LE with BOM — PowerShell
  `>` redirect artifact — consistent with the same schema)
- `database/supabase/package.json` (supabase CLI v1.142.2 scripts)

There is **no live local Supabase project** today. The app talks to a hosted Supabase instance
via server-side REST calls only (no client-side supabase-js).

## 3.1 Application stack

| Aspect | Value |
|---|---|
| Monorepo | pnpm workspaces (`apps/*`, `packages/*`, `database/*` in workspace yaml) |
| Framework | Nuxt 4 (`^4.3.0`), Vue 3.5, SSR (no `ssr: false`) |
| Node | v26.8.1 (CI pins 22) |
| Package manager | pnpm 10.24.0 |
| TypeScript | ^5.9.3 |
| Server state | `@pinia/colada` behind an adapter contract in `@buildingsuit/api-layer` |
| UI | Tailwind CSS **v4** (`@nuxtjs/tailwindcss` 7 beta) + shadcn-vue (reka-ui) |
| Icons | lucide-vue-next + `@nuxt/icon` (lucide, solar collections) |
| i18n | `@nuxtjs/i18n` v10, `no_prefix` strategy, **default `ar` (RTL)**, en available, full ar+en landing copy |
| Forms | none (no validation library yet) |
| Tests | Vitest + `@nuxt/test-utils` (api-layer e2e fixture test) |
| Lint | ESLint 9 flat config in `packages/api-layer` only |
| Supabase access | server-side REST via `useApiServer` (PostgREST + GoTrue REST), **no supabase-js** |
| CLI | Supabase CLI 2.90.0 installed locally; Docker 29.7.2 available |

## 3.2 Route inventory

| Route | Purpose | Auth | Reads | Writes | Notes |
|---|---|---|---|---|---|
| `/` (index.vue, layout `landing`) | Marketing landing page | public | `plans` via `/api/billing/plans` | none | Hero, social proof, features, inventory, pricing (live plans), FAQs, closing CTA |
| `/auth/login` | Login (link target only) | public | — | — | **No page exists — broken link today** |
| `/auth/callback` | OAuth return | public | — | — | referenced by google oauth handler; no page |
| `/api/auth/login` (POST) | BFF: password grant → sets `sb-access-token`/`sb-refresh-token` httpOnly cookies | public | — | auth token | |
| `/api/auth/signup` (POST) | BFF: portal lookup + auth signup + manual `profiles` insert | public | `portals` | auth.users, profiles | profile insert not RLS-safe (see security review) |
| `/api/auth/logout` (POST) | BFF: revoke + clear cookies | public | — | — | |
| `/api/auth/session` (GET) | BFF: user + profile from cookie token | cookie | auth.user, profiles | — | |
| `/api/auth/reset-password` (POST) | BFF: GoTrue `/recover` | public | — | — | |
| `/api/auth/oauth/google` (POST) | returns authorize URL (uses `config.public.apiBaseUrl` **incorrectly** → `/api/auth/v1/...`) | public | — | — | bug |
| `/api/billing/plans` (GET) | BFF: public active plans for portal | public | `plans` | — | |

DB tables referenced by the **current app**: `portals`, `profiles`, `plans`.
DB tables defined in the **live schema** (not yet used by this app): `shops`, `shop_members`,
`shop_subscriptions`, `shop_modules`, `modules`, `plan_modules`, `products`, `services`,
`invoices`, `invoice_items`, `invoice_item_cogs`, `inventory`, `store_entries`.

Note: current live `plans` table (`key`, `price_monthly`, …) differs from what the app queries
(`price_amount`, `currency`, `billing_interval`, `trial_days`, `features`, `sort_order`,
`is_coming_soon`) — the typed `database.ts` in api-layer describes the **target** schema, and the
schema snapshot is older than the app's expectations. A forward migration is required
(see database-contract.md).

## 3.3 Feature inventory (actual, not aspirational)

- Marketing landing page (ar/en, RTL-first)
- i18n with locale detector (query → cookie `i18n_locale` → header) + LanguageSwitcher
- Auth BFF endpoints: login/signup/logout/session/reset-password/google-oauth
- Plans query through api-layer contracts (Pinia Colada adapter)
- Dark class variant exists in CSS; **no theme toggle implemented**
- api-layer Nuxt module: runtime config, client `$fetch` factory with 401 redirect, server utils,
  query/mutation contracts, generated-DB-types surface (hand-written today)

Features promised by landing copy but **not implemented yet** (dashboards, invoices, inventory UI,
employees, expenses, exports): these belong to the product roadmap, not this rebuild.

## 3.4 Data-access inventory

| Frontend/backend feature | Object | Operation | Return | Error handling |
|---|---|---|---|---|
| login.post.ts | GoTrue `/token?grant_type=password` | POST | session | 401 on error; cookies set |
| signup.post.ts | `portals` select / GoTrue `/signup` / `profiles` insert | SELECT/POST | user | 404 portal / 400 signup; **profile insert error ignored** |
| logout.post.ts | GoTrue `/logout` + cookie clear | POST | — | swallows logout error |
| session.get.ts | GoTrue `/user` + `profiles` select | GET | profile | 401; profile select uses anon key without user JWT (bug) |
| reset-password.post.ts | GoTrue `/recover` | POST | — | 400 |
| oauth/google.post.ts | builds authorize URL (wrong base path) | — | URL | — |
| billing/plans.get.ts | `plans` select via `useApiServer` | GET | plans[] | 500 |
| usePlans (client) | `/api/billing/plans` via contracts | query | plans | Colada states |
| useSessionQuery / auth mutations (client) | defined in api-layer factory | query/mutation | Session | not consumed by any page yet |

Abstractions: `useApiServer` (server, raw REST), `table.*` helpers (unused), `useApiClient` +
`useQueryContract`/`useMutationContract` (client), Colada adapter.
