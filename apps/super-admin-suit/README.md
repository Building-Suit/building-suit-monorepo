# Super Admin Suit

Run this checkout with `pnpm dev:super-admin --current`. The product uses shared
Building Suit auth forms, access-state surfaces, settings and application shell.
Runtime operational navigation and configuration remain database-owned; no
Suit registry, target connection or owner identity is embedded in the app.

## Provisioned identity and sessions

Sign-in uses this environment's independent Super Admin Supabase Auth project.
Public signup is disabled. An Auth account alone does not grant platform access.
Provisioning requires a `public.platform_admins` record tied to that project's
`auth.users.id`, an authority environment, a provisioning actor and an enabled
owner role. Provisioning is an operator-controlled database operation, never a
browser command or metadata update. No identity is linked by email or inherited
from a target Suit or tenant membership.

`GET /api/session` validates the session with Auth `getUser`, then invokes
`super_admin_session` under the user's JWT. It returns only the provisioned
identity projection and sends `private, no-store`. Each request checks the
current enabled record. The existing configuration read/command RPCs independently
repeat that database check; a successful UI session is not an authorization
cache for writes. Disabling the record denies subsequent RPC calls using the
same JWT, without app deployment or token renewal. Metadata, role selectors and
Suit selectors are never inputs to authorization.

The shared auth module maintains rotating sessions using host-only,
SameSite=Lax cookies with `bs-super-admin-<APP_ENV>-auth-token`. Non-local cookies
require HTTPS. A mismatched build-time cookie prefix is rejected; deployment
runtime overrides must also match the independent environment prefix. No
service-role key is used by the application. Authority is cleared on auth events,
rechecked on focus, and removed before sign-out. Passwords are not persisted.
Denied and unavailable states offer retry and sign-out in English and Arabic.

## Production release gate

Production release remains blocked until strong authentication is configured
and verified for every enabled operator, with server/database enforcement of
an acceptable MFA assurance level on **all** privileged reads and commands.
This task's password sign-in is local/staging functionality, not evidence that
the production strong-auth gate is satisfied. Also verify independent project
refs, HTTPS host-only cookies, namespace overrides, disabled signup and session
revocation before any separately authorized release. No hosted configuration
is changed by this implementation.

## Local verification

From the repository root:

```sh
node --test apps/super-admin-suit/tests/unit/*.test.mjs
pnpm --filter @building-suit/super-admin-suit test:unit
pnpm test
pnpm exec turbo run typecheck lint build --filter=@building-suit/super-admin-suit
pnpm --filter @building-suit/super-admin-suit exec playwright test tests/e2e/auth.spec.ts --workers=1 --retries=0 --repeat-each=2
git diff --check
```

From `apps/super-admin-suit`, on an explicitly disposable local backend:

```sh
pnpm exec supabase start
pnpm exec supabase db reset --local
pnpm exec supabase test db --local
pnpm exec supabase db advisors --local --type all --level info --fail-on warn --output-format json
```

The entire local database suite covers outsiders, disabled/enabled owners,
unchanged-JWT revocation, privileged writes, configuration versions and secret
isolation. Browser specs use controlled session responses to verify presentation
and keyboard states in English/Arabic, desktop light and mobile dark; they do
not establish real Auth/backend login or refresh acceptance. Those flows require
a running disposable backend with provisioned synthetic accounts.

The SAS-M1-AUTH-001 verification obligations map to these existing checks:

| Obligation | Executable evidence |
| --- | --- |
| Outsider, disabled admin and enabled admin database/RLS authorization | `supabase/tests/configuration_authority.sql` and `supabase/tests/identity_revocation.sql`, run by `pnpm exec supabase test db --local` from this app. |
| Auth/session unit tests and browser denial/success coverage | `tests/unit/auth.test.mjs`, run by `node --test apps/super-admin-suit/tests/unit/auth.test.mjs` from the repository root; `tests/e2e/auth.spec.ts`, run by the exact browser command above. The app-root Playwright config discovers the existing suite and starts its local production server. |
| JWT/metadata claim-authority review | The `claim authority and cookie boundary source review` unit test checks verified Auth identity, database authority RPC, no metadata/selected-Suit authority path, and cookie boundaries. Behavioral unit tests deny an authenticated metadata-bearing outsider and recheck disabled authority; the SQL suites independently exercise forged metadata and unchanged-JWT revocation. |

