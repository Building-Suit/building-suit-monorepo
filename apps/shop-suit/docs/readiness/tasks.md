# Shop Suit Requirements V1 — canonical implementation tracker

Status: SS-BIZ-001 complete; SS-SAFE-001 proposed next, not started.
Last updated: 2026-09-23.

This file is the sole canonical implementation tracker for the Shop Suit Requirements Pack V1 stream. It replaces the former coarse backlog in this path. Other files in `apps/shop-suit/docs/readiness/` and `docs/rebuild/` remain dated evidence, not parallel status authorities.

> Source limitation: the SS-BASE-001 attachment enumerates all 197 requirement IDs and supplies domain audit criteria, but it does not include the underlying per-ID Pack V1 wording. SS-BIZ-001 later supplied exact BIZ-01..08 and SUB-03/04 intent, now reflected below. Other short summaries remain traceability labels inferred from the baseline brief; where exact semantics affect classification, the status stays `unverified` until approved wording is supplied.

## Baseline metadata

| Field | Value |
|---|---|
| Baseline date | 2026-09-23 |
| Requirements source | Shop Suit — Requirements Pack V1; ID list and SS-BASE-001 audit brief attached, per-ID wording unavailable |
| Repository | `Building-Suit/building-suit-monorepo` |
| Baseline branch | `origin/stg` (current verified remote base; the protected `stg` checkout had a pre-existing same-file draft that was excluded and left untouched) |
| Baseline commit | `599a5ab5afc5a99d5096a3e23e7a54ffe75ced5a` |
| Cumulative worktree | `/home/tareq/Dev/building-suit-monorepo/.local/worktrees/shop-requirements-v1` |
| Cumulative branch | `codex/shop-suit/requirements-v1` |
| Initial status | Clean: `## codex/shop-suit/requirements-v1` |
| Database inspected | Checked-in four-migration chain and an already-current disposable local Shop database through `20260919091222`; this task applied no migration |
| Remote/provider scope | No remote database access or mutation; no deployment/provider/secret activity |

## Accepted and pending task ledger

| Task | State | Scope/evidence |
|---|---|---|
| `SS-BASE-001` | Complete and accepted | Evidence-backed baseline, all 197 IDs, preservation/risks/decisions, dependency plan and exact next task |
| `SS-BASE-CHK-001` | Complete and accepted | Baseline checkpoint committed at `ad6860bf7d1f4499b028b7b60dcf2910f29973a7` |
| `SS-BIZ-001` | Complete | Persisted product/service/mixed mode, atomic bootstrap, owner-only audited mutation, bilingual settings and mode-aware visibility; targeted SQL and Shop typecheck pass |
| All later packages | Proposed only | Ordered below; none started |

## Documentation authority

- Current authority: root/scoped `AGENTS.md`, `README.md`, `docs/shared/*`, ADR 0002, `docs/architecture/identity.md`, the app-owned migration chain and actual source/tests.
- Useful dated evidence: `apps/shop-suit/docs/readiness/02-*.md` through `11a-*.md`, `capabilities.md`, `plans.md`, and sanitized cloud snapshots.
- Historical evidence only: `apps/shop-suit/docs/rebuild/*`, `PATCHES/*`, `docs/source-repository-README.md`, and `supabase/legacy/shop-suit/*`.
- Disagreement rule: current source plus effective migrations/tests wins. A table, old plan, screenshot or historic “complete” claim does not prove a connected capability.

## Architecture and effective database baseline

Shop Suit is a separate Nuxt application under `apps/shop-suit`. Routes/pages and product orchestration live under `app/pages` and `app/composables`; there are no application server routes. The browser uses its own Supabase project’s `public` API through `@nuxtjs/supabase`. Product RPC typings are in `app/types/shopCrmRpc.ts`. Shared presentation and interaction behavior arrive through `@building-suit/nuxt-layer`, which composes `packages/ui`, `ux`, `auth`, `data-access`, `contracts`, `brand`, `design-tokens` and `i18n`.

Active database ownership is `apps/shop-suit/supabase`. The effective chain creates the historical `shop_crm` source contract, hardens it, relocates all business relations/views/client functions to `public`, preserves private helpers in `shop_private`, restores service-role compatibility grants, then adds the supported supplier-purchase workflow. Root `supabase/legacy/shop-suit` is provenance, not an active chain.

Effective local inventory after all four migrations:

- 25 public tables: tenancy/profile/roles, plans/subscriptions, products/services, clients/vendors, sales/purchases, FIFO inventory, payments, expenses/periods and the private-by-grant stock request ledger.
- 26 public views: `product_stock` plus 25 cash-flow, receivable/payable, COGS, margin, profit, aging, dead-stock and turnover foundations.
- 12 public enum types; 24 SELECT policies on the business tables; RLS enabled on every public Shop table.
- Supported browser mutations are invoker wrappers over fixed-search-path `shop_private` definer bodies for owner bootstrap, products, services, manual inventory, paid expenses and supplier purchases.
- Current costing policy is FIFO. Receipts create cost layers; write-offs lock the product and consume oldest remaining layers; purchase posting creates FIFO layers; cost snapshots are recorded on movements.
- Current subscription architecture is profile-owned Basic/Pro trial/period state. Owner subscription time gates supported writes; catalog caps are locked and enforced. Inventory is currently also gated by `features.inventory`, which must not be mistaken for business type.
- Sales/customers/payments/team/reports have substantial schema foundation but no supported connected end-to-end workflow. The legacy sale finalizer is revoked from browser roles and fails local lint.


## Evidence key

Evidence codes keep the 197-row matrix readable. Each code resolves to concrete repository or executed-command evidence.

### Repository and architecture

- **E1** — `README.md`; `apps/shop-suit/README.md`; `docs/architecture/decisions/0002-independent-supabase-projects.md`; `docs/architecture/identity.md`.
- **E2** — `apps/shop-suit/nuxt.config.ts:1-36` (public schema, product/environment cookie prefix, Arabic/English direction); `apps/shop-suit/package.json`; no server/API directory exists.
- **E3** — `apps/shop-suit/app/composables/useShop.ts:42-197` (portal/profile/membership validation, remembered authorized shop, shop-scoped cache clear and refetch); `apps/shop-suit/app/pages/auth/signup.vue:27-117`.
- **E4** — `apps/shop-suit/app/pages/products/index.vue:54-153`; `apps/shop-suit/app/types/shopCrmRpc.ts:11-25`.
- **E5** — `apps/shop-suit/app/pages/services/index.vue:57-169`; `apps/shop-suit/app/types/shopCrmRpc.ts:26-41`.
- **E6** — `apps/shop-suit/app/pages/inventory/index.vue:62-145`; `apps/shop-suit/app/types/shopCrmRpc.ts:59-69`.
- **E7** — `apps/shop-suit/app/pages/dashboard.vue:61-128`; `apps/shop-suit/app/layouts/default.vue:13-60`. There are no sales, customer, payment, team, reports or product-owned settings routes.
- **E8** — `apps/shop-suit/app/pages/purchases/index.vue:126-405`; `apps/shop-suit/app/types/shopCrmRpc.ts:70-98`.
- **E9** — `apps/shop-suit/app/pages/expenses/index.vue:70-215`; `apps/shop-suit/app/types/shopCrmRpc.ts:42-58`.
- **E10** — `apps/shop-suit/app/composables/usePlans.ts:1-34`; `apps/shop-suit/docs/readiness/plans.md`.
- **E11** — SS-BASE-001 attachment, this tracker, `docs/agent-workflows.md`, and applicable `AGENTS.md` files. The attachment enumerates IDs but does not contain the Pack V1 per-ID text.
- **E12** — `app/composables/useShop.ts`, `app/utils/businessMode.ts`, `app/middleware/business-mode.ts`, `app/layouts/default.vue`, `app/pages/auth/signup.vue`, `app/pages/dashboard.vue`, `app/pages/settings.vue` and `app/types/shopCrmRpc.ts`: connected mode loading, setup, owner settings, cache refresh and workflow visibility.

### Effective database

- **D1** — The complete four-file chain under `apps/shop-suit/supabase/migrations/`. Local catalog after applying all four versions: 25 public base tables, 26 public views, 24 public RLS policies, 28 public functions and 17 `shop_private` functions. Business objects are in `public`; helpers remain in `shop_private`.
- **D2** — `20260918213353_shop_source_baseline.sql:1302-1594`: active profile/membership/owner/permission helpers, replacement SELECT policies, revoked browser writes and invoker views. Effective policies were confirmed from `pg_policies`.
- **D3** — `20260918213353_shop_source_baseline.sql:1798-1847`: `shop_private.assert_shop_write_access` checks Auth, active profile/membership/shop, permission and owner subscription time.
- **D4** — `public.save_product`, `archive_product`, `save_service`, `archive_service` invoker wrappers with private checked bodies; active SKU and quota locks in `20260918213353_shop_source_baseline.sql:1775-1982` and following service section.
- **D5** — `public.product_stock`, `stock_adjustment_requests`, `public.adjust_stock`; FIFO batch locking, idempotent request UUIDs, insufficient-stock rejection and cost snapshots in `20260918213353_shop_source_baseline.sql:1987-2160`.
- **D6** — `public.save_expense` and `void_expense`; request UUID, same-shop category lock, closed-period checks and non-destructive voiding in the expense section of `20260918213353_shop_source_baseline.sql`.
- **D7** — `20260919091222_supplier_purchases.sql`: `create_vendor`, `create_supplier_purchase`, `void_supplier_purchase`, normalized request payload, posted immutability and FIFO receipt/reversal.
- **D8** — `public.issue_invoice_and_deduct_inventory` and related legacy sale helpers exist but remain unsupported/revoked from browser roles. Local SQL lint reports `where invoice_id - _invoice_id` as error 42883.
- **D9** — `public.payments`, balance/cash-flow/margin views and invoice/vendor links exist, but there is no supported browser payment command, allocation table, request key or payment UI.
- **D10** — `public.plans` and profile-owned `subscriptions`; `create_owner_shop` creates one trial. Basic/Pro values and `features.inventory`, `max_products`, `max_services` are current evidence only.
- **D11** — `20260923143306_operational_business_mode.sql`: constrained non-null `shops.business_mode`, compatibility `mixed` backfill/default, explicit-mode bootstrap, owner-only `set_shop_business_mode`, and append-only `shop_business_mode_changes`; no subscription, plan, quota or entitlement mutation.

### UI and verification

- **U1** — Shared app shell, theme/language control, bilingual auth/onboarding and shop selector are connected; business-mode/settings/team/report/sales navigation is absent.
- **U2** — Products, services, inventory, purchases and expenses use shared `BsDataTable`, `BsDialog` and record/confirmation controllers, but fixed query limits plus client filtering are not server pagination.
- **U3** — Auth signup/login/reset and owner bootstrap exist; custom SMTP and authenticated browser journeys are not verified.
- **U4** — No connected UI exists for sales, customers, receipts, supplier payments, team management, reports or business settings.
- **U5** — Shared `SettingsMenu` controls presentation preferences only; it is not Shop business/invoice/currency settings.
- **T1** — `pnpm db:test:shop` passed all seven active rollback suites against the already-current disposable local database. A separate rollback-only execution of the historical `shop_crm_read_isolation.sql` failed only at its superseded “no readable report view” assertion because current `product_stock` is deliberately authenticated-readable; the aborted transaction rolled back. No hosted database was touched.
- **T2** — `pnpm db shop-suit db lint --local --level warning` completed but reported one function error in `public.issue_invoice_and_deduct_inventory`.
- **T3** — Shop typecheck, Shop lint and Shop production build passed. Build/typecheck warned only that runtime Supabase URL/key were not supplied.
- **T4** — Authenticated browser journeys, mobile/a11y review, report reconciliation and remote deployment verification were not run.
- **T5** — `git diff --check`, matrix-ID validation and Markdown consistency checks are the baseline-document checks recorded below.
- **T6** — `shop_business_mode.sql` passed against the disposable local Shop database with rollback fixtures; Shop typecheck passed. Authenticated browser/mobile/RTL verification was not run because no reusable authenticated fixture exists.


## Requirement summary

| Status | Count |
|---|---:|
| `implemented` | 62 |
| `partially implemented` | 88 |
| `missing` | 39 |
| `unverified` | 8 |
| **Total** | **197** |

“Implemented” is used only for a bounded criterion supported by current source/database/tests or an explicit architecture boundary. Connected P0 capabilities remain partial when authenticated browser proof or required adjacent workflow is absent.

## Requirement matrix

