# Native period-close source matrix

LS-REL-CLOSE-001 supplements [module duplicate/allocation races](native-concurrency-verification.md) and [the combined accounting cycle](accountant-system/work-packages/LS-REL-CYCLE-001.md). It checks actual public commands against hard closure without modifying the posting engine or bypassing authorization.

Use the [native provider preparation](native-financial-verification.md) and pinned workspace Node/pnpm. The fixed DB-only project uses local port 60922, unchanged migrations and no seed. The Supabase CLI initialization also needs its pinned Realtime image cache even when that service is excluded. Restore the official pinned cache if absent; never reset an existing database to repair image startup. The original missing-cache failure happened before this task's financial fixtures.

```sh
LEDGER_PERIOD_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/native-period-close-runtime.mjs prepare
LEDGER_PERIOD_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/native-period-close-runtime.mjs start
LEDGER_PERIOD_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/test-period-close-concurrency.mjs
LEDGER_PERIOD_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/test-native-period-close-sql.mjs
LEDGER_PERIOD_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/native-period-close-runtime.mjs stop
```

The opt-in, fixed project ID, ownership/workdir/port checks and exact applied migration versions are mandatory. Helpers accept no connection URL or arbitrary project arguments. Private outputs stay under ignored `.local/verification/period-close`, with owner-only file permissions. Repeating a run creates new synthetic organizations and preserves prior evidence. Stop retains volumes; it is not a backup.

The source matrix has 20 actual close/post cases (ten sources, both orders), plus one concurrent annual-close retry. See the [work package](accountant-system/work-packages/LS-REL-CLOSE-001.md) for financial and identity assertions and [dated evidence](accountant-system/v2-acceptance/period-close-verification-2026-10-26.json) for actual results. Four original pgTAP suites (35/39/42-bank/45) additionally verify sequential contracts and roll back, with every planned assertion required and all 122 public/app tables fingerprinted before/after.

The older dblink concurrency fixtures 36/40 are not counted in this run. An attempted 36 replay through a Unix socket could not derive a TCP host from `inet_server_addr()`; it stopped before setup writes. The new independent-session public-command matrix supplies the concurrency evidence without changing those fixtures or adding their privileged test helper functions. The first manual fixture also supplied its revenue account in the category argument; the actual tenant guard rejected it and the fixture was corrected to use the named revenue-account argument. Neither failed attempt counts as a pass.

This native exercise is separate from full browser acceptance, current advisory triage, live Automation reconciliation, authenticated hosted configuration, offsite operating backups and named accountant acceptance. No hosted database, real money transfer or external email is used.
