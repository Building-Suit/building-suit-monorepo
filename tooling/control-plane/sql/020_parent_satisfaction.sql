BEGIN;

CREATE TABLE IF NOT EXISTS control.parent_satisfaction_evaluations (
  evaluation_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id text NOT NULL REFERENCES control.tasks(task_id) ON DELETE CASCADE,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  parent_branch text,
  parent_sha text,
  satisfied boolean NOT NULL,
  reason text NOT NULL,
  acceptance_criteria_digest text NOT NULL,
  source_task_id text,
  source_execution_id bigint REFERENCES control.executions(execution_id) ON DELETE SET NULL,
  source_verification_run_id bigint REFERENCES control.verification_runs(verification_run_id) ON DELETE SET NULL,
  source_commit_sha text,
  source_lineage_sha text,
  verification_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS parent_satisfaction_task_idx
  ON control.parent_satisfaction_evaluations(task_id, evaluation_id DESC);

CREATE OR REPLACE FUNCTION control.record_parent_satisfaction_evaluation(
  p_task_id text,
  p_fingerprint text,
  p_evidence jsonb,
  p_source text DEFAULT 'runner'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  recorded control.parent_satisfaction_evaluations%ROWTYPE;
  inserted boolean := false;
BEGIN
  IF p_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid parent-satisfaction fingerprint';
  END IF;

  IF COALESCE((p_evidence->>'satisfied')::boolean, false) THEN
    IF COALESCE(p_evidence->>'parent_branch', '') = ''
       OR COALESCE(p_evidence->>'parent_sha', '') !~ '^[0-9a-f]{40}$'
       OR COALESCE(p_evidence->>'acceptance_criteria_digest', '') !~ '^[0-9a-f]{64}$'
       OR COALESCE(p_evidence->>'reason', '') = ''
       OR jsonb_typeof(p_evidence->'verification_evidence') <> 'array'
       OR jsonb_array_length(p_evidence->'verification_evidence') = 0
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(p_evidence->'verification_evidence') item
         WHERE item->>'status' <> 'pass'
       ) THEN
      RAISE EXCEPTION 'Satisfied parent evaluation lacks required evidence';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM control.tasks source_task
      JOIN control.executions source_execution
        ON source_execution.task_id = source_task.task_id
      JOIN control.verification_runs source_run
        ON source_run.execution_id = source_execution.execution_id
      WHERE source_task.task_id = p_evidence->>'source_task_id'
        AND source_task.status = 'complete'
        AND source_execution.execution_id = NULLIF(p_evidence->>'source_execution_id', '')::bigint
        AND source_execution.status = 'succeeded'
        AND source_execution.commit_sha = p_evidence->>'source_commit_sha'
        AND source_run.verification_run_id = NULLIF(p_evidence->>'source_verification_run_id', '')::bigint
        AND source_run.status = 'passed'
    ) THEN
      RAISE EXCEPTION 'Satisfied parent evaluation source evidence is not authoritative';
    END IF;

    IF EXISTS (SELECT 1 FROM control.executions WHERE task_id = p_task_id)
       OR EXISTS (SELECT 1 FROM control.pull_requests WHERE task_id = p_task_id) THEN
      RAISE EXCEPTION 'Task % already has implementation or publication lineage', p_task_id;
    END IF;
  END IF;

  INSERT INTO control.parent_satisfaction_evaluations(
    task_id, fingerprint, parent_branch, parent_sha, satisfied, reason,
    acceptance_criteria_digest, source_task_id, source_execution_id,
    source_verification_run_id, source_commit_sha, source_lineage_sha,
    verification_evidence, metadata
  )
  VALUES (
    p_task_id,
    p_fingerprint,
    NULLIF(p_evidence->>'parent_branch', ''),
    NULLIF(p_evidence->>'parent_sha', ''),
    COALESCE((p_evidence->>'satisfied')::boolean, false),
    COALESCE(NULLIF(p_evidence->>'reason', ''), 'evaluation_incomplete'),
    COALESCE(NULLIF(p_evidence->>'acceptance_criteria_digest', ''), 'missing'),
    NULLIF(p_evidence->>'source_task_id', ''),
    NULLIF(p_evidence->>'source_execution_id', '')::bigint,
    NULLIF(p_evidence->>'source_verification_run_id', '')::bigint,
    NULLIF(p_evidence->>'source_commit_sha', ''),
    NULLIF(p_evidence->>'source_lineage_sha', ''),
    COALESCE(p_evidence->'verification_evidence', '[]'::jsonb),
    jsonb_build_object('evaluator', 'parent-satisfaction-v1')
  )
  ON CONFLICT (task_id, fingerprint) DO NOTHING
  RETURNING * INTO recorded;

  IF FOUND THEN
    inserted := true;
    INSERT INTO control.task_events(task_id, event_type, source, payload)
    VALUES (
      p_task_id,
      'parent_satisfaction_evaluated',
      p_source,
      jsonb_build_object(
        'evaluation_id', recorded.evaluation_id,
        'fingerprint', recorded.fingerprint,
        'parent_branch', recorded.parent_branch,
        'parent_sha', recorded.parent_sha,
        'satisfied', recorded.satisfied,
        'reason', recorded.reason,
        'verification_evidence', recorded.verification_evidence
      )
    );

    INSERT INTO control.audit_events(
      project_id, workstream_slug, task_id, action, source, new_value, reason, metadata
    )
    SELECT
      t.project_id, t.workstream_slug, t.task_id,
      'parent_satisfaction_evaluated', p_source, to_jsonb(recorded), recorded.reason,
      jsonb_build_object('fingerprint', recorded.fingerprint)
    FROM control.tasks t
    WHERE t.task_id = p_task_id;
  ELSE
    SELECT * INTO recorded
    FROM control.parent_satisfaction_evaluations
    WHERE task_id = p_task_id AND fingerprint = p_fingerprint;
  END IF;

  RETURN jsonb_build_object(
    'applied', inserted,
    'idempotent_replay', NOT inserted,
    'evaluation', to_jsonb(recorded)
  );
