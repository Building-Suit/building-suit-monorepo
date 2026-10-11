# Shared future-Suit roadmap amendment

The owner-requested 2026-10-10 planning correction supersedes the hard ordering
edge imported from `project-factory:super-admin-suit`, anchor
`2026-10-06-later-milestones`. Requirement `BS-SA-UI-R002` remains approved and
unchanged. Migration `116_shared_foundation_planning.sql` is the durable task
definition amendment and exposes dedicated operator-only audited operations.
Do not reimport the superseded hard foundation-to-M4 edge.

The root cause is roadmap ordering misclassified as a technical dependency.
`BS-SA-FUTURE-SUIT-001` describes shared identity/navigation, versioned read and
command descriptors, data/adapter registration using a future-Suit fixture,
product-agnostic Bs UI, and absent/disabled unsupported capabilities. None of
these requires the real M4 event explorer. Requiring `SAS-M4-EVENTS-001` pulled
the entire SAS M4/M3/M2 chain and unfinished M1 Billing into an independently
authorized Shared queue.

Keep the original task ID, five acceptance criteria, four verification
obligations, paths, retry policy and history. Retain its M4 edge as `soft` for
roadmap provenance. Register `BS-SA-FUTURE-SUIT-M4-VALIDATION-001` as planned,
with hard dependencies on the original foundation and `SAS-M4-EVENTS-001`.
That task owns integration coverage against completed real M4 adapters,
event/audit projections, partial feeds, redaction, isolation and safely disabled
unsupported capabilities. Foundation fixtures cannot earn its completion.
It requires its own later authorization; registration does not add it to the
existing four-task frozen queue or start SAS prerequisites.

The remaining unfinished Shared links were inspected. The UI-PRO links are
same-workstream sequencing. Changelog depends on completed realtime adoption
and shell tasks. There is no evidence supporting other dependency changes.

`BS-VERSION-D01` and `BS-CHANGELOG-NEW-D01` were open recommendations. The owner
explicitly approved **semantic versioning (MAJOR.MINOR.PATCH), with explicit
prerelease labels**, and **48 hours from the authoritative publish timestamp**
in this repair chat. The operator operation records these choices and preserves
the original decision rows and their prior values in audit history.

Apply only the control-plane migration through `exactMigrationTransaction`,
bound to the verified control project and adoption baseline, after the local
PostgreSQL acceptance succeeds. No product migrations, runtime-pointer
deployment, workflow replacement or service restart is needed. Dedicated
operator credentials invoke `repair_shared_future_suit_dependency` and
`approve_shared_changelog_choices`; executors cannot call these operations.
Both serialize on the existing run lock and append task/audit evidence.
Replays are idempotent; stale inputs, active claims and conflicting decisions
fail closed. No execution or completion row is written by either operation.

Scope and verification fingerprints remain unchanged because the original
task's acceptance, description, paths and verification plan remain unchanged.
Dependency and decision changes invalidate admission generations; refresh the
publication contract. Original frozen plan rows remain immutable; an append-only
`bounded_plan_dependency_amendments` record binds the original plan and the
exact revised dependency set with a new SHA-256 fingerprint. The execution
trigger validates that amendment and retains every other plan gate. The scoped
source-root validator also recognizes the already authorized
`apps/building-suit-docs/**` path; no publication boundary is expanded. Use existing `reconcile_ordinary_run_task` and
`reconcile_native_run_admission`. Existing enqueue/wake and `run-supervise`
operations resume the **same** run
`1a75a547-3372-4e2a-b51c-3b1b2bf9ad81`. Do not use the older batch-only
`resume_admitted_workflow_run` for this native run (its repair ID is null).

Run the deterministic integration suite against an isolated database restored
from a read-only control snapshot, retaining ownership and ACLs:

```sh
CP_EGRESS_TEST_CONTAINER=<owned-cp-disposable-container> \
CP_SHARED_PLANNING_BACKUP=<control-only-snapshot> \
node --test tooling/control-plane/tests/shared-foundation-planning-postgres.test.mjs
```

For the prior schema114 snapshot, set `CP_SHARED_PLANNING_FIXTURE=1`; this
applies migration115 and seeds only the observed two-completion fixture state
in the disposable database. It is test evidence, not a claim of live completion.

The suite checks concurrent repair replay, independent acquisition with M4
planned and changelog decisions open, genuine hard gates, executor denial,
stale authority, explicit choices, conflicting choice replay, restarted claim
acquisition, unfinished-credit rejection and completed-credit replay. Execution,
credit, grant, retry-policy and limit digests must remain identical. It makes
no AI call, hosted test write or remote publication.
