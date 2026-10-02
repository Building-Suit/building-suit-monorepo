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

The execution preflight checks the expected control-database fingerprint, executable task state, hard dependencies, blocking decisions, workstream serialization, retry budget/profile, task contract and publication scope, required executables/dependencies/environment, and the fetched integration/parent/PR/worktree lineage. Configure the non-secret expected fingerprint as `AUTOMATION_CONTROL_DB_FINGERPRINT` (or as `environment_routing.control_database_fingerprint` in the project registry). The reported fingerprint is the SHA-256 digest of the live database identity fields returned by `task preflight`; configure an expected value only after independently verifying that identity. A mismatch safety-stops. Recoverable repository/runtime conditions use reconcile actions, unresolved decisions and external prerequisites use explicit waits, and unchanged results reuse one durable recovery event through the preflight fingerprint.

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

`automation:resilience` is the deterministic CP-RES-009 acceptance gate. It exercises interruption boundaries across implementation, verification and publication; external waits and lease recovery; focused versus milestone verification; parent satisfaction and no-change handling; publication scope; continuous-run stops; and repeated supervisor, watcher and publisher reconciliation. It also validates the generated BS-10, BS-20 and BS-21 replacements, their manifest digests and the immutable sanitized pre-cutover export digest. The command runs in check mode, reads only repository fixtures, makes no AI calls, and never contacts or mutates live n8n. Machine-readable and human-readable evidence live in `tooling/control-plane/resilience/reports/`; `cutover_ready` is true only when every mandatory scenario passes. Live activation remains a separate explicitly authorized operation.

## Dashboard

Automation Suit exposes `/`, `/projects`, `/tasks`, `/tasks/:id`, `/runs`, `/errors`, `/policies`, and `/n8n`. `/projects` provides a dry-run-first registration wizard with inactive-by-default saves and secret-key rejection; `/policies` validates the exact profile count before audited saves. These mutations require the optional operator connection. Task detail shows exact attempt/policy/model/reasoning, live verification status, process/Git paths, timeline, and state-aware commands plus copyable ChatGPT/Codex diagnostic prompts. Usage is shown as unavailable unless Codex supplies it; the UI does not estimate tokens.

## Sandbox validation

Apply migrations to a disposable database and run:

```sh
psql "$DISPOSABLE_CONTROL_DATABASE_URL" -f tooling/control-plane/tests/generic-platform-smoke.sql
psql "$DISPOSABLE_CONTROL_DATABASE_URL" -f tooling/control-plane/tests/recovery-state-smoke.sql
```

The transactions roll back after proving the existing lifecycle plus recovery taxonomy, create/update/resume behavior, idempotency, audit history and compatibility with existing evidence. Never point these fixtures at a hosted product database.
