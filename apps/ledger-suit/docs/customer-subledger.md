# Customer accrual subledger — V2-IMP-008

Status: implemented locally; independent Supabase/browser/concurrency verification and accountant acceptance remain pending. No deployment or hosted migration has occurred.

The control-plane task supplied approved V2-D05 on 2026-09-25: recognize receivables on issue; allow many-to-many receipt allocation; require full allocation; reject overpayments; retain linked immutable credits/corrections; privilege and explain write-offs; reverse accounting and allocations append-only. This approval supersedes the baseline's earlier pending D05 entry. Multi-currency AR is excluded.

## Product contract

`/receivables` uses existing customers (`counterparties.type = customer`) and explicitly created customer Control bindings. It provides issue, receipt, credit, write-off and reversal dialogs, dated open invoices, statements, aging, Control reconciliation and a legacy review. Shared dialogs protect dirty/pending forms. Amounts cross the API as decimal strings; arithmetic uses integer minor units. Tenant/session changes clear reports and drafts, and stale requests cannot populate a new selection.

| Operation | Accounting and allocation behavior |
|---|---|
| Invoice / obligation | Dr selected AR Control / Cr selected Revenue. Customer, issue date, due date, original amount and reference are immutable. References are unique per customer, including reversed invoices; a corrected replacement uses a new reference. |
| Receipt | Dr Cash/Bank/Mobile Wallet / Cr AR Control. Allocate its entire amount across invoices for the same customer and Control. No second revenue recognition, unallocated receipt or overpayment. |
| Credit | Dr the original Revenue account / Cr AR Control. Fully allocate to linked invoices with that same Revenue account; reason required. |
| Write-off / adjustment | Dr selected Expense / Cr AR Control. Fully allocate, require `ar.adjust`, `transactions.adjust` and a reason. Owner/admin receive the AR privilege by default. Existing adjustment-approval policy blocks this direct path when enabled; this task adds no approval bypass. Other amount/account corrections use reversal and reissue. |
| Reversal | Existing shared journal reversal mirrors the original entries. New AR document and opposite allocations link their originals. No deletion. Reverse a receipt in full and issue a replacement to correct its allocation. An invoice cannot be reversed while allocations would leave any dated balance negative. Reversing a reversal is unsupported. |

All commands use the shared posting engine and existing membership, subscription, quota and period controls. `ar.issue`, `ar.receive`, `ar.credit`, `ar.reverse` default to owner/admin/accountant; `ar.read` additionally defaults to viewer. Custom roles require explicit grants. A tenant advisory lock serializes commands before payload-bound idempotency checks. Allocation validation checks every affected historical and future event date, so backdating cannot consume amounts already allocated later. Normal AR writes, including corrections, require an open date; no special soft/hard-close bypass is introduced.

`ar_documents` and `ar_allocations` have tenant-composite foreign keys, read RLS, no authenticated direct writes and immutable history triggers. Private posting helpers remain inaccessible to clients. Generic journal reversal cannot enter the trusted Control context; callers must use the AR reversal RPC.

## Reports and legacy treatment

Statement: **opening + charges + adjustments − receipts = closing**. Reversals appear as signed adjustments with links to the originals. Movements include the shared journal identity and a running balance. Statement opening includes events strictly before the start date; closing includes events through the end date. An effective date, rather than insertion timestamp or current reversal status, determines financial inclusion.

Aging uses outstanding amounts at the report date. Due today or later is `current`; overdue calendar days are partitioned into `1–30`, `31–60`, `61–90`, `91+`. There is no grace period or overlap. Original due dates are immutable. Bucket boundaries are documented implementation defaults; D05 does not separately specify buckets, and these defaults have not been independently accountant-verified.

The real customer provider supplies `app.control_subledger_balance`; supplier behavior stays unavailable. Reconciliation includes **all customers per Control**, independent of the page's customer filter. Generic Control adjustments remain outside AR and therefore create visible variances. Existing variance-explanation evidence remains available through the Control contract; AR never inserts a balancing plug or automatically explains a difference.

Legacy receivable commitments remain cash-basis intentions and retain their existing settlement semantics. `preview_legacy_ar` exposes original, cash-settled and remaining amounts, customer and old linked account for reviewed treatment. Every row is explicitly excluded from accrual AR. There is no inferred Control mapping, migration, rewrite, automatic linking or conversion endpoint. Review must determine whether to leave a commitment in legacy, reverse/correct earlier recognition, or issue an independently reviewed obligation. The task does not authorize that data treatment.

