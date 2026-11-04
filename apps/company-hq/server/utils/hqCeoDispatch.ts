import { HqStore } from './hqStore'
import { HqRunner, disabledRunner } from './hqRunner'
import type { BrainAdapter, ExecutorAdapter, RunnerLimits, RunnerReadiness, ToolAdapter } from './hqRunner'
import { linkedSourceMessage } from './hqDomain'
import type { HqDocument, HqTask } from './hqDomain'
import { DisabledResponsesExecutor, requireSettledProviderJournal } from './hqResponsesProtocol'
import { approvedTask, requireWorkflow } from './hqWorkflow'
import { stages } from './hqWorkforce'

/** Trusted host injection only; no request/env/credential construction or provider client. */
export interface CeoDispatchAdapters {
  readiness?: RunnerReadiness
  executor?: ExecutorAdapter
  brain?: BrainAdapter
  tools?: ToolAdapter
  limits?: Partial<RunnerLimits>
}
type DispatchResult = Awaited<ReturnType<HqRunner['run']>> | { status: 'no_dispatchable_work' }
const deliveryReady = (doc: HqDocument, task: HqTask) => Object.values(doc.workflowRuns || {}).some(run => run.taskId === task.id && stages.every(({ stage }) => run.checkpoints[stage]))

/** Owns this real SQLite connection. Each explicit call attempts at most one task. */
export class HqCeoDispatcher {
  private runner: HqRunner
  private active?: Promise<DispatchResult>
  private controller?: AbortController
  private closing = false
  private closePromise?: Promise<void>
  constructor(private store: HqStore, adapters: CeoDispatchAdapters = {}) {
    requireWorkflow(store instanceof HqStore, 'SQLITE_DISPATCH_REQUIRED')
    this.runner = new HqRunner(store, Object.freeze({ ...disabledRunner, ...adapters.readiness }), adapters.executor || new DisabledResponsesExecutor(), adapters.brain, adapters.tools, Date.now, adapters.limits)
  }
  private eligible(doc: HqDocument, task: HqTask) {
    return task.sourceMessage && task.approvedAt && task.workflow?.daily === false &&
      (['queued', 'running', 'review'].includes(task.status) || (task.status === 'blocked' && deliveryReady(doc, task)))
  }
  private async perform(taskId: string | undefined, signal: AbortSignal): Promise<DispatchResult> {
    signal.throwIfAborted()
    const doc = this.store.read()
    if (taskId === undefined) {
      requireWorkflow(doc.tasks.length <= 1000, 'DISPATCH_SELECTION_LIMIT')
      taskId = [...doc.tasks].filter(task => this.eligible(doc, task)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0]?.id
      if (!taskId) return { status: 'no_dispatchable_work' }
    }
    const existing = doc.tasks.find(task => task.id === taskId)
    requireWorkflow(existing, 'DISPATCH_TASK_REQUIRED')
    if (existing.status === 'completed' || existing.status === 'cancelled') return { status: 'already_claimed_or_finished' }
    const task = approvedTask(doc, taskId)
    requireWorkflow(task.sourceMessage && linkedSourceMessage(doc, task), 'DISPATCH_LINKED_MESSAGE_REQUIRED')
    requireWorkflow(task.workflow!.daily === false, 'DISPATCH_MANUAL_TASK_REQUIRED')
    const runs = Object.values(doc.workflowRuns || {}).filter(run => run.taskId === task.id)
    if (runs.some(run => run.status === 'running' && run.leaseUntil > Date.now())) return { status: 'already_claimed_or_finished' }
    requireWorkflow(task.status !== 'blocked' || deliveryReady(doc, task), 'DISPATCH_BLOCKED_REQUIRES_REVIEW')
    for (const run of runs) for (const attempt of run.attempts) {
      requireWorkflow(run.checkpoints[attempt.stage]?.contextId === attempt.contextId, 'DISPATCH_ATTEMPT_RECONCILIATION_REQUIRED')
    }
    requireSettledProviderJournal(doc)
    signal.throwIfAborted()
    return this.runner.run(task.id, { daily: false, signal })
  }
  private start(taskId: string | undefined, signal?: AbortSignal) {
    requireWorkflow(!this.closing, 'HOST_CLOSED')
    requireWorkflow(!this.active, 'DISPATCH_ALREADY_ACTIVE')
    const controller = new AbortController(), abort = () => controller.abort(signal?.reason)
    signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) abort()
    this.controller = controller
    const active = Promise.resolve().then(() => this.perform(taskId, controller.signal)).finally(() => {
      signal?.removeEventListener('abort', abort)
      if (this.active === active) { this.active = undefined; this.controller = undefined }
    })
    this.active = active
    return active
  }
  async dispatchTask(taskId: string, signal?: AbortSignal) {
    requireWorkflow(typeof taskId === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(taskId), 'DISPATCH_TASK_REQUIRED')
    return this.start(taskId, signal)
  }
  async dispatchNext(signal?: AbortSignal) { return this.start(undefined, signal) }
  close(): Promise<void> {
    if (this.closePromise) return this.closePromise
    this.closing = true; this.controller?.abort()
    const active = this.active
    if (!active) { this.store.close(); this.closePromise = Promise.resolve() }
    else this.closePromise = active.catch(() => {}).then(() => { this.store.close() })
    return this.closePromise
  }
}
