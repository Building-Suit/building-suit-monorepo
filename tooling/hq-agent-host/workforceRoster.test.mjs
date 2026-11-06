import test from 'node:test'
import assert from 'node:assert/strict'
import { BRAIN_ROOT, createWorkforceRoster } from './workforceRoster.mjs'
import { assessDepartmentCapacity, workerExecutionBlock } from './departmentWorkflow.mjs'

const profiles = [
  ['AG-CEO-001', 'Steve', 'CEO/Agent Instructions.md'],
  ['AG-HR-001', 'Amaya', 'Departments/HR/HR Lead.md'],
  ['AG-HR-002', 'Noah', 'Departments/HR/HR Recruiter.md'],
  ['AG-HR-003', 'Iris', 'Departments/HR/HR Evaluator.md'],
  ['AG-RES-001', 'Nadia', 'Departments/Research/Nadia profile.md'],
  ['AG-SALES-001', 'Omar', 'Departments/Customer Acquisition/Omar profile.md'],
  ['AG-CS-001', 'Salma', 'Departments/Customer Success/Salma profile.md'],
  ['AG-SOC-001', 'Layla', 'Departments/Social/Layla profile.md'],
  ['AG-EMAIL-001', 'Youssef', 'Departments/Email/Youssef profile.md'],
  ['AG-DEV-001', 'Adam', 'Departments/Development/Adam profile.md'],
]
function fixture(change = () => {}) {
  const files = [], paths = new Map([['', BRAIN_ROOT]]), documents = new Map(), calls = []
  function add(path, text) {
    if (paths.has(path)) return paths.get(path)
    const at = path.lastIndexOf('/'), parent = at < 0 ? '' : path.slice(0, at)
    const parentId = parent ? add(parent) : BRAIN_ROOT
    const id = 'file_' + String(files.length + 1).padStart(8, '0')
    paths.set(path, id)
    files.push({ id, name: path.slice(at + 1), parents: [parentId], mimeType: text === undefined ? 'application/vnd.google-apps.folder' : 'text/markdown' })
    if (text !== undefined) documents.set(id, text)
    return id
  }
  const registry = add('Company/Agent Registry.md', profiles.map(([id, name, path]) => `| ${id} | ${name} — Role / Manager | [[${path.replace(/\.md$/, '')}|Canonical profile]] v1 | Configured; trial pending | Scoped | Evidence |`).join('\n'))
  const policy = add('Company/Workforce Operating Rules.md', [
    '| `T3_EXEC` | CEO | `gpt-6-astra`, effort `high` | alternative |',
    '| `T2_HEAD` | Heads | `gpt-6.1-sol`, effort `high` | alternative |',
    '| `T1_WORKER` | Workers | `gpt-6-luna`, effort `medium` | alternative |',
  ].join('\n'))
  for (const [id, , path] of profiles) {
    const skill = path.startsWith('CEO/') ? 'CEO/Skills/Company Evidence' : path.split('/').slice(0, 2).join('/') + '/Skills/assigned/SKILL'
    add(skill + '.md', '# Assigned original skill')
    add(path, `# Profile ${id}\n${path.startsWith('CEO/') ? '## Nine active procedures' : '## 5. Assigned skills'}\n- [[${skill}|Scoped skill]]\n## 6. Brain House Rules\nPrivate unrelated [[CEO/SOUL]] does not become an assigned skill.`)
  }
  change({ files, documents, registry, policy, paths, add })
  const roster = createWorkforceRoster({
    readBrain: async ({ brain_files }) => brain_files.map(({ id }) => ({ id, name: files.find(file => file.id === id).name, revision: '1', text: documents.get(id) })),
    rpc: async (name, args) => {
      calls.push({ name, args })
      return name === 'hq_worker_roster_sources' ? { rootId: BRAIN_ROOT, files } : { accepted: true, count: args.p_agents.length }
    },
  })
  return { roster, calls }
}

