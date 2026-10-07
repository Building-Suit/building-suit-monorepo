# Automation Suit control plane

Automation Suit is a project-independent engineering control plane. PostgreSQL owns project, workstream, task, execution, retry, verification, publication, run, failure and audit state. The CLI and dashboard are operator clients. n8n is an optional trigger/notification adapter and is never required for resumption.

## Architecture

```text
Project registry
  └─ Workstreams (serialized stacks by default)
       └─ Tasks → executions → verification runs/checks → draft PR

Operator / n8n → generic CLI → database state machine
                              → Codex CLI (implementation/repair only)
                              → focused verifier
                              → Git/GitHub draft publication
```

Existing `control.suits`, task IDs, executions, checks, PRs and task events are retained. Building Suit has one registered project, and each Suit is mapped to a workstream. Compatibility commands continue through `bs-agent`; new automation should use `pnpm automation`.

Secrets are not registry fields. Database passwords, n8n API keys and Codex authentication remain in environment files or their native credential stores.

## Install or upgrade

Apply every migration under `tooling/control-plane/sql` in numeric order. Validate the complete chain in a disposable database before applying it to Staging, and validate there before Production. Control-plane migrations are additive and preserve operational history. Do not apply them to a product database; they belong to the dedicated control database.

Configure the runner with `AUTOMATION_CONTROL_DB_*` variables. Legacy `BS_CONTROL_DB_*` variables remain supported. `local_repository_root` and `worktree_root` may be relative to the control-plane checkout; absolute paths require explicit validation in project configuration. The dashboard keeps `NUXT_CONTROL_DATABASE_URL` read-only; set the separate server-only `NUXT_CONTROL_OPERATOR_DATABASE_URL` only when authenticated project/policy editing is required.

## Operator commands

```sh
pnpm automation project list
pnpm automation project show building-suit
pnpm automation project add project.json --dry-run
pnpm automation project add project.json
pnpm automation project disable example
pnpm automation workstream list building-suit

pnpm automation task create task.json
pnpm automation task list --project building-suit --workstream ledger-suit
pnpm automation task show V2-IMP-013
pnpm automation task next building-suit/ledger-suit
pnpm automation task claim building-suit/ledger-suit
pnpm automation task prepare V2-IMP-013
pnpm automation task preflight V2-IMP-013
pnpm automation task supervise V2-IMP-013
pnpm automation task run V2-IMP-013
pnpm automation task verify V2-IMP-013
pnpm automation task reverify V2-IMP-013 --reason "local database recovered"
pnpm automation task retry V2-IMP-013
pnpm automation task resume V2-IMP-013
pnpm automation task publish V2-IMP-013
pnpm automation task authorize-publication V2-IMP-013 --path packages/ui/src/Component.vue
pnpm automation task reparent V2-IMP-013 --to-current-parent --dry-run
pnpm automation task reparent V2-IMP-013 --to-current-parent
pnpm automation task cancel V2-IMP-013 --reason "superseded"
pnpm automation watcher run --limit 10

pnpm automation execution list V2-IMP-013
pnpm automation verification failures 123
pnpm automation error bundle V2-IMP-013
pnpm automation prompt chatgpt V2-IMP-013
pnpm automation prompt repair V2-IMP-013

pnpm automation policy list
pnpm automation policy create policy.json --dry-run
pnpm automation policy assign standard-five --scope task --target V2-IMP-013

pnpm automation run start building-suit/ledger-suit 5
pnpm automation run inspect RUN-UUID
pnpm automation run stop building-suit/ledger-suit
```

`task supervise` is the single lifecycle entry point for one already-claimed task. It reads the task, every execution and verification run, open failures, publication records, and the durable recovery condition before choosing an action. Before the first implementation execution, it also evaluates whether the live resolved parent already satisfies the task. This is an evidence gate, not an empty-diff shortcut: the task metadata must name a completed source task, the current acceptance-criteria digest, a reason, and optionally an exact verification run; that run must be passed with required checks passed, and its succeeded execution commit must be an ancestor of the resolved parent. An existing task execution, branch, remote branch, or PR disables parent satisfaction and returns control to normal lineage reconciliation. A proven result records the parent branch/SHA, verification evidence, reason, immutable evaluation, recovery decision, task event, and audit event before completing with no implementation execution or publication.