### SCOPE

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| SCOPE-01 | Independent Shop Suit product | P0 / scope boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “Independent Shop Suit product”; preserve it while completing adjacent workflow. | Architecture boundaries; business-mode work for SCOPE-03..05 | Preserve independent Auth/project/session and no Ledger runtime dependency. |
| SCOPE-02 | Independent Shop subscription | P0 / scope boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “Independent Shop subscription”; preserve it while completing adjacent workflow. | Architecture boundaries; business-mode work for SCOPE-03..05 | Preserve independent Auth/project/session and no Ledger runtime dependency. |
| SCOPE-03 | Stocked-product business support | P0 / scope boundary | `partially implemented` | E1,E2,E12 | D1,D11 | U1 | T3,T6 | Product mode now exposes existing product/stock/purchase workflows independently of subscription; complete sales, customers and payments remain open. | SS-SAFE-001 then product workflow packages | Preserve independent Auth/project/session, entitlements and no Ledger runtime dependency. |
| SCOPE-04 | Service-only business support | P0 / scope boundary | `partially implemented` | E1,E2,E12 | D1,D11 | U1 | T3,T6 | Service mode operates with the service catalog and no stock records; complete service sales remain open. | SS-SAFE-001 then service sales packages | Mode visibility is not authorization and does not delete hidden history. |
| SCOPE-05 | Mixed product-and-service support | P0 / scope boundary | `partially implemented` | E1,E2,E12 | D1,D11 | U1 | T3,T6 | Mixed mode exposes both existing operational areas, but one product-plus-service customer transaction is not yet implemented. | SS-SAFE-001 then SS-SALE-001 | Do not claim mixed checkout from configuration alone. |
| SCOPE-06 | Operational records owned by Shop | P0 / scope boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “Operational records owned by Shop”; preserve it while completing adjacent workflow. | Architecture boundaries; business-mode work for SCOPE-03..05 | Preserve independent Auth/project/session and no Ledger runtime dependency. |
| SCOPE-07 | Formal accounting remains a future Ledger concern | P0 / scope boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “Formal accounting remains a future Ledger concern”; preserve it while completing adjacent workflow. | Architecture boundaries; business-mode work for SCOPE-03..05 | Preserve independent Auth/project/session and no Ledger runtime dependency. |
| SCOPE-08 | No ERP portal in this stream | P0 / scope boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “No ERP portal in this stream”; preserve it while completing adjacent workflow. | Architecture boundaries; business-mode work for SCOPE-03..05 | Preserve independent Auth/project/session and no Ledger runtime dependency. |
| SCOPE-09 | No cross-product SSO | P0 / scope boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “No cross-product SSO”; preserve it while completing adjacent workflow. | Architecture boundaries; business-mode work for SCOPE-03..05 | Preserve independent Auth/project/session and no Ledger runtime dependency. |
| SCOPE-10 | No Ledger connector or integration queue without contract | P0 / scope boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “No Ledger connector or integration queue without contract”; preserve it while completing adjacent workflow. | Architecture boundaries; business-mode work for SCOPE-03..05 | Preserve independent Auth/project/session and no Ledger runtime dependency. |

### BIZ

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| BIZ-01 | Support product, service-only and mixed businesses in one product | P0 / business configuration | `partially implemented` | E4,E5,E6,E12 | D1,D11 | U1,U2 | T1,T6 | All three modes are configured in one app; complete customer sales/payment workflows remain open. | SS-SAFE-001 then sales/customer/payment packages | One product and identity boundary; no mode-specific application fork. |
| BIZ-02 | Treat business type as workflow visibility, not a different application | P0 / business configuration | `implemented` | E12 | D11 | U1,U2 | T6 | One Shop app uses mode-aware navigation and safe direct-route feedback. | Preserve through later workflows | Visibility does not replace RLS, RPC permissions or entitlements. |
| BIZ-03 | Enable or disable irrelevant operational areas without losing history | P0 / business configuration | `implemented` | E12 | D11 | U1,U2 | T6 | Owner mode changes hide or reveal areas; SQL coverage preserves product, service, stock and purchase records. | Preserve through later workflows | Append-only audit records each actual transition; identical requests add no duplicate event. |
| BIZ-04 | Let a service-only business operate without stock records | P0 / business configuration | `partially implemented` | E5,E12 | D11 | U1,U2 | T6 | A service-mode shop creates and manages services with no product or stock row; service checkout remains open. | SS-SAFE-001 then SS-SALE-001 | No stock entitlement or stock record is created by service mode. |
| BIZ-05 | Support product operations across products, purchasing, stock, sales, customers, suppliers and payments | P0 / business configuration | `partially implemented` | E4,E6,E8,E12 | D5,D7,D11 | U1,U2,U4 | T1,T6 | Mode supports existing product, stock, supplier-purchase and expense areas; sales, customers and payments remain incomplete. | SS-SAFE-001 then customer/sales/payment packages | Product mode does not grant inventory entitlement. |
| BIZ-06 | Sell products and services in the same customer transaction for mixed businesses | P0 / business configuration | `partially implemented` | E12 | D11 | U1,U4 | T6 | Mixed configuration exposes both catalogs; a complete mixed-line sale command and checkout are not implemented. | SS-SAFE-001, SS-CUST-001, SS-SALE-001 | Do not claim mixed-sale execution from mode visibility. |
| BIZ-07 | Distinguish customer-sold products from stocked materials consumed during services | P0 / business configuration | `missing` | E4,E5 | D1 | U4 | T4 | Product and service catalogs remain separate, but service-material consumption has no approved command or workflow. | Future approved service-material package | No conflating model was introduced by SS-BIZ-001. |
| BIZ-08 | Allow service sales without a dedicated job/work-order module | P0 / business configuration | `implemented` | E5,E12 | D11 | U1,U2 | T6 | Service mode uses the existing service catalog and adds no job/work-order dependency. | Preserve through SS-SALE-001 | No job, work-order, Ledger or ERP objects were introduced. |

### TEN

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| TEN-01 | Select a current authorized shop | P0 / tenancy and identity | `partially implemented` | E2,E3 | D2,D3 | U1,U3 | T1,T4 | Only part/foundation of “Select a current authorized shop” is connected or tested; remaining workflow/browser scope is open. | SS-TEAM-001 for invitations and delegated workflows | Preserve portal/profile/membership separation and cache clearing. |
| TEN-02 | Validate active membership server-side | P0 / tenancy and identity | `implemented` | E2,E3 | D2,D3 | U1,U3 | T1,T4 | Bounded criterion evidenced for “Validate active membership server-side”; preserve it while completing adjacent workflow. | SS-TEAM-001 for invitations and delegated workflows | Preserve portal/profile/membership separation and cache clearing. |
| TEN-03 | Invalidate tenant data on shop switch | P0 / tenancy and identity | `partially implemented` | E2,E3 | D2,D3 | U1,U3 | T1,T4 | Only part/foundation of “Invalidate tenant data on shop switch” is connected or tested; remaining workflow/browser scope is open. | SS-TEAM-001 for invitations and delegated workflows | Preserve portal/profile/membership separation and cache clearing. |
| TEN-04 | Represent owner and delegated roles | P0 / tenancy and identity | `partially implemented` | E2,E3 | D2,D3 | U1,U3 | T1,T4 | Only part/foundation of “Represent owner and delegated roles” is connected or tested; remaining workflow/browser scope is open. | SS-TEAM-001 for invitations and delegated workflows | Preserve portal/profile/membership separation and cache clearing. |
| TEN-05 | Invite/join/onboard members | P0 / tenancy and identity | `partially implemented` | E2,E3 | D2,D3 | U1,U3 | T1,T4 | Only part/foundation of “Invite/join/onboard members” is connected or tested; remaining workflow/browser scope is open. | SS-TEAM-001 for invitations and delegated workflows | Preserve portal/profile/membership separation and cache clearing. |
| TEN-06 | Suspend or remove membership immediately | P0 / tenancy and identity | `partially implemented` | E2,E3 | D2,D3 | U1,U3 | T1,T4 | Only part/foundation of “Suspend or remove membership immediately” is connected or tested; remaining workflow/browser scope is open. | SS-TEAM-001 for invitations and delegated workflows | Preserve portal/profile/membership separation and cache clearing. |
| TEN-07 | Enforce active shop status | P0 / tenancy and identity | `implemented` | E2,E3 | D2,D3 | U1,U3 | T1,T4 | Bounded criterion evidenced for “Enforce active shop status”; preserve it while completing adjacent workflow. | SS-TEAM-001 for invitations and delegated workflows | Preserve portal/profile/membership separation and cache clearing. |
| TEN-08 | Own independent Shop Auth and sessions | P0 / tenancy and identity | `implemented` | E2,E3 | D2,D3 | U1,U3 | T1,T4 | Bounded criterion evidenced for “Own independent Shop Auth and sessions”; preserve it while completing adjacent workflow. | SS-TEAM-001 for invitations and delegated workflows | Preserve portal/profile/membership separation and cache clearing. |

### PROD

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| PROD-01 | List, search and paginate products | P0 / master data | `partially implemented` | E4 | D3,D4,D5 | U2 | T1,T4 | Only part/foundation of “List, search and paginate products” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-UX-001 for server pagination/browser proof | Preserve atomic RPCs, archive semantics and the existing product lock. |
| PROD-02 | Create and edit products | P0 / master data | `partially implemented` | E4 | D3,D4,D5 | U2 | T1,T4 | Only part/foundation of “Create and edit products” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-UX-001 for server pagination/browser proof | Preserve atomic RPCs, archive semantics and the existing product lock. |
| PROD-03 | Archive products without losing history | P0 / master data | `partially implemented` | E4 | D3,D4,D5 | U2 | T1,T4 | Only part/foundation of “Archive products without losing history” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-UX-001 for server pagination/browser proof | Preserve atomic RPCs, archive semantics and the existing product lock. |
| PROD-04 | Store SKU and barcode | P0 / master data | `partially implemented` | E4 | D3,D4,D5 | U2 | T1,T4 | Only part/foundation of “Store SKU and barcode” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-UX-001 for server pagination/browser proof | Preserve atomic RPCs, archive semantics and the existing product lock. |
| PROD-05 | Enforce active code uniqueness | P0 / master data | `partially implemented` | E4 | D3,D4,D5 | U2 | T1,T4 | Only part/foundation of “Enforce active code uniqueness” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-UX-001 for server pagination/browser proof | Preserve atomic RPCs, archive semantics and the existing product lock. |
| PROD-06 | Connect products to inventory history | P0 / master data | `partially implemented` | E4 | D3,D4,D5 | U2 | T1,T4 | Only part/foundation of “Connect products to inventory history” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-UX-001 for server pagination/browser proof | Preserve atomic RPCs, archive semantics and the existing product lock. |
| PROD-07 | Enforce product permissions in Postgres | P0 / master data | `implemented` | E4 | D3,D4,D5 | U2 | T1,T4 | Bounded criterion evidenced for “Enforce product permissions in Postgres”; preserve it while completing adjacent workflow. | SS-BIZ-001; SS-UX-001 for server pagination/browser proof | Preserve atomic RPCs, archive semantics and the existing product lock. |
| PROD-08 | Enforce product quotas atomically | P0 / master data | `implemented` | E4 | D3,D4,D5 | U2 | T1,T4 | Bounded criterion evidenced for “Enforce product quotas atomically”; preserve it while completing adjacent workflow. | SS-BIZ-001; SS-UX-001 for server pagination/browser proof | Preserve atomic RPCs, archive semantics and the existing product lock. |

### SERV

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| SERV-01 | List, search and paginate services | P0 / master data | `partially implemented` | E5 | D3,D4 | U2 | T1,T4 | Only part/foundation of “List, search and paginate services” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-SALE-001; later material policy | Preserve inventory-independent service catalog and validated discounts. |
| SERV-02 | Create, edit and archive services | P0 / master data | `partially implemented` | E5 | D3,D4 | U2 | T1,T4 | Only part/foundation of “Create, edit and archive services” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-SALE-001; later material policy | Preserve inventory-independent service catalog and validated discounts. |
| SERV-03 | Validate price and default discount | P0 / master data | `implemented` | E5 | D3,D4 | U2 | T1,T4 | Bounded criterion evidenced for “Validate price and default discount”; preserve it while completing adjacent workflow. | SS-BIZ-001; SS-SALE-001; later material policy | Preserve inventory-independent service catalog and validated discounts. |
| SERV-04 | Sell services without inventory | P0 / master data | `missing` | E5 | D3,D4 | U2 | T1,T4 | No supported connected “Sell services without inventory” workflow exists. | SS-BIZ-001; SS-SALE-001; later material policy | Preserve inventory-independent service catalog and validated discounts. |
| SERV-05 | Optionally model service material consumption | P0 / master data | `missing` | E5 | D3,D4 | U2 | T1,T4 | No supported connected “Optionally model service material consumption” workflow exists. | SS-BIZ-001; SS-SALE-001; SS-SERV-002 after material policy approval | Preserve inventory-independent service catalog and validated discounts. |
| SERV-06 | Enforce service permissions in Postgres | P0 / master data | `implemented` | E5 | D3,D4 | U2 | T1,T4 | Bounded criterion evidenced for “Enforce service permissions in Postgres”; preserve it while completing adjacent workflow. | SS-BIZ-001; SS-SALE-001; later material policy | Preserve inventory-independent service catalog and validated discounts. |
| SERV-07 | Enforce service quotas atomically | P0 / master data | `implemented` | E5 | D3,D4 | U2 | T1,T4 | Bounded criterion evidenced for “Enforce service quotas atomically”; preserve it while completing adjacent workflow. | SS-BIZ-001; SS-SALE-001; later material policy | Preserve inventory-independent service catalog and validated discounts. |

