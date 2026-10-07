BEGIN;
CREATE OR REPLACE FUNCTION control.start_retry_execution(p_task_id text,p_max_attempts integer,p_model_profile text,p_model_name text,p_reasoning_effort text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE policy jsonb; budget jsonb; previous control.executions%ROWTYPE; slot integer; new_id bigint; expected_profile text;
BEGIN
 PERFORM 1 FROM control.tasks WHERE task_id=p_task_id FOR UPDATE;
 policy:=control.resolved_retry_policy(p_task_id);
 IF p_max_attempts IS DISTINCT FROM (policy->>'max_attempts')::integer THEN RAISE EXCEPTION 'Configured product budget must remain unchanged';END IF;
 budget:=control.audit_product_attempts(p_task_id);slot:=(budget->>'consumed')::integer+1;
 IF slot>p_max_attempts THEN RETURN jsonb_build_object('allowed',false,'reason','retry_limit_reached','max_attempts',p_max_attempts,'accounting',budget);END IF;
 IF budget#>>'{classifications,-1,charged}' IS DISTINCT FROM 'true' THEN
 RETURN jsonb_build_object('allowed',false,'reason','reviewed_product_evidence_required','same_execution_required',true,'accounting',budget);END IF;
 expected_profile:=policy->'attempt_profiles'->>(slot-1);
 IF p_model_profile IS DISTINCT FROM expected_profile
 OR p_model_name IS DISTINCT FROM (CASE WHEN expected_profile='review' THEN 'gpt-6-astra' ELSE 'gpt-6.1-sol' END)
 OR p_reasoning_effort IS DISTINCT FROM (CASE WHEN expected_profile='standard' THEN 'medium' ELSE 'high' END)
 OR expected_profile NOT IN('standard','deep','review') THEN RAISE EXCEPTION 'Incorrect reviewed product slot routing';END IF;
 SELECT * INTO previous FROM control.executions WHERE task_id=p_task_id ORDER BY attempt DESC LIMIT 1;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM control.tasks WHERE task_id=p_task_id AND status='failed') OR previous.status='running' THEN RAISE EXCEPTION 'Latest settled failed task required';END IF;
 UPDATE control.tasks SET status='in_progress' WHERE task_id=p_task_id;
 INSERT INTO control.executions(task_id,attempt,model_profile,model_name,reasoning_effort,status,worktree_path,branch_name,parent_branch,parent_sha,started_at,resolved_retry_policy)
 VALUES(p_task_id,previous.attempt+1,p_model_profile,p_model_name,p_reasoning_effort,'running',previous.worktree_path,previous.branch_name,previous.parent_branch,previous.parent_sha,now(),policy) RETURNING execution_id INTO new_id;
 INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload) VALUES(p_task_id,'retry_started','failed','in_progress','runner',jsonb_build_object('execution_id',new_id,'previous_execution_id',previous.execution_id,'attempt',previous.attempt+1,'product_slot',slot,'max_attempts',p_max_attempts,'accounting',budget,'model_profile',p_model_profile,'model_name',p_model_name,'reasoning_effort',p_reasoning_effort));
 RETURN jsonb_build_object('allowed',true,'execution_id',new_id,'attempt',previous.attempt+1,'previous_execution_id',previous.execution_id,'previous_attempt',previous.attempt,'worktree_path',previous.worktree_path,'branch_name',previous.branch_name,'parent_branch',previous.parent_sha,'product_slot',slot,'max_attempts',p_max_attempts);
END $$;
REVOKE ALL ON FUNCTION control.start_retry_execution(text,integer,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.start_retry_execution(text,integer,text,text,text) TO bs_control_app;
COMMIT;
