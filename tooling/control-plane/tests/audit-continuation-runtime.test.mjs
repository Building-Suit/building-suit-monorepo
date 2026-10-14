import test from 'node:test'
import assert from 'node:assert/strict'
import {healthQuery} from '../runner/dot-health-collector.mjs'
import {recoveryErrorEnvelope} from '../runner/recovery-error.mjs'
import {lifecycleOutcome,activityState} from '../runner/run-lifecycle.mjs'
const env={BS_CONTROL_DB_HOST:'synthetic',BS_CONTROL_DB_PORT:'5432',BS_CONTROL_DB_USER:'synthetic',BS_CONTROL_DB_NAME:'synthetic'}
for(const code of ['42501','42883','22023'])test(`actual health query preserves non-transient ${code}`,()=>{
 let args
 assert.throws(()=>healthQuery('SELECT synthetic();',env,(_program,a)=>{args=a;return {status:1,stderr:`ERROR: ${code}: synthetic denial`}}),error=>{
  const result=recoveryErrorEnvelope(error,'health');assert.equal(result.sqlstate,code);assert.equal(result.classification.recoverable,false);assert.equal(result.retry_after_ms,null);return true
 })
 assert.ok(args.includes('VERBOSITY=verbose'))
})
test('lifecycle outcome never reports running or an incomplete limit as complete',()=>{
 assert.equal(lifecycleOutcome({status:'running'}),'ACTIVE')
 assert.equal(lifecycleOutcome({status:'limit_reached',completed_tasks:2,max_tasks:3}),'CLOSED')
 assert.equal(lifecycleOutcome({status:'limit_reached',completed_tasks:3,max_tasks:3}),'COMPLETE')
 for(const status of ['failed','cancelled','superseded'])assert.equal(lifecycleOutcome({status}),status.toUpperCase())
 for(const status of ['stopped','finished','closed'])assert.equal(lifecycleOutcome({status}),'CLOSED')
 assert.equal(activityState('WAITING_ADMISSION'),'RECONCILING')
 assert.equal(activityState('COMPLETE'),'IDLE')
 assert.equal(activityState('STUCK',true),'IDLE')
})

test('operator runner requires a separate database capability and actor',async()=>{
 const {resolveOperatorCommand}=await import('../runner/operator-gate.mjs')
 const args=['a0000000-0000-4000-8000-000000000002','a'.repeat(32),'approve','a0000000-0000-4000-8000-000000000001']
 assert.throws(()=>resolveOperatorCommand(args,env),/dedicated_operator_credentials_required/)
 assert.throws(()=>resolveOperatorCommand(args.slice(0,3),env),/authenticated_operator_command_required/)
 let routed
 const reply=resolveOperatorCommand(args,{...env,BS_OPERATOR_DB_USER:'synthetic-operator'},(sql,e)=>{routed=e;assert.match(sql,/resolve_authenticated_operator_gate/);return {ok:true}})
 assert.equal(reply.ok,true);assert.equal(routed.BS_CONTROL_DB_USER,'synthetic-operator')
})

for(const command of ['run-check','run-acquire-task','run-complete-task','run-finish','task-supervise'])test(`actual CLI ${command} preserves PostgreSQL denial`,async()=>{
 const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs')
 const {spawnSync}=await import('node:child_process')
 const os=await import('node:os'),path=await import('node:path')
 const directory=mkdtempSync(path.join(os.tmpdir(),'cp-typed-denial-'))
 try{
  writeFileSync(path.join(directory,'psql'),'#!/bin/sh\ncat >/dev/null\nprintf "ERROR: 42501: synthetic permission denied\\n" >&2\nexit 1\n',{mode:0o755})
  const run='a0000000-0000-4000-8000-000000000001'
  const args={ 'run-check':[run],'run-acquire-task':[run,'cp-batch-v2','fixture','fixture'],'run-complete-task':[run,'CP-TYPED-001','fixture'],'run-finish':[run,'cancelled'],'task-supervise':['CP-TYPED-001'] }[command]
  const child=spawnSync(process.execPath,[new URL('../runner/bs-agent.mjs',import.meta.url).pathname,command,...args],{env:{...process.env,PATH:directory+':'+process.env.PATH},encoding:'utf8',timeout:15000})
  assert.equal(child.status,1,child.stderr)
  const result=JSON.parse(child.stdout)
  assert.equal(result.sqlstate,'42501');assert.equal(result.retry_after_ms,null);assert.equal(result.classification.recoverable,false)
 }finally{rmSync(directory,{recursive:true,force:true})}
})

// A real unknown verifier outcome must remain bounded and investigable.
test('unknown verifier outcome stays recoverable without product retry authority',async()=>{
 const {classifySupervisorFailure}=await import('../runner/task-supervisor.mjs')
 const result=classifySupervisorFailure({command:'task-verify',payload:{error:'verification_failed',classification:{failure_class:'unknown-outcome',recovery_action:'reconcile'}},attempt:1,maxAttempts:5})
 assert.equal(result.kind,'wait');assert.equal(result.next_action,'wait-external');assert.equal(result.failure_class,'unknown-outcome');assert.equal(result.command,undefined)
})
