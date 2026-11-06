/** Read the canonical cloud registry. Persist only the scoped runtime manifest. */
export const BRAIN_ROOT = '1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8'
const FOLDER = 'application/vnd.google-apps.folder'
const ID = /^[A-Za-z0-9_-]{8,200}$/
const fail = code => { throw new Error(code) }
const requireValue = (value, code) => { if (!value) fail(code) }
export const T1_WORKER_MODEL = 'gpt-6.1-terra'
const records = [
  ['AG-CEO-001', 'CEO/Agent Instructions.md', null, 'T3_EXEC'],
  ['AG-HR-001', 'Departments/HR/HR Lead.md', 'hr-agent-development', 'T2_HEAD'],
  ['AG-HR-002', 'Departments/HR/HR Recruiter.md', 'hr-agent-development', 'T1_WORKER'],
  ['AG-HR-003', 'Departments/HR/HR Evaluator.md', 'hr-agent-development', 'T1_WORKER'],
  ['AG-RES-001', 'Departments/Research/Nadia profile.md', 'research-market-intelligence', 'T2_HEAD'],
  ['AG-SALES-001', 'Departments/Customer Acquisition/Omar profile.md', 'customer-acquisition-partnerships', 'T2_HEAD'],
  ['AG-CS-001', 'Departments/Customer Success/Salma profile.md', 'customer-success-onboarding', 'T2_HEAD'],
  ['AG-SOC-001', 'Departments/Social/Layla profile.md', 'social-community', 'T2_HEAD'],
  ['AG-EMAIL-001', 'Departments/Email/Youssef profile.md', 'email-lifecycle', 'T2_HEAD'],
  ['AG-DEV-001', 'Departments/Development/Adam profile.md', 'development-maintenance', 'T2_HEAD'],
]

/** Model tier is configuration evidence only; it does not qualify an agent to execute work. */
export const modelTierForAgent = agentId => records.find(([id]) => id === agentId)?.[3] ?? null
export const managerForAgent = agentId => agentId === 'AG-CEO-001' ? null
  : ['AG-HR-002', 'AG-HR-003'].includes(agentId) ? 'AG-HR-001' : 'AG-CEO-001'

export const pilotDepartments = Object.freeze({
  'social-community': 'AG-SOC-001',
  'research-market-intelligence': 'AG-RES-001',
  'customer-acquisition-partnerships': 'AG-SALES-001',
  'email-lifecycle': 'AG-EMAIL-001',
})

function cells(line) {
  // Wiki aliases contain a pipe which is not a table-column separator.
  return line.replace(/\[\[[^\]\n]+\]\]/g, link => link.replaceAll('|', '\u0001'))
    .replace(/^\s*\||\|\s*$/g, '').split('|').map(cell => cell.trim().replaceAll('\u0001', '|'))
}

function indexFiles(source) {
  requireValue(source?.rootId === BRAIN_ROOT && Array.isArray(source.files) && source.files.length < 10_000, 'roster-source-required')
  const byId = new Map(), byPath = new Map(), cached = new Map([[BRAIN_ROOT, '']])
  for (const file of source.files) {
    requireValue(ID.test(file.id || '') && typeof file.name === 'string' && file.name.length <= 250
      && !Array.from(file.name).some(char => char === '/' || char.charCodeAt(0) < 32) && Array.isArray(file.parents)
      && file.parents.every(id => ID.test(id)) && !byId.has(file.id), 'invalid-roster-index')
    byId.set(file.id, file)
  }
  function path(id, trail = new Set()) {
    if (cached.has(id)) return cached.get(id)
    requireValue(!trail.has(id) && trail.size < 16, 'roster-index-cycle')
    const file = byId.get(id)
    requireValue(file && file.parents.length === 1, 'roster-parent-required')
    const parent = file.parents[0]
    requireValue(parent === BRAIN_ROOT || byId.get(parent)?.mimeType === FOLDER, 'roster-parent-required')
    const ancestor = path(parent, new Set([...trail, id]))
    const result = (ancestor ? ancestor + '/' : '') + file.name
    cached.set(id, result)
    return result
  }
  for (const file of source.files) {
    if (file.id === BRAIN_ROOT) continue
    const full = path(file.id)
    requireValue(!byPath.has(full), 'ambiguous-roster-path')
    byPath.set(full, file)
  }
  return byPath
}

function resolveFile(index, path) {
  requireValue(typeof path === 'string' && !path.includes('..') && !path.includes('\\'), 'invalid-roster-path')
  const full = path.split('#')[0].trim().replace(/\.md$/i, '')
  const file = index.get(full + '.md') || index.get(full + '/SKILL.md')
  requireValue(file && file.mimeType !== FOLDER && ID.test(file.id), 'roster-file-missing')
  return file
}

