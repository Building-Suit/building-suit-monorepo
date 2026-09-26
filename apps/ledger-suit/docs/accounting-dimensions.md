# Accounting dimensions — V2-IMP-012

Status: implemented locally; native SQL and browser execution remain unverified in this sandbox. No hosted database, deployment, push, commit, or accountant UAT was performed.

## Implemented contract

- Controlled tenant-scoped `cost_center` and `project` values support authorized create, edit, and archive. Archive is non-destructive: historical allocation foreign keys remain readable while new draft allocations and posting reject inactive values.
- Posting/Control accounts can configure each dimension independently as optional or required. The posting trigger checks every source, including automated modules, so a required context cannot be bypassed by a non-UI posting path.
- A journal line can carry one or multiple allocations for either dimension. Each used dimension independently sums exactly to both the line transaction amount and base-currency amount. Posted allocation rows are immutable.
- Reversal journals automatically mirror the original line allocations and may retain an archived value as a historical reference; ordinary new postings still reject it.
- Manual adjustment journals expose bilingual allocation controls and submit integer minor-unit strings. Other posting sources remain valid while their account policy is optional; making a source account required intentionally blocks unassigned posts until that source supplies controlled allocations.
- `report_by_accounting_dimension` supports General Ledger, Trial Balance, Profit & Loss, Balance Sheet, and Cash Flow scopes, filtering by a controlled value and grouping by dimension. Every grouped result contains an explicit Unassigned row, including zero, and returns control differences against the same unfiltered/filtered ledger population.
- Legacy `transaction_entries.dimensions` JSON is preserved without backfill or interpretation. The workspace reports its count and controlled reports treat it as Unassigned. Mapping requires a future explicit forward correction; posted history is never rewritten.
- The scope contains no tasks, schedules, resources, billing, or other operational project-management model.

## Files and acceptance evidence

- Migration/API: `supabase/migrations/20260925190000_accounting_dimensions.sql`
- SQL fixture: `supabase/tests/44_accounting_dimensions_test.sql`
- UI: `/accounting-dimensions`, `useAccountingDimensions`, and allocation controls in `AddTransactionDialog.vue`
- Browser fixture: `tests/e2e/accounting-dimensions.spec.ts` (English/LTR and Arabic/RTL, legacy warning, explicit Unassigned, reconciliation, mobile)
- Exact-money unit fixture: `tests/unit/accounting-dimensions.test.mjs`

The SQL fixture covers value request idempotency, multi-allocation equality, over-allocation rejection, required policies, inactive/history behavior, immutable posted allocations, legacy JSON dry-run behavior, GL/TB/statement Unassigned reconciliation, viewer permissions, and tenant isolation.

## Verification on 2026-09-26

Passed: Ledger lint, full Ledger typecheck, all 12 Ledger unit files, Ledger production build, workspace token/boundary/history check, locale JSON parse, and `git diff --check`.

Not run: the new pgTAP fixture and database concurrency behavior. Docker API access is denied, and the Supabase CLI also attempts a telemetry write outside the writable workspace. The focused Playwright fixture was attempted after a successful build but the sandbox denied binding `127.0.0.1:3210` with `EPERM`. These are verification limitations, not passing evidence.

Recovery is forward-only: leave additive tables and immutable allocations in place, disable the UI/API surface if needed, and correct draft data or future policies. Never delete/rewrite posted allocations or infer controlled values from legacy JSON.
