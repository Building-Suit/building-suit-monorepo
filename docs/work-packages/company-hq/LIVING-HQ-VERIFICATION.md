# Living HQ — local implementation and verification

Verified on 4 November 2026 in the selected cloud checkout. Branch: `codex/company-hq/living-office`. Implementation base: `93bbd840b28b577b758d3c5d10fbf785528a7748`, preserving the unpublished host-adapter/stream-cleanup work. The published runner remains at `0aa29288f037d234fc74f3d4f830e6d3a85c3161` in draft PR #529, stacked on the preserved office-design branch/PR #528. No push, PR creation/update, merge or deployment was performed for this implementation.

## Implemented behavior

- The shared page now renders original Three.js WebGL geometry, with orbit/zoom/reset/keyboard controls, cutaway rooms, furniture and four distinct employee characters. There is no static office image under the scene. Historical image artifacts remain preserved.
- Steve/AG-CEO-001 occupies Executive Office; Maya/AG-HR-001, Noah/AG-HR-002 and Iris/AG-HR-003 occupy HR & Agent Development. The verified names, roles and reporting chain remain stable. No extra team or Unassigned office is seeded. Founder-created departments persist through the authenticated server action and produce furnished empty rooms with a creation animation.
- Employee details are selectable from the scene and accessible directory. Narrow layouts show one selected overlay label to avoid collisions; the directory always preserves every name and role. Arabic/RTL, light/dark, keyboard navigation, reduced motion and WebGL-loss fallback are supported.
- Work motion follows recorded status/active lease state. Idle, queued and blocked records do not imply active inference. Camera and room-creation motion are explicitly illustrative. Brain pulses consume saved read evidence, retain the actual employee recipient, ignore unknown actors, suppress historical replay and clear traffic across session loss. No live Brain write is enabled or invented.
- Founder chat saves queued messages to Steve through existing authenticated contracts. A role-authorized externally supplied CEO reply can be displayed; there is no fake generated answer. The page explicitly identifies unavailable model authorization, verified $0 allowance, live Brain access and persistent hosting.
- Tasks support persisted proposed milestones. Founder approval freezes that scope; milestones remain planned without completion evidence. Existing approval, independent review, cancellation, historical ceo/hr ownership and zero-budget controls remain in force.
- Local SQLite invalidations use a founder-authenticated, same-origin, bounded SSE stream. Clients refetch the authorized projection, reconnect with limits, close while hidden/signed out/disposed, preserve failed drafts, and reuse uncertain command keys without duplicate writes.
- The additive `company_hq` SQL candidate is outside all automatic migration directories and denies application access. Both populated control-plane projects and their `./apps/super-admin-suit` GitHub wiring are preserved. Hosted Realtime and custom-schema adapter activation remain unimplemented prerequisites; see the hosting and isolated-schema review documents.

## Passed checks

| Check | Result | Evidence log |
| --- | --- | --- |
| `pnpm test` on final implementation | 2,849 tests: **2,826 passed, 23 skipped, 0 failed** | `hq-3d-root-tests-verified.log` |
| HQ unit suite | **76 passed, 0 failed**; also included in final root suite | `hq-3d-tests-final.log` |
| HQ production browser suite | **12 passed, 0 failed**, final build, Chromium 154 | `hq-3d-browser-verified.log` |
| HQ typecheck and app lint | Passed | `hq-3d-types-verified.log`, `hq-3d-lint-verified.log` |
| Changed shared UI lint | Passed | `hq-3d-ui-lint-verified.log` |
| HQ production build | Passed, Node server output | `hq-3d-build-verified.log` |
| Documentation consumer build/typecheck/scoped lint | Passed | `hq-3d-docs-build-verified.log`, `hq-3d-docs-types-verified.log`, `hq-3d-docs-lint-verified.log` |
| Workspace/token and strict atomic-template checks | Passed | `hq-3d-check-verified.log`, `hq-3d-strict-verified.log` |

HQ tests cover real disposable SQLite transactions, restart/replay and retained evidence, plus synthetic adapters. Three isolated-schema tests use disposable PGlite with 36 representative populated public tables, private/Auth fixtures, ACLs and publication metadata. They verify additive/idempotent behavior, denied application roles, stale CAS, byte limits, zero budgets and revocation. They are not a live Supabase inventory or hosted compatibility certification.

