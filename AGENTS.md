# Working in the Building Suit monorepo

## Start here

1. Read the root `README.md` for setup, application entry points and workspace commands.
2. Read this file and the more specific `AGENTS.md` files governing your changes.
3. Select the relevant workflow in `docs/agent-workflows.md`.
4. Read the applicable shared specification, product requirements and architecture decisions.
5. Before every new or resumed task, run `pnpm agent:preflight` and read its worktree, commit, upstream and live GitHub PR/merge results. Follow `docs/shared/git-workflow.md`; use its fallback commands in older checkouts. Preserve unrelated edits and keep the task bounded by the user's request.

User instructions take priority. Scoped rules specialize these rules within their directories. Shared specifications govern common behavior; product requirements govern product-specific behavior. Resolve material conflicts explicitly. Historical plans and prototype evidence are references, not an automatic work queue.

## Branches, worktrees and pull requests

- Refresh `origin` and inspect GitHub before starting/resuming work and again before publishing, retargeting or merging. Manual GitHub merges are authoritative, including squash/rebase merges; never treat a stale local branch as an active feature.
- Use one short-lived `codex/<app-or-shared>/<feature>` branch and worktree per feature. Push coherent, verified commits and maintain an open review PR. Adjustments belong on that same feature branch/PR while it is open. Do not commit directly to `main` or `stg`.
- Keep **one open PR into `stg` across the entire monorepo**, including drafts. The first feature or a short-lived batch owns that slot. New dependent features branch from and open PRs into their parent; independent parallel features use separate worktrees and PRs into the same active batch. App ownership does not create extra staging slots.
- Run `pnpm agent:pr-check <number>` after opening/retargeting a PR. Recheck for concurrent PR creation; repair extra staging targets without deleting their work. Include parent/batch links, scope, merge order and actual validation in PR descriptions.
- Batch ready features and fixes into deliberate updates. Run appropriate local checks for each feature and full CI on the combined staging candidate. Follow the workflow's provider-state and five-minute staging-merge spacing rule; no direct pushes or rapid successive merges into `stg`.
- Prefer merge commits while children depend on a branch. After any manual parent merge/closure, fetch and reconcile/retarget children before continuing. Retire completed feature branches; do not replay squash-merged work or blindly recreate deleted remote branches.
- Preserve dirty and active worktrees. Never auto-stash, reset, delete, rebase or force-push others' work. Only rewrite a solely owned branch within current authorization, with an explicit expected remote SHA and `--force-with-lease`.
- GitHub CI and PR rules do not control external provider events. Keep feature Git deployments disabled in app Vercel configuration and verify Supabase Automatic branching is off. Use the maintained provider setup in `docs/shared/git-workflow.md`; do not claim dashboard settings are active without checking them.

## Navigation and ownership

| Location | Responsibility |
|---|---|
| `apps/ledger-suit/` | Ledger routes, features, financial rules, content and tests |
| `apps/shop-suit/` | Shop routes, features, inventory/shop rules, content and tests |
| `apps/building-suit-docs/` | Building documentation, documentation rendering and component catalogue |
| `packages/design-tokens/`, `packages/brand/` | Canonical tokens, generated outputs, fonts, icons and brand assets |
| `packages/ui/`, `packages/ux/` | Shared atomic components/templates and interaction policies/controllers |
| `packages/auth/`, `packages/data-access/`, `packages/contracts/` | Identity/session infrastructure, data-access infrastructure and typed contracts |
| `packages/i18n/`, `packages/nuxt-layer/` | Common translations, locale behavior and Nuxt integration |
| `packages/config/`, `packages/testing/` | Tooling presets, boundary rules and test helpers |
| `apps/<product>/supabase/` | Product migrations, functions, templates, configuration and database tests |
| `supabase/` | Per-product/environment credential templates and archived source SQL |
| `docs/shared/`, `docs/architecture/decisions/` | Shared standards and architecture decisions |
| `tooling/` | Generators, checks and repository maintenance commands |

Use manifests, package exports and the dependency graph to find interfaces and affected consumers. Run documented root scripts with workspace filters; verify script names before executing them. Do not depend on paths outside the repository or a developer's absolute filesystem paths.

## Architecture

