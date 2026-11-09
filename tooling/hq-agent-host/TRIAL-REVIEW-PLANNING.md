# Trial review planning

The forward migration `20261109124713_hq_trial_review_plan_cache.sql` changes
only `hq_private.trial_review_ready(uuid)` from SQL to PL/pgSQL. Its exact SELECT
is enclosed in `BEGIN RETURN (...); END`. PostgreSQL can retain the statement's
query plan while each call still reads evidence under the existing STABLE
snapshot semantics. No qualification boolean or source binding is stored or
reused across calls.

The signature, OID, owner, volatility, security-definer mode, empty search_path,
private ACL and every evidence predicate are retained. The same current agent,
manager, model/effort, source/reviewer binding, immutable host receipt, accepted
independent review, artifact digest, completed report and disabled-learning
requirements apply. Existing migrations remain byte-identical. No public API or
type changes, timeout increase, planner setting, trigger change, queue/lease
operation or paused/uncertain gate modification is included.

## Reproduced cost and limits

Cloud-only preparation used the already installed PGlite 0.3.14 and Node 24.22.1.
A disposable synthetic fixture contained 13 roster rows, five genuinely
fixture-executed trial/review flows, 40 jobs and five qualification receipts. The
CLI provider was mocked; no live model, remote database or personal computer was
used. A direct EXPLAIN ANALYZE of the original review predicate measured
117.788 ms planning and 2.851 ms execution. Repeated helper calls took
118.433–125.906 ms before and 2.217–3.580 ms after the wrapper change. Full
founder trial status took 1,432.736–1,708.576 ms before and 442.368–495.314 ms
after, with identical JSON. These sample ranges are observations, not CI timing
thresholds or a hosted latency guarantee.

Empty repository claims were already fast: 1.374–4.195 ms warm across empty and
populated fixtures. Empty enrichment layers were below 1.5 ms. This investigation
did not reproduce the historical repository-claim statement timeout. Concurrent
slow trial-status/presence calls suggest shared load as a possibility, but no
historical CPU or claim lock-wait measurement proves that mechanism. A separately
observed Brain notification row lock cannot be attributed to the claim.

PGlite provides real PostgreSQL semantics in one in-memory backend, not native
multi-session PostgreSQL, the Supabase pool, provider extensions, production
statistics or historical contention. The existing fixture deliberately stubs
Auth and realtime integrations and selects relevant HQ migrations; it is not a
full hosted database replay. Native PostgreSQL/Docker were unavailable. Do not
call this a fix for worker recovery or clear an uncertain outcome on its basis.

## Regression coverage

Run with the repository Node/dependency versions:

```
node --test --test-name-pattern='trial review plan cache' tooling/hq-agent-host/public-repository-db.test.mjs
node --test tooling/hq-agent-host/public-repository-db.test.mjs
node --test apps/company-hq/tests/unit/staging-migration-parity.test.mjs
```

The populated fixture compares the old and new functions, exact SELECT body,
function metadata, full trial-status JSON, all five trials and null/missing IDs.
It checks profile/skill/reviewer source drift, disabled agent/manager,
model/effort drift, suspension, failed/expired trials, rejected review and wrong
artifact digest. Each rollback restores eligibility on the next call, including
calls after repeated plan reuse. The immutable host-evidence trigger still
rejects mutation. Original artifact/host/qualification row snapshots remain
identical, and anon/authenticated/service_role cannot directly invoke the private
helper. The existing repository workflow suite also installs the new migration
before creating and approving its fixture trials.

The source-parity manifest records this as pending review-only SQL, never as a
hosted application receipt. Review/merge and database deployment are separate.
Before claiming incident resolution, use an authorized disposable native
PostgreSQL environment to compare cold/warm sessions, concurrent status/claim
requests and representative data/statistics. Observe CPU, lock waits and query
plans without relaxing timeouts or qualification checks. Any later hosted
acceptance and worker reconciliation need their own authorization; never enqueue
or repeat a real task merely to benchmark this change.
