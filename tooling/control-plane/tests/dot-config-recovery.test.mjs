import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { strictBindingRecoveryEvidence, strictBoundaryCommand, requiresSameAttemptVerification } from '../runner/binding-recovery.mjs'
import { effectiveFailureClass } from '../runner/dot.mjs'
import { planSupervisorStep } from '../runner/task-supervisor.mjs'
import { resolveVerificationPlan } from '../runner/verification-mode.mjs'
function fixture(root) {return {packet:{task:{task_id:'BS-UI-ZN-FINAL-001',status:'failed',verification_plan:[strictBoundaryCommand]},retry_policy:{max_attempts:5}},executions:[{execution_id:295,attempt:1,status:'succeeded',worktree_path:root}],verification_runs:[{verification_run_id:299,execution_id:295,status:'failed',metadata:{failure_class:'verification-product-defect'}}],verification_results:[{check_name:'verification-obligation-blocked-22',verification_run_id:299,status:'not_run',metadata:{required:true,selection_reason:'missing_strict_boundary_runner',failure_class:'verification-product-defect'}}],failures:[{failure_id:244,execution_id:295,failure_class:'verification-product-defect',metadata:{classification:{failure_class:'verification-product-defect'}}}],retry_accounting:{consumed:1,classifications:[{execution_id:295,classification:'OTHER'}]}}}
test('Exact deadlock: legacy PRODUCT + Dot OTHER + rejected guard becomes automatic same-execution configuration recovery',()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'dot-binding-'))
 try {
 mkdirSync(path.join(root,'tooling/checks'),{recursive:true});writeFileSync(path.join(root,'tooling/checks/suit-template-boundaries.mjs'),"validateSuitTemplateBoundaries({requireStrict:args.includes('--require-strict')})")
 const s=fixture(root),history=JSON.stringify(s.executions)
 // The prior unknown classification must never fall through to product repair.
 assert.equal(planSupervisorStep(s).reason,'retry_classification_review_required')
 s.binding_recovery=strictBindingRecoveryEvidence(s)
 assert.equal(effectiveFailureClass(s,'verification-product-defect'),'verification-configuration')
 let plan=planSupervisorStep(s);assert.equal(plan.command,'task-verify');assert.equal(plan.execution.execution_id,295)
 // Persisted configuration classification continues to override legacy PRODUCT.
 s.retry_accounting.classifications[0]={execution_id:295,classification:'CONFIGURATION',source:'dot',evidence:{binding_reconciled:true}};
 assert.equal(requiresSameAttemptVerification(s,{action:'task-verify',execution_id:295}),true)
 assert.equal(requiresSameAttemptVerification(s,{action:'task-retry',execution_id:295}),false)
 assert.equal(requiresSameAttemptVerification(s,{action:'task-verify',execution_id:296}),false)
 assert.equal(planSupervisorStep(s).command,'task-verify')
 assert.equal(JSON.stringify(s.executions),history)
 // The actual assertion failing removes binding proof and routes product repair.
 s.verification_results[0].status='fail';assert.equal(strictBindingRecoveryEvidence(s),null)
 } finally {rmSync(root,{recursive:true,force:true})}
})
test('Missing runner or real failed assertion cannot be auto-waived as binding repair',()=>{const s=fixture('/nonexistent');assert.equal(strictBindingRecoveryEvidence(s),null);s.verification_results[0].status='fail';assert.equal(strictBindingRecoveryEvidence(s),null)})
test('Reviewed strict executable binding retains require-strict and remains mandatory',()=>{
 const command={name:'strict-suit-template-boundaries',program:'node',args:['tooling/checks/suit-template-boundaries.mjs','--require-strict'],required:true}
 const plan=resolveVerificationPlan({entries:[strictBoundaryCommand],configuredCommands:[command],legacyMappings:{[strictBoundaryCommand]:{version:2,kind:'command',command:command.name}}})
 assert.equal(plan.blockers.length,0);assert.equal(plan.checks.length,1);assert.deepEqual(plan.checks[0].args,command.args)
})
