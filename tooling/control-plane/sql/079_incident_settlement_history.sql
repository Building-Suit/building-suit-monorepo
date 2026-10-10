BEGIN;
ALTER TABLE control.dot_recovery_jobs DROP CONSTRAINT dot_recovery_jobs_status_check;
ALTER TABLE control.dot_recovery_jobs ADD CONSTRAINT dot_recovery_jobs_status_check CHECK(status IN('queued','running','resolved','human-gate','closed','cancelled','superseded','failed'));
CREATE TABLE control.dot_incident_observations(
 observation_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,incident_id uuid NOT NULL REFERENCES control.dot_incidents,
 previous_status text,status text NOT NULL,evidence jsonb NOT NULL,observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE control.dot_model_invocation_events(
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,invocation_id bigint NOT NULL REFERENCES control.dot_model_invocations,
 previous_status text,status text NOT NULL,receipt jsonb NOT NULL,observed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE control.dot_incident_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE control.dot_model_invocation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON control.dot_incident_observations,control.dot_model_invocation_events FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_verifier,bs_control_operator,bs_control_observer;
GRANT SELECT ON control.dot_incident_observations,control.dot_model_invocation_events TO bs_control_executor,bs_control_observer;
CREATE POLICY incident_observation_read ON control.dot_incident_observations FOR SELECT TO bs_control_executor,bs_control_observer USING(true);
CREATE POLICY invocation_event_read ON control.dot_model_invocation_events FOR SELECT TO bs_control_executor,bs_control_observer USING(true);
ALTER TABLE control.dot_incident_observations OWNER TO bs_control_migration_owner;
ALTER TABLE control.dot_model_invocation_events OWNER TO bs_control_migration_owner;
CREATE FUNCTION control.audit_incident_observation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
BEGIN
 IF TG_OP='INSERT' OR ROW(NEW.status,NEW.evidence,NEW.classification) IS DISTINCT FROM ROW(OLD.status,OLD.evidence,OLD.classification) THEN
 INSERT INTO control.dot_incident_observations(incident_id,previous_status,status,evidence) VALUES(NEW.incident_id,CASE WHEN TG_OP='UPDATE' THEN OLD.status END,NEW.status,NEW.evidence);END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION control.audit_model_invocation_transition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
BEGIN
 IF TG_OP='INSERT' OR ROW(NEW.status,NEW.launched_at,NEW.finished_at,NEW.after_fingerprint) IS DISTINCT FROM ROW(OLD.status,OLD.launched_at,OLD.finished_at,OLD.after_fingerprint) THEN
 INSERT INTO control.dot_model_invocation_events(invocation_id,previous_status,status,receipt) VALUES(NEW.invocation_id,CASE WHEN TG_OP='UPDATE' THEN OLD.status END,NEW.status,to_jsonb(NEW));END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION control.audit_incident_observation() OWNER TO bs_control_migration_owner;
ALTER FUNCTION control.audit_model_invocation_transition() OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.audit_incident_observation(),control.audit_model_invocation_transition() FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor;
CREATE TRIGGER dot_incident_observation_history AFTER INSERT OR UPDATE ON control.dot_incidents FOR EACH ROW EXECUTE FUNCTION control.audit_incident_observation();
CREATE TRIGGER dot_model_invocation_history AFTER INSERT OR UPDATE ON control.dot_model_invocations FOR EACH ROW EXECUTE FUNCTION control.audit_model_invocation_transition();
CREATE OR REPLACE FUNCTION control.reconcile_dot_recovery_completion() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE settled integer;
BEGIN
 UPDATE control.dot_recovery_jobs j SET status=CASE WHEN r.status='cancelled' THEN 'cancelled' WHEN r.status='superseded' OR (j.task_id IS NULL AND r.current_task_id IS NOT NULL) OR (j.task_id IS NOT NULL AND r.current_task_id IS DISTINCT FROM j.task_id AND NOT EXISTS(SELECT 1 FROM control.workflow_run_task_credits credit WHERE credit.run_id=j.run_id AND credit.task_id=j.task_id)) THEN 'superseded' WHEN r.status='failed' THEN 'failed' ELSE 'closed' END,
 claim_token=NULL,claim_until=NULL,updated_at=now(),evidence=j.evidence||jsonb_build_object('terminal_reason',CASE WHEN NOT control.run_is_actionable(r.status,r.current_task_id,r.finished_at) THEN 'run_lifecycle_terminal' ELSE 'subject_superseded_or_credited' END,'same_history_preserved',true,'terminal_run_status',r.status)
 FROM control.workflow_runs r WHERE r.run_id=j.run_id AND j.status IN('queued','running','human-gate') AND (NOT control.run_is_actionable(r.status,r.current_task_id,r.finished_at) OR (j.task_id IS NULL AND r.current_task_id IS NOT NULL) OR (j.task_id IS NOT NULL AND r.current_task_id IS DISTINCT FROM j.task_id));
 GET DIAGNOSTICS settled=ROW_COUNT;
 UPDATE control.dot_incidents i SET status=j.status,claim_until=NULL FROM control.dot_recovery_jobs j WHERE j.incident_id=i.incident_id AND j.status IN('closed','cancelled','superseded','failed','resolved') AND i.status IS DISTINCT FROM j.status;
 RETURN settled;
END $$;
DO $$BEGIN
 EXECUTE replace(pg_get_functiondef('control.finish_dot_recovery(uuid,uuid,text,jsonb,text,text)'::regprocedure), 'IF j.claim_token IS DISTINCT FROM p_token', $replacement$IF j.status NOT IN('queued','running','human-gate') OR j.claim_token IS DISTINCT FROM p_token$replacement$);
END $$;
-- Ledgers retain exact statements and state transitions. Corrections append;
-- even an accidental installer UPDATE must not silently revise audit evidence.
CREATE FUNCTION control.reject_append_only_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$BEGIN RAISE EXCEPTION 'append_only_control_evidence';END $$;
ALTER FUNCTION control.reject_append_only_mutation() OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.reject_append_only_mutation() FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor;
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['migration_release_ledger','runtime_release_ledger','runtime_activation_events','control_schema_adoption_baselines','dot_job_lifecycle_events','dot_incident_observations','dot_model_invocation_events','operator_authority_events','verification_review_revisions','execution_parent_revisions'] LOOP
 EXECUTE format('CREATE TRIGGER immutable_control_evidence BEFORE UPDATE OR DELETE ON control.%I FOR EACH ROW EXECUTE FUNCTION control.reject_append_only_mutation()',t);
 END LOOP;
END $$;
COMMIT;
