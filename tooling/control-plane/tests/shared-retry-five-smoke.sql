\set ON_ERROR_STOP on
DO $$ DECLARE task text; b jsonb; before jsonb; r jsonb; ex bigint; rejected boolean;
BEGIN
 IF EXISTS(SELECT snapshot FROM five_historical_executions EXCEPT SELECT to_jsonb(e) FROM control.executions e WHERE task_id LIKE 'CP-FIVE-%') THEN RAISE EXCEPTION 'Historical routing/execution changed'; END IF;
 IF control.resolved_retry_policy('CP-FIVE-PRODUCT-001')->>'max_attempts'<>'5' THEN RAISE EXCEPTION 'Old policy not migrated'; END IF;
 IF control.resolved_retry_policy('CP-FIVE-PRODUCT-001')->'attempt_profiles'<>'["standard","standard","deep","deep","review"]'::jsonb THEN RAISE EXCEPTION 'Wrong slots'; END IF;
 b:=control.audit_product_attempts('CP-FIVE-INFRA-001');IF b->>'consumed'<>'0' THEN RAISE EXCEPTION 'Configuration spent product budget: %',b; END IF;
 b:=control.audit_product_attempts('CP-FIVE-PRODUCT-001');IF b->>'consumed'<>'3' OR b->>'all_product'<>'true' THEN RAISE EXCEPTION 'Product failures not counted: %',b; END IF;
 r:=control.start_retry_execution('CP-FIVE-PRODUCT-001',5,'deep','gpt-6.1-sol','high');IF r->>'allowed'<>'true' OR r->>'product_slot'<>'4' OR r->>'attempt'<>'4' THEN RAISE EXCEPTION 'Fourth slot failed: %',r; END IF;
 ex:=(r->>'execution_id')::bigint;
 UPDATE control.executions SET status='failed',metadata='{"verification_probe_failures":[{"name":"actual-assertion","status":"fail","failure_class":"verification-product-defect"}]}' WHERE execution_id=ex;
 UPDATE control.tasks SET status='failed' WHERE task_id='CP-FIVE-PRODUCT-001';
 b:=control.audit_product_attempts('CP-FIVE-PRODUCT-001');
 rejected:=false;BEGIN PERFORM control.start_retry_execution('CP-FIVE-PRODUCT-001',5,'deep','gpt-6.1-sol','high');EXCEPTION WHEN OTHERS THEN rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'Final slot allowed Sol downgrade'; END IF;
 r:=control.start_retry_execution('CP-FIVE-PRODUCT-001',5,'review','gpt-6-astra','high');IF r->>'product_slot'<>'5' THEN RAISE EXCEPTION 'Fifth slot failed'; END IF;
 IF (SELECT model_name FROM control.executions WHERE execution_id=(r->>'execution_id')::bigint)<>'gpt-6-astra' THEN RAISE EXCEPTION 'Final routing did not resolve Astra'; END IF;
 b:=control.audit_product_attempts('CP-FIVE-GATE-001');IF b->>'consumed'<>'5' OR b->>'all_product'<>'true' THEN RAISE EXCEPTION 'Genuine exhaustion not identified'; END IF;
 r:=control.start_retry_execution('CP-FIVE-GATE-001',5,'review','gpt-6-astra','high');IF r->>'allowed'<>'false' THEN RAISE EXCEPTION 'Sixth product slot allowed'; END IF;
 rejected:=false;BEGIN PERFORM control.start_retry_execution('CP-FIVE-GATE-001',6,'review','gpt-6-astra','high');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Budget expansion allowed'; END IF;
 rejected:=false;BEGIN PERFORM control.start_retry_execution('CP-FIVE-INFRA-001',5,'standard','gpt-6.1-sol','medium');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Infra reserved new product execution'; END IF;
 IF has_table_privilege('bs_control_app','control.product_attempt_classifications','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'Worker can fabricate accounting'; END IF;
 IF has_function_privilege('bs_control_app','control.start_retry_execution_physical_v1(text,integer,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Physical cap bypass still exposed'; END IF;
 IF EXISTS(SELECT snapshot FROM five_historical_executions EXCEPT SELECT to_jsonb(e) FROM control.executions e WHERE task_id LIKE 'CP-FIVE-%') THEN RAISE EXCEPTION 'Original attempts changed during recovery'; END IF;
END $$;
UPDATE control.workflow_runs SET status='finished' WHERE suit_slug='shared' AND status='running';
-- A restart-safe failed run retains identity, counters, scope, history and cap.
SELECT control.refresh_publication_readiness_contract('CP-FIVE-REVIEW-001','fixture');
INSERT INTO control.workflow_runs(run_id,suit_slug,project_id,workstream_slug,max_tasks,status,current_task_id,admitted_repair_id,controller_protocol,controller_fingerprint)
SELECT '33333333-2222-4333-8444-555555555555','shared',project_id,'shared',9,'failed','CP-FIVE-REVIEW-001','CP-BATCH-READY-001','cp-batch-v2','fixture-controller' FROM control.projects WHERE slug='building-suit';
INSERT INTO control.batch_task_admissions(repair_id,run_id,task_id,ordinal,input_generation,contract_fingerprint,verification_fingerprint,status)
SELECT 'CP-BATCH-READY-001','33333333-2222-4333-8444-555555555555',task_id,1,input_generation,contract_fingerprint,control.verification_contract_fingerprint(task_id),'claimed' FROM control.publication_readiness_contracts WHERE task_id='CP-FIVE-REVIEW-001';
INSERT INTO control.run_ordinary_publication_authorizations(run_id,project_id,workstream_slug,max_tasks,repair_id,controller_fingerprint,audit_evidence)
SELECT run_id,project_id,workstream_slug,max_tasks,admitted_repair_id,controller_fingerprint,'only disposable recovery fixture' FROM control.workflow_runs WHERE run_id='33333333-2222-4333-8444-555555555555';
INSERT INTO control.run_task_publication_authorities SELECT run_id,task_id,input_generation,contract_fingerprint,verification_fingerprint FROM control.batch_task_admissions WHERE run_id='33333333-2222-4333-8444-555555555555';
SELECT control.record_recovery_condition(p_resume_identity=>'task:CP-FIVE-REVIEW-001',p_idempotency_key=>'old-three-exhausted',p_current_task_id=>'CP-FIVE-REVIEW-001',p_failure_class=>'safety-stop',p_error_code=>'retry_budget_exhausted',p_next_action=>'safety-stop',p_recoverable=>false,p_source=>'fixture',p_status=>'resolved');
DO $$ DECLARE r jsonb; id uuid:='33333333-2222-4333-8444-555555555555'; before jsonb;
BEGIN
 SELECT jsonb_agg(to_jsonb(e) ORDER BY attempt) INTO before FROM control.executions e WHERE task_id='CP-FIVE-REVIEW-001';
 UPDATE control.workflow_runs SET maintenance_requested=true WHERE run_id=id;
 r:=control.reconcile_shared_retry_exhaustion(id);IF r->>'resumed'<>'false' THEN RAISE EXCEPTION 'Maintenance gate bypassed'; END IF;
 UPDATE control.workflow_runs SET maintenance_requested=false WHERE run_id=id;
 r:=control.reconcile_shared_retry_exhaustion(id);IF r->>'resumed'<>'true' THEN RAISE EXCEPTION 'Old three exhaustion not resumed: %',r; END IF;
 IF (SELECT status FROM control.workflow_runs WHERE run_id=id)<>'running' OR (SELECT max_tasks FROM control.workflow_runs WHERE run_id=id)<>9 OR (SELECT completed_tasks FROM control.workflow_runs WHERE run_id=id)<>0 THEN RAISE EXCEPTION 'Original run replaced or counts changed'; END IF;
 IF before IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(e) ORDER BY attempt) FROM control.executions e WHERE task_id='CP-FIVE-REVIEW-001') THEN RAISE EXCEPTION 'Same executions were replaced'; END IF;
 r:=control.reconcile_shared_retry_exhaustion(id);IF r->>'resumed'<>'false' THEN RAISE EXCEPTION 'Reconciliation not idempotent'; END IF;
