import { executionPreflightFixture } from './fixtures/execution-preflight.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { planSupervisorStep, classifySupervisorFailure } from '../runner/task-supervisor.mjs'
import { retryPurpose, verifiedRepairBaselineFiles, repairFailureChecks, preserveAttributedRun } from '../runner/recovery-evidence.mjs'
import { evaluateExecutionPreflight, repairPreflightPublicationRuntimeFiles } from '../runner/task-preflight.mjs'
import { publicationStateFingerprint } from '../runner/publication-preflight.mjs'
import { classifyVerificationResults, resolveVerificationPlan } from '../runner/verification-mode.mjs'
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
