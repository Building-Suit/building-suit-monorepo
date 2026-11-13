# Dedicated HQ backend and $0 gate

Local verification uses Node 24's built-in SQLite; the founder subsequently selected existing Supabase refs for hosted staging/production. The remote adapter/migration are prepared but hosted access is denied. See DEPLOYMENT.md; no provider is silently substituted. The office, founder login, CEO/HR bridge, messages, task approval/status/evidence and persistence require no external model API, managed database, paid fallback or service provisioning. Existing managed-cloud workspace tests use synthetic data and do not create a hosted service. This is a verified no-external-service software path, not a promise of free unlimited hosting or AI.

The accessible Supabase connection exposed one Free organization belonging to a different project, with one active project and one inactive project. No HQ organization was exposed. Current Supabase billing documentation says two active Free projects across Owner/Admin memberships; paused projects do not count. This does not establish account-wide spare capacity or a dedicated HQ production/staging pair. No project was created, reused, paused, resumed or altered; no other product's data/credentials were used. The independent HQ does not inherit the monorepo's mandatory Supabase-pair architecture.

Public hosting is blocked until the founder selects an authorized existing destination and actual read-only checks establish:

- $0 plan and spare quotas, with paid overages/fallbacks disabled and no new subscription.
- Sufficient Node 24 capacity. SQLite mode additionally requires a private persistent writable disk for its database, WAL and backups; Supabase mode uses the verified remote project and needs no persistent local database disk.
- A verified backup/restore procedure and adequate capacity. SQLite requires a single-writer persistent deployment; Supabase supports stateless replicas through revision-checked remote transactions. Never put SQLite on an ephemeral/replicated serverless filesystem.
- TLS, intended private access and secret configuration, exact application origin, tested sessions/bridge and acceptable provider data handling.

Only then set `HQ_HOSTING_COST_VERIFIED=true` for that host. This is a fail-closed configuration guard and an operator attestation, not an API that proves billing. Production publication still requires actual scoped founder approval. No always-on autonomous employee is installed by the website.

Sources read 3 November 2026: Company Brain Infrastructure and Hosting (Oracle availability is founder-reported, not verified capacity); Supabase organization/project metadata; [billing FAQ](https://supabase.com/docs/guides/platform/billing-faq) and [billing overview](https://supabase.com/docs/guides/platform/billing-on-supabase). The old privately published Sites/D1 website remains historical and was not changed by this work.
