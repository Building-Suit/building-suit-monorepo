\set ON_ERROR_STOP on
UPDATE control.workstreams SET publication_config='{"merge_authorized":false,"deployment_authorized":false,"hosted_database_changes_authorized":false}' WHERE slug='cp-selfheal-fixture';
-- Only the disposable database created by batch-readiness-postgres.test.mjs.
INSERT INTO control.tasks(task_id,suit_slug,sequence,title,status,acceptance_criteria,verification_plan,metadata,project_id,workstream_slug,retry_policy_id)
SELECT id,'cp-selfheal-fixture',ordinal,id,'planned','["fixture"]','["git diff --check"]','{}',project_id,'cp-selfheal-fixture','standard-five'
FROM (VALUES('CP-BOUND-PUBLISH-001',1),('CP-BOUND-PUBLISH-002',2)) v(id,ordinal)
CROSS JOIN control.projects WHERE slug='building-suit';
SELECT control.refresh_publication_readiness_contract(task_id,'bounded-fixture') FROM control.tasks WHERE task_id LIKE 'CP-BOUND-PUBLISH-%';
INSERT INTO control.workflow_runs(run_id,suit_slug,project_id,workstream_slug,max_tasks,status,admitted_repair_id,controller_protocol,controller_fingerprint)
SELECT '22222222-2222-4333-8444-555555555555','cp-selfheal-fixture',project_id,'cp-selfheal-fixture',2,'running','CP-BATCH-READY-001','cp-batch-v2','fixture-controller' FROM control.projects WHERE slug='building-suit';
INSERT INTO control.batch_task_admissions(repair_id,run_id,task_id,ordinal,input_generation,contract_fingerprint,verification_fingerprint,status)
SELECT 'CP-BATCH-READY-001','22222222-2222-4333-8444-555555555555',t.task_id,t.sequence,c.input_generation,c.contract_fingerprint,control.verification_contract_fingerprint(t.task_id),'admitted'
FROM control.tasks t JOIN control.publication_readiness_contracts c USING(task_id) WHERE t.task_id LIKE 'CP-BOUND-PUBLISH-%';
INSERT INTO control.run_ordinary_publication_authorizations(run_id,project_id,workstream_slug,max_tasks,repair_id,controller_fingerprint,audit_evidence)
SELECT run_id,project_id,workstream_slug,max_tasks,admitted_repair_id,controller_fingerprint,'disposable test authorization' FROM control.workflow_runs WHERE run_id='22222222-2222-4333-8444-555555555555';
INSERT INTO control.run_task_publication_authorities SELECT run_id,task_id,input_generation,contract_fingerprint,verification_fingerprint FROM control.batch_task_admissions WHERE run_id='22222222-2222-4333-8444-555555555555';
DO $$
DECLARE run uuid:='22222222-2222-4333-8444-555555555555'; acquired jsonb; ex bigint; vr bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(control.runtime_recovery_candidates()) x WHERE x->>'run_id'=run::text) THEN RAISE EXCEPTION 'watchdog stranded empty run'; END IF;
 acquired:=control.acquire_workflow_run_task(run,'cp-batch-v2','fixture-controller','fixture-owner','runner');
 IF acquired->>'task_id'<>'CP-BOUND-PUBLISH-001' OR acquired->>'action'<>'execute' THEN RAISE EXCEPTION 'first acquisition failed: %',acquired; END IF;
 IF NOT (control.current_run_publication_authority('CP-BOUND-PUBLISH-001')->>'authorized')::boolean THEN RAISE EXCEPTION 'ordinary authority denied'; END IF;
 IF (control.current_run_publication_authority('CP-BOUND-PUBLISH-002')->>'authorized')::boolean THEN RAISE EXCEPTION 'unclaimed task authorized'; END IF;
 ex:=control.start_execution('CP-BOUND-PUBLISH-001','standard','fixture-model','medium','/tmp/fixture','codex/cp-selfheal-fixture/one','stg',repeat('a',40));
 PERFORM control.finish_execution(ex,'succeeded',repeat('b',40),1,1,'fixture.log','{"fixture":true}');
 vr:=control.start_verification_run('CP-BOUND-PUBLISH-001',ex,'runner','{"fixture":true}');
 PERFORM control.update_verification_check(vr,'fixture-required','pass',0,'LOCAL FIXTURE',NULL,1,'fixture',true,'{}');
 PERFORM control.finish_verification_run('CP-BOUND-PUBLISH-001',vr);
 PERFORM control.record_recovery_condition(p_resume_identity=>'task:CP-BOUND-PUBLISH-001',p_idempotency_key=>'bounded-old-hold',p_failure_class=>'operator-wait',p_error_code=>'publication_operator_hold',p_next_action=>'wait-operator',p_recoverable=>true,p_source=>'fixture',p_current_task_id=>'CP-BOUND-PUBLISH-001');
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(control.runtime_recovery_candidates()) x WHERE x->>'run_id'=run::text) THEN RAISE EXCEPTION 'authorized PASS held by stale operator wait'; END IF;
 -- New session/controller resumes the same claim; no implementation attempt reserved.
 UPDATE control.workflow_runs SET controller_lease_expires_at=now()-interval '1 second' WHERE run_id=run;
 acquired:=control.acquire_workflow_run_task(run,'cp-batch-v2','fixture-controller','restarted-controller','runner');
 IF acquired->>'action'<>'resume' THEN RAISE EXCEPTION 'restart after PASS did not resume'; END IF;
 PERFORM control.complete_publication('CP-BOUND-PUBLISH-001','fixture/bounded',930001,'codex/cp-selfheal-fixture/one','stg','https://example.invalid/930001',repeat('b',40),true,'{"verification_run_id":1,"fixture":true}');
 -- Crash after DB completion: a new controller credits, instead of publishing again.
 UPDATE control.workflow_runs SET controller_lease_expires_at=now()-interval '1 second' WHERE run_id=run;
 acquired:=control.acquire_workflow_run_task(run,'cp-batch-v2','fixture-controller','after-publication-crash','runner');
 IF acquired->>'action'<>'credit_completion' THEN RAISE EXCEPTION 'publication replay duplicated instead of credit'; END IF;
 PERFORM control.record_workflow_task_success(run,'CP-BOUND-PUBLISH-001','bounded-credit');
 PERFORM control.record_workflow_task_success(run,'CP-BOUND-PUBLISH-001','bounded-credit');
 PERFORM control.record_workflow_task_success(run,'CP-BOUND-PUBLISH-001','different-key-same-task');
 IF (SELECT completed_tasks FROM control.workflow_runs WHERE run_id=run)<>1 OR (SELECT count(*) FROM control.workflow_run_task_credits WHERE run_id=run)<>1 THEN RAISE EXCEPTION 'duplicate credit'; END IF;
 IF (SELECT count(*) FROM control.executions WHERE task_id='CP-BOUND-PUBLISH-001')<>1 OR (SELECT count(*) FROM control.pull_requests WHERE task_id='CP-BOUND-PUBLISH-001')<>1 THEN RAISE EXCEPTION 'duplicate attempt/publication'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(control.runtime_recovery_candidates()) x WHERE x->>'run_id'=run::text) THEN RAISE EXCEPTION 'crash after credit stranded run'; END IF;
 acquired:=control.acquire_workflow_run_task(run,'cp-batch-v2','fixture-controller','after-credit-crash','runner');
 IF acquired->>'task_id'<>'CP-BOUND-PUBLISH-002' OR acquired->>'action'<>'execute' THEN RAISE EXCEPTION 'next task not acquired: %',acquired; END IF;
 UPDATE control.tasks SET metadata=metadata||'{"scope_drift":true}'::jsonb WHERE task_id='CP-BOUND-PUBLISH-002';
 IF (control.current_run_publication_authority('CP-BOUND-PUBLISH-002')->>'authorized')::boolean THEN RAISE EXCEPTION 'scope drift accepted'; END IF;
 UPDATE control.run_ordinary_publication_authorizations SET revoked_at=now() WHERE run_id=run;
 IF (control.current_run_publication_authority('CP-BOUND-PUBLISH-002')->>'authorized')::boolean THEN RAISE EXCEPTION 'revocation accepted'; END IF;
END $$;
SELECT 'BOUNDED_PUBLICATION_LIFECYCLE_PASS';
