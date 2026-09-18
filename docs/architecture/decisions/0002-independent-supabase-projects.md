# Independent Supabase projects per product

Status: accepted by the user, 2026-09-19. Supersedes the database/identity portions of decision 0001 and the original consolidation plan. Shared monorepo/UI decisions remain in force.

Ledger Suit and Shop Suit each own one Supabase organization and two independent projects: production and staging. Each product organization is created through its own account email, entered manually in `docs/architecture/environments.json`. The requested central manager is `ceo@building-suit.com` with Owner membership. There is no organization or project for the documentation app.

The desired Free-plan arrangement has a provider constraint: Supabase counts the two active Free-project allowance across organizations in which an account is Owner or Administrator. Thus four active Free projects with the CEO account as Owner of both organizations cannot be assumed to work, even with separate creator emails. The user must resolve the account role/plan arrangement or obtain provider confirmation. No paid upgrade or membership change is authorized by this decision. [Supabase billing rules](https://supabase.com/docs/guides/platform/billing-on-supabase).

All product business tables, views and client RPCs use `public` in their respective project. Existing protected helper schemas (`app` for Ledger, `shop_private` for Shop) and provider-managed `auth`, `storage` and extension schemas retain their purposes. They do not contain a second product's business tables. `public` does not mean anonymous access: explicit grants, RLS, membership and authorized commands remain required.

Each project's Supabase Auth is its own identity authority. No global account linking, shared identity database, token exchange or SSO is implemented in this scope. User IDs are meaningful only together with their product/environment/project. Shared auth presentation and reusable verification mechanics remain in packages; product provisioning and sessions remain separate. Cookie names include product and environment, with no parent-domain shared cookie.

Each app owns its CLI root at `apps/<product>/supabase`. Production and staging use the same product migration history, with separate project refs, keys, credentials, provider settings and release evidence. Root scripts select the product explicitly; environment files select the target explicitly. No unqualified root `supabase/config.toml` remains to select the wrong product silently.

Shop is copied out of the existing shared source project into dedicated Shop staging/production projects; transferring the entire source project would move unrelated Building data. The new source-baseline and namespace-relocation migrations initialize and rehearse the dedicated contract. Hosted data/Auth/Storage/service transfer still requires the user's destination setup, scoped export, reconciliation and cutover.

Source repositories and historical migration files remain unchanged. This decision changes deployment ownership and namespaces, not columns, IDs, financial models, subscription policies or feature scope.
