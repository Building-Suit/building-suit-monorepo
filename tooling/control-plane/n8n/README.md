# n8n controller replacements

`fixtures/live-2026-10-02.json` is the sanitized, immutable evidence record for
the verified 2026-10-02 container export. The three live workflow identities are
preserved in `artifacts/`, but every generated workflow is inactive.

Generate and validate locally:

```sh
node tooling/control-plane/n8n/generate-replacements.mjs
node tooling/control-plane/n8n/generate-replacements.mjs --check
node tooling/control-plane/n8n/validate-replacements.mjs
pnpm automation:resilience
```

These commands only read and write repository files. They do not import,
activate, disable, or update a running n8n instance. Runtime review and cutover
are intentionally outside CP-RES-007.

The resilience command is the CP-RES-009 cutover-readiness gate. It deterministically
injects controller failures into repository-side fixtures, validates crash/resume,
leases, verification, publication, stop/run and watcher behavior, and checks the
generated replacement and baseline-export digests. Its committed machine-readable
and human-readable results are under `../resilience/reports/`. Check mode is read-only
and fails if either report is stale. The gate does not contact or mutate live n8n;
activation still requires explicit operator authorization.

The controller contract is:

- BS-10 calls `task-supervise` through the restricted runner. The supervisor is
  the sole owner of implementation, verification, retry, and publication.
- External waits use the persisted `next_wake_at`; lease contention uses the
  persisted `lease_expires_at`. Operator and decision waits are returned without
  inventing an n8n retry counter.
- BS-20 checks the run gate before every claim and after every successful task,
  so stop requests prevent the next claim. A recoverable task wait preserves the
  logical run.
- BS-20 treats maintenance as a distinct resumable wait. It passes the protocol,
  the operator-reviewed `BS_BATCH_CONTROLLER_FINGERPRINT`, and the n8n execution
  ID separately to the acquire/resume API; the protocol label is never accepted
  as content proof, and a concurrent controller receives a lease wait.
- BS-20 and BS-21 accept a workstream reference and validate it against active
  control-plane projects/workstreams before using its internal Suit routing key.

The restricted runner also permits `bs-agent external-watch [1-25]`. A timer may
invoke it as a thin trigger, but PostgreSQL owns due-time, lease, backoff and
change-detection state. The watcher probes only the persisted dependency
and calls `task-supervise` when it becomes actionable; it does not invoke Codex
or own task lifecycle/retry behavior. No generated or running n8n workflow is
changed or activated by this interface.
