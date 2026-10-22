# Explicit Supabase access before October 30

Owner authorization: fix the audited grants and migration defaults across the account so the 2026-10-30 platform change does not remove access needed by the applications. The Supabase notice affects new public tables; existing grants are retained. [Official announcement](https://github.com/orgs/supabase/discussions/45329), [grants and defaults](https://supabase.com/docs/guides/api/securing-your-api).

## Scope and identity

The authenticated account listed 16 projects across 9 organizations. All 13 active projects received the access-only migration on 2026-10-22. `docs/architecture/environments.json` records immutable project/organization identifiers. Newly recorded catalog identities do not activate hosted runtimes or relax clinical, release, plan or provider gates. Three inactive projects remain pending the owner's restoration decision.

No business rows, table structures, identities, RLS policies, RPC signatures, app URLs, credentials, scheduled jobs, paid plans, release publication state or unrelated pending migrations were changed. The Finance view now enforces explicit tenant scope behind a security barrier while its base tables remain private; legacy function execution/search paths are hardened. The worktree started at verified `origin/stg` 12407f55cc1f09076723dfeb9948987bd49ebcae, with no active shared-stack parent.

## Applied versions and results

| Target | Version | Result |
|---|---|---|
| Ledger staging + production | 20261022182716 | Existing table/function access retained; excess table verbs and client trigger execution removed |
| Shop staging + production | 20261022182717 | Protected RPC/table contracts retained; client trigger execution removed |
| Doctor staging + production | 20261022182718 | Synthetic administrative permissions retained; no additional client access |
| Super Admin staging + production | 20261022182719 | Admin/session and server contracts retained; no additional client access |
| Legacy Finance | 20261022183000 + 20261022195000 | Excess table verbs removed; follow-up restores private-base compatibility and scopes account_hold_totals behind a security barrier |
| Legacy Building | 20261022183000 | Excess table verbs removed; reviewed privileged functions have empty search paths; three background jobs are server-only |
| Mail production | 20261022183000 | Per-user CRUD retained; new-user trigger has empty search path and no direct client execution |
| App/landing production | 20261022183000 | Excess table verbs removed; admin helper has empty search path |
| Automation production | 20261022183000 | Protected control roles retained; no browser-role access added |
| Inventory staging + production | 20261022182720 prepared, not applied | Paused; apply only after authorized restoration and actual schema review |
| Automation staging | operations SQL prepared, not applied | Paused; restoration can restart scheduled jobs and is not implicit authorization |

Existing client TRUNCATE grants were removed from 25/28 Ledger tables per environment (anon/authenticated), 37/37 legacy Building tables, 6/6 Finance tables, and 3/3 App tables. REFERENCES, TRIGGER and PostgreSQL 17 MAINTAIN were also revoked from client roles and PUBLIC on application tables/views. Service roles retain their previously allowed server capabilities.

The three server-only Building jobs are fn_process_expired_votes, fn_schedule_next_vote_close and fn_generate_monthly_charges. PostgreSQL owners/scheduled jobs and service_role retain execution. Trigger functions retain their owner execution; PostgreSQL checks trigger function EXECUTE at trigger creation, not each firing. The public geographic lookup and membership helper retain their existing business availability; no new row-authorization behavior is inferred.

## Compatibility and future objects

The forward migrations contain concrete reviewed table/sequence/routine grants, not blanket CRUD grants. Existing PUBLIC routine execution is materialized as the existing client-role access, then PUBLIC execution is revoked. Private schemas remain outside the Data API; their policy helpers retain the execution needed by existing RLS/invoker calls. Missing objects from unrelated pending releases are skipped rather than deployed. In particular, Shop production does not receive the three staging-only website-builder/offer tables through this task.

New PostgreSQL-owned objects receive no automatic API role privileges. Automation also restricts its dedicated migration owner's defaults. Provider-owned schemas and supabase_admin defaults are left intact; a PostgreSQL-owned new-object probe verifies actual behavior instead of inferring it from a Dashboard checkbox. No unsupported provider role ownership change is used.

Every new migration must explicitly name role grants or revokes and enable table RLS. For a private RPC-only table, explicit REVOKE ALL is correct; do not grant CRUD just to satisfy a checker. Public/authenticated/server RPCs must declare EXECUTE access deliberately. RLS helpers need explicit execution for their callers. The static guard is a missing-declaration check, not a full SQL security analyzer; a named revoke can legitimately leave an object entirely inaccessible.

The offline exporter `node tooling/database/explicit-access.mjs <reviewed-catalog.json> <new-migration.sql> <application-schema...>` accepts schema/ACL metadata only. Review the intended grants and owner roles before generating a **new** migration. Never regenerate, rewrite or replay these applied files to change their grants.

## Deployment and recovery

Changes were serialized and verified in staging first. Each target had a read-only catalog snapshot and a rollback-only trial. The reviewed SQL and its exact version/name/statements were recorded together in one transaction in supabase_migrations.schema_migrations. This deliberately applied one access migration, not every pending file through db push. No old migration row was edited. Each source-file digest was recorded in the ignored owner evidence directory.

Access-only recovery SQL and the before/after metadata are stored under `.local/audits/supabase-oct30` in the original checkout. They contain no credentials or customer rows. Restore only the reviewed target's affected ACLs/defaults/search paths/view option; verify identity, concurrent schema changes and effective permissions first. Prefer a new reviewed forward recovery migration. Do not reset a database, undo business data, remove old migration history or use a generic grant-all rollback.

For a paused target, first obtain the owner's restoration choice. Reverify organization/ref, inventory the actual schemas/defaults and compare production/staging before applying a tailored forward migration. The prepared Inventory migration only sets safe defaults and removes unsafe table verbs; it must not be treated as a reconstructed access contract for an unseen schema. Automation production's named control-object grants likewise require a comparison with staging before reuse. Never resume Automation jobs implicitly. No paid resource was created.

## Verification

- All 13 rollback-only trials passed; effective SELECT/INSERT/UPDATE/DELETE and non-trigger RPC permissions matched the prior contracts, except the intended three legacy server-only jobs.
- Every committed application migration created and dropped a transient empty table, identity sequence and function in its own transaction to verify that new objects grant **none** of the API roles access. No business records or persistent probe objects were created.
- All 13 committed deployments passed the same effective-permission comparisons.
- Shop and Ledger public plan RPCs and Doctor runtime markers returned HTTP 200 in both environments. Auth health returned HTTP 200 for the other seven active projects. Health checks do not certify every authenticated application journey.
- A post-deployment role probe caught that the initial Finance invoker change could not read intentionally private base tables. A separate forward repair, `finance_view_scope.sql`, now enforces caller identity before user filters with `security_barrier=true`; it preserves owner/server execution without granting direct base-table reads. The committed repair passed no-identity and foreign-user checks. Its disposable PostgreSQL regression uses synthetic accounts to verify own totals, foreign denial, missing identity denial, private base-table denial and server access.
- New static guard regressions, local Doctor target isolation and environment checks are verified separately; final check results accompany the PR.

A final live catalog re-audit checks defaults, client table verbs, function execution/search paths and migration history. This task addresses the October 30 access transition and the audited excess grants; it is not a certification of all policy logic, future features, clinical readiness, billing or third-party availability.

For legacy Finance, apply `finance.sql` **and then** `finance_view_scope.sql`; the latter is a required compatibility/security repair. The original applied file is immutable. Do not publish the intermediate invoker-only state as the final fix.
