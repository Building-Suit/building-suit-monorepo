BEGIN;
-- Operator-owned authority. Runtime workers may read, never grant or broaden it.
CREATE TABLE control.run_ordinary_publication_authorizations (
 run_id uuid PRIMARY KEY REFERENCES control.workflow_runs(run_id),
 project_id uuid NOT NULL REFERENCES control.projects(project_id),
 workstream_slug text NOT NULL,
 max_tasks integer NOT NULL,
 repair_id text NOT NULL REFERENCES control.batch_repair_generations(repair_id),
 controller_fingerprint text NOT NULL,
 audit_evidence text NOT NULL CHECK (btrim(audit_evidence)<>''),
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz
);
CREATE TABLE control.run_task_publication_authorities (
 run_id uuid NOT NULL REFERENCES control.run_ordinary_publication_authorizations(run_id),
 task_id text NOT NULL REFERENCES control.tasks(task_id),
 input_generation bigint NOT NULL,
 contract_fingerprint text NOT NULL,
 verification_fingerprint text NOT NULL,
 PRIMARY KEY(run_id,task_id)
);
CREATE OR REPLACE FUNCTION control.current_run_publication_authority(p_task_id text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT COALESCE((
 SELECT jsonb_build_object('authorized',true,'mode','ordinary-draft','run_id',r.run_id,
  'task_id',a.task_id,'input_generation',a.input_generation,'contract_fingerprint',a.contract_fingerprint,
  'verification_fingerprint',a.verification_fingerprint,'audit_evidence',g.audit_evidence)
 FROM control.workflow_runs r
 JOIN control.run_ordinary_publication_authorizations g USING(run_id)
 JOIN control.run_task_publication_authorities a USING(run_id)
 JOIN control.tasks t ON t.task_id=a.task_id
 JOIN control.workstreams w ON w.project_id=t.project_id AND w.slug=t.workstream_slug
 JOIN control.batch_task_admissions b ON b.run_id=r.run_id AND b.task_id=a.task_id AND b.repair_id=r.admitted_repair_id
 JOIN control.publication_readiness_contracts c ON c.task_id=a.task_id
 JOIN control.task_admission_generations i ON i.task_id=a.task_id
 WHERE r.current_task_id=p_task_id AND a.task_id=p_task_id AND r.status='running'
  AND NOT r.stop_requested AND NOT r.maintenance_requested AND r.completed_tasks<r.max_tasks
  AND g.revoked_at IS NULL AND g.project_id=r.project_id AND g.workstream_slug=r.workstream_slug
  AND t.project_id=r.project_id AND t.workstream_slug=r.workstream_slug
  AND g.max_tasks=r.max_tasks AND g.repair_id=r.admitted_repair_id
  AND g.controller_fingerprint=r.controller_fingerprint
  AND w.publication_config->>'merge_authorized'='false'
  AND w.publication_config->>'deployment_authorized'='false'
  AND w.publication_config->>'hosted_database_changes_authorized'='false'
  AND COALESCE(t.metadata->>'merge_authorization_required','false')='false'
  AND COALESCE(t.metadata->>'deployment_authorization_required','false')='false'
  AND b.status='claimed' AND c.valid AND c.input_generation=i.input_generation
  AND a.input_generation=i.input_generation AND b.input_generation=i.input_generation
  AND a.contract_fingerprint=c.contract_fingerprint AND b.contract_fingerprint=c.contract_fingerprint
  AND a.verification_fingerprint=control.verification_contract_fingerprint(a.task_id)
  AND b.verification_fingerprint=a.verification_fingerprint
  AND control.task_publication_authority_is_current(a.task_id)
  AND control.task_hard_dependencies_complete(a.task_id) AND control.task_blocking_decisions_clear(a.task_id)
 LIMIT 1),' {"authorized":false}'::jsonb);
$$;
CREATE OR REPLACE FUNCTION control.runtime_recovery_candidates(p_limit integer DEFAULT 10)
 RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(candidate)),'[]'::jsonb) FROM (
  SELECT r.run_id,r.current_task_id,r.suit_slug,r.max_tasks,r.completed_tasks,
   r.controller_lease_expires_at,s.next_action,s.failure_class,s.next_wake_at,s.lease_owner,s.lease_expires_at,
   o.operation_id,o.status AS operation_status,o.next_wake_at AS operation_wake
  FROM control.workflow_runs r
  LEFT JOIN control.tasks t ON t.task_id=r.current_task_id
  LEFT JOIN control.recovery_states s ON s.resume_identity='task:'||r.current_task_id
  LEFT JOIN control.runtime_operations o ON o.task_id=r.current_task_id AND o.status IN ('pending','running','settled')
  WHERE r.status='running' AND NOT r.stop_requested AND NOT r.maintenance_requested AND r.completed_tasks<r.max_tasks
  AND (
   (r.current_task_id IS NULL AND EXISTS(
    SELECT 1 FROM control.batch_task_admissions a
    JOIN control.tasks eligible USING(task_id)
    JOIN control.task_admission_generations i USING(task_id)
    JOIN control.publication_readiness_contracts c USING(task_id)
    WHERE a.run_id=r.run_id AND a.repair_id=r.admitted_repair_id AND a.status='admitted'
     AND eligible.status IN ('planned','ready') AND a.input_generation=i.input_generation
     AND c.valid AND c.input_generation=i.input_generation AND c.contract_fingerprint=a.contract_fingerprint
     AND a.verification_fingerprint=control.verification_contract_fingerprint(a.task_id)
     AND control.task_publication_authority_is_current(a.task_id)
     AND control.task_hard_dependencies_complete(a.task_id) AND control.task_blocking_decisions_clear(a.task_id)))
   OR (r.current_task_id IS NOT NULL
    AND s.next_action IS DISTINCT FROM 'safety-stop'
    AND (s.status IS DISTINCT FROM 'active' OR s.next_action NOT IN ('wait-operator','wait-decision','safety-stop')
     OR (s.next_action='wait-operator' AND s.error_code='publication_operator_hold' AND t.status='passed'
      AND (control.current_run_publication_authority(t.task_id)->>'authorized')::boolean))
    AND (t.status IN ('passed','complete') OR o.operation_id IS NOT NULL OR s.next_wake_at IS NULL OR s.next_wake_at<=now()))
  )
  ORDER BY r.started_at LIMIT greatest(1,least(p_limit,25))
 ) candidate;
$$;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bs_control_app') THEN
  -- Existing hosted default privileges may grant ALL to the application role.
  REVOKE ALL ON control.run_ordinary_publication_authorizations,control.run_task_publication_authorities FROM bs_control_app;
  GRANT SELECT ON control.run_ordinary_publication_authorizations,control.run_task_publication_authorities TO bs_control_app;
  GRANT EXECUTE ON FUNCTION control.current_run_publication_authority(text) TO bs_control_app;
 END IF;
END $$;
COMMIT;
