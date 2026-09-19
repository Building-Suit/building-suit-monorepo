# AS-S2-01B verification

Source: `ea52426589880559af914ef820df79992d4cfaeb`.
Plan: `0319f4f`. Reconciliation with merged PR #7: `fe2fca8`,
with no change to the tested source tree.

The [verification record](verification.json) stores migration/test/image hashes,
counts, preservation fingerprint and limitations.
[The work package](../../accountant-system/work-packages/AS-S2-01B.md) records
scope, decisions and the corrected failures. All database writes used the owned
disposable project below. Its containers are stopped; its volume is retained.

| Check | Final result |
| --- | --- |
| Workspace check | PASS; 80 historical migration hashes preserved |
| Root unit tests | PASS; 39 |
| Ledger lint, typecheck, build | PASS |
| SQL | PASS; 795 assertions / 30 files, including 48 new assertions |
| Migration preservation | PASS; 4 accounts / 3 transactions / 6 entries, complete row/balance/report equality, no inferred backfill |
| Real concurrent database sessions | PASS; stale edit, identical retry, books lock |
| New browser tests | PASS; 4 / 15.9s / no retries |
| Existing Ledger browser regressions | PASS; 23 / 58.8s / no retries |
| Database lint and security advisors | PASS; no schema errors/security warnings |
| All advisors | 10 existing performance warnings on unrelated policies; listed in JSON |
| Generated types | Regenerated public,graphql_public output matches source |

Two new browser tests exercise actual owner/viewer identities, schedules,
historical/effective report dates and localized CSV. Two use synthetic delayed
responses to verify date/tenant isolation and error recovery. SQL separately
validates actual authorization and RLS. Accountant UAT, hosted migration,
deployment and customer-scale load/recovery exercises were not run.

## Review images

- [English scheduling dialog](en-schedule.png)
- [Arabic scheduling dialog](ar-schedule.png)
- [English mobile report](en-report-mobile.png)
- [Arabic mobile report](ar-report-mobile.png)

The bilingual fixtures share a disposable organization, so user-entered account
names can appear in either language. Application labels follow the selected
locale. Historical evidence images from earlier packages were preserved after
the regression run.

## Reproduce the isolated backend

Run from this feature's repository root with Docker, Node 26.8.1 and pnpm
10.33.0. Supabase CLI 2.116.0 is pinned in the root manifest. The setup below
refuses an existing verification directory; it copies source files only, with
no hosted links, credentials or migration-history changes.

```sh
pnpm install --frozen-lockfile
python3 - <<'PY'
from pathlib import Path
import shutil
source = Path('apps/ledger-suit/supabase')
target = Path('.local/verification/statement-classification/supabase')
target.mkdir(parents=True, exist_ok=False)
config = (source / 'config.toml').read_text()
config = config.replace('building-suit-ledger', 'ledger-statement-classification-20260919')
for port in range(60320, 60330):
    config = config.replace(str(port), str(port + 4000))
(target / 'config.toml').write_text(config)
for name in ['tests', 'templates']:
    shutil.copytree(source / name, target / name)
shutil.copy2(source / 'seed.sql', target / 'seed.sql')
(target / 'migrations').mkdir()
for migration in sorted((source / 'migrations').glob('*.sql')):
    if migration.name != '20260919105319_dated_statement_classification.sql':
        shutil.copy2(migration, target / 'migrations' / migration.name)
PY
pnpm exec supabase --workdir .local/verification/statement-classification start -x realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
LEDGER_CLASSIFICATION_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/test-statement-classification-migration.mjs
LEDGER_CLASSIFICATION_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/test-statement-classification-concurrency.mjs
curl -fsS http://127.0.0.1:64321/auth/v1/health > /dev/null
pnpm exec supabase --workdir .local/verification/statement-classification test db --local
pnpm exec supabase --workdir .local/verification/statement-classification db lint --local --schema public,app --fail-on warning
pnpm exec supabase --workdir .local/verification/statement-classification db advisors --local --type security --fail-on warn
```

Run these commands sequentially and require each to succeed. The two rehearsal
scripts verify container ownership, project ID, migration history and source
bytes before mutation. They reset only that owned project to pristine seeds at
completion. Wait for each process to exit and Auth health to pass before starting
the next check. Start/status output includes local development keys; keep it in
ignored local logs.

The preservation script expects the 68 migrations before this feature. For a
repeat on this already verified disposable project only, first reset it locally
to version `20260919095839`; never use `--linked` or a hosted database URL.

## Reproduce the application checks

Create the same ignored Playwright configuration used for this run. It derives
the existing local test configuration, changes only the isolated ports and
relative paths, and forbids server reuse.

```sh
python3 - <<'PY'
from pathlib import Path
app = Path('apps/ledger-suit')
config = (app / 'playwright.config.ts').read_text()
config = config.replace("import { defineConfig, devices } from '@playwright/test'",
    "import { defineConfig, devices } from '@playwright/test'\nimport { fileURLToPath } from 'node:url'")
config = config.replace('60321', '64321').replace("'3210'", "'3230'")
config = config.replace("testDir: './tests/e2e'", "testDir: '../tests/e2e'")
config = config.replace('webServer: {',
    "webServer: {\n    cwd: fileURLToPath(new URL('..', import.meta.url)),")
config = config.replace('reuseExistingServer: !process.env.CI', 'reuseExistingServer: false')
(app / '.local').mkdir(exist_ok=True)
(app / '.local/playwright.classification.config.ts').write_text(config)
PY
pnpm check
pnpm test
pnpm --filter @building-suit/ledger-suit lint
pnpm --filter @building-suit/ledger-suit typecheck
pnpm --filter @building-suit/ledger-suit build
pnpm --filter @building-suit/ledger-suit exec playwright test -c .local/playwright.classification.config.ts tests/e2e/statement-classification.spec.ts
pnpm --filter @building-suit/ledger-suit exec playwright test -c .local/playwright.classification.config.ts tests/e2e/accounts-table.spec.ts tests/e2e/account-nature.spec.ts tests/e2e/account-groups.spec.ts tests/e2e/core-finance.spec.ts
pnpm exec supabase --workdir .local/verification/statement-classification stop --project-id ledger-statement-classification-20260919
```

The browser config supplies local runtime settings. Environment values from a
hosted backend must not be supplied to these write tests. Tests generate evidence
images; review their changes rather than replacing earlier evidence casually.

To review manually against this backend, start the built app with the same local
runtime settings as the derived Playwright config. Use seeded local owner/viewer
accounts, open **Accounts → Statement presentation**, schedule a future line and
compare earlier/effective report dates and CSV. Scheduling never edits posted
entries or backfills an inferred classification.
