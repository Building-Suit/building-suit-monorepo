# SS-VAL-001 — Current Shop first-launch qualification

Date: 2026-10-10. **Qualification BLOCKED; review package implemented.**
This report replaces historical roadmap-driven launch qualification for
SS-LAUNCH-R01 through SS-LAUNCH-R13. ETA, offline operation, optional private
offers and deferred roadmap packages do not become first-launch prerequisites.
Existing safety checks remain required; excluding optional features does not
relax tenant, payment, inventory, permission or audit invariants.

Candidate: `codex/shop-suit/ss-val-001`, committed baseline
`80e24abef406669e5bb4226b42348620e1bde39d` plus the uncommitted task changes.
This SHA identifies the source baseline, not a deployed or accepted artifact.
No commit, push, merge, deployment, provider mutation or hosted database change
was performed. Preflight failed (exit 1): GitHub/fetch state is unverified.

## Repeatable local gate

From this worktree root:

```sh
node apps/shop-suit/tests/run-launch-qualification.mjs --list
node apps/shop-suit/tests/run-launch-qualification.mjs --run
```

The [matrix](../tests/launch-qualification.json) binds each requirement to
implementation paths and exact executable checks. The runner continues after
failures, journals argv, working directory, duration and exit code in
[local results](SS-VAL-001-results.json), and exits nonzero if any check fails.
Run it only with the disposable local Shop database. `pnpm db:test:shop` may
apply existing local migrations and repairs synthetic fixtures in the fixed
local Shop container; it does not reset or target a hosted database.
The full root `pnpm test`, original baseline review, `pnpm check`, environment
isolation, quality, focused SQL, security advisors and browser suites remain
required. No optional private-offer runner is added to the launch gate.

The task browser entry point preserves 101 existing cases from Team, cash
policy, Fast Pay, POS customer selection, sale copy and realtime. Auth OTP,
Solo variants, support, legal and Inventory/Purchases run with their own
existing transports/configs. All browser runs use one worker and zero retries.
Synthetic protocol/UI tests establish rendered behavior only; SQL tests and
real-provider evidence are separate. Discovery is not browser execution.

## Requirement evidence and status

“Implemented” describes source present in the candidate. Every local requirement
remains partially checked because its browser/DB evidence could not run here.
Independent verification is **pending control-plane verification** for all rows.
Provider configuration, deployment and production smoke status are **unverified**
for all rows; no local result promotes those statuses.

| Requirement | Implementation evidence | Local qualification |
|---|---|---|
| SS-LAUNCH-R01 — Clean launch baseline and legacy commercial copy | [index.vue](../app/pages/inventory/index.vue), [index.vue](../app/pages/purchases/index.vue) | Blocked; see bound checks in matrix |
| SS-LAUNCH-R02 — Safe existing-email signup handling | [signup.vue](../app/pages/auth/signup.vue) | Blocked; see bound checks in matrix |
| SS-LAUNCH-R03 — Ledger-parity Shop team, roles and permissions | [team.vue](../app/pages/team.vue), [20261007010000_launch_team_controls.sql](../supabase/migrations/20261007010000_launch_team_controls.sql) | Blocked; see bound checks in matrix |
| SS-LAUNCH-R04 — Optional open-cashier-shift enforcement | [launch-cash-policy.md](../docs/readiness/launch-cash-policy.md) | Blocked; see bound checks in matrix |
| SS-LAUNCH-R05 — Functional Contact Us email delivery | [SS-LAUNCH-SUPPORT-001.md](../docs/SS-LAUNCH-SUPPORT-001.md), [20261008160000_support_notification_delivery.sql](../supabase/migrations/20261008160000_support_notification_delivery.sql) | Blocked; see bound checks in matrix |
| SS-LAUNCH-R06 — Public canonical Shop branding | [nuxt.config.ts](../nuxt.config.ts), [ss-launch-brand-001-2.test.mjs](../tests/unit/ss-launch-brand-001-2.test.mjs) | Blocked; see bound checks in matrix |
| SS-LAUNCH-R07 — Solo one-member and two-member variants | [SS-LAUNCH-SOLO-VARIANTS-001.md](../docs/tasks/SS-LAUNCH-SOLO-VARIANTS-001.md) | Blocked; see bound checks in matrix |
| SS-LAUNCH-R08 — Product/service-aware sales messaging | [saleCopy.js](../app/utils/saleCopy.js) | Blocked; see bound checks in matrix |
| SS-LAUNCH-R09 — POS customer dropdown | [pos.vue](../app/pages/pos.vue), [posCustomer.js](../app/utils/posCustomer.js) | Blocked; see bound checks in matrix |
| SS-LAUNCH-R10 — Atomic Fast Pay | [launch-fast-pay.md](../docs/readiness/launch-fast-pay.md) | Blocked; see bound checks in matrix |
| SS-LAUNCH-R11 — One active device/session per user | [session-loss.client.ts](../app/plugins/session-loss.client.ts), [single-session.md](../docs/single-session.md) | Blocked; see bound checks in matrix |
| SS-LAUNCH-R12 — Shop realtime operational refresh | [useShopRealtime.ts](../app/composables/useShopRealtime.ts), [20261010110000_shop_scoped_realtime.sql](../supabase/migrations/20261010110000_shop_scoped_realtime.sql) | Blocked; see bound checks in matrix |
| SS-LAUNCH-R13 — Legal/policy reconciliation against launch behavior | [legal.ts](../app/utils/legal.ts), [SS-LAUNCH-LEGAL-AUDIT-001.md](../docs/SS-LAUNCH-LEGAL-AUDIT-001.md) | Blocked; see bound checks in matrix |

