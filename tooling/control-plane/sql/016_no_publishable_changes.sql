BEGIN;


CREATE OR REPLACE FUNCTION control.handle_no_publishable_changes(
  p_task_id text,
  p_source text DEFAULT 'runner'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  current_task control.tasks%ROWTYPE;
  latest_execution control.executions%ROWTYPE;
  no_change_count integer;
  allow_no_change_completion boolean;
BEGIN

  SELECT *
  INTO current_task
  FROM control.tasks
  WHERE task_id = p_task_id
  FOR UPDATE;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Unknown task: %',
      p_task_id;
  END IF;


  IF current_task.status <> 'passed' THEN
    RAISE EXCEPTION
      'Task % must be passed before handling no-publishable-changes; found %',
      p_task_id,
      current_task.status;
  END IF;


  SELECT *
  INTO latest_execution
  FROM control.executions
  WHERE task_id = p_task_id
  ORDER BY attempt DESC
  LIMIT 1;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Task % has no execution',
      p_task_id;
  END IF;


  IF latest_execution.status <> 'succeeded' THEN
    RAISE EXCEPTION
      'Latest execution % is %, expected succeeded',
      latest_execution.execution_id,
      latest_execution.status;
  END IF;


  SELECT count(*)
  INTO no_change_count
  FROM control.failures
  WHERE task_id = p_task_id
    AND stage = 'publication'
    AND error_code = 'no_publishable_changes';


  allow_no_change_completion :=
    COALESCE(
      current_task.metadata
        -> 'allow_no_change_completion'
        = 'true'::jsonb,
      false
    );


  /*
   * Explicitly approved no-op tasks may complete without manufacturing
   * an empty commit/PR.
   */
  IF allow_no_change_completion THEN

    UPDATE control.tasks
    SET
      status = 'complete',
      engine_stage = 'complete_no_changes'
    WHERE task_id = p_task_id;


    UPDATE control.failures
    SET resolved_at = now()
    WHERE task_id = p_task_id
      AND stage = 'publication'
      AND error_code = 'no_publishable_changes'
      AND resolved_at IS NULL;


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
      'completed_no_changes',
      'passed',
      'complete',
      p_source,
      jsonb_build_object(
        'execution_id',
          latest_execution.execution_id,

        'no_change_count',
          no_change_count,

        'reason',
          'Verified no-op completion explicitly allowed by task metadata'
      )
    );


    INSERT INTO control.audit_events (
      project_id,
      workstream_slug,
      task_id,
      execution_id,
      action,
      source,
      reason,
      metadata
    )
    VALUES (
      current_task.project_id,
      current_task.workstream_slug,
      current_task.task_id,
      latest_execution.execution_id,
      'completed_no_changes',
      p_source,
      'Verified no-op completion explicitly allowed',
      jsonb_build_object(
        'no_change_count',
          no_change_count
      )
    );


    RETURN jsonb_build_object(
      'action',
        'complete_no_changes',

      'task_id',
        p_task_id,

      'status',
        'complete',

      'execution_id',
        latest_execution.execution_id,

      'no_change_count',
        no_change_count
    );

  END IF;


  /*
   * The first verified no-change result gets exactly one implementation
   * retry with a purpose-built prompt.
   */
  IF no_change_count <= 1 THEN

    UPDATE control.tasks
    SET
      status = 'failed',
      engine_stage = 'implementation_no_changes'
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
      'implementation_reopened_no_changes',
      'passed',
      'failed',
      p_source,
      jsonb_build_object(
        'execution_id',
          latest_execution.execution_id,

        'no_change_count',
          no_change_count,

        'reason',
          'Verification passed but publication found no Git changes'
      )
    );


    INSERT INTO control.audit_events (
      project_id,
      workstream_slug,
      task_id,
      execution_id,
      action,
      source,
      reason,
      metadata
    )
    VALUES (
      current_task.project_id,
      current_task.workstream_slug,
      current_task.task_id,
      latest_execution.execution_id,
      'implementation_reopened_no_changes',
      p_source,
      'Allow one focused implementation retry after verified no-change',
      jsonb_build_object(
        'no_change_count',
          no_change_count
      )
    );


    RETURN jsonb_build_object(
      'action',
        'retry',

      'task_id',
        p_task_id,

      'status',
        'failed',

      'execution_id',
        latest_execution.execution_id,

      'no_change_count',
        no_change_count
    );

  END IF;


  /*
   * Two verified attempts with no changes means automation cannot safely
   * determine whether the task is already satisfied or underspecified.
   * Stop instead of wasting more Codex attempts.
   */
  UPDATE control.tasks
  SET
    status = 'blocked',
    engine_stage = 'needs_operator_review_no_changes'
  WHERE task_id = p_task_id;


  UPDATE control.failures
  SET
    retry_available = false,
    next_profile = NULL,
    human_intervention_required = true,
    legal_actions =
      '[
        "inspect",
        "error-bundle",
        "prompt-chatgpt"
      ]'::jsonb
  WHERE failure_id = (
    SELECT failure_id
    FROM control.failures
    WHERE task_id = p_task_id
      AND stage = 'publication'
      AND error_code = 'no_publishable_changes'
    ORDER BY created_at DESC, failure_id DESC
    LIMIT 1
  );


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
    'repeated_no_publishable_changes',
    'passed',
    'blocked',
    p_source,
    jsonb_build_object(
      'execution_id',
        latest_execution.execution_id,

      'no_change_count',
        no_change_count,

      'reason',
        'Repeated verified implementations produced no Git changes'
    )
  );


  INSERT INTO control.audit_events (
    project_id,
    workstream_slug,
    task_id,
    execution_id,
    action,
    source,
    reason,
    metadata
  )
  VALUES (
    current_task.project_id,
    current_task.workstream_slug,
    current_task.task_id,
    latest_execution.execution_id,
    'repeated_no_publishable_changes',
    p_source,
    'Stopped automatic retries after repeated verified no-change results',
    jsonb_build_object(
      'no_change_count',
        no_change_count
    )
  );


  RETURN jsonb_build_object(
    'action',
      'blocked',

    'task_id',
      p_task_id,

    'status',
      'blocked',

    'execution_id',
      latest_execution.execution_id,

    'no_change_count',
      no_change_count,

    'human_intervention_required',
      true
  );

END;
$$;


COMMIT;
