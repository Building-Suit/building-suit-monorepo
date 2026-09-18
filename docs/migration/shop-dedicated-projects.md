# One-time Shop transfer to dedicated projects

This procedure is bounded to the user’s requested Shop separation. It is not an ongoing AI-agent workflow. The destination organization has been verified; project creation and the hosted transfer remain pending.

## Verified setup and access — 2026-09-19

| Item | Observed state |
|---|---|
| Destination organization | `Building Suit - Shop Suit`, ID `rfolwdswbxddqtqaombc` |
| Account | `shop@building-suit.com`, supplied by the user; account membership roles were not independently verified |
| Organization plan | Free, verified through the Supabase plugin |
| Destination projects | The plugin returned no projects for the connected organization |
| Creation quote | $0/month for a new project; creation still requires the tool's cost confirmation and provider quota checks |
| Source project | `Building Suit`, ref `jkdncdexqcymwbihwdhp`, organization `teqawtspijttcalwjrhz`, healthy, `eu-central-1` |
| Source Shop objects | 25 tables, 26 views, 24 RLS policies; all 25 tables have RLS enabled |
| Dependencies already identified | 8 `shop_crm` functions, 13 `shop_private` functions, 12 enum types in `public`, additional legacy `public` helpers, and `profiles.user_id → auth.users.id` |
| Shop Auth references | One distinct user referenced by Shop profiles; no credential or user payload was retrieved |

These are read-only observations, not a backup, a complete dependency audit, or proof that the existing baseline exactly matches every live definition. No project, schema, business row, account membership or application deployment was changed during this inspection. The environment registry records the verified Shop organization and the user-supplied account; target refs remain blank.

