\set ON_ERROR_STOP on

/* Run only against a disposable control database after migrations 001-025. */
CREATE TEMP TABLE verification_reopen_fixture_role (
  created_for_fixture boolean NOT NULL
) ON COMMIT PRESERVE ROWS;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bs_control_app') THEN
    INSERT INTO verification_reopen_fixture_role VALUES (false);
  ELSE
    CREATE ROLE bs_control_app NOLOGIN;
    INSERT INTO verification_reopen_fixture_role VALUES (true);
  END IF;
END
$do$;

/* Model the already-upgraded production state where migration 014 is recorded
 * but its reopen function is absent. */
DROP FUNCTION IF EXISTS control.reopen_verification(text, text, text);

DO $do$
BEGIN
  IF to_regprocedure('control.reopen_verification(text,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'representative pre-026 state still has reopen_verification';
  END IF;
END
$do$;

\ir ../sql/026_verification_reopen_lifecycle.sql

DO $do$
DECLARE
  fixture_project_id uuid;
  fixture_execution_id bigint;
  fixture_failure_id bigint;
  fixture_recovery_id uuid;
  reopen_result jsonb;
  verification_run_id bigint;
BEGIN
  IF to_regprocedure('control.reopen_verification(text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'migration 026 did not restore reopen_verification';
  END IF;

  IF NOT has_function_privilege(
    'bs_control_app',
    'control.reopen_verification(text,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'bs_control_app cannot execute reopen_verification';
  END IF;

  SELECT project_id INTO fixture_project_id
  FROM control.projects
  WHERE slug = 'building-suit';

  INSERT INTO control.tasks (
    task_id,
    suit_slug,
    project_id,
    workstream_slug,
    title,
    status,
    engine_stage,
    retry_policy_id
  )
  VALUES (
    'CP-REOPEN-UPGRADE-FIXTURE',
    'shop-suit',
    fixture_project_id,
    'shop-suit',
    'Verification reopen upgrade fixture',
    'failed',
    'verification_failed',
    'critical-five'
  );

  INSERT INTO control.executions (
    task_id,
    attempt,
    model_profile,
    status,
    worktree_path,
    branch_name,
    parent_branch,
    parent_sha,
    commit_sha,
    metadata,
    engine_stage,
    started_at,
    finished_at
  )
  VALUES (
    'CP-REOPEN-UPGRADE-FIXTURE',
    1,
    'standard',
    'succeeded',
    '/tmp/cp-reopen-upgrade-fixture',
    'codex/control-plane/reopen-upgrade-fixture',
    'stg',
    repeat('a', 40),
    repeat('b', 40),
    '{"implementation_result":{"preserved":true}}'::jsonb,
    'verification',
    now(),
    now()
  )
  RETURNING execution_id INTO fixture_execution_id;

  INSERT INTO control.failures (
    project_id,
    workstream_slug,
    task_id,
    execution_id,
    attempt,
    stage,
    error_code,
    summary,
    retry_available,
    legal_actions,
    failure_class,
    recovery_action,
    recoverable
  )
  VALUES (
    fixture_project_id,
    'shop-suit',
    'CP-REOPEN-UPGRADE-FIXTURE',
    fixture_execution_id,
    1,
    'verification',
    'database_runner_unavailable',
    'Fixture verifier configuration failed',
    false,
    '["inspect","reverify"]'::jsonb,
    'verification-configuration',
    'wait-operator',
    true
  )
  RETURNING failure_id INTO fixture_failure_id;

  INSERT INTO control.recovery_states (
    resume_identity,
    project_id,
    workstream_slug,
    current_task_id,
    execution_id,
    failure_id,
    failure_class,
    error_code,
    next_action,
    recoverable,
    status,
    condition,
    metadata
  )
  VALUES (
    'task:CP-REOPEN-UPGRADE-FIXTURE',
    fixture_project_id,
    'shop-suit',
    'CP-REOPEN-UPGRADE-FIXTURE',
    fixture_execution_id,
    fixture_failure_id,
    'verification-configuration',
    'database_runner_unavailable',
    'wait-operator',
    true,
    'active',
    '{"fingerprint":"obsolete-verifier-configuration"}'::jsonb,
    '{"fixture":true}'::jsonb
  )
  RETURNING recovery_state_id INTO fixture_recovery_id;

  reopen_result := control.reopen_verification(
    'CP-REOPEN-UPGRADE-FIXTURE',
    'supervisor',
    'fixture verifier configuration repaired'
  );

  IF reopen_result->>'execution_id' <> fixture_execution_id::text
     OR reopen_result->>'attempt' <> '1'
     OR reopen_result->>'worktree_path' <> '/tmp/cp-reopen-upgrade-fixture' THEN
    RAISE EXCEPTION 'reopen did not return the preserved execution lineage';
  END IF;

  IF (SELECT count(*) FROM control.executions
      WHERE task_id = 'CP-REOPEN-UPGRADE-FIXTURE') <> 1 THEN
    RAISE EXCEPTION 'reopen consumed an implementation attempt';
  END IF;

  IF (SELECT status FROM control.tasks
      WHERE task_id = 'CP-REOPEN-UPGRADE-FIXTURE') <> 'verification'
     OR (SELECT engine_stage FROM control.tasks
         WHERE task_id = 'CP-REOPEN-UPGRADE-FIXTURE') <> 'verification' THEN
    RAISE EXCEPTION 'reopen did not restore the verification stage';
  END IF;

  IF (SELECT status FROM control.executions
      WHERE execution_id = fixture_execution_id) <> 'succeeded'
     OR (SELECT attempt FROM control.executions
         WHERE execution_id = fixture_execution_id) <> 1
     OR (SELECT worktree_path FROM control.executions
         WHERE execution_id = fixture_execution_id) <>
        '/tmp/cp-reopen-upgrade-fixture'
     OR (SELECT metadata->'implementation_result' FROM control.executions
         WHERE execution_id = fixture_execution_id) IS DISTINCT FROM
        '{"preserved":true}'::jsonb THEN
    RAISE EXCEPTION 'reopen changed the implementation result';
  END IF;

  IF (SELECT resolved_at FROM control.failures
      WHERE failure_id = fixture_failure_id) IS NULL THEN
    RAISE EXCEPTION 'superseded verifier failure remains open';
  END IF;

  IF (SELECT status FROM control.recovery_states
      WHERE recovery_state_id = fixture_recovery_id) <> 'resolved'
     OR (SELECT next_wake_at FROM control.recovery_states
         WHERE recovery_state_id = fixture_recovery_id) IS NOT NULL THEN
    RAISE EXCEPTION 'superseded verifier recovery condition remains authoritative';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM control.recovery_state_events
    WHERE recovery_state_id = fixture_recovery_id
      AND recorded_state->>'status' = 'resolved'
  ) THEN
    RAISE EXCEPTION 'recovery resolution event is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM control.task_events
    WHERE task_id = 'CP-REOPEN-UPGRADE-FIXTURE'
      AND event_type = 'verification_reopened'
      AND source = 'supervisor'
      AND payload->>'execution_id' = fixture_execution_id::text
      AND payload->>'reason' = 'fixture verifier configuration repaired'
  ) THEN
    RAISE EXCEPTION 'verification reopen task event is incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM control.audit_events
    WHERE task_id = 'CP-REOPEN-UPGRADE-FIXTURE'
      AND action = 'verification_reopened'
      AND execution_id = fixture_execution_id
      AND reason = 'fixture verifier configuration repaired'
  ) THEN
    RAISE EXCEPTION 'verification reopen audit event is incomplete';
  END IF;

  verification_run_id := control.start_verification_run(
    'CP-REOPEN-UPGRADE-FIXTURE',
    fixture_execution_id,
    'runner',
    '{"verification_mode":"focused","fixture":true}'::jsonb
  );
  PERFORM control.update_verification_check(
    verification_run_id,
    'fixture-check',
    'pass',
    0,
    'same execution verification continued',
    '/tmp/cp-reopen-upgrade-fixture.log',
    1,
    'true',
    true,
    '{"fixture":true}'::jsonb
  );
  PERFORM control.finish_verification_run(
    'CP-REOPEN-UPGRADE-FIXTURE',
    verification_run_id
  );

  IF (SELECT status FROM control.tasks
      WHERE task_id = 'CP-REOPEN-UPGRADE-FIXTURE') <> 'passed'
     OR (SELECT count(*) FROM control.executions
         WHERE task_id = 'CP-REOPEN-UPGRADE-FIXTURE') <> 1 THEN
    RAISE EXCEPTION 'same-execution verification did not complete cleanly';
  END IF;

  /* Passed tasks are also eligible and retain the same implementation. */
  PERFORM control.reopen_verification(
    'CP-REOPEN-UPGRADE-FIXTURE',
    'human',
    'fixture independent review requested'
  );

  IF (SELECT count(*) FROM control.executions
      WHERE task_id = 'CP-REOPEN-UPGRADE-FIXTURE') <> 1 THEN
    RAISE EXCEPTION 'passed-task reopen consumed an implementation attempt';
  END IF;

  /* Ineligible task states fail closed. */
  BEGIN
    PERFORM control.reopen_verification(
      'CP-REOPEN-UPGRADE-FIXTURE',
      'human',
      'fixture duplicate reopen'
    );
    RAISE EXCEPTION 'verification task was incorrectly eligible for reopen';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'verification task was incorrectly eligible for reopen' THEN
        RAISE;
      END IF;
  END;

  UPDATE control.tasks
  SET status = 'failed', engine_stage = 'verification_failed'
  WHERE task_id = 'CP-REOPEN-UPGRADE-FIXTURE';

  UPDATE control.executions
  SET status = 'failed'
  WHERE execution_id = fixture_execution_id;

  BEGIN
    PERFORM control.reopen_verification(
      'CP-REOPEN-UPGRADE-FIXTURE',
      'human',
      'fixture failed execution'
    );
    RAISE EXCEPTION 'unsucceeded latest execution was incorrectly eligible';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'unsucceeded latest execution was incorrectly eligible' THEN
        RAISE;
      END IF;
  END;
