# Staffing request coalescing, 10 November 2026

The staffing projection subscribes the same refresh to both `company` and
`agents`. A single SSE chunk carrying both topics previously dispatched a
snapshot and marked that same snapshot dirty before any response could arrive,
causing an unnecessary second request. Eager identity/mount hooks had the same
same-turn duplication when founder access was already available.

The projection now shares a single promise only until dispatch in the next
microtask. It does not share an already-dispatched request as fresh data:
invalidations during that request still set the existing dirty follow-up.
Initial eager reads remain, so a failed or delayed stream handshake does not
block initial staffing data. Each later stream-ready snapshot remains fresh.
No server authorization, origin/header protection, expiry, cache, event-loss
recovery, data isolation, provider settings or preview-build policy changes.

## Deterministic before/after evidence

Against base `65ea0ccc3de2d79b04e2cb992c9e219a44bf66bd`, run the new
`apps/company-hq/tests/unit/staffing-refresh.test.mjs` with the original and
changed composable. It uses actual Vue reactivity, the actual staffing
composable and actual stream hub with generated fetch responses, no hosted
service or database traffic.

- 100 separate mixed company/agents bursts: **200 → 100 staffing requests**.
- Known-founder identity/mount in one turn, before handshake: **2 → 1**.
- Delayed-founder initial fetch then ready: **2 → 2**, intentionally preserved.
- Settled transport failure/reconnect ready: **1 → 1**, unchanged because the
  existing hub already deduplicates shared callbacks on ready. There is no
  routine five-minute reconnect request reduction claimed.
- Eager read completed before mounting, then mount then ready: **3 → 3**,
  intentionally preserved because these snapshots happen at separate times.
- Events after dispatch retain one fresh follow-up. Hidden/offline live events
  do not fetch; resumed ready recovers. Denial/disposal before dispatch prevents
  the queued read. Failed reads remain unavailable and later ready retries.

These counts are scoped request-work reductions, not a measured reduction in
Vercel billed CPU or a claim that every live invalidation contains both topics.
No live load test was run.

## Verification

- PASS: 20 focused staffing refresh/BFF/transport tests, including actual
  promise identity, in-flight denial/disposal and settled reconnect coverage.
- PASS: HQ unit/transport suite, 230 passed, one existing skip (before adding
  the final standalone reconnect assertion, also passing in the focused run).
- PASS: HQ typecheck; HQ ESLint with nine existing attribute-order warnings;
  node-server production build; design-token/workspace boundaries; release
  classification and diff checks. Node 24.22.1, existing locked dependencies.
- Independent review found no blockers.
- Full repository unit attempt: 3,035 passed, 24 skipped, six failures due to
  this cloud fixture environment: missing Doctor mobile core-js dependency,
  four missing Playwright browser executable cases, and the Turbo cache fixture
  invoking an unconfigured global pnpm 11 instead of repository pnpm 10.33.0.
  This is not a full local suite pass. Initial workspace dependency links were
  corrected before this final aggregate run; no repository workaround was added.
- Automated preflight cannot complete because cloud gh CLI is unauthenticated.
  Fallback git fetch/worktree inspection plus authenticated GitHub connector
  PR/head/topology checks are required before publication and merge.

Full required CI must pass at the exact published head before a coordinated
history-preserving staging merge. No live load test, production promotion or
database rollout is part of this task.
