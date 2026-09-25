# Optional n8n runtime telemetry

The Nuxt dashboard intentionally does **not** infer live n8n execution from `control.workflow_runs`.

`control.workflow_runs` is control-plane orchestration state. To compare it with actual n8n execution, apply `sql/002_n8n_runtime_observations.sql` and have the shared BS-20 workflow (or a reusable telemetry sub-workflow) write observations using the existing controlled PostgreSQL credential.

## Start / heartbeat upsert

Use a parameterized PostgreSQL node. Do not interpolate externally supplied SQL.

```sql
INSERT INTO control.n8n_runtime_executions (
  n8n_execution_id,
  workflow_id,
  workflow_name,
  run_id,
  suit_slug,
  task_id,
  runtime_status,
  current_node,
  current_stage,
  started_at,
  last_heartbeat_at,
  metadata,
  observed_at
)
VALUES (
  $1, $2, $3, $4, $5, $6,
  'running', $7, $8,
  COALESCE($9, now()), now(),
  COALESCE($10::jsonb, '{}'::jsonb),
  now()
)
ON CONFLICT (n8n_execution_id)
DO UPDATE SET
  workflow_id = EXCLUDED.workflow_id,
  workflow_name = EXCLUDED.workflow_name,
  run_id = EXCLUDED.run_id,
  suit_slug = EXCLUDED.suit_slug,
  task_id = EXCLUDED.task_id,
  runtime_status = 'running',
  current_node = EXCLUDED.current_node,
  current_stage = EXCLUDED.current_stage,
  last_heartbeat_at = now(),
  metadata = EXCLUDED.metadata,
  observed_at = now();
```

Recommended cadence: write on stage transitions and at a bounded heartbeat interval while BS-20 is active. The dashboard default considers a running runtime row stale after 120 seconds; configure `NUXT_RUNTIME_HEARTBEAT_SECONDS` to match your chosen cadence.

## Finish

```sql
UPDATE control.n8n_runtime_executions
SET
  runtime_status = $2,
  current_node = $3,
  current_stage = $4,
  finished_at = now(),
  last_heartbeat_at = now(),
  error_code = $5,
  error_message = $6,
  metadata = COALESCE($7::jsonb, metadata),
  observed_at = now()
WHERE n8n_execution_id = $1;
```

Use concrete runtime status values such as `finished`, `failed`, or `cancelled`. The telemetry writer must never update `control.tasks`, `control.workflow_runs`, decisions, PRs, or verification state as a side effect.

## Why this is separate

This keeps the four different truths visible instead of collapsing them:

- control-plane desired state (`control.tasks`, `control.workflow_runs`)
- n8n observed runtime state (`control.n8n_runtime_executions`)
- runner/Codex execution state (`control.executions`, `control.verification_results`)
- Git/publication state (`control.pull_requests`, publication task events)
