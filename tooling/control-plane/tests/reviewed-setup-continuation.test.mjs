import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {reviewedSetupRecipe,applyVerifierFixtureRepair} from '../runner/verifier-fixture-repair.mjs'
import {reviewedSameCommandPrerequisites,auditAttempts} from '../runner/retry-exhaustion-audit.mjs'
import {verifierReceipt,trustedCommandRegistration} from '../runner/trusted-verifier-receipt.mjs'
import {failureEvidence} from '../runner/failure-evidence.mjs'
const digest=s=>createHash('sha256').update(s).digest('hex')
function fixture(){
 const root=mkdtempSync(path.join(os.tmpdir(),'reviewed-setup-'))
 const source='apps/shop-suit/supabase/tests/fixture.test.sql',browser='apps/shop-suit/tests/e2e/fixture.spec.ts'
 for(const f of [source,browser,'.local/db.log','.local/browser.log'])mkdirSync(path.dirname(path.join(root,f)),{recursive:true})
 writeFileSync(path.join(root,source),"-- raw_app_meta_data raw_user_meta_data\nselect now(),'{}','{}',now(),now() union all select now(),'{}','{}',now(),now();\nselect ok(permission_denied,'required denial');\n")
 writeFileSync(path.join(root,browser),"await editor.getByLabel(ar ? 'الطريقة' : 'Method', { exact: true }).selectOption('card');\nexpect(commands).toHaveLength(1);\n")
 writeFileSync(path.join(root,'.local/db.log'),'raw_app_meta_data is of type jsonb but expression is of type text')
 writeFileSync(path.join(root,'.local/browser.log'),"locator.selectOption waiting for getByLabel('Method', { exact: true })")
 for(const args of [['init','-q'],['add','apps'],['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture']])assert.equal(spawnSync('git',args,{cwd:root}).status,0)
 const execution={execution_id:330,task_id:'SS-LAUNCH-FAST-PAY-001',attempt:1,status:'succeeded',worktree_path:root},verification={execution_id:330,verification_run_id:368,status:'failed'}
 const checks=[['db',source,'.local/db.log','pnpm exec supabase test db --local'],['browser',browser,'.local/browser.log','pnpm exec playwright test']].map(([name,file,log,command],i)=>{
  const c={verification_id:i+1,execution_id:330,verification_run_id:368,check_name:name,command,status:'fail',exit_code:1,log_path:path.join(root,log),metadata:{required:true}}
  c.trusted_registration=trustedCommandRegistration({check:c,executionId:330,verificationRunId:368,taskId:execution.task_id,runId:'run',registry:{},obligationIds:['required'],verifierBytes:'verifier'})
  c.trusted_receipt=verifierReceipt({check:c,executionId:330,verificationRunId:368,taskId:execution.task_id,runId:'run',artifactRoot:root,sourceRoot:root})
  c.metadata.failure_evidence=failureEvidence({execution_id:330,verification_run_id:368,check:c,artifact:readFileSync(c.log_path),classification:'VERIFIER_INFRA',origin:'verifier-fixture',review:{root_cause:'Independent setup defect review',source:[{path:file,sha256:digest(readFileSync(path.join(root,file)))}]}})
  return c
 })
 const snapshot={packet:{task:{task_id:execution.task_id,status:'failed'},retry_policy:{max_attempts:5}},executions:[execution],verification_runs:[verification],verification_results:checks,authoritative_failure:{classification:'VERIFIER_INFRA',evidence:{verification_run_id:368}}}
 return{root,source,browser,snapshot,cleanup:()=>rmSync(root,{recursive:true,force:true})}
}
test('reviewed deterministic setup repair preserves assertions and execution; second acquisition is a no-op',()=>{
 const f=fixture();try{
  const before=JSON.stringify(f.snapshot),recipe=reviewedSetupRecipe(f.snapshot)
  assert.equal(recipe.files.length,2);assert.equal(applyVerifierFixtureRepair(f.snapshot,recipe).receipt.product_attempts,0)
  assert.match(readFileSync(path.join(f.root,f.source),'utf8'),/select ok\(permission_denied,'required denial'\)/)
  assert.match(readFileSync(path.join(f.root,f.browser),'utf8'),/expect\(commands\).toHaveLength\(1\)/)
  assert.match(readFileSync(path.join(f.root,f.source),'utf8'),/'\{\}'::jsonb/)
  assert.equal(reviewedSetupRecipe(f.snapshot),null);assert.equal(JSON.stringify(f.snapshot),before)
 }finally{f.cleanup()}
})
test('unknown or product evidence cannot authorize fixture transformations',()=>{
 const f=fixture();try{for(const classification of ['PRODUCT_DEFECT','UNKNOWN']){f.snapshot.verification_results[0].metadata.failure_evidence.classification=classification;assert.equal(reviewedSetupRecipe(f.snapshot),null)}}finally{f.cleanup()}
})
test('source substitution and changed artifacts refuse automatic repair',()=>{
 for(const mutate of [f=>writeFileSync(path.join(f.root,f.source),readFileSync(path.join(f.root,f.source),'utf8')+'-- changed\n'),f=>writeFileSync(path.join(f.root,'.local/db.log'),'raw_app_meta_data is of type jsonb but expression is of type text changed')]){const f=fixture();try{mutate(f);assert.throws(()=>reviewedSetupRecipe(f.snapshot),/stale|mismatch/)}finally{f.cleanup()}}
})
test('unrun obligation inherits exact executed command accounting without receiving PASS or a receipt',()=>{
 const f=fixture();try{
  const c=f.snapshot.verification_results[0];c.metadata.failure_evidence.classification='PRODUCT_DEFECT';c.metadata.failure_evidence.origin='application-sql'
  const blocked={verification_id:3,execution_id:330,verification_run_id:368,check_name:'obligation-15',command:c.command,status:'not_run',metadata:{required:true,selection_reason:'database_prerequisite_failed'}}
  f.snapshot.verification_results=[c,blocked]
  const before=JSON.stringify(blocked),audit=auditAttempts(f.snapshot)
  assert.equal(audit.consumed,1);assert.equal(audit.action,'product-repair');assert.equal(JSON.stringify(blocked),before)
  assert.equal(blocked.status,'not_run');assert.equal(blocked.trusted_receipt,undefined)
  c.metadata.failure_evidence.classification='VERIFIER_INFRA';assert.equal(auditAttempts(f.snapshot).consumed,0)
 }finally{f.cleanup()}
})
test('cross-execution, unregistered, different-command and ambiguous prerequisite claims remain unknown',()=>{
 const f=fixture();try{
  const c=f.snapshot.verification_results[0],blocked={command:c.command,status:'not_run',metadata:{selection_reason:'database_prerequisite_failed'}},e=f.snapshot.executions[0],v=f.snapshot.verification_runs[0]
  assert.equal(reviewedSameCommandPrerequisites(blocked,[c],e,v).length,1)
  assert.deepEqual(reviewedSameCommandPrerequisites({...blocked,command:'pnpm exec supabase db reset --local'},[c],e,v),[])
  assert.deepEqual(reviewedSameCommandPrerequisites(blocked,[c,c],e,v),[])
  assert.deepEqual(reviewedSameCommandPrerequisites(blocked,[{...c,trusted_receipt:null}],e,v),[])
  assert.deepEqual(reviewedSameCommandPrerequisites(blocked,[c],{...e,execution_id:331},v),[])
 }finally{f.cleanup()}
})
