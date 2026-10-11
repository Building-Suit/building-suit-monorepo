BEGIN;
ALTER TABLE control.operator_gate_resolutions DROP CONSTRAINT operator_gate_resolutions_action_check;
ALTER TABLE control.operator_gate_resolutions ADD CONSTRAINT operator_gate_resolutions_action_check CHECK(action IN('ordinary-publication','registered-decision','protected-publication'));
CREATE OR REPLACE FUNCTION control.operator_task_gate_snapshot(p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; t control.tasks%ROWTYPE; c control.publication_readiness_contracts%ROWTYPE; e control.executions%ROWTYPE; v control.verification_runs%ROWTYPE; d record; item jsonb; protected_files jsonb; offers jsonb:='[]';
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run;
 IF NOT FOUND OR NOT control.run_is_actionable(r.status,r.current_task_id,r.finished_at) OR r.stop_requested OR r.maintenance_requested OR r.completed_tasks>=r.max_tasks THEN RETURN offers;END IF;
 IF r.current_task_id IS NOT NULL THEN SELECT * INTO t FROM control.tasks WHERE task_id=r.current_task_id;
 ELSE
 SELECT task.* INTO t FROM control.tasks task WHERE task.project_id=r.project_id AND task.workstream_slug=r.workstream_slug AND task.status IN('planned','ready','blocked')
 AND (EXISTS(SELECT 1 FROM control.dot_task_scope_authorities f WHERE f.run_id=p_run AND f.task_id=task.task_id) OR EXISTS(SELECT 1 FROM control.batch_task_admissions a WHERE a.run_id=p_run AND a.task_id=task.task_id)) ORDER BY task.sequence,task.task_id LIMIT 1;
 END IF;
 IF t.task_id IS NULL THEN RETURN offers;END IF;
 SELECT * INTO c FROM control.publication_readiness_contracts WHERE task_id=t.task_id;
 SELECT * INTO e FROM control.executions WHERE task_id=t.task_id ORDER BY attempt DESC LIMIT 1;
 SELECT * INTO v FROM control.verification_runs WHERE execution_id=e.execution_id ORDER BY verification_run_id DESC LIMIT 1;
 IF EXISTS(SELECT 1 FROM control.workstreams w WHERE w.project_id=t.project_id AND w.slug=t.workstream_slug AND w.publication_config->>'merge_authorized'='false' AND w.publication_config->>'deployment_authorized'='false' AND w.publication_config->>'hosted_database_changes_authorized'='false') AND t.status='passed' AND e.status='succeeded' AND v.status='passed' AND c.valid AND control.task_publication_authority_is_current(t.task_id) AND control.task_hard_dependencies_complete(t.task_id) AND control.task_blocking_decisions_clear(t.task_id) THEN
 item:=jsonb_build_object('run_id',r.run_id,'task_id',t.task_id,'action','ordinary-publication','reason','publication_operator_hold','requested_authorization','Authorize ordinary draft publication of '||t.task_id||' only using verification '||v.verification_run_id||'; preserve all protected-path, scope and verification gates. No merge, deployment or hosted product migrations.',
 'execution_id',e.execution_id,'verification_run_id',v.verification_run_id,'contract_fingerprint',c.contract_fingerprint,'input_generation',c.input_generation,'verification_fingerprint',control.verification_contract_fingerprint(t.task_id),'scope_fingerprint',control.dot_scope_fingerprint(t.task_id),'run_revision',r.run_revision,'max_tasks',r.max_tasks);
 offers:=offers||jsonb_build_array(item||jsonb_build_object('gate_fingerprint',md5(item::text)));
 SELECT jsonb_agg(jsonb_build_object('path',f->>'file','object',f->>'object','reason','Protected migration file; draft publication does not execute SQL')) INTO protected_files
 FROM jsonb_array_elements(coalesce(v.metadata#>'{verified_state,files}','[]')) f
 WHERE f->>'file' ~ '/supabase/migrations/[^/]+[.]sql$'
 AND f->>'object' ~ '^[0-9a-f]{40}$'
 AND EXISTS(SELECT 1 FROM control.failures failure,jsonb_array_elements_text(coalesce(failure.metadata->'protected_paths','[]')) p WHERE failure.task_id=t.task_id AND failure.error_code='publication_protected_path_operator_wait' AND p=f->>'file');
 IF protected_files IS NOT NULL THEN
 item:=item||jsonb_build_object('action','protected-publication','reason','publication_protected_path_operator_wait','protected_files',protected_files,'verified_state_fingerprint',v.metadata#>>'{verified_state,fingerprint}','requested_authorization','Authorize draft publication only of the exact protected files listed for '||t.task_id||' using verification '||v.verification_run_id||'. No merge, deployment, hosted migration execution or unrelated protected files.');
 offers:=offers||jsonb_build_array(item||jsonb_build_object('gate_fingerprint',md5(item::text)));
 END IF;

 END IF;
 FOR d IN SELECT decision.* FROM control.task_decisions link JOIN control.decisions decision USING(suit_slug,decision_id) WHERE link.task_id=t.task_id AND link.blocking AND decision.status IN('open','blocked','pending') AND decision.metadata->>'gate_kind' IN('owner_start','bounded_scope_release') LOOP
 -- Only an already registered decision, never invented or expanded scope.
 item:=jsonb_build_object('run_id',r.run_id,'task_id',t.task_id,'action','registered-decision','reason','decision:'||d.decision_id,'decision_id',d.decision_id,'decision_suit',d.suit_slug,'decision_updated_at',d.updated_at,'requested_authorization','Release registered decision '||d.decision_id||' for '||t.task_id||': '||d.title||'. '||d.decision_text,'run_revision',r.run_revision,'max_tasks',r.max_tasks,'scope_fingerprint',control.dot_scope_fingerprint(t.task_id));
 offers:=offers||jsonb_build_array(item||jsonb_build_object('gate_fingerprint',md5(item::text)));
 END LOOP;
 RETURN offers;
END $$;
CREATE OR REPLACE FUNCTION control.resolve_operator_task_gate(p_run uuid,p_fingerprint text,p_response text,p_evidence text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE item jsonb; prior control.operator_gate_resolutions%ROWTYPE; r control.workflow_runs%ROWTYPE; t control.tasks%ROWTYPE; result control.operator_gate_resolutions%ROWTYPE;
BEGIN
 IF p_response NOT IN('approve','reject') OR p_fingerprint !~ '^[a-f0-9]{32}$' OR length(btrim(p_evidence))<8 THEN RAISE EXCEPTION 'Invalid operator response';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('operator-gate:'||p_run::text,0));
 SELECT * INTO prior FROM control.operator_gate_resolutions WHERE run_id=p_run AND gate_fingerprint=p_fingerprint AND response=p_response;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'idempotent',true,'resolution_id',prior.resolution_id,'run_id',p_run,'task_id',prior.task_id,'response',prior.response);END IF;
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 SELECT value INTO item FROM jsonb_array_elements(control.operator_gate_offers(p_run)) WHERE value->>'gate_fingerprint'=p_fingerprint;
 IF item IS NULL THEN RAISE EXCEPTION 'Operator gate is stale, unsupported or outside the existing bounded run';END IF;
 SELECT * INTO t FROM control.tasks WHERE task_id=item->>'task_id' FOR UPDATE;
 INSERT INTO control.operator_gate_resolutions(run_id,task_id,gate_fingerprint,action,response,offer,audit_evidence) VALUES(p_run,t.task_id,p_fingerprint,item->>'action',p_response,item,p_evidence) RETURNING * INTO result;
 IF p_response='approve' AND item->>'action'='registered-decision' THEN
 UPDATE control.decisions SET status='approved',decided_at=now(),updated_at=now(),source='human-operator-gate',metadata=metadata||jsonb_build_object('operator_resolution_id',result.resolution_id) WHERE suit_slug=item->>'decision_suit' AND decision_id=item->>'decision_id';
 END IF;
 IF p_response='approve' AND item->>'action' IN('ordinary-publication','protected-publication') THEN
 UPDATE control.failures SET resolved_at=now() WHERE task_id=t.task_id AND error_code=CASE WHEN item->>'action'='protected-publication' THEN 'publication_protected_path_operator_wait' ELSE 'publication_operator_hold' END AND resolved_at IS NULL;
 UPDATE control.recovery_states SET status='resolved',resolved_at=now(),updated_at=now(),lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL WHERE current_task_id=t.task_id AND status='active' AND error_code=CASE WHEN item->>'action'='protected-publication' THEN 'publication_protected_path_operator_wait' ELSE 'publication_operator_hold' END;
 END IF;
 INSERT INTO control.audit_events(project_id,workstream_slug,task_id,action,source,new_value,metadata) VALUES(t.project_id,t.workstream_slug,t.task_id,'operator_gate_'||p_response,'human',to_jsonb(result),jsonb_build_object('same_run',true,'scope_expanded',false,'max_tasks_preserved',r.max_tasks));
 INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload) VALUES(t.task_id,'operator_gate_'||p_response,t.status,t.status,'human',to_jsonb(result));
 IF p_response='approve' THEN PERFORM pg_notify('bs_dot_wake',jsonb_build_object('run_id',p_run,'task_id',t.task_id,'reason','operator_gate_approved')::text);END IF;
 RETURN jsonb_build_object('ok',true,'idempotent',false,'resolution_id',result.resolution_id,'run_id',p_run,'task_id',t.task_id,'response',p_response);
END $$;

CREATE FUNCTION control.current_protected_publication_authority(p_task text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE a record; offer jsonb;
BEGIN
 FOR a IN SELECT receipt.* FROM control.operator_gate_resolutions receipt JOIN control.workflow_runs r USING(run_id) WHERE receipt.task_id=p_task AND r.current_task_id=p_task AND receipt.action='protected-publication' AND receipt.response='approve' ORDER BY receipt.resolution_id DESC LOOP
 SELECT value INTO offer FROM jsonb_array_elements(control.operator_task_gate_snapshot(a.run_id)) WHERE value->>'gate_fingerprint'=a.gate_fingerprint;
 IF offer IS NOT NULL THEN RETURN offer||jsonb_build_object('authorized',true,'resolution_id',a.resolution_id); END IF;
 END LOOP;
 RETURN '{"authorized":false}';
END $$;
REVOKE ALL ON FUNCTION control.current_protected_publication_authority(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.current_protected_publication_authority(text) TO bs_control_app;
COMMIT;
