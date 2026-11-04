# Isolated HQ schema — local review candidate, not an activated migration

The candidate is `apps/company-hq/supabase/prepared/20261104002826_isolated_hq_review_only.sql`. It is deliberately outside every application's `supabase/migrations` directory and has not been applied remotely. The Supabase CLI generated its filename in a disposable `/tmp` project; the empty file was moved to `prepared/` before authoring. CLI global state used the documented `SUPABASE_HOME` override in `/tmp`, without reading existing credentials, linking a project or starting services.

## Inventory to preserve

Trusted parent inspection supplied this current inventory; this worker made no project call:

| Environment | Requested ref | Existing scope and wiring |
| --- | --- | --- |
| Staging | `lwecnmsosfwovlzxauml` | 36 public tables plus private Super Admin/control-plane objects; populated admin, integration and release records and Auth users; existing GitHub deployment `./apps/super-admin-suit`, following `stg`. |
| Production | `dfeiuxsqhgzontefmrjc` | Existing control-plane inventory, also 36 public tables plus private objects; existing GitHub deployment `./apps/super-admin-suit`, following `main`. |

Both projects are on Free plans and have no scheduled backups. These facts do not establish free capacity for HQ, data ownership transfer or permission to reconfigure an existing product. Do not delete or clear data, replace project mappings, change deploy roots/branches, reset Auth, replay unrelated migrations, or alter existing grants and policies. Earlier project-access denials remain a restriction on this worker; later parent inventory is evidence, not permission for this worker to retry project access.

## Candidate behavior

The SQL creates only the new `company_hq` namespace and HQ-owned objects. A pre-existing namespace without the expected installation marker causes a failure before alteration. Application is transactional. Reapplying the candidate preserves an existing HQ workspace and its revision; there is no seed, import or overwrite. Initialization is a separate owner-only function that refuses to overwrite an existing workspace.

The candidate contains a workspace document/revision table, hashed HQ session records with non-destructive revocation, a bounded login-attempt record, and an installation marker. Four tables enable RLS. All functions use invoker security and an empty search path with qualified references. Document writes validate the required envelope, historical `ceo`/`hr` ownership, zero budgets and the eight-million-byte UTF-8 bound. Compare-and-swap prevents stale workspace overwrites. Application identity, task approvals and execution authority still belong to the existing server contracts; SQL validation alone does not run agents or authorize work.

All schema/table/function/sequence privileges are revoked from `PUBLIC`, `anon`, `authenticated` and `service_role`. There is no application activation grant, browser policy, service credential, PostgREST exposure change, Realtime publication, provider-schema modification, scheduled job or external request. The database owner can inspect/test the candidate, but the running application cannot use it. Reapplying this review-only candidate retains its disabled privileges; do not treat it as an online upgrade script after a future activation.

The existing historical migration `apps/company-hq/supabase/migrations/20261103194908_hq_dedicated_workspace.sql` creates `public.hq_*` objects and grants `service_role` access. **Do not apply it to either populated requested project.** It remains preserved as prior development evidence. Do not put this candidate into `apps/super-admin-suit/supabase/migrations` or run a blanket migration push. Existing HQ local `config.toml` is a development scaffold, not a hosted configuration to import; its local service defaults must not be used to enable hosted Realtime or other providers.

## Remaining integration work before any remote action

1. Obtain fresh, project-specific access and mutation authorization. Reconfirm the entire live inventory, immutable project IDs, ownership and current GitHub/provider wiring. Stop if `company_hq` already exists without a verified owner/history.
2. Prepare an authorized export of affected schema/data, grants/policies, Auth configuration and required recovery material; securely verify an actual restore in a disposable environment. No scheduled backup is available to assume away this requirement. Do not create a paid backup service or copy secrets into source or artifacts.
3. Review a schema-scoped HQ server identity and exact invocation privileges. The current remote adapter calls public PostgREST RPCs; it is **not wired to this isolated schema**. A future adapter change must bind the approved environment and custom schema, with no fallback to public or Super Admin. PostgREST schema exposure and dedicated auth authorization require a separate reviewed change.
4. Review zero-cost host capacity, storage persistence and concurrent connection limits. Keep backend/model/hosting gates closed until proven. ChatGPT subscriptions or advertised credits are not API allowance evidence.
5. Only after those approvals, review and apply the exact candidate to staging through an explicit environment-bound action. Compare pre/post inventory, prove every application role remains denied, and test the later approved HQ-only grants separately. Never apply both schemas or both projects as one implicit batch.
6. Private invalidation delivery is a subsequent additive change. Do not publish the whole workspace JSON or reuse Supabase Auth users merely by email. Prove founder/topic/environment authorization and revocation first. Production needs its own preservation evidence and authorization.

## Disable and rollback without deleting history

The normal recovery action is to disable HQ application traffic and its new update/subscription path, leave existing Super Admin deployment wiring intact, and return the HQ application to the prior reviewed commit. Keep `HQ_BACKEND_SCOPE_VERIFIED=false` and `HQ_HOSTING_COST_VERIFIED=false`; do not alter credentials or connection targets as a shortcut.

If a future reviewed activation added HQ grants, a separately authorized owner may revoke only `company_hq` schema usage and HQ object privileges from the exact HQ/application roles that were granted them. Stop HQ-specific subscriptions/jobs if any were introduced. Revoke HQ sessions via their retained revocation field; do not delete Auth users or historical workspace evidence. Leave the new schema and retained data in place for inspection/export. No `DROP SCHEMA`, table truncation, project reset or permanent deletion is a rollback step.

If the candidate fails during its own transaction, roll back that transaction. If an unexpected change is detected outside HQ, stop further writes and use the verified recovery plan with the affected product owner; do not improvise a destructive restore over live control-plane records.

## Local evidence and limits

`tests/unit/isolated-schema.test.mjs` applies the exact file to disposable PGlite databases. A representative synthetic fixture includes 36 populated public tables, separate Auth users, a private control-plane table, pre-existing ACLs and a public function. Tests compare rows and schema/ACL/publication metadata before/after application and reapplication, check retained HQ data, reject an unrecognized namespace, deny all application roles, and exercise stale CAS, byte limits, zero budgets, session revocation and login limits.

These are synthetic preservation tests, not a snapshot of either hosted project and not proof of hosted migration compatibility. They do not verify real Supabase extensions, provider configuration, project grants, storage, Auth integration, restore readiness or deployment. Final pass/fail results belong in the parent validation handoff. No remote SQL or project mutation has occurred.
