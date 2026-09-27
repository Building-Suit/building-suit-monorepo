# Foreign-currency AR/AP and cross-currency settlement

Status: LS-FX-001 implements the product/engineering contract approved in V2-D13 revision 2. This is not accountant acceptance, hosted migration evidence, deployment approval, or an IAS 21 compliance claim.

## Implemented contract

- Existing organization base currency and all historical `ar_documents` / `ap_documents` remain unchanged. New evidence is forward-only in migration `20260927160000_fx_cross_currency_ar_ap.sql`.
- Customer and supplier obligations retain original currency/minor units, event-date rate, translated base carrying value, rate source/reference, operator, counterparty, Control binding, and shared-ledger transaction.
- A settlement has one actual gross settlement currency/amount and may allocate multiple same-counterparty, same-Control items. Each allocation persists document amount extinguished, settlement amount consumed, exact agreed cross-rate/evidence, carrying/base amounts, realized difference, and deterministic final-allocation rounding residual.
- Recognition, settlement, revaluation, and reversal journals use the existing shared posting and period boundary. FX gain/loss accounts must be explicitly mapped. Bank fees remain outside this workflow and use the existing expense path.
- Carry-forward as-of revaluations are previewed before confirmation, post deltas only, and do not alter original rates or currency amounts. Settlement consumes revalued carrying value and reclassifies the settled prior unrealized portion into realized FX without changing total profit/loss.
- Tenant capabilities, subscription/currency eligibility, period locks, append-only evidence, canonical idempotency payloads, and an organization-wide advisory allocation lock are enforced in PostgreSQL. Backdated changes with later dependent FX events are rejected.
- The Receivables and Payables pages expose the same Ledger-owned FX workflow in English/LTR and Arabic/RTL. They show original and settlement currencies, evidence, base carrying/settlement values, realized FX, and revaluation preview.

Rates use base-currency major units per one foreign-currency major unit. Cross-rates use settlement-currency major units per one document-currency major unit. Amounts remain integer minor units; decimal rates are rational decimal strings. New conversion and proportional-allocation rounding is half away from zero. The final full allocation consumes the exact remaining carrying value.

The existing ledger has no separate authoritative foreign-cash carrying-value subledger. Consequently the cash/bank leg is valued at the immutable settlement-date snapshot and no disconnected cash-side FX balance is introduced. If a future approved cash carrying-value rule is added, its FX must be exposed separately.

## Verification record

Prepared checks and required evidence:

- `apps/ledger-suit/supabase/tests/70_fx_cross_currency_test.sql` covers synthetic AR/AP examples, partial settlement, revaluation, unrealized reclassification, reversal, zero/two/three-decimal currencies, values above the JavaScript safe-integer range, validation, permissions/periods, reconciliation, and unchanged base-currency AR.
- `LEDGER_FX_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/test-fx-cross-currency-concurrency.mjs` is an independent-session allocation race for an explicitly named, owned disposable database.
- `node --test apps/ledger-suit/tests/unit/fx-cross-currency.test.mjs` covers rational rates and exact bigint rounding/allocation.
- `pnpm exec playwright test --config apps/ledger-suit/playwright.config.ts apps/ledger-suit/tests/e2e/fx-cross-currency.spec.ts` covers the real FX panel in EN/LTR receivables and AR/RTL payables with multi-document allocation, recoverable backend rejection, posting evidence, preview/confirmation, and Control reconciliation.

Actual worktree results on 2026-09-27:

- PASS — focused exact-money unit test (6 subtests), Ledger typecheck, Ledger lint, Ledger production build, locale JSON parsing, concurrency-script syntax, Playwright discovery (2 cases), and `git diff --check`.
- PARTIAL — the repository unit command passed 30/31 files, including every Ledger unit file. The unrelated worktree-launcher test failed two subprocess cases because the sandbox denied `spawnSync /usr/bin/node` with `EPERM`; its other seven cases passed.
- BLOCKED BEFORE EXECUTION — native SQL migration replay / `70_fx_cross_currency_test.sql` and independent-session concurrency. `supabase status` reached the local CLI with telemetry disabled but Docker access failed with `permission denied ... /var/run/docker.sock`.
- BLOCKED BEFORE EXECUTION — Playwright runtime. The production server could not bind its loopback port in this sandbox (`listen EPERM 127.0.0.1:3210`); both EN/LTR and AR/RTL cases were discovered but not executed.
- The generated full database contract could not be regenerated because the local migrated schema could not start. The focused PostgREST FX contract is present in `types/fx-rpc.types.ts`; regeneration from an authorized disposable local schema remains required before independent acceptance.

Native SQL/concurrency and the browser API mock are deliberately kept as separate evidence classes. Prepared fixtures or provider shims do not substitute for the blocked runtime checks.

## Limitations and acceptance boundary

- No live rate provider, automated bank conversion, tax/regulatory integration, bank-fee netting, functional-currency change, foreign opening-balance conversion, or other Suit application change is included.
- FX mapping replacement is deliberately refused after its immutable initial configuration. A reviewed forward mapping-version migration is required if policy changes.
- Accountant review/UAT is pending. No hosted database was read or modified, and no merge, push, release, or deployment is authorized by this implementation.
