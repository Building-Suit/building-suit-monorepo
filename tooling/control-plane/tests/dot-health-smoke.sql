\set ON_ERROR_STOP on
DO $$ DECLARE row jsonb:=jsonb_build_object('key','run:55555555-2222-4333-8444-555555555555','run_id','55555555-2222-4333-8444-555555555555','task_id','SS-LAUNCH-AUTH-EMAIL-001','state','RUNNING','why','live worker','observed_at',now(),'operator_action_required',false); before_exec jsonb;
BEGIN
 SELECT jsonb_agg(to_jsonb(e)) INTO before_exec FROM control.executions e WHERE task_id='SS-LAUNCH-AUTH-EMAIL-001';
 PERFORM control.record_dot_health(jsonb_build_array(row));PERFORM control.record_dot_health(jsonb_build_array(row));
 IF EXISTS(SELECT 1 FROM control.dot_health_alerts) THEN RAISE EXCEPTION 'Healthy polling alerted';END IF;
 row:=row||jsonb_build_object('state','STUCK','why','dead worker');
 PERFORM control.record_dot_health(jsonb_build_array(row));PERFORM control.record_dot_health(jsonb_build_array(row));
 IF (SELECT count(*) FROM control.dot_health_alerts)<>1 THEN RAISE EXCEPTION 'Restart/duplicate polling spam';END IF;
 row:=row||jsonb_build_object('state','WAITING_OPERATOR','why','approval');PERFORM control.record_dot_health(jsonb_build_array(row));
 row:=row||jsonb_build_object('state','VERIFYING');PERFORM control.record_dot_health(jsonb_build_array(row));
 IF (SELECT count(*) FROM control.dot_health_alerts)<>2 THEN RAISE EXCEPTION 'Normal transition spam';END IF;
 row:=row||jsonb_build_object('state','COMPLETE','why','batch complete');PERFORM control.record_dot_health(jsonb_build_array(row));PERFORM control.record_dot_health(jsonb_build_array(row));
 IF (SELECT count(*) FROM control.dot_health_alerts)<>3 THEN RAISE EXCEPTION 'Batch completion duplicated';END IF;
 row:=row||jsonb_build_object('state','RUNNING');PERFORM control.record_dot_health(jsonb_build_array(row));
 UPDATE control.dot_health_observations SET observed_at=now()-interval '2 minutes';
 IF (SELECT state FROM control.dot_health_current LIMIT 1)<>'STUCK' THEN RAISE EXCEPTION 'Stale collector falsely healthy';END IF;
 IF before_exec IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(e)) FROM control.executions e WHERE task_id='SS-LAUNCH-AUTH-EMAIL-001') THEN RAISE EXCEPTION 'Health changed an execution';END IF;
 IF has_table_privilege('anon','control.dot_health_observations','SELECT') OR has_table_privilege('authenticated','control.dot_health_observations','SELECT') THEN RAISE EXCEPTION 'Health publicly exposed';END IF;
END $$;
SELECT 'DOT_HEALTH_OBSERVABILITY_PASS';
