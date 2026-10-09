import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync,symlinkSync,readlinkSync,chmodSync,readdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {runInNewContext} from 'node:vm'
import {spawnSync} from 'node:child_process'
import {recoveryFingerprint,canonicalFailure,runSupervisorLifecycle} from '../runner/lifecycle-policy.mjs'
import {classifyHealth} from '../runner/dot-health-state.mjs'
import {requiresWatchdogAction} from '../runner/dot-current-state.mjs'
import {handoffRecovery} from '../runner/dot-general-recovery.mjs'
import {planSupervisorStep} from '../runner/task-supervisor.mjs'
import {createHash} from 'node:crypto'
import {trustedCommandRegistration,verifierReceipt} from '../runner/trusted-verifier-receipt.mjs'
import {auditAttempts} from '../runner/retry-exhaustion-audit.mjs'
import {requiresSameAttemptVerification} from '../runner/binding-recovery.mjs'
import {prepareBoundFailureReviews} from '../runner/bound-failure-review.mjs'
import {recoveryActionInput} from '../runner/recovery-action-guard.mjs'
import {applyVerifierFixtureRepair} from '../runner/verifier-fixture-repair.mjs'
import {prepareRuntimeRelease,activateRuntimeRelease} from '../runner/runtime-release.mjs'

const shop={run_id:'06124632-a51d-4d08-bb62-ee4e8cedb9dc',task_id:'SS-LAUNCH-CASH-POLICY-001',execution_id:316,attempt:1,source:'unchanged-product',verifier:'same-verifier',classification:'VERIFIER_INFRA',checks:[{name:'database',status:'fail',command:'db',classification:'VERIFIER_INFRA'}]}
const sas={packet:{task:{task_id:'SAS-M1-BILLING-001',status:'failed'},retry_policy:{max_attempts:5}},workflow_run:{run_id:'2518c051-fb28-4641-ae03-c046d7c30807',status:'running',max_tasks:7,completed_tasks:3},executions:[{execution_id:317,attempt:1,status:'succeeded'}],verification_runs:[{execution_id:317,verification_run_id:348,status:'failed'}],authoritative_failure:{execution_id:317,classification:'UNKNOWN',evidence:{verification_run_id:348}},exhaustion_audit:{action:'investigate'},recovery:{status:'active',error_code:'retry_audit_investigation_required',next_action:'wait-external',next_wake_at:new Date(Date.now()+60000).toISOString()}}

