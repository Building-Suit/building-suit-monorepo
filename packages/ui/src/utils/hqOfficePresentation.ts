import type { HqAgentPresentation, HqOfficeObservations } from '../types/hqAgentsPresentation'

/** Aggregate only the selected employees; missing evidence never becomes zero. */
export function hqOfficeSummary(agents: readonly HqAgentPresentation[], observations?: HqOfficeObservations) {
  const rows = agents.map(agent => ({ agent, observation: observations?.agents.find(row => row.id === agent.id) }))
  const complete = Boolean(observations) && rows.every(row => row.observation)
  const daily = Array.from({ length: 7 }, (_, index) => rows.reduce((sum, row) => sum + (row.observation?.metrics.daily[index] ?? 0), 0))
  const completed = rows.reduce((sum, row) => sum + (row.observation?.metrics.completed ?? 0), 0)
  const turnaround = rows.reduce((sum, row) => sum + (row.observation?.metrics.turnaroundSeconds ?? 0) * (row.observation?.metrics.completed ?? 0), 0)
  const tools = new Map<string, { id: string; name: string; kind: 'api' | 'native' | 'mcp'; icon: 'drive' | 'web' | 'tool'; active: boolean }>()
  const skills = new Map<string, { id: string; name: string; loads: number | null; running: boolean }>()
  for (const { agent, observation } of rows) {
    for (const tool of observation?.tools ?? []) {
      // Available means this worker has the binding; connection/activity is
      // separate. Do not list native search for employees who lack that grant.
      if (!tool.available) continue
      const previous = tools.get(tool.id)
      tools.set(tool.id, { ...tool, active: Boolean(previous?.active || tool.available && agent.connected) })
    }
    for (const skill of observation?.skills ?? []) {
      const previous = skills.get(skill.id)
      skills.set(skill.id, { ...skill,
        loads: skill.loads === null || previous?.loads === null ? null : skill.loads + (previous?.loads ?? 0),
        running: Boolean(previous?.running || skill.running && agent.connected && agent.activity === 'working'),
      })
    }
  }
  const knownUsage = complete && [...skills.values()].every(skill => skill.loads !== null)
  const total = [...skills.values()].reduce((sum, skill) => sum + (skill.loads ?? 0), 0)
  return {
    complete,
    today: complete ? rows.reduce((sum, row) => sum + (row.observation?.metrics.today ?? 0), 0) : null,
    running: complete ? rows.reduce((sum, row) => sum + (row.observation?.metrics.running ?? 0), 0) : null,
    turnaroundMinutes: complete && completed ? turnaround / completed / 60 : null,
    daily,
    tools: [...tools.values()].sort((a,b) => Number(b.active)-Number(a.active) || a.name.localeCompare(b.name)),
    skills: [...skills.values()].map(skill => ({ ...skill, percentage: knownUsage ? total ? (skill.loads ?? 0) / total * 100 : 0 : null }))
      .sort((a,b) => (b.loads ?? -1)-(a.loads ?? -1) || a.name.localeCompare(b.name)),
  }
}

export function hqSparkline(values: readonly number[]) {
  const maximum = Math.max(1,...values)
  return values.map((value,index) => `${index / Math.max(1,values.length-1) * 120},${28-value/maximum*24}`).join(' ')
}
