# Shop 316 / Super Admin 317 local recovery repair

This candidate changes the existing Supervisor/Dot lane. It has not been installed
or used against live runs. No runs, task limits, execution rows, completion credits,
operator grants, dependencies, or live services were changed. Publication work and
migration 104 are excluded.

## Root causes and changes

- Dot held a run flock while its `run-recover` child acquired that same flock. Dot
  now finishes its incident with an idempotent durable Supervisor handoff. Only
  Supervisor takes the run lock and advances task lifecycle state. SQL retains the
  live safety gate, checks current execution/verification and active ownership,
  and refuses another handoff for the identical resolved failure generation.
- Review prose and observation times entered incident generation fingerprints.
  Fingerprints now use failed-check semantics, command, source, verifier,
  configuration, artifact and classification identities. Preparation timestamps
  do not constitute changed verification inputs.
- Fresh STUCK health was written after recovery admission, so cached WAITING_TIMER
  evidence rejected recovery. Health is persisted before admission; UNKNOWN
  classification investigations cannot hide behind continuously renewed timers.
  Real worker, operator, dependency, stop and maintenance gates remain intact.
- The failed-input baseline must survive fixture changes until a new verification
  result exists. Recording/polling now preserves it; readiness is calculated
  against candidate inputs. A settled verifier operation is consumed, including
  infrastructure failures, instead of spawning the same unchanged verification.
- Prerequisite-blocked `not_run` checks cannot claim the legacy one-time receipt
  materialization exception. They remain required and blocked, classified only
  through their exact current trusted failed prerequisite. Task database commands
  run after the clean database prerequisite, not against its stale predecessor.
- Shop's reviewed recipe casts fixture JSON literals explicitly and supplies one
  synthetic transport for authenticated SSR and browser requests. It includes
  reloads, overrides, mounted-handler readiness, the real open-drawer confirmation,
  current Arabic retry copy and valid receipt-settings data. Assertions remain.
  Application requires exact current trusted failures, preimage/postimage hashes,
  allowed verifier-test paths and a Supervisor lease. Product migrations cannot be
  edited by this helper. Partial repairs fail closed for reconciliation.
- SAS's seven current executed failures have source/artifact-bound review proposals:
  migration compilation PRODUCT_DEFECT; two pre-reset database results, revocation
  fixture and paginator selector VERIFIER_INFRA; two missing staging-receipt checks
  EXTERNAL_EVIDENCE. The blocked database-tests result remains `not_run`. Existing
  product-defect reviews cannot be overwritten by a non-product catalog entry.
  Operation 347 reconciles to 348 with its prior outcome preserved. Only Supervisor
  can reserve a legitimate subsequent product repair. No such attempt ran here.

## Changed files

Under `tooling/control-plane/`:

- `runner/binding-recovery.mjs`
- `runner/bound-failure-review.mjs` (new)
- `runner/bs-agent.mjs` (recovery-only edits over the preserved publication candidate)
- `runner/dot-general-recovery.mjs`
- `runner/dot-health-state.mjs`
- `runner/dot-recovery-worker.mjs`
- `runner/lifecycle-policy.mjs`
- `runner/recovery-action-guard.mjs`
- `runner/retry-exhaustion-audit.mjs`
- `runner/task-supervisor.mjs`
- `runner/task-verifier.mjs`
- `runner/verifier-fixture-repair.mjs` (new)
- `sql/105_recovery_progress_guards.sql` (new; independent upgrade from 103)
- `verifier-repairs/shop-cash-policy.json` (new)
- `verifier-repairs/sas-billing-reviews.json` (new)
- `tests/recovery-progress-incidents.test.mjs` (new)
- `tests/recovery-progress-postgres.test.mjs` (new)
- `tests/recovery-progress-smoke.sql` (new)
- `tests/failure-evidence.test.mjs`
- `tests/verification-command-identity.test.mjs`
- `tests/run-lifecycle.test.mjs`
- `tests/runtime-verification-timer-reconciliation.test.mjs`
- `RECOVERY-PROGRESS.md` (this file)

The Shop recipe contains five fixture files; those existing execution-worktree
files were only read. Repaired copies were tested in a separate disposable tree.
The original SAS migration was only read and compiled in a disposable database.

## Final installation readiness (8 October)

Verdict: PASS for the recovery-only local checkpoint and disposable verification.
This is not an installed immutable release. A reviewed commit and separate live
installation authorization are mandatory; neither was performed.

