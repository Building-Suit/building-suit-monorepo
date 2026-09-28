# LS-ADMIN-002 — Platform administration operations

Implements ADM-02, ADM-03, ADM-04, BILL-MAN-03 and SUP-03 under approved
LS-D-ADMIN. It builds on LS-ADMIN-001 without adding raw SQL, financial-history
editing, user impersonation, or authority derived from tenant roles.

## Operator roles and reads

Dedicated `platform_admin` identities can use the bounded commercial commands.
Existing `billing_operator` identities retain payment-review authority only;
`observer` remains read-only. Every identity must still have no organization
membership. Tenant owners/admins/accountants, forged Auth metadata, anonymous
callers and service-role clients do not gain operator authority.

`platform_admin_read` now accepts bounded `search` and `status` filters in
addition to offset/limit/target. Its fixed projections cover users,
organizations, memberships, subscriptions/effective access, manual payments,
support requests, operational status and operator audit. Searches never expose
Auth credentials, private metadata, provider payloads, tax data, or ledger
transactions. Each read records its actor, resource, target and query context in
the append-only operator audit.

## Bounded commands

- `platform_admin_review_payment` remains the LS-BILL-002 state machine. A
  platform admin or billing operator must provide the current evidence, reason,
  context and stable command UUID. Approval/rejection still cannot bypass stale
  evidence, provider conflicts or the purchased-period rules.
- `platform_admin_set_access` writes an operator access override. Suspension
  makes effective access `read_only`, preserving historical reads while product
  writes are denied by the existing database authorization core. Reactivation
  restores the provider-derived state. It never changes organization status,
  provider subscription fields, paid periods or financial rows.
- `platform_admin_correct_subscription` can correct only the plan/price pair of
  an existing **manual** subscription, keeping its billing interval, provider,
  provider reference, status and period unchanged. Paymob or other
  provider-managed subscriptions fail with `ADMIN_PROVIDER_CHANGE_UNSAFE`.
- `platform_admin_update_support` applies a validated support state transition
  or records a reminder request. Customer message/contact/subject fields are
  immutable. Until delivery is configured, reminders are retained with
  `reminder_delivery_status=not_configured`; no email delivery is claimed.

All commands authorize before target lookup, validate nonblank reason/context,
serialize stable command UUIDs, reject changed-payload reuse, and append actor,
reason, context, target, before/after snapshots and outcome to
`app.platform_operator_audit`. Failed unsafe/provider/state transitions are
also audited with unchanged snapshots. Operator commands do not update posted
transactions or manual-payment history except through the pre-existing audited
payment-review state machine.

## UI and verification

`/platform-admin` provides EN/AR search, filters, 50-row pagination, membership
inspection, current/effective subscription state, receipt review, access
suspend/reactivate, current/target plan correction and support state/reminder
controls. Mutation forms require explicit confirmation, reason and internal
case context. Provider-managed correction controls are disabled and the server
independently rejects those calls.

Safe local verification:

```sh
node apps/ledger-suit/scripts/test-manual-payment-embedded.mjs --generate-admin-contract
node --test apps/ledger-suit/tests/unit/*.test.mjs
pnpm --filter @building-suit/ledger-suit typecheck
pnpm --filter @building-suit/ledger-suit build
pnpm --filter @building-suit/ledger-suit exec playwright test -c playwright.admin.config.ts
pnpm check
git diff --check
```

The embedded runner applies the full migration chain to disposable PGlite and
runs the original billing/admin suites plus
`79_platform_admin_operations_test.sql`. Its provider schemas are shims; real
Supabase Auth/Storage and concurrent sessions still require an explicitly
disposable local Ledger backend. The browser suite mocks transport and validates
the operator journey, not backend authorization.
