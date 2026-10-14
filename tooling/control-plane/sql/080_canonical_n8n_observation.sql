BEGIN;
-- Adopt the already installed observational table without replacing its rows.
-- Observations are telemetry; they cannot grant task or publication authority.
CREATE TABLE IF NOT EXISTS control.n8n_runtime_executions (
 n8n_execution_id text PRIMARY KEY, workflow_id text, workflow_name text,
 run_id uuid, suit_slug text, task_id text, runtime_status text NOT NULL,
 current_node text, current_stage text, started_at timestamptz,
 last_heartbeat_at timestamptz, finished_at timestamptz,
 error_code text, error_message text, metadata jsonb NOT NULL DEFAULT '{}',
 observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS n8n_runtime_run_idx ON control.n8n_runtime_executions(run_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS n8n_runtime_suit_status_idx ON control.n8n_runtime_executions(suit_slug,runtime_status,observed_at DESC);
CREATE INDEX IF NOT EXISTS n8n_runtime_task_idx ON control.n8n_runtime_executions(task_id,observed_at DESC);
ALTER TABLE control.n8n_runtime_executions OWNER TO bs_control_migration_owner;
ALTER TABLE control.n8n_runtime_executions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON control.n8n_runtime_executions FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_verifier,bs_control_operator;
-- The old dashboard principal remains read-only if present on this host.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bs_dashboard_reader') THEN
  REVOKE ALL ON control.n8n_runtime_executions FROM bs_dashboard_reader;
  GRANT bs_control_observer TO bs_dashboard_reader;
 END IF;
END $$;
GRANT SELECT ON control.n8n_runtime_executions TO bs_control_executor,bs_control_observer;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='control' AND tablename='n8n_runtime_executions' AND policyname='remediation_read_capabilities') THEN CREATE POLICY remediation_read_capabilities ON control.n8n_runtime_executions FOR SELECT TO bs_control_executor,bs_control_observer,bs_control_verifier USING(true);END IF;END $$;
CREATE POLICY n8n_observation_read ON control.n8n_runtime_executions FOR SELECT TO bs_control_executor,bs_control_observer USING(true);
CREATE FUNCTION control.record_n8n_observation(p_observation jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
BEGIN
 IF coalesce(p_observation->>'n8n_execution_id','') !~ '^[0-9]{1,24}$'
 OR p_observation->>'runtime_status' NOT IN('running','waiting','success','error','canceled','crashed','new')
 OR p_observation->>'runtime_status' IS NULL THEN RAISE EXCEPTION 'typed_n8n_observation_required';END IF;
 INSERT INTO control.n8n_runtime_executions(n8n_execution_id,workflow_id,workflow_name,run_id,suit_slug,task_id,runtime_status,current_node,current_stage,started_at,last_heartbeat_at,finished_at,error_code,metadata)
 VALUES(p_observation->>'n8n_execution_id',p_observation->>'workflow_id',p_observation->>'workflow_name',nullif(p_observation->>'run_id','')::uuid,p_observation->>'suit_slug',p_observation->>'task_id',p_observation->>'runtime_status',p_observation->>'current_node',p_observation->>'current_stage',nullif(p_observation->>'started_at','')::timestamptz,now(),nullif(p_observation->>'finished_at','')::timestamptz,p_observation->>'error_code','{}')
 ON CONFLICT(n8n_execution_id) DO UPDATE SET runtime_status=EXCLUDED.runtime_status,current_node=EXCLUDED.current_node,current_stage=EXCLUDED.current_stage,last_heartbeat_at=now(),finished_at=EXCLUDED.finished_at,error_code=EXCLUDED.error_code,observed_at=now()
 WHERE control.n8n_runtime_executions.workflow_id IS NOT DISTINCT FROM EXCLUDED.workflow_id
 AND control.n8n_runtime_executions.run_id IS NOT DISTINCT FROM EXCLUDED.run_id;
END $$;
ALTER FUNCTION control.record_n8n_observation(jsonb) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.record_n8n_observation(jsonb) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_operator,bs_control_verifier;
GRANT EXECUTE ON FUNCTION control.record_n8n_observation(jsonb) TO bs_control_executor;
COMMIT;
