# Completed retry and owner scope recovery

This candidate is based on installed source
`590ccbf3941fb358c915a0981430d9612c7918ca`. The PostgreSQL stdin transport,
schema-105 recovery guards, lock handoff, Supervisor dispatch and Publisher
idempotency remain intact. No live installation or owner response is performed
by preparing or testing this candidate.

## SAS execution finalization

Previously `task-retry` returned `repair_verifier_recovery_required` before
`finish_execution` when Codex exited successfully but its probe encountered a
non-product verification prerequisite failure. Consuming that operation then
left its execution running indefinitely with no worker.

The corrected path finishes implementation on that same reserved execution,
preserves its setup metadata and failed probe, and requires formal verification.
It neither claims acceptance PASS nor creates a new execution, retry charge,
publication or credit. A genuinely failed product probe retains the existing
product repair lane.

For historical consumed operations, Supervisor reads the latest implementation
operation separately from the pending operation queue. It requires the original
outer receipt to match its persisted outcome, the bound inner Codex invocation
to have exited zero, dead writer/child identities and free receipt locks, and
an exact match to the current Git source fingerprint. Run/task/execution/attempt,
operation generation, command, directory and source identity must match. Safety
holds, stop, maintenance and exhausted run limits prevent reconciliation.

Supervisor rechecks the proof under its existing lifecycle lease and uses the
existing `finish_execution` API atomically with execution/operation/run/lease
preconditions. It preserves the original consumed receipt. The next action is
mandatory verification of the same execution. Replays cannot finish it twice.

The read-only live proof for execution 318, attempt 2 matched source fingerprint
`1b38d681574036aae7a49f0033171318db7568c4690aaf5e12037fccb61487e4`
and consumed operation `bd199b86-d3f5-4baa-b1a5-ef8fefff3885` on 8 October 2026.
That is evidence of eligibility for reconciliation, not a live reconciliation
or acceptance result. Trusted defects from previous execution 317 and independent
staging requirements remain part of history and acceptance.

## Shop owner scope capability

Migration `108_task_shared_package_authority.sql` is independent and additive on
105. It does not depend on, install, edit or activate 104, 106 or 107. Use an exact,
checksum-bound migration transaction, never a directory-wide migration command.
The SAS runtime repair also works on unchanged schema 105 without 108.

The existing authenticated BS-22 form and dedicated BS-23 operator transport
expose `task-shared-package-scope`. Its offer binds the existing run, task, frozen
scope, approved requirement contents, publication contract/generation, project
boundary, run revision and unchanged task limit. It resolves only already
declared `packages/<package>/**` globs inside that registered boundary. An unknown
scope, unapproved requirement, changed fingerprint or safety hold cannot acquire
authority. Protected files and their content/side-effect gates remain enforced.

Approval appends an actor-bound authority event and task/run grant, refreshes the
contract and rebinds the existing ordinary bounded-run publication authority.
Task-state events coalesce into the existing durable Supervisor wake. Replaying
the same authenticated response produces no extra grant or wake. An incident
investigation extension cannot approve these paths. Runtime roles cannot call
the owner API, its renamed legacy implementation, or directly change grants.

Revocation retains history, removes only scopes added by that approval and blocks
acquisition/publication. It can stop further authority during implementation and
produce a fresh exact offer for explicit owner reauthorization of that task.
It cannot undo completed publication. If a publication operation is still pending,
reconcile its possible remote effects before revocation; a child with frozen
authority must not race a revoke. A task grant never becomes authority for another
run just because old resolved-scope metadata remains present.

The required real owner response for Shop is:

> Approve `task-shared-package-scope` for `SS-LAUNCH-BRAND-001` in existing run
> `06124632-a51d-4d08-bb62-ee4e8cedb9dc`, limit 14, under approved requirement
> `SS-LAUNCH-R06`: `packages/brand/**`, `packages/nuxt-layer/**`, `packages/ui/**`.
> Authorize only the approved implementation and ordinary Draft PR publication
> after trusted PASS and exact content validation. Preserve acceptance, revocation,
> existing app scope and dependencies. No protected-file approval, merge,
> deployment, hosted SQL, secret/provider change, new run or scope expansion.

