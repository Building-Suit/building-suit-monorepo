# Shop ETA submission support

Status: implemented for preproduction configuration; final-head PR checks remain the staging release gate. Parent owns staging integration; no hosted writes or live activation.

Branch: `codex/shop-suit/eta-submission-support`; committed parent PR #315 at `8c6ba799c4d72beb13e64d2539fa350ca9560dfc`, on tax PR #314 at `0ab1aac7d5689c9cdc7ba5b0b2f54675012aacf2`.
Observed actual origin/stg: `4c1ac6cc9652e3fedfc3e9a7368962baeb7c7290`.
No unpublished parent files were copied. Materials remains separately owned.

Acceptance: manager-owned merchant/branch/POS/item setup and status UX; immutable EGP-only versioned ETA adapters independent of calculation; durable tenant/location-scoped outbox with idempotency, leases, retry and asynchronous reconciliation; deterministic payload/state/authorization tests. Existing currencies stay supported operationally. Partial-return business workflow remains separate; adapter accepts immutable original references. Legacy snapshots are unsupported without invented backfills.

Official documentation rechecked 2026-10-15:
- https://sdk.invoicing.eta.gov.eg/documents/receipt-v1-2/
- https://sdk.invoicing.eta.gov.eg/documents/return-receipt-v1-2/
- https://sdk.invoicing.eta.gov.eg/ereceiptapi/01-authenticate-pos/
- https://sdk.invoicing.eta.gov.eg/ereceiptapi/02-submit-receipt/
- https://sdk.invoicing.eta.gov.eg/receiptissuancefaq/
- https://sdk.invoicing.eta.gov.eg/integrationpractices/
- https://sdk.invoicing.eta.gov.eg/main-calculations/
- https://sdk.invoicing.eta.gov.eg/codes/tax-types/

202 means submission, never validated success. POS tokens are cached. Receipt UUID/chaining is per POS. ReferenceOldUUID correction differs from a return's referenceUUID. Fees/adjustment remain zero. eInvoice requires CAdES-BES; the current eReceipt submission page describes signatures but says signature validation is not deployed pending ETA decision. Keep the receipt provider contract explicit rather than infer eInvoice activation rules.

Live activation requires taxpayer-specific mandate review, registered/activated POS and correct channel tags, verified official item/unit/activity/branch codes, provider/signing setup appropriate to channel, dispatch configuration and external ETA acceptance evidence. Saving settings never activates submission or establishes compliance.

Verification and exact remaining setup will be recorded with the final head.

## Handoff and verification

Draft PR: https://github.com/Building-Suit/building-suit-monorepo/pull/316
Worktree: `/workspace/shop-eta`. First durable checkpoint `8315e7a9`; first implementation `9929f324`.
Both dependencies are now merged: tax #314 → `c13fc01609f3b2fc7cf4bc46f9d28d134cebfd6f`; materials #315 → `4b4c3ca5ffed96e7d61f6eb5a60d04a52862aa0c`.
ETA merged the actual staging head into its own branch at `c0e82ee5` and retargeted #316 to `stg`. No dependency commits were replayed. #316 is the sole Shop staging root; parent still owns the staging merge.

Stable contracts and exact remaining server setup: `apps/shop-suit/docs/eta-submission.md`.
Forward migration: `20261015021836_eta_submission_support.sql`. Applied migration history is unchanged.
All presentation is in shared UI; existing shared UX record-action/form controllers provide interaction. Shop owns business adapters, typed values, errors and authorization. No frontend `.agents/skills` files existed in the selected cloud environment; maintained scoped UI/Shop/database guidance was used.

Actual checks:
- 349 Shop unit tests pass, including 27 ETA payload/worker/server-boundary tests.
- EN desktop and AR mobile ETA browser cases both pass, including saving setup, pending validation status and no overflow.
- Shop production build passes. All six workspace app typechecks pass (including documentation after generating its catalogue).
- Shop lint has zero errors; two pre-existing owner-invitation attribute-order warnings remain. Changed shared UI/tooling lint passes.
- Workspace boundaries pass: 83 complete route templates, 80 unchanged historical migrations, zero migration debt. Strict Suit UI check passes: 97 Vue files in five Suits, zero violations.
- Disposable SQL run https://github.com/Building-Suit/building-suit-monorepo/actions/runs/38672435604 passes the full migration chain, ETA configuration/replay/tenant and location denial, frozen identities/payloads, legacy/non-EGP export rejection, leases/retries/status/crash safety, inherited tax/receipt/commission suites and two real PostgreSQL sessions.
- The public database type file is restored unchanged from that run's CLI-generated schema output. Azure artifact download returned Forbidden in this environment; the workflow's public-schema-only log recovery restored the identical generator output, without manual declaration edits.
- The concurrency runner also includes an explicit two-session advisory barrier so final-head CI proves both replay requests reached the race before release.
- Required final-head review, branch policy, full verify and disposable suites must be assessed on PR #316 after the final checkpoint. Earlier parent-targeted `verify` skips are not represented as full validation.

Local Supabase could not extract the Postgres image (`no space left on device`); only this task's retrying CLI process was stopped. No Docker resources or other task files were deleted. SQL verification ran on disposable GitHub-hosted runners instead. Local Node 24 satisfies engines; required CI uses the pinned Node 26.8.1.

Provider blocker observed after retarget: Vercel returned deployment rate limits across all six linked projects with “retry in 24 hours.” Existing provider settings were not changed or bypassed. Feature builds were previously marked ignored; this quota failure is separate from code tests and must be rechecked before staging integration.

No hosted migrations, live credentials, active scheduler, production endpoint, compliance/acceptance claim or production/main promotion. Remaining setup: deploy migration through existing CI/provider integration; deploy the server-only function; configure managed preproduction POS secrets and a trusted scheduler. B2B dispatch requires an actual CAdES-BES/provider integration; partial-return commands remain separately owned. Live activation additionally requires mandate/channel review, registered POS, official code confirmation and external ETA acceptance evidence. User manual testing follows parent-owned staging integration.
