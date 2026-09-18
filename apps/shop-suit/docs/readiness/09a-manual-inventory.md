# Task 09a — Manual stock receipts and write-offs

Completed 2026-09-18 against hosted project `jkdncdexqcymwbihwdhp`, schema
`shop_crm`. The old Inventory page relied on missing `shop_modules` and
`adjust_shop_stock` calls. It now lists product quantities and lets a Pro owner
receive stock or write it off. The Inventory sidebar link is enabled.

## Data and access rules

- A `security_invoker` `product_stock` view totals remaining batch quantities;
  its read still follows product and batch RLS. The browser gets SELECT on this
  view, not direct write access to batches or movements.
- `shop_crm.adjust_stock` is an authenticated, `SECURITY INVOKER` wrapper around
  a checked private function. It requires an active membership and an unexpired
  trial or paid period. The owner plan must have `features.inventory = true`;
  the current Pro plan does and Basic does not.
- Every request has a UUID. A repeated request with the same inputs returns
  without adding stock twice; a reused UUID with different inputs fails. The
  browser retains that UUID while retrying an uncertain response.
- Receipts create a positive batch and movement with a unit cost. Write-offs
  require a reason, consume oldest batches first under a product lock, and
  record cost snapshots on the negative movements. Insufficient stock aborts
  the entire transaction; the balance cannot go negative through this path.
- The internal `stock_adjustment_requests` table has RLS, no policies and no
  browser table grants. Supabase's advisor reports one `rls_enabled_no_policy`
  notice for this intentional private table; it has no Data API read or write
  grant for `anon` or `authenticated`.

SQL: [`20260918190537_shop_inventory_adjustments.sql`](../../supabase/shop_crm_migrations/20260918190537_shop_inventory_adjustments.sql),
hosted migration version `20260918190816`.

## Verification and review

The rollback-only [inventory fixture](../../supabase/tests/shop_crm_inventory_adjustments.sql)
passed against the hosted project: receipt replay did not double stock, FIFO
write-off consumed the right batches, an overdraw failed, Basic and an outsider
could not adjust stock, and direct browser writes remained revoked. All fixture
users, batches, movements and requests rolled back. Anonymous Data API invocation
of `adjust_stock` returned HTTP 401 (`42501`). The Nuxt production build passed,
and the new Inventory page has no typecheck diagnostics; seven diagnostics remain
in old Services and Expenses pages.

To review locally, refresh the app and open **Inventory**. Add a product first
if the list is empty, receive stock with a unit cost, then write off part of it
with a reason. The quantity should update. Basic can see the page but cannot
write stock. The authenticated browser journey has not been independently
observed by this task; the database fixture and build are its verification.

Supplier invoices, automatic sale deductions, payment balances and reporting
are still pending. Manual stock adjustments alone are not a complete purchase
or sale workflow.
