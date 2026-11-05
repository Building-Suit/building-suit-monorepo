# Building Suit monorepo

Ledger Suit, Shop Suit, Inventory Suit, Super Admin Suit and the Building Suit documentation app share one pnpm/Turbo workspace, Nuxt layer, Building design tokens, Atomic Design components and interaction controllers. Original source repositories remain untouched.

Each product owns an independent Supabase production/staging pair in its own organization. Business tables and API objects use `public`. Auth identities and sessions are separate; Single Auth is deferred. Ledger and Shop's four hosted project refs are verified; Inventory's hosted pair remains intentionally unprovisioned. Shop's Production schema and scoped data copy are verified; its Staging schema is initialized and tested. SMTP, application deployment and final cutover remain pending. See [manual Supabase setup](docs/shared/supabase-manual-setup.md), the [Shop transfer record](docs/migration/shop-dedicated-projects.md) and [status](docs/work-packages/STATUS.md).

Doctor Suit is being implemented as a synthetic public preview and administrative doctor/secretary browser portal in `apps/doctor-suit`. Its local data foundation is isolated; hosted projects remain unprovisioned and user-managed. Real patients, clinical care, payments and mobile availability are not enabled. Follow the [Doctor implementation contract](docs/work-packages/doctor-suit/website-contract-v0.2.md) and app README for current verification limits.

## Development

Use the Node version in `.node-version` and pnpm version in `package.json`.

```sh
pnpm install
pnpm run setup
cp apps/ledger-suit/.env.example apps/ledger-suit/.env
cp apps/shop-suit/.env.example apps/shop-suit/.env
cp apps/inventory-suit/.env.example apps/inventory-suit/.env
cp apps/super-admin-suit/.env.example apps/super-admin-suit/.env
pnpm db ledger-suit start
pnpm db shop-suit start
pnpm db inventory-suit start
pnpm db super-admin-suit start
pnpm dev:ledger  # http://localhost:3000
pnpm dev:shop    # http://localhost:3001
pnpm dev:docs    # http://localhost:3002
pnpm dev:inventory # http://localhost:3003
pnpm dev:super-admin # http://localhost:3004
```

The root Ledger, Shop, Inventory, Super Admin and Docs `dev:*` commands select the active worktree with the newest changes relevant to the requested app or shared packages. They print the selected branch, path and commit before starting Nuxt. Newer uncommitted edits count; equal source activity prefers the deeper stack. Merged/closed PRs, detached and prunable worktrees are excluded. With no relevant active worktree, the original (primary) checkout is served as it stands, without switching or pulling its branch.

```sh
pnpm dev:ledger --list          # inspect selection without starting a server
pnpm dev:shop --dry-run        # show selection and launch arguments
pnpm dev:ledger --current      # serve the checkout where this command runs
pnpm dev:shop --worktree codex/shop-suit/my-feature
pnpm dev:inventory --current
pnpm dev:super-admin --current
pnpm dev:docs -- --port 3102    # forward Nuxt options
```

When other feature worktrees exist, auto selection refreshes `origin` and checks GitHub PR state, so it needs network access and an authenticated `gh`. With only the original checkout (or no other possible feature worktree), it starts directly without network access. Explicit `--current`/`--worktree` selections work offline. Selection is fixed at startup: restart the command to pick up a new worktree. Files edited inside the selected worktree still hot-reload normally. Run `pnpm install --frozen-lockfile` and `pnpm run setup` in a new worktree before serving it. Its own app `.env` takes precedence; if absent, the launcher passes the same app’s `.env` from the original checkout to Nuxt without copying it or printing values. It never selects `.env.staging` or `.env.production` automatically.

Fill each ignored app `.env` with its local API URL and browser-safe publishable/anon key from that product’s CLI status. Never use secret/service-role keys in app public configuration. Each local database initializes from its app-owned migration root and disposable seed.

| Product | CLI root | Local API | Database | Email inbox |
|---|---|---|---|---|
| Ledger | `apps/ledger-suit/supabase` | 60321 | 60322 | 60324 |
| Shop | `apps/shop-suit/supabase` | 61321 | 61322 | 61324 |
| Inventory | `apps/inventory-suit/supabase` | 62321 | 62322 | 62324 |
| Super Admin | `apps/super-admin-suit/supabase` | 64321 | 64322 | 64324 |

Verified production/staging refs are recorded in `docs/architecture/environments.json`. Account membership roles, including the requested CEO Owner arrangement, still require verification against Supabase's Free-project quota rules in [manual setup](docs/shared/supabase-manual-setup.md). No paid resources or hosted changes are created by workspace setup.

`pnpm dev:doctor` selects the latest active Doctor worktree on loopback port 3006, using the same live-PR selection as Shop. Use `--list` to inspect the source or `--current` to serve the current checkout. Restart an already running preview to select the new source. Doctor browser checks use port 4336, while its independent local database/API use 65322/65321. Doctor production/staging refs remain blank.

