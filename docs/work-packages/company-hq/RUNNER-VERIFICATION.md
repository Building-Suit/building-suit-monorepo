# CEO/HR integration verification — 3 November 2026

Worktree: `/workspace/company-hq-integration`. Branch: `codex/company-hq/ceo-hr-runner`. Parent: PR #528 / `codex/company-hq/office-design`, verified open at `e3345e503d178d067eb31d2f34d58cc3c75b6716`. No competing HQ leaf existed. The initial primary checkout was clean at `5fb461fe8d74c8aee6bd1bc37962c05080204034`; its files/branch were preserved. The child includes the exact committed parent history and excludes no dirty parent work. Final read-only preflight at 21:46 UTC found no policy errors and the parent tip unchanged. `stg` remained `14039a60d9c7e59b1052cca3ee5b97015339c6a1`.

## Passing local checks

- Pinned pnpm 10.33.0 frozen install. The environment's default pnpm 11.25.0 failed the repo engine constraint; a temporary pinned Corepack/pnpm wrapper and writable `/tmp` caches resolved setup without repository or global configuration changes. Node v24.19.0 satisfies HQ's engine range; `.node-version` requests 26.8.1, which was not installed for this run.
- HQ unit/database suite: **36 passed, zero failed/skipped** (16 preserved tests plus 20 new workflow cases).
- Full repository suite: **2,809 tests; 2,786 passed, 23 existing skips, zero failures**. These are local tests, not GitHub CI. The initial run encountered four missing-Playwright-browser errors and the default pnpm wrapper in an isolated Turbo fixture; installing the pinned Chromium in `/tmp` and supplying the pinned pnpm wrapper resolved them without product changes.
- HQ strict Nuxt typecheck, ESLint and production node-server build. The build retains `node:sqlite` as an intentional external Node module; no paid/provider SDK was added.
- Production-build browser suite: **6 passed**. Exact 1440×1000 approved office screenshot with zero allowed differences; founder login/messages/approval and CEO→HR isolation; Arabic/RTL, theme/mobile/keyboard/error recovery; HTTP guards; fixed-role MCP tools; new founder-only workflow approval and cancellation. Synthetic request authorization does not start a model or worker.
- Root `pnpm check`: generated tokens and workspace boundaries passed; 151 complete page templates, zero migration debt, existing 80 historical migrations unchanged.
- Strict template boundary: 175 Vue files, zero violations.
- `git diff --check`: passed.

Committed release classification passed using `RELEASE_BASE_SHA=e3345e503d178d067eb31d2f34d58cc3c75b6716 pnpm release:check`: task provenance and current main-to-staging net coverage/evidence passed. The fragment is internal Company HQ provenance; no operational Suit is activated for bookkeeping.

## Behavioral evidence and limits

Tests exercise actual SQLite persistence, reopen/restart, two separate connections and two independent competing Node processes. They cover retained historical identities; founder authorization and immutable tools/Brain/public-input scope; semantic replay with reordered source maps; disabled readiness; unavailable/stale/revoked Brain; model auth/quota and provider scope; fresh snapshots and policy revision changes; ordered four-stage routing; rejected/stale/self-review; persisted rejected review evidence; scoped tool calls and ignored denials; caller and persistent cancellation; lease fencing; bounded retries and durable reservations; Cairo DST/local dates; daily duplicate claims; rollback/retry of the atomic HQ inbox outbox; company database isolation; and model authorization revoked before delivery.

All model, Brain and public-tool adapters in automated tests are **synthetic**. The existing Postgres tests use disposable PGlite, not hosted Supabase. Real model execution, provider-enforced context isolation, worker-side live connector authorization, hosted durability, a real timer invocation and external founder notification are **unrun and unverified**. No active scheduler, hosted worker, credentials, paid fallback, Brain write or external message was created. Read-only live Drive inspection is not evidence of a deployed worker connector.

The runtime accepts only the dedicated SQLite store. The remote runner, quota/auth reservation implementation, model provider adapter, live Brain/public-source adapters, real scheduler wiring, missed-day/outage reporting and any external delivery reconciliation remain operational integration work subject to verified scope and $0 capacity. Africa/Cairo is still an assumption; daily approval explicitly requires confirmation. 08:00 starts work and does not promise a completed report then.

## GitHub CI context from the parent

The parent reported a Doctor Android synthetic API 29 emulator-runner failure for base `e3345e5` in [workflow run 41721252657](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/41721252657), while the build and API 36 passed. Cause and current-head CI status were not independently verified here. This is distinct from passing local HQ/repository tests. No claim is made that all repository CI passed, and no unrelated Android changes were made.

## Delivery boundaries

The current branch and complete patch are local deliverables only. No push, child PR, merge, staging promotion, hosted migration or deployment was attempted. The owner branch and PR #528 were preserved. Further publication needs explicit authorization; do not infer it from a passing test or this document.
