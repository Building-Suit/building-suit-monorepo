BEGIN;
CREATE OR REPLACE FUNCTION control.diagnose_native_run_admission(p_run uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,control AS $$
 SELECT jsonb_build_object('task_id',t.task_id,'title',t.title,'publication_current',control.task_publication_authority_is_current(t.task_id),
 'dependencies',(SELECT coalesce(jsonb_agg(jsonb_build_object('task_id',parent.task_id,'status',parent.status,'owned',EXISTS(SELECT 1 FROM control.workflow_runs owner WHERE owner.status='running' AND owner.current_task_id=parent.task_id))),'[]') FROM control.task_dependencies d JOIN control.tasks parent ON parent.task_id=d.depends_on_task_id WHERE d.task_id=t.task_id AND d.dependency_type='hard' AND parent.status<>'complete'),
 'decisions',(SELECT coalesce(jsonb_agg(jsonb_build_object('decision_id',d.decision_id,'status',d.status)),'[]') FROM control.task_decisions td JOIN control.decisions d ON d.suit_slug=td.suit_slug AND d.decision_id=td.decision_id WHERE td.task_id=t.task_id AND td.blocking AND d.status<>'approved'),
 'packet',control.generic_task_packet(t.task_id))
 FROM control.workflow_runs r JOIN control.tasks t ON t.project_id=r.project_id AND t.workstream_slug=r.workstream_slug AND t.suit_slug=r.suit_slug
 WHERE r.run_id=p_run AND r.status='running' AND r.current_task_id IS NULL AND r.completed_tasks<r.max_tasks AND r.admitted_repair_id IS NULL
 AND t.status IN('planned','ready') AND (NOT EXISTS(SELECT 1 FROM control.dot_task_scope_authorities f WHERE f.run_id=r.run_id) OR EXISTS(SELECT 1 FROM control.dot_task_scope_authorities f WHERE f.run_id=r.run_id AND f.task_id=t.task_id))
 ORDER BY (control.task_hard_dependencies_complete(t.task_id) AND control.task_blocking_decisions_clear(t.task_id)) DESC,t.priority,t.sequence,t.created_at LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION control.reconcile_native_run_admission(p_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; t control.tasks%ROWTYPE; w control.workstreams%ROWTYPE; d jsonb; scopes jsonb; old jsonb;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 IF r.status IS DISTINCT FROM 'running' OR r.stop_requested OR r.maintenance_requested OR r.completed_tasks>=r.max_tasks OR r.current_task_id IS NOT NULL OR r.admitted_repair_id IS NOT NULL THEN RETURN jsonb_build_object('reconciled',false,'reason','run_not_idle_native');END IF;
 d:=control.diagnose_native_run_admission(p_run);
 IF d IS NULL THEN RETURN jsonb_build_object('reconciled',false,'reason','no_registered_pending_task');END IF;
 IF jsonb_array_length(d->'dependencies')>0 OR jsonb_array_length(d->'decisions')>0 THEN RETURN d||jsonb_build_object('reconciled',false,'reason','genuine_readiness_gate');END IF;
 SELECT * INTO t FROM control.tasks WHERE task_id=d->>'task_id' FOR UPDATE;
 SELECT * INTO w FROM control.workstreams WHERE project_id=t.project_id AND slug=t.workstream_slug;
 -- Only a simple registered subtree wholly inside the owning app can resolve
 -- automatically. Cross-workstream and protected exact-path authority is unchanged.
 SELECT coalesce(jsonb_agg(value),'[]') INTO scopes FROM jsonb_array_elements_text(coalesce(t.metadata->'allowed_paths','[]')||coalesce(t.metadata->'source_allowed_paths','[]')) p
 WHERE value ~ '[*?\[\{]' AND value LIKE '%/**' AND regexp_replace(value,'/\*\*$','') !~ '[*?\[\{]'
 AND value !~ '(^/|(^|/)\.\.(/|$))' AND (regexp_replace(value,'/\*\*$','')=rtrim(w.application_path,'/') OR regexp_replace(value,'/\*\*$','') LIKE rtrim(w.application_path,'/')||'/%');
 old:=coalesce(t.metadata->'publication_resolved_scopes','[]');
 IF NOT old @> scopes THEN
 UPDATE control.tasks SET metadata=jsonb_set(metadata,'{publication_resolved_scopes}',(SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements(old||scopes))) WHERE task_id=t.task_id;
 END IF;
 PERFORM control.refresh_publication_readiness_contract(t.task_id,'dot-native-admission-diagnostics');
 IF NOT control.task_publication_authority_is_current(t.task_id) THEN RETURN control.diagnose_native_run_admission(p_run)||jsonb_build_object('reconciled',false,'reason','publication_authorization_required');END IF;
 IF NOT EXISTS(SELECT 1 FROM control.task_events WHERE task_id=t.task_id AND event_type='native_admission_reconciled' AND payload->>'run_id'=p_run::text) THEN
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(t.task_id,'native_admission_reconciled','dot',jsonb_build_object('run_id',p_run,'resolved_registered_scopes',scopes,'scope_unchanged',true,'run_limit_unchanged',true));END IF;
 RETURN control.diagnose_native_run_admission(p_run)||jsonb_build_object('reconciled',true,'reason','native_admission_ready');
END $$;
REVOKE ALL ON FUNCTION control.diagnose_native_run_admission(uuid),control.reconcile_native_run_admission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.diagnose_native_run_admission(uuid),control.reconcile_native_run_admission(uuid) TO bs_control_app;
COMMIT;
