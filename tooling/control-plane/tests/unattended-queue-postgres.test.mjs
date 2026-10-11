import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync,readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {exactMigrationTransaction,fingerprintSchema,schemaFingerprintSql} from '../runner/schema-provenance.mjs'

test('108 -> 111 preserves history; one owner explicitly changes only future policy; worker cannot approve; revoke fails closed', {skip:!process.env.CP_EGRESS_TEST_CONTAINER,timeout:180000},t=>{
 const container=process.env.CP_EGRESS_TEST_CONTAINER;assert.match(container,/^cp-.*disposable[-a-z0-9]*$/)
 const database='cp_queue_upgrade_'+process.pid+'_'+Date.now(),directory=new URL('../sql/',import.meta.url)
 const run=(args,input)=>spawnSync('docker',['exec','-i',container,...args],{input,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024})
 const query=sql=>{const r=run(['psql','-U','postgres','-d',database,'-XqAt','-v','ON_ERROR_STOP=1'],sql);assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const json=sql=>JSON.parse(query(sql)),runId='a0000000-0000-4000-8000-000000000111',actor='a0000000-0000-4000-8000-000000000112'
 assert.equal(run(['createdb','-U','postgres',database]).status,0)
 try {
  for(const name of readdirSync(directory).filter(n=>/^\d{3}_.*\.sql$/.test(n)&&Number(n.slice(0,3))<=108).sort())query(readFileSync(new URL(name,directory),'utf8'))
  query(`INSERT INTO control.suits(slug,display_name,stack_key,status) VALUES('queue-proof','Queue proof','automation-suit','active');
INSERT INTO control.projects(slug,display_name,repository_path,github_repository,integration_branch,local_repository_root,worktree_root,allowed_publication_paths,active) VALUES('queue-proof','Queue proof','Disposable/Queue','Disposable/Queue','stg','/disposable/repository','/disposable/worktrees','["src/"]',true);
INSERT INTO control.workstreams(project_id,slug,display_name,stack_key,application_path,suit_slug,publication_config) SELECT project_id,'queue-proof','Queue proof','automation-suit','src/','queue-proof','{"merge_authorized":false,"deployment_authorized":false,"hosted_database_changes_authorized":false,"review_required_before_integration":true}' FROM control.projects WHERE slug='queue-proof';
INSERT INTO control.retry_policies(policy_id,display_name,max_attempts,attempt_profiles) VALUES('queue-three','Existing three',3,'["standard","standard","deep"]');
INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,sequence,title,status,verification_plan,metadata,retry_policy_id) SELECT 'QUEUE-'||n,'queue-proof',project_id,'queue-proof',n,'Queue proof '||n,CASE WHEN n=1 THEN 'failed' ELSE 'planned' END,'["git diff --check"]','{"allowed_paths":["src/**"]}','queue-three' FROM control.projects CROSS JOIN generate_series(1,2)n WHERE slug='queue-proof';
INSERT INTO control.executions(task_id,attempt,model_profile,status,branch_name,parent_branch,parent_sha) VALUES('QUEUE-1',1,'standard','failed','codex/automation-suit/preserved','stg',repeat('a',40));
INSERT INTO control.workflow_runs(run_id,suit_slug,project_id,workstream_slug,max_tasks,current_task_id,controller_protocol,controller_fingerprint) SELECT '${runId}','queue-proof',project_id,'queue-proof',2,'QUEUE-1','cp-batch-v2','queue-proof-controller' FROM control.projects WHERE slug='queue-proof';
INSERT INTO control.bounded_verification_plans(run_id,task_id,ordinal,plan,input_snapshot,plan_fingerprint,source_sha) SELECT '${runId}',task_id,sequence,'{}','{}',repeat('a',64),repeat('a',40) FROM control.tasks WHERE suit_slug='queue-proof';
INSERT INTO control.operator_actors(actor_id,identity_provider) VALUES('${actor}','local-n8n');`)
  const history=()=>query("SELECT jsonb_build_object('runs',(SELECT jsonb_agg(to_jsonb(x) ORDER BY run_id) FROM control.workflow_runs x),'tasks',(SELECT jsonb_agg(to_jsonb(x) ORDER BY task_id) FROM control.tasks x),'executions',(SELECT jsonb_agg(to_jsonb(x) ORDER BY execution_id) FROM control.executions x),'dependencies',(SELECT jsonb_agg(to_jsonb(x)) FROM control.task_dependencies x),'approvals',(SELECT jsonb_agg(to_jsonb(x)) FROM control.operator_authority_events x),'prs',(SELECT jsonb_agg(to_jsonb(x)) FROM control.pull_requests x))")
  const before=history(),schema=fingerprintSchema(json(schemaFingerprintSql)),projectRef='a'.repeat(20),baselineId='a0000000-0000-4000-8000-000000000108',sourceCommit='1a4f32436ec065e632ea5cc5c8fdce493875e41a'
  query(`INSERT INTO control.control_schema_adoption_baselines(baseline_id,project_ref,source_sha,canonical_migrations,canonical_schema_fingerprint,live_schema_fingerprint,active_release_id,note) VALUES('${baselineId}','${projectRef}','${sourceCommit}','[]','${schema}','${schema}',repeat('a',64),'Schema adoption snapshot; pre-ledger historical application order is not asserted.')`)
  const migrationName='111_unattended_bounded_queue.sql',sql=readFileSync(new URL(migrationName,directory),'utf8'),checksum=createHash('sha256').update(sql).digest('hex')
  const transaction=exactMigrationTransaction({migrationName,sql,expectedChecksum:checksum,sourceCommit,projectRef,baselineId});query(transaction);assert.equal(history(),before)
  assert.equal(query("SELECT count(*) FROM control.migration_release_ledger WHERE migration_name ~ '^(109|110)_'"),'0')
  const offer=json(`SELECT control.unattended_queue_offer('${runId}')`);assert.deepEqual(offer.tasks.map(t=>[t.task_id,t.assign_five,t.effective_policy.max_attempts]),[['QUEUE-1',false,3],['QUEUE-2',true,5]])
  for(const role of ['bs_runtime_executor','bs_control_observer','bs_control_verifier','bs_control_app'])assert.equal(query(`SELECT has_function_privilege('${role}','control.resolve_authenticated_operator_gate(uuid,uuid,text,text)','EXECUTE')`),'f')
  assert.equal(query("SELECT has_table_privilege('bs_runtime_executor','control.unattended_queue_waits','INSERT,UPDATE,DELETE')"),'f')
  for(const role of ['bs_runtime_executor','bs_control_operator'])assert.equal(query(`SELECT has_function_privilege('${role}','control.acquire_workflow_run_task_before_unattended_queue(uuid,text,text,text,text)','EXECUTE')`),'f')
  query(`SET ROLE bs_control_operator;SELECT control.resolve_authenticated_operator_gate('${actor}','${runId}','${offer.gate_fingerprint}','approve');SELECT control.resolve_authenticated_operator_gate('${actor}','${runId}','${offer.gate_fingerprint}','approve');RESET ROLE`)
  assert.equal(query("SELECT count(*) FROM control.operator_authority_events WHERE action='unattended-queue-release' AND response='approve'"),'1')
  assert.deepEqual(json("SELECT jsonb_agg(jsonb_build_array(task_id,retry_policy_id) ORDER BY task_id) FROM control.tasks WHERE suit_slug='queue-proof'"),[['QUEUE-1','queue-three'],['QUEUE-2','standard-five']])
  assert.equal(query("SELECT attempt||':'||branch_name FROM control.executions WHERE task_id='QUEUE-1'"),'1:codex/automation-suit/preserved')
  assert.equal(query(`SELECT max_tasks||':'||completed_tasks FROM control.workflow_runs WHERE run_id='${runId}'`),'2:0')
  assert.equal(query(`SELECT control.unattended_queue_task_current('${runId}','QUEUE-1') AND control.unattended_queue_task_current('${runId}','QUEUE-2')`),'t')
  // A configuration source file requires its own genuine protected gate.
  // Test the proposed single-function amendment only in this disposable DB.
  query("UPDATE control.tasks SET status='passed' WHERE task_id='QUEUE-2';UPDATE control.workflow_runs SET current_task_id='QUEUE-2' WHERE run_id='"+runId+"'")
  const executionId=query("INSERT INTO control.executions(task_id,attempt,status,model_profile,model_name,reasoning_effort,branch_name,parent_branch,parent_sha,worktree_path) VALUES('QUEUE-2',1,'succeeded','standard','gpt-6.1-sol','medium','codex/automation-suit/queue-2','stg',repeat('a',40),'/disposable/queue-2') RETURNING execution_id")
  query("INSERT INTO control.verification_runs(execution_id,status,metadata) VALUES("+executionId+",'passed','{\"verified_state\":{\"fingerprint\":\"state\",\"files\":[{\"file\":\"src/supabase/config.toml\",\"object\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}]}}')")
  query("INSERT INTO control.failures(task_id,execution_id,stage,error_code,summary,metadata) VALUES('QUEUE-2',"+executionId+",'publication','publication_protected_path_operator_wait','Fixture source configuration hold','{\"protected_paths\":[\"src/supabase/config.toml\"]}')")
  query(`SELECT control.reconcile_ordinary_run_task('${runId}','QUEUE-2')`)
  const protectedOffer=()=>json(`SELECT control.operator_gate_offers('${runId}')`).find(o=>o.action==='protected-publication')
  assert.equal(protectedOffer(),undefined)
  const originalGateDefinition=query("SELECT pg_get_functiondef('control.operator_task_gate_snapshot(uuid)'::regprocedure)")
  // Restore the saved passed execution only after a real changed gate input.
  // QUEUE-1 represents the already completed predecessor for this subcase.
  query("UPDATE control.tasks SET status='complete' WHERE task_id='QUEUE-1'")
  const recordGateCondition=condition=>query(`SET ROLE bs_runtime_executor;SELECT control.record_recovery_condition(p_resume_identity=>'task:QUEUE-2',p_idempotency_key=>'gate-input:${condition}',p_failure_class=>'operator-wait',p_error_code=>'publication_protected_path_operator_wait',p_next_action=>'wait-operator',p_recoverable=>true,p_source=>'runner',p_current_task_id=>'QUEUE-2',p_execution_id=>${executionId},p_condition=>'${JSON.stringify({protected_source_gate_available:condition==='available'})}'::jsonb);RESET ROLE`)
  recordGateCondition('missing')
  assert.equal(query(`SET ROLE bs_runtime_executor;SELECT control.park_unattended_queue_task('${runId}','QUEUE-2');RESET ROLE`),'t')
  assert.equal(json(`SET ROLE bs_runtime_executor;SELECT control.acquire_workflow_run_task('${runId}','cp-batch-v2','queue-proof-controller','queue-test-lease');RESET ROLE`).acquired,false,'same blocked input must not restart the task')
  query(readFileSync(new URL('../protected-config-offer-amendment.sql',import.meta.url),'utf8'))
  recordGateCondition('available')
  const resumed=json(`SET ROLE bs_runtime_executor;SELECT control.acquire_workflow_run_task('${runId}','cp-batch-v2','queue-proof-controller','queue-test-lease');RESET ROLE`)
  assert.equal(resumed.acquired,true);assert.equal(resumed.task_id,'QUEUE-2')
  assert.equal(query("SELECT status FROM control.tasks WHERE task_id='QUEUE-2'"),'passed','native acquisition restores the saved passed state')
  assert.equal(query("SELECT count(*) FROM control.executions WHERE task_id='QUEUE-2'"),'1','resuming publication never starts another implementation')
  const configOffer=protectedOffer();assert.ok(configOffer,query(`SELECT control.operator_task_gate_snapshot('${runId}')`));assert.deepEqual(configOffer.protected_files.map(f=>f.path),['src/supabase/config.toml'])
  query(`SET ROLE bs_control_operator;SELECT control.resolve_authenticated_operator_gate('${actor}','${runId}','${configOffer.gate_fingerprint}','approve');RESET ROLE`)
  assert.equal(json(`SELECT control.current_protected_publication_authority('QUEUE-2')`).authorized,true)
  assert.equal(json(`SELECT control.current_run_publication_authority('QUEUE-2')`).authorized,true,'ordinary frozen authority remains current beside protected source approval')
  assert.equal(query(`SELECT control.unattended_queue_task_current('${runId}','QUEUE-2')`),'t')
  assert.equal(query("SELECT count(*) FROM control.operator_authority_events WHERE action='unattended-queue-release' AND response='approve'"),'1','no repeated queue approval')
  query(originalGateDefinition)
  assert.equal(json(`SELECT control.current_protected_publication_authority('QUEUE-2')`).authorized,false,'rollback restores the protected config hold, without deleting the owner receipt')
  assert.equal(query("SELECT count(*) FROM control.operator_authority_events WHERE action='protected-publication' AND response='approve'"),'1')
  assert.equal(query(`SELECT control.unattended_queue_task_current('${runId}','QUEUE-2')`),'t')
  query(`UPDATE control.tasks SET status='failed' WHERE task_id='QUEUE-1';UPDATE control.tasks SET status='planned' WHERE task_id='QUEUE-2';UPDATE control.workflow_runs SET current_task_id='QUEUE-1' WHERE run_id='${runId}'`)
  // Stale authority parks only its own task. No missing proof is interpreted as PASS.
  query("UPDATE control.tasks SET title=title||' changed' WHERE task_id='QUEUE-1'")
  const stale=json(`SET ROLE bs_runtime_executor;SELECT control.acquire_workflow_run_task('${runId}','cp-batch-v2','queue-proof-controller','queue-test-lease');RESET ROLE`);assert.equal(stale.reason,'queue_task_authority_stale')
  assert.equal(query(`SET ROLE bs_runtime_executor;SELECT control.park_unattended_queue_task('${runId}','QUEUE-1');RESET ROLE`),'t')
  assert.equal(query(`SELECT current_task_id IS NULL FROM control.workflow_runs WHERE run_id='${runId}'`),'t')
  assert.equal(query("SELECT count(*) FROM control.workflow_run_task_credits"),'0')
  query(`SET ROLE bs_control_operator;SELECT control.resolve_authenticated_operator_gate('${actor}','${runId}','${offer.gate_fingerprint}','revoke');RESET ROLE`)
  assert.equal(query(`SELECT control.unattended_queue_grant('${runId}') IS NULL`),'t')
  assert.equal(json(`SET ROLE bs_runtime_executor;SELECT control.acquire_workflow_run_task('${runId}','cp-batch-v2','queue-proof-controller','queue-test-lease');RESET ROLE`).reason,'queue_authority_inactive')
  query(`UPDATE control.workflow_runs SET current_task_id='QUEUE-2' WHERE run_id='${runId}'`)
  assert.equal(json(`SET ROLE bs_runtime_executor;SELECT control.current_run_publication_authority('QUEUE-2');RESET ROLE`).reason,'queue_authority_inactive_or_stale')
  const replay=run(['psql','-U','postgres','-d',database,'-XqAt','-v','ON_ERROR_STOP=1'],transaction);assert.notEqual(replay.status,0);assert.match(replay.stderr,/migration_already_recorded_requires_checksum_reconciliation/)
  t.diagnostic(JSON.stringify({schema_from:108,schema_to:111,excluded:[109,110],checksum,history_unchanged:true,started_policy_preserved:true,future_five_explicit:true,worker_approval_denied:true,revocation:true,stale_task_parked_without_credit:true}))
 }finally{assert.equal(run(['dropdb','--force','-U','postgres',database]).status,0)}
})
