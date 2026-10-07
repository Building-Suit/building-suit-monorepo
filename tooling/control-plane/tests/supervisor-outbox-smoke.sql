-- Disposable control database only. All fixtures roll back.
BEGIN;
INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,title,status,acceptance_criteria,verification_plan,retry_policy_id)
SELECT task,CASE WHEN task='CP-LIFECYCLE-A' THEN 'ledger-suit' ELSE 'shop-suit' END,project_id,CASE WHEN task='CP-LIFECYCLE-A' THEN 'ledger-suit' ELSE 'shop-suit' END,'Synthetic lifecycle invariant',CASE WHEN task='CP-LIFECYCLE-A' THEN 'failed' ELSE 'planned' END,'["Synthetic"]','["git diff --check"]','standard-five' FROM control.projects CROSS JOIN unnest(ARRAY['CP-LIFECYCLE-A','CP-LIFECYCLE-B'])task WHERE slug='building-suit';
INSERT INTO control.executions(task_id,attempt,model_profile,status,started_at,finished_at) VALUES('CP-LIFECYCLE-A',1,'standard','succeeded',now(),now());
INSERT INTO control.workflow_runs(run_id,suit_slug,project_id,workstream_slug,current_task_id,max_tasks,controller_fingerprint)
SELECT 'a0000000-0000-4000-8000-000000000097','ledger-suit',project_id,'ledger-suit','CP-LIFECYCLE-A',2,'synthetic-controller' FROM control.projects WHERE slug='building-suit';
INSERT INTO control.workflow_runs(run_id,suit_slug,project_id,workstream_slug,current_task_id,max_tasks,controller_fingerprint)
SELECT 'a0000000-0000-4000-8000-000000000098','shop-suit',project_id,'shop-suit','CP-LIFECYCLE-B',2,'synthetic-controller' FROM control.projects WHERE slug='building-suit';
INSERT INTO control.task_dependencies(task_id,depends_on_task_id,dependency_type) VALUES('CP-LIFECYCLE-B','CP-LIFECYCLE-A','hard');
SELECT control.authorize_ordinary_bounded_run('a0000000-0000-4000-8000-000000000098','["CP-LIFECYCLE-B"]','Explicit disposable dependency fixture');
UPDATE control.workflow_runs SET current_task_id=NULL WHERE run_id='a0000000-0000-4000-8000-000000000098';
UPDATE control.supervisor_wakes SET pending=false WHERE run_id='a0000000-0000-4000-8000-000000000098';
DO $$ DECLARE result jsonb; ex bigint; claim jsonb; version bigint; event bigint;BEGIN
 SELECT execution_id INTO ex FROM control.executions WHERE task_id='CP-LIFECYCLE-A';
 PERFORM control.record_lifecycle_failure('CP-LIFECYCLE-A',ex,repeat('b',64),'VERIFIER_INFRA','{"source_fingerprint":"old"}');
 result:=control.claim_recovery_action('CP-LIFECYCLE-A',ex,'task-verify',repeat('b',64),'VERIFIER_INFRA','{"source_fingerprint":"old"}');
 IF result->>'claimed'<>'false' THEN RAISE EXCEPTION 'Unrepaired verification reopened';END IF;
 FOR n IN 1..100 LOOP result:=control.claim_recovery_action('CP-LIFECYCLE-A',ex,'task-verify',repeat('a',64),'VERIFIER_INFRA','{"source":"unchanged"}');IF n>1 AND result->>'claimed'<>'false' THEN RAISE EXCEPTION 'Repeated unchanged recovery';END IF;END LOOP;
 IF (SELECT count(*) FROM control.recovery_action_claims WHERE task_id='CP-LIFECYCLE-A')<>1 THEN RAISE EXCEPTION 'Recovery duplicate';END IF;
 IF (SELECT count(*) FROM control.executions WHERE task_id='CP-LIFECYCLE-A')<>1 THEN RAISE EXCEPTION 'Nonproduct budget consumed';END IF;
 INSERT INTO control.dot_incidents(incident_id,run_id,task_id,root_fingerprint,classification,status,evidence) VALUES('b0000000-0000-4000-8000-000000000097','a0000000-0000-4000-8000-000000000097','CP-LIFECYCLE-A','synthetic-stale','UNKNOWN','operator-gate','{}');
 INSERT INTO control.dot_recovery_jobs(incident_id,run_id,task_id,root_family,owner,action,status,evidence) VALUES('b0000000-0000-4000-8000-000000000097','a0000000-0000-4000-8000-000000000097','CP-LIFECYCLE-A','unknown-lifecycle','Codex','incident-investigate','human-gate','{}');
 -- Lost webhook: no notification listener exists. Durable claim remains ready.
 claim:=control.claim_supervisor_wake();IF claim IS NULL THEN RAISE EXCEPTION 'Lost wake';END IF;
 IF control.claim_supervisor_wake() IS NOT NULL THEN RAISE EXCEPTION 'Duplicate owner';END IF;
 -- New state racing a claim cannot be acknowledged by the old version.
 PERFORM control.enqueue_supervisor_wake((claim->>'run_id')::uuid);
 PERFORM control.finish_supervisor_wake((claim->>'run_id')::uuid,(claim->>'claim_token')::uuid,(claim->>'version')::bigint,NULL);
 IF NOT EXISTS(SELECT 1 FROM control.supervisor_wakes WHERE run_id=(claim->>'run_id')::uuid AND pending) THEN RAISE EXCEPTION 'Racing state lost';END IF;
 SELECT event_id,supervisor_wakes.version INTO event,version FROM control.supervisor_wakes WHERE run_id='a0000000-0000-4000-8000-000000000097';
 FOR n IN 1..100 LOOP PERFORM control.enqueue_supervisor_wake('a0000000-0000-4000-8000-000000000097',event);END LOOP;
 IF (SELECT supervisor_wakes.version FROM control.supervisor_wakes WHERE run_id='a0000000-0000-4000-8000-000000000097')<>version THEN RAISE EXCEPTION 'Duplicate wake effect';END IF;
 UPDATE control.supervisor_wakes SET pending=false;
 UPDATE control.tasks SET status='complete' WHERE task_id='CP-LIFECYCLE-A';
 PERFORM control.reconcile_lifecycle_incidents('a0000000-0000-4000-8000-000000000097');
 IF (SELECT status FROM control.dot_recovery_jobs WHERE incident_id='b0000000-0000-4000-8000-000000000097')<>'resolved' THEN RAISE EXCEPTION 'Stale passed-subject incident retained';END IF;
 IF NOT EXISTS(SELECT 1 FROM control.supervisor_wakes WHERE run_id='a0000000-0000-4000-8000-000000000098' AND pending) THEN RAISE EXCEPTION 'Dependency completion wake lost';END IF;
 -- Derived observations cannot enqueue work, including across 100 polls.
 UPDATE control.supervisor_wakes SET pending=false;
 FOR n IN 1..100 LOOP INSERT INTO control.dot_wake_events(origin,payload,wake_kind) VALUES('retry-audit','{"task_id":"CP-LIFECYCLE-A","event_type":"retry_exhaustion_audited"}','derived');END LOOP;
 IF EXISTS(SELECT 1 FROM control.supervisor_wakes WHERE pending) THEN RAISE EXCEPTION 'Derived feedback loop';END IF;
END $$;
ROLLBACK;
