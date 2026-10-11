# Recovery evidence and pinned local runtime

`recovery-evidence.mjs` is the shared consumer of execution-scoped failures and failed verification evidence. A failed repair may have no formal verification row. Preserve its full probe, check classifications and `verified_state` in the control failure; pass those checks to the next repair. Do not infer a class from serialized paths.

A repair baseline is valid only for the current latest execution, matching parent SHA and verified-state fingerprint, and unchanged current Git objects. It affects repair preflight only. Publication still inspects the full changed-file set and requires its ordinary/protected authorizations.

Supervisor initial leases use a fresh invocation key and atomic advisory-locked establishment. The statement reading held leases runs after acquiring the lock so PostgreSQL READ COMMITTED takes a fresh snapshot. Recovery event replays intentionally do not mutate today's recovery row; never replay a historical initial-decision key as a lease renewal.

The local SSH adapter may run a clean committed control-plane worktree while keeping product discovery rooted at the original repository:

- `BS_CONTROL_REPOSITORY_ROOT`: original repository root for registry/product worktrees.
- Runner/verifier/publisher source paths: derived from the selected runner's source directory.
- Installed adapter must check the selected commit and clean control-plane source before execution.
- `BS_CONTROL_PUBLICATION_HOLD=1`: local repair and verification may proceed, but Git publication stops with a typed operator wait. This does not grant verification credit or replace external security gates. An operator-owned `run_ordinary_publication_authorizations` grant can allow ordinary draft publication for the exact existing bounded run while this hold stays enabled. Its task grants pin admission generation, publication contract and verification contract. Changed scope, revoked authority, protected paths, non-draft PRs, merge and deployment retain operator gates.

The October 2026 recovery's installed adapter targets the local `automation-suit-control-plane-recovery` worktree. Keep that worktree while it is the runtime. Restarting n8n does not change the forced SSH target. An intentional new runtime commit requires regression validation and an explicit adapter pin update. Do not switch the primary product checkout to the recovery branch or overwrite task worktrees.

Advisor/external obligations are required at their declared lifecycle stage (default pre-publication). Current legacy external obligations have no direct evidence-ingestion API: a registered safe verification command with the required security capability and a reviewed v2 mapping must consume genuine task/revision-bound evidence. A generic green hosted-project advisor response is insufficient evidence for an unhosted local migration. Leave the gate blocked until that contract is supplied; do not mark it optional.

Regression: `node --test tooling/control-plane/tests/*.test.mjs`. Use `CP_BATCH_READY_TEST_REQUIRE_POSTGRES=1` with an isolated PostgreSQL fixture URL, and `BS_RECOVERY_N8N_FIXTURE` pointing to a sanitized current published workflow export, to require the real SQL/concurrency and published-node routing cases. No real product retry belongs in this diagnostic test harness.

Shop database verification also checks edited migration files against the applied statement history of the fixed local Shop container. `migration up --local` does not replay an already-applied version. Stale applied source is verification infrastructure drift, not evidence of a new product assertion. Obtain a fresh explicitly disposable schema or preserve the applied migration and implement the change as a forward version; never silently treat the old schema as the current source. This readiness check is read-only and cannot accept a hosted URL.

Required Shop HTTP coverage uses a TAP receipt. A skipped test or zero-exit command without positive executed coverage cannot pass. Actual failed assertions remain product defects; the known missing local fixture is a required unavailable gate. Generated Admin type checks compare the actual schema output and retain a private expected artifact path for repair handoff, without editing the task's checked-in type file.

BS-31 also wakes a running admitted run with no current task after completion credit. Authoritative phase success consumes an unfinished operation before consulting its old backoff timer. Restart recovery reuses existing task commits/PRs and the unique run/task credit. Migration 031 creates read-only runtime authority; only an operator may write its grants. This authority never creates runs or changes task scope.
