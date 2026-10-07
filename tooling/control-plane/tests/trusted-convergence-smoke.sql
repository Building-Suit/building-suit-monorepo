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
INSERT INTO control.dot_incidents(incident_id,run_id,task_id,execution_id,root_fingerprint,classification,status,evidence) SELECT 'b0000000-0000-4000-8000-000000000099','a0000000-0000-4000-8000-000000000097','CP-LIFECYCLE-A',execution_id,'legacy-stale','CONFIGURATION','operator-gate','{}' FROM control.executions WHERE task_id='CP-LIFECYCLE-A';
INSERT INTO control.dot_recovery_jobs(incident_id,run_id,task_id,root_family,owner,action,status,evidence) VALUES('b0000000-0000-4000-8000-000000000099','a0000000-0000-4000-8000-000000000097','CP-LIFECYCLE-A','unknown-lifecycle','Codex','incident-investigate','human-gate','{}');
UPDATE control.supervisor_wakes SET pending=false;
DO $$ DECLARE ex bigint; ver bigint; version bigint; before_version bigint; result jsonb;BEGIN
 SELECT execution_id INTO ex FROM control.executions WHERE task_id='CP-LIFECYCLE-A';
 SELECT verification_run_id INTO ver FROM control.verification_runs WHERE execution_id=ex;
 PERFORM control.record_recovery_condition('task:CP-LIFECYCLE-A','legacy-unknown','unknown-outcome','unknown_failure_outcome','wait-external',true,'test',p_workflow_run_id=>'a0000000-0000-4000-8000-000000000097',p_current_task_id=>'CP-LIFECYCLE-A',p_execution_id=>ex);
 PERFORM control.record_lifecycle_failure('CP-LIFECYCLE-A',ex,repeat('a',64),'UNKNOWN',jsonb_build_object('protocol',2,'source_fingerprint','old'));
 SET LOCAL ROLE bs_control_migration_owner;
 UPDATE control.verification_results SET trusted_receipt='{}',trusted_registration='{}' WHERE execution_id=ex;
 INSERT INTO control.verification_failure_reviews SELECT verification_id,md5(jsonb_build_array(execution_id,verification_run_id,check_name,command,exit_code,status,log_path)::text),jsonb_build_object('classification','VERIFIER_INFRA','review',jsonb_build_object('root_cause','stale disposable migration state')),now() FROM control.verification_results WHERE execution_id=ex;
 RESET ROLE;
 SELECT supervisor_wakes.version INTO before_version FROM control.supervisor_wakes WHERE run_id='a0000000-0000-4000-8000-000000000097';
 PERFORM control.record_lifecycle_failure('CP-LIFECYCLE-A',ex,repeat('b',64),'VERIFIER_INFRA',jsonb_build_object('protocol',2,'release_id',repeat('e',64),'source_fingerprint','old'));
 IF NOT EXISTS(SELECT 1 FROM control.recovery_state_events WHERE recorded_state->>'status'='resolved' AND idempotency_key LIKE 'trusted-convergence:%:superseded:%') THEN RAISE EXCEPTION 'Old recovery history missing';END IF;
 IF NOT EXISTS(SELECT 1 FROM control.recovery_states WHERE current_task_id='CP-LIFECYCLE-A' AND failure_class='verification-infrastructure' AND next_action='reverify' AND status='active') THEN RAISE EXCEPTION 'Recovery classification did not converge';END IF;
 IF (SELECT status FROM control.dot_incidents WHERE incident_id='b0000000-0000-4000-8000-000000000099')<>'superseded' THEN RAISE EXCEPTION 'Old incident retained';END IF;
 SELECT supervisor_wakes.version INTO version FROM control.supervisor_wakes WHERE run_id='a0000000-0000-4000-8000-000000000097';
 IF version<>before_version+1 THEN RAISE EXCEPTION 'Exactly one convergence wake required';END IF;
 FOR n IN 1..100 LOOP PERFORM control.record_lifecycle_failure('CP-LIFECYCLE-A',ex,repeat('b',64),'VERIFIER_INFRA',jsonb_build_object('protocol',2,'release_id',repeat('e',64),'source_fingerprint','old'));END LOOP;
 IF (SELECT supervisor_wakes.version FROM control.supervisor_wakes WHERE run_id='a0000000-0000-4000-8000-000000000097')<>version THEN RAISE EXCEPTION 'Convergence wake repeated';END IF;
 PERFORM control.record_recovery_condition('task:CP-LIFECYCLE-A','late-legacy-operation','unknown-outcome','task_action_failed','wait-external',true,'test',p_workflow_run_id=>'a0000000-0000-4000-8000-000000000097',p_current_task_id=>'CP-LIFECYCLE-A',p_execution_id=>ex);
 PERFORM control.record_lifecycle_failure('CP-LIFECYCLE-A',ex,repeat('b',64),'VERIFIER_INFRA',jsonb_build_object('protocol',2,'release_id',repeat('e',64),'source_fingerprint','old'));
 IF NOT EXISTS(SELECT 1 FROM control.recovery_states WHERE current_task_id='CP-LIFECYCLE-A' AND failure_class='verification-infrastructure' AND next_action='reverify' AND status='active') THEN RAISE EXCEPTION 'Late legacy operation poisoned recovery';END IF;
 IF (SELECT supervisor_wakes.version FROM control.supervisor_wakes WHERE run_id='a0000000-0000-4000-8000-000000000097')<>version THEN RAISE EXCEPTION 'Reassertion repeated convergence wake';END IF;
 before_version:=version;
 result:=control.adopt_lifecycle_recovery('a0000000-0000-4000-8000-000000000097',2,repeat('d',64));
 IF result->>'adopted'<>'true' THEN RAISE EXCEPTION 'Release adoption missing';END IF;
 SELECT supervisor_wakes.version INTO version FROM control.supervisor_wakes WHERE run_id='a0000000-0000-4000-8000-000000000097';
 IF version<>before_version+1 THEN RAISE EXCEPTION 'Adoption and convergence duplicated wake';END IF;
 IF NOT EXISTS(SELECT 1 FROM control.recovery_states WHERE current_task_id='CP-LIFECYCLE-A' AND failure_class='verification-infrastructure' AND next_action='reverify' AND status='active') THEN RAISE EXCEPTION 'Adoption discarded converged recovery';END IF;
 result:=control.claim_recovery_action('CP-LIFECYCLE-A',ex,'task-verify',repeat('c',64),'VERIFIER_INFRA',jsonb_build_object('source_fingerprint','repaired','verification_run_id',ver));
 IF result->>'claimed'<>'true' THEN RAISE EXCEPTION 'Repaired verifier blocked';END IF;
 FOR n IN 1..100 LOOP result:=control.claim_recovery_action('CP-LIFECYCLE-A',ex,'task-verify',repeat('c',64),'VERIFIER_INFRA',jsonb_build_object('source_fingerprint','repaired','verification_run_id',ver));IF result->>'claimed'<>'false' THEN RAISE EXCEPTION 'Reverification repeated';END IF;END LOOP;
 IF (SELECT count(*) FROM control.executions WHERE task_id='CP-LIFECYCLE-A')<>1 OR (control.product_retry_accounting('CP-LIFECYCLE-A')->>'consumed')::integer<>0 THEN RAISE EXCEPTION 'Product attempt charged';END IF;
END $$;
ROLLBACK;
