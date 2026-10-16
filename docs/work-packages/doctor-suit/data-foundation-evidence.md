# Doctor identity/data foundation — DOS-M1-003

Implementation parent: PR #349, commit `87261a8a1d066cfd49ed584ef3ffdbce61f52750`. Forward migration created by the pinned Supabase CLI 2.116.0, not an invented timestamp. Local project `building-suit-doctor` uses the previously unused 65320–65329 range. All production/staging project refs, origins and organization values remain blank.

The public schema separates Doctor profiles, doctor-owned practices, locations, independent memberships, explicit membership/location grants and immutable audit records. Confirmed identities may create their own unverified practice through one atomic, actor-bound, retry-safe command. No professional verification, staff-to-owner escalation or clinical signing capability is granted. RLS plus explicit grants denies direct client writes and anonymous reads. Private helpers use an empty search path and stored authority; no user metadata controls ownership.

Executed on 2026-10-16, Node 26.8.1 / pnpm 10.33.0:

- `node --test apps/doctor-suit/tests/unit/dos-m1-003.test.mjs`: 2 passed, 0 failed. Target/port drift, cross-product collisions and remote URLs are rejected.
- `node apps/doctor-suit/tests/disposable-postgres.mjs --types`: migrated the actual source SQL into an isolated PostgreSQL 17.11 container, then passed all 34 assertions in `supabase/tests/dos-m1-003.sql`. This covers separate doctor ownership, shared-secretary grants, location/cross-practice denial, metadata escalation, immediate membership revocation, anonymous/unconfirmed denial, atomic onboarding/retries, duplicate/conflicting command rejection and immutable audit privileges.
- Generated `app/types/database.types.ts` from that migrated database with PostgreSQL Meta v0.98.0, the version pinned by CLI 2.116.0. The generated public schema is not a hosted-state claim.
- App lint/typecheck and workspace strict boundary checks pass. Task PR reports the final root regression result and exact candidate SHA separately.

Full local `supabase start` failed with `failed to register layer: no space left on device` while extracting `supabase/postgres:17.6.1.165`; its automatic pull retry was interrupted. No Doctor service stack started and no hosted action was attempted. Do not label the fallback as a passing `supabase test db --local` run. Full Supabase Auth/Storage/Realtime integration and CLI-local lifecycle verification remain UNRUN, pending an executor with enough image-extraction storage. No provider setting, credential or Automation state changed.

The fallback is committed and reproducible. It verifies content hashes for upstream pgTAP 1.3.4 at immutable source commit `968eb53a33114e83042b3bdb0c664b5b80cf8bdf`, uses the pinned PostgreSQL image digest, and creates only a minimal provider-contract Auth schema. The database has no network access or published ports. Cleanup removes only that invocation's uniquely named container/anonymous volume and temporary source files. This does not test provider email delivery, session validation, Storage policies or Realtime delivery.

For the complete CLI lifecycle on a sufficient local executor, use `node apps/doctor-suit/tests/local-lifecycle.mjs <start|reset|test|types|stop>`. It fixes the product, validates the registry/config/ports, refuses linked CLI directories and never accepts a caller-supplied target URL or hosted flag. `SUPABASE_HOME` can point to a writable temporary directory; do not change HOME or use another product's configuration.
