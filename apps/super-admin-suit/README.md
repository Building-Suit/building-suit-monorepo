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
