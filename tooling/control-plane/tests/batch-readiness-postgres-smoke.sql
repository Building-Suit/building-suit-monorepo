\set ON_ERROR_STOP on

INSERT INTO control.suits(slug,display_name,stack_key,app_path,status)
VALUES
  ('shared','Shared','shared','packages/ui','active'),
  ('super-admin-suit','Super Admin Suit','super-admin-suit','apps/super-admin-suit','active')
ON CONFLICT(slug) DO UPDATE SET status='active';

INSERT INTO control.workstreams(project_id,slug,display_name,stack_key,application_path,suit_slug,verification_config,publication_config)
SELECT project_id,'shared','Shared','shared','packages/ui','shared','{"unrelated":{"preserve":true}}','{"mode":"pull-request"}' FROM control.projects WHERE slug='building-suit'
ON CONFLICT(project_id,slug) DO UPDATE SET suit_slug=EXCLUDED.suit_slug,verification_config=EXCLUDED.verification_config;
INSERT INTO control.workstreams(project_id,slug,display_name,stack_key,application_path,suit_slug,verification_config,publication_config)
SELECT project_id,'super-admin-suit','Super Admin Suit','super-admin-suit','apps/super-admin-suit','super-admin-suit','{}','{"mode":"pull-request"}' FROM control.projects WHERE slug='building-suit'
ON CONFLICT(project_id,slug) DO UPDATE SET suit_slug=EXCLUDED.suit_slug;

WITH fixture(task_id,workstream_slug,suit_slug,ordinal,status) AS (VALUES
  ('BS-UI-ZN-DATA-001','shared','shared',1,'in_progress'),
  ('BS-UI-ZN-PATTERNS-001','shared','shared',2,'planned'),
  ('BS-UI-ZN-LEDGER-001','shared','shared',3,'planned'),
  ('BS-UI-ZN-SHOP-001','shared','shared',4,'planned'),
  ('BS-UI-ZN-OTHER-SUITS-001','shared','shared',5,'planned'),
  ('BS-UI-ZN-GENERATOR-001','shared','shared',6,'planned'),
  ('BS-UI-ZN-BROWSER-001','shared','shared',7,'planned'),
  ('BS-UI-ZN-FINAL-001','shared','shared',8,'planned'),
  ('SS-SA-EVIDENCE-001','shop-suit','shop-suit',1,'in_progress'),
  ('SS-SA-CUSTOM-OFFER-001','shop-suit','shop-suit',2,'planned'),
  ('SAS-M1-CONFIG-001','super-admin-suit','super-admin-suit',1,'in_progress'),
  ('SAS-M1-AUTH-001','super-admin-suit','super-admin-suit',2,'planned')
)
INSERT INTO control.tasks(task_id,suit_slug,sequence,priority,title,description,status,acceptance_criteria,verification_plan,metadata,project_id,workstream_slug,retry_policy_id)
SELECT fixture.task_id,fixture.suit_slug,fixture.ordinal,1,fixture.task_id,'fixture',fixture.status,
  '["accepted"]','["git diff --check"]',
  CASE WHEN fixture.task_id='SS-SA-EVIDENCE-001'
    THEN '{"allowed_paths":["tooling/control-plane/tests/fixture-output.test.mjs"]}'::jsonb
    ELSE '{"allowed_paths":[]}'::jsonb END,
  project.project_id,fixture.workstream_slug,'standard-five'
FROM fixture CROSS JOIN control.projects project WHERE project.slug='building-suit';

INSERT INTO control.workflow_runs(run_id,suit_slug,project_id,workstream_slug,max_tasks,completed_tasks,status,maintenance_requested,run_revision)
SELECT run_values.run_id::uuid,run_values.suit_slug,project.project_id,run_values.workstream_slug,run_values.max_tasks,0,'running',true,1
FROM (VALUES
  ('4f3b1b7f-0c82-4667-a420-563a43953326','shared','shared',9),
  ('dc3910cd-48be-42b4-9569-4c769e633a44','shop-suit','shop-suit',3),
  ('e362bc39-996c-451c-8fac-9a47df92715c','super-admin-suit','super-admin-suit',2)
) run_values(run_id,suit_slug,workstream_slug,max_tasks)
CROSS JOIN control.projects project WHERE project.slug='building-suit';

