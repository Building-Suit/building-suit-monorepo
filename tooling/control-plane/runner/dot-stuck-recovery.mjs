import { createHash } from 'node:crypto'
export function stuckRecoveryCandidate(health,now=Date.now()) {
 if(health?.state!=='STUCK'||health.operator_action_required!==false)return false
 return !health.worker_alive && !health.controller_lease?.valid && !health.supervisor_lease?.valid && !(Date.parse(health.next_wake_at)>now) && now-Date.parse(health.observed_at)<90_000
}
export function stuckIncidentFingerprint(health) {
 return createHash('sha256').update(JSON.stringify({run:health.run_id,task:health.task_id,execution:health.execution_id,state:'STUCK'})).digest('hex')
}
