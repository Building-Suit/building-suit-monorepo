# Atomic template unification — local acceptance

All requested local implementation and acceptance phases are verified. Publication remains pending; no deployment, hosted database change, provider setting change or PR merge is authorized or performed.

## Candidate and ownership

Branch: `codex/shared/atomic-template-unification`. Resume source: `81711b3`. The existing worktree and all completed migration work were preserved. Parent: [Shared #238](https://github.com/Building-Suit/building-suit-monorepo/pull/238), committed `089381052fccdd9768d20ad403037f12bd3fa0d9`. Live preflight on 2026-10-11 at 20:52 UTC confirmed that parent, ancestors #236/#231 and accepted staging `18dcf90f33335c06c74a2c9b98ce794b90991837` remain unchanged, with no policy errors. All are ancestors of this candidate. Parallel changelog #246 and other chats' dirty files remain excluded. No child PR has been published.

Original source inventory: 86 Suit Vue files, 74 routes, zero local components. Reconciliation added accepted Inventory/Super Admin sources: final inventory is **90 adapters: 76 routes, nine layouts, five roots, zero Suit-local components**. The [canonical route-template map](atomic-template-route-inventory.json) records every source, destination, purpose, product adapter and current import dependency. Historical composition/dependencies are retained explicitly where they differ.

All routes render one registered complete shared page composition. Shared roots/layouts own route outlets. `BsWorkspaceShell` is consumed by all five Suits. Ledger and Shop use the exact same access, authentication, signup, dashboard, settings, billing, reports, public/legal, invitation and platform administration owners. Legitimate product capabilities, navigation, selector content, permission catalogues and financial/commerce projections remain typed product configuration; no fabricated similarity percentage is claimed.

Relative to the authorized resume source, this migration adds 51 template compositions/helpers, extends four existing templates, adds 31 organisms and extends twelve existing organisms. Existing atoms, fields, canonical data table, access matrix, tokens, typography and brand assets are reused. Thirty-two shared UX composables are added and two extended, covering dialogs/dirty state/focus, menus/tabs, bounded polling, debouncing, browser actions, file handling, tree expansion and workspace navigation. Compatibility workflow factories are removed. Exact money formatting and usage ratios live in UI; browser printing/download behavior lives in UX. Product queries, trusted authorization context, financial arithmetic, posting/reversal rules and atomic command payloads remain Suit-owned.

## Executed acceptance

Evidence logs and captures are local, ignored artifacts under `.local/atomic-template-evidence/` in this worktree. Most browser writes use synthetic local fixture interception. The separate persistence/session check uses newly created, explicitly disposable localhost Ledger/Shop instances; neither form of testing authorizes or proves hosted database/provider behavior.

| Check | Verified result | Evidence |
| --- | --- | --- |
| Normal `pnpm check` | 76 canonical route mappings; zero migration debt; workspace/token checks pass | `final-candidate-check.log` |
| Six fresh consumer typechecks | 6 successful, no cached tasks | `final-all-typecheck.log` |
| Six fresh production builds | Ledger, Shop, Inventory, Automation, Super Admin, Docs pass | `final-presentation-<app>-build.log` |
| Six consumer lint checks; package/tooling lint | Pass | `final-all-suit-lint.log`, `final-packages-tooling-lint.log`, `final-browser-tools-lint.log` |
| UI/UX/architecture/generator regression | 140 pass, no skipped tests; includes 47 strict negative/ownership cases and 14 generator cases | `final-presentation-regression.log` |
| Ledger business regressions | 122 pass, zero failures/skips | `final-ledger-unit-verified.log` |
| Shop business regressions | 213 pass, zero failures/skips | `final-shop-unit-verified.log` |
| Ledger complete mobile/desktop sweep | 205 pass | `final-ledger-browser.log` |
| Ledger tablet, supporting routes and additional invariant sweep | 116 pass | `final-ledger-tablet-browser.log` |
| Shop complete mobile/desktop sweep | 208 pass | `final-shop-browser.log` |
| Shop tablet, team and shell sweep | 88 pass | `final-shop-tablet-chrome-browser.log` |
| Final Ledger dashboard matrix after data-only contract narrowing | 12 pass | `final-ledger-dashboard-browser.log` |
| Final Shop shell matrix | 12 pass | `final-shop-chrome-browser.log` |
| Sign-in/signup/public routes | 36 pass | `final-auth-public-browser.log` |
| Docs catalogue, side-by-side access and dirty-dialog focus | 32 pass | `final-docs-complete-browser.log` |
| Automation: all eight routes, reviewed policy/project/task operations | 12 pass | `final-automation-complete-browser.log` |
| Inventory/Super Admin: bootstrap, retry and responsive shell focus | 12 pass | `final-bootstrap-complete-browser.log` |
| Normal repository browser command, all configured servers | 111 pass; existing opt-in backend case separately verified below | `final-foundation-browser.log` |
| Actual disposable-backend signup, product persistence after reload and independent Ledger session | 1 pass, zero skips | `final-disposable-backend-browser.log` |
| Observed route coverage | All 76 registered routes visited by completed, passing browser sweeps | `final-route-coverage.log` |
| Cross-Suit shell parity | Five Suits × 12 language/theme/viewport combinations; exact measured geometry, typography and theme styling match | `final-shell-parity.log` |

The sweeps cover English/Arabic, LTR/RTL, light/dark and 390/768/1440 viewports. Sign-in, signup and member-tab controls are compared side by side. Shared shell parity compares browser measurements, not class-name/source inference. Captures for each page family include bilingual/theme/responsive views; reviewed examples include Arabic dark mobile journal/administration/reports and tablet administration, receipt and inventory accounting. The 64px canonical header fixes the measured Shop selector-height drift centrally.

Meaningful state and behavior assertions include loading/busy, empty/error, success and denied/restricted controls; keyboard navigation, Escape/focus restoration and dirty cancellation; all nine bilingual journal commands; evidence acceptance invalidation; reason-required journal reversal; unsafe control adjustments rejected before RPC; exact decimal amounts beyond JavaScript safe integers; staged import/posting, source/revision/idempotency payloads, VAT/subledger reversal, permission/owner invariants, POS/payment/customer policy, receipt/upload expiry and stale reply handling. Legacy `/imports` is counted only after its real transactions redirect and named import dialog are verified. Dialog titles use their accessible name; product route query behavior is preserved.

The normal UI sweep records one opt-in backend skip explicitly, never as a pass. That exact backend test was then executed successfully against unique local projects `atomic-shop-acceptance-20261012` / `atomic-ledger-acceptance-20261012` on API ports 57321 / 58321, with browser-safe public keys. Both complete migration chains applied unchanged. Startup exposed a stale Shop disposable seed with 14-day trials; its two legacy fixture rows now use the existing seven-day contract. The backend test retains real OTP, database persistence and independent-session assertions, and uses the current main-location/full-access signup flow. Only these owned test containers/volumes were removed afterward; existing local databases and hosted projects were untouched.

Dashboard columns are data-only projections, preserving the existing lower-level `BsDataTable` contract without exposing its formatter callbacks through a page view. Strict checks resolve actual exports, imported callable aliases/wrappers and imported/re-exported/namespace/inline type contracts. They reject hidden render implementations, vendor/native/slot/style escapes, unregistered or inconsistent purpose mappings, backend/app imports in UI, callable/opaque render contracts and presentation files/render calls/UI dependencies in UX. There are no compatibility scope or migration-debt exceptions. Future Suit generation registers the same root, shell and starter template owners; new generated routes remain unverified until their own acceptance passes.

## Reproduce

Build the six consumers with the documented workspace build commands, then run each scoped Playwright config under `packages/testing/` with `--reporter=list,./packages/testing/atomic-route-coverage-reporter.ts` and a unique `BS_ROUTE_COVERAGE_RUN` label. Auth, access, Automation, bootstrap, Ledger financial and Shop configs own independent output directories. Scoped auth uses ports 4340/4341; the normal `pnpm test:e2e` sweep uses standard ports 4320–4325. Run complete suites for a new candidate; a failed/interrupted run cannot satisfy either gate.

```sh
pnpm check
pnpm exec turbo typecheck --concurrency=2 --force
pnpm exec turbo lint --concurrency=2 --force
BS_ROUTE_COVERAGE_RUN=foundation pnpm test:e2e --reporter=list,./packages/testing/atomic-route-coverage-reporter.ts
node tooling/checks/atomic-browser-route-coverage.mjs
node tooling/checks/atomic-browser-shell-parity.mjs
```

The two acceptance gates consume completed passing run records, preferring the newest successful measurements. Route coverage includes the product financial/commerce scoped suites as well as the repository foundation sweep. Exact regression commands:

```sh
pnpm --filter @building-suit/ledger-suit test:unit
node --experimental-strip-types --test apps/shop-suit/tests/unit/*.test.mjs
node --experimental-strip-types --test packages/ui/tests/*.test.mjs packages/ux/tests/*.test.mjs tooling/checks/atomic-template-architecture.test.mjs tooling/new-platform/tests/generate.test.mjs
```

The backend-only config requires explicit `BS_ATOMIC_BACKEND_LEDGER_API`, `BS_ATOMIC_BACKEND_SHOP_API`, corresponding `_PUBLIC_KEY` variables and `BS_ATOMIC_BACKEND_SHOP_MAIL`. All endpoints must be localhost, and the owning test runner verifies unique disposable project IDs before running it. Obtain only browser-safe keys from the pinned CLI status in memory; do not write privileged keys to configuration or logs. It serves the two products on 4344/4345. Never point this write test at an existing developer database or a hosted project. The setup uses the [documented local CLI](https://supabase.com/docs/reference/cli/supabase-start), immutable copies of each product migration chain and separate disposable config/project IDs/ports.

## Remaining publication prerequisite

Implementation and local acceptance have no remaining migration work. **Push/draft child PR publication is pending verified Vercel feature deployment suppression and Supabase Automatic branching suppression.** Repository `vercel.json` filters and successful GitHub preflight do not prove dashboard settings. Prior provider observations were insufficient to verify suppression; no settings were changed to bypass this prerequisite. Next action is read-only verification of linked provider settings, followed by fresh GitHub/stack reconciliation and publication of these preserved commits to the approved child target when safe. Full provider/hosted-database/production validation and CI on a published PR were not run and are not claimed passing.