-- Exact captured graph. Existing imported prerequisites are updated in-place for this
-- disposable fixture; no production/history migration is altered.
WITH prerequisite(task_id,suit_slug,workstream_slug) AS (VALUES
  ('BS-UI-ZN-PUBLIC-CHROME-001','shared','shared'),
  ('SS-SA-BRIDGE-001','shop-suit','shop-suit'),
  ('SS-SUB-001','shop-suit','shop-suit'),
  ('SAS-M1-ARCH-001','super-admin-suit','super-admin-suit'),
  ('SAS-M1-BOOT-001','super-admin-suit','super-admin-suit')
)
INSERT INTO control.tasks(task_id,suit_slug,sequence,priority,title,description,status,acceptance_criteria,
  verification_plan,metadata,project_id,workstream_slug,retry_policy_id)
SELECT prerequisite.task_id,prerequisite.suit_slug,9900,100,prerequisite.task_id,
  'LOCAL POSTGRES FIXTURE ONLY','complete','["fixture"]','["git diff --check"]','{}',
  project.project_id,prerequisite.workstream_slug,'standard-five'
FROM prerequisite CROSS JOIN control.projects project WHERE project.slug='building-suit'
ON CONFLICT(task_id) DO UPDATE SET status='complete';

INSERT INTO control.task_dependencies(task_id,depends_on_task_id,dependency_type) VALUES
  ('BS-UI-ZN-DATA-001','BS-UI-ZN-PUBLIC-CHROME-001','hard'),
  ('BS-UI-ZN-PATTERNS-001','BS-UI-ZN-DATA-001','hard'),
  ('BS-UI-ZN-LEDGER-001','BS-UI-ZN-PATTERNS-001','hard'),
  ('BS-UI-ZN-SHOP-001','BS-UI-ZN-LEDGER-001','hard'),
  ('BS-UI-ZN-OTHER-SUITS-001','BS-UI-ZN-SHOP-001','hard'),
  ('BS-UI-ZN-GENERATOR-001','BS-UI-ZN-OTHER-SUITS-001','hard'),
  ('BS-UI-ZN-BROWSER-001','BS-UI-ZN-GENERATOR-001','hard'),
  ('BS-UI-ZN-FINAL-001','BS-UI-ZN-BROWSER-001','hard'),
  ('SS-SA-EVIDENCE-001','SS-SA-BRIDGE-001','hard'),
  ('SS-SA-CUSTOM-OFFER-001','SS-SA-BRIDGE-001','hard'),
  ('SS-SA-CUSTOM-OFFER-001','SS-SUB-001','hard'),
  ('SAS-M1-CONFIG-001','SAS-M1-ARCH-001','hard'),
  ('SAS-M1-CONFIG-001','SAS-M1-BOOT-001','hard'),
  ('SAS-M1-AUTH-001','SAS-M1-CONFIG-001','hard')
ON CONFLICT(task_id,depends_on_task_id) DO UPDATE SET dependency_type=EXCLUDED.dependency_type;

SELECT control.refresh_publication_readiness_contract(task_id,'fixture')
FROM control.tasks WHERE task_id IN(
  'BS-UI-ZN-DATA-001','BS-UI-ZN-PATTERNS-001','BS-UI-ZN-LEDGER-001','BS-UI-ZN-SHOP-001',
  'BS-UI-ZN-OTHER-SUITS-001','BS-UI-ZN-GENERATOR-001','BS-UI-ZN-BROWSER-001','BS-UI-ZN-FINAL-001',
  'SS-SA-EVIDENCE-001','SS-SA-CUSTOM-OFFER-001','SAS-M1-CONFIG-001','SAS-M1-AUTH-001') ORDER BY task_id;

