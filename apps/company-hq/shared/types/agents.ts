import { parseHqOfficeObservations, type HqOfficeObservations } from './officeObservations'
/** Wire contracts contain founder-visible projections only, never worker grants or leases. */
export interface HqAgentRecord {
  id: string
  name: string
  role: string
  departmentId: string | null
  deskIndex: number
  status: 'offline' | 'idle' | 'working' | 'blocked'
  taskId: string | null
  lastSeenAt: string | null
  departmentKey?: string | null
  profileFileId?: string | null
  skillFileIds?: string[]
  lifecycle?: string
  model?: string | null
  effort?: string | null
  managerId?: string | null
  capability?: 'bounded-drafting'
}
export interface HqAgentMessage {
  id: string
  role: 'founder' | 'assistant'
  agentId: string
  text: string
  createdAt: string
  replyTo: string | null
  kind?: 'message' | 'handoff' | 'acknowledgement' | 'task-result' | 'recovery'
  taskId?: string | null
  mentions?: { agentId: string; name: string }[]
}
export interface HqAgentJob {
  id: string
  agentId: string
  status: 'queued' | 'working' | 'completed' | 'blocked'
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  error: string | null
  kind?: 'conversation-hr' | 'conversation-ceo' | 'conversation-intake' | 'task-route' | 'task-ack' | 'task-start' | 'task-work' | 'head-review' | 'ceo-review' | 'task-report' | 'lesson-extract' | 'lesson-review' | 'staffing-plan' | 'staffing-review'
  founderMessageId?: string | null
  recoveryOf?: string | null
}
export interface HqBusinessTask {
  id: string
  title: string
  brief: string
  acceptance: string
  assigneeId: string | null
  status: 'queued' | 'working' | 'review' | 'completed' | 'blocked' | 'canceled'
  createdAt: string
  updatedAt: string
  completedAt: string | null
  repairCount: number
  deliverable: string | null
  reviewSummary: string | null
  error: string | null
}
export interface HqAgentLesson {
  id: string
  sourceType: 'conversation' | 'task'
  sourceId: string
  status: 'proposed' | 'accepted' | 'rejected' | 'published'
  summary: string
  body: string
  agentId: string
  createdAt: string
  reviewedAt: string | null
  publishedAt: string | null
  publicationReference: string | null
}
export interface HqAgentSnapshot {
  observations?: HqOfficeObservations
  version?: 2
  tasks?: HqBusinessTask[]
  lessons?: HqAgentLesson[]
  agents: HqAgentRecord[]
  messages: HqAgentMessage[]
  jobs: HqAgentJob[]
  runtime: { connected: boolean; lastSeenAt: string | null }
  conversationId: string | null
}

export const HQ_AGENT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const AGENT = /^AG-[A-Z]+-[0-9]{3}$/
/** Accept ordinary tab/newline formatting while rejecting hidden control bytes. */
export function hasHqControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) return true
  }
  return false
}
function exact(value: unknown, keys: readonly string[], optional: readonly string[] = []): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = value as Record<string, unknown>
  return keys.every(key => Object.hasOwn(result, key)) && Object.keys(result).every(key => keys.includes(key) || optional.includes(key)) ? result : null
}
function text(value: unknown, max: number) { return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !hasHqControlCharacters(value) }
function id(value: unknown) { return typeof value === 'string' && HQ_AGENT_UUID.test(value) }
function agent(value: unknown) { return typeof value === 'string' && AGENT.test(value) }
function date(value: unknown) { return typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value)) }
const nullable = (value: unknown, predicate: (entry: unknown) => boolean) => value === null || predicate(value)

