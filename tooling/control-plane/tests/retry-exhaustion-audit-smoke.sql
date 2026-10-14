\set ON_ERROR_STOP on
BEGIN;
UPDATE control.workflow_runs SET status='finished' WHERE suit_slug='cp-selfheal-fixture' AND status='running';
DO $$ DECLARE prj uuid; run uuid; task text; ex bigint; kind text; summary text; entries jsonb; proof jsonb; before_rows jsonb; result jsonb; first_count integer;
BEGIN
SELECT project_id INTO prj FROM control.projects WHERE slug='building-suit';
FOR kind IN SELECT unnest(ARRAY['VERIFIER_INFRA','PRODUCT_DEFECT','UNKNOWN']) LOOP
 task:='CP-EXHAUSTION-'||kind;run:=gen_random_uuid();entries:='[]';summary:=CASE WHEN kind='PRODUCT_DEFECT' THEN 'AssertionError: shell active rail inaccessible' WHEN kind='VERIFIER_INFRA' THEN 'ENOENT app/components scan in regression fixture' ELSE 'Unexplained result' END;
 INSERT INTO control.tasks(task_id,suit_slug,sequence,title,status,acceptance_criteria,verification_plan,metadata,project_id,workstream_slug,retry_policy_id)
 VALUES(task,'cp-selfheal-fixture',-60090,task,'in_progress','["fixture"]','["git diff --check"]','{"allowed_paths":["tooling/control-plane/"]}',prj,'cp-selfheal-fixture','shared-foundation-five');
 INSERT INTO control.workflow_runs(run_id,suit_slug,project_id,workstream_slug,max_tasks,status,current_task_id,controller_protocol,controller_fingerprint) VALUES(run,'cp-selfheal-fixture',prj,'cp-selfheal-fixture',1,'running',task,'cp-batch-v2','fixture-controller');
 PERFORM control.authorize_ordinary_bounded_run(run,jsonb_build_array(task),'Explicit isolated exhaustion regression');
 FOR n IN 1..5 LOOP
 INSERT INTO control.executions(task_id,attempt,status,model_profile,branch_name,parent_branch,metadata) VALUES(task,n,'failed','standard','codex/cp-selfheal-fixture/exhaustion','stg',jsonb_build_object('verification_probe_failures',jsonb_build_array(jsonb_build_object('name','shell','status','fail','summary',summary)))) RETURNING execution_id INTO ex;
 entries:=entries||jsonb_build_array(jsonb_build_object('execution_id',ex,'attempt',n,'classification',kind,'blocking_checks',jsonb_build_array(jsonb_build_object('name','shell','status','fail','summary',summary))));
 END LOOP;
 UPDATE control.tasks SET status='failed' WHERE task_id=task;
 UPDATE control.workflow_runs SET status='failed' WHERE run_id=run;
 PERFORM control.record_recovery_condition(p_resume_identity=>'task:'||task,p_idempotency_key=>task||':exhausted',p_failure_class=>'operator-wait',p_error_code=>'retry_budget_exhausted',p_next_action=>'wait-operator',p_recoverable=>false,p_source=>'unit-test',p_current_task_id=>task,p_workflow_run_id=>run);
 SELECT jsonb_agg(to_jsonb(e) ORDER BY attempt) INTO before_rows FROM control.executions e WHERE task_id=task;
 proof:=jsonb_build_object('version',1,'all_attempts_audited',true,'entries',entries,'max_attempts',5,'consumed',CASE WHEN kind='PRODUCT_DEFECT' THEN 5 ELSE 0 END,'fingerprint',md5(entries::text),'action',CASE kind WHEN 'PRODUCT_DEFECT' THEN 'operator-gate' WHEN 'UNKNOWN' THEN 'investigate' ELSE 'same-attempt-recovery' END,'root_cause',summary,'failed_check','shell','remaining_product_defect',CASE WHEN kind='PRODUCT_DEFECT' THEN summary ELSE NULL END,'automatic_repair_blocker','Configured product slots exhausted','required_authorization','Authorize exactly one bounded task-specific repair');
 result:=control.record_retry_exhaustion_audit(task,proof);
 IF result->>'operator_gate' IS DISTINCT FROM (kind='PRODUCT_DEFECT')::text THEN RAISE EXCEPTION 'Incorrect exhaustion gate: %',result;END IF;
 IF (SELECT jsonb_agg(to_jsonb(e) ORDER BY attempt) FROM control.executions e WHERE task_id=task) IS DISTINCT FROM before_rows THEN RAISE EXCEPTION 'Historical executions changed';END IF;
 SELECT count(*) INTO first_count FROM control.product_attempt_classifications c JOIN control.executions e USING(execution_id) WHERE e.task_id=task;
 PERFORM control.record_retry_exhaustion_audit(task,proof);
 IF first_count<>(SELECT count(*) FROM control.product_attempt_classifications c JOIN control.executions e USING(execution_id) WHERE e.task_id=task) THEN RAISE EXCEPTION 'Duplicate cycle duplicated audit';END IF;
 IF (SELECT max_tasks FROM control.workflow_runs WHERE run_id=run)<>1 OR (control.resolved_retry_policy(task)->>'max_attempts')::integer<>5 THEN RAISE EXCEPTION 'Run/product budget changed';END IF;
 UPDATE control.workflow_runs SET status='finished' WHERE run_id=run;
 END LOOP;
END $$;
ROLLBACK;
