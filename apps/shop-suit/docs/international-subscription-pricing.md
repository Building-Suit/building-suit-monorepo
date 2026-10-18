# Shop subscription currencies

Implementation: PR400, based on stg `9d00cc7cdf4438090afe55be65cd8f691d093ba3`. Shop changes are independent of Doctor work. The EGP/USD selector and currency-safe server contracts are implemented. **USD charging remains disabled pending merchant-specific verification.** No live payment/refund, provider configuration, secret, manual deployment or hosted database write is performed by this task. The forward migration is applied only by the normal CI/release process.

## Fixed price matrix

| Plan/variant | EGP monthly | EGP annual | USD monthly | USD annual |
| --- | ---: | ---: | ---: | ---: |
| Solo / solo_1 | 349 | 2,847.84 | 6.99 | 56.99 |
| Solo / solo_2 | 499 | 4,071.84 | 9.99 | 81.99 |
| Team / standard | 699 | 5,703.84 | 13.99 | 113.99 |
| Multi / multi_2 | 999 | 8,151.84 | 19.99 | 162.99 |
| Multi / multi_3 | 1,199 | 9,783.84 | 23.99 | 195.99 |

EGP values are the existing code catalog, not a new read of hosted commercial configuration. USD values are fixed commercial prices anchored to the user's 349 EGP / 6.99 USD example. They are not a live FX conversion. CBE's rate page rejected this cloud request, so equivalence to the current market rate is unverified. Each annual price is an independently fixed whole-term price. The UI calculates displayed savings and monthly equivalents against the corresponding same-currency monthly term; no currency conversion is used to calculate a discount.

The private `international_price_book` contains the ten exact integer-cent USD prices. Each available public EGP source term produces a separate immutable USD term with the same resource/entitlement snapshot and a recorded source ID. Legacy `shop_public_plan_catalog` and `current_plan_offers` keep EGP-only defaults/cardinality. Explicit `shop_subscription_currency_catalog('USD')` reads the USD catalog; a missing USD term is unavailable, with no fallback to an EGP price. Owner billing uses `shop_billing_currency_plans` for authoritative currency-specific effective prices and blockers. Negotiated overrides apply only within the matching currency; private offers retain their own currency.

## Selection and availability

Shared pricing presentation in `packages/ui` owns the EGP/USD controls alongside monthly/yearly controls. `packages/ux` owns pending/cancellable choice behavior and native radio reconciliation; Shop supplies prices, state, translated copy and commands. Existing consumers see no extra controls unless they provide the optional currency projection.

Egypt/absent or malformed country hints default to EGP. A foreign-country hint may recommend USD; explicit selection wins and persists as a non-sensitive preference cookie. Country/IP headers, locale, query parameters and cookie values never authorize a price or unlock payment. The server freezes the authenticated owner's selected catalog term and exact amount. The Edge request whitelist still refuses client amount/currency/country injection.

An existing active subscription initially shows its recorded currency, regardless of an IP hint or old preference. Changing the selector does not change that contract. A saved checkout prevents a currency change; abandoning a pending quote requires confirmation. The controller preserves the old selection when a change is declined, and prevents duplicate pending actions. Trials remain free; choosing display currency does not manufacture a paid term.

USD price comparison is available, but a customer sees unavailable checkout until all three gates pass:

1. The private database configuration has `enabled` and `usd_enabled` deliberately true. The migration adds `usd_enabled=false` and does not enable it.
2. The server-only runtime has `XPAY_USD_ENABLED=true`; absence/other values keep it off. Existing `XPAY_ENABLED`, environment, origin, API-generation and mode gates remain intact.
3. Authenticated `GET /account` verifies the actual merchant/mode/key permissions, two-decimal USD and `card` support, plus live activation for live mode. EGP card support or a foreign-issued card does not prove USD eligibility.

A failed USD capability check does not suppress valid EGP availability. Disabling new USD charges does not prevent authenticated retrieval and reconciliation of already-created sessions or real paid observations. No browser result, redirect or checkout-complete-but-unpaid state grants access.

## Amount tracks and financial rules

The integration stays on the modern Bearer-key `api.xpay.app/checkout/sessions` API. Legacy community.xpay.app major-unit payloads/callbacks are incompatible and are not adopted.

A USD 6.99 line is integer `699`, with one native currency for all lines. Hosted checkout displays USD, while top-level response totals are EGP processing amounts; `presentmentDetails.amountTotal` is the customer total. XPay locks FX at session creation. Our code performs no FX calculation and never compares 699 USD cents with an EGP processing total.

