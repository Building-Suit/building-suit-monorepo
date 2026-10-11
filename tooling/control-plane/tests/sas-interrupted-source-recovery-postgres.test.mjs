import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
const container=process.env.CP_EGRESS_TEST_CONTAINER,db='cp_sas_source_recovery_114_'+process.pid+'_'+Date.now()
const run='2518c051-fb28-4641-ae03-c046d7c30807',release='1b52d2ea4920dfce74aca816c10618abde09af945aae4bc7e7761566fa5cf308'
const call=`SELECT control.adopt_lifecycle_recovery('${run}',2,'${release}');`
const q=sql=>{const r=spawnSync('docker',['exec','-i',container,'psql','-U','postgres','-d',db,'-XqAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stderr);return r.stdout.trim().split('\n').filter(Boolean).at(-1)}
const state=()=>JSON.parse(q(`SELECT jsonb_build_object('e',(SELECT to_jsonb(e) FROM control.executions e WHERE execution_id=321),'ops',(SELECT count(*) FROM control.runtime_operations WHERE task_id='SAS-M1-CUSTOM-OFFER-001'),'credits',(SELECT count(*) FROM control.workflow_run_task_credits WHERE run_id='${run}'),'attempts',control.product_retry_accounting('SAS-M1-CUSTOM-OFFER-001'));`))
test('schema113 interrupted SAS recovery is guarded, same-execution, durable and replay-safe',{skip:!process.env.CP_SAS_RECOVERY_BACKUP},()=>{
 assert.match(container??'',/^cp-.*disposable[-a-z0-9]*$/);assert.match(db??'',/^cp_sas_source_recovery_114_/)
 const created=spawnSync('docker',['exec',container,'createdb','-U','postgres',db],{encoding:'utf8'});assert.equal(created.status,0,created.stderr)
 try {
 const restored=spawnSync('docker',['exec','-i',container,'pg_restore','-U','postgres','-d',db,'--no-owner','--no-acl','--exit-on-error'],{input:readFileSync(process.env.CP_SAS_RECOVERY_BACKUP),encoding:'utf8',timeout:120000});assert.equal(restored.status,0,restored.stderr)
 q("UPDATE control.tasks SET status='failed' WHERE task_id='SAS-M1-CUSTOM-OFFER-001';UPDATE control.workflow_runs SET current_task_id='SAS-M1-CUSTOM-OFFER-001' WHERE run_id='2518c051-fb28-4641-ae03-c046d7c30807'")
 const before=state();assert.equal(before.e.status,'failed');assert.equal(before.attempts.consumed,0)
 q(readFileSync(new URL('../sql/114_sas_interrupted_source_recovery.sql',import.meta.url),'utf8'))
 for(const change of [
  `UPDATE control.workflow_runs SET stop_requested=true WHERE run_id='${run}'`,
  `UPDATE control.workflow_runs SET maintenance_requested=true WHERE run_id='${run}'`,
  `UPDATE control.workflow_runs SET max_tasks=8 WHERE run_id='${run}'`,
  `UPDATE control.recovery_states SET status='active',error_code='publication_security_sensitive_operator_wait' WHERE current_task_id='SAS-M1-CUSTOM-OFFER-001'`,
  `UPDATE control.executions SET metadata=jsonb_set(metadata,'{actual_worker_result,error}','"product_failed"') WHERE execution_id=321`,
  `UPDATE control.executions SET metadata=metadata-'restore111_safety_stop' WHERE execution_id=321`,
  `UPDATE control.tasks SET status='blocked' WHERE task_id='SAS-M1-CUSTOM-OFFER-001'`,
  `UPDATE control.runtime_operations SET status='pending' WHERE task_id='SAS-M1-CUSTOM-OFFER-001' AND action='task-run'`,
 ]){
  const result=JSON.parse(q(`BEGIN;${change};${call}ROLLBACK;`));assert.notEqual(result.interrupted_execution_resumed,true,change)
 }
 const result=JSON.parse(q(call));assert.equal(result.interrupted_execution_resumed,true);assert.equal(result.execution_id,321)
 const after=state();assert.equal(after.e.status,'running');for(const k of ['execution_id','attempt','worktree_path','branch_name','parent_sha','started_at','resolved_retry_policy'])assert.deepEqual(after.e[k],before.e[k]);assert.equal(after.credits,before.credits);assert.equal(after.ops,before.ops+1)
 assert.equal(q("SELECT count(*) FROM control.task_events WHERE task_id='SAS-M1-CUSTOM-OFFER-001' AND event_type='interrupted_source_worker_resumed' AND payload#>>'{interrupted_execution,status}'='failed' AND payload#>>'{interrupted_execution,metadata,actual_worker_result,error}'='worker_process_interrupted'"),'1')
 assert.notEqual(JSON.parse(q(call)).interrupted_execution_resumed,true);assert.equal(state().ops,after.ops)
 // The second preserved worker can be resumed only after native queue acquisition.
 q(`UPDATE control.workflow_runs SET current_task_id='SAS-M1-AUDIT-001' WHERE run_id='${run}';UPDATE control.tasks SET status='failed' WHERE task_id='SAS-M1-AUDIT-001'`)
 assert.equal(JSON.parse(q(call)).execution_id,322)
 assert.equal(q("SELECT count(*) FROM control.executions WHERE execution_id IN(321,322) AND status='running' AND attempt=1"),'2')
 assert.equal(q(`SELECT completed_tasks FROM control.workflow_runs WHERE run_id='${run}'`),'3')
 } finally {const dropped=spawnSync('docker',['exec',container,'dropdb','--force','-U','postgres',db],{encoding:'utf8'});assert.equal(dropped.status,0,dropped.stderr)}
})
