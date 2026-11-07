# First-install bridge: review proposals, not a live installation

This directory is deliberately outside `apps/company-hq/supabase/migrations`.
No SQL here is deployed by the release builder/updater. The approved phase-1
copy alone is now materialized as
`apps/company-hq/supabase/migrations/20261107022638_hq_worker_admission_fence.sql`;
its SHA256 is `61dafc8173d8d6613f99de19d3603846d5bbbd7d2e769e0bf9edc086f6d6f685`.
The 17 applied baseline entries remain unchanged; parity lists this forward file
as pending rather than asserting deployment. All six phase-2 proposals remain
outside active migrations. No provider integration,
credential, existing login, host, state directory or hosted setting is changed by
these source tests. The parent verified the Supabase GitHub integration for staging
`dpruoncalmwicrqhqelu`: this repository, branch `stg`, workdir `apps/company-hq`,
automatic deployment enabled. The parent owns deployment observation. The canonical migration includes the
initial pause of only the verified existing staging worker in the same transaction. There is no dedicated HQ database-deploy Actions workflow;
worker CI validates source and publishes code packages, and does not apply SQL.
Do not use connector SQL or another route to bypass the GitHub requirement.

The current legacy runtime is **not** a compatible contract-2 rollback baseline.
Its shutdown aborts active inference; its loop also recovers journals, syncs the
roster, publishes reviewed lessons, claims jobs and sends asynchronous presence.
A paused claim and zero working rows do not prove those operations settled.
Do not advertise zero interruption for first installation. The preparation tool
has no stop, start, activation, migration, pause/resume or timer-enable command.

## Reviewed deployment order, only after action-time approval

`migration-plan.json` binds seven proposals and their SHA256 digests to staging
project **dpruoncalmwicrqhqelu** and the preserved 17-source baseline. The first
proposal alone is the claim-fence phase. The other six belong to the later,
stopped-and-reconciled contract-2 transition. Never deploy the entire plan in one
batch while the legacy loop is running: its tier-less roster sync is accepted
by the pilot SQL and clears `model_tier` bindings. That incompatibility is now
covered by a disposable regression test.

1. Verify the staging ref/project and all 17 applied saved-SQL hashes again.
   Obtain a recovery point and review the exact old runtime privately. Keep the
   exported source private; hashes alone cannot replace reviewing its semantics.
2. In a separate reviewed source change, use the pinned CLI's
   `pnpm db company-hq migration new <reviewed-name>` to generate a new forward
   file for **only** `admission-pause.sql`. Do not rename/edit any applied source.
   Inspect the CLI help/version first. Review the actual target workflow and its
   environment binding with the provider-linking owner; no workflow is invented
   or enabled here. Dry-run the migration and extend the parity inventory only
   after the new migration is actually approved/applied and verified. A GitHub
   merge or provider link is not itself live SQL authorization.
3. The reviewed canonical phase-1 migration installs the fence **and its initial
   pause atomically**, for only worker `3ead9a59-d84b-4e95-9871-abba0b129404`.
   It fails if that worker is not enabled, if the sole registered worker differs,
   or if another registered worker exists. It preserves authorization/enabled and
   never asserts a zero-job drain. Deploy only via the verified GitHub `stg` →
   Supabase staging integration. The initial pause is not a separate connector or
   direct SQL/RPC write. Source approval does not prove provider deployment;
   the parent must observe that exact version/result and worker status.
   The migration commits immediately after its bounded DDL/pause. Never hold
   the queue lock while waiting for work: finish
   and heartbeat also need it. The mutation serializes on `hq-agent-queue` before
   locking the pause row, then applies generation CAS. An unchanged request retry
   is idempotent; a reused request with different arguments and stale generation
   fail. There is no expiry, crash unpause, credential revocation or worker disable.
   Worker status is `hq_worker_admission_status(p_worker_id)`; it returns only the
   caller's pause generation and count of **all** working rows, including expired
   leases. Claim overloads check the hold after the lock/auth recheck, before any
   cleanup or claim side effect. Only READ COMMITTED is supported; other isolation
   modes fail closed instead of trusting a stale transaction snapshot.
   A worker-specific transactional trigger also rejects new/replaced working
   leases, including from a pre-install function body still executing after
   replacement. Its exception rolls back the entire claim transaction. Existing
   same-worker/same-lease heartbeats and completed/failed transitions remain
   untouched. PostgreSQL table-writer serialization at trigger installation and
   an actual queued old-body replacement race are covered by the real PG tests.
   **Pre-guard request settlement still needs verification:** admission fencing
   does not prove a delayed old response, recovery, cleanup or publication has
   settled, nor can a post-hoc status manufacture that evidence.
