# SAS-M1-BILLING-001 verification and handoff

Status: Super Admin implementation provided; full task acceptance blocked by target projection and local/external verification prerequisites. No commit, push, deployment or hosted database operation was performed.

The database-configured `payment-review` module uses the existing owner-only billing binding intersection. Provision a navigation record through the existing audited configuration command, with empty route descriptor, owner visibility, required capability `shop.billing.query` version `1.0`. The binding must authorize both billing query and command. No operational navigation or commercial values are seeded.

The page uses `BsDataTable` lazy pagination (25 rows) and target status filtering. Sort order remains the Shop authority's stable submitted-time/ID order; no client page sorting or unbounded scan is introduced. Frozen plan name/slug, interval, list/effective/declared paid amounts, transfer metadata and quota blockers come from `shop.billing.query` `{resource:"queue",status,page,pageSize}`. Blockers use the actual Shop `{resource,used,limit,excess}` contract. No live catalog value replaces a frozen term.

Review commands use Shop's existing `{action:"mark_under_review"|"reject"|"approve",submissionId,payload}` shape. All require a reason (8–1000 characters under the Admin dispatcher). Approval requires explicit external verification, positive two-decimal amount, received reference/date and an amount-override reason when either declared or received amount differs from frozen effective price. Approval is unavailable if frozen limits are missing or quota blockers are reported. Shop must still enforce amount mismatch, state, resource locks and exact-once commercial activation atomically. Super Admin does not duplicate that state machine.

An unconfirmed sent command retains its exact request/correlation IDs, reason and payload; fields are locked, and a closed dialog can be reopened with “Retry exact request.” Another row cannot replace that unresolved command. Session/binding changes clear private state. The periodic registry refresh pauses while the review dialog is open or a sent command remains unresolved. The actual target's persisted receipt remains the commit authority. Reloads do not preserve private draft/payment data in browser storage.

Successful signed review receipts must match submission/status and include target audit, result version and replay flag; approvals must include a matching active subscription and period end. The new forward migration wraps the existing response verifier and adds one immutable Admin event per request, storing actor/Suit/environment/reason, payload digest, result status and target audit/subscription/period references. Private evidence URLs and bank details are excluded from the Admin event. No new public RPC signature/type is introduced; generated database types were not hand edited.

## Target contract blockers (not acceptance PASS)

The inherited Shop `platform_admin_billing_read` queue supplies no `resourceLimits`, `privateOfferId`, or `evidence` array. Its private offer implementation stores identity in submission metadata but does not project it into the queue. Its bridge evidence-access endpoint requires a known evidence UUID, and the queue does not provide evidence discovery. Its approval result returns the submission plus subscription snapshot, but no commercial-period ID. The later private-offer manifest also omits the `evidence` resource although the dedicated evidence access endpoint exists.

Therefore the current real queue can be reviewed/rejected, but approval is intentionally blocked by unavailable frozen limits and evidence review cannot be discovered. UI support for explicitly supplied `resourceLimits` (all six v2 resource keys), `privateOfferId`, `evidence: [{id,originalFileName,mimeType,sizeBytes,sha256}]`, and result `commercialPeriodId` is a bounded presentation contract, not a claim that these target fields exist. Absent evidence metadata is “unavailable,” not “no evidence.” The time-bounded access flow uses the existing target-owned `{resource:"evidence",submissionId,evidenceId,expiresIn:60}` query and accepts a matching HTTPS private-storage URL with a target expiry of at most five minutes; the URL is cleared on expiry, dialog close and session/context change. Evidence never initiates approval.

These target-owned projection/manifest/result extensions require a separately authorized Shop task; this task is allowed to modify only `apps/super-admin-suit/**`. No Shop file was changed, imported or accessed at runtime. The Super Admin database cannot prove Shop replay/amount-mismatch/quota business invariants. SQL tests here exercise actual Admin authorization/verification/audit with explicitly synthetic signed responses, and must not be reported as Shop activation tests.

