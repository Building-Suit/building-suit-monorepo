import { createHash } from 'node:crypto'

export const DOT_CLASSES = Object.freeze({
 'verification-product-defect':'PRODUCT_DEFECT', 'verification-infrastructure':'VERIFIER_INFRA',
 'verification-configuration':'CONFIGURATION', 'verification-lifecycle':'VERIFIER_INFRA',
 'transient-infrastructure':'TRANSIENT_INFRASTRUCTURE', 'repository-state':'REPOSITORY_WORKTREE',
 'publication-reconciliation':'PUBLICATION_INFRA', 'external-wait':'EXTERNAL_EVIDENCE',
 'verification-required-check-unavailable':'EXTERNAL_EVIDENCE', 'decision-wait':'DECISION_REQUIRED',
 'operator-wait':'OPERATOR_AUTHORIZATION', 'publication-scope':'OPERATOR_AUTHORIZATION',
 'safety-stop':'TERMINAL_SAFETY', 'flaky-verification':'VERIFIER_INFRA',
})
export function dotClassification(value, reason) {
 if (reason === 'retry_budget_exhausted') return 'RETRY_BUDGET_EXHAUSTED'
 return DOT_CLASSES[value] ?? (Object.values(DOT_CLASSES).includes(value) ? value : 'UNKNOWN')
}
export function legacyClassification(value) {
 return Object.entries(DOT_CLASSES).find(([, v]) => v === value)?.[0] ?? value
}
export function incidentIdentity(snapshot, plan) {
 const execution = snapshot.executions?.at(-1)
 const failure = snapshot.failures?.filter(f => !f.resolved_at && f.execution_id === execution?.execution_id).at(-1)
 const fingerprint = createHash('sha256').update(JSON.stringify({class:dotClassification(plan.failure_class,plan.reason), reason:plan.reason, failure:failure?.failure_id, state:plan.fingerprint})).digest('hex')
 return {run_id:snapshot.workflow_run?.run_id,task_id:snapshot.packet.task.task_id,execution_id:execution?.execution_id ?? null,root_fingerprint:fingerprint,classification:dotClassification(plan.failure_class,plan.reason)}
}
// Explicit checks, never time since last event, determine whether progress is healthy.
export function knownBindingFailure(check) {
 return check.status === 'not_run' && new Set(['generator_disposable_fixture_runner_not_registered','missing_generated_fixture_boundary_runner','browser_configuration_discovery_failed','verification_plan_entry_unenforced']).has(check.selection_reason)
}
export function effectiveFailureClass(snapshot, fallback) {
 if (snapshot.binding_recovery?.classification==='CONFIGURATION') return 'verification-configuration'
 const e=snapshot.executions?.at(-1)
 const audited=snapshot.exhaustion_audit?.entries.find(c=>Number(c.execution_id)===Number(e?.execution_id))
 if(audited&&audited.classification!=='UNKNOWN')return legacyClassification(audited.classification)
 const reviewed=snapshot.retry_accounting?.classifications?.find(c=>Number(c.execution_id)===Number(e?.execution_id))
 if (reviewed) return reviewed.classification === 'OTHER' ? 'safety-stop' : legacyClassification(reviewed.classification)
 const failure=snapshot.failures?.filter(f=>!f.resolved_at && f.execution_id===e?.execution_id).at(-1)
 const checks=failure?.metadata?.verification_probe?.checks ?? failure?.metadata?.checks ?? e?.metadata?.verification_probe_failures ?? []
 const blocking=checks.filter(c=>c.required!==false && ['fail','not_run','unavailable'].includes(c.status))
 if(blocking.length && blocking.every(knownBindingFailure)) return 'verification-configuration'
 return legacyClassification(fallback)
}
export function parentContinuation({sameBranch, oldPresent, newPresent, ancestor, containsOld, dirty, workerActive}) {
 if (!sameBranch || !oldPresent || !newPresent) return {safe:false,reason:'ambiguous_parent_lineage'}
 if (containsOld && ancestor) return {safe:true,action:'continue-preserved-base',dirty_preserved:!!dirty,worker_preserved:!!workerActive}
 return {safe:false,reason:dirty || workerActive ? 'active_dirty_worktree_protected' : 'parent_diverged_requires_review'}
}
export function cleanupEligibility({activeReference,workerActive,clean,published,integrated,openChild,uniqueWork}) {
 return !activeReference && !workerActive && clean && published && integrated && !openChild && !uniqueWork
}
export function repairEvidenceHeader(snapshot, attempt) {
 const e=snapshot.executions?.at(-1)
 const checks=snapshot.verification_results ?? []
 return JSON.stringify({run_id:snapshot.workflow_run?.run_id,task_id:snapshot.packet.task.task_id,execution_id:e?.execution_id,attempt,
 classification:effectiveFailureClass(snapshot,snapshot.failures?.at(-1)?.failure_class),worktree:e?.worktree_path,
 allowed_paths:snapshot.packet.task.allowed_paths,requirements:snapshot.packet.requirements,acceptance:snapshot.packet.task.acceptance_criteria,
 failed_checks:checks.filter(c=>c.status!=='pass'),successful_checks:checks.filter(c=>c.status==='pass'),failures:snapshot.failures,
 required_regression:snapshot.packet.task.verification_plan,preservation:'Same run/task/worktree; preserve successful work and evidence.',
 prohibited_actions:['merge','deploy','main promotion','hosted product migration','secret/provider change','scope expansion','waive security or advisor evidence','fabricate verification']},null,2)
}

export function workerProcessClassification(result) {
 if(result?.classification?.failure_class) return { ...result.classification, failure_class:legacyClassification(result.classification.failure_class) }
 const text=[result?.stderr,result?.stdout,result?.error].filter(Boolean).join('\n')
 if(/E2BIG|worker_(?:spawn|stdin|transport|launcher)_|receipt_writer_interrupted/.test(text)) return {failure_class:'transient-infrastructure',recovery_action:'wait-external',component:'worker-transport'}
 if(/chatgpt_authentication_required|not logged in|please (?:log|sign) in|authentication (?:expired|revoked)|refresh token.*(?:expired|invalid|reused)|401 Unauthorized/i.test(text)) return {failure_class:'operator-wait',recovery_action:'wait-operator'}
 return {failure_class:'transient-infrastructure',recovery_action:'wait-external'}
}
