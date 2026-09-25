\set ON_ERROR_STOP on

BEGIN;

INSERT INTO control.projects(slug,display_name,repository_path,github_repository,local_repository_root,worktree_root,retry_policy_id,active)
VALUES('sandbox-project','Sandbox Project','sandbox/repository','sandbox/repository','.','.local/worktrees','cheap-three',true);

INSERT INTO control.suits(slug,display_name,stack_key,status,metadata)
VALUES('sandbox-project-backend','Sandbox backend','sandbox-backend','active','{"fixture":true}');

INSERT INTO control.workstreams(project_id,slug,display_name,stack_key,suit_slug)
SELECT project_id,'backend','Backend','sandbox-backend','sandbox-project-backend' FROM control.projects WHERE slug='sandbox-project';

INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,title,status,verification_plan)
SELECT 'SANDBOX-001','sandbox-project-backend',project_id,'backend','Disposable sandbox task','planned','["focused"]'
FROM control.projects WHERE slug='sandbox-project';

INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,title,status,verification_plan,sequence)
SELECT 'SANDBOX-002','sandbox-project-backend',project_id,'backend','Serialized sibling task','planned','["focused"]',2000
FROM control.projects WHERE slug='sandbox-project';

DO $do$
DECLARE packet jsonb; claimed jsonb; execution_id bigint; run_id bigint; retry jsonb; workflow jsonb;
BEGIN
  packet:=control.generic_task_packet('SANDBOX-001');
  IF packet->'retry_policy'->>'policy_id'<>'cheap-three' THEN RAISE EXCEPTION 'project retry policy did not resolve'; END IF;
  claimed:=control.claim_next_task('sandbox-project-backend','runner');
  IF claimed->'task'->>'status'<>'in_progress' THEN RAISE EXCEPTION 'claim failed'; END IF;
  IF EXISTS(SELECT 1 FROM control.next_ready_task('sandbox-project-backend')) THEN RAISE EXCEPTION 'serialized workstream exposed a second task'; END IF;
  workflow:=control.start_workflow_run('sandbox-project-backend',5);
  IF workflow->>'started'<>'true' THEN RAISE EXCEPTION 'bounded workflow did not start'; END IF;
  BEGIN
    PERFORM control.start_workflow_run('sandbox-project-backend',21);
    RAISE EXCEPTION 'project run safety bound was not enforced';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='project run safety bound was not enforced' THEN RAISE; END IF;
  END;
  execution_id:=control.start_execution('SANDBOX-001','fast','sandbox-model','low','/tmp/sandbox','codex/sandbox-backend/sandbox-001','stg',repeat('a',40));
  PERFORM control.finish_execution(execution_id,'succeeded',NULL,1,1,'/tmp/sandbox.log','{"simulated":true}');
  run_id:=control.start_verification_run('SANDBOX-001',execution_id,'runner','{"simulated":true}');
  PERFORM control.queue_verification_check(run_id,'focused','true',true);
  PERFORM control.update_verification_check(run_id,'focused','running');
  PERFORM control.update_verification_check(run_id,'focused','fail',1,'expected sandbox failure','/tmp/focused.log',1,'false',true);
  PERFORM control.finish_verification_run('SANDBOX-001',run_id);
  PERFORM control.reopen_verification('SANDBOX-001','human','sandbox infrastructure recovered');
  run_id:=control.start_verification_run('SANDBOX-001',execution_id,'runner','{"simulated":true}');
  PERFORM control.queue_verification_check(run_id,'focused','true',true);
  PERFORM control.update_verification_check(run_id,'focused','pass',0,'same execution reverified','/tmp/focused.log',1,'true',true);
  PERFORM control.finish_verification_run('SANDBOX-001',run_id);
  IF (SELECT count(*) FROM control.executions WHERE task_id='SANDBOX-001')<>1 THEN RAISE EXCEPTION 'reverify consumed an execution'; END IF;
  PERFORM control.transition_task('SANDBOX-001','verification','human','exercise retry after another verification failure','passed');
  run_id:=control.start_verification_run('SANDBOX-001',execution_id,'runner','{"simulated":true}');
  PERFORM control.queue_verification_check(run_id,'focused','true',true);
  PERFORM control.update_verification_check(run_id,'focused','fail',1,'expected second sandbox failure','/tmp/focused.log',1,'false',true);
  PERFORM control.finish_verification_run('SANDBOX-001',run_id);
  retry:=control.start_retry_execution('SANDBOX-001',3,'standard','sandbox-model','medium');
  IF (retry->>'attempt')::int<>2 THEN RAISE EXCEPTION 'retry did not create attempt two'; END IF;
  PERFORM control.finish_execution((retry->>'execution_id')::bigint,'succeeded',NULL,1,1,'/tmp/retry.log','{"simulated":true}');
  run_id:=control.start_verification_run('SANDBOX-001',(retry->>'execution_id')::bigint,'runner','{"simulated":true}');
  PERFORM control.queue_verification_check(run_id,'focused','true',true);
  PERFORM control.update_verification_check(run_id,'focused','pass',0,'sandbox pass','/tmp/focused.log',1,'true',true);
  PERFORM control.finish_verification_run('SANDBOX-001',run_id);
  IF (SELECT status FROM control.tasks WHERE task_id='SANDBOX-001')<>'passed' THEN RAISE EXCEPTION 'reverification did not pass'; END IF;
  PERFORM control.complete_publication('SANDBOX-001','sandbox/repository',1,'codex/sandbox-backend/sandbox-001','stg','https://example.invalid/pr/1',repeat('b',40),true,'{"simulated":true}');
  IF (SELECT status FROM control.tasks WHERE task_id='SANDBOX-001')<>'complete' THEN RAISE EXCEPTION 'publication simulation did not complete'; END IF;
  INSERT INTO control.failures(project_id,workstream_slug,task_id,execution_id,attempt,stage,summary,retry_available,legal_actions)
  SELECT project_id,workstream_slug,task_id,(retry->>'execution_id')::bigint,2,'sandbox','visible failure fixture',false,'["inspect"]' FROM control.tasks WHERE task_id='SANDBOX-001';
  IF NOT EXISTS(SELECT 1 FROM control.failures WHERE task_id='SANDBOX-001') THEN RAISE EXCEPTION 'failure center record missing'; END IF;
END
$do$;

-- Fixture rollback proves the complete state path without retaining sandbox data.
ROLLBACK;
