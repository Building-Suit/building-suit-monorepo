BEGIN;
CREATE OR REPLACE FUNCTION control.dot_signal() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
DECLARE v_new jsonb:=to_jsonb(NEW); v_old jsonb; v_event bigint;
BEGIN
 IF TG_TABLE_NAME='recovery_states' AND v_new->>'failure_class' IN('transient-infrastructure','publication-reconciliation') THEN RETURN NEW; END IF;
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
COMMIT;
