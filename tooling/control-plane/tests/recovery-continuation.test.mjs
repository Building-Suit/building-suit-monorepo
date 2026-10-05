import { preflightRecoveryPlan } from '../runner/bs-agent.mjs'
import { canonicalMigrationSql, localShopMigrationReadiness } from '../runner/local-migration-readiness.mjs'
import { executionPreflightFixture } from './fixtures/execution-preflight.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { planSupervisorStep, classifySupervisorFailure } from '../runner/task-supervisor.mjs'
import { retryPurpose, verifiedRepairBaselineFiles, repairFailureChecks, preserveAttributedRun, publicationHoldOutcome } from '../runner/recovery-evidence.mjs'
import { evaluateExecutionPreflight, repairPreflightPublicationRuntimeFiles } from '../runner/task-preflight.mjs'
import { publicationStateFingerprint } from '../runner/publication-preflight.mjs'
import { classifyVerificationResults, resolveVerificationPlan, verificationCommandFailureClass, requiredVerificationEvidenceMissing } from '../runner/verification-mode.mjs'
import { profileForAttempt } from '../lib/retry-policy.mjs'
const policy = { policy_id: 'foundation-three', max_attempts: 3, attempt_profiles: ['standard','standard','deep'] }
function snapshot(attempt=1,status='succeeded') {
 return {packet:{task:{task_id:'CP-RECOVERY-001',status:'failed'},retry_policy:policy},executions:[{execution_id:attempt,attempt,status}],failures:[{failure_id:attempt,execution_id:attempt,failure_class:'verification-product-defect',resolved_at:null}]}
}
test('1 initial failed verification repairs',()=>{const p=planSupervisorStep(snapshot());assert.equal(p.kind,'act');assert.equal(p.command,'task-retry');assert.equal(p.next_action,'repair')})
test('2 failed repair keeps product class and selects attempt 3 deep',()=>{const s=snapshot(2,'failed');assert.equal(planSupervisorStep(s).next_action,'repair');assert.equal(retryPurpose(s),'verification-product-repair');assert.equal(profileForAttempt(policy,3),'deep')})
test('3 path and branch metadata cannot hijack explicit classification',()=>{const p=classifySupervisorFailure({command:'task-retry',payload:{error:'repair_verification_failed',worktree:'/home/test/worktree/branch/parent',classification:{failure_class:'verification-product-defect'}},attempt:2,maxAttempts:3});assert.equal(p.kind,'act');assert.equal(p.failure_class,'verification-product-defect')})
test('4 current attempt exhausts budget',()=>{const p=planSupervisorStep(snapshot(3,'failed'));assert.equal(p.kind,'terminal');assert.equal(p.reason,'retry_budget_exhausted');assert.equal(classifySupervisorFailure({command:'task-retry',payload:{classification:{failure_class:'verification-product-defect'}},attempt:3,maxAttempts:3}).kind,'terminal')})
test('5 and 6 latest repair probe accepts unchanged protected baseline and exposes drift',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-baseline-'));try {
 execFileSync('git',['init','-q',root]);mkdirSync(path.join(root,'supabase/migrations'),{recursive:true});const file='supabase/migrations/test.sql';writeFileSync(path.join(root,file),'select 1;\n');const object=execFileSync('git',['-C',root,'hash-object','--',file],{encoding:'utf8'}).trim();
 const s=snapshot(2,'failed');s.executions[0].parent_sha='a'.repeat(40);const state={base_sha:'a'.repeat(40),files:[{file,object}]};state.fingerprint=publicationStateFingerprint(state);s.failures[0].metadata={verification_probe:{ok:true,passed:false,verified_state:state}};
 const runtime={repository:{worktree_target:{path:root,changed_files:[file]}}};const baseline=verifiedRepairBaselineFiles(s,runtime,retryPurpose(s));assert.deepEqual(baseline,[file]);assert.deepEqual(repairPreflightPublicationRuntimeFiles({purpose:retryPurpose(s),runtimeFiles:[file],repairBaselineFiles:baseline}),[]);
 assert.deepEqual(repairPreflightPublicationRuntimeFiles({purpose:'publication',runtimeFiles:[file],repairBaselineFiles:baseline}),[file]);
 writeFileSync(path.join(root,file),'select 2;\n');assert.deepEqual(verifiedRepairBaselineFiles(s,runtime,retryPurpose(s)),[]);
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('7 recoverable attributed run retains task and admission',()=>{const r={admitted_repair_id:'CP-BATCH',current_task_id:'CP-RECOVERY-001'};assert.equal(preserveAttributedRun(r,planSupervisorStep(snapshot(2,'failed'))),true);assert.equal(r.current_task_id,'CP-RECOVERY-001')})
test('8 truly terminal exhausted run may finish',()=>{assert.equal(preserveAttributedRun({admitted_repair_id:'CP-BATCH',current_task_id:'CP-RECOVERY-001'},planSupervisorStep(snapshot(3,'failed'))),false)})
test('9 failed repair metadata hands off actual checks without formal run',()=>{const checks=repairFailureChecks({execution:{metadata:{verification_probe_classification:{failure_class:'verification-product-defect'},verification_probe_failures:[{name:'database-tests',status:'fail',summary:'assertion failed'}]}}});assert.equal(checks[0].check_name,'database-tests');assert.equal(checks[0].failure_class,'verification-product-defect');assert.equal(checks[0].summary,'assertion failed')})
test('10 advisor timing blocks publication and cannot mask product defect',()=>{const entry={version:2,kind:'external_gate',description:'Supabase advisor review',required:true};assert.equal(resolveVerificationPlan({entries:[entry]}).deferred.length,1);assert.equal(resolveVerificationPlan({entries:[entry],phase:'pre_publication'}).blockers.length,1);assert.equal(classifyVerificationResults([{status:'fail',required:true,failure_class:'verification-product-defect'},{status:'not_run',required:true,failure_class:'verification-required-check-unavailable'}]).failure_class,'verification-product-defect')})
test('planned test must materialize or stay a required repair defect',()=>{const e={version:2,kind:'planned_test',description:'planned test',expected_outputs:['executable test']};assert.equal(resolveVerificationPlan({entries:[e],phase:'pre_implementation'}).deferred.length,1);assert.equal(resolveVerificationPlan({entries:[e]}).blockers[0].required,true)})
test('stale failure from prior execution cannot override current product class',()=>{const s=snapshot(2,'failed');s.failures.push({failure_id:99,execution_id:1,failure_class:'operator-wait',metadata:{supervisor_classified:true}});assert.equal(planSupervisorStep(s).kind,'act')})
// Run exact code from the exported published n8n nodes, without invoking any worker.
if(process.env.BS_RECOVERY_N8N_FIXTURE) {
 const ws=JSON.parse(readFileSync(process.env.BS_RECOVERY_N8N_FIXTURE,'utf8')).workflow_entity;
 const bs10=ws.find(w=>w.name==='BS-10 — Task Engine'),bs20=ws.find(w=>w.name==='BS-20 — Continue Suit');
 test('11 actual published BS-10 and BS-20 route repair continuation through the supervisor',()=>{
  const repaired=planSupervisorStep(snapshot(2,'failed'));assert.equal(repaired.kind,'act');assert.equal(repaired.command,'task-retry');
  const code=bs10.nodes.find(n=>n.name==='Normalize Supervisor Result').parameters.jsCode;
  const execute=new Function('$input','$',code);const result=execute({first:()=>({json:{payload:{ok:true,status:'wait',task_id:'CP-RECOVERY-001',recovery:{next_action:'wait-external',reason:'synthetic_execution_in_flight',next_wake_at:'2099-01-01T00:00:00Z'}}}})},()=>({first:()=>({json:{task_id:'CP-RECOVERY-001'}})}))[0].json;
  assert.equal(result.outcome,'automatic-resume');assert.notEqual(result.outcome,'safety-stop');
  const waitOutput=bs20.nodes.find(n=>n.name==='Supervisor State').parameters.rules.values.findIndex(r=>r.conditions.conditions[0].rightValue==='wait');
  assert.equal(bs20.connections['Supervisor State'].main[waitOutput][0].node,'wait');assert.notEqual(bs20.connections['Supervisor State'].main[waitOutput][0].node,'Finish Safety Stop');
 });
 test('12 attributed run resume acquisition is never anonymous claim',()=>{const c=bs20.nodes.find(n=>n.name==='Acquire or Resume Admitted Task').parameters.workflowInputs.value.command;assert.match(c,/run-acquire-task/);assert.doesNotMatch(c,/task-claim/);assert.equal(preserveAttributedRun({admitted_repair_id:'CP-BATCH',current_task_id:'CP-RECOVERY-001'},planSupervisorStep(snapshot(2,'failed'))),true)})
}

test('full attempt-3 preflight accepts checked migration and stops newly changed protected file',()=>{
 const f=executionPreflightFixture();const file='apps/shop-suit/supabase/migrations/test.sql';
 f.packet.task.status='failed';f.packet.project.allowed_publication_paths.push('apps/');f.packet.publication_contract.project_paths.push('apps/');
 f.executions=[{execution_id:1,attempt:1,status:'succeeded'},{execution_id:2,attempt:2,status:'failed'}];
 f.purpose='verification-product-repair';f.runtime.repository.worktree_target.changed_files=[file];f.repairBaselineFiles=[file];
 const ready=evaluateExecutionPreflight(f);assert.equal(ready.ready,true,ready.reason);assert.equal(ready.checks.find(c=>c.name==='retry_policy_and_model_profile').profile,'deep');
 f.repairBaselineFiles=[];const drift=evaluateExecutionPreflight(f);assert.equal(drift.ready,false);assert.equal(drift.reason,'publication_unexpected_runtime_change');
})
test('explicit external and terminal classes survive incidental verifier/path wording',()=>{
 for (const failure_class of ['external-wait','safety-stop']) {
  const result=classifySupervisorFailure({command:'task-retry',payload:{error:'repair_verification_failed',classification:{failure_class},path:'/worktree/parent'},attempt:2,maxAttempts:3});
  assert.equal(result.failure_class,failure_class);assert.equal(result.kind,failure_class==='safety-stop'?'terminal':'wait');
 }
})

test('operator publication hold is a real wait and never consumes retry budget',()=>{
 assert.equal(publicationHoldOutcome({}),null)
 const hold=publicationHoldOutcome({BS_CONTROL_PUBLICATION_HOLD:'1'})
 const result=classifySupervisorFailure({command:'task-publish',payload:hold,attempt:2,maxAttempts:3})
 assert.equal(result.kind,'wait');assert.equal(result.failure_class,'operator-wait')
 assert.ok(!result.command)
})

test('missing local HTTP fixture waits without masking a genuine database defect',()=>{
 const missing=verificationCommandFailureClass({name:'shop-payment-evidence-http',passed:false,output:'Error: SHOP_EVIDENCE_ANON_KEY is required for the disposable local evidence test\n'})
 assert.equal(missing,'verification-required-check-unavailable')
 const gate={status:'fail',failure_class:missing}
 assert.equal(classifyVerificationResults([gate]).recovery_action,'wait-operator')
 assert.equal(classifyVerificationResults([gate,{status:'fail',failure_class:'verification-product-defect'}]).recovery_action,'repair')
 assert.equal(verificationCommandFailureClass({name:'shop-payment-evidence-http',passed:false,output:'AssertionError: outsider read private evidence'}),'verification-product-defect')
 assert.equal(verificationCommandFailureClass({name:'other-test',passed:false,output:'Error: SHOP_EVIDENCE_ANON_KEY is required for the disposable local evidence test'}),'verification-product-defect')
})

test('required HTTP test cannot pass by exiting zero with skipped coverage',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-http-receipt-'))
 try {
  const f=path.join(root,'test.mjs')
  const env={...process.env};delete env.NODE_TEST_CONTEXT
  writeFileSync(f,"import test from 'node:test';test('required HTTP',{skip:'fixture missing'},()=>{});\n")
  const skipped=execFileSync(process.execPath,['--test','--test-reporter=tap',f],{encoding:'utf8',env})
  assert.equal(requiredVerificationEvidenceMissing({name:'shop-payment-evidence-http',output:skipped}),true)
  assert.equal(verificationCommandFailureClass({name:'shop-payment-evidence-http',passed:true,missingEvidence:true}),'verification-required-check-unavailable')
  writeFileSync(f,"import test from 'node:test';test('required HTTP',()=>{});\n")
  const executed=execFileSync(process.execPath,['--test','--test-reporter=tap',f],{encoding:'utf8',env})
  assert.equal(requiredVerificationEvidenceMissing({name:'shop-payment-evidence-http',output:executed}),false)
  assert.equal(requiredVerificationEvidenceMissing({name:'shop-payment-evidence-http',output:'pretend green'}),true)
  writeFileSync(f,"import test from 'node:test';test('required HTTP',()=>{throw new Error('RLS assertion failed')});\n")
  let failed=''
  try {execFileSync(process.execPath,['--test','--test-reporter=tap',f],{encoding:'utf8',env})} catch(error){failed=error.stdout}
  assert.ok(failed)
  assert.equal(requiredVerificationEvidenceMissing({name:'shop-payment-evidence-http',output:failed}),false)
  assert.equal(verificationCommandFailureClass({name:'shop-payment-evidence-http',passed:false,output:failed}),'verification-product-defect')
  writeFileSync(f,"throw new Error('SHOP_EVIDENCE_ANON_KEY is required for the disposable local evidence test');\n")
  let unavailable=''
  try {execFileSync(process.execPath,['--test','--test-reporter=tap',f],{encoding:'utf8',env})} catch(error){unavailable=error.stdout}
  assert.equal(verificationCommandFailureClass({name:'shop-payment-evidence-http',passed:false,output:unavailable}),'verification-required-check-unavailable')


 } finally {rmSync(root,{recursive:true,force:true})}
})

