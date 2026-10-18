# International subscription pricing preparation

Checkpoint 2026-10-18. Shop alone; based on stg `9d00cc7cdf4438090afe55be65cd8f691d093ba3`. No Doctor edits, provider configuration, credentials, hosted writes or migrations. This prepares contracts and hardens existing EGP verification. **USD checkout is not enabled.** No USD catalog terms, public prices, selector UI or currency ledger are published by this checkpoint.

## Existing code contracts

The current code catalog (not a read of hosted commercial configuration) is:

| Plan/variant | EGP monthly | EGP annual | Proposed fixed USD monthly | Proposed fixed USD annual |
| --- | ---: | ---: | ---: | ---: |
| Solo / solo_1 | 349 | 2,847.84 | 6.99 | 56.99 |
| Solo / solo_2 | 499 | 4,071.84 | 9.99 | 81.99 |
| Team / standard | 699 | 5,703.84 | 13.99 | 113.99 |
| Multi / multi_2 | 999 | 8,151.84 | 19.99 | 162.99 |
| Multi / multi_3 | 1,199 | 9,783.84 | 23.99 | 195.99 |

USD figures are a draft fixed price book anchored to the user's 349 EGP / 6.99 USD example, not a current FX quote or an enabled offer. An authoritative CBE rate could not be retrieved (site rejected the request); proximity to current exchange rates is **unverified**. Confirm the desired commercial values before the book is activated. Do not silently recalculate USD prices when FX moves. Each annual price is a separately fixed whole-term price, not a monthly charge and not exactly the EGP catalog's 32% discount. Existing plan presentation derives each annual discount from its matching same-currency monthly term; it must not advertise a universal 32% for these draft USD values.

Current checkout uses the modern Bearer-key `https://api.xpay.app/checkout/sessions` API. Legacy community.xpay.app decimal-major-unit requests and callbacks are incompatible and must not be mixed into this integration. Existing monthly and yearly subscriptions purchase one whole commercial term; automatic recurring debit is not implemented.

Prices start as decimal major units in `plan_catalog_terms`, then become exact integer minor units in frozen payment orders. XPay orders, SQL quote/proration functions, credit accounts, client quote parser and several billing display projections are explicitly EGP-only. Operational shop/POS currency settings are separate from the SaaS subscription currency and must not choose subscription prices. Existing refunds require separately authorized operator reconciliation; there is no automatic refund path to generalize.

## Verified provider contract

Official sources inspected:

- [XPay pricing](https://xpay.app/pricing): supported customer currencies do not imply USD settlement; settlement is EGP.
- [Account capability](https://docs.xpay.app/en/api-reference/account/getAccount): account `supportedCurrencies` identifies decimals and payment methods per currency. Match merchant, mode, live activation, key type and read/write permissions. EGP card support or a card issued abroad is not USD eligibility.
- [Line items and pricing](https://docs.xpay.app/en/integrate/checkout-session/line-items-and-pricing): all lines share one native price currency; USD 6.99 is integer `699`. The response has EGP processing totals plus USD `presentmentDetails` totals. FX is locked at session creation, not computed by our frontend or server.
- [Checkout session](https://docs.xpay.app/en/api-reference/objects/checkout-session): `presentmentDetails.amountTotal` is the customer-facing total. Top-level `amountTotal` is the processing total. Paid status, bound session/order/merchant/mode and immutable amount tracks are all required; a redirect is not payment proof.
- [Signature verification](https://docs.xpay.app/en/integrate/webhooks/verifying-signatures): retain timestamp/raw-body HMAC, five-minute delivery window and event-ID deduplication. Signed events remain wakeups for authenticated retrieval.
- [Refunds](https://docs.xpay.app/en/api-reference/refunds/createRefund): partial multi-currency refund amount units/track need explicit provider confirmation and a sandbox receipt. Do not guess or convert a requested USD refund into EGP locally.

This cloud process has no configured XPay key, merchant ID or mode. Only presence was checked; no secret value/file was read and no account request was made. Merchant-specific USD/card eligibility and real sandbox results remain unverified.

## Implemented preparation

`verifyMerchantReadiness` accepts a requested charge currency, defaults to EGP, and requires USD/card support specifically for USD checks. It never returns account/key/customer data. Current production call sites still check EGP; this parameter is not an enable switch.

`xpayMoneyTracks` projects distinct typed processing/presentment amounts and locked-rate evidence. It accepts EGP-only legacy responses, rejects malformed/mismatched mirrors, and performs no FX arithmetic. Existing EGP session validation now rejects a foreign presentment mirror even if the top-level processing amount matches the EGP order. Webhook and reconciliation reject that mismatch before the existing SQL fulfillment RPC.

`subscriptionCurrencyChoice` is a typed, pure presentation preference boundary, not wired to routes yet. Egypt/unknown hints suggest EGP; foreign-country hints suggest USD. An explicit user selection overrides the suggestion. An existing paid subscription keeps its commercial currency; a different explicit selection is identified as requiring a new currency-change quote. Country hints, query parameters, browser storage, locale, IP headers and client-submitted amounts never authorize a price or charge. The current Edge request whitelist rejects currency/country/amount injection.

## Minimal safe rollout plan

1. Verify merchant generation/mode and USD/card capability via authorized read-only `GET /account`; retain a secret-free evidence receipt. Run a sandbox USD session with a server-owned fixed USD term, signed webhook/retrieve, duplicate delivery, expiry and uncertain-create recovery. Confirm amount fields, locked-rate representation, fees and refund units. No live charge is needed for this proof.
2. Add an independently versioned EGP/USD price book through product-owned catalog commands. The server returns authoritative term IDs, currency, interval, exact amount, revision and availability. No browser conversion or country-priced override. Existing EGP terms, negotiated overrides and recipient-bound private offers retain their currency; never apply an EGP override to a USD term. A missing USD price is unavailable, with no currency fallback.
3. Extend frozen orders, paid observations, receipts, audit and reconciliation to retain **both** the USD commercial/presentment total and provider EGP processing total, plus immutable FX rate/ID. On first bind persist the provider's tracks; later retrievals must match that snapshot. Reject a changed presentment amount/currency/rate or processing amount. Never compare 699 USD cents with the EGP processing total, or calculate a provider processing amount locally. Introduce compatible forward migrations/types/tests only through normal CI; do not edit applied history.
4. Extend the existing proration algorithm within the commercial currency: monthly/yearly rates, elapsed time, rounding and credit stay in that currency. Currency-key credit accounts and immutable ledger rows are required; no sum, debit, settlement, refund or proration may cross EGP/USD. A paid EGP period cannot fund a USD upgrade. Currency switching occurs only through a separately quoted new term after the existing period, with explicit confirmation and no automatic FX credit. Same-currency annual-to-monthly scheduling preserves the existing period and exact term policy.
5. Preserve refund origin and cumulative amount in the original customer currency alongside provider processing/refund records. Block automation until provider clarifies partial refunds. Reconcile provider fee/FX differences separately; never rewrite the original paid amount or infer a refund from a browser result. Do not revoke or grant access twice after replay/refund events.
6. Shared `packages/ui` owns an explicit EGP/USD selector alongside the existing monthly/yearly controls and exact currency labels across marketing/signup/billing/checkout/history. Reusable selection/pending/dirty behavior belongs in `packages/ux`; Shop supplies prices, preference and capabilities. Country recommendation is overridable and gives no price authority. Once deployed, fresh Egypt/unknown visits default EGP and foreign visits may be offered USD only if its complete server path is available. Existing subscriptions remain on their currency. Unsupported USD shows clear EN/AR unavailable copy and never opens an EGP charge disguised as USD.
7. End-to-end acceptance: forged country/currency/amount, tenant/owner denial, all ten fixed USD/EGP term combinations, negotiated/private offers, stale quotes, monthly/yearly changes, cross-currency credit refusal, fee/FX tracks, retry/idempotency, signed replay, refund limits, EN/AR/RTL/themes/responsive/accessibility, and an unchanged EGP checkout. Do not expose the selector or declare live USD support until these gates pass.

Remaining rollout prerequisites: merchant account capability/sandbox evidence; authoritative fixed-price activation; paired-track persistence and currency-safe financial/UI integration; explicit partial-refund semantics. This checkpoint does not claim completion of customer USD payments.

## Checkpoint validation

77 focused payment/currency/proration/scheduled-billing tests pass, including all existing XPay regression cases and new signed foreign-presentment denial before fulfillment. All three Edge entry points pass Deno 2.9.6 checking; changed provider modules pass Deno lint. Shop typecheck, changed app/test ESLint, canonical token checks, strict template/workspace boundaries and diff whitespace pass. No SQL migration or UI/template changes are included, so no new database/browser acceptance is claimed. Merchant account, provider sandbox and live payments remain unrun.
