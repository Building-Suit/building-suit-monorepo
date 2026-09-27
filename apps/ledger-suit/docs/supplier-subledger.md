# Supplier accrual subledger — V2-IMP-009

Status: implemented locally for review on 2026-09-25. Not deployed, not hosted-verified, and not accountant-accepted.

## Approved policy and boundary

The control-plane task supplied approved V2-D06: recognize a payable when a supplier bill is issued/approved; post the approved expense or asset exactly once; allow many-to-many payment allocation; require every payment to be fully allocated; reject overpayments above the authoritative dated outstanding balance; keep supplier credits/corrections as linked immutable records; and make reversals append-only. This supersedes the baseline's earlier pending D06 entry. Multi-currency AP remains excluded unless V2-D13 is separately approved.

This is an accounting-obligation subledger, not procurement, purchase orders, goods receipt, inventory receiving, or supplier management. Counterparties use the existing `vendor` role. The UI calls them suppliers.

| Operation | Accounting and allocation behavior |
|---|---|
| Bill / obligation | Dr selected Expense or Asset / Cr selected AP Control. Supplier, issue date, due date, original amount, reference and journal link are immutable. References are unique per supplier, including reversed bills; a replacement uses a new reference. |
| Payment | Dr AP Control / Cr Cash, Bank or Mobile Wallet. Allocate its entire amount across bills for the same supplier and Control. No second expense/asset recognition, unallocated payment, or overpayment. |
| Supplier credit | Dr AP Control / Cr the Expense or Asset originally recognized by every allocated bill. Full allocation and reason are required. |
| Correction | Same linked account and allocation rule as a supplier credit, additionally requiring `ap.adjust`, `transactions.adjust`, a reason, and the existing adjustment-approval policy. It never edits the bill. |
| Reversal | The shared journal reversal mirrors the original entries. A new AP document and opposite allocations link their originals. Nothing is deleted. Settlements must be reversed before a bill when otherwise they would leave a negative dated balance. |

Commands use the shared posting engine and existing membership, subscription, quota and accounting-period controls. `ap.issue`, `ap.receive`, `ap.credit`, and `ap.reverse` default to owner/admin/accountant; `ap.adjust` defaults to owner/admin; `ap.read` additionally defaults to viewer. Custom roles require explicit grants.

A tenant advisory lock serializes AP commands before payload-bound idempotency checks. Allocation validation examines every affected effective date, so a backdated payment cannot consume an amount already allocated later. Normal AP corrections do not bypass a Soft or Hard Closed period.

`ap_documents` and `ap_allocations` use tenant-composite foreign keys, read RLS, no authenticated direct writes, immutable-history triggers, and decimal-string JSON transport for all monetary values. Generic journal reversal cannot enter the trusted Control context; clients use the AP reversal RPC.

## Reports and legacy treatment

Supplier statement: **opening + bills + signed adjustments − payments = closing**. Credits/corrections are negative adjustments; reversal documents are signed according to their accounting effect and link to the original. The effective accounting date determines inclusion.

Aging uses the outstanding amount at the selected report date. Due today or later is `current`; overdue calendar days are assigned exactly once to `1–30`, `31–60`, `61–90`, or `91+`. Original due dates are immutable. These implementation bucket defaults have not been independently accountant-approved.

The Control provider now supports both customer and supplier bindings. Supplier reconciliation includes all suppliers per AP Control independently of the page filter. Exceptional generic Control adjustments remain outside AP and therefore create visible variances; no balancing plug or automatic explanation is inserted.

Legacy payable commitments keep their existing cash-basis settlement behavior. `preview_legacy_ap` exposes original, cash-settled and remaining amounts and the former linked account for reviewed handling. Every row is explicitly excluded from accrual AP. There is no inferred Control mapping, history rewrite, automatic link, or conversion endpoint.

## Files and verification contract

- Migration `20260925143000_accrual_supplier_subledger.sql`: documents, allocations, permissions, posting/read RPCs, dual AR/AP Control provider, workspace response, and read-only legacy preview.
- UI: `app/pages/payables.vue`, `app/composables/useSupplierSubledger.ts`, `app/utils/supplierSubledger.ts`, navigation and EN/AR copy.
- `types/ap-rpc.types.ts` is the focused generated PostgreSQL function contract. Regenerate from an explicitly verified disposable local connection using `scripts/ap-contract-catalog.sql` and `scripts/generate-ap-contracts.mjs`.
- `supabase/tests/42_supplier_subledger_test.sql`: rolled-back lifecycle, exact expense/asset and Control balances, allocation/reversal history, dates, aging, permissions, isolation, idempotency, period/subscription denial, bigint transport, legacy exclusion and journal balance checks.
- `scripts/test-supplier-subledger-concurrency.mjs`: guarded independent-session bill/payment retry and overlapping-allocation races. It requires `LEDGER_AP_DISPOSABLE_TEST=1`, project `ledger-ap-009-disposable`, exact migration parity, and the isolated `.local/verification/supplier-subledger` workdir. It never resets or deletes evidence.
- `playwright.ap.config.ts` and `tests/e2e/supplier-subledger-ui.spec.ts`: synthetic EN/LTR and AR/RTL page coverage. Backend authorization and accounting remain SQL responsibilities.

## Acceptance traceability

| Requirement | Implemented evidence | Remaining verification |
|---|---|---|
| AP-01/02/09 | Explicit AP Control binding; immutable issue/due/reference/amount; one Dr Expense/Asset / Cr AP journal; payment only Dr AP / Cr Cash | Native disposable SQL and accountant review of representative bills/payments |
| AP-03/04/05 | Many-to-many full allocations, exact partial/full settlement, rejection of unallocated/overpayments, linked credit/correction, append-only reversal | Native multi-session concurrency and live Supabase caller verification |
| AP-06/07 | Dated statement roll-forward and exclusive due-date aging buckets | Browser execution and accountant review |
| AP-08, COA-09 | Independent supplier event total compared with the credit-normal AP Control ledger balance by date; visible variance | Native Control regression and accountant variance review |
| VAL-04 supplier scope | Focused SQL, exact-money unit, UI and concurrency fixtures | Native SQL/concurrency/browser runs and accountant UAT |

No migration was applied to a hosted or local database during implementation. Recovery is a separately authorized feature/permission gate plus linked reversals and corrected documents; posted history must never be deleted.
