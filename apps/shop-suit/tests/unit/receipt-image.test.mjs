import assert from 'node:assert/strict'
import test from 'node:test'
import { renderReceiptDocument } from '../../../../packages/ui/src/utils/receiptDocument.ts'
import { projectReceipt, sumReceiptAmounts } from '../../app/utils/receiptPresentation.ts'
import { copyDocumentImage } from '../../../../packages/ux/src/utils/documentImage.ts'

const receipt = { business: { name: '<Tenant & Shop>', address: null, phone: null }, location: { name: 'فرع / Branch', code: '01', address: 'Address', phone: '+20100' }, invoiceNumber: 'SALE-1', issuedAt: '2026-10-15T10:00:00Z', currency: 'EGP', staffName: 'Cashier', customer: { name: 'Customer' }, lines: [{ id: '1', name: 'منتج', quantity: 2, unitPrice: 15, total: 25, discount: 5 }], payments: [{ id: 'a', amount: 10, method: 'cash', reference: 'CASH-1' }, { id: 'b', amount: 5, method: 'card', reference: 'CARD-1' }], subtotal: 30, discount: 5, total: 27, tax: { calculationEnabled: true, tax: 2 }, footer: null }
const translate = key => key.split('.').at(-1)

test('financial projection preserves discount/tax, actual paid amount, balance and every allocation', () => {
  const original = structuredClone(receipt)
  const { view } = projectReceipt(receipt, 'en', translate)
  assert.deepEqual(view.totals.map(total => total.id), ['subtotal', 'discount', 'tax', 'invoice-total', 'balance', 'total'])
  assert.equal(view.totals.at(-1).value, 'EGP\u00a015.00')
  assert.equal(view.totals.find(total => total.id === 'balance').value, 'EGP\u00a012.00')
  assert.equal(view.payments.length, 2)
  assert.deepEqual(receipt, original)
  assert.equal(sumReceiptAmounts([0.1, 0.2]), 0.3)
  assert.equal(sumReceiptAmounts([1.234, 2.345]), 3.579)
  assert.equal(sumReceiptAmounts([1e-7, 2e-7]), 3e-7)
})

test('both directions escape merchant content and retain all financial rows and payment references', () => {
  for (const language of ['ar', 'en']) {
    const { view, copy } = projectReceipt(receipt, language, translate)
    const html = renderReceiptDocument(view, copy, language)
    assert.ok(html.includes('&lt;Tenant &amp; Shop&gt;'))
    assert.ok(html.includes('CASH-1') && html.includes('CARD-1'))
    assert.ok(html.includes('discount') && html.includes('tax') && html.includes('balance'))
    assert.ok(html.includes(`dir="${language === 'ar' ? 'rtl' : 'ltr'}"`))
    assert.ok(!html.includes('Tareq') && !html.includes('Founder'))
    assert.ok(!html.includes('<button'))
  }
})

test('remote/untrusted logos never become image requests; merchant notes are escaped', () => {
  const { view, copy } = projectReceipt(receipt, 'en', translate)
  view.logoDataUrl = 'https://evil.example/receipt'
  view.notes = '<script>alert(1)</script>'
  const html = renderReceiptDocument(view, copy, 'en')
  assert.ok(!html.includes('evil.example'))
  assert.ok(html.includes('&lt;script&gt;'))
})

test('unrecognized direction metadata cannot introduce HTML attributes', () => {
  const { view, copy } = projectReceipt(receipt, 'en', translate)
  view.direction = 'rtl" onmouseover="alert(1)'
  const html = renderReceiptDocument(view, copy, 'en')
  assert.ok(html.includes('dir="ltr"'))
  assert.ok(!html.includes('onmouseover'))
})

test('image clipboard write starts synchronously, contains only PNG, and resolves after browser confirmation', async () => {
  let finishRender, finishWrite
  const events = []
  class Item { constructor(data) { this.data = data } }
  const clipboard = { write(items) { events.push('write'); assert.deepEqual(Object.keys(items[0].data), ['image/png']); return new Promise(resolve => { finishWrite = resolve }) } }
  const result = copyDocumentImage(() => { events.push('render'); return new Promise(resolve => { finishRender = resolve }) }, clipboard, Item).then(() => events.push('success'))
  assert.deepEqual(events, ['render', 'write'])
  finishRender(new Blob(['png'], { type: 'image/png' }))
  await Promise.resolve()
  assert.ok(!events.includes('success'))
  finishWrite()
  await result
  assert.equal(events.at(-1), 'success')
})

test('unsupported and denied image writes reject without text fallback', async () => {
  let rendered = false
  await assert.rejects(copyDocumentImage(async () => { rendered = true; return new Blob() }, {}, undefined))
  assert.equal(rendered, false)
  class Item { constructor(data) { this.data = data } }
  await assert.rejects(copyDocumentImage(async () => new Blob(), { write: async () => { throw new Error('denied') } }, Item), /denied/)
})
