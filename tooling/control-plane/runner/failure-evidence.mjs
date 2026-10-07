import {validateTrustedReceipt} from './trusted-verifier-receipt.mjs'
import {createHash} from 'node:crypto'
export const FAILURE_CATEGORIES=['PRODUCT_DEFECT','VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE','PUBLICATION_INFRA','EXTERNAL_EVIDENCE','UNKNOWN']
export const evidenceDigest=value=>createHash('sha256').update(value).digest('hex')
// Categories are reviewed results, never inferred from a generic nonzero exit.
export function failureEvidence({execution_id,verification_run_id,check,artifact,classification='UNKNOWN',phase='test',origin='unknown',result={},review=null}) {
 if(!FAILURE_CATEGORIES.includes(classification))throw Error('unknown_evidence_category')
 return {version:2,source_fingerprint:check.trusted_receipt?.source_fingerprint??null,execution_id:Number(execution_id),verification_run_id:Number(verification_run_id),check_id:check.verification_id??null,check_name:check.name??check.check_name,command:check.command,exit_code:check.exit_code,status:check.status,classification,phase,origin,result,artifact:{path:check.log_path??null,sha256:evidenceDigest(artifact??'')},review}
}
export function validateFailureEvidence(e,{execution_id,verification_run_id,check,artifactRoot,sourceRoot}) {
 if(e?.version!==2||e.check_id!==(check.verification_id??null)||!FAILURE_CATEGORIES.includes(e.classification)||e.execution_id!==Number(execution_id)||e.verification_run_id!==Number(verification_run_id)||e.check_name!==(check.name??check.check_name)||e.command!==check.command||e.exit_code!==check.exit_code||e.status!==check.status||e.artifact?.path!==check.log_path||!/^[a-f0-9]{64}$/.test(e.artifact?.sha256??''))throw Error('failure_evidence_binding_mismatch')
 if(e.classification==='PRODUCT_DEFECT'&&(!['product-test','application-sql','application-http','application-behavior'].includes(e.origin)||!e.review?.root_cause||!e.review?.source?.length))throw Error('reviewed_product_evidence_required')
 if(e.classification==='PRODUCT_DEFECT')validateTrustedReceipt(e,check,{executionId:execution_id,verificationRunId:verification_run_id,artifactRoot,sourceRoot})
 return e
}
export function reconcileFailureEvidence(check,execution,verification) {
 const e=check.metadata?.failure_evidence??check.failure_evidence
 if(!e)return {classification:'UNKNOWN',action:'expand-execution-artifacts'}
 try{validateFailureEvidence(e,{execution_id:execution.execution_id,verification_run_id:verification.verification_run_id,check,artifactRoot:execution.worktree_path,sourceRoot:execution.worktree_path});return {classification:e.classification,action:e.classification==='UNKNOWN'?'incident-investigate':'classified',evidence:e}}
 catch{return {classification:'UNKNOWN',action:'incident-investigate'}}
}

export function processFailureCategory(result,missingEvidence=false){
 if(missingEvidence)return 'CONFIGURATION'
 if(result.error?.code==='E2BIG')return 'TRANSIENT_INFRASTRUCTURE'
 if(['ENOENT','EACCES'].includes(result.error?.code))return 'CONFIGURATION'
 return 'UNKNOWN' // Timeouts/signals may originate in product or harness code.
}