test('cloud registry binds all ten identities, current models, exact skills and lifecycle without inventing qualification', async () => {
  const { roster, calls } = fixture()
  assert.deepEqual(await roster.sync('worker-id'), { count: 10 })
  const agents = calls.at(-1).args.p_agents
  assert.equal(agents[0].name, 'Steve')
  assert.equal(agents[1].name, 'Amaya')
  assert.equal(agents[2].managerId, 'AG-HR-001')
  assert.equal(agents[3].managerId, 'AG-HR-001')
  assert.equal(agents[0].model, 'gpt-6-astra')
  assert.equal(agents[1].model, 'gpt-6.1-sol')
  assert.equal(agents[2].model, 'gpt-6-luna')
  assert.equal(agents[2].effort, 'medium')
  assert.equal(agents[1].modelTier, 'T2_HEAD')
  assert.equal(agents[2].modelTier, 'T1_WORKER')
  assert.equal(agents[4].modelTier, 'T2_HEAD')
  assert.equal(agents[4].departmentKey, 'research-market-intelligence')
  for (const agent of agents) {
    assert.equal(agent.lifecycle, 'Configured; trial pending')
    assert.equal(agent.skillFileIds.length, 1)
    assert.equal(agent.qualified, undefined)
  }
})

test('canonical pending T1 registry rows extend the roster only with explicit department, manager and model tier', async () => {
  const { roster, calls } = fixture(({ add, documents, registry }) => {
    const additions = [
      ['AG-SOC-002','Rania','Social','Layla','AG-SOC-001','social'],
      ['AG-RES-002','Karim','Research','Nadia','AG-RES-001','research'],
      ['AG-SALES-002','Hadi','Customer Acquisition','Omar','AG-SALES-001','acquisition'],
    ]
    let registryText = documents.get(registry)
    for (const [id,name,department,manager,managerId,skill] of additions) {
      const profilePath = `Departments/${department}/${name} profile`
      add(profilePath + '.md', `---\nemployee_id: ${id}\nreports_to: ${managerId}\n---\n# ${name} profile\n## 5. Exact assigned skill and original source\n- \`${profilePath.split('/').slice(0,2).join('/')}/Skills/${skill}/SKILL.md\``)
      add(`${profilePath.split('/').slice(0,2).join('/')}/Skills/${skill}/SKILL.md`, `# ${skill}`)
      registryText += `\n| ${id} | ${name} — ${skill} Worker / ${manager} ${managerId} (${department}) | [[${profilePath}|Canonical profile]] v1.0.0 | Configured; supervised trial pending | T1_WORKER policy only; runtime unverified | Evidence |`
    }
    documents.set(registry, registryText)
  })
  assert.deepEqual(await roster.sync('worker-id'), { count: 13 })
  const agents = calls.at(-1).args.p_agents
  for (const [id,managerId,departmentKey] of [
    ['AG-SOC-002','AG-SOC-001','social-community'],
    ['AG-RES-002','AG-RES-001','research-market-intelligence'],
    ['AG-SALES-002','AG-SALES-001','customer-acquisition-partnerships'],
  ]) {
    const employee = agents.find(agent => agent.id === id)
    assert.equal(employee.modelTier, 'T1_WORKER')
    assert.equal(employee.managerId, managerId)
    assert.equal(employee.departmentKey, departmentKey)
    assert.equal(employee.lifecycle, 'Configured; supervised trial pending')
    assert.equal(employee.qualified, undefined)
    assert.equal(employee.qualification, undefined)
  }
})

test('pilot heads cannot be mistaken for lower-tier department capacity', async () => {
  const { roster, calls } = fixture()
  await roster.sync('worker-id')
  const agents = calls.at(-1).args.p_agents
  for (const departmentKey of ['social-community','research-market-intelligence','customer-acquisition-partnerships','email-lifecycle']) {
    const decision = assessDepartmentCapacity(departmentKey, agents)
    assert.equal(decision.status, 'staffing-required')
    assert.equal(decision.reason, 'no-qualified-lower-tier-worker')
    assert.equal(decision.hrOwnerId, 'AG-HR-001')
  }
  assert.equal(workerExecutionBlock({ agent_id:'AG-SOC-001', context:{ mode:'task-work', agent:{ id:'AG-SOC-001' } } }), 'staffing-required')
})

