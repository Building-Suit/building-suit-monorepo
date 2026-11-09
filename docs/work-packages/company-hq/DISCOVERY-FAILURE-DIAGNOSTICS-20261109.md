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
