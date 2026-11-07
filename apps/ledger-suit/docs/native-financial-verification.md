# Native financial verification — LS-REL-001

2026-10-22: **63 native SQL files / 1,927 assertions pass**, and the integrated reconciliation probe passes all 22 checks on PostgreSQL 17.6. This closes the earlier inability to execute these database checks. It does not establish hosted deployment, complete provider API/Storage acceptance, restoration, ETA preproduction or accountant UAT.

Parent: PR #439 / `9d20beeb69f6eea9ae96c3db0ab2ce57e53894a0`. All 105 application migrations applied unchanged. The source/test identities and actual native environment are retained in [the evidence record](accountant-system/v2-acceptance/native-sql-verification-2026-10-22.json).

## Repairs required by the cumulative native run

- Monthly quota race: trigger-free historical seed rows now carry UUID journal references, satisfying the current posted-only identity constraint. The competing transitions still run normal posting/number/quota triggers and require one winner and one stable quota rejection.
- CSV exports: punctuation and formula account labels are created before posting. A separate formula account preserves historical naming; its posting follows the negative-cash/ledger assertions so those exact amounts remain unchanged. Accounts are prepared before the fixture plan downgrade; the public export and permission checks still use Solo.
- Journal sequence concurrency: each retained synthetic organization has its own provider subscription reference. Repeating the suite no longer collides with the prior committed concurrency fixture.
- Platform administration: compare complete ordered journal/entry snapshots before and after the commands, replacing the assumption that a seeded database contains zero transactions. This also detects mutations that a count-only check missed.

No production migration, posting rule, report implementation or authorization policy changed.

## Reproduce in an owned disposable local environment

Use pinned workspace dependencies and the app-owned CLI configuration. This exercise used a fresh cloud environment with no existing Ledger container, data volume or project on port 60322. Do not reset or replace another task's local project. The SQL suites retain some committed synthetic concurrency fixtures; keep their evidence.

The standard Supabase PostgreSQL image exceeded this environment's 32 GiB disk under Docker's existing `vfs` driver. The maintained [image preparation script](../scripts/prepare-native-verification-images.mjs) avoids repeated parent-layer copies by exporting the exact pinned upstream amd64 filesystem and importing one local layer. It preserves and verifies the original entrypoint, command, environment values, working directory, user, ports, volumes and stop signal. It checks the imported filesystem digest. The image healthcheck is not copied; the real Supabase CLI supplies the container healthcheck. No Docker daemon setting changes.

Preparation requires Linux amd64, the local Docker socket and **crane v0.20.7**. Obtain the [official release](https://github.com/google/go-containerregistry/releases/tag/v0.20.7) and verify the platform archive against its published checksums. Set `LEDGER_CRANE_BINARY` if it is not on PATH.

```sh
node apps/ledger-suit/scripts/prepare-native-verification-images.mjs
SUPABASE_INTERNAL_IMAGE_REGISTRY=ledger.local pnpm db ledger-suit start \
  -x gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
pnpm db ledger-suit test db --local
docker exec -i supabase_db_building-suit-ledger psql -X -v ON_ERROR_STOP=1 \
  -U postgres -d postgres < apps/ledger-suit/scripts/verify-v2-reconciliation.sql
pnpm db ledger-suit db lint --local --level warning
```

The `ledger.local` names are prepared local cache tags, not an external registry or deployment. The PostgreSQL amd64 source is pinned to `sha256:fc542c31f334749adbbd3c9e16b6be90f17d0fe6460d5196066d73f2723c9ecf`. The real Realtime/Auth/Storage migration images are pinned by digest and tagged locally without modification. The CLI initializes their actual provider schemas before replaying Ledger migrations. There are **no Auth/Storage/cron/net SQL shims** in this execution. Optional services remain stopped; role/JWT SQL tests do not prove HTTP authentication or object-byte transfer.

The preparation script starts no service, resets no database and accepts no connection URL. It writes provenance under `.local/ledger-native-images/`. Keep tokens and provider credentials out of evidence.

## Actual results and remaining boundaries

The initial native run exposed the three old fixtures above; a repeat exposed the sequence subscription collision. Focused checks passed after each repair. The final complete native run passed **63 files and 1,927 assertions in 22 seconds**. The separate eight-journal probe passed **22 checks** and rolled back. It verifies exact journal/entry counts, totals, TB/BS/P&L, AR/AP Controls, historical labels/mappings and journal-number format; its manual equipment/depreciation/fee entries are not a combined fixed-asset/bank/CF acceptance story.

Database lint returned **21 warnings across 13 functions, zero errors**: JSONB initialization coercions, compatibility parameters and unused variables. They remain recorded rather than being described as a clean lint result. Applied migrations were not edited to hide warnings.

Native tests include the existing real independent-session SQL races. Separate AR/AP, asset, inventory and FX Node concurrency probes, full API/Storage/browser evidence, migration preservation pairs, timed second-instance restore, advisory remediation and accountant acceptance remain separate work. The Automation database remains unconnected; no control task, retry, decision or run was changed. Current CI also exposes existing Shop tests outside this Ledger delta; this task does not bypass those checks or claim a release merge.
