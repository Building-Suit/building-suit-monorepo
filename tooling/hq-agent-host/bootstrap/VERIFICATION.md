# Bootstrap preparation verification — 2026-11-07

Branch: `codex/company-hq/oracle-bootstrap`, based on staging
`2c3f34c65ea4511b7a59f3034a728fa583258f87`. Source preparation only; no host,
private/home network, live SQL, provider setting, credential, unit or timer was
accessed or changed by this task. Private exact installed source was supplied by
the parent under explicit user approval; all three byte counts and SHA256 hashes
were verified locally outside Git. No exported private source is committed.

Completed:

- `node --test --test-concurrency=2 tooling/hq-agent-host/*.test.mjs`:
  **96/96 passed**, including **23/23** pilot/proposal DB integration tests.
  Both public claim overloads remain fenced after all five pilot wrappers;
  heartbeat/finish remain authorized, old helper bypass permissions are absent,
  and the legacy tier-less roster incompatibility is explicitly demonstrated.
- `python3 -m unittest discover -s tooling/hq-agent-host -p '*_test.py'`:
  **60/60 passed**: existing 45 release/publication tests, 10 preparation/record
  tests and **five real concurrent PostgreSQL tests**. Actual Docker PG17 image
  digest was `sha256:ff87138949ad9a46f32ff23bd6852b52ce024a13dffe9b4087be98292cdd3b4f`.
  Containers had no network, host ports, persistent volumes or live credentials;
  the test runner removed them after use.
- Real PG tests exercise claims committed before pause, claims waiting behind a
  committed pause, stale resume/idempotent retries, isolation/permission failure,
  and an already executing old function body across CREATE OR REPLACE while
  blocked outside the queue lock. The actual admission trigger rejects its
  eventual lease write. The earlier-admitted-claim case models its completed
  write under the real lock; full selection behavior is covered by actual
  migration/PGlite integration, not claimed as a second full PG application stack.
- Concrete uncertainty tests cover delayed claim response after cancellation,
  finish committed before journal acknowledgment, and Drive PUT/readback before
  database receipt acknowledgment. The record classifier accepts no IDs or
  payload fields and always returns `mayActivate: false`.
- Pinned `pnpm@10.33.0 check`: canonical tokens and workspace boundaries passed.
- `node_modules/.bin/eslint tooling/hq-agent-host/pilot-proposals-db.test.mjs`:
  passed with no output.
- `node apps/company-hq/supabase/verify-staging-migration-parity.mjs`: all **17**
  active sources and archived never-applied SQL unchanged.
- Release classification check and `git diff --check`: see final task result.

A repeated PG run initially connected to the container's temporary init server,
which then shut down before fixture setup. The harness now waits for postgres to
be PID1 plus pg_isready; final 60-test run passed. An early fixture applied the
strict source-hash fence to an intentionally older/no-meetings DB setup; it now
applies the fence only to the exact supported 17-migration baseline. A speculative
legacy-roster rejection assertion correctly failed: the real SQL accepts it and
clears model tiers, which is now the explicit regression/installation blocker.
No production SQL or existing immutable proposal was weakened to pass tests.

The default pnpm initially resolved to 11.25.0, incompatible with repository
10.33.0; the pinned npm-cache invocation corrected that. Supabase CLI help could
not create its default `/home/agent/.supabase` directory in this executor. No
canonical active migration was generated: that is deliberately deferred until
provider-route coordination and explicit deployment approval. The exact maintained
source command is recorded in README. No hosted migration workflow is asserted.

Full application typecheck/build/browser qualification was not repeated for this
Python/SQL/systemd preparation change; no application/runtime worker module was
changed. Current staging's previously recorded aggregate success is separate
from these new branch checks. No cloud CI or live acceptance is claimed here.

First installation still needs the operator maintenance/reconciliation boundary,
actual authoritative outcomes, complete protected backups, approved migration
path, independent official binary/root provenance, root-owned installed settings,
real managed preflight/health and a genuine compatible rollback baseline. The old
worker cannot retroactively supply a trusted drain receipt. No zero-interruption
legacy conversion, current healthy host, full DB compatibility or timer readiness
is inferred from these disposable results.

## Canonical phase-1 follow-up

Initial preparation commit `3a40fbc3a7163625060c0c4496ad0a2dd3d4bf51` was
pushed. Under the subsequent explicit phase-1 authorization, the pinned repository
CLI generated `20261107022638_hq_worker_admission_fence.sql`. It now includes
only the generic fence/backstop and the exact verified staging worker's initial
pause, in one bounded transaction. Canonical SHA256:
`61dafc8173d8d6613f99de19d3603846d5bbbd7d2e769e0bf9edc086f6d6f685`.

All 17 original migration bytes/hashes remain unchanged. The source verifier
separately pins the pending canonical file and its exact composition, without
claiming it has been applied. All six contract-2 proposals remain outside active
migrations. The parent verified GitHub integration: this repo/stg/apps/company-hq
→ staging dpruoncalmwicrqhqelu, automatic provider deployment. There is no separate
HQ Actions SQL deploy job and no direct connector SQL write is used here.

The SQL reviewer identified a real rollout lock inversion. The migration now
acquires queue → jobs SHARE ROW EXCLUSIVE → worker registry SHARE ROW EXCLUSIVE
before FK/trigger DDL; legacy heartbeat instead proceeds jobs → roster → registry
without the queue lock. Auth reads remain compatible. Migration-only PG17
lock/statement/transaction timeouts are 1/5/8 seconds; a busy migration rolls back
rather than canceling a worker heartbeat. **Nine real PG tests passed**, including
the complete canonical wrapper racing an existing queue holder and the exact
legacy heartbeat paused mid-call. Both renewals around migration succeeded;
initial pause had one working job. Wrong target/extra worker rolls back all DDL.

A dedicated actual-baseline/PGlite test passed: canonical initial pause, unchanged
worker auth/enabled, both claim overloads fenced, active heartbeat and finish_v2
successful, legacy roster/pending-lessons/presence still available, and no v3,
release capability or trial activation. Source-parity unit test passed. Further
exact-head CI results are reported in the task handoff; none are inferred here.
