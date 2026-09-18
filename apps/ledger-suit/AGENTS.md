# Ledger Suit

Root rules apply. Routes live in `app/pages`; product orchestration and database adapters in `app/composables`; pure financial/display helpers in `app/utils`; product-specific presentation in `app/components`.

- Keep money arithmetic in integer minor units and preserve transaction balancing, posting, reversal and audit behavior.
- Preserve organization membership, capability, plan/quota, read-only and payment-required checks. Client checks complement server authorization.
- Use shared templates, fields, table, dialogs, wizard and confirmations. Keep Ledger currency/tenant wrappers product-owned.
- Verify affected posting/reporting/onboarding flows against a designated test backend. Public UI checks alone cannot validate financial operations.
- Database SQL and Edge Functions are owned by the root `supabase` project. Do not add a second migration root under this app.
