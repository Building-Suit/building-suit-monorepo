import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,mkdirSync,writeFileSync,rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { preexecutionBindingEvidence,reviewedAuthBindings,reviewedTeamBindings } from '../runner/preexecution-binding-recovery.mjs'
import { evaluateVerificationReadiness } from '../runner/verification-mode.mjs'
import { runWakeEligibility } from '../runner/selfhealing.mjs'
import { planSupervisorStep } from '../runner/task-supervisor.mjs'
function fixture(c=reviewedAuthBindings) {
 const root=mkdtempSync(path.join(os.tmpdir(),'cp-auth-bindings-'))
 for(const file of c.files){const f=path.join(root,file);mkdirSync(path.dirname(f),{recursive:true});writeFileSync(f,file.endsWith('package.json')?JSON.stringify({name:'@building-suit/shop-suit',scripts:{typecheck:'nuxt typecheck',lint:'eslint .',build:'nuxt build'}}):'existing test runner\n')}
 const run={run_id:'original-shop-run',status:'running',current_task_id:c.task_id,completed_tasks:1,max_tasks:14}
 const s={packet:{suit:{slug:'shop-suit'},task:{task_id:c.task_id,status:'in_progress',workstream_slug:'shop-suit',verification_plan:c.entries},project:{local_repository_root:root},workstream:{slug:'shop-suit',verification_config:{commands:[]}},retry_policy:{max_attempts:3}},executions:[],workflow_run:run,run_publication_authority:{authorized:true},recovery:{status:'active',next_action:'wait-operator',failure_class:'verification-configuration',error_code:'verification_plan_mapping_required',condition:{preflight:true}}}
 return {root,s,cleanup:()=>rmSync(root,{recursive:true,force:true})}
}
test('missing executable bindings before attempt 1 reconcile and dispatch without spending a product attempt',()=>{
 const f=fixture();try{const s=f.s,before=JSON.stringify(s.executions)
 assert.equal(evaluateVerificationReadiness(s.packet).ready,false)
 s.preexecution_binding_recovery=preexecutionBindingEvidence(s);assert.ok(s.preexecution_binding_recovery)
 assert.equal(runWakeEligibility(s.workflow_run,s.recovery,null,Date.now(),s).eligible,true)
 s.packet.workstream.verification_config=s.preexecution_binding_recovery.config
 assert.equal(evaluateVerificationReadiness(s.packet).ready,true)
 const plan=planSupervisorStep(s);assert.equal(plan.command,'task-run');assert.equal(plan.execution,null)
 assert.equal(JSON.stringify(s.executions),before);assert.equal(s.workflow_run.run_id,'original-shop-run');assert.equal(s.packet.retry_policy.max_attempts,3)
 assert.equal(preexecutionBindingEvidence(s),null)
 }finally{f.cleanup()}
})
test('reviewed binding covers mandatory real unit/browser and typecheck/lint/build checks',()=>{
 const f=fixture();try{f.s.packet.workstream.verification_config=reviewedAuthBindings.config
 const ready=evaluateVerificationReadiness(f.s.packet);assert.equal(ready.ready,true)
 const checks=ready.plan.checks;for(const capability of ['unit','browser','typecheck','lint','build'])assert.ok(checks.some(c=>c.capabilities?.includes(capability)))
 assert.ok(checks.every(c=>c.required!==false));assert.equal(ready.plan.blockers.length,0);assert.equal(ready.plan.unenforced.length,0)
 }finally{f.cleanup()}
})
test('unknown plans, existing executions, missing runners and revoked/stopped run gates cannot auto-reconcile',()=>{
 for(const alter of [s=>s.packet.task.verification_plan.push('Unknown approval'),s=>s.executions.push({execution_id:1,attempt:1,status:'failed'}),s=>s.workflow_run.stop_requested=true,s=>s.run_publication_authority.authorized=false,s=>s.packet.task.task_id='OTHER-001',s=>s.packet.project.local_repository_root='/does-not-exist']){
  const f=fixture();try{f.s.packet.task.verification_plan=[...f.s.packet.task.verification_plan];alter(f.s);assert.equal(preexecutionBindingEvidence(f.s),null)}finally{f.cleanup()}
 }
})
test('configuration proof cannot override other human decisions or safety gates',()=>{
 const f=fixture();try{const s=f.s;s.preexecution_binding_recovery=preexecutionBindingEvidence(s)
 for(const gate of [{next_action:'wait-decision',error_code:'missing_approval'},{next_action:'safety-stop',error_code:'protected_path'},{next_action:'wait-operator',error_code:'missing_credentials'}])assert.equal(runWakeEligibility(s.workflow_run,{...s.recovery,...gate},null,Date.now(),s).eligible,false)
 }finally{f.cleanup()}
})

test('Team exact approved obligations recover before first execution and automatically dispatch same run',()=>{
 const f=fixture(reviewedTeamBindings);try{const s=f.s;s.preexecution_binding_recovery=preexecutionBindingEvidence(s);assert.ok(s.preexecution_binding_recovery);assert.equal(s.preexecution_binding_recovery.execution_count,0);assert.equal(runWakeEligibility(s.workflow_run,s.recovery,null,Date.now(),s).eligible,true);s.packet.workstream.verification_config=s.preexecution_binding_recovery.config;assert.equal(evaluateVerificationReadiness(s.packet).ready,true);assert.equal(planSupervisorStep(s).command,'task-run');assert.equal(s.executions.length,0);assert.equal(s.workflow_run.max_tasks,14);assert.equal(preexecutionBindingEvidence(s),null)}finally{f.cleanup()}
})
