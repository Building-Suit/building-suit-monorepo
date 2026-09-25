# Ledger Suit

Root rules apply. Routes live in `app/pages`; product orchestration and database adapters in `app/composables`; pure financial/display helpers in `app/utils`; product-specific presentation in `app/components`.

- Before every task, run the root `pnpm agent:preflight`. Use short-lived `codex/ledger-suit/*` feature branches, keep fixes on their open PR, and follow `docs/shared/git-workflow.md` for stacks, parallel work and manual GitHub merges. Ledger may have one active root PR into `stg`; Ledger children target only an open Ledger parent.
- Keep money arithmetic in integer minor units and preserve transaction balancing, posting, reversal and audit behavior.
- Preserve organization membership, capability, plan/quota, read-only and payment-required checks. Client checks complement server authorization.
- Use shared templates, fields, table, dialogs, wizard and confirmations. Keep Ledger currency/tenant wrappers product-owned.
- Verify affected posting/reporting/onboarding flows against a designated test backend. Public UI checks alone cannot validate financial operations.
- Database SQL, Edge Functions, templates and tests are owned by this app’s `supabase/` directory. Select it from the root with `pnpm db ledger-suit <command>`. Business objects use `public`; this product has its own production/staging pair and Auth sessions.

For accountant-system continuation tasks only, read `docs/accountant-system/README.md`, `MASTER_PLAN_AR.md`, `CURRENT_STATUS_AR.md`, decisions and the active work package before edits. Update the checkpoint, actual evidence and acceptance traceability in the same package before handoff. Apply the latest explicit founder authorization in DECISIONS_AR.md (AS-E02 allows continued improvements without waiting for accountant decisions); do not claim accountant UAT or deployment from that authorization. Preserve other policy approvals as pending without explicit evidence; the retired launch/accounting-v2 queues do not govern execution. Unrelated Ledger tasks do not inherit this roadmap as a work queue.
