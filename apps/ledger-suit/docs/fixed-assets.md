# Fixed assets and depreciation — V2-IMP-011

Status: implemented locally with partial verification on 2026-09-25. Full unit, Ledger lint/typecheck/build, workspace-boundary, locale JSON, and diff checks pass. Native SQL/concurrency is blocked by Docker access, and browser execution is blocked by local socket restrictions. Not deployed, hosted-verified, or accountant-accepted.

## Approved policy and boundary

V2-D09 approves straight-line and declining-balance depreciation, with straight-line as default; capitalization from the in-service date; daily proration through disposal; prospective residual value, useful life, and method changes from the next open period; explicit impairment; disposal that clears cost and accumulated depreciation and posts proceeds plus gain/loss; and corrections through linked reversal/replacement history.

The register is explicit. It never scans or converts historical purchase journals. A registration must identify one existing posted `asset_purchase` journal, and that journal must contain the matching debit to the designated asset-cost account. The register also requires a credit-nature accumulated-depreciation Contra account linked to that cost account, plus depreciation expense, impairment expense, and disposal gain/loss accounts in the acquisition currency.

This task covers fixed-asset accounting only. It does not add procurement, equipment maintenance, custody, lease accounting, component accounting, revaluation, or automatic historical mapping.

## Lifecycle contract

| Stage | Accounting and evidence |
|---|---|
| Registration | Stable organization-scoped asset code and UUID; reviewed acquisition journal link; acquisition/in-service dates; exact cost, residual, life, method/rate, and account mapping. A first immutable policy version and daily-prorated monthly schedule are created. |
| Depreciation | Straight-line allocates the exact depreciable basis. Declining balance applies the approved annual rate by actual calendar days and forces the approved residual at the useful-life end. A serialized asset-period command posts Dr depreciation expense / Cr accumulated depreciation once through the shared posting engine. |
| Policy change | A reasoned new policy version starts only at the next open period. Posted rows remain unchanged; future rows are superseded and rebuilt from the dated carrying amount. |
| Impairment | Explicit Dr impairment expense / Cr accumulated depreciation journal and immutable event; no cost rewrite. |
| Disposal | Due schedules are posted in order; the final row is clipped by actual days through disposal. The disposal debits proceeds and accumulated depreciation, credits original cost, and balances to the designated gain/loss account. |
| Correction | Acquisition, depreciation, impairment, and disposal corrections use the linked reversal RPC. Originals remain; a reversed depreciation row receives an explicit replacement slot, disposal reversal restores active status, and corrected acquisition can be replaced only through an explicit new registration. Generic reversal of a linked asset journal is rejected. |

All money is integer minor units. Commands use existing membership capabilities, subscription/quota controls, period locks, posting idempotency, journal reversal, RLS, and audit infrastructure. Direct authenticated writes are not granted. Viewer access is read-only; owner/admin/accountant receive the asset capabilities by default.

## Reports and reconciliation

The `/fixed-assets` workspace shows original cost, accumulated depreciation, and dated NBV (`cost − active depreciation/impairment`). It exposes acquisition journal, schedule journals, disposal/correction history, and designated accounts. English/LTR and Arabic/RTL copy remain independent.

`reconcile_fixed_assets` compares active register cost and positive accumulated depreciation with the signed balances of their designated GL accounts at the same date. Disposed/corrected assets contribute zero after their clearing/reversal date. Variances remain visible; no balancing plug is created.

## Files and verification contract

- Migration `20260925173000_fixed_assets.sql`: register, policy versions, schedules, events/disposals, permissions/RLS, serialized commands, read workspace, and dated GL reconciliation.
- UI: `app/pages/fixed-assets.vue`, `app/composables/useFixedAssets.ts`, `app/utils/fixedAssets.ts`, navigation, focused RPC types, and EN/AR copy.
- `supabase/tests/43_fixed_assets_test.sql`: rolled-back acquisition-through-disposal accounting, schedule allocation, NBV, reconciliation, correction, permission, isolation, and retry fixture.
- `scripts/test-fixed-assets-concurrency.mjs`: guarded independent-session duplicate depreciation race. It requires `LEDGER_ASSETS_DISPOSABLE_TEST=1`, exact migration parity, project `ledger-assets-011-disposable`, and `.local/verification/fixed-assets`; it never resets or deletes evidence.
- `tests/unit/fixed-assets.test.mjs`: independent exact-money schedule/proration cases.
- `tests/e2e/fixed-assets.spec.ts`: focused EN/LTR and AR/RTL register, schedule posting, NBV, reconciliation, and responsive checks. Backend accounting and authorization remain SQL responsibilities.

## Acceptance traceability

| Requirement | Implemented evidence | Remaining verification |
|---|---|---|
| FA-01/02/03 | Explicit stable register, acquisition journal/source, account links, controlled dates/cost/residual/life/method/rate | Native disposable SQL and accountant review of representative registrations |
| FA-04/05 | Exact daily-prorated schedule, immutable versions, asset-period lock, active-period uniqueness, posting and idempotency keys | Native SQL plus independent-session concurrency run |
| FA-06 | Dated original cost, active accumulated depreciation/impairment, and NBV equation in API/UI/tests | Browser run and accountant review |
| FA-07 | Final daily proration and balanced cost/accumulated/proceeds/gain-loss disposal journal | Native gain/loss fixture and accountant review |
| FA-08 | Dated register-to-designated-GL account reconciliation with visible variance | Native SQL and pre/post migration financial fingerprint |
| FA-09 | Linked append-only reversal events, replacement schedule slot, disposal restoration, explicit acquisition replacement contract | Native correction chain and generic-reversal denial |
| VAL-05 asset scope | Focused SQL, exact-money unit, bilingual UI, and guarded concurrency fixtures | Native SQL/concurrency/browser execution and accountant UAT |

The migration has not been applied to any local or hosted database during implementation. Recovery is forward-only: gate the feature, reverse linked asset events in dependency order, and create reviewed replacements. Posted history is never deleted or rewritten.
