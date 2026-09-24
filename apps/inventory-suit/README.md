# Product app

Generated from the maintained Building Suit app template. The root workspace discovers `apps/*`; run `pnpm install` to register dependencies and `pnpm run setup` to prepare generated types.

The starter uses shared tokens, icons, settings, confirmations and the application shell. Set the product name/content in `i18n/locales`, supply approved brand assets and navigation, and reuse `BsLandingPage`, `BsMarketingLayout`, `BsAuthLayout` and `BsSignupWizard` for the corresponding routes.

This bootstrap registers an independent local Supabase client and cookie namespace, but it provides no authentication workflow, tenant authorization or business database access. Before adding protected features, implement the product-scoped identity strategy, product/tenant adapter, server authorization and callback allowlists described in `docs/architecture/identity.md`. Never treat the demonstration shell as an authenticated boundary. Register the app-owned Supabase CLI root and its independent production/staging project pair in the environment map; use `public` business objects and the root product-selecting database commands. Add tests and deployment configuration appropriate to the requested product scope.
