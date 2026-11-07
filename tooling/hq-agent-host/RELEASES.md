# HQ staging worker releases — source implementation

Nothing here is installed or activated on Oracle. These files implement an
outbound HTTPS updater for the existing worker, with no Git checkout, package
manager, persistent GitHub token, SSH listener or new model service on the host.
Production is excluded. The private release catalog remains separate.

## Build and trust boundary

`ci.yml` builds only after the existing `verify` job succeeds on a `push` to
`refs/heads/stg`. That job already depends on `review` and branch policy admission.
Review also runs the full disposable host/PGlite and Python release suites.
The release job checks out **exact `github.sha`**, runs maintenance and updater
regressions, then builds committed source using `git show SHA:path`. It creates
`hq-worker-stg-SHA` as a draft, uploads both assets without clobbering, downloads
them for exact package-byte and provenance verification, and only then publishes
the staging prerelease. Existing releases are not successful merely because the
tag exists: target/tag SHA, staging-prerelease state, exact two-asset inventory,
package bytes and signed bundle must all match. A complete verified draft can be
published on rerun; a complete published release is a verified no-op. A partial,
conflicting or incorrectly signed release fails clearly without replacing assets.
Failed uploads remain drafts; an operator must review a partial draft or use a
new reviewed SHA. No automatic deletion or overwrite repairs unknown state. It needs no workflow on
`main` and uses no `workflow_run`, hosted worker credentials or environment files.
A failed/cancelled required validation produces no worker release. Since `stg`
is currently unprotected, this explicit dependency is necessary; repository
settings are not changed by this implementation.

`worker.json` is a bounded JSON envelope, not a tarball. Its exact five-module allowlist is
`worker.mjs`, `workforceRoster.mjs`, `brainPublisher.mjs`, `maintenance.mjs`,
`departmentWorkflow.mjs` and a
manifest containing their byte counts/hashes, exact SHA and contract versions.
Downloads and redirects are restricted to HTTPS on the fixed GitHub/API and
GitHub release-asset domains. The builder also extracts precisely those modules and smoke-imports the worker
without CLI startup, service credentials, inherited configuration or network
access. Resolution is restricted to the extracted package and Node builtins.
A future static import missing from the allowlist fails the build before signing.
The allowlist must be deliberately reconciled whenever runtime imports change.
The decoder rejects duplicate keys, unknown fields, extra/path-like file names,
wrong SHA/ref/contract and modified bytes. It never interprets commands from the
manifest. Extraction writes fixed names into a fresh staging directory, flushes
files/directories and renames into an immutable SHA directory. No symlinks,
archive metadata, executable install hooks, `.env`, Codex/Google auth, journals,
Brain contents or database dumps are packaged.

GitHub OIDC signs the whole envelope using `actions/attest`. The host uses a
separately installed current GitHub CLI to verify its downloaded bundle against
**independently installed** Sigstore roots, exact signer workflow
`Building-Suit/building-suit-monorepo/.github/workflows/ci.yml`, exact certificate
identity ending `@refs/heads/stg`, source SHA/ref, SLSA provenance type and GitHub
hosted runner policy. It also compares the verified certificate's immutable
`sourceRepositoryIdentifier` to **1376504404**, independently read from the
repository API on 6 November 2026. A renamed/recreated repository with the same
name cannot pass that check. Bundle, manifest and checksum alone confer no trust.
Verification runs with empty `GH_TOKEN`/`GITHUB_TOKEN` and an isolated CLI config.

The artifact bytes are cryptographically bound to their source SHA; even if an
administrator replaces a release asset/tag, different bytes cannot pass this
policy without a new valid attestation from the trusted workflow/source. This
workflow never edits an existing release. GitHub account/workflow integrity,
review of changes to this builder/workflow, the operator's root-owned updater,
CLI and trust roots, local service identity and HTTPS CA trust remain assumptions.
This source does not claim to install GitHub immutable-release settings or branch
protection. Public Actions/releases currently fit the requested no-added-service
cost design; quota/pricing changes and worker subscription limits remain external.

