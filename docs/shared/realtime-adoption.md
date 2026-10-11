# Cross-Suit realtime review

BS-REALTIME-ADOPTION-001 addresses BS-LAUNCH-R14 after the task's supplied SS-VAL-001 qualification dependency was marked complete. This review does not requalify Shop or change its passed launch status. Its findings apply only to the reviewed checkout, not unpublished work in other worktrees or live provider settings.

The machine-readable [evidence matrix](realtime-adoption.json) records the reviewed commit, source anchors and exact prerequisites. No new subscriptions are enabled: none of the other current Suits has both a useful implemented workflow and verified subscription prerequisites.

| Suit | Decision | Concurrent-update evidence | Current behavior and prerequisite |
| --- | --- | --- | --- |
| Ledger | Blocked | Journal posting/approval/reversal affects other readers' journal, balances and reports; notifications/team administration can also change in another session. | Local revision watchers and manual refresh remain. There is no publication declaration in maintained Ledger migrations. Verify product-owned table eligibility, event delivery, RLS/capability isolation and session lifecycle before subscribing. |
| Inventory | Intentionally not needed | Only the bootstrap welcome page exists; no current business query or writer. | No subscription. Reassess stock/reservation/count readers when tenant/warehouse authorization and their business schema exist. Future requirements do not establish present adoption. |
| Automation | Blocked | Runners update tasks, executions, verification and incidents concurrently; operators can update projects/policies. | Overview polling and explicit task refresh remain. Direct server PostgreSQL and Basic dashboard authentication provide no Supabase browser event/auth contract. An authorized transport design is prerequisite. |

Ledger's `useTransactionWorkspace` already uses scoped keys, abortable authorized RPC reads and local revision invalidation. These are useful foundations, but neither they nor `[realtime]` configuration prove a publication exists. No hosted database was inspected or modified; absence of repository declarations is not a claim about live dashboard configuration. Reports have dependencies beyond transactions, so a future adoption must map all relevant source tables rather than assume a single transaction event refreshes every report correctly.

Any adopted feature must use `createScopedRealtime` from `packages/data-access`, with product-owned queries and filters. Follow [the shared lifecycle contract](realtime.md): instantiate once on the client, invalidate immediately on auth/session/tenant/location/query changes, observe lifecycle promises, suppress stale async results, dispose on unmount, and reconcile on initial join/reconnect through the shared throttle. Refresh authoritative reads without overwriting an open draft. These per-Suit integration checks are **not applicable in this review because no flow is adopted**, not reported as passed. The shared foundation suite verifies controller behavior with a deterministic transport; it does not prove provider delivery or product RLS.

The task-owned regression test validates complete active-Suit coverage, referenced source evidence and the conditions supporting these decisions, and rejects a product-local Postgres Changes subscription bypass. It must be revisited when those source conditions change. Workspace ownership checks remain the broader cross-Suit boundary gate.

Required local verification commands:

```sh
node --test packages/contracts/tests/bs-realtime-adoption-001-1.test.mjs
node --test packages/contracts/tests/bs-realtime-foundation-001-1.test.mjs
node --test packages/data-access/tests/scope.test.mjs packages/ux/tests/export.test.mjs
pnpm check
pnpm typecheck
pnpm --filter @building-suit/ledger-suit build
pnpm --filter @building-suit/inventory-suit build
pnpm --filter @building-suit/automation-suit build
```

Verification results are recorded below after execution. Builds and mocked controller tests do not replace external transport/security evidence. Neither these adoption prerequisites nor local verification limitations retroactively block Shop qualification.

Local execution on 2026-10-10:

| Command | Actual result |
| --- | --- |
| `node --test packages/contracts/tests/bs-realtime-adoption-001-1.test.mjs` | Passed. Direct execution also confirmed all four review assertions passed. |
| `node --test packages/contracts/tests/bs-realtime-foundation-001-1.test.mjs` | Passed. Direct execution also confirmed all eight shared lifecycle scenarios passed. |
| `node --test packages/data-access/tests/scope.test.mjs packages/ux/tests/export.test.mjs` | Passed, both test files. |
| `pnpm check` | Passed: four dynamically discovered Suits, zero classified local components, 80 historical migrations unchanged; canonical tokens match. |
| `pnpm typecheck` | Initially failed because the ignored docs catalogue was absent. After `pnpm docs:generate` generated 77 documents, the exact root command passed all five app tasks, with zero cached results. |
| `pnpm --filter @building-suit/ledger-suit build` | Passed. |
| `pnpm --filter @building-suit/inventory-suit build` | Passed. |
| `pnpm --filter @building-suit/automation-suit build` | Passed. |
| `pnpm --filter @building-suit/docs build` | Passed after catalogue generation. |
| `git diff --check` | Passed. |
| `pnpm agent:preflight` | Failed, exit 1 wrapping 255; fetch/GitHub state remains unverified. No publication/base changes were made. |

Nuxt warned about absent local Supabase URL/key configuration; root typecheck also warned that the shared cache filesystem was read-only. Successful process exits above do not assert backend connectivity. No live event delivery, hosted publication, database authorization or browser session acceptance was claimed. No Shop database or Playwright files changed, so conditional Shop SQL and changed-spec browser gates do not apply. Changes are limited to this review, its evidence matrix, the shared contract documentation link and the required test. No commit, push, merge, deployment or hosted write occurred.
