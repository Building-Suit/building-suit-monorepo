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
           AND r.requirement_id =
               tr.requirement_id
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
              'decision_text',
                d.decision_text,
              'status', d.status,
              'blocking', td.blocking
            )
            ORDER BY d.decision_id
          )
          FROM control.task_decisions AS td
          JOIN control.decisions AS d
            ON d.suit_slug = td.suit_slug
           AND d.decision_id =
               td.decision_id
          WHERE td.task_id = t.task_id
        ),
        '[]'::jsonb
      ),

    'dependencies',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'task_id',
                parent.task_id,
              'title',
                parent.title,
              'status',
                parent.status,
              'dependency_type',
                dep.dependency_type
            )
            ORDER BY parent.sequence,
                     parent.task_id
          )
          FROM control.task_dependencies AS dep
          JOIN control.tasks AS parent
            ON parent.task_id =
               dep.depends_on_task_id
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


CREATE OR REPLACE FUNCTION control.release_task_claim(
  p_task_id text,
  p_source text DEFAULT 'runner'
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  previous_status text;
BEGIN

  IF p_source NOT IN (
    'system',
    'n8n',
    'runner',
    'human'
  ) THEN
    RAISE EXCEPTION
      'Unsupported release source: %',
      p_source;
  END IF;

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

  IF previous_status <> 'in_progress' THEN
    RETURN false;
  END IF;

  UPDATE control.tasks
  SET status = 'planned'
  WHERE task_id = p_task_id;

  INSERT INTO control.task_events (
    task_id,
    event_type,
    from_status,
    to_status,
    source
  )
  VALUES (
    p_task_id,
    'task_claim_released',
    previous_status,
    'planned',
    p_source
  );

  RETURN true;
END;
$$;

COMMIT;
