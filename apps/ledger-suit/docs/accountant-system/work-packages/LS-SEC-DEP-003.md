# LS-SEC-DEP-003 — patched native Nuxt runtime

2026-10-23. Implemented and locally verified; review publication pending. Parent PR #462 at `2487314070f1f9c1469d8847e749f9ab0b3c2f19`; worktree `ledger-suit-framework-security`, branch `codex/ledger-suit/patched-nuxt-runtime`. No parent edits excluded.

The remaining Nuxt/Nitro advisories concern case-variant server route rules, safe head rendering in server islands and unsafe-link prefix handling when pages are disabled. Upgrade all nine direct Nuxt selections from 4.5.2 to the patched 4.6.2. Align their Vue 3.5.44/router 5.4.0 selections and the root SFC compiler with the supported framework versions. The existing pinned Node 26.8.1 satisfies the framework; root engines explicitly reflect the newer supported Node release floors. Direct Zod v3 remains a separate API migration. No financial schema, tenant/capability gate, deployment or business amount is changed.

## Native regression

`NUXT_ROUTE_SECURITY_DISPOSABLE=1 node tooling/checks/nuxt-route-security.mjs baseline|verify` must run from a verified Building Suit Git workspace root. It accepts no URL, key or database. It creates a unique owned synthetic Nuxt application under ignored `.local/verification`, builds it with that workspace's actual installed framework, starts its real production server on an owned ephemeral loopback port and preserves private logs/result evidence. The server is stopped afterward.

The ordinary public login returns 200. A route rule protects synthetic `/protected` with a redirect and explicit header. On the actual parent Nuxt 4.5.2 build, `/protected` returns 307 to `/login`, while `/PROTECTED` returns 200 and renders the protected synthetic text without the guard header. This reproduces GHSA-vjh5-4x84-xrqp in 8.127 seconds (7.800 seconds build). Both builds use identical generated app source, SHA-256 `1a9754de32112adf8ade8ddb00968261a142e2444cf2743355a49d6ae16eaf23`. The patched run must protect both variants; login must still work.

The fixture is a framework regression, not a claim that product RLS or user credentials were bypassed. Product applications/database/provider configuration remain untouched. The other two advisories are addressed by the upstream patched selection; this probe does not independently claim their exploit reproduction.

## Compatibility and remaining gates

Inspect the actual new CLI/DevTools dependency graph before removing the previous one-line DevTools named-import patch or changing its regression assumptions. Retain meaningful verification of the current installed consumer; record any removed upstream Git or TLS dependency path explicitly. All seven app consumers require preparation/type/build verification; Ledger browser and the existing baseline regression failures remain separate evidence. No full-CI, hosted security review, live Automation update, accountant UAT or sale-ready status is inferred.

## Patched outcome and upstream dependency transition

The identical native app on Nuxt 4.6.2 passes: public login 200, ordinary and uppercase protected paths both 307 to `/login`, both carry the guard header, and neither renders protected text. The actual run takes 20.561 seconds including a concurrent-setup production build of 19.746 seconds; this is not a benchmark comparison.

The fresh audit reports **0 critical / 2 high / 0 moderate / 0 low**. The high findings remain direct Zod v3 and node-forge. The latter now resolves through Nitro → listhen; the CLI upgrade alone does not remove that separate path. No severity is waived or hidden.

Actual DevTools resolves to upstream **3.4.4**. It removes simple-git and uses tinyexec with fixed readonly Git argv for branch/revision/status. The obsolete 3.4.2 named-import patch is removed. The prior three simple-git guard tests no longer have an installed consumer; they are replaced by an explicit failure if the removed wrapper can resolve, plus actual readonly Git operations through the currently installed tinyexec. The original shell-comment/newline rejection remains. No test is skipped to accommodate an unsafe implementation. These three current consumer checks and all three MCP/source-map checks pass. The old four-check result remains historical evidence in LS-SEC-DEP-001/002.

All seven preparations, typechecks and production builds pass. The full root run has 2,027 tests: 1,946 pass, 58 fail, 23 skip; normalized failed names exactly match the parent. The single-Vue repair also passes all 34 shared foundation tests. All 64 selected Ledger atomic browser cases pass (5.1 minutes). Product/shared UI/financial/tenant implementations are unchanged. Inherited Shop unit/lint/backend-unavailable SSR and shared-shell selector failures remain separately tracked at parent #462.

## Compatibility repairs discovered by validation

The first combined checks exposed a retained Vue 3.5.42 peer selection in shared UI/interaction consumers. It produced four additional SSR fixture failures (mixed runtime `renderSlot` ownership). Align the UX direct dependency and enforce Vue 3.5.44 for workspace peer selections; the upgrade must keep one Vue runtime. No failure is waived.

Nuxt 4.6's stricter template bindings require explicit `navigateTo` imports for ten existing route/layout event handlers across Ledger, Shop, Doctor and Super Admin. Their navigation arguments and authorization are unchanged. One Super Admin request now infers its POST method rather than explicitly defaulting `unknown` to GET; runtime decoding remains authoritative. The external changelog adapter specifies its response/request generic to avoid recursively inferring internal route unions; its HTTPS origin validation, header, POST body, timeout, redirect denial and generic 503 remain identical. The Super Admin typecheck passes after these narrow adaptations. The initial all-app type/build pipeline was stopped before publishing; its incomplete/failed state is not acceptance evidence.

## Final verification

Scoped ESLint passes for all changed app/shared sources (two existing Shop warnings). Workspace and release checks pass. The first bounded final build completed five apps and found two owned stale Nuxt locks in Inventory/Super Admin. Each lock matched the exact local worktree and an interrupted build PID verified as a zombie under PID 1. Only those four lock files were removed after rechecking their unchanged bytes; locking remained enabled. Both affected builds then passed. No financial volume, schema or source was removed.

The dated [verification evidence](../v2-acceptance/framework-security-verification-2026-10-23.json) records the native before/after, versions, audit and inherited failures. The whole repository CI is not green: 54 Shop and four shared receipt/Automation unit failures remain inherited and are not waived. The browser result covers the selected Ledger atomic cases, not every legacy fixture or native billing lifecycle.
