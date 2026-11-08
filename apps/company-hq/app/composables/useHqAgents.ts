import type { HqAgentPresentation, HqAgentsPresentation, HqChatMessage, HqRequestProgress, HqTaskBrowserRequest, HqTaskBrowserPage, HqTaskGroup, HqTrialCommand, HqTrialPresentation } from '@building-suit/ui/types/hqAgentsPresentation'
import type { HqFounderAccessPresentation } from '@building-suit/ui/types/hqLayoutPresentation'
import { provideHqTaskBrowserSource } from '@building-suit/ui/utils/hqTaskBrowserSource'
import { hasHqControlCharacters, parseHqAgentSnapshot, type HqAgentSnapshot } from '#shared/types/agents'
import { hqCosmeticIdle, hqObservationFresh, hqObservedActivity } from '../utils/hqAgentPresence'
import { parseHqTaskPage } from '#shared/types/taskBrowser'
import type { HqBusinessTask } from '#shared/types/agents'
import { hqWorkActivity } from '../utils/hqWorkActivity'

export interface HqAgentMessages {
  unavailable: string
  sendFailed: string
  unknownOutcome?: string
  invalidMessage?: string
  taskBlocked?: string
  autoAssign?: string
  reviewLabel?: string
  taskStatus?: (status: string) => string
  taskError?: (code: string) => string
  lessonStatus?: (status: string) => string
  lifecycle?: (value: string) => string
  connection?: (value: string) => string
}
type MessageReason = 'unavailable' | 'sendFailed' | 'unknownOutcome' | 'invalidMessage'
interface MessageAttempt { key: string; prompt: string; requestKey: string; identity: string }

function responseStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const entry = error as { statusCode?: unknown; status?: unknown; response?: { status?: unknown } }
  const status = entry.statusCode ?? entry.status ?? entry.response?.status
  return typeof status === 'number' ? status : undefined
}

// Preserve PostgreSQL's sub-millisecond stage order when the JavaScript Date
// values tie. Recovery lineage is still resolved before chronological order.
function timestampRemainder(value: string): string {
  return (value.match(/[T ]\d{2}:\d{2}:\d{2}\.(\d+)/)?.[1] ?? '').slice(3).padEnd(6, '0').slice(0, 6)
}