## Executables and actual local results

- `pnpm agent:preflight`: failed; GitHub/fetch state could not be verified (255). Local implementation continued in the supplied clean worktree without publication/base decisions.
- `node --test apps/super-admin-suit/tests/unit/sas-m1-billing-001-2.test.mjs`: passed. Covers frozen projection omissions, amount validation/mismatch, quota gating, correct state/reason, exact retry input, authoritative receipt checks and evidence URL/expiry binding.
- `pnpm exec turbo run typecheck lint build --filter=@building-suit/super-admin-suit`: passed after correcting the verification selector's shared select value type and lint ordering. Re-run after any subsequent source changes.
- `pnpm check`: passed canonical token and workspace ownership/boundary checks.
- `node --test apps/super-admin-suit/tests/unit/*.test.mjs`: 8 passing files, external staging-evidence file failed as required without receipts.
- `pnpm test`: 80 passing files, 3 failures: this task's missing staging evidence, `tooling/control-plane/tests/batch-ssh-transport.test.mjs`, and `tooling/git/tests/dev-worktrees.test.mjs`. Direct diagnostic executions of those two tooling files exposed `spawnSync /bin/bash EPERM` and `spawnSync /usr/bin/node EPERM` respectively. No unrelated test was changed.
- Registered SQL commands `pnpm exec supabase test db --local supabase/tests/sas-m1-billing-001-{2,3,4}.test.sql` from the app: all attempted, blocked by unavailable localhost database (64322). `DO_NOT_TRACK=1` avoids the CLI attempting to write telemetry outside the writable worktree. Full `pnpm db super-admin-suit test db --local` also attempted and blocked. `pnpm db super-admin-suit start` attempted safely with telemetry disabled, but Docker socket access was denied. No reset/migration application/type generation was possible; SQL correctness and live authorization remain unverified.
- `pnpm exec playwright test --config apps/super-admin-suit/tests/e2e/sas-m1-billing-001-5.config.ts --workers=1 --retries=0`: attempted; local webserver could not start, and availability probes fail `connect EPERM 127.0.0.1:4324`. No browser scenario ran, screenshot was captured, or visual/keyboard/RTL acceptance established. The authored spec covers English/Arabic, desktop light/mobile dark, keyboard entry, retry, mismatch validation, review/reject/approval receipts, explicit evidence review, missing target data, quota blockers, empty/error/denied states. Extended fixtures prove presentation only.
- `git diff --check`: passed.

## Retry-2 repair evidence (2026-10-08)

Repair remains incomplete pending successful required verification. Only three recorded causes were edited: parenthesize the completion wrapper's SQL `CASE` expression so PL/pgSQL can parse its `IF`; set `disabled_at` in the disabled-owner fixture while retaining the constraint and all seven assertions; select the shared paginator's accessible “Next Page” button instead of its absent styled class. The audit assertion, staging evidence gate and remaining browser assertions are preserved.

All seven distinct recorded failed commands were rerun:

- `pnpm --filter @building-suit/super-admin-suit test:unit` and `node --test apps/super-admin-suit/tests/unit/sas-m1-billing-001-1.staging-evidence.test.mjs`: exit 1. Diagnostic execution with `--test-isolation=none` exposes the unchanged missing `SAS_BILLING_STAGING_EVIDENCE` assertion; the full diagnostic unit run passes 40 tests and fails that one required gate.
- `pnpm exec supabase db reset --local` from the app: exit 1. Initial invocation cannot write CLI telemetry outside the writable workspace; retry with `DO_NOT_TRACK=1` reaches local setup and is denied Docker socket access. No migration was applied. The uncommitted migration's compilation repair therefore remains unverified.
- `pnpm exec supabase test db --local`, `pnpm exec supabase test db --local supabase/tests/sas-m1-billing-001-2.test.sql`, and `pnpm exec supabase test db --local supabase/tests/sas-m1-billing-001-4.test.sql` from the app, with telemetry disabled: each exits 1 because `127.0.0.1:64322` refuses connections. No SQL assertion ran; audit and revocation results remain unverified. A successful clean local reset must precede these reruns.
- `pnpm exec playwright test --config apps/super-admin-suit/tests/e2e/sas-m1-billing-001-5.config.ts --workers=1 --retries=0`: exit 1 because the configured webserver exits early. Direct diagnostic startup confirms `listen EPERM 127.0.0.1:4324`; no browser scenario ran. The selector repair and all later assertions require a runnable browser fixture.

