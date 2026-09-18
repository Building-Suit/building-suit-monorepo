# Agent guidance review — final independent-project structure, 2026-09-19

Reviewed root `AGENTS.md`, all app rules, both app-owned Supabase rules, root Supabase configuration/archive rules, shared UI rules, `docs/agent-workflows.md` and future-platform templates.

- Rules describe future development, maintenance, testing and releases. They do not instruct future agents to repeat this repository copy, monorepo conversion or one-time Shop transfer.
- App navigation matches actual routes/composables/components/types/utils. Shared packages cannot import apps, and apps cannot import each other’s internals.
- Database ownership points to `apps/<product>/supabase`, explicit `pnpm db <product>` selection and per-product production/staging configuration. No active rule assumes a single root CLI project or private product business schemas.
- Business objects use `public` with RLS/grants; privileged helper and provider-managed schemas retain their boundaries.
- Identity is project-scoped. Shared auth UI does not authorize shared sessions, account linking or future SSO work automatically.
- Environment/ref/organization/origin/key handling matches the committed templates, preflight validator and manual setup guide. No automatic hosted deployment is claimed.
- Documented setup uses `pnpm run setup`, avoiding pnpm’s unrelated built-in `setup` command. CI and generated-app guidance use the same command.
- Root and app READMEs, architecture decisions and the maintained plan match the actual tree. Superseded plans/rehearsals are labeled historical and excluded from active rules.
- Complete original Building docs and old agent instructions remain preserved as evidence; documentation-app rules clearly distinguish them from current guidance.
- Rules preserve ordinary authorized feature/schema evolution through forward migrations, require relevant verification and accurate limits, and stop at the user’s requested scope.

No additional migration steps or unrelated work were inserted into future agent workflows. Hosted transfer remains a bounded manual-target-dependent task documented separately.
