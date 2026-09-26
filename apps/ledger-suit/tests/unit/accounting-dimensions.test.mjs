import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allocationTotalMatches, dimensionReportReconciles } from '../../app/utils/accountingDimensions.ts'

test('assigned groups plus Unassigned reconcile only when every ledger control total is zero', () => {
  assert.equal(dimensionReportReconciles({ reconciliation_difference: { opening_debit_minor: '0', opening_credit_minor: '0', period_debit_minor: '0', period_credit_minor: '0' } }), true)
  assert.equal(dimensionReportReconciles({ reconciliation_difference: { opening_debit_minor: '0', opening_credit_minor: '0', period_debit_minor: '1', period_credit_minor: '0' } }), false)
})

test('multi-allocation uses exact integer minor-unit equality', () => {
  assert.equal(allocationTotalMatches(10_000n, [{ amountMinor: 6_000n }, { amountMinor: 4_000n }]), true)
  assert.equal(allocationTotalMatches(10_000n, [{ amountMinor: 6_000n }, { amountMinor: 4_001n }]), false)
  assert.equal(allocationTotalMatches(10_000n, []), false)
})
