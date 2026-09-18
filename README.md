# Building Suit monorepo

Ledger Suit, Shop Suit and the Building Suit documentation app share a pnpm workspace, Nuxt layer, Building design tokens, Atomic Design components and interaction controllers.

The source repositories were copied into this directory and remain untouched. The local workspace, shared UI and documentation are implemented and verified. Hosted schema transfer and shared production identity are not complete: access to the Ledger production/staging projects and their deployment domains is still required. See [implementation status](docs/work-packages/STATUS.md).

## Development

Use the Node version in `.node-version` and pnpm version in `package.json`.

```sh
pnpm install
pnpm setup
pnpm dev:ledger  # http://localhost:3000
pnpm dev:shop    # http://localhost:3001
pnpm dev:docs    # http://localhost:3002
```

Copy the applicable app `.env.example` to `.env` and configure the publishable Supabase URL/key. Never use a secret/service-role key in a browser app. The isolated local project uses API port 59321, PostgreSQL 59322 and email inbox 59324. `supabase/config.toml` has its own project ID; commands issued here must not target a source repository's containers.

The current local SQL history initializes Ledger's existing schema. A Shop schema-only recovery snapshot and its nine later migrations have also been rehearsed in the isolated instance; see `docs/migration/local-rehearsal.md`. This does not certify a complete hosted restore or configure Shop automatically in a fresh clone. The target private schemas and shared identity must be rehearsed in verified staging before production cutover.

## Workspace commands

| Command | Purpose |
|---|---|
| `pnpm build` | Build all three apps through the task graph |
| `pnpm typecheck` | Check app and imported shared TypeScript |
| `pnpm lint` | Lint apps, shared components and tooling |
| `pnpm check` | Check token output, package boundaries and preserved SQL history |
| `pnpm test` | Test token, cache, redirect and export invariants |
| `pnpm test:e2e` | Run the browser suite against production builds on ports 4320–4322 |
| `pnpm new:platform <slug> "Product name" --dry-run` | Preview the maintained starter; omit `--dry-run` to create it |
| `pnpm tokens:generate` | Regenerate token artifacts from the canonical JSON |
| `pnpm docs:generate` | Index original and maintained documentation |
| `pnpm --filter @building-suit/shop-suit build` | Run a command for one app |

The browser suite uses local services and does not submit production mutations. Set `BUILDING_TEST_BACKEND=1` to include Shop signup and product-write verification against the initialized disposable backend. Authenticated business-flow and database isolation checks require the correct local/staging backend; passing presentation checks is not proof of those flows.

## Navigation

- `apps/ledger-suit`: Ledger pages, domain logic and product content.
- `apps/shop-suit`: Shop pages, domain logic and product content.
- `apps/building-suit-docs`: searchable documentation and `/components` catalogue; originals under `content/building-suit`, prototype evidence under `reference`.
- `packages/ui`: atoms, molecules, organisms, templates and shared styles.
- `packages/ux`: record actions, wizard navigation, confirmations, settings and feedback.
- `packages/design-tokens`, `packages/brand`, `packages/i18n`: canonical design/brand resources and common UI messages.
- `packages/auth`, `packages/data-access`, `packages/contracts`: shared infrastructure contracts and helpers.
- `packages/nuxt-layer`, `packages/config`, `packages/testing`: framework integration, tooling guidance and verification.
- `supabase`: database configuration, migrations, functions and tests. Historical Shop SQL is preserved under `legacy/shop-suit`.
- [Shared specifications](docs/shared/README.md), [agent rules](AGENTS.md), [agent workflows](docs/agent-workflows.md).

The [migration plan](PLAN.md), [source audit](docs/source-audit.json) and `docs/migration` record the one-time work. They do not add tasks to future agent work. Implementation ends at the plan's finite acceptance criteria.
