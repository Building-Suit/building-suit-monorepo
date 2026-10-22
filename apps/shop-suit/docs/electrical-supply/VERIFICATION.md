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
