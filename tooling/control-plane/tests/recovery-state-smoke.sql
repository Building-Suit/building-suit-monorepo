\set ON_ERROR_STOP on

BEGIN;

DO $do$
DECLARE
  expected_failure_classes text[] := ARRAY[
    'decision-wait',
    'external-wait',
    'flaky-verification',
    'no-change',
    'operator-wait',
    'publication-reconciliation',
    'publication-scope',
    'repository-state',
    'safety-stop',
    'transient-infrastructure',
    'verification-product-defect'
  ];
  expected_recovery_actions text[] := ARRAY[
    'complete-no-changes',
    'reconcile-publication',
    'reconcile-repository',
    'reconcile-runtime',
    'repair',
    'retry',
    'safety-stop',
    'wait-decision',
    'wait-external',
    'wait-operator'
  ];
  actual_failure_classes text[];
  actual_recovery_actions text[];
BEGIN
  SELECT array_agg(failure_class ORDER BY failure_class)
  INTO actual_failure_classes
  FROM control.failure_classes;

  SELECT array_agg(action_code ORDER BY action_code)
  INTO actual_recovery_actions
  FROM control.recovery_actions;

  IF actual_failure_classes <> expected_failure_classes THEN
    RAISE EXCEPTION 'Unexpected failure taxonomy: %', actual_failure_classes;
  END IF;

  IF actual_recovery_actions <> expected_recovery_actions THEN
    RAISE EXCEPTION 'Unexpected recovery actions: %', actual_recovery_actions;
  END IF;
END
$do$;


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
  'CONTROL-RECOVERY-SQL-001',
  'shop-suit',
  1,
  1,
  'Durable recovery SQL smoke',
  'maintenance',
  'critical',
  'standard',
  'in_progress'
);

INSERT INTO control.executions (
  task_id,
  attempt,
  model_profile,
  model_name,
  reasoning_effort,
  status,
  started_at,
  finished_at
)
VALUES (
  'CONTROL-RECOVERY-SQL-001',
  1,
  'standard',
  'smoke-model',
  'medium',
  'failed',
  now(),
  now()
);

INSERT INTO control.failures (
  task_id,
  execution_id,
  attempt,
  stage,
  error_code,
  summary
)
SELECT
  'CONTROL-RECOVERY-SQL-001',
  execution_id,
  1,
  'verification',
  'fixture_failure',
  'Synthetic recovery fixture'
FROM control.executions
WHERE task_id = 'CONTROL-RECOVERY-SQL-001';


DO $do$
DECLARE
  target_execution_id bigint;
  target_failure_id bigint;
  created jsonb;
  replayed jsonb;
  updated jsonb;
  replayed_after_update jsonb;
  resumed jsonb;
  state_id uuid;
