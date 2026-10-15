# Shop partial returns and refunds

Status: implementation in progress. Parent: [ETA PR #316](https://github.com/Building-Suit/building-suit-monorepo/pull/316), committed base `6f7180db641668ebf3ef2c987d2c5b1c1aaa51a8`. Verified staging: `4b4c3ca5ffed96e7d61f6eb5a60d04a52862aa0c`. No parent working files were copied. No staging/main merge is owned here.

Building Suit chooses debt-first returns on the original invoice: debt reduction = min(return value, current due); refund due = max(return value - current due, 0); new due = max(current due - return value, 0). A 100 sale with 40 paid and 60 due, returned value 80, has zero due and a 20 refund obligation. This is our product policy, not a universal market rule.

The implementation will append original-document-linked return records, cumulative original-snapshot line deltas, original FIFO disposition allocations, and original-payment refund reservations. Noncash completion records external evidence only; cash completion explicitly records handover on the current cash day. Reservations remain bounded while pending, failed or completed. No provider transfer is implemented or implied, and no XPay subscription integration is involved.

Deterministic proposed refund allocation: original invoice receipt allocations in payment paid-at then payment-id then allocation-id order, taking no more than remaining capacity at each step. The entire plan is shown before confirmation and verified again inside the atomic command.

No wallet credits, exchanges, unlinked payouts, goodwill, no-receipt returns, restocking fees or currency changes. Unsupported original snapshots/FIFO lineage fail explicitly. Service refunds do not restore consumed materials. Offline return/refund writes require connection; reconciliation refreshes stable request IDs rather than reporting local success.

Research reverified 2026-10-15: [Square refund API](https://developer.squareup.com/reference/square/refunds-api/refund-payment) distinguishes recording cash/external refunds and refunding card payments, requires idempotency and bounds payment refunds. [Shopify refund guidance](https://help.shopify.com/en/manual/fulfillment/managing-orders/refunding-orders) supports partial item quantities, independent restocking and original payment refunds. These sources inform the design; debt-first allocation and reservation rules above are Building Suit decisions.

Environment limits: requested `.agents/skills` and frontend skill were not present in the saved workspace; repository shared UI rules are available. Existing staging Vercel rate-limit failures are separate from successful GitHub verification. No prohibited network or hosted database access performed.
