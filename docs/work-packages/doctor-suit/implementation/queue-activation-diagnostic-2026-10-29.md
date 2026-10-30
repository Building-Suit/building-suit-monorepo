# Doctor queue activation diagnosis — 2026-10-29

Requested regression audit; no canonical task renumbering. Base: `7527791ccd8468945bfc383733015943790a1b95` (Shop #516 staging result). The Doctor consolidation is already integrated; this is a separate, local test-only follow-up. Publication and full CI remain queued behind the coordinator's current owner.

## Exact completed evidence

[Doctor run 40971515961, job 123789149158](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/40971515961/job/123789149158) failed the account-protocol phase: 86 passed, one failed. `DOS-M1-020-C01/C02 AR mobile light`, `dos-m1-020.auth.fixture.ts:46:432`, exceeded the unchanged 10-second locator action timeout waiting for the confirmation button in the “Start administrative visit” dialog. The preceding queue action click returned. No appointment transition RPC was recorded in the bounded secretary RPC diagnostic. The failure snapshot showed authenticated identity, ready context, secretary portal, queue grant, available board, canQueue true, canWrite false, no loading/refreshing/pending, and zero dialogs.

Public preview, all ten M3 cases and actual disposable Auth/Storage/Functions passed. Delegation stress, portable function and final asset stages were skipped after the account failure. SQL and shared-settings passed according to the coordinator's exact-run evidence. This is not the historical signup screenshot timeout. Artifact 12936135747 remains denied; no retry, alternate endpoint or artifact-content claim was made.

## Findings and limits

Root cause remains UNESTABLISHED. The shared queue template disables buttons during a same-scope board refresh, while the page controller retains the board and permitted actions. A refresh between input events is a plausible lost-activation path. A later context invalidation could also clear an opened dialog. The completed logs lack event-time evidence to distinguish these cases; a final ready snapshot cannot prove earlier state. No product correction or changed authorization rule is justified by this evidence alone.

The added observer records only fixed input event names, bounded counts, disabled/connected booleans and bounded dialog counts. It watches the existing target button and emits only through the failure handler. It retains at most 12 samples and caps counters at 100/dialog counts at 5. It reads no text, field values, identities, URLs, requests, storage, credentials or raw errors. Original assertions, activation click, confirmation, rethrow, case matrix and deadlines remain. Observation setup has its own unavailable fallback; it cannot turn a failed original action into success. Listeners/observers are disposed at teardown.

Instrumentation adds browser evaluation and DOM observation and may affect timing. It is not a demonstrated repair. Native/runtime acceptance remains UNRUN until an authorized owned GitHub runner executes it; no local service/browser is permitted or started.

An independent static fixture defect was corrected: the availability-dialog local was named `window`, shadowing the browser global in the serialized focus callback's TypeScript scope. Renaming it `availabilityDialog` fixes baseline TS2345 and does not change the intended browser callback or authorization.

## Local validation

- Fresh branch preflight: no errors; no active Doctor PR was present. Original root branch preflight correctly rejected retired #401; that branch and all original worktrees were preserved.
- Pure diagnostic unit: one passed, zero failed. Covers event distinction, capped collection, no content/value reads, snapshot isolation and disposal. This does not simulate or prove native browser activation.
- Isolated strict TypeScript: helper and complete M1-020 fixture pass using installed pinned dependencies. The unmodified baseline reported TS2345; the local dialog rename resolves it. No dependency installation or lockfile change.
- Static comparison: 72 assertion-related calls, two deadline/configuration calls and original rethrow preserved, allowing only the local dialog identifier rename.
- No push, PR, CI dispatch, hosted operation, merge or deployment.

Next: coordinate the validation slot, refresh staging and qualify the exact candidate before publication. Use the normal owned runner to establish event-time behavior, then repair only a demonstrated defect. Do not add blind retries or increase deadlines. All clinical/legal/privacy/security and production/catalog gates remain unchanged.

## Controlled owned-runner reproduction candidate

The two original EN/AR journeys remain unchanged in behavior. Two additional variants hold the actual synthetic board response between native pointer-down and pointer-up on the already permitted secretary queue action. They require the confirmation to open while the same-scope read is held, remain open after the response is applied, and complete the original exact single-transition/revocation assertions. Original deadlines and zero-retry runner configuration remain unchanged. Cleanup releases the held response and drains the page interceptor. This is an unexecuted hypothesis test until exact-head GitHub evidence is available; a controlled reproduction would not alone prove the historical intermittent cause.
