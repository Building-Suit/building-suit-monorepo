# Private discovery failure diagnostics — 9 November 2026

## Scope

Based on `stg` commit `f24ca26f1964f8473ce22ce36be5475697bd58fa`.
Preserve the local discovery server's eight bounded failure codes in both
app-server and legacy exec JSONL processing. Before accepting a code, revalidate
the current agent/job/permit binding, original attempt, fixed policy/category,
typed completed item, server/tool and empty arguments. Accept one exact text
block with the error marker and no provider metadata or extra fields. Mixed
camel/snake-case metadata remains visible to validation. Unknown or forged
payloads retain the generic failure. Failed retrieval produces no source receipt,
qualification, retry or model fallback. Observed error snapshots are copied and
frozen. No raw provider text or session value is added to logging.

This is diagnostic plumbing, not a recovery of historical provider errors.
The old failed trial cannot be reconstructed. No live trial, employee binding,
host runtime, deployment, hosted database, personal network or outreach changed.

## Verification

- `node --test tooling/hq-agent-host/discovery-mcp.test.mjs tooling/hq-agent-host/discovery-worker.test.mjs tooling/hq-agent-host/public-repository-worker.test.mjs`: **194 passed, zero failed**.
- Discovery-worker subset: **125 passed**, covering all eight codes, all three
  frozen retail categories and both protocols, duplicate failures, hostile text,
  mixed metadata, identity/category/binding mismatches, failed durable delivery,
  no source receipts and no fallback.
- `node --test tooling/hq-agent-host/retail-discovery-db.test.mjs`: **2 passed**,
  including transactional settlement of all eight codes, persisted failed host
  evidence/observed errors, zero source receipts and no qualification. A failed
  host module attestation intentionally remains durable; it is not source evidence.
- Independent code review found one error-payload normalization gap; fixed by
  preserving error payloads unchanged. Re-review found no remaining code blocker.
- `node tooling/design-tokens/generate.mjs --check` and
  `node tooling/checks/workspace.mjs`: passed.
- `git diff --check`: passed.
- Full host suite attempted; lifecycle subprocess fixtures time out before
  their intended behavior. The first failure reproduces in the unchanged source
  checkout. This is not a full-suite pass.
- Python host suite: 58 tests, one failure and two errors. Docker is absent;
  the ownership/trust-path test also fails unchanged in the baseline checkout.
- `pnpm agent:preflight` blocked by pnpm 11.25.0 vs required 10.33.0.
  Direct Node fallback fetched but cannot run authenticated `gh`. Connected
  GitHub reads verified staging and open PR state instead. No hosted CI pass
  or publication is claimed.

## Publication hold

Existing open HQ PR529 (`0aa29288`) and PR530 (`2f6787b9`) are not ancestors
of current staging. PR528 merged but PR529 still targets its branch. PR530
contains 63 unique changed files and lacks the current host-worker tree.
Read-only merge previews show five conflicts for PR529 and seventeen for PR530,
including files retired on staging. Stacking this narrow fix on those old trees
would import unrelated history and scope. Preserve their branches and PRs;
publication remains held for owner-directed stack reconciliation. No main or
production action, destructive cleanup, check bypass or unrelated merge occurs.

Content comparison confirms these are not merely squash-merged equivalents:
`git cherry` marks all eight old commits unmatched, and all 63 changed paths
differ from staging (53 absent, ten different). This does not judge whether
their product intent was superseded; that decision belongs to their owner.

Final independent review reran all 125 worker fixtures successfully and found
no remaining blockers or material assertion weaknesses. Release provenance and
current-main net coverage checks passed against the exact staging base above.
The test executor uses Node v24.22.1, not repository-requested v26.8.1; focused
passes do not establish the supported runtime or hosted CI gates.

## Aggregate compatibility blocker

The broader host run completed: **358 tests, 344 passed, 14 failed**. It began
before expanded fixture editing finished, so the clean focused runs above are
the final-change evidence. Eleven lifecycle tests time out; the candidate-health
failure reproduces unchanged. The symlink-entry release-switch test also times
out unchanged. Their underlying cause has not been established.

