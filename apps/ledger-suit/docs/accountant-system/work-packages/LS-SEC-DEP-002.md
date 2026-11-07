# LS-SEC-DEP-002 — compatible shared toolchain security fixes

2026-10-23. Parent PR #459, `e7ef6b374310b6a1c65bfb27816c84b3948d9bce`. Worktree `ledger-suit-security-hardening`, branch `codex/ledger-suit/security-runtime-dependencies`. No parent edits excluded.

The current production-dependency audit reports 0 critical / 9 high / 14 moderate / 4 low findings. The increase from eight to nine high findings at LS-SEC-DEP-001 is the newly reported Zod constrained-collection advisory. Audit counts are graph findings, not proof of deployment exposure.

Pin compatible fixes for Vite 8.3.5, launch-editor 2.14.2, source-map-js 1.2.2, serialize-javascript 7.1.2 and MCP client/server 2.3.0. The MCP core follows its exact matching 2.3.0 dependency. Zod v4 consumers select 4.6.7; direct application Zod v3 remains unchanged pending its explicit API migration. Vite brings its supported Rolldown 1.2.15, OXC types and PostCSS graph. Existing simple-git/shell-quote protections and the verified DevTools named-import patch remain. Nuxt, Vue, router and application code/migrations are unchanged.

The fresh audit after these selections reports **0 critical / 2 high / 6 moderate / 2 low**. Open findings are node-forge, direct Zod v3 and Nuxt/Nitro. No ignore list or severity downgrade hides them. This task does not close overall LS-SEC-001, hosted configuration review or commercial acceptance.

## Behavioral verification

The normal root test glob now includes `tooling/checks/runtime-toolchain-security.test.mjs`. It resolves the installed dependencies from their actual Nuxt ESLint / config-inspector / agentic and Vite / PostCSS consumer paths. Real local HTTP servers verify that an ordinary same-origin MCP redirect retains the valid message/header and that a cross-origin redirect is rejected before sending any custom header or body to the second server. All values are synthetic and servers bind loopback only. Source-map parsing accepts an ordinary mapping and rejects huge, invalid and cumulatively huge nested indexed offsets before amplification work.

Against the parent's installed graph, the legitimate request passes while both security regressions fail: old MCP follows the redirect, and old source-map-js accepts excessive offsets. Against this task's graph, all three pass. The existing four Git/editor/shell command-security checks remain separate.

## Verification and limits

All seven application preparations pass. Shared consumers are Automation, Doctor, Inventory, Ledger, Shop, Super Admin and the documentation app. Full build, type, lint, unit and appropriate browser outcomes are recorded in the dated evidence before publication. No database/service deployment, Automation row update or accountant verdict is inferred from this dependency work.

The full root unit run reports 1,947 passes / 58 failures / 23 skips (2,028 total). Every failure reproduces on the parent: Shop has 54, and shared receipt/Automation health tests have four. The two Shop lint errors also reproduce on the parent; the other six application lint tasks pass. New scoped lint and workspace boundaries pass. The initial unbounded build/type run exhausted managed memory; it is not passing evidence. The follow-up follows maintained CI concurrency two with sequential type/build phases. [Dated evidence](../v2-acceptance/compatible-dependency-verification-2026-10-23.json) retains the exact audit and verification outcomes.

The bounded typecheck completes successfully for all seven applications. The normalized set of failed root test names exactly equals the union of the parent Shop and parent shared/Automation reruns; no new failing name is introduced.

All seven production builds pass with bounded concurrency. Four browser cases pass: the shared component catalogue, EN/AR Ledger+Shop sign-in parity and Ledger public/auth layouts. Seven broader cases fail. Actual parent Shop production build reproduces the same HTTP500/Pinia Colada Error serialization when its local pricing backend is unavailable. Two unchanged Doctor tests wait for the retired combined settings button; four unchanged Automation/Inventory/Super Admin cases wait for an absent `header` in the shared sidebar shell. These are retained readiness follow-ups; no whole-browser/full-CI success is claimed. No app/shared UI/browser fixture source was modified by this task. The parent reproduction changes only ignored generated artifacts, with no service/database write.

The dependency repair is ready for review with these explicit baseline limits. Remaining runtime framework/validation advisories, inherited regression maintenance and hosted/Automation/accountant evidence remain independent work.
