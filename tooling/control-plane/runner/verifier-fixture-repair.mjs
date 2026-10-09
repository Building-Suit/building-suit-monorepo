import {existsSync,mkdirSync,readFileSync,writeFileSync,lstatSync,realpathSync,renameSync} from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {validateTrustedReceipt,readBoundArtifact} from './trusted-verifier-receipt.mjs'
const catalogNames=['shop-cash-policy.json','shop-solo-trial-catalog.json','shop-solo-renewal-fixture.json','shop-solo-lifecycle-fixtures.json','shop-solo-concurrency-fixture.json']
export function registeredVerifierRecipes(sourceRoot=new URL('../../..',import.meta.url).pathname){
 return catalogNames.map(name=>path.join(sourceRoot,'tooling/control-plane/verifier-repairs',name)).filter(existsSync).map(file=>JSON.parse(readFileSync(file,'utf8')))
}
export function selectVerifierRecipe(snapshot,recipes){
 const execution=snapshot.executions?.at(-1),verification=snapshot.verification_runs?.filter(v=>Number(v.execution_id)===Number(execution?.execution_id)).at(-1)
 return recipes.find(r=>r.task_id===snapshot.packet?.task?.task_id&&(!r.execution_id||Number(r.execution_id)===Number(execution?.execution_id))&&(!r.verification_run_id||Number(r.verification_run_id)===Number(verification?.verification_run_id)))
}
// Accounting inherits genuine prerequisite evidence only. The blocked check remains unrun.
export function registeredVerifierPrerequisites(check,checks,execution,verification,recipes=registeredVerifierRecipes()){
 const recipe=recipes.find(r=>Number(r.execution_id)===Number(execution.execution_id)&&Number(r.verification_run_id)===Number(verification?.verification_run_id)&&r.task_id===execution.task_id)
 const blocked=recipe?.blocked_checks?.find(b=>b.name===(check.name??check.check_name)&&Number(b.verification_id)===Number(check.verification_id))
 if(!blocked||check.status!=='not_run'||(check.selection_reason??check.metadata?.selection_reason)!==blocked.selection_reason||check.trusted_receipt)return []
 const prerequisites=blocked.prerequisites.map(name=>checks.find(c=>(c.name??c.check_name)===name))
 if(prerequisites.some(c=>!c||c.status!=='fail'||!recipe.checks.some(expected=>expected.name===(c.name??c.check_name)&&Number(expected.verification_id)===Number(c.verification_id)&&expected.artifact_sha256===c.trusted_receipt?.artifact?.sha256)))return []
 return prerequisites
}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')

