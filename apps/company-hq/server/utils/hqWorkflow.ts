import { createHash } from 'node:crypto'
import { HqProblem } from './hqDomain'
import type { HqDocument, HqTask } from './hqDomain'
import { stages } from './hqWorkforce'
import type { BrainFile, BrainReference, StageEvidence, WorkflowRun } from './hqWorkforce'

export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export function requireWorkflow(ok: unknown, code: string): asserts ok {
  if (!ok) throw new HqProblem(409, code, 'Workflow blocked: ' + code)
}
export function dailySlot(now: number) {
  requireWorkflow(Number.isFinite(now), 'INVALID_TIME')
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]))
  return { localDate: `${parts.year}-${parts.month}-${parts.day}`, due: Number(parts.hour) >= 8 }
}
export function approvedTask(doc: HqDocument, taskId: string) {
  const task = doc.tasks.find(t => t.id === taskId)
  requireWorkflow(task?.approvedAt && task.workflow && task.budget === 0 && ['queued', 'running', 'review', 'blocked'].includes(task.status), 'APPROVAL_OR_CANCELLATION')
  return task
}
export const contractDigest = (task: HqTask) => digest([task.id, task.brief, task.acceptance, task.allowedActions, task.approvedAt, task.workflow])
export interface Lease { key: string; owner: string; generation: number }
export function leasedRun(doc: HqDocument, lease: Lease, now: number) {
  const run = doc.workflowRuns?.[lease.key]
  requireWorkflow(run && run.status === 'running' && run.owner === lease.owner && run.generation === lease.generation && run.leaseUntil > now, 'STALE_OR_CANCELLED_LEASE')
  requireWorkflow(run.contractDigest === contractDigest(approvedTask(doc, run.taskId)), 'CHANGED_APPROVAL')
  return run
}
export function claim(doc: HqDocument, taskId: string, owner: string, now: number, daily: boolean, leaseMs = 60_000): Lease | null {
  const existingTask = doc.tasks.find(t => t.id === taskId)
  if (existingTask && ['completed', 'cancelled'].includes(existingTask.status)) return null
  const task = approvedTask(doc, taskId), slot = dailySlot(now)
  requireWorkflow(task.workflow!.daily === daily, 'SCHEDULE_SCOPE')
  if (daily) requireWorkflow(slot.due && task.workflow!.timezoneConfirmed, 'SCHEDULE_NOT_DUE_OR_UNCONFIRMED')
  // One daily run per dedicated HQ database/company/date, even across tasks or timezone edits.
  const key = daily ? `company-hq:daily:${slot.localDate}` : `company-hq:task:${task.id}`
  doc.workflowRuns ||= {}
  const prior = doc.workflowRuns[key]
  if (prior) {
    requireWorkflow(prior.taskId === taskId && prior.contractDigest === contractDigest(task), 'DAILY_OR_CONTRACT_CONFLICT')
    if (['completed', 'cancelled'].includes(prior.status) || prior.leaseUntil > now) return null
  }
  const run: WorkflowRun = { ...prior, key, taskId, contractDigest: contractDigest(task), localDate: slot.localDate, status: 'running', owner, generation: (prior?.generation || 0) + 1, leaseUntil: now + leaseMs, evidenceBudget: 0, checkpoints: prior?.checkpoints || {}, attempts: prior?.attempts || [], failures: prior?.failures || [] }
  doc.workflowRuns[key] = run
  task.status = 'running'
  return { key, owner, generation: run.generation }
}
/** Renewal cannot revive an expired lease or overwrite a replacement owner. */
export function renewLease(doc: HqDocument, lease: Lease, now: number, leaseMs: number) {
  leasedRun(doc, lease, now).leaseUntil = now + leaseMs
}
/** Content-addressed snapshots omit only access time, which stays on every reference.
 * Old inline evidence remains readable and is never rewritten or removed.
 */
