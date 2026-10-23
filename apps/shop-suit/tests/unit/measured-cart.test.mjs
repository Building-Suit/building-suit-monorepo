import assert from 'node:assert/strict'
import test from 'node:test'
import { addOrIncrementCartLine, cartLineKey, cartQuantityLimit, cartQuantityStep, measuredBaseQuantity, saleLineInput, selectedUnitPrice } from '../../app/utils/pos.js'
import { projectReceipt } from '../../app/utils/receiptPresentation.ts'

const cable = { id: 'cable', itemType: 'product', name: 'Blue cable', unitPrice: 35, discount: 0, stock: 187.5, measurement: { baseUnitCode: 'm', increment: '0.001', revision: 3, saleUnits: ['m', 'cm', 'ft'], baseUnitPrice: '35', packages: [{ id: 'reel100', code: 'R100', name: '100 m reel', unitCode: 'reel', baseQuantity: '100', version: 2, salePrice: 3200, canSell: true, canPurchase: true }] } }
test('loose length and whole reels retain distinct cart identities and command quantities', () => {
 const loose = { ...cable, unitSelection: 'unit:m' }
 const reel = { ...cable, unitSelection: 'package:reel100' }
 let cart = addOrIncrementCartLine([], loose)
 cart = addOrIncrementCartLine(cart, reel)
 cart = addOrIncrementCartLine(cart, reel)
 assert.equal(cart.length, 2)
 assert.notEqual(cart[0].key, cart[1].key)
 assert.equal(cart[1].quantity, 2)
 assert.deepEqual(saleLineInput(cart[1]), { item_type: 'product', source_id: 'cable', quantity: '2', measurement_revision: 3, package_id: 'reel100', package_version: 2 })
 assert.equal(measuredBaseQuantity(cart[1]), '200')
 assert.equal(selectedUnitPrice(reel), 3200)
 assert.equal(cartQuantityLimit(reel), 1)
 assert.throws(() => measuredBaseQuantity({ ...reel, quantity: 0.5 }), /INVALID_PACKAGE_QUANTITY/)
})
test('centimeter and gram previews preserve exact base quantities and product increments', () => {
 assert.equal(measuredBaseQuantity({ ...cable, unitSelection: 'unit:cm', quantity: 250 }), '2.5')
 assert.equal(cartQuantityStep({ ...cable, unitSelection: 'unit:cm' }), 0.1)
 assert.equal(cartQuantityStep(cable), 0.001)
 const copper = { ...cable, measurement: { ...cable.measurement, baseUnitCode: 'kg', increment: '0.001', baseUnitPrice: '200' }, unitSelection: 'unit:g', quantity: 250 }
 assert.equal(measuredBaseQuantity(copper), '0.25')
 assert.equal(cartQuantityStep(copper), 1)
 assert.equal(selectedUnitPrice(copper), 0.2)
 assert.throws(() => measuredBaseQuantity({ ...copper, quantity: 250.1 }), /INVALID_MEASUREMENT_INCREMENT/)
})
test('feet use the smallest representable step instead of rounding to meters', () => {
 const feet = { ...cable, unitSelection: 'unit:ft' }
 assert.equal(cartQuantityStep(feet), 1.25)
 assert.equal(measuredBaseQuantity({ ...feet, quantity: 1.25 }), '0.381')
 assert.throws(() => measuredBaseQuantity({ ...feet, quantity: 1 }), /INVALID_MEASUREMENT_INCREMENT/)
})
test('legacy cart keys and numeric command payloads remain compatible', () => {
 const legacy = { id: 'old', itemType: 'product', quantity: 0.5, unitPrice: 10 }
 assert.equal(cartLineKey(legacy), 'product:old')
 assert.deepEqual(saleLineInput(legacy), { item_type: 'product', source_id: 'old', quantity: 0.5 })
})
test('receipt projection uses frozen entered units and prices in both languages', () => {
 const receipt = { currency: 'EGP', business: { name: 'Electrical' }, location: { name: 'Shop' }, customer: {}, invoiceNumber: 'INV-1', issuedAt: '2026-10-22T12:00:00Z', subtotal: 87.5, discount: 0, total: 87.5, payments: [], lines: [{ id: 'line', name: 'Cable', quantity: 2.5, unitPrice: 35, total: 87.5, measurement: { enteredQuantity: '250', enteredUnitPrice: '0.35', unitNameEn: 'Centimeter', unitNameAr: 'سنتيمتر' } }] }
 const before = structuredClone(receipt)
 const en = projectReceipt(receipt, 'en', key => key).view.lines[0]
 const ar = projectReceipt(receipt, 'ar', key => key).view.lines[0]
 assert.equal(en.quantity, '250 Centimeter')
 assert.equal(ar.quantity, '250 سنتيمتر')
 assert.match(en.unitPrice, /0\.35/)
 assert.deepEqual(receipt, before)
})
