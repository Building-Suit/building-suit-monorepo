# SS-UX-001 — Cross-workflow usability hardening

Status: implementation ready for independent verification; browser/manual acceptance remains blocked, not signed off.

Workstream/branch: `shop-suit` / `codex/shop-suit/ss-ux-001`. Starting HEAD: `95d0eef` (full operational reporting). The assigned worktree was clean. No commit, push, merge, deployment, or hosted database operation was performed. Preflight exited 255; live upstream/PR state remains unverified.

## Changes

| Requirement | Bounded implementation |
| --- | --- |
| TEN-03 | Account changes clear Shop and platform-admin query caches before membership loading. The page subtree is recreated on account/shop/location changes, discarding local drafts, picker searches, page numbers and dialogs. Pending confirmations are rejected and old notifications cleared. Location reads check user and request generation, including A → B → A races; stale responses/errors cannot restore an earlier location. Switch failures use the shell retry state. |
| UX-01/02/03/08/09 | Existing PrimeVue/shared foundation retained. Account actions use `BsDialog` focus handling and `BsForm` pending/error behavior. Products, purchases, supplier payment/credit/return/reversal and expenses use shared form locking and error-summary focus. Product/service actions and report/purchase drill-through links meet the canonical 44px minimum in their markup. Filters have accessible names, narrow action groups wrap, and supplier archive status explicitly says “Archived” rather than “Void.” Added copy is English/Arabic with logical layout spacing. |
| UX-04/05 | Purchase posting, supplier payment/financial credit/stock return/reversal, expense recording/correction and import application explain their different effects before confirmation. Pending starts before confirmation to prevent duplicate activation. Cash actions keep pending through confirmation and reject late feedback after a context change. Existing database RPCs, idempotency, arithmetic, authorization and history remain authoritative. Expense void retains its explicit reason/confirmation dialog. |
| UX-06 | Supplier history now requests server pages of 20 instead of hiding records after 100. Purchase product/supplier selectors use server search and pages of 20 through existing RPCs, preserving selections from other pages. Read-only supplier history remains available when product-catalog access is denied. Barcode export uses the catalog function's supported 100-record maximum, continues beyond twenty pages, and correctly advances through pages with no barcode-bearing products. |
| UX-07 | Supplier saves refresh and select the saved name in history; purchase posting returns to page one and refreshes. Supplier detail actions invalidate the actual parameterized purchase-list keys. Successful imports refresh queries. Report exports snapshot filters/columns and cancel on filter or context changes, preventing mixed-page downloads. Import file reads and late responses are scoped to their originating context. |
| UX-10 | Navigation remains limited to existing workflows. No new route, advertised capability, component stack, schema or dormant feature was introduced. |
| VAL-11 | Added a synthetic browser matrix and executable async regressions. Actual browser/assistive-technology/real-auth validation is still open as described below. |

Changed runtime owners: Shop app root/context, default layout, `PurchaseEntityPicker`, `useShopTaskScope`, products/services, purchases/list/detail, cash shifts, expenses, catalog import and reports. Shared runtime components and other apps were not changed. Test additions are Shop-owned except the dedicated Playwright configuration in `packages/testing`.

## Checks actually run

| Check | Result |
| --- | --- |
| `pnpm agent:preflight` | Failed (255): fetch/live GitHub state unverified. Local status, HEAD and worktree inspection completed. |
| Dependency preparation | Registry DNS failed (`EAI_AGAIN`); recovered using the existing package cache with a temporary writable index and copied worktree dependencies. Lockfile/manifests unchanged. |
| `pnpm --filter @building-suit/shop-suit prepare` | Passed. |
| `pnpm --filter @building-suit/shop-suit typecheck` | Passed; expected missing local Supabase URL/key warnings. |
| `pnpm --filter @building-suit/shop-suit lint` | Passed. |
| Shop production build with explicit loopback URL and synthetic public key | Passed. No deployment. |
| Every `apps/shop-suit/tests/unit/*.test.mjs` executed directly with `node` | 60 tests passed across 16 files. Includes 3 context-race tests and 5 async export/import tests. Existing SQL/source-contract assertions are not database execution. |
| `node packages/ui/tests/foundation.test.mjs` | 4 tests passed: shared buttons, bilingual form/select markup and feedback contracts. SSR assertions do not prove browser focus or geometry. |
| `pnpm check` | Passed: canonical tokens, workspace boundaries, 80 historical migrations preserved. |
| `pnpm exec playwright test -c packages/testing/playwright.shop-ux.config.ts --list` | 46 tests discovered across the inherited pilot and new cross-workflow suites. |
| Focused Playwright execution | Blocked before tests: web server exited because the sandbox denied socket binding (`listen EPERM 127.0.0.1:4421`). Debug output also shows denied loopback connections. No browser case passed in this execution. |
| `git diff --check` | Passed. |

