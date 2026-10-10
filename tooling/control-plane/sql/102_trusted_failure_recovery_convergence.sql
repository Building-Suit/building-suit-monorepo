BEGIN;
-- Convergence is an audited current-pointer transition, not a second engine.
CREATE FUNCTION control.converge_lifecycle_recovery(p_task text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; s control.recovery_states%ROWTYPE; g jsonb; class text; action text; identity text; result jsonb; reviewed text;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE current_task_id=p_task AND status='running' AND NOT stop_requested AND NOT maintenance_requested FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM control.tasks WHERE task_id=p_task AND status='failed') THEN RETURN jsonb_build_object('converged',false);END IF;
 g:=control.current_lifecycle_failure(p_task);
 IF g->>'classification' NOT IN('VERIFIER_INFRA','CONFIGURATION','PRODUCT_DEFECT') OR (g->'evidence'->>'verification_run_id')::bigint IS DISTINCT FROM (SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=(g->>'execution_id')::bigint) THEN RETURN jsonb_build_object('converged',false);END IF;
 -- Every required failure must have a registered receipt and an exact review.
 IF NOT EXISTS(SELECT 1 FROM control.verification_results v WHERE execution_id=(g->>'execution_id')::bigint AND verification_run_id=(g->'evidence'->>'verification_run_id')::bigint AND status IN('fail','not_run','unavailable')) OR EXISTS(
 SELECT 1 FROM control.verification_results v LEFT JOIN control.verification_failure_reviews review USING(verification_id)
 WHERE v.execution_id=(g->>'execution_id')::bigint AND v.verification_run_id=(g->'evidence'->>'verification_run_id')::bigint AND v.status IN('fail','not_run','unavailable') AND coalesce((v.metadata->>'required')::boolean,true)
 AND (v.trusted_receipt IS NULL OR v.trusted_registration IS NULL OR review.evidence->>'classification' IS NULL OR review.check_fingerprint IS DISTINCT FROM md5(jsonb_build_array(v.execution_id,v.verification_run_id,v.check_name,v.command,v.exit_code,v.status,v.log_path)::text))) THEN RETURN jsonb_build_object('converged',false,'reason','trusted_current_reviews_required');END IF;
 SELECT CASE
 WHEN bool_or(review.evidence->>'classification'='UNKNOWN') THEN 'UNKNOWN'
 WHEN bool_or(review.evidence->>'classification'='PRODUCT_DEFECT') THEN 'PRODUCT_DEFECT'
 WHEN bool_or(review.evidence->>'classification'='HUMAN_AUTHORITY') THEN 'HUMAN_AUTHORITY'
 WHEN bool_or(review.evidence->>'classification'='CONFIGURATION') THEN 'CONFIGURATION'
 WHEN bool_or(review.evidence->>'classification'='VERIFIER_INFRA') THEN 'VERIFIER_INFRA'
 ELSE 'UNKNOWN' END INTO reviewed
 FROM control.verification_results v JOIN control.verification_failure_reviews review USING(verification_id)
 WHERE v.execution_id=(g->>'execution_id')::bigint AND v.verification_run_id=(g->'evidence'->>'verification_run_id')::bigint AND v.status IN('fail','not_run','unavailable') AND coalesce((v.metadata->>'required')::boolean,true);
 IF reviewed IS DISTINCT FROM g->>'classification' THEN RETURN jsonb_build_object('converged',false,'reason','canonical_review_mismatch');END IF;
 SELECT * INTO s FROM control.recovery_states WHERE current_task_id=p_task ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
 IF s.lease_expires_at>now() OR s.next_action IN('wait-operator','wait-decision','safety-stop') THEN RETURN jsonb_build_object('converged',false,'reason','current_owner_or_authority_boundary');END IF;
 class:=CASE g->>'classification' WHEN 'VERIFIER_INFRA' THEN 'verification-infrastructure' WHEN 'CONFIGURATION' THEN 'verification-configuration' ELSE 'verification-product-defect' END;
 action:=CASE WHEN g->>'classification'='PRODUCT_DEFECT' THEN 'repair' ELSE 'reverify' END;
 identity:='trusted-convergence:'||(g->>'execution_id')||':'||(g->>'fingerprint');
 IF EXISTS(SELECT 1 FROM control.task_events WHERE task_id=p_task AND event_type='lifecycle_failure_converged' AND payload->>'identity'=identity) THEN RETURN jsonb_build_object('converged',false,'reason','current_generation_already_converged');END IF;
 IF s.status='active' AND s.failure_class=class AND s.next_action=action AND NOT EXISTS(SELECT 1 FROM control.dot_incidents WHERE run_id=r.run_id AND task_id=p_task AND execution_id=(g->>'execution_id')::bigint AND classification IS DISTINCT FROM g->>'classification' AND status NOT IN('resolved','superseded','closed','cancelled','failed')) THEN RETURN jsonb_build_object('converged',false,'reason','already_compatible');END IF;
 IF s.recovery_state_id IS NOT NULL THEN
 PERFORM control.record_recovery_condition(s.resume_identity,identity||':superseded',s.failure_class,'trusted_failure_generation_superseded',s.next_action,false,'runner',r.project_id,r.workstream_slug,r.run_id,p_task,(g->>'execution_id')::bigint,s.failure_id,NULL,NULL,NULL,NULL,NULL,s.condition,s.metadata||jsonb_build_object('superseded_by',g->>'fingerprint'),'resolved');
 END IF;
 result:=control.record_recovery_condition(coalesce(s.resume_identity,'task:'||p_task),identity||':current',class,'trusted_failure_recovery_converged',action,true,'runner',r.project_id,r.workstream_slug,r.run_id,p_task,(g->>'execution_id')::bigint,s.failure_id,NULL,NULL,NULL,NULL,NULL,jsonb_build_object('failure_generation',g->>'fingerprint','verification_run_id',g->'evidence'->'verification_run_id'),jsonb_build_object('supersedes',to_jsonb(s),'classification',g->>'classification'),'active');
 UPDATE control.dot_recovery_jobs SET status='superseded',claim_token=NULL,claim_until=NULL,updated_at=now(),evidence=evidence||jsonb_build_object('resolution','trusted_failure_recovery_converged','history_preserved',true) WHERE incident_id IN(SELECT incident_id FROM control.dot_incidents WHERE run_id=r.run_id AND task_id=p_task AND execution_id=(g->>'execution_id')::bigint AND classification IS DISTINCT FROM g->>'classification') AND status NOT IN('resolved','superseded','closed','cancelled','failed');
 UPDATE control.dot_incidents SET status='superseded',claim_until=NULL,evidence=evidence||jsonb_build_object('resolution','trusted_failure_recovery_converged','history_preserved',true) WHERE run_id=r.run_id AND task_id=p_task AND execution_id=(g->>'execution_id')::bigint AND classification IS DISTINCT FROM g->>'classification' AND status NOT IN('resolved','superseded','closed','cancelled','failed');
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(p_task,'lifecycle_failure_converged','runner',jsonb_build_object('identity',identity,'prior_recovery',to_jsonb(s),'current_failure',g,'history_preserved',true));
 PERFORM control.enqueue_supervisor_wake(r.run_id);
 RETURN jsonb_build_object('converged',true,'classification',g->>'classification','recovery',result);
