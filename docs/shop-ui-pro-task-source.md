# Shop Suit UI PRO — ordered Cloud execution

Latest owner direction supersedes the earlier single-PR/opt-in-only plan. This bundle is a handoff, not authorization to continue the full implementation in the preparation turn. Parent launches one bounded task per Codex turn, in order, with one draft PR per task, stacked on its open same-stack parent. At the end consolidate for one final review/validation. No extra AI workers; requested GPT-6.1 Sol LOW (Light), standard tier. Runtime model/tier selection must be set by the launching platform; this agent did not change it.

Use this saved CLOUD workspace, not Arch/n8n. Read root/scoped AGENTS and available .agents/skills. Fetch current stg before the first branch; default saved config may select main. Preserve unrelated/uncommitted work. User authorizes bounded implementation, pushing branches and draft PRs, but no merges, deployments, hosted migrations, secrets/provider changes or SAS recovery edits. Do not alter n8n records/gates/frozen plans or mark automation tasks complete.

The eight original pixel references and explicit adjustments override conflicting UI PRO requirements. Preserve Building Suit Navy #16293B, Gold #D89B42, neutral black/gray/white, official logos, AR/EN RTL/LTR/light/dark. Never copy reference brand names, palette or prices. All presentation atoms through complete page templates belong in packages/ui; reusable interaction controllers in packages/ux; Shop owns business/data/permissions/typed props/events. Shared atoms/components/templates may change where necessary for other consumers; preserve their functionality, branding and contracts. Do not undertake unrelated Ledger/Inventory product redesigns.

Work feature-sized tasks using existing dependencies/architecture. Run only essential change-local checks during each task; avoid full-suite repetition or CI polling on every commit. Final integration owns the consolidated checks. Status must distinguish implementation from verification: Not started, Working, PR opened, Blocked or Verified. Update STATUS.md after each bounded turn with branch/PR and evidence. PR opened is not Verified. Record actual failed/unrun checks. No separate pilot/gate/frozen-plan cycle.

Preparation results: all eight references materialized to consumer-local paths, readable bytes verified and visually inspected. Correction: saved clone fetched only main, leaving its origin/stg ref stale. Explicit refspec fetch verified current stg 630031447d11ed738bbfb9018283040d475425bb. All preparation edits remain untouched in /workspace/building-suit-monorepo on codex/shop-suit/ui-pro-preserved-edits. Task 01 was ported onto current strict complete-template architecture in /workspace/shop-ui-01 on codex/shop-suit/ui-pro-redesign. No later-task source files were copied into that worktree. First task uses this current branch; later task branches should start from its committed/published checkpoint and target its open PR branch.

Read STATUS.md, INDEX.md and tasks/01 first. Do not infer completion from scaffolds or pre-existing behavior.


---

# Shop UI progress checklist

