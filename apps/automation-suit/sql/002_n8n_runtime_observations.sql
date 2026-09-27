BEGIN;

-- Optional telemetry only. This table is NOT control-plane orchestration state.
-- It records what n8n says it is actually doing so the dashboard can compare
-- desired/control state with observed runtime state.
CREATE TABLE IF NOT EXISTS control.n8n_runtime_executions (
  n8n_execution_id text PRIMARY KEY,
  workflow_id text,
  workflow_name text,

  -- Deliberately nullable and not foreign-key constrained: an observation may
  -- reveal a missing/mismatched control-plane row, which the dashboard must show.
  run_id uuid,
  suit_slug text,
  task_id text,

  runtime_status text NOT NULL,
  current_node text,
  current_stage text,

  started_at timestamptz,
  last_heartbeat_at timestamptz,
  finished_at timestamptz,

  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS n8n_runtime_suit_status_idx
  ON control.n8n_runtime_executions (suit_slug, runtime_status, observed_at DESC);

CREATE INDEX IF NOT EXISTS n8n_runtime_task_idx
  ON control.n8n_runtime_executions (task_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS n8n_runtime_run_idx
  ON control.n8n_runtime_executions (run_id, observed_at DESC);

-- Existing runtime role should be able to write telemetry if it already exists.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bs_control_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON control.n8n_runtime_executions
      TO bs_control_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bs_dashboard_reader') THEN
    GRANT SELECT
      ON control.n8n_runtime_executions
      TO bs_dashboard_reader;
  END IF;
END
$do$;

COMMIT;
