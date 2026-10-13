import test from 'node:test'
import assert from 'node:assert/strict'
import { cartQuantityLimit, nextCartQuantity } from '../../app/utils/pos.js'
test('catalog increments respect remaining stock without blocking fractional product sales', () => {
  const product = { itemType: 'product', stock: .5 }
  assert.equal(nextCartQuantity(0, product), .5)
  assert.equal(nextCartQuantity(.5, product), null)
  assert.equal(nextCartQuantity(.5, { ...product, stock: 1 }), 1)
  assert.equal(nextCartQuantity(0, { ...product, stock: 0 }), null)
  assert.equal(nextCartQuantity(2, { ...product, stock: 1 }), null)
})
test('services and legacy unknown-stock entries preserve the existing quantity ceiling', () => {
  assert.equal(cartQuantityLimit({ itemType: 'service', stock: 0 }), 1000000)
  assert.equal(nextCartQuantity(0, { itemType: 'product' }), 1)
  assert.equal(nextCartQuantity(1000000, { itemType: 'service' }), null)
})