END;
$$;

CREATE OR REPLACE FUNCTION control.complete_parent_satisfied(
  p_task_id text,
  p_fingerprint text,
  p_source text DEFAULT 'runner'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  current_task control.tasks%ROWTYPE;
  evaluation control.parent_satisfaction_evaluations%ROWTYPE;
BEGIN
  SELECT * INTO current_task
  FROM control.tasks
  WHERE task_id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown task: %', p_task_id; END IF;

  SELECT * INTO evaluation
  FROM control.parent_satisfaction_evaluations
  WHERE task_id = p_task_id AND fingerprint = p_fingerprint AND satisfied = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No satisfied parent evaluation % for task %', p_fingerprint, p_task_id;
  END IF;

  IF current_task.status = 'complete'
     AND current_task.metadata->'parent_satisfaction_completion'->>'fingerprint' = p_fingerprint THEN
    RETURN jsonb_build_object(
      'action', 'complete_no_changes', 'status', 'complete',
      'idempotent_replay', true, 'evaluation', to_jsonb(evaluation)
    );
  END IF;

  IF current_task.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Task % cannot complete parent satisfaction from %', p_task_id, current_task.status;
  END IF;
  IF EXISTS (SELECT 1 FROM control.executions WHERE task_id = p_task_id) THEN
    RAISE EXCEPTION 'Task % already has an implementation execution', p_task_id;
  END IF;
  IF EXISTS (SELECT 1 FROM control.pull_requests WHERE task_id = p_task_id) THEN
    RAISE EXCEPTION 'Task % already has publication lineage', p_task_id;
  END IF;

  UPDATE control.tasks
  SET status = 'complete',
      engine_stage = 'complete_no_changes',
      metadata = metadata || jsonb_build_object(
        'parent_satisfaction_completion', jsonb_build_object(
          'fingerprint', evaluation.fingerprint,
          'evaluation_id', evaluation.evaluation_id,
          'parent_branch', evaluation.parent_branch,
          'parent_sha', evaluation.parent_sha,
          'reason', evaluation.reason,
          'source_task_id', evaluation.source_task_id,
          'source_execution_id', evaluation.source_execution_id,
          'source_verification_run_id', evaluation.source_verification_run_id,
          'source_commit_sha', evaluation.source_commit_sha,
          'source_lineage_sha', evaluation.source_lineage_sha,
          'verification_evidence', evaluation.verification_evidence,
          'completed_at', now()
        )
      )
  WHERE task_id = p_task_id;

  INSERT INTO control.task_events(task_id, event_type, from_status, to_status, source, payload)
  VALUES (
    p_task_id, 'parent_satisfaction_completed', 'in_progress', 'complete', p_source,
    jsonb_build_object(
      'evaluation_id', evaluation.evaluation_id,
      'fingerprint', evaluation.fingerprint,
      'parent_branch', evaluation.parent_branch,
      'parent_sha', evaluation.parent_sha,
      'reason', evaluation.reason,
      'verification_evidence', evaluation.verification_evidence
    )
  );

  INSERT INTO control.audit_events(
    project_id, workstream_slug, task_id, action, source, old_value, new_value, reason, metadata
  )
  VALUES (
    current_task.project_id, current_task.workstream_slug, p_task_id,
    'parent_satisfaction_completed', p_source,
    jsonb_build_object('status', 'in_progress'),
    jsonb_build_object('status', 'complete', 'engine_stage', 'complete_no_changes'),
    evaluation.reason,
    jsonb_build_object(
      'evaluation_id', evaluation.evaluation_id,
      'fingerprint', evaluation.fingerprint,
      'parent_branch', evaluation.parent_branch,
      'parent_sha', evaluation.parent_sha,
      'verification_evidence', evaluation.verification_evidence
    )
  );

  RETURN jsonb_build_object(
    'action', 'complete_no_changes', 'status', 'complete',
    'idempotent_replay', false, 'evaluation', to_jsonb(evaluation)
  );
END;
$$;

CREATE OR REPLACE FUNCTION control.generic_task_packet(p_task_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH packet AS (
    SELECT control.task_packet(p_task_id) AS value
  )
  SELECT packet.value || jsonb_build_object(
    'task', packet.value->'task' || jsonb_build_object(
      'verification_mode', control.resolved_verification_mode(t.task_id),
      'parent_satisfaction', t.metadata->'parent_satisfaction'
    ),
    'project', to_jsonb(p) - 'metadata',
    'workstream', to_jsonb(w) - 'metadata',
    'retry_policy', control.resolved_retry_policy(t.task_id),
    'preparation', t.metadata->'preparation'
  )
  FROM control.tasks t
  CROSS JOIN packet
  LEFT JOIN control.projects p ON p.project_id = t.project_id
  LEFT JOIN control.workstreams w
    ON w.project_id = t.project_id
   AND w.slug = t.workstream_slug
  WHERE t.task_id = p_task_id;
$$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bs_control_app') THEN
    GRANT SELECT, INSERT ON control.parent_satisfaction_evaluations TO bs_control_app;
    GRANT USAGE, SELECT ON SEQUENCE control.parent_satisfaction_evaluations_evaluation_id_seq TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.record_parent_satisfaction_evaluation(text, text, jsonb, text) TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.complete_parent_satisfied(text, text, text) TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.generic_task_packet(text) TO bs_control_app;
  END IF;
END
$do$;

COMMIT;