The eight new executable regressions run the actual context composable/page script functions with synthetic dependencies. They cover immediate account clearing, logout during membership loading, location A → B → A, late switch failures, immutable report query snapshots, filter A → B → A export cancellation, stale-context download/error suppression, sparse barcode pages beyond twenty pages, and import cancellation with pending release.

## Independent verification

### Retry 2 repair — test discovery

The recorded failure was `No tests found` from the app-local verifier command: its default configuration selected only `pilot-qualification.spec.ts`. The app-local entry point now selects the existing synthetic UX configuration when explicitly passed a usability spec; qualification remains the default. Existing application changes and browser assertions are preserved.

Focused repair checks passed:

- `pnpm --filter @building-suit/shop-suit exec playwright test tests/e2e/cross-workflow-usability.spec.ts --workers=1 --retries=0 --max-failures=1 --list`: 20 tests discovered.
- `pnpm --filter @building-suit/shop-suit exec playwright test tests/e2e/pilot-qualification.spec.ts --list`: 20 tests discovered.
- `pnpm --filter @building-suit/shop-suit exec eslint playwright.config.ts` and `git diff --check`: passed.

Preflight again failed with exit 255; live GitHub state remains unverified. No browser execution or backend operation was performed during this repair. Final verification belongs to the control plane.

### Retry 3 repair — worker configuration

The recorded browser failure was `ERR_CONNECTION_REFUSED` at port 4422. The runner selected the synthetic UX server on port 4421, but workers reloaded the app-local configuration without the runner's spec arguments and fell back to qualification on port 4422. The app-local configuration now preserves the selected suite in `SHOP_PLAYWRIGHT_SUITE`, inherited by workers. Existing application changes and browser assertions are preserved.

Focused repair checks:

- A temporary Playwright worker probe, with server startup disabled and no browser/database access, reproduced the mismatch before the fix (expected 4421, received 4422). After the fix, the UX worker used 4421 and retained its trace setting; a separate qualification invocation retained 4422 and its Cairo timezone. Both probes passed.
- The control-plane browser command with `--list` still discovered all 20 cross-workflow tests.
- `pnpm --filter @building-suit/shop-suit exec eslint playwright.config.ts` and `git diff --check` passed.

Preflight failed with exit 255; live GitHub state remains unverified. Full browser execution and final verification remain with the control plane.

### Browser execution

From this worktree in an environment permitting local browser/server processes:

```sh
pnpm --filter @building-suit/shop-suit prepare
pnpm --filter @building-suit/shop-suit typecheck
pnpm --filter @building-suit/shop-suit lint
APP_ENV=local NUXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:61321 NUXT_PUBLIC_SUPABASE_KEY=local-ui-test-key pnpm --filter @building-suit/shop-suit build
pnpm exec playwright test -c packages/testing/playwright.shop-ux.config.ts
pnpm check
git diff --check
```

The dedicated configuration runs browser-only synthetic API fixtures; it does not connect to a database. The new matrix covers ten retail routes in English/Arabic at 360/768/1440px in light/dark system themes, accessible control names, overflow, account keyboard dismissal/focus return, supplier history past record 100, product selection past record 100, purchase effect confirmation/pending/save refresh, shop/location draft clearing, delayed report cancellation, report loading/empty/error/retry/denial, import cancellation and complete barcode export. The inherited suite covers calendar/POS/billing/admin and owner/manager/barber presentation. Synthetic capabilities are not authorization evidence.

Before acceptance, run real authenticated owner/delegated/view-only journeys against an authorized disposable setup, including account replacement while reads/writes are pending, both shops and branches, monetary/stock confirmations, paging and post-save refresh. Inspect 44px geometry, keyboard order/trapping/return, real screen-reader announcements, RTL/LTR and light/dark contrast at all three widths. Actual onboarding, team/settings, business-mode navigation, receipt printing and real-device interaction remain manual/real-auth verification items; this task does not claim a full launch sign-off.

Existing scale limitations remain: `sale_catalog`, `list_inventory` and `catalog_sales_report` return whole result sets. Existing virtualized controls/paged rendering bound DOM work, not those RPC payloads; this task does not change their server contracts. Supplier bill event arrays likewise retain their current server contract. Large-volume performance for these endpoints remains unverified.

Blockers: local socket restrictions prevent the browser matrix; no authorized disposable database/authenticated browser environment was supplied for real-backend/assistive-technology qualification. GitHub/fetch access remains unavailable. UI-D01 and UX-D02 are implemented within the task's supplied decisions; none of these limits is treated as acceptance approval.
