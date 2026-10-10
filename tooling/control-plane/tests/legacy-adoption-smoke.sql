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

INSERT INTO control.verification_runs(execution_id,status,source) SELECT execution_id,'failed','runner' FROM control.executions WHERE task_id='CP-LIFECYCLE-A';
INSERT INTO control.verification_results(execution_id,verification_run_id,check_name,command,status,exit_code,metadata) SELECT execution_id,verification_run_id,'legacy-failed-check','node check.mjs','fail',1,'{"required":true}' FROM control.verification_runs WHERE execution_id=(SELECT execution_id FROM control.executions WHERE task_id='CP-LIFECYCLE-A');
INSERT INTO control.dot_incidents(incident_id,run_id,task_id,execution_id,root_fingerprint,classification,status,evidence) SELECT 'b0000000-0000-4000-8000-000000000099','a0000000-0000-4000-8000-000000000097','CP-LIFECYCLE-A',execution_id,'legacy-stale','CONFIGURATION','operator-gate','{"health":{"incident_id":"b0000000-0000-4000-8000-000000000098"}}' FROM control.executions WHERE task_id='CP-LIFECYCLE-A';
INSERT INTO control.dot_recovery_jobs(incident_id,run_id,task_id,root_family,owner,action,status,evidence) VALUES('b0000000-0000-4000-8000-000000000099','a0000000-0000-4000-8000-000000000097','CP-LIFECYCLE-A','unknown-lifecycle','Codex','incident-investigate','human-gate','{}');
UPDATE control.supervisor_wakes SET pending=false;
DO $$ DECLARE result jsonb; ex bigint; verification bigint; version bigint; current_incident uuid;BEGIN
 SELECT execution_id INTO ex FROM control.executions WHERE task_id='CP-LIFECYCLE-A';
 SELECT verification_run_id INTO verification FROM control.verification_runs WHERE execution_id=ex;
 PERFORM control.record_lifecycle_failure('CP-LIFECYCLE-A',ex,repeat('b',64),'UNKNOWN',jsonb_build_object('source_fingerprint','same','protocol',1));
 current_incident:=control.record_dot_incident('a0000000-0000-4000-8000-000000000097','CP-LIFECYCLE-A',ex,repeat('e',64),'UNKNOWN','{}');
 result:=control.adopt_lifecycle_recovery('a0000000-0000-4000-8000-000000000097',2,repeat('f',64));
 IF (SELECT status FROM control.dot_incidents WHERE incident_id=current_incident)<>'superseded' THEN RAISE EXCEPTION 'Protocol-stamped legacy incident escaped first adoption';END IF;
 IF result->>'adopted'<>'true' OR result->>'materialize_evidence'<>'true' THEN RAISE EXCEPTION 'Legacy evidence not adopted: %',result;END IF;
 IF (SELECT status FROM control.dot_recovery_jobs WHERE incident_id='b0000000-0000-4000-8000-000000000099')<>'superseded' THEN RAISE EXCEPTION 'Stale incident retained';END IF;
 IF control.current_lifecycle_failure('CP-LIFECYCLE-A')->>'classification'<>'VERIFIER_INFRA' THEN RAISE EXCEPTION 'Missing receipt not verifier reconciliation';END IF;
 SELECT supervisor_wakes.version INTO version FROM control.supervisor_wakes WHERE run_id='a0000000-0000-4000-8000-000000000097';
 FOR n IN 1..100 LOOP PERFORM control.adopt_lifecycle_recovery('a0000000-0000-4000-8000-000000000097',2,repeat('f',64));END LOOP;
 IF (SELECT supervisor_wakes.version FROM control.supervisor_wakes WHERE run_id='a0000000-0000-4000-8000-000000000097')<>version THEN RAISE EXCEPTION 'Adoption wake repeated';END IF;
 result:=control.claim_recovery_action('CP-LIFECYCLE-A',ex,'task-verify',repeat('c',64),'VERIFIER_INFRA',jsonb_build_object('source_fingerprint','same','verification_run_id',verification));
 IF result->>'claimed'<>'true' THEN RAISE EXCEPTION 'One materialization blocked: %',result;END IF;
 FOR n IN 1..100 LOOP result:=control.claim_recovery_action('CP-LIFECYCLE-A',ex,'task-verify',repeat('c',64),'VERIFIER_INFRA',jsonb_build_object('source_fingerprint','same','verification_run_id',verification));IF result->>'claimed'<>'false' THEN RAISE EXCEPTION 'Legacy materialization repeated';END IF;END LOOP;
 result:=control.adopt_lifecycle_recovery('a0000000-0000-4000-8000-000000000097',2,repeat('a',64));
 IF result->>'adopted'<>'true' THEN RAISE EXCEPTION 'Changed runtime release not adopted';END IF;
 SELECT supervisor_wakes.version INTO version FROM control.supervisor_wakes WHERE run_id='a0000000-0000-4000-8000-000000000097';
 FOR n IN 1..100 LOOP PERFORM control.adopt_lifecycle_recovery('a0000000-0000-4000-8000-000000000097',2,repeat('a',64));END LOOP;
 IF (SELECT supervisor_wakes.version FROM control.supervisor_wakes WHERE run_id='a0000000-0000-4000-8000-000000000097')<>version THEN RAISE EXCEPTION 'Runtime release wake repeated';END IF;
 current_incident:=control.record_dot_incident('a0000000-0000-4000-8000-000000000097','CP-LIFECYCLE-A',ex,repeat('d',64),'VERIFIER_INFRA','{"dispatcher":{"runtime":"dot-general-v2"}}');
 IF current_incident<>control.record_dot_incident('a0000000-0000-4000-8000-000000000097','CP-LIFECYCLE-A',ex,repeat('d',64),'VERIFIER_INFRA','{}') THEN RAISE EXCEPTION 'Current context dedupe failed';END IF;
 PERFORM control.adopt_lifecycle_recovery('a0000000-0000-4000-8000-000000000097',2,repeat('a',64));
 IF (SELECT status FROM control.dot_incidents WHERE incident_id=current_incident)='superseded' THEN RAISE EXCEPTION 'Compatible current identity superseded';END IF;
 UPDATE control.dot_incidents SET evidence=jsonb_set(evidence,'{lifecycle,incident_id}','"another-identity"') WHERE incident_id=current_incident;
 PERFORM control.adopt_lifecycle_recovery('a0000000-0000-4000-8000-000000000097',2,repeat('a',64));
 IF (SELECT status FROM control.dot_incidents WHERE incident_id=current_incident)<>'superseded' THEN RAISE EXCEPTION 'Changed incident identity not superseded';END IF;
 IF (SELECT count(*) FROM control.executions WHERE task_id='CP-LIFECYCLE-A')<>1 THEN RAISE EXCEPTION 'Product attempt consumed';END IF;
 IF (SELECT count(*) FROM control.dot_incidents WHERE incident_id='b0000000-0000-4000-8000-000000000099')<>1 THEN RAISE EXCEPTION 'History lost';END IF;
END $$;
ROLLBACK;
