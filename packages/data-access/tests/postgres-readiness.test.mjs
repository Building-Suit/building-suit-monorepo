import test from 'node:test'
import assert from 'node:assert/strict'
import { createPostgresReadinessBarrier } from '../src/postgresReadiness.ts'
function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });let system;let status;const seen = []
  const barrier = createPostgresReadinessBarrier(callback => { system = callback },callback => { status = callback },100)
  barrier.subscribe(value => seen.push(value))
  return { barrier,seen,status: value => status(value),system: value => system(value),tick: () => t.mock.timers.tick(100) }
}
const ready = { extension: 'postgres_changes',status: 'ok' }
test('channel acknowledgement and Postgres readiness are both required in either order',t => {
  const a = fixture(t);a.status('SUBSCRIBED');assert.deepEqual(a.seen,[]);a.system({ extension: 'system',status: 'ok' });assert.deepEqual(a.seen,[]);a.system(ready);assert.deepEqual(a.seen,['SUBSCRIBED']);a.system(ready);assert.equal(a.seen.length,1);a.barrier.dispose();t.mock.timers.reset()
  const b = fixture(t);b.system(ready);assert.deepEqual(b.seen,[]);b.status('SUBSCRIBED');assert.deepEqual(b.seen,['SUBSCRIBED']);b.barrier.dispose()
})
test('disconnect requires a new readiness signal before authoritative reconnect',t => {
  const f = fixture(t);f.system(ready);f.status('SUBSCRIBED');f.status('CLOSED');f.status('SUBSCRIBED');assert.deepEqual(f.seen,['SUBSCRIBED','CLOSED']);f.system(ready);assert.deepEqual(f.seen,['SUBSCRIBED','CLOSED','SUBSCRIBED']);f.barrier.dispose()
})
test('missing readiness has a bounded failure and provider subscription errors fail closed',t => {
  const f = fixture(t);f.status('SUBSCRIBED');f.tick();assert.deepEqual(f.seen,['TIMED_OUT']);f.system({ extension: 'postgres_changes',status: 'error',message: 'never emitted' });assert.deepEqual(f.seen,['TIMED_OUT','CHANNEL_ERROR']);f.barrier.dispose()
})
test('removed channels cannot publish a late ready/status callback or deadline',t => {
  const f = fixture(t);f.barrier.dispose();f.system(ready);f.status('SUBSCRIBED');f.tick();assert.deepEqual(f.seen,[])
})


test('duplicate admitted statuses do not arm a false deadline on an active stream',t => {
  const f = fixture(t);f.system(ready);f.status('SUBSCRIBED');f.status('SUBSCRIBED');f.tick();f.system(ready);f.status('SUBSCRIBED');f.tick();assert.deepEqual(f.seen,['SUBSCRIBED']);f.barrier.dispose()
})
