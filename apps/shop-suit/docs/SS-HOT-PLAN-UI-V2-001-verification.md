# SS-HOT-PLAN-UI-V2-001 verification

## Implemented scope

- Public pricing and owner billing use the same Shop-owned plan-card presentation. The UI reads the existing public and owner catalogs and has no Ledger runtime dependency.
- The catalog is presented as exactly three families: Solo, Team, and Multi. Monthly/yearly and Multi 2/3 controls select immutable server terms; the browser does not define commercial prices or limits.
- Yearly cards show the monthly-times-twelve original price, the discount derived from the server terms, the exact yearly charge, and its monthly equivalent.
- Every card explains all six enforced resource limits. Multi changes its price and limits inside one card. Owner billing also shows exact downgrade blockers and the non-destructive over-limit policy.
- The selected family, Multi variant, billing interval, effective quote, and negotiated/public-list distinction remain visible at the existing manual InstaPay submission boundary. Submission still starts review and never activates access.
- The existing Shop landing layout supplies the canonical Shop Suit logo. English/Arabic, LTR/RTL, responsive, keyboard, and screen-reader scenarios are covered in the plan-owner browser specification.

## Verification commands

- `pnpm --filter @building-suit/shop-suit typecheck`
- `pnpm --filter @building-suit/shop-suit lint`
- `pnpm --filter @building-suit/shop-suit build`
- `node --test apps/shop-suit/tests/unit/*.test.mjs`
- `node --test apps/shop-suit/tests/unit/plan-ui.test.mjs apps/shop-suit/tests/unit/plan-catalog.test.mjs apps/shop-suit/tests/unit/billing.test.mjs apps/shop-suit/tests/unit/public-legal.test.mjs`
- `pnpm exec playwright test apps/shop-suit/tests/e2e/plan-owner.spec.ts -c apps/shop-suit/playwright.config.ts --workers=1 --retries=0`
- `pnpm check`
- `git diff --check`

The browser command requires an environment that permits a localhost listener on `127.0.0.1:4421`.

## Retry 5 repair — 2026-10-01

The recorded browser run failed the public pricing and English/Arabic Multi-switch scenarios twice (six failures; 30 billing scenarios passed). The landing motion hides pricing with `visibility: hidden` until its scroll trigger runs. Those tests stayed at the hero, so role locators could not find the hidden radio controls. Both public test paths now scroll to `#pricing` and assert that the plan cards are visible before interacting. Existing price, limit, keyboard and accessible-name assertions remain intact; product code is unchanged by this repair.

- Passed: `pnpm --filter @building-suit/shop-suit lint`, `node --test apps/shop-suit/tests/unit/plan-ui.test.mjs`, `git diff --check`.
- Attempted the exact failed verifier before and after the repair: `pnpm --filter @building-suit/shop-suit exec playwright test tests/e2e/plan-owner.spec.ts --workers=1 --retries=0 --repeat-each=2`. Both attempts exited 1 before running tests because the configured web server exited early. Running that server directly confirmed `listen EPERM: operation not permitted 127.0.0.1:4421` in this sandbox.
- `pnpm agent:preflight` also failed; GitHub/fetch state remains unverified. No branch, commit, publication, deployment or database changes were made.

Repair verification remains blocked on running the exact browser command in an environment that allows its localhost listener. This repair is not marked complete; independent final verification belongs to the control plane.

## Arabic resource-limit repair — 2026-10-01

The Arabic resource-limit failure came from the plan-owner Playwright configuration launching an existing `.output` artifact without rebuilding it. `reuseExistingServer` was already disabled, but that only forced a new server process; it did not ensure that the server bundle matched the current worktree source. The failing artifact predated `PlanResourceLimits.vue` and still contained the earlier formatter.

A Chromium runtime probe confirmed that `Intl.NumberFormat('ar-EG', { numberingSystem: 'arab' })` formats `2000` as `٢٬٠٠٠` and resolves to the `arab` numbering system. No Shop test setup or runtime code replaces `Intl.NumberFormat`. The component therefore keeps the locale-specific formatter, while `playwright.plan-ui.config.ts` now builds the current Shop Suit worktree before starting its test server.

- Passed: focused Arabic Multi-switch test (`1 passed`).
- Passed: focused English Multi-switch test (`1 passed`).
- Passed: full `plan-owner.spec.ts` suite (`18 passed`).
- Passed: `pnpm --filter @building-suit/shop-suit typecheck`.
- Passed: `pnpm --filter @building-suit/shop-suit lint`.
- Passed: `pnpm --filter @building-suit/shop-suit build`.
- Passed: `node --test apps/shop-suit/tests/unit/plan-ui.test.mjs`.
- Passed: `git diff --check`.
