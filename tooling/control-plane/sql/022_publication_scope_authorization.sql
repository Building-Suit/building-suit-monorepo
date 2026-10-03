BEGIN;

CREATE TABLE IF NOT EXISTS control.publication_scope_authorizations (
  authorization_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id text NOT NULL REFERENCES control.tasks(task_id) ON DELETE CASCADE,
  execution_id bigint NOT NULL REFERENCES control.executions(execution_id) ON DELETE RESTRICT,
  verification_run_id bigint NOT NULL REFERENCES control.verification_runs(verification_run_id) ON DELETE RESTRICT,
  failure_id bigint NOT NULL REFERENCES control.failures(failure_id) ON DELETE RESTRICT,
  recovery_state_id uuid REFERENCES control.recovery_states(recovery_state_id) ON DELETE SET NULL,
  requested_paths jsonb NOT NULL,
  old_allowed_paths jsonb NOT NULL,
  new_allowed_paths jsonb NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(requested_paths) = 'array'),
  CHECK (jsonb_typeof(old_allowed_paths) = 'array'),
  CHECK (jsonb_typeof(new_allowed_paths) = 'array')
);

CREATE OR REPLACE FUNCTION control.authorize_publication_scope(
  p_task_id text,
  p_failure_id bigint,
  p_recovery_state_id uuid,
  p_requested_paths jsonb,
  p_idempotency_key text,
  p_source text DEFAULT 'human'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  replay control.publication_scope_authorizations%ROWTYPE;
  current_task control.tasks%ROWTYPE;
  current_failure control.failures%ROWTYPE;
  current_execution control.executions%ROWTYPE;
  latest_verification_run_id bigint;
  latest_verification_status text;
  matching_recovery_id uuid;
  project_paths jsonb;
  waiting_paths jsonb;
  requested_paths jsonb;
  old_paths jsonb;
  new_paths jsonb;
  authorization control.publication_scope_authorizations%ROWTYPE;
BEGIN
  SELECT * INTO replay
  FROM control.publication_scope_authorizations
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF replay.task_id <> p_task_id OR replay.requested_paths <> p_requested_paths THEN
      RAISE EXCEPTION 'Publication authorization idempotency key conflicts with prior input';
    END IF;
    RETURN jsonb_build_object(
      'authorized', true,
      'idempotent', true,
      'authorization_id', replay.authorization_id,
      'task_id', replay.task_id,
      'execution_id', replay.execution_id,
      'verification_run_id', replay.verification_run_id,
      'failure_id', replay.failure_id,
      'old_allowed_paths', replay.old_allowed_paths,
      'new_allowed_paths', replay.new_allowed_paths
    );
  END IF;

  IF p_failure_id IS NULL THEN
    RAISE EXCEPTION 'No matching publication-scope wait exists';
  END IF;
  IF jsonb_typeof(p_requested_paths) <> 'array' OR jsonb_array_length(p_requested_paths) = 0 THEN
    RAISE EXCEPTION 'Exact requested publication paths are required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('publication-scope:' || p_task_id, 0));

  SELECT * INTO current_task FROM control.tasks
  WHERE task_id = p_task_id FOR UPDATE;
  IF NOT FOUND OR current_task.status <> 'passed' THEN
    RAISE EXCEPTION 'Task % must be passed before publication authorization', p_task_id;
  END IF;

  SELECT * INTO current_failure FROM control.failures
  WHERE failure_id = p_failure_id
    AND task_id = p_task_id
    AND stage = 'publication'
    AND error_code = 'publication_scope_operator_wait'
    AND resolved_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No matching open publication-scope failure';
  END IF;

  SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb)
  INTO requested_paths
  FROM (SELECT DISTINCT value FROM jsonb_array_elements_text(p_requested_paths)) requested;
  SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb)
  INTO waiting_paths
  FROM (
    SELECT DISTINCT value
    FROM jsonb_array_elements_text(COALESCE(current_failure.metadata #> '{classification,waiting}', '[]'::jsonb))
  ) waiting;
  IF requested_paths <> waiting_paths THEN
    RAISE EXCEPTION 'Authorization must match the exact current publication waiting paths';
  END IF;

  SELECT p.allowed_publication_paths INTO project_paths
  FROM control.projects p WHERE p.project_id = current_task.project_id;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(requested_paths) requested(path)
    WHERE path = '' OR path LIKE '/%' OR path ~ '(^|/)\.\.(/|$)' OR path ~ '[*?\[\{]'
       OR path ~* '(^|/)\.env([./]|$)|(^|/)(secrets?|credentials?)(/|\.|$)|(^|/)supabase/migrations/|(^|/)n8n(/|\.|-)|(^|/)\.github/workflows/|(^|/)(vercel|deploy)(/|\.|-)'
       OR NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(project_paths) boundary(path_prefix)
         WHERE requested.path = rtrim(boundary.path_prefix, '/')
            OR requested.path LIKE rtrim(boundary.path_prefix, '/') || '/%'
       )
  ) THEN
    RAISE EXCEPTION 'Requested path is protected, invalid, or outside the project publication boundary';
  END IF;

  SELECT * INTO current_execution FROM control.executions
  WHERE task_id = p_task_id ORDER BY attempt DESC LIMIT 1;
  IF NOT FOUND OR current_execution.status <> 'succeeded' THEN
    RAISE EXCEPTION 'Latest task execution must remain succeeded';
  END IF;
  SELECT verification_run_id, status
  INTO latest_verification_run_id, latest_verification_status
  FROM control.verification_runs
  WHERE execution_id = current_execution.execution_id
  ORDER BY verification_run_id DESC LIMIT 1;
  IF latest_verification_run_id IS NULL OR latest_verification_status <> 'passed' THEN
    RAISE EXCEPTION 'Latest task execution verification must remain passed';
  END IF;

  SELECT recovery_state_id INTO matching_recovery_id
  FROM control.recovery_states
  WHERE current_task_id = p_task_id
    AND failure_id = p_failure_id
    AND failure_class = 'publication-scope'
    AND status = 'active'
  ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  IF p_recovery_state_id IS NOT NULL AND matching_recovery_id IS DISTINCT FROM p_recovery_state_id THEN
    RAISE EXCEPTION 'Publication recovery condition does not match the requested authorization';
  END IF;

  old_paths := COALESCE(current_task.metadata->'allowed_paths', '[]'::jsonb);
  SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb)
  INTO new_paths
  FROM (
    SELECT DISTINCT value FROM jsonb_array_elements_text(old_paths)
    UNION
    SELECT value FROM jsonb_array_elements_text(requested_paths)
  ) merged;

  UPDATE control.tasks
  SET metadata = jsonb_set(metadata, '{allowed_paths}', new_paths, true)
  WHERE task_id = p_task_id;
  UPDATE control.failures SET resolved_at = now()
  WHERE failure_id = p_failure_id AND resolved_at IS NULL;
  IF matching_recovery_id IS NOT NULL THEN
    UPDATE control.recovery_states
    SET status = 'resolved', resolved_at = now(), updated_at = now(),
        lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL
    WHERE recovery_state_id = matching_recovery_id AND status = 'active';
  END IF;

  INSERT INTO control.publication_scope_authorizations(
    task_id, execution_id, verification_run_id, failure_id, recovery_state_id,
    requested_paths, old_allowed_paths, new_allowed_paths, idempotency_key, source
  ) VALUES (
    p_task_id, current_execution.execution_id, latest_verification_run_id,
    p_failure_id, matching_recovery_id, requested_paths, old_paths, new_paths,
    p_idempotency_key, p_source
  ) RETURNING * INTO authorization;

  INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload)
  VALUES (p_task_id,'publication_scope_authorized','passed','passed',p_source,
    jsonb_build_object('authorization_id',authorization.authorization_id,'failure_id',p_failure_id,
      'execution_id',current_execution.execution_id,'verification_run_id',latest_verification_run_id,
      'old_allowed_paths',old_paths,'new_allowed_paths',new_paths));
  INSERT INTO control.audit_events(project_id,workstream_slug,task_id,execution_id,action,source,old_value,new_value,metadata)
  VALUES (current_task.project_id,current_task.workstream_slug,p_task_id,current_execution.execution_id,
    'publication_scope_authorized',p_source,
    jsonb_build_object('allowed_paths',old_paths),jsonb_build_object('allowed_paths',new_paths),
    jsonb_build_object('authorization_id',authorization.authorization_id,'failure_id',p_failure_id,
      'verification_run_id',latest_verification_run_id,'requested_paths',requested_paths));

  RETURN jsonb_build_object(
    'authorized', true, 'idempotent', false,
    'authorization_id', authorization.authorization_id,
    'task_id', p_task_id, 'execution_id', current_execution.execution_id,
    'verification_run_id', latest_verification_run_id, 'failure_id', p_failure_id,
    'old_allowed_paths', old_paths, 'new_allowed_paths', new_paths
  );
