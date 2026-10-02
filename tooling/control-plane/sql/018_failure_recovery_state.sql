BEGIN;

/*
 * Canonical recovery vocabulary. These are tables rather than PostgreSQL
 * enums so later additive migrations can extend the contract without
 * rewriting historical rows or changing function signatures.
 */
CREATE TABLE IF NOT EXISTS control.recovery_actions (
  action_code text PRIMARY KEY,
  description text NOT NULL,
  terminal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (action_code ~ '^[a-z][a-z0-9-]*$')
);

INSERT INTO control.recovery_actions (
  action_code,
  description,
  terminal
)
VALUES
  ('retry', 'Retry the interrupted operation without changing product intent.', false),
  ('repair', 'Repair a verified implementation or product defect before retrying.', false),
  ('reconcile-runtime', 'Reconcile control-plane runtime or infrastructure state.', false),
  ('reconcile-repository', 'Reconcile the local worktree, branch, parent, or upstream state.', false),
  ('reconcile-publication', 'Reconcile pull-request or publication state without publishing automatically.', false),
  ('wait-external', 'Wait for a named external system or provider condition.', false),
  ('wait-decision', 'Wait for an explicit product or architecture decision.', false),
  ('wait-operator', 'Wait for an authorized operator action.', false),
  ('complete-no-changes', 'Complete an explicitly accepted no-change task.', true),
  ('safety-stop', 'Stop automation because continuing is unsafe.', true)
ON CONFLICT (action_code) DO UPDATE
SET
  description = EXCLUDED.description,
  terminal = EXCLUDED.terminal;


CREATE TABLE IF NOT EXISTS control.failure_classes (
  failure_class text PRIMARY KEY,
  description text NOT NULL,
  default_action text NOT NULL
    REFERENCES control.recovery_actions(action_code),
  default_recoverable boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (failure_class ~ '^[a-z][a-z0-9-]*$')
);

INSERT INTO control.failure_classes (
  failure_class,
  description,
  default_action,
  default_recoverable
)
VALUES
  ('transient-infrastructure', 'A temporary control-plane, network, process, or provider failure.', 'reconcile-runtime', true),
  ('repository-state', 'The worktree, branch, parent, upstream, or commit state needs reconciliation.', 'reconcile-repository', true),
  ('verification-product-defect', 'Deterministic verification exposed a product or implementation defect.', 'repair', true),
  ('flaky-verification', 'Verification evidence is inconsistent and requires a bounded clean rerun.', 'retry', true),
  ('publication-scope', 'The proposed publication contains missing, extra, or unauthorized scope.', 'reconcile-publication', true),
  ('publication-reconciliation', 'Remote publication state differs from the recorded local state.', 'reconcile-publication', true),
  ('no-change', 'A verified task produced no publishable repository change.', 'complete-no-changes', false),
  ('external-wait', 'Progress depends on a named external system or provider condition.', 'wait-external', true),
  ('decision-wait', 'Progress depends on an explicit product or architecture decision.', 'wait-decision', true),
  ('operator-wait', 'Progress requires an authorized operator action.', 'wait-operator', true),
  ('safety-stop', 'Automation stopped because continuing could violate a safety boundary.', 'safety-stop', false)
ON CONFLICT (failure_class) DO UPDATE
SET
  description = EXCLUDED.description,
  default_action = EXCLUDED.default_action,
  default_recoverable = EXCLUDED.default_recoverable;


/*
 * Existing failure rows receive conservative defaults. Known no-change
 * records can be classified precisely; all other historical records require
 * operator review rather than speculative automatic recovery.
 */
ALTER TABLE control.failures
  ADD COLUMN IF NOT EXISTS failure_class text,
  ADD COLUMN IF NOT EXISTS recovery_action text,
  ADD COLUMN IF NOT EXISTS recoverable boolean;

UPDATE control.failures
SET
  failure_class = CASE
    WHEN error_code = 'no_publishable_changes' THEN 'no-change'
    ELSE 'operator-wait'
  END,
  recovery_action = CASE
    WHEN error_code = 'no_publishable_changes' THEN 'complete-no-changes'
    ELSE 'wait-operator'
  END,
  recoverable = CASE
    WHEN error_code = 'no_publishable_changes' THEN false
    ELSE true
  END
