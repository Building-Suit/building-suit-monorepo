import { createHash } from 'node:crypto'
import { resolveVerificationPlan } from './verification-mode.mjs'
import { mergeVerificationConfig } from '../lib/workstream-readiness.mjs'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function boundedVerificationReadiness(packets, maxTasks) {
  if (!Number.isSafeInteger(maxTasks) || maxTasks < 1 || packets.length !== maxTasks) {
    return {ready:false,gate:{type:'bounded-task-set',reason:'exact_bounded_task_set_required'},plans:[]}
  }
  const tasks = new Set(packets.map(p => p.task?.task_id))
  if (tasks.size !== packets.length || tasks.has(undefined)) return {ready:false,gate:{type:'bounded-task-set',reason:'ambiguous_task_identity'},plans:[]}
  const plans = []
  for (const packet of packets) {
    const config = mergeVerificationConfig(packet.project?.verification_config,packet.workstream?.verification_config)
    const entries = packet.task.verification_plan ?? []
    const obligations = entries.map(entry => {
      const resolved = resolveVerificationPlan({entries:[entry],configuredCommands:config.commands ?? [],legacyMappings:config.legacy_plan_mappings ?? {},phase:'pre_implementation'})
      const pending = [...resolved.deferred,...resolved.blockers]
      const planned = pending.find(x => x.kind === 'planned_test' && x.expected_outputs?.length)
      const external = pending.find(x => ['external_gate','human_gate'].includes(x.kind))
      const category = planned ? 'TASK_OWNED_OUTPUT' : external ? 'EXTERNAL_EVIDENCE'
        : resolved.unenforced.length || resolved.blockers.length || !resolved.checks.length ? 'UNRESOLVED_CONFIG' : 'EXISTING_EXECUTABLE'
      return {entry,category,checks:resolved.checks,expected_outputs:planned?.expected_outputs ?? [],external_gate:external ?? null,
        reasons:[...resolved.unenforced,...resolved.blockers]}
    })
    const plan = {version:1,task_id:packet.task.task_id,input_generation:packet.task.input_generation ?? null,obligations,
      configuration_fingerprint:digest(config),plan_fingerprint:digest({entries,config})}
    plans.push(plan)
    const unresolved=obligations.find(x=>x.category==='UNRESOLVED_CONFIG')
    if (unresolved) return {ready:false,gate:{type:'verification-configuration',task_id:packet.task.task_id,reason:'whole_bound_verification_mapping_required',obligation:unresolved.entry},plans}
  }
  return {ready:true,gate:null,plans,fingerprint:digest(plans)}
}
