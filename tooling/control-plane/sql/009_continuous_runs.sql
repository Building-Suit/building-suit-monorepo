BEGIN;

CREATE TABLE IF NOT EXISTS control.workflow_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  suit_slug text NOT NULL
    REFERENCES control.suits(slug)
    ON DELETE CASCADE,

  max_tasks integer NOT NULL
    CHECK (
      max_tasks BETWEEN 1 AND 15
    ),

  completed_tasks integer NOT NULL DEFAULT 0
    CHECK (
      completed_tasks >= 0
    ),

  stop_requested boolean NOT NULL DEFAULT false,

  status text NOT NULL DEFAULT 'running'
    CHECK (
      status IN (
        'running',
        'stopped',
        'limit_reached',
        'finished',
        'failed',
        'cancelled'
      )
    ),

  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE UNIQUE INDEX IF NOT EXISTS
workflow_runs_one_running_suit_uidx
ON control.workflow_runs (
  suit_slug
)
WHERE status = 'running';


DROP TRIGGER IF EXISTS
workflow_runs_set_updated_at
ON control.workflow_runs;

CREATE TRIGGER workflow_runs_set_updated_at
BEFORE UPDATE ON control.workflow_runs
FOR EACH ROW
EXECUTE FUNCTION control.set_updated_at();