test('lower-tier work needs a current HR qualification bound to exact assigned skills', async () => {
  const { roster, calls } = fixture()
  await roster.sync('worker-id')
  const agents = calls.at(-1).args.p_agents
  const worker = agents.find(agent => agent.id === 'AG-HR-002')
  const manager = agents.find(agent => agent.id === 'AG-HR-001')
  manager.lifecycle = 'Qualified'
  worker.lifecycle = 'Qualified'
  const qualification = { status:'qualified', scope:'bounded-drafting-v1', bindingDigest:'b'.repeat(64), evidenceId:'evidence_file_01', profileFileId:worker.profileFileId, skillFileIds:[...worker.skillFileIds], modelTier:'T1_WORKER', managerId:'AG-HR-001', departmentKey:'hr-agent-development' }
  manager.departmentKey = 'hr-agent-development'
  assert.deepEqual(assessDepartmentCapacity('hr-agent-development', [manager, worker], {'AG-HR-002':qualification}), {
    status:'ready', departmentKey:'hr-agent-development', headId:'AG-HR-001', workerIds:['AG-HR-002'],
  })
  assert.equal(assessDepartmentCapacity('hr-agent-development', [manager, worker], {
    'AG-HR-002':{...qualification, skillFileIds:['different-skill']},
  }).status, 'staffing-required')
})

test('duplicate canonical employee fails before any roster write', async () => {
  const { roster, calls } = fixture(({ documents, registry }) => documents.set(registry, documents.get(registry) + '\n' + documents.get(registry).split('\n')[0]))
  await assert.rejects(roster.sync('worker-id'), /invalid-roster-registry/)
  assert.equal(calls.length, 1)
})

test('another department skill cannot be smuggled through a profile', async () => {
  const { roster, calls } = fixture(({ documents, paths }) => {
    const id = paths.get('Departments/Research/Nadia profile.md')
    documents.set(id, documents.get(id).replace('Departments/Research/Skills/assigned/SKILL', 'CEO/Skills/Company Evidence'))
  })
  await assert.rejects(roster.sync('worker-id'), /skill-outside-assigned-department/)
  assert.equal(calls.length, 1)
})

test('current model policy is required rather than silently using a default', async () => {
  const { roster } = fixture(({ documents, policy }) => documents.set(policy, '# No model table'))
  await assert.rejects(roster.sync('worker-id'), /roster-model-policy-required/)
})

test('metadata ancestry cannot escape the Brain or contain cycles', async () => {
  const { roster } = fixture(({ files, paths }) => {
    const folder = files.find(file => file.id === paths.get('Departments'))
    folder.parents = [folder.id]
  })
  await assert.rejects(roster.sync('worker-id'), /roster-index-cycle/)
})

test('profile ID cannot be substituted by a different canonical file', async () => {
  const { roster } = fixture(({ documents, registry }) => documents.set(registry, documents.get(registry).replace('CEO/Agent Instructions|', 'Departments/HR/HR Lead|')))
  await assert.rejects(roster.sync('worker-id'), /canonical-profile-required/)
})

test('Markdown label skill assignment resolves exact file and preserves suspended lifecycle', async () => {
  const { roster, calls } = fixture(({ documents, registry, paths }) => {
    documents.set(registry, documents.get(registry).replace('Configured; trial pending', 'Suspended'))
    const path = 'Departments/HR/HR Lead.md', id = paths.get(path), skill = 'Departments/HR/Skills/assigned/SKILL.md'
    documents.set(id, `# AG-HR-001\n## 5. Assigned skills\n| Original | [${skill}](https://drive.google.com/file/d/${paths.get(skill)}/view) |\n## 6. Brain House Rules`)
  })
  await roster.sync('worker-id')
  assert.equal(calls.at(-1).args.p_agents[0].lifecycle, 'Suspended')
})
