# Database development and release

`supabase/config.toml` is the active database root. The checked-in environment registry is `docs/architecture/environments.json`; inspect actual objects and deployed migration history before assuming an environment implements a documented schema. `supabase/legacy` contains reference material and is excluded from the active migration chain.

## Local development

Run the pinned CLI from the workspace with `pnpm exec supabase`. `pnpm exec supabase start` initializes this repository's isolated project using its configured ports. Review Docker resources and the project ID first. Never point local fixture/reset commands at a hosted database. Obtain local publishable credentials from CLI status without committing or logging privileged keys.

Create forward SQL files with `pnpm exec supabase migration new <name>`. Review ownership, dependencies, RLS, grants, security-definer functions, views, Storage and Realtime where affected. Apply to the disposable local instance with `pnpm exec supabase migration up --local`. Use `pnpm db:lint` for database lint and `pnpm db:test` for the current Ledger pgTAP and Shop transactional SQL suites; `pnpm db:test:ledger` and `pnpm db:test:shop` select a product; feature-specific test paths may be passed directly to `pnpm exec supabase test db --local <path>` when the environment contains only that feature's baseline. Record unrun suites explicitly.

Generate types using `pnpm db:types` and write the reviewed output to the owning API contract file. Update callers and verify business and authorization behavior, including denied cross-user/tenant/portal requests. Do not assume a passing build proves these checks.

## Hosted release

Before any remote change, verify the immutable ref, authorization, complete applied history, backup/recovery point and relevant service configuration. The environment registry is the source of the expected ref. `pnpm db:preflight staging` or `pnpm db:preflight production` checks that `SUPABASE_PROJECT_REF` matches it; the preflight does not deploy SQL or verify live backups.

Use the CLI's explicit `--db-url` connection for the verified environment or the provider migration API with the verified `project_id`. Obtain credentials through the deployment secret store, never an application publishable key. Preview pending migrations with the CLI's `db push --dry-run` and review the exact forward files before applying them through the migration interface. Do not use raw-query tools for untracked schema mutations or rewrite applied versions. Keep database releases serialized per environment and outside cached build tasks.

Rehearse in staging with representative data and relevant application/API tests. Release compatible database and app changes in the reviewed order, with environment-specific app origins and Auth callback allowlists. Verify resulting migration versions, app health, denied-access cases and the changed business journey. For a failure, follow the reviewed recovery procedure; a namespace reversal alone is not sufficient after new writes. Keep release evidence free of credentials and customer data.

The repository's CI workflow performs workspace checks; it does not provide an automatic hosted deployment pipeline. When a task adds deployment integration, bind it to verified refs, use scoped CI credentials and retain explicit serialization/recovery checks.