These checks remain required. Control-plane verification owns resolution of its
planned-test registrations and independent final acceptance.

`tests/auth-verification-registration.json` supplies the proposed control-plane
registration patch for the three blocked SAS-M1-AUTH-001 obligations. It is
review input, not automatically loaded application configuration. Merge its
commands by name and its mappings by exact obligation text into the existing
workstream verification configuration, preserving all other checks and the
registered local database start/reset/test commands. The database mapping uses
the existing required `super-admin-database-tests` registration. The unit and
claim-review registrations execute the existing behavioral and source-review
tests; the browser registration preserves the exact repeat/retry command.
Applying this patch and independently rerunning verification belong to the
control plane. Until that registration changes, its three `planned_test`
blockers remain unresolved even if the corresponding local tests pass.

## Registry navigation (SAS-M1-REGISTRY-001)

`GET /api/registry` verifies the current Admin identity and reads the `registry`
resource of `super_admin_configuration_read`. Its private SQL projection returns
only localized display metadata, canonical local asset references and permitted
navigation descriptors. It omits endpoints, audiences, environment identifiers,
secret references and executable route/component names. Empty configuration has
no source-owned fallback. All configuration comes from this Admin database;
there is no access to target Suit databases.

The forward migration adds `suit_registry.sort_order`; use the existing audited,
versioned configuration command's `sortOrder` payload for changes. Rail order uses
that value then the stable key. Only active Suits on contract `1.0` with an active
binding in the operator's authority environment and active target environment
appear. Context order uses navigation order then stable key. Both `en` and `ar`
metadata are supported, falling back to available localized text.

The reviewed generic module descriptors currently supported are `overview`
(no required capability) and `capabilities` (requires
`adapter.capabilities.read` version `1.0`). Both require an empty route descriptor
and either empty visibility policy or `{"role":"owner"}`. Other module,
visibility, route and capability descriptors fail closed. Capability contexts
also require active adapter registration, protocol/schema `1.0`, an enabled
policy with exact `1.0` bounds and the `adapter.capabilities.read` query scope.
The latest manifest observation must be verified, unexpired, within the adapter's
freshness interval and advertise protocol `1.0` plus a capability entry shaped
as `{"key":"adapter.capabilities.read","version":"1.0","queryScopes":["adapter.capabilities.read"]}`.
No older verified manifest replaces a newer rejected one. This is a conservative
version contract; extending supported versions/modules requires reviewed logic.
The capability context shows pending availability and supplies no dispatch
controls; adapter execution is outside this task.

The page composes the rail and selected context through the existing shared
`BsAppShell` context slot, reusing its narrow-screen drawer, keyboard trap,
Escape handling and focus return. This checkout does **not** contain the linked
BS-SA-SHELL-001 dedicated two-chamber shared template. That dependency must be
reconciled before claiming acceptance against that specific shared shell.
No shared package was changed under this app-only task's allowed paths.

Selection uses `/?suit=<stable-key>&item=<stable-key>` so reload, back/forward and
shared deep links resolve against current authorized data. An explicit removed
or inaccessible key stays denied; it never silently selects another Suit. With
no explicit Suit, the first available row is selected. Reads refresh on session
recheck/focus and every 30 seconds while visible, or immediately through the
reload action. Pending/error reads remove previous navigation; auth transitions
and sign-out clear registry data and cancel outstanding reads.

Required local verification includes the **entire** app unit suite and quality
command above, `pnpm check`, `pnpm test`, and the entire local SQL suite after an
explicit disposable reset. Regenerate `app/types/database.types.ts` from the
reset local schema; the added `sort_order` field is not yet in the checked type
artifact and must not be patched manually. The app currently uses the existing
JSON-returning configuration RPC contract, so this does not prevent typecheck.
Run the task browser spec plus the changed auth regression spec:

