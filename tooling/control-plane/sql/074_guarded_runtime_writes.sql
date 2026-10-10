BEGIN;
CREATE FUNCTION control.record_task_preparation(p_task text,p_preparation jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE t control.tasks%ROWTYPE;
BEGIN
 SELECT * INTO t FROM control.tasks WHERE task_id=p_task FOR UPDATE;
 IF NOT FOUND OR t.status IN('complete','cancelled') THEN RAISE EXCEPTION 'active_task_preparation_required';END IF;
 UPDATE control.tasks SET metadata=jsonb_set(metadata,'{preparation}',p_preparation,true),engine_stage='prepared' WHERE task_id=p_task;
 INSERT INTO control.audit_events(project_id,workstream_slug,task_id,action,source,new_value) VALUES(t.project_id,t.workstream_slug,p_task,'task_prepared','runner',p_preparation);
 RETURN '{"recorded":true}';
END $$;
CREATE FUNCTION control.record_execution_setup(p_execution bigint,p_policy jsonb,p_prompt text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE e control.executions%ROWTYPE;
BEGIN
 SELECT * INTO e FROM control.executions WHERE execution_id=p_execution FOR UPDATE;
 IF NOT FOUND OR e.status<>'running' OR e.execution_id<>(SELECT max(execution_id) FROM control.executions WHERE task_id=e.task_id) THEN RAISE EXCEPTION 'current_running_execution_required';END IF;
 IF p_policy->>'policy_id' IS DISTINCT FROM control.resolved_retry_policy(e.task_id)->>'policy_id' OR (p_policy->>'max_attempts')::integer IS DISTINCT FROM (control.resolved_retry_policy(e.task_id)->>'max_attempts')::integer OR p_policy->'attempt_profiles' IS DISTINCT FROM control.resolved_retry_policy(e.task_id)->'attempt_profiles' THEN RAISE EXCEPTION 'configured_retry_policy_unchanged_required';END IF;
 UPDATE control.executions SET resolved_retry_policy=p_policy,prompt_path=coalesce(p_prompt,prompt_path),engine_stage='implementation' WHERE execution_id=p_execution;
 RETURN jsonb_build_object('execution_id',p_execution);
END $$;
CREATE FUNCTION control.record_runtime_failure(p_task text,p_execution bigint,p_stage text,p_code text,p_summary text,p_raw text,p_retry boolean,p_profile text,p_human boolean,p_actions jsonb,p_metadata jsonb,p_class text,p_recovery text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE t control.tasks%ROWTYPE; e control.executions%ROWTYPE;
BEGIN
 SELECT * INTO t FROM control.tasks WHERE task_id=p_task;
 IF NOT FOUND OR t.status IN('complete','cancelled') THEN RAISE EXCEPTION 'active_failure_subject_required';END IF;
 IF p_execution IS NOT NULL THEN SELECT * INTO e FROM control.executions WHERE execution_id=p_execution AND task_id=p_task; IF NOT FOUND THEN RAISE EXCEPTION 'same_task_execution_required';END IF;END IF;
 INSERT INTO control.failures(project_id,workstream_slug,task_id,execution_id,attempt,stage,error_code,summary,raw_error,retry_available,next_profile,human_intervention_required,legal_actions,metadata,failure_class,recovery_action,recoverable)
 VALUES(t.project_id,t.workstream_slug,p_task,p_execution,e.attempt,p_stage,p_code,left(p_summary,1000),left(p_raw,12000),p_retry,p_profile,p_human,p_actions,p_metadata,coalesce(nullif(p_class,''),'unknown-outcome'),coalesce(nullif(p_recovery,''),'reconcile'),false);
 RETURN '{"recorded":true}';
END $$;
CREATE FUNCTION control.skip_unselected_verification_checks(p_run bigint,p_selected jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE skipped integer;
BEGIN
 PERFORM 1 FROM control.verification_runs v WHERE verification_run_id=p_run AND status='running' AND verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=v.execution_id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'current_running_verification_required';END IF;
 UPDATE control.verification_results c SET status='skipped',summary='Not selected by the task-focused verification plan.',metadata=c.metadata||jsonb_build_object('selection_reason','not_selected_by_verifier','verification_mode',(SELECT verification_mode FROM control.verification_runs WHERE verification_run_id=p_run)),started_at=coalesce(started_at,now()),finished_at=now(),elapsed_ms=0
 WHERE verification_run_id=p_run AND status IN('queued','running') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_selected) s(name) WHERE s.name=c.check_name);
 GET DIAGNOSTICS skipped=ROW_COUNT;RETURN jsonb_build_object('skipped',skipped);
END $$;
CREATE FUNCTION control.record_trusted_verification_state(p_run bigint,p_state jsonb,p_class text,p_recovery text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
BEGIN
 IF coalesce(p_state->>'fingerprint','') !~ '^[a-f0-9]{32,64}$' THEN RAISE EXCEPTION 'verified_repository_fingerprint_required';END IF;
 UPDATE control.verification_runs v SET metadata=metadata||jsonb_build_object('verified_state',p_state,'failure_class',nullif(p_class,''),'recovery_action',nullif(p_recovery,''))
 WHERE verification_run_id=p_run AND status='running' AND verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=v.execution_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'current_running_verification_required';END IF;
 RETURN jsonb_build_object('verification_run_id',p_run,'state_fingerprint',p_state->>'fingerprint');
END $$;
CREATE FUNCTION control.record_publication_started(p_task text,p_op uuid,p_execution bigint,p_verification bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM control.executions e JOIN control.verification_runs v USING(execution_id) JOIN control.tasks t USING(task_id) WHERE t.task_id=p_task AND e.execution_id=p_execution AND control.publication_execution_is_eligible(t.task_id,e.execution_id) AND t.status='passed' AND v.verification_run_id=p_verification AND v.status='passed' AND v.verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=e.execution_id)) THEN RAISE EXCEPTION 'current_passed_publication_subject_required';END IF;
 IF p_op IS NOT NULL AND NOT EXISTS(SELECT 1 FROM control.runtime_operations WHERE operation_id=p_op AND task_id=p_task AND action='task-publish') THEN RAISE EXCEPTION 'same_task_publication_operation_required';END IF;
 IF NOT EXISTS(SELECT 1 FROM control.task_events WHERE task_id=p_task AND event_type='publication_started' AND payload->>'operation_id' IS NOT DISTINCT FROM p_op::text AND (payload->>'verification_run_id')::bigint=p_verification) THEN
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(p_task,'publication_started','runner',jsonb_build_object('operation_id',p_op,'execution_id',p_execution,'verification_run_id',p_verification));END IF;
END $$;
CREATE FUNCTION control.set_runtime_operation_outcome(p_id uuid,p_status text,p_result jsonb,p_retry boolean DEFAULT false,p_backoff integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE op control.runtime_operations%ROWTYPE;
BEGIN
 SELECT * INTO op FROM control.runtime_operations WHERE operation_id=p_id FOR UPDATE;
 IF NOT FOUND OR p_status NOT IN('pending','consumed') OR p_backoff NOT BETWEEN 0 AND 3600000 THEN RAISE EXCEPTION 'bounded_operation_outcome_required';END IF;
 IF op.status='consumed' THEN RETURN jsonb_build_object('replayed',true,'result',op.result);END IF;
 IF p_retry AND coalesce(p_result#>>'{payload,classification,failure_class}',p_result#>>'{classification,failure_class}','') NOT IN('transient-infrastructure','verification-infrastructure','external-wait') THEN RAISE EXCEPTION 'typed_transient_retry_required';END IF;
 UPDATE control.runtime_operations SET status=p_status,result=p_result,infra_retries=infra_retries+CASE WHEN p_retry THEN 1 ELSE 0 END,next_wake_at=now()+p_backoff*interval '1 millisecond',execution_id=(SELECT execution_id FROM control.executions WHERE task_id=op.task_id ORDER BY attempt DESC LIMIT 1),lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE operation_id=p_id;
 RETURN '{"recorded":true}';
END $$;
CREATE FUNCTION control.attach_runtime_execution(p_id uuid,p_execution bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
BEGIN
 UPDATE control.runtime_operations op SET execution_id=p_execution,status='running',updated_at=now() WHERE operation_id=p_id AND status<>'consumed' AND EXISTS(SELECT 1 FROM control.executions e WHERE e.execution_id=p_execution AND e.task_id=op.task_id AND e.status='running');
 IF NOT FOUND THEN RAISE EXCEPTION 'same_task_active_operation_required';END IF;
END $$;
CREATE FUNCTION control.reclaim_local_supervisor_lease(p_identity text,p_owner text,p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE changed integer;
BEGIN
 UPDATE control.recovery_states SET lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=now(),metadata=metadata||jsonb_build_object('dead_local_lease_reclaimed_at',now(),'dead_local_lease_owner',p_owner) WHERE resume_identity=p_identity AND status='active' AND lease_owner=p_owner AND lease_token=p_token AND lease_expires_at>now();
 GET DIAGNOSTICS changed=ROW_COUNT;RETURN jsonb_build_object('reclaimed',changed=1);
END $$;
CREATE FUNCTION control.record_dot_cycle(p_outcomes jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
BEGIN
 IF jsonb_typeof(p_outcomes)<>'array' THEN RAISE EXCEPTION 'watchdog_outcomes_array_required';END IF;
 INSERT INTO control.dot_cycles(outcomes) VALUES(p_outcomes);
 UPDATE control.dot_wake_events SET consumed_at=now() WHERE consumed_at IS NULL;
END $$;
CREATE FUNCTION control.record_trusted_reacceptance(p_task text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE id bigint;
BEGIN
 IF p_payload->>'source_unchanged'<>'true' OR NOT EXISTS(SELECT 1 FROM control.workflow_runs r JOIN control.executions e ON e.task_id=r.current_task_id WHERE r.run_id=(p_payload->>'run_id')::uuid AND r.current_task_id=p_task AND r.status='running' AND e.execution_id=(p_payload->>'execution_id')::bigint AND e.execution_id=(SELECT max(execution_id) FROM control.executions WHERE task_id=p_task) AND e.status='failed') THEN RAISE EXCEPTION 'trusted_current_reacceptance_subject_required';END IF;
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(p_task,'verifier_reacceptance_authorized','dot',p_payload) RETURNING event_id INTO id;
 RETURN jsonb_build_object('event_id',id);
END $$;
-- Trusted host-only state/authority writes never belong to the lifecycle role.
REVOKE ALL ON FUNCTION control.record_trusted_verification_state(bigint,jsonb,text,text),control.record_trusted_reacceptance(text,jsonb) FROM PUBLIC,anon,authenticated,bs_control_app;
GRANT EXECUTE ON FUNCTION control.record_trusted_verification_state(bigint,jsonb,text,text),control.record_trusted_reacceptance(text,jsonb) TO bs_control_verifier;
DO $$DECLARE fn regprocedure;BEGIN
 FOR fn IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='control'::regnamespace AND proname IN('record_task_preparation','record_execution_setup','record_runtime_failure','skip_unselected_verification_checks','record_publication_started','set_runtime_operation_outcome','attach_runtime_execution','reclaim_local_supervisor_lease','record_dot_cycle') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO bs_control_app',fn);
 END LOOP;
END $$;
COMMIT;