test('Shop nested flock reproduces failure; Dot handoff never reacquires the run lock',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-lock-repro-'))
 try{
  const lock=path.join(root,'run.lock')
  const old=spawnSync('flock',['-n',lock,'flock','-n',lock,'true'])
  assert.equal(old.status,1,'old Dot wrapper self-contends even with no other owner')
  let calls=0
  const job={incident_id:'021ce739-5816-4ac6-8707-5967691a288c',claim_token:'ab71d95e-39c1-46c0-8ee1-ad357cbc2e11'}
  const value=await handoffRecovery(job,sql=>{calls++;assert.match(sql,/control.handoff_dot_recovery/);return {handed_off:true,wake_enqueued:true}})
  assert.equal(calls,1);assert.equal(value.wake_enqueued,true)
  assert.equal(spawnSync('flock',['-n',lock,'true']).status,0,'Supervisor owns a single free run lock')
  await assert.rejects(()=>handoffRecovery({...job,incident_id:"' injected"},()=>assert.fail()),/identity_required/)
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('100 Shop review/audit observations cannot change failure identity or allow reverify',()=>{
 const fingerprint=recoveryFingerprint(shop)
 for(let n=0;n<100;n++){
  assert.equal(recoveryFingerprint({...shop,timestamp:n,reviewed_at:n,evidence_generation:n,checks:shop.checks.map(c=>({...c,root_cause:'Review prose '+n,review:{source:'Repeated audit '+n}}))}),fingerprint)
 }
 for(const changed of [{source:'actual-repair'},{verifier:'changed-verifier'},{classification:'PRODUCT_DEFECT'}])assert.notEqual(recoveryFingerprint({...shop,...changed}),fingerprint)
 const s={...sas,authoritative_failure:{classification:'VERIFIER_INFRA',evidence:{verification_run_id:348}},recovery_readiness:{allowed:false}}
 for(let n=0;n<100;n++){const p=planSupervisorStep(s);assert.equal(p.command,undefined);assert.equal(p.reason,'verifier_repair_required')}
 assert.equal(planSupervisorStep({...s,recovery_readiness:{allowed:true}}).command,'task-verify')
})
test('SAS UNKNOWN investigation is STUCK despite a renewed timer; legitimate backoff and gates remain',()=>{
 const input={run:sas.workflow_run,task:sas.packet.task,execution:sas.executions[0],verification:sas.verification_runs[0],recovery:sas.recovery,authoritative_failure:sas.authoritative_failure,last_progress_at:new Date(Date.now()-3600000).toISOString()}
 const health=classifyHealth(input,{worker_alive:false})
 assert.equal(health.state,'STUCK');assert.equal(requiresWatchdogAction(input,health),true)
 assert.equal(classifyHealth({...input,recovery:{...input.recovery,error_code:'runtime_backoff_pending'}},{worker_alive:false}).state,'WAITING_TIMER')
 assert.equal(classifyHealth({...input,run:{...input.run,stop_requested:true}},{worker_alive:false}).state,'WAITING_OPERATOR')
 assert.equal(classifyHealth({...input,recovery:{...input.recovery,next_action:'wait-operator'}},{worker_alive:false}).state,'WAITING_OPERATOR')
 assert.equal(classifyHealth(input,{worker_alive:true,phase:'verification'}).state,'VERIFYING')
})
test('SAS product migration evidence dominates reviewed verifier and external failures, never a product waiver',()=>{
 const product={version:2,classification:'PRODUCT_DEFECT',origin:'application-sql',review:{root_cause:'Current billing migration fails compilation',source:[{path:'migration.sql',sha256:'a'.repeat(64)}]}}
 assert.equal(canonicalFailure({trusted:[product,{version:2,classification:'VERIFIER_INFRA'},{version:2,classification:'EXTERNAL_EVIDENCE'}]}),'PRODUCT_DEFECT')
 assert.equal(canonicalFailure({trusted:[{classification:'UNKNOWN'},{classification:'VERIFIER_INFRA'}]}),'UNKNOWN')
 const plan=planSupervisorStep({...sas,recovery_readiness:{allowed:false}})
 assert.equal(plan.command,undefined);assert.equal(plan.reason,'retry_audit_investigation_required')
})
test('Supervisor continuation retains run budget, exact completion credit and Shared hard dependency',async()=>{
 const state={max_tasks:14,completed_tasks:3,current:'Shop',ready:false};let credits=0,executions=0
 const result=await runSupervisorLifecycle({gate:async()=>({should_continue:state.current==='Shop'}),prepare:async()=>{},acquire:async()=>({acquired:true,task_id:'Shop'}),supervise:async()=>{executions++;return {ok:true,status:'terminal',recovery:{reason:'task_complete'}}},credit:async()=>{credits++;state.completed_tasks++;state.current='Shared';state.ready=true}})
 assert.equal(credits,1);assert.equal(executions,1);assert.equal(state.max_tasks,14);assert.equal(state.completed_tasks,4);assert.equal(state.ready,true);assert.equal(result.ok,true)
 await runSupervisorLifecycle({gate:async()=>({should_continue:true}),prepare:async()=>{},acquire:async()=>({acquired:false,reason:'hard_dependency'}),supervise:async()=>assert.fail('dependency bypass'),credit:async()=>assert.fail('fabricated credit')})
})
test('reviewed fixture repair refuses product lanes, held runs and changed executable bytes',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-fixture-guard-'))
 try{
  const recipe=JSON.parse(readFileSync(new URL('../verifier-repairs/shop-cash-policy.json',import.meta.url)))
  const snapshot={...sas,packet:{task:{task_id:recipe.task_id,status:'failed'}},executions:[{execution_id:316,attempt:1,status:'succeeded',worktree_path:root}],verification_runs:[{execution_id:316,verification_run_id:346,status:'failed'}],authoritative_failure:{classification:'PRODUCT_DEFECT',evidence:{verification_run_id:346}}}
  assert.equal(applyVerifierFixtureRepair(snapshot,recipe).applied,false)
  assert.equal(applyVerifierFixtureRepair({...snapshot,authoritative_failure:{classification:'VERIFIER_INFRA',evidence:{verification_run_id:346}},workflow_run:{status:'running',maintenance_requested:true}},recipe).reason,'run_held')
  // No matching exact receipt means no file edit or model attempt.
  assert.equal(applyVerifierFixtureRepair({...snapshot,authoritative_failure:{classification:'VERIFIER_INFRA',evidence:{verification_run_id:346}}},recipe).reason,'reviewed_recipe_evidence_mismatch')
 }finally{rmSync(root,{recursive:true,force:true})}
})

const sha=value=>createHash('sha256').update(value).digest('hex')
test('exact trusted Shop repair applies once on the same execution; modified artifacts fail closed',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-reviewed-fixture-'))
 try{
  const git=args=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr)}
  git(['init','-q']);writeFileSync(path.join(root,'.gitignore'),'.local/\n');mkdirSync(path.join(root,'apps/shop-suit/supabase/tests'),{recursive:true});mkdirSync(path.join(root,'.local/logs'),{recursive:true})
  const fixture='apps/shop-suit/supabase/tests/cash.test.sql', original='SELECT UNION fixture;', repaired='SELECT jsonb fixture;'
  writeFileSync(path.join(root,fixture),original);git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','fixture'])
  const check={verification_id:100,check_name:'cash-sql',command:'pnpm supabase test db',status:'fail',exit_code:1,verification_run_id:346,log_path:path.join(root,'.local/logs/check.log'),metadata:{required:true}}
  writeFileSync(check.log_path,'UNION text cannot cast to jsonb')
  check.trusted_registration=trustedCommandRegistration({check,executionId:316,verificationRunId:346,taskId:'SS-LAUNCH-CASH-POLICY-001',registry:{version:1},obligationIds:['cash-matrix'],verifierBytes:'current verifier'})
  check.trusted_receipt=verifierReceipt({check,artifactRoot:root,sourceRoot:root,executionId:316,verificationRunId:346,taskId:'SS-LAUNCH-CASH-POLICY-001'})
  const execution={execution_id:316,attempt:1,status:'succeeded',worktree_path:root}, verification={execution_id:316,verification_run_id:346,status:'failed'}
  const reviews={'cash-sql':{artifact_sha256:sha(readFileSync(check.log_path)),classification:'VERIFIER_INFRA',origin:'verifier-fixture',root_cause:'Fixture UNION literals are text',source_paths:[fixture]}}
  const prepared=prepareBoundFailureReviews({execution,verification,checks:[check],reviews})
  check.metadata.failure_evidence=prepared[0].evidence
  const snapshot={packet:{task:{task_id:'SS-LAUNCH-CASH-POLICY-001',status:'failed'}},workflow_run:{status:'running'},executions:[execution],verification_runs:[verification],verification_results:[check],authoritative_failure:{classification:'VERIFIER_INFRA',evidence:{verification_run_id:346}}}
  const recipe={id:'fixture',task_id:snapshot.packet.task.task_id,checks:[{name:'cash-sql',artifact_sha256:reviews['cash-sql'].artifact_sha256}],files:[{path:fixture,before_sha256:sha(original),after_sha256:sha(repaired),content:repaired}]}
  writeFileSync(check.log_path,'tampered')
  assert.throws(()=>applyVerifierFixtureRepair(snapshot,recipe),/trusted_artifact_digest_mismatch/)
  assert.equal(readFileSync(path.join(root,fixture),'utf8'),original)
  writeFileSync(check.log_path,'UNION text cannot cast to jsonb')
  const result=applyVerifierFixtureRepair(snapshot,recipe)
  assert.equal(result.applied,true);assert.equal(result.receipt.product_attempts,0);assert.equal(result.receipt.execution_id,316)
  for(let n=0;n<100;n++)assert.equal(applyVerifierFixtureRepair(snapshot,recipe).reason,'already_repaired')
  assert.equal(snapshot.executions.length,1);assert.equal(snapshot.executions[0].attempt,1)
  assert.throws(()=>prepareBoundFailureReviews({execution,verification,checks:[check],reviews}),/trusted_source_fingerprint_stale/)
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('database preparation timestamps never grant unchanged-input reverification',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-preparation-'))
 try{
  const git=args=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr)}
  git(['init','-q']);writeFileSync(path.join(root,'.gitignore'),'.local/\n');git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','fixture'])
  mkdirSync(path.join(root,'.local/verification-inputs'),{recursive:true})
  const file=path.join(root,'.local/verification-inputs/database-preparation.json')
  const snapshot={...sas,packet:{...sas.packet,project:{verification_config:{database:{kind:'supabase-local',local_only:true}}}},executions:[{...sas.executions[0],worktree_path:root}]}
  const sourceRoot=new URL('../../../',import.meta.url).pathname
  writeFileSync(file,JSON.stringify({migrations:['schema-a'],schema_prepared:true,prepared_at:'first'}));const original=recoveryActionInput(snapshot,'task-verify',sourceRoot)
  for(let n=0;n<20;n++){writeFileSync(file,JSON.stringify({prepared_at:n,schema_prepared:true,migrations:['schema-a']}));assert.equal(recoveryActionInput(snapshot,'task-verify',sourceRoot).fingerprint,original.fingerprint)}
  writeFileSync(file,JSON.stringify({migrations:['schema-b'],schema_prepared:true}));assert.notEqual(recoveryActionInput(snapshot,'task-verify',sourceRoot).fingerprint,original.fingerprint)
 }finally{rmSync(root,{recursive:true,force:true})}
})

