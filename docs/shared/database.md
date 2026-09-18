# Database development and release

Each product owns a CLI root: `apps/ledger-suit/supabase` and `apps/shop-suit/supabase`. Both production and staging use the owning product's migration chain. The target is always a product plus environment from `docs/architecture/environments.json`.

## Local commands

Run from the workspace root:

```sh
pnpm db ledger-suit start
pnpm db shop-suit start
pnpm db ledger-suit db lint --local --level warning
pnpm db shop-suit db lint --local --level warning
pnpm db:test:ledger
pnpm db:test:shop
pnpm db:test
pnpm db ledger-suit gen types typescript --local --schema public
pnpm db shop-suit gen types typescript --local --schema public
```

The product selector passes the correct `--workdir` to the pinned CLI. Ledger uses local API/DB/mail ports 60321/60322/60324; Shop uses 61321/61322/61324. Each has a different project ID and data volume. Run SQL fixtures before browser writes when a test assumes a pristine seed. Only reset an explicitly disposable local instance with `pnpm db <product> db reset --local`; test commands never reset silently.

Create a forward file using `pnpm db <product> migration new <name>`. Preserve applied files. Review dependencies, RLS, explicit grants, functions, views, Storage, Realtime and business invariants. Apply local changes with `pnpm db <product> migration up --local`, generate types and check relevant app flows.

The current Shop test runner executes five preserved SQL suites after substituting only the relocated schema identifier into the test input; originals stay intact. Older retired-contract suites remain historical evidence and are not the active test command.

## Hosted configuration and release

Follow [manual setup](supabase-manual-setup.md) for the four environment entries and their separate frontend/deployment files. `pnpm db:preflight <product> <production|staging>` verifies local ref/organization/URL/key consistency without remote mutations. It rejects missing refs/credentials, duplicate targets/shared organizations, privileged browser keys and mismatched runtime URLs, cookie prefixes or origins. It does not prove live memberships, backup availability or migration equivalence.

Verify the live project and organization, applied history and recovery point, then review the CLI dry run before executing any deployment. Do not rely on a stale CLI link or infer a target from display names. Serialize database releases per product/environment and keep them out of cached build tasks. Release compatible SQL/apps in the reviewed order, then verify app health, authorization and the changed journey.

Production data and Auth users are not shared between products or with staging. New business tables/API objects belong in `public`, with explicit grants and RLS; privileged implementation helpers retain their protected schema. Inspect actual objects rather than assuming documentation proves deployment state.

CI currently checks the workspace and public browser flows. Hosted publication and database migration remain explicit operations after credentials and project refs are configured.
