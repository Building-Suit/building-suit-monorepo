# Execution evidence — measurement foundation checkpoint

Parent: `2efbed85c5893dfcd4d7a40eaa27a22e9690b00d` (103 preexisting migrations).
Feature migration: `20261022185512_measurement_foundation.sql` (104th business migration).
Source branch: `codex/shop-suit/measurement-foundation`. Final core, unit comparison, release unit, workspace and quality checks use repository-pinned Node26.8.1 and pnpm10.33.0 (via npx package selectors); initial exploratory commands used inherited Node24.19.0. Results below establish scoped local behavior; no epic, hosted deployment or merchant rollout is verified.

| Exact command/read | Actual result |
|---|---|
| `pnpm agent:preflight` with inherited pnpm | FAILED: required10.33.0, inherited11.25.0 |
| `node tooling/git/preflight.mjs` | PASS: fresh refs/PRs, clean original checkout, no active Shop parent; staging2efbed85 |
| `npx --yes pnpm@10.33.0 install --frozen-lockfile` | PASS; Nuxt prepared; missing local backend configuration warnings |
| `node --test apps/shop-suit/tests/unit/measurement.test.mjs` | PASS6 tests,0 failures/skips: exact physical/count conversions, dimension/package rejection, precision/bounds/increments, decimal serialization, registry immutability |
| `node tooling/database/shop-measurement-schema-disposable.mjs --types /tmp/shop-measurement.types.ts` | PASS:104 actual Shop business migrations; upgrade preservation; conversion/configuration/security/legacy SQL; real two-session configuration-vs-stock race; JS/SQL registry conformance; types from pinned postgres-meta v0.98.0 |
| `node tooling/database/shop-measurement-schema-disposable.mjs --regressions --types /tmp/shop-measurement.types.ts` | FAILED overall, retaining supplier-suite failure below; core measurement, race and six other regression suites pass |
| Existing `shop_crm_product_catalog`, `shop_sale_issuance`, `shop_stock_counts_corrections`, `shop_service_materials`, `shop_partial_returns`, `shop_storefront_bundle_offers` SQL | PASS under the explicit provider schema fixture; original assertions retained |
| Existing `shop_supplier_payables_returns` SQL | FAILED: authenticated fixture calls revoked private `shop_private.purchase_payable`. Same error reproduced with every new measurement guard removed transactionally. No production grant or test assertion weakened |
| Full Supabase startup (normal, then documented minimal exclusions) | BLOCKED: image registry throttling and ultimately `failed to register layer: no space left on device`. Minimal retry stopped after repeated storage failure. Only images downloaded by this task were removed; unrelated containers/resources untouched |
| `node tooling/database/test-shop-measurement-local.mjs` | BLOCKED/exit1: fixed local Supabase container absent. No hosted fallback |
| `npx --yes pnpm@10.33.0 db shop-suit test db --local apps/shop-suit/supabase/tests/shop_measurement_foundation.sql` | BLOCKED/exit1: local port61322 refused connection |
| `node --test apps/shop-suit/tests/unit/*.test.mjs` | FAILED:450 tests;396 pass,54 fail,0 skips. An archive of exact parent2efbed85 with the same dependencies reproduces444 tests,390 pass,54 fail and the identical failure-name set. Six new measurement tests pass; no new failure name |
| `npx --yes pnpm@10.33.0 --filter @building-suit/shop-suit typecheck` | PASS; local Supabase URL/key warnings |
| `npx --yes pnpm@10.33.0 --filter @building-suit/shop-suit build` | PASS; Nitro build completed |
| `npx --yes pnpm@10.33.0 --filter @building-suit/shop-suit lint` | FAILED: unchanged useShopMutation.ts:15 preserve-caught-error; unchanged landing-journey.test.mjs:5 unused variable;25 existing warnings |
| Changed app files ESLint (run from apps/shop-suit) | PASS: measurement.js, measurement.test.mjs, measurement.ts and shopCrmRpc.ts |
| Root ESLint on changed measurement/local DB runners | PASS |
| `npx --yes pnpm@10.33.0 check` | PASS: canonical tokens, six Suit boundaries, zero local components/debt,114 templates;80 archived migrations unchanged |
| `node --test tooling/releases/*.test.mjs packages/contracts/tests/*changelog* packages/data-access/tests/*changelog* packages/ui/tests/*changelog*` | PASS60 tests;0 fail/skips |
| `node tooling/releases/catalog-disposable.mjs` | PASS: candidate revisions, readiness, immutable history, production freeze/ack recovery, authorization and public projection |
| `RELEASE_POSTGREST_DISPOSABLE=1 node tooling/releases/catalog-postgrest-disposable.mjs` | PASS: migrated SAS, actual PostgREST/authenticator and real pinned pg-safeupdate, retrospective import/retry/rollback and baseline/version continuity |
| Public staging `/api/changelog` |200;20 upcoming and4 retrospective; stale preview clock |
| Public production `/api/changelog` |503; release publication authority unavailable |
| Production environment variable inspection |403 Resource not accessible by integration; no workaround |
| Archived production publisher job log |Forbidden; underlying publisher reason unverified |
| `git diff --check` |PASS |

