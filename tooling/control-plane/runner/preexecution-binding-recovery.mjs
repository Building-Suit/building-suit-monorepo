import { existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { mergeVerificationConfig } from '../lib/workstream-readiness.mjs'
import { resolveVerificationPlan } from './verification-mode.mjs'
export const reviewedAuthBindings = JSON.parse(readFileSync(new URL('./shop-auth-bindings.json', import.meta.url), 'utf8'))
export const reviewedTeamBindings = JSON.parse(readFileSync(new URL('./shop-team-bindings.json', import.meta.url), 'utf8'))
export function preexecutionBindingEvidence(snapshot, repositoryRoot = process.cwd()) {
 const t=snapshot.packet?.task,r=snapshot.workflow_run
 const c=[reviewedAuthBindings,reviewedTeamBindings].find(c=>c.task_id===t?.task_id)
 if(!c) return null
 if(t?.task_id!==c.task_id || snapshot.packet?.workstream?.slug!==c.workstream_slug || !['ready','in_progress'].includes(t.status) || snapshot.executions?.length
 || r?.status!=='running' || r.current_task_id!==t.task_id || r.stop_requested || r.maintenance_requested || r.completed_tasks>=r.max_tasks
 || snapshot.run_publication_authority?.authorized!==true || JSON.stringify(t.verification_plan)!==JSON.stringify(c.entries)) return null
 const config=mergeVerificationConfig(snapshot.packet.project?.verification_config,snapshot.packet.workstream?.verification_config)
 const plan=resolveVerificationPlan({entries:c.entries,configuredCommands:config.commands,legacyMappings:config.legacy_plan_mappings,phase:'pre_implementation'})
 if(!plan.unenforced.length || plan.blockers.length) return null
 const sourceRoot=path.resolve(repositoryRoot,snapshot.packet.project?.local_repository_root ?? '.')
 if(!sourceRoot || !existsSync(sourceRoot)) return null
 const root=realpathSync(sourceRoot),files={}
 for(const relative of c.files) {
  const file=path.join(root,relative)
  if(!existsSync(file) || !realpathSync(file).startsWith(root+path.sep)) return null
  files[relative]=createHash('sha256').update(readFileSync(file)).digest('hex')
 }
 const pkg=JSON.parse(readFileSync(path.join(root,c.files[0]),'utf8'))
 if(pkg.name!=='@building-suit/shop-suit' || pkg.scripts?.typecheck!=='nuxt typecheck' || pkg.scripts?.lint!=='eslint .' || pkg.scripts?.build!=='nuxt build') return null
 return {task_id:t.task_id,run_id:r.run_id,classification:'CONFIGURATION',execution_count:0,config:c.config,files,plan:c.entries}
}
export function preexecutionBindingWake(snapshot,recovery) {
 return !!snapshot?.preexecution_binding_recovery && recovery?.error_code==='verification_plan_mapping_required'
 && recovery.failure_class==='verification-configuration' && recovery.next_action==='wait-operator'
}
