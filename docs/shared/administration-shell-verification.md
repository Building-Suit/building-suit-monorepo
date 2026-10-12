# BS-SA-SHELL-001 local verification

Implemented the reusable `BsAdministrationShell` for BS-SA-UI-R001. The owner instruction and task admission release BS-SA-D001's activation hold; the task input marks the shared prerequisite complete. No application activation, database work or publication is included.

The shared template owns the two chambers and responsive presentation. `packages/ux` owns typed descriptors and the in-flow navigation disclosure. The catalogue supplies sample data and normal/loading/empty/overflow controls. Existing product shells and token values are preserved.

## Passing checks

Executed in the task worktree:

- `node --test packages/ui/tests/foundation.test.mjs packages/ux/tests/export.test.mjs` — full registered shared UI/UX regression passed, including new shell SSR and disclosure focus tests.
- `pnpm check` — canonical token outputs and workspace boundaries passed for four discovered Suits.
- `node tooling/checks/suit-template-boundaries.mjs --require-strict` — 86 Vue files, four Suits, zero violations.
- `pnpm typecheck` — all five workspace app checks passed.
- `pnpm lint` — passed, with 21 existing Ledger attribute-order warnings and read-only Turbo cache warnings.
- `pnpm build` — all five workspace app builds passed.
- `pnpm --filter @building-suit/docs build` — final catalogue build passed after the narrow-screen layout adjustment.
- `git diff --check` — passed.

## Blocked verification

All of these commands were executed and exited unsuccessfully before browser assertions ran:

```sh
pnpm --filter @building-suit/ledger-suit exec playwright test tests/e2e/shared-ui-foundation.spec.ts --workers=1 --retries=0 --repeat-each=2
pnpm --filter @building-suit/shop-suit exec playwright test tests/e2e/shared-ui-foundation.spec.ts --workers=1 --retries=0 --repeat-each=2
pnpm exec playwright test --config packages/testing/playwright.config.ts packages/testing/e2e/shared-ui.spec.ts --workers=1 --retries=0
```

The sandbox denies localhost server binding (`listen EPERM`); the catalogue and Ledger runner report early web-server exit. Rendered desktop/mobile, English/Arabic, LTR/RTL, light/dark, keyboard/focus and state acceptance is **unverified**. The new browser test is ready to exercise these states and capture four shell screenshots in `.local/screenshots` when run in an environment that permits local servers. No screenshots were produced or visually reviewed in this run.

`pnpm agent:preflight` failed with exit 1 (underlying 255). Remote/upstream and live GitHub state remain unverified. The work stays in the supplied worktree and is uncommitted; no push, merge, deploy or hosted database operation was performed.

## Retry-2 repair (2026-10-06)

Independent verification recorded two failures. The catalogue test requested a language menu item named `العربية`, but the docs locale descriptors have no `name`, so `BsSettingsMenu` correctly exposes the locale code `ar`. The test now selects that exact accessible name and retains its RTL, dark-theme, overflow and screenshot assertions. Shared component behavior is preserved.

The exact recorded browser command above was rerun after the locator repair and exited 1 before assertions (`Process from config.webServer exited early`). Direct diagnosis confirmed local server binding is denied with `listen EPERM`. Browser repair verification remains blocked; it must run in the control-plane environment that permits localhost servers.

`node --test apps/ledger-suit/tests/unit/shared-ui-migration.test.mjs` was also rerun and exited 1. Direct execution confirmed the recorded `ENOENT`: the zero-component assertion scans a removed `app/components` directory. Repairing that test requires a change outside this task's allowed paths (`apps/ledger-suit/tests/unit/shared-ui-migration.test.mjs`); authorization is pending. No placeholder directory or weakened assertion was introduced.

`pnpm check` and `git diff --check` passed during this repair. Preflight again exited 1 (underlying 255). This repair is not complete while the recorded verifier commands remain unsuccessful.

## Retry-3 investigation (2026-10-06)

Read the current failure summary first. The retry-2 independent probe passed the catalogue browser command; its sole remaining failure is Ledger's missing `app/components` directory. The existing `ar` locale locator repair is preserved.