### SALE

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| SALE-01 | Sell product lines | P0 / sales | `partially implemented` | E7 | D1,D8,D9 | U4 | T2,T4 | Only part/foundation of “Sell product lines” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001 | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |
| SALE-02 | Sell service lines | P0 / sales | `missing` | E7 | D1,D8,D9 | U4 | T2,T4 | No supported connected “Sell service lines” workflow exists. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001 | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |
| SALE-03 | Support approved custom/manual lines | P0 / sales | `partially implemented` | E7 | D1,D8,D9 | U4 | T2,T4 | Only part/foundation of “Support approved custom/manual lines” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001; SS-SALE-002 after policy approval | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |
| SALE-04 | Support draft and finalized lifecycle | P0 / sales | `partially implemented` | E7 | D1,D8,D9 | U4 | T2,T4 | Only part/foundation of “Support draft and finalized lifecycle” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001 | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |
| SALE-05 | Calculate totals and discounts authoritatively | P0 / sales | `partially implemented` | E7 | D1,D8,D9 | U4 | T2,T4 | Only part/foundation of “Calculate totals and discounts authoritatively” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001 | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |
| SALE-06 | Deduct FIFO stock on issue | P0 / sales | `missing` | E7 | D1,D8,D9 | U4 | T2,T4 | No supported connected “Deduct FIFO stock on issue” workflow exists. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001 | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |
| SALE-07 | Finalize sale atomically | P0 / sales | `missing` | E7 | D1,D8,D9 | U4 | T2,T4 | No supported connected “Finalize sale atomically” workflow exists. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001 | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |
| SALE-08 | Make finalization retry-safe | P0 / sales | `missing` | E7 | D1,D8,D9 | U4 | T2,T4 | No supported connected “Make finalization retry-safe” workflow exists. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001 | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |
| SALE-09 | Apply customer optionality and credit-sale rules | P0 / sales | `unverified` | E7 | D1,D8,D9 | U4 | T2,T4 | Exact Pack wording or safe evidence for “Apply customer optionality and credit-sale rules” is unavailable; no policy inferred. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001 | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |
| SALE-10 | Generate race-safe document numbers | P0 / sales | `partially implemented` | E7 | D1,D8,D9 | U4 | T2,T4 | Only part/foundation of “Generate race-safe document numbers” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001 | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |
| SALE-11 | Search and inspect sale history | P0 / sales | `missing` | E7 | D1,D8,D9 | U4 | T2,T4 | No supported connected “Search and inspect sale history” workflow exists. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001 | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |
| SALE-12 | Print or share a receipt/invoice | P0 / sales | `missing` | E7 | D1,D8,D9 | U4 | T2,T4 | No supported connected “Print or share a receipt/invoice” workflow exists. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001; SS-SALE-002 after policy approval | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |
| SALE-13 | Record sale payments | P0 / sales | `missing` | E7 | D1,D8,D9 | U4 | T2,T4 | No supported connected “Record sale payments” workflow exists. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001 | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |
| SALE-14 | Void, correct, refund or return sales traceably | P0 / sales | `partially implemented` | E7 | D1,D8,D9 | U4 | T2,T4 | Only part/foundation of “Void, correct, refund or return sales traceably” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001; SS-SALE-002 after policy approval | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |
| SALE-15 | Apply approved VAT/tax behavior | P0 / sales | `missing` | E7 | D1,D8,D9 | U4 | T2,T4 | No supported connected “Apply approved VAT/tax behavior” workflow exists. | SS-BIZ-001; SS-SAFE-001; SS-CUST-001; SS-SALE-001; SS-PAY-001; SS-SALE-002 after policy approval | Do not call the revoked/broken legacy finalizer; preserve immutable issued-document history. |

### CUST

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| CUST-01 | Create, edit, archive and search customers | P0 / customers and receivables | `partially implemented` | E7 | D1,D9 | U4 | T4 | Only part/foundation of “Create, edit, archive and search customers” is connected or tested; remaining workflow/browser scope is open. | SS-CUST-001 then SS-PAY-001 | Keep client snapshots and receivable history; no payment-policy defaults are approved. |
| CUST-02 | Store customer contact data | P0 / customers and receivables | `partially implemented` | E7 | D1,D9 | U4 | T4 | Only part/foundation of “Store customer contact data” is connected or tested; remaining workflow/browser scope is open. | SS-CUST-001 then SS-PAY-001 | Keep client snapshots and receivable history; no payment-policy defaults are approved. |
| CUST-03 | Snapshot customer identity on documents | P0 / customers and receivables | `partially implemented` | E7 | D1,D9 | U4 | T4 | Only part/foundation of “Snapshot customer identity on documents” is connected or tested; remaining workflow/browser scope is open. | SS-CUST-001 then SS-PAY-001 | Keep client snapshots and receivable history; no payment-policy defaults are approved. |
| CUST-04 | Derive outstanding customer balance | P0 / customers and receivables | `partially implemented` | E7 | D1,D9 | U4 | T4 | Only part/foundation of “Derive outstanding customer balance” is connected or tested; remaining workflow/browser scope is open. | SS-CUST-001 then SS-PAY-001 | Keep client snapshots and receivable history; no payment-policy defaults are approved. |
| CUST-05 | Support partial and multiple receipts | P0 / customers and receivables | `partially implemented` | E7 | D1,D9 | U4 | T4 | Only part/foundation of “Support partial and multiple receipts” is connected or tested; remaining workflow/browser scope is open. | SS-CUST-001 then SS-PAY-001 | Keep client snapshots and receivable history; no payment-policy defaults are approved. |
| CUST-06 | Provide customer statements | P0 / customers and receivables | `missing` | E7 | D1,D9 | U4 | T4 | No supported connected “Provide customer statements” workflow exists. | SS-CUST-001 then SS-PAY-001 | Keep client snapshots and receivable history; no payment-policy defaults are approved. |
| CUST-07 | Represent due dates | P0 / customers and receivables | `missing` | E7 | D1,D9 | U4 | T4 | No supported connected “Represent due dates” workflow exists. | SS-CUST-001 then SS-PAY-001 | Keep client snapshots and receivable history; no payment-policy defaults are approved. |
| CUST-08 | Identify overdue balances | P0 / customers and receivables | `missing` | E7 | D1,D9 | U4 | T4 | No supported connected “Identify overdue balances” workflow exists. | SS-CUST-001 then SS-PAY-001 | Keep client snapshots and receivable history; no payment-policy defaults are approved. |
| CUST-09 | Trace receipts to documents and actor | P0 / customers and receivables | `partially implemented` | E7 | D1,D9 | U4 | T4 | Only part/foundation of “Trace receipts to documents and actor” is connected or tested; remaining workflow/browser scope is open. | SS-CUST-001 then SS-PAY-001 | Keep client snapshots and receivable history; no payment-policy defaults are approved. |
| CUST-10 | Handle overpayment, unallocated receipt and reversal policy | P0 / customers and receivables | `unverified` | E7 | D1,D9 | U4 | T4 | Exact Pack wording or safe evidence for “Handle overpayment, unallocated receipt and reversal policy” is unavailable; no policy inferred. | SS-CUST-001 then SS-PAY-001 | Keep client snapshots and receivable history; no payment-policy defaults are approved. |

### PUR

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| PUR-01 | Create, edit, archive and search suppliers | P0 / purchasing and payables | `partially implemented` | E8 | D3,D5,D7,D9 | U2 | T1,T4 | Only part/foundation of “Create, edit, archive and search suppliers” is connected or tested; remaining workflow/browser scope is open. | SS-PUR-002 after SS-PAY-001 | Preserve request payload idempotency, posted immutability and FIFO batches. |
| PUR-02 | Record and post supplier purchases | P0 / purchasing and payables | `partially implemented` | E8 | D3,D5,D7,D9 | U2 | T1,T4 | Only part/foundation of “Record and post supplier purchases” is connected or tested; remaining workflow/browser scope is open. | SS-PUR-002 after SS-PAY-001 | Preserve request payload idempotency, posted immutability and FIFO batches. |
| PUR-03 | Increase stock atomically from receipts | P0 / purchasing and payables | `partially implemented` | E8 | D3,D5,D7,D9 | U2 | T1,T4 | Only part/foundation of “Increase stock atomically from receipts” is connected or tested; remaining workflow/browser scope is open. | SS-PUR-002 after SS-PAY-001 | Preserve request payload idempotency, posted immutability and FIFO batches. |
| PUR-04 | Create FIFO acquisition cost layers | P0 / purchasing and payables | `implemented` | E8 | D3,D5,D7,D9 | U2 | T1,T4 | Bounded criterion evidenced for “Create FIFO acquisition cost layers”; preserve it while completing adjacent workflow. | SS-PUR-002 after SS-PAY-001 | Preserve request payload idempotency, posted immutability and FIFO batches. |
| PUR-05 | Represent supplier credit/payable balance | P0 / purchasing and payables | `partially implemented` | E8 | D3,D5,D7,D9 | U2 | T1,T4 | Only part/foundation of “Represent supplier credit/payable balance” is connected or tested; remaining workflow/browser scope is open. | SS-PUR-002 after SS-PAY-001 | Preserve request payload idempotency, posted immutability and FIFO batches. |
| PUR-06 | Support partial and multiple supplier payments | P0 / purchasing and payables | `partially implemented` | E8 | D3,D5,D7,D9 | U2 | T1,T4 | Only part/foundation of “Support partial and multiple supplier payments” is connected or tested; remaining workflow/browser scope is open. | SS-PUR-002 after SS-PAY-001 | Preserve request payload idempotency, posted immutability and FIFO batches. |
| PUR-07 | List, filter and inspect purchases | P0 / purchasing and payables | `partially implemented` | E8 | D3,D5,D7,D9 | U2 | T1,T4 | Only part/foundation of “List, filter and inspect purchases” is connected or tested; remaining workflow/browser scope is open. | SS-PUR-002 after SS-PAY-001 | Preserve request payload idempotency, posted immutability and FIFO batches. |
| PUR-08 | Make purchase posting retry-safe | P0 / purchasing and payables | `implemented` | E8 | D3,D5,D7,D9 | U2 | T1,T4 | Bounded criterion evidenced for “Make purchase posting retry-safe”; preserve it while completing adjacent workflow. | SS-PUR-002 after SS-PAY-001 | Preserve request payload idempotency, posted immutability and FIFO batches. |
| PUR-09 | Return or void purchases traceably | P0 / purchasing and payables | `partially implemented` | E8 | D3,D5,D7,D9 | U2 | T1,T4 | Only part/foundation of “Return or void purchases traceably” is connected or tested; remaining workflow/browser scope is open. | SS-PUR-002 after SS-PAY-001 | Preserve request payload idempotency, posted immutability and FIFO batches. |
| PUR-10 | Preserve supplier snapshot and history | P0 / purchasing and payables | `implemented` | E8 | D3,D5,D7,D9 | U2 | T1,T4 | Bounded criterion evidenced for “Preserve supplier snapshot and history”; preserve it while completing adjacent workflow. | SS-PUR-002 after SS-PAY-001 | Preserve request payload idempotency, posted immutability and FIFO batches. |
| PUR-11 | Generate safe purchase document numbers | P0 / purchasing and payables | `missing` | E8 | D3,D5,D7,D9 | U2 | T1,T4 | No supported connected “Generate safe purchase document numbers” workflow exists. | SS-PUR-002 after SS-PAY-001 | Preserve request payload idempotency, posted immutability and FIFO batches. |
| PUR-12 | Enforce tenant, permission and closed-period rules | P0 / purchasing and payables | `implemented` | E8 | D3,D5,D7,D9 | U2 | T1,T4 | Bounded criterion evidenced for “Enforce tenant, permission and closed-period rules”; preserve it while completing adjacent workflow. | SS-PUR-002 after SS-PAY-001 | Preserve request payload idempotency, posted immutability and FIFO batches. |

### STOCK

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| STOCK-01 | Maintain inventory batches | P0 / inventory | `implemented` | E6,E8 | D5,D7,D8 | U2 | T1,T2,T4 | Bounded criterion evidenced for “Maintain inventory batches”; preserve it while completing adjacent workflow. | SS-SALE-001; SS-STOCK-002 | Current verified costing is FIFO. Do not change costing without an explicit decision. |
| STOCK-02 | Maintain immutable inventory movements | P0 / inventory | `implemented` | E6,E8 | D5,D7,D8 | U2 | T1,T2,T4 | Bounded criterion evidenced for “Maintain immutable inventory movements”; preserve it while completing adjacent workflow. | SS-SALE-001; SS-STOCK-002 | Current verified costing is FIFO. Do not change costing without an explicit decision. |
| STOCK-03 | Derive stock on hand from batches | P0 / inventory | `implemented` | E6,E8 | D5,D7,D8 | U2 | T1,T2,T4 | Bounded criterion evidenced for “Derive stock on hand from batches”; preserve it while completing adjacent workflow. | SS-SALE-001; SS-STOCK-002 | Current verified costing is FIFO. Do not change costing without an explicit decision. |
| STOCK-04 | Receive inventory | P0 / inventory | `implemented` | E6,E8 | D5,D7,D8 | U2 | T1,T2,T4 | Bounded criterion evidenced for “Receive inventory”; preserve it while completing adjacent workflow. | SS-SALE-001; SS-STOCK-002 | Current verified costing is FIFO. Do not change costing without an explicit decision. |
| STOCK-05 | Deduct stock from sales | P0 / inventory | `missing` | E6,E8 | D5,D7,D8 | U2 | T1,T2,T4 | No supported connected “Deduct stock from sales” workflow exists. | SS-SALE-001; SS-STOCK-002 | Current verified costing is FIFO. Do not change costing without an explicit decision. |
| STOCK-06 | Restore stock for returns | P0 / inventory | `missing` | E6,E8 | D5,D7,D8 | U2 | T1,T2,T4 | No supported connected “Restore stock for returns” workflow exists. | SS-SALE-001; SS-STOCK-002 | Current verified costing is FIFO. Do not change costing without an explicit decision. |
| STOCK-07 | Record manual adjustments | P0 / inventory | `implemented` | E6,E8 | D5,D7,D8 | U2 | T1,T2,T4 | Bounded criterion evidenced for “Record manual adjustments”; preserve it while completing adjacent workflow. | SS-SALE-001; SS-STOCK-002 | Current verified costing is FIFO. Do not change costing without an explicit decision. |
| STOCK-08 | Record reasoned write-offs | P0 / inventory | `implemented` | E6,E8 | D5,D7,D8 | U2 | T1,T2,T4 | Bounded criterion evidenced for “Record reasoned write-offs”; preserve it while completing adjacent workflow. | SS-SALE-001; SS-STOCK-002 | Current verified costing is FIFO. Do not change costing without an explicit decision. |
| STOCK-09 | Perform stock counts | P0 / inventory | `missing` | E6,E8 | D5,D7,D8 | U2 | T1,T2,T4 | No supported connected “Perform stock counts” workflow exists. | SS-SALE-001; SS-STOCK-002 | Current verified costing is FIFO. Do not change costing without an explicit decision. |
| STOCK-10 | Keep reasons and source references | P0 / inventory | `partially implemented` | E6,E8 | D5,D7,D8 | U2 | T1,T2,T4 | Only part/foundation of “Keep reasons and source references” is connected or tested; remaining workflow/browser scope is open. | SS-SALE-001; SS-STOCK-002 | Current verified costing is FIFO. Do not change costing without an explicit decision. |
| STOCK-11 | Prevent unintended negative stock | P0 / inventory | `partially implemented` | E6,E8 | D5,D7,D8 | U2 | T1,T2,T4 | Only part/foundation of “Prevent unintended negative stock” is connected or tested; remaining workflow/browser scope is open. | SS-SALE-001; SS-STOCK-002 | Current verified costing is FIFO. Do not change costing without an explicit decision. |
| STOCK-12 | Serialize concurrent stock mutation | P0 / inventory | `partially implemented` | E6,E8 | D5,D7,D8 | U2 | T1,T2,T4 | Only part/foundation of “Serialize concurrent stock mutation” is connected or tested; remaining workflow/browser scope is open. | SS-SALE-001; SS-STOCK-002 | Current verified costing is FIFO. Do not change costing without an explicit decision. |
| STOCK-13 | Configure low-stock thresholds | P0 / inventory | `missing` | E6,E8 | D5,D7,D8 | U2 | T1,T2,T4 | No supported connected “Configure low-stock thresholds” workflow exists. | SS-SALE-001; SS-STOCK-002 | Current verified costing is FIFO. Do not change costing without an explicit decision. |
| STOCK-14 | Report FIFO valuation and preserve costing policy | P0 / inventory | `partially implemented` | E6,E8 | D5,D7,D8 | U2 | T1,T2,T4 | Only part/foundation of “Report FIFO valuation and preserve costing policy” is connected or tested; remaining workflow/browser scope is open. | SS-SALE-001; SS-STOCK-002 | Current verified costing is FIFO. Do not change costing without an explicit decision. |

