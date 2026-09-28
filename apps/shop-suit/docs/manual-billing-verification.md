# SS-BILLING-001 — Manual subscription verification

New Shop Suit subscriptions receive one 14-day trial. The catalog/default changes
forward; existing `trial_start_at` and `trial_end_at` values are not shortened.
Platform operators can explicitly extend/end exceptional trials through audited
commands.

`/billing` is owner-only. It shows the derived access state, exact trial/period
deadline, remaining trial days, current usage, operator-configured InstaPay
instructions, and payment-notice history. An owner submits expected/paid amount,
transfer date, and transfer reference through an idempotent RPC. Submission never
changes subscription access.

`/platform-admin` has a billing queue. Explicitly provisioned operators can mark a
notice under review, reject it with a reason, or record externally verified
received details and approve a duration. Approval locks the notice and updates the
subscription in one transaction. A replay returns the original result; another
approval cannot extend it again. All configuration/review commands append immutable
actor, reason, parameters, and before/after evidence.

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
