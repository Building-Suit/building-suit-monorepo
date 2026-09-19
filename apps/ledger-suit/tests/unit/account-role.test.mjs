import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isPostingAccount } from '../../app/utils/accountRole.ts'

test('explicit role preserves a legacy parent as postable and excludes empty groups', () => {
  assert.equal(isPostingAccount({ account_role: 'posting', is_archived: false, parent_account_id: null }), true)
  assert.equal(isPostingAccount({ account_role: 'group', is_archived: false, is_liquid: true }), false)
  assert.equal(isPostingAccount({ account_role: 'posting', is_archived: true }), false)
  assert.equal(isPostingAccount({ account_role: 'unknown', is_archived: false }), false)
})
