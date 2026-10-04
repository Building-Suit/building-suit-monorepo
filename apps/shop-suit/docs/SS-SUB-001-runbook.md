# SS-SUB-001 — Shop plans commercial lifecycle runbook

This runbook is the operator contract for the approved Shop Suit plans system.
It covers the canonical catalog, manual InstaPay reconciliation, negotiated
pricing, downgrade blockers, expiry support, and local qualification. It does
not authorize deployment or a hosted-database change.

## Commercial policy

- New owners start a plan-neutral, full-product trial and choose a paid plan later
  from Billing. The idempotent owner-bootstrap command creates exactly one
  subscription and one 7-day trial. A retry returns the first Shop and cannot
  replace its operating mode or trial.
- The public launch catalog is Solo (EGP 349/month or EGP 2,847.84/year), Team
  (EGP 699/month or EGP 5,703.84/year), and one Multi family with two-branch
  (EGP 999/month or EGP 8,151.84/year) and three-branch (EGP 1,199/month or
  EGP 9,783.84/year) variants. Yearly prices are exactly 32% below monthly × 12.
  The authoritative variant, interval, price, and limits are the selected
  immutable `plan_catalog_terms` offer, not copy in a page or this document.
- Basic and Pro are grandfathered historical plans. They stay attached to
  existing subscriptions and remain hidden from new purchase.
- InstaPay is a transfer channel. An owner submits a transfer notice; an
  explicitly provisioned platform operator compares it with an external bank
  statement and records the result. No Paymob checkout/webhook, automatic bank
  or InstaPay verification, or customer self-activation is supported.
- Upgrade entitlements change only after approval. A normal downgrade is
  scheduled for the next paid boundary; an immediate change is an explicit
  operator choice. Every path validates current usage and preserves data.
- Expired or suspended subscriptions are read-only for business mutations.
  Authorized history and subscription/reactivation access remain available.

## Operator roles and access

Use `/platform-admin` only with an identity provisioned in
`public.platform_admins`. Tenant membership never grants platform access.

- Observer: read catalog, customer subscription state, billing queue, and audit.
- Operator: observer access plus the bounded audited commands described below.
- Shop owner: read their subscription, usage, available plans, notices, and
  submit a manual transfer notice.
- Employee: no owner billing view and no platform administration.

Never place a service-role key in the browser or use user-editable Auth metadata
to provision platform authority.

## Create or change plan terms

1. Open **Platform administration → Plans & subscriptions**.
2. Confirm the intended plan, current immutable version, visibility, purchase
   state, and subscriber count.
3. Choose **Publish new version**. Enter display name, interval, currency, whole
   EGP list price, all four resource limits, effective time, and a reason.
4. For a future change, use a future effective time. Existing approved notices,
   commercial periods, and historical plan versions are not rewritten.
5. Change availability separately. Purchasable requires public; coming-soon and
   inactive plans cannot be newly selected. Referenced plans are never deleted.
6. Review the appended platform-plan audit event before announcing the terms.

## Provision or revoke negotiated/founder pricing

1. Open the customer support view and its plan controls.
2. Choose **Set negotiated price** and enter the positive amount, `EGP`, effective
   time, optional expiry, and the signed commercial reason/reference.
3. Confirm the customer view shows the effective price and the unchanged list
   price. A new notice freezes both values and the override identifier.
4. To end the agreement, use **Remove active override** with a reason. Removal
   appends a revocation; it never edits or deletes the original override.
5. Verify the global catalog list price and other customers were not changed.

## Approve an InstaPay transfer

1. Confirm the operator-configured recipient instructions shown to owners are
   current. Do not interpret the payment link or QR as automatic verification.
2. In **Billing queue**, match Shop, requested plan, interval, list/effective
   price, paid amount, date, and transfer reference against the external bank
   statement. Mark under review when investigation starts.
3. Resolve every usage blocker before approval. Never delete or silently archive
   customer data to make a plan fit.
4. Enter received amount, bank reference, date, and a reason. If received, paid,
   and quoted amounts differ, record the explicit mismatch reason.
5. Confirm **Approve and activate** once. Retrying the same request ID returns the
   original result; it cannot add another period. A different request cannot
   approve an already terminal notice.
6. Verify the exact requested plan, one catalog-term extension, immutable
   commercial-period snapshot, and one approval audit event.

## Resolve a downgrade blocker

1. Read the blocker resource, used count, target limit, and excess in the owner
   or operator plan comparison. The enforced resources are active locations,
   members (including reserved invitations), products, and services.
2. Ask the owner to archive/deactivate or otherwise legitimately reduce active
   usage. Do not remove historical invoices, stock, memberships, catalog rows,
   or locations from storage.
3. Refresh the quote; approval remains blocked until every current count fits.
4. Apply an ordinary downgrade at the renewal boundary. Use immediate only when
   an explicit operator decision requires it, and record the reason.
5. Verify the target entitlement and that archived/inactive history is intact.

## Support an expired or suspended customer

1. Confirm the subscription access state is read-only and distinguish it from a
   suspended Shop. Do not infer state from a hidden client button.
2. Confirm authorized historical data, exports, usage, billing notices, and audit
   remain readable. Reproduce one representative business write denial.
3. Reconcile the reactivation/renewal transfer externally. Use the plan or billing
   command appropriate to the recorded notice, with a unique request ID/reason.
4. Confirm access is active, the correct period/plan is effective, and a normal
   business write succeeds. Compare retained record counts before and after;
   reactivation must not rewrite customer history.

## Local qualification gate

Use only the disposable local Shop backend:

```sh
pnpm db shop-suit start
pnpm db:test:shop
pnpm --filter @building-suit/shop-suit typecheck
pnpm --filter @building-suit/shop-suit lint
pnpm --filter @building-suit/shop-suit build
node --test apps/shop-suit/tests/unit/*.test.mjs
pnpm exec playwright test apps/shop-suit/tests/e2e/plan-owner.spec.ts apps/shop-suit/tests/e2e/subscription-lifecycle.spec.ts -c apps/shop-suit/playwright.config.ts --workers=1 --retries=0
pnpm check
```

`pnpm db:test:shop` is the full locally safe regression. It includes catalog
reimport/legacy fixtures, the integrated lifecycle, authorization checks, all
four quota races, billing approval concurrency/idempotency, and first-barber
supporting domains. Do not replace it with only the new SQL file.

Record the candidate SHA and actual result of every command in
[the verification record](SS-SUB-001-verification.md). Keep these states distinct:

- **Code implemented**: source and repeatable acceptance fixtures exist.
- **Automated tests passed**: the exact commands ran successfully for this SHA.
- **Manually verified**: a named person/device/environment performed the checklist.
- **Deployed**: the verified SHA and migration versions reached a named environment.
- **Commercially approved**: the product owner approved sale; technical evidence
  alone never implies this state.
