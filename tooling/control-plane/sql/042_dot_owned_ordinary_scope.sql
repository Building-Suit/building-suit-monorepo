BEGIN;
CREATE OR REPLACE FUNCTION control.reconcile_ordinary_run_task(p_run uuid,p_task text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; g control.run_ordinary_publication_authorizations%ROWTYPE; f control.dot_task_scope_authorities%ROWTYPE; c control.publication_readiness_contracts%ROWTYPE; owned_scopes jsonb; previous_scopes jsonb;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 SELECT * INTO g FROM control.run_ordinary_publication_authorizations WHERE run_id=p_run;
 IF g.run_id IS NULL THEN RETURN jsonb_build_object('authorized',false);END IF;
 IF r.status<>'running' OR r.stop_requested OR r.maintenance_requested OR r.completed_tasks>=r.max_tasks
 OR g.revoked_at IS NOT NULL OR g.project_id<>r.project_id OR g.workstream_slug<>r.workstream_slug OR g.max_tasks<>r.max_tasks
 OR g.repair_id IS DISTINCT FROM r.admitted_repair_id OR g.controller_fingerprint<>r.controller_fingerprint THEN RAISE EXCEPTION 'Bounded run gate';END IF;
 IF r.admitted_repair_id IS NOT NULL THEN RAISE EXCEPTION 'Native run required';END IF;
 IF p_task IS NULL THEN RETURN jsonb_build_object('authorized',true,'waiting_for_acquisition',true);END IF;
 SELECT * INTO f FROM control.dot_task_scope_authorities WHERE run_id=r.run_id AND task_id=p_task;
 IF f.task_id IS NULL OR f.scope_fingerprint IS DISTINCT FROM control.dot_scope_fingerprint(p_task) THEN RAISE EXCEPTION 'Frozen task scope changed or unauthorized task';END IF;
 -- Resolve only frozen directory globs entirely inside this workstream's
 -- owned path. This derives from the operator grant, never worker output.
 SELECT coalesce(jsonb_agg(scope),'[]'::jsonb) INTO owned_scopes
 FROM control.tasks task JOIN control.workstreams w ON w.project_id=task.project_id AND w.slug=task.workstream_slug
 CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(task.metadata->'allowed_paths','[]')) scope
 WHERE task.task_id=p_task AND scope ~ '/\*\*$' AND left(scope,length(scope)-2) !~ '[*?\[\{]'
 AND (left(scope,length(scope)-2)=rtrim(w.application_path,'/')||'/' OR left(scope,length(scope)-2) LIKE rtrim(w.application_path,'/')||'/%')
 AND scope !~* '(^|/)\.env([./]|$)|(^|/)supabase/|(^|/)n8n(/|\.|-)|(^|/)\.github/workflows/|(^|/)(vercel|deploy)(/|\.|-)';
 SELECT coalesce(metadata->'publication_resolved_scopes','[]') INTO previous_scopes FROM control.tasks WHERE task_id=p_task;
 IF NOT(previous_scopes @> owned_scopes) THEN
 UPDATE control.tasks SET metadata=jsonb_set(metadata,'{publication_resolved_scopes}',(SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements(previous_scopes||owned_scopes))) WHERE task_id=p_task;
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(p_task,'ordinary_owned_scope_reconciled','dot',jsonb_build_object('run_id',p_run,'owned_scopes',owned_scopes,'prior_resolved_scopes',previous_scopes,'protected_paths_authorized',false,'frozen_scope_preserved',true));
 END IF;
 PERFORM control.refresh_publication_readiness_contract(p_task,'dot-run-scoped-ordinary-reconciliation');
 SELECT * INTO c FROM control.publication_readiness_contracts WHERE task_id=p_task;
 IF NOT c.valid OR jsonb_array_length(c.unresolved_scopes)>0 OR NOT control.task_hard_dependencies_complete(p_task) OR NOT control.task_blocking_decisions_clear(p_task)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(c.required_paths) p WHERE p ~* '(^|/)\.env([./]|$)|(^|/)supabase/(migrations/|config\.toml$|seed\.sql$)|(^|/)n8n(/|\.|-)|(^|/)\.github/workflows/|(^|/)(vercel|deploy)(/|\.|-)')
 THEN RAISE EXCEPTION 'Ordinary publication contract or protected-path gate';END IF;
 IF f.required_paths<>'null'::jsonb AND f.required_paths IS DISTINCT FROM c.required_paths THEN RAISE EXCEPTION 'Frozen required paths changed';END IF;
 IF f.required_paths='null'::jsonb THEN UPDATE control.dot_task_scope_authorities SET required_paths=c.required_paths WHERE run_id=p_run AND task_id=p_task;END IF;
 IF EXISTS(SELECT 1 FROM control.publication_preexecution_authorizations WHERE idempotency_key='dot:'||p_run||':'||p_task||':'||c.input_generation AND revoked_at IS NOT NULL) THEN RAISE EXCEPTION 'Explicit task authority revoked';END IF;
 IF jsonb_array_length(c.required_paths)>0 THEN
 INSERT INTO control.publication_preexecution_authorizations(task_id,contract_id,authorization_kind,authorized_paths,audit_evidence,content_risk_validation,idempotency_key,source)
 VALUES(p_task,c.contract_id,'ordinary',c.required_paths,g.audit_evidence,jsonb_build_object('dot_frozen_scope',true),'dot:'||p_run||':'||p_task||':'||c.input_generation,'human') ON CONFLICT(idempotency_key) DO NOTHING;
 END IF;
 INSERT INTO control.run_task_publication_authorities(run_id,task_id,input_generation,contract_fingerprint,verification_fingerprint)
 VALUES(p_run,p_task,c.input_generation,c.contract_fingerprint,control.verification_contract_fingerprint(p_task))
 ON CONFLICT(run_id,task_id) DO UPDATE SET input_generation=excluded.input_generation,contract_fingerprint=excluded.contract_fingerprint,verification_fingerprint=excluded.verification_fingerprint;
 RETURN jsonb_build_object('authorized',true,'run_id',p_run,'task_id',p_task);
END $$;

COMMIT;
