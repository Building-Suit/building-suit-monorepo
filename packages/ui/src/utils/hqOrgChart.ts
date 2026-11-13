import type { HqAgentPresentation } from '../types/hqAgentsPresentation'

const departmentKinds = [
  { key: 'sales', icon: 'handshake' }, { key: 'cs', icon: 'checkBadge' },
  { key: 'dev', icon: 'settings' }, { key: 'email', icon: 'mail' },
  { key: 'hr', icon: 'user' }, { key: 'res', icon: 'analytics' }, { key: 'soc', icon: 'team' },
] as const

/** Spokes group departments around the company; individual reports are shown in employee details. */
export function layoutHqOrgChart(agents: readonly HqAgentPresentation[], unassigned: string) {
  const chief = agents.find(agent => agent.role === 'ceo')
  const departments = new Map<string, { key: string; name: string; members: HqAgentPresentation[] }>()
  for (const agent of agents) {
    if (agent.id === chief?.id) continue
    const name = agent.departmentName || unassigned
    const key = agent.departmentId ? `id:${agent.departmentId}` : `name:${name}`
    const group = departments.get(key) ?? { key, name, members: [] }
    group.members.push(agent)
    departments.set(key, group)
  }
  const groups = [...departments.values()].map(group => {
    const kind = departmentKinds.findIndex(entry => group.members.some(agent => agent.id.toLowerCase().startsWith(`ag-${entry.key}-`)))
    return { ...group, kind }
  }).sort((a, b) => (a.kind < 0 ? 99 : a.kind) - (b.kind < 0 ? 99 : b.kind) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key))

  // The seven-position composition follows the reference. Other roster sizes
  // use an expanded ellipse so the cards remain readable rather than shrinking.
  const reference = [[0, -298], [363, -195], [467, 21], [286, 250], [-264, 250], [-465, 21], [-365, -195]] as const
  const cardWidth = 318
  const hubSize = 214
  const rx = Math.max(455, groups.length * 59), ry = Math.max(275, groups.length * 35)
  const positioned = groups.map((group, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / groups.length
    const [x, y] = groups.length === 7 ? reference[index]! : [rx * Math.cos(angle), ry * Math.sin(angle)]
    const height = group.members.length > 4 ? 199 : group.members.length === 4 ? 191 : 176
    const kind = departmentKinds[group.kind < 0 ? index % departmentKinds.length : group.kind]!
    return { ...group, x, y, width: cardWidth, height, tone: kind.key, icon: kind.icon }
  })
  const centerX = Math.ceil(Math.max(hubSize / 2, ...positioned.map(group => Math.abs(group.x) + group.width / 2)) + 38)
  const centerY = Math.ceil(Math.max(hubSize / 2, ...positioned.map(group => Math.abs(group.y) + group.height / 2)) + 34)
  const cards = positioned.map(group => ({
    ...group, x: centerX + group.x - group.width / 2, y: centerY + group.y - group.height / 2,
  }))
  const edges = chief ? positioned.map(group => {
    const distance = Math.hypot(group.x, group.y)
    const start = (hubSize / 2 + 10) / distance
    const edge = Math.min(group.width / 2 / Math.abs(group.x), group.height / 2 / Math.abs(group.y))
    const end = edge < 1 ? Math.max(start, 1 - edge - 6 / distance) : start
    return { id: group.key, x1: centerX + group.x * start, y1: centerY + group.y * start,
      x2: centerX + group.x * end, y2: centerY + group.y * end }
  }) : []
  return { chief, cards, edges, width: 2 * centerX, height: 2 * centerY, centerX, centerY, hubSize }
}
