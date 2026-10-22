# Database development and release

Each product owns a CLI root: `apps/ledger-suit/supabase`, `apps/shop-suit/supabase`, `apps/inventory-suit/supabase` and `apps/super-admin-suit/supabase`. Production and staging use the owning product's migration chain. Doctor also owns `apps/doctor-suit/supabase`. Inventory has no business schema; its access-default migration prepares future setup. Super Admin owns configuration, adapter and publication migrations. Automation uses a protected control schema and dedicated direct-PostgreSQL roles, with schema sources in `tooling/control-plane/sql`. The target is always a product plus environment from `docs/architecture/environments.json`.

## Local commands

Run from the workspace root:

```sh
pnpm db ledger-suit start
pnpm db shop-suit start
pnpm db inventory-suit start
pnpm db super-admin-suit start
pnpm db ledger-suit db lint --local --level warning
pnpm db shop-suit db lint --local --level warning
pnpm db inventory-suit db lint --local --level warning
pnpm db super-admin-suit db lint --local --level warning
pnpm db:test:ledger
pnpm db:test:shop
pnpm db:test
pnpm db ledger-suit gen types typescript --local --schema public
pnpm db shop-suit gen types typescript --local --schema public
pnpm db inventory-suit gen types typescript --local --schema public
pnpm db super-admin-suit gen types typescript --local --schema public
```

The product selector passes the correct `--workdir` to the pinned CLI. Ledger uses local API/DB/mail ports 60321/60322/60324; Shop uses 61321/61322/61324; Inventory uses 62321/62322/62324; Super Admin uses 64321/64322/64324. Each has a different project ID and data volume. Run SQL fixtures before browser writes when a test assumes a pristine seed. Only reset an explicitly disposable local instance with `pnpm db <product> db reset --local`; test commands never reset silently.

Create a forward file using `pnpm db <product> migration new <name>`. Preserve applied files. Review dependencies, RLS, explicit grants, functions, views, Storage, Realtime and business invariants. Apply local changes with `pnpm db <product> migration up --local`, generate types and check relevant app flows.

The current Shop test runner executes five preserved SQL suites after substituting only the relocated schema identifier into the test input, plus the dedicated-project privilege regression suite; originals stay intact. Older retired-contract suites remain historical evidence and are not the active test command.

## Hosted configuration and release

Follow [manual setup](supabase-manual-setup.md) for provisioned environment entries and their separate frontend/deployment files. Inventory's blank hosted entries are not authorization to provision them. `pnpm db:preflight <product> <production|staging>` verifies local ref/organization/URL/key consistency without remote mutations. It rejects missing refs/credentials, duplicate targets/shared organizations, privileged browser keys and mismatched runtime URLs, cookie prefixes or origins. It does not prove live memberships, backup availability or migration equivalence.

Verify the live project and organization, applied history and recovery point, then review the CLI dry run before executing any deployment. Do not rely on a stale CLI link or infer a target from display names. Serialize database releases per product/environment and keep them out of cached build tasks. Release compatible SQL/apps in the reviewed order, then verify app health, authorization and the changed journey.

Production data and Auth users are not shared between products or with staging. New business tables/API objects belong in `public`, with explicit grants and RLS; privileged implementation helpers retain their protected schema. Inspect actual objects rather than assuming documentation proves deployment state.

CI currently checks the workspace and public browser flows. Hosted publication and database migration remain explicit operations after credentials and project refs are configured.

## Explicit Data API access (October 2026)

Automatic grants are disabled in every app's `[api]` configuration. Forward access migrations preserve the audited per-object contracts and revoke automatic table, sequence and function grants for the owning migration roles. Global PUBLIC function execution is revoked separately; schema-local default revokes cannot remove that PostgreSQL default. Existing helper/RPC access is granted explicitly. Provider-owned schemas and defaults are not rewritten.

Every newly added migration, including backdated files from stacked features, must name its GRANT/REVOKE declarations beside each new table/RPC and enable table RLS. `pnpm check` includes `tooling/database/check-explicit-access.mjs`. The immutable historical file list in `explicit-access-baseline.json` recognizes already applied history; never extend it to exempt new work. The static check catches missing declarations; it does not replace database role, policy or tenant tests.

See [the access runbook](supabase-oct30-access.md) for exact verified targets, versions, recovery and paused projects. The live changes were owner-authorized access-only deployments; this does not authorize provisioning projects, activating Doctor clinical workflows or applying unrelated pending feature migrations. Types did not change: tables, columns, enum values and RPC signatures are unchanged.
