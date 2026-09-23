# AI-agent workflows for ongoing monorepo development

Use these workflows to navigate, maintain and extend the repository. Select only those relevant to the user's task. Root and scoped `AGENTS.md` files define the applicable rules.

## 1. Start or resume a task

1. Read the root README, applicable agent rules and relevant shared/product specifications.
2. Run `pnpm agent:preflight` and inspect all worktrees, dirty files, commits, fetched upstreams, open PRs and recent/manual GitHub merges. Read [the branch workflow](shared/git-workflow.md) and reconcile stale/retired branches before editing. Preserve unrelated edits and active worktrees.
3. Find the owning app/package/schema using the navigation map, exports and dependency graph.
4. Identify affected consumers, environment assumptions and acceptance criteria. Search existing implementations before adding abstractions.
5. Use documented root scripts and workspace filters; verify actual script names.
6. Reuse the open feature branch for adjustments. For new work, derive its key from `codex/<stack>/<feature>`, identify that stack's newest active leaf, record its committed SHA and create the child worktree from that SHA. Target its PR at the same-stack parent branch; use fresh `origin/stg` only when that stack has no active parent. Reconcile merged/closed parents first. Dirty parent edits stay in that worktree until its owner commits a checkpoint and the child incorporates it. Implement the requested scope, run relevant checks and update documentation. Use a short task record when a handoff is useful; small fixes do not require a new planning document.

## 2. Add or change a product feature

Apply workflow 1 first. Every new feature stacks on the latest verified active worktree for its own app/shared stack. Parallel features use separate worktrees; publish a same-stack parent checkpoint and its PR before the child PR. Different stacks may have independent roots targeting `stg`, but one stack may not have sibling roots or parent a feature on another stack. Existing-feature fixes stay on that feature's branch.

1. Locate the owning product's pages, composables, requirements and tests.
2. Use shared shell or marketing/auth templates, with product navigation, content, permissions and translations supplied through configuration.
3. Compose forms/pages from shared UI, `BsDataTable` and record-action controllers.
4. Put product validation, orchestration and repository/RPC adapters in the feature. Keep business rules out of generic UI.
5. Use tenant-scoped queries and authorized atomic commands with correct cache keys, pending/error handling and invalidation.
6. Verify the user journey, permissions/subscriptions, refresh/deep links, failure recovery and relevant invariants. Update the appropriate product/shared documentation.

### Preview the work under development

1. Run the owning root `dev:*` command with `--list` or `--dry-run` to inspect the selected branch/path. Selection considers changes to that app and shared packages (also maintained docs for `dev:docs`), including uncommitted files. Newer source activity wins; stack depth breaks ties.
2. Run the same command to start Nuxt in that worktree. Prepare that worktree’s dependencies first. Its app `.env` is used when present, otherwise the original checkout’s same-app local `.env` is passed explicitly; no credentials are copied.
3. Use `--current` or `--worktree <branch/path>` for a deliberate or offline preview. When other possible feature worktrees exist, auto mode verifies GitHub and refuses to guess when access fails; an original checkout with no other possible feature runs offline. With no relevant active feature it serves the original checkout unchanged.
4. Confirm the printed source matches the work being reviewed. Restart the dev command after selecting a new worktree; normal edits in the selected tree hot-reload. Separate sibling worktrees are never combined by the launcher.

## 3. Add or change shared UI or interaction behavior

1. Locate the atomic component/template, token source and interaction-policy owner. Search all consumers.
2. Extend the existing typed interface/configuration/slots where appropriate; avoid per-product forks.
3. Change tokens at their source and regenerate outputs when visual foundations change.
4. Implement common presentation in `packages/ui`, interaction logic in `packages/ux` and framework integration in the shared Nuxt layer.
5. Update the component catalogue, contracts and affected consumers together.
6. Verify relevant language/direction/theme, mobile/desktop, keyboard/focus and loading/error/empty/success/permission states in every affected product.
7. Run affected component/browser checks and boundary/token checks. Stop when the requested change's acceptance criteria pass.

## 4. Fix a bug

1. Reproduce the reported behavior in the appropriate environment with a representative scenario.
2. Trace the route/component, shared controller, feature adapter and backend contract as applicable.
3. Identify the owning layer and other consumers affected by the same cause.
4. Fix the cause in that layer. Avoid product workarounds for shared faults or shared changes for product-only faults.
5. Add meaningful regression coverage where needed; run relevant checks and the original reproduction.
6. Report the result and any blocker without attaching unrelated cleanup or roadmap work.

## 5. Evolve a database schema or API contract

