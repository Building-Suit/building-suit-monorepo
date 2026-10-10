import {readFileSync} from 'node:fs'
import {classifyHealth} from './dot-health-state.mjs'
import {workerInventory,observeProcesses} from './dot-health-collector.mjs'
export const currentStateSql=()=>readFileSync(new URL('./dot-health-inputs.sql',import.meta.url),'utf8')
export function classifyCurrent(inputs,root,now=Date.now(),inventory=workerInventory(root,now)){
 return inputs.map(input=>classifyHealth(input,observeProcesses(input,root,inventory,now),now))
}
export function healthOverview(rows,now=Date.now()){
 return {collected_at:new Date(now).toISOString(),collection_interval_seconds:120,rows,alerts:[],llm_used:false}
}
// Waiting gates remain exact authorities. A changed passing verification can
// require reacceptance even while an earlier gate still appears in health.
export function requiresWatchdogAction(input,health,now=Date.now()){
 const incident=input.incident_recovery,receipt=input.recovery
 const dueReceipt=receipt?.status==='active'&&receipt.recoverable===true&&['runtime_operation_in_flight','runtime_backoff_pending','malformed_child_response'].includes(receipt.error_code)&&['task-run','task-verify','task-publish'].includes(input.operation?.action)&&Date.parse(receipt.next_wake_at)<=now
 if(incident&&['queued','running'].includes(incident.status)&&Date.parse(incident.claim_until)>now&&Date.parse(incident.next_check_at)>now&&!dueReceipt)return false
 if(health.worker_alive&&health.state!=='STUCK')return false
 if(health.state==='WAITING_OPERATOR')return input.task?.status==='complete'||input.verification?.status==='passed'&&input.task?.status==='failed'
 if(health.state==='WAITING_TIMER')return Date.parse(health.next_wake_at)<=now
 if(['WAITING_DEPENDENCY','INVESTIGATING','RUNNING','VERIFYING','REPAIRING','PUBLISHING','FAILED'].includes(health.state))return false
 return true
}
export function cycleEvidenceCache(load){
 const cache=new Map()
 return {get(task){if(!cache.has(task))cache.set(task,load(task));return cache.get(task)},invalidate(task){cache.delete(task)}}
}
