BEGIN;
-- Bounded latest-row joins and pending-event watermark; no history payload index.
CREATE INDEX IF NOT EXISTS dot_verification_latest_idx ON control.verification_runs(execution_id,verification_run_id DESC);
CREATE INDEX IF NOT EXISTS dot_publication_latest_idx ON control.pull_requests(task_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS dot_job_current_idx ON control.dot_recovery_jobs(run_id,task_id,started_at DESC) WHERE status IN('queued','running','human-gate');
CREATE INDEX IF NOT EXISTS dot_pending_event_idx ON control.dot_wake_events(event_id DESC) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS dot_progress_latest_idx ON control.task_events(task_id,created_at DESC) WHERE event_type IN('task_claimed','execution_started','execution_finished','retry_started','verification_started','verification_finished','publication_started','publication_completed','verifier_only_reaccepted','preexecution_verification_bindings_reconciled','executable_verification_binding_reconciled');
CREATE INDEX IF NOT EXISTS dot_history_page_idx ON control.workflow_runs(started_at DESC,run_id DESC);
-- Only acknowledge events visible to this scan. A state change racing the scan
-- remains pending for the relay/fallback; no business authority is changed.
CREATE FUNCTION control.record_dot_compact_cycle(p_outcomes jsonb,p_watermark bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE consumed integer;
BEGIN
 IF jsonb_typeof(p_outcomes)<>'array' OR p_watermark<0 THEN RAISE EXCEPTION 'invalid_compact_cycle';END IF;
 PERFORM control.reconcile_dot_recovery_completion();
 PERFORM control.reconcile_reviewed_evidence_incidents();
 INSERT INTO control.dot_cycles(outcomes) VALUES(p_outcomes);
 UPDATE control.dot_wake_events SET consumed_at=now() WHERE consumed_at IS NULL AND event_id<=p_watermark;
 GET DIAGNOSTICS consumed=ROW_COUNT;
 RETURN jsonb_build_object('processed_watermark',p_watermark,'consumed_events',consumed);
END $$;
ALTER FUNCTION control.record_dot_compact_cycle(jsonb,bigint) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.record_dot_compact_cycle(jsonb,bigint) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator;
GRANT EXECUTE ON FUNCTION control.record_dot_compact_cycle(jsonb,bigint) TO bs_runtime_executor;
-- Match the two-minute safety cadence; stale remains explicit after one missed scan.
CREATE OR REPLACE VIEW control.dot_health_current WITH (security_invoker=true) AS
 SELECT key,run_id,task_id,
 CASE WHEN observed_at<now()-interval '180 seconds' AND coalesce(snapshot->>'history_only','false')<>'true' THEN 'STUCK' ELSE state END AS state,
 observed_at,
 CASE WHEN observed_at<now()-interval '180 seconds' AND coalesce(snapshot->>'history_only','false')<>'true'
 THEN snapshot||jsonb_build_object('state','STUCK','activity_state','STUCK','why','Health collector stale; last reported '||state,'operator_action_required',true,'next_automatic_action','Check/restart the local Dot health service','collector_stale',true)
 ELSE snapshot END AS snapshot FROM control.dot_health_observations;
COMMIT;
