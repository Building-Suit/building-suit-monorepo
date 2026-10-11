BEGIN;

/*
 * Migration 014 originally introduced reopen_verification, but some deployed
 * control databases advanced past that migration without retaining the
 * function. Reinstall the authoritative definition in a forward migration;
 * never depend on replaying historical migration 014.
 *
 * The supervisor is an explicit lifecycle source. Older task-event rows did
 * not need that value, so widen the source check before the runtime invokes
 * this function with p_source = 'supervisor'.
 */
ALTER TABLE control.task_events
  DROP CONSTRAINT IF EXISTS task_events_source_check;

ALTER TABLE control.task_events
  ADD CONSTRAINT task_events_source_check CHECK (
    source IN (
      'system',
      'n8n',
      'runner',
      'supervisor',
      'codex',
      'github',
      'human',
      'chatgpt'
    )
  );

CREATE OR REPLACE FUNCTION control.reopen_verification(
  p_task_id text,
  p_source text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  task_row control.tasks%ROWTYPE;
  execution_row control.executions%ROWTYPE;
  recovery_row control.recovery_states%ROWTYPE;
  resolved_recovery_row control.recovery_states%ROWTYPE;
  previous_recovery jsonb;
  resolved_failure_ids jsonb := '[]'::jsonb;
  resolved_recovery_state_ids jsonb := '[]'::jsonb;
BEGIN
  IF p_source IS NULL OR length(btrim(p_source)) = 0 THEN
    RAISE EXCEPTION 'source must not be empty';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason must not be empty';
  END IF;

  SELECT task.*
  INTO task_row
  FROM control.tasks AS task
  WHERE task.task_id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown task: %', p_task_id;
  END IF;

  IF task_row.status NOT IN ('failed', 'passed') THEN
    RAISE EXCEPTION 'Task % cannot reopen verification from %',
      p_task_id, task_row.status;
  END IF;

  SELECT execution.*
  INTO execution_row
  FROM control.executions AS execution
  WHERE execution.task_id = p_task_id
  ORDER BY execution.attempt DESC, execution.execution_id DESC
  LIMIT 1;

  IF NOT FOUND OR execution_row.status <> 'succeeded' THEN
    RAISE EXCEPTION 'Latest execution for task % must have succeeded', p_task_id;
  END IF;

  /*
   * A same-execution reverify supersedes only recoverable verifier lifecycle
   * conditions. Product defects remain authoritative and must use the bounded
   * implementation-repair path instead.
   */
  WITH resolved AS (
    UPDATE control.failures AS failure
    SET
      resolved_at = now(),
      metadata = COALESCE(failure.metadata, '{}'::jsonb) || jsonb_build_object(
        'resolved_by', 'verification_reopened',
        'reopened_execution_id', execution_row.execution_id,
        'reopen_reason', p_reason,
        'reopen_source', p_source
      )
    WHERE failure.task_id = p_task_id
      AND failure.resolved_at IS NULL
      AND failure.stage = 'verification'
      AND failure.recoverable = true
      AND failure.failure_class IN (
        'verification-lifecycle',
        'verification-configuration',
        'verification-infrastructure',
        'verification-required-check-unavailable'
      )
    RETURNING failure.failure_id
  )
  SELECT COALESCE(jsonb_agg(resolved.failure_id ORDER BY resolved.failure_id), '[]'::jsonb)
  INTO resolved_failure_ids
  FROM resolved;

  FOR recovery_row IN
    SELECT recovery.*
    FROM control.recovery_states AS recovery
    WHERE recovery.current_task_id = p_task_id
      AND recovery.status = 'active'
      AND recovery.recoverable = true
      AND recovery.failure_class IN (
        'verification-lifecycle',
        'verification-configuration',
        'verification-infrastructure',
        'verification-required-check-unavailable'
      )
    ORDER BY recovery.updated_at, recovery.recovery_state_id
    FOR UPDATE
  LOOP
    previous_recovery := to_jsonb(recovery_row);

    UPDATE control.recovery_states AS recovery
    SET
      status = 'resolved',
      resolved_at = now(),
      next_wake_at = NULL,
      heartbeat_at = NULL,
      lease_owner = NULL,
      lease_token = NULL,
      lease_expires_at = NULL,
      condition = COALESCE(recovery.condition, '{}'::jsonb) || jsonb_build_object(
        'superseded_by', 'verification_reopened',
        'reopened_execution_id', execution_row.execution_id,
        'reopen_reason', p_reason
      ),
      metadata = COALESCE(recovery.metadata, '{}'::jsonb) || jsonb_build_object(
        'resolved_by', 'verification_reopened',
        'reopen_source', p_source
      ),
      version = recovery.version + 1,
      updated_at = now()
    WHERE recovery.recovery_state_id = recovery_row.recovery_state_id
    RETURNING recovery.* INTO resolved_recovery_row;

    INSERT INTO control.recovery_state_events (
      recovery_state_id,
      version,
      idempotency_key,
      source,
      previous_state,
      recorded_state
    )
    VALUES (
      resolved_recovery_row.recovery_state_id,
      resolved_recovery_row.version,
      format(
        'verification-reopened:%s:%s:%s',
        p_task_id,
        execution_row.execution_id,
        resolved_recovery_row.version
      ),
      p_source,
      previous_recovery,
      to_jsonb(resolved_recovery_row)
    );

    INSERT INTO control.audit_events (
      project_id,
      workstream_slug,
      task_id,
      execution_id,
      action,
      source,
      old_value,
      new_value,
      reason,
      metadata
    )
    VALUES (
      task_row.project_id,
      task_row.workstream_slug,
      p_task_id,
      execution_row.execution_id,
      'verification_recovery_resolved',
      p_source,
      previous_recovery,
      to_jsonb(resolved_recovery_row),
      p_reason,
      jsonb_build_object(
        'recovery_state_id', resolved_recovery_row.recovery_state_id,
        'preserved_execution_id', execution_row.execution_id
      )
    );

    resolved_recovery_state_ids := resolved_recovery_state_ids ||
      jsonb_build_array(resolved_recovery_row.recovery_state_id);
  END LOOP;

  UPDATE control.tasks
  SET status = 'verification', engine_stage = 'verification'
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
    'verification_reopened',
    task_row.status,
    'verification',
    p_source,
    jsonb_build_object(
      'execution_id', execution_row.execution_id,
      'attempt', execution_row.attempt,
      'worktree_path', execution_row.worktree_path,
      'branch_name', execution_row.branch_name,
      'commit_sha', execution_row.commit_sha,
      'reason', p_reason,
      'resolved_failure_ids', resolved_failure_ids,
      'resolved_recovery_state_ids', resolved_recovery_state_ids
    )
  );

  INSERT INTO control.audit_events (
    project_id,
    workstream_slug,
    task_id,
    execution_id,
    action,
    source,
    old_value,
    new_value,
    reason,
    metadata
  )
  VALUES (
    task_row.project_id,
    task_row.workstream_slug,
    p_task_id,
    execution_row.execution_id,
    'verification_reopened',
    p_source,
    jsonb_build_object(
      'status', task_row.status,
      'engine_stage', task_row.engine_stage
    ),
    jsonb_build_object(
      'status', 'verification',
      'engine_stage', 'verification'
    ),
    p_reason,
    jsonb_build_object(
      'preserved_execution_id', execution_row.execution_id,
      'preserved_attempt', execution_row.attempt,
      'preserved_worktree_path', execution_row.worktree_path,
      'preserved_implementation_result', execution_row.metadata,
      'resolved_failure_ids', resolved_failure_ids,
      'resolved_recovery_state_ids', resolved_recovery_state_ids
    )
  );

  RETURN jsonb_build_object(
    'task_id', p_task_id,
    'status', 'verification',
    'engine_stage', 'verification',
    'execution_id', execution_row.execution_id,
    'attempt', execution_row.attempt,
    'worktree_path', execution_row.worktree_path,
    'resolved_failure_ids', resolved_failure_ids,
    'resolved_recovery_state_ids', resolved_recovery_state_ids
  );
END;
$$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bs_control_app') THEN
    GRANT EXECUTE ON FUNCTION control.reopen_verification(text, text, text)
      TO bs_control_app;
  END IF;
END
$do$;

COMMIT;
