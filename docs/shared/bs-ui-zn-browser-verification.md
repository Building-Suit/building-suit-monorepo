# BS-UI-ZN-BROWSER-001 — representative browser gate

Status: coverage implemented; browser acceptance **blocked / unverified** on 2026-10-06.
Requirements: BS-UI-R024, BS-UI-R026. Decisions: BS-UI-D014, BS-UI-D023.

## Coverage and ownership

The two app-local `tests/e2e/shared-ui-foundation.spec.ts` files exercise real product routes using browser-intercepted synthetic local Supabase responses. Ledger's new `foundation-fixture.ts` supplies membership, capabilities, billing, dashboard receipts, notifications and a 27-row account hierarchy. Shop reuses its existing `pilot-fixture.ts`, with test-local customer, POS and plan responses. Product calculations, APIs, authorization, migrations and UI implementations are unchanged.

`packages/testing/browser-foundation.ts` shares overflow, control geometry, screenshot attachment and hydrated client-navigation helpers. Client navigation keeps mock sessions inside the browser. The existing Playwright configurations point only to each product's local backend; these specs do not provision identities or mutate a hosted database.

| Product | Representative assertions |
| --- | --- |
| Ledger public/auth | Header, hero, features, workflow, footer, monthly/yearly pricing, desktop aligned cards, narrow dark frame, Arabic RTL, login geometry, signup forward/back with preserved values, six-digit verification and invalid-code feedback |
| Ledger workspace | Dashboard receipt/KPIs; organization selector keyboard open/Escape; notification selection and read RPC; mobile drawer Escape/focus return; account menu/theme/language; hierarchy search/detail closing balance; table view/tab chrome, sort, search and 25/2-row pagination; create/edit modal values, Escape and focus return; subscription usage in mobile dark Arabic |
| Shop public/auth | Shared landing/pricing, desktop aligned cards, narrow dark and RTL frames, login geometry, signup forward/back with preserved values, operation-mode selection, OTP and invalid-code feedback |
| Shop workspace | Dashboard and billing/usage in desktop light EN and mobile dark AR; mobile navigation Escape/focus return; account menu keyboard End/Escape/focus; service create/edit; customer server pagination/search/reset/create modal; POS tile geometry, catalogue search RPC, cart quantity/removal and customer selection; settings profile modal validation/dirty state and focus return |

The matrix is representative rather than every route crossed with every viewport/theme/locale. Roles, accessible names, visible values, user interactions and measured dimensions/overflow establish behavior. Screenshots are attached to Playwright results for separate visual review; source checks and screenshots alone are not browser acceptance.

## Browser evidence — NOT VERIFIED

Both required full-spec commands were executed with one worker, zero retries and two repetitions:

```sh
pnpm --filter @building-suit/ledger-suit exec playwright test tests/e2e/shared-ui-foundation.spec.ts --workers=1 --retries=0 --repeat-each=2
pnpm --filter @building-suit/shop-suit exec playwright test tests/e2e/shared-ui-foundation.spec.ts --workers=1 --retries=0 --repeat-each=2
```

Both exited 1 before running tests: `Process from config.webServer exited early`. Direct diagnosis with `PORT=3210 HOST=127.0.0.1 node apps/ledger-suit/.output/server/index.mjs` reports `listen EPERM: operation not permitted 127.0.0.1:3210`. This execution sandbox denies local listening sockets. No rendered assertions or visual review passed, and no screenshots were captured. An earlier attempt also preceded completion of the Ledger build and reported a missing `.output/server/index.mjs`; the final attempts used completed builds and hit the socket denial.

The same commands with `--list` passed (20 Ledger / 24 Shop cases including repetitions). Discovery proves registration/transpilation only. Rerun the full commands in this worktree in an environment permitting local servers and Chromium. Review screenshot attachments and repair any fixture or product failures before approving browser acceptance. No tests were skipped or weakened to accommodate the sandbox.

## Source/build/type evidence — PASS

Executed successfully:

- `pnpm build`: all five registered app builds; zero cached results (Ledger, Shop, Inventory, Automation and Docs).
- `pnpm typecheck`: passed from cache; additionally `pnpm exec turbo run typecheck --force`: all five apps passed with zero cached results.
- `pnpm check`: canonical tokens, workspace boundaries and AST-based migration-debt checks passed.
- `pnpm lint`: passed; existing Vue attribute-order warnings remain.
- `node --test packages/ui/tests/foundation.test.mjs packages/ux/tests/export.test.mjs apps/ledger-suit/tests/unit/shared-ui-migration.test.mjs apps/shop-suit/tests/unit/shared-ui-migration.test.mjs`: four test files passed.
- Targeted ESLint for the changed Ledger and Shop spec/fixture files passed.
- Standalone TypeScript check for both foundation specs and their imports passed:

```sh
pnpm exec tsc --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --typeRoots node_modules/.pnpm/@types+node@26.6.1/node_modules/@types --types node apps/ledger-suit/tests/e2e/shared-ui-foundation.spec.ts apps/shop-suit/tests/e2e/shared-ui-foundation.spec.ts
```

