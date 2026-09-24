# Building Suit monorepo

Ledger Suit, Shop Suit, Inventory Suit and the Building Suit documentation app share one pnpm/Turbo workspace, Nuxt layer, Building design tokens, Atomic Design components and interaction controllers. Original source repositories remain untouched.

Each product owns an independent Supabase production/staging pair in its own organization. Business tables and API objects use `public`. Auth identities and sessions are separate; Single Auth is deferred. Ledger and Shop's four hosted project refs are verified; Inventory's hosted pair remains intentionally unprovisioned. Shop's Production schema and scoped data copy are verified; its Staging schema is initialized and tested. SMTP, application deployment and final cutover remain pending. See [manual Supabase setup](docs/shared/supabase-manual-setup.md), the [Shop transfer record](docs/migration/shop-dedicated-projects.md) and [status](docs/work-packages/STATUS.md).

## Development

Use the Node version in `.node-version` and pnpm version in `package.json`.

```sh
pnpm install
pnpm run setup
cp apps/ledger-suit/.env.example apps/ledger-suit/.env
cp apps/shop-suit/.env.example apps/shop-suit/.env
cp apps/inventory-suit/.env.example apps/inventory-suit/.env
pnpm db ledger-suit start
pnpm db shop-suit start
pnpm db inventory-suit start
pnpm dev:ledger  # http://localhost:3000
pnpm dev:shop    # http://localhost:3001
pnpm dev:docs    # http://localhost:3002
pnpm dev:inventory # http://localhost:3003
```

The root `dev:*` commands select the active worktree with the newest changes relevant to the requested app or shared packages. They print the selected branch, path and commit before starting Nuxt. Newer uncommitted edits count; equal source activity prefers the deeper stack. Merged/closed PRs, detached and prunable worktrees are excluded. With no relevant active worktree, the original (primary) checkout is served as it stands, without switching or pulling its branch.

```sh
pnpm dev:ledger --list          # inspect selection without starting a server
pnpm dev:shop --dry-run        # show selection and launch arguments
pnpm dev:ledger --current      # serve the checkout where this command runs
pnpm dev:shop --worktree codex/shop-suit/my-feature
pnpm dev:inventory --current
pnpm dev:docs -- --port 3102    # forward Nuxt options
```

When other feature worktrees exist, auto selection refreshes `origin` and checks GitHub PR state, so it needs network access and an authenticated `gh`. With only the original checkout (or no other possible feature worktree), it starts directly without network access. Explicit `--current`/`--worktree` selections work offline. Selection is fixed at startup: restart the command to pick up a new worktree. Files edited inside the selected worktree still hot-reload normally. Run `pnpm install --frozen-lockfile` and `pnpm run setup` in a new worktree before serving it. Its own app `.env` takes precedence; if absent, the launcher passes the same app’s `.env` from the original checkout to Nuxt without copying it or printing values. It never selects `.env.staging` or `.env.production` automatically.

Fill each ignored app `.env` with its local API URL and browser-safe publishable/anon key from that product’s CLI status. Never use secret/service-role keys in app public configuration. Each local database initializes from its app-owned migration root and disposable seed.

| Product | CLI root | Local API | Database | Email inbox |
|---|---|---|---|---|
| Ledger | `apps/ledger-suit/supabase` | 60321 | 60322 | 60324 |
| Shop | `apps/shop-suit/supabase` | 61321 | 61322 | 61324 |
| Inventory | `apps/inventory-suit/supabase` | 62321 | 62322 | 62324 |

Verified production/staging refs are recorded in `docs/architecture/environments.json`. Account membership roles, including the requested CEO Owner arrangement, still require verification against Supabase's Free-project quota rules in [manual setup](docs/shared/supabase-manual-setup.md). No paid resources or hosted changes are created by workspace setup.

## Workspace commands

| Command | Purpose |
|---|---|
| `pnpm agent:preflight` | Fetch and inspect worktrees, commits and live GitHub state before every task or publication |
| `pnpm agent:pr-check <number>` | Verify the app-specific staging root and same-stack parent chain |
| `pnpm build` | Build all four apps |
| `pnpm typecheck` | Check apps and imported shared TypeScript |
| `pnpm lint` | Lint apps, shared components and tooling |
| `pnpm check` | Check tokens, package boundaries and preserved historical SQL |
| `pnpm test` | Test product/shared invariants and environment selection |
| `pnpm test:e2e` | Browser suite against production builds on ports 4320–4323 |
| `pnpm db:test` | Ledger and Shop SQL suites against their separate local databases |
| `pnpm db <product> <command>` | Select the app-owned Supabase CLI root explicitly |
| `pnpm db:preflight <product> <production\|staging>` | Validate manually entered refs/keys locally without deploying |
| `pnpm new:platform <slug> "Product name" --dry-run` | Preview the maintained app starter |
| `pnpm tokens:generate` | Generate token artifacts from canonical JSON |
| `pnpm docs:generate` | Index original and maintained documentation |
| `pnpm --filter @building-suit/shop-suit build` | Run a command for one app |

Set `BUILDING_TEST_BACKEND=1` when running browser tests to include Shop signup, product persistence and independent-session verification against the disposable backends. Database tests use synthetic fixtures; never target a hosted business database with them.

## Navigation

- `apps/ledger-suit`, `apps/shop-suit`, `apps/inventory-suit`: product pages, domain logic, content and app-owned Supabase projects.
- `apps/building-suit-docs`: searchable documentation and `/components` catalogue; original documents under `content/building-suit`, prototype evidence under `reference`.
- `packages/ui`, `packages/ux`: atomic components/templates and shared record/dialog/wizard/confirmation behavior.
- `packages/design-tokens`, `packages/brand`, `packages/i18n`: canonical design resources and common UI messages.
- `packages/auth`, `packages/data-access`, `packages/contracts`: shared infrastructure with product-owned identities and contracts.
- `packages/nuxt-layer`, `packages/config`, `packages/testing`: integration, tooling and verification.
- `supabase/environments`: blank deployment credential templates; `supabase/legacy`: preserved original Shop SQL.
- [Shared specifications](docs/shared/README.md), [agent rules](AGENTS.md), [future-development workflows](docs/agent-workflows.md), [app-specific feature stacks](docs/shared/git-workflow.md).

Each feature has a short-lived `codex/<stack>/<feature>` branch and review PR. Fixes remain on that branch; every new feature in the same stack starts from its latest verified active worktree tip and targets that parent. Different app/shared stacks may each have one active root PR into `stg`; cross-stack parenting is invalid. Always check live GitHub state before continuing after a manual merge. Feature pushes receive lightweight CI; each staging root receives full validation. See the branch workflow for provider filters and setup requirements.

The finite [implementation plan](PLAN.md), [source audit](docs/source-audit.json) and `docs/migration` record one-time work. They do not add tasks to future agent work.
