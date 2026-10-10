\set ON_ERROR_STOP on
BEGIN;
DO $$DECLARE rel record;BEGIN
 IF has_function_privilege('bs_control_app','control.capture_verifier_receipt(bigint,jsonb)','EXECUTE') OR has_function_privilege('bs_control_app','control.review_verification_failure(bigint,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Runtime can mint reviewed receipts';END IF;
 IF has_function_privilege('bs_control_app','control.record_workflow_task_success(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous credit remains callable';END IF;
 IF pg_has_role('bs_control_app','bs_control_verifier','MEMBER') THEN RAISE EXCEPTION 'Runtime can become verifier';END IF;
 FOR rel IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='control' AND c.relkind='r' LOOP
 IF has_table_privilege('bs_control_app',rel.oid,'DELETE') OR has_table_privilege('bs_control_app',rel.oid,'TRUNCATE') THEN RAISE EXCEPTION 'Destructive runtime privilege on %',rel.relname;END IF;
 END LOOP;
END $$;
INSERT INTO control.tasks(task_id,suit_slug,sequence,title,status,acceptance_criteria,verification_plan)
VALUES('CP-CAPABILITY-FORGE-SYNTHETIC','ledger-suit',-92001,'Disposable capability fixture','in_progress','["synthetic"]','["synthetic"]');
INSERT INTO control.executions(task_id,attempt,status,model_profile) VALUES('CP-CAPABILITY-FORGE-SYNTHETIC',1,'succeeded','standard');
INSERT INTO control.verification_runs(execution_id,status) SELECT execution_id,'failed' FROM control.executions WHERE task_id='CP-CAPABILITY-FORGE-SYNTHETIC';
INSERT INTO control.verification_results(execution_id,verification_run_id,check_name,command,status,exit_code,log_path)
SELECT execution_id,verification_run_id,'synthetic-check','fixture','fail',1,'/fixture.log' FROM control.verification_runs WHERE execution_id=(SELECT execution_id FROM control.executions WHERE task_id='CP-CAPABILITY-FORGE-SYNTHETIC');
GRANT USAGE ON SCHEMA control TO bs_control_app;
GRANT SELECT,UPDATE ON control.verification_results TO bs_control_app;
CREATE POLICY capability_fixture_access ON control.verification_results TO bs_control_app USING(true) WITH CHECK(true);
SET LOCAL ROLE bs_control_app;
DO $$DECLARE denied boolean:=false;BEGIN
 BEGIN UPDATE control.verification_results SET trusted_receipt='{"version":1}' WHERE check_name='synthetic-check' AND command='fixture';EXCEPTION WHEN OTHERS THEN IF SQLERRM='trusted_verifier_capability_required' THEN denied:=true;ELSE RAISE;END IF;END;
 IF NOT denied THEN RAISE EXCEPTION 'Runtime bypassed capture function with direct UPDATE';END IF;
END $$;
RESET ROLE;
ROLLBACK;
