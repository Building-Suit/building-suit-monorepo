# shop-suit database development

Read the root and owning app rules, `docs/shared/database.md`, the environment registry and relevant product contracts.

- This is the app-owned Supabase directory; run `pnpm db shop-suit <command>` from the monorepo root. Production and staging share this product’s versioned history, with separate refs, secrets and Auth users.
- Business tables/views/client RPCs use `public`. Preserve explicit grants, RLS, tenant authorization, financial/inventory invariants and audit history. Keep privileged helper schemas unexposed and provider schemas managed by Supabase.
- Verify the exact product/environment/project ref and inspect deployed history before hosted work. Local commands use this directory’s project ID and ports.
- Create new forward migrations with the CLI. Preserve applied migration files. Review dependencies, function search paths, views, grants, Storage and Realtime as well as table policies.
- Never trust user-editable Auth metadata for authority. UUIDs and accounts are scoped to this project; a matching email does not authorize account linking.
- Run mutation tests in disposable local or explicitly designated staging scope. Never reset a hosted business database.
- Regenerate affected contracts/types and update product adapters. Keep privileged credentials out of frontend packages and logs.
- Deploy explicitly, with verified environment selection and serialized execution. Record the applied versions and actual checks.