END
$do$;

/* A clean-chain replay (where the function already exists) must be valid and
 * must preserve the explicit runtime grant. */
\ir ../sql/026_verification_reopen_lifecycle.sql

DO $do$
BEGIN
  IF to_regprocedure('control.reopen_verification(text,text,text)') IS NULL
     OR NOT has_function_privilege(
       'bs_control_app',
       'control.reopen_verification(text,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'migration 026 replay changed the function contract';
  END IF;
END
$do$;

DELETE FROM control.recovery_state_events
WHERE recovery_state_id IN (
  SELECT recovery_state_id
  FROM control.recovery_states
  WHERE current_task_id = 'CP-REOPEN-UPGRADE-FIXTURE'
);
DELETE FROM control.recovery_states
WHERE current_task_id = 'CP-REOPEN-UPGRADE-FIXTURE';
DELETE FROM control.audit_events
WHERE task_id = 'CP-REOPEN-UPGRADE-FIXTURE';
DELETE FROM control.tasks
WHERE task_id = 'CP-REOPEN-UPGRADE-FIXTURE';

DO $do$
BEGIN
  IF (SELECT created_for_fixture FROM verification_reopen_fixture_role) THEN
    REVOKE EXECUTE ON FUNCTION control.reopen_verification(text, text, text)
      FROM bs_control_app;
    DROP ROLE bs_control_app;
  END IF;
END
$do$;

SELECT 'VERIFICATION_REOPEN_UPGRADE_SMOKE_PASS' AS result;
