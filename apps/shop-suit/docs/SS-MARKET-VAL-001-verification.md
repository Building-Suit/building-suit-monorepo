# SS-MARKET-VAL-001 — Execution evidence

Date: 2026-09-29. **Status: qualification package implemented; acceptance and general small-shop marketing BLOCKED.**

Workstream/branch: `shop-suit` / `codex/shop-suit/ss-market-val-001`. Starting HEAD: `7d2cd68a806b07aed9ebb3e57356b67f1f30c43f` (UX hardening); preceding reporting dependency: `95d0eef`. Initial worktree was clean. No upstream is configured. Live origin/PR state is unverified; no base/publication decision was made. Changes remain uncommitted for control-plane review.

## Implementation and changed files

- `tests/market/database.mjs`: local-only, fail-fast runner covering 27 rollback SQL suites, including supplier/customer balances, imports, reports and receipts.
- `supabase/tests/shop_market_reconciliation.sql`: continuous product/service/mixed source-to-report scenarios, partial payments, idempotent retries, full correction, purchase return and archive with remaining stock/history.
- `tests/e2e/market-backend.ts`: synthetic real-Auth tenants and owner/manager/cashier sessions, using existing local-only credential guards.
- `tests/e2e/market-qualification.spec.ts` and `playwright.market.config.ts`: 36 daily-loop cells plus server permission revocation/isolation, authenticating against the real disposable backend; UI import/purchase/barcode/POS/receipt/cash workflows and report reconciliation.
- [Market runbook](SS-MARKET-VAL-001-runbook.md), this record, and readiness index: acceptance traceability, repeatable commands, claim limits and independent sign-off states.

No runtime UI, schema migration, shared package, another app's internals or public marketing claims were changed. UX-D02's existing foundation is preserved.

## Checks actually run

| Command/check | Actual result |
| --- | --- |
| `pnpm agent:preflight` | Failed: underlying preflight exit 255. Fetch cannot write worktree `FETCH_HEAD`; `gh pr list` cannot reach `api.github.com`. Current branch/HEAD and clean initial status inspected locally |
| `pnpm install --offline --frozen-lockfile --store-dir .local/pnpm-store` | Failed: missing offline Manrope tarball (`ERR_PNPM_NO_OFFLINE_TARBALL`) |
| `pnpm install --frozen-lockfile --store-dir .local/pnpm-store --fetch-retries=0 --fetch-timeout=10000` | Failed: registry DNS `EAI_AGAIN`. No lockfile change |
| `node --test apps/shop-suit/tests/unit/*.test.mjs` | Passed: all 16 test files, zero failures/skips. These include pure helper and source-contract assertions; they do not establish DB/browser qualification |
| `pnpm check` | Passed: canonical tokens and workspace boundaries; 80 historical migrations unchanged |
| Shop filtered `typecheck`, `lint`, and local-configured `build` | Each attempted and failed before checking code: `nuxt` / `eslint` unavailable because dependencies are not installed |
| `SHOP_PILOT_DISPOSABLE=1 node apps/shop-suit/tests/market/database.mjs` | Blocked at first suite; local Docker access unavailable. No SQL suite passed |
| `node apps/shop-suit/tests/market/database.mjs` without acknowledgement | Correctly refused before DB access; nonzero exit and explicit disposable-local requirement |
| `docker --host unix:///var/run/docker.sock version --format '{{.Server.Version}}'` | Permission denied connecting to Docker API |
| `pnpm exec playwright test -c apps/shop-suit/playwright.market.config.ts --list` | Failed: available executable reports `unknown command 'test'`; workspace Playwright dependency unavailable. Matrix count is from source, not successful discovery |
| `node --check` on new market runner, config, backend and browser spec | Passed syntax checks; not TypeScript semantic checking or browser execution |
| `git diff --check` plus Python whitespace/link inspection of all seven new task files | Passed; no whitespace errors or broken task-document links. A Node subprocess-based inspection was blocked by `EPERM`; the filesystem-only inspection completed |

