# One-time Shop transfer to dedicated projects

This procedure is bounded to the user’s requested Shop separation. It is not an ongoing AI-agent workflow. Both destination projects and their credentials have been verified. Production now contains the verified Shop schema and scoped business/Auth data copy; Staging contains the same schema, the Shop portal/plan catalog and passes its SQL tests. SMTP, application deployment and final cutover remain pending. The shared source was preserved and remained read-only throughout this transfer.

## Verified setup and access — 2026-09-19

| Item | Observed state |
|---|---|
| Destination organization | `Building Suit - Shop Suit`, ID `rfolwdswbxddqtqaombc` |
| Account | `shop@building-suit.com`, supplied by the user; account membership roles were not independently verified |
| Organization plan | Free, verified through the Supabase plugin |
| Destination projects | `Production` (`fgdzjnsbcxfbiuogbmom`) and `Staging` (`jvvelvftpfnlogalgxgv`), both healthy in `eu-central-1` |
| Destination database state | Both projects have 25 tables and 26 views in `public`, with three applied migrations. Production contains the source's 17 Shop business rows; Staging retains no customer data |
| Source project | `Building Suit`, ref `jkdncdexqcymwbihwdhp`, organization `teqawtspijttcalwjrhz`, healthy, `eu-central-1` |
| Source Shop objects | 25 tables, 26 views, 24 RLS policies; all 25 tables have RLS enabled |
| Dependencies already identified | 8 `shop_crm` functions, 13 `shop_private` functions, 12 enum types in `public`, additional legacy `public` helpers, and `profiles.user_id → auth.users.id` |
| Shop Auth references | One referenced user and one email identity copied privately to Production, preserving UUIDs and the password hash. No sessions or refresh tokens copied; Staging has no Auth users |

The initial inspection was read-only. The execution checkpoint below records subsequent destination migrations, Production import and destination Auth configuration changes. The environment registry records verified organization/project refs and user-supplied accounts and app origins. Ledger refs/organization were also verified; all four app origins include `https://`.

