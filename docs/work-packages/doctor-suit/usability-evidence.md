# DOS-M1-018 — cross-journey usability verification

Parent: PR362 `3da424cd` (exact full SHA recorded at publication). The isolated usability worktree fast-forwarded the published audit catalogue follow-up without touching its uncommitted task tests. Planning is preserved. This task adds focused verification and evidence; no runtime permission, provider, data model or offline-write policy changes.

## Working journeys

Eight browser cases cover the full **English/Arabic × light/dark × 390/1280px** matrix. They use the existing synthetic protocol fixture, approved patient administrative fields, current scope selectors and the canonical shared forms. All eight pass.

Each case tabs to and activates the patient editor with Enter, enters a dirty draft, opens the Escape discard prompt, verifies initial Cancel focus, retains the draft on Cancel, explicitly discards with keyboard confirmation, and verifies focus returns to the opener. A new editor starts empty. All named controls are found through their semantic roles and labels.

The patient command deliberately commits in the controlled server and then loses its reply. The editor remains open with the honest uncertain-outcome message and retained values. An unchanged retry uses the same accepted intent; its reply is held while repeated Enter and Escape are attempted. Submission remains disabled, the pending editor cannot dismiss, and exactly one patient exists when confirmation arrives. A second navigation search finds the record within authoritative pagination; it is not assumed to occupy the first page.

Keyboard navigation opens the actual administrative profile, then selects the patient and an offered working-hours slot in the appointment editor. One appointment is persisted for the same patient. Explicit synthetic/no-external-message/no-clinical-approval notices remain. Each case then signs out and signs in as the secretary: A1 permits booking, A2 is read-only, and B1 shows its independent practice without A's new record. This verifies the view and action boundaries in every matrix combination; SQL authorization and actual provider evidence remain separate.

Reduced-motion emulation is enabled throughout the matrix. A focused follow-up additionally asserts the computed dialog animation/transition duration is at most one millisecond; it does not merely echo the emulated preference. Both locale public cases test keyboard entry and protected-page admission with reduced motion and an absent provider. No offline clinical writes are promised or implemented.

## Evidence and limits

- **Three cross-layer unit scenarios pass**: shared record-action + product controller preserve dirty state after an uncertain save and confirm one identical retry; repeated pending actions execute one command; account loss resets both generations before a late completion can close or refill a new form.
- **Eight complete matrix journeys pass**, including both roles and both sizes/themes/locales. The computed-style follow-up also passes on the mobile English journey, proving the actual dialog honors reduced motion. Public reduced-motion admission cases are in the final public suite.
- Root regression: **1,816 pass / 23 optional infrastructure skips**. All seven app typechecks pass, with six unchanged consumer caches restored by the verified task graph. Strict boundaries: **104 complete canonical templates, zero local components, 80 historical migrations unchanged**. Root lint passes with existing warnings.
- The runtime/UI tree is unchanged from PR362. Its passing local 48 shared auth/access/signup/public adapter and 12 settings-focus cases cover the same shared template bytes. The task's exact-head CI still runs those checks; inherited receipts do not substitute for a changed source tree.
- The previous audit task closed the observed search submission, narrow layout, scope-denial and independent foreground-refresh gaps. This task verifies their wider journey context and the existing dirty/pending controllers. Initial test failures caused by pagination, an omitted document-profile fixture and a presumed automatic filter focus were corrected to exercise the real workflow; no product assertions or authorization were relaxed.

This is automated keyboard and semantic-label evidence. A human screen-reader or accessibility certification review has **not** been performed or claimed. Browser protocol tests are controlled transports, not actual provider acceptance. PR361/362's real Auth/Storage/Functions/Realtime and audit receipts are separate. No credential-bearing trace or screenshot is produced, no real patient data is used, and clinical/legal/provider governance remains open where specified. All seven builds pass (six unchanged consumer caches); final public browsers, exact-head CI and independent review are recorded at publication.
