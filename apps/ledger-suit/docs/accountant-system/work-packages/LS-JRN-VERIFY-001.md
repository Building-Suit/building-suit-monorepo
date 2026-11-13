# LS-JRN-VERIFY-001 — native journal and report navigation

Parent: PR #508, `dd4a7961198b76d7df460dc84881d946c89b6c3e`; no pending parent edits. Scope: original JRN-04/JRN-05 and the technical return/focus portion of FS-06. The existing primary requirement tasks and immutable criteria remain authoritative.

The current native browser journey replaces obsolete single-stage authentication, removed control IDs and the old account-balances request. It uses the actual email-first Auth flow and public PostgREST commands; it does not intercept journal responses or inject sessions. It creates uniquely named retained adjustment/reversal/income fixtures, then exercises filters, sorting, search, private saved-view persistence and same-organization cross-user denial in English and Arabic. Report movement→journal→back and close must retain the period, tab and keyboard focus.

The optional `LEDGER_BROWSER_FIXTURE_DIRECTORY` selects an existing owned native browser fixture. The driver retains its existing task/project/port, migration/seed byte, container ownership and volume birth-time checks. An override cannot prepare or replace a fixture and gets unique start/stop logs. New source is built in this task's own worktree. Neither previous evidence nor financial data is reset.

Validation completed locally on 2026-10-28:

- Both actual native EN/AR journeys pass, zero retries, 49.0 seconds in the final run (`ledger-journal-native-final.log`). Date/account exclusion, manual/reversed status, search miss/recovery, exact amount bounds, ascending/descending reference sorting, route reload, saved-view state, same-organization authenticated peer read/write denial, reversal links, mobile visibility/overflow and report return/focus all execute.
- Independent read-only SQL reconciles six selected journals/twelve entries: each locale has debit=credit=118500 minor units, bank closing=54300, equity net=0 and revenue credit=54300. All four original account rows are identical. All retained attempts total 31 journals/62 entries and remain balanced; failed/interrupted fixture attempts were kept rather than erased. Four Auth users and 107 migrations remain.
- Ledger build/typecheck and scoped lint pass; all 130 Ledger units, the 138-row register validator, workspace/token boundaries and release provenance pass. All 264 public build files contain zero matches for the actual private fixture JWT secret/service key. No application runtime change was necessary. The owned native runtime is stopped with all volumes retained.

A disk-full build/start attempt is recorded as failed; a duplicate unpacked PostgreSQL image assembly archive and reproducible completed-task build caches were cleared, preserving loaded images, source layer archives, evidence and all financial volumes. Earlier browser attempts exposed obsolete SSR-request assumptions, an explicitly required revenue-account fixture and accessible-control selectors; they are not reported as successful runs. The final passing journey has no intercepted backend responses.

The dated machine evidence is [native-journal-verification-2026-10-28.json](../v2-acceptance/native-journal-verification-2026-10-28.json). Only JRN-04/JRN-05 move to implemented/passed and primary retain. FS-06 receives actual technical return/focus evidence but remains partial/investigate for its broader saved-filter/focus UAT. The current disposition totals are 130 retain / 8 investigate; all 138 criterion fingerprints and primary task mappings are preserved. Deployment stays unverified and accountant verdicts pending.

For a previously prepared owned fixture, set `LEDGER_BROWSER_DISPOSABLE_TEST=1` and `LEDGER_BROWSER_FIXTURE_DIRECTORY` to its existing private directory. From this task checkout:

```sh
node apps/ledger-suit/scripts/native-browser-runtime.mjs start
node apps/ledger-suit/scripts/verify-native-journal-evidence.mjs --snapshot-before
pnpm --filter @building-suit/ledger-suit build
pnpm --filter @building-suit/ledger-suit exec playwright test -c playwright.native-journal.config.ts
node apps/ledger-suit/scripts/verify-native-journal-evidence.mjs
node apps/ledger-suit/scripts/native-browser-runtime.mjs stop
```

The pre-run snapshot uses exclusive creation and refuses to overwrite previous evidence. Retain it for reruns. The verification script reads raw tables in a read-only transaction and never calls a report function for its oracle. Success attachments contain only synthetic fixture IDs and expected totals; private Auth traces/credentials stay ignored. Stop retains all owned database volumes.

No hosted migration, Automation database status, accountant verdict, offsite operating backup arrangement or sale-readiness claim is made by this task.