WHERE failure_class IS NULL
   OR recovery_action IS NULL
   OR recoverable IS NULL;

ALTER TABLE control.failures
  ALTER COLUMN failure_class SET DEFAULT 'operator-wait',
  ALTER COLUMN failure_class SET NOT NULL,
  ALTER COLUMN recovery_action SET DEFAULT 'wait-operator',
  ALTER COLUMN recovery_action SET NOT NULL,
  ALTER COLUMN recoverable SET DEFAULT true,
  ALTER COLUMN recoverable SET NOT NULL;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'failures_failure_class_fkey'
      AND conrelid = 'control.failures'::regclass
  ) THEN
    ALTER TABLE control.failures
      ADD CONSTRAINT failures_failure_class_fkey
      FOREIGN KEY (failure_class)
      REFERENCES control.failure_classes(failure_class);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'failures_recovery_action_fkey'
      AND conrelid = 'control.failures'::regclass
  ) THEN
    ALTER TABLE control.failures
      ADD CONSTRAINT failures_recovery_action_fkey
      FOREIGN KEY (recovery_action)
      REFERENCES control.recovery_actions(action_code);
  END IF;
END
$do$;


CREATE TABLE IF NOT EXISTS control.recovery_states (
  recovery_state_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_identity text NOT NULL UNIQUE,

  project_id uuid
    REFERENCES control.projects(project_id)
    ON DELETE SET NULL,
  workstream_slug text,
  workflow_run_id uuid
    REFERENCES control.workflow_runs(run_id)
    ON DELETE SET NULL,
  current_task_id text
    REFERENCES control.tasks(task_id)
    ON DELETE SET NULL,
  execution_id bigint
    REFERENCES control.executions(execution_id)
    ON DELETE SET NULL,
  failure_id bigint
    REFERENCES control.failures(failure_id)
    ON DELETE SET NULL,

  failure_class text NOT NULL
    REFERENCES control.failure_classes(failure_class),
  error_code text,
  next_action text NOT NULL
    REFERENCES control.recovery_actions(action_code),
  recoverable boolean NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'resolved')),

  next_wake_at timestamptz,
  heartbeat_at timestamptz,
  lease_owner text,
  lease_token text,
  lease_expires_at timestamptz,

  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (length(btrim(resume_identity)) > 0),
  CHECK (jsonb_typeof(condition) = 'object'),
  CHECK (jsonb_typeof(metadata) = 'object'),
  CHECK (
    (status = 'active' AND resolved_at IS NULL)
    OR (status = 'resolved' AND resolved_at IS NOT NULL)
  ),
  CHECK (
    lease_expires_at IS NULL
    OR (lease_owner IS NOT NULL AND lease_token IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS recovery_states_task_idx
  ON control.recovery_states (current_task_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS recovery_states_wake_idx
  ON control.recovery_states (next_wake_at)
  WHERE status = 'active' AND next_wake_at IS NOT NULL;


CREATE TABLE IF NOT EXISTS control.recovery_state_events (
  recovery_event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recovery_state_id uuid NOT NULL
    REFERENCES control.recovery_states(recovery_state_id)
    ON DELETE RESTRICT,
  version bigint NOT NULL CHECK (version > 0),
  idempotency_key text NOT NULL,
  source text NOT NULL,
  previous_state jsonb,
  recorded_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recovery_state_id, version),
  UNIQUE (recovery_state_id, idempotency_key),
  CHECK (length(btrim(idempotency_key)) > 0),
  CHECK (length(btrim(source)) > 0)
);

CREATE INDEX IF NOT EXISTS recovery_state_events_state_idx
  ON control.recovery_state_events (
    recovery_state_id,
    recovery_event_id
  );


CREATE OR REPLACE FUNCTION control.read_recovery_condition(
  p_resume_identity text
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT to_jsonb(r)
      FROM control.recovery_states AS r
      WHERE r.resume_identity = p_resume_identity
    ),
    'null'::jsonb
  );
$$;


CREATE OR REPLACE FUNCTION control.current_task_recovery_condition(
  p_task_id text
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT to_jsonb(r)
      FROM control.recovery_states AS r
      WHERE r.current_task_id = p_task_id
        AND r.status = 'active'
      ORDER BY r.updated_at DESC, r.recovery_state_id
      LIMIT 1
    ),
    'null'::jsonb
  );
