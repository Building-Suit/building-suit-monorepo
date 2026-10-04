# SS-PLAN-UI-001 verification

## Implemented scope

- The owner billing page reads `shop_billing_read` and the same `shop_public_plan_catalog` used by public pricing. Only catalog-confirmed purchasable, non-coming-soon plans can be requested; a current legacy plan remains visible only in the authoritative current-plan summary.
- Current access shows the exact trial or paid-period end, effective/list price, and negotiated-price state. Four resource meters expose unlimited, available, near-limit, full, and over-limit states.
- Plan comparison shows the four enforced limits. Usage blockers disable an over-limit downgrade and explicitly preserve historical data without automatic deletion or archival.
- InstaPay/manual-transfer submission freezes the visible quote, requires a shared confirmation, and distinguishes submitted, under-review, approved, and rejected states from authoritative active access.
- Product, service, location, invitation, and member-reactivation quota failures identify the exhausted resource and direct the owner to reduce usage or request a higher plan.
- Public pricing uses the canonical server catalog and now shows the same four limit dimensions. Stale card-payment, destructive expiry, and Basic/Pro FAQ copy was removed.

## Automated verification

- `pnpm --filter @building-suit/shop-suit typecheck` — passed.
- `pnpm --filter @building-suit/shop-suit lint` — passed.
- `pnpm --filter @building-suit/shop-suit build` — passed.
- `node --test apps/shop-suit/tests/unit/*.test.mjs` — passed, 19/19 files.
- `pnpm check` — passed; token output and workspace/UI boundaries are valid, and historical migrations are unchanged.
- `pnpm exec playwright test apps/shop-suit/tests/e2e/plan-owner.spec.ts -c apps/shop-suit/playwright.config.ts --workers=1 --retries=0 --list` — passed; 8 English/Arabic phone/tablet/desktop and request-state cases discovered.

## Environment-limited checks

- The required changed Playwright spec was invoked with one worker and retries disabled, but the sandbox rejected the local production server bind with `listen EPERM 127.0.0.1:4421`; no browser case executed. Run the same command in an environment that permits localhost listeners.
- `pnpm test` ran 60 workspace test files: 59 passed and the unrelated `tooling/git/tests/dev-worktrees.test.mjs` failed in its process/worktree harness without an assertion diagnostic. The complete Shop unit subset passed independently afterward.
- `pnpm agent:preflight` could not verify fetch/GitHub state. This task did not publish, push, merge, deploy, or change a hosted database.