An initial standalone TypeScript attempt without the workspace's nested Node type root failed with TS2688; the command above resolves those installed types without changing dependencies. Turbo reported read-only cache-write warnings; the uncached build and typecheck tasks themselves exited successfully.

## Other blockers and limits

`pnpm agent:preflight` exited 1: fetch/GitHub state could not be verified. Live branch/PR/upstream state is unverified. Work stayed in the supplied worktree; no commit, push, merge or deployment was performed.

The inherited `suit-ui-boundary-debt.json` remains in **migration** mode with 3,809 recorded violations. `pnpm check` passes that migration contract; it does not establish zero-debt strict acceptance under R026. This task adds browser coverage and does not expand into the remaining source migration. Strict foundation completion and passing rendered acceptance are not claimed.

No schema, migration, database-test or database-runner files changed; `pnpm db:test:shop` was not applicable and was not run. No hosted databases were modified.

## Retry-2 repair — BS-UI-ZN-BROWSER-001

Independent verification run 297 executed the browser suites and recorded 16 passing / 4 failing Ledger cases and 22 passing / 2 failing Shop cases, including repetitions. Its logs identify three distinct causes:

- Ledger account activity is gated by `accounts.read`, `reports.read` and `transactions.read`. The synthetic owner fixture lacked `reports.read`, so the account name rendered without an activity button. The fixture now supplies that required capability; production authorization is unchanged.
- Ledger's shared signup wizard renders the default return action as `Previous`. The test now selects that exact accessible name and retains the owner-value and current-step assertions.
- Shop's shared line-item remove action includes the row label: `Remove: Haircut`. The test now selects that exact accessible name and retains the assertion that the quantity control disappears after removal.

No product or shared component implementation changed. Existing test coverage and required browser commands remain intact; no skips or success overrides were added.

Local repair source checks passed: `pnpm check`, `pnpm typecheck` (five apps, three cached), app-scoped ESLint for the two specs and Ledger fixture, the standalone TypeScript command above, and `git diff --check`. The initial root-scoped ESLint invocation ignored the app files; the subsequent app-scoped invocations checked them successfully.

`pnpm build` also passed: Ledger, Shop, Inventory, Automation and Docs, five successful tasks and zero cached results. Turbo emitted read-only cache-write warnings; build and typecheck commands exited 0.

After the corrections and completed builds, both exact required Playwright commands listed above were rerun. Each exited 1 with `Process from config.webServer exited early`, before any browser case ran. Direct server diagnosis confirms `listen EPERM: operation not permitted` on Ledger's `127.0.0.1:3210` and Shop's `127.0.0.1:4421`. No required check was skipped or replaced by source checks.

Browser verification remains required and the repair is **blocked / not complete**. This sandbox denies local listening sockets, so the local repair cannot establish passing rendered states or screenshot review. Independent final verification belongs to the control plane, in an environment that can start the configured local servers and Chromium. The original verification logs remain unchanged.

## Retry-3 repair — BS-UI-ZN-BROWSER-001

The retry-2 independent probe passed 18/20 Ledger cases and 23/24 Shop cases. The earlier capability, wizard-back and POS-remove corrections are preserved. The remaining failures were investigated using that probe's summaries, logs, Ledger accessibility snapshot and Shop trace:

- Ledger's exact `Account` column-header lookup found no match because `BsDataTable` supplied both PrimeVue's `header` prop and a header slot containing the same label. PrimeVue rendered both, giving the header the accessible name `AccountAccount`. The shared wrapper now uses the ordinary header prop for default headings and only supplies a header slot when the consumer provides one. A custom heading replaces the default label; `export-header` retains the configured CSV label. The exact-name browser assertion is unchanged.
- Shop's readiness assertion only checked that `__vue_app__` existed. The failing trace shows the name input filled while its bound `value` was still empty, followed by email/password model updates and a failed wizard advance. The signup test now waits for Nuxt's `isHydrating === false` before filling any inputs. It retains all forward/back, preserved-value, provisioning and invalid-OTP assertions, without sleeps, retries or skips.

Unlike the earlier fixture-only corrections, this repair changes shared table presentation in `packages/ui/src/organisms/BsDataTable.vue`. It does not change product validation, sorting, authorization or database behavior. The existing Ledger exact-heading/sort assertion covers the reported table regression; the complete Ledger and Shop suites remain required.

Local source checks passed: `pnpm check`, the four shared/product test files listed above, targeted ESLint for `BsDataTable.vue` and the Shop foundation spec, the standalone TypeScript command above, and `git diff --check`. `pnpm build` and `pnpm typecheck` each passed all five apps with zero cached tasks. Turbo emitted read-only cache-write warnings; both commands exited 0.

After the builds completed, both exact required browser commands were rerun and exited 1 before any tests ran (`Process from config.webServer exited early`). Direct server diagnosis reports `listen EPERM: operation not permitted` on Ledger's `127.0.0.1:3210` and Shop's `127.0.0.1:4421`. Browser acceptance and after-change screenshot review remain **blocked / not verified**; these source repairs must still pass independent control-plane verification where the configured local servers can listen. No required browser check has been waived.