The plugin's organization/project lists expose only the connected Shop organization, but direct `get_project` and read-only SQL calls to the known source ref succeeded in this session. There is no need to reconnect solely to repeat this inspection. Recheck access before export; do not assume list visibility establishes all effective permissions. Supabase's normal MCP authorization asks the user to select an organization. If a later export cannot access the source, use separately authorized source and destination database connections instead of moving the shared project. See [MCP authentication](https://supabase.com/docs/guides/ai-tools/mcp).

## Create the two projects

Codex can provision them through the connected plugin after its explicit cost-confirmation step. The proposed names are **Production** and **Staging**, both in **eu-west-1 (Ireland)** to match the screenshot. The existing source is in Frankfurt (`eu-central-1`); matching the screenshot is a proposed region choice, not a claim that the source uses Ireland. Creation has not yet been requested from Supabase.

To create them yourself:

1. Sign in with `shop@building-suit.com` and open the [Shop organization](https://supabase.com/dashboard/org/rfolwdswbxddqtqaombc).
2. Click **New project**. Check that the organization is **Building Suit - Shop Suit**.
3. Set the name to **Staging**, choose the agreed region, generate a strong database password and save it in your password manager. Review the displayed plan/cost, then create the project.
4. Wait until it is healthy. Repeat for **Production**, with its own password and the same region. These are two independent projects, each with its own database, Auth, Storage, URL and keys.
5. Record each actual project ref under `products.shop-suit.staging` or `products.shop-suit.production` in `docs/architecture/environments.json`. Verify the owning organization using the provider before assigning an environment.

The two active Free-project allowance applies across organizations where an account is Owner or Administrator. The $0 quote does not establish remaining quota. If creation is refused because an account also owns the Ledger projects or other Free projects, resolve the account-role/plan arrangement before retrying; do not pause another product or upgrade a plan implicitly. See [Supabase billing rules](https://supabase.com/docs/guides/platform/billing-on-supabase).

## Prepare the connection details

For each destination, copy `supabase/environments/shop-suit/.env.<environment>.example` to the same filename without `.example`. Fill the ignored file using that project's **Connect** panel and the [manual setup guide](../shared/supabase-manual-setup.md). Use a Session pooler connection for migration tooling when direct IPv6 connectivity is unavailable. Keep the original source connection separate, for example in the ignored `.local/shop-transfer/.env.source`, with `SHOP_SOURCE_PROJECT_REF` and `SHOP_SOURCE_DB_URL`.

Keep populated connection files and exports private; never paste database passwords, Auth credentials, secret keys or access tokens into chat or committed documentation. The existing source's database password was not available in the inspected deployment files or process environment. The plugin can inspect the source, while a CLI backup/restore needs its own authenticated database connection. Do not reset a live source password merely to discover it without accounting for existing clients.

Use the matching app environment examples for browser-safe project URLs and publishable keys. The staging and production application origins are still required for the preflight and Auth callback settings. Follow the [official backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) for tooling, but scope the actual transfer using the procedure below: a whole shared-project restore would include unrelated Building data.

## Source, destination and preservation

Source: shared Building project `jkdncdexqcymwbihwdhp`, business schema `shop_crm`, helpers `shop_private`, referenced public enum types and managed Auth identities. Destinations: the dedicated Shop staging and production projects entered manually in `docs/architecture/environments.json`.

Business objects finish in `public`; the portal key remains `shop-crm`. Preserve all business column definitions, stored values, IDs, relationships, tenant policies, grants and product semantics. `ALTER ... SET SCHEMA` preserves rows and dependencies inside one database; it does not copy data between projects. A whole-project organization transfer moves the entire shared source, so do not use it to extract Shop. [Supabase project transfer](https://supabase.com/docs/guides/platform/project-transfer).

The committed fresh-project chain contains a source baseline reconstructed from the preserved schema snapshot and nine later migrations, followed by a namespace-only forward migration. It is locally verified but is not an assertion that a future live source has no drift. The 14 original Shop migration files remain unchanged under `supabase/legacy/shop-suit`.

## Stage the transfer before production

1. Complete [manual setup](../shared/supabase-manual-setup.md), including the Free/Owner quota decision. Verify the target ref/organization with the provider, then run `pnpm db:preflight shop-suit staging`. Never aim the dedicated baseline at the populated shared source.
2. Inventory the current source read-only: tables, columns/defaults/types, constraints/indexes, views, functions/search paths, triggers, RLS/policies/grants, sequences, migration history, extensions, Auth hooks, buckets/objects, Realtime publications and scheduled jobs/functions. Identify dependencies on other source schemas and distinguish Shop-owned objects from other products.
3. Produce a scoped schema/data export and verified restore point without committing customer data or credentials. Include all `shop_crm` tables and rows, referenced enum types/helpers and the exact Auth users/identities required by Shop profiles. Preserve existing user UUIDs and credential associations through a provider-supported migration procedure. Shared source users may need a copy in Shop while remaining in the source; do not delete or merge them. Do not restore the entire shared `auth` schema into Shop. Sessions/JWTs from the source are not valid in the new project, so plan a fresh login/recovery check after cutover. Rehearse with synthetic users/data in Staging by default; importing source customer data or credentials into Staging needs a separately agreed scope. The final Production import preserves the source records.
4. Compare the live source definitions with the new baseline before applying it to an empty target. If equivalent, initialize only the baseline, import the scoped Auth and business data using the actual foreign-key/dependency order, then apply `20260918213355_shop_public_schema.sql`. If the source has drifted, prepare a reviewed new forward adjustment/import artifact before restoring. Do not edit original migrations or blindly overlay a dump on already-created objects. Reconcile the target migration ledger with the exact steps actually applied; do not replay legacy chains or mark unexecuted SQL as applied.
5. The relocation fails on public-name collisions and drops the now-empty source schema without `CASCADE`. Review any failure rather than dropping conflicting objects. Verify function-body/search-path rewrites as well as PostgreSQL’s OID-bound constraints/views/policies. Keep `shop_private` unexposed. Expose `public` for the client API and preserve existing privileges/RLS.
6. Transfer any Shop-owned Storage objects and bucket policies through supported interfaces; preserve object keys/metadata and references. Configure only Shop-specific functions, jobs, extensions, Realtime tables, hooks, provider integrations and secrets. A SQL dump alone does not move stored file bytes or provider configuration. Do not inherit unrelated Ledger/Building services.
7. Configure this target’s Auth Site URL, callback allowlist, OTP template and SMTP. Use Shop staging origin and credentials; keep Ledger and production settings separate. Replace the staging app’s URL/publishable key/cookie prefix, deploy within the authorized test scope, and verify with synthetic or explicitly authorized staging data.
8. Reconcile per-table counts and deterministic content checksums plus column/constraint/index definitions, Auth references, memberships, active plan access and audit/inventory totals. Test owner/outsider/anonymous access, signup/OTP/login/logout/recovery, product/service mutations, FIFO inventory and expense/period behavior. Verify rollback/restore before advancing.

## Production cutover and stop

Repeat the verified procedure against the production destination after source/target backups and a bounded write-freeze or reconciled delta strategy. Complete the final source-to-target counts/checksums after writes stop. Switch only Shop production’s refs, URL/key, origin/callback and provider settings; issue new sessions. Check health, authorized/denied flows and business invariants before accepting writes normally.

Retain the shared source and restore points until acceptance. If rollback is needed, prevent divergent writes, account for any target writes, then restore the known configuration/data consistently. Do not simply switch back after unaccounted writes.

Record refs, versions, reconciliation results and recovery evidence without secret values/customer payloads. Stop when the separate projects and required journeys pass. Global Auth, business-column redesign and unfinished Shop product features are outside this transfer.
