import { createHash } from 'node:crypto'
import type { HqCompanySnapshot } from '../../shared/types/companyPlans'
import type { GoogleBrainConfig } from './googleDriveAuth'
import { readBrainNote } from './brain'

// Canonical HR-owned roster; the existing reader verifies root ancestry and
// current version around the read. This never uses the worker/online roster.
const REGISTRY_ID = createHash('sha256').update('1ayMJWoihUx0rSYCkRc5hotRBRY1AAz9N').digest('base64url')
const DEPARTMENT_KEYS: Readonly<Record<string, string>> = {
  HR: 'hr-agent-development', Research: 'research-market-intelligence',
  'Customer Acquisition': 'customer-acquisition-partnerships',
  'Customer Success': 'customer-success-onboarding', Social: 'social-community',
  Email: 'email-lifecycle', Development: 'development-maintenance',
}

/** Display assignments only: never hires, qualifies or runs an employee. */
export async function withOfficeRoster(snapshot: HqCompanySnapshot, config: GoogleBrainConfig): Promise<HqCompanySnapshot> {
  const unassigned: HqCompanySnapshot = { ...snapshot, departments: snapshot.departments.map(department => ({
    id: department.id, name: department.name, approvedAt: department.approvedAt,
    ...(department.nameAr ? { nameAr: department.nameAr } : {}),
  })) }
  try {
    const note = await readBrainNote(config, REGISTRY_ID)
    if (note.path !== 'Company/Agent Registry.md') throw new Error('Unexpected roster source')
    const assignments = new Map<string, { id: string; name: string }[]>()
    const seen = new Set<string>()
    for (const line of note.content.split(/\r?\n/)) {
      if (!/^\|\s*AG-/.test(line)) continue
      // Wiki-link aliases may contain a pipe inside a Markdown table cell.
      const cells = line.replace(/\[\[[^\]]*\]\]/g, link => link.replaceAll('|', '\u0001')).split('|').slice(1, -1).map(cell => cell.trim())
      const [id, role, profile, lifecycle] = cells
      if (cells.length !== 6 || !id || !/^AG-[A-Z]+-[0-9]{3}$/.test(id) || seen.has(id) || seen.size >= 256
        || !role || !profile || !lifecycle) throw new Error('Invalid roster row')
      seen.add(id)
      if (/^(?:Candidate|Testing|Retired)\b/i.test(lifecycle)) continue
      const name = role.split(/\s+[—–]\s+/)[0]!.trim()
      if (!name || name.length > 100 || /[<>]/.test(name) || [...name].some(character => character.charCodeAt(0) < 32)) throw new Error('Invalid employee name')
      if (id === 'AG-CEO-001') continue // The existing executive desk belongs to Steve.
      const folder = /\[\[Departments\/([^/\]]+)\//.exec(profile)?.[1]
      const key = folder ? DEPARTMENT_KEYS[folder] : undefined
      if (!key) throw new Error('Unmapped employee department')
      const agents = assignments.get(key) ?? []
      agents.push({ id, name }); assignments.set(key, agents)
    }
    if (!seen.has('AG-CEO-001')) throw new Error('Incomplete roster')
    const keys = new Map(snapshot.plans.filter(plan => plan.status === 'approved').flatMap(plan => plan.departments.map(department => [department.id, department.key] as const)))
    return { ...unassigned, departments: unassigned.departments.map(department => {
      const key = keys.get(department.id)
      // An approved but unmapped department stays unknown, never guessed empty.
      return key && Object.values(DEPARTMENT_KEYS).includes(key)
        ? { ...department, agents: (assignments.get(key) ?? []).sort((a, b) => a.id.localeCompare(b.id, 'en')) }
        : department
    }) }
  }
  catch {
    // No stale/default desks on source failure. Company plan decisions and the
    // department projection remain usable, with assignments explicitly unknown.
    return unassigned
  }
}
