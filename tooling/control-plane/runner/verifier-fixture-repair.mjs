import {existsSync,mkdirSync,readFileSync,writeFileSync,lstatSync,realpathSync,renameSync} from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {validateTrustedReceipt,readBoundArtifact} from './trusted-verifier-receipt.mjs'
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
 const root=realpathSync(execution.worktree_path)
 const checks=(snapshot.verification_results??[]).filter(c=>Number(c.verification_run_id)===Number(verification.verification_run_id)&&c.metadata?.required!==false&&['fail','not_run','unavailable'].includes(c.status))
 if(checks.length!==recipe.checks.length||checks.some(c=>!recipe.checks.some(expected=>expected.name===c.check_name&&expected.artifact_sha256===c.trusted_receipt?.artifact?.sha256)))return {applied:false,reason:'reviewed_recipe_evidence_mismatch'}
 const targets=recipe.files.map(file=>{
  if(!/^apps\/[a-z-]+\/((supabase\/tests\/[^/]+\.test\.sql)|(tests\/e2e\/[^/]+\.(ts|mjs)))$/.test(file.path))throw Error('verifier_test_path_required')
  const target=path.join(root,file.path);let parent=root
  for(const part of file.path.split('/').slice(0,-1)){parent=path.join(parent,part);if(!existsSync(parent)||lstatSync(parent).isSymbolicLink())throw Error('verifier_path_boundary_required')}
  const before=existsSync(target)?digest(readBoundArtifact(target,root)):null
  if(digest(file.content)!==file.after_sha256||![file.before_sha256,file.after_sha256].includes(before))throw Error('verifier_recipe_source_changed')
  return {...file,target,before}
 })
 if(targets.every(f=>f.before===f.after_sha256))return {applied:false,reason:'already_repaired'}
 // Validate every exact trusted failure and all original source bytes BEFORE edits.
 for(const c of checks){const evidence=c.metadata?.failure_evidence;if(evidence?.classification!=='VERIFIER_INFRA')throw Error('trusted_verifier_review_required');validateTrustedReceipt(evidence,c,{executionId:execution.execution_id,verificationRunId:verification.verification_run_id,artifactRoot:root,sourceRoot:root})}
 if(targets.some(f=>f.before===f.after_sha256))throw Error('partial_verifier_repair_requires_reconciliation')
 for(const f of targets){const temporary=f.target+'.verifier-repair.tmp';writeFileSync(temporary,f.content,{mode:0o600,flag:'wx'});renameSync(temporary,f.target)}
 const receipt={version:1,recipe_id:recipe.id,execution_id:execution.execution_id,verification_run_id:verification.verification_run_id,classification:'VERIFIER_INFRA',product_attempts:0,files:targets.map(f=>({path:f.path,before:f.before_sha256,after:f.after_sha256}))}
 const directory=path.join(root,'.local/verification-inputs');mkdirSync(directory,{recursive:true,mode:0o700});writeFileSync(path.join(directory,'verifier-fixture-repair.json'),JSON.stringify(receipt)+'\n',{mode:0o600})
 return {applied:true,receipt}
}
export function repairRegisteredVerifierFixtures(snapshot,sourceRoot){
 const catalog=path.join(sourceRoot,'tooling/control-plane/verifier-repairs/shop-cash-policy.json')
 if(!existsSync(catalog))return {applied:false,reason:'no_registered_fixture_repair'}
 return applyVerifierFixtureRepair(snapshot,JSON.parse(readFileSync(catalog,'utf8')))
}