```sh
pnpm --filter @building-suit/super-admin-suit exec playwright test tests/e2e/registry.spec.ts --workers=1 --retries=0
pnpm --filter @building-suit/super-admin-suit exec playwright test tests/e2e/auth.spec.ts --workers=1 --retries=0 --repeat-each=2
```

The registry browser suite covers two data-driven Suits, active rail/context
indicators, selection changes, deep links, back navigation, metadata/order/menu
refresh, unknown descriptors, loading/error/denied/empty states, keyboard focus,
English/Arabic and desktop light/mobile dark. Controlled endpoint fixtures prove
presentation only. `supabase/tests/registry_navigation.sql` independently covers
real database projection, scoped capability denial, latest-manifest rejection,
retirement, authorization and audited ordering. Browser screenshots are written
to `/tmp/sas-registry-*` only when the suite executes successfully.

## Shop adapter (SAS-M1-SHOP-ADAPTER-001)

`POST /api/adapters/shop` accepts only `bindingId`, a reviewed protocol
`operation`, UUID `requestId`/`correlationId`, `reason` (null for queries;
8–1000 characters for commands), and an object `payload`. It checks Admin Auth
and current database authority, then enqueues an immutable dispatch under that
user's JWT. The database resolves the active environment pair, registration,
capability policy, latest fresh verified manifest, provider, integration policy
and Vault reference. Missing, disabled, stale and incompatible data fail closed.
The current protocol supports 1.0 and same-kind environment pairs only.

Provision the existing configuration tables through their audited commands.
For each binding, the active provider's `adapter-dispatch-policy` object setting
(schema 1.0) supplies `targetBindingId`, `timeoutMs` and `maxResponseBytes`.
The binding's base URL is the HTTPS origin; `egress_policy.allowedHosts` lists
exact permitted hostnames. `adapter-signing` secret references select the newest
active key version. The referenced Vault value is unpadded base64url HMAC material
of at least 32 bytes, matching the separately provisioned Shop verifier.
Manifest observations use the Shop bridge capability shape
`{"operation":"<operation>","version":"1.0"}`. Scope policy must explicitly
permit each operation. No target service-role credential is used.

Only the server uses the **Admin project's** service credential for narrow
claim/complete RPCs. Vault material remains inside private database helpers;
only a transient per-attempt signature reaches the server transport. DNS answers
must all be public IPv4 addresses; the validated address is pinned for the TLS
connection. The transport validates hostname certificates, bounds time/response
size and follows no redirects. IPv6 egress is conservatively unavailable.

Verified responses echo the exact envelope and request digest and have a checked
HMAC. Raw target errors are discarded; the client receives stable error codes
and request/correlation IDs. Lost/unsigned/tampered responses are
`outcome_unknown`. Retry the same input and request ID to obtain a fresh nonce;
never invent a compensating command. Envelopes, configuration versions,
nonces, key-reference metadata and safe outcomes remain append-only in protected
Admin dispatch/attempt tables; target audit IDs join successful Shop outcomes.
No payload, signature or secret is logged. Registry UI is unchanged.

Verification:

```sh
node --test apps/super-admin-suit/tests/unit/sas-m1-shop-adapter-001-1.test.mjs
node --test apps/super-admin-suit/tests/unit/sas-m1-shop-adapter-001-4.test.mjs
node --test apps/super-admin-suit/tests/unit/*.test.mjs
pnpm exec turbo run typecheck lint build --filter=@building-suit/super-admin-suit
pnpm exec playwright test --config apps/super-admin-suit/tests/e2e/sas-m1-shop-adapter-001-2.config.ts --workers=1 --retries=0
pnpm db super-admin-suit test db --local
git diff --check
```

The browser test inspects real unauthenticated endpoint responses, loaded assets
and browser requests with a synthetic server-secret sentinel. Configured
transport/results use unit fixtures; SQL authorization, Vault signing and
configuration rejection are independently covered in
`supabase/tests/shop_adapter_dispatch.sql`. Actual authenticated Shop round trips
require provisioned disposable databases and verified matching integration
configuration. No hosted setup is implied by these local checks.

