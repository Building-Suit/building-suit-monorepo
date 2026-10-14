import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {completedRetryReceipt,retryImplementationCompleted} from '../runner/retry-finalization.mjs'
import {receiptPaths,atomicJson,processStamp} from '../runner/durable-process.mjs'
import {publicationStateFingerprint} from '../runner/publication-preflight.mjs'

test('completed model output finalizes implementation only; product failures and interrupted workers keep their existing lane',()=>{
 for(const failure_class of ['unknown-outcome','verification-infrastructure','verification-configuration','external-wait','verification-required-check-unavailable'])assert.equal(retryImplementationCompleted({succeeded:false,lastExitCode:0,probe:{classification:{failure_class}}}),true)
 for(const failure_class of ['verification-product-defect','operator-wait',null])assert.equal(retryImplementationCompleted({succeeded:false,lastExitCode:0,probe:{classification:{failure_class}}}),false)
 assert.equal(retryImplementationCompleted({succeeded:false,lastExitCode:1,probe:{classification:{failure_class:'unknown-outcome'}}}),false)
})
function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'cp-retry-finalization-')),worktree=path.join(root,'product');mkdirSync(worktree)
 const git=args=>{const r=spawnSync('git',args,{cwd:worktree,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 git(['init','-q']);writeFileSync(path.join(worktree,'source.mjs'),'export const value=1\n');git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=test@example.invalid','commit','-qm','Existing parent']);writeFileSync(path.join(worktree,'source.mjs'),'export const value=2\n')
 const fingerprint=publicationStateFingerprint({base_sha:git(['rev-parse','HEAD']),files:[{file:'source.mjs',object:git(['hash-object','source.mjs'])}]})
 const context={task_id:'SAS-M1-BILLING-001',run_id:'same-run',execution_id:318,attempt:2},operation={operation_id:'same-operation',workflow_run_id:'same-run',task_id:context.task_id,action:'task-retry',execution_id:318,infra_retries:0,status:'consumed',descriptor:{previous_execution_id:317,source:'bound-agent'}}
 const outer=receiptPaths(path.join(root,'.local/runtime-operations'),operation.operation_id),inner=receiptPaths(path.join(root,'.local/runtime-receipts'),operation.operation_id+':codex')
 const payload={error:'repair_verifier_recovery_required',command:'task-retry',task_id:context.task_id,execution_id:318,probe:{task_id:context.task_id,ok:true,passed:false,classification:{failure_class:'unknown-outcome'},verified_state:{fingerprint}},execution:{log_path:'unchanged-host-log'}}
 const result={code:1,stdout:JSON.stringify(payload),stderr:''};operation.result={result,payload}
 for(const p of [outer,inner]){atomicJson(p.state,{pid:2147483647,start_stamp:'dead'});writeFileSync(p.lock,'')}
 atomicJson(outer.request,{program:process.execPath,args:['bound-agent','task-retry',context.task_id],cwd:root});atomicJson(outer.result,result)
 atomicJson(inner.request,{program:'codex',args:['exec','-'],cwd:worktree,context});atomicJson(inner.result,{code:0,stdout:'implementation completed',stderr:''})
 const snapshot={packet:{task:{task_id:context.task_id,status:'in_progress'}},executions:[{execution_id:318,attempt:2,status:'running',worktree_path:worktree}],workflow_run:{run_id:'same-run',current_task_id:context.task_id,status:'running',max_tasks:7,completed_tasks:3},implementation_operation:operation}
 return {root,worktree,snapshot,outer,inner,context,close:()=>rmSync(root,{recursive:true,force:true})}
}
test('consumed receipt proves the exact dead-worker execution/source without editing history or claiming verification PASS',()=>{
 const f=fixture();try{const before=JSON.stringify(f.snapshot),proof=completedRetryReceipt(f.snapshot,f.root);assert.equal(proof.execution_id,318);assert.equal(proof.attempt,2);assert.equal(proof.mandatory_verification_pending,true);assert.equal(proof.probe.classification.failure_class,'unknown-outcome');assert.deepEqual(proof.original_result,f.snapshot.implementation_operation.result);assert.equal(JSON.stringify(f.snapshot),before)}finally{f.close()}
})
for(const reason of ['source changed','live worker','wrong execution','wrong attempt','consumed receipt mismatch','stop','maintenance','operator gate','latest execution finished','no successful model'])test(`historical finalization fails closed: ${reason}`,()=>{
 const f=fixture();try{
  if(reason==='source changed')writeFileSync(path.join(f.worktree,'source.mjs'),'export const value=3\n')
  if(reason==='live worker')atomicJson(f.inner.state,{pid:process.pid,start_stamp:processStamp(process.pid)})
  if(reason==='wrong execution'||reason==='wrong attempt')atomicJson(f.inner.request,{program:'codex',args:['exec','-'],cwd:f.worktree,context:{...f.context,[reason==='wrong attempt'?'attempt':'execution_id']:99}})
  if(reason==='consumed receipt mismatch')f.snapshot.implementation_operation.result.payload.error='another-outcome'
  if(reason==='stop')f.snapshot.workflow_run.stop_requested=true
  if(reason==='maintenance')f.snapshot.workflow_run.maintenance_requested=true
  if(reason==='operator gate')f.snapshot.recovery={status:'active',next_action:'safety-stop'}
  if(reason==='latest execution finished')f.snapshot.executions[0].status='succeeded'
  if(reason==='no successful model')atomicJson(f.inner.result,{code:1,stdout:'',stderr:'worker interrupted'})
  assert.equal(completedRetryReceipt(f.snapshot,f.root),null)
 }finally{f.close()}
})
