# Shop Suit

Current work: [readiness documentation](docs/readiness/README.md), including the
cloud database audit, capability inventory, Ledger Suit plan reference, and ordered
implementation tasks. The 2026-09-18 review found incompatible app/cloud contracts
and failing type checks; Shop Suit is not yet ready for sale.

Development and commits stay local. Supabase stays in the cloud, and application
data access must use the Supabase client without a custom API/backend.

The batch notes below are historical. Their application, navigation, and validation
claims have not been verified against the current cloud. Follow the readiness
documents before applying any database commands shown below.

# Historical: Shop Suit Rebuild — Batch 05

## Scope

Batch 05 completes two more operational areas.

| Status | Page / file | Path |
|---|---|---|
| **NEW** | Inventory | `apps/shop-crm/app/pages/inventory/index.vue` |
| **NEW** | Expenses & Other Income | `apps/shop-crm/app/pages/expenses/index.vue` |
| **NEW** | Inventory/store-entry migration | `supabase/migrations/20260912020000_inventory_and_store_entries.sql` |
| **EDIT** | Activate Inventory + Expenses navigation | `apps/shop-crm/app/layouts/default.vue` |

No API-layer code is used.

---

# Inventory

The Inventory page contains:

- current total units
- estimated stock value
- low-stock count
- movement count
- purchase/sale/manual-adjustment filters
- product/SKU search
- full stock movement history
- manual stock increase
- manual stock decrease
- mandatory audit note

## Why stock is not edited directly

The application still never does:

```ts
products.update({ stock: ... })
```

from the browser.

Manual correction calls:

```ts
supabase.rpc('adjust_shop_stock', ...)
```

The RPC:

1. validates auth + shop membership
2. validates `shop_access_state()`
3. validates Inventory module access
4. locks the product row
5. validates the resulting stock cannot be negative
6. inserts an `inventory` movement with `reason = manual_adjustment`
7. updates `products.stock`
8. commits everything atomically

## FIFO-safe manual adjustments

A simple stock adjustment is not enough for Shop Suit because COGS is FIFO-based.

### Positive adjustment

Example:

```text
Found 3 units during a physical count
Unit cost: 4 EGP
```

creates:

```text
inventory
quantity_change = +3
reason = manual_adjustment
vendor_price = 4
```

That row becomes a new FIFO cost batch.

### Negative adjustment

Example:

```text
2 units damaged
```

creates:

```text
inventory
quantity_change = -2
reason = manual_adjustment
```

and the migration allocates those two units against the oldest available cost batches.

For negative adjustments the drawer also includes:

```text
Record the write-off cost as an expense
```

It defaults **on** for damage/shrinkage. When enabled, the FIFO cost consumed by the
adjustment is inserted atomically into `store_entries` as:

```text
kind = expense
category = inventory_adjustment
```

Turn it off for opening-balance or data-correction adjustments that should not hit current-period
profit.

The new table:

```text
inventory_adjustment_cogs
```

stores those allocations.

The existing `allocate_fifo_for_item()` is upgraded so future sales calculate batch availability as:

```text
positive batch quantity
- quantities already sold
- quantities consumed by negative manual adjustments
```

This prevents written-off inventory from being sold again inside the FIFO cost calculation.

---

# Expenses & Other Income

This page uses the existing `store_entries` domain.

It displays:

- total expenses
- total non-invoice income
- net of store entries
- entry count
- type filtering
- category/note search
- employee attribution
- create
- owner edit
- owner archive

The existing permission model is preserved:

```text
Shop member:
  read entries
  create expense/income

Shop owner:
  everything above
  edit existing entry
  archive existing entry
```

Archive is a soft delete through `deleted_at`.

The dashboard already excludes archived rows and includes active store entries in:

```text
net_profit =
gross profit
- expenses
+ other income
```

## Default categories exposed by the UI

```text
general
rent
utilities
salaries
maintenance
transport
supplies
marketing
other
```

These remain plain `category` text values in the database, so we are not introducing an
unnecessary category table yet.

---

# Apply

Batches 01–04 should already be installed.

Copy the Batch 05 files, then apply:

```bash
supabase db push
```

Apply the sidebar edit:

```text
PATCHES/default-layout-inventory-expenses.md
```

Restart if required:

```bash
pnpm dev:shop-crm
```

Validate:

```bash
pnpm run typecheck:shop-crm
pnpm run build:shop-crm
```

---

# Manual test — FIFO-aware adjustment

Start with:

```text
Purchase Widget:
10 units @ 4 EGP

Current stock:
10
```

## Negative correction

Open `/inventory`.

Adjust Widget:

```text
Decrease
Quantity: 2
Reason: 2 damaged units
```

Expected:

```text
products.stock = 8

inventory:
-2 manual_adjustment

inventory_adjustment_cogs:
2 units allocated against the 4 EGP purchase batch

store_entries (default toggle ON):
expense = 8 EGP
category = inventory_adjustment
```

Then sell:

```text
4 Widgets @ 10
```

Expected sale FIFO COGS:

```text
4 × 4 = 16 EGP
```

After the sale:

```text
stock = 4
```

and the original 10-unit FIFO batch has effectively consumed:

```text
2 adjustment
+ 4 sale
= 6 units
```

so only 4 units remain available from it.

## Positive correction

Add:

```text
+3 units
unit cost = 5 EGP
reason = physical count found extra stock
```

Expected:

```text
products.stock += 3
inventory +3 manual_adjustment @ 5 EGP
```

Those units become eligible FIFO stock after older batches are exhausted.

---

# Manual test — Expenses

Open `/expenses`.

Create:

```text
Expense
Amount: 500
Category: rent
Note: September office rent
```

Create:

```text
Income
Amount: 100
Category: other
Note: Scrap sale
```

Expected page totals:

```text
Expenses: 500
Other income: 100
Entry net: -400
```

Dashboard should also refresh to include those entries in net profit.

As a non-owner shop member:

- creating an entry should work
- edit/archive buttons should not appear

As owner:

- edit should work
- archive should remove the entry from active totals and Dashboard calculations

---

# Navigation after Batch 05

```text
Dashboard
Invoices
Products
Services
Inventory
Expenses
────────────
Team       Soon
Reports    Soon
```

# Next batch

Next:

1. **Team / Employees**
2. **Reports**

Team will use the existing `shop_members` ownership model rather than inventing a separate
employee table.
