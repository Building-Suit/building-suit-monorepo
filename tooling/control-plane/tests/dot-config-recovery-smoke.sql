\set ON_ERROR_STOP on
DO $$ DECLARE ex bigint; vr bigint; new_vr bigint; history jsonb; rejected boolean; budget jsonb;
BEGIN
 SELECT execution_id INTO ex FROM control.executions WHERE task_id='CP-FIVE-INFRA-001' ORDER BY attempt DESC LIMIT 1;
 UPDATE control.executions SET status='succeeded',metadata='{}' WHERE execution_id=ex;
 UPDATE control.tasks SET verification_plan='["node tooling/checks/suit-template-boundaries.mjs --require-strict"]',status='failed' WHERE task_id='CP-FIVE-INFRA-001';
 INSERT INTO control.verification_runs(execution_id,status,source,metadata) VALUES(ex,'failed','runner','{"failure_class":"verification-product-defect"}') RETURNING verification_run_id INTO vr;
 INSERT INTO control.verification_results(execution_id,verification_run_id,check_name,status,metadata) VALUES(ex,vr,'verification-obligation-blocked-22','not_run','{"required":true,"selection_reason":"missing_strict_boundary_runner","failure_class":"verification-product-defect"}');
 SELECT to_jsonb(e) INTO history FROM control.executions e WHERE execution_id=ex;
 rejected:=false;BEGIN PERFORM control.start_retry_execution('CP-FIVE-INFRA-001',5,'standard','gpt-6.1-sol','medium');EXCEPTION WHEN OTHERS THEN rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'Non-product defect reserved retry';END IF;
 PERFORM control.reconcile_strict_verification_binding('CP-FIVE-INFRA-001',jsonb_build_object('execution_id',ex,'verification_run_id',vr,'runner_path','tooling/checks/suit-template-boundaries.mjs','command','node tooling/checks/suit-template-boundaries.mjs --require-strict','runner_sha256',repeat('a',64)));
 budget:=control.product_retry_accounting('CP-FIVE-INFRA-001');IF budget->>'consumed'<>'0' OR budget#>>'{classifications,-1,classification}'<>'CONFIGURATION' THEN RAISE EXCEPTION 'Binding failure charged as product: %',budget;END IF;
 IF history IS DISTINCT FROM (SELECT to_jsonb(e) FROM control.executions e WHERE execution_id=ex) THEN RAISE EXCEPTION 'History rewritten';END IF;
 PERFORM control.reopen_verification('CP-FIVE-INFRA-001','supervisor','automatic configuration binding reconciliation');
 new_vr:=control.start_verification_run('CP-FIVE-INFRA-001',ex,'runner','{"verification_mode":"focused"}');
 INSERT INTO control.verification_results(execution_id,verification_run_id,check_name,status,metadata) VALUES(ex,new_vr,'strict-suit-template-boundaries','pass','{"required":true}');
 PERFORM control.finish_verification_run('CP-FIVE-INFRA-001',new_vr);
 IF (SELECT count(*) FROM control.executions WHERE task_id='CP-FIVE-INFRA-001')<>3 OR (SELECT status FROM control.tasks WHERE task_id='CP-FIVE-INFRA-001')<>'passed' THEN RAISE EXCEPTION 'Same-attempt configuration recovery failed';END IF;
