import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateVatMinor, vatReportReconciles } from '../../app/utils/egyptVat.ts'

test('approved VAT rounds once at the EGP document minor-unit boundary', () => {
  assert.equal(calculateVatMinor(100_000n, 1400n), 14_000n)
  assert.equal(calculateVatMinor(1_005n, 1400n), 141n)
  assert.equal(calculateVatMinor(9_007_199_254_740_993n, 1400n), 1_261_007_895_663_739n)
})

test('VAT reconciliation requires both source-to-GL differences to be exactly zero', () => {
  const report = { reconciled: true, output_difference_minor: '0', input_difference_minor: '0' }
  assert.equal(vatReportReconciles(report), true)
  assert.equal(vatReportReconciles({ ...report, input_difference_minor: '1' }), false)
  assert.equal(vatReportReconciles(null), false)
})

test('non-positive bases and rates are rejected before calculation', () => {
  assert.throws(() => calculateVatMinor(0n, 1400n), RangeError)
  assert.throws(() => calculateVatMinor(100n, 0n), RangeError)
})

