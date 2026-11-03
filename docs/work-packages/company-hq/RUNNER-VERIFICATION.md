# CEO/HR integration verification — 3 November 2026

Worktree: `/workspace/company-hq-integration`. Branch: `codex/company-hq/ceo-hr-runner`. Parent: PR #528 / `codex/company-hq/office-design`, verified open at `e3345e503d178d067eb31d2f34d58cc3c75b6716`. No competing HQ leaf existed. The initial primary checkout was clean at `5fb461fe8d74c8aee6bd1bc37962c05080204034`; its files/branch were preserved. The child includes the exact committed parent history and excludes no dirty parent work. Final revision preflight at 22:14 UTC found no policy errors and the parent tip unchanged. `stg` remained `14039a60d9c7e59b1052cca3ee5b97015339c6a1`.

## Passing local checks

- Pinned pnpm 10.33.0 frozen install. The environment's default pnpm 11.25.0 failed the repo engine constraint; a temporary pinned Corepack/pnpm wrapper and writable `/tmp` caches resolved setup without repository or global configuration changes. Node v24.19.0 satisfies HQ's engine range; `.node-version` requests 26.8.1, which was not installed for this run.
- HQ unit/database suite: **46 passed, zero failed/skipped** in the final full-repository run (16 preserved tests plus 30 workflow cases, including 10 added for the independent deadline/capacity review). The direct HQ run before the final lock-delay case passed 45; the added lock-delay case also passed independently.
- Full repository suite: **2,819 tests; 2,796 passed, 23 existing skips, zero failures** on the final source. These are local tests, not GitHub CI. The initial run encountered four missing-Playwright-browser errors and the default pnpm wrapper in an isolated Turbo fixture; installing the pinned Chromium in `/tmp` and supplying the pinned pnpm wrapper resolved them without product changes.
- HQ strict Nuxt typecheck, ESLint and production node-server build. The build retains `node:sqlite` as an intentional external Node module; no paid/provider SDK was added.
- Production-build browser suite: **6 passed**. Exact 1440×1000 approved office screenshot with zero allowed differences; founder login/messages/approval and CEO→HR isolation; Arabic/RTL, theme/mobile/keyboard/error recovery; HTTP guards; fixed-role MCP tools; new founder-only workflow approval and cancellation. Synthetic request authorization does not start a model or worker. The first revision run mistakenly selected bundled Chromium and failed the exact screenshot; the configured system Chromium then showed a four-pixel comparison failure at rounded edges. After the final build, the unchanged exact screenshot passed. Earlier failure logs/images are retained; no baseline, threshold or UI source was changed.
- Root `pnpm check`: generated tokens and workspace boundaries passed; 151 complete page templates, zero migration debt, existing 80 historical migrations unchanged.
- Strict template boundary: 175 Vue files, zero violations.
- `git diff --check`: passed.

Committed release classification passed using `RELEASE_BASE_SHA=e3345e503d178d067eb31d2f34d58cc3c75b6716 pnpm release:check`: task provenance and current main-to-staging net coverage/evidence passed. The fragment is internal Company HQ provenance; no operational Suit is activated for bookkeeping.

## Independent deadline/capacity review

The revision follows local commit `f0552027b19a0e4ffb8be83471596ebf63372dbe` on the same child branch. It replaces the fixed 30-second stage bound with validated host limits (defaults: ten-minute stage, one-minute adapter, three-minute inference, one-minute renewable lease). Renewal remains fenced and cannot revive expiry. Monotonic deadlines are inherited by nested calls and rechecked after acquiring the writer lock, so a blocked event loop cannot dispatch a model after the deadline.

A real wall-clock test completed sixteen 1.5-second synthetic Brain reads plus an 11-second synthetic inference in about 35 seconds. Concurrent claim attempts remained excluded using one-second test leases. Additional tests cover noncooperative reads/auth/reservation/inference, overall timeout, cancellation during slow reads/inference, a replacement owner's protection from late results, and a 200 ms blocked writer against a 150 ms stage deadline. These are latency/correctness tests, not real model executions.

Content-addressed Brain snapshots preserve exact source ID, revision and text once, with separate access timestamps on every evidence reference. A reopened SQLite database reconstructed all original Brain files, resumed committed stages without repeating Noah and reused the same 16 snapshots. Legacy inline evidence stays readable; missing/corrupt snapshots and changed text under an unchanged revision fail closed. Completed replay and daily reuse retain deterministic delivery behavior.

The unchanged 8 MB capacity guard now accounts for reserved result bytes on every writer. Tests prove refusal before allowance reservation/inference, no history deletion, exclusion of competing writes, persisted reservations across reopen, fenced reclaim, and maximum JSON-escaped tool/source/output/review evidence near the capacity ceiling. Rejected reviews and failure history are retained without automatic slicing. This does not provide unlimited history: conservative stage reservations can stop new work before the physical limit, and an authorized export/archive strategy remains outstanding.

## Behavioral evidence and limits

Tests exercise actual SQLite persistence, reopen/restart, two separate connections and two independent competing Node processes. They cover retained historical identities; founder authorization and immutable tools/Brain/public-input scope; semantic replay with reordered source maps; disabled readiness; unavailable/stale/revoked Brain; model auth/quota and provider scope; fresh snapshots and policy revision changes; ordered four-stage routing; rejected/stale/self-review; persisted rejected review evidence; scoped tool calls and ignored denials; caller and persistent cancellation; lease fencing; bounded retries and durable reservations; Cairo DST/local dates; daily duplicate claims; rollback/retry of the atomic HQ inbox outbox; company database isolation; and model authorization revoked before delivery.

All model, Brain and public-tool adapters in automated tests are **synthetic**. The existing Postgres tests use disposable PGlite, not hosted Supabase. Real model execution, provider-enforced context isolation, worker-side live connector authorization, hosted durability, a real timer invocation and external founder notification are **unrun and unverified**. No active scheduler, hosted worker, credentials, paid fallback, Brain write or external message was created. Read-only live Drive inspection is not evidence of a deployed worker connector.

The runtime accepts only the dedicated SQLite store. The remote runner, quota/auth reservation implementation, model provider adapter, live Brain/public-source adapters, real scheduler wiring, missed-day/outage reporting and any external delivery reconciliation remain operational integration work subject to verified scope and $0 capacity. Africa/Cairo is still an assumption; daily approval explicitly requires confirmation. 08:00 starts work and does not promise a completed report then.

## GitHub CI context from the parent

The parent reported a Doctor Android synthetic API 29 emulator-runner failure for base `e3345e5` in [workflow run 41721252657](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/41721252657), while the build and API 36 passed. Cause and current-head CI status were not independently verified here. This is distinct from passing local HQ/repository tests. No claim is made that all repository CI passed, and no unrelated Android changes were made.

## Delivery boundaries

The current branch and complete patch are local deliverables only. No push, child PR, merge, staging promotion, hosted migration or deployment was attempted. The owner branch and PR #528 were preserved. Further publication needs explicit authorization; do not infer it from a passing test or this document.
