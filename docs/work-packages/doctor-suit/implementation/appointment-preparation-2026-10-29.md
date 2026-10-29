# Appointment preparation readiness — 2026-10-29

Task: `DOCTOR-CONSOLIDATION-20261029`, PR401, following published2d3b79d3dd5be1cf870c52a7ba806ab0f7fe2551 against staging81cdcc608519f538a2dec85c3d6d6c2bd4e4687d.

Doctor40926961286/browser123634920575 failed exactly one of87 account protocols: DOS-M1-014-C01/C02/C04 EN desktop, `dos-m1-014.auth.fixture.ts:36:331`. The patient-picker click completed but the exact `Search · Administrative patient` searchbox did not appear. The other86 account cases passed. All10 M3 tasks, including the prior reception failure, passed; reception's historical timeout therefore remains unproven rather than a claimed product repair. SQL/shared settings and actual disposable Auth/Storage/Functions passed. Stress, portable-function and final asset checks were skipped. Workspace40926960649 passed full validation; Android/website/marketing passed. The Doctor workflow remains failed and2d3b79d3 is not merged.

## Demonstrated orchestration gap

The appointment page opens the editor before awaiting the consultation-type catalogue; only afterward does it start patient and slot requests. During that initial await, the patient and offers loading flags were false, exposing interactive controls before preparation began. The shared select loading repair cannot cover a loading flag that has not yet been set.

A regression executes the actual compiled page composable with deferred synthetic repository calls. Before repair it fails with `patientLoading=false` while the editor is open and neither patient nor slot request has started. Preparation now begins before opening the editor and stays visible through the catalogue and initial patient/slot reads. Submission remains disabled during preparation. This read state remains cancellable and does not pretend to be a submitted write.

A preparation generation and captured scope prevent an older catalogue read from starting lookups after cancellation, reopening or context invalidation. A stale completion cannot release a newer editor's loading state. Tests cover the initial gap, cancellation/reopening and context invalidation. Product orchestration stays in Doctor; the existing shared UI receives semantic loading/disabled props. No appointment command, tenancy, patient authority, clinical rule or shared UI markup changes.

The owned DOS-M1-014 case now holds only the existing synthetic consultation RPC transport, verifies the picker is disabled, releases the real response, and retains its original exact search, choice, duplicate-submit, lifecycle and cross-clinic history assertions. No synthetic response is fabricated, deadline extended, retry added or assertion removed. Actual owned browser acceptance is required again on the published repair; local regression results alone do not qualify staging.

All previous receipts retain their exact source bindings. Recovery archive, privacy checkpoint and all49 original Doctor heads remain preserved. No hosted operation, denied read, real clinical/money action, PR approval review or main/production action is performed.

Local qualification:21 focused appointment/composable controls pass, including the reproduced failing-before preparation case; root2,654 total/2,631 passed/zero failed/23 skipped. App-scoped changed-file lint, workspace boundaries, Doctor typecheck and Doctor static build pass. These are local engineering results, distinct from the required fresh owned browser acceptance.

An additional scoped typecheck of the changed browser case found four pre-existing possibly-undefined subscription references in its synthetic WebSocket helper. The helper now explicitly fails if its expected subscription does not exist, preserving the prior failure behavior with a fixed safe diagnostic. No subscriber or message is fabricated and no assertion is bypassed.
