\set ON_ERROR_STOP on

BEGIN;


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
  'CONTROL-PUBLISH-SQL-001',
  'shop-suit',
  1,
  1,
  'Publication SQL smoke',
  'maintenance',
  'low',
  'fast',
  'passed'
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
  'CONTROL-PUBLISH-SQL-001',
  1,
  'fast',
  'smoke-model',
  'low',
  'succeeded',
  '/tmp/publication-smoke',
  'codex/shop-suit/control-publish-sql-001',
  'codex/shop-suit/example-parent',
  repeat('a', 40),
  now(),
  now()
);


INSERT INTO control.verification_results (
  execution_id,
  check_name,
  command,
  status,
  exit_code,
  summary,
  started_at,
  finished_at
)
SELECT
  execution_id,
  'smoke-check',
  'true',
  'pass',
  0,
  'PASS',
  now(),
  now()
FROM control.executions
WHERE task_id =
  'CONTROL-PUBLISH-SQL-001';


DO $$
DECLARE
  result jsonb;
BEGIN

  result :=
    control.complete_publication(
      'CONTROL-PUBLISH-SQL-001',
      'Building-Suit/building-suit-monorepo',
      999999,
      'codex/shop-suit/control-publish-sql-001',
      'codex/shop-suit/example-parent',
      'https://example.invalid/pr/999999',
      repeat('b', 40),
      true,
      '{"smoke":true}'::jsonb
    );


  IF result ->> 'task_status'
     <> 'complete'
  THEN
    RAISE EXCEPTION
      'Unexpected result: %',
      result;
  END IF;


  IF (
    SELECT status
    FROM control.tasks
    WHERE task_id =
      'CONTROL-PUBLISH-SQL-001'
  ) <> 'complete'
  THEN
    RAISE EXCEPTION
      'Task was not completed.';
  END IF;


  IF (
    SELECT commit_sha
    FROM control.executions
    WHERE task_id =
      'CONTROL-PUBLISH-SQL-001'
  ) <> repeat('b', 40)
  THEN
    RAISE EXCEPTION
      'Commit SHA not recorded.';
  END IF;


  IF NOT EXISTS (
    SELECT 1
    FROM control.pull_requests
    WHERE task_id =
      'CONTROL-PUBLISH-SQL-001'
      AND pr_number = 999999
  )
  THEN
    RAISE EXCEPTION
      'PR was not recorded.';
  END IF;

END;
$$;


ROLLBACK;

SELECT
  'PUBLICATION_LIFECYCLE_SMOKE_PASS'
  AS result;
