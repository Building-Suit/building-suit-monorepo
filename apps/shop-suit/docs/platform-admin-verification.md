# SS-ADMIN-001 — Platform administration verification

The `/platform-admin` route is a separate Shop Suit operator surface. An
authenticated account receives authority only when its Auth user ID has been
explicitly provisioned in `public.platform_admins` by a trusted server/database
operator. Shop ownership, membership, profile metadata and browser state never
confer platform authority.

Roles are deliberately small:

- `observer` can use the fixed dashboard, Shop support and audit projections.
- `operator` can additionally use the bounded support, plan-catalog,
  subscription and billing command RPCs.

Do not expose a service-role key to the browser. Provisioning or disabling an
operator is an environment administration operation and must follow the Shop
database runbook and current authorization. The application contains no
provisioning UI and no tenant-impersonation capability.

## Supported controls

Every command requires a unique request ID and explicit reason. Successful
mutations atomically append actor, role, time, target, parameters, before/after
state and reason to `platform_admin_events`. Events cannot be updated, deleted
or truncated. Supported controls are Shop suspend/reactivate, trial extend/end,
subscription activate/extend/suspend, billing-metadata correction and append-only
support notes. No command edits sales, payments, purchases, inventory movements
or other operational history. Future membership inserts, changes and removals
also append before/after evidence to `shop_membership_events`; the admin support
view combines that evidence with available payment, stock and business-mode
events without granting direct access to those tables.

The Plans & subscriptions view uses `platform_plan_read` and
`platform_plan_command`. Catalog price/limit edits append a new effective-dated
`plan_catalog_terms` version; they never rewrite an approved period snapshot.
Availability changes are bounded separately, and referenced plans have no
delete control and are rejected by the database if deletion is attempted.
Customer plan changes share the atomic resource-limit engine: upgrades may be
immediate, downgrades default to the paid-period boundary, and exact blockers
are returned without deleting or archiving customer data. Renew, suspend, and
explicit immediate-switch operations are audited with before/after state.
Negotiated prices are append-only; removal appends a revocation rather than
editing the historical override.

Shop suspension is enforced by the shared database membership/permission
helpers. It blocks tenant reads and writes while retaining memberships,
locations, subscriptions and business history. Subscription expiry or
suspension continues to preserve authorized history reads while existing write
guards make the tenant read-only.

## Local verification

From the repository root with the disposable Shop Supabase stack available:

```sh
pnpm db shop-suit start
pnpm db:test:shop
pnpm --filter @building-suit/shop-suit typecheck
pnpm --filter @building-suit/shop-suit lint
```

`shop_platform_admin.sql` covers owner/outsider bypass denial, observer/operator
separation, cross-tenant projections, idempotency, immutable audit evidence,
suspension/reactivation, trial/subscription transitions, history preservation,
no direct operational-row edits and absence of an impersonation RPC.
`shop_plan_admin.sql` additionally covers catalog version scheduling,
historical-plan deletion denial, observer/operator plan permissions, downgrade
blocker parity, negotiated-price removal and immutable plan audit evidence.

For browser verification, use a disposable local operator identity provisioned
outside the browser, open `/platform-admin`, and verify English/Arabic, RTL/LTR,
mobile/desktop layouts, denial/loading/error/empty/success states and destructive
confirmations. Do not use hosted customer data for this check.