## Scope of the schema fixture

The official Supabase PostgreSQL image cannot fit this workspace's Docker storage. The secondary harness uses uniquely named disposable postgres:17-alpine containers and the real104 Shop migrations. Auth/Storage interfaces are explicit stand-ins; Net/Cron invocation throws. Exactly the two external extension installation statements are replaced by these stand-ins; all Shop financial, authorization, RLS, trigger, constraint and migration bodies are retained. It does not claim actual provider Auth, Storage, Cron, Net, Realtime delivery or hosted deployment acceptance. Every resource it creates is uniquely owned and removed in finally.

The upgrade fixture creates fractional stock and an issued sale plus original receipts and g/mL declarations BEFORE applying the measurement migration. It compares the original stock, movement, financial, receipt and service JSON after upgrade. A separate two-session race proves old stock writers re-read the configured status after lock waits. A failed prepared-product supplier purchase/sale leaves no partial stock/document line.

Generated public database types include the actual current staging schema, including previously omitted storefront/bundle interfaces, plus this foundation. No provider fixture schema or test-only public relation is included. New decimal-string RPCs have explicit hand-maintained Shop adapters.

## Still unrun or blocked

Full original regression remains failed as above. Full real-Supabase SQL/concurrency/E2E and browser/native-speaker/device/merchant acceptance are unverified. No product UI changed, so no rendered UI acceptance is claimed. Hosted migration history, actual production release head/receipt, production changelog recovery and live promotion remain blocked. Root-wide test/browser suites were not claimed run. Exact task statuses distinguish implemented/tested from verified.

No quantity storage was widened, measured checkout enabled, package/reel/wholesale capability published, subscription entitlement changed, immutable release rewritten, hosted table edited or main/stg integration performed.

## Final pinned-runtime comparison

Node26.8.1 repeats the core104-migration/upgrade/race/conformance pass, the60 release-unit passes and the workspace-boundary pass. Feature unit results remain450/396/54; exact-parent results remain444/390/54 with the same failure-name set. The combined Turbo quality command fails on inherited lint and cancels sibling tasks; separate final typecheck/build results are tracked independently. Raw broad-suite failures were never converted into passes.

## Reviewable source

