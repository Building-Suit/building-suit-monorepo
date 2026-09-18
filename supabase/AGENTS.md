# Supabase environment configuration and archives

Root rules apply. This directory holds ignored per-product/environment deployment credentials and their committed blank templates under `environments/`, plus historical SQL under `legacy/`. It is not a CLI project root.

- Use `docs/architecture/environments.json` and `docs/shared/supabase-manual-setup.md` for the explicit product/environment mapping. Do not infer a target from display names, cached CLI links or another product’s credentials.
- Keep populated environment files ignored. Never log secret values or load deployment credentials into Nuxt/client configuration.
- Own current SQL, functions, configuration and tests under `apps/<product>/supabase/`; use `pnpm db <product> <command>` from the repository root.
- Historical SQL is provenance, not an additional replay chain. Preserve its contents.
- Organization roles, provider quotas and plans require live verification before account changes. Do not assume separate creator emails remove shared-owner account limits.