R11 has client session-loss cleanup and local logout implementation; provider-native
single-session enforcement is not established. Code presence does not mean the
one-active-session requirement is satisfied. R05 has durable intake and retryable
outbox code, but acceptance by the form does not establish Resend/inbox delivery.
R12 has scoped subscriptions and database version events; a synthetic websocket
cannot establish deployed publication/RLS behavior.

## External gates

Independent reviewers must bind results to this candidate and retain unresolved
findings. Operators need environment/ref, observation time and evidence without
secrets for each external gate:

- Resend verified sender/domain, scoped secret, dispatcher scheduling, retry
  behavior and observed delivery to `support@building-suit.com`.
- Actual single-session setting and JWT expiry in each Shop environment; two
  isolated real-provider sessions, winner survival and terminated-client cleanup.
- Applied Shop migration versions, Realtime publication, tenant/location isolation
  and invalidation across independent clients without dirty-form overwrite.
- Public HTTPS canonical logo/favicon fetches, Auth callbacks, SMTP, immutable
  Shop project mapping and provider deployment/branch configuration.
- Deployed application SHA and environment, followed by production smoke evidence
  for the launch journeys and authorization boundaries under separate authorization.

These are explicit gates, not requests to change providers to make local review
pass. Hosted inspection/deployment and production smoke were not performed.
Real-device, assistive-technology and native-speaker review are also unverified;
synthetic desktop/phone and bilingual fixtures do not replace them.

## Harness refresh

The inherited plan UI test expected an obsolete local variable for the public
billing request. It now checks the exact current selected catalog terms and slug.
The inherited POS SSR fixture did not resolve launch helper modules or register
the client-only realtime composable. It now supports those imports and supplies
a no-op for SSR, retaining appointment customer lock, disabled action and initial
cart assertions. No product behavior, schema, migration or DB runner changed.

## Executed results

The final full matrix runner exited **1**, correctly retaining failed gates.
Exact commands/argv, working directories and exit codes are in the linked JSON.
Initial stale harness failures were repaired and rerun; results below describe
the final source. No failing check was skipped or marked passed.

| Executed check | Result |
|---|---|
| `node --test apps/shop-suit/tests/unit/ss-val-001-1.test.mjs` | PASS |
| `node --test apps/shop-suit/tests/unit/ss-val-001-2.test.mjs` | PASS |
| `node --test apps/shop-suit/tests/unit/*.test.mjs` | PASS: 45 files, zero failures/skips |
| Original 28-file launch baseline review (exact argv in JSON) | PASS after selected-catalog assertion refresh |
| `pnpm exec turbo run typecheck lint build --filter=@building-suit/shop-suit` | PASS: 3 tasks; 17 existing lint warnings, no errors; local credential/shared-cache warnings |
| `pnpm check`, environment isolation and legacy commercial copy scan | PASS |
| `pnpm test` | FAIL: 91/93 files passed; all Shop files pass; two tooling files fail on denied subprocess access (`spawnSync EPERM`) |
| `pnpm db:test:shop` | FAIL before SQL execution: Docker API permission denied |
| Five launch SQL suites and local security advisors (exact argv in JSON) | FAIL before evidence: CLI telemetry path is read-only (`EROFS`) |
| Required task browser command with one worker / zero retries | FAIL before assertions: fixture server cannot bind `127.0.0.1:46421` (`EPERM`) |
| Auth, support, Solo, single-session, legal and Inventory/Purchases browser commands | FAIL before assertions: configured local servers cannot start; local socket access is denied |
| Task browser command with `--list` | PASS: 101 cases discovered; not browser verification |
| Changed tests/runner ESLint with `--no-ignore` | PASS: no findings |
| `git diff --check` | PASS |
| `pnpm agent:preflight` | FAIL: live GitHub/fetch state unavailable |

The two root tooling failures are `tooling/control-plane/tests/batch-ssh-transport.test.mjs`
and `tooling/git/tests/dev-worktrees.test.mjs`. They remain recorded failures;
this task does not alter unrelated tooling to bypass sandbox restrictions.

Completion blockers: a runtime permitting local Docker, Supabase CLI state files,
local browser sockets and required subprocesses; successful full matrix execution;
independent candidate verification; and the explicit external gates above.
Browser assertions for EN/AR, RTL/LTR, phone/desktop and permission boundaries are
present but **unexecuted** here. Tenant/isolation unit checks passed, while DB
and deployed isolation evidence remain **unverified**. Launch is not approved.
