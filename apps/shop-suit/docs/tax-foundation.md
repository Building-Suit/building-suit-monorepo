# Shop tax calculation foundation

Tax calculation, merchant identity/registration and ETA connectivity are distinct capabilities. Calculation is optional and disabled by default. Disabled calculation is not an exemption. No universal rate is supplied; authorized owners/system managers with `settings.manage` choose classifications and rates. This feature does not establish tax compliance.

`/taxes` saves append-only settings versions with actor, request, reason, creation time and effective time. The latest effective version wins at server finalization time, ordered by effective time, creation time and id. Backdated settings never reprice finalized sales. Default classifications can be overridden for individual products/services. Version history is bounded to the latest 100 versions in the editor.

Supported ordinary VAT classifications are VAT, zero-rated, exempt and non-taxable; prices may include or exclude VAT. The selected T1 subtype must agree with the treatment. Table tax, withholding and compound calculations are rejected, never approximated. No ETA submission is performed. Non-EGP operational sales retain their currency; any future EGP-only export restriction belongs in the ETA adapter.

The database owns arithmetic with Postgres decimal `numeric`. Original quantity/unit prices, original line discounts, allocated order discount shares and pre-tax/tax/payable components are stored in immutable `sale_tax_snapshots`. Components retain five decimals. Operational money retains the existing two-decimal Shop contract: each line's payable and tax are rounded, net is their difference, and document money is the sum of its lines. `moneyRounding5` explicitly records the difference from five-decimal components. Order discounts allocate proportionally after original line discounts using stable line order and cumulative five-decimal shares, conserving the original order discount exactly. Tax settings never overwrite original line prices/discount snapshots.

The sale detail page can set an order discount while draft and shows the tax breakdown. New issuance snapshots retain that allocation and currency. Disabled/unconfigured shops without order discounts keep their existing issuance arithmetic and produce no invented historical tax snapshots. Existing receipt rows are never rewritten; new receipt issue snapshots include the tax snapshot and show tax on print/share.

`shop_private.tax_return_components` calculates deltas between cumulative returned quantities against the original frozen amounts. Full quantity returns recover every original minor unit even when earlier partial deltas rounded differently. This is an internal foundation for a separate authorized returns workflow, not a new refund API.

Forward commission integration reads each frozen tax line's `net` value. Only legacy/no-tax sales fall back to the existing finalized line amount. Applied commission migration `20261014181109` is unchanged. Full payment and fulfillment, cancelled/corrected-sale exclusions, immutable earning events and cumulative reversals retain their existing contracts.

Offline checkout retains the existing local total only after a server quote has confirmed calculation disabled for that cached counter scope. Enabled or unknown tax configuration requires reconnection; stale queued amounts remain subject to existing server rejection/reconciliation rather than bypassing tax validation.

New tax tables use RLS with no direct browser grants. Public commands enforce existing subscription/tenant permissions; settings additionally require owner/system manager identity, and sale reads/writes enforce location authorization. Finalization is atomic with tax snapshots, existing stock and payment operations.

Sources reviewed on 2026-10-15:
- https://sdk.invoicing.eta.gov.eg/codes/tax-types/
- https://sdk.invoicing.eta.gov.eg/main-calculations/
- https://sdk.invoicing.eta.gov.eg/documents/receipt-v1-2/

Verification: `tooling/database/test-shop-tax-local.mjs` runs calculation/issuance fixtures plus existing receipt and commission suites in a disposable backend. GitHub workflow `shop-taxes-disposable.yml` runs the full migration history and exports generated public types. See the recovery task record for actual results and remaining limits.