### EXP

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| EXP-01 | Create paid expenses | P0 / expenses | `partially implemented` | E9 | D3,D6 | U2 | T1,T4 | Only part/foundation of “Create paid expenses” is connected or tested; remaining workflow/browser scope is open. | SS-EXP-002; SS-UX-001 | Preserve request IDs, closed-period checks and non-destructive voiding. |
| EXP-02 | Capture category, date, note and status | P0 / expenses | `partially implemented` | E9 | D3,D6 | U2 | T1,T4 | Only part/foundation of “Capture category, date, note and status” is connected or tested; remaining workflow/browser scope is open. | SS-EXP-002; SS-UX-001 | Preserve request IDs, closed-period checks and non-destructive voiding. |
| EXP-03 | Search, filter and paginate expense history | P0 / expenses | `partially implemented` | E9 | D3,D6 | U2 | T1,T4 | Only part/foundation of “Search, filter and paginate expense history” is connected or tested; remaining workflow/browser scope is open. | SS-EXP-002; SS-UX-001 | Preserve request IDs, closed-period checks and non-destructive voiding. |
| EXP-04 | Correct and void expenses traceably | P0 / expenses | `partially implemented` | E9 | D3,D6 | U2 | T1,T4 | Only part/foundation of “Correct and void expenses traceably” is connected or tested; remaining workflow/browser scope is open. | SS-EXP-002; SS-UX-001 | Preserve request IDs, closed-period checks and non-destructive voiding. |
| EXP-05 | Make expense creation retry-safe | P0 / expenses | `implemented` | E9 | D3,D6 | U2 | T1,T4 | Bounded criterion evidenced for “Make expense creation retry-safe”; preserve it while completing adjacent workflow. | SS-EXP-002; SS-UX-001 | Preserve request IDs, closed-period checks and non-destructive voiding. |
| EXP-06 | Represent approved other operational income | P0 / expenses | `missing` | E9 | D3,D6 | U2 | T1,T4 | No supported connected “Represent approved other operational income” workflow exists. | SS-EXP-002; SS-UX-001 | Preserve request IDs, closed-period checks and non-destructive voiding. |

### PAY

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| PAY-01 | Use one coherent operational payment model | P0 / operational payments | `partially implemented` | E7,E8 | D9 | U4 | T4 | Only part/foundation of “Use one coherent operational payment model” is connected or tested; remaining workflow/browser scope is open. | SS-PAY-001 and SS-PUR-002 | The payments table is foundation only; do not expose legacy direct writes. |
| PAY-02 | Record customer receipts | P0 / operational payments | `missing` | E7,E8 | D9 | U4 | T4 | No supported connected “Record customer receipts” workflow exists. | SS-PAY-001 and SS-PUR-002 | The payments table is foundation only; do not expose legacy direct writes. |
| PAY-03 | Record supplier payments | P0 / operational payments | `missing` | E7,E8 | D9 | U4 | T4 | No supported connected “Record supplier payments” workflow exists. | SS-PAY-001 and SS-PUR-002 | The payments table is foundation only; do not expose legacy direct writes. |
| PAY-04 | Capture amount, date, method, reference, status and actor | P0 / operational payments | `partially implemented` | E7,E8 | D9 | U4 | T4 | Only part/foundation of “Capture amount, date, method, reference, status and actor” is connected or tested; remaining workflow/browser scope is open. | SS-PAY-001 and SS-PUR-002 | The payments table is foundation only; do not expose legacy direct writes. |
| PAY-05 | Allocate payments consistently to balances | P0 / operational payments | `partially implemented` | E7,E8 | D9 | U4 | T4 | Only part/foundation of “Allocate payments consistently to balances” is connected or tested; remaining workflow/browser scope is open. | SS-PAY-001 and SS-PUR-002 | The payments table is foundation only; do not expose legacy direct writes. |
| PAY-06 | Reverse or refund payments idempotently | P0 / operational payments | `missing` | E7,E8 | D9 | U4 | T4 | No supported connected “Reverse or refund payments idempotently” workflow exists. | SS-PAY-001 and SS-PUR-002 | The payments table is foundation only; do not expose legacy direct writes. |

### TEAM

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| TEAM-01 | Provide team-management UI | P0 / team and authorization | `missing` | E3,E7 | D2,D3 | U4 | T1,T4 | No supported connected “Provide team-management UI” workflow exists. | SS-TEAM-001 after core commands stabilize | Owner-only UI shortcuts currently block otherwise modelled delegation. |
| TEAM-02 | Issue secure invitations | P0 / team and authorization | `missing` | E3,E7 | D2,D3 | U4 | T1,T4 | No supported connected “Issue secure invitations” workflow exists. | SS-TEAM-001 after core commands stabilize | Owner-only UI shortcuts currently block otherwise modelled delegation. |
| TEAM-03 | Track membership states | P0 / team and authorization | `partially implemented` | E3,E7 | D2,D3 | U4 | T1,T4 | Only part/foundation of “Track membership states” is connected or tested; remaining workflow/browser scope is open. | SS-TEAM-001 after core commands stabilize | Owner-only UI shortcuts currently block otherwise modelled delegation. |
| TEAM-04 | Assign roles and permissions | P0 / team and authorization | `partially implemented` | E3,E7 | D2,D3 | U4 | T1,T4 | Only part/foundation of “Assign roles and permissions” is connected or tested; remaining workflow/browser scope is open. | SS-TEAM-001 after core commands stabilize | Owner-only UI shortcuts currently block otherwise modelled delegation. |
| TEAM-05 | Enable valid delegated staff workflows | P0 / team and authorization | `missing` | E3,E7 | D2,D3 | U4 | T1,T4 | No supported connected “Enable valid delegated staff workflows” workflow exists. | SS-TEAM-001 after core commands stabilize | Owner-only UI shortcuts currently block otherwise modelled delegation. |
| TEAM-06 | Enforce permissions in RLS/RPCs | P0 / team and authorization | `partially implemented` | E3,E7 | D2,D3 | U4 | T1,T4 | Only part/foundation of “Enforce permissions in RLS/RPCs” is connected or tested; remaining workflow/browser scope is open. | SS-TEAM-001 after core commands stabilize | Owner-only UI shortcuts currently block otherwise modelled delegation. |
| TEAM-07 | Suspend or remove members immediately | P0 / team and authorization | `partially implemented` | E3,E7 | D2,D3 | U4 | T1,T4 | Only part/foundation of “Suspend or remove members immediately” is connected or tested; remaining workflow/browser scope is open. | SS-TEAM-001 after core commands stabilize | Owner-only UI shortcuts currently block otherwise modelled delegation. |
| TEAM-08 | Protect owner continuity | P0 / team and authorization | `missing` | E3,E7 | D2,D3 | U4 | T1,T4 | No supported connected “Protect owner continuity” workflow exists. | SS-TEAM-001 after core commands stabilize | Owner-only UI shortcuts currently block otherwise modelled delegation. |
| TEAM-09 | Audit sensitive team actions | P0 / team and authorization | `missing` | E3,E7 | D2,D3 | U4 | T1,T4 | No supported connected “Audit sensitive team actions” workflow exists. | SS-TEAM-001 after core commands stabilize | Owner-only UI shortcuts currently block otherwise modelled delegation. |

### RPT

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| RPT-01 | Show an operational dashboard | P0 / dashboard and reporting | `partially implemented` | E7 | D1,D9 | U1,U4 | T4 | Only part/foundation of “Show an operational dashboard” is connected or tested; remaining workflow/browser scope is open. | SS-RPT-001 after sales/payments/returns | Twenty-six invoker views are schema foundation only and have no browser grants except product_stock. |
| RPT-02 | Report sales/revenue | P0 / dashboard and reporting | `partially implemented` | E7 | D1,D9 | U1,U4 | T4 | Only part/foundation of “Report sales/revenue” is connected or tested; remaining workflow/browser scope is open. | SS-RPT-001 after sales/payments/returns | Twenty-six invoker views are schema foundation only and have no browser grants except product_stock. |
| RPT-03 | Report expenses | P0 / dashboard and reporting | `partially implemented` | E7 | D1,D9 | U1,U4 | T4 | Only part/foundation of “Report expenses” is connected or tested; remaining workflow/browser scope is open. | SS-RPT-001 after sales/payments/returns | Twenty-six invoker views are schema foundation only and have no browser grants except product_stock. |
| RPT-04 | Report gross margin and COGS | P0 / dashboard and reporting | `partially implemented` | E7 | D1,D9 | U1,U4 | T4 | Only part/foundation of “Report gross margin and COGS” is connected or tested; remaining workflow/browser scope is open. | SS-RPT-001 after sales/payments/returns | Twenty-six invoker views are schema foundation only and have no browser grants except product_stock. |
| RPT-05 | Report net profit | P0 / dashboard and reporting | `partially implemented` | E7 | D1,D9 | U1,U4 | T4 | Only part/foundation of “Report net profit” is connected or tested; remaining workflow/browser scope is open. | SS-RPT-001 after sales/payments/returns | Twenty-six invoker views are schema foundation only and have no browser grants except product_stock. |
| RPT-06 | Report cash flow | P0 / dashboard and reporting | `partially implemented` | E7 | D1,D9 | U1,U4 | T4 | Only part/foundation of “Report cash flow” is connected or tested; remaining workflow/browser scope is open. | SS-RPT-001 after sales/payments/returns | Twenty-six invoker views are schema foundation only and have no browser grants except product_stock. |
| RPT-07 | Report customer receivables | P0 / dashboard and reporting | `partially implemented` | E7 | D1,D9 | U1,U4 | T4 | Only part/foundation of “Report customer receivables” is connected or tested; remaining workflow/browser scope is open. | SS-RPT-001 after sales/payments/returns | Twenty-six invoker views are schema foundation only and have no browser grants except product_stock. |
| RPT-08 | Report supplier payables | P0 / dashboard and reporting | `partially implemented` | E7 | D1,D9 | U1,U4 | T4 | Only part/foundation of “Report supplier payables” is connected or tested; remaining workflow/browser scope is open. | SS-RPT-001 after sales/payments/returns | Twenty-six invoker views are schema foundation only and have no browser grants except product_stock. |
| RPT-09 | Drill through to source records | P0 / dashboard and reporting | `missing` | E7 | D1,D9 | U1,U4 | T4 | No supported connected “Drill through to source records” workflow exists. | SS-RPT-001 after sales/payments/returns | Twenty-six invoker views are schema foundation only and have no browser grants except product_stock. |
| RPT-10 | Export report data | P0 / dashboard and reporting | `missing` | E7 | D1,D9 | U1,U4 | T4 | No supported connected “Export report data” workflow exists. | SS-RPT-001 after sales/payments/returns | Twenty-six invoker views are schema foundation only and have no browser grants except product_stock. |
| RPT-11 | Reconcile reports to operational records | P0 / dashboard and reporting | `unverified` | E7 | D1,D9 | U1,U4 | T4 | Exact Pack wording or safe evidence for “Reconcile reports to operational records” is unavailable; no policy inferred. | SS-RPT-001 after sales/payments/returns | Twenty-six invoker views are schema foundation only and have no browser grants except product_stock. |
| RPT-12 | Compute full-history results with safe pagination | P0 / dashboard and reporting | `missing` | E7 | D1,D9 | U1,U4 | T4 | No supported connected “Compute full-history results with safe pagination” workflow exists. | SS-RPT-001 after sales/payments/returns | Twenty-six invoker views are schema foundation only and have no browser grants except product_stock. |

