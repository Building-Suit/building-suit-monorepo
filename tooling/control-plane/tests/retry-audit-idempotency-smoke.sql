\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE audit_fixture(task text,run uuid,ex bigint,proof jsonb);
DO $$
DECLARE task text:='CP-AUDIT-IDEMPOTENCY';run uuid:=gen_random_uuid();prj uuid;ex bigint;entries jsonb;proof jsonb;
BEGIN
 SELECT project_id INTO prj FROM control.projects WHERE slug='building-suit';
 INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,title,status,retry_policy_id,acceptance_criteria,verification_plan)
 VALUES(task,'ledger-suit',prj,'ledger-suit','Synthetic unchanged audit','in_progress','standard-five','["fixture"]','["fixture"]');
 INSERT INTO control.workflow_runs(run_id,suit_slug,project_id,workstream_slug,max_tasks,status,current_task_id,controller_protocol,controller_fingerprint)
 VALUES(run,'ledger-suit',prj,'ledger-suit',1,'running',task,'cp-batch-v2','fixture-controller');
 INSERT INTO control.executions(task_id,attempt,status,model_profile,branch_name,parent_branch,worktree_path,commit_sha) VALUES(task,1,'failed','standard','codex/ledger-suit/fixture','stg','/fixture',repeat('a',40)) RETURNING execution_id INTO ex;
 entries:=jsonb_build_array(jsonb_build_object('execution_id',ex,'attempt',1,'classification','VERIFIER_INFRA','blocking_checks','[]'::jsonb));
 proof:=jsonb_build_object('version',1,'all_attempts_audited',true,'entries',entries,'max_attempts',5,'consumed',0,'fingerprint',md5(entries::text),'action','same-attempt-recovery');
 PERFORM control.record_recovery_condition(p_resume_identity=>'task:'||task,p_idempotency_key=>'synthetic-unchanged',p_current_task_id=>task,p_workflow_run_id=>run,p_execution_id=>ex,p_failure_class=>'operator-wait',p_error_code=>'retry_budget_exhausted',p_next_action=>'wait-operator',p_recoverable=>false,p_source=>'unit-test');
 INSERT INTO audit_fixture VALUES(task,run,ex,proof);
