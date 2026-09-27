\set ON_ERROR_STOP on

BEGIN;


-- Scenario A:
-- attempt 1 failed verification, attempt 2 may start.

INSERT INTO control.tasks (
  task_id,
  suit_slug,
  sequence,
  priority,
  title,
  task_type,
  risk_level,
  model_profile,
  status
)
VALUES (
  'CONTROL-RETRY-SQL-001',
  'shop-suit',
  1,
  1,
  'Retry SQL smoke',
  'maintenance',
  'low',
  'fast',
  'failed'
);

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
  started_at,
  finished_at
)
VALUES (
  'CONTROL-RETRY-SQL-001',
  1,
  'fast',
  'smoke-model',
  'low',
  'succeeded',
  '/tmp/retry-smoke',
  'codex/shop-suit/control-retry-sql-001',
  'codex/shop-suit/example-parent',
  repeat('a', 40),
  now(),
  now()
);

DO $$
DECLARE
  result jsonb;
BEGIN

  result :=
    control.start_retry_execution(
      'CONTROL-RETRY-SQL-001',
      3,
      'fast',
      'smoke-model',
      'low'
    );

  IF NOT (
    (result ->> 'allowed')::boolean
  ) THEN
    RAISE EXCEPTION
      'Expected retry to be allowed: %',
      result;
  END IF;

  IF (result ->> 'attempt')::integer
     <> 2
  THEN
    RAISE EXCEPTION
      'Expected attempt 2, got %',
      result ->> 'attempt';
  END IF;

END;
$$;


-- Prove Codex execution failure returns task to failed.

DO $$
DECLARE
  retry_execution_id bigint;
BEGIN

  SELECT execution_id
  INTO retry_execution_id
  FROM control.executions
  WHERE task_id =
    'CONTROL-RETRY-SQL-001'
  ORDER BY attempt DESC
  LIMIT 1;

  PERFORM control.finish_execution(
    retry_execution_id,
    'failed',
    NULL,
    10,
    10,
    '/tmp/retry.log',
    '{"smoke":true}'::jsonb
  );

  IF (
    SELECT status
    FROM control.tasks
    WHERE task_id =
      'CONTROL-RETRY-SQL-001'
  ) <> 'failed'
  THEN
    RAISE EXCEPTION
      'Failed execution did not fail task.';
  END IF;

END;
$$;


-- Scenario B:
-- attempt 3 already exists: no attempt 4.

INSERT INTO control.tasks (
  task_id,
  suit_slug,
  sequence,
  priority,
  title,
  task_type,
  risk_level,
  model_profile,
  status
)
VALUES (
  'CONTROL-RETRY-CAP-001',
  'shop-suit',
  2,
  1,
  'Retry cap smoke',
  'maintenance',
  'low',
  'fast',
  'failed'
);

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
  started_at,
  finished_at
)
SELECT
  'CONTROL-RETRY-CAP-001',
  attempt_number,
  CASE
    WHEN attempt_number < 3
      THEN 'fast'
    ELSE 'standard'
  END,
  'smoke-model',
  CASE
    WHEN attempt_number < 3
      THEN 'low'
    ELSE 'medium'
  END,
  'succeeded',
  '/tmp/retry-cap',
  'codex/shop-suit/control-retry-cap-001',
  'codex/shop-suit/example-parent',
  repeat('b', 40),
  now(),
  now()
FROM generate_series(1, 3)
AS attempt_number;


DO $$
DECLARE
  result jsonb;
BEGIN

  result :=
    control.start_retry_execution(
      'CONTROL-RETRY-CAP-001',
      3,
      'standard',
      'smoke-model',
      'medium'
    );

  IF (
    result ->> 'allowed'
  )::boolean
  THEN
    RAISE EXCEPTION
      'Attempt 4 was incorrectly allowed.';
  END IF;

  IF result ->> 'reason'
     <> 'retry_limit_reached'
  THEN
    RAISE EXCEPTION
      'Unexpected retry rejection: %',
      result;
  END IF;

END;
$$;


ROLLBACK;

SELECT
  'RETRY_LIFECYCLE_SMOKE_PASS'
  AS result;