### SUB

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| SUB-01 | Represent trial and subscription lifecycle | P0 / subscriptions and quotas | `partially implemented` | E3,E7,E10 | D3,D6 | U1,U3 | T1,T4 | Only part/foundation of “Represent trial and subscription lifecycle” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-SUB-001; commercial decisions | Basic/Pro values and product/service caps are provisional evidence, not approved policy. |
| SUB-02 | Use approved plan names, prices and terms | P0 / subscriptions and quotas | `unverified` | E3,E7,E10 | D3,D6 | U1,U3 | T1,T4 | Exact Pack wording or safe evidence for “Use approved plan names, prices and terms” is unavailable; no policy inferred. | SS-BIZ-001; SS-SUB-001; commercial decisions | Basic/Pro values and product/service caps are provisional evidence, not approved policy. |
| SUB-03 | Keep operational business mode separate from subscription entitlements | P0 / subscriptions and quotas | `implemented` | E10,E12 | D10,D11 | U1,U3 | T6 | Mode create/change leaves the subscription row, quotas and `features.inventory` unchanged. | Preserve through SS-SUB-001 | Showing a workflow never grants its paid entitlement or bypasses its write checks. |
| SUB-04 | Treat Basic/Pro values and inventory gating as provisional evidence, not approved final terms | P0 / subscriptions and quotas | `implemented` | E10,E12 | D10,D11 | U1,U3 | T6 | SS-BIZ-001 neither redesigns nor treats existing names, prices, quotas or inventory gating as approved final policy. | SS-SUB-001 plus commercial decisions | Exact commercial terms remain product-owner decisions. |
| SUB-05 | Enforce write access and quotas in Postgres | P0 / subscriptions and quotas | `partially implemented` | E3,E7,E10 | D3,D6 | U1,U3 | T1,T4 | Only part/foundation of “Enforce write access and quotas in Postgres” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-SUB-001; commercial decisions | Basic/Pro values and product/service caps are provisional evidence, not approved policy. |
| SUB-06 | Serialize concurrent quota consumption | P0 / subscriptions and quotas | `partially implemented` | E3,E7,E10 | D3,D6 | U1,U3 | T1,T4 | Only part/foundation of “Serialize concurrent quota consumption” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-SUB-001; commercial decisions | Basic/Pro values and product/service caps are provisional evidence, not approved policy. |
| SUB-07 | Keep retries from double-consuming usage | P0 / subscriptions and quotas | `partially implemented` | E3,E7,E10 | D3,D6 | U1,U3 | T1,T4 | Only part/foundation of “Keep retries from double-consuming usage” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-SUB-001; commercial decisions | Basic/Pro values and product/service caps are provisional evidence, not approved policy. |
| SUB-08 | Preserve data across expiry and downgrade | P0 / subscriptions and quotas | `partially implemented` | E3,E7,E10 | D3,D6 | U1,U3 | T1,T4 | Only part/foundation of “Preserve data across expiry and downgrade” is connected or tested; remaining workflow/browser scope is open. | SS-BIZ-001; SS-SUB-001; commercial decisions | Basic/Pro values and product/service caps are provisional evidence, not approved policy. |
| SUB-09 | Display current usage | P0 / subscriptions and quotas | `missing` | E3,E7,E10 | D3,D6 | U1,U3 | T1,T4 | No supported connected “Display current usage” workflow exists. | SS-BIZ-001; SS-SUB-001; commercial decisions | Basic/Pro values and product/service caps are provisional evidence, not approved policy. |
| SUB-10 | Provide subscription management UI | P0 / subscriptions and quotas | `missing` | E3,E7,E10 | D3,D6 | U1,U3 | T1,T4 | No supported connected “Provide subscription management UI” workflow exists. | SS-BIZ-001; SS-SUB-001; commercial decisions | Basic/Pro values and product/service caps are provisional evidence, not approved policy. |
| SUB-11 | Prevent customer self-upgrade | P0 / subscriptions and quotas | `implemented` | E3,E7,E10 | D3,D6 | U1,U3 | T1,T4 | Bounded criterion evidenced for “Prevent customer self-upgrade”; preserve it while completing adjacent workflow. | SS-BIZ-001; SS-SUB-001; commercial decisions | Basic/Pro values and product/service caps are provisional evidence, not approved policy. |
| SUB-12 | Keep authorized history readable after expiry | P0 / subscriptions and quotas | `implemented` | E3,E7,E10 | D3,D6 | U1,U3 | T1,T4 | Bounded criterion evidenced for “Keep authorized history readable after expiry”; preserve it while completing adjacent workflow. | SS-BIZ-001; SS-SUB-001; commercial decisions | Basic/Pro values and product/service caps are provisional evidence, not approved policy. |

### SET

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| SET-01 | Edit shop/business profile | P1 / settings | `partially implemented` | E7,E12 | D1,D11 | U5 | T6 | Business mode is owner-editable in product settings; name and remaining business profile fields are still open. | SS-SET-001 after document contracts | Mode changes preserve historical rows and do not rewrite document snapshots. |
| SET-02 | Configure invoice and receipt presentation | P1 / settings | `missing` | E7 | D1 | U5 | T4 | No supported connected “Configure invoice and receipt presentation” workflow exists. | SS-SET-001 after document contracts | EGP is currently hard-coded/defaulted; snapshots partly protect historical names. |
| SET-03 | Configure currency | P1 / settings | `partially implemented` | E7 | D1 | U5 | T4 | Only part/foundation of “Configure currency” is connected or tested; remaining workflow/browser scope is open. | SS-SET-001 after document contracts | EGP is currently hard-coded/defaulted; snapshots partly protect historical names. |
| SET-04 | Configure operational defaults | P1 / settings | `partially implemented` | E7,E12 | D1,D11 | U5 | T6 | Operational business mode is configurable; other approved defaults remain open. | SS-SET-001 after document contracts | This setting controls visibility only, not authorization or commercial policy. |
| SET-05 | Keep historical documents stable after setting changes | P1 / settings | `partially implemented` | E7 | D1 | U5 | T4 | Only part/foundation of “Keep historical documents stable after setting changes” is connected or tested; remaining workflow/browser scope is open. | SS-SET-001 after document contracts | EGP is currently hard-coded/defaulted; snapshots partly protect historical names. |

### INT

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| INT-01 | Keep Shop operational source records authoritative | Architecture boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “Keep Shop operational source records authoritative”; preserve it while completing adjacent workflow. | Future approved architecture decision only | These are guardrails, not permission to build integration. |
| INT-02 | Keep Shop independently usable | Architecture boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “Keep Shop independently usable”; preserve it while completing adjacent workflow. | Future approved architecture decision only | These are guardrails, not permission to build integration. |
| INT-03 | Keep normal operations independent of Ledger | Architecture boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “Keep normal operations independent of Ledger”; preserve it while completing adjacent workflow. | Future approved architecture decision only | These are guardrails, not permission to build integration. |
| INT-04 | Reserve formal accounting for future Ledger scope | Architecture boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “Reserve formal accounting for future Ledger scope”; preserve it while completing adjacent workflow. | Future approved architecture decision only | These are guardrails, not permission to build integration. |
| INT-05 | Do not create an ERP portal | Architecture boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “Do not create an ERP portal”; preserve it while completing adjacent workflow. | Future approved architecture decision only | These are guardrails, not permission to build integration. |
| INT-06 | Do not introduce cross-product SSO | Architecture boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “Do not introduce cross-product SSO”; preserve it while completing adjacent workflow. | Future approved architecture decision only | These are guardrails, not permission to build integration. |
| INT-07 | Do not implement a Ledger connector now | Architecture boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “Do not implement a Ledger connector now”; preserve it while completing adjacent workflow. | Future approved architecture decision only | These are guardrails, not permission to build integration. |
| INT-08 | Do not create speculative integration queues/tables | Architecture boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “Do not create speculative integration queues/tables”; preserve it while completing adjacent workflow. | Future approved architecture decision only | These are guardrails, not permission to build integration. |
| INT-09 | Require an approved future integration contract | Architecture boundary | `implemented` | E1,E2 | D1 | U1 | T3 | Bounded criterion evidenced for “Require an approved future integration contract”; preserve it while completing adjacent workflow. | Future approved architecture decision only | These are guardrails, not permission to build integration. |
| INT-10 | Define future export/posting semantics before implementation | Architecture boundary | `unverified` | E1,E2 | D1 | U1 | T3 | Exact Pack wording or safe evidence for “Define future export/posting semantics before implementation” is unavailable; no policy inferred. | Future approved architecture decision only | These are guardrails, not permission to build integration. |
| INT-11 | Preserve stable operational references for future integration | Architecture boundary | `partially implemented` | E1,E2 | D1 | U1 | T3 | Only part/foundation of “Preserve stable operational references for future integration” is connected or tested; remaining workflow/browser scope is open. | Future approved architecture decision only | These are guardrails, not permission to build integration. |
| INT-12 | Verify future integration authorization and idempotency contract | Architecture boundary | `unverified` | E1,E2 | D1 | U1 | T3 | Exact Pack wording or safe evidence for “Verify future integration authorization and idempotency contract” is unavailable; no policy inferred. | Future approved architecture decision only | These are guardrails, not permission to build integration. |

### UX

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| UX-01 | Support Arabic | P0 / product UX | `partially implemented` | E3,E4,E5,E6,E8,E9 | D1 | U1,U2 | T3,T4 | Only part/foundation of “Support Arabic” is connected or tested; remaining workflow/browser scope is open. | Per-capability work; SS-UX-001 hardening | No authenticated browser/mobile/a11y pass has been run; lists use fixed limits and client filtering. |
| UX-02 | Support English | P0 / product UX | `partially implemented` | E3,E4,E5,E6,E8,E9 | D1 | U1,U2 | T3,T4 | Only part/foundation of “Support English” is connected or tested; remaining workflow/browser scope is open. | Per-capability work; SS-UX-001 hardening | No authenticated browser/mobile/a11y pass has been run; lists use fixed limits and client filtering. |
| UX-03 | Support RTL and LTR | P0 / product UX | `partially implemented` | E3,E4,E5,E6,E8,E9 | D1 | U1,U2 | T3,T4 | Only part/foundation of “Support RTL and LTR” is connected or tested; remaining workflow/browser scope is open. | Per-capability work; SS-UX-001 hardening | No authenticated browser/mobile/a11y pass has been run; lists use fixed limits and client filtering. |
| UX-04 | Support responsive/mobile layouts | P0 / product UX | `partially implemented` | E3,E4,E5,E6,E8,E9 | D1 | U1,U2 | T3,T4 | Only part/foundation of “Support responsive/mobile layouts” is connected or tested; remaining workflow/browser scope is open. | Per-capability work; SS-UX-001 hardening | No authenticated browser/mobile/a11y pass has been run; lists use fixed limits and client filtering. |
| UX-05 | Show loading states | P0 / product UX | `partially implemented` | E3,E4,E5,E6,E8,E9 | D1 | U1,U2 | T3,T4 | Only part/foundation of “Show loading states” is connected or tested; remaining workflow/browser scope is open. | Per-capability work; SS-UX-001 hardening | No authenticated browser/mobile/a11y pass has been run; lists use fixed limits and client filtering. |
| UX-06 | Show empty states | P0 / product UX | `partially implemented` | E3,E4,E5,E6,E8,E9 | D1 | U1,U2 | T3,T4 | Only part/foundation of “Show empty states” is connected or tested; remaining workflow/browser scope is open. | Per-capability work; SS-UX-001 hardening | No authenticated browser/mobile/a11y pass has been run; lists use fixed limits and client filtering. |
| UX-07 | Show error and retry states | P0 / product UX | `partially implemented` | E3,E4,E5,E6,E8,E9 | D1 | U1,U2 | T3,T4 | Only part/foundation of “Show error and retry states” is connected or tested; remaining workflow/browser scope is open. | Per-capability work; SS-UX-001 hardening | No authenticated browser/mobile/a11y pass has been run; lists use fixed limits and client filtering. |
| UX-08 | Show success and permission-denied states accessibly | P0 / product UX | `partially implemented` | E3,E4,E5,E6,E8,E9 | D1 | U1,U2 | T3,T4 | Only part/foundation of “Show success and permission-denied states accessibly” is connected or tested; remaining workflow/browser scope is open. | Per-capability work; SS-UX-001 hardening | No authenticated browser/mobile/a11y pass has been run; lists use fixed limits and client filtering. |
| UX-09 | Invalidate/refetch state after writes and shop switches | P0 / product UX | `partially implemented` | E3,E4,E5,E6,E8,E9,E12 | D1,D11 | U1,U2 | T3,T4,T6 | Mode mutation clears `shop-data:*`, reloads shops and refreshes Nuxt data; shop switch already clears scoped state. Authenticated browser proof remains open. | Per-capability work; SS-UX-001 hardening | Current mode is stored per shop and navigation derives from the active shop, preventing global mode leakage. |
| UX-10 | Use server-side pagination for growing datasets | P0 / product UX | `missing` | E3,E4,E5,E6,E8,E9 | D1 | U1,U2 | T3,T4 | No supported connected “Use server-side pagination for growing datasets” workflow exists. | Per-capability work; SS-UX-001 hardening | No authenticated browser/mobile/a11y pass has been run; lists use fixed limits and client filtering. |

