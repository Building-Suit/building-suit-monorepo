# Restore, retention, and customer portability

Status: **tooling implemented locally; native restore evidence blocked** (LS-OPS-001, 2026-09-27). No hosted database, provider setting, deployment, or customer record was changed. This record does not claim a recovery-point objective (RPO), recovery-time objective (RTO), deployment, or accountant acceptance.

## Actual exercise result

The required second-instance restore did not start in this worktree. The checks below were actually run against the prepared branch at `0db3ea00ffa8ab5ecf771d9de3b4af1031951302` before edits:

| Check | Observed result |
|---|---|
| V2 baseline | The named reviewed commit `2e3c26b` is not a literal ancestor, but Git patch-equivalence maps the complete V2 series, including V2-IMP-015, to the integrated `17c2c13` series. All V2-IMP-015 paths are present. |
| `pnpm agent:preflight` | Failed in 0.7 seconds before verification; fetch/GitHub state was unavailable and `node_modules` is absent. |
| Supabase CLI | `/home/tareq/.local/bin/supabase --version` returned `2.90.0`; it is not on this worktree's normal command path. |
| Docker | `docker info` failed before any container or database action because access to `/var/run/docker.sock` is denied. |
| Local PostgreSQL | `pg_isready` found no server on `127.0.0.1:60322` or `127.0.0.1:5432`; no `postgres`/`initdb` server binary is installed. |
| Backup, restore, reconciliation, attachment copy | Not started. Consequently there is no honest backup duration, restore duration, recoverable point, storage volume, RPO, or RTO to report. |

This is a hard acceptance blocker, not a skipped test counted as evidence. A real run needs two fresh, explicitly owned disposable Supabase instances and Docker/native PostgreSQL access. Hosted writes are outside this task's authorization.

## Verified hosting-plan limits

No paid Supabase plan has been selected or created in the maintained environment setup. The current planning baseline is therefore **Free**, subject to owner confirmation in the provider dashboard. This is a source-level conclusion, not verification of either live Ledger project's plan or backup dashboard.

Read-only review of official Supabase material on 2026-09-27 established:

| Plan/capability | Verified provider statement | Ledger conclusion |
|---|---|---|
| Free | Automatic backups are not included. Supabase recommends regular CLI dumps for Free projects. Free projects can pause after inactivity. | There is no managed recoverable period to promise. Production readiness remains blocked until an owned off-site backup process is executed and retained, or a paid plan is explicitly selected. |
| Pro | Starts at USD 25/month and includes daily database backups retained for 7 days. | Feasible database baseline if approved, but not enabled by this task and not sufficient for attachment recovery. |
| Team | Starts at USD 599/month and includes daily database backups retained for 14 days. | Not selected or enabled. |
| PITR add-on | Available on paid plans, requires at least Small compute, and is currently listed at about USD 100/200/400 monthly for 7/14/28 days. Enabling PITR replaces daily backups for that project. | No PITR purchase or RPO is approved. Provider granularity is not a measured Ledger RPO or RTO. |
| Restore | A managed restore makes the project inaccessible; duration varies with database size. | Only an actual timed Ledger rehearsal can establish recovery time. |
| Storage | Database backups cover database data/metadata, not the object bytes stored through Storage. | Every usable Ledger backup must separately copy the private `attachments` object bytes and reconcile them with `public.attachments`. |

