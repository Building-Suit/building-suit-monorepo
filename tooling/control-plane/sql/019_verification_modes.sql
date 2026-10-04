BEGIN;

ALTER TABLE control.verification_runs
  ADD COLUMN IF NOT EXISTS verification_mode text NOT NULL DEFAULT 'focused';

ALTER TABLE control.verification_runs
  DROP CONSTRAINT IF EXISTS verification_runs_mode_check;

ALTER TABLE control.verification_runs
  ADD CONSTRAINT verification_runs_mode_check CHECK (
    verification_mode IN ('focused', 'milestone', 'release')
  );

UPDATE control.verification_runs
SET verification_mode = CASE
  WHEN metadata->>'verification_mode' IN ('focused', 'milestone', 'release')
    THEN metadata->>'verification_mode'
  ELSE 'focused'
END;

CREATE OR REPLACE FUNCTION control.resolved_verification_mode(p_task_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  resolved_mode text;
BEGIN
  SELECT COALESCE(
    t.metadata->>'verification_mode',
    w.verification_config->>'mode',
    p.verification_config->>'mode',
    CASE WHEN t.task_type = 'release' THEN 'release' ELSE 'focused' END
  )
  INTO resolved_mode
  FROM control.tasks t
  LEFT JOIN control.projects p ON p.project_id = t.project_id
  LEFT JOIN control.workstreams w
    ON w.project_id = t.project_id
   AND w.slug = t.workstream_slug
  WHERE t.task_id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown task: %', p_task_id;
  END IF;

  IF resolved_mode NOT IN ('focused', 'milestone', 'release') THEN
    RAISE EXCEPTION 'Unsupported verification mode for task %: %', p_task_id, resolved_mode;
  END IF;

  RETURN resolved_mode;
END;
$$;

CREATE OR REPLACE FUNCTION control.start_verification_run(
  p_task_id text,
  p_execution_id bigint,
  p_source text DEFAULT 'runner',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  task_status text;
  execution_task text;
  execution_status text;
  requested_mode text;
  new_id bigint;
  existing_id bigint;
BEGIN
  SELECT status INTO task_status
  FROM control.tasks
  WHERE task_id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown task: %', p_task_id;
  END IF;

  SELECT task_id, status INTO execution_task, execution_status
  FROM control.executions
  WHERE execution_id = p_execution_id;

  IF NOT FOUND OR execution_task <> p_task_id OR execution_status <> 'succeeded' THEN
    RAISE EXCEPTION 'Execution % is not a succeeded execution for task %', p_execution_id, p_task_id;
  END IF;

  IF task_status NOT IN ('in_progress', 'verification') THEN
    RAISE EXCEPTION 'Task % cannot verify from %', p_task_id, task_status;
  END IF;

  requested_mode := COALESCE(
    p_metadata->>'verification_mode',
    control.resolved_verification_mode(p_task_id)
  );

  IF requested_mode NOT IN ('focused', 'milestone', 'release') THEN
    RAISE EXCEPTION 'Unsupported verification mode: %', requested_mode;
  END IF;

  SELECT verification_run_id INTO existing_id
  FROM control.verification_runs
  WHERE execution_id = p_execution_id
    AND status = 'running'
  ORDER BY verification_run_id DESC
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  UPDATE control.tasks
  SET status = 'verification', engine_stage = 'verification'
  WHERE task_id = p_task_id;

  UPDATE control.executions
  SET engine_stage = 'verification'
  WHERE execution_id = p_execution_id;

  INSERT INTO control.verification_runs(
    execution_id, status, source, verification_mode, metadata
  )
  VALUES (
    p_execution_id,
    'running',
    p_source,
    requested_mode,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('verification_mode', requested_mode)
  )
  RETURNING verification_run_id INTO new_id;

  INSERT INTO control.task_events(
    task_id, event_type, from_status, to_status, source, payload
  )
  VALUES (
    p_task_id,
    'verification_started',
    task_status,
    'verification',
    p_source,
    jsonb_build_object(
      'execution_id', p_execution_id,
      'verification_run_id', new_id,
      'verification_mode', requested_mode
    )
  );

  RETURN new_id;
END;
$$;

DROP FUNCTION IF EXISTS control.update_verification_check(
  bigint, text, text, integer, text, text, bigint, text, boolean
);

CREATE FUNCTION control.update_verification_check(
  p_run_id bigint,
  p_check_name text,
  p_status text,
  p_exit_code integer DEFAULT NULL,
  p_summary text DEFAULT NULL,
  p_log_path text DEFAULT NULL,
  p_elapsed_ms bigint DEFAULT NULL,
  p_command text DEFAULT NULL,
  p_required boolean DEFAULT true,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  new_id bigint;
  run_mode text;
BEGIN
  IF p_status NOT IN ('running', 'pass', 'fail', 'skipped', 'not_run') THEN
    RAISE EXCEPTION 'Unsupported check status: %', p_status;
  END IF;

  SELECT verification_mode INTO run_mode
  FROM control.verification_runs
  WHERE verification_run_id = p_run_id
    AND status = 'running';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verification run % is not running', p_run_id;
  END IF;

  INSERT INTO control.verification_results(
    verification_run_id, execution_id, check_name, command, status,
    exit_code, summary, log_path, metadata, queued_at, started_at,
    finished_at, elapsed_ms
  )
  SELECT
    p_run_id,
    execution_id,
    p_check_name,
    p_command,
    p_status,
    p_exit_code,
    p_summary,
    p_log_path,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'required', p_required,
      'verification_mode', run_mode
    ),
    now(),
    now(),
    CASE WHEN p_status = 'running' THEN NULL ELSE now() END,
    p_elapsed_ms
  FROM control.verification_runs
  WHERE verification_run_id = p_run_id
    AND status = 'running'
  ON CONFLICT (verification_run_id, check_name)
    WHERE verification_run_id IS NOT NULL
  DO UPDATE SET
    command = COALESCE(EXCLUDED.command, control.verification_results.command),
    status = EXCLUDED.status,
    exit_code = EXCLUDED.exit_code,
    summary = EXCLUDED.summary,
    log_path = EXCLUDED.log_path,
    metadata = EXCLUDED.metadata,
    started_at = COALESCE(control.verification_results.started_at, now()),
    finished_at = CASE WHEN EXCLUDED.status = 'running' THEN NULL ELSE now() END,
    elapsed_ms = EXCLUDED.elapsed_ms
  RETURNING verification_id INTO new_id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION control.generic_task_packet(p_task_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH packet AS (
    SELECT control.task_packet(p_task_id) AS value
  )
  SELECT packet.value || jsonb_build_object(
    'task', packet.value->'task' || jsonb_build_object(
      'verification_mode', control.resolved_verification_mode(t.task_id)
    ),
    'project', to_jsonb(p) - 'metadata',
    'workstream', to_jsonb(w) - 'metadata',
    'retry_policy', control.resolved_retry_policy(t.task_id),
    'preparation', t.metadata->'preparation'
  )
  FROM control.tasks t
  CROSS JOIN packet
  LEFT JOIN control.projects p ON p.project_id = t.project_id
  LEFT JOIN control.workstreams w
    ON w.project_id = t.project_id
   AND w.slug = t.workstream_slug
  WHERE t.task_id = p_task_id;
$$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bs_control_app') THEN
    GRANT EXECUTE ON FUNCTION control.resolved_verification_mode(text) TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.start_verification_run(text, bigint, text, jsonb) TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.update_verification_check(
      bigint, text, text, integer, text, text, bigint, text, boolean, jsonb
    ) TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.generic_task_packet(text) TO bs_control_app;
  END IF;
END
$do$;

COMMIT;
