# LS-OPS-PORT-002 — complete current financial export coverage

2026-10-22. Child of portability integrity PR #448 at `bab14920`. The former 64-table inventory omitted 39 current customer-readable tables. The current inventory has **103 tables**, including FX, both ETA adapters, migration-center stages/acceptances and manual-payment requests/evidence/history. Each read retains the caller's existing RLS/capability boundary. Four direct tenant tables have explicit operator-only dispositions: raw audit logs, raw provider billing events, internal dimension idempotency requests and private support intake. Complete operator backups preserve those records and provider schemas separately.

The native runner now audits every actual `public` table containing `organization_id`: each must be exported or explicitly classified. This catches new uncovered tenant tables without mistaking source migrations for a live Automation status export. The live Automation queue remains unavailable here.

## Files and recovery evidence

Private financial attachments and manual-payment receipts are downloaded through the caller's authorized Storage interface. Objects use `objects/<encoded-bucket>/<tenant-key>` and an explicit manifest path. Identical keys in two buckets therefore preserve distinct bytes. Duplicate references to the same bucket/key retain one physical object; inconsistent sizes or checksums fail. Pagination rejects a repeated range or changed row count instead of silently producing incomplete pages. Freeze source writes for recovery: tenant API reads across tables are not one database snapshot.

The format is now version 2:

- `ls-ops-001-portability-v2` includes all 103 table descriptors, four report files and the explicit excluded-table dispositions.
- `ls-ops-001-attachments-v2` includes both private buckets and the exact relative path/size/SHA-256 of each physical object.
- `ls-ops-001-v2` SQL evidence captures the migration-history digest before assuming the authorized actor. A repeatable-read, read-only transaction captures financial/report/configuration/operation evidence and both object-metadata sources. Shared bucket/key references are counted once physically; all source metadata and size conflicts remain represented.

Current recovery comparison requires both complete export manifests as well as both SQL snapshots and object manifests. It compares every financial page/report hash and verifies the actual on-disk hashes, JSON row counts and object bytes, including receipt files. Missing FX records, changed migration originals, differing migration history, fabricated row counts and equal-size file corruption are rejected. Retained version-1 evidence is historical; recapture with current tooling for the current financial scope.

```sh
node apps/ledger-suit/scripts/compare-restore-evidence.mjs \
  source.json restored.json \
  source-export/attachments-manifest.json restored-export/attachments-manifest.json \
  source-export/manifest.json restored-export/manifest.json
```

## Actual results and remaining drill

[The dated evidence](../v2-acceptance/portability-coverage-verification-2026-10-22.json) records the current source identities and checks.

- Native PostgREST 16.1/PostgreSQL 17.6 exports all 103 declared tables and four reports successfully. The actual 103 direct tenant relations are classified; large JSON/CSV money remains exact, another readable tenant is excluded and unauthorized exports are denied. The version-2 SQL capture executes successfully with the complete 105-migration history and exact financial totals. All generated native table/report/manifest files pass disk validation.
- All 128 Ledger unit tests pass. The 11 focused tests include two private buckets with identical object keys/different byte contents, pagination integrity, metadata/file row-count mismatch, changed financial modules/history, valid complete comparison and object-file tampering. Storage HTTP bytes in these tests are a controlled unit fixture.
- The actual Storage provider transfer, two-instance restore, operating off-site backup destination/schedule and measured recovery durations remain the next rehearsal. This package does not report an RPO/RTO, accountant acceptance, hosted configuration, production deployment or Automation mutation.

No applied migration, financial command, RLS grant or customer record was changed. The retained synthetic native fixture journals are separate from any hosted business data. Follow [the restore runbook](../../restore-retention-portability.md) for the full project rehearsal and [the native runner](../../../scripts/test-portability-native.mjs) for repeatable PostgREST/snapshot checks.
