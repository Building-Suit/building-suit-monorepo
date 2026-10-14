BEGIN;
CREATE TABLE control.dot_health_observations (
 key text PRIMARY KEY, run_id uuid REFERENCES control.workflow_runs(run_id),task_id text REFERENCES control.tasks(task_id),
 state text NOT NULL CHECK(state IN('RUNNING','VERIFYING','REPAIRING','PUBLISHING','WAITING_TIMER','WAITING_OPERATOR','WAITING_DEPENDENCY','STUCK','FAILED','COMPLETE')),
 observed_at timestamptz NOT NULL, snapshot jsonb NOT NULL
);
CREATE TABLE control.dot_health_alerts (
 alert_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,key text NOT NULL,state text NOT NULL,why text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE control.dot_health_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE control.dot_health_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY dot_health_worker ON control.dot_health_observations TO bs_control_app USING(true) WITH CHECK(true);
CREATE POLICY dot_alert_worker ON control.dot_health_alerts TO bs_control_app USING(true) WITH CHECK(true);
REVOKE ALL ON control.dot_health_observations,control.dot_health_alerts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON control.dot_health_observations TO bs_control_app;
GRANT SELECT,INSERT ON control.dot_health_alerts TO bs_control_app;
GRANT USAGE,SELECT ON SEQUENCE control.dot_health_alerts_alert_id_seq TO bs_control_app;
CREATE FUNCTION control.record_dot_health(p_rows jsonb) RETURNS integer LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
DECLARE item jsonb; old_state text; total integer:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('dot_health_collection'));
 FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  SELECT state INTO old_state FROM control.dot_health_observations WHERE key=item->>'key';
  IF old_state IS DISTINCT FROM item->>'state' AND ((item->>'state') IN('STUCK','WAITING_OPERATOR','FAILED') OR ((item->>'state')='COMPLETE' AND item->>'run_id' IS NOT NULL)) THEN
   INSERT INTO control.dot_health_alerts(key,state,why) VALUES(item->>'key',item->>'state',item->>'why');
  END IF;
  INSERT INTO control.dot_health_observations(key,run_id,task_id,state,observed_at,snapshot)
  VALUES(item->>'key',NULLIF(item->>'run_id','')::uuid,NULLIF(item->>'task_id',''),item->>'state',(item->>'observed_at')::timestamptz,item)
  ON CONFLICT(key) DO UPDATE SET state=excluded.state,observed_at=excluded.observed_at,snapshot=excluded.snapshot,run_id=excluded.run_id,task_id=excluded.task_id WHERE excluded.observed_at>=dot_health_observations.observed_at;
  total:=total+1;
 END LOOP;
 RETURN total;
END $$;
CREATE VIEW control.dot_health_current WITH (security_invoker=true) AS
SELECT key,run_id,task_id,
 CASE WHEN observed_at<now()-interval '90 seconds' AND state NOT IN('COMPLETE','FAILED','WAITING_OPERATOR') THEN 'STUCK' ELSE state END AS state,
 observed_at,
 CASE WHEN observed_at<now()-interval '90 seconds' AND state NOT IN('COMPLETE','FAILED','WAITING_OPERATOR') THEN snapshot||jsonb_build_object('state','STUCK','why','Health collector stale; last reported '||state,'operator_action_required',true,'next_automatic_action','Restart/check the local Dot health service') ELSE snapshot END AS snapshot
FROM control.dot_health_observations;
REVOKE ALL ON control.dot_health_current FROM PUBLIC,anon,authenticated;
GRANT SELECT ON control.dot_health_current TO bs_control_app;
REVOKE ALL ON FUNCTION control.record_dot_health(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.record_dot_health(jsonb) TO bs_control_app;
COMMIT;
