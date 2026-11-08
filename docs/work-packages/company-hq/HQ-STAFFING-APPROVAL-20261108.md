# Staffing proposals and one founder decision

This preparation adds a real, bounded proposal path for an unresolved staffing gap. Amaya prepares the complete proposed profile and exact existing skill revisions; Steve independently reviews the immutable artifact. The founder sees the original brief and acceptance, proposed worker, current manager/model policy, per-skill review criteria and an explicit choice about later continuation. One idempotent decision binds that exact document.

The first version covers T1 workers in the six existing non-HR departments. It does not create departments, executive roles, tools, outreach authority or spending authority. A historical gap is rechecked against current qualified staff before any proposal is queued. The original task is never revived or given a reset attempt budget.

## Current execution boundary

An approved plan stops at `canonical-writer-setup-required`. The released service account cannot publish canonical staff. The learning publisher is unchanged and remains restricted to its existing journal. No credentials, sharing, provider configuration, root controls, host files, Brain documents, live trials or qualification receipts are changed by this source preparation.

The closed publisher interface and post-approval policy checks describe prerequisites, not a working canonical writer or evidence of a completed hire. Delegated qualification execution, Registry activation and automatic task continuation are not enabled by this change. They need the verified writer contract and a reviewed integration follow-up. Existing founder-operated trial/qualification paths remain available and retain their real execution/review requirements.

## Required one-time setup decision

The smallest identified option is six owner-created Markdown profile slots, at most one per existing non-HR department, with stable filenames. Blank slots must remain absent from the Registry. An assigned slot must never be reused for another identity. Capacity exhaustion must be reported.

Any future permission grant must name only those exact files and the existing Registry for the existing dedicated service account. Provider Writer grants whole-file editing; code must restrict changes to the approved profile/new row and, after qualification, the Registry lifecycle cell only. No folder/root sharing, owner-held file creation by a service account, credential export or new credentials are assumed.

Before enabling a canonical writer, a separately authorized disposable owner-owned Markdown probe must prove the exact media replacement protocol: a stale ETag is rejected and both bytes and version remain unchanged. Metadata-only conditional-update evidence and read-before/write-after checks do not establish media CAS. This task runs no live probe. The disabled publisher cannot be unlocked by model output or caller-supplied credentials.

The setup inputs are an owner-approved slot/department mapping, the exact Registry target, unused capacity, independently verified stale-media-write evidence and the reviewed publisher integration. Any uncertain or partial publication must reconcile its original operation before another write. The tested profile and skill revisions must survive qualification; activation may change Registry lifecycle only.

## Compatibility and safety

- Runtime remains in the existing five signed modules. The root updater, trust policy, package allowlist and systemd controls are unchanged.
- Legacy claims exclude staffing kinds. A private one-use transaction fence protects each staffing lease; no persistent ready bit authorizes admission. Existing ordinary work and same-lease heartbeat remain available.
- Contract 2 retains its exact eleven-RPC `status.api` proof. New staffing support is a separate proof. An unavailable additional proof rejects the new candidate while leaving an independently valid legacy contract usable.
- Journals retain versions 1–3 and the same delivery/recovery envelope. All delivery uses `finish_v4`; the database dispatches by durable job kind. The exact released worker can recover finished staffing records, settle started records as interrupted without inference replay, and skip delivered records.
- Claim-time scope/canonical snapshots and immutable draft bindings prevent revision drift from being rebound to an old model result. Malformed JSON settles as blocked rather than poisoning durable recovery. Failed evidence and attempts remain intact.
- New trials bind the existing authorized independent reviewer's canonical identity and exclude hire/head self-review. Valid independently reviewed legacy receipts remain valid. No new reviewer authority is appointed.
- Existing open tabs negotiate ordinary progress metadata; staffing kinds are omitted unless the client declares support.

## Source and verification

Canonical CLI-generated forward migration: `apps/company-hq/supabase/migrations/20261107231929_hq_staffing_approval_workflow.sql`. Its inventory remains pending source review. Preserve all prior migration bytes. Deployment must use the normal GitHub/native staging integration after exact-head checks; never an ad hoc database apply.

Focused commands:

```sh
node --test --test-concurrency=2 tooling/hq-agent-host/*.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tooling/hq-agent-host -p '*_test.py'
node --test apps/company-hq/tests/unit/staffing-bff.test.mjs apps/company-hq/tests/agent-snapshot-version.test.mjs
pnpm --filter @building-suit/company-hq typecheck
pnpm --filter @building-suit/company-hq build
pnpm --filter @building-suit/company-hq exec playwright test staffing.spec.ts
node apps/company-hq/supabase/verify-staging-migration-parity.mjs
```

Tests use generated content, disposable databases and synthetic CLI/provider observations. They do not qualify or activate a real employee. Genuine PostgreSQL sessions cover transaction-fence behavior, installation/heartbeat ordering and concurrent idempotent decisions; actual legacy public overloads are separately exercised across function replacement. Real public routes waited in the outer queue wrapper, so that rollout check is not counted as execution of the fence-suppression branch.
