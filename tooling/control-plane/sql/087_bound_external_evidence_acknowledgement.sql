BEGIN;
-- A collected external result is eligible only when the exact command belongs
-- to an external obligation in this run's frozen plan and the latest execution.
CREATE FUNCTION control.external_evidence_status(p_task text,p_check bigint) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 WITH eligible AS (
 SELECT r.run_id,c.verification_id,c.check_name,c.verification_run_id
 FROM control.workflow_runs r
 JOIN control.bounded_verification_plans frozen ON frozen.run_id=r.run_id AND frozen.task_id=p_task
 JOIN control.executions e ON e.task_id=p_task
 JOIN control.verification_runs v USING(execution_id)
 JOIN control.verification_results c USING(verification_run_id)
 WHERE r.current_task_id=p_task AND r.status='running' AND c.verification_id=p_check
 AND e.execution_id=(SELECT max(execution_id) FROM control.executions WHERE task_id=p_task)
 AND v.verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=e.execution_id)
 AND v.status='passed' AND c.status='pass' AND c.metadata->>'required' IS DISTINCT FROM 'false'
 AND c.trusted_receipt->>'version'='2' AND c.trusted_registration IS NOT NULL
 AND c.trusted_receipt->'registration'=c.trusted_registration
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(frozen.plan->'obligations') obligation,
 jsonb_array_elements(coalesce(obligation#>'{external_gate,registered_checks}','[]')) registered
 WHERE obligation->>'category'='EXTERNAL_EVIDENCE' AND registered->>'name'=c.check_name)
 ) SELECT jsonb_build_object('eligible',EXISTS(SELECT 1 FROM eligible),'acknowledged',EXISTS(
 SELECT 1 FROM eligible JOIN control.operator_authority_events a USING(run_id)
 WHERE a.task_id=p_task AND a.action='external-evidence-acknowledgement' AND a.response='approve'
 AND a.offer->>'verification_id'=p_check::text AND NOT EXISTS(
 SELECT 1 FROM control.operator_authority_events revoked WHERE revoked.run_id=a.run_id AND revoked.gate_fingerprint=a.gate_fingerprint AND revoked.response='revoke')));
$$;
ALTER FUNCTION control.external_evidence_status(text,bigint) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.external_evidence_status(text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.external_evidence_status(text,bigint) TO bs_control_executor,bs_control_observer,bs_control_operator;
ALTER FUNCTION control.operator_gate_offers(uuid) RENAME TO operator_gate_offers_external_v1;
CREATE FUNCTION control.operator_gate_offers(p_run uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT coalesce(jsonb_agg(offer),'[]') FROM jsonb_array_elements(control.operator_gate_offers_external_v1(p_run)) offer
 WHERE offer->>'action'<>'external-evidence-acknowledgement'
 OR control.external_evidence_status(offer->>'task_id',(offer->>'verification_id')::bigint)->>'eligible'='true';
$$;
ALTER FUNCTION control.operator_gate_offers(uuid) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.operator_gate_offers(uuid),control.operator_gate_offers_external_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.operator_gate_offers(uuid) TO bs_control_executor,bs_control_observer,bs_control_operator;
COMMIT;
