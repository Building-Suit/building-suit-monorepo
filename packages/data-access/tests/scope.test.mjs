import test from 'node:test'
import assert from 'node:assert/strict'
import { scopedQueryKey } from '../src/index.ts'
test('each isolation boundary changes the query cache key', () => {
  const scope = { environment: 'staging', portal: 'ledger-suit', userId: 'u1', tenantId: 't1' }
  const base = scopedQueryKey(scope, 'transactions', { page: 1 })
  for (const field of Object.keys(scope)) assert.notEqual(scopedQueryKey({ ...scope, [field]: 'other' }, 'transactions', { page: 1 }), base)
  assert.notEqual(scopedQueryKey(scope, 'transactions', { page: 2 }), base)
  assert.notEqual(scopedQueryKey(scope, 'accounts', { page: 1 }), base)
})
