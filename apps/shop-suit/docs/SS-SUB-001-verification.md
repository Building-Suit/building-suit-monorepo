# SS-SUB-001 — Commercial lifecycle qualification evidence

## Candidate scope

SS-SUB-001 qualifies the already implemented plan catalog, atomic limits,
manual InstaPay billing, platform controls, and owner UI as one lifecycle. It
adds no hosted change and no payment-provider integration.

The control-plane task record marks every hard prerequisite complete:
SS-PILOT-001, SS-PLAN-CATALOG-001, SS-PLAN-LIMITS-001,
SS-PLAN-BILLING-001, SS-PLAN-ADMIN-001, and SS-PLAN-UI-001.

The integrated rollback-only database fixture covers: idempotent 7-day signup,
owner/employee/observer/operator authorization, negotiated quote isolation,
manual upgrade approval and retry, renewal, explicit downgrade blockers and
data preservation, subscription suspension/reactivation, and the absence of an
automatic provider endpoint. It also reimports a representative grandfathered
Pro first-barber with two locations, normal staff, and a scheduled service. The
full runner executes the broader legacy Basic/Pro fixture, all four concurrent
quota races, concurrent approval retry, and the existing barber domains.

The browser matrix combines:

- `plan-owner.spec.ts`: owner plan/usage/request states in English and Arabic at
  360, 768, and 1440 pixels.
- `subscription-lifecycle.spec.ts`: operator catalog and blocked manual-transfer
  review in the same locale/viewport matrix.

## Traceability

Requirements: SUB-01, SUB-02, SUB-03, SUB-04, SUB-05, SUB-06, SUB-07,
SUB-08, SUB-09, SUB-10, SUB-11, SUB-12, VAL-10, VAL-13.

Approved decisions: ADMIN-D01, BILL-D01, BILL-D02, BILL-D03, BILL-D04,
SUB-D01, SUB-D04, SUB-D05, SUB-D06, SUB-D07, UI-D01.

## Qualification status

- Code implemented: **yes**.
- Automated tests passed: **partial; see exact results below**.
- Manually verified: **no**.
- Deployed: **no**.
- Commercially approved: **no claim made by this task**.

Historical passes from prerequisite branches are supporting evidence, not passes
for this candidate.

## Commands actually run

Passed:

- `node --test apps/shop-suit/tests/unit/*.test.mjs` — 20/20 Shop unit files.
- `pnpm --filter @building-suit/shop-suit lint` — no diagnostics.
- `pnpm check` — canonical token output and workspace boundaries passed; all 80
  historical migrations remained unchanged.
- `pnpm exec playwright test apps/shop-suit/tests/e2e/plan-owner.spec.ts apps/shop-suit/tests/e2e/subscription-lifecycle.spec.ts -c apps/shop-suit/playwright.config.ts --workers=1 --retries=0 --list` — discovered all 14 owner/operator locale/viewport cases.
- `git diff --check`, JavaScript syntax checks, and readiness-matrix count check
  passed during implementation.

Attempted but environment-blocked or failing:

- `pnpm agent:preflight` — failed because fetch/GitHub state was unavailable;
  no publication/base-current claim is made.
- `pnpm install --frozen-lockfile` — failed with `EROFS` while pnpm attempted to
  register the worktree in its read-only home store.
- `pnpm --filter @building-suit/shop-suit typecheck` — reached Nuxt with the
  existing dependency tree, then failed because `gsap` and
  `gsap/ScrollTrigger` are absent from that install.
- `pnpm --filter @building-suit/shop-suit build` — transformed 6,184 client
  modules, then failed on the same missing shared-UX `gsap` import; no server
  output was produced.
- `pnpm db:test:shop` — the mandatory full runner started, then Docker socket
  access was denied before its first suite. No SQL suite or concurrency process
  executed in this environment.
- The exact 14-case Playwright command (one worker, retries disabled) was run,
  but its web server could not start because the blocked build left no
  `.output/server/index.mjs`; no browser case executed.
- `pnpm test` — 60/61 workspace files passed, including all Shop files. The
  unrelated `tooling/git/tests/dev-worktrees.test.mjs` process/worktree harness
  failed without an assertion diagnostic.

## Remaining independent verification

In a normal prepared worktree with Docker access, install the locked dependency
tree, run the full local gate from the runbook, and update this record. In
particular, SS-SUB-001 is not technically qualified until `pnpm db:test:shop`,
Shop typecheck/build, and the exact browser command exit successfully. No manual,
hosted, deployment, or commercial approval is represented by this candidate.
