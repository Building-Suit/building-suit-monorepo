# Super Admin Suit

Generated from the maintained Building Suit app template. The root workspace discovers `apps/*`; run `pnpm install` to register dependencies and `pnpm run setup` to prepare generated types. Start this checkout explicitly with `pnpm dev:super-admin --current`.

The bootstrap uses shared tokens, icons, settings, confirmations and the application shell. It has no app-local presentation components and no source-owned operational navigation. Future navigation, Suit registration, capabilities, environment bindings, integration/provider settings and commercial configuration must come from authorized Super Admin database projections.

The Supabase client and cookie namespace are independent, but this task adds no login flow, authorization policy, business schema or database access. The empty shell is not an authenticated boundary. Add protected behavior only through the architecture in `docs/architecture/super-admin-trust-adapter-contract.md`: Super Admin uses its own Auth/database and invokes target-owned adapters without importing another app or directly accessing its database.

The app-owned CLI root intentionally contains no business migration. Use `pnpm db super-admin-suit <command>` for later authorized local work. Hosted project refs, URLs, keys, owner IDs and provider/commercial values remain blank or placeholder-only in source; the dedicated hosted pair must be verified before remote work.
