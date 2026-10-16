import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const read = path => readFileSync(`${root}${path}`, 'utf8')
const base = 'docs/work-packages/doctor-suit/'
const contract = JSON.parse(read(`${base}website-contract-v0.2.json`))
const markdown = read(`${base}website-contract-v0.2.md`)
const plan = JSON.parse(read(`${base}planning-v0.4/DOS-M1.json`))
const registry = JSON.parse(read('docs/shared/atomic-template-route-inventory.json'))

test('DOS-M1-001-C01: confirmed synthetic scope retains live domain decisions', () => {
  assert.deepEqual(contract.scope.M1, ['public preview', 'doctor administrative portal', 'secretary administrative portal'])
  assert.equal(contract.scope.data, 'synthetic-only')
  assert.deepEqual(contract.authorization.milestones, ['DOS-M1', 'DOS-M2', 'DOS-M3'])
  assert.equal(plan.decisions.find(row => row.decision_id === 'DOS-M1-D001').status, 'approved')
  for (const id of contract.open_decisions) {
    const milestone = id.slice(0, 6)
    const source = JSON.parse(read(`${base}planning-v0.4/${milestone}.json`))
    assert.equal(source.decisions.find(row => row.decision_id === id)?.status, 'open', id)
    assert.ok(markdown.includes(`\`${id}\``), id)
  }
  assert.ok(contract.scope.excluded.includes('real patient data'))
  assert.ok(contract.scope.excluded.includes('clinical prescribing in M1'))
})

test('DOS-M1-001-C02: doctor ownership and independent secretary journeys', () => {
  assert.deepEqual(contract.ownership, {
    owner: 'doctor', practice_spans_locations: true, location_owns_chart: false,
    matching_contacts_merge_identity: false,
    secretary_memberships: 'independent per practice; explicit location and capability grants',
  })
  const doctor = contract.journeys.find(row => row.id === 'doctor-alone')
  assert.deepEqual(doctor.actors, ['doctor-a'])
  assert.equal(doctor.locations.length, 2)
  for (const step of ['onboard-idempotently', 'book', 'check-in', 'review-queue', 'review-profile']) assert.ok(doctor.steps.includes(step))
  const secretary = contract.journeys.find(row => row.id === 'shared-secretary')
  assert.deepEqual(secretary.practice_owner, ['doctor-a', 'doctor-b'])
  for (const step of ['accept-recipient-bound-invitation-a', 'accept-recipient-bound-invitation-b', 'deny-other-practice', 'revoke-and-deny-next-request']) assert.ok(secretary.steps.includes(step))
  for (const journey of contract.journeys) for (const id of journey.acceptance) assert.ok(plan.tasks.some(row => row.task_id === id), id)
})

test('DOS-M1-001-C03: every planned route resolves to template, permission and task', () => {
  assert.equal(new Set(contract.routes.map(row => row.path)).size, contract.routes.length)
  assert.equal(new Set(contract.permissions.map(row => row.capability)).size, contract.permissions.length)
  const permissions = new Map(contract.permissions.map(row => [row.capability, row]))
  for (const row of contract.routes) {
    assert.ok(existsSync(`${root}${registry.registeredTemplates[row.template]}`), row.template)
    assert.ok(permissions.has(row.capability), row.capability)
    assert.equal(permissions.get(row.capability).enforcement, 'server')
    assert.ok(plan.tasks.some(task => task.task_id === row.task), row.task)
    assert.equal(row.status, 'planned')
    assert.ok(markdown.includes(`| \`${row.path}\` | ${row.audience} | ${row.template} | \`${row.capability}\` | ${row.task} |`), row.path)
  }
  assert.deepEqual(contract.acceptance.map(row => row.task_id), plan.tasks.map(row => row.task_id))
  assert.ok(contract.acceptance.every(row => row.status === 'pending'))
  for (const name of ['members.manage', 'audit.read', 'clinical.sign', 'prescriptions.sign']) assert.equal(permissions.get(name).secretary, 'deny')
  assert.equal(contract.synthetic_policy.external_delivery, false)
  assert.equal(contract.synthetic_policy.backend, 'loopback disposable Doctor instance only')
})

test('DOS-M1-001-C04: routing and history gaps remain explicit without invented activation', () => {
  assert.equal(contract.source_commit, '4ca7110f4d6efa828e0b41213e5c059bf02ba9db')
  assert.equal(contract.authorization.execution, 'direct GitHub implementation; no Automation activation')
  assert.equal(contract.authorization.automation_registration, 'unverified; inactive per parent; not required for direct implementation')
  assert.equal(contract.historical_reconciliation.policy, 'preserve all recovered IDs; absence is not proof of no historical implementation')
  assert.ok(markdown.includes('no compatibility or admission success is claimed'))
  assert.ok(markdown.includes('Exact-candidate independent CI receipts and release checks remain required'))
})
