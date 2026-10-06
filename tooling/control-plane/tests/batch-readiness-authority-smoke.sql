\set ON_ERROR_STOP on

CREATE TEMP TABLE authority_generation_checkpoint (
  task_id text PRIMARY KEY,
  input_generation bigint NOT NULL
);

INSERT INTO authority_generation_checkpoint(task_id,input_generation)
SELECT task_id,input_generation
FROM control.task_admission_generations
WHERE task_id='SAS-M1-CONFIG-001';

DO $$
DECLARE generation_before bigint;
BEGIN
  SELECT input_generation INTO generation_before
  FROM control.task_admission_generations WHERE task_id='SAS-M1-CONFIG-001';
  UPDATE control.tasks SET status=status,metadata=metadata WHERE task_id='SAS-M1-CONFIG-001';
  UPDATE control.projects SET verification_config=verification_config WHERE slug='building-suit';
  UPDATE control.workstreams SET publication_config=publication_config
  WHERE project_id=(SELECT project_id FROM control.projects WHERE slug='building-suit')
    AND slug='super-admin-suit';
  IF (SELECT input_generation FROM control.task_admission_generations WHERE task_id='SAS-M1-CONFIG-001')<>generation_before THEN
    RAISE EXCEPTION 'no-op task/project/workstream writes invalidated authority';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.assert_stale_claim_and_rebind(p_label text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  previous_generation bigint;
  current_generation bigint;
  acquisition jsonb;
BEGIN
  SELECT input_generation INTO previous_generation
  FROM authority_generation_checkpoint WHERE task_id='SAS-M1-CONFIG-001';
  SELECT input_generation INTO current_generation
  FROM control.task_admission_generations WHERE task_id='SAS-M1-CONFIG-001';

  IF current_generation<=previous_generation OR control.publication_contract_is_current('SAS-M1-CONFIG-001') THEN
    RAISE EXCEPTION '% did not invalidate the authority generation',p_label;
  END IF;

  acquisition:=control.acquire_workflow_run_task(
    'e362bc39-996c-451c-8fac-9a47df92715c','cp-batch-v2','fixture-controller','authority-controller','runner'
  );
  IF acquisition->>'action'<>'safety_stop' OR acquisition->>'reason'<>'attributed_claim_missing_or_stale' THEN
    RAISE EXCEPTION '% did not reject the stale current claim: %',p_label,acquisition;
  END IF;

  PERFORM control.refresh_publication_readiness_contract('SAS-M1-CONFIG-001','authority-regression');
  UPDATE control.batch_task_admissions admission
  SET input_generation=generation.input_generation,
      contract_fingerprint=contract.contract_fingerprint,
      verification_fingerprint=control.verification_contract_fingerprint(admission.task_id),
      updated_at=now()
  FROM control.task_admission_generations generation,
       control.publication_readiness_contracts contract
  WHERE admission.repair_id='CP-BATCH-READY-001'
    AND admission.task_id='SAS-M1-CONFIG-001'
    AND generation.task_id=admission.task_id
    AND contract.task_id=admission.task_id;
  UPDATE authority_generation_checkpoint SET input_generation=current_generation
  WHERE task_id='SAS-M1-CONFIG-001';

  acquisition:=control.acquire_workflow_run_task(
    'e362bc39-996c-451c-8fac-9a47df92715c','cp-batch-v2','fixture-controller','authority-controller','runner'
  );
  IF acquisition->>'action'<>'resume' THEN
    RAISE EXCEPTION '% could not rebind the refreshed test fixture: %',p_label,acquisition;
  END IF;
END;
$$;

UPDATE control.tasks
SET metadata=jsonb_set(metadata,'{allowed_paths}','["apps/super-admin-suit/fixture-authority.txt"]'::jsonb,true)
WHERE task_id='SAS-M1-CONFIG-001';
SELECT pg_temp.assert_stale_claim_and_rebind('task scope');

UPDATE control.tasks SET acceptance_criteria=acceptance_criteria||'"authority acceptance"'::jsonb
WHERE task_id='SAS-M1-CONFIG-001';
SELECT pg_temp.assert_stale_claim_and_rebind('task acceptance');

UPDATE control.tasks SET verification_plan=verification_plan||'"authority verification"'::jsonb
WHERE task_id='SAS-M1-CONFIG-001';
SELECT pg_temp.assert_stale_claim_and_rebind('task verification');

UPDATE control.tasks SET metadata=metadata||'{"future_authority_input":{"enabled":true}}'::jsonb
WHERE task_id='SAS-M1-CONFIG-001';
SELECT pg_temp.assert_stale_claim_and_rebind('unknown task metadata');

INSERT INTO control.requirements(suit_slug,requirement_id,title,summary,status,metadata)
VALUES('super-admin-suit','FIXTURE-AUTH-REQ','Fixture authority requirement','fixture','approved','{}');
INSERT INTO control.task_requirements(task_id,suit_slug,requirement_id)
VALUES('SAS-M1-CONFIG-001','super-admin-suit','FIXTURE-AUTH-REQ');
SELECT pg_temp.assert_stale_claim_and_rebind('linked requirement');

UPDATE control.requirements SET summary='changed authoritative requirement'
WHERE suit_slug='super-admin-suit' AND requirement_id='FIXTURE-AUTH-REQ';
SELECT pg_temp.assert_stale_claim_and_rebind('requirement content');

INSERT INTO control.decisions(suit_slug,decision_id,title,decision_text,status,source,decided_at,metadata)
VALUES('super-admin-suit','FIXTURE-AUTH-DEC','Fixture authority decision','approved fixture','approved','human',now(),'{}');
INSERT INTO control.task_decisions(task_id,suit_slug,decision_id,blocking)
VALUES('SAS-M1-CONFIG-001','super-admin-suit','FIXTURE-AUTH-DEC',true);
SELECT pg_temp.assert_stale_claim_and_rebind('linked decision');

UPDATE control.decisions SET decision_text='changed authoritative decision'
WHERE suit_slug='super-admin-suit' AND decision_id='FIXTURE-AUTH-DEC';
SELECT pg_temp.assert_stale_claim_and_rebind('decision content');

INSERT INTO control.tasks(
  task_id,suit_slug,sequence,priority,title,description,status,acceptance_criteria,
  verification_plan,metadata,project_id,workstream_slug,retry_policy_id
)
SELECT 'DEPENDENCY-PARENT-001','super-admin-suit',9999,1,'dependency parent','fixture','complete',
  '["accepted"]','["git diff --check"]','{}',project_id,'super-admin-suit','standard-five'
FROM control.projects WHERE slug='building-suit';
INSERT INTO control.task_dependencies(task_id,depends_on_task_id,dependency_type)
VALUES('SAS-M1-CONFIG-001','DEPENDENCY-PARENT-001','hard');
SELECT pg_temp.assert_stale_claim_and_rebind('task dependency link');

UPDATE control.suits SET display_name='Super Admin Suit authority fixture'
WHERE slug='super-admin-suit';
SELECT pg_temp.assert_stale_claim_and_rebind('suit registry');

UPDATE control.retry_policies SET metadata=metadata||'{"authority_fixture":true}'::jsonb
WHERE policy_id='standard-five';
SELECT pg_temp.assert_stale_claim_and_rebind('retry policy');

UPDATE control.platform_settings SET value='"critical-five"'::jsonb
WHERE setting_key='global_retry_policy';
SELECT pg_temp.assert_stale_claim_and_rebind('platform policy');

UPDATE control.projects SET verification_config=verification_config||'{"authority_fixture":true}'::jsonb
WHERE slug='building-suit';
SELECT pg_temp.assert_stale_claim_and_rebind('project policy');

UPDATE control.workstreams SET publication_config=publication_config||'{"authority_fixture":true}'::jsonb
WHERE project_id=(SELECT project_id FROM control.projects WHERE slug='building-suit')
  AND slug='super-admin-suit';
SELECT pg_temp.assert_stale_claim_and_rebind('workstream policy');

-- Protected authority remains exact, human-only, content-reviewed, and bound
-- to the current contract. Preparation does not revoke it; authority changes do.
INSERT INTO control.tasks(
  task_id,suit_slug,sequence,priority,title,description,status,acceptance_criteria,
  verification_plan,metadata,project_id,workstream_slug,retry_policy_id
)
SELECT 'PROTECTED-AUTHORITY-001','shop-suit',1001,1,'protected authority','fixture','planned',
  '["accepted"]','["git diff --check"]',
  '{"allowed_paths":["apps/shop-suit/supabase/migrations/20990102000000_fixture.sql"]}',
  project_id,'shop-suit','standard-five'
FROM control.projects WHERE slug='building-suit';
SELECT control.refresh_publication_readiness_contract('PROTECTED-AUTHORITY-001','fixture');

DO $$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    PERFORM control.authorize_protected_publication_paths(
      'PROTECTED-AUTHORITY-001',
      '["apps/shop-suit/supabase/migrations/20990102000000_fixture.sql"]',
      'fixture-protected-worker-attempt','fixture reviewed evidence',
      '{"apps/shop-suit/supabase/migrations/20990102000000_fixture.sql":{"status":"passed","checks":["database-change-review"]}}',
      'runner'
    );
  EXCEPTION WHEN OTHERS THEN
    rejected := SQLERRM LIKE '%requires a human source%';
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'non-human protected authorization was not rejected'; END IF;
END $$;

-- Ordinary future work remains executable without a batch repair. Unknown
-- controller protocol versions fail closed before a claim is mutated.
INSERT INTO control.suits(slug,display_name,stack_key,app_path,status)
VALUES
  ('ordinary-v2-fixture','Ordinary v2 fixture','ordinary-v2-fixture','tooling/control-plane','active'),
  ('ordinary-legacy-fixture','Ordinary legacy fixture','ordinary-legacy-fixture','tooling/control-plane','active');

INSERT INTO control.workstreams(
  project_id,slug,display_name,stack_key,application_path,suit_slug,verification_config,publication_config
)
SELECT project_id,'ordinary-v2-fixture','Ordinary v2 fixture','ordinary-v2-fixture',
  'tooling/control-plane','ordinary-v2-fixture','{}','{}'
FROM control.projects WHERE slug='building-suit';
INSERT INTO control.workstreams(
  project_id,slug,display_name,stack_key,application_path,suit_slug,verification_config,publication_config
)
SELECT project_id,'ordinary-legacy-fixture','Ordinary legacy fixture','ordinary-legacy-fixture',
  'tooling/control-plane','ordinary-legacy-fixture','{}','{}'
FROM control.projects WHERE slug='building-suit';

SELECT control.create_task_with_publication_contract(
  'building-suit','ordinary-v2-fixture','ORDINARY-FUTURE-001',1,1,'ordinary future task','fixture',
  'feature','normal','standard','["accepted"]','["git diff --check"]','standard-five',
  '{"allowed_paths":["tooling/control-plane/tests/ordinary-future.test.mjs"]}'
);

DO $$
DECLARE run jsonb;
DECLARE acquisition jsonb;
DECLARE credit jsonb;
BEGIN
  run:=control.start_workflow_run('ordinary-v2-fixture',2);
  acquisition:=control.acquire_workflow_run_task(
    (run->>'run_id')::uuid,'cp-batch-v999','ordinary-controller','ordinary-lease','runner'
  );
  IF acquisition->>'reason'<>'unsupported_controller_protocol'
    OR (SELECT status FROM control.tasks WHERE task_id='ORDINARY-FUTURE-001')<>'planned' THEN
    RAISE EXCEPTION 'unknown controller protocol did not fail closed without claiming';
  END IF;
  acquisition:=control.acquire_workflow_run_task(
    (run->>'run_id')::uuid,'cp-batch-v2','ordinary-controller','ordinary-lease','runner'
  );
  IF acquisition->>'action'<>'execute' OR acquisition->>'task_id'<>'ORDINARY-FUTURE-001' THEN
    RAISE EXCEPTION 'ordinary non-batch task was not executable: %',acquisition;
  END IF;
  UPDATE control.tasks SET status='complete',engine_stage='complete' WHERE task_id='ORDINARY-FUTURE-001';
  credit:=control.record_workflow_task_success(
    (run->>'run_id')::uuid,'ORDINARY-FUTURE-001','ordinary-future-credit'
  );
  IF credit->>'idempotent'<>'false' THEN RAISE EXCEPTION 'ordinary attributed credit was not recorded'; END IF;
  credit:=control.record_workflow_task_success(
    (run->>'run_id')::uuid,'ORDINARY-FUTURE-001','ordinary-future-credit'
  );
  IF credit->>'idempotent'<>'true' THEN RAISE EXCEPTION 'ordinary attributed credit replay was not idempotent'; END IF;

  run:=control.start_workflow_run('ordinary-legacy-fixture',2);
  credit:=control.record_workflow_task_success((run->>'run_id')::uuid);
  IF credit->>'legacy_unattributed'<>'true' OR credit->>'completed_tasks'<>'1' THEN
    RAISE EXCEPTION 'legacy ordinary completion compatibility was not preserved';
  END IF;
END $$;

SELECT control.authorize_protected_publication_paths(
  'PROTECTED-AUTHORITY-001',
  '["apps/shop-suit/supabase/migrations/20990102000000_fixture.sql"]',
  'fixture-protected-human','fixture reviewed evidence',
  '{"apps/shop-suit/supabase/migrations/20990102000000_fixture.sql":{"status":"passed","checks":["database-change-review"]}}',
  'human'
);

DO $$
DECLARE authorization_id_before bigint;
BEGIN
  SELECT authorization_id INTO authorization_id_before
  FROM control.publication_preexecution_authorizations
  WHERE task_id='PROTECTED-AUTHORITY-001' AND revoked_at IS NULL;
  IF authorization_id_before IS NULL OR NOT control.task_publication_authority_is_current('PROTECTED-AUTHORITY-001') THEN
    RAISE EXCEPTION 'reviewed protected authority was not current';
  END IF;
  UPDATE control.tasks
  SET metadata=jsonb_set(metadata,'{preparation}','{"fixture":true}'::jsonb,true),engine_stage='prepared'
  WHERE task_id='PROTECTED-AUTHORITY-001';
  IF NOT control.task_publication_authority_is_current('PROTECTED-AUTHORITY-001')
    OR (SELECT revoked_at FROM control.publication_preexecution_authorizations WHERE authorization_id=authorization_id_before) IS NOT NULL THEN
    RAISE EXCEPTION 'preparation revoked protected authority';
  END IF;
  UPDATE control.tasks SET acceptance_criteria=acceptance_criteria||'"changed"'::jsonb
  WHERE task_id='PROTECTED-AUTHORITY-001';
  IF control.publication_contract_is_current('PROTECTED-AUTHORITY-001') THEN
    RAISE EXCEPTION 'protected authority input change remained current';
  END IF;
  PERFORM control.refresh_publication_readiness_contract('PROTECTED-AUTHORITY-001','authority-change');
  IF (SELECT revoked_at FROM control.publication_preexecution_authorizations WHERE authorization_id=authorization_id_before) IS NULL
    OR control.task_publication_authority_is_current('PROTECTED-AUTHORITY-001') THEN
    RAISE EXCEPTION 'changed protected authority was not revoked and rejected';
  END IF;
END $$;
