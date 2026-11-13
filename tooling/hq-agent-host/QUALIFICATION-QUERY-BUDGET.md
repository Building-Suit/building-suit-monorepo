# Qualification query budget

The ordinary task claim builds current assignee qualification before leasing the
job. That assignment previously evaluated `workforce_agent_qualified` twice:
once through `workforce_qualification_context` and once directly. Reviews could
repeat both evaluations for an artifact author who was also the assignee.

Qualification is also evaluated elsewhere in the full claim path: stage/head
authorization and the returned worker context. Founder trial status evaluates
the same underlying per-skill evidence predicate for eligibility/coverage. Its
eight-way proof join can spend substantially more time planning than executing.
Reducing only the new assignment would leave those costs intact.

The forward migration materializes the one eligible agent and its current
source-binding digest before the remaining receipt/trial/artifact/host/review
joins. Every prior evidence predicate remains. The current profile index row
still must be in scope and untrashed; all assigned skills still need genuine
current proof, independent review and matching source/model/manager bindings.
There is no persistent qualification cache or cross-request reuse.

The task-context helper obtains each subject's qualification once. The existing
qualification-context function returns SQL NULL exactly when the subject is not
qualified. The boolean is derived from that same result. An artifact author
reuses it only when that author is the already-checked assignee; other subjects
are evaluated separately. Evidence provenance and bounded history are unchanged.

No runtime timeout, API signature, grant, review rule, lease operation, repair
budget, transport, job result or service control is changed. Existing migrations
remain byte-identical. No hosted SQL was applied during preparation.

## Measured preparation evidence

An isolated PostgreSQL 17.11 container (one CPU, 512 MB, no network or exposed
ports) exercised 18 generated agents, eight workers qualified through nine real
fixture trial/delivery/head/independent-review/receipt flows, and 500 unrelated
indexed sources. Five fresh-session samples were measured before and after the
migration using EXPLAIN ANALYZE. The full authenticated public claim transaction
included its earlier qualification/authorization gates and lease write, and was
rolled back in the disposable database after each measurement.

| Path | Before median | After median |
| --- | ---: | ---: |
| Full authenticated claim | 292.938 ms | 83.783 ms |
| Qualification context | 53.983 ms | 16.352 ms |
| Founder trial status | 483.140 ms | 96.412 ms |
| Task evidence context | 107.476 ms | 20.174 ms |

The ceiling assessment repeated that same PostgreSQL procedure with ten assigned
skills on the task author and one on each of the other seven qualified workers:
17 genuine trial proofs in total. All ten author skills remain in the returned
context, and changing the tenth source revision revokes qualification. No proof
was grandfathered, injected or replaced by latest-receipt existence.

| Ten-skill author path | Before median | After median |
| --- | ---: | ---: |
| Full authenticated claim | 630.461 ms | 93.427 ms |
| Qualification context | 136.792 ms | 38.649 ms |
| Founder trial status | 1050.033 ms | 207.397 ms |
| Task evidence context | 289.581 ms | 61.574 ms |

The slowest patched full-claim sample was 170.642 ms. Current binding computation
still occurs per skill predicate, but this bounded ceiling result does not
justify a broader digest/cache rewrite in this repair. These are measured local
results, not a guarantee under arbitrary hosted contention.

These isolated timings establish reduced total cost, not the exact contribution
of shared production pressure to a particular timeout. Hosted success and worker
health remain separate acceptance steps. A queued job must not be dispatched or
recreated to evade those gates. A worker already fenced by an uncertain request
requires its separately reviewed reconciliation; a SQL migration cannot clear
that state.

Focused regression command (repository Node version):

```
node --test --test-name-pattern='qualification query budget|ordinary repair retains' tooling/hq-agent-host/pilot-proposals-db.test.mjs
```

The populated fixture compares all qualification contexts/verdicts before and
after, checks source/model/effort/lifecycle/manager drift, and executes ordinary
task and review claims through the real SQL functions. It preserves private ACLs
and function OIDs. Tests use generated content and no live model or hosted write.

PostgreSQL explains the planning/search tradeoff in its
[explicit join documentation](https://www.postgresql.org/docs/current/explicit-joins.html).
Materialization here is confined to a bounded current subject; it does not relax
an authorization or evidence check and changes no global planner setting.