The metadata contract is `parent_satisfaction: { source_task_id, verification_run_id?, acceptance_criteria_digest, reason }`. The digest is the stable SHA-256 value produced by `acceptanceCriteriaDigest` in `runner/parent-satisfaction.mjs`; changing acceptance criteria invalidates prior evidence. Evaluation fingerprints include the resolved parent and evidence, so an unchanged replay is idempotent while a newly advanced parent is evaluated independently. Missing or failed evidence is not completion evidence and does not consume implementation retry budget.

Before every initial or retry implementation attempt, the supervisor runs the same deterministic readiness gate exposed by `task preflight`; no execution row is created and Codex is not invoked until that gate passes. A stable task resume identity and an atomic database lease prevent concurrent supervisors from duplicating implementation, verification, commits, or draft pull requests. The supervisor resumes at the first incomplete stage, records its heartbeat, classification, recovery action, and next wake condition, and stops explicitly for external, decision, operator, or safety conditions. Retry and repair decisions use the resolved retry-policy budget.

The execution preflight checks the expected control-database fingerprint, executable task state, hard dependencies, blocking decisions, workstream serialization, retry budget/profile, task contract and publication scope, required executables/dependencies/environment, and the fetched integration/parent/PR/worktree lineage. Its result reports the authoritative task, source, workstream, project, and effective publication boundaries. Workstream scope is always available to its task; cross-workstream source scope requires an explicit task `allowed_paths` grant inside the project boundary before the first implementation attempt. Source paths and files later modified by Codex are evidence, not authority. Configure the non-secret expected fingerprint as `AUTOMATION_CONTROL_DB_FINGERPRINT` (or as `environment_routing.control_database_fingerprint` in the project registry). The reported fingerprint is the SHA-256 digest of the live database identity fields returned by `task preflight`; configure an expected value only after independently verifying that identity. A mismatch safety-stops. Recoverable repository/runtime conditions use reconcile actions, unresolved decisions and external prerequisites use explicit waits, and unchanged results reuse one durable recovery event through the preflight fingerprint.

`task create` accepts top-level `allowed_paths`; it validates them against the project publication boundary and persists them as authoritative task scope. If publication later reaches `publication_scope_operator_wait`, `task authorize-publication` accepts repeated `--path` arguments only when they exactly equal the current waiting file set. The command rejects globs, protected areas, and paths outside the project boundary; merges the grant into existing task scope; audits old/new scope; resolves only the matching failure and recovery condition; and resumes at publication. Replays are idempotent. A successful implementation execution and its passed verification run are retained—authorization does not create another Codex attempt or reverify changed repository state.

The existing `run`, `verify`, `retry`, `publish`, `resume`, and diagnostic commands remain lower-level compatibility primitives. `resume` retains its prior engine behavior; new automation should invoke `supervise`. `reverify` creates a new verification run on the same succeeded execution. `reparent` refuses published branches, snapshots all task changes, moves the local task branch to the live parent, restores the snapshot with three-way conflict detection, and records metadata only after success. A conflict is left for human review with the snapshot path reported.

## Retry policy

```json
{
  "policy_id": "critical-five",
  "display_name": "Critical five",
  "max_attempts": 5,
  "attempt_profiles": ["standard", "standard", "deep", "deep", "deep"]
}
```

The profile count must exactly equal `max_attempts`. Allowed profiles are `fast`, `standard`, `deep`, and `review`. Resolution order is global → project → workstream → task, with the most specific assignment winning. The resolved policy snapshot, selected profile, dynamically discovered actual Codex model and reasoning effort are recorded on executions.

## Project registration

