# Shop Suit — Database Contract

Source of truth: `database/supabase/supabase/migrations/20251224154509_remote_schema.sql`
(recovered from Git history at `9b7647a~1`, a `db pull` snapshot of the hosted database),
plus the api-layer typed `database.ts` describing current app expectations.

## Tables (16, schema `public`)

| Table | PK | Tenant key | Key columns / constraints |
|---|---|---|---|
| `shops` | id uuid | id | `name`, `type` check(`electricity`/`barbershop`/`generic`, default `generic`), `owner_id` → auth.users (cascade) |
| `shop_members` | id uuid | shop_id | unique(`shop_id`,`user_id`) **declared twice** (`shop_members_shop_id_user_id_key` and `shop_members_unique_per_shop`), `role` default `employee`, `full_name`, `email`, `deleted_at` (soft delete) |
| `plans` | id uuid | — (global) | unique `key`, `price_monthly` numeric, `currency` default `'EGP'` (literal quoted default), `trial_days` int default 0, `is_active` default true, `stripe_price_id`, `soon` default false |
| `shop_subscriptions` | id uuid | shop_id | `plan_id` → plans, `status` default `trialing` (text, no check), `trial_ends_at`, `current_period_*`, Stripe columns, `is_current` default true + partial unique index `(shop_id) WHERE is_current` |
| `shop_modules` | id uuid | shop_id | unique(`shop_id`,`module_key`), `enabled`, `plan`, `starts_at`, `ends_at` |
| `modules` | key text | — | catalog of module keys |
| `plan_modules` | id bigint (seq) | — | unique(`plan_id`,`module_key`), FKs to plans + modules |
| `products` | id uuid | shop_id | `name`, `sku`, `price`, `stock` int, `low_stock_threshold` default 5, `discount`, `vendor_price`, `deleted_at` |
| `services` | id uuid | shop_id | `name`, `price`, `discount`, `deleted_at` |
| `invoices` | id uuid | shop_id | `customer_name`, `kind` check(`product`/`service`/`mixed`), `invoice_source` check(`client`/`vendor`) default `client`, `total`, `discount`, `extra_discount`, `created_by` → shop_members, `deleted_at` |
| `invoice_items` | id bigint (seq) | via invoice | `item_type` check(`product`/`service`/`manual`), `product_id`, `service_id`, `quantity` numeric(12,2), `unit_price`, `line_total`, `discount` |
| `invoice_item_cogs` | id uuid | via item | `batch_id` → inventory, `qty`, `unit_cost`, `total_cost` (FIFO allocations) |
| `inventory` | id uuid | shop_id | `quantity_change` numeric, `reason` check(`vendor_invoice`/`client_invoice`/`manual_adjustment`), `vendor_price`, `invoice_id`, `created_by` |
| `store_entries` | id uuid | shop_id | `kind` check(`income`/`expense`), `amount` numeric(12,2), `category` default `general`, `employee_id` → shop_members, `deleted_at` |
| `portals` (app types only) | id | — | `key`, `name`, `is_original`, `is_active` — used by signup BFF; **absent from schema snapshot** (added to live DB later than snapshot) |
| `profiles` (app types only) | id | portal_id | `user_id`, `portal_id`, `display_name`, `email_snapshot`, `status` (`active`/`suspended`/`archived`) — **absent from snapshot** |

## Functions (18)