4. Let already-admitted inference finish with lease renewal intact. Queue entries
   may accumulate; do not clear them. Independently settle inference and claim
   uncertainty. A child/process snapshot, elapsed 600-second job deadline, HTTP
   timeout, empty queue, lease expiry or `worker-stopped` log is insufficient.
5. Establish the explicitly approved maintenance boundary. Review the existing
   unit and a temporary main-process-only/no-force-deadline stop policy before
   any stop; `KillMode=mixed` and `TimeoutStopSec=infinity` cannot repair the old
   code's own active-controller abort. **Do not send SIGTERM while inference may
   still be active.** This source deliberately supplies no automatic legacy stop.
   If inference cannot be proven settled, defer. If interruption/reconciliation
   becomes unavoidable, state that concrete risk and obtain the maintenance
   decision before proceeding. Preserve the full old unit/drop-ins, entire
   runtime tree (unknown entries, links, metadata and hashes), worker environment,
   Codex cache/session and complete private state/journals in a protected,
   verified recovery copy. Never publish that backup or source export.
6. Once the unit is inactive and its cgroup empty, reconcile every claim/journal
   delivery, roster write, learning publication and outstanding presence request.
   A lost finish response requires reading the authoritative immutable result;
   a lost Drive PUT response requires marker/digest + ETag/version readback and
   its database publication receipt. Never rerun paid inference, invent a model
   receipt, mark a `started` journal delivered, clear a marker or erase a journal
   just to make readiness pass. Finish v2 compatibility must be used for legacy
   results before the transition, not a fabricated v3 model execution receipt.
7. Only after that reconciliation, generate **six new canonical forward files**
   in the order given by `migration-plan.json`: staffing needs, department
   orchestration, supervised trials, qualified research, model execution receipts,
   release capability. Preserve their source proposal bytes in review. Deploy
   through the explicitly approved staging path, verify app/schema semantics,
   worker authentication, RPC shapes, Realtime and the actual release contract.
   No database rollback is part of runtime rollback. Keep the claim hold active.

## Root-owned control preparation

The root updater must never execute a Node binary under an ubuntu-writable home
path. Historical `/home/ubuntu/.local/lib/node-v24.15.0-linux-x64/bin/node` is an
inspection fact, not a privileged installer input. The new examples use
`/opt/building-suit-hq-agent-control/bin/node` and `bin/gh`, fixed root-owned
binaries, `/usr/bin/python3`, `/usr/bin/systemctl` and a root-owned config.

On a trusted preparation machine, obtain a supported official Node distribution
and a current official `cli/cli` distribution supporting the updater's policy
flags. Independently verify their official release checksums/signatures and CLI
provenance, retain version/source/digest/verification evidence, and bind the
**extracted binaries** in a reviewed receipt. Generate public Sigstore roots with
an independently trusted official `gh attestation trusted-root`; retain its
provenance and root-rotation maintenance record. Never bootstrap trust from the
worker release's adjacent assets, an unsigned checksum alone or a root supplied
inside that package. No GitHub token/login is installed on Oracle.

Provision a protected root-owned directory containing `node`, `gh`,
`sigstore-trusted-root.json` and `verified-inputs.json`. The receipt is:

```json
{"format":1,"independentReview":true,"files":{"node":"SHA256","gh":"SHA256","sigstore-trusted-root.json":"SHA256","release.py":"SHA256","bootstrap.py":"SHA256","company-hq-worker.service.example":"SHA256","company-hq-worker-preflight.service.example":"SHA256","company-hq-worker-update.service.example":"SHA256","company-hq-worker-update.timer.example":"SHA256","updater-config.example.json":"SHA256"}}
```

Every value must be the reviewed actual file digest. Set no placeholder to true
without review. The receipt records that external review; it cannot prove its
own upstream authenticity. The reviewed source directory must also be root-owned
with non-writable ancestors. After approval, the exact preparation command is:

