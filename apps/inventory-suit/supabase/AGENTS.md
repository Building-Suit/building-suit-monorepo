# inventory-suit database development

Read the root and owning app rules, `docs/shared/database.md`, the environment registry and relevant product contracts.

- This app owns an independent Supabase CLI root. Run `pnpm db inventory-suit <command>` from the monorepo root.
- The local skeleton contains no Inventory business migrations. Add forward migrations only in an authorized domain task.
- Business objects belong in `public` with explicit grants, RLS and tenant authorization; privileged helpers stay unexposed.
- Auth users and sessions are Inventory-only. Never reuse Ledger or Shop refs, keys, identities or cookies.
- Verify the exact product/environment/ref before hosted work. Hosted Inventory project identities are registered, but both were paused at the 2026-10-22 audit; do not resume them implicitly. Apply and verify the pending access migration when restoration is authorized.
- Never reset a hosted database, expose privileged credentials, or trust editable Auth metadata for authority.