| Task | Scope | Depends on | Implementation | Verification | Branch / PR |
|---|---|---|---|---|---|
| SHOP-UI-01 | shell-sidebar-profile | None | PR opened | Working — local checks passed; final acceptance pending | [Draft PR #250](https://github.com/Building-Suit/building-suit-monorepo/pull/250) · `codex/shop-suit/ui-pro-redesign` |
| SHOP-UI-02 | dashboard | 01 | PR opened | Working — local checks passed; final acceptance pending | [Draft PR #251](https://github.com/Building-Suit/building-suit-monorepo/pull/251) · `codex/shop-suit/ui-pro-dashboard` |
| SHOP-UI-03 | pos-media | 01 | Working | Unverified | Preserved partial edits on task 01 branch; no PR |
| SHOP-UI-04 | appointments-calendar | 01 | Not started | Not started | No branch/PR |
| SHOP-UI-05 | pricing-billing | 01 | Working | Unverified | Preserved partial edits on task 01 branch; no PR |
| SHOP-UI-06 | settings-notice | 01 | Not started | Not started | No branch/PR |
| SHOP-UI-07 | shop-consistency | 02–06 | Not started | Not started | No branch/PR |
| SHOP-UI-08 | final-integration | 01–07 | Not started | Not started | No branch/PR |

Task-01 change-local verification passes (see current receipt below); consolidated verification has not run. Calendar/Settings scaffolds are unwired and do not count as completed tasks. No hosted schema/provider/secret/n8n work occurred.

Tooling: use `COREPACK_HOME=/workspace/.cache/corepack corepack pnpm` for pinned pnpm 10.33.0. The initial old-checkout preflight failure was caused by unsupported gh --slurp; current stg already fixes it. Current task worktree preflight passes, and PR #250 stack policy passes. No approval rejection occurred.

Completed bounded implementation task: SHOP-UI-01 shell/sidebar/profile (PR opened; final verification pending). Task 01 is implemented and published as draft PR #250 in its isolated worktree. Parent launches task 02 separately after its published checkpoint. Later tasks stack in dependency order.

Preserved source files (exact current git status):
```
M apps/shop-suit/app/components/ShopPlanCards.vue
 M apps/shop-suit/app/layouts/default.vue
 M apps/shop-suit/app/pages/dashboard.vue
 M apps/shop-suit/app/pages/pos.vue
 M packages/ui/package.json
 M packages/ui/src/organisms/BsMarketingPricing.vue
 M packages/ui/src/organisms/BsSideMenu.vue
 M packages/ui/src/organisms/BsTopHeader.vue
 M packages/ui/src/templates/BsAppShell.vue
?? packages/ui/src/molecules/BsCatalogTile.vue
?? packages/ui/src/molecules/BsPlanSummary.vue
?? packages/ui/src/organisms/BsMetricChart.vue
?? packages/ui/src/templates/BsCalendarPage.vue
?? packages/ui/src/templates/BsPosWorkspace.vue
?? packages/ui/src/templates/BsSettingsPage.vue
?? packages/ux/src/composables/useCollapsibleNavigation.ts
```


---

# Reference/index mapping

All eight original PNG bytes are unchanged. Checksums are in reference-checksums.json. Pixels were inspected locally in exact attachment order.

| Order | Original file | Library ID | Purpose |
|---|---|---|---|
| 1 | image(20261012-171659).png | libfile_893b49bf4c888191b4cf1e8092c82e82 | Dashboard composition |
| 2 | image(20261012-171700).png | libfile_182859a091f88191b6210aa13f09c471 | Exact sandbox notice |
| 3 | image(20261012-171701).png | libfile_0735830e39f4819197929cd494fd7ee9 | POS grid/cart |
| 4 | image(20261012-171702).png | libfile_fb72d95115a48191ae6b29b15aa3a2e0 | Reserved appointments calendar |
| 5 | image(20261012-171703).png | libfile_84dd18ee2b5481919aa710f85d54e2a8 | Plan pricing |
| 6 | image(20261012-171704).png | libfile_a7707d940ac88191b0b31303c2fb5301 | Flat/collapsible shell |
| 7 | image(20261012-171705).png | libfile_6e4b39b2b5ec81918b40e86c8bbcb265 | Sidebar plan/profile |
| 8 | image(20261012-171706).png | libfile_ea10a2f796cc8191a5766ebd5883af69 | Sidebar/profile light/dark |

Image 2 displays sandbox/operator payment copy starting «بيئة الاختبار: الطلبات الاصطناعية لا تمثل أموالًا مستلمة», mentioning building-suit@instapay and warning attachments alone do not prove payment. On current stg, Billing no longer renders instructionsEn/instructionsAr; test apps/shop-suit/tests/e2e/plan-owner.spec.ts lines 281–306 asserts synthetic copy absent while continuing receipt upload. Retain the remaining payment instructions and business flow.

| Original UI PRO | Shop adaptation |
|---|---|
| 001 | Lean reference/evidence brief: this bundle; reuse existing repository evidence |
| 002 | SHOP-UI-01 shell/navigation |
| 003 | Existing complete shared templates across tasks 01–07; no new architecture |
| 004 | SHOP-UI-02/07 metrics and surfaces |
| 005 | SHOP-UI-03/06/07 tables, forms, density |
| 006 | SHOP-UI-02 dashboard |
| 007 | Ledger propagation OUT OF SCOPE; necessary shared ripple compatibility only |
| 008 | SHOP-UI-03–07 Shop workflows |
| 009 | Inventory propagation OUT OF SCOPE; necessary shared ripple compatibility only |
| 010 | SHOP-UI-08 final Shop acceptance and shared compatibility |


---

# SHOP-UI-01 — shell-sidebar-profile

Depends on: None
Implementation: PR opened (#250)
Verification: Working — local checks passed; consolidated acceptance pending
Original mapping: UI PRO 002/003

References 6–8. Refine the existing shared authenticated shell into flat sidebar/top-header structure with desktop collapse, accessible mobile navigation and comfortable full-viewport gutters. Add accurate current plan/trial/status/expiry sidebar card and profile actions from authorized existing data. Keep official logos, AR/EN RTL/LTR, light/dark, tenant/branch switching, sign-out, keyboard/focus. Existing partial edits are preserved; finish/review only this scope first.

One bounded turn; preserve other task edits; one stacked draft PR. Update status/PR/evidence on handoff. No merge or deploy.


---

# SHOP-UI-02 — dashboard

Depends on: 01
Implementation: PR opened (#251)
Verification: Working — local checks passed; consolidated acceptance pending
Original mapping: UI PRO 004/006

Reference 1 composition: clear actual metric hierarchy, chart panels and meaningful owner insights. Use existing sales/revenue/orders/customer/top-item/payment-mix/low-stock/appointments data only as available; keep clear date/period/branch filters and source drilldowns. No fabricated metrics/trends. Partial mix charts are preserved; complete dashboard presentation through shared page templates.

One bounded turn; preserve other task edits; one stacked draft PR. Update status/PR/evidence on handoff. No merge or deploy.


---

# SHOP-UI-03 — pos-media

Depends on: 01
Implementation: Working
Verification: Unverified
Original mapping: UI PRO 005/008

Reference 3: compact image product/service grid with touchscreen targets, efficient cart/order panel and neutral missing/broken-image placeholders for both item types. Preserve barcode/keyboard/accessibility, stock/pricing/tax/discount/payment/idempotency. Prefer existing image fields. Current search found no product/service image field; investigate authoritative contracts, and if essential prepare a new forward migration and typed adapters, never apply hosted DB. Partial tiles/workspace exist but image persistence is not implemented.

One bounded turn; preserve other task edits; one stacked draft PR. Update status/PR/evidence on handoff. No merge or deploy.


---

# SHOP-UI-04 — appointments-calendar

Depends on: 01
Implementation: Not started
Verification: Not started
Original mapping: UI PRO 003/008

Reference 4: actual navigable calendar with existing reserved appointments, appropriate day/week/month views, readable time/status/resource and existing create/edit flows. Preserve permissions/timezone/conflict/business rules, staff/location filters and history; no public self-booking. Unwired shared calendar scaffold exists; its presence is not implemented functionality.

One bounded turn; preserve other task edits; one stacked draft PR. Update status/PR/evidence on handoff. No merge or deploy.


---

# SHOP-UI-05 — pricing-billing

Depends on: 01
Implementation: Working
Verification: Unverified
Original mapping: UI PRO 003/008

Reference 5: polished shared plan cards, period selector and highlighted plan using existing actual catalogue/prices/currency/periods/entitlements/trial rules, including Solo 1/2 member options. No invented discounts or copied prices/palette/brands. Simplify Billing into coherent clear sections, preserving payment proof, private offers, manual InstaPay and permissions. Partial Shop pricing styling exists; Billing reorganization is not started.

One bounded turn; preserve other task edits; one stacked draft PR. Update status/PR/evidence on handoff. No merge or deploy.


---

# SHOP-UI-06 — settings-notice

Depends on: 01
Implementation: Not started
Verification: Not started
Original mapping: UI PRO 003/005/008

Simplify Settings into coherent sections with consistent shared templates while preserving all functions, permissions and payment policies. Image 2 exact removal target is the sandbox payment instructions notice beginning «بيئة الاختبار: الطلبات الاصطناعية لا تمثل أموالًا مستلمة». It is already absent on fetched stg, which has an E2E regression expecting synthetic instructions absent. Preserve this behavior and payment/proof/manual review; do not delete an unrelated business flow. Unwired shared settings scaffold exists; not completed.

One bounded turn; preserve other task edits; one stacked draft PR. Update status/PR/evidence on handoff. No merge or deploy.


---

# SHOP-UI-07 — shop-consistency

Depends on: 02–06
Implementation: Not started
Verification: Not started
Original mapping: UI PRO 003/004/005/008

Review remaining Shop workflow presentation for viewport use, gutters, density, tables/forms and responsive no-horizontal-overflow. Reuse/refine complete packages/ui templates and packages/ux controllers, leaving Shop business/data/permissions/typed props/events in Shop. Necessary shared component ripple changes are allowed; preserve other consumers’ functionality, branding and contracts. No unrelated Ledger/Inventory redesign.

One bounded turn; preserve other task edits; one stacked draft PR. Update status/PR/evidence on handoff. No merge or deploy.


---

# SHOP-UI-08 — final-integration

Depends on: 01–07
Implementation: Not started
Verification: Not started
Original mapping: UI PRO 010 adapted

Consolidate the dependent PR stack for one final review and relevant validation: build/types/lint/scoped tests/UI ownership boundary checks; targeted rendered Shop dashboard/POS/calendar/pricing/settings/sidebar across representative AR/EN, mobile/desktop, light/dark. Verify shared compatibility in other consumers. Verify exact final head CI once, fix real failures and rerun affected checks only. Never claim unrun PASS; do not disable CI/security. No merge/deploy/hosted migration/provider/secret/n8n changes.

One bounded turn; preserve other task edits; one stacked draft PR. Update status/PR/evidence on handoff. No merge or deploy.


# Current task-01 receipt

Implementation: PR opened — [draft PR #250](https://github.com/Building-Suit/building-suit-monorepo/pull/250). Implementation commit: `2ba4f79`; tracking status is updated in the following documentation commit. Verification: essential change-local checks passed; full acceptance remains unrun until task 08.

Worktree: `/workspace/shop-ui-01`; branch: `codex/shop-suit/ui-pro-redesign`; verified base: `630031447d11ed738bbfb9018283040d475425bb`. Original partial edits for later tasks are preserved in `/workspace/building-suit-monorepo`, branch `codex/shop-suit/ui-pro-preserved-edits`. Treat those old-base sketches as reference only; later tasks must implement current complete shared templates and must not restore obsolete app-local components/routes.

Changes: opt-in flat wide shell, desktop collapse with official mark, flat navigation, typed sidebar plan/profile configuration in complete BsWorkspaceShell, owner-authorized real billing status/expiry guarded against cross-shop/profile stale display, account/settings/billing actions and existing sign-out/language/theme controller. All UI is packages/ui and reusable controllers packages/ux. Other consumers keep their default shell geometry and existing contracts.

Checks passed: 10 modified/new Vue files parse, script compilation, template compilation and TypeScript syntax transpilation; new shared exports resolve; scoped ESLint for changed UI/UX, Shop layout and docs catalogue; 6 focused workspace-navigation/menu-share tests; git diff --check; current preflight (errors=[]). Nuxt preparation completed with expected missing local Supabase URL/key warnings; no secrets were copied. Installed dependencies reused with local workspace links. Full build/typecheck/browser tests and final-head CI are deliberately unrun for this bounded task.

Current preflight source on stg supports the installed gh without --slurp. No tooling or branch-policy change was needed. Fresh stg ref was fetched explicitly because saved remote refspec covers main only.

Next task: SHOP-UI-02 dashboard. Create codex/shop-suit/ui-pro-dashboard from task-01 published HEAD and target its open draft PR branch. Use a clean worktree. Preserve the earlier dirty preparation worktree; port useful changes selectively into current shared complete templates.

PR policy: `node tooling/git/check-pr.mjs 250` passed. Task 02 branch/base: create `codex/shop-suit/ui-pro-dashboard` from the final published HEAD of `codex/shop-suit/ui-pro-redesign`, targeting that branch (PR #250), in a clean worktree.


# Current task-02 receipt

Implementation: PR opened — [draft PR #251](https://github.com/Building-Suit/building-suit-monorepo/pull/251), stacked on PR #250. Implementation commit: `3c210ce`; final tracker update follows in a documentation commit. Verification: essential local checks passed; full browser/build/typecheck/final CI remains task 08.

Worktree `/workspace/shop-ui-02`; branch `codex/shop-suit/ui-pro-dashboard`; parent `f71d1293a8eeac345979bfc6c499ad51de3b5f6c` on PR #250 (`codex/shop-suit/ui-pro-redesign`). Current stg remains `630031447d11ed738bbfb9018283040d475425bb`.

Reference 1 composition implemented in existing complete BsDashboardPage, selected by a Shop variant. Four actual primary KPIs (sales, collections, sale count, outstanding customer count) lead the page; real sales/payment mixes have donut/bar charts; branch sales/collections have a wide comparison with an accessible data table. Existing appointments, cash, cost-permission-gated financial/stock highlights and drilldown tables remain. Plan/setup panels remain functional below the report. Chart colors use canonical Navy/Gold with readable theme variants. Zero/negative values retain written amounts and finite geometry; no invented percentages/trends/top-item data.

Dashboard links carry active branch and actual date bounds to the existing reports screen, which now initializes those controlled filters from validated query values. Existing server authorization, decimal amount formatting, timezone calculation, RPCs and financial calculations are unchanged. No new backend or schema work.

Checks passed: script/template/style compilation and TypeScript syntax transpilation for 5 changed/new Vue components; shared chart export resolution; scoped ESLint for UI/type/test files, Shop dashboard/reports adapters and docs catalogue; 9 tests (3 chart rendering cases and 6 existing report contract/source assertions, not hosted SQL execution); diff whitespace; preflight errors=[]. Nuxt preparation reused installed dependencies with current local workspace links, with expected absent local Supabase URL/key warnings. Full browser matrix, builds/types and CI verification remain deliberately unrun.

Next bounded task: SHOP-UI-03 POS/media. Create `codex/shop-suit/ui-pro-pos-media` from final published dashboard HEAD, targeting `codex/shop-suit/ui-pro-dashboard`. Use a clean worktree; preserve the old preparation worktree. Investigate image schema/contracts on current stg before porting old sketches; never restore obsolete app-local presentation.

Task-02 publication policy: `node tooling/git/check-pr.mjs 251` passed. No CI polling or merge occurred. Library tracking identity remains `libfile_1bef65e59b448191a8ff9d6bb6e6dd2e`.
