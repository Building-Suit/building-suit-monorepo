BEGIN;
CREATE FUNCTION control.bind_verifier_failure_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.metadata->'failure_evidence' IS NULL OR NEW.metadata->'failure_evidence'='null'::jsonb) AND OLD.metadata->'failure_evidence' IS NOT NULL THEN
 NEW.metadata:=jsonb_set(NEW.metadata,'{failure_evidence}',OLD.metadata->'failure_evidence');
 END IF;
 IF NEW.metadata->'failure_evidence' IS NOT NULL AND NEW.metadata->'failure_evidence'<>'null'::jsonb THEN
 NEW.metadata:=jsonb_set(NEW.metadata,'{failure_evidence}',(NEW.metadata->'failure_evidence')||jsonb_build_object('execution_id',NEW.execution_id,'verification_run_id',NEW.verification_run_id,'check_id',NEW.verification_id,'check_name',NEW.check_name,'command',NEW.command,'status',NEW.status,'exit_code',NEW.exit_code));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER verifier_evidence_binding BEFORE INSERT OR UPDATE ON control.verification_results FOR EACH ROW EXECUTE FUNCTION control.bind_verifier_failure_evidence();
REVOKE ALL ON FUNCTION control.bind_verifier_failure_evidence() FROM PUBLIC,anon,authenticated;
CREATE TABLE control.verification_failure_reviews(
 verification_id bigint PRIMARY KEY REFERENCES control.verification_results,
 check_fingerprint text NOT NULL,evidence jsonb NOT NULL,reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE control.verification_failure_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_private ON control.verification_failure_reviews TO bs_control_app USING(true);
REVOKE ALL ON control.verification_failure_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON control.verification_failure_reviews TO bs_control_app;
-- Only the trusted host may review immutable check receipts. Classifier audit
-- claims cannot create reviews or manufacture evidence in this table.
CREATE FUNCTION control.review_verification_failure(p_id bigint,p_evidence jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE c control.verification_results%ROWTYPE;
BEGIN
 SELECT * INTO c FROM control.verification_results WHERE verification_id=p_id FOR UPDATE;
 IF c.status NOT IN('fail','not_run','unavailable') OR c.verification_run_id IS DISTINCT FROM (SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=c.execution_id)
 OR p_evidence->>'version' IS DISTINCT FROM '2' OR (p_evidence->>'execution_id')::bigint IS DISTINCT FROM c.execution_id
 OR (p_evidence->>'verification_run_id')::bigint IS DISTINCT FROM c.verification_run_id OR p_evidence->>'check_name' IS DISTINCT FROM c.check_name
 OR p_evidence->>'command' IS DISTINCT FROM c.command OR (p_evidence->>'exit_code')::integer IS DISTINCT FROM c.exit_code
 OR p_evidence->'artifact'->>'path' IS DISTINCT FROM c.log_path OR p_evidence->'artifact'->>'sha256' IS NULL OR p_evidence->'artifact'->>'sha256' !~ '^[a-f0-9]{64}$'
 OR (c.metadata->'failure_evidence'->'artifact'->>'sha256' IS NOT NULL AND c.metadata->'failure_evidence'->'artifact'->>'sha256' IS DISTINCT FROM p_evidence->'artifact'->>'sha256')
 OR jsonb_typeof(p_evidence->'review'->'source') IS DISTINCT FROM 'array'
 OR p_evidence->'review'->>'root_cause' IS NULL OR jsonb_array_length(p_evidence->'review'->'source')=0
 OR coalesce(p_evidence->>'classification','') NOT IN('PRODUCT_DEFECT','VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE','PUBLICATION_INFRA','UNKNOWN')
 OR (p_evidence->>'classification'='PRODUCT_DEFECT' AND coalesce(p_evidence->>'origin','') NOT IN('product-test','application-sql','application-http','application-behavior'))
 THEN RAISE EXCEPTION 'Bound latest verifier receipt and reviewed root cause required';END IF;
 INSERT INTO control.verification_failure_reviews VALUES(p_id,md5(jsonb_build_array(c.execution_id,c.verification_run_id,c.check_name,c.command,c.exit_code,c.status,c.log_path)::text),p_evidence,now())
 ON CONFLICT(verification_id) DO UPDATE SET evidence=excluded.evidence,check_fingerprint=excluded.check_fingerprint,reviewed_at=now();
END $$;
REVOKE ALL ON FUNCTION control.review_verification_failure(bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.review_verification_failure(bigint,jsonb) TO bs_control_app;
CREATE OR REPLACE FUNCTION control.record_retry_exhaustion_audit(p_task text,p_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; s control.recovery_states%ROWTYPE; item jsonb; ex control.executions%ROWTYPE; budget jsonb; max_slots integer; gate boolean; prev jsonb;
BEGIN
SELECT * INTO r FROM control.workflow_runs WHERE current_task_id=p_task ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
IF r.run_id IS NULL OR r.stop_requested OR r.maintenance_requested OR (EXISTS(SELECT 1 FROM control.dot_task_scope_authorities WHERE run_id=r.run_id) AND NOT EXISTS(SELECT 1 FROM control.dot_task_scope_authorities WHERE run_id=r.run_id AND task_id=p_task)) THEN RETURN jsonb_build_object('audited',false,'reason','hard_run_gate');END IF;
max_slots:=(control.resolved_retry_policy(p_task)->>'max_attempts')::integer;
IF p_proof->>'version'<>'1' OR p_proof->>'all_attempts_audited'<>'true' OR (p_proof->>'max_attempts')::integer<>max_slots OR jsonb_typeof(p_proof->'entries')<>'array' THEN RAISE EXCEPTION 'Complete unchanged-policy audit required';END IF;
FOR item IN SELECT value FROM jsonb_array_elements(p_proof->'entries') LOOP
SELECT * INTO ex FROM control.executions WHERE task_id=p_task AND execution_id=(item->>'execution_id')::bigint;
IF ex.execution_id IS NULL OR ex.status='running' OR ex.attempt<>(item->>'attempt')::integer OR item->>'classification' NOT IN('PRODUCT_DEFECT','VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE','PUBLICATION_INFRA','UNKNOWN') THEN RAISE EXCEPTION 'Audit execution/classification mismatch';END IF;
IF item->>'classification'='PRODUCT_DEFECT' AND NOT EXISTS(
 SELECT 1 FROM control.verification_results vr JOIN control.verification_failure_reviews review USING(verification_id)
 WHERE vr.execution_id=ex.execution_id AND vr.status='fail' AND review.evidence->>'classification'='PRODUCT_DEFECT'
 AND vr.verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=ex.execution_id)
 AND review.check_fingerprint=md5(jsonb_build_array(vr.execution_id,vr.verification_run_id,vr.check_name,vr.command,vr.exit_code,vr.status,vr.log_path)::text)
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(item->'blocking_checks') c WHERE c->'failure_evidence'=review.evidence)
 ) THEN RAISE EXCEPTION 'Authoritative execution-bound reviewed product evidence required';END IF;
INSERT INTO control.product_attempt_classifications(execution_id,classification,evidence_fingerprint,source,evidence)
VALUES(ex.execution_id,CASE WHEN item->>'classification'='UNKNOWN' THEN 'OTHER' WHEN item->>'classification'='PUBLICATION_INFRA' THEN 'VERIFIER_INFRA' ELSE item->>'classification' END,md5(control.retry_evidence_fingerprint(ex.execution_id)||(p_proof->>'fingerprint')),'dot',item||jsonb_build_object('audited',true,'audit_version',1)) ON CONFLICT DO NOTHING;
END LOOP;
IF EXISTS(SELECT 1 FROM control.executions e WHERE e.task_id=p_task AND e.status<>'running' AND EXISTS(SELECT 1 FROM control.failures f WHERE f.execution_id=e.execution_id) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_proof->'entries') i WHERE (i->>'execution_id')::bigint=e.execution_id)) THEN RAISE EXCEPTION 'Every failed attempt must be audited';END IF;
budget:=control.product_retry_accounting(p_task);
IF (budget->>'consumed')::integer<>(p_proof->>'consumed')::integer THEN RAISE EXCEPTION 'Product accounting mismatch';END IF;
SELECT * INTO s FROM control.recovery_states WHERE current_task_id=p_task ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
-- Audit is evidence only while a worker or a different safety boundary owns the task.
IF EXISTS(SELECT 1 FROM control.executions WHERE task_id=p_task AND status='running') OR s.lease_expires_at>now() THEN RETURN jsonb_build_object('audited',true,'accounting',budget);END IF;
IF s.error_code NOT IN('retry_budget_exhausted','retry_classification_review_required','unknown_failure_outcome','retry_exhaustion_reconciled','retry_audit_investigation_required') THEN RETURN jsonb_build_object('audited',true,'accounting',budget);END IF;
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
CREATE FUNCTION control.reconcile_reviewed_evidence_incidents() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE n integer;
BEGIN
 UPDATE control.dot_recovery_jobs j SET status='resolved',claim_token=NULL,claim_until=NULL,updated_at=now(),evidence=evidence||jsonb_build_object('resolved_by','execution_bound_evidence_review','previous_gate_preserved',true)
 WHERE j.status IN('queued','running','human-gate')
 AND EXISTS(SELECT 1 FROM control.recovery_states s WHERE s.current_task_id=j.task_id AND s.error_code IN('retry_audit_investigation_required','retry_exhaustion_reconciled'))
 AND (j.evidence#>>'{response,response,recovery,reason}'='retry_audit_investigation_required' OR j.root_family='unknown-lifecycle')
 AND EXISTS(SELECT 1 FROM control.verification_results c JOIN control.executions e USING(execution_id) WHERE e.task_id=j.task_id AND c.status='fail')
 AND NOT EXISTS(SELECT 1 FROM control.verification_results c JOIN control.executions e USING(execution_id) LEFT JOIN control.verification_failure_reviews review USING(verification_id) WHERE e.task_id=j.task_id AND c.status IN('fail','not_run','unavailable')
 AND c.verification_run_id=(SELECT max(v.verification_run_id) FROM control.verification_runs v WHERE v.execution_id=e.execution_id)
 AND (review.evidence IS NULL OR review.evidence->>'classification'='UNKNOWN'));
 GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE control.dot_incidents i SET status='resolved',claim_until=NULL WHERE EXISTS(SELECT 1 FROM control.dot_recovery_jobs j WHERE j.incident_id=i.incident_id AND j.status='resolved' AND j.evidence->>'resolved_by'='execution_bound_evidence_review');
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION control.reconcile_reviewed_evidence_incidents() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.reconcile_reviewed_evidence_incidents() TO bs_control_app;
COMMIT;
