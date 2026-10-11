\set ON_ERROR_STOP on

-- LOCAL FIXTURES ONLY. This follows the authority regression so its current
-- CONFIG claim remains available for stale-generation/rebind coverage first.
CREATE TEMP SEQUENCE fixture_publication_number START 920000;

CREATE OR REPLACE FUNCTION pg_temp.rebind_admission(p_task_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM control.refresh_publication_readiness_contract(p_task_id,'real-graph-fixture-rebind');
  UPDATE control.batch_task_admissions admission
  SET input_generation=generation.input_generation,
      contract_fingerprint=contract.contract_fingerprint,
      verification_fingerprint=control.verification_contract_fingerprint(admission.task_id),
      updated_at=now()
  FROM control.task_admission_generations generation,
       control.publication_readiness_contracts contract
  WHERE admission.repair_id='CP-BATCH-READY-001'
    AND admission.task_id=p_task_id
    AND generation.task_id=admission.task_id
    AND contract.task_id=admission.task_id;
END;
$$;

DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT task_id FROM control.batch_task_admissions
    WHERE status IN('admitted','claimed') ORDER BY task_id
  LOOP
    PERFORM pg_temp.rebind_admission(item.task_id);
  END LOOP;
END $$;

-- A current but rejected decision is a dependency-style wait, never a claim,
-- execution, failed attempt, or empty-queue result.
UPDATE control.decisions SET status='rejected'
WHERE suit_slug='super-admin-suit' AND decision_id='FIXTURE-AUTH-DEC';
SELECT pg_temp.rebind_admission('SAS-M1-CONFIG-001');
DO $$
DECLARE acquisition jsonb;
BEGIN
  acquisition:=control.acquire_workflow_run_task(
    'e362bc39-996c-451c-8fac-9a47df92715c','cp-batch-v2','fixture-controller','authority-controller','runner');
  IF acquisition->>'action'<>'wait' OR acquisition->>'reason'<>'decision_wait'
    OR acquisition->>'task_id'<>'SAS-M1-CONFIG-001' THEN
    RAISE EXCEPTION 'rejected decision did not produce a current-task wait: %',acquisition;
  END IF;
END $$;
UPDATE control.decisions SET status='approved'
WHERE suit_slug='super-admin-suit' AND decision_id='FIXTURE-AUTH-DEC';
SELECT pg_temp.rebind_admission('SAS-M1-CONFIG-001');

CREATE OR REPLACE FUNCTION pg_temp.complete_current_fixture_task(
  p_run_id uuid,
  p_controller_token text,
  p_expected_task text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE acquisition jsonb;
DECLARE credit jsonb;
DECLARE execution_id bigint;
DECLARE verification_id bigint;
DECLARE previous_count integer;
DECLARE publication_number integer;
BEGIN
  SELECT completed_tasks INTO previous_count FROM control.workflow_runs WHERE run_id=p_run_id;
  acquisition:=control.acquire_workflow_run_task(
    p_run_id,'cp-batch-v2','fixture-controller',p_controller_token,'runner');
  IF acquisition->>'task_id'<>p_expected_task OR acquisition->>'action' NOT IN('execute','resume') THEN
    RAISE EXCEPTION 'ordered acquisition mismatch for %: %',p_expected_task,acquisition;
  END IF;
  IF EXISTS(SELECT 1 FROM control.task_dependencies dependency
    LEFT JOIN control.tasks parent ON parent.task_id=dependency.depends_on_task_id
    WHERE dependency.task_id=p_expected_task AND dependency.dependency_type='hard'
      AND (parent.task_id IS NULL OR parent.status<>'complete')) THEN
    RAISE EXCEPTION 'task acquired before hard predecessor completion: %',p_expected_task;
  END IF;
  IF EXISTS(SELECT 1 FROM control.batch_task_admissions current_admission
    JOIN control.batch_task_admissions later ON later.run_id=current_admission.run_id
      AND later.ordinal>current_admission.ordinal
    JOIN control.tasks later_task ON later_task.task_id=later.task_id
    WHERE current_admission.task_id=p_expected_task AND later_task.status<>'planned') THEN
    RAISE EXCEPTION 'later ordinal was prematurely claimed after %',p_expected_task;
  END IF;
  acquisition:=control.acquire_workflow_run_task(
    p_run_id,'cp-batch-v2','fixture-controller','fixture-colliding-controller','runner');
  IF acquisition->>'action'<>'wait_for_owner' THEN
    RAISE EXCEPTION 'controller lease collision did not wait for owner: %',acquisition;
  END IF;

  UPDATE control.tasks SET metadata=jsonb_set(metadata,'{preparation}',
    '{"parent":{"fixture":true},"worktree":{"fixture":true}}',true),engine_stage='prepared'
  WHERE task_id=p_expected_task;
  execution_id:=control.start_execution(p_expected_task,'standard','fixture-model','medium',
    '/tmp/fixture-worktree','codex/fixture/'||lower(p_expected_task),'stg',repeat('a',40));
  PERFORM control.finish_execution(execution_id,'succeeded',repeat('b',40),10,20,'fixture.log',
    '{"fixture":true,"product_evidence":false}');
  verification_id:=control.start_verification_run(p_expected_task,execution_id,'runner','{"fixture":true}');
  PERFORM control.update_verification_check(verification_id,'fixture-required','pass',0,
    'LOCAL FIXTURE ONLY',NULL,1,'fixture command',true,
    '{"fixture":true,"product_acceptance":false}');
  PERFORM control.finish_verification_run(p_expected_task,verification_id);
  acquisition:=control.acquire_workflow_run_task(
    p_run_id,'cp-batch-v2','fixture-controller',p_controller_token,'runner');
  IF acquisition->>'action'<>'resume' OR acquisition->>'task_id'<>p_expected_task THEN
    RAISE EXCEPTION 'passed-but-unpublished task unlocked its child: %',p_expected_task;
  END IF;

  publication_number:=nextval('fixture_publication_number');
  PERFORM control.complete_publication(p_expected_task,'fixture/real-graph',publication_number,
    'codex/fixture/'||lower(p_expected_task),'stg',
    'https://example.invalid/real-graph/'||publication_number,repeat('c',40),false,
    '{"fixture":true,"deployment_proof":false}');
  acquisition:=control.acquire_workflow_run_task(
    p_run_id,'cp-batch-v2','fixture-controller',p_controller_token,'runner');
  IF acquisition->>'action'<>'credit_completion' OR acquisition->>'task_id'<>p_expected_task THEN
    RAISE EXCEPTION 'completed task did not route to attributed credit: %',p_expected_task;
  END IF;
  credit:=control.record_workflow_task_success(p_run_id,p_expected_task,'real-graph-credit:'||p_expected_task);
  IF (credit->>'completed_tasks')::integer<>previous_count+1 THEN
    RAISE EXCEPTION 'completion credit mismatch for %',p_expected_task;
  END IF;
  credit:=control.record_workflow_task_success(p_run_id,p_expected_task,'real-graph-credit:'||p_expected_task);
  IF credit->>'idempotent'<>'true' OR (credit->>'completed_tasks')::integer<>previous_count+1 THEN
    RAISE EXCEPTION 'completion credit replay mismatch for %',p_expected_task;
  END IF;
END;
$$;

-- Synthetic cross-run edge proves a valid admitted child waits while unrelated
-- admitted work can progress through its own run. It is removed and rebound
-- before the exact captured graph is replayed to completion.
INSERT INTO control.task_dependencies(task_id,depends_on_task_id,dependency_type)
VALUES('BS-UI-ZN-PATTERNS-001','SS-SA-CUSTOM-OFFER-001','hard');
SELECT pg_temp.rebind_admission('BS-UI-ZN-PATTERNS-001');
SELECT pg_temp.complete_current_fixture_task(
  '4f3b1b7f-0c82-4667-a420-563a43953326','controller-a','BS-UI-ZN-DATA-001');
DO $$
DECLARE acquisition jsonb;
BEGIN
  acquisition:=control.acquire_workflow_run_task(
    '4f3b1b7f-0c82-4667-a420-563a43953326','cp-batch-v2','fixture-controller','controller-a','runner');
  IF acquisition->>'action'<>'wait' OR acquisition->>'reason'<>'dependency_wait'
    OR acquisition->>'task_id'<>'BS-UI-ZN-PATTERNS-001' THEN
    RAISE EXCEPTION 'cross-run predecessor did not produce dependency wait: %',acquisition;
  END IF;
  IF (SELECT status FROM control.tasks WHERE task_id='BS-UI-ZN-PATTERNS-001')<>'planned' THEN
    RAISE EXCEPTION 'dependency wait claimed the child';
  END IF;
END $$;
SELECT pg_temp.complete_current_fixture_task(
  'dc3910cd-48be-42b4-9569-4c769e633a44','shop-controller','SS-SA-CUSTOM-OFFER-001');
DELETE FROM control.task_dependencies
WHERE task_id='BS-UI-ZN-PATTERNS-001' AND depends_on_task_id='SS-SA-CUSTOM-OFFER-001';
SELECT pg_temp.rebind_admission('BS-UI-ZN-PATTERNS-001');

DO $progression$
DECLARE item record;
DECLARE token text;
BEGIN
  FOR item IN
    SELECT admission.task_id,admission.run_id,admission.ordinal
    FROM control.batch_task_admissions admission
    WHERE admission.status IN('admitted','claimed')
    ORDER BY admission.run_id,admission.ordinal
  LOOP
    SELECT CASE admission_run.workstream_slug
      WHEN 'shared' THEN 'controller-a'
      WHEN 'shop-suit' THEN 'shop-controller'
      ELSE 'authority-controller' END INTO token
    FROM control.workflow_runs admission_run WHERE admission_run.run_id=item.run_id;
    PERFORM pg_temp.complete_current_fixture_task(item.run_id,token,item.task_id);
  END LOOP;
END;
$progression$;

DO $assertions$
DECLARE acquisition jsonb;
DECLARE revision bigint;
BEGIN
  IF EXISTS(
    WITH captured(child,parent) AS (VALUES
      ('BS-UI-ZN-DATA-001','BS-UI-ZN-PUBLIC-CHROME-001'),
      ('BS-UI-ZN-PATTERNS-001','BS-UI-ZN-DATA-001'),
      ('BS-UI-ZN-LEDGER-001','BS-UI-ZN-PATTERNS-001'),
      ('BS-UI-ZN-SHOP-001','BS-UI-ZN-LEDGER-001'),
      ('BS-UI-ZN-OTHER-SUITS-001','BS-UI-ZN-SHOP-001'),
      ('BS-UI-ZN-GENERATOR-001','BS-UI-ZN-OTHER-SUITS-001'),
      ('BS-UI-ZN-BROWSER-001','BS-UI-ZN-GENERATOR-001'),
      ('BS-UI-ZN-FINAL-001','BS-UI-ZN-BROWSER-001'),
      ('SS-SA-EVIDENCE-001','SS-SA-BRIDGE-001'),
      ('SS-SA-CUSTOM-OFFER-001','SS-SA-BRIDGE-001'),
      ('SS-SA-CUSTOM-OFFER-001','SS-SUB-001'),
      ('SAS-M1-CONFIG-001','SAS-M1-ARCH-001'),
      ('SAS-M1-CONFIG-001','SAS-M1-BOOT-001'),
      ('SAS-M1-AUTH-001','SAS-M1-CONFIG-001')
    )
    SELECT 1 FROM captured LEFT JOIN control.task_dependencies dependency
      ON dependency.task_id=captured.child AND dependency.depends_on_task_id=captured.parent
        AND dependency.dependency_type='hard'
    WHERE dependency.task_id IS NULL
  ) THEN RAISE EXCEPTION 'one or more captured hard edges were lost'; END IF;
  -- The preceding authority suite records ORDINARY-FUTURE-001 as well.
  -- Count this batch's credits, not unrelated compatibility-test history.
  IF (SELECT count(*) FROM control.workflow_run_task_credits credit
      JOIN control.batch_task_admissions admission
        ON admission.run_id=credit.run_id AND admission.task_id=credit.task_id
      WHERE admission.repair_id='CP-BATCH-READY-001')<>12 THEN
    RAISE EXCEPTION 'twelve distinct batch completion credits were not recorded';
  END IF;
  IF (SELECT count(*) FROM control.workflow_run_task_credits
      WHERE task_id='ORDINARY-FUTURE-001' AND idempotency_key='ordinary-future-credit')<>1 THEN
    RAISE EXCEPTION 'unrelated ordinary compatibility credit was lost or duplicated';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM control.workflow_runs
    WHERE run_id='4f3b1b7f-0c82-4667-a420-563a43953326' AND completed_tasks=8 AND max_tasks=9) THEN
    RAISE EXCEPTION 'Shared count or held ninth slot changed';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM control.workflow_runs
    WHERE run_id='dc3910cd-48be-42b4-9569-4c769e633a44' AND completed_tasks=2 AND max_tasks=2) THEN
    RAISE EXCEPTION 'Shop reconciled budget changed';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM control.workflow_runs
    WHERE run_id='e362bc39-996c-451c-8fac-9a47df92715c' AND completed_tasks=2 AND max_tasks=2) THEN
    RAISE EXCEPTION 'Super Admin budget changed';
  END IF;

  UPDATE control.workflow_runs SET stop_requested=true
  WHERE run_id='4f3b1b7f-0c82-4667-a420-563a43953326';
  acquisition:=control.acquire_workflow_run_task(
    '4f3b1b7f-0c82-4667-a420-563a43953326','cp-batch-v2','fixture-controller','controller-a','runner');
  IF acquisition->>'action'<>'wait' OR acquisition->>'reason'<>'stop_requested' THEN
    RAISE EXCEPTION 'stop gate did not preserve the run: %',acquisition;
  END IF;
  UPDATE control.workflow_runs SET stop_requested=false
  WHERE run_id='4f3b1b7f-0c82-4667-a420-563a43953326';
  SELECT run_revision INTO revision FROM control.workflow_runs
  WHERE run_id='4f3b1b7f-0c82-4667-a420-563a43953326';
  PERFORM control.request_workflow_maintenance(
    '4f3b1b7f-0c82-4667-a420-563a43953326',revision,'human');
  acquisition:=control.acquire_workflow_run_task(
    '4f3b1b7f-0c82-4667-a420-563a43953326','cp-batch-v2','fixture-controller','controller-a','runner');
  IF acquisition->>'action'<>'wait' OR acquisition->>'reason'<>'maintenance_requested' THEN
    RAISE EXCEPTION 'maintenance gate did not preserve the run: %',acquisition;
  END IF;
END;
$assertions$;

SELECT 'REAL_GRAPH_LIFECYCLE_PASS tasks=12 edges=14';