// Exact reviewed patches inside the existing verifier-infrastructure lane.
// No implementation execution, provider operation, or product source write.
export function applyVerifierFixtureRepair(snapshot,recipe) {
 const execution=snapshot.executions?.at(-1)
 const verification=snapshot.verification_runs?.filter(v=>Number(v.execution_id)===Number(execution?.execution_id)).at(-1)
 if(snapshot.packet?.task?.task_id!==recipe.task_id||snapshot.packet.task.status!=='failed'||execution?.status!=='succeeded'||verification?.status!=='failed'
  ||snapshot.authoritative_failure?.classification!=='VERIFIER_INFRA'||snapshot.authoritative_failure?.evidence?.verification_run_id!==verification.verification_run_id)return {applied:false,reason:'current_trusted_verifier_failure_required'}
 if(snapshot.workflow_run&&(snapshot.workflow_run.status!=='running'||snapshot.workflow_run.stop_requested||snapshot.workflow_run.maintenance_requested))return {applied:false,reason:'run_held'}
 if(snapshot.recovery?.status==='active'&&['wait-operator','wait-decision','safety-stop'].includes(snapshot.recovery.next_action))return {applied:false,reason:'authority_boundary'}
 if(recipe.execution_id&&Number(recipe.execution_id)!==Number(execution.execution_id)||recipe.verification_run_id&&Number(recipe.verification_run_id)!==Number(verification.verification_run_id))return {applied:false,reason:'reviewed_recipe_identity_mismatch'}
 const root=realpathSync(execution.worktree_path)
 const checks=(snapshot.verification_results??[]).filter(c=>Number(c.verification_run_id)===Number(verification.verification_run_id)&&c.metadata?.required!==false&&['fail','not_run','unavailable'].includes(c.status))
 const blocked=checks.filter(c=>registeredVerifierPrerequisites(c,checks,execution,verification,[recipe]).length)
 const executed=checks.filter(c=>!blocked.includes(c))
 if(blocked.length!==(recipe.blocked_checks?.length??0)||executed.length!==recipe.checks.length||executed.some(c=>!recipe.checks.some(expected=>expected.name===c.check_name&&expected.artifact_sha256===c.trusted_receipt?.artifact?.sha256)))return {applied:false,reason:'reviewed_recipe_evidence_mismatch'}
 const targets=recipe.files.map(file=>{
  const legacyTrial=(recipe.id==='shop-solo-trial-catalog-v1'&&file.path==='apps/shop-suit/supabase/tests/shop_trial_onboarding.sql')||(recipe.id==='shop-solo-renewal-fixture-v1'&&file.path==='apps/shop-suit/supabase/tests/shop_plan_catalog_v2.sql')
  const lifecycleFixture=recipe.id==='shop-solo-lifecycle-fixtures-v1'&&file.path==='apps/shop-suit/supabase/tests/shop_subscription_lifecycle.sql'
  const concurrencyFixture=recipe.id==='shop-solo-concurrency-fixture-v1'&&recipe.task_id==='SS-LAUNCH-SOLO-VARIANTS-001'&&file.path==='tooling/database/test-shop-plan-limits-local.mjs'
  if(!legacyTrial&&!lifecycleFixture&&!concurrencyFixture&&!/^apps\/[a-z-]+\/((supabase\/tests\/[^/]+\.test\.sql)|(tests\/e2e\/[^/]+\.(ts|mjs)))$/.test(file.path))throw Error('verifier_test_path_required')
  const target=path.join(root,file.path);let parent=root
  for(const part of file.path.split('/').slice(0,-1)){parent=path.join(parent,part);if(!existsSync(parent)||lstatSync(parent).isSymbolicLink())throw Error('verifier_path_boundary_required')}
  const before=existsSync(target)?digest(readBoundArtifact(target,root)):null
  if(digest(file.content)!==file.after_sha256||![file.before_sha256,file.after_sha256].includes(before))throw Error('verifier_recipe_source_changed')
  return {...file,target,before}
 })
 if(targets.every(f=>f.before===f.after_sha256))return {applied:false,reason:'already_repaired'}
 // Validate every exact trusted failure and all original source bytes BEFORE edits.
 for(const c of executed){const evidence=c.metadata?.failure_evidence;if(evidence?.classification!=='VERIFIER_INFRA')throw Error('trusted_verifier_review_required');validateTrustedReceipt(evidence,c,{executionId:execution.execution_id,verificationRunId:verification.verification_run_id,artifactRoot:root,sourceRoot:root})}
 if(targets.some(f=>f.before===f.after_sha256))throw Error('partial_verifier_repair_requires_reconciliation')
 for(const f of targets){const temporary=f.target+'.verifier-repair.tmp';writeFileSync(temporary,f.content,{mode:0o600,flag:'wx'});renameSync(temporary,f.target)}
 const receipt={version:1,recipe_id:recipe.id,execution_id:execution.execution_id,verification_run_id:verification.verification_run_id,classification:'VERIFIER_INFRA',product_attempts:0,files:targets.map(f=>({path:f.path,before:f.before_sha256,after:f.after_sha256}))}
 const directory=path.join(root,'.local/verification-inputs');mkdirSync(directory,{recursive:true,mode:0o700});writeFileSync(path.join(directory,'verifier-fixture-repair.json'),JSON.stringify(receipt)+'\n',{mode:0o600})
 return {applied:true,receipt}
}
export function repairRegisteredVerifierFixtures(snapshot,sourceRoot){
 const recipe=selectVerifierRecipe(snapshot,registeredVerifierRecipes(sourceRoot))
 return recipe?applyVerifierFixtureRepair(snapshot,recipe):{applied:false,reason:'no_registered_fixture_repair'}
}
