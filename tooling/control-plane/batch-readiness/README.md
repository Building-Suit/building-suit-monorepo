# CP-BATCH-READY-001 repair package

This directory contains the reviewed, non-live repair proposal for the captured Shop, Super Admin, and Shared batches.

- `registry-patch.json` is the proposed verification-registry generation. It preserves every supplied plan entry and represents each as a command/group or an explicit planned/external blocker.
- `admission-report.json` is the deterministic, non-mutating report generated from the operator evidence whose SHA-256 is `e2f0f02d37eea920dbe589c86888d287dce7a4a84410b8764346e6f74c7d6c5e`.
- `rollout-package.json` records guarded apply and rollback ordering. It is a proposal, not an executable authorization.
- `../sql/028_batch_admission_safe_resume.sql` supplies versioned contract invalidation, maintenance gates, exact task-to-run claims, idempotent completion credit, explicit budget reconciliation, admission activation, and fail-closed rollback.
- `../n8n/artifacts/pg0BEkbP9E4H4RqB.json` is the inactive proposed controller replacement. It is not proof of the deployed workflow.

Regenerate the reports without mutating the control database:

```sh
node tooling/control-plane/batch-readiness.mjs report <evidence.json> \
  tooling/control-plane/batch-readiness/registry-patch.json \
  tooling/control-plane/batch-readiness/admission-report.json
node tooling/control-plane/batch-readiness.mjs rollout <evidence.json> \
  tooling/control-plane/batch-readiness/registry-patch.json \
  tooling/control-plane/batch-readiness/rollout-package.json
```

The checked-in report intentionally remains `BLOCKED`. In particular, it does not treat the captured boundary preview as authorization, does not claim the missing Storage/Super Admin/generator checks exist, does not alter the Shop run from three slots to two, and does not resume without a fresh deployed-controller export and fingerprint. `BS-SA-SHELL-001` remains excluded under `BS-SA-D001`; completed `SS-SA-BRIDGE-001` execution 258, verification 267, and PR 191 remain historical evidence.

Original evidence identity is provenance only. Release admission additionally requires a fresh read-only current-state snapshot and a verified task-parent snapshot for every candidate. Command availability validates workspace package and script presence. Browser readiness uses Playwright `--list` against the declared package/spec; an unavailable dispatcher remains an explicit blocker. Planned tests that the product task must create are deferred during implementation preflight but remain mandatory post-implementation outputs.

The proposed BS-20 controller transports `cp-batch-v2`, the reviewed content fingerprint from `BS_BATCH_CONTROLLER_FINGERPRINT`, and the n8n execution ID as separate protocol, proof, and lease values. Maintenance routes to a resumable wait and never calls the failure finisher. The artifact remains inactive and is not deployed proof.

Migration 028 defines the admission authority projection explicitly. For tasks it includes every durable row field except lifecycle-only `status`, `engine_stage`, timestamps, and the runner-owned `metadata.preparation` record. Project, workstream, Suit registry, requirement, decision, retry-policy, and platform-policy rows include every field except timestamps; task-requirement, task-decision, and task-dependency link changes always invalidate. This default-includes unknown columns and metadata keys, so a new input fails closed until deliberately classified. Preparation, execution, verification, publication, lease, audit, and credit bookkeeping do not alter the projection. Scope/path metadata, acceptance and verification requirements, links and linked content, and project/workstream policy do. A changed projection advances the task generation, makes prior admissions stale, and causes refreshed contracts to revoke prior exact/protected authorizations.

Batch admission is intentionally distinct from execution eligibility. The atomic admission may retain an unfinished hard predecessor only when that exact predecessor is also in the reviewed set. Same-run dependencies must follow the reviewed ordinal order, and the combined hard-dependency plus serialized-run-order graph must remain globally acyclic across runs. Completed external prerequisites remain required. Admission leaves downstream tasks planned; acquisition waits for the actual lowest unfinished ordinal rather than skipping a locked head, and returns a dependency wait until its real hard parents are `complete`. `passed` is not complete. Run resume, existing-claim resume, task preflight, and execution creation all re-read current dependency and decision state, so admission never pre-certifies a future parent revision or creates implementation credit.

Ordinary non-batch runs remain supported. `cp-batch-v2` can acquire and attribute an ordinary task without a repair generation, while batch-owned runs additionally require their exact admission. Unknown controller protocol versions fail closed before claim mutation. The legacy one-argument completion function remains available only for unattributed ordinary runs; any run with a current or batch-owned claim must use task-attributed, idempotent completion.

Run the real migration/function/concurrency suite only against an isolated local PostgreSQL server. The runner creates and drops a database named `cp_batch_ready_test_*` and rejects non-local hosts:

```sh
CP_BATCH_READY_TEST_POSTGRES_URL=postgresql://localhost/postgres \
  node tooling/control-plane/tests/batch-readiness-postgres.test.mjs
```

Without that variable or a local server, the suite reports `SKIP`; that is not a passing PostgreSQL result. Set `CP_BATCH_READY_TEST_REQUIRE_POSTGRES=1` in required verification: missing/invalid prerequisites then fail the test instead of skipping it. The suite requires PostgreSQL 17, keeps function-body validation and `plpgsql.variable_conflict=error`, migrates 001..027 before the explicit 027→028 upgrade, and runs the lifecycle, concurrency, rollback, authority-invalidation, protected-authorization, and ordinary-run regressions in a test-created database. Its local fixture preserves all 14 captured dependency edges and progresses all 12 selected tasks through execution, independent verification, publication, exact-once completion credit, and credit replay in dependency order. Those rows and results are test evidence only.

Applying the SQL migration alone does not apply the registry patch or resume a run. The database functions require exact current revisions, acknowledged maintenance, the original run IDs, a matching controller protocol/proof, empty reviewed blocker sets, current contract generations, current exact/protected authorization, and explicit human calls. Rollback leaves runs maintenance-blocked and never auto-unpauses them.