```json
{
  "slug": "example",
  "display_name": "Example",
  "repository_path": "owner/repository",
  "github_repository": "owner/repository",
  "integration_branch": "stg",
  "production_branch": "main",
  "local_repository_root": "../example",
  "worktree_root": ".local/worktrees",
  "default_model_profile": "standard",
  "retry_policy_id": "standard-five",
  "allowed_publication_paths": ["apps/", "packages/"],
  "verification_config": { "commands": [] },
  "local_database_strategy": { "type": "none" },
  "concurrency_policy": { "max_parallel": 2, "serialize_workstreams": true, "max_run_tasks": 20 },
  "codex_enabled": true,
  "active": false,
  "workstreams": [
    { "slug": "frontend", "display_name": "Frontend", "stack_key": "frontend", "application_path": "apps/web" }
  ]
}
```

Always dry-run and inspect before activation. Registry records must contain routing/configuration only, never credentials.

## Verification and recovery

Each verification run preserves its own evidence. Checks transition through `queued`, `running`, `pass`, `fail`, `skipped`, or `not_run` with timestamps, command, exit code, elapsed time, summary and log path. The verifier selects focused checks from changed files, the task plan and project/workstream configuration. Broad regression suites belong to explicit release/stack-acceptance tasks.

Normal recovery does not require SQL edits:

- succeeded implementation with no verification: `task verify` or `task resume`
- verifier/infrastructure failure: `task reverify` on the same execution
- passed task with failed publication: `task publish` or `task resume`
- moved parent: dry-run, then `task reparent`; reverify before publication
- implementation defect with attempts available: `task retry`

Every state-changing database operation emits task and/or generic audit evidence. Draft PR creation is the automatic publication boundary. Merge, deploy, hosted database mutation, shared-history rewriting and destructive worktree cleanup remain prohibited.

Verified implementation attempts that later produce no publishable diff still use the bounded historical no-change repair/review path. Existing `allow_no_change_completion` metadata remains readable for compatibility, but it is not parent-satisfaction evidence; automatic pre-implementation completion requires the evidence contract above.

Migration `018_failure_recovery_state.sql` provides the durable recovery contract consumed by `task supervise`. `control.failure_classes` and `control.recovery_actions` are the canonical vocabulary. `control.record_recovery_condition` stores the current task/execution/failure pointers, next action, recoverability, wake time, heartbeat and lease metadata under the stable `task:<task-id>` resume identity. Each distinct idempotency key advances the state version and appends an immutable recovery event plus a generic audit event; replaying the same key returns the recorded state without another write. `control.read_recovery_condition` resumes by identity, and `control.current_task_recovery_condition` reads the latest active condition for a task.

Migration `021_external_state_watcher.sql` adds the non-AI external watcher used by `watcher run`. Only active, recoverable, due external/reconciliation conditions with an explicit `condition.watch` descriptor are eligible. A claim uses `FOR UPDATE SKIP LOCKED` and a two-minute durable lease; expired leases are reclaimable after a crash. Each claim probes exactly one named dependency: an execution, hard-task prerequisite, workstream serialization condition, or one GitHub reachability/branch/pull-request/check condition. Unchanged observations advance `next_wake_at` with a 30-second-to-15-minute bounded backoff without adding recovery or audit events. Changed observations record the probe evidence, and actionable observations invoke `task-supervise`; the watcher never creates an execution, consumes retry budget, or calls Codex itself. Decision, operator, resolved, non-recoverable and safety-stop conditions are never eligible. The command processes at most 25 claims per invocation and stops after an actionable claim, so a failed supervisor wake cannot form an in-process tight loop. It is safe for a periodic system timer or the thin n8n controller to invoke; wake scheduling remains authoritative in PostgreSQL rather than in the caller.

## n8n inspection

```sh
pnpm automation:n8n:export
pnpm automation n8n inspect
pnpm automation:resilience
```

The exporter uses the n8n public API when `N8N_API_URL` and `N8N_API_KEY` are configured. Otherwise it uses the supported `n8n export:workflow` CLI inside `N8N_CONTAINER_NAME` (default `n8n`). It writes normalized JSON and a human-readable graph under ignored `.local/automation/n8n/`. It never reads or mutates n8n's internal database and never imports a workflow.

