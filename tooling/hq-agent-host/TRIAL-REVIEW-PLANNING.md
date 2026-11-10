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

## 10 November: cold review planning correction

### Observed staging failure, 10 November 2026

The first four-request authenticated concurrency batch against staging commit
`c3ef22b29d119341361b8c00d7ecfca1cec27f33` returned four HTTP 503 responses in
9.46–9.60 seconds. Seven preceding sequential reads succeeded, including a
4.741-second validation and 4.314-second warm-up. Testing stopped at the failed
batch. Vercel deployment `dpl_GrUrMNrdZUoe2U8f2iYDAScXyJPd` was verified on the
staging hostname; runtime error/log queries contained no application output.
The BFF catches provider errors and uses an unchanged eight-second timeout.

PostgreSQL recorded four statement cancellations at 15:57:28.008–28.097 UTC.
Every stack identified `trial_review_ready(uuid)` at the ordinary status
`reviewComplete` projection. Preceding founder-access calls succeeded in
11–43 milliseconds. These observations identify the database review query,
not the founder lock, as the failed operation. They do not prove that every
millisecond was planner CPU or exclude all other status cost.

Bounded **nonexecuting** EXPLAIN observations of the exact review predicate:

- Default join collapse: planning 240.489 ms for an indexed, estimated-one-row
  selected-trial predicate. Even a NULL trial simplified to false required
  358.140 ms of planning.
- Transaction-local `join_collapse_limit=1`: planning 6.000 ms. The explicit
  reviewed order starts at the trial primary key and follows single-row actor,
  task, artifact and review keys. Estimated cost changed from 22.97 to 27.27;
  this is not an execution-time result or a universal speedup promise.
- JIT was off. `plan_cache_mode=auto`, join/from collapse limits were eight.
  The helper was already PL/pgSQL; the earlier plan-reuse migration was active.

The latest ordinary trials for ten enabled workers comprised eight passed
synthetic trials whose current lifecycle fails the existing review predicate,
one canceled trial, and one eligible passed evaluator trial. Returning false
before planning the proof is valid for nine of those ten cases.

### Narrow correction

Forward migration `20261110160612_hq_trial_review_planning.sql` changes only the
existing private review helper. It verifies the exact reviewed predecessor
body, signature, language, volatility, security and search path before replacing
it. The full 2,765-byte authoritative proof SELECT remains unchanged.

A cheap trial/agent precheck repeats necessary predicates already in that proof:
trial exists, passed, completed before expiry, enabled T1 worker, and exact
purpose-dependent lifecycle eligibility. NULL/missing inputs still return
false, not NULL. Eligible trials continue through the entire original proof.
Both reads retain the STABLE calling-statement snapshot; no session, result or
authority cache is introduced.

Function-local `join_collapse_limit=1` bounds join planning for the proof and
nested helper queries during this call. PostgreSQL restores the caller's setting
on success, early return and exception. There is no global/session tuning,
index addition, timeout increase, new RPC, grant change or evidence rewrite.
Repository and public-discovery predicates, including existing worker-digest
compatibility checks, are untouched.

### Verification

`node --test tooling/hq-agent-host/trial-review-planning-db.test.mjs` generates
real synthetic worker/host/reviewer evidence via existing RPCs. Its fixture
matches the observed eight ineligible passed ordinary workers, one canceled
trial and one eligible evaluator. It checks complete status JSON, original
predicate equivalence, negative source/binding/lifecycle/review cases, true
ordinary and evaluator proof paths, predecessor guards, immutable receipts,
private-role denial and caller setting restoration including an actual malformed
proof exception. Disposable sequence instrumentation observes ten original
proof entries versus one after the precheck for the ten latest ordinary trials.

PGlite first-call observations were approximately 1,010 ms before and 273 ms
after; warmed calls overlapped around 246–267 ms. These observations demonstrate
cold-planning savings in that fixture, not hosted performance acceptance.

The separate native PostgreSQL 17.11 CI test uses a fixed fresh internal-network
database and four new sessions for the cold before/after comparison, retaining
the eight-second statement cap. It also tests warmed/committed/rolled-back
freshness and unchanged evidence. Native and exact-head CI must pass before
staging deployment. No additional hosted load test, deployment, production
operation, worker recovery or task retry is authorized by this document itself.