test('SAS current reset proof classifies its blocked child as PRODUCT_DEFECT without a fabricated receipt',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-sas-bound-reviews-'))
 try {
  const git=args=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr)}
  git(['init','-q']);writeFileSync(path.join(root,'.gitignore'),'.local/\n');mkdirSync(path.join(root,'apps/super-admin-suit/supabase/migrations'),{recursive:true});mkdirSync(path.join(root,'.local/logs'),{recursive:true})
  const migration='apps/super-admin-suit/supabase/migrations/billing.sql';writeFileSync(path.join(root,migration),"IF value IS DISTINCT FROM CASE action WHEN 'approve' THEN 'approved' END THEN NULL; END IF;")
  git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','fixture'])
  const execution={execution_id:317,attempt:1,status:'succeeded',worktree_path:root},verification={execution_id:317,verification_run_id:348,status:'failed'},reviews={}
  const checks=[['super-admin-database-reset','PRODUCT_DEFECT','application-sql','SQLSTATE 42601'],['revocation','VERIFIER_INFRA','verifier-fixture','disabled_at constraint'],['staging','EXTERNAL_EVIDENCE','external-evidence','SAS_BILLING_STAGING_EVIDENCE missing']].map(([name,classification,origin,log],i)=>{
   const check={execution_id:317,verification_id:100+i,check_name:name,command:'node '+name+'.mjs',verification_run_id:348,status:'fail',exit_code:1,log_path:path.join(root,'.local/logs/'+name+'.log'),metadata:{required:true}}
   writeFileSync(check.log_path,log)
   check.trusted_registration=trustedCommandRegistration({check,executionId:317,verificationRunId:348,taskId:'SAS-M1-BILLING-001',registry:{version:1},obligationIds:[name],verifierBytes:'current verifier'})
   check.trusted_receipt=verifierReceipt({check,artifactRoot:root,sourceRoot:root,executionId:317,verificationRunId:348,taskId:'SAS-M1-BILLING-001'})
   reviews[name]={artifact_sha256:sha(log),classification,origin,root_cause:log,source_paths:[migration]}
   return check
  })
  const prepared=prepareBoundFailureReviews({execution,verification,checks,reviews})
  for(const check of checks)check.metadata.failure_evidence=prepared.find(p=>p.verification_id===check.verification_id).evidence
  const blocked={execution_id:317,verification_run_id:348,check_name:'super-admin-database-tests',command:'pnpm supabase test db',status:'not_run',metadata:{required:true,selection_reason:'database_prerequisite_failed'}}
  const snapshot={...sas,executions:[execution],verification_runs:[verification],verification_results:[...checks,blocked]}
  const audit=auditAttempts(snapshot),{entries,consumed}=audit
  assert.equal(planSupervisorStep({...snapshot,exhaustion_audit:audit,authoritative_failure:{classification:'PRODUCT_DEFECT',execution_id:317,evidence:{verification_run_id:348}},retry_accounting:{consumed:1}}).command,'task-retry')
  assert.equal(entries[0].classification,'PRODUCT_DEFECT');assert.equal(consumed,1);assert.equal(blocked.trusted_receipt,undefined)
  assert.equal(entries[0].blocking_checks.find(c=>c.name===blocked.check_name).status,'not_run')
  assert.equal(entries[0].proof.filter(p=>p.classification==='EXTERNAL_EVIDENCE').length,1)
  assert.deepEqual(prepareBoundFailureReviews({execution,verification,checks,reviews}).map(p=>p.evidence.classification),['PRODUCT_DEFECT','VERIFIER_INFRA','EXTERNAL_EVIDENCE'])
  assert.throws(()=>prepareBoundFailureReviews({execution,verification,checks,reviews:{...reviews,revocation:{...reviews.revocation,artifact_sha256:'f'.repeat(64)}}}),/review_artifact_changed/)
 }finally{rmSync(root,{recursive:true,force:true})}
})

