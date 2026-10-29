# Doctor consolidation interaction readiness — 2026-10-29

Task: `DOCTOR-CONSOLIDATION-20261029`, existing PR401. This repairs demonstrated shared interaction gaps identified while qualifying published source `20048af5dfe7692f47258ea4150fa3875c339346` against staging `81cdcc608519f538a2dec85c3d6d6c2bd4e4687d`. No staging merge or domain acceptance is inferred.

## Exact failed source

Workspace40915971025 passed review123596160650 and full verify123598136334, including the complete browser suite. Review passed2,648 tests total/2,625 passed/zero failures/23 skips. Doctor SQL123596160692, shared settings123596160082, Android40915970792 (build/API29/API36), website40915970983 and marketing40915970967 passed.

Doctor workflow40915971043 nevertheless failed browser job123596160649:85 account protocol cases passed and two AR-mobile cases failed. `dos-ae-002.auth.fixture.ts:45` could not find the patient picker's exact Arabic searchbox after clicking its combobox. `workspace-entry.auth.fixture.ts:84` could not find the workspace link after opening the landing mobile menu. The later independent actual M3 and Auth/Storage/Functions checks, including financial EN/AR cases, passed. Stress, portable-function and final brand checks were skipped after the earlier failure; they remain unrun for this source. The overall browser result remains failed, and20048af5 is not eligible for staging integration.

## Reproduced shared gaps and repair

The actual pinned PrimeVue4.5.5 Select handler returns immediately while `loading`, but the wrapper previously rendered the combobox with `aria-disabled="false"` and an enabled tab stop. Doctor opens the appointment editor before awaiting the initial patient lookup, exposing that mismatch. The new compiled-component regression reproduces the enabled loading control before the repair. `BsSelect` now declares loading/disabled props and consistently binds `disabled || loading` to the native or vendor select; existing explicit disabled constraints remain. This does not change lookup authorization, queries, response handling or choice values.

The landing mobile button was enabled in server-rendered HTML before its click handler existed. Its compiled-component regression likewise failed before repair. `BsLandingTopHeader` now keeps that button disabled until mounted. Existing menu state, route handling, copy, auth projection and product paths remain intact. These independently reproduced readiness defects match the failed interactions; the new source still requires actual owned-runner browser acceptance before claiming the reported journeys are repaired.

The two regressions failed before the changes with the specific enabled-state assertions, then passed. The full focused UI/UX suite passes52 tests and scoped shared/Doctor lint passes. The existing exact accessibility assertions, test deadlines, retry counts and route/authorization checks are retained. In the owned protocol cases, an initial synthetic patient lookup is held and released to verify disabled-to-enabled behavior without replacing its response. The landing case holds static script transport until the new document's disabled menu is observed, then releases it and exercises the original workspace continuation. No arbitrary sleep or longer timeout is added. Credential traces/screenshots remain disabled.

All visual and readiness changes remain in shared UI; app code continues to own business/session/tenant orchestration. Local checks are component/static verification only. Doctor application runtime execution remains restricted to the GitHub-owned disposable runner. No user computer, local connected environment, home network, VPN or tunnel is used.

## Qualification and recovery

Full root tests pass:2,650 total,2,627 passed,zero failures and23 existing skips. Workspace boundaries and full lint pass. Affected typechecks/builds and committed-source release validation are being completed before one coherent publication. Fresh exact-head Doctor and full workspace CI must pass before the parent-coordinated staging slot is used. The previous passing workspace run does not certify this changed UI source. Existing recovery archive and privacy backup tag remain intact; all earlier failed/cancelled receipts keep their original source binding.

No clinical/legal/privacy/guardian/provider/commercial/release gate, catalog baseline, hosted connection or denied-read restriction is changed. No PR approval review, main promotion, manual deployment, hosted migration or real clinical/money action is performed.
