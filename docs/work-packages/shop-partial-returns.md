# Shop partial returns and refunds

Status: implemented; final publication checks are tracked on PR #317. Parent: [ETA PR #316](https://github.com/Building-Suit/building-suit-monorepo/pull/316), committed base `6f7180db641668ebf3ef2c987d2c5b1c1aaa51a8`. Verified staging: `4b4c3ca5ffed96e7d61f6eb5a60d04a52862aa0c`. No parent working files were copied. No staging/main merge is owned here.

Building Suit chooses debt-first returns on the original invoice: debt reduction = min(return value, current due); refund due = max(return value - current due, 0); new due = max(current due - return value, 0). A 100 sale with 40 paid and 60 due, returned value 80, has zero due and a 20 refund obligation. This is our product policy, not a universal market rule.

The implementation appends original-document-linked return records, cumulative original-snapshot line deltas, original FIFO disposition allocations, and original-payment refund reservations. Noncash completion records external evidence only; cash completion explicitly records handover on the current cash day. Reservations remain bounded while pending, failed or completed. No provider transfer is implemented or implied, and no XPay subscription integration is involved.

Deterministic proposed refund allocation: original invoice receipt allocations in payment paid-at then payment-id then allocation-id order, taking no more than remaining capacity at each step. The entire plan is shown before confirmation and verified again inside the atomic command.

No wallet credits, exchanges, unlinked payouts, goodwill, no-receipt returns, restocking fees or currency changes. Unsupported original snapshots/FIFO lineage fail explicitly. Service refunds do not restore consumed materials. Offline return/refund writes require connection; reconciliation refreshes stable request IDs rather than reporting local success.

Research reverified 2026-10-15: [Square refund API](https://developer.squareup.com/reference/square/refunds-api/refund-payment) distinguishes recording cash/external refunds and refunding card payments, requires idempotency and bounds payment refunds. [Shopify refund guidance](https://help.shopify.com/en/manual/fulfillment/managing-orders/refunding-orders) supports partial item quantities, independent restocking and original payment refunds. These sources inform the design; debt-first allocation and reservation rules above are Building Suit decisions.

Environment limits: requested `.agents/skills` and frontend skill were not present in the saved workspace; repository shared UI rules are available. Existing staging Vercel rate-limit failures are separate from successful GitHub verification. No prohibited network or hosted database access performed.

Draft PR: https://github.com/Building-Suit/building-suit-monorepo/pull/317. Stack: `shop-suit`; merge order ETA #316 then returns #317. Parent owns integration/staging merge and final combined verification; no manual-test gate before staging.

Worktree moved intact to `/tmp/returns` within the same saved cloud environment after local Docker image extraction exhausted the workspace disk. `/workspace/returns` is an alias. No existing workspace, Docker resource or user data was removed. Both original workspaces and any interrupted build output remain preserved. Executor access continued working after the disconnect notice.

Detailed product/API contract: `apps/shop-suit/docs/partial-returns.md`. Forward migration: `20261015030016_partial_sale_returns.sql`. New public APIs: `preview_sale_return`, `create_sale_return`, `sale_return_context`, `get_sale_return`, `record_sale_return_refund`. The ETA owner consumes the stable return UUID, original-document reference and immutable tax/discount line components; ETA tax submission remains separately owned.

Actual verification before final publication:
- 398 focused Shop/shared UX unit tests passed, including stale preview invalidation, scope isolation and same-key uncertain replay.
- `pnpm check` and strict Suit template boundaries passed: 83 complete route templates, zero migration debt; 80 historical migrations unchanged.
- All six workspace typechecks passed. Shop and documentation production builds passed. Targeted Shop/shared lint has no errors; the sales-detail attribute ordering was subsequently normalized.
- 30 browser cases passed: 24 existing supplier/sale-detail cases, four new EN/AR light/dark return/refund cases with offline confirmation blocked, and two tax-policy cases. Local screenshots: `.local/returns-evidence/`.
- Disposable SQL run 38675901471 passed full migration application, return/debt/rounding/FIFO/damage/service/commission fixtures, original document preservation, permissions and unsupported-history denial, plus existing tax, receipt, service and commission regressions. Separate simultaneous sessions passed identical/conflicting requests, competing quantities/capacity and exactly-once completion.
- Generated public database types restored from that run’s maintained schema-contract evidence after the artifact blob endpoint returned Forbidden. Verified SHA-256: `764a5c45a11d3b0ae54d423a5c66c4f737473ab2917450dcd91979782669e998`. Source was generated by the disposable database; no manual type fabrication.
- Every applicable GitHub check passed on `e9e3058a` (returns, taxes, commissions, service materials, payments, ETA, media, accounts, review and branch policy). Child `verify` is skipped by maintained stack policy; the parent/root owns combined full CI. Final-head results are authoritative on PR #317.

Remaining external limitation: pre-existing Vercel deployment rate-limit statuses. No deployments, hosted database writes, credentials, main/production promotion, Arch, home network, n8n or Penpot access was performed. Existing integration owns database deployment. No actual payment-provider refund executor is introduced; external completion is evidence recording only. Historical sales without original evidence remain unsupported, and no offline refund success is fabricated.
