# LS-BROWSER-001 — current browser acceptance and discovered interface defects

2026-10-26. Parent PR #497 at `ee127c66685af69b053cd161d8b20aa79eb2acb7`; branch `codex/ledger-suit/current-browser-acceptance`. Locally verified under AS-E03 and LS-READY-001 orders 2/8.

Reconcile current shared sign-in and shell contracts with the remaining foundation/core finance scenarios, run the complete 17-file atomic matrix, and repair actual defects discovered by those checks. Preserve business-command assertions and distinguish synthetic API fixtures from real Auth/database acceptance. Do not convert an unrun or obsolete historical browser result into a current pass.

## Actual findings

- Older foundation/core tests fill password before the email-first sign-in reveals it. A shared test helper now performs both UI stages and waits for the transitioning submit control to become unique. Native/core tests use the same UI helper with actual providers.
- Administration columns render nested `row.values` through slots but omit their real field paths. Actual browser ascending sorting fails before the fix; binding both field/sortField to `values.<key>` restores mouse/keyboard ascending and descending behavior. The existing scoped page/pagination contract remains. The catalogue demonstrates nested display/search/sort paths.
- The mobile drawer calls focus after Vue's DOM update while CSS visibility is still hidden. Actual Chromium leaves focus on the opener and Escape does not reach the drawer. A fixed two-frame delay still failed; native browser focus instrumentation confirmed the control remained hidden at that point. The shared interaction now checks actual visibility on browser frames and cancels pending focus after close/disposal. Controls without layout boxes are skipped. The regression covers hidden-to-visible, close and disposal, and actual browser focus/Escape/return now pass.
- Foundation responses omit the current dashboard cash/series contracts and use obsolete transaction amount fields. The fixture now supplies current exact debit/credit, cash and series values. Other expected commands remain explicit.
- The glass sign-in width, dynamic sidebar ID, settings rail/chamber, dialog accessible names and canonical form fieldset supersede old DOM assumptions. Assertions now follow those actual contracts while retaining navigation, team, read-only matrix, dirty state and focus behavior.

## Native boundary

The guarded fixed project `ledger-browser-20261026` uses API/DB/UI ports 61021/61022/61030, the unchanged 107-migration chain and exact existing development seed. It has distinct private one-week signing credentials, local Mailpit and four preconfirmed synthetic seed identities. This is seeded password sign-in, not signup/email-confirmation evidence (the latter is independently covered by LS-BILL-NATIVE-001). Start/stop use ownership/workdir/port/version/byte guards, preserve Docker authentication/proxy settings, and contain no reset/deletion action. Database fixtures and all older financial volumes are retained.

The native core config requires the explicit owned-project opt-in and reads only its public anonymous key for the frontend. It runs the production build against actual Auth/PostgREST. One existing role-limit test deliberately intercepts that specific RPC error; it must remain labelled as a synthetic error path. Account creation and other un-intercepted requests are real local provider actions. No hosted customer/database or live Automation row is changed.

## Verification record

Final complete atomic results: **311/311 pass**, zero failures, retries disabled, 17 files in 24.6 minutes. Initial source checks exposed and corrected a catalogue creation-path type mismatch when demonstrating nested categories; an interrupted compilation is not counted as a passing build. The historical 305-case count is obsolete: the current atomic selection collects **311 cases in 17 files**. Full CI, hosted candidate/configuration, offsite operating backups and named accountant UAT remain independent release gates.

Verified checkpoint: 11/11 foundation browsers, 8/8 native core browsers, 130 Ledger units, all seven application typechecks and production builds, Ledger/scoped lint, workspace and release checks pass. The full 311-case matrix now passes with zero failures and retries disabled. Shared receipt visual tests remain a separately recorded system-browser limitation; thresholds/baselines are unchanged. [Dated evidence](../v2-acceptance/current-browser-verification-2026-10-26.json) and [runbook](../../current-browser-acceptance.md).

2026-10-28 release-scope correction, while this task PR remains open and unmerged: public navigation notes cover the five operational Suit consumers; Doctor carries the same controller support as private provenance only. The original fragment is absent from both protected trees, so this adjusts the still-unaccepted task on its own branch. No behavior, operational registration or public baseline changes.
