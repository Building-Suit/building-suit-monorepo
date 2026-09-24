BEGIN;

CREATE OR REPLACE FUNCTION control.start_execution(
  p_task_id text,
  p_model_profile text,
  p_model_name text,
  p_reasoning_effort text,
  p_worktree_path text,
  p_branch_name text,
  p_parent_branch text,
  p_parent_sha text
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  next_attempt integer;
  new_execution_id bigint;
  current_status text;
BEGIN

  SELECT status
  INTO current_status
  FROM control.tasks
  WHERE task_id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Unknown task: %',
      p_task_id;
  END IF;

  IF current_status <> 'in_progress' THEN
    RAISE EXCEPTION
      'Task % must be in_progress, current status is %',
      p_task_id,
      current_status;
  END IF;

  SELECT COALESCE(MAX(attempt), 0) + 1
  INTO next_attempt
  FROM control.executions
  WHERE task_id = p_task_id;

  INSERT INTO control.executions (
    task_id,
    attempt,
    model_profile,
    model_name,
    reasoning_effort,
    status,
    worktree_path,
    branch_name,
    parent_branch,
    parent_sha,
    started_at
  )
  VALUES (
    p_task_id,
    next_attempt,
    p_model_profile,
    p_model_name,
    p_reasoning_effort,
    'running',
    p_worktree_path,
    p_branch_name,
    p_parent_branch,
    p_parent_sha,
    now()
  )
  RETURNING execution_id
  INTO new_execution_id;

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
    'execution_started',
    'in_progress',
    'in_progress',
    'runner',
    jsonb_build_object(
      'execution_id',
        new_execution_id,
      'attempt',
        next_attempt,
      'branch_name',
        p_branch_name,
      'parent_branch',
        p_parent_branch,
      'parent_sha',
        p_parent_sha,
      'model_profile',
        p_model_profile,
      'model_name',
        p_model_name,
      'reasoning_effort',
        p_reasoning_effort
    )
  );

  RETURN new_execution_id;
END;
$$;


CREATE OR REPLACE FUNCTION control.finish_execution(
  p_execution_id bigint,
  p_status text,
  p_commit_sha text DEFAULT NULL,
  p_prompt_bytes bigint DEFAULT 0,
  p_output_bytes bigint DEFAULT 0,
  p_run_log_path text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  owning_task_id text;
  previous_execution_status text;
BEGIN

  IF p_status NOT IN (
    'succeeded',
    'failed',
    'blocked',
    'cancelled'
  ) THEN
    RAISE EXCEPTION
      'Unsupported execution status: %',
      p_status;
  END IF;

  SELECT
    task_id,
    status
  INTO
    owning_task_id,
    previous_execution_status
  FROM control.executions
  WHERE execution_id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Unknown execution: %',
      p_execution_id;
  END IF;

  IF previous_execution_status <> 'running' THEN
    RAISE EXCEPTION
      'Execution % is %, not running',
      p_execution_id,
      previous_execution_status;
  END IF;

  UPDATE control.executions
  SET
    status = p_status,
    commit_sha = p_commit_sha,
    prompt_bytes = p_prompt_bytes,
    output_bytes = p_output_bytes,
    run_log_path = p_run_log_path,
    metadata = COALESCE(
      p_metadata,
      '{}'::jsonb
    ),
    finished_at = now()
  WHERE execution_id = p_execution_id;

  INSERT INTO control.task_events (
    task_id,
    event_type,
    from_status,
    to_status,
    source,
    payload
  )
  VALUES (
    owning_task_id,
    'execution_finished',
    'in_progress',
    'in_progress',
    'runner',
    jsonb_build_object(
      'execution_id',
        p_execution_id,
      'execution_status',
        p_status
    )
  );

  RETURN true;
END;
$$;


CREATE OR REPLACE FUNCTION control.latest_execution(
  p_task_id text
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT to_jsonb(e)
      FROM control.executions AS e
      WHERE e.task_id = p_task_id
      ORDER BY e.attempt DESC
      LIMIT 1
    ),
    'null'::jsonb
  );
$$;

COMMIT;
