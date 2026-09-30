# SS-EXP-002 — Expense history and delegated workflow

Implemented as a forward-only Shop migration and a location-aware Expenses page.
Operational income remains excluded from V1 under EXP-D01/EXP-D02; no income
category, sales-revenue duplication, broader accounting model, or Ledger Suit runtime
dependency was introduced.

## Implemented contract

- `public.list_expenses` authorizes `expenses.view`, enforces the caller's location
  access, and applies search, status, category, date, page, and bounded page-size
  parameters before returning rows and a total.
- `public.save_expense` requires a request UUID and the selected accessible
  location. A create retry returns its existing row. A correction creates a new
  paid replacement, voids and links the original, retains both amounts and dates,
  and requires a reason. Reusing a request UUID with different data fails.
- `public.void_expense` requires a request UUID and reason, retains the expense,
  and records who voided it and when. Exact retries create no duplicate event.
- `public.expense_events` is append-only mutation evidence. Expense rows reject
  deletion and reject financial-field updates; only the supported paid-to-void
  transition is allowed.
- All writes retain active-membership, active-subscription, granular
  `expenses.manage`, accessible-location, and open-period checks. Manager-role
  fixture coverage proves the workflow does not depend on owner status.

## UI behavior

The bilingual page uses `BsDataTable` lazy pagination with server search and
status/category/date filters. It shows original, corrected, replacement, and
voided history; corrections and voids collect explicit reasons in shared dialogs.
Create/correct/void retry UUIDs survive failed attempts and reset when their
payload changes.

## Local verification

The focused SQL suite covers full-history pagination, combined filters,
delegated manager create/read, outsider denial, create/correction/void replay,
request conflicts, closed-period denial, lineage, append-only events, and
expense deletion denial. Static unit coverage binds the UI, RPC declarations,
migration invariants, and decision boundary.