## Files and verification

- Migration `20260925113812_accrual_customer_subledger.sql`: documents, allocations, RPCs, permissions, real AR provider, exact workspace response and read-only legacy preview.
- UI: `app/pages/receivables.vue`, `app/composables/useCustomerSubledger.ts`, `app/utils/customerSubledger.ts`, shell navigation and EN/AR messages.
- `types/ar-rpc.types.ts` is generated from migrated PostgreSQL function metadata; the product adapter uses this focused contract. Regenerate without editing generated output:

  ```sh
  # Supply only an explicitly verified disposable local connection.
  psql "$LEDGER_LOCAL_DB_URL" -XAtf apps/ledger-suit/scripts/ar-contract-catalog.sql |
    node apps/ledger-suit/scripts/generate-ar-contracts.mjs
  ```

- `supabase/tests/40_customer_subledger_test.sql`: 56 rolled-back TAP assertions, no pgTAP extension dependency. It runs through normal Supabase `test db --local <path>` or psql. It verifies lifecycle, exact balances, retries/conflicts, historical cutoffs, credit/write-off/multi-allocation reversals, no duplicate revenue, RLS, permission/subscription/period denial, immutable evidence, bigint transport, legacy exclusion and deferred journal constraints.
- Existing Control SQL/browser expectations now reflect a real empty AR provider: zero with no GL activity, visible variance for an unmatched generic adjustment. Supplier provider absence is unchanged.
- `scripts/test-customer-subledger-concurrency.mjs`: deterministic independent-session invoice retry, receipt retry and overlapping-allocation races, with dated reconciliation. It refuses execution without `LEDGER_AR_DISPOSABLE_TEST=1`, the exact disposable project `ledger-ar-008-disposable`, matching Docker workdir `.local/verification/customer-subledger`, and matching migration files/history. Prepare that isolated Supabase instance from this app's config/history using unused local ports before running. It never resets or deletes financial history.
- `playwright.ar.config.ts` / `tests/e2e/customer-subledger-ui.spec.ts`: synthetic API browser tests against the real page in EN/LTR and AR/RTL, exact receipt transport, full-allocation validation, failed-save recovery, retained retry key, reports, reload and mobile viewport. These are UI evidence only, not backend authorization evidence.

### Checks actually run (2026-09-25)

| Check | Result |
|---|---|
| `pnpm agent:preflight` | Failed: fetch/GitHub state unavailable in sandbox; no publication/base changes made. |
| `DO_NOT_TRACK=1 pnpm db ledger-suit migration new accrual_customer_subledger` | Passed. Initial attempt failed on telemetry outside the writable worktree; disabling telemetry resolved it. |
| Embedded PostgreSQL full migration replay + focused fixture | Passed, 56 assertions. Real Ledger SQL executed with synthetic Auth/Storage/cron infrastructure; this is not a full Supabase service test. |
| Pre/post migration preservation | Passed: one pre-existing journal, two entries, debits 12,345, credits 12,345, AR Control 12,345, and one legacy commitment unchanged byte-for-byte as JSON records. |
| `node --test apps/ledger-suit/tests/unit/customer-subledger.test.mjs` | Passed, exact aging aggregation beyond JS safe integers. |
| Focused `vue-tsc` and changed-file ESLint | Passed after correcting new-page imports/user identity typing. No broad suite run. |
| `git diff --check` | Passed. |
| Guarded concurrency runner | Blocked before mutation: Docker socket access denied (`EPERM`). |
| `pnpm exec playwright test -c playwright.ar.config.ts` (Ledger cwd) | Blocked before tests: localhost connection/start denied (`EPERM`, port 3228). |

The optional embedded harness is reproducible without a database server. Install `@electric-sql/pglite@0.3.16` into an ignored standalone `.local/ar-validation` package (use `pnpm --dir .local/ar-validation install --ignore-workspace`; no product dependency/lockfile changes), then run from the repository:

```sh
node apps/ledger-suit/scripts/test-customer-subledger-embedded.mjs
node apps/ledger-suit/scripts/generate-ar-contracts.mjs < .local/ar-validation/catalog.json
```

