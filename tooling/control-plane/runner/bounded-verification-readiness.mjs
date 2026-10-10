import { existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolveVerificationPlan } from './verification-mode.mjs'
import { mergeVerificationConfig } from '../lib/workstream-readiness.mjs'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function executableReadiness(check, repositoryRoot) {
  if (!repositoryRoot || !existsSync(repositoryRoot)) return 'verification_repository_missing'
  const root = realpathSync(repositoryRoot)
  const cwd = path.resolve(root, check.cwd ?? '.')
  if (cwd !== root && !cwd.startsWith(root + path.sep)) return 'verification_cwd_outside_repository'
  if (!existsSync(cwd)) return 'verification_cwd_missing'
  const executable = spawnSync('/usr/bin/env', ['which', check.program], {encoding:'utf8'})
  if (executable.status !== 0) return 'verification_executable_missing'
  const args = check.args ?? []
  const required = [...(check.required_files ?? [])]
  if (check.program === 'node') {
    for (const argument of args) {
      if (!argument.startsWith('-') && /\.(?:mjs|cjs|js|ts)$/.test(argument)) required.push(argument)
    }
  }
  if (check.program === 'pnpm' && args.length === 1 && !args[0].startsWith('-')) {
    try {
      const manifest = JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8'))
      if (!manifest.scripts?.[args[0]]) return 'verification_package_script_missing'
    } catch { return 'verification_package_manifest_missing' }
  }
  for (const file of required) {
    const target = path.resolve(cwd, file)
    if (!existsSync(target)) return 'pre_existing_verification_artifact_missing'
    const resolved = realpathSync(target)
    if (!resolved.startsWith(root + path.sep)) return 'verification_artifact_outside_repository'
  }
  return null
}

export function boundedVerificationReadiness(packets, maxTasks, { sourceRoot, requireExecutables = false } = {}) {
  if (!Number.isSafeInteger(maxTasks) || maxTasks < 1 || packets.length !== maxTasks) {
    return {ready:false,gate:{type:'bounded-task-set',reason:'exact_bounded_task_set_required'},plans:[]}
  }
  const tasks = new Set(packets.map(p => p.task?.task_id))
  if (tasks.size !== packets.length || tasks.has(undefined)) return {ready:false,gate:{type:'bounded-task-set',reason:'ambiguous_task_identity'},plans:[]}
  const plans = [], gates = []
  for (const packet of packets) {
    const config = mergeVerificationConfig(packet.project?.verification_config,packet.workstream?.verification_config)
    const entries = packet.task.verification_plan ?? []
    const obligations = entries.map(entry => {
      const resolved = resolveVerificationPlan({entries:[entry],configuredCommands:config.commands ?? [],legacyMappings:config.legacy_plan_mappings ?? {},phase:'pre_implementation'})
      const pending = [...resolved.deferred,...resolved.blockers]
      const planned = pending.find(x => x.kind === 'planned_test' && x.expected_outputs?.length)
      const external = pending.find(x => ['external_gate','human_gate'].includes(x.kind))
      let category = planned ? 'TASK_OWNED_OUTPUT' : external ? 'EXTERNAL_EVIDENCE'
        : resolved.unenforced.length || resolved.blockers.length || !resolved.checks.length ? 'UNRESOLVED_CONFIG' : 'EXISTING_EXECUTABLE'
      const filesystemReasons = requireExecutables && category === 'EXISTING_EXECUTABLE'
        ? resolved.checks.map(check => executableReadiness(check, path.resolve(sourceRoot, packet.project?.local_repository_root ?? '.'))).filter(Boolean)
        : []
      if (filesystemReasons.length) category = 'UNRESOLVED_CONFIG'
      return {entry,category,checks:planned?.registered_checks??resolved.checks,expected_outputs:planned?.expected_outputs ?? [],external_gate:external ?? null,
        reasons:[...resolved.unenforced,...resolved.blockers,...filesystemReasons]}
    })
    const prerequisiteBindings=(packet.dependencies??[]).map(dep=>({task_id:dep.task_id,dependency_type:dep.dependency_type})).sort((a,b)=>a.task_id.localeCompare(b.task_id)||a.dependency_type.localeCompare(b.dependency_type))
    const plan = {version:1,prerequisite_bindings:prerequisiteBindings,inputs:{verification_plan:entries,project_configuration:packet.project?.verification_config??{},workstream_configuration:packet.workstream?.verification_config??{}},task_id:packet.task.task_id,input_generation:packet.task.input_generation ?? null,obligations,
      configuration_fingerprint:digest(config),plan_fingerprint:digest({entries,config,prerequisiteBindings})}
    plans.push(plan)
    const unresolved=obligations.find(x=>x.category==='UNRESOLVED_CONFIG')
    if (unresolved) gates.push({type:'verification-configuration',task_id:packet.task.task_id,reason:'whole_bound_verification_mapping_required',obligation:unresolved.entry})
  }
  return {ready:gates.length===0,gate:gates[0]??null,gates,plans,fingerprint:digest(plans)}
}
