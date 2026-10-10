BEGIN;
-- Operator-written frozen scope, never writable by task workers.
CREATE TABLE control.dot_task_scope_authorities (
 run_id uuid NOT NULL REFERENCES control.run_ordinary_publication_authorizations(run_id),task_id text NOT NULL REFERENCES control.tasks(task_id),
 required_paths jsonb NOT NULL,scope_fingerprint text NOT NULL,audit_evidence text NOT NULL,
 PRIMARY KEY(run_id,task_id)
);
CREATE OR REPLACE FUNCTION control.dot_scope_fingerprint(p_task text) RETURNS text LANGUAGE sql STABLE SET search_path=pg_catalog,control AS $$
 SELECT md5(jsonb_build_object('allowed_paths',t.metadata->'allowed_paths','acceptance',t.acceptance_criteria,'title',t.title,'description',t.description,
 'requirements',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.requirement_id) FROM control.task_requirements r WHERE r.task_id=t.task_id),
 'decisions',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.decision_id) FROM control.task_decisions d WHERE d.task_id=t.task_id))::text)
 FROM control.tasks t WHERE t.task_id=p_task;
$$;
CREATE OR REPLACE FUNCTION control.refresh_dot_admission(p_run uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; grant_row control.run_ordinary_publication_authorizations%ROWTYPE;
 a record; c control.publication_readiness_contracts%ROWTYPE; frozen control.dot_task_scope_authorities%ROWTYPE; count_refreshed integer:=0;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 SELECT * INTO grant_row FROM control.run_ordinary_publication_authorizations WHERE run_id=p_run;
 IF r.run_id IS NULL OR r.stop_requested OR grant_row.revoked_at IS NOT NULL OR grant_row.run_id IS NULL
  OR grant_row.project_id<>r.project_id OR grant_row.workstream_slug<>r.workstream_slug OR grant_row.max_tasks<>r.max_tasks
  OR grant_row.repair_id<>r.admitted_repair_id OR grant_row.controller_fingerprint<>r.controller_fingerprint THEN RAISE EXCEPTION 'Bounded authority changed'; END IF;
 FOR a IN SELECT * FROM control.batch_task_admissions WHERE run_id=p_run AND repair_id=r.admitted_repair_id AND status IN('admitted','claimed') ORDER BY ordinal LOOP
  SELECT * INTO frozen FROM control.dot_task_scope_authorities WHERE run_id=p_run AND task_id=a.task_id;
  IF frozen.task_id IS NULL OR frozen.scope_fingerprint IS DISTINCT FROM control.dot_scope_fingerprint(a.task_id) THEN RAISE EXCEPTION 'Task scope changed: %',a.task_id; END IF;
  IF NOT control.task_blocking_decisions_clear(a.task_id) THEN RAISE EXCEPTION 'Decision gate: %',a.task_id; END IF;
  PERFORM control.refresh_publication_readiness_contract(a.task_id,'dot-config-reconciliation');
  SELECT * INTO c FROM control.publication_readiness_contracts WHERE task_id=a.task_id;
  IF NOT c.valid OR c.required_paths IS DISTINCT FROM frozen.required_paths OR jsonb_array_length(c.unresolved_scopes)>0
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(c.required_paths) p WHERE p ~* '(^|/)\.env([./]|$)|(^|/)supabase/(migrations/|config\.toml$|seed\.sql$)|(^|/)n8n(/|\.|-)|(^|/)\.github/workflows/|(^|/)(vercel|deploy)(/|\.|-)') THEN RAISE EXCEPTION 'Publication scope changed or protected: %',a.task_id; END IF;
  IF EXISTS(SELECT 1 FROM control.publication_preexecution_authorizations existing WHERE existing.idempotency_key='dot:'||p_run||':'||a.task_id||':'||c.input_generation AND existing.revoked_at IS NOT NULL) THEN RAISE EXCEPTION 'Explicit ordinary authority revoked'; END IF;
  IF jsonb_array_length(c.required_paths)>0 THEN
  INSERT INTO control.publication_preexecution_authorizations(task_id,contract_id,authorization_kind,authorized_paths,audit_evidence,content_risk_validation,idempotency_key,source)
  VALUES(a.task_id,c.contract_id,'ordinary',c.required_paths,frozen.audit_evidence,jsonb_build_object('dot_frozen_scope',true),'dot:'||p_run||':'||a.task_id||':'||c.input_generation,'human') ON CONFLICT(idempotency_key) DO NOTHING;
  END IF;
  UPDATE control.batch_task_admissions SET input_generation=c.input_generation,contract_fingerprint=c.contract_fingerprint,
   verification_fingerprint=control.verification_contract_fingerprint(a.task_id),updated_at=now() WHERE run_id=p_run AND task_id=a.task_id AND repair_id=r.admitted_repair_id;
  UPDATE control.run_task_publication_authorities SET input_generation=c.input_generation,contract_fingerprint=c.contract_fingerprint,
   verification_fingerprint=control.verification_contract_fingerprint(a.task_id) WHERE run_id=p_run AND task_id=a.task_id;
  IF NOT control.task_publication_authority_is_current(a.task_id) THEN RAISE EXCEPTION 'Publication remains held: %',a.task_id; END IF;
  count_refreshed:=count_refreshed+1;
 END LOOP;
 RETURN jsonb_build_object('refreshed',count_refreshed,'scope_preserved',true,'run_id',p_run);
END $$;
REVOKE ALL ON control.dot_task_scope_authorities FROM PUBLIC,bs_control_app;
GRANT SELECT ON control.dot_task_scope_authorities TO bs_control_app;
REVOKE ALL ON FUNCTION control.dot_scope_fingerprint(text),control.refresh_dot_admission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.dot_scope_fingerprint(text),control.refresh_dot_admission(uuid) TO bs_control_app;
COMMIT;