## Separate evidence states (VAL-13)

| State | This candidate |
| --- | --- |
| Code implemented | Qualification runner, fixtures, browser matrix, runbook and capability checklist are present |
| Automated tests passed | Existing Shop unit checks and repository token/boundary checks only. New SQL, authenticated browser matrix, concurrency probes and app build/type/lint remain unverified |
| Manually verified | Not performed; checklist is prepared, not signed |
| Deployed | Not performed; expressly prohibited for this task |
| Commercially approved | Not approved; broad marketing gate remains blocked |

Exact blockers: package installation/network access; local Docker socket access to a prepared disposable Shop backend; workspace Playwright/browser prerequisites; manual acceptance and commercial review. The task payload sets local database strategy to `none`; no disposable backend was provisioned or reset. Live GitHub verification is also unavailable but is not needed to inspect these local changes.

Unrun: every new DB/browser case, independent-session concurrency probes (including the supplier risk documented in the pilot), synthetic UX browser matrix, real-device/assistive-technology/hardware checks. Prior task completion or historical runs are not passes for this candidate. ETA and offline are explicitly excluded until SS-EGY-ETA-001 and SS-OFFLINE-001 respectively have completion and qualification evidence.

No commit, push, merge, deployment, hosted migration or hosted database mutation was performed. Follow the [runbook](SS-MARKET-VAL-001-runbook.md) for independent execution; retain failures and withheld approval until all required acceptance evidence exists.

## Retry-2 repair — 2026-09-29

The control-plane failure summary supersedes the initial dependency blockers above: dependency installation, workspace checks, Shop typecheck/build and the default database check passed independently. It recorded two failures: missing error `cause` in the market SQL runner and no market tests discovered through the app-local Playwright entry point.

The runner now preserves the caught error as `cause`. The app-local configuration selects the existing market configuration for `market-qualification.spec.ts`, retaining the inherited worker selection and existing pilot/usability defaults. The runbook reflects this entry point.

Focused repair checks passed:

- `pnpm --filter @building-suit/shop-suit exec eslint tests/market/database.mjs playwright.config.ts`.
- The recorded browser command with `--list` appended: all 37 market tests discovered, without starting a server or accessing a database.
- App-local `--list` for `pilot-qualification.spec.ts` and `cross-workflow-usability.spec.ts`: 20 tests each.
- `git diff --check`.

Preflight still failed with exit 255; live GitHub state remains unverified. No browser or SQL scenarios were executed during this repair. Full verification remains with the control plane; discovery is not an authenticated workflow pass and does not change the commercial gate.

## Retry-3 repair — 2026-09-29

The supplied failure record reports all checks except the browser suite passing. The first product/owner/English/360 px case timed out; context cleanup obscured the waiting action. Its page snapshot shows the import kind still set to Products, a file-read error, and disabled validation. The first uploaded file is a customer CSV, which fails the product header requirement (`sale_price`). The import helper could select the native control before Nuxt attached Vue's model binding after the full navigation.

The market import helper now waits for completed hydration before selecting the import kind, checks the selected value, and asserts that parsing enables validation before clicking. Existing CSV contents, real-backend assertions, matrix coverage and application behavior are preserved.

Focused checks: ESLint passed for `tests/e2e/market-qualification.spec.ts`; all three existing CSV fixtures parsed with their intended headers, and checking the customer fixture as Products reproduced the missing-header error. Playwright discovery with `--grep 'general shop day: product, owner, en, 360px$' --list` selected the single failing case (an initial start-anchored grep matched no tests). `git diff --check` passed.

A focused browser execution attempt stopped before running a test: the inherited local server could not obtain disposable-backend status (`pnpm failed (1)` in `localStatus`). Preflight again failed with exit 255. The hydration repair therefore still requires the control plane's authenticated browser verification; no end-to-end pass or marketing approval is claimed. No commit, push, merge, deployment or hosted database operation was performed.
