import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { sourceHead, validateAdministrativeScope } from '../helpers/administrative-scope.mjs'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const scope = JSON.parse(readFileSync(`${root}docs/work-packages/doctor-suit/early-administrative-edition/scope.v1.json`, 'utf8'))
const sources = new Map(Array.from({ length: 9 }, (_, index) => {
  const id = `DOS-M${index + 1}`
  const path = `docs/work-packages/doctor-suit/planning-v0.4/${id}.json`
  const pinned = execFileSync('git', ['show', `${sourceHead}:${path}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 })
  assert.deepEqual(readFileSync(`${root}${path}`), pinned, `${id} must remain byte-identical to the pinned authority`)
  return [id, pinned]
}))
const copy = () => structuredClone(scope)

test('DOS-AE-001: new edition has valid source coverage, independent dependency graph and no launch approval', () => {
  assert.deepEqual(validateAdministrativeScope(scope, sources), [])
  assert.equal(scope.tasks.reduce((sum, task) => sum + task.acceptance.length, 0), 46)
})
test('scope validation rejects changed original plan bytes', () => {
  const changed = new Map(sources)
  changed.set('DOS-M6', Buffer.from(`${sources.get('DOS-M6')}\n`))
  assert.ok(validateAdministrativeScope(scope, changed).includes('source-drift:DOS-M6'))
})
test('the edition cannot pretend to complete original milestones or activate Automation', () => {
  for (const field of ['originalPlansRemainUncompletedByThisEdition', 'automationImportOrActivationAuthorized']) {
    const value = copy(); value.authority[field] = !value.authority[field]
    assert.ok(validateAdministrativeScope(value, sources).includes('authority'))
  }
})
test('all excluded clinical, document, notes, messaging and collection capabilities remain excluded', () => {
  for (const excluded of scope.excluded) {
    const value = copy(); value.excluded = value.excluded.filter(item => item !== excluded)
    assert.ok(validateAdministrativeScope(value, sources).includes('edition-exclusions'))
  }
})
test('missing commercial approval cannot be replaced by an invented offer or trial', () => {
  const value = copy(); value.commercialTerms = { trialDays: 7, currency: 'EGP', price: 100 }
  assert.ok(validateAdministrativeScope(value, sources).includes('invented-commercial-terms'))
})
test('old dependencies cannot be silently treated as new edition completion', () => {
  const value = copy(); value.tasks[0].dependsOn = ['DOS-M3-010']
  assert.ok(validateAdministrativeScope(value, sources).includes('dependency:DOS-AE-001'))
  value.tasks[0].dependsOn = ['DOS-AE-011']
  assert.ok(validateAdministrativeScope(value, sources).some(error => error.startsWith('cycle:')))
})
test('source task and requirement references must resolve to canonical plans', () => {
  const value = copy(); value.tasks[2].sourceTaskIds.push('DOS-M6-999')
  assert.ok(validateAdministrativeScope(value, sources).includes('source-reference:DOS-AE-003'))
})
test('every pending operator gate is necessary for live activation', () => {
  for (const decision of scope.decisions.slice(1)) {
    const value = copy(); value.liveActivationRequires = value.liveActivationRequires.filter(id => id !== decision.decisionId)
    assert.ok(validateAdministrativeScope(value, sources).includes('live-gate-coverage'))
    const approved = copy(); approved.decisions.find(row => row.decisionId === decision.decisionId).status = 'approved'
    assert.ok(validateAdministrativeScope(approved, sources).includes('unapproved-domain-gate'))
  }
})
