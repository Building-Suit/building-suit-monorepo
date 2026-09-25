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

Apply the existing migrations in numeric order to Staging, then `tooling/control-plane/sql/014_generic_automation_platform.sql`. Validate there before Production. The migration only adds/backfills objects and does not delete history. Do not apply it to a product database; it belongs to the dedicated control database.

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
pnpm automation task run V2-IMP-013
pnpm automation task verify V2-IMP-013
pnpm automation task reverify V2-IMP-013 --reason "local database recovered"
pnpm automation task retry V2-IMP-013
pnpm automation task resume V2-IMP-013
pnpm automation task publish V2-IMP-013
pnpm automation task reparent V2-IMP-013 --to-current-parent --dry-run
pnpm automation task reparent V2-IMP-013 --to-current-parent
pnpm automation task cancel V2-IMP-013 --reason "superseded"

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

`resume` inspects database state. It never creates an attempt when a succeeded execution only needs verification, and it publishes a passed task without re-running Codex. `reverify` creates a new verification run on the same succeeded execution. `reparent` refuses published branches, snapshots all task changes, moves the local task branch to the live parent, restores the snapshot with three-way conflict detection, and records metadata only after success. A conflict is left for human review with the snapshot path reported.

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

## n8n inspection

```sh
pnpm automation:n8n:export
pnpm automation n8n inspect
```

The exporter uses the n8n public API when `N8N_API_URL` and `N8N_API_KEY` are configured. Otherwise it uses the supported `n8n export:workflow` CLI inside `N8N_CONTAINER_NAME` (default `n8n`). It writes normalized JSON and a human-readable graph under ignored `.local/automation/n8n/`. It never reads or mutates n8n's internal database and never imports a workflow.

## Dashboard

Automation Suit exposes `/`, `/projects`, `/tasks`, `/tasks/:id`, `/runs`, `/errors`, `/policies`, and `/n8n`. `/projects` provides a dry-run-first registration wizard with inactive-by-default saves and secret-key rejection; `/policies` validates the exact profile count before audited saves. These mutations require the optional operator connection. Task detail shows exact attempt/policy/model/reasoning, live verification status, process/Git paths, timeline, and state-aware commands plus copyable ChatGPT/Codex diagnostic prompts. Usage is shown as unavailable unless Codex supplies it; the UI does not estimate tokens.

## Sandbox validation

Apply migrations to a disposable database and run:

```sh
psql "$DISPOSABLE_CONTROL_DATABASE_URL" -f tooling/control-plane/tests/generic-platform-smoke.sql
```

The transaction rolls back after proving registration, claim, simulated implementation, failed verification, retry profile sequence, same-execution reverification, resume-ready state and bounded control records. Never point this fixture at a hosted product database.