END $$;
UPDATE control.workflow_runs SET status='finished' WHERE suit_slug='cp-selfheal-fixture' AND status='running';
UPDATE control.tasks SET status='cancelled' WHERE workstream_slug='cp-selfheal-fixture' AND status IN('in_progress','verification','passed','failed');
INSERT INTO control.tasks(task_id,suit_slug,sequence,title,status,acceptance_criteria,verification_plan,metadata,project_id,workstream_slug,retry_policy_id)
SELECT id,'cp-selfheal-fixture',ordinal,id,'planned','["fixture"]','["git diff --check"]','{"allowed_paths":["tooling/control-plane/**"]}',project_id,'cp-selfheal-fixture','standard-five'
FROM (VALUES('CP-NATIVE-DRAFT-001',-10002),('CP-NATIVE-DRAFT-002',-10001)) v(id,ordinal) CROSS JOIN control.projects WHERE slug='building-suit';
SELECT control.refresh_publication_readiness_contract(task_id,'native-fixture') FROM control.tasks WHERE task_id LIKE 'CP-NATIVE-DRAFT-%';
INSERT INTO control.workflow_runs(run_id,suit_slug,project_id,workstream_slug,max_tasks,status,current_task_id,controller_protocol,controller_fingerprint)
SELECT '44444444-2222-4333-8444-555555555555','cp-selfheal-fixture',project_id,'cp-selfheal-fixture',2,'running','CP-NATIVE-DRAFT-001','cp-batch-v2','fixture-controller' FROM control.projects WHERE slug='building-suit';
UPDATE control.tasks SET status='in_progress' WHERE task_id='CP-NATIVE-DRAFT-001';
SELECT control.authorize_ordinary_bounded_run('44444444-2222-4333-8444-555555555555','["CP-NATIVE-DRAFT-001","CP-NATIVE-DRAFT-002"]','Explicit disposable native two-task ordinary draft grant');
SELECT control.reconcile_ordinary_run_publication('44444444-2222-4333-8444-555555555555');
DO $$ DECLARE run uuid:='44444444-2222-4333-8444-555555555555'; ex bigint; vr bigint; acquisition jsonb;
BEGIN
 IF NOT(control.current_run_publication_authority('CP-NATIVE-DRAFT-001')->>'authorized')::boolean THEN RAISE EXCEPTION 'Native run ordinary authority missing';END IF;
 IF (control.current_run_publication_authority('CP-NATIVE-DRAFT-002')->>'authorized')::boolean THEN RAISE EXCEPTION 'Unclaimed task publication allowed';END IF;
 IF has_function_privilege('bs_control_app','control.authorize_ordinary_bounded_run(uuid,jsonb,text)','EXECUTE') THEN RAISE EXCEPTION 'Worker can self-authorize';END IF;
 ex:=control.start_execution('CP-NATIVE-DRAFT-001','standard','fixture-model','medium','/tmp/fixture','codex/cp-selfheal-fixture/native','stg',repeat('a',40));
 PERFORM control.finish_execution(ex,'succeeded',repeat('b',40),1,1,'fixture.log','{}');
 vr:=control.start_verification_run('CP-NATIVE-DRAFT-001',ex,'runner','{}');
 INSERT INTO control.verification_results(execution_id,verification_run_id,check_name,status,metadata) VALUES(ex,vr,'ordinary','pass','{"required":true}');
 PERFORM control.finish_verification_run('CP-NATIVE-DRAFT-001',vr);
 PERFORM control.complete_publication('CP-NATIVE-DRAFT-001','fixture/native',940004,'codex/cp-selfheal-fixture/native','stg','https://example.invalid/940004',repeat('b',40),true,jsonb_build_object('verification_run_id',vr));
 PERFORM control.record_workflow_task_success(run,'CP-NATIVE-DRAFT-001','native-credit');
 PERFORM control.record_workflow_task_success(run,'CP-NATIVE-DRAFT-001','native-credit-replay');
 IF (SELECT completed_tasks FROM control.workflow_runs WHERE run_id=run)<>1 THEN RAISE EXCEPTION 'Native credit duplicated';END IF;
 acquisition:=control.acquire_workflow_run_task(run,'cp-batch-v2','fixture-controller','native-fixture-owner','runner');
 IF acquisition->>'task_id' IS DISTINCT FROM 'CP-NATIVE-DRAFT-002' THEN RAISE EXCEPTION 'Native next-task acquisition failed: %',acquisition;END IF;
 PERFORM control.reconcile_ordinary_run_publication(run);
 IF NOT(control.current_run_publication_authority('CP-NATIVE-DRAFT-002')->>'authorized')::boolean THEN RAISE EXCEPTION 'Native next-task grant not automatic: run %, contract %, authority %, scope %, reconciled %',(SELECT to_jsonb(r) FROM control.workflow_runs r WHERE run_id=run),(SELECT to_jsonb(c) FROM control.publication_readiness_contracts c WHERE task_id='CP-NATIVE-DRAFT-002'),(SELECT to_jsonb(a) FROM control.run_task_publication_authorities a WHERE run_id=run AND task_id='CP-NATIVE-DRAFT-002'),(SELECT to_jsonb(f) FROM control.dot_task_scope_authorities f WHERE run_id=run AND task_id='CP-NATIVE-DRAFT-002'),control.reconcile_ordinary_run_publication(run);END IF;
 UPDATE control.tasks SET metadata=metadata||'{"publication_exact_paths":["tooling/control-plane/.env"]}' WHERE task_id='CP-NATIVE-DRAFT-002';
 BEGIN PERFORM control.reconcile_ordinary_run_publication(run); RAISE EXCEPTION 'Protected file accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Protected file accepted' THEN RAISE;END IF;END;
 UPDATE control.tasks SET metadata=metadata||'{"allowed_paths":["apps/unrelated/**"]}' WHERE task_id='CP-NATIVE-DRAFT-002';
 IF (control.current_run_publication_authority('CP-NATIVE-DRAFT-002')->>'authorized')::boolean THEN RAISE EXCEPTION 'Scope drift allowed';END IF;
 UPDATE control.run_ordinary_publication_authorizations SET revoked_at=now() WHERE run_id=run;
 IF (control.current_run_publication_authority('CP-NATIVE-DRAFT-002')->>'authorized')::boolean THEN RAISE EXCEPTION 'Revoked grant allowed';END IF;
END $$;
SELECT 'DOT_CONFIGURATION_NATIVE_PUBLICATION_LIFECYCLE_PASS';
