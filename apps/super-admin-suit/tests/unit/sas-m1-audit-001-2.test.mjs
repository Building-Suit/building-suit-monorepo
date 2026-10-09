import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parseActivityQuery, normalizeRemoteAudit } from '../../app/utils/activity.ts'
import { retrieveAuditPage } from '../../server/utils/activity.ts'
const id = '11111111-1111-4111-8111-111111111111'
test('bounded server query accepts exact filters/time/sort and rejects invalid scans', () => {
  const filters = { page: '2', pageSize: '10', order: 'asc', suit: 'synthetic-suit', environment: id, action: 'billing.review', actor: id, target: id, requestId: id, correlationId: id, from: '2026-01-01T00:00:00Z', to: '2026-10-01T00:00:00Z' }
  assert.deepEqual(parseActivityQuery(filters), { ...filters, page: 2, pageSize: 10 })
  for (const value of [{ page: 0 }, { page: 10001 }, { pageSize: 101 }, { page: 1.2 }, { order: 'random' }, { actor: [] }, { from: 'bad' }, { from: '2026-10-01', to: '2026-01-01' }, { endpoint: 'injected' }]) assert.throws(() => parseActivityQuery(value))
  const sql = readFileSync(new URL('../../supabase/migrations/20261009150000_normalized_activity.sql', import.meta.url), 'utf8')
  for (const key of ['suit', 'environment', 'action', 'actor', 'target', 'from', 'to', 'requestId', 'correlationId']) assert.ok(sql.includes(`p_query->>'${key}'`))
  assert.match(sql, /limit size_value offset \(page_value-1\)\*size_value/)
})
test('remote pagination validates metadata and duplicates', () => {
  const row = { id, action: 'billing.review', occurredAt: '2026-01-01T00:00:00Z' }
  assert.equal(normalizeRemoteAudit({ items: [row], total: 26, page: 2, pageSize: 25 }, 'billing', 2, 25).page, 2)
  for (const data of [{ items: [row, row], total: 2, page: 2, pageSize: 25 }, { items: [], total: -1, page: 2, pageSize: 25 }, { items: [], total: 0, page: 1, pageSize: 25 }]) assert.throws(() => normalizeRemoteAudit(data, 'billing', 2, 25))
})
for (const failure of ['transport', 'projection', 'save']) test(`remote ${failure} failure does not advance cursor or claim completeness`, async () => {
  let input, saves = 0, failures = 0
  const result = await retrieveAuditPage(id, 'billing', 'authority', {
    context: async () => ({ page: 3, pageSize: 25 }), save: async () => { if (failure === 'save') throw Error('database unavailable'); saves++ }, failed: async () => { failures++ },
  }, {
    enqueue: async value => { input = value; return 'dispatch' },
    claim: async () => ({ attemptId: 'attempt', configuration: { bindingId: id, authorityEnvironmentId: 'authority', targetEnvironmentId: 'target', operation: 'shop.billing.query', version: '1.0', enabled: true, manifestExpiresAt: new Date(Date.now()+60000).toISOString(), secretReferenceId: 'private' }, body: JSON.stringify({ ...input, sourceBindingId: 'authority', targetEnvironmentId: 'target', actor: { authorityBindingId: 'authority' } }) }),
    complete: async () => failure === 'transport' ? { code: 'outcome_unknown' } : { data: failure === 'projection' ? {} : { items: [], total: 0, page: 3, pageSize: 25 } },
  }, async () => { if (failure === 'transport') throw Error('secret'); return { status: 200 } })
  assert.deepEqual(result, { status: 'unavailable', coverage: 'partial' }); assert.equal(failures, 1); assert.equal(saves, 0)
  assert.deepEqual(input.payload, { resource: 'audit', page: 3, pageSize: 25 })
})
test('verified page persists safe projection and reports partial coverage', async () => {
  let input, saved
  const result = await retrieveAuditPage(id, 'plan', 'authority', { context: async () => ({ page: 1, pageSize: 25 }), save: async (...args) => { saved = args }, failed: async () => assert.fail('unexpected failure') }, {
    enqueue: async value => { input = value; return 'dispatch' }, claim: async () => ({ attemptId: 'attempt', configuration: { bindingId: id, authorityEnvironmentId: 'authority', targetEnvironmentId: 'target', operation: 'shop.plan.query', version: '1.0', enabled: true, manifestExpiresAt: new Date(Date.now()+60000).toISOString(), secretReferenceId: 'private' }, body: JSON.stringify({ ...input, sourceBindingId: 'authority', targetEnvironmentId: 'target', actor: { authorityBindingId: 'authority' } }) }), complete: async () => ({ data: { items: [], total: 0, page: 1, pageSize: 25 } }),
  }, async () => ({ status: 200 }))
  assert.deepEqual(result, { status: 'observed', coverage: 'partial' }); assert.equal(saved[2], input.requestId); assert.equal(saved[1].stream, 'plan')
})
