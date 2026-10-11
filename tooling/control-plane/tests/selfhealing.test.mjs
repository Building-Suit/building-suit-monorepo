import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { planSupervisorStep, classifySupervisorFailure, supervisorStateFingerprint } from '../runner/task-supervisor.mjs'
import { runWakeEligibility, recoveryBackoff, acquisitionStatus, retryWithoutProductAttempt, taskStatusEvidence } from '../runner/selfhealing.mjs'
import { receiptPaths, startReceipt, readJson, receiptLocked, receiptProcessAlive } from '../runner/durable-process.mjs'
import { resolveProfile, getProfile, listProfiles } from '../routing/router.mjs'
const policy={max_attempts:3,attempt_profiles:['standard','standard','deep']}
const snapshot=(attempt=1)=>({packet:{task:{task_id:'CP-SH-FIXTURE-001',status:'failed'},retry_policy:policy},executions:[{execution_id:attempt,attempt,status:'failed'}],failures:[{failure_id:attempt,execution_id:attempt,failure_class:'verification-product-defect',metadata:{classification:{failure_class:'verification-product-defect'}},resolved_at:null}]})
const run={run_id:'fixture-original-run',status:'running',current_task_id:'CP-SH-FIXTURE-001',completed_tasks:0,max_tasks:2}
const delay=ms=>new Promise(r=>setTimeout(r,ms))
async function until(predicate,timeout=5000){const t=Date.now();while(Date.now()-t<timeout){const x=predicate();if(x)return x;await delay(20)}throw new Error('fixture_timeout')}
test('selfheal 1-3 repeated product failures automatically repair and exhaust exact profiles',()=>{
 const phases=[];for(let attempt=1;attempt<=3;attempt++){const s=snapshot(attempt);s.exhaustion_audit={all_attempts_audited:true,action:'operator-gate',entries:[]};const p=planSupervisorStep(s);phases.push(p);if(attempt<3){assert.equal(p.command,'task-retry');assert.equal(p.next_action,'repair');assert.equal(policy.attempt_profiles[attempt],attempt===2?'deep':'standard')}}
 assert.equal(phases[2].reason,'retry_budget_exhausted');assert.equal(phases[2].kind,'wait');assert.equal(phases[2].next_action,'wait-operator')
})
test('selfheal 4 explicit product class dominates branch/worktree/parent and permission error text',()=>{
 const p=classifySupervisorFailure({command:'task-retry',payload:{error:'permission parent worktree network timeout',classification:{failure_class:'verification-product-defect'}},attempt:1,maxAttempts:3});assert.equal(p.next_action,'repair')
 const infra=classifySupervisorFailure({command:'task-retry',payload:{error:'verification_failed parent',classification:{failure_class:'transient-infrastructure'}},attempt:3,maxAttempts:3});assert.equal(infra.next_action,'wait-external')
})
test('selfheal 5-6 infra and verifier crash at budget max never ask for a product retry',()=>{
 for(const failure_class of ['transient-infrastructure','verification-infrastructure']){const p=classifySupervisorFailure({command:'task-verify',payload:{error:'crashed',classification:{failure_class}},attempt:3,maxAttempts:3});assert.equal(p.kind,'wait');assert.equal(retryWithoutProductAttempt({failure_class}),true)}
 assert.equal(classifySupervisorFailure({command:'task-verify',payload:{error:'invalid JSON process crash'},attempt:3,maxAttempts:3}).next_action,'wait-external')
})
test('selfheal 9/15-17 restart reentry recovers same reserved operation and attribution',()=>{
 const s=snapshot(3);s.executions[0].status='running';s.packet.task.status='in_progress';s.workflow_run=run;s.runtime_operations=[{operation_id:'same-operation',status:'running',action:'task-retry',next_wake_at:new Date(0).toISOString()}];const p=planSupervisorStep(s);assert.equal(p.command,'task-retry');assert.equal(p.operation.operation_id,'same-operation');assert.equal(p.execution.attempt,3);assert.equal(s.workflow_run.run_id,'fixture-original-run');assert.equal(s.executions.length,1)
})
for(const [field,value,reason] of [['stop_requested',true,'stop_requested'],['maintenance_requested',true,'maintenance_requested'],['completed_tasks',2,'limit_reached']]) test(`selfheal 18-20 ${reason} prevents watchdog and supervisor work`,()=>{
 const held={...run,[field]:value};assert.equal(runWakeEligibility(held,null,null).reason,reason);const s=snapshot();s.workflow_run=held;assert.equal(planSupervisorStep(s).kind,'wait')
})
test('selfheal human gates never wake even when runtime operation exists or attempt is at max',()=>{
 for(const next_action of ['wait-operator','wait-decision','safety-stop']){const recovery={status:'active',next_action,error_code:'real_gate'};assert.equal(runWakeEligibility(run,recovery,{next_wake_at:new Date(0).toISOString()}).eligible,false)}
 const s=snapshot(3);s.packet.task.status='passed';s.recovery={status:'active',next_action:'wait-operator',failure_class:'operator-wait',condition:{fingerprint:'changed'}};assert.equal(planSupervisorStep(s).command,'task-publish')
})
test('selfheal backoff persists bounded schedule and cannot spend product attempts',()=>{
 assert.deepEqual([0,1,2,5,100].map(recoveryBackoff),[30000,60000,120000,900000,900000]);assert.equal(runWakeEligibility(run,null,{next_wake_at:new Date(Date.now()+60000).toISOString()}).reason,'backoff_pending')
})
test('selfheal 22 implementation routes retain Sol and independent review retains Astra',()=>{
 const models=['gpt-6.1-sol','gpt-6-astra','gpt-6-luna'].map(model=>({model,isDefault:model==='gpt-6-astra',supportedReasoningEfforts:['low','medium','high'].map(reasoningEffort=>({reasoningEffort}))}))
 for(const [name,effort] of Object.entries({standard:'medium',deep:'high',fast:'low'})){
  assert.deepEqual(getProfile(name).model_preferences,['gpt-6.1-sol'])
  assert.equal(resolveProfile(name,models).model,'gpt-6.1-sol')
  assert.equal(resolveProfile(name,models).reasoning_effort,effort)
  assert.throws(()=>resolveProfile(name,models.filter(m=>m.model!=='gpt-6.1-sol')),/No suitable Codex model/)
 }
 assert.equal(resolveProfile('review',models).model,'gpt-6-astra')
 assert.equal(resolveProfile('review',models).reasoning_effort,'high')
 assert.throws(()=>resolveProfile('deep',[{model:'gpt-6.1-sol',supportedReasoningEfforts:[{reasoningEffort:'low'}]}]),/Configured reasoning effort/)
 assert.equal(resolveProfile('no_ai',[]).model,null);assert.equal(listProfiles().length,5)
 assert.throws(()=>resolveProfile('standard',[{model:'gpt-5.6-sol',isDefault:true}]),/No ChatGPT/)
})
test('selfheal 23 task status keeps historical actual model separately from future route',()=>{
 const s=snapshot();s.executions[0].model_name='gpt-5.6-sol';const result=taskStatusEvidence(s,{model:'gpt-6.1-sol'});assert.equal(result.actual_model,'gpt-5.6-sol');assert.equal(result.future_route.model,'gpt-6.1-sol');assert.equal(s.executions[0].model_name,'gpt-5.6-sol')
})
test('selfheal 24 BS20 preserves explicit owner/no-ready/wait/gate statuses',()=>{
 assert.equal(acquisitionStatus({action:'wait_for_owner'}),'owner-wait');assert.equal(acquisitionStatus({action:'wait',reason:'no_admitted_task'}),'no-ready-task');assert.equal(acquisitionStatus({action:'wait',reason:'maintenance_requested'}),'wait');assert.equal(acquisitionStatus({acquired:true,action:'resume'}),'resumed')
 const wf=JSON.parse(readFileSync(new URL('../n8n/artifacts/pg0BEkbP9E4H4RqB.json',import.meta.url)));const code=wf.nodes.find(n=>n.name==='Run Result').parameters.jsCode
 for(const status of ['wait','maintenance-wait','limit_reached','stop_requested'])assert.equal(vm.runInNewContext('(()=>{'+code+'})()',{$json:{payload:{status}}})[0].json.status,status)

})
test('selfheal 7/8/25 actual detached processes: concurrency, parent death, receipt replay',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-sh-receipt-'));try{
  const marker=path.join(root,'calls.txt');const paths=receiptPaths(root,'execution-same-attempt');const request={program:process.execPath,args:['-e',`require('fs').appendFileSync(${JSON.stringify(marker)},'one\\n');setTimeout(()=>console.log('WORKER_OK'),200)`],cwd:root,timeout:3000}
  for(let i=0;i<5;i++)startReceipt(paths,request)
  const result=await until(()=>readJson(paths.result));assert.equal(result.code,0);assert.equal(result.stdout,'WORKER_OK');assert.equal(readFileSync(marker,'utf8'),'one\n');assert.equal(startReceipt(paths,request).settled,true);await until(()=>!receiptLocked(paths))
  const second=receiptPaths(root,'supervisor-killed');const launcher=path.join(root,'launch.mjs');writeFileSync(launcher,`import {receiptPaths,startReceipt} from ${JSON.stringify(new URL('../runner/durable-process.mjs',import.meta.url).href)};startReceipt(receiptPaths(${JSON.stringify(root)},'supervisor-killed'),${JSON.stringify(request)});setInterval(()=>{},1000);`)
  const supervisor=spawn(process.execPath,[launcher]);await until(()=>readJson(second.state));supervisor.kill('SIGKILL');const after=await until(()=>readJson(second.result));assert.equal(after.stdout,'WORKER_OK');assert.equal(readFileSync(marker,'utf8'),'one\none\n')
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('selfheal crash after worker exit replays success without a second child',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-sh-exit-'));try{const paths=receiptPaths(root,'after-exit');startReceipt(paths,{program:process.execPath,args:['-e',"console.log('SAVED_RESULT')"],cwd:root,timeout:2000});await until(()=>readJson(paths.result));const state=readJson(paths.state);assert.equal(receiptProcessAlive(state.child),false);const replay=startReceipt(paths,{program:'false',args:[],cwd:root});assert.equal(replay.settled,true);assert.equal(readJson(paths.result).stdout,'SAVED_RESULT')}finally{rmSync(root,{recursive:true,force:true})}
})
test('selfheal malformed/unknown child is safety unless a known process recovery code exists',()=>{
 assert.equal(classifySupervisorFailure({command:'task-retry',payload:{error:'malformed_child_response'},attempt:3,maxAttempts:3}).kind,'wait');assert.equal(classifySupervisorFailure({command:'task-retry',payload:{classification:{failure_class:'unsupported'},error:'network'},attempt:1,maxAttempts:3}).kind,'terminal')
})

