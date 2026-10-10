BEGIN;
-- Classification review is not a new failed verification. Require changed
-- executable inputs relative to the original failure, then reserve once.
CREATE OR REPLACE FUNCTION control.claim_recovery_action(p_task text,p_execution bigint,p_action text,p_fingerprint text,p_classification text,p_evidence jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE claimed integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM control.executions e JOIN control.tasks t USING(task_id) WHERE e.execution_id=p_execution AND e.task_id=p_task AND t.status='failed' AND e.execution_id=(SELECT execution_id FROM control.executions WHERE task_id=p_task ORDER BY attempt DESC,execution_id DESC LIMIT 1)) THEN RAISE EXCEPTION 'current_failed_execution_required';END IF;
 IF EXISTS(SELECT 1 FROM control.lifecycle_failure_current c JOIN control.lifecycle_failure_generations g USING(execution_id,fingerprint) WHERE c.execution_id=p_execution AND ((g.evidence->>'source_fingerprint' IS NULL AND g.fingerprint=p_fingerprint) OR g.evidence->>'source_fingerprint'=p_evidence->>'source_fingerprint')) THEN RETURN jsonb_build_object('claimed',false,'reason','classified_verifier_repair_required');END IF;
 INSERT INTO control.recovery_action_claims(task_id,execution_id,action,fingerprint,classification,evidence) VALUES(p_task,p_execution,p_action,p_fingerprint,p_classification,p_evidence) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS claimed=ROW_COUNT;
 RETURN jsonb_build_object('claimed',claimed=1,'fingerprint',p_fingerprint,'reason',CASE WHEN claimed=1 THEN 'new_recovery_inputs' ELSE 'unchanged_recovery_action_forbidden' END);
END $$;
CREATE OR REPLACE FUNCTION control.recovery_action_readiness(p_execution bigint,p_action text,p_fingerprint text,p_source text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT jsonb_build_object('allowed',NOT EXISTS(SELECT 1 FROM control.recovery_action_claims WHERE execution_id=p_execution AND action=p_action AND fingerprint=p_fingerprint)
 AND NOT EXISTS(SELECT 1 FROM control.lifecycle_failure_current c JOIN control.lifecycle_failure_generations g USING(execution_id,fingerprint) WHERE c.execution_id=p_execution AND ((g.evidence->>'source_fingerprint' IS NULL AND g.fingerprint=p_fingerprint) OR g.evidence->>'source_fingerprint'=p_source)));
$$;
COMMIT;
