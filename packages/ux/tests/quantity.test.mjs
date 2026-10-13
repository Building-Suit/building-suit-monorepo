import test from 'node:test'
import assert from 'node:assert/strict'
import { boundedQuantity, steppedQuantity } from '../src/utils/quantity.ts'
test('touch steps preserve fractions, clamp at limits and allow zero as a removal intent', () => {
  assert.equal(steppedQuantity(1.2, 1, 1, 0, 10), 2.2)
  assert.equal(steppedQuantity(.5, -1, 1, 0, 10), 0)
  assert.equal(steppedQuantity(2, 1, 1, 0, 2), 2)
  assert.equal(boundedQuantity(.5, 0, 2), .5)
})
test('invalid counts and invalid ranges never emit usable quantity values', () => {
  assert.equal(boundedQuantity(NaN, 0, 10), null)
  assert.equal(steppedQuantity(Infinity, 1, 1, 0, 10), null)
  assert.equal(steppedQuantity(1, 1, 0, 0, 10), null)
  assert.equal(boundedQuantity(1, 2, 1), null)
})