test('actual verifier process keeps required skipped HTTP unavailable and optional omissions intact',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-verifier-process-'))
 try {
  execFileSync('git',['init','-q',root])
  execFileSync('git',['-C',root,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-q','--allow-empty','-m','fixture'])
  const relative='apps/shop-suit/tests/integration/payment-evidence-http.mjs'
  mkdirSync(path.dirname(path.join(root,relative)),{recursive:true})
  writeFileSync(path.join(root,relative),"import test from 'node:test';test('HTTP coverage',{skip:'local fixture absent'},()=>{});\n")
  const bin=path.join(root,'bin');mkdirSync(bin)
  writeFileSync(path.join(bin,'pnpm'),'#!/bin/sh\nexit 0\n',{mode:0o755})
  const packet=path.join(root,'packet.json')
  writeFileSync(packet,JSON.stringify({
   task:{task_id:'CP-VERIFIER-FIXTURE',task_type:'implementation',verification_plan:[{version:2,kind:'planned_test',description:'required HTTP coverage',blocker:'shop_storage_http_signed_url_coverage_not_implemented',expected_outputs:[relative]}]},
   suit:{slug:'shop-suit',app_path:'apps/shop-suit'},project:{verification_config:{commands:[{name:'optional-unrelated',program:'pnpm',args:['test'],changed_paths:['unrelated/'],required:false}]}},workstream:{verification_config:{}},
  }))
  const env={...process.env,PATH:bin+path.delimiter+process.env.PATH};delete env.NODE_TEST_CONTEXT
  const verifier=new URL('../runner/task-verifier.mjs',import.meta.url).pathname
  const output=execFileSync(process.execPath,[verifier,root,packet,path.join(root,'logs'),'probe','focused'],{env,encoding:'utf8'})
  const result=JSON.parse(output.trim())
  assert.equal(result.ok,true);assert.equal(result.passed,false)
  const http=result.checks.find(c=>c.name==='shop-payment-evidence-http')
  assert.equal(http.status,'not_run');assert.equal(http.required,true)
  assert.equal(http.failure_class,'verification-required-check-unavailable')
  assert.ok(result.checks.some(c=>c.status==='skipped'))
 }finally{rmSync(root,{recursive:true,force:true})}
})

test('edited applied local migration is infrastructure drift, never a product assertion',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-local-migration-'))
 try {
  const file='apps/shop-suit/supabase/migrations/20261005120000_test.sql'
  mkdirSync(path.dirname(path.join(root,file)),{recursive:true})
  writeFileSync(path.join(root,file),"-- header\nselect 'a b';\n")
  const query=()=>[{version:'20261005120000',statements:["select 'a b'"]}]
  assert.equal(localShopMigrationReadiness({worktreePath:root,changedFiles:[file],query}).ready,true)
  writeFileSync(path.join(root,file),"select 'ab';\n")
  const stale=localShopMigrationReadiness({worktreePath:root,changedFiles:[file],query})
  assert.equal(stale.ready,false);assert.equal(stale.failure_class,'verification-infrastructure')
  assert.equal(localShopMigrationReadiness({worktreePath:root,changedFiles:[file],query:()=>[]}).ready,true)
  assert.equal(localShopMigrationReadiness({worktreePath:root,changedFiles:[file],query:()=>{throw new Error('unavailable')}}).ready,false)
  assert.notEqual(canonicalMigrationSql('do $$begin perform 1; end$$;'),canonicalMigrationSql('do $$begin perform 2; end$$;'))
  assert.equal(canonicalMigrationSql('/* nested /* comment */ */ select 1;'),canonicalMigrationSql('select 1'))
 }finally{rmSync(root,{recursive:true,force:true})}
})

