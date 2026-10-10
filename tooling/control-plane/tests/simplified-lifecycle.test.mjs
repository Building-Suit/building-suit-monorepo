import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalFailure, recoveryFingerprint, watchdogIntervention, runSupervisorLifecycle } from '../runner/lifecycle-policy.mjs'

const failure = () => ({task_id:'T',run_id:'R',execution_id:1,attempt:1,source:'source',plan:['check'],verifier:'v1',classification:'VERIFIER_INFRA',checks:[{name:'check',status:'fail',command:'node check',root_cause:'fixture absent'}]})
test('100 observations of an unchanged failure have one action identity',()=>{
 const first=recoveryFingerprint(failure())
 for(let n=0;n<100;n++)assert.equal(recoveryFingerprint({...failure(),timestamp:n,verification_run_id:n,evidence_generation:n,recovery_version:n}),first)
 for(const changed of [{source:'fixed'},{verifier:'v2'},{plan:['new-check']},{classification:'PRODUCT_DEFECT'}])assert.notEqual(recoveryFingerprint({...failure(),...changed}),first)
})
test('only bound structured product evidence charges a product attempt',()=>{
 assert.equal(canonicalFailure({trusted:[{classification:'PRODUCT_DEFECT',version:2,review:{root_cause:'bad sum',source:[{path:'src/sum'}]}}]}),'PRODUCT_DEFECT')
 assert.equal(canonicalFailure({trusted:[{classification:'UNKNOWN'}],legacy:'verification-product-defect'}),'UNKNOWN')
 assert.equal(canonicalFailure({legacy:'verification-product-defect'}),'UNKNOWN')
 assert.equal(canonicalFailure({authority:true}),'HUMAN_AUTHORITY')
})
test('conflicting checks use one deterministic lane and unknown cannot be masked',()=>{
 assert.equal(canonicalFailure({trusted:[{classification:'VERIFIER_INFRA'},{classification:'UNKNOWN'}]}),'UNKNOWN')
 assert.equal(canonicalFailure({trusted:[{classification:'CONFIGURATION'},{classification:'VERIFIER_INFRA'}]}),'CONFIGURATION')
})
test('Dot ignores healthy workers and transition grace, then detects missing owner',()=>{
 const input={task:{status:'passed'},verification:{status:'passed'},last_progress_at:new Date(1000).toISOString()}
 assert.equal(watchdogIntervention(input,{state:'PUBLISHING',worker_alive:false},2000),false)
 assert.equal(watchdogIntervention(input,{state:'STUCK',worker_alive:false},400000),true)
 assert.equal(watchdogIntervention(input,{state:'RUNNING',worker_alive:true},400000),false)
 assert.equal(watchdogIntervention(input,{state:'WAITING_OPERATOR'},400000),false)
 assert.equal(watchdogIntervention(input,{state:'WAITING_DEPENDENCY'},400000),false)
})
test('happy path with Dot absent credits exactly once and acquires next task',async()=>{
 let current=0,credits=0;const executed=[]
 const result=await runSupervisorLifecycle({gate:async()=>({should_continue:current<2,reason:'limit_reached'}),prepare:async()=>{},acquire:async()=>({acquired:true,action:'execute',task_id:['A','B'][current]}),supervise:async task=>{executed.push(task);return {ok:true,status:'terminal',recovery:{reason:'task_complete'}}},credit:async()=>{credits++;current++}})
 assert.deepEqual(executed,['A','B']);assert.equal(credits,2);assert.equal(result.status,'limit_reached')
})
test('credit replay does not dispatch implementation again',async()=>{
 let credited=false
 await runSupervisorLifecycle({gate:async()=>({should_continue:!credited}),prepare:async()=>{},acquire:async()=>({action:'credit_completion',task_id:'A'}),supervise:async()=>assert.fail('duplicate implementation'),credit:async()=>{credited=true}})
 assert.equal(credited,true)
})
test('authority and real dependency waits return to durable queue without model work',async()=>{
 const result=await runSupervisorLifecycle({gate:async()=>({should_continue:true}),prepare:async()=>{},acquire:async()=>({acquired:false,action:'wait',reason:'hard_dependency'}),supervise:async()=>assert.fail('dependency bypass'),credit:async()=>assert.fail('fabricated credit')})
 assert.equal(result.status,'wait');assert.equal(result.acquisition.reason,'hard_dependency')
})

test('unchanged verifier inputs stop before any operation dispatch',async()=>{
 const {planSupervisorStep}=await import('../runner/task-supervisor.mjs')
 const plan=planSupervisorStep({packet:{task:{task_id:'T',status:'failed'},retry_policy:{max_attempts:5}},executions:[{execution_id:1,attempt:1,status:'succeeded'}],recovery_readiness:{allowed:false}})
 assert.equal(plan.kind,'wait');assert.equal(plan.reason,'verifier_repair_without_progress');assert.equal(plan.command,undefined)
})
test('current UNKNOWN classification cannot fall back to a stale product verdict',async()=>{
 const {effectiveFailureClass}=await import('../runner/dot.mjs')
 assert.equal(effectiveFailureClass({executions:[{execution_id:1}],exhaustion_audit:{entries:[{execution_id:1,classification:'UNKNOWN'}]}},'verification-product-defect'),'unknown-outcome')
})
test('usage comes only from completion events and preserves unavailable token counts',async()=>{
 const {completionUsage}=await import('../runner/codex-completion-usage.mjs')
 assert.equal(completionUsage({type:'thread.started'}),null);assert.equal(completionUsage({type:'turn.completed'}),null)
 const row=completionUsage({type:'turn.completed',usage:{input_tokens:100,cached_input_tokens:30,output_tokens:20}},{model:'fixture',task_id:'T',run_id:'R',execution_id:1,attempt:1},900)
 assert.equal(row.input_tokens,100);assert.equal(row.reasoning_tokens,null);assert.equal(row.duration_ms,900);assert.equal(row.execution_id,1)
})
test('durable lifecycle consumer polls only in-flight operations and bounded timers',async()=>{
 const {supervisorRetrySeconds}=await import('../runner/supervisor-service.mjs')
 assert.equal(supervisorRetrySeconds({ok:true,response:{recovery:{reason:'runtime_operation_in_flight'}}}),30)
 assert.equal(supervisorRetrySeconds({ok:true,response:{recovery:{reason:'verifier_repair_without_progress'}}}),null)
 assert.equal(supervisorRetrySeconds({ok:true,status:'wait',acquisition:{reason:'hard_dependency'}}),null)
 assert.equal(supervisorRetrySeconds({ok:false}),30)
})

test('incident regressions reject implicit or non-disposable database routing',async()=>{
 const {incidentTestEnvironment}=await import('../runner/incident-test-environment.mjs')
 assert.throws(()=>incidentTestEnvironment('/fixture',{}),/explicit_disposable/)
 assert.throws(()=>incidentTestEnvironment('/fixture',{BS_CONTROL_INCIDENT_TEST_CONTAINER:'production-postgres'}),/explicit_disposable/)
})


test('failure generation, not changing scheduler diagnostics, identifies one incident',async()=>{
 const {semanticRecoveryCause}=await import('../runner/recovery-catalog.mjs')
 const input={authoritative_failure:{fingerprint:'a'.repeat(64),classification:'UNKNOWN'}}
 for(let n=0;n<100;n++)assert.equal(semanticRecoveryCause('unknown-lifecycle',{...input,recovery:{error_code:'poll-'+n,version:n},verification_runs:[{verification_run_id:n}]}).cause_fingerprint,input.authoritative_failure.fingerprint)
})
