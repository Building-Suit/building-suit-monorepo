import test from 'node:test'
import assert from 'node:assert/strict'
import { createScopedRealtime } from '../../data-access/src/index.ts'

const scope = { environment: 'staging', portal: 'test-suit', userId: 'u', tenantId: 't', sessionId: 's', locationId: 'l', contextKey: 'records' }
const filter = { schema: 'public', table: 'records', event: '*', filter: 'tenant_id=eq.t' }
function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const channels = [], removed = [], refreshes = [], errors = []
  const client = {
    channel(name) {
      const channel = { name, listeners: [], on(type, filter, callback) { this.listeners.push({ type, filter, callback }); return this },
        subscribe(callback) { this.status = callback; return this }, emit() { this.listeners.forEach(l => l.callback()) } }
      channels.push(channel)
      return channel
    },
    async removeChannel(channel) { removed.push(channel); return 'ok' },
  }
  const controller = createScopedRealtime(client, { refreshIntervalMs: 100 })
  const binding = (changes = {}) => ({ scope: { ...scope }, filters: [{ ...filter }], dataKeys: ['records', 'records'],
    refresh: request => { refreshes.push(request) }, onError: kind => errors.push(kind), ...changes })
  const tick = async () => { t.mock.timers.tick(100); await Promise.resolve(); await Promise.resolve() }
  return { client, controller, channels, removed, refreshes, errors, binding, tick }
}

test('explicit filters, duplicate updates and listener deduplication, logout and disposal', async t => {
  const f = fixture(t)
  await f.controller.update(f.binding({ filters: [filter, { ...filter }] }))
  await f.controller.update(f.binding({ filters: [filter, { ...filter }] }))
  assert.equal(f.channels.length, 1)
  assert.deepEqual(f.channels[0].listeners.map(l => [l.type, l.filter]), [['postgres_changes', filter]])
  f.channels[0].emit()
  await f.tick()
  assert.deepEqual(f.refreshes[0].dataKeys, ['records'])
  await f.controller.update(null)
  f.channels[0].emit()
  f.channels[0].status('SUBSCRIBED')
  await f.tick()
  assert.equal(f.refreshes.length, 1)
  assert.equal(f.refreshes[0].signal.aborted, true)
  assert.equal(f.refreshes[0].isCurrent(), false)
  assert.equal(f.removed.length, 1)
  await f.controller.dispose()
  await f.controller.dispose()
  await assert.rejects(f.controller.update(f.binding()), /disposed/)
})

test('every scope boundary replaces the channel; old events/statuses cannot refresh', async t => {
  const f = fixture(t)
  let current = { ...scope }
  await f.controller.update(f.binding({ scope: current }))
  for (const field of Object.keys(scope)) {
    const old = f.channels.at(-1)
    old.emit() // cancel pending refresh on the switch
    current = { ...current, [field]: `${field}-other` }
    await f.controller.update(f.binding({ scope: current }))
    old.emit()
    old.status('SUBSCRIBED')
    old.status('CHANNEL_ERROR')
    await f.tick()
    assert.equal(f.refreshes.length, 0)
  }
  assert.equal(f.removed.length, Object.keys(scope).length)
  assert.deepEqual(f.errors, [])
  await f.controller.dispose()
})

test('disposal removes a partially initialized channel and suppresses its callbacks', async t => {
  const f = fixture(t)
  const factory = f.client.channel
  f.client.channel = name => {
    const channel = factory(name)
    channel.subscribe = callback => { callback('SUBSCRIBED'); throw new Error('partial setup') }
    return channel
  }
  await assert.rejects(f.controller.update(f.binding()), /partial setup/)
  f.channels[0].emit()
  await f.tick()
  assert.equal(f.refreshes.length, 0)
  await f.controller.dispose()
  assert.equal(f.removed.length, 1)
})

