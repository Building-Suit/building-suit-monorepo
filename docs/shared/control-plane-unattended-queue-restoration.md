# Restore the schema-108 unattended queue

This change restores useful bounded overnight execution using the installed
Supervisor, retry accounting, durable operation outbox, trusted verifier and
separate Draft publisher. It does not introduce an assessor. Migrations 109 and
110 and their worktree are excluded.

## Implemented behavior

- One authenticated owner response to `unattended-queue-release` freezes the
  exact existing queue, task/requirement scope, verification plan, effective
  policy, controller, project boundary and run limit. It authorizes ordinary
  implementation and trusted-PASS Draft publication for that queue. Existing
  authenticated BS-22/BS-23 handle the offer without a workflow replacement.
- The approval explicitly assigns `standard-five` only to listed tasks with
  **no execution history** whose current policy does not already allow five
  attempts. Started tasks and existing five-attempt policies retain their
  policies and profiles. Neither project/workstream defaults nor run limits
  change. The existing trusted product-failure accounting controls retry slots;
  infrastructure failures are repaired/reverified without consuming a slot.
- PASS follows the existing separate publisher: validate evidence and branch,
  commit, push, create/validate an open Draft, record publication, then award the
  existing exact task credit. Codex implementation workers do not publish.
- Blocked tasks retain their original status, evidence and attempts in an
  additive park record, become `blocked`, and relinquish the run's current-task
  slot without credit. Independent eligible tasks can continue. Five trusted
  product failures produce a recorded exhausted park; the loop never requests
  an automatic extra invocation or creates a sixth attempt.
- Empty eligible queues return IDLE. Authoritative dependency/evidence changes
  reuse the persisted wake inbox. Existing infrastructure/publication timers
  can resume parked tasks and reconcile the same execution. New tasks require
  their own bounded authorization; inserting a task never extends a frozen
  queue. Run limits still govern completion and subsequent authorized runs.
- Stale authority blocks only that task. Unknown failures never become product
  failures or PASS. Stop, maintenance, dependencies, decision gates and
  protection checks remain effective.

The archived `live-2026-10-02.json` supplies the original acquire → implement →
verify/repair → publish → continue behavior as reference. Its attempt-specific
n8n graph is not imported. The inspected live BS-20 already delegates
`bs-agent run-supervise` through `BS-00 — Runner Command`.

## Exact existing policy changes requiring approval

The read-only live snapshot on 2026-10-09 contains:

| Queue | Existing run | Limit/credit | Explicit future change |
| --- | --- | --- | --- |
| Shop | `06124632-a51d-4d08-bb62-ee4e8cedb9dc` | 5/14 | Eight unstarted tasks: `shop-launch-three` → `standard-five` |
| SAS | `2518c051-fb28-4641-ae03-c046d7c30807` | 3/7 | None; effective policies already permit five |
| Shared | `1a75a547-3372-4e2a-b51c-3b1b2bf9ad81` | 0/4 | Three unstarted tasks: `shop-launch-three` → `standard-five` |

Shop's eight tasks are `SS-LAUNCH-SOLO-VARIANTS-001`,
`SS-LAUNCH-POS-CUSTOMER-001`, `SS-LAUNCH-FAST-PAY-001`,
`SS-LAUNCH-SALE-COPY-001`, `SS-LAUNCH-SINGLE-SESSION-001`,
`SS-LAUNCH-REALTIME-001`, `SS-LAUNCH-LEGAL-AUDIT-001`, and `SS-VAL-001`.
Shared's three are `BS-REALTIME-FOUNDATION-001`, `BS-REALTIME-ADOPTION-001`,
and `BS-CHANGELOG-VERSION-001`.

`SS-LAUNCH-SUPPORT-001` has execution history and keeps three attempts.
`SAS-M1-BILLING-001` keeps five and its two existing execution rows.
`BS-SA-FUTURE-SUIT-001` retains `shared-foundation-five` and its existing
profiles. All other started/completed tasks, approvals, dependencies, run IDs,
branches and Draft PRs remain intact. The actual cutover must regenerate offers
and abort if these facts changed.

## Acceptance

Run the local unit suite with:

```sh
node --test tooling/control-plane/tests/*.test.mjs
```

Use an explicitly disposable PostgreSQL container for the upgrade test:

```sh
CP_EGRESS_TEST_CONTAINER=<owned-disposable-container> node --test tooling/control-plane/tests/unattended-queue-postgres.test.mjs
```

The integration harness uses actual PostgreSQL functions, actual runner CLI and
Supervisor process, trusted verifier receipts, real Git commits/pushes to local
bare remotes, and synthetic Codex/GitHub endpoints. It makes no paid model call
or live GitHub publication. Run each scenario into a fresh directory outside the
repository so pnpm does not discover the monorepo workspace:

```sh
CP_EGRESS_TEST_CONTAINER=<owned-disposable-container> node tooling/control-plane/tests/synthetic-runtime-e2e.mjs /tmp/<fresh-evidence-dir> --dispatch-integration --fault=restore-ordinary --fault-publication=pr
CP_EGRESS_TEST_CONTAINER=<owned-disposable-container> node tooling/control-plane/tests/synthetic-runtime-e2e.mjs /tmp/<fresh-evidence-dir> --dispatch-integration --fault=restore-fifth
CP_EGRESS_TEST_CONTAINER=<owned-disposable-container> node tooling/control-plane/tests/synthetic-runtime-e2e.mjs /tmp/<fresh-evidence-dir> --dispatch-integration --fault=restore-exhaust
CP_EGRESS_TEST_CONTAINER=<owned-disposable-container> node tooling/control-plane/tests/synthetic-runtime-e2e.mjs /tmp/<fresh-evidence-dir> --dispatch-integration --fault=restore-wait
CP_EGRESS_TEST_CONTAINER=<owned-disposable-container> node tooling/control-plane/tests/synthetic-runtime-e2e.mjs /tmp/<fresh-evidence-dir> --dispatch-integration --fault=verifier-fixture
```

