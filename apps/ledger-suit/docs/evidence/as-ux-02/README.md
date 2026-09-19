# AS-UX-02 — CSV verification

2026-09-19. Base: merged PR #13 / `1ca570993359f7a8637195e1f8e567748baaf59a`. Source hashes and artifact hashes are in [verification.json](verification.json).

| Check | Result |
|---|---|
| Root `pnpm test` | 49 passed, including five CSV unit cases |
| Root `pnpm check` | PASS; canonical tokens/boundaries and 80 preserved migrations |
| Ledger lint / typecheck / build | PASS |
| Combined CSV, report, workspace, classification and usage browser suite | 25 passed (2.4 minutes) |
| Lapsed/expired read-only access, serial final run | 2 passed (11.3 seconds) |
| Preview | PASS; English/Arabic modal and downloaded templates, Arabic mobile width, no page errors |
| SQL / hosted deployment / accountant UAT | NOT_RUN; no schema changes or hosted writes |

The real en/ar tests create local test accounts through the existing RPC, use their automatically generated categories, download/edit/upload the template, validate and post income/expense, re-import as duplicates, verify exactly two transactions and original source cells, and download all five reports. Browser cases cover filter/focus preservation, dirty-close confirmation, mobile/RTL, permission/plan/quota denial, late staging responses, and refreshing Transactions after import. Unit coverage preserves precision above 2^53, quoted/newline cells, formula-protected strings, empty reports, mixed-language/ambiguous headers and original cells during normalization. Existing database authorization is unchanged; client fixtures are not claimed as RLS proof.

The initial regression run exposed a real stale-quota race. The final run includes a deterministic delayed-response test proving a forced refresh receives a newer snapshot. A parallel read-only run exceeded the account-loading timeout; it passed unchanged in the serial final run. Initial test fixtures were corrected to use supported account arguments and the automatically generated categories. All final checks pass. Historical screenshots produced by regressions were restored.

## Reproduce

Use the repository’s designated disposable Ledger backend and tracked Playwright configuration (60321 by default). Build before browser tests:

```sh
pnpm test
pnpm check
pnpm --filter @building-suit/ledger-suit lint
pnpm --filter @building-suit/ledger-suit typecheck
pnpm --filter @building-suit/ledger-suit build
pnpm --filter @building-suit/ledger-suit exec playwright test tests/e2e/csv-import.spec.ts tests/e2e/csv-localization.spec.ts tests/e2e/report-exports.spec.ts tests/e2e/workspace-ux.spec.ts tests/e2e/statement-classification.spec.ts tests/e2e/usage.spec.ts
pnpm --filter @building-suit/ledger-suit exec playwright test tests/e2e/trial-billing.spec.ts tests/e2e/acquisition.spec.ts --grep 'expired Trial|lapsed workspace'
```

This run reused the verified task-owned `ledger-account-activity-20260919` backend at API 65321 / database 65322 without resetting it. An ignored config changes only loopback ports and config-relative paths; browser apps use 3271/3272. No hosted credentials or customer data are included. Raw logs remain ignored.

Preview: `http://127.0.0.1:3270/transactions`, local fixture `owner@beta.test` / `ledgersuit`. The `preview-*.png` images use the preserved Beta demo; other screenshots use the automated scenarios. [English template](template-en.csv) and [Arabic template](template-ar.csv) were downloaded from the actual modal. Replace their example rows before importing. The app generates the template using the current language, organization currency and date. Report exports retain user-entered names and exact numeric/identifier values; localized headings do not translate stored customer data.