SELECT control.prepare_batch_readiness_repair(
  'CP-BATCH-READY-001','e2f0f02d37eea920dbe589c86888d287dce7a4a84410b8764346e6f74c7d6c5e',
  '{"workstreams":{"shared":{"verification_config":{"commands":[{"name":"fixture","program":"git","args":["diff","--check"]}]}},"shop-suit":{"verification_config":{}},"super-admin-suit":{"verification_config":{}}}}',
  '{"available":true,"protocol":"cp-batch-v2","fingerprint":"fixture-controller"}',
  'fixture-repair');

SELECT control.apply_batch_readiness_registry_patch(
  'CP-BATCH-READY-001','e2f0f02d37eea920dbe589c86888d287dce7a4a84410b8764346e6f74c7d6c5e',
  jsonb_build_object(
    '4f3b1b7f-0c82-4667-a420-563a43953326',jsonb_build_object('status','running','max_tasks',9,'completed_tasks',0,'current_task_id',NULL,'run_revision',1),
    'dc3910cd-48be-42b4-9569-4c769e633a44',jsonb_build_object('status','running','max_tasks',3,'completed_tasks',0,'current_task_id',NULL,'run_revision',1),
    'e362bc39-996c-451c-8fac-9a47df92715c',jsonb_build_object('status','running','max_tasks',2,'completed_tasks',0,'current_task_id',NULL,'run_revision',1)
  ));

SELECT control.authorize_preexecution_publication_paths(
  'SS-SA-EVIDENCE-001',
  '["tooling/control-plane/tests/fixture-output.test.mjs"]'::jsonb,
  'fixture-ordinary-authorization',
  'fixture reviewed exact path',
  'human'
);

SELECT control.reconcile_workflow_run_budget(
  'dc3910cd-48be-42b4-9569-4c769e633a44',
  (SELECT run_revision FROM control.workflow_runs WHERE run_id='dc3910cd-48be-42b4-9569-4c769e633a44'),
  3,0,2,'human'
);

DO $$
DECLARE first_state jsonb;
DECLARE second_state jsonb;
BEGIN
  SELECT after_state INTO first_state FROM control.batch_repair_generations WHERE repair_id='CP-BATCH-READY-001';
  SELECT control.apply_batch_readiness_registry_patch(
    'CP-BATCH-READY-001','e2f0f02d37eea920dbe589c86888d287dce7a4a84410b8764346e6f74c7d6c5e','{}') INTO second_state;
  IF second_state->>'idempotent'<>'true' THEN RAISE EXCEPTION 'registry replay was not idempotent'; END IF;
  IF first_state IS DISTINCT FROM (SELECT after_state FROM control.batch_repair_generations WHERE repair_id='CP-BATCH-READY-001') THEN
    RAISE EXCEPTION 'registry replay mutated after_state';
  END IF;
  IF (SELECT verification_config->'unrelated' FROM control.workstreams WHERE slug='shared') IS DISTINCT FROM '{"preserve":true}'::jsonb THEN
    RAISE EXCEPTION 'registry merge removed unrelated configuration';
  END IF;
END $$;

CREATE TEMP TABLE fixture_admissions AS
SELECT jsonb_agg(jsonb_build_object(
  'task_id',task.task_id,
  'run_id',CASE task.workstream_slug
    WHEN 'shared' THEN '4f3b1b7f-0c82-4667-a420-563a43953326'
    WHEN 'shop-suit' THEN 'dc3910cd-48be-42b4-9569-4c769e633a44'
    ELSE 'e362bc39-996c-451c-8fac-9a47df92715c' END,
  'ordinal',task.sequence,
  'contract_fingerprint',contract.contract_fingerprint,
  'verification_fingerprint',control.verification_contract_fingerprint(task.task_id),
  'blockers','[]'::jsonb
) ORDER BY task.task_id) AS value
FROM control.tasks task JOIN control.publication_readiness_contracts contract USING(task_id)
WHERE task.task_id IN(
  'BS-UI-ZN-DATA-001','BS-UI-ZN-PATTERNS-001','BS-UI-ZN-LEDGER-001','BS-UI-ZN-SHOP-001',
  'BS-UI-ZN-OTHER-SUITS-001','BS-UI-ZN-GENERATOR-001','BS-UI-ZN-BROWSER-001','BS-UI-ZN-FINAL-001',
  'SS-SA-EVIDENCE-001','SS-SA-CUSTOM-OFFER-001','SAS-M1-CONFIG-001','SAS-M1-AUTH-001');

