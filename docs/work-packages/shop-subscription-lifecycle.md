# Shop subscription lifecycle: observed implementation

Observed in the cloud checkout on 2026-10-13. Current staging and draft proration behavior are distinguished below. No hosted settings or database rows were changed for this review.

## Current staging

Shop uses XPay hosted **one-time** payments (`mode: 'payment'`). Monthly/yearly describes the prepaid access period, not a card charging mandate. XPay documents recurring prices as unsupported in checkout: https://docs.xpay.app/en/integrate/checkout-session/line-items-and-pricing and https://docs.xpay.app/en/integrate/checkout-session/overview. Inline prices are session-only products; absence from the merchant product catalogue is expected. `productData.description` is a supported hosted summary subline.

A verified successful payment activates access. Pending/failed payments and redirect URLs do not grant access. Old manual-payment records remain historical/reviewable; an unresolved historical review blocks another checkout. New payment-notice write paths are revoked. Trial users can pay before their trial ends; paying does not create another trial.

The legacy paid-order fulfillment in `apps/shop-suit/supabase/migrations/20261013104931_xpay_payment_orders.sql` starts a new month/year at the existing future period end when the subscription is active. Otherwise it starts at verified settlement time. Early renewal can therefore extend prepaid access. The current plan card is disabled as Selected for active paid users; the payment section can still create a same-terms one-time order. There is no explicitly named renewal action or recurring charge authorization.

Access checks use the actual expiry date. `shop_private.assert_shop_write_access` in `20260918213353_shop_source_baseline.sql` permits trial writes only while trial_end_at > now(), and paid writes only while current_period_end > now(). Its deployed definition was inspected in the disposable migration database after all migrations: public schema references replace historical shop_crm references. The current `resolve_plan_entitlement` in `20260929220000_platform_plan_catalog_subscription_controls.sql` projects expired access as read_only. Inventory checks also require a future active/trial end. No grace period is implemented in these guards. Authorized reads/history are preserved; suspension, membership, permission and quota checks continue to apply.

Billing and the sidebar show the end date. The opt-in five-minute XPay cron reconciles outstanding payment sessions; it does not charge renewals. No subscription renewal email/reminder, automatic collection, dunning or recurring invoice flow was found in the Shop App/functions/migrations. Historical `docs/readiness/plans.md` manual-only statements are superseded by the current XPay implementation and must not be used as current provider behavior.

## Draft proration stack: gate remains off

Drafts #287/#288 and their checkout child freeze exact server calculations and commercial terms. Same-interval changes preserve the period end, interval changes begin a full interval at verified settlement, trial conversion charges a full term without inventing unused trial value, and credit-only changes require explicit owner confirmation. Actual prior funded value and audited carryforward credit determine the offset. No refund or automated recurring payment is implied.

Selecting the same active terms is an explicit no-change quote. A dedicated early-renewal intent is **not implemented in the gated proration path**; that must be resolved before enabling the gate if early renewal is required. Custom/composite active periods are rejected rather than priced as a standard monthly/yearly cycle. Async proration and FX are unsupported.

Remaining acceptance: hosted provider acceptance beyond the passing synthetic nested payload tests; offer/SAS/grant scenarios; monthly/yearly changes in both directions; admission and settlement expiry boundaries; restart/context browser cases; and consolidated integration checks. The disposable PostgreSQL provider interfaces are stubs; local financial tests are not hosted Auth/Storage/provider acceptance.
