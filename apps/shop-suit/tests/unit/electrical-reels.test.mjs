import assert from 'node:assert/strict'
import test from 'node:test'
import { cachedReelBarcodeItem, cartLineKey, physicalCartError, saleLineInput, selectedUnitPrice } from '../../app/utils/pos.js'
import { isWholePackagingReturn } from '../../app/utils/measurement.js'
import { projectReceipt } from '../../app/utils/receiptPresentation.ts'
const cable = { id: 'cable', itemType: 'product', quantity: 80, stock: 100, measurement: { reelTracking: true, revision: 2, baseUnitCode: 'm', increment: '0.001', baseUnitPrice: '35', packages: [{ id: 'p', version: 1, baseQuantity: '50', salePrice: 1600 }] }, reelSummary: { automaticAvailable: '100', largestAutomatic: '50', sealedByLength: { '50': 2 } } }
test('offline preview distinguishes continuous length from separate physical pieces', () => {
 assert.equal(physicalCartError(cable), 'CONTINUOUS_LENGTH_UNAVAILABLE')
 assert.equal(physicalCartError({ ...cable, allowSplit: true }), null)
 assert.equal(physicalCartError({ ...cable, quantity: 100, allowSplit: true, cuttingLoss: '0.001' }), 'INSUFFICIENT_REEL_LENGTH')
 assert.equal(physicalCartError({ ...cable, quantity: 49.999, cuttingLoss: '0.001' }), null)
 assert.equal(physicalCartError({ ...cable, quantity: 1, cuttingLoss: '0.000001' }), 'INVALID_MEASUREMENT_INCREMENT')
 assert.equal(physicalCartError({ ...cable, reelSummary: null }), 'REEL_STOCK_UNCONFIRMED')
})
test('selected remnants retain explicit identity, exact commands and authoritative preview price', () => {
 const selected = { ...cable, quantity: 12.5, reelId: 'physical', reelRemaining: '12.52', reelPrice: '30', cuttingLoss: '0.02' }
 assert.equal(physicalCartError(selected), null)
 assert.equal(physicalCartError({ ...selected, cuttingLoss: '0.021' }), 'SELECTED_REEL_CANNOT_FULFILL')
 assert.notEqual(cartLineKey(selected), cartLineKey(cable))
 assert.equal(selectedUnitPrice(selected), 30)
 assert.deepEqual(saleLineInput(selected), { item_type: 'product', source_id: 'cable', quantity: '12.5', measurement_revision: 2, unit_code: 'm', allow_split: false, cutting_loss: '0.02', reel_id: 'physical' })
})
test('sealed packaging cannot use loss or an opened source; quantities require matching sealed lengths', () => {
 const whole = { ...cable, unitSelection: 'package:p', quantity: 2 }
 assert.equal(physicalCartError(whole), null)
 assert.equal(physicalCartError({ ...whole, quantity: 3 }), 'INSUFFICIENT_SEALED_REELS')
 assert.equal(physicalCartError({ ...whole, cuttingLoss: '0.001' }), 'INVALID_SEALED_REEL_SALE')
 assert.equal(physicalCartError({ ...whole, quantity: 1, reelId: 'r', reelRemaining: '50', reelStatus: 'open' }), 'INSUFFICIENT_SEALED_REELS')
 assert.equal(selectedUnitPrice({ ...whole, reelPrice: '20', reelId: 'r' }), 1600)
})
test('return eligibility uses frozen whole-package ratios without rounding', () => {
 const snapshot = { packageId: 'old', baseQuantity: '300', enteredQuantity: '3' }
 assert.equal(isWholePackagingReturn('100', snapshot), true)
 assert.equal(isWholePackagingReturn('200', snapshot), true)
 assert.equal(isWholePackagingReturn('99.999', snapshot), false)
 assert.equal(isWholePackagingReturn('0', snapshot), false)
 assert.equal(isWholePackagingReturn('100', { ...snapshot, packageId: null }), false)
})
test('receipt source barcodes remain visible when optional marketing descriptions are hidden', () => {
 const receipt = { currency: 'EGP', business: { name: 'Electrical' }, location: { name: 'Shop' }, customer: {}, invoiceNumber: '1', issuedAt: '2026-10-22T12:00:00Z', subtotal: 35, discount: 0, total: 35, payments: [], presentation: { showDescriptions: false }, lines: [{ id: 'l', name: 'Cable', description: 'Hidden', quantity: 1, unitPrice: 35, total: 35, measurement: { enteredQuantity: '1', enteredUnitPrice: '35', unitNameEn: 'Meter', unitNameAr: 'متر', baseUnitCode: 'm', reelAllocations: [{ barcode: 'SOURCE-1', soldQuantity: '1' }] } }] }
 assert.equal(projectReceipt(receipt, 'en', key => key).view.lines[0].description, 'SOURCE-1: 1 m')
})

test('offline physical scans require a cached sellable identity and retain explicit remnant pricing', () => {
 const options = { summary: cable.reelSummary, items: [{ id: 'r', barcode: 'REMNANT', status: 'open', classification: 'discounted', remainingLength: '12.52', price: '30' }] }
 const selected = cachedReelBarcodeItem(cable, options, 'REMNANT')
 assert.equal(selected.reelId, 'r'); assert.equal(selected.unitPrice, 30); assert.equal(selected.reelRemaining, '12.52')
 assert.equal(cachedReelBarcodeItem(cable, null, 'REMNANT'), null)
 assert.equal(cachedReelBarcodeItem(cable, options, 'UNKNOWN'), null)
 assert.equal(cachedReelBarcodeItem(cable, { ...options, items: [{ ...options.items[0], status: 'damaged' }] }, 'REMNANT'), null)
})