`pnpm --filter @building-suit/super-admin-suit lint` and `git diff --check` pass. `pnpm agent:preflight` still fails (255), leaving GitHub/fetch state unverified. No commit, push, merge, deployment, hosted database operation, fabricated receipt or weakened check was performed. Independent final verification remains with the control plane.

## Independent staging gate

`node --test apps/super-admin-suit/tests/unit/sas-m1-billing-001-1.staging-evidence.test.mjs` was executed and failed because independently reviewed staging receipts are missing. It never contacts or mutates a provider. Set `SAS_BILLING_STAGING_EVIDENCE` to the independently collected JSON artifact when available. Required fields: `taskId`, `environment:"staging"`, `sourceDigest`, `independentReviewer`, HTTPS `evidenceUrl`, fresh `capturedAt`, binding/environment IDs and two `journeys` named `submit-evidence-under-review-reject` and `submit-evidence-approve`. Each journey needs `passed:true`, HTTPS `browserEvidenceUrl`, submission/evidence/request/correlation/target-audit IDs and `bankVerified` (false for rejection, true for approval); approval also needs subscription/commercial-period IDs, `activationCount:1` and `replayActivationCount:1`.

The digest is SHA-256 over sorted app-relative file names, NUL, bytes, NUL for every file in `app`, `server`, `i18n`, and `supabase/migrations`. Receipt age is limited to seven days and future timestamps fail. This is an explicit external gate, never replaceable with local PASS text or browser fixtures. Artifact authenticity and actual hosted target/source identities still require independent review; this executable does not manufacture that authority.

## Authenticated recovery: local browser verifier repair (2026-10-09)

The preserved execution remains 318; failed verification 350 remains historical and no product retry or completion credit was created. The browser test now selects the payment-review section's direct empty/error/loading state, rather than also matching the nested BsDataTable state. Its error state must be unique and the localized Reload queue action must restore the review control. No payment, denial, idempotency, locale, responsive or focus assertion was removed.

`pnpm exec playwright test --config apps/super-admin-suit/tests/e2e/sas-m1-billing-001-5.config.ts`: four cases passed (English/Arabic, desktop/light and mobile/dark). `git diff --check`: passed. This is local fixture verification, not independent staging evidence or full trusted task acceptance. The authoritative SAS staging project lacks `public.super_admin_adapter_complete`; the candidate's billing journey cannot be evidenced there without a separately authorized staging rollout. The required source-bound staging receipt gate remains unchanged.

## M1 prerequisite recovery: fresh local acceptance

The preserved Billing candidate was migrated from a clean disposable SAS local
database, without touching Shop's backend or workers. The full SAS SQL suite
passed (8 files, 68 assertions), including all three Billing database obligations.
The Billing domain unit executable passed all 5 tests. All 4 registered browser
cases passed, covering English/Arabic and desktop light/mobile dark. No additional
browser repair was necessary. These synthetic signed responses establish local
Admin behavior only; they are not genuine Shop staging activation evidence.

The mandatory staging-evidence executable was rerun and failed on the unchanged
missing receipt assertion. Read-only inspection found only the configuration
authority migration in SAS staging, no adapter completion RPC, zero bindings,
zero adapter registrations and zero signing-secret references. Shop staging has
the existing bridge/evidence/private-offer schema and active bridge function,
but zero configured integration principals. Both staging Vercel projects track
`stg`; their deployed commit does not include this uncommitted Billing candidate.

