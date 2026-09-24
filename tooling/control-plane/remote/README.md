# Control plane → Supabase Staging migration

This directory migrates only the `control` schema from the existing local
`building_suit_control` PostgreSQL database to the dedicated Supabase Staging
project.

It does not touch Ledger, Shop, Inventory, or any other application database.

## Why snapshot/restore instead of replaying only 001–010

The local database contains operational state in addition to schema:
executions, verification results, events, PR records, workflow runs, and the
current task graph. A schema-only replay would lose that history.

The migration therefore snapshots the exact local `control` schema and data.

The repo SQL files remain the design/source-of-truth for the control-plane
schema. Future schema changes should continue as numbered migrations.

## Connection mode

Use Supabase Shared Pooler **Session mode** (port 5432) when your network is
IPv4-only.

Do not use transaction mode for the control-plane runtime. The control plane
uses transaction-scoped advisory locking and normal PostgreSQL session
semantics.

## Steps

1. Copy `env.example` to `.env`.
2. Fill `STAGING_PROJECT_REF` and `STAGING_DB_HOST`.
3. Run `00_local_preflight.sh`.
4. Ensure no real task or continuous run is active.
5. Run `01_dump_local_control.sh`.
6. Run `02_restore_staging.sh`.
7. Run `03_create_runtime_role.sh`.
8. Put the generated runtime role entry into `~/.pgpass`.
9. Run `04_verify_staging.sh`.
10. Apply `runner-remote-db.patch`.
11. Export the runtime Staging environment values.
12. Use only read commands first: `task-next`, `task-packet`.
13. Create `05_staging_sandbox.sql` and test claim/release on the synthetic
    Suit only.
14. Remove it with `06_cleanup_staging_sandbox.sql`.
15. Do not point production n8n at Staging until these checks pass.
