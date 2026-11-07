# LS-OPS-PORT-001 — usable, verifiable portability artifacts

2026-10-22. Child of native concurrency PR #447 at `c889633a`. This repairs the existing operator export/restore-verification tooling. A complete native restore and expansion to newer module records are subsequent work, not outcomes of this package.

## Defects and changes

Actual PostgREST execution initially stopped at `profiles` with PGRST201: organization membership has separate user/inviter foreign keys. The export now names the user relationship explicitly. The next attempt exposed nonexistent `id` ordering on `bank_match_lines`; both bank-match join tables now use their real composite keys. VAT profiles use their unique ID rather than the identical organization ID when paging historical versions.

`dimension_value_requests` is an internal command-idempotency table without an authenticated SELECT grant. It is removed from the customer-readable table inventory; no privilege is broadened. The whole database backup still preserves it. The native check confirms authenticated direct access remains HTTP 403.

Table-page hashes previously omitted the newline written to disk. The attachment-manifest hash used compact JSON while the file contained indented JSON plus a newline. Both hashes now cover the exact written bytes. Raw PostgREST JSON is retained without parsing/reserializing money through JavaScript numbers. Recognizable optional SHA-256 attachment checksums are verified before copying; equal-size corruption is rejected.

The restore comparator previously accepted empty object manifests and inconsistent metadata/object counts and byte totals. It now requires a real object, valid digest and tenant path, matching environment identities, unique bucket/key pairs and exact decimal byte totals. It also requires balanced, nonzero posted financial totals. A comparison pass remains a comparison of supplied evidence; it does not substitute for actually backing up and restoring a second native instance.

## Actual verification

The [dated evidence](../v2-acceptance/portability-integrity-verification-2026-10-22.json) records the source identities and results.

- **Native PostgREST 16.1 / PostgreSQL 17.6:** 64 current inventory tables and four real report CSVs exported successfully. Every on-disk file digest matches. An actual posting of `9007199254740993` minor units survives in JSON and as `90071992547409.93` in Trial Balance CSV. An additional tenant readable by the same actor is excluded; outsider/viewer exports are denied before an output directory is created. The private request table remains 403.
- **Nine focused checks:** pagination across 1,001 rows, raw large integers, binary object copying, report/page/manifest hashes, overwrite refusal, checksum corruption, and invalid restore evidence pass. The binary HTTP fixture is a unit fixture, not Storage-provider evidence.
- **Ledger suite:** all 126 unit tests pass. Changed scripts/tests pass their app-owned ESLint configuration and Node syntax checks. Workspace and committed, parent-aware release checks are required before publication.

The native runner is [test-portability-native.mjs](../../../scripts/test-portability-native.mjs). It requires `LEDGER_PORTABILITY_DISPOSABLE_TEST=1`, the explicitly disposable local Ledger database on 60322 owned by a registered worktree, and the complete byte-identical current migration chain. Prepare the pinned PostgREST image shown in its header, then run:

```sh
LEDGER_PORTABILITY_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/test-portability-native.mjs
```

The runner starts the pinned official amd64 PostgREST image on an ephemeral loopback port, uses temporary signed fixture JWTs, and forwards only the normal REST prefix. SQL, JWT verification, RLS, relationships, ranges and CSV RPCs execute in the actual server. It creates synthetic Auth rows for the fixture and uses public commands for organizations/accounts/posting. One fixture membership is provisioned directly to test a second readable tenant. It preserves database fixtures and removes only its own temporary API container. Generated signing material is private under ignored `.local/`; no token is printed.

This checks actual PostgREST authorization, not GoTrue signup, a gateway/API-key policy, a deployed environment or Storage bytes. No hosted database, accountant verdict, Automation task or production release changed. Parent CI still has unrelated Shop baseline unit failures; they are not waived or relabelled green.

## Follow-up scope

The 64-table inventory predates the FX, ETA, migration-center and manual-payment records. Extend the financial export and recovery evidence to those authorized records and the private manual-payment receipt bytes before claiming a complete current customer package. Execute the timed two-instance restore with real private objects, exact report/configuration/history comparison and the actual external operating-backup configuration. Live Automation reconciliation, hosted configuration and accountant acceptance remain independent requirements.
