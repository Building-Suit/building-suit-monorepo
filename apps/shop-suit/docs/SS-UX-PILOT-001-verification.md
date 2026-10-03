# SS-UX-PILOT-001 — Barber pilot usability polish

## Repair completion — deterministic navigation readiness

Retained Playwright trace evidence showed that the failing branch-handoff test clicked the Appointments link successfully, then immediately matched the still-rendered dashboard `Location` selector before the destination page mounted. The dashboard selector changed while Appointments RPCs started afterward. There was no document request for `/appointments`; Nuxt client navigation was active. This was a test-readiness race, not a missing application hydration gate.

The repair now waits for the dashboard heading before beginning, and for both the `/appointments` URL and localized Appointments heading before selecting a branch. It also scopes overlay option selection to the open listbox. No sleeps, diagnostic hooks, or interaction-disable gates remain.

Full-suite verification exposed and repaired two additional deterministic failures in the existing pilot work:

- The receipt route was being rendered as a child of the sale-detail page even though that parent had no `<NuxtPage>`. Moving the sale-detail page to `sales/[id]/index.vue` makes detail and receipt sibling routes without changing their URLs.
- Synthetic-auth billing and platform-admin checks now use Nuxt client routing instead of full document navigation, which cannot retain the fixture's browser-only session. The receipt fixture now matches the complete receipt contract and waits for the enabled print action.

### Checks completed for this repair

| Command/check | Result |
| --- | --- |
| `pnpm exec playwright test tests/e2e/pilot-usability.spec.ts --grep "en, 360px, manager" --workers=1 --retries=0 --max-failures=1` (from `apps/shop-suit`) | **1 passed** (5.2s). |
| `pnpm exec playwright test tests/e2e/pilot-usability.spec.ts --grep "pilot branch handoff and reachable actions" --workers=1 --retries=0 --max-failures=1` (from `apps/shop-suit`) | **18 passed** (35.0s). |
| `pnpm exec playwright test tests/e2e/pilot-usability.spec.ts --workers=1 --retries=0 --max-failures=1` (from `apps/shop-suit`) | **26 passed** (58.3s). |
| `pnpm --filter @building-suit/shop-suit typecheck` | Passed; only expected missing local Supabase environment warnings were emitted. |
| `pnpm --filter @building-suit/shop-suit lint` | Passed. |
| `pnpm --filter @building-suit/shop-suit build` | Passed; only expected missing local Supabase environment warnings were emitted. |
| `pnpm check` | Passed: canonical design tokens, workspace boundaries, and 80 historical migrations. |
| `git diff --check` | Passed. |

No commit, push, PR action, control-plane retry/reverification, deployment, or provider mutation was performed.

## Earlier retry record — Playwright configuration discovery

The recorded browser failure was `Cannot navigate to invalid URL` at `page.goto('/auth/login')`: the control plane invoked Playwright from the Shop workspace without `-c`, so the pilot configuration was not loaded. Added `apps/shop-suit/playwright.config.ts` to reuse the existing pilot configuration and resolved its test/output directories relative to the shared configuration file, preserving both app-local and explicit-config invocation.

Focused repair checks: the recorded command with `--list` discovers all 26 tests. A temporary reporter asserted the resolved base URL, web-server command/CWD/URL, test directory and output directory; all passed. ESLint passed for the app-local entry point (the shared configuration was ignored as outside the app lint base). `git diff --check` passed. Preflight failed (255), leaving live GitHub/fetch state unverified. No browser suite or full verification was rerun; final verification remains with the control plane. Existing application changes were preserved.

The original implementation record follows; its check results describe that earlier execution.

## Original implementation record

Implementation is ready for independent review; browser/manual acceptance remains **unverified** because dependencies could not be installed in this environment. This is not pilot sign-off.

Workstream: `shop-suit`. Branch: `codex/shop-suit/ss-ux-pilot-001`. Starting HEAD: `a609f0e4c862b1196d014d85373a8aa741e4609a` (operating reports). The starting worktree was clean. No commits, pushes, merges, deployments, or hosted database operations were performed. Live upstream/PR state could not be verified.

## Changes and acceptance coverage

| Area | Implementation |
| --- | --- |
| First owner journey | An ordered, bilingual guide links business setup → two locations → team → service prices/durations/cleanup/assignments → working hours → trial/billing. Only the active location count is reported; visiting links does not falsely mark setup complete. Guide visibility follows owner/service-mode context. Initial shop creation now uses shared form pending/error/focus behavior and visible keyboard-operable trial radios. |
| Navigation | Daily work groups Calendar/Appointments, POS, Customers, Team, shifts and sales; stock workflows remain business-mode dependent; business management groups services, expenses, billing and settings. Reports are explicitly named. Platform administration retains its separate shell and trusted access check. Mobile shortcuts include Calendar, POS, Customers and Reports for barber businesses. |
| Branch/staff context | Calendar selection uses the existing global branch selector, including its cookie/cache refresh behavior, so appointment checkout reaches POS in the same branch. An unavailable branch does not silently fall back to another branch. Both pages keep branch/staff context visible with sticky actions. Context changes close calendar drafts. |
| Frequent actions | Calendar adds a one-click walk-in entry with current local time, walk-in identity, and today's view. POS exposes catalog/cart anchors and shift access, keeps catalog selection ahead of the long mobile payment form, emphasizes payment, and retains the existing receipt redirect/print flow. Reset asks before clearing an unsaved sale. |
| Feedback and keyboard | Appointment transitions use shared 44px controls and pending guards; break/time-off validation shows an inline error. POS locks editing during payment, prevents repeat F8 confirmation, and leaves typing/Enter in other fields and shared overlays alone. Report retry reloads permission access as well as report data. Empty/loading/denied copy gives next steps. |
| RTL and responsive | Logical spacing retained; previous/next icons follow direction; operational selection buttons expose pressed state. Narrow header selectors, stacked schedule hours, billing alias wrapping/table containment, and wrapping admin view buttons address narrow layouts. Admin view selection uses ordinary pressed buttons with native Tab/Enter behavior. |
| Foundation and scope | Existing PrimeVue/Tailwind/Building Suit controls retained. No new library, shared runtime contract, backend command, migration, or financial calculation changes. Database authorization remains authoritative. |