`automation:resilience` is the deterministic control-plane acceptance gate established by CP-RES-009 and extended by CP-RES-010. It exercises interruption boundaries across implementation, verification and publication; external waits and lease recovery; focused versus milestone verification; parent satisfaction and no-change handling; pre-implementation publication authority; exact-path authorization/resume; continuous-run stops; and repeated supervisor, watcher and publisher reconciliation. It also validates the generated BS-10, BS-20 and BS-21 replacements, their manifest digests and the immutable sanitized pre-cutover export digest. The command runs in check mode, reads only repository fixtures, makes no AI calls, and never contacts or mutates live n8n. Machine-readable and human-readable evidence live in `tooling/control-plane/resilience/reports/`; `cutover_ready` is true only when every mandatory scenario passes. Live activation remains a separate explicitly authorized operation.

## Dashboard

Automation Suit exposes `/`, `/projects`, `/tasks`, `/tasks/:id`, `/runs`, `/errors`, `/policies`, and `/n8n`. `/projects` provides a dry-run-first registration wizard with inactive-by-default saves and secret-key rejection; `/policies` validates the exact profile count before audited saves. These mutations require the optional operator connection. Task detail shows exact attempt/policy/model/reasoning, live verification status, process/Git paths, timeline, and state-aware commands plus copyable ChatGPT/Codex diagnostic prompts. Usage is shown as unavailable unless Codex supplies it; the UI does not estimate tokens.

## Sandbox validation

Apply migrations to a disposable database and run:

```sh
psql "$DISPOSABLE_CONTROL_DATABASE_URL" -f tooling/control-plane/tests/generic-platform-smoke.sql
psql "$DISPOSABLE_CONTROL_DATABASE_URL" -f tooling/control-plane/tests/recovery-state-smoke.sql
```

The transactions roll back after proving the existing lifecycle plus recovery taxonomy, create/update/resume behavior, idempotency, audit history and compatibility with existing evidence. Never point these fixtures at a hosted product database.

### Audited runtime authority and immutable installation

The remediation separates observer, executor, verifier, operator, migration-owner
and release-installer capabilities. Runtime logins cannot directly rewrite
control history, grant authority, change policies or mint trusted verification.
The verifier records receipt version 2 against the exact task, run, execution,
verification generation, registered command/version, source fingerprint and
artifact bytes. Unknown results require bounded investigation; they do not
consume a product retry. A later infrastructure observation does not erase an
already reviewed historical product charge.

BS-22 uses n8n's authenticated form trigger (2.6). Its signed-in actor is obtained
from the trigger's trusted user output, then sent through BS-23's dedicated
operator SSH capability. Ordinary SSH can read gates but cannot resolve them.
Offers bind their subject generation and expose typed approval, rejection and
revocation. Replays retain the original event. Consumed authority cannot be
revoked. Genuine exhausted product budgets remain on the same existing run at
an operator wait; a grant permits one review-profile execution without changing
the configured maximum. Incident grants similarly permit one actual model turn.
Process setup and authentication failures before a model turn consume no turn.

An external acknowledgement requires a passing version-2 result from the latest
verification and a registered external command in that run's frozen plan.
Acknowledgement never collects, invents or waives evidence. Publication still
validates the artifact bytes and source before consuming the acknowledgement.

Whole-bound admission resolves every remaining task before attempt one. The
categories are existing executable, task-owned output, external evidence and
unresolved configuration. Task-owned tests have explicit file paths and executable
registrations, and must actually exist and pass after implementation. Freezing a
registered cross-workstream prerequisite preserves its identity; it does not
complete or waive the dependency. Claiming still waits for actual completion.
`remaining-plan-review.mjs` prepares a proposal only and performs no database or
provider changes.

Every runtime component pins the same content-addressed release through one
`current` pointer. The business repository is resolved through
`BS_CONTROL_REPOSITORY_ROOT`, independently of immutable executable source.
Publisher PR validation passes the configured repository explicitly to
`check-pr.mjs <number> --repository <owner/name>`. Activation uses a serialized
compare-and-swap and complete readiness checks. Failure restores the pointer and
services; a failed first activation removes its new pointer and calls the
previous-service restoration callback.

