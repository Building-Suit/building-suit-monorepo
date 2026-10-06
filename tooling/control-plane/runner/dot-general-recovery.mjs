import { createHash } from 'node:crypto'
// Families describe lifecycle semantics. Error strings and clocks never identify incidents.
export function recoveryFamily(health, snapshot={}) {
 if(snapshot.exhaustion_audit?.action==='investigate')return 'unknown-lifecycle'
 const task=snapshot.packet?.task??{},e=snapshot.executions?.at(-1),v=snapshot.verification_runs?.at(-1)
 if(task.status==='complete')return 'completion-credit'
 if(!health.task_id)return 'controller-acquisition'
 if(task.status==='passed'&&v?.status==='passed')return 'publication-handoff'
 if(e?.status==='running')return 'worker-transport'
 const cls=snapshot.retry_accounting?.classifications?.at(-1)?.classification
 if(snapshot.binding_recovery||snapshot.preexecution_binding_recovery||cls==='CONFIGURATION')return 'verifier-configuration'
 if(cls==='VERIFIER_INFRA')return 'verifier-infrastructure'
 if(cls==='REPOSITORY_WORKTREE')return 'repository-reconciliation'
 if(cls==='TRANSIENT_INFRASTRUCTURE')return 'transient-infrastructure'
 if(cls==='PRODUCT_DEFECT')return 'product-repair'
 if(v?.status==='running')return 'verifier-infrastructure'
 if(health.next_wake_at&&Date.parse(health.next_wake_at)<=Date.now())return 'timer-reconciliation'
 if(health.supervisor_lease?.owner)return 'lease-reconciliation'
 return 'unknown-lifecycle'
}
export function recoveryIdentity(h) {
 return createHash('sha256').update(JSON.stringify({run:h.run_id,task:h.task_id,execution:h.execution_id,state:'STUCK',dispatcher:'general-v1'})).digest('hex')
}
export function needsRecovery(h,now=Date.now()) {
 return !h?.history_only && (!h?.run_status||['running','failed'].includes(h.run_status)) && ['STUCK','WAITING_ADMISSION','RECONCILING'].includes(h?.state)&&h.operator_action_required===false&&!h.worker_alive&&now-Date.parse(h.observed_at)<90_000
}
export async function dispatchRecovery({health,snapshot,claim,start,now=Date.now()}) {
 if(!needsRecovery(health,now))return {claimed:false,reason:'progress_or_human_gate'}
 const family=recoveryFamily(health,snapshot)
 const result=await claim(health.run_id,recoveryIdentity(health),family,{health,safety_scope:'existing-bounded-run',runtime:'dot-general-v1'})
 if(result.claimed)await start(result.job)
 return result
}
export function validateIncidentRepair({files,regression,rootFamily,base,head}) {
 if(!/^[a-z][a-z0-9-]{1,80}$/.test(rootFamily)||!base||!head)throw Error('incident_scope_invalid')
 if(!files.length||!files.includes(regression)||!/^tooling\/control-plane\/tests\/[^/]+\.test\.mjs$/.test(regression))throw Error('incident_regression_required')
 for(const file of files) {
  if(!/^(tooling\/control-plane\/runner\/[^/]+\.mjs|tooling\/control-plane\/tests\/[^/]+\.test\.mjs|tooling\/control-plane\/SELFHEALING\.md)$/.test(file))throw Error('incident_repair_outside_runtime_scope')
 }
 return true
}
