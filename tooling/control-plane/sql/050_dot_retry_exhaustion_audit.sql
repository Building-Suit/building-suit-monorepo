BEGIN;
CREATE OR REPLACE FUNCTION control.record_retry_exhaustion_audit(p_task text,p_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; s control.recovery_states%ROWTYPE; item jsonb; ex control.executions%ROWTYPE; budget jsonb; max_slots integer; gate boolean; prev jsonb;
BEGIN
SELECT * INTO r FROM control.workflow_runs WHERE current_task_id=p_task ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
IF r.run_id IS NULL OR r.stop_requested OR r.maintenance_requested OR NOT EXISTS(SELECT 1 FROM control.dot_task_scope_authorities WHERE run_id=r.run_id AND task_id=p_task) THEN RETURN jsonb_build_object('audited',false,'reason','hard_run_gate');END IF;
max_slots:=(control.resolved_retry_policy(p_task)->>'max_attempts')::integer;
IF p_proof->>'version'<>'1' OR p_proof->>'all_attempts_audited'<>'true' OR (p_proof->>'max_attempts')::integer<>max_slots OR jsonb_typeof(p_proof->'entries')<>'array' THEN RAISE EXCEPTION 'Complete unchanged-policy audit required';END IF;
FOR item IN SELECT value FROM jsonb_array_elements(p_proof->'entries') LOOP
SELECT * INTO ex FROM control.executions WHERE task_id=p_task AND execution_id=(item->>'execution_id')::bigint;
IF ex.execution_id IS NULL OR ex.status='running' OR ex.attempt<>(item->>'attempt')::integer OR item->>'classification' NOT IN('PRODUCT_DEFECT','VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE','PUBLICATION_INFRA','UNKNOWN') THEN RAISE EXCEPTION 'Audit execution/classification mismatch';END IF;
IF item->>'classification'='PRODUCT_DEFECT' AND (item->'blocking_checks')::text !~* 'AssertionError|assertion failed|Error: expect|ERR_ASSERTION' THEN RAISE EXCEPTION 'Product assertion evidence required';END IF;
INSERT INTO control.product_attempt_classifications(execution_id,classification,evidence_fingerprint,source,evidence)
VALUES(ex.execution_id,CASE WHEN item->>'classification'='UNKNOWN' THEN 'OTHER' WHEN item->>'classification'='PUBLICATION_INFRA' THEN 'VERIFIER_INFRA' ELSE item->>'classification' END,md5(control.retry_evidence_fingerprint(ex.execution_id)||(p_proof->>'fingerprint')),'dot',item||jsonb_build_object('audited',true,'audit_version',1)) ON CONFLICT DO NOTHING;
END LOOP;
IF EXISTS(SELECT 1 FROM control.executions e WHERE e.task_id=p_task AND e.status<>'running' AND EXISTS(SELECT 1 FROM control.failures f WHERE f.execution_id=e.execution_id) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_proof->'entries') i WHERE (i->>'execution_id')::bigint=e.execution_id)) THEN RAISE EXCEPTION 'Every failed attempt must be audited';END IF;
budget:=control.product_retry_accounting(p_task);
IF (budget->>'consumed')::integer<>(p_proof->>'consumed')::integer THEN RAISE EXCEPTION 'Product accounting mismatch';END IF;
SELECT * INTO s FROM control.recovery_states WHERE current_task_id=p_task ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
-- Audit is evidence only while a worker or a different safety boundary owns the task.
IF EXISTS(SELECT 1 FROM control.executions WHERE task_id=p_task AND status='running') OR s.lease_expires_at>now() THEN RETURN jsonb_build_object('audited',true,'accounting',budget);END IF;
IF s.error_code NOT IN('retry_budget_exhausted','retry_classification_review_required','unknown_failure_outcome','retry_exhaustion_reconciled') THEN RETURN jsonb_build_object('audited',true,'accounting',budget);END IF;
IF s.condition->'exhaustion_audit'->>'fingerprint'=p_proof->>'fingerprint' THEN RETURN jsonb_build_object('audited',true,'idempotent',true,'accounting',budget);END IF;
gate:=p_proof->>'action'='operator-gate' AND (budget->>'consumed')::integer>=max_slots AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_proof->'entries') i WHERE i->>'classification'='UNKNOWN');
prev:=to_jsonb(s);
IF NOT gate AND r.status='failed' THEN
 IF NOT EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations g WHERE g.run_id=r.run_id AND g.revoked_at IS NULL AND g.max_tasks=r.max_tasks AND g.repair_id IS NOT DISTINCT FROM r.admitted_repair_id) OR EXISTS(SELECT 1 FROM control.workflow_runs other WHERE other.suit_slug=r.suit_slug AND other.status='running' AND other.run_id<>r.run_id) THEN RETURN jsonb_build_object('audited',true,'reason','authority_gate');END IF;
 UPDATE control.workflow_runs SET status='running',finished_at=NULL,run_revision=run_revision+1 WHERE run_id=r.run_id;
END IF;
UPDATE control.recovery_states SET condition=condition||jsonb_build_object('exhaustion_audit',p_proof),status=CASE WHEN gate THEN 'active' ELSE 'resolved' END,error_code=CASE WHEN gate THEN 'retry_budget_exhausted' ELSE 'retry_exhaustion_reconciled' END,next_action=CASE WHEN gate THEN 'wait-operator' ELSE 'reverify' END,failure_class=CASE WHEN gate THEN 'operator-wait' ELSE 'verification-infrastructure' END,recoverable=NOT gate,resolved_at=CASE WHEN gate THEN NULL ELSE now() END,next_wake_at=CASE WHEN gate THEN NULL ELSE now() END,version=version+1,updated_at=now() WHERE recovery_state_id=s.recovery_state_id;
INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(p_task,'retry_exhaustion_audited','dot',jsonb_build_object('run_id',r.run_id,'audit',p_proof,'prior_recovery',prev,'history_preserved',true,'budget_unchanged',true));
RETURN jsonb_build_object('audited',true,'operator_gate',gate,'accounting',budget);
END $$;
REVOKE ALL ON FUNCTION control.record_retry_exhaustion_audit(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.record_retry_exhaustion_audit(text,jsonb) TO bs_control_app;
COMMIT;
