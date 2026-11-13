# Repository review planning correction, 10 November 2026

## Observed remaining staging cost

After ordinary-review correction #566 deployed as staging commit
`1f129e5949168c4b6b5e9124132cdc7aee4499de`, seven sequential authenticated
status reads and the first two four-request batches succeeded. The third batch
at 16:46:59.431–16:47:09.016 UTC returned one HTTP 503 and three HTTP 200s.
Testing stopped. Unlike the preceding incident, PostgreSQL logged no statement
cancellation, user cancellation or deadlock in this window.

Provider status execution was 710–865 ms for the seven sequential reads,
3,719–4,139 ms for the first two batches, and 6,893–7,456 ms for the three
visible final-batch successes. All four final founder-access calls succeeded.
The missing fourth edge response and completed-query count are consistent with
a query completing after the BFF's unchanged eight-second deadline, but do not
uniquely identify that request. Vercel contained no application error output.
Do not describe this run as four database timeouts or claim complete resolution.

One authorized bounded serial diagnostic used a read-only transaction, five-second
statement cap, three existing developer inputs, EXPLAIN ANALYZE and rollback.
It returned no identities or payloads and caused no task execution. The fragment
projecting `repository_review_ready` took 326.435 ms, with 7.657 ms outer planning,
4,986 shared hits and zero reads/dirtied blocks. The first result was ready at
323.202 ms. This observation cannot separate nested planning from execution.
The inputs were one passed/in-time repository trial, one canceled trial and one
missing trial. No additional hosted execution was used to develop this fix.

## Narrow change

`20261110165424_hq_repository_review_planning.sql` replaces only the private
`repository_review_ready(uuid)` implementation. The predecessor guard requires
the exact live SQL function, signature, STABLE/security-definer/non-STRICT
attributes, empty search path and source MD5 `328a9a163dcaa3880b8e4679969599c8`.
The complete transformed 2,670-byte proof remains identical, including the
`repository_worker_digest_allowed` predicate introduced by the earlier
compatibility migration. Historical and compatible worker digests remain valid;
unknown or missing digests and altered modules are not admitted.

PL/pgSQL permits statement plan reuse. A necessary-condition precheck rejects
missing, wrong-purpose, wrong-manager, non-passed or late/incomplete trials before
the expensive proof. It repeats predicates already required by the proof and
preserves NULL-to-false behavior. Both statements share the STABLE calling
statement's snapshot. Eligible trials still execute the complete original proof.

Function-local `join_collapse_limit=1` also applies to nested helper queries during
the call, including repository readiness, source and binding checks. The caller's
setting is restored after true/false results and exceptions. No persistent result
or authority cache, timeout increase, global tuning, index, grant, evidence rewrite,
new RPC or production change is included. Unmeasured catalogue rewrites are excluded.

## Verification and limits

The shared disposable fixture generates real worker delivery and independent
review evidence. Its ten-worker ordinary mix matches the earlier observed
8 passed lifecycle-ineligible, 1 canceled and 1 eligible evaluator trials. The
repository overlay adds 1 genuine passed/qualified, 1 canceled and 1 missing trial.

`node --test tooling/hq-agent-host/repository-review-planning-db.test.mjs` passed
for both actual historical and compatible worker output. Each run checks 34
source, lifecycle, binding, skill and review mutations; complete status JSON;
metadata/OID/ACL preservation except the intended language and scoped setting;
seven predecessor drift refusals; true, false and exception setting restoration;
invalid proof admission; and unchanged ordinary and repository evidence snapshots.
Immutable receipt triggers remain enabled. Rollback-only sequence instrumentation
records three predecessor proof entries versus one candidate entry for the three
repository inputs. It does not claim all nested work executes once.

PGlite full-status observations were 348–388 ms before and 49–77 ms after. These
are measurements of this generated fixture, not a hosted latency promise or a
native PostgreSQL substitute.

The separate bounded `repository-review-planning` CI job uses PostgreSQL 17.11 on
an internal Docker network and a fixed fresh disposable database. It compares four
fresh baseline sessions with four fresh candidate sessions at the unchanged
8-second cap, then runs three more four-reader batches. All candidate requests
must succeed and return identical complete JSON with a true repository proof.
It additionally checks seven warm reads, other-session uncommitted/committed and
rolled-back source changes, restored settings and unchanged trials/jobs/receipts.
Native execution is unavailable in the local cloud checkout; exact-head CI must
pass before staging publication and a separately coordinated bounded retest.

Migration inventory statuses are historical source-review records, not current
provider deployment receipts. Verify provider history and exact source fingerprints
before any deployment; branch merge alone does not prove database application.
