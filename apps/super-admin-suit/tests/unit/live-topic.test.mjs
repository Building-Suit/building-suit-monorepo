import test from 'node:test'
import assert from 'node:assert/strict'
import { readLiveTopic } from '../../server/utils/live-topic.ts'
const session = { userId: '11111111-1111-4111-8111-111111111111', authorityEnvironmentId: '22222222-2222-4222-8222-222222222222', role: 'owner' }
const topic = `sas:${session.authorityEnvironmentId}:${session.userId}:33333333-3333-4333-8333-333333333333`
test('uses server RPC topic and never accepts another operator/environment or malformed session', async () => {
  const client = data => ({ async rpc(name) { assert.equal(name, 'super_admin_live_topic'); return { data, error: null } } })
  assert.equal(await readLiveTopic(client(topic), session), topic)
  for (const data of [null, 'sas:foreign', topic.replace(session.userId, session.authorityEnvironmentId), `${topic}/evil`, topic.replace('33333333-3333-4333-8333-333333333333', 'missing')]) {
    await assert.rejects(readLiveTopic(client(data), session), error => error.statusCode === 503)
  }
})
test('revocation denies the live projection and operational failures do not downgrade authorization', async () => {
  for (const [code, status] of [['42501', 403], ['XX000', 503]]) await assert.rejects(readLiveTopic({ rpc: async () => ({ data: topic, error: { code } }) }, session), error => error.statusCode === status)
})