References: [GitHub offline verification](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/verify-attestations-offline),
[CLI verification policy flags](https://cli.github.com/manual/gh_attestation_verify),
[artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations).

## Installation blockers that source tests do not remove

The legacy installed worker has no maintenance gate, no proven complete release
manifest/rollback baseline, and no verified producer/claim pause procedure. Its
lack of a visible Codex child or active queue item cannot rule out an in-flight
claim. There is also no evidence that the proposed `hq_worker_release_status`
capability has been deployed. These are **real installation blockers**. This
updater must not be activated until all are independently resolved under separate
operator approval. It deliberately provides no automatic legacy SIGTERM bootstrap.

The packaged runtime is reconciled from department pilot commit
`116477e5e63495efc6702e8d6a745d3e053310d4`; see `INTEGRATION.md`. It preserves
qualification/trial gates, head routing, model evidence and bounded fallback.
It is **not** a verified replacement for an unknown installed/pilot baseline.
Contract 2 requires the five pilot SQL proposals plus the read-only capability.
Those SQL files are stored only under `proposed-migrations/`, outside the active
17-migration chain, and none are packaged or deployed. A contract-1-to-2 transition
is a coordinated schema/app/runtime bootstrap decision, not an automatic upgrade
or proven legacy rollback path. Automatic updates require a complete known
contract-2 baseline compatible with the same deployed contract.

## One-time operator-reviewed setup — requires separate host approval

Do not run these steps as part of repository implementation or CI. The actual
host, permissions, unit and binaries must be inspected by its authorized operator.
Historical paths in the examples are context, not proof of the current machine.

1. Review and integrate this source through the existing HQ stack into `stg`;
   wait for the exact staging SHA's required validation and signed release. No
   promotion to `main` is required. No PR is opened by this task.
2. Verify the existing service identity, authorized Node executable, Codex login
   location, private environment and persistent delivery-journal path. Preserve
   those files and current worker identity. Do not copy credentials to GitHub or
   this repository. Require staging URL `dpruoncalmwicrqhqelu.supabase.co`; the
   candidate preflight explicitly rejects production.
3. Establish a **complete rollback baseline**. Historical installed file hashes
   or a single saved `worker.mjs` do not qualify. Inventory and independently
   review all runtime imports and source bytes. Archive the full previous install
   outside automated release directories. Before stopping or replacing the legacy
   worker, establish an approved producer/claim pause or another verified
   host-specific quiescence procedure that closes the claim-in-flight race.
   Preserve the unknown-current complete installation before switching. If no
   such procedure exists, bootstrap is blocked; obtain a separately reviewed
   server/host capability rather than using SIGTERM as a drain. After that
   quiescence proof and explicit maintenance approval, install a reviewed release supporting maintenance
   protocol 1, verify all five files against its manifest, and prove a paused
   startup, read-only health acceptance, safe drain and rollback before enabling
   automatic operation. An old worker lacking this protocol needs a manual,
   reconciled bootstrap; do not let the updater stop it based on child-count or
   `is-active`. The updater intentionally has **no bootstrap bypass**.
4. Prepare root-owned, non-worker-writable directories:
   `/opt/building-suit-hq-agent-host/{releases,updater}` and
   `/etc/building-suit-hq`. The host user must be able to traverse/read release
   source (directories `0755`, runtime/manifest `0644`) but cannot modify it.
   Do not rely on `mkdir(mode=0755)` under the required `umask 077`.
   The one-time reviewed root installer must explicitly finalize the public
   `releases/` directory after creation:

   ```sh
   mkdir -p /opt/building-suit-hq-agent-host/releases
   chmod 0755 /opt/building-suit-hq-agent-host/releases
   ```

   Preserve root ownership; do not use recursive chmod or widen private inputs,
   credentials, state, updater transaction files or backups. `stage()` now
   explicitly finalizes `releases/` and each verified SHA directory as `0755`,
   including an idempotent existing-content path after integrity validation.
   Install reviewed `release.py` into `updater/` separately; releases never
   self-update this privileged program. Install a reviewed current official `gh`
   supporting all policy flags and Python 3.10+ at fixed absolute paths. Verify
   CLI provenance independently. No Git or pnpm is needed on Oracle.
5. Generate Sigstore trusted roots on a trusted online workstation using the
   official CLI's `gh attestation trusted-root`; review and transfer only that
   public trust material into root-owned `sigstore-trusted-root.json`. Never
   accept trust roots from a release package. Verify a real public release bundle
   with empty tokens and an empty `GH_CONFIG_DIR`. Root rotation/revocation needs
   reviewed periodic maintenance; stale roots must fail closed, never disable
   certificate/TLS checks. No GitHub login/token is installed on Oracle.
6. Install the complete validated baseline as `releases/SHA/` with its
   `manifest.json`, and atomically establish `current -> releases/SHA`.
   The updater revalidates baseline files before any upgrade and refuses an
   incomplete/modified/symlinked baseline. Retain old SHA directories; no automatic
   garbage collection removes rollback evidence.
7. Review database compatibility **before** approving `schemaContract: 2` in the
   root-owned updater config. `database-release-contract.sql` is an additive,
   guarded read-only capability proposal outside the active migration chain.
   Generate a new canonical forward migration through the repository CLI only
   after separate approval, review/test it against the real staging schema,
   deliberately extend the source parity inventory for that new migration, then
   deploy it through the existing authorized DB workflow. Never edit the 17
   applied sources, run this SQL from the updater, or silently change a live DB.
   The new worker requires this server capability; its absence blocks updates. Preserve the existing 17 applied migration source
   hashes and archive unchanged. Both releases must continue to use the same
   queue/lease/journal semantics, `hq_worker_finish_v3` with `p_model_evidence`, three-argument meeting
   claim protocol 1 and additive roster/learning APIs. Future DB changes must be
   explicit, additive and independently deployed/tested for both versions. This
   release path never runs SQL or migrations. API-shape checks cannot prove
   behavioral compatibility of an altered SQL body: do not retain contract 2 for
   a breaking semantic change. Such a change requires a separately reviewed
   deployment/rollback plan and updater-contract change; it must fail closed here.
8. Adapt the example config and three services/timer to actual inspected paths.
   `company-hq-worker-preflight.service` uses the same OS identity/environment as
   the worker and runs only fixed `candidate/worker.mjs --release-preflight`.
   `candidate` is a root-controlled link to already verified staged source.
   Its checks authenticate and read API metadata plus the scoped release capability; they do not
   claim jobs, renew leases, sync roster, recover journals or publish lessons.
   A disabled PostgREST OpenAPI endpoint fails closed and needs an explicit
   operator decision, not an automatic settings change.
9. Adapt `company-hq-worker.service` to `current/worker.mjs`,
   `HQ_RELEASE_MANAGED=1`, the preserved state directory, `KillMode=mixed` and
   `TimeoutStopSec=infinity`. SIGTERM must target the worker alone and let it
   settle; a control-group SIGTERM could terminate its inference child. Do not
   configure a forced stop deadline that kills paid work. Worker startup always
   pauses admission until updater acceptance. Keep only one worker per identity.
10. Verify a manual updater invocation, no-op, rollback and ordinary worker reboot
    recovery using reviewed host acceptance before the operator explicitly
    enables `company-hq-worker-update.timer`. No timer/unit is installed, enabled
    or started by source tests. Confirm the operator-approved baseline and health
    first. Preserve external configuration, Codex cache and journals across every
    activation and rollback.

## Automatic operation after approved setup

A new unrelated `stg` SHA deliberately gets its own provenanced package and
may cause a bounded drain/restart even if module hashes are unchanged. Content
hash deduplication is not implemented; it must not weaken exact-source identity
or the required freshness fences.

The timer checks at boot and roughly every five minutes, with jitter. It first
recovers any durable transaction without needing a network download. An ordinary
paused worker restart is accepted/resumed from its validated baseline before
release discovery, so an unavailable new release cannot strand that baseline.
It discovers the **current `stg` SHA** over HTTPS and downloads only that SHA's
public release and signature bundle. A missing release/check failure/network
failure defers; it never selects arbitrary `latest` or falls back to a branch
archive. Public API rate limits defer without adding a credential.

One kernel `flock` covers recovery, baseline acceptance, current repository/ref
lookup, download, signature verification and installation. A competing invocation
fails before discovery rather than retaining a stale decision to install later.
There is no recursive lock acquisition. Recovery runs before GitHub requests, so
GitHub outages do not prevent rollback/recovery; normal DB health is still needed
before admitting jobs. Repository discovery also checks the fixed numeric ID.
The updater checks `stg` again after verification/preflight, after drain, after
stop immediately before activation, and after health before acceptance. An
observed moved head defers or rolls back the never-admitted candidate, without
stopping busy work. It never installs a previously downloaded SHA merely because
it was once current. These are observed remote-ref fences, not a distributed
transaction locking GitHub: a subsequent ref move is handled by the next run. After
provenance and package verification, the updater validates the full old release,
stages the candidate and runs the read-only candidate preflight before requesting
any drain. The approved old/new schema contracts and the server-declared contract must match.

The worker exposes only a private Unix-domain control socket under its existing
private state directory. Receipts bind protocol, PID (checked against systemd
MainPID), exact release SHA, readiness, pause, busy count and uncertainty. Health
requires a real authenticated read-only server contract/API shape check plus observed
private Realtime join **and replication readiness**. `systemctl is-active` alone
is never accepted. Health also requires zero server-side working jobs for this
worker, including expired but unreconciled leases; local idle alone is insufficient.
Health establishes queue/database readiness, not successful
paid inference, Brain write qualification or an end-to-end founder reply.

Drain pauses admission synchronously. It covers the entire serialized recovery,
roster, claim, work, journal/delivery and lesson-publication scope, plus presence
writes. An already-started claim completes; if it returned a job the worker
finishes it and delivery before acknowledging idle. Lease renewal/auth refresh
continue while draining. Outstanding renewal settles before work leaves its busy
scope. There is no inference cancellation in the update path. A 15-minute drain
bound defers the update with the old process alive; it does not force termination.
The prepared transaction remains for the next timer to safely settle/resume the
old worker. It can still finish active work while paused.

Before the full queue loop starts any side effect, a durable `maintenance-inflight`
intent is fsynced. It is removed only after the complete scope settles; an
uncontrolled process loss, even before a claim response/job journal, therefore
blocks automatic admission after restart. A normal settled stop leaves no intent.
Any uncertain claim, journal, delivery or publication outcome also persists
`maintenance-uncertain` in the worker state and blocks admission and upgrades,
including after restart. The operator must reconcile actual DB leases/jobs,
journals and possible publication receipts before clearing these markers. Never
blindly retry inference, delete journals or clear a marker to force an update.

Only after safe idle does the updater stop the old service, atomically swap
`current`, start the candidate **paused**, and observe real health. A failed
startup returns to the exact old validated SHA, starts it paused, observes its
health, and resumes it. The DB is never rolled back. A candidate cannot claim or
publish before acceptance, so health rollback cannot kill candidate-paid work.

`transaction.json` is atomically written/fsynced through prepared, stopped,
activated, accepted or rollback-accepted. A crash before acceptance recovers the
old release; the updater stops that never-admitted candidate unit even if its
socket is absent, suppressing a systemd restart race. If database health is lost,
a PID-bound local paused/idle/non-uncertain receipt can still permit returning
to the baseline; admission still requires healthy contract/zero-job evidence.
 a crash after durable acceptance **never stops** the accepted worker,
which may have begun paid work. A failed resume is retried through accepted-state
recovery instead of triggering rollback. Recovery refuses uncertain/busy worker
states rather than killing them. A rollback whose baseline health also fails
remains paused for operator investigation; it never runs a DB rollback.

The old module-only implementation of `upgrade-meeting-worker.sh` remains in
Git history. Its current entrypoint is deliberately disabled and changes no
files/services: child-count and unit-active checks cannot establish safe drain
or health. This prevents the unsafe legacy helper from bypassing bootstrap.

## Disposable verification

Run from the repository root with the pinned pnpm/Node versions:

```sh
node --test --test-concurrency=2 tooling/hq-agent-host/*.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tooling/hq-agent-host -p '*_test.py' -v
node apps/company-hq/supabase/verify-staging-migration-parity.mjs
pnpm exec eslint tooling/hq-agent-host/*.mjs
pnpm release:check
pnpm check
pnpm typecheck --concurrency=2
pnpm test
```

Host tests use disposable local files/PGlite, fake systemd, fake HTTP/WebSocket
and mocked CLI invocation. Lifecycle tests run the actual worker process and
Unix socket with transports replaced; they never authenticate to a hosted system
or run a live model/job. Release tests exercise immutable source building,
validation, provenance policy, tamper/traversal, concurrency, no-op, compatibility,
drain timeout, startup rollback and crash recovery. See `VERIFICATION.md` for the
actual results/limits from this task. Installing or testing on the live host,
enabling the timer, applying DB changes and reviewing real paid-work behavior
remain separate operator actions requiring approval.

Trial CLI preflight reads the version only from stdout. Incidental stderr is
discarded, while both streams share the unchanged 1,024-byte total limit.
Nonzero exit, malformed/oversized stdout, stderr-only versions, unsupported
versions, timeout and cancellation still fail closed before App Server launch.
The same executable digest and resolved model/effort evidence remain required.

Task acknowledgments explicitly request one JSON object, an at-most-8,000-byte
UTF-8 message and the exact recipient mention when delegation is non-null.
The worker checks this structure against the server-issued roster before
journaling a result; the database remains the final authorization boundary.
Invalid output blocks once without another inference attempt or truncation.
Delivered journals retain only an allowlisted `outputDiagnostic` code while
clearing reply/error/evidence as before. Older journals without that field stay
compatible; a historical generic error cannot identify a deleted reply's clause.

## First installation bridge proposals

Supervised trial context uses `trialAssignment` version 1. A forward migration
adds the exact hire profile and selected skill to scoping and review claims,
alongside the actor's own authorized role sources. The packet keeps the original
task, full completed head assignments and rejected review findings across
acknowledgments and both correction paths. It carries indexed source revisions
and the existing complete binding digest; stale/out-of-scope sources fail the
claim transaction. No historical result or qualification is rewritten.

At most three assignments and three rejected reviews fit in a 96 KiB packet;
the existing 18-file, 240 KiB context and host document/context bounds remain.
Capacity failure is explicit, never a truncated fixture. Fixed cases remain
authored in canonical profile/skill sources; the worker must not substitute
invented cases or use an acknowledgment in place of the full assignment.
Independent review, the two-repair limit and blocked trial learning are unchanged.
Deploy SQL through the native staging GitHub route and verify the corresponding
signed runtime before any affected trial retry. This source patch neither
clarifies canonical case content nor authorizes a retry or lifecycle change.

See [bootstrap/README.md](bootstrap/README.md) for the worker-specific admission fence, separate maintenance/reconciliation boundary, reviewed migration order, root-owned control preparation and action-time approval wording. `bootstrap.py` prepares controls and audits trust paths; it deliberately cannot stop legacy, activate a release, deploy SQL or enable the timer. The current legacy runtime is not a contract-2 rollback baseline. Root updater Node/gh binaries must use the root-owned control directory, never the historical ubuntu-writable home executable.

The worker and candidate preflight unit examples both require Node's
`--preserve-symlinks-main` flag. Their signed runtime main guard otherwise skips
execution through release links and can falsely return zero for preflight.
Retain the fixed flag when installing units; verify actual contract output and
observed paused managed health before acceptance. See bootstrap/ACTIVATION.md.


## Authenticated compatibility proof

Publishable-key workers must not depend on privileged OpenAPI discovery. The
existing authenticated read-only `hq_worker_release_status` now provides `api`
version 1: exact required RPC argument lists, authenticated role, schema usage
and execute checks. The server pins full input types, JSONB returns and ordinary
non-set function shape; existing enabled-worker/non-founder/live-session and
semantic contract checks remain. The worker validates the entire proof and
capability versions before preflight success, readiness or managed acceptance.
Missing RPC/argument/grant/capability fails closed without claiming jobs.
The additive forward migration never changes admission or authorization. A new
signed worker is required; root-control code/trust/configuration are unchanged
by this compatibility change. Real bootstrap/rollback acceptance is still held.

The catalog proof also checks the fixed public invoker wrappers' corresponding
private entry signatures/EXECUTE grants, without granting anything or walking an
arbitrary call graph. Competing public overloads are rejected only when their
required/default input names accept the actual worker JSON key set. Different
names, extra required arguments and unnamed JSON fallbacks do not compete with
the intended named match. This follows PostgREST's named-parameter dispatch:
[planner source](https://github.com/PostgREST/postgrest/blob/v14.11/src/PostgREST/Plan.hs#L219-L268).


## Complete roster profile reads

Roster configuration reads each complete canonical profile individually through
the existing Brain reader and one shared abort signal. A complete roster may
exceed a single inference context; this does not raise the 128,000-byte document
or 250,000-byte per-call/inference limits. Root ancestry, before/after revisions,
profile identity, manager, model tier and assigned-skill validation remain intact.
All profiles are assembled and validated before the single roster-sync RPC.
An oversized source or cancellation prevents that commit; no document is
truncated and no partial roster is published. A new signed worker and actual
managed roster acceptance are required; admission remains held until accepted.


Assigned-skill parsing distinguishes only explicitly labelled non-assignment
governance paragraphs from actual assignments; unmarked or mixed assignment
blocks retain strict department checks. Generic-label Drive links count only in
explicit numbered SK-ID declarations and must uniquely resolve to a non-folder
canonical Skills file in the employee's department. Canonical path labels must
agree with the referenced file ID. Prose and license links add no assignments;
exact IDs deduplicate and the existing one-to-ten limit remains. These rules do
not grant qualification or authorize profile-supplied URLs as network targets.
