# Ledger Suit plan catalog reconciliation

Status: reconciled for LS-PLAN-001 (PLAN-01, PLAN-02, PLAN-03)

This record compares the active server catalog with implemented Ledger Suit behavior. The catalog source is `public.subscription_plans`, `public.subscription_plan_prices`, and `public.subscription_entitlements`, projected through `public.subscription_plan_catalog()` by `supabase/migrations/20260911090000_launch_plan_catalog.sql`. Prices are integer EGP minor units. No price, discount, quota, entitlement, or availability flag was changed by this review.

## Public catalog and prices

| Plan | Public | Purchasable | Monthly | Annual | Annual rule | Product evidence |
|---|---:|---:|---:|---:|---|---|
| Solo | yes | yes | EGP 399.00 | EGP 3,255.84 | monthly × 12 × 68% | Core accounting routes, posting engine, reports and exports exist; quota enforcement is listed below. |
| Starter | yes | yes | EGP 599.00 | EGP 4,887.84 | monthly × 12 × 68% | Solo capabilities plus enforced higher limits and server-authorized CSV import. |
| Business | yes | yes | EGP 1,099.00 | EGP 8,967.84 | monthly × 12 × 68% | Starter capabilities plus enforced multi-currency and higher limits. |
| Scale | yes | **no** | — | — | — | Preview only. It has no price or entitlement rows and `app.resolve_purchasable_plan` rejects it. |

The exact values and 32% annual discount are asserted by `supabase/tests/10_launch_plan_catalog_test.sql`. Card checkout resolves the selected amount again through `public.billing_checkout_context`; exact equality for all six prices and Scale rejection are asserted by `supabase/tests/24_plan_aware_paymob_checkout_test.sql`. Manual payment uses that same checkout context and is asserted by `supabase/tests/77_manual_payment_test.sql`.

## Quotas

| Entitlement | Solo | Starter | Business | Trial | Authoritative usage and enforcement |
|---|---:|---:|---:|---:|---|
| `max_members` | 1 | 3 | 10 | 10 | `20260911093000_plan_quota_engine.sql`; member transition trigger in `20260911110000_member_seat_quota.sql` |
| `max_monthly_transactions` | 500 | 2,500 | 10,000 | 10,000 | quota engine; first-post transition enforcement in `20260912094117_monthly_posted_transaction_quota.sql` |
| `max_storage_bytes` | 1 GiB | 5 GiB | 20 GiB | 20 GiB | quota engine; aggregate attachment reservation/deletion accounting in `20260911205305_aggregate_attachment_storage_quota.sql` |
| `max_accounts` | 30 | 100 | 300 | 300 | quota engine; create/reactivate trigger in `20260911124345_account_quota_enforcement.sql` |
| `max_counterparties` | 100 | 1,000 | 5,000 | 5,000 | quota engine; create/reactivate trigger in `20260911131925_counterparty_quota_enforcement.sql` |
| `max_recurring_rules` | 5 | 25 | 100 | 100 | quota engine; create/reactivate trigger in `20260911195634_recurring_rule_quota_enforcement.sql` |
| `max_custom_roles` | 0 | 3 | 10 | 10 | quota engine; create trigger in `20260911201132_custom_role_quota_enforcement.sql` |
| `max_owned_organizations` | 1 | 1 | 1 | 1 | owner-membership transition trigger in `20260909200000_limit_owned_organizations_by_plan.sql` |

`public.subscription_usage_summary()` uses the same `app.plan_quota_usage()` predicates as the write assertions. `usePlanUsage.ts`, `UsageMeters.vue`, and `QuotaUsageMeter.vue` display those server results and obtain upgrade allowances/prices from `subscription_plan_catalog()`. SQL suites 11 and 13–19 cover representative usage and denial behavior; `tests/e2e/usage.spec.ts` covers the displayed seven operational meters in English and Arabic.

## Feature entitlements

| Entitlement | Solo | Starter | Business | Trial | Implemented/enforced evidence and public treatment |
|---|---:|---:|---:|---:|---|
| `audit_log_retention_days` | 90 | 365 | 1,095 | 1,095 | Read windows enforced by `20260912184018_audit_history_visibility_window.sql`. |
| `multi_currency` | no | no | yes | yes | Account/transaction/entry/commitment/recurrence guards in `20260912102128_business_multi_currency_enforcement.sql`; UI is advisory only. |
| `imports` | no | yes | yes | yes | Every import mutation asserts the feature in `20260912110717_csv_import_backend.sql` and concurrency hardening in `20260913171823_launch_plan_concurrency_hardening.sql`. |
| `exports` | yes | yes | yes | yes | Report export RPCs assert the feature in `20260912180913_financial_report_csv_exports.sql` and later replacement report migrations. |
| `core_reports` | yes | yes | yes | yes | Financial report routes and server report RPCs are implemented. Because every available plan enables it, it is presented as an included baseline capability rather than a differentiated gate. |
| `priority_support` | no | no | yes | no | The support queue exists, but no server SLA/routing rule consumes this entitlement. It is therefore **not advertised** on public cards. The approved catalog bit is preserved pending a separate commercial decision to define/enforce the promise or remove it. |
| `branches` | no | no | no | no | No plan advertises it. The disabled row is retained as an explicit future boundary. |
| `advanced_analytics` | no | no | no | no | No plan advertises it. The disabled row is retained as an explicit future boundary. |
| `api_access` | no | no | no | no | No plan advertises it. The disabled row is retained as an explicit future boundary. |

The private 14-day trial is non-public and non-purchasable. `20260913225446_business_level_trial.sql` gives it the Business quotas/features except Priority Support; `supabase/tests/27_business_level_trial_test.sql` covers conversion behavior.

## Surface parity and privacy

| Surface | Catalog/amount source |
|---|---|
| Marketing | `BillingCheckout.vue` → `subscription_plan_catalog()` |
| Subscribe | `SubscriptionGate.vue` → `BillingCheckout.vue` → catalog RPC; checkout re-resolves the amount server-side |
| Billing/manage | `BillingCheckout.vue` plus `usePlanUsage.ts` → catalog RPC and authoritative usage RPC |
| Card checkout | `billing_checkout_context()` → `app.resolve_purchasable_plan()`; signed price snapshot is checked by the webhook |
| Manual payment | `prepare_manual_payment()` → `billing_checkout_context()`; the approved request retains the price snapshot |
| Platform admin | rows retain server plan keys/price snapshots; names and correction choices are resolved from the safe catalog, and corrections re-resolve the selected price server-side |

The public RPC returns only plan key, display content, sort order, purchasability, commercial prices, and entitlements. Raw catalog-table reads are revoked from browser roles, so provider and provider-price identifiers never enter public plan data. Paymob identifiers remain Edge Function environment configuration and cannot select or price a commercial plan.

`tests/unit/plan-catalog-surfaces.test.mjs` guards shared surface wiring, absence of client price literals, catalog-driven admin choices, and provider-ID omission. `tests/e2e/pricing.spec.ts` covers public English/Arabic rendering and non-purchasable Scale behavior. The SQL tests above remain the authoritative catalog, quota, checkout, and payment verification.

## Commercial approval boundary

No commercial change was applied. The only item requiring a future explicit product decision is the existing Business `priority_support` entitlement: either define and enforce a measurable support treatment before advertising it, or approve its removal from the catalog. Enterprise, branches, advanced analytics, API access, and custom Scale terms were not invented or advertised.
