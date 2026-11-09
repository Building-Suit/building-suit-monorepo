# Adaptive HQ dispatch: source proposal and limits

## Status and scope

[The SQL proposal](proposed-migrations/hq_live_dispatch_adaptive.sql) is disposable source only, built on the applied `20261109150515_hq_live_dispatch_activation.sql` shape. It is not a deployment migration and installs no cron job. No activation, hosted repair, worker restart, claim or finish retry is authorized by this document. It does not establish that the observed staging timeout is resolved.

The proposal removes dispatcher-state locks and scheduler/transport calls from `live_enqueue_v2`, and removes synchronous transport from `workforce_wake`. Producers validate and deduplicate within their transaction, then append an outbox row atomically with the business change. A failed append still fails that transaction; errors are not swallowed to manufacture success.

## Event and authorization contracts

- Existing browser events remain version 2: `invalidate` and `presence`, privately delivered to `hq-live` with their existing payload fields plus the receipt ID.
- Jobs wakes use version 3 only: `kind='agents'`, `event='jobs'`, stored payload exactly `{}`. Delivery is privately routed to `hq-agent-jobs` with exactly `{id: <outbox UUID>}`.
- Constraints enforce jobs if and only if version 3. There is no caller-controlled topic or arbitrary routing. A separate pending index covers version 3; the existing version 2 index remains.
- Legacy version 1 rows remain quarantined. Existing rows, owners, grants and browser authorization policies are not rewritten.
- Existing `circuit_open`/`last_error` remain browser-only. New `jobs_circuit_open`/`jobs_last_error` isolate jobs failures. Neither lane automatically reopens or resets the other. Six committed reservations per event, token fencing, publication verification and lease authority remain unchanged.

The [worker consumer](worker.mjs) filters the private jobs topic, requests a queue drain on broadcasts, and treats only `kind='roster'` specially. An ID-only jobs hint does not authorize work or substitute for a claim, lease or accepted finish receipt.

## Wake mechanism and cost

A separately reviewed owner setup would install `hq-live-watchdog`, scheduled `* * * * *`, calling `hq_private.live_dispatch_watchdog()`. It arms the existing `hq-live-once` job at one-second intervals only for eligible due work. The hot dispatcher removes its wake when drained or when only future/blocked work remains. The cold watchdog never depends on a producer updating shared state.

Nominal idle cost is **1,440 cold launches per day**, plus connection work and cron run-log retention. Continuous hot activity can add **86,400 hot launches per day**, for **87,840 total**, before operational variation. These counts are not a free-tier, pricing or negligible-cost claim. One publication per hot tick limits throughput to roughly 60 events/minute before overhead.

Nominal cold delivery can take about **61 seconds**, plus connection, scheduling and backlog time. A future retry may wait another cold interval after its minimum retry deadline. Outages, authentication failures, resource limits and lock contention have **no finite delivery bound** here; failures before reservation are not covered by the six-reservation budget. Five-minute cold polling would reduce idle launches to 288/day but is not selected: its delay exceeds the existing 150-second presence freshness window.

## Old callbacks and activation prerequisites

The saved old dispatcher body selects only version 2. It therefore cannot reserve a version 3 jobs row or open the browser breaker for a jobs failure, even if its first selection occurs after replacement. An old callback can still cancel the shared hot wake; the independent watchdog recovers eligible work. This is an explicit data-version fence, not an assertion that no old invocation exists.

Any future activation needs a separately reviewed forward migration, exact staging target/source/ACL checks, scheduler-name collision checks, and one atomic transaction with bounded lock acquisition. Constraint and index DDL can wait on active outbox publishers; the source proposal is not a zero-blocking deployment recipe. Existing circuits, pending reservations and legacy data must be preserved. No new credentials, memberships or application execution grants are needed. Pausing dispatch must retain append-only producers and durable rows, not restore synchronous publication or unrestricted legacy flushing.

## Guarded activation candidate: stored unnamed job

[The forward activation candidate](../../apps/company-hq/supabase/migrations/20261109182552_hq_live_dispatch_adaptive_activation.sql) embeds the reviewed proposal unchanged, but installs its cold watchdog through the existing **two-argument** `cron.schedule(schedule, command)` API. This creates a fresh unnamed job rather than upserting a shared name. Its returned ID is stored in private `hq_private.live_dispatch_state.watchdog_job_id` within the same transaction. Hosted `postgres` has only SELECT access to `cron.job`; the wrapper neither requests additional access nor uses direct writes or row locks there.

Monitoring and any authorized pause must resolve that stored ID and verify its owner, database, host/port, command, active flag and minute schedule. Do not infer identity from the illustrative `hq-live-watchdog` name above. The existing hot job remains named `hq-live-once`; an inactive or unexpected hot job causes preflight to stop rather than silently overriding a pause.

The wrapper acquires bounded locks in existing producer order: dispatch state, then outbox. It snapshots all old rows and state, checks source/ACL/configuration/constraint/index drift, and preserves every preexisting cron row. Only the two jobs-lane fields and stored watchdog ID are added. The outer deployer must commit the complete migration and its history entry together; the SQL authors no inner transaction boundary.

A timeout or uncertain commit is not permission to repeat installation. Read back migration history, exact installed definitions, the private stored ID, the matching cron row and retained state before deciding whether the transaction committed. Partial or conflicting evidence stops recovery; do not adopt an existing job, reset circuits, delete legacy rows or rerun inference. Native append-only scheduling and rollback evidence are still required for this activation candidate.

## Evidence and remaining limits

Recorded local source-only checks: **2/2 passed** across [baseline source smoke](live-dispatch-native-source.test.mjs) and [adaptive source smoke](live-dispatch-wake-source.test.mjs). The adaptive check exercises the migrated claim/finish path without a cron schema and with synchronous transport forced to fail, along with jobs-envelope and lease checks. This is not native scheduler or lock-concurrency proof.

[The isolated native regression draft](live-dispatch-wake-native-check.mjs) and [disposable workflow](../../.github/workflows/hq-live-dispatch-wake-disposable.yml) cover real PostgreSQL/pg_cron, held scheduler/state/transport locks, cancellation, version fencing and independent circuits. **Native execution remains unrun for this proposal**. Independent source security review found no source-publication blocker after the version-3/lane changes; that is not activation approval or runtime verification. Source-only draft publication for CI is authorized; this is distinct from deployment readiness. Exact-head native results and independent activation review remain required before any readiness or activation claim.

Other synchronous private jobs publishers, including roster and some chat paths in `apps/company-hq/supabase/migrations/`, remain outside this correction. Do not generalize these changes to all producers.

A completed inference journal is not proof that the server accepted its finish. An expired lease can produce `accepted:true, discarded:true`; that is not accepted task completion. [Durable journal delivery](worker.mjs) retries delivery only and never invokes inference. This proposal neither authorizes an inference rerun nor recovers/reassigns an expired job.
