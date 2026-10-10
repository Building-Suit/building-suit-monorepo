BEGIN;
-- Existing explicit bounded run authority and complete passing probe are required.
-- Automatic binding recovery permits no product or verifier source changes.
-- Never rewrite the original execution, failure records, or retry policy.
CREATE OR REPLACE FUNCTION control.reaccept_dot_verifier_only(
 p_task_id text, p_execution_id bigint, p_approval_event_id bigint, p_probe jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE e control.executions%ROWTYPE; t control.tasks%ROWTYPE; a control.task_events%ROWTYPE;
 v_id bigint; v_check jsonb; allowed jsonb; original jsonb;
BEGIN
 SELECT * INTO t FROM control.tasks WHERE task_id=p_task_id FOR UPDATE;
 SELECT * INTO e FROM control.executions WHERE execution_id=p_execution_id FOR UPDATE;
 IF t.task_id IS NULL OR e.task_id IS DISTINCT FROM p_task_id OR e.status<>'failed'
 OR e.execution_id IS DISTINCT FROM (SELECT execution_id FROM control.executions WHERE task_id=p_task_id ORDER BY attempt DESC,execution_id DESC LIMIT 1)
 THEN RAISE EXCEPTION 'Latest failed execution required'; END IF;
 SELECT * INTO a FROM control.task_events WHERE event_id=p_approval_event_id AND task_id=p_task_id
 AND event_type='verifier_reacceptance_authorized' AND source='dot';
 IF a.event_id IS NULL OR (a.payload->>'execution_id')::bigint IS DISTINCT FROM e.execution_id
 OR (a.payload->>'attempt')::integer IS DISTINCT FROM e.attempt
 THEN RAISE EXCEPTION 'Exact bounded Dot verifier-only authorization required'; END IF;
 allowed:=a.payload->'verifier_paths'; original:=e.metadata->'verification_probe_verified_state';
 IF jsonb_typeof(allowed) IS DISTINCT FROM 'array' OR jsonb_array_length(allowed)=0
 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(allowed) p WHERE p !~ '/tests/' OR p ~ '(^|/)\.\./|/migrations/')
 THEN RAISE EXCEPTION 'Only exact verifier test paths may change'; END IF;
 IF t.status NOT IN ('failed','passed') OR NOT EXISTS(SELECT 1 FROM control.workflow_runs r
 WHERE r.run_id=(a.payload->>'run_id')::uuid AND r.current_task_id=p_task_id AND r.status='running' AND NOT r.maintenance_requested AND NOT r.stop_requested
 AND EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations grant_row WHERE grant_row.run_id=r.run_id AND grant_row.revoked_at IS NULL AND grant_row.max_tasks=r.max_tasks AND grant_row.repair_id=r.admitted_repair_id AND grant_row.controller_fingerprint=r.controller_fingerprint))
 THEN RAISE EXCEPTION 'Original authorized bounded run required'; END IF;
 IF p_probe->>'task_id' IS DISTINCT FROM p_task_id OR p_probe->>'ok' IS DISTINCT FROM 'true'
 OR p_probe->>'passed' IS DISTINCT FROM 'true' OR jsonb_typeof(p_probe->'checks') IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_probe->'checks')=0
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_probe->'checks') c WHERE coalesce(c->>'status','') NOT IN ('pass','skipped') OR (coalesce(c->>'required','true')<>'false' AND c->>'status' IS DISTINCT FROM 'pass'))
 OR jsonb_typeof(a.payload->'required_checks') IS DISTINCT FROM 'array' OR jsonb_array_length(a.payload->'required_checks')=0
 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(a.payload->'required_checks') n WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_probe->'checks') chk WHERE chk->>'name'=n AND chk->>'status'='pass' AND coalesce(chk->>'required','true')<>'false'))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(e.metadata->'verification_probe_failures') f WHERE NOT EXISTS(
 SELECT 1 FROM jsonb_array_elements(p_probe->'checks') c WHERE c->>'name'=f->>'name' AND c->>'status'='pass' AND coalesce(c->>'required','true')<>'false'))
 THEN RAISE EXCEPTION 'Complete mandatory passing probe required'; END IF;
 IF original->'files' IS NULL OR jsonb_array_length(original->'files')=0
 OR p_probe#>>'{verified_state,base_sha}' IS DISTINCT FROM original->>'base_sha'
 OR coalesce(p_probe#>>'{verified_state,fingerprint}','') !~ '^[0-9a-f]{64}$'
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(original->'files') old
 FULL JOIN jsonb_array_elements(p_probe#>'{verified_state,files}') new ON old->>'file'=new->>'file'
 WHERE old->>'object' IS DISTINCT FROM new->>'object')
 THEN RAISE EXCEPTION 'Product source lineage must be unchanged'; END IF;
 SELECT verification_run_id INTO v_id FROM control.verification_runs WHERE execution_id=e.execution_id
 AND metadata->>'approval_event_id'=p_approval_event_id::text AND status='passed';
 IF FOUND THEN RETURN jsonb_build_object('passed',true,'idempotent',true,'verification_run_id',v_id,'execution_id',e.execution_id,'attempt',e.attempt); END IF;
 INSERT INTO control.verification_runs(execution_id,status,source,verification_mode,metadata,finished_at)
 VALUES(e.execution_id,'passed','codex','focused',jsonb_build_object('verifier_only_reacceptance',true,'approval_event_id',a.event_id,'verified_state',p_probe->'verified_state','preserved_failed_execution',true),now()) RETURNING verification_run_id INTO v_id;
 FOR v_check IN SELECT DISTINCT ON (value->>'name') value FROM jsonb_array_elements(p_probe->'checks') LOOP
 INSERT INTO control.verification_results(execution_id,verification_run_id,check_name,command,status,exit_code,summary,log_path,metadata,finished_at)
 VALUES(e.execution_id,v_id,v_check->>'name',v_check->>'command',v_check->>'status',(v_check->>'exit_code')::integer,v_check->>'summary',v_check->>'log_path',jsonb_build_object('required',coalesce(v_check->'required','true'::jsonb),'verifier_only_reacceptance',true),now());
 END LOOP;
 UPDATE control.tasks SET status='passed',engine_stage='publication' WHERE task_id=p_task_id;
 INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload)
 VALUES(p_task_id,'verifier_only_reaccepted',t.status,'passed','codex',jsonb_build_object('verification_run_id',v_id,'execution_id',e.execution_id,'attempt',e.attempt,'approval_event_id',a.event_id,'historical_failures_preserved',true));
 INSERT INTO control.audit_events(project_id,workstream_slug,task_id,execution_id,action,source,new_value,reason)
 VALUES(t.project_id,t.workstream_slug,p_task_id,e.execution_id,'verifier_only_reaccepted','codex',jsonb_build_object('verification_run_id',v_id,'attempt',e.attempt),'Bounded-authorized Dot verifier-only reacceptance; execution/history/budget unchanged');
 RETURN jsonb_build_object('passed',true,'verification_run_id',v_id,'execution_id',e.execution_id,'attempt',e.attempt);
END $$;
REVOKE ALL ON FUNCTION control.reaccept_dot_verifier_only(text,bigint,bigint,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.reaccept_dot_verifier_only(text,bigint,bigint,jsonb) TO bs_control_app;
COMMIT;
