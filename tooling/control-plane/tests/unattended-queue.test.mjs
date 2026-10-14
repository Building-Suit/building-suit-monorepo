import test from 'node:test'
import assert from 'node:assert/strict'
import {classifyControlDatabaseFailure,executeWithControlDatabaseRetry} from '../lib/control-database.mjs'
import {runSupervisorLifecycle} from '../runner/lifecycle-policy.mjs'
import {planSupervisorStep} from '../runner/task-supervisor.mjs'
import {supervisorRetrySeconds} from '../runner/supervisor-service.mjs'
import {unattendedSensitiveFiles,frozenDraftReplay} from '../runner/unattended-publication.mjs'

test('blocked task is parked without credit, independent task completes, then idle',async()=>{
 let index=0;const credited=[],parked=[]
 const result=await runSupervisorLifecycle({gate:async()=>({should_continue:true}),prepare:async()=>{},acquire:async()=>index<2?{acquired:true,task_id:['BLOCKED','SAFE'][index]}:{acquired:false,state:'IDLE'},supervise:async task=>task==='SAFE'?{ok:true,status:'terminal',recovery:{reason:'task_complete'}}:{ok:true,status:'wait',recovery:{reason:'external_evidence_missing'}},credit:async task=>{credited.push(task);index++},park:async task=>{if(task==='BLOCKED'){parked.push(task);index++;return true}return false}})
 assert.deepEqual(credited,['SAFE']);assert.deepEqual(parked,['BLOCKED']);assert.equal(result.status,'idle')
})
test('stop gate prevents parking, dispatch and credit',async()=>{
 const forbidden=async()=>assert.fail('operation after stop')
 const result=await runSupervisorLifecycle({gate:async()=>({should_continue:false,reason:'stop_requested'}),prepare:forbidden,acquire:forbidden,supervise:forbidden,credit:forbidden,park:forbidden})
 assert.equal(result.status,'stop_requested')
})
test('ordinary UI has no sensitive gate; access-control and provider workflow edits stay gated',()=>{
 assert.deepEqual(unattendedSensitiveFiles(['apps/shop-suit/app/pages/support.vue','packages/ui/src/Button.vue']),[])
 assert.deepEqual(unattendedSensitiveFiles(['packages/auth/src/session.ts','apps/shop-suit/server/api/grant.ts','.github/workflows/deploy.yml']),['packages/auth/src/session.ts','apps/shop-suit/server/api/grant.ts','.github/workflows/deploy.yml'])
})

test('idle queue schedules existing infrastructure timer; unknown idle stays asleep',()=>{assert.equal(supervisorRetrySeconds({ok:true,status:'idle'}),null);assert.equal(supervisorRetrySeconds({ok:true,status:'idle',acquisition:{next_wake_at:new Date(Date.now()+30000).toISOString()}}),30)})

test('rolled-back PostgreSQL conflicts use bounded infrastructure retry; permissions and syntax stay blocked',()=>{for(const code of ['40P01','40001']){let calls=0;const result=executeWithControlDatabaseRetry(()=>++calls===1?{code:1,stderr:'ERROR:  '+code+': transaction aborted'}:{code:0},{sleep:()=>{}});assert.equal(calls,2);assert.equal(result.code,0)}assert.equal(classifyControlDatabaseFailure({stderr:'ERROR:  42501: permission denied'}).transient,false);assert.equal(classifyControlDatabaseFailure({stderr:'ERROR:  42601: syntax error'}).transient,false)})

test('lost Draft response can reconcile frozen parent after a child leaf; wrong head/base or nondraft cannot',()=>{
 const execution={branch_name:'codex/automation-suit/task',parent_branch:'stg',parent_sha:'a'.repeat(40)},pr={state:'OPEN',isDraft:true,headRefName:execution.branch_name,baseRefName:'stg',headRefOid:'b'.repeat(40)}
 const input={pr,execution,localSha:'b'.repeat(40),remoteSha:'b'.repeat(40),recordedParentSha:'a'.repeat(40),taskCommitsOnly:true}
 assert.equal(frozenDraftReplay(input),true)
 for(const edit of [{pr:{...pr,isDraft:false}},{pr:{...pr,headRefOid:'c'.repeat(40)}},{pr:{...pr,baseRefName:'main'}},{pr:{...pr,state:'MERGED'}},{remoteSha:'c'.repeat(40)},{recordedParentSha:'c'.repeat(40)},{taskCommitsOnly:false}])assert.equal(frozenDraftReplay({...input,...edit}),false)
})

test('queue exhaustion does not automatically consume an older extension grant',()=>{
 const snapshot={packet:{task:{task_id:'T',status:'failed'},retry_policy:{max_attempts:5,one_invocation_extension:{grant_id:7}}},executions:[{execution_id:5,attempt:5,status:'succeeded'}],verification_runs:[{verification_run_id:5,execution_id:5,status:'failed'}],failures:[{failure_id:1,execution_id:5,failure_class:'verification-product-defect'}],retry_accounting:{consumed:5,all_product:true},exhaustion_audit:{action:'block',entries:[{execution_id:5,classification:'PRODUCT_DEFECT',proof:[{version:2}]}]},authoritative_failure:{execution_id:5,classification:'PRODUCT_DEFECT'},run_publication_authority:{authorized:true,unattended_queue_authority:true}}
 assert.equal(planSupervisorStep(snapshot).reason,'retry_budget_exhausted');assert.equal(snapshot.packet.retry_policy.one_invocation_extension.grant_id,7)
})
