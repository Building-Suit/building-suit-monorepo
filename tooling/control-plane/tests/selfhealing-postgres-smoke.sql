\set ON_ERROR_STOP on
INSERT INTO control.suits(slug,display_name,stack_key,app_path,status) VALUES('cp-selfheal-fixture','Disposable selfheal','cp-selfheal-fixture','tooling/control-plane','active');
INSERT INTO control.workstreams(project_id,slug,display_name,stack_key,application_path,suit_slug) SELECT project_id,'cp-selfheal-fixture','Disposable selfheal','cp-selfheal-fixture','tooling/control-plane','cp-selfheal-fixture' FROM control.projects WHERE slug='building-suit';
INSERT INTO control.tasks(task_id,suit_slug,sequence,priority,title,description,status,acceptance_criteria,verification_plan,metadata,project_id,workstream_slug,retry_policy_id)
SELECT 'CP-SH-FIXTURE-001','cp-selfheal-fixture',999,1,'Self healing fixture','Only disposable control database','in_progress','["fixture"]','["git diff --check"]','{}',project_id,'cp-selfheal-fixture','standard-five' FROM control.projects WHERE slug='building-suit';
INSERT INTO control.workflow_runs(run_id,suit_slug,max_tasks,completed_tasks,status,current_task_id)
VALUES('11111111-2222-4333-8444-555555555555','cp-selfheal-fixture',2,0,'running','CP-SH-FIXTURE-001');
DO $$
DECLARE op jsonb; again jsonb; before_attempt integer;
BEGIN
 SELECT coalesce(max(attempt),0) INTO before_attempt FROM control.executions WHERE task_id='CP-SH-FIXTURE-001';
 op:=control.claim_runtime_operation('CP-SH-FIXTURE-001','task-run',NULL,'{"source":"fixture"}','fixture-owner','fixture-token');
 IF NOT (op->>'acquired')::boolean THEN RAISE EXCEPTION 'operation not acquired'; END IF;
 again:=control.claim_runtime_operation('CP-SH-FIXTURE-001','task-run',NULL,'{"source":"other"}','second-owner','other-token');
 IF op->'operation'->>'operation_id' IS DISTINCT FROM again->'operation'->>'operation_id' THEN RAISE EXCEPTION 'duplicate runtime operation'; END IF;
 UPDATE control.runtime_operations SET infra_retries=infra_retries+1,next_wake_at=now()+interval '30 seconds' WHERE task_id='CP-SH-FIXTURE-001';
 IF before_attempt IS DISTINCT FROM (SELECT coalesce(max(attempt),0) FROM control.executions WHERE task_id='CP-SH-FIXTURE-001') THEN RAISE EXCEPTION 'infra spent product attempt'; END IF;
 UPDATE control.workflow_runs SET maintenance_requested=true WHERE run_id='11111111-2222-4333-8444-555555555555';
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(control.runtime_recovery_candidates()) x WHERE x->>'run_id'='11111111-2222-4333-8444-555555555555') THEN RAISE EXCEPTION 'maintenance ignored'; END IF;
 UPDATE control.workflow_runs SET maintenance_requested=false,stop_requested=true WHERE run_id='11111111-2222-4333-8444-555555555555';
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(control.runtime_recovery_candidates()) x WHERE x->>'run_id'='11111111-2222-4333-8444-555555555555') THEN RAISE EXCEPTION 'stop ignored'; END IF;
 UPDATE control.workflow_runs SET stop_requested=false,completed_tasks=max_tasks WHERE run_id='11111111-2222-4333-8444-555555555555';
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(control.runtime_recovery_candidates()) x WHERE x->>'run_id'='11111111-2222-4333-8444-555555555555') THEN RAISE EXCEPTION 'limit ignored'; END IF;
 UPDATE control.workflow_runs SET completed_tasks=0 WHERE run_id='11111111-2222-4333-8444-555555555555';
 PERFORM control.record_recovery_condition(p_resume_identity=>'task:CP-SH-FIXTURE-001',p_idempotency_key=>'fixture-human-gate',p_failure_class=>'operator-wait',p_error_code=>'publication_operator_hold',p_next_action=>'wait-operator',p_recoverable=>true,p_source=>'fixture',p_workflow_run_id=>'11111111-2222-4333-8444-555555555555',p_current_task_id=>'CP-SH-FIXTURE-001');
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(control.runtime_recovery_candidates()) x WHERE x->>'run_id'='11111111-2222-4333-8444-555555555555') THEN RAISE EXCEPTION 'human gate ignored'; END IF;
 UPDATE control.workflow_runs SET status='failed' WHERE run_id='11111111-2222-4333-8444-555555555555';
 IF control.ensure_workflow_run('cp-selfheal-fixture',7)->>'run_id' <> '11111111-2222-4333-8444-555555555555' THEN RAISE EXCEPTION 'empty successor created'; END IF;
 IF (SELECT count(*) FROM control.workflow_runs WHERE suit_slug='cp-selfheal-fixture')<>1 THEN RAISE EXCEPTION 'replacement run created'; END IF;
 IF (SELECT count(*) FROM control.workflow_runs WHERE run_id='11111111-2222-4333-8444-555555555555')<>1 THEN RAISE EXCEPTION 'original attribution lost'; END IF;
END $$;

-- PostgreSQL RLS UPDATE denial can return zero rows without throwing 42501.
-- Reproduce the Shop test semantic mismatch without touching its real DB.
SELECT 'cp_selfheal_rls_' || substr(md5(current_database()),1,24) AS fixture_role \gset
CREATE ROLE :"fixture_role";
CREATE TABLE public.cp_selfheal_rls_fixture(id integer PRIMARY KEY, owner_name text, object_name text);
INSERT INTO public.cp_selfheal_rls_fixture VALUES(1,'owner','immutable.png');
ALTER TABLE public.cp_selfheal_rls_fixture ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO :"fixture_role";
GRANT SELECT,UPDATE ON public.cp_selfheal_rls_fixture TO :"fixture_role";
CREATE POLICY owner_select ON public.cp_selfheal_rls_fixture FOR SELECT TO :"fixture_role" USING(owner_name='owner');
SET ROLE :"fixture_role";
DO $$ DECLARE touched integer; BEGIN
 UPDATE public.cp_selfheal_rls_fixture SET object_name='changed.png' WHERE id=1;
 GET DIAGNOSTICS touched=ROW_COUNT;
 IF touched<>0 THEN RAISE EXCEPTION 'RLS allowed mutation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.cp_selfheal_rls_fixture WHERE id=1 AND object_name='immutable.png') THEN RAISE EXCEPTION 'immutable object changed'; END IF;
END $$;
RESET ROLE;
DROP TABLE public.cp_selfheal_rls_fixture;
DROP OWNED BY :"fixture_role";
DROP ROLE :"fixture_role";
