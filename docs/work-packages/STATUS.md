# Monorepo implementation status

Checkpoint: 2026-09-19, updated for ADR 0002. The local monorepo and independent Supabase structure are complete. Hosted setup/Shop data transfer await the user’s manual organizations, project refs and credentials. Single Auth is explicitly deferred.

| Area | Result |
|---|---|
| Workspace and preservation | Three apps, 11 shared packages, one pnpm/Turbo graph and lockfile. All 502 source hashes and 80 historical SQL hashes unchanged. |
| Design and documentation | Canonical Building tokens/brand resources, complete original documentation, extracted maintained specifications and live component catalogue. |
| Shared UI/behavior | Ledger landing/auth/signup/shell reused by both products; one PrimeVue table across all 30 product tables; shared dialogs, wizard, confirmations and themes. |
| Independent Supabase architecture | App-owned CLI roots, separate local databases, production/staging templates and explicit environment validation. Ledger and Shop business/API objects use `public`; protected helpers/provider schemas retained. |
| Identity | Separate Auth per product/environment, distinct session-cookie namespaces and browser isolation verification. No SSO or account merging required now. |
| Manual configuration | Four blank target slots, ignored credential files with committed templates, key/secret guide, Auth/SMTP instructions and scoped Shop transfer runbook. Requested CEO Owner plus four active Free projects remains constrained by the documented provider quota. |
| Verification | Three builds/typechecks and lint pass; 10 unit invariants, 678 Ledger SQL assertions, five Shop SQL suites and populated relocation preservation pass. Browser evidence and inherited Shop lint limitation are recorded in the verification report. |
| Agent guidance | Root/scoped rules, future-development workflows and starter templates reviewed against the final product-owned database structure. One-time evidence stays in migration documents. |

[Current verification evidence](../migration/independent-project-verification.md). [Manual setup](../shared/supabase-manual-setup.md). [Remaining hosted prerequisites](../migration/remote-prerequisites.md).

No hosted changes have occurred. Do not substitute an accessible unrelated project for a missing destination. The repository work ends here; the scoped hosted transfer can only be completed after the manually configured targets exist. This does not create a new feature roadmap.