- Apps import shared packages. Shared packages never import apps; apps never import each other's internals.
- Follow each app's scoped navigation rules: routes are in `app/pages`, reusable product orchestration in `app/composables`, and pure helpers in `app/utils` where present. Group cohesive features when needed. Separate presentation, orchestration, domain rules, contracts and infrastructure without generating empty layers.
- Keep product-specific queries, RPC adapters and rules in the owning feature. Shared data-access packages provide infrastructure without implicitly accessing a product schema.
- Use existing repository and command/query contracts. Important business writes remain authorized, atomic server/database operations.
- Include environment, portal, user, tenant, feature and query parameters in relevant cache keys. Keep SSR state request-scoped and clear sensitive state/listeners on account, tenant or session changes.
- Share capability and entitlement interfaces while preserving product-specific roles, permissions, quotas and subscription rules.
- Use the root lockfile, workspace dependencies and shared tooling. Respect package exports; do not introduce nested workspaces or alternative frameworks without an explicit architecture decision.
- Update consumers and documentation when shared contracts change. Regenerate types and outputs from their source instead of patching generated files.

## UI, design and interaction

- Use canonical Building Suit tokens and brand rules: Manrope, IBM Plex Sans Arabic, Hugeicons Stroke Rounded, the approved palette and theme behavior.
- Change reusable visual values at their token source. Do not introduce per-page palettes, competing editable token sets or manual changes to generated outputs.
- Use PrimeVue through the shared UI package. Reuse shared landing/auth/signup templates and the authenticated shell; product configuration supplies navigation, assets and content.
- Apply Atomic Design to shared atoms, molecules, organisms and templates. Product pages, form requirements, tenancy and financial rules remain product-owned.
- Use `BsDataTable` for product data tables, configured with typed columns, query adapters, capabilities and slots. Do not implement a second datagrid.
- Use shared record-action and overlay controllers for add/edit, confirmation, validation, loading, feedback, dirty-state protection and focus. Change interaction policy centrally and verify affected consumers.
- Keep reusable components free of product queries and hardcoded copy. Components used by multiple products belong in the shared system.
- Support English/Arabic, LTR/RTL, light/dark, responsive and accessible states using existing infrastructure. Cover loading, empty, error, success and permission-denied states.
- Keep authorization on the server. A hidden button, disabled field, route guard or client-selected portal is not an access boundary.

## Database, identity and environments

- Read the maintained environment map and verify immutable project refs before remote operations. Do not infer environment from display names, shell defaults or cached CLI links.
- Each product owns a separate production/staging project pair in its own organization. Business tables and API objects use `public`, with explicit grants, RLS and tenant/portal authorization. Keep privileged helpers unexposed and provider-managed schemas intact.
- Auth users and sessions belong to one product/environment/project. Keep profiles, tenant memberships and permissions distinct. Do not link accounts by email, reuse another project's keys or introduce shared sessions without an explicit architecture change. Cookie prefixes include product and environment.
- Resolve trusted portal context server-side. User-editable metadata must not grant authority, ownership, subscription access or trusted client identity.
- Preserve applied migration history. Implement authorized schema evolution through new forward migrations, with dependency review, compatible contracts, generated types and relevant tests. Existing tables and columns may evolve when the task requires it; address data integrity and compatibility explicitly.
- Preserve financial/audit invariants. Do not replace required reversals or archival operations with destructive deletion.
- Keep privileged helpers private, fix safe search paths, qualify SQL references and authorize privileged operations explicitly. Review views, functions, Storage and Realtime access as well as table policies.
- Keep credentials out of source, client bundles, artifacts and logs. Use publishable client keys and scoped server/CI secrets.
- Respect provider-managed schemas. Use supported interfaces and narrowly scoped documented integration changes.
- Run write tests in staging or an explicitly disposable environment. Never reset a hosted business database or run destructive production fixtures.
- Keep database deployments explicit, environment-bound, serialized and uncached. Use the maintained runbook and recovery checks appropriate to the change's risk.

## Verification and completion

- Run checks appropriate to the change. Use the dependency graph to include affected consumers; shared UI/auth/contract changes require verification in all products using them.
- Test meaningful behavior and invariants. Build success alone does not prove authorization, browser flows, financial correctness or data preservation.
- Distinguish passing, failing and unrun checks. Record relevant commands/results and limitations without credentials or customer data.
- Update shared/product documentation and agent guidance when paths, commands, ownership or conventions change.
- Follow current user authorization for deployments, publishing, external communication and consequential actions. A script's presence is not authorization to execute it.
- If blocked, identify the exact missing input/access or failed prerequisite and continue independent authorized work.
- When the requested task and its acceptance checks are complete, report the result and stop. Do not expand into unrelated roadmaps, speculative abstractions or automatically generated improvement work.