Raw local logs and source-bound hashes are preserved under
`.local/sas-prerequisite-recovery-20261010`. Execution 318, historical verification,
external-evidence hold, queue grant and attempt accounting were not changed.
No trusted task PASS, completion credit, Draft PR, hosted mutation or deployment
was produced by these local checks.

## Authorized source verification continuation — 2026-10-10

Execution 318 remains preserved. Fresh typecheck, lint, build, all five Billing
domain tests, four English/Arabic desktop/mobile browser cases and all 68 local
SQL results passed. The composed Billing/Custom/Audit candidate also built and
passed 116 SQL results and 16 local rendered cases. Mock API responses and local
SQL fixtures do not attest a hosted payment journey.

The unchanged mandatory independent staging-evidence executable failed on its
missing genuine receipt. Hosted staging writes remain on hold for backup-capable
PostgreSQL profiles, encrypted backups/disposable restore and the independently
authorized reviewer/verified transfer evidence. No payment evidence, approval,
trusted task PASS, new attempt or completion credit was invented.

## Manual InstaPay verification correction — 2026-10-10

The current owner instruction clarifies SAS-PAY-004, SAS-PAY-005 and SAS-SUB-001:
manual external transfer to `building-suit@instapay`, private Shop evidence,
and review by an authorized owner/operator. There is no payment gateway or
mandatory third-party payment reviewer. A synthetic staging approval exercises
the authorization/state machine, not receipt of actual funds. The external
receipt validator now requires an independent browser/signed-adapter observer,
exact execution 318/source digest, integrity-bound private observation artifacts,
authorized operator review, explicit synthetic/no-funds labels, replay counts,
quota/evidence/mismatch/audit checks. It rejects claims that synthetic funds
were bank-verified. No genuine staging receipt was manufactured.

Live authenticated SAS staging observation found a genuine product blocker:
the signed queue API returned HTTP 200, but an existing legacy request had only
four frozen quota keys. The strict parser discarded the entire queue. The
candidate now displays incomplete frozen terms as unavailable and preserves
review/rejection while prohibiting approval; it never substitutes catalog limits.
Unknown quota keys and malformed limits still fail closed. This source repair
has NOT been deployed. Current authorization says not to repeat deployments.
The hosted approval journey cannot pass until this reviewed correction is
installed in SAS staging. No third-party reviewer or new bank transfer is
required to resolve that application blocker.

Actual local checks: 19 unit/receipt-contract tests and four rendered browser
cases passed; typecheck/lint/build and focused lint passed. SQL verification first
exposed a missing Billing migration in the disposable local SAS backend; the
migration was independently confirmed already installed in hosted SAS staging.
It was added only locally for representative verification. Raw results are in
`.local/billing-manual-*.log`. The mandatory hosted receipt gate remains failed
for absent genuine receipts. Execution 318, run history and attempts are not
reset; no Draft, trusted PASS, credit, deployment or hosted migration is claimed.

## Authorized parser-only staging correction — 2026-10-10

Deployed only app/utils/payment-review.ts to SAS staging deployment dpl_FbjGbVkdowqrZ3Vutw8eFRhi7NuE. Staging aliases independently observed Ready; previous deployment dpl_284czrW54scZyg84R6tNWfmHjxqZ remains Ready for rollback. Authenticated queue loads. Synthetic submission df4aa9f8-ee00-49bc-8b81-a8cac66f0237 genuinely transitioned to under_review then rejected through signed adapter, with target audit receipts; no received funds were claimed. Full external acceptance remains FAIL/uncompleted: manual-transfer resource/response contract mismatches installed Shop configuration API, and deployed Shop billing UI lacks private screenshot upload. No new execution, approval, credit, migration, or Shop deployment was performed. Partial observations are not a passing acceptance receipt.