### SAFE

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| SAFE-01 | Deny outsiders and cross-tenant reads | P0 / security and integrity | `implemented` | E3,E4,E5,E6,E8,E9,E12 | D2,D3,D5,D6,D7,D8,D9,D11 | U2,U4 | T1,T2,T4,T6 | Existing read isolation is preserved; the mode command and audit policy reject outsiders and cross-shop actors. | SS-SAFE-001 plus each domain package | Visibility is not an access boundary; RLS and RPC authorization remain authoritative. |
| SAFE-02 | Reject cross-shop foreign references | P0 / security and integrity | `partially implemented` | E3,E4,E5,E6,E8,E9,E12 | D2,D3,D5,D6,D7,D8,D9,D11 | U2,U4 | T1,T2,T4,T6 | The business-mode command rejects a shop owned by another user; broader non-composite reference hardening remains open. | SS-SAFE-001 plus each domain package | The next task addresses remaining supported-command same-shop references. |
| SAFE-03 | Enforce active membership and profile status | P0 / security and integrity | `implemented` | E3,E4,E5,E6,E8,E9,E12 | D2,D3,D5,D6,D7,D8,D9,D11 | U2,U4 | T1,T2,T4,T6 | The mode command requires an active owner membership, active profile and active same-portal shop. | SS-SAFE-001 plus each domain package | Employee, outsider and cross-shop denial are covered by focused SQL. |
| SAFE-04 | Enforce authorization in database, not UI | P0 / security and integrity | `partially implemented` | E3,E4,E5,E6,E8,E9 | D2,D3,D5,D6,D7,D8,D9 | U2,U4 | T1,T2,T4 | Only part/foundation of “Enforce authorization in database, not UI” is connected or tested; remaining workflow/browser scope is open. | SS-SAFE-001 plus each domain package | Supported RPCs are safer; legacy sales lint defect and non-composite cross-shop FKs remain blockers. |
| SAFE-05 | Keep stock mutation atomic and serialized | P0 / security and integrity | `partially implemented` | E3,E4,E5,E6,E8,E9 | D2,D3,D5,D6,D7,D8,D9 | U2,U4 | T1,T2,T4 | Only part/foundation of “Keep stock mutation atomic and serialized” is connected or tested; remaining workflow/browser scope is open. | SS-SAFE-001 plus each domain package | Supported RPCs are safer; legacy sales lint defect and non-composite cross-shop FKs remain blockers. |
| SAFE-06 | Preserve FIFO layers and prevent negative stock | P0 / security and integrity | `partially implemented` | E3,E4,E5,E6,E8,E9 | D2,D3,D5,D6,D7,D8,D9 | U2,U4 | T1,T2,T4 | Only part/foundation of “Preserve FIFO layers and prevent negative stock” is connected or tested; remaining workflow/browser scope is open. | SS-SAFE-001 plus each domain package | Supported RPCs are safer; legacy sales lint defect and non-composite cross-shop FKs remain blockers. |
| SAFE-07 | Prevent duplicate or inconsistent payments | P0 / security and integrity | `missing` | E3,E4,E5,E6,E8,E9,E12 | D2,D3,D5,D6,D7,D8,D9,D11 | U2,U4 | T1,T2,T4,T6 | SS-BIZ-001 deliberately does not mutate payments or implement a payment command; duplicate/inconsistent payment protection remains open. | SS-SAFE-001 then SS-PAY-001 | Business-mode changes leave commercial and payment data untouched. |
| SAFE-08 | Protect finalized documents, numbering and retries | P0 / security and integrity | `partially implemented` | E3,E4,E5,E6,E8,E9,E12 | D2,D3,D5,D6,D7,D8,D9,D11 | U2,U4 | T1,T2,T4,T6 | Bootstrap and identical mode updates are retry-safe, while sale numbering/finalization remains open. | SS-SAFE-001 plus sales packages | Mode retries neither duplicate shops/audit nor mutate trial/subscription data. |
| SAFE-09 | Enforce quotas under concurrency | P0 / security and integrity | `partially implemented` | E3,E4,E5,E6,E8,E9 | D2,D3,D5,D6,D7,D8,D9 | U2,U4 | T1,T2,T4 | Only part/foundation of “Enforce quotas under concurrency” is connected or tested; remaining workflow/browser scope is open. | SS-SAFE-001 plus each domain package | Supported RPCs are safer; legacy sales lint defect and non-composite cross-shop FKs remain blockers. |
| SAFE-10 | Preserve audit and historical records | P0 / security and integrity | `partially implemented` | E3,E4,E5,E6,E8,E9,E12 | D2,D3,D5,D6,D7,D8,D9,D11 | U2,U4 | T1,T2,T4,T6 | Business-mode transitions append shop/previous/new/actor/time evidence and preserve product, service, stock and purchase rows; broader audit coverage remains open. | SS-SAFE-001 plus each domain package | No destructive mode transition or hidden-record deletion is allowed. |

### VAL

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| VAL-01 | Trace exact Requirements Pack V1 wording | Validation / evidence | `unverified` | E11 | D1 | U1,U2,U4 | T1,T2,T3,T4,T5 | Exact Pack wording or safe evidence for “Trace exact Requirements Pack V1 wording” is unavailable; no policy inferred. | Exact pack attachment for VAL-01; implementation packages for remaining gaps | This baseline made no hosted or provider changes. |
| VAL-02 | Inspect effective migration-chain schema | Validation / evidence | `implemented` | E11,E12 | D1,D11 | U1,U2,U4 | T1,T2,T3,T4,T5,T6 | The five-migration effective local schema and business-mode grants/policies were inspected and tested. | Exact pack attachment for VAL-01; implementation packages for remaining gaps | Migration applied only to the disposable local Shop database. |
| VAL-03 | Pass Shop typecheck | Validation / evidence | `implemented` | E11 | D1 | U1,U2,U4 | T1,T2,T3,T4,T5 | Bounded criterion evidenced for “Pass Shop typecheck”; preserve it while completing adjacent workflow. | Exact pack attachment for VAL-01; implementation packages for remaining gaps | This baseline made no hosted or provider changes. |
| VAL-04 | Pass Shop lint | Validation / evidence | `implemented` | E11 | D1 | U1,U2,U4 | T1,T2,T3,T4,T5 | Bounded criterion evidenced for “Pass Shop lint”; preserve it while completing adjacent workflow. | Exact pack attachment for VAL-01; implementation packages for remaining gaps | This baseline made no hosted or provider changes. |
| VAL-05 | Pass active Shop database suites | Validation / evidence | `implemented` | E11 | D1 | U1,U2,U4 | T1,T2,T3,T4,T5 | Bounded criterion evidenced for “Pass active Shop database suites”; preserve it while completing adjacent workflow. | Exact pack attachment for VAL-01; implementation packages for remaining gaps | This baseline made no hosted or provider changes. |
| VAL-06 | Verify tenant and privilege boundaries | Validation / evidence | `implemented` | E11 | D1 | U1,U2,U4 | T1,T2,T3,T4,T5 | Bounded criterion evidenced for “Verify tenant and privilege boundaries”; preserve it while completing adjacent workflow. | Exact pack attachment for VAL-01; implementation packages for remaining gaps | This baseline made no hosted or provider changes. |
| VAL-07 | Verify product/service catalog invariants | Validation / evidence | `implemented` | E11 | D1 | U1,U2,U4 | T1,T2,T3,T4,T5 | Bounded criterion evidenced for “Verify product/service catalog invariants”; preserve it while completing adjacent workflow. | Exact pack attachment for VAL-01; implementation packages for remaining gaps | This baseline made no hosted or provider changes. |
| VAL-08 | Verify inventory invariants | Validation / evidence | `implemented` | E11 | D1 | U1,U2,U4 | T1,T2,T3,T4,T5 | Bounded criterion evidenced for “Verify inventory invariants”; preserve it while completing adjacent workflow. | Exact pack attachment for VAL-01; implementation packages for remaining gaps | This baseline made no hosted or provider changes. |
| VAL-09 | Verify expense and purchase invariants | Validation / evidence | `implemented` | E11,E12 | D1,D7,D11 | U1,U2,U4 | T1,T2,T3,T4,T5,T6 | Focused mode transitions preserved supplier-purchase headers, lines and FIFO stock history; existing expense/purchase evidence remains. | Exact pack attachment for VAL-01; implementation packages for remaining gaps | No hosted database or provider change was made. |
| VAL-10 | Run authenticated browser journeys | Validation / evidence | `missing` | E11 | D1 | U1,U2,U4 | T1,T2,T3,T4,T5 | No supported connected “Run authenticated browser journeys” workflow exists. | Exact pack attachment for VAL-01; implementation packages for remaining gaps | This baseline made no hosted or provider changes. |
| VAL-11 | Run bilingual, RTL/LTR and responsive manual checks | Validation / evidence | `missing` | E11,E12 | D1,D11 | U1,U2,U4 | T1,T2,T3,T4,T5,T6 | English/Arabic responsive markup is implemented for mode setup/settings, but authenticated browser verification was not run because no reusable fixture is available. | SS-UX-001 and SS-VAL-001 | Owner must still verify Arabic/English, RTL/LTR and mobile/desktop behavior. |
| VAL-12 | Verify hosted deployment/provider state | Validation / evidence | `unverified` | E11 | D1 | U1,U2,U4 | T1,T2,T3,T4,T5 | Exact Pack wording or safe evidence for “Verify hosted deployment/provider state” is unavailable; no policy inferred. | Exact pack attachment for VAL-01; implementation packages for remaining gaps | This baseline made no hosted or provider changes. |
| VAL-13 | Complete release qualification | Validation / evidence | `missing` | E11 | D1 | U1,U2,U4 | T1,T2,T3,T4,T5 | No supported connected “Complete release qualification” workflow exists. | Exact pack attachment for VAL-01; implementation packages for remaining gaps | This baseline made no hosted or provider changes. |

### PLAN

| ID | Short requirement | Priority/type | Status | Repository evidence | Database evidence | UI/workflow evidence | Test evidence | Known gap | Dependencies | Preservation/security note |
|---|---|---|---|---|---|---|---|---|---|---|
| PLAN-01 | Maintain one canonical tracker | Planning / continuity | `implemented` | E11 | D1 | U4 | T5 | Bounded criterion evidenced for “Maintain one canonical tracker”; preserve it while completing adjacent workflow. | Future tasks update this file only | This file supersedes the former coarse backlog; historical readiness records remain evidence. |
| PLAN-02 | Record baseline and cumulative workspace | Planning / continuity | `implemented` | E11 | D1 | U4 | T5 | Bounded criterion evidenced for “Record baseline and cumulative workspace”; preserve it while completing adjacent workflow. | Future tasks update this file only | This file supersedes the former coarse backlog; historical readiness records remain evidence. |
| PLAN-03 | Classify every V1 requirement ID | Planning / continuity | `implemented` | E11 | D1 | U4 | T5 | Bounded criterion evidenced for “Classify every V1 requirement ID”; preserve it while completing adjacent workflow. | Future tasks update this file only | This file supersedes the former coarse backlog; historical readiness records remain evidence. |
| PLAN-04 | Record behavior to preserve | Planning / continuity | `implemented` | E11 | D1 | U4 | T5 | Bounded criterion evidenced for “Record behavior to preserve”; preserve it while completing adjacent workflow. | Future tasks update this file only | This file supersedes the former coarse backlog; historical readiness records remain evidence. |
| PLAN-05 | Record security and integrity blockers | Planning / continuity | `implemented` | E11 | D1 | U4 | T5 | Bounded criterion evidenced for “Record security and integrity blockers”; preserve it while completing adjacent workflow. | Future tasks update this file only | This file supersedes the former coarse backlog; historical readiness records remain evidence. |
| PLAN-06 | Record unresolved decisions | Planning / continuity | `implemented` | E11 | D1 | U4 | T5 | Bounded criterion evidenced for “Record unresolved decisions”; preserve it while completing adjacent workflow. | Future tasks update this file only | This file supersedes the former coarse backlog; historical readiness records remain evidence. |
| PLAN-07 | Order business-capability tasks by dependency | Planning / continuity | `implemented` | E11 | D1 | U4 | T5 | Bounded criterion evidenced for “Order business-capability tasks by dependency”; preserve it while completing adjacent workflow. | Future tasks update this file only | This file supersedes the former coarse backlog; historical readiness records remain evidence. |
| PLAN-08 | Select one next unblocked task | Planning / continuity | `implemented` | E11 | D1 | U4 | T5 | Bounded criterion evidenced for “Select one next unblocked task”; preserve it while completing adjacent workflow. | Future tasks update this file only | This file supersedes the former coarse backlog; historical readiness records remain evidence. |
| PLAN-09 | Define measurable next-task acceptance | Planning / continuity | `implemented` | E11 | D1 | U4 | T5 | Bounded criterion evidenced for “Define measurable next-task acceptance”; preserve it while completing adjacent workflow. | Future tasks update this file only | This file supersedes the former coarse backlog; historical readiness records remain evidence. |
| PLAN-10 | Maintain a durable task ledger for future sessions | Planning / continuity | `implemented` | E11 | D1 | U4 | T5 | Bounded criterion evidenced for “Maintain a durable task ledger for future sessions”; preserve it while completing adjacent workflow. | Future tasks update this file only | This file supersedes the former coarse backlog; historical readiness records remain evidence. |

## Current behavior to preserve

- Independent Shop production/staging Supabase projects, separate Auth/session cookies, `public` business API, protected `shop_private` helpers and the unchanged portal key `shop-crm` (E1,E2,D1).
- Active-profile, active-membership and active-shop enforcement; tenant-filtered SELECT policies; browser business-table writes revoked (D2,D3,T1).
- Shop switching clears `shop-data:*` caches, rejects an unauthorized remembered shop and refetches state (E3).
- Owner bootstrap is one authenticated idempotent transaction and does not extend the trial on retry (E3,D10,T1).
- Product/service archive instead of destructive delete, validated pricing/discounts, active SKU uniqueness and locked quotas (D4,T1).
- FIFO batches/movements, product locking, request idempotency, cost snapshots and no-negative behavior in supported adjustment/purchase paths (D5,D7,T1).
- Expense request idempotency, closed-period checks and non-destructive void history (D6,T1).
- Supplier purchase normalized-payload idempotency, same-shop validation, posted immutability, FIFO receipt and safe unused-stock void (D7,T1).
- Shared Building Suit tokens/fonts/icons, PrimeVue-based tables/dialogs and shared record/confirmation controllers; English/Arabic, RTL/LTR and light/dark infrastructure (E2,U2,T3).

