# Task 03 — Hosted `shop_crm` read isolation

Updated 2026-09-18. Target: Supabase project `jkdncdexqcymwbihwdhp`, schema
`shop_crm`. This is a security foundation, not a certified app workflow. The
shared project's `public` Building Suit tables were not migrated.

## Applied cloud migrations

The SQL is tracked separately from the incompatible historical `public` chain:

| Local SQL | Hosted migration version | Effect |
|---|---|---|
| `supabase/shop_crm_migrations/20260918171948_shop_crm_read_isolation.sql` | `20260918172351` | Private active-member/owner/permission helpers; 24 SELECT-only policies; RLS on all 24 tables; narrowed browser grants; invoker security on all 25 views; legacy Shop Suit RPC execution revoked; closed-period trigger references repaired |
| `supabase/shop_crm_migrations/20260918172432_shop_crm_private_trigger_grants.sql` | `20260918172444` | Let trusted `service_role` writes invoke the private period check through existing triggers |
| `supabase/shop_crm_migrations/20260918172641_shop_crm_legacy_function_paths.sql` | `20260918172654` | Pin the 16 existing public Shop Suit helpers to an empty search path; they remain unavailable to browser roles |

The separate files reflect fixes discovered while testing the cloud deployment.
Do not replay them through the disabled default `supabase/migrations` runner or
apply the pre-hardening schema baseline to this live project. The baseline and
JSON catalog snapshots are historical evidence from before these migrations.

## What the database now permits

Anonymous visitors can read only active Shop Suit portal fields and public active
plan catalog fields. Provider price identifiers are not granted. An authenticated
user can read their own profile and active-shop memberships; an active owner can
read their shop data and subscription. An active employee needs a matching role
permission for business data. Suspension or profile deactivation removes shop
access without waiting for the JWT to expire. Owner/employee history reads do not
depend on a current subscription; future controlled writes must enforce it.

There are no `anon` or `authenticated` INSERT, UPDATE, DELETE or TRUNCATE grants
on `shop_crm` tables/views. All 25 reporting views have `security_invoker=true`
and no browser SELECT grant. Existing public Shop Suit RPCs are also revoked from
browser roles because several still reference absent old `public` tables or have
incorrect business logic. The private helper schema is not exposed to the Data
API. Closed accounting periods are checked by the attached expense, invoice and
payment triggers for trusted writes.

## Verification

The cloud rollback fixture in `supabase/tests/shop_crm_read_isolation.sql` passed
after the final migration. It creates synthetic Auth users, profiles, two shops,
roles and products inside one transaction and ends with `ROLLBACK`; it left no
fixture rows. It verified owner cross-shop isolation and history read without a
subscription, employee denial then role-granted read, immediate suspension,
outsider denial, anonymous restrictions, browser mutation denial, and closed
period rejection for an expense, invoice and payment under `service_role`.

A full catalog check returned zero tables without RLS, zero non-invoker views,
zero relations with browser write grants, and zero report views with browser read
grants. The Supabase security advisor still reports 11 mutable-search-path and
11 anonymous/11 authenticated security-definer warnings, all associated with
the other application in this shared project, plus the shared leaked-password
protection setting. These were deliberately not modified for Shop Suit.

At this Task 03 checkpoint, the hosted Data API returned HTTP 406 `PGRST106`
for `Accept-Profile: shop_crm`, listing only `public` and `graphql_public`.
SQL grants and RLS alone did not expose the schema. Task 04c subsequently added
`shop_crm` through Supabase's documented role setting and verified anonymous
reads. That choice overrides Dashboard management of exposed schemas until
reset; see [Task 04c](04c-data-api-exposure.md) for the current state and
rollback. Authenticated owner and employee reads still require browser checks.

## Remaining work

The production permission catalog is empty. The fixture's `inventory.view`
permission and role were rolled back, so real employee features still need a
permission seed and management workflow. Same-shop foreign-key relationships
are not comprehensively constrained; direct browser writes are closed, and each
future controlled write RPC must validate tenant references and atomic business
rules. The current app still targets old names/RPCs and fails its preexisting
typecheck. No end-to-end shop operation, reports, plan enforcement, or sale-ready
behavior is certified by this task.

Next bounded step: expose `shop_crm` in the hosted Data API setting and verify
Supabase-client reads. Then repair the app contract without adding an API layer.
