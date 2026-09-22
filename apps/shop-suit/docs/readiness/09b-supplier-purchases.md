# Task 09b — Supplier purchases

Completed 2026-09-19 against the dedicated Shop staging project
`jvvelvftpfnlogalgxgv`, schema `public`. Hosted migration version:
`20260919091222` (`supplier_purchases`). No production database or frontend
deployment was changed.

## What works

- Pro owners can create a same-shop supplier and select it when recording a
  purchase with one or more existing active products.
- `public.create_supplier_purchase` accepts a browser-generated request UUID,
  validates the caller and tenant, checks the active subscription and Pro
  inventory entitlement, rejects closed periods and cross-shop references, and
  calculates every line total and document total in Postgres.
- Posting is one transaction: it creates the purchase header and items, FIFO
  inventory batches and matching positive inventory movements, then marks the
  document posted. A retry with the same UUID and normalized payload returns the
  first purchase without duplicating stock; a changed payload fails.
- Posted headers and items are immutable. `public.void_supplier_purchase`
  preserves the document, records negative reversal movements and zeroes its
  acquisition batches only while none of that stock has been consumed. A used
  batch fails closed instead of corrupting FIFO history.
- Browser table writes remain revoked. The supported public wrappers are
  `SECURITY INVOKER`, have an empty search path, and are executable only by
  `authenticated`. Privileged bodies remain in the unexposed `shop_private`
  schema. The unsafe historical `post_vendor_invoice_and_create_batches` helper
  is no longer executable by `anon`, `authenticated` or `service_role`.
- The `/purchases` page uses `BsDialog`, the shared record-action and
  confirmation controllers, and `BsDataTable`. It has English/Arabic copy,
  direction/theme-compatible styles, responsive forms, loading/empty/error/
  success/permission/plan states and enabled desktop/mobile navigation.

Supplier payments, purchase returns and purchase reports are not implemented or
claimed by this task.

## Database changes

Migration:
[`20260919091222_supplier_purchases.sql`](../../supabase/migrations/20260919091222_supplier_purchases.sql)

- `public.vendor_invoices`: nullable `request_id` and canonical
  `request_payload`, with a unique per-shop request index.
- `public.vendor_invoice_items`: positive quantity, nonnegative unit/line cost
  checks and one line per product per purchase.
- `public.inventory_batches`: nonnegative unit-cost check.
- New private functions: `assert_purchase_entitlement`, `create_vendor`,
  `create_supplier_purchase`, `void_supplier_purchase`.
- New public RPCs: `create_vendor`, `create_supplier_purchase`,
  `void_supplier_purchase`.
- Purchase header/item immutability triggers and tightened grants.

Acquisition unit costs follow the existing FIFO/reporting contract of two
decimal places. Quantity accepts up to three decimal places. EGP line and
document totals are rounded to two decimals in Postgres.

## Hosted verification

The rollback-only
[`shop_crm_supplier_purchases.sql`](../../supabase/tests/shop_crm_supplier_purchases.sql)
passed after deployment on Staging. It covered:

- authorized supplier and multi-product purchase creation/posting;
- exact Postgres document/line totals, FIFO quantities/unit costs and movements;
- identical retry idempotency and conflicting-request rejection;
- no duplicate invoice, batch or movement on retry;
- cross-shop supplier, product and document denial;
- expired-trial, Basic/missing-entitlement and closed-period denial;
- posted header/item immutability;
- void idempotency and inventory reversal;
- anonymous RPC denial and absence of broad authenticated table writes.

The fixture ended in `ROLLBACK`; follow-up queries found zero Task 09b fixture
users and shops. The hosted migration ledger contains `20260919091222`.

Remote security advisors passed with zero warnings/errors. The only information
notice is the pre-existing intentional no-policy RLS boundary on
`public.stock_adjustment_requests`. Remote schema lint still fails on the
pre-existing, revoked legacy `public.issue_invoice_and_deduct_inventory`
expression `invoice_id - _invoice_id`; the new supplier functions did not add a
lint issue and do not call that helper.

Application verification at this checkpoint:

- Shop typecheck: passed.
- Shop lint: passed.
- Shop production build: passed with staging runtime configuration.
- Workspace boundary/token checks, 20 repository tests and `git diff --check`:
  passed.
- Local built-server route probe: `/purchases` returned HTTP 302 to
  `/auth/login`; following the redirect returned HTTP 200. `/` returned HTTP 200.
- Authenticated owner browser journey: not run. No reusable staging credentials
  were available in this worktree, and custom SMTP is still unconfigured for a
  fresh review account. Database authorization and behavior were verified by the
  hosted rollback fixture, not claimed as an observed browser journey.

## Review the workflow

1. Start the Shop app with its ignored staging runtime variables, without
   committing or printing them, and sign in as a Pro staging owner.
2. Open **Products** and ensure at least one active product exists.
3. Open **Purchases**, choose **Add supplier**, save a supplier, then choose
   **Record purchase**.
4. Add one or more distinct products with positive quantities and nonnegative
   two-decimal unit costs, then post the purchase.
5. Confirm the posted total and lines in **Purchases** and the new on-hand
   quantities in **Inventory**.
6. Void an unused purchase and confirm it remains in history as Void and its
   acquired quantity is removed. A purchase whose acquired batch has been used
   must show the protected-stock error instead.

Next bounded task: sales issuance, FIFO stock deduction, service lines,
payments, reversals and receipts. Complete vendor management, supplier payments,
returns and reports remain later work.
