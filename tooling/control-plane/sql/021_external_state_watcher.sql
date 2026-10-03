BEGIN;

/*
 * The watcher claims exactly one due, explicitly described external wait at a
 * time. It never reads or mutates implementation executions, so polling is
 * independent of the task retry budget. SKIP LOCKED plus the persisted lease
 * makes concurrent controller invocations safe; an expired lease is eligible
 * for deterministic reclamation.
 */
CREATE OR REPLACE FUNCTION control.claim_due_external_recovery(
  p_owner text,
  p_token text,
  p_lease_seconds integer DEFAULT 120
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  claimed control.recovery_states%ROWTYPE;
BEGIN
  IF COALESCE(btrim(p_owner), '') = ''
     OR COALESCE(btrim(p_token), '') = '' THEN
    RAISE EXCEPTION 'Watcher owner and token are required';
  END IF;
  IF p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'Watcher lease must be between 30 and 600 seconds';
  END IF;

  WITH due AS (
    SELECT recovery_state_id
    FROM control.recovery_states
    WHERE status = 'active'
      AND recoverable = true
      AND next_action IN (
        'wait-external',
        'reconcile-repository',
        'reconcile-publication'
      )
      AND next_wake_at IS NOT NULL
      AND next_wake_at <= now()
      AND jsonb_typeof(condition->'watch') = 'object'
      AND (
        lease_expires_at IS NULL
        OR lease_expires_at <= now()
      )
    ORDER BY next_wake_at, recovery_state_id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE control.recovery_states AS recovery
  SET lease_owner = p_owner,
      lease_token = p_token,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      heartbeat_at = now(),
      updated_at = now()
  FROM due
  WHERE recovery.recovery_state_id = due.recovery_state_id
  RETURNING recovery.* INTO claimed;

  RETURN COALESCE(to_jsonb(claimed), 'null'::jsonb);
END;
$$;


CREATE OR REPLACE FUNCTION control.record_external_watch_result(
  p_resume_identity text,
  p_lease_token text,
  p_observation jsonb,
  p_actionable boolean,
  p_poll_count integer,
  p_next_wake_at timestamptz,
  p_source text DEFAULT 'external-watcher'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  current_state control.recovery_states%ROWTYPE;
  previous_state jsonb;
  recorded_state jsonb;
  previous_fingerprint text;
  observation_fingerprint text;
  state_changed boolean;
  next_version bigint;
  scheduled_wake timestamptz;
BEGIN
  IF jsonb_typeof(p_observation) <> 'object'
     OR COALESCE(p_observation->>'fingerprint', '') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'A fingerprinted watcher observation is required';
  END IF;
  IF p_poll_count IS NULL OR p_poll_count < 0 OR p_poll_count > 1000000 THEN
    RAISE EXCEPTION 'Invalid watcher poll count';
  END IF;
  IF p_next_wake_at IS NULL THEN
    RAISE EXCEPTION 'Watcher next wake is required';
  END IF;

  SELECT * INTO current_state
  FROM control.recovery_states
  WHERE resume_identity = p_resume_identity
  FOR UPDATE;

  IF NOT FOUND
     OR current_state.status <> 'active'
     OR current_state.next_action NOT IN (
       'wait-external',
       'reconcile-repository',
       'reconcile-publication'
     )
     OR current_state.lease_token IS DISTINCT FROM p_lease_token THEN
    RETURN jsonb_build_object(
      'applied', false,
      'reason', 'watcher_lease_lost'
    );
  END IF;

  previous_state := to_jsonb(current_state);
  previous_fingerprint := current_state.metadata->'watcher'->'observation'->>'fingerprint';
  observation_fingerprint := p_observation->>'fingerprint';
  state_changed := previous_fingerprint IS DISTINCT FROM observation_fingerprint;
  next_version := current_state.version + CASE WHEN state_changed THEN 1 ELSE 0 END;
  scheduled_wake := CASE
    WHEN p_actionable THEN now()
    ELSE GREATEST(
      now() + interval '30 seconds',
      LEAST(p_next_wake_at, now() + interval '15 minutes')
    )
  END;

  UPDATE control.recovery_states
  SET next_wake_at = scheduled_wake,
      heartbeat_at = now(),
      lease_owner = NULL,
      lease_token = NULL,
      lease_expires_at = NULL,
      metadata = metadata || jsonb_build_object(
        'watcher', jsonb_build_object(
          'observation', p_observation,
          'actionable', p_actionable,
          'poll_count', p_poll_count,
          'last_checked_at', now(),
          'next_wake_at', scheduled_wake
        )
      ),
      version = next_version,
      updated_at = now()
  WHERE recovery_state_id = current_state.recovery_state_id
  RETURNING * INTO current_state;

  recorded_state := to_jsonb(current_state);

  IF state_changed THEN
    INSERT INTO control.recovery_state_events(
      recovery_state_id, version, idempotency_key, source,
      previous_state, recorded_state
    )
    VALUES (
      current_state.recovery_state_id,
      next_version,
      'watcher:' || next_version || ':' || observation_fingerprint,
      p_source,
      previous_state,
      recorded_state
    );

    INSERT INTO control.audit_events(
      project_id, workstream_slug, task_id, execution_id,
      action, source, old_value, new_value, metadata
    )
    VALUES (
      current_state.project_id,
      current_state.workstream_slug,
      current_state.current_task_id,
      current_state.execution_id,
      CASE WHEN p_actionable
        THEN 'external_recovery_actionable'
        ELSE 'external_recovery_observed'
      END,
      p_source,
      previous_state,
      recorded_state,
      jsonb_build_object(
        'recovery_state_id', current_state.recovery_state_id,
        'resume_identity', current_state.resume_identity,
        'observation', p_observation,
        'actionable', p_actionable
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'applied', true,
    'changed', state_changed,
    'actionable', p_actionable,
    'recovery', recorded_state
  );
END;
$$;


DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bs_control_app') THEN
    GRANT EXECUTE ON FUNCTION control.claim_due_external_recovery(text, text, integer)
      TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.record_external_watch_result(
      text, text, jsonb, boolean, integer, timestamptz, text
    ) TO bs_control_app;
  END IF;
END
$do$;

COMMIT;
