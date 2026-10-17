# Doctor M1 booking keyboard readiness

Task: DOS-M1-018 follow-up. Branch: `codex/doctor-suit/booking-readiness`, based on stg `72e621869737a10fdf320db9470ac792ec0a96d2` after reviewed PR367. M2 clinical-review PR366 remains excluded and unapproved. All nine authoritative plans remain unchanged.

## Observed failure and deterministic reproduction

The [postmerge PR312 Doctor auth job](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/39027003621/job/117379881464) passed 59 of 60 cases, including all four held-board focus regressions. Its EN/light/1280 DOS-M1-018 journey displayed the selected patient and 09:00 slot but the booking dialog remained visible after keyboard Enter on the intended Save action. The separate same-source push Doctor workflow passed.

The unchanged EN/light/1280 journey passed twelve local repetitions and four further repetitions with sixfold CPU throttling. This timing-dependent result did not establish a booking-command defect. Inspection of the installed Select implementation showed that selection publishes its model/label before deferred close callbacks restore focus. The old harness accepted the label as readiness and immediately began another Tab/Enter sequence.

A controlled local browser probe held the actual Select close callbacks with Playwright's clock after choosing 09:00. The selected label was visible while `aria-expanded` remained true. The old Tab helper reached an enabled, focused Save button; releasing the queued close returned focus to the slot control. Enter then reopened the picker and the unchanged dialog-hidden assertion failed, matching the CI symptom. Releasing the close and waiting for the collapsed picker and hidden listbox before tabbing to Save passed: the dialog closed and exactly one booking RPC was recorded. The historical job has no retained auth trace; this is a deterministic reproduction of the failure mechanism, rather than a recovered event trace from that job.

## Bounded harness correction

The DOS-M1-018 keyboard journey now waits for the clinic picker to collapse, and for patient/slot selection to publish the expected label, collapse, and finish hiding its listbox. Tab navigation also explicitly requires the next control to be enabled. Every existing visibility, keyboard, dirty/pending state, exact-one-booking, profile, tenant isolation and restricted-clinic assertion remains in place. It still uses real Tab and Enter; it does not force focus or substitute mouse clicks for the keyboard booking flow. No timeout is increased, no retry is added, and there are no fixed sleeps.

Four additional EN/1280 and AR/390 synthetic browser cases cover patient-first and offers-first delivery of actual held RPC responses. They verify disabled actions while prerequisites are missing, partial selected-label state before the real deferred close runs, completed picker closure before navigation, and a held save response with duplicate Enter/Escape exclusion. After successful response completion they require the dialog to close, one source card to appear, and exactly one appointment to exist for that patient/date.

Product orchestration, shared UI/templates, authorization, commands, SQL and provider configuration are unchanged. No hosted or home-network access is involved. The fixture retains loopback-only transport, synthetic data, and disabled auth traces/screenshots. Temporary diagnostic probes are archived outside the repository and excluded from the final suite.

## Verification

The focused controlled probe and all four readiness cases pass. The full local auth suite passes all 64 cases, including all eight original keyboard journeys and all four unchanged held-board focus regressions. Doctor lint/typecheck, strict 105-template/80-historical-migration boundaries and exact-base release provenance pass. Fresh exact-head GitHub checks, including the existing stress cases, are reported in the focused PR. Routine automated evidence does not grant clinical approval or authorize provider activation, deployment or a protected-branch merge; the parent coordinates any reviewed passing stg merge.