The browser suite exercises actual built WebGL geometry, four names/roles, selection, camera movement, DPR bounds, department creation and interrupted-response replay, milestone persistence/approval lock, failed chat drafts and authorized recorded replies, cross-page updates, reduced motion/RTL/mobile, context loss and SSE auth/origin/privacy. The Brain animation regression deliberately intercepts only the state projection with synthetic evidence: empty baseline, a fresh Noah read, unknown recipient and historical reload. It does not contact Drive or a model.

Initial browser execution had four fixture failures (required-label selectors and too many independent synthetic logins within the real rate limit); seven tests passed. Selectors and session reuse were corrected without weakening production guards. The next run passed 11/11. The final run above includes the additional Brain regression and mobile cleanup. Initial traces/logs and intermediate evidence are retained in the validation archive. Initial docs typecheck lacked generated documentation data; running the documented docs build generated it, and subsequent typechecks passed.

## Independent review

An independent source reviewer inspected domain/projections, composable state, CEO boundaries, SSE, scene state and SQL. Four draft/idempotency/input-limit findings were fixed, followed by two Brain-animation defects and mobile label collisions. Re-review found no remaining concrete blocker for the local implementation: actual recipient identity and first-ready-snapshot handling are correct, session loss clears traffic, the mobile directory remains accessible, and live execution is explicitly unavailable. Another independent review found no blocking defect in the disabled schema/local SSE scope. The final built-browser regression and root pixel inspection then verified the revised behavior. These reviews do not certify hosted identity or actual provider execution.

## Screenshots and reproducibility

The archive contains six actual browser screenshots, personally inspected by the implementation worker: `living-hq-desktop.png`, `living-hq-selected-iris.png`, `living-hq-desktop-selected.png`, `living-hq-created-office.png`, `living-hq-mobile-ar-reduced-motion.png` and `living-hq-accessible-fallback.png`. New departments and externally supplied work/chat records in screenshots are explicitly synthetic browser fixtures in a disposable local workspace. They do not change the real Brain organization.

Use Node 24 and the root pnpm 10.33.0 lockfile. Run the HQ build before `pnpm --filter @building-suit/company-hq test:e2e`; its test server owns a disposable SQLite database and synthetic authentication fixtures. It does not need live credentials. Default browser configuration uses `/usr/bin/chromium`; the existing `PLAYWRIGHT_USE_BUNDLED` option selects an installed Playwright browser. Local `127.0.0.1:4337` is an executor test address, not a founder-accessible deployment.

## Unrun, disabled and inherited limits

- No genuine model inference, live Drive/Brain read/write, scheduled hosted delivery, remote SQL, Supabase Realtime, live authentication setup, migration or deployment was attempted. No credential was created/configured and no new provider expense was incurred. The Responses executor and activation gates remain closed.
- Both requested Supabase refs are existing control-plane projects. Parent inventory is recorded separately; this worker did not retry denied project access. Fresh project-specific authority, preservation/restore proof, HQ-specific auth/grants/custom-schema adapter and proven zero-cost host/allowance remain prerequisites.
- Video playback/reference frames were unavailable. The scene is an original implementation using the verified organization and supplied transcript concepts, not a claimed pixel-perfect video reproduction. Instagram labels were not treated as installable verified packages. No Brain skill write was performed by this worker.
- Chromium desktop/mobile emulation and software WebGL were checked. Real mobile hardware, Safari/Firefox, network proxies, persistent public hosting and a sustained large-organization GPU load were not tested. Renderer limits (25 offices, 100 employees, capped DPR and on-demand/30fps animation) are bounds, not a hardware performance guarantee.
- The full monorepo unit suite passed; unrelated products' complete builds/browser suites and hosted CI on this unpublished head were not run. The inherited Doctor Android API 29 emulator-runner failure at run `41721252657` remains unrelated and unresolved here; parent-reported build/API 36 passed. PR #529's prior run `41735672142` passed review/branch-policy, with verify/publish-release skipped. Do not claim all repository CI passed.
- This is a tested local implementation and review artifact. The live website is not declared usable until authorized real infrastructure is verified.
