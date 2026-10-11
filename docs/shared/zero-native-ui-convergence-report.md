# Zero-native UI convergence — BS-UI-ZN-FINAL-001

Repair attempt 3: **strict source gate passes; independent browser/final acceptance remains pending**. Changes are uncommitted in the existing task worktree. No branch/worktree creation, commit, push, merge, deployment, provider or hosted database operation occurred.

## Recorded failure and repair

The failure summary showed the last transaction-page violations. Rerunning the exact command, `node tooling/checks/suit-template-boundaries.mjs --require-strict`, exposed 3,809 Ledger violations across 45 files and a migration-mode manifest. The initial inventory had 107 Vue files and 21 Ledger-local components. The required command was repaired through its entire discovered suite rather than weakening the checker or recording more migration debt.

The 21 local component scripts now live in Ledger composables named `useLedger…View.ts`. Their Bs compositions live in consuming route/layout templates. `BsWorkflowScope` mounts each adapter in its own Vue lifecycle, propagates reactive inputs, exposes writable models and forwards existing events. Product queries, commands, authorization, validation, tenant clearing and money calculations remain Ledger-owned. The catalogue query uses Nuxt's setup-time `useAsyncData` prefetch without suspending the factory and losing its setup context.

Native layout/content/control tags and local styling were replaced with semantic shared Bs contracts. Shared additions cover native select options and external labels, description terms/values, line breaks, hierarchy branches/leaves, data color swatches, flow-diagram blocks, dashboard previews and workflow scopes. Existing shared controls gained additive layout, bare-control, controlled-select, hidden-file, floating-action and rich-text slot support. The shared data table, record-action dialogs, confirmation and focus behavior remain the existing implementations.

Already-compliant Suit templates and prior strict-runner changes were preserved. Obsolete Ledger-local ownership entries were removed. The debt manifest is now strict and empty, with the task's committed checkpoint as its audit reference; verification includes the uncommitted working-tree repair. No canonical token, product schema, migration, database test or runner was changed.

## Current source inventory

| Suit | Vue files | Routes | Layouts | Local Vue components | AST debt |
|---|---:|---:|---:|---:|---:|
| automation-suit | 10 | 8 | 1 | 0 | 0 |
| inventory-suit | 3 | 1 | 1 | 0 | 0 |
| ledger-suit | 36 | 33 | 2 | 0 | 0 |
| shop-suit | 37 | 32 | 4 | 0 | 0 |

Each Suit also has one app root. The strict AST/source scan reports 86 Vue files, zero violations and zero parse failures. There are no native/vendor/non-Bs template elements, template presentation attributes, local style blocks or Suit-local Vue components. Strict mode remains mandatory; no check is skipped or replaced with unconditional success.

## Strict enforcement implemented

The checker accepts only rendered names matching `^Bs[A-Z]`; Vue's non-rendering `template` remains the sole exception. Dynamic `component`, Nuxt/Vue rendering tags, native/vendor/unprefixed tags, template class/style/passthrough attributes, raw HTML, style blocks and local Vue components fail the strict AST gate. Strict source checks additionally reject Suit-owned CSS content (comments alone are permitted), vendor imports in script adapters, compatibility imports of old shared component names and unprefixed public renderable exports.

Normal workspace checks honor a strict manifest automatically. `--require-strict` requires that manifest to exist, use strict mode and contain no recorded violations, as well as requiring zero actual debt. `--strict` remains the manifest-free strict source check for disposable fixtures. The inventory writer refuses to downgrade an existing strict manifest. Regression tests cover those behaviors, including migration-mode rejection with zero actual debt and strict-mode rejection of stale recorded debt.

## Shared Atomic inventory

Every public renderable export uses a Bs name. These counts include the preserved foundation and repair additions.

- atoms: 30 explicit exports.
- molecules: 69 explicit exports.
- organisms: 53 explicit exports.
- templates: 8 explicit exports.

## Local verification

