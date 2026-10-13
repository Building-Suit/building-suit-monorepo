import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { attemptKey, restoreAttempt, clearActivationAttempts } from '../../app/utils/activation-attempt.ts'

const scope = () => ({ userId: randomUUID(), authorityEnvironmentId: randomUUID(), bindingId: randomUUID() })
const input = s => ({ bindingId: s.bindingId, shopId: randomUUID(), subscriptionId: randomUUID(), planId: randomUUID(), requestId: randomUUID(), correlationId: randomUUID(), reason: 'Owner approved activation' })
test('reload restores exactly the same command IDs for its owner/environment/binding', () => {
  const s = scope(), attempt = input(s)
  assert.deepEqual(restoreAttempt(JSON.stringify(attempt), s), attempt)
  for (const other of [{ ...s, userId: randomUUID() }, { ...s, authorityEnvironmentId: randomUUID() }, { ...s, bindingId: randomUUID() }]) assert.notEqual(attemptKey(s), attemptKey(other))
  assert.equal(restoreAttempt(JSON.stringify(attempt), { ...s, bindingId: randomUUID() }), null)
})
test('malformed/expanded stored commands never become retries', () => {
  const s = scope(), attempt = input(s)
  for (const value of ['', '{', 'null', JSON.stringify({ ...attempt, payment: true }), JSON.stringify({ ...attempt, requestId: 'bad' })]) assert.equal(restoreAttempt(value, s), null)
})
test('account switch clears foreign attempts and sign out clears all without touching unrelated storage', () => {
  const a = scope(), b = scope()
  const map = new Map([[attemptKey(a), '{}'], [attemptKey(b), '{}'], ['theme', 'dark']])
  const storage = { get length() { return map.size }, key: index => [...map.keys()][index] ?? null, removeItem: key => map.delete(key) }
  clearActivationAttempts(storage, a.userId)
  assert.deepEqual([...map.keys()], [attemptKey(a), 'theme'])
  clearActivationAttempts(storage)
  assert.deepEqual([...map], [['theme', 'dark']])
})
