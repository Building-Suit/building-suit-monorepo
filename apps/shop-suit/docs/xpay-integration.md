# X-Pay subscription checkout

Status: customer checkout, verified server payment fulfillment, reconciliation and
opt-in scheduling are implemented in the XPay stack. **Not configured or live.**
Without verified merchant/account capabilities, the customer action fails closed.
New customer subscription transfers and receipt uploads are retired; historical
InstaPay records/evidence and separately audited operator actions remain.

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
version header; do not invent one. The published
[OpenAPI](https://docs.xpay.app/openapi.json) identifies `XPay Merchant API`, version
`1.0`, with server `https://api.xpay.app` (retrieved 2026-10-13, SHA-256
`eceae8f13515655eef7b7697905dcd2baeb0d6c6ba285a5cf27e797c68eafc6f`). This
specification version is not proof that the accepted merchant is enabled for it.

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

Registry-backed planned callback configuration (not registered or deployed):

| Environment | Return/cancel page origin | Planned webhook URL |
| --- | --- | --- |
| Shop staging | `https://stg.shop.building-suit.com/billing` | `https://jvvelvftpfnlogalgxgv.supabase.co/functions/v1/shop-xpay-webhook` |
| Shop production | `https://shop.building-suit.com/billing` | `https://fgdzjnsbcxfbiuogbmom.supabase.co/functions/v1/shop-xpay-webhook` |

These domains/project refs come from `docs/architecture/environments.json`; runtime
availability, provider approval and endpoint implementation remain verification
gates. Do not register an endpoint until signature verification and durable inbox
are deployed. Separate test/live endpoint secrets are required. Use no tunnel or
PC network. The parent has identified draft #274's GitHub-hosted disposable backend
runner as the next SQL/Auth test route; no local Docker pulls are required.

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
Design-token source check passed. Workspace boundary check could not start because
this isolated checkout has no installed `typescript` package; it is **unrun**,
not passed. Dependency installation/typecheck/lint/build remain for continuation.

Customer preparation continues on `codex/shop-suit/xpay-billing-policy`, based on
the published #273 head `a350b50ef8860cc7e1a1c2f024045490239ac210`. It excludes
#274's separately published media/CI changes; incorporate that runner deliberately
for database continuation. Shared collision: `BsBillingPage.vue`, its typed view,
docs component catalogue, Shop billing/signup/legal content and their tests. No
SAS files or admin override contracts are changed.

Continue: database order/inbox/atomic fulfillment, secure dispatcher and webhook
worker, reconciliation, server manual-write retirement and SQL/provider/browser
payment verification. The prepared UI remains disabled until these gates pass.
Changing it to enabled without a working authorized backend is forbidden. Parent owns
final consolidation and `stg` merge after the complete feature passes its gates.

Customer checkpoint checks: frozen-lockfile installation using pinned pnpm 10.33.0
completed in cloud; no secret files were read. Shop and docs lint/build/typechecks
passed; Ledger, Inventory and Super Admin typechecks passed. Workspace boundaries,
canonical token check and diff whitespace check passed. Full workspace unit suite:
1,338 passed, 23 existing backend-dependent skips, no failures. The first broad
run lacked the configured browser-cache path; its two tooling browser failures
passed after setting the cloud-only Playwright path. Shop unit subset: 237 passed.

The five affected browser suites ran 61 cases: 55 passed initially; six old
comparison assertions targeted retired DOM selectors and passed after switching
to the maintained section IDs and accessible status text. Coverage retains exact
negotiated/annual prices, quota counts and all six blocker labels. No tests were
skipped to remove the manual payment feature. A final built-head focused rerun
covers the changed checkout, policies, negotiated quotes and quota comparison.
These are synthetic transport/UI checks, not SQL or provider payment proof.

## Payment backend checkpoint (#279)

Branch `codex/shop-suit/xpay-payment-backend` starts at #275's published
`f373c5460802cb7e2263acee04a049c29b60d462`. The CLI-created forward migration
`20261013104931_xpay_payment_orders.sql` adds frozen owner-authorized orders,
immutable verified-paid observations (including payments held for review), the
webhook inbox, one-time commercial-period fulfillment and protected reconciliation
RPCs. It revokes every new manual subscription notice/private redemption and
proof reservation grant, and disables only the billing evidence INSERT policy.
Historical notice review, evidence reads/signing and catalog/POS behavior remain.
No hosted migration is applied.

Three Edge Function entry points are implemented: `shop-xpay-checkout`,
`shop-xpay-webhook`, `shop-xpay-reconcile`. Checkout has platform JWT verification
plus an actual Auth lookup, confirmed-email/anonymous checks and the owner RPC.
Webhook verifies raw bytes and then retrieves the session from XPay; it persists
an inbox receipt before fulfillment and returns 503 on an incomplete worker so
provider retry remains possible. It does not acknowledge a failed write as paid.
Provider session projections sent to SQL omit customer details and client secrets.
Reconciliation processes at most four orders with two workers and never retries an
uncertain creation past 23 hours, inside XPay's 24-hour idempotency retention.
Unresolved money/creation remains visible for operator review, never fabricated
payment success or an automatic refund.

The verified payment receipt gives a narrowly bound transaction authority to the
existing subscription triggers. It retains the old bridge/admin approval path.
The first paid term begins immediately after verified payment during a trial and
preserves historical trial dates. Existing active renewals extend the agreed
period. Subscription, ownership, usage or scheduled-plan changes after quoting
hold the paid observation without overwriting access. A paid state cannot be
rolled back by a late unpaid/expiry event.

Configuration remains **not live**. In addition to the earlier server-only names,
prepare `XPAY_ENABLED=false` and `XPAY_API_VERSION=1.0`; enabling the runtime and
its private database configuration must be deliberate after merchant checks.
The accepted dashboard account is known to the parent, but do not infer the API
`merchantId`, chargeable methods, currency or fee/tax policy from the acceptance
email alone. Only keys for the chosen mode belong in its secret store. No actual
key is committed, read or created by this checkpoint.

Before activation, the operator must verify API compatibility, install the scoped
key/endpoint secret through the secure setup process, configure the exact private
merchant/mode row, register the webhook after deployment, and schedule the server
reconciliation endpoint using the existing Shop server credential. Configure
monitoring for its unresolved count, including unknown creations beyond the
provider retention window. Never clear a paid hold by editing financial history;
review the provider transaction and competing access change before an audited
operator decision. No live payment, refund, email or customer activation occurred.

Validation: 24 provider/HTTP contract tests pass; Deno 2.9.6 checks all three entry
points; Shop lint and workspace boundaries pass. Secret-free GitHub-hosted
[SQL run 38390751728](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/38390751728)
passed all current rollback-only fixtures and a race between two independent
PostgreSQL workers: one payment, one paid observation and one commercial period.
[Review run 38390751695](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/38390751695)
passed. Earlier fixture failures were corrected; no failed check was waived.
These use synthetic provider results, not a real merchant sandbox payment.

SAS #276 at `9da7c4a6d65c50913e2428b0ad95763b9319bd9f` was inspected read-only.
Its signed bridge, `platform_plan_command` trial activation and secure account
provisioning functions are untouched. Its migrations precede this one; the XPay
subscription trigger still retains its bridge principal authority checks. The
integration owner must run the combined-head SAS and XPay fixtures together.

The customer capability and scheduling implementation below supersedes the
backend checkpoint's remaining code work. Merchant setup, real provider sandbox
verification, monitoring and combined SAS/XPay verification remain gates.


## Customer checkout and scheduling checkpoint

Branch `codex/shop-suit/xpay-customer-checkout`, parent #279 at
`6f26f4b91f37f528389d9c00f2a4a3adfb27a4ac`. Product orchestration is in Shop's
billing page and validated DTO/storage helpers; shared presentation remains in
`packages/ui`.

Owners can pay immediately during trial. The API freezes the authoritative quote
before the browser confirms the exact server amount/plan and opens the validated
provider URL. A redirect, cancellation query or browser flag never grants access.
Saved orders survive missing responses; retries reuse an owner/shop/selection
request ID. Private redemption tokens remain in transient memory, never storage.
Pending/review orders block another charge, and checkout history preserves the
actual server amount. Bounded 15-second polling (at most 20 attempts) and manual
status refresh stop when the owner context changes. Test checkout is visibly
labelled. Only server paid fulfillment refreshes the subscription; its historical
trial dates remain intact.

Availability uses documented [GET /account](https://docs.xpay.app/openapi.json):
merchant ID, mode, key type/read+write permissions, EGP minor units, supported
payment methods and live payment activation all must match. Both database and
Edge configuration must be enabled. Exact project/origin/mode mappings are
mandatory: `jvvelvftpfnlogalgxgv` + `https://stg.shop.building-suit.com` + test;
`fgdzjnsbcxfbiuogbmom` + `https://shop.building-suit.com` + live. Production
cannot grant access from test payments. No new application secret is required.

Migration `20261013115916_xpay_checkout_readiness_scheduler.sql` installs the
supported [Supabase Cron/pg_net/Vault pattern](https://supabase.com/docs/guides/functions/schedule-functions).
It registers no job, stores no secret and sends no HTTP request on deployment.
Secure deployment steps, outside this task's authorization:

1. Apply migrations and deploy the three Edge Functions to the intended project.
2. User/operator securely configures the existing documented XPay environment
   variables, merchant database configuration and provider webhook endpoint.
   Do not put credentials in chat, browser, repository or plaintext job commands.
3. In that project's Vault, securely create `shop_xpay_project_url` containing its
   registered Supabase HTTPS URL and `shop_xpay_server_key` containing the same
   existing `SUPABASE_SERVICE_ROLE_KEY` used by the Edge runtime. The key is
   needed only for the existing server-authorized reconciliation endpoint.
4. Through a securely authenticated operator/service action, call
   `shop_xpay_schedule_reconciliation(true, '<registered-project-ref>')` to
   register the five-minute job. Calling it with `false` pauses that same job.
   Registration rejects missing Vault configuration or a mismatched project URL;
   the job body contains only `select shop_private.xpay_scheduled_request();`.
5. Complete real provider sandbox checkout and signed-webhook verification,
   duplicate delivery, pending/expiry and uncertain-create reconciliation. Enable
   live mode only in the production mapping after actual provider activation.
   Configure operator monitoring for failed jobs/inbox and `requires_review`.

The current automatic customer flow stays as requested. The later ambiguous
"manual by hand" instruction has not been treated as authorization to restore
manual customer transfer or receipt approval; merchant setup interpretation still
needs parent/user clarification. No hosted migration, secret, job registration,
provider account change or real payment was performed here.

Validation for this checkpoint: 51 focused unit/contract tests, Shop typecheck,
lint and production build, strict workspace boundaries and all three Deno Edge
entry-point checks passed. Browser and disposable SQL results are recorded in
the PR after completion. The private-offer SQL fulfillment contract inherits
#279 but a full signed-bridge/private-offer payment scenario remains unrun; the
integration owner must run combined SAS/XPay checks before staging merge.

## International subscription currencies (2026-10-18)

See [the currency contract, fixed matrix and verification plan](international-subscription-pricing.md).
EGP/USD comparison and explicit selection are implemented. Orders and receipts
retain commercial currency alongside immutable EGP processing/FX evidence.
Proration/credit and reviewed refund observations stay currency isolated.
USD charging remains disabled by private/runtime gates and still requires
account-specific USD/card capability and sandbox verification. No live USD
payment, refund or provider configuration is performed by this task.