## Security and data-integrity blockers

1. **Legacy sales finalizer is invalid.** `public.issue_invoice_and_deduct_inventory` contains `invoice_id - _invoice_id`; local SQL lint reports error 42883. It is revoked from browser roles but remains service-role compatibility surface. A new forward migration must replace/retire it before any sales UI relies on it.
2. **Cross-shop referential integrity is command-dependent.** Most foreign keys target UUIDs without composite `shop_id` constraints. Supported inventory/purchase RPCs validate tenant references, but dormant/future paths can create cross-shop references if they bypass those commands.
3. **No supported payment command.** `payments` has no request key/allocation ledger; duplicate submit, partial allocation, reversal/refund and overpayment rules are absent.
4. **Sales numbering/finalization is unsupported.** Unique `(shop_id, invoice_number)` exists, but there is no race-safe number allocator, retry key or supported atomic product/service finalizer.
5. **Team delegation is incomplete.** Database permission helpers model delegated authorization, but the UI is owner-only and there is no invitation/suspension/audit command workflow.
6. **Quota coverage is partial.** Product/service caps lock the shop, but seats, sales/activity and other resource limits are absent; downgrade/over-limit behavior is undecided.
7. **History/audit coverage is uneven.** Purchases, expenses and catalog archives preserve records; there is no general audit-event ledger for membership, subscription, settings, payments or sales corrections.
8. **Schema foundations are not report guarantees.** Twenty-five report views are invoker-secured and ungranted, but their totals/reconciliation/full-history behavior has not been tested against completed sales/payments/returns.
9. **Browser validation is missing.** Database fixtures pass, but authenticated owner/employee, shop switching, RTL/mobile, accessibility and email/recovery journeys remain unobserved.

## Unresolved product and commercial decisions

### Blocking now

None block `SS-BIZ-001`: business mode is explicitly independent from commercial tiering, can default existing shops to compatibility-preserving `mixed`, and does not set plan price/quota policy.

Before the later named packages:

- `SS-SALE-001`: confirm custom/manual sale-line policy and whether any tax/VAT behavior is required in the first issued document. Product/service issuance can be built without inventing either.
- `SS-PAY-001`: customer overpayment, unallocated receipt, reversal and refund semantics.
- `SS-PUR-002`: supplier credits, overpayments, unallocated/reversed supplier payments and returns after stock consumption.
- `SS-SUB-001`: approved plan names, prices, trial, resource limits, upgrade/downgrade, expiry write/read access and over-limit policy.

### Safely deferrable

- VAT/tax compliance beyond the first explicitly approved sale contract.
- Additional sale states beyond the existing draft/issued/paid/refunded/void evidence.
- Any change from the verified FIFO costing policy.
- Future Ledger/ERP export/posting, SSO, connector, queue, chart-of-accounts, journal or accounting-period integration.
- Advanced service material consumption until its operational policy is approved.

## Dependency-ordered implementation packages

### SS-BIZ-001 — Operational business mode independent of subscription

- Status: Complete on 2026-09-23; migration `20260923143306_operational_business_mode.sql` applied only to the disposable local Shop database.
- Requirements: SCOPE-03..05, BIZ-01..08, SUB-03, SET-01/04, UX-09.
- Prerequisites: SS-BASE-001 only.
- Capability: owners configure product, service or mixed operations; onboarding and settings persist it; navigation and workflows use it without granting paid entitlements.
- Verified components: signup/dashboard onboarding, `shops`, shell navigation, products/services/inventory/purchases, owner RPC pattern.
- Expected schema: new forward migration adding a constrained shop business-mode field plus an authorized idempotent owner command; compatibility-preserving backfill.
- Risks: confusing business configuration with plan access, hiding historical data, cross-shop update, stale cache.
- Preserve: independent subscriptions, FIFO, catalog rows/history and current RLS.
- Automated tests: all active Shop DB suites plus new owner/outsider/employee, retry, backfill and no-entitlement-escalation cases; typecheck/lint/build.
- Manual verification: product/service/mixed onboarding and switch review in Arabic/English, mobile/desktop, refresh/shop-switch.
- Decisions: none required by the brief.
- Acceptance criteria: the 13 measurable criteria in “Exact next proposed task” below.

### SS-SAFE-001 — Same-shop reference and supported-command hardening

- Requirements: SAFE-02/04/08/10, TEN-02/06/07.
- Prerequisites: SS-BIZ-001.
- Capability: every future business command uses verified tenant-linked references; dormant unsafe legacy mutation execute grants are retired.
- Verified components: tenant SELECT policies and helpers, supported private-command pattern, inventory/purchase commands, all public foreign keys and grants.
- Expected schema: forward-only composite or trigger validation where compatible, centralized same-shop assertions, and explicit retirement/replacement of unsafe legacy mutation grants.
- Risks: invalid historical references, function dependency breakage, security-definer exposure and accidental loss of service-role compatibility.
- Preserve: current IDs, FIFO/audit history, active RLS, invoker views and supported wrapper contracts.
- Acceptance criteria: every mutable cross-reference used by supported commands is same-shop validated; anon/outsider/cross-shop calls fail; browser roles retain no direct writes; the broken legacy sale finalizer is not callable by browser roles.
- Automated tests: catalog dependency/grant inspection, outsider/cross-shop cases for every affected command, service-role compatibility regression, active SQL suites and DB lint.
- Manual verification: none beyond reviewing generated API visibility and an authenticated denial response; no customer data probe.
- Decisions: whether compatible composite keys or command-level assertions are safest for each existing relation; no commercial decision.

### SS-CUST-001 — Customer master data and receivable-ready documents

- Requirements: CUST-01..04/07..09, SAFE-02/04, UX-10.
- Prerequisites: SS-SAFE-001.
- Capability: authorized customer CRUD/archive/search/detail with snapshot-safe links and due-date foundation.
- Verified components: `clients`, invoice client snapshots, balance views, product/service table patterns and shared data-table/overlay controllers.
- Expected schema: checked customer commands, same-shop constraints/indexes, searchable pagination contract and a due-date/document field only if approved by the requirement text.
- Risks: cross-shop client attachment, editing historical snapshots, ambiguous credit terms and unbounded client-side queries.
- Preserve: archived customer history and immutable document snapshots.
- Acceptance criteria: authorized create/edit/archive/search/detail works with server pagination; issued documents retain snapshots; outsiders and cross-shop references fail; due-date behavior is explicit rather than inferred.
- Automated tests: CRUD/archive/history, search/page boundaries, same-shop denial, permissions and snapshot preservation; app checks.
- Manual verification: owner and delegated-role bilingual customer journey, empty/error/permission states and refresh.
- Decisions: customer optionality/credit-sale rule; overpayment and reversal remain deferred to SS-PAY-001.

### SS-SALE-001 — Atomic product/service sale issuance

- Requirements: SALE-01/02/04..11, STOCK-05/10..12, SAFE-05/06/08.
- Prerequisites: SS-BIZ-001, SS-SAFE-001, SS-CUST-001.
- Capability: usable product/service invoice issuance with authoritative totals, race-safe number, request idempotency and FIFO deduction; replaces the broken legacy finalizer.
- Verified components: invoice/item schema, FIFO batches/movements, catalog RPC patterns, dashboard invoice read and the lint-failing revoked legacy finalizer.
- Expected schema: forward command contract, request key/ledger, immutable issued header/lines, safe number allocation, product/service snapshots and product locks.
- Risks: double issue, oversell, number races, client-supplied totals, cross-shop lines and partial stock mutation.
- Preserve: FIFO costing, closed-period enforcement, catalog history and issued-document immutability.
- Acceptance criteria: one retry-safe atomic command issues product/service invoices, computes totals, assigns a unique number and deducts FIFO stock exactly once; failure leaves no partial document or movement.
- Automated tests: retry/concurrency, insufficient stock, product/service/mixed lines, cross-shop references, closed period, expiry/permission, number races and total reconciliation; app checks.
- Manual verification: complete owner/staff issue, history and detail flow for product-only, service-only and mixed shops.
- Decisions: custom/manual lines and VAT/tax are excluded until approved, then delivered by SS-SALE-002.

### SS-PAY-001 — Customer receipts, allocation and reversals

- Requirements: PAY-01/02/04..06, CUST-04..10, SALE-13/14.
- Prerequisites: SS-SALE-001 and payment policy decisions.
- Capability: partial/multiple receipts, balanced allocation, statements and traceable reversal/refund without destructive edits.
- Verified components: `payments`, invoice/client balance views, closed-period/payment triggers and read policies; no supported write/UI exists.
- Expected schema: request-idempotent receipt and allocation/reversal commands, immutable payment events and explicit allocation model if one payment may cover multiple documents.
- Risks: duplicate money, over-allocation, stale balances, destructive reversal and cross-shop invoice/customer links.
- Preserve: document/payment history, actor/method/reference fields and closed-period protection.
- Acceptance criteria: partial/multiple receipts reconcile exactly; retries do not duplicate money; reversal is append-only/traceable; concurrent allocation cannot exceed approved policy.
- Automated tests: idempotency, over/unallocated policy, closed period, cross-shop denial, concurrent receipts, reversal and statement/balance reconciliation.
- Manual verification: record, allocate, inspect and reverse a receipt in both locales, including errors and refresh.
- Decisions: overpayments, unallocated receipts, reversal/refund semantics and customer credit policy must be approved first.

### SS-PUR-002 — Complete suppliers, payables and purchase returns

- Requirements: PUR-01/05..07/09/11, PAY-03..06, STOCK-06.
- Prerequisites: SS-PAY-001 and supplier credit/return decisions.
- Capability: supplier lifecycle, supplier payments/payables, safe return/credit paths and complete purchase detail/search.
- Verified components: vendor creation, posted supplier purchases, FIFO receipt/unused-stock void, vendor balance views and purchase UI.
- Expected schema: supplier update/archive commands, supplier payment allocation/reversal, return/credit documents and race-safe purchase numbering.
- Risks: returning consumed stock, duplicate supplier payments, payable drift and snapshot loss.
- Preserve: Task 09b normalized request idempotency, posting immutability, vendor snapshots and FIFO layers.
- Acceptance criteria: supplier lifecycle and paged purchase detail work; payments reconcile; permitted returns reverse stock/cost/payable exactly once; consumed-stock cases follow approved policy.
- Automated tests: retry/concurrency, cross-shop denial, partial payments, returns before/after consumption, closed periods, numbering and payable reconciliation.
- Manual verification: supplier, purchase, payment and return journey in both locales with permission states.
- Decisions: supplier credits, consumed-stock returns, overpayments and unallocated/reversed supplier payments.

### SS-STOCK-002 — Counts, low-stock and full correction lifecycle

- Requirements: STOCK-06/09/10/13/14, SAFE-05/06/10.
- Prerequisites: SS-SALE-001, SS-PUR-002.
- Capability: stock counts, low-stock thresholds, return/correction integration and reconciled FIFO valuation.
- Verified components: FIFO batches/movements, `product_stock`, manual adjustments, purchase receipts/voids and inventory page.
- Expected schema: count sessions/lines or equivalent atomic count command, low-stock threshold source and typed movement references/reasons.
- Risks: count-versus-sale races, negative stock, orphan references and valuation drift.
- Preserve: FIFO as the verified costing method, immutable movements and cost snapshots.
- Acceptance criteria: counts reconcile atomically; thresholds are shop/product scoped; every correction/return is traceable; valuation equals remaining FIFO layers.
- Automated tests: concurrent count/sale, negative prevention, archived products, idempotent corrections, reference integrity and valuation reconciliation.
- Manual verification: count, discrepancy, low-stock and history journeys on mobile/desktop.
- Decisions: negative stock remains prohibited in supported flows; any costing-method change requires a separate approved decision.

### SS-SALE-002 — Sale documents, corrections, returns and approved tax policy

- Requirements: SALE-03/12/14/15, STOCK-06, SET-02/03/05.
- Prerequisites: SS-PAY-001, SS-STOCK-002 and the listed product decisions.
- Capability: printable/shareable stable documents plus traceable correction/void/refund/return paths, custom lines and tax only as approved.
- Verified components: invoice lifecycle enums/triggers, return helper foundation, payment/stock foundations and shared document presentation.
- Expected schema: append-only correction/return commands, historical setting/tax snapshots and any approved custom-line validation.
- Risks: rewriting issued history, double stock restoration, refund/allocation mismatch and compliance claims.
- Preserve: original issued totals/numbers/snapshots, FIFO layer traceability and payment history.
- Acceptance criteria: every supported correction produces linked history; stock and money reverse once; generated documents remain stable after settings changes; unapproved tax/custom behavior stays unavailable.
- Automated tests: repeated returns/refunds, partial return policy, stock/payment reconciliation, document snapshots and cross-shop denial.
- Manual verification: print/share and correction journey, bilingual/RTL and accessible status review.
- Decisions: VAT/tax scope, custom/manual lines, additional lifecycle states and partial-return semantics.

### SS-SERV-002 — Optional service material consumption

- Requirements: SERV-05, STOCK-05/10..12.
- Prerequisites: SS-SALE-001, SS-STOCK-002 and an approved material-consumption policy.
- Capability: services may consume configured product quantities during issue without making ordinary services inventory-dependent.
- Verified components: service catalog, product/FIFO commands and atomic sale issuance.
- Expected schema: versioned service-material definitions and atomic FIFO consumption snapshots on issued sale lines.
- Risks: retroactive recipe edits, fractional quantities, oversell and duplicate consumption.
- Preserve: service-only sales with zero inventory dependency and historical line/material snapshots.
- Acceptance criteria: configured materials consume once at issue; unconfigured services consume none; retries/concurrency and insufficient stock are safe.
- Automated tests: configuration lifecycle, snapshot stability, fractional quantities, retry/concurrency and cross-shop references.
- Manual verification: configure and sell a material-consuming service plus a normal service.
- Decisions: whether material consumption belongs in V1, units/rounding and edit-effective dates.

