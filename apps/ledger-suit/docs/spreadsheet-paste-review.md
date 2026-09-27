# LS-PROD-001 — spreadsheet paste and safe import review

Status: **IMPLEMENTED_LOCALLY / TYPE_AND_BROWSER_VERIFICATION_PENDING**, 2026-09-27.

This delta adds one optional high-frequency input path: an accountant can copy a tab-separated range from a spreadsheet and paste it into the existing transaction-import dialog. The first pasted row supplies headers and flows through the existing bilingual column mapping, `create_csv_import_batch`, `validate_csv_import_batch`, and `confirm_csv_import_batch` contracts. Original cells remain strings; localized derived validator cells preserve the existing exact-money transport contract.

The validation review now retrieves every staged row in bounded 1,000-row requests, presents 100 rows per page, and filters all, ready/posted, invalid/failed, or duplicate rows. Filters are review-only. Confirmation still acts on the server-owned batch: there is no generic bulk edit, client-side posting path, or posted-journal mutation.

## Acceptance traceability

| Acceptance criterion | Evidence |
|---|---|
| Reuse existing staging and validated posting | Pasted rows enter the same mapping and three existing import RPC calls as CSV rows; no database contract changed. |
| Rows and row errors explicit before mutation | The existing status/issue table now loads the whole staged batch and adds counts, filters, and pagination before confirmation. |
| Posted entries immutable | The delta adds read-only review controls and an input adapter only. Existing server confirmation and reversal contracts are unchanged. |
| Retry safety, keyboard operation, exact money | Existing deterministic import posting remains authoritative; Ctrl/Command+Enter advances pasted input; parser and browser regressions preserve the original large localized amount string alongside its derived validator value. |
| JRN-04 | Existing journal search, sort, date/account/source/status filters, saved views, and route state are unchanged. Imported results continue into that same journal workspace. |

## Verification

- PASS — `pnpm --filter @building-suit/ledger-suit test:unit`: 21 files, zero failures/skips.
- PASS — `pnpm check`: design-token outputs, workspace boundaries, and 80 historical migrations unchanged.
- PASS — locale JSON parsing and `git diff --check`.
- BLOCKED BEFORE EXECUTION — `pnpm --filter @building-suit/ledger-suit typecheck`: `nuxt` is not installed in this worktree.
- BLOCKED BEFORE EXECUTION — `pnpm --filter @building-suit/ledger-suit lint`: `eslint` is not installed in this worktree.
- BLOCKED BEFORE COLLECTION — `pnpm --filter @building-suit/ledger-suit test:e2e -- tests/e2e/csv-import.spec.ts`: the available `playwright` executable reports `unknown command 'test'` and workspace dependencies are absent.

No SQL, hosted database, provider, deployment, push, merge, commit, or accountant UAT occurred.
