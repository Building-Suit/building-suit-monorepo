# Capability and database audit

Reviewed 2026-09-18. “Present” means a structure or source implementation exists;
it does not mean the workflow has passed an end-to-end test.
This page records the initial audit. [Task 03](03-read-isolation.md) supersedes its
table-policy, grant, reporting-view and period-trigger findings; the app workflows
below remain unverified.
[Task 04a](04-client-only-shell.md) supersedes the API-layer and pricing-source
findings: the custom module/routes were removed and pricing now uses Supabase
Client. The remaining shop pages still have old table/RPC contracts.
[Task 04b](04b-shop-selection-and-schema-error.md) supersedes the shop-selection
row: it now reads the hosted profile/membership/shop model, with live client
verification pending Data API exposure.
[Task 08a](08a-product-catalog.md), [Task 08b](08b-service-catalog.md) and
[Task 09a](09a-manual-inventory.md) supersede the product, service and manual
inventory rows below. They are preserved as the initial audit.
[Task 11a](11a-expense-ledger.md) supersedes the expense row.

## The three contracts currently disagree

1. Local migrations define the older `public` model: `shop_members`, shop-scoped
   subscriptions/modules, combined customer/vendor invoices, `inventory`, and
   `store_entries`.
2. The app mostly assumes that older model and calls `dashboard_metrics`,
   `shop_access_state`, `setup_shop_for_new_user`, and catalog/stock/expense RPCs.
3. The configured cloud contains the newer **`shop_crm`** model: profile-based
   memberships/subscriptions, role permissions, separate sales and purchase
   documents, stock batches/movements, payments, and expense categories.

Task 02 configured the Supabase client to select `shop_crm`, but that alone
does not repair the renamed tables, columns, and missing RPC contracts. None of
the five local migration versions appears in the inspected cloud migration list.
Do not apply the old migration chain blindly to the shared project's `public`
schema: it already contains Building Suit profiles, portals, payments, and expenses.

## App capability inventory

| Area | Source implementation | Current limitation |
|---|---|---|
| Landing and pricing | Arabic/English landing, pricing cards | Pricing still uses `usePlans` → API-layer → `/api/billing/plans`; violates target architecture |
| Sign up/sign in/recovery | Pages call Supabase Auth directly | Cloud profile creation and shop onboarding contract not aligned or verified |
| Shop selection | Membership lookup, selected-shop cookie, cached state | Queries old `shop_members` and old shop columns |
| Dashboard/onboarding | Metrics, recent invoices, create-shop form | RPCs expected by app are absent from the inspected cloud public function list |
| Products and services | List, search, create/edit/archive forms | Local mutation RPCs exist; cloud shape and functions differ |
| Inventory | Stock/movement UI, positive/negative adjustments, cost write-off option | Local FIFO-aware adjustment implementation has no matching deployed contract |
| Expenses/other income | List, totals, create, owner edit/archive | App uses old `store_entries`; cloud has expenses/categories and payments |
| Invoices | Recent invoice display only | No invoice management page in current source tree |
| Employees | Membership selection exists | No team page, invitation acceptance, or role-management UI |
| Reports | Dashboard source plus cloud reporting views | No reports page/export workflow |
| Navigation | Dashboard active | `plannedNav` still marks products, inventory, expenses, invoices, team, reports as Soon; services omitted |
| Build/test readiness | Nuxt/Vue/pnpm workspace | Typecheck fails; application test script absent |

Existing README statements that navigation is activated and no API layer is used
are inconsistent with the inspected source. Files under `PATCHES/` are instructions,
not evidence that their suggested changes have been applied.

## Cloud schema capabilities

The 24 base tables model the following domains:

| Domain | Tables | Potential behavior |
|---|---|---|
| Identity/tenant | `portals`, `profiles`, `shops`, `shop_memberships` | Portal identity, shops, membership statuses |
| Employee authorization | `roles`, `permissions`, `membership_roles`, `role_permissions` | Shop roles and granular permission assignments |
| Commercial access | `plans`, `subscriptions` | Public/preview pricing, JSON features, profile subscription and trial timestamps |
| Catalog | `products`, `services` | Product SKU/barcode, services with prices/discount defaults and active status |
| Counterparties | `clients`, `vendors` | Customer/supplier contact records |
| Sales | `invoices`, `invoice_items` | Draft/issued documents, customer snapshots, employee assignment, line prices |
| Purchasing | `vendor_invoices`, `vendor_invoice_items` | Supplier documents and stock acquisition costs |
| Stock | `inventory_batches`, `inventory_movements` | FIFO batches, remaining quantity, immutable movement history |
| Cash | `payments` | Customer/vendor payments, direction, method, status, references |
| Expenses | `expense_categories`, `expenses` | Categorized business expenses |
| Period controls | `accounting_periods` | Open/closed date ranges |

There are 25 reporting views: cash flow by day/month, customer/vendor/invoice
balances, COGS, gross margin, net profit, product profitability, inventory aging,
dead stock, and turnover, plus supporting aggregations. Their definitions are
captured in `cloud-shop-views.json`; their presence is not proof of correct totals.

The cloud product table has no `price`, `stock`, or `low_stock_threshold` columns
expected by the app. Services use `base_sale_price` and discount type/value.
Subscriptions attach to a **profile**, not directly to a shop. These differences
require an explicit contract decision before frontend repairs.

## Release blockers found in cloud metadata

These were Task 01 source/metadata observations before Task 03 hardening.
Exploitability through the Data API also depended on schema exposure and
privileges; browser access was not tested at the time.

| Priority | Finding | Required repair/verification |
|---|---|---|
| P0 | Public shop helpers explicitly reference absent `public.shop_memberships`, `public.plans`, `public.inventory_batches`, etc. | Repair schema-qualified references and verify authenticated calls |
| P0 | `issue_invoice_and_deduct_inventory` contains `where invoice_id - _invoice_id` | Correct predicate and test atomic issue/stock deduction with rollback |
| P0 | All 25 views lack `security_invoker` options and have SELECT grants for anon/authenticated | Audit view owners, schema access and tenant isolation before exposure |
| P0 | `accounting_periods` has RLS disabled and broad anon/authenticated grants | Apply tenant policies and least-privilege grants |
| P0 | `subscriptions_update_owner` permits updates to a user's subscription row | Prevent users changing their own plan, status, trial or paid-through date |
| P0 | `role_permissions_*_owner_only` predicates do not actually require owner role | Enforce owner authority and active membership; test employee escalation denial |
| P0 | Membership policies query the same membership table recursively | Eliminate recursive policy evaluation and test member/owner reads |
| P1 | Subscription helpers inspect status but do not check trial/period expiry | Database-authoritative time-based write gating |
| P1 | Several SELECT policies require an active subscription | Preserve permission-appropriate history reads after expiry |
| P1 | Membership/permission helpers omit active-status checks | Deny suspended/removed members and inactive profiles |
| P1 | Permissive `expenses_manage`/`expense_categories_manage` ALL policies use membership-only USING | Separate read/write policies; verify view-only employees cannot delete |
| P1 | Item write policies rely on visibility of the parent invoice | Require edit permission and draft state; protect issued document items |
| P1 | Many foreign keys reference IDs without same-shop composite constraints | Reject cross-shop product, role, payment, category and actor references |
| P1 | Broad table grants include TRUNCATE for anon/authenticated | Revoke inappropriate privileges; RLS does not secure every table-level operation |

The security advisor additionally reported 27 mutable function search paths,
11 anonymous-callable and 11 authenticated-callable security-definer function
warnings, and disabled leaked-password protection across the **shared project**.
Those counts include Building Suit functions; do not modify unrelated application
functions as part of Shop Suit fixes. References:
[search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable),
[anonymous function execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

## Review limits

No customer rows were read, no data was changed, and no cloud migration was applied.
Schema exposure, view owners, plan row values, indexes, auth settings, application
network behavior, and concurrency still need focused verification. Metadata
snapshots include columns, RLS policies, constraints, grants, triggers, and selected
function/view definitions; they do not replace a restorable schema baseline.

This review-limit paragraph applies to the initial audit. Task 03 subsequently
applied cloud migrations and verified view options, RLS and grants. The snapshots
above remain pre-hardening evidence, not a description of the live security state.
