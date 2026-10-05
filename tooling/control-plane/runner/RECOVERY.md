# Recovery evidence and pinned local runtime

`recovery-evidence.mjs` is the shared consumer of execution-scoped failures and failed verification evidence. A failed repair may have no formal verification row. Preserve its full probe, check classifications and `verified_state` in the control failure; pass those checks to the next repair. Do not infer a class from serialized paths.

A repair baseline is valid only for the current latest execution, matching parent SHA and verified-state fingerprint, and unchanged current Git objects. It affects repair preflight only. Publication still inspects the full changed-file set and requires its ordinary/protected authorizations.

Supervisor initial leases use a fresh invocation key and atomic advisory-locked establishment. The statement reading held leases runs after acquiring the lock so PostgreSQL READ COMMITTED takes a fresh snapshot. Recovery event replays intentionally do not mutate today's recovery row; never replay a historical initial-decision key as a lease renewal.

The local SSH adapter may run a clean committed control-plane worktree while keeping product discovery rooted at the original repository:

- `BS_CONTROL_REPOSITORY_ROOT`: original repository root for registry/product worktrees.
- Runner/verifier/publisher source paths: derived from the selected runner's source directory.
- Installed adapter must check the selected commit and clean control-plane source before execution.
- `BS_CONTROL_PUBLICATION_HOLD=1`: local repair and verification may proceed, but Git publication stops with a typed operator wait. This does not grant verification credit or replace external security gates. Remove the hold only when the operator separately authorizes publication.

The October 2026 recovery's installed adapter targets the local `automation-suit-control-plane-recovery` worktree. Keep that worktree while it is the runtime. Restarting n8n does not change the forced SSH target. An intentional new runtime commit requires regression validation and an explicit adapter pin update. Do not switch the primary product checkout to the recovery branch or overwrite task worktrees.

Advisor/external obligations are required at their declared lifecycle stage (default pre-publication). Current legacy external obligations have no direct evidence-ingestion API: a registered safe verification command with the required security capability and a reviewed v2 mapping must consume genuine task/revision-bound evidence. A generic green hosted-project advisor response is insufficient evidence for an unhosted local migration. Leave the gate blocked until that contract is supplied; do not mark it optional.

Regression: `node --test tooling/control-plane/tests/*.test.mjs`. Use `CP_BATCH_READY_TEST_REQUIRE_POSTGRES=1` with an isolated PostgreSQL fixture URL, and `BS_RECOVERY_N8N_FIXTURE` pointing to a sanitized current published workflow export, to require the real SQL/concurrency and published-node routing cases. No real product retry belongs in this diagnostic test harness.
