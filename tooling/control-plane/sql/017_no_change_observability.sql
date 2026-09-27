BEGIN;


CREATE OR REPLACE FUNCTION control.task_packet(
  p_task_id text
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(

    'version', 1,

    'task',
      jsonb_build_object(
        'task_id', t.task_id,
        'suit_slug', t.suit_slug,
        'title', t.title,
        'description', t.description,
        'task_type', t.task_type,
        'risk_level', t.risk_level,
        'model_profile', t.model_profile,
        'status', t.status,
        'engine_stage', t.engine_stage,
        'sequence', t.sequence,
        'priority', t.priority,
        'acceptance_criteria',
          t.acceptance_criteria,
        'verification_plan',
          t.verification_plan
      ),

    'suit',
      jsonb_build_object(
        'slug', s.slug,
        'display_name', s.display_name,
        'stack_key', s.stack_key,
        'app_path', s.app_path,
        'status', s.status
      ),

    'requirements',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', r.requirement_id,
              'title', r.title,
              'summary', r.summary,
              'status', r.status,
              'risk_level', r.risk_level,
              'source_path', r.source_path,
              'source_anchor', r.source_anchor
            )
            ORDER BY r.requirement_id
          )
          FROM control.task_requirements AS tr
          JOIN control.requirements AS r
            ON r.suit_slug = tr.suit_slug
           AND r.requirement_id = tr.requirement_id
          WHERE tr.task_id = t.task_id
        ),
        '[]'::jsonb
      ),

    'decisions',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', d.decision_id,
              'title', d.title,
              'decision_text', d.decision_text,
              'status', d.status,
              'blocking', td.blocking
            )
            ORDER BY d.decision_id
          )
          FROM control.task_decisions AS td
          JOIN control.decisions AS d
            ON d.suit_slug = td.suit_slug
           AND d.decision_id = td.decision_id
          WHERE td.task_id = t.task_id
        ),
        '[]'::jsonb
      ),

    'dependencies',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'task_id', parent.task_id,
              'title', parent.title,
              'status', parent.status,
              'dependency_type', dep.dependency_type
            )
            ORDER BY parent.sequence, parent.task_id
          )
          FROM control.task_dependencies AS dep
          JOIN control.tasks AS parent
            ON parent.task_id = dep.depends_on_task_id
          WHERE dep.task_id = t.task_id
        ),
        '[]'::jsonb
      )

  )
  FROM control.tasks AS t
  JOIN control.suits AS s
    ON s.slug = t.suit_slug
  WHERE t.task_id = p_task_id;
$$;


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
  latest_failure_id bigint;
  allow_no_change_completion boolean;
BEGIN

  SELECT *
  INTO current_task
  FROM control.tasks
  WHERE task_id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown task: %', p_task_id;
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

  IF NOT FOUND OR latest_execution.status <> 'succeeded' THEN
    RAISE EXCEPTION
      'Latest execution for % must have succeeded',
      p_task_id;
  END IF;

  SELECT
    count(*),
    max(failure_id)
  INTO
    no_change_count,
    latest_failure_id
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

    RETURN jsonb_build_object(
      'action', 'complete_no_changes',
      'task_id', p_task_id,
      'status', 'complete',
      'execution_id', latest_execution.execution_id,
      'no_change_count', no_change_count
    );

  END IF;


  IF no_change_count <= 1 THEN

    UPDATE control.tasks
    SET
      status = 'failed',
      engine_stage = 'implementation_no_changes'
    WHERE task_id = p_task_id;

    RETURN jsonb_build_object(
      'action', 'retry',
      'task_id', p_task_id,
      'status', 'failed',
      'execution_id', latest_execution.execution_id,
      'no_change_count', no_change_count
    );

  END IF;


  UPDATE control.tasks
  SET
    status = 'blocked',
    engine_stage = 'needs_operator_review_no_changes'
  WHERE task_id = p_task_id;


  /*
   * Preserve historical failures, but only the newest one remains open.
   */
  UPDATE control.failures
  SET resolved_at = COALESCE(resolved_at, now())
  WHERE task_id = p_task_id
    AND stage = 'publication'
    AND error_code = 'no_publishable_changes'
    AND failure_id <> latest_failure_id
    AND resolved_at IS NULL;


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
  WHERE failure_id = latest_failure_id;


  RETURN jsonb_build_object(
    'action', 'blocked',
    'task_id', p_task_id,
    'status', 'blocked',
    'execution_id', latest_execution.execution_id,
    'no_change_count', no_change_count,
    'human_intervention_required', true
  );

END;
$$;


/*
 * Repair already-existing records produced before this migration.
 */
WITH ranked AS (
  SELECT
    failure_id,
    task_id,
    row_number() OVER (
      PARTITION BY task_id
      ORDER BY created_at DESC, failure_id DESC
    ) AS rn
  FROM control.failures
  WHERE stage = 'publication'
    AND error_code = 'no_publishable_changes'
    AND resolved_at IS NULL
)
UPDATE control.failures f
SET resolved_at = now()
FROM ranked r
WHERE f.failure_id = r.failure_id
  AND r.rn > 1;


COMMIT;