/** Founder-scoped event-driven message state. Runtime presence never invents employee work. */
export function useHqAgents(getAccess: () => HqFounderAccessPresentation, messages?: () => HqAgentMessages) {
  const live = useHqLiveEvents()
  provideHqTaskBrowserSource({ load: loadTaskPage, detail: loadTaskDetail })
  const trials = shallowRef<readonly HqTrialPresentation[]>([])
  const trialPending = ref(false), trialMessage = ref('')
  async function refreshTrials() {
    if (getAccess().status !== 'founder') { trials.value = []; return }
    const identity = accessIdentity(getAccess()), trialEpoch = epoch
    try {
      const result = await $fetch<unknown>('/api/hq/trials', { headers: { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' } })
      if (getAccess().status !== 'founder' || accessIdentity(getAccess()) !== identity || epoch !== trialEpoch) return
      if (!Array.isArray(result) || result.length > 50 || result.some(row => !row || typeof row.agentId !== 'string'
        || typeof row.eligible !== 'boolean' || typeof row.qualified !== 'boolean' || typeof row.receiptIssued !== 'boolean'
        || typeof row.reviewComplete !== 'boolean' || !(row.skillFileId === null || typeof row.skillFileId === 'string')
        || !(row.trialId === null || typeof row.trialId === 'string') || ![null, 'active', 'passed', 'failed', 'canceled'].includes(row.status))) {
        trials.value = []; return
      }
      trials.value = result as HqTrialPresentation[]
    } catch { trials.value = [] }
  }
  async function trialCommand(command: HqTrialCommand) {
    if (getAccess().status !== 'founder' || trialPending.value) return
    const identity = accessIdentity(getAccess()), trialEpoch = epoch
    trialPending.value = true; trialMessage.value = ''
    try {
      const result = await $fetch<{ accepted?: boolean }>('/api/hq/trials', { method: 'POST', headers: { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' },
        body: { trialId: command.trialId } })
      if (getAccess().status !== 'founder' || accessIdentity(getAccess()) !== identity || epoch !== trialEpoch) return
      if (result?.accepted !== true) throw Error('trial-unconfirmed')
      trialMessage.value = 'Skill qualification recorded. All assigned skills and canonical Active lifecycle are required.'
      await Promise.all([refresh(), refreshTrials()])
    } catch {
      if (getAccess().status === 'founder' && accessIdentity(getAccess()) === identity && epoch === trialEpoch) trialMessage.value = 'Trial action unconfirmed. Refresh and retry the same action; eligibility and evidence are checked by HQ.'
    } finally { trialPending.value = false }
  }
  const snapshot = shallowRef<HqAgentSnapshot | null>(null)
  let taskBrowserRevision = 0
  watch(snapshot, () => { taskBrowserRevision += 1 }, { flush: 'sync' })
  const status = ref<HqAgentsPresentation['status']>('unavailable')
  const pending = ref(false), refreshing = ref(false), sending = ref(false), clock = ref(0)
  const messageReason = ref<MessageReason | null>(null)
  const attempts = new Map<string, MessageAttempt>()
  const headers = { 'X-HQ-Access': '1', 'X-HQ-Brain': '1', 'X-HQ-Chat-Progress': '1', 'X-HQ-Staffing': '1' }
  let controller: AbortController | null = null, inFlight: Promise<boolean> | null = null
  let freshnessTimer: ReturnType<typeof setTimeout> | null = null
  let refreshQueued = false, mounted = false, disposed = false, epoch = 0
  let scopeIdentity: string | null = null

  const runtimeOnline = computed(() => {
    const runtime = snapshot.value?.runtime
    if (!runtime?.connected || !runtime.lastSeenAt) return false
    return hqObservationFresh(runtime.lastSeenAt, clock.value)
  })
  const agents = computed<HqAgentsPresentation>(() => {
    const state = snapshot.value
    const employeeRole = (id: string): HqAgentPresentation['role'] => id === 'AG-CEO-001' ? 'ceo' : id === 'AG-HR-001' ? 'hr' : 'agent'
    const activity = (record: HqAgentSnapshot['agents'][number]) => hqObservedActivity(record, runtimeOnline.value, clock.value)
    const transcript: HqChatMessage[] = (state?.messages ?? []).map(message => ({
      id: message.id, role: message.role === 'founder' ? 'founder' : message.agentId === 'AG-CEO-001' ? 'ceo' : message.agentId === 'AG-HR-001' ? 'hr' : 'agent',
      agentId: message.agentId,
      agentName: state?.agents.find(agent => agent.id === message.agentId)?.name,
      agentRole: state?.agents.find(agent => agent.id === message.agentId)?.role,
      text: message.text, createdAt: message.createdAt,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}), ...(message.kind ? { kind: message.kind } : {}),
      ...(message.taskId ? { taskId: message.taskId } : {}), ...(message.mentions ? { mentions: message.mentions } : {}),
    }))
    // A reviewed proposal is not a Brain publication. Anchor only receipts that
    // have both the published timestamp and the trusted publication reference.
    for (const lesson of state?.lessons ?? []) {
      if (lesson.status !== 'published' || !lesson.publishedAt || !lesson.publicationReference) continue
      const anchor = [...transcript].reverse().find(message => message.role !== 'founder' && (
        lesson.sourceType === 'task' ? message.taskId === lesson.sourceId : message.replyTo === lesson.sourceId))
      if (anchor) anchor.learningIds = [...(anchor.learningIds ?? []), lesson.id]
    }
    const latestRequest = [...transcript].reverse().find(message => message.role === 'founder')
    const relatedMessages = latestRequest ? transcript.filter(message => message.role !== 'founder' && message.replyTo === latestRequest.id) : []
    const relatedTaskId = [...relatedMessages].reverse().find(message => message.taskId)?.taskId
    const relatedTask = relatedTaskId ? state?.tasks?.find(task => task.id === relatedTaskId) : undefined
    const requestFinished = relatedTask?.status === 'completed' || relatedMessages.some(message => message.kind === 'task-result')
    const executionKinds = new Set(['conversation-intake', 'task-route', 'task-ack', 'task-start', 'task-work', 'head-review', 'ceo-review', 'task-report'])
    const linkedExecutions = latestRequest && !requestFinished
      ? (state?.jobs ?? []).filter(job => executionKinds.has(job.kind ?? '') && job.founderMessageId === latestRequest.id)
      : []
    // A recorded recovery supersedes its source, including a failed task stage
    // after an actual handoff/acknowledgment. Learning never owns this receipt.
    const recoveredExecutions = new Set(linkedExecutions.flatMap(job => job.recoveryOf ? [job.recoveryOf] : []))
    const execution = linkedExecutions.filter(job => !recoveredExecutions.has(job.id))
      .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)
        || timestampRemainder(second.createdAt).localeCompare(timestampRemainder(first.createdAt)) || second.id.localeCompare(first.id))[0]
    const executionAgent = execution && state?.agents.find(agent => agent.id === execution.agentId)
    const needsRecovery = execution?.status === 'blocked' || relatedTask?.status === 'blocked'
    const requestProgress: HqRequestProgress | undefined = latestRequest && execution && executionAgent && (execution.status !== 'completed' || needsRecovery)
      ? { messageId: relatedMessages.at(-1)?.id ?? latestRequest.id, agentId: execution.agentId, agentName: executionAgent.name,
          state: needsRecovery ? 'recovery-needed' : execution.status === 'working' ? 'working' : 'queued', recovering: Boolean(execution.recoveryOf) }
      : undefined
    const copy = messages?.()
    const reason = messageReason.value
    const error = reason && copy ? copy[reason] ?? (reason === 'unavailable' ? copy.unavailable : copy.sendFailed) : undefined
    return {
      trials: trials.value, trialPending: trialPending.value, trialMessage: trialMessage.value,
      status: status.value, pending: pending.value, refreshing: refreshing.value, sending: sending.value,
      workActivity: state ? hqWorkActivity(state, runtimeOnline.value, clock.value) : [],
      observations: state?.observations,
      tasksPartial: state?.observations?.tasksPartial,
      runningTasks: state?.observations?.runningTasks.map(task => ({
        id: task.id, title: task.title, brief: task.brief, acceptance: task.acceptance, assigneeId: task.assigneeId,
        assigneeName: state?.agents.find(agent => agent.id === task.assigneeId)?.name ?? copy?.autoAssign ?? '',
        statusLabel: copy?.taskStatus?.(task.status) ?? task.status, state: 'active' as const,
        createdAt: task.createdAt, deliverable: '', reviews: [],
      })),
      officeTasks: state?.observations?.recentTasks?.map(task => ({
        id: task.id, title: task.title, brief: task.brief, acceptance: task.acceptance, assigneeId: task.assigneeId,
        assigneeName: state?.agents.find(agent => agent.id === task.assigneeId)?.name ?? copy?.autoAssign ?? '',
        statusLabel: copy?.taskStatus?.(task.status) ?? task.status,
        state: task.status === 'completed' ? 'complete' : task.status === 'queued' ? 'pending' : task.status === 'working' || task.status === 'review' ? 'active' : 'blocked',
        createdAt: task.createdAt, deliverable: '', reviews: [],
      })),
      agents: (state?.agents ?? []).map(record => {
        const observed = activity(record)
        const configured = state?.version === 2 ? Boolean(record.profileFileId && record.model && record.effort) : true
        const connected = observed === 'working' || observed === 'idle'
        const connection = connected ? 'active' : observed === 'unknown' ? 'blocked' : configured ? 'configured' : 'unbound'
        return { id: record.id, name: record.name, role: employeeRole(record.id), roleLabel: record.role,
          model: record.model ?? undefined, effort: record.effort ?? undefined, managerId: record.managerId ?? undefined,
          managerName: state?.agents.find(manager => manager.id === record.managerId)?.name,
          profileUrl: record.profileFileId ? `https://drive.google.com/file/d/${record.profileFileId}/view` : undefined,
          departmentId: record.departmentId, departmentName: record.departmentKey ?? undefined, deskIndex: record.deskIndex, activity: observed, configured, connected,
          cosmeticIdle: hqCosmeticIdle(configured, observed, runtimeOnline.value),
          lifecycleLabel: copy?.lifecycle?.(record.lifecycle ?? 'unknown') ?? record.lifecycle,
          connectionLabel: copy?.connection?.(connection) ?? connection }
      }),
      taskBrowserRevision,
      tasks: (state?.tasks ?? []).map(projectTask),
      lessons: (state?.lessons ?? []).map(lesson => ({
        id: lesson.id, status: lesson.status, sourceId: lesson.sourceId, title: lesson.summary, text: lesson.body, agentName: state?.agents.find(agent => agent.id === lesson.agentId)?.name ?? lesson.agentId,
        statusLabel: copy?.lessonStatus?.(lesson.status) ?? lesson.status, taskId: lesson.sourceType === 'task' ? lesson.sourceId : null,
        createdAt: lesson.createdAt,
        ...(lesson.reviewedAt ? { reviewedAt: lesson.reviewedAt } : {}), ...(lesson.publishedAt ? { publishedAt: lesson.publishedAt } : {}),
        ...(lesson.publicationReference ? { publicationReference: lesson.publicationReference, sourceUrl: lesson.publicationReference } : {}),
      })),
      messages: transcript, queuedCount: state?.jobs.filter(job => job.status === 'queued').length ?? 0,
      runtimeOnline: runtimeOnline.value,
      ...(requestProgress ? { requestProgress } : {}),
      ...(state?.runtime.lastSeenAt ? { lastRuntimeSeenAt: state.runtime.lastSeenAt } : {}),
      ...(error ? { error } : {}),
    }
  })

  function projectTask(task: HqBusinessTask) {
    const copy = messages?.()
    return {
      id: task.id, title: task.title, brief: task.brief, acceptance: task.acceptance, assigneeId: task.assigneeId,
      assigneeName: snapshot.value?.agents.find(agent => agent.id === task.assigneeId)?.name ?? copy?.autoAssign ?? '',
      statusLabel: copy?.taskStatus?.(task.status) ?? task.status,
      group: taskGroup(task.status),
      state: (task.status === 'completed' ? 'complete' : task.status === 'queued' ? 'pending' : task.status === 'working' || task.status === 'review' ? 'active' : 'blocked') as 'complete' | 'pending' | 'active' | 'blocked',
      createdAt: task.createdAt, updatedAt: task.updatedAt, completedAt: task.completedAt, deliverable: task.deliverable ?? '',
      reviews: task.reviewSummary ? [{ id: `${task.id}-review`, reviewer: copy?.reviewLabel ?? '', outcome: copy?.taskStatus?.(task.status) ?? task.status, text: task.reviewSummary }] : [],
      ...(task.error && task.status !== 'canceled' ? { error: copy?.taskError?.(task.error) ?? copy?.taskBlocked ?? '' } : {}),
    }
  }
  async function fetchTaskPage(query: Record<string, string | number>, signal: AbortSignal) {
    if (!allowed()) throw Error('HQ task access unavailable')
    const identity = scopeIdentity, requestEpoch = epoch
    const result = await $fetch<unknown>('/api/hq/tasks', { query, headers, signal })
    if (!allowed() || scopeIdentity !== identity || epoch !== requestEpoch || signal.aborted) throw Error('HQ task scope changed')
    const page = parseHqTaskPage(result)
    if (!page) throw Error('HQ task page invalid')
    return page
  }
  function taskGroup(status: string): HqTaskGroup {
    return status === 'working' || status === 'review' ? 'running' : status === 'queued' || status === 'blocked' ? 'waiting' : 'done'
  }
  function recentTaskPage(request: HqTaskBrowserRequest): HqTaskBrowserPage {
    const state = snapshot.value, copy = messages?.()
    const records = new Map<string, HqTaskBrowserPage['items'][number]>()
    for (const task of [...(state?.observations?.recentTasks ?? []), ...(state?.observations?.runningTasks ?? [])]) {
      records.set(task.id, { id: task.id, title: task.title, brief: '', acceptance: '', assigneeId: task.assigneeId,
        assigneeName: state?.agents.find(agent => agent.id === task.assigneeId)?.name ?? copy?.autoAssign ?? '',
        statusLabel: copy?.taskStatus?.(task.status) ?? task.status, group: taskGroup(task.status),
        state: task.status === 'completed' ? 'complete' : task.status === 'queued' ? 'pending' : task.status === 'working' || task.status === 'review' ? 'active' : 'blocked',
        createdAt: task.createdAt, deliverable: '', reviews: [] })
    }
    for (const task of state?.tasks ?? []) records.set(task.id, projectTask(task))
    const scoped = [...records.values()].filter(task => !request.officeId || (request.officeId === 'executive'
      ? task.assigneeId === 'AG-CEO-001' : state?.agents.some(agent => agent.id === task.assigneeId && agent.departmentId === request.officeId)))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id))
    const counts = { running: 0, waiting: 0, done: 0 }
    for (const task of scoped) counts[task.group!] += 1
    return { partial: true, counts, items: scoped.filter(task => task.group === request.group).slice(request.offset, request.offset + request.limit) }
  }
  async function loadTaskPage(request: HqTaskBrowserRequest, signal: AbortSignal): Promise<HqTaskBrowserPage> {
    try {
      const page = await fetchTaskPage({ group: request.group, offset: request.offset, limit: request.limit,
        ...(request.officeId ? { officeId: request.officeId } : {}) }, signal)
      return { counts: page.counts, items: page.items.map(projectTask) }
    } catch (error) {
      // Local-only edits can precede the repository-driven database rollout.
      // Never disguise a truncated snapshot as complete history or bypass Auth.
      if (signal.aborted || !allowed() || responseStatus(error) !== 503) throw error
      return recentTaskPage(request)
    }
  }
  async function loadTaskDetail(id: string, signal: AbortSignal) {
    try {
      const page = await fetchTaskPage({ taskId: id, limit: 1 }, signal)
      return page.items[0] ? projectTask(page.items[0]) : null
    } catch (error) {
      if (signal.aborted || !allowed() || responseStatus(error) !== 503) throw error
      const task = snapshot.value?.tasks?.find(task => task.id === id)
      return task ? projectTask(task) : null
    }
  }

  function accessIdentity(access: HqFounderAccessPresentation): string | null {
    return access.user?.displayName ? JSON.stringify([access.user.displayName, access.user.detailLabel ?? '']) : null
  }

  function allowed() {
    const access = getAccess()
    return mounted && !disposed && access.status === 'founder' && scopeIdentity !== null
      && accessIdentity(access) === scopeIdentity && navigator.onLine
  }

  function invalidate(clearAttempts: boolean, reason: MessageReason | null = null) {
    epoch += 1; controller?.abort(); controller = null; inFlight = null
    refreshQueued = false; pending.value = false; refreshing.value = false; sending.value = false; snapshot.value = null
    trials.value = []; trialMessage.value = ''
    status.value = 'unavailable'; messageReason.value = reason
    if (freshnessTimer !== null) clearTimeout(freshnessTimer)
    freshnessTimer = null
    if (clearAttempts) attempts.clear()
  }

  function scheduleFreshness() {
    if (freshnessTimer !== null) clearTimeout(freshnessTimer)
    freshnessTimer = null
    const value = snapshot.value
    if (!value?.runtime.connected || !value.runtime.lastSeenAt) return
    const hostSeen = Date.parse(value.runtime.lastSeenAt)
    if (!Number.isFinite(hostSeen) || hostSeen > clock.value + 300_000 || hostSeen + 150_000 <= clock.value) return
    const expiries = [hostSeen, ...value.agents.filter(agent => agent.status === 'working' || agent.status === 'idle').map(agent => Date.parse(agent.lastSeenAt ?? ''))]
      .filter(seen => Number.isFinite(seen) && seen <= clock.value + 300_000 && seen + 150_000 > clock.value).map(seen => seen + 150_000)
    // Display-only one-shot expiry for host AND individual observations.
    // It never queries application data or invents an employee heartbeat.
    freshnessTimer = setTimeout(() => { clock.value = Date.now(); freshnessTimer = null; scheduleFreshness() }, Math.min(...expiries) - clock.value + 20)
  }
  function apply(value: HqAgentSnapshot) {
    snapshot.value = value; status.value = 'connected'; clock.value = Date.now()
    scheduleFreshness()
  }

  function run(attempt?: MessageAttempt): Promise<boolean> {
    if (!allowed() || attempt && attempt.identity !== scopeIdentity) return Promise.resolve(false)
    if (inFlight) {
      if (!attempt) return inFlight
      if (sending.value) return Promise.resolve(false)
      // An explicit write takes priority over a replaceable background GET.
      // Its aborted response cannot overwrite the write's newer epoch.
      epoch += 1; controller?.abort(); controller = null; inFlight = null
      refreshQueued = true
    }
    const expected = epoch, identity = scopeIdentity, request = new AbortController()
    controller = request; pending.value = Boolean(attempt) || !snapshot.value; refreshing.value = !attempt && Boolean(snapshot.value); sending.value = Boolean(attempt); messageReason.value = null
    if (!snapshot.value) status.value = 'loading'
    const task: Promise<boolean> = Promise.resolve().then(async () => {
      try {
        const result = await $fetch<unknown>(attempt ? '/api/hq/ceo/messages' : '/api/hq/agents', {
          method: attempt ? 'POST' : 'GET', ...(attempt ? { body: { prompt: attempt.prompt, requestKey: attempt.requestKey } } : {}),
          headers, credentials: 'same-origin', cache: 'no-store', retry: 0, timeout: 45_000, signal: request.signal,
        })
        if (disposed || expected !== epoch || request.signal.aborted || !allowed() || identity !== scopeIdentity) return false
        const value = parseHqAgentSnapshot(result)
        if (!value) throw new Error('Invalid agent snapshot')
        apply(value)
        if (attempt && attempts.get(attempt.key) === attempt) attempts.delete(attempt.key)
        return true
      }
      catch (error: unknown) {
        if (disposed || expected !== epoch || request.signal.aborted) return false
        const code = responseStatus(error)
        if (code === 401 || code === 403) live.invalidate('access')
        if (attempt && code !== undefined && code >= 400 && code < 500) attempts.delete(attempt.key)
        if (code === 401 || code === 403 || !snapshot.value) {
          snapshot.value = null; status.value = attempt ? 'error' : 'unavailable'
          if (freshnessTimer !== null) clearTimeout(freshnessTimer)
          freshnessTimer = null
        }
        else if (attempt) status.value = 'error'
        // A transient read failure retains the last authorized snapshot.
        // Every write still performs fresh server authorization.
        messageReason.value = attempt ? code !== undefined && code >= 400 && code < 500
          ? 'sendFailed'
          : 'unknownOutcome' : 'unavailable'
        return false
      }
      finally {
        if (!disposed && expected === epoch) {
          pending.value = false; refreshing.value = false; sending.value = false
          if (controller === request) controller = null
          if (inFlight === task) inFlight = null
          if (refreshQueued) { refreshQueued = false; if (allowed()) void refresh() }
        }
      }
    })
    inFlight = task
    return task
  }

  function refresh(): Promise<boolean> {
    if (inFlight) { refreshQueued = true; return inFlight }
    return run()
  }
  function send(message: string): Promise<boolean> {
    if (!allowed() || sending.value) return Promise.resolve(false)
    if (typeof message !== 'string' || !message.trim() || message.length > 6000 || hasHqControlCharacters(message)) {
      messageReason.value = 'invalidMessage'
      return Promise.resolve(false)
    }
    const prompt = message.trim()
    const key = `message:${prompt}`
    let attempt = attempts.get(key)
    if (!attempt) {
      if (attempts.size >= 16 || typeof crypto.randomUUID !== 'function' || scopeIdentity === null) {
        messageReason.value = 'sendFailed'; return Promise.resolve(false)
      }
      attempt = { key, prompt, requestKey: crypto.randomUUID(), identity: scopeIdentity }
      attempts.set(key, attempt)
    }
    // An uncertain POST keeps this exact prompt/UUID in memory under the same
    // founder identity. A matching GET message is not proof of its request ID.
    return run(attempt)
  }
  live.subscribePresence(observation => {
    const current = snapshot.value, now = Date.now(), observed = Date.parse(observation.observedAt)
    // Presence updates timestamps only. An in-flight snapshot is authoritative
    // for its own result; late frames cannot rewind it or imply new work.
    if (!allowed() || inFlight || !current || !Number.isFinite(observed)
      || observed > now + 300_000 || observed + 150_000 <= now
      || observed < Date.parse(current.runtime.lastSeenAt ?? '')) return
    snapshot.value = {
      ...current,
      runtime: { connected: true, lastSeenAt: observation.observedAt },
      agents: current.agents.map(agent => agent.id === observation.agentId && agent.status === 'working'
        && observation.taskId !== null && agent.taskId === observation.taskId
        && (!agent.lastSeenAt || observed >= Date.parse(agent.lastSeenAt))
        ? { ...agent, lastSeenAt: observation.observedAt } : agent),
    }
    clock.value = now; scheduleFreshness()
  })

  live.subscribe('agents', () => { void refresh(); void refreshTrials() }, reason => invalidate(false, reason === 'offline' ? 'unavailable' : null))
  watch(() => {
    const access = getAccess()
    return `${access.status}\u0000${accessIdentity(access) ?? ''}`
  }, () => {
    const access = getAccess()
    if (access.status !== 'founder' || !access.user?.displayName) {
      const ended = access.status === 'anonymous' || access.status === 'denied'
      invalidate(ended)
      trials.value = []; trialMessage.value = ''
      if (ended) scopeIdentity = null
      return
    }
    const identity = accessIdentity(access)!
    if (scopeIdentity !== identity) { invalidate(true); scopeIdentity = identity }
  }, { immediate: true, flush: 'sync' })
  // The authenticated stream's ready event owns the initial/reconnect read.
  onMounted(() => { mounted = true; void refreshTrials() })
  onScopeDispose(() => { disposed = true; invalidate(true); scopeIdentity = null })

  return { agents, send, refresh: async () => { await Promise.all([refresh(), refreshTrials()]) }, trialCommand }
}