Reload the authoritative offer after activation; do not reuse a prepared gate
fingerprint. The operator must submit their own authenticated response. The old
incident-investigation gate is unrelated and must not be used as scope approval.

## Executed integration assertions

`execution-owner-scope-integration.test.mjs` exercises disposable PostgreSQL and
the real CLI/service, kernel locks, worker/verifier receipts and lifecycle:

- The installed parent reproduces the consumed retry receipt with a running
  attempt 2 and no worker. A durable wake through the corrected Supervisor
  finalizes that same execution and performs mandatory verification.
- The corrected future retry path finalizes a successful implementation even when
  staging verification prerequisites fail. Historical product evidence and its
  one legitimate charge remain; no attempt 3 or extra charge occurs.
- Missing staging is reviewed against its actual failed check and remains an
  external-evidence hold. Repeated dispatches do not reverify, implement, publish,
  credit or acquire the next task. Tests do not manufacture its acceptance PASS.
- Authenticated shared scope approval, stale/forged actor/offer rejection,
  revocation, replay and reauthorization use the real operator capability. Verified
  package files publish via the real Git Publisher to local Draft PR provider
  fixtures. Two consecutive tasks earn two exact credits, then a separate Shared
  run wakes and earns one credit after its hard dependency completes. Restart and
  replay cause no duplicate attempts, publications or credits; Dot is unused.

The Git remote, Codex and PR provider fixtures are explicitly disposable/local;
they do not claim a hosted provider or live product acceptance result.
`task-shared-scope-migration-postgres.test.mjs` additionally installs exactly 108
over a real 105 baseline through `exactMigrationTransaction`, checks owners/RLS/
permissions and unchanged history, and rejects checksum-ledger replay.
Final TAP receipts and the source manifest belong in the local checkpoint.

## Minimal separately authorized activation

1. Obtain installation authorization covering the reviewed local commit, exact
   migration 108 and matching runtime. Refresh origin/PR preflight and compare the
   live release/source/schema/database identity, existing Shop/SAS/Shared limits
   14/7/4, grants, source hashes, leases and operation receipts. Stop on material
   drift. Do not commit or install under this local implementation authorization.
2. Use the reviewed quiesce/drain and protective-lock procedure. Capture the
   schema-105 snapshot, release pointer, operation/receipt/source hashes, run
   histories, credits, dependencies and grants. Keep writers stopped while applying
   **only 108** via `exactMigrationTransaction` with its reviewed SHA-256, committed
   source, dedicated project ref and verified adoption baseline. Reconcile the
   migration ledger; never apply 104/106/107 or reinstall 105.
3. Use maintained `prepareRuntimeRelease`/registration and compare-and-swap
   activation with schema version **108**, including every previous runtime file
   and the new retry-finalization helper. Validate exact file hashes, DB identity,
   function permissions and the actual `run-supervise` entry point. Start writers
   once under protective locks. Record readiness explicitly as
   `readiness_passed: true`; then release only the recorded protective locks.
   On failure stop writers, retain protection, and restore only a verified
   compatible pointer through the fail-stop procedure. Do not restart repeatedly,
   delete 108, rewrite history or restart the defective old SAS path.
4. The real owner uses BS-22/BS-23 to approve the freshly offered Shop task scope
   above. That response coalesces a wake and Supervisor acquires the task. Coalesce
   a wake for the same SAS run so Supervisor consumes the already completed worker
   evidence and verifies **318**, without attempt 3. Observe actual receipts and
   progression. Shop publication still requires trusted PASS and exact hashes;
   SAS remains blocked if real staging evidence or another acceptance check is
   absent. Preserve Shared's hard dependencies and all three existing runs.

No runtime activation, database installation, permission grant, service restart,
remote Git publication, merge, provider change or deployment is performed locally.
