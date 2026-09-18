# Shared tooling

The root package manifest pins the Node package manager and core framework versions. `turbo.json` owns the workspace task graph. Nuxt integrations and CSS registration live in `packages/nuxt-layer/nuxt.config.ts`.

Keep package boundaries enforceable by `pnpm check`: packages cannot import app internals, apps cannot import one another, and product tables and dialogs use shared components. Add rules to `tooling/checks/workspace.mjs` when a shared architectural constraint needs mechanical enforcement.
