import { readFileSync, existsSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
export const strictBoundaryCommand = 'node tooling/checks/suit-template-boundaries.mjs --require-strict'
// Only an exact reviewed executable may repair this stale planned binding.
export function strictBindingRecoveryEvidence(snapshot) {
 const execution=snapshot.executions?.at(-1)
 const verification=snapshot.verification_runs?.filter(v=>v.execution_id===execution?.execution_id).at(-1)
 if (!execution?.worktree_path || snapshot.packet?.task?.status!=='failed' || verification?.status!=='failed') return null
 const checks=(snapshot.verification_results??[]).filter(c=>c.verification_run_id===verification.verification_run_id && c.metadata?.required!==false && ['fail','not_run','unavailable'].includes(c.status))
 if (!checks.length || !checks.every(c=>c.status==='not_run' && c.metadata?.selection_reason==='missing_strict_boundary_runner')) return null
 if (!(snapshot.packet.task.verification_plan??[]).includes(strictBoundaryCommand)) return null
 if (!existsSync(execution.worktree_path)) return null
 const root=realpathSync(execution.worktree_path), file=path.join(root,'tooling/checks/suit-template-boundaries.mjs')
 if (!existsSync(file) || !realpathSync(file).startsWith(root+path.sep)) return null
 const source=readFileSync(file,'utf8')
 if (!source.includes("args.includes('--require-strict')") || !source.includes('validateSuitTemplateBoundaries')) return null
 return {execution_id:execution.execution_id,verification_run_id:verification.verification_run_id,command:strictBoundaryCommand,runner_path:'tooling/checks/suit-template-boundaries.mjs',runner_sha256:createHash('sha256').update(source).digest('hex'),classification:'CONFIGURATION',checks:checks.map(c=>c.check_name)}
}