The plugin's organization/project lists expose only the connected Shop organization, but direct `get_project` and read-only SQL calls to the known source ref succeeded in this session. There is no need to reconnect solely to repeat this inspection. Recheck access before export; do not assume list visibility establishes all effective permissions. Supabase's normal MCP authorization asks the user to select an organization. If a later export cannot access the source, use separately authorized source and destination database connections instead of moving the shared project. See [MCP authentication](https://supabase.com/docs/guides/ai-tools/mcp).

## Destination projects — creation complete

Both Shop projects belong to [Building Suit - Shop Suit](https://supabase.com/dashboard/org/rfolwdswbxddqtqaombc) and use Frankfurt, matching the source. The earlier Ireland suggestion was not used. No additional projects need to be created.

| Environment | Project | Application origin supplied by the user |
|---|---|---|
| Production | [fgdzjnsbcxfbiuogbmom](https://supabase.com/dashboard/project/fgdzjnsbcxfbiuogbmom) | `https://shop.building-suit.com` |
| Staging | [jvvelvftpfnlogalgxgv](https://supabase.com/dashboard/project/jvvelvftpfnlogalgxgv) | `https://stg.shop.building-suit.com` |

Account membership roles and the requested CEO Owner arrangement remain unverified. Existing project visibility does not verify those roles. No billing or membership changes are part of the file configuration review.

## Prepare the connection details

The files below now exist locally. Edit them in place; do not overwrite the populated app files with the blank examples.

| File | Already filled | Still needs the user's private value |
|---|---|---|
| `apps/shop-suit/.env.production` | Production app origin, project URL, enabled publishable key, matching Nuxt runtime URL/key, environment and isolated cookie prefix | None |
| `apps/shop-suit/.env.staging` | Staging app origin, project URL, enabled publishable key, matching Nuxt runtime URL/key, environment and isolated cookie prefix | None |
| `supabase/environments/shop-suit/.env.production` | Project/organization IDs and user-supplied credentials; live database and Management API access verified | None for the database connection |
| `supabase/environments/shop-suit/.env.staging` | Project/organization IDs and user-supplied credentials; live database and Management API access verified | None for the database connection |
| `.local/shop-transfer/.env.source` | Original project ref and working session-pooler connection; live read-only access verified after the user's password reset | None |

Create an account personal access token at [Access Tokens](https://supabase.com/dashboard/account/tokens), restricted to the necessary Shop projects/actions where supported. A publishable key cannot substitute for this CLI token. Use each project's saved database password, or copy its **Connect → Session pooler** connection string and replace the password placeholder. Percent-encode special characters in the URL password. Use a Session pooler connection when direct IPv6 connectivity is unavailable. The optional `SUPABASE_SECRET_KEY` can remain empty for the initial CLI database backup/restore.

All five files are ignored by Git and have owner-only read/write permissions (`0600`). The committed `.example` files remain blank templates. The local-development `apps/shop-suit/.env` continues to use the disposable local database.

Keep populated connection files and exports private; never paste database passwords, Auth credentials, secret keys or access tokens into chat or committed documentation. The source URL identifies `jkdncdexqcymwbihwdhp` correctly. After the user reset the source password, an initial pooler authentication failure cleared on retry and the scoped export succeeded. The supplied Shop account token returns HTTP 403 for source-project Management API access; the transfer used the separately authorized source database connection. The plugin also permitted scoped source catalog inspection. Do not reset a live source password merely to discover it without accounting for existing clients.

Both app environment files passed URL/key matching, environment, origin, cookie isolation and privileged-field checks. Each project accepted its publishable key at `/auth/v1/settings` with HTTP 200. All five existing environment-validation tests passed. Both `pnpm db:preflight shop-suit production` and `pnpm db:preflight shop-suit staging` now pass, and both destination database connections were authenticated live. These checks do not establish application deployment or email delivery.

For future recovery or refreshes, verify the source connection read-only and take a fresh scoped backup. Follow the [official backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) for tooling, but scope the actual transfer using the procedure below: a whole shared-project restore would include unrelated Building data.

## Execution checkpoint — 2026-09-19

Completed:

- Captured the live Shop catalog and compared it to an isolated local rehearsal database, then to both hosted destinations after relocation. Matching definitions include 342 columns, 101 constraints, 70 indexes, 26 views, 24 policies, 7 triggers, 37 functions (including legacy public helpers), 12 enums, table grants and 29 column grants. Comparison normalizes only the namespace relocation, catalog deparser qualification, ACL ordering and CRLF/LF line endings.
- Added the forward migration `20260918230919_preserve_shop_service_role_grants.sql`. It restores the source's existing service-role privileges on 49 relations and 16 legacy functions explicitly, without relying on project defaults. Browser grants and RLS remain unchanged. Original migration files were preserved.
- Saved Staging's pre-migration schema backup in the ignored `.local/shop-transfer/staging-before-schema.sql`; verified the destination had no business tables or Auth users. This is a destination schema recovery artifact, not a source data backup.
- Ran `pnpm db shop-suit db push --project-ref jvvelvftpfnlogalgxgv --dry-run --skip-vault`, then the same command with `--yes` instead of `--dry-run`. Applied versions: `20260918213353`, `20260918213355`, `20260918230919`. No hosted seed was included.
- Saved a private, consistent source snapshot at `2026-09-18T23:33:52Z` using a repeatable-read, read-only transaction. It contains all 25 business tables and only the Auth user/identity referenced by Shop profiles. Additional PostgreSQL 17 schema/data dumps and the inspected catalog are retained privately. The source has no MFA factors or pending Auth tokens for this user, and no Shop cron jobs were found.
- Rehearsed the exact snapshot restore in a rolled-back transaction in the isolated local database. Preserved row values and password hashes without printing them. The import explicitly maps business tables to `public`, uses only supported writable Auth columns, requires an empty destination and prevents replaying business/Auth triggers. It restores normal trigger behavior and validates every foreign key, row count and full-row SHA-256 fingerprint before commit; primary keys, unique constraints, checks and not-null constraints remain enforced during import.
- Backed up Production's initial schema and verified it had no business tables or Auth users. Ran the same migration dry run and apply against the explicit Production ref `fgdzjnsbcxfbiuogbmom`, with all three versions applied and no seed. Its catalog and grants matched the source after namespace normalization.
- Committed the verified Production restore at `2026-09-18T23:41:34Z` (2026-09-19 in Cairo): 17 business rows across 25 tables, one Auth user and one identity. Every table's count and SHA-256 content fingerprint matched the backup after commit. A fresh read of all 27 scoped source tables also matched at `23:42:08Z`. All foreign keys passed validation; no source sessions or refresh tokens were copied. The source remains intact. This verifies the copy at that checkpoint, not future source writes or an application cutover.
- Passed owner-bootstrap, product-catalog, inventory-adjustment, service-catalog and expense-ledger suites in both the isolated local rehearsal and hosted Staging. Each hosted suite ran with synthetic catalog/users inside a rolled-back transaction; Staging retains zero Auth users and shops. Anonymous access to the allowed public portal columns returned HTTP 200.
- Read-only REST checks after import returned Production's one visible portal and two public plans. Both projects denied anonymous reads of private profiles and shops with HTTP 401, and expose only `public` and `graphql_public` through PostgREST. Existing environment-validation tests, both environment preflights and `git diff --check` passed. No write fixtures were run against Production; hosted browser and email journeys remain unrun.
- Both destinations' security advisors reported no warnings/errors and one informational notice for the intentionally RPC-only `public.stock_adjustment_requests` table, whose RLS has no direct-access policies. See [RLS without a policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Set and re-read each destination's Auth Site URL and exact `/auth/reset-password` redirect for its own application origin. Set email OTP length to six digits to match Shop's form, retaining the one-hour expiry. The initial provider default was eight digits. See [Auth configuration API](https://supabase.com/docs/reference/api/v1-update-auth-service-config).
- Found no source Shop Realtime publications, Shop-named/schema-referencing Storage policies, external foreign tables, sequences, inbound cross-schema foreign keys or obvious file/URL columns. This is a scoped dependency check, not proof that no external integration exists.

Still required:

1. Configure custom SMTP and the committed confirmation template containing `{{ .Token }}` in each destination. Both currently lack custom SMTP and the OTP confirmation template; real email delivery/signup/recovery remain unverified. Provider credentials and the sending-domain setup are still needed.
2. Configure/deploy the applications at their supplied origins, using the already-populated `.env.production` and `.env.staging` values in the hosting environment. Staging's Shop portal and plan catalog are now populated; create synthetic users for browser testing. DNS, hosting and application deployment have not been changed.
3. Before routing real traffic to Production, stop Shop writes at the source or reconcile any changes since the verified snapshot, then repeat the source-to-target checks. Verify browser/Auth journeys with fresh destination sessions and perform the cutover. Do not blindly replay the empty-destination import against populated Production.

Private catalog comparisons, sanitized command logs, Auth setting snapshots and test results are under `.local/shop-transfer/`. The completed backup/restore bundle is `.local/shop-transfer/backup-2026-09-18T233351728Z/`, including `manifest.json`, `scoped-data-and-auth.json`, schema/data dumps, `production-before-schema.sql`, guarded restore SQL and reconciliation results. The directory is owner-only and backup files use `0600`; credentials and backups remain ignored. The isolated local database `shop_transfer_rehearsal_20260919` contains schema only and is separate from both product databases. Its successful rollback rehearsal supplies restore evidence without leaving a local copy of the user's credentials/data in database tables.

## Staging plan catalog follow-up — 2026-09-19

The initial schema-only Staging setup left `public.portals` and `public.plans` empty, so the application's public plan query returned no plans. On the user's follow-up, initialized the `shop-crm` portal and its Basic/Pro catalog in the verified Staging project `jvvelvftpfnlogalgxgv` in one transaction. This was a data-only initialization; the three applied migration versions and existing policies/grants remain unchanged.

Both plans match Production's public catalog: Basic at EGP 799 monthly and Pro at EGP 1,199 monthly, each with a 30-day trial and matching feature limits, inventory entitlement, visibility and ordering. Staging generated its own portal/plan UUIDs. Production's Stripe product/price references were not copied; those fields remain unset until a separate staging billing integration is configured. No Auth users, shops or customer records were copied.

Verification used each project's publishable key and the exact selection, filters and ordering in `apps/shop-suit/app/composables/usePlans.ts`. Staging returned HTTP 200 with both plans; all public plan fields matched Production after excluding environment-specific IDs. The final Staging counts are one portal, two plans, zero Auth users and zero shops. The private initialization SQL and verification result are `.local/shop-transfer/staging-catalog.sql` and `.local/shop-transfer/staging-catalog-verification.json`.

## Source, destination and preservation

Source: shared Building project `jkdncdexqcymwbihwdhp`, business schema `shop_crm`, helpers `shop_private`, referenced public enum types and managed Auth identities. Destinations: the dedicated Shop staging and production projects entered manually in `docs/architecture/environments.json`.

Business objects finish in `public`; the portal key remains `shop-crm`. Preserve all business column definitions, stored values, IDs, relationships, tenant policies, grants and product semantics. `ALTER ... SET SCHEMA` preserves rows and dependencies inside one database; it does not copy data between projects. A whole-project organization transfer moves the entire shared source, so do not use it to extract Shop. [Supabase project transfer](https://supabase.com/docs/guides/platform/project-transfer).

The committed fresh-project chain contains a source baseline reconstructed from the preserved schema snapshot and nine later migrations, followed by namespace relocation and explicit service-role grant preservation. It matches the inspected live source as described above, but future transfers still require a fresh drift check. The 14 original Shop migration files remain unchanged under `supabase/legacy/shop-suit`.

## Stage the transfer before production

1. Complete [manual setup](../shared/supabase-manual-setup.md), including the Free/Owner quota decision. Verify the target ref/organization with the provider, then run `pnpm db:preflight shop-suit staging`. Never aim the dedicated baseline at the populated shared source.
2. Inventory the current source read-only: tables, columns/defaults/types, constraints/indexes, views, functions/search paths, triggers, RLS/policies/grants, sequences, migration history, extensions, Auth hooks, buckets/objects, Realtime publications and scheduled jobs/functions. Identify dependencies on other source schemas and distinguish Shop-owned objects from other products.
3. Produce a scoped schema/data export and verified restore point without committing customer data or credentials. Include all `shop_crm` tables and rows, referenced enum types/helpers and the exact Auth users/identities required by Shop profiles. Preserve existing user UUIDs and credential associations through a provider-supported migration procedure. Shared source users may need a copy in Shop while remaining in the source; do not delete or merge them. Do not restore the entire shared `auth` schema into Shop. Sessions/JWTs from the source are not valid in the new project, so plan a fresh login/recovery check after cutover. Rehearse with synthetic users/data in Staging by default; importing source customer data or credentials into Staging needs a separately agreed scope. The final Production import preserves the source records.
4. Compare the live source definitions with the new baseline before applying it to an empty target. If equivalent, apply the baseline, `20260918213355_shop_public_schema.sql` and the following service-role grant migration as the three-version chain. Then use the rehearsed, transactional import that maps business data directly into `public` and scopes Auth to referenced users/identities. The completed transfer used the validation and trigger controls described in the checkpoint above. If the source has drifted, prepare a reviewed new forward adjustment/import artifact before restoring. Do not edit original migrations or blindly overlay a dump on already-created objects. Reconcile the target migration ledger with the exact steps actually applied; do not replay legacy chains or mark unexecuted SQL as applied.
5. The relocation fails on public-name collisions and drops the now-empty source schema without `CASCADE`. Review any failure rather than dropping conflicting objects. Verify function-body/search-path rewrites, explicit grants and PostgreSQL’s OID-bound constraints/views/policies. Keep `shop_private` unexposed. Expose `public` for the client API and preserve existing privileges/RLS.
6. Transfer any Shop-owned Storage objects and bucket policies through supported interfaces; preserve object keys/metadata and references. Configure only Shop-specific functions, jobs, extensions, Realtime tables, hooks, provider integrations and secrets. A SQL dump alone does not move stored file bytes or provider configuration. Do not inherit unrelated Ledger/Building services.
7. Configure this target’s Auth Site URL, callback allowlist, OTP template and SMTP. Use Shop staging origin and credentials; keep Ledger and production settings separate. Replace the staging app’s URL/publishable key/cookie prefix, deploy within the authorized test scope, and verify with synthetic or explicitly authorized staging data.
8. Reconcile per-table counts and deterministic content checksums plus column/constraint/index definitions, Auth references, memberships, active plan access and audit/inventory totals. Test owner/outsider/anonymous access, signup/OTP/login/logout/recovery, product/service mutations, FIFO inventory and expense/period behavior. Verify rollback/restore before advancing.

## Production cutover and stop

Production's initial copy is complete. Before cutover, use a bounded write-freeze or reconciled delta strategy and complete fresh source-to-target counts/checksums after writes stop. Any refresh must account for existing target data; the one-time restore intentionally refuses nonempty tables. Switch only Shop production’s refs, URL/key, origin/callback and provider settings; issue new sessions. Check health, authorized/denied flows and business invariants before accepting writes normally.

Retain the shared source and restore points until acceptance. If rollback is needed, prevent divergent writes, account for any target writes, then restore the known configuration/data consistently. Do not simply switch back after unaccounted writes.

Record refs, versions, reconciliation results and recovery evidence without secret values/customer payloads. Stop when the separate projects and required journeys pass. Global Auth, business-column redesign and unfinished Shop product features are outside this transfer.