| Exact command | Result |
|---|---|
| `pnpm install --frozen-lockfile --prefer-offline` | PASS; all app prepare scripts completed |
| `node tooling/checks/suit-template-boundaries.mjs --require-strict` | PASS; 86 Vue files, four Suits, zero violations |
| `pnpm check` | PASS in strict mode; tokens match, zero local components, 80 historical migrations unchanged |
| `pnpm typecheck` | PASS; all five app tasks executed, none cached |
| `pnpm lint` | PASS; warnings remain |
| `node --test packages/ui/tests/foundation.test.mjs packages/ux/tests/export.test.mjs apps/ledger-suit/tests/unit/shared-ui-migration.test.mjs apps/shop-suit/tests/unit/shared-ui-migration.test.mjs tooling/checks/suit-template-boundaries.test.mjs` | PASS; all five test files |
| `node --test tooling/new-platform/tests/generate.test.mjs` | PASS |
| `node tooling/new-platform/verify-fixture.mjs` | PASS; 12 dry-run/generated files match |
| `pnpm --filter @building-suit/ledger-suit build` | PASS |
| `pnpm --filter @building-suit/shop-suit build` | PASS |
| `pnpm --filter @building-suit/inventory-suit build` | PASS |
| `pnpm --filter @building-suit/automation-suit build` | PASS |
| `pnpm --filter @building-suit/docs build` | PASS |
| `pnpm build` | PASS after the final shared changes; all five app tasks executed, none cached |
| `pnpm --filter @building-suit/ledger-suit exec playwright test tests/e2e/shared-ui-foundation.spec.ts --workers=1 --retries=0 --repeat-each=2` | BLOCKED; exit 1 before tests run |
| `pnpm --filter @building-suit/shop-suit exec playwright test tests/e2e/shared-ui-foundation.spec.ts --workers=1 --retries=0 --repeat-each=2` | BLOCKED; exit 1 before tests run |
| `pnpm agent:preflight` | BLOCKED; exit 1, remote state not verified |
| `git diff --check` | PASS |

Meaningful shared regressions exercise writable workflow models, reactive input propagation, single-instance initialization, event forwarding and effect disposal; native controlled-select SSR selection, bare/external control labeling and hidden-file semantics; and named translated policy links. Ledger migration tests now verify the composable/controller connections and exhaustive Bs-only templates, absence of local styling and zero local Vue components. No required assertion was converted to a skip or unconditional pass.

Builds and typechecks emitted read-only Turbo cache IO warnings but completed successfully without cached tasks. Verification logs use `/tmp/bs-zn-*.log`; the source inventory is `/tmp/bs-zn-final-audit.json`.

Required browser commands were attempted unchanged. Their preview servers cannot listen in this sandbox: direct startup reports `listen EPERM 127.0.0.1:3210` for Ledger and `listen EPERM 127.0.0.1:4421` for Shop. No desktop/mobile, light/dark, English/LTR, Arabic/RTL, focus or financial-flow rendered acceptance is claimed. No screenshots were captured. The browser fixtures and required checks remain intact for the control plane to run in an environment permitting local preview listeners.

`pnpm agent:preflight` exited 1 before origin/GitHub state could be verified. Local inspection confirms branch `codex/shared/bs-ui-zn-final-001`, HEAD `7c651e5acaf503a7de0dc4e70a9824038f0d8aa8` and no upstream. No publication/base decision was made from stale remote state. Independent final verification belongs to the control plane.

## Retry 4 — table opener preservation (2026-10-06)

Status: **repair implemented; required browser verification remains blocked locally**. The latest recorded failure is Ledger's account-activity focus-return assertion at `shared-ui-foundation.spec.ts:214`, repeated twice. The earlier strict-boundary failures remain repaired; the exact strict command still passes with 86 Vue files across four Suits and zero violations.

PrimeVue renders column body slots as functional components. The shared table previously recreated those functions on parent updates, replacing the account button that `BsDialog` had remembered as its opener. `BsDataTable` now preserves per-column template functions and the record-action template while reading current column descriptors, content, capabilities and labels. Column VNodes remain directly discoverable by PrimeVue's column helper. Existing slot fallback/forwarding, action styling, event propagation and product-owned commands are preserved. No product route, business logic or Design System token changes are part of this retry.

The new mounted regression models the parent updates caused by dialog visibility; it failed against the prior table because those updates replaced its opener node. It now verifies persistent account and edit controls, refreshed cell/header/action labels, and the correct edit event/row, using PrimeVue's actual column discovery helper and its functional-cell rendering pattern. This is focused lifecycle evidence, not browser or visual acceptance. Existing required browser assertions are unchanged.

Local results for this retry:

