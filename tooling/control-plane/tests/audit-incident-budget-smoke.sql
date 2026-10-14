\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE r uuid:=gen_random_uuid(); incident uuid; token uuid:=gen_random_uuid(); result jsonb; n integer;
BEGIN
 INSERT INTO control.workflow_runs(run_id,suit_slug,max_tasks,status) VALUES(r,'ledger-suit',1,'running');
 INSERT INTO control.dot_incidents(run_id,task_id,root_fingerprint,classification,evidence)
 VALUES(r,NULL,repeat('a',64),'UNKNOWN','{}') RETURNING incident_id INTO incident;
 INSERT INTO control.dot_recovery_jobs(incident_id,run_id,task_id,root_family,owner,action,status,claim_token,claim_until,evidence)
 VALUES(incident,r,NULL,'unknown-lifecycle','Codex','incident-investigate','running',token,now()+interval '3 minutes','{}');
 result:=control.reserve_dot_model_invocation(incident,token,'setup-failed',repeat('b',64));
 PERFORM control.finish_dot_model_invocation(incident,token,'setup-failed',repeat('b',64));
 IF EXISTS(SELECT 1 FROM control.dot_model_invocations WHERE incident_id=incident AND launched_at IS NOT NULL) THEN RAISE EXCEPTION 'Setup counted as a model launch'; END IF;
 FOR n IN 1..3 LOOP
  result:=control.reserve_dot_model_invocation(incident,token,'model-'||n,repeat('b',64));
  IF result->>'allowed'<>'true' THEN RAISE EXCEPTION 'Approved automatic invocation rejected %',n;END IF;
  PERFORM control.record_dot_model_launch(incident,token,'model-'||n,now());
  PERFORM control.finish_dot_model_invocation(incident,token,'model-'||n,repeat('c',64));
 END LOOP;
 result:=control.reserve_dot_model_invocation(incident,token,'model-4',repeat('b',64));
 IF result->>'allowed'<>'false' THEN RAISE EXCEPTION 'Fourth automatic invocation accepted'; END IF;
 IF (SELECT count(*) FROM control.dot_model_invocations WHERE incident_id=incident AND launched_at IS NOT NULL)<>3 THEN RAISE EXCEPTION 'Invocation count changed';END IF;
 IF (SELECT status FROM control.dot_recovery_jobs WHERE incident_id=incident)<>'human-gate' THEN RAISE EXCEPTION 'Budget did not establish one persistent gate'; END IF;
 UPDATE control.workflow_runs SET status='cancelled',finished_at=now() WHERE run_id=r;
 IF control.reconcile_dot_recovery_completion()<>1 THEN RAISE EXCEPTION 'Obsolete human gate did not settle'; END IF;
 IF NOT EXISTS(SELECT 1 FROM control.dot_job_lifecycle_events WHERE incident_id=incident AND from_status='human-gate' AND to_status='resolved') THEN RAISE EXCEPTION 'Settlement history lost';END IF;
END $$;
ROLLBACK;