The Linux event relay requires `stdbuf` alongside `psql` so piped query output
arrives immediately. Its observer connection listens for notifications and also
reads the persisted unconsumed wake-event watermark every five seconds. An
unchanged watermark makes no webhook or model call; missed notifications and
restarts can wake BS-31 from persisted state. Only the lifecycle executor consumes
events. The forced runner permits the exact `bs-agent recovery-watch` command;
extra arguments and shell operators remain forbidden.
The canonical BS-31 definition pins a stable webhook identity, registering
`/webhook/building-suit-dot-wake` across regeneration and import.

Schema adoption compares canonical and live object definitions, ownership,
privileges, policies, constraints, triggers and role capabilities. The append-only
baseline explicitly does not assert pre-ledger application order. Future control
migrations are exact-checksum, environment-bound, serialized transactions. A
published product migration file is never evidence of hosted application.

Disposable behavioral acceptance is available through
`node tooling/control-plane/tests/synthetic-runtime-e2e.mjs <absolute-evidence-directory>`.
The harness uses its explicitly disposable control PostgreSQL container, local
Git repositories and deterministic publication/model providers. It must not be
pointed at a business database. Its fault flags exercise actual runtime operations,
receipt loss, worker/publisher death, exact credit replay, trusted re-verification,
operator authority and bounded investigation. `--n8n-restart` additionally checks
persisted same-execution resumption on the isolated n8n fixture. The authenticated
form proof under `tests/fixtures/` runs only inside that disposable n8n instance and
keeps cookies and tokens out of its output. These fixtures do not authorize live
activation, product deployment, merge or provider mutation.

Initial CONTROL adoption uses `runner/control-adoption.mjs` inside one privileged,
environment-bound transaction. It validates every migration byte against the
immutable release, applies only the post-ledger-boundary migrations, compares
complete canonical/live schema snapshots, and checks preserved business-history
row counts and digests before recording provenance. A mismatch rolls back the
entire adoption. Versions 001–059 are historical schema snapshots; versions
060–091 are recorded as executed in this adoption transaction. Migration 090
also removes pre-ledger default grants to ordinary roles so they cannot leak
onto newly created functions, tables, or sequences. Default privileges are part
of the schema fingerprint. ACL comparison preserves each permission's grant
option and normalizes ordering and redundant owner privileges across PostgreSQL
17 and 18.

Migration 091 makes learned recovery evidence subject-specific: exact semantic
health and an independently executed regression are always required. A cause
that binds verification checks additionally requires registered v2 verifier
evidence before catalog reuse. Pre-verification infrastructure failures do not
require unrelated verifier evidence. Incident patches cannot replace the trusted
verifier, release installer, operator or credential boundary modules.

### Supervisor lifecycle protocol (`cp-lifecycle-v2`)

BS-20 validates and starts the original bounded run, then delegates to
`bs-agent run-supervise <run-id>`. The Supervisor owns claim, implementation,
verification, repair, publication, exact completion credit and next acquisition.
`run-recover` is a compatibility alias of this same entry point. BS-20 has no
independent acquire/credit loop. Verifier and Publisher retain their evidence,
source and authority boundaries. BS-22 retains all human authorization.

Migration 097 adds a private durable Supervisor inbox. Authoritative task,
execution, verification, publication, credit, dependency and operator changes
signal the affected existing run and frozen dependent runs. Claimed inbox
versions are acknowledged with a token; an older claim cannot acknowledge a
newer change. Expired claims can be reclaimed. The persistent Supervisor service
polls compact pending identities every five seconds, independently of webhooks
and Dot. In-flight operations use bounded wake times. Unknown, dependency and
human waits require an authoritative change. Graceful service shutdown releases
its claim; a crash leaves a bounded three-minute lease.

Dot is an outside watchdog. Healthy handoffs never dispatch ordinary work from
BS-31. Missing progress, dead receipts, inconsistent states and explicit incidents
may request a durable Supervisor wake or use the existing bounded incident owner.
Derived audits, recovery observations and classifications do not recursively
trigger the normal engine. Existing audit deduplication, local browser cache,
paginated history and compact database projections remain in use.

