# SS-BILLING-001 — Manual subscription verification

New Shop Suit subscriptions receive one 7-day trial. The catalog/default changes
forward through a new immutable commercial-terms version; existing `trial_start_at`
and `trial_end_at` values and prior 14-day terms are not changed.
Platform operators can explicitly extend/end exceptional trials through audited
commands.

`/billing` is owner-only. It shows the derived access state, exact trial/period
deadline, remaining trial days, current usage, operator-configured InstaPay
instructions, and payment-notice history. An owner chooses an available plan and
submits the paid amount, transfer date, and transfer reference through an
idempotent RPC. The notice freezes the requested plan/catalog term, interval,
currency, list price, effective negotiated price, and resource limits. Submission
never changes subscription access.

`/platform-admin` has a billing queue. Explicitly provisioned operators can mark a
notice under review, reject it with a reason, or record externally verified
received details and approve exactly one frozen catalog interval. Approval locks
the notice, all quota resources, and the subscription in one transaction. A replay
returns the original result; another approval cannot extend it again. A target plan
with live over-limit resources is rejected. Amount mismatches require a separate
override reason in the immutable audit parameters.

Operators may append a subscription-specific founder/negotiated price with a
reason, effective date, currency, and optional expiry. Overrides never mutate the
global plan catalog and cannot be edited or deleted. The active override is frozen
into a new notice; an expired override is retained as evidence but is not quoted.
The billing queue shows current/requested plans, list/effective prices, transfer
reference, interval, and live quota blockers.

InstaPay is presented only as a transfer channel. There is no Shop Paymob checkout,
webhook, IPN, automatic bank verification, or customer self-activation. Proof
attachments are intentionally omitted until a reviewed private Storage contract is
available.

Local verification:

```sh
pnpm db shop-suit start
pnpm db:test:shop
pnpm --filter @building-suit/shop-suit typecheck
pnpm --filter @building-suit/shop-suit lint
node --test apps/shop-suit/tests/unit/billing.test.mjs
```

Browser verification should cover owner/employee denial, English/Arabic and
LTR/RTL, exact expiry, instruction-empty/configured states, safe retry, review
transitions, rejection reason, and approval refresh. Use only disposable local
identities and transfers.
