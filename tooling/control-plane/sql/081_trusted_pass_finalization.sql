BEGIN;
DO $$DECLARE definition text;BEGIN
 definition:=pg_get_functiondef('control.finish_verification_run(text,bigint)'::regprocedure);
 definition:=replace(definition,$old$status IN('fail','not_run')$old$,$new$status IN('fail','not_run','unavailable')$new$);
 EXECUTE definition;
END $$;
ALTER FUNCTION control.finish_verification_run(text,bigint) RENAME TO finish_verification_run_results_v1;
CREATE FUNCTION control.finish_verification_run(p_task text,p_run bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE result jsonb;verification control.verification_runs%ROWTYPE;execution control.executions%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM control.verification_runs v JOIN control.executions e USING(execution_id) WHERE v.verification_run_id=p_run AND e.task_id=p_task AND v.verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=e.execution_id)) THEN RAISE EXCEPTION 'current_verification_subject_required';END IF;
 IF EXISTS(SELECT 1 FROM control.verification_results c WHERE c.verification_run_id=p_run AND c.status='pass' AND coalesce(c.metadata->>'required','true')<>'false' AND (c.trusted_receipt IS NULL OR c.trusted_receipt->>'version' IS DISTINCT FROM '2' OR c.trusted_registration IS NULL OR c.trusted_receipt->'registration' IS DISTINCT FROM c.trusted_registration)) THEN RAISE EXCEPTION 'trusted_bound_pass_receipt_required';END IF;
 result:=control.finish_verification_run_results_v1(p_task,p_run);
 SELECT * INTO verification FROM control.verification_runs WHERE verification_run_id=p_run;
 SELECT * INTO execution FROM control.executions WHERE execution_id=verification.execution_id;
 IF result->>'passed'='true' AND execution.status='failed' AND verification.metadata->>'verifier_only_reacceptance'='true' AND EXISTS(SELECT 1 FROM control.task_events approval WHERE approval.event_id::text=verification.metadata->>'approval_event_id' AND approval.task_id=p_task AND approval.event_type='verifier_reacceptance_authorized' AND approval.payload->>'execution_id'=execution.execution_id::text AND approval.payload->>'attempt'=execution.attempt::text) THEN
  INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload) VALUES(p_task,'verifier_only_reaccepted','verification','passed','runner',jsonb_build_object('verification_run_id',p_run,'execution_id',execution.execution_id,'attempt',execution.attempt,'approval_event_id',verification.metadata->'approval_event_id','historical_failures_preserved',true,'trusted_reverification',true));
 END IF;
 RETURN result;
END $$;
ALTER FUNCTION control.finish_verification_run(text,bigint) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.finish_verification_run_results_v1(text,bigint),control.finish_verification_run(text,bigint) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_operator;
GRANT EXECUTE ON FUNCTION control.finish_verification_run(text,bigint) TO bs_control_verifier;
COMMIT;
