# Ledger InstaPay cutover — recovery checkpoint

Status: locally qualified application checkout; unpublished, live beneficiary configuration and combined release qualification still pending. Main promotion and general Ledger marketing are held by the user's latest instruction until this cutover is completed and verified.

## Saved scope

Historical Shop manual flow: commit a7bab9d0, migration 20260928200000_manual_instapay_billing.sql. Ledger reuses its existing server-priced immutable manual quotes, private receipt evidence and dedicated audited operator approval. Submission does not activate access. Existing active-period conflicts, membership/capability checks, integer minor units and historical payment records remain.

Applied local edits: primary plan choice opens the existing manual flow; new browser enrollment no longer invokes the online provider; EN/AR customer copy and factual payment-policy text describe InstaPay/manual review; the retired enrollment endpoint still authenticates and checks tenant eligibility, then returns 410 without provider/service-role secrets or outbound enrollment; historical webhook/signature code is unchanged. A failed new quote clears selected old instructions while retaining historical requests.

## Known validation at checkpoint

- Ledger typecheck and production build pass.
- 141 Ledger/security unit cases pass, including fresh-auth/tenant retirement denials and stale-instruction handling.
- Maintained billing browser suite: 30 pass, covering EN/AR, themes/viewports, annual quote identity, private evidence UI, missing instructions, billing-viewer denial and zero online-checkout calls.
- Actual Deno 2.5.6 SDK/type checking passes against the existing npm:@supabase/supabase-js@2 import (resolved2.118.0). The first attempt failed on the managed certificate chain; command-scoped DENO_TLS_CA_STORE=system fixed trust without disabling verification or changing persistent settings.
- Ten existing Deno receipt/legacy HMAC tests pass with no runtime network permission and only two synthetic process-local environment keys. Historical callback, security configuration and SQL migration files are unchanged.
- Exact committed release classification/provenance check passes on744732b2 against staging81cdcc60. Legacy pricing/trial test adaptations are saved but have not been separately qualified. Full combined follow-up CI remains pending.

## Exact remaining input and holds

The user explicitly supplied the approved public IPA `building-suit@instapay` at 2026-10-29 17:00:36, as forwarded by the parent. This new user evidence, rather than any synthetic test alias, authorizes that exact address. The exact bank-displayed recipient name remains pending. Do not infer Building Suit or any personal name, or execute a test transfer. The existing contract requires only one nonempty public instruction block (trimmed length 1–4000); there is no recipient-name field or validation. The confirmed IPA alone is sufficient destination information for valid instructions. A bank-displayed name is optional and must not block implementation or staging. No separate link/QR field is required. Missing configuration fails closed. No hosted beneficiary, operator role, credential, security setting, acknowledgment or release-history mutation has been performed.

SAS staging catalog baseline read for lwecnmsosfwovlzxauml was denied. Parent owns the minimum requested evidence; do not retry or work around that denial. Production/catalog publication remains held. Do not promote broad PR408. Existing isolated-main snapshot is an unpublished historical review artifact and does not include this cutover.

## Integration state

Ledger PR439 merged as 81cdcc608519f538a2dec85c3d6d6c2bd4e4687d at 2026-10-29 16:09:22 UTC. Its tree dd3ac6e33af3167509c66fa1a602cb2d9642fd3f equals tested candidate 632b74fb64e001e8008e1667728c8e588ce8a8e3. Candidate full CI40905092028 passed; protected staging CI40908763093 review/full verify passed. Ledger/Shop/SAS target provider checks and three staging frontend deployments succeeded. Homepage and /login return200; seven logo assets match source. Two other unmapped preview projects reported a free-project quota; no project/plan changes were made.

This worktree branches from local security reconciliation 50d0ca37e20af745bbda5f642bb28000fd6dad2f. Security PR514's remote head remains20a686c11700b16bd1cd622f9456c308b1bacef6; the local merge and this checkout work are not pushed. Doctor owns the next coordinated validation/staging slot. Do not push or enqueue a competing full validation without coordinating order.

## Resume

1. Preserve recovery archive Library ID libfile_386d388123fc8191959e6a8b9003d7ac and checkpoint5ccc0734b94849e7bc4498263f3d301ce1aac130; restore only to a new worktree if needed.
2. Deno, Ledger units/type/build and maintained billing browser qualification pass locally. Native full-service browser rerun remains unperformed; its primary-action selector has been adapted without changing financial assertions. Historical webhook and SQL sources are unchanged.
3. Curated public/internal fragments and semantic release evidence are prepared; validate the committed exact candidate against current staging before publication.
4. Retain the approved IPA exactly and use the prepared IPA-only instruction block below through the authorized configuration/release path. Add a bank-displayed name only if supplied later. Verify existing operator/configuration readiness only through authorized interfaces; this document does not seed hosted configuration.
5. Publish a coherent same-stack follow-up after Doctor queue coordination; retain security and checkout histories and perform fresh combined checks.
6. Integrate to staging, verify exact provider/frontend/CI outcomes, then revisit only an authorized isolated Ledger production path after baseline gates clear. Marketing follows verified release.

## Prepared public instructions

InstaPay: building-suit@instapay. Transfer the exact amount and currency shown in this checkout, then upload your payment receipt for manual review. Your subscription activates only after approval.

Contract evidence: `20260928220000_manual_payment_evidence.sql` defines only `singleton` and `instructions`; `prepare_manual_payment` freezes that text into the authorized server quote. The client renders the quoted text without extracting recipient fields. No additional recipient label is required. This prepared text is not a claim that hosted configuration is installed.
