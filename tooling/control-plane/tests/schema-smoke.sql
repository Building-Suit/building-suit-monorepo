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
  'CONTROL-SMOKE-001',
  'shop-suit',
  1,
  1,
  'Temporary control-plane smoke test',
  'maintenance',
  'low',
  'no_ai',
  'planned'
);

DO $$
DECLARE
  selected_task_id text;
BEGIN
  SELECT task_id
  INTO selected_task_id
  FROM control.next_ready_task('shop-suit');

  IF selected_task_id <> 'CONTROL-SMOKE-001' THEN
    RAISE EXCEPTION
      'Expected CONTROL-SMOKE-001, got %',
      selected_task_id;
  END IF;
END;
$$;

ROLLBACK;

SELECT 'CONTROL_SCHEMA_SMOKE_PASS' AS result;