function registryRows(text, index) {
  const rows = new Map()
  for (const line of text.split('\n').filter(line => /^\s*\|\s*AG-[A-Z]+-\d{3}\s*\|/.test(line))) {
    const row = cells(line)
    requireValue(row.length === 6 && !rows.has(row[0]), 'invalid-roster-registry')
    const profile = row[2].match(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/)?.[1]
    const [name, declaration = ''] = row[1].split(/\s+[—–]\s+/, 2).map(value => value.trim())
    requireValue(profile && /^[\p{L}\p{M}][\p{L}\p{M} .'-]{0,79}$/u.test(name)
      && row[3].length > 0 && row[3].length <= 240, 'invalid-roster-registry')
    const managerId = declaration.match(/\/[^|]*\b(AG-[A-Z]+-\d{3})\b/)?.[1]
    const workerTier = /\bT1_WORKER\b/.test(row[4]) ? 'T1_WORKER' : null
    if (managerId || workerTier) {
      rows.set(row[0], { id: row[0], name, lifecycle: row[3], role: declaration, profilePath: profile,
        profileFileId: resolveFile(index, profile).id, modelTier: workerTier, departmentKey: null, managerId })
    } else {
      rows.set(row[0], { id: row[0], name, lifecycle: row[3], profilePath: profile, profileFileId: resolveFile(index, profile).id })
    }
  }
  requireValue(records.every(([id]) => rows.has(id)), 'approved-roster-required')
  const known = new Map(records.map(([id, path, departmentKey, modelTier]) => [id, { path, departmentKey, modelTier, managerId: managerForAgent(id) }]))
  for (const [id, row] of rows) {
    if (known.has(id)) continue
    const managerBinding = known.get(row.managerId)
    requireValue(/^AG-[A-Z]+-\d{3}$/.test(id) && row.modelTier === 'T1_WORKER' && row.managerId
      && managerBinding?.modelTier === 'T2_HEAD' && !id.startsWith('AG-HR-'), 'approved-worker-record-required')
    row.departmentKey = managerBinding.departmentKey
    const managerDepartmentPath = managerBinding.path.split('/').slice(0, 2).join('/') + '/'
    requireValue(row.profilePath.startsWith(managerDepartmentPath), 'workforce-department-path-required')
    known.set(id, { path: row.profilePath, departmentKey: row.departmentKey, modelTier: row.modelTier, managerId: row.managerId })
  }
  for (const [id, row] of rows) {
    const binding = known.get(id)
    requireValue(row.profileFileId === resolveFile(index, binding.path).id, 'canonical-profile-required')
    row.modelTier = binding.modelTier
    row.departmentKey = binding.departmentKey
    row.managerId = binding.managerId
    row.role ||= binding.modelTier === 'T3_EXEC' ? 'CEO' : binding.modelTier === 'T2_HEAD' ? 'Department Head' : 'Department Worker'
    if (binding.modelTier !== 'T1_WORKER' || !binding.departmentKey) continue
    const manager = rows.get(binding.managerId)
    const managerBinding = known.get(binding.managerId)
    requireValue(manager && managerBinding?.modelTier === 'T2_HEAD' && managerBinding.departmentKey === binding.departmentKey,
      'workforce-manager-required')
  }
  return rows
}

function modelPolicy(text) {
  const tiers = new Map()
  for (const line of text.split('\n')) {
    if (!/^\s*\|\s*`T[123]_/.test(line)) continue
    const row = cells(line), tier = row[0]?.replaceAll('`', '')
    const model = row[2]?.match(/`(gpt-[a-zA-Z0-9.-]+)`/)?.[1]
    const effort = row[2]?.match(/effort\s+`(minimal|low|medium|high|xhigh)`/)?.[1]
    requireValue(model && effort && !tiers.has(tier), 'invalid-roster-model-policy')
    tiers.set(tier, { model, effort })
  }
  requireValue(['T3_EXEC', 'T2_HEAD', 'T1_WORKER'].every(tier => tiers.has(tier)), 'roster-model-policy-required')
  requireValue(tiers.get('T1_WORKER').model === T1_WORKER_MODEL, 'worker-model-policy-unavailable')
  return tiers
}

function assignedSkills(profile, profilePath, index) {
  const ceo = profilePath.startsWith('CEO/')
  const scope = ceo ? 'CEO/Skills/' : profilePath.split('/').slice(0, 2).join('/') + '/Skills/'
  const section = ceo
    ? profile.match(/## Nine active procedures\s*([\s\S]*?)(?=\n## |$)/)?.[1]
    : profile.match(/## (?:5\. (?:Assigned skills|Exact assigned skill[^\n]*))\s*([\s\S]*?)(?=\n## |$)/i)?.[1]
  requireValue(section, 'assigned-skill-section-required')
  const paths = [
    ...[...section.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)].map(m => m[1]),
    ...[...section.matchAll(/`([^`\n]+\/Skills\/[^`\n]+)`/g)].map(m => m[1]),
    ...[...section.matchAll(/\[([^\]\n]+\/Skills\/[^\]\n]+)\]\(https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/view\)/g)].map(m => m[1]),
  ]
  const ids = new Set()
  for (const path of paths) {
    if (!path.includes('/Skills/')) continue
    const sharedHr = profilePath === 'Departments/HR/HR Lead.md' && path === 'CEO/Skills/conversation-learning/SKILL.md'
    requireValue(path.startsWith(scope) || sharedHr, 'skill-outside-assigned-department')
    // A linked historical/deferred procedure is not an active assignment.
    requireValue(!/Automation Handoff/.test(path), 'inactive-skill-assignment')
    ids.add(resolveFile(index, path).id)
  }
  requireValue(ids.size > 0 && ids.size <= 10, 'assigned-skills-required')
  return [...ids]
}

export function createWorkforceRoster({ readBrain, rpc }) {
  requireValue(typeof readBrain === 'function' && typeof rpc === 'function', 'roster-adapters-required')
  return {
    async sync(workerId, signal = AbortSignal.timeout(120_000)) {
      const source = await rpc('hq_worker_roster_sources', { p_worker_id: workerId })
      const index = indexFiles(source)
      const registry = resolveFile(index, 'Company/Agent Registry'), policy = resolveFile(index, 'Company/Workforce Operating Rules')
      const firstReads = await readBrain({ brain_files: [registry, policy].map(file => ({ id: file.id })) }, signal)
      requireValue(Array.isArray(firstReads) && firstReads.length === 2, 'roster-read-incomplete')
      const documents = new Map()
      for (const file of firstReads) {
        requireValue([registry, policy].some(expected => expected.id === file.id && expected.name === file.name)
          && typeof file.text === 'string' && file.text.trim() && !documents.has(file.id), 'roster-read-incomplete')
        documents.set(file.id, file.text)
      }
      const rows = registryRows(documents.get(registry.id), index), tiers = modelPolicy(documents.get(policy.id))
      const profiles = [...rows.values()].map(row => resolveFile(index, row.profilePath))
      const requested = [...new Map(profiles.map(file => [file.id, file])).values()]
      const reads = await readBrain({ brain_files: requested.map(file => ({ id: file.id })) }, signal)
      requireValue(Array.isArray(reads) && reads.length === requested.length, 'roster-read-incomplete')
      for (const file of reads) {
        requireValue(requested.some(expected => expected.id === file.id && expected.name === file.name)
          && typeof file.text === 'string' && file.text.trim() && !documents.has(file.id), 'roster-read-incomplete')
        documents.set(file.id, file.text)
      }
      const agents = [...rows.values()].map(row => {
        const { id, profilePath: path, departmentKey, modelTier: tier } = row
        const expected = resolveFile(index, path)
        requireValue(row.profileFileId === expected.id, 'canonical-profile-required')
        const profile = documents.get(expected.id)
        requireValue(profile.includes(id), 'profile-identity-required')
        if (!records.some(([knownId]) => knownId === id)) {
          const frontmatter = profile.match(/^---\s*\n([\s\S]*?)\n---\s*$/m)?.[1] || ''
          const employeeId = frontmatter.match(/^employee_id:\s*([A-Z0-9-]+)\s*$/m)?.[1]
          const reportsTo = frontmatter.match(/^reports_to:\s*([A-Z0-9-]+)\s*$/m)?.[1]
          requireValue(employeeId === id && reportsTo === row.managerId, 'canonical-workforce-identity-mismatch')
        }
        return { ...row, departmentKey, ...tiers.get(tier), skillFileIds: assignedSkills(profile, path, index),
          managerId: row.managerId, modelTier: tier }
      })
      const result = await rpc('hq_worker_sync_roster', { p_worker_id: workerId, p_agents: agents })
      requireValue(result?.accepted === true && result.count === agents.length, 'roster-sync-unconfirmed')
      return { count: agents.length }
    },
  }
}
