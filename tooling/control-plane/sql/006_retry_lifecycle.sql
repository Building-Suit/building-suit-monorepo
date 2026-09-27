BEGIN;


-- Execution failures must move the task out of in_progress.
-- Successful Codex execution deliberately leaves the task in_progress
-- until independent verification begins.
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
  previous_task_status text;
  next_task_status text;
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

  SELECT status
  INTO previous_task_status
  FROM control.tasks
  WHERE task_id = owning_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Execution % owns missing task %',
      p_execution_id,
      owning_task_id;
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

  next_task_status :=
    CASE p_status
      WHEN 'failed' THEN 'failed'
      WHEN 'blocked' THEN 'blocked'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE previous_task_status
    END;

  IF next_task_status <> previous_task_status THEN
    UPDATE control.tasks
    SET status = next_task_status
    WHERE task_id = owning_task_id;
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
    owning_task_id,
    'execution_finished',
    previous_task_status,
    next_task_status,
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


CREATE OR REPLACE FUNCTION control.start_retry_execution(
  p_task_id text,
  p_max_attempts integer,
  p_model_profile text,
  p_model_name text,
  p_reasoning_effort text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  current_task_status text;

  previous_execution
    control.executions%ROWTYPE;

  next_attempt integer;
  new_execution_id bigint;
BEGIN

  IF p_max_attempts < 1
     OR p_max_attempts > 10
  THEN
    RAISE EXCEPTION
      'Invalid max attempts: %',
      p_max_attempts;
  END IF;

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

  IF current_task_status <> 'failed' THEN
    RAISE EXCEPTION
      'Task % must be failed before retry, current status is %',
      p_task_id,
      current_task_status;
  END IF;

  SELECT *
  INTO previous_execution
  FROM control.executions
  WHERE task_id = p_task_id
  ORDER BY attempt DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Task % has no previous execution',
      p_task_id;
  END IF;

  IF previous_execution.attempt
     >= p_max_attempts
  THEN
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
      'retry_exhausted',
      'failed',
      'failed',
      'runner',
      jsonb_build_object(
        'previous_execution_id',
          previous_execution.execution_id,
        'attempt',
          previous_execution.attempt,
        'max_attempts',
          p_max_attempts
      )
    );

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'retry_limit_reached',
      'previous_execution_id',
        previous_execution.execution_id,
      'previous_attempt',
        previous_execution.attempt,
      'max_attempts',
        p_max_attempts
    );
  END IF;

  next_attempt :=
    previous_execution.attempt + 1;

  UPDATE control.tasks
  SET status = 'in_progress'
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
    previous_execution.worktree_path,
    previous_execution.branch_name,
    previous_execution.parent_branch,
    previous_execution.parent_sha,
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
    'retry_started',
    'failed',
    'in_progress',
    'runner',
    jsonb_build_object(
      'previous_execution_id',
        previous_execution.execution_id,
      'execution_id',
        new_execution_id,
      'attempt',
        next_attempt,
      'max_attempts',
        p_max_attempts,
      'model_profile',
        p_model_profile,
      'model_name',
        p_model_name,
      'reasoning_effort',
        p_reasoning_effort
    )
  );

  RETURN jsonb_build_object(
    'allowed', true,

    'execution_id',
      new_execution_id,

    'attempt',
      next_attempt,

    'previous_execution_id',
      previous_execution.execution_id,

    'previous_attempt',
      previous_execution.attempt,

    'worktree_path',
      previous_execution.worktree_path,

    'branch_name',
      previous_execution.branch_name,

    'parent_branch',
      previous_execution.parent_branch,

    'parent_sha',
      previous_execution.parent_sha
  );
END;
$$;


COMMIT;