Failed generations use the common trusted classification adapter and an immutable
`lifecycle_failure_generations` record with a current pointer. UNKNOWN takes
precedence over stale legacy product verdicts. Only execution-bound reviewed
product evidence can authorize a product charge. Historical classifications are
preserved. Verifier recovery is reserved against task, run, execution, attempt,
source changes, plan, verifier implementation, configuration and failed-check
semantics. Poll timestamps, audit versions and new verification row IDs do not
grant another action. The original failed generation's input fingerprint survives
later reviews. A same-execution verification requires repaired inputs and can
run only once for that fingerprint; an unchanged result waits for actual repair.

Migration 102 converges recovery state when the current execution's newest trusted
failed-check reviews replace its failure classification. An incompatible prior
recovery generation is resolved in the audit history and preserved in the new
state; incompatible incidents and jobs are superseded. The transition emits one
durable Supervisor wake per evidence generation. Verifier infrastructure uses
`reverify`, with unchanged inputs blocked until the prerequisite is repaired.
For registered disposable local Supabase databases, a bounded, stable
`.local/verification-inputs/database-preparation.json` receipt binds the prepared
migration chain into verifier input identity. It does not change product source
or product-attempt accounting. Active owners and genuine authority gates retain
precedence.

Migrations 099–101 add bounded adoption of legacy recovery generations. On runtime
startup and before existing-run supervision, current failed tasks are revalidated
against their execution, latest verification, trusted evidence digest, lifecycle
protocol, runtime release and incident identity. Incompatible incidents/jobs are superseded through
audited transitions; their history, model invocations and operator grants remain.
Each distinct adoption context enqueues one durable Supervisor wake. Active
workers, stopped/held runs and current publication gates are preserved.

If a legacy failed verification has no registered trusted receipts, adoption
classifies that evidence debt as VERIFIER_INFRA and permits exactly one
same-execution verification to materialize receipts, with no product charge.
This exception is reserved atomically once per execution/protocol and cannot
repeat on 100 unchanged wakes. Subsequent verification uses the ordinary repaired
input guard and authoritative classifier. A legacy retry audit cannot override a
current canonical generation. New incidents bind their own identity and current
verification/evidence generation, so stale health evidence cannot confer authority.
Incident deduplication includes this lifecycle context; stamping a legacy incident
with a current protocol cannot preserve it across canonical adoption. A failed
legacy receipt cannot settle the new materialization runtime operation. Planned
skipped placeholders never overwrite later executed checks with immutable receipts;
conflicting executable outcomes fail closed.

Optional `verification_config.evidence_inputs` declares up to 32 independent
verification inputs under `.local/verification-inputs/`, relative to the task
worktree. Each must remain within the worktree and at most 64 KiB. Their content
hashes participate in recovery progress; missing files have an explicit null hash.
This declaration grants no product/publication authority and does not replace
executable whole-bound readiness or external evidence acknowledgement.

Actual Codex completion usage is stored with bounded durable receipts (up to 32
completion rows). Missing counts remain unavailable. Scheduler claims and healthy
monitoring produce no model usage. Unchanged completed incident inputs stop
before another model launch. Existing maximum-three/45-minute/two-no-progress
budgets remain ceilings, and an exact BS-22 extension authorizes one actual turn.

Automatic incident installation still requires a mandatory focused regression
and the complete control suite with zero failures or skips. Configure
`BS_CONTROL_INCIDENT_TEST_CONTAINER` with an explicitly disposable
`cp-remediation-disposable-YYYYMMDD` container. The trusted host creates an isolated
control test database and a container-only PostgreSQL driver; tests receive no
product/provider credentials. It drops only its own temporary database afterward.
Incident patches cannot alter this test-routing or lifecycle guard code. Runtime
activation restarts the Supervisor alongside health and event services.

Disposable proofs:

- `synthetic-runtime-e2e.mjs <evidence-directory> --supervisor-only` runs two real
  implementation/verifier/publication/credit tasks without Dot calls.
- `--supervisor-service` runs the persistent inbox consumer with no webhook and
  restarts it during the existing run.
- `supervisor-outbox-smoke.sql` verifies 100 unchanged recovery reservations,
  duplicate wake coalescing, claim races and a frozen cross-run dependency wake.

These fixtures do not authorize a live installation, business deployment or
human approval. Activation and business-run reconciliation require the current
user's authorization, immutable source provenance and provider identity checks.
