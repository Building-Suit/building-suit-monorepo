import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildAccountTree, flattenAccountTree } from '../../app/utils/accountTree.ts'

const account = (id, value = '0', overrides = {}) => ({ account_id: id, organization_id: 'org', name: id, code: id, type: 'asset', subtype: 'bank', parent_account_id: null, account_role: 'posting', statement_balance_minor: value, ...overrides })
const build = rows => buildAccountTree(rows, key => key)
const flatten = nodes => flattenAccountTree(nodes, new Set())

test('empty chart keeps every main and section heading including current and fixed assets', () => {
  const rows = flatten(build([]))
  assert.deepEqual(rows.filter(row => row.kind === 'type').map(row => row.type), ['asset', 'liability', 'equity', 'revenue', 'expense'])
  for (const key of ['currentAssets', 'fixedAssets', 'otherAssets']) assert.ok(rows.find(row => row.id === `section:${key}`))
  assert.ok(rows.every(row => row.total === '0' && row.count === 0))
})
test('real parent hierarchy overrides subtype grouping; direct postings and contra are counted exactly once', () => {
  const roots = build([account('parent', '9007199254740993'), account('child', '100', { parent_account_id: 'parent', subtype: 'equipment' }), account('contra', '-25', { parent_account_id: 'child' })])
  const rows = flatten(roots)
  assert.equal(roots[0].total, '9007199254741068')
  assert.equal(rows.find(row => row.id === 'parent').total, roots[0].total)
  assert.equal(rows.find(row => row.id === 'child').depth, 3)
  assert.equal(rows.find(row => row.id === 'contra').depth, 4)
  assert.equal(rows.filter(row => row.kind === 'account').length, 3)
  assert.equal(rows.find(row => row.id === 'section:fixedAssets').count, 0)
})
test('search reveals all ancestors even when collapsed, and group search includes descendants', () => {
  const roots = build([account('parent'), account('child', '10', { parent_account_id: 'parent', code: 'CH-01' }), account('other', '20')])
  const hidden = new Set(['type:asset', 'parent'])
  assert.ok(!flattenAccountTree(roots, hidden).some(row => row.id === 'child'))
  const found = flattenAccountTree(roots, hidden, 'ch-01')
  assert.deepEqual(found.map(row => row.id), ['type:asset', 'section:currentAssets', 'parent', 'child'])
  assert.equal(found[0].total, '30') // Search never changes group balances.
  assert.deepEqual(flattenAccountTree(roots, hidden, 'parent').filter(row => row.account).map(row => row.id), ['parent', 'child'])
})
test('missing parents and legacy cycles retain every account without duplicating totals', () => {
  const roots = build([account('a', '1', { parent_account_id: 'b' }), account('b', '2', { parent_account_id: 'a' }), account('orphan', '4', { parent_account_id: 'missing' })])
  assert.equal(roots[0].total, '7')
  assert.equal(flatten(roots).filter(row => row.account).length, 3)
})
test('loans are grouped as financing without inferring maturity; unknown subtypes remain visible', () => {
  const rows = flatten(build([account('loan', '100', { type: 'liability', subtype: 'loan' }), account('legacy', '5', { subtype: 'legacy_asset' })]))
  assert.equal(rows.find(row => row.id === 'section:financing').count, 1)
  assert.equal(rows.find(row => row.id === 'section:otherAssets').count, 1)
})