### SS-EXP-002 — Complete expense history and approved operational income

- Requirements: EXP-01..06, PAY-01, UX-10.
- Prerequisites: SS-SAFE-001; operational-income policy for EXP-06.
- Capability: paged/searchable expense operations with delegated permissions and an explicit other-income model only if approved.
- Verified components: paid expense save/edit/void RPCs, categories, request IDs, closed periods and expense UI.
- Expected schema: server query contract, granular permission command and separate append-only operational-income records rather than overloading expenses.
- Risks: duplicate cash, editing void records, conflating income with sales/payments and unbounded lists.
- Preserve: expense request idempotency, non-destructive voiding and closed-period rules.
- Acceptance criteria: expenses are permission-aware and server-paged; corrections retain history; approved income records reconcile without corrupting sales/payment meaning.
- Automated tests: pagination/filtering, delegated denial/allow, retry, closed periods, void history and income idempotency/reconciliation.
- Manual verification: expense history/correction plus any approved income journey in both locales.
- Decisions: operational-income categories/source and whether EXP-06 is launch scope.

### SS-TEAM-001 — Invitations, roles, seats and suspension

- Requirements: TEAM-01..09, TEN-04..06, SAFE-03/04/09/10.
- Prerequisites: stable command permissions from sales/payments/purchasing.
- Capability: secure single-use invitations, delegated roles, owner continuity, immediate suspension and sensitive-action audit.
- Verified components: membership/role/permission tables and read helpers; owner-only product pages; no invitation/team UI.
- Expected schema: invitation token/reservation and acceptance commands, role assignment/suspension commands, owner-continuity guard and audit events.
- Risks: token theft/replay, seat races, privilege escalation and stale open sessions.
- Preserve: active-profile/membership checks and independent Shop identities.
- Acceptance criteria: email-bound single-use invites, atomic seat reservation/acceptance, non-escalating roles, last-owner protection and immediate suspension.
- Automated tests: invite replay/expiry/races, seat quota, escalation denial, last owner, open-session suspension and cross-shop isolation.
- Manual verification: invite/accept/manage/suspend flows for owner and staff in both locales.
- Decisions: approved role catalog, invitation expiry and seat quotas depend on SS-SUB-001 policy.

### SS-RPT-001 — Reconciled dashboard and operational reports

- Requirements: RPT-01..12, UX-10.
- Prerequisites: sales, receipts, supplier payments/returns and stock corrections.
- Capability: scoped dashboard/reports, drill-through, export and full-history server queries that reconcile to source documents.
- Verified components: limited dashboard invoice read and 25 ungranted invoker reporting views; no reports route/export.
- Expected schema: reviewed query/RPC contracts over reconciled source records, safe filter/page/export handling and indexes based on evidence.
- Risks: stale or tenant-leaking totals, page-limited aggregates, timezone errors and formula defects such as the existing `revendue` column.
- Preserve: source operational documents as authority and RLS/invoker semantics.
- Acceptance criteria: dashboard/report totals reconcile to known fixtures and source drill-through; full-history filters/export are tenant scoped and not client-page aggregates.
- Automated tests: reconciliation fixtures, pagination boundaries, timezone/date filters, permissions and CSV content/escaping.
- Manual verification: dashboard, drill-through and export in Arabic/English, RTL/mobile.
- Decisions: final report set and tax presentation can remain limited to explicitly approved V1 reports.

### SS-SUB-001 — Approved resource entitlements and lifecycle

- Requirements: SUB-01..12, SAFE-09.
- Prerequisites: commercial decisions and measurable resource commands.
- Capability: approved catalog, usage display, atomic quotas, expiry/downgrade behavior and subscription management.
- Verified components: Basic/Pro evidence rows, profile-owned subscription, owner bootstrap, catalog quotas and inventory feature gating.
- Expected schema: approved catalog migration, centralized entitlement/usage functions, serialized quota checks and operator-controlled lifecycle/audit commands.
- Risks: self-upgrade, race-over-quota, destructive downgrade and presenting provisional prices as approved.
- Preserve: history/read access, idempotent usage, existing subscription records and no client self-activation.
- Acceptance criteria: approved plans only are purchasable; writes/usage/expiry/downgrade follow one authoritative contract; concurrency cannot exceed limits; no data is deleted.
- Automated tests: expiry boundaries, quota races, retries, downgrade/reactivation, self-upgrade denial and usage reconciliation.
- Manual verification: usage/access/subscription states for each approved plan and expired/over-limit cases.
- Decisions: plan names/prices/trial/limits, upgrade/downgrade, expiry reads/writes and over-limit behavior.

### SS-SET-001 — Business, document and operational settings

- Requirements: SET-01..05.
- Prerequisites: sales/receipt document contract.
- Capability: authorized profile/document/currency/default settings with immutable historical snapshots.
- Verified components: `shops.name/status`, invoice currency snapshots and shared presentation-only `SettingsMenu`; no product settings route.
- Expected schema: tenant-scoped settings plus owner-authorized command and immutable snapshots on affected documents.
- Risks: settings mistaken for authorization, retroactive document change and unsupported currency arithmetic.
- Preserve: historical document currency/identity snapshots and Shop decimal amount contract.
- Acceptance criteria: authorized settings validate and persist; new documents snapshot them; old documents never change; outsiders/employees are denied as specified.
- Automated tests: validation, authorization, snapshot immutability and concurrent update behavior.
- Manual verification: edit profile/document/default settings and inspect old/new documents in both locales.
- Decisions: supported currencies, receipt/invoice presentation and tax defaults.

### SS-UX-001 — Cross-workflow accessibility, pagination and responsive hardening

- Requirements: UX-01..10 and remaining UI portions across domains.
- Prerequisites: core workflows present.
- Capability: consistent bilingual/RTL/mobile/loading/error/success/permission behavior and server pagination.
- Verified components: shared bilingual shell/tokens/tables/dialogs/controllers and existing per-page state handling.
- Expected schema: no new business schema except query contracts/indexes demonstrated necessary for server pagination.
- Risks: client-only filtering, inaccessible status/color, stale tenant caches and untranslated product copy.
- Preserve: shared design tokens, Manrope/IBM Plex Sans Arabic, Hugeicons, PrimeVue and shared interaction controllers.
- Acceptance criteria: every launch workflow has translated, keyboard/focus-safe, responsive loading/empty/error/success/denied states and server pagination where data grows.
- Automated tests: component/browser accessibility, locale/direction, pagination and cache invalidation regressions.
- Manual verification: keyboard/screen-size matrix in Arabic/English, light/dark and account/shop switching.
- Decisions: none beyond accepted UI standards.

### SS-VAL-001 — Launch qualification

- Requirements: VAL-01/10..13, PLAN continuity.
- Prerequisites: all accepted launch packages.
- Capability: disposable DB regression, authenticated browser matrix, report reconciliation, staging verification, restore/cutover evidence and honest capability claims.
- Verified components: root CI commands, local SQL runner, environment registry and maintained release workflows.
- Expected schema: none except explicitly reviewed fixes discovered during qualification; no migration is created merely for the checklist.
- Risks: equating build/schema presence with working journeys or treating CI as deployment authority.
- Preserve: separate projects/Auth, explicit environment selection and truthful readiness claims.
- Acceptance criteria: all accepted requirements have current connected evidence; DB/app/browser/report/security matrices pass; recovery and deployment evidence is recorded.
- Automated tests: full affected workspace, Shop DB and authenticated E2E suites.
- Manual verification: release journeys, mobile/a11y, staging health, backup/recovery and operator runbook.
- Decisions: deployment/merge/provider activity always requires separate authorization; exact Pack wording must be supplied for final traceability.

## SS-BIZ-001 completion record

- Files and objects: `public.business_mode`, `public.shops.business_mode`, `public.shop_business_mode_changes`, explicit-mode `public.create_owner_shop`, owner-only `public.set_shop_business_mode`, Shop mode utilities/middleware/state, signup/dashboard setup, business settings and navigation.
- Backfill and preservation: existing shops deterministically become `mixed`; the migration performs no deletes, archives or catalog/history rewrites. Focused SQL preserved product, service, inventory batch/movement and supplier-purchase rows through transitions.
- Subscription separation: mode create/change does not update `subscriptions`, `plans`, quota fields, trial/renewal dates or `features.inventory`.
- Verification: focused `shop_business_mode.sql` passed with rollback fixtures; `pnpm --filter @building-suit/shop-suit typecheck` passed; `git diff --check` is required again before commit. Broad database suites, lint and build were intentionally not rerun under the SS-BIZ-001 targeted policy.
- Manual verification: not run; no reusable authenticated browser fixture exists. Owner verification must cover product/service/mixed setup and switching, immediate navigation refresh, shop switching, owner/non-owner behavior, Arabic/English, RTL/LTR and representative mobile/desktop layouts.
- Remaining BIZ gaps: mixed product-and-service checkout (BIZ-06), service-material consumption distinction/workflow (BIZ-07), and complete sales/customer/payment operations under BIZ-01/04/05.
- Remote/provider activity: no remote migration, deployment, provider setting or secret change.

## Exact next proposed task

### SS-SAFE-001 — Same-shop reference and supported-command hardening

Dependency justification: business mode is now explicit and independent from subscription. Before adding customer and sale commands, remaining supported mutations and mutable cross-references need one consistent same-shop validation boundary, and unsafe legacy browser mutation exposure must remain retired.

Do not start this task automatically. Its scope and acceptance criteria remain in the dependency-ordered package above.

## Baseline verification record

| Command | Working directory | Result |
|---|---|---|
| `pnpm agent:preflight` | original monorepo root | Pass; fetched live state, `origin/stg` and the cumulative worktree were at `599a5ab`; the protected `stg` checkout had a pre-existing `tasks.md` edit, which was excluded; PR #17 is `stg → main` |
| `pnpm db shop-suit status` | cumulative worktree | Pass; disposable local Shop project selected; no linked remote project |
| `pnpm db shop-suit start` | cumulative worktree | Pass; selected the disposable local-only Shop stack; no remote project was linked |
| `pnpm --filter @building-suit/shop-suit typecheck` | cumulative worktree | Pass; only missing runtime URL/key warnings |
| `pnpm --filter @building-suit/shop-suit lint` | cumulative worktree | Pass |
| `pnpm --filter @building-suit/shop-suit build` | cumulative worktree | Pass; production build completed; only missing runtime URL/key warnings |
| `pnpm db shop-suit migration list --local` | cumulative worktree | Pass; all four checked-in migrations, through `20260919091222`, were already applied locally |
| `pnpm db:test:shop` | cumulative worktree | Pass; seven active SQL suites passed and rolled back fixtures |
| rollback-only `shop_crm_read_isolation.sql` with `shop_crm` mapped to `public` | cumulative worktree / local container | Fail (exit 3) at the superseded final assertion that no report view is browser-readable; current `product_stock` is intentionally granted to `authenticated`; earlier tenant/suspension/closed-period assertions completed and the aborted transaction rolled back |
| `pnpm db shop-suit db lint --local --level warning` | cumulative worktree | Command exit 0 with a reported error: legacy `issue_invoice_and_deduct_inventory` has invalid uuid subtraction |
| local catalog queries through `psql` | cumulative worktree / local container | Pass; confirmed effective counts, columns, function security/search paths, 24 policies and browser SELECT-only grants |
| first `git diff --check` | cumulative worktree | Fail: one inherited Markdown hard-break had trailing whitespace; corrected before final validation |
| inline matrix/package structural validator | cumulative worktree | First package-field pass found `Manual:` instead of the required `Manual verification:` label in SS-BIZ-001; corrected; final pass confirmed 197 unique IDs, 11 matrix fields per row, exact allowed statuses/counts and all 16 packages with every required planning field |
| `test "$(rg -o '^\\| [A-Z]+-[0-9]{2} \\|' apps/shop-suit/docs/readiness/tasks.md \| sort -u \| wc -l)" -eq 197` | cumulative worktree | Pass; exactly 197 unique requirement IDs |
| `awk -F '\\x7c' '/^\\x7c [A-Z]+-[0-9][0-9] / {gsub(/^[ \\t\\140]+/, "", $5); gsub(/[ \\t\\140]+$/, "", $5); c[$5]++} END {print "implemented=" c["implemented"], "partially implemented=" c["partially implemented"], "missing=" c["missing"], "unverified=" c["unverified"]; exit !(c["implemented"]==57 && c["partially implemented"]==86 && c["missing"]==46 && c["unverified"]==8)}' apps/shop-suit/docs/readiness/tasks.md` | cumulative worktree | Pass; 57 implemented, 86 partially implemented, 46 missing and 8 unverified |
| `pnpm check` | cumulative worktree | Pass; token outputs match, workspace boundaries pass and 80 historical migrations are unchanged |
| `git diff --check` | cumulative worktree | Pass after the documented whitespace correction |
| Authenticated browser/e2e | not run | No safe reusable credentials/custom SMTP; remains unverified |
| Hosted database/provider/deployment checks | not run | Outside authorization and unnecessary for this documentation baseline |

## Baseline change boundaries

- Documentation changed: this canonical tracker only.
- Runtime/frontend behavior changed: none.
- Database objects or migration files changed: none.
- Migrations created: none.
- Migrations applied locally: none; the disposable local Shop database was already current.
- Remote migrations/data/provider settings/secrets/deployments: none.
- Commit/push/PR/merge: none.
