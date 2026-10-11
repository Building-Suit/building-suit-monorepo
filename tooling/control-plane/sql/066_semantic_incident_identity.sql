BEGIN;
CREATE TABLE control.dot_semantic_incident_keys(
 run_id uuid NOT NULL REFERENCES control.workflow_runs,task_identity text NOT NULL,
 cause_fingerprint text NOT NULL CHECK(cause_fingerprint ~ '^[a-f0-9]{64}$'),
 incident_id uuid NOT NULL REFERENCES control.dot_incidents,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(run_id,task_identity,cause_fingerprint)
);
ALTER TABLE control.dot_semantic_incident_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON control.dot_semantic_incident_keys FROM PUBLIC,anon,authenticated,bs_control_app;
GRANT SELECT ON control.dot_semantic_incident_keys TO bs_control_app;
CREATE POLICY semantic_incident_keys_read ON control.dot_semantic_incident_keys FOR SELECT TO bs_control_app USING(true);
ALTER FUNCTION control.record_dot_incident(uuid,text,bigint,text,text,jsonb) RENAME TO record_dot_incident_legacy_v1;
CREATE FUNCTION control.record_dot_incident(p_run uuid,p_task text,p_execution bigint,p_fingerprint text,p_class text,p_evidence jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE id uuid;
BEGIN
 IF p_evidence#>>'{dispatcher,runtime}' IS DISTINCT FROM 'dot-general-v2' THEN
  RETURN control.record_dot_incident_legacy_v1(p_run,p_task,p_execution,p_fingerprint,p_class,p_evidence);END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('semantic-incident:'||p_run::text||':'||coalesce(p_task,'@controller')||':'||p_fingerprint,0));
 SELECT incident_id INTO id FROM control.dot_semantic_incident_keys WHERE run_id=p_run AND task_identity=coalesce(p_task,'@controller') AND cause_fingerprint=p_fingerprint;
 IF id IS NOT NULL THEN RETURN id;END IF;
 id:=control.record_dot_incident_legacy_v1(p_run,p_task,p_execution,p_fingerprint,p_class,p_evidence);
 INSERT INTO control.dot_semantic_incident_keys(run_id,task_identity,cause_fingerprint,incident_id)
 VALUES(p_run,coalesce(p_task,'@controller'),p_fingerprint,id);
 RETURN id;
END $$;
REVOKE ALL ON FUNCTION control.record_dot_incident_legacy_v1(uuid,text,bigint,text,text,jsonb) FROM PUBLIC,anon,authenticated,bs_control_app;
REVOKE ALL ON FUNCTION control.record_dot_incident(uuid,text,bigint,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.record_dot_incident(uuid,text,bigint,text,text,jsonb) TO bs_control_app;
COMMIT;
