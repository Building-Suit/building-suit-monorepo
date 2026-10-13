# BS-UI-ZN-LEDGER-001 — local implementation status

This inherited implementation snapshot is superseded by the [final repair convergence report](zero-native-ui-convergence-report.md). Its counts and verification results describe the earlier source state.

Status: **in progress; acceptance is not complete**. Changes are uncommitted in the task worktree. No publication, deployment or database operations were performed.

The current changes migrate 318 direct table columns and the grouped trial-balance footer to the shared column/schema/cell/footer contract. The shared schema preserves controlled sort accessibility and aligned totals. Eight local presentation wrappers are removed: MoneyText, KpiCard, LedgerPageHeader, AccountingTableDensity, RevenueExpenseChart, SetupChecklist, QuotaUsageMeter and UsageMeters. Currency/context/KPI/chart, setup queries and quota guidance remain in Ledger composables. Shared chart tables retain net values without adding another plotted series. The component catalogue demonstrates column footers and table-only chart series.

The exact debt manifest removes 744 Ledger occurrences and retains the unfinished migration. Passing the manifest check in migration mode does not establish the zero-native acceptance criterion.

| Remaining Ledger debt | Occurrences |
|---|---:|
| app-local-component-file | 21 |
| native-tag | 1971 |
| presentation-attribute | 1744 |
| style-block | 2 |
| app-local-component-tag | 28 |
| non-bs-tag | 1 |
| nuxt-or-vue-render-tag | 42 |
| Total | 3809 |

Remaining local Vue components: AccountActivityDialog, AccountStatementClassificationDialog, AccountTree, AddTransactionDialog, BillingCheckout, CashFlowAllocationDialog, ChartTemplateReview, ControlReconciliationPanel, CsvImportDialog, DocumentExtractionReview, FinancialSystemMap, FxSubledgerPanel, ManualPaymentCheckout, OperationsCenter, OrganizationSetup, OrganizationSwitcher, SubscriptionGate, SyntheticDemo, TeamMenu, TransactionDetailDialog, TransactionTags.

The remaining native/layout/form/link/chrome templates, local style blocks and presentation CSS still require migration. Product orchestration from the remaining local Vue components must move into Ledger adapters; renaming those components or moving product queries into shared UI would not satisfy the task. Exhaustive root mutation-form and rendered behavior review remains unverified.

Verification executed successfully:

- `node tooling/checks/suit-template-boundaries.mjs` (migration mode).
- `pnpm check`.
- `pnpm typecheck` (all workspace apps; after `pnpm docs:generate` prepared the ignored documentation catalogue).
- `pnpm lint` (zero errors; attribute-order warnings were subsequently fixed in changed Ledger templates).
- `node --test apps/ledger-suit/tests/unit/*.test.mjs packages/ui/tests/*.test.mjs packages/ux/tests/*.test.mjs`.
- `node --test apps/ledger-suit/tests/unit/shared-ui-migration.test.mjs`.
- `pnpm --filter @building-suit/ledger-suit build`.
- `pnpm --filter @building-suit/shop-suit build`.
- `pnpm --filter @building-suit/docs build`.
- `git diff --check`.

Blocked verification:

- `pnpm agent:preflight` exited 1: fetch/GitHub state was not verified. No publication/base decision was made from stale state.
- `pnpm --filter @building-suit/ledger-suit exec playwright test tests/e2e/shared-ui-foundation.spec.ts --workers=1 --retries=0 --repeat-each=2` exited 1 before tests ran. Direct server startup confirmed `listen EPERM: operation not permitted 127.0.0.1:3210` in the sandbox. Desktop/mobile, English/Arabic, light/dark, keyboard/focus and financial workflow rendered acceptance is not verified.