The separate checkpoint is `.local/recovery-checkpoints/recovery-105-20261008`
in the primary workspace, with `candidate/`, a baseline Git bundle, a recovery-only
patch, a complete SHA-256 source manifest with inclusion reasons, and `evidence/`.
It is based on 9236c3cb6d474f893fd9b9d4dd2826a0fc6bb296, the installed runtime's
source baseline. PR 216 is merged; its branch is not resurrected. The original
worktree and every initial dirty file are preserved, verified by byte hashes.
Migration 104 and the unfinished publication edits are absent from the candidate.

Isolation exposed a recovery dependency on publication's `const`→`let` change
for `bindingSnapshot`. The recovery-only candidate now owns that declaration and
has a regression executing the actual trusted-review refresh region. A separate
activation regression proves rollback restores the pointer and quiesces claimers
instead of restarting the old schema-103 release after a schema-105 upgrade.

Results from the clean candidate, with exact commands/assertions in the checkpoint's
`evidence/COMMANDS.md`:

- Focused: 130 passed, 0 failed/skipped (`focused-clean-candidate-final.log`).
- Full control-plane suite: 576 passed, 0 failed/skipped
  (`broader-clean-candidate-final.log`).
- All three previously skipped PostgreSQL tests: 3 passed, 0 failed/skipped.
  The required runtime role was provisioned in a new loopback-only PostgreSQL 18
  tmpfs container. The first missing-role setup failure is retained separately.
- Current SQL lifecycle smokes: 10/10 passed, synthetic writes rolled back,
  including real exact credit/replay and dependency completion wake behavior.
- Shop verifier: 14/14 browser tests and 1/1 pgTAP command matrix passed again.
  All five tested postimages match the candidate recipe; original fixture files
  are unchanged. No business data was copied and no existing database was reset.
- SAS verifier prerequisites: corrected revocation fixture 7/7 SQL assertions;
  corrected browser selectors 4/4 acceptance tests. The first browser run exposed
  a strict ambiguous empty-state selector after fixing pagination; the tested patch
  scopes page states to the direct status surface. Assertions were retained.
  These two verifier-only patches are separately attached in checkpoint evidence
  for the later supported repair lane. They are not edits to execution 317 and
  do not authorize bypassing its genuine product defect or staging receipts.
- All seven real SAS 348 artifact/receipt/source bindings validate with the clean
  review helper: 1 PRODUCT_DEFECT, 4 VERIFIER_INFRA, 2 EXTERNAL_EVIDENCE.
- Targeted ESLint, `git diff --check`, and 40/40 resilience checks passed.

## Six historical SQL smoke classifications

The exact original SQL files were compared against untouched canonical 103 and
105 in disposable databases. All six raw failures have identical errors/exit 3.
No assertions or historical production behavior were rewritten. Environment-only
fixture seeding then exposes the following obsolete contracts:

| Smoke | Raw failure and provisioned evidence | Classification / installation impact |
|---|---|---|
| dot-health | Missing fixed run 55555555-2222-4333-8444-555555555555. With that task/run seeded, it expects a 2-minute collector to be stale; migration 094 uses 180 seconds. | Missing environment + pre-existing outdated threshold. Current health regressions pass; no installation blocker. |
| dot-general-recovery | Missing cp-selfheal-fixture suit/workstream/policy. Seeded 103 reaches its obsolete general-credit key, rejected since 075. Seeded 105 rejects its health snapshot earlier because it omits current verification identity. | Pre-existing old protocol fixture; 105 additionally enforces its intended current-generation safety guard. New generation/handoff/credit tests pass. Not a regression or reason to bypass the gate. |
| dot-stuck-recovery | Missing fixture. Seeded versions both see raw summary-only product claims as OTHER/uncharged and retain the existing operator boundary, contradicting its assumed consumed=1. | Pre-existing trusted-evidence contract mismatch. Difference in generated IDs is not a behavior change. Current trusted charging/gates pass. |
| retry-lifecycle | Requests max_attempts=3 while the task uses the current standard-five policy; also assumes unreviewed failure permits retry. | Pre-existing budget/authority contract mismatch. Budget checks remain strict; no blocker. |
| retry-exhaustion-audit | Missing fixture. Once seeded it supplies summary-only PRODUCT_DEFECT without execution-bound reviewed evidence. Both reject it identically. | Missing environment + pre-existing trusted-evidence contract mismatch; no blocker. |
| recovery-state | Exact equality against the old 11-class vocabulary; current 103 has 16 classes. | Pre-existing additive-taxonomy contract mismatch; no blocker. |

