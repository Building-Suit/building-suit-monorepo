BEGIN;

INSERT INTO control.recovery_actions(action_code, description, terminal)
VALUES
  ('reverify', 'Re-run verification for the existing succeeded implementation execution.', false)
ON CONFLICT (action_code) DO UPDATE
SET description = EXCLUDED.description, terminal = EXCLUDED.terminal;

INSERT INTO control.failure_classes(
  failure_class, description, default_action, default_recoverable
)
VALUES
  ('verification-lifecycle', 'The verifier could not start, resume, record, or finalize its authoritative run.', 'reverify', true),
  ('verification-configuration', 'A required verifier or safe verification-plan mapping is not configured.', 'wait-operator', true),
  ('verification-infrastructure', 'Verifier execution infrastructure is temporarily unavailable.', 'wait-external', true),
  ('verification-required-check-unavailable', 'A mandatory registered check cannot run in the current environment.', 'wait-operator', true)
ON CONFLICT (failure_class) DO UPDATE
SET
  description = EXCLUDED.description,
  default_action = EXCLUDED.default_action,
  default_recoverable = EXCLUDED.default_recoverable;

/* Preserve succeeded implementations whose only blocker was a missing local
 * database verifier (including SAS-M1-BOOT-001 execution 245). */
UPDATE control.verification_results
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'failure_class', 'verification-configuration',
  'classification_backfilled_by', '023_verification_repair_lifecycle'
)
WHERE check_name = 'database-tests'
  AND status = 'not_run'
  AND (
    metadata->>'selection_reason' = 'required_database_runner_unavailable'
    OR summary ILIKE 'No database verification command configured%'
    OR summary ILIKE 'No registered database verification command is configured%'
  );

UPDATE control.verification_runs AS run
SET metadata = COALESCE(run.metadata, '{}'::jsonb) || jsonb_build_object(
  'failure_class', 'verification-configuration',
  'recovery_action', 'wait-operator',
  'classification_backfilled_by', '023_verification_repair_lifecycle'
)
WHERE EXISTS (
  SELECT 1
  FROM control.verification_results AS result
  WHERE result.verification_run_id = run.verification_run_id
    AND result.metadata->>'classification_backfilled_by' = '023_verification_repair_lifecycle'
);

UPDATE control.failures AS failure
SET
  failure_class = 'verification-configuration',
  recovery_action = 'wait-operator',
  recoverable = true,
  retry_available = false,
  next_profile = NULL,
  metadata = COALESCE(failure.metadata, '{}'::jsonb) || jsonb_build_object(
    'classification', jsonb_build_object(
      'failure_class', 'verification-configuration',
      'recovery_action', 'wait-operator'
    ),
    'classification_backfilled_by', '023_verification_repair_lifecycle'
  )
WHERE failure.stage = 'verification'
  AND failure.resolved_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM control.verification_runs AS run
    WHERE run.execution_id = failure.execution_id
      AND run.metadata->>'classification_backfilled_by' = '023_verification_repair_lifecycle'
  );

/*
 * Older versions serialized through the task row but did not enforce the
 * invariant in the table. Preserve the newest authoritative run and retire
 * any stale concurrent rows before installing the constraint.
 */
WITH ranked AS (
  SELECT
    verification_run_id,
    row_number() OVER (
      PARTITION BY execution_id
      ORDER BY verification_run_id DESC
    ) AS position
  FROM control.verification_runs
  WHERE status = 'running'
)
UPDATE control.verification_runs AS run
SET
  status = 'cancelled',
  finished_at = COALESCE(run.finished_at, now()),
  metadata = COALESCE(run.metadata, '{}'::jsonb) ||
    jsonb_build_object('cancelled_reason', 'superseded_concurrent_verification_run')
FROM ranked
WHERE ranked.verification_run_id = run.verification_run_id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS verification_one_running_run_per_execution_uidx
  ON control.verification_runs(execution_id)
  WHERE status = 'running';

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bs_control_app') THEN
    GRANT SELECT ON control.recovery_actions TO bs_control_app;
    GRANT SELECT ON control.failure_classes TO bs_control_app;
  END IF;
END
$do$;

COMMIT;
