import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { createAdminLiveUpdates } from '../../app/utils/live-updates.ts'
const scope = { userId: 'owner', authorityEnvironmentId: 'environment' }
const event = (id = '11111111-1111-4111-8111-111111111111', kinds = ['activity']) => ({ id, kinds, authorityEnvironmentId: scope.authorityEnvironmentId })
function fixture(t, overrides = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const channels = [], reads = [], checks = []
  const controller = createAdminLiveUpdates({
    channel(context) {
      const channel = { context, closes: 0, onInvalidate(callback) { this.emit = callback }, subscribe(callback) { this.status = callback }, async close() { this.closes++ } }
      channels.push(channel); return channel
    },
    async authorize() { checks.push('check'); return true }, paused: () => false,
    async refresh(kinds, isCurrent) { reads.push({ kinds, isCurrent }) }, ...overrides,
  })
  const tick = async (ms = 250) => { t.mock.timers.tick(ms); await setImmediate() }
  return { controller, channels, reads, checks, tick }
}
test('idle has no polling; initial subscription and reconnect each recover once', async t => {
  const f = fixture(t); await f.controller.update(scope)
  await f.tick(90000); assert.equal(f.reads.length, 0)
  f.channels[0].status('SUBSCRIBED'); f.channels[0].status('SUBSCRIBED')
  await f.tick(); assert.equal(f.reads.length, 1); assert.equal(f.reads[0].kinds.length, 5)
  await f.tick(90000); assert.equal(f.reads.length, 1)
  f.channels[0].status('CHANNEL_ERROR'); f.channels[0].status('SUBSCRIBED'); await f.tick()
  assert.equal(f.reads.length, 2); await f.controller.dispose(); assert.equal(f.channels[0].closes, 1)
})
test('scoped notifications coalesce and reject duplicate, cross-environment and malformed events', async t => {
  const f = fixture(t); await f.controller.update(scope); const ch = f.channels[0]
  ch.emit(event()); ch.emit(event()); ch.emit(event('22222222-2222-4222-8222-222222222222', ['registry']))
  ch.emit({ ...event('33333333-3333-4333-8333-333333333333'), authorityEnvironmentId: 'foreign' })
  ch.emit(event('bad')); ch.emit(event('44444444-4444-4444-8444-444444444444', ['table-dump']))
  await f.tick(); assert.deepEqual(f.reads.map(r => r.kinds), [['activity', 'registry']]); assert.equal(f.checks.length, 1)
  await f.controller.dispose()
})
test('dirty review defers refresh but still rechecks authority and resumes pending work', async t => {
  let paused = true
  const f = fixture(t, { paused: () => paused }); await f.controller.update(scope)
  f.channels[0].emit(event()); await f.tick(); assert.equal(f.checks.length, 1); assert.equal(f.reads.length, 0)
  await f.tick(90000); assert.equal(f.checks.length, 1)
  paused = false; f.controller.resume(); await f.tick(); assert.equal(f.reads.length, 1)
  await f.controller.dispose()
})
test('failed authority does not refresh or retry in a loop', async t => {
  let allowed = false
  const f = fixture(t, { authorize: async () => allowed }); await f.controller.update(scope)
  f.channels[0].emit(event()); await f.tick(); await f.tick(90000); assert.equal(f.reads.length, 0)
  allowed = true; f.controller.recover(); await f.tick(); assert.equal(f.reads.length, 1)
  await f.controller.dispose()
})
test('identity transition and disposal close channels and invalidate stale callbacks/in-flight work', async t => {
  const f = fixture(t); await f.controller.update(scope); const old = f.channels[0]
  old.emit(event()); await f.tick(); assert.equal(f.reads[0].isCurrent(), true)
  await f.controller.update({ ...scope, userId: 'other' }); assert.equal(old.closes, 1); assert.equal(f.reads[0].isCurrent(), false)
  old.emit(event('22222222-2222-4222-8222-222222222222')); old.status('SUBSCRIBED'); await f.tick(); assert.equal(f.reads.length, 1)
  await f.controller.dispose(); assert.equal(f.channels[1].closes, 1)
  f.channels[1].emit(event()); f.controller.recover(); await f.tick(90000); assert.equal(f.reads.length, 1)
})
test('failed refresh is retained for explicit recovery without an automatic retry loop', async t => {
  let attempts = 0
  const f = fixture(t, { refresh: async () => { if (++attempts === 1) throw new Error('offline') } })
  await f.controller.update(scope); f.channels[0].emit(event()); await f.tick(); await f.tick(90000); assert.equal(attempts, 1)
  f.controller.resume(); await f.tick(); assert.equal(attempts, 2); await f.controller.dispose()
})
