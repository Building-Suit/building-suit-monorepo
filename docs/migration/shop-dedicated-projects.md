# One-time Shop transfer to dedicated projects

This procedure is bounded to the user’s requested Shop separation. It is not an ongoing AI-agent workflow. No hosted transfer has been performed; target organizations/refs/credentials are intentionally unconfigured.

## Source, destination and preservation

Source: shared Building project `jkdncdexqcymwbihwdhp`, business schema `shop_crm`, helpers `shop_private`, referenced public enum types and managed Auth identities. Destinations: the dedicated Shop staging and production projects entered manually in `docs/architecture/environments.json`.

Business objects finish in `public`; the portal key remains `shop-crm`. Preserve all business column definitions, stored values, IDs, relationships, tenant policies, grants and product semantics. `ALTER ... SET SCHEMA` preserves rows and dependencies inside one database; it does not copy data between projects. A whole-project organization transfer moves the entire shared source, so do not use it to extract Shop. [Supabase project transfer](https://supabase.com/docs/guides/platform/project-transfer).

The committed fresh-project chain contains a source baseline reconstructed from the preserved schema snapshot and nine later migrations, followed by a namespace-only forward migration. It is locally verified but is not an assertion that a future live source has no drift. The 14 original Shop migration files remain unchanged under `supabase/legacy/shop-suit`.

## Stage the transfer before production

1. Complete [manual setup](../shared/supabase-manual-setup.md), including the Free/Owner quota decision. Verify the target ref/organization with the provider, then run `pnpm db:preflight shop-suit staging`. Never aim the dedicated baseline at the populated shared source.
2. Inventory the current source read-only: tables, columns/defaults/types, constraints/indexes, views, functions/search paths, triggers, RLS/policies/grants, sequences, migration history, extensions, Auth hooks, buckets/objects, Realtime publications and scheduled jobs/functions. Identify dependencies on other source schemas and distinguish Shop-owned objects from other products.
3. Produce a scoped schema/data export and verified restore point without committing customer data or credentials. Include Shop-owned records, referenced enum types/helpers and the exact Auth users/identities required by Shop profiles. Preserve existing user UUIDs and credential associations through a provider-supported migration procedure. Shared source users may need a copy in Shop while remaining in the source; do not delete or merge them. Sessions/JWTs from the source are not valid in the new project, so plan a fresh login/recovery check after cutover.
4. Compare the live source definitions with the new baseline before applying it to an empty target. If equivalent, initialize only the baseline, import the scoped Auth and business data using the actual foreign-key/dependency order, then apply `20260918213355_shop_public_schema.sql`. If the source has drifted, prepare a reviewed new forward adjustment/import artifact before restoring. Do not edit original migrations or blindly overlay a dump on already-created objects. Reconcile the target migration ledger with the exact steps actually applied; do not replay legacy chains or mark unexecuted SQL as applied.
5. The relocation fails on public-name collisions and drops the now-empty source schema without `CASCADE`. Review any failure rather than dropping conflicting objects. Verify function-body/search-path rewrites as well as PostgreSQL’s OID-bound constraints/views/policies. Keep `shop_private` unexposed. Expose `public` for the client API and preserve existing privileges/RLS.
6. Transfer any Shop-owned Storage objects and bucket policies through supported interfaces; preserve object keys/metadata and references. Configure only Shop-specific functions, jobs, extensions, Realtime tables, hooks, provider integrations and secrets. A SQL dump alone does not move stored file bytes or provider configuration. Do not inherit unrelated Ledger/Building services.
7. Configure this target’s Auth Site URL, callback allowlist, OTP template and SMTP. Use Shop staging origin and credentials; keep Ledger and production settings separate. Replace the staging app’s URL/publishable key/cookie prefix, deploy within the authorized test scope, and verify with synthetic or explicitly authorized staging data.
8. Reconcile per-table counts and deterministic content checksums plus column/constraint/index definitions, Auth references, memberships, active plan access and audit/inventory totals. Test owner/outsider/anonymous access, signup/OTP/login/logout/recovery, product/service mutations, FIFO inventory and expense/period behavior. Verify rollback/restore before advancing.

## Production cutover and stop

Repeat the verified procedure against the production destination after source/target backups and a bounded write-freeze or reconciled delta strategy. Complete the final source-to-target counts/checksums after writes stop. Switch only Shop production’s refs, URL/key, origin/callback and provider settings; issue new sessions. Check health, authorized/denied flows and business invariants before accepting writes normally.

Retain the shared source and restore points until acceptance. If rollback is needed, prevent divergent writes, account for any target writes, then restore the known configuration/data consistently. Do not simply switch back after unaccounted writes.

Record refs, versions, reconciliation results and recovery evidence without secret values/customer payloads. Stop when the separate projects and required journeys pass. Global Auth, business-column redesign and unfinished Shop product features are outside this transfer.
