import {requiresSameAttemptVerification} from '../runner/binding-recovery.mjs'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {failureEvidence,processFailureCategory,validateFailureEvidence,reconcileFailureEvidence} from '../runner/failure-evidence.mjs'
import {auditAttempts} from '../runner/retry-exhaustion-audit.mjs'
import {dispatchRecovery,recoveryIdentity} from '../runner/dot-general-recovery.mjs'
const check={verification_id:10,verification_run_id:20,execution_id:30,check_name:'test',name:'test',command:'registered runner',status:'fail',exit_code:1,log_path:'/private/bound.log',metadata:{required:true}}
for(const [kind,origin,category] of [['assertion','product-test','PRODUCT_DEFECT'],['browser click without marker','application-behavior','PRODUCT_DEFECT'],['SQL missing-column product','application-sql','PRODUCT_DEFECT'],['SQL missing-column fixture','verifier-fixture','VERIFIER_INFRA'],['SQL type product','application-sql','PRODUCT_DEFECT'],['Playwright fixture','verifier-fixture','CONFIGURATION'],['HTTP product','application-http','PRODUCT_DEFECT']])test(kind,()=>{
 const e=failureEvidence({execution_id:30,verification_run_id:20,check,artifact:'complete receipt without magic markers',classification:category,origin,review:{root_cause:kind,source:[{path:category==='PRODUCT_DEFECT'?'app/source.ts':'app/tests/fixture.ts',sha256:'a'.repeat(64)}]}})
 assert.equal(validateFailureEvidence(e,{execution_id:30,verification_run_id:20,check}).classification,category)
 const row={...check,summary:'truncated',metadata:{required:true,failure_evidence:e}}
 const a=auditAttempts({executions:[{execution_id:30,attempt:1,status:'succeeded'}],verification_runs:[{execution_id:30,verification_run_id:20}],verification_results:[row],policy:{max_attempts:5}})
 assert.equal(a.entries[0].classification,category);assert.equal(a.consumed,category==='PRODUCT_DEFECT'?1:0)
})
for(const [name,alter] of [['wrong execution',e=>({...e,execution_id:31})],['stale verification',e=>({...e,verification_run_id:19})],['unbound command',e=>({...e,command:'forged'})],['forged PRODUCT',e=>({...e,classification:'PRODUCT_DEFECT',origin:'product-test',review:null})]])test(name+' rejected',()=>{
 const e=failureEvidence({execution_id:30,verification_run_id:20,check,artifact:'full log'})
 assert.throws(()=>validateFailureEvidence(alter(e),{execution_id:30,verification_run_id:20,check}))
})
test('UNKNOWN expands evidence then owns one incident across duplicates and restart',async()=>{
 assert.equal(reconcileFailureEvidence(check,{execution_id:30},{verification_run_id:20}).action,'expand-execution-artifacts')
 const e=failureEvidence({execution_id:30,verification_run_id:20,check,artifact:'complete ambiguous log'})
 assert.equal(reconcileFailureEvidence({...check,metadata:{failure_evidence:e}},{execution_id:30},{verification_run_id:20}).action,'incident-investigate')
 const persisted=new Set(),starts=[],health={run_id:'same-run',task_id:'same-task',execution_id:30,state:'STUCK',operator_action_required:false,worker_alive:false,observed_at:new Date().toISOString()}
 for(let i=0;i<3;i++)await dispatchRecovery({health:JSON.parse(JSON.stringify(health)),snapshot:{exhaustion_audit:{action:'investigate'}},claim:async(run,key,family)=>{assert.equal(run,'same-run');assert.equal(family,'unknown-lifecycle');if(persisted.has(key))return {claimed:false};persisted.add(key);return {claimed:true,job:{owner:'Codex'}}},start:async j=>starts.push(j)})
 assert.equal(starts.length,1);assert.equal(starts[0].owner,'Codex')
})