Requirements addressed in implementation: UX-01–05, UX-07–10. VAL-11 and the task's manual walkthrough criteria remain open until the checks below are actually run. Decisions: UI-D01 and UX-D02 from the task payload.

## Checks actually run

| Command/check | Result |
| --- | --- |
| `pnpm agent:preflight` | Failed (255); fetch/GitHub state unverified. Read-only local branch, HEAD, status and worktree inspection completed. `gh pr list` could not connect to `api.github.com`. |
| `pnpm install --offline --frozen-lockfile --store-dir /tmp/ss-ux-pilot-pnpm-store` | Blocked: required Manrope tarball absent from the offline store. |
| `pnpm install --frozen-lockfile --store-dir /tmp/ss-ux-pilot-pnpm-store --fetch-retries 0 --fetch-timeout 10000` | Blocked: `EAI_AGAIN registry.npmjs.org`. No manifest/lockfile change. |
| `node --test apps/shop-suit/tests/unit/*.test.mjs` | Returned success for 11 files. Because this sandbox's subprocess runner only reported file-level results, each file was also run directly with `node <file>`: **38 tests passed**, zero failures. These include source-contract checks; they do not prove browser behavior or database authorization. |
| `pnpm check` | Passed: canonical tokens match, workspace boundaries pass, 80 historical migrations unchanged. An initial false-positive boundary match on a dialog selector was resolved by using shared confirmation state. |
| `pnpm --filter @building-suit/shop-suit typecheck` | Could not start: `nuxt` unavailable. |
| `pnpm --filter @building-suit/shop-suit lint` | Could not start: `eslint` unavailable. |
| `pnpm exec playwright test -c packages/testing/playwright.shop-pilot.config.ts` | Could not start: the available global `playwright` reports `unknown command 'test'`; the workspace test runner is not installed. |
| TypeScript syntax check | 13 changed/new scripts passed Node `stripTypeScriptTypes` followed by JavaScript syntax checking. Direct `node --check` on TypeScript does not parse its types here; this fallback is **not** typechecking or Vue template compilation. |
| `git diff --check` | Passed. |

## Independent verification

The new `tests/e2e/pilot-usability.spec.ts` and `pilot-fixture.ts` cover the changed behaviors with synthetic API responses. The matrix includes English/Arabic, 360/768/1440px, owner/manager/barber presentation, both branches, walk-in pending/save/empty/error/denied states, keyboard/focus/touch targets, POS confirmation/receipt printing, billing/admin mobile layout, and report-access retry. These fixtures simulate capabilities; they are not authorization tests. No backend is required.

From this worktree after dependency/network access is available:

```sh
pnpm install --frozen-lockfile
pnpm --filter @building-suit/shop-suit prepare
pnpm --filter @building-suit/shop-suit typecheck
pnpm --filter @building-suit/shop-suit lint
APP_ENV=local NUXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:61321 NUXT_PUBLIC_SUPABASE_KEY=local-ui-test-key pnpm --filter @building-suit/shop-suit build
pnpm exec playwright test -c packages/testing/playwright.shop-pilot.config.ts
pnpm check
git diff --check
```

Manually verify in an authorized local/disposable setup with actual owner, manager, barber and platform-admin accounts. At 360px, tablet and desktop, in both languages and themes:

1. Create the business; follow all six setup links; configure two locations, staff assignments, service durations and each staff member's hours. Confirm links and permissions match actual capabilities.
2. Switch branches from both header and Calendar. Add/edit a walk-in/appointment; confirm changes appear without browser refresh. Follow appointment checkout and confirm the same branch, staff, service and customer in POS.
3. Search/scan, choose staff, review payment effects, cancel/confirm, print the receipt, and open/close a shift through the existing flow. Check real scanner and printer behavior separately; the browser fixture stubs print.
4. Review billing/trial and admin overview/billing/audit in RTL/LTR. Exercise empty, pending, denied and retry states. Check keyboard focus, dirty-close behavior, sticky action visibility, horizontal overflow and actual touch geometry.

No authenticated manual walkthrough, real browser run, Vue build, real-device scan/print, or database test was completed in this execution. Missing installable dependencies/network access are the verification blockers.