Both originally failed commands were executed again, unchanged:

- `node --test apps/ledger-suit/tests/unit/shared-ui-migration.test.mjs` — exited 1. Direct module execution confirmed nine passing assertions and the recorded `ENOENT` in the zero-component assertion.
- `pnpm exec playwright test --config packages/testing/playwright.config.ts packages/testing/e2e/shared-ui.spec.ts --workers=1 --retries=0` — exited 1 before browser assertions (`Process from config.webServer exited early`). A local TCP binding diagnostic confirmed `EPERM` on `127.0.0.1:4322`. Local rendered verification remains unavailable; the required browser check is preserved.

The minimal proposed Ledger repair follows Shop's existing test helper: add `optional = false` to `vueFiles`, return an empty list only when an explicitly optional directory is absent, and mark only the `components` scan optional. Required application scans, recursive scans and assertions rejecting actual Vue files and ownership debt remain intact. No placeholder directory is needed. Applying this repair requires authorization for `apps/ledger-suit/tests/unit/shared-ui-migration.test.mjs`, outside the persisted task paths; that approval was requested and remains pending. A reviewable patch was prepared at `/tmp/BS-SA-SHELL-001-ledger-repair.patch` without changing the Ledger file.

`pnpm check` and `git diff --check` passed. `pnpm agent:preflight` exited 1 (underlying 255); live GitHub/fetch state remains unverified. Existing task work is preserved and uncommitted. The repair remains incomplete pending path authorization and successful execution of both required verifier commands in a suitable local environment.

## Retry-4 investigation (2026-10-06)

The retry-4 failure summary records the same Ledger directory-scan defect. The existing catalogue locale locator repair remains intact; independent retry-2 and retry-3 probes passed that browser suite.

Both originally failed commands were rerun exactly in this worktree:

- `node --test apps/ledger-suit/tests/unit/shared-ui-migration.test.mjs` — exited 1. Direct module execution again exposed nine passing tests and the same `ENOENT` in the component-directory scan.
- `pnpm exec playwright test --config packages/testing/playwright.config.ts packages/testing/e2e/shared-ui.spec.ts --workers=1 --retries=0` — exited 1 before assertions (`Process from config.webServer exited early`). A direct TCP diagnostic returned `listen EPERM` for `127.0.0.1:4322`; this environment cannot run the required localhost fixture. No browser assertions or screenshots were reviewed locally.

The three-line Ledger helper patch remains prepared at `/tmp/BS-SA-SHELL-001-ledger-repair.patch`. The recorded task paths still exclude that test file, and a scope exception was requested before applying it. Required scans and assertions are preserved; no placeholder directory, skip or unconditional success was introduced.

`pnpm check` and `git diff --check` passed. Preflight exited 1 (underlying 255), leaving remote/GitHub state unverified. Repair is incomplete pending the test-file scope exception and successful required verifier execution. No commit, push, merge, deployment or hosted database operation was performed.

## Retry-5 investigation (2026-10-06)

Both originally failed verifier commands were rerun exactly and exited 1. Direct Ledger module execution confirmed nine passing tests and the same missing-component-directory `ENOENT`. Playwright exited before assertions because its local web server could not start; a direct bind diagnostic confirmed `listen EPERM` on `127.0.0.1:4322`. The existing browser locator repair is preserved; independent retry-4 verification passed that suite.

The prepared patch at `/tmp/BS-SA-SHELL-001-ledger-repair.patch` still matches Shop's optional-directory helper and preserves the component/debt assertions. Applying it requires an exception for `apps/ledger-suit/tests/unit/shared-ui-migration.test.mjs`, which the task JSON excludes from `allowed_paths`; that exception was requested and has not been received. No application or test source changed in this retry.

`pnpm check` and `git diff --check` passed. Preflight exited 1 (underlying 255), so live GitHub/fetch state remains unverified. Repair remains incomplete pending the path exception and an environment permitting the required browser fixture. No check was skipped or weakened.