test('trusted missing staging evidence remains an external wait without a human gate or blind reverify',()=>{
 const snapshot={...sas,authoritative_failure:{classification:'EXTERNAL_EVIDENCE',execution_id:317,evidence:{verification_run_id:348}},recovery_readiness:{allowed:true},recovery:null}
 const plan=planSupervisorStep(snapshot)
 assert.equal(plan.kind,'wait');assert.equal(plan.next_action,'wait-external');assert.equal(plan.command,undefined);assert.equal(plan.failure_class,'external-wait')
})

test('recovery-only Supervisor refreshes bound review state without relying on publication edits',()=>{
 const source=readFileSync(new URL('../runner/bs-agent.mjs',import.meta.url),'utf8')
 const begin=source.indexOf('bindingSnapshot=supervisorSnapshot(taskId)',source.indexOf('function taskSupervisor()'))
 const start=source.lastIndexOf('\n',begin)+1,end=source.indexOf("    if(bindingSnapshot.packet.task.status==='failed')",begin)
 const initial={...sas,authoritative_failure:{...sas.authoritative_failure}},current={...sas,authoritative_failure:{...sas.authoritative_failure,classification:'PRODUCT_DEFECT'}}
 let reads=0,reviews=0;const trail=[]
 const result=runInNewContext('(()=>{'+source.slice(start,end)+';return bindingSnapshot})()',{
  taskId:'SAS-M1-BILLING-001',controlSourceRoot:'/recovery-only',trail,
  supervisorSnapshot:()=>++reads===1?initial:current,
  registeredFailureReviews:s=>{assert.equal(s.authoritative_failure.classification,'UNKNOWN');return [{verification_id:1,evidence:{classification:'PRODUCT_DEFECT'}}]},
  trustedControlQuery:sql=>{assert.match(sql,/review_verification_failure/);reviews++},
 })
 assert.equal(reads,2);assert.equal(reviews,1);assert.equal(result.authoritative_failure.classification,'PRODUCT_DEFECT');assert.equal(trail[0].checks,1)
 const plan=planSupervisorStep({...result,exhaustion_audit:{action:'product-repair',entries:[{execution_id:317,classification:'PRODUCT_DEFECT',proof:[{version:2,classification:'PRODUCT_DEFECT'}]}]},retry_accounting:{consumed:1},recovery_readiness:{allowed:true}})
 assert.equal(plan.command,'task-retry');assert.notEqual(plan.command,'task-verify')
})

