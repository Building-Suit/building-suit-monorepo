\set ON_ERROR_STOP on
DO $$ DECLARE id uuid; replay uuid; attempts integer; events bigint; BEGIN
 SELECT count(*) INTO attempts FROM control.executions WHERE task_id='CP-SH-FIXTURE-001';
 id:=control.record_dot_incident('11111111-2222-4333-8444-555555555555','CP-SH-FIXTURE-001',NULL,'fixture-root','TRANSIENT_INFRASTRUCTURE','{"test":"worker-disappears"}');
 replay:=control.record_dot_incident('11111111-2222-4333-8444-555555555555','CP-SH-FIXTURE-001',NULL,'fixture-root','TRANSIENT_INFRASTRUCTURE','{"test":"n8n-restarted"}');
 IF id<>replay OR (SELECT count(*) FROM control.dot_incidents WHERE root_fingerprint='fixture-root')<>1 THEN RAISE EXCEPTION 'incident replay duplicates'; END IF;
 IF attempts<>(SELECT count(*) FROM control.executions WHERE task_id='CP-SH-FIXTURE-001') THEN RAISE EXCEPTION 'incident spends product attempt'; END IF;
 UPDATE control.tasks SET engine_stage='dot_fixture_recovery' WHERE task_id='CP-SH-FIXTURE-001';
 SELECT count(*) INTO events FROM control.dot_wake_events;
 IF events<1 THEN RAISE EXCEPTION 'state transition lost wake'; END IF;
 UPDATE control.tasks SET updated_at=now() WHERE task_id='CP-SH-FIXTURE-001';
 IF events<>(SELECT count(*) FROM control.dot_wake_events) THEN RAISE EXCEPTION 'heartbeat creates wake loop'; END IF;
 INSERT INTO control.dot_cycles(outcomes) VALUES('[{"fixture":"healthy","model_calls":0}]');
 IF EXISTS(SELECT 1 FROM control.dot_cycles WHERE codex_invoked_by_scan) THEN RAISE EXCEPTION 'healthy scan invokes Codex'; END IF;
END $$;
