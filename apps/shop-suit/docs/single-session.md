# Shop single-session readiness — SS-LAUNCH-SINGLE-SESSION-001

Decision SS-LAUNCH-D06 / requirement SS-LAUNCH-R11: newest login wins for one
user account. This does not prevent sequential credential sharing.

## Separate implementation and provider status

- Shop handling: implemented; `session-loss.client.ts` handles provider
  `SIGNED_OUT`, including permanent invalid-refresh errors emitted by the SDK.
  It immediately resets Shop state/cookies, invalidates pending Shop reads,
  clears `shop-data:` and `platform-admin:` async caches, discards confirmation,
  toast and onboarding state, and replaces protected navigation with login.
  Protected pages are removed while anonymous, discarding page-local drafts.
  Account/tenant changes retain the existing context-key remount and cache cleanup.
- Provider configured: **not verified / not enabled by this task**.
- Provider availability: **unavailable on current Free plan**. Read-only MCP
  `get_organization(id=rfolwdswbxddqtqaombc)` returned `plan=free`,
  `tier=tier_free` on 2026-10-10. Read-only `get_project` confirmed staging
  `jvvelvftpfnlogalgxgv` and production `fgdzjnsbcxfbiuogbmom` both belong to
  that organization. Auth configuration is not exposed by these tools, so no
  setting value is claimed. No provider configuration or database write occurred.
- Launch enforcement: **blocked** pending separately authorized eligible plan
  and provider configuration, followed by real-provider two-device evidence.
  Local executable tests verify application behavior using synthetic transport;
  they do not prove hosted enforcement or satisfy that external gate.

## Provider semantics and operator verification

[Supabase sessions](https://supabase.com/docs/guides/auth/sessions) documents
single-session control on Pro and higher. The most recent sign-in wins, with
checks performed at refresh. Already-issued JWTs can remain valid until expiry;
this implementation makes no instant server-revocation claim and adds no
alternate session registry. Network/retryable refresh failures are not logout.
The installed SDK preserves an unexpired access token after a permanent
proactive refresh rejection. When the JWT has expired, the same rejection clears
credentials and emits SIGNED_OUT; Shop clears immediately on that event. The
SDK unit test exercises both states with a controlled clock. The SDK owns
refresh scheduling, credential removal and SIGNED_OUT delivery.

Before any separately authorized provider change, re-inspect immutable project
refs, active subscription and Auth session settings read-only. Record the actual
single-session value and JWT expiry for each environment. After configuration,
use two isolated browsers with a disposable test identity: sign in A, sign in B,
refresh A and verify permanent rejection, cleanup and login; refresh B and verify
it survives. Also verify another account remains unaffected and that signing in
on A again reverses the winner. Record environment/ref and observed refresh/JWT
semantics. Do not run write fixtures against hosted business databases.

## Logout scope

Shop's normal and platform-admin logout and invitation account-switch logout
explicitly use `scope: 'local'`: only the current user's current session is ended.
No forced-loss handler calls global logout, so an older rejected client cannot
terminate the winning login. [Supabase signout](https://supabase.com/docs/guides/auth/signout)
documents `global` (all sessions for that user) and `others` (all except current).
Shop offers neither as an implicit normal logout. No scope affects other users.

Documentation checked 2026-10-10, including the current HTML changelog. The
markdown changelog fetch was unavailable (web content-type error; shell DNS
failure). No applicable Auth session breaking change was found in recent entries.

## Local verification record (2026-10-10)

- Each required executable ran successfully:
  `node --test apps/shop-suit/tests/unit/ss-launch-single-session-001-1.test.mjs`,
  `node --test apps/shop-suit/tests/unit/ss-launch-single-session-001-2.test.mjs`,
  `node --test apps/shop-suit/tests/unit/ss-launch-single-session-001-3.test.mjs`.
- Full Shop regression: `node --test apps/shop-suit/tests/unit/*.test.mjs`
  succeeded, 40 files / zero failures. The installed SDK test verifies permanent
  rejection before/after JWT expiry without any network transport.
- Required quality command:
  `pnpm exec turbo run typecheck lint build --filter=@building-suit/shop-suit`
  succeeded. Lint reported 17 existing attribute-order warnings; build warned
  about absent local Supabase credentials and Turbo shared-cache filesystem
  permissions. None caused a nonzero final exit.
- Required browser command:
  `pnpm exec playwright test --config apps/shop-suit/tests/e2e/ss-launch-single-session-001-2.config.ts --workers=1 --retries=0`
  failed before test execution: sandbox denied binding `127.0.0.1:4438` with
  `EPERM`. Browser assertions remain **unverified**, including the synthetic
  two-context UI/cache flow. `--list` succeeded and discovered the declared spec.
- `git diff --check` succeeded. No Shop schema, migrations or DB runner changed;
  no database write tests were invoked.
- `pnpm agent:preflight` failed because GitHub/fetch state could not be verified.
  No branch/base change, commit, push, merge or deployment occurred.

These results do not replace the provider configuration / real-provider evidence
launch gate above. Independent verification needs a sandbox permitting local
browser-server sockets; the browser config builds Shop before serving it and
uses only the disposable synthetic provider on port 4438.
