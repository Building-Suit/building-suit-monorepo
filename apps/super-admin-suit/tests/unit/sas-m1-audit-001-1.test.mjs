import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { invokeShopAdapter } from '../../server/utils/shop-adapter.ts'
const sql = readFileSync(new URL('../../supabase/migrations/20261009150000_normalized_activity.sql', import.meta.url), 'utf8')
for (const outcome of ['success', 'target_rejected']) test(`billing ${outcome} retains the dispatch request and correlation identities`, async () => {
  const input = { bindingId: 'binding', operation: 'shop.billing.command', requestId: 'request', correlationId: 'correlation', reason: 'Reviewed rejection or approval', payload: { action: 'review', submissionId: 'submission' } }
  let stored
  const attempt = { attemptId: 'attempt', configuration: { bindingId: input.bindingId, authorityEnvironmentId: 'authority', targetEnvironmentId: 'target', operation: input.operation, version: '1.0', enabled: true, manifestExpiresAt: new Date(Date.now() + 60000).toISOString(), secretReferenceId: 'server-only' }, body: JSON.stringify({ ...input, sourceBindingId: 'authority', targetEnvironmentId: 'target', actor: { authorityBindingId: 'authority' } }) }
  const database = { enqueue: async value => { stored = structuredClone(value); return 'dispatch' }, claim: async () => attempt, complete: async () => outcome === 'success' ? { data: { auditId: 'domain-audit' }, targetAuditId: 'bridge-audit' } : { code: 'target_rejected' } }
  if (outcome === 'success') {
    const result = await invokeShopAdapter(input, 'authority', database, async () => ({ status: 200 }))
    assert.equal(result.targetAuditId, 'bridge-audit'); assert.equal(result.data.auditId, 'domain-audit')
    assert.equal(result.requestId, input.requestId); assert.equal(result.correlationId, input.correlationId)
  } else await assert.rejects(invokeShopAdapter(input, 'authority', database, async () => ({ status: 409 })), { code: 'target_rejected' })
  assert.equal(stored.requestId, 'request'); assert.equal(stored.correlationId, 'correlation')
})
test('migration only correlates verified outcomes and joins bridge/domain IDs within the binding', () => {
  assert.match(sql, /outcome_value in \('success','target_rejected'\)/)
  assert.match(sql, /outcome_value='success' and verified_value#>>'\{data,auditId\}'/)
  assert.match(sql, /c\.domain_audit_id=e\.event_id or \(e\.stream='platform' and c\.target_audit_id=e\.event_id\)/)
  assert.match(sql, /linked\.binding_id=e\.binding_id/)
  assert.match(sql, /d\.request_id,d\.correlation_id/)
  assert.match(sql, /activity_correlations.*?reject_mutation/s)
})
