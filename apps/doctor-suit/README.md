# Doctor Suit synthetic browser preview

Generated with the maintained `pnpm new:platform doctor-suit "Doctor Suit"` starter after inspecting its dry run. The original scaffold is DOS-M1-002. DOS-M1-006 adds a gated synthetic account lifecycle; the visible preview scope disclosure is not an account-creation success.

Run the root `pnpm install --frozen-lockfile`, `pnpm run setup`, then `pnpm dev:doctor`. That command serves the current checkout deliberately on loopback port 3006. Use the Doctor feature worktree when reviewing this app. The chosen app port 3006 and browser port 4336 did not appear in existing environment/browser configurations and were free in the executor's listener inventory on 2026-10-16. The browser harness refuses port collisions instead of reusing an existing server.

Run `pnpm --filter @building-suit/doctor-suit build` then `pnpm exec playwright test -c apps/doctor-suit/tests/e2e/playwright.config.ts`. The harness starts this app's production build on 127.0.0.1:4336. It rejects remote backend URLs and does not create provider resources or credentials. Unit coverage: `node --test apps/doctor-suit/tests/unit/dos-m1-002.test.mjs`.

`.env.example` contains blank values only. No hosted project, public origin, canonical URL or operational release registration is configured. The user handles provider connections separately; independent product identity and backend authorization precede protected workflows. No real patient data is allowed.

All visual composition belongs in `packages/ui`, interactions in `packages/ux`, and Doctor logic/props in this app. Every route uses one registered complete shared template; no local components, CSS or presentation factories. Consult root and scoped AGENTS and the [implementation contract](../../docs/work-packages/doctor-suit/website-contract-v0.2.md).

The public `/` route now uses `BsProductPreviewPage` with explicit planned-feature labels; `/preview` uses the existing shared workspace shell with an honest inactive-context banner. EN/AR HTML language/direction and themes are verified. Product context lifecycle helpers invalidate stale work and clear drafts, but doctor-owned practice setup and authorized location selection are implemented; invitation management and patient workflows remain subsequent M1 implementation; a context projection never grants backend authority.

## Synthetic account lifecycle (DOS-M1-006)

`/sign-in`, `/sign-up`, `/verify`, `/recover` and protected `/account` use shared complete templates. Without Doctor-specific provider configuration, credential fields are absent. Configure only the blank `DOCTOR_SUPABASE_URL`, `DOCTOR_SUPABASE_PUBLISHABLE_KEY`, `APP_ENV` and `APP_URL` fields for an authorized local target. Generic Supabase variables from other products are ignored. The endpoint must expose the Doctor runtime marker before credentials are accepted. Cookies use `bs-doctor-<environment>-auth-token`; callbacks return to the configured origin through same-browser PKCE, and return destinations use a fixed local allowlist.

For an already built Node server, the equivalent explicit runtime fields are `NUXT_PUBLIC_DOCTOR_AUTH_CONFIGURED`, `NUXT_PUBLIC_DOCTOR_AUTH_ENVIRONMENT`, `NUXT_PUBLIC_DOCTOR_AUTH_ORIGIN`, `NUXT_PUBLIC_DOCTOR_AUTH_URL` and `NUXT_PUBLIC_DOCTOR_AUTH_KEY`. The adapter validates these again and derives its cookie prefix from the verified environment; a runtime prefix override cannot mix product sessions. Leave the connection disabled until the user configures its approved target.

Verified sessions are checked against the provider user and database session ID. Editable metadata, matching contacts and email verification grant no ownership or clinical authority. Logout immediately clears private reads and locks the local view even if provider revocation fails. Account creation stores no client credential draft. Local Auth source enables email confirmation and a minimum 12-character password; this does not configure a hosted project.

There are no operational business readers or Realtime subscriptions. Revisit delivery eligibility when appointment/queue workflows exist. The account adapter is not evidence of live synchronization.

Focused checks: `node --test apps/doctor-suit/tests/unit/dos-m1-006.test.mjs` and `node apps/doctor-suit/tests/disposable-postgres.mjs`. The latter applies actual Doctor SQL against a minimal disposable provider contract and cannot establish full Supabase service acceptance. Full local Supabase Auth/Storage/Realtime verification remains **UNRUN** after the executor exhausted disk while extracting its PostgreSQL image.