test('generated type mismatch exposes actual schema artifact without changing checked task file',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'cp-generated-types-'))
 try {
  const bin=path.join(root,'bin');mkdirSync(bin)
  writeFileSync(path.join(bin,'pnpm'),"#!/bin/sh\nprintf 'export type Schema = { id: string };\\n'\n",{mode:0o755})
  const artifact=path.join(root,'checked.ts'),expected=path.join(root,'expected.ts')
  writeFileSync(artifact,'export type Schema = {};\n')
  const env={...process.env,PATH:bin+path.delimiter+process.env.PATH};delete env.NODE_TEST_CONTEXT
  const helper=new URL('../runner/check-generated-types.mjs',import.meta.url).pathname
  let mismatch
  try {execFileSync(process.execPath,[helper,artifact,expected],{env,encoding:'utf8',stdio:'pipe'})}catch(e){mismatch=e}
  assert.ok(mismatch);assert.match(mismatch.stderr,/Generated schema artifact for repair:/)
  assert.equal(readFileSync(artifact,'utf8'),'export type Schema = {};\n')
  assert.match(readFileSync(expected,'utf8'),/id: string/)
  writeFileSync(artifact,readFileSync(expected))
  assert.match(execFileSync(process.execPath,[helper,artifact,expected],{env,encoding:'utf8'}),/match the task artifact/)
 }finally{rmSync(root,{recursive:true,force:true})}
})

