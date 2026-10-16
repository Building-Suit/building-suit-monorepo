# Doctor Suit synthetic browser preview

Generated with the maintained `pnpm new:platform doctor-suit "Doctor Suit"` starter after inspecting its dry run. This scaffold is DOS-M1-002. It has no authenticated session or database access; the visible scope disclosure is not an account-creation success.

Run the root `pnpm install --frozen-lockfile`, `pnpm run setup`, then `pnpm dev:doctor`. That command serves the current checkout deliberately on loopback port 3006. Use the Doctor feature worktree when reviewing this app. The chosen app port 3006 and browser port 4336 did not appear in existing environment/browser configurations and were free in the executor's listener inventory on 2026-10-16. The browser harness refuses port collisions instead of reusing an existing server.

Run `pnpm --filter @building-suit/doctor-suit build` then `pnpm exec playwright test -c apps/doctor-suit/tests/e2e/playwright.config.ts`. The harness starts this app's production build on 127.0.0.1:4336. It rejects remote backend URLs and does not create provider resources or credentials. Unit coverage: `node --test apps/doctor-suit/tests/unit/dos-m1-002.test.mjs`.

`.env.example` contains blank values only. No hosted project, public origin, canonical URL, Supabase Auth or operational release registration is configured. The user handles provider connections separately; independent product identity and backend authorization precede protected workflows. No real patient data is allowed.

All visual composition belongs in `packages/ui`, interactions in `packages/ux`, and Doctor logic/props in this app. Every route uses one registered complete shared template; no local components, CSS or presentation factories. Consult root and scoped AGENTS and the [implementation contract](../../docs/work-packages/doctor-suit/website-contract-v0.2.md).

The public `/` route now uses `BsProductPreviewPage` with explicit planned-feature labels; `/preview` uses the existing shared workspace shell with an honest inactive-context banner. EN/AR HTML language/direction and themes are verified. Product context lifecycle helpers invalidate stale work and clear drafts, but authenticated administrative workflows remain subsequent M1 implementation; a context projection never grants backend authority.
