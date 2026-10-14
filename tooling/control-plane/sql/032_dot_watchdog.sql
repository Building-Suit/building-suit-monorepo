BEGIN;
CREATE TABLE IF NOT EXISTS control.dot_incidents (
 incident_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_id uuid NOT NULL REFERENCES control.workflow_runs(run_id),task_id text NOT NULL REFERENCES control.tasks(task_id),
 execution_id bigint REFERENCES control.executions(execution_id),root_fingerprint text NOT NULL,
 classification text NOT NULL CHECK(classification IN('PRODUCT_DEFECT','VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE','PUBLICATION_INFRA','EXTERNAL_EVIDENCE','DECISION_REQUIRED','OPERATOR_AUTHORIZATION','RETRY_BUDGET_EXHAUSTED','TERMINAL_SAFETY','UNKNOWN')),
 recovery_generation integer NOT NULL DEFAULT 0,status text NOT NULL DEFAULT 'observed',
 evidence jsonb NOT NULL,first_seen_at timestamptz NOT NULL DEFAULT now(),last_seen_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE NULLS NOT DISTINCT(run_id,task_id,execution_id,root_fingerprint,recovery_generation)
);
CREATE TABLE IF NOT EXISTS control.dot_wake_events(event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,origin text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),consumed_at timestamptz);
CREATE TABLE IF NOT EXISTS control.dot_cycles(cycle_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,started_at timestamptz NOT NULL DEFAULT now(),outcomes jsonb NOT NULL,codex_invoked_by_scan boolean NOT NULL DEFAULT false);
CREATE OR REPLACE FUNCTION control.record_dot_incident(p_run uuid,p_task text,p_execution bigint,p_fingerprint text,p_class text,p_evidence jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
DECLARE id uuid;
BEGIN
 INSERT INTO control.dot_incidents(run_id,task_id,execution_id,root_fingerprint,classification,evidence)
 VALUES(p_run,p_task,p_execution,p_fingerprint,p_class,p_evidence)
 ON CONFLICT(run_id,task_id,execution_id,root_fingerprint,recovery_generation)
 DO UPDATE SET last_seen_at=now(),evidence=excluded.evidence RETURNING incident_id INTO id;
 RETURN id;
END $$;
CREATE OR REPLACE FUNCTION control.dot_signal() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
DECLARE v_new jsonb:=to_jsonb(NEW); v_old jsonb; v_event bigint;
BEGIN
 IF TG_OP='UPDATE' THEN
  v_old:=to_jsonb(OLD);
  -- Ignore heartbeats and lease renewals; state transitions and evidence wake Dot.
  IF (v_new->'status',v_new->'engine_stage',v_new->'current_task_id',v_new->'completed_tasks',v_new->'next_action',v_new->'failure_class',v_new->'verification_plan')
   IS NOT DISTINCT FROM (v_old->'status',v_old->'engine_stage',v_old->'current_task_id',v_old->'completed_tasks',v_old->'next_action',v_old->'failure_class',v_old->'verification_plan') THEN RETURN NEW; END IF;
 END IF;
 INSERT INTO control.dot_wake_events(origin,payload) VALUES(TG_TABLE_NAME,jsonb_build_object('run_id',coalesce(v_new->>'run_id',v_new->>'workflow_run_id'),'task_id',coalesce(v_new->>'task_id',v_new->>'current_task_id'),'execution_id',v_new->>'execution_id','status',v_new->>'status')) RETURNING event_id INTO v_event;
 PERFORM pg_notify('bs_dot_wake',jsonb_build_object('event_id',v_event)::text);
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['workflow_runs','tasks','executions','verification_runs','pull_requests','recovery_states'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS dot_state_changed ON control.%I',t);
  EXECUTE format('CREATE TRIGGER dot_state_changed AFTER INSERT OR UPDATE ON control.%I FOR EACH ROW EXECUTE FUNCTION control.dot_signal()',t);
 END LOOP;
END $$;
REVOKE ALL ON control.dot_incidents,control.dot_wake_events,control.dot_cycles FROM PUBLIC;
REVOKE ALL ON FUNCTION control.record_dot_incident(uuid,text,bigint,text,text,jsonb),control.dot_signal() FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON control.dot_incidents,control.dot_wake_events,control.dot_cycles TO bs_control_app;
GRANT USAGE,SELECT ON SEQUENCE control.dot_wake_events_event_id_seq,control.dot_cycles_cycle_id_seq TO bs_control_app;
GRANT EXECUTE ON FUNCTION control.record_dot_incident(uuid,text,bigint,text,text,jsonb),control.dot_signal() TO bs_control_app;
ALTER TABLE control.runtime_operations DROP CONSTRAINT runtime_operations_action_check;
ALTER TABLE control.runtime_operations ADD CONSTRAINT runtime_operations_action_check CHECK(action IN('task-run','task-retry','task-verify','task-publish','task-prepare','task-reaccept'));
COMMIT;
