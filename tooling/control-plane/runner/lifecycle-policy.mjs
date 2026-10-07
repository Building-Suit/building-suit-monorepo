import {createHash} from 'node:crypto'

const lanes=['PRODUCT_DEFECT','VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE','PUBLICATION_INFRA','UNKNOWN','HUMAN_AUTHORITY','EXTERNAL_EVIDENCE']
const legacy={ 'verification-infrastructure':'VERIFIER_INFRA','verification-lifecycle':'VERIFIER_INFRA','verification-configuration':'CONFIGURATION','transient-infrastructure':'TRANSIENT_INFRASTRUCTURE','repository-state':'REPOSITORY_WORKTREE','publication-reconciliation':'PUBLICATION_INFRA','operator-wait':'HUMAN_AUTHORITY','publication-scope':'HUMAN_AUTHORITY','decision-wait':'HUMAN_AUTHORITY','external-wait':'EXTERNAL_EVIDENCE','verification-required-check-unavailable':'EXTERNAL_EVIDENCE' }
// Callers validate receipts against source/artifacts before passing trusted rows.
// Missing or mixed unknown evidence never silently becomes a product defect.
export function canonicalFailure({trusted=[],legacy:old,authority=false}={}) {
 if(authority)return 'HUMAN_AUTHORITY'
 if(trusted.length){
  const values=trusted.map(e=>lanes.includes(e.classification)?e.classification:'UNKNOWN')
  if(values.includes('UNKNOWN'))return 'UNKNOWN'
  if(values.includes('PRODUCT_DEFECT'))return trusted.filter(e=>e.classification==='PRODUCT_DEFECT').every(e=>e.version===2&&e.review?.root_cause&&e.review.source?.length)?'PRODUCT_DEFECT':'UNKNOWN'
  return ['HUMAN_AUTHORITY','CONFIGURATION','VERIFIER_INFRA','REPOSITORY_WORKTREE','PUBLICATION_INFRA','TRANSIENT_INFRASTRUCTURE','EXTERNAL_EVIDENCE'].find(lane=>values.includes(lane))??'UNKNOWN'
 }
 return legacy[old]??'UNKNOWN'
}
function stable(value){
 if(Array.isArray(value))return value.map(stable)
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]))
 return value
}
// Verification row IDs, timestamps, audit versions and scheduler claims are
// observations. Only changed executable inputs or failure semantics grant work.
export function recoveryFingerprint(input){
 const checks=(input.checks??[]).map(c=>({name:c.name??c.check_name,status:c.status,command:c.command,exit_code:c.exit_code,classification:c.classification,root_cause:c.root_cause})).sort((a,b)=>String(a.name).localeCompare(String(b.name)))
 return createHash('sha256').update(JSON.stringify(stable({task_id:input.task_id,run_id:input.run_id,execution_id:input.execution_id,attempt:input.attempt,source:input.source,plan:input.plan,verifier:input.verifier,configuration:input.configuration,classification:input.classification,checks}))).digest('hex')
}
export function watchdogIntervention(input,health,now=Date.now()){
 if(['WAITING_OPERATOR','WAITING_DEPENDENCY'].includes(health.state))return false
 if(health.worker_alive&&health.state!=='STUCK')return false
 if(health.state==='STUCK'||input.run?.status==='failed')return true
 if(['INVESTIGATING','FAILED'].includes(health.state))return true
 const progress=Date.parse(input.last_progress_at??input.task?.updated_at??input.run?.updated_at)
 // The lifecycle consumer owns immediate handoffs/timers. Dot gets a bounded
 // grace period to detect a dead/missing consumer, never the ordinary handoff.
 return Number.isFinite(progress)&&now-progress>180000&&['RUNNING','VERIFYING','REPAIRING','PUBLISHING','WAITING_TIMER'].includes(health.state)
}
export async function runSupervisorLifecycle({gate,prepare,acquire,supervise,credit,maxSteps=25}){
 for(let step=0;step<maxSteps;step++){
  const admission=await gate()
  if(!admission.should_continue)return {ok:true,status:admission.reason,run:admission}
  await prepare()
  const acquisition=await acquire()
  if(!acquisition.acquired&&acquisition.action!=='credit_completion')return {ok:true,status:'wait',acquisition}
  const task=acquisition.packet?.task?.task_id??acquisition.task_id
  if(!task)throw Error('acquisition_task_identity_missing')
  const response=acquisition.action==='credit_completion'?{ok:true,status:'terminal',recovery:{reason:'task_complete'}}:await supervise(task)
  if(response.ok&&response.status==='terminal'&&response.recovery?.reason==='task_complete'){await credit(task);continue}
  return {ok:true,task_id:task,status:response.status,response}
 }
 return {ok:true,status:'time-slice-yield'}
}