The harness replaces only unavailable Supabase provider infrastructure, loads the maintained accounting migration chain, compares synthetic pre/post data, runs the same focused SQL file, and emits the real function catalog. It does not prove true multi-session locking, PostgREST behavior, Auth service behavior, browser operation or hosted readiness.

For focused type verification, extend Ledger's generated `.nuxt/tsconfig.app.json` in an ignored local config and include `.nuxt/**/*.d.ts` plus the changed page, composable, utility, layout and browser spec/config. Run `pnpm exec vue-tsc --noEmit -p <that-config>`. Run ESLint from `apps/ledger-suit` on the changed files, so its generated page rules resolve correctly.

## Acceptance traceability and remaining review

| Requirement | Implemented evidence | Remaining verification |
|---|---|---|
| AR-01/02/09 | Explicit Control binding; immutable issue/due/reference/amount; exact once Dr AR/Cr Revenue; receipt never duplicates revenue | Accountant approval of representative invoice/receipt balances |
| AR-03/04/05 | Many-to-many full allocations, exact partial/full settlement, overpayment rejection, reasoned credit/write-off, append-only reversals | Independent concurrency and live Supabase caller tests |
| AR-06/07 | Dated statement roll-forward and original-due-date partitioned aging | Browser execution and accountant review |
| AR-08, COA-09 | Independent customer event total compared with actual posted Control balance by date; explicit variance | Existing Control regression suite on native Supabase; accountant variance review |
| VAL-04 (customer scope) | 56 accounting assertions, preservation fixture, focused UI/race fixtures | Native concurrent tests, browser execution, accountant UAT; supplier and other modules are outside this task |

No initial dirty changes were present; `opening-balances.vue` was untouched. Worktree branch: `codex/ledger-suit/v2-imp-008`; starting HEAD: `310c54f`. No commit, push, merge, deployment or hosted database operation was performed. Keep the migration forward-only. Recovery is a separately authorized feature/permission gate and linked reversals/corrected documents; never delete posted history. This record does not claim completion of blocked acceptance checks.

## Retry-2 repair (2026-09-25)

The recorded verification failures were repaired without replacing the existing AR implementation:

- Opening-balance mapping and preview now use `BsDataTable`, preserving their inputs and validation.
- The Ledger layout retains the SSR access branch through hydration. The saved browser trace showed the shell inheriting the loading div's attributes, losing its grid and covering receipt actions with the sidebar. The AR browser fixture also exercises receipt entry after a full reload.
- Browser checks follow the current nested account layout, Journal Center heading, indirect cash-flow CSV columns and classification revision/date-order contract. The statement fixture selects a period after existing journals so another test or retry cannot contaminate reconciliation. CSV downloads attach their named anchor through download initiation before cleanup; the Arabic filename still requires browser confirmation.
- Failing SQL fixtures now scope assertions to their own records, account for existing accounts, and isolate monthly quota/statement data with separate fixture owners. Monthly quota boundaries include every current transaction-source enum value.
- Forward migration `20260925124547_restore_report_export_volatility.sql` restores `VOLATILE` on the report export that acquires a plan-feature lock; the prior financial-statement migration incorrectly redeclared it `STABLE`. No applied migration or API signature was changed.

Focused repair validation: workspace boundary check, changed-file ESLint, focused `vue-tsc`, three relevant unit-test files and `git diff --check` passed. The ignored `.local/repair-sql.mjs` harness replayed migrations and ran 201 assertions from SQL fixtures 12, 14, 19, 30, 41 and 40, plus the export volatility assertion and pre/post migration preservation check. It used embedded PostgreSQL with provider shims and assertion adapters, omitted the untouched dblink portions of 14/19, and does **not** replace native pgTAP or concurrency verification. Logs are in `/tmp/v2-imp-008-repair-{fixtures,types}.log` for this session.

Control-plane prerequisite: the recorded missing `post_ar_document` function and unavailable AR provider indicate that the verification database lacked `20260925113812_accrual_customer_subledger.sql`. Replay the pending migrations, including the volatility repair, on the designated disposable local database before native SQL/browser verification. The AR fixture now reports that missing prerequisite explicitly. No local database service was changed here: localhost/browser startup was blocked by the sandbox, and final native/browser verification remains with the control plane. Preflight could not verify fetch/GitHub state. Existing unrelated edits/evidence were preserved; no commit, push, merge, deployment or hosted database operation occurred.
