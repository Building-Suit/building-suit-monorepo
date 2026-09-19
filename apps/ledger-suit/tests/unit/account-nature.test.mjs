import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultAccountNature, accountBalanceDisplay } from '../../app/utils/accountNature.ts'
import { formatMoney } from '../../app/utils/money.ts'

test('drawings default to debit within equity; type defaults remain suggestions', () => {
  assert.equal(defaultAccountNature('equity', 'owner_drawings'), 'debit')
  assert.equal(defaultAccountNature('asset'), 'debit')
  assert.equal(defaultAccountNature('liability'), 'credit')
})
test('actual side follows posted net amounts and retains full bigint precision', () => {
  assert.deepEqual(accountBalanceDisplay('-9223372036854775807'), { amount: '9223372036854775807', side: 'credit' })
  assert.deepEqual(accountBalanceDisplay('20'), { amount: '20', side: 'debit' })
  assert.deepEqual(accountBalanceDisplay('0'), { amount: '0', side: 'zero' })
})
test('money display preserves every cent and the sign of sub-unit amounts', () => {
  assert.equal(formatMoney('9223372036854775807', 'USD', 'en-US'), '$92,233,720,368,547,758.07')
  assert.equal(formatMoney('-1', 'USD', 'en-US'), '-$0.01')
  assert.equal(formatMoney('1234', 'KWD', 'en-US'), 'KWD\u00a01.234')
  assert.equal(formatMoney('1234', 'JPY', 'en-US'), '¥1,234')
  assert.match(formatMoney('-9223372036854775807', 'EGP', 'ar'), /92,233,720,368,547,758\.07/)
  assert.throws(() => formatMoney(Number.MAX_SAFE_INTEGER + 1, 'USD'), RangeError)
})