Draft [PR441](https://github.com/Building-Suit/building-suit-monorepo/pull/441) contains source checkpoint `ce62100b`. Final pinned-runtime typecheck and build both exited0. `pnpm release:check` passed current main-to-head evidence/coverage and private fragment provenance. The original checkout remains clean. PR/CI results are separate and must be checked on its exact head; no remote merge or production deployment is claimed.


## Measured retail child — 2026-10-22

Forward migrations 20261022192645 and 20261022193300 widen reviewed quantity/cost dependencies atomically, preserve view ACLs and original totals, activate canonical units and versioned packaging, and integrate the existing purchase, sale, FIFO, count, return and immutable receipt commands. Routine body guards fail closed if the reviewed parent changes.

The disposable PostgreSQL 17 schema harness passes all 106 business migrations, upgrade-history preservation, registry conformance, configuration/stock concurrency, the electrical merchant journey, and all seven included legacy SQL suites. Provider interfaces remain explicit stand-ins: this is not a substitute for exact-head Supabase CI or hosted deployment. The supplier fixture now asserts payables through public.get_purchase; private ledger grants remain revoked.

The journey receives 100m at 25/m, sells 12.5m at 35/m, leaves87.5m and recognizes312.5 FIFO COGS; it also covers250cm,250g, whole pieces, measured counts/eligible returns, fixed-price reels, package barcode identity, CSV dry run/application, stale revisions, immutable archived-package receipts and retries, and cross-tenant denial.

Focused unit execution:55 passed before adding SSR error recovery. Current browser, full-unit, lint, build/typecheck and release results are recorded at the next verified checkpoint; pending commands are not passes. New UI uses the existing shared templates with bilingual product copy. ETA exports require an explicit stock-unit mapping and continue to reject unsupported provider precision.

Latest measured-retail verification: all eight included legacy SQL suites pass, including operating/margin reports. The reporting fixture now derives its expected acquisition-time FIFO cost from the earliest received batch: supplier documents use Cairo noon, while manual receipts use the current instant, so RPC call order is not FIFO chronology. All financial assertions remain. Shop, Ledger and Doctor typechecks pass; Shop and documentation builds pass for the measured workflow, including the final reporting build. Two synthetic authenticated browser cases pass (EN light desktop and AR dark mobile); physical device/native-speaker/real provider acceptance is not implied. Full unit comparison remains402/456 with the same54 inherited failure names; all new tests pass.

Exact-head PR445 Supabase measured-retail job passed at bc4a0b4b. Broader CI exposed two decimal-scale assertions comparing numeric values as formatting strings: website price12.50 versus12.500000 and remaining stock10.00 versus10.000000. Assertions now compare exact numeric meaning (SQL numeric / trim_scale); concurrency, rollback, field allowlists and expected amounts remain unchanged. Website catalog joins the local schema regression matrix. Doctor SQL business assertions passed but its type generator image was unavailable; other browser/marketing jobs failed and review was cancelled. These are open gates, not a green combined candidate.

### Website regression runner cleanup

The exact `ca0b4538` GitHub website job completed its real Supabase SQL matrix, then stopped on an unused `here` variable and its import in the landing fixture. Removing the unused setup clears the lint error. The three stale source-contract tests now follow the extracted journey organism, its actual receipt wording and responsive scrub contract; they retain fallback, genuine workflow, lazy-loading, scope cleanup and reduced-motion checks. Pinned-runtime landing unit tests and changed-file lint are checked locally; the next exact CI head must still run the browser gate.

### Physical reels and electrical catalogue — local M3 qualification

The child `codex/shop-suit/reels-and-electrical-catalog` started at published measured-retail `bc4a0b4b`; later parent fixture fixes must be merged before child publication. The new forward migration adds typed technical profiles/SKU families, individual reels, original-cost cut/loss audit, continuous allocation, explicit split/source choice, remnant classification/pricing, counts/scrap/archive, frozen return policies and separate returned pieces. Supplier returns and unused purchase voids withdraw physical sources. Legacy whole-sale corrections for tracked cable direct the operator to line returns, which enforce frozen condition/approval policy. Unsupported aggregate-only adjustments fail the deferred batch/reel balance guard.

Pinned Node26.8.1 / pnpm10.33.0 results:

- Full107 business-migration replay passes the new physical journey and measured merchant journey, plus eight included legacy SQL suites (`electrical-reel-supplier-final.log`, local workspace evidence). This runner uses explicit provider stand-ins, not hosted acceptance. Supplier2.5m return leaves47.5m; unused purchase void leaves no physical stock.
- Two actual PostgreSQL cashiers race to cut10m from15m. Exactly one commits, the waiter rolls back, and5m/one cut remain. Configuration-versus-stock race also passes.
- Ten focused reel/cart/receipt tests pass, covering continuous versus split lengths, exact loss increments, sealed packages, explicit remnant price/source, frozen whole-package return ratios and source-barcode receipt display.
- Shop production build, earlier Shop typecheck and workspace ownership checks pass. Final lint/typechecks and bilingual browser qualification remain in progress; failures are not completion evidence.

No merchant pilot, native-speaker review, scanner/scale/printer hardware acceptance, provider deployment or production release is claimed. M4 trade ordering and remaining E5/E6 tasks remain open.

Expanded browser qualification passes6 scenarios: EN/light/1440 and AR/dark/390 physical stock/count history and exact cut commands; explicit supplier return source selection; entered measurement/unit changes; technical cross-section/family display and historical tracking lock. Page overflow checks pass and rendered screenshots were inspected. These tests use synthetic transport, not hardware or hosted business records. Docs production build and Shop/Ledger/Doctor typechecks also pass within the local shared-contract scope. Final merge-head checks remain required.

Parent `a15ce639` real Supabase CI passes measured-retail, payments, returns, tax, service-materials, accounts and Doctor SQL. Its website built integration still fails because the public SSR payload includes an empty globally initialized POS receipt store (`invoiceId: null`); the local diagnostic found no actual fixture-private value in that failure. Preserve the strict public boundary test and remove unnecessary private receipt state in the next qualification feature. The root unit job still exposes stale Shop harnesses (`useShopClient`, `useShopInvalidation`, `import.meta`); browser gates remain open. These are retained E6 work, not waived release criteria.
