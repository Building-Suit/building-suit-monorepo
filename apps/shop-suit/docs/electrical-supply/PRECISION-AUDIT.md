# Quantity and cost dependency inventory

Source baseline: staging2efbed85. Declarations below include historical definitions; effective local information_schema and pg_get_functiondef inspection must confirm current scales before widening. No hosted applied-history claim.

Known mismatch: inventory_batches quantities2/cost2; movements quantity2; invoice_items quantity2 but supported-values constraint and draft validators permit3; vendor items quantity2/unit_cost4; stock counts and thresholds2; partial return lines/stock2 and explicit original-precision guards2; service material quantities2 and each/mL/g only. Latest bundle matching/website basket allows3-decimal input. Product editor has no general unit. JS cart defaults to +1 and Number arithmetic. New conversion APIs therefore cannot safely activate measured stock merely by adding a unit label.

M2 must review dependent product_stock/low_stock/location views, sale_costs/report projections, receipt JSON builders, tax/commission snapshots, supplier return stock and offline payload/replay before numeric widening. Money total and price changes require independent decisions; quantity18,6 is not a universal replacement.

| Declaration | Source text |
|---|---|
| `20260918213353_shop_source_baseline.sql:77` | `"quantity_received" numeric(12,2) NOT NULL,` |
| `20260918213353_shop_source_baseline.sql:78` | `"remaining_quantity" numeric(12,2) NOT NULL,` |
| `20260918213353_shop_source_baseline.sql:79` | `"unit_cost" numeric(12,2) NOT NULL,` |
| `20260918213353_shop_source_baseline.sql:90` | `"quantity_change" numeric(12,2) NOT NULL,` |
| `20260918213353_shop_source_baseline.sql:101` | `"quantity" numeric(12,2) DEFAULT 1 NOT NULL,` |
| `20260918213353_shop_source_baseline.sql:102` | `"unit_price" numeric(12,2) NOT NULL,` |
| `20260918213353_shop_source_baseline.sql:264` | `"quantity" numeric(12,2) NOT NULL,` |
| `20260918213353_shop_source_baseline.sql:265` | `"unit_cost" numeric(12,4) NOT NULL,` |
| `20260918213353_shop_source_baseline.sql:1991` | `add column unit_cost_snapshot numeric(12, 2);` |
| `20260918213353_shop_source_baseline.sql:2002` | `unit_cost numeric(12, 2),` |
| `20260926120000_complete_supplier_payables_returns.sql:85` | `quantity numeric(12, 3) not null check (quantity > 0),` |
| `20260926120000_complete_supplier_payables_returns.sql:86` | `unit_cost numeric(12, 4) not null check (unit_cost >= 0),` |
| `20260926150000_stock_counts_low_stock_corrections.sql:5` | `add column reorder_threshold numeric(12, 2) not null default 0,` |
| `20260926150000_stock_counts_low_stock_corrections.sql:14` | `expected_quantity numeric(12, 2) not null check (expected_quantity >= 0),` |
| `20260926150000_stock_counts_low_stock_corrections.sql:15` | `counted_quantity numeric(12, 2) not null check (counted_quantity >= 0),` |
| `20260926150000_stock_counts_low_stock_corrections.sql:16` | `variance_quantity numeric(12, 2) not null,` |
| `20260926150000_stock_counts_low_stock_corrections.sql:17` | `positive_variance_unit_cost numeric(12, 2),` |
| `20260926150000_stock_counts_low_stock_corrections.sql:39` | `previous_threshold numeric(12, 2) not null,` |
| `20260926150000_stock_counts_low_stock_corrections.sql:40` | `new_threshold numeric(12, 2) not null,` |
| `20260928230000_cashier_shifts_reconciliation.sql:8` | `add column variance_amount numeric(12, 2),` |
| `20260928234000_core_sale_corrections.sql:18` | `restored_quantity numeric(12, 3) not null check (restored_quantity >= 0),` |
| `20261014181109_optional_staff_commissions.sql:31` | `quantity numeric(12,3) not null check(quantity>0), net_line_amount numeric(12,2) not null check(net_line_amount>=0),` |
| `20261015013509_service_material_fulfillment.sql:20` | `request_id uuid not null, payload jsonb not null, quantity numeric(12,2) not null check(quantity>0),` |
| `20261015013509_service_material_fulfillment.sql:41` | `product_id uuid not null,batch_id uuid not null,unit text not null,quantity numeric(12,2) not null check(quantity>0),` |
| `20261015013509_service_material_fulfillment.sql:42` | `unit_cost numeric(12,2) not null, movement_id uuid not null unique references public.inventory_movements(id),` |
| `20261015013509_service_material_fulfillment.sql:420` | `request_id uuid not null,quantity numeric(12,2) not null check(quantity>0),reason text not null,` |
| `20261015030016_partial_sale_returns.sql:45` | `return_id uuid not null, shop_id uuid not null, line_id uuid not null, quantity numeric(12,2) not null check(quantity>0),` |
| `20261015030016_partial_sale_returns.sql:54` | `quantity numeric(12,2) not null check(quantity>0), disposition text not null check(disposition in('resellable','damaged')),` |
