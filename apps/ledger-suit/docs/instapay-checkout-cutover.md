# Ledger InstaPay cutover — recovery checkpoint

Status: local implementation checkpoint, unpublished and not release-qualified. Main promotion and general Ledger marketing are held by the user's latest instruction until this cutover is completed and verified.

## Saved scope

Historical Shop manual flow: commit a7bab9d0, migration 20260928200000_manual_instapay_billing.sql. Ledger reuses its existing server-priced immutable manual quotes, private receipt evidence and dedicated audited operator approval. Submission does not activate access. Existing active-period conflicts, membership/capability checks, integer minor units and historical payment records remain.

Applied local edits: primary plan choice opens the existing manual flow; new browser enrollment no longer invokes the online provider; EN/AR customer copy and factual payment-policy text describe InstaPay/manual review; the retired enrollment endpoint still authenticates and checks tenant eligibility, then returns 410 without provider/service-role secrets or outbound enrollment; historical webhook/signature code is unchanged. A failed new quote clears selected old instructions while retaining historical requests.

## Known validation at checkpoint

- Ledger typecheck and production build pass.
- 141 Ledger/security unit cases pass, including fresh-auth/tenant retirement denials and stale-instruction handling.
- Maintained billing browser suite: 30 pass, covering EN/AR, themes/viewports, annual quote identity, private evidence UI, missing instructions, billing-viewer denial and zero online-checkout calls.
- Deno 2.5.6 is available; actual Deno SDK/type checking is pending, not claimed passed.
- Legacy pricing/trial test adaptations are saved but have not been separately qualified. Full combined follow-up CI remains pending.

## Exact remaining input and holds

No verified live beneficiary is available in source. Existing examples are placeholders/synthetic aliases, not authority to receive money. Parent will supply the verified public InstaPay recipient name/address and approved public instructions (link/QR only if used). Never infer or seed a recipient. Missing configuration fails closed. No hosted beneficiary, operator role, credential, security setting, acknowledgment or release-history mutation has been performed.

SAS staging catalog baseline read for lwecnmsosfwovlzxauml was denied. Parent owns the minimum requested evidence; do not retry or work around that denial. Production/catalog publication remains held. Do not promote broad PR408. Existing isolated-main snapshot is an unpublished historical review artifact and does not include this cutover.

## Integration state

Ledger PR439 merged as 81cdcc608519f538a2dec85c3d6d6c2bd4e4687d at 2026-10-29 16:09:22 UTC. Its tree dd3ac6e33af3167509c66fa1a602cb2d9642fd3f equals tested candidate 632b74fb64e001e8008e1667728c8e588ce8a8e3. Candidate full CI40905092028 passed; protected staging CI40908763093 review/full verify passed. Ledger/Shop/SAS target provider checks and three staging frontend deployments succeeded. Homepage and /login return200; seven logo assets match source. Two other unmapped preview projects reported a free-project quota; no project/plan changes were made.

This worktree branches from local security reconciliation 50d0ca37e20af745bbda5f642bb28000fd6dad2f. Security PR514's remote head remains20a686c11700b16bd1cd622f9456c308b1bacef6; the local merge and this checkout work are not pushed. Doctor owns the next coordinated validation/staging slot. Do not push or enqueue a competing full validation without coordinating order.

## Resume

1. Verify the recovery archive/hash and restore the pinned base/branch if needed; preserve original worktrees.
2. Complete Deno checking and focused billing/security validation; assess any native legacy test adaptation without dropping historical webhook assertions.
3. Finish curated release fragments/net-change evidence and factual deployment documentation before publication.
4. Obtain the parent's authoritative public instructions; verify the existing operator/configuration through authorized interfaces only.
5. Publish a coherent same-stack follow-up after Doctor queue coordination; retain security and checkout histories and perform fresh combined checks.
6. Integrate to staging, verify exact provider/frontend/CI outcomes, then revisit only an authorized isolated Ledger production path after baseline gates clear. Marketing follows verified release.
