\set ON_ERROR_STOP on
DO $$ DECLARE e control.executions%ROWTYPE; fixture_run_id uuid:='33333333-2222-4333-8444-555555555555'; result jsonb; v_id bigint;
BEGIN
 SELECT * INTO e FROM control.executions WHERE task_id='CP-FIVE-REVIEW-001' ORDER BY attempt DESC LIMIT 1;
 SELECT max(verification_run_id) INTO v_id FROM control.verification_runs WHERE execution_id=e.execution_id;
 IF NOT control.publication_execution_is_eligible(e.task_id,e.execution_id) THEN RAISE EXCEPTION 'Exact guarded Dot acceptance rejected at publication'; END IF;
 UPDATE control.run_ordinary_publication_authorizations SET revoked_at=now() WHERE control.run_ordinary_publication_authorizations.run_id=fixture_run_id;
 IF control.publication_execution_is_eligible(e.task_id,e.execution_id) THEN RAISE EXCEPTION 'Revoked run authority accepted';END IF;
 UPDATE control.run_ordinary_publication_authorizations SET revoked_at=NULL WHERE control.run_ordinary_publication_authorizations.run_id=fixture_run_id;
 UPDATE control.verification_results SET status='skipped' WHERE verification_run_id=v_id;
 IF control.publication_execution_is_eligible(e.task_id,e.execution_id) THEN RAISE EXCEPTION 'Skipped mandatory receipt accepted';END IF;
 UPDATE control.verification_results SET status='pass' WHERE verification_run_id=v_id;
 UPDATE control.workflow_runs SET maintenance_requested=true WHERE control.workflow_runs.run_id=fixture_run_id;
 IF control.publication_execution_is_eligible(e.task_id,e.execution_id) THEN RAISE EXCEPTION 'Maintenance hold bypassed';END IF;
 UPDATE control.workflow_runs SET maintenance_requested=false WHERE control.workflow_runs.run_id=fixture_run_id;
 result:=control.complete_publication(e.task_id,'fixture/bounded',940003,e.branch_name,e.parent_branch,'https://example.invalid/940003',repeat('b',40),true,jsonb_build_object('verification_run_id',v_id,'fixture',true));
 IF result->>'task_status'<>'complete' THEN RAISE EXCEPTION 'Normal publication did not complete';END IF;
 PERFORM control.record_workflow_task_success(fixture_run_id,e.task_id,'same-attempt-dot-credit');
 PERFORM control.record_workflow_task_success(fixture_run_id,e.task_id,'same-attempt-dot-credit-replay');
 IF (SELECT completed_tasks FROM control.workflow_runs WHERE control.workflow_runs.run_id=fixture_run_id)<>1 THEN RAISE EXCEPTION 'Completion credit not exactly once';END IF;
 IF (SELECT count(*) FROM control.executions WHERE task_id=e.task_id)<>3 OR (SELECT status FROM control.executions WHERE execution_id=e.execution_id)<>'failed' THEN RAISE EXCEPTION 'Historical failed execution rewritten';END IF;
 IF NOT control.publication_execution_is_eligible(e.task_id,e.execution_id) THEN RAISE EXCEPTION 'Completed publication receipt cannot reconcile after credit';END IF;
 IF (SELECT count(*) FROM control.task_events WHERE task_id=e.task_id AND event_type='publication_completed')<>1 THEN RAISE EXCEPTION 'Duplicate publication event';END IF;
END $$;
SELECT 'DOT_REACCEPTED_NORMAL_PUBLICATION_CREDIT_PASS';
