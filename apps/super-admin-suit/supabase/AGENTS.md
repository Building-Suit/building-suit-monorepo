# super-admin-suit database development

Read the root and owning app rules, `docs/shared/database.md`, `docs/architecture/environments.json`, and `docs/architecture/super-admin-trust-adapter-contract.md`.

- This app owns an independent Supabase CLI root. Run `pnpm db super-admin-suit <command>` from the monorepo root.
- The bootstrap contains no business migrations. Add forward migrations only in an authorized Super Admin domain task.
- Runtime configuration and navigation are database-owned. Missing configuration fails closed; source defaults are forbidden.
- Business objects belong in `public` with explicit grants and RLS. Signing, secret resolution, and other privileged helpers stay unexposed with fixed safe search paths.
- Super Admin Auth identities and sessions are independent. They never imply an identity or permission in a target Suit.
- Never store plaintext secrets, project refs, endpoints, owner IDs, payment/provider settings, prices, or quotas in source. Browser roles must not access Vault references or signing material.
- Never import a target app, access its database directly, or use its service-role credentials. Cross-Suit operations use target-owned adapters under the approved contract.
- Verify the exact environment and immutable provider identifiers before any separately authorized hosted work. Never reset a hosted database.
