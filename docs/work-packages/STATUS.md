# Monorepo implementation status

Checkpoint: 2026-09-19, updated for ADR 0002. The local monorepo and independent Supabase structure are complete. All four project refs are configured. The Shop transfer record reports the Production schema/scoped data copy and Staging schema verification complete; SMTP, deployed application journeys and final cutover remain pending. Single Auth is explicitly deferred.

| Area | Result |
|---|---|
| Workspace and preservation | Three apps, 11 shared packages, one pnpm/Turbo graph and lockfile. All 502 source hashes and 80 historical SQL hashes unchanged. |
| Design and documentation | Canonical Building tokens/brand resources, complete original documentation, extracted maintained specifications and live component catalogue. |
| Shared UI/behavior | Ledger landing/auth/signup/shell reused by both products; one PrimeVue table across all 30 product tables; shared dialogs, wizard, confirmations and themes. |
| Independent Supabase architecture | App-owned CLI roots, separate local databases, production/staging templates and explicit environment validation. Ledger and Shop business/API objects use `public`; protected helpers/provider schemas retained. |
| Identity | Separate Auth per product/environment, distinct session-cookie namespaces and browser isolation verification. No SSO or account merging required now. |
| Manual configuration | Four configured project refs, ignored credential files with committed templates, key/secret guide, Auth/SMTP instructions and a recorded scoped Shop transfer. Requested CEO Owner plus four active Free projects remains constrained by the documented provider quota. |
| Verification | Three builds/typechecks and lint pass; 10 unit invariants, 678 Ledger SQL assertions, five Shop SQL suites and populated relocation preservation pass. Browser evidence and inherited Shop lint limitation are recorded in the verification report. |
| Agent guidance | Root/scoped rules, future-development workflows and starter templates reviewed against the final product-owned database structure. One-time evidence stays in migration documents. |

[Current verification evidence](../migration/independent-project-verification.md). [Manual setup](../shared/supabase-manual-setup.md). [Remaining hosted prerequisites](../migration/remote-prerequisites.md).

The [Shop transfer record](../migration/shop-dedicated-projects.md) supersedes the earlier hosted-pending checkpoint. The latest integration adds the recorded forward service-role grant migration and local regression verification; it does not repeat the hosted import or deploy applications. See [Shop integration evidence](../integrations/shop-latest.md).
