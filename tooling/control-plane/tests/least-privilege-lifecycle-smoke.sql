\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE project uuid; run uuid; plans jsonb:='[]'; item jsonb; input jsonb; result jsonb; acquired jsonb; task text; n integer; ex bigint; vr bigint; cid bigint; registration jsonb; receipt jsonb; denied boolean;
BEGIN
 SELECT project_id INTO project FROM control.projects WHERE slug='building-suit';
 INSERT INTO control.suits(slug,display_name,stack_key) VALUES('cp-lifecycle-fixture','Synthetic lifecycle','automation-suit');
 INSERT INTO control.workstreams(project_id,slug,suit_slug,display_name,stack_key,application_path,publication_config)
 VALUES(project,'cp-lifecycle-fixture','cp-lifecycle-fixture','Synthetic lifecycle','automation-suit','apps/shop-suit','{"merge_authorized":false,"deployment_authorized":false,"hosted_database_changes_authorized":false,"review_required_before_integration":true}');
 FOR n IN 1..2 LOOP
 task:='CP-LIFECYCLE-00'||n;
 INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,sequence,title,status,acceptance_criteria,verification_plan,metadata,retry_policy_id)
 VALUES(task,'cp-lifecycle-fixture',project,'cp-lifecycle-fixture',n,'Synthetic lifecycle','planned','["Synthetic fixture"]','["git diff --check"]','{"allowed_paths":["apps/shop-suit/tests/synthetic/**"]}','standard-five');
 PERFORM control.refresh_publication_readiness_contract(task,'synthetic-fixture');
 input:=control.verification_plan_input_snapshot(task);
 item:=jsonb_build_object('version',1,'task_id',task,'inputs',input,'plan_fingerprint',repeat('a',64),'obligations',jsonb_build_array(jsonb_build_object('category','EXISTING_EXECUTABLE','checks',jsonb_build_array(jsonb_build_object('name','git-diff-check','program','git','args',jsonb_build_array('diff','--check'))))));
 plans:=plans||jsonb_build_array(item);
 END LOOP;
 SET LOCAL ROLE bs_control_verifier;
 result:=control.start_prevalidated_workflow_run('cp-lifecycle-fixture',2,plans,repeat('a',40),'synthetic-controller');
 RESET ROLE;
 run:=(result->>'run_id')::uuid;
 PERFORM control.authorize_ordinary_bounded_run(run,'["CP-LIFECYCLE-001","CP-LIFECYCLE-002"]','Explicit isolated synthetic lifecycle authority; no product operation');
 PERFORM control.reconcile_ordinary_run_publication(run);
 FOR n IN 1..2 LOOP
 task:='CP-LIFECYCLE-00'||n;
 SET LOCAL ROLE bs_control_app;
 acquired:=control.acquire_workflow_run_task(run,'cp-batch-v2','synthetic-controller','synthetic-lease-'||n,'runner');
 IF acquired->>'acquired'<>'true' OR acquired->>'task_id' IS DISTINCT FROM task THEN RAISE EXCEPTION 'Wrong acquisition: %',acquired;END IF;
 ex:=control.start_execution(task,'standard','gpt-6.1-sol','medium','/synthetic/worktree','codex/automation-suit/synthetic-'||n,'stg',repeat('a',40));
 PERFORM control.record_execution_setup(ex,control.resolved_retry_policy(task),'/synthetic/prompt');
 PERFORM control.finish_execution(ex,'succeeded',repeat('b',40),10,10,'/synthetic/implementation.log','{}');
 vr:=control.start_verification_run(task,ex,'runner','{"verification_mode":"focused"}');
 denied:=false;BEGIN PERFORM control.update_verification_check(vr,'git-diff-check','pass',0,'PASS','/synthetic/check.log',1,'git diff --check',true,'{}');EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Executor forged verifier result';END IF;
 RESET ROLE;
 SET LOCAL ROLE bs_control_verifier;
 PERFORM control.queue_verification_check(vr,'git-diff-check','git diff --check',true);
 cid:=control.update_verification_check(vr,'git-diff-check','pass',0,'PASS','/synthetic/check.log',1,'git diff --check',true,'{}');
 registration:=jsonb_build_object('version',1,'check_id',cid,'execution_id',ex,'verification_run_id',vr,'task_id',task,'run_id',run,'command_id','git-diff-check','command','git diff --check','command_version',repeat('d',64),'registry_version',repeat('e',64),'verifier_sha256',repeat('f',64),'obligation_ids','["synthetic-git-check"]'::jsonb);
 PERFORM control.register_trusted_verification_command(cid,registration);
 receipt:=jsonb_build_object('version',2,'registration',registration,'verifier_version','trusted-receipt-v2','evidence_generation',vr,'run_id',run,'task_id',task,'execution_id',ex,'verification_run_id',vr,'check_id',cid,'check_name','git-diff-check','command','git diff --check','command_version',repeat('d',64),'status','pass','exit_code',0,'artifact',jsonb_build_object('path','/synthetic/check.log','sha256',repeat('c',64)),'source_fingerprint',repeat('e',64),'started_at',now(),'finished_at',now());
 PERFORM control.capture_verifier_receipt(cid,receipt);
 PERFORM control.record_trusted_verification_state(vr,jsonb_build_object('fingerprint',repeat('a',64),'base_sha',repeat('a',40),'files','[]'::jsonb),'','');
 PERFORM control.finish_verification_run(task,vr);
 RESET ROLE;
 SET LOCAL ROLE bs_control_app;
 PERFORM control.record_publication_started(task,NULL,ex,vr);
 result:=control.complete_publication(task,'Synthetic/Disposable',9000+n,'codex/automation-suit/synthetic-'||n,'stg','https://example.invalid/synthetic/pr/'||n,repeat('b',40),true,'{}');
 IF result->>'published'<>'true' THEN RAISE EXCEPTION 'Ordinary publication failed: %',result;END IF;
 result:=control.record_workflow_task_success(run,task,run::text||':'||task);
 IF result->>'idempotent'<>'false' THEN RAISE EXCEPTION 'First credit not recorded';END IF;
 result:=control.record_workflow_task_success(run,task,run::text||':'||task);
 IF result->>'idempotent'<>'true' THEN RAISE EXCEPTION 'Credit replay duplicated';END IF;
 RESET ROLE;
 END LOOP;
 IF (SELECT count(*) FROM control.workflow_run_task_credits WHERE run_id=run)<>2 OR (SELECT completed_tasks FROM control.workflow_runs WHERE run_id=run)<>2 OR (SELECT status FROM control.workflow_runs WHERE run_id=run)<>'limit_reached' THEN RAISE EXCEPTION 'Exact bounded completion failed';END IF;
 SET LOCAL ROLE bs_control_app;
 denied:=false;BEGIN UPDATE control.executions SET attempt=99 WHERE execution_id=ex;EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Executor has direct execution mutation';END IF;
 denied:=false;BEGIN DELETE FROM control.task_events WHERE task_id=task;EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Executor can delete history';END IF;
 IF pg_has_role('bs_control_app','bs_control_migration_owner','MEMBER') THEN RAISE EXCEPTION 'Executor can inherit migration owner';END IF;
 RESET ROLE;
 SET LOCAL ROLE bs_control_observer;
 IF (SELECT completed_tasks FROM control.workflow_runs WHERE run_id=run)<>2 THEN RAISE EXCEPTION 'Observer cannot read state';END IF;
 denied:=false;BEGIN PERFORM control.record_dot_cycle('[]');EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Observer can mutate lifecycle';END IF;
 RESET ROLE;
END $$;
ROLLBACK;