test('actual Supervisor recording preserves failed-input baseline after a fixture repair, including restart',()=>{
 const source=readFileSync(new URL('../runner/bs-agent.mjs',import.meta.url),'utf8')
 const start=source.indexOf('function recordAuthoritativeFailure('),end=source.indexOf('\nfunction taskSupervisor()',start)
 let recordings=0,readiness=0
 const record=runInNewContext('('+source.slice(start,end)+')',{currentExecution:s=>s.executions.at(-1),controlSourceRoot:'/runtime',existsSync:()=>true,recoveryActionInput:()=>({fingerprint:'b'.repeat(64),evidence:{source_fingerprint:'c'.repeat(64)}}),parseControlJson:x=>x,controlQuery:(sql,values)=>{if(sql.includes('record_lifecycle_failure')){recordings++;assert.fail('baseline overwritten')}assert.equal(values.source,'c'.repeat(64));readiness++;return {allowed:true}}})
 const snapshot={...sas,executions:[{...sas.executions[0],worktree_path:'/product'}],exhaustion_audit:{entries:[{execution_id:317,classification:'VERIFIER_INFRA'}]},authoritative_failure:{execution_id:317,classification:'VERIFIER_INFRA',evidence:{protocol:2,verification_run_id:348,source_fingerprint:'a'.repeat(64)}}}
 for(let n=0;n<3;n++){
  const repaired=record(structuredClone(snapshot));assert.equal(repaired.authoritative_failure.evidence.source_fingerprint,'a'.repeat(64));assert.equal(planSupervisorStep(repaired).command,'task-verify')
 }
 assert.equal(recordings,0);assert.equal(readiness,3)
})