CREATE OR REPLACE FUNCTION control.start_workflow_run(
  p_suit_slug text,
  p_max_tasks integer
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  existing_run control.workflow_runs%ROWTYPE;
  new_run control.workflow_runs%ROWTYPE;
BEGIN

  IF p_max_tasks < 1
     OR p_max_tasks > 15
  THEN
    RAISE EXCEPTION
      'max_tasks must be between 1 and 15';
  END IF;


  SELECT *
  INTO existing_run
  FROM control.workflow_runs
  WHERE suit_slug = p_suit_slug
    AND status = 'running'
  LIMIT 1;


  IF FOUND THEN
    RETURN jsonb_build_object(
      'started', false,
      'reason', 'run_already_active',
      'run_id', existing_run.run_id,
      'suit_slug', existing_run.suit_slug,
      'max_tasks', existing_run.max_tasks,
      'completed_tasks', existing_run.completed_tasks
    );
  END IF;


  INSERT INTO control.workflow_runs (
    suit_slug,
    max_tasks
  )
  VALUES (
    p_suit_slug,
    p_max_tasks
  )
  RETURNING *
  INTO new_run;


  RETURN jsonb_build_object(
    'started', true,
    'reason', 'started',
    'run_id', new_run.run_id,
    'suit_slug', new_run.suit_slug,
    'max_tasks', new_run.max_tasks,
    'completed_tasks', new_run.completed_tasks,
    'stop_requested', false,
    'status', 'running',
    'should_continue', true
  );

END;
$$;


CREATE OR REPLACE FUNCTION control.workflow_run_gate(
  p_run_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  current_run control.workflow_runs%ROWTYPE;
BEGIN

  SELECT *
  INTO current_run
  FROM control.workflow_runs
  WHERE run_id = p_run_id
  FOR UPDATE;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Unknown workflow run: %',
      p_run_id;
  END IF;


  IF current_run.status <> 'running' THEN
    RETURN jsonb_build_object(
      'run_id', current_run.run_id,
      'status', current_run.status,
      'completed_tasks', current_run.completed_tasks,
      'max_tasks', current_run.max_tasks,
      'should_continue', false,
      'reason', current_run.status
    );
  END IF;


  IF current_run.stop_requested THEN

    UPDATE control.workflow_runs
    SET
      status = 'stopped',
      finished_at = now()
    WHERE run_id = p_run_id;

    RETURN jsonb_build_object(
      'run_id', current_run.run_id,
      'status', 'stopped',
      'completed_tasks', current_run.completed_tasks,
      'max_tasks', current_run.max_tasks,
      'should_continue', false,
      'reason', 'stop_requested'
    );

  END IF;


  IF current_run.completed_tasks
     >= current_run.max_tasks
  THEN

    UPDATE control.workflow_runs
    SET
      status = 'limit_reached',
      finished_at = now()
    WHERE run_id = p_run_id;

    RETURN jsonb_build_object(
      'run_id', current_run.run_id,
      'status', 'limit_reached',
      'completed_tasks', current_run.completed_tasks,
      'max_tasks', current_run.max_tasks,
      'should_continue', false,
      'reason', 'limit_reached'
    );

  END IF;


  RETURN jsonb_build_object(
    'run_id', current_run.run_id,
    'status', 'running',
    'completed_tasks', current_run.completed_tasks,
    'max_tasks', current_run.max_tasks,
    'stop_requested', current_run.stop_requested,
    'should_continue', true,
    'reason', 'continue'
  );

END;
$$;


CREATE OR REPLACE FUNCTION control.record_workflow_task_success(
  p_run_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  current_run control.workflow_runs%ROWTYPE;
  new_count integer;
BEGIN

  SELECT *
  INTO current_run
  FROM control.workflow_runs
  WHERE run_id = p_run_id
  FOR UPDATE;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Unknown workflow run: %',
      p_run_id;
  END IF;


  IF current_run.status <> 'running' THEN
    RETURN jsonb_build_object(
      'run_id', current_run.run_id,
      'status', current_run.status,
      'completed_tasks', current_run.completed_tasks,
      'max_tasks', current_run.max_tasks,
      'should_continue', false,
      'reason', current_run.status
    );
  END IF;


  new_count :=
    current_run.completed_tasks + 1;


  UPDATE control.workflow_runs
  SET completed_tasks = new_count
  WHERE run_id = p_run_id;


  IF current_run.stop_requested THEN

    UPDATE control.workflow_runs
    SET
      status = 'stopped',
      finished_at = now()
    WHERE run_id = p_run_id;

    RETURN jsonb_build_object(
      'run_id', current_run.run_id,
      'status', 'stopped',
      'completed_tasks', new_count,
      'max_tasks', current_run.max_tasks,
      'should_continue', false,
      'reason', 'stop_requested'
    );

  END IF;


  IF new_count >= current_run.max_tasks THEN

    UPDATE control.workflow_runs
    SET
      status = 'limit_reached',
      finished_at = now()
    WHERE run_id = p_run_id;

    RETURN jsonb_build_object(
      'run_id', current_run.run_id,
      'status', 'limit_reached',
      'completed_tasks', new_count,
      'max_tasks', current_run.max_tasks,
      'should_continue', false,
      'reason', 'limit_reached'
    );

  END IF;


  RETURN jsonb_build_object(
    'run_id', current_run.run_id,
    'status', 'running',
    'completed_tasks', new_count,
    'max_tasks', current_run.max_tasks,
    'should_continue', true,
    'reason', 'continue'
  );

END;
$$;


CREATE OR REPLACE FUNCTION control.request_workflow_stop(
  p_suit_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  current_run control.workflow_runs%ROWTYPE;
BEGIN

  SELECT *
  INTO current_run
  FROM control.workflow_runs
  WHERE suit_slug = p_suit_slug
    AND status = 'running'
  FOR UPDATE
  LIMIT 1;


  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'requested', false,
      'reason', 'no_active_run',
      'suit_slug', p_suit_slug
    );
  END IF;


  UPDATE control.workflow_runs
  SET stop_requested = true
  WHERE run_id = current_run.run_id;


  RETURN jsonb_build_object(
    'requested', true,
    'reason', 'stop_requested',
    'run_id', current_run.run_id,
    'suit_slug', current_run.suit_slug,
    'completed_tasks', current_run.completed_tasks,
    'max_tasks', current_run.max_tasks
  );

END;
$$;


CREATE OR REPLACE FUNCTION control.finish_workflow_run(
  p_run_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  current_run control.workflow_runs%ROWTYPE;
BEGIN

  IF p_status NOT IN (
    'finished',
    'failed',
    'cancelled'
  ) THEN
    RAISE EXCEPTION
      'Unsupported run finish status: %',
      p_status;
  END IF;


  SELECT *
  INTO current_run
  FROM control.workflow_runs
  WHERE run_id = p_run_id
  FOR UPDATE;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Unknown workflow run: %',
      p_run_id;
  END IF;


  IF current_run.status = 'running' THEN
    UPDATE control.workflow_runs
    SET
      status = p_status,
      finished_at = now()
    WHERE run_id = p_run_id;
  END IF;


  RETURN jsonb_build_object(
    'run_id', current_run.run_id,
    'status',
      CASE
        WHEN current_run.status = 'running'
          THEN p_status
        ELSE current_run.status
      END,
    'completed_tasks', current_run.completed_tasks,
    'max_tasks', current_run.max_tasks
  );

END;
$$;


COMMIT;
