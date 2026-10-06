\set ON_ERROR_STOP on
BEGIN;
UPDATE control.workflow_runs SET status='finished' WHERE suit_slug='cp-selfheal-fixture' AND status='running';
DO $$ DECLARE run uuid:=gen_random_uuid(); task text:='CP-STUCK-INFRA-001'; prj uuid; ex bigint; i integer; history jsonb; result jsonb; repeat_result jsonb; budget jsonb; incident uuid; rejected boolean; wakes integer;
BEGIN
 SELECT project_id INTO prj FROM control.projects WHERE slug='building-suit';
 INSERT INTO control.tasks(task_id,suit_slug,sequence,title,status,acceptance_criteria,verification_plan,metadata,project_id,workstream_slug,retry_policy_id)
 VALUES(task,'cp-selfheal-fixture',-50000,task,'in_progress','["fixture"]','["git diff --check"]','{"allowed_paths":["tooling/control-plane/**"]}',prj,'cp-selfheal-fixture','foundation-three');
 PERFORM control.refresh_publication_readiness_contract(task,'stuck-test');
 INSERT INTO control.workflow_runs(run_id,suit_slug,project_id,workstream_slug,max_tasks,status,current_task_id,controller_protocol,controller_fingerprint)
 VALUES(run,'cp-selfheal-fixture',prj,'cp-selfheal-fixture',2,'running',task,'cp-batch-v2','fixture-controller');
 PERFORM control.authorize_ordinary_bounded_run(run,jsonb_build_array(task),'Explicit disposable STUCK recovery fixture');
 FOR i IN 1..3 LOOP
 INSERT INTO control.executions(task_id,attempt,status,model_profile,metadata) VALUES(task,i,'failed','standard',jsonb_build_object('verification_probe_failures',jsonb_build_array(jsonb_build_object('name','e2e','status','fail','failure_class',CASE WHEN i=2 THEN 'verification-product-defect' ELSE 'verification-infrastructure' END)))) RETURNING execution_id INTO ex;
 END LOOP;
 UPDATE control.tasks SET status='failed' WHERE task_id=task;
 UPDATE control.workflow_runs SET status='failed',finished_at=now() WHERE run_id=run;
 PERFORM control.record_recovery_condition(p_resume_identity=>'task:'||task,p_idempotency_key=>'stuck-fixture-terminal',p_failure_class=>'safety-stop',p_error_code=>'retry_budget_exhausted',p_next_action=>'safety-stop',p_recoverable=>false,p_source=>'unit-test',p_project_id=>prj,p_workstream_slug=>'cp-selfheal-fixture',p_current_task_id=>task,p_execution_id=>ex,p_status=>'resolved');
 SELECT jsonb_agg(to_jsonb(e) ORDER BY attempt) INTO history FROM control.executions e WHERE task_id=task;
 PERFORM control.record_dot_health(jsonb_build_array(jsonb_build_object('key','run:'||run,'run_id',run,'task_id',task,'execution_id',ex,'state','STUCK','why','Failed without owner','worker_alive',false,'operator_action_required',false,'observed_at',now())));
 SELECT count(*) INTO wakes FROM control.dot_wake_events WHERE origin='dot-health-stuck' AND payload->>'run_id'=run::text;
 IF wakes<>1 THEN RAISE EXCEPTION 'STUCK transition did not wake BS-31';END IF;
 UPDATE control.dot_health_observations SET observed_at=now() WHERE run_id=run;
 IF (SELECT count(*) FROM control.dot_wake_events WHERE origin='dot-health-stuck' AND payload->>'run_id'=run::text)<>wakes THEN RAISE EXCEPTION 'Stable poll emitted duplicate wake';END IF;
 result:=control.claim_dot_stuck_recovery(run,repeat('a',64));
 IF result->>'claimed'<>'true' OR result#>>'{accounting,consumed}'<>'1' THEN RAISE EXCEPTION 'Next cycle did not recover reclaimed task: %',result;END IF;
 incident:=(result->>'incident_id')::uuid;
 rejected:=false;BEGIN PERFORM control.start_retry_execution(task,3,'standard','gpt-6.1-sol','medium');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Verifier failure reserved another product attempt';END IF;
 rejected:=false;BEGIN PERFORM control.start_retry_execution(task,4,'standard','gpt-6.1-sol','medium');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Retry budget expansion allowed';END IF;
 repeat_result:=control.claim_dot_stuck_recovery(run,repeat('a',64));
 IF repeat_result->>'claimed'<>'false' OR repeat_result->>'reason'<>'incident_already_owned' OR (repeat_result->>'incident_id')::uuid<>incident THEN RAISE EXCEPTION 'Duplicate cycle/restart launched duplicate incident: %',repeat_result;END IF;
 IF history IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(e) ORDER BY attempt) FROM control.executions e WHERE task_id=task) THEN RAISE EXCEPTION 'Execution history changed';END IF;
 IF (SELECT status FROM control.workflow_runs WHERE run_id=run)<>'running' OR (SELECT max_tasks FROM control.workflow_runs WHERE run_id=run)<>2 OR control.resolved_retry_policy(task)->>'max_attempts'<>'3' THEN RAISE EXCEPTION 'Run or budget replaced';END IF;
 -- A genuine exhaustion in the same fixture becomes an active human gate.
 UPDATE control.executions SET metadata='{"verification_probe_failures":[{"name":"assertion","status":"fail","failure_class":"verification-product-defect"}]}' WHERE task_id=task;
 UPDATE control.dot_incidents SET claim_until=now()-interval '1 second' WHERE incident_id=incident;
 result:=control.claim_dot_stuck_recovery(run,repeat('a',64));
 IF result->>'reason'<>'operator_gate' OR result#>>'{accounting,all_product}'<>'true' THEN RAISE EXCEPTION 'Legitimate exhaustion did not gate: %',result;END IF;
 IF NOT EXISTS(SELECT 1 FROM control.recovery_states WHERE resume_identity='task:'||task AND status='active' AND next_action='wait-operator' AND error_code='retry_budget_exhausted') THEN RAISE EXCEPTION 'Human gate not persisted';END IF;
END $$;
ROLLBACK;
SELECT 'DOT_STUCK_RECOVERY_DEDUP_ACCOUNTING_GATE_PASS';
