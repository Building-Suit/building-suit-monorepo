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

Final reel source checkpoint `78e4a8a4` merges published parent `a15ce639` without history rewriting. The merged full107-migration replay passes nine included legacy SQL suites (including website catalogue) and both real-session races. Full Shop unit execution is412/463: all51 failure names match the previous54 after the three repaired landing tests are removed; no new failure name is introduced. Shop/Ledger/Doctor typechecks, Shop/docs production builds, changed-source lint, workspace ownership checks and release provenance/evidence checking pass locally. Exact native Supabase reel CI is pending publication. All17 focused quantity/reel/receipt tests and6 synthetic EN/AR browser scenarios pass in their recorded scope.

### Catalog entry-point qualification correction

PR450’s real measured-retail/reel SQL and cashier-race job passed at50f5b582. Its media/accounts jobs failed. Expanding the local SQL matrix reproduced `permission denied for function catalog_media`: the new private adapter correctly revoked API-role execution, while the public SQL wrapper still ran as its caller. Forward migration20261023195653 makes that existing public entry a safe-search-path definer, preserving its ACL and all delegated tenant/actor/plan/media checks; direct API execution of the private adapter remains denied. Both existing media and image-upload suites now join the default local matrix. Exact rerun results follow at the corrected checkpoint.

Corrected local execution passes all108 migrations, the measured and physical merchant journeys, eleven included legacy suites (including both media/upload cases), and both actual-session races. The Storage fixture now states provider schema/table ACL stand-ins explicitly; actual migrated Shop object RLS policies remain enabled and enforce the unauthorized/cross-tenant assertions. No hosted provider schema is altered. The forward entry-point change alters no function signature, row shape or generated schema type. Native CI on the corrected commit remains required.

The full repository unit gate also identified a duplicate suffix alias for BsPhysicalStockPage in the UI export manifest. The unused suffix alias is removed; the canonical suffix-free export remains. The existing governed-source one-to-one export assertion verifies this boundary. This is an internal correction to the unpublished reel template.

### Regression qualification child — 2026-10-23

`codex/shop-suit/electrical-regression-qualification` starts at published PR450 commit50f5b582. No parent dirty work was copied. The parent subsequently published forward catalog-authority correction946b0f58, which must be merged before this child is published.

The public website failure was an empty globally initialized POS receipt-selection store, not a demonstrated private-value disclosure. The scope plugin now creates that store only when an authenticated counter context exists and retains its reference so logout still clears it. Cache cleanup clears active snapshots immediately, cancels pending reads and removes entries once detached. Actual Colada tests prove a late cancelled response cannot restore old private data; existing tenant/host assertions remain unchanged. All8 built public-site integration scenarios pass, including combined two-store, cookie-only customer portal, booking, unknown-host and unpublish boundaries.

The prior51 Shop unit failure names were repaired by bringing fixtures to the current useShopClient/useShopQuery contracts, real Pinia/Colada store ownership, current section routes, inline settings controls, lazy receipt overlay, and SSR appointment projections. Critical actor/location/race/amount assertions are retained; no expected failure is suppressed. Full Shop unit execution now passes478/478. The real-store test harness instantiates the actual scope plugin and store, so A→B→A and pending-read logout exercise current cache behavior. The role menu also now maps the existing offers/website-builder grants to their actual navigation entries without changing backend capabilities.

Shop typecheck/build and changed-source lint pass at their recorded local checkpoint; full repository units, merged-parent SQL/typecheck/build and relevant browser gates are pending. Native merchant, hardware and production-release gates remain open. E4 trade and remaining E5 tasks still require implementation.

The first full repository run executes2049 cases:2021 pass,5 fail,23 skip. One failure is the unused duplicate reel-template export, corrected on parent15b52a32 without changing consumers. Four failures are missing Playwright binary prerequisites; after installing the exact pinned headless Chromium, all14 focused receipt/clipboard/operator-health browser and publication cases pass. Final merged-root execution is still required; intentional skips remain separately counted. Changed Shop source/test lint passes without suppressions.


### Merged regression qualification

Merged parent15b52a32 at7c3ec7ab. The full repository execution passes2026 of2049 cases, zero failures and23 separately reported skips. The full108-migration disposable replay passes both merchant journeys,17 included legacy SQL suites and both actual-session races. This expands compatibility coverage without changing the explicit provider-stand-in boundary. Native parent15b52a32 independently passes measured-retail, media and accounts CI, including real Supabase reel concurrency, full Shop SQL and Auth/Storage paths.

Merged Shop production build, typecheck and all6 electrical EN/AR browser cases pass. The POS-to-products navigation now also asserts zero Colada active-query-removal warnings. Existing8 built public-site scenarios and478 Shop units pass within their recorded checkpoints. Workspace ownership and release coverage against actual parent15b52a32 pass. No intentional skip is counted as passing evidence.

A broader privacy-browser run found two stale navigation selectors and a genuine dropped pricing-card link event. Tests now open settings through the Privacy Policy page; the shared landing template and Shop adapter restore the existing consent-controlled pricing event. The browser assertions still require allowlisted, anonymous, deduplicated transport and withdrawal/cookie cleanup. Final expanded browser/build results follow below.


The isolated privacy-browser rerun passes8/9, with the remaining conversion failure reproducing an unassociated sign-up email label after hydration. Shared enrollment fields now use distinct semantic IDs, matching the existing sign-in approach; this restores actual label/control behavior instead of weakening the browser selector. Rebuilt Shop and all9 privacy cases now pass, including signup-form privacy, pricing CTA transport, consent withdrawal and synthetic request lifecycle. The earlier concurrent build/browser attempt timed out during staging HTTP checks; the same test passes when rerun without that contention. All-consumer build/shared-auth checks still need their final results.


All7 consumer production builds pass after the signup fix;48 shared sign-in/signup/public/access browser cases pass. The settings suite retained its old popup assertions for auth pages and now exercises the current shell cycle controls for Docs/Inventory/Automation, including mobile navigation and both locales. That reproduced a genuine focus loss when the language button became disabled while loading. The shared focus controller now restores focus only if the user has not moved elsewhere. Rebuilt all7 apps; all12 settings browser cases pass. A root fixture is updated for the controller's legitimate new Vue nextTick import; final root rerun remains required.

The actual disposable SAS/PostgREST catalog caught an overbroad public classification of the new signup fragment in this still-open draft PR. The protected parent15b52a32 has no accepted copy of that fragment. Its new draft scope is corrected to Shop only in a forward commit; existing accepted fragments and release history remain untouched. Other shared consumers retain explicit internal provenance. Public registration/production-version authority is not inferred from shared dependency use. The catalog rerun remains required; no product registry or publisher guard is weakened.


Appointment-access qualification now passes4 cases using the current calendar's appointment/detail/access-dialog flow, preserving issue-once, rotate/revoke, no cached credential, unusable-phone denial and view-only denial. Doctor's existing synthetic suite passes48 unchanged cases; its8 shared-shell cases exposed the same stale popup expectation. Those8 now pass with the current keyboard cycle controls while retaining truthful preview disclosure and overflow checks. No Doctor domain or clinical functionality changes.

The remaining real SAS/PostgREST registration failure was narrowed to the earlier new sign-in fragment on draft parent445, whose public scope included Ledger without verified active registration/baseline. That new draft fragment is corrected on445 at7c3b1c36, and parent450 merges it at7ef59f5f. This qualification branch merges the published parent at21dc24a9. No protected accepted fragment or product registration is rewritten. Final catalog/root reruns bind this corrected combined candidate.