HQ in `apps/company-hq` combines a shielded read-only Google Drive Brain, trusted founder login, whole-company-plan review and approved department workspaces. One confirmed snapshot supplies the CEO/approved-office picker, shared overlays, furnished rooms and roads; hiring/skill requests do not execute staff or create characters. The current [natural island landmass](docs/work-packages/company-hq/HQ-NATURAL-ISLAND-20261105.md) changes only terrain geometry and materials: an eroded upper coastline, weathered cliff layers, subtle exposed-rim relief, matte volcanic stone/soil/moss and sparse vegetation. Workplace support stays flat; offices/furniture/shared floor, lights, controls, page layout, water mesh/shader and camera envelope remain unchanged. Separate cached 1024² land data keeps structural materials intact. Gold accents and bounded bloom remain, without reflected ground. [Live delivery](docs/work-packages/company-hq/HQ-LIVE-EVENTS-20261105.md) uses one persistent founder-only fetch-SSE/private Supabase WebSocket path: initial/reconnect snapshots followed by category invalidations or user actions, without recurring Brain/company/access fetches. Anonymous Brain reads require explicit open/manual refresh; heartbeats are protocol-only. Google Drive remains knowledge authoring authority. Staging setup includes seven historically approved department imports, source indexing/watch receipts, ACTIVE sync worker v4 and the applied live-push schema; the minute data job is removed, durable pending-event dispatch is applied and watch renewal reads no Drive data. Optional JSON plan publication remains unselected/unbound, with no live CEO/HR publisher or agent runtime. Founder decisions remain authenticated, exact-revision and atomic. `pnpm dev:hq --current` serves this primary checkout on loopback 3101. App/Auth/approval/event-delivery/freshness/visual acceptance is unrun, and the standing ban on autonomous tests/checks/tester agents remains. No public product activation, merge or production action is recorded. See [HQ README](apps/company-hq/README.md), [current sync receipts](docs/work-packages/company-hq/HQ-BRAIN-SYNC-20261105.md) and [environment map](docs/architecture/environments.json).

The current private [hosted-agent task](docs/work-packages/company-hq/HQ-HOSTED-AGENTS-20261105.md) adds founder CEO chat and a durable staging queue: the Oracle worker performs a real Amaya assessment followed by Steve's reply, reading current authorized Drive documents for each job. Hosted Brain reads require fresh founder access. Actual activity drives the characters; the founder requested a 1.28 character scale. Vercel owns HQ hosting and Cloudflare DNS. Subsequent provider receipts and the separate deployment/acceptance status are recorded in that task; earlier inactive-runtime statements above describe the preceding phase.

## Workspace commands

| Command | Purpose |
|---|---|
| `pnpm agent:preflight` | Fetch and inspect worktrees, commits and live GitHub state before every task or publication |
| `pnpm agent:pr-check <number>` | Verify the app-specific staging root and same-stack parent chain |
| `pnpm automation <resource> <action>` | Operate the project-independent Automation Suit control plane |
| `pnpm automation:n8n:export` | Export and normalize local n8n workflows through supported interfaces |
| `pnpm automation:resilience` | Run the deterministic control-plane fault-injection and crash-resume acceptance gate |
| `pnpm build` | Build all workspace apps |
| `pnpm typecheck` | Check apps and imported shared TypeScript |
| `pnpm lint` | Lint apps, shared components and tooling |
| `pnpm check` | Check tokens, package boundaries and preserved historical SQL |
| `pnpm test` | Test product/shared invariants and environment selection |
| `pnpm test:e2e` | Browser suite against production builds on ports 4320–4325 |
| `pnpm db:test` | Ledger and Shop SQL suites against their separate local databases |
| `pnpm db <product> <command>` | Select the app-owned Supabase CLI root explicitly |
| `pnpm db:preflight <product> <production\|staging>` | Validate manually entered refs/keys locally without deploying |
| `pnpm new:platform <slug> "Product name" --dry-run` | Preview the maintained app starter |
| `pnpm tokens:generate` | Generate token artifacts from canonical JSON |
| `pnpm docs:generate` | Index original and maintained documentation |
| `pnpm --filter @building-suit/shop-suit build` | Run a command for one app |

Set `BUILDING_TEST_BACKEND=1` when running browser tests to include Shop signup, product persistence and independent-session verification against the disposable backends. Database tests use synthetic fixtures; never target a hosted business database with them.

## Navigation

- `apps/ledger-suit`, `apps/shop-suit`, `apps/inventory-suit`, `apps/super-admin-suit`: product pages, domain logic, content and app-owned Supabase projects.
- `apps/building-suit-docs`: searchable documentation and `/components` catalogue; original documents under `content/building-suit`, prototype evidence under `reference`.
- `packages/ui`, `packages/ux`: atomic components/templates and shared record/dialog/wizard/confirmation behavior.
- `packages/design-tokens`, `packages/brand`, `packages/i18n`: canonical design resources and common UI messages.
- `packages/auth`, `packages/data-access`, `packages/contracts`: shared infrastructure with product-owned identities and contracts.
- `packages/nuxt-layer`, `packages/config`, `packages/testing`: integration, tooling and verification.
- `supabase/environments`: blank deployment credential templates; `supabase/legacy`: preserved original Shop SQL.
- [Shared specifications](docs/shared/README.md), [agent rules](AGENTS.md), [future-development workflows](docs/agent-workflows.md), [app-specific feature stacks](docs/shared/git-workflow.md).

Each feature has a short-lived `codex/<stack>/<feature>` branch and review PR. Fixes remain on that branch; every new feature in the same stack starts from its latest verified active worktree tip and targets that parent. Different app/shared stacks may each have one active root PR into `stg`; cross-stack parenting is invalid. Always check live GitHub state before continuing after a manual merge. Feature pushes receive lightweight CI; each staging root receives full validation. See [CI ownership and consolidation](docs/shared/continuous-integration.md) before adding another feature workflow. See the branch workflow for provider filters and setup requirements.

The finite [implementation plan](PLAN.md), [source audit](docs/source-audit.json) and `docs/migration` record one-time work. They do not add tasks to future agent work.

After building Shop (or the workspace), `pnpm test:built-assets` verifies production public asset responses and rendered Shop favicon links. Run it after the build; ordinary `pnpm test` checks source inputs without requiring `.output`.