- `shop_xpay_orders`, paid observations, commercial payment receipts and periods retain the quoted customer currency and amount. Shared types distinguish `SubscriptionMoney<'EGP'>` processing from EGP/USD presentment.
- `shop_xpay_money_tracks` stores the original provider EGP processing amount, customer amount/currency and locked FX ID/rate atomically at first bind/recovery. Its immutable snapshot must match every later retrieval. EGP-only historical responses remain supported; an EGP order rejects a foreign presentment mirror even when processing totals happen to match.
- `shop_xpay_processing_receipts` records the provider's first verified-paid fee details independently. The Edge projection whitelists monetary fee fields and omits customer/card/key data. The original paid-state/flat-or-expanded PaymentIntent validator runs before this receipt is written; a later failure rolls back both tracks, receipt and access effects together.
- Webhook raw-body HMAC, five-minute delivery window, durable event-ID deduplication, authenticated session retrieval, merchant/mode/order binding and monotonic paid state are preserved. Request retries reuse the frozen body/key, and never silently reprice a session.
- Proration uses the unchanged exact numeric/time algorithm within the commercial currency. Monthly/yearly quotes, paid funding, rounding, settlements and credit ledger entries retain EGP or USD explicitly. Credit accounts use `(subscription_id,currency)` keys; one currency cannot consume or mutate another currency's balance. Historical EGP balances and receipts are preserved.
- An active paid currency change is deferred to term end. It cannot spend the old currency's prepaid funding or credit through an immediate quote. The next term requires a separate explicit server quote/payment in the new currency, after expiry. Same-currency annual-to-monthly/downgrade scheduling retains the current policy. Expired old-currency credit remains separate; it is not silently converted.

## Refund handling

This feature does not initiate automatic refunds. The existing separately authorized operator process remains. Public modern API documentation does not establish unambiguous partial multi-currency refund units; the application sends no guessed partial-refund request.

`shop_xpay_record_refund` records an already-succeeded, reviewed provider refund through a service-only RPC. It requires original order/session binding, explicit original-currency customer minor units, EGP processing minor units, paired-track evidence declaration, a provider-evidence digest, attributed reviewer and reason. Both currencies must match the immutable original money tracks. Refund/request IDs are idempotent and globally unique. Under the same resource/subscription/order serialization as settlement, cumulative refunds cannot exceed either original amount. Pending, missing, fractional, currency-swapped, reused-key or over-refund evidence is refused.

Refund observations are append-only and RLS protected; clients and service-role table writes have no grants. Owners read only the authorized aggregate on their order history, which retains the original paid amount and separately labels the refunded amount in the same customer currency. Processing/refund differences remain explicit evidence, not recomputed FX. A refund does not rewrite the original receipt or automatically revoke access. Refunded funding blocks further active proration pending operator review, so it cannot produce duplicate credit; a quote admitted before a refund becomes stale/held through funding-evidence validation.

## Exact account-specific evidence still unavailable

This cloud process has no configured XPay key, merchant ID or mode. Only variable presence was checked; no secret value/file was read and no merchant account request was made. Generic documentation is not account eligibility.

The user can obtain evidence without sharing a secret:

- In the existing merchant dashboard or through provider support, request confirmation that this exact account uses the modern checkout API and permits USD/card in the intended test/live mode. Ask whether settlement remains EGP, whether the quoted fee/tax configuration is supported, and how partial USD refunds express customer versus processing units.
- Alternatively, an authorized operator can run read-only `GET /account` from the existing secure server/account console using its already-installed credential. Share only a redacted capability receipt: timestamp, environment/mode, account-match confirmation, `supportedCurrencies` entries for EGP/USD with decimals/methods, `livePaymentsEnabled`, and key type/mode/permission names. Do not share the Bearer key, signing secret, `clientSecret`, full headers or customer data.
- Before enabling USD, retain sandbox evidence for a server-owned USD term: request `699` USD cents; response EGP processing total plus USD presentment `699` and locked FX evidence; signed paid retrieval; retry/duplicate delivery; pause/reconcile; and provider-confirmed full/partial refund units. Test mode is not proof of live activation. A dashboard claim that foreign cards work is insufficient.

Enabling the private/runtime flags and configuring a real account are separate operator actions, not performed by this task. USD remains fail closed until these receipts exist. Staging code integration does not authorize live charges or main promotion.

## Official sources

- [XPay pricing](https://xpay.app/pricing) — supported presentment currencies and EGP settlement.
- [Account capability](https://docs.xpay.app/en/api-reference/account/getAccount) — account-specific currency/method/mode permissions.
- [Line items and pricing](https://docs.xpay.app/en/integrate/checkout-session/line-items-and-pricing) — integer amounts, single native currency, processing/presentment tracks and FX lock.
- [Checkout session](https://docs.xpay.app/en/api-reference/objects/checkout-session) — customer mirror and paid status.
- [Signature verification](https://docs.xpay.app/en/integrate/webhooks/verifying-signatures) — timestamp/raw-body HMAC and replay window.
- [Refund API](https://docs.xpay.app/en/api-reference/refunds/createRefund) — provider clarification required before partial-refund automation.

## Validation record

The new rollback-only SQL suite exercises the full fixed USD matrix, EGP catalog compatibility, owner isolation, disabled-USD admission, paired binding/changed totals/replay, paused reconciliation, real commercial receipt currencies, monthly/yearly USD proration, separate credit accounts, cumulative paired refunds, refund funding review and an unchanged EGP settlement. It is included in the GitHub-hosted disposable Supabase payment runner. Local replay uses PostgreSQL 17 with synthetic Auth/Storage and inert Vault/Cron interfaces; it does not prove real provider Auth, scheduling or merchant compatibility. Applied migrations are unchanged.

New browser cases cover EN/AR, mobile/desktop, dark/light, keyboard currency selection, all fixed terms, EGP return, country recommendation/explicit reload persistence, unavailable USD with no charge/fallback, a synthetic ready-USD server quote, and original/refunded USD history. Full regression and exact-head CI outcomes are recorded in the PR before staging integration.