BEGIN
  SELECT execution_id
  INTO target_execution_id
  FROM control.executions
  WHERE task_id = 'CONTROL-RECOVERY-SQL-001';

  SELECT failure_id
  INTO target_failure_id
  FROM control.failures
  WHERE task_id = 'CONTROL-RECOVERY-SQL-001';

  created := control.record_recovery_condition(
    p_resume_identity => 'task:CONTROL-RECOVERY-SQL-001',
    p_idempotency_key => 'recovery-smoke-create',
    p_failure_class => 'transient-infrastructure',
    p_error_code => 'postgres_unavailable',
    p_next_action => 'reconcile-runtime',
    p_recoverable => true,
    p_source => 'smoke',
    p_current_task_id => 'CONTROL-RECOVERY-SQL-001',
    p_execution_id => target_execution_id,
    p_failure_id => target_failure_id,
    p_next_wake_at => now() + interval '5 minutes',
    p_heartbeat_at => now(),
    p_lease_owner => 'smoke-worker',
    p_lease_token => 'smoke-lease-1',
    p_lease_expires_at => now() + interval '1 minute',
    p_condition => '{"database":"disposable"}'::jsonb,
    p_metadata => '{"fixture":true}'::jsonb
  );

  IF NOT (created ->> 'applied')::boolean
     OR (created -> 'recovery' ->> 'version')::bigint <> 1
  THEN
    RAISE EXCEPTION 'Recovery create failed: %', created;
  END IF;

  replayed := control.record_recovery_condition(
    p_resume_identity => 'task:CONTROL-RECOVERY-SQL-001',
    p_idempotency_key => 'recovery-smoke-create',
    p_failure_class => 'transient-infrastructure',
    p_error_code => 'postgres_unavailable',
    p_next_action => 'reconcile-runtime',
    p_recoverable => true,
    p_source => 'smoke',
    p_current_task_id => 'CONTROL-RECOVERY-SQL-001',
    p_execution_id => target_execution_id,
    p_failure_id => target_failure_id
  );

  IF (replayed ->> 'applied')::boolean
     OR NOT (replayed ->> 'idempotent_replay')::boolean
     OR (replayed -> 'recovery' ->> 'version')::bigint <> 1
  THEN
    RAISE EXCEPTION 'Recovery idempotent replay failed: %', replayed;
  END IF;

  updated := control.record_recovery_condition(
    p_resume_identity => 'task:CONTROL-RECOVERY-SQL-001',
    p_idempotency_key => 'recovery-smoke-update',
    p_failure_class => 'repository-state',
    p_error_code => 'parent_moved',
    p_next_action => 'reconcile-repository',
    p_recoverable => true,
    p_source => 'smoke',
    p_current_task_id => 'CONTROL-RECOVERY-SQL-001',
    p_execution_id => target_execution_id,
    p_failure_id => target_failure_id,
    p_heartbeat_at => now(),
    p_condition => '{"parent":"stg"}'::jsonb
  );

  IF (updated -> 'recovery' ->> 'version')::bigint <> 2
     OR updated -> 'recovery' ->> 'next_action' <> 'reconcile-repository'
  THEN
    RAISE EXCEPTION 'Recovery update failed: %', updated;
  END IF;

  replayed_after_update := control.record_recovery_condition(
    p_resume_identity => 'task:CONTROL-RECOVERY-SQL-001',
    p_idempotency_key => 'recovery-smoke-create',
    p_failure_class => 'safety-stop',
    p_error_code => 'must_not_replace_recorded_state',
    p_next_action => 'safety-stop',
    p_recoverable => false,
    p_source => 'smoke'
  );

  IF (replayed_after_update ->> 'applied')::boolean
     OR (replayed_after_update -> 'recovery' ->> 'version')::bigint <> 1
     OR replayed_after_update -> 'recovery' ->> 'error_code'
        <> 'postgres_unavailable'
  THEN
    RAISE EXCEPTION
      'Older idempotency key did not return its recorded state: %',
      replayed_after_update;
  END IF;

  resumed := control.read_recovery_condition(
    'task:CONTROL-RECOVERY-SQL-001'
  );

  IF resumed ->> 'current_task_id' <> 'CONTROL-RECOVERY-SQL-001'
     OR resumed ->> 'error_code' <> 'parent_moved'
     OR resumed ->> 'resume_identity' <> 'task:CONTROL-RECOVERY-SQL-001'
  THEN
    RAISE EXCEPTION 'Recovery resume read failed: %', resumed;
  END IF;

  IF control.current_task_recovery_condition(
    'CONTROL-RECOVERY-SQL-001'
  ) <> resumed
  THEN
    RAISE EXCEPTION 'Task recovery read is not deterministic';
  END IF;

  state_id := (resumed ->> 'recovery_state_id')::uuid;

  IF (
    SELECT count(*)
    FROM control.recovery_state_events
    WHERE recovery_state_id = state_id
  ) <> 2 THEN
    RAISE EXCEPTION 'Expected two durable recovery events';
  END IF;

  IF (
    SELECT count(*)
    FROM control.audit_events
    WHERE action = 'recovery_condition_recorded'
      AND task_id = 'CONTROL-RECOVERY-SQL-001'
  ) <> 2 THEN
    RAISE EXCEPTION 'Expected two recovery audit events';
  END IF;

  IF (
    SELECT count(*)
    FROM control.executions
    WHERE task_id = 'CONTROL-RECOVERY-SQL-001'
  ) <> 1 OR (
    SELECT count(*)
    FROM control.failures
    WHERE task_id = 'CONTROL-RECOVERY-SQL-001'
  ) <> 1 THEN
    RAISE EXCEPTION 'Recovery writes changed historical evidence';
  END IF;

  IF (
    SELECT failure_class
    FROM control.failures
    WHERE failure_id = target_failure_id
  ) <> 'operator-wait' OR (
    SELECT recovery_action
    FROM control.failures
    WHERE failure_id = target_failure_id
  ) <> 'wait-operator' OR NOT (
    SELECT recoverable
    FROM control.failures
    WHERE failure_id = target_failure_id
  ) THEN
    RAISE EXCEPTION 'Existing failure compatibility defaults are unsafe';
  END IF;
END
$do$;

ROLLBACK;

SELECT 'RECOVERY_STATE_SMOKE_PASS' AS result;
