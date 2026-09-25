BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS
verification_execution_check_uidx
ON control.verification_results (
  execution_id,
  check_name
);


CREATE OR REPLACE FUNCTION control.begin_verification(
  p_task_id text,
  p_execution_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  current_task_status text;
  execution_task_id text;
  execution_status text;
BEGIN

  SELECT status
  INTO current_task_status
  FROM control.tasks
  WHERE task_id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Unknown task: %',
      p_task_id;
  END IF;

  SELECT
    task_id,
    status
  INTO
    execution_task_id,
    execution_status
  FROM control.executions
  WHERE execution_id = p_execution_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Unknown execution: %',
      p_execution_id;
  END IF;

  IF execution_task_id <> p_task_id THEN
    RAISE EXCEPTION
      'Execution % belongs to task %, not %',
      p_execution_id,
      execution_task_id,
      p_task_id;
  END IF;

  IF execution_status <> 'succeeded' THEN
    RAISE EXCEPTION
      'Execution % is %, not succeeded',
      p_execution_id,
      execution_status;
  END IF;

  IF current_task_status NOT IN (
    'in_progress',
    'verification'
  ) THEN
    RAISE EXCEPTION
      'Task % cannot enter verification from %',
      p_task_id,
      current_task_status;
  END IF;

  DELETE FROM control.verification_results
  WHERE execution_id = p_execution_id;

  UPDATE control.tasks
  SET status = 'verification'
  WHERE task_id = p_task_id;

  INSERT INTO control.task_events (
    task_id,
    event_type,
    from_status,
    to_status,
    source,
    payload
  )
  VALUES (
    p_task_id,
    'verification_started',
    current_task_status,
    'verification',
    'runner',
    jsonb_build_object(
      'execution_id',
      p_execution_id
    )
  );

  RETURN true;
END;
$$;


CREATE OR REPLACE FUNCTION control.record_verification(
  p_execution_id bigint,
  p_check_name text,
  p_command text,
  p_status text,
  p_exit_code integer,
  p_summary text,
  p_log_path text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  new_verification_id bigint;
BEGIN

  IF p_status NOT IN (
    'pass',
    'fail',
    'skipped',
    'not_run'
  ) THEN
    RAISE EXCEPTION
      'Unsupported verification status: %',
      p_status;
  END IF;

  INSERT INTO control.verification_results (
    execution_id,
    check_name,
    command,
    status,
    exit_code,
    summary,
    log_path,
    metadata,
    started_at,
    finished_at
  )
  VALUES (
    p_execution_id,
    p_check_name,
    p_command,
    p_status,
    p_exit_code,
    p_summary,
    p_log_path,
    COALESCE(
      p_metadata,
      '{}'::jsonb
    ),
    now(),
    now()
  )
  ON CONFLICT (
    execution_id,
    check_name
  )
  DO UPDATE SET
    command = EXCLUDED.command,
    status = EXCLUDED.status,
    exit_code = EXCLUDED.exit_code,
    summary = EXCLUDED.summary,
    log_path = EXCLUDED.log_path,
    metadata = EXCLUDED.metadata,
    started_at = EXCLUDED.started_at,
    finished_at = EXCLUDED.finished_at
  RETURNING verification_id
  INTO new_verification_id;

  RETURN new_verification_id;
END;
$$;


CREATE OR REPLACE FUNCTION control.finish_verification(
  p_task_id text,
  p_execution_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result_count integer;
  fail_count integer;
  not_run_count integer;
  final_status text;
BEGIN

  SELECT COUNT(*)
  INTO result_count
  FROM control.verification_results
  WHERE execution_id = p_execution_id;

  IF result_count = 0 THEN
    RAISE EXCEPTION
      'Execution % has no verification results',
      p_execution_id;
  END IF;

  SELECT COUNT(*)
  INTO fail_count
  FROM control.verification_results
  WHERE execution_id = p_execution_id
    AND status = 'fail';

  SELECT COUNT(*)
  INTO not_run_count
  FROM control.verification_results
  WHERE execution_id = p_execution_id
    AND status = 'not_run';

  IF fail_count = 0
     AND not_run_count = 0
  THEN
    final_status := 'passed';
  ELSE
    final_status := 'failed';
  END IF;

  UPDATE control.tasks
  SET status = final_status
  WHERE task_id = p_task_id
    AND status = 'verification';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Task % is not in verification',
      p_task_id;
  END IF;

  INSERT INTO control.task_events (
    task_id,
    event_type,
    from_status,
    to_status,
    source,
    payload
  )
  VALUES (
    p_task_id,
    'verification_finished',
    'verification',
    final_status,
    'runner',
    jsonb_build_object(
      'execution_id',
        p_execution_id,
      'checks',
        result_count,
      'failed',
        fail_count,
      'not_run',
        not_run_count
    )
  );

  RETURN jsonb_build_object(
    'passed',
      final_status = 'passed',
    'task_status',
      final_status,
    'checks',
      result_count,
    'failed',
      fail_count,
    'not_run',
      not_run_count
  );
END;
$$;

COMMIT;
