import test from 'node:test'
import assert from 'node:assert/strict'
import { safeReturnPath } from '../src/index.ts'
test('post-auth redirects reject external and malformed targets', () => {
  for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', '/path\nheader', null, 42]) assert.equal(safeReturnPath(value), '/dashboard')
  assert.equal(safeReturnPath('/reports?tab=balances'), '/reports?tab=balances')
})