All six pass unchanged at their historical schema epochs: 44, 53, 53, 17, 53,
and 18 respectively. Logs, seeding SQL and semantic comparisons are retained.
Their unresolved failures when invoked as current-schema tests are documented;
they are not silently counted as current PASS. The authoritative current suite
passes, including the behaviors those old fixtures can no longer authorize.

## Migration 103 → 105 compatibility

The active control connection reports schema 103, PostgreSQL 17.6, no migration 104.
A schema-only read-only admin dump was restored into the disposable PostgreSQL 18
instance. Complete schema definitions, ACLs/default ACLs and role attributes match
with zero differences before 105. The exact migration-owner installer transaction
applies 105 on both canonical 103 and the restored installed schema. Post-105
schemas also match with zero differences.

105 SHA-256: `4c3510cc4a9af406045b14058adb55053adcebe0b5ec1e949d98d76cb0319dbc`.
Replay is refused by the provenance ledger, without schema changes or a second
ledger row. Modified bytes fail checksum validation before execution. New entry
points are executor-only SECURITY DEFINER functions owned by the migration owner
with fixed search paths; the helper remains private. Operator function definitions
and permissions are unchanged. The migration does not mutate operational rows.

The actual canonical numbering is 001–091, 094–103, then 105. Versions 092/093 were
already absent; 104 remains deliberately excluded. No renumbering or hidden
publication installation occurred. `exactMigrationTransaction` accepts an explicit
105 and does not require contiguity. Initial adoption's contiguous 001–091 check
is unchanged. `prepareRuntimeRelease` supports explicit schemaVersion 105.
`installIncidentRelease` pins the previous schema version and therefore is NOT
an upgrade installer: use the maintained general schema/release lifecycle.
The actual candidate correctly fails immutable preparation with
`clean_committed_release_required` until a separately approved commit exists.
Disposable project/baseline/source identities used by tests are not installation
provenance; regenerate against the approved new commit and real active baseline.

## Separately authorized installation, verification and rollback

1. Refresh preflight/PR state. Review/import the checkpoint's exact recovery-only
   patch onto a suitable fresh branch; resolve any base drift and rerun affected
   checks. Commit only after explicit authorization. Do not resurrect merged PR
   216, copy the original dirty publication work, or include 104. Bind the final
   approved commit, file hashes, passed checks and intended environment.
2. Verify active project/baseline/release/schema and current authoritative Shop
   316/346 and SAS 317/348 evidence, artifact/source/fixture hashes, operator gates,
   worker ownership, all three existing run IDs, actual task limits and Shared's
   dependency. If changed, reconcile/rebind; do not force the old recipe/reviews.
3. Quiesce lifecycle writers through the maintained installer procedure and wait
   for owned work to settle; do not clear leases, edit grants/history or replace
   runs. Capture the previous pointer, read-only schema definitions/permissions,
   ledger identity and history/credit/dependency digests for verification. Keep
   claimers quiesced across the schema transaction and runtime activation.
4. Under the maintained global installer lock and serialized database migration
   transaction, apply ONLY exact checksum-bound 105 as the migration owner against
   the real verified schema-103 adoption baseline. No SQL glob from a dirty tree.
   Confirm its single ledger entry, schema fingerprint, least privileges and all
   preserved operational history/credits/budgets/grants/dependencies.
5. Prepare/register the clean immutable runtime with explicit schemaVersion 105,
   including both repair/review catalogs and existing runtime components. Activate
   with compare-and-swap and full readiness checks, using an explicit rollback
   callback that quiesces writers rather than restarting an older schema-103
   release against schema 105. No new n8n workflows need activation. After readiness,
   allow normal adoption/Dot handoff to coalesce one durable wake per affected run;
   use supported enqueue once only if none exists after ownership settles.
6. Verify current trusted checks, one repaired-input verification, operation 347/348
   history, retry charges, completion credit and Shared dependency/wake progression.
   Do not infer completion from infrastructure recovery or fabricate staging data.
   If the migration transaction fails, it rolls back with no ledger/schema effects.
   If activation/readiness fails, restore the prior pointer and keep all claimers
   quiesced; retain 105 and all operational history. Do not downgrade/drop schema
   or restart the old release blindly. Resume only through a separately reviewed
   schema-compatible forward release/fix with successful readiness. Pointer/fail-stop
   rollback and migration replay/no-effects cases were tested locally.

## Expected automatic recovery and remaining prerequisites

