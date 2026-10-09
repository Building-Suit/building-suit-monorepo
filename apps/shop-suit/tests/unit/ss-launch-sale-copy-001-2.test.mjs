import assert from 'node:assert/strict'
import test from 'node:test'
import { saleCopy, saleTransactionType } from '../../app/utils/saleCopy.js'

for (const field of ['itemType', 'item_type']) {
  test(`classification uses authoritative ${field}, independent of shop mode, stock, price or quantity`, () => {
    const product = { [field]: 'product', stock: null, quantity: 0, unitPrice: 0, businessMode: 'service' }
    const service = { [field]: 'service', stock: 999, quantity: 42, unitPrice: 100, businessMode: 'product' }
    assert.equal(saleTransactionType([product]), 'product')
    assert.equal(saleTransactionType([service]), 'service')
    assert.equal(saleTransactionType([service, product, service]), 'mixed')
    assert.equal(saleTransactionType([]), 'empty')
    assert.equal(saleTransactionType([{ stock: 1, product_id: 'p1' }]), 'empty')
    assert.equal(saleTransactionType([product, { [field]: 'unknown' }]), 'empty')
    assert.equal(saleTransactionType([product, { [field]: undefined }]), 'empty')
  })
}

for (const key of ['sales.issueConfirm', 'sales.checkoutConfirm', 'sales.fastPayConfirm', 'pos.confirm', 'sales.issuedSuccess', 'saleCorrections.confirm']) {
  test(`${key} composes line-specific effects and preserves payment placeholders and inputs`, () => {
    for (const kind of ['product', 'service', 'mixed']) {
      const lines = (kind === 'mixed' ? ['product', 'service'] : [kind]).map(itemType => Object.freeze({ itemType }))
      Object.freeze(lines)
      const translate = (messageKey, values) => values ? { key: messageKey, ...values } : messageKey
      const result = saleCopy(translate, key, lines, { amount: '100.00 EGP', method: 'Card' })
      assert.equal(result.key, key)
      assert.equal(result.amount, '100.00 EGP')
      assert.equal(result.method, 'Card')
      assert.equal(result.inventoryEffect, `sales.inventoryCopy.${kind}.effect`)
      assert.equal(result.inventoryResult, `sales.inventoryCopy.${kind}.result`)
      assert.equal(result.inventoryRestore, `sales.inventoryCopy.${kind}.restore`)
      assert.equal(result.inventoryError, `sales.inventoryCopy.${kind}.error`)
    }
  })
}
