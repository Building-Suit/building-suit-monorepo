# Published access migration restoration — 2026-10-29

This is a Ledger integration repair while Suit feature work is paused. The parent coordinates staging order, with Shop #441 first. No staging merge, main promotion, hosted history repair or denied-read retry is included.

## Source provenance

Restore `supabase/migrations/20261022182716_explicit_data_api_access.sql` unchanged from shared PR #440 at `cdb22ec3278d2f016e487c52119ed0c2b490b8df`. Its original published commit is `4f3ca3e89d9706dd471d9cc374567c69bc14f522`. Both contain the identical Git blob `6e14c9b7e6390112ae54dadcec5857a38d9af0b1`: 78,437 bytes, 654 lines, SHA-256 `42e9922712a955ea509df6a409c84d2946c9d18e25d5a43131c5fc118b13f04f`.

The retained `docs/shared/supabase-oct30-access.md` at that shared commit records version `20261022182716` as applied to Ledger staging and production. The current Ledger/staging trees lacked its source. This restores an existing published version; it does not invent a new version, alter its SQL, replace a prior migration or modify hosted migration metadata. All 108 files present at Ledger parent `2b5ffe8aa655f299303f064ac0cc95dbbe61e334` remain byte-identical. Detailed source checks are in [provenance.json](evidence/applied-access-history-20261029/provenance.json).

## Native preservation and replay

Verification uses the owned cloud-local `ledger-access-history-20261029` project on database port 60922, created without copying credentials, `.env`, CLI links or hosted state. The maintained image preparation preserves the pinned PostgreSQL 17.6 filesystem/configuration and uses actual Auth/Storage/Realtime schema initialization through Supabase CLI 2.116.0. SQL provider shims are not used; optional API services remain stopped. This is native SQL evidence, not hosted or HTTP provider acceptance.

The initial 108-migration fixture passes 66 suites / 1,996 assertions. The bounded `scripts/verify-access-history-restoration.mjs` verifies its task marker, workdir, container label, port, exact migration set and source digest, then applies only the missing version through the supported local CLI. It accepts no URL/project arguments and requires `LEDGER_ACCESS_HISTORY_DISPOSABLE_TEST=1`.

The 108→109 preservation run retains all 122 business table fingerprints / 927 populated synthetic rows, 1,512 effective CRUD checks, 969 non-trigger execution checks and all 108 pre-existing migration-row fingerprints. Only the expected history version is added. See [preservation.json](evidence/applied-access-history-20261029/preservation.json).

A clean 109-migration replay exposed eight test suites whose temporary PostgreSQL helpers relied on implicit PUBLIC execution. Their fixtures now grant named `pg_temp` functions only to the authenticated/anonymous roles actually exercised. Assertions and application permissions are unchanged; the migration is not edited or weakened. The new 12-assertion SQL contract checks retained financial reads/RLS, denied client mutations/trigger execution and explicit grants for new tables, sequences and routines.

Final clean-replay/native-suite results are retained in [verification.json](evidence/applied-access-history-20261029/verification.json). Root unit/boundary checks and changed-script lint remain distinct from the required combined GitHub CI run on the published new head.

## Reproduction and release limits

Prepare a fresh owned fixture by copying Ledger config, migrations, tests, templates and seed into `.local/verification/access-history`, using project `ledger-access-history-20261029` and replacing the 603xx ports with 609xx. Record the matching `LEDGER-HISTORY-20261029` owner marker. For the preservation phase, initially omit only version `20261022182716`, start the database using the maintained native image preparation/runbook, and run the baseline SQL suite before the opt-in preservation script. The script copies the exact published file into that owned fixture before its local migration command. For clean replay, verify every copied file against source, reset only that owned local project explicitly and execute all SQL suites.

The existing provider check `120018638314` on staging `2efbed85c5893dfcd4d7a40eaa27a22e9690b00d` reports only “Remote migration versions not found in local migrations directory,” with no version list or annotations. Read-only Supabase access to Ledger staging `yqculoltqsyfastmihmu` was denied. The complete live missing-version set and original hosted statement bytes are therefore not reverified here. Source identity, the prior applied audit and native tests support this repository restoration; they do not establish actual provider recovery.

After the Shop staging result, reconcile #439 with the then-current staging base and rerun exact combined checks. Preserve provider-health and staging-spacing gates. Current staging/production outcomes, accountant acceptance, backups, clinical/legal approvals, public activation and marketing readiness are not inferred from this repair.