/** Identical bounded parser for the BFF and browser; no server dependency enters the client. */
export function parseHqAgentSnapshot(value: unknown): HqAgentSnapshot | null {
  const snapshot = exact(value, ['agents', 'messages', 'jobs', 'runtime', 'conversationId'], ['version', 'tasks', 'lessons', 'observations'])
  if (!snapshot || new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > 1536 * 1024
    || !nullable(snapshot.conversationId, id) || !Array.isArray(snapshot.agents) || snapshot.agents.length > 128
    || !Array.isArray(snapshot.messages) || snapshot.messages.length > 32 || !Array.isArray(snapshot.jobs) || snapshot.jobs.length > 40) return null
  const runtime = exact(snapshot.runtime, ['connected', 'lastSeenAt'])
  if (!runtime || typeof runtime.connected !== 'boolean' || !nullable(runtime.lastSeenAt, date)) return null
  const seenAgents = new Set<string>(), seenMessages = new Set<string>(), seenJobs = new Set<string>()
  for (const item of snapshot.agents) {
    const entry = exact(item, ['id', 'name', 'role', 'departmentId', 'deskIndex', 'status', 'taskId', 'lastSeenAt'], ['departmentKey', 'profileFileId', 'skillFileIds', 'lifecycle', 'model', 'effort', 'managerId', 'capability'])
    if (!entry || !agent(entry.id) || seenAgents.has(String(entry.id)) || !text(entry.name, 120) || !text(entry.role, 120)
      || !nullable(entry.departmentId, id) || !(Number.isInteger(entry.deskIndex) && Number(entry.deskIndex) >= 0 && Number(entry.deskIndex) <= 127)
      || !['offline', 'idle', 'working', 'blocked'].includes(String(entry.status))
      || !nullable(entry.taskId, id) || !nullable(entry.lastSeenAt, date)) return null
    if (Object.hasOwn(entry, 'capability') && (entry.capability !== 'bounded-drafting'
      || !nullable(entry.departmentKey, value => text(value, 120)) || !nullable(entry.profileFileId, value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,200}$/.test(value))
      || !Array.isArray(entry.skillFileIds) || entry.skillFileIds.length > 10 || !entry.skillFileIds.every(value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,200}$/.test(value))
      || !text(entry.lifecycle, 160) || !nullable(entry.model, value => text(value, 80)) || !nullable(entry.effort, value => text(value, 32))
      || !nullable(entry.managerId, agent))) return null
    seenAgents.add(String(entry.id))
  }
  for (const item of snapshot.messages) {
    const entry = exact(item, ['id', 'role', 'agentId', 'text', 'createdAt', 'replyTo'], ['kind', 'taskId', 'mentions'])
    if (!entry || !id(entry.id) || seenMessages.has(String(entry.id)) || !agent(entry.agentId) || !text(entry.text, 32000) || !date(entry.createdAt)
      || !(entry.role === 'founder' && entry.replyTo === null || entry.role === 'assistant' && id(entry.replyTo))) return null
    if (entry.kind !== undefined && !['message', 'handoff', 'acknowledgement', 'task-result', 'recovery'].includes(String(entry.kind))) return null
    if (entry.taskId !== undefined && !nullable(entry.taskId, id)) return null
    if (entry.mentions !== undefined && (!Array.isArray(entry.mentions) || entry.mentions.length > 10 || !entry.mentions.every(value => {
      const mention = exact(value, ['agentId', 'name'])
      return mention && agent(mention.agentId) && text(mention.name, 120) && seenAgents.has(String(mention.agentId))
    }))) return null
    seenMessages.add(String(entry.id))
  }
  for (const item of snapshot.jobs) {
    const entry = exact(item, ['id', 'agentId', 'status', 'createdAt', 'startedAt', 'completedAt', 'error'], ['kind', 'founderMessageId', 'recoveryOf'])
    if (!entry || !id(entry.id) || seenJobs.has(String(entry.id)) || !agent(entry.agentId) || !['queued', 'working', 'completed', 'blocked'].includes(String(entry.status))
      || !date(entry.createdAt) || !nullable(entry.startedAt, date) || !nullable(entry.completedAt, date)
      || !(entry.error === null || typeof entry.error === 'string' && /^[a-z-]{1,80}$/.test(entry.error))) return null
    if (entry.kind !== undefined && !['conversation-hr', 'conversation-ceo', 'conversation-intake', 'task-route', 'task-ack', 'task-start', 'task-work', 'head-review', 'ceo-review', 'task-report', 'lesson-extract', 'lesson-review', 'staffing-plan', 'staffing-review'].includes(String(entry.kind))) return null
    if (entry.founderMessageId !== undefined && !nullable(entry.founderMessageId, id)) return null
    if (entry.recoveryOf !== undefined && !nullable(entry.recoveryOf, id)) return null
    seenJobs.add(String(entry.id))
  }
  if (snapshot.conversationId === null && (snapshot.messages.length || snapshot.jobs.length)) return null
  if (snapshot.version !== undefined && snapshot.version !== 2) return null
  if (snapshot.tasks !== undefined) {
    if (!Array.isArray(snapshot.tasks) || snapshot.tasks.length > 32) return null
    const seen = new Set<string>()
    for (const item of snapshot.tasks) {
      const entry = exact(item, ['id', 'title', 'brief', 'acceptance', 'assigneeId', 'status', 'createdAt', 'updatedAt', 'completedAt', 'repairCount', 'deliverable', 'reviewSummary', 'error'])
      if (!entry || !id(entry.id) || seen.has(String(entry.id)) || !text(entry.title, 180) || !text(entry.brief, 12000) || !text(entry.acceptance, 6000)
        || !nullable(entry.assigneeId, agent) || !['queued', 'working', 'review', 'completed', 'blocked', 'canceled'].includes(String(entry.status))
        || !date(entry.createdAt) || !date(entry.updatedAt) || !nullable(entry.completedAt, date)
        || !Number.isInteger(entry.repairCount) || Number(entry.repairCount) < 0 || Number(entry.repairCount) > 2
        || !nullable(entry.deliverable, value => text(value, 32000)) || !nullable(entry.reviewSummary, value => text(value, 8000))
        || !nullable(entry.error, value => typeof value === 'string' && /^[a-z-]{1,80}$/.test(value))) return null
      seen.add(String(entry.id))
    }
  }
  if (snapshot.lessons !== undefined) {
    if (!Array.isArray(snapshot.lessons) || snapshot.lessons.length > 16) return null
    const seen = new Set<string>()
    for (const item of snapshot.lessons) {
      const entry = exact(item, ['id', 'sourceType', 'sourceId', 'status', 'summary', 'body', 'agentId', 'createdAt', 'reviewedAt', 'publishedAt', 'publicationReference'])
      if (!entry || !id(entry.id) || seen.has(String(entry.id)) || !['conversation', 'task'].includes(String(entry.sourceType)) || !id(entry.sourceId)
        || !['proposed', 'accepted', 'rejected', 'published'].includes(String(entry.status)) || !text(entry.summary, 240) || !text(entry.body, 8000)
        || !agent(entry.agentId) || !date(entry.createdAt) || !nullable(entry.reviewedAt, date) || !nullable(entry.publishedAt, date)
        || !nullable(entry.publicationReference, value => typeof value === 'string' && /^https:\/\/(drive|docs)\.google\.com\/[A-Za-z0-9_/?=&.#%-]{1,300}$/.test(value))) return null
      seen.add(String(entry.id))
    }
  }
  if (snapshot.observations !== undefined && !parseHqOfficeObservations(snapshot.observations)) return null
  return snapshot as unknown as HqAgentSnapshot
}