## Manual transfer control (SAS-M1-INSTAPAY-001)

The reviewed `manual-transfer` navigation module composes the shared settings
form and record dialog in the existing page. Provision navigation through the
existing audited configuration command, with empty route descriptor, owner
visibility and required capability `shop.billing.query` version `1.0`. No rows
or payment values are seeded. Its binding is projected only when exactly one
active binding in the operator's environment passes the dispatcher's policy,
manifest, signing and environment checks for both billing query and command.

The control reads `shop.billing.query` with `{resource: "manual-transfer"}` and
expects `data.configuration` to be null or the versioned presentation record:
`{version, enabled, recipientAlias, recipientDetails, instructions: {en, ar},
paymentLink, qr: {assetUrl, alt: {en, ar}}}`. Payment and QR URLs must use HTTPS
without embedded credentials. Missing, incomplete or disabled records expose no
payment preview. The form has no invented recipient, enablement or instructions.
InstaPay is presented as a manual transfer channel, with manual payment review.

Writes use `shop.billing.command` with `{action: "configure-manual-transfer",
expectedVersion, configuration}` and an operator reason. An unconfirmed save
retains identical request/correlation IDs and payload for retry; its fields are
locked until closed. Signed success must contain `targetAuditId`,
`targetResultVersion` and `data: {configuration, before, after}`. The migration
requires a closed presentation evidence schema, matching submitted values,
expected before version and exactly the next after version. It records actor,
reason, Suit/environment, binding, request/correlation IDs and safe before/after
in the immutable Admin audit, linked to the Shop audit. Unsigned/invalid/missing
evidence remains an unknown outcome.

**Target integration gate:** The inherited published Shop adapter contract does
not declare this manual-transfer resource/action. These are the explicit
Super Admin side contract for this control, not evidence of an implemented Shop
handler. The target-owned bridge must implement or confirm these bounded
contracts using Shop's configuration/audit authority and runtime Shop consumer.
No target internals, migrations, hosted databases or commercial state machines
were changed here. Real cross-project persistence and Shop runtime consumption
remain unverified until that target contract is available.

Task verification and execution limitations are recorded in
[tests/instapay-verification.md](tests/instapay-verification.md).

## Normalized activity — SAS-M1-AUDIT-001

Provision an enabled navigation row with `moduleKind: activity`, no required
capability, an empty route descriptor and the existing owner visibility policy
through the configuration authority. Labels, Suit selection and bindings remain
database records; this task seeds no navigation or connection settings.

The activity module composes `BsForm` and a read-only, lazy `BsDataTable`.
`GET /api/activity` authorizes the current Admin identity and queries Admin events,
command dispatch outcomes and observed Shop projections with server pagination,
exact Suit/environment/action/actor/target/request/correlation filters, time
bounds and ascending/descending time order. Source and environment are explicit.
No operational-history write or edit/delete control is exposed.

`POST /api/activity` retrieves one bounded audit page from a configured binding
and platform/billing/plan query stream through the existing signed adapter.
Supabase persists immutable normalized observations, verified command audit
correlations and the next retrieval page. Earlier verified target audit receipts
are backfilled into correlation state. Rejections can correlate to bridge audit;
only successful responses supply domain audit evidence. Unsigned/unknown outcomes
never supply correlation evidence. Concurrent cursor changes fail without
advancing the cursor. End-of-scan wraps to page one for later refreshes; offset
paging over a changing remote list does **not** establish complete coverage.

All remote coverage remains explicitly partial. The screen shows last observation
and failure timestamps, and remote failures remain visible alongside local data.
Reasons are masked in full; payloads, snapshots, provider information and arbitrary
actor/target text are excluded from this support projection. Original immutable
records remain with their authority. Browser roles have no direct privileges on
the new tables; privileged persistence and response verification stay server-side.

Verification commands and current limitations are recorded in
[activity verification](tests/activity-verification.md). Apply the forward
migration and regenerate database types from a disposable Admin database before
independent database verification. This task does not change any Shop schema.
