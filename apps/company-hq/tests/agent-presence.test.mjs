import test from 'node:test'
import assert from 'node:assert/strict'
import { hqCosmeticIdle, hqObservationFresh, hqObservedActivity } from '../app/utils/hqAgentPresence.ts'

const now = Date.parse('2026-11-05T12:00:00.000Z')
const fresh = new Date(now - 10_000).toISOString()

test('configured employees without their own observation stay offline under a connected host', () => {
  assert.equal(hqObservedActivity({ status: 'idle', lastSeenAt: null }, true, now), 'offline')
  assert.equal(hqObservedActivity({ status: 'working', lastSeenAt: new Date(now - 150_000).toISOString() }, true, now), 'offline')
})
test('only fresh observed employee state may claim working or available presence', () => {
  assert.equal(hqObservedActivity({ status: 'working', lastSeenAt: fresh }, true, now), 'working')
  assert.equal(hqObservedActivity({ status: 'idle', lastSeenAt: fresh }, true, now), 'idle')
  assert.equal(hqObservedActivity({ status: 'offline', lastSeenAt: fresh }, true, now), 'offline')
  assert.equal(hqObservedActivity({ status: 'blocked', lastSeenAt: fresh }, true, now), 'unknown')
})
test('cosmetic roaming does not change actual presence and stops when the host is offline', () => {
  const actual = hqObservedActivity({ status: 'idle', lastSeenAt: null }, true, now)
  assert.equal(actual, 'offline')
  assert.equal(hqCosmeticIdle(true, actual, true), true)
  assert.equal(hqCosmeticIdle(false, actual, true), false)
  assert.equal(hqCosmeticIdle(true, actual, false), false)
  assert.equal(hqCosmeticIdle(true, 'working', true), false)
  assert.equal(hqCosmeticIdle(true, 'idle', true), false)
})
test('host loss hides observed employees and invalid timestamps fail closed', () => {
  assert.equal(hqObservedActivity({ status: 'working', lastSeenAt: fresh }, false, now), 'offline')
  assert.equal(hqObservationFresh('invalid', now), false)
  assert.equal(hqObservationFresh(new Date(now + 300_001).toISOString(), now), false)
  assert.equal(hqObservationFresh(fresh, NaN), false)
})
