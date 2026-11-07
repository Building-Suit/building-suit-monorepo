import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { brainReader } from './worker.mjs'
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
    '| `T1_WORKER` | Workers | `gpt-6.1-terra`, effort `medium` | alternative |',
  ].join('\n'))
  for (const [id, , path] of profiles) {
    const skill = path.startsWith('CEO/') ? 'CEO/Skills/Company Evidence' : path.split('/').slice(0, 2).join('/') + '/Skills/assigned/SKILL'
    add(skill + '.md', '# Assigned original skill')
    add(path, `# Profile ${id}\n${path.startsWith('CEO/') ? '## Nine active procedures' : '## 5. Assigned skills'}\n- [[${skill}|Scoped skill]]\n## 6. Brain House Rules\nPrivate unrelated [[CEO/SOUL]] does not become an assigned skill.`)
  }
  change({ files, documents, registry, policy, paths, add })
  const adapters = {
    readBrain: async ({ brain_files }) => brain_files.map(({ id }) => ({ id, name: files.find(file => file.id === id).name, revision: '1', text: documents.get(id) })),
    rpc: async (name, args) => {
      calls.push({ name, args })
      return name === 'hq_worker_roster_sources' ? { rootId: BRAIN_ROOT, files } : { accepted: true, count: args.p_agents.length }
    },
  }
  return { roster: createWorkforceRoster(adapters), calls, adapters, files, documents, paths }
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
  assert.equal(agents[2].model, 'gpt-6.1-terra')
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
  const savedModel = worker.model
  worker.model = 'gpt-6-luna'
  assert.equal(assessDepartmentCapacity('hr-agent-development', [manager, worker], {'AG-HR-002':qualification}).status, 'blocked')
  assert.equal(workerExecutionBlock({agent_id:'AG-HR-002',context:{mode:'task-work',agent:worker}}), 'worker-model-policy-unavailable')
  worker.model = savedModel
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

