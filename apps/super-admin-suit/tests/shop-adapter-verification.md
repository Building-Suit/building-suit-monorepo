# SAS-M1-SHOP-ADAPTER-001 local verification

Implementation is confined to Super Admin. No Shop files, hosted configuration,
secrets, databases, commits or publication were changed.

Executed successfully:

- `node --test apps/super-admin-suit/tests/unit/sas-m1-shop-adapter-001-1.test.mjs`
- `node --test apps/super-admin-suit/tests/unit/sas-m1-shop-adapter-001-4.test.mjs`
- `node --test apps/super-admin-suit/tests/unit/*.test.mjs`
- `pnpm exec turbo run typecheck lint build --filter=@building-suit/super-admin-suit`
- `pnpm check`
- `git diff --check`

Execution blockers (not passing evidence):

- `pnpm agent:preflight`: fetch/GitHub verification failed with exit 255.
- `pnpm db super-admin-suit status` and
  `pnpm db super-admin-suit test db --local`: CLI fails attempting to write
  `/home/tareq/.supabase/telemetry.json.*` outside the writable sandbox.
  Docker access is also denied. The forward migration, SQL suite and generated
  database type regeneration could not be exercised against a local database.
- `pnpm exec playwright test --config apps/super-admin-suit/tests/e2e/sas-m1-shop-adapter-001-2.config.ts --workers=1 --retries=0`:
  the configured production server exits before tests. Direct diagnosis reports
  `listen EPERM: operation not permitted 127.0.0.1:4324`.

Independent verification must apply the forward migration to an explicitly
disposable Admin database, run the entire SQL suite and regenerate public
schema types from that database; then run the registered browser executable.
No generated type artifact was manually edited. Runtime RPC calls have an
explicit JSON transport interface until generation is available.

The unit suite executes production input/claim validation, transport rejection,
verified-result handling and ambiguous-outcome recording with controlled
server-side fixtures. It does not replace the SQL suite or an authenticated,
configured Shop round trip. The browser spec uses the real unauthenticated
route, public assets and browser network traffic; it makes no configured
round-trip claim. Matching Admin Vault/Shop verifier configuration and a fresh
verified manifest must be provisioned independently in disposable environments.

Production strong-auth and separately authorized provider/release gates remain
as documented by the existing auth implementation. This task does not modify
those policies.