END $$;
-- Exercise the real executor capability and persistent DB identity.
DO $$
DECLARE f audit_fixture%ROWTYPE;r jsonb;first_id bigint;before_events integer;before_models integer;before_classifications integer;
BEGIN
 SELECT * INTO f FROM audit_fixture;
 SELECT count(*) INTO before_models FROM control.dot_model_invocations;
 SET LOCAL ROLE bs_control_executor;
 r:=control.record_retry_exhaustion_audit(f.task,f.proof);
 RESET ROLE;
 first_id:=(r->>'event_id')::bigint;
 IF first_id IS NULL THEN RAISE EXCEPTION 'Initial audit not persisted';END IF;
 SELECT count(*) INTO before_classifications FROM control.product_attempt_classifications WHERE execution_id=f.ex;
 -- Recovery code overwrites condition; this reproduced the original feedback bug.
 UPDATE control.recovery_states SET condition='{}',error_code='retry_audit_investigation_required',status='active',resolved_at=NULL,version=version+1 WHERE current_task_id=f.task;
 SELECT count(*) INTO before_events FROM control.dot_wake_events;
 FOR cycle IN 1..100 LOOP
  SET LOCAL ROLE bs_control_executor;
  r:=control.record_retry_exhaustion_audit(f.task,f.proof);
  RESET ROLE;
  IF r->>'idempotent'<>'true' OR (r->>'event_id')::bigint<>first_id THEN RAISE EXCEPTION 'Repeated cycle not idempotent';END IF;
 END LOOP;
 -- A caller nonce cannot manufacture a new authoritative generation.
 r:=control.record_retry_exhaustion_audit(f.task,f.proof||'{"fingerprint":"different-caller-nonce"}');
 IF r->>'idempotent'<>'true' THEN RAISE EXCEPTION 'Caller-only fingerprint manufactured new evidence';END IF;
 IF (SELECT count(*) FROM control.task_events WHERE task_id=f.task AND event_type='retry_exhaustion_audited')<>1
 OR before_classifications<>(SELECT count(*) FROM control.product_attempt_classifications WHERE execution_id=f.ex)
 OR before_events<>(SELECT count(*) FROM control.dot_wake_events)
 OR before_models<>(SELECT count(*) FROM control.dot_model_invocations) THEN RAISE EXCEPTION 'Repeated audit wrote events/classifications/outbox or invoked model';END IF;
 -- Consume initial authoritative transitions, record a real completed cycle.
 PERFORM control.record_dot_compact_cycle('[{"action":"synthetic-idempotency"}]',(SELECT max(event_id) FROM control.dot_wake_events));
 FOR delivery IN 1..100 LOOP
  INSERT INTO control.dot_wake_events(origin,payload,wake_kind) VALUES('synthetic-derived-webhook','{"event_type":"retry_exhaustion_audited"}','derived');
  IF control.dot_watch_ready() THEN RAISE EXCEPTION 'Derived or duplicate webhook started global scan';END IF;
 END LOOP;
 -- Health collections/reads cannot erase the durable receipt or create audits.
 FOR refresh IN 1..100 LOOP
  PERFORM control.record_dot_health('[]');PERFORM 1 FROM control.dot_health_current;
 END LOOP;
 IF (SELECT count(*) FROM control.task_events WHERE task_id=f.task AND event_type='retry_exhaustion_audited')<>1 THEN RAISE EXCEPTION 'Health writes duplicated audit';END IF;
 -- Legitimate source generation with unchanged execution/attempt/proof.
 UPDATE control.executions SET commit_sha=repeat('b',40) WHERE execution_id=f.ex;
 r:=control.record_retry_exhaustion_audit(f.task,f.proof);
 IF r->>'idempotent'='true' OR (r->>'event_id')::bigint=first_id THEN RAISE EXCEPTION 'Real source generation suppressed';END IF;
 FOR cycle IN 1..100 LOOP PERFORM control.record_retry_exhaustion_audit(f.task,f.proof);END LOOP;
 IF (SELECT count(*) FROM control.task_events WHERE task_id=f.task AND event_type='retry_exhaustion_audited')<>2 THEN RAISE EXCEPTION 'Changed evidence did not produce exactly one new audit';END IF;
 IF before_models<>(SELECT count(*) FROM control.dot_model_invocations) THEN RAISE EXCEPTION 'Deterministic audit invoked a model';END IF;
 IF has_table_privilege('bs_control_executor','control.retry_exhaustion_audits','INSERT') OR has_function_privilege('bs_control_observer','control.record_retry_exhaustion_audit(text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Audit authority widened';END IF;
END $$;
ROLLBACK;
-- A repeated state transition after scan capture must remain pending even when
-- its identity matches an earlier pending transition (A->B->A).
BEGIN;
DO $$
DECLARE task text:='CP-AUDIT-RACING-WAKE';watermark bigint;later_id bigint;
BEGIN
 INSERT INTO control.tasks(task_id,suit_slug,title,status,acceptance_criteria,verification_plan)
 VALUES(task,'ledger-suit','Synthetic racing wake','in_progress','[]','[]');
 SELECT max(event_id) INTO watermark FROM control.dot_wake_events WHERE payload->>'task_id'=task;
 UPDATE control.tasks SET status='verification' WHERE task_id=task;
 UPDATE control.tasks SET status='in_progress' WHERE task_id=task;
 SELECT max(event_id) INTO later_id FROM control.dot_wake_events WHERE payload->>'task_id'=task;
 IF later_id<=watermark THEN RAISE EXCEPTION 'Coalescing lost a later state transition';END IF;
 PERFORM control.record_dot_compact_cycle('[]',watermark);
 IF NOT EXISTS(SELECT 1 FROM control.dot_wake_events WHERE event_id=later_id AND consumed_at IS NULL) THEN RAISE EXCEPTION 'Old scan consumed new authoritative evidence';END IF;
END $$;
ROLLBACK;
