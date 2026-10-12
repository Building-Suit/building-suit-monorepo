# SAS-D013 — No manual external proof before SAS engineering continuation

**Status:** APPROVED by product owner, 2026-10-10.
**Applies to:** `SAS-M1-BILLING-001` and `SAS-M1-GATE-001`.
**Supersedes:** SAS-D012 Gate A requirement for independently collected manual staging
screenshots/receipts **as a pre-publication condition**. The original decision
and prior failed verification history remain preserved.

## Approved effect

The owner explicitly directs that engineering tasks resume automatically now.
No manual staging receipt review, no first real bank transfer, and no outside
reviewer is an engineering implementation/publication prerequisite. The absence
of such evidence is an approved **DEFERRED / NOT TESTED** commercial acceptance
condition, never a passing bank confirmation.

Automated typecheck, lint, build, code review, unit, SQL, browser, RLS, replay,
idempotency, quota, privacy, signed-adapter and other engineering checks remain
required wherever the current control-plane verification plan registers them.
Failed engineering checks may not be marked PASSED without running them.

Actual Shop payment approval continues to require truthful manual inspection of
funds in the receiving InstaPay/bank account, with amount, reference and date,
authorized operator, exact-once activation and correlated audit. Staging
synthetic/no-funds requests must not be approved as paid. No bank verification,
production deployment, merge, provider changes, new payment or financial receipt
is authorized by this decision.

This versioned waiver supersedes the two original **manual external-evidence
pre-publication executable assertions only**, not the domain authorization code.
The registered check commands are retained for historical continuity and now
assert this explicit owner-authorized deferral. Neither checker claims a
staging receipt PASS. Original frozen queue, task IDs and attempts stay intact.

**First-real-payment acceptance:** PENDING until real funds arrive.
**Commercial/domain launch approval:** NOT GRANTED.
**Engineering task state:** Determined only by the controller's fresh automated
verification, separate Draft publisher and task-credit mechanism.
