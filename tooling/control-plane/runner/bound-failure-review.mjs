import path from 'node:path'
import {registeredVerifierRecipes,selectVerifierRecipe} from './verifier-fixture-repair.mjs'
import {readFileSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {readBoundArtifact,validateTrustedReceipt} from './trusted-verifier-receipt.mjs'
import {failureEvidence,validateFailureEvidence} from './failure-evidence.mjs'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
// Prepare independently reviewed evidence; this function never writes live state.
// Installation must submit these proposals through review_verification_failure
// with the existing trusted verifier capability, after rebinding current evidence.
export function prepareBoundFailureReviews({execution,verification,checks,reviews}){
 return checks.filter(c=>c.verification_run_id===verification.verification_run_id&&c.status==='fail'&&c.metadata?.required!==false).map(check=>{
  const review=reviews[check.check_name]
  if(!review)throw Error('exact_failed_check_review_required')
  const bytes=readBoundArtifact(check.log_path,execution.worktree_path)
  if(sha(bytes)!==review.artifact_sha256)throw Error('review_artifact_changed')
  const source=review.source_paths.map(file=>({path:file,sha256:sha(readBoundArtifact(path.join(execution.worktree_path,file),execution.worktree_path))}))
  const evidence=failureEvidence({execution_id:execution.execution_id,verification_run_id:verification.verification_run_id,check,artifact:bytes,classification:review.classification,origin:review.origin,phase:review.phase??'test',result:review.result??{},review:{root_cause:review.root_cause,source}})
  validateTrustedReceipt(evidence,check,{executionId:execution.execution_id,verificationRunId:verification.verification_run_id,artifactRoot:execution.worktree_path,sourceRoot:execution.worktree_path})
  validateFailureEvidence(evidence,{execution_id:execution.execution_id,verification_run_id:verification.verification_run_id,check,artifactRoot:execution.worktree_path,sourceRoot:execution.worktree_path})
  return {verification_id:check.verification_id,evidence}
 })
}

export function registeredFailureReviews(snapshot, sourceRoot) {
 const file=path.join(sourceRoot,'tooling/control-plane/verifier-repairs/sas-billing-reviews.json')
 const registered=selectVerifierRecipe(snapshot,registeredVerifierRecipes(sourceRoot))
 const catalog=registered?.reviews?registered:existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null
 if(!catalog)return []
 const task=snapshot.packet?.task,execution=snapshot.executions?.at(-1)
 const verification=snapshot.verification_runs?.filter(v=>Number(v.execution_id)===Number(execution?.execution_id)).at(-1)
 if(task?.task_id!==catalog.task_id||task.status!=='failed'||execution?.status!=='succeeded'||verification?.status!=='failed')return []
 if(snapshot.workflow_run?.status!=='running'||snapshot.workflow_run.stop_requested||snapshot.workflow_run.maintenance_requested)return []
 if(snapshot.recovery?.status==='active'&&(Date.parse(snapshot.recovery.lease_expires_at)>Date.now()||['wait-operator','wait-decision','safety-stop'].includes(snapshot.recovery.next_action)))return []
 const checks=(snapshot.verification_results??[]).filter(c=>Number(c.verification_run_id)===Number(verification.verification_run_id)&&c.status==='fail'&&c.metadata?.required!==false)
 if(checks.length!==Object.keys(catalog.reviews).length||checks.some(c=>catalog.reviews[c.check_name]?.artifact_sha256!==c.trusted_receipt?.artifact?.sha256))return []
 const prepared=prepareBoundFailureReviews({execution,verification,checks,reviews:catalog.reviews})
 return prepared.filter(p=>{
  const current=checks.find(c=>Number(c.verification_id)===Number(p.verification_id))?.metadata?.failure_evidence
  if(current?.classification==='PRODUCT_DEFECT'&&p.evidence.classification!=='PRODUCT_DEFECT')return false
  return current?.classification!==p.evidence.classification||current?.artifact?.sha256!==p.evidence.artifact.sha256||JSON.stringify(current?.review?.source)!==JSON.stringify(p.evidence.review.source)
 })
}