```sh
/usr/bin/python3 /path/to/reviewed/root-owned/bootstrap.py stage-controls --provisioned /path/to/root-owned/verified-inputs
```

It atomically creates a **new** `/opt/building-suit-hq-agent-control`, containing
fixed binaries, separate reviewed updater code, and **staged** config/units/roots.
It refuses overwrites, symlinked/tampered inputs and writable/non-root trust paths.
It does not install anything into `/etc`, touch the old runtime, run a downloaded
binary, reload systemd, access a DB, or start/enable a service. On interruption
before rename it leaves no active control directory. If the directory already
exists, inspect it; never delete it automatically to retry.

After the maintenance/reconciliation and schema phases, the operator must
separately install the staged config into `/etc/building-suit-hq/updater.json`
(mode 0600), public roots into `sigstore-trusted-root.json` (0644), make the
runtime root and all privileged descendants root-owned/non-writable by ubuntu,
and install the reviewed systemd units as root-owned 0644. Preserve ubuntu's
private state ownership and existing environment/Codex cache. Do not recursively
chown home, credentials or journals. The updater service runs a read-only trust
path audit before executing its privileged code:

```sh
/usr/bin/python3 /opt/building-suit-hq-agent-control/bootstrap.py audit --config /etc/building-suit-hq/updater.json
```

The audit rejects user-home executables and worker-writable ancestors. Worker and
preflight still run as ubuntu with the existing protected EnvironmentFile. The
worker uses managed paused startup, `KillMode=mixed`, `TimeoutStopSec=infinity`;
preflight cannot claim/recover/publish. The updater remains root-owned separate
code: a worker package can never replace it. Its timer stays disabled.

## First managed baseline and acceptance

1. Review the real cutover record using `cutover-record.example.json`; defaults
   deliberately fail. `bootstrap.py check-cutover-record RECORD.json` checks
   completeness only, **not** fresh live truth. Do not use it as a synthetic
   readiness status. Keep supporting records private, with observation timestamps,
   host/unit identity, exact release SHA and the worker-bound pause generation.
2. Independently verify the signed public package for the chosen exact stg SHA
   using the real updater provenance policy, empty GH_TOKEN/GITHUB_TOKEN and an
   isolated GH_CONFIG_DIR. Validate/import-smoke the extracted five-file bundle.
   Do not copy private environment/auth/source exports into it.
3. Under the stopped legacy boundary, stage the complete first managed release
   and manifest in `releases/SHA`, then establish root-controlled `candidate` and
   `current` links with the reviewed operator procedure. Preserve the old runtime
   backup separately: it is a recovery artifact, **not** a contract-2 rollback.
   Run the fixed preflight, then managed paused startup. Require observed startup,
   exact PID/release, authenticated contract-2 status, connected private queue,
   busy=0 and activeJobs=0. `systemctl is-active` alone is insufficient.
4. If first startup fails, keep admission fenced and timer disabled, preserve
   diagnostics, stop only the never-admitted managed candidate safely and repair
   forward. Do not automatically restart legacy against the changed schema or
   roll back the DB. Do not resume while legacy journals/publications are pending.
5. After actual managed health acceptance, resume the local gate under observation
   while the database hold still prevents claims; verify preserved state and a
   healthy no-op/manual updater invocation. Only then prepare a reviewed GitHub forward migration to compare-and-resume
   database admission using the **currently observed** generation and a fresh
   request UUID, with that action's approval. Do not use a direct SQL connector
   or another route outside GitHub. Do not use generation zero,
   expire the hold, reuse an old resume decision, or let the timer clear it.
6. Admit only the approved staging acceptance workload. Prove successful delivery,
   model receipts and a subsequent safe maintenance drain with no replay. Retain
   the complete accepted managed release as the first genuine rollback baseline.
   A real host rollback drill requires a second distinct verified compatible
   managed release and a reviewed, never-admitted failing candidate procedure;
   disposable test results cannot stand in for that host acceptance. Keep the
   timer disabled until this and restart/interruption recovery criteria pass.
7. Only after those observations may the operator approve/install and enable
   `company-hq-worker-update.timer`. The automatic updater thereafter uses its
   tested drain/health/rollback protocol. It never deploys SQL or promotes main.