test('ready preflight preserves the pending product repair class in recovery state',()=>{
 const s=snapshot(2,'failed')
 const ready=preflightRecoveryPlan(s,{ready:true,kind:'ready',next_action:'reconcile-runtime',failure_class:'transient-infrastructure',reason:'preflight_ready',recoverable:true})
 assert.equal(ready.failure_class,'verification-product-defect');assert.equal(ready.next_action,'repair')
 const blocked=preflightRecoveryPlan(s,{ready:false,kind:'stop',next_action:'safety-stop',failure_class:'safety-stop',reason:'protected_drift',recoverable:false})
 assert.equal(blocked.failure_class,'safety-stop');assert.equal(blocked.next_action,'safety-stop')
})

test('persisted explicit external/operator classes retain their route without a legacy marker',()=>{
 for (const failure_class of ['operator-wait','external-wait']) {
  const s=snapshot(3,'failed');s.failures[0]={failure_id:3,execution_id:3,failure_class,metadata:{classification:{failure_class}},resolved_at:null}
  const result=planSupervisorStep(s)
  assert.equal(result.kind,'wait');assert.equal(result.failure_class,failure_class)
  assert.notEqual(result.reason,'retry_budget_exhausted')
 }
})


test('missing Shop HTTP identity fixture is unavailable even when node reports a failed test file', () => {
 const output = '# AssertionError [ERR_ASSERTION]: Disposable local payment-evidence fixture is required; missing: SHOP_EVIDENCE_ANON_KEY, SHOP_EVIDENCE_OWNER_TOKEN\n# fail 1\n';
 assert.equal(verificationCommandFailureClass({ name: 'shop-payment-evidence-http', passed: false, output }), 'verification-required-check-unavailable');
 assert.equal(verificationCommandFailureClass({ name: 'shop-payment-evidence-http', passed: false, output: '# AssertionError [ERR_ASSERTION]: outsider read returned 200\n# fail 1\n' }), 'verification-product-defect');
 assert.equal(verificationCommandFailureClass({ name: 'another-check', passed: false, output }), 'verification-product-defect');
});
