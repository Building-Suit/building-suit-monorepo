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
| SHOP-UI-03 | pos-media | 01 | PR opened | Blocked — DB version/application/test; local checks pass | [Draft PR #252](https://github.com/Building-Suit/building-suit-monorepo/pull/252) · `codex/shop-suit/ui-pro-pos-media` |
| SHOP-UI-04 | appointments-calendar | 01 | PR opened | Working — local checks passed; final acceptance pending | [Draft PR #253](https://github.com/Building-Suit/building-suit-monorepo/pull/253) · `codex/shop-suit/ui-pro-appointments` |
| SHOP-UI-05 | pricing-billing | 01 | PR opened | Working — local checks passed; final acceptance pending | [Draft PR #255](https://github.com/Building-Suit/building-suit-monorepo/pull/255) · `codex/shop-suit/ui-pro-pricing-billing` |
| SHOP-UI-06 | settings-notice | 01 | PR opened | Working — local checks passed; final acceptance pending | [Draft PR #256](https://github.com/Building-Suit/building-suit-monorepo/pull/256) · `codex/shop-suit/ui-pro-settings` |
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

Image 2 displays sandbox/operator payment copy starting «بيئة الاختبار: الطلبات الاصطناعية لا تمثل أموالًا مستلمة», mentioning building-suit@instapay and warning attachments alone do not prove payment. The early preparation observation was from the stale staging ref. Current shared Billing can render operator instructions; task 05 now filters only this exact legacy sandbox paragraph and its existing English equivalent. The plan-owner.spec.ts regression still expects synthetic copy absent while retaining receipt upload. Retain the remaining payment instructions and business flow.

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
Implementation: PR opened (#252)
Verification: Blocked — DB application/test; local checks pass; final acceptance pending
Original mapping: UI PRO 005/008

Reference 3: compact image product/service grid with touchscreen targets, efficient cart/order panel and neutral missing/broken-image placeholders for both item types. Preserve barcode/keyboard/accessibility, stock/pricing/tax/discount/payment/idempotency. Prefer existing image fields. Current search found no product/service image field; investigate authoritative contracts, and if essential prepare a new forward migration and typed adapters, never apply hosted DB. Partial tiles/workspace exist but image persistence is not implemented.

One bounded turn; preserve other task edits; one stacked draft PR. Update status/PR/evidence on handoff. No merge or deploy.


---

# SHOP-UI-04 — appointments-calendar

Depends on: 01
Implementation: PR opened (#253)
Verification: Working — local checks passed; consolidated acceptance pending
Original mapping: UI PRO 003/008

Reference 4: actual navigable calendar with existing reserved appointments, appropriate day/week/month views, readable time/status/resource and existing create/edit flows. Preserve permissions/timezone/conflict/business rules, staff/location filters and history; no public self-booking. Unwired shared calendar scaffold exists; its presence is not implemented functionality.

One bounded turn; preserve other task edits; one stacked draft PR. Update status/PR/evidence on handoff. No merge or deploy.


---

# SHOP-UI-05 — pricing-billing

Depends on: 01
Implementation: PR opened (#255)
Verification: Working — local checks passed; consolidated acceptance pending
Original mapping: UI PRO 003/008

Reference 5: polished shared plan cards, period selector and highlighted plan using existing actual catalogue/prices/currency/periods/entitlements/trial rules, including Solo 1/2 member options. No invented discounts or copied prices/palette/brands. Simplify Billing into coherent clear sections, preserving payment proof, private offers, manual InstaPay and permissions. Partial Shop pricing styling exists; Billing reorganization is not started.

One bounded turn; preserve other task edits; one stacked draft PR. Update status/PR/evidence on handoff. No merge or deploy.


---

# SHOP-UI-06 — settings-notice

Depends on: 01
Implementation: PR opened (#256)
Verification: Working — local checks passed; consolidated acceptance pending
Original mapping: UI PRO 003/005/008

Simplify Settings into coherent sections with consistent shared templates while preserving all functions, permissions and payment policies. Image 2 exact removal target is the sandbox payment instructions notice beginning «بيئة الاختبار: الطلبات الاصطناعية لا تمثل أموالًا مستلمة». Task 05 now filters this exact paragraph in the current shared-template adapter, which retains the E2E regression expecting synthetic instructions absent. Preserve this behavior and payment/proof/manual review; do not delete an unrelated business flow. Unwired shared settings scaffold exists; not completed.

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


# Current task-03 receipt

Implementation: PR opened — [draft PR #252](https://github.com/Building-Suit/building-suit-monorepo/pull/252), stacked on PR #251. Implementation commit `0758697`; tracker update follows in a documentation commit. Verification: task-local checks pass; database execution blocked and full acceptance remains task 08.

Worktree `/workspace/shop-ui-03`; branch `codex/shop-suit/ui-pro-pos-media`; parent `cf137b2c9c9467962372cac5a3e3190a5e7979d7` on PR #251. Parent review branch is `codex/shop-suit/ui-pro-dashboard`.

Reference 3 implemented inside the existing complete BsPointOfSalePage: compact responsive product/service image tiles with one neutral missing/broken-image fallback, large semantic button targets, wider catalog and sticky scrollable desktop order panel. Existing barcode/search/keyboard, customer/staff/appointment selection, quantity, payment and confirmation controls are retained. All financial, stock, tax/discount, draft/payment/idempotency logic is unchanged. Existing complete BsCataloguePage has optional HTTPS image URL editing/preview/removal for both product and service editors; reusable image state lives in packages/ux. Other consumers retain default presentation.

Schema implications: `docs/shop-optional-catalog-media.sql` is a reviewable forward SQL draft, NOT an applied or CLI-versioned migration. It adds nullable `public.products.image_url` and `public.services.image_url`, HTTPS/2000-character constraints and one new typed `public.shop_catalog_media` RPC delegating to an authenticated private helper. Reads enrich only existing authorized/paginated rows. Saves delegate existing authorized category/product/service commands and update the URL in that same transaction. Existing signatures, RLS, financial writes and historical migration files remain intact. No Storage buckets, policies, provider config, credentials, hosted application or uploads were added. Owner-supplied image URLs are rendered with no-referrer; placeholders are local icons.

Old-schema safety: absent media RPC errors fall back to legacy catalog reads and media-free saves. Image controls remain disabled with a clear unavailable state until the new read contract advertises support. Image additions or removals are refused rather than silently lost if that API disappears. Permission/network/validation failures never trigger downgrade retries. Actual media persistence becomes available only after migration versioning, review, database tests and separately authorized application.

Blocker: installed pinned Supabase CLI fails with `EROFS: read-only file system, mkdir '/home/agent/.supabase'` even for migration help/new; narrow additional filesystem permission did not resolve the read-only mount. The Supabase skill explicitly requires “always create it with supabase migration new <name> first” (source `skill://plugin_asdk_app_69d3e5ee6a708191baa733f7b8931995/supabase/SKILL.md`), so no timestamp filename was fabricated. Docker is accessible but has no running containers/cached images, and psql is absent; local database tests/type regeneration were not run. No automatic approval rejection occurred. Continue independent task work; do not use hosted DB as a substitute.

Checks passed: 8 changed/new Vue files parse and compile scripts/templates/styles with TypeScript syntax transpilation; both new shared exports resolve; scoped shared UI/UX and Shop/docs lint; 12 focused tests for media fallback and validation, unsafe/broken image recovery, unchanged barcode/cart decimal behavior and shortcut/focus ownership; diff whitespace; current preflight errors=[]. Tests do NOT prove database persistence. Nuxt preparation completed with expected missing local Supabase URL/key warnings. Builds/types/rendered matrix and exact final-head CI remain task 08. Cloud executor is healthy.

Next task: SHOP-UI-04 appointments/calendar. Create `codex/shop-suit/ui-pro-appointments` from this task's final published HEAD, targeting `codex/shop-suit/ui-pro-pos-media`, in a clean worktree. Keep the media SQL/application blocker visible in final integration; do not let it block independent calendar presentation.

Task-03 publication policy: `node tooling/git/check-pr.mjs 252` passed. No CI polling or merge occurred. Library task source retains the same identity; SQL remains a reviewable unversioned draft until the CLI path is usable.


# Current task-04 receipt

Implementation: PR opened — [draft PR #253](https://github.com/Building-Suit/building-suit-monorepo/pull/253), stacked on PR #252. Implementation commit `6915409`; tracker update follows in a documentation commit. Verification: task-local checks passed; full rendered/build/typecheck/final CI remains task 08.

Worktree `/workspace/shop-ui-04`; branch `codex/shop-suit/ui-pro-appointments`; parent `ba1d883f74649befcfcf117395bc134196560f9d` on PR #252 (`codex/shop-suit/ui-pro-pos-media`). Current stg observed `630031447d11ed738bbfb9018283040d475425bb`; the parent may advance stg during independent Super Admin consolidation. Do not retarget or merge that work into this bounded Shop task. Final integration must refresh/reconcile the staging base once appropriate.

Reference 4: existing complete BsAppointmentsPage now has a shared reserved-appointment calendar, day/week/month controls, manual date picker, previous/next/today navigation, clear period/timezone, today/outside-month markers, compact status/time/customer/service/staff events, and mobile month agenda. Existing location/staff filters and create/edit/transition/queue/history/sale/schedule flows remain. Month action/history controls use accessible disclosure to preserve readable event cards. Generic date-navigation state belongs to packages/ux; Shop supplies typed business data/commands.

Backend policy is unchanged: appointment_calendar retains its <=8-day read limit. Month windows use 4–6 concurrent bounded week requests, merge only authorized returned records and deduplicate appointments/hours/blocks. A denied/failed chunk fails the whole calendar; no partial-success metrics are shown. Overnight reservations appear on each day they overlap, excluding the day after an exact midnight end. Existing browser-local input/timezone behavior and Cairo scheduling commands remain unchanged, with displayed local timezone explicitly labeled. No public booking, new domain policy, schema or hosted change.

Checks: four Vue script/template/style compilations and TypeScript syntax transpilation; calendar export resolution; scoped shared UI/UX and Shop/docs lint; 8 focused navigation/calendar/service-contract tests including leap days, month-end navigation, bounded requests/deduplication, denial and overnight/midnight boundaries (no hosted SQL execution); whitespace; preflight errors=[]. Nuxt preparation succeeded with missing local Supabase URL/key warnings. Full browser/theme/RTL matrix, builds/types and final CI remain unrun until task 08.

Carry-forward prerequisite: task-03 image persistence is NOT complete. Its SQL is still an unversioned/unapplied draft due the CLI read-only config issue; actual migration/database/media round-trip verification remains outstanding. Resolve supported writable CLI config at task 08 if possible without hosted application.

Next task: SHOP-UI-05 pricing/billing. Create `codex/shop-suit/ui-pro-pricing-billing` from task-04 final published HEAD, targeting `codex/shop-suit/ui-pro-appointments`, in a clean worktree. Keep earlier preserved sketches untouched; use current complete shared templates and actual commercial catalog.

Task-04 publication policy: `node tooling/git/check-pr.mjs 253` passed. No CI polling, merge, deployment or staging reconciliation performed.


# Current task-05 receipt

Implementation: PR opened — [draft PR #255](https://github.com/Building-Suit/building-suit-monorepo/pull/255), stacked on PR #253. Implementation commit `bd2c0de`; tracker update follows in a documentation commit. Verification: focused local checks passed; final build/types/rendered acceptance and CI remain task 08.

Worktree `/workspace/shop-ui-05`; branch `codex/shop-suit/ui-pro-pricing-billing`; parent `17d7c0059926325b9a9fcce340a9762f5ed78435` on PR #253. The observed stg ref is still `630031447d11ed738bbfb9018283040d475425bb`; independent Super Admin consolidation is not incorporated or retargeted here.

Reference 5: existing shared pricing atoms/organisms and complete landing/billing templates now accept Shop appearance. Flat plan cards, Navy/Gold emphasized selected/current card (center fallback makes no recommendation/popularity claim), clearer prices/actions/feature lists and compact period/member controls. Existing actual catalog/prices/currency/terms, annual-discount calculations, trial rules, Solo 1/2 and Multi variants, entitlements and blockers are unchanged. No invented commercial data. Default consumers preserve original action ordering and presentation; no app-local pricing Vue was introduced.

Billing has anchored current-plan, usage, plan-options, payment/proof and history sections. Existing selected/private-offer quote, redemption, manual InstaPay instructions, notice confirmation, receipt upload/review/status/history, permission/readonly states and dialogs remain. Private-offer entry is available in a native accessible disclosure rather than occupying the main comparison/payment reading path. Payment status/instructions/notice/proof are grouped responsively. No business command, API, financial rule, schema or provider change.

Image 2 correction: current strict shared Billing can render dynamic operator text; earlier absent-copy observation came from the stale ref. The new Shop helper suppresses only the paragraph beginning «بيئة الاختبار: الطلبات الاصطناعية لا تمثل أموالًا مستلمة» and its existing English fixture equivalent, «Synthetic submissions do not represent received funds». Normal operator paragraphs, recipient/link/QR, manual review explanation and proof flows remain. Dedicated tests verify exact suppression and preservation of ordinary instructions. Task 06 should confirm this remains absent, not delete payment policy/business flow.

Checks: 9 changed Vue script/template/style syntax compilations (8 with TS syntax transpilation, plus docs catalogue); scoped UI/type/test, Shop adapters and docs lint; 19 focused pricing/card/notice/billing/plan/private-offer tests; whitespace; preflight errors=[]. Reused pinned installed compiler link was added only to ignored local dependencies to repair an incomplete test setup; no dependency/lockfile change. Nuxt preparation succeeded with missing local backend config warnings. No hosted SQL, full browser matrix/build/typecheck or CI polling.

Carry forward: task-03 image persistence remains incomplete until versioned migration/database/media round-trip verification; its SQL is still an unapplied draft. Task 08 should resolve supported writable CLI config if possible without hosted application.

Next task: SHOP-UI-06 settings/notice. Create `codex/shop-suit/ui-pro-settings` from task-05 final published HEAD, targeting `codex/shop-suit/ui-pro-pricing-billing`, in a clean worktree. Preserve all actual settings functions and the narrow image-2 removal now implemented.

Task-05 publication policy: `node tooling/git/check-pr.mjs 255` passed. No CI polling, merge, deployment, hosted application or staging reconciliation performed.


# Current task-06 receipt

Implementation: PR opened — [draft PR #256](https://github.com/Building-Suit/building-suit-monorepo/pull/256), stacked on PR #255. Implementation commit `e33978f`; tracker update follows in a documentation commit. Verification: task-local checks passed; consolidated acceptance remains task 08.

Worktree `/workspace/shop-ui-06`; branch `codex/shop-suit/ui-pro-settings`; parent `25dabcfa990d3d8ef81c269e69e1673e5c5f8efd` on PR #255. Observed stg remains `630031447d11ed738bbfb9018283040d475425bb`; parallel Super Admin consolidation is not incorporated/retargeted here.

Settings uses its existing complete shared BsBusinessSettingsPage with clear section anchors, canonical page header, paired profile/business-mode summaries, full-width location table and paired receipt/cashier policy sections. The opening actions now read Edit/Change while dialog submits retain Save labels and all original pending/dirty/disabled/error semantics. No form fields, permission notices, quota guards, archive/restore actions, receipt snapshots or cashier policy rules were removed. Only localized action labels were added to the Shop adapter; business RPCs and validation are unchanged.

The exported shared BsSectionNavigation molecule serves both Settings and Shop Billing, keeping keyboard/focus, touch targets, wrapping and theme styling consistent. Billing only replaces task-05's equivalent navigation markup; payment instructions, proof/manual review and the exact sandbox-paragraph filter are unchanged. No redundant notice-removal implementation. Docs examples have valid section anchors.

Checks: five Vue script/template/style compilations with TypeScript syntax transpilation; new molecule export resolution; scoped shared/Shop/docs lint; 13 focused profile/location/receipt contract/snapshot and inherited exact-notice tests; whitespace; preflight errors=[]. These are local contract/source/render-snapshot checks, not hosted SQL/browser verification. Nuxt preparation succeeded with expected absent local backend config warnings. Full build/typecheck/browser matrix/final CI remains task 08; no CI polling.

No new schema/provider/secret/Storage/hosted changes. Task-03 image persistence prerequisite remains incomplete: unversioned/unapplied SQL draft and missing real database/media round-trip verification. Task 08 should resolve supported writable CLI config if possible without hosted application.

Next: SHOP-UI-07 remaining Shop consistency. Create `codex/shop-suit/ui-pro-consistency` from task-06 final published HEAD, targeting `codex/shop-suit/ui-pro-settings`, in a clean worktree. Stay within remaining Shop presentation consistency and necessary shared compatibility.

Task-06 publication policy: `node tooling/git/check-pr.mjs 256` passed. No CI polling, merge, deployment, hosted application or staging reconciliation performed.