## Minimal private observations needed at action time

- Fresh staging project identity, migration versions/saved-SQL digests and exact
  claim function hash; per-run opaque worker label, enabled status, admission generation/request
  result and own working-job counts/coarse status/lease validity booleans. Keep IDs, tokens/lease tokens,
  passwords, prompts, replies and personal data out of the transcript.
- Time-bounded unit MainPID/ControlPID, state/result, cgroup membership, actual
  provider process/session completion and fixed outcome codes. Absence at one
  moment is not a proof; correlate with each authoritative job outcome.
- For each journal: per-run opaque label, version/phase, matching result-digest
  boolean and authoritative finish-receipt boolean. Correlate real IDs locally;
  export no journal path, job ID, lease token or reply.
- Roster synchronization completion/source digest and binding state; pending
  lesson counts/opaque labels and marker/readback-match/receipt booleans. Keep
  actual private lesson IDs, document paths, ETags and document contents local. Private contents stay private. No marker clearing.
- Full backup inventory/digests/ownership/modes and restore check; root trust
  paths and binary versions/provenance; exact release/manifest/attestation digest;
  real preflight, health, paused admission, recovery and rollback observations.

## Proposed action-time approval wording

**Phase-1 wording retained as approved history; do not ask again:** “May I deploy the reviewed
worker-admission fence to staging `dpruoncalmwicrqhqelu` and pause new claims for
the existing Oracle worker, while keeping heartbeat and completion enabled? I
will leave current work running and will not stop the worker, deploy the pilot
schema, install the updater or enable its timer in this step.”

**Later maintenance approval, only with the concrete evidence ready:** “May I
perform the reviewed staging maintenance cutover on the existing Oracle worker:
back up its complete runtime/private state, stop it only after active inference
is settled, reconcile outstanding claims/results/lesson publication, apply the
six reviewed contract-2 migrations, install root-owned verified binaries/trust
and paused systemd configuration, and test the first managed release? If any
outcome remains uncertain I will keep admission paused and the timer disabled.
The legacy runtime cannot be treated as a compatible rollback after the schema
change. No production or credential changes are included.”

Timer enablement is a later concrete acceptance decision, not implicit in either
question. Parent retains the source-export and provider-linking approvals.

`bootstrap.py summarize-records RECORD.json` accepts only the strict redacted
boolean metadata schema documented in its source. It emits counts and booleans,
never source values or IDs. Delayed/cancelled claims, a finish commit without
journal acknowledgment and a Drive write without its DB receipt all remain
unsettled. `mayActivate` is always false: even complete observations still need
the approved operator boundary. The helper performs no host/DB/network read or
write, and cannot retrospectively prove legacy execution completion.

## Phase-1 materialization completed

The maintained command was executed with pinned pnpm 10.33.0 / Supabase 2.116.0:

```sh
SUPABASE_HOME=/tmp/hq-bootstrap-supabase-home XDG_CACHE_HOME=/tmp/hq-bootstrap-cache XDG_CONFIG_HOME=/tmp/hq-bootstrap-config pnpm db company-hq migration new hq_worker_admission_fence
```

The CLI generated version `20261107022638`; its file composes the exact tested fence proposal (with one transaction
wrapper) and `initial-staging-pause.sql`, scoped to the verified worker UUID.
Wrong target identity or extra registered workers abort the entire transaction. The parity verifier checks that
exact composition equality, pins the reviewed hashes, preserves the 17 historic applied entries and
rejects any other pending active migration. The PostgreSQL race suite now applies
the canonical file directly. This source materialization is not evidence that
Supabase deployed it or that a worker was paused. Observe the provider result following the reviewed staging merge; the initial
pause is part of that migration, not a separate connector/RPC write.

The canonical initial pause was explicitly owner-approved and must deploy only
through the verified GitHub/stg provider route. No standalone SQL/RPC pause is
performed by this coding task. The migration takes queue → jobs → worker-registry
locks before any DDL. PostgreSQL 17 lock/statement/transaction timeouts of 1/5/8
seconds bound only the migration and defer a busy installation; worker sessions
are not canceled. Real installation races cover an existing queue holder and the
actual legacy heartbeat paused between its jobs and registry writes. New leases
are fenced at commit; current-job heartbeat and finish remain enabled.
