BEGIN;
ALTER TABLE control.dot_health_observations DROP CONSTRAINT dot_health_observations_state_check;
ALTER TABLE control.dot_health_observations ADD CONSTRAINT dot_health_observations_state_check
 CHECK(state IN('RUNNING','VERIFYING','REPAIRING','PUBLISHING','WAITING_TIMER','WAITING_OPERATOR','WAITING_DEPENDENCY','WAITING_ADMISSION','RECONCILING','STUCK','FAILED','COMPLETE','INVESTIGATING','IDLE','LIMIT_REACHED','CLOSED','CANCELLED','STOPPED','SUPERSEDED','FINISHED'));
CREATE OR REPLACE VIEW control.dot_health_current WITH (security_invoker=true) AS
 SELECT key,run_id,task_id,
 CASE WHEN observed_at<now()-interval '90 seconds' AND coalesce(snapshot->>'history_only','false')<>'true' THEN 'STUCK' ELSE state END AS state,
 observed_at,
 CASE WHEN observed_at<now()-interval '90 seconds' AND coalesce(snapshot->>'history_only','false')<>'true'
 THEN snapshot||jsonb_build_object('state','STUCK','activity_state','STUCK','why','Health collector stale; last reported '||state,'operator_action_required',true,'next_automatic_action','Check/restart the local Dot health service','collector_stale',true)
 ELSE snapshot END AS snapshot FROM control.dot_health_observations;
CREATE TABLE control.dot_job_lifecycle_events(
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 incident_id uuid NOT NULL REFERENCES control.dot_incidents,
 from_status text,to_status text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),evidence jsonb NOT NULL
);
ALTER TABLE control.dot_job_lifecycle_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON control.dot_job_lifecycle_events FROM PUBLIC,anon,authenticated,bs_control_app;
GRANT SELECT ON control.dot_job_lifecycle_events TO bs_control_app;
CREATE FUNCTION control.audit_dot_job_lifecycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
 INSERT INTO control.dot_job_lifecycle_events(incident_id,from_status,to_status,evidence)
 VALUES(NEW.incident_id,CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,NEW.status,jsonb_build_object('owner',NEW.owner,'action',NEW.action,'evidence',NEW.evidence)); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER dot_job_lifecycle_audit AFTER INSERT OR UPDATE ON control.dot_recovery_jobs FOR EACH ROW EXECUTE FUNCTION control.audit_dot_job_lifecycle();
REVOKE ALL ON FUNCTION control.audit_dot_job_lifecycle() FROM PUBLIC,anon,authenticated,bs_control_app;
CREATE OR REPLACE FUNCTION control.reconcile_dot_recovery_completion() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE settled integer;
BEGIN
 UPDATE control.dot_recovery_jobs j SET status='resolved',claim_token=NULL,claim_until=NULL,updated_at=now(),
 evidence=evidence||jsonb_build_object('resolved_by','authoritative_subject_transition','resolved_at',now(),'previous_status',j.status)
 FROM control.workflow_runs r WHERE r.run_id=j.run_id AND j.status IN('queued','running','human-gate')
 AND (NOT control.run_is_actionable(r.status,r.current_task_id,r.finished_at)
 OR (j.task_id IS NULL AND r.current_task_id IS NOT NULL)
 OR (j.task_id IS NOT NULL AND r.current_task_id IS DISTINCT FROM j.task_id
 AND EXISTS(SELECT 1 FROM control.workflow_run_task_credits credit WHERE credit.run_id=j.run_id AND credit.task_id=j.task_id)));
 GET DIAGNOSTICS settled=ROW_COUNT;
 UPDATE control.dot_incidents i SET status='resolved',claim_until=NULL WHERE i.status<>'resolved' AND EXISTS(SELECT 1 FROM control.dot_recovery_jobs j WHERE j.incident_id=i.incident_id AND j.status='resolved');
 RETURN settled;
END $$;
COMMIT;