test('selfheal receipt writer death never duplicates a still-active child',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-sh-writer-dead-'))
 try{
  const paths=receiptPaths(root,'writer-dead');const request={program:process.execPath,args:['-e',"setTimeout(()=>console.log('DONE'),350)"],cwd:root,timeout:3000};startReceipt(paths,request)
  const state=await until(()=>{const s=readJson(paths.state);return s?.child?s:null});process.kill(state.pid,'SIGKILL')
  await until(()=>!receiptLocked(paths));assert.equal(startReceipt(paths,request).child_alive,true)
  await until(()=>!receiptProcessAlive(state.child));assert.equal(startReceipt(paths,request).settled,true);assert.equal(readJson(paths.result).error,'receipt_writer_interrupted')
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('selfheal worker process failure gets immutable infra generations',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-sh-worker-fail-'))
 try{
  const failed=receiptPaths(root,'worker-process',0);startReceipt(failed,{program:process.execPath,args:['-e',"process.stderr.write('fixture provider failure');process.exit(1)"],cwd:root,timeout:2000});assert.equal((await until(()=>readJson(failed.result))).code,1)
  const recovered=receiptPaths(root,'worker-process',1);startReceipt(recovered,{program:process.execPath,args:['-e',"console.log('RECOVERED')"],cwd:root,timeout:2000});assert.equal((await until(()=>readJson(recovered.result))).code,0);assert.equal(readJson(failed.result).code,1)
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('selfheal verifier killed during execution is a process receipt, never a product assertion',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-sh-verifier-dead-'))
 try{
  const paths=receiptPaths(root,'verifier');startReceipt(paths,{program:process.execPath,args:['-e',"setInterval(()=>{},1000)"],cwd:root,timeout:5000});const state=await until(()=>{const s=readJson(paths.state);return s?.child?s:null});process.kill(state.child.pid,'SIGKILL');const result=await until(()=>readJson(paths.result));assert.equal(result.code,1)
  const p=classifySupervisorFailure({command:'task-verify',payload:{error:'verifier process exited'},attempt:3,maxAttempts:3});assert.equal(p.next_action,'wait-external')
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('selfheal SSH and control DB disconnect fixtures keep original attempt and run',async()=>{
 const { executeWithControlDatabaseRetry }=await import('../lib/control-database.mjs')
 const s=snapshot(2);s.workflow_run=run;let tries=0;const result=executeWithControlDatabaseRetry(()=>++tries<3?{code:1,stderr:'connection refused'}:{code:0,stdout:'restored'},{sleep:()=>{}});assert.equal(result.code,0);assert.equal(tries,3);assert.equal(s.executions[0].attempt,2);assert.equal(s.workflow_run.run_id,'fixture-original-run')
 const ssh=classifySupervisorFailure({command:'task-supervise',payload:{error:'SSH connection reset'},attempt:3,maxAttempts:3});assert.equal(ssh.next_action,'wait-external')
})

test('selfheal BS00 persisted transport loop retries SSH/DB but never explicit product/auth gates',async()=>{
 const {withDurableTransportRecovery}=await import('../lib/n8n-transport-recovery.mjs')
 const w=withDurableTransportRecovery({nodes:[{name:'Restricted Runner',type:'n8n-nodes-base.ssh'},{name:'Parse Runner Result'}],connections:{}});const code=w.nodes.find(n=>n.name==='Classify RPC Recovery').parameters.jsCode
 const invoke=row=>new Function('$input',code)({first:()=>({json:row})})[0].json
 assert.equal(invoke({ssh_error:'connect ECONNREFUSED connection refused'}).transport_retry,true)
 assert.equal(invoke({payload:{error:'control_database_connectivity_exhausted'}}).transport_retry,true)
 assert.equal(invoke({payload:{error:'network parent',classification:{failure_class:'verification-product-defect'}}}).transport_retry,false)
 assert.equal(invoke({ssh_error:'permission denied authentication failed'}).transport_retry,false)
 assert.equal(w.nodes.find(n=>n.name==='Persist RPC Backoff').type,'n8n-nodes-base.wait')
})

test('selfheal resolved terminal safety evidence still prevents watchdog wake',()=>{
  assert.equal(runWakeEligibility({status:'running',completed_tasks:0,max_tasks:1},{status:'resolved',next_action:'safety-stop',error_code:'unsafe_unknown_response'}).eligible,false)
})

 test('selfheal direct supervisor re-entry preserves a resolved safety gate at the same fingerprint',()=>{
  const s=snapshot();s.recovery={status:'resolved',next_action:'safety-stop',failure_class:'safety-stop',error_code:'unsafe_response',condition:{fingerprint:supervisorStateFingerprint(s)}}
  const result=planSupervisorStep(s);assert.equal(result.kind,'terminal');assert.equal(result.reason,'unsafe_response');assert.equal(result.command,undefined)
 })

test('selfheal status exposes exhausted product probe without an active recovery row',()=>{
 const s=snapshot(3);s.executions[0].metadata={verification_probe_classification:{failure_class:'verification-product-defect',recovery_action:'repair'},verification_probe_failures:[{status:'fail',name:'immutable-object'}]}
 const result=taskStatusEvidence(s);assert.equal(result.failure_class,'verification-product-defect');assert.equal(result.reason,'retry_budget_exhausted');assert.equal(result.operator_action_required,true);assert.equal(result.last_verifier_failures.length,1)
})