$$;


CREATE OR REPLACE FUNCTION control.record_recovery_condition(
  p_resume_identity text,
  p_idempotency_key text,
  p_failure_class text,
  p_error_code text,
  p_next_action text,
  p_recoverable boolean,
  p_source text,
  p_project_id uuid DEFAULT NULL,
  p_workstream_slug text DEFAULT NULL,
  p_workflow_run_id uuid DEFAULT NULL,
  p_current_task_id text DEFAULT NULL,
  p_execution_id bigint DEFAULT NULL,
  p_failure_id bigint DEFAULT NULL,
  p_next_wake_at timestamptz DEFAULT NULL,
  p_heartbeat_at timestamptz DEFAULT NULL,
  p_lease_owner text DEFAULT NULL,
  p_lease_token text DEFAULT NULL,
  p_lease_expires_at timestamptz DEFAULT NULL,
  p_condition jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_status text DEFAULT 'active'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  current_state control.recovery_states%ROWTYPE;
  replayed_state jsonb;
  previous_state jsonb;
  recorded_state jsonb;
  next_version bigint;
  state_exists boolean;
BEGIN
  IF p_resume_identity IS NULL
     OR length(btrim(p_resume_identity)) = 0
  THEN
    RAISE EXCEPTION 'resume_identity must not be empty';
  END IF;

  IF p_idempotency_key IS NULL
     OR length(btrim(p_idempotency_key)) = 0
  THEN
    RAISE EXCEPTION 'idempotency_key must not be empty';
  END IF;

  IF p_source IS NULL
     OR length(btrim(p_source)) = 0
  THEN
    RAISE EXCEPTION 'source must not be empty';
  END IF;

  IF p_status NOT IN ('active', 'resolved') THEN
    RAISE EXCEPTION 'Unsupported recovery status: %', p_status;
  END IF;

  IF jsonb_typeof(COALESCE(p_condition, '{}'::jsonb)) <> 'object'
     OR jsonb_typeof(COALESCE(p_metadata, '{}'::jsonb)) <> 'object'
  THEN
    RAISE EXCEPTION 'condition and metadata must be JSON objects';
  END IF;

  /* Serialize writers for a resume identity, including its first insert. */
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'control-recovery:' || p_resume_identity,
      0
    )
  );

  SELECT r.*
  INTO current_state
  FROM control.recovery_states AS r
  WHERE r.resume_identity = p_resume_identity
  FOR UPDATE;

  state_exists := FOUND;

  IF state_exists THEN
    SELECT event.recorded_state
    INTO replayed_state
    FROM control.recovery_state_events AS event
    WHERE event.recovery_state_id = current_state.recovery_state_id
      AND event.idempotency_key = p_idempotency_key;
  END IF;

  IF replayed_state IS NOT NULL THEN
    RETURN jsonb_build_object(
      'applied', false,
      'idempotent_replay', true,
      'recovery', replayed_state
    );
  END IF;

  IF state_exists THEN
    previous_state := to_jsonb(current_state);
    next_version := current_state.version + 1;

    UPDATE control.recovery_states
    SET
      project_id = p_project_id,
      workstream_slug = p_workstream_slug,
      workflow_run_id = p_workflow_run_id,
      current_task_id = p_current_task_id,
      execution_id = p_execution_id,
      failure_id = p_failure_id,
      failure_class = p_failure_class,
      error_code = p_error_code,
      next_action = p_next_action,
      recoverable = p_recoverable,
      status = p_status,
      next_wake_at = p_next_wake_at,
      heartbeat_at = p_heartbeat_at,
      lease_owner = p_lease_owner,
      lease_token = p_lease_token,
      lease_expires_at = p_lease_expires_at,
      condition = COALESCE(p_condition, '{}'::jsonb),
      metadata = COALESCE(p_metadata, '{}'::jsonb),
      version = next_version,
      resolved_at = CASE
        WHEN p_status = 'resolved' THEN now()
        ELSE NULL
      END,
      updated_at = now()
    WHERE recovery_state_id = current_state.recovery_state_id
    RETURNING * INTO current_state;
  ELSE
    next_version := 1;

    INSERT INTO control.recovery_states (
      resume_identity,
      project_id,
      workstream_slug,
      workflow_run_id,
      current_task_id,
      execution_id,
      failure_id,
      failure_class,
      error_code,
      next_action,
      recoverable,
      status,
      next_wake_at,
      heartbeat_at,
      lease_owner,
      lease_token,
      lease_expires_at,
      condition,
      metadata,
      version,
      resolved_at
    )
    VALUES (
      p_resume_identity,
      p_project_id,
      p_workstream_slug,
      p_workflow_run_id,
      p_current_task_id,
      p_execution_id,
      p_failure_id,
      p_failure_class,
      p_error_code,
      p_next_action,
      p_recoverable,
      p_status,
      p_next_wake_at,
      p_heartbeat_at,
      p_lease_owner,
      p_lease_token,
      p_lease_expires_at,
      COALESCE(p_condition, '{}'::jsonb),
      COALESCE(p_metadata, '{}'::jsonb),
      next_version,
      CASE WHEN p_status = 'resolved' THEN now() ELSE NULL END
    )
    RETURNING * INTO current_state;
  END IF;

  recorded_state := to_jsonb(current_state);

  INSERT INTO control.recovery_state_events (
    recovery_state_id,
    version,
    idempotency_key,
    source,
    previous_state,
    recorded_state
  )
  VALUES (
    current_state.recovery_state_id,
    next_version,
    p_idempotency_key,
    p_source,
    previous_state,
    recorded_state
  );

  INSERT INTO control.audit_events (
    project_id,
    workstream_slug,
    task_id,
    execution_id,
    action,
    source,
    old_value,
    new_value,
    metadata
  )
  VALUES (
    current_state.project_id,
    current_state.workstream_slug,
    current_state.current_task_id,
    current_state.execution_id,
    'recovery_condition_recorded',
    p_source,
    previous_state,
    recorded_state,
    jsonb_build_object(
      'recovery_state_id', current_state.recovery_state_id,
      'resume_identity', current_state.resume_identity,
      'idempotency_key', p_idempotency_key,
      'version', current_state.version
    )
  );

  RETURN jsonb_build_object(
    'applied', true,
    'idempotent_replay', false,
    'recovery', recorded_state
  );
END;
$$;


DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'bs_control_app'
  ) THEN
    GRANT SELECT ON control.recovery_actions TO bs_control_app;
    GRANT SELECT ON control.failure_classes TO bs_control_app;
    GRANT SELECT, INSERT, UPDATE ON control.recovery_states TO bs_control_app;
    GRANT SELECT, INSERT ON control.recovery_state_events TO bs_control_app;
    GRANT USAGE, SELECT ON SEQUENCE control.recovery_state_events_recovery_event_id_seq TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.read_recovery_condition(text) TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.current_task_recovery_condition(text) TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.record_recovery_condition(
      text, text, text, text, text, boolean, text,
      uuid, text, uuid, text, bigint, bigint,
      timestamptz, timestamptz, text, text, timestamptz,
      jsonb, jsonb, text
    ) TO bs_control_app;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'bs_dashboard_reader'
  ) THEN
    GRANT SELECT ON control.recovery_actions TO bs_dashboard_reader;
    GRANT SELECT ON control.failure_classes TO bs_dashboard_reader;
    GRANT SELECT ON control.recovery_states TO bs_dashboard_reader;
    GRANT SELECT ON control.recovery_state_events TO bs_dashboard_reader;
  END IF;
END
$do$;

COMMIT;
