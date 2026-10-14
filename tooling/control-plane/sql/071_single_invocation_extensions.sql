BEGIN;
CREATE OR REPLACE FUNCTION control.reserve_dot_model_invocation(p_incident uuid,p_token uuid,p_receipt text,p_before text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE j control.dot_recovery_jobs%ROWTYPE; existing control.dot_model_invocations%ROWTYPE; g control.operator_invocation_extensions%ROWTYPE;
 actual integer; pending integer; first_launch timestamptz; streak integer; exhausted boolean;
BEGIN
 SELECT * INTO j FROM control.dot_recovery_jobs WHERE incident_id=p_incident FOR UPDATE;
 IF j.claim_token IS DISTINCT FROM p_token OR j.status<>'running' OR j.claim_until<=now() THEN RAISE EXCEPTION 'investigation_claim_required';END IF;
 SELECT * INTO existing FROM control.dot_model_invocations WHERE incident_id=p_incident AND receipt_key=p_receipt;
 IF existing.invocation_id IS NOT NULL THEN
 UPDATE control.dot_model_invocations SET claim_token=p_token WHERE invocation_id=existing.invocation_id AND status IN('reserved','launched');
 RETURN to_jsonb(existing)||jsonb_build_object('allowed',existing.status IN('reserved','launched'));END IF;
 SELECT count(*) FILTER(WHERE launched_at IS NOT NULL),count(*) FILTER(WHERE status='reserved'),min(launched_at)
 INTO actual,pending,first_launch FROM control.dot_model_invocations WHERE incident_id=p_incident;
 SELECT count(*) INTO streak FROM control.dot_model_invocations x WHERE x.incident_id=p_incident AND x.launched_at IS NOT NULL AND x.finished_at IS NOT NULL AND x.progressed IS NOT TRUE
 AND x.invocation_id>coalesce((SELECT max(y.invocation_id) FROM control.dot_model_invocations y WHERE y.incident_id=p_incident AND y.progressed),0);
 exhausted:=actual+pending>=3 OR first_launch<=now()-interval '45 minutes' OR streak>=2;
 IF exhausted THEN
 SELECT * INTO g FROM control.operator_invocation_extensions WHERE incident_id=p_incident AND kind='incident-investigation-extension' AND revoked_at IS NULL AND consumed_at IS NULL AND invocation_id IS NULL AND granted_at>now()-interval '45 minutes' FOR UPDATE;
 IF g.grant_id IS NULL THEN
 UPDATE control.dot_recovery_jobs SET status='human-gate',claim_until=NULL,evidence=evidence||jsonb_build_object('gate_kind','incident-investigation-extension','actual_model_invocations',actual,'no_progress_streak',streak,'first_launched_at',first_launch,'reason','incident_investigation_budget_exhausted','requested_extra_invocations',1) WHERE incident_id=p_incident;
 UPDATE control.dot_incidents SET status='operator-gate',claim_until=NULL WHERE incident_id=p_incident;
 RETURN jsonb_build_object('allowed',false,'actual_invocations',actual,'no_progress_streak',streak,'reason','incident_investigation_budget_exhausted');END IF;
 END IF;
 INSERT INTO control.dot_model_invocations(incident_id,receipt_key,claim_token,status,before_fingerprint) VALUES(p_incident,p_receipt,p_token,'reserved',p_before) RETURNING * INTO existing;
 IF g.grant_id IS NOT NULL THEN UPDATE control.operator_invocation_extensions SET invocation_id=existing.invocation_id WHERE grant_id=g.grant_id;END IF;
 RETURN to_jsonb(existing)||jsonb_build_object('allowed',true,'operator_grant_id',g.grant_id,'remaining_ms',CASE WHEN g.grant_id IS NOT NULL THEN greatest(0,2700000-extract(epoch FROM(now()-g.granted_at))*1000)::bigint WHEN first_launch IS NULL THEN 2700000 ELSE greatest(0,2700000-extract(epoch FROM(now()-first_launch))*1000)::bigint END);
END $$;
CREATE OR REPLACE FUNCTION control.record_dot_model_launch(p_incident uuid,p_token uuid,p_receipt text,p_launched timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE id bigint;
BEGIN
 IF p_launched>now()+interval '30 seconds' THEN RAISE EXCEPTION 'actual_model_launch_time_required';END IF;
 UPDATE control.dot_model_invocations SET status='launched',launched_at=coalesce(launched_at,p_launched)
 WHERE incident_id=p_incident AND claim_token=p_token AND receipt_key=p_receipt AND status IN('reserved','launched') RETURNING invocation_id INTO id;
 IF id IS NULL THEN RAISE EXCEPTION 'investigation_launch_reservation_required';END IF;
 UPDATE control.operator_invocation_extensions SET consumed_at=coalesce(consumed_at,p_launched) WHERE invocation_id=id AND revoked_at IS NULL;
END $$;
CREATE OR REPLACE FUNCTION control.finish_dot_model_invocation(p_incident uuid,p_token uuid,p_receipt text,p_after text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE id bigint; launched timestamptz;
BEGIN
 UPDATE control.dot_model_invocations SET status=CASE WHEN launched_at IS NULL THEN 'aborted' ELSE 'finished' END,finished_at=now(),after_fingerprint=p_after,progressed=before_fingerprint IS DISTINCT FROM p_after
 WHERE incident_id=p_incident AND claim_token=p_token AND receipt_key=p_receipt AND status IN('reserved','launched') RETURNING invocation_id,launched_at INTO id,launched;
 IF launched IS NULL THEN UPDATE control.operator_invocation_extensions SET invocation_id=NULL WHERE invocation_id=id AND consumed_at IS NULL;END IF;
END $$;
ALTER FUNCTION control.resolved_retry_policy(text) RENAME TO resolved_retry_policy_configured_v1;
CREATE FUNCTION control.resolved_retry_policy(p_task text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT control.resolved_retry_policy_configured_v1(p_task)||jsonb_build_object('one_invocation_extension',(
 SELECT jsonb_build_object('grant_id',g.grant_id,'profile','review','run_id',g.run_id) FROM control.operator_invocation_extensions g JOIN control.workflow_runs r USING(run_id)
 WHERE g.task_id=p_task AND g.kind='product-retry-extension' AND g.revoked_at IS NULL AND g.consumed_at IS NULL AND r.current_task_id=p_task AND r.status IN('running','failed') ORDER BY grant_id LIMIT 1));
$$;
CREATE OR REPLACE FUNCTION control.start_retry_execution(p_task_id text,p_max_attempts integer,p_model_profile text,p_model_name text,p_reasoning_effort text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE policy jsonb; budget jsonb; previous control.executions%ROWTYPE; slot integer; new_id bigint; expected_profile text; extension bigint;
BEGIN
 PERFORM 1 FROM control.tasks WHERE task_id=p_task_id FOR UPDATE;
 policy:=control.resolved_retry_policy(p_task_id);
 IF p_max_attempts IS DISTINCT FROM (policy->>'max_attempts')::integer THEN RAISE EXCEPTION 'Configured product budget must remain unchanged';END IF;
 budget:=control.audit_product_attempts(p_task_id);slot:=(budget->>'consumed')::integer+1;
 IF slot>p_max_attempts AND policy->'one_invocation_extension'='null'::jsonb THEN RETURN jsonb_build_object('allowed',false,'reason','retry_limit_reached','max_attempts',p_max_attempts,'accounting',budget);END IF;
 IF budget#>>'{classifications,-1,charged}' IS DISTINCT FROM 'true' THEN
 RETURN jsonb_build_object('allowed',false,'reason','reviewed_product_evidence_required','same_execution_required',true,'accounting',budget);END IF;
 expected_profile:=CASE WHEN slot>p_max_attempts THEN 'review' ELSE policy->'attempt_profiles'->>(slot-1) END;
 IF slot>p_max_attempts THEN SELECT grant_id INTO extension FROM control.operator_invocation_extensions WHERE grant_id=(policy#>>'{one_invocation_extension,grant_id}')::bigint AND revoked_at IS NULL AND consumed_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'one_unused_operator_product_extension_required';END IF;END IF;
 IF p_model_profile IS DISTINCT FROM expected_profile
 OR p_model_name IS DISTINCT FROM (CASE WHEN expected_profile='review' THEN 'gpt-6-astra' ELSE 'gpt-6.1-sol' END)
 OR p_reasoning_effort IS DISTINCT FROM (CASE WHEN expected_profile='standard' THEN 'medium' ELSE 'high' END)
 OR expected_profile NOT IN('standard','deep','review') THEN RAISE EXCEPTION 'Incorrect reviewed product slot routing';END IF;
 SELECT * INTO previous FROM control.executions WHERE task_id=p_task_id ORDER BY attempt DESC LIMIT 1;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM control.tasks WHERE task_id=p_task_id AND status='failed') OR previous.status='running' THEN RAISE EXCEPTION 'Latest settled failed task required';END IF;
 UPDATE control.tasks SET status='in_progress' WHERE task_id=p_task_id;
 INSERT INTO control.executions(task_id,attempt,model_profile,model_name,reasoning_effort,status,worktree_path,branch_name,parent_branch,parent_sha,started_at,resolved_retry_policy)
 VALUES(p_task_id,previous.attempt+1,p_model_profile,p_model_name,p_reasoning_effort,'running',previous.worktree_path,previous.branch_name,previous.parent_branch,previous.parent_sha,now(),policy) RETURNING execution_id INTO new_id;
 IF extension IS NOT NULL THEN UPDATE control.operator_invocation_extensions SET consumed_at=now(),execution_id=new_id WHERE grant_id=extension;END IF;
 INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload) VALUES(p_task_id,'retry_started','failed','in_progress','runner',jsonb_build_object('execution_id',new_id,'previous_execution_id',previous.execution_id,'attempt',previous.attempt+1,'product_slot',slot,'max_attempts',p_max_attempts,'accounting',budget,'model_profile',p_model_profile,'model_name',p_model_name,'reasoning_effort',p_reasoning_effort));
 RETURN jsonb_build_object('allowed',true,'execution_id',new_id,'attempt',previous.attempt+1,'previous_execution_id',previous.execution_id,'previous_attempt',previous.attempt,'worktree_path',previous.worktree_path,'branch_name',previous.branch_name,'parent_branch',previous.parent_branch,'product_slot',slot,'max_attempts',p_max_attempts);
END $$;
REVOKE ALL ON FUNCTION control.resolved_retry_policy_configured_v1(text) FROM PUBLIC,anon,authenticated,bs_control_app;
REVOKE ALL ON FUNCTION control.resolved_retry_policy(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.resolved_retry_policy(text) TO bs_control_app,bs_control_observer;
-- A reviewed one-invocation extension must reach the actual recovery claimant.
-- Earlier infrastructure history does not invalidate a later trusted product
-- exhaustion gate; only independently charged failures consume the budget.
DO $$ DECLARE fn regprocedure; definition text; BEGIN
 FOR fn IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='control'::regnamespace AND proname IN('claim_dot_recovery','claim_dot_recovery_live') LOOP
  definition:=pg_get_functiondef(fn);
  definition:=replace(definition, $old$AND b->>'all_product'='true'$old$, $new$AND b#>>'{classifications,-1,charged}'='true'
  AND NOT EXISTS(SELECT 1 FROM control.operator_invocation_extensions extension WHERE extension.run_id=r.run_id AND extension.task_id=r.current_task_id AND extension.kind='product-retry-extension' AND extension.consumed_at IS NULL AND extension.revoked_at IS NULL)$new$);
  EXECUTE definition;
 END LOOP;
END $$;
COMMIT;