DO $$
DECLARE admissions jsonb;
BEGIN
  SELECT value INTO admissions FROM fixture_admissions;
  BEGIN
    UPDATE control.tasks SET status='planned' WHERE task_id='BS-UI-ZN-PUBLIC-CHROME-001';
    PERFORM control.activate_batch_task_admissions('CP-BATCH-READY-001',admissions,'cp-batch-v2','fixture-controller','human');
    RAISE EXCEPTION USING ERRCODE='P0004',MESSAGE='incomplete external prerequisite unexpectedly activated';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE 'Hard dependency is self-referential, omitted, incomplete, or ordered after its child%' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM control.tasks WHERE task_id='BS-UI-ZN-PUBLIC-CHROME-001')<>'complete' THEN
    RAISE EXCEPTION 'external prerequisite rejection did not roll back';
  END IF;

  BEGIN
    INSERT INTO control.task_dependencies(task_id,depends_on_task_id,dependency_type)
    VALUES('BS-UI-ZN-DATA-001','BS-UI-ZN-PATTERNS-001','hard');
    PERFORM control.refresh_publication_readiness_contract('BS-UI-ZN-DATA-001','cycle-fixture');
    PERFORM control.activate_batch_task_admissions('CP-BATCH-READY-001',admissions,'cp-batch-v2','fixture-controller','human');
    RAISE EXCEPTION USING ERRCODE='P0004',MESSAGE='dependency cycle unexpectedly activated';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE 'Combined hard-dependency and run-order graph contains a cycle%' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM control.task_dependencies
    WHERE task_id='BS-UI-ZN-DATA-001' AND depends_on_task_id='BS-UI-ZN-PATTERNS-001') THEN
    RAISE EXCEPTION 'cycle rejection did not roll back';
  END IF;

  BEGIN
    INSERT INTO control.task_dependencies(task_id,depends_on_task_id,dependency_type) VALUES
      ('BS-UI-ZN-DATA-001','SS-SA-CUSTOM-OFFER-001','hard'),
      ('SS-SA-EVIDENCE-001','BS-UI-ZN-PATTERNS-001','hard');
    PERFORM control.activate_batch_task_admissions('CP-BATCH-READY-001',admissions,'cp-batch-v2','fixture-controller','human');
    RAISE EXCEPTION USING ERRCODE='P0004',MESSAGE='cross-run scheduling cycle unexpectedly activated';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE 'Combined hard-dependency and run-order graph contains a cycle%' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM control.task_dependencies
    WHERE (task_id,depends_on_task_id) IN(
      ('BS-UI-ZN-DATA-001','SS-SA-CUSTOM-OFFER-001'),
      ('SS-SA-EVIDENCE-001','BS-UI-ZN-PATTERNS-001'))) THEN
    RAISE EXCEPTION 'cross-run cycle rejection did not roll back';
  END IF;

  BEGIN
    INSERT INTO control.task_dependencies(task_id,depends_on_task_id,dependency_type)
    VALUES('BS-UI-ZN-DATA-001','BS-UI-ZN-DATA-001','hard');
    RAISE EXCEPTION USING ERRCODE='P0004',MESSAGE='self dependency unexpectedly persisted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%task_dependencies_check%' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM control.task_dependencies
    WHERE task_id='BS-UI-ZN-DATA-001' AND depends_on_task_id='BS-UI-ZN-DATA-001') THEN
    RAISE EXCEPTION 'self dependency rejection left a persisted edge';
  END IF;

  BEGIN
    PERFORM control.activate_batch_task_admissions('CP-BATCH-READY-001',(
      SELECT jsonb_agg(CASE WHEN value->>'run_id'='4f3b1b7f-0c82-4667-a420-563a43953326'
        THEN jsonb_set(value,'{ordinal}',to_jsonb(9-(value->>'ordinal')::integer)) ELSE value END)
      FROM jsonb_array_elements(admissions) entry(value)
    ),'cp-batch-v2','fixture-controller','human');
    RAISE EXCEPTION USING ERRCODE='P0004',MESSAGE='reversed dependency order unexpectedly activated';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE 'Admission ordinals must be positive, unique, contiguous, and match the reviewed run order%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM control.activate_batch_task_admissions('CP-BATCH-READY-001',(
      SELECT jsonb_agg(CASE value->>'task_id'
        WHEN 'SS-SA-EVIDENCE-001' THEN jsonb_set(value,'{ordinal}','2'::jsonb)
        WHEN 'SS-SA-CUSTOM-OFFER-001' THEN jsonb_set(value,'{ordinal}','1'::jsonb)
        ELSE value END)
      FROM jsonb_array_elements(admissions) entry(value)
    ),'cp-batch-v2','fixture-controller','human');
    RAISE EXCEPTION USING ERRCODE='P0004',MESSAGE='swapped reviewed Shop order unexpectedly activated';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE 'Admission ordinals must be positive, unique, contiguous, and match the reviewed run order%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM control.activate_batch_task_admissions('CP-BATCH-READY-001',(
      SELECT jsonb_agg(value) FROM jsonb_array_elements(admissions) entry(value)
      WHERE value->>'task_id'<>'BS-UI-ZN-DATA-001'
    ),'cp-batch-v2','fixture-controller','human');
    RAISE EXCEPTION USING ERRCODE='P0004',MESSAGE='omitted unfinished ancestor unexpectedly activated';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE 'Admission set must exactly match the reconciled 12-task release set%' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM control.batch_task_admissions) THEN RAISE EXCEPTION 'negative graph guards left partial admissions'; END IF;

  -- Harness correction: two claims include an unready downstream claim, which
  -- is rejected by the dependency-ready-head guard before the count guard.
  -- Require that exact domain error; arbitrary exceptions are not test passes.
  -- Each invalid setup is inside the exception subtransaction so it rolls back.
  DECLARE
    snapshot_before jsonb;
    snapshot_after jsonb;
  BEGIN
    SELECT jsonb_build_object(
      'tasks',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.task_id) FROM control.tasks t
        WHERE t.task_id IN(SELECT value->>'task_id' FROM jsonb_array_elements(admissions))),
      'runs',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.run_id) FROM control.workflow_runs r),
      'admissions',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.task_id),'[]'::jsonb)
        FROM control.batch_task_admissions a),
      'executions',(SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.execution_id),'[]'::jsonb)
        FROM control.executions e),
      'credits',(SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.run_id,c.task_id),'[]'::jsonb)
        FROM control.workflow_run_task_credits c),
      'generations',(SELECT jsonb_agg(to_jsonb(g) ORDER BY g.task_id) FROM control.task_admission_generations g),
      'contracts',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.task_id) FROM control.publication_readiness_contracts c),
      'authorizations',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.authorization_id),'[]'::jsonb)
        FROM control.publication_preexecution_authorizations a)
    ) INTO snapshot_before;
    BEGIN
      UPDATE control.tasks SET status='in_progress' WHERE task_id='BS-UI-ZN-PATTERNS-001';
      PERFORM control.activate_batch_task_admissions(
        'CP-BATCH-READY-001',admissions,'cp-batch-v2','fixture-controller','human');
      RAISE EXCEPTION USING ERRCODE='P0004',MESSAGE='two claims unexpectedly activated';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM IS DISTINCT FROM 'Existing claim is not the dependency-ready head of its run' THEN
        RAISE;
      END IF;
    END;
    SELECT jsonb_build_object(
      'tasks',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.task_id) FROM control.tasks t
        WHERE t.task_id IN(SELECT value->>'task_id' FROM jsonb_array_elements(admissions))),
      'runs',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.run_id) FROM control.workflow_runs r),
      'admissions',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.task_id),'[]'::jsonb)
        FROM control.batch_task_admissions a),
      'executions',(SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.execution_id),'[]'::jsonb)
        FROM control.executions e),
      'credits',(SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.run_id,c.task_id),'[]'::jsonb)
        FROM control.workflow_run_task_credits c),
      'generations',(SELECT jsonb_agg(to_jsonb(g) ORDER BY g.task_id) FROM control.task_admission_generations g),
      'contracts',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.task_id) FROM control.publication_readiness_contracts c),
      'authorizations',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.authorization_id),'[]'::jsonb)
        FROM control.publication_preexecution_authorizations a)
    ) INTO snapshot_after;
    IF snapshot_after IS DISTINCT FROM snapshot_before THEN
      RAISE EXCEPTION 'two-claim rejection changed fixture authority, history, or run state';
    END IF;

    -- Separately prove that even a single claim cannot skip its unfinished head.
    BEGIN
      UPDATE control.tasks SET status='planned' WHERE task_id='BS-UI-ZN-DATA-001';
      UPDATE control.tasks SET status='in_progress' WHERE task_id='BS-UI-ZN-PATTERNS-001';
      PERFORM control.activate_batch_task_admissions(
        'CP-BATCH-READY-001',admissions,'cp-batch-v2','fixture-controller','human');
      RAISE EXCEPTION USING ERRCODE='P0004',MESSAGE='single unready downstream claim unexpectedly activated';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM IS DISTINCT FROM 'Existing claim is not the dependency-ready head of its run' THEN
        RAISE;
      END IF;
    END;
    SELECT jsonb_build_object(
      'tasks',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.task_id) FROM control.tasks t
        WHERE t.task_id IN(SELECT value->>'task_id' FROM jsonb_array_elements(admissions))),
      'runs',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.run_id) FROM control.workflow_runs r),
      'admissions',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.task_id),'[]'::jsonb)
        FROM control.batch_task_admissions a),
      'executions',(SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.execution_id),'[]'::jsonb)
        FROM control.executions e),
      'credits',(SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.run_id,c.task_id),'[]'::jsonb)
        FROM control.workflow_run_task_credits c),
      'generations',(SELECT jsonb_agg(to_jsonb(g) ORDER BY g.task_id) FROM control.task_admission_generations g),
      'contracts',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.task_id) FROM control.publication_readiness_contracts c),
      'authorizations',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.authorization_id),'[]'::jsonb)
        FROM control.publication_preexecution_authorizations a)
    ) INTO snapshot_after;
    IF snapshot_after IS DISTINCT FROM snapshot_before THEN
      RAISE EXCEPTION 'non-head rejection changed fixture authority, history, or run state';
    END IF;
    IF EXISTS(SELECT 1 FROM control.batch_task_admissions) THEN
      RAISE EXCEPTION 'invalid-claim tests left partial admissions';
    END IF;
  END;

  BEGIN
    PERFORM control.activate_batch_task_admissions(
      'CP-BATCH-READY-001',jsonb_set(admissions,'{11,contract_fingerprint}','"wrong"'),'cp-batch-v2','fixture-controller','human');
    RAISE EXCEPTION 'bad fingerprint unexpectedly activated';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Admission state drift for task %' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM control.batch_task_admissions) THEN RAISE EXCEPTION 'partial activation did not roll back'; END IF;

  PERFORM control.activate_batch_task_admissions('CP-BATCH-READY-001',admissions,'cp-batch-v2','fixture-controller','human');
  IF (SELECT count(*) FROM control.batch_task_admissions)<>12 THEN RAISE EXCEPTION '12 admissions were not persisted'; END IF;
  IF (SELECT count(*) FROM control.workflow_runs WHERE current_task_id IS NOT NULL)<>3 THEN RAISE EXCEPTION 'preserved claims were not attached'; END IF;
  IF (control.activate_batch_task_admissions('CP-BATCH-READY-001',admissions,'cp-batch-v2','fixture-controller','human')->>'idempotent')<>'true' THEN
    RAISE EXCEPTION 'activation replay was not idempotent';
  END IF;
