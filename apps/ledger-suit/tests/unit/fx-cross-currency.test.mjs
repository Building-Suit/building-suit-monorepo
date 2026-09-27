import assert from 'node:assert/strict'
import test from 'node:test'
import { allocateCarryingBase, allocationRoundingResidual, convertMinorExact, divideHalfAway, parsePositiveDecimal } from '../../app/utils/fxMoney.ts'

test('rates are exact normalized rational decimals', () => {
  assert.deepEqual(parsePositiveDecimal(' 50.2500 '), { numerator: 201n, denominator: 4n, canonical: '50.25' })
  assert.deepEqual(parsePositiveDecimal('٦٠٫٠٠'), { numerator: 60n, denominator: 1n, canonical: '60' })
  assert.throws(() => parsePositiveDecimal('1.0000000000001'), /12 decimal/)
  assert.throws(() => parsePositiveDecimal('0'), /positive/)
})

test('half-away rounding is symmetric and does not use Number', () => {
  assert.equal(divideHalfAway(5n, 2n), 3n)
  assert.equal(divideHalfAway(-5n, 2n), -3n)
  assert.equal(divideHalfAway(4n, 3n), 1n)
  assert.equal(divideHalfAway(-4n, 3n), -1n)
})

test('synthetic AR/AP conversion preserves the approved examples', () => {
  assert.equal(convertMinorExact(10_000n, 'USD', 'EGP', '50'), 500_000n)
  assert.equal(convertMinorExact(9_000n, 'EUR', 'EGP', '60'), 540_000n)
  assert.equal(540_000n - 500_000n, 40_000n)
})

test('zero-, two- and three-decimal currencies round at the target scale', () => {
  assert.equal(convertMinorExact(1n, 'JPY', 'EGP', '0.505'), 51n)
  assert.equal(convertMinorExact(101n, 'USD', 'JPY', '1.5'), 2n)
  assert.equal(convertMinorExact(1_001n, 'KWD', 'EGP', '100'), 10_010n)
  assert.equal(convertMinorExact(1n, 'USD', 'KWD', '0.05'), 1n)
})

test('full allocations consume exact carrying value and partials round deterministically', () => {
  assert.equal(allocateCarryingBase(5_500n, 100n, 50n), 2_750n)
  assert.equal(allocateCarryingBase(5_501n, 3n, 1n), 1_834n)
  assert.equal(allocateCarryingBase(3_667n, 2n, 2n), 3_667n)
  assert.equal(allocationRoundingResidual(10n, 3n, 1n, 4n), 1n)
})

test('values above the JavaScript safe integer range stay exact', () => {
  const amount = 9_007_199_254_740_993n
  assert.equal(convertMinorExact(amount, 'USD', 'EGP', '1'), amount)
  assert.equal(allocateCarryingBase(amount, amount, amount), amount)
})
