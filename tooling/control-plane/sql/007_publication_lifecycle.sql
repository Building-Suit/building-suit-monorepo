BEGIN;


-- A hard dependency is not consumable merely because its local
-- verification passed. It must first be published successfully.
CREATE OR REPLACE VIEW control.ready_tasks AS
SELECT t.*
FROM control.tasks AS t
WHERE t.status = 'planned'

AND NOT EXISTS (
  SELECT 1
  FROM control.task_dependencies AS dependency
  JOIN control.tasks AS parent
    ON parent.task_id =
       dependency.depends_on_task_id
  WHERE dependency.task_id = t.task_id
    AND dependency.dependency_type = 'hard'
    AND parent.status <> 'complete'
)

AND NOT EXISTS (
  SELECT 1
  FROM control.task_decisions AS task_decision
  JOIN control.decisions AS decision
    ON decision.suit_slug =
       task_decision.suit_slug
   AND decision.decision_id =
       task_decision.decision_id
  WHERE task_decision.task_id = t.task_id
    AND task_decision.blocking = true
    AND decision.status <> 'approved'
);


-- A task may have only one open publication PR.
CREATE UNIQUE INDEX IF NOT EXISTS
pull_requests_open_task_uidx
ON control.pull_requests (
  task_id
)
WHERE
  task_id IS NOT NULL
  AND state = 'open';


CREATE OR REPLACE FUNCTION control.complete_publication(
  p_task_id text,
  p_repository text,
  p_pr_number integer,
  p_head_branch text,
  p_base_branch text,
  p_url text,
  p_head_sha text,
  p_is_draft boolean,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  previous_status text;
  latest_execution_id bigint;
  latest_execution_status text;
BEGIN

  SELECT status
  INTO previous_status
  FROM control.tasks
  WHERE task_id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Unknown task: %',
      p_task_id;
  END IF;

  IF previous_status NOT IN (
    'passed',
    'complete'
  ) THEN
    RAISE EXCEPTION
      'Task % cannot be published from status %',
      p_task_id,
      previous_status;
  END IF;


  SELECT
    execution_id,
    status
  INTO
    latest_execution_id,
    latest_execution_status
  FROM control.executions
  WHERE task_id = p_task_id
  ORDER BY attempt DESC
  LIMIT 1;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Task % has no execution',
      p_task_id;
  END IF;


  IF latest_execution_status <> 'succeeded' THEN
    RAISE EXCEPTION
      'Latest execution % is %, not succeeded',
      latest_execution_id,
      latest_execution_status;
  END IF;


  IF EXISTS (
    SELECT 1
    FROM control.verification_results
    WHERE execution_id =
      latest_execution_id
      AND status IN (
        'fail',
        'not_run'
      )
  ) THEN
    RAISE EXCEPTION
      'Task % has failing or unrun verification',
      p_task_id;
  END IF;


  IF NOT EXISTS (
    SELECT 1
    FROM control.verification_results
    WHERE execution_id =
      latest_execution_id
  ) THEN
    RAISE EXCEPTION
      'Task % has no verification evidence',
      p_task_id;
  END IF;


  UPDATE control.executions
  SET commit_sha = p_head_sha
  WHERE execution_id =
    latest_execution_id;


  INSERT INTO control.pull_requests (
    task_id,
    repository,
    pr_number,
    head_branch,
    base_branch,
    state,
    is_draft,
    url,
    head_sha,
    metadata
  )
  VALUES (
    p_task_id,
    p_repository,
    p_pr_number,
    p_head_branch,
    p_base_branch,
    'open',
    p_is_draft,
    p_url,
    p_head_sha,
    COALESCE(
      p_metadata,
      '{}'::jsonb
    )
  )
  ON CONFLICT (
    repository,
    pr_number
  )
  DO UPDATE SET
    task_id =
      EXCLUDED.task_id,
    head_branch =
      EXCLUDED.head_branch,
    base_branch =
      EXCLUDED.base_branch,
    state =
      'open',
    is_draft =
      EXCLUDED.is_draft,
    url =
      EXCLUDED.url,
    head_sha =
      EXCLUDED.head_sha,
    metadata =
      EXCLUDED.metadata;


  IF previous_status = 'passed' THEN

    UPDATE control.tasks
    SET status = 'complete'
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
      'publication_completed',
      'passed',
      'complete',
      'runner',
      jsonb_build_object(
        'repository',
          p_repository,
        'pr_number',
          p_pr_number,
        'head_branch',
          p_head_branch,
        'base_branch',
          p_base_branch,
        'head_sha',
          p_head_sha,
        'is_draft',
          p_is_draft
      )
    );

  END IF;


  RETURN jsonb_build_object(
    'published', true,
    'task_id', p_task_id,
    'task_status', 'complete',
    'execution_id',
      latest_execution_id,
    'repository',
      p_repository,
    'pr_number',
      p_pr_number,
    'head_branch',
      p_head_branch,
    'base_branch',
      p_base_branch,
    'head_sha',
      p_head_sha,
    'url',
      p_url
  );

END;
$$;


COMMIT;
