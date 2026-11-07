/** Bounded founder-visible read model; never worker grants or free-form HTML. */
export interface HqOfficeObservations {
  since: string
  observedAt: string
  runningTasks: { id: string; title: string; assigneeId: string | null; status: 'working' | 'review'; createdAt: string; brief: string; acceptance: string }[]
  recentTasks?: { id: string; title: string; assigneeId: string | null; status: 'queued' | 'working' | 'review' | 'completed' | 'blocked' | 'canceled'; createdAt: string; brief: string; acceptance: string }[]
  tasksPartial: boolean
  agents: {
    id: string
    metrics: { today: number; running: number; turnaroundSeconds: number | null; completed: number; daily: number[] }
    tools: { id: string; name: string; kind: 'api' | 'native' | 'mcp'; icon: 'drive' | 'web' | 'tool'; available: boolean }[]
    skills: { id: string; name: string; loads: number | null; running: boolean }[]
  }[]
}
export function parseHqOfficeObservations(value: unknown): HqOfficeObservations | null {
  const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
  const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
  const text = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max && ![...v].some(character => character.charCodeAt(0) < 32)
  const date = (v: unknown) => typeof v === 'string' && v.length < 64 && Number.isFinite(Date.parse(v))
  if (!object(value) || !date(value.since) || !date(value.observedAt) || !Array.isArray(value.agents) || value.agents.length > 128
    || new TextEncoder().encode(JSON.stringify(value)).byteLength > 512 * 1024) return null
  if (!Array.isArray(value.runningTasks) || value.runningTasks.length > 32 || typeof value.tasksPartial !== 'boolean') return null
  if (value.recentTasks !== undefined && (!Array.isArray(value.recentTasks) || value.recentTasks.length > 128)) return null
  for (const [tasks, statuses] of [[value.runningTasks, ['working','review']], [value.recentTasks ?? [], ['queued','working','review','completed','blocked','canceled']]] as [unknown[], readonly string[]][]) {
    const taskIds = new Set<string>()
    for (const task of tasks) {
      if (!object(task) || !text(task.id, 40) || !/^[0-9a-f-]{36}$/i.test(String(task.id)) || taskIds.has(String(task.id)) || !text(task.title, 180)
        || !(task.assigneeId === null || typeof task.assigneeId === 'string' && /^AG-[A-Z]+-[0-9]{3}$/.test(task.assigneeId))
        || !statuses.includes(String(task.status)) || !date(task.createdAt)
        || typeof task.brief !== 'string' || task.brief.length > 2000 || typeof task.acceptance !== 'string' || task.acceptance.length > 1000) return null
      taskIds.add(String(task.id))
    }
  }
  const seen = new Set<string>()
  for (const a of value.agents) {
    if (!object(a) || !text(a.id, 40) || !/^AG-[A-Z]+-[0-9]{3}$/.test(String(a.id)) || seen.has(String(a.id))
      || !object(a.metrics) || !Array.isArray(a.tools) || a.tools.length > 32 || !Array.isArray(a.skills) || a.skills.length > 10) return null
    seen.add(String(a.id))
    const m = a.metrics
    if (![m.today,m.running,m.completed].every(count) || !(m.turnaroundSeconds === null || count(m.turnaroundSeconds))
      || !Array.isArray(m.daily) || m.daily.length !== 7 || !m.daily.every(count)) return null
    const tools = new Set<string>(), skills = new Set<string>()
    for (const t of a.tools) {
      if (!object(t) || !text(t.id, 80) || tools.has(String(t.id)) || !text(t.name, 120) || !['api','native','mcp'].includes(String(t.kind))
        || !['drive','web','tool'].includes(String(t.icon)) || typeof t.available !== 'boolean') return null
      tools.add(String(t.id))
    }
    for (const s of a.skills) {
      if (!object(s) || !text(s.id, 200) || skills.has(String(s.id)) || !text(s.name, 240) || !(s.loads === null || count(s.loads)) || typeof s.running !== 'boolean') return null
      skills.add(String(s.id))
    }
  }
  // Return an explicit projection, discarding any unexpected provider fields.
  return { since: String(value.since), observedAt: String(value.observedAt), tasksPartial: value.tasksPartial,
    ...(Array.isArray(value.recentTasks) ? { recentTasks: value.recentTasks.map(t => ({ id: t.id, title: t.title, assigneeId: t.assigneeId, status: t.status, createdAt: t.createdAt, brief: t.brief, acceptance: t.acceptance })) } : {}),
    runningTasks: value.runningTasks.map(t => ({ id: t.id, title: t.title, assigneeId: t.assigneeId, status: t.status, createdAt: t.createdAt, brief: t.brief, acceptance: t.acceptance })), agents: value.agents.map(a => ({
    id: a.id, metrics: { today: a.metrics.today, running: a.metrics.running, turnaroundSeconds: a.metrics.turnaroundSeconds, completed: a.metrics.completed, daily: a.metrics.daily },
    tools: a.tools.map((t: HqOfficeObservations['agents'][number]['tools'][number]) => ({ id: t.id, name: t.name, kind: t.kind, icon: t.icon, available: t.available })),
    skills: a.skills.map((s: HqOfficeObservations['agents'][number]['skills'][number]) => ({ id: s.id, name: s.name, loads: s.loads, running: s.running })),
  })) }
}