export function retainBrain(doc: HqDocument, files: BrainFile[]): BrainReference[] {
  doc.brainSnapshots ||= {}
  return files.map(({ id, revision, text, accessedAt }) => {
    const snapshot = { id, revision, text }, blob = digest(snapshot)
    const prior = doc.brainSnapshots![blob]
    requireWorkflow(!prior || digest(prior) === blob, 'BRAIN_SNAPSHOT_CORRUPT')
    doc.brainSnapshots![blob] ||= snapshot
    return { id, revision, accessedAt, blob }
  })
}
export function reconstructBrain(doc: HqDocument, evidence: Pick<StageEvidence, 'brain'>): BrainFile[] {
  return evidence.brain.map(file => {
    if (!('blob' in file)) return { ...file }
    const snapshot = doc.brainSnapshots?.[file.blob]
    requireWorkflow(snapshot && digest(snapshot) === file.blob && snapshot.id === file.id && snapshot.revision === file.revision, 'BRAIN_SNAPSHOT_CORRUPT')
    return { ...snapshot, accessedAt: file.accessedAt }
  })
}
/** Reserve worst-case JSON-escaped result/tool/source bytes before allowance or inference.
 * Every store writer honors this headroom. Never delete audit history to make room.
 */
export function reserveEvidence(doc: HqDocument, lease: Lease, files: BrainFile[], input: string, now: number) {
  const run = leasedRun(doc, lease, now)
  const brain = retainBrain(doc, files)
  run.evidenceBudget = 2_400_000 + Buffer.byteLength(JSON.stringify(input))
  return brain
}
export function checkpoint(doc: HqDocument, lease: Lease, evidence: StageEvidence, now: number) {
  const run = leasedRun(doc, lease, now)
  const index = stages.findIndex(s => s.stage === evidence.stage && s.agentId === evidence.agentId)
  requireWorkflow(index >= 0 && (index === 0 || run.checkpoints[stages[index - 1]!.stage]), 'STAGE_ORDER')
  requireWorkflow(typeof evidence.output === 'string' && evidence.output.trim() && evidence.output.length <= 12_000 && evidence.contextId && evidence.principalId, 'INVALID_EVIDENCE')
  if (evidence.stage === 'evaluate') {
    const candidate = run.checkpoints.research!
    requireWorkflow(evidence.contextId !== candidate.contextId && evidence.agentId !== candidate.agentId, 'SELF_REVIEW')
    requireWorkflow(evidence.review?.accepted === true && evidence.review.artifactDigest === digest(candidate.output) && typeof evidence.review.evidence === 'string' && evidence.review.evidence.trim() && evidence.review.evidence.length <= 12_000, 'REVIEW_REJECTED_OR_STALE')
  }
  const prior = run.checkpoints[evidence.stage]
  requireWorkflow(!prior || digest(prior) === digest(evidence), 'CHECKPOINT_CONFLICT')
  run.checkpoints[evidence.stage] ||= evidence
  run.evidenceBudget = 0
}
export function prepareReport(doc: HqDocument, lease: Lease, now: number) {
  const run = leasedRun(doc, lease, now), reply = run.checkpoints.reply
  requireWorkflow(reply && run.checkpoints.evaluate?.review?.accepted, 'REVIEW_AND_REPLY_REQUIRED')
  const text = reply.output
  requireWorkflow(!run.outbox || run.outbox.text === text, 'OUTBOX_CONFLICT')
  run.outbox ||= { key: digest([run.key, 'founder-report']), text, status: 'pending' }
}
/** Delivery destination is HQ's existing CEO inbox, in the SAME transaction as the receipt.
 * No external notification or Brain write is attempted. A transport failure is reconciled by readback.
 */
export function deliverReport(doc: HqDocument, lease: Lease, now: number) {
  const run = leasedRun(doc, lease, now), task = approvedTask(doc, run.taskId)
  requireWorkflow(run.outbox?.status === 'pending', 'OUTBOX_REQUIRED')
  const id = 'workflow_' + run.outbox.key, at = new Date(now).toISOString()
  requireWorkflow(!doc.messages.some(m => m.id === id), 'OUTBOX_RECEIPT_CONFLICT')
  doc.messages.push({ id, agent: 'ceo', role: 'ceo', channel: 'founder_ceo', recipient: 'founder', text: run.outbox.text, status: 'delivered', createdAt: at })
  doc.events.unshift({ id, agent: 'ceo', type: 'workflow-report', title: 'CEO workflow report saved', detail: 'Four stage evidence and independent review saved. Delivered to the HQ inbox; external notification and founder reading are not verified.', taskId: task.id, createdAt: at })
  run.outbox.status = 'delivered'; run.outbox.receipt = id
  run.status = 'completed'; run.leaseUntil = 0
  task.status = task.workflow!.daily ? 'queued' : 'completed'
  task.deliverable = run.outbox.text; task.reviewEvidence = run.checkpoints.evaluate!.review!.evidence; task.updatedAt = at
}
