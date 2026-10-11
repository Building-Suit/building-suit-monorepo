import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { maskReason, normalizeRemoteAudit } from '../../app/utils/activity.ts'
const id = '11111111-1111-4111-8111-111111111111'
test('allowlisted projection discards snapshots, tokens, contacts and arbitrary actor/target text', () => {
  const secret = 'synthetic-secret@example.invalid'
  const projection = normalizeRemoteAudit({ items: [{ id, actorUserId: secret, targetId: secret, action: 'billing.review', reason: secret, occurredAt: '2026-01-01T00:00:00Z', before: { token: secret }, after: { payment: secret }, secretReferenceId: secret, headers: secret, result: secret }], total: 1, page: 1, pageSize: 25 }, 'billing', 1, 25)
  assert.equal(JSON.stringify(projection).includes(secret), false)
  assert.deepEqual(projection.items[0], { id, actor: null, action: 'billing.review', target: null, reason: '[redacted]', occurredAt: '2026-01-01T00:00:00.000Z' })
  for (const reason of ['Bearer a.b.c', 'phone 0123456789', 'ordinary operator reason']) assert.equal(maskReason(reason), '[redacted]')
  assert.equal(maskReason(null), ''); assert.equal(maskReason('  '), '')
})
test('malformed identifiers/actions/times fail without returning payload details', () => {
  for (const row of [{ id: 'secret' }, { id, action: 'Bearer secret' }, { id, action: 'billing.review', occurredAt: 'secret' }]) assert.throws(() => normalizeRemoteAudit({ items: [row], total: 1, page: 1, pageSize: 25 }, 'billing', 1, 25), { message: 'remote_projection_invalid' })
})
test('browser projection is read-only and excludes raw evidence; RPCs require database authority', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261009150000_normalized_activity.sql', import.meta.url), 'utf8')
  const read = sql.slice(sql.indexOf('create function public.super_admin_activity_read'), sql.indexOf('revoke all on function public.super_admin_adapter_complete', sql.indexOf('create function public.super_admin_activity_read')))
  for (const name of ['before_state', 'after_state', 'safe_parameters', 'decrypted_secrets', 'secret_reference_id']) assert.equal(read.includes(name), false)
  assert.match(read, /assert_platform_owner/); assert.match(sql, /from public,anon,authenticated,service_role/)
  const page = readFileSync(new URL('../../app/pages/index.vue', import.meta.url), 'utf8')
  assert.match(page, /:capabilities="\{\}"/)
})