END;
$$;

CREATE OR REPLACE FUNCTION control.generic_task_packet(p_task_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH packet AS (SELECT control.task_packet(p_task_id) AS value)
  SELECT packet.value || jsonb_build_object(
    'task', packet.value->'task' || jsonb_build_object(
      'verification_mode', control.resolved_verification_mode(t.task_id),
      'parent_satisfaction', t.metadata->'parent_satisfaction',
      'allowed_paths', COALESCE(t.metadata->'allowed_paths', '[]'::jsonb)
    ),
    'project', to_jsonb(p) - 'metadata',
    'workstream', to_jsonb(w) - 'metadata',
    'retry_policy', control.resolved_retry_policy(t.task_id),
    'preparation', t.metadata->'preparation',
    'publication_boundaries', jsonb_build_object(
      'task_paths', COALESCE(t.metadata->'allowed_paths', '[]'::jsonb),
      'source_paths', COALESCE(t.metadata->'source_allowed_paths', '[]'::jsonb),
      'workstream_paths', CASE WHEN w.application_path IS NULL THEN '[]'::jsonb
        ELSE jsonb_build_array(rtrim(w.application_path, '/') || '/') END,
      'project_paths', COALESCE(p.allowed_publication_paths, '[]'::jsonb)
    )
  )
  FROM control.tasks t CROSS JOIN packet
  LEFT JOIN control.projects p ON p.project_id = t.project_id
  LEFT JOIN control.workstreams w ON w.project_id = t.project_id AND w.slug = t.workstream_slug
  WHERE t.task_id = p_task_id;
$$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bs_control_app') THEN
    GRANT SELECT, INSERT ON control.publication_scope_authorizations TO bs_control_app;
    GRANT USAGE, SELECT ON SEQUENCE control.publication_scope_authorizations_authorization_id_seq TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.authorize_publication_scope(text,bigint,uuid,jsonb,text,text) TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.generic_task_packet(text) TO bs_control_app;
  END IF;
END
$do$;

COMMIT;
