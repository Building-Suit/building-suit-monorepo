# Building Suit monorepo

Ledger Suit, Shop Suit and the Building Suit documentation app share one pnpm/Turbo workspace, Nuxt layer, Building design tokens, Atomic Design components and interaction controllers. Original source repositories remain untouched.

Each product owns an independent Supabase production/staging pair in its own organization. Business tables and API objects use `public`. Auth identities and sessions are separate; Single Auth is deferred. The local projects are configured; hosted destinations and Shop’s scoped data transfer await your manual account/project setup. See [manual Supabase setup](docs/shared/supabase-manual-setup.md) and [status](docs/work-packages/STATUS.md).

## Development

Use the Node version in `.node-version` and pnpm version in `package.json`.

```sh
pnpm install
pnpm run setup
cp apps/ledger-suit/.env.example apps/ledger-suit/.env
cp apps/shop-suit/.env.example apps/shop-suit/.env
pnpm db ledger-suit start
pnpm db shop-suit start
pnpm dev:ledger  # http://localhost:3000
pnpm dev:shop    # http://localhost:3001
pnpm dev:docs    # http://localhost:3002
```

Fill each ignored app `.env` with its local API URL and browser-safe publishable/anon key from that product’s CLI status. Never use secret/service-role keys in app public configuration. Both local databases initialize from their app-owned migration roots and disposable seeds.

| Product | CLI root | Local API | Database | Email inbox |
|---|---|---|---|---|
| Ledger | `apps/ledger-suit/supabase` | 60321 | 60322 | 60324 |
| Shop | `apps/shop-suit/supabase` | 61321 | 61322 | 61324 |

Production/staging refs remain blank until verified. The requested CEO Owner role across four Free projects conflicts with Supabase’s documented account quota; resolve the role/plan arrangement during [manual setup](docs/shared/supabase-manual-setup.md). No paid resources or hosted changes are created by workspace setup.

## Workspace commands

| Command | Purpose |
|---|---|
| `pnpm build` | Build all three apps |
| `pnpm typecheck` | Check apps and imported shared TypeScript |
| `pnpm lint` | Lint apps, shared components and tooling |
| `pnpm check` | Check tokens, package boundaries and preserved historical SQL |
| `pnpm test` | Test shared invariants and environment selection |
| `pnpm test:e2e` | Browser suite against production builds on ports 4320–4322 |
| `pnpm db:test` | Ledger and Shop SQL suites against their separate local databases |
| `pnpm db <product> <command>` | Select the app-owned Supabase CLI root explicitly |
| `pnpm db:preflight <product> <production\|staging>` | Validate manually entered refs/keys locally without deploying |
| `pnpm new:platform <slug> "Product name" --dry-run` | Preview the maintained app starter |
| `pnpm tokens:generate` | Generate token artifacts from canonical JSON |
| `pnpm docs:generate` | Index original and maintained documentation |
| `pnpm --filter @building-suit/shop-suit build` | Run a command for one app |

Set `BUILDING_TEST_BACKEND=1` when running browser tests to include Shop signup, product persistence and independent-session verification against the disposable backends. Database tests use synthetic fixtures; never target a hosted business database with them.

## Navigation

- `apps/ledger-suit`, `apps/shop-suit`: product pages, domain logic, content and app-owned Supabase projects.
- `apps/building-suit-docs`: searchable documentation and `/components` catalogue; original documents under `content/building-suit`, prototype evidence under `reference`.
- `packages/ui`, `packages/ux`: atomic components/templates and shared record/dialog/wizard/confirmation behavior.
- `packages/design-tokens`, `packages/brand`, `packages/i18n`: canonical design resources and common UI messages.
- `packages/auth`, `packages/data-access`, `packages/contracts`: shared infrastructure with product-owned identities and contracts.
- `packages/nuxt-layer`, `packages/config`, `packages/testing`: integration, tooling and verification.
- `supabase/environments`: blank deployment credential templates; `supabase/legacy`: preserved original Shop SQL.
- [Shared specifications](docs/shared/README.md), [agent rules](AGENTS.md), [future-development workflows](docs/agent-workflows.md).

The finite [implementation plan](PLAN.md), [source audit](docs/source-audit.json) and `docs/migration` record one-time work. They do not add tasks to future agent work.
