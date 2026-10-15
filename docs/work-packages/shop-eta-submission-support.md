# Shop ETA submission support

Status: in progress. Parent owns staging integration; no hosted writes or live activation.

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
