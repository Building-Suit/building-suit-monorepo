# Claim query budget and trial refreshes

This source change reduces repeated work. It does not establish the cause of the
9 November hosted claim timeout or authorize worker recovery.

## Scope

The forward migration `20261110002441_hq_skill_evidence_plan_reuse.sql` changes
only the implementation language of the existing private
`workforce_skill_evidence_valid(text,text)` helper. It verifies the expected SQL
predecessor, then returns its exact SELECT through PL/pgSQL. The MATERIALIZED
binding, every evidence predicate, function identity/owner/ACL, STABLE snapshot,
SECURITY DEFINER and empty search path remain. Plans can be reused; qualification
results are never cached. No timeout, planner, lease, authorization, uncertain,
worker, Realtime or provider setting changes.

The HQ client now shares a trials-read queue across mount, live, manual and
post-command callers. One read runs at a time and a dirty bit retains a fresh
follow-up. Callers await that follow-up, including commands completed during an
older read. Identity/epoch changes and invalidation abort the old scope; late
results cannot publish. Each read has the existing client read budget and no
automatic retry. The live-topic queue, server authorization and response
validation remain unchanged. This is per-instance request coalescing, not a
result cache, polling timer or cross-user cache.

## Evidence and limits

The incident log explicitly says `canceling statement due to statement timeout`.
Its referenced enrichment line is only a JSON null check after earlier work.
Concurrent trial-status and office-observation timeouts show overlapping slow
requests, not a proven CPU or lock mechanism. No historical wait/CPU capture is
available. Current statistics have planning/function tracking disabled and cannot
attribute that failed statement.

Disposable PGlite 0.3.14, using real repository qualification flows with synthetic
CLI/provider contracts, measured the original skill SELECT at 7.533 ms planning
and 1.019 ms execution. In one warm-session comparison, the median queued repository claim
changed from 53.708 to 23.994 ms, and trial status from 411.987 to 282.319 ms. These
are samples, not CI thresholds or hosted guarantees. The hosted 8–10 second
failure was not reproduced. The fixture initially had 13 agents, five qualified
trials and 40 jobs. It does not reproduce the hosted pool, Realtime provider or
historical load.

An actual-composable diagnostic on the previous source demonstrated two
simultaneous trials reads when a manual refresh overlapped a live refresh,
although agents reads remained serialized. Ordinary live-event bursts already
coalesced correctly. The new tests cover mixed sources, mount/readiness overlap,
post-command freshness, timeout/failure draining and scope cleanup.

## Verification

- `node --test tooling/hq-agent-host/claim-query-budget-db.test.mjs`
- `node --test tooling/hq-agent-host/claim-query-budget-workflow.test.mjs`
- `node --test tooling/hq-agent-host/public-repository-db.test.mjs`
- `node --test apps/company-hq/tests/unit/staging-migration-parity.test.mjs`
- `node --experimental-strip-types --test apps/company-hq/tests/unit/agents-refresh-coalescing.test.mjs apps/company-hq/tests/unit/research-trial-controls.test.mjs apps/company-hq/tests/unit/task-cancellation-controls.test.mjs`

The SQL checks compare the exact SELECT, metadata, skill results and full status;
exercise rejection, current-binding drift and rollback; deny direct access to
anon/authenticated/service_role; and compare immutable evidence snapshots.
Existing repository test bodies reuse the extracted fixture without changing
their workflow assertions.

The native harness `claim-query-budget-native-check.mjs` accepts no arbitrary
DSN. It runs only against a fresh, named disposable PostgreSQL database using
fixed synthetic credentials. It observes concurrent session lock waits directly,
then verifies completion, rollback-preserved queue/leases and fresh committed
binding changes. A separate owned container uses the existing pinned native
image and internal network. The existing Realtime matrix and browser obligations
remain intact. Native execution is a required CI result, not a local pass when
Docker/PostgreSQL are unavailable.

Publication and deployment remain separate. Keep the real queued task, journals,
immutable receipts and fail-closed worker state intact; do not recreate or retry
work merely to benchmark this change.
