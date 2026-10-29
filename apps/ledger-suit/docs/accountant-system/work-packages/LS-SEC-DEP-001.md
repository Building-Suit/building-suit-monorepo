# LS-SEC-DEP-001 — critical toolchain dependency fixes

2026-10-22. Child of native financial verification PR #443. This closes the three critical advisories found during LS-READY-001; overall security and sale readiness remain open.

The affected dependency paths are Nuxt → DevTools → `simple-git` / its argument parser, and DevTools → `launch-editor` → `shell-quote`. These are development tools; the workspace production-dependency audit includes them because Nuxt is an application dependency. This audit alone does not establish deployed exploitability.

## Change and evidence

Workspace overrides pin `simple-git` to 4.0.2 (including its exact `@simple-git/argv-parser` 2.0.1 dependency) and `shell-quote` to 1.11.0. Simple-git 4 removed its default ESM export. A one-line, hash-verified pnpm patch changes DevTools 3.4.2 to the supported named `simpleGit` export. No unsafe compatibility options are enabled. Nuxt, Vue and their unrelated dependency/peer selections remain at the parent versions. Remove the DevTools patch when an upstream version supports this API; verify its actual consumer again when updating.

The normal root test glob includes `tooling/checks/toolchain-command-security.test.mjs`. It resolves the dependencies from the installed Nuxt DevTools consumer, creates owned temporary repositories, and checks real Git branch/status/revision operations plus rejection of trailer-command configuration, an injected `VISUAL` editor, and shell newline/comment injection. Before the update, the legitimate operation passed and all three security regressions failed, including a shell marker created inside the owned temporary directory. After the update, all four pass. Fixtures remove only their own temporary directories. The fixture explicitly permits only its safe `GIT_CONFIG_NOSYSTEM=1` selector; it does not disable the command/environment guards.

The [dated audit evidence](../v2-acceptance/critical-dependency-verification-2026-10-22.json) retains the advisory identities, versions and remaining findings. The same `pnpm audit --prod --json` check changed from 3 critical / 10 high / 14 moderate / 4 low to **0 critical / 8 high / 14 moderate / 4 low**. The two additional high findings belonged to the same patched Git dependencies.

## Remaining release work

The remaining graph contains patched-version candidates for Nuxt/Nitro, Vite, launch-editor, source-map-js, MCP tooling and serialize-javascript. Node-forge and braces findings currently report no patched version and require a separate dependency-path/reachability decision. Their removal is not implied by this bounded fix. The broader LS-SEC-001 native authorization checks, authenticated configuration review, provider evidence, recovery drill and accountant acceptance remain separate gates.

This package changes no financial rules, migration, database, deployed environment, Automation task row or accountant verdict. Local evidence is not production promotion.
