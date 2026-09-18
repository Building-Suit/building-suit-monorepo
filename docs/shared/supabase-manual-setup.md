# Manual Supabase account, key and secret setup

Repository paths below are relative to the monorepo root. Actual keys and credentials are intentionally absent from committed files.

## 1. Establish the account and organization arrangement

Create/use one account email per product and one organization under each. Each organization contains its product's Production and Staging projects. Record the actual email, organization ID, role and plan in `docs/architecture/environments.json`. The intended central account is `ceo@building-suit.com`.

**Resolve the Free/Owner conflict before relying on four active projects.** Supabase limits an account to two active Free projects across organizations where it is Owner or Administrator. Separate signup emails do not remove the limit for the shared CEO Owner. Keep distinct account owners and use Developer membership for the CEO where appropriate, or choose the necessary paid organization arrangement yourself, or obtain confirmation from Supabase. Developer access does not provide Owner-level settings/transfer management; those operations remain with the corresponding owner account. No paid plan or invitation has been created by this repository work. [Billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [roles](https://supabase.com/docs/guides/platform/access-control).

Use independent project refs for all four slots:

| Product organization | Environment | Registry entry |
|---|---|---|
| Ledger Suit | Production | `products.ledger-suit.production` |
| Ledger Suit | Staging | `products.ledger-suit.staging` |
| Shop Suit | Production | `products.shop-suit.production` |
| Shop Suit | Staging | `products.shop-suit.staging` |

Enter each `projectRef` and `appUrl`, plus its product's `organizationId` and `ownerEmail`. Project refs/organization IDs/origins are identifiers, not API secrets. A project ref is visible in the Dashboard project URL and project settings. Do not place API keys or passwords in this JSON file.

## 2. Frontend configuration: URL and publishable key only

For each product and environment, copy the matching committed template:

```sh
cp apps/ledger-suit/.env.production.example apps/ledger-suit/.env.production
cp apps/ledger-suit/.env.staging.example apps/ledger-suit/.env.staging
cp apps/shop-suit/.env.production.example apps/shop-suit/.env.production
cp apps/shop-suit/.env.staging.example apps/shop-suit/.env.staging
```

In each project's Dashboard, open **Connect** for its URL/publishable key, or **Settings → API Keys** to choose a key. Enter:

| Variable | Manual value |
|---|---|
| `APP_ENV` | `production` or `staging` |
| `SUPABASE_URL` and `NUXT_PUBLIC_SUPABASE_URL` | The same `https://<that-project-ref>.supabase.co` |
| `SUPABASE_KEY` and `NUXT_PUBLIC_SUPABASE_KEY` | The same project publishable `sb_publishable_...` key |
| `NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX` | Keep the template's product/environment-specific value |
| Ledger `APP_BASE_URL`; Shop `APP_URL` | This deployment's application origin |

Use the same values in the hosting platform's matching application/environment settings. Never copy production credentials into staging. These names are the ones the pinned Nuxt integration reads; a standalone `SUPABASE_PUBLISHABLE_KEY` variable is not used by this repository. Publishable keys reach browsers; secret/service-role keys must not. [API key documentation](https://supabase.com/docs/guides/getting-started/api-keys).

`.env` is the default local-development file. Nuxt does not automatically select the two custom environment filenames for every command. Select one explicitly, for example:

```sh
pnpm --filter @building-suit/shop-suit exec nuxt build --dotenv .env.staging
```

A deployed `.output/server/index.mjs` reads the host's environment; it does not load these files automatically. Set the `NUXT_PUBLIC_*` runtime values on that deployment as well as its build configuration. Keep project URL/key pairs and cookie prefixes consistent, then rebuild/redeploy the affected app.

## 3. Deployment credentials: separate files and secret stores

Copy these templates to filenames without `.example`, once per product/environment:

```text
supabase/environments/ledger-suit/.env.production.example
supabase/environments/ledger-suit/.env.staging.example
supabase/environments/shop-suit/.env.production.example
supabase/environments/shop-suit/.env.staging.example
```

Fill the resulting ignored files manually:

| Variable | Where it comes from / use |
|---|---|
| `SUPABASE_PROJECT_REF` | The exact project ref also recorded in the registry |
| `SUPABASE_ORGANIZATION_ID` | The owning organization's ID from its settings |
| `SUPABASE_ACCESS_TOKEN` | Account personal access token for CLI/Management API; prefer a scoped token restricted to the intended project/actions where available |
| `SUPABASE_DB_PASSWORD` | That project's database password, set or reset in database settings |
| `SUPABASE_DB_URL` | Optional direct/session database connection string from Connect, using the database password; needed for explicit export/restore |
| `SUPABASE_SECRET_KEY` | Optional server-only `sb_secret_...` key from API Keys; neither a database password nor a CLI access token |

A personal access token belongs to an account and inherits its actual permissions. If CEO Developer membership is used, do not assume that token can perform Owner-only organization actions. Use the correct product owner account when needed. [Access-token documentation](https://supabase.com/docs/guides/platform/personal-access-tokens).

Never load these deployment files into Nuxt, copy them to public/runtime configuration, put them in chat, or commit them. Store their production equivalents in your password manager and the relevant hosting/CI secret store. Separate CI environments can be named `ledger-production`, `ledger-staging`, `shop-production`, `shop-staging`, each with its own values; no deployment jobs are enabled just by adding them.

Validate each completed pair without contacting the cloud:

```sh
pnpm db:preflight ledger-suit production
pnpm db:preflight ledger-suit staging
pnpm db:preflight shop-suit production
pnpm db:preflight shop-suit staging
```

The script reads the corresponding deployment and app files and checks refs, organizations, origins, environment, cookie prefixes, frontend key safety and the presence of deployment credentials against the registry. It cannot authenticate a key or prove live access offline. It prints no secret values and performs no deployment. After it passes, use the owning CLI root and verified ref for explicit linking/dry-run/deploy, following the database runbook. Do not push the new Shop baseline into its old shared source project.

## 4. Auth, mail and function secrets

In each project's Authentication settings, configure its own Site URL and exact allowed callbacks/recovery URLs for the owning app. Keep staging and production allowlists separate. Single Auth is deferred; do not point the two products at the same Auth project or share parent-domain session cookies.

Both signup flows use a six-digit email OTP. Configure confirmation emails to include `{{ .Token }}` and preserve the existing one-hour expiry/resend behavior. New Free projects using default SMTP cannot customize their templates; configure your own SMTP provider to use the committed templates. Supabase's default SMTP also has recipient/rate restrictions, so validate real signup delivery on the actual project. [Template change](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier), [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

Ledger's existing Edge Functions use provider-managed Supabase variables and separate Paymob/Resend values. Set custom values in that project's **Edge Functions → Secrets**, with staging test credentials separated from production credentials. Examples include `APP_BASE_URL`, `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_CARD_INTEGRATION_ID`, the `PAYMOB_<PLAN>_<INTERVAL>_PLAN_ID` values used by the checkout contract, `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. SMTP credentials belong in Auth's SMTP settings as well; a Resend function secret alone does not configure Auth email delivery. Shop does not inherit Ledger's billing/email functions automatically.

Supabase supplies its own function runtime keys; the existing Ledger functions use the legacy `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` interfaces. Do not replace these with CLI PATs or casually disable legacy keys before migrating their callers. New optional server integrations can use secret keys through their documented server interfaces. [Function secrets](https://supabase.com/docs/guides/functions/secrets).

## 5. Finish Shop's hosted move

Setting keys alone does not migrate data. Use `docs/migration/shop-dedicated-projects.md` for the scoped database/Auth/Storage/service transfer, staging verification and production cutover. A whole-project organization transfer moves everything in that source project; the current shared Building project must not be moved wholesale as a substitute for extracting Shop.

When rotating a key, create the replacement, update only the matching app/function/CI secrets, redeploy and verify, then revoke the old key. Rotate database passwords and account PATs separately because they serve different interfaces. Keep populated files ignored and retain only the blank examples in Git.
