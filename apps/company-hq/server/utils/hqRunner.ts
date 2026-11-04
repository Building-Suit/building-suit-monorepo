import { randomUUID } from 'node:crypto'
import type { HqStore } from './hqStore'
import { HqProblem } from './hqDomain'
import { requireSettledProviderJournal } from './hqResponsesProtocol'
import { workforce, stages, readTools, brainContextKeys } from './hqWorkforce'
import type { AgentId, BrainKey, BrainFile, ReadTool, StageEvidence, Stage } from './hqWorkforce'
import { approvedTask, checkpoint, claim, dailySlot, deliverReport, digest, leasedRun, prepareReport, reconstructBrain, renewLease, reserveEvidence, requireWorkflow, workflowAssignment } from './hqWorkflow'
import type { Lease } from './hqWorkflow'

export interface RunnerReadiness {
  enabled: boolean
  backendScopeVerified: boolean
  modelScopeVerified: boolean
  persistentHostVerified: boolean
  zeroCostHostVerified: boolean
}
export const disabledRunner: RunnerReadiness = Object.freeze({ enabled: false, backendScopeVerified: false, modelScopeVerified: false, persistentHostVerified: false, zeroCostHostVerified: false })
export interface ModelInput {
  agentId: AgentId; stage: Stage; contextId: string; assignment: string; acceptance: string
  profile: string; playbook: string; context: BrainFile[]; publicInputs: string[]
  // Scoped artifacts only. Never pass another worker's conversation/session state.
  artifacts: { stage: Stage; output: string; sources: string[]; digest: string }[]
  tool: (name: ReadTool, input: string) => Promise<string>
  signal: AbortSignal
}
/** Trusted host adapter, not model-returned metadata. Must create a new isolated context,
 * expose ONLY input.tool, and enforce provider output/token/time limits without paid fallback.
 */