END $$;
ALTER FUNCTION control.converge_lifecycle_recovery(text) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.converge_lifecycle_recovery(text) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_observer,bs_control_executor,bs_control_operator,bs_control_verifier;
GRANT EXECUTE ON FUNCTION control.converge_lifecycle_recovery(text) TO bs_runtime_executor;
ALTER FUNCTION control.record_lifecycle_failure(text,bigint,text,text,jsonb) RENAME TO record_lifecycle_failure_pre_convergence;
CREATE FUNCTION control.record_lifecycle_failure(p_task text,p_execution bigint,p_fingerprint text,p_classification text,p_evidence jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE result jsonb;
BEGIN
 PERFORM 1 FROM control.workflow_runs WHERE current_task_id=p_task AND status='running' FOR UPDATE;
 result:=control.record_lifecycle_failure_pre_convergence(p_task,p_execution,p_fingerprint,p_classification,p_evidence);
 PERFORM control.converge_lifecycle_recovery(p_task);
 RETURN result;
END $$;
ALTER FUNCTION control.record_lifecycle_failure(text,bigint,text,text,jsonb) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.record_lifecycle_failure(text,bigint,text,text,jsonb),control.record_lifecycle_failure_pre_convergence(text,bigint,text,text,jsonb) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_observer,bs_control_executor,bs_control_operator,bs_control_verifier,bs_runtime_executor;
GRANT EXECUTE ON FUNCTION control.record_lifecycle_failure(text,bigint,text,text,jsonb) TO bs_runtime_executor;
-- Adoption and trusted convergence are one transition and share its wake.
DO $$ DECLARE definition text;BEGIN
 definition:=pg_get_functiondef('control.adopt_lifecycle_recovery(uuid,integer,text)'::regprocedure);
 definition:=replace(definition,'PERFORM control.record_lifecycle_failure(', 'PERFORM control.record_lifecycle_failure_pre_convergence(');
 definition:=replace(definition,'PERFORM control.enqueue_supervisor_wake(p_run);',
 'IF coalesce((control.converge_lifecycle_recovery(r.current_task_id)->>''converged'')::boolean,false) IS NOT TRUE THEN PERFORM control.enqueue_supervisor_wake(p_run);END IF;');
 EXECUTE definition;
END $$;
COMMIT;
