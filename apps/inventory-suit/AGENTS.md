# Product development

Root `AGENTS.md` and `docs/agent-workflows.md` apply. Routes live in `app/pages`; reusable product orchestration belongs in `app/composables`, product-only components in `app/components`, and pure helpers in `app/utils` when needed.

Use the shared Nuxt layer, templates, PrimeVue components, `BsDataTable`, dialogs and UX controllers. Supply product content and validation through configuration. Keep business rules and tenant/permission adapters product-owned. For backend features, own a Supabase CLI root at `apps/<slug>/supabase` and register its organization, production/staging pair and local ports in the environment map. Use the shared root product selector for authorized changes, `public` for business objects and independent Auth sessions. Verify relevant English/Arabic, themes, accessibility and backend authorization.

Before every new/resumed task, run `pnpm agent:preflight`. Keep fixes on the same open feature branch/PR; stack new dependencies and use separate worktrees for parallel features. Follow `docs/shared/git-workflow.md`: one active `stg` root for this app's `codex/<app>/*` stack, same-stack parents only, live GitHub merge checks, and provider deployment filters.
