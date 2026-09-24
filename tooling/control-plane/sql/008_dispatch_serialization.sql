BEGIN;


CREATE OR REPLACE VIEW control.ready_tasks AS
SELECT t.*
FROM control.tasks AS t
WHERE t.status = 'planned'

-- Only one implementation lifecycle may be active
-- for a Suit at a time.
AND NOT EXISTS (
  SELECT 1
  FROM control.tasks AS active
  WHERE active.suit_slug = t.suit_slug
    AND active.task_id <> t.task_id
    AND active.status IN (
      'in_progress',
      'verification',
      'passed',
      'failed'
    )
)

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


CREATE OR REPLACE FUNCTION control.claim_next_task(
  p_suit_slug text,
  p_source text DEFAULT 'n8n'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  selected_task control.tasks%ROWTYPE;
BEGIN

  IF p_source NOT IN (
    'system',
    'n8n',
    'runner',
    'human',
    'chatgpt'
  ) THEN
    RAISE EXCEPTION
      'Unsupported task claim source: %',
      p_source;
  END IF;


  -- Serialize claim decisions per Suit even when two
  -- n8n executions arrive concurrently.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'building-suit-control:' || p_suit_slug,
      0
    )
  );


  SELECT t.*
  INTO selected_task
  FROM control.ready_tasks AS t
  WHERE t.suit_slug = p_suit_slug
  ORDER BY
    t.priority ASC,
    t.sequence ASC,
    t.created_at ASC
  FOR UPDATE OF t SKIP LOCKED
  LIMIT 1;


  IF NOT FOUND THEN
    RETURN NULL;
  END IF;


  UPDATE control.tasks
  SET status = 'in_progress'
  WHERE task_id = selected_task.task_id;


  INSERT INTO control.task_events (
    task_id,
    event_type,
    from_status,
    to_status,
    source,
    payload
  )
  VALUES (
    selected_task.task_id,
    'task_claimed',
    selected_task.status,
    'in_progress',
    p_source,
    jsonb_build_object(
      'suit_slug',
      p_suit_slug
    )
  );


  RETURN control.task_packet(
    selected_task.task_id
  );

END;
$$;


COMMIT;
