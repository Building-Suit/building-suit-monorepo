# Doctor M1 booking keyboard focus correction

Task: DOS-M1-018 follow-up after M1 integration. Branch: `codex/doctor-suit/keyboard-booking-focus`, based on stg `6a427e65d1c6952b1b6dfc36f664e9581e82bd78`. The accepted M1 source/receipt and immutable planning are preserved. PR366 remains an excluded, unapproved clinical review packet; this correction has no M2 dependency.

## Observed failure and cause

The integrated M1 tree passed its Doctor push checks, but the same-source [PR312 Doctor auth run](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/39022744223/job/117367640157) failed the AR/light/390px DOS-M1-018 journey: keyboard Enter did not open booking after selecting a date. 55 of 56 cases passed and the subsequent stress step skipped.

`canCreate` combined the current clinic's `canWrite`/`canReadPatients` capabilities with `!state.loading`. The shared page renders that action with `v-if="canCreate"`. A board read could therefore remove an already-focused button between Tab navigation and Enter. This is a product focus/activation race, independent of language-specific copy or layout. Board read progress does not change clinic capabilities.

The unchanged AR/light/390px journey passed ten local repetitions, showing the timing dependence. A new deterministic test then focused the booking action using Tab, triggered foreground revalidation, and held the actual synthetic board response. The baseline failed because the focused action no longer existed. The original DOS-M1-018 journey and its booking, keyboard, dirty/pending-state and tenant assertions remain unchanged.

## Bounded correction

Creation availability remains dependent on hydration and both current-board clinic capabilities. A non-mutating board read no longer changes that action's existence. Existing pending-write exclusion, context clearing, permission-denial handling, authorized patient/slot reads and server-side appointment commands remain in force. All templates/components remain in `packages/ui`; this change only corrects the app-owned capability projection.

Four EN/AR × 390/1280px light-mode browser regressions hold real fixture responses without fabricating permission results. They require focus to remain on the action, Enter to open booking while the read is held, the dialog to survive delivery, and Escape to close it and return focus. After release, they await the browser response's successful completion and the board date control returning after loading, then assert that booking remains visible. All traffic stays on synthetic loopback services; trace/screenshot artifacts remain disabled for auth fixtures.

## SQL fixture prerequisite

Fresh CI on the corrected keyboard source exposed an independent DOS-M1-015 fixture collision, reproduced in the local disposable PostgreSQL runner at 10:42 UTC. Between 10:00 and noon UTC, the UTC+14 and UTC-12 clinic dates differ by two days, placing clinic A2's 23:00 appointment inside the same doctor's 15-hour A1 population. Its 15:00 appointment lies seven hours before or seventeen hours after the start of that population, depending on the local-date relationship. Only this synthetic fixture time changes; the opposite-timezone, overdue-queue, authorization and pagination assertions and the product exclusion constraint remain unchanged.

## Verification

- Baseline: controlled AR/390 case fails at the focused-button assertion during the held read.
- Corrected source: all four controlled cases repeated four times pass (16 passes).
- Full auth: 60 passed (56 original plus 4 controlled cases); all 4 unchanged stress repeats and 54 public cases pass.
- SQL: 679 assertions and 39 transaction races pass after the fixture correction; all 1,440 UTC minute positions independently confirm that the corrected clinic populations do not overlap.
- Root units: 1,844 passed, 23 explicit infrastructure skips. Doctor build/lint/typecheck and strict 105-template/80-historical-migration boundaries pass.
- Release provenance and exact-head GitHub results are recorded in the focused PR. These results do not grant clinical approval, configure hosting or promote production.
