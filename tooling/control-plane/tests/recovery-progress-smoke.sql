\set ON_ERROR_STOP on
BEGIN;
DO $$ DECLARE prj uuid; shop uuid:=gen_random_uuid(); sas uuid:=gen_random_uuid(); shared uuid:=gen_random_uuid(); ex bigint; sx bigint; vr bigint; oldvr bigint; svr bigint; checkid bigint; fp text; version bigint; incident uuid; token uuid:=gen_random_uuid(); outcome jsonb; operation jsonb; baseline jsonb;BEGIN
 SELECT project_id INTO prj FROM control.projects WHERE slug='building-suit';
 INSERT INTO control.suits(slug,display_name,stack_key) VALUES('super-admin-suit','Super Admin regression','super-admin-suit'),('shared','Shared regression','shared') ON CONFLICT DO NOTHING;
 INSERT INTO control.workstreams(project_id,slug,suit_slug,display_name,stack_key,application_path) VALUES(prj,'super-admin-suit','super-admin-suit','Super Admin regression','super-admin-suit','apps/super-admin-suit'),(prj,'shared','shared','Shared regression','shared','packages') ON CONFLICT DO NOTHING;
 INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,title,status,acceptance_criteria,verification_plan,retry_policy_id)
 SELECT task,suit,prj,suit,'Real incident regression','failed','["required checks"]','["git diff --check"]','standard-five' FROM (VALUES('CP-PROGRESS-SHOP','shop-suit'),('CP-PROGRESS-SAS','super-admin-suit'),('CP-PROGRESS-SHARED','shared')) x(task,suit);
 INSERT INTO control.workflow_runs(run_id,suit_slug,project_id,workstream_slug,current_task_id,max_tasks,controller_fingerprint)
 SELECT run,suit,prj,suit,task,budget,'synthetic-controller' FROM (VALUES(shop,'shop-suit','CP-PROGRESS-SHOP',14),(sas,'super-admin-suit','CP-PROGRESS-SAS',7),(shared,'shared','CP-PROGRESS-SHARED',4)) x(run,suit,task,budget);
 INSERT INTO control.task_dependencies(task_id,depends_on_task_id,dependency_type) VALUES('CP-PROGRESS-SHARED','CP-PROGRESS-SHOP','hard');
 INSERT INTO control.executions(task_id,attempt,model_profile,status,started_at,finished_at) VALUES('CP-PROGRESS-SHOP',1,'standard','succeeded',now(),now()) RETURNING execution_id INTO ex;
 INSERT INTO control.executions(task_id,attempt,model_profile,status,started_at,finished_at) VALUES('CP-PROGRESS-SAS',1,'standard','succeeded',now(),now()) RETURNING execution_id INTO sx;
 INSERT INTO control.verification_runs(execution_id,status,source,finished_at) VALUES(ex,'failed','runner',now()) RETURNING verification_run_id INTO vr;
 INSERT INTO control.verification_runs(execution_id,status,source,finished_at) VALUES(sx,'failed','runner',now()-interval '1 minute') RETURNING verification_run_id INTO oldvr;
 INSERT INTO control.verification_runs(execution_id,status,source,finished_at) VALUES(sx,'failed','runner',now()) RETURNING verification_run_id INTO svr;
 INSERT INTO control.verification_results(execution_id,verification_run_id,check_name,command,status,exit_code,metadata)
 VALUES(ex,vr,'shop-sql-fixture','pnpm supabase test db','fail',1,'{"required":true}'),(sx,svr,'super-admin-database-reset','pnpm supabase db reset','fail',1,'{"required":true}'),(sx,svr,'super-admin-database-tests','pnpm supabase test db','not_run',NULL,'{"required":true,"selection_reason":"database_prerequisite_failed"}');
 SET LOCAL ROLE bs_control_migration_owner;
 UPDATE control.verification_results SET trusted_receipt=jsonb_build_object('version',2,'artifact',jsonb_build_object('sha256',repeat('a',64)),'source_fingerprint','same-source','command_version','same-command'),trusted_registration=jsonb_build_object('registry_version','same-registry','verifier_sha256','same-verifier') WHERE execution_id IN(ex,sx) AND status='fail';
 INSERT INTO control.verification_failure_reviews SELECT verification_id,md5(jsonb_build_array(execution_id,verification_run_id,check_name,command,exit_code,status,log_path)::text),jsonb_build_object('check_id',verification_id,'task_id',(SELECT task_id FROM control.executions WHERE execution_id=control.verification_results.execution_id),'execution_id',execution_id,'verification_run_id',verification_run_id,'registered_command',trusted_registration,'artifact',trusted_receipt->'artifact','source_fingerprint',trusted_receipt->>'source_fingerprint','classification',CASE WHEN execution_id=ex THEN 'VERIFIER_INFRA' ELSE 'PRODUCT_DEFECT' END,'version',2,'review',jsonb_build_object('root_cause','exact bound source','source','[{"path":"migration.sql","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]'::jsonb)),now() FROM control.verification_results WHERE execution_id IN(ex,sx) AND status='fail';
 RESET ROLE;
 PERFORM control.record_lifecycle_failure('CP-PROGRESS-SHOP',ex,repeat('a',64),'VERIFIER_INFRA',jsonb_build_object('protocol',2,'source_fingerprint','same-source','verification_run_id',vr));
 fp:=control.lifecycle_evidence_fingerprint(ex,vr);
 SELECT w.version INTO version FROM control.supervisor_wakes w WHERE run_id=shop;
 FOR n IN 1..100 LOOP
  SET LOCAL ROLE bs_control_migration_owner;
  UPDATE control.verification_failure_reviews SET evidence=jsonb_set(evidence,'{review,root_cause}',to_jsonb('same finding wording '||n)),reviewed_at=clock_timestamp() WHERE verification_id IN(SELECT verification_id FROM control.verification_results WHERE execution_id=ex);
  RESET ROLE;
  IF control.lifecycle_evidence_fingerprint(ex,vr) IS DISTINCT FROM fp THEN RAISE EXCEPTION 'Prose changed recovery identity';END IF;
  PERFORM control.record_lifecycle_failure('CP-PROGRESS-SHOP',ex,repeat('a',64),'VERIFIER_INFRA',jsonb_build_object('protocol',2,'source_fingerprint','same-source','verification_run_id',vr));
 END LOOP;
 IF (SELECT w.version FROM control.supervisor_wakes w WHERE run_id=shop)<>version THEN RAISE EXCEPTION 'Unchanged convergence wake loop';END IF;
 outcome:=control.claim_recovery_action('CP-PROGRESS-SHOP',ex,'task-verify',repeat('b',64),'VERIFIER_INFRA',jsonb_build_object('source_fingerprint','same-source','verification_run_id',vr));
 IF outcome->>'claimed'<>'false' THEN RAISE EXCEPTION 'Unchanged reverify granted: %',outcome;END IF;
 outcome:=control.claim_recovery_action('CP-PROGRESS-SHOP',ex,'task-verify',repeat('c',64),'VERIFIER_INFRA',jsonb_build_object('source_fingerprint','repaired-fixture','verification_run_id',vr));
 IF outcome->>'claimed'<>'true' THEN RAISE EXCEPTION 'Meaningful repair denied: %',outcome;END IF;
 FOR n IN 1..100 LOOP outcome:=control.claim_recovery_action('CP-PROGRESS-SHOP',ex,'task-verify',repeat('c',64),'VERIFIER_INFRA',jsonb_build_object('source_fingerprint','repaired-fixture','verification_run_id',vr));IF outcome->>'claimed'<>'false' THEN RAISE EXCEPTION 'Repair reverified twice';END IF;END LOOP;
 -- The actual SAS non-executed prerequisite child is NOT a legacy missing receipt.
 IF control.legacy_verification_materialization_needed(sx,svr) THEN RAISE EXCEPTION 'Blocked not_run materialization';END IF;
 PERFORM control.record_lifecycle_failure('CP-PROGRESS-SAS',sx,repeat('d',64),'PRODUCT_DEFECT',jsonb_build_object('protocol',2,'source_fingerprint','same-sas','verification_run_id',svr));
 IF control.current_lifecycle_failure('CP-PROGRESS-SAS')->>'classification'<>'PRODUCT_DEFECT' THEN RAISE EXCEPTION 'Blocked check erased parent product evidence';END IF;
 outcome:=control.claim_recovery_action('CP-PROGRESS-SAS',sx,'task-verify',repeat('e',64),'VERIFIER_INFRA',jsonb_build_object('source_fingerprint','changed-runtime','verification_run_id',svr));
 IF outcome->>'claimed'<>'false' THEN RAISE EXCEPTION 'Product evidence waived';END IF;
 operation:=control.claim_runtime_operation('CP-PROGRESS-SAS','task-verify',sx,jsonb_build_object('execution_id',sx),'regression','regression')->'operation';
 UPDATE control.runtime_operations SET lease_expires_at=now()-interval '1 minute' WHERE operation_id=(operation->>'operation_id')::uuid;
 PERFORM control.set_runtime_operation_outcome((operation->>'operation_id')::uuid,'pending',jsonb_build_object('verification_run_id',oldvr,'classification','UNKNOWN'));
 outcome:=control.reconcile_settled_verification_operation(sas);
 IF outcome->>'operations'<>'1' THEN RAISE EXCEPTION '347 operation not settled against 348: %',outcome;END IF;
 IF NOT EXISTS(SELECT 1 FROM control.runtime_operations WHERE operation_id=(operation->>'operation_id')::uuid AND status='consumed' AND result->>'verification_run_id'=svr::text AND result#>>'{previous_result,verification_run_id}'=oldvr::text) THEN RAISE EXCEPTION 'Latest operation reconciliation lost history';END IF;
 IF (control.reconcile_settled_verification_operation(sas)->>'operations')::integer<>0 THEN RAISE EXCEPTION 'Operation reconciled twice';END IF;
 IF NOT EXISTS(SELECT 1 FROM control.verification_runs WHERE verification_run_id=oldvr) THEN RAISE EXCEPTION '347 lost';END IF;
 -- Native dispatcher hands ownership to Supervisor, not a nested run-recover.
 incident:=control.record_dot_incident(shop,'CP-PROGRESS-SHOP',ex,repeat('f',64),'VERIFIER_INFRA','{}');
 INSERT INTO control.dot_recovery_jobs(incident_id,run_id,task_id,root_family,owner,action,status,claim_token,claim_until,evidence) VALUES(incident,shop,'CP-PROGRESS-SHOP','verification-infrastructure','Dot','supervisor-handoff','running',token,now()+interval '1 minute','{}');
 SELECT w.version INTO version FROM control.supervisor_wakes w WHERE run_id=shop;
 outcome:=control.handoff_dot_recovery(incident,token);
 IF outcome->>'handed_off'<>'true' OR outcome->>'wake_enqueued'<>'true' THEN RAISE EXCEPTION 'Handoff missing: %',outcome;END IF;
 FOR n IN 1..100 LOOP outcome:=control.handoff_dot_recovery(incident,token);IF outcome->>'wake_enqueued'<>'false' THEN RAISE EXCEPTION 'Duplicate handoff wake';END IF;END LOOP;
 IF (SELECT w.version FROM control.supervisor_wakes w WHERE run_id=shop)<>version+1 THEN RAISE EXCEPTION 'Exactly one durable wake required';END IF;
 PERFORM control.record_dot_health(jsonb_build_array(jsonb_build_object('key','run:'||shop,'run_id',shop,'task_id','CP-PROGRESS-SHOP','execution_id',ex,'verification_id',vr,'state','STUCK','why','current bound regression','worker_alive',false,'operator_action_required',false,'observed_at',now())));
 outcome:=control.claim_dot_recovery(shop,repeat('f',64),'verification-infrastructure','{}');
 IF outcome->>'reason'<>'awaiting_supported_repair' THEN RAISE EXCEPTION 'Identical resolved handoff loop: %',outcome;END IF;
 UPDATE control.workflow_runs SET stop_requested=true WHERE run_id=sas;
 outcome:=control.claim_dot_recovery(sas,repeat('f',64),'verification-infrastructure','{}');
 IF outcome->>'claimed'<>'false' THEN RAISE EXCEPTION 'Safety gate bypass';END IF;
 IF (control.product_retry_accounting('CP-PROGRESS-SHOP')->>'consumed')::integer<>0 OR (control.product_retry_accounting('CP-PROGRESS-SAS')->>'consumed')::integer<>1 THEN RAISE EXCEPTION 'Wrong effective product charge';END IF;
 IF (SELECT count(*) FROM control.executions WHERE task_id IN('CP-PROGRESS-SHOP','CP-PROGRESS-SAS'))<>2 OR (SELECT count(*) FROM control.workflow_runs WHERE run_id IN(shop,sas,shared))<>3 THEN RAISE EXCEPTION 'Run/execution replaced';END IF;
 IF EXISTS(SELECT 1 FROM control.workflow_runs WHERE run_id IN(shop,sas,shared) AND completed_tasks<>0) OR EXISTS(SELECT 1 FROM control.workflow_run_task_credits WHERE run_id IN(shop,sas,shared)) THEN RAISE EXCEPTION 'Completion fabricated';END IF;
 IF NOT EXISTS(SELECT 1 FROM control.task_dependencies WHERE task_id='CP-PROGRESS-SHARED' AND depends_on_task_id='CP-PROGRESS-SHOP' AND dependency_type='hard') OR (SELECT max_tasks FROM control.workflow_runs WHERE run_id=shop)<>14 OR (SELECT max_tasks FROM control.workflow_runs WHERE run_id=sas)<>7 OR (SELECT max_tasks FROM control.workflow_runs WHERE run_id=shared)<>4 THEN RAISE EXCEPTION 'Budget/dependency changed';END IF;
END $$;
ROLLBACK;
SELECT 'SHOP_SAS_RECOVERY_PROGRESS_HISTORY_BUDGET_DEPENDENCY_PASS';