END $$;

DO $$
DECLARE revision bigint;
DECLARE acquisition jsonb;
DECLARE credited jsonb;
DECLARE generation_before bigint;
DECLARE fingerprint_before text;
DECLARE authorization_id_before bigint;
DECLARE execution_id bigint;
DECLARE verification_run_id bigint;
BEGIN
  SELECT run_revision INTO revision FROM control.workflow_runs WHERE run_id='4f3b1b7f-0c82-4667-a420-563a43953326';
  PERFORM control.resume_admitted_workflow_run('4f3b1b7f-0c82-4667-a420-563a43953326',revision,'cp-batch-v2','fixture-controller','human');
  SELECT run_revision INTO revision FROM control.workflow_runs WHERE run_id='dc3910cd-48be-42b4-9569-4c769e633a44';
  PERFORM control.resume_admitted_workflow_run('dc3910cd-48be-42b4-9569-4c769e633a44',revision,'cp-batch-v2','fixture-controller','human');
  SELECT run_revision INTO revision FROM control.workflow_runs WHERE run_id='e362bc39-996c-451c-8fac-9a47df92715c';
  PERFORM control.resume_admitted_workflow_run('e362bc39-996c-451c-8fac-9a47df92715c',revision,'cp-batch-v2','fixture-controller','human');

  acquisition:=control.acquire_workflow_run_task('dc3910cd-48be-42b4-9569-4c769e633a44','cp-batch-v2','fixture-controller','shop-controller','runner');
  IF acquisition->>'action'<>'resume' OR acquisition->>'task_id'<>'SS-SA-EVIDENCE-001' THEN RAISE EXCEPTION 'preserved claim did not resume'; END IF;
  IF (SELECT controller_lease_token FROM control.workflow_runs WHERE run_id='dc3910cd-48be-42b4-9569-4c769e633a44')<>'shop-controller' THEN
    RAISE EXCEPTION 'current controller did not own the workflow lease';
  END IF;

  SELECT generation.input_generation,contract.contract_fingerprint,auth.authorization_id
  INTO generation_before,fingerprint_before,authorization_id_before
  FROM control.task_admission_generations generation
  JOIN control.publication_readiness_contracts contract USING(task_id)
  JOIN control.publication_preexecution_authorizations auth USING(task_id,contract_id)
  WHERE generation.task_id='SS-SA-EVIDENCE-001' AND auth.revoked_at IS NULL;

  -- Exact taskPrepare bookkeeping from runner/bs-agent.mjs.
  UPDATE control.tasks
  SET metadata = jsonb_set(
        metadata,
        '{preparation}',
        '{"parent":{"ok":true},"worktree":{"ok":true}}'::jsonb,
        true
      ),
      engine_stage = 'prepared'
  WHERE task_id = 'SS-SA-EVIDENCE-001';
  INSERT INTO control.audit_events(project_id, workstream_slug, task_id, action, source, new_value)
  SELECT project_id, workstream_slug, task_id, 'task_prepared', 'runner',
    '{"parent":{"ok":true},"worktree":{"ok":true}}'::jsonb
  FROM control.tasks WHERE task_id = 'SS-SA-EVIDENCE-001';

  UPDATE control.tasks SET metadata=metadata WHERE task_id='SS-SA-EVIDENCE-001';
  IF (SELECT input_generation FROM control.task_admission_generations WHERE task_id='SS-SA-EVIDENCE-001')<>generation_before
    OR (SELECT contract_fingerprint FROM control.publication_readiness_contracts WHERE task_id='SS-SA-EVIDENCE-001')<>fingerprint_before
    OR (SELECT revoked_at FROM control.publication_preexecution_authorizations WHERE authorization_id=authorization_id_before) IS NOT NULL
    OR NOT control.task_publication_authority_is_current('SS-SA-EVIDENCE-001') THEN
    RAISE EXCEPTION 'preparation or no-op bookkeeping revoked the admitted authority';
  END IF;

  acquisition:=control.acquire_workflow_run_task('dc3910cd-48be-42b4-9569-4c769e633a44','cp-batch-v2','fixture-controller','shop-controller','runner');
  IF acquisition->>'action'<>'resume' THEN RAISE EXCEPTION 'prepared authoritative claim did not resume'; END IF;

  execution_id:=control.start_execution('SS-SA-EVIDENCE-001','standard','fixture-model','medium',
    '/tmp/fixture-worktree','codex/fixture/task','stg',repeat('a',40));
  PERFORM control.finish_execution(execution_id,'succeeded',repeat('b',40),10,20,'fixture.log','{"fixture":true}'::jsonb);
  verification_run_id:=control.start_verification_run('SS-SA-EVIDENCE-001',execution_id,'runner','{"fixture":true}'::jsonb);
  PERFORM control.update_verification_check(verification_run_id,'fixture-required','pass',0,'fixture passed',NULL,1,
    'fixture command',true,'{"fixture":true,"worker_certified":false}'::jsonb);
  PERFORM control.finish_verification_run('SS-SA-EVIDENCE-001',verification_run_id);
  IF (SELECT input_generation FROM control.task_admission_generations WHERE task_id='SS-SA-EVIDENCE-001')<>generation_before
    OR NOT control.task_publication_authority_is_current('SS-SA-EVIDENCE-001') THEN
    RAISE EXCEPTION 'execution or verification bookkeeping revoked authority';
  END IF;
  acquisition:=control.acquire_workflow_run_task('dc3910cd-48be-42b4-9569-4c769e633a44','cp-batch-v2','fixture-controller','shop-controller','runner');
  IF acquisition->>'action'<>'resume' OR acquisition->>'task_id'<>'SS-SA-EVIDENCE-001' THEN
    RAISE EXCEPTION 'passed-but-unpublished predecessor unlocked the next ordinal';
  END IF;
  PERFORM control.complete_publication('SS-SA-EVIDENCE-001','fixture/repository',900001,'codex/fixture/task','stg',
    'https://example.invalid/fixture/900001',repeat('c',40),false,
    '{"fixture":true,"deployment_proof":false}'::jsonb);
  acquisition:=control.acquire_workflow_run_task('dc3910cd-48be-42b4-9569-4c769e633a44','cp-batch-v2','fixture-controller','shop-controller','runner');
  IF acquisition->>'action'<>'credit_completion' THEN RAISE EXCEPTION 'completed claim was not reconciled'; END IF;
  credited:=control.record_workflow_task_success('dc3910cd-48be-42b4-9569-4c769e633a44','SS-SA-EVIDENCE-001','shop-credit');
  credited:=control.record_workflow_task_success('dc3910cd-48be-42b4-9569-4c769e633a44','SS-SA-EVIDENCE-001','shop-credit');
  IF (SELECT completed_tasks FROM control.workflow_runs WHERE run_id='dc3910cd-48be-42b4-9569-4c769e633a44')<>1 THEN RAISE EXCEPTION 'completion replay double counted'; END IF;

  acquisition:=control.acquire_workflow_run_task('dc3910cd-48be-42b4-9569-4c769e633a44','cp-batch-v2','fixture-controller','shop-controller','runner');
  IF acquisition->>'action'<>'execute' OR acquisition->>'task_id'<>'SS-SA-CUSTOM-OFFER-001' THEN
    RAISE EXCEPTION 'next admitted task was not acquired after completion credit';
  END IF;
END $$;

INSERT INTO control.tasks(task_id,suit_slug,sequence,priority,title,description,status,acceptance_criteria,verification_plan,metadata,project_id,workstream_slug,retry_policy_id)
SELECT 'DIRECT-PROTECTED-001','shop-suit',999,1,'protected','fixture','planned','["accepted"]','["git diff --check"]',
  '{"allowed_paths":["apps/shop-suit/supabase/migrations/20990101000000_fixture.sql"]}',project_id,'shop-suit','standard-five'
FROM control.projects WHERE slug='building-suit';
SELECT control.refresh_publication_readiness_contract('DIRECT-PROTECTED-001','fixture');
DO $$ BEGIN
  IF control.task_publication_authority_is_current('DIRECT-PROTECTED-001') THEN
    RAISE EXCEPTION 'protected path inside owned workstream bypassed authorization';
  END IF;
END $$;
