# Forward migration plan

1. Inspect effective migration history and precision inventory. Hosted history is blocked; local complete-chain replay is required.
2. Create new migration with the pinned Shop CLI. Do not edit applied history. Add a sealed read-only registry with explicit grants/RLS and private exact conversion helper. Add product defaults preserving legacy quantities and service declarations.
3. Add configuration and quantity-resolution RPCs using existing products.manage/POS permissions and subscription checks, tenant ownership, product locking, safe empty search path and audit history. No direct browser writes. Reject used-product unit changes and block unintegrated measured operational writes.
4. Generate database types from the disposable schema. Extend hand-maintained RPC adapters with decimal-string outputs. Run exact conversion and role/tenant tests.
5. M2: review every quantity column, dependency, local variable, constraint, view, report and snapshot. Widen dependent quantities together, preserve money scales, recreate dependent views with identical grants/RLS. Extend entered/base quantity snapshots and replay hashes before enabling measured writes.
6. Integrate purchase, canonical stock/FIFO, POS, counts, adjustments, thresholds, returns, CSV, tax/ETA, offline and public website. Test old APIs and historical receipts. Package definitions follow this foundation.
7. Apply only via the existing reviewed provider/Git workflow after exact environment/ref/history checks. No hosted trial/reset or second deployer. Record applied version and smoke evidence separately.

Recovery: fail the migration transaction on violated invariants; preserve old source and all history. Before operational activation an additive migration can disable configuration while retaining metadata. After measured postings, rollback requires forward repair preserving snapshots/valuation; never revert the schema to two-decimal storage or relabel posted quantities.
