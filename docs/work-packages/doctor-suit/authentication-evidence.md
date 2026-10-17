# DOS-M1-006 synthetic account lifecycle

Authoritative input remains the unchanged PR345 planning-v0.4 plan. This GitHub implementation does not import, activate or execute Automation. Parent PR351 provides the shared shell/context foundation; authenticated administrative context switching remains subsequent work.

Doctor owns all SDK/RPC adapters, session orchestration, form values, validation and bilingual copy. Shared SignIn, Signup, EmailVerification and PasswordRecovery templates accept optional typed availability notices; their existing default behavior remains unchanged. The new complete `BsAccountSessionPage` belongs to packages/ui and makes no provider calls. Account verification is separate from professional verification, practice ownership, paid entitlements and clinical authority.

Only Doctor-specific provider variables enable the SDK adapter. Missing configuration hides credential fields. Before credentials are accepted, an anonymous static RPC must identify Doctor Suit's synthetic schema. The session adapter then verifies the provider user and a database-owned current session record. Editable metadata and equal contact fields are never authority. The forward migration preserves the initial applied data migration and rejects missing, malformed, cross-user, expired and revoked session IDs. No provider-managed schema is changed by the product migration.

Doctor directly pins `@supabase/ssr` 0.12.7 alongside the existing pinned SDK. The pre-existing 0.7.0 helper overrides `detectSessionInUrl: false`, causing duplicate callback consumption; the Doctor-only helper honors explicit callback handling ([upstream implementation](https://raw.githubusercontent.com/supabase/ssr/main/src/createBrowserClient.ts)). Existing products keep their prior dependency. SSR clients and browser clients are created per Nuxt app; the browser singleton is disabled.

Cookies include product and environment. The app accepts only an explicit configured origin and publishable key, uses same-browser PKCE for fixed verification/recovery callbacks, consumes and removes callback query material, and limits return destinations to known Doctor paths. It never persists a credential draft. Logout clears private request state before provider I/O, and a host-only nonsecret privacy lock prevents a failed provider logout from restoring an authenticated view on refresh. A verified explicit sign-in is required to unlock it. SDK auth callbacks invalidate synchronously and never await SDK methods under its internal lock.

Verification records distinguish layers:

- Focused unit regressions exercise configuration isolation, hostile return destinations, wrong-product denial before credential submission, double-submit, verification/retry, expiry/error classification, stale reads, refresh revocation, logout failure and callback lock behavior.
- Disposable PostgreSQL applies the actual forward migrations and executes all 48 pgTAP assertions, including 34 prior identity/RLS assertions and 14 current-session assertions. It uses a minimal test-only provider Auth contract.
- Unconfigured browser verification covers 22 public/shared-shell/gated-auth cases in EN/AR, mobile/desktop and the preview theme matrix.
- The separate loopback protocol fixture exercises actual app routes and the pinned SDK without external email. Its in-memory outbox and synthetic token responses are protocol scaffolding, not provider token validation or delivery evidence. Credential traces/screenshots are disabled.
- Shared auth parity checks retain the existing Ledger and Shop default behavior through the repository's existing authentication, signup and public-route suites. These use synthetic intercepted provider responses.

**Full Supabase Auth/Storage/Realtime local service integration remains UNRUN.** Starting the owned local stack failed while extracting the PostgreSQL image because this executor exhausted disk. The SQL and HTTP fixtures do not replace that obligation. Hosted connection and deployment are user-managed and were not attempted. Genuine clinical/legal/provider approvals remain open; this account implementation makes no live-care or professional verification claim.

Final exact-head CI receipts and command totals are recorded in the task PR. No staging merge or main promotion is performed by this task.