test('stale Luna worker policy blocks roster sync before any model execution', async () => {
  const { roster, calls } = fixture(({ documents, policy }) => documents.set(policy,
    documents.get(policy).replace('gpt-6.1-terra', 'gpt-6-luna')))
  await assert.rejects(roster.sync('worker-id'), /worker-model-policy-unavailable/)
  assert.equal(calls.length, 1)
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


function largeCanonicalRoster() {
  const profileIds = []
  const result = fixture(({ add, documents, registry, paths }) => {
    let registryText = documents.get(registry)
    for (const [index, name] of ['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta'].entries()) {
      const id = 'AG-DEV-' + String(index + 2).padStart(3, '0'), path = `Departments/Development/Hire ${name} profile`
      add(path + '.md', `---\nemployee_id: ${id}\nreports_to: AG-DEV-001\n---\n# Hire ${name}\n## 5. Assigned skills\n- [[Departments/Development/Skills/assigned/SKILL|Full assigned skill]]\n## 6. Brain House Rules`)
      registryText += `\n| ${id} | Hire ${name} — Drafting Worker / Adam AG-DEV-001 (Development) | [[${path}|Canonical profile]] v1 | Configured; trial pending | T1_WORKER policy only | Evidence |`
    }
    documents.set(registry, registryText)
    for (const [path, id] of paths) if (path.endsWith('profile.md') || profiles.some(([, , expected]) => expected === path)) {
      const text = documents.get(id)
      // Assigned-skill sections stay at the END of each complete long profile.
      documents.set(id, text.replace(/(?=## (?:5\.|Nine active procedures))/, 'Complete synthetic standing instructions.\n'.repeat(600)))
      profileIds.push(id)
    }
  })
  assert.equal(profileIds.length, 18)
  assert.ok(profileIds.reduce((sum, id) => sum + Buffer.byteLength(result.documents.get(id)), 0) > 250_000)
  assert.ok(profileIds.every(id => Buffer.byteLength(result.documents.get(id)) < 128_000))
  return { ...result, profileIds }
}

/** Compose the real bounded reader with a synthetic Drive; no network/Brain access. */
async function withRosterBrain(f, action) {
  const prior = globalThis.fetch
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const reader = brainReader({ brainRoot: BRAIN_ROOT, googleEmail: 'fixture@example.invalid',
    googleKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) })
  globalThis.fetch = async (input, options = {}) => {
    options.signal?.throwIfAborted()
    const url = new URL(String(input))
    if (url.href === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'synthetic-only-token', expires_in: 3600 })
    assert.equal(url.origin, 'https://www.googleapis.com')
    const id = url.pathname.split('/files/')[1]
    if (url.searchParams.get('alt') === 'media') {
      const text = f.documents.get(id); assert.equal(typeof text, 'string')
      return new Response(text, { headers: { 'content-length': String(Buffer.byteLength(text)) } })
    }
    const file = id === BRAIN_ROOT ? { id, name: 'Synthetic Brain', mimeType: 'application/vnd.google-apps.folder', parents: [] } : f.files.find(value => value.id === id)
    assert.ok(file)
    return Response.json({ ...file, trashed: false, version: '1', modifiedTime: '2026-11-01T00:00:00Z' })
  }
  try { return await action(reader) } finally { globalThis.fetch = prior }
}

test('complete eighteen-profile roster exceeds one context but syncs atomically through bounded real-reader calls', async () => {
  const f = largeCanonicalRoster(), signal = new AbortController().signal, requests = []
  await withRosterBrain(f, async reader => {
    await assert.rejects(() => reader({ brain_files: f.profileIds.map(id => ({ id })) }, signal), error => error.code === 'brain-context-too-large')
    const roster = createWorkforceRoster({ ...f.adapters, readBrain: (context, sharedSignal) => {
      assert.equal(sharedSignal, signal); requests.push(context.brain_files.map(file => file.id))
      return reader(context, sharedSignal)
    } })
    assert.deepEqual(await roster.sync('synthetic-worker', signal), { count: 18 })
    assert.equal(requests.length, 19); assert.equal(requests[0].length, 2)
    assert.ok(requests.slice(1).every(ids => ids.length === 1))
    assert.deepEqual(requests.slice(1).flat(), f.profileIds)
    const writes = f.calls.filter(call => call.name === 'hq_worker_sync_roster')
    assert.equal(writes.length, 1); assert.equal(writes[0].args.p_agents.length, 18)
    assert.deepEqual(new Set(writes[0].args.p_agents.map(agent => agent.profileFileId)), new Set(f.profileIds))
    assert.ok(writes[0].args.p_agents.every(agent => agent.skillFileIds.length === 1 && agent.modelTier))
    assert.ok(writes[0].args.p_agents.every(agent => agent.lifecycle === 'Configured; trial pending'))
  })
})

test('one oversized profile still fails the real 128000-byte reader before any roster sync', async () => {
  const f = largeCanonicalRoster(), last = f.profileIds.at(-1)
  f.documents.set(last, f.documents.get(last).padEnd(128_001, 'x'))
  await withRosterBrain(f, async reader => {
    const roster = createWorkforceRoster({ ...f.adapters, readBrain: reader })
    await assert.rejects(() => roster.sync('synthetic-worker', new AbortController().signal), error => error.code === 'brain-source-too-large')
    assert.equal(f.calls.filter(call => call.name === 'hq_worker_sync_roster').length, 0)
  })
})

test('shared roster cancellation after profile reads never commits the assembled roster', async () => {
  const f = largeCanonicalRoster(), controller = new AbortController()
  await withRosterBrain(f, async reader => {
    const roster = createWorkforceRoster({ ...f.adapters, readBrain: async (context, signal) => {
      assert.equal(signal, controller.signal)
      const result = await reader(context, signal)
      if (context.brain_files.some(file => file.id === f.profileIds.at(-1))) controller.abort(Error('synthetic-roster-stop'))
      return result
    } })
    await assert.rejects(() => roster.sync('synthetic-worker', controller.signal), /synthetic-roster-stop/)
    assert.equal(f.calls.filter(call => call.name === 'hq_worker_sync_roster').length, 0)
  })
})

const developmentProfile = 'Departments/Development/Adam profile.md'
const developmentSkill = 'Departments/Development/Skills/assigned/SKILL'
const governanceSkill = 'Departments/HR/Skills/assigned/SKILL'
function assignmentProfile(body) { return `# AG-DEV-001\n## 5. Assigned skills\n${body}\n## 6. Brain House Rules` }

test('explicit non-assignment governance paragraphs do not add another department skill', async () => {
  for (const paragraph of [
    `Governance references: [[${governanceSkill}|Supervision policy]]. These govern HR and supervision; they are not additional worker skill assignments.`,
    `Governance, not additional assigned worker skills: [[${governanceSkill}|Supervision policy]].`,
  ]) {
    const f = fixture(({ documents, paths }) => documents.set(paths.get(developmentProfile), assignmentProfile(`- [[${developmentSkill}|Assigned skill]]\n\n${paragraph}`)))
    await f.roster.sync('synthetic-worker')
    assert.deepEqual(f.calls.at(-1).args.p_agents.find(agent => agent.id === 'AG-DEV-001').skillFileIds, [f.paths.get(developmentSkill + '.md')])
  }
})

test('unmarked or mixed governance paragraphs cannot hide real assignment references', async () => {
  for (const paragraph of [
    `Governance references: [[${governanceSkill}|Another department skill]].`,
    `Governance, not additional assigned worker skills: [[${governanceSkill}|Supervision policy]].\n2. **SK-DEV-101 — actual assignment**, [[${developmentSkill}|Assigned skill]]`,
  ]) {
    const f = fixture(({ documents, paths }) => documents.set(paths.get(developmentProfile), assignmentProfile(`- [[${developmentSkill}|Assigned skill]]\n\n${paragraph}`)))
    await assert.rejects(() => f.roster.sync('synthetic-worker'), /skill-outside-assigned-department/)
    assert.equal(f.calls.length, 1)
  }
})

test('numbered SK assignments retain a generic-label canonical Drive source and deduplicate exact IDs', async () => {
  const f = fixture(({ add, documents, paths }) => {
    const second = add('Departments/Development/Skills/second/SKILL.md', '# Synthetic second skill')
    const prose = add('Departments/Development/Skills/prose-reference/SKILL.md', '# Not assigned')
    const hr = paths.get(governanceSkill + '.md')
    documents.set(paths.get(developmentProfile), assignmentProfile([
      `1. **SK-DEV-101 v1.0.0 — first-workflow**, [[${developmentSkill}|Canonical first skill]].`,
      `2. **SK-DEV-102 v1.0.0 — second-workflow**, [existing canonical source](https://drive.google.com/file/d/${second}/view).`,
      `3. **SK-DEV-102 — same assignment**, [source alias](https://drive.google.com/file/d/${second}/view).`,
      `\nArbitrary prose: [source](https://drive.google.com/file/d/${prose}/view).`,
      `\n4. **License reference**, [license](https://drive.google.com/file/d/${hr}/view).`,
    ].join('\n')))
  })
  await f.roster.sync('synthetic-worker')
  assert.deepEqual(f.calls.at(-1).args.p_agents.find(agent => agent.id === 'AG-DEV-001').skillFileIds,
    [f.paths.get(developmentSkill + '.md'), f.paths.get('Departments/Development/Skills/second/SKILL.md')])
})

test('explicit Drive assignments reject unknown, folder, foreign, non-skill and conflicting identities', async () => {
  for (const kind of ['unknown', 'folder', 'foreign', 'non-skill', 'conflict']) {
    const f = fixture(({ add, documents, paths }) => {
      const second = add('Departments/Development/Skills/second/SKILL.md', '# Synthetic second skill')
      const id = { unknown: 'synthetic_missing_source', folder: paths.get('Departments/Development/Skills'),
        foreign: paths.get(governanceSkill + '.md'), 'non-skill': paths.get(developmentProfile), conflict: second }[kind]
      const label = kind === 'conflict' ? developmentSkill + '.md' : 'existing canonical source'
      documents.set(paths.get(developmentProfile), assignmentProfile(
        `1. **SK-DEV-101 — first**, [[${developmentSkill}|First]].\n2. **SK-DEV-102 — second**, [${label}](https://drive.google.com/file/d/${id}/view).`))
    })
    await assert.rejects(() => f.roster.sync('synthetic-worker'), /roster-file-missing|skill-outside-assigned-department|assigned-skill-reference-mismatch/)
    assert.equal(f.calls.length, 1)
  }
})

test('numbered Drive skill assignments retain the existing ten-skill ceiling', async () => {
  for (const total of [10, 11]) {
    const f = fixture(({ add, documents, paths }) => {
      const rows = [`1. **SK-DEV-101 — first**, [[${developmentSkill}|First]].`]
      for (let at = 2; at <= total; at++) {
        const id = add(`Departments/Development/Skills/synthetic-${at}/SKILL.md`, '# Synthetic skill')
        rows.push(`${at}. **SK-DEV-${String(100 + at)} — assigned workflow**, [source](https://drive.google.com/file/d/${id}/view).`)
      }
      documents.set(paths.get(developmentProfile), assignmentProfile(rows.join('\n')))
    })
    if (total === 10) {
      await f.roster.sync('synthetic-worker')
      assert.equal(f.calls.at(-1).args.p_agents.find(agent => agent.id === 'AG-DEV-001').skillFileIds.length, 10)
    } else {
      await assert.rejects(() => f.roster.sync('synthetic-worker'), /assigned-skills-required/)
      assert.equal(f.calls.length, 1)
    }
  }
})