Shop: adoption supersedes incompatible generations while preserving history;
Dot hands off without a nested run lock; Supervisor applies the exact five-file
verifier recipe, sees meaningful fixture changes, and verifies the SAME execution
316 once at zero product charge. Required PASS and existing publication authority
must be satisfied before exact credit/continuation; Shared stays blocked until
Shop completes, then receives its normal durable dependency wake.

SAS: Supervisor admits seven exact bound reviews, reconciles operation 347 to 348
while preserving its previous result, and keeps the actual migration compilation
PRODUCT_DEFECT authoritative. Attempt 1 is charged once by trusted accounting.
A further product repair may start only through existing budget/authority; verifier
repairs alone cannot authorize another product charge or unchanged-input verify.
The tested revocation/browser corrections and clean prerequisite preparation are
separate from fixing the product migration. Independent SAS_BILLING_STAGING_EVIDENCE
receipts remain required. A subsequent external-only failure waits for real evidence
without a manufactured human gate. SAS cannot be claimed complete on these results.

No live installation/recovery, service restart, hosted migration, new live attempt,
operator grant change, push, commit, merge or n8n activation was performed.


## Installed-source compatibility checkpoint (8 October; not installed)

Compatibility verdict: PASS for replacement of the actual installed source
`af92fb983c8fcd26bdba37d2b049fdc676590faf` by this combined recovery-only candidate.
The earlier approved commit `e9c57a174ea97a0d681d6dd71bb090db34b45c27` and the
installed incident commit are siblings of `9236c3cb6d474f893fd9b9d4dd2826a0fc6bb296`.
The installed commit changes only the run-recover entry and adds its handoff test.
Installing the earlier approved commit directly would have dropped those changes.

The corrected candidate is the uncommitted worktree
`.local/worktrees/control-plane-recovery-105-compatible-20261008`, branch
`codex/automation-suit/recovery-105-compatible-20261008`, based on the actual
installed commit. The reviewed recovery-only patch applies without conflict.
The source checkpoint is
`.local/recovery-checkpoints/recovery-105-compatible-20261008`.

Both recovery mechanisms are preserved:

- The installed run-recover entry is byte-identical: external/legacy incident
  callers durably enqueue the same run without entering Supervisor inline;
  already-locked internal calls retain the normal Supervisor path.
- Current Dot dispatch uses the reviewed atomic SQL incident handoff, without
  acquiring a run flock or invoking run-recover. Supervisor remains the sole
  lifecycle/lock owner. Refused authority handoffs do not advance task lifecycle.
- Every approved production postimage is retained exactly. The only difference
  from the approved bs-agent is the retained installed run-recover entry.
  Fingerprint stability, fresh health admission, blocked not_run restrictions,
  same-execution changed-input guards, failure-baseline preservation, 347/348
  operation settlement, trusted PRODUCT_DEFECT priority, external evidence and
  product-attempt/credit/dependency protections remain covered.
- All 346 installed immutable release component paths are retained; the complete
  candidate contains 355 components. No existing component is removed. The
  installed regression's old caller-shape assertion is updated to execute the
  actual new Dot dispatch and SQL adapter alongside the retained legacy entry.
  Its other six tests are byte-identical; a new authority-refusal test is added.
- Migration 105 is byte-identical to the validated checkpoint, SHA-256
  `4c3510cc4a9af406045b14058adb55053adcebe0b5ec1e949d98d76cb0319dbc`.
  Migration 104 and the unfinished publication changes remain excluded. The
  previously validated 103-to-105 migration transaction remains applicable;
  this comparison did not execute a live migration or reopen the schema audit.

Final validation from this combined candidate:

- Focused: 138 passed, 0 failed, 0 skipped.
- Full control-plane: 584 passed, 0 failed, 0 skipped, including all previously
  skipped PostgreSQL cases on the explicitly disposable loopback test instance.
- Targeted ESLint: all 19 JavaScript files passed.
- Resilience check mode: 40 mandatory checks passed; no provider activation.
- Diff/scope checks: 24 intended source paths only; no deletions; all installed
  components retained, reviewed production bytes preserved and clean parent
  identity verified. The original 38 dirty files and approved worktree are intact.

Installation compatibility is now established for this composition. This is not
an immutable registered release: no candidate commit, activation, service restart,
live control-state change, operator permission change or hosted migration occurred.
The existing clean-committed-release guard intentionally prevents preparation from
this uncommitted worktree. A separately authorized commit must first bind the exact
checkpoint, then the previously documented schema-105 installation procedure must
revalidate the actual current release/schema/run ownership and use the general
schema-upgrade mechanism, explicit 105, and fail-stop rollback. The incident-only
installer still pins the previous schema and is not the 103-to-105 installer.
