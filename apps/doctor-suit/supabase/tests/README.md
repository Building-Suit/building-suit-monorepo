# Disposable Doctor database tests

Use pinned pnpm/CLI and an isolated writable SUPABASE_HOME if the executor requires it. From repository root:

1. `pnpm db doctor-suit start` selects Doctor configuration only, ports 65320–65329.
2. `pnpm db doctor-suit db reset --local` explicitly resets the disposable local Doctor instance.
3. `pnpm db doctor-suit test db --local` executes task-owned pgTAP suites.
4. `pnpm db doctor-suit gen types typescript --local --schema public > apps/doctor-suit/app/types/database.types.ts` generates the client schema contract.
5. `pnpm db doctor-suit stop --no-backup` ends the disposable session.

Never pass --linked, --project-ref or --db-url. Never load hosted credentials. The browser fixture harness rejects remote targets; production/staging entries stay blank. SQL fixtures run transactionally and roll back. Seed creates no user, password, recipient or clinical data. Provider delivery/session integration remains separate from database policy acceptance.

If the full Supabase image cannot fit the executor, `node apps/doctor-suit/tests/disposable-postgres.mjs --types` runs SQL/RLS pgTAP assertions against isolated PostgreSQL and generates public types with CLI-pinned PostgreSQL Meta. It pins/hash-checks upstream test dependencies. This fallback is explicitly not full Supabase Auth/Storage/Realtime verification; keep the CLI-local result UNRUN. See the foundation evidence document for the observed extraction failure and limitations.