1. Read `apps/<product>/supabase/AGENTS.md`, the owning domain’s contracts, `docs/architecture/environments.json` and the maintained database runbook in `docs/shared/database.md`.
2. Verify the target environment/ref and inspect relevant applied history, schema definitions and callers.
3. Design the requested change with compatibility, data handling, privileges, RLS, function/view dependencies and risk-appropriate recovery.
4. Create a new forward migration with `pnpm db <product> migration new <name>`. Business objects use that product’s `public` schema; privileged helpers remain unexposed. Do not modify applied files or bypass versioned deployment.
5. Test in the designated safe environment, checking affected authorization, constraints, business invariants and callers.
6. Regenerate database types, update adapters/contracts and verify affected applications.
7. Use the environment-bound deployment workflow within current authorization. Record versions, checks and recovery instructions without sensitive data.

## 6. Change authentication, authorization or onboarding

1. Identify the owning product/environment’s Auth project, trusted portal context, profile, tenant membership and permissions separately. Shared UI mechanics do not imply shared identities.
2. Read the current session architecture, credential methods, callback rules and product requirements.
3. Update the shared auth implementation and product adapters. Keep wizard navigation/verification mechanics shared.
4. Never infer ownership from matching unverified contacts or grant authority through user-editable metadata.
5. Verify relevant new/existing user, invitation, incomplete onboarding, verification expiry/resend, recovery, refresh, logout and denial flows in the owning product.
6. Verify account/tenant switches clear sensitive caches, listeners and draft/table state.
7. Verify that cookie prefixes, callbacks and project keys isolate products and environments. SSO/account linking is deferred; introducing it requires an explicit architecture decision and authorization.

## 7. Maintain documentation, tokens and agent guidance

1. Identify the authoritative shared/product specification, architecture decision, token source or component contract.
2. Update that source and references, distinguishing maintained guidance from historical records and prototype evidence.
3. Generate token/type/catalogue outputs from their source; do not maintain competing editable copies.
4. Verify affected links, assets, translations and the docs build where relevant.
5. When structure or commands change, update agent navigation and affected workflows in the same task.
6. Ensure guidance matches actual paths/scripts, supports ordinary authorized feature/schema development and contains no stale task-specific restrictions.

## 8. Add a new platform

1. Confirm the requested scope, content, domain ownership and existing shared capabilities.
2. Run `pnpm new:platform <slug> "Product name" --dry-run` to inspect the maintained template, then run without `--dry-run` and use `pnpm install` and `pnpm run setup` to register/prepare the app.
3. Configure brand assets/content, navigation, translations, tenant/profile adapter and onboarding requirements.
4. Reuse shared templates, PrimeVue components, table and UX controllers. Add shared capabilities only for concrete requirements.
5. Define product contracts and an app-owned Supabase CLI root through the database workflow. Configure its own organization and production/staging pair, `public` business schema and independent Auth. Verify current provider quota/role constraints before provisioning.
6. Add scoped agent guidance, tests, environment configuration and build/deploy integration within the requested scope.
7. Verify the new app and affected existing consumers. Scaffolding alone does not authorize paid resources or publication.

## 9. Release a change

1. Run the preflight again, check live PR/base/head state and the [app-stack integration procedure](shared/git-workflow.md#integrate-and-release-app-stacks). Incorporate only reviewed, ready features and inspect affected apps/packages/database objects, including shared and root changes.
2. Run required CI checks; verify the artifact/commit, environment variables, project refs and callbacks.
3. Verify the previous staging deployment completed successfully and the five-minute minimum between staging merges. Publish/merge one authorized stack root at a time; apply database changes through the existing serialized environment-specific deployer and deploy affected apps in runbook order. Do not add a second deployer or assume Actions concurrency serializes Vercel/Supabase integrations.
4. Follow current authorization and the release/recovery process; green CI alone does not authorize production deployment.
5. Verify the merged SHA, provider outcomes, health and affected journeys/services. Fetch again, retire completed branches and repair remaining stacks using the manual-merge recovery procedure. Record the release or invoke the documented recovery path as needed.

## 10. Finish or hand off

1. Review the diff against scope and acceptance criteria; preserve unrelated edits.
2. Record actual verification results and distinguish existing limitations from introduced issues.
3. Update affected contracts, documentation and agent guidance for the next agent.
4. Refresh GitHub before publishing; commit verified adjustments to the same open feature branch, push a coherent checkpoint and create/update its correctly targeted PR. Run `pnpm agent:pr-check <number>`. For a handoff, identify the worktree, branch, PR, parent/batch, base/head SHAs, exact unfinished work and blockers. Do not mark unverified requirements complete.
5. When the requested task is complete, give a concise result and stop without generating unrelated follow-up work.

## Task record template

```markdown
# Task — Title
Status: in progress | complete | blocked
Requested outcome and acceptance criteria:
Owning apps/packages/schemas:
Worktree, branch, PR and parent/batch PR:
Last verified origin/stg and feature head SHAs:
Affected consumers:
Environment/project refs, when relevant:
Files and contracts changed:
Verification commands/scenarios and actual results:
Relevant evidence:
Known limitations or exact handoff/blocker:
```