A separate **real integration regression** must not be attributed to the test
environment: `public-repository-db.test.mjs` passes 9/9 on the unchanged checkout,
but the modified worker rejects the real typed bundle at
`HQ_REPOSITORY_HOST_INVALID`. The canonical repository SQL deliberately pins
`hq_private.repository_worker_digest()` to the old worker source digest. Editing
worker.mjs changes that digest. The validator and qualification predicates must
not be bypassed, and the applied migration must not be edited. A reviewed forward
compatibility/rollout plan is required before this worker can be released; merely
changing the pin can invalidate existing repository qualifications and reject
the still-running old host. No pin, migration, qualification or live host changed.

The narrow diagnostic code is therefore prepared, **not release-ready**. The
independent code-local review does not override this aggregate compatibility
blocker or the separate PR-stack hold.

## Local forward compatibility preparation

A subsequent explicitly authorized local-only follow-up prepares
`20261109013324_hq_repository_worker_compatibility.sql`. It adds a private,
immutable, invoker predicate that recognizes exactly the original worker digest
`bb6c941f2398b4067d963e9c0de21c53738fa0729f9bb96ee64c89fb7159dd88`
and this reviewed diagnostic worker digest
`5331fdf1b01e935432e2408f81a53b9da7cb4fe66b56dfe9553d36e90b5e9747`.
Missing/unknown values return false. Public, anonymous, authenticated and
service-role execution is revoked on the new helper. The old singleton digest
function and every applied migration remain unchanged.

The forward migration replaces only the worker-source comparison in
`repository_validate_host`, `repository_source_valid`, and
`repository_review_ready`. All existing module, policy, artifact, founder,
agent, reviewer and scope checks remain. Each replacement must match exactly
once or the transaction aborts. Function signatures, owners and privileges
remain in place. No evidence rows, qualifications, public RPCs, API version,
budget, retries or deployment controls are changed. The exact two-source set
is deliberate approval of these reviewed versions, not automatic acceptance
of future worker changes.

Deployment is **not authorized or performed**. A later rollout must independently
verify the final worker source digest and module digest, review the migration,
and confirm its application on the exact intended environment before changing
the host. With old SQL, the new worker still correctly fails repository
attestation; an unchanged API version is not evidence the migration ran. With
new SQL, either reviewed worker version remains admissible under the unchanged
module/policy binding, so a host-only rollback to the old binary need not erase
new evidence or requalify historical workers. SQL rollback is not proposed:
removing new-source acceptance after new proofs exist would make those proofs
ineligible again. A future retirement of either digest needs its own reviewed
forward policy change. Do not forge the old digest or rewrite stored evidence.

Compatibility verification: `node --test
 tooling/hq-agent-host/public-repository-db.test.mjs` passes **10/10**. It runs
actual baseline worker source from full commit
`f24ca26f1964f8473ce22ce36be5475697bd58fa`, verifies its SHA-256, and creates
reviewed evidence and qualification before migration. The old database rejects
the actual new worker first. After migration, historical rows/readiness and the
public capability response remain identical, both actual worker versions
validate, and current-worker qualification, repairs, failures, cancellation and
budgets retain their checks. Function OIDs, owners, ACLs, signatures, security
attributes and configuration are unchanged; full definitions match exactly the
three planned expression replacements. Unknown/missing/malformed digests,
wrong module and forged policy are rejected. No stored evidence is rewritten.
These tests require Git history containing the pinned baseline commit.

Independent final SQL/test review found no remaining blocker for **local
compatibility preparation**. It verified the final candidate digest and the
exact expression/privilege assertions. This resolves the demonstrated local
repository attestation regression only when the prepared migration is present.
It does not clear the PR-stack hold, unrelated aggregate test failures, supported
runtime verification, hosted CI or deployment authorization. The migration's
source-drift abort branch is reviewed but not separately fault-injected.


## Source publication correction

Draft PR555 publishes the reviewed source only. The compatibility proposal now
lives at `tooling/hq-agent-host/proposed-migrations/hq_repository_worker_compatibility.sql`,
with byte-identical SQL. Disposable tests load that explicit proposal. The active
migration directory and reviewed applied/pending parity inventory are unchanged.
CI originally caught the uninventoried active file; this move preserves the
parity gate rather than claiming live application. No SQL was applied.

The complete final local host run reported 459/471 passing, with eleven lifecycle
fixture timeouts and one symlink-entry timeout; representative baseline runs
reproduced both categories. The repository compatibility regression is resolved
by the prepared SQL. A separate run excluding only those two fixture files passed
457/457. Neither result establishes a complete supported-runtime pass.
