# Task 11a — Paid expenses

Completed 2026-09-18 against hosted project `jkdncdexqcymwbihwdhp`,
schema `shop_crm`. The former Expenses page used the absent
`store_entries` table and `public` RPCs. It now shows the latest 100
categorized expenses, including voided history, and lets a shop owner create,
edit and void paid expenses. The sidebar Expenses link is enabled.

## Database behavior

- `shop_crm.save_expense` and `shop_crm.void_expense` are authenticated
  invoker wrappers around private checked functions. The checks require active
  membership, `expenses.manage`, and an unexpired owner trial or paid period.
  Direct browser writes to expenses and categories remain revoked.
- A category name is resolved or created inside the same transaction and shop.
  A shop row lock coordinates concurrent category creation, and an active
  same-shop case-insensitive unique index prevents duplicates.
- Create requests carry a UUID. Retrying with identical data returns the same
  expense, while reusing the UUID for different data fails. Paid expenses
  retain their record when voided; the existing cash and profit views exclude
  status `void`.
- Amounts require two-decimal positive values. The selected business date is
  stored at noon UTC so it stays on the chosen calendar date in Cairo. The
  original and replacement dates must be open when editing, and voiding also
  checks the original period. A closed accounting period prevents those writes.

SQL: [`20260918192529_shop_expense_ledger.sql`](../../supabase/shop_crm_migrations/20260918192529_shop_expense_ledger.sql),
hosted migration version `20260918192741`.

## Verification and review

The rollback-only [expense fixture](../../supabase/tests/shop_crm_expense_ledger.sql)
passed in the hosted database: create/read, retry idempotency, conflicting
request rejection, correction, void replay, outsider denial, closed-period
rejection and expired-trial denial. Fixture users and plan were absent after
rollback. Hosted grants confirm no anonymous RPC execution and no direct
authenticated inserts into expenses or categories. Nuxt production build and
typecheck pass. Supabase's only Shop Suit security-advisor notice remains the
intentional no-policy internal stock request table described in
[Task 09a](09a-manual-inventory.md).

Refresh the local app and open **Expenses**. Record an amount, category and
business date, then edit or void it. The authenticated browser journey has not
yet been independently observed. Other income, report totals, exports and
monthly plan activity limits remain separate work; this task does not claim
that an expense appears in a completed dashboard profit report.
