# X-Pay subscription checkout

Status: provider-contract foundation only; **not connected or live**. Existing
customer manual payment/evidence UI remains until the atomic replacement lands.
Do not consolidate this checkpoint as the finished user feature.

## Verified provider sources (2026-10-13)

- [Official documentation](https://docs.xpay.app/en), linked directly by [XPay](https://xpay.app/).
- [Hosted checkout](https://docs.xpay.app/en/integrate/integration-patterns/hosted-checkout): server creates a session with Bearer secret key at `https://api.xpay.app/checkout/sessions`; price is integer minor units; redirect is not proof of payment.
- [Create API contract](https://docs.xpay.app/en/api-reference/checkout-sessions/createCheckoutSession): camelCase fields, hosted/payment mode, metadata and fee configuration.
- [Session contract](https://docs.xpay.app/en/api-reference/objects/checkout-session): `complete` can be unpaid; only `paymentStatus=paid` qualifies. `livemode`, `merchantId`, amount and currency must match our persisted order.
- [Signature verification](https://docs.xpay.app/en/integrate/webhooks/verifying-signatures): `XPay-Signature: t=...,v1=...`, HMAC-SHA256 of timestamp + dot + exact raw bytes, five-minute delivery window. No official server verification library is currently provided.
- [Idempotency](https://docs.xpay.app/en/integrate/idempotency): key belongs to one immutable operation; retention is only 24 hours. Never retry an uncertain create after that window as if deduplication were permanent.
- [Retry/replay](https://docs.xpay.app/en/integrate/webhooks/replaying-and-retries): stable event ID, fresh delivery signature. This page distinguishes 13 live attempts from five test attempts; the hosted guide's five-attempt summary is less specific. Do not depend on delivery being guaranteed; reconcile.
- Official logo: inline `svg[aria-label="XPay"]` from `https://xpay.app/`, saved as `public/payments/xpay-light.svg` and `xpay-dark.svg`. Original path geometry and accent retained; foreground resolved for each background. No invented logo or third-party image. Asset is prepared, not yet displayed.

The modern public docs describe `sk_test_`/`sk_live_` keys, `cs_*` sessions and
`whsec_*` secrets. Confirm that the accepted merchant is enabled for this API
generation before wiring an account-specific deployment. Do not assume legacy
community/API credentials are compatible. Public docs do not specify a required
version header; do not invent one.

## Product implementation plan

1. Persist authorized order/quote before provider I/O. Only an authenticated Shop
   owner may choose catalog terms or redeem their authorized private offer.
   Existing catalog, negotiated price and private-offer calculations stay on the
   server. Reject usage-blocked plans before taking payment. Freeze amount,
   currency, commercial interval, plan/variant, quote source, tenant, provider
   account/mode, operation ID and exact request. Client cannot supply price.
2. One open checkout per logical subscription operation. Reuse its session and
   persisted UUID key on retries. Session binding and fulfillment need unique
   constraints; use locks for simultaneous starts and payment fulfillment.
   Persist uncertain provider calls for reconciliation. Past the provider's
   24-hour key window, require reconciliation instead of blind recreation.
3. Use hosted checkout in `payment` mode for the existing purchased commercial
   term. Recurring auto-debit is not part of the user's request. Do not infer a
   recurring contract from a `subscription` enum. Fee pass-through and VAT
   collection are disabled in the prepared body to keep the frozen quote exact;
   confirm commercial/tax configuration before release.
4. Verify webhook bytes before parsing, durable inbox keyed by event ID, then
   retrieve the bound session server-side. Validate merchant, mode, order/session,
   amount, currency and paid status. Inbox insertion/ack is durable; failed worker
   execution remains retryable. Commit subscription activation plus paid audit
   exactly once per order/session/payment intent. Distinct successful payments
   for the same operation require operator reconciliation, never duplicate credit.
5. Immediate first paid term starts at verified payment completion/activation,
   even on trial day one. Preserve historical trial start/end and audit; do not
   grant another trial or defer payment until day seven. Existing active renewals
   retain current commercial rules. Never shorten existing paid access. Resolve
   concurrent complimentary admin activation explicitly under the same lock.
6. Unpaid completed local methods, pending, cancel, expiry and failure never grant
   access. Paid state is monotonic against late failure/expiry events. Refunds and
   cancellation follow existing commercial policy and separately authorized
   operator workflows; do not automatically refund, revoke or rewrite history.
7. Replace customer subscription manual transfer/new receipt-upload entry points
   and revoke those new-write RPC paths in a forward migration. Keep old notices,
   evidence and review/audit history readable. Update private-offer redemption so
   it cannot create a new manual notice. Keep catalog uploads and POS/customer
   InstaPay methods unchanged. Keep audited complimentary activation separate.
8. Extend shared billing presentation for X-Pay action/status/logo, with app-owned
   checkout orchestration. Update English/Arabic policy, billing, signup/pricing
   copy and related support instructions. No claim of live checkout while missing
   server configuration; show unavailable with safe retry and preserve access.
9. Test authorization, quote tampering, webhook forgery, replay/concurrency,
   out-of-order events, lost response/reconciliation, private offers, day-one paid
   activation, retained historical evidence and tenant/session switching. Real
   SQL/Auth and provider sandbox verification remain required release gates.

## Missing merchant details and secure setup

Non-secret facts needed: accepted account API generation, merchant ID, chargeable
currency/payment methods, whether fees/tax match quoted plan prices, and approved
staging/production return and webhook domains. Confirm via the provider account
contract/read-only account endpoint at secure setup time. Do not create credentials
or request secrets in chat.

Prepared server-only environment names (not set): `XPAY_SECRET_KEY`,
`XPAY_WEBHOOK_SECRET`, `XPAY_MERCHANT_ID`, `XPAY_MODE` (`test` or `live`),
`SHOP_BILLING_RETURN_ORIGIN`. Separate Shop staging/production keys/endpoints;
no public Nuxt secret configuration. Allow only the configured HTTPS return origin
in the dispatcher, never browser-selected return URLs. The provider adapter is
server-only and expects that dispatcher authorization, not a public API itself.

Secure handoff must install the existing merchant's scoped key and endpoint
signing secret in the target server secret store, configure the authorized HTTPS
endpoint and register the paid/completed/asynchronous/failure/expiry events needed
by the final handler. Persistent provider/security configuration requires the
parent's action-time authorization. No live payment/refund, customer activation,
email, hosted migration or deployment is performed by this task checkpoint.

## Checkpoint evidence

Base: PR #272, `fdd800883a186225fbbf7aeeaf183e898f9e38c4`.
Branch: `codex/shop-suit/xpay-checkout`; parent `codex/shop-suit/cloud-integration-validation`.
No other task's pending files copied. No SAS branch changes included.

`node --test apps/shop-suit/tests/unit/xpay.test.mjs`: nine passing contract/security
tests. `git diff --check`: passed. No runtime consumer exists yet; browser/full
build/provider checks unrun. Real database tests unrun; no Docker pulls attempted.
Root pnpm command initially failed (installed 11.25.0 vs pinned 10.33.0); current
preflight succeeds through documented `node tooling/git/preflight.mjs` fallback.

Continue on this branch/PR: database order/inbox/atomic fulfillment, secure
dispatcher and webhook worker, reconciliation, shared presentation, customer
manual-flow retirement, policy/copy and browser/SQL verification. Parent owns
final consolidation and `stg` merge after the complete feature passes its gates.
