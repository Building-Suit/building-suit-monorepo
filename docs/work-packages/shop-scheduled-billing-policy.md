# Approved Shop billing policy backend

Child of guard/review root #305, base31ead90599494c553e7f7ec6fc7764e1db5acbd2.
Original activation #303 is complete and separate. Preserve cache fix #306 when
reconciling current staging. No hosted SQL writes or provider payments occur here.

New owner-only scheduling preview/create/read/cancel APIs keep one pending change
per subscription. Cheaper same-interval plans, reduced entitlements/limits and
annual-to-monthly changes wait for the current paid-term end. Scheduling creates
neither orders nor charges nor changed access. The next term requires a manual
verified payment or explicit eligible-credit confirmation. Cancellation preserves
history and rejects unresolved payment cancellation. Successful settlement marks
the bound schedule completed in the same transaction; failure rolls back that
completion. Private-offer bearer tokens are not persisted and future changes must
respect the existing recipient, version, revocation and expiry constraints.

Grandfathered multi-term upgrades preserve the agreed expiry and original receipts.
Only contiguous canonical verified funded term segments can supply the target
remaining-time factor. Each segment uses its actual calendar duration (including
leap years); actual unused paid value and existing credit are deducted before final
rounding. Saved service segments preserve correct piecewise remaining-value decay
after subsequent changes. Missing/gapped/overlapping/custom or unproven spans fail
closed. This never authorizes purchasing additional prepaid time.

New quotes carry the current policy marker. Pre-policy accepted quote/credit history
retains its frozen contract. Fixtures use pg_temp historical quote helpers for
those cases, without replacing any current public API. New policy fixtures exercise
deferred/no-charge scheduling, replay/cancel, matured manual payment, completion,
two-receipt grandfathered upgrade and protection grants. The current SQL grammar,
runner syntax/lint and whitespace checks pass. Native execution remains required;
the attempted separately named cloud backend could not start because Docker layer
storage was full. It was stopped without pruning images or restarting services.
Registered GitHub-hosted disposable native CI is the supported validation path.

This backend checkpoint does not yet contain the shared pending-change UI,
post-expiry quota-resolution UI tests, complete negative/private-offer/second-upgrade
matrix or bilingual policy text. Those remain required in the approved stack before
the final reviewed staging release. Never claim scheduling or prices are validated
from SQL grammar parsing alone. No automatic debit/refund/data deletion or waiver
of applicable legal rights is authorized.