END $$;
SELECT 'SHARED_RETRY_FIVE_POSTGRES_PASS';

DO $$ DECLARE e control.executions%ROWTYPE; approval bigint; p jsonb; q jsonb; rejected boolean; before jsonb; result jsonb;
BEGIN
 SELECT * INTO e FROM control.executions WHERE task_id='CP-FIVE-REVIEW-001' ORDER BY attempt DESC LIMIT 1;
 SELECT jsonb_agg(to_jsonb(x) ORDER BY attempt) INTO before FROM control.executions x WHERE task_id=e.task_id;
 INSERT INTO control.product_attempt_classifications(execution_id,classification,evidence_fingerprint,source,evidence)
 VALUES(e.execution_id,'VERIFIER_INFRA',control.retry_evidence_fingerprint(e.execution_id),'human','{"basis":"fixture exact selector review","verifier_paths":["apps/ledger-suit/tests/e2e/fixture.spec.ts"]}');
 IF control.audit_product_attempts(e.task_id)->>'consumed'<>'2' THEN RAISE EXCEPTION 'Reviewed verifier failure not reclaimed'; END IF;
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(e.task_id,'verifier_reacceptance_authorized','dot',jsonb_build_object('run_id','33333333-2222-4333-8444-555555555555','execution_id',e.execution_id,'attempt',3,'verifier_paths','["apps/ledger-suit/tests/e2e/fixture.spec.ts"]'::jsonb,'required_checks','["actual-assertion"]'::jsonb)) RETURNING event_id INTO approval;
 p:=jsonb_build_object('task_id',e.task_id,'ok',true,'passed',true,'verified_state',jsonb_build_object('base_sha',e.parent_sha,'fingerprint',repeat('c',64),'files','[{"file":"apps/ledger-suit/tests/e2e/fixture.spec.ts","object":"corrected-test"},{"file":"packages/ui/src/table.vue","object":"original-product"}]'::jsonb),'checks','[{"name":"actual-assertion","command":"fixture","status":"pass","required":true,"exit_code":0,"summary":"executed"}]'::jsonb);
 rejected:=false;BEGIN PERFORM control.reaccept_dot_verifier_only(e.task_id,e.execution_id,approval,jsonb_set(p,'{checks,0,status}','"skipped"'));EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Skipped mandatory check accepted';END IF;
 rejected:=false;BEGIN PERFORM control.reaccept_dot_verifier_only(e.task_id,e.execution_id,approval,jsonb_set(p,'{checks,0,name}','"different-check"'));EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Original failure was omitted';END IF;
 rejected:=false;BEGIN PERFORM control.reaccept_dot_verifier_only(e.task_id,e.execution_id,approval,jsonb_set(p,'{verified_state,files,1,object}','"changed-product"'));EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Product edit accepted';END IF;
 rejected:=false;BEGIN PERFORM control.reaccept_dot_verifier_only(e.task_id,e.execution_id,approval,jsonb_set(p,'{verified_state,base_sha}','"changed-base"'));EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Parent lineage change accepted';END IF;
 result:=control.reaccept_dot_verifier_only(e.task_id,e.execution_id,approval,p);IF result->>'passed'<>'true' OR result->>'attempt'<>'3' THEN RAISE EXCEPTION 'Reviewed same attempt reacceptance failed: %',result;END IF;
 result:=control.reaccept_dot_verifier_only(e.task_id,e.execution_id,approval,p);IF result->>'idempotent'<>'true' THEN RAISE EXCEPTION 'Reacceptance replay not idempotent';END IF;
 IF before IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(x) ORDER BY attempt) FROM control.executions x WHERE task_id=e.task_id) THEN RAISE EXCEPTION 'Reacceptance changed history';END IF;
END $$;
SELECT 'SHARED_RETRY_FIVE_REACCEPTANCE_GUARDS_PASS';
