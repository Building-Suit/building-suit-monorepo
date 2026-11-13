# Retail compatibility: SQL first, old worker retained

Reconstruction base: GitHub-verified stg commit
90a11b66d28a66848cc3a30a4f1b8d5ac89b0789. Lost local retail commits were not
recovered; these are new source changes. This branch deliberately keeps the
production worker and departmentWorkflow byte-identical to that staging base.

## Release identities and scope

Existing V1 worker identities remain bb6c941f2398b4067d963e9c0de21c53738fa0729f9bb96ee64c89fb7159dd88
and e01fd99ead607d740fcea13b33a23627518762c5ce94c9fd99d993ddc0a5c935.
The separate V2 candidate is 7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40,
paired only with unchanged module bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976.
Its source is an inert test fixture, excluded from release.py's explicit package
allowlist. It is not the production worker in this first phase. The candidate
contains the bounded acknowledgment and MCP-required prompt fix plus a strict
additive startup reader; independent worker-diff review was completed before
freezing its bytes. The migration and fixture tests independently check the pair.

V1 capability, helpers and existing receipt rows remain unchanged. New V2 status
is additive and matches complete worker/module pairs, never independent sets.
Source/host/review gates retain all other conditions. Qualification is deliberately
separate: a new guard allows only previously accepted V1 evidence to issue a
qualification. It does not issue, revoke or rewrite any qualification. Existing
repository_qualified definition stays unchanged, but its dependency on review
readiness is why the separate issuance guard is necessary.

## Required rollout order

1. Independently review this exact SQL-first commit and run required CI. This
   phase must retain production worker e01. Confirm no concurrent stack owner is
   changing the same root before retargeting older drafts; preserve their heads.
2. Merge only this SQL-first PR into stg through GitHub. Existing CI automatically
   publishes the old worker again after verification. Do not manually apply SQL.
3. Wait for the repository's authorized staging migration path to apply the
   forward migration, then verify the hosted migration ledger, exact function
   bodies/metadata, preserved V1 status and the additive exact V2 capability.
   If that deployment path does not apply it, stop: merge alone is not evidence
   that hosted SQL changed. No fallback to manual SQL is authorized here.
4. Only after confirmed hosted readback, prepare/verify the second PR that changes
   production worker to the exact frozen candidate and adds descriptive task-start
   context. Recheck the current staging base, required CI and deployment state.
5. The second stg merge can publish the candidate without startup incompatibility.
   Successful preflight is not qualification and does not authorize customer work.

## Rollback and audit preservation

Stop/drain the candidate and restore a reviewed V1 worker before reverting V2 SQL.
Restore the five saved predecessor definitions transactionally, then remove the
three V2 helpers in dependency order. Preserve all evidence rows and consumed
budgets. Candidate receipts remain immutable but cease to satisfy V2 source/review
readiness after rollback. Existing V1 qualification and historical receipts remain
valid. Never change hashes in old immutable receipts or delete rows to make tests
pass. No hosted rollback was performed by this source task.

The migration pins predecessor bodies and attributes and fails closed on drift.
It takes the existing queue advisory lock and uses a bounded DDL lock timeout.
The source parity inventory marks it pending, not applied. A local passing test
cannot establish hosted deployment, current identity or production readiness.


## Native verification addition (pending CI)

The existing native repository-review CI job now reuses its built PostgreSQL
17.11 image and internal-only network for two fresh clusters, one for each legacy
worker. It runs the same exact V2 semantic checks as PGlite with a fixed localhost
connection and fresh database/schema assertions. A separate session holds the
queue advisory lock; the migration must demonstrably wait, fail with its existing
five-second lock timeout, and leave no changed definitions or data. After release,
the exact migration must apply and the positive/negative/drift/qualification and
rollback checks run. No credentials or hosted connection input is accepted.

Old job and test limits remain unchanged. Each new container invocation is
bounded at 150 seconds, with immediate cleanup and a final always-cleanup step.
Expected incremental runtime is roughly one to three minutes, not measured until
CI finishes. Native coverage must not be claimed before that exact-head step
succeeds. The historical BB6 source is also an inert, SHA-pinned test fixture,
not a runtime dependency or a reason to install Git in the test image.
