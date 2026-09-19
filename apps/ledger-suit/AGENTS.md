# Ledger Suit

Root rules apply. Routes live in `app/pages`; product orchestration and database adapters in `app/composables`; pure financial/display helpers in `app/utils`; product-specific presentation in `app/components`.

- Before every task, run the root `pnpm agent:preflight`. Use short-lived feature branches, keep fixes on their open PR, and follow `docs/shared/git-workflow.md` for stacks, parallel work and manual GitHub merges. There is one staging PR for the whole monorepo, not one per app.
- Keep money arithmetic in integer minor units and preserve transaction balancing, posting, reversal and audit behavior.
- Preserve organization membership, capability, plan/quota, read-only and payment-required checks. Client checks complement server authorization.
- Use shared templates, fields, table, dialogs, wizard and confirmations. Keep Ledger currency/tenant wrappers product-owned.
- Verify affected posting/reporting/onboarding flows against a designated test backend. Public UI checks alone cannot validate financial operations.
- Database SQL, Edge Functions, templates and tests are owned by this app’s `supabase/` directory. Select it from the root with `pnpm db ledger-suit <command>`. Business objects use `public`; this product has its own production/staging pair and Auth sessions.