test('rapid updates await removal and subscribe only to the latest snapshot', async t => {
  const f = fixture(t)
  await f.controller.update(f.binding())
  let release
  f.client.removeChannel = channel => { f.removed.push(channel); return new Promise(resolve => { release = resolve }) }
  const a = f.controller.update(f.binding({ scope: { ...scope, tenantId: 'a' } }))
  await Promise.resolve(); await Promise.resolve()
  const b = f.controller.update(f.binding({ scope: { ...scope, tenantId: 'b' } }))
  const input = f.binding({ scope: { ...scope, tenantId: 'c' } })
  const c = f.controller.update(input)
  input.scope.tenantId = 'mutated'
  assert.equal(f.channels.length, 1)
  release('ok')
  await Promise.all([a, b, c])
  assert.equal(f.channels.length, 2)
  f.channels[1].emit()
  await f.tick()
  assert.equal(f.refreshes[0].scope.tenantId, 'c')
  f.client.removeChannel = async () => 'ok'
  await f.controller.dispose()
})

test('event/reconnect storms coalesce, refreshes serialize and stale async work is aborted', async t => {
  const f = fixture(t)
  let release
  const requests = []
  await f.controller.update(f.binding({ refresh: request => { requests.push(request); return new Promise(resolve => { release = resolve }) } }))
  const channel = f.channels[0]
  for (let i = 0; i < 100; i++) { channel.status('CHANNEL_ERROR'); channel.status('SUBSCRIBED'); channel.emit() }
  await f.tick()
  assert.equal(requests.length, 1)
  assert.deepEqual(f.errors, ['subscription'])
  for (let i = 0; i < 100; i++) channel.emit()
  await f.tick()
  assert.equal(requests.length, 1)
  release()
  await Promise.resolve(); await Promise.resolve()
  await f.tick()
  assert.equal(requests.length, 2)
  await f.controller.update(f.binding({ scope: { ...scope, contextKey: 'new' } }))
  assert.equal(requests[1].signal.aborted, true)
  assert.equal(requests[1].isCurrent(), false)
  f.channels[1].emit()
  release()
  await f.tick()
  assert.equal(f.refreshes.length, 1)
  await f.controller.dispose()
})

test('cleanup failure blocks replacement and permits explicit retry', async t => {
  const f = fixture(t)
  await f.controller.update(f.binding())
  f.client.removeChannel = async () => 'timed out'
  const next = f.binding({ scope: { ...scope, tenantId: 'other' } })
  await assert.rejects(f.controller.update(next), /cleanup failed/)
  assert.equal(f.channels.length, 1)
  f.channels[0].emit()
  await f.tick()
  assert.equal(f.refreshes.length, 0)
  f.client.removeChannel = async () => 'ok'
  await f.controller.update(next)
  assert.equal(f.channels.length, 2)
  assert.deepEqual(f.errors, ['cleanup'])
  await f.controller.dispose()
})

test('refresh failures do not retry automatically; filters and keys are identity inputs', async t => {
  const f = fixture(t)
  let calls = 0
  await f.controller.update(f.binding({ refresh: () => { calls++; throw new Error('private') } }))
  f.channels[0].emit()
  await f.tick(); await f.tick(); await f.tick()
  assert.equal(calls, 1)
  assert.deepEqual(f.errors, ['refresh'])
  await f.controller.update(f.binding({ filters: [{ ...filter, event: 'INSERT' }] }))
  await f.controller.update(f.binding({ dataKeys: ['other'] }))
  assert.equal(f.channels.length, 3)
  await f.controller.dispose()
})

test('setup failures clean partial channels before a retry; incomplete scopes are rejected', async t => {
  const f = fixture(t)
  await assert.rejects(f.controller.update(f.binding({ scope: { ...scope, sessionId: '' } })), /authenticated scope/)
  const channelFactory = f.client.channel
  f.client.channel = name => { const channel = channelFactory(name); channel.subscribe = () => { throw new Error('setup') }; return channel }
  await assert.rejects(f.controller.update(f.binding()), /setup/)
  f.client.channel = channelFactory
  await f.controller.update(f.binding())
  assert.equal(f.removed.length, 1)
  assert.equal(f.channels.length, 2)
  await f.controller.dispose()
})
