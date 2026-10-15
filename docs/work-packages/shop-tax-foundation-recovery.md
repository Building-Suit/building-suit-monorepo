# Shop tax foundation recovery

Status: in progress. Recovery owner starts from stg `4c1ac6cc9652e3fedfc3e9a7368962baeb7c7290`.
Branch: `codex/shop-suit/tax-foundation-recovery`. No existing published Shop tax PR/branch found during live preflight on 2026-10-15.
The inaccessible tax-calculation workspace was uncommitted. No files are represented as recovered.

Scope: opt-in versioned/effective product and service tax settings; ordinary VAT, zero-rated, exempt and non-taxable treatments; inclusive/exclusive prices; immutable decimal calculation components, discounts and refund bases; immutable pre-tax commission integration; manager and location authorization; shared UI/UX with Arabic/English adapters.
Calculation disabled is not legal exemption. No default universal rate. Unsupported ETA tax treatments fail explicitly.
Preserve existing currencies, historical receipts and applied migrations (including 20261014181109). No backfill. No XPay/subscription changes.
ETA connectivity/merchant profiles and partial-return workflows are subsequent tasks. No compliance claim.

Sources:
- https://sdk.invoicing.eta.gov.eg/codes/tax-types/
- https://sdk.invoicing.eta.gov.eg/main-calculations/
- https://sdk.invoicing.eta.gov.eg/documents/receipt-v1-2/

Verification pending implementation. Parent owns staging merge; hosted database changes only through existing integration/CI. Original failed workspaces remain untouched.