export interface ExecutorAdapter {
  verify(signal: AbortSignal): Promise<{ authenticated: boolean; zeroIncrementalCost: boolean; remainingCalls: number }>
  // Atomic allowance reservation before each call; no reservation reuse after uncertain inference.
  reserve(signal: AbortSignal): Promise<{ id: string; zeroIncrementalCost: boolean }>
  invoke(input: ModelInput, reservationId: string): Promise<{
    identity: { agentId: AgentId; contextId: string; principalId: string; isolated: boolean }
    output: string; sources: string[]
    review?: StageEvidence['review']
  }>
}
export interface BrainAdapter {
  // Authorize and fetch current content on EVERY call; no stale-cache fallback.
  read(id: string, options: { cache: 'no-store'; signal: AbortSignal }): Promise<BrainFile>
}
export interface ToolAdapter {
  // Read-only public research; host must reject private-network URLs, credentials and writes.
  read(name: ReadTool, input: string, signal: AbortSignal): Promise<{ text: string; references: string[] }>
}
export interface RunnerLimits { stageMs: number; adapterMs: number; inferenceMs: number; leaseMs: number }
export const defaultRunnerLimits: Readonly<RunnerLimits> = Object.freeze({ stageMs: 600_000, adapterMs: 60_000, inferenceMs: 180_000, leaseMs: 60_000 })
export class HqRunner {
  private limits: Readonly<RunnerLimits>
  private deadlines = new WeakMap<AbortSignal, { until: number; code: string }>()
  constructor(private store: HqStore, private readiness: RunnerReadiness = disabledRunner, private executor?: ExecutorAdapter, private brain?: BrainAdapter, private tools?: ToolAdapter, private now: () => number = Date.now, limits: Partial<RunnerLimits> = {}) {
    const resolved = { ...defaultRunnerLimits, ...limits }
    for (const [key, max] of Object.entries({ stageMs: 900_000, adapterMs: 120_000, inferenceMs: 300_000, leaseMs: 120_000 })) {
      const value = resolved[key as keyof RunnerLimits]
      requireWorkflow(Number.isSafeInteger(value) && value >= (key === 'leaseMs' ? 1000 : 100) && value <= max, 'INVALID_RUNNER_LIMITS')
    }
    this.limits = Object.freeze(resolved)
  }
  private ready() {
    requireWorkflow(this.readiness.enabled && this.readiness.backendScopeVerified && this.readiness.modelScopeVerified && this.readiness.persistentHostVerified && this.readiness.zeroCostHostVerified && this.executor && this.brain, 'RUNNER_NOT_VERIFIED')
  }
  private checkSignal(signal: AbortSignal) {
    signal.throwIfAborted()
    const deadline = this.deadlines.get(signal)
    requireWorkflow(!deadline || performance.now() < deadline.until, deadline?.code || 'STAGE_TIMEOUT')
  }
  private mutate<T>(fn: (doc: ReturnType<HqStore['read']>) => T, signal?: AbortSignal): T {
    return this.store.transaction(document => {
      if (signal) this.checkSignal(signal)
      const result = fn(document)
      if (signal) this.checkSignal(signal)
      return { document, result }
    })
  }
  private live(lease: Lease, signal: AbortSignal) {
    this.checkSignal(signal); this.ready()
    const doc = this.store.read(), run = leasedRun(doc, lease, this.now())
    return { run, task: approvedTask(doc, run.taskId) }
  }
  private async gate(lease: Lease, signal: AbortSignal, needsCall = true) {
    this.live(lease, signal)
    const access = await this.deadline(signal, this.limits.adapterMs, 'ADAPTER_TIMEOUT', child => this.executor!.verify(child))
    requireWorkflow(access.authenticated && access.zeroIncrementalCost && Number.isFinite(access.remainingCalls) && (!needsCall || access.remainingCalls > 0), 'AUTH_OR_QUOTA_UNAVAILABLE')
    return this.live(lease, signal)
  }
  private async freshBrain(lease: Lease, signal: AbortSignal) {
    const { task } = this.live(lease, signal), started = this.now()
    const entries = Object.entries(task.workflow!.brainFiles) as [BrainKey, string][]
    const files = {} as Record<BrainKey, BrainFile>
    for (const [role, id] of entries) {
      this.live(lease, signal)
      const file = await this.deadline(signal, this.limits.adapterMs, 'BRAIN_READ_TIMEOUT', child => this.brain!.read(id, { cache: 'no-store', signal: child }))
      this.live(lease, signal)
      requireWorkflow(file.id === id && typeof file.revision === 'string' && file.revision.length > 0 && file.revision.length <= 1000 && typeof file.text === 'string' && file.text.trim() && file.text.length <= 40_000 && typeof file.accessedAt === 'string' && file.accessedAt.length <= 40 && Date.parse(file.accessedAt) >= started && Date.parse(file.accessedAt) <= this.now() + 1000, 'FRESH_AUTHORIZED_BRAIN_REQUIRED')
      files[role] = file
    }
    requireWorkflow([...workforce.map(w => w.agentId), 'playbook', ...brainContextKeys].every(k => files[k as keyof typeof files]), 'BRAIN_PROFILE_REQUIRED')
    const snapshot = Object.values(files).map(f => [f.id, f.revision, f.text])
    const doc = this.store.read()
    for (const prior of Object.values(this.live(lease, signal).run.checkpoints)) requireWorkflow(digest(reconstructBrain(doc, prior).map(f => [f.id, f.revision, f.text])) === digest(snapshot), 'BRAIN_CHANGED_REAPPROVAL_REQUIRED')
    return files
  }
  /** Bounded even for noncooperative adapters. Register abort BEFORE invoking user code. */
  private async deadline<T>(parent: AbortSignal, ms: number, code: string, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.checkSignal(parent)
    const controller = new AbortController(), until = performance.now() + ms
    const inherited = this.deadlines.get(parent)
    this.deadlines.set(controller.signal, inherited && inherited.until < until ? inherited : { until, code })
    const abort = () => controller.abort(parent.reason || new HqProblem(409, 'RUN_CANCELLED', 'Run cancelled.'))
    const timeout = () => controller.abort(new HqProblem(409, code, 'Operation timed out.'))
    parent.addEventListener('abort', abort, { once: true })
    if (parent.aborted) abort()
    const timer = setTimeout(timeout, ms)
    let rejectAbort: (() => void) | undefined
    try {
      this.checkSignal(controller.signal)
      const aborted = new Promise<never>((_, reject) => {
        rejectAbort = () => reject(controller.signal.reason)
        controller.signal.addEventListener('abort', rejectAbort, { once: true })
      })
      const result = await Promise.race([aborted, Promise.resolve().then(() => {
        this.checkSignal(controller.signal)
        return operation(controller.signal)
      })])
      if (performance.now() >= until) timeout()
      this.checkSignal(controller.signal)
      return result
    } finally {
      if (rejectAbort) controller.signal.removeEventListener('abort', rejectAbort)
      clearTimeout(timer); parent.removeEventListener('abort', abort); controller.abort()
    }
  }
  private async bounded<T>(lease: Lease, parent: AbortSignal, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController()
    const abort = () => controller.abort(new HqProblem(409, 'RUN_CANCELLED', 'Run cancelled.'))
    parent.addEventListener('abort', abort, { once: true })
    if (parent.aborted) abort()
    let renewalAt = this.now()
    const watch = setInterval(() => {
      try {
        this.live(lease, controller.signal)
        const now = this.now()
        if (now >= renewalAt) {
          this.mutate(doc => renewLease(doc, lease, this.now(), this.limits.leaseMs))
          renewalAt = now + this.limits.leaseMs / 3
        }
      } catch (error) { controller.abort(error) }
    }, 100)
    try {
      return await this.deadline(controller.signal, this.limits.stageMs, 'STAGE_TIMEOUT', operation)
    } finally {
      clearInterval(watch); parent.removeEventListener('abort', abort); controller.abort()
    }
  }
  async run(taskId: string, options: { daily?: boolean; signal?: AbortSignal } = {}) {
    this.ready()
    const lease = this.mutate(doc => {
      const task = doc.tasks.find(candidate => candidate.id === taskId)
      if (task && ['completed', 'cancelled'].includes(task.status)) return null
      const runs = Object.values(doc.workflowRuns || {}).filter(run => run.taskId === taskId)
      // Recheck under the same writer lock as claim; an earlier dispatcher read can be stale.
      if (runs.some(run => run.status === 'running' && run.leaseUntil > this.now())) return null
      requireSettledProviderJournal(doc)
      if (task?.sourceMessage) {
        approvedTask(doc, taskId)
        requireWorkflow(options.daily !== true && task.workflow?.daily === false, 'DISPATCH_MANUAL_TASK_REQUIRED')
        requireWorkflow(task.status !== 'blocked' || runs.some(run => stages.every(({ stage }) => run.checkpoints[stage])), 'DISPATCH_BLOCKED_REQUIRES_REVIEW')
        for (const run of runs) for (const attempt of run.attempts) requireWorkflow(run.checkpoints[attempt.stage]?.contextId === attempt.contextId, 'DISPATCH_ATTEMPT_RECONCILIATION_REQUIRED')
      }
      return claim(doc, taskId, randomUUID(), this.now(), options.daily === true, this.limits.leaseMs)
    })
    if (!lease) return { status: 'already_claimed_or_finished' as const }
    const parent = options.signal || new AbortController().signal
    try {
      for (const { stage, agentId } of stages) {
        const current = this.live(lease, parent)
        if (current.run.checkpoints[stage]) continue
        this.mutate(doc => renewLease(doc, lease, this.now(), this.limits.leaseMs))
        await this.bounded(lease, parent, async signal => {
          const { task, run } = await this.gate(lease, signal)
          const brain = await this.freshBrain(lease, signal)
          const contextId = randomUUID(), startedAt = new Date(this.now()).toISOString()
          const artifacts = stages.flatMap(s => run.checkpoints[s.stage] ? [{ stage: s.stage, output: run.checkpoints[s.stage]!.output, sources: run.checkpoints[s.stage]!.sources, digest: digest(run.checkpoints[s.stage]!.output) }] : [])
          const input = workflowAssignment(task, artifacts, stage)
          const calls: StageEvidence['toolCalls'] = [], sourceRefs = new Set(Object.values(brain).map(f => f.id))
          for (const artifact of artifacts) for (const ref of artifact.sources) sourceRefs.add(ref)
          let attempts = 0, open = true, inFlight = 0, toolDenied = false
          let executionSignal = signal
          const tool = async (name: ReadTool, query: string) => {
            inFlight++
            try {
              requireWorkflow(open && readTools.includes(name) && task.workflow!.allowedTools.includes(name) && task.workflow!.publicInputs.includes(query) && this.tools && typeof query === 'string' && query.length > 0 && query.length <= 4000 && ++attempts <= 6, 'TOOL_SCOPE_OR_LIMIT')
              await this.gate(lease, executionSignal, false)
              const result = await this.deadline(executionSignal, this.limits.adapterMs, 'TOOL_TIMEOUT', child => this.tools!.read(name, query, child))
              this.live(lease, executionSignal)
              requireWorkflow(open && typeof result.text === 'string' && result.text.length <= 20_000 && Array.isArray(result.references) && result.references.length <= 30 && result.references.every(ref => typeof ref === 'string' && /^https:\/\//.test(ref) && ref.length < 2000), 'TOOL_RESULT_INVALID')
              calls.push({ name, input: query, output: result.text })
              for (const ref of result.references) sourceRefs.add(ref)
              return result.text
            } catch (error) { toolDenied = true; throw error }
            finally { inFlight-- }
          }
          await this.gate(lease, signal)
          requireWorkflow(run.attempts.filter(a => a.stage === stage).length < 2 && run.attempts.length < 8, 'RETRY_LIMIT')
          const brainEvidence = this.mutate(doc => {
            requireSettledProviderJournal(doc)
            return reserveEvidence(doc, lease, Object.values(brain), input, this.now())
          }, signal)
          const reservation = await this.deadline(signal, this.limits.adapterMs, 'RESERVATION_TIMEOUT', child => this.executor!.reserve(child))
          requireWorkflow(typeof reservation.id === 'string' && reservation.id.length > 0 && reservation.id.length <= 200 && reservation.zeroIncrementalCost, 'ALLOWANCE_RESERVATION_REQUIRED')
          this.live(lease, signal)
          this.mutate(doc => {
            const live = leasedRun(doc, lease, this.now())
            requireWorkflow(!live.attempts.some(a => a.reservationId === reservation.id), 'RESERVATION_REUSED')
            live.attempts.push({ stage, contextId, reservationId: reservation.id, at: startedAt, owner: lease.owner, generation: lease.generation, inputDigest: digest(input), brain: brainEvidence })
          }, signal)
          let result
          try {
            result = await this.deadline(signal, this.limits.inferenceMs, 'INFERENCE_TIMEOUT', child => {
              executionSignal = child
              return this.executor!.invoke({ agentId, stage, contextId, assignment: input, acceptance: task.acceptance, profile: brain[agentId].text, playbook: brain.playbook.text, context: brainContextKeys.map(k => brain[k]), publicInputs: [...task.workflow!.publicInputs], artifacts, tool, signal: child }, reservation.id)
            })
          } finally { open = false }
          this.live(lease, signal)
          requireWorkflow(!toolDenied && inFlight === 0, 'TOOL_DENIED_OR_UNFINISHED')
          requireWorkflow(result.identity.isolated === true && result.identity.agentId === agentId && result.identity.contextId === contextId && typeof result.identity.principalId === 'string' && result.identity.principalId.length > 0 && result.identity.principalId.length <= 200, 'EXECUTOR_IDENTITY_OR_ISOLATION')
          requireWorkflow(Array.isArray(result.sources) && result.sources.length <= 100 && result.sources.every(ref => typeof ref === 'string' && ref.length <= 2000 && sourceRefs.has(ref)), 'UNOBSERVED_SOURCES')
          requireWorkflow(typeof result.output === 'string' && result.output.trim() && result.output.length <= 12_000 && (!result.review || (typeof result.review.accepted === 'boolean' && typeof result.review.artifactDigest === 'string' && result.review.artifactDigest.length <= 64 && typeof result.review.evidence === 'string' && result.review.evidence.length <= 12_000)), 'INVALID_EVIDENCE')
          const evidence: StageEvidence = { stage, agentId, contextId, principalId: result.identity.principalId, input, inputDigest: digest(input), brain: brainEvidence, allowedTools: [...task.workflow!.allowedTools], toolCalls: calls, output: result.output, sources: result.sources, ...(result.review ? { review: { accepted: result.review.accepted, artifactDigest: result.review.artifactDigest, evidence: result.review.evidence } } : {}), startedAt, completedAt: new Date(this.now()).toISOString() }
          try { this.mutate(doc => checkpoint(doc, lease, evidence, this.now()), signal) }
          catch (error) {
            if (error instanceof HqProblem && error.code === 'REVIEW_REJECTED_OR_STALE') this.mutate(doc => {
              const live = leasedRun(doc, lease, this.now())
              live.rejectedReviews = [...(live.rejectedReviews || []), evidence]
              live.evidenceBudget = 0
            }, signal)
            throw error
          }
        })
      }
      await this.bounded(lease, parent, async signal => {
        await this.gate(lease, signal, false)
        await this.freshBrain(lease, signal)
        this.live(lease, signal)
        this.mutate(doc => prepareReport(doc, lease, this.now()), signal)
        this.live(lease, signal)
        this.mutate(doc => deliverReport(doc, lease, this.now()), signal)
      })
      const saved = this.store.read().workflowRuns![lease.key]!
      requireWorkflow(saved.outbox?.status === 'delivered' && saved.outbox.receipt, 'DELIVERY_READBACK_REQUIRED')
      return { status: 'completed' as const, receipt: saved.outbox.receipt }
    } catch (error) {
      // Never log adapter exception text: it may include credentials or private provider details.
      const code = error instanceof HqProblem ? error.code : 'ADAPTER_UNAVAILABLE'
      this.mutate(doc => {
        const run = doc.workflowRuns?.[lease.key]
        if (run?.owner === lease.owner && run.generation === lease.generation && run.status === 'running' && run.leaseUntil > this.now()) {
          run.status = 'blocked'; run.leaseUntil = 0; run.evidenceBudget = 0
          const task = doc.tasks.find(t => t.id === run.taskId)
          if (task && task.status === 'running') { task.status = 'blocked'; task.updatedAt = new Date(this.now()).toISOString() }
          run.failures = [...run.failures, { at: new Date(this.now()).toISOString(), code }]
        }
      })
      return { status: 'blocked' as const, code }
    }
  }
  /** Host scheduler entry; never installed or activated automatically. No historical backfill. */
  async tick(signal?: AbortSignal) {
    this.ready()
    if (!dailySlot(this.now()).due) return { status: 'not_due' as const }
    const candidates = this.store.read().tasks.filter(t => t.workflow?.daily && t.approvedAt && ['queued', 'running', 'review', 'blocked'].includes(t.status))
    requireWorkflow(candidates.length <= 1, 'MULTIPLE_DAILY_APPROVALS')
    if (!candidates[0]) return { status: 'no_approved_schedule' as const }
    return this.run(candidates[0].id, { daily: true, signal })
  }
}