for(const category of ['TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE','PUBLICATION_INFRA'])test(category+' retains a bound non-product receipt',()=>{
 const e=failureEvidence({execution_id:30,verification_run_id:20,check,artifact:'bound process result',classification:category,origin:'process',phase:'spawn'})
 assert.equal(validateFailureEvidence(e,{execution_id:30,verification_run_id:20,check}).classification,category)
})
test('complete structured receipt wins over truncated legacy PRODUCT summary',()=>{
 const e=failureEvidence({execution_id:30,verification_run_id:20,check,artifact:'full fixture evidence',classification:'VERIFIER_INFRA',origin:'verifier-fixture',review:{root_cause:'ambiguous test selector',source:[{path:'app/tests/fixture.ts'}]}})
 const a=auditAttempts({executions:[{execution_id:30,attempt:1,status:'succeeded'}],verification_runs:[{execution_id:30,verification_run_id:20}],verification_results:[{...check,metadata:{failure_evidence:e,required:true,failure_class:'verification-product-defect'},summary:'truncated'}]})
 assert.equal(a.consumed,0);assert.equal(a.action,'same-attempt-recovery')
})
test('future verifier serializes durable artifact binding before database persistence',()=>{
 const source=readFileSync(new URL('../runner/task-verifier.mjs',import.meta.url),'utf8')
 assert.match(source,/check.failure_evidence=failureEvidence/);assert.match(source,/failure_evidence: check.failure_evidence/)
})
test('unknown investigation supports evidence-only review without runtime/product mutation',()=>{
 const source=readFileSync(new URL('../runner/dot-recovery-worker.mjs',import.meta.url),'utf8')
 assert.match(source,/evidence-review-plan.json/);assert.match(source,/incident_source_review_stale/);assert.match(source,/review_verification_failure/)
})

test('reviewed evidence creates a new owned recovery instead of reviving stale unknown investigation',()=>{const h={run_id:'same',task_id:'task',execution_id:30,evidence_revision:1};assert.notEqual(recoveryIdentity(h),recoveryIdentity({...h,evidence_revision:2}));assert.equal(recoveryIdentity(h),recoveryIdentity(JSON.parse(JSON.stringify(h))))})

test('duplicate watchdog scans serialize before consuming database sessions',()=>{const source=readFileSync(new URL('../runner/bs-agent.mjs',import.meta.url),'utf8');const watch=source.slice(source.indexOf('async function recoveryWatch()'),source.indexOf('function recoverWorkflowRun()'));assert.ok(watch.indexOf('dot-watch.lock')<watch.indexOf('controlQuery'));assert.match(watch,/watchdog_scan_already_owned/);assert.match(watch,/BS_DOT_WATCH_LOCKED/);})

test('reviewed non-product receipt must reverify, never replay its old failed phase',()=>{
 const s={executions:[{execution_id:30,status:'succeeded',attempt:1}],verification_runs:[{execution_id:30,verification_run_id:20,status:'failed'}],exhaustion_audit:{entries:[{execution_id:30,classification:'VERIFIER_INFRA',proof:[{version:2,verification_run_id:20}]}]}}
 const op={action:'task-verify',execution_id:30}
 assert.equal(requiresSameAttemptVerification(s,op),true)
 assert.equal(requiresSameAttemptVerification(JSON.parse(JSON.stringify(s)),op),true)
 assert.equal(requiresSameAttemptVerification({...s,verification_runs:[...s.verification_runs,{execution_id:30,verification_run_id:21,status:'passed'}]},op),false)
 assert.equal(requiresSameAttemptVerification({...s,exhaustion_audit:{entries:[{execution_id:30,classification:'PRODUCT_DEFECT'}]}},op),false)
 assert.equal(requiresSameAttemptVerification(s,{...op,execution_id:31}),false)
})

test('ambiguous timeout or child crash stays UNKNOWN; typed transport/configuration errors recover without product charge',()=>{assert.equal(processFailureCategory({error:{code:'ETIMEDOUT'}}),'UNKNOWN');assert.equal(processFailureCategory({signal:'SIGSEGV'}),'UNKNOWN');assert.equal(processFailureCategory({error:{code:'E2BIG'}}),'TRANSIENT_INFRASTRUCTURE');assert.equal(processFailureCategory({error:{code:'ENOENT'}}),'CONFIGURATION')})
