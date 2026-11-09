# Disposable HQ Realtime isolation

This is source-only review evidence. It does not install the proposal in hosted
Supabase or authorize worker, identity, scheduler, or production changes.

## Checks

- `node --test tooling/hq-agent-host/live-dispatch-native-source.test.mjs` checks
  fixture migration compatibility, an actual worker claim, proposal creation, and
  the private invoker procedure contract using PGlite. It neither substitutes a
  fake cron implementation nor proves transaction/concurrency behavior.
- `.github/workflows/hq-live-dispatch-disposable.yml` builds PostgreSQL 17 with
  the actual `pg_cron` package in a two-job matrix (background workers on/off) and runs
  `node --test tooling/hq-agent-host/live-dispatch-native-check.mjs`. The database
  runs on an internal Docker network. The script accepts no database URL or
  credential environment override: its endpoint is always loopback port 55439,
  database `hq_live_dispatch_disposable`, with fixture-only credentials.
- The native check intentionally does not match the normal `*.test.mjs` glob.
  Running it requires the disposable container described in the workflow.

The native check observes actual lock waits through `pg_stat_activity`,
`pg_locks`, and `pg_blocking_pids` before canceling/releasing the other session.
Polling has a deadline; elapsed sleep alone is never treated as evidence that a
query blocked. It tests the actual migrated public worker claim and presence
RPCs, not a surrogate producer. Deterministic committed-token fixtures also
check stale reconciliation against newer pending and successfully delivered
attempts. Service-role flush rejection must preserve the entire outbox, message
count, and dispatch state both with a pending attempt and an open circuit.
Each actual pg_cron mode must execute
`CALL`, commit its attempt, publish, and remove the drained wake. Libpq mode
connects over the disposable container's Unix socket using the official image's
existing local authentication, without adding a host trust rule or production
credentials. The native test checks the actual server mode against the CI matrix.

The fixture uses real HQ application migration bodies and synthetic Auth users,
sessions, roster, and jobs. Hosted Brain scheduler migrations are excluded. The
initial admission-fence proposal supplies its definitions without the operational
staging-only pause. Realtime uses the observed provider `send` semantics: preserve
an existing payload ID, otherwise add one; generate the independent row ID; set
`realtime.topic`; catch ordinary errors as warnings. This copied provider contract
is executed as actual PL/pgSQL against a real relation. It is not a complete
Supabase Realtime installation and proves neither managed partition behavior nor
socket/client receipt. An exact transport publication is not a browser ACK.

Local source checks passing do not mean native checks passed. Native CI must be
successful on the exact review head before claiming PostgreSQL/cron validation.