- `node tooling/checks/suit-template-boundaries.mjs --require-strict`: PASS.
- `pnpm check`: PASS.
- `pnpm typecheck`: PASS; all five app tasks executed.
- `pnpm lint`: PASS; existing warnings remain.
- `node --test packages/ui/tests/foundation.test.mjs packages/ux/tests/export.test.mjs apps/ledger-suit/tests/unit/shared-ui-migration.test.mjs apps/shop-suit/tests/unit/shared-ui-migration.test.mjs`: PASS; all four files.
- `pnpm build`: PASS after the final code changes; all five app tasks executed, covering Ledger, Shop, Inventory, Automation and the documentation catalogue.
- `git diff --check`: PASS.

The required exact command `pnpm --filter @building-suit/ledger-suit exec playwright test tests/e2e/shared-ui-foundation.spec.ts --workers=1 --retries=0 --repeat-each=2` was attempted unchanged, including against the fresh final build, and exited 1 before tests ran. The corresponding Shop command was also attempted unchanged and exited 1 during preview startup. Direct preview startup confirms `listen EPERM: operation not permitted 127.0.0.1:3210`. A verification environment permitting the local preview listener is required. Desktop/mobile, light/dark, English/LTR, Arabic/RTL and rendered focus acceptance remain unverified in this retry. Independent final verification belongs to the control plane. No branch/worktree creation, commit, push, merge, deployment or hosted database change was performed.

Current repair logs: `/tmp/bs-zn-repair-check.log`, `/tmp/bs-zn-repair-typecheck.log`, `/tmp/bs-zn-repair-lint.log`, `/tmp/bs-zn-repair-tests.log` and `/tmp/bs-zn-repair-build.log`.

## Retry 5 — Shop browser server isolation (2026-10-06)

Status: **repair implemented; required browser verification remains blocked locally**. The latest independent confirmation passed Ledger's browser suite and the strict boundary check, but Shop could not start because port 4421 was already occupied. Its foundation configuration inherited the pilot suite's fixed port.

Shop's foundation configuration now allocates an available loopback port once in the runner and passes it through `SHOP_FOUNDATION_PORT` to workers. The server's port, readiness URL and browser base URL agree. The app entry point loads this asynchronous configuration only for the foundation suite. The inherited pilot server is replaced, not added as a second server. Fresh-server enforcement remains enabled; no browser assertions, retries, or required checks were weakened. Existing product and shared UI repairs are preserved.

Local verification:

- `node --test apps/shop-suit/tests/unit/playwright-shared-ui-config.test.mjs`: PASS; covers runner/worker port agreement, preservation of server settings, exclusion of the pilot server, and allocation errors rejecting verification. Network allocation is simulated in these unit tests; they do not establish browser acceptance.
- `pnpm --filter @building-suit/shop-suit exec eslint playwright.config.ts playwright.shared-ui.config.ts tests/unit/playwright-shared-ui-config.test.mjs`: PASS.
- `pnpm exec tsc --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --typeRoots node_modules/.pnpm/@types+node@26.6.1/node_modules/@types --types node apps/shop-suit/playwright.config.ts apps/shop-suit/playwright.shared-ui.config.ts`: PASS. The initial standalone invocation without the repository's Node type roots failed to resolve Node declarations.
- `SHOP_FOUNDATION_PORT=4499 pnpm --filter @building-suit/shop-suit exec playwright test tests/e2e/shared-ui-foundation.spec.ts --workers=1 --retries=0 --repeat-each=2 --list`: PASS; discovers all 24 repeated cases. Listing is only a configuration diagnostic.
- `node tooling/checks/suit-template-boundaries.mjs --require-strict`: PASS; 86 Vue files, four Suits, zero violations.
- `pnpm check` and `git diff --check`: PASS.

Both recorded browser commands were rerun exactly: `pnpm --filter @building-suit/ledger-suit exec playwright test tests/e2e/shared-ui-foundation.spec.ts --workers=1 --retries=0 --repeat-each=2` and `pnpm --filter @building-suit/shop-suit exec playwright test tests/e2e/shared-ui-foundation.spec.ts --workers=1 --retries=0 --repeat-each=2`. Both exited 1 before tests ran. The final Shop rerun fails with `listen EPERM: operation not permitted 127.0.0.1`; this sandbox prohibits local listening sockets. A verification environment permitting loopback listeners and Chromium is still required. No browser pass or repair completion is claimed. Preflight also exited 1 without verifying remote state. Independent final verification remains with the control plane.