The restore scenarios assert one authenticated owner response, no assessor calls,
Draft-only publication, exact credits, crash/restart, automatic next acquisition
and replay without duplicate work. The wait scenario also starts a new, separately
authorized queue after IDLE and checks that the persisted consumer acquires it
while the old blocked queue stays unchanged. The fifth-attempt fixture fails a real
registered product test on attempts 1–4, then passes on 5. Exhaustion fails it
five times and still completes the independent second task. The external-wait
fixture retains missing evidence, uses zero product slots, and completes the
second task. The verifier-fixture fixture repairs its exact reviewed test
prerequisite, reverifies the existing execution, and retains dependencies.

## Prepared cutover and rollback

`n8n/prepare-unattended-cutover.mjs` accepts a local JSON configuration containing
`sourceRoot`, `releaseHome`, `consumerExport`, `runSnapshot`, `adoptionSnapshot`,
`proofs` and `output`. It verifies the installed content-addressed release,
active consumer interfaces, exact source/migration hashes, project ref and
passing acceptance receipts, and writes only a local cutover manifest. It never
commits, pushes, executes SQL, changes services or imports n8n workflows.

The current immutable runtime is schema 108, commit
`1a4f32436ec065e632ea5cc5c8fdce493875e41a`, release
`ee21b881a8ee822f014d475143588f9a00ad590beea35b6d6e0cbed860e3920a`.
The inspected consumer uses workflow IDs `pg0BEkbP9E4H4RqB`,
`BS22OperatorGates`, `BS23OperatorCapability`, and `rzoRWvnSBG7sU1Oh`.
The installed bootstrap also passes disposable activation, CAS-conflict, failed
readiness rollback and explicit schema-108 pointer restoration tests.
Its forced SSH wrapper resolves the same `current` release pointer as the
Supervisor bootstrap. No workflow JSON needs importing.

After explicit cutover authorization, the **separate publication owner** must
publish the feature commit and Draft PR, following preflight and PR checks.
Before pushing, verify actual provider integration settings prevent feature
deployments and Supabase Automatic branching. The five checked-in Vercel configs
disable feature deployments; dashboard settings have not been asserted from
repository files. Missing provider evidence blocks publication until verified. The
worker-created source must never be disguised as a clean committed release.
Quiesce writers and wait for unfinished runtime operations; preserve protective
holds and take schema/history digests. Verify project
`padtxclxwwqvvuiebhte`, adoption baseline
`f52be13e-23ce-40ef-9627-7f0df80904ab`, current release, interfaces and run scope.
The checked-out staging base includes the committed installed-108 compatibility
changes so the candidate does not regress the actual consumer. No unrelated dirty
files were copied from another worktree.

Apply **only** `111_unattended_bounded_queue.sql` with the existing
`exactMigrationTransaction` helper, actual published source SHA, exact checksum,
project ref and adoption baseline. It runs under the migration-owner capability
and existing serialized ledger. The upgrade test proves 108 → 111 without 109/110,
history preservation and rejection of replay. Compare history again before
releasing writers.

Use `prepareRuntimeRelease` with clean published source, the installed file list
plus the manifest's new files, schema version 111 and the executed acceptance
receipts. Register the release using the existing installer capability. Use
`activateRuntimeRelease` with `expectedCurrent` from the manifest and the existing
restart/readiness callbacks. Verify the actual forced-SSH consumer path, runtime
ledger, schema functions, services and persisted wake acquisition. Through the
authenticated owner capability, record the exact three queue approvals and only
their listed future-policy changes. Restore only holds introduced by cutover;
enqueue the existing run IDs. No automatic product SQL, integration merge or
deployment is authorized.

Activation/readiness failure automatically restores the previous pointer and
services. Later rollback quiesces writers, holds the three runs, revokes the new
queue grants, restores the saved schema-108 pointer and restarts its services.
Keep additive schema 111 and its ledger, every execution, park record, branch,
Draft and credit. Do not refund attempts. Only an explicit owner may restore a
changed policy for a task that still has no execution. Rollback is a safe pause,
not destructive replay of previously published work.

## Remaining safety exceptions

Shop Support's protected SQL/provider scope is still blocked. SAS Billing still
requires its genuine independent staging evidence and verifier prerequisites.
Shared dependencies still require actual parent completion. None of these is
waived by a queue grant; independent eligible tasks continue.

Missing or stale trusted PASS, command/source/requirement evidence, revoked or
changed authority, unknown failure classifications, secrets, SQL/provider/CI
changes and access-control/security-sensitive edits require specific resolution.
The narrow publication guard covers shared auth/contracts/data-access packages,
auth/security/permission/policy/OAuth/JWT paths, `.github`, `.gitmodules` and
server API/middleware/plugins. Existing protection gates remain in force.
These changes need separate specific review/publication authority; the ordinary
queue cannot approve them. Five exhausted genuine failures stay blocked.

There has been no live workflow, database, service or release-pointer mutation.
