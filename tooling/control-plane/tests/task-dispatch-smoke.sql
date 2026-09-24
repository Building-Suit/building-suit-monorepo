\set ON_ERROR_STOP on

BEGIN;

INSERT INTO control.requirements (
  suit_slug,
  requirement_id,
  title,
  status,
  risk_level
)
VALUES (
  'shop-suit',
  'CONTROL-REQ-001',
  'Temporary dispatcher requirement',
  'approved',
  'low'
);

INSERT INTO control.decisions (
  suit_slug,
  decision_id,
  title,
  decision_text,
  status,
  decided_at
)
VALUES (
  'shop-suit',
  'CONTROL-D01',
  'Temporary dispatcher decision',
  'Approved smoke-test decision.',
  'approved',
  now()
);

INSERT INTO control.tasks (
  task_id,
  suit_slug,
  sequence,
  priority,
  title,
  description,
  task_type,
  risk_level,
  model_profile,
  status,
  acceptance_criteria,
  verification_plan
)
VALUES (
  'CONTROL-DISPATCH-001',
  'shop-suit',
  1,
  1,
  'Temporary dispatcher smoke task',
  'Used only inside a rolled-back transaction.',
  'maintenance',
  'low',
  'fast',
  'planned',
  '[
    "task can be claimed",
    "packet contains requirement"
  ]'::jsonb,
  '[
    "dispatcher smoke"
  ]'::jsonb
);

INSERT INTO control.task_requirements (
  task_id,
  suit_slug,
  requirement_id
)
VALUES (
  'CONTROL-DISPATCH-001',
  'shop-suit',
  'CONTROL-REQ-001'
);

INSERT INTO control.task_decisions (
  task_id,
  suit_slug,
  decision_id,
  blocking
)
VALUES (
  'CONTROL-DISPATCH-001',
  'shop-suit',
  'CONTROL-D01',
  true
);

DO $$
DECLARE
  packet jsonb;
BEGIN
  packet :=
    control.claim_next_task(
      'shop-suit',
      'system'
    );

  IF packet IS NULL THEN
    RAISE EXCEPTION
      'Expected a claimed task.';
  END IF;

  IF packet #>> '{task,task_id}'
     <> 'CONTROL-DISPATCH-001'
  THEN
    RAISE EXCEPTION
      'Unexpected claimed task: %',
      packet #>> '{task,task_id}';
  END IF;

  IF packet #>> '{task,status}'
     <> 'in_progress'
  THEN
    RAISE EXCEPTION
      'Packet did not reflect in_progress.';
  END IF;

  IF jsonb_array_length(
    packet -> 'requirements'
  ) <> 1
  THEN
    RAISE EXCEPTION
      'Requirement missing from packet.';
  END IF;

  IF jsonb_array_length(
    packet -> 'decisions'
  ) <> 1
  THEN
    RAISE EXCEPTION
      'Decision missing from packet.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF control.claim_next_task(
    'shop-suit',
    'system'
  ) IS NOT NULL
  THEN
    RAISE EXCEPTION
      'Task was claimed twice.';
  END IF;
END;
$$;

ROLLBACK;

SELECT
  'TASK_DISPATCH_SMOKE_PASS'
  AS result;