Sources: [Supabase database backups](https://supabase.com/docs/guides/platform/backups), [Supabase pricing](https://supabase.com/pricing), [Supabase CLI backup/restore and Storage migration](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), and [Storage object downloads](https://supabase.com/docs/guides/storage/management/download-objects).

## Rehearsal contract

Use the existing V2-IMP-015 synthetic fixture and dates. Do not reset the normal local Ledger project and never restore over the source.

1. Create source and target disposable Supabase projects under this worktree with unique project IDs, container ownership labels, ports, and service keys. Record their resolved workdirs and prove that neither URL is hosted.
2. Replay the complete Ledger migration chain into the source. Create a committed synthetic organization through the existing public commands; include posted/reversed journals, AR/AP, configuration, recurrence/import evidence, and at least one real private attachment object.
3. Run `capture-restore-evidence.sql` on the source with `psql -X -Atq -v ON_ERROR_STOP=1`, saving its single JSON row. Run `export-organization-portability.mjs` with the source user's publishable key/access token to capture the existing report CSVs, tenant tables, attachment bytes, and SHA-256 manifest. Tokens are environment variables and must never enter shell history, logs, or artifacts.
4. Create the database backup using the current official Supabase CLI procedure (roles, schema, data, and `supabase_migrations` history). Copy the private Storage objects separately. Record UTC start/end timestamps, CLI versions, migration-manifest hash, database bytes, attachment count/bytes, exit codes, and artifact SHA-256 values.
5. Restore only into the second fresh target instance using the official procedure. Recreate only externally managed configuration—Auth/Storage customizations from migrations, Edge Functions, secrets by **name**, Vault entries by **name**, scheduler jobs, SMTP/callbacks, and provider settings. Do not copy secret values into evidence.
6. Run the same evidence SQL and portability export against the target, with a distinct `environment_id`. Compare them:

   ```sh
   node apps/ledger-suit/scripts/compare-restore-evidence.mjs \
     source.json restored.json \
     source-export/attachments-manifest.json \
     restored-export/attachments-manifest.json
   ```

   Passing requires nonempty journals, zero unbalanced journals, exact journal/entry identities and minor-unit totals, exact TB/BS/P&L/Control and existing CSV digests, configuration/recurrence/import equality, and byte-identical attachment manifests. Row counts alone are insufficient.
7. Record the actual backup, database restore, attachment restore, verification, and total elapsed durations. Derive no RPO/RTO from configuration alone. Destroy disposable resources only under separate authorization after evidence review.

Example evidence capture (values intentionally placeholders):

```sh
psql "$SOURCE_DATABASE_URL" -X -Atq -v ON_ERROR_STOP=1 \
  -v environment_id='ledger-restore-source-disposable' \
  -v organization_id="$ORGANIZATION_ID" -v actor_id="$ACTOR_ID" \
  -v from_date='2036-01-01' -v to_date='2036-01-31' \
  -f apps/ledger-suit/scripts/capture-restore-evidence.sql > source.json
```

## Customer portability boundary

`export-organization-portability.mjs` closes the demonstrated gap between existing financial CSVs and a tenant-scoped evidence package without adding a second reporting implementation:

- It requires an authenticated tenant member with `exports.create`; every table remains subject to its existing RLS/capability policy.
- It calls the existing `export_financial_report_csv` RPC for P&L, Balance Sheet, Trial Balance, and Cash Flow.
- It writes table responses as raw, paginated JSON pages. Bigint money is never parsed through JavaScript `Number`.
- It downloads every visible private attachment under the exact organization prefix, verifies the metadata size, and records a SHA-256 digest.
- It fails on a foreign/unsafe object path, missing page count, permission error, report error, or attachment mismatch. It refuses to overwrite an earlier export directory.

Run it with secrets supplied by the local environment, not command-line arguments:

```sh
LEDGER_SUPABASE_URL='https://project.supabase.co' \
LEDGER_SUPABASE_PUBLISHABLE_KEY='...' \
LEDGER_ACCESS_TOKEN='...' \
LEDGER_EXPORT_ORGANIZATION_ID='...' \
LEDGER_EXPORT_ENVIRONMENT_ID='ledger-customer-export-2026-09-27' \
LEDGER_EXPORT_FROM_DATE='2036-01-01' \
LEDGER_EXPORT_TO_DATE='2036-01-31' \
LEDGER_EXPORT_OUTPUT='/secure/new-export-directory' \
node apps/ledger-suit/scripts/export-organization-portability.mjs
```

The package intentionally excludes Auth credentials/passwords, service-role keys, Vault/Edge/provider secrets, global plan catalogs, and raw payment-provider events. Membership IDs are included; platform Auth identity export remains an operator-controlled migration concern. Audit history remains governed by the existing plan-aware `list_audit_history` boundary and is not silently represented as complete customer history. A complete project recovery therefore still requires the database backup plus separate Storage object backup and external configuration inventory.

## Retention and deletion review

- Ledger cancellation, suspension, expiry, downgrade, or archival must not delete posted journals, entries, linked reversals/corrections, audit rows, attachments, recurrence/import evidence, or migration history. Existing read-only/visibility rules do not equal deletion.
- Product audit visibility is currently plan-windowed (90/365/1095 days for the sold Ledger plans), while stored append-only audit rows are not purged by that read boundary. Do not market the visibility window as physical retention or a backup period.
- No approved general customer purge schedule, legal-hold process, or post-cancellation deletion commitment exists in the reviewed Ledger scope. Do not invent one. A future deletion policy requires product/legal approval, a customer export, explicit treatment of posted financial/audit records and backups, and a separate forward implementation.
- Deleting a Supabase project is irreversible and removes its managed backups. It is not a customer-retention workflow.
- Until a real backup schedule and off-site destination are approved and exercised, Free-plan recovery has **no committed recoverable period**. This blocks a recovery guarantee; it does not authorize destructive cleanup.

## Acceptance state

| Requirement | Code/tooling | Tests | Deployed | Accountant accepted |
|---|---|---|---|---|
| CORE-04 | Existing append-only/reversal behavior is included in exact restore digests; unchanged | Comparator unit coverage passed locally; native restore unverified | Unverified | Pending |
| CORE-07 | Portability/export and attachment-byte evidence tooling added; runtime behavior unchanged | Offline unit coverage passed locally; native RLS/API/export/Storage run unverified | Unverified | Pending |
| CORE-08 | Exact source/target evidence contract added | Offline mismatch detection passed; real source/target reconciliation unverified | Unverified | Pending |
| VAL-08 | Separate states retained | Artifact/state validator remains the authority | Unverified | Pending |

LS-OPS-001 is not complete until one native, isolated, timed restore produces reviewed matching artifacts. The tooling and provider review are ready for that independent run.
