# Disabled host adapter verification

Verified locally on 3 November 2026, on `codex/company-hq/ceo-hr-runner`, based on reviewed/published `0aa29288f037d234fc74f3d4f830e6d3a85c3161`. Node 24.19.0, pinned pnpm 10.33.0 and system Chromium 154.0.8037.57 were used. Node satisfies the package engine; the repository's preferred Node 26.8.1 was unavailable.

## Results

- `pnpm --filter @building-suit/company-hq test`: 60 passed, zero failed/skipped. Includes 14 new synthetic protocol/host tests and all 46 existing domain/runner tests. Repeated after the final citation-scope correction, including a test rejecting another role's profile as a source.
- `pnpm --filter @building-suit/company-hq typecheck` and `lint`: passed after final code changes.
- `pnpm --filter @building-suit/company-hq build`: passed after final code changes; Nitro node-server output generated. Node's built-in SQLite is retained as an external dependency.
- `pnpm test`: 2,833 tests, 2,810 passed, 23 skipped, zero failed. This broader run preceded the final narrow citation-scope correction; the complete HQ suite was rerun afterward.
- `pnpm check`: passed, including canonical tokens and workspace boundaries.
- `node tooling/checks/atomic-template-architecture.mjs --strict`: passed with zero violations.
- `pnpm --filter @building-suit/company-hq test:e2e`: five functional browser flows passed; the exact screenshot initially failed with four differing pixels. A single isolated recheck, `pnpm --filter @building-suit/company-hq exec playwright test --grep 'matches the founder-approved'`, passed with zero differences. Both logs and first-run failure artifacts are retained. No baseline, tolerance or visual code changed. These browser checks preceded the final server-only citation correction.
- `pnpm agent:preflight`: current observation at `2026-11-03T23:16:36.869Z`, no errors. Open draft #529 remains at `0aa29288`, targeting #528's unchanged branch at `e3345e503d178d067eb31d2f34d58cc3c75b6716`.
- `git diff --check`: passed. The post-commit release provenance check and exact commit/patch hashes are recorded in the delivered validation archive and handoff.

## Scope and remaining prerequisites

All model/Drive exchanges are synthetic injected transports. Real SQLite transactions, persistent files, restart/replay, body bounds, deadlines and cancellation were exercised. No genuine model execution, live Drive authorization, provider billing reconciliation, hosted delivery, schedule, email or external report was performed or verified. The production executor is unconditionally closed; the manual host bootstrap remains disabled. No credentials or paid fallback were introduced.

Activation requires a proven atomic no-charge allowance dispatcher, authorized dedicated model/Brain data scope, genuine provider reconciliation, an approved persistent zero-cost HQ host, explicit timezone confirmation and reviewed delivery behavior. A balance or operator boolean is insufficient. See `RUNNER-HOST-ADAPTERS.md` for protocol and operational limitations.

No Android tests, remote database tests, deployment checks or live-provider tests were run for this follow-up. The inherited parent Doctor Android API 29 emulator-runner failure in [run 41721252657](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/41721252657) remains separate and unresolved here. The parent reported #529's existing [run 41735672142](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/41735672142) passed review/branch-policy, with verify/publish-release skipped; that published-head result does not validate these unpublished changes.

Nothing in this follow-up was pushed, merged, deployed or enabled. Local artifact paths are executor-local; separate bounded source messages provide the review transfer when persistent uploads are unavailable.

## Response cleanup revision

Independent review of `20098479fb38a2a24c6a40a0d48df828d85c8260` found that a late transport response or redirect/URL rejection could bypass body cleanup. `protocolText` now owns cleanup immediately after transport resolves, before deadline and response checks. Its single cancellation path covers both an unread body and an acquired reader, runs at most once, never awaits cancellation and preserves the original failure if cleanup rejects or throws. A transport that returns after the caller has already timed out is still cleaned up when it returns.

Two new synthetic regression tests failed against the previous code, then passed after the correction. They cover deadline and parent cancellation before transport resolves, redirect and URL rejection, zero body pulls, one cancellation, one transport call and a cancellation promise that never settles. No response content is consumed and no retry is dispatched. Regression logs before and after the fix are retained.

Final revised-code validation on 3 November 2026 supersedes the earlier run counts above:

- Complete HQ suite: **62 passed**, zero failed/skipped.
- Complete repository suite, now against final code: **2,835 tests; 2,812 passed, 23 skipped, zero failed**.
- HQ lint, typecheck and production build: passed.
- Workspace/token check and strict atomic-template architecture: passed.
- Browser suite: five functional tests passed; exact screenshot initially failed with four differing pixels reported by Playwright. One isolated screenshot recheck passed exactly. Both logs and first-run failure artifacts are retained; no visual code, tolerance or baseline changed.
- Preflight at `2026-11-03T23:26:20.690Z`: no errors; remote draft #529 remains `0aa29288`, parent #528 remains `e3345e50`. Work stays on the same runner branch.
- Diff whitespace check passed. Post-commit release provenance result, exact revised commit and patch hashes are provided in the validation archive and handoff.

All transports remain synthetic. This revision adds no live access, credentials, provider reconciliation, runtime activation, publication, merge or deployment. The existing funding/auth/hosting/timezone prerequisites and inherited Android API 29 caveat remain unchanged.
