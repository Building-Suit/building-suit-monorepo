BEGIN;
-- Fresh unattended STUCK transitions and append-only classification evidence
-- wake the existing BS-31 owner. Stable health polling never emits more wakes.
CREATE FUNCTION control.dot_health_stuck_signal() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
DECLARE id bigint;
BEGIN
 IF NEW.run_id IS NULL OR NEW.state<>'STUCK' OR NEW.snapshot->>'operator_action_required'<>'false' THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND OLD.state=NEW.state AND OLD.task_id IS NOT DISTINCT FROM NEW.task_id
 AND OLD.snapshot->>'execution_id' IS NOT DISTINCT FROM NEW.snapshot->>'execution_id' THEN RETURN NEW;END IF;
 INSERT INTO control.dot_wake_events(origin,payload) VALUES('dot-health-stuck',jsonb_build_object('run_id',NEW.run_id,'task_id',NEW.task_id,'execution_id',NEW.snapshot->>'execution_id')) RETURNING event_id INTO id;
 PERFORM pg_notify('bs_dot_wake',jsonb_build_object('event_id',id)::text);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION control.dot_health_stuck_signal() FROM PUBLIC;
CREATE TRIGGER dot_health_stuck AFTER INSERT OR UPDATE ON control.dot_health_observations FOR EACH ROW EXECUTE FUNCTION control.dot_health_stuck_signal();
CREATE TRIGGER dot_attempt_classified AFTER INSERT ON control.product_attempt_classifications FOR EACH ROW EXECUTE FUNCTION control.dot_signal();
-- Reconcile currently observed incidents once when installing this runtime.
DO $$ DECLARE id bigint;
BEGIN
 IF EXISTS(SELECT 1 FROM control.dot_health_current WHERE state='STUCK' AND snapshot->>'operator_action_required'='false') THEN
 INSERT INTO control.dot_wake_events(origin,payload) VALUES('dot-stuck-runtime-installed','{"resume_existing_only":true,"product_attempt_added":false}') RETURNING event_id INTO id;
 PERFORM pg_notify('bs_dot_wake',jsonb_build_object('event_id',id)::text);
 END IF;
END $$;
COMMIT;