The normal browser config tests unconfigured gates in EN/AR at mobile/desktop sizes. The separate protocol-fixture run uses the same default production build and configures only its owned loopback runtime through namespaced Nuxt runtime variables, then runs `pnpm exec playwright test -c apps/doctor-suit/tests/e2e/playwright.auth.config.ts`. Its HTTP fixture binds loopback only, accepts synthetic addresses, uses an in-memory outbox, blocks external requests, and disables credential traces/screenshots. Ports 4337/4338 were absent from repository environment/browser configurations and free in the executor listener inventory on 2026-10-16; existing listeners are never reused. This fixture tests app/SDK protocol handling, not actual provider delivery or token validation.

## Doctor-led practice setup (DOS-M1-007)

After a verified sign-in, `/account` links to `/onboarding`. The shared signup template shows only display name, practice name, initial location name and an explicit IANA timezone. Save an incomplete draft deliberately, then resume it from another verified session. Completion creates one doctor profile, one practice with one stored owner association, and one initial location. The owner association is `practices.owner_user_id`; delegated membership rows are unnecessary for a doctor working alone. No profile is professionally verified and no subscription is granted.

`/workspace` shows the server-authorized owner and selected working location, with a visible synthetic context notice on mobile and desktop. Editing `/onboarding` after setup changes only the approved owner/practice names through an optimistic, audited and idempotent command. Location maintenance and multi-location selection are implemented in DOS-M1-008 below. Existing delegated-only accounts cannot create ownership through either the current or compatibility onboarding entry point. Owner setup does not convert an invited secretary into a doctor.

Owner profile and setup reads use explicit request refresh. No live queue or Realtime subscription is implemented. Private data lives per Nuxt app and is cleared on auth/session changes and document exit; the shared UX restore hook forces authorization revalidation after BFCache restore. Only saved database drafts resume across sessions.

Focused verification: `node --test apps/doctor-suit/tests/unit/dos-m1-007.test.mjs`, the disposable PostgreSQL runner (92 current SQL assertions plus four concurrent-transaction scenarios), the normal Doctor browser suite and the separate account protocol suite. The protocol fixture is not actual Supabase service acceptance. Full local Supabase service integration remains UNRUN as recorded above.


## Working locations and explicit context (DOS-M1-008)

`/locations` uses the complete shared location-management template, the shared data table and record-action dialogs. A doctor can create, edit and soft-archive working locations with bounded contact fields and a named IANA timezone. Stored practice ownership never moves to a location. Archived rows remain readable by authorized settings users. When every location is archived, the stored owner retains practice-level settings and can create a new working location; no operational location is implied.

The shell selector lists only server-authorized doctor/practice/location projections. Multiple choices require explicit selection. Its preference cookie is an untrusted convenience bound to the verified user and session. The banner shows owning doctor, practice, location, role and timezone on mobile and desktop. Location-scoped settings grants never create ownership or clinical authority; every RPC rechecks the verified session and current stored permission. A lost selection clears protected data and requires another explicit choice.

Owner profile, setup and location reads use explicit request refresh. Context switching aborts old reads and clears rows, query/search state, local drafts and pending dialogs before accepting the next context. Keys include product, environment, user, session, portal, practice, location and grant/location versions. Newer state rejects late query/command results. Backend grants are enforced on every request; this is not a push-revocation or live synchronization claim.

Focused verification: `node --test apps/doctor-suit/tests/unit/dos-m1-008.test.mjs`, the disposable PostgreSQL runner (139 SQL assertions plus four real concurrent-transaction scenarios), and both Doctor browser configurations. Context authorization covers a secretary with independently granted locations across two practices. Patient identity/history across locations and archive resolution for future appointments require the actual patient and appointment features in DOS-M1-011/014; those acceptance scenarios remain deferred and are not represented as passing here. Schedule context uses the named timezone; working hours follow in DOS-M1-013.

Full Supabase Auth/Storage/Realtime service integration remains **UNRUN**. Local PostgreSQL and loopback HTTP protocol fixtures do not replace provider acceptance. No hosted migration, deployment or operational release registration is performed.
