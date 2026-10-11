# SS-SA-CUSTOM-OFFER-001 — Recipient-bound private offers

Shop extends its existing manual billing authority. An offer never creates a new
plan family or public purchasable catalog entry. Registration does not change
subscription access. Redemption creates one ordinary InstaPay notice; the existing
operator/bridge review and approval commands retain amount-mismatch reasons,
resource locks, quota blockers, idempotency, and immutable commercial periods.
No business records are deleted, archived, or reassigned to make an offer fit.

The authenticated Super Admin bridge exposes `register_private_offer` as a member
of `shop.billing.command`. It requires the existing signed envelope and reason,
with this nested domain payload:

```json
{
  "offerId": "<immutable offer UUID>",
  "offerVersion": 3,
  "shopId": "<Shop UUID>",
  "recipientUserId": "<Shop-local Auth owner UUID>",
  "targetBindingId": "<bridge target binding UUID>",
  "targetEnvironmentId": "<bridge target environment UUID>",
  "suit": "shop-suit",
  "expiresAt": "<finite future timestamp>",
  "planId": "<existing active Shop solo/team/multi family UUID>",
  "displayName": "Private annual agreement",
  "billingInterval": "annual",
  "currency": "EGP",
  "priceAmount": 123.45,
  "resourceLimits": {
    "active_locations": 1,
    "active_members": 2,
    "active_products": 250,
    "active_services": 50,
    "active_customers": 500,
    "active_suppliers": 50
  }
}
```

Intervals are `monthly` or `annual`. Prices must be positive exact two-decimal
Shop amounts; they are not Ledger minor units. All six limit keys are required;
null uses the existing unlimited-limit contract. Display names are bounded to
80 characters. Offer IDs identify immutable versions: changed commercial terms
require a new offer ID. Reusing an ID fails; exact bridge request retries return
the original registration result. The protected bridge audit records the signed
external actor, principal, request, correlation, reason, and Shop target.

After Shop authentication, the intended active owner calls
`redeem_shop_private_offer(p_request_id, p_offer_id, p_offer_version, p_shop_id,
p_target_binding_id, p_target_environment_id, p_paid_amount, p_transfer_date,
p_transfer_reference)`. Recipient authority comes from Shop Auth and active
membership, never email or user metadata. The RPC returns the billing notice UUID.
Existing owner billing reads and operator billing queues show its frozen terms.
This task adds the backend contract; it does not add an offer-entry UI.

Offer redemption and notice insertion are atomic. The offer row serializes
redemptions, and the request uses the same lock as ordinary billing submissions.
Exact retries return the same notice, including after expiry or approval.
A changed payment or new request for a consumed offer raises
`SHOP_PRIVATE_OFFER_ALREADY_REDEEMED`; an unconsumed expired offer raises
`SHOP_PRIVATE_OFFER_EXPIRED`. Wrong versions/bindings raise
`SHOP_PRIVATE_OFFER_BINDING_MISMATCH`; wrong recipients/shops raise
`SHOP_PRIVATE_OFFER_RECIPIENT_MISMATCH` after owner authorization.

The private immutable catalog term links back to the immutable offer and is
excluded before public offer ranking. Its price and all resource limits are
frozen into the notice and the approved commercial period. Existing negotiated
price overrides do not replace the private redemption price. Private terms
cannot be purchased by another owner through ordinary catalog selection or
transplanted to another subscription. Later renewals of an activated subscription
retain the existing Shop renewal/override policy; expiry bounds first redemption.
Neither anonymous nor authenticated clients can read the private offer/receipt
tables or invoke the registration helper. Owners can retrieve their own notices
through existing billing RPCs. Evidence attachment and signed access use the
existing payment-evidence contract.

## Independent local verification

Use only the fixed disposable local Shop backend. The focused runner accepts no
hosted connection/ref and rolls back every fixture. It includes both the existing
bridge conformance test and the new offer lifecycle test. It does not replace the
full database regression.

```sh
pnpm db shop-suit migration up --local
node apps/shop-suit/tests/run-private-offers.mjs
pnpm db:test:shop
pnpm test
node --test tooling/database/tests/environment.test.mjs
pnpm exec turbo run typecheck lint build --filter=@building-suit/shop-suit
git diff --check
```

The focused SQL covers valid registration/redemption, wrong Suit/environment,
wrong version/recipient, expiry, exact retries, changed retries, public catalog
isolation, private-table privileges, frozen decimal prices and limits, quota
blockers, amount-mismatch reasons, manual review/approval, immutable snapshots,
one annual commercial period, and preserved active products.

Implementation-session results: Shop typecheck/lint/build and environment
isolation passed. `pnpm test` passed 70/71 files and failed the Git worktree tooling
file (two launcher subtests report `spawnSync /usr/bin/node EPERM`). `pnpm db:test:shop` and the focused runner failed before SQL execution because
Docker socket access was denied. The Supabase CLI also failed attempting a write
to its read-only home telemetry file; migration creation fell back to writing a
new forward migration, and advisor/type-generation evidence is unavailable.
Preflight could not verify fetch/GitHub state. Database acceptance is **unverified**
until both SQL commands exit successfully. No hosted database operations, commits,
pushes, merges, or deployments were performed.
