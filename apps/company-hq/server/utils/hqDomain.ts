export type HqRole = 'ceo' | 'hr'
export type HqActor = { id: string; role: 'founder' | HqRole }
export type HqTaskStatus = 'proposed' | 'queued' | 'running' | 'review' | 'completed' | 'blocked' | 'failed' | 'cancelled'
export type HqStorageMode = 'unconfigured' | 'sqlite' | 'supabase'
export interface HqTask {
  id: string
  title: string
  brief: string
  owner: HqRole
  status: HqTaskStatus
  acceptance: string
  allowedActions: string
  budget: 0
  deliverable: string | null
  reviewEvidence: string | null
  approvedAt: string | null
  approvalSource: string | null
  createdAt: string
  updatedAt: string
}
export interface HqMessage {
  id: string
  agent: HqRole
  role: 'founder' | HqRole
  channel: 'founder_ceo' | 'internal'
  recipient: 'founder' | HqRole
  text: string
  status: 'queued' | 'answered' | 'delivered'
  createdAt: string
}
export interface HqEvent { id: string; agent: HqRole; type: string; title: string; detail: string; createdAt: string; taskId?: string }
export interface HqResult { ok: true; id: string; status: string }
export interface HqDocument {
  tasks: HqTask[]
  messages: HqMessage[]
  events: HqEvent[]
  lastAgentSeen: string | null
  receipts: Record<string, { payload: string; result: HqResult }>
}
export type HqCommandName = 'send_message' | 'create_task' | 'approve_task' | 'cancel_task' | 'hq_reply' | 'hq_report' | 'hq_delegate_task' | 'hq_update_task' | 'hq_propose_task'
export interface HqCommand { name: HqCommandName; key: string; payload: Record<string, string> }
export class HqProblem extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}
const problem = (status: number, code: string, message: string): never => { throw new HqProblem(status, code, message) }
const inputError = (message: string) => problem(422, 'HQ_INVALID_INPUT', message)
const denied = (message: string) => problem(403, 'HQ_ACCESS_DENIED', message)
const conflict = (message: string) => problem(409, 'HQ_CONFLICT', message)
const missing = (message: string) => problem(404, 'HQ_NOT_FOUND', message)
const object = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return inputError('A JSON object is required.')
  return input as Record<string, unknown>
}
const field = (v: unknown, label: string, max: number): string => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) return inputError(label + ' is required and must be at most ' + max + ' characters.')
  return v.trim()
}
const identifier = (v: unknown, label: string, max: number): string => {
  const value = field(v, label, max)
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return inputError(label + ' is invalid.')
  return value
}
const uid = (prefix: string) => prefix + '_' + crypto.randomUUID().replaceAll('-', '')
const only = (input: Record<string, unknown>, fields: string[]) => {
  if (Object.keys(input).some(k => !fields.includes(k))) return inputError('Unexpected command fields.')
}
const TRANSITIONS: Record<HqTaskStatus, HqTaskStatus[]> = {
  proposed: [], queued: ['running', 'blocked', 'failed'], running: ['review', 'blocked', 'failed'],
  review: ['running', 'completed', 'blocked', 'failed'], blocked: ['queued', 'failed'],
  failed: [], completed: [], cancelled: [],
}
export const roster = [
  { id: 'ceo', name: 'CEO', role: 'Executive Office', onDemand: true, description: 'Plans with the founder, delegates approved work and reviews evidence.', skills: ['Planning', 'Delegation', 'Review'] },
  { id: 'hr', name: 'HR Lead', role: 'HR & Agent Development', onDemand: true, description: 'Researches staffing and skills within work delegated by the CEO.', skills: ['Recruitment', 'Skill assessment', 'Workforce planning'] },
] as const
const notes = [
  { title: 'Founder authority', text: 'The founder approves execution and remains the final authority. Company conversations go through the CEO.' },
  { title: 'Current workforce', text: 'CEO and HR Lead work on demand. Unassigned rooms do not represent departments or agents.' },
  { title: 'Company knowledge', text: 'Read the current authorized Brain before answering. Save work learning only from substantive work.' },
  { title: 'Completion and cost', text: 'Record the actual deliverable and fresh review evidence. All task budgets are zero.' },
]
export function initialDocument(): HqDocument {
  const date = '2026-11-03'
  return {
    tasks: [{ id: 'HR-001', title: 'Company HQ staffing assessment', brief: 'Assess the smallest team and skills needed for Company HQ.', owner: 'hr', status: 'completed', acceptance: 'Bounded research and independent artifact review.', allowedActions: 'Review scoped company records; research public sources; prepare a staffing report.', budget: 0, deliverable: 'Recommended a temporary HQ builder and separate reviewer; no new employee was hired.', reviewEvidence: 'Independent review accepted criteria 1–5. Full execution-history audit was not available.', approvedAt: date, approvalSource: 'Founder approved the supervised first HR assignment.', createdAt: date, updatedAt: date }],
    messages: [], events: [{ id: 'historic-hr-001-reviewed', agent: 'hr', type: 'review', title: 'First HR assignment reviewed', detail: 'The actual staffing report received independent review. No new employee was hired.', createdAt: date, taskId: 'HR-001' }],
    receipts: {}, lastAgentSeen: null,
  }
}
export function projectState(doc: HqDocument, actor: HqActor, storageMode: Exclude<HqStorageMode, 'unconfigured'>) {
  const isHr = actor.role === 'hr'
  const visibleTasks = doc.tasks.filter(t => !isHr || t.owner === 'hr')
  const tasks = visibleTasks.slice(0, 150)
  const messages = doc.messages.filter(m => m.channel === 'founder_ceo' && !isHr).slice(-180)
    .map(({ channel: _channel, recipient: _recipient, ...message }) => message)
  const events = doc.events.filter(e => !isHr || e.agent === 'hr' || (e.type === 'delegation' && visibleTasks.some(t => t.id === e.taskId))).slice(0, 80)
  return {
    ok: true as const, storageMode,
    agents: roster.map(agent => ({
      ...agent, status: visibleTasks.some(t => t.owner === agent.id && t.status === 'running') ? 'working' as const
        : visibleTasks.some(t => t.owner === agent.id && t.status === 'review') ? 'reviewing' as const : 'idle' as const,
    })),
    tasks, messages, events,
    ...(actor.role !== 'founder' ? { internalMessages: doc.messages.filter(m => m.channel === 'internal').slice(-120) } : {}),
    brain: { name: 'Company Brain', source: 'Founder’s maintained Drive Brain', connection: 'assistant_bridge' as const, updatedAt: '2026-11-03', notes },
    connection: { executor: 'on_demand' as const, connected: !!doc.lastAgentSeen && Date.now() - Date.parse(doc.lastAgentSeen) < 120_000, lastAgentSeen: doc.lastAgentSeen },
    cost: { paidCallsEnabled: false as const, limit: 0 as const },
  }
}
export function parseFounderAction(body: unknown, actor: HqActor): HqCommand {
  if (actor.role !== 'founder') return denied('Only the founder can use this action.')
  const input = object(body)
  const key = identifier(input.idempotencyKey, 'Request key', 100)
  const common = ['action', 'idempotencyKey']
  switch (input.action) {
    case 'send_message':
      only(input, [...common, 'text', 'agent'])
      if (input.agent !== undefined && input.agent !== 'ceo') return denied('Founder conversations go only to the CEO.')
      return { name: 'send_message', key, payload: { text: field(input.text, 'Message', 6000) } }
    case 'create_task':
      only(input, [...common, 'owner', 'budget', 'title', 'brief', 'acceptance', 'allowedActions'])
      if (input.owner !== undefined && input.owner !== 'ceo') return denied('New assignments begin with the CEO.')
      if (input.budget !== undefined && input.budget !== 0) return inputError('Only zero-budget tasks are supported.')
      return { name: 'create_task', key, payload: {
        title: field(input.title, 'Title', 180), brief: field(input.brief, 'Outcome', 5000),
        acceptance: field(input.acceptance, 'Definition of done', 3000), allowedActions: field(input.allowedActions, 'Allowed actions', 3000),
      } }
    case 'approve_task':
    case 'cancel_task':
      only(input, [...common, 'id'])
      return { name: input.action, key, payload: { id: identifier(input.id, 'Task', 120) } }
    default: return inputError('Unknown founder action.')
  }
}
export function parseAgentAction(name: unknown, body: unknown, actor: HqActor): HqCommand {
  if (actor.role === 'founder') return denied('Use an authorized executor identity.')
  const input = object(body)
  if (input.agent !== undefined && input.agent !== actor.role) return denied('The executor cannot act as another role.')
  const key = identifier(input.requestKey, 'Request key', 100)
  const common = ['requestKey', 'agent']
  if (name === 'hq_propose_task') {
    if (actor.role !== 'ceo') return denied('Only the CEO can propose an assignment to the founder.')
    only(input, [...common, 'title', 'brief', 'acceptance', 'allowedActions', 'budget'])
    if (input.budget !== undefined && input.budget !== 0) return inputError('Only zero-budget tasks are supported.')
    return { name, key, payload: { title: field(input.title, 'Title', 180), brief: field(input.brief, 'Outcome', 5000), acceptance: field(input.acceptance, 'Definition of done', 3000), allowedActions: field(input.allowedActions, 'Allowed actions', 3000) } }
  }
  if (name === 'hq_reply') {
    if (actor.role !== 'ceo') return denied('Only the CEO can reply to the founder.')
    only(input, [...common, 'text', 'replyTo'])
    return { name, key, payload: { text: field(input.text, 'Reply', 8000), ...(input.replyTo === undefined ? {} : { replyTo: identifier(input.replyTo, 'Original message', 120) }) } }
  }
  if (name === 'hq_report') {
    if (actor.role !== 'hr') return denied('This command submits an internal HR report to the CEO.')
    only(input, [...common, 'id', 'text'])
    return { name, key, payload: { id: identifier(input.id, 'Task', 120), text: field(input.text, 'Report', 8000) } }
  }
  if (name === 'hq_delegate_task') {
    if (actor.role !== 'ceo') return denied('Only the CEO can delegate approved work to HR.')
    only(input, [...common, 'id', 'detail', 'to'])
    if (input.to !== undefined && input.to !== 'hr') return inputError('HR is the only available delegate.')
    return { name, key, payload: { id: identifier(input.id, 'Task', 120), detail: field(input.detail, 'Delegation', 1500) } }
  }
  if (name === 'hq_update_task') {
    only(input, [...common, 'id', 'status', 'detail', 'deliverable', 'reviewEvidence'])
    const status = field(input.status, 'Status', 20)
    if (!['queued', 'running', 'review', 'completed', 'blocked', 'failed'].includes(status)) return inputError('Invalid task status.')
    if (actor.role === 'hr' && (status === 'completed' || input.reviewEvidence !== undefined)) return denied('The CEO records independent review and completion.')
    return { name, key, payload: {
      id: identifier(input.id, 'Task', 120), status, detail: field(input.detail, 'Progress evidence', 1500),
      ...(input.deliverable === undefined ? {} : { deliverable: field(input.deliverable, 'Deliverable', 12000) }),
      ...(input.reviewEvidence === undefined ? {} : { reviewEvidence: field(input.reviewEvidence, 'Review evidence', 12000) }),
    } }
  }
  return inputError('Unknown executor action.')
}
export function executeLocal(doc: HqDocument, actor: HqActor, command: HqCommand, now = new Date().toISOString()): { document: HqDocument; result: HqResult } {
  const { name, key, payload } = command
  const founderCommand = ['send_message', 'create_task', 'approve_task', 'cancel_task'].includes(name)
  if (founderCommand !== (actor.role === 'founder')) return denied('This command is not allowed for this identity.')
  if ((name === 'hq_reply' || name === 'hq_delegate_task' || name === 'hq_propose_task') && actor.role !== 'ceo') return denied('CEO authorization is required.')
  if (name === 'hq_report' && actor.role !== 'hr') return denied('HR authorization is required.')
  const receiptKey = actor.id + ':' + key
  const fingerprint = JSON.stringify([name, Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))])
  const prior = doc.receipts[receiptKey]
  if (prior) {
    if (prior.payload !== fingerprint) return conflict('This request key was already used for a different command.')
    return { document: doc, result: prior.result }
  }
  const next = structuredClone(doc)
  const addEvent = (agent: HqRole, type: string, title: string, detail: string, taskId?: string) =>
    next.events.unshift({ id: uid('evt'), agent, type, title, detail, createdAt: now, ...(taskId ? { taskId } : {}) })
  const save = (id: string, status: string) => {
    const result = { ok: true as const, id, status }
    next.receipts[receiptKey] = { payload: fingerprint, result }
    if (!founderCommand) next.lastAgentSeen = now
    return { document: next, result }
  }
  if (name === 'send_message' || name === 'hq_reply') {
    const reply = name === 'hq_reply'
    if (reply && payload.replyTo) {
      const original = next.messages.find(m => m.id === payload.replyTo && m.channel === 'founder_ceo' && m.role === 'founder')
      if (!original) return missing('The founder message was not found.')
      original.status = 'answered'
    }
    const id = uid('msg'), status = reply ? 'delivered' : 'queued'
    next.messages.push({ id, agent: 'ceo', role: reply ? 'ceo' : 'founder', recipient: reply ? 'founder' : 'ceo', channel: 'founder_ceo', text: payload.text!, status, createdAt: now })
    addEvent('ceo', reply ? 'reply' : 'message', reply ? 'CEO replied' : 'Message saved', reply ? 'An authorized CEO reply was recorded.' : 'Your message is queued for the CEO.')
    return save(id, status)
  }
  if (name === 'create_task' || name === 'hq_propose_task') {
    const id = uid('task')
    next.tasks.unshift({ id, title: payload.title!, brief: payload.brief!, owner: 'ceo', status: 'proposed', acceptance: payload.acceptance!, allowedActions: payload.allowedActions!, budget: 0, deliverable: null, reviewEvidence: null, approvedAt: null, approvalSource: null, createdAt: now, updatedAt: now })
    addEvent('ceo', 'plan', 'Plan ready for approval', payload.title!, id)
    return save(id, 'proposed')
  }
  const task = next.tasks.find(t => t.id === payload.id)
  if (!task) return missing('Task was not found.')
  if (name === 'approve_task') {
    if (task.status !== 'proposed') return conflict('Only a proposed plan can be approved.')
    task.status = 'queued'
    task.approvedAt = now
    task.approvalSource = 'Founder approved in Company HQ'
    task.updatedAt = now
    addEvent('ceo', 'approval', 'Plan approved', task.title, task.id)
    return save(task.id, task.status)
  }
  if (name === 'cancel_task') {
    if (['completed', 'cancelled', 'failed'].includes(task.status)) return conflict('This task is already closed.')
    task.status = 'cancelled'
    task.updatedAt = now
    addEvent(task.owner, 'cancel', 'Task cancelled', task.title, task.id)
    return save(task.id, task.status)
  }
  if (!task.approvedAt) return denied('Founder approval is required before work begins.')
  if (name === 'hq_delegate_task') {
    if (task.owner !== 'ceo' || task.status !== 'queued') return conflict('Only a queued CEO assignment can be delegated.')
    task.owner = 'hr'
    task.updatedAt = now
    addEvent('ceo', 'delegation', 'CEO delegated to HR', payload.detail!, task.id)
    return save(task.id, task.status)
  }
  if (name === 'hq_report') {
    if (task.owner !== 'hr' || !['running', 'review'].includes(task.status)) return denied('This report must relate to an active HR assignment.')
    const id = uid('msg')
    next.messages.push({ id, agent: 'hr', role: 'hr', recipient: 'ceo', channel: 'internal', text: payload.text!, status: 'delivered', createdAt: now })
    addEvent('hr', 'report', 'HR report recorded', 'HR submitted evidence to the CEO.', task.id)
    return save(id, 'delivered')
  }
  if (name === 'hq_update_task') {
    const status = payload.status as HqTaskStatus
    const ceoReviewsHr = actor.role === 'ceo' && task.owner === 'hr' && task.status === 'review' && ['completed', 'running'].includes(status)
    if (task.owner !== actor.role && !ceoReviewsHr) return denied('This task belongs to a different executor.')
    if (!TRANSITIONS[task.status].includes(status)) return conflict('That task transition is not allowed.')
    if (actor.role === 'hr' && (status === 'completed' || payload.reviewEvidence !== undefined || task.status === 'review')) return denied('The CEO reviews HR work.')
    const deliverable = payload.deliverable ?? task.deliverable
    const reopening = task.status === 'review' && status === 'running'
    let review = reopening || ['running', 'queued', 'blocked'].includes(status) || deliverable !== task.deliverable ? null : task.reviewEvidence
    if (!reopening && ['review', 'completed'].includes(status) && payload.reviewEvidence !== undefined) review = payload.reviewEvidence
    if (status === 'review' && !deliverable) return inputError('Provide the actual deliverable before review.')
    if (status === 'completed' && (!deliverable || !review)) return inputError('Deliverable and fresh review evidence are required.')
    task.status = status
    task.deliverable = deliverable
    task.reviewEvidence = review
    task.updatedAt = now
    addEvent(actor.role as HqRole, 'task', task.title + ' · ' + status, payload.detail!, task.id)
    return save(task.id, status)
  }
  return inputError('Unknown command.')
}