| Function | Type | Notes |
|---|---|---|
| `is_shop_member(shop_id)` | sql stable **SECURITY DEFINER** | used by RLS; queries shop_members by `auth.uid()`. **No fixed search_path.** |
| `is_shop_member(p_user, p_shop)` | sql stable | invoker variant, respects `deleted_at` |
| `is_shop_owner(target_user)` | sql stable | caller is owner of a shop the target belongs to |
| `DELETE_get_shop_role(shop uuid)` | sql stable | role of caller in shop |
| `DELETE_shop_has_module(shop_id, module_key)` | sql stable | enabled + not expired |
| `add_expense(...)`, `add_store_entry(...)` | plpgsql | insert store_entries; `created_by` = caller's membership |
| `handle_invoice_item()` | plpgsql **SECURITY DEFINER** trigger fn | on invoice_items insert: auto-create product on vendor invoice (name from description, vendor_price = unit_price), stock in/out on products, insert inventory movement; raises if client item has no product |
| `allocate_fifo_for_item(p_invoice_item_id bigint)` | plpgsql | allocate COGS from vendor batches FIFO by created_at |
| `trg_invoice_items_after_insert()` | plpgsql trigger fn | calls allocate_fifo_for_item |
| `fifo_cogs(product)`, `fifo_cogs_for_invoice(inv)`, `fifo_profit(invoice)` | sql/plpgsql | COGS & profit aggregation (profit = revenue − cogs) |
| `invoice_revenue(invoice)` | plpgsql | line totals minus proportional share of `discount` + `extra_discount` (by line/subtotal ratio) |
| `invoice_cogs(p_invoice)` | sql | sum of invoice_item_cogs |
| `dashboard_metrics(p_shop uuid)` | plpgsql | revenue, cogs, profit, units sold, expenses, manual income, net profit, daily_sales[], profit_by_product[] |
| `apply_plan_modules_to_shop(shop_id, plan_id)` | plpgsql | upsert shop_modules from plan_modules |
| `setup_shop_for_new_user(user_id, shop_name, plan_key)` | plpgsql **SECURITY DEFINER** | creates shop + owner member + subscription (`pending_payment`, is_current=true) + applies modules |
| `shop_access_state(p_shop_id)` | plpgsql **SECURITY DEFINER** | `{allowed, reason}` from current subscription (trial_expired / pending_payment / incomplete / past_due / unpaid / canceled / ok) |

## Triggers (both on invoice_items, AFTER INSERT, per-row)

1. `trg_invoice_item` → `handle_invoice_item()` (product creation + stock movement)
2. `invoice_items_after_insert_fifo` → `trg_invoice_items_after_insert()` (FIFO allocation)

## RLS (enabled + FORCE on shop-scoped tables)

- `shops`: select `is_shop_member(id) OR owner_id = auth.uid()`; insert/update owner only.
- `shop_members`: select members; insert/update owner of shop. No delete policy (soft delete).
- `plans`, `plan_modules`: public select (anon included).
- `shop_subscriptions`: member select (two policies, both equivalent).
- `products`, `inventory`: member + **inventory module enabled** (select/insert); products update
  requires only module enabled — **member check missing on products_update (security finding).**
- `invoices`: member select/insert/update. No delete (soft delete via `deleted_at`).
- `invoice_items`: select/insert require parent invoice membership (+ source rules); update member
  only via `is_shop_member(i.shop_id)` (1-arg definer variant).
- `services`, `store_entries`: member select/insert; store_entries update/delete **owner only**.
- `modules`, `shop_modules`, `invoice_item_cogs`: **RLS not enabled** (modules catalog public via
  grants; shop_modules has no policies — anon/authenticated grants exist, so effectively readable;
  flagged in security review).
- Extra policy on `auth.users` at end of snapshot: `blocked users cannot log in` …
  `using ((deleted_at IS NULL))` — references an `auth.users.deleted_at` column; kept as-is
  (auth schema is managed by Supabase; may already exist upstream).

## Extensions

`pg_graphql`, `pg_stat_statements`, `pgcrypto`, `supabase_vault`, `uuid-ossp` (in `extensions`),
and an explicit `drop extension if exists pg_net`.

## Divergences requiring a forward migration (Category B — compatibility)

Current app (`plans.get.ts` + api-layer types) expects on `plans`:
`price_amount`, `currency` (plain default 'EGP'), `billing_interval`, `trial_days`, `features` jsonb,
`sort_order`, `is_public`, `is_coming_soon`, `stripe_product_id`, `stripe_mode`.
Snapshot has: `price_monthly`, no `billing_interval/features/sort_order/is_public/is_coming_soon`,
currency default literal `'''EGP''::text'`, `soon` instead of `is_coming_soon`.
The migration must add/rename these columns without dropping data (`price_monthly` → `price_amount`).

Current app also expects `portals` + `profiles` tables (signup/session flow).
The migration must create them (idempotent) with RLS + triggers consistent with the app flow.

## Seed (missing)

No seed.sql existed. Plans/portals/modules must be seeded so the landing pricing section works
against a local database.
