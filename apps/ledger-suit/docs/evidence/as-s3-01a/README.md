# Account statement and journal review — AS-S3-01A

Open http://127.0.0.1:3250/accounts on this workstation. Local seed login:
`owner@beta.test` / `ledgersuit`. Open **Operating bank**, select September 1–30,
2026, then **Show activity**. Click a transaction, then another account and Back.
The example reconciles EGP 10,000 opening + 5,150 debits − 1,200 credits = 13,950
closing. These are posted entries in the owned disposable backend, not static UI
fixtures. The preview and backend are left running for review.

[Statement screenshot](preview-statement.png) · [Journal screenshot](preview-journal.png) ·
[Arabic statement](ar-statement.png) · [Arabic mobile](ar-mobile.png) ·
[Work package](../../accountant-system/work-packages/AS-S3-01A.md)

| Check | Result |
| --- | --- |
| Workspace boundaries/tokens/migration history | PASS; 80 historical migration hashes unchanged |
| Root unit tests | PASS; 39 |
| Ledger lint, typecheck, production build | PASS |
| SQL | PASS; 833 assertions / 31 files / 11s; 38 new assertions |
| New browser flows | PASS; 3 / 32.4s / no retries |
| Existing browser regressions | PASS; 27: Accounts, account nature/groups, core finance, dated classification |
| Database lint / security advisors | PASS; no schema errors/security warnings |
| Generated types | Regenerated from local public,graphql_public |
| Accountant UAT / hosted migration / deployment / customer-scale load | NOT_RUN |

The new SQL RPCs are invoker functions requiring all three read capabilities and
retaining RLS. Tests cover tenant/account/journal isolation, archived history,
reversals, viewers, invalid dates/pages, opening without movement, multiple lines
for one account, pagination and values above 2^53. No existing write contract,
historical migration, stored balance or posted entry was changed. The migration
only creates two functions and their grants. Source hashes are in
[verification.json](verification.json).

Two new browser flows use real owner/viewer sessions and posting RPCs in English
and Arabic. They cover page two → journal → another account → Back twice, date
range, keyboard focus, one dialog, empty periods, saved search and 390px layout.
The third uses a delayed read and an injected HTTP error to verify close/reopen
isolation and Retry. SQL independently proves authorization.

The regression run exposed search entered before hydration being lost; Accounts
now waits for hydration before enabling it. Test-only corrections use client
navigation when capturing browser requests, search for the created account
instead of assuming it is on page one, and forward unrelated tenant-fixture
requests without an asynchronous fetch/fulfill teardown race. Earlier failed
runs are not presented as passes. The final new suite is rerun after that fixture
fix; the 27 unchanged regression cases passed in the combined run. Historical
screenshots from previous packages were restored after those tests.

## Reproduction

From the feature worktree root, use Node/pnpm from the repository and Docker.
The owned project is `ledger-account-activity-20260919`, API 65321, DB 65322,
Postgres 17, CLI 2.116.0. Source-only copies of Ledger config, all 70 migrations,
tests, templates and seed are in `.local/verification/account-activity/supabase`.
Config ports 60320–60329 are shifted by 5000; project ID is replaced. No hosted
link or credentials were copied. Do not reset this running preview for a rerun;
use a fresh disposable copy and run SQL before browser/demo writes.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm --filter @building-suit/ledger-suit lint
pnpm --filter @building-suit/ledger-suit typecheck
pnpm --filter @building-suit/ledger-suit build
pnpm exec supabase --workdir .local/verification/account-activity test db --local
pnpm exec supabase --workdir .local/verification/account-activity db lint --local --schema public,app --fail-on warning
pnpm exec supabase --workdir .local/verification/account-activity db advisors --local --type security --fail-on warn
pnpm --filter @building-suit/ledger-suit exec playwright test -c .local/playwright.activity.config.ts tests/e2e/account-activity.spec.ts tests/e2e/accounts-table.spec.ts tests/e2e/account-nature.spec.ts tests/e2e/account-groups.spec.ts tests/e2e/core-finance.spec.ts tests/e2e/statement-classification.spec.ts
```

The ignored Playwright config derives the tracked Ledger config: API 65321,
application port 3240, `testDir: '../tests/e2e'`, webServer cwd set to the app,
`reuseExistingServer: false`. Standard isolated runs can instead use the tracked
config and backend 60321. The guards allow only these explicitly local backends;
never supply hosted settings to these write tests. Local start/status logs can
contain development keys and are deliberately excluded from committed evidence.

The running built preview uses the same local settings on port 3250. After it
stops, development can be started from the original checkout with:

```sh
pnpm dev:ledger --worktree codex/ledger-suit/account-activity -- --host 127.0.0.1 --port 3250
```

Its ignored app `.env` points only at this owned local backend. Beta sample
entries were posted through existing RPCs; no seed or customer data was changed.
The final PR contains the feature and its evidence together. Parent PR #11
merged to stg at `4e36a9ae3d21e8e3fd565e0b3c5cadebef69725f`; this branch was
fast-forwarded to that base. No merge, hosted SQL or deployment was performed.
