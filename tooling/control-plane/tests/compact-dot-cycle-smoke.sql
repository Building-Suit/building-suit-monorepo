\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE watermark bigint;late_id bigint;result jsonb;denied boolean:=false;
BEGIN
 INSERT INTO control.dot_wake_events(origin,payload) VALUES('egress-fixture','{"revision":1}') RETURNING event_id INTO watermark;
 INSERT INTO control.dot_wake_events(origin,payload) VALUES('egress-fixture','{"revision":2}') RETURNING event_id INTO late_id;
 SET LOCAL ROLE bs_runtime_executor;
 result:=control.record_dot_compact_cycle('[{"action":"compact_health_collection","generation":1}]',watermark);
 RESET ROLE;
 IF result->>'processed_watermark'<>watermark::text OR NOT EXISTS(SELECT 1 FROM control.dot_wake_events WHERE event_id=watermark AND consumed_at IS NOT NULL) OR NOT EXISTS(SELECT 1 FROM control.dot_wake_events WHERE event_id=late_id AND consumed_at IS NULL) THEN RAISE EXCEPTION 'Late event lost or scanned event not consumed';END IF;
 SET LOCAL ROLE bs_control_observer;
 BEGIN PERFORM control.record_dot_compact_cycle('[]',late_id);EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;
 RESET ROLE;
 IF NOT denied THEN RAISE EXCEPTION 'Observer acquired cycle write authority';END IF;
 IF position('00:03:00' in pg_get_viewdef('control.dot_health_current'::regclass))=0 THEN RAISE EXCEPTION 'Staleness window incompatible with compact fallback';END IF;
END $$;
ROLLBACK;