test('actual runtime reconciles stale 347 to settled 348 without respawning verifier infrastructure',()=>{
 const source=readFileSync(new URL('../runner/bs-agent.mjs',import.meta.url),'utf8'),start=source.indexOf('function invokeTaskAction('),end=source.indexOf('\nfunction handleNoPublishableChanges',start)
 let consumed=0,classified=0
 const snapshot={...sas,packet:{...sas.packet,task:{task_id:'SAS-M1-BILLING-001',status:'failed'}},runtime_operations:[{operation_id:'synthetic',action:'task-verify',execution_id:317,status:'pending',next_wake_at:'2000-01-01',result:{verification_run_id:347}}],verification_runs:[{...sas.verification_runs[0],metadata:{classification:{failure_class:'verification-infrastructure',recovery_action:'wait-external'}}}]}
 const invoke=runInNewContext('('+source.slice(start,end)+')',{supervisorSnapshot:()=>snapshot,recordAuthoritativeFailure:s=>{classified++;return {...s,recovery_readiness:{allowed:false}}},operationHasAuthoritativeSuccess:()=>false,requiresSameAttemptVerification,reviewedProductFailure:()=>false,retryWithoutProductAttempt:()=>true,controlQuery:sql=>{assert.match(sql,/set_runtime_operation_outcome/);assert.match(sql,/'consumed'/);consumed++}})
 const response=invoke('task-verify','SAS-M1-BILLING-001')
 assert.equal(response.payload.replayed_authoritative_state,true);assert.equal(response.payload.execution_id,317);assert.equal(consumed,1);assert.equal(classified,1)
 assert.equal(snapshot.runtime_operations[0].result.verification_run_id,347);assert.equal(snapshot.verification_runs[0].verification_run_id,348)
})

test('schema 105 activation failure restores the previous pointer and keeps lifecycle writers quiesced',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-recovery-install-'))
 try{
  const source=path.join(root,'source'),releaseHome=path.join(root,'runtime');mkdirSync(source)
  const git=args=>{const r=spawnSync('git',args,{cwd:source,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
  git(['init','-q']);git(['config','user.name','Disposable fixture']);git(['config','user.email','fixture@example.invalid'])
  const prepare=(version,bytes)=>{writeFileSync(path.join(source,'fixture.mjs'),bytes);git(['add','fixture.mjs']);git(['commit','-qm','Disposable release fixture']);return prepareRuntimeRelease({sourceRoot:source,releaseHome,commit:git(['rev-parse','HEAD']),files:['fixture.mjs'],schemaVersion:version,acceptance:{recovery:true}})}
  const previous=prepare(103,'export const version=103\n'),candidate=prepare(105,'export const version=105\n')
  symlinkSync(previous.directory,path.join(releaseHome,'current'))
  let starts=0,quiesces=0
  await assert.rejects(activateRuntimeRelease({releaseHome,candidate:candidate.directory,expectedCurrent:previous.directory,requiredChecks:['recovery'],preReadiness:async m=>m.schema_version===105,restart:async()=>{starts++},readiness:async()=>false,restorePrevious:async()=>{quiesces++}}),/release_readiness_failed/)
  assert.equal(readlinkSync(path.join(releaseHome,'current')),previous.directory)
  assert.equal(starts,1);assert.equal(quiesces,1)
 }finally{
  const unseal=directory=>{chmodSync(directory,0o700);for(const entry of readdirSync(directory,{withFileTypes:true}))if(entry.isDirectory())unseal(path.join(directory,entry.name))}
  unseal(root);rmSync(root,{recursive:true,force:true})
 }
})
